// ============================================================
// components/EcranVerrou.jsx — LA FENÊTRE « SESSION VERROUILLÉE »
//
// Posée sur toute l'application après un temps sans geste (lib/verrou.js),
// ou d'un clic sur « Verrouiller ». L'application reste montée derrière,
// FLOUTÉE par App.jsx : rien ne se relit par-dessus l'épaule, rien n'est
// perdu. Le mot de passe est celui du compte connecté, vérifié sur
// l'appareil (App.jsx → verifierMotDePasse) : ça marche sans internet.
//
// ⚠ Demande Timo (09/09/2026) : « le même fond, photo, bulles » que
// l'écran de connexion. Le décor est LE MÊME code (decorAccueil /
// CarteAccueil, screens/Connexion.jsx) : tout réglage de ⚙ Paramètres →
// écran de connexion s'applique ici aussi, sans rien recopier.
// ============================================================
import { useState, useRef, useEffect } from "react";
import { inputCls } from "./ui";
import { decorAccueil, CarteAccueil } from "../screens/Connexion";

export function EcranVerrou({ profile, db, apparence, onDeverrouiller, onDeconnecter }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [visible, setVisible] = useState(false); // 👁 même œil que l'écran de connexion (capture Timo, 09/09/2026)
  const champ = useRef(null);
  useEffect(() => { champ.current?.focus(); }, []);
  const decor = decorAccueil(db || { boutiques: [] }, apparence);

  const valider = async (e) => {
    e?.preventDefault?.();
    if (occupe || !saisie) return;
    setOccupe(true);
    const r = await onDeverrouiller(saisie);
    setOccupe(false);
    if (r?.ok) return;
    setSaisie("");
    setErreur(r?.fermer
      ? "Trop d'erreurs : la session est fermée."
      : `Mot de passe incorrect${r?.restantes !== undefined ? ` — ${r.restantes} essai${r.restantes > 1 ? "s" : ""} restant${r.restantes > 1 ? "s" : ""}` : ""}.`);
    champ.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Session verrouillée">
      <CarteAccueil decor={decor} className="min-h-full" sousTitre={`🔒 Session verrouillée — compte ${profile?.nom || ""}`}>
        <form onSubmit={valider} className="space-y-3">
          <div className="text-xs text-slate-500 text-center">Entrez le mot de passe et reprenez la session.</div>
          <div className="relative">
            <input ref={champ} type={visible ? "text" : "password"} autoComplete="current-password" className={`${inputCls} pr-10`} placeholder="Mot de passe"
              value={saisie} onChange={(e) => { setSaisie(e.target.value); setErreur(""); }} disabled={occupe} />
            <button type="button" tabIndex={-1} onClick={() => setVisible((v) => !v)} aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} title={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-slate-600">
              {visible ? "🙈" : "👁"}
            </button>
          </div>
          {erreur && <div className="text-xs font-semibold text-red-700 text-center">{erreur}</div>}
          <button type="submit" disabled={occupe || !saisie} className="w-full py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50">
            🔓 Déverrouiller
          </button>
          <button type="button" onClick={onDeconnecter} className="w-full py-2 rounded-lg border border-slate-300 bg-white/70 text-slate-600 text-xs font-bold hover:bg-white">
            Se déconnecter
          </button>
        </form>
      </CarteAccueil>
    </div>
  );
}
