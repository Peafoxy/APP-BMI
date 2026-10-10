// ============================================================
// scripts/_rendu-dettes.jsx — 📋 DETTES, RENDU POUR DE VRAI (10/10/2026).
// Monté par le banc (verifier-cloisonnement) pour lire ce que la liste des
// dettes affiche réellement — d'abord : la ligne grisée d'un règlement versé
// à part et validé (la dette dépliée montre ses règlements).
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dettes } from "../src/screens/Dettes.jsx";
export const rendreDettes = (db, profile, detteDeplieeInitiale = null) => renderToStaticMarkup(React.createElement(Dettes, { db, profile, save: () => {}, detteDeplieeInitiale }));
