// ============================================================
// components/AchatsChantier.jsx — 🏗 la case « Chantier » de 💰 Ventes et la
// liste des achats pour les chantiers (Timo, 11/10/2026, étape 2 de la caisse
// CHANTIER). Les règles : lib/achatsChantier.js ; le geste vit dans Ventes.jsx.
// ============================================================
import { fmt, dFR } from "../lib/core";
import { Field, inputCls, enTeteFige, celluleFigee, fondLigneDepliable, BoutonRond, CelluleActions } from "./ui";
import {
  nomChantier, argentDuChantier, avertissementMateriel, achatsDe, totalAchat, resumeAchat,
  venteDuChantier, detteDuChantier, PAIEMENT_CHANTIER,
} from "../lib/achatsChantier";

// La case, le choix du chantier (G) et l'argent du chantier.
export function CaseAchatChantier({ actif, onActif, chantiers, chantierId, onChantier, chantier, ventes, dettes, totalPanier }) {
  const argent = chantier ? argentDuChantier({ chantier, vente: venteDuChantier(chantier, ventes), dette: detteDuChantier(chantier, dettes) }) : null;
  const apres = argent ? argent.achete + totalPanier : 0;
  const enAttente = argent ? Math.max(0, apres - argent.paye) : 0;
  const alerte = argent ? avertissementMateriel(argent, totalPanier) : "";
  return (
    <div className={`mt-4 rounded-lg border-2 p-3 ${actif ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`} data-case-achat-chantier>
      <label className="flex items-start gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={actif} onChange={(e) => onActif(e.target.checked)} data-coche-chantier />
        <span>🏗 <b>Chantier</b> — le matériel part pour un chantier (payé par l'argent du chantier)</span>
      </label>
      {actif && (
        chantiers.length === 0 ? (
          <div className="mt-2 text-sm text-slate-600" data-aucun-chantier-achat>
            Aucun chantier n'attend de matériel : seuls les chantiers nés d'un devis « 🔧 Avec installation », pas encore réceptionnés, apparaissent ici.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <Field label="Pour quel chantier ?">
              <select className={inputCls} value={chantierId} onChange={(e) => onChantier(e.target.value)} data-choix-chantier-achat>
                <option value="">— Choisir le chantier —</option>
                {chantiers.map((c) => <option key={c.id} value={c.id}>{nomChantier(c)}{c.localisation ? ` — ${c.localisation}` : ""}</option>)}
              </select>
            </Field>
            {argent && (
              <div className="text-sm text-slate-700 space-y-0.5" data-argent-chantier>
                <div>Payé par le client pour son devis : <b>{fmt(argent.paye)}</b> · part matériel du devis : {fmt(argent.materiel)}</div>
                <div>Déjà acheté pour ce chantier : {fmt(argent.achete)}{argent.enAttente > 0 && <span className="text-amber-700 font-semibold"> (dont {fmt(argent.enAttente)} en attente)</span>}</div>
                <div className="font-bold">Cet achat : {fmt(totalPanier)} — {PAIEMENT_CHANTIER}</div>
                {enAttente > 0 && (
                  <div className="text-amber-800 font-semibold" data-achat-attente>
                    ⏳ {fmt(enAttente)} resteront en attente du chantier : le prochain versement du client les réglera d'abord.
                  </div>
                )}
                {alerte && <div className="text-red-700 font-semibold" data-achat-depasse>{alerte}</div>}
                <div className="text-xs text-slate-500">Rien n'entre dans le tiroir, rien ne compte dans le chiffre d'affaires : le matériel sort du stock et son prix d'achat compte pour le chantier.</div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// La liste des achats d'une boutique (chantiers reçus déjà filtrés : le mur).
export function TableAchatsChantier({ chantiers, boutique, ventes, dettes, onImprimer, onAnnuler, peutAnnuler }) {
  const lignes = (chantiers || []).flatMap((c) => {
    const argent = argentDuChantier({ chantier: c, vente: venteDuChantier(c, ventes), dette: detteDuChantier(c, dettes) });
    return achatsDe(c).filter((a) => a.boutique === boutique).map((a) => ({ a, c, etat: argent.couverture.get(a.id), argent }));
  }).sort((x, y) => `${y.a.date} ${y.a.heure || ""}`.localeCompare(`${x.a.date} ${x.a.heure || ""}`));
  return (
    <table className="w-full text-sm min-w-[760px]" data-table-achats-chantier>
      {/* 🧾 La règle des lignes (15/10/2026) : le chantier figé en première
          colonne, l'état en pastille, les gestes en boutons ronds. */}
      <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Chantier", "Date", "N°", "Articles", "Total", "Argent du chantier", "Par", ""].map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-slate-100")}` : ""}`}>{h}</th>)}</tr></thead>
      <tbody>
        {lignes.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun achat pour un chantier dans cette boutique.</td></tr>}
        {lignes.map(({ a, c, etat, argent }, i) => {
          const fond = fondLigneDepliable(false, i, a.annule ? "bg-slate-100" : "");
          const pastille = "inline-block px-2 py-0.5 rounded-full text-xs font-bold border";
          return (
          <tr key={a.id} className={`border-t border-slate-100 align-top ${fond} ${a.annule ? "text-slate-400" : ""}`} data-achat-chantier={a.id}>
            <td className={`px-3 py-2 font-semibold min-w-[150px] ${celluleFigee(fond)}`}>{nomChantier(c)}</td>
            <td className="px-3 py-2 whitespace-nowrap">{dFR(a.date)}<div className="text-xs text-slate-400">{a.heure || ""}</div></td>
            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{a.numero}</td>
            <td className="px-3 py-2 text-slate-600">{resumeAchat(a)}</td>
            <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap">{fmt(totalAchat(a))}</td>
            <td className="px-3 py-2 text-xs">
              {a.annule
                ? <span data-achat-annule>↩ Annulé le {dFR(a.annule.le)} par {a.annule.par} — {a.annule.motif}</span>
                : etat && etat.enAttente > 0
                  ? <span className={`${pastille} bg-amber-100 text-amber-700 border-amber-200`} data-achat-ligne-attente>⏳ {fmt(etat.enAttente)} en attente</span>
                  : <span className={`${pastille} bg-green-100 text-green-700 border-green-200`}>✅ Réglé</span>}
              {!a.annule && argent.depasseMateriel && <div className="text-red-700 font-semibold">⚠ dépasse la part matériel du devis</div>}
            </td>
            <td className="px-3 py-2 text-slate-500">{a.par}</td>
            <CelluleActions>
              <BoutonRond icone="🖨" onClick={() => onImprimer(a, c)} titre="🖨 Imprimer la facture d'achat pour le chantier" />
              {peutAnnuler && !a.annule && c.statut !== "receptionne" && <BoutonRond data-annuler-achat icone="↩" teinte="rouge" onClick={() => onAnnuler(a, c)} titre="↩ Annuler l'achat (le stock revient)" />}
            </CelluleActions>
          </tr>
          );
        })}
      </tbody>
    </table>
  );
}
