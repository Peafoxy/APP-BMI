// ============================================================
// screens/Ravitaillement.jsx — Demande de ravitaillement côté boutique.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { uid, today, dFR } from "../lib/core";
import { Field, inputCls, uAlert, uConfirm, uPrompt, FormulaireRepliable, CarteRepliable, BoutonGeste } from "../components/ui";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { bloquerSiLecture, demandesDe, estDepot, magasinsDe, stockActuel, boutiquesVisibles, boutiquesDuMemeEspace, refuserSaufRoles, ROLES_STOCK, chantiersDeLEspaceRegarde } from "../lib/calculs";
import { reservations, avertissementReserve } from "../lib/achatsChantier";
import { transfertsStockAValider, historiqueTransfertsStock, validerTransfertStock, refuserTransfertStock, libelleLignes, STATUT_VALIDE, STATUT_REFUSE } from "../lib/transfertsStock";

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
// Utilisé à deux endroits : dans l'onglet 📦 Stocks (gérant, admin) et comme
// onglet 🚚 Ravitaillement à part entière (vendeur, qui n'a pas accès au stock).
export function DemandeRavitaillement({ db, save, profile, boutique, marquerVues, panierInitial }) {
  const bq = boutique || profile.boutique || "";
  const maBoutique = db.boutiques.find((b) => b.nom === bq);
  const mesDemandes = demandesDe(maBoutique || {});
  const [dem, setDem] = useState({ nom: "", categorie: "", qte: "", note: "" });
  const [panierDem, setPanierDem] = useState([]);
  // ➕ La demande est fermée d'office (FormulaireRepliable, 06/10/2026) ;
  // « 🚚 Demander ce ravitaillement » (📦 Stocks) l'OUVRE tout seul, déjà
  // rempli, et la liste « Mes demandes » reste visible.
  const [demandeOuverte, setDemandeOuverte] = useState(false);
  // Timo (10/09/2026) : « Demander ce ravitaillement » depuis la liste des
  // articles à réapprovisionner pré-remplit le panier (quantité = le
  // manque), modifiable avant l'envoi. `n` change à chaque clic.
  useEffect(() => {
    if (panierInitial?.lignes?.length) {
      setPanierDem(panierInitial.lignes.map((l) => ({ nom: l.nom, categorie: l.categorie || "", qte: Number(l.qte) })));
      setDemandeOuverte(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panierInitial?.n]);
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
    setDemandeOuverte(false);
    uAlert("✅ Demande envoyée au magasin.");
  };

  const annulerDemande = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm("Annuler cette demande de ravitaillement ?")) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq ? { ...b, demandes: demandesDe(b).filter((x) => x.id !== d.id) } : b)) },
      `Demande de ravitaillement annulée — ${bq}`);
  };

  // 🚚 FAÇON CARNET (18/11/2026, aperçu validé par Timo, « Construit, lance ») :
  // un seul bloc « Mes demandes au magasin », l'explication derrière « ⓘ »,
  // les demandes en TABLEAU (sur téléphone : une carte par demande), les
  // gestes écrits en mots. Les règles n'ont pas bougé.
  const etat = (d) => (d.statut === "en_attente" ? <span className="text-xs font-bold text-amber-600">⏳ En attente</span>
    : d.statut === "servie" ? <span className="text-xs font-bold text-green-700">✅ Servie {d.numero_bon ? `(${d.numero_bon})` : ""}</span>
    : <span className="text-xs font-bold text-red-600">❌ Refusée{d.motif ? ` — ${d.motif}` : ""}</span>);
  const geste = (d) => (d.statut === "en_attente" ? <BoutonGeste icone="✖" nom="Annuler" teinte="rouge" onClick={() => annulerDemande(d)} /> : null);
  return (
    <div className="rounded-xl p-4 bg-white border-2 border-blue-200" data-ravitaillement>
      <CarteRepliable titre={<span className="text-blue-800">{`🚚 Mes demandes au magasin (${mesDemandes.length})`}</span>}
        explication={`Listez ce dont la boutique ${bq} a besoin. Le magasinier reçoit la demande et prépare le bon.`}>
      <FormulaireRepliable ouvert={demandeOuverte} onOuvrir={() => setDemandeOuverte(true)} onFermer={() => setDemandeOuverte(false)}
        bouton="🚚 Demander un ravitaillement" titre={<span className="text-blue-800">🚚 Demander un ravitaillement au magasin</span>}>
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
        <Field label="Catégorie">
          <ChampSuggestions valeur={dem.categorie} onChange={(v) => setDem({ ...dem, categorie: v })}
            suggestions={[...new Set(db.produits.map((p) => p.categorie).filter(Boolean))].map((c) => ({ valeur: c }))} />
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
                <BoutonGeste icone="✖" nom="Retirer" teinte="rouge" onClick={() => setPanierDem(panierDem.filter((_, j) => j !== i))} />
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Field label="Note pour le magasinier">
              <input className={inputCls} value={dem.note} onChange={(e) => setDem({ ...dem, note: e.target.value })} placeholder="Ex : urgent, chantier de vendredi" />
            </Field>
          </div>
          <button onClick={envoyerDemande} className="mt-3 px-5 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">📤 Envoyer la demande</button>
        </div>
      )}
      </FormulaireRepliable>

      {mesDemandes.length > 0 && (
        <div className="mt-4">
          <div className="hidden sm:block overflow-x-auto" data-demandes-table>
            <table className="w-full text-sm min-w-[520px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Articles", "État", "Geste"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {[...mesDemandes].reverse().slice(0, 10).map((d) => (
                  <tr key={d.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(d.date)}</td>
                    <td className="px-3 py-2">{d.lignes.map((l) => `${l.qte} × ${l.nom}`).join(", ")}</td>
                    <td className="px-3 py-2">{etat(d)}</td>
                    <td className="px-3 py-2">{geste(d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2" data-demandes-cartes>
            {[...mesDemandes].reverse().slice(0, 10).map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{dFR(d.date)}</span>{etat(d)}</div>
                <div className="text-sm mt-1">{d.lignes.map((l) => `${l.qte} × ${l.nom}`).join(", ")}</div>
                {d.statut === "en_attente" && <div className="mt-2">{geste(d)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      </CarteRepliable>
    </div>
  );
}

// ============ TRANSFERT (boutique → boutique) — reçu par MA boutique ============
// ⚠ Distinct du ravitaillement ci-dessus : une demande de transfert est
// stockée directement sur la fiche de la boutique CIBLE (pas le dépôt),
// donc visible par elle seule. Composant PARTAGÉ — utilisé à la fois comme
// onglet dédié "🔁 Transfert" (gérant : validation simple, sans détour par
// Stocks — retiré au vendeur le 09/09/2026, il ne peut pas valider) et à
// l'intérieur de l'écran Stocks (admin/magasinier).
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
    // 🔒 Le matériel réservé pour une installation (Timo, 12/10/2026, « a ») :
    // servir la demande prend-il ce qu'un chantier a payé ? On avertit, on ne
    // bloque pas (lib/achatsChantier.js).
    { const panier = demande.lignes.map((l) => ({ produit_id: db.produits.find((x) => x.boutique === bq && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase())?.id, qte: l.qte }));
      const question = avertissementReserve({ panier, produits: db.produits, stock: (x) => stockActuel(db, x),
        liste: reservations({ chantiers: chantiersDeLEspaceRegarde(db, profile), ventes: db.ventes }), boutique: bq, geste: "ce transfert" });
      if (question && !await uConfirm(question)) return; }
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

  // ---- Transferts de STOCK à valider (Timo, 14/09/2026 : « le gérant de la
  // boutique de réception doit valider dans Transfert ; tant que cette
  // validation n'est pas faite, l'article ne bouge pas »). Règle pure
  // lib/transfertsStock.js ; magasinier, gérant, admin.
  const stockAValider = transfertsStockAValider(db, bq);
  const historiqueStock = historiqueTransfertsStock(db, bq);
  const validerStock = async (t) => {
    if (refuserSaufRoles(profile, ROLES_STOCK, "Valider un transfert de stock")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Valider la réception de ${libelleLignes(t)} envoyé par ${t.de} ?\n\nLe stock de ${t.de} baisse et celui de ${bq} monte à cet instant.`)) return;
    const r = validerTransfertStock(db, bq, t, profile);
    if (r.erreur) { uAlert(r.erreur); return; }
    save(r.db, r.journal);
    uAlert(`✅ Réception validée : ${libelleLignes(t)} est maintenant dans le stock de ${bq}.`);
  };
  const refuserStock = async (t) => {
    if (refuserSaufRoles(profile, ROLES_STOCK, "Refuser un transfert de stock")) return;
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Motif du refus (visible par ${t.de}) :`, "Colis non reçu");
    if (motif === null) return;
    const r = refuserTransfertStock(db, bq, t, profile, motif);
    if (r.erreur) { uAlert(r.erreur); return; }
    save(r.db, r.journal);
  };

  if (!bq) return <div className="text-sm text-slate-400 text-center py-6">Votre compte n'est rattaché à aucune boutique.</div>;

  // 🔁 FAÇON CARNET (18/11/2026, aperçu validé par Timo, « Construit, lance ») :
  // les deux blocs côte à côte, en tableaux (sur téléphone : une carte par
  // ligne), les gestes écrits en mots, les phrases d'explication derrière « ⓘ »,
  // les historiques repliés et en tableau. Les règles n'ont pas bougé.
  const statutStock = (t) => (t.statut === STATUT_VALIDE
    ? <span className="text-green-700 font-semibold">✅ Reçu, validé par {t.traite_par}{t.numero_bon ? ` (${t.numero_bon})` : ""}</span>
    : t.statut === STATUT_REFUSE
      ? <span className="text-red-600 font-semibold">❌ Refusé par {t.traite_par}{t.motif ? ` (${t.motif})` : ""}</span>
      : <span className="text-slate-500 font-semibold">↩ Annulé par {t.traite_par}</span>);
  const statutDemande = (d) => (d.statut === "servie"
    ? <span className="text-green-700 font-semibold">✅ Servie par {d.traite_par}</span>
    : d.statut === "annule"
      ? <span className="text-slate-500 font-semibold">↩ Annulée par {d.demandeur}</span>
      : <span className="text-red-600 font-semibold">❌ Refusée par {d.traite_par}{d.motif ? ` (${d.motif})` : ""}</span>);
  const gestesStock = (t) => (<>
    <BoutonGeste icone="✅" nom="Valider la réception" teinte="vert" onClick={() => validerStock(t)} />
    <BoutonGeste icone="✖" nom="Refuser" teinte="rouge" onClick={() => refuserStock(t)} />
  </>);
  const gestesDemande = (d) => (<>
    <BoutonGeste icone="✅" nom="Valider" teinte="vert" onClick={() => servirDemandeTransfert(d)} />
    <BoutonGeste icone="✖" nom="Refuser" teinte="rouge" onClick={() => refuserDemandeTransfert(d)} />
  </>);
  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start" data-transferts-colonnes>
    <div className="rounded-xl p-4 bg-white border-2 border-blue-200" data-transferts="a-valider">
      <CarteRepliable titre={<span className="text-blue-800">{`📦 Transferts de stock à valider ${stockAValider.length > 0 ? `(${stockAValider.length})` : ""}`}</span>}
        explication="Une autre boutique vous envoie des articles. Tant que vous n'avez pas validé, ils restent dans SON stock : validez quand le colis est bien arrivé.">
      {stockAValider.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4">Aucun transfert de stock en attente.</div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto" data-transferts-stock-table>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 uppercase">{["De", "Articles", "Envoyé", "Gestes"].map((h) => <th key={h} className="text-left px-2 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {stockAValider.map((t) => (
                  <tr key={t.id} data-ligne={t.id} className="border-t border-slate-100 bg-blue-50 align-top">
                    <td className="px-2 py-2 font-semibold">{t.de}</td>
                    <td className="px-2 py-2">{libelleLignes(t)}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{dFR(t.date)}{t.heure ? ` ${t.heure}` : ""} — par {t.par}</td>
                    <td className="px-2 py-2"><div className="flex flex-wrap gap-1.5">{gestesStock(t)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2" data-transferts-stock-cartes>
            {stockAValider.map((t) => (
              <div key={t.id} data-ligne={t.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-center justify-between gap-2"><b className="text-sm">{t.de}</b><span className="text-xs text-slate-500">{dFR(t.date)} · {t.par}</span></div>
                <div className="text-sm mt-1">{libelleLignes(t)}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">{gestesStock(t)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {historiqueStock.length > 0 && (
        <div className="mt-4">
          <CarteRepliable titre={`Historique récent (${historiqueStock.length})`} ouvertParDefaut={false}>
            <div className="overflow-x-auto" data-transferts-stock-historique>
              <table className="w-full text-xs text-slate-500">
                <thead><tr className="uppercase">{["De", "Envoyé par", "Articles", "Suite"].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>
                  {historiqueStock.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100"><td className="px-2 py-1">{t.de}</td><td className="px-2 py-1">{t.par}</td><td className="px-2 py-1">{libelleLignes(t)}</td><td className="px-2 py-1">{statutStock(t)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CarteRepliable>
        </div>
      )}
      </CarteRepliable>
    </div>
    <div className="rounded-xl p-4 bg-white border-2 border-purple-200" data-transferts="demandes-recues">
      <CarteRepliable titre={<span className="text-purple-800">{`🔁 Demandes de transfert reçues ${demandesTransfertRecues.length > 0 ? `(${demandesTransfertRecues.length})` : ""}`}</span>}
        explication="Une autre boutique a besoin de ces articles — probablement pour finaliser une vente en attente. Validez simplement si vous les avez en stock.">
      {demandesTransfertRecues.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-4">Aucune demande de transfert en attente.</div>
      ) : (
        <>
          <div className="hidden sm:block overflow-x-auto" data-demandes-transfert-table>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500 uppercase">{["De", "Articles", "Demandé", "Gestes"].map((h) => <th key={h} className="text-left px-2 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {demandesTransfertRecues.map((d) => (
                  <tr key={d.id} data-ligne={d.id} className="border-t border-slate-100 bg-purple-50 align-top">
                    <td className="px-2 py-2 font-semibold">{d.demandeur}</td>
                    <td className="px-2 py-2">{d.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")}{d.note && <div className="text-xs text-slate-500 mt-1">{d.note}</div>}</td>
                    <td className="px-2 py-2 text-xs text-slate-500">{dFR(d.date)} — par {d.par}</td>
                    <td className="px-2 py-2"><div className="flex flex-wrap gap-1.5">{gestesDemande(d)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-2" data-demandes-transfert-cartes>
            {demandesTransfertRecues.map((d) => (
              <div key={d.id} data-ligne={d.id} className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                <div className="flex items-center justify-between gap-2"><b className="text-sm">{d.demandeur}</b><span className="text-xs text-slate-500">{dFR(d.date)} · {d.par}</span></div>
                <div className="text-sm mt-1">{d.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")}</div>
                {d.note && <div className="text-xs text-slate-500 mt-1">{d.note}</div>}
                <div className="mt-2 flex flex-wrap gap-1.5">{gestesDemande(d)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {historique.length > 0 && (
        <div className="mt-4">
          <CarteRepliable titre={`Historique récent (${historique.length})`} ouvertParDefaut={false}>
            <div className="overflow-x-auto" data-demandes-transfert-historique>
              <table className="w-full text-xs text-slate-500">
                <thead><tr className="uppercase">{["De", "Demandé par", "Articles", "Suite"].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>
                  {historique.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100"><td className="px-2 py-1">{d.demandeur}</td><td className="px-2 py-1">{d.par}</td><td className="px-2 py-1">{d.lignes.map((l) => `${l.qte}× ${l.nom}`).join(", ")}</td><td className="px-2 py-1">{statutDemande(d)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CarteRepliable>
        </div>
      )}
      </CarteRepliable>
    </div>
    </div>
  );
}
