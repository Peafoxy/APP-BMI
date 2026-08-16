// ============================================================
// screens/Rentabilite.jsx — Rentabilité par produit : marge sur
// prix d'achat/vente, tri, totaux par boutique.
// ============================================================
import { useState } from "react";
import { fmt, today, inP } from "../lib/core";
import { Field, inputCls, btnDark, Badge } from "../components/ui";
import { stockActuel, periodes, ventesReelles, produitsReels } from "../lib/calculs";
import { exportCSV } from "../lib/export";

// ============ RENTABILITÉ PAR PRODUIT ============
export function Rentabilite({ db }) {
  const [lp, debut, fin] = periodes()[0] ? [null, null, null] : [null, null, null];
  const [periode, setPeriode] = useState("mois");
  const P = periodes();
  const choix = P.find((p) => p[0].toLowerCase().includes(periode)) || P[0];
  const [, a, b] = choix;
  const [tri, setTri] = useState("marge");

  // ⚠ Boutiques de formation (2.100.16) : exclues via la fonction centrale
  // ventesReelles() — même principe que le Tableau de bord, une vente
  // d'entraînement ne doit jamais fausser la rentabilité réelle.
  const ventesP = ventesReelles(db).filter((v) => inP(v.date, a, b));

  // Agrégation par NOM d'article (tous sites confondus)
  const parProduit = {};
  ventesP.forEach((v) => {
    (v.articles || []).forEach((l) => {
      // ⚠ Demande Timo : un article « hors boutique » (HB) n'entre ni dans le
      // CA ni dans les commissions — logiquement, il sort aussi de la
      // rentabilité par produit (ce n'est pas une vente de stock BMI).
      if (l.hors_boutique) return;
      const p = db.produits.find((x) => x.id === l.produit_id);
      const nom = p ? p.nom : (l.article || "?");
      const achat = p ? Number(p.prix_achat || 0) : 0;
      if (!parProduit[nom]) parProduit[nom] = { nom, categorie: p?.categorie || "—", qte: 0, ca: 0, cout: 0 };
      parProduit[nom].qte += Number(l.qte || 0);
      parProduit[nom].ca += Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0); // CA net : la remise ligne pèse sur la marge du produit concerné
      parProduit[nom].cout += Number(l.qte || 0) * achat;
    });
  });

  const lignes = Object.values(parProduit).map((x) => ({
    ...x, marge: x.ca - x.cout, tauxMarge: x.ca > 0 ? Math.round(((x.ca - x.cout) / x.ca) * 1000) / 10 : 0,
  }));
  lignes.sort((x, y) => tri === "marge" ? y.marge - x.marge : tri === "ca" ? y.ca - x.ca : tri === "qte" ? y.qte - x.qte : y.tauxMarge - x.tauxMarge);

  const caTotal = lignes.reduce((s, x) => s + x.ca, 0);
  const margeTotale = lignes.reduce((s, x) => s + x.marge, 0);
  const tauxGlobal = caTotal > 0 ? Math.round((margeTotale / caTotal) * 1000) / 10 : 0;

  // Articles jamais vendus sur la période, mais en stock : capital immobilisé
  // ⚠ Cloisonnement : ces deux mesures partaient de db.produits BRUT — le
  // stock des boutiques d'entraînement gonflait donc le « capital dormant »
  // et polluait la liste des invendus, alors même que le tableau des ventes
  // juste au-dessus excluait bien la formation.
  const vendus = new Set(Object.keys(parProduit));
  const dormants = produitsReels(db)
    .filter((p) => !vendus.has(p.nom) && stockActuel(db, p) > 0)
    .map((p) => ({ p, valeur: stockActuel(db, p) * Number(p.prix_achat || 0) }))
    .sort((x, y) => y.valeur - x.valeur);
  const capitalDormant = dormants.reduce((s, x) => s + x.valeur, 0);

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">📈 Rentabilité par produit</div>
        <div className="text-xs text-slate-500 mb-3">Marge réelle = prix de vente encaissé − prix d'achat. Les remises sont donc prises en compte.</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Période">
            <select className={inputCls} value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="année">Cette année</option>
            </select>
          </Field>
          <Field label="Trier par">
            <select className={inputCls} value={tri} onChange={(e) => setTri(e.target.value)}>
              <option value="marge">Marge (F CFA)</option>
              <option value="taux">Taux de marge (%)</option>
              <option value="ca">Chiffre d'affaires</option>
              <option value="qte">Quantités vendues</option>
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Carte label="Chiffre d'affaires" valeur={fmt(caTotal)} couleur="border-l-sky-700" />
          <Carte label="Marge brute" valeur={<span className="text-green-700">{fmt(margeTotale)}</span>} couleur="border-l-green-700" />
          <Carte label="Taux de marge global" valeur={<span className={tauxGlobal < 15 ? "text-red-600" : "text-green-700"}>{tauxGlobal} %</span>} couleur="border-l-emerald-600" />
          <Carte label="Capital dormant" valeur={<span className="text-orange-600">{fmt(capitalDormant)}</span>} couleur="border-l-orange-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>Produits vendus — {choix[0]}</span>
          <button className={btnDark} onClick={() => exportCSV(`rentabilite_${today()}`,
            ["Article", "Catégorie", "Quantité vendue", "Chiffre d'affaires", "Coût d'achat", "Marge", "Taux de marge (%)"],
            lignes.map((x) => [x.nom, x.categorie, x.qte, x.ca, x.cout, x.marge, x.tauxMarge]), choix[0])}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucune vente sur cette période.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Catégorie", "Vendus", "CA", "Coût", "Marge", "Taux"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map((x) => (
                <tr key={x.nom} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{x.nom}</td>
                  <td className="px-3 py-2 text-slate-500">{x.categorie}</td>
                  <td className="px-3 py-2 tabular-nums">{x.qte}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(x.ca)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{fmt(x.cout)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.marge >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(x.marge)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.tauxMarge < 0 ? "text-red-600" : x.tauxMarge < 15 ? "text-orange-600" : "text-green-700"}`}>{x.tauxMarge} %</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal)}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal - margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums">{tauxGlobal} %</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {dormants.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-orange-800 border-b border-orange-200 bg-orange-50">
            😴 Produits dormants — invendus sur la période, mais en stock ({fmt(capitalDormant)} immobilisés)
          </div>
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Site", "Stock", "Valeur immobilisée"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {dormants.slice(0, 25).map(({ p, valeur }) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2"><Badge boutique={p.boutique} /></td>
                  <td className="px-3 py-2 tabular-nums">{stockActuel(db, p)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">{fmt(valeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
