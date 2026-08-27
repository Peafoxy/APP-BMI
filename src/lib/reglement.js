// ============================================================
// lib/reglement.js — COMMENT LE CLIENT VA SOLDER SON INSTALLATION
//
// ⚠ DEMANDE TIMO (25/08/2026). Jusqu'ici, un client qui n'avait pas fini de
// payer ne trouvait NULLE PART dans son espace combien il lui restait ni
// quand verser. Pire, l'affichage était binaire : « en attente de votre
// paiement — passez régler 1 200 000 F » restait écrit même après un
// versement de 840 000 F. Faux, et vexant pour quelqu'un qui a payé.
//
// Sa règle : le choix se fait À LA SIGNATURE DU CONTRAT, pas à la réception
// — le client s'engage au départ. Deux possibilités, et une seule cochée :
//   • il verse la TOTALITÉ du solde à la signature du procès-verbal ;
//   • ou il verse un MONTANT FIXE chaque fin de mois, qu'il indique.
// La première échéance est choisie par le client (Timo : « flexible »).
//
// Ensuite l'ADMINISTRATEUR SEUL accepte ou rejette. S'il rejette, il dit
// pourquoi, et le client peut reproposer.
//
// Tout ce fichier est du calcul pur : aucune écriture, aucun écran. C'est
// ce qui permet au banc d'essai de le vérifier ligne à ligne.
// ============================================================

// Ce qui restera dû après l'acompte versé avant les travaux.
// ⚠ Un devis sans acompte défini est payé en totalité d'avance (c'est le
// comportement historique, `montant_acompte` absent = tout) : il n'y a alors
// pas de solde, donc aucune question à poser au client.
export const soldeApresAcompte = (devis) => {
  const total = Number(devis?.total || 0);
  const acompte = Number(devis?.montant_acompte ?? total);
  return Math.max(0, total - acompte);
};

// Le dernier jour d'un mois donné — c'est ce que veut dire « fin du mois ».
// ⚠ Le 31 n'existe pas partout : en passant du 31 janvier au mois suivant,
// une addition naïve donnerait le 2 ou le 3 mars. On demande donc le jour 0
// du mois SUIVANT, qui est toujours le dernier jour du mois voulu.
export const finDuMois = (annee, mois) => {
  const d = new Date(Date.UTC(annee, mois + 1, 0));
  return d.toISOString().slice(0, 10);
};

// La fin du mois en cours, proposée par défaut au client.
export const finDuMoisCourant = (aujourdhui = new Date()) =>
  finDuMois(aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth());

// L'échéancier complet : une ligne par versement, la dernière ajustée pour
// tomber juste. ⚠ Sans cet ajustement, un solde de 360 000 réglé par
// versements de 50 000 donnerait 8 versements de 50 000 = 400 000 : on
// réclamerait 40 000 de trop au client.
export const echeancier = (plan, solde) => {
  const reste = Math.max(0, Number(solde || 0));
  if (!plan || reste === 0) return [];
  if (plan.type !== "mensuel") {
    return [{ date: plan.premiere_echeance || null, montant: reste, dernier: true }];
  }
  const pas = Math.floor(Number(plan.montant_mensuel || 0));
  if (pas <= 0) return [];
  const depart = plan.premiere_echeance || finDuMoisCourant();
  const [a, m] = depart.split("-").map(Number);
  const lignes = [];
  let du = reste;
  // Garde-fou : au-delà de 600 versements (50 ans) c'est une saisie
  // aberrante, pas un échéancier. On s'arrête plutôt que de fabriquer une
  // liste sans fin qui figerait l'écran.
  for (let i = 0; du > 0 && i < 600; i++) {
    const montant = Math.min(pas, du);
    du -= montant;
    lignes.push({ date: finDuMois(a, m - 1 + i), montant, dernier: du === 0 });
  }
  return lignes;
};

// Ce qui ne va pas dans la proposition, en français, ou null si elle tient.
// ⚠ Ce n'est PAS un jugement commercial : accepter ou refuser reste la
// décision de l'administrateur. On n'écarte ici que ce qui est absurde ou
// impossible à exécuter.
export const critiquePlan = (plan, solde) => {
  if (!plan?.type) return "Choisissez comment vous allez régler le solde.";
  if (plan.type === "mensuel") {
    const pas = Number(plan.montant_mensuel || 0);
    if (!(pas > 0)) return "Indiquez le montant que vous verserez chaque fin de mois.";
    if (pas > Number(solde || 0)) return "Ce montant mensuel dépasse le solde restant : versez plutôt la totalité.";
    if (!plan.premiere_echeance) return "Indiquez la date du premier versement.";
    if (echeancier(plan, solde).length > 120) return "Ce montant étalerait les versements sur plus de dix ans. Augmentez-le.";
  }
  return null;
};

// La phrase que lisent le client ET l'administrateur — la MÊME des deux
// côtés, pour qu'ils jugent sur le même texte.
export const resumePlan = (plan, solde) => {
  if (!plan?.type) return "Aucun plan proposé";
  if (plan.type !== "mensuel") return "La totalité du solde à la signature du procès-verbal (ou dans les 3 jours)";
  const lignes = echeancier(plan, solde);
  if (!lignes.length) return "Plan incomplet";
  const dernier = lignes[lignes.length - 1];
  return `${Number(plan.montant_mensuel).toLocaleString("fr-FR")} F chaque fin de mois à partir du ${lignes[0].date} — ${lignes.length} versement(s), solde le ${dernier.date}`;
};

// Ce que le contrat prévoyait, pour que l'administrateur compare d'un coup
// d'œil au lieu d'aller relire l'Article 4.
export const engagementDuContrat = (devis) => {
  const pct = Number(devis?.pct_acompte ?? 100);
  return pct >= 100
    ? "Contrat : payé en totalité avant les travaux"
    : `Contrat : ${pct} % avant les travaux, le solde à la signature du procès-verbal`;
};

// La prochaine échéance non encore couverte par ce qui a déjà été versé.
// ⚠ On raisonne en CUMUL, pas versement par versement : un client qui paie
// 120 000 d'un coup couvre deux mensualités de 60 000, et sa prochaine
// échéance est la troisième — pas la deuxième.
export const prochaineEcheance = (plan, solde, dejaVerse = 0) => {
  const lignes = echeancier(plan, solde);
  let cumul = 0;
  for (const l of lignes) {
    cumul += l.montant;
    if (cumul > Number(dejaVerse || 0)) return l;
  }
  return null;
};

export const PLAN_EN_ATTENTE = "en_attente";
export const PLAN_ACCEPTE = "accepte";
export const PLAN_REJETE = "rejete";
