// ---- 🏷 LE TITRE DU BANDEAU D'UN DEVIS (Timo, 08/11/2026, « oui lance b ») ----
// « DEVIS — Solaire » ne disait que le volet : un portail battant se lisait
// « DEVIS — Garage », un forage « DEVIS — Autre ». Décision « b » :
//   - un titre AUTOMATIQUE : le type réel d'un portail (« Portail coulissant »,
//     « Rideau métallique »), le NOM du métier d'un devis sans calcul
//     (« Forage », « Vidéosurveillance »), « Solaire » pour le solaire ;
//   - une case « 🏷 Titre du devis » sur les trois volets, pré-remplie avec le
//     titre automatique, qu'on corrige (« Solaire anti-délestage »).
// Le devis ne garde QUE le titre tapé (`titre_devis`) : vide = automatique,
// recalculé à chaque PDF (un portail dont on change le type suit tout seul).
// Les devis d'avant n'ont rien de tapé : ils prennent le titre automatique.
// Sans import (lu par les volets, 📋 Tous les devis et le banc).

export const TITRE_DEVIS_MAX = 50;

export const nettoyerTitreDevis = (texte) =>
  String(texte ?? "").replace(/\s+/g, " ").trim().slice(0, TITRE_DEVIS_MAX);

// `typeDevis` : undefined / "solaire" → solaire ; "garage" ; "autre".
// `libellePortail` : le libellé lisible du type d'ouvrant (Garage.jsx le connaît).
// `nomMetier` : le NOM du domaine d'un devis sans calcul (jamais « Autre » s'il
// y en a un vrai) ; `categorie` : repli des devis d'avant.
export function titreAutoDevis({ typeDevis, libellePortail, nomMetier, categorie } = {}) {
  if (typeDevis === "garage") return nettoyerTitreDevis(libellePortail) || "Portail";
  if (typeDevis === "autre") {
    const metier = nettoyerTitreDevis(nomMetier);
    if (metier && metier.toLowerCase() !== "autre") return metier;
    return nettoyerTitreDevis(categorie) || "Autre";
  }
  return "Solaire";
}

// Le titre écrit dans le bandeau : celui tapé, sinon l'automatique.
export const titreDuDevis = (titreTape, titreAuto) => nettoyerTitreDevis(titreTape) || nettoyerTitreDevis(titreAuto);

// Ce qui se RANGE sur le devis : rien si la case dit exactement l'automatique
// (le titre suivra alors le type ou le métier s'ils changent).
export const titreARanger = (titreTape, titreAuto) => {
  const t = nettoyerTitreDevis(titreTape);
  return t && t !== nettoyerTitreDevis(titreAuto) ? t : "";
};
