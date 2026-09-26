// ============================================================
// lib/suiviEnvoi.js — LES COCHES D'UN MESSAGE PARTI DU NUMÉRO BMI (26/09/2026)
//
// Timo, capture du WhatsApp du téléphone BMI : « pourquoi ça ne coche
// pas ? » → « explique-moi comment ça marcherait » → « oui, lance ».
// Jusqu'ici l'application envoyait et n'entendait plus parler de rien :
// c'est pour ça qu'elle n'écrivait jamais « reçu » ni « lu ».
//
// COMMENT : à l'envoi, Meta (par YCloud) donne un numéro de suivi ; on le
// range sur la ligne du fil (`wa_envoi_id`, `wa_wamid`). Ensuite Meta
// prévient, par la même adresse que les réponses des clients
// (api/whatsapp-entrant.js) : envoyé, reçu sur le téléphone, lu — ou échec.
// L'adresse retrouve la ligne par ce numéro et y écrit `wa_statut`.
//
// ⚠ LES COCHES NE RECULENT JAMAIS : une nouvelle « reçu » arrivée APRÈS
// « lu » (l'ordre d'arrivée n'est pas garanti) ne fait rien.
// ⚠ UN ÉCHEC SE DIT EN FRANÇAIS, par LA règle commune `traduireMotifWhatsApp`
// — un motif inconnu reste tel quel, on n'invente pas d'explication.
// ⚠ Ce que je n'ai PAS pu vérifier d'ici : la FORME exacte du paquet de
// YCloud (leur documentation n'est pas joignable). La lecture accepte la
// forme connue (`whatsappMessage` avec son `status`) ; ce qui ne la porte
// pas n'est pas une nouvelle de suivi, et passe son chemin.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { traduireMotifWhatsApp } from "./whatsappModeles.js";

// Le rang dit l'ordre : on ne descend jamais. Un échec après « reçu » ne
// peut pas arriver ; s'il arrivait, on garderait « reçu ».
export const RANG_ETAT = { envoye: 1, echec: 2, recu: 3, lu: 4 };
const ETAT_DE = { sent: "envoye", accepted: "envoye", delivered: "recu", read: "lu", failed: "echec", undelivered: "echec" };

// Une nouvelle arrivée avant que la ligne existe (le téléphone qui a envoyé
// n'a pas encore fini d'écrire) : on demande à YCloud de la renvoyer plus
// tard, pendant ce délai seulement. Au-delà, c'est un message sans ligne
// (envoyé avant ce suivi, ou par le repli) : on la laisse passer.
export const ATTENTE_LIGNE_MIN = 15;

const iso = (brut) => {
  if (!brut) return "";
  const n = Number(brut);
  const d = Number.isFinite(n) && n > 1e9 ? new Date(n < 1e12 ? n * 1000 : n) : new Date(brut);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

// Une nouvelle de suivi, ou null si le paquet n'en est pas une (un message
// entrant, par exemple, porte `whatsappInboundMessage`).
export function lireStatut(corps) {
  const c = corps || {};
  const m = c.whatsappMessage;
  if (!m || typeof m !== "object") return null;
  const etat = ETAT_DE[String(m.status || "").toLowerCase()];
  if (!etat) return null;
  const id = String(m.id || "");
  const wamid = String(m.wamid || "");
  if (!id && !wamid) return null;
  const le = iso(etat === "lu" ? m.readTime : etat === "recu" ? m.deliverTime : "") || iso(m.updateTime) || iso(c.createTime) || new Date().toISOString();
  return { id, wamid, etat, le, code: m.errorCode ?? m.error?.code ?? "", motif_brut: String(m.errorMessage || m.error?.message || "") };
}

// Le nouvel état de la ligne, ou null si rien ne change (même état, ou recul).
export function statutApres(ancien, nouveau) {
  if (!nouveau || !RANG_ETAT[nouveau.etat]) return null;
  if (ancien && (RANG_ETAT[ancien.etat] || 0) >= RANG_ETAT[nouveau.etat]) return null;
  const s = { etat: nouveau.etat, le: nouveau.le };
  if (nouveau.etat === "echec") {
    s.motif = traduireMotifWhatsApp(nouveau.motif_brut, nouveau.code) || nouveau.motif_brut || "WhatsApp n'a pas pu remettre le message.";
  }
  return s;
}

// Trop tôt pour conclure que la ligne n'existe pas ?
export const ligneAttendue = (statut, maintenant = new Date()) =>
  !!statut && (new Date(maintenant).getTime() - new Date(statut.le).getTime()) < ATTENTE_LIGNE_MIN * 60 * 1000;

// Les deux numéros de suivi à ranger sur la ligne du fil. Un envoi sans
// numéro (repli, formation) ne range rien : il n'aura pas de coches.
export function champsEnvoi(r) {
  const id = String(r?.id || "");
  const wamid = String(r?.wamid || "");
  if (!id && !wamid) return {};
  return { ...(id ? { wa_envoi_id: id } : {}), ...(wamid ? { wa_wamid: wamid } : {}), wa_statut: { etat: "envoye", le: new Date().toISOString() } };
}

// Un numéro de suivi ne sert que dans un filtre de la base : on n'y laisse
// passer que des lettres, chiffres et signes sûrs.
export const valeurSure = (x) => String(x || "").replace(/[^A-Za-z0-9._:=+-]/g, "");

const dateHeure = (le) => {
  const d = new Date(le || "");
  if (Number.isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  // L'heure de Lomé (GMT+0), comme `heureCourte`.
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} à ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// Ce que l'écran affiche : les coches, leur couleur, la phrase au survol.
export function coches(statut) {
  if (!statut || !RANG_ETAT[statut.etat]) return null;
  const quand = dateHeure(statut.le);
  const le = quand ? ` le ${quand}` : "";
  if (statut.etat === "lu") return { signe: "✓✓", couleur: "bleu", titre: `Lu par le client${le}` };
  if (statut.etat === "recu") return { signe: "✓✓", couleur: "gris", titre: `Arrivé sur le téléphone du client${le}` };
  if (statut.etat === "echec") return { signe: "❌", couleur: "rouge", titre: `Non reçu : ${statut.motif || "WhatsApp n'a pas pu remettre le message."}` };
  return { signe: "✓", couleur: "gris", titre: `Parti du numéro BMI${le}` };
}

// Le dernier message parti du numéro BMI pour une vente, une dette, un
// devis… (`ref` = { vente_id } ou { dette_id } ou { devis_id }). On reçoit
// la liste des messages DÉJÀ descendus sur l'appareil : ce que la base ne
// lui envoie pas (une conversation confiée à un collègue), il ne le voit pas.
export function dernierEnvoiPour(messages, ref) {
  const [cle, valeur] = Object.entries(ref || {})[0] || [];
  if (!cle || !valeur) return null;
  let dernier = null;
  for (const m of messages || []) {
    if (!m || m.canal !== "whatsapp" || !m.wa_envoi_id || m[cle] !== valeur) continue;
    if (!dernier || String(m.ts || "") > String(dernier.ts || "")) dernier = m;
  }
  return dernier;
}
