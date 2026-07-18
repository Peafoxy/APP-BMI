import { idb, TABLES, compterEnAttente } from "./db";
import { supabase, supabaseConfigure, assurerSession, etatAuth } from "./supabaseClient";

// Moteur de synchronisation :
// - toutes les écritures se font d'abord en LOCAL (instantané, hors ligne)
// - dès que la connexion est là, on POUSSE l'outbox vers Supabase
// - puis on TIRE les modifications faites par les autres appareils
// - en cas de conflit sur un même enregistrement : la modification la plus
//   récente gagne — À L'ENVOI COMME À LA RÉCEPTION. Avant d'écrire sur le
//   serveur, on vérifie qu'on n'écrase pas plus récent que soi, et qu'on ne
//   ressuscite pas un enregistrement supprimé ailleurs.

let minuterie = null;
let rappel = null;
let enCours = false;

// « serveurJoignable » est vrai seulement si le DERNIER échange avec Supabase a
// réussi. Auparavant, le voyant affichait « En ligne » dès que Windows avait du
// réseau et que les clés existaient — même si le serveur ne répondait pas du tout.
// Un voyant qui ment est pire que pas de voyant.
let serveurJoignable = true;

async function notifier(rafraichir = false, erreur = "") {
  if (!rappel) return;
  rappel({
    enLigne: navigator.onLine,
    supabaseOk: supabaseConfigure && serveurJoignable,
    enAttente: await compterEnAttente(),
    rafraichir,
    erreur,
  });
}

// Les écouteurs sont mémorisés pour être RETIRÉS à l'arrêt. Sans cela, ils
// s'accumulaient à chaque déconnexion/reconnexion, déclenchant plusieurs
// synchronisations simultanées.
let ecouteurEnLigne = null;
let ecouteurHorsLigne = null;

export function demarrerSync(callback) {
  arreterSync(); // on ne démarre jamais deux fois
  rappel = callback;
  ecouteurEnLigne = () => synchroniser();
  ecouteurHorsLigne = () => notifier(false);
  window.addEventListener("online", ecouteurEnLigne);
  window.addEventListener("offline", ecouteurHorsLigne);
  minuterie = setInterval(ecouteurEnLigne, 20000); // toutes les 20 secondes
  ecouteurEnLigne();
}

export function arreterSync() {
  if (minuterie) clearInterval(minuterie);
  if (ecouteurEnLigne) window.removeEventListener("online", ecouteurEnLigne);
  if (ecouteurHorsLigne) window.removeEventListener("offline", ecouteurHorsLigne);
  minuterie = null;
  ecouteurEnLigne = null;
  ecouteurHorsLigne = null;
  rappel = null;
}

// Marge de sécurité sur le curseur de synchronisation.
// Les dates sont écrites par les APPAREILS, pas par le serveur : si l'horloge
// d'un téléphone avance de quelques minutes, il écrit des dates « dans le
// futur ». Sans marge, les autres appareils sauteraient définitivement tout ce
// qui s'écrit pendant cet écart. On relit donc systématiquement les 10 dernières
// minutes : quelques lignes redondantes valent mieux qu'une vente perdue.
const MARGE_HORLOGE_MS = 10 * 60 * 1000;
const PAGE = 1000; // plafond imposé par Supabase

const reculer = (iso, ms) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "1970-01-01T00:00:00Z";
  return new Date(Math.max(0, t - ms)).toISOString();
};

// Lit TOUTES les lignes d'une table, page par page.
// Sans .order() ni pagination, Supabase renvoie 1000 lignes AU HASARD sans
// prévenir : c'est la panne silencieuse par excellence.
async function lireTout(table, colonneDate, depuis) {
  const tout = [];
  let de = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .gt(colonneDate, depuis)
      .order(colonneDate, { ascending: true })
      .range(de, de + PAGE - 1);
    if (error) throw error;
    const lot = data || [];
    tout.push(...lot);
    if (lot.length < PAGE) break;   // dernière page
    de += PAGE;
    if (de > 200000) break;         // garde-fou : jamais de boucle infinie
  }
  return tout;
}

// ============ AMORÇAGE DES COMPTES (avant toute connexion) ============
// Un appareil neuf n'a AUCUNE donnée locale : il doit retrouver au moins la
// table des comptes pour qu'un utilisateur (surtout un client qui vient de
// recevoir ses identifiants) puisse se reconnaître au tout premier login.
// Volontairement SÉPARÉE de synchroniser() : plus simple, moins d'étapes qui
// pourraient échouer, donc plus fiable pour ce cas précis. La table « users »
// reste lisible sans session (voir supabase/durcir_securite.sql) — c'est ce
// qui rend cet appel possible avant toute connexion.
export async function amorcerComptes() {
  if (!supabaseConfigure || !navigator.onLine) return false;
  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    for (const ligne of data || []) {
      const local = await idb.table("users").get(ligne.id);
      const tsDistant = String(ligne.data?.updated_at || ligne.updated_at || "");
      if (!local || String(local.updated_at || "") < tsDistant) {
        await idb.table("users").put(ligne.data);
      }
    }
    return true;
  } catch (e) {
    console.warn("Amorçage des comptes reporté :", e?.message || e);
    return false;
  }
}

// Synchronisation d'OUVERTURE DE SESSION.
// Différence avec la synchro normale : on s'assure d'abord que TOUT ce qui a été
// créé hors ligne est bien PARTI vers le serveur, avant de lire quoi que ce soit.
// C'est ce qui protège les ventes du matin faites sans réseau : elles ne peuvent
// pas être écrasées par une lecture, puisqu'elles sont envoyées en premier.
export async function synchroniserOuverture() {
  if (!supabaseConfigure || !navigator.onLine) {
    await notifier(false);
    return;
  }
  // 1er passage : pousse la file d'attente + première lecture.
  await synchroniser();

  // S'il reste des éléments non envoyés (réseau lent, gros volume), on réessaie
  // quelques fois. On ne lit JAMAIS par-dessus une file encore pleine.
  for (let i = 0; i < 3; i++) {
    const reste = await compterEnAttente();
    if (reste === 0) break;
    await new Promise((r) => setTimeout(r, 1500));
    await synchroniser();
  }
}

export async function synchroniser() {
  if (enCours) return;
  if (!supabaseConfigure || !navigator.onLine) {
    await notifier(false);
    return;
  }
  enCours = true;
  let recuQuelqueChose = false;
  let derniereErreur = "";

  // try/finally : quoi qu'il arrive, « enCours » sera relâché. Sans cela, une
  // seule exception inattendue bloquait la synchronisation pour toute la session.
  try {
    // ---------- 0) LA SESSION ----------
    // On tente d'établir une session sécurisée sans alarmer : tant que la base
    // est ouverte, son absence n'empêche rien. Un refus réel sera signalé plus bas.
    try { await assurerSession(); } catch (e) { console.warn("Session non établie :", e?.message || e); }
    let echecReseau = false;

    // ---------- 1) POUSSER les modifications locales ----------
    // Chaque élément est traité indépendamment. MAIS si un élément échoue, on
    // saute les suivants qui portent sur le MÊME enregistrement : sinon une
    // suppression pourrait passer avant la création qu'elle est censée annuler.
    try {
      const ops = await idb.outbox.orderBy("seq").toArray();
      const bloques = new Set();

      // ── AVANT D'ÉCRIRE, ON REGARDE CE QU'IL Y A EN FACE ──
      // Deux dangers, tous deux invisibles :
      //   1. écraser une modification PLUS RÉCENTE faite par un autre appareil
      //      (un téléphone resté 3 jours hors ligne pousse ses vieilles données) ;
      //   2. RESSUSCITER un enregistrement supprimé entre-temps par quelqu'un d'autre.
      // On récupère donc, en une requête par table, l'état distant des
      // enregistrements concernés — et on décide ensuite, au cas par cas.
      const tablesAbsentes = new Set(); // tables non encore créées sur le serveur
      const etatDistant = new Map();   // "table:id" → updated_at distant
      const supprimes = new Map();     // "table:id" → deleted_at
      try {
        const parTable = new Map();
        for (const op of ops) {
          if (op.op !== "upsert") continue;
          if (!parTable.has(op.table)) parTable.set(op.table, new Set());
          parTable.get(op.table).add(op.id);
        }
        for (const [table, jeu] of parTable) {
          const ids = [...jeu];
          for (let i = 0; i < ids.length; i += 100) { // par lots : l'URL a une longueur limite
            const lot = ids.slice(i, i + 100);
            const { data: dist, error: errDist } = await supabase.from(table).select("id,updated_at").in("id", lot);
            // Table absente côté serveur (migration SQL non appliquée) : on la saute
            // au lieu de bloquer TOUTE la synchronisation des autres tables.
            if (errDist && /could not find the table|does not exist|PGRST205/i.test(errDist.message || errDist.code || "")) {
              console.warn(`Table "${table}" absente sur le serveur, ignorée.`);
              tablesAbsentes.add(table);
              break;
            }
            for (const r of dist || []) etatDistant.set(`${table}:${r.id}`, String(r.updated_at || ""));
            const { data: morts } = await supabase
              .from("tombstones").select("record_id,deleted_at")
              .eq("table_name", table).in("record_id", lot);
            for (const m of morts || []) supprimes.set(`${table}:${m.record_id}`, String(m.deleted_at || ""));
          }
        }
      } catch (e) {
        // Si cette vérification échoue (réseau), on n'envoie rien ce cycle-ci
        // plutôt que d'écraser à l'aveugle. On réessaiera dans 20 secondes.
        console.warn("Vérification avant envoi impossible, envoi reporté :", e?.message || e);
        echecReseau = true;
        throw e;
      }

      for (const op of ops) {
        if (tablesAbsentes.has(op.table)) continue; // serveur pas encore migré pour cette table
        const cle = `${op.table}:${op.id}`;
        if (bloques.has(cle)) continue; // un envoi précédent sur cet enregistrement a échoué
        try {
          if (op.op === "upsert") {
            const tsLocal = String(op.data?.updated_at || "");

            // (1) L'enregistrement a été SUPPRIMÉ ailleurs, après notre modification ?
            //     Alors la suppression l'emporte : on ne le ressuscite pas.
            const tsMort = supprimes.get(cle);
            if (tsMort && tsMort > tsLocal) {
              await idb.table(op.table).delete(op.id);
              await idb.outbox.delete(op.seq);
              recuQuelqueChose = true;
              console.warn("Envoi abandonné : l'enregistrement a été supprimé ailleurs.", cle);
              continue;
            }

            // (2) Le serveur a une version PLUS RÉCENTE ? Alors on n'écrase pas.
            //     On abandonne notre envoi : la lecture, juste après, nous
            //     apportera la bonne version. « Le plus récent gagne » — vraiment.
            const tsDistant = etatDistant.get(cle);
            if (tsDistant && tsDistant > tsLocal) {
              await idb.outbox.delete(op.seq);
              console.warn("Envoi abandonné : le serveur a une version plus récente.", cle);
              continue;
            }

            const { error } = await supabase
              .from(op.table)
              .upsert({ id: op.id, data: op.data, updated_at: op.data.updated_at });
            if (error) throw error;
          } else {
            const del = await supabase.from(op.table).delete().eq("id", op.id);
            if (del.error) throw del.error;
            const { error } = await supabase.from("tombstones").upsert({
              id: `${op.table}:${op.id}`,
              table_name: op.table,
              record_id: op.id,
              deleted_at: new Date().toISOString(),
            });
            if (error) throw error;
          }
          await idb.outbox.delete(op.seq); // confirmé : on retire du journal
        } catch (e) {
          bloques.add(cle); // on préserve l'ordre des opérations sur cet enregistrement
          const msg = String(e?.message || e);
          const refusRLS = /row-level security|permission denied|JWT|policy/i.test(msg);
          derniereErreur = refusRLS
            ? `Écriture refusée par Supabase (${op.table}) : aucune session sécurisée. ${etatAuth.raison}`
            : `Envoi (${op.table}) : ${msg}`;
          console.warn("Élément non envoyé, on réessaiera :", op.table, msg);
        }
      }
    } catch (e) {
      echecReseau = true;
      derniereErreur = `Envoi vers le serveur impossible : ${String(e?.message || e)}`;
    }

    // ---------- 2) TIRER : suppressions D'ABORD, données ENSUITE ----------
    // L'ordre compte. Si on lisait les données avant d'appliquer les suppressions,
    // le marqueur de réinitialisation effacerait aussitôt ce qu'on vient de lire —
    // y compris la trace de l'effacement lui-même.
    try {
      // ⚠ CURSEUR PAR TABLE, pas un seul curseur global pour toutes les tables.
      // Avant, une seule valeur « derniere_sync » avançait dès qu'UNE table
      // réussissait — si une AUTRE table avait échoué ce cycle-là (session pas
      // encore prête, etc.), le curseur global avançait quand même derrière
      // elle, et cette table en retard ne pouvait alors plus JAMAIS rattraper
      // ce qu'elle avait raté : le curseur avait déjà dépassé ses données non
      // lues. C'est ce qui a fait qu'un appareil ayant connu un souci de
      // synchronisation passager gardait des données manquantes pour toujours.
      const curseurDe = async (cle) => (await idb.meta.get(cle))?.valeur || "1970-01-01T00:00:00Z";

      // 2a) Les suppressions distantes
      // Isolée dans son propre essai : sur un appareil neuf sans session encore
      // établie, cette lecture peut échouer (table verrouillée aux sessions
      // authentifiées) — ça ne doit PAS empêcher la suite de tourner, sinon la
      // table users (elle, publique) ne serait jamais atteinte : cercle vicieux
      // qui empêchait un nouveau compte de se reconnaître à la première connexion.
      try {
        const curseur = await curseurDe("derniere_sync:tombstones");
        const depuis = reculer(curseur, MARGE_HORLOGE_MS); // marge anti-décalage d'horloge
        let maxVu = curseur;
        const morts = await lireTout("tombstones", "deleted_at", depuis);
        for (const m of morts) {
          if (m.table_name === "*") {
            // Réinitialisation générale : cet appareil vide sa base locale ET sa
            // file d'attente, sinon il repousserait ses vieilles données.
            // On ne traite CHAQUE réinitialisation QU'UNE FOIS : sans ce garde-fou,
            // une relecture complète (curseur remis à zéro) reviderait la file
            // d'attente à chaque fois — et détruirait des ventes faites hors ligne.
            const dejaVu = await idb.meta.get("reset_traite");
            if (!dejaVu || String(dejaVu.valeur) < String(m.deleted_at)) {
              await idb.transaction("rw", [...TABLES.map((t) => idb.table(t)), idb.outbox, idb.meta], async () => {
                await idb.outbox.clear();
                for (const t of TABLES) {
                  if (t === "users") continue;
                  await idb.table(t).clear();
                }
                await idb.meta.put({ cle: "reset_traite", valeur: m.deleted_at });
              });
              recuQuelqueChose = true;
              console.warn("Réinitialisation reçue : base locale vidée.");
            }
          } else if (TABLES.includes(m.table_name)) {
            await idb.table(m.table_name).delete(m.record_id);
            recuQuelqueChose = true;
          }
          if (m.deleted_at > maxVu) maxVu = m.deleted_at;
        }
        await idb.meta.put({ cle: "derniere_sync:tombstones", valeur: maxVu });
      } catch (e) {
        console.warn("Lecture des suppressions distantes reportée :", e?.message || e);
      }

      // 2b) Les données des autres appareils, table par table, PAGE PAR PAGE,
      // chacune avec SON PROPRE curseur — voir l'explication tout en haut.
      // CHAQUE TABLE dans son propre essai : sur un appareil neuf sans session
      // encore établie, la plupart des tables refusent la lecture — mais
      // « users », elle, reste publique en lecture spécifiquement pour permettre
      // à un nouveau compte de se retrouver dès sa toute première connexion.
      // Si une seule erreur globale arrêtait la boucle, cette table ne serait
      // jamais atteinte selon son rang dans la liste (elle n'est pas la première).
      for (const t of TABLES) {
        const cle = `derniere_sync:${t}`;
        try {
          const curseur = await curseurDe(cle);
          const depuis = reculer(curseur, MARGE_HORLOGE_MS);
          let maxVu = curseur;
          const lignes = await lireTout(t, "updated_at", depuis);
          for (const ligne of lignes) {
            const local = await idb.table(t).get(ligne.id);
            const tsDistant = String(ligne.data?.updated_at || ligne.updated_at || "");
            // Le plus récent gagne. Une modification locale non encore envoyée,
            // si elle est plus récente, est conservée : elle partira au prochain envoi.
            if (!local || String(local.updated_at || "") < tsDistant) {
              await idb.table(t).put(ligne.data);
              recuQuelqueChose = true;
            }
            if (ligne.updated_at > maxVu) maxVu = ligne.updated_at;
          }
          // Le curseur de CETTE table n'avance que si CETTE table a réussi.
          await idb.meta.put({ cle, valeur: maxVu });
        } catch (e) {
          echecReseau = true;
          if (!derniereErreur) derniereErreur = `Lecture de « ${t} » impossible : ${String(e?.message || e)}`;
          console.warn(`Lecture de "${t}" reportée :`, e?.message || e);
        }
      }
    } catch (e) {
      // Réseau ou Supabase : on réessaiera au prochain cycle. Rien n'est perdu :
      // tout ce qui n'est pas parti reste dans la file d'attente locale.
      console.warn("Réception reportée :", e?.message || e);
      echecReseau = true;
      if (!derniereErreur) derniereErreur = `Lecture du serveur impossible : ${String(e?.message || e)}`;
    }

    serveurJoignable = !echecReseau; // le voyant dit enfin la vérité
    await notifier(recuQuelqueChose, derniereErreur);
  } finally {
    enCours = false; // TOUJOURS relâché, même en cas d'exception inattendue
  }
}

// ============ RÉINITIALISATION DISTANTE ============
// Vide les tables Supabase EN UNE SEULE REQUÊTE PAR TABLE (au lieu d'une
// requête par enregistrement : impraticable au-delà de quelques centaines).
// Pose ensuite un marqueur global : les autres appareils, en le recevant,
// videront leur base locale au lieu de repousser leurs vieilles données.
export const MARQUEUR_RESET = "__RESET_GLOBAL__";

export async function reinitialiserDistant() {
  const rapport = { effacees: [], echecs: [] };
  for (const t of TABLES) {
    if (t === "users") continue; // les comptes sont conservés
    try {
      const { error } = await supabase.from(t).delete().neq("id", "___aucun___");
      if (error) throw error;
      rapport.effacees.push(t);
    } catch (e) {
      rapport.echecs.push(`${t} : ${e?.message || e}`);
    }
  }

  // Marqueur global, lu par tous les autres appareils
  try {
    const { error } = await supabase.from("tombstones").upsert({
      id: MARQUEUR_RESET,
      table_name: "*",
      record_id: MARQUEUR_RESET,
      deleted_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (e) {
    rapport.echecs.push(`marqueur global : ${e?.message || e}`);
  }
  return rapport;
}
