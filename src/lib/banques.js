// ============================================================
// lib/banques.js — LA liste des banques, et la banque d'un employé.
//
// Timo, 14/09/2026, devant la question « Moyen de paiement » tapée à la
// main : « et si ce mode était à sélectionner ? », puis « si banque,
// normalement dans la fiche de l'utilisateur, on devrait ajouter le nom de
// la banque ? » — enfin : « une liste dans paramètres ».
//
// Deux manques réglés ici :
//   • le nom de la banque se RETAPAIT à chaque versement vers BANQUE ;
//   • payer un salaire « par virement » n'écrivait nulle part VERS QUELLE
//     banque l'argent partait.
//
// La liste vit sur les boutiques (champ `banques`), comme le prix du rail :
// aucune table nouvelle, rien à coller dans Supabase. La banque d'une
// personne vit sur SA fiche (`banque`, `compte_bancaire`).
//
// Module PUR, sans aucun import : lisible par Node comme par le navigateur.
// ============================================================

export const nettoyerNomBanque = (n) => String(n ?? "").trim().replace(/\s+/g, " ");
// Deux noms qui ne diffèrent que par les accents ou la casse sont LA MÊME
// banque : « Ecobank » et « ECOBANK » ne coexistent pas dans la liste.
const cleBanque = (n) => nettoyerNomBanque(n).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export const banquesReglees = (db) => {
  const b = (db?.boutiques || []).find((x) => Array.isArray(x?.banques) && x.banques.length > 0);
  return b ? b.banques.map(nettoyerNomBanque).filter(Boolean) : [];
};
export const trierBanques = (liste) => [...(liste || [])].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
export const ajouterBanque = (liste, nom) => {
  const n = nettoyerNomBanque(nom);
  if (!n) return { refus: "Entrez le nom de la banque." };
  if ((liste || []).some((x) => cleBanque(x) === cleBanque(n))) return { refus: `« ${n} » est déjà dans la liste.` };
  return { liste: trierBanques([...(liste || []), n]) };
};
export const retirerBanque = (liste, nom) => (liste || []).filter((x) => cleBanque(x) !== cleBanque(nom));

// ---- La banque d'une personne ----
export const estVirement = (moyen) => /virement/i.test(String(moyen ?? ""));
export const banqueDe = (u) => nettoyerNomBanque(u?.banque);
export const compteDe = (u) => String(u?.compte_bancaire ?? "").trim();
// Un numéro de compte ne s'affiche jamais en entier à l'écran : les quatre
// derniers chiffres suffisent à reconnaître le bon compte.
export const compteMasque = (c) => { const t = String(c ?? "").trim(); return t.length > 4 ? `…${t.slice(-4)}` : t; };
export const libelleBanque = (u) => {
  const b = banqueDe(u);
  if (!b) return "";
  const c = compteMasque(compteDe(u));
  return c ? `${b}, compte ${c}` : b;
};
// Ce qu'un paiement PAR VIREMENT garde de la fiche : la banque et le compte
// du jour du paiement. La fiche peut changer plus tard, la trace reste juste.
//
// ⚠⚠ LE NUMÉRO EST MASQUÉ ICI (18/09/2026, trouvé en répondant à Timo sur les
// données des employés). Cette fonction recopiait le numéro EN ENTIER sur la
// dépense — et la table des dépenses descend sur tous les appareils (son
// filtre par personne est côté application, jamais côté serveur). Fermer la
// fiche employé sans fermer ça n'aurait servi à rien : le numéro aurait
// continué de fuir par l'autre porte.
// Les quatre derniers chiffres suffisent à reconnaître le bon compte — c'est
// déjà ce que l'écran affiche —, et **rien ne lisait le numéro entier sur une
// dépense** : ni écran, ni export, ni document.
export const mentionVirement = (u, moyen) =>
  (estVirement(moyen) && banqueDe(u) ? { banque: banqueDe(u), compte_bancaire: compteMasque(compteDe(u)) } : {});
export const ficheParId = (users, id) => (users || []).find((u) => u?.id === id) || null;
