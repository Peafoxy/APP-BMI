// ============================================================
// api/notifier.js — ENVOYER les notifications décidées par l'application.
//
// L'application (App.jsx → lib/notifications.js) compare l'état avant et
// après chaque enregistrement et en tire une liste d'envois
// { destinataires, titre, texte, ecran, tag } ; src/push.js les met en
// file et les apporte ici. Le serveur vérifie QUI appelle (jeton de session,
// compte actif), borne ce qu'il reçoit (api/_push.js), retrouve les
// appareils des destinataires et envoie. Il n'écrit rien d'autre.
//
// Un compte bloqué ou inconnu ne peut rien envoyer. Un compte client peut
// appeler (il écrit dans son fil support) : ses envois sont bornés comme
// les autres.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { configurerWebPush, nettoyerEnvoi, envoyerAuxPersonnes, MAX_ENVOIS } from "./_push.js";

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, envois } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });
  const propres = (Array.isArray(envois) ? envois : []).map(nettoyerEnvoi).filter(Boolean).slice(0, MAX_ENVOIS);
  if (!propres.length) return res.status(200).json({ ok: true, envoyes: 0 });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  if (!configurerWebPush()) return res.status(500).json({ error: "Notifications non configurées sur le serveur (VAPID_PRIVATE_KEY)." });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    const id = auth.user.email.split("@")[0];
    const { data: fiche, error: errFiche } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errFiche) throw errFiche;
    const compte = fiche && fiche[0] ? fiche[0].data || {} : null;
    if (!compte || compte.actif === false) return res.status(403).json({ error: "Ce compte ne peut pas envoyer de notification." });

    // Personne ne se notifie soi-même par ce chemin.
    const sansMoi = propres.map((e) => ({ ...e, destinataires: e.destinataires.filter((d) => d !== id) })).filter((e) => e.destinataires.length);
    const bilan = await envoyerAuxPersonnes(admin, sansMoi);
    return res.status(200).json({ ok: true, ...bilan });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
