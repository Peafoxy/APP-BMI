// ⚙ Paramètres RENDU (18/11/2026) : la version 2.101.781 a donné un ÉCRAN BLANC (un état lu avant
// sa déclaration) — le build et verifier-imports ne le voient pas, seul le rendu l'attrape.
// Bundle à part : l'écran tire la carte (Leaflet), qu'un banc Node ne sait pas charger telle quelle.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Parametres } from "../src/screens/Parametres.jsx";
export { setRegardeFormation } from "../src/lib/calculs.js";
export const rendreParametres = (db, profile) => renderToStaticMarkup(React.createElement(Parametres, { db, profile, save: () => {}, setDb: () => {} }));
