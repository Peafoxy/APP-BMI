// Fonction serveur Vercel (jamais envoyée au navigateur) : synchronise le
// mot de passe d'un utilisateur BMI avec un vrai compte d'authentification
// Supabase. Appelée uniquement APRÈS que l'application ait déjà vérifié
// localement que le mot de passe est correct — cette fonction ne fait que
// mettre en cohérence Supabase Auth avec ce qui a été vérifié.
//
// Utilise la clé "service_role" de Supabase, qui donne un accès total —
// c'est pourquoi elle ne doit JAMAIS être mise dans le fichier .env avec le
// préfixe VITE_ (ce qui l'enverrait au navigateur), mais uniquement comme
// variable d'environnement côté serveur sur Vercel.

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { id, motDePasse } = req.body || {};
  if (!id || !motDePasse || String(motDePasse).length < 4) {
    return res.status(400).json({ error: "Identifiant ou mot de passe invalide" });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) {
    return res.status(500).json({ error: "Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)" });
  }

  const admin = createClient(url, cleService, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `${id}@bmi.internal`;

  try {
    // Cherche si un compte d'authentification existe déjà pour cet utilisateur
    const { data: liste, error: erreurListe } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (erreurListe) throw erreurListe;
    const existant = liste.users.find((u) => u.email === email);

    if (existant) {
      const { error } = await admin.auth.admin.updateUserById(existant.id, { password: String(motDePasse) });
      if (error) { console.error("sync-auth updateUserById:", JSON.stringify(error)); throw error; }
    } else {
      const { error } = await admin.auth.admin.createUser({ email, password: String(motDePasse), email_confirm: true });
      if (error) { console.error("sync-auth createUser:", JSON.stringify(error)); throw error; }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("sync-auth erreur finale:", e?.message || e);
    return res.status(500).json({ error: e.message || "Erreur de synchronisation" });
  }
}
