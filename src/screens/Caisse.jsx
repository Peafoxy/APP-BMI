// ============================================================
// screens/Caisse.jsx — Clôture de caisse du jour.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm } from "../components/ui";
import { bloquerSiLecture, boutiquesVente } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";

// ============ CAISSE ============
export function Caisse({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [compte, setCompte] = useState("");
  const [notes, setNotes] = useState("");
  const t = today();

  const especesVentes = db.ventes.filter((v) => v.boutique === boutique && String(v.date) === t && v.paiement === "Espèces")
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0);
  const especesDepenses = db.depenses.filter((x) => x.boutique === boutique && String(x.date) === t && x.paiement === "Espèces").reduce((s, x) => s + Number(x.montant), 0);
  // Les règlements de dettes et les versements sur réservation entrent aussi dans la caisse.
  // (Ils étaient oubliés : le théorique du jour était donc faux.)
  const especesReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .reduce((s, d) => s + (d.paiements || [])
      .filter((p) => String(p.date) === t && (p.paiement || "Espèces") === "Espèces")
      .reduce((t2, p) => t2 + Number(p.montant || 0), 0), 0);
  const theorique = especesVentes + especesReglements - especesDepenses;
  const dejaCloturee = db.clotures.some((c) => c.boutique === boutique && String(c.date) === t);
  const ecart = compte === "" ? null : Number(compte) - theorique;

  const cloturer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\nThéorique : ${fmt(theorique)}\nCompté : ${fmt(Number(compte))}\nÉcart : ${fmt(Number(compte) - theorique)}`)) return;
    save({ ...db, clotures: [{ id: uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom }, ...db.clotures] }, `Clôture caisse ${boutique} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})`);
    setCompte(""); setNotes("");
    uAlert("Clôture enregistrée !");
  };

  const liste = db.clotures.filter((c) => c.boutique === boutique);

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} avecTerrain />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Clôture de caisse du jour <Badge boutique={boutique} /></div>
        {dejaCloturee ? (
          <div className="text-sm font-semibold text-green-700">✓ La caisse du {dFR(t)} a déjà été clôturée.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Ventes en espèces</div><div className="font-bold tabular-nums">{fmt(especesVentes)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Encaissements (dettes / réservations)</div><div className="font-bold tabular-nums text-emerald-700">{fmt(especesReglements)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Dépenses en espèces</div><div className="font-bold tabular-nums">− {fmt(especesDepenses)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Espèces attendues</div><div className="font-bold tabular-nums">{fmt(theorique)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500">Écart</div>
                <div className={`font-bold tabular-nums ${ecart === null ? "text-slate-400" : ecart === 0 ? "text-green-700" : "text-red-600"}`}>{ecart === null ? "—" : fmt(ecart)}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Espèces comptées (F)"><input type="number" className={inputCls} value={compte} onChange={(e) => setCompte(e.target.value)} /></Field>
              <div className="lg:col-span-2"><Field label="Remarques"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : Monnaie rendue..." /></Field></div>
            </div>
            <button onClick={cloturer} className={`mt-3 ${btnDark}`}>Clôturer la caisse</button>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Historique des clôtures — {boutique}</div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Attendu", "Compté", "Écart", "Remarques", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune clôture enregistrée.</td></tr>}
            {liste.map((c) => {
              const e = Number(c.compte) - Number(c.theorique);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2">{dFR(c.date)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.theorique)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.compte)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${e === 0 ? "text-green-700" : "text-red-600"}`}>{fmt(e)}</td>
                  <td className="px-3 py-2">{c.notes || "—"}</td>
                  <td className="px-3 py-2">{c.par}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
