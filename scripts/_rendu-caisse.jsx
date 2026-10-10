// ============================================================
// scripts/_rendu-caisse.jsx — 🔒 CAISSE, RENDUE POUR DE VRAI (10/10/2026).
// Monté par le banc (verifier-cloisonnement) pour lire le détail du tiroir
// tel qu'il s'affiche : le bouton selon le rôle, et les chiffres jour par jour.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Caisse } from "../src/screens/Caisse.jsx";
export const rendreCaisse = (db, profile, detailTiroirInitial = false) => renderToStaticMarkup(React.createElement(Caisse, { db, profile, save: () => {}, detailTiroirInitial }));
