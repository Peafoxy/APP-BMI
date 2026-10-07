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
import { chantiersDeMonEspace, espaceDeLaFiche, statutChantier, afficheChiffresFormation, boutiqueDuChantier, estBoutiqueFormation, travauxSolde } from "./calculs";

export const ROLES_RATTACHEMENT = ["gerant", "admin"];

// Le libellé d'un chantier dans la liste de rattachement.
export const libelleChantier = (c) => {
  const nom = `${c.prenom || ""} ${c.nom || ""}`.trim() || "Chantier";
  // ⚠ 07/10/2026 (capture Timo : « NIMAN · Travaux », alors que la fiche dit
  // FORAGE) : des travaux à crédit portent tous le type fixe « Travaux » ; ce
  // qui les distingue est la DESCRIPTION tapée à l'ouverture. On la montre.
  const precision = c.travaux && String(c.description || "").trim() ? ` — ${String(c.description).trim()}` : "";
  const type = c.type_installation ? ` · ${c.type_installation}${precision}` : precision;
  return `${c.travaux ? "🛠 " : ""}${nom}${type}`;
};

// « Je vois les deux espaces » ne veut jamais dire « je les affiche
// ensemble » : même pour l'administrateur principal, c'est l'espace REGARDÉ
// qui décide. Un chantier sans boutique connue suit l'espace du compte.
// ⚠ 15/09/2026 : la MARQUE d'espace de la fiche fait foi (espaceDeLaFiche) —
// « faire toujours confiance à l'espace, pas à la boutique de l'espace ». La
// boutique ne sert plus qu'aux fiches anciennes, créées avant la marque.
export const dansLEspaceRegarde = (db, profile, c) => {
  if (!chantiersDeMonEspace(db, profile).some((x) => x.id === c?.id)) return false;
  const marque = espaceDeLaFiche(c);
  if (marque !== null) return marque === afficheChiffresFormation(db, profile);
  const b = boutiqueDuChantier(db, c);
  return !b || estBoutiqueFormation(db, b) === afficheChiffresFormation(db, profile);
};

// Les chantiers auxquels on peut rattacher une dépense : espace regardé,
// pas encore réceptionnés, frais pas déjà payés. Les plus récents d'abord.
export const chantiersRattachables = (db, profile) => (db.clients_installes || [])
  .filter((c) => dansLEspaceRegarde(db, profile, c) && statutChantier(c) !== "receptionne" && !fraisDejaPayes(c) && !travauxSolde(db, c))
  .sort((a, b) => String(b.date_installation || b.date || "").localeCompare(String(a.date_installation || a.date || "")));

export const fraisDejaPayes = (c) => (c?.equipe || []).some((e) => e.paye && Number(e.montant || 0) > 0);

export const depensesDuChantier = (db, chantierId) => (db.depenses || []).filter((d) => d.chantier_id && d.chantier_id === chantierId);

// Une dépense compte pour la déduction si elle compte tout court : pas en
// attente du DG, pas rejetée (son montant est déjà à 0), montant > 0.
export const depenseCompteAuChantier = (d) => !estEnAttente(d) && !estRejetee(d) && Number(d.montant || 0) !== 0;
// ⚠ 07/10/2026 : `!== 0` et non plus `> 0` — l'argent RENDU d'un chantier est
// une ligne NÉGATIVE (lib/argentChantier.js) : il diminue ce que le chantier a
// coûté, donc ce qu'on retire des frais avant le partage. Une rejetée vaut 0.

export const totalDepensesChantier = (db, chantierId) => Math.max(0, depensesDuChantier(db, chantierId)
  .filter(depenseCompteAuChantier).reduce((s, d) => s + Number(d.montant || 0), 0));

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
  if (travauxSolde(db, chantier)) return "Ces travaux sont soldés : on ne leur rattache plus de dépense.";
  if (fraisDejaPayes(chantier)) return "Les frais d'installation de ce chantier ont déjà été payés aux techniciens : on ne peut plus rien déduire.";
  return null;
};

// ✏️ Changer le chantier d'une dépense déjà saisie (Timo, 07/10/2026 : « on
// peut modifier que pour les dépenses dont les chantiers ne sont pas
// réceptionnés »). L'ANCIEN chantier doit encore être ouvert (sinon sa
// déduction est close, ou ses techniciens ont été payés en la comptant), et le
// NOUVEAU passe par la règle ordinaire du rattachement.
export const critiqueChangementChantier = (db, profile, dep, nouveau) => {
  if (!dep) return "Dépense introuvable.";
  if (String(nouveau?.id || "") === String(dep.chantier_id || "")) return null;
  // 💼 Une somme REMISE à un technicien pour ce chantier (07/10/2026) : il la
  // détaille ou la rend sur CE chantier — la déplacer laisserait ses lignes
  // sans argent en face.
  if (dep.remis_a?.id) return `Cette somme a été remise à ${dep.remis_a.nom || "un technicien"} pour ce chantier : son chantier ne se change pas. Supprimez-la et ressaisissez-la si elle a été mal rattachée.`;
  const ancien = dep.chantier_id ? (db.clients_installes || []).find((c) => c.id === dep.chantier_id) : null;
  if (ancien) {
    const nom = libelleChantier(ancien);
    if (statutChantier(ancien) === "receptionne") return `Le chantier ${nom} est déjà réceptionné : le chantier de cette dépense ne se change plus.`;
    if (travauxSolde(db, ancien)) return `Les travaux ${nom} sont soldés : le chantier de cette dépense ne se change plus.`;
    if (fraisDejaPayes(ancien)) return `Les techniciens du chantier ${nom} ont déjà été payés en comptant cette dépense : son chantier ne se change plus.`;
  }
  return critiqueRattachement(db, profile, dep, nouveau || null);
};

export const rattacherDepense = (dep, chantier) => {
  if (!chantier) { const { chantier_id, chantier_nom, ...reste } = dep; return reste; }
  return { ...dep, chantier_id: chantier.id, chantier_nom: libelleChantier(chantier) };
};
