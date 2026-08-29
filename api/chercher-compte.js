// Fonction serveur Vercel (jamais envoyée au navigateur) : retrouve UN
// compte à partir de son identifiant, et UNIQUEMENT si le mot de passe
// fourni est le bon.
//
// ⚠ POURQUOI ELLE EXISTE — ÉTAPE 2 DE LA FERMETURE DU « TROU N° 1 ».
//
// La table `users` était lisible SANS AUCUNE CONNEXION (politique
// « lecture_publique_users »), c'est-à-dire par quiconque possède la clé
// publique du site — elle est visible dans le code de n'importe quelle
// page web. Cette ouverture n'était pas une négligence : un appareil NEUF
// doit pouvoir retrouver un compte AVANT toute connexion, sinon personne
// ne peut se connecter la première fois.
//
// Conséquences réelles de cette ouverture, relevées pendant l'audit :
//   • les téléphones de tout le personnel étaient téléchargeables ;
//   • et surtout, les mots de passe des comptes clients auto-générés se
//     RECALCULENT à partir du nom et du téléphone (voir motDePasseClient
//     dans src/lib/comptesClients.js) — n'importe qui pouvait donc les
//     reconstituer et se connecter à leur place.
//
// Cette fonction remplace cette ouverture par une porte étroite : on ne
// donne plus l'annuaire à tout le monde, on répond « voici VOTRE fiche »
// à qui prouve qu'il connaît le mot de passe. Le mot de passe est vérifié
// ICI, côté serveur, avec la clé service_role — donc indépendamment de
// toute règle RLS.
//
// ⚠ La clé "service_role" donne un accès total : elle ne doit JAMAIS être
// mise dans .env avec le préfixe VITE_ (ce qui l'enverrait au navigateur),
// mais uniquement comme variable d'environnement côté serveur sur Vercel.

import { createClient } from "@supabase/supabase-js";
import { createHash, pbkdf2Sync } from "crypto";
import { poserCors } from "./_cors.js";
import {
  adresseAppelant, clesDeControle, lireVerrous, enregistrerEchec, reinitialiserEchecs,
} from "./_verrouillage.js";

// Doivent rester IDENTIQUES à hacher() / hacherFort() de src/lib/core.js.
function hacherServeur(txt) {
  return createHash("sha256").update("bmi-sel-2026::" + String(txt)).digest("hex");
}
function hacherFortServeur(txt, selHex) {
  const sel = Buffer.from(selHex, "hex");
  return pbkdf2Sync(String(txt), sel, 150000, 32, "sha256").toString("hex");
}

// Vérifie le mot de passe exactement comme verifierMotDePasse() de
// src/lib/core.js : format fort d'abord, puis les deux anciens formats
// encore présents sur les comptes jamais reconnectés.
function motDePasseCorrect(champs, saisie) {
  if (champs.pwd_salt && champs.pwd_hash2) {
    return hacherFortServeur(saisie, champs.pwd_salt) === champs.pwd_hash2;
  }
  if (champs.pwd_hash) return champs.pwd_hash === hacherServeur(saisie);
  return champs.pwd === saisie;
}

// ⚠ Dans une recherche « ilike », les caractères % et _ ne sont PAS des
// lettres : % veut dire « n'importe quoi ». Sans cette précaution, taper
// simplement « % » comme identifiant faisait remonter LA TABLE ENTIÈRE des
// comptes depuis Supabase à chaque essai. Rien n'en sortait (la comparaison
// exacte plus bas rejetait tout), mais c'était un travail inutile offert au
// premier venu, et donc un levier pour épuiser le serveur.
function echapperJokers(txt) {
  return String(txt).replace(/[\\%_]/g, (c) => "\\" + c);
}

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { nom, motDePasse } = req.body || {};
  if (!nom || !motDePasse) return res.status(400).json({ error: "Identifiant ou mot de passe manquant" });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });

  const admin = createClient(url, cleService, { auth: { persistSession: false } });
  const recherche = String(nom).trim().toLowerCase();
  // Trois compteurs : cet appareil sur ce compte, cet appareil en général,
  // ce compte depuis partout. Voir api/_verrouillage.js pour le détail.
  const verrous = clesDeControle("recherche", recherche, adresseAppelant(req));

  try {
    const verrou = await lireVerrous(admin, verrous);
    if (verrou.verrouille) {
      return res.status(429).json({
        error: `Trop d'essais. Réessayez dans ${verrou.minutesRestantes} minute(s).`,
      });
    }

    // ⚠ On compare les identifiants sans tenir compte des majuscules ni des
    // espaces, EXACTEMENT comme l'écran de connexion le fait en local
    // (Connexion.jsx) — sinon un compte trouvé hors ligne ne le serait plus
    // en ligne, ou l'inverse.
    const { data: lignes, error } = await admin
      .from("users").select("id, data").ilike("data->>nom", echapperJokers(recherche));
    if (error) throw error;
    const ligne = (lignes || []).find(
      (l) => String(l.data?.nom || "").trim().toLowerCase() === recherche
    );

    // ⚠ Réponse VOLONTAIREMENT identique que le compte existe ou non : sinon
    // cette fonction deviendrait un annuaire — on pourrait deviner qui
    // travaille chez vous en essayant des noms, ce qu'on cherche justement
    // à empêcher.
    const echec = async () => {
      await enregistrerEchec(admin, verrous, verrou.etats);
      return res.status(401).json({ error: "Identifiant ou mot de passe incorrect." });
    };
    if (!ligne) return await echec();

    const champs = ligne.data || {};
    if (!motDePasseCorrect(champs, motDePasse)) return await echec();
    if (champs.actif === false) {
      return res.status(403).json({ error: "Ce compte a été bloqué par l'administrateur." });
    }

    await reinitialiserEchecs(admin, verrous);
    // La fiche de l'intéressé, et elle seule. Elle contient son mot de passe
    // chiffré : c'est nécessaire pour que ses PROCHAINES connexions
    // fonctionnent hors réseau, et il vient de prouver qu'il le connaît.
    // ⚠ Les champs d'argent n'y sont plus (voir supabase/paie-1-table.sql) :
    // ils vivent dans la table `paie`, que la synchronisation ira chercher
    // après la connexion, si le compte y a droit.
    return res.status(200).json({ user: { id: ligne.id, ...champs } });
  } catch (e) {
    console.error("chercher-compte:", e?.message || e);
    return res.status(500).json({ error: "Le serveur a rencontré un problème. Réessayez ; si cela continue, prévenez l'administrateur." });
  }
}
