// ============================================================
// scripts/_rendu-commandes.jsx — 🧾 COMMANDES, RENDUES POUR DE VRAI
// (19/11/2026, la charte des listes) : les commandes reçues et celles qu'un
// commercial a envoyées, sur ordinateur et sur téléphone.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandesRecues, NouvelleCommande } from "../src/screens/Commandes.jsx";

export const rendreRecues = (db, profile, autres = {}) =>
  renderToStaticMarkup(React.createElement(CommandesRecues, { db, save: () => {}, profile, onValider: () => {}, ...autres }));
export const rendreEnvoyees = (db, profile, autres = {}) =>
  renderToStaticMarkup(React.createElement(NouvelleCommande, { db, save: () => {}, profile, ...autres }));
