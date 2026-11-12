// 🌗 LE MODE CLAIR / SOMBRE (12/11/2026, « Aa, Ba, C clair, D oui laisse
// comme ça » — après « le clair reprend le mode paramétré »).
//
// - « A a » : CHAQUE PERSONNE choisit, dans 🧭 Affichage. Le choix vit sur SA
//   fiche (`theme`), comme `interface` et `ordre_onglets` : il la suit sur ses
//   appareils, rien à coller (la fiche accepte déjà un champ personnel).
//   L'administrateur ne le fixe PAS (ce n'était pas demandé).
// - « B a » : un troisième choix, « 📱 Automatique », qui suit le réglage du
//   téléphone ou du PC.
// - « C » : CLAIR d'office — l'application telle qu'elle est, avec tout ce
//   qui est réglé dans ⚙ Paramètres. Rien ne change tant qu'on n'y touche pas.
// - « D » : la page d'icônes et la fenêtre de verrou gardent leur fond (le
//   CSS les rend telles quelles, src/index.css).
//
// Comment : un seul réglage CSS sur la page (`html[data-theme="sombre"]`,
// src/index.css) retourne les couleurs ; les photos, les documents à imprimer
// et les cadres marqués `data-garder-clair` sont remis à l'endroit. Aucune
// ligne d'écran n'est repeinte.
//
// ⚠ Ce fichier n'importe RIEN.

export const THEME_CLAIR = "clair";
export const THEME_SOMBRE = "sombre";
export const THEME_AUTO = "auto";
export const THEME_DEFAUT = THEME_CLAIR;
export const THEMES = [THEME_CLAIR, THEME_SOMBRE, THEME_AUTO];
export const LIBELLES_THEME = {
  [THEME_CLAIR]: "☀️ Mode clair",
  [THEME_SOMBRE]: "🌙 Mode sombre",
  [THEME_AUTO]: "📱 Automatique (comme le téléphone ou le PC)",
};
export const estTheme = (v) => THEMES.includes(v);

// Le choix de la personne, sinon le clair.
export function themeDe(fiche) {
  return estTheme(fiche?.theme) ? fiche.theme : THEME_DEFAUT;
}

// Ce qui s'AFFICHE vraiment : « automatique » suit l'appareil.
export function themeApplique(theme, appareilSombre) {
  if (theme === THEME_SOMBRE) return THEME_SOMBRE;
  if (theme === THEME_AUTO) return appareilSombre ? THEME_SOMBRE : THEME_CLAIR;
  return THEME_CLAIR;
}

export function critiqueChoixTheme(valeur) {
  return estTheme(valeur) ? "" : "Mode inconnu.";
}
