// ============================================================
// api/_relaisDevisPdf.js — LE DEVIS REPART SANS PDF (18/10/2026)
//
// Appelé par l'adresse d'arrivée (api/whatsapp-entrant.js) quand Meta
// rejette un `devis_pdf` (la règle : src/lib/relaisDevisPdf.js). Le « _ »
// n'en fait pas une fonction Vercel (douze au plus).
// ============================================================
import { relaisAFaire, envoiRelais, ligneRelais, enteteApresRelais } from "../src/lib/relaisDevisPdf.js";
import { idEntete } from "../src/lib/whatsappConversations.js";
import { numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { fmt } from "../src/lib/core.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";

export { relaisAFaire };

// 📎 LE DEVIS REPART SANS PDF (18/10/2026, lib/relaisDevisPdf.js) : la fiche
// du client est RELUE (le devis rangé chez lui), `devis_disponible` part, et
// la ligne n'est écrite qu'APRÈS l'accord de WhatsApp. Un refus est dit dans
// le journal du serveur et n'est pas retenté. Ne lève jamais : la coche est
// déjà posée.
export async function relayerDevisSansPdf(admin, ligne) {
  try {
    const { data: comptes, error } = await admin.from("users").select("id, data").contains("data", { devis: [{ id: ligne.devis_id }] }).limit(1);
    if (error) throw error;
    const c = comptes && comptes[0];
    const compte = c ? { ...(c.data || {}), id: c.id } : null;
    const envoi = compte ? envoiRelais({ compte, devisId: ligne.devis_id, fmt }) : null;
    if (!envoi) { console.error("[whatsapp-entrant] relais du devis sans PDF : devis introuvable, de formation ou à la corbeille", ligne.devis_id); return false; }
    const to = numeroWhatsApp(ligne.wa_numero || compte.tel);
    const { cle, expediteurBrut } = configYCloud();
    const expediteur = numeroWhatsApp(expediteurBrut);
    if (!to || !cle || !expediteur) { console.error("[whatsapp-entrant] relais du devis sans PDF : numéro ou WhatsApp non configuré"); return false; }
    const r = await envoyerYCloud(cle, {
      from: expediteur, to, type: "template",
      template: { name: envoi.modele, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: envoi.variables.map((text) => ({ type: "text", text })) }] },
    });
    if (!r.ok) { console.error("[whatsapp-entrant] relais du devis sans PDF refusé", r.code_whatsapp, r.motif); return false; }
    const ts = new Date().toISOString();
    const base = ligneRelais({ id: `wa-relais-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, ligne, variables: envoi.variables, ts });
    if (!base) return true;
    const nouvelle = { ...base, ...champsEnvoi(r), updated_at: ts };
    const { error: e1 } = await admin.from("messages").insert({ id: nouvelle.id, data: nouvelle, updated_at: ts });
    if (e1) console.error("[whatsapp-entrant] relais du devis sans PDF : ligne du fil non écrite", e1.message);
    const { data: ents } = await admin.from("messages").select("id, data").eq("id", idEntete(ligne.wa_tel)).limit(1);
    const entete = ents && ents[0] ? { ...(ents[0].data || {}), id: ents[0].id } : null;
    const fiche = enteteApresRelais({ ligne, ts, entete });
    if (fiche) {
      const { error: e2 } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: ts });
      if (e2) console.error("[whatsapp-entrant] relais du devis sans PDF : fiche légère non posée", e2.message);
    }
    return true;
  } catch (e) {
    console.error("[whatsapp-entrant] relais du devis sans PDF", e?.message || e);
    return false;
  }
}
