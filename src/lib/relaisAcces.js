// ============================================================
// lib/relaisAcces.js — LES IDENTIFIANTS REPARTENT PAR `espace` QUAND META
// REJETTE `espace_portail` APRÈS L'ENVOI (22/10/2026, « b+c »)
//
// Capture Timo (KATAKA) : `espace_portail` accepté à l'envoi, puis ❌
// « Failed to send message because this user's phone number is part of an
// experiment » (code 130472). Meta a rangé `espace_portail` parmi les messages
// COMMERCIAUX (14/10/2026) et en retient une partie pour certains numéros ;
// `espace` est un message de SERVICE, que cette retenue ne touche pas. Le
// refus arrive APRÈS : l'application avait cru le message parti et n'avait
// pas essayé `espace`. Le client n'a jamais reçu ses codes.
// Décision « b » : l'ordre d'essai ne change pas (`espace_portail` d'abord) ;
// dès que Meta rejette un `espace_portail`, le serveur (l'adresse d'arrivée,
// qui reçoit le ❌) envoie `espace`, UNE fois.
//
// ⚠⚠ LE MOT DE PASSE N'EST JAMAIS ÉCRIT DANS LA CONVERSATION (règle du
// 23/09) : le serveur le RECALCULE depuis la fiche du client
// (`motDePasseConnu`, comme l'écran et « ↻ Renvoyer »), le met dans le
// message, et la ligne du fil garde le texte MASQUÉ. Un mot de passe qu'on ne
// sait pas recalculer (choisi à la main) → rien ne part, et c'est dit au
// journal du serveur.
// ⚠ UNE fois : la marque `wa_relais_le` est posée sur la ligne d'accès AVEC
// la coche, avant l'envoi ; un refus du relais n'est pas retenté.
// ⚠ Rien n'est écrit dans le fil tant que WhatsApp n'a pas accepté.
// ⚠ Le mur : un compte de formation, fermé (devis imprimé), désactivé ou
// bloqué, ou qui n'est pas un client, ne reçoit rien.
// Lisible par le serveur : imports en `.js`.
// ============================================================
import { envoiIdentifiants, texteEspaceMasque } from "./whatsappModeles.js";
import { CANAL_WA } from "./whatsappConversations.js";
import { motDePasseConnu } from "./comptesClients.js";
import { estSansAcces } from "./identiteClient.js";

export const MODELE_ACCES_PREMIER = "espace_portail";
export const MODELE_ACCES_RELAIS = "espace";

// Le ❌ d'une ligne d'accès partie par `espace_portail`, pas encore relayée,
// qui dit à quel compte elle appartient.
export function relaisAccesAFaire(ligne, nouveau) {
  const l = ligne || {};
  const a = l.wa_acces || {};
  return a.modele === MODELE_ACCES_PREMIER
    && !!a.client_id
    && !l.wa_relais_le
    && !!nouveau && nouveau.etat === "echec";
}

// Les trous de `espace`, recalculés depuis la fiche RELUE du client. Rend
// { modele, variables } ou null.
export function envoiRelaisAcces({ compte, nomAffiche }) {
  const c = compte || null;
  if (!c || c.role !== "client" || c.formation || estSansAcces(c) || c.actif === false || c.bloque) return null;
  const motDePasse = motDePasseConnu(c);
  if (!motDePasse || !c.nom) return null;
  return envoiIdentifiants({ nomAffiche: nomAffiche || c.nom_base || c.nom, identifiant: c.nom, motDePasse, modele: MODELE_ACCES_RELAIS });
}

// La ligne du fil, écrite APRÈS l'accord de WhatsApp : le texte MASQUÉ du
// modèle `espace` (l'écran remplit les codes pour le créateur et
// l'administrateur — `peutLireAcces` lit `de_id`, d'où le nom de celui qui
// avait envoyé la première fois), sans propriétaire.
export function ligneRelaisAcces({ id, ligne, ts }) {
  const l = ligne || null;
  const a = (l && l.wa_acces) || null;
  if (!l || !a || !a.client_id || !l.wa_tel) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: l.de_id || "", de_nom: l.de_nom || "", lu_par: [],
    canal: CANAL_WA, wa_tel: l.wa_tel, wa_numero: l.wa_numero, wa_nom: l.wa_nom || "",
    texte: texteEspaceMasque(l.wa_nom || "", MODELE_ACCES_RELAIS),
    wa_acces: { client_id: a.client_id, renvoi: !!a.renvoi, modele: MODELE_ACCES_RELAIS, relais: true },
    wa_relais_de: l.id || "",
  };
}
