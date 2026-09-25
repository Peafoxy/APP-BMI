// ============ 🏠 LE LOYER D'UNE BOUTIQUE (25/09/2026) ============
// Timo : « un onglet où on renseigne le loyer de chaque boutique, pour gérant
// et administrateur ? » → pas d'onglet : un cadre en haut de 📤 Dépenses (le
// gérant n'a pas ⚙ Paramètres). Ses décisions : la fiche est renseignée par
// l'ADMINISTRATEUR SEUL ; une CASE « local loué » sur la fiche de création
// d'une boutique (ou d'un magasin), qui fait apparaître montant, propriétaire,
// son numéro et le reste ; AUCUN rappel dans la tournée de 7 h.
//
// ⚠ La fiche vit sur la boutique (champ `loyer`), comme la liste des banques :
// rien à coller dans Supabase — le serveur réserve déjà toute modification
// d'une boutique à l'administrateur (boutiques_regles_roles).
// ⚠ L'application ne connaît du loyer PAYÉ que les dépenses « Loyer » : c'est
// elles qu'on lit, on n'écrit aucun « payé » à la main. Une dépense rejetée
// par le DG ne paie rien ; une dépense en attente est dite « en attente ».
//
// Règle pure, SANS IMPORT (lisible par Node, comme lib/banques.js).

export const CATEGORIE_LOYER = "Loyer";
export const JOUR_ECHEANCE_DEFAUT = 5;

// La fiche d'une boutique LOUÉE, sinon null (non louée, ou jamais renseignée).
export const ficheLoyer = (boutique) => (boutique?.loyer?.loue ? boutique.loyer : null);

const chiffres = (t) => String(t || "").replace(/\D/g, "");

// La saisie telle qu'on la range (nombres en nombres, textes nettoyés).
export function nettoyerFicheLoyer(s = {}) {
  if (!s.loue) return { loue: false };
  return {
    loue: true,
    montant: Math.round(Number(s.montant) || 0),
    jour: Math.round(Number(s.jour) || 0),
    proprietaire: String(s.proprietaire || "").trim(),
    tel: String(s.tel || "").trim(),
    debut: String(s.debut || "").slice(0, 10),
    caution: Math.round(Number(s.caution) || 0),
    note: String(s.note || "").trim(),
  };
}

// Ce qui manque ou ne tient pas — une phrase, ou null.
export function critiqueFicheLoyer(s = {}) {
  if (!s.loue) return null;
  const f = nettoyerFicheLoyer(s);
  if (!(f.montant > 0)) return "Indiquez le montant du loyer mensuel.";
  if (!f.proprietaire) return "Indiquez le nom du propriétaire.";
  if (f.tel && chiffres(f.tel).length < 8) return "Le numéro du propriétaire paraît incomplet (8 chiffres au moins).";
  if (!(f.jour >= 1 && f.jour <= 31)) return "Le jour d'échéance va du 1 au 31.";
  if (f.caution < 0) return "La caution ne peut pas être négative.";
  return null;
}

// « 2026-10 » depuis une date « 2026-10-03 ».
export const moisDe = (date) => String(date || "").slice(0, 7);

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function libelleMois(mois) {
  const [a, m] = String(mois || "").split("-").map(Number);
  if (!a || !m) return String(mois || "");
  return `${MOIS_FR[m - 1]} ${a}`;
}

// La date d'échéance du mois : le jour réglé, ramené au dernier jour du mois
// s'il n'existe pas (le 31 en février tombe le 28 ou le 29).
export function echeanceDuMois(fiche, mois) {
  const [a, m] = String(mois).split("-").map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const j = Math.min(Math.max(1, Number(fiche?.jour) || JOUR_ECHEANCE_DEFAUT), dernier);
  return `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// Les dépenses de loyer de CETTE boutique pour CE mois. Une dépense payée par
// la caisse d'une AUTRE boutique porte `loyer_boutique` : c'est le local loué
// qui compte, pas la caisse qui a payé. Une ancienne dépense « Loyer » saisie
// à la main compte pour le mois de sa date.
export const loyersDuMois = (depenses, boutique, mois) =>
  (depenses || []).filter((d) =>
    d.categorie === CATEGORIE_LOYER
    && (d.loyer_boutique || d.boutique) === boutique
    && (d.loyer_mois || moisDe(d.date)) === mois
    && d?.validation?.statut !== "rejetee");

const joursEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// L'état du loyer du mois en cours : payé, en attente du DG, à payer, en retard.
export function etatLoyer({ fiche, depenses, boutique, aujourdhui }) {
  if (!fiche) return null;
  const mois = moisDe(aujourdhui);
  const echeance = echeanceDuMois(fiche, mois);
  const lignes = loyersDuMois(depenses, boutique, mois);
  const paye = lignes.reduce((s, d) => s + (d?.validation?.statut === "attente" ? 0 : Number(d.montant) || 0), 0);
  const attente = lignes.filter((d) => d?.validation?.statut === "attente");
  const derniere = [...lignes].sort((x, y) => String(y.date).localeCompare(String(x.date)))[0] || null;
  const base = { mois, echeance, montant: Number(fiche.montant) || 0, paye, lignes, derniere };
  if (paye >= base.montant && base.montant > 0) return { ...base, statut: "paye" };
  if (attente.length) return { ...base, statut: "attente" };
  const retard = joursEntre(echeance, aujourdhui);
  if (retard > 0) return { ...base, statut: "retard", joursRetard: retard, reste: base.montant - paye };
  return { ...base, statut: "a_payer", joursAvant: -retard, reste: base.montant - paye };
}

// Refus de payer le loyer du mois une deuxième fois — une phrase, ou null.
export function critiquePaiementLoyer(etat) {
  if (!etat) return "Ce local n'est pas marqué « loué » : l'administrateur le règle dans ⚙ Paramètres → Boutiques → 🏠 Loyer.";
  if (etat.statut === "paye") return `Le loyer de ${libelleMois(etat.mois)} est déjà payé${etat.derniere ? ` (dépense du ${etat.derniere.date.split("-").reverse().join("/")})` : ""}.`;
  if (etat.statut === "attente") return `Le loyer de ${libelleMois(etat.mois)} est déjà saisi : il attend la validation du DG.`;
  return null;
}

// Ce qu'on met dans le formulaire de 📤 Dépenses quand on clique « Payer ».
export function formulaireLoyer(fiche, etat, boutique) {
  return {
    categorie: CATEGORIE_LOYER,
    montant: String(etat?.reste ?? fiche.montant),
    description: `Loyer de ${libelleMois(etat.mois)} — ${boutique}${fiche.proprietaire ? ` — ${fiche.proprietaire}` : ""}`,
    loyer_mois: etat.mois,
    loyer_boutique: boutique,
  };
}
