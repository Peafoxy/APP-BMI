// ============================================================
// lib/relaisRecuPdf.js — LE REÇU ET LA PROFORMA REPARTENT EN TEXTE QUAND META
// REJETTE LE PDF (19/10/2026, Timo : « si proforma pdf ou reçu pdf refuse,
// prendre ceux du texte »).
//
// Un refus IMMÉDIAT (modèle pas encore approuvé…) faisait déjà partir le
// texte. Restait le refus qui arrive APRÈS l'envoi : WhatsApp accepte le
// `recu_pdf` / `proforma_pdf`, puis Meta pose un ❌ (comme le `devis_pdf` de
// MANDA le 18/10). L'écran a cru le PDF parti : le client ne recevait RIEN.
// Désormais l'adresse d'arrivée, au ❌, envoie le message en TEXTE — UNE fois.
//
// D'où vient le texte :
// - une proforma, un versement, une réservation : la ligne du PDF porte
//   `wa_relais_texte = { modele, variables }` (le message texte que l'écran
//   aurait envoyé). Ces lignes ne sont pas privées : elles disent déjà ces
//   montants en clair, rien de plus ne descend ;
// - une VENTE : sa ligne est PRIVÉE (la conversation descend chez tout le
//   personnel) — elle ne porte AUCUN détail. Le serveur RECOMPOSE les deux
//   reçus depuis la vente, par LA fabrique de l'envoi (`envoisRecuDeVente`,
//   lib/recuDeVente.js) : le détaillé d'abord, le court ensuite.
//
// ⚠ UNE fois : la marque `wa_relais_le` est posée AVEC la coche, avant
// l'envoi ; un refus du texte n'est pas retenté. ⚠ Rien n'est écrit dans le
// fil tant que WhatsApp n'a pas accepté. ⚠ Le mur : une vente ou une boutique
// de formation ne relaie rien. Lisible par le serveur : imports en `.js`.
// ============================================================
import { MODELES, ligneEnvoiModele, ligneMasquee, lignePriveeEnvoi } from "./whatsappModeles.js";
import { CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { envoisRecuDeVente } from "./recuDeVente.js";

export const MODELES_PDF_RELAYES = ["recu_pdf", "proforma_pdf"];
// Les seuls messages texte qu'un relais peut faire partir.
export const MODELES_TEXTE_RELAIS = ["recu_vente_detail", "recu_vente", "recu_reglement", "recu_reservation", "proforma"];
export const SUITE_LIGNE_RELAIS_RECU = " (le PDF n'a pas été accepté par WhatsApp : message envoyé sans PDF)";

// Le message texte rangé sur la ligne du PDF : valide seulement s'il est un
// des messages permis, avec le bon nombre de trous, tous remplis.
export function relaisTexteValide(rt) {
  if (!rt || !MODELES_TEXTE_RELAIS.includes(rt.modele) || !Array.isArray(rt.variables)) return false;
  const attendu = (MODELES[rt.modele]?.variables || []).length;
  return attendu > 0 && rt.variables.length === attendu && rt.variables.every((v) => typeof v === "string" && v.trim() !== "");
}

// Ce que la ligne du PDF garde pour un relais : le texte, SAUF pour une vente
// (ligne privée : le serveur recomposera depuis la vente).
export function champRelaisTexte(modele, ref, envoiTexte) {
  if (!MODELES_PDF_RELAYES.includes(modele) || lignePriveeEnvoi(modele, ref)) return {};
  const rt = envoiTexte ? { modele: envoiTexte.modele, variables: envoiTexte.variables } : null;
  return relaisTexteValide(rt) ? { wa_relais_texte: rt } : {};
}

// Le ❌ d'un reçu ou d'une proforma en PDF, pas encore relayé, qui sait d'où
// prendre son texte.
export function relaisRecuAFaire(ligne, nouveau) {
  const l = ligne || {};
  return MODELES_PDF_RELAYES.includes(l.wa_modele)
    && !l.wa_relais_le
    && (relaisTexteValide(l.wa_relais_texte) || (l.wa_modele === "recu_pdf" && !!l.vente_id))
    && !!nouveau && nouveau.etat === "echec";
}

// Les messages texte à essayer, dans l'ordre. Rend [] si rien ne doit partir.
export function envoisDuRelais({ ligne, vente = null, boutique = {}, dette = null }) {
  const l = ligne || {};
  if (relaisTexteValide(l.wa_relais_texte)) return [{ modele: l.wa_relais_texte.modele, variables: l.wa_relais_texte.variables.slice() }];
  if (l.wa_modele !== "recu_pdf" || !l.vente_id || !vente || vente.id !== l.vente_id) return [];
  if (vente.formation || (boutique && boutique.formation) || vente.supprime_le) return [];
  return envoisRecuDeVente(vente, { boutique: boutique || {}, dette: dette || { paye: 0, montant: 0 } })
    .filter((e) => e && MODELES_TEXTE_RELAIS.includes(e.modele));
}

// La ligne du fil, écrite APRÈS l'accord de WhatsApp : au nom de celui qui
// avait envoyé le PDF, sans propriétaire. Une vente reste PRIVÉE.
export function ligneRelaisRecu({ id, ligne, envoi, ts }) {
  if (!ligne || !envoi) return null;
  const base = ligneEnvoiModele(envoi.modele, envoi.variables);
  if (!base) return null;
  const ref = ligne.vente_id ? { vente_id: ligne.vente_id } : {};
  const prive = lignePriveeEnvoi(envoi.modele, ref);
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: ligne.de_id || "", de_nom: ligne.de_nom || "", lu_par: [],
    canal: CANAL_WA, wa_tel: ligne.wa_tel, wa_numero: ligne.wa_numero, wa_nom: ligne.wa_nom || "",
    texte: prive ? ligneMasquee(envoi.modele) : `${base}${SUITE_LIGNE_RELAIS_RECU}`,
    wa_modele: envoi.modele, wa_relais_de: ligne.id || "",
    ...(ligne.vente_id ? { vente_id: ligne.vente_id } : {}),
    ...(ligne.dette_id ? { dette_id: ligne.dette_id } : {}),
    ...(prive ? { wa_prive: true } : {}),
  };
}

// La fiche légère suit, sans toucher au propriétaire.
export const enteteApresRelaisRecu = ({ ligne, ts, entete }) =>
  construireEntete({
    cle: ligne.wa_tel, tel: ligne.wa_numero || "", nom: ligne.wa_nom || "",
    proprietaire_id: (entete && entete.proprietaire_id) || "", proprietaire_nom: (entete && entete.proprietaire_nom) || "",
    derniere: ts, entete,
  });
