// ============================================================
// api/rappels-du-soir.js — LA TOURNÉE DE 17 H (Vercel cron, 03/10/2026)
//
// Timo : « un message d'anniversaire… le jour J-1 à 17 h » → décision
// « 1b » : la VEILLE à 17 h, une notification à l'administrateur PRINCIPAL
// (« 🎂 Demain, c'est l'anniversaire de … ») ; les vœux eux-mêmes partent le
// jour même, à 7 h, du numéro BMI (api/rappels-du-matin.js).
// Lomé est à GMT+0 : « 0 17 * * * » = 17 h à Lomé.
// La règle vit dans src/lib/anniversaires.js (rappelVeilleAnniversaires) ;
// ici on ne fait que lire les tables et envoyer. Rien n'est écrit.
// Depuis « 1c » (le même jour), le rappel part AUSSI par WhatsApp sur le
// numéro de l'administrateur (modèle `rappel_anniversaire`).
// L'appel exige CRON_SECRET, comme la tournée du matin.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { fabriquerEnvoi } from "../src/lib/rappels.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";
import { rappelVeilleAnniversaires, rappelWhatsAppVeille } from "../src/lib/anniversaires.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";
import { lireTable } from "./_tables.js";

const TABLES = ["users", "boutiques"];

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Appel non autorisé." });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const db = {};
    for (const t of TABLES) db[t] = await lireTable(admin, t);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const rappel = rappelVeilleAnniversaires(db, aujourdhui);
    if (!rappel) return res.status(200).json({ ok: true, jour: aujourdhui, anniversaires_demain: 0 });
    // 🎂 « 1c » : le WhatsApp à l'administrateur part AVANT la notification
    // et sans dépendre d'elle (l'un en panne n'empêche pas l'autre).
    const whatsapp = await rappelerParWhatsApp(db, aujourdhui);
    if (!configurerWebPush()) return res.status(500).json({ error: "Notifications non configurées sur le serveur (VAPID_PRIVATE_KEY).", whatsapp });
    const envoi = fabriquerEnvoi({ ...rappel, ecran: "users" });
    const bilan = envoi ? await envoyerAuxPersonnes(admin, [envoi]) : { appareils: 0, envoyes: 0, retires: 0 };
    return res.status(200).json({ ok: true, jour: aujourdhui, anniversaires_demain: 1, ...bilan, whatsapp });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}

// Le rappel par WhatsApp, du numéro BMI vers celui de l'administrateur.
// Rien n'est écrit dans la base (comme l'alerte conseiller) ; un refus part
// dans le journal Vercel.
async function rappelerParWhatsApp(db, aujourdhui) {
  const r = rappelWhatsAppVeille(db, aujourdhui);
  if (!r) return "aucun numéro";
  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  if (!cle || !expediteur) { console.error("[rappels-du-soir] WhatsApp non configuré sur le serveur"); return "non configuré"; }
  try {
    const envoi = await envoyerYCloud(cle, {
      from: expediteur, to: r.tel, type: "template",
      template: { name: r.envoi.modele, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: r.envoi.variables.map((text) => ({ type: "text", text })) }] },
    });
    if (!envoi.ok) { console.error("[rappels-du-soir] rappel d'anniversaire refusé", envoi.code_whatsapp, envoi.motif); return "refusé"; }
    return "envoyé";
  } catch (e) {
    console.error("[rappels-du-soir] rappel d'anniversaire", e?.message || e);
    return "erreur";
  }
}
