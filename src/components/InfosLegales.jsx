// ⚖️ La fenêtre « Informations légales et confidentialité » (14/11/2026) —
// les mots vivent dans lib/infosLegales.js. `LienInfosLegales` est le lien
// qu'on pose sur un écran (connexion, 🔒 Mes données) : il ouvre la fenêtre
// par-dessus, la touche retour d'Android la referme.
import { useState } from "react";
import { createPortal } from "react-dom";
import { TITRE_INFOS_LEGALES, DATE_INFOS_LEGALES, sectionsLegales } from "../lib/infosLegales";
import { useRetour } from "../retour";

export function InfosLegales({ duree, onFermer }) {
  useRetour(true, onFermer);
  return (
    <div data-infos-legales className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-3" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="font-bold text-slate-800">⚖️ {TITRE_INFOS_LEGALES}</div>
          <button onClick={onFermer} className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-bold hover:bg-slate-50">Fermer</button>
        </div>
        <div data-infos-legales-contenu className="px-4 py-3 overflow-y-auto text-sm text-slate-700 space-y-4">
          {sectionsLegales({ duree }).map((s) => (
            <section key={s.titre}>
              <h3 className="font-bold text-slate-900 mb-1">{s.titre}</h3>
              <div className="space-y-1.5">{s.lignes.map((l, i) => <p key={i}>{l}</p>)}</div>
            </section>
          ))}
          <p className="text-xs text-slate-500">Mise à jour : {DATE_INFOS_LEGALES}.</p>
        </div>
      </div>
    </div>
  );
}

export function LienInfosLegales({ duree, className = "" }) {
  const [ouvert, setOuvert] = useState(false);
  return (<>
    <button type="button" data-lien-infos-legales onClick={() => setOuvert(true)} className={`underline ${className}`}>
      ⚖️ Informations légales et confidentialité
    </button>
    {/* ⚠ Posée sur la PAGE (portail), jamais dans le cadre du lien : la carte
        de l'écran de connexion est floutée, et une fenêtre `fixed` y resterait
        enfermée. */}
    {ouvert && (typeof document !== "undefined"
      ? createPortal(<InfosLegales duree={duree} onFermer={() => setOuvert(false)} />, document.body)
      : <InfosLegales duree={duree} onFermer={() => setOuvert(false)} />)}
  </>);
}
