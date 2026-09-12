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
import { nouvelleDepense, nouveauMessage, fmt, dFR, uid } from "./core";
import { CATEGORIE_REMBOURSEMENT_AVANCE, depensesComptees } from "./constants";

export { CATEGORIE_REMBOURSEMENT_AVANCE, depensesComptees };

export const SEUIL_VALIDATION_DEPENSE = 5000;

// ---- L'ORIGINE DES FONDS ----
export const PAYE_AVEC_CAISSE = "caisse";
export const PAYE_AVEC_AVANCE = "avance";
export const PAYE_AVEC_DG = "dg";
export const PAYE_AVEC = [
  [PAYE_AVEC_CAISSE, "La caisse de la boutique"],
  [PAYE_AVEC_AVANCE, "Une avance personnelle (j'ai payé de ma poche)"],
  [PAYE_AVEC_DG, "De l'argent remis par le DG"],
];
export const libellePayeAvec = (code) => (PAYE_AVEC.find(([c]) => c === (code || PAYE_AVEC_CAISSE)) || PAYE_AVEC[0])[1];
// Une dépense sans `paye_avec` (anciennes lignes, dépenses automatiques :
// salaires, commissions, CNSS, versements…) vient de la caisse de la boutique.
export const payeAvecCaisse = (d) => !d?.paye_avec || d.paye_avec === PAYE_AVEC_CAISSE;
export const estAvance = (d) => d?.paye_avec === PAYE_AVEC_AVANCE;

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
export const sortDuTiroir = (d) => d?.paiement === "Espèces" && payeAvecCaisse(d);
// …et compte-t-elle DÉJÀ dans la caisse ? Seulement validée (ou sans
// validation requise). En attente, elle ne compte nulle part.
export const compteDansLaCaisse = (d) => sortDuTiroir(d) && !estEnAttente(d);

// ---- LA SAISIE ----
export function critiqueSaisie({ montant, paye_avec, boutique }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Veuillez saisir un montant (supérieur à zéro).";
  if (!PAYE_AVEC.some(([c]) => c === paye_avec)) return "Indiquez avec quoi la dépense a été payée : la caisse de la boutique, une avance personnelle, ou de l'argent remis par le DG.";
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
    ? principauxActifs(db).map((u) => nouveauMessage(profile, { a_id: u.id, texte: `⏳ Dépense à valider : ${fmt(m)} (${categorie}${depense.description ? ` — ${depense.description}` : ""}) à ${boutique}, payée avec ${libellePayeAvec(paye_avec).toLowerCase()}, par ${profile.nom}.` }))
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
    : estAvance(dep) ? " Aucun remboursement ne vous est dû pour cette dépense." : " L'argent remis par le DG reste dû.";
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
