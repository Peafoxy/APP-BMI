// ============================================================
// lib/cibleNotification.js — UNE NOTIFICATION MÈNE À SA SOURCE (16/10/2026)
// ============================================================
// Timo : « les notifications sont juste à titre informatif… elles ne
// conduisent pas à la source » → « les deux, lance ». Jusque-là un clic
// n'ouvrait que l'ONGLET (et parfois rien : le vendeur sur « Stock au seuil »,
// l'administrateur sur « Nouvelle tâche » — deux onglets qu'ils n'ont pas).
//
// Une notification emporte désormais sa CIBLE, petite et sans secret :
//   boutique : la boutique ou le magasin concerné (l'écran s'y place)
//   ligne    : l'identifiant de la ligne à montrer (`data-ligne`)
//   conv     : la conversation à ouvrir (💬 « user:<id> » / « client:<id> » /
//              « groupe:<id> », 📲 la clé du numéro)
//   membre   : le membre dont on ouvre les tâches (👑 Mon équipe)
// et `pour` : la personne à qui elle est destinée — un téléphone partagé ne
// mène jamais quelqu'un d'autre sur la ligne de l'ancien occupant.
//
// ⚠ LE MUR NE BOUGE PAS : la cible ne fait que DEMANDER. L'écran revérifie
// tout comme d'habitude (la boutique doit lui être visible, la conversation
// lisible) ; sinon le clic s'arrête à l'onglet, rien de plus.
// ⚠ Lisible par Node (le serveur et la tournée l'importent) : AUCUN import.
// ============================================================

const CHAMPS = ["boutique", "ligne", "conv", "membre"];
const LONGUEUR_MAX = 80;

// Une cible propre : des textes courts, rien d'autre. Vide → null.
export function nettoyerCible(c) {
  if (!c || typeof c !== "object") return null;
  const res = {};
  for (const k of CHAMPS) {
    const v = c[k];
    if (v === undefined || v === null || v === "") continue;
    res[k] = String(v).slice(0, LONGUEUR_MAX);
  }
  return Object.keys(res).length ? res : null;
}

// Un écran que le rôle n'a pas : le plus proche qui sert au même geste.
// (« a », 16/10/2026) — le vendeur n'a pas 📦 Stocks : un stock au seuil se
// règle par 🚚 Ravitaillement ; l'administrateur n'a pas ✅ Mes tâches : il
// suit les tâches dans 👑 Mon équipe.
export const REPLIS_ECRAN = { stocks: ["ravitaillement"], taches: ["equipe"] };

// `onglets` : les onglets du rôle (ONGLETS_ROLE) — passés en argument pour
// que ce fichier n'importe rien. `extra` : un onglet ouvert hors du rôle
// (« 💼 Argent reçu », qui n'est l'onglet d'aucun rôle).
export function ecranPour(onglets, ecran, extra = []) {
  const permis = new Set([...(onglets || []), ...(extra || [])]);
  if (!ecran) return null;
  if (permis.has(ecran)) return ecran;
  const repli = (REPLIS_ECRAN[ecran] || []).find((e) => permis.has(e));
  return repli || null;
}

// Une cible écrite pour une AUTRE personne ne mène nulle part sur cet
// appareil (un téléphone partagé) : seul l'onglet reste, s'il est permis.
export function ciblePourMoi(cible, pour, idCompte) {
  if (pour && idCompte && String(pour) !== String(idCompte)) return null;
  return nettoyerCible(cible);
}

// La boutique visée, pour l'écran. ⚠ Un employé rattaché à SA boutique n'est
// jamais déplacé ailleurs (il y est verrouillé) : seul celui qui en voit
// plusieurs (l'administrateur) change de boutique. L'écran revérifie ensuite
// qu'elle lui est visible (boutiqueRetenue, le mur).
export function boutiqueDeLaCible(cible, profile) {
  if (!cible || !cible.boutique) return "";
  if (profile && profile.boutique && profile.boutique !== cible.boutique) return "";
  return String(cible.boutique);
}

// ---- L'adresse d'ouverture (application FERMÉE) ----
// Le service worker ouvre « ./?ecran=…&cible=…&pour=… » ; l'application lit
// l'adresse à son démarrage, la NETTOIE aussitôt, et garde la demande jusqu'à
// la connexion (une session expirée : la personne se reconnecte, puis arrive
// sur la ligne).
export function adresseDeCible(ecran, cible, pour) {
  const p = new URLSearchParams();
  if (ecran) p.set("ecran", ecran);
  const c = nettoyerCible(cible);
  if (c) p.set("cible", JSON.stringify(c));
  if (pour) p.set("pour", String(pour));
  return `./?${p.toString()}`;
}

export function lireAdresseCible(search) {
  try {
    const p = new URLSearchParams(search || "");
    const ecran = p.get("ecran");
    if (!ecran) return null;
    let cible = null;
    try { cible = nettoyerCible(JSON.parse(p.get("cible") || "null")); } catch { cible = null; }
    return { ecran: String(ecran).slice(0, 40), cible, pour: p.get("pour") || "" };
  } catch {
    return null;
  }
}

// Les blocs d'un écran qui ne sont pas une ligne mais qu'une notification
// vise : l'encadré « ⚠ À réapprovisionner » de 📦 Stocks, le bandeau des
// clôtures dépassées de 🔒 Caisse (ils portent ce `data-ligne`).
export const LIGNE_A_REAPPROVISIONNER = "a-reapprovisionner";
export const LIGNE_CLOTURES_DEPASSEES = "clotures-depassees";

// La conversation de 💬 Messages visée par un message : celle que le
// DESTINATAIRE ouvre. Un message direct → la conversation avec son auteur ;
// le support → le fil du client ; un groupe → le groupe.
export function convDeMessage(m) {
  if (!m) return "";
  if (m.canal === "support" && m.client_id) return `client:${m.client_id}`;
  if (m.canal === "groupe" && m.groupe_id) return `groupe:${m.groupe_id}`;
  if (!m.canal && m.de_id) return `user:${m.de_id}`;
  return "";
}

export function lireConv(texte) {
  const m = /^(user|client|groupe):(.+)$/.exec(String(texte || ""));
  return m ? { type: m[1], id: m[2] } : null;
}
