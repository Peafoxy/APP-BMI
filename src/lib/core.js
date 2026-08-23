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

// Jeton de signature de contrat : DOIT être imprévisible (contrairement à
// uid() ci-dessus, qui utilise Math.random() — bien pour un simple id
// d'enregistrement, pas pour un droit d'accès). crypto.getRandomValues est
// la source aléatoire réellement sûre du navigateur.
export const genererJetonSignature = () => {
  const octets = new Uint8Array(32);
  crypto.getRandomValues(octets);
  return [...octets].map((o) => o.toString(16).padStart(2, "0")).join("");
};

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

  // ⚠ Cloisonnement formation / réel : ce journal est le document remis au
  // COMPTABLE. Il parcourait db.ventes / db.depenses / db.dettes en brut —
  // les écritures d'entraînement s'y retrouvaient donc en partie double,
  // indiscernables des vraies. Le filtre est posé ici, une seule fois,
  // plutôt que chez chaque appelant. (La liste des boutiques de formation
  // est reconstruite localement : lib/core.js ne dépend de rien, et ne doit
  // pas importer lib/calculs.js — qui, lui, importe déjà core.)
  const formation = new Set((db.boutiques || []).filter((x) => x.formation).map((x) => x.nom));
  const reel = (x) => !formation.has(x.boutique);

  // Ventes : débit trésorerie (ou clients si crédit) / crédit 701
  db.ventes.filter((v) => reel(v) && inP(v.date, a, b)).forEach((v) => {
    const net = totalVente(v);
    const [ct, it] = COMPTE_TRESORERIE(v.paiement || "");
    const piece = numeroRecu(v);
    const lib = `Vente ${resumeArticles(v)}${v.client ? " — " + v.client : ""}`;
    pousser(v.date, "VE", piece, ct, it, lib, net, "", v.boutique);
    pousser(v.date, "VE", piece, "701", "Ventes de marchandises", lib, "", net, v.boutique);
  });

  // Dépenses : débit compte de charge / crédit trésorerie
  db.depenses.filter((x) => reel(x) && inP(x.date, a, b)).forEach((x) => {
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
  db.dettes.filter(reel).forEach((d) => (d.paiements || []).filter((p) => inP(p.date, a, b)).forEach((p) => {
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
// ⚠ CORRECTIF 2.99.50 : brutVente() ignorait les remises PAR LIGNE
// (remise_ligne) — elle ne faisait que qte×pu, sans jamais les soustraire.
// Résultat concret : un reçu avec des remises par article (et aucune remise
// globale) affichait un total supérieur de exactement la somme des remises
// de ligne au montant réellement encaissé. Comme totalVente() ET tout le
// reste de l'app (commissions, dettes, contrats, message WhatsApp) partent
// de brutVente(), le bug se propageait partout SAUF sur l'écran de vente
// lui-même (qui recalculait déjà correctement, en local, dans Ventes.jsx).
export const brutVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0), 0);
export const qteVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0), 0);
export const resumeArticles = (v) => lignesVente(v).map((l) => `${l.qte}× ${l.article}`).join(", ");
// ⚠ DÉFAUT TROUVÉ EN AUDIT (20/08/2026) — LE RABAIS ÉTAIT OUBLIÉ ICI.
// Ventes.jsx demande au client `brut − remise − rabais`, mais cette fonction
// s'arrêtait à `brut − remise`. Or c'est ELLE qui alimente la caisse du jour
// (Caisse.jsx) et le reçu (impression.js). Conséquence à chaque vente avec
// rabais commercial : la caisse réclamait 100 000 quand le client en avait
// payé 95 000 — un écart rouge systématique — et le reçu affichait un montant
// que le client n'avait pas versé.
export const totalVente = (v) => brutVente(v) - Number(v.remise || 0) - Number(v.rabais || 0);

// ⚠ FONCTIONNALITÉ 2.99.53 (demande Timo) : le CHIFFRE D'AFFAIRES n'est PAS
// toujours égal au montant total payé par le client — deux cas l'excluent :
//   1. Une ligne cochée « hors boutique » (HB) dans le devis d'origine — un
//      article facturé par BMI mais qui ne vient pas de son propre stock.
//   2. Une ligne marquée automatiquement quand un devis a été créé à partir
//      d'une vente déjà encaissée (voir Ventes.jsx « Transformer en devis ») —
//      son montant a DÉJÀ été compté au CA le jour de cette première vente ;
//      seuls les articles ajoutés ENSUITE doivent recompter.
// Les deux cas utilisent le MÊME champ `hors_boutique` sur la ligne : l'effet
// sur le CA est identique, qu'importe la raison. Le montant réellement
// encaissé (totalVente, le reçu, le "à payer" du client) n'est JAMAIS touché
// par cette exclusion — seuls les calculs INTERNES (CA, commissions) la
// respectent.
//
// La remise globale (v.remise, en F, calculée sur TOUT le panier) est
// répartie au PRORATA entre lignes incluses et exclues, plutôt que
// soustraite en bloc du CA : sinon une remise de 10 % sur un panier mi-HB
// mi-boutique ferait porter TOUTE la remise sur la seule part boutique.
// La part d'une réduction globale qui retombe sur les lignes COMPTÉES au
// chiffre d'affaires (voir la répartition au prorata expliquée ci-dessus).
// Extraite pour que le calcul de commission puisse réutiliser EXACTEMENT la
// même part du rabais que celle retirée du chiffre d'affaires.
export const partIncluse = (v) => {
  const lignes = lignesVente(v);
  const netLigne = (l) => Number(l.qte || 0) * Number(l.pu || 0) - Number(l.remise_ligne || 0);
  const brutTotal = lignes.reduce((s, l) => s + netLigne(l), 0);
  const brutInclus = lignes.reduce((s, l) => (l.hors_boutique ? s : s + netLigne(l)), 0);
  return { brutInclus, part: brutTotal > 0 ? brutInclus / brutTotal : 0 };
};
export const rabaisImpute = (v) => Math.round(Number(v.rabais || 0) * partIncluse(v).part);

// ⚠ MÊME DÉFAUT QUE totalVente (audit du 20/08/2026) : le rabais n'était pas
// retiré du chiffre d'affaires. La formule de commission, elle, le rajoutait
// (« total avant le rabais du commercial ») en supposant qu'il en avait été
// retiré — il était donc compté en trop, et chaque commission dépassait le dû
// de « taux × rabais ». En le retirant ici, la formule de commission redevient
// juste sans y toucher : elle rajoute une somme qui a réellement été ôtée.
export const caVente = (v) => {
  const { brutInclus, part } = partIncluse(v);
  if (part === 0) return 0;
  return Math.round(brutInclus - Number(v.remise || 0) * part - Number(v.rabais || 0) * part);
};

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

// ⚠ Cloisonnement formation / réel : prefixeBoutique() ne retient que TROIS
// lettres — « APESSITO » et « APESSITO FORMATION » donnaient donc tous deux
// « APE », c'est-à-dire la MÊME série de numéros de reçu et de dettes. Les
// ventes d'entraînement consommaient ainsi des numéros de la série réelle,
// et la réparation automatique des collisions pouvait renuméroter une vraie
// vente à cause d'une vente fictive. Les documents de formation ont
// désormais leur propre série, visiblement distincte : FOR-APE-2026-0001.
export const prefixeEspace = (db, boutique) =>
  ((db?.boutiques || []).find((b) => b.nom === boutique)?.formation ? "FOR-" : "");
// ⚠ Point 16 de l'audit du 20/08/2026 : deux boutiques dont le nom commence
// par les MÊMES TROIS LETTRES — « Agoè Nord » et « Agoè Sud » — partagent le
// préfixe « AGO ». Il n'en résulte AUCUN doublon (la numérotation balaie tous
// les numéros portant ce préfixe, quelle que soit la boutique), mais un reçu
// ne dit plus de quelle boutique il vient.
//
// Plutôt que de changer la règle pour tout le monde — ce qui couperait les
// séries en cours —, chaque boutique peut porter son propre préfixe, réglé
// dans Paramètres. Sans réglage, le comportement d'avant ne bouge pas.
// ⚠ POINT 17 DE L'AUDIT DU 20/08/2026 — la bibliothèque « xlsx » est
// signalée comme ancienne par les outils de sécurité. Elle reste en place,
// délibérément, pour deux raisons vérifiées :
//   1. l'application ne s'en sert QUE POUR ÉCRIRE (aoa_to_sheet, book_new,
//      writeFile). Les failles connues concernent la LECTURE d'un fichier
//      reçu de l'extérieur — chemin qui n'existe nulle part ici ;
//   2. les versions récentes ne sont plus publiées sur npm par leur auteur.
//      Changer de source ou de bibliothèque casserait vos exports CNSS et
//      comptables pour un risque qui, chez vous, n'a aucun chemin.
// À revoir le jour où l'application devra LIRE un tableur.

export const prefixeDe = (db, nom) => {
  const perso = (db?.boutiques || []).find((b) => b.nom === nom)?.prefixe;
  const propre = String(perso || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return propre || prefixeBoutique(nom);
};

const serieDe = (db, boutique, annee, suffixe = "") =>
  `${prefixeEspace(db, boutique)}${prefixeDe(db, boutique)}-${suffixe}${annee}-`;

// ============ NUMÉROTATION DES VENTES (2.99.44 — Lot C) ============
// ⚠ L'ancien calcul « nombre de ventes + 1 » produisait des DOUBLONS de
// numéro de reçu dans deux cas réels :
//   1. Une vente supprimée : la suivante reprenait le numéro de la dernière
//      (10 ventes − 1 supprimée = compte 9 → prochain « n°10 », déjà émis).
//   2. Deux appareils de la même boutique vendant HORS LIGNE en même temps :
//      chacun comptait le même total local → même numéro des deux côtés.
// Nouveau calcul : (plus grand numéro déjà attribué) + 1, avec vérification
// finale que le numéro n'existe pas encore. Le cas n°1 disparaît totalement ;
// le cas n°2 devient rare et, s'il survient quand même, il est réparé
// automatiquement à la synchronisation (voir repararNumerosVentes).
export const prochainNumeroVente = (db, boutique, date = today()) => {
  const annee = String(date).slice(0, 4);
  const prefixe = serieDe(db, boutique, annee);
  const pris = new Set();
  let maxSeq = 0;
  for (const v of db.ventes || []) {
    const n = String(v.numero || "");
    if (!n.startsWith(prefixe)) continue;
    pris.add(n);
    const seq = parseInt(n.slice(prefixe.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  let seq = maxSeq + 1;
  while (pris.has(prefixe + String(seq).padStart(4, "0"))) seq += 1;
  return prefixe + String(seq).padStart(4, "0");
};

// Répare les collisions de numéros (deux ventes portant le même numéro,
// typiquement après une période hors ligne sur deux appareils).
// Règle DÉTERMINISTE — identique sur tous les appareils, pour que chacun
// aboutisse au MÊME résultat sans se contredire : parmi les ventes en
// collision, la « première » (date, puis heure, puis id) GARDE son numéro ;
// les autres reçoivent le prochain numéro libre de leur boutique/année, et
// leur ancien numéro est conservé dans `numero_avant_collision` (le reçu
// papier déjà imprimé reste ainsi retrouvable).
// Renvoie null s'il n'y a rien à réparer.
export function repararNumerosVentes(db) {
  const parNumero = new Map();
  for (const v of db.ventes || []) {
    if (!v.numero) continue;
    const liste = parNumero.get(v.numero) || [];
    liste.push(v);
    parNumero.set(v.numero, liste);
  }
  const groupes = [...parNumero.values()].filter((l) => l.length > 1);
  if (!groupes.length) return null;
  const pris = new Set([...parNumero.keys()]);
  const corrections = [];
  for (const liste of groupes) {
    liste.sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.heure || "").localeCompare(String(b.heure || "")) ||
      String(a.id).localeCompare(String(b.id)));
    for (const v of liste.slice(1)) {
      const annee = String(v.date).slice(0, 4);
      const prefixe = serieDe(db, v.boutique, annee);
      let maxSeq = 0;
      for (const n of pris) {
        if (!n.startsWith(prefixe)) continue;
        const s = parseInt(n.slice(prefixe.length), 10);
        if (Number.isFinite(s) && s > maxSeq) maxSeq = s;
      }
      let seq = maxSeq + 1;
      while (pris.has(prefixe + String(seq).padStart(4, "0"))) seq += 1;
      const nouveau = prefixe + String(seq).padStart(4, "0");
      pris.add(nouveau);
      corrections.push({ id: v.id, ancien: v.numero, nouveau });
    }
  }
  const parId = new Map(corrections.map((c) => [c.id, c]));
  return {
    ventes: db.ventes.map((v) => (parId.has(v.id)
      ? { ...v, numero: parId.get(v.id).nouveau, numero_avant_collision: v.numero }
      : v)),
    corrections,
  };
}

// Même principe anti-collision que prochainNumeroVente (voir ci-dessus) —
// mais pour les dettes/réservations, qui ont leur PROPRE numérotation :
// préfixe "-DET-" pour ne jamais se confondre visuellement avec un numéro
// de vente sur un même reçu (une réservation n'est pas encore une vente).
export const prochainNumeroDette = (db, boutique, date = today()) => {
  const annee = String(date).slice(0, 4);
  const prefixe = serieDe(db, boutique, annee, "DET-");
  const pris = new Set();
  let maxSeq = 0;
  for (const d of db.dettes || []) {
    const n = String(d.numero || "");
    if (!n.startsWith(prefixe)) continue;
    pris.add(n);
    const seq = parseInt(n.slice(prefixe.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  let seq = maxSeq + 1;
  while (pris.has(prefixe + String(seq).padStart(4, "0"))) seq += 1;
  return prefixe + String(seq).padStart(4, "0");
};
// Secours pour une dette/réservation créée AVANT ce numéro (legacy) — même
// principe que numeroRecu() ci-dessus.
export const numeroRecuDette = (d) => d.numero || `${prefixeBoutique(d.boutique)}-DET-${String(d.date).slice(0, 4)}-${String(d.id).slice(0, 4).toUpperCase()}`;

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

// ⚠ OUVERTURE DE WHATSAPP — jamais perdue en silence (relevé par Timo,
// 18/08/2026). Les navigateurs bloquent une ouverture de fenêtre qui n'est
// pas la conséquence IMMÉDIATE d'un clic : passé environ 5 secondes, ils
// considèrent que la page agit d'elle-même. Or un envoi de devis passe par
// des calculs et des questions avant d'arriver ici.
// Quand c'était bloqué, RIEN ne le disait : l'utilisateur croyait son client
// prévenu alors qu'il n'avait rien reçu.
// window.open renvoie null quand il est bloqué. On le détecte, et on propose
// un bouton — un clic direct n'est JAMAIS bloqué, la fenêtre s'ouvre.
export async function ouvrirWhatsApp(url, demanderConfirmation) {
  let fenetre = null;
  try { fenetre = window.open(url, "_blank"); } catch { fenetre = null; }
  if (fenetre) return true;
  if (typeof demanderConfirmation !== "function") return false;
  const reessayer = await demanderConfirmation(
    "📵 WhatsApp n'a pas pu s'ouvrir tout seul.\n\n" +
    "Votre navigateur a bloqué l'ouverture — cela arrive quand l'enregistrement a pris quelques secondes. " +
    "Rien n'est perdu : l'enregistrement est bien fait, seul le message n'est pas parti.\n\n" +
    "Ouvrir WhatsApp maintenant ?");
  if (!reessayer) return false;
  // Ce second essai part d'un vrai clic : il n'est jamais bloqué.
  try { window.open(url, "_blank"); return true; } catch { return false; }
}
