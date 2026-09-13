// ============================================================
// api/rappels-du-matin.js — LA TOURNÉE DU MATIN des notifications « pour
// information » qui dépendent du jour : une caisse d'hier non clôturée, une
// dette qui passe les 30 jours, un devis qui atteint ses 15 jours sans
// réponse. Règle pure : src/lib/rappels.js (le serveur l'importe telle
// quelle — pas de copie).
//
// Lancée par Vercel chaque matin (vercel.json → crons, 07:00, heure de
// Lomé = UTC). Vercel signe l'appel avec la variable CRON_SECRET : sans
// elle, ou avec une autre valeur, la fonction refuse — personne d'autre ne
// peut déclencher la tournée. Elle LIT les tables et envoie ; elle n'écrit
// rien dans la base.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { rappelsDuMatin } from "../src/lib/rappels.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";

const TABLES = ["users", "boutiques", "ventes", "dettes", "depenses", "clotures"];

async function lireTable(admin, table) {
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

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Appel non autorisé." });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  if (!configurerWebPush()) return res.status(500).json({ error: "Notifications non configurées sur le serveur (VAPID_PRIVATE_KEY)." });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const db = {};
    for (const t of TABLES) db[t] = await lireTable(admin, t);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const envois = rappelsDuMatin(db, aujourdhui);
    const bilan = envois.length ? await envoyerAuxPersonnes(admin, envois) : { appareils: 0, envoyes: 0, retires: 0 };
    return res.status(200).json({ ok: true, jour: aujourdhui, rappels: envois.length, ...bilan });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
