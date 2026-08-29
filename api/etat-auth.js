// Fonction serveur Vercel — ÉCRAN DE CONTRÔLE avant durcissement.
//
// Elle répond à une seule question, mais la bonne : « quels utilisateurs BMI
// possèdent réellement un compte d'authentification Supabase ? »
//
// Sans compte d'authentification, un utilisateur ne pourra PLUS RIEN
// synchroniser dès que la sécurité sera activée : ses écritures seront
// refusées par la base et resteront « en attente » pour toujours.
//
// ⚠ CORRECTIF SÉCURITÉ (2.99.42) : cette fonction répondait à N'IMPORTE QUI.
// Un inconnu pouvait donc lui envoyer une liste d'identifiants et apprendre
// lesquels existent (énumération de comptes). Elle exige désormais
// l'identifiant + le mot de passe d'un ADMINISTRATEUR, vérifiés côté serveur
// exactement comme dans sync-auth.js (mêmes algorithmes de hachage, même
// verrouillage progressif anti-« brute force » via tentatives_connexion).
//
// Utilise la clé "service_role" (accès total) : elle reste côté serveur et
// n'est jamais envoyée au navigateur. Ne renvoie AUCUN mot de passe.

import { createClient } from "@supabase/supabase-js";
import { createHash, pbkdf2Sync } from "crypto";
import { poserCors } from "./_cors.js";

// Doit rester IDENTIQUE à hacher() dans l'application (ancien format,
// conservé pour les comptes pas encore migrés).
function hacherServeur(txt) {
  return createHash("sha256").update("bmi-sel-2026::" + String(txt)).digest("hex");
}

// Doit rester IDENTIQUE à hacherFort() dans l'application (nouveau format :
// sel individuel + PBKDF2, 150 000 tours, SHA-256, 256 bits).
function hacherFortServeur(txt, selHex) {
  const sel = Buffer.from(selHex, "hex");
  return pbkdf2Sync(String(txt), sel, 150000, 32, "sha256").toString("hex");
}

// Verrouillage progressif — mêmes paliers que sync-auth.js.
const PALIERS_VERROUILLAGE = [
  { echecs: 15, minutes: 60 },
  { echecs: 10, minutes: 15 },
  { echecs: 5, minutes: 1 },
];

async function verifierVerrouillage(admin, id) {
  const { data, error } = await admin.from("tentatives_connexion").select("*").eq("id", id).maybeSingle();
  if (error) return { verrouille: false, echecsActuels: 0 };
  if (data?.verrouille_jusqu_a && new Date(data.verrouille_jusqu_a) > new Date()) {
    const minutesRestantes = Math.ceil((new Date(data.verrouille_jusqu_a) - new Date()) / 60000);
    return { verrouille: true, minutesRestantes };
  }
  return { verrouille: false, echecsActuels: data?.echecs || 0 };
}

async function enregistrerEchec(admin, id, echecsActuels) {
  const echecs = echecsActuels + 1;
  const palier = PALIERS_VERROUILLAGE.find((p) => echecs >= p.echecs);
  const verrouille_jusqu_a = palier ? new Date(Date.now() + palier.minutes * 60000).toISOString() : null;
  await admin.from("tentatives_connexion").upsert({
    id, echecs, dernier_echec: new Date().toISOString(), verrouille_jusqu_a,
  });
}

async function reinitialiserEchecs(admin, id) {
  await admin.from("tentatives_connexion").upsert({ id, echecs: 0, dernier_echec: null, verrouille_jusqu_a: null });
}

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) {
    return res.status(500).json({ error: "Configuration serveur manquante : la variable SUPABASE_SERVICE_ROLE_KEY n'est pas définie sur Vercel." });
  }

  const { ids, id, motDePasse } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: "Liste d'identifiants attendue" });
  if (!id || !motDePasse) {
    return res.status(401).json({ error: "Cette vérification exige l'identité de l'administrateur. Déconnectez-vous puis reconnectez-vous (en ligne), et réessayez." });
  }

  const admin = createClient(url, cleService, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    // 1) Verrouillage progressif : refus immédiat si ce compte est bloqué.
    const etatVerrou = await verifierVerrouillage(admin, id);
    if (etatVerrou.verrouille) {
      return res.status(429).json({ error: `Trop de tentatives échouées. Réessayez dans ${etatVerrou.minutesRestantes} minute(s).` });
    }

    // 2) Le demandeur est-il bien un ADMINISTRATEUR, avec le bon mot de passe ?
    //    (Les tables sont au format { id, data jsonb, updated_at } — on lit
    //    "data" et on regarde dedans, comme dans sync-auth.js.)
    const { data: ligne, error: erreurLigne } = await admin.from("users").select("data").eq("id", id).maybeSingle();
    if (erreurLigne) throw erreurLigne;
    const champs = ligne?.data || {};
    const motDePasseValide = ligne && (champs.pwd_salt && champs.pwd_hash2
      ? champs.pwd_hash2 === hacherFortServeur(motDePasse, champs.pwd_salt)
      : champs.pwd_hash
        ? champs.pwd_hash === hacherServeur(motDePasse)
        : champs.pwd === motDePasse);
    if (!motDePasseValide || champs.role !== "admin" || champs.actif === false) {
      await enregistrerEchec(admin, id, etatVerrou.echecsActuels);
      return res.status(401).json({ error: "Accès refusé : identifiant ou mot de passe administrateur incorrect." });
    }
    await reinitialiserEchecs(admin, id);

    // 3) Vérification proprement dite — inchangée.
    //    On parcourt toutes les pages : au-delà de 1000 comptes, une seule
    //    page en oublierait — et un utilisateur oublié, c'est une
    //    synchronisation morte.
    const emails = new Set();
    let page = 1;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      (data.users || []).forEach((u) => u.email && emails.add(u.email.toLowerCase()));
      if (!data.users || data.users.length < 1000) break;
      page += 1;
      if (page > 20) break; // garde-fou
    }

    const existants = ids.filter((x) => emails.has(`${String(x).toLowerCase()}@bmi.internal`));
    return res.status(200).json({ existants, total: emails.size });
  } catch (e) {
    console.error("etat-auth:", e?.message || e);
    return res.status(500).json({ error: "Le serveur a rencontré un problème. Réessayez ; si cela continue, prévenez l'administrateur." });
  }
}
