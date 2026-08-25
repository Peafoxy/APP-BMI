// ============================================================
// components/SelecteurBoutique.jsx — Sélecteur de boutique par
// onglets colorés (une pastille par boutique, dépôts optionnels).
// ============================================================
import { boutiquesVente, boutiquesVisibles, memoriserBoutique } from "../lib/calculs";

// ============ SÉLECTEUR BOUTIQUE ============
export function BoutiqueTabs({ db, value, onChange, avecDepots = false, avecTerrain = false, profile }) {
  // ⚠ Bug trouvé par Timo (capture Stocks) : avecDepots utilisait db.boutiques
  // SANS filtrer TERRAIN — la boutique virtuelle apparaissait donc dans
  // Stocks (et partout ailleurs utilisant avecDepots), alors qu'elle ne
  // détient jamais de stock physique. TERRAIN ne doit apparaître QUE là où
  // avecTerrain est explicitement demandé (Caisse), jamais via avecDepots.
  const base = avecDepots ? (db.boutiques || []).filter((b) => !b.terrain) : boutiquesVente(db);
  const terrain = avecTerrain && !avecDepots ? (db.boutiques || []).filter((b) => b.terrain) : [];
  // ⚠ Séparation formation/réel PAR COMPTE (demande Timo) : appliquée ici,
  // au même endroit central que le tri dépôts/terrain.
  // `profile` est OBLIGATOIRE : il était optionnel, avec un repli « tout
  // visible » — et trois écrans de dimensionnement ne le passaient pas,
  // affichant donc les vraies boutiques à un compte de formation. Un repli
  // silencieux dans un mécanisme de cloisonnement est une brèche par
  // construction : mieux vaut ne rien afficher et que le manque se voie.
  const liste = boutiquesVisibles(db, profile, [...base, ...terrain]);
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {liste.map((b) => (
        // ⚠ Le clic est le SEUL geste qui mémorise (demande Timo : ne plus
        // changer de boutique après un rechargement). On ne mémorise jamais
        // au simple affichage : sinon un écran dont la liste autorisée
        // diffère écraserait le choix de l'utilisateur sans qu'il ait rien
        // demandé.
        <button key={b.nom} onClick={() => { memoriserBoutique(profile, b.nom); onChange(b.nom); }}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${value === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
          style={value === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : b.terrain ? "🚐 " : ""}{b.nom}</button>
      ))}
    </div>
  );
}
