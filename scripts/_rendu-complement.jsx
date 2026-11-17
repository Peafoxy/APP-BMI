// ============================================================
// scripts/_rendu-complement.jsx — 🧩 LE COMPLÉMENT DE LA FICHE, RENDU POUR DE VRAI
// (17/11/2026) : le formulaire et le bloc du volet solaire, dessinés par React.
// Un écran que le banc ne rend pas est un écran blanc en puissance.
// ============================================================
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormulaireComplement, BlocComplementTechnique, ComplementDuDevis } from "../src/components/ComplementTechnique.jsx";

export const rendreFormulaire = (valeur, panneaux) => renderToStaticMarkup(React.createElement(FormulaireComplement, { valeur, onChange() {}, panneaux }));
export const rendreBloc = (complement) => renderToStaticMarkup(React.createElement(BlocComplementTechnique, { r: { complement, setComplement() {} }, panneaux: 4 }));
export const rendrePanneau = (devis, valeurInitiale) => renderToStaticMarkup(React.createElement(ComplementDuDevis, { devis, valeurInitiale, panneaux: 4, onAnnuler() {}, onEnregistrer() {} }));
