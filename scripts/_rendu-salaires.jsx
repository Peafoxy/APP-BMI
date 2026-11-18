// ============================================================
// scripts/_rendu-salaires.jsx — 💵 SALAIRES (administrateur), RENDU POUR DE
// VRAI (22/10/2026, « lance, oui pour l'avance ») : la ligne dépliée montre
// un 🗑 sur chaque prime et chaque avance — jamais sur un remboursement de frais.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SalairesAdmin, Salaire } from "../src/screens/Salaires.jsx";

export const rendreSalaires = (db, profile, autres = {}) =>
  renderToStaticMarkup(React.createElement(SalairesAdmin, { db, save: () => {}, profile, ...autres }));

// 💵 « Mon salaire » de l'employé, rendu pour de vrai (18/11/2026).
export const rendreMonSalaire = (db, profile) =>
  renderToStaticMarkup(React.createElement(Salaire, { db, save: () => {}, profile }));
