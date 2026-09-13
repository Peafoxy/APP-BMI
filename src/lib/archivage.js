// ============================================================
// lib/archivage.js — LA règle d'archivage des historiques (Timo, 13/09/2026)
//
// « Les lignes doivent montrer au plus 10 lignes, au-delà on doit défiler
// pour voir les autres ; et après 3 mois, au-delà de 20 lignes, les
// anciennes sont archivées automatiquement. Pour les voir, il faut remonter
// dans les archives. » Puis : « l'historique des versements pour le moment…
// avec le temps on va implémenter cette règle d'archivage pour d'autres
// écrans, mais que ça soit LA SEULE règle qui gère ça ».
//
// Pure, sans React : le banc l'exerce. Rien n'est effacé ni déplacé dans la
// base — « archivé » est une façon d'AFFICHER, décidée ici et nulle part
// ailleurs. Le composant commun components/HistoriqueArchive.jsx la montre.
// ============================================================

// Combien de lignes on voit sans défiler.
export const LIGNES_VISIBLES = 10;
// Une ligne est « ancienne » après ce nombre de mois.
export const MOIS_AVANT_ARCHIVE = 3;
// Les N lignes les plus récentes restent toujours visibles, même anciennes.
export const MINIMUM_RECENTES = 20;

// La date limite : `mois` mois avant aujourd'hui, au format AAAA-MM-JJ.
export const dateLimite = (aujourdhui, mois = MOIS_AVANT_ARCHIVE) => {
  const [a, m, j] = String(aujourdhui).slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 - mois, j));
  return d.toISOString().slice(0, 10);
};
export const estAncienne = (date, aujourdhui, mois = MOIS_AVANT_ARCHIVE) => String(date || "").slice(0, 10) < dateLimite(aujourdhui, mois);

// Sépare une liste (triée du plus récent au plus ancien par cette fonction)
// en lignes visibles et lignes archivées. Une ligne est archivée quand les
// DEUX conditions sont vraies : elle est ancienne (plus de 3 mois) ET elle
// n'est pas parmi les 20 plus récentes.
export function separerArchives(lignes, { aujourdhui, dateDe = (l) => l.date, mois = MOIS_AVANT_ARCHIVE, minimum = MINIMUM_RECENTES } = {}) {
  const triees = [...(lignes || [])].sort((a, b) => String(dateDe(b) || "").localeCompare(String(dateDe(a) || "")));
  const visibles = [], archives = [];
  triees.forEach((l, i) => ((i >= minimum && estAncienne(dateDe(l), aujourdhui, mois)) ? archives : visibles).push(l));
  return { visibles, archives };
}

// Les archives rangées par mois (« 2026-06 »), du plus récent au plus ancien.
export function parMois(lignes, dateDe = (l) => l.date) {
  const groupes = new Map();
  for (const l of lignes || []) {
    const cle = String(dateDe(l) || "").slice(0, 7) || "—";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(l);
  }
  return [...groupes.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([mois, lignes]) => ({ mois, libelle: libelleMois(mois), lignes }));
}
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const libelleMois = (aaaaMm) => { const [a, m] = String(aaaaMm).split("-").map(Number); return m >= 1 && m <= 12 ? `${MOIS[m - 1]} ${a}` : String(aaaaMm); };
