// ============================================================
// components/SelecteurBoutique.jsx — Sélecteur de boutique par
// onglets colorés (une pastille par boutique, dépôts optionnels).
// ============================================================
import { boutiquesVente } from "../lib/calculs";

// ============ SÉLECTEUR BOUTIQUE ============
export function BoutiqueTabs({ db, value, onChange, avecDepots = false }) {
  const liste = avecDepots ? db.boutiques : boutiquesVente(db);
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {liste.map((b) => (
        <button key={b.nom} onClick={() => onChange(b.nom)}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${value === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
          style={value === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : ""}{b.nom}</button>
      ))}
    </div>
  );
}
