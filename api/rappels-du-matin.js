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
// peut déclencher la tournée. Pour les notifications, elle LIT les tables
// et envoie ; elle n'écrit rien dans la base.
//
// ⌛ 26/09/2026 — LA RELANCE AUTOMATIQUE D'UN DEVIS À 8 JOURS (Timo : « texte
// ok, une seule relance, lance »). Même tournée, même heure. Règle pure :
// src/lib/relanceAutoDevis.js. Pour ELLE seulement, la tournée écrit —
// et seulement APRÈS que WhatsApp a accepté le message : la ligne du fil
// 📲 WhatsApp, sa fiche légère, et la marque `relance_auto_le` sur le devis.
// Un refus de WhatsApp (modèle pas encore approuvé…) part dans le journal
// Vercel et n'écrit rien : on retentera le lendemain, jusqu'au 15e jour.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { rappelsDuMatin } from "../src/lib/rappels.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";
import { relancesAutoDuJour, ligneRelanceAuto, enteteApresRelance, compteApresRelance, MODELE_RELANCE_AUTO } from "../src/lib/relanceAutoDevis.js";
import { idEntete, cleConversation } from "../src/lib/whatsappConversations.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { randomUUID } from "node:crypto";

const TABLES = ["users", "boutiques", "ventes", "dettes", "depenses", "clotures", "messages"];

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
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const db = {};
    for (const t of TABLES) db[t] = await lireTable(admin, t);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    // ⚠ La relance ne dépend pas des notifications : l'une en panne
    // n'empêche pas l'autre.
    const relances = await relancerLesDevis(admin, db, aujourdhui);
    if (!configurerWebPush()) return res.status(500).json({ error: "Notifications non configurées sur le serveur (VAPID_PRIVATE_KEY).", relances });
    const envois = rappelsDuMatin(db, aujourdhui);
    const bilan = envois.length ? await envoyerAuxPersonnes(admin, envois) : { appareils: 0, envoyes: 0, retires: 0 };
    return res.status(200).json({ ok: true, jour: aujourdhui, rappels: envois.length, ...bilan, relances });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}

// ---- ⌛ LA RELANCE AUTOMATIQUE À 8 JOURS ----
// Rend { a_relancer, envoyees, refusees }. Rien n'est écrit tant que
// WhatsApp n'a pas accepté (un fil qui ment est pire qu'un fil vide).
async function relancerLesDevis(admin, db, aujourdhui) {
  const liste = relancesAutoDuJour(db, aujourdhui);
  const bilan = { a_relancer: liste.length, envoyees: 0, refusees: 0 };
  if (!liste.length) return bilan;
  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  if (!cle || !expediteur) { console.error("[rappels-du-matin] relance auto : WhatsApp non configuré sur le serveur"); return bilan; }
  for (const r of liste) {
    try {
      const envoi = await envoyerYCloud(cle, {
        from: expediteur, to: r.tel, type: "template",
        template: { name: MODELE_RELANCE_AUTO, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: r.envoi.variables.map((text) => ({ type: "text", text })) }] },
      });
      if (!envoi.ok) { bilan.refusees++; console.error("[rappels-du-matin] relance auto refusée", envoi.code_whatsapp, envoi.motif); continue; }
      bilan.envoyees++;
      const ts = new Date().toISOString();
      const ligneBase = ligneRelanceAuto({ id: randomUUID(), tel: r.tel, compte: r.compte, devis: r.devis, variables: r.envoi.variables, ts });
      // ✓✓ Le numéro de suivi, pour les coches (lib/suiviEnvoi.js).
      const ligne = ligneBase ? { ...ligneBase, ...champsEnvoi(envoi) } : null;
      if (ligne) {
        const { error } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: ts });
        if (error) console.error("[rappels-du-matin] relance auto : ligne du fil non écrite", error.message);
        const entete = (db.messages || []).find((m) => m.id === idEntete(cleConversation(r.tel)));
        const fiche = enteteApresRelance({ tel: r.tel, compte: r.compte, ts, entete });
        if (fiche) {
          const { error: e2 } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: ts });
          if (e2) console.error("[rappels-du-matin] relance auto : fiche légère non posée", e2.message);
        }
      }
      // La marque sur le devis : la fiche du client est RELUE juste avant,
      // pour ne pas réécrire une copie vieille de quelques secondes.
      const { data: frais } = await admin.from("users").select("id, data").eq("id", r.compte.id).maybeSingle();
      if (frais?.data) {
        // ⚠ `updated_at` dans la ligne ET dans la fiche, comme l'application
        // l'écrit (src/sync.js) : sans lui la marque ne descendrait pas.
        const data = { ...compteApresRelance({ ...frais.data, id: frais.id }, r.devis.id, ts), updated_at: ts };
        const { error: e3 } = await admin.from("users").update({ data, updated_at: ts }).eq("id", frais.id);
        if (e3) console.error("[rappels-du-matin] relance auto : marque du devis non posée", e3.message);
      }
    } catch (e) {
      console.error("[rappels-du-matin] relance auto", e?.message || e);
    }
  }
  return bilan;
}
