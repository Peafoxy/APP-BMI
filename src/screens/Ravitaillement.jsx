// ============================================================
// screens/Ravitaillement.jsx — Demande de ravitaillement côté boutique.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { uid, today, dFR } from "../lib/core";
import { Field, inputCls, uAlert, uConfirm, uPrompt } from "../components/ui";
import { bloquerSiLecture, demandesDe, estDepot, magasinsDe, stockActuel, boutiquesVisibles, boutiquesDuMemeEspace, refuserSaufRoles, ROLES_STOCK } from "../lib/calculs";

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
// Utilisé à deux endroits : dans l'onglet 📦 Stocks (gérant, admin) et comme
// onglet 🚚 Ravitaillement à part entière (vendeur, qui n'a pas accès au stock).
export function DemandeRavitaillement({ db, save, profile, boutique, marquerVues }) {
  const bq = boutique || profile.boutique || "";
  const maBoutique = db.boutiques.find((b) => b.nom === bq);
  const mesDemandes = demandesDe(maBoutique || {});
  const [dem, setDem] = useState({ nom: "", categorie: "", qte: "", note: "" });
  const [panierDem, setPanierDem] = useState([]);
  const magasinsVisibles = new Set(boutiquesDuMemeEspace(db, profile, magasinsDe(db), bq).map((b) => b.nom));

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
    // ⚠ Cloisonnement : un magasin de l'AUTRE espace ne peut pas servir
    // cette boutique — inutile (et trompeur) de laisser partir la demande.
    if (!boutiquesDuMemeEspace(db, profile, magasinsDe(db), bq).length) { uAlert("Aucun magasin de votre espace de travail n'est déclaré. Demandez à l'administrateur d'en créer un (⚙ Paramètres)."); return; }
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
            {/* ⚠ Cloisonnement : le catalogue proposé est celui des magasins
                de SON espace — une boutique de formation commandait sinon
                dans le catalogue du vrai dépôt. */}
            {[...new Map(db.produits.filter((p) => estDepot(db, p.boutique) && magasinsVisibles.has(p.boutique)).map((p) => [p.nom, p])).values()]
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

// ============ TRANSFERT (boutique → boutique) — reçu par MA boutique ============
// ⚠ Distinct du ravitaillement ci-dessus : une demande de transfert est
// stockée directement sur la fiche de la boutique CIBLE (pas le dépôt),
// donc visible par elle seule. Composant PARTAGÉ — utilisé à la fois comme
// onglet dédié "🔁 Transfert" (vendeur, gérant : validation simple, sans
// détour par Stocks) et à l'intérieur de l'écran Stocks (admin/magasinier).
export function DemandesTransfertRecues({ db, save, profile, boutique }) {
  const bq = boutique || profile.boutique || "";
  const maBoutique = db.boutiques.find((b) => b.nom === bq);
  const demandesTransfertRecues = demandesDe(maBoutique || {}).filter((d) => d.type === "transfert" && d.statut === "en_attente");
  const historique = demandesDe(maBoutique || {}).filter((d) => d.type === "transfert" && d.statut !== "en_attente").slice(-10).reverse();

  // ⚠ Le nom de l'article vient du catalogue RÉEL de la boutique demandeuse
  // (choisi dans Ventes.jsx, pas tapé à la main comme pour un ravitaillement)
  // — la correspondance par nom est donc fiable, pas besoin de la sophistication
  // d'association manuelle utilisée côté magasin pour le ravitaillement.
  const servirDemandeTransfert = async (demande) => {
    if (refuserSaufRoles(profile, ROLES_STOCK, "Servir une demande de transfert")) return;
    if (bloquerSiLecture(db, profile)) return;
    const manquants = demande.lignes.filter((l) => {
      const p = db.produits.find((x) => x.boutique === bq && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase());
      return !p || stockActuel(db, p) < Number(l.qte);
    });
    if (manquants.length) { uAlert(`Stock insuffisant chez vous pour :\n${manquants.map((m) => m.nom).join("\n")}`); return; }
    if (!await uConfirm(`Envoyer ce transfert vers ${demande.demandeur} ?\n\n${demande.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")}${demande.note ? `\n\n${demande.note}` : ""}`)) return;
    const ref = uid();
    const numero = `TRF-${today().replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
    let produits = db.produits;
    const ajusts = [];
    demande.lignes.forEach((l) => {
      const p = produits.find((x) => x.boutique === bq && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase());
      let cible = produits.find((x) => x.boutique === demande.demandeur && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase());
      if (!cible) {
        cible = { id: uid(), boutique: demande.demandeur, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente, code: p.code || "", tension: p.tension || "" };
        produits = [...produits, cible];
      }
      ajusts.push({ id: uid(), date: today(), produit_id: p.id, boutique: bq, qte: -Number(l.qte), motif: `Transfert ${numero} → ${demande.demandeur}`, par: profile.nom, ref, type: "transfert" });
      ajusts.push({ id: uid(), date: today(), produit_id: cible.id, boutique: demande.demandeur, qte: Number(l.qte), motif: `Transfert ${numero} ← ${bq}`, par: profile.nom, ref, type: "transfert" });
    });
    const boutiques = db.boutiques.map((b) => (b.nom === bq
      ? { ...b, demandes: demandesDe(b).map((x) => (x.id === demande.id ? { ...x, statut: "servie", numero_bon: numero, traite_par: profile.nom, date_traitement: today() } : x)) }
      : b));
    save({ ...db, boutiques, produits, ajustements: [...ajusts, ...db.ajustements] }, `Transfert ${numero} : ${bq} → ${demande.demandeur} (${demande.lignes.length} article(s), répond à une demande)`);
    uAlert(`✅ Transfert envoyé vers ${demande.demandeur}.`);
  };

  const refuserDemandeTransfert = async (demande) => {
    if (refuserSaufRoles(profile, ROLES_STOCK, "Refuser une demande de transfert")) return;
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Motif du refus (visible par ${demande.demandeur}) :`, "Rupture de stock");
    if (motif === null) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq
      ? { ...b, demandes: demandesDe(b).map((x) => (x.id === demande.id ? { ...x, statut: "refusee", motif: motif.trim(), traite_par: profile.nom, date_traitement: today() } : x)) }
      : b)) }, `Demande de transfert de ${demande.demandeur} refusée : ${motif.trim()} (par ${profile.nom})`);
  };

  if (!bq) return <div className="text-sm text-slate-400 text-center py-6">Votre compte n'est rattaché à aucune boutique.</div>;

  return (
    <div className="rounded-xl p-4 bg-white border-2 border-purple-200">
      <div className="font-bold mb-1 text-purple-800">🔁 Demandes de transfert reçues {demandesTransfertRecues.length > 0 ? `(${demandesTransfertRecues.length})` : ""}</div>
      <div className="text-xs text-slate-500 mb-4">Une autre boutique a besoin de ces articles — probablement pour finaliser une vente en attente. Validez simplement si vous les avez en stock.</div>
      {demandesTransfertRecues.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4">Aucune demande de transfert en attente.</div>
      ) : (
        <div className="space-y-3">
          {demandesTransfertRecues.map((d) => (
            <div key={d.id} className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <b>{d.demandeur}</b> demande : {d.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")}
                  {d.note && <div className="text-xs text-slate-500 mt-1">{d.note}</div>}
                  <div className="text-xs text-slate-400 mt-1">{dFR(d.date)} — par {d.par}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => servirDemandeTransfert(d)} className="px-3 py-1.5 rounded-lg bg-purple-700 text-white text-xs font-bold hover:bg-purple-800">✅ Valider</button>
                  <button onClick={() => refuserDemandeTransfert(d)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Refuser</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {historique.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-bold text-slate-500 uppercase mb-2">Historique récent</div>
          <ul className="text-xs text-slate-500 space-y-1">
            {historique.map((d) => (
              <li key={d.id}>
                {d.demandeur} (demandé par {d.par}) — {d.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")} —{" "}
                {d.statut === "servie"
                  ? <span className="text-green-700 font-semibold">✅ Servie par {d.traite_par}</span>
                  : <span className="text-red-600 font-semibold">❌ Refusée par {d.traite_par}{d.motif ? ` (${d.motif})` : ""}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

