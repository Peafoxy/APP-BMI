// ============================================================
// screens/Stocks.jsx — Gestion des stocks par boutique/dépôt,
// ajustements, réception de ravitaillement.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt } from "../components/ui";
import { imprimerBonRavitaillement, imprimerEtiquetteProduit } from "../lib/impression";
import {
  bloquerSiLecture, boutiquesVente, stockActuel, stockAjuste, stockVendu,
  demandesDe, demandesEnAttente, alertesBoutiques, estDepot, magasinsDe, trouverArticle, boutiquesVisibles,
} from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { DemandeRavitaillement, DemandesTransfertRecues } from "./Ravitaillement";

// ============ STOCKS ============
export function Stocks({ db, save, profile }) {
  const premiere = boutiquesVisibles(db, profile, boutiquesVente(db))[0]?.nom || db.boutiques[0]?.nom || "";
  // Un employé rattaché à un site (vendeur, gérant, magasinier) est VERROUILLÉ dessus :
  // il ne voit et ne modifie que le stock de sa boutique ou de son magasin.
  const [bqSel, setBqSel] = useState(profile.boutique || premiere);
  const bq = profile.boutique || bqSel;
  const [f, setF] = useState({ nom: "", categorie: "", fournisseur: "", initial: "", seuil: "", prix_achat: "", prix_vente: "", code: "", tension: "", garantie_boutique: "", garantie_fabricant: "", conditions_garantie: "", fiche_technique: "", notes: "" });
  const [autresInfosOuvert, setAutresInfosOuvert] = useState(false);
  // ⚠ TERRAIN (boutique virtuelle, sans stock) ne doit jamais apparaître
  // comme destination de transfert — corrigé suite au même bug que
  // BoutiqueTabs (Timo, capture Stocks).
  const autres = db.boutiques.filter((b) => !b.terrain).map((b) => b.nom).filter((n) => n !== bq);

  // ---- RAVITAILLEMENT : d'un magasin vers une boutique ----
  const estMagasin = estDepot(db, bq);
  const cibles = boutiquesVente(db).map((b) => b.nom).filter((n) => n !== bq);
  const [rav, setRav] = useState({ dest: "", categorie: "", produit_id: "", qte: "" });
  const [bon, setBon] = useState([]); // lignes du bon en préparation

  const dejaAuBon = (pid) => bon.reduce((s, l) => s + (l.produit_id === pid ? Number(l.qte) : 0), 0);

  const ajouterAuBon = () => {
    const p = db.produits.find((x) => x.id === rav.produit_id);
    const q = Number(rav.qte);
    if (!p) { uAlert("Choisissez un article."); return; }
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    const dispo = stockActuel(db, p) - dejaAuBon(p.id);
    if (q > dispo) { uAlert(`Stock insuffisant dans ${bq} : il reste ${dispo} « ${p.nom} ».`); return; }
    setBon((b) => [...b, { produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: q }]);
    setRav((r) => ({ ...r, produit_id: "", qte: "" }));
  };

  const validerBon = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!rav.dest) { uAlert("Choisissez la boutique à ravitailler."); return; }
    if (!bon.length) { uAlert("Ajoutez au moins un article au bon."); return; }
    const total = bon.reduce((s, l) => s + Number(l.qte), 0);
    if (!await uConfirm(`Valider le ravitaillement ?\n\n🏭 ${bq} → 🏪 ${rav.dest}\n${bon.length} article(s), ${total} unité(s) au total.\n\nLe stock sera déduit du magasin et ajouté à la boutique.`)) return;

    const ref = uid();
    const numero = `RAV-${today().replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
    let produits = db.produits;
    const ajusts = [];

    bon.forEach((l) => {
      const p = produits.find((x) => x.id === l.produit_id);
      let cible = produits.find((x) => x.boutique === rav.dest && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase());
      if (!cible) {
        // L'article n'existe pas encore dans la boutique : on le crée automatiquement
        cible = { id: uid(), boutique: rav.dest, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente, code: p.code || "", tension: p.tension || "" };
        produits = [...produits, cible];
      }
      ajusts.push({ id: uid(), date: today(), produit_id: p.id, boutique: bq, qte: -Number(l.qte), motif: `Ravitaillement ${numero} → ${rav.dest}`, par: profile.nom, ref, type: "ravitaillement" });
      ajusts.push({ id: uid(), date: today(), produit_id: cible.id, boutique: rav.dest, qte: Number(l.qte), motif: `Ravitaillement ${numero} ← ${bq}`, par: profile.nom, ref, type: "ravitaillement" });
    });

    // Si le bon répond à une demande, on la marque comme servie
    const boutiques = demandeEnCours
      ? db.boutiques.map((b) => (b.nom === demandeEnCours.boutique
          ? { ...b, demandes: demandesDe(b).map((x) => (x.id === demandeEnCours.d.id ? { ...x, statut: "servie", numero_bon: numero, traite_par: profile.nom, date_traitement: today() } : x)) }
          : b))
      : db.boutiques;

    save({ ...db, boutiques, produits, ajustements: [...ajusts, ...db.ajustements] },
      `Ravitaillement ${numero} : ${bq} → ${rav.dest} (${bon.length} article(s), ${total} unité(s))${demandeEnCours ? " — demande servie" : ""}`);
    setDemandeEnCours(null);

    imprimerBonRavitaillement({ numero, date: today(), par: profile.nom, source: bq, destination: rav.dest, lignes: bon }, db);
    setBon([]);
    setAAssocier([]);
    setAssoc({});
    setRav({ dest: rav.dest, categorie: "", produit_id: "", qte: "" });
  };

  // ---- CÔTÉ MAGASIN : demandes reçues + alertes des boutiques ----
  const demandesRecues = estMagasin ? demandesEnAttente(db) : [];
  const alertesDesBoutiques = estMagasin ? alertesBoutiques(db, stockActuel) : [];

  // Charge une demande dans le bon de ravitaillement en préparation.
  // La correspondance des noms est SOUPLE (accents, pluriel, espaces, casse).
  // Ce qui ne peut pas être associé automatiquement est proposé à la main.
  const preparerDepuisDemande = (dm) => {
    const monStock = db.produits.filter((x) => x.boutique === bq);
    const lignes = [];
    const aAssocier = [];
    dm.d.lignes.forEach((l) => {
      const p = trouverArticle(monStock, l.nom);
      if (!p) { aAssocier.push({ ...l, raison: "nom inconnu dans votre magasin" }); return; }
      const dispo = stockActuel(db, p);
      if (dispo <= 0) { aAssocier.push({ ...l, raison: `« ${p.nom} » est à 0 en stock` }); return; }
      lignes.push({ produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: Math.min(Number(l.qte), dispo) });
    });
    setRav((r) => ({ ...r, dest: dm.boutique, categorie: "", produit_id: "", qte: "" }));
    setBon(lignes);
    setDemandeEnCours(dm);
    setAAssocier(aAssocier);
  };

  const [demandeEnCours, setDemandeEnCours] = useState(null);
  const [aAssocier, setAAssocier] = useState([]);   // lignes demandées non reconnues
  const [assoc, setAssoc] = useState({});           // index de ligne -> id de l'article du magasin

  // Le magasinier dit lui-même : « ce qu'ils appellent X, chez moi c'est Y »
  const associerLigne = (i, l) => {
    const p = db.produits.find((x) => x.id === assoc[i]);
    if (!p) { uAlert("Choisissez l'article correspondant dans votre magasin."); return; }
    const dispo = stockActuel(db, p) - dejaAuBon(p.id);
    if (dispo <= 0) { uAlert(`« ${p.nom} » n'a plus de stock disponible.`); return; }
    const q = Math.min(Number(l.qte), dispo);
    setBon((b) => [...b, { produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: q }]);
    setAAssocier((a) => a.filter((_, j) => j !== i));
    setAssoc((a) => { const c = { ...a }; delete c[i]; return c; });
    if (q < Number(l.qte)) uAlert(`Stock limité : ${q} unité(s) ajoutée(s) au lieu de ${l.qte}.`);
  };

  const refuserDemande = async (dm) => {
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Motif du refus (visible par ${dm.boutique}) :`, "Rupture de stock");
    if (motif === null) return;
    save({
      ...db,
      boutiques: db.boutiques.map((b) => (b.nom === dm.boutique
        ? { ...b, demandes: demandesDe(b).map((x) => (x.id === dm.d.id ? { ...x, statut: "refusee", motif: motif.trim(), traite_par: profile.nom, date_traitement: today() } : x)) }
        : b))
    }, `Demande de ${dm.boutique} refusée : ${motif.trim()} (par ${profile.nom})`);
  };

  // ---- INVENTAIRE PHYSIQUE ----
  // On compte réellement les articles, l'app calcule l'écart et génère les ajustements.
  const [inv, setInv] = useState(null); // null = fermé, sinon { comptes: { [id]: "12" } }

  const ouvrirInventaire = () => {
    if (bloquerSiLecture(db, profile)) return;
    const liste0 = db.produits.filter((p) => p.boutique === bq);
    if (!liste0.length) { uAlert("Aucun article à inventorier sur ce site."); return; }
    setInv({ comptes: {} });
  };

  const ecartsInventaire = () => {
    if (!inv) return [];
    return db.produits.filter((p) => p.boutique === bq)
      .map((p) => {
        const brut = inv.comptes[p.id];
        if (brut === undefined || brut === "") return null;
        const theorique = stockActuel(db, p);
        const compte = Number(brut);
        return { p, theorique, compte, ecart: compte - theorique };
      })
      .filter(Boolean);
  };

  const validerInventaire = async () => {
    if (bloquerSiLecture(db, profile)) return;
    const lignes = ecartsInventaire();
    if (!lignes.length) { uAlert("Saisissez au moins une quantité comptée."); return; }
    const ecarts = lignes.filter((l) => l.ecart !== 0);
    const manquants = ecarts.filter((l) => l.ecart < 0);
    const excedents = ecarts.filter((l) => l.ecart > 0);
    const valeurEcart = ecarts.reduce((s, l) => s + l.ecart * Number(l.p.prix_achat || 0), 0);

    if (!ecarts.length) {
      if (await uConfirm(`✅ Aucun écart sur les ${lignes.length} article(s) comptés.\n\nEnregistrer quand même l'inventaire dans l'historique ?`)) {
        save({ ...db }, `Inventaire ${bq} : ${lignes.length} article(s) comptés, aucun écart (par ${profile.nom})`);
      }
      setInv(null);
      return;
    }

    const resume = ecarts.slice(0, 8).map((l) => `• ${l.p.nom} : théorique ${l.theorique}, compté ${l.compte} (${l.ecart > 0 ? "+" : ""}${l.ecart})`).join("\n");
    if (!await uConfirm(
      `📋 INVENTAIRE — ${bq}\n\n${lignes.length} article(s) comptés, ${ecarts.length} écart(s) :\n${manquants.length} manquant(s), ${excedents.length} excédent(s)\nValeur de l'écart : ${fmt(valeurEcart)}\n\n${resume}${ecarts.length > 8 ? `\n… et ${ecarts.length - 8} autre(s)` : ""}\n\nValider ? Le stock sera aligné sur le comptage (ajustements définitifs).`
    )) return;

    const ref = uid();
    const ajusts = ecarts.map((l) => ({
      id: uid(), date: today(), produit_id: l.p.id, boutique: bq, qte: l.ecart,
      motif: `Inventaire du ${dFR(today())} (théorique ${l.theorique} → compté ${l.compte})`,
      par: profile.nom, ref, type: "inventaire",
    }));
    save({ ...db, ajustements: [...ajusts, ...db.ajustements] },
      `Inventaire ${bq} : ${lignes.length} comptés, ${ecarts.length} écart(s), valeur ${fmt(valeurEcart)} (par ${profile.nom})`);
    setInv(null);
    uAlert(`✅ Inventaire validé. ${ecarts.length} ajustement(s) enregistré(s).`);
  };

  // Historique des ravitaillements (reconstruit à partir des ajustements)
  const historiqueRav = (() => {
    const groupes = {};
    (db.ajustements || []).filter((a) => a.type === "ravitaillement" && a.qte < 0 && a.boutique === bq).forEach((a) => {
      const m = String(a.motif || "").match(/^Ravitaillement (\S+) → (.+)$/);
      if (!m) return;
      const cle = a.ref || m[1];
      if (!groupes[cle]) groupes[cle] = { numero: m[1], dest: m[2], date: a.date, par: a.par, articles: 0, unites: 0 };
      groupes[cle].articles += 1;
      groupes[cle].unites += Math.abs(Number(a.qte));
    });
    return Object.values(groupes).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15);
  })();


  const ajouter = () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!f.nom) { uAlert("Veuillez saisir un nom d'article."); return; }
    save({ ...db, produits: [...db.produits, { id: uid(), boutique: bq, nom: f.nom, categorie: f.categorie || "Autre", fournisseur: f.fournisseur || "", initial: Number(f.initial || 0), entrees: 0, seuil: Number(f.seuil || 0), prix_achat: Number(f.prix_achat || 0), prix_vente: Number(f.prix_vente || 0), code: (f.code || "").trim(), tension: f.tension ? Number(f.tension) : "", garantie_boutique: (f.garantie_boutique || "").trim(), garantie_fabricant: (f.garantie_fabricant || "").trim(), conditions_garantie: (f.conditions_garantie || "").trim(), fiche_technique: (f.fiche_technique || "").trim(), notes: (f.notes || "").trim() }] }, `Nouvel article « ${f.nom} » — ${bq}${f.fournisseur ? ` (fournisseur : ${f.fournisseur})` : ""}`);
    setF({ nom: "", categorie: "", fournisseur: "", initial: "", seuil: "", prix_achat: "", prix_vente: "", code: "", tension: "", garantie_boutique: "", garantie_fabricant: "", conditions_garantie: "", fiche_technique: "", notes: "" });
    uAlert("Article ajouté !");
  };

  // Changer le fournisseur d'un article existant
  const changerFournisseur = async (p) => {
    if (bloquerSiLecture(db, profile)) return;
    const noms = (db.fournisseurs || []).map((x) => x.nom);
    if (!noms.length) { uAlert("Aucun fournisseur enregistré. Créez-le d'abord dans l'onglet 🚚 Fournisseurs."); return; }
    const v = await uPrompt(`Fournisseur de « ${p.nom} » ?\n\nFournisseurs enregistrés :\n${noms.join("\n")}\n\n(laisser vide pour retirer le fournisseur)`, p.fournisseur || "");
    if (v === null) return;
    const nom = v.trim();
    if (nom && !noms.some((n) => n.toLowerCase() === nom.toLowerCase())) { uAlert("Ce fournisseur n'existe pas. Créez-le d'abord dans 🚚 Fournisseurs."); return; }
    const exact = noms.find((n) => n.toLowerCase() === nom.toLowerCase()) || "";
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, fournisseur: exact } : x)) },
      exact ? `Fournisseur de « ${p.nom} » : ${exact}` : `Fournisseur retiré de « ${p.nom} »`);
  };

  const importerArticles = async () => {
    const texte = await uPrompt(
      "Collez les articles (un par ligne) :\nFormat : Nom, Catégorie, Initial, Seuil, PrixAchat, PrixVente\nExemple :\nPanneau Solaire 150W, Panneaux, 10, 3, 45000, 65000"
    );
    if (!texte) return;

    const lignes = texte.split("\n").filter(l => l.trim());
    const nouveaux = [];
    let erreurs = [];

    lignes.forEach((ligne, i) => {
      const parts = ligne.split(",").map(s => s.trim());
      if (parts.length >= 3) {
        nouveaux.push({
          id: uid(),
          boutique: bq,
          nom: parts[0],
          categorie: parts[1] || "Autre",
          initial: Number(parts[2]) || 0,
          entrees: 0,
          seuil: Number(parts[3]) || 0,
          prix_achat: Number(parts[4]) || 0,
          prix_vente: Number(parts[5]) || 0
        });
      } else {
        erreurs.push(`Ligne ${i+1} : format incorrect`);
      }
    });

    if (nouveaux.length === 0) {
      uAlert("Aucun article valide à importer.\n" + erreurs.join("\n"));
      return;
    }

    if (await uConfirm(`Importer ${nouveaux.length} articles ?${erreurs.length ? `\n${erreurs.length} erreurs ignorées.` : ""}`)) {
      save({ ...db, produits: [...db.produits, ...nouveaux] }, `Import de ${nouveaux.length} articles — ${bq}`);
      uAlert(`${nouveaux.length} articles importés avec succès !`);
    }
  };

  const reappro = async (p) => {
    const s = await uPrompt(`Quantité reçue pour « ${p.nom} » :`);
    const q = Number(s);
    if (!s || isNaN(q) || q <= 0) return;
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, entrees: Number(x.entrees) + q } : x)) }, `Entrée stock +${q} « ${p.nom} » — ${bq}`);
    uAlert(`${q} ${p.nom} ajoutés au stock !`);
  };

  const ajuster = async (p) => {
    const s = await uPrompt(`Ajustement d'inventaire pour « ${p.nom} »\nQuantité (+ pour ajouter, − pour retirer, ex : -2) :`);
    const q = Number(s);
    if (!s || isNaN(q) || q === 0) return;
    const motif = await uPrompt("Motif :") || "Ajustement";
    save({ ...db, ajustements: [{ id: uid(), date: today(), produit_id: p.id, boutique: p.boutique, qte: q, motif, par: profile.nom }, ...db.ajustements] }, `Ajustement ${q > 0 ? "+" + q : q} « ${p.nom} » (${motif}) — ${p.boutique}`);
    uAlert("Ajustement enregistré !");
  };

  const transferer = async (p) => {
    const dispo = stockActuel(db, p);
    let dest = autres[0];
    if (autres.length > 1) {
      dest = await uPrompt(`Vers quelle boutique ? (${autres.join(" / ")})`);
      if (!dest || !autres.includes(dest.trim().toUpperCase())) { uAlert("Boutique de destination invalide."); return; }
      dest = dest.trim().toUpperCase();
    }
    if (!dest) { uAlert("Aucune autre boutique disponible."); return; }
    const s = await uPrompt(`Transfert de « ${p.nom} » : ${bq} → ${dest}\nQuantité (disponible : ${dispo}) :`);
    const q = Number(s);
    if (!s || isNaN(q) || q <= 0) return;
    if (q > dispo) { uAlert(`Stock insuffisant : il reste ${dispo}.`); return; }
    let produits = db.produits;
    let cible = produits.find((x) => x.boutique === dest && x.nom.trim().toLowerCase() === p.nom.trim().toLowerCase());
    if (!cible) {
      cible = { id: uid(), boutique: dest, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente, tension: p.tension || "" };
      produits = [...produits, cible];
    }
    save({ ...db, produits, ajustements: [
      { id: uid(), date: today(), produit_id: p.id, boutique: bq, qte: -q, motif: `Transfert vers ${dest}`, par: profile.nom },
      { id: uid(), date: today(), produit_id: cible.id, boutique: dest, qte: q, motif: `Transfert depuis ${bq}`, par: profile.nom },
      ...db.ajustements] }, `Transfert ${q} « ${p.nom} » : ${bq} → ${dest}`);
    uAlert(`Transfert de ${q} ${p.nom} vers ${dest} effectué !`);
  };

  const supprimer = async (p) => {
    // Suppression d'un article : ADMINISTRATEUR UNIQUEMENT.
    // Le magasinier et le gérant peuvent entrer du stock et l'ajuster, jamais l'effacer.
    if (profile.role !== "admin") { uAlert("🔒 Seul l'administrateur peut supprimer un article. Vous pouvez ajuster le stock (± Ajuster) en indiquant le motif."); return; }
    if (bloquerSiLecture(db, profile)) return;
    if (stockVendu(db, p.id) > 0) { uAlert("Cet article a des ventes enregistrées : impossible de le supprimer."); return; }
    if (await uConfirm(`Supprimer « ${p.nom} » ?`)) save({ ...db, produits: db.produits.filter((x) => x.id !== p.id) }, `Suppression article « ${p.nom} » — ${bq}`);
  };

  const definirCode = async (p) => {
    const c = await uPrompt(`Code-barres de « ${p.nom} » (scannez dans le champ) :`, p.code || "");
    if (c === null) return;
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, code: c.trim() } : x)) }, `Code-barres « ${p.nom} » : ${c.trim() || "retiré"} — ${bq}`);
  };

  // Étiquette imprimable avec code-barres RÉEL (scannable), généré à la
  // demande — jamais automatiquement à la création de l'article. Un
  // article garde TOUJOURS le même code, quelle que soit la quantité en
  // stock : ce n'est pas un numéro de série par exemplaire, juste
  // l'identifiant du modèle (comme sur l'emballage en magasin). Si le
  // produit a déjà un code, on le réutilise tel quel sans y toucher.
  const imprimerEtiquette = async (p) => {
    let code = (p.code || "").trim();
    if (!code) {
      code = ("ART" + p.id).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, code } : x)) }, `Code-barres généré pour « ${p.nom} » : ${code} — ${bq}`);
    }
    if (!imprimerEtiquetteProduit({ ...p, code })) uAlert("Impossible de générer ce code-barres (caractères non pris en charge).");
  };

  const liste = db.produits.filter((p) => p.boutique === bq);
  // Filtres d'affichage du tableau (catégories cliquables + recherche par
  // nom + fenêtre limitée à 7 lignes) — même mécanique déjà éprouvée que
  // l'écran Utilisateurs. N'affecte QUE l'affichage : l'inventaire et les
  // autres opérations continuent d'utiliser la liste complète de la
  // boutique, jamais ce sous-ensemble filtré/limité.
  const [categorieActive, setCategorieActive] = useState("");
  const [rechercheStock, setRechercheStock] = useState("");
  const categoriesPresentes = [...new Set(liste.map((p) => p.categorie || "Autre"))].sort();
  const nbParCategorie = Object.fromEntries(categoriesPresentes.map((c) => [c, liste.filter((p) => (p.categorie || "Autre") === c).length]));
  const qStock = rechercheStock.trim().toLowerCase();
  const enRechercheStock = qStock.length > 0;
  const categorieAffichee = categorieActive && categoriesPresentes.includes(categorieActive) ? categorieActive : (categoriesPresentes[0] || "");
  const listeAffichee = enRechercheStock
    ? liste.filter((p) => p.nom.toLowerCase().includes(qStock))
    : liste.filter((p) => (p.categorie || "Autre") === categorieAffichee);
  const mouvements = (db.ajustements || []).filter((a) => a.boutique === bq).slice(0, 20);
  const nomProduit = (pid) => db.produits.find((p) => p.id === pid)?.nom || "?";

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBqSel} avecDepots profile={profile} />}
      {profile.boutique && (
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <span>{estMagasin ? "🏭 Magasin" : "🏪 Boutique"} :</span> <Badge boutique={bq} />
        </div>
      )}

      {/* Espace personnel du responsable du site : l'état de SON stock, rien d'autre */}
      {(() => {
        const mesArticles = db.produits.filter((p) => p.boutique === bq);
        const unites = mesArticles.reduce((s, p) => s + stockActuel(db, p), 0);
        const valeur = mesArticles.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_achat || 0), 0);
        const alertes = mesArticles.filter((p) => stockActuel(db, p) <= Number(p.seuil || 0)).length;
        const moisCourant = today().slice(0, 7);
        const sorties = (db.ajustements || []).filter((a) => a.type === "ravitaillement" && a.boutique === bq && a.qte < 0 && String(a.date).startsWith(moisCourant))
          .reduce((s, a) => s + Math.abs(Number(a.qte)), 0);
        const Case = ({ label, valeur: v, couleur }) => (
          <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
            <div className="text-xl font-bold tabular-nums mt-1">{v}</div>
          </div>
        );
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Case label="Articles référencés" valeur={mesArticles.length} couleur="border-l-sky-700" />
            <Case label="Unités en stock" valeur={unites} couleur="border-l-slate-500" />
            <Case label="Valeur du stock" valeur={fmt(valeur)} couleur="border-l-green-700" />
            <Case label="À réapprovisionner" valeur={<span className={alertes ? "text-red-600" : "text-green-700"}>{alertes}</span>} couleur={alertes ? "border-l-red-500" : "border-l-green-600"} />
            {estMagasin && <Case label="Sorties ce mois" valeur={<span className="text-purple-700">{sorties}</span>} couleur="border-l-purple-600" />}
          </div>
        );
      })()}

      <DemandesTransfertRecues db={db} save={save} profile={profile} boutique={bq} />

      {estMagasin && demandesRecues.length > 0 && (
        <div className="rounded-xl p-4 bg-white border-2 border-blue-300">
          <div className="font-bold mb-1 text-blue-800">📥 Demandes des boutiques ({demandesRecues.length})</div>
          <div className="text-xs text-slate-500 mb-3">Cliquez sur « Préparer le bon » : les articles demandés sont chargés automatiquement dans le bon de ravitaillement ci-dessous.</div>
          <div className="space-y-3">
            {demandesRecues.map((dm) => (
              <div key={dm.d.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-800">🏪 {dm.boutique} <span className="text-xs font-normal text-slate-500">— demandé par {dm.d.par} le {dFR(dm.d.date)}</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => preparerDepuisDemande(dm)} className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800">📋 Préparer le bon</button>
                    <button onClick={() => refuserDemande(dm)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Refuser</button>
                  </div>
                </div>
                <ul className="mt-2 text-sm text-slate-700 list-disc pl-5">
                  {dm.d.lignes.map((l, i) => <li key={i}><b>{l.qte}</b> × {l.nom}{l.categorie ? ` (${l.categorie})` : ""}</li>)}
                </ul>
                {dm.d.note && <div className="mt-1 text-xs italic text-slate-500">« {dm.d.note} »</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {estMagasin && alertesDesBoutiques.length > 0 && (
        <div className="rounded-xl p-4 bg-white border-2 border-red-200">
          <div className="font-bold mb-1 text-red-700">⚠ Alertes de stock dans les boutiques ({alertesDesBoutiques.length})</div>
          <div className="text-xs text-slate-500 mb-3">Articles passés sous leur seuil. Anticipez le ravitaillement sans attendre la demande.</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Boutique", "Article", "Reste", "Seuil"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {alertesDesBoutiques.slice(0, 20).map(({ p, actuel }) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2"><Badge boutique={p.boutique} /></td>
                    <td className="px-3 py-2 font-semibold">{p.nom}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${actuel <= 0 ? "text-red-600" : "text-orange-600"}`}>{actuel}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{p.seuil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {estMagasin && (
        <div className="rounded-xl p-4 bg-white border-2 border-purple-200">
          <div className="font-bold mb-1 text-purple-800">🚚 Ravitailler une boutique depuis 🏭 {bq}</div>
          {demandeEnCours && (
            <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800">
              📋 Ce bon répond à la demande de {demandeEnCours.boutique} — elle sera marquée « servie » à la validation.
              <button onClick={() => { setDemandeEnCours(null); setAAssocier([]); }} className="ml-2 underline font-normal">détacher</button>
            </div>
          )}

          {aAssocier.length > 0 && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-300 p-3">
              <div className="font-bold text-sm text-amber-800 mb-1">🔎 {aAssocier.length} article(s) à associer</div>
              <div className="text-xs text-amber-700 mb-3">La boutique les a nommés autrement, ou ils sont à zéro chez vous. Indiquez à quel article de VOTRE magasin cela correspond — ou ignorez la ligne.</div>
              <div className="space-y-2">
                {aAssocier.map((l, i) => (
                  <div key={i} className="rounded-lg bg-white border border-amber-200 p-2 grid sm:grid-cols-3 gap-2 items-end">
                    <div className="text-sm">
                      <div className="font-bold text-slate-800">{l.qte} × {l.nom}</div>
                      <div className="text-xs text-slate-500">{l.raison}</div>
                    </div>
                    <select className={inputCls} value={assoc[i] || ""} onChange={(e) => setAssoc({ ...assoc, [i]: e.target.value })}>
                      <option value="">— Article correspondant dans mon magasin —</option>
                      {db.produits.filter((p) => p.boutique === bq).map((p) => {
                        const d = stockActuel(db, p) - dejaAuBon(p.id);
                        return <option key={p.id} value={p.id} disabled={d <= 0}>{p.nom} (dispo : {d})</option>;
                      })}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => associerLigne(i, l)} className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">Associer</button>
                      <button onClick={() => setAAssocier(aAssocier.filter((_, j) => j !== i))} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50">Ignorer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-500 mb-4">Préparez le bon, validez : le stock sort du magasin, entre en boutique, et le bon s'imprime.</div>

          {cibles.length === 0 ? (
            <div className="text-sm text-slate-400">Aucune boutique de vente disponible. Créez-en une dans ⚙ Paramètres.</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Field label="Boutique à ravitailler">
                  <select className={inputCls} value={rav.dest} onChange={(e) => setRav({ ...rav, dest: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {cibles.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Catégorie">
                  <select className={inputCls} value={rav.categorie} onChange={(e) => setRav({ ...rav, categorie: e.target.value, produit_id: "" })}>
                    <option value="">— Toutes —</option>
                    {[...new Set(db.produits.filter((p) => p.boutique === bq).map((p) => p.categorie || "Autre"))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Article du magasin">
                  <select className={inputCls} value={rav.produit_id} onChange={(e) => setRav({ ...rav, produit_id: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {db.produits.filter((p) => p.boutique === bq && (!rav.categorie || (p.categorie || "Autre") === rav.categorie)).map((p) => {
                      const d = stockActuel(db, p) - dejaAuBon(p.id);
                      return <option key={p.id} value={p.id} disabled={d <= 0}>{p.nom} (dispo : {d})</option>;
                    })}
                  </select>
                </Field>
                <Field label="Quantité">
                  <input type="number" min="1" className={inputCls} value={rav.qte} onChange={(e) => setRav({ ...rav, qte: e.target.value })} />
                </Field>
                <div className="flex items-end">
                  <button onClick={ajouterAuBon} className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter au bon</button>
                </div>
              </div>

              {bon.length > 0 && (
                <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <div className="font-bold text-sm text-purple-900 mb-2">Bon en préparation — {bq} → {rav.dest || "…"}</div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-2 py-1">Article</th><th className="text-left px-2 py-1">Quantité</th><th></th></tr></thead>
                    <tbody>
                      {bon.map((l, i) => (
                        <tr key={i} className="border-t border-purple-100">
                          <td className="px-2 py-1 font-semibold">{l.nom}</td>
                          <td className="px-2 py-1 tabular-nums">{l.qte}</td>
                          <td className="px-2 py-1 text-right"><button onClick={() => setBon(bon.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button></td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-purple-300 font-bold">
                        <td className="px-2 py-1">TOTAL</td>
                        <td className="px-2 py-1 tabular-nums">{bon.reduce((s, l) => s + Number(l.qte), 0)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={validerBon} className="px-5 py-2 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800">✅ Valider le ravitaillement</button>
                    <button onClick={() => setBon([])} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Vider le bon</button>
                  </div>
                </div>
              )}

              {historiqueRav.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Derniers ravitaillements depuis ce magasin</div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase">{["N°", "Date", "Boutique", "Articles", "Unités", "Par"].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                    <tbody>
                      {historiqueRav.map((r) => (
                        <tr key={r.numero} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono text-xs">{r.numero}</td>
                          <td className="px-2 py-1">{dFR(r.date)}</td>
                          <td className="px-2 py-1"><Badge boutique={r.dest} /></td>
                          <td className="px-2 py-1 tabular-nums">{r.articles}</td>
                          <td className="px-2 py-1 tabular-nums font-bold">{r.unites}</td>
                          <td className="px-2 py-1 text-xs text-slate-500">{r.par}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!estMagasin && magasinsDe(db).length > 0 && <DemandeRavitaillement db={db} save={save} profile={profile} boutique={bq} />}

      <Panel boutique={bq}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvel article <Badge boutique={bq} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-8 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Fournisseur">
            <select className={inputCls} value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })}>
              <option value="">— Aucun —</option>
              {(db.fournisseurs || []).map((x) => <option key={x.id} value={x.nom}>{x.nom}</option>)}
            </select>
          </Field>
          <Field label="Catégorie">
            <input className={inputCls} list="liste-categories" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} placeholder="Ex : Panneaux..." />
            <datalist id="liste-categories">{[...new Set(db.produits.map((p) => p.categorie).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Initial"><input type="number" className={inputCls} value={f.initial} onChange={(e) => setF({ ...f, initial: e.target.value })} /></Field>
          <Field label="Seuil"><input type="number" className={inputCls} value={f.seuil} onChange={(e) => setF({ ...f, seuil: e.target.value })} /></Field>
          <Field label="Prix achat (F)"><input type="number" className={inputCls} value={f.prix_achat} onChange={(e) => setF({ ...f, prix_achat: e.target.value })} /></Field>
          <Field label="Prix vente (F)"><input type="number" className={inputCls} value={f.prix_vente} onChange={(e) => setF({ ...f, prix_vente: e.target.value })} /></Field>
          <Field label="Code-barres (facultatif)"><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Scannez ou tapez" /></Field>
          {/* Champ Tension : uniquement utile pour une batterie ou un
              convertisseur — masqué pour toute autre catégorie d'article
              (demande Timo : « il y a beaucoup d'autres produits qui ne
              demandent pas ce champ »). Reconnaissance par mots-clés dans
              la catégorie saisie, les mêmes que ceux utilisés pour
              proposer les équipements en dimensionnement. */}
          {/(batterie|battery|lifepo4|lithium|convertisseur|onduleur|inverter|inverseur)/i.test((f.categorie || "").trim()) && (
            <Field label="Tension — batterie/convertisseur (facultatif)">
              <select className={inputCls} value={f.tension} onChange={(e) => setF({ ...f, tension: e.target.value })}>
                <option value="">— Non applicable —</option>
                <option value="12">12V</option>
                <option value="24">24V</option>
                <option value="48">48V</option>
              </select>
            </Field>
          )}
        </div>

        {/* MODULE GARANTIES — bouton "Autres informations" pour ne pas
            surcharger la fiche produit (demande Timo, après discussion avec
            ChatGPT sur la spec) : garantie boutique (affichée sur reçu/
            facture, à côté du nom de l'article, uniquement si renseignée),
            garantie fabricant (utilisée pour devis/contrat/SAV, jamais sur
            le reçu), conditions, fiche technique, notes internes. */}
        <button type="button" onClick={() => setAutresInfosOuvert(!autresInfosOuvert)} className="mt-3 text-xs font-bold text-sky-800 underline">
          {autresInfosOuvert ? "▾" : "▸"} Autres informations (garanties, notes...)
        </button>
        {autresInfosOuvert && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Field label="🏪 Garantie boutique — affichée sur reçu/facture">
              <input className={inputCls} value={f.garantie_boutique} onChange={(e) => setF({ ...f, garantie_boutique: e.target.value })} placeholder="Ex : 12 mois" />
            </Field>
            <Field label="🏭 Garantie fabricant — pour devis/contrat/SAV">
              <input className={inputCls} value={f.garantie_fabricant} onChange={(e) => setF({ ...f, garantie_fabricant: e.target.value })} placeholder="Ex : 10 ans" />
            </Field>
            <Field label="📄 Conditions de garantie (facultatif)">
              <input className={inputCls} value={f.conditions_garantie} onChange={(e) => setF({ ...f, conditions_garantie: e.target.value })} placeholder="Ex : hors casse, hors surtension..." />
            </Field>
            <Field label="🔗 Fiche technique — lien (facultatif)">
              <input className={inputCls} value={f.fiche_technique} onChange={(e) => setF({ ...f, fiche_technique: e.target.value })} placeholder="https://..." />
            </Field>
            <Field label="📝 Notes internes (facultatif)">
              <input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
          </div>
        )}
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={ajouter} className={btnDark}>Ajouter</button>
          <button onClick={importerArticles} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700">📥 Importation rapide</button>
        </div>
      </Panel>

      {inv && (
        <div className="rounded-xl p-4 bg-white border-2 border-emerald-300">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="font-bold text-emerald-800">📋 Inventaire physique — {bq}</div>
            <div className="text-xs text-slate-500">{ecartsInventaire().length} / {db.produits.filter((p) => p.boutique === bq).length} article(s) comptés</div>
          </div>
          <div className="text-xs text-slate-500 mb-3">Comptez les articles un par un et saisissez la quantité réelle. Laissez vide ce que vous ne comptez pas.</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Stock théorique", "Quantité comptée", "Écart", "Valeur écart"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {db.produits.filter((p) => p.boutique === bq).map((p) => {
                  const th = stockActuel(db, p);
                  const brut = inv.comptes[p.id];
                  const saisi = brut !== undefined && brut !== "";
                  const ec = saisi ? Number(brut) - th : 0;
                  return (
                    <tr key={p.id} className={`border-t border-slate-100 ${saisi && ec !== 0 ? (ec < 0 ? "bg-red-50" : "bg-amber-50") : ""}`}>
                      <td className="px-3 py-2 font-semibold">{p.nom}</td>
                      <td className="px-3 py-2 tabular-nums">{th}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          value={brut ?? ""} onChange={(e) => setInv({ comptes: { ...inv.comptes, [p.id]: e.target.value } })} />
                      </td>
                      <td className={`px-3 py-2 tabular-nums font-bold ${!saisi ? "text-slate-300" : ec === 0 ? "text-green-700" : ec < 0 ? "text-red-600" : "text-amber-600"}`}>
                        {!saisi ? "—" : ec === 0 ? "✅ 0" : (ec > 0 ? "+" : "") + ec}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${ec < 0 ? "text-red-600" : "text-slate-500"}`}>
                        {saisi && ec !== 0 ? fmt(ec * Number(p.prix_achat || 0)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={validerInventaire} className="px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">✅ Valider l'inventaire</button>
            <button onClick={() => setInv(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-bold text-slate-800">Stocks — {bq}</span>
            {!inv && <button onClick={ouvrirInventaire} className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800">📋 Faire l'inventaire</button>}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categoriesPresentes.map((c) => (
              <button key={c} onClick={() => { setCategorieActive(c); setRechercheStock(""); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${!enRechercheStock && categorieAffichee === c ? "bg-sky-800 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
                {c} ({nbParCategorie[c]})
              </button>
            ))}
          </div>
          <input value={rechercheStock} onChange={(e) => setRechercheStock(e.target.value)}
            placeholder="🔍 Rechercher un article par son nom (toutes catégories confondues)…" className={inputCls} />
          {enRechercheStock && <div className="mt-1 text-xs font-semibold text-slate-500">{listeAffichee.length} résultat(s) dans toutes les catégories</div>}
        </div>
        <div className="max-h-[380px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Article", "Fournisseur", "Catégorie", "Code", "Initial", "Entrées", "Vendus", "Ajust.", "Stock", "Seuil", "État", "P. achat", "P. vente", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {listeAffichee.length === 0 && <tr><td colSpan={14} className="px-4 py-6 text-center text-slate-400">{enRechercheStock ? "Aucun article ne correspond à cette recherche." : "Aucun article dans cette catégorie."}</td></tr>}
            {listeAffichee.map((p) => {
              const vendu = stockVendu(db, p.id), aj = stockAjuste(db, p.id), actuel = stockActuel(db, p), al = actuel <= Number(p.seuil);
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${al ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => changerFournisseur(p)} className={`text-xs font-semibold underline ${p.fournisseur ? "text-slate-600" : "text-slate-400"}`}>
                      {p.fournisseur || "— Définir —"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.categorie || "Autre"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.code || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.initial}</td>
                  <td className="px-3 py-2 tabular-nums">{p.entrees}</td>
                  <td className="px-3 py-2 tabular-nums">{vendu}</td>
                  <td className={`px-3 py-2 tabular-nums ${aj < 0 ? "text-red-600" : ""}`}>{aj > 0 ? "+" + aj : aj || 0}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{actuel}</td>
                  <td className="px-3 py-2 tabular-nums">{p.seuil}</td>
                  <td className="px-3 py-2">{al ? <span className="text-xs font-bold text-red-600">⚠ Réappro.</span> : <span className="text-xs font-bold text-green-700">OK</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(p.prix_achat)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(p.prix_vente)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => definirCode(p)} className="text-xs font-bold text-sky-800 underline mr-2">Code</button>
                    <button onClick={() => imprimerEtiquette(p)} className="text-xs font-bold text-sky-800 underline mr-2">🖨 Étiquette</button>
                    <button onClick={() => reappro(p)} className="text-xs font-bold text-sky-800 underline mr-2">+ Entrée</button>
                    <button onClick={() => ajuster(p)} className="text-xs font-bold text-sky-800 underline mr-2">± Ajuster</button>
                    <button onClick={() => transferer(p)} className="text-xs font-bold text-blue-700 underline mr-2">⇄ Transfert</button>
                    {profile.role === "admin" && <button onClick={() => supprimer(p)} className="text-xs text-red-600 underline">Suppr.</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Derniers mouvements — {bq}</div>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Article", "Qté", "Motif", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mouvements.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucun mouvement.</td></tr>}
            {mouvements.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2">{dFR(a.date)}</td>
                <td className="px-3 py-2 font-semibold">{nomProduit(a.produit_id)}</td>
                <td className={`px-3 py-2 tabular-nums font-bold ${a.qte < 0 ? "text-red-600" : "text-green-700"}`}>{a.qte > 0 ? "+" + a.qte : a.qte}</td>
                <td className="px-3 py-2">{a.motif}</td>
                <td className="px-3 py-2">{a.par}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

