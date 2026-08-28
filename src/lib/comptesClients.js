// ============================================================
// lib/comptesClients.js — Identifiants automatiques des comptes
// clients (identifiant + mot de passe recalculables à partir du nom
// et du téléphone, jamais stockés en clair), création de compte,
// et messages WhatsApp associés.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { telDigits, uid, definirMotDePasse, hacherFort, today } from "./core";

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
import { chiffresTel, lettresNom, motDePasseClient } from "./identiteClient";
export { chiffresTel, lettresNom, motDePasseClient };

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

// Crée le compte client et renvoie { user, motDePasse }. Le rôle est IMPOSÉ.
// Ouvre WhatsApp avec les identifiants du client — un seul message, réutilisé
// partout (Utilisateurs, Clients installés, Dimensionnement, Parrainage).
export function envoyerIdentifiantsWhatsApp(nomAffiche, identifiant, motDePasse, tel) {
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Bienvenue chez BMI TOGO ! Voici votre espace personnel pour suivre votre installation solaire :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${identifiant}*`,
    `🔑 Mot de passe : *${motDePasse}*`,
    ``,
    `🔒 Pour votre confidentialité, nous vous recommandons de changer ce mot de passe dès votre première connexion (rubrique "🔑 Mon mot de passe" de votre espace).`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  const num = telDigits(tel);
  const txt = encodeURIComponent(lignes.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
}

// Libellés lisibles des rôles employés — pour le message d'invitation
// WhatsApp (ci-dessous) et nulle part ailleurs pour l'instant.
export const LIBELLE_ROLE_EMPLOYE = {
  vendeur: "Vendeur", gerant: "Gérant de boutique", magasinier: "Magasinier",
  commercial: "Commercial", technicien: "Technicien", technicien_bmi: "Technicien BMI",
  resp_commercial: "Responsable Commercial", comptable: "Comptable", admin: "Administrateur",
};

// Invitation WhatsApp pour un EMPLOYÉ (tout rôle sauf client) : mêmes
// identifiants qu'au client, mais SANS conseil de changer le mot de passe —
// pour un employé, ce n'est pas possible : seul l'administrateur PRINCIPAL
// peut changer un mot de passe (voir Utilisateurs.jsx). Le rôle est précisé
// pour que la personne sache tout de suite ce qu'elle vient de recevoir.
export function envoyerIdentifiantsEmployeWhatsApp(nomAffiche, identifiant, motDePasse, role, tel) {
  const libelleRole = LIBELLE_ROLE_EMPLOYE[role] || role;
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Votre compte BMI TOGO (${libelleRole}) a été créé. Voici votre espace personnel :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${identifiant}*`,
    `🔑 Mot de passe : *${motDePasse}*`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  const num = telDigits(tel);
  const txt = encodeURIComponent(lignes.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
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
  const num = telDigits(tel);
  const txt = encodeURIComponent(lignes.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
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
  const num = telDigits(tel);
  const txt = encodeURIComponent(lignes.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
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
  const admins = db.users.filter((u) => u.role === "admin" && u.actif !== false && u.id !== parQui?.id);
  const base = { id: uid(), date: today(), ts: new Date().toISOString(), lu_par: [] };
  return admins.map((admin) => ({
    ...base,
    id: uid(),
    de_id: parQui?.id || null,
    de_nom: parQui?.nom || "Système",
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

