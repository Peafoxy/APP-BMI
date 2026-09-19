// ============================================================
// scripts/_rendu-espace-client.jsx — L'ÉCRAN DU CLIENT, RENDU POUR DE VRAI
//
// ⚠⚠ POURQUOI CE FICHIER EXISTE (capture Timo, 19/09/2026 : un client tape
// son nom et son mot de passe, et tombe sur un ÉCRAN BLANC).
//
// La cause : `boutiquesVisibles(db, profile)` appelé SANS son troisième
// argument, la liste des boutiques — donc `undefined.filter(...)`, une
// exception au rendu, un écran blanc. Deux appels de cette forme s'étaient
// glissés dans l'application (EspaceClient et ⚙ Paramètres).
//
// ⚠ ET LE BANC EXIGEAIT LA FORME FAUTIVE : le contrôle du point 3 cherchait
// le TEXTE `boutiquesVisibles(db, profile)` dans le fichier et le trouvait —
// il vérifiait donc la présence de l'appel CASSÉ. C'est le pire cas possible :
// un contrôle qui GARANTIT un défaut. « Le banc mesure, il ne présume pas » :
// un contrôle qui lit du TEXTE ne fait pas tourner une fonction.
//
// Depuis : on MONTE l'écran et on le rend. S'il lève, le banc tombe.
//
// ⚠ DEUX bases, parce que la seconde est la vraie : sur le téléphone d'un
// client, les politiques du serveur ne descendent QUE ses données — ni
// boutiques, ni produits, ni rien de la maison.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EspaceClient } from "../src/screens/EspaceClient.jsx";

const profile = { id: "c1", role: "client", nom: "KOSSI", tel: "90112233" };
const moi = { id: "c1", role: "client", nom: "KOSSI", tel: "90112233", devis: [] };

const rendre = (db) => renderToStaticMarkup(
  React.createElement(EspaceClient, { db, profile, save: () => {}, setTab: () => {} })
);

// 1. Une base garnie, comme chez un client qui a déjà acheté.
export const htmlGarni = rendre({
  users: [moi],
  boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", tel: "90000000" }],
  ventes: [{ id: "v1", client: "KOSSI", tel: "90112233", date: "2026-09-01", total: 120000, boutique: "BMI DEMAKPOE" }],
  dettes: [], proformas: [], commandes: [], clients_installes: [],
  messages: [], audits: [], produits: [], depenses: [], ajustements: [],
  reglages: {}, prospects: [], groupes: [],
});

// 2. LA VRAIE base d'un téléphone de client : presque rien.
export const htmlNu = rendre({ users: [moi], messages: [] });
