// ============================================================
// lib/whatsappModeles.js — LES MODÈLES DE MESSAGES WHATSAPP
//
// Timo, 19/09/2026 : « lance l'étape 1 ». L'étape 1, c'est l'ENVOI — le
// message part du numéro BMI (+228 99 96 84 88) sans que personne n'ouvre
// WhatsApp, et la trace reste sur le devis.
//
// ⚠⚠ POURQUOI DES « MODÈLES », ET PAS UN TEXTE LIBRE. Hors de la fenêtre de
// 24 h ouverte par un message du client, Meta n'accepte QUE des textes
// écrits d'avance et APPROUVÉS par elle. Nos relances partent quand NOUS le
// décidons, jamais en réponse : elles passent donc forcément par un modèle.
// Ce fichier est la liste de ces modèles, et l'ordre EXACT de leurs trous.
//
// ⚠⚠ LE COUPLE : `api/whatsapp.js` IMPORTE CE FICHIER. Le serveur refuse
// tout nom de modèle qui n'est pas ici, et compte les variables avec la
// même liste. Deux listes finiraient par diverger, et la divergence serait
// silencieuse : le client recevrait « votre devis  réalisé par BMI TOGO »,
// un trou vide au milieu de la phrase. D'où : UNE liste, lue des deux
// côtés. Module PUR, sans aucun import (le serveur le lit tel quel).
//
// ⚠ CE QUI A ÉTÉ APPRIS EN LES FAISANT APPROUVER (19/09/2026, trois refus) :
//   1. un DEVIS est une OFFRE → catégorie **marketing**, jamais utility ;
//   2. un mot de passe ne voyage JAMAIS dans un modèle — Meta le range
//      d'office dans sa catégorie « authentication » et refuse, quelle que
//      soit la case cochée. D'où « Vos identifiants vous ont été remis par
//      votre vendeur » et AUCUNE variable secrète ici ;
//   3. le nom et la catégorie se figent à la création. Renommer un modèle
//      ci-dessous ne renomme rien chez Meta : il faut en créer un nouveau.
// ============================================================

// Meta identifie la langue par un code ; nos quatre modèles sont en « fr ».
export const LANGUE_MODELES = "fr";

// ⚠ L'ORDRE DE `variables` EST L'ORDRE DES {{1}} {{2}} … DU MODÈLE CHEZ
// META. Intervertir deux lignes ici enverrait le montant à la place du nom.
// Les noms servent aux messages d'erreur et au banc, jamais à Meta.
export const MODELES = {
  // « Bonjour {{1}}, votre devis {{2}} réalisé par BMI TOGO est prêt. … »
  devis_disponible: { categorie: "marketing", variables: ["client", "domaine", "montant"] },
  // « Bonjour {{1}}, nous revenons vers vous au sujet du devis {{2}} de {{3}}
  //   que nous vous avons envoyé le {{4}}. … »
  relance_devis: { categorie: "marketing", variables: ["client", "domaine", "montant", "date"] },
  // « Bonjour {{1}}, merci d'avoir validé votre devis BMI TOGO de {{2}}
  //   (contrat {{3}}). … boutique {{4}}. »
  devis_valide_paiement: { categorie: "utility", variables: ["client", "montant", "contrat", "boutique"] },
  // « Bonjour {{1}}, une échéance … arrive le {{2}}. Montant attendu : {{3}}
  //   Reste à régler : {{4}} … boutique {{5}}. »
  // ⚠ SOUMIS ET APPROUVÉ, MAIS PAS ENCORE EMPLOYÉ : une dette ordinaire n'a
  // pas de date d'échéance (le retard se compte à 30 jours, lib/rappels.js).
  // Il servira le jour où on relancera sur un PLAN DE RÈGLEMENT, qui a de
  // vraies échéances. Le laisser ici n'est pas un oubli : le banc vérifie
  // qu'aucun écran ne l'emploie tant que la règle n'existe pas.
  rappel_echeance: { categorie: "utility", variables: ["client", "date", "montant", "reste", "boutique"] },
};

export const NOMS_MODELES = Object.keys(MODELES);

// Les modèles qu'un écran a le droit d'envoyer aujourd'hui.
export const MODELES_EN_SERVICE = ["devis_disponible", "relance_devis", "devis_valide_paiement"];

// ---------------------------------------------------------------
// CE QU'ON A LE DROIT DE METTRE DANS UN TROU
// ---------------------------------------------------------------
// ⚠ Meta REFUSE une variable qui contient un retour à la ligne, une
// tabulation, ou quatre espaces de suite — et refuse une variable vide.
// Un nom de client copié d'un tableau peut porter tout ça sans qu'on le
// voie. On nettoie donc AVANT d'envoyer, jamais après.
export const LONGUEUR_MAX_VARIABLE = 300;

export function texteVariable(valeur) {
  return String(valeur ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, LONGUEUR_MAX_VARIABLE);
}

// Rend "" si tout va bien, sinon la phrase à montrer.
export function critiqueModele(nom, variables) {
  const m = MODELES[nom];
  if (!m) return `Modèle inconnu : ${nom || "(aucun)"}.`;
  const liste = Array.isArray(variables) ? variables : [];
  if (liste.length !== m.variables.length) {
    return `Le modèle « ${nom} » attend ${m.variables.length} information(s), il en reçoit ${liste.length}.`;
  }
  const vide = m.variables[liste.findIndex((v) => !texteVariable(v))];
  if (vide) return `Il manque « ${vide} » pour envoyer ce message.`;
  return "";
}

// ---------------------------------------------------------------
// LE MUR — un compte ou une donnée de FORMATION n'écrit jamais à un vrai
// client. Ce refus-ci n'est pas une gêne, c'est la règle du 04/09.
// ⚠ C'est l'espace de la DONNÉE qui décide, jamais celui de la personne qui
// clique : l'administrateur principal est un compte RÉEL même quand il
// regarde la formation (leçon de `retenueOutilPourPrime`, 18/09/2026).
// L'écran passe donc l'espace du DEVIS, pas le sien.
// ---------------------------------------------------------------
export const MOTIF_FORMATION = "Espace formation : aucun vrai message WhatsApp ne part d'ici.";

// ⚠ Le premier message d'un client porte ses identifiants — voir
// `clientDejaContacte` plus bas. Ce n'est pas une panne, c'est une règle :
// le motif le dit, pour qu'on ne le prenne pas pour un défaut.
export const MOTIF_PREMIER_CONTACT = "Premier message à ce client : il porte ses identifiants, il part de votre WhatsApp.";

// ⚠⚠ DEUX SORTES DE MOTIFS, ET ILS NE SE DISENT PAS PAREIL (19/09/2026,
// Timo : « quand je clique sur relancer, ça ouvre le WhatsApp sur
// l'ordinateur »). Le repli marchait — mais le motif était CALCULÉ puis JETÉ,
// donc personne ne pouvait savoir si c'était voulu ou si quelque chose
// n'allait pas. **Un repli muet ressemble à une panne.**
//   • ATTENDU (formation, premier contact) : c'est la règle qui joue, tout
//     va bien, on ne dérange personne avec une fenêtre.
//   • TOUT LE RESTE (serveur pas configuré, modèle pas encore approuvé,
//     réseau, numéro illisible) : ça SE DIT, sinon on cherche à l'aveugle.
export const MOTIFS_ATTENDUS = [MOTIF_FORMATION, MOTIF_PREMIER_CONTACT];
export const motifAttendu = (motif) => MOTIFS_ATTENDUS.includes(String(motif || ""));

export function critiqueEnvoiAuto({ modele, variables, tel, espaceFormation, premierContact = false, enLigne = true }) {
  if (espaceFormation) return MOTIF_FORMATION;
  if (premierContact) return MOTIF_PREMIER_CONTACT;
  if (!MODELES_EN_SERVICE.includes(modele)) return `Le modèle « ${modele} » n'est pas encore en service.`;
  if (!String(tel || "").replace(/\D/g, "")) return "Ce client n'a pas de numéro de téléphone enregistré.";
  if (!enLigne) return "Pas de connexion : le message ne peut pas partir du numéro BMI.";
  return critiqueModele(modele, variables);
}

// ---------------------------------------------------------------
// CE QUE CHAQUE MODÈLE REÇOIT
// ---------------------------------------------------------------
// Le DOMAINE en un mot, celui du CLIENT — jamais celui du code (« garage »
// est notre mot, le sien est « portail »). Il ne doit jamais être vide :
// une variable vide fait refuser l'envoi.
export function domaineDevis(devis) {
  const t = devis?.type_devis || "solaire";
  if (t === "garage") return "portail";
  if (t === "autre") return texteVariable(devis?.besoins?.categorie) || "installation";
  return "solaire";
}

// Le nom qu'on écrit au client : son nom d'état civil, pas son identifiant.
export const nomPourClient = (compte) => texteVariable(compte?.nom_base || compte?.nom);

// 📄 LE DEVIS EST PRÊT (premier envoi).
export function envoiDevisDisponible({ devis, compte, fmt }) {
  return {
    modele: "devis_disponible",
    variables: [nomPourClient(compte), domaineDevis(devis), texteVariable(fmt(devis?.total))],
  };
}

// 📲 LA RELANCE — le modèle DÉPEND DU STATUT, comme le texte d'aujourd'hui
// (`texteRelanceDevis`, lib/comptesClients.js) : un devis proposé se relance,
// un devis validé se règle. Payé, rejeté, en demande de modification : rien
// ne part (c'est déjà la règle du 09/09/2026).
export function envoiRelanceDevis({ devis, compte, fmt, dFR }) {
  const statut = devis?.statut || "propose";
  if (statut === "propose") {
    return {
      modele: "relance_devis",
      variables: [nomPourClient(compte), domaineDevis(devis), texteVariable(fmt(devis?.total)), texteVariable(dFR(devis?.date))],
    };
  }
  if (statut === "valide") {
    return {
      modele: "devis_valide_paiement",
      variables: [
        nomPourClient(compte),
        texteVariable(fmt(devis?.total)),
        texteVariable(devis?.contrat_numero) || "en cours",
        texteVariable(devis?.boutique_paiement || devis?.boutique) || "BMI TOGO",
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------
// LE PREMIER MESSAGE PART TOUJOURS À LA MAIN
// ---------------------------------------------------------------
// ⚠ Le tout premier devis d'un client porte SES IDENTIFIANTS — et un modèle
// ne peut pas les porter (leçon 2 plus haut). Si l'envoi automatique prenait
// la main dès le premier devis, le client recevrait un lien vers un espace
// où il ne saurait pas entrer. Tant qu'il n'a pas reçu ses codes, on ouvre
// WhatsApp comme avant, et c'est le vendeur qui envoie.
//
// « Il les a déjà » se lit sur deux traces, et il suffit d'UNE : il porte un
// AUTRE devis (il en a donc déjà reçu un), ou il a déjà ouvert l'application
// (le mot d'accueil est daté sur sa fiche).
export function clientDejaContacte(compte, devisId) {
  if (!compte) return false;
  if (compte.info_donnees_le) return true;
  return (compte.devis || []).some((d) => d && d.id !== devisId);
}

// ---------------------------------------------------------------
// LA TRACE — ce qui se lit sous la ligne du devis
// ---------------------------------------------------------------
// ⚠ Elle dit « remis à WhatsApp », PAS « lu ». Savoir qu'un client a lu
// demande que Meta nous rappelle (une adresse de retour qui n'existe pas
// encore) : l'écrire aujourd'hui serait rassurer à tort.
// ⚠⚠ ELLE PORTE L'IDENTIFIANT DE L'ENVOYEUR, PAS SEULEMENT SON NOM
// (défaut du 20/09/2026). L'étape 2 s'en sert pour ranger la réponse du
// client « dans l'espace du personnel qui a écrit » : avec le nom seul,
// aucune conversation ne trouvait son propriétaire. Un nom est un
// affichage, un identifiant est une personne — et deux employés peuvent
// porter le même nom (l'histoire des deux ESSO, le matin même).
export function traceEnvoi({ modele, par, par_id, quand, heure, id }) {
  return {
    modele: String(modele || ""),
    le: String(quand || ""),
    heure: String(heure || ""),
    par: String(par || ""),
    par_id: String(par_id || ""),
    id: String(id || ""),
    canal: "whatsapp_bmi",
  };
}

export function libelleTrace(trace) {
  if (!trace || !trace.le) return "";
  const qui = trace.par ? ` par ${trace.par}` : "";
  const quand = trace.heure ? `${trace.le} à ${trace.heure}` : trace.le;
  return `📲 Envoyé du numéro BMI le ${quand}${qui}`;
}

// ---------------------------------------------------------------
// QUAND ÇA RATE
// ---------------------------------------------------------------
// ⚠ On ne perd JAMAIS un message en silence : tout échec ramène le bouton
// WhatsApp d'aujourd'hui. Le motif se dit en français, jamais un code.
export const MOTIF_ECHEC = {
  401: "Votre session a expiré. Reconnectez-vous, puis réessayez.",
  403: "Ce compte n'a pas le droit d'envoyer un message au nom de BMI.",
  429: "Trop de messages d'un coup : WhatsApp demande d'attendre un moment.",
  500: "Le serveur n'est pas encore configuré pour WhatsApp.",
};

// ---------------------------------------------------------------
// ⚠⚠ ET QUAND C'EST WHATSAPP QUI REFUSE : ON TRADUIT (20/09/2026)
// ---------------------------------------------------------------
// Le refus de Meta arrive EN ANGLAIS, et tel quel : « The template is
// unavailable, status: PENDING », « User is not eligible to receive
// marketing messages »… Une vendeuse de Lomé n'a aucune raison de le
// comprendre, et un message qu'on ne comprend pas ressemble à une panne
// (même leçon que le repli muet du 19/09). On le dit donc en français.
//
// ⚠ DEUX FAÇONS DE RECONNAÎTRE UN REFUS, et la première vaut mieux :
//   • le CODE de Meta (un nombre : 132001, 131050…) — un FAIT, qui ne
//     change pas quand Meta réécrit ses phrases ;
//   • les MOTS de la phrase — un repli, pour YCloud (qui a ses propres
//     messages) et pour les refus sans code.
// Le code est essayé d'abord. Les `marques` d'une règle doivent TOUTES se
// trouver dans la phrase : un seul mot (« template ») attraperait n'importe
// quoi et on finirait par traduire de travers.
//
// ⚠⚠ CE QU'ON NE CONNAÎT PAS RESTE EN ANGLAIS, EN ENTIER. C'est la règle
// la plus importante du point : deviner la traduction d'un motif inconnu,
// ce serait inventer une explication — exactement ce qu'on ne fait pas.
// Un motif non reconnu s'affiche donc précédé de « WhatsApp a refusé le
// message : », et la phrase d'origine dessous, mot pour mot.
//
// ⚠ Cette liste n'a pas vocation à tout couvrir. Ne l'allonger qu'avec un
// motif VU pour de vrai (capture, journal) : une règle écrite « au cas où »
// est une règle qu'on n'a jamais éprouvée.
export const PREFIXE_REFUS_WHATSAPP = "WhatsApp a refusé le message :";

export const MOTIFS_WHATSAPP = [
  // — Le modèle lui-même —
  // (celui que BMI verra le plus tant que Meta n'a pas fini son examen)
  { marques: ["template", "unavailable"], dit: "Ce modèle de message n'est pas encore approuvé par WhatsApp. Il faut attendre la réponse de Meta." },
  { marques: ["template", "pending"], dit: "Ce modèle de message est encore en cours d'examen chez WhatsApp." },
  { marques: ["template", "rejected"], dit: "Ce modèle de message a été refusé par WhatsApp." },
  { code: 132001, dit: "Ce modèle de message n'existe pas chez WhatsApp, ou pas en français." },
  { code: 132015, dit: "Ce modèle de message est suspendu par WhatsApp (trop de personnes l'ont signalé)." },
  { code: 132016, dit: "Ce modèle de message a été désactivé par WhatsApp." },
  { code: 132000, dit: "Le message n'a pas le bon nombre d'informations : c'est un défaut de l'application, à signaler." },

  // — Le client —
  { code: 131050, dit: "Ce client a demandé à ne plus recevoir de messages commerciaux sur WhatsApp." },
  { code: 131049, dit: "WhatsApp n'a pas remis ce message : elle limite les messages commerciaux qu'une même personne reçoit. Envoyez-le vous-même, ou réessayez plus tard." },
  { code: 131026, dit: "Ce numéro ne peut pas recevoir de message WhatsApp (pas de compte WhatsApp, ou un réglage l'en empêche)." },
  { code: 131047, dit: "Plus de 24 h se sont écoulées depuis le dernier message du client : WhatsApp n'accepte plus qu'un modèle approuvé." },
  { marques: ["invalid", "phone"], dit: "Ce numéro n'est pas un numéro WhatsApp valide." },

  // — Le compte BMI, et le raccordement —
  { code: 130429, dit: "Trop de messages d'un coup : WhatsApp demande d'attendre un moment." },
  { marques: ["rate limit"], dit: "Trop de messages d'un coup : WhatsApp demande d'attendre un moment." },
  { code: 131031, dit: "Le compte WhatsApp de BMI est restreint par Meta en ce moment." },
  { code: 368, dit: "Le compte WhatsApp de BMI est restreint par Meta en ce moment." },
  { code: 133010, dit: "Le numéro BMI n'est pas (ou plus) raccordé chez WhatsApp." },
  { code: 190, dit: "Le raccordement WhatsApp a expiré : il faut le refaire dans la console YCloud." },

  // — YCloud, qui facture et qui relaie —
  { marques: ["insufficient", "balance"], dit: "Le crédit YCloud est épuisé : rechargez le portefeuille (Settings → Billing → Recharge)." },
  { marques: ["balance", "not enough"], dit: "Le crédit YCloud est épuisé : rechargez le portefeuille (Settings → Billing → Recharge)." },
  { marques: ["api key"], dit: "Le serveur n'est pas reconnu par YCloud : la clé du raccordement est à revoir dans sa console." },
  { marques: ["unauthorized"], dit: "YCloud a refusé la demande du serveur : la clé n'est pas (ou plus) valable." },
];

// Sans accents, sans majuscules, espaces resserrés : « Rate  Limit » et
// « rate limit » sont le même motif.
export const normaliseMotif = (texte) =>
  String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Rend la phrase française, ou "" si ce motif-là n'est pas connu.
export function traduireMotifWhatsApp(texte, code) {
  const n = normaliseMotif(texte);
  const c = Number(code) || 0;
  for (const r of MOTIFS_WHATSAPP) {
    if (r.code && c && r.code === c) return r.dit;
  }
  if (!n) return "";
  for (const r of MOTIFS_WHATSAPP) {
    const marques = r.marques || [];
    if (marques.length && marques.every((m) => n.includes(m))) return r.dit;
  }
  return "";
}

// ⚠ `statut` est ce que NOTRE serveur a répondu, `code` ce que WhatsApp a
// dit. 502 = WhatsApp a répondu et a refusé — c'est le seul cas où l'on
// préfixe « WhatsApp a refusé le message », parce que c'est le seul où
// c'est vrai (une panne de réseau, elle, vient de chez nous).
export const STATUT_REFUS_WHATSAPP = 502;

export function motifEchecWhatsApp({ statut, erreur, code } = {}) {
  if (MOTIF_ECHEC[statut]) return MOTIF_ECHEC[statut];
  const traduit = traduireMotifWhatsApp(erreur, code);
  if (traduit) return traduit;
  const brut = String(erreur || "");
  if (!brut) return "L'envoi automatique n'a pas abouti.";
  return Number(statut) === STATUT_REFUS_WHATSAPP ? `${PREFIXE_REFUS_WHATSAPP}\n${brut}` : brut;
}

// La phrase exacte que l'écran montre quand l'envoi du numéro BMI n'a pas eu
// lieu pour une raison qui n'était PAS prévue. Elle dit aussi ce qui s'est
// passé à la place — sinon on croit que rien n'est parti.
// ⚠ Ce que l'écran annonce APRÈS l'envoi d'un devis. Il ne peut plus dire
// « WhatsApp s'ouvre » dans tous les cas : quand le message part du numéro
// BMI, WhatsApp ne s'ouvre PAS. Une phrase qui décrit autre chose que ce qui
// vient de se passer fait douter de tout le reste. Écrite UNE fois, pour les
// deux endroits qui envoient un devis (le volet, et Mes brouillons).
export const messageDevisEnvoye = (nomClient, auto) =>
  `✅ Devis envoyé dans l'espace de ${nomClient}.\n\n`
  + (auto
      ? "Le client a reçu un message WhatsApp du numéro BMI."
      : "WhatsApp s'ouvre avec ses identifiants et le lien.");

export const messageRepli = (motif) =>
  `📲 Le message n'est pas parti du numéro BMI.\n\n${motif}\n\nWhatsApp s'ouvre avec le texte complet : vous pouvez l'envoyer vous-même, comme avant.`;

// ---------------------------------------------------------------
// LE NUMÉRO, TEL QUE WHATSAPP LE VEUT
// ---------------------------------------------------------------
// ⚠ Chez nous un numéro s'écrit « 90 11 22 33 », « +228 90112233 »,
// « 0022890112233 »… WhatsApp, lui, n'en accepte qu'une forme. La règle est
// celle que l'application applique déjà pour reconnaître un client
// (`memeNumero`, 8 derniers chiffres) : 8 chiffres = un numéro togolais, on
// pose l'indicatif ; sinon on garde ce qui est écrit.
export const INDICATIF_TOGO = "228";

export function numeroWhatsApp(tel) {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = INDICATIF_TOGO + d;
  return `+${d}`;
}
