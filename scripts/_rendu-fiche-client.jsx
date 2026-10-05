// ============================================================
// scripts/_rendu-fiche-client.jsx — 🗂 LA FICHE D'UN CLIENT DANS 📋 CLIENTS,
// RENDUE POUR DE VRAI (05/10/2026, Timo : « b, lance »). On monte la fiche
// avec des lignes des DEUX espaces dans la base (le pire cas) : un contrôle
// qui lit le texte d'un filtre ne prouve pas qu'il filtre.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FicheClient } from "../src/components/FicheClient.jsx";
export { setRegardeFormation } from "../src/lib/calculs.js";

export const rendreFiche = (db, profile, cible) => renderToStaticMarkup(React.createElement(FicheClient, { db, profile, cible }));
