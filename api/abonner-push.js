// ============================================================
// api/abonner-push.js — RATTACHER (ou détacher) l'appareil qui appelle à la
// personne connectée. Table abonnements_push, réservée à la clé service_role
// (aucune politique côté navigateur : voir docs/etat-notifications-push.md).
//
// ⚠ On ne croit PAS l'appelant sur parole : le jeton est celui de sa session
// Supabase, seul le serveur peut le vérifier — l'identifiant de la personne
// vient du jeton, jamais du corps de la requête. Un même appareil (même
// `endpoint`) n'est rattaché qu'à UNE personne : la dernière connectée.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { TABLE_ABONNEMENTS } from "./_push.js";

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, abonnement, appareil, retirer } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });
  const endpoint = String(abonnement?.endpoint || "");
  if (!endpoint.startsWith("https://")) return res.status(400).json({ error: "Abonnement invalide." });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    const id = auth.user.email.split("@")[0];

    if (retirer === true) {
      const { error } = await admin.from(TABLE_ABONNEMENTS).delete().eq("endpoint", endpoint).eq("user_id", id);
      if (error) throw error;
      return res.status(200).json({ ok: true, retire: true });
    }

    const cles = abonnement?.keys || {};
    if (!cles.p256dh || !cles.auth) return res.status(400).json({ error: "Abonnement incomplet." });
    const { error } = await admin.from(TABLE_ABONNEMENTS).upsert({
      endpoint,
      user_id: id,
      data: { keys: { p256dh: String(cles.p256dh), auth: String(cles.auth) }, appareil: String(appareil || "").slice(0, 160) },
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
