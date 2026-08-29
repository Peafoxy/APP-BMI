// Fonction serveur Vercel (jamais envoyée au navigateur) : crée le compte
// d'un FILLEUL parrainé par un client, et le prospect qui va avec.
//
// ⚠ POURQUOI ELLE EXISTE — ÉTAPE 1 DE LA FERMETURE DE L'ANNUAIRE CLIENT.
//
// Question de Timo (25/08/2026) : « pourquoi l'appareil de chaque client
// télécharge les dettes de tous les autres clients ? ». Parce que
// l'application est hors-ligne d'abord : elle demande au serveur TOUT ce qui
// a changé, table par table, et c'est au serveur de filtrer. Or les règles
// laissent la lecture entière aux comptes clients — c'était volontaire, pour
// que l'écran de parrainage fonctionne.
//
// Sa question suivante, la bonne : « si on ferme, sa possibilité de créer un
// filleul ne sera pas cassée ? ». SI. Quatre fois, et en silence :
//   1. « cette personne est-elle déjà connue ? » compare le téléphone à TOUS
//      les comptes — sans eux, le contrôle passe toujours et le même filleul
//      peut être parrainé dix fois, avec dix primes à la clé ;
//   2. l'identifiant doit être unique — sinon deux clients partagent un
//      identifiant, et l'un entre dans l'espace de l'autre ;
//   3. le mot de passe auto ne doit pas entrer en conflit avec un existant ;
//   4. les administrateurs doivent être prévenus.
//
// Ces quatre contrôles répondent à « est-ce que ça existe DÉJÀ quelque
// part ? » : impossible d'y répondre en ne voyant que ses propres lignes.
// Ils passent donc ici, côté serveur, où voir toute la table est sans
// danger. L'appareil du client n'a plus besoin de l'annuaire.
//
// ⚠ La clé "service_role" donne un accès total : jamais dans .env avec le
// préfixe VITE_ (ce qui l'enverrait au navigateur), uniquement en variable
// d'environnement côté serveur sur Vercel.

import { createClient } from "@supabase/supabase-js";
import { randomBytes, pbkdf2Sync } from "crypto";
import { poserCors } from "./_cors.js";
import { adresseAppelant, clesDeControle, lireVerrous, enregistrerEchec } from "./_verrouillage.js";
// ⚠ Le MÊME calcul que dans l'application (lib/identiteClient.js) : un mot de
// passe fabriqué ici doit être exactement celui que le client tapera.
import { chiffresTel, motDePasseClient, memeNumero } from "../src/lib/identiteClient.js";

// Doit rester IDENTIQUE à hacherFort() / definirMotDePasse() de src/lib/core.js.
function definirMotDePasseServeur(txt) {
  const sel = randomBytes(16);
  const hash = pbkdf2Sync(String(txt), sel, 150000, 32, "sha256").toString("hex");
  return { pwd_salt: sel.toString("hex"), pwd_hash2: hash };
}

const idUnique = () => `${Date.now().toString(36)}${randomBytes(6).toString("hex")}`;
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const majuscules = (s) => String(s || "").trim().toUpperCase();

export default async function handler(req, res) {
  if (poserCors(req, res, "POST, OPTIONS")) return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });

  const { jeton, nom, tel, note } = req.body || {};
  if (!jeton) return res.status(401).json({ error: "Reconnectez-vous pour parrainer." });
  if (!nom || chiffresTel(tel).length < 4) {
    return res.status(400).json({ error: "Indiquez le nom de votre filleul et son numéro." });
  }

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });
  const admin = createClient(url, cleService, { auth: { persistSession: false } });

  try {
    // ── QUI APPELLE ? ─────────────────────────────────────────────────
    // ⚠ On ne croit PAS l'appelant sur parole. Le jeton est celui de sa
    // session Supabase : seul le serveur peut le vérifier. Sans cela,
    // n'importe qui pourrait créer des comptes en masse chez vous.
    const { data: auth, error: errAuth } = await admin.auth.getUser(jeton);
    if (errAuth || !auth?.user?.email) {
      return res.status(401).json({ error: "Session expirée. Reconnectez-vous pour parrainer." });
    }
    const parrainId = auth.user.email.split("@")[0];

    const verrous = clesDeControle("filleul", parrainId, adresseAppelant(req));
    const verrou = await lireVerrous(admin, verrous);
    if (verrou.verrouille) {
      return res.status(429).json({ error: `Trop de demandes. Réessayez dans ${verrou.minutesRestantes} minute(s).` });
    }

    const { data: lignes, error } = await admin.from("users").select("id, data");
    if (error) throw error;
    const comptes = (lignes || []).map((l) => ({ id: l.id, ...(l.data || {}) }));

    const parrain = comptes.find((u) => u.id === parrainId);
    if (!parrain || parrain.actif === false) {
      return res.status(403).json({ error: "Ce compte ne peut pas parrainer." });
    }
    // ⚠ Ce chemin ne sert QUE le parrainage entre clients. Un employé qui
    // crée un compte passe par l'application, avec ses propres contrôles.
    if (parrain.role !== "client") {
      return res.status(403).json({ error: "Le parrainage est réservé aux comptes clients." });
    }

    // ── 1. CETTE PERSONNE EST-ELLE DÉJÀ CONNUE ? ──────────────────────
    const telNormalise = chiffresTel(tel);
    // ⚠ memeNumero, pas une égalité de chiffres bruts : « +228 90 11 22 33 »
    // et « 90112233 » sont la MÊME personne (voir lib/identiteClient.js).
    if (comptes.some((u) => u.tel && memeNumero(u.tel, tel))) {
      // Un échec compte : sinon on pourrait sonder l'annuaire numéro par
      // numéro pour savoir qui est client chez vous.
      await enregistrerEchec(admin, verrous, verrou.etats);
      return res.status(409).json({ error: "Cette personne est déjà connue de BMI Togo. Le parrainage ne s'applique qu'aux nouveaux clients." });
    }

    // ── 2. UN IDENTIFIANT LIBRE ───────────────────────────────────────
    const pris = new Set(comptes.map((u) => majuscules(u.nom)));
    const base = majuscules(nom);
    let identifiant = base;
    if (pris.has(identifiant)) identifiant = base + telNormalise.slice(0, 2);
    if (pris.has(identifiant)) identifiant = base + telNormalise.slice(0, 4);
    for (let i = 2; pris.has(identifiant); i++) identifiant = base + telNormalise.slice(0, 2) + i;

    // ── 3. UN MOT DE PASSE QUI N'ENTRE EN CONFLIT AVEC AUCUN AUTRE ────
    // Mêmes règles que resoudreMotDePasseClient : 6 caractères par défaut,
    // on n'allonge QUE si toutes les variantes courtes sont déjà prises.
    const dejaPris = new Set(
      comptes.filter((u) => u.mdp_auto && u.nom_base)
        .map((u) => motDePasseClient(u.nom_base, u.tel, u.mdp_variante ?? 0, u.mdp_longueur ?? 6))
    );
    let motDePasse = null, variante = 0, longueur = 6;
    for (let v = 0; v < 10 && !motDePasse; v++) {
      const essai = motDePasseClient(nom, tel, v, 6);
      if (!dejaPris.has(essai)) { motDePasse = essai; variante = v; }
    }
    for (let L = 7; L <= 12 && !motDePasse; L++) {
      for (let v = 0; v < 10 && !motDePasse; v++) {
        const essai = motDePasseClient(nom, tel, v, L);
        if (!dejaPris.has(essai)) { motDePasse = essai; variante = v; longueur = L; }
      }
    }
    if (!motDePasse) {
      // ⚠ Filet de sécurité, jamais atteint en pratique. Il DOIT compter
      // exactement comme resoudreMotDePasseClient côté navigateur (les
      // comptes déjà chiffrés) : sinon les deux côtés fabriqueraient des mots
      // de passe différents pour la même personne.
      motDePasse = motDePasseClient(nom, tel, 0, 6)
        + String(comptes.filter((u) => u.pwd_salt && u.pwd_hash2).length);
    }

    // ── L'ESPACE : un client de formation ne parraine que dans le sien ──
    const marque = parrain.formation ? { formation: true } : {};
    const maintenant = new Date().toISOString();
    const filleulId = idUnique();
    const filleul = {
      id: filleulId, nom: identifiant, nom_base: base, tel: String(tel).trim(),
      ...definirMotDePasseServeur(motDePasse),
      role: "client", boutique: null, actif: true,
      mdp_auto: true, mdp_variante: variante, mdp_longueur: longueur,
      cree_par: parrain.nom,
      parrain_client_id: parrainId, parrain_nom: parrain.nom_base || parrain.nom,
      ...marque,
    };
    const prospect = {
      id: idUnique(), date: aujourdhui(), commercial: null,
      nom: base, tel: String(tel).trim(), statut: "Favorable", interet: "Intéressé",
      note: `🤝 Parrainé par le client ${parrain.nom_base || parrain.nom}${String(note || "").trim() ? " — " + String(note).trim() : ""}`,
      parrain_user_id: parrainId, client_user_id: filleulId,
      ...marque,
    };
    // ── 4. PRÉVENIR LES ADMINISTRATEURS ───────────────────────────────
    const messages = comptes
      .filter((u) => u.role === "admin" && u.actif !== false)
      .map((a) => ({
        id: idUnique(), date: aujourdhui(), ts: maintenant, lu_par: [],
        de_id: parrainId, de_nom: parrain.nom, a_id: a.id,
        texte: `🙋 Nouveau client créé par ${parrain.nom} : ${base} (${String(tel).trim()}).`,
      }));

    // ⚠ Écrit en dernier, une fois tous les contrôles passés : on ne laisse
    // jamais un compte à moitié créé derrière soi.
    const ecrire = async (table, lignesAEcrire) => {
      if (!lignesAEcrire.length) return;
      const { error: e } = await admin.from(table).upsert(
        lignesAEcrire.map((d) => ({ id: d.id, data: d, updated_at: maintenant }))
      );
      if (e) throw e;
    };
    await ecrire("users", [filleul]);
    await ecrire("prospects", [prospect]);
    await ecrire("messages", messages);

    // On ne renvoie QUE ce dont le téléphone du parrain a besoin pour son
    // message WhatsApp — jamais la fiche complète, jamais l'annuaire.
    return res.status(200).json({
      filleul: { id: filleulId, nom: identifiant, nom_base: base, tel: String(tel).trim() },
      motDePasse,
    });
  } catch (e) {
    console.error("creer-filleul:", e?.message || e);
    return res.status(500).json({ error: "Le serveur a rencontré un problème. Réessayez ; si cela continue, prévenez l'administrateur." });
  }
}
