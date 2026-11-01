// ============================================================
// scripts/_rendu-assistant-direction.jsx — L'ASSISTANT(E) DE DIRECTION,
// RENDU POUR DE VRAI (01/11/2026) : l'onglet ✅ Tâches avec « Tâches
// confiées aux gérants », et les règles du rôle.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MesTaches } from "../src/screens/MesTaches.jsx";
export * as AD from "../src/lib/assistantDirection.js";
export { libelleRoleEmploye } from "../src/lib/comptesClients.js";
export { ROLES_TACHES, ONGLETS_ROLE, ACTIONS_POUVOIR } from "../src/lib/calculs.js";
export { infosDepuisDiff } from "../src/lib/notifications.js";
export { idsAssistants } from "../src/lib/espace.js";
export { REPLIS_ECRAN } from "../src/lib/cibleNotification.js";
export { TABLES } from "../src/db.js";

export const rendreTaches = (db, profile) => renderToStaticMarkup(React.createElement(MesTaches, { db, save: () => {}, profile }));
