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
export const ADRESSE_APP = "https://www.gestion-bmi.com";

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
export const chiffresTel = (tel) => String(tel || "").replace(/\D/g, "");
export const lettresNom = (nom) => String(nom || "").replace(/[^A-Za-zÀ-ÿ]/g, "").toUpperCase();

// Mélange déterministe (PRNG xorshift32 graine par nom+tel+variante — jamais
// Math.random) des chiffres du numéro et des lettres du nom.
function melangeDeterministe(nom, tel, variante) {
  const pool = [...chiffresTel(tel).split(""), ...lettresNom(nom).split("")];
  if (pool.length === 0) pool.push("X", "0"); // garde-fou extrême (nom et tel vides)
  const graine = `${nom}|${tel}|${variante}`;
  let etat = 0;
  for (let i = 0; i < graine.length; i++) etat = (etat * 31 + graine.charCodeAt(i)) >>> 0;
  if (etat === 0) etat = 0x9e3779b9;
  const suivant = () => {
    etat ^= etat << 13; etat >>>= 0;
    etat ^= etat >>> 17;
    etat ^= etat << 5; etat >>>= 0;
    return etat;
  };
  const m = [...pool];
  for (let i = m.length - 1; i > 0; i--) {
    const j = suivant() % (i + 1);
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

// Mot de passe par défaut (variante 0, 6 caractères) : c'est celui utilisé
// pour les aperçus à l'écran. `variante` et `longueur` ne sont utilisés que
// lors d'un conflit réel (voir resoudreMotDePasseClient) et sont alors
// mémorisés sur le compte pour rester recalculable à l'identique.
export function motDePasseClient(nom, tel, variante = 0, longueur = 6) {
  let m = melangeDeterministe(nom, tel, variante);
  while (m.length < longueur) m = m.concat(m); // garde-fou si le mélange est trop court
  return m.slice(0, longueur).join("");
}

// Choisit un mot de passe qui n'entre en conflit avec AUCUN compte existant.
// Essaie d'abord plusieurs mélanges à 6 caractères (variantes 0 à 9) ; ce
// n'est QUE si tous entrent en conflit qu'elle allonge le mot de passe —
// exactement le comportement demandé : 6 caractères par défaut, plus long
// seulement quand il n'y a pas d'autre choix. Les mots de passe ne sont
// jamais stockés en clair : chaque compte existant est comparé via SON
// PROPRE sel (pwd_salt), déjà non secret.
export async function resoudreMotDePasseClient(db, nom, tel) {
  const comptes = (db.users || []).filter((u) => u.pwd_salt && u.pwd_hash2);
  const dejaUtilise = async (candidat) => {
    for (const u of comptes) {
      if ((await hacherFort(candidat, u.pwd_salt)) === u.pwd_hash2) return true;
    }
    return false;
  };
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

export async function fabriquerCompteClient(db, nom, tel, parQui) {
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

// Retrouve le mot de passe d'un compte client généré automatiquement — en
// réutilisant la variante et la longueur mémorisées à la création (comptes
// créés avant ce mécanisme : variante 0 / longueur 6, comportement inchangé).
export const motDePasseConnu = (u) => (u && u.mdp_auto && u.tel
  ? motDePasseClient(u.nom_base || u.nom, u.tel, u.mdp_variante || 0, u.mdp_longueur || 6)
  : null);

