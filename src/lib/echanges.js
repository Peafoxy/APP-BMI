// ============================================================
// lib/echanges.js — 🔄 ÉCHANGER UN ARTICLE VENDU CONTRE UN AUTRE (14/10/2026)
//
// Timo : « est-ce possible de ramener un article et prendre un autre à sa
// place ? D'une manière que le client ajoute l'argent si le nouvel article
// est plus cher, ou que BMI restitue l'argent si le nouvel article est moins
// cher » → « A c, B c, C b, D non, lance ».
//   • « A c » : les deux situations — le client change d'avis, ou l'article
//     est défectueux ;
//   • « B c » : à chaque échange on choisit où va l'article rendu : le stock
//     normal (bon état, revendable) ou le stock SAV (défectueux, jamais
//     revendu — renvoi au fournisseur ou rebut, comme un retour sous garantie) ;
//   • « C b » : le gérant et l'administrateur (`ROLES_ECHANGE`) ;
//   • « D non » : jamais à crédit — le complément se paie sur-le-champ.
//
// CE QUE FAIT UN ÉCHANGE — et « la différence, et seulement elle, bouge dans
// la caisse » :
//   • l'ANCIENNE vente garde son reçu, sa date, son total ; l'article rendu y
//     est noté comme une reprise marquée `echange` (rembourse 0 : son argent
//     n'est PAS rendu, il PAIE le nouvel article). Son chiffre d'affaires et
//     sa commission deviennent nets (caVente, lib/core.js) ;
//   • une NOUVELLE vente (nouveau numéro de reçu, la date du jour, le prix du
//     jour, aucune remise) porte le nouvel article, `echange_de` (le reçu
//     d'origine) et `avoir_echange` = la part payée par l'article rendu.
//     `montantEncaisseVente` (lib/versements.js) retire cet avoir : le tiroir,
//     la clôture, les comptes mobiles ne voient QUE le complément ;
//   • nouvel article plus cher → le client paie la différence (moyen choisi,
//     jamais à crédit) ; moins cher → BMI rend la différence par une sortie
//     « Rendu sur échange » de la caisse de la vente (pas une charge : le
//     chiffre d'affaires a déjà été réduit) ; même prix → aucun argent ;
//   • l'article rendu revient au stock (ajustement `echange_client`) ou entre
//     au SAV (ajustement `retour_defectueux`, quantité vendable 0).
// Refusé : vente dont la dette n'est pas soldée (« D non » : l'article rendu
// n'est pas encore payé), vente qui a créé un chantier, dépôt chantier,
// travaux à crédit, commission déjà payée.
// Serveur : securite-40 (reprises marquées `echange` = gérant / admin ;
// `avoir_echange` posé à la création seulement, par eux).
// ============================================================
import { uid, today, heureCourte, numeroRecu, prochainNumeroVente, nouvelleDepense, totalVente } from "./core";
import { MOYENS_ENCAISSEMENT, CATEGORIE_RENDU_ECHANGE, caisseDeVente } from "./constants";
import { lignesReprenables, montantReprise, lignesDuChoix, critiqueReprise } from "./reprises";

export const ROLES_ECHANGE = ["gerant", "admin"];
export const TYPE_ECHANGE_CLIENT = "echange_client";
export const TYPE_ECHANGE_SAV = "retour_defectueux";
export const DESTINATION_STOCK = "stock";
export const DESTINATION_SAV = "sav";
export { CATEGORIE_RENDU_ECHANGE };
export const peutEchanger = (profile) => ROLES_ECHANGE.includes(profile?.role);

// Une ligne de reprise née d'un échange (l'argent n'a pas été rendu).
export const estRepriseEchange = (r) => !!r?.echange;
// Ce que les reprises ORDINAIRES ont pris à une vente (l'argent rendu ou la
// dette réduite) — les échanges, eux, ont payé un autre article.
export const montantReprisHorsEchange = (v) => (Array.isArray(v?.reprises) ? v.reprises : [])
  .filter((r) => !estRepriseEchange(r)).reduce((s, r) => s + Number(r.montant || 0), 0);

// Les échanges d'une vente, lus pour l'écran (Timo, 14/10/2026 : « l'échange a
// rendu 45 000 au client… pourquoi −110 000 ? » — la ligne ne disait que la
// valeur de l'article rendu, sans dire où elle était partie). UN par échange :
// la valeur rendue, le nouveau reçu (ce qui a payé le nouvel article), et
// l'argent qui a bougé (rendu au client, ou payé en plus).
// `ventes` = la liste déjà filtrée par l'écran (le mur). La vente née d'un
// échange se rend aussi elle-même (son reçu EST le document de l'échange).
export function echangesDeLaVente(ventes, vente) {
  const liste = Array.isArray(ventes) ? ventes : [];
  const lire = (nv, ref, valeur) => {
    const avoir = Number(nv?.avoir_echange || 0);
    const total = nv ? totalVente(nv) : 0;
    return { ref, valeur, nouvelle: nv || null, numero: nv?.numero || "", total,
      rendu: Number(nv?.echange_de?.rendu || 0), paye: nv ? Math.max(0, total - avoir) : 0 };
  };
  if (vente?.echange_de) return [lire(vente, vente.echange_de.ref || "", Number(vente.echange_de.valeur_rendue || 0))];
  const groupes = new Map();
  (Array.isArray(vente?.reprises) ? vente.reprises : []).filter(estRepriseEchange).forEach((r) => {
    const cle = r.echange_vente_id || r.ref;
    const g = groupes.get(cle) || { ref: r.ref, id: r.echange_vente_id, numero: r.echange_numero, valeur: 0 };
    g.valeur += Number(r.montant || 0);
    groupes.set(cle, g);
  });
  return [...groupes.values()].map((g) => {
    const e = lire(liste.find((v) => v.id === g.id), g.ref, g.valeur);
    return e.numero ? e : { ...e, numero: g.numero || "" };
  });
}

// Le choix : { rendus: [{ produit_id, qte }], nouveaux: [{ produit_id, qte }],
// destination: "stock" | "sav", motif, moyen }.
const nouveauxDuChoix = (choix) => (Array.isArray(choix?.nouveaux) ? choix.nouveaux : [])
  .map((l) => ({ produit_id: l?.produit_id, qte: Math.floor(Number(l?.qte || 0)) }))
  .filter((l) => l.produit_id && l.qte !== 0);

// Les deux valeurs et la différence (aperçu de l'écran ET geste : UNE formule).
// `produits` = les articles de la boutique de la vente.
export function chiffresEchange(vente, choix, produits) {
  const rendus = lignesDuChoix({ lignes: choix?.rendus }).map((l) => {
    const ligne = lignesReprenables(vente).find((x) => x.produit_id === l.produit_id);
    return ligne ? { produit_id: l.produit_id, article: ligne.article, qte: l.qte, montant: l.qte >= 1 && l.qte <= ligne.restant ? montantReprise(vente, ligne, l.qte) : 0 } : null;
  }).filter(Boolean);
  const nouveaux = nouveauxDuChoix(choix).map((l) => {
    const p = (produits || []).find((x) => x.id === l.produit_id);
    return p ? { produit_id: p.id, article: p.nom, qte: l.qte, pu: Number(p.prix_vente || 0), montant: l.qte > 0 ? l.qte * Number(p.prix_vente || 0) : 0 } : null;
  }).filter(Boolean);
  const valeurRendue = rendus.reduce((s, l) => s + l.montant, 0);
  const valeurNouvelle = nouveaux.reduce((s, l) => s + l.montant, 0);
  const difference = valeurNouvelle - valeurRendue;
  return {
    rendus, nouveaux, valeurRendue, valeurNouvelle, difference,
    aPayer: Math.max(0, difference), aRendre: Math.max(0, -difference),
    avoir: Math.min(valeurRendue, valeurNouvelle),
  };
}

// "" si l'échange est possible, sinon le motif du refus.
// `stock(p)` = le stock vendable d'un article (stockActuel de l'écran).
export function critiqueEchange(db, vente, choix, { produits = [], stock = () => 0, profile } = {}) {
  if (!vente) return "Vente introuvable.";
  if (profile && !peutEchanger(profile)) return "🔒 L'échange d'un article est réservé au gérant et à l'administrateur.";
  if (vente.depot_chantier) return "Un dépôt chantier ne s'échange pas : le matériel n'est pas encore sorti du stock.";
  if (vente.travaux_id) return "Une facture de travaux à crédit ne s'échange pas ici : passez par 🛠 Travaux.";
  const dette = (db.dettes || []).find((d) => d.vente_id === vente.id);
  if (dette && Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0)) > 0) {
    return `La dette de cette vente n'est pas soldée (il reste ${Math.max(0, Number(dette.montant || 0) - Number(dette.paye || 0))} F) : l'article rendu n'est pas encore payé. Faites régler la dette d'abord (📋 Dettes), ou passez par une reprise.`;
  }
  // Les refus de la reprise (chantier, commission payée, quantités) — UNE règle.
  const refus = critiqueReprise(db, vente, { lignes: choix?.rendus, motif: choix?.motif || "-", moyen: "Espèces" });
  if (refus) return refus.replace("Indiquez la quantité reprise d'au moins un article.", "Indiquez la quantité rendue d'au moins un article.");
  if (![DESTINATION_STOCK, DESTINATION_SAV].includes(choix?.destination)) return "Dites où va l'article rendu : au stock (bon état) ou au SAV (défectueux).";
  const nouveaux = nouveauxDuChoix(choix);
  if (!nouveaux.length) return "Choisissez le nouvel article que le client emporte.";
  const vus = new Set();
  for (const l of nouveaux) {
    if (vus.has(l.produit_id)) return "Un même nouvel article apparaît deux fois : une seule quantité par article.";
    vus.add(l.produit_id);
    const p = (produits || []).find((x) => x.id === l.produit_id);
    if (!p) return `Le nouvel article doit venir du stock de ${vente.boutique}.`;
    if (!(l.qte >= 1)) return `Quantité invalide pour « ${p.nom} ».`;
    if (!(Number(p.prix_vente || 0) > 0)) return `« ${p.nom} » n'a pas de prix de vente : réglez-le d'abord dans 📦 Stocks.`;
    // Un article rendu au stock compte dans le stock disponible (même article échangé).
    const rendu = choix.destination === DESTINATION_STOCK
      ? lignesDuChoix({ lignes: choix?.rendus }).filter((r) => r.produit_id === p.id).reduce((s, r) => s + r.qte, 0) : 0;
    const dispo = Number(stock(p) || 0) + rendu;
    if (l.qte > dispo) return `Stock insuffisant : il reste ${Math.max(0, dispo)} « ${p.nom} » à ${vente.boutique}.`;
  }
  if (!String(choix?.motif || "").trim()) return "Indiquez pourquoi le client échange l'article.";
  const c = chiffresEchange(vente, choix, produits);
  if (c.difference !== 0 && !MOYENS_ENCAISSEMENT.includes(choix?.moyen)) {
    return c.difference > 0
      ? "Choisissez comment le client paie la différence (espèces, mobile money, virement) — jamais à crédit."
      : "Choisissez comment la différence est rendue au client (espèces, mobile money, virement).";
  }
  return "";
}

// Les écritures d'un échange. Ne vérifie PAS le rôle de lui-même si `profile`
// manque : l'écran appelle critiqueEchange avec le profil, et ceci la rejoue.
// Renvoie { refus } ou { venteAvant, vente, nouvelleVente, ajustements, depense, reprises, chiffres, ref, journal }.
export function construireEchange(db, vente, choix, { produits = [], stock = () => 0, profile, aujourdhui = today(), heure = heureCourte() } = {}) {
  const refus = critiqueEchange(db, vente, choix, { produits, stock, profile });
  if (refus) return { refus };
  const c = chiffresEchange(vente, choix, produits);
  const ref = "ECH-" + uid().slice(0, 8).toUpperCase();
  const m = String(choix.motif).trim();
  const qui = profile?.nom || "?";
  const sav = choix.destination === DESTINATION_SAV;
  const moyen = c.difference !== 0 ? choix.moyen : (MOYENS_ENCAISSEMENT.includes(vente.paiement) ? vente.paiement : "Espèces");
  const quoiRendu = c.rendus.map((l) => `${l.qte} × ${l.article}`).join(", ");
  const quoiNouveau = c.nouveaux.map((l) => `${l.qte} × ${l.article}`).join(", ");
  const client = vente.client ? ` — ${vente.client}` : "";
  const idNouvelle = uid();

  const nouvelleVente = {
    id: idNouvelle,
    ...(vente.client_user_id ? { client_user_id: vente.client_user_id } : {}),
    numero: prochainNumeroVente(db, vente.boutique),
    date: aujourdhui, heure,
    boutique: vente.boutique,
    articles: c.nouveaux.map((l) => ({ produit_id: l.produit_id, article: l.article, qte: l.qte, pu: l.pu, remise_ligne: 0 })),
    client: vente.client || "Client non renseigné",
    tel: vente.tel || "",
    ...(vente.prenom ? { prenom: vente.prenom } : {}),
    ...(vente.entreprise ? { entreprise: vente.entreprise } : {}),
    remise: 0, remise_pct: 0, frais_installation: 0, frais_transport: 0,
    paiement: moyen, avance: 0,
    // La commission suit l'article : celui de la vente d'origine la reprend
    // sur le nouveau prix (l'ancienne est réduite d'autant). Ni apporteur, ni rabais.
    commercial: vente.commercial || null, responsable: vente.responsable || null, rabais: 0, apporteur: null,
    par: qui,
    // Ce que le reçu dit de l'échange (le reçu n'a pas la base sous la main).
    echange_de: {
      vente_id: vente.id, numero: numeroRecu(vente), ref, destination: choix.destination,
      rendus: c.rendus.map((l) => ({ produit_id: l.produit_id, article: l.article, qte: l.qte, montant: l.montant })),
      valeur_rendue: c.valeurRendue, rendu: c.aRendre,
    },
    avoir_echange: c.avoir,
  };

  const reprises = c.rendus.map((l, i) => ({
    id: c.rendus.length > 1 ? `${ref}-${i + 1}` : ref, ref, date: aujourdhui, produit_id: l.produit_id, article: l.article, qte: l.qte,
    montant: l.montant, rembourse: 0, moyen: "", motif: m, par: qui,
    echange: true, echange_vente_id: idNouvelle, echange_numero: nouvelleVente.numero, destination: choix.destination,
  }));

  const ajustements = c.rendus.map((l) => (sav
    ? { id: uid(), date: aujourdhui, produit_id: l.produit_id, boutique: vente.boutique, qte: 0, qte_sav: l.qte, article: l.article,
      type: TYPE_ECHANGE_SAV, statut: "en_sav", ref, vente_id: vente.id, motif: `Défectueux rendu à l'échange (${ref}) — ${m}`, par: qui }
    : { id: uid(), date: aujourdhui, produit_id: l.produit_id, boutique: vente.boutique, qte: l.qte, article: l.article,
      type: TYPE_ECHANGE_CLIENT, ref, vente_id: vente.id, motif: `Rendu à l'échange (${ref}) — ${m}`, par: qui, autorise_par: qui }));

  const depense = c.aRendre > 0
    ? { ...nouvelleDepense(profile, {
      boutique: caisseDeVente(vente), categorie: CATEGORIE_RENDU_ECHANGE,
      description: `Argent rendu au client — échange de la vente ${numeroRecu(vente)}${client} : ${quoiRendu} rendu, ${quoiNouveau} pris (nouveau reçu ${nouvelleVente.numero}, ${ref})`,
      montant: c.aRendre, moyen, vente_id: vente.id, echange_ref: ref,
    }), date: aujourdhui }
    : null;
  if (depense) nouvelleVente.echange_de.depense_id = depense.id;

  const venteApres = { ...vente, reprises: [...(Array.isArray(vente.reprises) ? vente.reprises : []), ...reprises] };
  const argent = c.aPayer > 0 ? `${c.aPayer} payés par le client (${moyen})` : c.aRendre > 0 ? `${c.aRendre} rendus au client (${moyen})` : "même valeur, aucun argent";
  return {
    venteAvant: vente, vente: venteApres, nouvelleVente, ajustements, depense, reprises, chiffres: c, ref, moyen,
    journal: `🔄 Échange ${ref} : ${quoiRendu} rendu(s)${sav ? " au SAV" : " au stock"} contre ${quoiNouveau} (reçu ${numeroRecu(vente)} → reçu ${nouvelleVente.numero}${client}) — ${argent} — ${m} — par ${qui}`,
  };
}

// Applique un échange construit à la base (pure).
export const appliquerEchange = (db, r) => ({
  ...db,
  ventes: [r.nouvelleVente, ...(db.ventes || []).map((v) => (v.id === r.vente.id ? r.vente : v))],
  ajustements: [...r.ajustements, ...(db.ajustements || [])],
  ...(r.depense ? { depenses: [r.depense, ...(db.depenses || [])] } : {}),
});
