// ============================================================
// lib/barcode.js — Générateur de code-barres Code128 (sous-jeu B),
// AUTONOME : aucune bibliothèque externe, pour ne rien ajouter au
// projet qui puisse un jour casser la construction (npm install,
// mise à jour d'une dépendance tierce, etc.). Fonctionnalité
// entièrement nouvelle, n'affecte aucun code existant.
// ============================================================

// Table officielle Code128 : 107 motifs (index 0 à 106), chacun un
// motif de largeurs de barres/espaces (6 chiffres = 3 barres + 3
// espaces en alternance, sauf STOP qui a 7 chiffres). Norme publique
// ISO/IEC 15417 — ce ne sont que des largeurs de traits, pas un
// contenu créatif.
const MOTIFS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
// Sous-jeu B : caractères ASCII 32 (espace) à 127, valeur = code ASCII - 32.
// START B = valeur 104. STOP = motif d'index 106.
const START_B = 104;
const STOP = 106;

// Encode un texte (ASCII imprimable uniquement) en motif Code128B.
// Retourne null si le texte contient un caractère non encodable —
// on ne génère alors PAS de code-barres invalide.
export function encoderCode128B(texte) {
  const t = String(texte || "");
  if (!t || [...t].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126)) return null;
  const valeurs = [START_B, ...[...t].map((c) => c.charCodeAt(0) - 32)];
  let somme = valeurs[0];
  for (let i = 1; i < valeurs.length; i++) somme += valeurs[i] * i;
  const checksum = somme % 103;
  const tousLesIndex = [...valeurs, checksum, STOP];
  return tousLesIndex.map((i) => MOTIFS[i]).join("");
}

// Fabrique un SVG scannable à partir d'un motif de largeurs (chaîne de
// chiffres, chaque chiffre = largeur d'une barre/espace en modules).
export function genererSVGCode128(texte, { largeurModule = 2, hauteur = 70 } = {}) {
  const motif = encoderCode128B(texte);
  if (!motif) return null;
  let x = 0, barre = true; // Code128 commence toujours par une barre
  const rects = [];
  for (const chiffre of motif) {
    const largeur = Number(chiffre) * largeurModule;
    if (barre) rects.push(`<rect x="${x}" y="0" width="${largeur}" height="${hauteur}" fill="#000"/>`);
    x += largeur;
    barre = !barre;
  }
  // width/height en style (pas seulement en attributs) : permet au SVG de
  // s'adapter proportionnellement à un conteneur en taille physique réelle
  // (mm), pour une impression à dimension garantie plutôt que dépendante
  // des réglages d'échelle du navigateur.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${hauteur}" viewBox="0 0 ${x} ${hauteur}" style="width:100%;height:auto;display:block">${rects.join("")}</svg>`;
}
