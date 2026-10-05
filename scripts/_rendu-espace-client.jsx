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
import { EspaceClient, SuiviPoseClient } from "../src/screens/EspaceClient.jsx";
import { validerDevis } from "../src/lib/validationDevis.js";
// ⚠ 🔒 Mes données est un ÉCRAN à part depuis le 19/09/2026 (Timo : « ramener
// ça en onglet à côté de message ») : il se rend donc ici aussi, sinon le
// contrôle qui attrape les écrans blancs ne le couvrirait pas.
import { MesDonnees } from "../src/screens/MesDonnees.jsx";

const profile = { id: "c1", role: "client", nom: "KOSSI", tel: "90112233" };
const moi = { id: "c1", role: "client", nom: "KOSSI", tel: "90112233", devis: [] };

const rendre = (db) => renderToStaticMarkup(
  React.createElement(EspaceClient, { db, profile, save: () => {}, setTab: () => {} })
);
const rendreDonnees = (db) => renderToStaticMarkup(
  React.createElement(MesDonnees, { db, profile })
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

// 3. Et le nouvel onglet 🔒 Mes données, dans les deux mêmes cas.
const dbGarni = {
  users: [moi],
  boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", tel: "90000000" }],
  ventes: [{ id: "v1", client: "KOSSI", tel: "90112233", date: "2026-09-01", total: 120000, boutique: "BMI DEMAKPOE" }],
  dettes: [], proformas: [], commandes: [], clients_installes: [], messages: [],
};
export const htmlDonnees = rendreDonnees(dbGarni);
export const htmlDonneesNu = rendreDonnees({ users: [moi], messages: [] });

// 4. 🔧 Une POSE SEULE validée par le client (05/10/2026) : le bloc qu'il lit
// juste après sa signature, rendu sur la base que fabrique la VRAIE validation.
const devisPose = { id: "dp", date: "2026-10-05", par: "AMA", statut: "propose", pose_seule: true, boutique: "BMI DEMAKPOE",
  lignes: [{ article: "Pose et mise en service", categorie: "Installation", qte: 1, pu: 300000, total: 300000 }], total: 300000 };
const baseP = { users: [{ ...moi, devis: [devisPose] }], boutiques: [{ id: "b1", nom: "BMI DEMAKPOE", tel: "90000000", adresse: "Démakpoé" }],
  ventes: [], dettes: [], clients_installes: [], messages: [], proformas: [], commandes: [] };
const rP = validerDevis(baseP, { clientId: "c1", devisId: "dp", infosContrat: { contrat_numero: "BMI-T" }, acteur: { nom: "KOSSI", estClient: true } });
const dP = rP.db.users[0].devis[0];
const rendrePose = (db) => renderToStaticMarkup(React.createElement(SuiviPoseClient, { d: dP, db }));
export const htmlPoseAvant = rendrePose(rP.db);
const avecPaye = (paye) => ({ ...rP.db, dettes: rP.db.dettes.map((x) => ({ ...x, paye, paiements: paye ? [{ date: "2026-10-06", montant: paye }] : [] })) });
export const htmlPoseAcompte = rendrePose(avecPaye(210000));
export const htmlPoseSolde = rendrePose(avecPaye(300000));
// ⚠ La vraie base d'un téléphone de client ne porte pas les boutiques.
export const htmlPoseNu = rendrePose({ ...rP.db, boutiques: undefined });
