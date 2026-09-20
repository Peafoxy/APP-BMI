// ============================================================
// api/whatsapp-entrant.js — LA RÉPONSE DU CLIENT REVIENT DANS L'APPLICATION
//
// Timo, 20/09/2026 : « le personnel lui répond depuis l'application BMI et
// les réponses vont directement dans l'espace du personnel qui a écrit ».
// C'est l'ÉTAPE 2 : YCloud appelle cette adresse dès qu'un client écrit au
// numéro BMI, et le message est rangé dans 💬 Messages.
//
// ⚠⚠ CETTE ADRESSE EST PUBLIQUE : n'importe qui sur Internet peut la
// solliciter. Elle n'accepte donc que les appels qui portent le SECRET
// (`WHATSAPP_WEBHOOK_SECRET`, variable Vercel, jamais préfixée VITE_) —
// sans lui, on fabriquerait un faux message d'un vrai client dans la base
// de BMI. Le secret voyage dans l'adresse elle-même, parce que YCloud ne
// laisse rien d'autre passer ; il ne s'écrit donc JAMAIS dans un journal.
//
// ⚠ CE QUE JE N'AI PAS PU VÉRIFIER D'ICI : la FORME exacte du paquet que
// YCloud envoie (leur documentation n'est pas joignable depuis ce poste).
// La lecture ci-dessous accepte donc les formes connues ET range ce qu'elle
// ne comprend pas dans la réponse, pour qu'on puisse l'ajuster au premier
// vrai message au lieu de deviner. Un paquet illisible n'est jamais perdu
// en silence : il répond 200 (sinon YCloud le renverrait sans fin) en
// disant ce qu'il n'a pas su lire.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { cleConversation, CANAL_WA } from "../src/lib/whatsappConversations.js";
import { numeroComparable } from "../src/lib/identiteClient.js";
import { estCompteFormation } from "../src/lib/espace.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";

// Les formes que YCloud peut donner à un message entrant. On cherche le
// numéro, le texte et l'identifiant — le reste ne nous sert pas.
function lireEntrant(corps) {
  const c = corps || {};
  const m = c.whatsappInboundMessage || c.inboundMessage || c.message || c.data || c;
  const from = m.from || m.wa_id || m.sender || c.from || "";
  const texte =
    (typeof m.text === "string" ? m.text : m.text?.body) ||
    m.body ||
    (m.type && m.type !== "text" ? `[${m.type}]` : "");
  const id = m.id || m.messageId || m.sid || "";
  const ts = m.timestamp || m.createTime || m.sendTime || "";
  return { from: String(from || ""), texte: String(texte || ""), id: String(id || ""), ts: String(ts || "") };
}

const horodatage = (brut) => {
  if (!brut) return new Date().toISOString();
  const n = Number(brut);
  // WhatsApp donne parfois des SECONDES depuis 1970, parfois une date.
  if (Number.isFinite(n) && n > 1e9) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const d = new Date(brut);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const attendu = process.env.WHATSAPP_WEBHOOK_SECRET;
  const donne = String(req.query?.cle || req.headers["x-bmi-cle"] || "");
  if (!attendu || donne !== attendu) return res.status(401).json({ error: "Appel non reconnu." });

  const { from, texte, id, ts } = lireEntrant(req.body);
  const cle = cleConversation(from);
  // ⚠ 200, jamais une erreur : YCloud renverrait le paquet en boucle. On
  // DIT ce qu'on n'a pas su lire — c'est ce qui permettra de l'ajuster.
  if (!cle) return res.status(200).json({ ignore: true, pourquoi: "numéro illisible", vu: Object.keys(req.body || {}) });
  if (!texte) return res.status(200).json({ ignore: true, pourquoi: "message sans texte (image, audio…)", de: cle });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: lignes, error } = await admin.from("messages").select("id, data");
    if (error) throw error;
    const messages = (lignes || []).map((l) => ({ ...(l.data || {}), id: l.id }));

    // Le même message deux fois (YCloud réessaie quand il n'a pas eu de
    // réponse) ne s'écrit pas deux fois.
    if (id && messages.some((m) => m.wa_id === id)) return res.status(200).json({ deja: true });

    // ---- À QUI EST CETTE CONVERSATION ----
    // (1) ce que le fil dit déjà ; (2) sinon, qui lui a envoyé le dernier
    // devis du numéro BMI (la trace `envoi_whatsapp` existe depuis
    // l'étape 1) ; (3) sinon personne → SUPPORT, visible par tout le
    // personnel (décision « c » de Timo).
    const fil = messages.filter((m) => m.canal === CANAL_WA && m.wa_tel === cle)
      .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    let proprietaire = { id: "", nom: "" };
    for (let i = fil.length - 1; i >= 0 && !proprietaire.id; i--) {
      if (fil[i].proprietaire_id) proprietaire = { id: fil[i].proprietaire_id, nom: fil[i].proprietaire_nom || "" };
    }

    const { data: comptes, error: errU } = await admin.from("users").select("id, data");
    if (errU) throw errU;
    const client = (comptes || [])
      .map((l) => ({ ...(l.data || {}), id: l.id }))
      .find((u) => u.role === "client" && numeroComparable(u.tel) === cle);

    if (!proprietaire.id && client) {
      const devis = [...(client.devis || [])]
        .filter((d) => d?.envoi_whatsapp?.par_id)
        .sort((a, b) => String(a.envoi_whatsapp.le || "").localeCompare(String(b.envoi_whatsapp.le || "")));
      const dernier = devis[devis.length - 1];
      if (dernier) proprietaire = { id: dernier.envoi_whatsapp.par_id, nom: dernier.envoi_whatsapp.par || "" };
    }

    const ligne = {
      id: `wa-${id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: horodatage(ts).slice(0, 10),
      ts: horodatage(ts),
      canal: CANAL_WA,
      wa_tel: cle,
      wa_numero: String(from),
      wa_nom: client?.nom || "",
      wa_entrant: true,
      wa_id: id,
      de_id: null,
      de_nom: client?.nom || String(from),
      texte,
      lu_par: [],
      ...(proprietaire.id ? { proprietaire_id: proprietaire.id, proprietaire_nom: proprietaire.nom } : {}),
    };
    // ⚠ `updated_at` EST POSÉ ICI : c'est lui que la synchronisation compare
    // pour savoir qu'une ligne est nouvelle. Sans lui, le message existerait
    // dans la base sans jamais descendre sur les téléphones.
    const { error: errIns } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: ligne.ts });
    if (errIns) throw errIns;

    // ---- 🔔 PRÉVENIR, SINON LA FENÊTRE SE FERME SANS QUE PERSONNE LE SACHE ----
    // ⚠ La règle « liste A » (13/09/2026) veut qu'un message de 💬 Messages
    // prévienne son destinataire. Ici le message n'arrive PAS par le
    // `save()` de l'application — il arrive par cette adresse — donc
    // `envoisDepuisSave` ne le verra jamais : c'est à ce fichier de le
    // faire, exactement comme la tournée du matin.
    // ⚠ SANS PROPRIÉTAIRE, on prévient les ADMINISTRATEURS, pas « tout le
    // personnel » : la conversation reste VISIBLE par tous (décision « c »),
    // mais faire vibrer quinze téléphones pour un message de support
    // rendrait les notifications inutiles en une semaine.
    try {
      const { data: bqs } = await admin.from("boutiques").select("data");
      const boutiques = (bqs || []).map((b) => b.data || {});
      const tous = (comptes || []).map((l) => ({ ...(l.data || {}), id: l.id }));
      const destinataires = proprietaire.id
        ? [proprietaire.id]
        : tous.filter((u) => u.role === "admin" && u.actif !== false && !estCompteFormation({ users: tous, boutiques }, u)).map((u) => u.id);
      if (destinataires.length && configurerWebPush()) {
        await envoyerAuxPersonnes(admin, [{
          destinataires,
          titre: `📲 ${client?.nom || from}`,
          texte: texte.slice(0, 200),
          ecran: "messages",
          tag: `wa-${cle}`,
        }]);
      }
    } catch (e) {
      // Une notification qui ne part pas ne doit JAMAIS perdre le message :
      // il est déjà écrit, il s'affichera à la prochaine ouverture.
      console.error("[whatsapp-entrant] notification", e?.message || e);
    }

    return res.status(200).json({ ok: true, de: cle, proprietaire: proprietaire.id || "support" });
  } catch (e) {
    // ⚠ On répond 200 quand même : sinon YCloud renvoie le paquet sans fin.
    // Le motif part dans le journal Vercel, pas dans la réponse.
    console.error("[whatsapp-entrant]", e?.message || e);
    return res.status(200).json({ ok: false, erreur: "enregistrement impossible" });
  }
}
