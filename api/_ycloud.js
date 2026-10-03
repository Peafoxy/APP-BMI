// ============================================================
// api/_ycloud.js — LA PORTE VERS YCLOUD, ÉCRITE UNE FOIS (24/09/2026)
//
// Avant l'assistant, un seul fichier envoyait au numéro BMI (api/whatsapp.js).
// L'assistant (api/whatsapp-entrant.js) envoie lui aussi : la clé, l'adresse
// et la lecture du refus de Meta vivent donc ICI, et nulle part ailleurs —
// deux appels recopiés finiraient par lire le refus de deux façons.
//
// ⚠⚠ LA CLÉ YCLOUD NE VIT QUE DANS UNE VARIABLE VERCEL (`YCLOUD_API_KEY`),
// JAMAIS préfixée « VITE_ » (Vite l'embarquerait dans le paquet du
// navigateur). Elle n'est lue que par les fonctions serveur.
// ============================================================
export const URL_YCLOUD = "https://api.ycloud.com/v2/whatsapp/messages";

// Le numéro expéditeur, nettoyé comme `numeroWhatsApp` (whatsappModeles.js)
// le fait côté application — on ne l'importe pas ici pour garder ce
// fichier sans dépendance ; l'appelant passe le numéro déjà nettoyé.
export function configYCloud() {
  return { cle: process.env.YCLOUD_API_KEY || "", expediteurBrut: process.env.WHATSAPP_NUMERO_BMI || "" };
}

// Envoie un corps YCloud (texte libre ou modèle). Rend
//   { ok: true, id, statut }  ou  { ok: false, motif, statut_whatsapp, code_whatsapp }
// ⚠ Le motif de WhatsApp est rendu TEL QUEL, avec son CODE : c'est
// `traduireMotifWhatsApp` (application) qui le dit en français.
export async function envoyerYCloud(cle, corps) {
  const reponse = await fetch(URL_YCLOUD, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": cle },
    body: JSON.stringify(corps),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    const motif = resultat?.error?.message || resultat?.message || `WhatsApp a répondu ${reponse.status}.`;
    const code = resultat?.error?.code ?? resultat?.code ?? "";
    return { ok: false, motif, statut_whatsapp: reponse.status, code_whatsapp: code };
  }
  // Le numéro de suivi (`id`, et le `wamid` de Meta) sert aux COCHES
  // (lib/suiviEnvoi.js, 26/09/2026) : Meta prévient ensuite par ce numéro.
  return { ok: true, id: resultat?.id || "", wamid: resultat?.wamid || "", statut: resultat?.status || "envoye" };
}

export const corpsTexte = (expediteur, destinataire, texte) =>
  ({ from: expediteur, to: destinataire, type: "text", text: { body: texte } });

// ---------------------------------------------------------------
// 📎 UN FICHIER ENVOYÉ AU CLIENT (03/10/2026)
// ---------------------------------------------------------------
// Deux temps, comme chez Meta : le fichier est d'abord DÉPOSÉ chez WhatsApp
// (il rend un numéro de fichier, gardé 30 jours chez lui), puis le message
// part en citant ce numéro. ⚠ Rien n'est rangé chez nous.
// ⚠ LA FORME EXACTE DE CET APPEL N'A PAS PU ÊTRE VÉRIFIÉE D'ICI (le site de
// YCloud est fermé depuis le poste de travail) : c'est celle de leur API
// publique telle qu'on la connaît. Un refus est rendu TEL QUEL, avec son
// statut, et part dans le journal du serveur : le premier vrai envoi dira
// si la forme est juste.
export const urlTeleversement = (expediteur) =>
  `https://api.ycloud.com/v2/whatsapp/media/${encodeURIComponent(expediteur)}/upload`;

export async function televerserYCloud(cle, expediteur, { octets, mime, nom }) {
  const formulaire = new FormData();
  formulaire.append("file", new Blob([octets], { type: mime || "application/octet-stream" }), nom || "fichier");
  const reponse = await fetch(urlTeleversement(expediteur), {
    method: "POST",
    headers: { "X-API-Key": cle },
    body: formulaire,
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok || !resultat?.id) {
    const motif = resultat?.error?.message || resultat?.message || `WhatsApp n'a pas accepté le fichier (${reponse.status}).`;
    console.error("[whatsapp] dépôt du fichier refusé", reponse.status, JSON.stringify(resultat).slice(0, 300));
    return { ok: false, motif, statut_whatsapp: reponse.status, code_whatsapp: resultat?.error?.code ?? resultat?.code ?? "" };
  }
  return { ok: true, id: String(resultat.id) };
}

// Le message qui cite le fichier déposé. Un son ne porte pas de phrase
// (Meta la refuserait) ; un document porte son nom, que le client verra.
export function corpsMedia(expediteur, destinataire, { type, id, legende, nom }) {
  const bloc = { id };
  if (legende && type !== "audio") bloc.caption = legende;
  if (type === "document" && nom) bloc.filename = nom;
  return { from: expediteur, to: destinataire, type, [type]: bloc };
}
