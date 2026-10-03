// ============================================================
// lib/anniversaires.js — LES ANNIVERSAIRES DES EMPLOYÉS (03/10/2026)
//
// Timo : « un message d'anniversaire à envoyer aux employés le jour J-1 à
// 17 h » → décision « 1b » : LA VEILLE à 17 h, un RAPPEL à l'administrateur
// principal (« Demain, c'est l'anniversaire de … », une notification sur son
// téléphone) ; LE JOUR MÊME, les vœux à l'employé, du numéro WhatsApp BMI
// (modèle `anniversaire_employe`, tournée de 7 h). Texte : « on garde
// l'ancien texte que tu as proposé ».
//
// La date vient de la case 🎂 Anniversaire de la fiche (`anniv` = "MM-JJ",
// jour et mois seulement — l'année n'est JAMAIS demandée, donc aucun âge).
// ⚠ Un jour qui n'existe pas dans le mois (29 février une année ordinaire,
// ou un « 31/04 » saisi : la case accepte 31 pour tous les mois) se fête le
// DERNIER jour du mois — sinon ces employés ne seraient jamais souhaités.
// ⚠ LE MUR : seulement les employés RÉELS, actifs (jamais un client, jamais
// un compte de formation). ⚠ UNE fois par an : la ligne du fil 📲 WhatsApp
// (modèle + employé + année) ne se réécrit jamais et suffit à l'empêcher.
// Rien n'est écrit tant que WhatsApp n'a pas accepté.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { envoiAnniversaire, envoiRappelAnniversaire, alerteConseillerDe, critiqueNumeroAlerte, ligneEnvoiModele, numeroWhatsApp } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { estCompteFormation, estAdminPrincipalActif } from "./espace.js";

export const MODELE_ANNIVERSAIRE = "anniversaire_employe";
export const AUTEUR_ANNIVERSAIRE = { id: "anniversaire-bmi", nom: "Vœux d'anniversaire automatiques BMI" };

const joursDuMois = (annee, mois) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

// La date ISO (« 2026-10-03 ») est-elle le jour où l'on fête `anniv` ?
export function estFeteLe(anniv, dateIso) {
  const m = /^(\d{2})-(\d{2})$/.exec(String(anniv || ""));
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateIso || ""));
  if (!m || !d) return false;
  if (m[1] !== d[2]) return false;
  const dernier = joursDuMois(Number(d[1]), Number(d[2]));
  const jourFete = Math.min(Number(m[2]), dernier);
  return jourFete === Number(d[3]);
}

export const lendemain = (dateIso) => {
  const t = new Date(`${String(dateIso).slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

// Les employés RÉELS et actifs fêtés à cette date.
export function employesFetes(db, dateIso) {
  return (db?.users || []).filter((u) =>
    u && u.role && u.role !== "client" && u.actif !== false && !u.bloque
    && !estCompteFormation(db, u) && estFeteLe(u.anniv, dateIso));
}

const dejaSouhaites = (messages, annee) => new Set((messages || [])
  .filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_ANNIVERSAIRE && m.anniversaire_annee === annee)
  .map((m) => m.anniversaire_user_id));

// Les vœux du jour (tournée de 7 h) : [{ employe, tel, envoi }].
export function anniversairesDuJour(db, aujourdhui) {
  const annee = String(aujourdhui).slice(0, 4);
  const deja = dejaSouhaites(db?.messages, annee);
  const sortie = [];
  employesFetes(db, aujourdhui).forEach((u) => {
    if (deja.has(u.id)) return;
    const tel = numeroWhatsApp(u.tel);
    const envoi = envoiAnniversaire({ employe: u });
    if (!tel || !envoi) return;
    sortie.push({ employe: u, tel, envoi });
  });
  return sortie;
}

// Ce qui s'écrit APRÈS l'envoi réussi (jamais avant).
export function ligneAnniversaire({ id, tel, employe, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_ANNIVERSAIRE, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_ANNIVERSAIRE.id, de_nom: AUTEUR_ANNIVERSAIRE.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: employe?.nom_complet || employe?.nom || "",
    texte, wa_modele: MODELE_ANNIVERSAIRE,
    anniversaire_user_id: employe?.id, anniversaire_annee: String(ts).slice(0, 4),
  };
}
export const enteteApresAnniversaire = ({ tel, employe, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: employe?.nom_complet || employe?.nom || "",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts,
  });

// Le rappel de la VEILLE (tournée de 17 h), pour l'administrateur PRINCIPAL
// seul (« un rappel à toi »). null s'il n'y a personne demain.
// { destinataires, titre, texte, tag } — la tournée le passe à fabriquerEnvoi.
// Les fêtés de demain, une ligne par personne (nom, boutique, et « pas de
// numéro » s'il le faut) — UNE fois pour la notification et le WhatsApp.
function morceauxDeDemain(db, aujourdhui) {
  return employesFetes(db, lendemain(aujourdhui)).map((u) => {
    const nom = u.nom_complet || u.nom;
    const ou = u.boutique ? `, ${u.boutique}` : "";
    const sansNumero = numeroWhatsApp(u.tel) ? "" : " — pas de numéro sur sa fiche : aucun message ne lui partira";
    return `${nom}${ou}${sansNumero}`;
  });
}

export function rappelVeilleAnniversaires(db, aujourdhui) {
  const demain = lendemain(aujourdhui);
  const morceaux = morceauxDeDemain(db, aujourdhui);
  if (!morceaux.length) return null;
  const destinataires = (db?.users || []).filter(estAdminPrincipalActif).map((u) => u.id);
  if (!destinataires.length) return null;
  const texte = morceaux.length === 1
    ? `Demain, c'est l'anniversaire de ${morceaux[0]}.`
    : `Demain, c'est l'anniversaire de : ${morceaux.join(" ; ")}.`;
  return { destinataires, titre: "🎂 Anniversaire demain", texte, tag: `anniv:${demain}` };
}

// 🎂 « 1c » (03/10/2026) : le même rappel, EN PLUS, par WhatsApp sur le
// numéro de l'administrateur principal — celui réglé pour l'alerte
// conseiller (⚙ Paramètres → 🤖 Assistant, boutique RÉELLE), sinon celui de
// sa fiche. Jamais le numéro BMI lui-même. Rend { tel, envoi } ou null.
export function rappelWhatsAppVeille(db, aujourdhui) {
  const morceaux = morceauxDeDemain(db, aujourdhui);
  if (!morceaux.length) return null;
  const principal = (db?.users || []).find(estAdminPrincipalActif);
  const reglage = alerteConseillerDe(db?.boutiques);
  const brut = reglage?.tel || principal?.tel || "";
  if (!brut || critiqueNumeroAlerte(brut)) return null;
  const tel = numeroWhatsApp(brut);
  const envoi = envoiRappelAnniversaire({
    administrateur: reglage?.nom || principal?.nom_complet || principal?.nom,
    employes: morceaux.join(" ; "),
  });
  return tel && envoi ? { tel, envoi } : null;
}
