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
// 🎤 UNE NOTE VOCALE QUE BMI A ENVOYÉE (21/10/2026, « AVEC l'espace de
// fichiers privé de Supabase, il faut lancer pour 30 jours ») : YCloud ne
// rend pas un fichier déposé ; la note est donc rangée 30 jours dans l'espace
// PRIVÉ de Supabase (api/_vocauxStockes.js) et rendue ICI, APRÈS le même mur
// que pour un fichier reçu — et seulement si le chemin cité par la ligne est
// bien celui d'une note de CETTE conversation (src/lib/vocauxStockes.js).
//
// ⚠ UN FICHIER REÇU N'EST PAS RANGÉ CHEZ NOUS : il est lu et rendu.
// Conséquence à DIRE : WhatsApp efface ses fichiers au bout de 30 jours, et
// passé ce délai la photo n'existe plus nulle part. Seules les notes vocales
// envoyées par BMI sont gardées (décision de Timo du 21/10/2026).
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { lireConversation } from "./_tables.js";
import { CANAL_WA, proprietaireDe, peutVoirConversation, filDeLaConversation, estALaCorbeille } from "../src/lib/whatsappConversations.js";
import { critiqueEcouteVocal, lireCheminVocal } from "../src/lib/vocauxStockes.js";
import { lireVocal } from "./_vocauxStockes.js";

// 25 Mo : la limite de WhatsApp elle-même. Au-delà, ce n'est pas un fichier
// qu'un client a envoyé, c'est quelque chose qui ne devrait pas être là.
const TAILLE_MAX = 25 * 1024 * 1024;
const MOTIF_EFFACE = "Ce fichier n'est plus disponible : WhatsApp les efface au bout de 30 jours.";

// Le fichier reçu de WhatsApp, rendu tel quel.
async function rendre(res, reponse, media) {
  const paquet = Buffer.from(await reponse.arrayBuffer());
  if (paquet.length > TAILLE_MAX) return res.status(413).json({ error: "Fichier trop volumineux." });
  res.setHeader("Content-Type", media.mime || reponse.headers.get("content-type") || "application/octet-stream");
  res.setHeader("Content-Length", String(paquet.length));
  // Le fichier ne change jamais : le navigateur peut le garder une heure.
  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.status(200).send(paquet);
}

// La note vocale rangée, rendue telle quelle.
function rendreVocal(res, lu) {
  res.setHeader("Content-Type", lu.type || "audio/ogg");
  res.setHeader("Content-Length", String(lu.octets.length));
  res.setHeader("Cache-Control", "private, max-age=3600");
  return res.status(200).send(lu.octets);
}

export default async function handler(req, res, { adminClient = null } = {}) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, message } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });
  if (!message) return res.status(400).json({ error: "Message introuvable." });

  const cleYcloud = process.env.YCLOUD_API_KEY;
  let admin = adminClient;
  if (!admin) {
    const url = process.env.VITE_SUPABASE_URL;
    const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
    admin = createClient(url, cleService, { auth: { persistSession: false } });
  }

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    const id = auth.user.email.split("@")[0];

    const { data: fiche, error: errFiche } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errFiche) throw errFiche;
    const compte = fiche && fiche[0] ? { ...(fiche[0].data || {}), id } : null;
    if (!compte || compte.actif === false) return res.status(403).json({ error: "Ce compte ne peut pas ouvrir ce fichier." });

    // ⚠ LA LIGNE PAR SON id, PUIS SA CONVERSATION SEULE (18/10/2026) : la
    // table entière était coupée à 1 000 lignes par la base.
    const { data: trouvees, error: errMsg } = await admin.from("messages").select("id, data").eq("id", String(message)).limit(1);
    if (errMsg) throw errMsg;
    const ligne = trouvees && trouvees[0] ? { ...(trouvees[0].data || {}), id: trouvees[0].id } : null;
    if (!ligne || ligne.canal !== CANAL_WA || estALaCorbeille(ligne)) return res.status(404).json({ error: "Message introuvable." });
    const messages = await lireConversation(admin, ligne.wa_tel);
    const media = ligne.wa_media;
    const vocalEnvoye = !!(media && media.envoye && media.stocke);
    if (!media || (!media.lien && !vocalEnvoye)) return res.status(404).json({ error: "Ce message ne porte aucun fichier." });

    // ⚠ LE MUR, REVÉRIFIÉ DANS LE GESTE : c'est le propriétaire du FIL qui
    // décide, pas le message tout seul — une réattribution pose une ligne
    // de plus, elle ne réécrit jamais l'histoire.
    const fil = filDeLaConversation(messages, ligne.wa_tel);
    const prop = proprietaireDe(fil);
    if (!peutVoirConversation(compte, { proprietaire_id: prop.id })) {
      return res.status(403).json({ error: "Cette conversation ne vous appartient pas." });
    }

    // 🎤 La note vocale envoyée par BMI : le chemin doit être celui d'une note
    // de CETTE conversation, et de moins de 30 jours.
    if (vocalEnvoye) {
      const refus = critiqueEcouteVocal(ligne, new Date().toISOString().slice(0, 10));
      if (refus) return res.status(404).json({ error: refus });
      const lu = await lireVocal(admin, media.stocke, lireCheminVocal(media.stocke).type);
      if (lu.motif) return res.status(404).json({ error: lu.motif });
      return rendreVocal(res, lu);
    }

    if (!cleYcloud) return res.status(500).json({ error: "WhatsApp n'est pas encore configuré sur le serveur." });

    const reponse = await fetch(media.lien, { headers: { "X-API-Key": cleYcloud } });
    if (!reponse.ok) {
      // ⚠ ON DIT POURQUOI, en français. Un cadre vide laisserait croire à
      // une panne de l'application alors que c'est WhatsApp qui a effacé.
      console.error("[whatsapp-media] refus", reponse.status, media.lien.slice(0, 60));
      const motif = reponse.status === 404 || reponse.status === 410
        ? MOTIF_EFFACE
        : "WhatsApp n'a pas rendu ce fichier.";
      return res.status(404).json({ error: motif });
    }
    return rendre(res, reponse, media);
  } catch (e) {
    console.error("[whatsapp-media]", e?.message || e);
    return res.status(500).json({ error: "Fichier indisponible." });
  }
}
