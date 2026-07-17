// Fonction serveur Vercel — ÉCRAN DE CONTRÔLE avant durcissement.
//
// Elle répond à une seule question, mais la bonne : « quels utilisateurs BMI
// possèdent réellement un compte d'authentification Supabase ? »
//
// Sans compte d'authentification, un utilisateur ne pourra PLUS RIEN
// synchroniser dès que la sécurité sera activée : ses écritures seront
// refusées par la base et resteront « en attente » pour toujours.
//
// Utilise la clé "service_role" (accès total) : elle reste côté serveur et
// n'est jamais envoyée au navigateur. Ne renvoie AUCUN mot de passe.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) {
    return res.status(500).json({ error: "Configuration serveur manquante : la variable SUPABASE_SERVICE_ROLE_KEY n'est pas définie sur Vercel." });
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: "Liste d'identifiants attendue" });

  const admin = createClient(url, cleService, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    // On parcourt toutes les pages : au-delà de 1000 comptes, une seule page
    // en oublierait — et un utilisateur oublié, c'est une synchronisation morte.
    const emails = new Set();
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      (data.users || []).forEach((u) => u.email && emails.add(u.email.toLowerCase()));
      if (!data.users || data.users.length < 1000) break;
      page += 1;
      if (page > 20) break; // garde-fou
    }

    const existants = ids.filter((id) => emails.has(`${String(id).toLowerCase()}@bmi.internal`));
    return res.status(200).json({ existants, total: emails.size });
  } catch (e) {
    return res.status(500).json({ error: `Supabase : ${e?.message || e}` });
  }
}
