// ============================================================
// lib/comptesClients.js — Identifiants automatiques des comptes
// clients (identifiant + mot de passe recalculables à partir du nom
// et du téléphone, jamais stockés en clair), création de compte,
// et messages WhatsApp associés.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { telDigits, uid, definirMotDePasse, today } from "./core";

// Adresse publique de l'application, envoyée au client par WhatsApp.
export const ADRESSE_APP = "https://www.gestion-bmi.com";

// ============ COMPTES CLIENTS : IDENTIFIANTS AUTOMATIQUES ============
// Le client ne choisit rien : nom + téléphone suffisent.
//   Mot de passe = 4 DERNIERS chiffres du téléphone + 2 PREMIÈRES lettres du nom
//   Identifiant   = le nom ; si déjà pris, on y accole les 2 PREMIERS chiffres du numéro
// Le mot de passe est donc RECALCULABLE : on peut le renvoyer au client à tout
// moment, sans jamais le stocker en clair.
export const chiffresTel = (tel) => String(tel || "").replace(/\D/g, "");
export const lettresNom = (nom) => String(nom || "").replace(/[^A-Za-zÀ-ÿ]/g, "").toUpperCase();

export function motDePasseClient(nom, tel) {
  const d = chiffresTel(tel);
  const quatre = d.slice(-4).padStart(4, "0");
  const deux = (lettresNom(nom).slice(0, 2) || "XX").padEnd(2, "X");
  return quatre + deux; // 6 caractères : le minimum exigé par Supabase
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
  const motDePasse = motDePasseClient(nom, tel);
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

// Retrouve le mot de passe d'un compte client généré automatiquement.
export const motDePasseConnu = (u) => (u && u.mdp_auto && u.tel ? motDePasseClient(u.nom_base || u.nom, u.tel) : null);

