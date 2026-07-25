// ============================================================
// screens/Fournisseurs.jsx — Fournisseurs : fiches, contacts,
// dettes fournisseur liées aux ravitaillements.
// ============================================================
import { useState } from "react";
import { uid, fmt } from "../lib/core";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt } from "../components/ui";

// ============ FOURNISSEURS ============
export function Fournisseurs({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, fournisseurs: [...db.fournisseurs, { id: uid(), nom: f.nom, tel: f.tel, adresse: f.adresse, site_web: f.site_web, produits: f.produits, doit: Number(f.doit || 0), paye: Number(f.paye || 0) }] });
    setF({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });
    uAlert("Fournisseur ajouté !");
  };

  const payer = async (fo) => {
    const s = await uPrompt(`Montant réglé à ${fo.nom} (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, paye: Number(x.paye) + m } : x)) });
    uAlert(`Paiement de ${fmt(m)} enregistré !`);
  };

  const nouvelleDette = async (fo) => {
    const s = await uPrompt(`Nouvelle commande à crédit chez ${fo.nom} — montant (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, doit: Number(x.doit) + m } : x)) });
    uAlert(`Commande de ${fmt(m)} enregistrée !`);
  };

  const supprimer = async (fo) => {
    if (await uConfirm(`Supprimer le fournisseur « ${fo.nom} » ?`)) save({ ...db, fournisseurs: db.fournisseurs.filter((x) => x.id !== fo.id) });
  };

  const liste = db.fournisseurs || [];
  const resteTotal = liste.reduce((s, x) => s + Math.max(0, x.doit - x.paye), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau fournisseur</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Adresse"><input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></Field>
          <Field label="Site web"><input type="url" placeholder="https://..." className={inputCls} value={f.site_web} onChange={(e) => setF({ ...f, site_web: e.target.value })} /></Field>
          <Field label="Produits"><input className={inputCls} value={f.produits} onChange={(e) => setF({ ...f, produits: e.target.value })} /></Field>
          <Field label="Dû (F)"><input type="number" className={inputCls} value={f.doit} onChange={(e) => setF({ ...f, doit: e.target.value })} /></Field>
          <Field label="Réglé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Fournisseurs <span className="text-sm font-normal text-slate-500">· Reste à régler : {fmt(resteTotal)}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Téléphone", "Adresse", "Site", "Produits", "Dû", "Réglé", "Reste", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">Aucun fournisseur.</td></tr>}
            {liste.map((fo) => {
              const reste = Math.max(0, fo.doit - fo.paye);
              return (
                <tr key={fo.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{fo.nom}</td>
                  <td className="px-3 py-2">{fo.tel || "—"}</td>
                  <td className="px-3 py-2">{fo.adresse || "—"}</td>
                  <td className="px-3 py-2">{fo.site_web ? <a href={fo.site_web.startsWith("http") ? fo.site_web : "https://" + fo.site_web} target="_blank" rel="noreferrer" className="text-blue-700 underline">Visiter</a> : "—"}</td>
                  <td className="px-3 py-2">{fo.produits || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.doit)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.paye)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(reste)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => nouvelleDette(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Commande</button>
                    <button onClick={() => payer(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Règlement</button>
                    <button onClick={() => supprimer(fo)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
