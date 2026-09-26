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
import { CANAL_WA, cleConversation, fenetre, libelleFenetre } from "../src/lib/whatsappConversations.js";
// ⚠ La porte vers YCloud est écrite UNE fois (api/_ycloud.js) : l'assistant
// du webhook envoie par la même — la clé et la lecture du refus y vivent.
import { configYCloud, envoyerYCloud, corpsTexte } from "./_ycloud.js";

// Les rôles qui n'écrivent jamais au nom de BMI : un client (il a son fil
// dans 💬 Messages) et un compte bloqué.
const ROLE_INTERDIT = (compte) => !compte || compte.actif === false || compte.role === "client";

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, tel, modele, variables, texte } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous." });

  // ⚠ DEUX FORMES, UNE SEULE PORTE (étape 2, 20/09/2026) : un MODÈLE
  // approuvé (le seul qui parte quand on veut), ou une RÉPONSE LIBRE dans
  // la fenêtre de 24 h ouverte par le client. La réponse libre ne porte
  // aucune variable : c'est du texte, écrit par une personne.
  const reponseLibre = !modele && typeof texte === "string";
  const motReponse = String(texte || "").trim();
  if (reponseLibre && !motReponse) return res.status(400).json({ error: "Écrivez d'abord votre message." });
  if (reponseLibre && motReponse.length > 4000) return res.status(400).json({ error: "Message trop long pour WhatsApp." });

  // ⚠ On borne AVANT de regarder quoi que ce soit d'autre : un corps de
  // requête vient du dehors, il ne se croit pas sur parole.
  const nom = String(modele || "");
  const valeurs = (Array.isArray(variables) ? variables : []).map(texteVariable);
  if (!reponseLibre) {
    const refus = critiqueModele(nom, valeurs);
    if (refus) return res.status(400).json({ error: refus });
  }
  const destinataire = numeroWhatsApp(tel);
  if (!destinataire) return res.status(400).json({ error: "Numéro de téléphone absent ou illisible." });

  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
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

    // ⚠⚠ LA FENÊTRE DE 24 H SE REVÉRIFIE SUR LA BASE, jamais sur parole.
    // L'écran la calcule pour prévenir la personne ; ici on la RECALCULE
    // sur les messages réellement reçus. Un écran resté ouvert deux heures
    // croit encore la fenêtre ouverte alors qu'elle s'est fermée — et
    // WhatsApp, lui, facturerait un refus que personne ne comprendrait.
    if (reponseLibre) {
      const cleFil = cleConversation(tel);
      const { data: lignes, error: errMsg } = await admin.from("messages").select("data");
      if (errMsg) throw errMsg;
      const fil = (lignes || []).map((l) => l.data || {})
        .filter((m) => m.canal === CANAL_WA && m.wa_tel === cleFil)
        .sort((a, b) => String(a.ts || "").localeCompare(String(b.ts || "")));
      const f = fenetre(fil);
      if (!f.ouverte) return res.status(403).json({ error: libelleFenetre(f) });
    }

    const corps = reponseLibre
      ? corpsTexte(expediteur, destinataire, motReponse)
      : {
        from: expediteur,
        to: destinataire,
        type: "template",
        template: {
          name: nom,
          language: { code: LANGUE_MODELES },
          components: [{ type: "body", parameters: valeurs.map((text) => ({ type: "text", text })) }],
        },
      };
    const resultat = await envoyerYCloud(cle, corps);
    if (!resultat.ok) {
      // ⚠ On rend le motif de WhatsApp tel quel : « modèle non approuvé »,
      // « ce client a refusé les messages commerciaux »… L'écran a besoin de
      // le DIRE, sinon personne ne peut comprendre pourquoi rien ne part.
      // ⚠ Le CODE de Meta part avec (132001, 131050…) : c'est lui qui permet
      // de traduire le refus en français sans deviner d'après une phrase
      // anglaise que Meta peut réécrire quand elle veut.
      return res.status(502).json({ error: resultat.motif, statut_whatsapp: resultat.statut_whatsapp, code_whatsapp: resultat.code_whatsapp });
    }
    return res.status(200).json({ ok: true, id: resultat.id, wamid: resultat.wamid || "", statut: resultat.statut, modele: reponseLibre ? "" : nom });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Erreur serveur" });
  }
}
