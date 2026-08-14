// ============================================================
// components/SelecteurBoutique.jsx — Sélecteur de boutique par
// onglets colorés (une pastille par boutique, dépôts optionnels).
// ============================================================
import { boutiquesVente } from "../lib/calculs";

// ============ SÉLECTEUR BOUTIQUE ============
export function BoutiqueTabs({ db, value, onChange, avecDepots = false, avecTerrain = false }) {
  // ⚠ Bug trouvé par Timo (capture Stocks) : avecDepots utilisait db.boutiques
  // SANS filtrer TERRAIN — la boutique virtuelle apparaissait donc dans
  // Stocks (et partout ailleurs utilisant avecDepots), alors qu'elle ne
  // détient jamais de stock physique. TERRAIN ne doit apparaître QUE là où
  // avecTerrain est explicitement demandé (Caisse), jamais via avecDepots.
  const base = avecDepots ? (db.boutiques || []).filter((b) => !b.terrain) : boutiquesVente(db);
  const terrain = avecTerrain && !avecDepots ? (db.boutiques || []).filter((b) => b.terrain) : [];
  const liste = [...base, ...terrain];
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {liste.map((b) => (
        <button key={b.nom} onClick={() => onChange(b.nom)}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${value === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
          style={value === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : b.terrain ? "🚐 " : ""}{b.nom}</button>
      ))}
    </div>
  );
}
