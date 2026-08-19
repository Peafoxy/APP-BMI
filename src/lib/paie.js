// ============================================================
// lib/paie.js — La fiche de PAIE, séparée de la fiche employé.
//
// POURQUOI CE FICHIER EXISTE
//
// Tout ce qui concerne un compte tenait dans UNE seule fiche, et cette
// fiche est lisible très largement : par tous les appareils connectés, et
// même — tant que la lecture publique n'est pas refermée — par quiconque
// possède la clé publique du site. Salaires, virements, crédits accordés,
// avances, primes, numéro de pièce d'identité et matricule CNSS s'y
// trouvaient donc exposés (constat de l'audit du 19/08/2026).
//
// Dans cette base, toute la fiche est rangée dans UNE seule colonne
// (`data`, au format JSON). Il est donc impossible de dire au serveur
// « montre le nom mais cache le salaire » : c'est tout ou rien. La SEULE
// façon de protéger ces champs est de les DÉPLACER dans une autre table,
// à laquelle le serveur applique ses propres règles.
//
// COMMENT ÇA MARCHE, SANS RIEN CASSER
//
// Les écrans (Salaires, Utilisateurs, impression, CNSS…) continuent
// d'écrire `u.salaire_base` ou `u.virements` comme avant. Rien à changer
// chez eux. La bascule se fait aux deux seuls points de passage de toute
// l'application :
//
//   • au CHARGEMENT (chargerTout) : les fiches de paie que l'appareil a le
//     droit de recevoir sont recollées sur les fiches employés.
//   • à l'ÉCRITURE (sauvegarderDiff) : elles en sont redétachées avant
//     d'être rangées, chacune dans sa table.
//
// Un appareil qui n'a pas le droit de voir une fiche de paie ne la reçoit
// tout simplement pas : les champs valent `undefined`, et les `|| []` déjà
// présents partout dans le code font le reste. Rien ne plante, rien ne
// s'affiche.
// ============================================================

// Les champs qui QUITTENT la fiche employé.
//
// ⚠ Volontairement ABSENTS de cette liste : `taux_commission` et
// `taux_equipe`. Ils servent aux calculs de commission dans une demi-
// douzaine d'écrans (Ventes, Commandes, Mon équipe, Ma commission,
// Tableau de bord), pour soi-même comme pour son équipe — les déplacer
// demanderait de revoir tous ces calculs. Ils sont aussi bien moins
// sensibles qu'un salaire. À traiter séparément si Timo le souhaite.
//
// ⚠ Également absent : `nom_complet`. C'est un nom, pas un secret, et il
// s'affiche dans Mon équipe, Clients installés et Ma commission.
export const CHAMPS_PAIE = [
  // Rémunération
  "salaire_base", "taux_avancement", "evolutions_salaire", "primes", "avances",
  // Mouvements d'argent
  "virements", "credits",
  // Pièces administratives et déclaratif CNSS
  "piece_type", "piece_num",
  "cnss_assujetti", "cnss_matricule", "cnss_numero_assurance", "cnss_mensuel",
  "cnss_code_type", "cnss_date_embauche", "cnss_date_sortie", "cnss_code_motif_sortie",
];

const estChampPaie = (cle) => CHAMPS_PAIE.includes(cle);

// ---- CHARGEMENT : recoller les fiches de paie reçues sur les fiches employés.
export const fusionnerPaie = (users, paie) => {
  if (!paie || paie.length === 0) return users || [];
  const parId = new Map(paie.map((p) => [p.id, p]));
  return (users || []).map((u) => {
    const p = parId.get(u.id);
    if (!p) return u;
    const champs = {};
    for (const c of CHAMPS_PAIE) if (p[c] !== undefined) champs[c] = p[c];
    return Object.keys(champs).length ? { ...u, ...champs } : u;
  });
};

// ---- ÉCRITURE : redétacher, mais UNIQUEMENT ce que cet appareil a le droit
// d'écrire.
//
// ⚠ C'est le point délicat. Un appareil de vendeur ne reçoit pas les fiches
// de paie des autres : s'il redétachait quand même leurs champs, il
// fabriquerait des fiches de paie VIDES et les enverrait au serveur — qui
// les refuserait, laissant une opération bloquée dans la file (exactement
// le piège rencontré avec les boutiques de formation). On ne détache donc
// que sa PROPRE fiche, et toutes les autres seulement si l'on est
// administrateur.
//
// `ecrivain` : { id, admin }. Par défaut personne — les champs restent
// alors dans la fiche employé, c'est-à-dire le comportement d'avant : sûr.
export const separerPaie = (users, ecrivain = {}) => {
  const autorise = (u) => (ecrivain.id && u.id === ecrivain.id) || ecrivain.admin === true;
  const fiches = [];
  const employes = (users || []).map((u) => {
    if (!autorise(u)) return u;
    const paie = { id: u.id };
    const employe = {};
    let aQuelqueChose = false;
    for (const [cle, valeur] of Object.entries(u)) {
      if (estChampPaie(cle)) {
        if (valeur !== undefined) { paie[cle] = valeur; aQuelqueChose = true; }
      } else {
        employe[cle] = valeur;
      }
    }
    if (aQuelqueChose) fiches.push(paie);
    return employe;
  });
  return { users: employes, paie: fiches };
};
