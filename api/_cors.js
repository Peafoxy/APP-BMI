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
// ⚠ POURQUOI ON NE FERME PAS D'AUTORITÉ : l'application Windows appelle ces
// mêmes fonctions, et son origine n'est pas une adresse web ordinaire. Une
// restriction posée à l'aveugle la couperait du serveur — exactement le
// genre de « correction » qui casse plus qu'elle ne répare.
//
// La liste des origines autorisées se règle donc sur Vercel, dans la
// variable ORIGINES_AUTORISEES (adresses séparées par des virgules) :
//
//     ORIGINES_AUTORISEES=https://app.bmitogo.com,https://bmitogo.com
//
// Tant qu'elle n'est pas renseignée, le comportement d'avant est conservé —
// rien ne casse, et le durcissement se fait le jour où Timo le décide.
// ============================================================

export function poserCors(req, res, methodes = "POST, OPTIONS") {
  const configurees = String(process.env.ORIGINES_AUTORISEES || "")
    .split(",").map((o) => o.trim()).filter(Boolean);
  const origine = req.headers?.origin || "";

  if (configurees.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origine && configurees.includes(origine)) {
    res.setHeader("Access-Control-Allow-Origin", origine);
    // Deux origines différentes ne doivent pas se partager une réponse mise
    // en cache par un intermédiaire.
    res.setHeader("Vary", "Origin");
  } else {
    // Origine absente : c'est le cas d'un appel qui ne vient pas d'une page
    // web (application Windows, outil en ligne de commande). Le navigateur
    // n'a alors rien à contrôler, et refuser ici couperait ces appels sans
    // rien protéger.
    if (!origine) res.setHeader("Access-Control-Allow-Origin", "*");
    else res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", methodes);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return req.method === "OPTIONS";
}
