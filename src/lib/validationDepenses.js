// ============================================================
// lib/validationDepenses.js — LA VALIDATION DES DÉPENSES PAR LE DG,
// L'ORIGINE DES FONDS, LES AVANCES DE FRAIS À REMBOURSER
//
// Demande Timo (12/09/2026) : « ce n'est pas mieux de mettre en place un
// système de validation des dépenses par l'administrateur ? ». Décisions,
// mot pour mot :
//   • « on met un seuil : à partir de 5 mil, il faut valider ; moins de
//     5 mil, pas besoin de valider » — SEUIL_VALIDATION_DEPENSE ;
//   • « seules les dépenses validées comptent » — une dépense en attente ne
//     compte NULLE PART (tiroir, fonds à verser, tableau de bord, journal,
//     « Ce mois ») tant que le DG n'a pas dit oui ;
//   • « la clôture impossible s'il y a des dépenses liées à la caisse qui
//     ne sont pas validées » — depensesBloquantCloture / motifBlocageCloture ;
//   • l'origine des fonds (« tout utilisateur qui peut enregistrer une
//     dépense ») : « les trois propositions sont bonnes » — la caisse de la
//     boutique, une avance personnelle, de l'argent remis par le DG ;
//   • une avance personnelle est une CHARGE de la boutique mais ne sort pas
//     du tiroir ; elle devient une somme à rembourser à l'employé, réglée en
//     espèces depuis la caisse (gérant, admin), avec le salaire (une prime
//     de remboursement, hors CNSS), ou par le DG lui-même (admin).
//
// Qui valide : le DG = l'ADMINISTRATEUR PRINCIPAL (comme les versements),
// sur la boutique regardée. Une dépense que le DG saisit lui-même est validée
// d'office. Le rejet : motif obligatoire, montant ramené à 0 (le montant
// d'origine reste dans `validation.montant`) — comme un versement rejeté,
// « tout ce qui additionne les dépenses l'ignore sans exception à écrire » ;
// si l'argent était sorti du tiroir, le manque apparaît à la clôture, et
// l'auteur reçoit un message qui lui dit de le remettre.
//
// UNE règle, pure (le banc l'exerce). Serveur : securite-15.
// ============================================================
import { nouvelleDepense, nouveauMessage, fmt, dFR, uid } from "./core.js";
import { CATEGORIE_REMBOURSEMENT_AVANCE, depensesComptees, CATEGORIES, CATEGORIES_HORS_CHARGES, MOYENS_ENCAISSEMENT, libelleCaisse } from "./constants.js";

export { CATEGORIE_REMBOURSEMENT_AVANCE, depensesComptees };

export const SEUIL_VALIDATION_DEPENSE = 5000;

// ---- L'ORIGINE DES FONDS ----
export const PAYE_AVEC_CAISSE = "caisse";
export const PAYE_AVEC_AVANCE = "avance";
export const PAYE_AVEC_DG = "dg";
// Timo (13/09/2026) : « dans Payé avec, ajouter aussi : caisse du comptable » —
// l'argent de BMI qui est chez le comptable (les versements qu'il a encaissés).
// Une charge de la boutique, une SORTIE de la caisse « Chez le comptable »,
// qui compte quand le comptable la pointe « Remis » (comme ses autres
// sorties). Jamais proposé à un compte de formation (« Chez le comptable »
// est réel et n'a pas de jumelle).
export const PAYE_AVEC_COMPTABLE = "comptable";
// ⚠ Timo (15/09/2026) : « dans Payé avec, ajouter fonds de caisse, de sorte
// que si pas d'argent et il faut effectuer une dépense, fonds de caisse
// apparaît (gérant) ». Le 14/09, Timo avait dit « laisse » à cette idée — mais
// à l'époque le fonds était DANS le tiroir : « la caisse de la boutique »
// suffisait. Depuis la réponse B (15/09), le fonds est une ENVELOPPE à part :
// l'option a désormais un sens, et elle est la seule façon de dire « j'ai
// ouvert l'enveloppe ».
export const PAYE_AVEC_FONDS = "fonds";
// Le fonds de caisse est la réserve de BMI : le gérant et l'admin y touchent.
// « En réalité les règles qu'on met en place, c'est pour le gérant… ici c'est
// le gérant aussi qui vend. »
export const ROLES_FONDS_CAISSE = ["gerant", "admin"];
export const PAYE_AVEC = [
  [PAYE_AVEC_CAISSE, "La caisse de la boutique"],
  [PAYE_AVEC_AVANCE, "Une avance personnelle (j'ai payé de ma poche)"],
  // Timo (09/10/2026) : « pourquoi on ne dit pas caisse du DG ? » — le nom
  // datait d'avant la caisse 👤 DG (12/09) ; c'est elle qui paie, puis
  // l'apport automatique de l'exploitant pour ce qu'elle ne couvre pas.
  [PAYE_AVEC_DG, "La caisse du DG"],
  [PAYE_AVEC_COMPTABLE, "La caisse du comptable"],
  [PAYE_AVEC_FONDS, "Le fonds de caisse (l'enveloppe)"],
];
export const libellePayeAvec = (code) => (PAYE_AVEC.find(([c]) => c === (code || PAYE_AVEC_CAISSE)) || PAYE_AVEC[0])[1];
// Dans une phrase : seule la PREMIÈRE lettre passe en minuscule (« la caisse
// du DG », jamais « la caisse du dg »).
export const libellePayeAvecDansPhrase = (code) => { const l = libellePayeAvec(code); return l.charAt(0).toLowerCase() + l.slice(1); };
// Capture Timo (13/09/2026) : « préciser les boutiques… il peut recevoir dans
// une boutique et valider pour une boutique… ajouter nommément les boutiques
// disponibles lors du choix… même si le haut est BMI DEMAKPOE, il a la
// possibilité de choisir BMI APESSITO comme boutique qui a sorti l'argent ».
// Les choix de « Payé avec » nomment donc chaque caisse ; la dépense est
// alors enregistrée sur la boutique dont la caisse a payé (c'est son tiroir
// qui a bougé, c'est sa clôture et ses fonds à verser qui doivent le voir).
export const codeCaisse = (nomBoutique) => `caisse:${nomBoutique}`;
// `fonds` : { possible, reste } — l'enveloppe de la boutique regardée et si
// le tiroir ne suffit pas pour ce montant. L'option « Le fonds de caisse »
// n'apparaît QUE dans ce cas, et seulement pour un rôle qui y a droit
// (Timo : « si pas d'argent et il faut effectuer une dépense, fonds de caisse
// apparaît »). Elle n'est jamais proposée « au cas où ».
export const optionsPayeAvec = (nomsBoutiques, boutiqueRegardee, { avecComptable = false, fonds = null, seulementPoche = false } = {}) => {
  // 💼 Un technicien (et tout rôle hors ROLES_REMISE_ARGENT) : sa poche seule.
  if (seulementPoche) return [[PAYE_AVEC_AVANCE, "Une avance personnelle (j'ai payé de ma poche)"]];
  const noms = [...(nomsBoutiques || [])];
  const ordonnes = boutiqueRegardee && noms.includes(boutiqueRegardee) ? [boutiqueRegardee, ...noms.filter((n) => n !== boutiqueRegardee)] : noms;
  return [
    ...ordonnes.map((n) => [codeCaisse(n), `La caisse de ${libelleCaisse(n)}`]),
    ...(fonds?.possible ? [[PAYE_AVEC_FONDS, `Le fonds de caisse (l'enveloppe${boutiqueRegardee ? ` de ${boutiqueRegardee}` : ""})`]] : []),
    [PAYE_AVEC_AVANCE, "Une avance personnelle (j'ai payé de ma poche)"],
    [PAYE_AVEC_DG, libellePayeAvec(PAYE_AVEC_DG)],
    ...(avecComptable ? [[PAYE_AVEC_COMPTABLE, "La caisse du comptable"]] : []),
  ];
};
// Le fonds de caisse est-il proposable pour cette dépense ? Il faut le rôle,
// une enveloppe qui existe, un montant, que le TIROIR NE SUFFISE PAS, et que
// l'enveloppe, elle, puisse payer le reste.
export function fondsProposable({ role, tiroir, enveloppe, montant }) {
  const m = Math.round(Number(montant) || 0);
  const t = Math.round(Number(tiroir) || 0);
  const e = Math.round(Number(enveloppe) || 0);
  if (!ROLES_FONDS_CAISSE.includes(role)) return { possible: false, motif: "role", reste: e };
  if (e <= 0) return { possible: false, motif: "vide", reste: e };
  if (!Number.isFinite(m) || m <= 0) return { possible: false, motif: "montant", reste: e };
  if (m <= t) return { possible: false, motif: "tiroir", reste: e };
  if (m > t + e) return { possible: false, motif: "trop", reste: e };
  return { possible: true, reste: e, manqueAuTiroir: m - Math.max(0, t) };
}
// Le choix de l'écran → l'origine des fonds ET la boutique de la dépense.
export const interpreterPayeAvec = (valeur, boutiqueRegardee) => {
  const v = String(valeur || "");
  if (v.startsWith("caisse:")) return { paye_avec: PAYE_AVEC_CAISSE, boutique: v.slice(7) };
  if (v === PAYE_AVEC_AVANCE || v === PAYE_AVEC_DG || v === PAYE_AVEC_COMPTABLE || v === PAYE_AVEC_FONDS) return { paye_avec: v, boutique: boutiqueRegardee };
  return { paye_avec: PAYE_AVEC_CAISSE, boutique: boutiqueRegardee };
};
export const libelleChoixPayeAvec = (valeur, boutiqueRegardee) => {
  const c = interpreterPayeAvec(valeur, boutiqueRegardee);
  return c.paye_avec === PAYE_AVEC_CAISSE ? `la caisse de ${c.boutique}` : libellePayeAvecDansPhrase(c.paye_avec);
};
// Une dépense sans `paye_avec` (anciennes lignes, dépenses automatiques :
// salaires, commissions, CNSS, versements…) vient de la caisse de la boutique.
export const payeAvecCaisse = (d) => !d?.paye_avec || d.paye_avec === PAYE_AVEC_CAISSE;
// Une dépense de boutique payée avec la caisse du comptable : elle attend
// son pointage « Remis » dans le panneau « Chez le comptable ».
export const payeeParLeComptable = (d) => d?.paye_avec === PAYE_AVEC_COMPTABLE;
export const estAvance = (d) => d?.paye_avec === PAYE_AVEC_AVANCE;
// Payée avec l'ENVELOPPE : elle sort du fonds de caisse, jamais du tiroir.
export const payeeAvecLeFonds = (d) => d?.paye_avec === PAYE_AVEC_FONDS;

// ---- L'ÉTAT DE VALIDATION ----
export const doitEtreValidee = (montant) => Number(montant) >= SEUIL_VALIDATION_DEPENSE;
export const estEnAttente = (d) => d?.validation?.statut === "attente";
export const estValidee = (d) => d?.validation?.statut === "validee";
export const estRejetee = (d) => d?.validation?.statut === "rejetee";
// Le montant tel qu'il a été saisi (une dépense rejetée est ramenée à 0).
export const montantOrigine = (d) => (estRejetee(d) ? Number(d.validation.montant || 0) : Number(d?.montant || 0));

// Cette dépense sort-elle (ou sortira-t-elle) du tiroir ? Espèces, payée
// avec la caisse de la boutique. Une avance personnelle ou l'argent du DG
// ne touchent jamais le tiroir.
// ⚠ Timo (15/09/2026), mot pour mot : « 20 000 dans la caisse alors que la
// dépense doit être 30 000 : la dépense prend les 20 000 de la caisse et on
// passe avec 10 000 de fonds de caisse. Maintenant, pour des dépenses où il
// n'y a même pas la caisse, c'est le fonds de caisse qui est dans l'enveloppe
// qui sera utilisé. » DEUX cas, UNE règle : le tiroir paie ce qu'il peut,
// l'enveloppe complète.
// Une dépense payée « avec le fonds » sort donc de l'argent de la boutique
// comme une autre : LE TIROIR PAIE CE QU'IL PEUT, l'enveloppe complète le
// reste (c'est la marche des deux poches, lib/versements.js, qui fait le
// partage — UNE seule règle d'affectation). Le choix « Le fonds de caisse »
// dit que le gérant SAIT qu'il va entamer l'enveloppe ; il ne change pas le
// partage, il le rend voulu et visible.
export const sortDuTiroir = (d) => d?.paiement === "Espèces" && (payeAvecCaisse(d) || payeeAvecLeFonds(d));
// …et compte-t-elle DÉJÀ dans la caisse ? Seulement validée (ou sans
// validation requise). En attente, elle ne compte nulle part.
export const compteDansLaCaisse = (d) => sortDuTiroir(d) && !estEnAttente(d);

// ---- LA SAISIE ----
export function critiqueSaisie({ montant, paye_avec, boutique }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Veuillez saisir un montant (supérieur à zéro).";
  if (!PAYE_AVEC.some(([c]) => c === paye_avec)) return "Indiquez avec quoi la dépense a été payée : la caisse de la boutique, le fonds de caisse, une avance personnelle, la caisse du DG, ou la caisse du comptable.";
  if (!boutique) return "Aucune boutique n'est choisie.";
  return "";
}

const principauxActifs = (db) => (db.users || []).filter((u) => u.role === "admin" && u.admin_principal === true && u.actif !== false);
const estPrincipal = (db, profile) => principauxActifs(db).some((u) => u.id === profile?.id);
const auteurDe = (db, dep) => (db.users || []).find((u) => (dep.par_id && u.id === dep.par_id) || (!dep.par_id && u.nom === dep.par)) || null;

// La dépense telle que l'écran 📤 Dépenses l'enregistre : avec son origine
// des fonds, son auteur, et son état de validation. Renvoie { refus } ou
// { depense, messages, journal, aValider }.
export function construireDepenseSaisie(db, profile, { boutique, categorie, description, montant, paiement, paye_avec }, aujourdhui) {
  const refus = critiqueSaisie({ montant, paye_avec, boutique });
  if (refus) return { refus };
  // 💼 Timo (10/10/2026) : revérifié ici, dans le geste — pas seulement dans la liste.
  if (payeDeSaPocheSeulement(profile) && paye_avec !== PAYE_AVEC_AVANCE) return { refus: MOTIF_DE_SA_POCHE };
  // Timo (30/09/2026) : une dépense se paie — « Crédit (dette) » n'en est
  // jamais le moyen. Revérifié ici, dans le geste, pas seulement dans la liste.
  if (paiement !== undefined && !MOYENS_ENCAISSEMENT.includes(paiement)) return { refus: "Une dépense se saisit le jour où l'argent sort : choisissez comment elle a été payée (espèces, Mobile Money ou virement), jamais « Crédit (dette) »." };
  const m = Number(montant);
  const aValider = doitEtreValidee(m);
  const validation = !aValider ? null
    : estPrincipal(db, profile) ? { statut: "validee", le: aujourdhui, auto: true, par: profile.nom }
    : { statut: "attente" };
  const depense = nouvelleDepense(profile, {
    boutique, categorie, description: String(description || "").trim(), montant: m, moyen: paiement,
    paye_avec, par_id: profile.id ?? null,
    ...(validation ? { validation } : {}),
  });
  const messages = validation?.statut === "attente"
    ? principauxActifs(db).map((u) => nouveauMessage(profile, { a_id: u.id, texte: `⏳ Dépense à valider : ${fmt(m)} (${categorie}${depense.description ? ` — ${depense.description}` : ""}) à ${boutique}, payée avec ${libellePayeAvecDansPhrase(paye_avec)}, par ${profile.nom}.` }))
    : [];
  return {
    depense, messages, aValider,
    journal: `Dépense ${fmt(m)} (${categorie}) — ${boutique}${paye_avec !== PAYE_AVEC_CAISSE ? ` · ${libellePayeAvec(paye_avec)}` : ""}${validation?.statut === "attente" ? " · à valider par le DG" : ""}`,
  };
}

// ---- LA FILE DU DG ----
const parDateDesc = (a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`);
const parDateAsc = (a, b) => -parDateDesc(a, b);

export const depensesAValider = (db, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estEnAttente(d) && nomsBoutiques.includes(d.boutique)).sort(parDateAsc);
// Déjà tranchées (validées à la main, ou rejetées), de la plus récente à la plus ancienne.
export const depensesTraitees = (db, nomsBoutiques) => (db.depenses || [])
  .filter((d) => ((estValidee(d) && !d.validation.auto) || estRejetee(d)) && nomsBoutiques.includes(d.boutique))
  .sort((a, b) => `${b.validation.le} ${b.date}`.localeCompare(`${a.validation.le} ${a.date}`));
// Le compte des dépenses en attente, boutique par boutique (pour dire au DG
// où il en reste, sans mélanger les boutiques à l'écran).
export const nbAValiderParBoutique = (db, nomsBoutiques) => nomsBoutiques
  .map((b) => ({ boutique: b, n: (db.depenses || []).filter((d) => estEnAttente(d) && d.boutique === b).length }))
  .filter((x) => x.n > 0);

// "" si le DG peut trancher CETTE dépense, sinon le motif du refus.
export function critiqueDecision(dep, { estPrincipal: principal }, motif) {
  if (!dep?.validation) return "Cette dépense n'a pas besoin de validation.";
  if (estValidee(dep)) return "Cette dépense est déjà validée.";
  if (estRejetee(dep)) return "Cette dépense est déjà rejetée.";
  if (!principal) return "Seul le DG (administrateur principal) valide ou rejette une dépense.";
  if (motif !== undefined && !String(motif || "").trim()) return "Indiquez pourquoi cette dépense est rejetée.";
  return "";
}

export function validerDepense(db, profile, dep, aujourdhui) {
  const validation = { statut: "validee", le: aujourdhui, par: profile.nom };
  const depenses = (db.depenses || []).map((x) => (x.id === dep.id ? { ...x, validation } : x));
  const auteur = auteurDe(db, dep);
  const suite = estAvance(dep) ? " Cette avance vous sera remboursée." : "";
  const messages = auteur && auteur.id !== profile.id
    ? [nouveauMessage(profile, { a_id: auteur.id, texte: `✅ Dépense validée par ${profile.nom} : ${fmt(dep.montant)} (${dep.categorie}${dep.description ? ` — ${dep.description}` : ""}) à ${dep.boutique}.${suite}` })]
    : [];
  return { depenses, messages, journal: `Dépense VALIDÉE par le DG : ${fmt(dep.montant)} (${dep.categorie}) — ${dep.boutique}, saisie par ${dep.par}` };
}

// Le rejet : le montant passe à 0 (le montant d'origine reste dans la
// validation), la description le dit, l'auteur est prévenu — et sait quoi
// faire de l'argent selon d'où il venait.
export function rejeterDepense(db, profile, dep, motif, aujourdhui) {
  const m = String(motif || "").trim();
  const validation = { statut: "rejetee", le: aujourdhui, par: profile.nom, motif: m, montant: Number(dep.montant || 0) };
  const depenses = (db.depenses || []).map((x) => (x.id === dep.id
    ? { ...x, montant: 0, validation, description: `✖ REJETÉE (${m}) — ${x.description || x.categorie || ""}`.trim() }
    : x));
  const auteur = auteurDe(db, dep);
  const suite = sortDuTiroir(dep)
    ? ` L'argent est considéré comme toujours dû à la caisse de ${dep.boutique} : remettez ${fmt(dep.montant)} dans le tiroir.`
    : estAvance(dep) ? " Aucun remboursement ne vous est dû pour cette dépense." : " L'argent pris dans la caisse du DG reste dû.";
  const messages = auteur && auteur.id !== profile.id
    ? [nouveauMessage(profile, { a_id: auteur.id, texte: `✖ Dépense REJETÉE par ${profile.nom} : ${fmt(dep.montant)} (${dep.categorie}${dep.description ? ` — ${dep.description}` : ""}) à ${dep.boutique}. Motif : ${m}.${suite}` })]
    : [];
  return { depenses, messages, journal: `Dépense REJETÉE par le DG : ${fmt(dep.montant)} (${dep.categorie}) — ${dep.boutique}, saisie par ${dep.par} — ${m}` };
}

// ---- LA CLÔTURE ----
// « La clôture impossible s'il y a des dépenses liées à la caisse qui ne sont
// pas validées » : les dépenses en attente qui sortiront du tiroir de CETTE
// boutique, jusqu'au jour clôturé inclus (une dépense d'avant-hier encore en
// attente fausserait aussi le fonds d'hier soir).
export const depensesBloquantCloture = (db, boutique, date) => (db.depenses || [])
  .filter((d) => d.boutique === boutique && estEnAttente(d) && sortDuTiroir(d) && String(d.date) <= String(date))
  .sort(parDateAsc);

export function motifBlocageCloture(liste, fmt = (x) => String(x), dFR = (x) => x) {
  if (!liste?.length) return "";
  const detail = liste.map((d) => `${fmt(d.montant)} (${d.categorie}${d.description ? ` — ${d.description}` : ""}, ${dFR(d.date)}, par ${d.par})`).join(" ; ");
  return `🔒 Clôture impossible : ${liste.length === 1 ? "une dépense en espèces attend" : `${liste.length} dépenses en espèces attendent`} la validation du DG : ${detail}. Tant qu'elles ne sont pas validées ou rejetées, elles ne comptent pas dans le tiroir.`;
}

// Les dépenses REJETÉES du jour qui étaient sorties du tiroir : le manque
// attendu à la clôture, et qui le doit.
export const rejetsDuJour = (db, boutique, date) => (db.depenses || [])
  .filter((d) => d.boutique === boutique && estRejetee(d) && d.paiement === "Espèces" && payeAvecCaisse(d) && String(d.date) === String(date))
  .map((d) => ({ id: d.id, par: d.par, montant: montantOrigine(d), motif: d.validation.motif, categorie: d.categorie }));

// ---- LES AVANCES DE FRAIS À REMBOURSER ----
export const MOYEN_REMB_CAISSE = "caisse";
export const MOYEN_REMB_SALAIRE = "salaire";
export const MOYEN_REMB_DG = "dg";
export const MOYENS_REMBOURSEMENT = [
  [MOYEN_REMB_CAISSE, "En espèces, depuis la caisse de la boutique"],
  [MOYEN_REMB_SALAIRE, "Avec le salaire du mois"],
  [MOYEN_REMB_DG, "Remboursée par le DG lui-même"],
];
export const libelleMoyenRemb = (code) => (MOYENS_REMBOURSEMENT.find(([c]) => c === code) || [code, code])[1];
// Depuis la caisse : le gérant et l'admin (comme un versement). Avec le
// salaire ou par le DG : l'admin seul (c'est une décision de paie).
export const ROLES_REMB_CAISSE = ["gerant", "admin"];
export const ROLES_REMB_AUTRES = ["admin"];

// Une avance est DUE dès qu'elle compte : validée, ou sous le seuil.
export const avanceDue = (d) => estAvance(d) && !estEnAttente(d) && !estRejetee(d) && !d.remboursement;
export const avancesARembourser = (db, boutique) => (db.depenses || [])
  .filter((d) => avanceDue(d) && (!boutique || d.boutique === boutique)).sort(parDateAsc);
// Toutes les avances d'une personne (en attente, dues, remboursées), pour son écran 💵 Salaire.
export const avancesDe = (db, user) => (db.depenses || [])
  .filter((d) => estAvance(d) && ((d.par_id && d.par_id === user.id) || (!d.par_id && d.par === user.nom))).sort(parDateDesc);

export function critiqueRemboursement(dep, moyen, profile, { mois } = {}) {
  if (!estAvance(dep)) return "Cette dépense n'est pas une avance personnelle.";
  if (estEnAttente(dep)) return "Cette avance attend encore la validation du DG.";
  if (estRejetee(dep)) return "Cette avance a été rejetée : rien n'est dû.";
  if (dep.remboursement) return `Cette avance a déjà été remboursée le ${dFR(dep.remboursement.le)}.`;
  if (!MOYENS_REMBOURSEMENT.some(([c]) => c === moyen)) return "Choisissez comment l'avance est remboursée.";
  const roles = moyen === MOYEN_REMB_CAISSE ? ROLES_REMB_CAISSE : ROLES_REMB_AUTRES;
  if (!roles.includes(profile?.role)) return moyen === MOYEN_REMB_CAISSE ? "Rembourser depuis la caisse : le gérant ou l'administrateur." : "Rembourser avec le salaire ou par le DG : l'administrateur.";
  if (profile.role !== "admin" && ((dep.par_id && dep.par_id === profile.id) || (!dep.par_id && dep.par === profile.nom))) return "On ne se rembourse pas soi-même : demandez à l'administrateur.";
  if (moyen === MOYEN_REMB_SALAIRE && (String(mois || "").length !== 7 || Number.isNaN(Date.parse(`${mois}-01`)))) return "Indiquez le mois de paie (AAAA-MM).";
  return "";
}

// Les écritures du remboursement. Ne vérifie pas le droit : critiqueRemboursement d'abord.
//   • caisse  : une sortie « Remboursement d'avance de frais » (pas une
//               charge, la charge est déjà comptée) sort du tiroir ce jour ;
//   • salaire : une prime de remboursement sur la paie du mois (hors CNSS) ;
//   • dg      : rien ne bouge en caisse, on le note.
export function rembourserAvance(db, profile, dep, moyen, aujourdhui, { mois } = {}) {
  const remboursement = { le: aujourdhui, par: profile.nom, moyen, ...(moyen === MOYEN_REMB_SALAIRE ? { mois } : {}) };
  const libelle = `Remboursement d'avance de frais à ${dep.par} — ${dep.description || dep.categorie} du ${dFR(dep.date)}`;
  let depenses = (db.depenses || []);
  let users = db.users || [];
  if (moyen === MOYEN_REMB_CAISSE) {
    const sortie = nouvelleDepense(profile, { boutique: dep.boutique, categorie: CATEGORIE_REMBOURSEMENT_AVANCE, description: libelle, montant: Number(dep.montant), moyen: "Espèces", paye_avec: PAYE_AVEC_CAISSE, avance_id: dep.id, auto: "avance_frais" });
    remboursement.depense_id = sortie.id;
    depenses = [sortie, ...depenses];
  }
  const auteur = auteurDe(db, dep);
  if (moyen === MOYEN_REMB_SALAIRE && !auteur) return { refus: `Le compte de ${dep.par} est introuvable : impossible de porter le remboursement sur sa paie.` };
  if (moyen === MOYEN_REMB_SALAIRE) {
    const prime = { id: uid(), mois, montant: Number(dep.montant), motif: libelle, date: aujourdhui, auto: "avance_frais", depense_id: dep.id, hors_cnss: true, par: profile.nom };
    users = users.map((u) => (u.id === auteur.id ? { ...u, primes: [...(u.primes || []), prime] } : u));
  }
  depenses = depenses.map((x) => (x.id === dep.id ? { ...x, remboursement } : x));
  const messages = auteur && auteur.id !== profile.id
    ? [nouveauMessage(profile, { a_id: auteur.id, texte: `💵 Avance remboursée : ${fmt(dep.montant)} (${dep.description || dep.categorie} du ${dFR(dep.date)}) — ${libelleMoyenRemb(moyen).toLowerCase()}${moyen === MOYEN_REMB_SALAIRE ? ` (${mois})` : ""}, par ${profile.nom}.` })]
    : [];
  return { depenses, users, messages, journal: `Avance de frais REMBOURSÉE à ${dep.par} : ${fmt(dep.montant)} — ${libelleMoyenRemb(moyen)}${moyen === MOYEN_REMB_SALAIRE ? ` (${mois})` : ""} (${dep.boutique})` };
}

// Timo (13/09/2026) : « ouvrir l'onglet Dépenses au technicien, mais ils ne
// verront que leurs propres dépenses, pas toutes les dépenses ». Les deux
// sortes de techniciens (technicien, technicien BMI). ⚠ La table des
// dépenses n'est pas cloisonnée par personne côté serveur : ce filtre de
// l'application est la seule barrière, comme pour les personnes.
export const ROLES_DEPENSES_PERSONNELLES = ["technicien", "technicien_bmi"];
export const neVoitQueSesDepenses = (profile) => ROLES_DEPENSES_PERSONNELLES.includes(profile?.role);

// 💼 QUI SORT L'ARGENT D'UNE CAISSE (Timo, 10/10/2026 : « il fait une dépense
// avec son argent ou il justifie l'argent reçu… les techniciens, les
// commerciaux et les vendeurs. Les seules personnes à remettre l'argent,
// c'est le gérant, les admin, les comptables et parfois le responsable
// commercial s'il veut payer ses commerciaux »). Un technicien voyait toutes
// les caisses dans « Payé avec » (celle de la boutique d'office) et pouvait
// « remettre » l'argent à un collègue : le tiroir baissait sans que personne
// n'y ait touché. Pour tous les autres rôles : SA POCHE seulement, et l'argent
// reçu pour un chantier se justifie (💼 Mon argent de chantier), il ne se
// ressaisit pas en dépense.
// ⚠ Le magasinier y est ajouté (Timo, 10/10/2026 : « laisse le magasinier payer
// avec la caisse ») : il n'a pas 📤 Dépenses, ça ne vaut que pour la réparation
// d'un outil (🧰 Outillage).
export const ROLES_REMISE_ARGENT = ["admin", "gerant", "comptable", "resp_commercial", "magasinier"];
export const payeDeSaPocheSeulement = (profile) => !ROLES_REMISE_ARGENT.includes(profile?.role);
export const MOTIF_DE_SA_POCHE = "Vous ne pouvez saisir qu'une dépense payée de VOTRE poche (« Une avance personnelle ») : elle vous sera remboursée une fois qu'elle compte.\n\nSortir l'argent d'une caisse ou le remettre à quelqu'un, c'est le geste du gérant ou de l'administrateur.\n\nSi vous avez REÇU de l'argent pour un chantier, détaillez-le dans « 💼 Mon argent de chantier » : ce n'est pas une nouvelle dépense.";
export const estMaDepense = (d, profile) => (!!d?.par_id && d.par_id === profile?.id) || (!d?.par_id && !!d?.par && d.par === profile?.nom);
export const depensesVisibles = (liste, profile) => (neVoitQueSesDepenses(profile) ? (liste || []).filter((d) => estMaDepense(d, profile)) : (liste || []));

// ============ ✏️ MODIFIER UNE DÉPENSE (Timo, 25/09/2026) ============
// « donner la possibilité de modifier une dépense » → décisions : la CATÉGORIE
// et la DESCRIPTION seulement, par l'administrateur PRINCIPAL seul. Le montant,
// le moyen et « Payé avec » NE se modifient PAS : ils portent de l'argent (le
// tiroir, une clôture déjà faite, la validation du DG). Un montant faux se
// supprime et se ressaisit. Les lignes qui ont leur propre circuit ne se
// modifient pas ici : versements, fonds de caisse, apports / prélèvements du
// DG, remboursements, dépenses rejetées ou créées automatiquement.
export function motifNonModifiable(d) {
  if (!d) return "Dépense introuvable.";
  if (CATEGORIES_HORS_CHARGES.includes(d.categorie) || d.versement || d.versement_id || d.fonds_caisse || d.exploitant) return `« ${d.categorie} » n'est pas une dépense ordinaire : elle ne se modifie pas ici.`;
  if (d.auto) return "Cette dépense a été créée automatiquement par un autre geste : elle ne se modifie pas ici.";
  if (estRejetee(d)) return "Une dépense rejetée par le DG ne se modifie plus.";
  return null;
}
export const depenseModifiable = (d) => !motifNonModifiable(d);
export function critiqueModifDepense(d, { categorie, description, chantier, remisA } = {}) {
  const motif = motifNonModifiable(d);
  if (motif) return motif;
  if (!CATEGORIES.includes(categorie)) return "Choisissez une catégorie de la liste.";
  if (categorie === d.categorie && String(description || "").trim() === String(d.description || "").trim() && !changeDeChantier(d, chantier) && !changeDeRemis(d, remisA)) return "Rien n'a changé.";
  return null;
}
// 💼 À qui l'argent a été remis (Timo, 07/10/2026 : « à qui l'argent a été
// remis ? on peut aussi modifier »). `remisA` : undefined = on n'y touche pas ;
// null = personne (payé directement) ; { id, nom } = ce technicien. Les refus
// (le technicien d'avant a déjà justifié ou rendu) vivent dans
// lib/argentChantier.js, revérifiés dans le geste.
export const changeDeRemis = (d, remisA) => remisA !== undefined && String(remisA?.id || "") !== String(d?.remis_a?.id || "");
// 🏠 Le chantier rattaché se change aussi (Timo, 07/10/2026 : « on peut
// modifier que pour les dépenses dont les chantiers ne sont pas
// réceptionnés »). `chantier` : undefined = on n'y touche pas ; null = plus
// aucun chantier ; { id, nom } = ce chantier. Les refus (chantier réceptionné,
// soldé, frais payés — l'ancien comme le nouveau) vivent dans
// lib/depensesChantier.js (critiqueChangementChantier), revérifiés dans le geste.
export const changeDeChantier = (d, chantier) => chantier !== undefined && String(chantier?.id || "") !== String(d?.chantier_id || "");
// La dépense corrigée et la phrase du journal (qui dit ce qui a changé).
export function modifierDepense(d, { categorie, description, chantier, remisA }, par, le) {
  const desc = String(description || "").trim();
  const changes = [];
  if (categorie !== d.categorie) changes.push(`catégorie : ${d.categorie} → ${categorie}`);
  if (desc !== String(d.description || "").trim()) changes.push(`description : « ${d.description || "—"} » → « ${desc || "—"} »`);
  let base = d;
  if (changeDeChantier(d, chantier)) {
    changes.push(`chantier : ${d.chantier_nom || "aucun"} → ${chantier?.nom || "aucun"}`);
    const { chantier_id, chantier_nom, ...reste } = d;
    base = chantier ? { ...reste, chantier_id: chantier.id, chantier_nom: chantier.nom } : reste;
  }
  // Sans chantier, plus personne à qui l'argent aurait été remis pour lui.
  const remis = base.chantier_id ? remisA : (d.remis_a ? null : undefined);
  if (changeDeRemis(d, remis)) {
    changes.push(`remis à : ${d.remis_a?.nom || "personne"} → ${remis?.nom || "personne"}`);
    const { remis_a, ...reste } = base;
    base = remis ? { ...reste, remis_a: { id: remis.id, nom: remis.nom } } : reste;
  }
  return {
    depense: { ...base, categorie, description: desc, modifie_le: le, modifie_par: par },
    journal: `Dépense du ${dFR(d.date)} (${fmt(d.montant)}, ${d.boutique}) modifiée — ${changes.join(" · ")}`,
  };
}

// 💵 CE QU'UN SALAIRE A VRAIMENT SORTI DE LA CAISSE (Timo, 03/10/2026 : « dans
// Dépense, normalement c'est 35 000 qui devrait apparaître ») — la ligne garde
// le salaire entier (la charge réelle), la retenue de crédit se lit à côté.
// Le salaire la porte (`retenue_credit`) depuis 2.101.416 ; avant, on la
// retrouve : même employé, même jour, même caisse, auto « retenue ».
export function retenueDuSalaire(liste, d) {
  if (!d || d.auto !== "virement") return 0;
  if (Number(d.retenue_credit) > 0) return Number(d.retenue_credit);
  const r = (liste || []).filter((x) => x.auto === "retenue" && x.user_id === d.user_id && x.date === d.date && x.boutique === d.boutique)
    .reduce((t, x) => t - Number(x.montant || 0), 0);
  return r > 0 ? r : 0;
}
