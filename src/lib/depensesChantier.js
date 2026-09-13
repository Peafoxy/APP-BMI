// ============================================================
// lib/depensesChantier.js — LES PETITES DÉPENSES D'UN CHANTIER DE DEVIS
//
// Timo (13/09/2026) : « pour les chantiers nés d'un devis, les petites
// dépenses [carburant, nourriture] peuvent être rattachées au devis en
// question, et à la fin ces petites dépenses sont soustraites avant le
// partage » — « je parle des frais d'installation, pas de la commission du
// commercial ». Et sur le geste : « au moment d'enregistrer la dépense, on
// aura "rattacher à un devis" ; quand il veut rattacher, les chantiers en
// cours apparaissent et il rattache ».
//
// Règles :
//   • une dépense reste une dépense ordinaire (📤 Dépenses, validation du DG
//     à partir du seuil, avance à rembourser…) : elle porte SEULEMENT le
//     chantier (`chantier_id`, `chantier_nom`) ;
//   • rattachable : un chantier de 🏠 Clients installés de l'espace regardé,
//     pas encore réceptionné, dont les frais n'ont pas déjà été payés ;
//   • ne comptent pour la déduction que les dépenses qui COMPTENT (ni en
//     attente du DG, ni rejetées) ;
//   • frais à partager = frais facturés − dépenses rattachées, jamais négatif.
//     C'est sur ce montant-là que les parts des techniciens se calculent.
// ============================================================
import { estEnAttente, estRejetee } from "./validationDepenses";
import { chantiersDeMonEspace, statutChantier, afficheChiffresFormation, boutiqueDuChantier, estBoutiqueFormation } from "./calculs";

export const ROLES_RATTACHEMENT = ["gerant", "admin"];

// Le libellé d'un chantier dans la liste de rattachement.
export const libelleChantier = (c) => {
  const nom = `${c.prenom || ""} ${c.nom || ""}`.trim() || "Chantier";
  const type = c.type_installation ? ` · ${c.type_installation}` : "";
  return `${nom}${type}`;
};

// « Je vois les deux espaces » ne veut jamais dire « je les affiche
// ensemble » : même pour l'administrateur principal, c'est l'espace REGARDÉ
// qui décide. Un chantier sans boutique connue suit l'espace du compte.
export const dansLEspaceRegarde = (db, profile, c) => {
  if (!chantiersDeMonEspace(db, profile).some((x) => x.id === c?.id)) return false;
  const b = boutiqueDuChantier(db, c);
  return !b || estBoutiqueFormation(db, b) === afficheChiffresFormation(db, profile);
};

// Les chantiers auxquels on peut rattacher une dépense : espace regardé,
// pas encore réceptionnés, frais pas déjà payés. Les plus récents d'abord.
export const chantiersRattachables = (db, profile) => (db.clients_installes || [])
  .filter((c) => dansLEspaceRegarde(db, profile, c) && statutChantier(c) !== "receptionne" && !fraisDejaPayes(c))
  .sort((a, b) => String(b.date_installation || b.date || "").localeCompare(String(a.date_installation || a.date || "")));

export const fraisDejaPayes = (c) => (c?.equipe || []).some((e) => e.paye && Number(e.montant || 0) > 0);

export const depensesDuChantier = (db, chantierId) => (db.depenses || []).filter((d) => d.chantier_id && d.chantier_id === chantierId);

// Une dépense compte pour la déduction si elle compte tout court : pas en
// attente du DG, pas rejetée (son montant est déjà à 0), montant > 0.
export const depenseCompteAuChantier = (d) => !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) > 0;

export const totalDepensesChantier = (db, chantierId) => depensesDuChantier(db, chantierId)
  .filter(depenseCompteAuChantier).reduce((s, d) => s + Number(d.montant || 0), 0);

// Ce qui reste à partager entre les techniciens.
export const fraisAPartager = (fraisFactures, depensesRattachees) => Math.max(0, Number(fraisFactures || 0) - Number(depensesRattachees || 0));

// Qui peut rattacher (ou détacher) une dépense : gérant, admin, ou celui qui l'a saisie.
export const peutRattacher = (profile, dep) => ROLES_RATTACHEMENT.includes(profile?.role)
  || (!!dep?.par_id && dep.par_id === profile?.id) || (!dep?.par_id && !!dep?.par && dep.par === profile?.nom);

export const critiqueRattachement = (db, profile, dep, chantier) => {
  if (!dep) return "Dépense introuvable.";
  if (!peutRattacher(profile, dep)) return "Seuls le gérant, l'administrateur ou la personne qui a saisi la dépense peuvent la rattacher à un chantier.";
  if (chantier === null) return null; // détacher
  if (!chantier) return "Chantier introuvable.";
  if (!dansLEspaceRegarde(db, profile, chantier)) return "Ce chantier n'est pas dans l'espace que vous regardez.";
  if (statutChantier(chantier) === "receptionne") return "Ce chantier est déjà réceptionné : ses frais sont clos, on ne lui rattache plus de dépense.";
  if (fraisDejaPayes(chantier)) return "Les frais d'installation de ce chantier ont déjà été payés aux techniciens : on ne peut plus rien déduire.";
  return null;
};

export const rattacherDepense = (dep, chantier) => {
  if (!chantier) { const { chantier_id, chantier_nom, ...reste } = dep; return reste; }
  return { ...dep, chantier_id: chantier.id, chantier_nom: libelleChantier(chantier) };
};
