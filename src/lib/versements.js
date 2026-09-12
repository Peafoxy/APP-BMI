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
import { nouvelleDepense, nouveauMessage, uid, fmt, dFR } from "./core";
import { CATEGORIE_VERSEMENT, horsVersements } from "./constants";
import { compteDansLaCaisse } from "./validationDepenses";

// La catégorie vit dans constants.js (lue aussi par le journal comptable) :
// importée ET réexportée — jamais `export { x } from` seul (piège connu).
export { CATEGORIE_VERSEMENT, horsVersements };
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
export function fondsAVerser(db, boutique, totalVente) {
  const ventes = (db.ventes || []).filter((v) => v.boutique === boutique && v.paiement === "Espèces")
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0);
  const reglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .reduce((s, d) => s + (d.paiements || []).filter((p) => (p.paiement || "Espèces") === "Espèces").reduce((t, p) => t + Number(p.montant || 0), 0), 0);
  // Timo (12/09/2026) : une dépense en attente de validation ne compte pas ;
  // une avance personnelle ou l'argent du DG ne sortent pas du tiroir.
  const depenses = (db.depenses || []).filter((x) => x.boutique === boutique && compteDansLaCaisse(x))
    .reduce((s, x) => s + Number(x.montant || 0), 0);
  const dernier = versementsDe(db, boutique)[0];
  return { montant: ventes + reglements - depenses, ventes, reglements, depenses, dernierVersement: dernier ? String(dernier.date) : "" };
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
