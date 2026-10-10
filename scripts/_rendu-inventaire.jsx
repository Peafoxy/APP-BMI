// ============================================================
// scripts/_rendu-inventaire.jsx — 📋 L'INVENTAIRE DE 💰 VENTES, RENDU (10/10/2026).
// Monté par le banc (verifier-cloisonnement) : la règle pure, l'écran rendu
// pour de vrai, et le PDF fabriqué.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InventaireVentes } from "../src/screens/InventaireVentes.jsx";
import { Ventes } from "../src/screens/Ventes.jsx";
export { inventaireVentes, lignesCsvInventaire, peutVoirInventaire } from "../src/lib/inventaireVentes.js";
export { deuxPoches, fondsAVerser } from "../src/lib/versements.js";
export { totalVente } from "../src/lib/core.js";
export { genererInventaire } from "../src/pdf.js";
export const rendreInventaire = (db, boutique) => renderToStaticMarkup(React.createElement(InventaireVentes, { db, boutique }));
export const rendreVentes = (db, profile) => renderToStaticMarkup(React.createElement(Ventes, { db, profile, save: () => {} }));
