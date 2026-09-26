// ============================================================
// lib/rappels.js — LES NOTIFICATIONS « POUR INFORMATION » QUI DÉPENDENT
// DU CALENDRIER, et la fabrique commune de tout envoi de notification.
//
// Timo (13/09/2026) : « Lance avec la liste A telle quelle comme message.
// Et B aussi telle quelle, à titre informatif dans les notifications. »
// La liste B (ce qui reste à l'écran, jamais dans 💬 Messages) se divise en
// deux : ce qui se voit au moment du geste (lib/notifications.js, dans le
// save de l'application) et ce qui dépend du JOUR — une caisse d'hier non
// clôturée, une dette qui passe les 30 jours, un devis qui atteint ses
// 15 jours sans réponse. Ces trois-là sont calculés chaque matin PAR LE
// SERVEUR (api/rappels-du-matin.js), d'où ce fichier sans React.
//
// ⚠ Ce fichier n'importe que des modules lisibles par Node (imports avec
// l'extension .js) : lib/espace.js, lib/cloture.js, lib/core.js,
// lib/comptesClients.js. Le banc l'importe DIRECTEMENT dans Node : si un
// import cassait cette chaîne, le banc tomberait avant le serveur.
//
// Les règles « dette en retard » (30 jours) et « devis à relancer »
// (15 jours) vivaient dans les écrans Dettes et Tous les devis : elles sont
// ici, écrites UNE fois, et les écrans les importent.
// ============================================================
import { joursAClôturer } from "./cloture.js";
import { totalVente, fmt, dFR } from "./core.js";
import { devisRelancable } from "./comptesClients.js";
import { estSupprime } from "./corbeille.js";
import { estCompteFormation, boutiqueEstFormation, idsDeLaBoutique, idsParRole, idsAdmins } from "./espace.js";

export const SEUIL_RELANCE_JOURS = 15;
export const RETARD_DETTE_JOURS = 30;
export const LONGUEUR_TEXTE = 180;
export const CAISSE_COMPTABLE = "Chez le comptable";

// Jours entiers entre deux dates AAAA-MM-JJ (négatif si `a` précède `de`).
export const joursEntre = (de, a) => {
  const t0 = Date.parse(String(de || "").slice(0, 10));
  const t1 = Date.parse(String(a || "").slice(0, 10));
  if (Number.isNaN(t0) || Number.isNaN(t1)) return 0;
  return Math.floor((t1 - t0) / 86400000);
};
export const hier = (aujourdhui) => new Date(Date.parse(String(aujourdhui).slice(0, 10)) - 86400000).toISOString().slice(0, 10);

// ---- Dettes : « plus de 30 jours et il reste à payer » (écran Dettes) ----
export const joursDeDette = (d, aujourdhui) => joursEntre(d.date, aujourdhui);
export const resteDette = (d) => Number(d.montant || 0) - Number(d.paye || 0);
export const detteEnRetard = (d, aujourdhui) => joursDeDette(d, aujourdhui) > RETARD_DETTE_JOURS && resteDette(d) > 0;
// Le jour où la dette PASSE en retard : le 31e jour, une seule fois.
export const dettePasseEnRetard = (d, aujourdhui) => joursDeDette(d, aujourdhui) === RETARD_DETTE_JOURS + 1 && resteDette(d) > 0;

// ---- Devis : 15 jours sans réponse, comptés depuis la dernière relance ----
export const joursSansReponse = (devis, aujourdhui) => joursEntre(devis.relance_le || devis.date, aujourdhui);
// ⚠ Un devis mis à la CORBEILLE (supprime_le) ne se relance jamais : le
// serveur lit les fiches brutes, la corbeille n'y est pas séparée.
export const devisARelancer = (devis, aujourdhui) => !estSupprime(devis) && devisRelancable(devis) && joursSansReponse(devis, aujourdhui) >= SEUIL_RELANCE_JOURS;
// Le jour où le devis ATTEINT le seuil : une seule fois par relance.
export const devisAtteintLeSeuil = (devis, aujourdhui) => !estSupprime(devis) && devisRelancable(devis) && joursSansReponse(devis, aujourdhui) === SEUIL_RELANCE_JOURS;

// ---- La fabrique d'un envoi ----
// Un envoi = { destinataires (ids, sans doublon), titre, texte, ecran, tag }.
// `formation` : l'événement est de l'espace formation → le titre porte 🎓,
// pour que l'administrateur principal (qui reçoit les deux espaces) sache
// d'où ça vient. Un envoi sans personne à prévenir n'existe pas (null).
export const abreger = (texte, max = LONGUEUR_TEXTE) => {
  const t = String(texte || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
export function fabriquerEnvoi({ destinataires, titre, texte, ecran = "", tag = "", formation = false }) {
  const ids = [...new Set((destinataires || []).filter(Boolean))];
  if (!ids.length) return null;
  return { destinataires: ids, titre: `${formation ? "🎓 " : ""}${titre}`, texte: abreger(texte), ecran, tag };
}

// ---- La tournée du matin ----
// `db` : les tables lues telles quelles (users, boutiques, ventes, dettes,
// depenses, clotures). Rendu : la liste des envois du jour.
export function rappelsDuMatin(db, aujourdhui) {
  const envois = [];
  const boutiques = (db.boutiques || []).filter((b) => !b.depot && b.nom !== CAISSE_COMPTABLE);

  // 1. Une caisse d'hier (ou d'avant) sans clôture : les ventes y sont
  //    bloquées (règle du 09/09/2026). Vendeurs et gérant de la boutique,
  //    plus les administrateurs de l'espace — tous les matins tant que ça dure.
  boutiques.forEach((b) => {
    const jours = joursAClôturer(db, b.nom, aujourdhui, totalVente);
    if (!jours.length) return;
    const formation = !!b.formation;
    const premier = dFR(jours[0]);
    const texte = jours.length === 1
      ? `La journée du ${premier} de ${b.nom} n'a pas été clôturée : les ventes y sont bloquées jusqu'à la clôture du jour.`
      : `La journée du ${premier} de ${b.nom} n'a pas été clôturée (et ${jours.length - 1} autre${jours.length > 2 ? "s" : ""} jour${jours.length > 2 ? "s" : ""}) : les ventes y sont bloquées jusqu'à la clôture du jour.`;
    envois.push(fabriquerEnvoi({
      destinataires: [...idsDeLaBoutique(db, b.nom, ["vendeur", "gerant"]), ...idsAdmins(db, formation)],
      titre: `🔒 Caisse non clôturée — ${b.nom}`, texte, ecran: "caisse", tag: `cloture:${b.nom}`, formation,
    }));
  });

  // 2. Les dettes qui passent en retard aujourd'hui (31e jour), par boutique.
  const parBoutique = new Map();
  (db.dettes || []).forEach((d) => {
    if (!dettePasseEnRetard(d, aujourdhui)) return;
    if (!parBoutique.has(d.boutique)) parBoutique.set(d.boutique, []);
    parBoutique.get(d.boutique).push(d);
  });
  parBoutique.forEach((liste, boutique) => {
    const formation = boutiqueEstFormation(db, boutique);
    const detail = liste.slice(0, 3).map((d) => `${d.client || "client"} (reste ${fmt(resteDette(d))})`).join(", ");
    envois.push(fabriquerEnvoi({
      destinataires: [...idsDeLaBoutique(db, boutique, ["vendeur", "gerant"]), ...idsAdmins(db, formation)],
      titre: `📋 Dette${liste.length > 1 ? "s" : ""} en retard — ${boutique}`,
      texte: `${liste.length} dette${liste.length > 1 ? "s passent" : " passe"} les ${RETARD_DETTE_JOURS} jours aujourd'hui : ${detail}${liste.length > 3 ? "…" : ""}. À relancer.`,
      ecran: "dettes", tag: `dettes:${boutique}:${aujourdhui}`, formation,
    }));
  });

  // 3. Les devis qui atteignent leurs 15 jours sans réponse : celui qui l'a
  //    établi, le responsable commercial et les administrateurs de l'espace
  //    du client.
  (db.users || []).forEach((u) => {
    if (u.role !== "client" || u.actif === false) return;
    (u.devis || []).forEach((d) => {
      if (!devisAtteintLeSeuil(d, aujourdhui)) return;
      const formation = estCompteFormation(db, u);
      envois.push(fabriquerEnvoi({
        destinataires: [d.par_id, ...idsParRole(db, formation, ["resp_commercial"]), ...idsAdmins(db, formation)],
        titre: `📲 Devis à relancer — ${u.nom_base || u.nom}`,
        texte: `Devis de ${fmt(d.total)} (${dFR(d.date)}) sans réponse depuis ${SEUIL_RELANCE_JOURS} jours${d.relance_le ? ", depuis la dernière relance" : ""}. À relancer depuis 📋 Tous les devis.`,
        ecran: "tous_devis", tag: `devis:${d.id}:${aujourdhui}`, formation,
      }));
    });
  });

  return envois.filter(Boolean);
}
