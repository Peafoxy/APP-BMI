// ============================================================
// lib/importStock.js — IMPORTATION D'ARTICLES EN STOCK (fichier Excel ou texte collé)
//
// Demande Timo (03/09/2026) : « Importation rapide n'intègre pas le domaine ?
// Ni fournisseur » puis « Est-ce possible d'importer un fichier Excel ? » —
// « une feuille par boutique ». L'ordre des colonnes est le sien, celui du
// formulaire à l'écran :
//   Nom, Fournisseur, Domaine, Catégorie, Initial, Seuil, Prix d'achat, Prix de vente
//
// Ce module est PUR (aucun accès à l'écran) pour que le banc puisse rejouer
// chaque règle : la lecture du fichier lui-même (xlsx) est isolée en bas.
// ============================================================
import { normNom, domainesDefinis, estBoutiqueFormation } from "./calculs";

export const COLONNES_IMPORT = ["Nom", "Fournisseur", "Domaine", "Catégorie", "Initial", "Seuil", "Prix d'achat", "Prix de vente"];

export const EXEMPLE_IMPORT = ["Panneau Solaire 150W", "SOLARIS", "Solaire", "Panneaux", 10, 3, 45000, 65000];

// Un titre de colonne se reconnaît sans accents, sans majuscules, sans
// espaces ni apostrophes : « Prix d'achat », « PRIX ACHAT », « prix_achat »
// désignent la même colonne. L'ordre des colonnes du fichier est libre.
const cle = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIAS = {
  nom: "nom", article: "nom", designation: "nom", libelle: "nom",
  fournisseur: "fournisseur",
  domaine: "domaine",
  categorie: "categorie", famille: "categorie",
  initial: "initial", quantite: "initial", qte: "initial", stock: "initial", stockinitial: "initial", quantiteinitiale: "initial",
  seuil: "seuil", seuilalerte: "seuil", alerte: "seuil",
  prixachat: "prix_achat", prixdachat: "prix_achat", achat: "prix_achat", pa: "prix_achat",
  prixvente: "prix_vente", prixdevente: "prix_vente", vente: "prix_vente", pv: "prix_vente",
};
const CHAMPS_ORDONNES = ["nom", "fournisseur", "domaine", "categorie", "initial", "seuil", "prix_achat", "prix_vente"];

// ---- MODE « ENTRÉES DE STOCK » (marchandise reçue pour des articles EXISTANTS) ----
// Demande Timo (03/09/2026) : « pour une prochaine entrée, on peut utiliser
// Excel aussi ? ». Deux colonnes suffisent — Nom, Quantité reçue — et une
// troisième facultative, Prix d'achat, pour mettre la fiche à jour quand le
// fournisseur a changé son prix. On ne CRÉE jamais d'article dans ce mode.
export const COLONNES_ENTREES = ["Nom", "Quantité reçue", "Prix d'achat"];
export const EXEMPLE_ENTREES = ["Panneau Solaire 150W", 10, 45000];
const ALIAS_ENTREES = {
  nom: "nom", article: "nom", designation: "nom", libelle: "nom",
  quantiterecue: "qte", quantite: "qte", qte: "qte", qterecue: "qte", recu: "qte", recue: "qte", recus: "qte", recues: "qte",
  entree: "qte", entrees: "qte", quantiteentree: "qte",
  prixachat: "prix_achat", prixdachat: "prix_achat", achat: "prix_achat", pa: "prix_achat", nouveauprixachat: "prix_achat",
};
const CHAMPS_ORDONNES_ENTREES = ["nom", "qte", "prix_achat"];
export const MODES_IMPORT = { articles: "articles", entrees: "entrees" };
const tableDuMode = (mode) => (mode === MODES_IMPORT.entrees
  ? { alias: ALIAS_ENTREES, ordre: CHAMPS_ORDONNES_ENTREES }
  : { alias: ALIAS, ordre: CHAMPS_ORDONNES });

// La première ligne d'un fichier est-elle une ligne de titres ? Oui si au
// moins deux de ses cases sont des titres connus (et qu'aucune n'est un
// nombre : une ligne d'articles porte des quantités et des prix).
export const estLigneDeTitres = (ligne, mode = MODES_IMPORT.articles) => {
  const { alias } = tableDuMode(mode);
  const cases = (ligne || []).map((c) => String(c ?? "").trim()).filter(Boolean);
  if (cases.length < 2) return false;
  if (cases.some((c) => /^\d+([.,]\d+)?$/.test(c))) return false;
  return cases.filter((c) => alias[cle(c)]).length >= 2;
};

// Transforme un tableau de lignes (tableaux de cases) en enregistrements
// { nom, fournisseur, … } : avec une ligne de titres, chaque colonne est
// reconnue par son titre ; sans, l'ordre de Timo s'applique.
export const enregistrementsDepuisLignes = (lignes, mode = MODES_IMPORT.articles) => {
  const { alias, ordre } = tableDuMode(mode);
  const brutes = (lignes || []).filter((l) => (l || []).some((c) => String(c ?? "").trim() !== ""));
  if (!brutes.length) return { enregistrements: [], avecTitres: false, colonnesInconnues: [] };
  const avecTitres = estLigneDeTitres(brutes[0], mode);
  let carte; // index de colonne → champ
  const colonnesInconnues = [];
  if (avecTitres) {
    carte = brutes[0].map((titre) => {
      const champ = alias[cle(titre)] || null;
      if (!champ && String(titre ?? "").trim()) colonnesInconnues.push(String(titre).trim());
      return champ;
    });
  } else {
    carte = ordre;
  }
  const corps = avecTitres ? brutes.slice(1) : brutes;
  const enregistrements = corps.map((ligne, i) => {
    const e = { __ligne: i + 1 + (avecTitres ? 1 : 0) };
    carte.forEach((champ, idx) => { if (champ && idx < ligne.length) e[champ] = ligne[idx]; });
    return e;
  });
  return { enregistrements, avecTitres, colonnesInconnues };
};

// Texte collé : une ligne par article. Séparateur : tabulation (copier-coller
// depuis Excel) si la ligne en contient, sinon point-virgule, sinon virgule.
export const lignesDepuisTexte = (texte) =>
  String(texte || "").split(/\r?\n/).filter((l) => l.trim())
    .map((l) => {
      const sep = l.includes("\t") ? "\t" : l.includes(";") ? ";" : ",";
      return l.split(sep).map((c) => c.trim());
    });

const nombre = (v) => {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

// ⚠ LA RÈGLE DE CHAQUE LIGNE (mêmes garde-fous que l'ancienne importation,
// audit du 29/08/2026) :
//   • sans nom → refusée ;
//   • sans prix de vente (> 0) → REFUSÉE : un article sans prix serait
//     vendu 0 F, et rien ne le signalerait ;
//   • fournisseur inconnu → article importé SANS fournisseur, et on le dit
//     (on ne crée pas un fournisseur par faute de frappe) — les fournisseurs
//     admis sont ceux de l'ESPACE DE LA BOUTIQUE visée (réel / formation) ;
//   • domaine inconnu → article importé SANS domaine, et on le dit ;
//   • un nom déjà présent dans cette boutique → refusé (deux fiches pour le
//     même article couperaient son stock en deux — même règle que « Ajouter »).
export const analyserImport = (db, boutique, enregistrements) => {
  const formation = estBoutiqueFormation(db, boutique);
  const fournisseurs = (db.fournisseurs || []).filter((f) => !!f.formation === formation);
  const domaines = domainesDefinis(db);
  const dejaLa = new Set((db.produits || []).filter((p) => p.boutique === boutique).map((p) => normNom(p.nom)));
  const nouveaux = [], erreurs = [], avertissements = [];
  const vusDansLeFichier = new Set();

  for (const e of enregistrements) {
    const ou = `Ligne ${e.__ligne}`;
    const nom = String(e.nom ?? "").trim();
    if (!nom) { erreurs.push(`${ou} : nom manquant`); continue; }
    const prixVente = nombre(e.prix_vente);
    if (!(prixVente > 0)) { erreurs.push(`${ou} (${nom}) : prix de vente manquant ou nul — un article sans prix serait vendu 0 F`); continue; }
    const n = normNom(nom);
    if (dejaLa.has(n)) { erreurs.push(`${ou} (${nom}) : existe déjà dans ${boutique} — corrigez sa fiche plutôt que de l'importer`); continue; }
    if (vusDansLeFichier.has(n)) { erreurs.push(`${ou} (${nom}) : en double dans le fichier`); continue; }
    vusDansLeFichier.add(n);

    let fournisseur = "";
    const fTape = String(e.fournisseur ?? "").trim();
    if (fTape) {
      const f = fournisseurs.find((x) => normNom(x.nom) === normNom(fTape));
      if (f) fournisseur = f.nom;
      else avertissements.push(`${ou} (${nom}) : fournisseur « ${fTape} » inconnu — importé sans fournisseur`);
    }

    let domaine = "";
    const dTape = String(e.domaine ?? "").trim();
    if (dTape) {
      const d = domaines.find((x) => x.id === dTape || normNom(x.nom) === normNom(dTape));
      if (d) domaine = d.id;
      else avertissements.push(`${ou} (${nom}) : domaine « ${dTape} » inconnu — importé sans domaine`);
    }

    const initial = nombre(e.initial), seuil = nombre(e.seuil), prixAchat = nombre(e.prix_achat);
    nouveaux.push({
      boutique, nom, fournisseur, domaine,
      categorie: String(e.categorie ?? "").trim() || "Autre",
      initial: Number.isFinite(initial) ? initial : 0,
      entrees: 0,
      seuil: Number.isFinite(seuil) ? seuil : 0,
      prix_achat: Number.isFinite(prixAchat) ? prixAchat : 0,
      prix_vente: prixVente,
    });
  }
  return { nouveaux, erreurs, avertissements };
};

// Le récapitulatif montré AVANT d'enregistrer : tout est nommé, rien n'est
// « 3 erreurs ignorées ».
export const resumeImport = (boutique, { nouveaux, erreurs, avertissements }) => {
  const bloc = (titre, lignes) => (lignes.length
    ? `\n\n${titre} :\n${lignes.slice(0, 10).join("\n")}${lignes.length > 10 ? `\n… et ${lignes.length - 10} autre(s)` : ""}`
    : "");
  return `Importer ${nouveaux.length} article(s) dans ${boutique} ?`
    + bloc(`⚠ ${erreurs.length} ligne(s) NON importée(s)`, erreurs)
    + bloc(`ℹ ${avertissements.length} ligne(s) importée(s) avec une réserve`, avertissements);
};

// ⚠ LA RÈGLE D'UNE ENTRÉE :
//   • le nom doit désigner un article EXISTANT de la boutique (majuscules et
//     accents libres) — introuvable → refusé et nommé, on ne crée rien ici ;
//   • la quantité reçue doit être un nombre > 0 ;
//   • un même article deux fois dans le fichier → la seconde ligne refusée
//     (on ne devine pas s'il faut additionner) ;
//   • prix d'achat renseigné (> 0) → la fiche est mise à jour, et on le dit.
export const analyserEntrees = (db, boutique, enregistrements) => {
  const parNom = new Map((db.produits || []).filter((p) => p.boutique === boutique).map((p) => [normNom(p.nom), p]));
  const entrees = [], erreurs = [], avertissements = [];
  const vus = new Set();
  for (const e of enregistrements) {
    const ou = `Ligne ${e.__ligne}`;
    const nom = String(e.nom ?? "").trim();
    if (!nom) { erreurs.push(`${ou} : nom manquant`); continue; }
    const p = parNom.get(normNom(nom));
    if (!p) { erreurs.push(`${ou} (${nom}) : aucun article de ce nom dans ${boutique} — créez-le d'abord (mode « Nouveaux articles »)`); continue; }
    if (vus.has(p.id)) { erreurs.push(`${ou} (${nom}) : en double dans le fichier`); continue; }
    const qte = nombre(e.qte);
    if (!(qte > 0)) { erreurs.push(`${ou} (${nom}) : quantité reçue manquante ou nulle`); continue; }
    vus.add(p.id);
    let prixAchat = null;
    const pa = nombre(e.prix_achat);
    if (pa > 0) {
      prixAchat = pa;
      if (Number(p.prix_achat || 0) !== pa) avertissements.push(`${ou} (${p.nom}) : prix d'achat ${Number(p.prix_achat || 0)} → ${pa}`);
    }
    entrees.push({ produit_id: p.id, nom: p.nom, qte, prix_achat: prixAchat });
  }
  return { entrees, erreurs, avertissements };
};

export const resumeEntrees = (boutique, { entrees, erreurs, avertissements }) => {
  const bloc = (titre, lignes) => (lignes.length
    ? `\n\n${titre} :\n${lignes.slice(0, 10).join("\n")}${lignes.length > 10 ? `\n… et ${lignes.length - 10} autre(s)` : ""}`
    : "");
  const total = entrees.reduce((s, x) => s + x.qte, 0);
  return `Enregistrer ${entrees.length} entrée(s) de stock dans ${boutique} (${total} pièce(s) au total) ?`
    + bloc(`⚠ ${erreurs.length} ligne(s) NON importée(s)`, erreurs)
    + bloc(`ℹ ${avertissements.length} prix d'achat mis à jour`, avertissements);
};

// Applique les entrées à la base (pure : retourne les produits modifiés).
export const appliquerEntrees = (produits, entrees) => {
  const parId = new Map(entrees.map((x) => [x.produit_id, x]));
  return produits.map((p) => {
    const x = parId.get(p.id);
    if (!x) return p;
    return { ...p, entrees: Number(p.entrees || 0) + x.qte, ...(x.prix_achat ? { prix_achat: x.prix_achat } : {}) };
  });
};

// ---- Lecture d'un fichier Excel / CSV (navigateur uniquement) ----
// ⚠ « Une feuille par boutique » (Timo) : on ne lit que la PREMIÈRE feuille,
// et l'importation va dans la boutique affichée à l'écran.
export async function lireFichierTableur(fichier) {
  const XLSX = await import("xlsx");
  const donnees = await fichier.arrayBuffer();
  const classeur = XLSX.read(donnees, { type: "array" });
  const nomFeuille = classeur.SheetNames[0];
  if (!nomFeuille) return { lignes: [], feuille: null, nbFeuilles: 0 };
  const lignes = XLSX.utils.sheet_to_json(classeur.Sheets[nomFeuille], { header: 1, raw: true, defval: "" });
  return { lignes, feuille: nomFeuille, nbFeuilles: classeur.SheetNames.length };
}

// Le modèle vide à remplir : les huit titres, une ligne d'exemple.
export async function telechargerModeleImport(boutique, mode = MODES_IMPORT.articles) {
  const XLSX = await import("xlsx");
  const entreesMode = mode === MODES_IMPORT.entrees;
  const feuille = XLSX.utils.aoa_to_sheet(entreesMode ? [COLONNES_ENTREES, EXEMPLE_ENTREES] : [COLONNES_IMPORT, EXEMPLE_IMPORT]);
  feuille["!cols"] = entreesMode
    ? [{ wch: 28 }, { wch: 14 }, { wch: 12 }]
    : [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, (boutique || "Stock").slice(0, 31));
  const nomB = (boutique || "").replace(/[\\/:*?"<>|]/g, "").trim() || "BMI";
  XLSX.writeFile(classeur, `Modele_${entreesMode ? "entrees" : "import"}_stock_${nomB}.xlsx`);
}
