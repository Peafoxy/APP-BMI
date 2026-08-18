// ============================================================
// lib/solaire.js — Les CALCULS du dimensionnement solaire, sortis de
// l'écran pour pouvoir être vérifiés automatiquement.
// ============================================================
// ⚠ POURQUOI CE FICHIER EXISTE (18/08/2026)
//
// Timo a demandé, avant qu'on touche à l'écran Dimensionnement : « ça ne va
// rien casser dans le solaire, j'espère ? » — et en vérifiant, il n'existait
// AUCUN contrôle automatique sur ces formules. 209 vérifications portaient
// sur les bords (conversion VA→W, quantités, rails, cloisonnement), aucune
// sur le cœur du calcul. Une promesse « ça ne cassera pas » ne vaut rien tant
// qu'aucune machine ne la vérifie.
//
// Les formules ci-dessous sont RECOPIÉES À L'IDENTIQUE de Solaire.jsx, sans
// la moindre modification. La preuve qu'elles sont fidèles : elles
// reproduisent EXACTEMENT les chiffres affichés à l'écran de Timo le
// 18/08/2026 — 8 616 Wh/j → 3 590 Wc, 187 Ah, 2,47 kW, 88 A. Ce cas est
// verrouillé dans scripts/verifier-cloisonnement.mjs.
//
// Toute modification future d'un de ces chiffres fera échouer la
// vérification AVANT le déploiement.

// Rendement global du système : 20 % de pertes (câbles, poussière,
// température, rendement du convertisseur en charge).
export const RENDEMENT_SYSTEME = 0.8;

// Profondeur de décharge admissible, par type de batterie.
//
// ⚠ Le GEL est passé de 50 % à 70 % le 18/08/2026, sur décision de Timo.
// Le code portait jusque-là 50 % — la valeur des guides usuels pour tout
// plomb scellé — avec la mention « à ajuster si Timo a un autre repère
// précis pour le Gel ». C'est ce repère : 70 %.
// Conséquence concrète : à consommation égale, un parc GEL demande
// nettement moins de capacité qu'avant (359 Ah → 257 Ah sur le cas de
// référence). Les devis en gel deviennent donc moins chers.
//
// Le PLOMB / AGM reste à 50 % : il n'est plus proposé dans le menu, mais un
// ancien devis repris peut encore porter ce type, et le descendre plus bas
// l'abîmerait pour de bon.
export const PROFONDEUR_DECHARGE = { lifepo4: 0.9, gel: 0.7, plomb: 0.5 };
export const profondeurDecharge = (typeBatterie) =>
  PROFONDEUR_DECHARGE[typeBatterie] ?? 0.5;

// Tension RÉELLE d'un pack LiFePO4 (4S / 8S / 16S) — on calcule avec elle, pas
// avec la tension « ronde » du système : une batterie annoncée 48 V est en
// réalité à 51,2 V (demande Timo : « on travaille plus avec 51,2 V dans les
// calculs que 48 V »). Une batterie plomb ou gel, elle, est bien à sa tension
// nominale exacte.
export const TENSION_REELLE_LIFEPO4 = { 12: 12.8, 24: 25.6, 48: 51.2 };
export const tensionDeCalcul = (typeBatterie, tension) => (typeBatterie === "lifepo4"
  ? (TENSION_REELLE_LIFEPO4[Number(tension)] || Number(tension))
  : Number(tension));

// Ce que consomme le client en une journée, et ce qu'il peut tirer d'un coup.
export const consommationJour = (appareils) => (appareils || [])
  .reduce((s, a) => s + Number(a.puissance || 0) * Number(a.heures || 0) * Number(a.qte || 1), 0);
export const puissanceSimultanee = (appareils) => (appareils || [])
  .reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);

// Puissance crête à installer : la consommation journalière, divisée par le
// nombre d'heures de soleil utiles, puis majorée des pertes du système.
export const wcPanneaux = (whParJour, soleil) => (Number(soleil) > 0
  ? Math.ceil(whParJour / Number(soleil) / RENDEMENT_SYSTEME)
  : 0);

// Capacité du parc de batteries, en ampères-heures, pour tenir le nombre de
// jours d'autonomie demandé sans jamais descendre sous la profondeur de
// décharge admissible.
export const ahBatterie = (whParJour, autonomie, tensionCalcul, dod) => {
  const whBatterie = whParJour * Number(autonomie || 1);
  return Number(tensionCalcul) > 0 ? Math.ceil(whBatterie / Number(tensionCalcul) / dod) : 0;
};

// Convertisseur : la somme des puissances × 2. La marge couvre les pointes de
// démarrage (moteurs, compresseurs de froid) et laisse de la réserve.
export const wConvertisseur = (puissanceSimult) => Math.ceil(puissanceSimult * 2);

// Courant du régulateur MPPT, côté batterie, majoré de 25 % de sécurité.
export const aRegulateur = (wc, tensionCalcul) => (Number(tensionCalcul) > 0
  ? Math.ceil((wc / Number(tensionCalcul)) * 1.25)
  : 0);

// Tout le dimensionnement en une fois — c'est ce que l'écran affiche.
export function besoinsSolaires(appareils, { autonomie, soleil, tension, typeBatterie }) {
  const whParJour = consommationJour(appareils);
  const simultanee = puissanceSimultanee(appareils);
  const dod = profondeurDecharge(typeBatterie);
  const tensionCalcul = tensionDeCalcul(typeBatterie, tension);
  const wc = wcPanneaux(whParJour, soleil);
  const w = wConvertisseur(simultanee);
  return {
    whParJour,
    puissanceSimultanee: simultanee,
    dod,
    tensionCalcul,
    wcPanneaux: wc,
    ahBatterie: ahBatterie(whParJour, autonomie, tensionCalcul, dod),
    wConvertisseur: w,
    kwConvertisseur: w / 1000,
    aRegulateur: aRegulateur(wc, tensionCalcul),
  };
}
