// ============================================================
// lib/primeChantier.js — La PRIME DE CHANTIER d'un employé (gérant,
// vendeur, magasinier…) qui a géré un chantier (Timo, 07/10/2026 :
// « lorsqu'on clique sur Prime, la fenêtre prime sur salaire et prime sur
// chantier apparaît… on choisit le chantier en question, le montant et on
// valide… cette prime est débitée du pourcentage de BMI lors du partage
// des frais d'installation » ; puis « 1b, 2a, 3 : tous les chantiers dont
// le partage a déjà été validé et qui font moins de 3 mois… si déjà
// proposé et payé, ces chantiers n'apparaissent plus »).
//
// ⚠ La prime est UNE LIGNE DE L'ÉQUIPE du chantier (`prime_employe: true`,
// pourcentage 0) : elle se paie donc EXACTEMENT comme la part d'un
// technicien (📤 Demander le paiement → ✓ Valider et payer dans 💰 Primes
// remises), elle se lit dans 💵 Ma commission de l'employé, et le serveur
// la garde déjà (montants de l'équipe = administrateur, securite-6).
// ⚠ Elle n'est PAS prise sur les techniciens : seulement sur ce qui reste
// à BMI après leurs parts (« 2a » : au-delà, refusé).
// Aucun import : règles pures, l'écran passe les listes déjà filtrées.
// ============================================================

export const MOIS_PRIME_CHANTIER = 3;

export const estPrimeChantier = (e) => !!(e && e.prime_employe);

// Ce que BMI garde encore sur les frais à partager, une fois payées (ou
// prévues) les parts des techniciens et les primes déjà posées.
export function partBmiRestante(c) {
  const base = Number(c?.frais_a_partager ?? c?.frais_installation ?? 0) || 0;
  const reparti = (c?.equipe || []).reduce((s, e) => s + (Number(e?.montant) || 0), 0);
  return Math.max(0, Math.round(base - reparti));
}

// Le jour qui ouvre la fenêtre des 3 mois (le partage validé ce jour-là ou
// après est encore proposé).
export function limitePrimeChantier(aujourdhui) {
  const [a, m, j] = String(aujourdhui || "").slice(0, 10).split("-").map(Number);
  if (!a || !m || !j) return "";
  const d = new Date(Date.UTC(a, m - 1 - MOIS_PRIME_CHANTIER, 1));
  const dernier = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(j, dernier));
  return d.toISOString().slice(0, 10);
}

// Pourquoi ce chantier n'est PAS proposé à cet employé — null s'il l'est.
// `boutiqueDe(c)` dit la boutique du chantier (l'écran passe la règle commune).
export function motifChantierNonProposable(c, employe, boutiqueDe, aujourdhui) {
  if (!c || !employe) return "Chantier ou employé introuvable.";
  if (c.travaux) return "Des travaux à crédit n'ont pas de partage de frais.";
  if (!c.date_repartition) return "Le partage des frais de ce chantier n'a pas encore été validé.";
  if (!employe.boutique || boutiqueDe(c) !== employe.boutique) return "Ce chantier n'est pas lié à la boutique de l'employé.";
  if (String(c.date_repartition).slice(0, 10) < limitePrimeChantier(aujourdhui)) return `Le partage de ce chantier date de plus de ${MOIS_PRIME_CHANTIER} mois.`;
  if ((c.equipe || []).some((e) => e.user_id === employe.id && estPrimeChantier(e))) return "Une prime a déjà été posée pour cet employé sur ce chantier.";
  if (partBmiRestante(c) <= 0) return "La part de BMI sur ce chantier est déjà entièrement distribuée.";
  return null;
}

// Les chantiers proposés (les plus récents d'abord).
export function chantiersPourPrime(chantiers, employe, boutiqueDe, aujourdhui) {
  return (chantiers || [])
    .filter((c) => motifChantierNonProposable(c, employe, boutiqueDe, aujourdhui) === null)
    .sort((x, y) => String(y.date_repartition).localeCompare(String(x.date_repartition)));
}

// Revérifié DANS le geste, sur la fiche fraîche du chantier.
export function critiquePrimeChantier(c, employe, montant, boutiqueDe, aujourdhui) {
  const motif = motifChantierNonProposable(c, employe, boutiqueDe, aujourdhui);
  if (motif) return motif;
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0 || Math.round(m) !== m) return "Montant invalide : un nombre entier de francs, plus grand que zéro.";
  const reste = partBmiRestante(c);
  if (m > reste) return `La part de BMI qui reste sur ce chantier est de ${reste.toLocaleString("fr-FR")} F : la prime ne peut pas la dépasser.`;
  return null;
}

// Le pourcentage que BMI garde réellement, recalculé sur les montants.
export function pctBmiReel(c) {
  const base = Number(c?.frais_a_partager ?? c?.frais_installation ?? 0) || 0;
  if (base <= 0) return 0;
  return Math.round((partBmiRestante(c) / base) * 1000) / 10;
}

// Le chantier avec la prime posée dans son équipe.
export function ajouterPrimeChantier(c, employe, montant, par, aujourdhui) {
  const ligne = {
    user_id: employe.id, nom: employe.nom, pct: 0, montant: Number(montant),
    chef: false, paye: false, prime_employe: true, prime_le: aujourdhui, prime_par: par,
  };
  const apres = { ...c, equipe: [...(c.equipe || []), ligne] };
  return { ...apres, part_bmi: pctBmiReel(apres) };
}

// Les primes de chantier d'un chantier (pour les garder quand on refait le partage).
export const primesDuChantier = (c) => (c?.equipe || []).filter(estPrimeChantier);
export const totalPrimesChantier = (c) => primesDuChantier(c).reduce((s, e) => s + (Number(e.montant) || 0), 0);
