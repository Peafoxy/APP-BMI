// ============================================================
// lib/effacementClient.js — LE DROIT À L'EFFACEMENT D'UN CLIENT
//
// POURQUOI (Timo, 18/09/2026 : « mon app respecte déjà la législation
// togolaise sur cet aspect ? » → « lance le point 1 »).
//
// Nos contrats promettent, article 18, que le client « dispose d'un droit
// d'accès, de rectification et, dans les conditions prévues par la loi, de
// suppression de ses données ». C'était une promesse que le logiciel ne
// savait PAS tenir : supprimer son compte (👥 Utilisateurs) enlevait son
// identifiant et son mot de passe, et laissait son nom et son numéro sur
// chaque vente, chaque dette, chaque chantier, chaque message, et dans le
// journal. Autrement dit : rien n'était effacé, mais tout avait l'air fait.
//
// ⚠ CE QU'ON N'EFFACE PAS, ET POURQUOI. Une facture payée ne se détruit
// pas : la loi commerciale oblige BMI à la garder. Le contrat le dit déjà
// (« dans les conditions prévues par la loi »). On ne DÉTRUIT donc pas une
// vente — on en retire le NOM et le NUMÉRO, et on les remplace par une
// référence sans personne derrière : « CLIENT EFFACÉ N° 3 ».
//
//   • Ce qui n'appartient qu'à lui PART           → compte, prospect, messages
//   • Ce que les livres doivent garder RESTE, sans son nom
//                                                  → ventes, dettes, chantiers
//   • Son nom dans les textes libres est REMPLACÉ  → journal, observations
//
// La référence numérotée n'est pas un caprice : sans elle, deux clients
// effacés deviendraient indiscernables et la comptabilité perdrait le
// groupement de leurs achats. Elle ne désigne personne — elle relie des
// lignes entre elles, ce qui est exactement ce dont les livres ont besoin.
//
// ⚠ LE MUR. Cette règle ne va JAMAIS chercher dans `db` : elle travaille sur
// les listes DÉJÀ FILTRÉES que l'écran lui donne (`visible`), et n'écrit que
// sur les identifiants qu'elle y a trouvés. Un client de l'espace
// d'entraînement ne peut donc pas emporter une ligne réelle, ni l'inverse.
//
// Ce fichier n'importe que des règles PURES (identiteClient, suggestions) :
// le banc l'exerce tel quel.
// ============================================================
import { numeroComparable } from "./identiteClient.js";
import { sansAccents } from "./suggestions.js";

// ---------------------------------------------------------------
// LA RÉFÉRENCE QUI REMPLACE LE NOM
// ---------------------------------------------------------------
export const PREFIXE_EFFACE = "CLIENT EFFACÉ N° ";
export const pseudonyme = (numero) => `${PREFIXE_EFFACE}${Number(numero) || 1}`;
const MOTIF_EFFACE = /CLIENT EFFAC[ÉE]\s*N°\s*(\d+)/i;
export const estEfface = (nom) => MOTIF_EFFACE.test(String(nom || ""));

// Le prochain numéro : le plus grand déjà posé, plus un. Il ne redescend
// JAMAIS — même principe que le numéro gravé d'un outil. Deux effacements ne
// peuvent donc pas se retrouver sous la même référence, et une ligne
// retrouvée dans une vieille sauvegarde ne vient pas en écraser une autre.
export function prochainNumeroEffacement(db) {
  const d = db || {};
  const textes = [
    ...(d.ventes || []).map((x) => x.client),
    ...(d.dettes || []).map((x) => x.client),
    ...(d.proformas || []).map((x) => x.client),
    ...(d.commandes || []).map((x) => x.client),
    ...(d.clients_installes || []).map((x) => x.nom),
    ...(d.corbeille_clients_installes || []).map((x) => x.nom),
  ];
  let max = 0;
  for (const t of textes) {
    const m = String(t || "").match(MOTIF_EFFACE);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return max + 1;
}

// ---------------------------------------------------------------
// RECONNAÎTRE LE MÊME CLIENT
// ---------------------------------------------------------------
// Le numéro d'abord (les 8 derniers chiffres : « +228 90 11 22 33 » et
// « 90112233 » sont le même homme), le nom seulement à défaut — exactement
// la règle de lib/clientsConnus.js, qui regroupe déjà les clients d'une
// boutique. Deux personnes sans numéro et au même nom sont confondues : on
// le DIT dans le rapport plutôt que de l'ignorer.
export const cleDuClient = (nom, tel) => {
  const n = numeroComparable(tel);
  return n ? `t:${n}` : `n:${sansAccents(nom)}`;
};

export const memeClient = (cible, nom, tel) => {
  const a = numeroComparable(cible?.tel), b = numeroComparable(tel);
  if (a && b) return a === b;
  if (a || b) return false;           // l'un a un numéro, l'autre pas : ce n'est pas lui
  const x = sansAccents(cible?.nom), y = sansAccents(nom);
  return !!x && x === y;
};

// Le nom d'un client tel que chaque table l'écrit.
const nomDeLaVente = (x) => x?.client;
const nomDuChantier = (c) => `${c?.prenom || ""} ${c?.nom || ""}`.trim() || c?.nom;

// Un chantier peut avoir été créé depuis un devis (`nom` porte tout) ou à la
// main (`prenom` + `nom` séparés) : on essaie les deux écritures.
const chantierDuClient = (cible, c) =>
  memeClient(cible, nomDuChantier(c), c?.tel) || memeClient(cible, c?.nom, c?.tel);

// ---------------------------------------------------------------
// LE DOSSIER : TOUT CE QUE L'APPLICATION SAIT DE LUI
// ---------------------------------------------------------------
// `visible` = les listes DÉJÀ filtrées par l'espace regardé (voir le mur, en
// tête de fichier) : { comptes, ventes, dettes, proformas, commandes,
// chantiers, prospects, messages, audits }.
export function dossierClient(visible, cible) {
  const v = visible || {};
  const compte = (v.comptes || []).find(
    (u) => u.role === "client" && memeClient(cible, u.nom_base || u.nom, u.tel)
  ) || null;
  const idC = compte?.id || null;

  // Une ligne est à lui si elle porte son numéro/nom, OU si elle est
  // rattachée à son compte (une vente encaissée sans que le nom soit retapé).
  const aLui = (x, nom) => memeClient(cible, nom, x?.tel)
    || (!!idC && (x?.client_user_id === idC || x?.user_id === idC));

  const ventes = (v.ventes || []).filter((x) => aLui(x, nomDeLaVente(x)));
  const dettes = (v.dettes || []).filter((x) => aLui(x, nomDeLaVente(x)));
  const proformas = (v.proformas || []).filter((x) => aLui(x, nomDeLaVente(x)));
  const commandes = (v.commandes || []).filter((x) => aLui(x, nomDeLaVente(x)));
  const chantiers = (v.chantiers || []).filter((c) => chantierDuClient(cible, c) || (!!idC && c?.user_id === idC));
  const prospects = (v.prospects || []).filter((p) => memeClient(cible, p?.nom, p?.tel));
  const messages = idC
    ? (v.messages || []).filter((m) => m?.de_id === idC || m?.a_id === idC)
    : [];

  // ⚠⚠ LE MUR SUR LES TEXTES LIBRES (défaut trouvé au banc le 18/09/2026, en
  // posant la règle). Le nettoyage du journal et des messages parcourait
  // `db.audits` et `db.messages` EN ENTIER. Un vendeur réel ne télécharge que
  // son espace — mais l'administrateur PRINCIPAL charge les DEUX, et c'est lui
  // qui efface : effacer un client d'ENTRAÎNEMENT aurait nettoyé des lignes
  // de journal RÉELLES. Même leçon que retenueOutilPourPrime : une fonction
  // pure qui reçoit une table entière et la PARCOURT est un passage de mur en
  // puissance. Le dossier porte donc la PORTÉE — les seules lignes que le
  // geste a le droit de réécrire —, et elle vient des listes déjà filtrées.
  const portee = {
    audits: new Set((v.audits || []).map((a) => a.id)),
    messages: new Set((v.messages || []).map((m) => m.id)),
  };

  const reste = dettes.reduce((s, d) => s + Math.max(0, Number(d.montant || 0) - Number(d.paye || 0)), 0);
  const enCours = chantiers.filter((c) => c.statut !== "receptionne");

  return {
    cible, compte, ventes, dettes, proformas, commandes, chantiers, prospects, messages,
    portee, reste, enCours,
    // Les devis d'un client vivent SUR SON COMPTE (u.devis) : ils partent
    // avec lui, il n'y a rien à parcourir à part.
    devis: (compte?.devis || []).length,
    total: ventes.length + dettes.length + proformas.length + commandes.length
      + chantiers.length + prospects.length + messages.length + (compte ? 1 : 0),
  };
}

// ---------------------------------------------------------------
// LES DEUX PORTES FERMÉES
// ---------------------------------------------------------------
// On n'efface pas quelqu'un dont BMI a encore besoin : l'argent qu'il doit,
// et le chantier qu'on doit finir. La loi le permet — garder ce qui sert un
// intérêt légitime en cours n'est pas refuser un droit, c'est l'appliquer
// quand il s'ouvre. Le refus NOMME le montant et le nombre, jamais un
// « impossible » sec.
export function critiqueEffacement(dossier, fmt = (x) => `${x} F`) {
  const d = dossier || {};
  if (!d.total) return "Aucune donnée trouvée pour ce client dans l'espace que vous regardez.";
  if (d.reste > 0) {
    return `Ce client doit encore ${fmt(d.reste)} (${d.dettes.length} dette(s) en cours).\n\n`
      + `On n'efface pas les coordonnées de quelqu'un à qui BMI doit réclamer de l'argent : sans son numéro, la dette ne se recouvre plus.\n\n`
      + `Soldez la dette (ou passez-la en perte) d'abord.`;
  }
  if (d.enCours.length) {
    return `${d.enCours.length} chantier(s) ne sont pas encore réceptionné(s).\n\n`
      + `Tant que les travaux ne sont pas livrés, vous avez besoin de joindre ce client.\n\n`
      + `Réceptionnez le chantier d'abord.`;
  }
  return "";
}

// Ce qui n'empêche pas, mais qu'il faut avoir lu avant de cliquer.
export function avertissementsEffacement(dossier, aujourdhui = new Date().toISOString().slice(0, 10), autresNoms = []) {
  const d = dossier || {};
  const out = [];
  // ⚠ Ce qu'on NE PEUT PAS nettoyer se dit AVANT, pas après.
  const { ecartes } = motsSensibles(d, autresNoms);
  if (ecartes.length) {
    out.push(`⚠ « ${ecartes.join(" », « ")} » ne sera PAS retiré des textes libres (journal, observations, messages d'équipe) : `
      + `quelqu'un d'autre porte ce nom dans l'application, et effacer le nom d'un tiers ferait mentir le journal. `
      + `Les colonnes nom et numéro, elles, sont bien effacées.`);
  }
  const sousGarantie = (d.chantiers || []).filter((c) => {
    const mois = Number(c.garantie_mois || 0);
    if (!mois) return false;
    const depart = String(c.receptionne_le || c.date_installation || c.date || "").slice(0, 10);
    if (!depart) return false;
    const fin = new Date(depart);
    if (Number.isNaN(fin.getTime())) return false;
    fin.setMonth(fin.getMonth() + mois);
    return fin.toISOString().slice(0, 10) >= aujourdhui;
  });
  if (sousGarantie.length) {
    out.push(`⚠ ${sousGarantie.length} chantier(s) encore sous garantie : après l'effacement, vous n'aurez plus son numéro pour le rappeler.`);
  }
  if (!numeroComparable(d.cible?.tel)) {
    out.push(`⚠ Ce client n'a pas de numéro enregistré : le rapprochement s'est fait sur le NOM seul. Un homonyme serait effacé avec lui — vérifiez la liste ci-dessous ligne par ligne.`);
  }
  if (d.compte && d.devis) {
    out.push(`ℹ ${d.devis} devis vivent sur son compte : ils partent avec lui.`);
  }
  return out;
}

// ---------------------------------------------------------------
// LE RAPPORT : CE QUI PART, CE QUI RESTE
// ---------------------------------------------------------------
// Montré AVANT de cliquer. On ne fait pas signer un geste irréversible sur
// une phrase générale.
export function resumeEffacement(dossier) {
  const d = dossier || {};
  const part = [
    d.compte && `Son compte (identifiant, mot de passe, numéro)${d.devis ? ` et ses ${d.devis} devis` : ""}`,
    d.prospects.length && `${d.prospects.length} fiche(s) de prospection`,
    d.messages.length && `${d.messages.length} message(s) échangé(s) avec lui`,
  ].filter(Boolean);
  const reste = [
    d.ventes.length && `${d.ventes.length} vente(s) — montants, articles, n° de reçu gardés, le nom remplacé`,
    d.dettes.length && `${d.dettes.length} dette(s) soldée(s) — idem`,
    d.proformas.length && `${d.proformas.length} proforma(s) — idem`,
    d.commandes.length && `${d.commandes.length} commande(s) — idem`,
    d.chantiers.length && `${d.chantiers.length} chantier(s) — frais, équipe et matériel gardés ; nom, numéro, adresse, position et signature effacés`,
  ].filter(Boolean);
  return { part, reste };
}

// ---------------------------------------------------------------
// LES TEXTES LIBRES : LE NOM S'Y CACHE AUSSI
// ---------------------------------------------------------------
// Le journal écrit « Nouveau client installé « KOSSI MENSAH » », une
// observation de chantier le nomme, un message d'équipe le cite. Laisser
// tout cela en place pendant qu'on nettoie les colonnes serait exactement le
// travers qu'on veut éviter : un effacement qui a l'air fait.
//
// ⚠⚠ MAIS ON NE BALAIE PAS LE NOM DE QUELQU'UN D'AUTRE. À Lomé, un prénom
// seul (KOSSI, AMA, KOFFI) est porté par plusieurs personnes : remplacer ce
// mot partout retirerait du journal le nom d'un VENDEUR, et le journal est
// ce qui dit qui a fait quoi. Une trace perdue ne se retrouve jamais.
// `motsSensibles` écarte donc tout mot que porte encore QUELQU'UN D'AUTRE —
// employé ou client resté. Ce qui est écarté est DIT dans le rapport, jamais
// nettoyé en silence.
//
// ⚠ On ne remplace que des mots d'AU MOINS 4 caractères, et on commence par
// les plus LONGS — sinon « KOSSI » serait remplacé à l'intérieur de « KOSSI
// MENSAH » et le nom de famille resterait planté là.
export const LONGUEUR_MIN_MOT = 4;
export const MARQUE_NUMERO = "numéro effacé";
const echapper = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `autresNoms` = tout ce que portent les AUTRES personnes (employés, autres
// clients). Un mot qui s'y trouve n'est pas à lui seul : on n'y touche pas.
export function motsSensibles(dossier, autresNoms = []) {
  const d = dossier || {};
  const interdits = new Set((autresNoms || []).map(sansAccents).filter(Boolean));

  const noms = [], numeros = [], ecartes = [];
  const vus = new Set();
  const poser = (brut, liste, verifier) => {
    const t = String(brut || "").trim();
    if (t.length < LONGUEUR_MIN_MOT || estEfface(t)) return;
    const cle = sansAccents(t);
    if (vus.has(cle)) return;
    vus.add(cle);
    if (verifier && interdits.has(cle)) { ecartes.push(t); return; }
    liste.push(t);
  };

  poser(d.cible?.nom, noms, true);
  poser(d.compte?.nom, noms, true);
  poser(d.compte?.nom_base, noms, true);
  // Un numéro de téléphone ne désigne qu'une personne : aucune vérification.
  [d.cible?.tel, d.compte?.tel, ...(d.ventes || []).map((x) => x.tel), ...(d.chantiers || []).map((c) => c.tel)]
    .forEach((t) => poser(t, numeros, false));

  const parLongueur = (a, b) => b.length - a.length;
  return { noms: noms.sort(parLongueur), numeros: numeros.sort(parLongueur), ecartes };
}

// Les noms deviennent la référence, les numéros disparaissent derrière une
// marque : « KOSSI MENSAH (90112233) » ne doit pas se lire « CLIENT EFFACÉ
// N° 1 (CLIENT EFFACÉ N° 1) ».
export function nettoyerTexte(texte, mots, faux) {
  const m = mots || {};
  let t = String(texte || "");
  for (const n of m.noms || []) t = t.replace(new RegExp(echapper(n), "gi"), faux);
  for (const n of m.numeros || []) t = t.replace(new RegExp(echapper(n), "gi"), MARQUE_NUMERO);
  return t;
}

export const riensANettoyer = (mots) => !(mots?.noms?.length || mots?.numeros?.length);

// ---------------------------------------------------------------
// LE GESTE
// ---------------------------------------------------------------
// Les champs retirés d'une ligne de vente / dette / proforma / commande.
// Le nom devient la référence ; le reste de la ligne ne bouge pas d'un franc.
export const CHAMPS_LIGNE = ["tel", "client_user_id", "client_tel"];
// Les champs retirés d'un chantier. `contrat_jeton` est le lien de signature :
// c'est une CLÉ d'accès à son dossier, elle ne survit pas à l'effacement.
export const CHAMPS_CHANTIER = [
  "tel", "localisation", "adresse_contrat", "lat", "lng", "user_id",
  "contrat_signature", "avenant_signature", "contrat_jeton", "contrat_jeton_le",
];

// Ne touche QUE les champs présents : ajouter `client_user_id: null` sur une
// vieille vente qui ne l'a jamais porté salirait la comparaison de save().
const vider = (obj, champs) => {
  const out = { ...obj };
  for (const c of champs) if (c in out) out[c] = typeof out[c] === "string" ? "" : null;
  return out;
};

export function effacerClient(db, dossier, profile, { motif, numero, autresNoms = [] } = {}) {
  const d = dossier || {};
  const faux = pseudonyme(numero);
  const mots = motsSensibles(d, autresNoms);
  const rien = riensANettoyer(mots);
  const propre = (txt) => nettoyerTexte(txt, mots, faux);
  // ⚠ Aucune portée = on ne touche AUCUN texte libre. Le silence vaut mieux
  // qu'un nettoyage qui déborde de l'espace regardé.
  const dansLaPortee = d.portee || { audits: new Set(), messages: new Set() };

  const ids = (liste) => new Set((liste || []).map((x) => x.id));
  const idV = ids(d.ventes), idD = ids(d.dettes), idP = ids(d.proformas);
  const idC = ids(d.commandes), idCh = ids(d.chantiers);
  const idPr = ids(d.prospects), idM = ids(d.messages);

  const anonyme = (x) => ({ ...vider(x, CHAMPS_LIGNE), client: faux });

  const chantierAnonyme = (c) => {
    const out = { ...vider(c, CHAMPS_CHANTIER), nom: faux, prenom: "" };
    if (Array.isArray(c.observations)) {
      out.observations = c.observations.map((o) => ({ ...o, texte: propre(o.texte) }));
    }
    return out;
  };

  return {
    ...db,
    // Ce qui n'appartient qu'à lui : la fiche entière part.
    users: (db.users || []).filter((u) => !d.compte || u.id !== d.compte.id),
    prospects: (db.prospects || []).filter((p) => !idPr.has(p.id)),
    messages: (db.messages || []).filter((m) => !idM.has(m.id)).map(
      (m) => (m.texte && !rien && dansLaPortee.messages.has(m.id) ? { ...m, texte: propre(m.texte) } : m)
    ),
    // Ce que les livres gardent : la ligne reste, le nom devient la référence.
    ventes: (db.ventes || []).map((x) => (idV.has(x.id) ? anonyme(x) : x)),
    dettes: (db.dettes || []).map((x) => (idD.has(x.id) ? anonyme(x) : x)),
    proformas: (db.proformas || []).map((x) => (idP.has(x.id) ? anonyme(x) : x)),
    commandes: (db.commandes || []).map((x) => (idC.has(x.id) ? anonyme(x) : x)),
    clients_installes: (db.clients_installes || []).map((c) => (idCh.has(c.id) ? chantierAnonyme(c) : c)),
    // ⚠ Un chantier mis à la corbeille porte encore son nom : l'effacement
    // l'y suit, sinon il ressortirait nommé à la restauration.
    corbeille_clients_installes: (db.corbeille_clients_installes || []).map((c) => (idCh.has(c.id) ? chantierAnonyme(c) : c)),
    // Ses devis mis à la corbeille partent avec son compte (ils portent son nom).
    corbeille_devis: (db.corbeille_devis || []).filter((x) => !d.compte || x.corbeille_client_id !== d.compte.id),
    // Le journal garde QUI a fait QUOI et QUAND — il perd seulement le nom.
    audits: (db.audits || []).map(
      (a) => (a.action && !rien && dansLaPortee.audits.has(a.id) ? { ...a, action: propre(a.action) } : a)
    ),
  };
}

// La ligne du journal que ce geste écrit. Elle ne nomme PERSONNE : c'est
// tout l'objet de l'opération. Elle prouve qu'une demande a été honorée —
// la demande écrite du client, elle, se garde sur papier.
export const journalEffacement = (dossier, profile, { motif, numero } = {}) =>
  `🔒 Effacement de données personnelles — ${pseudonyme(numero)} : `
  + `${dossier?.total || 0} enregistrement(s) traité(s) `
  + `(${dossier?.compte ? "compte supprimé, " : ""}${dossier?.ventes?.length || 0} vente(s) anonymisée(s)) `
  + `— motif : ${String(motif || "").trim()} — par ${profile?.nom || "?"}`;

// ---------------------------------------------------------------
// LA LISTE OÙ L'ON CHOISIT QUI EFFACER
// ---------------------------------------------------------------
// Tous les clients que l'espace regardé connaît : ceux qui ont un compte, et
// ceux qui ont seulement acheté. Les déjà effacés n'y figurent plus.
export function clientsEffacables(visible) {
  const v = visible || {};
  const map = {};
  const poser = (nom, tel, date) => {
    const n = String(nom || "").trim();
    if (!n || estEfface(n)) return;
    const cle = cleDuClient(n, tel);
    const c = (map[cle] ||= { cle, nom: n, tel: tel || "", derniere: date || "" });
    if (!c.tel && tel) c.tel = tel;
    if (String(date || "") > String(c.derniere)) { c.derniere = date; if (n) c.nom = n; if (tel) c.tel = tel; }
  };
  (v.comptes || []).filter((u) => u.role === "client").forEach((u) => poser(u.nom_base || u.nom, u.tel, u.cree_le));
  (v.ventes || []).forEach((x) => poser(x.client, x.tel, x.date));
  (v.dettes || []).forEach((x) => poser(x.client, x.tel, x.date));
  (v.chantiers || []).forEach((c) => poser(nomDuChantier(c), c.tel, c.date));
  return Object.values(map).sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}
