// ============================================================
// lib/rappelEntretien.js — LE RAPPEL D'ENTRETIEN AUTOMATIQUE (26/09/2026)
//
// Timo, après la comparaison avec les autres logiciels : « 5 » — puis
// « 10 jours », « texte ok », « 6 mois ». La case « Prochain entretien » d'un
// chantier ne prévenait personne : elle s'écrivait en orange quand quelqu'un
// ouvrait 🏠 Clients installés, et le client n'en savait rien.
//
// La tournée de 7 h (api/rappels-du-matin.js) regarde chaque chantier dont
// l'entretien tombe dans les JOURS_AVANT_ENTRETIEN jours (aujourd'hui
// compris : une tournée manquée rattrape le lendemain ; une date passée, on
// ne l'annonce plus). Pour chacun, DEUX gestes, indépendants :
//   • au client, le modèle `rappel_entretien` depuis le numéro BMI — UNE
//     fois par date ; refusé par WhatsApp (modèle pas encore approuvé…),
//     on retente le lendemain, jusqu'à la date ;
//   • une TÂCHE ✅ « Entretien de … » pour le chef de CE chantier (sinon le
//     chef prévu, sinon le premier de l'équipe, sinon l'administrateur
//     principal), avec une notification — UNE fois par date, même si le
//     client n'a pas de numéro : l'entretien se fait quand même.
// Ensuite, « ✅ Entretien fait » sur la fiche (🏠 Clients installés) note
// qui et quand, et propose la prochaine date à +6 mois.
//
// ⚠ UNE FOIS PAR DATE, JAMAIS DEUX. La marque `rappel_entretien` sur le
// chantier dit pour QUELLE date le rappel est parti ; une nouvelle date
// (entretien fait, ou reporté) rouvre le rappel. Deux filets de plus qui ne
// se réécrivent pas : la ligne du fil 📲 WhatsApp (modèle + chantier + date),
// et la tâche elle-même sur la fiche de la personne (chantier + échéance).
// ⚠ LE MUR : jamais un chantier de formation (sa marque, sa boutique, ou le
// compte du client). Un compte client bloqué ne reçoit rien (la tâche,
// elle, se crée).
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { joursEntre } from "./rappels.js";
import { estSupprime } from "./corbeille.js";
import { envoiRappelEntretien, ligneEnvoiModele, numeroWhatsApp } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";
import { estCompteFormation, boutiqueEstFormation, estAdminPrincipalActif } from "./espace.js";
import { dFR } from "./core.js";

export const JOURS_AVANT_ENTRETIEN = 10;
export const MOIS_ENTRE_ENTRETIENS = 6;
export const MODELE_RAPPEL_ENTRETIEN = "rappel_entretien";
export const AUTEUR_RAPPEL_ENTRETIEN = { id: "rappel-entretien-bmi", nom: "Rappel automatique BMI" };
export const MARQUE_TACHE_ENTRETIEN = "entretien";
// Une date AAAA-MM-JJ lisible (les écrans passent par demanderDate, qui la
// contrôle déjà ; ici on vérifie seulement qu'elle se lit).
const dateLisible = (d) => String(d || "").length === 10 && !Number.isNaN(Date.parse(String(d)));

// La prochaine date proposée après un entretien fait : +6 mois, au dernier
// jour du mois si le jour n'existe pas (31 août → 28/29 février).
export const dateApresMois = (jour, mois = MOIS_ENTRE_ENTRETIENS) => {
  const d = new Date(`${String(jour).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const j = d.getUTCDate();
  const cible = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1));
  const dernier = new Date(Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0)).getUTCDate();
  cible.setUTCDate(Math.min(j, dernier));
  return cible.toISOString().slice(0, 10);
};

// Le chantier est-il de formation ? Sa marque d'abord, puis sa boutique
// (celle de sa vente ou de sa dette, sinon la sienne), puis le compte du client.
const boutiqueDuChantier = (db, c) => {
  const vente = (db.ventes || []).find((v) => v.id === c.vente_id);
  if (vente) return vente.boutique;
  const dette = c.dette_id ? (db.dettes || []).find((d) => d.id === c.dette_id) : null;
  return dette?.boutique || c.boutique || "";
};
export function chantierDeFormation(db, c, compte) {
  if (c && Object.prototype.hasOwnProperty.call(c, "formation")) return !!c.formation;
  const b = boutiqueDuChantier(db, c);
  if (b && boutiqueEstFormation(db, b)) return true;
  return !!(compte && estCompteFormation(db, compte));
}

// Le chantier, seul : son entretien est-il à rappeler aujourd'hui ?
export function entretienDansLaFenetre(c, aujourdhui) {
  if (!c || estSupprime(c) || c.travaux) return false;
  const date = String(c.date_entretien || "").slice(0, 10);
  if (!dateLisible(date)) return false;
  const j = joursEntre(aujourdhui, date);
  return j >= 0 && j <= JOURS_AVANT_ENTRETIEN;
}

// Qui fera l'entretien : le chef de CE chantier, sinon le chef prévu, sinon
// le premier de l'équipe, sinon l'administrateur principal. Toujours un
// compte actif.
export function responsableEntretien(db, c) {
  const actif = (id) => (db.users || []).find((u) => u && u.id === id && u.actif !== false && u.role !== "client");
  const equipe = c.equipe || [];
  const candidats = [equipe.find((e) => e && e.chef)?.user_id, c.chef_prevu, equipe[0]?.user_id, ...(c.equipe_prevue || [])];
  for (const id of candidats) { const u = id && actif(id); if (u) return u; }
  return (db.users || []).find(estAdminPrincipalActif) || null;
}

const nomDuChantier = (c) => `${c?.prenom || ""} ${c?.nom || ""}`.trim() || "client";

// Les rappels déjà partis, lus dans le fil (preuve qui ne se réécrit pas).
const clesEnvoyees = (messages) => new Set((messages || [])
  .filter((m) => m && m.canal === CANAL_WA && m.wa_modele === MODELE_RAPPEL_ENTRETIEN && m.chantier_id)
  .map((m) => `${m.chantier_id}|${m.entretien_date || ""}`));
export const tacheEntretienExiste = (u, c) =>
  (u?.taches || []).some((t) => t && t.auto === MARQUE_TACHE_ENTRETIEN && t.chantier_id === c.id && t.echeance === String(c.date_entretien).slice(0, 10));

// La liste du jour : { chantier, compte, tel, envoi, whatsapp, tache, pour }.
// `whatsapp` = le message au client est encore à envoyer ; `tache` = la
// tâche est encore à créer (pour `pour`).
export function rappelsEntretienDuJour(db, aujourdhui) {
  const deja = clesEnvoyees(db?.messages);
  const sortie = [];
  (db?.clients_installes || []).forEach((c) => {
    if (!entretienDansLaFenetre(c, aujourdhui)) return;
    const date = String(c.date_entretien).slice(0, 10);
    const compte = c.user_id ? (db.users || []).find((u) => u && u.id === c.user_id) : null;
    if (chantierDeFormation(db, c, compte)) return;
    const marque = c.rappel_entretien && c.rappel_entretien.date === date ? c.rappel_entretien : null;
    const tel = numeroWhatsApp((compte && compte.tel) || c.tel);
    const clientJoignable = !!tel && !(compte && compte.actif === false);
    const whatsapp = clientJoignable && !(marque && marque.whatsapp_le) && !deja.has(`${c.id}|${date}`);
    const pour = responsableEntretien(db, c);
    const tache = !!pour && !(marque && marque.tache_le) && !tacheEntretienExiste(pour, c);
    if (!whatsapp && !tache) return;
    sortie.push({
      chantier: c, compte, tel, pour, whatsapp, tache,
      envoi: whatsapp ? envoiRappelEntretien({ chantier: c, compte, dFR }) : null,
    });
  });
  return sortie;
}

// La tâche posée sur la fiche du responsable.
export const tacheEntretien = ({ id, chantier, aujourdhui }) => ({
  id, auto: MARQUE_TACHE_ENTRETIEN, chantier_id: chantier.id,
  titre: `🔧 Entretien de ${nomDuChantier(chantier)} le ${dFR(chantier.date_entretien)}`,
  detail: [chantier.type_installation, chantier.localisation || chantier.adresse_contrat, chantier.tel ? `Tél : ${chantier.tel}` : ""].filter(Boolean).join(" · "),
  echeance: String(chantier.date_entretien).slice(0, 10), statut: "a_faire",
  par: AUTEUR_RAPPEL_ENTRETIEN.nom, date: String(aujourdhui).slice(0, 10),
});

// La notification qui accompagne la tâche (lib/rappels.js : même forme).
export const notificationTache = ({ pour, chantier }) => ({
  destinataires: [pour.id], titre: "🔧 Entretien à prévoir",
  texte: `${nomDuChantier(chantier)} — le ${dFR(chantier.date_entretien)}. Appelez le client pour fixer l'heure.`,
  ecran: "taches", tag: `entretien-${chantier.id}`,
});

// Ce qui s'écrit APRÈS l'envoi réussi (jamais avant) : la ligne du fil, sa
// fiche légère (sans toucher au propriétaire), puis la marque du chantier.
export function ligneRappelEntretien({ id, tel, compte, chantier, variables, ts }) {
  const cle = cleConversation(tel);
  const texte = ligneEnvoiModele(MODELE_RAPPEL_ENTRETIEN, variables);
  if (!cle || !texte) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: AUTEUR_RAPPEL_ENTRETIEN.id, de_nom: AUTEUR_RAPPEL_ENTRETIEN.nom, lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: compte?.nom_base || compte?.nom || nomDuChantier(chantier),
    texte, wa_modele: MODELE_RAPPEL_ENTRETIEN, chantier_id: chantier.id, entretien_date: String(chantier.date_entretien).slice(0, 10),
  };
}
export const enteteApresRappel = ({ tel, compte, chantier, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: compte?.nom_base || compte?.nom || nomDuChantier(chantier),
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts, entete,
  });
// La marque sur le chantier : pour QUELLE date, ce qui est fait.
export const chantierApresRappel = (c, { whatsapp_le, tache_le, tache_pour } = {}) => {
  const date = String(c.date_entretien).slice(0, 10);
  const avant = c.rappel_entretien && c.rappel_entretien.date === date ? c.rappel_entretien : { date };
  return {
    ...c,
    rappel_entretien: {
      ...avant,
      ...(whatsapp_le ? { whatsapp_le } : {}),
      ...(tache_le ? { tache_le, tache_pour: tache_pour || "" } : {}),
    },
  };
};

// ---- ✅ ENTRETIEN FAIT (🏠 Clients installés) ----
// Il se garde dans une liste qui ne rétrécit jamais (`entretiens`), et la
// prochaine date prend la place de l'ancienne.
export function critiqueEntretienFait(c, { le, prochaine }) {
  if (!c) return "Chantier introuvable.";
  if (c.travaux) return "Des travaux à crédit n'ont pas d'entretien.";
  if (!dateLisible(le)) return "Indiquez la date de l'entretien.";
  if (prochaine && !dateLisible(prochaine)) return "La prochaine date n'est pas lisible.";
  if (prochaine && prochaine <= le) return "La prochaine date doit venir APRÈS l'entretien fait.";
  return "";
}
export const marquerEntretienFait = (c, { le, prochaine, par, note }) => ({
  ...c,
  entretiens: [...(c.entretiens || []), { le, par: par || "", prevu: String(c.date_entretien || "").slice(0, 10), ...(note ? { note } : {}) }],
  date_entretien: prochaine || "",
});
export const dernierEntretien = (c) => {
  const l = c?.entretiens || [];
  return l.length ? l[l.length - 1] : null;
};
