// ============================================================
// lib/interventions.js — LE JOURNAL DES INTERVENTIONS SUR UNE INSTALLATION
//
// Timo, 17/11/2026 : « Intervention sur les installations… une rubrique pour
// noter les interventions effectuées : la panne, la raison probable de son
// apparition et la solution apportée. » Puis : « alerter le client de la
// panne et de sa résolution », « avoir les statistiques aussi », « sans
// intervention ouverte, on peut envoyer le message solution résolue ».
// Ses décisions : 1 qui note = l'équipe du chantier, son chef, l'administrateur,
// le responsable commercial ; 2 qui lit = les mêmes plus le gérant de la
// boutique ; 3 l'entretien reste un geste à part ; 4 les 🛠 travaux aussi ;
// A la cause probable reste INTERNE (jamais dans un message au client) ;
// B les statistiques : administrateur, responsable commercial, gérant (sa
// boutique seule).
//
// Une intervention vit SUR LA FICHE de l'installation (`interventions`, une
// liste qui ne fait que grandir). Deux temps : OUVERTE (la panne est notée) puis
// RÉSOLUE (la solution s'ajoute, une seule fois) — ou résolue d'un coup quand la
// solution est donnée dès la saisie. Une erreur se corrige par une ligne de
// plus, jamais par un effacement.
//
// ⚠ Ce fichier n'importe RIEN et ne reçoit jamais `db` : l'écran lui passe les
// listes déjà filtrées par l'espace regardé (le mur).
// ============================================================

export const ELEMENTS_EN_CAUSE = [
  { id: "panneaux", libelle: "Panneaux solaires" },
  { id: "batterie", libelle: "Batterie" },
  { id: "convertisseur", libelle: "Convertisseur / onduleur" },
  { id: "regulateur", libelle: "Régulateur" },
  { id: "cablage", libelle: "Câblage et protections" },
  { id: "pompe", libelle: "Pompe" },
  { id: "portail", libelle: "Portail et moteur" },
  { id: "autre", libelle: "Autre" },
];
export const libelleElement = (id) => (ELEMENTS_EN_CAUSE.find((e) => e.id === id) || {}).libelle || "";

export const PANNE_MAX = 300;
export const CAUSE_MAX = 300;
export const SOLUTION_MAX = 300;
export const MATERIEL_MAX = 150;

const texte = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const jourValide = (s) => String(s || "").length === 10 && Number.isFinite(Date.parse(`${s}T00:00:00Z`));

export const ROLES_TOUTE_INSTALLATION = ["admin", "resp_commercial"];

// Les interventions d'une fiche (jamais autre chose qu'une liste).
export const interventionsDe = (chantier) => (Array.isArray(chantier && chantier.interventions) ? chantier.interventions : []);
export const estResolue = (i) => !!i && i.statut === "resolue";
export const estOuverte = (i) => !!i && i.statut !== "resolue";

const dansLEquipe = (chantier, profile) => (Array.isArray(chantier && chantier.equipe) ? chantier.equipe : []).some((e) => e && e.user_id && e.user_id === (profile && profile.id));

// 1 — QUI NOTE : l'équipe de CE chantier (le chef en fait partie),
// l'administrateur, le responsable commercial. Jamais un technicien qui n'y a
// pas travaillé, jamais un compte en lecture seule ni un client.
export function motifRefusNote(chantier, profile) {
  if (!chantier) return "Installation introuvable.";
  if (!profile || profile.role === "client") return "🔒 Les interventions ne se notent pas depuis un compte client.";
  if (ROLES_TOUTE_INSTALLATION.includes(profile.role)) return "";
  if (dansLEquipe(chantier, profile)) return "";
  return "🔒 Seuls l'équipe de ce chantier, l'administrateur et le responsable commercial peuvent noter une intervention.";
}
export const peutNoter = (chantier, profile) => motifRefusNote(chantier, profile) === "";

// 2 — QUI LIT : les mêmes, plus le gérant DE LA BOUTIQUE de l'installation.
// `boutique` = le nom de la boutique du chantier, calculé par l'écran.
export function peutLire(chantier, profile, boutique) {
  if (!chantier || !profile || profile.role === "client") return false;
  if (peutNoter(chantier, profile)) return true;
  return profile.role === "gerant" && !!boutique && boutique === profile.boutique;
}

// B — QUI VOIT LES STATISTIQUES : l'administrateur, le responsable commercial,
// le gérant (l'écran ne lui donne que les installations de SA boutique).
export const ROLES_STATISTIQUES = ["admin", "resp_commercial", "gerant"];
export const peutVoirStatistiques = (profile) => !!profile && ROLES_STATISTIQUES.includes(profile.role);

const identifiant = (jour) => `int_${String(jour || "").replace(/\D/g, "")}_${Math.random().toString(36).slice(2, 8)}`;

// Ce qui est saisi, remis au propre. « » si tout tient debout ; sinon la phrase
// qui dit quoi corriger (rien n'est écarté en silence).
export function critiqueIntervention(f) {
  const s = f && typeof f === "object" ? f : {};
  if (!jourValide(s.date)) return "Indiquez la date de l'intervention.";
  if (!texte(s.panne, PANNE_MAX)) return "Décrivez la panne constatée.";
  if (!ELEMENTS_EN_CAUSE.some((e) => e.id === s.element)) return "Choisissez l'élément en cause dans la liste.";
  if (!texte(s.technicien_nom, 80)) return "Indiquez le technicien en charge.";
  if (String(s.solution_date || "") && !jourValide(s.solution_date)) return "La date de résolution est illisible.";
  return "";
}

// L'intervention fabriquée. Avec une solution : elle naît RÉSOLUE (un seul
// message part, « résolue » — décision de Timo). Sans : OUVERTE.
export function nouvelleIntervention(f, profile, jour) {
  const solution = texte(f.solution, SOLUTION_MAX);
  const base = {
    id: identifiant(jour),
    date: f.date,
    panne: texte(f.panne, PANNE_MAX),
    element: f.element,
    cause: texte(f.cause, CAUSE_MAX),
    technicien_id: f.technicien_id || "",
    technicien_nom: texte(f.technicien_nom, 80),
    note_par: (profile && profile.nom) || "",
    note_par_id: (profile && profile.id) || "",
    note_le: jour || f.date,
    statut: "ouverte",
  };
  const materiel = texte(f.materiel, MATERIEL_MAX);
  if (materiel) base.materiel = materiel;
  if (solution) {
    return { ...base, statut: "resolue", solution, resolu_le: jourValide(f.solution_date) ? f.solution_date : f.date, resolu_par: (profile && profile.nom) || "", resolu_par_id: (profile && profile.id) || "" };
  }
  return base;
}

// Résoudre une intervention OUVERTE : une seule fois. « » si permis.
export function critiqueResolution(intervention, { solution, date } = {}) {
  if (!intervention) return "Intervention introuvable.";
  if (estResolue(intervention)) return "Cette intervention est déjà résolue : une erreur se corrige par une nouvelle intervention.";
  if (!texte(solution, SOLUTION_MAX)) return "Décrivez la solution apportée.";
  if (!jourValide(date)) return "Indiquez la date de résolution.";
  return "";
}
export function resoudreIntervention(intervention, { solution, date, materiel }, profile) {
  const m = texte(materiel, MATERIEL_MAX);
  return {
    ...intervention,
    ...(m ? { materiel: m } : {}),
    statut: "resolue",
    solution: texte(solution, SOLUTION_MAX),
    resolu_le: date,
    resolu_par: (profile && profile.nom) || "",
    resolu_par_id: (profile && profile.id) || "",
  };
}

// La fiche avec une intervention de plus (la liste ne rétrécit JAMAIS).
export const avecIntervention = (chantier, intervention) => ({ ...chantier, interventions: [...interventionsDe(chantier), intervention] });
export const avecResolution = (chantier, id, resolue) => ({ ...chantier, interventions: interventionsDe(chantier).map((i) => (i.id === id ? resolue : i)) });

// Du plus récent au plus ancien (date de l'intervention, puis ordre de saisie).
export function interventionsRecentes(chantier) {
  return interventionsDe(chantier).map((i, rang) => ({ i, rang }))
    .sort((a, b) => String(b.i.date || "").localeCompare(String(a.i.date || "")) || b.rang - a.rang)
    .map((x) => x.i);
}

export const resumeInterventions = (chantier) => {
  const l = interventionsDe(chantier);
  const ouvertes = l.filter(estOuverte).length;
  return { total: l.length, ouvertes, resolues: l.length - ouvertes };
};

// ---- Les statistiques ---------------------------------------------------
const joursEntreDates = (a, b) => {
  const x = Date.parse(`${a}T00:00:00Z`); const y = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((y - x) / 86400000) : null;
};

// `chantiers` = les installations que l'écran a le droit de montrer (espace
// regardé ; la boutique du gérant). `dans(date)` = le filtre de période.
// Compte les interventions DONT LA DATE tombe dans la période.
export function statistiquesInterventions(chantiers, dans = () => true) {
  const lignes = [];
  for (const c of Array.isArray(chantiers) ? chantiers : []) {
    for (const i of interventionsDe(c)) if (dans(i.date)) lignes.push({ c, i });
  }
  const total = lignes.length;
  const resolues = lignes.filter((x) => estResolue(x.i)).length;
  const parElement = {};
  const parTech = {};
  const parInstallation = {};
  const delais = [];
  for (const { c, i } of lignes) {
    parElement[i.element] = (parElement[i.element] || 0) + 1;
    const cle = i.technicien_id || i.technicien_nom || "—";
    if (!parTech[cle]) parTech[cle] = { nom: i.technicien_nom || "—", total: 0, resolues: 0 };
    parTech[cle].total += 1;
    if (estResolue(i)) parTech[cle].resolues += 1;
    if (!parInstallation[c.id]) parInstallation[c.id] = { id: c.id, nom: `${c.prenom || ""} ${c.nom || ""}`.trim(), total: 0 };
    parInstallation[c.id].total += 1;
    if (estResolue(i)) { const d = joursEntreDates(i.date, i.resolu_le); if (d !== null && d >= 0) delais.push(d); }
  }
  return {
    total, resolues, ouvertes: total - resolues,
    elements: Object.entries(parElement).map(([id, n]) => ({ id, libelle: libelleElement(id) || id, n })).sort((a, b) => b.n - a.n || a.libelle.localeCompare(b.libelle, "fr")),
    delaiMoyenJours: delais.length ? Math.round((delais.reduce((s, d) => s + d, 0) / delais.length) * 10) / 10 : null,
    techniciens: Object.values(parTech).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr")),
    recurrentes: Object.values(parInstallation).filter((x) => x.total > 1).sort((a, b) => b.total - a.total || a.nom.localeCompare(b.nom, "fr")),
  };
}

// ---- Les téléchargements (17/11/2026, « les deux, lance… en plus du fichier
// qu'on peut remettre au client, un téléchargement pour l'administration, sur
// lequel il y aura la cause probable ») ----------------------------------------
// DEUX documents PDF par installation : la version CLIENT (jamais la cause
// probable — elle est interne) et la version ADMINISTRATION (avec la cause, à ne
// pas remettre). Un export Excel de la période pour ceux qui voient 📊 Pannes.
// Les lignes sont fabriquées ICI, une fois : le PDF et l'Excel ne calculent rien.

// Qui peut télécharger la version AVEC la cause : ceux qui voient les
// statistiques (administrateur, responsable commercial, gérant). L'équipe du
// chantier, elle, n'a que la version client.
export const peutTelechargerAvecCause = (profile) => peutVoirStatistiques(profile);

const ouVide = (x) => String(x || "").trim() || "-";
const solutionEtMateriel = (i) => {
  const s = String(i.solution || "").trim();
  const m = String(i.materiel || "").trim();
  if (!s && !m) return "-";
  return [s, m ? `Matériel : ${m}` : ""].filter(Boolean).join(" - ");
};

// `dFR` est passé par l'appelant (ce fichier n'importe rien).
export function historiqueInstallation(chantier, { avecCause = false, dFR = (x) => x } = {}) {
  const liste = interventionsRecentes(chantier);
  const entetes = ["Date", "Élément", "Panne", ...(avecCause ? ["Cause probable"] : []), "Technicien", "Solution", "État"];
  const lignes = liste.map((i) => [
    dFR(i.date), libelleElement(i.element) || "-", ouVide(i.panne),
    ...(avecCause ? [ouVide(i.cause)] : []),
    ouVide(i.technicien_nom), solutionEtMateriel(i),
    estResolue(i) ? `Résolue le ${dFR(i.resolu_le || i.date)}` : "En cours",
  ]);
  const s = statistiquesInterventions([chantier]);
  return { entetes, lignes, resume: { total: s.total, resolues: s.resolues, ouvertes: s.ouvertes, delaiMoyenJours: s.delaiMoyenJours } };
}

// L'export Excel de la période : UNE ligne par intervention, la cause comprise
// (réservé à ceux qui voient les statistiques). `chantiers` = déjà filtrés par
// l'écran (espace regardé, boutique du gérant) ; `dans(date)` = la période.
export const ENTETES_EXPORT_INTERVENTIONS = ["Client", "Installation", "Boutique", "Date", "Élément", "Panne", "Cause probable", "Technicien", "Matériel", "Solution", "État", "Résolue le", "Délai (jours)"];
export function lignesExportInterventions(chantiers, { dans = () => true, dFR = (x) => x, boutiqueDe = () => "" } = {}) {
  const lignes = [];
  for (const c of Array.isArray(chantiers) ? chantiers : []) {
    for (const i of interventionsDe(c)) {
      if (!dans(i.date)) continue;
      const delai = estResolue(i) ? joursEntreDates(i.date, i.resolu_le) : null;
      lignes.push({ tri: String(i.date || ""), ligne: [
        `${c.prenom || ""} ${c.nom || ""}`.trim() || "-", c.type_installation || "-", boutiqueDe(c) || "-",
        dFR(i.date), libelleElement(i.element) || "-", ouVide(i.panne), ouVide(i.cause),
        ouVide(i.technicien_nom), ouVide(i.materiel), ouVide(i.solution),
        estResolue(i) ? "Résolue" : "En cours", estResolue(i) ? dFR(i.resolu_le || i.date) : "",
        delai !== null && delai >= 0 ? delai : "",
      ] });
    }
  }
  return lignes.sort((a, b) => b.tri.localeCompare(a.tri)).map((x) => x.ligne);
}
