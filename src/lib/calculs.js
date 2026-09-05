// ============================================================
// lib/calculs.js — Fonctions de calcul métier pures (aucun JSX) :
// stocks, paie, crédit BMI, virements, notifications de sortie de
// caisse, prospects, parrainage, commissions, dettes/réservations,
// ravitaillement, apporteurs d'affaires, dépôts, droits/pouvoirs,
// tâches, config des onglets par rôle.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { uid, normPaiement, lignesVente, caVente, rabaisImpute, fmt, today, prochainNumeroDette } from "./core";
import { SALARIES } from "./constants";
import { TAUX_CNSS_SALARIE } from "./cnss";
import { uAlert, uConfirm, uPrompt, uChoix } from "../components/ui";
// ⚠ chiffresTel est IMPORTÉ ET réexporté — le piège « export { x } from »
// (voir CLAUDE.md) a été touché une TROISIÈME fois ici, le 29/08/2026 :
// compteClientPour l'appelait sans l'avoir importé, et seul le banc l'a vu.
import { chiffresTel, memeNumero, numeroComparable } from "./identiteClient";
// ⚠ IMPORT **ET** RÉEXPORT — la deuxième fois que ce piège se présente le
// même jour. Un import ne rend pas la fonction disponible aux écrans qui
// importent depuis calculs.js : il faut le dire explicitement. La première
// fois, seul le banc l'a vu ; ici c'est la construction qui a refusé.
export { memeNumero, numeroComparable };

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
// ⚠ SUPPRIMÉ EN 2.101.14 : adminsVoyantLesDeuxEspaces(db).
// Cette fonction listait les administrateurs qui traversaient encore le mur
// formation / réel, pour que l'administrateur principal puisse les
// cloisonner un par un. Depuis que voitLesDeuxEspaces() ne répond vrai que
// pour l'administrateur PRINCIPAL, cette liste est vide par construction :
// plus personne ne traverse, il n'y a donc plus rien à signaler ni à
// corriger. Le pouvoir « act_voir_tout » qu'elle interrogeait a disparu de
// ACTIONS_POUVOIR pour la même raison — il ne commandait plus rien.

// ⚠ RELEVÉ PAR TIMO (29/08/2026, capture des Paramètres) : « nous sommes
// dans les paramètres du RÉEL… toutes les boutiques et utilisateurs ne sont
// pas cloisonnés pour chaque espace ». Il voyait DFORMATION et AFORMATION
// dans la liste des boutiques alors que son sélecteur était sur « réel », et
// la même chose dans 👥 Utilisateurs.
//
// Ces deux écrans lisaient `db.boutiques` et `db.users` BRUTS. Le
// cloisonnement avait été posé partout où l'on compte de l'argent — pas dans
// les deux écrans d'administration, qui sont pourtant ceux où l'on se trompe
// le plus facilement de cible.
//
// La règle est la même que partout : la BOUTIQUE d'un compte prime sur son
// drapeau (estCompteFormation), et l'espace regardé décide.
export const utilisateursDeLEspace = (db, profile, liste) => {
  const espace = espaceDuCompte(db, profile);
  return (liste || db.users || []).filter((u) => estCompteFormation(db, u) === espace);
};

export const comptesEspaceIncoherent = (db) =>
  (db.users || []).filter((u) => {
    if (!u.boutique || u.role === "client" || u.actif === false) return false;
    const b = (db.boutiques || []).find((x) => x.nom === u.boutique);
    return !!b && !!b.formation !== !!u.formation;
  });

// Qui a le droit de voir (et de toucher) les DEUX espaces à la fois :
// l'administrateur PRINCIPAL, et personne d'autre.
// ⚠ RÈGLE POSÉE PAR TIMO (26/08/2026), mot pour mot : « je suis le seul
// admin principal qui peut voir les 2 espaces à la fois. Le reste, soit tu
// es admin formation, soit admin réel ».
//
// Avant, la dérogation était accordée à TOUT compte administrateur, via le
// pouvoir act_voir_tout — actif par défaut. « Voir tout » voulait donc dire
// « voir les deux espaces », ce qui n'a jamais été l'intention : ce pouvoir
// sert à voir toutes les BOUTIQUES de son espace, pas à traverser le mur
// entre le réel et l'entraînement.
//
// Conséquence assumée, et c'est le fond de la demande : un administrateur
// autre que le principal appartient à UN espace et un seul. Il n'y voit que
// ses boutiques, n'y crée que ses données, et le verrou d'écriture — qui lui
// rendait la main jusqu'ici — s'applique désormais à lui comme à tout le
// monde.
export const voitLesDeuxEspaces = (db, profile) => estAdminPrincipal(db, profile);

// ⚠ Séparation formation/réel PAR COMPTE (demande Timo, suite au drapeau
// formation déjà posé sur les boutiques) : un compte marqué formation ne
// voit QUE les boutiques de formation, un compte réel ne voit QUE les
// vraies. Utilisée par BoutiqueTabs, remplace l'accès direct à db.boutiques
// dans TOUT sélecteur de boutique — sélecteur de vente, de caisse à débiter,
// de destination de transfert ou de ravitaillement.
// ============ « JE REGARDE LE RÉEL » ou « JE REGARDE L'ENTRAÎNEMENT » ============
//
// ⚠ DEMANDE TIMO (26/08/2026). Après la correction de la fuite, il a
// remarqué l'incohérence qui restait : « en gros même les boutiques
// formation dans stock n'apparaissent pas si je n'ai pas appuyé sur
// formation ? ». Non — le sélecteur ne commandait que deux écrans de
// synthèse ; partout ailleurs ses boutiques d'entraînement restaient
// mélangées aux vraies.
//
// Il devient donc UN SEUL RÉGLAGE, en haut de l'application, qui commande
// TOUS les écrans : onglets de boutique, listes, chiffres. En « Réels »,
// l'entraînement disparaît complètement ; en « Entraînement », on ne voit
// que lui.
//
// ⚠ IL NE CONCERNE QUE LES COMPTES QUI VOIENT DÉJÀ LES DEUX ESPACES —
// c'est-à-dire vous. Il ne donne AUCUN droit nouveau : il ne fait que
// choisir, dans ce qu'un compte a déjà le droit de voir, ce qu'il affiche.
// Un compte placé en formation n'est pas concerné : il reste en formation.
//
// ⚠ JAMAIS ACTIF AU DÉMARRAGE. On ne doit pas ouvrir l'application et lire
// des chiffres fictifs en les croyant vrais. Le réglage vit le temps de la
// session et repart toujours sur « Réels ».
//
// Même mécanisme que setColors (lib/core.js) : une valeur de module, posée
// par App.jsx, que tous les écrans consultent sans avoir à se la passer de
// main en main sur dix niveaux.
let regardeFormation = false;
export const setRegardeFormation = (v) => { regardeFormation = !!v; };
export const regardeLaFormation = () => regardeFormation;

// ---- LE RÉGLAGE, MÉMORISÉ PAR PERSONNE ----
// ⚠ Posé ICI et non dans App.jsx (29/08/2026) : depuis que le sélecteur vit
// dans ⚙ Paramètres, DEUX endroits l'écrivent. Deux copies de la même clé,
// c'est deux occasions de diverger — et une divergence, ici, ferait travailler
// quelqu'un dans un espace tout en lui en affichant un autre.
export const CLE_REGARDE = "bmi_regarde_formation";

export const lireEspaceRegarde = (idUtilisateur) => {
  if (!idUtilisateur) return false;
  try { return localStorage.getItem(`${CLE_REGARDE}:${idUtilisateur}`) === "1"; }
  catch { return false; }   // navigation privée : on repart du réel
};

export const memoriserEspaceRegarde = (idUtilisateur, v) => {
  if (!idUtilisateur) return;
  try { localStorage.setItem(`${CLE_REGARDE}:${idUtilisateur}`, v ? "1" : "0"); }
  catch { /* navigation privée */ }
};

// ⚠ CHANGER D'ESPACE RECHARGE LA PAGE (demande Timo, 29/08/2026) : « je
// préfère que le basculement actualise la page en même temps, plutôt que
// d'attendre 20 secondes ».
//
// Pourquoi c'était lent : les écrans déjà visités restent montés en veille
// (voir `ongletsVisites` dans App.jsx, choix fait pour que revenir sur un
// onglet soit instantané). Au basculement, ils ne se reconstruisaient qu'au
// fil des re-rendus — d'où l'impression que l'application traînait.
//
// Le rechargement est SANS RISQUE pour les données : tout ce qui n'est pas
// encore parti au serveur vit dans la file d'attente (IndexedDB, voir
// db.js), qui survit au rechargement et repart toute seule.
export const changerEspaceRegarde = (idUtilisateur, v) => {
  memoriserEspaceRegarde(idUtilisateur, v);
  setRegardeFormation(v);
  if (typeof window !== "undefined") window.location.reload();
};

export const boutiquesVisibles = (db, profile, liste) => {
  // ⚠ Un compte qui voit les deux espaces n'affiche plus les deux EN MÊME
  // TEMPS : il affiche celui qu'il regarde. C'est ce qui débarrasse les
  // onglets de boutique des boutiques d'entraînement quand on travaille.
  //
  // ⚠ MAIS L'ESPACE DU COMPTE PASSE AVANT LE RÉGLAGE. Un administrateur
  // PLACÉ en formation y reste, même si le réglage dit « réel » — sinon on
  // rouvrirait exactement la fuite corrigée une heure plus tôt, par une
  // autre porte. Le banc l'a attrapé à la première exécution.
  const monEspace = estCompteFormation(db, profile)
    ? true
    : (voitLesDeuxEspaces(db, profile) ? regardeFormation : false);
  return liste.filter((b) => !!b.formation === monEspace);
};

// ⚠ TROU TROUVÉ LE 25/08/2026, à la question de Timo « transfert entre
// boutique réel et formation possible ? ». Réponse mesurée : OUI, et pour
// SON compte.
//
// La cause est la même que celle de la présélection d'articles, corrigée le
// matin même : le code demandait « quelles boutiques ce compte a-t-il le
// droit de VOIR ? ». Comme l'administrateur principal voit les deux espaces
// (dérogation « tous »), toutes les boutiques lui étaient proposées comme
// destination — y compris celles d'entraînement. Et verifierEcritureEspace
// ne s'y oppose pas : il rend la main dès qu'un compte voit les deux espaces.
//
// Conséquence si le geste était fait : 3 batteries sortaient du stock RÉEL
// (donc de la valeur d'inventaire et des marges) et réapparaissaient dans une
// boutique d'entraînement. Aucune vente, aucune dépense, aucune trace
// comptable — de la marchandise qui s'évapore proprement.
//
// La bonne question n'est pas « qu'est-ce que ce compte peut voir » mais
// « OÙ VA LA MARCHANDISE ». Voir les deux espaces permet de travailler dans
// l'un puis dans l'autre ; jamais de les relier.
export const boutiquesDuMemeEspace = (db, profile, liste, boutique) => {
  const visibles = boutiquesVisibles(db, profile, liste);
  const depart = (db.boutiques || []).find((b) => b.nom === boutique);
  // Boutique de départ inconnue (écran ouvert pendant la synchronisation) :
  // on ne propose rien plutôt que n'importe quoi.
  if (!depart) return [];
  return visibles.filter((b) => !!b.formation === !!depart.formation);
};

// Le refus au moment du geste, en plus du filtrage de la liste. Une liste
// filtrée n'est qu'un AFFICHAGE : on a déjà vu (cloisonnement, lot 2) qu'un
// affichage ne protège rien dès qu'un autre chemin mène au même endroit.
// Renvoie un message si le mouvement traverse les deux espaces, sinon null.
export const refusMouvementEntreEspaces = (db, depart, arrivee) => {
  const a = (db.boutiques || []).find((b) => b.nom === depart);
  const z = (db.boutiques || []).find((b) => b.nom === arrivee);
  if (!a || !z) return null;
  if (!!a.formation === !!z.formation) return null;
  const nomEspace = (b) => (b.formation ? "entraînement" : "réel");
  return `🚫 Mouvement impossible : « ${depart} » est une boutique ${nomEspace(a)} et « ${arrivee} » une boutique ${nomEspace(z)}.\n\n`
    + `La marchandise réelle et celle d'entraînement ne doivent jamais se mélanger : sinon du stock réel disparaîtrait de votre inventaire sans aucune trace comptable.`;
};

// La boutique proposée par défaut à l'ouverture d'un écran.
// ⚠ Ne retombe JAMAIS sur db.boutiques[0] : c'était le repli historique de
// sept écrans, et il désignait la PREMIÈRE boutique de la base — donc une
// vraie — dès que la liste visible était vide (compte de formation avant
// qu'une boutique d'entraînement n'existe, ou l'inverse). La rangée
// d'onglets étant alors vide, rien ne signalait l'erreur, mais l'écran
// écrivait bel et bien dans la boutique de repli. On renvoie "" : chaque
// écran affiche alors <AucuneBoutique/> au lieu d'un formulaire piégé.
//
// ⚠ DEMANDE TIMO (25/08/2026) : « NE JAMAIS CHANGER DE BOUTIQUE APRÈS UNE
// SÉRIE D'ACTUALISATIONS DE LA PAGE ».
//
// Ce qui se passait : le choix de la boutique ne vivait QUE dans la mémoire
// vive de la page. Au moindre rechargement — F5, le bouton « Nouvelle
// version — recharger », un téléphone qui met l'application en veille, le
// redémarrage de l'application Windows — ce choix disparaissait et les
// écrans repartaient sur LA PREMIÈRE BOUTIQUE DE LA LISTE, en silence.
// L'utilisateur n'avait pas changé de boutique : l'application l'avait
// déplacé. C'est la cause du stock d'un magasin saisi dans un autre, et le
// même défaut touchait Ventes, Caisse, Dépenses et Dettes.
//
// La boutique choisie est donc mémorisée sur l'appareil, PAR COMPTE (deux
// personnes sur le même téléphone n'héritent pas de l'onglet l'une de
// l'autre), et retrouvée au rechargement.
const CLE_BOUTIQUE = "bmi_boutique";

// ⚠ UNE MÉMOIRE PAR ÉCRAN (choix de Timo, 25/08/2026 — « mémoire par écran
// c'est mieux »). La clé porte donc trois choses : le compte, et l'écran.
// Conséquence voulue : la boutique où vous encaissez (Ventes) et celle où
// vous rangez le stock (Stocks) sont deux réglages distincts, et aucun des
// deux ne bouge parce que vous avez travaillé dans l'autre.
//
// Un écran jamais utilisé n'a pas de mémoire : il ouvre sur la boutique par
// défaut, exactement comme avant.
const cleDe = (profile, ecran) => `${CLE_BOUTIQUE}:${profile.id}:${ecran || "general"}`;

// ⚠ Le stockage du navigateur n'existe pas partout où ce fichier est chargé
// (bancs d'essai sous Node, rendu hors navigateur). Toute lecture et toute
// écriture sont donc protégées : au pire on ne mémorise rien, on ne casse
// jamais rien.
export const boutiqueMemorisee = (profile, ecran) => {
  if (!profile?.id) return "";
  try { return localStorage.getItem(cleDe(profile, ecran)) || ""; }
  catch { return ""; }
};

export const memoriserBoutique = (profile, ecran, nom) => {
  if (!profile?.id || !nom) return;
  try { localStorage.setItem(cleDe(profile, ecran), String(nom)); }
  catch { /* navigation privée, stockage plein : sans conséquence */ }
};

// `options.ecran`    : quel écran demande — c'est lui qui a sa propre mémoire.
// `options.permises` : la liste dans laquelle la boutique doit se trouver.
//                      Par défaut les boutiques de vente — mais l'écran
//                      Stocks travaille AUSSI dans les magasins (dépôts) et
//                      doit pouvoir retrouver le sien.
export const boutiqueParDefaut = (db, profile, options = {}) => {
  const visibles = boutiquesVisibles(db, profile, options.permises || boutiquesVente(db));
  // ⚠ La boutique mémorisée ne court-circuite JAMAIS le cloisonnement ni la
  // liste autorisée : elle n'est retenue que si elle est encore visible pour
  // ce compte. Une boutique supprimée, ou une vraie boutique mémorisée avant
  // qu'un compte ne passe en formation, est simplement ignorée.
  const memo = boutiqueMemorisee(profile, options.ecran);
  if (memo && visibles.some((b) => b.nom === memo)) return memo;
  return visibles[0]?.nom || "";
};

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
export const boutiqueRetenue = (db, profile, choisie, options = {}) => {
  if (profile?.boutique) return profile.boutique;
  const visibles = boutiquesVisibles(db, profile, db.boutiques || []);
  if (choisie && visibles.some((b) => b.nom === choisie)) return choisie;
  return boutiqueParDefaut(db, profile, options);
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
// ⚠ FUITE MESURÉE LE 26/08/2026, sur remarque de Timo (« un admin de
// formation, lui, voit clairement ces écrans »).
//
// L'ancienne règle disait : « si le compte est en formation ET qu'il ne voit
// pas les deux espaces, montre-lui la formation ; sinon, le réel ». Or TOUT
// compte administrateur voit les deux espaces — c'est le pouvoir
// act_voir_tout, actif par défaut. Un administrateur placé DANS la formation
// ne remplissait donc jamais la première condition et tombait dans le
// « sinon » : il voyait le CHIFFRE D'AFFAIRES, les dépenses, les dettes et
// les marges RÉELS de l'entreprise. Le vendeur stagiaire, lui, était
// correctement cloisonné — c'est ce qui rendait le défaut visible.
//
// LA RÈGLE CORRIGÉE : L'ESPACE DU COMPTE PRIME SUR SES POUVOIRS. Voir les
// deux espaces est une dérogation qui n'a de sens que pour quelqu'un qui
// travaille dans le RÉEL. Un compte placé dans la formation voit la
// formation, quels que soient ses galons — ils ne le sortent pas de son bac
// à sable.
//
// `voirFormation` : le sélecteur réservé à l'administrateur PRINCIPAL, qui
// lui permet de consulter volontairement les chiffres d'entraînement. Il
// n'est jamais actif par défaut — on ne doit pas ouvrir l'application et
// lire des chiffres fictifs en les croyant vrais.
export const filtreEspaceAffichage = (db, profile, voirFormation = regardeFormation) => {
  const f = boutiquesFormation(db);
  const enFormation = afficheChiffresFormation(db, profile, voirFormation);
  return (x) => (enFormation ? f.has(x?.boutique) : !f.has(x?.boutique));
};

// Vrai quand l'écran doit afficher les chiffres de l'ESPACE FORMATION.
export const afficheChiffresFormation = (db, profile, voirFormation = regardeFormation) =>
  estCompteFormation(db, profile) || (!!voirFormation && voitLesDeuxEspaces(db, profile));

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

// ============ RETOURS SOUS GARANTIE — ÉCHANGE D'UN ARTICLE DÉFECTUEUX ============
// Demande Timo (31/08/2026) : « comment faire pour que le système puisse
// sortir le produit sans être facturé, ou partiellement facturé — mais
// savoir que c'est suite à un retour, pas une vente classique ».
//
// TOUT PASSE PAR LES AJUSTEMENTS, JAMAIS PAR UNE VENTE :
//   • la sortie de l'article de remplacement est un ajustement NÉGATIF
//     (le stock vendable baisse) — donc AUCUN chiffre d'affaires, AUCUNE
//     commission, aucun reçu de vente ;
//   • l'article défectueux rendu entre dans un « stock SAV » à part —
//     un ajustement de quantité NULLE (qte: 0, le compte est dans
//     qte_sav) : il n'entre JAMAIS dans le stock vendable, personne ne
//     peut revendre un article en panne. De là, il finit « renvoyé au
//     fournisseur » (garantie fabricant) ou « au rebut » — les deux,
//     a tranché Timo ;
//   • si des frais sont facturés (déplacement du technicien,
//     main-d'œuvre, décote selon l'âge — ses trois cas), une DETTE
//     classique est créée pour CE montant-là et rien d'autre : elle suit
//     le circuit éprouvé des dettes (versements, échéancier, caisse).
//     Le montant est celui SAISI — jamais déduit du prix de l'article.
//
// Le tout est relié par une même référence (RET-…) et à la vente
// d'origine (vente_id) : on saura toujours que cette sortie est un
// retour. Le coût réel des garanties se mesure avec coutGarantie().
export const TYPE_ECHANGE_GARANTIE = "echange_garantie";
export const TYPE_RETOUR_DEFECTUEUX = "retour_defectueux";

// Construit les écritures d'un retour. Renvoie { erreur } si le geste est
// impossible, sinon { ajustements: [sortie, sav], dette|null, ref }.
// Fonction PURE : elle ne modifie rien, l'écran fait le save().
export const construireRetour = (db, vente, choix, profile) => {
  const { produit_id, qte, motif, montantFacture, detailFacture } = choix || {};
  const ligne = lignesVente(vente).find((l) => l.produit_id === produit_id && !l.hors_boutique);
  if (!ligne) return { erreur: "Cet article ne figure pas sur cette vente." };
  const n = Math.floor(Number(qte || 0));
  if (!(n >= 1 && n <= Number(ligne.qte || 0))) {
    return { erreur: `Quantité invalide : cette vente porte ${ligne.qte} exemplaire(s) de cet article.` };
  }
  if (!String(motif || "").trim()) return { erreur: "Indiquez le motif du retour (la panne constatée)." };
  const produit = (db.produits || []).find((p) => p.id === produit_id);
  if (!produit) return { erreur: "L'article n'existe plus dans le stock — impossible de préparer l'échange." };
  if (stockActuel(db, produit) < n) {
    return { erreur: `Stock insuffisant pour l'échange : il reste ${stockActuel(db, produit)} « ${produit.nom} » à ${produit.boutique}. Ravitaillez d'abord.` };
  }
  // ⚠ Le montant facturé est celui que l'administrateur SAISIT (déplacement,
  // main-d'œuvre, décote) — jamais calculé depuis le prix de l'article.
  const montant = Math.max(0, Math.round(Number(montantFacture || 0)));
  const ref = "RET-" + uid().slice(0, 8).toUpperCase();
  const sortie = {
    id: uid(), date: today(), produit_id, boutique: vente.boutique, qte: -n,
    type: TYPE_ECHANGE_GARANTIE, ref, vente_id: vente.id,
    motif: `Échange garantie (${ref}) — ${String(motif).trim()}`,
    par: profile?.nom || "?", autorise_par: profile?.nom || "?",
    // Le prix d'achat est photographié AU MOMENT de l'échange : c'est lui
    // qui mesure le coût de la garantie, même si le prix change ensuite.
    prix_achat: Number(produit.prix_achat || 0),
  };
  const sav = {
    id: uid(), date: today(), produit_id, boutique: vente.boutique,
    qte: 0, qte_sav: n, article: produit.nom,
    type: TYPE_RETOUR_DEFECTUEUX, statut: "en_sav", ref, vente_id: vente.id,
    motif: `Défectueux rendu — ${String(motif).trim()}`,
    par: profile?.nom || "?",
  };
  const dette = montant > 0 ? {
    id: uid(),
    client_user_id: compteClientPour(db, vente.tel, vente.client),
    numero: prochainNumeroDette(db, vente.boutique), date: today(),
    boutique: vente.boutique, client: vente.client || "", tel: vente.tel || "",
    motif: `SAV ${ref} — ${String(detailFacture || "frais d'échange").trim()}`,
    montant, paye: 0, paiements: [], par: profile?.nom || "?", retour_ref: ref,
  } : null;
  return { ajustements: [sortie, sav], dette, ref, produit };
};

// Les articles défectueux encore en attente de sort (renvoi ou rebut).
export const retoursEnSav = (db) => (db.ajustements || [])
  .filter((a) => a.type === TYPE_RETOUR_DEFECTUEUX && (a.statut || "en_sav") === "en_sav");

// Ce que les échanges sous garantie ont coûté (au prix d'achat photographié),
// sur une période. `filtre` = le filtre d'espace de l'écran appelant.
export const coutGarantie = (db, a, b, filtre = () => true) => (db.ajustements || [])
  .filter((x) => x.type === TYPE_ECHANGE_GARANTIE && filtre(x))
  .filter((x) => !a || !b || (x.date >= a && x.date <= b))
  .reduce((s, x) => s + (-Number(x.qte || 0)) * Number(x.prix_achat || 0), 0);

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
  // Le comptable ne tient qu'une seule caisse, RÉELLE, sans équivalent
  // d'entraînement. On ne la propose donc que si l'on travaille dans le réel.
  // ⚠ La condition regardait l'espace du COMPTE (« estCompteFormation »), pas
  // celui qu'on REGARDE : l'administrateur principal se la voyait proposer
  // même en formation, et une dépense d'entraînement pouvait débiter la vraie
  // caisse du comptable — que le verrou de cloisonnement laisse passer,
  // justement parce qu'elle n'a pas de jumelle (relevé le 29/08/2026).
  const options = espaceDuCompte(db, profile) ? noms : [...noms, NOM_CAISSE_COMPTABLE];
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
// ⚠ DOUBLE PAIEMENT (corrigé en 2.100.36) — rien ne vérifiait qu'une prime
// n'était pas DÉJÀ payée. Deux chemins mènent ici (l'administrateur depuis
// 🏠 Clients installés, le vendeur depuis 💰 Primes remises) et l'application
// fonctionne hors ligne : deux personnes, ou deux appareils, pouvaient régler
// la même part. La fiche du chantier finissait correcte — une seule mention
// « payée » — mais DEUX dépenses étaient créées, et la caisse débitée deux
// fois sans que rien ne le signale.
// On relit donc l'état RÉEL de la part dans la base au moment du paiement,
// jamais celui affiché à l'écran (qui peut dater de la dernière synchro).
export function primeDejaPayee(db, c, e) {
  const chantier = (db.clients_installes || []).find((x) => x.id === c.id);
  const part = (chantier?.equipe || []).find((y) => y.user_id === e.user_id);
  return !!part?.paye;
}

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
      // Un contrat existe s'il est signé à l'écran (image) OU sur papier
      // (contrat_papier, original archivé à la boutique — 04/09/2026).
      if ((d.contrat_signature || d.contrat_papier) && (!commercial || d.par === commercial) && (!payeSeulement || d.statut === "paye")) out.push({ client: u, devis: d });
    }
  }
  return out.sort((a, b) => (b.devis.contrat_date_signature || "").localeCompare(a.devis.contrat_date_signature || ""));
}

// L'espace à passer aux fonctions ci-dessus pour le compte connecté :
// undefined quand il a le droit de voir les deux (l'administrateur
// PRINCIPAL, et lui seul), sinon son propre espace.
// ⚠ Suit le même réglage : en « Réels », un administrateur ne se voit plus
// proposer les fournisseurs ni les commerciaux d'entraînement. Sans cela,
// les onglets de boutique seraient propres mais les listes resteraient
// mélangées — l'incohérence aurait simplement changé d'endroit.
export const espaceDuCompte = (db, profile) =>
  estCompteFormation(db, profile)
    ? true
    : (voitLesDeuxEspaces(db, profile) ? regardeFormation : false);

// Marque à poser sur tout enregistrement qui n'appartient à AUCUNE boutique
// (devis, compte client, prospect) et que le cloisonnement par boutique ne
// peut donc pas rattraper.
// ⚠ RELEVÉ PAR TIMO (18/08/2026) — l'espace était déduit de QUI VOUS ÊTES,
// jamais de LA BOUTIQUE DANS LAQUELLE VOUS TRAVAILLEZ.
//
// Pour tous les employés, les deux se confondent : un vendeur de FORMA1
// EST un compte de formation. Mais l'administrateur, lui, voit les deux
// espaces — il n'est donc ni l'un ni l'autre, et l'application le
// considérait comme RÉEL quelle que soit la boutique affichée à l'écran.
//
// Conséquence : l'administrateur qui s'entraînait sur une boutique de
// formation créait de VRAIS clients et de VRAIS devis, qui allaient
// ensuite polluer ses contrats, ses relances et ses chiffres réels. Le
// cloisonnement entier était contourné par la seule personne qui peut
// travailler des deux côtés.
//
// La boutique de travail fait donc foi quand elle est connue. À défaut
// (écran sans boutique), on retombe sur l'espace du compte, comme avant.
export const marqueEspace = (db, profile, boutique) => {
  if (boutique) return estBoutiqueFormation(db, boutique) ? { formation: true } : {};
  // ⚠ CORRIGÉ LE 26/08/2026 — défaut introduit la veille par le sélecteur
  // « je regarde ». Cette marque s'appuyait sur QUI VOUS ÊTES ; depuis que
  // l'administrateur peut regarder l'entraînement, elle doit s'appuyer sur
  // OÙ VOUS TRAVAILLEZ. Sans ce changement, un client créé en regardant la
  // formation partait dans les VRAIES données — et disparaissait de l'écran
  // dans la seconde, puisque l'affichage, lui, suivait déjà le sélecteur.
  return espaceDuCompte(db, profile) ? { formation: true } : {};
};

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
// ⚠ CERTAINES DÉPENSES NE DOIVENT PAS ÊTRE SUPPRIMÉES D'ICI (audit du
// 29/08/2026). Un virement de salaire s'annule depuis 👥 Utilisateurs
// (« Annuler virement »), qui vérifie d'abord que l'employé n'a PAS confirmé
// l'avoir reçu, et qui retire proprement les DEUX écritures — le versement et
// la retenue de crédit qui l'accompagne. Supprimer la dépense depuis l'écran
// Dépenses contournait ce contrôle : le salaire restait marqué « payé » sur la
// fiche de l'employé alors que l'argent était revenu en caisse.
// Renvoie le message à afficher, ou null si la suppression est permise.
export function refusSuppressionDepense(db, d) {
  if (d.auto === "virement" || d.auto === "retenue") {
    return "🔒 Un virement de salaire ne s'annule pas depuis cet écran.\n\n"
      + "Allez dans 👥 Utilisateurs → la fiche de l'employé → « Annuler virement ». "
      + "Cette porte-là vérifie d'abord qu'il n'a pas déjà confirmé avoir reçu l'argent, "
      + "et retire les deux écritures de caisse ensemble.";
  }
  // ⚠ RÉ-AUDIT DU 29/08/2026 : supprimer la sortie de caisse d'un crédit
  // DÉJÀ PARTIELLEMENT REMBOURSÉ le remettait « en demande »… en gardant les
  // remboursements reçus. Une demande de crédit qui porte de l'argent
  // encaissé n'a aucun sens, et plus personne ne sait ce que l'employé doit.
  // Les retenues sur salaire comptent aussi : appliquerRetenuesCredit les
  // range dans `remboursements` (source « salaire »), un seul contrôle
  // couvre donc les deux chemins.
  if (d.auto === "credit" && d.credit_id) {
    const credit = ((db?.users || []).find((u) => u.id === d.user_id)?.credits || [])
      .find((c) => c.id === d.credit_id);
    if ((credit?.remboursements || []).length > 0) {
      const recu = credit.remboursements.reduce((s, r) => s + Number(r.montant || 0), 0);
      return `🔒 Ce crédit a déjà été remboursé en partie : ${fmt(recu)} reçus`
        + ` (versements ou retenues sur salaire).\n\n`
        + `Supprimer la sortie de caisse le remettrait « en demande » avec de l'argent déjà encaissé dessus — plus personne ne saurait ce que l'employé doit.\n\n`
        + `Si ce crédit est une erreur, annulez d'abord ses remboursements (👥 Utilisateurs → Crédits), puis revenez le supprimer.`;
    }
  }
  return null;
}

// ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026). Le message affiché à la suppression
// promettait : « le statut payé correspondant sera aussi annulé ». C'était
// vrai pour 4 sortes de dépenses sur 10. Pour les six autres, l'application
// annonçait quelque chose qu'elle ne faisait pas — un crédit restait accordé
// alors que la sortie de caisse avait disparu, une avance restait déduite du
// salaire alors que l'argent était revenu.
// Les six sont traitées ci-dessous. `virement` et `retenue`, elles, sont
// refusées en amont (voir refusSuppressionDepense).
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

  // ---- CRÉDIT BMI ACCORDÉ : il redevient une simple demande ----
  // Sans cela, l'employé restait débiteur d'un crédit dont l'argent n'était
  // jamais sorti, et ses échéances continuaient d'être retenues sur salaire.
  if (d.auto === "credit" && d.credit_id) {
    return { users: (db.users || []).map((u) => (u.id === d.user_id
      ? { ...u, credits: (u.credits || []).map((c) => (c.id === d.credit_id
          ? { ...c, statut: "en_attente", montant_accorde: undefined, echeances: [],
              date_decision: undefined, decide_par: undefined, boutique: undefined }
          : c)) }
      : u)) };
  }

  // ---- REMBOURSEMENT DE CRÉDIT : le versement n'a jamais eu lieu ----
  // Les remboursements n'ont pas d'identifiant : on retire CELUI qui
  // correspond à cette écriture — même jour, même montant (la dépense le
  // porte en négatif, l'argent rentrant en caisse). `unefois` garantit qu'on
  // n'en enlève qu'un, même si l'employé a remboursé deux fois la même somme
  // le même jour.
  if (d.auto === "remboursement" && d.credit_id) {
    const cible = Math.abs(Number(d.montant || 0));
    return { users: (db.users || []).map((u) => {
      if (u.id !== d.user_id) return u;
      return { ...u, credits: (u.credits || []).map((c) => {
        if (c.id !== d.credit_id) return c;
        let unefois = false;
        const restants = (c.remboursements || []).filter((r) => {
          if (!unefois && r.date === d.date && Number(r.montant || 0) === cible) { unefois = true; return false; }
          return true;
        });
        const encoreDu = Number(c.montant_accorde || 0) - restants.reduce((s, r) => s + Number(r.montant || 0), 0);
        return { ...c, remboursements: restants,
                 statut: encoreDu > 0 && c.statut === "solde" ? "approuve" : c.statut,
                 date_solde: encoreDu > 0 ? undefined : c.date_solde };
      }) };
    }) };
  }

  // ---- AVANCE SUR SALAIRE : elle ne doit plus être déduite du salaire ----
  // Même principe : pas d'identifiant sur le mouvement, on retire celui du
  // même jour et du même montant, une seule fois.
  if (d.auto === "avance") {
    const cible = Number(d.montant || 0);
    return { users: (db.users || []).map((u) => {
      if (u.id !== d.user_id) return u;
      let unefois = false;
      return { ...u, avances: (u.avances || []).filter((a) => {
        if (!unefois && a.date === d.date && Number(a.montant || 0) === cible) { unefois = true; return false; }
        return true;
      }) };
    }) };
  }

  // ---- COTISATIONS CNSS : rien à annuler ailleurs ----
  // Le paiement CNSS ne pose aucun « statut payé » sur une autre fiche : la
  // dépense EST la trace. La supprimer suffit — et l'écran ne doit donc pas
  // promettre une annulation qui n'a pas lieu d'être (voir aLienAAnnuler).
  return {};
}

// L'avertissement « le statut payé sera aussi annulé » ne doit s'afficher que
// lorsque c'est VRAI. Une case qui ne fait rien, une alerte qui annonce ce
// qu'elle ne fait pas : même défaut, même règle.
export const aLienAAnnuler = (d) =>
  ["commission", "commission_equipe", "commission_ext", "installation",
   "credit", "remboursement", "avance"].includes(d.auto);

// Envoi d'un virement de salaire (utilisé par 👥 Utilisateurs et 💵 Salaires)
export async function envoyerVirementG(db, save, profile, u, moisImpose) {
  if (refuserSaufAdmin(profile, "Envoyer un virement de salaire")) return;
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
// Toutes les évaluations reçues par un employé. Deux emplacements :
//   • u.evaluations — l'ancien : la note était écrite dans la fiche de
//     l'employé noté, PAR le client. Depuis la fermeture de l'annuaire
//     (client-1), le serveur refuse cette écriture — et ce refus bloquait
//     tout le lot d'écritures du client (vécu par Timo, 31/08/2026) ;
//   • evaluations_donnees dans la fiche de chaque CLIENT (par_id désigne
//     l'employé noté) — le nouvel emplacement, que le client a le droit
//     d'écrire puisque c'est SA fiche. Les notes déjà données restent
//     comptées : on additionne les deux.
export const evaluationsDe = (db, u) => [
  ...(u.evaluations || []),
  ...(db?.users || []).flatMap((c) => (c.evaluations_donnees || []).filter((e) => e.par_id === u.id)),
];

// Moyenne d'un employé sur toutes ses évaluations (les deux emplacements).
export const noteMoyenne = (db, u) => {
  const evs = evaluationsDe(db, u);
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
// ⚠ RÈGLE POSÉE PAR TIMO (29/08/2026), après sa question : « un client qui
// n'a pas payé la totalité et qui signe le PV débloque les commissions —
// comment sont-elles calculées, vu que le paiement n'est pas fini ? »
//
// Constat d'alors : la commission se calculait sur le TOTAL de la vente, et
// le seul verrou était la réception. Sur une installation de 1 000 000 F à
// 5 %, un client qui versait 300 000 F et signait son PV rendait exigibles
// les 50 000 F du commercial — alors qu'il restait 700 000 F à encaisser.
// BMI avançait la trésorerie, et si le client ne finissait jamais de payer,
// la commission, elle, était sortie.
//
// Sa décision : **réception ET dette soldée**. Un franc ne sort pas de la
// caisse avant d'y être entré.
//
// ⚠ `db` est FACULTATIF, et ce n'est pas une négligence : sans lui, on
// retrouve exactement le comportement d'avant. Un écran qui oublierait de le
// passer ne planterait pas — il appliquerait l'ancienne règle, en silence.
// C'est pour cela qu'un contrôle du banc vérifie, appel par appel, que tous
// le passent.
export const commissionBloquee = (v, db) => v.commission_a_la_reception === true
  || (db !== undefined && !venteSoldee(db, v));

// ---- À QUEL COMPTE CLIENT APPARTIENT CETTE LIGNE ? ----
// ⚠ VAGUE 2, ÉTAPE 1 (demande Timo, 29/08/2026 : « Lance 1 »). Une dette ou
// une vente ne portait qu'un NOM et un TÉLÉPHONE — du texte. Le serveur ne
// connaît un client que par son identifiant de compte : sans cette marque,
// impossible de lui dire un jour « ne montre à chacun que SES lignes ».
// Cette étape POSE la marque à la création, et ne ferme rien : rien ne
// change pour personne. (Étape 2 : rapprocher l'existant. Étape 3 : le SQL
// de fermeture, que Timo collera.)
//
// Le téléphone d'abord (memeNumero, les 8 derniers chiffres — le plus
// fiable) ; à défaut le nom EXACT, comme le fait déjà la fiche
// d'installation (chargerDepuisVente). Beaucoup de clients de passage n'ont
// pas de compte : null est alors la bonne réponse, pas une erreur.
export const compteClientPour = (db, tel, nomTexte) => {
  const clients = (db?.users || []).filter((u) => u.role === "client" && u.actif !== false);
  if (tel && chiffresTel(tel).length >= 6) {
    const parTel = clients.find((u) => u.tel && memeNumero(u.tel, tel));
    if (parTel) return parTel.id;
  }
  const nom = String(nomTexte || "").trim().toLowerCase();
  if (nom) {
    const parNom = clients.find((u) =>
      (u.nom_complet || u.nom_base || u.nom || "").trim().toLowerCase() === nom);
    if (parNom) return parNom.id;
  }
  return null;
};

// ---- LA DETTE NÉE D'UNE VENTE À CRÉDIT ----
// Le lien est posé à l'encaissement (Ventes.jsx). Les dettes créées AVANT la
// 2.101.19 ne le portent pas : leurs ventes restent donc traitées comme
// avant — payables dès la réception. On ne devine pas les rattachements
// anciens : deviner, en matière d'argent, est une mauvaise idée.
// ⚠ RÉ-AUDIT DU 29/08/2026 — LA VITESSE. La première écriture parcourait
// TOUTE la table des dettes (`.find`) à chaque vente examinée, jusqu'à trois
// fois par vente (bloquée ? pourquoi ? combien reste-t-il ?). Sur 👑 Équipe
// avec des milliers de ventes et de dettes, cela se serait compté en
// secondes un jour.
//
// On construit désormais la table de correspondance vente → dette UNE FOIS
// par état de la base, et on la retrouve tant que la liste des dettes n'a
// pas changé. La clé du cache est le TABLEAU `db.dettes` lui-même : chaque
// save() en fabrique un neuf (jamais de modification en place — c'est la
// règle de toute l'application), donc un tableau identique garantit des
// dettes identiques. WeakMap : quand un ancien état est oublié, son index
// part avec lui, aucune mémoire ne s'accumule.
//
// Même règle que le `.find` d'origine : la PREMIÈRE dette portant ce
// vente_id gagne.
const indexDettesParVente = new WeakMap();
export const detteDeVente = (db, v) => {
  if (!v || !v.id || !Array.isArray(db?.dettes)) return undefined;
  let index = indexDettesParVente.get(db.dettes);
  if (!index) {
    index = new Map();
    for (const d of db.dettes) if (d.vente_id && !index.has(d.vente_id)) index.set(d.vente_id, d);
    indexDettesParVente.set(db.dettes, index);
  }
  return index.get(v.id);
};

// Ce que le client doit ENCORE sur cette vente. 0 s'il a soldé, 0 aussi
// s'il n'y a jamais eu de dette (vente réglée comptant) — l'immense majorité.
export const resteDuSurVente = (db, v) => {
  const d = detteDeVente(db, v);
  return d ? resteAPayer(d) : 0;
};

export const venteSoldee = (db, v) => resteDuSurVente(db, v) === 0;

// ---- LA PART DU PARRAIN, MÊME RÈGLE ----
// Mot pour mot : « pour le parrain, c'est lorsque le client (filleul) a soldé
// sa dette ». Le filleul, ici, c'est le client de CETTE vente : c'est donc la
// dette de cette vente-là qui décide, la même que pour le commercial.
//
// ⚠ ET L'APPORTEUR EXTERNE AUSSI — TRANCHÉ PAR TIMO LE 29/08/2026.
// `v.apporteur` porte deux personnes différentes : le PARRAIN d'un filleul,
// et l'APPORTEUR D'AFFAIRES externe d'une vente ordinaire (le démarcheur qui
// amène un client sans être client lui-même). La règle du solde s'était
// appliquée aux deux par construction ; la question lui a été posée, sa
// réponse : « l'apporteur externe attend le solde comme le parrain ».
// Ce n'est donc plus un effet de bord, c'est la règle.
export const partParrainBloquee = (v, db) => !!(v.apporteur && v.apporteur.a_la_reception)
  || (db !== undefined && !venteSoldee(db, v));

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

// ---- RATTRAPAGE DES COMMISSIONS GELÉES SUR CHANTIER DÉJÀ RÉCEPTIONNÉ ----
// ⚠ Défaut trouvé lors de la revue de l'Espace client (18/08/2026), le plus
// grave de la revue écran par écran : les deux chemins de SIGNATURE du PV —
// dans l'app comme sur bmitogo.com — marquaient le chantier « réceptionné »
// sans jamais débloquer les commissions. Et le rattrapage J+7 ne regardant
// que les chantiers encore « terminés », il sautait ceux-là : la commission
// du commercial et la part du parrain restaient gelées POUR TOUJOURS.
// Le client qui faisait bien les choses (signer) privait son commercial de
// sa commission ; celui qui ignorait le PV 7 jours la débloquait.
//
// Cette fonction rend les chantiers déjà réceptionnés dont la vente porte
// encore un gel : le déblocage est rejoué pour eux. Elle couvre les DEUX
// chemins de signature (celui du site compris, qu'aucun code de l'app ne
// peut corriger) et tous les chantiers signés PAR LE PASSÉ. Idempotente :
// une vente débloquée n'est jamais resélectionnée.
export const chantiersAReconcilier = (db, profile) =>
  chantiersDeMonEspace(db, profile).filter((c) => {
    if (statutChantier(c) !== "receptionne" || !c.vente_id) return false;
    const v = (db.ventes || []).find((x) => x.id === c.vente_id);
    if (!v) return false;
    return v.commission_a_la_reception === true
      || !!(v.apporteur && v.apporteur.a_la_reception && Number(v.apporteur.montant || 0) > 0);
  });

// ⚠ Demande Timo : la commission se calcule sur le CHIFFRE D'AFFAIRES réel de
// la vente (caVente), pas sur le montant total payé par le client — un
// article « hors boutique » ou déjà compté lors d'une vente antérieure (voir
// Ventes.jsx « Transformer en devis ») n'ouvre droit à AUCUNE commission.
export const commissionBrute = (v, taux) => {
  // ⚠ On rajoute EXACTEMENT la part de rabais que caVente vient de retirer
  // (rabaisImpute), pas le rabais brut : sur un panier mêlant articles de la
  // boutique et articles « hors boutique », les deux diffèrent, et la base de
  // calcul serait faussée.
  const base = caVente(v) + rabaisImpute(v); // total avant le rabais du commercial
  return Math.max(0, Math.round((base * Number(taux || 0)) / 100) - Number(v.rabais || 0));
};

export const commissionVente = (v, taux, db) => (commissionBloquee(v, db) ? 0 : commissionBrute(v, taux));

// Ce qui est gagné mais pas encore exigible : réception des travaux, PUIS
// solde de la dette du client.
export const commissionEnAttente = (v, taux, db) => (commissionBloquee(v, db) ? commissionBrute(v, taux) : 0);

// Pourquoi cette commission est-elle retenue ? L'écran doit le DIRE : « en
// attente de réception » et « le client doit encore 700 000 F » n'appellent
// pas la même action de la part de Timo.
export const motifBlocageCommission = (v, db) => {
  if (v.commission_a_la_reception === true) return "reception";
  if (db !== undefined && !venteSoldee(db, v)) return "paiement";
  return null;
};

// Commission d'une personne sur une vente : seul le COMMERCIAL supporte le rabais
// qu'il a lui-même offert. Le responsable associé, lui, n'a pas à le payer.
//
// Le blocage « réception » est déjà appliqué par commissionVente ci-dessus.
export const commissionPour = (v, nom, taux, db) => (v.commercial === nom
  ? commissionVente(v, taux, db)
  : (commissionBloquee(v, db) ? 0 : Math.round((caVente(v) * Number(taux || 0)) / 100)));

// ---- CE QUI A DÉJÀ ÉTÉ VERSÉ (et non « ce qu'on aurait versé ») ----
// La colonne « Déjà payé » de 👑 Mon équipe RECONSTITUAIT le montant à partir
// du chiffre d'affaires et du taux du moment. Deux erreurs : elle oubliait le
// rabais offert par le commercial et les lignes hors boutique (donc un montant
// trop élevé), et elle changeait rétroactivement dès qu'on modifiait le taux
// d'un commercial — l'argent sorti de la caisse, lui, n'avait pas bougé.
// Depuis 2.100.35 le paiement INSCRIT le montant versé sur la vente ; on le
// relit. Les paiements plus anciens n'ont pas cette trace : on retombe sur la
// formule complète (commissionBrute, rabais déduit), qui reste bien plus juste
// que l'ancien CA × taux.
export const montantVerse = (v, taux) =>
  v?.commission_montant != null ? Number(v.commission_montant) : commissionBrute(v, taux);

// Même principe pour la part d'un chef d'équipe sur la vente d'une recrue.
export const montantVerseEquipe = (v, tauxFilleul, tauxEquipe) =>
  v?.override_montant != null
    ? Number(v.override_montant)
    : Math.round((commissionBrute(v, tauxFilleul) * Number(tauxEquipe || 0)) / 100);

// ---- QUELLES VENTES SONT RÉELLEMENT PAYÉES AUJOURD'HUI ----
// 👑 Mon équipe calculait le MONTANT sur les ventes exigibles, mais tamponnait
// « commission payée » sur TOUTES les ventes non réglées de la période —
// y compris celles dont la commission est gelée jusqu'à la réception de
// l'installation. Résultat : la vente gelée était close sans qu'un franc ne
// soit versé, et le jour où le client réceptionnait, la commission débloquée
// ne réapparaissait jamais. Le commercial la perdait définitivement.
//
// Le montant affiché et la liste tamponnée sortent maintenant de la MÊME
// fonction : ils ne peuvent plus diverger.
export const repartirCommissions = (ventes, taux, db) => {
  const exigibles = [], gelees = [];
  for (const v of ventes || []) (commissionBloquee(v, db) ? gelees : exigibles).push(v);
  // Deux raisons d'être gelée, deux colonnes à l'écran : on les sépare ICI
  // plutôt que dans chaque écran, pour qu'elles ne puissent pas diverger.
  const parMotif = (m) => gelees.filter((v) => motifBlocageCommission(v, db) === m);
  const enReception = parMotif("reception");
  const enPaiement = parMotif("paiement");
  return {
    exigibles, gelees, enReception, enPaiement,
    idsAPayer: exigibles.map((v) => v.id),
    du: exigibles.reduce((s, v) => s + commissionVente(v, taux, db), 0),
    gele: gelees.reduce((s, v) => s + commissionEnAttente(v, taux, db), 0),
    geleReception: enReception.reduce((s, v) => s + commissionBrute(v, taux), 0),
    gelePaiement: enPaiement.reduce((s, v) => s + commissionBrute(v, taux), 0),
    resteClients: enPaiement.reduce((s, v) => s + resteDuSurVente(db, v), 0),
  };
};

// Même règle pour la part d'un CHEF D'ÉQUIPE sur les ventes d'une de ses
// recrues : une vente gelée n'entre jamais dans la liste tamponnée.
// `partParVente` conserve le montant exact versé pour chaque vente : c'est lui
// qui est inscrit sur la vente au paiement, pour que « Déjà payé » relise un
// montant réel au lieu de le reconstituer avec le taux du moment.
// ---- QUI PEUT ÊTRE AFFECTÉ À UN CHANTIER ----
// La liste des techniciens ne regardait aucun espace : on pouvait affecter un
// VRAI technicien à un chantier d'entraînement (et l'inverse). Sa part de
// frais était alors calculée à son nom, et payable depuis une vraie caisse.
// `espaceFormation` est l'espace du CHANTIER (pas celui de la personne qui
// regarde) : c'est lui qui décide, y compris pour l'administrateur.
export const techniciensDeLEspace = (db, liste, espaceFormation) =>
  liste.filter((u) => estCompteFormation(db, u) === !!espaceFormation);

// L'espace d'un chantier : celui de sa boutique quand on peut la retrouver
// (via la vente ou la dette rattachée), sinon celui du compte qui travaille
// dessus — un chantier sans rattachement n'appartient à aucun des deux.
export const espaceDuChantier = (db, c, profile) => {
  const b = c ? boutiqueDuChantier(db, c) : null;
  return b ? estBoutiqueFormation(db, b) : estCompteFormation(db, profile);
};

export const repartirCommissionEquipe = (ventes, tauxFilleul, tauxEquipe, db) => {
  const tx = Number(tauxEquipe || 0);
  let due = 0, versees = 0, gelee = 0;
  const idsAPayer = [], partParVente = {};
  for (const v of ventes || []) {
    if (commissionBloquee(v, db)) { gelee += Math.round((commissionEnAttente(v, tauxFilleul, db) * tx) / 100); continue; }
    if (v.override_payee) { versees += montantVerseEquipe(v, tauxFilleul, tauxEquipe); continue; }
    const part = Math.round((commissionVente(v, tauxFilleul, db) * tx) / 100);
    due += part;
    partParVente[v.id] = part;
    idsAPayer.push(v.id);
  }
  return { due, versees, gelee, idsAPayer, partParVente };
};

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

// ⚠ DEMANDE TIMO (25/08/2026) — LA PRÉSÉLECTION D'UN ARTICLE DÉJÀ CONNU.
//
// Premier essai rejeté par lui : une question à l'ajout, « cet article existe
// déjà dans une autre boutique, est-ce bien la bonne ? ». Ses boutiques
// VENDENT LES MÊMES ÉQUIPEMENTS : l'article déjà présent ailleurs est donc le
// cas NORMAL, pas l'anomalie. Une alerte qui se déclenche sur le cas normal
// n'apprend rien, et habitue à cliquer OK sans lire.
//
// Sa proposition, retenue : « lorsqu'on tape le nom de l'article, s'il est
// déjà enregistré ailleurs, proposer la présélection ». On ne pose plus de
// question, on rend service.
//
// ⚠ CORRIGÉ LE MÊME JOUR : « dans la même boutique, les articles ne sont pas
// proposés ». C'était volontaire de ma part — et c'était une erreur. Voir un
// article DÉJÀ présent ici est justement ce qui évite de le créer deux fois,
// et donc de couper son stock en deux fiches. La proposition couvre
// désormais tout le catalogue de l'espace, boutique en cours comprise ;
// l'écran choisit quoi faire du clic (reprendre la fiche, ou ouvrir la
// correction si l'article est déjà ici).
//
// Renvoie [{ article, boutiques }] — une entrée par nom d'article distinct.
export const articlesSimilaires = (db, profile, boutique, nom, limite = 6) => {
  const cherche = normNom(nom);
  // ⚠ DÈS LA PREMIÈRE LETTRE (demande Timo, 25/08/2026). J'avais mis le seuil
  // à deux lettres pour éviter le bruit — mais taper « C » et ne rien voir
  // donne l'impression que la proposition ne marche pas. Le bruit est réglé
  // autrement : par le CLASSEMENT ci-dessous, qui fait remonter les noms qui
  // COMMENCENT par ce qu'on tape, et par la limite de la liste.
  if (!cherche) return [];
  // ⚠ DEUX FILTRES, ET LES DEUX SONT NÉCESSAIRES.
  //
  // 1. VISIBILITÉ : on ne propose que des boutiques que ce compte a le droit
  //    de voir. Sans ça, un compte d'entraînement verrait les vrais prix
  //    d'achat de l'entreprise.
  //
  // 2. MÊME ESPACE QUE LA BOUTIQUE VISÉE. L'administrateur principal, lui,
  //    voit LES DEUX espaces (dérogation « tous ») : ma première version lui
  //    proposait donc des articles d'ENTRAÎNEMENT, avec leurs prix fictifs
  //    (« vente 2 500 F »), pendant qu'il créait un article dans une VRAIE
  //    boutique. Un clic et un prix d'école entrait dans le stock réel.
  //    La règle qui compte n'est pas « ce que le compte peut voir » mais
  //    « où l'article va être créé ».
  const cible = (db.boutiques || []).find((b) => b.nom === boutique);
  if (!cible) return [];
  const visibles = new Set(
    boutiquesVisibles(db, profile, db.boutiques || [])
      .filter((b) => !!b.formation === !!cible.formation)
      .map((b) => b.nom)
  );
  const parNom = new Map();
  for (const x of db.produits || []) {
    if (!visibles.has(x.boutique)) continue;
    const n = normNom(x.nom);
    if (!n.includes(cherche)) continue;
    // ⚠ La fiche retenue pour un même nom est celle de la boutique EN COURS
    // quand elle existe : c'est elle qu'il faut corriger plutôt que
    // recopier, et c'est elle qui porte les bons prix pour ce point de vente.
    if (!parNom.has(n)) parNom.set(n, { article: x, boutiques: [] });
    const e = parNom.get(n);
    if (x.boutique === boutique) e.article = x;
    e.boutiques.push(x.boutique);
  }
  // ⚠ Le classement fait tout l'intérêt de la première lettre : « C » doit
  // proposer COFFRET et CABLE, pas le premier article qui contient un « c »
  // au milieu d'un mot. Trois rangs :
  //   0 — le nom commence par ce qu'on tape ;
  //   1 — un MOT du nom commence par ce qu'on tape (ex. « 12M » dans
  //       « COFFRET APPARENT 12M ») ;
  //   2 — le reste.
  // À rang égal, ordre alphabétique : la liste ne saute pas d'une frappe à
  // l'autre, ce qui compte quand on clique vite.
  const rang = (a) => {
    const n = normNom(a.nom);
    if (n.startsWith(cherche)) return 0;
    if (n.split(" ").some((mot) => mot.startsWith(cherche))) return 1;
    return 2;
  };
  return [...parNom.values()]
    .sort((x, y) => rang(x.article) - rang(y.article)
      || normNom(x.article.nom).localeCompare(normNom(y.article.nom)))
    .slice(0, limite);
};

// ⚠ QUI PORTE DÉJÀ CE NUMÉRO ? (demande Timo, 25/08/2026)
//
// Le contrôle « ce numéro est-il déjà connu ? » existait dans trois écrans,
// et les trois comparaient les CHIFFRES BRUTS : « +228 90 11 22 33 » et
// « 90112233 » n'étaient donc pas reconnus comme la même personne. On créait
// un doublon sans le savoir — et en parrainage, une deuxième prime était due.
//
// Et plutôt que de laisser l'utilisateur tout saisir avant de se voir refuser
// la création, on PROPOSE : dès qu'il tape le numéro, ceux qui le portent
// déjà s'affichent. Même principe que la présélection d'articles — on ne pose
// pas une question, on rend service.
export const comptesAvecCeNumero = (db, profile, tel, limite = 5) => {
  const cherche = numeroComparable(tel);
  if (cherche.length < 4) return [];
  // ⚠ Cloisonnement : un compte de formation ne doit pas voir les vrais
  // clients, ni l'inverse — même règle que partout ailleurs.
  const espace = espaceDuCompte(db, profile);
  return (db.users || [])
    .filter((u) => u.tel && memeNumero(u.tel, tel))
    .filter((u) => espace === undefined || !!u.formation === espace)
    .slice(0, limite);
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
  // ⚠ DÉFAUT TROUVÉ EN BALAYANT LES LISTES DÉROULANTES (29/08/2026) : la
  // condition était « je vois les deux espaces → je les prends TOUS ». Pour
  // l'administrateur principal, la liste des apporteurs mêlait donc les vrais
  // commerciaux et ceux d'entraînement, quel que soit l'espace regardé — et
  // une vraie vente pouvait être attribuée à un commercial de formation, dont
  // la commission aurait été calculée à son nom.
  // C'est l'espace REGARDÉ qui décide, comme partout ailleurs.
  const monEspace = espaceDuCompte(db, profile);
  const memeEspace = (u) => !!u.formation === monEspace;
  (db.users || []).filter((u) => u.actif !== false && u.role !== "client" && aUnTaux(u) && memeEspace(u))
    .forEach((u) => noms.set(u.nom, { id: u.id, nom: u.nom, taux: Number(u.taux_commission || 0), role: u.role }));
  // Depuis le 19/08/2026 la table `commerciaux` porte SA PROPRE marque
  // d'espace (voir TABLES_PAR_MARQUE). On la lit en priorité ; pour les
  // fiches créées avant, on retombe sur l'espace du compte du même nom,
  // et à défaut la fiche est considérée comme RÉELLE (le doute profite
  // aux vraies données).
  (db.commerciaux || []).filter((c) => c.actif !== false)
    .forEach((c) => {
      const compte = (db.users || []).find((u) => u.nom === c.nom);
      const reference = c.formation !== undefined ? c : (compte || {});
      if (!memeEspace(reference)) return;
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
// ⚠ La caisse TERRAIN existe en DEUX exemplaires depuis le lot 2 Espace
// client : une réelle, une d'entraînement. Sans la seconde, un client de
// FORMATION qui validait un devis « pose seule » créait sa dette dans la
// caisse TERRAIN réelle — geste que le verrou de cloisonnement (et le
// serveur) refusaient à juste titre : l'app proposait ce qu'elle
// interdisait ensuite, exactement la contradiction relevée par Timo sur
// les boutiques de formation.
export const NOM_BOUTIQUE_TERRAIN_FORMATION = "TERRAIN (formation)";
export const boutiqueTerrain = (db, formation = false) =>
  (db.boutiques || []).find((b) => b.terrain && !!b.formation === !!formation) || null;
// Crée la boutique TERRAIN si elle n'existe pas encore — appelé au moment
// où la première fiche "pose seule" en a besoin, pas au démarrage de l'app
// (évite de l'imposer aux installations qui ne l'utiliseront jamais).
export const assurerBoutiqueTerrain = (db, formation = false) => {
  if (boutiqueTerrain(db, formation)) return db;
  const caisse = formation
    ? { id: "b_terrain_formation", nom: NOM_BOUTIQUE_TERRAIN_FORMATION, terrain: true, formation: true, actif: true }
    : { id: "b_terrain", nom: NOM_BOUTIQUE_TERRAIN, terrain: true, actif: true };
  return { ...db, boutiques: [...(db.boutiques || []), caisse] };
};

// ============ SOUHAITS DE L'ÉCRAN DE CONNEXION ============
// ⚠ Demande Timo (20/08/2026) : « du texte qui monte comme les bulles, pour
// souhaiter les joyeux anniversaires aux employés et les joyeuses fêtes de
// fin d'année ».
//
// ⚠ CHOIX DE CONCEPTION — on ne garde que le JOUR et le MOIS, jamais l'année.
// L'écran de connexion s'affiche AVANT que quiconque se connecte : y porter
// une date de naissance complète reviendrait à publier l'âge de chacun. Le
// jour et le mois suffisent pour souhaiter, et peuvent rester sur la fiche
// employé — une date complète, elle, aurait sa place dans la table protégée
// `paie`, que l'écran de connexion ne peut justement pas lire (voir
// lib/paie.js).
//
// Format retenu : "MM-JJ" (ex. "04-12" pour le 12 avril), c'est-à-dire la
// fin d'une date ISO — comparable directement, sans conversion.
export const anniversaireDuJour = (dateDuJour = today()) => String(dateDuJour).slice(5, 10);

// Les messages qui monteront, dans l'ordre d'affichage : les anniversaires du
// jour d'abord, puis les messages libres saisis par l'administrateur.
// Renvoie un tableau vide quand il n'y a rien à souhaiter — l'écran de
// connexion n'affiche alors aucune animation de texte.
export const souhaitsDuJour = (db, dateDuJour = today()) => {
  const b0 = (db?.boutiques || [])[0] || {};
  const libres = String(b0.accueil_messages || "")
    .split("\n").map((t) => t.trim()).filter(Boolean);
  let fetes = [];
  if (b0.accueil_anniversaires === true) {
    const jour = anniversaireDuJour(dateDuJour);
    fetes = (db?.users || [])
      // Les comptes CLIENTS sont exclus : on souhaite aux employés.
      .filter((u) => u.actif !== false && u.role !== "client" && u.anniv && u.anniv === jour)
      .map((u) => `🎂 Joyeux anniversaire ${u.nom_complet || u.nom} !`);
  }
  // Au-delà de six, les messages se chevauchent à l'écran et deviennent
  // illisibles : on garde les premiers, anniversaires en tête.
  return [...fetes, ...libres].slice(0, 6);
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
  // ⚠ RETIRÉ EN 2.101.14 : « act_voir_tout » (voir les deux espaces).
  // Il ne commande plus rien — seul l'administrateur PRINCIPAL traverse le
  // mur formation / réel, et ce n'est pas un pouvoir qu'on accorde, c'est
  // ce qu'il EST. Les fiches qui portent encore « act_voir_tout » dans
  // droits_off ne s'en trouvent pas gênées : un pouvoir inconnu est ignoré.
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

// ============ VAGUE 3 — LES GESTES RÉSERVÉS À UN RÔLE, VÉRIFIÉS DANS LE GESTE ============
// Décisions Timo du 04/09/2026 (docs/inventaire-verrous-employes-2026-09.md).
// Règle : un geste réservé à un rôle le revérifie ICI, dans le geste, pas
// seulement à l'affichage — le serveur appliquera les mêmes règles (vague 3,
// étapes 2 et suivantes), et l'application ne doit jamais proposer un geste
// que le serveur refuserait.
export const ROLES_STOCK = ["magasinier", "gerant", "admin"];        // entrées, ajustements, transferts, inventaire, bons
export const ROLES_CAISSE = ["gerant", "admin"];                     // clôturer la caisse
export const ROLES_FOURNISSEURS = ["gerant", "admin"];               // régler, endetter, supprimer un fournisseur
export const PLAFOND_REMISE_PCT = 3;                                  // au-delà : admin seul
const LIBELLE_ROLE_COURT = { admin: "l'administrateur", gerant: "le gérant", magasinier: "le magasinier",
  vendeur: "le vendeur", commercial: "le commercial", technicien: "le technicien", resp_commercial: "le responsable commercial", comptable: "le comptable" };
export const refuserSaufRoles = (profile, roles, geste) => {
  if (roles.includes(profile?.role)) return false;
  uAlert(`🔒 ${geste} : réservé à ${roles.map((r) => LIBELLE_ROLE_COURT[r] || r).join(", ")}.`);
  return true;
};
export const refuserSaufAdmin = (profile, geste) => refuserSaufRoles(profile, ["admin"], geste);
export const remiseExigeAdmin = (pct) => Number(pct || 0) > PLAFOND_REMISE_PCT;

// ---- Vague 3, étape 3 : LES COMPTES (validée par Timo le 05/09/2026) ----
// Trois niveaux, que le serveur applique lui aussi (securite-5-comptes.sql) :
//   • admin seul : bloquer / réactiver, supprimer un compte, et les « champs
//     de gestion » de la fiche d'un employé (rattachement, taux, identité,
//     paie…) ;
//   • admin PRINCIPAL seul : mot de passe d'un autre compte, transfert du
//     rôle principal, bascule réel ↔ formation ;
//   • le pouvoir « tâches » : assigner, valider ou rouvrir la tâche d'un
//     autre — admin, responsable commercial, commercial, technicien, sauf
//     si ce pouvoir leur a été retiré.
// Chacun garde SA propre fiche pour le quotidien : signature, disponibilité,
// ses tâches, sa demande de crédit, la confirmation de son virement.
export const ROLES_TACHES = ["admin", "resp_commercial", "commercial", "technicien"];
export const refuserSaufAdminPrincipal = (db, profile, geste) => {
  if (estAdminPrincipal(db, profile)) return false;
  uAlert(`🔒 ${geste} : réservé à l'administrateur PRINCIPAL.`);
  return true;
};
export const refuserSaufTaches = (db, profile, geste) => {
  if (ROLES_TACHES.includes(profile?.role) && aDroit(db, profile, "act_taches")) return false;
  uAlert(`🔒 ${geste} : réservé aux comptes qui ont le pouvoir « Assigner des tâches » (administrateur, responsable commercial, commercial, technicien).`);
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

// ⚠ Tables qui n'appartiennent à AUCUNE boutique et que le cloisonnement par
// boutique ne pouvait donc pas rattraper : elles portent leur propre marque
// `formation` (voir marqueEspace), comme les prospects.
//
// TROU RÉEL TROUVÉ LE 19/08/2026, à la question de Timo « est-ce sûr que les
// deux espaces ne se mélangent jamais ? » : un compte de FORMATION pouvait
// enregistrer une commande à crédit chez un VRAI fournisseur — donc gonfler
// sa vraie ardoise — ou supprimer purement et simplement un fournisseur ou un
// commercial réel. Ni l'application ni le serveur ne s'y opposaient.
export const TABLES_PAR_MARQUE = ["fournisseurs", "commerciaux"];

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
  if (voitLesDeuxEspaces(next, profile)) return null;   // l'administrateur principal, et lui seul
  const monEspace = estCompteFormation(next, profile);

  // Une boutique du BON espace, ou une valeur vide/inconnue qu'on laisse
  // passer (rien à cloisonner) — sauf « Chez le comptable » et TERRAIN,
  // deux caisses bien réelles qui n'ont pas d'équivalent d'entraînement.
  const boutiqueRefusee = (nom) => {
    if (!nom) return false;
    const b = (next.boutiques || []).find((x) => x.nom === nom);
    if (!b) return nom === NOM_CAISSE_COMPTABLE ? monEspace : false;
    // Les caisses de terrain suivent la règle commune : la réelle (TERRAIN)
    // n'a pas de drapeau formation, celle d'entraînement l'a — plus besoin
    // du cas particulier « terrain = toujours réel » d'avant le lot 2.
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
      // ⚠ FAILLE 2.100.36 : on ne regardait QUE la boutique d'arrivée. Un
      // compte de formation pouvait donc prendre une ligne RÉELLE (une dette
      // client, une vente…) et la faire basculer dans son espace en
      // réécrivant simplement sa boutique — l'écriture passait, puisque la
      // destination était bien la sienne. La ligne disparaissait alors des
      // comptes réels sans être effacée nulle part.
      // Le chemin n'était pas théorique : l'encaissement d'une « pose seule »
      // (Clients installés) réécrit justement la boutique de la dette à
      // chaque versement.
      // On vérifie donc aussi d'OÙ la ligne vient, pas seulement où elle va.
      if (a && boutiqueRefusee(a.boutique)) return { table: t, boutique: a.boutique, deplacement: true };
    }
    // Suppressions : effacer une ligne de l'autre espace est tout aussi grave.
    for (const a of avant.values()) {
      if (boutiqueRefusee(a.boutique)) return { table: t, boutique: a.boutique, suppression: true };
    }
  }

  // Les tables marquées : mêmes trois cas que ci-dessus (écriture, bascule
  // d'un espace à l'autre, suppression), mais l'appartenance se lit sur la
  // marque de la ligne au lieu de sa boutique.
  for (const t of TABLES_PAR_MARQUE) {
    if (prev && prev[t] === next[t]) continue;
    const avant = new Map((prev?.[t] || []).map((r) => [r.id, r]));
    for (const r of next[t] || []) {
      const a = avant.get(r.id);
      avant.delete(r.id);
      if (a && memeEnregistrement(a, r)) continue;
      if (!!r.formation !== monEspace) return { table: t, marque: true };
      if (a && !!a.formation !== monEspace) return { table: t, marque: true, deplacement: true };
    }
    for (const a of avant.values()) {
      if (!!a.formation !== monEspace) return { table: t, marque: true, suppression: true };
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
    // Même précaution qu'au-dessus : un chantier change d'espace dès qu'on le
    // rattache à une autre vente (ou à une autre dette).
    if (a && boutiqueRefusee(boutiqueDuChantier(prev, a))) {
      return { table: "clients_installes", boutique: boutiqueDuChantier(prev, a), deplacement: true };
    }
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
    fournisseurs: "un fournisseur", commerciaux: "un commercial",
  };
  const geste = infraction.suppression ? "supprimerait"
    : infraction.deplacement ? "ferait basculer dans votre espace" : "écrirait";
  // Les tables marquées n'ont pas de boutique à nommer : le message doit
  // désigner l'enregistrement lui-même, sinon il finissait par « la boutique
  // « ? » », ce qui n'explique rien.
  if (infraction.marque) {
    return `🚫 Opération refusée — cloisonnement formation / réel.\n\n` +
      `Votre compte travaille dans l'espace ${monEspace ? "FORMATION" : "RÉEL"}, mais cette action ${geste} ${LIB[infraction.table] || "un enregistrement"} de l'espace ${monEspace ? "RÉEL" : "FORMATION"}.\n\n` +
      `Rien n'a été enregistré. ${infraction.suppression
        ? "Un enregistrement de l'autre espace ne peut pas être supprimé depuis le vôtre."
        : "Créez le vôtre depuis votre espace : les deux listes sont volontairement séparées."}`;
  }
  return `🚫 Opération refusée — cloisonnement formation / réel.\n\n` +
    `Votre compte travaille dans l'espace ${monEspace ? "FORMATION" : "RÉEL"}, mais cette action ${geste} ${LIB[infraction.table] || "un enregistrement"} ${infraction.deplacement ? "qui appartient à" : "sur"} la boutique « ${infraction.boutique || "?"} », qui appartient à l'espace ${monEspace ? "RÉEL" : "FORMATION"}.\n\n` +
    `Rien n'a été enregistré. ${infraction.deplacement
      ? "Un enregistrement d'un espace ne peut pas être déplacé dans l'autre : il disparaîtrait des comptes auxquels il appartient."
      : "Choisissez une boutique de votre espace, ou demandez à l'administrateur principal de vérifier le rattachement de votre compte."}`;
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

// ---- PRIX DU RAIL DE FIXATION, AU MÈTRE ----
// ⚠ Ce prix était écrit EN DUR dans le code du Dimensionnement (5 500 F) :
// le jour où il changeait, Timo ne pouvait pas le modifier lui-même. C'est un
// prix d'achat au mètre — ça bouge. Il se règle maintenant dans ⚙ Paramètres,
// rangé comme les autres réglages généraux (sur les boutiques, pour ne créer
// aucune nouvelle table Supabase).
// Le repli sur 5 500 F garantit qu'une base qui n'a jamais eu ce réglage
// continue de calculer exactement comme avant.
// ============ DOMAINES DE PRODUITS ET LEURS FAMILLES ============
// ⚠ Demande Timo (18/08/2026) : « dès qu'un domaine est créé dans les
// paramètres, il apparaît dans le dimensionnement — c'est mieux que d'écrire
// en dur solaire, garage, autre ».
//
// Un DOMAINE = un métier (Solaire, Garage, Caméra…). Chaque domaine porte ses
// FAMILLES de produits (Panneaux, Batteries…), qui remplacent la catégorie
// tapée à la main dans le stock — c'est elle qui laissait passer « BATERIE »
// et empêchait l'application de retrouver les articles.
//
// `calcul` dit ce que le domaine sait faire :
//   • "solaire" / "garage" — les calculs métier existants, écrits ligne à
//     ligne avec Timo. On ne peut pas en inventer pour un domaine nouveau.
//   • "libre" — aucun calcul : les familles du domaine, les articles, le
//     devis. C'est ce que fait déjà le volet « Autre » aujourd'hui.
//
// Les familles de Solaire et Garage ci-dessous ne sont PAS inventées : ce
// sont exactement celles que les écrans de dimensionnement cherchent déjà
// (ROLES_EQUIPEMENT dans Solaire.jsx et Garage.jsx).
export const DOMAINES_DEFAUT = [
  { id: "solaire", nom: "Solaire", icone: "☀️", calcul: "solaire",
    familles: ["Panneaux solaires", "Batteries", "Convertisseur", "Régulateur MPPT",
               "Rails de fixation", "Câbles", "Protections / Disjoncteurs", "Accessoires"] },
  { id: "garage", nom: "Garage", icone: "🚪", calcul: "garage",
    familles: ["Moteur / motorisation", "Crémaillère", "Télécommande",
               "Photocellules", "Lampe clignotante", "Déverrouillage manuel",
               "Câbles", "Accessoires"] },
  { id: "autre", nom: "Autre", icone: "📦", calcul: "libre", familles: [] },
];

// Les domaines réglés par l'administrateur, ou ceux d'origine tant qu'il n'y
// a pas touché. Rangés sur les boutiques comme les autres réglages généraux :
// aucune nouvelle table Supabase à créer.
export const domainesDefinis = (db) => {
  const b = (db?.boutiques || []).find((x) => Array.isArray(x.domaines) && x.domaines.length);
  return b ? b.domaines : DOMAINES_DEFAUT;
};

export const domaineParId = (db, id) => domainesDefinis(db).find((d) => d.id === id) || null;

// Les familles d'un domaine — pour remplir les menus du stock.
export const famillesDuDomaine = (db, id) => (domaineParId(db, id)?.familles) || [];

// Toutes les familles, tous domaines confondus (menu de repli).
export const toutesLesFamilles = (db) =>
  [...new Set(domainesDefinis(db).flatMap((d) => d.familles || []))].sort();

// Fabrique un identifiant stable à partir d'un nom saisi : c'est lui qui
// reliera un article à son domaine, même si le nom affiché change ensuite.
export const idDepuisNom = (nom) => String(nom || "")
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);

export const PRIX_RAIL_DEFAUT = 5500;
export const prixRailMetre = (db) => {
  const b = (db?.boutiques || []).find((x) => Number(x.prix_rail) > 0);
  return b ? Number(b.prix_rail) : PRIX_RAIL_DEFAUT;
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
