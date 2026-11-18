// ============================================================
// lib/versionDistante.js — QUAND UN APPAREIL REPREND LA VERSION DU SERVEUR
//
// Capture Timo (07/10/2026) : la facture BMID-2026-0043 de SENA porte trois
// articles repris sur le serveur (relu dans Supabase), et son téléphone ne les
// montrait pas — ni « ↩ 3 repris », ni la situation sous le total.
//
// ⚠ LA CAUSE : DEUX HORLOGES COMPARÉES. Le serveur pose sa propre heure dans
// la colonne `updated_at` (déclencheur horodatage_serveur) ; le champ
// `data.updated_at` garde l'heure de L'APPAREIL qui a écrit. La lecture
// comparait la copie locale (alignée sur l'heure du SERVEUR après chaque envoi)
// à `data.updated_at` (l'heure de l'appareil qui a fait la reprise) : un
// appareil dont la montre retarde écrivait des versions qui paraissaient
// « plus anciennes » — et personne ne les reprenait. Jamais.
//
// LA RÈGLE, sans aucune heure d'appareil :
//   • une modification LOCALE pas encore partie (elle est dans la file
//     d'envoi) → on garde la copie locale : l'envoi la fusionnera ;
//   • sinon, dès que la version du serveur DIFFÈRE de celle qu'on a, on la
//     prend — le serveur est la seule horloge qui vaille.
// La copie rangée porte l'heure du SERVEUR (`horodatee`), pour que la
// prochaine comparaison, et la version de départ d'un envoi, parlent la même
// langue que lui.
//
// Pure, sans import : le banc l'exerce telle quelle.
// ============================================================

// L'heure qui fait foi pour une ligne lue sur le serveur : sa colonne.
export const versionServeur = (ligne) => String(ligne?.updated_at || ligne?.data?.updated_at || "");

// Faut-il remplacer la copie locale par la ligne du serveur ?
export function prendreVersionServeur(local, ligne, enAttente = false) {
  if (!ligne?.data) return false;
  if (!local) return true;
  if (enAttente) return false;
  return String(local.updated_at || "") !== versionServeur(ligne);
}

// 📉 LA LECTURE EN DEUX TEMPS (04/11/2026, Supabase : « Egress Exceeded », plus
// de 5 Go envoyés aux appareils en octobre → « lance »). Toutes les 20 s,
// chaque appareil relisait EN ENTIER tout ce qui avait changé dans les 10
// dernières minutes (la marge de prudence) — une fiche de boutique, un client
// et ses devis retéléchargés une trentaine de fois, déjà connus. Désormais il
// ne demande d'abord que l'ÉTIQUETTE (id + heure du serveur), et ne télécharge
// en entier que ce qu'il n'a pas encore, ou qui a changé. Même règle que
// `prendreVersionServeur`, sur l'étiquette seule.
export function fautTelecharger(local, etiquette, enAttente = false) {
  if (!etiquette?.id) return false;
  if (!local) return true;
  if (enAttente) return false;
  return String(local.updated_at || "") !== versionServeur(etiquette);
}
// Au-delà, on relit d'un bloc (premier passage d'un appareil neuf, rattrapage).
export const SEUIL_LECTURE_DIRECTE = 200;

// La fiche à ranger : les données du serveur, horodatées par le serveur.
export const horodatee = (ligne) => ({ ...ligne.data, updated_at: versionServeur(ligne) });

// La relecture complète qui rattrape ce que l'ancienne règle a laissé passer :
// faite UNE fois par appareil (marque dans la base locale).
export const CLE_RELECTURE_HORLOGE = "relecture_horloge_2026_10_07";

// ---- ⚡ LA CONNEXION NE REPART PLUS DE ZÉRO (Timo, 08/11/2026, « a+b+c lance ») ----
// Avant, CHAQUE connexion remettait tous les curseurs au 01/01/1970 : toute la
// base était redemandée, puis comparée ligne par ligne — la bande bleue
// « ⏳ Synchronisation » durait. Désormais on ne repart de zéro que si ce qui
// décide de ce que le serveur laisse voir a CHANGÉ depuis la dernière
// connexion réussie sur cet appareil : un autre compte, un rôle, une
// boutique, l'espace, le statut de principal, les pouvoirs retirés, un compte
// bloqué / réactivé (le jeton du serveur est réécrit à la connexion,
// api/sync-auth.js). Même signature → seulement ce qui a changé. Le miroir
// (effacer ce que le serveur ne montre plus) reste fait à CHAQUE connexion.
export const CLE_COMPTE_SYNCHRO = "compte_synchronise";
// ⚠ Un SQL qui ÉLARGIT ce qu'un compte voit (une politique de lecture ouverte
// à plus de lignes) ne change pas le compte : sans ce numéro, les anciennes
// lignes devenues visibles n'arriveraient jamais. On l'AUGMENTE d'un dans le
// même envoi que ce SQL : chaque appareil repart alors de zéro une fois.
export const REGLES_LECTURE_SERVEUR = 1;
export const signatureCompteSynchro = (u) => (u ? JSON.stringify([
  REGLES_LECTURE_SERVEUR, u.id || "", u.role || "", u.boutique || "", !!u.formation, u.admin_principal === true,
  [...(u.droits_off || [])].map(String).sort(), u.actif !== false, !!u.bloque,
]) : "");
// Faut-il tout redemander ? Oui si rien n'est noté, ou si la signature diffère.
export const faitRepartirDeZero = (noteeSurAppareil, u) => !noteeSurAppareil || noteeSurAppareil !== signatureCompteSynchro(u);

// ============================================================
// ⚡ UN SEUL CONTRÔLE AVANT DE LIRE (18/11/2026, quota de journaux Supabase)
// ============================================================
// La base répond, en UNE question (`dernieres_modifs`, supabase/sync-1-…sql),
// à « quelle est la dernière modification de chaque table ? » — en
// microsecondes. L'appareil ne relit une table que si cette date a dépassé son
// curseur, et au moins une fois toutes les `secuMs` (la marge de prudence de
// 10 min : une ligne validée tardivement avec une heure plus ancienne).

// « 2026-11-18T10:00:00.123456+00:00 » → microsecondes depuis 1970 (sans
// perdre les 3 derniers chiffres que Date ignore). null si illisible.
export function microsecondes(iso) {
  const m = /^(\d+)-(\d+)-(\d+)T(\d+):(\d+):(\d+)(?:\.(\d+))?(Z|[+-]\d+:?\d+)?$/.exec(String(iso || ""));
  if (!m) return null;
  let decalageMin = 0;
  if (m[8] && m[8] !== "Z") {
    const d = /^([+-])(\d\d):?(\d\d)$/.exec(m[8]);
    if (!d) return null;
    decalageMin = (d[1] === "-" ? -1 : 1) * (Number(d[2]) * 60 + Number(d[3]));
  }
  const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) - decalageMin * 60000;
  if (Number.isNaN(base)) return null;
  const frac = Number(`${m[7] || "0"}`.padEnd(6, "0").slice(0, 6));
  return base * 1000 + frac;
}

// Peut-on se passer de lire cette table ce passage-ci ?
//  maxServeur : ce que la base a répondu pour elle (undefined = pas de réponse,
//               null = table visible mais sans aucune ligne, sinon microsecondes)
export function peutSauterLaLecture({ maxServeur, curseur, derniereLectureMs, maintenantMs, secuMs }) {
  if (maxServeur === undefined || typeof maxServeur === "string") return false; // pas de réponse fiable : on lit
  if (derniereLectureMs === undefined || maintenantMs - derniereLectureMs >= secuMs) return false; // filet : jamais plus de 10 min sans lire
  if (maxServeur === null) return true; // rien du tout à lire
  if (typeof maxServeur !== "number") return false;
  const vu = microsecondes(curseur);
  return vu !== null && maxServeur <= vu;
}
