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

// Les rôles demandés dans tout un espace (magasiniers, comptables, resp. commercial…).
export const idsParRole = (db, formation, roles) =>
  personnesDeLEspace(db, formation).filter((u) => roles.includes(u.role)).map((u) => u.id);

// Les administrateurs de l'espace — et l'administrateur PRINCIPAL toujours
// (il est le seul à voir les deux espaces ; en formation, sa notification
// porte la marque 🎓, posée par fabriquerEnvoi dans lib/rappels.js).
export const idsAdmins = (db, formation) => [...new Set([
  ...idsParRole(db, formation, ["admin"]),
  ...(db.users || []).filter(estAdminPrincipalActif).map((u) => u.id),
])];
