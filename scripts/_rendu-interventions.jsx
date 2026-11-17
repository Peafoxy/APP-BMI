// ============================================================
// scripts/_rendu-interventions.jsx — 🔩 LE JOURNAL DES INTERVENTIONS, RENDU ET JOUÉ
// (17/11/2026) : le composant dessiné par React, et les deux gestes joués avec
// une fausse sauvegarde. Un écran que le banc ne rend pas est un écran blanc en
// puissance. ⚠ Les gestes jouent ici des fiches SANS numéro (rien ne part).
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InterventionsDuChantier, StatistiquesPannes, noterIntervention, resoudreUneIntervention, telechargerHistoriqueInstallation, exporterInterventions } from "../src/components/Interventions.jsx";

export const rendreJournal = (c, db, profile, boutique) => renderToStaticMarkup(React.createElement(InterventionsDuChantier, { c, db, profile, save() {}, boutique }));
export const rendreStats = (chantiers, dans = () => true, profile = null) => renderToStaticMarkup(React.createElement(StatistiquesPannes, { chantiers, dans, libellePeriode: "Ce mois", onFermer() {}, profile, boutiqueDe: () => "BMI DEMAKPOE" }));

// Les téléchargements : le PDF rendu (jamais enregistré), et l'export Excel (rend ses lignes).
export const pdfHistorique = (db, profile, chantierId, boutique, avecCause) => telechargerHistoriqueInstallation({ db, profile, chantierId, boutique, avecCause }, true);
export const exportExcel = (profile, chantiers, dans = () => true) => exporterInterventions({ profile, chantiers, dans, libelle: "Ce mois", boutiqueDe: () => "BMI DEMAKPOE" });

// Joue un geste : rend { db apres, journal, phrase, sauvegardes }.
export async function jouerNote(db, profile, chantierId, saisie) {
  const enregistre = [];
  const phrase = await noterIntervention({ db, save: (n, j) => enregistre.push({ db: typeof n === "function" ? n(db) : n, journal: j }), profile, chantierId, saisie });
  return { phrase, enregistre };
}
export async function jouerResolution(db, profile, chantierId, interventionId, saisie) {
  const enregistre = [];
  const phrase = await resoudreUneIntervention({ db, save: (n, j) => enregistre.push({ db: typeof n === "function" ? n(db) : n, journal: j }), profile, chantierId, interventionId, saisie });
  return { phrase, enregistre };
}
