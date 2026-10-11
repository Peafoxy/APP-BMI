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
// 💸 PUIS POUR TOUTE DÉPENSE (Timo, 10/10/2026 : « pas seulement pour un
// chantier… pour chaque dépense côté gérant ou administrateur, choisir le
// destinataire, et le destinataire justifie pourquoi l'argent lui a été
// remis » → « A b, B b, C a, D a ») :
//   • A b — l'argent se remet à TOUT le personnel de l'espace regardé
//     (personnesProposees), l'équipe du chantier en tête s'il y en a un ;
//   • B b — hors chantier, « Personne » d'office : la case ne se remplit que
//     quand on remet vraiment de l'argent (pour un chantier, le choix reste
//     exigé, décision du 07/10) ; hors chantier, gérant et administrateur ;
//   • C a — la personne explique dans SON onglet « 💼 Argent reçu » ;
//   • D a — hors chantier, chaque remise se compte À PART (un « dossier » par
//     remise) ; pour un chantier, toujours UN total par chantier.
// Un DOSSIER = { chantierId } ou { remiseId } : les lignes de détail et les
// retours d'une remise hors chantier portent `remise_id` (et `remise_libelle`),
// celles d'un chantier `chantier_id` (et `chantier_nom`), comme avant.
// Règles pures : ce fichier n'importe que ce qui dit si une dépense compte.
// ============================================================
import { estEnAttente, estRejetee, PAYE_AVEC_CAISSE, PAYE_AVEC_AVANCE, PAYE_AVEC_COMPTABLE, PAYE_AVEC_FONDS, PAYE_AVEC_DG } from "./validationDepenses.js";
import { CATEGORIE_RETOUR_CHANTIER, CATEGORIE_RETOUR_ARGENT, CATEGORIES_RETOUR_ARGENT } from "./constants.js";
import { fmt } from "./core.js";

const n = (x) => Math.round(Number(x || 0));
const idDe = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const fiche = (u) => ({ justifs: [...(u?.argent_chantier?.justifs || [])], retours: [...(u?.argent_chantier?.retours || [])] });

// Une remise d'argent à CETTE personne, pour CE chantier (rejetée = jamais remise).
export const estRemiseA = (d, techId, chantierId = null) =>
  !!d?.remis_a?.id && d.remis_a.id === techId && !estRejetee(d) && Number(d.montant || 0) > 0
  && (chantierId === null || d.chantier_id === chantierId);
export const estRetourChantier = (d) => CATEGORIES_RETOUR_ARGENT.includes(d?.categorie) && !!d?.retour_chantier;

// ── Les dossiers ──
export const dossierDeRemise = (d) => (d?.chantier_id ? { chantierId: d.chantier_id, remiseId: null } : { chantierId: null, remiseId: d?.id || null });
export const dossierDeLigne = (x) => (x?.remise_id ? { chantierId: null, remiseId: x.remise_id } : { chantierId: x?.chantier_id || null, remiseId: null });
const dansLeDossier = (x, dos) => (dos.remiseId ? x?.remise_id === dos.remiseId : !x?.remise_id && !!dos.chantierId && x?.chantier_id === dos.chantierId);
const cleDossier = (dos) => (dos.remiseId ? `remise:${dos.remiseId}` : `chantier:${dos.chantierId}`);
// Le nom d'une remise hors chantier : ce pour quoi l'argent est sorti.
export const libelleRemise = (d) => (d ? `${d.categorie || "Dépense"}${d.description ? ` — ${d.description}` : ""}` : "");
// Le nom d'un dossier, lu sur une ligne de détail ou de retour.
export const nomDossier = (x) => x?.chantier_nom || x?.remise_libelle || (x?.remise_id ? "argent remis" : "chantier");
const champsDossier = (s) => (s.remiseId
  ? { remise_id: s.remiseId, remise_libelle: s.libelle }
  : { chantier_id: s.chantierId, chantier_nom: s.chantierNom });

// Tout ce que l'application sait de l'argent d'UNE personne sur UN dossier.
export function soldeDossier(depenses, personne, dos) {
  const techId = personne?.id;
  const remises = (depenses || []).filter((d) => estRemiseA(d, techId) && (dos.remiseId ? d.id === dos.remiseId : d.chantier_id === dos.chantierId))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recu = remises.filter((d) => !estEnAttente(d)).reduce((s, d) => s + n(d.montant), 0);
  const enAttenteDG = remises.filter(estEnAttente).reduce((s, d) => s + n(d.montant), 0);
  const retoursValides = (depenses || []).filter((d) => estRetourChantier(d) && d.retour_chantier.tech_id === techId
    && (dos.remiseId ? d.retour_chantier.remise_id === dos.remiseId : !d.retour_chantier.remise_id && d.chantier_id === dos.chantierId));
  const rendu = retoursValides.reduce((s, d) => s - n(d.montant), 0);
  const f = fiche(personne);
  const justifs = f.justifs.filter((j) => dansLeDossier(j, dos));
  const retours = f.retours.filter((r) => dansLeDossier(r, dos));
  const justifie = justifs.reduce((s, j) => s + n(j.montant), 0);
  const retourEnAttente = retours.filter((r) => r.statut === "attente").reduce((s, r) => s + n(r.montant), 0);
  const reste = recu - justifie - rendu - retourEnAttente;
  const chantierNom = dos.chantierId ? (remises[0]?.chantier_nom || justifs[0]?.chantier_nom || retours[0]?.chantier_nom || "") : "";
  const libelle = dos.chantierId ? (chantierNom || "Chantier") : (libelleRemise(remises[0]) || justifs[0]?.remise_libelle || retours[0]?.remise_libelle || "Argent remis");
  return { chantierId: dos.chantierId || null, remiseId: dos.remiseId || null, cle: cleDossier(dos), chantierNom, libelle, remises, recu, enAttenteDG, justifs, justifie, retours, retourEnAttente, rendu, reste };
}
export const soldeArgentChantier = (depenses, technicien, chantierId) => soldeDossier(depenses, technicien, { chantierId, remiseId: null });
export const soldeArgentRemise = (depenses, personne, remiseId) => soldeDossier(depenses, personne, { chantierId: null, remiseId });
export const soldeDuRetour = (depenses, personne, r) => soldeDossier(depenses, personne, dossierDeLigne(r));

const derniere = (s) => s.remises.length ? s.remises[s.remises.length - 1].date || "" : "";

// Tout l'argent qu'une personne a reçu (ou détaillé, ou rendu) : ses chantiers
// et ses remises hors chantier — ce que montre son onglet « 💼 Argent reçu ».
// Ce qui reste à expliquer d'abord, puis le plus récent.
export function argentRecu(depenses, personne) {
  const id = personne?.id;
  const f = fiche(personne);
  const dossiers = new Map();
  const ajouter = (dos) => { if ((dos.chantierId || dos.remiseId) && !dossiers.has(cleDossier(dos))) dossiers.set(cleDossier(dos), dos); };
  (depenses || []).forEach((d) => { if (estRemiseA(d, id)) ajouter(dossierDeRemise(d)); });
  f.justifs.forEach((j) => ajouter(dossierDeLigne(j)));
  f.retours.forEach((r) => ajouter(dossierDeLigne(r)));
  return [...dossiers.values()].map((dos) => soldeDossier(depenses, personne, dos))
    .sort((a, b) => (b.reste > 0) - (a.reste > 0) || String(derniere(b)).localeCompare(String(derniere(a))));
}
// Combien de dossiers attendent encore une explication (le chiffre de l'onglet).
export const nbAExpliquer = (depenses, personne) => argentRecu(depenses, personne).filter((s) => s.reste > 0).length;

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
    ? `Il ne reste que ${fmt(solde.reste)} à justifier sur ${solde.remiseId ? "cette somme" : "ce chantier"}.`
    : `Tout l'argent reçu pour ${solde.remiseId ? "cette somme" : "ce chantier"} est déjà justifié ou rendu.`;
  return null;
}
export const ajouterJustif = (technicien, solde, { categorie, description, montant, date }, le) => {
  const f = fiche(technicien);
  f.justifs.push({ id: idDe(), ...champsDossier(solde), date: date || le,
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
  f.retours.push({ id: idDe(), ...champsDossier(solde), montant: n(montant), le, statut: "attente" });
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
  // Hors chantier : « Argent rendu », sans chantier ; le retour dit quelle remise.
  const depense = {
    id: idDe(), date: le, heure, boutique: caisse.boutique, categorie: r.remise_id ? CATEGORIE_RETOUR_ARGENT : CATEGORIE_RETOUR_CHANTIER,
    description: `Rendu par ${technicien.nom} — ${nomDossier(r)}`,
    montant: -n(r.montant), paiement: caisse.paiement, paye_avec: caisse.paye_avec,
    par: profile.nom, par_id: profile.id, auto: "retour_chantier",
    ...(r.remise_id ? {} : { chantier_id: r.chantier_id, chantier_nom: r.chantier_nom }),
    retour_chantier: { id: r.id, tech_id: technicien.id, tech_nom: technicien.nom, ...(r.remise_id ? { remise_id: r.remise_id } : {}) },
  };
  f.retours = f.retours.map((x) => (x.id === retourId ? { ...x, statut: "validee", decide_le: le, decide_par: profile.nom, depense_id: depense.id, caisse: libelleCaisseRetour(caisse) } : x));
  return { technicien: { ...technicien, argent_chantier: f }, depense,
    journal: `Argent rendu validé : ${fmt(n(r.montant))} par ${technicien.nom} (${nomDossier(r)}) → ${libelleCaisseRetour(caisse)}` };
}

export function refuserRetour(profile, technicien, retourId, motif, le) {
  const f = fiche(technicien);
  const r = f.retours.find((x) => x.id === retourId);
  f.retours = f.retours.map((x) => (x.id === retourId ? { ...x, statut: "rejetee", decide_le: le, decide_par: profile.nom, motif: String(motif).trim() } : x));
  return { technicien: { ...technicien, argent_chantier: f },
    journal: `Argent rendu refusé : ${fmt(n(r?.montant))} annoncés par ${technicien.nom} (${nomDossier(r)}) — ${String(motif).trim()}` };
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
  const s = soldeDossier(depenses, tech, dossierDeRemise(d));
  const sansElle = s.recu - (estEnAttente(d) ? 0 : n(d.montant));
  const engage = s.justifie + s.rendu + s.retourEnAttente;
  if (engage > sansElle) return `🔒 Cette somme a été remise à ${tech.nom}, qui a déjà justifié ou rendu ${fmt(engage)} ${d.chantier_id ? "sur ce chantier" : "sur elle"}.\n\nLa supprimer laisserait ses justifications sans argent en face. Demandez-lui d'abord de retirer ses lignes de détail.`;
  return null;
}

// À qui l'argent peut être remis. ~~Les techniciens seulement~~ — RETOURNÉ le
// 10/10/2026 (« A b ») : TOUT le personnel de l'espace regardé, jamais un
// client, jamais un compte désactivé, jamais soi-même ; pour un chantier, son
// équipe en tête (rangée par nom), puis les autres.
// `personnes` = la liste DÉJÀ filtrée par l'espace (utilisateursDeLEspace).
export const estDeLEquipe = (chantier, u) => (chantier?.equipe || []).some((e) => e.user_id && e.user_id === u?.id);
export function personnesProposees(personnes, chantier, moi = null) {
  const parNom = (a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" });
  const staff = (personnes || []).filter((u) => u?.role && u.role !== "client" && u.actif !== false && u.id !== moi?.id);
  return [...staff.filter((u) => estDeLEquipe(chantier, u)).sort(parNom), ...staff.filter((u) => !estDeLEquipe(chantier, u)).sort(parNom)];
}
// La réponse « personne » : la dépense a été payée directement (rien à justifier).
export const REMIS_A_PERSONNE = "aucun";
// « B b » : hors chantier, la case est facultative (« Personne » d'office) et
// réservée au gérant et à l'administrateur ; pour un chantier, le choix reste exigé.
export const ROLES_REMISE_HORS_CHANTIER = ["admin", "gerant"];
export const peutRemettreHorsChantier = (profile) => ROLES_REMISE_HORS_CHANTIER.includes(profile?.role);
export function critiqueRemisA(chantier, choix, proposes, profile = null) {
  if (!choix) return chantier ? "Choisissez la personne qui reçoit l'argent du chantier — ou « Personne » si vous avez payé directement." : null;
  if (choix === REMIS_A_PERSONNE) return null;
  if (!chantier && profile && !peutRemettreHorsChantier(profile)) return "Remettre de l'argent à quelqu'un hors chantier, c'est le geste du gérant ou de l'administrateur.";
  if (!(proposes || []).some((u) => u.id === choix)) return "Cette personne n'est plus proposée.";
  return null;
}
