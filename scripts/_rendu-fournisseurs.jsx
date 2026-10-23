// ============================================================
// scripts/_rendu-fournisseurs.jsx — 🚚 FOURNISSEURS, RENDU POUR DE VRAI
// (23/10/2026, « a oui, b oui, c non — l'administrateur principal seul ») :
// le représentant se lit sous le nom, le bouton ✏️ est sur la ligne.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Fournisseurs } from "../src/screens/Fournisseurs.jsx";
export * as R from "../src/lib/fournisseurs.js";

export const rendreFournisseurs = (db, profile) => renderToStaticMarkup(React.createElement(Fournisseurs, { db, save() {}, profile }));
