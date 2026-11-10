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
import { poserCors } from "./_cors.js";
import { preparerCompteSecurise } from "./_compteSecurise.js";
import { accesFerme, messageAccesFerme } from "../src/lib/attestationSortie.js";
import { estSansAcces, MESSAGE_SANS_ACCES } from "../src/lib/identiteClient.js";
import {
  adresseAppelant, clesDeControle, lireVerrous, enregistrerEchec, reinitialiserEchecs,
} from "./_verrouillage.js";

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
//
// ⚠ CORRECTION DU 24/08/2026 : le compteur était attaché au SEUL compte
// visé. Conséquence : un inconnu pouvait, depuis n'importe où, bloquer la
// synchronisation d'un employé pendant une heure en tapant quinze mauvais
// mots de passe sur son identifiant. Les trois compteurs d'api/_verrouillage.js
// règlent ça : celui qui se trompe est le seul puni.
//
// ⚠ Les anciennes lignes de tentatives_connexion (rangées sous l'identifiant
// nu) ne sont plus lues : elles ne gênent personne et disparaîtront d'un
// simple ménage. Le préfixe « auth » évite tout mélange avec les compteurs
// de la recherche de compte.

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
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
  // Trois compteurs : cet appareil sur ce compte, cet appareil en général,
  // ce compte depuis partout. Voir api/_verrouillage.js pour le détail.
  const verrous = clesDeControle("auth", String(id), adresseAppelant(req));

  try {
    // Verrouillage progressif : refus immédiat si ce compte est actuellement
    // bloqué, AVANT même de vérifier le mot de passe.
    const etatVerrou = await lireVerrous(admin, verrous);
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
      await enregistrerEchec(admin, verrous, etatVerrou.etats);
      return res.status(401).json({ error: "Compte inconnu du serveur." });
    }
    const champs = ligne.data || {};

    const motDePasseValide = champs.pwd_salt && champs.pwd_hash2
      ? champs.pwd_hash2 === hacherFortServeur(motDePasse, champs.pwd_salt)
      : champs.pwd_hash
        ? champs.pwd_hash === hacherServeur(motDePasse)
        : champs.pwd === motDePasse; // anciens comptes pas encore migrés au hachage
    if (!motDePasseValide) {
      await enregistrerEchec(admin, verrous, etatVerrou.etats);
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }
    // Mot de passe correct : on efface l'historique d'échecs de ce compte.
    await reinitialiserEchecs(admin, verrous);
    // 📄 L'accès d'un employé sorti est fermé 24 h après la mise à disposition
    // de son attestation (14/10/2026) : pas de session sécurisée au-delà.
    if (accesFerme(champs, Date.now())) {
      return res.status(403).json({ error: messageAccesFerme(champs) });
    }
    // 🖨 Une fiche client sans accès (devis imprimé sans compte, 15/10/2026).
    if (estSansAcces(champs)) {
      return res.status(403).json({ error: MESSAGE_SANS_ACCES });
    }

    // Le compte sécurisé : retrouvé (directement par la base depuis le
    // 10/11/2026, la vieille méthode en repli), mot de passe redonné,
    // revendications de l'espace, du rôle, de la boutique et des pouvoirs
    // posées. Écrit UNE fois : api/_compteSecurise.js (aussi appelé par
    // chercher-compte pour la connexion rapide).
    await preparerCompteSecurise(admin, id, champs, motDePasse);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("sync-auth erreur finale:", e?.message || e);
    // Le détail est déjà dans console.error juste au-dessus.
    return res.status(500).json({ error: "Le serveur a rencontré un problème. Réessayez ; si cela continue, prévenez l'administrateur." });
  }
}
