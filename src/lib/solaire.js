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

// La QUANTITÉ d'un appareil (20/10/2026, capture Timo : le brouillon de
// DJEDJE portait 0 climatiseur, repris il en montrait 1). Une case VIDE vaut
// 1 (comme avant) ; un 0 TAPÉ reste 0 — l'appareil est gardé dans la liste
// sans compter. `a.qte || 1` changeait le nombre 0 en 1 : ne plus l'écrire.
export const qteAppareil = (a) => {
  const v = a?.qte;
  if (v === undefined || v === null || String(v).trim() === "") return 1;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 1;
};

// Ce que consomme le client en une journée, et ce qu'il peut tirer d'un coup.
export const consommationJour = (appareils) => (appareils || [])
  .reduce((s, a) => s + Number(a.puissance || 0) * Number(a.heures || 0) * qteAppareil(a), 0);
export const puissanceSimultanee = (appareils) => (appareils || [])
  .reduce((s, a) => s + Number(a.puissance || 0) * qteAppareil(a), 0);

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

// Le cœur du calcul : à partir de la consommation du jour (Wh) et de la
// puissance qui tourne en même temps (W), QUELLE QUE SOIT LEUR ORIGINE —
// une liste d'appareils détaillée, ou une consommation connue (25/10/2026,
// voir plus bas). Tout le reste (panneaux, batteries, convertisseur,
// régulateur) ne dépend que de ces deux chiffres.
export function besoinsDepuisConsommation(whParJour, simultanee, { autonomie, soleil, tension, typeBatterie }) {
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

// Tout le dimensionnement en une fois, à partir d'une liste d'appareils —
// c'est ce que l'écran affiche par défaut.
export function besoinsSolaires(appareils, reglages) {
  return besoinsDepuisConsommation(consommationJour(appareils), puissanceSimultanee(appareils), reglages);
}

// ---- 🔌 Consommation connue (facture CEET), 25/10/2026 ----
// Timo : « est-il possible d'entrer la consommation d'une personne de son
// compteur électrique de la CEET pour que le dimensionnement solaire lui
// soit automatiquement proposé ? » — puis, après avoir vérifié que les
// panneaux/batteries/convertisseur ne dépendent que de DEUX chiffres
// (consommationJour, puissanceSimultanee ci-dessus), il a choisi l'option
// « a » : une case « Puissance cumulée (kW) » en plus de la consommation.
// « En même temps aussi, on peut taper le nombre de kW sur facture et
// diviser par 30… et si on connaît la charge instantanée avec le nombre
// d'heures, ça peut aller aussi » : DEUX chemins, un seul à remplir —
// la consommation MENSUELLE (÷ 30) si le client a sa facture, OU la
// puissance cumulée × les heures d'utilisation s'il ne l'a pas. La
// puissance cumulée, elle, sert TOUJOURS : c'est la pointe qui dimensionne
// le convertisseur, qu'on l'utilise aussi pour le Wh/jour ou non.
export const whJourDepuisConsommationMensuelle = (kwhMois) => (Number(kwhMois) > 0 ? (Number(kwhMois) * 1000) / 30 : 0);
export const whJourDepuisPuissanceHeures = (puissanceCumuleeKw, heures) =>
  (Number(puissanceCumuleeKw) > 0 && Number(heures) > 0 ? Number(puissanceCumuleeKw) * 1000 * Number(heures) : 0);
// La consommation mensuelle l'emporte si elle est donnée (un chiffre réel
// de facture vaut mieux qu'une estimation d'heures) ; sinon on se rabat sur
// puissance × heures. UNE SEULE décision — `sourceWhJourConsommationConnue`
// — que le calcul ET la phrase affichée à l'écran lisent toutes les deux :
// deux copies de ce « si » auraient fini par diverger (CLAUDE.md § 5).
export const sourceWhJourConsommationConnue = (conso) =>
  (Number(conso?.consommationMensuelle) > 0
    ? "mensuelle"
    : (Number(conso?.puissanceCumulee) > 0 && Number(conso?.heuresUtilisation) > 0 ? "heures" : null));
export const whJourDepuisConsommationConnue = (conso) => {
  const source = sourceWhJourConsommationConnue(conso);
  if (source === "mensuelle") return whJourDepuisConsommationMensuelle(conso.consommationMensuelle);
  if (source === "heures") return whJourDepuisPuissanceHeures(conso.puissanceCumulee, conso.heuresUtilisation);
  return 0;
};

// Tout le dimensionnement à partir d'une consommation connue, au lieu d'une
// liste d'appareils — même résultat, mêmes formules.
export function besoinsDepuisConsommationConnue(conso, reglages) {
  return besoinsDepuisConsommation(whJourDepuisConsommationConnue(conso), Number(conso?.puissanceCumulee) > 0 ? Number(conso.puissanceCumulee) * 1000 : 0, reglages);
}

// ---- Supports de rail et étriers ----
// Supports (14/09/2026, Timo : « c'était une erreur, le nombre de supports,
// c'est le nombre de mètres de rail ») : UN support par mètre de rail
// calculé — 22 m → 22 supports. Le « rails × 2, pair suivant » du 07/09 est
// retiré. Étriers : (panneaux × 2) + 8 (règle du 07/09/2026, inchangée).
export const supportsPourRails = (metresDeRail) => (Number(metresDeRail) > 0 ? Math.ceil(Number(metresDeRail)) : 0);
export const etriersPourPanneaux = (panneaux) => Number(panneaux || 0) * 2 + 8;

// ---- Des mètres calculés aux barres sorties du stock (14/09/2026) ----
// Le dimensionnement compte des MÈTRES (panneaux × 2,2) ; le stock compte des
// BARRES (4,2 m d'office, réglable). Décision Timo (option « b ») : le client
// paie les barres ENTAMÉES — 22 m calculés → 6 barres de 4,2 m → 25,2 m
// facturés au prix du mètre ; le stock perd 6 barres. La chute (3,2 m) est
// dite pour information. Une longueur absurde retombe sur 4,2.
export const barresDeRail = (metres, longueurBarre) => {
  const m = Math.max(0, Number(metres) || 0);
  const L = Number(longueurBarre) > 0 ? Number(longueurBarre) : 4.2;
  const barres = m > 0 ? Math.ceil(m / L - 1e-9) : 0;
  const metresFactures = Math.round(barres * L * 100) / 100;
  return { barres, longueurBarre: L, metresCalcules: m, metresFactures, chute: Math.round((metresFactures - m) * 100) / 100 };
};
