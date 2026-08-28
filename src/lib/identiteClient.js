// ============================================================
// lib/identiteClient.js — L'IDENTIFIANT ET LE MOT DE PASSE D'UN CLIENT
//
// ⚠ CE FICHIER NE DOIT JAMAIS RIEN IMPORTER.
//
// Il est chargé des DEUX côtés : par l'application (navigateur) et par la
// fonction serveur api/creer-filleul.js (Node). Le moindre import ferait
// échouer l'un des deux — Node n'accepte pas les imports sans extension que
// Vite résout tout seul.
//
// Pourquoi cette séparation (25/08/2026) : la création d'un filleul par un
// client reposait sur la lecture de TOUTE la table des comptes, depuis son
// téléphone. C'est ce qui obligeait à laisser l'annuaire entier descendre
// sur chaque appareil client. Le travail passe côté serveur ; ces deux
// calculs, eux, doivent rester IDENTIQUES des deux côtés, sinon un client
// recevrait un mot de passe qui ne le connecterait pas.
// ============================================================

export const chiffresTel = (tel) => String(tel || "").replace(/\D/g, "");
export const lettresNom = (nom) => String(nom || "").replace(/[^A-Za-zÀ-ÿ]/g, "").toUpperCase();

// Mélange déterministe (PRNG xorshift32 graine par nom+tel+variante — jamais
// Math.random) des chiffres du numéro et des lettres du nom.
function melangeDeterministe(nom, tel, variante) {
  const pool = [...chiffresTel(tel).split(""), ...lettresNom(nom).split("")];
  if (pool.length === 0) pool.push("X", "0"); // garde-fou extrême (nom et tel vides)
  const graine = `${nom}|${tel}|${variante}`;
  let etat = 0;
  for (let i = 0; i < graine.length; i++) etat = (etat * 31 + graine.charCodeAt(i)) >>> 0;
  if (etat === 0) etat = 0x9e3779b9;
  const suivant = () => {
    etat ^= etat << 13; etat >>>= 0;
    etat ^= etat >>> 17;
    etat ^= etat << 5; etat >>>= 0;
    return etat;
  };
  const m = [...pool];
  for (let i = m.length - 1; i > 0; i--) {
    const j = suivant() % (i + 1);
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

// Mot de passe par défaut (variante 0, 6 caractères) : c'est celui utilisé
// pour les aperçus à l'écran. `variante` et `longueur` ne sont utilisés que
// lors d'un conflit réel (voir resoudreMotDePasseClient) et sont alors
// mémorisés sur le compte pour rester recalculable à l'identique.
export function motDePasseClient(nom, tel, variante = 0, longueur = 6) {
  let m = melangeDeterministe(nom, tel, variante);
  while (m.length < longueur) m = m.concat(m); // garde-fou si le mélange est trop court
  return m.slice(0, longueur).join("");
}

// ⚠ DEUX ÉCRITURES DU MÊME NUMÉRO (trouvé au banc, 25/08/2026).
// Les comparaisons se faisaient sur les chiffres bruts : « +228 90 11 22 33 »
// et « 90112233 » ne se reconnaissaient donc PAS. Conséquence réelle : la même
// personne pouvait être parrainée une deuxième fois — donc une deuxième prime
// due — simplement parce que sa fiche portait l'indicatif du pays.
//
// Les numéros togolais font 8 chiffres ; l'indicatif (228) en ajoute 3. On
// compare donc les 8 DERNIERS chiffres, ce qui rend l'indicatif sans effet.
// Un numéro plus court que 8 chiffres est comparé entier (saisie partielle).
export const NB_CHIFFRES_LOCAL = 8;
export const numeroComparable = (tel) => {
  const d = chiffresTel(tel);
  return d.length > NB_CHIFFRES_LOCAL ? d.slice(-NB_CHIFFRES_LOCAL) : d;
};
export const memeNumero = (a, b) => {
  const x = numeroComparable(a), y = numeroComparable(b);
  return !!x && x === y;
};
