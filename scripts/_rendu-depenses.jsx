// ============================================================
// scripts/_rendu-depenses.jsx — 📤 DÉPENSES, LE TABLEAU RENDU POUR DE VRAI
// (15/10/2026). Monté par le banc (verifier-cloisonnement) pour lire ce que
// la liste affiche : la catégorie en tête et figée, la description sur deux
// lignes puis entière au clic, le paiement en pastille, le statut en pastille.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TableauDepenses, Depenses } from "../src/screens/Depenses.jsx";
export const rendreTableauDepenses = (liste, profile, deplieeInitiale = null) => renderToStaticMarkup(React.createElement(TableauDepenses, { liste, profile, onSupprimer: () => {}, onModifier: () => {}, vide: "Aucune dépense.", deplieeInitiale }));
// 🏗 L'écran entier (10/11/2026) : le bouton 🏗 DÉPÔT CHANTIER de l'administrateur,
// la ligne « Une dépense attend aussi votre validation dans… ».
export const rendreEcranDepenses = (db, profile) => renderToStaticMarkup(React.createElement(Depenses, { db, profile, save: () => {} }));
