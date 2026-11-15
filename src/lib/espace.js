// ============================================================
// lib/espace.js — À QUEL ESPACE APPARTIENT UN COMPTE, ET QUI PRÉVENIR
//
// ⚠ Ce fichier n'importe RIEN : il est lu par l'application ET par le
// serveur (api/rappels-du-matin.js, la tournée du matin des notifications).
// La règle « formation ou réel ? » d'un compte vivait dans lib/calculs.js,
// qui importe l'interface (React) et ne peut donc pas tourner sur le
// serveur. Elle vit ici, et calculs.js la réexporte : UNE règle, deux
// lecteurs — jamais une copie.
// ============================================================

// Un compte est « de formation » si SA BOUTIQUE l'est (c'est l'endroit où il
// travaille réellement) — sinon, c'est son drapeau qui fait foi (admin,
// commercial, technicien, comptable, client : pas de boutique).
export const estCompteFormation = (db, profile) => {
  if (!profile) return false;
  const moi = (db.users || []).find((u) => u.id === profile.id) || profile;
  if (moi.boutique) {
    const b = (db.boutiques || []).find((x) => x.nom === moi.boutique);
    if (b) return !!b.formation;
  }
  return !!moi.formation;
};

export const boutiqueEstFormation = (db, nom) => !!((db.boutiques || []).find((b) => b.nom === nom) || {}).formation;

// Les EMPLOYÉS actifs d'un espace (jamais les clients).
export const personnesDeLEspace = (db, formation) =>
  (db.users || []).filter((u) => u.actif !== false && u.role !== "client" && estCompteFormation(db, u) === !!formation);

export const estAdminPrincipalActif = (u) => !!u && u.role === "admin" && u.admin_principal === true && u.actif !== false;

// ---- Qui prévenir (identifiants) — les briques des notifications ----
// Les rôles demandés dans une boutique donnée, dans l'espace de cette boutique.
export const idsDeLaBoutique = (db, boutique, roles) =>
  personnesDeLEspace(db, boutiqueEstFormation(db, boutique))
    .filter((u) => u.boutique === boutique && roles.includes(u.role))
    .map((u) => u.id);

// 🛒 À QUI un commercial peut destiner sa commande (Timo, 15/11/2026 : « afficher
// toute personne capable d'encaisser une vente au comptoir… vendeur, gérant,
// administrateur » — dans ses boutiques ce sont les gérants qui vendent, la
// liste « Vendeur destinataire » restait vide). Les vendeurs et gérants de
// CETTE boutique, puis les administrateurs de son espace ; jamais un compte
// désactivé ou bloqué. Lue par l'écran ET par la notification.
export const ROLES_ENCAISSENT_COMPTOIR = ["vendeur", "gerant", "admin"];
export const destinatairesCommande = (db, boutique) =>
  personnesDeLEspace(db, boutiqueEstFormation(db, boutique))
    .filter((u) => !u.bloque && (u.role === "admin" || ((u.role === "vendeur" || u.role === "gerant") && u.boutique === boutique)))
    .sort((a, b) => ROLES_ENCAISSENT_COMPTOIR.indexOf(a.role) - ROLES_ENCAISSENT_COMPTOIR.indexOf(b.role)
      || String(a.nom || "").localeCompare(String(b.nom || ""), "fr", { sensitivity: "base" }));

// Les rôles demandés dans tout un espace (magasiniers, comptables, resp. commercial…).
export const idsParRole = (db, formation, roles) =>
  personnesDeLEspace(db, formation).filter((u) => roles.includes(u.role)).map((u) => u.id);

// Les administrateurs de l'espace — et l'administrateur PRINCIPAL toujours
// (il est le seul à voir les deux espaces ; en formation, sa notification
// porte la marque 🎓, posée par fabriquerEnvoi dans lib/rappels.js).
// 🗂 L'assistant(e) de direction (01/11/2026) : les avis « pour information »
// des boutiques (transferts, ravitaillement, seuil, clôtures, tournée du
// matin) — jamais ce qui attend une décision de l'administrateur.
export const idsAssistants = (db, formation) => idsParRole(db, formation, ["assistant_direction"]);

// 🧲 Le chef d'équipe ⭐ d'une personne (15/11/2026, « I b ») : son parrain,
// s'il est chef — désigné, ou à partir de 5 recrues (la règle de calculs.js,
// `estChefEquipe`) — et du MÊME espace. Rend [] ou [son id].
const SEUIL_CHEF = 5;
export const idsChefDe = (db, u) => {
  const equipe = personnesDeLEspace(db, estCompteFormation(db, u));
  const parrain = equipe.find((x) => x.id === (u && u.parrain_id));
  if (!parrain) return [];
  const recrues = equipe.filter((x) => x.parrain_id === parrain.id && (x.role === "commercial" || x.role === "technicien")).length;
  return parrain.chef_equipe === true || recrues >= SEUIL_CHEF ? [parrain.id] : [];
};

export const idsAdmins = (db, formation) => [...new Set([
  ...idsParRole(db, formation, ["admin"]),
  ...(db.users || []).filter(estAdminPrincipalActif).map((u) => u.id),
])];
