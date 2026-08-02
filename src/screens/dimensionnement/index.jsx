// ============================================================
// screens/dimensionnement/index.jsx — Conteneur du dimensionnement : les trois volets (Solaire, Garage,
// Autre) derrière des onglets. Point d'entrée du dossier.
// ============================================================
import { useState, useEffect } from "react";
import { fmt } from "../../lib/core";
import { DimensionnementSolaire } from "./Solaire";
import { DimensionnementGarage } from "./Garage";
import { DimensionnementAutre } from "./Autre";

// ============ SÉLECTEUR : Dimensionnement Solaire, Garage ou Autre ============
// Point d'entrée affiché dans l'onglet « Dimensionnement ». Un simple aiguillage
// entre les trois outils, qui partagent la même mécanique (besoins du
// client → équipements proposés depuis le stock → devis → envoi WhatsApp / vente).
export function Dimensionnement({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const [mode, setMode] = useState("solaire");
  // Même logique que pour l'onglet Dimensionnement lui-même dans App.jsx :
  // ces 3 volets contiennent chacun de longs formulaires — basculer de l'un
  // à l'autre ne doit plus effacer ce qui n'est pas encore enregistré.
  const [visite, setVisite] = useState({ solaire: true });
  useEffect(() => { setVisite((v) => (v[mode] ? v : { ...v, [mode]: true })); }, [mode]);
  // Bascule automatiquement sur le bon outil dès qu'un devis à reprendre arrive.
  useEffect(() => {
    if (devisAReprendre) setMode(devisAReprendre.devis.type_devis === "garage" ? "garage" : devisAReprendre.devis.type_devis === "autre" ? "autre" : "solaire");
  }, [devisAReprendre]);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
        <button onClick={() => setMode("solaire")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "solaire" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>☀️ Solaire</button>
        <button onClick={() => setMode("garage")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "garage" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>🚪 Garage</button>
        <button onClick={() => setMode("autre")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "autre" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>📦 Autre</button>
      </div>
      {devisAReprendre && (
        <div className="rounded-xl p-3 bg-amber-50 border-2 border-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-amber-900">
            <b>✏️ Reprise du devis de {devisAReprendre.client?.nom_base || devisAReprendre.client?.nom}</b> ({fmt(devisAReprendre.devis.total)})
            {devisAReprendre.devis.demande_modif && <span> — souhaite : « {devisAReprendre.devis.demande_modif} »</span>}
            {devisAReprendre.devis.motif_rejet && <span> — avait rejeté : « {devisAReprendre.devis.motif_rejet} »</span>}
          </div>
          <button onClick={onDevisRepriseConsomme} className="text-xs font-bold text-amber-700 underline whitespace-nowrap">Annuler la reprise</button>
        </div>
      )}
      {visite.solaire && (
        <div style={{ display: mode === "solaire" ? "block" : "none" }}>
          <DimensionnementSolaire db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis !== "garage" && devisAReprendre?.devis?.type_devis !== "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />
        </div>
      )}
      {visite.garage && (
        <div style={{ display: mode === "garage" ? "block" : "none" }}>
          <DimensionnementGarage db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "garage" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />
        </div>
      )}
      {visite.autre && (
        <div style={{ display: mode === "autre" ? "block" : "none" }}>
          <DimensionnementAutre db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />
        </div>
      )}
    </div>
  );
}

// Réexport : TYPES_PORTAIL est consommé par TousLesDevis, EspaceClient et App.
export { TYPES_PORTAIL } from "./Garage";
