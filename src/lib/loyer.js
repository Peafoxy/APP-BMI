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
    // 📅 Le dernier mois payé AVANT l'application (Timo, 25/09/2026 : « pour
    // mieux suivre les arriérés »). Les loyers d'avant ne sont pas dans les
    // dépenses : c'est lui qui dit où on en est. Ensuite ça avance tout seul.
    dernier_mois_paye: String(s.dernier_mois_paye || "").slice(0, 7),
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
  // Le format du mois est garanti par le calendrier du champ (type « month »).
  return null;
}

// « 2026-10 » depuis une date « 2026-10-03 ».
export const moisDe = (date) => String(date || "").slice(0, 7);
// Le mois k mois plus loin (k peut être négatif).
export function moisPlus(mois, k) {
  const [a, m] = String(mois).split("-").map(Number);
  const t = a * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

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

// Les mois qu'une dépense de loyer paie : sa liste (paiement de plusieurs mois
// ou d'avance), son mois, sinon — ancienne dépense saisie à la main — le mois
// de sa date.
export const moisDeLaDepense = (d) => (Array.isArray(d.loyer_mois) ? d.loyer_mois : [d.loyer_mois || moisDe(d.date)]);

// Les dépenses de loyer de CETTE boutique (le LOCAL, pas la caisse qui a payé :
// `loyer_boutique`), qui touchent CE mois. Une dépense rejetée ne compte pas.
const depensesDuLocal = (depenses, boutique) =>
  (depenses || []).filter((d) =>
    d.categorie === CATEGORIE_LOYER
    && (d.loyer_boutique || d.boutique) === boutique
    && d?.validation?.statut !== "rejetee");
export const loyersDuMois = (depenses, boutique, mois) =>
  depensesDuLocal(depenses, boutique).filter((d) => moisDeLaDepense(d).includes(mois));

// Ce qui a été versé pour chaque mois : une dépense de plusieurs mois remplit
// ses mois DANS L'ORDRE, chacun jusqu'au montant du loyer.
function repartition(fiche, depenses, boutique) {
  const paye = {}, attente = {};
  const plafond = Number(fiche.montant) || 0;
  for (const d of depensesDuLocal(depenses, boutique)) {
    const cible = d?.validation?.statut === "attente" ? attente : paye;
    const liste = moisDeLaDepense(d);
    let reste = Number(d.montant) || 0;
    liste.forEach((m, i) => {
      const deja = (paye[m] || 0) + (attente[m] || 0);
      const part = i === liste.length - 1 ? reste : Math.max(0, Math.min(reste, plafond - deja));
      cible[m] = (cible[m] || 0) + part;
      reste -= part;
    });
  }
  return { paye, attente };
}

const joursEntre = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const MAX_MOIS = 120;

// L'état du loyer : dernier mois payé, mois dus (arriérés), payé d'avance.
export function etatLoyer({ fiche, depenses, boutique, aujourdhui }) {
  if (!fiche) return null;
  const mois = moisDe(aujourdhui);
  const montant = Number(fiche.montant) || 0;
  const { paye, attente } = repartition(fiche, depenses, boutique);
  const declare = fiche.dernier_mois_paye || "";
  // D'où l'on compte : le mois après le dernier payé déclaré, sinon le début
  // du bail, sinon le mois en cours (rien n'est réclamé pour avant).
  const depart = declare ? moisPlus(declare, 1) : (fiche.debut ? moisDe(fiche.debut) : mois);
  const estPaye = (m) => montant > 0 && (paye[m] || 0) >= montant;
  let dernier = moisPlus(depart, -1);
  for (let k = 0; k < MAX_MOIS && estPaye(moisPlus(dernier, 1)); k++) dernier = moisPlus(dernier, 1);
  const dernierPaye = declare || estPaye(dernier) ? dernier : "";
  // Les mois dus jusqu'au mois en cours, du plus ancien au plus récent.
  const dus = [];
  for (let m = depart, k = 0; m <= mois && k < MAX_MOIS; m = moisPlus(m, 1), k++) {
    if (estPaye(m)) continue;
    const reste = montant - (paye[m] || 0);
    const echeance = echeanceDuMois(fiche, m);
    dus.push({ mois: m, reste, echeance, enRetard: aujourdhui > echeance, attente: (attente[m] || 0) >= reste });
  }
  const aRegler = dus.filter((x) => !x.attente);
  const retards = aRegler.filter((x) => x.enRetard);
  const lignes = depensesDuLocal(depenses, boutique).filter((d) => moisDeLaDepense(d).some((m) => m === mois || dus.some((x) => x.mois === m)));
  const derniere = [...loyersDuMois(depenses, boutique, mois)].sort((x, y) => String(y.date).localeCompare(String(x.date)))[0] || null;
  const base = {
    mois, echeance: echeanceDuMois(fiche, mois), montant, paye: paye[mois] || 0, lignes, derniere,
    dernierPaye, dus, reste: aRegler.reduce((s, x) => s + x.reste, 0),
    avance: dernierPaye && dernierPaye > mois ? dernierPaye : "",
    // Les mois À VENIR déjà payés ou déjà saisis (en attente du DG) : on ne
    // les propose plus, on ne les laisse pas payer deux fois.
    futursPris: [...new Set([...Object.keys(paye), ...Object.keys(attente)])].filter((m) => m > mois && (estPaye(m) || (attente[m] || 0) > 0)).sort(),
  };
  if (!dus.length) return { ...base, statut: "paye" };
  if (!aRegler.length) return { ...base, statut: "attente" };
  if (retards.length) return { ...base, statut: "retard", joursRetard: joursEntre(retards[0].echeance, aujourdhui), moisEnRetard: retards.length };
  return { ...base, statut: "a_payer", joursAvant: -joursEntre(base.echeance, aujourdhui) };
}

// Les n prochains mois à payer, du plus ancien dû vers l'avance : les mois dus
// d'abord (pas ceux qui attendent le DG), puis les mois à venir.
export function moisAPayer(etat, n = 1) {
  if (!etat) return [];
  const liste = etat.dus.filter((x) => !x.attente).map((x) => ({ mois: x.mois, reste: x.reste }));
  let suivant = moisPlus(etat.dus.length ? etat.dus[etat.dus.length - 1].mois : (etat.avance || etat.mois), 1);
  const pris = new Set([...etat.dus.map((x) => x.mois), ...(etat.futursPris || [])]);
  while (liste.length < n) {
    if (!pris.has(suivant)) liste.push({ mois: suivant, reste: etat.montant });
    suivant = moisPlus(suivant, 1);
  }
  return liste.slice(0, Math.max(0, n));
}

// Refus de payer un mois déjà payé ou déjà saisi — une phrase, ou null.
export function critiquePaiementLoyer(etat, mois) {
  if (!etat) return "Ce local n'est pas marqué « loué » : l'administrateur le règle dans ⚙ Paramètres → Boutiques → 🏠 Loyer.";
  const liste = mois ? [].concat(mois) : [etat.mois];
  if (!liste.length) return "Aucun mois à payer.";
  for (const m of liste) {
    const du = etat.dus.find((x) => x.mois === m);
    if (du?.attente) return `Le loyer de ${libelleMois(m)} est déjà saisi : il attend la validation du DG.`;
    if (!du && (etat.futursPris || []).includes(m)) return `Le loyer de ${libelleMois(m)} est déjà payé ou déjà saisi.`;
    const dejaPaye = !du && (m <= etat.mois || (etat.dernierPaye && m <= etat.dernierPaye));
    if (dejaPaye) return `Le loyer de ${libelleMois(m)} est déjà payé${etat.derniere && m === etat.mois ? ` (dépense du ${etat.derniere.date.split("-").reverse().join("/")})` : ""}.`;
  }
  return null;
}

// Les mots d'une suite de mois : « août 2026 » ou « d'août à octobre 2026 ».
export function libellePeriodeLoyer(liste, { avecNombre = true } = {}) {
  if (!liste.length) return "";
  if (liste.length === 1) return libelleMois(liste[0]);
  return `${libelleMois(liste[0])} à ${libelleMois(liste[liste.length - 1])}${avecNombre ? ` (${liste.length} mois)` : ""}`;
}

// Ce qu'on met dans le formulaire de 📤 Dépenses quand on clique « Payer » :
// n mois, les plus anciens d'abord. UNE dépense pour un versement au
// propriétaire, même s'il couvre plusieurs mois.
export function formulaireLoyer(fiche, etat, boutique, n = 1) {
  const liste = moisAPayer(etat, n);
  const mois = liste.map((x) => x.mois);
  return {
    categorie: CATEGORIE_LOYER,
    montant: String(liste.reduce((s, x) => s + x.reste, 0)),
    description: `Loyer de ${libellePeriodeLoyer(mois)} — ${boutique}${fiche.proprietaire ? ` — ${fiche.proprietaire}` : ""}`,
    loyer_mois: mois.length === 1 ? mois[0] : mois,
    loyer_boutique: boutique,
  };
}
