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

export const rendreEquipe = (db, profile) =>
  renderToStaticMarkup(React.createElement(MonEquipe, { db, save: () => {}, profile }));
export const rendreMaCommission = (db, profile) =>
  renderToStaticMarkup(React.createElement(MaCommission, { db, profile }));
