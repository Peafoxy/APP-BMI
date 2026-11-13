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

export const rendreEquipe = (db, profile, periodeInitiale = "mois") =>
  renderToStaticMarkup(React.createElement(MonEquipe, { db, save: () => {}, profile, periodeInitiale }));
export const rendreMaCommission = (db, profile, periodeInitiale = "mois") =>
  renderToStaticMarkup(React.createElement(MaCommission, { db, profile, periodeInitiale }));

// 🧾 L'HISTORIQUE DES PAIEMENTS DE COMMISSION (13/11/2026, « A c, B b, C oui ») :
// la règle, le cadre et le PDF, dans le même paquet que les deux écrans.
export * as H from "../src/lib/historiqueCommissions.js";
export { genererHistoriqueCommissions } from "../src/pdf.js";
import { HistoriquePaiements } from "../src/components/HistoriquePaiements.jsx";
export { periodeHistorique } from "../src/components/HistoriquePaiements.jsx";
export const rendreHistorique = (props) => renderToStaticMarkup(React.createElement(HistoriquePaiements, props));
