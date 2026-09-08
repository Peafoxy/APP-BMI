// ============================================================
// lib/suggestions.js — LA règle de recherche d'un champ à suggestions
// (demande Timo, 08/09/2026 : « pour caméra, si on tape "came", il ne
// propose pas — la proposition est trop rigide »). Pur, sans React : le
// banc l'exerce telle quelle. Utilisée par components/ChampSuggestions.jsx,
// le seul champ à suggestions de l'application (plus de liste native du navigateur).
// ============================================================

// Sans accents, sans majuscules, espaces repliés : « Camé » = « came ».
export const sansAccents = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

// Chaque mot tapé doit se retrouver quelque part dans le texte, dans
// n'importe quel ordre : « cable 6 » trouve « Câble solaire 6mm² ».
export const correspond = (texte, requete) => {
  const mots = sansAccents(requete).split(" ").filter(Boolean);
  const t = sansAccents(texte);
  return mots.every((m) => t.includes(m));
};

// Les propositions pour ce qui est tapé : celles qui COMMENCENT par la
// saisie d'abord, puis les autres, sans doublon, au plus `max`. Une saisie
// vide propose le début de la liste (on voit qu'il y a du choix).
export const filtrerSuggestions = (liste, requete, max = 30) => {
  const q = sansAccents(requete);
  const vues = new Set();
  const uniques = [];
  for (const s of liste || []) {
    const cle = sansAccents(s?.valeur);
    if (!cle || vues.has(cle)) continue;
    vues.add(cle);
    uniques.push(s);
  }
  const retenues = q ? uniques.filter((s) => correspond(s.valeur, q) || (s.detail && correspond(s.detail, q))) : uniques;
  const commence = retenues.filter((s) => sansAccents(s.valeur).startsWith(q));
  const contient = retenues.filter((s) => !sansAccents(s.valeur).startsWith(q));
  return [...commence, ...contient].slice(0, max);
};
