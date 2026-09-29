// ============================================================
// lib/clientEntreprise.js — LE PRÉNOM DU CLIENT, ET L'ENTREPRISE QU'IL
// REPRÉSENTE (Timo, 29/09/2026 : « lors de la création d'un client, demander
// aussi son prénom… une case à cocher si le client paie au nom d'une
// entreprise… ces informations doivent apparaître sur le reçu ou proforma…
// même mécanisme sur les devis… la personne mentionnée est le répondant…
// dans le contrat, on mentionne clairement l'entreprise et son répondant » →
// « A c, B b, C a, lance »).
//
// Ses trois décisions :
//   A « c » — le « numéro de l'entreprise », c'est son TÉLÉPHONE ET son
//             numéro fiscal (NIF, RCCM) ;
//   B « b » — l'entreprise se garde sur la vente / le devis ET sur la fiche
//             du client, pour être pré-remplie la fois suivante ;
//   C « a » — le prénom est OBLIGATOIRE à la création d'un compte client,
//             FACULTATIF au comptoir de 💰 Ventes.
//
// Règles pures, SANS IMPORT (lisibles par Node, comme lib/banques.js).
// ⚠ Le prénom ne touche JAMAIS l'identifiant ni le mot de passe : le client
// se connecte toujours avec son NOM (identifiantClient, motDePasseClient).
// ⚠ La personne saisie reste LE CLIENT de l'application (son compte, son
// numéro, ses accès, ses messages WhatsApp) : l'entreprise est ce qu'elle
// REPRÉSENTE, jamais un compte de plus.
// ============================================================

export const ENTREPRISE_VIDE = () => ({ actif: false, nom: "", tel: "", nif: "", rccm: "" });

const propre = (s) => String(s || "").trim().replace(/\s+/g, " ");

export const nettoyerPrenom = (p) => propre(p);

// C « a » : obligatoire à la création d'un compte client.
export function critiquePrenom(prenom) {
  return nettoyerPrenom(prenom) ? "" : "Indiquez le prénom du client.";
}

// « NOM Prénom » — le nom en capitales (comme partout), le prénom tel quel.
export const nomEtPrenom = (nom, prenom) =>
  [propre(nom).toUpperCase(), nettoyerPrenom(prenom)].filter(Boolean).join(" ");

// Ce qui s'enregistre : rien si la case n'est pas cochée ou si le nom manque.
export function entrepriseDuFormulaire(e) {
  if (!e || !e.actif) return null;
  const nom = propre(e.nom).toUpperCase();
  if (!nom) return null;
  const r = { nom };
  if (propre(e.tel)) r.tel = propre(e.tel);
  if (propre(e.nif)) r.nif = propre(e.nif).toUpperCase();
  if (propre(e.rccm)) r.rccm = propre(e.rccm).toUpperCase();
  return r;
}

// Refusé DANS le geste : une case cochée sans nom d'entreprise.
// Téléphone, NIF et RCCM restent facultatifs — toutes les petites entreprises
// n'ont pas de NIF, et un refus n'y changerait rien.
export function critiqueEntreprise(e) {
  if (!e || !e.actif) return "";
  if (!propre(e.nom)) return "Indiquez le nom de l'entreprise, ou décochez la case « entreprise ».";
  return "";
}

// Relire une entreprise enregistrée (fiche du client, vente, devis) dans le
// formulaire : la case se recoche avec ce qui avait été saisi.
export function formulaireDepuisEntreprise(e) {
  if (!e || !e.nom) return ENTREPRISE_VIDE();
  return { actif: true, nom: e.nom || "", tel: e.tel || "", nif: e.nif || "", rccm: e.rccm || "" };
}

// Les champs à poser sur une vente, une proforma, une dette, un devis.
export function champsIdentite({ prenom, entreprise } = {}) {
  const r = {};
  const p = nettoyerPrenom(prenom);
  if (p) r.prenom = p;
  const e = entreprise && entreprise.actif !== undefined ? entrepriseDuFormulaire(entreprise) : (entreprise && entreprise.nom ? entreprise : null);
  if (e) r.entreprise = e;
  return r;
}

// B « b » : ce qui se range sur la fiche du CLIENT (seulement ce qui change).
// Une entreprise décochée n'efface PAS celle de la fiche : la même personne
// peut acheter pour elle un jour, pour l'entreprise un autre.
export function ficheAvecIdentite(u, { prenom, entreprise } = {}) {
  if (!u) return u;
  const p = nettoyerPrenom(prenom);
  const e = champsIdentite({ entreprise }).entreprise;
  const avecPrenom = p && !u.prenom;
  const avecEntreprise = e && JSON.stringify(u.entreprise || null) !== JSON.stringify(e);
  if (!avecPrenom && !avecEntreprise) return u;
  return {
    ...u,
    ...(avecPrenom ? { prenom: p, nom_complet: u.nom_complet || nomEtPrenom(u.nom_base || u.nom, p) } : {}),
    ...(avecEntreprise ? { entreprise: e } : {}),
  };
}

// Les coordonnées de l'entreprise en une ligne : « Tél : … · NIF : … · RCCM : … ».
export function coordonneesEntreprise(e) {
  if (!e) return "";
  return [e.tel ? `Tél : ${e.tel}` : "", e.nif ? `NIF : ${e.nif}` : "", e.rccm ? `RCCM : ${e.rccm}` : ""].filter(Boolean).join(" · ");
}

// Le nom de la PERSONNE : « NOM Prénom ».
export const nomDuClient = (doc) => nomEtPrenom(doc && doc.client, doc && doc.prenom);

// UNE phrase pour tous les documents : le client tel qu'il doit être écrit.
//  - particulier   → { titre: "KOFFI Ama", represente: "" }
//  - entreprise    → { titre: "SOLAR SARL", coordonnees: "Tél : … · NIF : …",
//                      represente: "Représentée par : KOFFI Ama" }
export function identiteClient(doc = {}) {
  const personne = nomEtPrenom(doc.client || doc.nom, doc.prenom);
  const e = doc.entreprise && doc.entreprise.nom ? doc.entreprise : null;
  if (!e) return { titre: personne, coordonnees: "", represente: "", entreprise: null, personne };
  return {
    titre: e.nom,
    coordonnees: coordonneesEntreprise(e),
    represente: personne ? `Représentée par : ${personne}` : "",
    entreprise: e,
    personne,
  };
}

// Une seule ligne (PDF, où la place est mesurée au millimètre).
export function ligneClient(doc = {}) {
  const i = identiteClient(doc);
  if (!i.entreprise) return i.titre;
  return i.personne ? `${i.titre} (représentée par ${i.personne})` : i.titre;
}

// Le contrat : « l'entreprise X (NIF…), représentée par M./Mme NOM Prénom,
// son répondant ». Sans entreprise : « Mr/Mme NOM Prénom ».
export function partieClientContrat({ nom, prenom, tel, entreprise } = {}) {
  const personne = nomEtPrenom(nom, prenom);
  const e = entreprise && entreprise.nom ? entreprise : null;
  if (!e) return `Mr/Mme : ${personne}${tel ? `, tél. ${tel}` : ""}`;
  const coords = coordonneesEntreprise(e);
  return `L'entreprise ${e.nom}${coords ? ` (${coords})` : ""}, représentée par Mr/Mme ${personne}${tel ? ` (tél. ${tel})` : ""}, son répondant, agissant au nom et pour le compte de l'entreprise`;
}

// Ce qui s'ajoute à un compte client À SA CRÉATION (C « a » : le prénom est
// exigé avant — `critiquePrenom`). `nom_complet` est le champ que lisent déjà
// le dossier personnel et le contrat : pas un second champ pour la même chose.
export function champsCompteClient(nom, prenom, entreprise) {
  const p = nettoyerPrenom(prenom);
  const e = champsIdentite({ entreprise }).entreprise;
  return {
    ...(p ? { prenom: p, nom_complet: nomEtPrenom(nom, p) } : {}),
    ...(e ? { entreprise: e } : {}),
  };
}
