// ============================================================
// lib/calculs.js — Fonctions de calcul métier pures (aucun JSX) :
// stocks, paie, crédit BMI, virements, notifications de sortie de
// caisse, prospects, parrainage, commissions, dettes/réservations,
// ravitaillement, apporteurs d'affaires, dépôts, droits/pouvoirs,
// tâches, config des onglets par rôle.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { uid, normPaiement, lignesVente, caVente, fmt, today } from "./core";
import { SALARIES } from "./constants";
import { TAUX_CNSS_SALARIE } from "./cnss";
import { uAlert, uConfirm, uPrompt, uChoix } from "../components/ui";

// ============ CALCULS ============
// ═══════════ LOT D (2.99.45) : INDEX PRÉCALCULÉS ═══════════
// Construit UNE FOIS par mise à jour des données (voir setDb dans App.jsx),
// au lieu de reparcourir TOUTES les ventes pour CHAQUE produit à CHAQUE
// rendu (Stocks passait de O(produits × ventes) à O(1) par produit, Équipe
// de plusieurs balayages complets par commercial à une simple lecture).
// `__index` n'est PAS une table : jamais sauvegardé (sauvegarderDiff ne
// parcourt que TABLES), jamais dans le fichier de secours (voir sauvegarde.js).
export function construireIndexDb(db) {
  const venduParProduit = new Map();
  const ventesParCommercial = new Map();
  // ⚠ Boutiques de formation (2.100.16) : leurs ventes ne doivent JAMAIS
  // compter dans la commission RÉELLE d'un commercial qui s'entraîne —
  // Supabase ne les isole pas physiquement, c'est à l'app de les exclure
  // ici, comme déjà fait pour le Tableau de bord (demande Timo, suite
  // audit après ajout de la boutique de formation).
  const boutiquesFormationSet = boutiquesFormation(db);
  for (const v of db.ventes || []) {
    for (const l of lignesVente(v)) {
      if (l.produit_id) venduParProduit.set(l.produit_id, (venduParProduit.get(l.produit_id) || 0) + Number(l.qte || 0));
    }
    if (v.commercial && !boutiquesFormationSet.has(v.boutique)) {
      const liste = ventesParCommercial.get(v.commercial) || [];
      liste.push(v);
      ventesParCommercial.set(v.commercial, liste);
    }
  }
  const ajusteParProduit = new Map();
  for (const a of db.ajustements || []) {
    ajusteParProduit.set(a.produit_id, (ajusteParProduit.get(a.produit_id) || 0) + Number(a.qte || 0));
  }
  return { venduParProduit, ventesParCommercial, ajusteParProduit };
}

// Les ventes d'un commercial — via l'index quand il est là, sinon balayage
// (les tests unitaires et tout code recevant un db « nu » restent corrects).
// ⚠ Boutiques de formation (2.100.16-17) : source UNIQUE de vérité pour
// "quelles ventes comptent vraiment" — à utiliser PARTOUT où on calcule un
// total sur db.ventes (CA, commissions, dépenses liées...), plutôt que de
// reconstruire ce filtre à chaque écran (c'est justement l'absence de ce
// réflexe qui a laissé passer plusieurs trous : Dashboard "CA total" en
// tête, Rentabilité, Commission personnelle, Mon Équipe).
export const boutiquesFormation = (db) => new Set((db.boutiques || []).filter((b) => b.formation).map((b) => b.nom));
// L'espace (réel / formation) d'une boutique, à partir de son NOM — une
// boutique inconnue de la base (« Chez le comptable », un nom effacé) est
// traitée comme RÉELLE : le doute profite toujours aux vraies données.
export const estBoutiqueFormation = (db, nom) => !!(db.boutiques || []).find((b) => b.nom === nom)?.formation;

// ⚠ L'espace d'un COMPTE se lit EN DIRECT dans la base, jamais dans
// `profile` : le profil est figé à la connexion (voir App.jsx), si bien
// qu'une bascule formation ↔ réel décidée par l'admin ne prenait effet
// qu'à la reconnexion suivante — l'admin croyait la personne isolée alors
// qu'elle ne l'était pas encore. Même principe que droitsOffDe() plus bas.
// ⚠ LA BOUTIQUE RATTACHÉE FAIT FOI, quand il y en a une.
// Raison : la version 2.100.24 posait le drapeau `formation` sans déplacer
// le rattachement (c'est le défaut corrigé depuis — voir basculerFormation
// dans Utilisateurs.jsx). Un vendeur passé « en formation » à cette
// époque porte donc encore `formation: true` ET sa VRAIE boutique. Se
// fier au seul drapeau reviendrait, dès la mise à jour, à lui refuser
// toutes ses saisies alors qu'il travaille dans la vraie boutique : une
// panne, pas une protection.
//
// La boutique est de toute façon déjà la source de vérité de toute
// l'application (`boutique = profile.boutique || bq` dans chaque écran) :
// on ne fait ici que l'assumer. Un compte incohérent est donc traité selon
// l'endroit où il travaille RÉELLEMENT, et l'administrateur en est
// averti dans 👥 Utilisateurs (voir comptesEspaceIncoherent).
//
// Les comptes sans boutique (admin, commercial, technicien, responsable
// commercial, comptable, client) n'ont que le drapeau : il fait foi.
export const estCompteFormation = (db, profile) => {
  if (!profile) return false;
  const moi = (db.users || []).find((u) => u.id === profile.id) || profile;
  if (moi.boutique) {
    const b = (db.boutiques || []).find((x) => x.nom === moi.boutique);
    if (b) return !!b.formation;
  }
  return !!moi.formation;
};

// Les comptes dont le drapeau et la boutique se contredisent — héritage de
// la 2.100.24. Ils ne sont pas en panne (voir ci-dessus), mais leur
// bascule n'a jamais rien produit : l'administrateur doit la refaire pour
// qu'elle prenne effet.
// Les administrateurs — autres que le principal — qui traversent encore les
// deux espaces. ⚠ Le pouvoir « act_voir_tout » est ACCORDÉ par défaut :
// aDroit() le rend vrai tant qu'il n'est pas explicitement retiré. Il n'est
// posé dans droits_off qu'à la CRÉATION d'un nouvel admin — tous ceux
// créés avant ce réglage l'ont donc encore, et le cloisonnement ne
// s'applique pas à eux. Sur une installation avec plusieurs admins, c'est
// la porte la plus large qui reste ouverte.
export const adminsVoyantLesDeuxEspaces = (db) =>
  (db.users || []).filter((u) =>
    u.role === "admin" && u.actif !== false
    && adminPrincipal(db)?.id !== u.id
    && aDroit(db, u, "act_voir_tout"));

export const comptesEspaceIncoherent = (db) =>
  (db.users || []).filter((u) => {
    if (!u.boutique || u.role === "client" || u.actif === false) return false;
    const b = (db.boutiques || []).find((x) => x.nom === u.boutique);
    return !!b && !!b.formation !== !!u.formation;
  });

// Qui a le droit de voir (et de toucher) les DEUX espaces à la fois :
// l'admin PRINCIPAL toujours, un autre admin seulement si on lui a
// explicitement laissé le pouvoir "act_voir_tout" (ACTIONS_POUVOIR).
export const voitLesDeuxEspaces = (db, profile) =>
  estAdminPrincipal(db, profile) || (profile?.role === "admin" && aDroit(db, profile, "act_voir_tout"));

// ⚠ Séparation formation/réel PAR COMPTE (demande Timo, suite au drapeau
// formation déjà posé sur les boutiques) : un compte marqué formation ne
// voit QUE les boutiques de formation, un compte réel ne voit QUE les
// vraies. Utilisée par BoutiqueTabs, remplace l'accès direct à db.boutiques
// dans TOUT sélecteur de boutique — sélecteur de vente, de caisse à débiter,
// de destination de transfert ou de ravitaillement.
export const boutiquesVisibles = (db, profile, liste) => {
  if (voitLesDeuxEspaces(db, profile)) return liste;
  const monEspace = estCompteFormation(db, profile);
  return liste.filter((b) => !!b.formation === monEspace);
};

// La boutique proposée par défaut à l'ouverture d'un écran.
// ⚠ Ne retombe JAMAIS sur db.boutiques[0] : c'était le repli historique de
// sept écrans, et il désignait la PREMIÈRE boutique de la base — donc une
// vraie — dès que la liste visible était vide (compte de formation avant
// qu'une boutique d'entraînement n'existe, ou l'inverse). La rangée
// d'onglets étant alors vide, rien ne signalait l'erreur, mais l'écran
// écrivait bel et bien dans la boutique de repli. On renvoie "" : chaque
// écran affiche alors <AucuneBoutique/> au lieu d'un formulaire piégé.
export const boutiqueParDefaut = (db, profile) =>
  boutiquesVisibles(db, profile, boutiquesVente(db))[0]?.nom || "";

// La boutique réellement retenue par un écran, à partir de celle que
// l'utilisateur a choisie (`choisie`, un état React).
//
// ⚠ Deux pièges, tous deux constatés en production :
//   1. `choisie` est initialisée UNE SEULE FOIS au premier montage, et les
//      écrans restent montés toute la session (2.98.99). Un écran ouvert
//      pendant la synchronisation d'ouverture — quand db.boutiques est
//      encore vide — gardait une valeur vide pour toujours.
//   2. `choisie` peut désigner une boutique qui N'EXISTE PLUS : supprimée
//      dans ⚙ Paramètres, ou effacée par une réinitialisation complète.
//      L'écran affichait alors son nom en en-tête comme si de rien
//      n'était, avec un stock vide et aucune explication.
// Dans les deux cas on retombe sur la boutique par défaut, recalculée à
// chaque rendu : l'écran se répare tout seul.
export const boutiqueRetenue = (db, profile, choisie) => {
  if (profile?.boutique) return profile.boutique;
  const visibles = boutiquesVisibles(db, profile, db.boutiques || []);
  if (choisie && visibles.some((b) => b.nom === choisie)) return choisie;
  return boutiqueParDefaut(db, profile);
};

export const ventesReelles = (db) => {
  const f = boutiquesFormation(db);
  return (db.ventes || []).filter((v) => !f.has(v.boutique));
};
// Les dépenses, dettes et produits qui comptent VRAIMENT — mêmes pendants
// que ventesReelles(), à utiliser partout où un total global ou un export
// est calculé (c'est leur absence qui laissait « Total des dépenses », le
// capital dormant et le journal comptable compter l'entraînement).
export const depensesReelles = (db) => {
  const f = boutiquesFormation(db);
  return (db.depenses || []).filter((d) => !f.has(d.boutique));
};
export const dettesReelles = (db) => {
  const f = boutiquesFormation(db);
  return (db.dettes || []).filter((d) => !f.has(d.boutique));
};
export const produitsReels = (db) => {
  const f = boutiquesFormation(db);
  return (db.produits || []).filter((p) => !f.has(p.boutique));
};
// Un chantier ne porte pas de boutique : elle se retrouve par la vente
// liée, à défaut par la dette (cas « pose seule »). Même chemin que
// imprimerPV() et que la réinitialisation de formation.
export const boutiqueDuChantier = (db, c) => {
  const vente = (db.ventes || []).find((v) => v.id === c.vente_id);
  if (vente) return vente.boutique;
  const dette = c.dette_id ? (db.dettes || []).find((d) => d.id === c.dette_id) : null;
  return dette?.boutique;
};
// ⚠ Les écrans de SYNTHÈSE (Tableau de bord, Rentabilité) excluaient la
// formation « en dur », sans jamais regarder QUI les consulte. Un compte
// marqué formation y voyait donc le vrai chiffre d'affaires de
// l'entreprise, ses dépenses et ses marges — le cloisonnement s'arrêtait
// à la porte de ces deux écrans.
//
// Renvoie un test à appliquer sur tout enregistrement portant une
// `boutique` : un compte de formation ne voit que SES chiffres, tous les
// autres (y compris l'admin principal) voient les vrais — c'est bien la
// vue « CA réel » qui est attendue là.
export const filtreEspaceAffichage = (db, profile) => {
  const f = boutiquesFormation(db);
  const enFormation = estCompteFormation(db, profile) && !voitLesDeuxEspaces(db, profile);
  return (x) => (enFormation ? f.has(x?.boutique) : !f.has(x?.boutique));
};
// Vrai quand l'écran doit afficher les chiffres de l'ESPACE FORMATION.
export const afficheChiffresFormation = (db, profile) =>
  estCompteFormation(db, profile) && !voitLesDeuxEspaces(db, profile);

export const chantiersReels = (db) => {
  const f = boutiquesFormation(db);
  return (db.clients_installes || []).filter((c) => !f.has(boutiqueDuChantier(db, c)));
};
// Les chantiers que le compte connecté a le droit de modifier — utilisé par
// les traitements de masse (réception automatique à J+7), qui écrivent tout
// en un seul save() et seraient refusés en bloc s'ils mélangeaient les deux
// espaces. Un chantier sans boutique identifiable reste traité par tous :
// il n'appartient à aucun espace, et le verrou le laisse passer.
export const chantiersDeMonEspace = (db, profile) => {
  if (voitLesDeuxEspaces(db, profile)) return db.clients_installes || [];
  const monEspace = estCompteFormation(db, profile);
  return (db.clients_installes || []).filter((c) => {
    const b = boutiqueDuChantier(db, c);
    return !b || estBoutiqueFormation(db, b) === monEspace;
  });
};

export const ventesDuCommercial = (db, nom) => {
  if (db.__index) return db.__index.ventesParCommercial.get(nom) || [];
  return ventesReelles(db).filter((v) => v.commercial === nom);
};

export const stockVendu = (db, pid) =>
  db.__index
    ? (db.__index.venduParProduit.get(pid) || 0)
    : db.ventes.reduce((s, v) => s + lignesVente(v).filter((l) => l.produit_id === pid).reduce((t, l) => t + Number(l.qte || 0), 0), 0);

export const stockAjuste = (db, pid) =>
  db.__index
    ? (db.__index.ajusteParProduit.get(pid) || 0)
    : (db.ajustements || []).filter((a) => a.produit_id === pid)
        .reduce((s, a) => s + Number(a.qte || 0), 0);

export const stockActuel = (db, p) =>
  Number(p.initial || 0) + Number(p.entrees || 0)
  - stockVendu(db, p.id) + stockAjuste(db, p.id);

// ============ PAIE : calcul du net d'un mois + virements ============
// Un « virement » est un versement de salaire envoyé par l'administrateur.
// Il reste « en attente » tant que l'employé ne l'a pas confirmé (accepté).
export const virementsMois = (u, mois) => (u.virements || []).filter((v) => v.mois === mois);

// ============ CRÉDIT BMI (prêt accordé à un employé) ============
// Un employé demande un crédit ; l'admin approuve ou refuse.
// Remboursement : soit par retenue automatique sur salaire (échéancier),
// soit librement (versements saisis par l'admin).
export const totalRembourseCredit = (c) => (c.remboursements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
export const resteCredit = (c) => Math.max(0, Number(c.montant_accorde || 0) - totalRembourseCredit(c));
export const creditsDe = (u) => u.credits || [];
export const creditsEnAttente = (u) => creditsDe(u).filter((c) => c.statut === "en_attente");
export const creditsEnCours = (u) => creditsDe(u).filter((c) => c.statut === "approuve" && resteCredit(c) > 0);

// Décale un mois "AAAA-MM" de k mois
export const moisPlus = (mois, k) => {
  const [a, m] = String(mois).split("-").map(Number);
  const d = new Date(a, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Retenue de crédit prévue sur le salaire d'un mois donné
export const retenueCreditMois = (u, mois) =>
  creditsDe(u).filter((c) => c.statut === "approuve" || c.statut === "solde")
    .reduce((s, c) => s + (c.echeances || []).filter((e) => e.mois === mois).reduce((t, e) => t + Number(e.montant || 0), 0), 0);

// Marque les échéances du mois comme retenues (appelé quand l'admin verse le salaire)
export const appliquerRetenuesCredit = (u, mois, par) =>
  creditsDe(u).map((c) => {
    if (c.statut !== "approuve") return c;
    const dues = (c.echeances || []).filter((e) => e.mois === mois && !e.paye);
    if (!dues.length) return c;
    const total = dues.reduce((s, e) => s + Number(e.montant || 0), 0);
    const echeances = (c.echeances || []).map((e) => (e.mois === mois && !e.paye ? { ...e, paye: true, date_paiement: today() } : e));
    const remboursements = [...(c.remboursements || []), { date: today(), montant: total, par, source: "salaire", note: `Retenue sur salaire ${libelleMoisFR(mois)}` }];
    const rembourse = remboursements.reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = Number(c.montant_accorde || 0) - rembourse <= 0;
    return { ...c, echeances, remboursements, statut: solde ? "solde" : "approuve", date_solde: solde ? today() : c.date_solde };
  });

// Caisse « hors boutique » confiée au comptable — c'est un bac UNIQUE et
// bien réel (onglet « Chez le comptable ») : il n'a pas d'équivalent
// d'entraînement, et n'est donc jamais proposé à un compte de formation.
export const NOM_CAISSE_COMPTABLE = "Chez le comptable";

// Boutique dont la caisse supporte la sortie d'argent (salaire, prêt, commission…)
// Choix STRICT parmi les boutiques de vente (jamais un dépôt, qui n'a pas de
// caisse) + l'option « Chez le comptable » — jamais de texte libre, pour ne
// plus jamais risquer une boutique mal orthographiée ou inventée.
// ⚠ Cloisonnement : la liste passe par boutiquesVisibles(). Sans ce filtre,
// ce sélecteur — partagé par TOUS les paiements (commissions, primes,
// salaires, virements, fournisseurs, CNSS) — proposait les vraies boutiques
// à un compte de formation : une sortie de caisse d'entraînement creusait
// alors un trou dans une caisse réelle, et prévenait ses vrais vendeurs.
export async function choisirBoutiqueDebitG(db, u, titre, profile) {
  const noms = boutiquesVisibles(db, profile, boutiquesVente(db)).map((b) => b.nom);
  // Le comptable ne tient qu'une seule caisse, réelle : on ne la propose
  // qu'aux comptes qui travaillent dans l'espace réel.
  const options = estCompteFormation(db, profile) && !voitLesDeuxEspaces(db, profile)
    ? noms
    : [...noms, NOM_CAISSE_COMPTABLE];
  if (options.length === 0) {
    uAlert("Aucune caisse disponible pour votre espace de travail.\n\nDemandez à l'administrateur de créer une boutique correspondante avant d'enregistrer ce paiement.");
    return null;
  }
  if (options.length === 1) return options[0];
  const defaut = u.boutique && noms.includes(u.boutique) ? u.boutique : null;
  const b = await uChoix(`${titre}\n\nBoutique dont la caisse est débitée ?${defaut ? ` (habituellement : ${defaut})` : ""}`, options);
  return b; // null = annulé ; sinon une valeur EXACTE de la liste, jamais autre chose
}

// Prévient la ou les bonnes personnes qu'une sortie de caisse vient d'être
// réglée (commission, salaire, avance, crédit, prime d'installation…) et
// d'où l'argent est sorti — pour que la caisse concernée (boutique ou
// comptable) sache que cette sortie est passée, et à qui.
export function messagesNotifSortieCaisse(db, profile, destination, nomBeneficiaire, montant, libelle = "Commission payée à", sens = "sortie") {
  const base = { date: today(), ts: new Date().toISOString(), de_id: profile.id, de_nom: profile.nom, lu_par: [profile.id] };
  const texte = `💰 ${libelle} ${nomBeneficiaire} : ${fmt(montant)} — ${sens === "entree" ? "entrée de caisse" : "sortie de caisse"} : ${destination}.`;
  const destinataires = destination === "Chez le comptable"
    ? db.users.filter((u) => u.role === "comptable" && u.actif !== false)
    : db.users.filter((u) => (u.role === "vendeur" || u.role === "gerant") && u.boutique === destination && u.actif !== false);
  return destinataires.map((u) => ({ ...base, id: uid(), a_id: u.id, texte }));
}
// Ancien nom conservé par compatibilité (les 3 flux de commission l'utilisaient déjà).
export const messagesNotifPaiementCommission = messagesNotifSortieCaisse;

// ============ PRIME D'INSTALLATION : demande → validation par le vendeur ============
// Circuit à deux temps (demande Timo, même principe que la validation des
// commandes) : demanderPaiementPrime choisit la boutique qui paiera ;
// n'importe quel vendeur DE CETTE BOUTIQUE (ou l'admin) peut ensuite valider
// — plus besoin que ce soit systématiquement l'administrateur. Cette
// fonction fait le VRAI travail (sortie de caisse + notification), appelée
// à l'identique depuis ClientsInstalles.jsx (bouton inline) et depuis
// l'onglet dédié PrimesRemises.jsx — pour ne jamais avoir deux versions de
// la même logique qui pourraient un jour diverger.
export function construirePaiementPrime(db, profile, c, e, moyen) {
  const bq = e.prime_boutique;
  const dep = {
    id: uid(), date: today(), boutique: bq, categorie: "Prime d'installation",
    description: `Installation ${c.nom} — ${e.nom}${e.chef ? " (chef de chantier)" : ""} · ${e.pct} %`,
    montant: e.montant, paiement: normPaiement(moyen), par: profile.nom, auto: "installation", user_id: e.user_id,
  };
  return {
    ...db,
    clients_installes: db.clients_installes.map((x) => (x.id === c.id
      ? { ...x, equipe: (x.equipe || []).map((y) => (y.user_id === e.user_id ? { ...y, paye: true, date_paiement: today(), dep_id: dep.id, demande_prime: false, validee_par: profile.nom } : y)) }
      : x)),
    depenses: [dep, ...db.depenses],
    messages: [
      ...(e.user_id ? [{
        id: uid(), date: today(), ts: new Date().toISOString(),
        de_id: profile.id, de_nom: profile.nom, a_id: e.user_id, lu_par: [profile.id],
        texte: `💰 Votre prime d'installation du chantier ${c.nom} ${c.prenom || ""} vous a été payée : ${fmt(e.montant)} (${normPaiement(moyen)}). Retrouvez le détail dans « 💰 Primes reçues ».`,
      }] : []),
      ...messagesNotifSortieCaisse(db, profile, bq, e.nom, e.montant, "Prime d'installation payée à"),
    ],
  };
}

// Toutes les demandes de prime en attente de validation, aplaties depuis
// chaque chantier — pour l'onglet du vendeur (filtré par sa boutique) et,
// avec includeToutes, pour l'admin qui voit tout.
// ⚠ Cloisonnement : `prime_boutique` est la caisse qui paiera — c'est elle
// qui décide de l'espace. Sans `profile`, un vendeur réel voyait (et
// pouvait valider) les demandes de prime d'un chantier d'entraînement.
export function primesEnAttente(db, boutique, profile) {
  const out = [];
  const filtrer = profile !== undefined && !voitLesDeuxEspaces(db, profile);
  const monEspace = filtrer ? estCompteFormation(db, profile) : null;
  for (const c of db.clients_installes || []) {
    for (const e of c.equipe || []) {
      if (!e.demande_prime) continue;
      if (boutique && e.prime_boutique !== boutique) continue;
      if (filtrer && estBoutiqueFormation(db, e.prime_boutique) !== monEspace) continue;
      out.push({ client: c, entree: e });
    }
  }
  return out;
}

// Toutes les primes (en attente + payées) d'UN technicien précis, aplaties
// depuis chaque chantier — pour son onglet « Primes reçues ».
export function primesDeTechnicien(db, userId) {
  const out = [];
  for (const c of db.clients_installes || []) {
    for (const e of c.equipe || []) {
      if (e.user_id === userId && Number(e.montant) > 0) out.push({ client: c, entree: e });
    }
  }
  return out.sort((a, b) => (b.entree.date_paiement || b.entree.prime_demandee_le || "").localeCompare(a.entree.date_paiement || a.entree.prime_demandee_le || ""));
}

// Tous les contrats d'installation SIGNÉS, aplatis depuis chaque client —
// pour l'onglet "📄 Contrats" : admin et responsable commercial voient tout
// (aucun filtre), un commercial ne voit que ses propres devis (filtre
// `commercial`), un client ne voit que ses propres contrats (filtre
// `clientId`). Un devis sans contrat_signature n'apparaît jamais ici.
// `payeSeulement` (Timo) : tant que le devis n'est pas encaissé (statut
// "paye"), seul l'admin peut le voir — l'initiateur et le client doivent
// attendre l'encaissement pour accéder à leur contrat.
// ⚠ Cloisonnement : `espace` vaut true (formation), false (réel) ou
// undefined (les deux, réservé à l'admin principal). Un devis créé depuis
// un compte de formation porte `formation: true` (voir devisDeFormation()
// et envoyerDevisEtOuvrirWhatsApp) — les devis antérieurs à ce marquage
// n'ont pas le champ et sont donc traités comme réels.
export function contratsInstallation(db, { commercial, clientId, payeSeulement, espace } = {}) {
  const out = [];
  for (const u of db.users || []) {
    if (clientId && u.id !== clientId) continue;
    for (const d of u.devis || []) {
      if (espace !== undefined && !!d.formation !== espace) continue;
      if (d.contrat_signature && (!commercial || d.par === commercial) && (!payeSeulement || d.statut === "paye")) out.push({ client: u, devis: d });
    }
  }
  return out.sort((a, b) => (b.devis.contrat_date_signature || "").localeCompare(a.devis.contrat_date_signature || ""));
}

// L'espace à passer aux fonctions ci-dessus pour le compte connecté :
// undefined quand il a le droit de voir les deux (admin principal,
// act_voir_tout), sinon son propre espace.
export const espaceDuCompte = (db, profile) =>
  voitLesDeuxEspaces(db, profile) ? undefined : estCompteFormation(db, profile);

// Marque à poser sur tout enregistrement qui n'appartient à AUCUNE boutique
// (devis, compte client, prospect) et que le cloisonnement par boutique ne
// peut donc pas rattraper.
export const marqueEspace = (db, profile) =>
  (estCompteFormation(db, profile) ? { formation: true } : {});

// ⚠ Demande Timo : le PV de réception doit apparaître sur la MÊME fiche
// que le contrat correspondant (onglet Contrats), pas dans une liste à
// part. Un devis n'a pas de lien direct vers son chantier — la chaîne
// passe par devis → commande (commande.devis_id) → vente (vente.commande_id)
// → chantier (clients_installes.vente_id), exactement le même chemin que
// celui déjà utilisé par imprimerPV() (lib/impression.js) en sens inverse.
export function pvDuContrat(db, devisId) {
  // ⚠ Correction (2.99.91 était trop fragile) : le chantier porte en fait
  // un lien DIRECT vers son devis (`devis_id`, posé dès sa création dans
  // Ventes.jsx au moment où le paiement déclenche l'installation) — pas
  // besoin de repasser par commande→vente. La chaîne indirecte reste en
  // repli pour d'éventuels chantiers créés à la main sans ce champ.
  const direct = (db.clients_installes || []).find((c) => c.devis_id === devisId);
  if (direct) return direct;
  const commande = (db.commandes || []).find((cm) => cm.devis_id === devisId);
  if (!commande) return null;
  const vente = (db.ventes || []).find((v) => v.commande_id === commande.id);
  if (!vente) return null;
  return (db.clients_installes || []).find((c) => c.vente_id === vente.id) || null;
}

// Quand on supprime une dépense générée automatiquement par un paiement
// (commission, prime d'installation…), il faut aussi redonner leur statut
// « non payé » aux ventes / chantiers liés — sinon la commission reste
// bloquée en "payée" pour toujours, sans qu'aucune trace de paiement ne subsiste.
export function annulerLiensDepense(db, d) {
  if (d.auto === "commission") {
    return { ventes: (db.ventes || []).map((v) => (v.commission_dep === d.id ? { ...v, commission_payee: false, commission_dep: null } : v)) };
  }
  if (d.auto === "commission_equipe") {
    return { ventes: (db.ventes || []).map((v) => (v.override_dep === d.id ? { ...v, override_payee: false, override_dep: null } : v)) };
  }
  if (d.auto === "commission_ext") {
    return { ventes: (db.ventes || []).map((v) => (v.apporteur?.dep_id === d.id ? { ...v, apporteur: { ...v.apporteur, payee: false, dep_id: null, date_paiement: null } } : v)) };
  }
  if (d.auto === "installation") {
    return { clients_installes: (db.clients_installes || []).map((c) => ({ ...c, equipe: (c.equipe || []).map((e) => (e.dep_id === d.id ? { ...e, paye: false, date_paiement: null, dep_id: null } : e)) })) };
  }
  return {};
}

// Envoi d'un virement de salaire (utilisé par 👥 Utilisateurs et 💵 Salaires)
export async function envoyerVirementG(db, save, profile, u, moisImpose) {
  const mois = moisImpose || await uPrompt(`Mois du virement pour ${u.nom} (AAAA-MM) :`, today().slice(0, 7));
  if (!mois) return;
  if (!/^\d{4}-\d{2}$/.test(String(mois).trim())) { uAlert("Format attendu : AAAA-MM (ex : 2026-07)."); return; }
  const m = String(mois).trim();
  const p = paieMois(u, m);
  const suggestion = Math.max(0, p.reste);
  const v = await uPrompt(
    `Montant du virement (F CFA) — ${libelleMoisFR(m)}\n\n` +
    `Salaire de base : ${fmt(p.base)}\nPrimes : +${fmt(p.primes)}\nAvances : −${fmt(p.avances)}\nRetenue crédit BMI : −${fmt(p.retenueCredit)}\nNet à percevoir : ${fmt(p.net)}\n` +
    `Déjà envoyé ce mois : ${fmt(p.verse)}\nReste à verser : ${fmt(Math.max(0, p.reste))}`,
    String(suggestion || "")
  );
  if (v === null) return;
  const montant = Number(v);
  if (!montant || montant <= 0) { uAlert("Montant invalide."); return; }
  const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Virement bancaire");
  if (moyen === null) return;
  const ref = await uPrompt("Référence ou note (facultatif) :", "");
  if (ref === null) return;
  const bq = await choisirBoutiqueDebitG(db, u, `Virement de ${fmt(montant)} à ${u.nom}`, profile);
  if (bq === null) return;
  const retenue = (u.credits || []).filter((c) => c.statut === "approuve")
    .reduce((s, c) => s + (c.echeances || []).filter((e) => e.mois === m && !e.paye).reduce((t, e) => t + Number(e.montant || 0), 0), 0);
  if (!await uConfirm(`Envoyer un virement de ${fmt(montant)} à ${u.nom} pour ${libelleMoisFR(m)} ?\n\nSortie de caisse ${bq || ""} : ${fmt(montant)}${retenue ? `\nRetenue crédit BMI comptabilisée : ${fmt(retenue)}` : ""}\n\nIl devra confirmer la réception depuis son espace « Salaire ».`)) return;
  const virement = {
    id: uid(), mois: m, montant, moyen: String(moyen).trim(), ref: String(ref).trim(), boutique: bq,
    statut: "envoye", date_envoi: today(), par: profile.nom
  };
  const paie = normPaiement(moyen);
  const deps = [{
    id: uid(), date: today(), boutique: bq, categorie: "Salaires",
    description: `Salaire ${libelleMoisFR(m)} — ${u.nom}`,
    montant: montant + retenue, paiement: paie, par: profile.nom, auto: "virement", user_id: u.id
  }];
  if (retenue > 0) {
    deps.push({
      id: uid(), date: today(), boutique: bq, categorie: "Prêt au personnel",
      description: `Remboursement crédit BMI retenu sur salaire ${libelleMoisFR(m)} — ${u.nom}`,
      montant: -retenue, paiement: paie, par: profile.nom, auto: "retenue", user_id: u.id
    });
  }
  save({
    ...db,
    users: db.users.map((x) => (x.id === u.id ? { ...x, virements: [...(x.virements || []), virement], credits: appliquerRetenuesCredit(x, m, profile.nom) } : x)),
    depenses: [...deps, ...db.depenses],
    messages: [...messagesNotifSortieCaisse(db, profile, bq, u.nom, montant, "Salaire versé à"), ...(db.messages || [])],
  }, `Virement de ${fmt(montant)} envoyé à ${u.nom} (${libelleMoisFR(m)})`);
  uAlert(`✅ Virement de ${fmt(montant)} envoyé à ${u.nom}. Enregistré en dépense « Salaires ».`);
}

// À partir de ce nombre de clients apportés, un apporteur externe devient
// éligible au statut de Commercial (compte utilisateur avec commission).
export const SEUIL_COMMERCIAL = 5;

// ---- PROSPECTS DORMANTS ----
// Un prospect qui n'a pas bougé depuis des mois n'est plus un prospect : c'est un
// contact. Le laisser dans la file active fausse les tableaux de bord et noie les
// vraies pistes. On le signale, on l'archive — on ne le supprime jamais : un numéro
// qualifié garde de la valeur pour une campagne future.
export const SEUIL_DORMANT_JOURS = 150; // ~5 mois

// Dernière trace d'activité : la dernière modification, à défaut la création.
export const derniereActivite = (p) => p.maj_le || p.date;
export const joursSansActivite = (p) => {
  const d = Date.parse(derniereActivite(p));
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
};
export const estDormant = (p) => !p.converti && !p.archive && joursSansActivite(p) >= SEUIL_DORMANT_JOURS;

// Toute modification d'un prospect l'horodate : sans cela, impossible de savoir
// lequel dort vraiment.
export const toucher = (p) => ({ ...p, maj_le: today() });

// Un CLIENT peut en parrainer un autre. Il touche alors une commission sur la
// vente de son filleul — comme un apporteur externe, mais avec un compte.
// Taux par défaut ; l'administrateur peut le régler compte par compte
// (users[].taux_commission), exactement comme pour un commercial.
export const TAUX_PARRAINAGE_CLIENT = 3;

// Le client note celui qui est venu chez lui. Trois critères, notés sur 5.
export const CRITERES_NOTE = [
  { id: "habillement", label: "Présentation / tenue", emoji: "👔" },
  { id: "maitrise", label: "Maîtrise du sujet", emoji: "🎓" },
  { id: "respect", label: "Respect et courtoisie", emoji: "🤝" },
];
export const moyenneNote = (e) => {
  const n = CRITERES_NOTE.map((c) => Number(e[c.id] || 0)).filter((x) => x > 0);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
};
// Moyenne d'un employé sur toutes ses évaluations.
export const noteMoyenne = (u) => {
  const evs = u.evaluations || [];
  if (!evs.length) return null;
  return evs.reduce((s, e) => s + moyenneNote(e), 0) / evs.length;
};
export const etoiles = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
// Taux par défaut du parrainage, réglable dans ⚙ Paramètres. Rangé dans la fiche
// boutique — comme la note du dimensionnement — donc AUCUNE migration de base.
export const tauxParrainageDefaut = (db) => {
  const b = (db?.boutiques || []).find((x) => typeof x.taux_parrainage === "number");
  return b ? b.taux_parrainage : TAUX_PARRAINAGE_CLIENT;
};
// Le taux d'un parrain : son taux personnel s'il en a un, sinon le taux par défaut.
export const tauxParrain = (u, db) => Number(u?.taux_commission || tauxParrainageDefaut(db));

// Un commercial qui a recruté ce nombre de filleuls devient CHEF D'ÉQUIPE
// automatiquement, et touche une commission sur les commissions de son équipe.
export const SEUIL_CHEF_EQUIPE = 5;
export const TAUX_EQUIPE_DEFAUT = 10; // % de la commission de chaque filleul

// Les commerciaux recrutés par u (son équipe)
// Réseau COMMERCIAL uniquement : un client parrainé ne doit JAMAIS compter ici,
// sinon un client cumulant 5 filleuls deviendrait « chef d'équipe ».
// Le parrainage entre clients utilise un champ distinct : parrain_client_id.
export const filleulsDe = (db, u) => (db.users || []).filter((x) =>
  x.parrain_id === u.id && x.actif !== false && (x.role === "commercial" || x.role === "technicien"));

// Chef d'équipe : soit désigné par l'admin, soit atteint le seuil de recrutement
export const estChefEquipe = (db, u) => !!u.chef_equipe || filleulsDe(db, u).length >= SEUIL_CHEF_EQUIPE;

// COMMISSION D'UNE VENTE pour son commercial.
// Le RABAIS accordé au client est déduit de la commission : c'est le commercial
// qui l'offre, pas l'entreprise. La marge de BMI est donc préservée.
// Le verrou est posé ICI, à la source : toutes les vues des commissions passent
// par cette fonction. Une vente issue d'un devis ne rapporte RIEN tant que le
// client n'a pas réceptionné l'installation.
export const commissionBloquee = (v) => v.commission_a_la_reception === true;

// ---- Réception d'un chantier : déblocage des commissions + notification ----
// Utilisé par les TROIS chemins de réception : le client dans son espace,
// le constat par BMI, et la réception automatique à J+7. Retourne les
// fragments { ventes, messages } à étaler dans le save appelant.
// - débloque la commission du commercial/technicien (commission_a_la_reception)
// - débloque la part du parrain client (apporteur.a_la_reception)
// - si un parrain existe : dépose un message dans son fil « support »
//   (son espace client), non lu, pour qu'il soit prévenu activement.
export const debloquerCommissionsReception = (db, vente_id, contexte) => {
  const ventes = db.ventes || [];
  const vente = ventes.find((v) => v.id === vente_id);
  if (!vente) return { ventes, messages: db.messages || [] };
  const majVentes = ventes.map((v) => (v.id === vente_id
    ? { ...v, commission_a_la_reception: false, commission_debloquee_le: today(),
        apporteur: v.apporteur ? { ...v.apporteur, a_la_reception: false } : v.apporteur }
    : v));
  let messages = db.messages || [];
  const app = vente.apporteur;
  if (app && app.parrain_user_id && app.a_la_reception && Number(app.montant || 0) > 0) {
    messages = [{
      id: uid(), date: today(), ts: new Date().toISOString(),
      de_id: "bmi-systeme", de_nom: "BMI TOGO",
      canal: "support", client_id: app.parrain_user_id, lu_par: [],
      texte: `🎉 Bonne nouvelle ! L'installation de votre filleul${app.nom ? ` ${app.nom}` : ""} a été réceptionnée${contexte ? ` (${contexte})` : ""}. Votre commission de parrainage de ${fmt(app.montant)} F est maintenant due : elle vous sera versée par BMI TOGO. Merci de votre confiance !`,
    }, ...messages];
  }
  return { ventes: majVentes, messages };
};

// ⚠ Demande Timo : la commission se calcule sur le CHIFFRE D'AFFAIRES réel de
// la vente (caVente), pas sur le montant total payé par le client — un
// article « hors boutique » ou déjà compté lors d'une vente antérieure (voir
// Ventes.jsx « Transformer en devis ») n'ouvre droit à AUCUNE commission.
export const commissionBrute = (v, taux) => {
  const base = caVente(v) + Number(v.rabais || 0); // total avant le rabais du commercial
  return Math.max(0, Math.round((base * Number(taux || 0)) / 100) - Number(v.rabais || 0));
};

export const commissionVente = (v, taux) => (commissionBloquee(v) ? 0 : commissionBrute(v, taux));

// Ce qui est gagné mais pas encore exigible : en attente de la réception des travaux.
export const commissionEnAttente = (v, taux) => (commissionBloquee(v) ? commissionBrute(v, taux) : 0);

// Commission d'une personne sur une vente : seul le COMMERCIAL supporte le rabais
// qu'il a lui-même offert. Le responsable associé, lui, n'a pas à le payer.
//
// Le blocage « réception » est déjà appliqué par commissionVente ci-dessus.
export const commissionPour = (v, nom, taux) => (v.commercial === nom
  ? commissionVente(v, taux)
  : (commissionBloquee(v) ? 0 : Math.round((caVente(v) * Number(taux || 0)) / 100)));

// Normalise un nom d'article pour le comparer : majuscules, sans accents,
// sans ponctuation, sans espaces multiples, et au singulier grossier.
// « Panneaux 550 W » et « PANNEAU 550W » deviennent la même chose.
export const normNom = (s) => String(s || "")
  .toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/g, " ")
  .trim()
  .split(" ").map((m) => (m.length > 3 && m.endsWith("S") ? m.slice(0, -1) : m)).join(" ");

// Cherche l'article correspondant dans une liste : d'abord exact, puis par inclusion.
export const trouverArticle = (liste, nom) => {
  const n = normNom(nom);
  if (!n) return null;
  return liste.find((p) => normNom(p.nom) === n)
    || liste.find((p) => normNom(p.nom).includes(n) || n.includes(normNom(p.nom)))
    || null;
};

// ============ RÉSERVATIONS PRÉPAYÉES ============
// Le client paie par tranches AVANT d'emporter. L'argent encaissé est une AVANCE
// (compte 4191), pas un chiffre d'affaires : il ne devient CA qu'à la livraison.
// Le stock n'est réservé qu'à la livraison (décision retenue).
export const estReservation = (d) => d.type === "prepaye";
export const reservations = (db) => (db.dettes || []).filter(estReservation);
export const dettesClassiques = (db) => (db.dettes || []).filter((d) => !estReservation(d));
export const resteAPayer = (d) => Math.max(0, Number(d.montant || 0) - Number(d.paye || 0));
export const totalReservation = (r) => (r.articles || []).reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);

// ============ DEMANDES DE RAVITAILLEMENT ============
// Une boutique demande de la marchandise ; la demande est stockée dans SA fiche
// (aucune migration de base). Le magasinier la voit, prépare le bon, et sert.
export const demandesDe = (b) => b.demandes || [];
// ⚠ Cloisonnement : le magasinier ne doit voir QUE les demandes de son
// espace. Sans `profile`, le magasinier réel recevait les demandes des
// boutiques d'entraînement et les servait depuis le VRAI dépôt — le stock
// physique ne correspondait alors plus au logiciel.
export const demandesEnAttente = (db, profile) =>
  boutiquesVisibles(db, profile, (db.boutiques || []).filter((b) => !b.depot))
    .flatMap((b) => demandesDe(b).filter((d) => d.statut === "en_attente").map((d) => ({ boutique: b.nom, d })));

// Articles sous le seuil dans les boutiques de vente (le magasinier voit l'alerte,
// pas le stock complet de la boutique) — dans son espace uniquement.
export const alertesBoutiques = (db, stock, profile) => {
  const visibles = new Set(boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom));
  return (db.produits || [])
    .filter((p) => !estDepot(db, p.boutique) && visibles.has(p.boutique))
    .map((p) => ({ p, actuel: stock(db, p) }))
    .filter((x) => x.actuel <= Number(x.p.seuil || 0))
    .sort((a, b) => a.actuel - b.actuel);
};

// ============ APPORTEURS D'AFFAIRES ============
// N'IMPORTE QUEL utilisateur qui amène un client peut être crédité de la vente
// et toucher sa commission, s'il a un taux de commission défini par l'admin.
export const aUnTaux = (u) => Number(u.taux_commission || 0) > 0;
// ⚠ Cloisonnement : on ne propose que des collègues du MÊME espace —
// créditer une vente d'entraînement à un commercial réel (ou l'inverse)
// n'aurait aucun sens, et la vente porterait son nom pour toujours.
export const apporteursPossibles = (db, profile) => {
  const noms = new Map();
  const monEspace = estCompteFormation(db, profile);
  const memeEspace = (u) => voitLesDeuxEspaces(db, profile) || !!u.formation === monEspace;
  (db.users || []).filter((u) => u.actif !== false && u.role !== "client" && aUnTaux(u) && memeEspace(u))
    .forEach((u) => noms.set(u.nom, { id: u.id, nom: u.nom, taux: Number(u.taux_commission || 0), role: u.role }));
  // La table `commerciaux` ne porte pas de drapeau d'espace : on récupère
  // celui du compte du même nom quand il existe, sinon la fiche est
  // considérée comme RÉELLE (le doute profite aux vraies données).
  (db.commerciaux || []).filter((c) => c.actif !== false)
    .forEach((c) => {
      const compte = (db.users || []).find((u) => u.nom === c.nom);
      if (!memeEspace(compte || {})) return;
      if (!noms.has(c.nom)) noms.set(c.nom, { id: c.id, nom: c.nom, taux: Number(c.taux || 0), role: "commercial" });
    });
  return [...noms.values()].sort((a, b) => a.nom.localeCompare(b.nom));
};
// A-t-il quelque chose à voir dans « Ma commission » ?
export const estApporteur = (db, profile) => {
  const moi = (db.users || []).find((u) => u.id === profile.id);
  return (moi && aUnTaux(moi)) || (db.ventes || []).some((v) => v.commercial === profile.nom || v.responsable === profile.nom);
};

// ============ MAGASINS (dépôts) ============
// Une « boutique » marquée depot:true est un MAGASIN : on y stocke, on n'y vend pas.
// Les boutiques de vente sont ravitaillées depuis les magasins (transferts).
export const estDepot = (db, nom) => !!(db.boutiques || []).find((b) => b.nom === nom)?.depot;
export const boutiquesVente = (db) => (db.boutiques || []).filter((b) => !b.depot && !b.terrain);
export const magasinsDe = (db) => (db.boutiques || []).filter((b) => b.depot);
// ⚠ Boutique VIRTUELLE (pas un vrai point de vente) — sert uniquement de
// caisse séparée pour les encaissements de terrain (« Pose seule », demande
// Timo : un technicien encaisse en espèces/mobile money sur un chantier,
// sans jamais passer par une boutique physique). N'apparaît JAMAIS dans les
// sélecteurs de boutique classiques (vente, stock…) — seulement dans Caisse
// et dans le mécanisme d'encaissement dédié aux chantiers "pose seule".
export const NOM_BOUTIQUE_TERRAIN = "TERRAIN";
export const boutiqueTerrain = (db) => (db.boutiques || []).find((b) => b.terrain) || null;
// Crée la boutique TERRAIN si elle n'existe pas encore — appelé au moment
// où la première fiche "pose seule" en a besoin, pas au démarrage de l'app
// (évite de l'imposer aux installations qui ne l'utiliseront jamais).
export const assurerBoutiqueTerrain = (db) => {
  if (boutiqueTerrain(db)) return db;
  return { ...db, boutiques: [...(db.boutiques || []), { id: "b_terrain", nom: NOM_BOUTIQUE_TERRAIN, terrain: true, actif: true }] };
};

// ============ POUVOIRS (droits désactivables par l'administrateur) ============
// Chaque compte possède, selon son rôle, une liste de pouvoirs par défaut.
// L'administrateur peut en désactiver n'importe lequel : les identifiants
// désactivés sont stockés dans u.droits_off.
export const LIBELLE_ONGLET = {
  dashboard: "📊 Tableau de bord", ventes: "💰 Ventes", commande: "🛒 Nouvelle commande", commandes: "📥 Commandes reçues",
  dimensionnement: "☀️ Dimensionnement", depenses: "📤 Dépenses", dettes: "🧾 Dettes", clients: "👤 Clients",
  caisse: "🔒 Caisse", stocks: "📦 Stocks", fournisseurs: "🚚 Fournisseurs", commerciaux: "🎯 Commerciaux",
  equipe: "👑 Équipe", prospects: "🧲 Prospects", parc: "🏠 Clients installés", messages: "💬 Messages",
  salaires: "💵 Salaires (tous)", users: "👥 Utilisateurs", historique: "🕘 Historique", parametres: "⚙ Paramètres", rentabilite: "📈 Rentabilité",
  commission: "💵 Ma commission", taches: "✅ Mes tâches", salaire: "💵 Salaire", espace_client: "🏠 Mon espace", ravitaillement: "🚚 Ravitaillement",
  nouveau_client: "🙋 Créer un client", tous_devis: "📋 Tous les devis", chez_comptable: "🧾 Chez le comptable",
  primes_remises: "💰 Primes remises", primes_recues: "💰 Primes reçues",
  contrats: "📄 Contrats", mes_contrats: "📄 Mes contrats",
};

export const ONGLETS_ROLE = {
  admin: ["dashboard", "rentabilite", "ventes", "commandes", "dimensionnement", "tous_devis", "contrats", "depenses", "chez_comptable", "dettes", "clients", "caisse", "stocks", "fournisseurs", "commerciaux", "equipe", "prospects", "parc", "messages", "salaires", "users", "historique", "parametres"],
  commercial: ["commande", "dimensionnement", "tous_devis", "prospects", "parc", "taches", "messages", "commission", "equipe", "nouveau_client", "contrats"],
  technicien: ["commande", "dimensionnement", "tous_devis", "prospects", "parc", "taches", "messages", "commission", "equipe", "nouveau_client", "primes_recues", "contrats"],
  resp_commercial: ["equipe", "prospects", "taches", "parc", "dimensionnement", "tous_devis", "contrats", "messages", "commission", "salaire", "nouveau_client"],
  technicien_bmi: ["dimensionnement", "tous_devis", "parc", "prospects", "commission", "messages", "salaire", "nouveau_client", "contrats"],
  magasinier: ["stocks", "salaire", "messages", "nouveau_client"],
  gerant: ["ventes", "commandes", "dimensionnement", "tous_devis", "stocks", "depenses", "dettes", "clients", "caisse", "fournisseurs", "salaire", "messages", "nouveau_client", "contrats"],
  vendeur: ["ventes", "commandes", "dimensionnement", "tous_devis", "ravitaillement", "depenses", "dettes", "clients", "caisse", "salaire", "messages", "nouveau_client", "primes_remises", "contrats"],
  comptable: ["dashboard", "rentabilite", "depenses", "chez_comptable", "dettes", "caisse", "stocks", "clients", "historique", "messages", "salaire", "nouveau_client"],
  client: ["espace_client", "messages", "mes_contrats"],
};

// Pouvoirs d'action (au-delà des onglets)
export const ACTIONS_POUVOIR = [
  ["act_ecriture", "✏️ Créer / modifier / supprimer (sinon : lecture seule)", (r) => r !== "comptable" && r !== "client"],
  ["act_credit", "🏦 Demander un crédit BMI", (r) => SALARIES.includes(r)],
  ["act_reaffecter", "🔁 Réaffecter les prospects", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
  ["act_commission", "💰 Valider / payer les commissions", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
  ["act_taches", "✅ Assigner des tâches", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
  // ⚠ Désactivé par défaut pour tout nouvel admin (voir droits_off posé à
  // la création, Utilisateurs.jsx) — seul l'admin PRINCIPAL peut le
  // redonner à un autre admin, comme les autres pouvoirs sensibles.
  ["act_voir_tout", "👁️ Voir les boutiques de formation ET réelles ensemble", (r) => r === "admin"],
];

export const pouvoirsDuRole = (role) => [
  ...(ONGLETS_ROLE[role] || []).map((id) => [id, LIBELLE_ONGLET[id] || id, "Onglet"]),
  ...ACTIONS_POUVOIR.filter(([, , cond]) => cond(role)).map(([id, lbl]) => [id, lbl, "Action"]),
];

// Lecture EN DIRECT des droits (le profil de connexion est figé au login)
export const droitsOffDe = (db, profile) => (((db.users || []).find((u) => u.id === profile.id) || profile).droits_off) || [];
export const aDroit = (db, profile, id) => !droitsOffDe(db, profile).includes(id);

// Le comptable est en LECTURE SEULE par nature (consultation + exports).
// Pour les autres rôles, l'admin peut retirer le pouvoir « act_ecriture ».
// L'administrateur PRINCIPAL n'est jamais en lecture seule : si le pouvoir
// d'écriture était retiré à tous les admins, plus personne ne pourrait le
// rétablir (rétablir un pouvoir est aussi une écriture) — verrou définitif.
export const peutEcrire = (db, profile) =>
  estAdminPrincipal(db, profile) ||
  (profile.role !== "comptable" && aDroit(db, profile, "act_ecriture"));
export const bloquerSiLecture = (db, profile) => {
  if (peutEcrire(db, profile)) return false;
  uAlert("🔒 Votre compte est en lecture seule : vous pouvez consulter et exporter, mais pas modifier les données.");
  return true;
};

// ============ VERROU DE CLOISONNEMENT FORMATION / RÉEL ============
// ⚠ Le filtrage des sélecteurs (boutiquesVisibles) empêche de CHOISIR une
// boutique de l'autre espace ; il n'empêche pas d'y ÉCRIRE. Chaque écran
// oublié, chaque repli par défaut, chaque circuit indirect (demande de
// transfert, bon de ravitaillement, paiement de prime) était une brèche —
// et le restera à chaque nouvel écran ajouté.
//
// Ce verrou est posé UNE fois, à la source : App.jsx fait déjà passer
// TOUTES les écritures de l'application par save(), où vit déjà le verrou
// « lecture seule ». On y refuse désormais toute écriture portant sur une
// boutique qui n'est pas celle de l'espace du compte connecté. C'est le
// seul point de contrôle qui protège aussi ce qu'on n'a pas pensé à
// filtrer — y compris demain.
//
// Tables portant un champ `boutique` : ce sont elles qui décident.
export const TABLES_PAR_BOUTIQUE = ["ventes", "depenses", "dettes", "produits", "ajustements", "clotures", "commandes", "proformas"];

// Deux enregistrements sont-ils identiques ? Comparaison par référence
// d'abord (l'app met à jour par recopie immuable : une ligne inchangée
// garde son objet), repli sur le contenu pour rester juste si un écran
// recopie tout de même ses lignes. Même principe que sauvegarderDiff.
const memeEnregistrement = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

// Renvoie null si l'écriture est légitime, sinon la première infraction
// trouvée : { table, boutique, espaceBoutique }.
export function verifierEcritureEspace(prev, next, profile) {
  if (!profile) return null;
  if (voitLesDeuxEspaces(next, profile)) return null;   // admin principal, ou pouvoir act_voir_tout
  const monEspace = estCompteFormation(next, profile);

  // Une boutique du BON espace, ou une valeur vide/inconnue qu'on laisse
  // passer (rien à cloisonner) — sauf « Chez le comptable » et TERRAIN,
  // deux caisses bien réelles qui n'ont pas d'équivalent d'entraînement.
  const boutiqueRefusee = (nom) => {
    if (!nom) return false;
    const b = (next.boutiques || []).find((x) => x.nom === nom);
    if (!b) return nom === NOM_CAISSE_COMPTABLE ? monEspace : false;
    if (b.terrain) return monEspace;                     // caisse de terrain : réelle
    return !!b.formation !== monEspace;
  };

  for (const t of TABLES_PAR_BOUTIQUE) {
    // L'app met à jour par recopie immuable : une table non touchée par ce
    // save garde EXACTEMENT le même tableau. La plupart des écritures ne
    // concernent qu'une ou deux tables — ce test évite de reparcourir les
    // milliers de lignes des autres à chaque fois.
    if (prev && prev[t] === next[t]) continue;
    const avant = new Map((prev?.[t] || []).map((r) => [r.id, r]));
    for (const r of next[t] || []) {
      const a = avant.get(r.id);
      // ⚠ Retirer la ligne de `avant` AVANT toute autre décision : ce qui
      // reste dans la carte à la fin, ce sont les suppressions. Sortir de la
      // boucle sans l'avoir retirée ferait passer une ligne simplement
      // INCHANGÉE pour une suppression — et refuserait alors la quasi-
      // totalité des enregistrements d'un compte de formation.
      avant.delete(r.id);
      if (a && memeEnregistrement(a, r)) continue;       // ligne inchangée
      if (boutiqueRefusee(r.boutique)) return { table: t, boutique: r.boutique };
    }
    // Suppressions : effacer une ligne de l'autre espace est tout aussi grave.
    for (const a of avant.values()) {
      if (boutiqueRefusee(a.boutique)) return { table: t, boutique: a.boutique, suppression: true };
    }
  }

  // Les chantiers ne portent pas de boutique : elle se retrouve par la
  // vente (ou la dette) liée — même chemin que partout ailleurs.
  if (prev && prev.clients_installes === next.clients_installes) return null;
  const chantiersAvant = new Map((prev?.clients_installes || []).map((c) => [c.id, c]));
  for (const c of next.clients_installes || []) {
    const a = chantiersAvant.get(c.id);
    if (a && memeEnregistrement(a, c)) continue;
    if (boutiqueRefusee(boutiqueDuChantier(next, c))) return { table: "clients_installes", boutique: boutiqueDuChantier(next, c) };
  }

  return null;
}

// Le message montré à l'utilisateur quand le verrou se déclenche. Il nomme
// la boutique en cause : sans elle, l'utilisateur ne peut pas comprendre ce
// qu'on lui refuse.
export const messageEcritureRefusee = (infraction, monEspace) => {
  const LIB = {
    ventes: "une vente", depenses: "une dépense", dettes: "une dette ou une réservation",
    produits: "un article de stock", ajustements: "un mouvement de stock",
    clotures: "une clôture de caisse", commandes: "une commande",
    proformas: "une proforma", clients_installes: "un chantier",
  };
  return `🚫 Opération refusée — cloisonnement formation / réel.\n\n` +
    `Votre compte travaille dans l'espace ${monEspace ? "FORMATION" : "RÉEL"}, mais cette action ${infraction.suppression ? "supprimerait" : "écrirait"} ${LIB[infraction.table] || "un enregistrement"} sur la boutique « ${infraction.boutique || "?"} », qui appartient à l'espace ${monEspace ? "RÉEL" : "FORMATION"}.\n\n` +
    `Rien n'a été enregistré. Choisissez une boutique de votre espace, ou demandez à l'administrateur principal de vérifier le rattachement de votre compte.`;
};

// ============ TÂCHES ASSIGNÉES ============
export const tachesDe = (u) => u.taches || [];
// Une tâche est « ouverte » tant qu'elle n'est ni déclarée terminée ni validée.
export const tachesOuvertes = (u) => tachesDe(u).filter((t) => t.statut !== "terminee" && t.statut !== "validee");
// Réponses du magasin (demande servie ou refusée) que la boutique n'a pas encore vues
export function compterReponsesRavitaillement(db, profile) {
  if (!profile.boutique) return 0;
  const b = (db.boutiques || []).find((x) => x.nom === profile.boutique);
  if (!b) return 0;
  return demandesDe(b).filter((d) => d.statut !== "en_attente" && !d.vu_boutique).length;
}

// Compte les demandes de TRANSFERT (boutique → boutique) en attente adressées
// à MA boutique — sert de badge de notification sur le nouvel onglet dédié.
export function compterDemandesTransfertRecues(db, profile) {
  if (!profile.boutique) return 0;
  const b = (db.boutiques || []).find((x) => x.nom === profile.boutique);
  if (!b) return 0;
  return demandesDe(b).filter((d) => d.type === "transfert" && d.statut === "en_attente").length;
}

// ⚠ L'administrateur n'est rattaché à AUCUNE boutique précise (il supervise
// tout) — compterDemandesTransfertRecues() lui renverrait toujours 0. Ce
// compteur additionne les demandes en attente de TOUTES les boutiques, pour
// un badge global sur son onglet Stocks (sinon rien ne l'avertit jamais).
export function compterDemandesTransfertToutes(db, profile) {
  return boutiquesVisibles(db, profile, db.boutiques || [])
    .reduce((s, b) => s + demandesDe(b).filter((d) => d.type === "transfert" && d.statut === "en_attente").length, 0);
}

export function compterTaches(db, profile) {
  const moi = (db.users || []).find((u) => u.id === profile.id);
  return moi ? tachesOuvertes(moi).length : 0;
}

// Notifications de l'onglet 💵 Salaire d'un employé :
// virements à confirmer + décisions de crédit pas encore vues.
export function compterNotifsSalaire(db, profile) {
  if (!SALARIES.includes(profile.role)) return 0;
  const moi = (db.users || []).find((u) => u.id === profile.id);
  if (!moi) return 0;
  const virements = (moi.virements || []).filter((v) => v.statut !== "accepte").length;
  const decisions = creditsDe(moi).filter((c) => (c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe).length;
  return virements + decisions;
}

// Notifications de l'onglet 👥 Utilisateurs (admin) : demandes de crédit à traiter.
export const compterDemandesCredit = (db) => (db.users || []).reduce((s, u) => s + creditsEnAttente(u).length, 0);

export function paieMois(u, mois) {
  const base = Number(u.salaire_base || 0);
  const primes = (u.primes || []).filter((p) => p.mois === mois).reduce((s, p) => s + Number(p.montant || 0), 0);
  const avances = (u.avances || []).filter((a) => a.mois === mois).reduce((s, a) => s + Number(a.montant || 0), 0);
  const retenueCredit = retenueCreditMois(u, mois);
  // ⚠ Demande Timo : la part SALARIALE de la CNSS (4% pension vieillesse +
  // 5% assurance maladie universelle = 9%) est retenue automatiquement sur
  // le net, mais SEULEMENT pour un employé coché « assujetti CNSS » (voir
  // PanneauCNSS, Salaires.jsx). Taux officiels : decret n°2012-038 (CNSS,
  // pensions) + CGAMU (AMU) — voir TAUX_CNSS_SALARIE dans lib/cnss.js.
  const retenueCNSS = u.cnss_assujetti ? Math.round((base + primes) * TAUX_CNSS_SALARIE) : 0;
  const vs = virementsMois(u, mois);
  const verse = vs.reduce((s, v) => s + Number(v.montant || 0), 0);
  const accepte = vs.filter((v) => v.statut === "accepte").reduce((s, v) => s + Number(v.montant || 0), 0);
  const enAttente = vs.filter((v) => v.statut !== "accepte").reduce((s, v) => s + Number(v.montant || 0), 0);
  const net = base + primes - avances - retenueCredit - retenueCNSS;
  return { base, primes, avances, retenueCredit, retenueCNSS, net, verse, accepte, enAttente, reste: net - verse, virements: vs };
}

export const libelleMoisFR = (m) => {
  const noms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const i = Number(String(m).slice(5, 7)) - 1;
  return noms[i] ? `${noms[i]} ${String(m).slice(0, 4)}` : String(m);
};

export function periodes() {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const t = iso(now);
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return [
    ["Aujourd'hui", t, t],
    ["Cette semaine", iso(lundi), t],
    ["Ce mois", `${t.slice(0, 7)}-01`, t],
    ["Cette année", `${t.slice(0, 4)}-01-01`, t],
    ["Depuis le début", "0000-01-01", "9999-12-31"]
  ];
}

// ============ REÇU CLIENT ============
// ============ NOTE DU DIMENSIONNEMENT (texte modifiable) ============
// Le texte affiché sous le tableau des équipements proposés. Modifiable par
// l'administrateur (⚙ Paramètres). Rangé dans la fiche boutique — comme le
// message du reçu — donc AUCUNE migration de base.
export const NOTE_DIM_DEFAUT = "Calcul indicatif basé sur des marges de sécurité usuelles (pertes système 20 %, convertisseur dimensionné à 2 fois la puissance totale des appareils). Les équipements « hors stock » saisis manuellement ne modifient aucun stock lors de la vente — pensez à les commander séparément si besoin. Un article contenant le mot « hybride » est considéré comme intégrant déjà le chargeur MPPT.";
export const noteDimensionnement = (db) => {
  const b = (db.boutiques || []).find((x) => typeof x.note_dim === "string");
  return b ? b.note_dim : NOTE_DIM_DEFAUT;
};

// Statut d'un chantier (par défaut : en cours)
export const statutChantier = (c) => c.statut || "en_cours";

// ============ VALIDATION DES TÂCHES ============
// Cycle : à faire → terminée (déclarée par l'exécutant, plus modifiable par
// lui) → validée OU rouverte avec motif par l'assignateur. L'admin voit
// toutes les tâches en attente ; un responsable ne voit que les siennes
// (champ « par » rempli à l'assignation).
export function tachesAValider(db, profile) {
  const isAdmin = profile.role === "admin";
  const out = [];
  for (const u of db.users || []) {
    for (const t of u.taches || []) {
      if (t.statut !== "terminee") continue;
      if (isAdmin || t.par === profile.nom) out.push({ ...t, membre: u });
    }
  }
  return out.sort((a, b) => String(a.date_fin || "").localeCompare(String(b.date_fin || "")));
}
export const compterTachesAValider = (db, profile) => tachesAValider(db, profile).length;

// ============ RÉINITIALISATION : QUI, ET DEPUIS OÙ ============
// La réinitialisation efface TOUT. Elle est donc réservée :
//   1. au LOGICIEL WINDOWS (le .exe) — jamais depuis le site web,
//   2. à l'ADMINISTRATEUR PRINCIPAL — jamais à un autre administrateur.
// Un administrateur qui se connecte depuis Vercel, même légitime, ne peut rien
// effacer : il faut être physiquement sur la machine de direction.
export const estAppWindows = () => typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");

// L'administrateur principal est celui qui porte le drapeau. À défaut, c'est le
// PREMIER administrateur créé (les comptes sont ajoutés en fin de liste).
export const adminPrincipal = (db) =>
  (db.users || []).find((u) => u.admin_principal && u.role === "admin" && u.actif !== false) ||
  (db.users || []).find((u) => u.role === "admin" && u.actif !== false) || null;

export const estAdminPrincipal = (db, profile) => {
  const p = adminPrincipal(db);
  return !!p && p.id === profile.id;
};

// Code aléatoire à recopier : impossible à taper machinalement, contrairement
// à un mot toujours identique.
export const codeConfirmation = () => {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 : illisibles
  let c = "";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  return c;
};
