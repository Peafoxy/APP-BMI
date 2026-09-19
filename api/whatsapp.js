// ============================================================
// api/whatsapp.js — ENVOYER UN MESSAGE WHATSAPP DEPUIS LE NUMÉRO BMI
//
// Timo, 19/09/2026 : « lance l'étape 1 ». L'application décide QUOI envoyer
// et à QUI ; ce fichier le remet à YCloud, qui le remet à WhatsApp. Il
// n'écrit RIEN dans la base — la trace est posée par l'application, par son
// `save()` habituel, comme tout le reste.
//
// ⚠⚠ LA CLÉ YCLOUD NE VIT QUE DANS UNE VARIABLE VERCEL (`YCLOUD_API_KEY`).
// Elle n'est JAMAIS dans le code, et surtout JAMAIS préfixée « VITE_ » :
// Vite embarquerait une clé préfixée ainsi dans le paquet envoyé au
// navigateur, c'est-à-dire chez tout le monde. Même règle que
// VAPID_PRIVATE_KEY et SUPABASE_SERVICE_ROLE_KEY.
//
// ⚠⚠ LE COUPLE : la liste des modèles est IMPORTÉE de l'application
// (src/lib/whatsappModeles.js), jamais recopiée. Le serveur refuse tout nom
// absent de cette liste et compte les variables avec elle.
//
// ⚠⚠ LE MUR. Un compte de FORMATION n'écrit jamais à un vrai client, et le
// serveur le revérifie lui-même (`estCompteFormation`) : l'application peut
// se tromper, la base non. ⚠ Ce contrôle-ci ne voit que ce qu'EST le compte
// qui appelle ; l'espace de la DONNÉE (le devis regardé) est vérifié dans
// l'écran, et c'est lui qui compte pour l'administrateur principal, dont le
// compte est réel même quand il regarde la formation. Deux barrières, qui
// ne protègent pas la même chose — et on le dit plutôt que de laisser
// croire que le serveur suffit.
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { poserCors } from "./_cors.js";
import { estCompteFormation } from "../src/lib/espace.js";
import { MODELES, LANGUE_MODELES, critiqueModele, numeroWhatsApp, texteVariable } from "../src/lib/whatsappModeles.js";

const URL_YCLOUD = "https://api.ycloud.com/v2/whatsapp/messages";

// Les rôles qui n'écrivent jamais au nom de BMI : un client (il a son fil
// dans 💬 Messages) et un compte bloqué.
const ROLE_INTERDIT = (compte) => !compte || compte.actif === false || compte.role === "client";

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, tel, modele, variables } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });

  // ⚠ On borne AVANT de regarder quoi que ce soit d'autre : un corps de
  // requête vient du dehors, il ne se croit pas sur parole.
  const nom = String(modele || "");
  const valeurs = (Array.isArray(variables) ? variables : []).map(texteVariable);
  const refus = critiqueModele(nom, valeurs);
  if (refus) return res.status(400).json({ error: refus });
  const destinataire = numeroWhatsApp(tel);
  if (!destinataire) return res.status(400).json({ error: "Numéro de téléphone absent ou illisible." });

  const cle = process.env.YCLOUD_API_KEY;
  const expediteur = numeroWhatsApp(process.env.WHATSAPP_NUMERO_BMI);
  if (!cle || !expediteur) {
    return res.status(500).json({ error: "WhatsApp n'est pas encore configuré sur le serveur (YCLOUD_API_KEY, WHATSAPP_NUMERO_BMI)." });
  }
  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
    const id = auth.user.email.split("@")[0];

    const { data: fiche, error: errFiche } = await admin.from("users").select("data").eq("id", id).limit(1);
    if (errFiche) throw errFiche;
    const compte = fiche && fiche[0] ? { ...(fiche[0].data || {}), id } : null;
    if (ROLE_INTERDIT(compte)) return res.status(403).json({ error: "Ce compte ne peut pas envoyer de message au nom de BMI." });

    // Le mur, côté base : la boutique du compte dit son espace.
    const { data: bqs, error: errBq } = await admin.from("boutiques").select("data");
    if (errBq) throw errBq;
    const boutiques = (bqs || []).map((b) => b.data || {});
    if (estCompteFormation({ users: [compte], boutiques }, compte)) {
      return res.status(403).json({ error: "Espace formation : aucun vrai message WhatsApp ne part d'ici." });
    }

    const corps = {
      from: expediteur,
      to: destinataire,
      type: "template",
      template: {
        name: nom,
        language: { code: LANGUE_MODELES },
        components: [{ type: "body", parameters: valeurs.map((text) => ({ type: "text", text })) }],
      },
    };
    const reponse = await fetch(URL_YCLOUD, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": cle },
      body: JSON.stringify(corps),
    });
    const resultat = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      // ⚠ On rend le motif de WhatsApp tel quel : « modèle non approuvé »,
      // « ce client a refusé les messages commerciaux »… L'écran a besoin de
      // le DIRE, sinon personne ne peut comprendre pourquoi rien ne part.
      const motif = resultat?.error?.message || resultat?.message || `WhatsApp a répondu ${reponse.status}.`;
      return res.status(502).json({ error: motif, statut_whatsapp: reponse.status });
    }
    return res.status(200).json({ ok: true, id: resultat?.id || "", statut: resultat?.status || "envoye", modele: nom });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
