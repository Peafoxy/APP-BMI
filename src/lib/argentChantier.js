// ============================================================
// lib/argentChantier.js — L'ARGENT REMIS À UN TECHNICIEN POUR UN CHANTIER
//
// Timo (07/10/2026) : « le gérant, ou l'administrateur qui donne de l'argent
// lié à un chantier, lui-même ne peut pas détailler ce que l'argent a servi à
// faire… lorsqu'on choisit un chantier, il faut choisir aussi le technicien
// qui reçoit l'argent… ce technicien, dans son espace, peut détailler les
// dépenses effectuées ». Puis : « b » (un TOTAL par chantier, pas une ligne
// par remise), « s'il reste, il faut rendre le reste et la caisse de sortie
// est immédiatement créditée lorsque le gérant valide la somme rendue »,
// l'équipe du chantier proposée d'abord, et le détail possible tant qu'il
// reste quelque chose à justifier.
//
// Trois choses, rangées à trois endroits :
//   • la REMISE = une dépense ordinaire (caisse, validation du DG, déduction
//     des frais du chantier) qui porte en plus `remis_a: { id, nom }` ;
//   • le DÉTAIL et les DEMANDES DE RETOUR vivent sur la fiche du technicien
//     (`argent_chantier: { justifs, retours }`) — une justification n'est
//     JAMAIS une dépense de plus : l'argent est déjà sorti une fois ;
//   • le RETOUR VALIDÉ = une dépense NÉGATIVE (CATEGORIE_RETOUR_CHANTIER) sur
//     la caisse qui avait payé : c'est elle qui crédite la caisse, et qui
//     diminue la charge du chantier. Tant que le gérant n'a pas validé, rien
//     ne bouge dans aucune caisse.
// Règles pures : ce fichier n'importe que ce qui dit si une dépense compte.
// ============================================================
import { estEnAttente, estRejetee, PAYE_AVEC_CAISSE, PAYE_AVEC_AVANCE, PAYE_AVEC_COMPTABLE, PAYE_AVEC_FONDS, PAYE_AVEC_DG } from "./validationDepenses.js";
import { CATEGORIE_RETOUR_CHANTIER } from "./constants.js";
import { fmt } from "./core.js";

const n = (x) => Math.round(Number(x || 0));
const idDe = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const fiche = (u) => ({ justifs: [...(u?.argent_chantier?.justifs || [])], retours: [...(u?.argent_chantier?.retours || [])] });

// Une remise d'argent à CE technicien, pour CE chantier (rejetée = jamais remise).
export const estRemiseA = (d, techId, chantierId = null) =>
  !!d?.remis_a?.id && d.remis_a.id === techId && !estRejetee(d) && Number(d.montant || 0) > 0
  && (chantierId === null || d.chantier_id === chantierId);
export const estRetourChantier = (d) => d?.categorie === CATEGORIE_RETOUR_CHANTIER && !!d?.retour_chantier;

// Tout ce que l'application sait de l'argent d'UN technicien sur UN chantier.
export function soldeArgentChantier(depenses, technicien, chantierId) {
  const techId = technicien?.id;
  const remises = (depenses || []).filter((d) => estRemiseA(d, techId, chantierId))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recu = remises.filter((d) => !estEnAttente(d)).reduce((s, d) => s + n(d.montant), 0);
  const enAttenteDG = remises.filter(estEnAttente).reduce((s, d) => s + n(d.montant), 0);
  const retoursValides = (depenses || []).filter((d) => estRetourChantier(d) && d.retour_chantier.tech_id === techId && d.chantier_id === chantierId);
  const rendu = retoursValides.reduce((s, d) => s - n(d.montant), 0);
  const f = fiche(technicien);
  const justifs = f.justifs.filter((j) => j.chantier_id === chantierId);
  const retours = f.retours.filter((r) => r.chantier_id === chantierId);
  const justifie = justifs.reduce((s, j) => s + n(j.montant), 0);
  const retourEnAttente = retours.filter((r) => r.statut === "attente").reduce((s, r) => s + n(r.montant), 0);
  const reste = recu - justifie - rendu - retourEnAttente;
  const chantierNom = remises[0]?.chantier_nom || justifs[0]?.chantier_nom || retours[0]?.chantier_nom || "";
  return { chantierId, chantierNom, remises, recu, enAttenteDG, justifs, justifie, retours, retourEnAttente, rendu, reste };
}

const derniere = (s) => s.remises.length ? s.remises[s.remises.length - 1].date || "" : "";

// Les chantiers où ce technicien a reçu de l'argent (ou détaillé, ou rendu).
export function argentParChantier(depenses, technicien) {
  const techId = technicien?.id;
  const f = fiche(technicien);
  const ids = new Set();
  (depenses || []).forEach((d) => { if (estRemiseA(d, techId)) ids.add(d.chantier_id); });
  f.justifs.forEach((j) => ids.add(j.chantier_id));
  f.retours.forEach((r) => ids.add(r.chantier_id));
  return [...ids].filter(Boolean).map((id) => soldeArgentChantier(depenses, technicien, id))
    .sort((a, b) => (b.reste > 0) - (a.reste > 0) || String(derniere(b)).localeCompare(String(derniere(a))));
}

// Les techniciens que l'argent d'un chantier a touchés (pour la fiche du chantier).
export const techniciensDuChantier = (depenses, personnes, chantierId) => {
  const ids = new Set((depenses || []).filter((d) => d?.remis_a?.id && d.chantier_id === chantierId && !estRejetee(d)).map((d) => d.remis_a.id));
  (personnes || []).forEach((u) => {
    const f = fiche(u);
    if (f.justifs.some((j) => j.chantier_id === chantierId) || f.retours.some((r) => r.chantier_id === chantierId)) ids.add(u.id);
  });
  return (personnes || []).filter((u) => ids.has(u.id));
};

// ── Le détail (« b » : sur le total du chantier) ──
export function critiqueJustif(solde, { categorie, montant } = {}) {
  const m = Number(montant);
  if (!String(categorie || "").trim()) return "Choisissez à quoi l'argent a servi.";
  if (!Number.isFinite(m) || m <= 0) return "Indiquez un montant (plus que zéro).";
  if (m > solde.reste) return solde.reste > 0
    ? `Il ne reste que ${fmt(solde.reste)} à justifier sur ce chantier.`
    : "Tout l'argent reçu pour ce chantier est déjà justifié ou rendu.";
  return null;
}
export const ajouterJustif = (technicien, solde, { categorie, description, montant, date }, le) => {
  const f = fiche(technicien);
  f.justifs.push({ id: idDe(), chantier_id: solde.chantierId, chantier_nom: solde.chantierNom, date: date || le,
    categorie: String(categorie).trim(), description: String(description || "").trim(), montant: n(montant), le });
  return { ...technicien, argent_chantier: f };
};
// Une ligne de détail se retire tant que l'argent n'est pas entièrement rendu.
export const retirerJustif = (technicien, justifId) => {
  const f = fiche(technicien);
  return { ...technicien, argent_chantier: { ...f, justifs: f.justifs.filter((j) => j.id !== justifId) } };
};

// ── Rendre le reste ──
export function critiqueDemandeRetour(solde, montant) {
  const m = Number(montant);
  if (!Number.isFinite(m) || m <= 0) return "Indiquez la somme que vous rendez.";
  if (m > solde.reste) return `Vous ne pouvez rendre que ce qui reste : ${fmt(solde.reste)}.`;
  return null;
}
export const demanderRetour = (technicien, solde, montant, le) => {
  const f = fiche(technicien);
  f.retours.push({ id: idDe(), chantier_id: solde.chantierId, chantier_nom: solde.chantierNom, montant: n(montant), le, statut: "attente" });
  return { ...technicien, argent_chantier: f };
};

// Les caisses où l'argent peut revenir : celles qui l'ont donné. ⚠ Une avance
// de poche ou la caisse du comptable ne se recréditent pas d'ici (l'une se
// rembourse dans 🔒 Caisse, l'autre se pointe) : l'argent revient alors au
// TIROIR de la boutique de la remise. L'enveloppe du fonds de caisse aussi.
const cleCaisse = (c) => `${c.boutique}|${c.paiement}|${c.paye_avec}`;
export function caissesDuRetour(solde) {
  const vues = new Map();
  [...solde.remises].reverse().forEach((d) => {
    const versTiroir = [PAYE_AVEC_AVANCE, PAYE_AVEC_COMPTABLE, PAYE_AVEC_FONDS].includes(d.paye_avec);
    const c = versTiroir
      ? { boutique: d.boutique, paiement: "Espèces", paye_avec: PAYE_AVEC_CAISSE }
      : { boutique: d.boutique, paiement: d.paiement || "Espèces", paye_avec: d.paye_avec || PAYE_AVEC_CAISSE };
    if (!vues.has(cleCaisse(c))) vues.set(cleCaisse(c), c);
  });
  return [...vues.values()];
}
export const libelleCaisseRetour = (c) => (c.paye_avec === PAYE_AVEC_DG
  ? `Chez le DG (${c.paiement})`
  : `La caisse de ${c.boutique} (${c.paiement})`);

// Qui valide : l'administrateur, ou le gérant de la boutique dont la caisse
// est créditée. L'argent du DG revient au DG : l'administrateur seul.
export const peutValiderRetour = (profile, caisse) => profile?.role === "admin"
  || (profile?.role === "gerant" && caisse?.paye_avec !== PAYE_AVEC_DG && !!profile.boutique && profile.boutique === caisse?.boutique);

export function critiqueValidationRetour(profile, technicien, retourId, caisse) {
  const r = fiche(technicien).retours.find((x) => x.id === retourId);
  if (!r) return "Cette demande n'existe plus.";
  if (r.statut !== "attente") return "Cette demande a déjà été traitée.";
  if (!caisse) return "Choisissez la caisse qui reçoit l'argent.";
  if (!peutValiderRetour(profile, caisse)) return "Seuls l'administrateur et le gérant de la boutique qui reçoit l'argent valident un retour.";
  return null;
}

// La validation : la demande passe « validée », et la dépense NÉGATIVE crédite
// la caisse sur-le-champ.
export function validerRetour(profile, technicien, retourId, caisse, le, heure = "") {
  const f = fiche(technicien);
  const r = f.retours.find((x) => x.id === retourId);
  const depense = {
    id: idDe(), date: le, heure, boutique: caisse.boutique, categorie: CATEGORIE_RETOUR_CHANTIER,
    description: `Rendu par ${technicien.nom} — ${r.chantier_nom || "chantier"}`,
    montant: -n(r.montant), paiement: caisse.paiement, paye_avec: caisse.paye_avec,
    par: profile.nom, par_id: profile.id, auto: "retour_chantier",
    chantier_id: r.chantier_id, chantier_nom: r.chantier_nom,
    retour_chantier: { id: r.id, tech_id: technicien.id, tech_nom: technicien.nom },
  };
  f.retours = f.retours.map((x) => (x.id === retourId ? { ...x, statut: "validee", decide_le: le, decide_par: profile.nom, depense_id: depense.id, caisse: libelleCaisseRetour(caisse) } : x));
  return { technicien: { ...technicien, argent_chantier: f }, depense,
    journal: `Argent rendu validé : ${fmt(n(r.montant))} par ${technicien.nom} (${r.chantier_nom || "chantier"}) → ${libelleCaisseRetour(caisse)}` };
}

export function refuserRetour(profile, technicien, retourId, motif, le) {
  const f = fiche(technicien);
  const r = f.retours.find((x) => x.id === retourId);
  f.retours = f.retours.map((x) => (x.id === retourId ? { ...x, statut: "rejetee", decide_le: le, decide_par: profile.nom, motif: String(motif).trim() } : x));
  return { technicien: { ...technicien, argent_chantier: f },
    journal: `Argent rendu refusé : ${fmt(n(r?.montant))} annoncés par ${technicien.nom} (${r?.chantier_nom || "chantier"}) — ${String(motif).trim()}` };
}

// Les demandes de retour en attente, pour l'écran de qui valide.
export const retoursEnAttente = (personnes) => (personnes || []).flatMap((u) =>
  fiche(u).retours.filter((r) => r.statut === "attente").map((r) => ({ technicien: u, retour: r })));

// ⚠ Supprimer une remise ferait passer le reste en NÉGATIF si le technicien
// a déjà justifié ou rendu plus que ce qui resterait : on le refuse.
export function refusSuppressionRemise(depenses, personnes, d) {
  if (!d?.remis_a?.id) return null;
  const tech = (personnes || []).find((u) => u.id === d.remis_a.id);
  if (!tech) return null;
  const s = soldeArgentChantier(depenses, tech, d.chantier_id);
  const sansElle = s.recu - (estEnAttente(d) ? 0 : n(d.montant));
  const engage = s.justifie + s.rendu + s.retourEnAttente;
  if (engage > sansElle) return `🔒 Cette somme a été remise à ${tech.nom}, qui a déjà justifié ou rendu ${fmt(engage)} sur ce chantier.\n\nLa supprimer laisserait ses justifications sans argent en face. Demandez-lui d'abord de retirer ses lignes de détail.`;
  return null;
}

// À qui l'argent peut être remis (« b oui ») : l'équipe du chantier d'abord ;
// tant qu'elle n'est pas choisie, tous les techniciens de l'espace regardé.
// `personnes` = la liste DÉJÀ filtrée par l'espace (utilisateursDeLEspace).
export const ROLES_TECHNICIENS = ["technicien", "technicien_bmi"];
export function techniciensProposes(personnes, chantier) {
  const techs = (personnes || []).filter((u) => ROLES_TECHNICIENS.includes(u.role) && u.actif !== false);
  const equipe = new Set((chantier?.equipe || []).map((e) => e.user_id).filter(Boolean));
  const dansEquipe = techs.filter((u) => equipe.has(u.id));
  return dansEquipe.length ? dansEquipe : techs;
}
// La réponse « personne » : la dépense a été payée directement (rien à justifier).
export const REMIS_A_PERSONNE = "aucun";
export function critiqueRemisA(chantier, choix, proposes) {
  if (!chantier) return null;
  if (!choix) return "Choisissez le technicien qui reçoit l'argent du chantier — ou « Personne » si vous avez payé directement.";
  if (choix === REMIS_A_PERSONNE) return null;
  if (!(proposes || []).some((u) => u.id === choix)) return "Ce technicien n'est plus proposé pour ce chantier.";
  return null;
}
