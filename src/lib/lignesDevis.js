// L'ordre des lignes de « Équipement proposé » dans le PDF d'un devis.
// ⚠ Ce fichier n'importe RIEN : src/pdf.js et le dimensionnement le lisent.

// Une ligne de FRAIS (installation, transport, remise) posée en fin de devis
// par `lignesFrais` (dimensionnement/devisCommun.js, qui la réexporte).
// Reconnue par la catégorie ET le début du libellé : un article du stock
// rangé dans une catégorie « Installation » n'est pas un frais (29/09/2026).
export const estLigneFrais = (l) => {
  const a = String((l && l.article) || "");
  const c = l && l.categorie;
  // Un montant libre s'écrit sans pourcentage (« Frais d'installation »).
  return (c === "Installation" && (a.startsWith("Frais d'installation (") || a === "Frais d'installation" || a === "Frais de pose (matériel du client)"))
    || (c === "Transport" && (a.startsWith("Transport / livraison (") || a === "Transport / livraison"))
    || (c === "Remise" && (a.startsWith("Remise (") || a === "Remise"));
};

// ⚠ Timo, 11/09/2026 (« trop de tautologie ») : un titre de catégorie
// n'apparaît que s'il regroupe AU MOINS 2 lignes.
// ⚠ Timo, 17/10/2026 (devis « Barrière levante », « b ») : les lignes SANS
// titre venaient après un groupe titré et se lisaient comme en faisant
// partie (« Paire de photocellules » sous « Télécommandes »). L'ordre :
//   1. les articles seuls dans leur catégorie, sans titre ;
//   2. les catégories titrées (2 lignes et plus), chacune avec ses lignes ;
//   3. les frais (installation, transport, remise), toujours en dernier,
//      sous un trait si une catégorie titrée les précède.
// Dans chaque partie, l'ordre du devis est gardé. Rien n'est renommé, rien
// n'est retiré : seule la place change.
export function groupesEquipement(lignes) {
  const groupes = [];
  const frais = [];
  for (const l of lignes || []) {
    if (estLigneFrais(l)) { frais.push(l); continue; }
    const cat = String(l.categorie || "Autres équipements");
    let g = groupes.find((x) => x.cat === cat);
    if (!g) { g = { cat, lignes: [] }; groupes.push(g); }
    g.lignes.push(l);
  }
  const seuls = groupes.filter((g) => g.lignes.length < 2).map((g) => ({ ...g, titre: false }));
  const titres = groupes.filter((g) => g.lignes.length >= 2).map((g) => ({ ...g, titre: true }));
  // Les frais en dernier, SÉPARÉS par un trait dès qu'une catégorie titrée
  // les précède — sinon ils se liraient, eux aussi, sous le titre d'avant
  // (vu sur l'exemple « Barrière levante » du 17/10/2026). Un trait et non
  // un titre : il ne prend aucune hauteur, et le bas du devis doit tenir sur
  // la page de l'équipement (11/09/2026).
  const fin = frais.length ? [{ cat: "Frais", lignes: frais, titre: false, separe: titres.length > 0 }] : [];
  return [...seuls, ...titres, ...fin];
}
