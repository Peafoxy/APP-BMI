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
  clients_installes: { listes: ["demande_prime"] },
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
export function fusionner(table, base, local, distant) {
  const strategie = STRATEGIES[table];
  // Aucune règle pour cette table : notre version l'emporte, comme avant.
  if (!strategie || !distant) return local;

  const sortie = { ...local };

  for (const champ of strategie.listes || []) {
    const uni = unirParId(local?.[champ], distant?.[champ]);
    // On n'écrit le champ que s'il existait quelque part : inventer un
    // tableau vide sur un enregistrement qui n'en avait pas ferait passer
    // une ligne inchangée pour une modification.
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
