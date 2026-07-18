import Dexie from "dexie";

// Tables synchronisées avec Supabase
const TABLES_V1 = [
  "boutiques", "users", "produits", "ventes", "depenses",
  "dettes", "fournisseurs", "ajustements", "clotures", "commerciaux",
];
export const TABLES = [...TABLES_V1, "audits", "prospects", "categories_prospects", "commandes", "messages", "clients_installes", "proformas", "groupes"];

// Base locale IndexedDB : fonctionne toujours, même sans connexion
export const idb = new Dexie("bmi-gestion-boutiques");
idb.version(1).stores(
  Object.fromEntries([
    ...TABLES_V1.map((t) => [t, "id"]),
    ["outbox", "++seq"], // journal des modifications à envoyer à Supabase
    ["meta", "cle"],     // métadonnées (initialisation, dernière sync...)
  ])
);
// v2 : journal d'audit (les bases existantes migrent automatiquement)
idb.version(2).stores({ audits: "id" });
// v3 : prospection commerciale (prospects + catégories définies par l'admin)
idb.version(3).stores({ prospects: "id", categories_prospects: "id" });
// v4 : commandes des commerciaux, à valider par un vendeur de la boutique
idb.version(4).stores({ commandes: "id" });
// v5 : messagerie interne (messages en différé) + fiches clients installés
idb.version(5).stores({ messages: "id", clients_installes: "id" });
// v6 : proformas (offres de prix non comptabilisées, onglet Ventes)
idb.version(6).stores({ proformas: "id" });
// v7 : groupes de discussion (créés par l'admin, membres choisis, supprimables)
idb.version(7).stores({ groupes: "id" });

// Au tout premier lancement, remplit la base locale avec les données de départ.
// Ces données ne sont PAS mises dans l'outbox : elles restent locales
// tant qu'elles ne sont pas modifiées.
// Pose le seed de départ (admin initial, etc.) UNIQUEMENT au tout premier
// lancement d'un appareil VIERGE — jamais après un nettoyage du navigateur si des
// données existent sur le serveur.
//
// Danger historique : après un nettoyage, la base locale est vide. Reposer le
// seed avec une date fraîche le rendait « plus récent » que les vraies données
// serveur, et la synchro pouvait le POUSSER par-dessus (boutiques écrasées).
//
// Nouvelle règle : après un nettoyage, on ne pose RIEN. On laisse la
// synchronisation retélécharger le serveur. Le seed n'est réinstallé que si,
// APRÈS avoir tenté de lire le serveur, la base est toujours totalement vide
// (vrai premier lancement, ou serveur réellement vide) — voir amorcerSiVide().
export async function initialiserDonnees(seed) {
  const deja = await idb.meta.get("initialise");
  if (deja) return;
  // On mémorise le seed pour amorcerSiVide, mais on NE l'écrit PAS maintenant.
  seedEnAttente = seed;
}

let seedEnAttente = null;

// Appelée APRÈS la première synchronisation. Ne pose le seed que si la base est
// encore vide (aucune boutique ET aucun utilisateur venus du serveur).
export async function amorcerSiVide() {
  if (!seedEnAttente) return;
  const nbUsers = await idb.users.count();
  const nbBoutiques = await idb.boutiques.count();
  const seed = seedEnAttente;
  seedEnAttente = null;

  // Le serveur a renvoyé des données → rien à amorcer, on marque juste comme initialisé.
  if (nbUsers > 0 || nbBoutiques > 0) {
    await idb.meta.put({ cle: "initialise", valeur: true });
    return;
  }

  // Base réellement vide. Deux cas :
  //  - EN LIGNE : la synchro a déjà eu lieu et n'a rien ramené → serveur vide →
  //    vrai premier lancement. On pose le seed à la date du jour.
  //  - HORS LIGNE : on n'a pas pu vérifier le serveur. On pose quand même le seed
  //    (sinon l'utilisateur n'a aucun compte pour se connecter), MAIS avec une
  //    date TRÈS ANCIENNE : ainsi, dès le retour du réseau, les vraies données du
  //    serveur (forcément plus récentes) l'emporteront et l'écraseront proprement.
  const enLigne = typeof navigator !== "undefined" && navigator.onLine;
  const horodatage = enLigne ? new Date().toISOString() : "1970-01-01T00:00:00Z";
  await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.meta], async () => {
    for (const t of TABLES) {
      const lignes = (seed[t] || []).map((r) => ({ ...r, updated_at: horodatage }));
      await idb.table(t).bulkPut(lignes);
    }
    // Si hors ligne, on ne marque PAS comme définitivement initialisé : au
    // prochain démarrage en ligne, amorcerSiVide re-vérifiera le serveur.
    if (enLigne) await idb.meta.put({ cle: "initialise", valeur: true });
  });
}

// Charge toutes les tables locales dans un objet { ventes: [...], produits: [...], ... }
export async function chargerTout() {
  const db = {};
  // Lecture tolérante : si une table n'existe pas encore (schéma en retard,
  // migration non appliquée), on renvoie un tableau vide au lieu de planter.
  // Sans cela, une seule table absente bloquait tout le démarrage.
  for (const t of TABLES) {
    try { db[t] = await idb.table(t).toArray(); }
    catch { db[t] = []; }
  }
  // Tri par date décroissante pour les listes chronologiques
  for (const t of ["ventes", "depenses", "dettes", "ajustements", "clotures", "audits", "prospects", "commandes", "messages", "clients_installes", "proformas", "groupes"]) {
    db[t].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }
  return db;
}

const sansMeta = (r) => {
  const { updated_at, ...reste } = r || {};
  return JSON.stringify(reste);
};

// Compare l'ancien et le nouvel état, applique les différences dans la base
// locale et enregistre chaque modification dans l'outbox pour la synchronisation.
export async function sauvegarderDiff(prev, next) {
  const maintenant = new Date().toISOString();
  await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.outbox], async () => {
    for (const t of TABLES) {
      const avant = new Map((prev[t] || []).map((r) => [r.id, r]));
      const apres = new Map((next[t] || []).map((r) => [r.id, r]));

      // Nouveaux ou modifiés → upsert local + outbox
      for (const [id, r] of apres) {
        const a = avant.get(id);
        if (!a || sansMeta(a) !== sansMeta(r)) {
          const rec = { ...r, updated_at: maintenant };
          await idb.table(t).put(rec);
          await idb.outbox.add({ table: t, op: "upsert", id, data: rec });
        }
      }
      // Supprimés → delete local + outbox
      for (const id of avant.keys()) {
        if (!apres.has(id)) {
          await idb.table(t).delete(id);
          await idb.outbox.add({ table: t, op: "delete", id });
        }
      }
    }
  });
}

export const compterEnAttente = () => idb.outbox.count();

// Remet TOUS les enregistrements actuels dans l'outbox, pour forcer un
// renvoi complet vers Supabase (utile si des données existaient déjà
// avant la première connexion, et n'ont donc jamais été poussées).
// ⚠ ANCIEN COMPORTEMENT (dangereux) : cette fonction REPOUSSAIT tout le contenu
// local vers le serveur. Un appareil resté sur d'anciennes données ressuscitait
// donc tout ce qu'un administrateur venait d'effacer. Le nom mentait.
//
// NOUVEAU : on remet simplement le curseur à zéro. L'appareil RELIT alors tout
// depuis le serveur — y compris les suppressions. Rien n'est repoussé.
// Les modifications locales non encore envoyées restent dans la file d'attente
// et partiront normalement : elles ne sont pas perdues.
// Remet le curseur à zéro pour tout relire depuis le serveur.
// GARDE-FOU ABSOLU : refuse d'agir tant qu'il reste des éléments non envoyés.
// Sinon, une relecture pourrait écraser une vente faite hors ligne avant qu'elle
// ne soit partie. Renvoie le nombre d'éléments encore en attente (0 = a réussi).
export async function forcerResynchronisation() {
  const enAttente = await compterEnAttente();
  if (enAttente > 0) return enAttente;         // on NE touche à rien
  // Chaque table a désormais son propre curseur (voir sync.js) : on les remet
  // TOUTES à zéro, plus seulement l'ancienne clé unique.
  await idb.meta.put({ cle: "derniere_sync:tombstones", valeur: "1970-01-01T00:00:00Z" });
  for (const t of TABLES) {
    await idb.meta.put({ cle: `derniere_sync:${t}`, valeur: "1970-01-01T00:00:00Z" });
  }
  return 0;
}

// Suivi de la sauvegarde de secours (fichier JSON exporté par l'admin)
export async function joursDepuisSauvegarde() {
  const m = await idb.meta.get("derniere_sauvegarde");
  if (!m) return null;
  return (Date.now() - Number(m.valeur)) / 86400000;
}

export async function marquerSauvegarde() {
  await idb.meta.put({ cle: "derniere_sauvegarde", valeur: Date.now() });
}

// La resynchronisation complète automatique ne se déclenche qu'UNE SEULE
// FOIS par machine (au premier démarrage après cette mise à jour), pour
// rattraper les données créées avant la mise en place de Supabase — puis
// plus jamais, afin de ne pas ralentir les démarrages suivants.
export async function autoResyncDejaFaite() {
  const m = await idb.meta.get("auto_resync_v1");
  return !!m;
}

export async function marquerAutoResyncFaite() {
  await idb.meta.put({ cle: "auto_resync_v1", valeur: Date.now() });
}

// ============ DOSSIER DE SAUVEGARDE AUTOMATIQUE ============
// L'administrateur désigne UNE FOIS un dossier (idéalement synchronisé par
// Google Drive). L'autorisation est mémorisée : l'application y réécrit ensuite
// le même fichier toutes les heures, sans rien redemander.
export async function memoriserDossier(handle) {
  await idb.meta.put({ cle: "dossier_sauvegarde", valeur: handle });
}
export async function lireDossier() {
  const m = await idb.meta.get("dossier_sauvegarde");
  return m ? m.valeur : null;
}
export async function oublierDossier() {
  await idb.meta.delete("dossier_sauvegarde");
}
export async function marquerSauvegardeAuto() {
  await idb.meta.put({ cle: "derniere_sauvegarde_auto", valeur: Date.now() });
}
export async function heuresDepuisSauvegardeAuto() {
  const m = await idb.meta.get("derniere_sauvegarde_auto");
  if (!m) return null;
  return (Date.now() - Number(m.valeur)) / 3600000;
}

// ============ RÉINITIALISATION ============
// Vide toutes les tables locales SAUF les comptes utilisateurs, et purge la
// file d'attente : sans ça, des écritures en attente ressusciteraient les
// données effacées à la prochaine synchronisation.
export async function viderLocal() {
  await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.outbox, idb.meta], async () => {
    await idb.outbox.clear();
    for (const t of TABLES) {
      if (t === "users") continue;
      await idb.table(t).clear();
    }
  });
}
