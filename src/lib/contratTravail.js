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
export function phraseFinContrat(u, aujourdhui) {
  const e = etatFinContrat(u, aujourdhui);
  if (!e) return "";
  const quand = e.jours > 1 ? `dans ${e.jours} j` : e.jours === 1 ? "demain" : e.jours === 0 ? "aujourd'hui" : `dépassée de ${-e.jours} j — date de sortie à saisir`;
  return `${libelleContrat(u) || "Contrat"} — fin le ${dFR(e.fin)} (${quand})`;
}

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
