// ============================================================
// lib/pompes.js — LES POMPES : CE QU'ON EN SAIT, ET CE QU'IL FAUT POUR UN FORAGE
//
// Timo, 20/09/2026 : « j'ai mis les modèles de pompe mais pour un commun des
// mortels, impossible de savoir la puissance, la profondeur, le débit et la
// tension… comment résoudre le problème ».
//
// ⚠⚠ LA DIFFICULTÉ À NE JAMAIS OUBLIER : **une pompe ne donne PAS son débit
// maximal à sa profondeur maximale.** Une pompe annoncée « 60 m · 3 m³/h »
// fait 3 m³/h en surface, et peut-être 0,8 m³/h à 55 m. C'est sa COURBE.
// Donc ce fichier ne promet JAMAIS un débit à une hauteur donnée : il dit
// quelles pompes MONTENT assez haut, et renvoie à la fiche du fabricant pour
// le débit réel. C'est l'option « A », choisie par Timo — l'option « C » (la
// vraie courbe, 3 à 5 points saisis par modèle) reste ouverte : « avec le
// temps on peut implémenter le C. Mais pas aujourd'hui ».
//
// Module PUR, sans aucun import (même règle que lib/banques.js).
// ============================================================

const sansAccents = (t) => String(t ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------
// QU'EST-CE QU'UNE POMPE
// ---------------------------------------------------------------
// ⚠ C'est la CATÉGORIE qui décide, jamais le nom (Timo, 20/09/2026 : « les
// pompes sont rangées dans domaine forage, catégorie pompe »). Se fier au nom
// ferait d'un « tuyau de pompe » ou d'un « câble de pompe » une pompe, et le
// formulaire lui demanderait sa profondeur maximale.
export const MOT_POMPE = "pompe";
export const estPompe = (p) => sansAccents(p?.categorie).includes(MOT_POMPE);
export const pompesDuStock = (produits) => (Array.isArray(produits) ? produits : []).filter(estPompe);

// ---------------------------------------------------------------
// CE QU'ON NOTE SUR UNE POMPE
// ---------------------------------------------------------------
// ⚠ `tension` EXISTE DÉJÀ sur une fiche article depuis toujours — elle n'était
// simplement affichée nulle part. On la réutilise au lieu d'en créer une
// deuxième : deux champs pour la même chose finissent par se contredire.
export const CHAMPS_POMPE = [
  ["puissance_kw", "Puissance (kW)", "nombre"],
  ["profondeur_max_m", "Profondeur max (m)", "nombre"],
  ["debit_max_m3h", "Débit max (m³/h)", "nombre"],
  ["tension", "Tension (V)", "nombre"],
  ["hybride", "Hybride (solaire + secteur)", "case"],
];

const nb = (v) => (Number(v) > 0 ? Number(v) : 0);
const joli = (v) => String(v).replace(".", ",");

// La ligne qui se lit SOUS le nom, partout où on choisit un article.
// Rend "" quand on ne sait rien : on n'écrit pas une ligne vide.
export function ficheLisible(p) {
  if (!p) return "";
  const bouts = [];
  if (nb(p.puissance_kw)) bouts.push(`${joli(nb(p.puissance_kw))} kW`);
  if (nb(p.profondeur_max_m)) bouts.push(`${joli(nb(p.profondeur_max_m))} m`);
  if (nb(p.debit_max_m3h)) bouts.push(`${joli(nb(p.debit_max_m3h))} m³/h`);
  if (nb(p.tension)) bouts.push(`${joli(nb(p.tension))} V`);
  if (p.hybride) bouts.push("hybride");
  return bouts.join(" · ");
}

// Une pompe dont on ne sait rien ne peut pas être proposée par le calcul.
// L'écran le DIT — sinon le vendeur croit qu'aucune pompe ne convient.
export const pompeRenseignee = (p) => nb(p?.profondeur_max_m) > 0;
export const pompesSansFiche = (produits) => pompesDuStock(produits).filter((p) => !pompeRenseignee(p));

// ---------------------------------------------------------------
// L'ÉTAPE 2 — QUELLE POMPE POUR CE FORAGE (option « A »)
// ---------------------------------------------------------------
// ⚠ LE NIVEAU DYNAMIQUE, PAS LA PROFONDEUR DU FORAGE. Un forage de 60 m dont
// l'eau se stabilise à 45 m pendant le pompage ne fait monter l'eau que de
// 45 m. C'est le foreur qui donne ce chiffre ; sans lui on ne calcule rien.
export const PERTES_PCT_DEFAUT = 5;
export const HEURES_SOLEIL_DEFAUT = 6;

const arrondi = (x, n = 1) => Math.round(x * 10 ** n) / 10 ** n;

// La hauteur totale à vaincre (les professionnels disent « HMT »).
// ⚠ Les frottements sont une ESTIMATION (ils dépendent du diamètre du tuyau) :
// l'écran écrit « estimé », jamais un chiffre présenté comme exact.
export function hauteurManometrique({ niveauDynamique, hauteurReservoir, longueurTuyau, pctPertes = PERTES_PCT_DEFAUT } = {}) {
  const eau = nb(niveauDynamique);
  const reservoir = nb(hauteurReservoir);
  const tuyau = nb(longueurTuyau);
  const pct = Number(pctPertes) >= 0 ? Number(pctPertes) : PERTES_PCT_DEFAUT;
  const pertes = arrondi(tuyau * pct / 100);
  return { eau, reservoir, tuyau, pertes, hmt: arrondi(eau + reservoir + pertes) };
}

// Le débit qu'il faut, en m³/h, pour sortir N litres dans la journée.
export function debitNecessaire({ litresParJour, heuresSoleil = HEURES_SOLEIL_DEFAUT } = {}) {
  const litres = nb(litresParJour);
  const heures = nb(heuresSoleil) || HEURES_SOLEIL_DEFAUT;
  return arrondi(litres / 1000 / heures, 2);
}

export function critiqueCalculPompe({ niveauDynamique, litresParJour } = {}) {
  if (!nb(niveauDynamique)) {
    return "Indiquez le niveau dynamique : la profondeur à laquelle l'eau se stabilise PENDANT le pompage. C'est le foreur qui le donne — ce n'est pas la profondeur du forage.";
  }
  if (!nb(litresParJour)) return "Indiquez le besoin en eau par jour, en litres.";
  return "";
}

// ⚠⚠ CE QU'ON NE DIRA JAMAIS : « cette pompe vous donnera X m³/h à 56 m ».
// On ne le sait pas — il faudrait la courbe du fabricant (option « C »).
export const AVERTISSEMENT_COURBE =
  "Une pompe ne donne pas son débit maximal à sa profondeur maximale. "
  + "Avant de promettre un débit au client, vérifiez-le sur la fiche du fabricant À CETTE HAUTEUR.";

// Les pompes du stock qui MONTENT assez haut. La plus juste d'abord : une
// pompe de 60 m pour 56 m de hauteur coûte moins cher qu'une pompe de 120 m,
// et c'est au vendeur de garder la marge qu'il juge bonne.
export function pompesQuiConviennent(produits, hmt) {
  const h = nb(hmt);
  return pompesDuStock(produits)
    .filter((p) => pompeRenseignee(p) && nb(p.profondeur_max_m) >= h)
    .sort((a, b) => nb(a.profondeur_max_m) - nb(b.profondeur_max_m));
}

// Celles qu'on écarte, et POURQUOI — une liste vide sans explication laisse
// croire que la boutique n'a pas de pompe.
export function pompesTropCourtes(produits, hmt) {
  const h = nb(hmt);
  return pompesDuStock(produits)
    .filter((p) => pompeRenseignee(p) && nb(p.profondeur_max_m) < h)
    .sort((a, b) => nb(b.profondeur_max_m) - nb(a.profondeur_max_m));
}

// Le résumé complet que l'écran affiche, en une fois.
export function etudePompe(produits, saisie) {
  const refus = critiqueCalculPompe(saisie);
  const mesure = hauteurManometrique(saisie);
  const debit = debitNecessaire(saisie);
  return {
    refus,
    ...mesure,
    debit,
    conviennent: refus ? [] : pompesQuiConviennent(produits, mesure.hmt),
    tropCourtes: refus ? [] : pompesTropCourtes(produits, mesure.hmt),
    sansFiche: pompesSansFiche(produits),
    avertissement: AVERTISSEMENT_COURBE,
  };
}
