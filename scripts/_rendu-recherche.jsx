// ============================================================
// scripts/_rendu-recherche.jsx — 🔍 LA RECHERCHE GÉNÉRALE RENDUE POUR DE VRAI
// (16/10/2026). Monté par le banc (verifier-cloisonnement) pour lire le bloc
// « 📦 Produits » : un groupe par boutique, la sienne d'abord, 6 au plus.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RechercheGlobale, BarreRecherche, grouperProduitsParBoutique, PRODUITS_PAR_BOUTIQUE, rechercherGlobalement } from "../src/components/RechercheGlobale.jsx";
export { grouperProduitsParBoutique, PRODUITS_PAR_BOUTIQUE, rechercherGlobalement };
export const rendreRecherche = (db, profile, texte) => renderToStaticMarkup(React.createElement(RechercheGlobale, { db, profile, onFermer: () => {}, onNaviguer: () => {}, texteInitial: texte }));
// 🔍 La barre de l'en-tête (21/11/2026) : ouverte, avec un texte tapé, pour le banc seul.
export const rendreBarre = (db, profile, texte, ouverte = true) => renderToStaticMarkup(React.createElement(BarreRecherche, { db, profile, onNaviguer: () => {}, texteInitial: texte, ouverteInitiale: ouverte }));
