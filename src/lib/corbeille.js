// ============================================================
// lib/corbeille.js — La corbeille des fiches supprimées.
//
// POURQUOI (demande Timo, plan du 31/08/2026, « lance la corbeille » le
// 05/09/2026). Supprimer une fiche envoyait un faire-part de suppression à
// tous les appareils : la fiche disparaissait partout, tout de suite,
// définitivement. Une erreur ne se rattrapait que par la sauvegarde
// horaire, un appareil resté hors ligne, ou la ressaisie.
//
// COMMENT. Supprimer ne détruit plus : la fiche reste dans sa table, avec
// une marque `supprime_le` / `supprime_par`. Elle disparaît de tous les
// écrans et de tous les chiffres, parce que les DEUX points de passage de
// l'application la mettent de côté :
//   • au CHARGEMENT (chargerTout)  : separerCorbeille — les fiches marquées
//     quittent `db.clients_installes` pour `db.corbeille_clients_installes` ;
//   • à l'ÉCRITURE (sauvegarderDiff) : fusionnerCorbeille — elles y
//     retournent avant la comparaison, pour repartir dans LEUR table.
// Aucun écran n'a besoin de savoir qu'une corbeille existe. Même principe
// que la fiche de paie (lib/paie.js).
//
// L'administrateur PRINCIPAL seul voit la corbeille (⚙ Paramètres → 🗑),
// restaure ou supprime pour de bon. Passé 30 jours, la fiche est effacée
// automatiquement (purge au démarrage, sur son appareil).
//
// Ce fichier est PUR : aucune importation, pour être mesuré par le banc.
// ============================================================

export const DUREE_CORBEILLE_JOURS = 30;

// Une famille à la fois : les chantiers d'abord (les plus longs à ressaisir).
export const TABLES_CORBEILLE = ["clients_installes"];
export const LIBELLES_CORBEILLE = { clients_installes: "Chantier" };
export const cleCorbeille = (table) => `corbeille_${table}`;
export const CLES_CORBEILLE = TABLES_CORBEILLE.map(cleCorbeille);

export const estSupprime = (r) => !!(r && r.supprime_le);

// ---- CHARGEMENT : mettre de côté ce qui est marqué.
export const separerCorbeille = (db) => {
  if (!db) return db;
  const sortie = { ...db };
  for (const t of TABLES_CORBEILLE) {
    const lignes = db[t] || [];
    const vivantes = lignes.filter((r) => !estSupprime(r));
    const corbeille = lignes.filter(estSupprime);
    // On ne remplace le tableau que s'il y a quelque chose à séparer : les
    // écrans comparent les tableaux par identité pour savoir s'ils ont changé.
    if (corbeille.length) sortie[t] = vivantes;
    sortie[cleCorbeille(t)] = corbeille;
  }
  return sortie;
};

// ---- ÉCRITURE : tout remettre dans sa table, la clé de corbeille disparaît.
export const fusionnerCorbeille = (db) => {
  if (!db) return db;
  const sortie = { ...db };
  for (const t of TABLES_CORBEILLE) {
    const cle = cleCorbeille(t);
    const corbeille = db[cle] || [];
    if (corbeille.length) sortie[t] = [...(db[t] || []), ...corbeille];
    delete sortie[cle];
  }
  return sortie;
};

// ---- Le geste « Supprimer » : la fiche passe à la corbeille, marquée.
export const mettreALaCorbeille = (db, table, id, profile, maintenant = new Date().toISOString()) => {
  const cle = cleCorbeille(table);
  const fiche = (db[table] || []).find((r) => r.id === id);
  if (!fiche) return db;
  const marquee = { ...fiche, supprime_le: maintenant, supprime_par: profile?.nom || "?" };
  return {
    ...db,
    [table]: (db[table] || []).filter((r) => r.id !== id),
    [cle]: [marquee, ...(db[cle] || []).filter((r) => r.id !== id)],
  };
};

// ---- Restaurer : la fiche revient telle qu'elle était, sans la marque.
export const restaurerDeLaCorbeille = (db, table, id) => {
  const cle = cleCorbeille(table);
  const fiche = (db[cle] || []).find((r) => r.id === id);
  if (!fiche) return db;
  const { supprime_le, supprime_par, ...propre } = fiche;
  return {
    ...db,
    [table]: [propre, ...(db[table] || []).filter((r) => r.id !== id)],
    [cle]: (db[cle] || []).filter((r) => r.id !== id),
  };
};

// ---- Supprimer pour de bon (à la main, ou par la purge).
export const supprimerDefinitivement = (db, table, id) => {
  const cle = cleCorbeille(table);
  return { ...db, [cle]: (db[cle] || []).filter((r) => r.id !== id) };
};

const JOUR_MS = 24 * 60 * 60 * 1000;
export const joursRestants = (fiche, maintenant = new Date().toISOString()) => {
  const depuis = Date.parse(fiche?.supprime_le || "");
  if (!Number.isFinite(depuis)) return 0;
  const ecoules = (Date.parse(maintenant) - depuis) / JOUR_MS;
  return Math.max(0, Math.ceil(DUREE_CORBEILLE_JOURS - ecoules));
};

// Tout ce que contient la corbeille, à plat, la plus récente en tête.
export const contenuCorbeille = (db, maintenant = new Date().toISOString()) =>
  TABLES_CORBEILLE.flatMap((table) => (db?.[cleCorbeille(table)] || []).map((fiche) => ({
    table, fiche, libelle: LIBELLES_CORBEILLE[table] || table, restants: joursRestants(fiche, maintenant),
  }))).sort((a, b) => String(b.fiche.supprime_le || "").localeCompare(String(a.fiche.supprime_le || "")));

// Ce qui a dépassé les 30 jours.
export const aPurger = (db, maintenant = new Date().toISOString()) =>
  contenuCorbeille(db, maintenant).filter((x) => x.restants <= 0);

export const purgerCorbeille = (db, maintenant = new Date().toISOString()) =>
  aPurger(db, maintenant).reduce((acc, x) => supprimerDefinitivement(acc, x.table, x.fiche.id), db);

// Le nom qu'on affiche dans la corbeille, selon la famille.
export const nomDeLaFiche = (table, fiche) => {
  if (table === "clients_installes") return `${fiche.prenom || ""} ${fiche.nom || ""}`.trim() || fiche.id;
  return fiche.nom || fiche.id;
};
