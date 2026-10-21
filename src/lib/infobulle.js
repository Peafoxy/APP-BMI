// ============================================================
// src/lib/infobulle.js — 💬 LA DESCRIPTION D'UN BOUTON, DANS SA FENÊTRE À LUI
// (21/10/2026, capture Timo de 💰 Ventes : « la description sur ce bouton est
// en une seule ligne et ce n'est pas bien esthétiquement… ramener ça en
// fenêtre avec fond qui a la couleur du bouton, avec la description en
// plusieurs lignes… une seule règle pour tous les écrans » → « a, lance »).
//
// Le cadre gris d'une seule ligne était celui de Windows (l'attribut `title`).
// L'hôte commun (`InfobulleHost`, components/ui.jsx) le remplace au survol de
// TOUT bouton qui porte une description. Ici, les règles pures, SANS import :
//   - « a » : fond PÂLE de la couleur du bouton, contour et texte de SA
//     couleur (`styleInfobulle`) ; un bouton à texte blanc sur fond coloré
//     prend la couleur de son FOND (`couleurDeReference`) ;
//   - la place : sous le bouton, au-dessus s'il n'y a plus de place, jamais
//     hors de l'écran (`placerInfobulle`).
// ============================================================

export const LARGEUR_MAX_INFOBULLE = 280;
export const DELAI_INFOBULLE_MS = 350;
const ECART = 6; // entre le bouton et la fenêtre
const MARGE = 8; // au bord de l'écran
const PART_DE_COULEUR = 0.12; // le fond : 12 % de la couleur, le reste blanc
const COULEUR_PAR_DEFAUT = [51, 65, 85]; // ardoise, si rien n'est lisible

const lumiere = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const opaque = (c) => Array.isArray(c) && c.length >= 3 && (c[3] === undefined || c[3] > 0.5);
const melange = (a, b, part) => a.slice(0, 3).map((v, i) => Math.round(v * part + b[i] * (1 - part)));
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

// La couleur qui « est » le bouton : celle de son texte (les boutons ronds ont
// un fond blanc ou pâle et l'icône en couleur), sauf si ce texte est clair —
// un bouton plein (texte blanc sur fond bleu) prend alors son fond.
export function couleurDeReference(texte, fond) {
  if (opaque(texte) && lumiere(texte) < 0.6) return texte.slice(0, 3);
  if (opaque(fond) && lumiere(fond) < 0.85) return fond.slice(0, 3);
  return COULEUR_PAR_DEFAUT.slice();
}

// « a » : fond pâle, contour et texte de la couleur. Une couleur trop claire
// pour être lue sur fond pâle (ambre vif, vert clair) est foncée pour le texte.
export function styleInfobulle(couleur) {
  const c = Array.isArray(couleur) && couleur.length >= 3 ? couleur.slice(0, 3) : COULEUR_PAR_DEFAUT;
  const texte = lumiere(c) > 0.45 ? melange(c, [0, 0, 0], 0.55) : c;
  return {
    color: rgb(texte),
    borderColor: rgb(c),
    backgroundColor: rgb(melange(c, [255, 255, 255], PART_DE_COULEUR)),
  };
}

// Où poser la fenêtre : centrée sous le bouton ; au-dessus s'il n'y a pas la
// place en bas ; toujours dans l'écran, à 8 px des bords.
export function placerInfobulle(bouton, bulle, fenetre) {
  const b = bouton || {}, t = bulle || {}, f = fenetre || {};
  const largeur = Math.min(Number(t.width) || 0, Math.max(0, (f.width || 0) - 2 * MARGE));
  const hauteur = Number(t.height) || 0;
  const centre = (Number(b.left) || 0) + (Number(b.width) || 0) / 2;
  const left = Math.max(MARGE, Math.min(centre - largeur / 2, (f.width || 0) - MARGE - largeur));
  const enBas = (Number(b.bottom) || 0) + ECART;
  const dessus = enBas + hauteur > (f.height || 0) - MARGE && (Number(b.top) || 0) - ECART - hauteur >= MARGE;
  const top = dessus ? (Number(b.top) || 0) - ECART - hauteur : Math.max(MARGE, Math.min(enBas, (f.height || 0) - MARGE - hauteur));
  return { left: Math.round(left), top: Math.round(top), dessus };
}
