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
