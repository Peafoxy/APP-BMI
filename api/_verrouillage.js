// ============================================================
// api/_verrouillage.js — Combien d'essais ratés avant de fermer la porte ?
//
// ⚠ Le nom commence par « _ » : Vercel ignore ces fichiers et n'en fait pas
// une adresse publique. C'est un morceau partagé, pas un point d'entrée.
//
// ── LE DÉFAUT QUE CE FICHIER CORRIGE (signalé par Timo, 24/08/2026) ──────
//
// Avant, le compteur d'échecs était attaché AU NOM TAPÉ, et à lui seul.
// Deux conséquences fâcheuses :
//
//   1. HARCÈLEMENT. N'importe qui pouvait taper 20 mauvais mots de passe
//      sur le nom d'un de vos vendeurs et LUI bloquer sa connexion pendant
//      une heure, depuis l'autre bout du monde, sans rien connaître de
//      votre entreprise. Le vendeur, lui, était puni sans avoir rien fait.
//
//   2. ARROSAGE. Quelqu'un qui essaie UN mot de passe très courant sur 500
//      noms différents n'atteignait jamais 5 échecs sur aucun nom : il
//      n'était donc jamais ralenti.
//
// ── LA CORRECTION : TROIS COMPTEURS QUI SE COMPLÈTENT ────────────────────
//
//   A. Le compteur PRINCIPAL — « cet appareil, sur ce compte ».
//      Mêmes seuils qu'avant (5 → 1 min, 10 → 15 min, 20 → 1 h), mais il ne
//      pénalise plus QUE celui qui se trompe. Votre vendeur, qui se connecte
//      depuis ailleurs, n'est plus concerné : le harcèlement est mort.
//
//   B. Le compteur PAR APPAREIL — « cet appareil, tous comptes confondus ».
//      Répond à l'arrosage : 30 échecs = 15 min, 100 = 1 h, quels que
//      soient les noms essayés.
//
//   C. Le FILET par compte — « ce compte, depuis n'importe où ».
//      Répond au cas de l'attaquant qui change d'adresse à chaque essai
//      pour repartir de zéro sur le compteur A. Le seuil est
//      VOLONTAIREMENT très haut (60 échecs) : assez bas pour arrêter une
//      vraie attaque, trop haut pour redevenir un outil de harcèlement bon
//      marché.
//
// ── L'OUBLI AU BOUT D'UNE HEURE ─────────────────────────────────────────
//
// Un compteur qui ne redescend jamais finit par punir un honnête homme :
// 5 fautes de frappe étalées sur deux ans le bloquaient. Désormais, une
// heure sans le moindre échec remet le compteur à zéro.
//
// ── CE QUE ÇA NE PRÉTEND PAS FAIRE ──────────────────────────────────────
//
// L'adresse de l'appareil est indiquée par le réseau ; un attaquant averti
// peut en changer, ou tenter de la déguiser. C'est pourquoi elle ne sert
// JAMAIS de protection unique : les compteurs A et C reposent sur le nom du
// compte, que lui ne peut pas changer. L'adresse ne fait qu'AJOUTER un
// filet ; elle n'en retire aucun.
// ============================================================

export const PALIERS_APPAREIL_COMPTE = [
  { echecs: 20, minutes: 60 },
  { echecs: 10, minutes: 15 },
  { echecs: 5, minutes: 1 },
];
export const PALIERS_APPAREIL = [
  { echecs: 100, minutes: 60 },
  { echecs: 30, minutes: 15 },
];
export const PALIERS_COMPTE = [
  { echecs: 200, minutes: 60 },
  { echecs: 60, minutes: 10 },
];

// Une heure sans échec et le compteur repart de zéro.
export const FENETRE_OUBLI_MINUTES = 60;

// ── Décisions pures (aucun réseau) : c'est ce que le banc d'essai vérifie ──

// Les paliers sont rangés du plus sévère au plus doux : le premier atteint
// gagne.
export function palierPour(echecs, paliers) {
  return paliers.find((p) => echecs >= p.echecs) || null;
}

// Lit une ligne de la table et dit où on en est. `maintenant` est passé en
// paramètre (et non lu de l'horloge) pour que le banc d'essai puisse
// simuler le temps qui passe.
export function etatDeLaLigne(ligne, maintenant = new Date()) {
  const t = maintenant.getTime();
  if (ligne?.verrouille_jusqu_a) {
    const fin = new Date(ligne.verrouille_jusqu_a).getTime();
    if (fin > t) {
      return { verrouille: true, minutesRestantes: Math.ceil((fin - t) / 60000), echecs: ligne.echecs || 0 };
    }
  }
  // ⚠ L'oubli ne s'applique qu'à un compteur DÉJÀ expiré : on ne remet
  // jamais à zéro un verrou encore actif (ce serait l'annuler).
  const dernier = ligne?.dernier_echec ? new Date(ligne.dernier_echec).getTime() : 0;
  const oublie = !dernier || t - dernier > FENETRE_OUBLI_MINUTES * 60000;
  return { verrouille: false, minutesRestantes: 0, echecs: oublie ? 0 : ligne?.echecs || 0 };
}

// L'adresse de l'appareil qui appelle, telle que Vercel nous la donne.
// `x-real-ip` est posée par Vercel lui-même ; `x-forwarded-for` est une
// liste dont le premier élément est l'appelant. En cas de doute on renvoie
// « inconnu » : tous les appels sans adresse partagent alors le même
// compteur B, ce qui est prudent, jamais permissif.
export function adresseAppelant(req) {
  const entetes = req?.headers || {};
  const direct = entetes["x-real-ip"];
  if (direct) return String(direct).trim();
  const chaine = entetes["x-forwarded-for"];
  if (chaine) {
    const premier = String(chaine).split(",")[0].trim();
    if (premier) return premier;
  }
  return "inconnu";
}

// Les trois clés à contrôler pour une tentative. `prefixe` sépare les
// compteurs d'une fonction serveur de ceux d'une autre (la recherche de
// compte et la synchronisation d'authentification ne doivent pas se
// mélanger).
export function clesDeControle(prefixe, cible, adresse) {
  return [
    { cle: `${prefixe}:a:${adresse}|${cible}`, paliers: PALIERS_APPAREIL_COMPTE, reinitialisable: true },
    { cle: `${prefixe}:b:${adresse}`, paliers: PALIERS_APPAREIL, reinitialisable: false },
    { cle: `${prefixe}:c:${cible}`, paliers: PALIERS_COMPTE, reinitialisable: true },
  ];
}

// ── Lecture / écriture (une seule requête dans chaque sens) ──────────────

// Si la table n'existe pas encore, on ne bloque personne : mieux vaut ne
// pas compter que d'empêcher tout le monde de travailler.
export async function lireVerrous(admin, cles, maintenant = new Date()) {
  const ids = cles.map((c) => c.cle);
  const { data, error } = await admin.from("tentatives_connexion").select("*").in("id", ids);
  if (error) return { verrouille: false, etats: new Map(ids.map((id) => [id, 0])) };
  const lignes = new Map((data || []).map((l) => [l.id, l]));
  const etats = new Map();
  let minutesRestantes = 0;
  for (const id of ids) {
    const e = etatDeLaLigne(lignes.get(id), maintenant);
    etats.set(id, e.echecs);
    if (e.verrouille) minutesRestantes = Math.max(minutesRestantes, e.minutesRestantes);
  }
  return { verrouille: minutesRestantes > 0, minutesRestantes, etats };
}

// ⚠ N'est appelée QUE si aucun verrou n'est actif (voir les fonctions
// serveur). C'est ce qui garde la table bornée : dès que le compteur B
// ferme l'appareil, plus une seule ligne nouvelle ne peut être créée depuis
// lui — impossible donc de faire gonfler la base avec des noms au hasard.
export async function enregistrerEchec(admin, cles, etats, maintenant = new Date()) {
  const t = maintenant.getTime();
  const lignes = cles.map(({ cle, paliers }) => {
    const echecs = (etats.get(cle) || 0) + 1;
    const palier = palierPour(echecs, paliers);
    return {
      id: cle,
      echecs,
      dernier_echec: new Date(t).toISOString(),
      verrouille_jusqu_a: palier ? new Date(t + palier.minutes * 60000).toISOString() : null,
    };
  });
  await admin.from("tentatives_connexion").upsert(lignes);
}

// ⚠ Le compteur B (par appareil) n'est VOLONTAIREMENT pas remis à zéro par
// une connexion réussie : sinon, dans un bureau où tout le monde partage la
// même adresse, il suffirait qu'un employé se connecte normalement pour
// effacer les traces d'un arrosage en cours. Il redescend tout seul au bout
// d'une heure sans échec, ce qui suffit.
export async function reinitialiserEchecs(admin, cles) {
  const lignes = cles
    .filter((c) => c.reinitialisable)
    .map((c) => ({ id: c.cle, echecs: 0, dernier_echec: null, verrouille_jusqu_a: null }));
  if (lignes.length) await admin.from("tentatives_connexion").upsert(lignes);
}
