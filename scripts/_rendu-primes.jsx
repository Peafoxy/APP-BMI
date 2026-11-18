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

// 💰 PRIMES REMISES (18/11/2026, façon carnet) : l'écran de celui qui paie.
import { PrimesRemises } from "../src/screens/PrimesRemises.jsx";
export const rendrePrimesRemises = (db, profile) => renderToStaticMarkup(React.createElement(PrimesRemises, { db, save: () => {}, profile }));

// 🚚 RAVITAILLEMENT et 🔁 TRANSFERT (18/11/2026, façon carnet) : les deux écrans RENDUS.
import { DemandeRavitaillement, DemandesTransfertRecues } from "../src/screens/Ravitaillement.jsx";
export const rendreRavitaillement = (db, profile) => renderToStaticMarkup(React.createElement(DemandeRavitaillement, { db, save: () => {}, profile }));
export const rendreTransfert = (db, profile) => renderToStaticMarkup(React.createElement(DemandesTransfertRecues, { db, save: () => {}, profile }));

// 📨 DEMANDES DE PRIX (18/11/2026, façon carnet) : la liste et la demande dépliée, RENDUES.
import { DemandesPrix } from "../src/components/DemandesPrix.jsx";
export const rendreDemandesPrix = (db, profile, demandeOuverteInitiale = null) =>
  renderToStaticMarkup(React.createElement(DemandesPrix, { db, save: () => {}, profile, fournisseurs: db.fournisseurs || [], demandePour: null, onDemandePourFini: () => {}, demandeOuverteInitiale }));

// 📄 CONTRATS D'INSTALLATION (18/11/2026, façon carnet) : l'écran RENDU, vu par l'administrateur et par le client.
import { ContratsInstallation } from "../src/screens/ContratsInstallation.jsx";
export const rendreContrats = (db, profile) => renderToStaticMarkup(React.createElement(ContratsInstallation, { db, save: () => {}, profile }));
