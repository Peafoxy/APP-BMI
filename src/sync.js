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

// ============ AMORÇAGE DES COMPTES — RETIRÉ DU DÉMARRAGE ============
// ⚠ Cette fonction téléchargeait TOUTE la table des comptes sur un appareil
// neuf, avant toute connexion. C'est elle qui imposait de laisser `users`
// lisible sans session — l'ouverture par laquelle les téléphones du
// personnel, et de quoi recalculer les mots de passe des clients,
// s'échappaient (audit du 19/08/2026).
//
// Elle n'est PLUS APPELÉE au démarrage : l'écran de connexion demande
// désormais au serveur la seule fiche correspondant à l'identifiant saisi,
// et ne l'obtient qu'avec le bon mot de passe (api/chercher-compte.js).
//
// Conservée telle quelle, sans appelant : après la fermeture de la lecture
// publique elle ne renvoie plus rien, et son échec est déjà silencieux. Elle
// reste utile comme point de reprise si l'on devait un jour réamorcer un
// parc entier depuis un poste d'administration.
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

// ⚠ Demande Timo : sur un appareil TOUT NEUF (jamais connecté), l'écran de
// connexion affichait toujours les couleurs/textes PAR DÉFAUT — la
// personnalisation choisie par l'admin (couleur du badge, fond, image) ne
// prenait effet qu'APRÈS une première connexion réussie, puisque
// "boutiques" n'était lue qu'à ce moment-là (synchronisation complète,
// après authentification). Même principe que amorcerComptes() ci-dessus,
// pour la même raison : lecture PUBLIQUE nécessaire avant toute connexion.
// ⚠ Suppose que la table "boutiques" a bien la politique de lecture
// publique — voir supabase/corriger-lecture-boutiques.sql (à exécuter côté
// Supabase si ce n'est pas déjà fait).
export async function amorcerBoutiques() {
  if (!supabaseConfigure || !navigator.onLine) return false;
  try {
    const { data, error } = await supabase.from("boutiques").select("*");
    if (error) throw error;
    for (const ligne of data || []) {
      const local = await idb.table("boutiques").get(ligne.id);
      const tsDistant = String(ligne.data?.updated_at || ligne.updated_at || "");
      if (!local || String(local.updated_at || "") < tsDistant) {
        await idb.table("boutiques").put(ligne.data);
      }
    }
    return true;
  } catch (e) {
    console.warn("Amorçage des boutiques reporté :", e?.message || e);
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
            // Le déclencheur SQL "horodatage_serveur" impose sa propre valeur de
            // updated_at (l'heure réelle du serveur), qui peut différer de celle
            // qu'on vient d'envoyer (horloge de cet appareil potentiellement
            // fausse). On essaie d'aligner la copie locale sur cette valeur de
            // référence — mais en ÉTAPE SÉPARÉE, non bloquante : l'écriture
            // ci-dessus a déjà réussi, un souci ici ne doit jamais la faire
            // repasser pour un échec (c'est justement ce qui s'est produit avec
            // .single(), trop strict, dans une version précédente de ce correctif).
            try {
              const { data: ecrit } = await supabase.from(op.table).select("updated_at").eq("id", op.id).limit(1);
              if (ecrit?.[0]?.updated_at) {
                await idb.table(op.table).put({ ...op.data, updated_at: ecrit[0].updated_at });
              }
            } catch (e2) {
              console.warn("Alignement de l'horodatage local reporté (sans conséquence) :", op.table, e2?.message || e2);
            }
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
          // ⚠ DEUX REFUS TRÈS DIFFÉRENTS, longtemps confondus (relevé par
          // Timo, 18/08/2026) :
          //   • la session a expiré → se reconnecter règle tout ;
          //   • le CONTENU de la ligne est refusé par une règle du serveur
          //     (erreur 42501, « new row violates row-level security
          //     policy ») → se reconnecter n'y changera JAMAIS rien.
          // Les traiter pareil produisait le pire des cas : l'application
          // conseillait de se reconnecter, l'opération repartait, était
          // refusée à nouveau, toutes les 20 secondes, indéfiniment. Timo
          // l'a rencontré en créant une boutique de formation que le
          // serveur n'acceptait pas.
          const contenuRefuse = e?.code === "42501"
            || /new row violates row-level security/i.test(msg);
          // Un refus d'écriture du serveur signifie que la session sécurisée ne
          // vaut plus rien — même si supabase-js la croit encore valide. On la
          // marque MORTE : (1) assurerSession forcera son rétablissement au
          // prochain cycle au lieu de la croire sur parole ; (2) le bouton de
          // déconnexion offrira la sortie « se déconnecter sans envoyer »
          // (sinon : compteur figé pour toujours, en ligne, sans issue).
          // On ne déclare la session morte QUE si le refus peut venir d'elle.
          // Un contenu refusé n'a rien à voir avec la session : la marquer
          // morte enverrait l'utilisateur se reconnaître en boucle.
          if (refusRLS && !contenuRefuse) {
            Object.assign(etatAuth, { ok: false, raison: "Écriture refusée par le serveur — session à rétablir" });
          }
          derniereErreur = contenuRefuse
            ? `⛔ Le serveur REFUSE cet enregistrement (${op.table}) — se reconnecter n'y changera rien.\n\n`
              + `Cet enregistrement appartient à un espace de travail (réel / formation) auquel votre compte n'a pas accès. `
              + `Il reste sur cet appareil, rien n'est perdu, mais il ne partira pas tant que la situation n'aura pas été corrigée.\n\n`
              + `Prévenez l'administrateur principal en lui montrant ce message.`
            : refusRLS
              ? `⚠ ${etatAuth.ok ? `Écriture refusée par Supabase (${op.table}) : ${msg}` : `Session sécurisée expirée — déconnectez-vous puis reconnectez-vous : les opérations en attente partiront automatiquement après.`}`
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
          } else if (TABLES.includes(m.table_name) && m.record_id === "__TRUNCATE__") {
            // Table entière vidée directement en SQL (TRUNCATE) : on vide la copie
            // locale de CETTE table, sans toucher aux autres — même logique de
            // "traité une seule fois" que la réinitialisation générale ci-dessus,
            // mais table par table.
            const cleTraite = `truncate_traite:${m.table_name}`;
            const dejaVu = await idb.meta.get(cleTraite);
            if (!dejaVu || String(dejaVu.valeur) < String(m.deleted_at)) {
              await idb.table(m.table_name).clear();
              await idb.meta.put({ cle: cleTraite, valeur: m.deleted_at });
              recuQuelqueChose = true;
              console.warn(`Vidage reçu pour "${m.table_name}" : copie locale effacée.`);
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

      // 2b) Les données des autres appareils — PAR LOTS EN PARALLÈLE plutôt
      // qu'une table après l'autre. Avant : 18 allers-retours réseau l'un
      // derrière l'autre, un temps total qui grossit avec le nombre de
      // tables. Maintenant : plusieurs tables interrogées EN MÊME TEMPS.
      //
      // Chaque table reste ISOLÉE (son propre essai, son propre curseur, sa
      // propre erreur) — voir synchroniserTable ci-dessous : c'était déjà le
      // cas avant, la parallélisation ne change QUE l'ordre d'exécution, pas
      // la logique de chacune. « users » reste joignable même sans session
      // (nouveau compte) puisqu'elle est toujours dans le lot exécuté.
      //
      // Un LOT à la fois (pas les 18 tables d'un coup) : pour ne pas envoyer
      // trop de requêtes simultanées à Supabase (limite de connexions du
      // plan, prudence réseau mobile).
      const TABLES_PAR_LOT = 5;
      for (let i = 0; i < TABLES.length; i += TABLES_PAR_LOT) {
        const lot = TABLES.slice(i, i + TABLES_PAR_LOT);
        await Promise.all(lot.map((t) => synchroniserTable(t)));
      }

      // Isolée dans sa propre fonction pour pouvoir être lancée en parallèle
      // avec ses semblables (Promise.all ci-dessus) tout en gardant EXACTEMENT
      // la même logique qu'avant (curseur, marge d'horloge, comparaison du
      // plus récent, gestion d'erreur) — rien de fonctionnel n'a changé ici.
      async function synchroniserTable(t) {
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
    // ⚠ Bug réel trouvé par Timo (capture après réinitialisation) : "users"
    // était intégralement épargné pour préserver les COMPTES de connexion —
    // mais de nombreuses données métier vivent EMBARQUÉES à l'intérieur
    // même des fiches utilisateurs (devis, contrats, crédit BMI, infos
    // d'équipe/parrainage), jamais dans une table séparée. Les ignorer
    // entièrement laissait tout ça survivre à une "réinitialisation
    // complète". Corrigé : les fiches sont maintenant NETTOYÉES (pas
    // sautées) — seuls les champs nécessaires à la CONNEXION sont
    // conservés, tout le reste embarqué est retiré.
    if (t === "users") {
      try {
        const { data: comptes, error: errLecture } = await supabase.from("users").select("id,data");
        if (errLecture) throw errLecture;
        for (const ligne of comptes || []) {
          const u = ligne.data || {};
          const nettoye = {
            id: u.id, nom: u.nom, nom_base: u.nom_base, tel: u.tel,
            // ⚠ pwd_visible RETIRÉ : il conservait le mot de passe en clair
            // dans une table publiquement lisible (faille critique fermée).
            pwd_salt: u.pwd_salt, pwd_hash2: u.pwd_hash2,
            mdp_auto: u.mdp_auto, mdp_variante: u.mdp_variante, mdp_longueur: u.mdp_longueur,
            role: u.role, boutique: u.boutique, actif: u.actif, cree_par: u.cree_par,
            // ⚠ Bug réel trouvé par Timo (après réinitialisation, il n'était
            // plus admin principal) : ce champ manquait à la liste — sans
            // lui, TOUS les admins perdent le statut, et l'app retombe sur
            // le premier admin de la liste par défaut (voir adminPrincipal(),
            // calculs.js). Champ IDENTITAIRE au même titre que le rôle,
            // jamais une donnée métier — doit être conservé.
            admin_principal: u.admin_principal,
            // ⚠ Même famille de bug que admin_principal ci-dessus : ce sont
            // des STATUTS/AUTORISATIONS posés manuellement par un admin (via
            // un bouton "Nommer/Retirer"), pas des données d'activité liées
            // à une vente ou un client — à conserver au même titre qu'un rôle.
            chef_equipe: u.chef_equipe, chat_libre: u.chat_libre,
            // ⚠ Confirmé explicitement par Timo : le taux de commission (%)
            // et le lien parrain/filleul sont des RÉGLAGES d'organisation,
            // pas des données d'activité — survivent à la réinitialisation
            // au même titre que chef_equipe ci-dessus.
            taux_commission: u.taux_commission, taux_equipe: u.taux_equipe, parrain_id: u.parrain_id,
            updated_at: new Date().toISOString(),
          };
          const { error: errEcriture } = await supabase.from("users").upsert({ id: u.id, data: nettoye, updated_at: nettoye.updated_at });
          if (errEcriture) throw errEcriture;
        }
        rapport.effacees.push("users (fiches nettoyées, comptes conservés)");
      } catch (e) {
        rapport.echecs.push(`users : ${e?.message || e}`);
      }
      continue;
    }
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

// ============ RÉCONCILIATION MIROIR ============
// Après un retéléchargement complet, supprime toute ligne locale que le
// serveur ne connaît pas. C'est la pièce qui manquait depuis le début :
// la synchronisation ajoute et modifie, les tombstones suppriment ce qui a
// été supprimé PAR l'application — mais une ligne née uniquement en local
// (données de démonstration, création avortée, vieux amorçage) n'a pas de
// tombstone et ne mourait jamais. Après ce passage, le local est une copie
// exacte du serveur : les données fantômes sont impossibles par construction.
// Règles de sécurité :
//  - jamais pendant qu'il reste des opérations à envoyer (l'outbox d'abord) ;
//  - à la moindre erreur de lecture (hors ligne, serveur), on ne supprime RIEN.
export async function reconcilierMiroirAvec(listerIdsServeur) {
  if ((await compterEnAttente()) > 0) return { fait: false, raison: "outbox" };
  let supprimees = 0;
  for (const table of TABLES) {
    const ids = await listerIdsServeur(table);
    if (ids === null) return { fait: false, raison: "lecture", table }; // erreur : on s'arrête sans rien toucher de plus
    const locaux = await idb.table(table).toArray();
    for (const l of locaux) {
      if (!ids.has(l.id)) { await idb.table(table).delete(l.id); supprimees++; }
    }
  }
  return { fait: true, supprimees };
}

// Liste complète des identifiants d'une table côté serveur, page par page
// (même précaution que lireTout : sans .order() ni pagination, Supabase
// renvoie 1000 lignes au hasard). Renvoie null en cas d'erreur.
async function listerIdsSupabase(table) {
  const ids = new Set();
  let de = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select("id").order("id").range(de, de + PAGE - 1);
    if (error) return null;
    for (const r of data || []) ids.add(r.id);
    if (!data || data.length < PAGE) break;
    de += PAGE;
  }
  return ids;
}

export async function reconcilierMiroir() {
  if (!supabaseConfigure || !navigator.onLine) return { fait: false, raison: "hors_ligne" };
  return reconcilierMiroirAvec(listerIdsSupabase);
}
