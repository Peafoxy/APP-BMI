// ============================================================
// api/_cors.js — Qui a le droit d'appeler nos fonctions serveur ?
//
// ⚠ Le nom commence par « _ » : Vercel ignore ces fichiers et n'en fait pas
// une adresse publique. C'est un morceau partagé, pas un point d'entrée.
//
// POINT 18 DE L'AUDIT DU 20/08/2026 — les quatre fonctions serveur
// répondaient « Access-Control-Allow-Origin: * », c'est-à-dire : n'importe
// quel site web peut nous appeler depuis le navigateur d'un visiteur.
//
// ⚠ CE QUE CELA N'EXPOSE PAS, pour ne pas dramatiser : trois de ces quatre
// fonctions exigent un mot de passe valide avant de répondre quoi que ce
// soit, et la quatrième (l'apparence de l'écran de connexion) est publique
// par nature. Une page hostile n'obtiendrait donc rien qu'elle ne puisse
// déjà obtenir depuis son propre serveur. C'est de l'hygiène, pas un trou.
//
// ── CE QUI CHANGE LE 24/08/2026 (demande de Timo) ────────────────────────
//
// La restriction ne dort plus en attendant un réglage sur Vercel : elle est
// ACTIVE, avec une liste d'origines inscrite ici même. Trois précautions
// pour qu'elle ne coupe personne :
//
//   1. MÊME ADRESSE = TOUJOURS AUTORISÉ. Quand la page et la fonction sont
//      sur le même site — c'est le cas de l'application web, qui appelle
//      « /api/... » sans préciser de domaine — il n'y a même pas de
//      contrôle à faire côté navigateur. Cette règle à elle seule garantit
//      que l'application web ne peut PAS être cassée par ce fichier, quel
//      que soit le domaine sur lequel vous la déployez, y compris une
//      adresse d'essai Vercel.
//
//   2. PAS D'ORIGINE = AUTORISÉ. Un appel qui ne vient pas d'une page web
//      (application Windows, outil en ligne de commande) n'envoie pas
//      d'origine, ou envoie « null ». Le navigateur n'a alors rien à
//      contrôler, et refuser ici couperait ces appels sans rien protéger.
//
//   3. RÉGLAGE DE SECOURS. La variable ORIGINES_AUTORISEES sur Vercel
//      REMPLACE la liste ci-dessous (adresses séparées par des virgules) :
//
//          ORIGINES_AUTORISEES=https://gestion.bmitogo.com,https://autre.com
//
//      Et la valeur unique « * » revient exactement au comportement d'avant,
//      sans redéploiement de code — c'est le bouton de retour arrière si
//      quelque chose d'imprévu se coupait.
// ============================================================

// Les adresses web depuis lesquelles l'application est servie.
// ⚠ Ajouter une ligne ici quand un nouveau domaine est mis en service —
// ou, plus simple, renseigner ORIGINES_AUTORISEES sur Vercel.
export const ORIGINES_PAR_DEFAUT = [
  "https://gestion.bmitogo.com",
  "https://bmitogo.com",
  "https://www.bmitogo.com",
];

function listeAutorisee() {
  const configurees = String(process.env.ORIGINES_AUTORISEES || "")
    .split(",").map((o) => o.trim()).filter(Boolean);
  return configurees.length ? configurees : ORIGINES_PAR_DEFAUT;
}

// ── La décision, isolée du reste pour être vérifiable par le banc d'essai ──
//
// Renvoie ce qu'il faut mettre dans « Access-Control-Allow-Origin » :
// une adresse précise, « * », ou null (= on ne met rien, le navigateur
// refusera la réponse).
export function origineAutorisee(origine, hote, liste = listeAutorisee()) {
  // Le retour arrière complet.
  if (liste.includes("*")) return "*";

  // Cas 2 : appel hors navigateur.
  if (!origine || origine === "null") return "*";

  // Cas 1 : la page et la fonction sont au même endroit.
  // ⚠ `hote` est l'adresse à laquelle la requête est ARRIVÉE. On pourrait
  // croire qu'un attaquant la choisit (elle voyage dans l'en-tête « Host »),
  // mais non : c'est elle qui décide chez quel hébergeur la requête
  // atterrit. Une requête portant « Host: site-hostile.com » n'arriverait
  // jamais jusqu'à nos fonctions.
  try {
    if (hote && new URL(origine).host === String(hote)) return origine;
  } catch { /* origine mal formée : on continue, elle sera refusée */ }

  // Cas 3 : la liste.
  return liste.includes(origine) ? origine : null;
}

export function poserCors(req, res, methodes = "POST, OPTIONS") {
  const origine = req.headers?.origin || "";
  const autorisee = origineAutorisee(origine, req.headers?.host || "");

  if (autorisee) res.setHeader("Access-Control-Allow-Origin", autorisee);
  // Deux origines différentes ne doivent pas se partager une réponse mise
  // en cache par un intermédiaire.
  if (autorisee !== "*") res.setHeader("Vary", "Origin");

  res.setHeader("Access-Control-Allow-Methods", methodes);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // Évite de redemander l'autorisation à chaque appel pendant 24 h.
  res.setHeader("Access-Control-Max-Age", "86400");
  return req.method === "OPTIONS";
}
