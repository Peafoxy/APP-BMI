// ============================================================
// lib/verrou.js — LE VERROU D'INACTIVITÉ (demande Timo, 09/09/2026)
//
// « Au lieu de déconnecter un compte après un temps d'inactivité, garder
// la session ouverte mais, après 3 minutes, activer une fenêtre demandant
// d'entrer le mot de passe et flouter l'arrière — évitant de voir
// l'activité de l'utilisateur par d'autres personnes. Dès que le mot de
// passe est entré et correspond à la session en cours, l'application est
// recouverte pour l'utilisateur. » — « Sur téléphone, 6 minutes. »
//
// Règles PURES (le banc les exerce) : le délai selon l'appareil, la
// décision de verrouiller, le nombre d'erreurs tolérées. L'écran est dans
// components/EcranVerrou.jsx, le branchement dans App.jsx.
// ============================================================

export const DELAI_VERROU_PC_MS = 3 * 60 * 1000;
export const DELAI_VERROU_TELEPHONE_MS = 6 * 60 * 1000;
// Au-delà, la session est fermée pour de bon (la personne se reconnecte).
export const MAX_ERREURS_VERROU = 5;

// Téléphone ou tablette : Android, iPhone, iPad, ou tout navigateur qui se
// déclare « Mobile ». Tout le reste (Windows, Mac, Linux) est un PC.
export const estTelephone = (userAgent) => /Android|iPhone|iPad|iPod|Mobile/i.test(String(userAgent || ""));

export const delaiVerrou = (userAgent) => (estTelephone(userAgent) ? DELAI_VERROU_TELEPHONE_MS : DELAI_VERROU_PC_MS);

// Faut-il verrouiller ? `derniereActivite` et `maintenant` en millisecondes.
export const doitVerrouiller = (derniereActivite, maintenant, userAgent) =>
  Number.isFinite(derniereActivite) && maintenant - derniereActivite >= delaiVerrou(userAgent);

// Après une erreur de mot de passe : combien d'essais restent, et faut-il
// fermer la session.
export const apresErreur = (erreursAvant) => {
  const erreurs = (erreursAvant || 0) + 1;
  return { erreurs, restantes: Math.max(0, MAX_ERREURS_VERROU - erreurs), fermer: erreurs >= MAX_ERREURS_VERROU };
};

// Libellé lisible du délai, pour l'écran et les messages.
export const libelleDelai = (userAgent) => `${Math.round(delaiVerrou(userAgent) / 60000)} minutes`;
