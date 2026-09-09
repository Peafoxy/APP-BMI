// ============================================================
// lib/suggestions.js — LA règle de recherche d'un champ à suggestions
// (demande Timo, 08/09/2026 : « pour caméra, si on tape "came", il ne
// propose pas — la proposition est trop rigide »). Pur, sans React : le
// banc l'exerce telle quelle. Utilisée par components/ChampSuggestions.jsx,
// le seul champ à suggestions de l'application (plus de liste native du navigateur).
// ============================================================

// Sans accents, sans majuscules, espaces repliés : « Camé » = « came ».
export const sansAccents = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

// Les mots d'un texte (lettres et chiffres), pour comparer mot à mot.
const motsDe = (t) => t.split(/[^a-z0-9]+/).filter(Boolean);
// Un mot tapé se retrouve-t-il dans le texte ? Un mot COURT (3 lettres ou
// moins) doit COMMENCER un mot du texte : « tv » vaut « tv », « tv 32 »,
// jamais le « tv » caché dans « dstv » ou « cctv » (capture Timo,
// 09/09/2026 : décodeur et caméra sortaient pour « tv »). Un mot plus long
// peut être n'importe où : « came » trouve « caméra ».
const motTrouve = (t, motsTexte, m) => (m.length <= 3 ? motsTexte.some((x) => x.startsWith(m)) : t.includes(m));
// Chaque mot tapé doit se retrouver dans le texte, dans n'importe quel
// ordre : « cable 6 » trouve « Câble solaire 6mm² ».
export const correspond = (texte, requete) => {
  const mots = sansAccents(requete).split(" ").filter(Boolean);
  const t = sansAccents(texte);
  const motsTexte = motsDe(t);
  return mots.every((m) => motTrouve(t, motsTexte, m));
};

// Une faute d'une lettre ne bloque pas (Timo, 09/09/2026 : « climatisseur »,
// « refrigerateur », « télévison » doivent trouver l'appareil). Distance
// d'édition entre deux mots : lettres changées, ajoutées ou retirées.
export const distance = (a, b) => {
  a = String(a); b = String(b);
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};
// Chaque mot tapé (4 lettres au moins) se retrouve dans le texte tel quel,
// ou à UNE faute près d'un mot du texte (ou de son début : « climatis » vaut
// « climatiseur »). Les mots courts ne tolèrent rien : « tv » reste « tv ».
export const correspondApprox = (texte, requete) => {
  const mots = sansAccents(requete).split(" ").filter(Boolean);
  const t = sansAccents(texte);
  const motsTexte = motsDe(t);
  return mots.every((m) => motTrouve(t, motsTexte, m)
    || (m.length >= 4 && motsTexte.some((x) => distance(m, x) <= 1 || (x.length > m.length && distance(m, x.slice(0, m.length)) <= 1))));
};

// Les propositions pour ce qui est tapé : celles qui COMMENCENT par la
// saisie d'abord, puis celles qui la contiennent (dans le nom, le détail ou
// les mots de recherche `mots` — abréviations, autres noms), puis celles
// qui la trouvent à une faute près ; sans doublon, au plus `max`. Une
// saisie vide propose le début de la liste (on voit qu'il y a du choix).
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
  if (!q) return uniques.slice(0, max);
  const exact = (s) => correspond(s.valeur, q) || (s.detail && correspond(s.detail, q)) || (s.mots && correspond(s.mots, q));
  const retenues = uniques.filter(exact);
  const commence = retenues.filter((s) => sansAccents(s.valeur).startsWith(q));
  const contient = retenues.filter((s) => !sansAccents(s.valeur).startsWith(q));
  const approx = uniques.filter((s) => !exact(s) && (correspondApprox(s.valeur, q) || (s.mots && correspondApprox(s.mots, q))));
  return [...commence, ...contient, ...approx].slice(0, max);
};
