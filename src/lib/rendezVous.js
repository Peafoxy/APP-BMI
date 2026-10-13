// ============================================================
// lib/rendezVous.js — L'ONGLET 📅 RENDEZ-VOUS : LA RÈGLE (12/10/2026)
//
// Timo : « un onglet RENDEZ-VOUS… une ligne à choisir, rendez-vous pro et
// rendez-vous privé, accessible à tous les employés… pour visite, la liste
// des techniciens apparaît pour choisir qui fera partie de la visite… un
// message WhatsApp pour rappeler à l'utilisateur ses propres rendez-vous et
// un message pour informer toute l'équipe si c'est un rendez-vous pro »,
// puis « Aa, A2a, Ba, C 14h la veille et le jour même à 7h, Da, Ea, Fb,
// G toutes, H a ».
//   • A a  — un PRIVÉ vit dans une table que le serveur garde
//     (supabase/rendez-vous-1-table.sql) : il ne descend que chez lui.
//   • A2 a — personne d'autre ne voit un privé, administrateur compris.
//   • B a  — le rappel d'un privé est neutre, sans l'objet.
//   • C    — rappel la VEILLE à 14 h et le JOUR MÊME à 7 h (serveur).
//   • D a  — participants par WhatsApp, le reste du personnel par une
//     notification (lib/notifications.js).
//   • E a  — tout employé crée ; seuls l'auteur et l'administrateur
//     modifient ou annulent un pro ; un participant le marque fait.
//   • F b  — les techniciens d'abord, puis le reste du personnel.
//   • G    — visite rattachée à un prospect ou un client, le client prévenu
//     (après une question), le conflit dit, fait / annulé avec compte rendu,
//     les participants prévenus d'un changement, la liste par jour, rien en
//     formation.
//   • H a  — le comptable lit les pro, ne crée rien (lecture seule).
// Puis le 13/10/2026 (« A a, B b, C ok ») : l'ORGANISATEUR n'est plus compté
// d'office dans l'équipe — il se coche s'il y va (et peut alors être le chef
// de la visite) ; il reçoit quand même les avis et les rappels. Les messages
// énumèrent l'ÉQUIPE, le chef d'abord ; le CHEF d'une visite reçoit le
// numéro du client (à la création et dans les rappels), pas l'organisateur.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`. Rien n'est
// écrit ici.
// ============================================================
import { estCompteFormation } from "./espace.js";
import { jourEnClair, heureEnClair, numeroWhatsApp, envoiRappelRendezVous, envoiRappelVisiteChef } from "./whatsappModeles.js";
import { lendemain } from "./anniversaires.js";

export const TYPE_PRO = "pro";
export const TYPE_PRIVE = "prive";
export const STATUT_A_VENIR = "a_venir";
export const STATUT_FAIT = "fait";
export const STATUT_ANNULE = "annule";
export const OBJET_MAX = 120;
export const COMPTE_RENDU_MAX = 1000;
export const ROLES_TECHNICIENS = ["technicien", "technicien_bmi"];
// Ce qu'un PARTICIPANT a le droit d'écrire (le même mot que le déclencheur
// du serveur, rendez_vous_regles) : rien d'autre ne doit bouger.
export const CHAMPS_DU_PARTICIPANT = ["statut", "compte_rendu", "fait_le", "fait_par"];

export const libelleType = (t) => (t === TYPE_PRIVE ? "🔒 Privé" : "💼 Pro");
export const libelleStatut = (s) => (s === STATUT_FAIT ? "✅ Fait" : s === STATUT_ANNULE ? "✖ Annulé" : "⏳ À venir");

// Tout le personnel, jamais un client (le serveur le refuse aussi).
export const peutAvoirRendezVous = (profile) => !!profile && profile.role !== "client";
const estAdmin = (p) => !!p && p.role === "admin";
export const estParticipant = (r, id) => !!r && !!id && (r.participants || []).includes(id);
export const estAuteur = (r, id) => !!r && !!id && r.par_id === id;
// Un privé : lui seul. Un pro : son auteur ou l'administrateur.
export const peutModifierRdv = (r, profile) => !!r && !!profile && (r.type === TYPE_PRIVE
  ? estAuteur(r, profile.id)
  : estAuteur(r, profile.id) || estAdmin(profile));
// Le marquer fait : ceux qui le modifient, et les participants d'un pro.
export const peutMarquerFait = (r, profile) => peutModifierRdv(r, profile)
  || (!!r && r.type === TYPE_PRO && estParticipant(r, profile?.id));

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
// La date : la règle qui l'écrit en clair la reconnaît (jamais un second
// contrôle de format recopié).
const dateValide = (d) => String(d || "").length === 10 && !!jourEnClair(d);

// Ce qu'on refuse à l'enregistrement (création ou modification). `aujourdhui`
// sert à refuser une date passée à la création.
export function critiqueRendezVous(r, { aujourdhui, creation = false } = {}) {
  if (!r) return "Rendez-vous introuvable.";
  if (r.type !== TYPE_PRO && r.type !== TYPE_PRIVE) return "Choisissez « Pro » ou « Privé ».";
  if (!dateValide(r.date)) return "La date est obligatoire (AAAA-MM-JJ).";
  if (!HEURE.test(String(r.heure || ""))) return "L'heure est obligatoire (ex : 09:30).";
  if (creation && aujourdhui && r.date < aujourdhui) return "La date est passée : un rendez-vous se fixe pour aujourd'hui ou plus tard.";
  const objet = String(r.objet || "").trim();
  if (!objet) return "L'objet du rendez-vous est obligatoire (ex : « Visite chez MR ERIC »).";
  if (objet.length > OBJET_MAX) return `L'objet tient en ${OBJET_MAX} caractères au plus.`;
  if (r.type === TYPE_PRIVE && ((r.participants || []).length || r.visite)) return "Un rendez-vous privé n'a ni participants ni visite.";
  if (r.visite && !(r.participants || []).length) return "Une visite demande au moins un participant : cochez qui y va.";
  if (r.chef_id && !(r.participants || []).includes(r.chef_id)) return "Le chef de la visite doit être parmi les participants.";
  return "";
}

export function nouveauRendezVous({ profile, formation, champs, id, maintenant }) {
  const pro = champs.type === TYPE_PRO;
  // L'organisateur peut se cocher lui-même (13/10/2026) : il fait alors
  // partie de l'équipe, et peut en être le chef.
  const participants = pro ? [...new Set((champs.participants || []).filter(Boolean))] : [];
  const visite = pro && !!champs.visite;
  return {
    id,
    type: pro ? TYPE_PRO : TYPE_PRIVE,
    par_id: profile.id, par: profile.nom || "",
    cree_le: maintenant,
    date: String(champs.date || ""), heure: String(champs.heure || ""),
    objet: String(champs.objet || "").trim(), lieu: String(champs.lieu || "").trim(),
    visite, participants,
    chef_id: visite ? (participants.includes(champs.chef_id) ? champs.chef_id : participants[0] || "") : "",
    prospect_id: visite ? champs.prospect_id || "" : "",
    client_user_id: visite ? champs.client_user_id || "" : "",
    client_nom: visite ? String(champs.client_nom || "").trim() : "",
    client_tel: visite ? String(champs.client_tel || "").trim() : "",
    statut: STATUT_A_VENIR,
    // ⚠ « Ce qu'on crée naît dans l'espace qu'on regarde. »
    ...(formation ? { formation: true } : {}),
  };
}

// Les rendez-vous qu'un écran montre : l'espace REGARDÉ (jamais ce qu'EST le
// compte), et un privé seulement chez son auteur. Le serveur ne fait descendre
// que ça — ce filtre le redit pour l'administrateur principal, qui reçoit les
// deux espaces.
export function rendezVousVisibles(liste, profile, formationRegardee) {
  if (!peutAvoirRendezVous(profile)) return [];
  return (liste || []).filter((r) => r
    && !!r.formation === !!formationRegardee
    && (r.type === TYPE_PRO || r.par_id === profile.id));
}

// Le tri : la date, puis l'heure.
export const cleRdv = (r) => `${r.date || ""} ${r.heure || ""}`;
export const trierRdv = (liste) => [...(liste || [])].sort((a, b) => cleRdv(a).localeCompare(cleRdv(b)));

const ajouterJours = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// La liste par jour : Aujourd'hui, Demain, Cette semaine (7 jours), Plus
// tard ; puis le passé (et tout ce qui est fait ou annulé) à part, du plus
// récent au plus ancien.
export function rangerParJour(liste, aujourdhui) {
  const demain = lendemain(aujourdhui), semaine = ajouterJours(aujourdhui, 7);
  const groupes = { aujourdhui: [], demain: [], semaine: [], plus_tard: [], passes: [] };
  for (const r of trierRdv(liste)) {
    if (r.statut !== STATUT_A_VENIR || r.date < aujourdhui) { groupes.passes.push(r); continue; }
    if (r.date === aujourdhui) groupes.aujourdhui.push(r);
    else if (r.date === demain) groupes.demain.push(r);
    else if (r.date <= semaine) groupes.semaine.push(r);
    else groupes.plus_tard.push(r);
  }
  groupes.passes.reverse();
  return groupes;
}
export const TITRES_GROUPES = [
  ["aujourdhui", "Aujourd'hui"], ["demain", "Demain"], ["semaine", "Cette semaine"], ["plus_tard", "Plus tard"],
];

// Les personnes proposées comme participants (« F b ») : les techniciens
// d'abord, puis le reste du personnel — la liste déjà filtrée par l'espace
// regardé (utilisateursDeLEspace), jamais un client. L'ORGANISATEUR y est
// aussi (13/10/2026) : il se coche s'il fait partie de l'équipe.
export function participantsProposes(personnes) {
  const l = (personnes || []).filter((u) => u && u.role !== "client" && u.actif !== false);
  const tri = (a, b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" });
  return {
    techniciens: l.filter((u) => ROLES_TECHNICIENS.includes(u.role)).sort(tri),
    autres: l.filter((u) => !ROLES_TECHNICIENS.includes(u.role)).sort(tri),
  };
}

// Tous ceux qu'un rendez-vous concerne : l'auteur et les participants.
// ⚠ L'organisateur reste concerné même s'il ne participe pas (« A a ») :
// il reçoit les avis et les rappels, et le rendez-vous compte chez lui.
export const personnesDuRdv = (r) => [...new Set([r?.par_id, ...(r?.participants || [])].filter(Boolean))];

// L'ÉQUIPE telle que les messages l'énumèrent (13/10/2026) : les
// participants seulement — l'organisateur n'y est que s'il s'est coché —, le
// chef d'une visite EN PREMIER, marqué « (chef d'équipe) ». `nomDe(id)` rend
// le nom ; une personne introuvable n'est pas écrite.
export function equipeDuRdv(r, nomDe) {
  if (!r || r.type !== TYPE_PRO) return [];
  const ids = r.participants || [];
  const chef = r.visite && r.chef_id && ids.includes(r.chef_id) ? r.chef_id : "";
  const ordre = chef ? [chef, ...ids.filter((id) => id !== chef)] : ids;
  return ordre.map((id) => {
    const nom = nomDe ? nomDe(id) : "";
    return nom ? (id === chef ? `${nom} (chef d'équipe)` : nom) : "";
  }).filter(Boolean);
}
// Le chef d'une visite : lui seul reçoit le numéro du client (« B b »).
export const estChefDeLaVisite = (r, id) => !!r && !!id && !!r.visite && r.type === TYPE_PRO && r.chef_id === id && (r.participants || []).includes(id);

// « G » : le CONFLIT, dit avant d'enregistrer, jamais un blocage. Pour chaque
// personne du rendez-vous : un autre rendez-vous à venir le même jour qui la
// concerne, ou une installation programmée ce jour-là où elle est dans
// l'équipe. Les listes sont celles que l'écran voit déjà (l'espace regardé ;
// un privé d'un autre n'y est jamais).
export function conflitsRendezVous({ rdv, rendezVous, chantiers, nomDe }) {
  if (!rdv?.date) return [];
  const qui = personnesDuRdv(rdv);
  const nom = (id) => (nomDe ? nomDe(id) : id) || id;
  const phrases = [];
  for (const id of qui) {
    for (const r of rendezVous || []) {
      if (!r || r.id === rdv.id || r.statut !== STATUT_A_VENIR || r.date !== rdv.date) continue;
      if (!personnesDuRdv(r).includes(id)) continue;
      phrases.push(`${nom(id)} a déjà un rendez-vous ce jour-là à ${heureEnClair(r.heure)}${r.type === TYPE_PRIVE ? " (privé)" : ` : ${r.objet}`}.`);
    }
    for (const c of chantiers || []) {
      if (!c || c.travaux || (c.statut || "en_cours") !== "en_cours") continue;
      if (String(c.date_installation || "").slice(0, 10) !== rdv.date) continue;
      if (!(c.equipe || []).some((e) => e && e.user_id === id)) continue;
      phrases.push(`${nom(id)} est programmé ce jour-là sur l'installation de ${[c.prenom, c.nom].filter(Boolean).join(" ") || "un client"}.`);
    }
  }
  return [...new Set(phrases)];
}

// « G » : ce qu'une modification change pour chacun (WhatsApp
// `rendez_vous_modifie`, et `rendez_vous_equipe` pour un nouveau
// participant). L'auteur du GESTE n'est jamais prévenu de son propre geste.
// `chef` : un participant DÉJÀ prévenu qui devient le chef de la visite
// (13/10/2026) — il reçoit l'avis du chef, avec le numéro du client.
// Rend { nouveaux: [id], changements: [{ id, phrase }], chef }.
export function changementsRendezVous(avant, apres, auteurDuGeste) {
  if (!apres || apres.type !== TYPE_PRO) return { nouveaux: [], changements: [], chef: "" };
  const avantP = avant ? personnesDuRdv(avant) : [];
  const apresP = personnesDuRdv(apres);
  const nouveaux = [], changements = [];
  const annule = !!avant && avant.statut !== STATUT_ANNULE && apres.statut === STATUT_ANNULE;
  const deplace = !!avant && (avant.date !== apres.date || avant.heure !== apres.heure);
  const lieuChange = !!avant && String(avant.lieu || "") !== String(apres.lieu || "");
  for (const id of apresP) {
    if (id === auteurDuGeste) continue;
    if (!avantP.includes(id)) { if (!annule) nouveaux.push(id); continue; }
    const parts = [];
    if (annule) parts.push(`il est annulé${apres.annule_motif ? ` (motif : ${apres.annule_motif})` : ""}`);
    else {
      if (deplace) parts.push(`il est déplacé au ${jourEnClair(apres.date)} à ${heureEnClair(apres.heure)}`);
      if (lieuChange) parts.push(`nouveau lieu : ${apres.lieu || "à préciser"}`);
    }
    if (parts.length) changements.push({ id, phrase: parts.join(" ; ") });
  }
  for (const id of avantP) {
    if (id === auteurDuGeste || apresP.includes(id)) continue;
    changements.push({ id, phrase: "vous n'en faites plus partie" });
  }
  const nouveauChef = !!avant && !annule && apres.statut === STATUT_A_VENIR && estChefDeLaVisite(apres, apres.chef_id)
    && !estChefDeLaVisite(avant, apres.chef_id) && (avant.participants || []).includes(apres.chef_id)
    && apres.chef_id !== auteurDuGeste ? apres.chef_id : "";
  return { nouveaux, changements, chef: nouveauChef };
}

// « C » : les rappels du serveur pour un jour donné. `quand` = "veille"
// (tournée de 14 h, les rendez-vous de DEMAIN) ou "jour" (tournée de 7 h,
// ceux d'AUJOURD'HUI). Un pro : son auteur et ses participants ; un privé :
// son auteur seul, et un texte NEUTRE (« B a »). Le CHEF d'une visite reçoit
// `rappel_visite_chef` (le numéro du client), avec `repli` = le rappel
// ordinaire si WhatsApp le refuse (pas encore approuvé). ⚠ LE MUR : jamais un
// rendez-vous de formation, jamais un compte de formation, client, inactif,
// bloqué ou sans numéro. Rien n'est écrit.
export function rappelsRendezVous(db, aujourdhui, quand) {
  const cible = quand === "veille" ? lendemain(aujourdhui) : aujourdhui;
  const users = db?.users || [];
  const out = [];
  for (const r of db?.rendez_vous || []) {
    if (!r || r.formation || r.statut !== STATUT_A_VENIR || r.date !== cible) continue;
    const ids = r.type === TYPE_PRIVE ? [r.par_id] : personnesDuRdv(r);
    const equipe = equipeDuRdv(r, (pid) => (users.find((u) => u && u.id === pid) || {}).nom || "");
    for (const id of ids) {
      const u = users.find((x) => x && x.id === id);
      if (!u || u.role === "client" || u.actif === false || u.bloque || estCompteFormation(db, u)) continue;
      if (String(u.tel || "").replace(/\D/g, "").length < 8) continue;
      const employe = u.nom_complet || u.nom;
      const ordinaire = envoiRappelRendezVous({ employe, rdv: r, participants: r.type === TYPE_PRIVE ? [] : equipe });
      const chef = estChefDeLaVisite(r, id) ? envoiRappelVisiteChef({ employe, rdv: r, equipe }) : null;
      if (chef) out.push({ rdv: r, personne: u, tel: numeroWhatsApp(u.tel), envoi: chef, repli: ordinaire });
      else if (ordinaire) out.push({ rdv: r, personne: u, tel: numeroWhatsApp(u.tel), envoi: ordinaire });
    }
  }
  return out;
}

// « G » : rattacher une visite à un CLIENT (un compte de l'espace regardé)
// ou à un PROSPECT. Les prospects proposés suivent la règle de 🧲 Prospects :
// tous pour qui voit tout (administrateur, chef d'équipe, resp. commercial),
// sinon les siens. Les listes arrivent déjà filtrées par l'espace regardé.
export function prospectsPourVisite(prospects, profile, voitTout) {
  return (prospects || []).filter((p) => p && !p.archive && !p.converti && (voitTout || p.commercial === profile?.nom));
}
const chiffres = (t) => String(t || "").replace(/\D/g, "");
export function propositionsVisite({ comptes, prospects }) {
  const c = (comptes || []).filter((u) => u && u.id && u.role === "client").map((u) => ({
    cle: `c:${u.id}`, valeur: `${u.nom_base || u.nom || ""}${u.tel ? ` — ${u.tel}` : ""}`,
    mots: [u.prenom, u.nom_complet, chiffres(u.tel)].filter(Boolean).join(" "),
    detail: "👤 compte client",
    lien: { client_user_id: u.id, prospect_id: "", client_nom: [u.nom_base || u.nom, u.prenom].filter(Boolean).join(" "), client_tel: u.tel || "", lieu: u.adresse || "" },
  }));
  const p = (prospects || []).filter((x) => x && x.id).map((x) => ({
    cle: `p:${x.id}`, valeur: `${x.nom || ""}${x.tel ? ` — ${x.tel}` : ""}`,
    mots: [chiffres(x.tel), x.localisation].filter(Boolean).join(" "),
    detail: `🧲 prospect${x.localisation ? ` · ${x.localisation}` : ""}`,
    lien: { prospect_id: x.id, client_user_id: x.client_user_id || "", client_nom: x.nom || "", client_tel: x.tel || "", lieu: x.localisation || "" },
  }));
  return [...c, ...p];
}

// « G » : les visites d'un prospect, pour sa fiche dans 🧲 Prospects (le
// compte rendu s'y lit). La liste arrive déjà passée par rendezVousVisibles.
export const visitesDuProspect = (rendezVous, prospectId) => trierRdv((rendezVous || []).filter((r) => r && r.visite && prospectId && r.prospect_id === prospectId)).reverse();

// Ce qu'un participant écrit en marquant le rendez-vous fait : ces champs
// seulement (le déclencheur du serveur refuse tout autre changement).
export function marquerFait(r, { compteRendu, profile, aujourdhui }) {
  return { ...r, statut: STATUT_FAIT, compte_rendu: String(compteRendu || "").trim().slice(0, COMPTE_RENDU_MAX), fait_le: aujourdhui, fait_par: profile?.nom || "" };
}
export function annulerRdv(r, { motif, profile, aujourdhui }) {
  return { ...r, statut: STATUT_ANNULE, annule_motif: String(motif || "").trim(), annule_le: aujourdhui, annule_par: profile?.nom || "" };
}
