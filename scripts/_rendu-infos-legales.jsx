// ============================================================
// scripts/_rendu-infos-legales.jsx — ⚖️ LA PAGE « INFORMATIONS LÉGALES ET
// CONFIDENTIALITÉ » RENDUE POUR DE VRAI (14/11/2026). Montée par le banc
// (verifier-cloisonnement) : la fenêtre, et le lien fermé.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InfosLegales, LienInfosLegales } from "../src/components/InfosLegales.jsx";
export { sectionsLegales, TITRE_INFOS_LEGALES } from "../src/lib/infosLegales.js";
export const rendrePage = (duree) => renderToStaticMarkup(React.createElement(InfosLegales, { duree, onFermer: () => {} }));
export const rendreLien = () => renderToStaticMarkup(React.createElement(LienInfosLegales, { duree: 6 }));
