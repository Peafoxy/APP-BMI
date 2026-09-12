// ============================================================
// components/CarteCaisse.jsx — UNE caisse lue : entrées, sorties, solde,
// mouvements. Écrite une fois, affichée trois fois dans le tableau de bord
// (Chez le DG, BANQUE, Chez le comptable — Timo, 12/09/2026 : « à l'intérieur
// les classer comme dans DG/Banque »). Le bilan vient de lib/caissesCentrales.js.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Panel } from "./ui";

// `releve` (lib/caissesCentrales.js) : le relevé de la période choisie —
// solde au début, entrées et sorties de la période, solde à la fin, et les
// mouvements de la période seulement. `periode` : son libellé.
export function CarteCaisse({ titre, note, releve: r, periode }) {
  const bilan = r;
  const depuisLeDebut = r.du <= "0000-01-01";
  return (
    <Panel>
      <div className="font-bold mb-1">{titre} <span className="text-sm font-semibold text-slate-500">— relevé : {periode}</span></div>
      <div className="text-xs text-slate-500 mb-3">{note}</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Solde au début{depuisLeDebut ? "" : ` (${dFR(r.du)})`}</div><div className={`font-bold tabular-nums ${r.soldeDebut < 0 ? "text-red-600" : ""}`}>{fmt(r.soldeDebut)}</div></div>
        <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">+ Entrées de la période</div><div className="font-bold tabular-nums text-emerald-700">+ {fmt(r.entrees)}</div></div>
        <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">− Sorties de la période</div><div className="font-bold tabular-nums">− {fmt(r.sorties)}</div></div>
        <div className="bg-white rounded-lg p-3 border-2 border-slate-300"><div className="text-xs text-slate-500">Solde à la fin{r.au >= "9999-12-31" ? "" : ` (${dFR(r.au)})`}</div><div className={`font-bold tabular-nums text-lg ${r.soldeFin < 0 ? "text-red-600" : ""}`}>{fmt(r.soldeFin)}</div></div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-3 py-1.5">Date</th><th className="text-left px-3 py-1.5">Mouvement</th><th className="text-left px-3 py-1.5">Boutique</th><th className="text-right px-3 py-1.5">Montant</th></tr></thead>
          <tbody>
            {bilan.mouvements.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Aucun mouvement sur cette période.</td></tr>}
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
