import Dexie from "dexie";
import { fusionnerPaie, separerPaie } from "./lib/paie";

// Tables synchronisées avec Supabase
const TABLES_V1 = [
  "boutiques", "users", "produits", "ventes", "depenses",
  "dettes", "fournisseurs", "ajustements", "clotures", "commerciaux",
];
export const TABLES = [...TABLES_V1, "audits", "prospects", "categories_prospects", "commandes", "messages", "clients_installes", "proformas", "groupes",
  // ⚠ Les fiches de PAIE, séparées des fiches employés (voir lib/paie.js).
  // Le serveur ne les envoie qu'à qui a le droit de les lire : sur la
  // plupart des appareils, cette table reste donc vide — et c'est voulu.
  "paie"];

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
// v8 : fiches de paie, sorties des fiches employés (salaires, virements,
// crédits, avances, pièce d'identité, CNSS). Voir lib/paie.js.
idb.version(8).stores({ paie: "id" });

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
  // Tri par date décroissante pour les listes chronologiques — cree_le
  // départage les enregistrements du MÊME jour dans le bon ordre (voir
  // sauvegarderDiff ci-dessus). Repli sur l'ordre existant si cree_le
  // manque des deux côtés (enregistrements d'avant ce correctif).
  for (const t of ["ventes", "depenses", "dettes", "ajustements", "clotures", "audits", "prospects", "commandes", "messages", "clients_installes", "proformas", "groupes"]) {
    db[t].sort((a, b) => {
      const parDate = String(b.date || "").localeCompare(String(a.date || ""));
      if (parDate !== 0) return parDate;
      return String(b.cree_le || "").localeCompare(String(a.cree_le || ""));
    });
  }
  // Les fiches de paie que cet appareil a le droit de recevoir sont recollées
  // sur les fiches employés : les écrans continuent de lire `u.salaire_base`
  // ou `u.virements` sans rien savoir de la séparation (voir lib/paie.js).
  db.users = fusionnerPaie(db.users, db.paie);
  return db;
}

// ⚠ ÉTAPE 2 de la fermeture du « trou n° 1 » : range en local LA fiche
// rapportée par le serveur lors d'une première connexion sur un appareil
// neuf (voir api/chercher-compte.js et screens/Connexion.jsx).
//
// Volontairement HORS de sauvegarderDiff : cette écriture ne doit PAS
// partir dans l'outbox. Elle ne fait que recopier ce que le serveur vient
// de donner — le renvoyer serait au mieux inutile, au pire écraser une
// version plus récente avec celle qu'on vient de recevoir.
export async function enregistrerCompteLocal(user) {
  if (!user?.id) return;
  try { await idb.table("users").put(user); } catch { /* base locale indisponible : la connexion marche quand même */ }
}

const sansMeta = (r) => {
  const { updated_at, ...reste } = r || {};
  return JSON.stringify(reste);
};

// Compare l'ancien et le nouvel état, applique les différences dans la base
// locale et enregistre chaque modification dans l'outbox pour la synchronisation.
export async function sauvegarderDiff(prev, next, ecrivain = {}) {
  const maintenant = new Date().toISOString();
  // Symétrique de la fusion faite au chargement : on redétache les fiches de
  // paie AVANT de comparer, pour que chaque champ reparte dans SA table.
  // Les deux états sont traités de la même façon, sinon la comparaison
  // verrait des différences qui n'existent pas.
  const avantSep = separerPaie(prev?.users, ecrivain);
  const apresSep = separerPaie(next?.users, ecrivain);
  prev = { ...prev, users: avantSep.users, paie: avantSep.paie };
  next = { ...next, users: apresSep.users, paie: apresSep.paie };
  await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.outbox], async () => {
    for (const t of TABLES) {
      const avant = new Map((prev[t] || []).map((r) => [r.id, r]));
      const apres = new Map((next[t] || []).map((r) => [r.id, r]));

      // Nouveaux ou modifiés → upsert local + outbox
      for (const [id, r] of apres) {
        const a = avant.get(id);
        if (!a || sansMeta(a) !== sansMeta(r)) {
          // ⚠ Demande Timo : classement fiable même pour plusieurs
          // enregistrements créés le MÊME JOUR (date = jour seul, sans
          // heure). cree_le fixe l'instant de création UNE SEULE FOIS,
          // jamais réécrit lors des modifications suivantes — sinon un
          // simple versement sur une VIEILLE dette la ferait remonter comme
          // si elle venait d'être créée. Absent sur les enregistrements
          // d'avant ce correctif : laissé tel quel plutôt qu'inventé après
          // coup (le tri retombe alors sur l'ordre existant pour eux, sans
          // régression).
          const cree_le = (a && a.cree_le) || r.cree_le || (!a ? maintenant : undefined);
          const rec = { ...r, updated_at: maintenant };
          if (cree_le) rec.cree_le = cree_le;
          await idb.table(t).put(rec);
          // ⚠ `base` : l'enregistrement TEL QU'IL ÉTAIT avant notre
          // modification (null si nous le créons). C'est lui qui permettra,
          // au moment de l'envoi, de savoir si quelqu'un est passé entre
          // temps — sans jamais comparer deux horloges — et, le cas échéant,
          // de fusionner à trois plutôt que d'écraser (voir lib/fusion.js et
          // les points 6 et 7 de l'audit du 20/08/2026).
          await idb.outbox.add({ table: t, op: "upsert", id, data: rec, base: a || null });
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
// Vide TOUTES les tables locales — comptes utilisateurs COMPRIS — et purge la
// file d'attente. Règle : rien ne vit en local à part ce qui reste à envoyer.
// La table users porte aussi les devis des clients, les tâches et les fiches
// employés : l'épargner laissait survivre d'anciens employés et devis sur
// certains appareils. Après cette purge, amorcerComptes() retélécharge les
// comptes (nécessaire pour l'écran de connexion), puis la synchronisation
// complète ramène tout le reste.
export async function viderLocal() {
  await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.outbox, idb.meta], async () => {
    await idb.outbox.clear();
    for (const t of TABLES) {
      await idb.table(t).clear();
    }
    // CRUCIAL : remettre tous les curseurs de synchronisation à zéro.
    // La lecture étant incrémentale, sans cela une purge suivie d'une
    // synchronisation ne ramènerait que les nouveautés récentes — et
    // l'appareil resterait quasi vide alors que le serveur a tout.
    await idb.meta.put({ cle: "derniere_sync:tombstones", valeur: "1970-01-01T00:00:00Z" });
    for (const t of TABLES) {
      await idb.meta.put({ cle: `derniere_sync:${t}`, valeur: "1970-01-01T00:00:00Z" });
    }
  });
}

// ============ COMPTES DE SECOURS ============
// Copie MINIMALE des comptes, rafraîchie à chaque synchronisation réussie et
// conservée à travers la purge totale (elle vit dans `meta`, pas dans les
// tables). Elle ne sert qu'à UNE chose : permettre à l'écran de connexion de
// fonctionner hors ligne après une purge. Elle n'alimente aucun onglet — les
// devis, tâches et fiches employés n'y figurent pas — donc aucune donnée
// fantôme ne peut réapparaître par elle. Un employé retiré côté serveur
// disparaît du secours à la synchronisation suivante de l'appareil.
const CHAMPS_SECOURS = ["id", "nom", "role", "boutique", "actif", "admin_principal", "chef_equipe", "pwd_salt", "pwd_hash2", "pwd_hash", "pwd"];

export async function majComptesSecours() {
  const users = await idb.users.toArray();
  if (!users.length) return; // ne jamais écraser le secours par du vide
  const minimal = users.map((u) => {
    const o = {};
    for (const c of CHAMPS_SECOURS) if (u[c] !== undefined) o[c] = u[c];
    return o;
  });
  await idb.meta.put({ cle: "comptes_secours", valeur: JSON.stringify(minimal) });
}

export async function lireComptesSecours() {
  try {
    const m = await idb.meta.get("comptes_secours");
    return m ? JSON.parse(m.valeur) : [];
  } catch { return []; }
}
