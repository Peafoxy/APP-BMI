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

    // Cherche si un compte d'authentification existe déjà pour cet utilisateur.
    // ⚠ On parcourt TOUTES les pages (comme dans etat-auth.js) : au-delà de
    // 1000 comptes, une seule page pouvait « manquer » un compte existant —
    // il aurait alors été recréé, et la création aurait échoué (email déjà
    // pris), bloquant la connexion de cet utilisateur.
    let existant = null;
    let page = 1;
    for (;;) {
      const { data: liste, error: erreurListe } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (erreurListe) throw erreurListe;
      existant = (liste.users || []).find((u) => u.email === email) || null;
      if (existant) break;
      if (!liste.users || liste.users.length < 1000) break;
      page += 1;
      if (page > 20) break; // garde-fou, même limite qu'etat-auth
    }

    // ⚠ CLOISONNEMENT FORMATION / RÉEL — la revendication d'espace.
    // C'est le SEUL endroit du système qui a le droit de la poser :
    // `app_metadata` fait partie du jeton de session, mais n'est
    // modifiable qu'avec la clé service_role — un appareil ne peut donc
    // pas se l'attribuer lui-même, contrairement à `user_metadata`.
    // Les politiques RLS (voir supabase/espace-3-politiques.sql) la
    // comparent à la colonne `espace` de chaque ligne.
    //
    // Elle est réécrite à CHAQUE connexion, juste avant que la session ne
    // soit créée : basculer un compte en formation prend donc effet dès sa
    // prochaine connexion, sans aucune manipulation.
    //
    // Tant que l'étape 3 n'est pas déployée, cette valeur ne restreint
    // rien du tout — elle est simplement présente dans le jeton.
    //
    // ⚠ TROISIÈME VALEUR : 'tous' (relevé par Timo, 18/08/2026).
    // L'application prévoit depuis la 2.100.30 qu'un administrateur qui a le
    // pouvoir « voir les deux espaces » les voie effectivement tous les deux.
    // Le serveur, lui, ne connaissait que 'reel' et 'formation' : l'écran
    // Paramètres proposait donc de créer une boutique de FORMATION que le
    // serveur refusait ensuite, laissant l'opération bloquée dans la file
    // d'attente pour toujours — avec un message conseillant à tort de se
    // reconnecter. Une application qui propose un geste que le serveur
    // refuse est une application cassée.
    //
    // La règle reproduit EXACTEMENT voitLesDeuxEspaces() de lib/calculs.js :
    // l'administrateur principal (toujours), et tout administrateur qui a
    // conservé le pouvoir « act_voir_tout ». Un administrateur à qui ce
    // pouvoir a été retiré redevient cloisonné, drapeau formation compris —
    // c'est ce que fait déjà l'application.
    const voitLesDeuxEspaces = champs.role === "admin"
      && (champs.admin_principal === true
          || !(Array.isArray(champs.droits_off) ? champs.droits_off : []).includes("act_voir_tout"));
    const espace = voitLesDeuxEspaces ? "tous" : (champs.formation ? "formation" : "reel");

    // ⚠ FAILLE N° 3 — LE SERVEUR NE CONNAISSAIT QUE « connecté ou pas ».
    // Aucune notion de rôle ni de droits : n'importe lequel des comptes —
    // y compris un compte CLIENT — pouvait, en dehors de l'application,
    // effacer toutes les ventes, lire les salaires, ou se nommer
    // administrateur en modifiant sa propre fiche.
    // On ajoute donc deux revendications, posées ici pour la même raison
    // que l'espace : app_metadata n'est modifiable qu'avec la clé
    // service_role, un appareil ne peut pas se l'attribuer lui-même.
    //
    // `ecriture` reproduit peutEcrire() de lib/calculs.js. En cas de doute
    // on ACCORDE l'écriture : refuser à tort casserait l'application,
    // accorder à tort laisse simplement la situation d'avant.
    const droitsOff = Array.isArray(champs.droits_off) ? champs.droits_off : [];
    const role = String(champs.role || "");
    const ecriture = champs.admin_principal === true
      || (role !== "comptable" && !droitsOff.includes("act_ecriture"));

    if (existant) {
      const { error } = await admin.auth.admin.updateUserById(existant.id, {
        password: String(motDePasse),
        app_metadata: { ...(existant.app_metadata || {}), espace, role, ecriture },
      });
      if (error) { console.error("sync-auth updateUserById:", JSON.stringify(error)); throw error; }
    } else {
      const { error } = await admin.auth.admin.createUser({
        email, password: String(motDePasse), email_confirm: true,
        app_metadata: { espace, role, ecriture },
      });
      if (error) { console.error("sync-auth createUser:", JSON.stringify(error)); throw error; }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("sync-auth erreur finale:", e?.message || e);
    return res.status(500).json({ error: e.message || "Erreur de synchronisation" });
  }
}
