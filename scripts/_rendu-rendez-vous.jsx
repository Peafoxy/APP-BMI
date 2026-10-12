// ============================================================
// scripts/_rendu-rendez-vous.jsx — 📅 RENDEZ-VOUS, RENDU POUR DE VRAI
// (12/10/2026, « Aa, A2a, Ba, C, Da, Ea, Fb, G toutes, H a ») : l'écran se
// monte sur une base garnie ET sur une base nue (un appareil qui n'a encore
// reçu aucun rendez-vous), la règle et la notification sont exercées.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RendezVous } from "../src/screens/RendezVous.jsx";
export * from "../src/lib/rendezVous.js";
export { infosDepuisDiff } from "../src/lib/notifications.js";
export { ONGLETS_ROLE } from "../src/lib/calculs.js";
export { tableAbsenteDuServeur } from "../src/sync.js";
export { estTourneeRendezVous } from "../api/rappels-du-soir.js";

export const rendreRdv = (db, profile) => renderToStaticMarkup(React.createElement(RendezVous, { db, profile, save: () => {} }));
