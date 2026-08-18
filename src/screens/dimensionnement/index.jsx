// ============================================================
// screens/dimensionnement/index.jsx — Conteneur du dimensionnement : un onglet
// par DOMAINE, la liste venant des Paramètres. Point d'entrée du dossier.
// ============================================================
import { useState, useEffect } from "react";
import { fmt } from "../../lib/core";
import { domainesDefinis } from "../../lib/calculs";
import { DimensionnementSolaire } from "./Solaire";
import { DimensionnementGarage } from "./Garage";
import { DimensionnementAutre } from "./Autre";

// ⚠ Demande Timo (18/08/2026) : « dès qu'un domaine est créé dans les
// paramètres, il apparaît dans le dimensionnement — c'est mieux que d'écrire
// en dur solaire, garage, autre ». Les onglets sont donc construits à partir
// de la liste des domaines (⚙ Paramètres → Domaines de produits).
//
// Chaque domaine dit ce qu'il sait faire :
//   • "solaire" / "garage" — les calculs métier existants, inchangés ;
//   • "libre" — aucun calcul : les familles du domaine, les articles, le
//     devis. Personne ne peut inventer les règles de dimensionnement d'un
//     métier à partir de son seul nom.
export function Dimensionnement({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const domaines = domainesDefinis(db);
  const [mode, setMode] = useState(domaines[0]?.id || "solaire");
  // Un domaine supprimé depuis les Paramètres ne doit pas laisser l'écran vide.
  const actif = domaines.find((d) => d.id === mode) || domaines[0] || null;
  // Ces volets contiennent chacun de longs formulaires : basculer de l'un à
  // l'autre ne doit pas effacer ce qui n'est pas encore enregistré.
  const [visite, setVisite] = useState({ [domaines[0]?.id || "solaire"]: true });
  useEffect(() => { setVisite((v) => (v[mode] ? v : { ...v, [mode]: true })); }, [mode]);

  // Bascule automatiquement sur le bon outil dès qu'un devis à reprendre
  // arrive. Les anciens devis ne portent que « solaire / garage / autre » :
  // on continue de les relire, et on préfère le domaine quand il est là.
  const domaineDuDevis = (d) => {
    if (!d) return null;
    const t = d.type_devis;
    if (t === "garage") return "garage";
    if (t === "autre") return domaines.some((x) => x.id === d.domaine) ? d.domaine : "autre";
    return "solaire";
  };
  useEffect(() => {
    const cible = domaineDuDevis(devisAReprendre?.devis);
    if (cible) setMode(cible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisAReprendre]);

  // Le devis repris n'est transmis qu'au volet qui doit le reprendre.
  const pourCeDomaine = (id) => (domaineDuDevis(devisAReprendre?.devis) === id ? devisAReprendre : null);

  const rendre = (d) => {
    const commun = { db, profile, save, onConvertirEnVente,
      devisAReprendre: pourCeDomaine(d.id), onDevisRepriseConsomme };
    if (d.calcul === "solaire") return <DimensionnementSolaire {...commun} />;
    if (d.calcul === "garage") return <DimensionnementGarage {...commun} />;
    return <DimensionnementAutre {...commun} domaine={d} />;
  };

  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-white p-1 shadow-sm gap-1">
        {domaines.map((d) => (
          <button key={d.id} onClick={() => setMode(d.id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === d.id ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            {d.icone} {d.nom}
          </button>
        ))}
      </div>
      {domaines.length === 0 && (
        <div className="rounded-xl p-4 bg-amber-50 border-2 border-amber-300 text-sm text-amber-900">
          Aucun domaine n'est défini. Rendez-vous dans <b>⚙ Paramètres → Domaines de produits</b> pour en créer un.
        </div>
      )}
      {devisAReprendre && (
        <div className="rounded-xl p-3 bg-amber-50 border-2 border-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-amber-900">
            {devisAReprendre.depuis_vente ? (
              <b>📋 Devis créé depuis la vente {devisAReprendre.devis.vente_numero} — ajoutez ce qu'il faut, puis envoyez-le au client{devisAReprendre.client ? ` (${devisAReprendre.client.nom_base || devisAReprendre.client.nom})` : ""}.</b>
            ) : (
              <>
                <b>✏️ Reprise du devis de {devisAReprendre.client?.nom_base || devisAReprendre.client?.nom}</b> ({fmt(devisAReprendre.devis.total)})
                {devisAReprendre.devis.demande_modif && <span> — souhaite : « {devisAReprendre.devis.demande_modif} »</span>}
                {devisAReprendre.devis.motif_rejet && <span> — avait rejeté : « {devisAReprendre.devis.motif_rejet} »</span>}
              </>
            )}
          </div>
          <button onClick={onDevisRepriseConsomme} className="text-xs font-bold text-amber-700 underline whitespace-nowrap">Annuler la reprise</button>
        </div>
      )}
      {domaines.filter((d) => visite[d.id]).map((d) => (
        <div key={d.id} style={{ display: mode === d.id ? "block" : "none" }}>{rendre(d)}</div>
      ))}
    </div>
  );
}

// Réexport : TYPES_PORTAIL est consommé par TousLesDevis, EspaceClient et App.
export { TYPES_PORTAIL } from "./Garage";
