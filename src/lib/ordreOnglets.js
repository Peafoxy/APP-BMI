// ============================================================
// lib/ordreOnglets.js — L'ORDRE DES ONGLETS, AU CHOIX DE CHACUN
//
// Demande Timo (12/09/2026) : « un système de déplacement des onglets par la
// préférence de chaque utilisateur… ramener l'onglet caisse juste après
// vente, librement, dans son espace à lui seul » — et, sur le geste : « pas
// de ligne "ordre des onglets"… appui long et on déplace, tout court ».
//
// Règles :
//   • le RÔLE décide quels onglets on a (ONGLETS_ROLE, aDroit) ; cette règle
//     ne fait que RANGER ce que le rôle donne — un id inconnu dans l'ordre
//     mémorisé est ignoré, un onglet que l'ordre ne cite pas se place à la
//     fin, dans l'ordre du rôle ;
//   • l'ordre est personnel : il vit dans la fiche de la personne
//     (`ordre_onglets`, comme ses brouillons de devis), suit ses appareils,
//     et ne change rien pour les autres ;
//   • le geste : appui long (DELAI_APPUI_LONG_MS) sans bouger de plus de
//     SEUIL_MOUVEMENT_PX — sinon c'est un défilement ou un clic —, puis on
//     déplace, et on relâche. Composant : components/OngletsDeplacables.jsx.
// ============================================================

export const DELAI_APPUI_LONG_MS = 500;
export const SEUIL_MOUVEMENT_PX = 8;

// Range `tabs` ([id, libellé]…) selon `ordre` (liste d'ids). Pur.
export function appliquerOrdre(tabs, ordre) {
  const liste = Array.isArray(tabs) ? tabs : [];
  if (!Array.isArray(ordre) || ordre.length === 0) return liste;
  const parId = new Map(liste.map((t) => [t[0], t]));
  const places = [];
  const vus = new Set();
  for (const id of ordre) {
    const t = parId.get(id);
    if (t && !vus.has(id)) { places.push(t); vus.add(id); }
  }
  for (const t of liste) if (!vus.has(t[0])) places.push(t);
  return places;
}

// Déplace l'élément `de` à la position `vers` dans une liste d'ids. Pur.
export function deplacer(ids, de, vers) {
  const liste = [...(ids || [])];
  if (de < 0 || de >= liste.length) return liste;
  const [x] = liste.splice(de, 1);
  const cible = Math.max(0, Math.min(liste.length, vers));
  liste.splice(cible, 0, x);
  return liste;
}

// L'ordre à mémoriser après un déplacement : les ids dans l'ordre affiché.
// Renvoie null si rien n'a changé (pas d'écriture pour rien).
export function ordreApres(ids, ordreActuel) {
  const apres = (ids || []).map(String);
  return apres.join("|") === (ordreActuel || []).join("|") ? null : apres;
}

// Où poser l'élément saisi, d'après la position du doigt et les bords des
// autres éléments (leurs milieux, dans le sens du menu). Pur, exercé par le
// banc : `milieux` = liste des milieux (x ou y) dans l'ordre affiché, hors
// l'élément saisi ; renvoie l'index d'insertion.
export function indexDepose(position, milieux) {
  const m = milieux || [];
  for (let i = 0; i < m.length; i++) if (position < m[i]) return i;
  return m.length;
}

// Un appui est-il encore un appui long (pas devenu un défilement) ?
export const resteImmobile = (dx, dy) => Math.hypot(dx, dy) < SEUIL_MOUVEMENT_PX;
