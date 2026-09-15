// ============================================================
// lib/versements.js — LE VERSEMENT DES FONDS PAR LES BOUTIQUES
//
// Demande Timo (09/09/2026) : « le versement des fonds par les vendeurs et
// gérants ». Décisions, mot pour mot :
//   • destinations : « Chez le DG », « BANQUE », « Chez le comptable » ;
//   • BANQUE : le nom de la banque et le numéro de bordereau sont saisis ;
//   • validation : BANQUE et Chez le DG → le DG, c'est-à-dire
//     l'ADMINISTRATEUR PRINCIPAL ; Chez le comptable → le comptable, avec
//     son pointage « ✅ Encaissé » habituel ;
//   • le gérant (et l'admin) versent — pas le vendeur (décision du même
//     jour) ; versement libre (pas imposé à la clôture).
//
// UNE règle, pure (le banc l'exerce) : un versement est une DÉPENSE de la
// boutique (catégorie « Versement de fonds », espèces) qui porte le détail
// dans `versement` ; pour « Chez le comptable », une ENTRÉE miroir (montant
// négatif, convention déjà en place) est posée dans la caisse du comptable,
// liée par `versement_id` — c'est elle que le comptable pointe.
// ============================================================
import { nouvelleDepense, nouveauMessage, uid, fmt, dFR } from "./core.js";
import { CATEGORIE_VERSEMENT, CATEGORIE_FONDS_CAISSE, horsVersements } from "./constants.js";
import { compteDansLaCaisse } from "./validationDepenses.js";

// La catégorie vit dans constants.js (lue aussi par le journal comptable) :
// importée ET réexportée — jamais `export { x } from` seul (piège connu).
export { CATEGORIE_VERSEMENT, CATEGORIE_FONDS_CAISSE, horsVersements };
export const DEST_DG = "Chez le DG";
export const DEST_BANQUE = "BANQUE";
export const DEST_COMPTABLE = "Chez le comptable";
export const DESTINATIONS_VERSEMENT = [DEST_DG, DEST_BANQUE, DEST_COMPTABLE];
// ⚠ Timo (09/09/2026) : « on va restreindre le versement au vendeur pour le
// moment… c'est au gérant de faire le versement ». Serveur : securite-11.
export const ROLES_VERSEMENT = ["gerant", "admin"];
// La caisse « Chez le comptable » est RÉELLE et n'a pas de jumelle : un
// compte de formation ne la voit jamais (règle du mur formation / réel).
export const destinationsPour = (enFormation) => (enFormation ? DESTINATIONS_VERSEMENT.filter((d) => d !== DEST_COMPTABLE) : DESTINATIONS_VERSEMENT);

// Le versement est-il bien formé ? Renvoie le motif du refus, ou "".
// ⚠ Timo (09/09/2026, deuxième idée) : plus de « recette du … au … ». À la
// place, l'application ATTEND un montant (fondsAVerser) ; si le montant
// versé est différent, une justification est obligatoire.
export const montantDifferent = (montant, attendu) => Math.round(Number(montant) || 0) !== Math.round(Number(attendu) || 0);
export const messageJustification = (attendu) => `Justifiez pourquoi le montant n'est pas ${fmt(Math.round(Number(attendu) || 0))}`;

export function critiqueVersement({ montant, destination, banque, bordereau, attendu, note }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Indiquez le montant versé (supérieur à zéro).";
  if (!DESTINATIONS_VERSEMENT.includes(destination)) return "Choisissez la destination : Chez le DG, BANQUE ou Chez le comptable.";
  if (destination === DEST_BANQUE) {
    if (!String(banque || "").trim()) return "Indiquez le nom de la banque.";
    if (!String(bordereau || "").trim()) return "Indiquez le numéro du bordereau de versement.";
  }
  if (attendu !== undefined && attendu !== null && montantDifferent(m, attendu) && !String(note || "").trim()) return messageJustification(attendu);
  return "";
}

// « Versement du 09/09/2026 » — chez le DG et le comptable, jamais un intervalle.
export const libelleVersementDu = (dep) => `Versement du ${dFR(dep?.date)}`;
// L'écart entre versé et attendu, lisible : « attendu 200 000 F, écart − 50 000 F ».
export const libelleEcart = (v) => (v && v.attendu !== undefined && v.attendu !== null && montantDifferent(v.montant, v.attendu)
  ? `attendu ${fmt(Math.round(Number(v.attendu)))}, écart ${Number(v.montant) - Number(v.attendu) >= 0 ? "+" : "−"} ${fmt(Math.abs(Math.round(Number(v.montant) - Number(v.attendu))))}`
  : "");

// Libellé lisible de la destination, avec la banque et le bordereau.
export const libelleDestination = (v) => (v?.destination === DEST_BANQUE
  ? `BANQUE ${String(v.banque || "").trim()}${v.bordereau ? ` — bordereau ${String(v.bordereau).trim()}` : ""}`
  : (v?.destination || ""));

// Construit les écritures : { sortie, entree } — `entree` vaut null sauf
// pour « Chez le comptable ». Les deux portent le même `versement.id`.
export function construireVersement(profile, { boutique, montant, destination, banque = "", bordereau = "", note = "", attendu = null }) {
  const refus = critiqueVersement({ montant, destination, banque, bordereau, attendu, note });
  if (refus) return { refus };
  const id = uid();
  const versement = {
    id, destination,
    banque: destination === DEST_BANQUE ? String(banque).trim() : "",
    bordereau: destination === DEST_BANQUE ? String(bordereau).trim() : "",
    montant: Number(montant),
    attendu: attendu === null || attendu === undefined ? null : Math.round(Number(attendu)),
    note: String(note || "").trim(),
  };
  const complement = [libelleEcart(versement), versement.note].filter(Boolean).join(" : ");
  const description = `Versement de fonds → ${libelleDestination(versement)}${complement ? ` (${complement})` : ""}`;
  // `par_id` : pour retrouver l'auteur si le versement est rejeté (message).
  const sortie = nouvelleDepense(profile, { boutique, categorie: CATEGORIE_VERSEMENT, description, montant: Number(montant), moyen: "Espèces", versement, par_id: profile.id ?? null });
  const entree = destination === DEST_COMPTABLE
    // Chez le comptable : « Versement du <date> reçu de … », l'écart et la
    // justification suivent — jamais un intervalle (Timo, 09/09/2026).
    ? nouvelleDepense(profile, { boutique: DEST_COMPTABLE, categorie: CATEGORIE_VERSEMENT, description: `Versement du ${dFR(new Date().toISOString().slice(0, 10))} reçu de ${boutique} (par ${profile.nom})${complement ? ` — ${complement}` : ""}`, montant: -Number(montant), moyen: "Espèces", versement_id: id })
    : null;
  return { sortie, entree, versement };
}

export const estVersement = (dep) => !!dep?.versement && dep.categorie === CATEGORIE_VERSEMENT;

// Le versement est-il validé ? Chez le comptable : quand l'entrée miroir est
// pointée (decaisse_le). DG / BANQUE : quand le DG l'a validé sur la sortie.
export function validationVersement(db, dep) {
  if (!estVersement(dep) || estRejete(dep)) return null;
  if (dep.versement.destination === DEST_COMPTABLE) {
    const entree = (db.depenses || []).find((x) => x.versement_id === dep.versement.id);
    return entree?.decaisse_le ? { le: entree.decaisse_le, par: entree.decaisse_par } : null;
  }
  return dep.versement_valide_le ? { le: dep.versement_valide_le, par: dep.versement_valide_par } : null;
}

// Les versements d'une boutique, du plus récent au plus ancien.
export const versementsDe = (db, boutique) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.boutique === boutique)
  .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));

// Ce que la boutique doit encore verser : le SOLDE d'espèces en caisse —
// tout ce qui est entré (ventes en espèces, règlements de dettes en
// espèces) moins tout ce qui est sorti (dépenses en espèces, versements
// compris). Un versement fait baisser ce solde d'autant, rien d'autre.
// ⚠ Capture Timo (09/09/2026) : la première version repartait de la DATE du
// dernier versement — elle ne comptait que les entrées de ce jour-là mais
// retranchait le versement entier : « attendu 252 299, versé 202 299 »
// donnait −150 900 au lieu des 50 000 restants.
// `periode` (Timo, 13/09/2026 : « ajouter période dans résumé… appliquée aussi
// aux boutiques ») : { du, au } facultatif. Avec une période, entrées et
// sorties sont celles de la période, et `montant` est le solde d'espèces À LA
// FIN de la période (tout ce qui précède `au`), comme le relevé des caisses
// centrales. Sans période : depuis le début, comme avant — c'est ce que le
// formulaire de versement attend TOUJOURS (le montant à verser est un solde).
const dansPeriode = (date, periode) => !periode || ((String(date || "").slice(0, 10) >= periode.du) && (String(date || "").slice(0, 10) <= periode.au));
const avantFin = (date, periode) => !periode || String(date || "").slice(0, 10) <= periode.au;
// ---- Le FONDS DE CAISSE FIXE (Timo, 13/09/2026) ----
// « Si chaque mois je laisse un fonds d'argent au revendeur, histoire de
// faire une dépense s'il n'y a pas encore une vente » → réglage par boutique
// (`fonds_caisse_fixe`, ⚙ Paramètres → Boutiques, admin) : l'application
// attend un versement de `solde − fonds fixe`, sans justification à écrire,
// et « Fonds à verser » montre ce qu'il y a AU-DELÀ du fonds. Le fonds ne
// se verse jamais : il reste dans le tiroir de la boutique.
export const fondsCaisseFixe = (db, boutique) => Math.max(0, Math.round(Number((db?.boutiques || []).find((b) => b.nom === boutique)?.fonds_caisse_fixe || 0)));
export const aVerserAuDela = (solde, fondsFixe) => Math.max(0, Math.round(Number(solde) || 0) - Math.round(Number(fondsFixe) || 0));
// Ce qu'il RESTE du fonds dans le tiroir (Timo, 14/09/2026 : « s'il n'y a pas
// de vente et que les dépenses sont soustraites du fonds de caisse, par où
// voir le restant du fonds ? ») : le solde d'espèces, borné au fonds fixe —
// intact quand le solde le couvre, entamé quand les dépenses l'ont mangé.
export function etatFondsCaisse(solde, fondsFixe) {
  const fixe = Math.max(0, Math.round(Number(fondsFixe) || 0));
  const s = Math.round(Number(solde) || 0);
  const reste = Math.max(0, Math.min(s, fixe));
  return { fondsFixe: fixe, reste, entame: fixe - reste, intact: fixe > 0 && reste === fixe };
}

// ---- ON NE SORT PAS DU TIROIR PLUS QU'IL NE CONTIENT (Timo, 15/09/2026) ----
// « Si dépense dépasse fonds de caisse, impossible de dépenser » — puis, sur
// deux dépenses en attente : « si on valide la première, la seconde refuse
// jusqu'à ce que le tiroir contienne l'argent nécessaire » — et sur l'argent
// avancé de sa poche : « elle attendra que le tiroir soit capable et après
// validation elle reprend son argent ».
// Avant, rien ne bloquait : une dépense en espèces de 200 000 passait avec
// 40 000 dans le tiroir, et le solde partait en négatif.
//
// LA LIMITE, c'est TOUT ce que le tiroir contient — l'argent des recettes ET
// ce qu'il reste du fonds de caisse —, pas le fonds seul : avec 100 000 de
// recettes et un fonds de 50 000, une dépense de 60 000 doit passer.
//
// ⚠ Une dépense EN ATTENTE du DG n'est pas encore sortie (règle du 12/09,
// « sans validation, ça ne compte pas ») : elle ne réduit donc pas la limite.
// C'est sa VALIDATION qui se heurte au tiroir — mot pour mot la réponse de
// Timo. Le contrôle se pose donc aux DEUX moments, et au remboursement d'une
// avance de frais en espèces (le troisième chemin par lequel le tiroir se vide
// en dehors d'un versement).
export const MSG_AVANCE_PERSONNELLE = "Sinon, choisissez « une avance personnelle » dans « Payé avec » : la dépense sera remboursée dès que la caisse le permettra.";
export function critiqueSortieTiroir({ tiroir, fondsFixe = 0, montant, geste = "Cette dépense", boutique = "", avecAvance = true }) {
  const m = Math.round(Number(montant) || 0);
  if (!Number.isFinite(m) || m <= 0) return "";
  const t = Math.round(Number(tiroir) || 0);
  if (m <= t) return "";
  const etat = etatFondsCaisse(t, fondsFixe);
  const dispo = Math.max(0, t);
  return `${geste} (${fmt(m)}) dépasse ce qu'il y a dans le tiroir${boutique ? ` de ${boutique}` : ""} : ${fmt(dispo)}`
    + (etat.fondsFixe > 0 ? ` (dont ${fmt(etat.reste)} de fonds de caisse)` : "")
    + `. Attendez une recette.${avecAvance ? ` ${MSG_AVANCE_PERSONNELLE}` : ""}`;
}

// ---- LE FONDS DE CAISSE REMIS PAR LE DG (Timo, 14/09/2026) ----
// Capture d'APESSITO : 348 000 d'entrées, 50 000 de dépenses, 298 000 versés
// — et « dans la foulée on avait aussi donné un fonds de caisse de 50 000 ».
// L'application ne connaissait le tiroir que par les ventes, encaissements,
// dépenses et versements : ces 50 000, venus du DG, n'étaient écrits nulle
// part — solde 0, « 50 000 conservé » faux, clôture faussée de 50 000.
// « Il ne faut pas mélanger le fonds de caisse avec ce qu'on va verser…
// on ne verse jamais le fonds de caisse. »
// Donc : « 💼 Remettre le fonds de caisse » dans 🔒 Caisse, pour
// l'administrateur PRINCIPAL seul (c'est l'argent de BMI qui sort de chez le
// DG ou de la banque) : une ENTRÉE dans la caisse de la boutique (ligne de
// `depenses` à montant NÉGATIF, convention déjà en place pour la caisse du
// comptable) — jamais une vente, jamais du chiffre d'affaires, jamais une
// charge (CATEGORIES_HORS_CHARGES) — et une SORTIE de la caisse « Chez le DG »
// ou « BANQUE » (lib/caissesCentrales.js). Un fonds laissé en versant moins
// reste ce qu'il est : rien à écrire. Serveur : securite-16.
export const ORIGINES_FONDS = [DEST_DG, DEST_BANQUE];
// Timo (14/09/2026, après coup) : « fonds de caisse, les deux ne peuvent jamais
// être deux choses différentes… je le préfère dans la fiche de la boutique,
// puisque c'est une opération une fois de bon » — puis, devant un choix
// « laissé sur les ventes » qui n'écrivait rien (« il y a un trou… il faut
// revoir ») : « **il ne doit y avoir aucun lien entre le fonds de caisse et
// les ventes. Le seul lien, c'est la compensation : fonds de caisse entamé,
// les ventes viennent rembourser. C'est tout.** »
// Donc le fonds d'une boutique est TOUJOURS de l'argent remis par le DG (ou
// la banque), jamais « laissé sur les ventes » : UN geste, « Remettre », dans
// ⚙ Paramètres → Boutiques → 💼 Fonds de caisse. Chaque remise AUGMENTE le
// fonds de la boutique (`fonds_caisse_fixe`) ET entre dans son tiroir.
// Le « trou » : un fonds réglé (13/09) sans remise enregistrée — le tiroir ne
// le connaît pas. `manqueRemises` le mesure, et une remise « de
// régularisation » comble le manque SANS changer le montant du fonds.
export const totalRemisesFonds = (db, boutique) => remisesFondsDe(db, boutique).reduce((s, d) => s + Number(d.fonds_caisse?.montant || 0), 0);
export const manqueRemises = (db, boutique) => Math.max(0, fondsCaisseFixe(db, boutique) - totalRemisesFonds(db, boutique));
// Le plan d'une remise : le fonds après, et si elle comble le manque.
export function planRemiseFonds({ fondsActuel, manque, montant, regularisation = false }) {
  const m = Math.round(Number(montant));
  if (!Number.isFinite(m) || m <= 0) return { refus: "Indiquez le montant remis (supérieur à zéro)." };
  const f = Math.max(0, Math.round(Number(fondsActuel) || 0));
  const q = Math.max(0, Math.round(Number(manque) || 0));
  if (regularisation) {
    if (q <= 0) return { refus: "Rien à régulariser : toutes les remises de ce fonds sont enregistrées." };
    if (m > q) return { refus: `La régularisation ne peut pas dépasser le manque (${fmt(q)}). Au-delà, faites une remise ordinaire : elle augmentera le fonds.` };
    return { montant: m, fondsApres: f, regularisation: true };
  }
  return { montant: m, fondsApres: f + m, regularisation: false };
}
export const estFondsCaisseRemis = (dep) => !!dep?.fonds_caisse && dep.categorie === CATEGORIE_FONDS_CAISSE;
export function critiqueRemiseFonds({ montant, origine, banque, date }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Indiquez le montant remis (supérieur à zéro).";
  if (!ORIGINES_FONDS.includes(origine)) return "Indiquez d'où vient l'argent : Chez le DG ou BANQUE.";
  if (origine === DEST_BANQUE && !String(banque || "").trim()) return "Indiquez le nom de la banque.";
  if (!date || Number.isNaN(new Date(String(date)).getTime())) return "Indiquez la date de la remise.";
  return "";
}
export function construireRemiseFonds(profile, { boutique, montant, origine, banque = "", note = "", date, regularisation = false }) {
  const refus = critiqueRemiseFonds({ montant, origine, banque, date });
  if (refus) return { refus };
  const m = Math.round(Number(montant));
  const fonds_caisse = { id: uid(), origine, banque: origine === DEST_BANQUE ? String(banque).trim() : "", montant: m, note: String(note || "").trim(), regularisation: !!regularisation };
  const entree = {
    ...nouvelleDepense(profile, { boutique, categorie: CATEGORIE_FONDS_CAISSE, description: `Fonds de caisse remis le ${dFR(date)} par ${profile.nom} (${libelleOrigineFonds(fonds_caisse)})${fonds_caisse.note ? ` — ${fonds_caisse.note}` : ""}`, montant: -m, moyen: "Espèces", fonds_caisse, par_id: profile.id ?? null }),
    date: String(date),
  };
  return { entree, fonds_caisse, journal: `Fonds de caisse ${fmt(m)} remis à ${boutique} (${libelleOrigineFonds(fonds_caisse)}) par ${profile.nom}` };
}
// ⚠ Timo, 15/09/2026 (capture de la clôture du 14/09 à DEMAKPOE, écart
// −40 800) : « pourquoi tu additionnes le fonds de caisse aux ventes ? » puis
// « l'argent était remis depuis [avant] ». Les 50 000 F avaient bien été
// remis par le DG, mais des semaines plus tôt. « Régulariser » pré-remplissait
// la date à AUJOURD'HUI — alors qu'une régularisation parle par définition
// d'un argent remis dans le PASSÉ : les 50 000 tombaient donc dans la clôture
// du jour, comme s'ils venaient d'arriver dans le tiroir.
// La remise elle-même était juste ; c'est sa DATE qui était fausse. Elle se
// corrige donc, sans rien recalculer d'autre : le montant, l'origine et le
// fonds ne bougent pas. La description porte la date en clair : elle suit.
export function corrigerDateRemise(remise, nouvelleDate) {
  if (!estFondsCaisseRemis(remise)) return { refus: "Cette ligne n'est pas une remise de fonds de caisse." };
  const d = String(nouvelleDate || "").trim();
  if (!d || Number.isNaN(new Date(d).getTime())) return { refus: "Indiquez la date réelle de la remise (AAAA-MM-JJ)." };
  if (d === String(remise.date)) return { refus: "C'est déjà la date de cette remise." };
  return {
    remise: { ...remise, date: d, description: String(remise.description || "").replace(/remis le [^ ]+ par/, `remis le ${dFR(d)} par`) },
    journal: `Date de la remise de fonds de ${remise.boutique} corrigée : ${dFR(remise.date)} → ${dFR(d)} (${fmt(Math.abs(Number(remise.montant || 0)))})`,
  };
}
export const libelleOrigineFonds = (f) => (f?.origine === DEST_BANQUE ? `BANQUE ${String(f.banque || "").trim()}`.trim() : (f?.origine || DEST_DG));
// Les remises de fonds d'une boutique, la plus récente en premier.
export const remisesFondsDe = (db, boutique) => (db?.depenses || []).filter((d) => d.boutique === boutique && estFondsCaisseRemis(d))
  .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));
export function fondsAVerser(db, boutique, totalVente, periode = null) {
  const montantVente = (v) => totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0);
  const ventesEspeces = (db.ventes || []).filter((v) => v.boutique === boutique && v.paiement === "Espèces");
  const paiementsEspeces = (db.dettes || []).filter((d) => d.boutique === boutique)
    .flatMap((d) => (d.paiements || []).filter((p) => (p.paiement || "Espèces") === "Espèces"));
  // Timo (12/09/2026) : une dépense en attente de validation ne compte pas ;
  // une avance personnelle ou l'argent du DG ne sortent pas du tiroir.
  const mouvementsCaisse = (db.depenses || []).filter((x) => x.boutique === boutique && compteDansLaCaisse(x));
  // Le fonds de caisse REMIS par le DG (14/09/2026) est une ENTRÉE (montant
  // négatif) : il est compté à part, jamais dans « Sorties ».
  const remises = mouvementsCaisse.filter(estFondsCaisseRemis);
  const sortiesCaisse = mouvementsCaisse.filter((x) => !estFondsCaisseRemis(x));
  const somme = (liste, de, filtre) => liste.filter((x) => filtre(x.date)).reduce((s, x) => s + de(x), 0);
  const ventes = somme(ventesEspeces, montantVente, (d) => dansPeriode(d, periode));
  const reglements = somme(paiementsEspeces, (p) => Number(p.montant || 0), (d) => dansPeriode(d, periode));
  const depenses = somme(sortiesCaisse, (x) => Number(x.montant || 0), (d) => dansPeriode(d, periode));
  const fondsRemis = -somme(remises, (x) => Number(x.montant || 0), (d) => dansPeriode(d, periode));
  const montant = somme(ventesEspeces, montantVente, (d) => avantFin(d, periode)) + somme(paiementsEspeces, (p) => Number(p.montant || 0), (d) => avantFin(d, periode))
    - somme(sortiesCaisse, (x) => Number(x.montant || 0), (d) => avantFin(d, periode)) - somme(remises, (x) => Number(x.montant || 0), (d) => avantFin(d, periode));
  const dernier = versementsDe(db, boutique).find((d) => avantFin(d.date, periode));
  const derniereRemise = remisesFondsDe(db, boutique).find((d) => avantFin(d.date, periode));
  const fondsFixe = fondsCaisseFixe(db, boutique);
  const etat = etatFondsCaisse(montant, fondsFixe);
  // `montant` = le SOLDE d'espèces ; `aVerser` = ce qu'il y a au-delà du fonds
  // fixe ; `resteFonds` = ce qu'il reste du fonds dans le tiroir (14/09/2026).
  return { montant, ventes, reglements, depenses, fondsRemis, dernierVersement: dernier ? String(dernier.date) : "", derniereRemise: derniereRemise ? String(derniereRemise.date) : "",
    fondsFixe, aVerser: aVerserAuDela(montant, fondsFixe), resteFonds: etat.reste, fondsEntame: etat.entame, fondsIntact: etat.intact };
}

// ---- Le RÉSUMÉ des caisses (Timo, 13/09/2026) ----
// « Ajouter un carré présentant le total versé… dans Caisse, à côté des
// boutiques, un bouton RÉSUMÉ dans lequel on reprend les carrés » : Fonds à
// verser / Total versé / Entrées / Sorties — dans Caisse, pas dans le
// tableau de bord (confirmé). Rien n'est écrit : une lecture.
// Total versé = tous les versements de la boutique, REJETÉS EXCLUS (un
// versement rejeté est « comme jamais versé »), depuis le début ; ce qui
// attend encore sa validation (DG, banque, comptable) est dit à part, et
// le mois en cours aussi.
export function totalVerse(db, boutique, aujourdhui, periode = null) {
  const liste = versementsDe(db, boutique).filter((d) => !estRejete(d) && dansPeriode(d.date, periode));
  const mois = String(aujourdhui || "").slice(0, 7);
  const somme = (l) => l.reduce((s, d) => s + Number(d.montant || 0), 0);
  return {
    total: somme(liste),
    enAttente: somme(liste.filter((d) => !validationVersement(db, d))),
    ceMois: somme(liste.filter((d) => String(d.date).slice(0, 7) === mois)),
    nb: liste.length,
  };
}
// Une ligne par boutique (les quatre carrés) et la ligne Total en bas ;
// `periode` { du, au } facultative (voir fondsAVerser).
export function resumeCaisses(db, nomsBoutiques, totalVente, aujourdhui, periode = null) {
  const lignes = (nomsBoutiques || []).map((boutique) => {
    const f = fondsAVerser(db, boutique, totalVente, periode);
    const v = totalVerse(db, boutique, aujourdhui, periode);
    // `entrees` = ventes + règlements (le fonds remis est dit à part : `fondsRemis`).
    return { boutique, aVerser: f.aVerser, solde: f.montant, fondsFixe: f.fondsFixe, resteFonds: f.resteFonds, fondsRemis: f.fondsRemis, dernierVersement: f.dernierVersement, entrees: f.ventes + f.reglements, sorties: f.depenses, verse: v.total, verseEnAttente: v.enAttente, verseCeMois: v.ceMois };
  });
  const total = lignes.reduce((t, l) => ({ aVerser: t.aVerser + l.aVerser, solde: t.solde + l.solde, fondsFixe: t.fondsFixe + l.fondsFixe, resteFonds: t.resteFonds + l.resteFonds, fondsRemis: t.fondsRemis + l.fondsRemis, entrees: t.entrees + l.entrees, sorties: t.sorties + l.sorties, verse: t.verse + l.verse, verseEnAttente: t.verseEnAttente + l.verseEnAttente, verseCeMois: t.verseCeMois + l.verseCeMois }),
    { aVerser: 0, solde: 0, fondsFixe: 0, resteFonds: 0, fondsRemis: 0, entrees: 0, sorties: 0, verse: 0, verseEnAttente: 0, verseCeMois: 0 });
  return { lignes, total };
}

// Les versements que le DG (administrateur principal) doit valider : DG et
// BANQUE, sans validation, dans les boutiques données.
export const versementsAValiderParDG = (db, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.versement.destination !== DEST_COMPTABLE && !d.versement_valide_le && !estRejete(d) && nomsBoutiques.includes(d.boutique))
  .sort((a, b) => `${a.date} ${a.heure || ""}`.localeCompare(`${b.date} ${b.heure || ""}`));

// Les versements DG / BANQUE déjà traités (validés OU rejetés), du plus
// récent au plus ancien.
export const versementsValidesParDG = (db, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.versement.destination !== DEST_COMPTABLE && (!!d.versement_valide_le || estRejete(d)) && nomsBoutiques.includes(d.boutique))
  .sort((a, b) => `${b.versement_valide_le || b.versement_rejete_le} ${b.date}`.localeCompare(`${a.versement_valide_le || a.versement_rejete_le} ${a.date}`));

// ============ LE REJET D'UN VERSEMENT (Timo, 10/09/2026) ============
// « L'admin ou le comptable doit avoir la possibilité de rejeter une demande
// de versement » — « l'argent doit retourner comme jamais versé ».
// Qui rejette = qui valide : le DG (administrateur principal) pour Chez le
// DG et BANQUE, le comptable pour Chez le comptable. Seulement un versement
// EN ATTENTE : validé, il ne se rejette plus ; rejeté, il ne se valide plus,
// et le rejet ne s'annule pas. Un motif est obligatoire.
// « Jamais versé » : la sortie de la boutique ET l'entrée miroir chez le
// comptable passent à 0 F — le montant d'origine reste dans `versement`.
// Ainsi TOUT ce qui additionne les dépenses (fonds à verser, clôture,
// tableau de bord, écran Dépenses) l'ignore sans qu'on ait à le lui dire.
// Serveur : securite-12 (mêmes règles, et le montant forcé à 0).
export const estRejete = (dep) => !!dep?.versement_rejete_le;
export const rejetVersement = (dep) => (estRejete(dep) ? { le: dep.versement_rejete_le, par: dep.versement_rejete_par, motif: dep.versement_rejet_motif || "" } : null);

// Le rôle qui peut rejeter CE versement : "principal" (le DG) ou "comptable".
export const juryDuVersement = (dep) => (dep?.versement?.destination === DEST_COMPTABLE ? "comptable" : "principal");

// "" si le rejet est possible, sinon le motif du refus.
export function critiqueRejet(db, dep, motif, { estPrincipal, role }) {
  if (!estVersement(dep)) return "Cette ligne n'est pas un versement de fonds.";
  if (estRejete(dep)) return "Ce versement est déjà rejeté.";
  if (validationVersement(db, dep)) return "Ce versement est déjà validé : il ne se rejette plus.";
  if (juryDuVersement(dep) === "comptable" ? role !== "comptable" : !estPrincipal) {
    return juryDuVersement(dep) === "comptable" ? "Seul le comptable peut rejeter un versement « Chez le comptable »." : "Seul le DG (administrateur principal) peut rejeter un versement Chez le DG ou BANQUE.";
  }
  if (!String(motif || "").trim()) return "Indiquez pourquoi ce versement est rejeté.";
  return "";
}

// Les écritures du rejet : la liste des dépenses corrigée, et le message au
// gérant qui avait versé. Ne vérifie pas le droit : critiqueRejet d'abord.
export function rejeterVersement(db, profile, dep, motif, aujourdhui) {
  const m = String(motif || "").trim();
  const marque = { montant: 0, versement_rejete_le: aujourdhui, versement_rejete_par: profile.nom, versement_rejet_motif: m };
  const depenses = (db.depenses || []).map((x) => {
    if (x.id === dep.id) return { ...x, ...marque, description: `✖ REJETÉ (${m}) — ${x.description || ""}`.trim() };
    if (x.versement_id && x.versement_id === dep.versement.id) return { ...x, ...marque, description: `✖ REJETÉ (${m}) — ${x.description || ""}`.trim() };
    return x;
  });
  const auteur = (db.users || []).find((u) => (dep.par_id && u.id === dep.par_id) || (!dep.par_id && u.nom === dep.par));
  const texte = `✖ ${libelleVersementDu(dep)} REJETÉ : ${fmt(dep.versement.montant)} de ${dep.boutique} → ${libelleDestination(dep.versement)}, rejeté par ${profile.nom}. Motif : ${m}. L'argent est considéré comme toujours en caisse à ${dep.boutique} : refaites le versement.`;
  const messages = auteur ? [nouveauMessage(profile, { a_id: auteur.id, texte })] : [];
  return { depenses, messages, journal: `Versement de fonds REJETÉ par ${profile.nom} : ${fmt(dep.versement.montant)} de ${dep.boutique} → ${libelleDestination(dep.versement)} — ${m}` };
}

// Qui prévenir : le comptable pour « Chez le comptable », le DG (admin
// principal) pour les deux autres. Même fabrique de message que partout.
export function messagesVersement(db, profile, sortie) {
  const v = sortie.versement;
  const texte = `💸 Versement de fonds : ${fmt(sortie.montant)} de ${sortie.boutique} → ${libelleDestination(v)}, par ${profile.nom}. À valider.`;
  const destinataires = v.destination === DEST_COMPTABLE
    ? (db.users || []).filter((u) => u.role === "comptable" && u.actif !== false)
    : (db.users || []).filter((u) => u.role === "admin" && u.admin_principal === true && u.actif !== false);
  return destinataires.map((u) => nouveauMessage(profile, { a_id: u.id, texte }));
}
