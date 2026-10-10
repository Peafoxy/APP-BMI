// ============================================================
// scripts/_rendu-primes.jsx — 💰 PRIMES REÇUES, RENDU POUR DE VRAI
// (10/10/2026, « A b, B a, C a ») : l'écran réunit les parts
// d'installation, les primes sur chantier et les primes sur salaire.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PrimesRecues } from "../src/screens/PrimesRecues.jsx";
export { ROLES_PRIMES_RECUES, primesSurSalaire, ONGLETS_ROLE } from "../src/lib/calculs.js";

export const rendrePrimes = (db, profile) => renderToStaticMarkup(React.createElement(PrimesRecues, { db, profile }));
