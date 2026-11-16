// ============================================================
// lib/notifClient.js — CE QU'UN COMPTE CLIENT A LE DROIT DE NOTIFIER.
// (16/11/2026, audit, point 5.) SANS IMPORT : lu par le serveur.
//
// Un client fait légitimement vibrer le téléphone du personnel dans deux
// cas, et deux seulement : il ÉCRIT (💬 Messages, ou un message automatique
// de son espace : devis rejeté, modification demandée, devis corrigé
// accepté…), ou il VALIDE un devis (la commande à préparer par la boutique).
// Avant, le serveur acceptait de sa part n'importe quel titre, n'importe
// quel texte et n'importe quel destinataire.
//
// Depuis, pour un compte client, le SERVEUR (api/notifier.js) :
//   • ne garde que ces deux sortes d'envoi (reconnues à leur étiquette) ;
//   • REFAIT le titre lui-même, avec le VRAI nom du compte ;
//   • ne garde que les écrans prévus ;
//   • n'envoie qu'à des comptes du PERSONNEL actifs — jamais à un autre client.
// Le texte reste celui du client (c'est son message), borné comme partout.
// ============================================================

export const ECRANS_PERMIS_AU_CLIENT = ["messages", "tous_devis", "commandes"];
const MARQUE_FORMATION = "🎓 ";

export const estCompteClient = (compte) => !!compte && compte.role === "client";

// Un destinataire acceptable pour un client : une personne de BMI, active.
export function estPersonnelJoignable(fiche) {
  return !!fiche && !!fiche.role && fiche.role !== "client" && fiche.actif !== false && !fiche.bloque;
}

// `envoi` : déjà nettoyé (api/_push.js). `compte` : la fiche du client, relue
// par le serveur. `fiches` : Map id → fiche des destinataires demandés.
// Rendu : l'envoi permis (titre refait, destinataires triés), ou null.
export function envoiPermisAuClient(envoi, compte, fiches) {
  if (!envoi || !estCompteClient(compte)) return null;
  const tag = String(envoi.tag || "");
  const sorte = tag.startsWith("message:") ? "message" : tag.startsWith("commande:") ? "commande" : "";
  if (!sorte) return null;
  const destinataires = (envoi.destinataires || []).filter((id) => estPersonnelJoignable(fiches && fiches.get ? fiches.get(id) : null));
  if (!destinataires.length) return null;
  const formation = compte.formation ? MARQUE_FORMATION : "";
  const nom = String(compte.nom || "Un client").slice(0, 60);
  const titre = sorte === "message" ? `${formation}💬 ${nom}` : `${formation}🛒 Commande à valider — ${nom}`;
  const ecran = ECRANS_PERMIS_AU_CLIENT.includes(envoi.ecran) ? envoi.ecran : (sorte === "commande" ? "commandes" : "messages");
  return { ...envoi, destinataires, titre, ecran };
}

// Toute la liste d'un coup.
export function envoisPermisAuClient(envois, compte, fiches) {
  return (envois || []).map((e) => envoiPermisAuClient(e, compte, fiches)).filter(Boolean);
}
