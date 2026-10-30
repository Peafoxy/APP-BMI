// ============================================================
// scripts/_rendu-recherche.jsx — 🔍 LA RECHERCHE GÉNÉRALE RENDUE POUR DE VRAI
// (16/10/2026). Monté par le banc (verifier-cloisonnement) pour lire le bloc
// « 📦 Produits » : un groupe par boutique, la sienne d'abord, 6 au plus.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RechercheGlobale, grouperProduitsParBoutique, PRODUITS_PAR_BOUTIQUE, rechercherGlobalement } from "../src/components/RechercheGlobale.jsx";
export { grouperProduitsParBoutique, PRODUITS_PAR_BOUTIQUE, rechercherGlobalement };
export const rendreRecherche = (db, profile, texte) => renderToStaticMarkup(React.createElement(RechercheGlobale, { db, profile, onFermer: () => {}, onNaviguer: () => {}, texteInitial: texte }));
