// ============================================================
// api/whatsapp-media.js — OUVRIR UN FICHIER REÇU D'UN CLIENT (20/09/2026)
//
// Timo, 20/09/2026, décision « 3a » : une photo, une note vocale ou un
// document envoyés par un client doivent s'ouvrir DANS le fil. Avant ce
// jour, ces messages étaient refusés à l'entrée — le client envoyait la
// photo de son compteur et personne ne savait qu'elle avait existé.
//
// ⚠⚠ POURQUOI UNE FONCTION SERVEUR, ET PAS UN SIMPLE LIEN DANS L'IMAGE :
// le lien que WhatsApp donne n'est ouvert à tous que quelques minutes ;
// ensuite il exige la clé YCloud. Cette clé ne vit que dans une variable
// Vercel — JAMAIS préfixée « VITE_ », qui l'embarquerait dans le paquet du
// navigateur, c'est-à-dire chez tout le monde. C'est donc le serveur qui
// va chercher le fichier et le rend.
//
// ⚠⚠ ET C'EST AUSSI CE QUI TIENT LE MUR DE LA VISIBILITÉ : un commercial
// ne doit pas ouvrir la photo d'une conversation qui ne lui appartient pas.
// La règle est IMPORTÉE (`peutVoirConversation`), jamais recopiée — et elle
// est revérifiée ICI, dans le geste, pas seulement à l'écran.
//
// ⚠ ON NE GARDE RIEN. Le fichier n'est pas rangé chez nous : il est lu et
// rendu. Conséquence à DIRE : WhatsApp efface ses fichiers au bout de
// 30 jours, et passé ce délai la photo n'existe plus nulle part. Les
// garder demanderait un espace de stockage — à la demande de Timo, pas de
// ma propre initiative.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { CANAL_WA, proprietaireDe, peutVoirConversation } from "../src/lib/whatsappConversations.js";

// 25 Mo : la limite de WhatsApp elle-même. Au-delà, ce n'est pas un fichier
// qu'un client a envoyé, c'est quelque chose qui ne devrait pas être là.
const TAILLE_MAX = 25 * 1024 * 1024;

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, message } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });
  if (!message) return res.status(400).json({ error: "Message introuvable." });

  const cleYcloud = process.env.YCLOUD_API_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    const id = auth.user.email.split("@")[0];

    const { data: fiche, error: errFiche } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errFiche) throw errFiche;
    const compte = fiche && fiche[0] ? { ...(fiche[0].data || {}), id } : null;
    if (!compte || compte.actif === false) return res.status(403).json({ error: "Ce compte ne peut pas ouvrir ce fichier." });

    const { data: lignes, error: errMsg } = await admin.from("messages").select("id, data");
    if (errMsg) throw errMsg;
    const messages = (lignes || []).map((l) => ({ ...(l.data || {}), id: l.id }));
    const ligne = messages.find((m) => m.id === message);
    if (!ligne || ligne.canal !== CANAL_WA) return res.status(404).json({ error: "Message introuvable." });
    const media = ligne.wa_media;
    if (!media || !media.lien) return res.status(404).json({ error: "Ce message ne porte aucun fichier." });

    // ⚠ LE MUR, REVÉRIFIÉ DANS LE GESTE : c'est le propriétaire du FIL qui
    // décide, pas le message tout seul — une réattribution pose une ligne
    // de plus, elle ne réécrit jamais l'histoire.
    const fil = messages.filter((m) => m.canal === CANAL_WA && m.wa_tel === ligne.wa_tel)
      .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
    const prop = proprietaireDe(fil);
    if (!peutVoirConversation(compte, { proprietaire_id: prop.id })) {
      return res.status(403).json({ error: "Cette conversation ne vous appartient pas." });
    }

    if (!cleYcloud) return res.status(500).json({ error: "WhatsApp n'est pas encore configuré sur le serveur." });

    const reponse = await fetch(media.lien, { headers: { "X-API-Key": cleYcloud } });
    if (!reponse.ok) {
      // ⚠ ON DIT POURQUOI, en français. Un cadre vide laisserait croire à
      // une panne de l'application alors que c'est WhatsApp qui a effacé.
      console.error("[whatsapp-media] refus", reponse.status, media.lien.slice(0, 60));
      const motif = reponse.status === 404 || reponse.status === 410
        ? "Ce fichier n'est plus disponible : WhatsApp les efface au bout de 30 jours."
        : "WhatsApp n'a pas rendu ce fichier.";
      return res.status(404).json({ error: motif });
    }
    const paquet = Buffer.from(await reponse.arrayBuffer());
    if (paquet.length > TAILLE_MAX) return res.status(413).json({ error: "Fichier trop volumineux." });

    res.setHeader("Content-Type", media.mime || reponse.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Content-Length", String(paquet.length));
    // Le fichier ne change jamais : le navigateur peut le garder une heure.
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.status(200).send(paquet);
  } catch (e) {
    console.error("[whatsapp-media]", e?.message || e);
    return res.status(500).json({ error: "Fichier indisponible." });
  }
}
