// ============================================================
// scripts/_rendu-rapports.jsx — 🕘 HISTORIQUE, 📈 RENTABILITÉ et
// 📊 TABLEAU DE BORD, RENDUS POUR DE VRAI (01/10/2026, chapitre 22).
//
// ⚠ Trouvé en écrivant le chapitre : 🕘 Historique lisait db.audits BRUT —
// l'administrateur principal, qui télécharge les DEUX espaces, y lisait les
// gestes d'entraînement mêlés aux vrais. Un contrôle qui lit le TEXTE d'un
// filtre ne prouve pas qu'il filtre : on rend l'écran, dans chaque espace,
// avec les lignes des DEUX espaces dans la base (le pire cas).
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Historique } from "../src/screens/Historique.jsx";
import { Rentabilite } from "../src/screens/Rentabilite.jsx";
import { Dashboard } from "../src/screens/Dashboard.jsx";
export { setRegardeFormation } from "../src/lib/calculs.js";

export const rendreHistorique = (db, profile) => renderToStaticMarkup(React.createElement(Historique, { db, profile }));
export const rendreRentabilite = (db, profile) => renderToStaticMarkup(React.createElement(Rentabilite, { db, profile }));
export const rendreDashboard = (db, profile) => renderToStaticMarkup(React.createElement(Dashboard, { db, profile, save: () => {} }));
