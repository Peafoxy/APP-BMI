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
//   • vendeur et gérant peuvent verser ; versement libre (pas imposé à la
//     clôture).
//
// UNE règle, pure (le banc l'exerce) : un versement est une DÉPENSE de la
// boutique (catégorie « Versement de fonds », espèces) qui porte le détail
// dans `versement` ; pour « Chez le comptable », une ENTRÉE miroir (montant
// négatif, convention déjà en place) est posée dans la caisse du comptable,
// liée par `versement_id` — c'est elle que le comptable pointe.
// ============================================================
import { nouvelleDepense, nouveauMessage, uid, fmt } from "./core";

export const CATEGORIE_VERSEMENT = "Versement de fonds";
export const DEST_DG = "Chez le DG";
export const DEST_BANQUE = "BANQUE";
export const DEST_COMPTABLE = "Chez le comptable";
export const DESTINATIONS_VERSEMENT = [DEST_DG, DEST_BANQUE, DEST_COMPTABLE];
export const ROLES_VERSEMENT = ["vendeur", "gerant", "admin"];
// La caisse « Chez le comptable » est RÉELLE et n'a pas de jumelle : un
// compte de formation ne la voit jamais (règle du mur formation / réel).
export const destinationsPour = (enFormation) => (enFormation ? DESTINATIONS_VERSEMENT.filter((d) => d !== DEST_COMPTABLE) : DESTINATIONS_VERSEMENT);

// Le versement est-il bien formé ? Renvoie le motif du refus, ou "".
export function critiqueVersement({ montant, destination, banque, bordereau }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Indiquez le montant versé (supérieur à zéro).";
  if (!DESTINATIONS_VERSEMENT.includes(destination)) return "Choisissez la destination : Chez le DG, BANQUE ou Chez le comptable.";
  if (destination === DEST_BANQUE) {
    if (!String(banque || "").trim()) return "Indiquez le nom de la banque.";
    if (!String(bordereau || "").trim()) return "Indiquez le numéro du bordereau de versement.";
  }
  return "";
}

// Libellé lisible de la destination, avec la banque et le bordereau.
export const libelleDestination = (v) => (v?.destination === DEST_BANQUE
  ? `BANQUE ${String(v.banque || "").trim()}${v.bordereau ? ` — bordereau ${String(v.bordereau).trim()}` : ""}`
  : (v?.destination || ""));

// Construit les écritures : { sortie, entree } — `entree` vaut null sauf
// pour « Chez le comptable ». Les deux portent le même `versement.id`.
export function construireVersement(profile, { boutique, montant, destination, banque = "", bordereau = "", note = "" }) {
  const refus = critiqueVersement({ montant, destination, banque, bordereau });
  if (refus) return { refus };
  const id = uid();
  const versement = {
    id, destination,
    banque: destination === DEST_BANQUE ? String(banque).trim() : "",
    bordereau: destination === DEST_BANQUE ? String(bordereau).trim() : "",
    note: String(note || "").trim(),
  };
  const description = `Versement de fonds → ${libelleDestination(versement)}${versement.note ? ` (${versement.note})` : ""}`;
  const sortie = nouvelleDepense(profile, { boutique, categorie: CATEGORIE_VERSEMENT, description, montant: Number(montant), moyen: "Espèces", versement });
  const entree = destination === DEST_COMPTABLE
    ? nouvelleDepense(profile, { boutique: DEST_COMPTABLE, categorie: CATEGORIE_VERSEMENT, description: `Versement reçu de ${boutique} (par ${profile.nom})`, montant: -Number(montant), moyen: "Espèces", versement_id: id })
    : null;
  return { sortie, entree, versement };
}

export const estVersement = (dep) => !!dep?.versement && dep.categorie === CATEGORIE_VERSEMENT;

// Le versement est-il validé ? Chez le comptable : quand l'entrée miroir est
// pointée (decaisse_le). DG / BANQUE : quand le DG l'a validé sur la sortie.
export function validationVersement(db, dep) {
  if (!estVersement(dep)) return null;
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

// Ce que la boutique doit encore verser : espèces entrées (ventes, règlements
// de dettes) moins espèces sorties (dépenses, versements compris), depuis la
// date du dernier versement — ou depuis toujours s'il n'y en a jamais eu.
export function fondsAVerser(db, boutique, totalVente) {
  const dernier = versementsDe(db, boutique)[0];
  const depuis = dernier ? String(dernier.date) : "";
  const dans = (d) => !depuis || String(d) >= depuis;
  const ventes = (db.ventes || []).filter((v) => v.boutique === boutique && v.paiement === "Espèces" && dans(v.date))
    .reduce((s, v) => s + totalVente(v) + Number(v.frais_installation || 0) + Number(v.frais_transport || 0), 0);
  const reglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .reduce((s, d) => s + (d.paiements || []).filter((p) => (p.paiement || "Espèces") === "Espèces" && dans(p.date)).reduce((t, p) => t + Number(p.montant || 0), 0), 0);
  const depenses = (db.depenses || []).filter((x) => x.boutique === boutique && x.paiement === "Espèces" && dans(x.date))
    .reduce((s, x) => s + Number(x.montant || 0), 0);
  return { montant: ventes + reglements - depenses, depuis, ventes, reglements, depenses };
}

// Les versements que le DG (administrateur principal) doit valider : DG et
// BANQUE, sans validation, dans les boutiques données.
export const versementsAValiderParDG = (db, nomsBoutiques) => (db.depenses || [])
  .filter((d) => estVersement(d) && d.versement.destination !== DEST_COMPTABLE && !d.versement_valide_le && nomsBoutiques.includes(d.boutique))
  .sort((a, b) => `${a.date} ${a.heure || ""}`.localeCompare(`${b.date} ${b.heure || ""}`));

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
