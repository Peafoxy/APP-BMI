// ============================================================
// screens/CaissesDG.jsx — 🏦 Chez le DG / BANQUE
//
// Timo (12/09/2026) : « DG et banque sur le même modèle que le comptable ».
// Deux caisses LUES dans ce qui existe (lib/caissesDG.js) : ce qui y est
// entré (versements validés), ce qui en est sorti (dépenses payées avec
// l'argent du DG, avances remboursées par lui ; virements bancaires), et le
// solde. Administrateur PRINCIPAL seul, sur l'espace regardé.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Panel } from "../components/ui";
import { boutiquesVisibles, estAdminPrincipal } from "../lib/calculs";
import { mouvementsDG, mouvementsBanque, CAISSE_DG, CAISSE_BANQUE } from "../lib/caissesDG";

function CarteCaisse({ titre, note, bilan }) {
  return (
    <Panel>
      <div className="font-bold mb-1">{titre}</div>
      <div className="text-xs text-slate-500 mb-3">{note}</div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Entrées (versements validés)</div><div className="font-bold tabular-nums text-emerald-700">+ {fmt(bilan.totalEntrees)}</div></div>
        <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Sorties</div><div className="font-bold tabular-nums">− {fmt(bilan.totalSorties)}</div></div>
        <div className="bg-white rounded-lg p-3 border-2 border-slate-300"><div className="text-xs text-slate-500">Solde</div><div className={`font-bold tabular-nums text-lg ${bilan.solde < 0 ? "text-red-600" : ""}`}>{fmt(bilan.solde)}</div></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-3 py-1.5">Mouvement</th><th className="text-left px-3 py-1.5">Boutique</th><th className="text-right px-3 py-1.5">Montant</th></tr></thead>
          <tbody>
            {bilan.mouvements.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Aucun mouvement pour l'instant.</td></tr>}
            {bilan.mouvements.slice(0, 100).map((m) => (
              <tr key={m.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5">{dFR(m.date)}</td>
                <td className="px-3 py-1.5">{m.sens === "entree" ? <span className="text-xs font-bold text-emerald-700 mr-1">ENTRÉE</span> : <span className="text-xs font-bold text-red-700 mr-1">SORTIE</span>}{m.libelle}</td>
                <td className="px-3 py-1.5">{m.boutique}</td>
                <td className={`px-3 py-1.5 tabular-nums font-bold text-right ${m.sens === "entree" ? "text-emerald-700" : ""}`}>{m.sens === "entree" ? "+" : "−"} {fmt(m.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function CaissesDG({ db, profile }) {
  if (!estAdminPrincipal(db, profile)) return <div className="text-sm text-slate-500">Réservé à l'administrateur principal.</div>;
  // Cloisonnement : les boutiques de l'espace regardé seulement.
  const noms = boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom);
  const dg = mouvementsDG(db, noms);
  const banque = mouvementsBanque(db, noms);
  return (
    <div className="space-y-4">
      <CarteCaisse titre={`👤 ${CAISSE_DG}`} bilan={dg}
        note="Entre : les versements « Chez le DG » que vous avez validés. Sort : les dépenses payées avec de l'argent que vous avez remis (une fois qu'elles comptent), et les avances de frais que vous avez remboursées vous-même. Les dépenses restent des charges de leur boutique." />
      <CarteCaisse titre={`🏦 ${CAISSE_BANQUE}`} bilan={banque}
        note="Entre : les versements « BANQUE » validés (banque et bordereau). Sort : les dépenses payées par virement bancaire (salaires virés, fournisseurs, CNSS…). Les dépenses restent des charges de leur boutique." />
      <div className="text-xs text-slate-500">Un versement en attente ou rejeté n'apparaît pas ici : voyez 🔒 Caisse. Une dépense en attente de validation non plus.</div>
    </div>
  );
}
