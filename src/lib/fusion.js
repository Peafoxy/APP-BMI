// ============================================================
// lib/fusion.js — Réconcilier deux modifications faites en même temps,
// sur deux appareils, sans en sacrifier une.
//
// ⚠ LES DÉFAUTS QUE CE FICHIER CORRIGE (audit du 20/08/2026, points 6 et 7)
//
// POINT 6 — Deux appareils encaissent hors ligne sur la MÊME dette :
// l'un 5 000, l'autre 3 000. À la synchronisation, chacun envoyait
// l'enregistrement ENTIER. Le dernier arrivé écrasait l'autre : un
// versement — et l'argent qu'il représente — disparaissait sans trace.
//
// POINT 7 — Pour éviter d'écraser, la synchronisation comparait l'heure de
// l'appareil à celle du serveur. Sur un téléphone dont la montre retarde,
// une modification pourtant plus récente paraissait plus ancienne : l'envoi
// était abandonné et l'opération retirée de la file. Le travail était perdu.
// Une marge de dix minutes existait déjà à la LECTURE (voir MARGE_HORLOGE_MS
// dans sync.js), mais elle n'avait jamais été appliquée à l'ENVOI.
//
// LE PRINCIPE RETENU — on ne compare plus deux horloges du tout.
//
// Au moment où l'on modifie un enregistrement, on garde la version qu'il
// avait alors (sa « base »). À l'envoi, on demande au serveur la version
// qu'il détient :
//   • c'est toujours la même → personne n'a rien touché, on envoie ;
//   • elle a changé → quelqu'un est passé entre-temps. Ce n'est plus une
//     question d'heure mais de fait, et on FUSIONNE au lieu de choisir un
//     gagnant.
//
// La fusion se fait à trois : la base commune, notre version, la leur. On
// sait donc distinguer « ce que NOUS avons ajouté » de « ce qu'ILS ont
// ajouté », et garder les deux.
// ============================================================

// Ce qui se fusionne, table par table. Tout ce qui n'est pas listé ici garde
// le comportement simple : notre version l'emporte sur les champs ordinaires.
//
//   listes    : tableaux d'objets porteurs d'un `id` — on prend l'union.
//   additifs  : nombres qui ne font que monter (un cumul d'argent). On
//               additionne les DEUX apports depuis la base, au lieu de
//               retenir un seul des deux totaux.
export const STRATEGIES = {
  dettes: { listes: ["paiements"], additifs: ["paye"] },
  paie: { listes: ["virements", "credits"] },
  users: { listes: ["virements", "credits", "devis"] },
  // ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026) : cette ligne disait
  // `listes: ["demande_prime"]`. Or `demande_prime` n'est pas une liste et
  // n'existe pas à ce niveau — c'est un booléen posé sur chaque membre de
  // `equipe`. unirParId recevait donc `undefined` des deux côtés et ne
  // produisait rien : la stratégie ne protégeait RIEN.
  //
  // Ce que ça coûtait : l'administrateur paie la part du technicien A pendant
  // que le vendeur paie celle du technicien B, sur le MÊME chantier. Le
  // tableau `equipe` entier était remplacé par celui du dernier arrivé. Le
  // « payé » de l'autre disparaissait — alors que sa dépense, elle, avait bien
  // été créée. La part réapparaissait comme DUE, et primeDejaPayee ne la
  // voyait plus : elle pouvait être payée une seconde fois.
  clients_installes: { equipes: ["equipe"] },
};

const tableau = (v) => (Array.isArray(v) ? v : []);

// Union de deux listes d'objets identifiés, en gardant l'ordre : d'abord ce
// que porte notre version, puis ce que l'autre a ajouté et que nous n'avons
// pas. Une entrée présente des deux côtés garde NOTRE version (nous sommes
// celui qui écrit ; s'il l'a modifiée, sa modification suivra dans sa propre
// synchronisation).
export const unirParId = (local, distant) => {
  const sortie = [...tableau(local)];
  const connus = new Set(sortie.map((x) => x?.id).filter(Boolean));
  for (const x of tableau(distant)) {
    if (!x?.id || !connus.has(x.id)) sortie.push(x);
  }
  return sortie;
};

// base    : l'enregistrement tel qu'il était quand NOUS l'avons modifié
// local   : notre version
// distant : celle que porte le serveur maintenant
// ⚠ L'ÉQUIPE D'UN CHANTIER — fusion membre par membre.
//
// unirParId ne convient pas ici : les membres portent `user_id`, pas `id`, et
// surtout un membre présent des DEUX côtés ne doit pas être « celui du
// gagnant » mais celui qui porte le PAIEMENT. Un paiement enregistré ne se
// perd jamais : c'est de l'argent réellement sorti de la caisse.
export const unirEquipe = (local, distant) => {
  const a = tableau(local), b = tableau(distant);
  if (!b.length) return a;
  const parId = new Map();
  const ordre = [];
  const poser = (m) => {
    const cle = m?.user_id;
    if (!cle) return;
    const dejaLa = parId.get(cle);
    if (!dejaLa) { parId.set(cle, m); ordre.push(cle); return; }
    // Le membre existe des deux côtés : celui qui est PAYÉ l'emporte.
    // Si aucun ne l'est, on garde celui qui porte une demande de paiement en
    // cours — sinon la demande du vendeur s'évaporerait de son écran.
    if (m.paye && !dejaLa.paye) parId.set(cle, m);
    else if (!dejaLa.paye && !m.paye && m.demande_prime && !dejaLa.demande_prime) parId.set(cle, m);
  };
  a.forEach(poser);
  b.forEach(poser);
  return ordre.map((cle) => parId.get(cle));
};

// Les champs ORDINAIRES (tout ce qui n'est pas une liste, une équipe ou un
// cumul) : notre version l'emporte — SAUF si nous n'y avons pas touché.
//
// ⚠ Vague 3, étape 3 (05/09/2026). Depuis que le serveur compare l'ancienne
// et la nouvelle valeur de chaque champ sensible (prix d'un article, taux
// d'un employé, mot de passe, rattachement…), renvoyer une vieille copie
// d'un champ qu'on n'a PAS modifié devient un vrai problème : un commercial
// qui assigne une tâche à un membre de son équipe renverrait aussi le taux
// de commission tel qu'il l'avait en main — et si l'administrateur venait
// de le changer, le serveur verrait le commercial « changer un taux » et
// refuserait la tâche. Quand on connaît la base commune, on sait ce que NOUS
// avons changé : pour tout le reste, c'est la version du serveur qui reste.
const memeValeur = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

export function fusionner(table, base, local, distant) {
  const strategie = STRATEGIES[table] || {};
  // Pas de version distante : rien à fusionner.
  if (!distant) return local;

  const sortie = { ...local };

  if (base && typeof base === "object") {
    const speciaux = new Set([...(strategie.listes || []), ...(strategie.equipes || []), ...(strategie.additifs || [])]);
    for (const champ of new Set([...Object.keys(base), ...Object.keys(distant)])) {
      if (speciaux.has(champ) || champ === "id") continue;
      // Nous n'avons pas touché ce champ, mais eux si : leur valeur reste.
      if (memeValeur(local?.[champ], base[champ]) && !memeValeur(distant[champ], base[champ])) {
        if (distant[champ] === undefined) delete sortie[champ]; else sortie[champ] = distant[champ];
      }
    }
  }

  for (const champ of strategie.listes || []) {
    const uni = unirParId(local?.[champ], distant?.[champ]);
    // On n'écrit le champ que s'il existait quelque part : inventer un
    // tableau vide sur un enregistrement qui n'en avait pas ferait passer
    // une ligne inchangée pour une modification.
    if (uni.length > 0 || local?.[champ] !== undefined || distant?.[champ] !== undefined) {
      sortie[champ] = uni;
    }
  }

  for (const champ of strategie.equipes || []) {
    const uni = unirEquipe(local?.[champ], distant?.[champ]);
    if (uni.length > 0 || local?.[champ] !== undefined || distant?.[champ] !== undefined) {
      sortie[champ] = uni;
    }
  }

  for (const champ of strategie.additifs || []) {
    // Chacun a fait monter le compteur depuis la base commune : on garde
    // LES DEUX apports. C'est ce qui sauve le versement qui disparaissait.
    const depart = Number(base?.[champ] || 0);
    const notre = Number(local?.[champ] || 0) - depart;
    const leur = Number(distant?.[champ] || 0) - depart;
    let total = depart + notre + leur;
    if (!Number.isFinite(total) || total < 0) total = Math.max(Number(local?.[champ] || 0), Number(distant?.[champ] || 0));
    // Garde-fou : un cumul d'encaissements ne dépasse jamais le dû, sinon la
    // fiche afficherait un « reste à payer » négatif.
    const plafond = Number(sortie.montant);
    if (Number.isFinite(plafond) && plafond > 0) total = Math.min(total, plafond);
    sortie[champ] = total;
  }

  return sortie;
}
