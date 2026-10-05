// ============================================================
// lib/contratTravail.js — LE CONTRAT DE TRAVAIL D'UN EMPLOYÉ (05/10/2026)
//
// Timo : « employé CDI et CDD, pas de différence de bulletin ou autre
// info ? » → constat : le type n'existait que dans la case CNSS (grisée pour
// un non-assujetti), rien sur le bulletin, aucune date de fin, et la date de
// sortie n'avait aucune case. Décision « a et b » : le type de contrat se
// saisit sur la fiche de paie (administrateur), s'imprime sur le bulletin,
// un CDD porte sa DATE DE FIN, et un rappel prévient avant la fin.
//
// ⚠ UNE SEULE SOURCE pour le type : `cnss_code_type`, le champ que lit déjà
// la déclaration CNSS (codes officiels du guide DRC : 1 = Normal/CDI,
// 5 = Temporaire/CDD…). Un second champ « type de contrat » finirait par
// contredire la déclaration.
// ⚠ Un type JAMAIS saisi ne s'écrit pas « CDI » : on ne l'invente pas
// (la déclaration CNSS, elle, garde son code 1 d'office).
// ⚠ Le rappel ne regarde que les employés RÉELS, actifs, sans date de
// sortie : un contrat déjà clos ne se rappelle pas.
//
// Sans import sauf lib/espace.js (lui-même sans import) : lu par la tournée
// du matin (Node), imports écrits avec `.js`.
// ============================================================
import { estCompteFormation, estAdminPrincipalActif } from "./espace.js";

// Les contrats proposés dans 👥 Utilisateurs (codes CNSS du guide DRC). Les
// autres codes restent choisissables dans 💵 Salaires → 🏦 CNSS.
export const TYPES_CONTRAT = [
  { code: 1, libelle: "CDI", long: "Contrat à durée indéterminée (CDI)" },
  { code: 5, libelle: "CDD", long: "Contrat à durée déterminée (CDD)" },
  { code: 4, libelle: "Apprentissage", long: "Contrat d'apprentissage" },
  { code: 12, libelle: "Stage", long: "Stage" },
];
export const CODE_CDI = 1;
export const CODE_CDD = 5;

// Les jours avant la fin où l'administrateur principal est prévenu.
export const JOURS_RAPPEL_FIN = [15, 1];

const iso = (d) => String(d || "").slice(0, 10);
// La date vient de demanderDate (déjà contrôlée) : on vérifie juste sa forme
// sans recopier le contrôle de l'écran (règle du banc, components/ui.jsx).
const estDate = (d) => { const p = String(d || "").split("-"); return p.length === 3 && p[0].length === 4 && p[1].length === 2 && p[2].length === 2 && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)); };
const enJours = (d) => Date.parse(`${iso(d)}T00:00:00Z`) / 86400000;
const dFR = (d) => (estDate(d) ? iso(d).split("-").reverse().join("/") : "");

// Le code saisi, ou null s'il ne l'a jamais été.
export const codeContrat = (u) => {
  const n = Number(u?.cnss_code_type);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// « CDI », « CDD », « Apprentissage »… ; "" si rien n'a été saisi.
// `autres` : la table complète des codes CNSS (pour un code hors liste).
export function libelleContrat(u, autres = []) {
  const code = codeContrat(u);
  if (!code) return "";
  const t = TYPES_CONTRAT.find((x) => x.code === code);
  if (t) return t.libelle;
  const a = (autres || []).find((x) => Number(x.code) === code);
  return a ? a.libelle : `Code CNSS ${code}`;
}

// La phrase complète : « CDD jusqu'au 31/12/2026 », « CDI », "".
export function phraseContrat(u, autres = []) {
  const l = libelleContrat(u, autres);
  if (!l) return "";
  const fin = codeContrat(u) !== CODE_CDI && estDate(u?.contrat_fin) ? ` jusqu'au ${dFR(u.contrat_fin)}` : "";
  return `${l}${fin}`;
}

// Refus revérifié DANS le geste ; "" = accepté.
export function critiqueContrat({ code, fin, embauche } = {}) {
  const c = Number(code);
  if (!TYPES_CONTRAT.some((t) => t.code === c)) return "Choisissez le type de contrat.";
  if (c === CODE_CDI && fin) return "Un CDI n'a pas de date de fin.";
  if (c === CODE_CDD && !estDate(fin)) return "Un CDD doit porter sa date de fin.";
  if (fin && !estDate(fin)) return "Date de fin illisible.";
  if (fin && estDate(embauche) && iso(fin) <= iso(embauche)) return `La fin du contrat doit venir après l'embauche (${dFR(embauche)}).`;
  return "";
}

// La date de sortie (déclaration CNSS) : date + motif, ou rien.
export function critiqueSortie({ date, motif, embauche } = {}) {
  if (!date) return "";
  if (!estDate(date)) return "Date de sortie illisible.";
  if (!motif) return "Choisissez le motif de sortie.";
  if (estDate(embauche) && iso(date) < iso(embauche)) return `La sortie ne peut pas précéder l'embauche (${dFR(embauche)}).`;
  return "";
}

// Où en est la fin du contrat ? null s'il n'y a rien à surveiller (CDI,
// pas de date de fin, ou employé déjà sorti).
// { fin, jours } — jours < 0 : la date est passée.
export function etatFinContrat(u, aujourdhui) {
  if (!u || codeContrat(u) === CODE_CDI || !estDate(u.contrat_fin) || estDate(u.cnss_date_sortie)) return null;
  const jours = Math.round(enJours(u.contrat_fin) - enJours(aujourdhui));
  return { fin: iso(u.contrat_fin), jours };
}

// La phrase lue sous le nom : « 📄 CDD — fin le 31/12/2026 (dans 15 j) ».
// Dépassée : renouvelable encore un mois, puis un NOUVEAU contrat (Timo,
// 05/10/2026 : « ce bouton disparaît après un mois si pas renouvelé et il
// faudra un nouveau contrat »).
export function phraseFinContrat(u, aujourdhui) {
  const e = etatFinContrat(u, aujourdhui);
  if (!e) return "";
  const suite = peutRenouveler(u, aujourdhui)
    ? `🔁 renouvelable jusqu'au ${dFR(limiteRenouvellement(e.fin))}, ou saisir la sortie`
    : "nouveau contrat ou date de sortie à saisir";
  const quand = e.jours > 1 ? `dans ${e.jours} j` : e.jours === 1 ? "demain" : e.jours === 0 ? "aujourd'hui" : `dépassée de ${-e.jours} j — ${suite}`;
  return `${libelleContrat(u) || "Contrat"} — fin le ${dFR(e.fin)} (${quand})`;
}

// ---- LA DURÉE QU'ON TAPE (05/10/2026, « a la veille, b choix 2… lance ») ----
// « 6 mois », « 1 an », « 2 ans », « 45 jours », « 3 semaines », ou un chiffre
// seul (= des mois). Rend { mois } ou { jours }, null si illisible.
const UNITES_DUREE = [
  { mots: ["mois", "m"], mois: 1 },
  { mots: ["an", "ans", "annee", "annees", "a"], mois: 12 },
  { mots: ["jour", "jours", "j"], jours: 1 },
  { mots: ["semaine", "semaines", "sem", "s"], jours: 7 },
];
export function lireDuree(texte) {
  const t = String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim();
  if (!t) return null;
  let i = 0;
  while (i < t.length && t[i] >= "0" && t[i] <= "9") i++;
  const n = Number(t.slice(0, i));
  if (!i || !Number.isInteger(n) || n <= 0 || n > 999) return null;
  const unite = t.slice(i).trim();
  if (!unite) return { mois: n };
  const u = UNITES_DUREE.find((x) => x.mots.includes(unite));
  if (!u) return null;
  return u.mois ? { mois: n * u.mois } : { jours: n * u.jours };
}
export const dureeEnClair = (d) => (!d ? "" : d.mois ? (d.mois % 12 === 0 ? `${d.mois / 12} an${d.mois > 12 ? "s" : ""}` : `${d.mois} mois`) : `${d.jours} jour${d.jours > 1 ? "s" : ""}`);

const versIso = (y, m0, j) => new Date(Date.UTC(y, m0, j)).toISOString().slice(0, 10);
const morceaux = (d) => iso(d).split("-").map(Number);
const joursDuMois = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const plusJours = (d, n) => { const [y, m, j] = morceaux(d); return versIso(y, m - 1, j + n); };
// n mois plus tard, le jour ramené au dernier du mois s'il n'existe pas (31/01 + 1 mois = 28/02).
const plusMois = (d, n) => {
  const [y, m, j] = morceaux(d);
  const ty = y + Math.floor((m - 1 + n) / 12), tm = (m - 1 + n) % 12;
  return versIso(ty, tm, Math.min(j, joursDuMois(ty, tm)));
};

// La fin d'un contrat qui COMMENCE le `debut` : LA VEILLE de la même date
// N mois plus tard (décision « a ») — 6 mois dès le 05/10/2026 → 04/04/2027 ;
// dès le 31/08 → 28/02 (le dernier jour du mois quand le jour n'existe pas).
export function finDepuisDuree(debut, duree) {
  if (!estDate(debut) || !duree) return "";
  if (duree.jours) return plusJours(debut, duree.jours - 1);
  const [y, m, j] = morceaux(debut);
  const ty = y + Math.floor((m - 1 + duree.mois) / 12), tm = (m - 1 + duree.mois) % 12;
  return j > joursDuMois(ty, tm) ? versIso(ty, tm + 1, 0) : versIso(ty, tm, j - 1);
}

// ---- 🔁 LE RENOUVELLEMENT (décision « b, choix 2 ») ----
// Il s'OUVRE avec le premier rappel, 15 jours avant la fin (Timo, 05/10/2026 :
// « c'est après le 1er rappel des 15 j qu'il devrait s'afficher »), et reste
// possible jusqu'à UN MOIS après la fin ; au-delà, un nouveau contrat.
export const debutRenouvellement = (fin) => plusJours(fin, -JOURS_RAPPEL_FIN[0]);
export const limiteRenouvellement = (fin) => plusMois(fin, 1);
export function peutRenouveler(u, aujourdhui) {
  const code = codeContrat(u);
  if (!u || !code || code === CODE_CDI || !estDate(u.contrat_fin) || estDate(u.cnss_date_sortie)) return false;
  const j = iso(aujourdhui);
  return j >= debutRenouvellement(u.contrat_fin) && j <= limiteRenouvellement(u.contrat_fin);
}
// "" = accepté. Revérifié DANS le geste, sur la fiche fraîche.
export function critiqueRenouvellement(u, aujourdhui) {
  const code = codeContrat(u);
  if (!code || code === CODE_CDI) return "Un CDI ne se renouvelle pas.";
  if (!estDate(u?.contrat_fin)) return "Ce contrat n'a pas de date de fin : fixez-la par « 📅 Embauche et contrat ».";
  if (estDate(u?.cnss_date_sortie)) return `Une date de sortie est saisie (${dFR(u.cnss_date_sortie)}) : un nouveau contrat se fait par « 📅 Embauche et contrat ».`;
  if (iso(aujourdhui) < debutRenouvellement(u.contrat_fin)) return `Le renouvellement s'ouvre le ${dFR(debutRenouvellement(u.contrat_fin))} (15 jours avant la fin, le ${dFR(u.contrat_fin)}). Pour changer la durée avant, passez par « 📅 Embauche et contrat ».`;
  if (!peutRenouveler(u, aujourdhui)) return `Le contrat a pris fin le ${dFR(u.contrat_fin)} : plus d'un mois est passé (renouvelable jusqu'au ${dFR(limiteRenouvellement(u.contrat_fin))}). Il faut un nouveau contrat : « 📅 Embauche et contrat ».`;
  return "";
}
// La nouvelle fin : la durée court à partir du LENDEMAIN de la fin actuelle.
export const finApresRenouvellement = (u, duree) => (estDate(u?.contrat_fin) && duree ? finDepuisDuree(plusJours(u.contrat_fin, 1), duree) : "");
export const MESSAGE_DUREE_ILLISIBLE = "Durée illisible : tapez par exemple « 6 mois », « 1 an » ou « 45 jours ».";

// Le rappel de la tournée du matin, pour l'administrateur PRINCIPAL seul.
// `db.users` porte la fiche de paie recollée (fusionnerPaie). null = rien.
export function rappelFinsDeContrat(db, aujourdhui) {
  const morceaux = (db?.users || [])
    .filter((u) => u && u.role && u.role !== "client" && u.actif !== false && !estCompteFormation(db, u))
    .map((u) => ({ u, e: etatFinContrat(u, aujourdhui) }))
    .filter(({ e }) => e && JOURS_RAPPEL_FIN.includes(e.jours))
    .map(({ u, e }) => `${u.nom_complet || u.nom} (${libelleContrat(u) || "contrat"}, fin le ${dFR(e.fin)}${e.jours === 1 ? ", demain" : `, dans ${e.jours} jours`})`);
  if (!morceaux.length) return null;
  const destinataires = (db?.users || []).filter(estAdminPrincipalActif).map((u) => u.id);
  if (!destinataires.length) return null;
  return {
    destinataires,
    titre: "📄 Fin de contrat",
    texte: `${morceaux.join(" ; ")}. Renouveler, ou saisir la date de sortie.`,
    tag: `fin-contrat:${iso(aujourdhui)}`,
  };
}
