// ============================================================
// scripts/_rendu-equipe.jsx — 👑 MON ÉQUIPE ET 💵 MA COMMISSION, RENDUS POUR
// DE VRAI (13/11/2026, « a, lance ») : une commission devenue due se voit
// quelle que soit la période — la vente d'octobre de TSEVIE CLIEN (apporteur
// CLAUDE) disparaissait de « Ce mois ».
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MonEquipe } from "../src/screens/MonEquipe.jsx";
import { MaCommission } from "../src/screens/MaCommission.jsx";
export { today, fmt } from "../src/lib/core.js";

// `blocsOuverts` (18/11/2026, façon carnet) : chefs, apporteurs et historique sont REPLIÉS à l'écran ; les anciens contrôles les lisent ouverts.
export const rendreEquipe = (db, profile, periodeInitiale = "mois", blocsOuverts = true) =>
  renderToStaticMarkup(React.createElement(MonEquipe, { db, save: () => {}, profile, periodeInitiale, blocsOuverts }));
export const rendreMaCommission = (db, profile, periodeInitiale = "mois", blocsOuverts = false) =>
  renderToStaticMarkup(React.createElement(MaCommission, { db, profile, periodeInitiale, blocsOuverts }));

// 🧾 L'HISTORIQUE DES PAIEMENTS DE COMMISSION (13/11/2026, « A c, B b, C oui ») :
// la règle, le cadre et le PDF, dans le même paquet que les deux écrans.
export * as H from "../src/lib/historiqueCommissions.js";
export { genererHistoriqueCommissions } from "../src/pdf.js";
import { HistoriquePaiements } from "../src/components/HistoriquePaiements.jsx";
export { periodeHistorique } from "../src/components/HistoriquePaiements.jsx";
export const rendreHistorique = (props) => renderToStaticMarkup(React.createElement(HistoriquePaiements, props));

// 🧲 Suivre les commerciaux qui prospectent (15/11/2026, « Lance 1, 2 et 3 »).
import { Prospects } from "../src/screens/Prospects.jsx";
export * as AP from "../src/lib/activiteProspection.js";
export const rendreProspects = (db, profile, commercialInitial = "") =>
  renderToStaticMarkup(React.createElement(Prospects, { db, save: () => {}, profile, isAdmin: profile.role === "admin", commercialInitial }));
