// ============================================================
// components/NoteVocale.jsx — 🎤 Les notes vocales de 📲 WhatsApp, comme
// sur WhatsApp : le lecteur (▶, la forme du son, la vitesse) et le micro
// qu'on garde appuyé pour enregistrer.
// ============================================================
// Timo, 20/10/2026, capture d'un vocal dans l'application : « Pour lire et
// écouter les vocaux… on peut le faire comme sur WhatsApp Messenger
// exactement ? » → « A avec a2, B lance » :
//   A  — un lecteur comme WhatsApp (▶ / ⏸, les barres du son qui se
//        remplissent, toucher une barre pour avancer, 1× / 1,5× / 2×) ;
//   a2 — la note vocale se charge TOUTE SEULE à l'ouverture du fil ;
//   B  — garder le micro appuyé pour enregistrer, relâcher pour envoyer du
//        numéro BMI, glisser vers la gauche pour annuler.
// ⚠ Rien n'est rangé chez nous : une note ENVOYÉE se réécoute sur l'appareil
// qui l'a enregistrée (copie du navigateur, 30 jours) ; ailleurs il ne reste
// que sa ligne, et le son est sur le téléphone BMI.
import { useEffect, useRef, useState } from "react";
import { demarrerEnregistrement, fichierVocal } from "../enregistreurVocal";
import { dureeVocale, DUREE_MAX_VOCAL } from "../lib/oggOpus";
import { garderCopieVocal, lireCopieVocal } from "../vocauxLocaux";

export const NB_BARRES = 36;
export const VITESSES = [1, 1.5, 2];
export const libelleVitesse = (v) => `${String(v).replace(".", ",")}×`;

// ---- La forme du son : la crête de chaque tranche, ramenée entre 0,12 et 1 ----
export function barresDuSon(canal, nb = NB_BARRES) {
  if (!canal || !canal.length) return null;
  const pas = Math.max(1, Math.floor(canal.length / nb));
  const cretes = [];
  for (let b = 0; b < nb; b++) {
    let max = 0;
    for (let i = b * pas; i < Math.min(canal.length, (b + 1) * pas); i++) {
      const v = Math.abs(canal[i]);
      if (v > max) max = v;
    }
    cretes.push(max);
  }
  const plus = Math.max(...cretes) || 1;
  return cretes.map((c) => Math.max(0.12, c / plus));
}

// ---- Les notes ENVOYÉES : la mémoire de la page, et la copie de l'appareil ----
// « a » (20/10/2026) : YCloud ne rend pas un fichier déposé ; la note se
// réécoute après un F5 grâce à la copie gardée sur CET appareil, 30 jours
// (src/vocauxLocaux.js — jamais dans Supabase).
const vocauxDeLaSession = new Map();
export function garderVocal(id, blob) {
  if (!id || !blob || typeof URL === "undefined") return;
  vocauxDeLaSession.set(id, URL.createObjectURL(blob));
  garderCopieVocal(id, blob);
}
export const vocalGarde = (id) => vocauxDeLaSession.get(id) || "";

// La copie de l'appareil, relue à l'affichage : « » tant qu'on cherche,
// une adresse si elle est là, null si l'appareil ne l'a pas (ou ne sait pas
// garder de copie : rien à attendre).
const peutGarder = () => typeof indexedDB !== "undefined" && !!indexedDB;
export function useCopieVocale(id, active = true) {
  const [url, setUrl] = useState(() => (!active ? null : vocalGarde(id) || (peutGarder() ? "" : null)));
  useEffect(() => {
    if (!active || !peutGarder()) { setUrl(active ? vocalGarde(id) || null : null); return undefined; }
    const deja = vocalGarde(id);
    if (deja) { setUrl(deja); return undefined; }
    let fini = false, cree = "";
    setUrl("");
    lireCopieVocal(id).then((blob) => {
      if (fini) return;
      if (blob && typeof URL !== "undefined") { cree = URL.createObjectURL(blob); setUrl(cree); } else setUrl(null);
    });
    return () => { fini = true; if (cree) URL.revokeObjectURL(cree); };
  }, [id, active]);
  return url;
}

// ---- A : le lecteur ----
export function LecteurVocal({ url, duree: dureeConnue = 0, sortant = false }) {
  const audio = useRef(null);
  const zone = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(Number(dureeConnue) || 0);
  const [barres, setBarres] = useState(null);
  const [vitesse, setVitesse] = useState(0);

  // La forme du son et la VRAIE durée viennent du son décodé : un fichier
  // WebM ou Ogg dit parfois une durée « infinie » au lecteur du navigateur.
  useEffect(() => {
    let fini = false;
    const Ctx = typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!url || !Ctx) return undefined;
    (async () => {
      let ctx;
      try {
        const octets = await (await fetch(url)).arrayBuffer();
        ctx = new Ctx();
        const son = await ctx.decodeAudioData(octets);
        if (fini) return;
        setBarres(barresDuSon(son.getChannelData(0)));
        if (son.duration > 0 && Number.isFinite(son.duration)) setDuree(son.duration);
      } catch { /* son illisible ici : barres plates, le lecteur marche quand même */ }
      finally { try { ctx && ctx.close(); } catch { /* déjà fermé */ } }
    })();
    return () => { fini = true; };
  }, [url]);

  // Le curseur avance en douceur pendant la lecture.
  useEffect(() => {
    if (!lecture) return undefined;
    let id;
    const tic = () => { if (audio.current) setPosition(audio.current.currentTime); id = requestAnimationFrame(tic); };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, [lecture]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = VITESSES[vitesse]; }, [vitesse]);

  const basculer = async () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      a.playbackRate = VITESSES[vitesse];
      try { await a.play(); setLecture(true); } catch { setLecture(false); }
    } else { a.pause(); setLecture(false); }
  };

  const fraction = (clientX) => {
    const r = zone.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const aller = (clientX) => {
    const a = audio.current;
    const d = duree || (Number.isFinite(a?.duration) ? a.duration : 0);
    if (!a || !d) return;
    const t = fraction(clientX) * d;
    a.currentTime = t;
    setPosition(t);
  };

  const total = duree || 0;
  const avance = total ? Math.min(1, position / total) : 0;
  const liste = barres || Array.from({ length: NB_BARRES }, () => 0.3);
  const joue = sortant ? "#00a884" : "#0b8f6f";
  const reste = sortant ? "#a7c9bc" : "#c3ccd0";
  return (
    // ⚠ La flèche ▶ est alignée sur la LIGNE DES BARRES, pas sur tout le bloc
    // (capture Timo, 20/10/2026 : centrée sur barres + temps, elle tombait
    // plus bas que le son). Même hauteur que les barres (h-7), en haut.
    <div data-lecteur-vocal className="flex items-start gap-2 w-[260px] max-w-full py-1 select-none">
      <audio ref={audio} src={url} preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (!duree && d > 0 && Number.isFinite(d)) setDuree(d); }}
        onEnded={() => { setLecture(false); setPosition(0); if (audio.current) audio.current.currentTime = 0; }}
        onPause={() => setLecture(false)} />
      <button type="button" onClick={basculer} data-vocal-lire={lecture ? "pause" : "lire"}
        aria-label={lecture ? "Mettre en pause" : "Écouter"} title={lecture ? "Pause" : "Écouter"}
        className="w-9 h-7 shrink-0 flex items-center justify-center text-[#54656f]">
        {lecture
          ? <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></svg>
          : <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M8 5.2v13.6a.8.8 0 0 0 1.22.68l10.4-6.8a.8.8 0 0 0 0-1.36L9.22 4.52A.8.8 0 0 0 8 5.2z" /></svg>}
      </button>
      <div className="flex-1 min-w-0">
        <div ref={zone} data-vocal-barres className="relative h-7 flex items-center gap-[2px] cursor-pointer touch-none"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); aller(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons) aller(e.clientX); }}>
          {liste.map((h, i) => {
            const fait = (i + 0.5) / liste.length <= avance;
            return <span key={i} data-vocal-barre data-joue={fait ? "1" : "0"} className="flex-1 rounded-full" style={{ height: `${Math.round(h * 100)}%`, minHeight: 3, background: fait ? joue : reste }} />;
          })}
          <span data-vocal-curseur className="absolute w-3 h-3 rounded-full -translate-x-1/2 pointer-events-none" style={{ left: `${avance * 100}%`, background: joue }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5">
          <span data-vocal-temps>{dureeVocale(lecture || position > 0 ? position : total)}</span>
          <button type="button" data-vocal-vitesse onClick={() => setVitesse((v) => (v + 1) % VITESSES.length)}
            title="Vitesse de lecture" className="px-1.5 rounded-full bg-black/10 font-bold text-[10px] text-slate-700">{libelleVitesse(VITESSES[vitesse])}</button>
        </div>
      </div>
      <span className="w-9 h-9 shrink-0 self-center rounded-full bg-[#dfe5e7] flex items-center justify-center text-[#54656f]" aria-hidden>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z" /></svg>
      </span>
    </div>
  );
}

// ---- B : le micro qu'on garde appuyé ----
// Relâcher = envoyer ; glisser vers la gauche = annuler ; un simple toucher
// = l'explication. Pendant l'enregistrement, une bande rouge couvre la case.
export const SEUIL_ANNULER_PX = 80;
export const DUREE_MIN_VOCAL = 0.8;
export const AIDE_MICRO = "Gardez le micro appuyé pour enregistrer, relâchez pour envoyer. Glissez vers la gauche pour annuler.";

export function BoutonMicro({ onEnvoyer, onRefus, desactive = false }) {
  const enreg = useRef(null);
  const depart = useRef(0);
  const relache = useRef(false);
  const [etat, setEtat] = useState(""); // "", "ouverture", "enregistre"
  const [ecoule, setEcoule] = useState(0);
  const [glisse, setGlisse] = useState(0);

  useEffect(() => {
    if (etat !== "enregistre") return undefined;
    const id = setInterval(() => {
      const s = (Date.now() - (enreg.current?.debut || Date.now())) / 1000;
      setEcoule(s);
      if (s >= DUREE_MAX_VOCAL) finir(false);
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etat]);

  // Une conversation qu'on quitte en enregistrant : le micro s'éteint.
  useEffect(() => () => { enreg.current?.annuler(); }, []);

  const remettre = () => { enreg.current = null; setEtat(""); setEcoule(0); setGlisse(0); };

  const commencer = async (e) => {
    if (desactive || etat) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    depart.current = e.clientX;
    relache.current = false;
    setEtat("ouverture");
    const r = await demarrerEnregistrement();
    if (r.motif) { remettre(); onRefus && onRefus(r.motif); return; }
    enreg.current = r;
    // Le doigt est déjà levé (la question du navigateur « autoriser le
    // micro ? » l'a fait lever) : on n'enregistre pas en cachette.
    if (relache.current) { r.annuler(); remettre(); onRefus && onRefus(`Micro prêt. ${AIDE_MICRO}`); return; }
    setEtat("enregistre");
  };

  async function finir(annule) {
    const r = enreg.current;
    if (!r) return;
    const s = (Date.now() - r.debut) / 1000;
    if (annule) { r.annuler(); remettre(); return; }
    if (s < DUREE_MIN_VOCAL) { r.annuler(); remettre(); onRefus && onRefus(AIDE_MICRO); return; }
    enreg.current = null;
    setEtat("preparation");
    try {
      const son = await r.arreter();
      const f = await fichierVocal(son);
      remettre();
      if (f.motif) { onRefus && onRefus(f.motif); return; }
      onEnvoyer(f);
    } catch { remettre(); onRefus && onRefus("Le message vocal n'a pas pu être préparé. Réessayez."); }
  }

  const lever = () => {
    relache.current = true;
    if (etat === "enregistre") finir(glisse >= SEUIL_ANNULER_PX);
  };
  const bouger = (e) => {
    if (etat !== "enregistre") return;
    const d = Math.max(0, depart.current - e.clientX);
    setGlisse(d);
    if (d >= SEUIL_ANNULER_PX * 1.6) finir(true);
  };

  const actif = etat === "enregistre";
  return (
    <>
      {actif && (
        <div data-enregistrement-vocal className="absolute inset-y-0 left-0 right-12 flex items-center gap-3 rounded-full bg-white px-4 text-sm shadow-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
          <span data-vocal-chrono className="font-bold text-slate-800 tabular-nums">{dureeVocale(ecoule)}</span>
          <span className={`flex-1 text-right text-xs ${glisse >= SEUIL_ANNULER_PX ? "text-red-600 font-bold" : "text-slate-500"}`}>
            {glisse >= SEUIL_ANNULER_PX ? "Relâchez pour annuler" : "◀ Glissez pour annuler"}
          </span>
        </div>
      )}
      <button type="button" data-micro={etat || "pret"} disabled={desactive || etat === "preparation"}
        title={AIDE_MICRO} aria-label="Enregistrer un message vocal (garder appuyé)"
        onPointerDown={commencer} onPointerUp={lever} onPointerCancel={() => finir(true)} onPointerMove={bouger}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", transform: actif ? `translateX(-${Math.min(glisse, SEUIL_ANNULER_PX)}px) scale(1.25)` : undefined }}
        className={`w-10 h-10 shrink-0 rounded-full text-white flex items-center justify-center select-none disabled:opacity-50 ${actif ? "bg-red-600" : "bg-[#008069] hover:bg-[#006e5a]"}`}>
        {etat === "preparation" || etat === "ouverture"
          ? "⏳"
          : <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2z" /></svg>}
      </button>
    </>
  );
}
