// ============================================================
// screens/Ravitaillement.jsx — Demande de ravitaillement côté boutique.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { uid, today, dFR } from "../lib/core";
import { Field, inputCls, uAlert, uConfirm } from "../components/ui";
import { bloquerSiLecture, demandesDe, estDepot, magasinsDe } from "../lib/calculs";

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
// Utilisé à deux endroits : dans l'onglet 📦 Stocks (gérant, admin) et comme
// onglet 🚚 Ravitaillement à part entière (vendeur, qui n'a pas accès au stock).
export function DemandeRavitaillement({ db, save, profile, boutique, marquerVues }) {
  const bq = boutique || profile.boutique || "";
  const maBoutique = db.boutiques.find((b) => b.nom === bq);
  const mesDemandes = demandesDe(maBoutique || {});
  const [dem, setDem] = useState({ nom: "", categorie: "", qte: "", note: "" });
  const [panierDem, setPanierDem] = useState([]);

  // À l'ouverture de l'onglet dédié, les réponses du magasin sont marquées comme vues
  useEffect(() => {
    if (!marquerVues || !maBoutique) return;
    const aVoir = demandesDe(maBoutique).filter((d) => d.statut !== "en_attente" && !d.vu_boutique);
    if (!aVoir.length) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq
      ? { ...b, demandes: demandesDe(b).map((d) => (d.statut !== "en_attente" && !d.vu_boutique ? { ...d, vu_boutique: true } : d)) }
      : b)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouterLigneDemande = () => {
    if (!dem.nom.trim()) { uAlert("Indiquez l'article souhaité."); return; }
    const q = Number(dem.qte);
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    setPanierDem((p) => [...p, { nom: dem.nom.trim(), categorie: dem.categorie.trim(), qte: q }]);
    setDem((d) => ({ ...d, nom: "", categorie: "", qte: "" }));
  };

  const envoyerDemande = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!bq) { uAlert("Votre compte n'est rattaché à aucune boutique. Voyez avec l'administrateur."); return; }
    if (!panierDem.length) { uAlert("Ajoutez au moins un article à la demande."); return; }
    if (!magasinsDe(db).length) { uAlert("Aucun magasin n'est déclaré. Demandez à l'administrateur d'en créer un (⚙ Paramètres)."); return; }
    if (!await uConfirm(`Envoyer la demande de ravitaillement ?\n\n${panierDem.length} article(s) — elle sera visible par le magasinier.`)) return;
    const demande = { id: uid(), date: today(), par: profile.nom, lignes: panierDem, note: dem.note.trim(), statut: "en_attente" };
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq ? { ...b, demandes: [...demandesDe(b), demande] } : b)) },
      `Demande de ravitaillement de ${bq} : ${panierDem.length} article(s) (par ${profile.nom})`);
    setPanierDem([]);
    setDem({ nom: "", categorie: "", qte: "", note: "" });
    uAlert("✅ Demande envoyée au magasin.");
  };

  const annulerDemande = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm("Annuler cette demande de ravitaillement ?")) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq ? { ...b, demandes: demandesDe(b).filter((x) => x.id !== d.id) } : b)) },
      `Demande de ravitaillement annulée — ${bq}`);
  };

  return (
    <div className="rounded-xl p-4 bg-white border-2 border-blue-200">
      <div className="font-bold mb-1 text-blue-800">🚚 Demander un ravitaillement au magasin</div>
      <div className="text-xs text-slate-500 mb-4">Listez ce dont la boutique {bq} a besoin. Le magasinier reçoit la demande et prépare le bon.</div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Article souhaité">
          <select className={inputCls} value={dem.nom} onChange={(e) => {
            const p = db.produits.find((x) => x.nom === e.target.value);
            setDem({ ...dem, nom: e.target.value, categorie: p ? (p.categorie || "") : dem.categorie });
          }}>
            <option value="">— Choisir dans le catalogue du magasin —</option>
            {[...new Map(db.produits.filter((p) => estDepot(db, p.boutique)).map((p) => [p.nom, p])).values()]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((p) => <option key={p.id} value={p.nom}>{p.nom}{p.categorie ? ` — ${p.categorie}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Catégorie (facultatif)">
          <input className={inputCls} list="liste-cat-demande" value={dem.categorie} onChange={(e) => setDem({ ...dem, categorie: e.target.value })} />
          <datalist id="liste-cat-demande">{[...new Set(db.produits.map((p) => p.categorie).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Quantité"><input type="number" min="1" className={inputCls} value={dem.qte} onChange={(e) => setDem({ ...dem, qte: e.target.value })} /></Field>
        <div className="flex items-end">
          <button onClick={ajouterLigneDemande} className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter</button>
        </div>
      </div>

      {panierDem.length > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="font-bold text-sm text-blue-900 mb-2">Demande en préparation</div>
          <ul className="text-sm text-slate-700 space-y-1">
            {panierDem.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span><b>{l.qte}</b> × {l.nom}{l.categorie ? ` (${l.categorie})` : ""}</span>
                <button onClick={() => setPanierDem(panierDem.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Field label="Note pour le magasinier (facultatif)">
              <input className={inputCls} value={dem.note} onChange={(e) => setDem({ ...dem, note: e.target.value })} placeholder="Ex : urgent, chantier de vendredi" />
            </Field>
          </div>
          <button onClick={envoyerDemande} className="mt-3 px-5 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">📤 Envoyer la demande</button>
        </div>
      )}

      {mesDemandes.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="text-xs font-bold text-slate-500 uppercase mb-2">Mes demandes</div>
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Articles", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...mesDemandes].reverse().slice(0, 10).map((d) => (
                <tr key={d.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(d.date)}</td>
                  <td className="px-3 py-2">{d.lignes.map((l) => `${l.qte} × ${l.nom}`).join(", ")}</td>
                  <td className="px-3 py-2">
                    {d.statut === "en_attente" ? <span className="text-xs font-bold text-amber-600">⏳ En attente</span>
                      : d.statut === "servie" ? <span className="text-xs font-bold text-green-700">✅ Servie {d.numero_bon ? `(${d.numero_bon})` : ""}</span>
                      : <span className="text-xs font-bold text-red-600">❌ Refusée{d.motif ? ` — ${d.motif}` : ""}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {d.statut === "en_attente" && <button onClick={() => annulerDemande(d)} className="text-xs text-red-600 underline">Annuler</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

