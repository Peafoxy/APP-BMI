// ============================================================
// scripts/_rendu-argent-recu.jsx — 💼 ARGENT REÇU, RENDU POUR DE VRAI
// (10/10/2026, « A b, B b, C a, D a ») : l'argent remis à quelqu'un, pour un
// chantier ou hors chantier, s'explique dans l'onglet « 💼 Argent reçu ».
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArgentRecu } from "../src/screens/ArgentRecu.jsx";

export const rendreArgentRecu = (db, profile) => renderToStaticMarkup(React.createElement(ArgentRecu, { db, profile, save: () => {} }));
