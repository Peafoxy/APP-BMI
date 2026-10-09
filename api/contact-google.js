// ============================================================
// api/contact-google.js — 📇 ENREGISTRER UN CLIENT WHATSAPP DANS LES
// CONTACTS GOOGLE DE BMI (09/10/2026, « a1, b2 » de Timo)
//
// Le compte : bmitogo.info@gmail.com. L'accès Google vit dans TROIS
// variables Vercel, côté serveur seulement — jamais préfixées « VITE_ » :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// (le « jeton de renouvellement » obtenu une fois, avec la permission
// « contacts », en se connectant au compte bmitogo.info).
// Sans elles : on le DIT, rien ne part, rien ne casse.
//
// ⚠ L'ADMINISTRATEUR SEUL, revérifié ICI (pas seulement à l'écran), et
// jamais un compte de formation : les contacts de BMI sont de vrais clients.
// ⚠ On ne crée pas de doublon : on cherche d'abord le numéro chez Google.
// ⚠ Rien n'est écrit dans notre base par cette fonction : la trace sur la
// fiche de la conversation est posée par l'écran, APRÈS la réponse.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { critiqueContactGoogle, corpsContactGoogle, contactExistant, numeroInternational, nettoyerNomGoogle } from "../src/lib/contactGoogle.js";
import { CANAL_WA, CANAL_WA_ENTETE, estALaCorbeille } from "../src/lib/whatsappConversations.js";

const PEOPLE = "https://people.googleapis.com/v1";

async function jetonGoogle() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return { code: "non_configure" };
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    console.error("[contact-google] jeton refusé", r.status, j?.error || "", j?.error_description || "");
    return { code: "autorisation" };
  }
  return { jeton: j.access_token };
}

// Chercher le numéro chez Google avant de créer. ⚠ La forme exacte de la
// correspondance par numéro n'a pas pu être vérifiée d'ici : si la
// recherche échoue, on crée quand même (un doublon vaut mieux qu'un client
// non enregistré), et le journal le dit.
async function chercher(jeton, tel) {
  const entete = { Authorization: `Bearer ${jeton}` };
  const masque = "readMask=names,phoneNumbers&pageSize=10";
  try {
    // Google demande une recherche « à vide » pour réchauffer son cache.
    await fetch(`${PEOPLE}/people:searchContacts?query=&${masque}`, { headers: entete });
    for (const q of [numeroInternational(tel), String(tel).replace(/\D/g, "").slice(-8)]) {
      const r = await fetch(`${PEOPLE}/people:searchContacts?query=${encodeURIComponent(q)}&${masque}`, { headers: entete });
      if (!r.ok) { console.error("[contact-google] recherche refusée", r.status); return null; }
      const j = await r.json().catch(() => ({}));
      const trouve = contactExistant(j.results, tel);
      if (trouve) return trouve;
    }
  } catch (e) {
    console.error("[contact-google] recherche", e?.message || e);
  }
  return null;
}

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, cle, nom, tel } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée." });
    const id = auth.user.email.split("@")[0];
    const { data: fiche, error: errFiche } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errFiche) throw errFiche;
    const compte = fiche && fiche[0] ? { ...(fiche[0].data || {}), id } : null;
    if (!compte || compte.formation === true || auth.user.app_metadata?.espace === "formation") {
      return res.status(403).json({ error: "Un compte de formation n'enregistre pas de contact dans le compte Google de BMI." });
    }
    const refus = critiqueContactGoogle(compte, { nom, tel });
    if (refus) return res.status(403).json({ error: refus });

    // La conversation doit exister (et ne pas être à la corbeille) : on
    // n'enregistre pas un numéro inventé au nom de BMI.
    const { data: lignes, error: errMsg } = await admin.from("messages").select("id, data");
    if (errMsg) throw errMsg;
    const k = String(cle || "");
    const existe = (lignes || []).some((l) => {
      const m = l.data || {};
      return (m.canal === CANAL_WA || m.canal === CANAL_WA_ENTETE) && m.wa_tel === k && !estALaCorbeille(m);
    });
    if (!k || !existe) return res.status(404).json({ error: "Conversation introuvable." });

    const g = await jetonGoogle();
    if (g.code) return res.status(503).json({ code: g.code });

    const deja = await chercher(g.jeton, tel);
    if (deja) return res.status(200).json({ ok: true, deja: true, nom: deja.nom || nettoyerNomGoogle(nom) });

    const note = `Client WhatsApp BMI — enregistré depuis l'application par ${compte.nom || id}.`;
    const r = await fetch(`${PEOPLE}/people:createContact?personFields=names,phoneNumbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${g.jeton}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpsContactGoogle({ nom, tel, note })),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      console.error("[contact-google] création refusée", r.status, j?.error?.message || "");
      return res.status(502).json({ code: r.status === 401 || r.status === 403 ? "autorisation" : "google" });
    }
    return res.status(200).json({ ok: true, nom: nettoyerNomGoogle(nom) });
  } catch (e) {
    console.error("[contact-google]", e?.message || e);
    return res.status(500).json({ error: "Enregistrement impossible pour le moment." });
  }
}
