// ============================================================
// scripts/_rendu-utilisateurs.jsx — 👥 UTILISATEURS, RENDU POUR DE VRAI
// (15/10/2026, « B ») : la ligne « ✅ Ouvert le … / ⏳ Jamais ouvert » sous
// chaque nom et le filtre, pour l'administrateur principal seul.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "../src/screens/Utilisateurs.jsx";
export { peutVoirConnexions, connexionsPourIds, etatConnexion, libelleConnexion, dansFiltreConnexion } from "../src/lib/connexionsComptes.js";

export const rendreUtilisateurs = (db, profile, connexionsInitiales) =>
  renderToStaticMarkup(React.createElement(Users, { db, profile, save: () => {}, connexionsInitiales }));
