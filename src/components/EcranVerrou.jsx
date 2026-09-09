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

export function EcranVerrou({ profile, db, apparence, motif = "inactivite", onDeverrouiller, onDeconnecter }) {
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
  const diagnostiquer = () => {
    const i = champ.current;
    if (!i || document.activeElement === i) { setDiag(""); return; }
    const r = i.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
    const nom = el ? `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ").slice(0, 3).join(".") : ""}` : "rien";
    const actif = document.activeElement ? `${document.activeElement.tagName.toLowerCase()}${document.activeElement.id ? "#" + document.activeElement.id : ""}` : "aucun";
    setDiag(`⚠ Le champ n'a pas le clavier — au-dessus : ${nom} ; focus : ${actif} ; désactivé : ${i.disabled ? "oui" : "non"} ; visible : ${r.width > 0 ? "oui" : "non"}`);
  };
  useEffect(() => {
    focaliser();
    const t = setTimeout(diagnostiquer, 1500);
    const clavier = (e) => {
      if (document.activeElement !== champ.current && !e.ctrlKey && !e.metaKey && !e.altKey) { focaliser(); diagnostiquer(); }
    };
    window.addEventListener("keydown", clavier, true);
    return () => { clearTimeout(t); window.removeEventListener("keydown", clavier, true); };
  }, []);
  // ⚠ Capture Timo (09/09/2026 : « les bulles sont là mais pas de photo ») :
  // à la connexion, l'image se pose sur la CARTE sauf si « plein écran » est
  // coché. Ici il n'y a pas cette carte : dès qu'une image existe, elle
  // couvre tout le fond, quel que soit ce réglage.
  const decorBase = decorAccueil(db || { boutiques: [] }, apparence);
  const decor = { ...decorBase, pleinEcran: !!decorBase.accueilImage };

  const valider = async (e) => {
    e?.preventDefault?.();
    if (occupe || !saisie) return;
    setOccupe(true);
    let r = null;
    // try/finally : quoi qu'il arrive, le champ redevient saisissable.
    // Sans cela, une vérification qui échoue laissait « occupe » à vrai et
    // le champ DÉSACTIVÉ pour toujours (« le mot de passe ne s'écrit pas »).
    try { r = await onDeverrouiller(saisie); } catch { r = { ok: false }; } finally { setOccupe(false); }
    if (r?.ok) return;
    setSaisie("");
    setErreur(r?.fermer
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
            <div className="relative">
              <input ref={champ} type={visible ? "text" : "password"} autoComplete="current-password" className={`${inputCls} pr-10`} placeholder="Mot de passe"
                value={saisie} onChange={(e) => { setSaisie(e.target.value); setErreur(""); }} disabled={occupe} />
              <button type="button" tabIndex={-1} onClick={() => setVisible((v) => !v)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600">
                {visible ? "🙈" : "👁"}
              </button>
            </div>
            {erreur && <div className={`text-sm font-semibold text-center ${decor.verrouTexteClair ? "text-red-300" : "text-red-700"}`}>{erreur}</div>}
            {diag && <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 break-words">{diag}</div>}
            <button type="submit" disabled={occupe || !saisie} className="w-full px-4 py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50">
              🔓 Déverrouiller
            </button>
            <button type="button" onClick={onDeconnecter} className={`w-full px-4 py-2 rounded-lg border text-xs font-bold ${decor.verrouTexteClair ? "border-white/40 text-white hover:bg-white/10" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              Se déconnecter
            </button>
          </div>
        </form>
      </FondAccueil>
    </div>
  );
}
