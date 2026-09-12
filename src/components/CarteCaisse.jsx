// ============================================================
// components/CarteCaisse.jsx — UNE caisse lue : entrées, sorties, solde,
// mouvements. Écrite une fois, affichée trois fois dans le tableau de bord
// (Chez le DG, BANQUE, Chez le comptable — Timo, 12/09/2026 : « à l'intérieur
// les classer comme dans DG/Banque »). Le bilan vient de lib/caissesCentrales.js.
// ============================================================
import { fmt, dFR, today } from "../lib/core";
import { Panel, btnDark } from "./ui";
import { LOGO } from "../lib/constants";
import { exportCSV } from "../lib/export";
import { genererReleve } from "../pdf";

// `releve` (lib/caissesCentrales.js) : le relevé de la période choisie —
// solde au début, entrées et sorties de la période, solde à la fin, et les
// mouvements de la période seulement. `periode` : son libellé.
// `caisse` : le nom de la caisse (« Chez le DG »…), pour le PDF et le fichier.
export function CarteCaisse({ titre, caisse, note, releve: r, periode }) {
  const bilan = r;
  const depuisLeDebut = r.du <= "0000-01-01";
  // Timo (12/09/2026) : « pourquoi c'est impossible d'exporter pour
  // imprimer ? » — le relevé s'imprime (PDF, briques communes de pdf.js) et
  // s'exporte (CSV), tel qu'affiché : même période, mêmes chiffres.
  const imprimer = () => genererReleve(r, { caisse, periode, logo: LOGO, edite: dFR(today()) });
  const exporter = () => {
    const lignes = [...r.mouvements].sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((m) => [dFR(m.date), m.libelle, m.boutique, m.sens === "entree" ? m.montant : "", m.sens === "sortie" ? m.montant : ""]);
    exportCSV(`releve_${String(caisse || "caisse").toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      ["Date", "Mouvement", "Boutique", "Entrée", "Sortie"],
      [...lignes, ["", `Solde au début (${depuisLeDebut ? "début" : dFR(r.du)})`, "", r.soldeDebut, ""], ["", "Total de la période", "", r.entrees, r.sorties], ["", `Solde à la fin (${r.au >= "9999-12-31" ? "aujourd'hui" : dFR(r.au)})`, "", r.soldeFin, ""]],
      String(periode || "").replace(/\s+/g, "_"));
  };
  return (
    <Panel>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <div className="font-bold">{titre} <span className="text-sm font-semibold text-slate-500">— relevé : {periode}</span></div>
        <div className="flex gap-2">
          <button onClick={imprimer} className={btnDark}>🖨 Imprimer le relevé (PDF)</button>
          <button onClick={exporter} className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50">Exporter (CSV)</button>
        </div>
      </div>
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
