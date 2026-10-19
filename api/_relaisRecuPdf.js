// ============================================================
// api/_relaisRecuPdf.js — LE REÇU ET LA PROFORMA REPARTENT EN TEXTE (19/10/2026)
//
// Appelé par l'adresse d'arrivée (api/whatsapp-entrant.js) quand Meta
// rejette un `recu_pdf` ou un `proforma_pdf` (la règle :
// src/lib/relaisRecuPdf.js). Le « _ » n'en fait pas une fonction Vercel
// (douze au plus).
// ============================================================
import { relaisRecuAFaire, envoisDuRelais, ligneRelaisRecu, enteteApresRelaisRecu } from "../src/lib/relaisRecuPdf.js";
import { idEntete } from "../src/lib/whatsappConversations.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";

export { relaisRecuAFaire };

// Pour un reçu de VENTE (ligne privée, sans détail) : la vente, sa boutique et
// la dette née d'elle, RELUES — la fabrique de l'envoi recompose le texte.
async function lireVente(admin, venteId) {
  const { data: vs, error } = await admin.from("ventes").select("id, data").eq("id", venteId).limit(1);
  if (error) throw error;
  const v = vs && vs[0];
  if (!v) return { vente: null, boutique: {}, dette: null };
  const vente = { ...(v.data || {}), id: v.id };
  const { data: bqs } = await admin.from("boutiques").select("data");
  const boutique = ((bqs || []).map((b) => b.data || {})).find((b) => b.nom === vente.boutique) || {};
  const { data: ds } = await admin.from("dettes").select("id, data").eq("data->>vente_id", vente.id).limit(1);
  const dette = ds && ds[0] ? { ...(ds[0].data || {}), id: ds[0].id } : null;
  return { vente, boutique, dette };
}

// 📎 Le texte part (le détaillé d'abord pour une vente), et la ligne n'est
// écrite qu'APRÈS l'accord de WhatsApp. Un refus est dit dans le journal du
// serveur et n'est pas retenté. Ne lève jamais : la coche est déjà posée.
export async function relayerRecuSansPdf(admin, ligne) {
  try {
    const lu = ligne.wa_relais_texte ? { vente: null, boutique: {}, dette: null } : await lireVente(admin, ligne.vente_id);
    const envois = envoisDuRelais({ ligne, ...lu });
    if (!envois.length) { console.error("[whatsapp-entrant] relais du reçu sans PDF : rien à envoyer (vente introuvable, de formation, ou texte absent)", ligne.id); return false; }
    const to = numeroWhatsApp(ligne.wa_numero);
    const { cle, expediteurBrut } = configYCloud();
    const expediteur = numeroWhatsApp(expediteurBrut);
    if (!to || !cle || !expediteur) { console.error("[whatsapp-entrant] relais du reçu sans PDF : numéro ou WhatsApp non configuré"); return false; }
    for (const envoi of envois) {
      const r = await envoyerYCloud(cle, {
        from: expediteur, to, type: "template",
        template: { name: envoi.modele, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: envoi.variables.map((text) => ({ type: "text", text })) }] },
      });
      if (!r.ok) { console.error("[whatsapp-entrant] relais du reçu sans PDF refusé", envoi.modele, r.code_whatsapp, r.motif); continue; }
      const ts = new Date().toISOString();
      const base = ligneRelaisRecu({ id: `wa-relais-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ligne, envoi, ts });
      if (!base) return true;
      const nouvelle = { ...base, ...champsEnvoi(r), updated_at: ts };
      const { error: e1 } = await admin.from("messages").insert({ id: nouvelle.id, data: nouvelle, updated_at: ts });
      if (e1) console.error("[whatsapp-entrant] relais du reçu sans PDF : ligne du fil non écrite", e1.message);
      const { data: ents } = await admin.from("messages").select("id, data").eq("id", idEntete(ligne.wa_tel)).limit(1);
      const entete = ents && ents[0] ? { ...(ents[0].data || {}), id: ents[0].id } : null;
      const fiche = enteteApresRelaisRecu({ ligne, ts, entete });
      if (fiche) {
        const { error: e2 } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: ts });
        if (e2) console.error("[whatsapp-entrant] relais du reçu sans PDF : fiche légère non posée", e2.message);
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error("[whatsapp-entrant] relais du reçu sans PDF", e?.message || e);
    return false;
  }
}
