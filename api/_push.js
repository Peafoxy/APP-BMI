// ============================================================
// api/_push.js — ENVOYER une notification aux appareils d'une personne.
// Morceau partagé (le « _ » : pas une adresse publique) entre
// api/notifier.js (à chaque enregistrement dans l'application) et
// api/rappels-du-matin.js (la tournée du matin).
//
// La clé PRIVÉE des notifications n'existe QUE comme variable Vercel
// (VAPID_PRIVATE_KEY), jamais dans le code, jamais préfixée VITE_. La clé
// publique, elle, est dans src/lib/constants.js (CLE_PUBLIQUE_PUSH) : le
// téléphone s'en sert pour n'accepter QUE les notifications signées par
// nous. Un appareil qui n'existe plus (404 / 410) est retiré de la table.
// ============================================================
import webpush from "web-push";

export const TABLE_ABONNEMENTS = "abonnements_push";
export const MAX_DESTINATAIRES = 40;
export const MAX_ENVOIS = 60;
export const MAX_TEXTE = 300;

export function configurerWebPush() {
  const publique = process.env.VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_SUBJECT || "mailto:contact@bmitogo.com";
  if (!publique || !privee) return false;
  webpush.setVapidDetails(contact, publique, privee);
  return true;
}

// Nettoie un envoi venu de l'extérieur : pas plus long, pas plus large.
export function nettoyerEnvoi(e) {
  if (!e || typeof e !== "object") return null;
  const destinataires = [...new Set((Array.isArray(e.destinataires) ? e.destinataires : []).map((x) => String(x || "").trim()).filter(Boolean))].slice(0, MAX_DESTINATAIRES);
  if (!destinataires.length) return null;
  return {
    destinataires,
    titre: String(e.titre || "BMI Gestion").slice(0, 80),
    texte: String(e.texte || "").slice(0, MAX_TEXTE),
    ecran: String(e.ecran || "").slice(0, 40),
    tag: String(e.tag || "").slice(0, 80),
  };
}

// Envoie chaque envoi à tous les appareils de ses destinataires.
// Rendu : { appareils, envoyes, retires } — pour le journal du serveur.
export async function envoyerAuxPersonnes(admin, envois) {
  const ids = [...new Set(envois.flatMap((e) => e.destinataires))];
  if (!ids.length) return { appareils: 0, envoyes: 0, retires: 0 };
  const { data: lignes, error } = await admin.from(TABLE_ABONNEMENTS).select("endpoint, user_id, data").in("user_id", ids);
  if (error) throw error;
  const parPersonne = new Map();
  (lignes || []).forEach((l) => {
    if (!parPersonne.has(l.user_id)) parPersonne.set(l.user_id, []);
    parPersonne.get(l.user_id).push(l);
  });
  let envoyes = 0;
  const morts = new Set();
  for (const e of envois) {
    const corps = JSON.stringify({ titre: e.titre, texte: e.texte, ecran: e.ecran, tag: e.tag });
    for (const id of e.destinataires) {
      for (const l of parPersonne.get(id) || []) {
        const abonnement = { endpoint: l.endpoint, keys: (l.data || {}).keys || {} };
        try {
          await webpush.sendNotification(abonnement, corps, { TTL: 24 * 3600, urgency: "normal" });
          envoyes += 1;
        } catch (err) {
          const code = Number(err?.statusCode || 0);
          if (code === 404 || code === 410) morts.add(l.endpoint);
        }
      }
    }
  }
  if (morts.size) await admin.from(TABLE_ABONNEMENTS).delete().in("endpoint", [...morts]);
  return { appareils: (lignes || []).length, envoyes, retires: morts.size };
}
