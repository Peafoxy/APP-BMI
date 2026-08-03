// ============================================================
// lib/core.js — Fonctions
// utilitaires pures (aucun JSX, aucun état React) partagées par
// toute l'application : formatage, dates, comptabilité SYSCOHADA,
// hachage des mots de passe.
//
// Extrait de App.jsx (refactorisation) — copié tel quel, sans
// modification de logique.
// ============================================================

import { COMPTE_TRESORERIE, COMPTE_CHARGE } from "./constants";

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// Normalise un moyen de paiement saisi librement vers la liste officielle
export const normPaiement = (t) => {
  const s = String(t || "").toLowerCase();
  if (/flooz/.test(s)) return "Mobile Money (Flooz)";
  if (/mixx|t-?money/.test(s)) return "Mobile Money (Mixx/T-Money)";
  if (/banqu|virement|bank/.test(s)) return "Virement bancaire";
  return "Espèces";
};

// Journal en partie double : chaque opération produit une ligne au débit
// et une ligne au crédit, équilibrées, avec les comptes SYSCOHADA.
export function lignesJournal(db, a, b) {
  const lignes = [];
  const pousser = (date, journal, piece, compte, intitule, libelle, debit, credit, boutique) =>
    lignes.push([String(date).slice(0, 10), journal, piece, compte, intitule, libelle, debit || "", credit || "", boutique || ""]);

  // Ventes : débit trésorerie (ou clients si crédit) / crédit 701
  db.ventes.filter((v) => inP(v.date, a, b)).forEach((v) => {
    const net = totalVente(v);
    const [ct, it] = COMPTE_TRESORERIE(v.paiement || "");
    const piece = numeroRecu(v);
    const lib = `Vente ${resumeArticles(v)}${v.client ? " — " + v.client : ""}`;
    pousser(v.date, "VE", piece, ct, it, lib, net, "", v.boutique);
    pousser(v.date, "VE", piece, "701", "Ventes de marchandises", lib, "", net, v.boutique);
  });

  // Dépenses : débit compte de charge / crédit trésorerie
  db.depenses.filter((x) => inP(x.date, a, b)).forEach((x) => {
    const [cc, ic] = COMPTE_CHARGE[x.categorie] || COMPTE_CHARGE["Autre"];
    const [ct, it] = COMPTE_TRESORERIE(x.paiement || "");
    const piece = "DEP-" + String(x.id).slice(0, 6).toUpperCase();
    const lib = `${x.categorie}${x.description ? " — " + x.description : ""}`;
    const m = Number(x.montant);
    if (m < 0) {
      // Montant négatif = argent qui RENTRE (ex : remboursement d'un prêt au personnel)
      pousser(x.date, "AC", piece, ct, it, lib, -m, "", x.boutique);
      pousser(x.date, "AC", piece, cc, ic, lib, "", -m, x.boutique);
    } else {
      pousser(x.date, "AC", piece, cc, ic, lib, m, "", x.boutique);
      pousser(x.date, "AC", piece, ct, it, lib, "", m, x.boutique);
    }
  });

  // Règlements de dettes clients : débit caisse / crédit clients
  db.dettes.forEach((d) => (d.paiements || []).filter((p) => inP(p.date, a, b)).forEach((p) => {
    const piece = "REG-" + String(p.id).slice(0, 6).toUpperCase();
    // Une RÉSERVATION prépayée n'est pas une créance client : c'est une AVANCE reçue (4191).
    const prepaye = d.type === "prepaye";
    const [cc, ic] = prepaye ? ["4191", "Clients — avances et acomptes reçus"] : ["411", "Clients"];
    const lib = `${prepaye ? "Versement réservation" : "Règlement dette"} — ${d.client}`;
    const [ct, it] = COMPTE_TRESORERIE(p.paiement || "Espèces");
    pousser(p.date, "CA", piece, ct, it, lib, p.montant, "", d.boutique);
    pousser(p.date, "CA", piece, cc, ic, lib, "", p.montant, d.boutique);
  }));

  lignes.sort((l1, l2) => String(l1[0]).localeCompare(String(l2[0])));
  return lignes.map((l) => [dFR(l[0]), ...l.slice(1)]);
}

// Une vente peut contenir plusieurs articles (panier). Les anciennes ventes
// à article unique restent compatibles.
export const lignesVente = (v) => (v.articles && v.articles.length ? v.articles : [{ produit_id: v.produit_id, article: v.article, qte: v.qte, pu: v.pu }]);
export const brutVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0), 0);
export const qteVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0), 0);
export const resumeArticles = (v) => lignesVente(v).map((l) => `${l.qte}× ${l.article}`).join(", ");
export const totalVente = (v) => brutVente(v) - Number(v.remise || 0);

// Hachage SHA-256 des mots de passe (plus de stockage en clair)
// Ancien hachage (conservé UNIQUEMENT pour reconnaître et migrer les comptes
// pas encore mis à jour) : SHA-256 avec un sel unique partagé par toute
// l'entreprise — c'est justement ce qui posait problème (voir plus bas).
export async function hacher(txt) {
  const donnees = new TextEncoder().encode("bmi-sel-2026::" + String(txt));
  const buf = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ⚠ CORRECTIF SÉCURITÉ : hachage renforcé des mots de passe.
// Avant : SHA-256 avec le MÊME sel pour tout le monde → un seul calcul
// (une "rainbow table") suffisait à casser tous les mots de passe de
// l'entreprise d'un coup, et deux personnes avec le même mot de passe
// avaient le même hachage (visible dans la base).
// Maintenant : un sel ALÉATOIRE différent pour chaque utilisateur
// (pwd_salt) + PBKDF2 (150 000 tours) au lieu d'un simple SHA-256 — un
// calcul volontairement lent, pour rendre un essai systématique hors ligne
// beaucoup plus coûteux même si la base venait à fuiter.
export const PBKDF2_ITERATIONS = 150000;

export function genererSelHex() {
  const octets = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(octets).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hacherFort(txt, selHex) {
  const selOctets = new Uint8Array(selHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(txt)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: selOctets, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, cle, 256);
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// À utiliser PARTOUT où un nouveau mot de passe est défini (création de
// compte, changement de mot de passe) — jamais hacher() directement.
export async function definirMotDePasse(txt) {
  const pwd_salt = genererSelHex();
  const pwd_hash2 = await hacherFort(txt, pwd_salt);
  return { pwd_salt, pwd_hash2, pwd_hash: undefined, pwd: undefined };
}

// Vérifie un mot de passe saisi contre un compte, quel que soit son format
// (nouveau hachage salé, ancien hachage à sel partagé, ou très ancien mot
// de passe en clair) — et signale s'il faut migrer vers le format fort.
export async function verifierMotDePasse(u, saisie) {
  if (u.pwd_salt && u.pwd_hash2) {
    return { ok: (await hacherFort(saisie, u.pwd_salt)) === u.pwd_hash2, aMigrer: false };
  }
  if (u.pwd_hash) {
    const ok = u.pwd_hash === (await hacher(saisie));
    return { ok, aMigrer: ok };
  }
  const ok = u.pwd === saisie;
  return { ok, aMigrer: ok };
}

export const prefixeBoutique = (nom) => (String(nom || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "RCP");
export const numeroRecu = (v) => v.numero || `${prefixeBoutique(v.boutique)}-${String(v.date).slice(0, 4)}-${String(v.id).slice(0, 4).toUpperCase()}`;
export const fmt = (n) => (n === 0 || n ? new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " F" : "—");
export const today = () => new Date().toISOString().slice(0, 10);
export const dFR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

export const telDigits = (t) => {
  if (!t) return "";
  let num = String(t).replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = num.slice(1);
  if (!num.startsWith("228") && num.length === 8) num = "228" + num;
  return num;
};

export let COLORS = {};
export const col = (nom) => COLORS[nom] || "#475569";
export const light = (nom) => col(nom) + "14";


// Une date (iso ou "yyyy-mm-dd...") tombe-t-elle dans l'intervalle [a, b] ?
export const inP = (dt, a, b) => {
  const d = String(dt).slice(0, 10);
  return d >= a && d <= b;
};

// COLORS ne peut pas être réassigné directement par les modules qui
// l'importent (liaison ES module en lecture seule) — on passe par ce
// setter, appelé quand les boutiques (et leurs couleurs) sont chargées.
export function setColors(c) {
  COLORS = c;
}

// Compresse une photo avant stockage : sans cela, quelques clichés suffiraient
// à saturer la base. Cible : ~1000 px de large, qualité 55 % → environ 80 Ko.
// ============ BROUILLON PERSISTANT (survit à une actualisation de page) ============
// Uniquement pour le dimensionnement (demande Timo) : ces formulaires sont les
// plus longs de l'app, perdre 15 appareils saisis à cause d'une actualisation
// est le scénario le plus coûteux. Clé PROPRE À CHAQUE COMPTE (id inclus) —
// même piège que le dernier onglet mémorisé (2.98.80) : sur un appareil
// partagé, un brouillon ne doit jamais fuiter vers le compte suivant.
export function brouillonLire(cle) {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch { return null; }
}
export function brouillonEcrire(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch {}
}
export function brouillonEffacer(cle) {
  try { localStorage.removeItem(cle); } catch {}
}

export function compresserPhoto(fichier, maxLargeur = 1000, qualite = 0.55) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Lecture impossible"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const ratio = Math.min(1, maxLargeur / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", qualite));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}

