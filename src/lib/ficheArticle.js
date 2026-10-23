// ============================================================
// lib/ficheArticle.js — LES CASES DE LA FICHE D'UN ARTICLE : CE QUI SE DIT AU
// CLIENT, CE QUI RESTE CHEZ BMI
//
// Timo, 23/10/2026 : « La règle d'or devrait être qu'il lise les fiches
// produit tant qu'elles existent… demain si on ajoute une fiche à un produit,
// on n'aura plus besoin d'aller informer l'assistant… il récupère
// automatiquement » → « a, lance ».
//
// UN registre, et TROIS lecteurs qui le suivent sans rien savoir des cases :
//   • l'assistant WhatsApp (lib/assistantWhatsapp.js → ficheArticleAssistant,
//     CLES_FICHE_ASSISTANT) — toute case « client » remplie part ;
//   • le menu à chiffres (ficheEnClair) — la même chose, en une ligne ;
//   • la ligne grise sous le nom (lib/pompes.js → ficheLisible) : 📦 Stocks,
//     💰 Ventes, le reçu, la proforma, le devis — les cases marquées `ligne`.
//
// ⚠⚠ Une case est rangée ICI ou nulle part : le banc lit toutes les cases du
// formulaire de 📦 Stocks (création, correction, présélection) et de l'import
// Excel, et tombe si l'une d'elles n'est pas classée. Une case NOUVELLE se
// range donc une fois — « client » ou « interne » — et part toute seule vers
// l'assistant, le menu et la ligne grise. Ce qui n'est pas rangé ne part
// JAMAIS chez le client : on ne devine pas qu'une case est publique.
//
// ⚠ « interne » : jamais chez le client, jamais sur un document — prix
// d'achat, fournisseur, notes internes, code-barres, seuil, stock à atteindre,
// quantités. « à part » : dit autrement, par son propre chemin (le nom, le
// prix de vente, la tension, ce que l'assistant peut dire aux clients…).
//
// Module PUR, sans aucun import (lu par le serveur et par le banc).
// ============================================================

// destination : "client" | "interne" | "a_part"
// sorte       : "nombre" | "case" | "texte"
// pour        : "tous" | "pompe" | "convertisseur" (qui la porte — l'appelant
//               décide, ce fichier n'importe rien)
// ligne       : la case se lit sur la ligne grise sous le nom (une
//               caractéristique — jamais une garantie ni un lien)
// unite       : pour un nombre ; mot : pour une case (« hybride »)
// clair       : la phrase du menu à chiffres, si elle n'est pas « libellé : valeur »
export const CHAMPS_FICHE_ARTICLE = [
  // — ce qui se dit par son propre chemin —
  { cle: "id", libelle: "Identifiant", destination: "a_part" },
  { cle: "boutique", libelle: "Boutique", destination: "a_part" },
  { cle: "nom", libelle: "Nom", destination: "a_part" },
  { cle: "domaine", libelle: "Domaine", destination: "a_part" },
  { cle: "categorie", libelle: "Catégorie", destination: "a_part" },
  { cle: "prix_vente", libelle: "Prix de vente", destination: "a_part" },
  { cle: "note_assistant", libelle: "Ce que l'assistant dit aux clients", destination: "a_part" },
  // — ce qui ne sort jamais de BMI —
  { cle: "fournisseur", libelle: "Fournisseur", destination: "interne" },
  { cle: "initial", libelle: "Quantité initiale", destination: "interne" },
  { cle: "entrees", libelle: "Entrées", destination: "interne" },
  { cle: "seuil", libelle: "Seuil d'alerte", destination: "interne" },
  { cle: "stock_cible", libelle: "Stock à atteindre", destination: "interne" },
  { cle: "prix_achat", libelle: "Prix d'achat", destination: "interne" },
  { cle: "code", libelle: "Code-barres", destination: "interne" },
  { cle: "notes", libelle: "Notes internes", destination: "interne" },
  // — ce que le client peut lire, dans l'ordre de la ligne grise —
  { cle: "puissance_kw", libelle: "Puissance", destination: "client", sorte: "nombre", unite: "kW", pour: "tous", ligne: true },
  { cle: "profondeur_max_m", libelle: "Profondeur max", destination: "client", sorte: "nombre", unite: "m", pour: "pompe", ligne: true,
    clair: (v) => `jusqu'à ${v} m` },
  { cle: "debit_max_m3h", libelle: "Débit max", destination: "client", sorte: "nombre", unite: "m³/h", pour: "pompe", ligne: true,
    clair: (v) => `débit max ${v} m³/h (en surface)` },
  // La tension part à l'assistant par son propre chemin (`tension`, cherchée
  // en 48 V / 51,2 V) : ici elle n'est que sur la ligne grise.
  { cle: "tension", libelle: "Tension", destination: "a_part", sorte: "nombre", unite: "V", ligne: true },
  { cle: "hybride", libelle: "Hybride (solaire + secteur)", destination: "client", sorte: "case", mot: "hybride", pour: "pompe", ligne: true },
  { cle: "triphase", libelle: "Triphasé", destination: "client", sorte: "case", mot: "triphasé", pour: "convertisseur", ligne: true },
  { cle: "parallele", libelle: "Supporte la mise en parallèle", destination: "client", sorte: "case", mot: "mise en parallèle", pour: "convertisseur", ligne: true },
  { cle: "garantie_boutique", libelle: "Garantie boutique", destination: "client", sorte: "texte", pour: "tous",
    clair: (v) => `garantie : ${v}` },
  { cle: "garantie_fabricant", libelle: "Garantie fabricant", destination: "client", sorte: "texte", pour: "tous" },
  { cle: "conditions_garantie", libelle: "Conditions de garantie", destination: "client", sorte: "texte", pour: "tous" },
  { cle: "fiche_technique", libelle: "Fiche technique", destination: "client", sorte: "texte", pour: "tous" },
];

export const champFiche = (cle) => CHAMPS_FICHE_ARTICLE.find((c) => c.cle === cle) || null;
export const CHAMPS_CLIENT = CHAMPS_FICHE_ARTICLE.filter((c) => c.destination === "client");
export const CLES_CLIENT = CHAMPS_CLIENT.map((c) => c.cle);
export const CLES_INTERNES = CHAMPS_FICHE_ARTICLE.filter((c) => c.destination === "interne").map((c) => c.cle);
export const CHAMPS_LIGNE = CHAMPS_FICHE_ARTICLE.filter((c) => c.ligne);
// Une case est-elle rangée ? (le banc la pose sur chaque case du formulaire)
export const estRangee = (cle) => !!champFiche(cle);

export const TEXTE_MAX_FICHE = 300;
const nbPos = (v) => (Number(v) > 0 ? Number(v) : 0);
const joli = (v) => String(v).replace(".", ",");

// La valeur d'une case telle qu'on peut la DIRE : un nombre > 0, une case
// cochée (true), un texte non vide et borné — sinon null (rien à dire).
export function valeurDiteDe(champ, p) {
  const v = p?.[champ.cle];
  if (champ.sorte === "nombre") return nbPos(v) || null;
  if (champ.sorte === "case") return v ? true : null;
  const t = String(v ?? "").trim().slice(0, TEXTE_MAX_FICHE);
  return t || null;
}

// La ligne grise sous le nom (« 0,75 kW · 95 m · 1,5 m³/h · 220 V · hybride »).
export function ligneGrise(p) {
  if (!p) return "";
  const bouts = [];
  for (const c of CHAMPS_LIGNE) {
    const v = valeurDiteDe(c, p);
    if (v === null) continue;
    bouts.push(c.sorte === "case" ? c.mot : `${joli(v)} ${c.unite}`);
  }
  return bouts.join(" · ");
}

// Un bout de la phrase du menu à chiffres, pour une case client.
export function bouClair(champ, v) {
  const lu = champ.sorte === "nombre" ? joli(v) : v;
  if (champ.clair) return champ.clair(lu);
  if (champ.sorte === "case") return champ.mot || champ.libelle.toLowerCase();
  if (champ.sorte === "nombre") return `${lu} ${champ.unite || ""}`.trim();
  return `${champ.libelle.toLowerCase()} : ${lu}`;
}
