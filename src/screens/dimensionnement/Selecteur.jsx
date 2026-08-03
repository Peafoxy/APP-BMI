// ============================================================
// screens/dimensionnement/Selecteur.jsx — Sélection avec verrou : le meilleur choix calculé reste suivi tant
// que l'utilisateur n'a pas choisi manuellement (verrou), utilisé
// par les volets Garage et Autre.
// ============================================================
import { useState } from "react";
import { uAlert } from "../../components/ui";
import { toucher } from "../../lib/calculs";

// ============ ÉLÉMENTS PARTAGÉS ENTRE LES 3 OUTILS DE DIMENSIONNEMENT ============
// Solaire, Garage et Autre suivent tous la même mécanique de fond (besoins du
// client → équipements → remise/installation/transport → devis → envoi/vente).
// Cette section factorise les morceaux identiques pour n'avoir à les corriger
// qu'UNE fois — c'est le verrou anti-écrasement (voir useSelectionAvecVerrou)
// qui avait le bug corrigé en v2.77.1, dupliqué à l'époque dans 2 outils.

// ---- Verrou anti-écrasement : une fois qu'un article est choisi/saisi à la
// main pour un rôle/besoin donné, la recherche automatique ne doit plus jamais
// y toucher tant que le vendeur n'a pas explicitement demandé à y revenir.
// Générique pour Garage et Autre (rôles fixes ou besoins dynamiques, sans
// dépendance entre deux lignes). Le Solaire garde sa propre version : le choix
// du convertisseur y détermine si un régulateur est nécessaire, une dépendance
// entre deux rôles que cette version générique ne gère pas.
export function useSelectionAvecVerrou(meilleurChoix, initial) {
  const [choix, setChoix] = useState(() => initial?.choix || {});
  const [manuelOuvert, setManuelOuvert] = useState({});
  const [brouillonManuel, setBrouillonManuel] = useState({});
  const [verrous, setVerrous] = useState(() => initial?.verrous || {});

  const recalculerNonVerrouilles = (items) => {
    setChoix((avant) => {
      const nouveau = { ...avant };
      for (const item of items) {
        if (verrous[item.id]) continue;
        const c = meilleurChoix(item);
        if (c) nouveau[item.id] = c; else delete nouveau[item.id];
      }
      return nouveau;
    });
  };

  const changerProduit = (itemId, produitId, calculerQte) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // choix explicite : plus jamais recalculé tout seul
    if (!produitId) { setChoix((avant) => { const n = { ...avant }; delete n[itemId]; return n; }); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "stock", produit_id: produitId, qte: calculerQte(produitId) } }));
  };

  const changerQte = (itemId, qte) => setChoix((avant) => ({ ...avant, [itemId]: { ...avant[itemId], qte: Math.max(1, Number(qte) || 1) } }));

  const ouvrirManuel = (itemId, brouillonParDefaut) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // dès l'ouverture : plus de recalcul automatique
    setManuelOuvert((v) => ({ ...v, [itemId]: true }));
    setBrouillonManuel((v) => ({ ...v, [itemId]: v[itemId] || brouillonParDefaut }));
  };
  const validerManuel = (itemId) => {
    const b = brouillonManuel[itemId];
    if (!b || !b.nom.trim() || !b.prix) { uAlert("Indiquez au moins le nom et le prix de l'article."); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "manuel", nom: b.nom.trim(), prix: Number(b.prix), qte: Math.max(1, Number(b.qte) || 1) } }));
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
  };
  // Repasse cet item en sélection/recherche automatique (relâche le verrou et relance meilleurChoix)
  const annulerManuel = (itemId, item) => {
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
    setVerrous((v) => { const n = { ...v }; delete n[itemId]; return n; });
    const c = item ? meilleurChoix(item) : null;
    setChoix((avant) => { const n = { ...avant }; if (c) n[itemId] = c; else delete n[itemId]; return n; });
  };

  return { choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous, setVerrous, recalculerNonVerrouilles, changerProduit, changerQte, ouvrirManuel, validerManuel, annulerManuel };
}
