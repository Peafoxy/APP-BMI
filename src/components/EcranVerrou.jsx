// ============================================================
// components/EcranVerrou.jsx — LA FENÊTRE « SESSION VERROUILLÉE »
//
// Posée sur toute l'application après un temps sans geste (lib/verrou.js).
// L'application reste montée derrière, FLOUTÉE par App.jsx (le voile ici
// ajoute son propre flou) : rien ne se relit par-dessus l'épaule, rien
// n'est perdu. Le mot de passe est celui du compte connecté, vérifié sur
// l'appareil (App.jsx → verifierMotDePasse) : ça marche sans internet.
// ============================================================
import { useState, useRef, useEffect } from "react";
import { inputCls } from "./ui";

export function EcranVerrou({ profile, onDeverrouiller, onDeconnecter }) {
  const [saisie, setSaisie] = useState("");
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const champ = useRef(null);
  useEffect(() => { champ.current?.focus(); }, []);

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
    <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Session verrouillée">
      <form onSubmit={valider} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <div className="text-4xl">🔒</div>
          <div className="font-bold text-slate-800 text-lg mt-1">Session verrouillée</div>
          <div className="text-sm text-slate-500 mt-1">Compte : <b className="text-slate-700">{profile?.nom}</b></div>
          <div className="text-xs text-slate-400 mt-1">Entrez le mot de passe et reprenez la session.</div>
        </div>
        <input ref={champ} type="password" autoComplete="current-password" className={inputCls} placeholder="Mot de passe"
          value={saisie} onChange={(e) => { setSaisie(e.target.value); setErreur(""); }} disabled={occupe} />
        {erreur && <div className="text-sm font-semibold text-red-700 text-center">{erreur}</div>}
        <button type="submit" disabled={occupe || !saisie} className="w-full px-4 py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-50">
          🔓 Déverrouiller
        </button>
        <button type="button" onClick={onDeconnecter} className="w-full px-4 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
