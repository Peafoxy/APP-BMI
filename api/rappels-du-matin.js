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
//
// 🔧 26/09/2026 — LE RAPPEL D'ENTRETIEN (Timo : « 5 », « 10 jours »). Même
// tournée. Règle pure : src/lib/rappelEntretien.js. Dix jours avant la date
// d'entretien d'un chantier : le modèle `rappel_entretien` au client (écrit
// APRÈS l'accord de WhatsApp, comme la relance), et une tâche ✅ pour le chef
// du chantier, avec sa notification. La marque `rappel_entretien` sur le
// chantier empêche qu'un geste reparte pour la même date.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { rappelsDuMatin } from "../src/lib/rappels.js";
import { configurerWebPush, envoyerAuxPersonnes } from "./_push.js";
import { relancesAutoDuJour, ligneRelanceAuto, enteteApresRelance, compteApresRelance, MODELE_RELANCE_AUTO } from "../src/lib/relanceAutoDevis.js";
import { idEntete, cleConversation } from "../src/lib/whatsappConversations.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { rappelsEntretienDuJour, ligneRappelEntretien, enteteApresRappel, chantierApresRappel, tacheEntretien, notificationTache, tacheEntretienExiste, MODELE_RAPPEL_ENTRETIEN } from "../src/lib/rappelEntretien.js";
import { randomUUID } from "node:crypto";

const TABLES = ["users", "boutiques", "ventes", "dettes", "depenses", "clotures", "messages", "clients_installes"];

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
    // 🔧 Les entretiens : le message au client et la tâche du chef. Les
    // notifications des tâches rejoignent celles de la tournée.
    const entretiens = await rappelerLesEntretiens(admin, db, aujourdhui);
    if (!configurerWebPush()) return res.status(500).json({ error: "Notifications non configurées sur le serveur (VAPID_PRIVATE_KEY).", relances, entretiens: entretiens.bilan });
    const envois = [...rappelsDuMatin(db, aujourdhui), ...entretiens.notifications];
    const bilan = envois.length ? await envoyerAuxPersonnes(admin, envois) : { appareils: 0, envoyes: 0, retires: 0 };
    return res.status(200).json({ ok: true, jour: aujourdhui, rappels: envois.length, ...bilan, relances, entretiens: entretiens.bilan });
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

// ---- 🔧 LE RAPPEL D'ENTRETIEN ----
// Rend { bilan, notifications }. Le message au client n'écrit rien tant que
// WhatsApp ne l'a pas accepté ; la tâche, elle, ne dépend pas de WhatsApp.
async function rappelerLesEntretiens(admin, db, aujourdhui) {
  const liste = rappelsEntretienDuJour(db, aujourdhui);
  const bilan = { a_rappeler: liste.length, messages: 0, refuses: 0, taches: 0 };
  const notifications = [];
  if (!liste.length) return { bilan, notifications };
  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  for (const r of liste) {
    try {
      const ts = new Date().toISOString();
      const marque = {};
      if (r.whatsapp && cle && expediteur) {
        const envoi = await envoyerYCloud(cle, {
          from: expediteur, to: r.tel, type: "template",
          template: { name: MODELE_RAPPEL_ENTRETIEN, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: r.envoi.variables.map((text) => ({ type: "text", text })) }] },
        });
        if (!envoi.ok) { bilan.refuses++; console.error("[rappels-du-matin] rappel d'entretien refusé", envoi.code_whatsapp, envoi.motif); }
        else {
          bilan.messages++;
          marque.whatsapp_le = aujourdhui;
          const ligneBase = ligneRappelEntretien({ id: randomUUID(), tel: r.tel, compte: r.compte, chantier: r.chantier, variables: r.envoi.variables, ts });
          const ligne = ligneBase ? { ...ligneBase, ...champsEnvoi(envoi) } : null;
          if (ligne) {
            const { error } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: ts });
            if (error) console.error("[rappels-du-matin] rappel d'entretien : ligne du fil non écrite", error.message);
            const entete = (db.messages || []).find((m) => m.id === idEntete(cleConversation(r.tel)));
            const fiche = enteteApresRappel({ tel: r.tel, compte: r.compte, chantier: r.chantier, ts, entete });
            if (fiche) {
              const { error: e2 } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: ts });
              if (e2) console.error("[rappels-du-matin] rappel d'entretien : fiche légère non posée", e2.message);
            }
          }
        }
      } else if (r.whatsapp) {
        console.error("[rappels-du-matin] rappel d'entretien : WhatsApp non configuré sur le serveur");
      }
      if (r.tache) {
        // La fiche du responsable est RELUE juste avant, pour ne pas réécrire
        // une copie vieille de quelques secondes ni poser la tâche deux fois.
        const { data: frais } = await admin.from("users").select("id, data").eq("id", r.pour.id).maybeSingle();
        if (frais?.data && !tacheEntretienExiste(frais.data, r.chantier)) {
          const tache = tacheEntretien({ id: randomUUID(), chantier: r.chantier, aujourdhui });
          const data = { ...frais.data, taches: [...(frais.data.taches || []), tache], updated_at: ts };
          const { error: e3 } = await admin.from("users").update({ data, updated_at: ts }).eq("id", frais.id);
          if (e3) console.error("[rappels-du-matin] rappel d'entretien : tâche non posée", e3.message);
          else { bilan.taches++; marque.tache_le = aujourdhui; marque.tache_pour = frais.data.nom || ""; notifications.push(notificationTache({ pour: r.pour, chantier: r.chantier })); }
        } else if (frais?.data) {
          marque.tache_le = aujourdhui; marque.tache_pour = frais.data.nom || "";
        }
      }
      if (marque.whatsapp_le || marque.tache_le) {
        const { data: fraisC } = await admin.from("clients_installes").select("id, data").eq("id", r.chantier.id).maybeSingle();
        // Une date changée entre-temps (entretien fait, reporté) : on ne
        // marque pas l'ancienne sur la nouvelle.
        if (fraisC?.data && String(fraisC.data.date_entretien || "").slice(0, 10) === String(r.chantier.date_entretien).slice(0, 10)) {
          const data = { ...chantierApresRappel({ ...fraisC.data, id: fraisC.id }, marque), updated_at: ts };
          const { error: e4 } = await admin.from("clients_installes").update({ data, updated_at: ts }).eq("id", fraisC.id);
          if (e4) console.error("[rappels-du-matin] rappel d'entretien : marque du chantier non posée", e4.message);
        }
      }
    } catch (e) {
      console.error("[rappels-du-matin] rappel d'entretien", e?.message || e);
    }
  }
  return { bilan, notifications };
}
