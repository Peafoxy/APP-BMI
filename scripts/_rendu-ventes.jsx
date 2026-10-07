// ============================================================
// scripts/_rendu-ventes.jsx — 💰 VENTES, RENDU POUR DE VRAI (07/10/2026).
// Monté par le banc (verifier-cloisonnement) pour lire ce que la liste des
// ventes affiche réellement — d'abord : le montant repris et la valeur
// restante sous le total d'une vente qui a eu une reprise.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Ventes } from "../src/screens/Ventes.jsx";
export const rendreVentes = (db, profile) => renderToStaticMarkup(React.createElement(Ventes, { db, profile, save: () => {} }));
