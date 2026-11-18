// ============================================================
// scripts/_rendu-chantiers.jsx — 🏠 CLIENTS INSTALLÉS, RENDU POUR DE VRAI
// (18/11/2026, « Construit, lance ») : la liste (tableau ordinateur + cartes
// téléphone), les gestes en toutes lettres sur trois lignes, le dossier en blocs.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientsInstalles } from "../src/screens/ClientsInstalles.jsx";

export const rendreChantiers = (db, profile, autres = {}) =>
  renderToStaticMarkup(React.createElement(ClientsInstalles, { db, save: () => {}, profile, isAdmin: profile.role === "admin", ...autres }));
