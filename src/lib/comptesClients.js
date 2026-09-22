// ============================================================
// lib/comptesClients.js — Identifiants automatiques des comptes
// clients (identifiant + mot de passe recalculables à partir du nom
// et du téléphone, jamais stockés en clair), création de compte,
// et messages WhatsApp associés.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { telDigits, uid, definirMotDePasse, hacherFort, today, dFR, envoyerWhatsApp, nouveauMessage } from "./core.js";

// Adresse publique de l'application, envoyée au client par WhatsApp.
export const ADRESSE_APP = "https://gestion.bmitogo.com";

// ============ COMPTES CLIENTS : IDENTIFIANTS AUTOMATIQUES ============
// Le client ne choisit rien : nom + téléphone suffisent, sans aucune autre
// contrainte. Le mot de passe MÉLANGE les chiffres de son numéro et les
// lettres de son nom — l'ordre n'est plus un motif fixe et prévisible
// (avant : toujours 4 chiffres puis 2 lettres), mais reste ENTIÈREMENT
// déterministe à partir de nom + téléphone (+ une "variante" numérique
// mémorisée sur le compte) : on peut donc toujours le RECALCULER pour le
// renvoyer au client, sans jamais le stocker en clair.
//   Identifiant  = le nom ; si déjà pris, on y accole des chiffres du numéro
//   Mot de passe = mélange chiffres+lettres, 6 caractères par défaut ; la
//                  longueur n'augmente QUE si un mot de passe existant entre
//                  en conflit et qu'aucun mélange à 6 caractères n'y échappe
//                  (voir resoudreMotDePasseClient, utilisée à la création).
// ⚠ Déplacés dans lib/identiteClient.js pour être partagés avec la fonction
// serveur qui crée les filleuls (voir l'en-tête de ce fichier). Réexportés
// ici : tout ce qui les importait depuis comptesClients continue de marcher.
// ⚠ IMPORT **ET** RÉEXPORT, les deux sont nécessaires — et l'oubli n'est pas
// théorique : en déplaçant ces fonctions le 25/08/2026 je n'avais écrit que
// le réexport. « export { x } from "y" » ne crée AUCUNE variable locale : les
// fonctions de ce fichier appelaient alors un motDePasseClient inexistant, et
// la création d'un compte client plantait. Le banc de parrainage l'a vu.
import { chiffresTel, lettresNom, motDePasseClient, memeIdentifiant } from "./identiteClient.js";
export { chiffresTel, lettresNom, motDePasseClient, memeIdentifiant };

// Choisit un mot de passe qui n'entre en conflit avec AUCUN compte existant.
// Essaie d'abord plusieurs mélanges à 6 caractères (variantes 0 à 9) ; ce
// n'est QUE si tous entrent en conflit qu'elle allonge le mot de passe —
// exactement le comportement demandé : 6 caractères par défaut, plus long
// seulement quand il n'y a pas d'autre choix. Les mots de passe ne sont
// jamais stockés en clair : chaque compte existant est comparé via SON
// PROPRE sel (pwd_salt), déjà non secret.
// ⚠ LENTEUR MESURÉE (relevé par Timo, 18/08/2026) — cette fonction
// recalculait le VERROU de chaque compte existant pour chaque candidat.
// Ce calcul est volontairement lent (150 000 tours) : c'est ce qui protège
// les mots de passe. Multiplié par le nombre de comptes, il devenait
// interminable — mesuré à 3,3 s pour 46 comptes sur un serveur, soit 6 à
// 16 s dans un navigateur, et davantage s'il fallait un second essai.
// Deux conséquences : l'application semblait figée, et le navigateur
// finissait par bloquer l'ouverture de WhatsApp (passé environ 5 secondes,
// il considère que la page agit toute seule). Le message au client était
// perdu. Et cela EMPIRE avec le nombre de comptes.
//
// Or il n'y a rien à déchiffrer : le mot de passe d'un client est
// FABRIQUÉ à partir de son nom et de son numéro, et le compte garde de
// quoi le recalculer (mdp_variante, mdp_longueur). On compare donc des
// textes — instantané — au lieu de 46 verrous lents.
//
// Ce qu'on perd, et il faut le savoir : l'unicité n'est plus vérifiée
// contre les mots de passe CHOISIS À LA MAIN par les salariés, qu'aucun
// calcul ne peut deviner sans les hacher. Le risque est qu'un client
// tombe par hasard sur le même mot de passe qu'un vendeur — cela ne donne
// accès à rien (les identifiants diffèrent) et reste très improbable.
export async function resoudreMotDePasseClient(db, nom, tel) {
  const comptes = (db.users || []).filter((u) => u.pwd_salt && u.pwd_hash2);
  // Les mots de passe déjà attribués et recalculables, en clair.
  const dejaPris = new Set(
    (db.users || [])
      .filter((u) => u.mdp_auto && u.nom_base)
      .map((u) => motDePasseClient(u.nom_base, u.tel, u.mdp_variante ?? 0, u.mdp_longueur ?? 6))
  );
  const dejaUtilise = async (candidat) => dejaPris.has(candidat);
  for (let variante = 0; variante < 10; variante++) {
    const candidat = motDePasseClient(nom, tel, variante, 6);
    if (!(await dejaUtilise(candidat))) return { motDePasse: candidat, variante, longueur: 6 };
  }
  for (let longueur = 7; longueur <= 12; longueur++) {
    for (let variante = 0; variante < 10; variante++) {
      const candidat = motDePasseClient(nom, tel, variante, longueur);
      if (!(await dejaUtilise(candidat))) return { motDePasse: candidat, variante, longueur };
    }
  }
  // Filet de sécurité (jamais atteint en pratique) : rendre le mot de passe
  // unique en y ajoutant le nombre de comptes existants.
  return { motDePasse: motDePasseClient(nom, tel, 0, 6) + String(comptes.length), variante: 0, longueur: 6 };
}

export function identifiantClient(db, nom, tel) {
  const base = String(nom || "").trim().toUpperCase();
  const pris = (n) => (db.users || []).some((u) => String(u.nom).toUpperCase() === n);
  if (!pris(base)) return base;
  const d = chiffresTel(tel);
  const avecDeux = base + d.slice(0, 2);   // collision : on ajoute les 2 premiers chiffres
  if (!pris(avecDeux)) return avecDeux;
  const avecQuatre = base + d.slice(0, 4); // collision encore : on en ajoute 4
  if (!pris(avecQuatre)) return avecQuatre;
  let i = 2;
  while (pris(base + d.slice(0, 2) + i)) i++;
  return base + d.slice(0, 2) + i;
}

// ---------------------------------------------------------------
// ⚠⚠ UN IDENTIFIANT D'EMPLOYÉ NE SE PREND PAS DEUX FOIS (20/09/2026)
// ---------------------------------------------------------------
// Timo : « il y a un client qui s'appelle ESSO mais ce n'est pas le même mot
// de passe » — et le technicien ESSO ne pouvait plus se connecter.
// La cause n'était pas la connexion seule : **un CLIENT vérifiait que son nom
// était libre** (`identifiantClient`, sept endroits), **un EMPLOYÉ ne
// vérifiait RIEN**. On créait donc ESSO par-dessus ESSO sans un mot.
// La connexion sait maintenant départager deux homonymes par leur mot de
// passe — mais un doublon reste une confusion pour l'équipe, alors on n'en
// fabrique plus.
//
// ⚠ ON REGARDE LES DEUX ESPACES, ET C'EST VOULU. Le mur sépare les DONNÉES ;
// la connexion, elle, cherche dans toute la maison. Un ESSO d'entraînement et
// un ESSO réel se gêneraient donc pour de vrai.
export function comptesDeLIdentifiant(db, nom) {
  return (db?.users || []).filter((u) => memeIdentifiant(u.nom, nom));
}

// Rend "" si le nom est libre, sinon la phrase à montrer — qui DIT qui le
// détient déjà, sinon on ne sait pas quoi corriger.
export function critiqueIdentifiantEmploye(db, nom) {
  const vise = String(nom || "").trim();
  if (!vise) return "Entrez le nom de connexion de ce compte.";
  const pris = comptesDeLIdentifiant(db, vise)[0];
  if (!pris) return "";
  const quoi = pris.role === "client" ? "un compte client" : `celui ${roleAvecArticle(pris.role)}`;
  return `« ${vise.toUpperCase()} » est déjà l'identifiant de ${quoi}`
    + `${pris.formation ? " (espace formation)" : ""}.`
    + ` Deux comptes ne peuvent pas porter le même nom de connexion : choisissez-en un autre.`;
}

// Le nom libre le plus proche, à proposer dans le refus. Le PRÉNOM d'abord
// (« ESSO KOSSI ») — c'est ce qui distingue deux personnes pour de vrai ;
// sinon les chiffres du numéro, comme pour un client.
export function propositionIdentifiant(db, nom, prenom, tel) {
  const base = String(nom || "").trim().toUpperCase();
  const libre = (n) => !!n && comptesDeLIdentifiant(db, n).length === 0;
  const avecPrenom = `${base} ${String(prenom || "").trim().toUpperCase()}`.trim();
  if (avecPrenom !== base && libre(avecPrenom)) return avecPrenom;
  const d = chiffresTel(tel);
  for (const n of [base + d.slice(0, 2), base + d.slice(0, 4)]) if (libre(n)) return n;
  let i = 2;
  while (!libre(`${base}${i}`) && i < 100) i++;
  return `${base}${i}`;
}

// Le TEXTE des identifiants d'un client — un seul message, réutilisé partout
// (Utilisateurs, Clients, Clients installés, Prospects, Parrainage).
// ⚠ Depuis le 22/09/2026 il est le REPLI : l'envoi passe d'abord par le
// numéro BMI (modèle `espace`, src/whatsapp.js) et ne revient à
// l'ouverture WhatsApp que si ça ne part pas. Décision Timo du 21/09 :
// « je veux que les 2 existent ».
export function texteIdentifiantsClient(nomAffiche, identifiant, motDePasse) {
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Bienvenue chez BMI TOGO ! Voici votre espace personnel pour suivre votre installation solaire :`,
    ADRESSE_APP,
    ``,
    // ⚠ LE MÊME BLOC QUE POUR UN EMPLOYÉ : deux façons d'écrire la même
    // chose finiraient par diverger, et l'équipe ne saurait plus laquelle
    // est la bonne.
    `👤 Identifiant : *${identifiant}*`,
    `🔑 Mot de passe : *${motDePasse}*`,
    ``,
    `🔒 Pour votre confidentialité, nous vous recommandons de changer ce mot de passe dès votre première connexion (rubrique "🔑 Mon mot de passe" de votre espace).`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  return lignes.join("\n");
}

// L'envoi À LA MAIN (ouverture de WhatsApp sur l'appareil) — le chemin
// d'avant le 22/09/2026, gardé tel quel : c'est le repli de src/whatsapp.js,
// et le chemin du parrainage (le message du filleul part du téléphone du
// PARRAIN, c'est voulu).
export function envoyerIdentifiantsWhatsApp(nomAffiche, identifiant, motDePasse, tel, demanderConfirmation) {
  return envoyerWhatsApp(tel, texteIdentifiantsClient(nomAffiche, identifiant, motDePasse), demanderConfirmation);
}

// Libellés lisibles des rôles employés — pour le message d'invitation
// WhatsApp (ci-dessous) et nulle part ailleurs pour l'instant.
export const LIBELLE_ROLE_EMPLOYE = {
  vendeur: "Vendeur", gerant: "Gérant de boutique", magasinier: "Magasinier",
  commercial: "Commercial", technicien: "Technicien", technicien_bmi: "Technicien BMI",
  resp_commercial: "Responsable Commercial", comptable: "Comptable", admin: "Administrateur",
};

// ---- 💬 LE MOT DE FIDÉLITÉ AU CLIENT (Timo, 16/09/2026) ----
// « Proposer un message aussi à envoyer quand on clique sur l'icône WhatsApp »
// — dans 👥 Utilisateurs. Il a écrit le texte lui-même, mot pour mot, et a
// tranché deux choses : **exclusivement pour les clients** (le clic sur la
// fiche d'un employé ouvre une conversation vide, comme avant), et **le
// texte se règle dans ⚙ Paramètres**.
//
// ⚠ WhatsApp n'envoie JAMAIS tout seul : le texte arrive dans la case de
// saisie, la personne le complète ou l'efface avant d'appuyer. C'est un mot
// déjà prêt, pas un envoi automatique.
//
// Le réglage vit sur les boutiques (champ `message_fidelite`), comme la
// liste des banques et le prix du rail : rien à coller dans Supabase.
export const MESSAGE_FIDELITE_DEFAUT = [
  "Bonjour {client}.. c'est {auteur}, {role} chez BMI",
  "C'est pour vous renouveler notre reconnaissance de votre fidélité envers BMI...",
  "MERCI POUR VOTRE CONFIANCE",
  "nous sommes toujours disponibles pour vous servir",
  "N'hésitez pas à nous contacter ou à passer en boutique à tout moment pour vos achat et devis..",
  "Consultez aussi notre site Web bmitogo.com",
].join("\n");

// « le vendeur », « l'administrateur » : l'ARTICLE est dans le rôle, pour que
// le texte reste juste devant une voyelle (« c'est TIMO, l'administrateur »
// et non « le administrateur »). Le modèle écrit donc « {role} », jamais
// « le {role} » — dit en clair dans ⚙ Paramètres.
export const roleAvecArticle = (role) => {
  const l = String(LIBELLE_ROLE_EMPLOYE[role] || role || "").toLowerCase();
  if (!l) return "";
  return /^[aeiouâàéèêëîïôöûüùy]/.test(l) ? `l'${l}` : `le ${l}`;
};

export const messageFideliteRegle = (db) => {
  const b = (db?.boutiques || []).find((x) => typeof x?.message_fidelite === "string" && x.message_fidelite.trim());
  return b ? b.message_fidelite : MESSAGE_FIDELITE_DEFAUT;
};

export const texteFidelite = (modele, { client, auteur, role } = {}) =>
  String(modele ?? "")
    .replace(/\{client\}/g, String(client || "").toUpperCase())
    .replace(/\{auteur\}/g, String(auteur || "").toUpperCase())
    .replace(/\{role\}/g, roleAvecArticle(role));

// Invitation WhatsApp pour un EMPLOYÉ (tout rôle sauf client) : mêmes
// identifiants qu'au client, mais SANS conseil de changer le mot de passe —
// pour un employé, ce n'est pas possible : seul l'administrateur PRINCIPAL
// peut changer un mot de passe (voir Utilisateurs.jsx). Le rôle est précisé
// pour que la personne sache tout de suite ce qu'elle vient de recevoir.
export function texteIdentifiantsEmploye(nomAffiche, identifiant, motDePasse, role) {
  const libelleRole = LIBELLE_ROLE_EMPLOYE[role] || role;
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Votre compte BMI TOGO (${libelleRole}) a été créé. Voici votre espace personnel :`,
    ADRESSE_APP,
    ``,
    // ⚠ CE TEXTE-CI EST CELUI DE L'ENVOI À LA MAIN, et il y reste
    // (décision Timo, 21/09/2026 : « l'ancien reste dans l'app au cas où on
    // passe par l'ancienne méthode »). Les deux étiquettes servent : sur
    // téléphone, WhatsApp sélectionne LIGNE PAR LIGNE — on appuie longuement
    // et on copie le mot de passe seul. Le texte plus court qu'il a écrit le
    // même jour part chez Meta, dans un MODÈLE : la phrase d'un modèle vit
    // là-bas, pas ici.
    `👤 Identifiant : *${identifiant}*`,
    `🔑 Mot de passe : *${motDePasse}*`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  return lignes.join("\n");
}
export function envoyerIdentifiantsEmployeWhatsApp(nomAffiche, identifiant, motDePasse, role, tel, demanderConfirmation) {
  return envoyerWhatsApp(tel, texteIdentifiantsEmploye(nomAffiche, identifiant, motDePasse, role), demanderConfirmation);
}

// Simple accusé de prise de contact envoyé à un nouveau prospect — pas
// d'identifiants ici, il n'est pas encore client (voir convertirEnClient).
export function envoyerAccueilProspectWhatsApp(nomAffiche, tel) {
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Merci pour votre intérêt pour BMI TOGO ! Un technicien BMI vous recontacte très prochainement pour la suite.`,
    ``,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  envoyerWhatsApp(tel, lignes.join("\n"));
}

// Relance WhatsApp d'un prospect — UN CLIC : le message est déjà prêt, il
// ne reste qu'à l'envoyer. Pas une automatisation à zéro clic (WhatsApp ne
// le permet pas gratuitement, voir échange avec Timo) mais tout le travail
// de recherche et de rédaction disparaît.
export function envoyerRelanceProspectWhatsApp(nomAffiche, tel) {
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Je me permets de revenir vers vous concernant votre projet avec BMI TOGO — êtes-vous toujours intéressé ? Je reste à votre disposition pour en discuter.`,
    ``,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  envoyerWhatsApp(tel, lignes.join("\n"));
}

// ============ RELANCE D'UN DEVIS SANS RÉPONSE (Timo, 09/09/2026) ============
// « Les clients à qui on a envoyé des devis et qui ne réagissent pas : où les
// retrouver et les relancer sur WhatsApp ? » — « Lance, seuil 15 jours. Mais
// les messages devraient être différents dépendemment du statut du devis,
// s'il est proposé, validé… Payé ne doit plus être relancé. »
// Règle PURE (le banc l'exerce) : le texte dépend du STATUT du devis.
//   proposé  → le client n'a pas encore répondu : on lui rappelle le devis,
//              le montant, et comment le voir dans son espace.
//   validé   → il a accepté (signé) mais n'a pas encore payé : on lui
//              rappelle où et quoi régler.
//   payé, rejeté, modification demandée → AUCUNE relance (null) : payé, c'est
//              fini ; rejeté, c'est non ; modification, c'est au vendeur de
//              répondre, pas au client.
export const STATUTS_DEVIS_RELANCABLES = ["propose", "valide"];
export const devisRelancable = (devis) => STATUTS_DEVIS_RELANCABLES.includes(devis?.statut || "propose");

// ============ CORRIGER UN DEVIS DÉJÀ ENVOYÉ ============
// ⚠ Timo (11/09/2026) : « celui qui a proposé le devis peut avoir la
// possibilité de modifier le devis ? ». Jusque-là, « ✏️ Modifier et
// renvoyer » n'apparaissait QUE si le client avait réagi (modification
// demandée, rejeté) : une faute vue juste après l'envoi — un prix, un
// appareil oublié — obligeait à refaire un devis entier, et le client
// gardait le mauvais dans son espace.
//
// Ce qui est ouvert : un devis ⏳ PROPOSÉ se corrige aussi.
// Ce qui reste fermé : ✅ VALIDÉ et 💰 PAYÉ. Un devis validé est un contrat
// signé — parfois avec un chantier et un plan de règlement acceptés ; le
// corriger en silence changerait un engagement pris.
// Qui (décision Timo du 11/09/2026, option « b ») : CELUI QUI L'A ÉTABLI,
// l'administrateur, et le responsable commercial. Personne d'autre — pas
// même le vendeur de la boutique où le client viendra payer, qui voit
// pourtant le devis dans sa liste.
export const STATUTS_DEVIS_MODIFIABLES = ["propose", "modification", "rejete"];
export const ROLES_MODIFIENT_TOUT_DEVIS = ["admin", "resp_commercial"];

// ⚠ Et aussi : un devis VALIDÉ dont le client a ACCEPTÉ la demande de
// modification (11/09/2026, lib/modifDevis.js) — c'est le client qui a ouvert
// la porte, pas nous.
export const devisModifiable = (devis) => STATUTS_DEVIS_MODIFIABLES.includes(devis?.statut || "propose")
  || (devis?.statut === "valide" && devis?.demande_bmi?.statut === "acceptee");

export const peutModifierDevis = (devis, profile) => devisModifiable(devis)
  && (ROLES_MODIFIENT_TOUT_DEVIS.includes(profile?.role) || (!!devis?.par_id && devis.par_id === profile?.id));

// "" si le geste est permis ; sinon le motif, en français, dit au vendeur.
export function motifRefusModification(devis, profile) {
  if (!devis) return "Devis introuvable.";
  if (!devisModifiable(devis)) {
    const statut = devis.statut || "propose";
    return statut === "paye"
      ? "🔒 Ce devis est payé : il ne se modifie plus. La vente est encaissée."
      : "🔒 Ce devis est validé : le contrat est signé, il ne se modifie plus.";
  }
  if (!peutModifierDevis(devis, profile))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut le corriger.`;
  return "";
}

// La TRACE d'une correction (Timo, 11/09/2026 : « personne ne peut baisser un
// prix en silence après que le client a vu le premier devis »). Elle ne
// rétrécit jamais : on compte les corrections, on garde la dernière date et
// son auteur.
export const marquerModification = (ancien, devis, profile, date) => ({
  ...devis,
  modifie_le: date,
  modifie_par: profile?.nom || "",
  modifie_par_id: profile?.id || "",
  nb_modifications: Number(ancien?.nb_modifications || 0) + 1,
});

export function texteRelanceDevis({ devis, compte, motDePasse, vendeur, formaterMontant }) {
  if (!devisRelancable(devis)) return null;
  const statut = devis.statut || "propose";
  const nom = String(compte?.nom_base || compte?.nom || "").toUpperCase();
  const montant = formaterMontant ? formaterMontant(devis.total) : `${devis.total} F`;
  const acces = [
    `Vous pouvez le consulter dans votre espace client :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${compte?.nom || ""}*`,
    motDePasse ? `🔑 Mot de passe : *${motDePasse}*` : `🔑 Mot de passe : celui qui vous a été communiqué`,
  ];
  const lignes = statut === "propose"
    ? [
        `Bonjour ${nom},`,
        ``,
        `Je me permets de revenir vers vous concernant le devis BMI TOGO de ${montant} que nous vous avons envoyé le ${dFR(devis.date)}. Avez-vous pu l'examiner ?`,
        ``,
        ...acces,
        ``,
        `Vous pouvez y valider le devis, demander une modification, ou me poser vos questions — je reste à votre disposition.`,
      ]
    : [
        `Bonjour ${nom},`,
        ``,
        `Merci d'avoir validé votre devis BMI TOGO de ${montant}${devis.contrat_numero ? ` (contrat ${devis.contrat_numero})` : ""}.`,
        devis.pose_seule
          ? `Pour programmer votre installation, il ne reste plus qu'à régler le montant convenu.`
          : `Pour lancer votre installation, il ne reste plus qu'à passer régler à la boutique ${devis.boutique_paiement || devis.boutique || "BMI TOGO"} — le vendeur vous attend.`,
        ``,
        `Dès votre paiement, nous programmons l'installation.`,
      ];
  return [
    ...lignes,
    ``,
    vendeur ? `${vendeur}, BMI TOGO — Les bâtiments modernes et intelligents` : `BMI TOGO — Les bâtiments modernes et intelligents`,
  ].join("\n");
}

// ⚠ `marque` porte le cloisonnement formation / réel : { formation: true }
// quand celui qui crée le compte travaille dans l'espace d'entraînement,
// {} sinon (voir marqueEspace dans lib/calculs.js). Sans lui, un « client »
// inventé pendant une formation devenait un vrai compte, indiscernable des
// autres dans les listes, les relances et la messagerie — et il survivait
// même à la réinitialisation de la formation.
export async function fabriquerCompteClient(db, nom, tel, parQui, marque = {}) {
  const identifiant = identifiantClient(db, nom, tel);
  const { motDePasse, variante, longueur } = await resoudreMotDePasseClient(db, nom, tel);
  const user = {
    id: uid(),
    nom: identifiant,
    nom_base: String(nom || "").trim().toUpperCase(), // sert à RECALCULER le mot de passe
    tel: String(tel || "").trim(),
    ...await definirMotDePasse(motDePasse),
    role: "client",            // ← imposé : ce chemin ne crée QUE des clients
    boutique: null,
    actif: true,
    mdp_auto: true,
    mdp_variante: variante,    // non secret : juste ce qu'il faut pour RECALCULER
    mdp_longueur: longueur,    // le même mot de passe plus tard (voir motDePasseConnu)
    cree_par: parQui,
    ...marque,
  };
  return { user, motDePasse };
}

// Prévient TOUS les administrateurs, par message, dès qu'un compte client est
// créé — quel que soit l'endroit de l'application d'où ça vient (technicien
// sur le terrain, dimensionnement, parrainage...). Un seul appel à ajouter
// dans le tableau « messages » de chaque save() qui crée un compte client.
export function messagesNouveauClient(db, user, parQui) {
  // Les administrateurs de l'ESPACE du nouveau client (un client d'entraînement
  // ne dérange pas les admins réels) — et l'administrateur principal, toujours.
  const admins = db.users.filter((u) => u.role === "admin" && u.actif !== false && u.id !== parQui?.id
    && (u.admin_principal === true || !!u.formation === !!user.formation));
  return admins.map((admin) => nouveauMessage(parQui, {
    a_id: admin.id,
    texte: `🙋 Nouveau client créé par ${parQui?.nom || "quelqu'un"} : ${user.nom_base || user.nom}${user.tel ? ` (${user.tel})` : ""}.`,
  }));
}

// Retrouve le mot de passe d'un compte client généré automatiquement.
//
// ⚠ POINT CRITIQUE : un compte créé AVANT le mélange (2.98.68) a été HACHÉ
// avec l'ANCIEN algorithme fixe (4 derniers chiffres + 2 premières lettres).
// Il n'a donc JAMAIS reçu de champ mdp_variante. Si on le recalculait avec
// le NOUVEL algorithme mélangé par défaut, on obtiendrait un mot de passe
// différent de celui réellement stocké — et la connexion échouerait tant que
// personne ne l'a changé manuellement (bug signalé par Timo, corrigé ici).
// La présence explicite de mdp_variante (même à 0) est donc le vrai marqueur
// « ce compte utilise le nouvel algorithme » — son ABSENCE signifie ancien.
const motDePasseClientAncien = (nom, tel) => {
  const d = chiffresTel(tel);
  const quatre = d.slice(-4).padStart(4, "0");
  const deux = (lettresNom(nom).slice(0, 2) || "XX").padEnd(2, "X");
  return quatre + deux;
};

export const motDePasseConnu = (u) => {
  if (!u || !u.mdp_auto || !u.tel) return null;
  const nom = u.nom_base || u.nom;
  return (u.mdp_variante === undefined || u.mdp_variante === null)
    ? motDePasseClientAncien(nom, u.tel)
    : motDePasseClient(nom, u.tel, u.mdp_variante, u.mdp_longueur || 6);
};

