// ============================================================
// lib/choixSolaire.js — LE CHOIX DU MATÉRIEL SOLAIRE DANS LE STOCK, ET
// L'ESTIMATION QUE L'ASSISTANT WHATSAPP DONNE AU CLIENT (24/09/2026)
//
// ⚠ POURQUOI CE FICHIER. Timo : « est-ce pas possible d'utiliser l'outil de
// dimensionnement pour envoyer un devis solaire au client ? » → devis PDF
// déconseillé (il engage BMI, cachet, signature), évaluation brève en texte
// acceptée, avec ses trois réponses : « 1 valeur par défaut, 2 en fourchette,
// 3 solaire ». Pour que le robot chiffre avec LA règle du vendeur, et non une
// copie qui finirait par dire autre chose, le choix du matériel a QUITTÉ
// l'écran (screens/dimensionnement/Solaire.jsx) pour venir ICI : l'écran et
// le serveur (api/whatsapp-entrant.js) lisent les mêmes fonctions.
//
// ⚠ Les fonctions déplacées sont RECOPIÉES À L'IDENTIQUE de l'écran et de
// Partages.jsx, sans la moindre modification — le banc
// (verifier-cloisonnement) les exerçait déjà, il continue de le faire.
//
// ⚠ Ce fichier ne reçoit JAMAIS `db` : des LISTES d'articles et de
// boutiques déjà filtrées (le serveur ne passe que les boutiques RÉELLES).
// Un seul import, la règle de calcul (lib/solaire.js, sans import) : le
// serveur le lit tel quel, sans bundler.
// ============================================================
import { besoinsSolaires } from "./solaire.js";

// ---- VA ≠ WATTS (2.100.40, demande Timo) ----
// La puissance utile d'un convertisseur annoncé en VA est ce chiffre
// multiplié par le facteur de puissance (0,8). « 5000VA » ne délivre que
// 4 000 W. specDepuisNom ramène déjà kVA en VA (et kW en W).
export const FACTEUR_PUISSANCE_VA = 0.8;
export const puissanceUtileW = (spec) => {
  if (!spec) return 0;
  return spec.unite === "va" ? Math.round(spec.valeur * FACTEUR_PUISSANCE_VA) : spec.valeur;
};

// ---- QUANTITÉ NÉCESSAIRE (2.100.39) — jamais plafonnée ----
export const quantiteNecessaire = (besoin, valeurUnitaire) => {
  const u = Number(valeurUnitaire || 0);
  if (!(u > 0)) return 1;
  return Math.max(1, Math.ceil(Number(besoin || 0) / u));
};

// ---- « BATERIE » reconnu (relevé par Timo, 18/08/2026) ----
// Mots simplifiés : sans accent, sans lettres doublées.
export const simplifierMot = (s) => String(s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/(.)\1+/g, "$1");

export const memeFamille = (a, b) => {
  const x = simplifierMot(a).trim(), y = simplifierMot(b).trim();
  if (!x || !y) return false;
  if (x === y) return true;
  return (x.length >= 4 && y.length >= 4) && (x.includes(y) || y.includes(x));
};

export const contientLeMot = (texte, mots) => {
  const t = simplifierMot(texte);
  return mots.some((m) => t.includes(simplifierMot(m)));
};

// Caractéristique numérique lue dans le nom d'un article
// (« Panneau JKM 555W » → 555 wc, « Convertisseur hybride 3KW » → 3000 w).
export function specDepuisNom(nom) {
  const m = String(nom || "").match(/(\d+(?:[.,]\d+)?)\s*(kwc|wc|kw|w|kva|va|ah|kg|a|m)\b/i);
  if (!m) return null;
  let valeur = parseFloat(m[1].replace(",", "."));
  let unite = m[2].toLowerCase();
  if (unite === "kwc") { unite = "wc"; valeur *= 1000; }
  if (unite === "kw") { unite = "w"; valeur *= 1000; }
  if (unite === "kva") { unite = "va"; valeur *= 1000; }
  return { valeur, unite };
}

// « MPPT » dans le nom d'un CONVERTISSEUR = régulateur intégré (18/08/2026).
export const estHybrideTexte = (texte) => /hybride|hybrid|mppt/i.test(texte || "");

export const ROLES_EQUIPEMENT = [
  { id: "panneau", label: "Panneaux solaires", mots: ["panneau", "panel", "photovolta", "pv "], unites: ["w", "wc"] },
  { id: "batterie", label: "Batteries", mots: ["batterie", "battery", "lifepo4", "lithium"], unites: ["ah"] },
  { id: "convertisseur", label: "Convertisseur", mots: ["convertisseur", "onduleur", "inverter", "inverseur"], unites: ["w", "va"] },
  { id: "regulateur", label: "Régulateur MPPT", mots: ["régulateur", "regulateur", "mppt", "chargeur solaire", "controller"], unites: ["a"] },
];

// Les réglages d'office du volet solaire (Timo, 06/09/2026) — ce sont AUSSI
// les « valeurs par défaut » de l'estimation du robot (sa réponse « 1 »).
export const SOLEIL_DEFAUT = "5";
export const TENSION_DEFAUT = "48";
export const AUTONOMIE_DEFAUT = "1";
export const TYPE_BATTERIE_DEFAUT = "lifepo4";
export const PCT_INSTALLATION_DEFAUT = 10;

// Convertisseur HYBRIDE sans tension en stock : déduite de la puissance
// (règle de Timo : ≤ 2,5 kW → 12 V, ≤ 4,5 kW → 24 V, au-delà 48 V). Reçoit
// des WATTS UTILES (défaut d'audit du 29/08/2026 : des VA faisaient monter
// d'un cran).
export const tensionInfereeConvertisseur = (w) => {
  const kw = w / 1000;
  if (kw <= 2.5) return 12;
  if (kw <= 4.5) return 24;
  return 48;
};

// Batterie : la tension se lit dans le nom (« BATERIE 25.6V300AH »).
export const tensionInfereeBatterie = (nomTexte) => {
  const m = String(nomTexte || "").match(/(\d+(?:[.,]\d+)?)\s*V(?!A)/i);
  if (!m) return null;
  const v = Number(m[1].replace(",", "."));
  if (v >= 10 && v <= 15) return 12;
  if (v >= 20 && v <= 30) return 24;
  if (v >= 40 && v <= 56) return 48;
  return null;
};

// Type de batterie lu dans le nom ; sans mention claire → Lithium (Timo).
export const MOTS_TYPE_BATTERIE = {
  lifepo4: ["lifepo4", "lithium", "li-ion", "lifep04"],
  gel: ["gel"],
  plomb: ["plomb", "agm", "acide"],
};
export const typeBatterieInfere = (nomTexte) => {
  const t = String(nomTexte || "").toLowerCase();
  for (const [type, mots] of Object.entries(MOTS_TYPE_BATTERIE)) {
    if (mots.some((m) => t.includes(m))) return type;
  }
  return "lifepo4";
};

// Le domaine « solaire » réglé par l'administrateur (celui dont le calcul
// est « solaire »), sinon celui d'origine — la même lecture que
// `domainesDefinis` (lib/calculs.js), sur la liste des boutiques.
export const idDomaineSolaireDes = (boutiques) => {
  const b = (boutiques || []).find((x) => x && Array.isArray(x.domaines) && x.domaines.length);
  const d = b ? b.domaines.find((x) => x && x.calcul === "solaire") : null;
  return (d && d.id) || "solaire";
};

// ---- LES ARTICLES QUI PEUVENT TENIR UN RÔLE ----
// Le rangement d'abord (domaine + famille), le nom en repli ; jamais une
// tension ni un type de batterie qui ne vont pas avec le système.
export const candidatsSolaire = (produits, role, { tension, typeBatterie, idDomaineSolaire = "solaire" } = {}) => (produits || [])
  .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
  .filter(({ p, spec }) => {
    const motCorrespond = p.domaine
      ? (p.domaine === idDomaineSolaire && memeFamille(p.categorie, role.label))
      : contientLeMot(p.nom + " " + (p.categorie || ""), role.mots);
    const uniteOk = spec && role.unites.includes(spec.unite);
    let tensionOk = true;
    if (role.id === "batterie") {
      tensionOk = p.tension
        ? Number(p.tension) === Number(tension)
        : (() => { const dev = tensionInfereeBatterie(p.nom); return dev === null || dev === Number(tension); })();
    } else if (role.id === "convertisseur") {
      tensionOk = p.tension
        ? Number(p.tension) === Number(tension)
        : (!spec || tensionInfereeConvertisseur(puissanceUtileW(spec)) === Number(tension));
    }
    let typeOk = true;
    if (role.id === "batterie") {
      typeOk = typeBatterieInfere(p.nom) === typeBatterie;
    }
    return motCorrespond && uniteOk && tensionOk && typeOk;
  });

// Panneaux/batteries : le plus gros calibre, empilé. Convertisseur /
// régulateur : le plus PETIT modèle qui couvre le besoin, sinon le plus gros
// en plusieurs unités. Rend { type: "stock", produit_id, qte } ou null.
export const empilable = (roleId) => roleId === "panneau" || roleId === "batterie";
export function choixDuStock(produits, role, besoin, opts = {}) {
  const valeurUtile = (o) => (role.id === "convertisseur" ? puissanceUtileW(o.spec) : o.spec.valeur);
  const options = candidatsSolaire(produits, role, opts).sort((a, b) => valeurUtile(a) - valeurUtile(b));
  if (options.length === 0 || !(besoin > 0)) return null;
  if (!empilable(role.id)) {
    const suffisant = options.find((o) => valeurUtile(o) >= besoin);
    if (suffisant) return { type: "stock", produit_id: suffisant.p.id, qte: 1 };
    const plusGros = options[options.length - 1];
    return { type: "stock", produit_id: plusGros.p.id, qte: quantiteNecessaire(besoin, valeurUtile(plusGros)) };
  }
  const meilleur = options[options.length - 1];
  return { type: "stock", produit_id: meilleur.p.id, qte: quantiteNecessaire(besoin, valeurUtile(meilleur)) };
}

// Le besoin de chaque rôle, tel que l'écran le calcule (besoinsSolaires).
export const besoinParRoleDe = (b) => ({ panneau: b.wcPanneaux, batterie: b.ahBatterie, convertisseur: b.wConvertisseur, regulateur: b.aRegulateur });

// ---- LA FIXATION ----
// Rails : panneaux × 2,2 m ; le client paie les BARRES entamées au prix du
// mètre (Timo, 14/09/2026). Supports : un par mètre ; étriers : panneaux × 2
// + 8. Supports et étriers seulement s'ils sont en stock.
export const PRIX_RAIL_DEFAUT = 5500;
export const LONGUEUR_RAIL_DEFAUT = 4.2;
export const prixRailDesBoutiques = (boutiques) => {
  const b = (boutiques || []).find((x) => x && Number(x.prix_rail) > 0);
  return b ? Number(b.prix_rail) : PRIX_RAIL_DEFAUT;
};
export const longueurRailDesBoutiques = (boutiques) => {
  const b = (boutiques || []).find((x) => x && Number(x.longueur_rail) > 0);
  return b ? Number(b.longueur_rail) : LONGUEUR_RAIL_DEFAUT;
};
export const metresRailPourPanneaux = (n) => (n > 0 ? Math.ceil(n * 2.2) : 0);
export const supportsDuStock = (produits) => (produits || []).filter((p) => (/support/i.test(p.nom) || /support/i.test(p.categorie || "")) && !/[ée]trier/i.test(p.nom));
export const etrierDuStock = (produits) => (produits || []).find((p) => /[ée]trier/i.test(p.nom) || /[ée]trier/i.test(p.categorie || ""));

// ============================================================
// 🤖 L'ESTIMATION DU ROBOT (outil `estimer_solaire`, lib/assistantIA.js)
//
// Décisions de Timo (24/09/2026) : « 1 valeur par défaut » (autonomie 1 j,
// soleil 5 h, 48 V, lithium — les réglages d'office de l'écran),
// « 2 en fourchette » (± 15 % autour du calcul), « 3 solaire » (seulement).
//
// ⚠ CE N'EST PAS UN DEVIS, et le texte le dit : ni lignes d'articles, ni
// cachet, ni validité. Une FOURCHETTE, le nombre de panneaux et la capacité
// de batterie, « estimation indicative, un conseiller vous confirme ».
// ⚠ RIEN D'INVENTÉ : un appareil sans puissance ou sans heures → pas
// d'estimation, et on dit lequel ; un panneau, une batterie ou un
// convertisseur introuvable dans une boutique → cette boutique ne chiffre
// pas ; aucune boutique complète → pas d'estimation, et on le dit.
// ⚠ Plusieurs boutiques réelles : chacune chiffre avec SON stock et SES
// prix ; la fourchette couvre de la moins chère − 15 % à la plus chère
// + 15 %. On ne choisit pas une boutique à la place du client.
// ============================================================
export const MARGE_FOURCHETTE = 0.15;
export const REGLAGES_ESTIMATION = { autonomie: AUTONOMIE_DEFAUT, soleil: SOLEIL_DEFAUT, tension: TENSION_DEFAUT, typeBatterie: TYPE_BATTERIE_DEFAUT };

// Ce qui manque dans la liste des appareils pour pouvoir calculer.
export function appareilsIncomplets(appareils) {
  return (appareils || []).filter((a) => !(Number(a.puissance) > 0) || !(Number(a.heures) > 0) || !(Number(a.qte || 1) > 0));
}

// Le chiffrage d'UNE boutique avec les réglages d'office. Rend
// { boutique, total, panneaux, wcPanneau, batteries, ahBatterie, kwConvertisseur }
// ou { boutique, manque: "panneaux" | … } si un rôle principal n'y est pas.
export function chiffrageBoutique(besoins, { nom, produits = [], prixRail = PRIX_RAIL_DEFAUT, longueurRail = LONGUEUR_RAIL_DEFAUT, idDomaineSolaire = "solaire" } = {}, reglages = REGLAGES_ESTIMATION) {
  const opts = { tension: reglages.tension, typeBatterie: reglages.typeBatterie, idDomaineSolaire };
  const besoin = besoinParRoleDe(besoins);
  const parId = (id) => (produits || []).find((p) => p.id === id);
  const lignes = {};
  for (const role of ROLES_EQUIPEMENT) {
    if (role.id === "regulateur") {
      const conv = lignes.convertisseur && parId(lignes.convertisseur.produit_id);
      if (conv && estHybrideTexte(conv.nom + " " + (conv.categorie || ""))) continue;
    }
    const c = choixDuStock(produits, role, besoin[role.id], opts);
    if (c) lignes[role.id] = c;
    else if (role.id !== "regulateur") return { boutique: nom, manque: role.label };
  }
  let total = 0;
  for (const c of Object.values(lignes)) total += Number(parId(c.produit_id)?.prix_vente || 0) * c.qte;
  const nbPanneaux = lignes.panneau.qte;
  // Fixation, comme le devis : barres entamées au prix du mètre, supports et
  // étriers s'ils sont en stock.
  const metres = metresRailPourPanneaux(nbPanneaux);
  const L = Number(longueurRail) > 0 ? Number(longueurRail) : LONGUEUR_RAIL_DEFAUT;
  const barres = metres > 0 ? Math.ceil(metres / L - 1e-9) : 0;
  total += barres * Math.round(L * Number(prixRail || 0));
  const support = supportsDuStock(produits)[0];
  const etrier = etrierDuStock(produits);
  if (metres > 0 && support) total += Math.ceil(metres) * Number(support.prix_vente || 0);
  if (metres > 0 && etrier) total += (nbPanneaux * 2 + 8) * Number(etrier.prix_vente || 0);
  // La pose, au pourcentage d'office du devis.
  total += Math.round((total * PCT_INSTALLATION_DEFAUT) / 100);
  const pan = parId(lignes.panneau.produit_id);
  const bat = parId(lignes.batterie.produit_id);
  return {
    boutique: nom, total,
    panneaux: nbPanneaux, wcPanneau: specDepuisNom(pan.nom + " " + (pan.categorie || ""))?.valeur || 0,
    batteries: lignes.batterie.qte, ahBatterie: specDepuisNom(bat.nom + " " + (bat.categorie || ""))?.valeur || 0,
    // La taille du convertisseur RETENU dans le stock (watts utiles), pas le
    // besoin brut : c'est ce qu'on installerait.
    kwConvertisseur: (() => { const c = parId(lignes.convertisseur.produit_id); return Math.round((puissanceUtileW(specDepuisNom(c.nom + " " + (c.categorie || ""))) * lignes.convertisseur.qte) / 100) / 10; })(),
  };
}

// Une fourchette se lit en chiffres ronds (« entre 5 500 000 et 7 500 000 »,
// pas « entre 5 538 000 et 7 494 000 ») : le bas arrondi vers le BAS, le
// haut vers le HAUT — l'arrondi ne rétrécit jamais la fourchette.
export const pasArrondi = (n) => (n >= 500000 ? 50000 : 10000);
const arrondir = (n, sens) => { const p = pasArrondi(n); return sens < 0 ? Math.floor(n / p) * p : Math.ceil(n / p) * p; };
export const fourchetteDe = (min, max, marge = MARGE_FOURCHETTE) =>
  ({ bas: arrondir(min * (1 - marge), -1), haut: arrondir(max * (1 + marge), 1) });

// L'estimation entière. `boutiques` : [{ nom, produits, prixRail, longueurRail, idDomaineSolaire }]
// — RÉELLES seulement (le serveur les prépare). Rend { ok: true, bas, haut,
// whParJour, … } ou { ok: false, motif } — le motif est dit au client.
export function estimationSolaire(appareils, boutiques, reglages = REGLAGES_ESTIMATION) {
  const liste = (appareils || []).filter(Boolean);
  if (!liste.length) return { ok: false, motif: "Aucun appareil décrit : demander au client quels appareils il veut alimenter, combien, et combien d'heures par jour." };
  const incomplets = appareilsIncomplets(liste);
  if (incomplets.length) return { ok: false, motif: `Il manque la puissance ou les heures d'utilisation pour : ${incomplets.map((a) => a.nom || "un appareil").join(", ")}. Le demander au client, ne rien supposer.` };
  // ⚠ Le NOMBRE doit être DIT (Timo, 25/09/2026 : « une ampoule » ou
  // « 1 ampoule », oui ; « les ampoules », « quelques lumières », non). Seul
  // `qteDite === false` refuse : une ligne saisie à la main n'a pas ce drapeau.
  const sansNombre = liste.filter((a) => a.qteDite === false);
  if (sansNombre.length) return { ok: false, motif: `Il manque le NOMBRE pour : ${sansNombre.map((a) => a.nom || "un appareil").join(", ")}. Demander au client combien il en a (« une », « 3 »…), ne jamais supposer un seul.` };
  const besoins = besoinsSolaires(liste, reglages);
  const chiffres = (boutiques || []).map((b) => chiffrageBoutique(besoins, b, reglages));
  const complets = chiffres.filter((c) => !c.manque && c.total > 0);
  if (!complets.length) return { ok: false, motif: "Le stock ne permet pas de chiffrer (panneaux, batteries ou convertisseur manquants) : ne pas donner de prix, proposer un conseiller." };
  const totaux = complets.map((c) => c.total);
  const { bas, haut } = fourchetteDe(Math.min(...totaux), Math.max(...totaux));
  const ref = complets.reduce((a, c) => (c.total < a.total ? c : a));
  return {
    ok: true, bas, haut,
    whParJour: besoins.whParJour, kwhParJour: Math.round(besoins.whParJour / 100) / 10,
    panneaux: ref.panneaux, wcPanneau: ref.wcPanneau, batteries: ref.batteries, ahBatterie: ref.ahBatterie,
    kwConvertisseur: ref.kwConvertisseur, tension: Number(reglages.tension), boutiques: complets.length,
  };
}

// La phrase à citer au client (l'IA la reprend telle quelle, le juge
// n'accepte que ces deux montants).
const fmtF = (n) => `${Math.round(Number(n || 0)).toLocaleString("fr-FR")} F`;
export const PHRASE_INDICATIVE = "Estimation indicative, pose comprise ; un conseiller BMI TOGO vous confirme le prix exact dans un devis.";
export function texteEstimation(e) {
  if (!e || !e.ok) return "";
  return `Pour environ ${String(e.kwhParJour).replace(".", ",")} kWh par jour : ${e.panneaux} panneaux de ${e.wcPanneau} W, ${e.batteries} batterie${e.batteries > 1 ? "s" : ""} de ${e.ahBatterie} Ah (${e.tension} V) et un convertisseur de ${String(e.kwConvertisseur).replace(".", ",")} kW. Comptez entre ${fmtF(e.bas)} et ${fmtF(e.haut)}. ${PHRASE_INDICATIVE}`;
}
