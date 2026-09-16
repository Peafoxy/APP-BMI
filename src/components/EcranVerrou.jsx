// ============================================================
// components/EcranVerrou.jsx — LA FENÊTRE « SESSION VERROUILLÉE »
//
// Posée sur toute l'application après un temps sans geste (lib/verrou.js),
// ou d'un clic sur « Verrouiller ». L'application reste montée derrière,
// FLOUTÉE par App.jsx : rien ne se relit par-dessus l'épaule, rien n'est
// perdu. Le mot de passe est celui du compte connecté, vérifié sur
// l'appareil (App.jsx → verifierMotDePasse) : ça marche sans internet.
//
// ⚠ Demande Timo (09/09/2026) : « juste les bulles et l'image de fond »
// de l'écran de connexion — pas sa carte (logo, bandeau). Le fond et les
// bulles sont LE MÊME code (decorAccueil / FondAccueil / Bulles,
// screens/Connexion.jsx) : tout réglage de ⚙ Paramètres → écran de
// connexion s'applique ici aussi, sans rien recopier.
// ============================================================
import { useState, useRef, useEffect } from "react";
import { inputCls } from "./ui";
import { decorAccueil, FondAccueil, Bulles } from "../screens/Connexion";
import { empreinteDisponible } from "../empreinte";

export function EcranVerrou({ profile, db, apparence, motif = "inactivite", onDeverrouiller, onDeconnecter, empreintePosee = false, empreinteOuvrable = false, onEmpreinte, onRetirerEmpreinte }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [visible, setVisible] = useState(false); // 👁 même œil que l'écran de connexion (capture Timo, 09/09/2026)
  const champ = useRef(null);
  const [diag, setDiag] = useState("");
  // ⚠ Timo (09/09/2026, Chrome sur PC) : « le curseur ne clignote pas, le
  // mot de passe ne s'écrit pas » — non reproduit ici. Deux filets :
  //   1. le champ reprend le focus à TOUT clic dans la fenêtre et à TOUTE
  //      touche frappée pendant que le focus est ailleurs (même si un
  //      élément inattendu s'interpose ou reprend le focus) ;
  //   2. si, malgré cela, le champ n'a pas le focus, une ligne de
  //      diagnostic nomme ce qui est au-dessus de lui, pour qu'une capture
  //      suffise à comprendre.
  const focaliser = () => { try { champ.current?.focus(); } catch { /* rien */ } };
  // Nom lisible d'un élément : balise, id, texte du bouton ou premières classes.
  const nomDe = (el) => {
    if (!el) return "aucun";
    const texte = el.tagName === "BUTTON" ? ` « ${String(el.textContent || "").trim().slice(0, 24)} »` : "";
    const cls = el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${texte}${cls}`;
  };
  const historique = useRef([]); // les derniers déplacements du focus, pour la capture
  const diagnostiquer = () => {
    const i = champ.current;
    if (!i || document.activeElement === i) { setDiag(""); return; }
    const r = i.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
    setDiag(`⚠ Le champ n'a pas le clavier — au-dessus : ${nomDe(el)} ; focus : ${nomDe(document.activeElement)} ; désactivé : ${i.disabled ? "oui" : "non"} ; visible : ${r.width > 0 ? "oui" : "non"} ; derniers focus : ${historique.current.slice(-4).join(" → ") || "aucun"}`);
  };
  useEffect(() => {
    focaliser();
    const t = setTimeout(diagnostiquer, 1500);
    const clavier = (e) => {
      if (document.activeElement !== champ.current && !e.ctrlKey && !e.metaKey && !e.altKey) { focaliser(); diagnostiquer(); }
    };
    const suivre = (e) => { historique.current.push(nomDe(e.target)); if (historique.current.length > 12) historique.current.shift(); };
    window.addEventListener("keydown", clavier, true);
    document.addEventListener("focusin", suivre, true);
    return () => { clearTimeout(t); window.removeEventListener("keydown", clavier, true); document.removeEventListener("focusin", suivre, true); };
  }, []);
  // ⚠ Capture Timo (09/09/2026 : « les bulles sont là mais pas de photo ») :
  // à la connexion, l'image se pose sur la CARTE sauf si « plein écran » est
  // coché. Ici il n'y a pas cette carte : dès qu'une image existe, elle
  // couvre tout le fond, quel que soit ce réglage.
  const decorBase = decorAccueil(db || { boutiques: [] }, apparence);
  const decor = { ...decorBase, pleinEcran: !!decorBase.accueilImage };

  // 👆 L'EMPREINTE (Timo, 16/09/2026). Elle n'ouvre que le verrou
  // d'inactivité : `empreinteOuvrable` porte cette règle, calculée une
  // seule fois dans lib/empreinte.js.
  // ⚠ On ne lance RIEN tout seul au montage : iPhone comme Chrome exigent
  // un geste de la personne pour ouvrir la fenêtre du capteur. D'où un
  // bouton, jamais un appel automatique.
  const [dispo, setDispo] = useState(false);
  const [activer, setActiver] = useState(false);
  const [occupeEmpreinte, setOccupeEmpreinte] = useState(false);
  useEffect(() => { let vivant = true; empreinteDisponible().then((d) => vivant && setDispo(!!d)); return () => { vivant = false; }; }, []);

  const parEmpreinte = async () => {
    if (occupeEmpreinte) return;
    setOccupeEmpreinte(true);
    let r = null;
    try { r = await onEmpreinte?.(); } catch { r = { ok: false }; } finally { setOccupeEmpreinte(false); }
    if (r?.ok) return;
    // ⚠ Un doigt non reconnu n'est PAS un mot de passe faux : aucun des 5
    // essais n'est consommé, on propose simplement l'autre porte.
    setErreur(r?.expiree
      ? "Session expirée : 30 minutes sans activité. Reconnectez-vous."
      : "Empreinte non reconnue — entrez votre mot de passe.");
    champ.current?.focus();
  };

  const valider = async (e) => {
    e?.preventDefault?.();
    if (occupe || !saisie) return;
    setOccupe(true);
    let r = null;
    // try/finally : quoi qu'il arrive, le champ redevient saisissable.
    // Sans cela, une vérification qui échoue laissait « occupe » à vrai et
    // le champ DÉSACTIVÉ pour toujours (« le mot de passe ne s'écrit pas »).
    try { r = await onDeverrouiller(saisie, { activerEmpreinte: activer }); } catch { r = { ok: false }; } finally { setOccupe(false); }
    if (r?.ok) return;
    setSaisie("");
    setErreur(r?.expiree
      // 30 min sans geste : la session était déjà finie, le mot de passe
      // n'y peut rien (Timo, 11/09/2026).
      ? "Session expirée : 30 minutes sans activité. Reconnectez-vous."
      : r?.fermer
      ? "Trop d'erreurs : la session est fermée."
      : `Mot de passe incorrect${r?.restantes !== undefined ? ` — ${r.restantes} essai${r.restantes > 1 ? "s" : ""} restant${r.restantes > 1 ? "s" : ""}` : ""}.`);
    champ.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Session verrouillée"
      onPointerDown={(e) => { if (e.target?.tagName !== "BUTTON" && e.target?.tagName !== "INPUT") focaliser(); }}
      onClick={() => setTimeout(diagnostiquer, 50)}>
      <FondAccueil decor={decor} className="min-h-full">
        {/* La couleur et la transparence de CETTE carte se règlent à part
            (⚙ Paramètres → 🔒 Fenêtre de verrouillage) ; une carte sombre
            passe son texte en clair. */}
        <form onSubmit={valider} className={`relative z-10 overflow-hidden rounded-2xl shadow-2xl w-full max-w-sm p-6 ${decor.verrouTranslucide ? "backdrop-blur-sm" : ""} ${decor.verrouTexteClair ? "text-white" : "text-slate-800"}`} style={{ backgroundColor: decor.verrouFond }}>
          {decor.bulles && <Bulles couleur={decor.couleurBulles} />}
          <div className="relative space-y-4">
            <div className="text-center">
              <div className="text-4xl">🔒</div>
              <div className="font-bold text-lg mt-1">Session verrouillée</div>
              <div className={`text-sm mt-1 ${decor.verrouTexteClair ? "text-white/80" : "text-slate-500"}`}>Compte : <b>{profile?.nom}</b></div>
              <div className={`text-xs mt-1 ${decor.verrouTexteClair ? "text-white/70" : "text-slate-400"}`}>
                {motif === "session"
                  ? "Votre session sécurisée a expiré : entrez le mot de passe pour la rétablir et reprendre."
                  : "Entrez le mot de passe et reprenez la session."}
              </div>
            </div>
            {/* 👆 Quand l'empreinte est posée sur CET appareil et que le
                verrou est celui de l'inactivité : un doigt suffit. Le champ
                du mot de passe reste EN DESSOUS, toujours — un capteur en
                panne, un doigt mouillé, un appareil neuf : il y a toujours
                une porte. */}
            {empreintePosee && empreinteOuvrable && dispo && (
              <button type="button" onClick={parEmpreinte} disabled={occupeEmpreinte}
                className="w-full px-4 py-3 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50 flex items-center justify-center gap-2">
                <span className="text-xl">👆</span> {occupeEmpreinte ? "Posez votre doigt…" : "Déverrouiller avec l'empreinte"}
              </button>
            )}
            <div className="relative">
              {/* ⚠ Capture Timo (09/09/2026) : carte SOMBRE → le texte de la
                  carte est blanc, et le champ (fond blanc) en héritait :
                  mot de passe et curseur blancs sur blanc, « le mot de passe
                  ne s'écrit pas ». Le champ impose son texte et son curseur
                  sombres, quelle que soit la couleur de la carte. */}
              <input ref={champ} type={visible ? "text" : "password"} autoComplete="current-password" className={`${inputCls} pr-10 text-slate-900 caret-slate-900 placeholder:text-slate-400`} placeholder="Mot de passe"
                value={saisie} onChange={(e) => { setSaisie(e.target.value); setErreur(""); }} disabled={occupe}
                onClick={focaliser} onTouchEnd={focaliser} />
              <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.preventDefault()} onClick={() => { setVisible((v) => !v); focaliser(); }} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600">
                {visible ? "🙈" : "👁"}
              </button>
            </div>
            {erreur && <div className={`text-sm font-semibold text-center ${decor.verrouTexteClair ? "text-red-300" : "text-red-700"}`}>{erreur}</div>}
            {diag && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 break-words">{diag}</div>}
            <button type="submit" disabled={occupe || !saisie} className="w-full px-4 py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50">
              🔓 Déverrouiller
            </button>
            {/* 👆 L'ACTIVATION se fait ICI, et nulle part ailleurs : le
                vendeur n'a même pas l'onglet ⚙ Paramètres, et c'est ce
                moment précis — celui où l'on tape son mot de passe pour la
                dixième fois — qui donne envie de l'activer. Le mot de passe
                qu'elle tape SERT de preuve : aucune question de plus.
                ⚠ Ce que l'application ne fait PAS, et qu'il faut savoir : elle
                ne lit aucune empreinte. Le téléphone compare tout seul et
                répond oui ou non ; on ne range qu'une clé, jamais un doigt. */}
            {!empreintePosee && empreinteOuvrable && dispo && (
              <label className={`flex items-start gap-2 text-xs cursor-pointer ${decor.verrouTexteClair ? "text-white/80" : "text-slate-600"}`}>
                <input type="checkbox" checked={activer} onChange={(e) => setActiver(e.target.checked)} className="mt-0.5" />
                <span>👆 <b>Activer l'empreinte sur cet appareil</b> — la prochaine fois, un doigt suffira. Votre empreinte reste dans le téléphone : l'application ne la voit jamais.</span>
              </label>
            )}
            {empreintePosee && (
              <button type="button" onClick={() => onRetirerEmpreinte?.()}
                className={`text-xs underline ${decor.verrouTexteClair ? "text-white/70 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}>
                Retirer l'empreinte de cet appareil
              </button>
            )}
            {/* Timo (12/09/2026, capture) : « le bouton Se déconnecter n'est pas
                pré-rempli, ce qui fait que pour certaines couleurs de fond il
                devient invisible… le pré-remplir avec un jaune pâle ou rouge pâle
                signifiant le petit danger » — fond rouge pâle, texte rouge sombre,
                quelle que soit la couleur de la carte. */}
            <button type="button" onClick={onDeconnecter} className="w-full px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-bold">
              Se déconnecter
            </button>
          </div>
        </form>
      </FondAccueil>
    </div>
  );
}
