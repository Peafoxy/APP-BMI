// ============================================================
// lib/cnss.js — Déclaration des Rémunérations et des Cotisations
// (DRC), en vigueur depuis janvier 2024 à la CNSS Togo (remplace
// l'ancienne DNR trimestrielle). Format Excel calqué EXACTEMENT
// sur le guide officiel « GUIDE-EXCEL_DRC.pdf » (CNSS, décembre
// 2023, version 1.0) — colonnes A à O, tableaux de codes 1/2/3.
//
// ⚠ Ce guide décrit le format attendu ; nous n'avons pas eu accès
// au fichier-modèle .xlsx lui-même. Avant un premier envoi réel,
// comparer un export généré ici avec le modèle téléchargeable
// depuis l'espace DRC (services.cnss.tg) ou vérifier avec un
// comptable togolais.
// ============================================================
import * as XLSX from "xlsx";

// ---- Tableau 1 : Codes Type Assuré ----
export const CODES_TYPE_ASSURE = [
  { code: 1, libelle: "Normal/CDI" },
  { code: 2, libelle: "Fonctionnaire détaché" },
  { code: 3, libelle: "Retraite complémentaire des cadres" },
  { code: 4, libelle: "Apprenti" },
  { code: 5, libelle: "Temporaire/CDD" },
  { code: 6, libelle: "Travailleur en zone franche" },
  { code: 7, libelle: "Assuré IPRAO" },
  { code: 8, libelle: "Assuré caisse étrangère" },
  { code: 9, libelle: "Assuré volontaire" },
  { code: 10, libelle: "Agent permanent de l'État" },
  { code: 11, libelle: "Travailleur PROVONAT/ANPE" },
  { code: 12, libelle: "Stagiaire" },
  { code: 13, libelle: "Travailleur exempté PVID" },
  { code: 14, libelle: "Indépendant" },
  { code: 15, libelle: "Secteur informel" },
  { code: 16, libelle: "Ministre du culte" },
  { code: 17, libelle: "Secteur agricole" },
];

// ---- Tableau 2 : Codes Nature Rémunération ----
export const CODES_NATURE_REMUN = [
  { code: 1, libelle: "Ordinaire" },
  { code: 2, libelle: "Indemnités de départ à la retraite" },
  { code: 3, libelle: "Gratification" },
  { code: 4, libelle: "Treizième mois" },
  { code: 5, libelle: "Rémunération service militaire" },
  { code: 6, libelle: "Salaire de convention" },
  { code: 7, libelle: "Prime de rendement" },
  { code: 8, libelle: "Heures supplémentaires" },
  { code: 9, libelle: "Indemnités de licenciement" },
  { code: 10, libelle: "Congés payés" },
  { code: 11, libelle: "Indemnités de décès" },
  { code: 12, libelle: "Indemnités de bonne séparation" },
  { code: 13, libelle: "Rappel de salaire" },
  { code: 14, libelle: "Avantages en nature" },
];

// ---- Tableau 3 : Codes Motif de sortie ----
export const CODES_MOTIF_SORTIE = [
  { code: 101, libelle: "Affectation" }, { code: 102, libelle: "Démission" },
  { code: 103, libelle: "Licenciement" }, { code: 104, libelle: "Décès" },
  { code: 105, libelle: "Invalidité" }, { code: 106, libelle: "Rattachement CRT" },
  { code: 107, libelle: "Chômage" }, { code: 108, libelle: "Retraite" },
  { code: 201, libelle: "Dépôt de bilan" }, { code: 202, libelle: "Liquidation" },
  { code: 203, libelle: "Cessation d'activité de l'entreprise" }, { code: 204, libelle: "Fin de contrat" },
  { code: 205, libelle: "Suspension provisoire" }, { code: 206, libelle: "Suspension pour absence de mouvement sur le compte" },
];

// Taux officiels (guide CNSS, déc. 2023) — appliqués à la rémunération déclarée.
export const TAUX_CNSS = { RP: 0.02, PF: 0.03, PV: 0.165, AMU: 0.10 };

// ⚠ Répartition employeur / salarié DANS ces mêmes taux (source : page
// « Recouvrement » de la CNSS + CGAMU de l'AMU, vérifiée par recherche le
// jour de la demande de Timo) :
//   - RP (2%) et PF (3%) : intégralement à la charge de l'EMPLOYEUR.
//   - PV (16,5%) : 12,5% employeur + 4% salarié.
//   - AMU (10%) : 5% employeur + 5% salarié.
// Total salarié = 4% + 5% = 9% (retenu sur le net, voir paieMois() dans
// calculs.js). Total employeur = 2% + 3% + 12,5% + 5% = 22,5%.
export const TAUX_CNSS_SALARIE = 0.04 + 0.05; // 9% — PV(4%) + AMU(5%)
export const TAUX_CNSS_EMPLOYEUR = TAUX_CNSS.RP + TAUX_CNSS.PF + 0.125 + 0.05; // 22,5%

export const cotisationsCNSS = (remuneration) => {
  const r = Number(remuneration) || 0;
  return {
    RP: Math.round(r * TAUX_CNSS.RP),
    PF: Math.round(r * TAUX_CNSS.PF),
    PV: Math.round(r * TAUX_CNSS.PV),
    AMU: Math.round(r * TAUX_CNSS.AMU),
  };
};

// Répartition employeur / salarié d'un montant de rémunération donné —
// utile pour le paiement mensuel à la CNSS (part employeur, à sa charge
// propre) et pour vérifier/afficher la retenue déjà faite sur le salarié.
export const repartitionCNSS = (remuneration) => {
  const r = Number(remuneration) || 0;
  return {
    partSalariale: Math.round(r * TAUX_CNSS_SALARIE),
    partPatronale: Math.round(r * TAUX_CNSS_EMPLOYEUR),
    total: Math.round(r * (TAUX_CNSS_SALARIE + TAUX_CNSS_EMPLOYEUR)),
  };
};

// Un employé est-il prêt pour l'export DRC ce mois-ci ? (champs obligatoires du guide)
export const cnssPret = (u, donneesMois) =>
  !!(u.cnss_numero_assurance && u.cnss_date_embauche && donneesMois?.jours);

// Sépare "Nom Prénoms" en (Nom, Prénoms) au mieux : premier mot = nom, reste = prénoms.
// Simplification assumée en l'absence de champs distincts dans la fiche employé —
// à corriger manuellement dans le fichier si l'ordre réel diffère.
function separerNomPrenoms(nomComplet) {
  const mots = String(nomComplet || "").trim().split(/\s+/);
  if (mots.length <= 1) return { nom: mots[0] || "", prenoms: "" };
  return { nom: mots[0], prenoms: mots.slice(1).join(" ") };
}

// Construit le CLASSEUR (objet en mémoire) au format DRC pour un mois donné —
// séparé du déclenchement du téléchargement pour rester testable directement.
// `lignes` : [{ u, remuneration, jours, natureCode, motifSortieCode }]
export function construireClasseurDRC(lignes) {
  const enTetes = [
    "No. Mle", "No. Assurance", "Nom", "Prénoms", "Code Type Ass.",
    "Nbr. Jr", "Rémunération", "Nature Rémun.", "Date Emb.", "Date Sortie",
    "Code Motif Sortie", "RP (2%)", "PF (3%)", "PV (16.5%)", "AMU (10%)",
  ];
  const donnees = lignes.map(({ u, remuneration, jours, natureCode, motifSortieCode }) => {
    const { nom, prenoms } = separerNomPrenoms(u.nom_complet || u.nom);
    const c = cotisationsCNSS(remuneration);
    return [
      u.cnss_matricule || "",
      u.cnss_numero_assurance || "",
      nom,
      prenoms,
      Number(u.cnss_code_type || 1),
      Number(jours) || 0,
      Math.round(Number(remuneration) || 0),
      Number(natureCode || 1),
      u.cnss_date_embauche || "",
      u.cnss_date_sortie || "",
      u.cnss_date_sortie ? Number(motifSortieCode || u.cnss_code_motif_sortie || 0) || "" : "",
      c.RP, c.PF, c.PV, c.AMU,
    ];
  });
  const feuille = XLSX.utils.aoa_to_sheet([enTetes, ...donnees]);
  // Forcer en TEXTE les colonnes qui doivent le rester même si elles ont
  // l'air numériques (matricule, n° assurance, dates) — sinon Excel risque
  // de les reformater silencieusement (perte d'un zéro en tête, etc.).
  const colonnesTexte = [0, 1, 8, 9]; // No. Mle, No. Assurance, Date Emb., Date Sortie
  donnees.forEach((_, i) => {
    colonnesTexte.forEach((c) => {
      const ref = XLSX.utils.encode_cell({ r: i + 1, c });
      if (feuille[ref]) feuille[ref].t = "s";
    });
  });
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "DRC");
  return classeur;
}

// Déclenche le téléchargement du fichier (effet de bord navigateur).
export function genererFichierDRC(lignes, mois) {
  const nomFichier = `DRC_${mois}.xlsx`;
  XLSX.writeFile(construireClasseurDRC(lignes), nomFichier);
  return nomFichier;
}
