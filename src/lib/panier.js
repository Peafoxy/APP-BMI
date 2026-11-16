// ============================================================
// lib/panier.js — LE PANIER D'UNE VENTE OU D'UNE COMMANDE, EN UN SEUL
// ENDROIT (point A7 du relevé des doublons, Timo : « lance tout »,
// 08/09/2026). Ventes.jsx et Commandes.jsx avaient chacun leur copie du
// lecteur de code-barres et de l'ajout au panier. Ce qui DIFFÈRE entre les
// deux écrans — un article en rupture n'empêche pas la vente (règle Timo)
// mais bloque une commande — reste dans chaque écran : ce n'est pas un
// doublon, c'est une décision. Fichier PUR : le banc l'exerce.
// ============================================================

// L'article dont le code-barres est celui lu (le lecteur USB « tape » le
// code puis Entrée) ; null si aucun article de la boutique ne le porte.
export const articleParCode = (produits, code) => {
  const c = String(code ?? "").trim();
  if (!c) return null;
  return (produits || []).find((p) => String(p.code || "").trim() === c) || null;
};

// Ajoute une ligne au panier : si le même article y est déjà AU MÊME PRIX,
// la quantité s'ajoute (et la remise de ligne aussi) ; sinon une ligne
// nouvelle. La remise de ligne n'existe que pour les ventes : on ne
// l'écrit pas sur une commande (remiseLigne non fourni).
export const mettreAuPanier = (panier, p, q, pu, remiseLigne) => {
  const avecRemise = remiseLigne !== undefined;
  const i = (panier || []).findIndex((l) => l.produit_id === p.id && Number(l.pu) === Number(pu));
  if (i >= 0) {
    const cp = [...panier];
    cp[i] = { ...cp[i], qte: Number(cp[i].qte) + Number(q), ...(avecRemise ? { remise_ligne: Number(cp[i].remise_ligne || 0) + Number(remiseLigne || 0) } : {}) };
    return cp;
  }
  return [...(panier || []), { produit_id: p.id, article: p.nom, qte: Number(q), pu: Number(pu), ...(avecRemise ? { remise_ligne: Number(remiseLigne || 0) } : {}) }];
};

// ============ 🔒 LE PRIX SOUS LE STOCK (Timo, 16/11/2026 : « 1, 2 et 3 ») ============
// La case « Prix unitaire » se tapait librement : la limite de remise se
// contournait en tapant un prix plus bas, sans aucune ruse. Hors
// administrateur, un article du stock ne se vend plus SOUS son prix : pour
// baisser, on passe par la case Remise (limite, autorisation à distance).
// Vendre PLUS cher reste libre.
// ⚠ LE COUPLE : `ligne_sous_le_prix` (supabase/securite-53) dit la même chose.
// L'écran refuse d'abord — sinon la base refuserait à la synchronisation et
// tout le lot resterait coincé.
export const peutVendreSousLePrix = (profile) => profile?.role === "admin";

const francs = (n) => `${String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} F`;

// Les lignes vendues sous le prix du stock. Ne sont jamais comparées : une
// ligne hors boutique, une ligne sans article lié, une ligne déjà sortie
// (travaux). `toleres` : des lignes qui portaient DÉJÀ ce prix (la proforma
// reprise, la version d'avant d'une proforma modifiée).
export function lignesSousLePrix(lignes, produits, toleres = []) {
  const parId = new Map((produits || []).map((p) => [p.id, p]));
  return (lignes || []).filter((l) => {
    if (!l || !l.produit_id || l.hors_boutique || l.deja_sorti) return false;
    const p = parId.get(l.produit_id);
    const prix = Number(p?.prix_vente || 0);
    if (!p || !(prix > 0) || Number(l.pu || 0) + 0.5 >= prix) return false;
    return !(toleres || []).some((t) => t && t.produit_id === l.produit_id && Number(t.pu || 0) <= Number(l.pu || 0) + 0.5);
  }).map((l) => ({ article: l.article || l.nom || parId.get(l.produit_id).nom || "Article", pu: Number(l.pu || 0), prix: Number(parId.get(l.produit_id).prix_vente || 0) }));
}

// La phrase du refus ("" si rien à refuser).
export function motifPrixSousLeStock(fautives) {
  if (!fautives || fautives.length === 0) return "";
  const f = fautives[0];
  const autres = fautives.length > 1 ? ` (et ${fautives.length - 1} autre${fautives.length > 2 ? "s" : ""})` : "";
  return `« ${f.article} »${autres} ne se vend pas sous son prix : ${francs(f.prix)} dans le stock, ${francs(f.pu)} saisi. Remettez le prix du stock ; pour baisser, utilisez la case Remise (réservé à l'administrateur au-delà de la limite).`;
}

// UNE question pour les écrans : ce compte peut-il valider ces lignes ?
export const refusPrixSousLeStock = (profile, lignes, produits, toleres = []) =>
  (peutVendreSousLePrix(profile) ? "" : motifPrixSousLeStock(lignesSousLePrix(lignes, produits, toleres)));
