// ============================================================
// lib/remiseTiroir.js — 💵 LA REMISE DU DG AU TIROIR D'UNE BOUTIQUE
//
// Timo (10/11/2026) : « Au jour d'aujourd'hui, l'argent peut-il quitter
// physiquement la caisse du DG vers la caisse du gérant ? » — non : seul le
// fonds de caisse (l'ENVELOPPE) existait. « Oui je veux ça », puis, devant la
// description : « A b, B les trois avec comptable, C a, D prévenu par
// WhatsApp à l'enregistrement et à la validation, l'administrateur aussi est
// informé ».
//
//   • A b : l'administrateur PRINCIPAL enregistre ; le GÉRANT de la boutique
//     confirme « ✅ Reçu ». Tant qu'il n'a pas confirmé, RIEN ne compte : ni
//     dans le tiroir, ni dans la caisse d'où vient l'argent.
//   • B : l'argent vient de « Chez le DG », de la BANQUE ou de « Chez le
//     comptable » (le comptable : réel seulement, il n'a pas de jumelle).
//   • C a : confirmé, il entre TOUT ENTIER dans le tiroir, au moment de la
//     confirmation — il ne rembourse pas l'enveloppe du fonds de caisse.
//   • D : WhatsApp du numéro BMI au gérant à l'enregistrement, et aux
//     administrateurs principaux à la confirmation (lib/whatsappModeles.js).
//
// LA LIGNE : une ligne de la table des dépenses, montant NÉGATIF (la
// convention des entrées de caisse), catégorie « Remise du DG au tiroir »
// (HORS CHARGES : ni une vente, ni une charge), et le détail `remise_tiroir`
// { id, source, banque, motif, recue_le, recue_heure, recue_par, recue_par_id,
// annulee_le, annulee_par, annulee_motif }. Une remise ANNULÉE (le principal,
// tant qu'elle n'est pas reçue) passe à 0 F, comme un versement rejeté.
// Lecture : versements.js (le tiroir), caissesCentrales.js (DG, BANQUE,
// comptable), cloture.js (sa ligne à la clôture). Serveur : securite-51.
// ============================================================
import { nouvelleDepense, fmt, dFR, heureCourte } from "./core.js";
import { CATEGORIE_REMISE_TIROIR, estRemiseTiroir, remiseTiroirRecue, remiseTiroirAnnulee } from "./constants.js";
import { DEST_DG, DEST_BANQUE, DEST_COMPTABLE, libelleSourceRemise } from "./versements.js";

export { CATEGORIE_REMISE_TIROIR, estRemiseTiroir, remiseTiroirRecue, remiseTiroirAnnulee, libelleSourceRemise };

// « B les trois avec comptable » ; le comptable n'existe qu'en réel.
export const SOURCES_REMISE_TIROIR = [DEST_DG, DEST_BANQUE, DEST_COMPTABLE];
export const sourcesRemisePour = (enFormation) => (enFormation ? [DEST_DG, DEST_BANQUE] : SOURCES_REMISE_TIROIR);

// Qui confirme : le GÉRANT de la boutique (« A b »), compte actif.
export const ROLE_CONFIRME_REMISE = "gerant";
export const gerantsDeLaBoutique = (personnes, boutique) => (personnes || [])
  .filter((u) => u && u.role === ROLE_CONFIRME_REMISE && u.boutique === boutique && u.actif !== false && !u.bloque);

export const remiseEnAttente = (d) => estRemiseTiroir(d) && !d.remise_tiroir.recue_le && !d.remise_tiroir.annulee_le;
export const montantRemise = (d) => (remiseTiroirAnnulee(d) ? Number(d.remise_tiroir.montant || 0) : -Number(d?.montant || 0));
export const etatRemise = (d) => (remiseTiroirAnnulee(d) ? "annulee" : remiseTiroirRecue(d) ? "recue" : "attente");

const estDateValide = (t) => { const p = String(t || "").split("-"); return p.length === 3 && p[0].length === 4 && !Number.isNaN(new Date(`${t}T00:00:00`).getTime()); };

// Le refus DIT ce qui manque. `gerants` = les gérants actifs de la boutique
// (dans l'espace regardé) : sans gérant, personne ne pourrait confirmer.
export function critiqueRemiseTiroir({ montant, source, banque, motif, date, aujourdhui, gerants, enFormation = false, boutique = "" }) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Indiquez le montant remis (supérieur à zéro).";
  if (!sourcesRemisePour(enFormation).includes(source)) return enFormation
    ? "Indiquez d'où vient l'argent : Chez le DG ou BANQUE (la caisse du comptable n'existe pas en formation)."
    : "Indiquez d'où vient l'argent : Chez le DG, BANQUE ou Chez le comptable.";
  if (source === DEST_BANQUE && !String(banque || "").trim()) return "Indiquez le nom de la banque.";
  if (!estDateValide(date)) return "Indiquez la date de la remise.";
  if (aujourdhui && String(date) > String(aujourdhui)) return "La date ne peut pas être dans le futur.";
  if (!String(motif || "").trim()) return "Indiquez le motif (« monnaie pour rendre », « pas de vente ce matin »…) : une remise sans motif ne s'explique à personne.";
  if (!(gerants || []).length) return `${boutique || "Cette boutique"} n'a aucun gérant actif : personne ne pourrait confirmer la réception. Rattachez d'abord un gérant (👥 Utilisateurs).`;
  return "";
}

export function construireRemiseTiroir(profile, { boutique, montant, source, banque = "", motif, date }) {
  const m = Math.round(Number(montant));
  const remise_tiroir = {
    id: `rt-${Math.random().toString(36).slice(2, 10)}`,
    source, banque: source === DEST_BANQUE ? String(banque).trim() : "", motif: String(motif || "").trim(),
  };
  const ligne = {
    ...nouvelleDepense(profile, {
      boutique, categorie: CATEGORIE_REMISE_TIROIR,
      description: `Remise au tiroir de ${boutique} le ${dFR(date)} par ${profile.nom} (${libelleSourceRemise(remise_tiroir)}) — ${remise_tiroir.motif}`,
      montant: -m, moyen: "Espèces", remise_tiroir, par_id: profile.id ?? null, date: String(date),
    }),
    date: String(date),
  };
  return { ligne, journal: `💵 Remise au tiroir de ${boutique} : ${fmt(m)} (${libelleSourceRemise(remise_tiroir)}) par ${profile.nom}, en attente de confirmation — ${remise_tiroir.motif}` };
}

// ---- « ✅ Reçu » : le gérant DE CETTE BOUTIQUE (revérifié dans le geste) ----
export function critiqueConfirmation(d, profile) {
  if (!estRemiseTiroir(d)) return "Cette ligne n'est pas une remise au tiroir.";
  if (remiseTiroirAnnulee(d)) return "Cette remise a été annulée par le DG.";
  if (d.remise_tiroir.recue_le) return `Cette remise est déjà confirmée (le ${dFR(d.remise_tiroir.recue_le)} par ${d.remise_tiroir.recue_par}).`;
  if (profile?.role !== ROLE_CONFIRME_REMISE || profile?.boutique !== d.boutique) return `Seul le gérant de ${d.boutique} confirme avoir reçu cet argent.`;
  return "";
}
export function confirmerRemise(d, profile, { date, heure = heureCourte() }) {
  return {
    ligne: { ...d, remise_tiroir: { ...d.remise_tiroir, recue_le: String(date), recue_heure: heure, recue_par: profile.nom, recue_par_id: profile.id ?? null } },
    journal: `💵 Remise au tiroir de ${d.boutique} REÇUE : ${fmt(montantRemise(d))} (${libelleSourceRemise(d.remise_tiroir)}) — confirmée par ${profile.nom}`,
  };
}

// ---- « ✕ Annuler » : le principal, tant qu'elle n'est pas reçue ----
export function critiqueAnnulation(d, motif) {
  if (!estRemiseTiroir(d)) return "Cette ligne n'est pas une remise au tiroir.";
  if (remiseTiroirAnnulee(d)) return "Cette remise est déjà annulée.";
  if (d.remise_tiroir.recue_le) return "Le gérant a déjà confirmé l'avoir reçue : elle ne s'annule plus (rendez-la par un versement).";
  if (!String(motif || "").trim()) return "Indiquez le motif de l'annulation.";
  return "";
}
export function annulerRemise(d, profile, motif, date) {
  const m = -Number(d.montant || 0);
  return {
    ligne: { ...d, montant: 0, remise_tiroir: { ...d.remise_tiroir, montant: m, annulee_le: String(date), annulee_par: profile.nom, annulee_motif: String(motif).trim() } },
    journal: `💵 Remise au tiroir de ${d.boutique} ANNULÉE : ${fmt(m)} — ${String(motif).trim()} (par ${profile.nom})`,
  };
}

// Les remises d'une boutique : en attente d'abord, puis les plus récentes.
export const remisesDe = (db, boutique) => (db?.depenses || [])
  .filter((d) => estRemiseTiroir(d) && d.boutique === boutique)
  .sort((a, b) => (remiseEnAttente(b) - remiseEnAttente(a)) || `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));
