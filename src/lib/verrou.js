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
// ⚠ Timo (09/09/2026) : « toujours garder la déconnexion de 30 min
// d'inactivité — ne pas laisser indéfiniment la session verrouillée ». Le
// verrou vient à 3 / 6 min ; à 30 min sans geste, verrouillée ou non, la
// session se ferme (PC et téléphone).
export const DELAI_DECONNEXION_MS = 30 * 60 * 1000;
export const doitDeconnecter = (derniereActivite, maintenant) =>
  Number.isFinite(derniereActivite) && maintenant - derniereActivite >= DELAI_DECONNEXION_MS;

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

// ---- LA COULEUR DE LA CARTE DE VERROUILLAGE (Timo, 09/09/2026 : « avoir le
// réglage des couleurs de la carte de verrouillage à lui seul ») ----
// Réglée dans ⚙ Paramètres → écran de connexion → 🔒 Fenêtre de
// verrouillage : une couleur (verrou_couleur_carte) et une transparence
// (verrou_opacite_carte, 0 à 100). Règles pures, exercées par le banc.
export const COULEUR_CARTE_VERROU_DEFAUT = "#ffffff";

// « #rrggbb » → { r, g, b } ; une valeur illisible vaut le blanc.
export const rgbDe = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return { r: 255, g: 255, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

// La couleur de la carte avec sa transparence : « rgba(r,g,b,a) ».
export const fondCarteVerrou = (hex, opacite) => {
  const { r, g, b } = rgbDe(hex || COULEUR_CARTE_VERROU_DEFAUT);
  const o = opacite === undefined || opacite === null || opacite === "" ? 100 : Number(opacite);
  const a = Math.max(0, Math.min(100, Number.isFinite(o) ? o : 100)) / 100;
  return `rgba(${r},${g},${b},${a})`;
};

// Une carte sombre veut un texte clair : luminance perçue sous 0,5.
export const texteClairSur = (hex) => {
  const { r, g, b } = rgbDe(hex || COULEUR_CARTE_VERROU_DEFAUT);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
};

// ---- LA SESSION SÉCURISÉE TOMBÉE (Timo, 09/09/2026) ----
// « Lecture de « users » impossible : permission denied… » revenait souvent :
// la demande partait SANS session (jeton perdu après une veille, une coupure
// au moment du renouvellement, un rechargement de page). Décision Timo :
// « à la place, verrouiller la session — même fenêtre que celle qui vient
// par inactivité » ; le mot de passe déverrouille ET rouvre la session.
// Reconnaît, dans le message d'erreur du serveur, une session absente ou
// expirée (jamais un contenu refusé par une règle : ça, c'est autre chose).
export const sessionPerdueSelon = (message) =>
  /permission denied|jwt expired|invalid jwt|jwt malformed|refresh_token|401|PGRST301|no api key|unauthori[sz]ed/i.test(String(message || ""));

export const MESSAGE_SESSION_PERDUE = "Session sécurisée expirée : entrez votre mot de passe pour la rétablir.";
