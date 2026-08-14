// ============================================================
// screens/Depenses.jsx — Dépenses par boutique, et Chez le comptable
// (sorties de caisse confiées au comptable plutôt qu'à une boutique).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR } from "../lib/core";
import { CATEGORIES, PAIEMENTS } from "../lib/constants";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, usePagination, Pagination } from "../components/ui";
import { bloquerSiLecture, annulerLiensDepense, boutiquesVente } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";

// ============ DÉPENSES ============
export function Depenses({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [f, setF] = useState({ categorie: CATEGORIES[0], description: "", montant: "", paiement: PAIEMENTS[0] });

  const ajouter = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!f.montant) { uAlert("Veuillez saisir un montant."); return; }
    if (!await uConfirm(`Confirmer la dépense de ${fmt(Number(f.montant))} en ${f.categorie} ?`)) return;
    save({ ...db, depenses: [{ id: uid(), date: today(), boutique, ...f, montant: Number(f.montant), par: profile.nom }, ...db.depenses] }, `Dépense ${fmt(Number(f.montant))} (${f.categorie}) — ${boutique}`);
    setF({ categorie: CATEGORIES[0], description: "", montant: "", paiement: PAIEMENTS[0] });
  };

  const supprimerDepense = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const avertissement = d.auto ? "\n\n⚠ Cette dépense a été générée automatiquement par un paiement : le statut « payé » correspondant sera aussi annulé (à repayer si besoin)." : "";
    if (await uConfirm(`Supprimer la dépense de ${fmt(d.montant)} (${d.categorie}) du ${dFR(d.date)} ?${avertissement}`)) {
      save({ ...db, ...annulerLiensDepense(db, d), depenses: db.depenses.filter((x) => x.id !== d.id) }, `Suppression dépense ${fmt(d.montant)} (${d.categorie}) — ${d.boutique}`);
    }
  };

  const liste = db.depenses.filter((x) => x.boutique === boutique);
  const totalMois = liste.filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dépense <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Catégorie"><select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Montant (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Paiement"><select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>{PAIEMENTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dépense</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Dépenses — {boutique}</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)}</span>
        </div>
        <table className="w-full text-sm min-w-[680px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Catégorie", "Description", "Montant", "Paiement", "Saisi par", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucune dépense enregistrée.</td></tr>}
            {listePage.map((x) => (
              <tr key={x.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2">{dFR(x.date)}</td>
                <td className="px-3 py-2 font-semibold">{x.categorie}</td>
                <td className="px-3 py-2">{x.description || "—"}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(x.montant)}</td>
                <td className="px-3 py-2">{x.paiement}</td>
                <td className="px-3 py-2">{x.par}</td>
                <td className="px-3 py-2">
                  {profile.role === "admin" && (
                    <button onClick={() => supprimerDepense(x)} className="text-xs text-red-600 underline">Suppr.</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

// ============ CHEZ LE COMPTABLE ============
// Regroupe toutes les sorties de caisse qui n'ont pas été débitées d'une
// boutique mais confiées au comptable (commissions, salaires, etc. payés
// « Chez le comptable ») — sinon ces dépenses étaient invisibles nulle part.
export function ChezComptable({ db, save, profile }) {
  const liste = (db.depenses || []).filter((x) => x.boutique === "Chez le comptable")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const { pageItems: listePage, page: pageCC, setPage: setPageCC, totalPages: totalPagesCC } = usePagination(liste, 50);

  // ---- POINTAGE DES DÉCAISSEMENTS : le comptable marque ce qu'il a
  // réellement remis (billets donnés / virement fait), pour ne plus se
  // mélanger entre le déjà-payé et le pas-encore-payé. C'est la SEULE
  // écriture autorisée à son compte (porte pointageComptable de save).
  const estComptable = profile.role === "comptable";
  const aRemettre = liste.filter((x) => !x.decaisse_le);
  const dejaRemis = liste.filter((x) => x.decaisse_le);
  const marquerRemis = async (dep) => {
    if (!await uConfirm(`Marquer ${dep.montant < 0 ? "l'encaissement" : "la remise"} comme faite ?\n\n${dep.description || dep.categorie} — ${fmt(Math.abs(dep.montant))}\n\nCela confirme que l'argent a réellement ${dep.montant < 0 ? "été encaissé" : "été remis au bénéficiaire"}.`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === dep.id ? { ...x, decaisse_le: today(), decaisse_par: profile.nom } : x)) },
      `Décaissement pointé « remis » par ${profile.nom} : ${fmt(Math.abs(dep.montant))} — ${dep.description || dep.categorie}`,
      { pointageComptable: true });
  };
  const annulerRemis = async (dep) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Annuler le pointage « remis » de ${fmt(Math.abs(dep.montant))} (${dep.description || dep.categorie}) ?`)) return;
    save({ ...db, depenses: db.depenses.map((x) => (x.id === dep.id ? { ...x, decaisse_le: null, decaisse_par: null } : x)) },
      `Pointage de décaissement ANNULÉ par ${profile.nom} : ${fmt(Math.abs(dep.montant))} — ${dep.description || dep.categorie}`);
  };
  const totalMois = liste.filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);
  const total = liste.reduce((s, x) => s + Number(x.montant), 0);

  const supprimerDepense = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const avertissement = d.auto ? "\n\n⚠ Cette dépense a été générée automatiquement par un paiement : le statut « payé » correspondant sera aussi annulé (à repayer si besoin)." : "";
    if (await uConfirm(`Supprimer la dépense de ${fmt(d.montant)} (${d.categorie}) du ${dFR(d.date)} ?${avertissement}`)) {
      save({ ...db, ...annulerLiensDepense(db, d), depenses: db.depenses.filter((x) => x.id !== d.id) }, `Suppression dépense ${fmt(d.montant)} (${d.categorie}) — Chez le comptable`);
    }
  };

  return (
    <div className="space-y-4">
      {/* ═══ Décaissements : à remettre / remis ═══ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-2">💰 Décaissements de ma caisse
          <span className="ml-2 text-xs font-semibold text-red-600">à remettre : {aRemettre.length}</span>
          <span className="ml-2 text-xs font-semibold text-green-700">remis : {dejaRemis.length}</span>
        </div>
        {aRemettre.length === 0 && <div className="text-sm text-slate-400">Rien en attente : tout ce qui est passé par la caisse « Chez le comptable » a été remis.</div>}
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {aRemettre.map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <div>
                <b>{fmt(Math.abs(x.montant))}</b> — {x.description || x.categorie}
                <div className="text-xs text-slate-500">{dFR(x.date)} · enregistré par {x.par}{x.montant < 0 ? " · 💵 entrée de caisse" : ""}</div>
              </div>
              {estComptable && <button onClick={() => marquerRemis(x)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-1 hover:bg-green-800 whitespace-nowrap">✅ {x.montant < 0 ? "Encaissé" : "Remis"}</button>}
            </div>
          ))}
        </div>
        {dejaRemis.length > 0 && (
          <div className="mt-3">
            <div className="text-xs font-bold text-slate-500 uppercase mb-1">Déjà remis</div>
            <div className="max-h-[220px] overflow-y-auto space-y-1">
              {dejaRemis.map((x) => (
                <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600">
                  <div>
                    {fmt(Math.abs(x.montant))} — {x.description || x.categorie}
                    <span className="ml-2 text-xs text-green-700">✅ remis le {dFR(x.decaisse_le)} par {x.decaisse_par}</span>
                  </div>
                  {profile.role === "admin" && <button onClick={() => annulerRemis(x)} className="text-xs text-red-600 underline whitespace-nowrap">annuler</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-1">🧾 Sorties de caisse confiées au comptable</div>
        <div className="text-xs text-slate-500">Commissions, salaires ou autres sorties payées « Chez le comptable » plutôt que débitées d'une boutique.</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Chez le comptable</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)} · Total : {fmt(total)}</span>
        </div>
        <table className="w-full text-sm min-w-[680px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Catégorie", "Description", "Montant", "Paiement", "Saisi par", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucune sortie de caisse « Chez le comptable » pour l'instant.</td></tr>}
            {listePage.map((x) => (
              <tr key={x.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2">{dFR(x.date)}</td>
                <td className="px-3 py-2 font-semibold">{x.categorie}</td>
                <td className="px-3 py-2">{x.description || "—"}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(x.montant)}</td>
                <td className="px-3 py-2">{x.paiement}</td>
                <td className="px-3 py-2">{x.par}</td>
                <td className="px-3 py-2">
                  {profile.role === "admin" && (
                    <button onClick={() => supprimerDepense(x)} className="text-xs text-red-600 underline">Suppr.</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={pageCC} setPage={setPageCC} totalPages={totalPagesCC} />
      </div>
    </div>
  );
}

