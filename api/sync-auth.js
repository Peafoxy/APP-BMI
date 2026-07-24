// Fonction serveur Vercel (jamais envoyée au navigateur) : synchronise le
// mot de passe d'un utilisateur BMI avec un vrai compte d'authentification
// Supabase.
//
// ⚠ CORRECTIF SÉCURITÉ : cette fonction utilisait la clé "service_role"
// (accès total) en faisant confiance à l'appelant sans aucune vérification —
// n'importe qui connaissant un identifiant pouvait changer son mot de passe
// à distance, sans jamais connaître l'ancien. Elle revérifie maintenant
// elle-même le mot de passe, côté serveur, avant d'agir : elle relit le
// pwd_hash déjà stocké pour cet utilisateur dans la table "users" de
// Supabase (avec la clé service_role, donc indépendamment de tout RLS) et
// compare avec le hachage du mot de passe reçu, calculé exactement comme
// dans l'app (voir hacher() dans App.jsx — même sel, même algorithme).
// Sans correspondance, la requête est refusée.
//
// Utilise la clé "service_role" de Supabase, qui donne un accès total —
// c'est pourquoi elle ne doit JAMAIS être mise dans le fichier .env avec le
// préfixe VITE_ (ce qui l'enverrait au navigateur), mais uniquement comme
// variable d'environnement côté serveur sur Vercel.

import { createClient } from "@supabase/supabase-js";
import { createHash, pbkdf2Sync } from "crypto";

// Doit rester IDENTIQUE à hacher() dans src/App.jsx (ancien format, conservé
// pour les comptes pas encore migrés).
function hacherServeur(txt) {
  return createHash("sha256").update("bmi-sel-2026::" + String(txt)).digest("hex");
}

// Doit rester IDENTIQUE à hacherFort() dans src/App.jsx (nouveau format :
// sel individuel + PBKDF2, 150 000 tours, SHA-256, 256 bits).
function hacherFortServeur(txt, selHex) {
  const sel = Buffer.from(selHex, "hex");
  return pbkdf2Sync(String(txt), sel, 150000, 32, "sha256").toString("hex");
}

// ⚠ CORRECTIF SÉCURITÉ : verrouillage progressif contre les essais
// systématiques (« brute force ») en ligne. Sans lui, rien n'empêchait
// d'essayer des centaines de mots de passe par minute sur un identifiant
// connu (ex. l'admin) — voir table public.tentatives_connexion.
// Verrouillage PAR IDENTIFIANT (pas par IP, trop facile à changer).
const PALIERS_VERROUILLAGE = [
  { echecs: 15, minutes: 60 },
  { echecs: 10, minutes: 15 },
  { echecs: 5, minutes: 1 },
];

async function verifierVerrouillage(admin, id) {
  const { data, error } = await admin.from("tentatives_connexion").select("*").eq("id", id).maybeSingle();
  // Si la table n'existe pas encore (script SQL pas encore exécuté), on ne
  // bloque personne : on se contente de ne pas compter les échecs pour l'instant.
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { id, motDePasse } = req.body || {};
  if (!id || !motDePasse || String(motDePasse).length < 4) {
    return res.status(400).json({ error: "Identifiant ou mot de passe invalide" });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) {
    return res.status(500).json({ error: "Configuration serveur manquante (SUPABASE_SERVICE_ROLE_KEY)" });
  }

  const admin = createClient(url, cleService, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `${id}@bmi.internal`;

  try {
    // Verrouillage progressif : refus immédiat si ce compte est actuellement
    // bloqué, AVANT même de vérifier le mot de passe.
    const etatVerrou = await verifierVerrouillage(admin, id);
    if (etatVerrou.verrouille) {
      return res.status(429).json({ error: `Trop de tentatives échouées. Réessayez dans ${etatVerrou.minutesRestantes} minute(s).` });
    }

    // Vérification serveur : ce compte existe-t-il, et le mot de passe fourni
    // correspond-il VRAIMENT à celui enregistré ? Sans ça, n'importe qui
    // pouvait usurper n'importe quel compte, y compris l'administrateur.
    // ⚠ Les tables Supabase de cette app n'ont PAS une colonne par champ :
    // chaque ligne est { id, data (JSONB avec tout l'enregistrement), updated_at }.
    // Interroger "pwd_hash" comme une colonne à part échoue silencieusement
    // (colonne inexistante) — c'est ce qui avait cassé la connexion de TOUT
    // le monde après le précédent correctif. On lit "data" et on regarde dedans.
    const { data: ligne, error: erreurLigne } = await admin.from("users").select("data").eq("id", id).maybeSingle();
    if (erreurLigne) throw erreurLigne;
    if (!ligne) {
      await enregistrerEchec(admin, id, etatVerrou.echecsActuels);
      return res.status(401).json({ error: "Compte inconnu du serveur." });
    }
    const champs = ligne.data || {};

    const motDePasseValide = champs.pwd_salt && champs.pwd_hash2
      ? champs.pwd_hash2 === hacherFortServeur(motDePasse, champs.pwd_salt)
      : champs.pwd_hash
        ? champs.pwd_hash === hacherServeur(motDePasse)
        : champs.pwd === motDePasse; // anciens comptes pas encore migrés au hachage
    if (!motDePasseValide) {
      await enregistrerEchec(admin, id, etatVerrou.echecsActuels);
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }
    // Mot de passe correct : on efface l'historique d'échecs de ce compte.
    await reinitialiserEchecs(admin, id);

    // Cherche si un compte d'authentification existe déjà pour cet utilisateur
    const { data: liste, error: erreurListe } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (erreurListe) throw erreurListe;
    const existant = liste.users.find((u) => u.email === email);

    if (existant) {
      const { error } = await admin.auth.admin.updateUserById(existant.id, { password: String(motDePasse) });
      if (error) { console.error("sync-auth updateUserById:", JSON.stringify(error)); throw error; }
    } else {
      const { error } = await admin.auth.admin.createUser({ email, password: String(motDePasse), email_confirm: true });
      if (error) { console.error("sync-auth createUser:", JSON.stringify(error)); throw error; }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("sync-auth erreur finale:", e?.message || e);
    return res.status(500).json({ error: e.message || "Erreur de synchronisation" });
  }
}
