// ============================================================
// lib/typeClient.js — CLIENT « COMPTOIR » OU CLIENT « INSTALLATION »
//
// Timo (15/11/2026) : « peut-on séparer les 2 types de client ? client au
// comptoir qui paie article et celui issu d'un devis d'installation ? » →
// « A a » (dans 📋 Clients), « B : il apparaît dans les 2 listes avec la
// valeur de chacune », « C b et c » (les chiffres séparés, des messages
// différents).
//
// RIEN N'EST ÉCRIT : le type se LIT sur chaque vente, au moment d'afficher.
//   • INSTALLATION = une vente née d'un devis (son argent est dans la caisse
//     🏗 DÉPÔT CHANTIER, ou elle est un dépôt chantier, ou une fiche de
//     🏠 Clients installés la cite), une vente de 🛠 travaux, un achat
//     « 🏗 Chantier », le reste d'un dépôt réceptionné ; et une POSE SEULE
//     (une dette, sans vente).
//   • COMPTOIR = tout le reste.
// Un client qui a fait les deux est dans les DEUX listes, chacune avec SA
// valeur (« B »).
//
// ⚠ Ce fichier n'importe rien (lu aussi par le banc sans bundler).
// ============================================================

export const TYPE_COMPTOIR = "comptoir";
export const TYPE_INSTALLATION = "installation";
export const LIBELLE_TYPE = { [TYPE_COMPTOIR]: "🛒 Comptoir", [TYPE_INSTALLATION]: "🏗 Installation" };

// Les ventes qu'une fiche de chantier cite (devis encaissé, travaux facturés).
// Une fiche à la corbeille compte encore : la vente, elle, a bien eu lieu.
export function idsVentesDeChantier(chantiers) {
  const ids = new Set();
  (Array.isArray(chantiers) ? chantiers : []).forEach((c) => { if (c && c.vente_id) ids.add(c.vente_id); });
  return ids;
}

export function estVenteInstallation(v, idsChantier) {
  if (!v) return false;
  if (v.achat_chantier || v.reste_depot || v.depot_chantier === true || v.travaux_id) return true;
  if (Array.isArray(v.articles) && v.articles.some((l) => l && l.au_chantier)) return true;
  if (v.caisse && v.caisse !== v.boutique) return true;
  return !!(idsChantier && idsChantier.has(v.id));
}

export const typeDeVente = (v, idsChantier) => (estVenteInstallation(v, idsChantier) ? TYPE_INSTALLATION : TYPE_COMPTOIR);

// Les clients d'UN type, chacun avec la valeur de CE type, du plus gros au
// plus petit. `clients` = la liste de clientsConnus (qui porte `comptoir` et
// `installation`).
export function clientsDuType(clients, type) {
  return (Array.isArray(clients) ? clients : [])
    .filter((c) => c && c[type] && (c[type].achats > 0 || c[type].total > 0))
    .map((c) => ({ ...c, achats: c[type].achats, totalAchats: c[type].total, type }))
    .sort((a, b) => b.totalAchats - a.totalAchats);
}

// Le total d'une liste de clients pour un type.
export const totalDuType = (clients, type) =>
  (Array.isArray(clients) ? clients : []).reduce((s, c) => s + Number((c && c[type] && c[type].total) || 0), 0);
