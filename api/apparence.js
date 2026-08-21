// Fonction serveur Vercel (jamais envoyée au navigateur) : renvoie
// UNIQUEMENT l'apparence de l'écran de connexion.
//
// ⚠ POURQUOI ELLE EXISTE
//
// La personnalisation de l'écran de connexion (texte du bandeau, couleurs,
// image de fond, bulles, messages qui montent) est rangée sur les fiches
// BOUTIQUES. Sur un appareil NEUF, ces fiches ne sont pas encore là : avant
// la première connexion, l'écran s'affichait donc dans son habillage par
// défaut, comme si rien n'avait été réglé (constaté par Timo, 20/08/2026).
//
// La solution évidente — rendre la table des boutiques lisible sans
// connexion — publierait bien plus que l'apparence : adresses des points de
// vente, téléphones, domaines de vente, prix internes. Après deux jours
// passés à refermer précisément ce genre d'ouverture, ce serait incohérent.
//
// Cette fonction ne renvoie donc QUE les champs d'apparence, et rien
// d'autre. Aucune donnée d'entreprise ne sort par ici.
//
// ⚠ VOLONTAIREMENT ABSENTS de la réponse : les anniversaires du jour. Ils
// demandent les noms des employés, qu'on ne publie pas — c'est justement ce
// qu'on a refermé. Ils s'afficheront sur l'appareil dès la première
// connexion, quand les fiches seront là. Les messages libres de
// l'administrateur, eux, sont destinés à être lus par tous : ils passent.

import { createClient } from "@supabase/supabase-js";

// La liste EXHAUSTIVE de ce qui a le droit de sortir. Tout champ absent
// d'ici reste dans la base, même si quelqu'un l'ajoute plus tard sur une
// fiche boutique : on choisit ce qu'on publie, on ne filtre pas ce qu'on
// cache.
const CHAMPS_APPARENCE = [
  "accueil_texte",
  "accueil_couleur_badge",
  "accueil_couleur_fond",
  "accueil_image",
  "accueil_opacite_cadres",
  "accueil_bulles",
  "accueil_image_ajustement",
  "accueil_image_position",
  "accueil_messages",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée" });

  const url = process.env.VITE_SUPABASE_URL;
  const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cleService) return res.status(500).json({ error: "Serveur mal configuré" });

  try {
    const admin = createClient(url, cleService, { auth: { persistSession: false } });
    const { data, error } = await admin.from("boutiques").select("data");
    if (error) throw error;

    // La personnalisation est écrite sur TOUTES les boutiques à la fois
    // (voir enregistrerAccueil dans Parametres.jsx) : n'importe laquelle
    // porte donc la même. On prend la première qui a quelque chose de réglé,
    // pour ne pas se laisser piéger par une fiche créée après coup.
    const apparence = {};
    for (const ligne of data || []) {
      const champs = ligne?.data || {};
      for (const cle of CHAMPS_APPARENCE) {
        if (apparence[cle] === undefined && champs[cle] !== undefined && champs[cle] !== "") {
          apparence[cle] = champs[cle];
        }
      }
    }

    // Une minute de cache : l'apparence change très rarement, et cela évite
    // un appel au serveur à chaque ouverture de l'application.
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json({ apparence });
  } catch (e) {
    return res.status(500).json({ error: `Erreur serveur : ${e?.message || e}` });
  }
}
