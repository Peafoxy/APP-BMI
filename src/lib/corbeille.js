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
// ⚠ Les DEVIS (26/09/2026, Timo : « a, lance ») n'ont pas de table à eux : ils
// vivent DANS la fiche de leur client (`users[].devis`). C'est une famille
// IMBRIQUÉE : même marque, même corbeille de 30 jours, mais la séparation et
// la fusion vont les chercher dans chaque fiche client. Une ligne de
// `corbeille_devis` porte en plus `corbeille_client_id` / `corbeille_client_nom`
// — c'est ce qui dit où la remettre.
export const FAMILLE_DEVIS = "devis";
export const LIBELLES_CORBEILLE = { clients_installes: "Chantier", devis: "Devis" };
export const cleCorbeille = (table) => `corbeille_${table}`;
export const CLE_CORBEILLE_DEVIS = cleCorbeille(FAMILLE_DEVIS);
export const CLES_CORBEILLE = [...TABLES_CORBEILLE.map(cleCorbeille), CLE_CORBEILLE_DEVIS];
const FAMILLES = [...TABLES_CORBEILLE, FAMILLE_DEVIS];

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
  // Les devis marqués quittent la fiche de leur client. On ne remplace le
  // tableau des comptes que s'il y a quelque chose à séparer.
  const devisSupprimes = [];
  if (Array.isArray(db.users) && db.users.some((u) => (u?.devis || []).some(estSupprime))) {
    sortie.users = db.users.map((u) => {
      const liste = u?.devis || [];
      if (!liste.some(estSupprime)) return u;
      liste.filter(estSupprime).forEach((d) => devisSupprimes.push({ ...d, corbeille_client_id: u.id, corbeille_client_nom: u.nom_base || u.nom || "" }));
      return { ...u, devis: liste.filter((d) => !estSupprime(d)) };
    });
  }
  sortie[CLE_CORBEILLE_DEVIS] = devisSupprimes;
  return sortie;
};

// Un devis de la corbeille, tel qu'il se range dans la fiche du client.
const devisSansAdresse = ({ corbeille_client_id, corbeille_client_nom, ...d }) => d;

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
  // Les devis retournent dans la fiche de LEUR client, marqués. Un client qui
  // n'existe plus (effacé) ne reçoit rien : son devis part avec lui.
  const devisCorbeille = db[CLE_CORBEILLE_DEVIS] || [];
  if (devisCorbeille.length && Array.isArray(db.users)) {
    const parClient = new Map();
    devisCorbeille.forEach((d) => parClient.set(d.corbeille_client_id, [...(parClient.get(d.corbeille_client_id) || []), d]));
    sortie.users = db.users.map((u) => {
      const a = parClient.get(u?.id);
      if (!a) return u;
      const ids = new Set(a.map((d) => d.id));
      return { ...u, devis: [...(u.devis || []).filter((d) => !ids.has(d.id)), ...a.map(devisSansAdresse)] };
    });
  }
  delete sortie[CLE_CORBEILLE_DEVIS];
  return sortie;
};

// ---- Un devis ne se supprime QUE tant qu'il est ⏳ Proposé. Validé = contrat
// signé ; payé = argent encaissé ; corrigé / modification = le client est dans
// la boucle ; rejeté = il a dit non, c'est une trace. Revérifié DANS le geste.
export const critiqueSuppressionDevis = (devis) => {
  if (!devis) return "Ce devis n'existe plus.";
  const statut = devis.statut || "propose";
  if (statut !== "propose") return "Seul un devis ⏳ Proposé se supprime : celui-ci ne l'est plus (validé, payé, en modification ou rejeté).";
  return "";
};

// Le même contrôle, sur la fiche FRAÎCHE (l'écran peut avoir un état périmé).
export const critiqueSuppressionDevisDans = (db, clientId, devisId) => {
  const client = (db?.users || []).find((u) => u.id === clientId);
  return critiqueSuppressionDevis(client && (client.devis || []).find((d) => d.id === devisId));
};

// ---- Le geste « Supprimer un devis » : il quitte la fiche du client et passe
// à la corbeille, avec qui, quand et pourquoi.
export const mettreDevisALaCorbeille = (db, clientId, devisId, profile, motif, maintenant = new Date().toISOString()) => {
  const client = (db?.users || []).find((u) => u.id === clientId);
  const devis = client && (client.devis || []).find((d) => d.id === devisId);
  if (!devis || critiqueSuppressionDevis(devis)) return db;
  const marque = {
    ...devis, supprime_le: maintenant, supprime_par: profile?.nom || "?", supprime_motif: String(motif || "").trim(),
    corbeille_client_id: client.id, corbeille_client_nom: client.nom_base || client.nom || "",
  };
  return {
    ...db,
    users: db.users.map((u) => (u.id === clientId ? { ...u, devis: (u.devis || []).filter((d) => d.id !== devisId) } : u)),
    [CLE_CORBEILLE_DEVIS]: [marque, ...(db[CLE_CORBEILLE_DEVIS] || []).filter((d) => d.id !== devisId)],
  };
};

// ---- Ce qui empêche une restauration (un devis dont le client a disparu).
export const critiqueRestauration = (db, table, fiche) => {
  if (table !== FAMILLE_DEVIS) return "";
  if (!(db?.users || []).some((u) => u.id === fiche?.corbeille_client_id)) {
    return `Le client ${fiche?.corbeille_client_nom || ""} n'existe plus : ce devis ne peut pas revenir.`;
  }
  return "";
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
  if (table === FAMILLE_DEVIS) {
    const fiche = (db[cle] || []).find((r) => r.id === id);
    if (!fiche || critiqueRestauration(db, table, fiche)) return db;
    const { supprime_le, supprime_par, supprime_motif, ...reste } = fiche;
    const propre = devisSansAdresse(reste);
    return {
      ...db,
      users: db.users.map((u) => (u.id === fiche.corbeille_client_id ? { ...u, devis: [propre, ...(u.devis || []).filter((d) => d.id !== id)] } : u)),
      [cle]: (db[cle] || []).filter((r) => r.id !== id),
    };
  }
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
  FAMILLES.flatMap((table) => (db?.[cleCorbeille(table)] || []).map((fiche) => ({
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
  if (table === FAMILLE_DEVIS) {
    const montant = Number(fiche.total) ? ` — ${Math.round(Number(fiche.total)).toLocaleString("fr-FR")} F` : "";
    return `${fiche.corbeille_client_nom || "client"} du ${fiche.date || "?"}${montant}`;
  }
  return fiche.nom || fiche.id;
};
