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
