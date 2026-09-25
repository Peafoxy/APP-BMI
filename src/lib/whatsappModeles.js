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
//      votre vendeur » dans les modèles de devis.
//      ⚠ RETOURNÉ EN PARTIE le 22/09/2026 : le modèle `espace`, écrit par
//      Timo SANS les mots « mot de passe » ni « identifiant » (« votre
//      espace avec : {{2}} et {{3}} »), a été APPROUVÉ en utility. C'est
//      donc le SEUL modèle qui porte un secret, et il ne sert qu'à remettre
//      ses identifiants à un compte qu'on vient de créer — jamais à un
//      devis. Les modèles de devis restent sans aucune variable secrète ;
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
  // ⚠ EN SERVICE DEPUIS LE 20/09/2026 (décision « c » de Timo) — il ne
  // servait à rien tant qu'on ne relançait que des dettes ORDINAIRES, qui
  // n'ont pas d'échéance (le retard se compte à 30 jours, lib/rappels.js).
  // Il ne part QUE sur une dette adossée à un PLAN DE RÈGLEMENT accepté,
  // qui a de vraies dates. Sur une dette ordinaire, c'est `rappel_dette`.
  rappel_echeance: { categorie: "utility", variables: ["client", "date", "montant", "reste", "boutique"] },
  // « Bonjour {{1}}, ici BMI Togo. Concernant votre achat du {{2}}, il reste
  //   {{3}} à régler sur un total de {{4}}. … »
  // ⚠ UTILITY, et c'est juste : un rappel de paiement porte sur une
  // transaction EN COURS — au contraire d'un devis, qui est une OFFRE et
  // que Meta range dans marketing (leçon du refus `INCORRECT_CATEGORY`).
  rappel_dette: { categorie: "utility", variables: ["client", "date", "reste", "total"] },
  // « Bonjour {{1}}, c'est {{2}} de BMI Togo. Nous revenons vers vous
  //   concernant {{3}}. Répondez simplement à ce message et nous
  //   poursuivrons notre échange ici. Merci et à bientôt. BMI Togo »
  //
  // ⚠⚠ LE SEUL MODÈLE QUI NE PARLE PAS D'UN DEVIS — c'est exactement sa
  // raison d'être (Timo, 20/09/2026 : « comment engager une 1re discussion
  // WhatsApp avec quelqu'un qui n'a jamais écrit à BMI depuis
  // l'application »). Les quatre autres citent tous un devis : sans celui-ci
  // on ne pouvait PAS écrire le premier à un client qui n'en a pas, et Meta
  // n'accepte qu'un modèle approuvé hors de la fenêtre de 24 h.
  // ⚠ CATÉGORIE MARKETING, jamais utility : un premier contact n'est lié à
  // aucune transaction en cours (leçon du refus `INCORRECT_CATEGORY`).
  // ⚠ `{{2}}` EST LE NOM DE L'UTILISATEUR qui écrit (sa précision, mot pour
  // mot le jour même), jamais le nom de la boutique ni celui de BMI.
  // ⚠ `{{3}}` est TAPÉ par le vendeur (« votre installation solaire ») : il
  // n'y a aucune donnée à aller chercher, donc rien à deviner de travers.
  prise_de_contact: { categorie: "marketing", variables: ["client", "auteur", "sujet"] },
  // « Bonjour Mr/Mme {{1}}, BIENVENUE SUR https://gestion.bmitogo.com
  //   votre espace avec : {{2}} et {{3}} À bientôt ! BMI TOGO — … »
  //
  // ⚠⚠ LES IDENTIFIANTS PARTENT DU NUMÉRO BMI (capture Timo, 22/09/2026 :
  // « la création d'un compte redirige toujours vers le WhatsApp du
  // téléphone… le message ne passe pas par le numéro BMI »). Le modèle
  // était approuvé depuis le matin et volontairement PAS branché (décision
  // du 21/09) ; sa capture le branche. Texte de Timo, mot pour mot, trois
  // trous : {{1}} le NOM, {{2}} l'IDENTIFIANT, {{3}} le MOT DE PASSE.
  // ⚠ UTILITY (sa précision) : la remise d'un accès à un compte qu'on vient
  // de créer est liée à une relation en cours, pas une offre.
  // ⚠ C'est le SEUL modèle qui porte un secret — voir le point 2 en tête.
  // ⚠ `premierContact` ne s'applique PAS à lui : c'est précisément le
  // message qui porte les identifiants. Le texte de repli (l'envoi à la
  // main, lib/comptesClients.js) reste celui d'avant — décision Timo du
  // 21/09 : « je veux que les 2 existent ».
  espace: { categorie: "utility", variables: ["client", "identifiant", "mot_de_passe"] },
  // 💙 LE MOT DE FIDÉLITÉ DEPUIS 📋 CLIENTS (23/09/2026, nouveauté 1 de Timo :
  // « lorsqu'on appuie sur WhatsApp sur la fiche client, qu'un message
  // WhatsApp soit envoyé au client depuis le numéro BMI »). Texte écrit par
  // Timo, mot pour mot (TEXTE_FIDELITE), UN trou : le nom. MARKETING (il
  // fait de la promotion : « Découvrez nos services »). Décision « 2 » :
  // DEUX modèles, le second SANS les deux lignes « Votre espace client » —
  // un client sans compte n'a pas d'espace, on ne lui en annonce pas un.
  mot_fidelite: { categorie: "marketing", variables: ["client"] },
  mot_fidelite_simple: { categorie: "marketing", variables: ["client"] },
  // 🧾 LE REÇU AUTOMATIQUE À L'ENCAISSEMENT (23/09/2026, nouveauté 2 : « à
  // chaque encaissement lors d'une vente, qu'un message WhatsApp soit
  // automatiquement envoyé au client… sans validation »). UTILITY : il porte
  // sur UNE transaction (reçu, montant). Sept trous, tous remplis par
  // l'application depuis la vente ; ⚠ le {{6}} porte TOUTE la formule du
  // paiement (« payé en espèces », « à crédit : avance …, reste … »), parce
  // que « payé par Espèces » se lisait mal ; ⚠ le {{7}} est le téléphone de
  // la BOUTIQUE qui a vendu (sa décision), le numéro BMI principal si la
  // fiche n'en a pas — Meta refuse un trou vide.
  recu_vente: { categorie: "utility", variables: ["client", "date", "boutique", "recu", "montant", "paiement", "telephone"] },
  // 🧾 25/09/2026, Timo : « et si on veut le message long avec la liste des
  // articles ? » → « on implémente avec le détail des trous ». Le reçu
  // AVEC LES ARTICLES. ⚠ Meta refuse un retour à la ligne dans un trou : la
  // liste tient donc sur UNE ligne (« 16 × Panneau 370W · 12 × Panneau
  // 250W »), et s'arrête sur « + N autres articles » au-delà de
  // LONGUEUR_MAX_ARTICLES. UTILITY, huit trous.
  recu_vente_detail: { categorie: "utility", variables: ["client", "date", "boutique", "recu", "articles", "montant", "paiement", "telephone"] },
  // 👨‍💼 25/09/2026, Timo : « si un client demande d'être mis en relation, il
  // envoie un message WhatsApp automatiquement à moi l'administrateur ».
  // UTILITY : une alerte de service, rien de commercial. Il ne part pas vers
  // un CLIENT : c'est le SERVEUR (api/whatsapp-entrant.js) qui l'envoie au
  // numéro réglé dans ⚙ Paramètres — aucun écran ne l'envoie (il n'est donc
  // pas dans MODELES_EN_SERVICE).
  alerte_conseiller: { categorie: "utility", variables: ["administrateur", "client", "numero"] },
  // 🧾 25/09/2026, Timo : « les réservations et les règlements de dette
  // auront aussi les messages ? » → « Lance avec ces deux textes ».
  // UTILITY tous les deux : des transactions en cours.
  recu_reglement: { categorie: "utility", variables: ["client", "montant", "date", "paiement", "numero", "situation", "telephone"] },
  recu_reservation: { categorie: "utility", variables: ["client", "date", "boutique", "numero", "montant", "situation", "telephone"] },
};

export const NOMS_MODELES = Object.keys(MODELES);

// Les modèles qu'un écran a le droit d'envoyer aujourd'hui.
export const MODELES_EN_SERVICE = [
  "devis_disponible", "relance_devis", "devis_valide_paiement", "prise_de_contact",
  // 📋 Dettes, 20/09/2026 (décision « c ») : la relance d'une dette part
  // du numéro BMI. Mis en service AVANT l'accord de Meta (d'ici là, repli
  // sur l'ouverture WhatsApp, refus dit en français) pour éviter un second
  // déploiement le jour de l'accord — **approuvé par Meta le 22/09/2026**,
  // avec `prise_de_contact` et le modèle `espace`.
  "rappel_echeance", "rappel_dette",
  // ⚠ `espace` était volontairement NON branché (décision du 21/09 : les
  // identifiants partent à la main). BRANCHÉ le 22/09/2026 au soir, sur sa
  // capture : « le message ne passe pas par le numéro BMI ».
  "espace",
  // 23/09/2026 : les deux nouveautés de Timo. En service AVANT l'accord de
  // Meta (d'ici là : repli sur l'ouverture WhatsApp pour le mot de
  // fidélité ; RIEN pour le reçu de vente, qui ne dérange jamais le vendeur).
  "mot_fidelite", "mot_fidelite_simple", "recu_vente",
  // 25/09/2026 : le reçu AVEC la liste des articles. Tenté D'ABORD ; tant
  // que Meta ne l'a pas approuvé, l'écran retombe sur `recu_vente`.
  "recu_vente_detail",
  // 25/09/2026 : les reçus d'un versement sur une dette et d'une réservation.
  // En service AVANT l'accord de Meta : d'ici là rien ne part, et l'écran le
  // dit discrètement (même règle que le reçu de vente).
  "recu_reglement", "recu_reservation",
];

// ---------------------------------------------------------------
// 🔑 LES IDENTIFIANTS D'UN COMPTE QU'ON VIENT DE CRÉER (22/09/2026)
// ---------------------------------------------------------------
// L'ordre des trous est celui du modèle `espace` chez Meta : le nom, puis
// l'identifiant, puis le mot de passe. Intervertir les deux derniers
// enverrait le mot de passe à la place de l'identifiant, et Meta ne s'en
// plaindrait pas — d'où UNE fabrique, lue par le seul chemin d'envoi.
export function envoiIdentifiants({ nomAffiche, identifiant, motDePasse }) {
  return {
    modele: "espace",
    variables: [String(nomAffiche || "").toUpperCase(), String(identifiant || ""), String(motDePasse || "")],
  };
}

// ---------------------------------------------------------------
// 🔑 LE MESSAGE `espace` DANS LA CONVERSATION 📲 WHATSAPP (23/09/2026)
// ---------------------------------------------------------------
// Timo : « lorsqu'un utilisateur crée un utilisateur dont les infos sont
// envoyées par le WhatsApp BMI à travers l'app, le message ne devrait pas
// être visible pour tout le monde… seuls le créateur et l'administrateur
// peuvent voir le message en clair dans les discussions WhatsApp de BMI ».
// ⚠⚠ LE MOT DE PASSE N'EST JAMAIS ÉCRIT DANS LA CONVERSATION. La ligne
// rangée dans le fil porte le texte du modèle avec ses deux trous MASQUÉS
// (`texteEspaceMasque`) et l'identifiant du compte concerné (`wa_acces`) ;
// c'est l'ÉCRAN qui remplit les trous à l'affichage, pour le créateur et
// l'administrateur seulement, en RECALCULANT le mot de passe depuis la
// fiche (motDePasseConnu, comme « ↻ Renvoyer »). Un simple masque posé sur
// un texte complet aurait laissé le mot de passe descendre sur le téléphone
// de chaque personne qui voit la conversation — masquer n'est pas protéger
// (leçon du numéro de compte, 19/09).
// Le texte est celui du modèle `espace` chez Meta, écrit par Timo.
export const MASQUE_ACCES = "••••••";
export const TEXTE_ESPACE = "Bonjour Mr/Mme {{1}},\n\nBIENVENUE SUR\nhttps://gestion.bmitogo.com\n\nvotre espace avec :\n{{2}} et\n{{3}}\n\nÀ bientôt !\nBMI TOGO — Les bâtiments modernes et intelligents";
export function texteEspace({ nomAffiche, identifiant, motDePasse }) {
  return TEXTE_ESPACE
    .replace("{{1}}", String(nomAffiche || "").toUpperCase())
    .replace("{{2}}", String(identifiant || MASQUE_ACCES))
    .replace("{{3}}", String(motDePasse || MASQUE_ACCES));
}
export const texteEspaceMasque = (nomAffiche) => texteEspace({ nomAffiche, identifiant: MASQUE_ACCES, motDePasse: MASQUE_ACCES });
// Qui lit les codes en clair : l'administrateur, et celui qui a envoyé la
// ligne (le créateur du compte, ou celui qui a cliqué « ↻ Renvoyer »).
export const peutLireAcces = (m, lecteur) => !!(m && m.wa_acces && lecteur
  && (lecteur.role === "admin" || (lecteur.id != null && m.de_id === lecteur.id)));
// Ce que l'écran affiche pour une ligne du fil. `acces` = { identifiant,
// motDePasse } recalculés par l'écran depuis la fiche du client — la règle
// ne reçoit jamais la base. Sans droit, ou sans fiche, le texte masqué.
export function texteAccesAffiche(m, lecteur, acces) {
  if (!m || !m.wa_acces) return m ? m.texte : "";
  if (!peutLireAcces(m, lecteur) || !acces || !acces.identifiant || !acces.motDePasse) return m.texte;
  return texteEspace({ nomAffiche: m.wa_nom, identifiant: acces.identifiant, motDePasse: acces.motDePasse });
}

// Ce que l'écran dit APRÈS l'envoi des identifiants — UNE phrase pour les
// six écrans qui créent ou renvoient un compte. Un repli muet ressemble à
// une panne (leçon du 19/09) : quand le message n'est pas parti du numéro
// BMI, on dit pourquoi, sauf quand c'est la règle qui joue (formation).
export function messageIdentifiants(nom, r) {
  const qui = String(nom || "").toUpperCase();
  if (r && r.auto) return `✅ Identifiants envoyés du numéro BMI à ${qui}.`;
  const motif = r && r.motif ? String(r.motif) : "";
  if (!motif || motif === MOTIF_FORMATION) return "";
  return `${motif}\n\nWhatsApp s'est ouvert avec les identifiants : le message part de VOTRE numéro.`;
}

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
// 📋 LA RELANCE D'UNE DETTE (20/09/2026, décision « c » de Timo)
// ---------------------------------------------------------------
// Capture Timo, 20/09/2026 : « la relance de dette ouvre encore le WhatsApp
// sur l'ordinateur ». Ce n'était pas un défaut — ça n'avait jamais été
// construit : l'étape 1 du 19/09 ne portait que sur les DEVIS. Il a tranché
// « c » : un modèle pour une dette ordinaire, ET `rappel_echeance` branché
// sur les plans de règlement.
//
// ⚠⚠ DEUX MODÈLES, UNE SEULE RÈGLE POUR CHOISIR — et c'est tout l'intérêt.
// Une dette ORDINAIRE n'a pas d'échéance : lui en inventer une serait
// écrire une date fausse dans un message à un client. Une dette adossée à
// un PLAN DE RÈGLEMENT accepté en a de vraies : c'est là, et seulement là,
// que `rappel_echeance` a un sens.
//
// ⚠ L'échéance est CALCULÉE PAR L'ÉCRAN (lib/reglement.js, `prochaineEcheance`)
// et passée ici. Cette fonction ne va chercher ni devis ni chantier : une
// règle pure qui reçoit une table entière et la PARCOURT est un passage de
// mur en puissance (leçon payée deux fois le 18/09).
export function envoiRappelDette({ dette, compte, echeance, fmt, dFR }) {
  const total = Number(dette?.montant || 0);
  const reste = Math.max(0, total - Number(dette?.paye || 0));
  // Une dette soldée ne se relance pas : ce serait réclamer de l'argent déjà reçu.
  if (reste <= 0) return null;
  const nom = nomPourClient(compte) || texteVariable(dette?.client);
  if (echeance && echeance.date) {
    return {
      modele: "rappel_echeance",
      variables: [
        nom,
        texteVariable(dFR(echeance.date)),
        texteVariable(fmt(echeance.montant)),
        texteVariable(fmt(reste)),
        texteVariable(dette?.boutique) || "BMI TOGO",
      ],
    };
  }
  return {
    modele: "rappel_dette",
    variables: [nom, texteVariable(dFR(dette?.date)), texteVariable(fmt(reste)), texteVariable(fmt(total))],
  };
}

// ⚠ LE TEXTE DE REPLI EST CELUI DU MODÈLE, MOT POUR MOT : quand l'envoi
// automatique ne passe pas, le client doit recevoir EXACTEMENT la même
// chose par l'ouverture WhatsApp. Deux textes qui divergent, c'est un
// client qui reçoit deux versions de la même relance selon le jour.
export function texteRappelDette({ dette, compte, fmt, dFR }) {
  const total = Number(dette?.montant || 0);
  const reste = Math.max(0, total - Number(dette?.paye || 0));
  const nom = nomPourClient(compte) || texteVariable(dette?.client);
  return [
    `Bonjour ${nom}, ici BMI Togo.`,
    `Concernant votre achat du ${dFR(dette?.date)}, il reste ${fmt(reste)} à régler sur un total de ${fmt(total)}.`,
    `Vous pouvez passer en boutique ou répondre directement à ce message.`,
    `Merci de votre confiance. BMI Togo`,
  ].join("\n");
}

export function texteRappelEcheance({ dette, compte, echeance, fmt, dFR }) {
  const reste = Math.max(0, Number(dette?.montant || 0) - Number(dette?.paye || 0));
  const nom = nomPourClient(compte) || texteVariable(dette?.client);
  return [
    `Bonjour ${nom}, une échéance de votre plan de règlement BMI TOGO arrive le ${dFR(echeance?.date)}.`,
    `Montant attendu : ${fmt(echeance?.montant)}`,
    `Reste à régler : ${fmt(reste)}`,
    `Vous pouvez régler à la boutique ${dette?.boutique || "BMI TOGO"} ou répondre à ce message.`,
    `Merci de votre confiance. BMI Togo`,
  ].join("\n");
}

// Le texte de repli qui correspond au modèle choisi — écrit UNE fois, pour
// qu'aucun écran n'ait à savoir lequel des deux part.
export const texteRappel = ({ dette, compte, echeance, fmt, dFR }) =>
  (echeance && echeance.date)
    ? texteRappelEcheance({ dette, compte, echeance, fmt, dFR })
    : texteRappelDette({ dette, compte, fmt, dFR });

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
// ---------------------------------------------------------------
// LE MÊME TEXTE, QUAND LE NUMÉRO BMI N'A PAS PU L'ENVOYER
// ---------------------------------------------------------------
// ⚠ MOT POUR MOT celui du modèle approuvé : le client doit recevoir la
// MÊME chose, que le message parte du numéro BMI ou du téléphone du
// vendeur. Deux textes finiraient par diverger, et c'est le client qui
// verrait la différence.
export function texteContact({ client, auteur, sujet }) {
  return [
    `Bonjour ${String(client || "").trim() || "cher client"}, c'est ${String(auteur || "").trim()} de BMI Togo.`,
    `Nous revenons vers vous concernant ${String(sujet || "").trim()}.`,
    "Répondez simplement à ce message et nous poursuivrons notre échange ici.",
    "Merci et à bientôt. BMI Togo",
  ].join("\n");
}

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
// 📲 LA LIGNE D'UN ENVOI PAR MODÈLE DANS LA CONVERSATION (23/09/2026)
// ---------------------------------------------------------------
// Timo : « pourquoi les discussions de relance n'apparaissent pas comme
// discussion récente ?… elles ne remontent pas ». Vérifié : un devis, une
// relance de devis, un rappel de dette partaient du numéro BMI SANS écrire
// une ligne dans la conversation — seule une trace sur le devis ou la
// dette. Or 📲 WhatsApp classe une conversation par son DERNIER message :
// elle ne bougeait pas, et celui qui l'ouvrait ne voyait même pas que la
// relance était partie.
//
// Cette règle rend la phrase à écrire dans le fil, d'après le modèle et
// les mots qui ont rempli ses trous (les mêmes que Meta a reçus, déjà
// formatés). ⚠ JAMAIS UN SECRET : le modèle `espace` a SA règle (trous
// masqués, `texteEspaceMasque`) et n'entre pas ici ; `prise_de_contact`
// écrit déjà son vrai texte. Un modèle inconnu rend "" : on n'invente pas
// une phrase. ⚠ La ligne DIT ce qui est parti, jamais « livré » ni « lu ».
const LIGNES_ENVOI = {
  devis_disponible: ([client, domaine, montant]) => `Devis ${domaine} de ${montant} envoyé à ${client}.`,
  relance_devis: ([client, domaine, montant, date]) => `Relance du devis ${domaine} de ${montant} (envoyé le ${date}) à ${client}.`,
  devis_valide_paiement: ([client, montant, contrat, boutique]) => `Devis validé de ${montant} (contrat ${contrat}) : merci envoyé à ${client}, paiement en boutique ${boutique}.`,
  rappel_echeance: ([client, date, montant, reste, boutique]) => `Rappel d'échéance du ${date} à ${client} : ${montant} attendu, reste à régler ${reste} (boutique ${boutique}).`,
  rappel_dette: ([client, date, reste, total]) => `Rappel de dette à ${client} : reste ${reste} à régler sur ${total} (achat du ${date}).`,
  mot_fidelite: ([client]) => `Mot de fidélité envoyé à ${client}.`,
  mot_fidelite_simple: ([client]) => `Mot de fidélité envoyé à ${client}.`,
  recu_vente: ([client, date, boutique, recu, montant, paiement]) => `Reçu N° ${recu} envoyé à ${client} : achat du ${date} à ${boutique}, ${montant}, ${paiement}.`,
  recu_vente_detail: ([client, date, boutique, recu, articles, montant, paiement]) => `Reçu N° ${recu} envoyé à ${client} : achat du ${date} à ${boutique} (${articles}), ${montant}, ${paiement}.`,
  recu_reglement: ([client, montant, date, paiement, numero, situation]) => `Reçu de versement N° ${numero} envoyé à ${client} : ${montant} le ${date} (${paiement}), ${situation}.`,
  recu_reservation: ([client, date, boutique, numero, montant, situation]) => `Reçu de réservation N° ${numero} envoyé à ${client} : ${montant} le ${date} à ${boutique}, ${situation}.`,
};
export const MODELES_AVEC_LIGNE = Object.keys(LIGNES_ENVOI);
export const PREFIXE_LIGNE_ENVOI = "📲 Envoyé du numéro BMI — ";
export function ligneEnvoiModele(modele, variables) {
  const fabrique = LIGNES_ENVOI[String(modele || "")];
  if (!fabrique) return "";
  const v = (Array.isArray(variables) ? variables : []).map((x) => String(x == null ? "" : x).trim());
  const attendu = (MODELES[modele] || {}).variables || [];
  if (v.length !== attendu.length || v.some((x) => !x)) return "";
  return PREFIXE_LIGNE_ENVOI + fabrique(v);
}

// ---------------------------------------------------------------
// QUAND ÇA RATE
// ---------------------------------------------------------------
// ⚠ On ne perd JAMAIS un message en silence : tout échec ramène le bouton
// WhatsApp d'aujourd'hui. Le motif se dit en français, jamais un code.
export const MOTIF_ECHEC = {
  401: "La session sécurisée n'a pas pu être rétablie. Entrez votre mot de passe dans la fenêtre de verrouillage qui s'affiche, puis réessayez.",
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

// ---------------------------------------------------------------
// 💙 LE MOT DE FIDÉLITÉ DEPUIS 📋 CLIENTS (23/09/2026)
// ---------------------------------------------------------------
// Texte de Timo, mot pour mot. Le même sert de REPLI (WhatsApp ouvert sur le
// téléphone de l'employé) : le client reçoit la même chose par les deux
// chemins. ⚠ Les numéros BMI et les sites sont écrits EN DUR, comme chez
// Meta : s'ils changent, c'est un nouveau modèle.
export const NUMEROS_BMI = "+228 99 96 84 88 / +228 91 13 05 11";
export const NUMERO_BMI_PRINCIPAL = "+228 99 96 84 88";
const LIGNES_FIDELITE_DEBUT = [
  "Bonjour {{1}},",
  "🙏 Merci pour votre confiance !",
  "Toute l'équipe de BMI TOGO vous remercie sincèrement pour la confiance que vous nous accordez.",
  "Nous sommes heureux de vous accompagner dans vos projets en énergie solaire, automatisation de garage, ventilation et domotique industrielle.",
  "🤝 Votre satisfaction est notre priorité. Nous restons à votre disposition pour vous accompagner dans vos prochains besoins.",
  "🌐 Découvrez nos services :",
  "bmitogo.com",
];
const LIGNES_FIDELITE_ESPACE = ["📋 Votre espace client :", "gestion.bmitogo.com"];
const LIGNES_FIDELITE_FIN = [
  `📞 ${NUMEROS_BMI}`,
  "BMI TOGO — Les bâtiments modernes et intelligents",
  "💙💚 Merci de faire partie de nos clients !",
];
export const TEXTE_FIDELITE = [...LIGNES_FIDELITE_DEBUT, ...LIGNES_FIDELITE_ESPACE, ...LIGNES_FIDELITE_FIN].join("\n");
export const TEXTE_FIDELITE_SIMPLE = [...LIGNES_FIDELITE_DEBUT, ...LIGNES_FIDELITE_FIN].join("\n");

// Le modèle et son trou. `avecCompte` : le numéro correspond à un compte
// client de l'espace regardé → la version qui parle de son espace.
export function envoiMotFidelite({ nom, avecCompte }) {
  return {
    modele: avecCompte ? "mot_fidelite" : "mot_fidelite_simple",
    variables: [texteVariable(nom) || "cher client"],
  };
}
// Le texte de repli, mot pour mot celui du modèle choisi.
export function texteMotFidelite({ nom, avecCompte }) {
  const t = avecCompte ? TEXTE_FIDELITE : TEXTE_FIDELITE_SIMPLE;
  return t.replace("{{1}}", texteVariable(nom) || "cher client");
}

// ---------------------------------------------------------------
// 🧾 LE REÇU AUTOMATIQUE À L'ENCAISSEMENT (23/09/2026)
// ---------------------------------------------------------------
// Texte de Timo, mot pour mot (les sept trous). Il n'a PAS de repli qui
// ouvre WhatsApp : un vendeur qui encaisse dix ventes ne doit pas voir
// WhatsApp s'ouvrir dix fois. Le bouton du reçu sur la ligne reste là.
export const TEXTE_RECU_VENTE = [
  "Bonjour {{1}},",
  "Merci pour votre achat du {{2}} à {{3}}.",
  "Reçu N° {{4}} : {{5}}, {{6}}.",
  "Pour toute question veuillez contacter : {{7}}.",
  "Merci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents",
  "www.bmitogo.com",
].join("\n");

// La FORMULE du paiement (trou 6) — « payé par Espèces » se lisait mal.
// `paiement` est le moyen normalisé de la vente ; `reste` et `avance` ne
// servent qu'à crédit.
export function formulePaiement({ paiement, avance = 0, reste = 0, fmt }) {
  const p = String(paiement || "");
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  if (/cr[ée]dit/i.test(p)) {
    return Number(avance) > 0
      ? `à crédit : avance ${f(avance)}, reste ${f(reste)}`
      : `à crédit : reste ${f(reste)}`;
  }
  if (/esp[èe]ces/i.test(p)) return "payé en espèces";
  if (/flooz/i.test(p)) return "payé par Mobile Money (Flooz)";
  if (/mixx|t-?money/i.test(p)) return "payé par Mobile Money (Mixx)";
  if (/virement/i.test(p)) return "payé par virement bancaire";
  return p ? `payé par ${p}` : "payé";
}

// Le modèle et ses sept trous, depuis la vente. Rend null sans numéro de
// téléphone (rien à envoyer, et ce n'est pas une panne : la plupart des
// ventes de comptoir n'en ont pas). ⚠ `telephoneBoutique` vide → le numéro
// BMI principal, jamais un trou vide.
// ⚠⚠ LE MONTANT EST DONNÉ PAR L'ÉCRAN, jamais lu sur la vente (25/09/2026,
// capture Timo : « la facture fait 18 000 mais dans le message WhatsApp,
// 0 F »). Une vente ne porte PAS de champ `total` : son montant se CALCULE
// (articles − remises − rabais + frais, `montantEncaisseVente`). Lire
// `vente.total` envoyait « 0 F » à chaque client. Sans montant, rien ne part :
// un reçu faux au nom de BMI est pire qu'un reçu absent.
export function envoiRecuVente({ vente, boutique, montant, avance = 0, reste = 0, fmt, dFR }) {
  if (!vente || !String(vente.tel || "").replace(/\D/g, "")) return null;
  if (typeof montant !== "number" || !Number.isFinite(montant)) return null;
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  const d = typeof dFR === "function" ? dFR : (x) => String(x || "");
  const nom = texteVariable(vente.client);
  return {
    modele: "recu_vente",
    variables: [
      !nom || /client non renseign/i.test(nom) ? "cher client" : nom,
      d(vente.date) || "aujourd'hui",
      texteVariable(vente.boutique) || "BMI TOGO",
      texteVariable(vente.numero) || "—",
      f(montant),
      formulePaiement({ paiement: vente.paiement, avance, reste, fmt: f }),
      texteVariable(boutique?.tel) || NUMERO_BMI_PRINCIPAL,
    ],
  };
}
// ---------------------------------------------------------------
// 🧾 LE REÇU AVEC LA LISTE DES ARTICLES (25/09/2026)
// ---------------------------------------------------------------
// Texte à créer chez YCloud sous le nom `recu_vente_detail`, mot pour mot.
export const TEXTE_RECU_VENTE_DETAIL = [
  "Bonjour {{1}},",
  "Merci pour votre achat du {{2}} à {{3}}.",
  "Reçu N° {{4}}",
  "Articles : {{5}}",
  "Total : {{6}}, {{7}}.",
  "Pour toute question veuillez contacter : {{8}}.",
  "Merci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents",
  "www.bmitogo.com",
].join("\n");

// La liste tient sur UNE ligne (Meta refuse un retour à la ligne dans un
// trou) et reste courte : le message entier est borné par Meta. On garde des
// articles ENTIERS — jamais un nom coupé au milieu — et on dit combien il en
// reste (« + 3 autres articles »). ⚠ `lignes` vient de l'écran
// (`lignesVente`, core.js) : ce fichier n'importe rien.
export const LONGUEUR_MAX_ARTICLES = 250;
export const SEPARATEUR_ARTICLES = " · ";
export function listeArticlesRecu(lignes) {
  const morceaux = (Array.isArray(lignes) ? lignes : [])
    .map((l) => {
      const nom = texteVariable(l?.article);
      if (!nom) return "";
      const q = Number(l?.qte);
      return Number.isFinite(q) && q > 0 ? `${q} × ${nom}` : nom;
    })
    .filter(Boolean);
  if (!morceaux.length) return "";
  const suite = (n) => `+ ${n} autre${n > 1 ? "s" : ""} article${n > 1 ? "s" : ""}`;
  let pris = [];
  for (let i = 0; i < morceaux.length; i++) {
    const essai = [...pris, morceaux[i]];
    const reste = morceaux.length - essai.length;
    const texte = essai.join(SEPARATEUR_ARTICLES) + (reste ? SEPARATEUR_ARTICLES + suite(reste) : "");
    if (texte.length > LONGUEUR_MAX_ARTICLES && pris.length) break;
    pris = essai;
  }
  const reste = morceaux.length - pris.length;
  const t = pris.join(SEPARATEUR_ARTICLES) + (reste ? SEPARATEUR_ARTICLES + suite(reste) : "");
  // Un seul nom plus long que la limite (rare) : coupé, on le dit par « … ».
  return t.length > LONGUEUR_MAX_ARTICLES ? t.slice(0, LONGUEUR_MAX_ARTICLES - 1) + "…" : t;
}

// Les huit trous, depuis la vente. Les mêmes règles que `envoiRecuVente`
// (montant donné par l'écran, rien sans numéro) ; sans article lisible, rien
// non plus — l'écran retombe alors sur le reçu court.
export function envoiRecuVenteDetail({ vente, boutique, montant, lignes, avance = 0, reste = 0, fmt, dFR }) {
  const court = envoiRecuVente({ vente, boutique, montant, avance, reste, fmt, dFR });
  if (!court) return null;
  const articles = listeArticlesRecu(lignes);
  if (!articles) return null;
  const [client, date, bq, recu, mt, paiement, telephone] = court.variables;
  return { modele: "recu_vente_detail", variables: [client, date, bq, recu, articles, mt, paiement, telephone] };
}

// Le texte lisible (pour le fil, le banc, un jour un repli à la main).
export function texteRecuVente(envoi) {
  if (!envoi) return "";
  return texteRecu(envoi);
}

// ---------------------------------------------------------------
// 🧾 LE REÇU D'UN VERSEMENT, LE REÇU D'UNE RÉSERVATION (25/09/2026)
// ---------------------------------------------------------------
// Timo : « les réservations et les règlements de dette auront aussi les
// messages ? » → « Lance avec ces deux textes ». Mot pour mot chez Meta.
// Mêmes règles que le reçu de vente : ils partent tout seuls, sans question
// et SANS REPLI (WhatsApp ne s'ouvre jamais) ; rien en formation, rien sans
// numéro ; le {{7}} est le téléphone de la boutique, sinon le numéro BMI.
export const TEXTE_RECU_REGLEMENT = [
  "Bonjour {{1}},",
  "BMI TOGO a bien reçu votre versement de {{2}} le {{3}} ({{4}}).",
  "Reçu N° {{5}} : {{6}}.",
  "Pour toute question veuillez contacter : {{7}}.",
  "Merci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents",
  "www.bmitogo.com",
].join("\n");
export const TEXTE_RECU_RESERVATION = [
  "Bonjour {{1}},",
  "Votre réservation du {{2}} à {{3}} est bien enregistrée.",
  "Réservation N° {{4}} : {{5}}, {{6}}.",
  "La marchandise vous sera remise dès qu'elle sera disponible.",
  "Pour toute question veuillez contacter : {{7}}.",
  "Merci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents",
].join("\n");

// Le moyen d'un VERSEMENT, en toutes lettres (trou 4) : la formule du reçu
// de vente sans son « payé ». Un versement n'est jamais « à crédit ».
export function moyenVersement(paiement) {
  const p = String(paiement || "");
  if (!p || /cr[ée]dit/i.test(p)) return "en espèces";
  return formulePaiement({ paiement: p }).replace(/^payé /, "");
}
// Où en est la dette APRÈS ce versement (trou 6).
export function situationDette({ total, paye, fmt }) {
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  const reste = Math.max(0, Number(total || 0) - Number(paye || 0));
  return reste > 0 ? `il reste ${f(reste)} sur un total de ${f(Number(total || 0))}` : "votre compte est soldé, merci";
}
const nomClientRecu = (nom) => {
  const n = texteVariable(nom);
  return !n || /client non renseign/i.test(n) ? "cher client" : n;
};
// `dette` = la dette APRÈS le versement ; `versement` = la ligne qu'on vient
// d'ajouter. Rend null sans numéro ou sans montant (rien à envoyer).
// `numeroDe` = la règle du numéro de reçu (`numeroRecuDette`, core.js — ce
// fichier n'importe rien) : une vieille dette sans numéro enregistré reçoit
// le MÊME numéro que son reçu imprimé, jamais un tiret (Timo, 25/09/2026).
const numeroDeLaDette = (d, numeroDe) =>
  texteVariable(typeof numeroDe === "function" ? numeroDe(d) : d.numero) || "—";
export function envoiRecuReglement({ dette, versement, boutique, fmt, dFR, numeroDe }) {
  if (!dette || !String(dette.tel || "").replace(/\D/g, "")) return null;
  const m = Number(versement?.montant);
  if (!Number.isFinite(m) || m <= 0) return null;
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  const d = typeof dFR === "function" ? dFR : (x) => String(x || "");
  return {
    modele: "recu_reglement",
    variables: [
      nomClientRecu(dette.client),
      f(m),
      d(versement.date) || "aujourd'hui",
      moyenVersement(versement.paiement),
      numeroDeLaDette(dette, numeroDe),
      situationDette({ total: dette.montant, paye: dette.paye, fmt: f }),
      texteVariable(boutique?.tel) || NUMERO_BMI_PRINCIPAL,
    ],
  };
}
// La réservation telle qu'enregistrée (son avance est DANS `paye` : on ne
// l'annonce pas une seconde fois par un reçu de versement).
export function envoiRecuReservation({ reservation, boutique, fmt, dFR, numeroDe }) {
  const r = reservation;
  if (!r || !String(r.tel || "").replace(/\D/g, "")) return null;
  const total = Number(r.montant);
  if (!Number.isFinite(total) || total <= 0) return null;
  const f = typeof fmt === "function" ? fmt : (n) => `${n} F`;
  const d = typeof dFR === "function" ? dFR : (x) => String(x || "");
  const paye = Math.max(0, Number(r.paye || 0));
  const reste = Math.max(0, total - paye);
  const situation = reste <= 0 ? "entièrement payée"
    : paye > 0 ? `avance ${f(paye)}, reste ${f(reste)}` : `aucune avance, reste ${f(reste)}`;
  return {
    modele: "recu_reservation",
    variables: [
      nomClientRecu(r.client),
      d(r.date) || "aujourd'hui",
      texteVariable(r.boutique) || "BMI TOGO",
      numeroDeLaDette(r, numeroDe),
      f(total),
      situation,
      texteVariable(boutique?.tel) || NUMERO_BMI_PRINCIPAL,
    ],
  };
}
// Le texte lisible d'un envoi, quel que soit le reçu.
export function texteRecu(envoi) {
  if (!envoi) return "";
  const t = { recu_vente: TEXTE_RECU_VENTE, recu_vente_detail: TEXTE_RECU_VENTE_DETAIL, recu_reglement: TEXTE_RECU_REGLEMENT, recu_reservation: TEXTE_RECU_RESERVATION }[envoi.modele];
  return t ? envoi.variables.reduce((x, v, i) => x.replace(`{{${i + 1}}}`, v), t) : "";
}

// ---------------------------------------------------------------
// 👨‍💼 L'ALERTE À L'ADMINISTRATEUR : UN CLIENT DEMANDE UNE PERSONNE (25/09/2026)
// ---------------------------------------------------------------
// Texte de Timo (« Lance avec ce texte »), mot pour mot chez Meta :
export const TEXTE_ALERTE_CONSEILLER = "Bonjour {{1}}, un client demande à parler à un conseiller : {{2}} ({{3}}). Répondez-lui depuis l'application BMI, onglet WhatsApp. BMI TOGO";
// Le réglage : `alerte_conseiller = { tel, nom }` sur les boutiques (une
// politique, comme l'assistant — rien à coller), lu sur une boutique RÉELLE
// seulement : une boutique de formation ne commande pas une alerte réelle.
export function alerteConseillerDe(boutiques) {
  const b = (boutiques || []).find((x) => x && !x.formation && x.alerte_conseiller && x.alerte_conseiller.tel);
  return b ? { tel: String(b.alerte_conseiller.tel), nom: String(b.alerte_conseiller.nom || "") } : null;
}
export const poserAlerteConseiller = (boutiques, reglage) =>
  (boutiques || []).map((b) => ({ ...b, alerte_conseiller: reglage && reglage.tel ? { tel: String(reglage.tel), nom: String(reglage.nom || "") } : null }));
// Vide = alerte coupée (accepté). Sinon : un vrai numéro, et JAMAIS le numéro
// BMI lui-même (il ne peut pas s'écrire à lui-même).
export function critiqueNumeroAlerte(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length < 8) return "Ce numéro est trop court : écrivez les 8 chiffres (ou avec l'indicatif +228).";
  if (d.slice(-8) === NUMERO_BMI_PRINCIPAL.replace(/\D/g, "").slice(-8)) return "C'est le numéro BMI lui-même : il ne peut pas s'écrire à lui-même. Mettez votre numéro personnel.";
  return "";
}
// Les trois trous, dans l'ordre du modèle. Jamais un trou vide (Meta refuse).
export function variablesAlerte({ administrateur, client, numero } = {}) {
  return [texteVariable(administrateur) || "administrateur", texteVariable(client) || "client sans nom", texteVariable(numero) || "numéro inconnu"];
}
