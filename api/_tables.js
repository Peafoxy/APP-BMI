// ============================================================
// api/_tables.js — LIRE UNE TABLE ENTIÈRE CÔTÉ SERVEUR (tournées)
//
// Écrit UNE fois pour les deux tournées (7 h et 17 h) : la clé de service
// lit tout, page par page (1 000 lignes à la fois), et rend chaque ligne avec
// son id. Jamais appelé depuis le navigateur.
// ============================================================
import { idStop, stopActif } from "../src/lib/stopCommercial.js";

export async function lireTable(admin, table) {
  const lignes = [];
  const PAGE = 1000;
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await admin.from(table).select("id, data").range(de, de + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((l) => lignes.push({ ...(l.data || {}), id: l.id }));
    if (!data || data.length < PAGE) break;
  }
  return lignes;
}

// ------------------------------------------------------------
// LES LIGNES D'UNE CONVERSATION WHATSAPP, ET D'ELLE SEULE (18/10/2026)
// ------------------------------------------------------------
// Captures Timo (MANDA, 16:28 → 16:35) : plusieurs réponses à un message,
// le même calcul de panneaux redit cinq fois, une réponse sans message.
// Les fonctions WhatsApp lisaient TOUTE la table des messages sans page :
// la base n'en rend que 1 000 au plus, dans un ordre quelconque. Passé ce
// nombre, le serveur ne voyait plus qu'une partie de la conversation —
// doublons manqués, réponses déjà données invisibles pour l'assistant.
// ⚠ Toute ligne d'une conversation (messages ET fiche légère) porte
// `wa_tel` = sa clé : ce filtre ne perd rien. Page par page quand même.
export async function lireConversation(admin, cle, champs = "id, data") {
  const k = String(cle || "");
  if (!k) return [];
  const lignes = [];
  const PAGE = 1000;
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await admin.from("messages").select(champs).eq("data->>wa_tel", k).order("id").range(de, de + PAGE - 1);
    if (error) throw error;
    (data || []).forEach((l) => lignes.push({ ...(l.data || {}), ...(l.id !== undefined ? { id: l.id } : {}) }));
    if (!data || data.length < PAGE) break;
  }
  return lignes;
}

// ------------------------------------------------------------
// 🔕 LES NUMÉROS QUI ONT DIT STOP (14/11/2026) — src/lib/stopCommercial.js
// ------------------------------------------------------------
// Une ligne par numéro, id « wastop_<8 chiffres> », lue PAR SON ID (jamais la
// table entière). La tournée de 7 h, qui a déjà toute la table, lit
// `numerosStop(db.messages)`.
export async function numeroEnStopSurLaBase(admin, tel) {
  const id = idStop(tel);
  if (id.length < "wastop_".length + 8) return false;
  const { data, error } = await admin.from("messages").select("id, data").eq("id", id);
  if (error) throw error;
  return !!(data && data[0] && stopActif({ ...(data[0].data || {}), id: data[0].id }));
}
