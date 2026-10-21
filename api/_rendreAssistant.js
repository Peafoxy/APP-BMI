// ============================================================
// api/_rendreAssistant.js — 🤖 « RENDRE À L'ASSISTANT » (21/10/2026)
//
// Timo : « Nous même ne pouvons pas donner instruction à l'assistant de
// répondre à un message ? », puis « il ne peut pas continuer toute la
// conversation ? » → « 1 oui, et non pour le c, lance ». Un bouton de
// 📲 WhatsApp rend la conversation à l'assistant :
//   1. une ligne SYSTÈME porte la marque (`ligneRenduAssistant`) ;
//   2. si le DERNIER message est celui du client, resté sans réponse, et que
//      la fenêtre de 24 h est ouverte, l'assistant y répond TOUT DE SUITE —
//      par LE MÊME chemin que l'adresse d'arrivée (`repondreParAssistant`) ;
//   3. ensuite il continue seul, jusqu'à ce qu'une personne de BMI réécrive
//      (la règle vit dans lib/assistantWhatsapp.js : `renduActif`).
//
// ⚠ QUI : le personnel qui a 📲 WhatsApp, sur une conversation qu'il peut
// OUVRIR (`peutVoirConversation`, la règle IMPORTÉE : une conversation
// confiée ne se rend que par son propriétaire ou l'administrateur), jamais un
// compte de formation, jamais avec l'assistant coupé dans ⚙ Paramètres.
// Tout est revérifié ICI : l'écran ne fait que prévenir.
// ⚠ Ce n'est PAS une fonction à part (le « _ ») : douze au plus chez Vercel.
// api/whatsapp.js l'appelle quand la demande porte `action: "rendre_assistant"`.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { estALaCorbeille, filDeLaConversation, proprietaireDe, peutVoirConversation, aAccesWhatsapp, fenetre, CANAL_WA, CANAL_WA_ENTETE, idEntete, estEnteteWa } from "../src/lib/whatsappConversations.js";
import { assistantActif, assistantEnRetrait, ligneRenduAssistant, filPourReponse } from "../src/lib/assistantWhatsapp.js";
import { numeroComparable } from "../src/lib/identiteClient.js";
import { estCompteFormation } from "../src/lib/espace.js";
import { lireConversation } from "./_tables.js";
import { repondreParAssistant } from "./whatsapp-entrant.js";

// Le dernier message qui n'est ni une ligne système ni la fiche légère.
export const dernierMessage = (fil) => {
  const liste = Array.isArray(fil) ? fil : [];
  for (let i = liste.length - 1; i >= 0; i--) {
    const m = liste[i];
    if (m && !m.wa_systeme && m.canal !== CANAL_WA_ENTETE) return m;
  }
  return null;
};

export async function rendreAssistant(req, res, { adminClient = null, repondre = repondreParAssistant } = {}) {
  const { jeton, cle } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });
  const k = String(cle || "");
  if (!k) return res.status(400).json({ error: "Conversation introuvable." });

  let admin = adminClient;
  if (!admin) {
    const url = process.env.VITE_SUPABASE_URL;
    const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
    admin = createClient(url, cleService, { auth: { persistSession: false } });
  }

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée." });
    const id = auth.user.email.split("@")[0];
    const { data: ficheU, error: errU } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errU) throw errU;
    const compte = ficheU && ficheU[0] ? { ...(ficheU[0].data || {}), id } : null;
    if (!compte || compte.actif === false || !aAccesWhatsapp(compte)) {
      return res.status(403).json({ error: "Ce compte ne peut pas rendre une conversation à l'assistant." });
    }
    const { data: bqs, error: errBq } = await admin.from("boutiques").select("data");
    if (errBq) throw errBq;
    const boutiques = (bqs || []).map((b) => b.data || {});
    if (auth.user.app_metadata?.espace === "formation" || estCompteFormation({ users: [compte], boutiques }, compte)) {
      return res.status(403).json({ error: "Espace formation : les conversations WhatsApp n'existent qu'en réel." });
    }
    if (!assistantActif(boutiques)) {
      return res.status(409).json({ error: "L'assistant est coupé dans ⚙ Paramètres → 🤖 Assistant : il ne peut pas reprendre la conversation." });
    }

    // La conversation seule, page par page ; jamais une conversation à la corbeille.
    const lignes = await lireConversation(admin, k);
    const existe = lignes.some((m) => (m.canal === CANAL_WA || m.canal === CANAL_WA_ENTETE) && m.wa_tel === k && !estALaCorbeille(m));
    if (!existe) return res.status(404).json({ error: "Conversation introuvable." });
    const fil = filDeLaConversation(lignes, k);
    const proprietaire = proprietaireDe(fil);
    if (!peutVoirConversation(compte, { proprietaire_id: proprietaire.id })) {
      return res.status(403).json({ error: "Cette conversation est confiée à un collègue : seule cette personne, ou un administrateur, peut la rendre à l'assistant." });
    }
    const maintenant = new Date().toISOString();
    if (!assistantEnRetrait({ fil, proprietaireId: proprietaire.id, maintenant })) {
      return res.status(200).json({ ok: true, deja: true });
    }

    const ficheAvant = lignes.find((m) => m.id === idEntete(k) && estEnteteWa(m)) || null;
    const dernier = dernierMessage(fil);
    const tel = String((dernier && dernier.wa_numero) || ficheAvant?.wa_numero || k);
    const nomConv = (dernier && dernier.wa_nom) || ficheAvant?.wa_nom || "";
    // ⚠ La marque d'abord : sans elle, l'assistant se tairait (une personne a
    // écrit) — et elle reste même si la réponse immédiate ne part pas.
    const marque = ligneRenduAssistant({ cle: k, tel, nom: nomConv, par: compte.nom || id, par_id: id, ts: maintenant });
    const { error: errIns } = await admin.from("messages").insert({ id: marque.id, data: marque, updated_at: marque.ts });
    if (errIns) throw errIns;

    // Le client a parlé en DERNIER, sans réponse, et la fenêtre est ouverte :
    // l'assistant répond tout de suite. Sinon il répondra à son prochain message.
    if (!dernier || !dernier.wa_entrant) return res.status(200).json({ ok: true, repondu: false, pourquoi: "pas de message du client en attente de réponse" });
    if (!fenetre(fil, maintenant).ouverte) return res.status(200).json({ ok: true, repondu: false, pourquoi: "la fenêtre de 24 h est fermée" });
    const { data: comptes, error: errC } = await admin.from("users").select("id, data");
    if (errC) throw errC;
    const client = (comptes || []).map((l) => ({ ...(l.data || {}), id: l.id }))
      .find((u) => u.role === "client" && numeroComparable(u.tel) === k);
    let r = { repondu: false, pourquoi: "" };
    try {
      r = await repondre({
        admin, boutiques, fil: filPourReponse([...fil, marque], dernier), proprietaireId: proprietaire.id,
        cle: k, from: dernier.wa_numero || tel, client, ligne: dernier, entete: ficheAvant, attente: 0,
      });
    } catch (e) {
      // La marque est posée : l'assistant répondra au prochain message.
      console.error("[rendre-assistant] réponse immédiate", e?.message || e);
      r = { repondu: false, pourquoi: "réponse impossible pour le moment" };
    }
    return res.status(200).json({ ok: true, repondu: !!r.repondu, pourquoi: r.repondu ? "" : (r.pourquoi || "") });
  } catch (e) {
    console.error("[rendre-assistant]", e?.message || e);
    return res.status(500).json({ error: "Impossible de rendre la conversation pour le moment." });
  }
}
