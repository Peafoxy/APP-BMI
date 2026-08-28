import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Login } from "./screens/Connexion";
import { Dashboard } from "./screens/Dashboard";
import { Ventes } from "./screens/Ventes";
import { NouvelleCommande, CommandesRecues } from "./screens/Commandes";
import { Depenses, ChezComptable } from "./screens/Depenses";
import { Dettes } from "./screens/Dettes";
import { CreerClient, Clients } from "./screens/Clients";
import { Caisse } from "./screens/Caisse";
import { DemandeRavitaillement, DemandesTransfertRecues } from "./screens/Ravitaillement";
import { Stocks } from "./screens/Stocks";
import { BoutiqueTabs } from "./components/SelecteurBoutique";
import { SelecteurArticle } from "./components/SelecteurArticle";
import { CarteChoixPosition } from "./components/Carte";
import { RechercheGlobale } from "./components/RechercheGlobale";
import { Dimensionnement, TYPES_PORTAIL } from "./screens/dimensionnement";
import { TousLesDevis } from "./screens/TousLesDevis";
import { Prospects } from "./screens/Prospects";
import { EspaceClient } from "./screens/EspaceClient";
import { Messagerie, peutVoirFilClient } from "./screens/Messagerie";
import { ClientsInstalles } from "./screens/ClientsInstalles";
import { PrimesRemises } from "./screens/PrimesRemises";
import { PrimesRecues } from "./screens/PrimesRecues";
import { ContratsInstallation } from "./screens/ContratsInstallation";
import { Commerciaux } from "./screens/Commerciaux";
import { MesTaches } from "./screens/MesTaches";
import { Rentabilite } from "./screens/Rentabilite";
import { SalairesAdmin, Salaire } from "./screens/Salaires";
import { MonEquipe } from "./screens/MonEquipe";
import { MaCommission } from "./screens/MaCommission";
import { Fournisseurs } from "./screens/Fournisseurs";
import { Users } from "./screens/Utilisateurs";
import { Historique } from "./screens/Historique";
import { Parametres } from "./screens/Parametres";

// ═══════════ LOT D (2.99.45) : MÉMOÏSATION DES ÉCRANS ═══════════
// Tous les onglets visités restent montés (choix assumé depuis 2.98.99 pour
// préserver les brouillons). Revers : chaque rendu d'App — y compris le
// simple battement de synchronisation toutes les 20 s — re-rendait TOUS les
// écrans visités, avec leurs calculs (stocks, commissions...). memoEcran ne
// re-rend un écran que si une DONNÉE qu'il reçoit a réellement changé.
// Les props FONCTIONS sont ignorées dans la comparaison : App les recrée à
// chaque rendu, mais elles lisent leurs données via dbRef (toujours à jour)
// et via les props comparées ici (profile, db...) — les ignorer est donc
// sans danger, et c'est ce qui rend la mémoïsation efficace.
const propsEcranEgales = (avant, apres) => {
  for (const k of new Set([...Object.keys(avant), ...Object.keys(apres)])) {
    if (typeof avant[k] === "function" && typeof apres[k] === "function") continue;
    if (!Object.is(avant[k], apres[k])) return false;
  }
  return true;
};
const memoEcran = (C) => React.memo(C, propsEcranEgales);
const M = Object.fromEntries(Object.entries({
  Dashboard, Ventes, NouvelleCommande, CommandesRecues, Depenses, ChezComptable,
  Dettes, CreerClient, Clients, Caisse, DemandeRavitaillement, DemandesTransfertRecues, Stocks,
  Dimensionnement, TousLesDevis, Prospects, EspaceClient, Messagerie,
  ClientsInstalles, PrimesRemises, PrimesRecues, ContratsInstallation,
  Commerciaux, MesTaches, Rentabilite, SalairesAdmin, Salaire, MonEquipe,
  MaCommission, Fournisseurs, Users, Historique, Parametres,
}).map(([n, C]) => [n, memoEcran(C)]));
import {
  ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, envoyerIdentifiantsWhatsApp,
  envoyerAccueilProspectWhatsApp, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu,
} from "./lib/comptesClients";
import { TABLES, initialiserDonnees, amorcerSiVide, chargerTout, sauvegarderDiff, joursDepuisSauvegarde, marquerSauvegarde, forcerResynchronisation, autoResyncDejaFaite, marquerAutoResyncFaite,
  memoriserDossier, lireDossier, oublierDossier, marquerSauvegardeAuto, heuresDepuisSauvegardeAuto, viderLocal, compterEnAttente, majComptesSecours, lireComptesSecours } from "./db";
import { rebaser } from "./lib/rebase";
import { demarrerSync, arreterSync, synchroniser, synchroniserOuverture, reinitialiserDistant, amorcerBoutiques, reconcilierMiroir } from "./sync";
import { synchroniserAuth, etatAuth, etatComptesAuth, supabaseConfigure, chargerApparence } from "./supabaseClient";
import { genererPDF, genererDevis, genererProforma } from "./pdf";
import { LOGO_CLAIR, SEED, VERSION, PAIEMENTS, CATEGORIES, SALARIES, SALARIES_BOUTIQUE, PALETTE, COMPTE_TRESORERIE, COMPTE_CHARGE, TYPES_INSTALLATION,
} from "./lib/constants";
import { uid, normPaiement, lignesJournal, lignesVente, brutVente, qteVente, resumeArticles, totalVente, hacher, PBKDF2_ITERATIONS, genererSelHex, hacherFort, definirMotDePasse, verifierMotDePasse, prefixeBoutique, prochainNumeroVente, repararNumerosVentes, numeroRecu, fmt, today, dFR, telDigits, inP, COLORS, col, light, setColors } from "./lib/core";
import {
  Field, inputCls, btnDark, Badge, Panel, LoadingSpinner,
  uAlert, uConfirm, uPrompt, uChoix, DialogHost, PrintHost, ExportHost, Info,
} from "./components/ui";
import {
  stockVendu, stockAjuste, stockActuel, virementsMois,
  totalRembourseCredit, resteCredit, creditsDe, creditsEnAttente, creditsEnCours,
  moisPlus, retenueCreditMois, appliquerRetenuesCredit,
  choisirBoutiqueDebitG, messagesNotifSortieCaisse, messagesNotifPaiementCommission, annulerLiensDepense, envoyerVirementG,
  derniereActivite, joursSansActivite, estDormant, toucher, SEUIL_COMMERCIAL,
  TAUX_PARRAINAGE_CLIENT, CRITERES_NOTE, moyenneNote, noteMoyenne, etoiles, tauxParrainageDefaut, tauxParrain,
  SEUIL_CHEF_EQUIPE, TAUX_EQUIPE_DEFAUT, filleulsDe, estChefEquipe,
  commissionBloquee, commissionBrute, commissionVente, commissionEnAttente, commissionPour,
  normNom, trouverArticle,
  estReservation, reservations, dettesClassiques, resteAPayer, totalReservation,
  demandesDe, demandesEnAttente, alertesBoutiques,
  aUnTaux, apporteursPossibles, estApporteur,
  estDepot, boutiquesVente, magasinsDe,
  LIBELLE_ONGLET, ONGLETS_ROLE, ACTIONS_POUVOIR, pouvoirsDuRole,
  droitsOffDe, aDroit, peutEcrire, bloquerSiLecture,
  tachesDe, tachesOuvertes, compterReponsesRavitaillement, compterDemandesTransfertRecues, compterDemandesTransfertToutes, compterTaches, compterTachesAValider, compterNotifsSalaire, compterDemandesCredit,
  paieMois, libelleMoisFR, periodes,
  NOTE_DIM_DEFAUT, noteDimensionnement, statutChantier, estAppWindows,
  debloquerCommissionsReception, chantiersAReconcilier, construireIndexDb,
  verifierEcritureEspace, messageEcritureRefusee, estCompteFormation, espaceDuCompte, chantiersDeMonEspace, marqueEspace, setRegardeFormation, voitLesDeuxEspaces, boutiquesFormation
} from "./lib/calculs";
import { imprimerRecu, imprimerProforma, imprimerBonRavitaillement, imprimerBulletin, recuWhatsApp } from "./lib/impression";
import { telechargerSauvegarde, NOM_FICHIER_AUTO, dossierDispo, ecrireDansDossier } from "./lib/sauvegarde";
import { exportCSV } from "./lib/export";

// Détecte la plateforme pour adapter la durée avant déconnexion automatique :
// 5 min sur navigateur Android (usage tactile, souvent posé/repris — plus
// sensible si l'appareil est partagé ou laissé sans surveillance),
// 30 min partout ailleurs (application Windows, ou navigateur sur PC).
const DUREE_INACTIVITE = /Android/i.test(navigator.userAgent || "") ? 5 * 60 * 1000 : 30 * 60 * 1000;

// Onglet à ouvrir à la connexion (fraîche ou restaurée après actualisation
// de la page) : on reprend le DERNIER onglet où la personne travaillait,
// s'il existe encore et reste valide pour son rôle — sinon on retombe sur
// l'onglet par défaut habituel de ce rôle. Demandé par Timo : ne plus jamais
// revenir au premier onglet après une actualisation de la page.
function tabDeDepart(role, userId) {
  const parDefaut = role === "admin" || role === "comptable" ? "dashboard"
    : (role === "commercial" || role === "technicien") ? "commande"
    : role === "resp_commercial" ? "equipe"
    : role === "technicien_bmi" ? "dimensionnement"
    : role === "magasinier" ? "stocks"
    : role === "client" ? "espace_client" : "ventes";
  try {
    // Clé PROPRE À CHAQUE COMPTE (id inclus) — sinon, sur un appareil
    // partagé (plusieurs employés sur le même téléphone Android), la
    // personne qui se connecte après une autre atterrit dans l'onglet où
    // celle-ci travaillait. Bug signalé par Timo.
    const dernier = localStorage.getItem(`bmi_dernier_onglet:${userId}`);
    if (dernier && (ONGLETS_ROLE[role] || []).includes(dernier)) return dernier;
  } catch {}
  return parDefaut;
}

// ============ APPLICATION PRINCIPALE ============
export default function App() {
  const [db, setDbRaw] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("ventes");
  // Tout écran contenant un formulaire perd ses données non enregistrées en
  // changeant d'onglet — React démonte le composant, réinitialisant son
  // state interne (demande Timo, d'abord pour Dimensionnement en 2.98.98,
  // puis étendue à TOUS les onglets ici). Chaque onglet visité une fois
  // reste désormais « en veille » (masqué via CSS, jamais détruit) au lieu
  // d'être démonté — rien n'est chargé avant sa première visite, pour ne
  // rien alourdir chez qui n'utilise pas tel ou tel écran.
  const [ongletsVisites, setOngletsVisites] = useState({});
  useEffect(() => { setOngletsVisites((v) => (v[tab] ? v : { ...v, [tab]: true })); }, [tab]);
  // Barre(s) d'onglets défilantes (mobile horizontale, barre latérale
  // desktop) : après une actualisation de la page, l'onglet retrouvé (voir
  // tabDeDepart) peut être hors du cadre visible — la barre reste à son
  // point de départ. On la positionne sur l'onglet actif AVANT que le
  // navigateur n'affiche quoi que ce soit (useLayoutEffect, pas useEffect) :
  // aucun saut visible, l'onglet est déjà à la bonne place dès la première
  // image affichée — pas un défilement animé, juste jamais la mauvaise
  // position à l'écran. Demandé par Timo après avoir vu un bref instant où
  // la barre montrait Tableau de bord avant de se corriger.
  useLayoutEffect(() => {
    document.querySelectorAll(`[data-tab-id="${tab}"]`).forEach((el) => el.scrollIntoView?.({ inline: "center", block: "nearest" }));
  }, [tab]);
  // Mémorise l'onglet actif à chaque changement, pour le retrouver après une
  // actualisation de la page (voir tabDeDepart ci-dessus) — seulement une
  // fois connecté, pour ne jamais mémoriser l'écran de connexion lui-même.
  useEffect(() => {
    if (!profile) return;
    try { localStorage.setItem(`bmi_dernier_onglet:${profile.id}`, tab); } catch {}
  }, [tab, profile]);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [sync, setSync] = useState({ enLigne: navigator.onLine, supabaseOk: false, enAttente: 0 });
  // Vrai pendant le rechargement complet qui suit une connexion : l'écran
  // part de zéro et un bandeau explique que les données arrivent du serveur.
  const [syncInitiale, setSyncInitiale] = useState(false);
  // Apparence de l'écran de connexion rapportée par le serveur, pour un
  // appareil qui n'a pas encore les fiches boutiques (voir api/apparence.js).
  const [apparence, setApparence] = useState(null);

  // ---- Réception AUTOMATIQUE : 7 jours après la fin de travaux déclarée
  // par BMI, si le client n'a pas réceptionné dans son espace, la réception
  // est actée d'office (statut « Réceptionné », commissions débloquées,
  // parrain prévenu). S'exécute à la connexion d'un compte pouvant écrire.
  useEffect(() => {
    if (!db || !profile || syncInitiale) return;
    if (!peutEcrire(dbRef.current, profile)) return;
    const seuil = Date.now() - 7 * 86400000;
    // ⚠ Cloisonnement : ce rattrapage tourne sous le compte connecté et
    // écrit tout d'un seul save(). S'il mélangeait des chantiers réels et
    // des chantiers de formation, le verrou d'espace refuserait le save
    // ENTIER — et la réception automatique ne passerait plus jamais. On ne
    // traite donc que les chantiers de l'espace du compte connecté.
    const eligibles = chantiersDeMonEspace(db, profile).filter((x) =>
      x.statut === "termine" && x.date_fin && new Date(x.date_fin).getTime() <= seuil);
    // ⚠ RATTRAPAGE (2.100.55) — les chantiers déjà RÉCEPTIONNÉS dont la vente
    // porte encore une commission gelée : les deux chemins de SIGNATURE du PV
    // (app et bmitogo.com) réceptionnaient sans jamais débloquer, et J+7 les
    // sautait. Voir chantiersAReconcilier (lib/calculs.js). Couvre aussi tout
    // le passé, site compris.
    const aReconcilier = chantiersAReconcilier(db, profile);
    if (!eligibles.length && !aReconcilier.length) return;
    let next = { ...db };
    const noms = [];
    for (const x of eligibles) {
      next = {
        ...next,
        clients_installes: next.clients_installes.map((y) => (y.id === x.id
          ? { ...y, statut: "receptionne", receptionne_le: today(), receptionne_par: "Réception automatique (7 jours après fin de travaux)" }
          : y)),
        ...debloquerCommissionsReception(next, x.vente_id, "automatique, 7 jours après la fin des travaux"),
      };
      noms.push(`${x.nom} ${x.prenom || ""}`.trim());
    }
    const nomsRattrapes = [];
    for (const x of aReconcilier) {
      next = { ...next, ...debloquerCommissionsReception(next, x.vente_id, "rattrapage — chantier déjà réceptionné") };
      nomsRattrapes.push(`${x.nom} ${x.prenom || ""}`.trim());
    }
    const traces = [
      ...(noms.length ? [`Réception AUTOMATIQUE (7 jours après fin de travaux) : ${noms.join(", ")} — commissions débloquées`] : []),
      ...(nomsRattrapes.length ? [`RATTRAPAGE : commissions débloquées sur chantier(s) déjà réceptionné(s) — ${nomsRattrapes.join(", ")}`] : []),
    ];
    save(next, traces.join(" · "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, syncInitiale, db?.clients_installes]);
  // Comptes de secours : copie minimale des comptes (voir db.js), utilisée
  // par l'écran de connexion quand la table users est vide (purge + hors ligne).
  const [secours, setSecours] = useState([]);
  const [rappelSauvegarde, setRappelSauvegarde] = useState(false);
  const [preRempli, setPreRempli] = useState(null); // { boutique, panier } transmis depuis le Dimensionnement solaire
  const [devisAReprendre, setDevisAReprendre] = useState(null); // { devis, client } — devis en modification/rejeté que le vendeur reprend
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const dbRef = useRef(null);
  const autoSauvFaite = useRef(false);
  // ⚠ « JE REGARDE LE RÉEL » ou « JE REGARDE L'ENTRAÎNEMENT » — demande
  // Timo (26/08/2026). UN SEUL réglage, en haut, qui commande TOUS les
  // écrans : onglets de boutique, listes, chiffres.
  //
  // ⚠ Il ne donne AUCUN droit nouveau. Il ne fait que choisir, dans ce qu'un
  // compte a DÉJÀ le droit de voir, ce qu'il affiche. Un compte placé en
  // formation n'est pas concerné : il y reste, quoi qu'il arrive.
  //
  // ⚠ Il ne survit PAS à un rechargement : on ne doit jamais ouvrir
  // l'application et lire des chiffres d'entraînement en les croyant vrais.
  // C'est la seule exception à la règle « ne rien changer après une
  // actualisation » — et elle va dans le sens de la prudence.
  const [regardeFormation, setRegardeFormationEtat] = useState(false);
  const basculerEspaceRegarde = (v) => { setRegardeFormation(v); setRegardeFormationEtat(v); };
  const peutRegarderLaFormation = db && profile
    && voitLesDeuxEspaces(db, profile) && boutiquesFormation(db).size > 0;

  const [dossierAuto, setDossierAuto] = useState(null);
  const [dernierAuto, setDernierAuto] = useState(null);

  // Au démarrage : on récupère le dossier mémorisé, s'il y en a un
  useEffect(() => {
    if (!dossierDispo()) return;
    (async () => {
      try {
        const h = await lireDossier();
        if (h) setDossierAuto(h);
        const t = await heuresDepuisSauvegardeAuto();
        setDernierAuto(t);
      } catch {}
    })();
  }, []);

  // SAUVEGARDE HORAIRE : réécrit le même fichier toutes les heures, en silence.
  // Contrôle toutes les 5 minutes ; n'écrit que si plus d'une heure s'est écoulée
  // ET que des données ont changé depuis la dernière écriture.
  useEffect(() => {
    if (!dossierAuto || !db) return;
    let vivant = true;
    const tenter = async () => {
      if (!vivant) return;
      try {
        const t = await heuresDepuisSauvegardeAuto();
        if (t !== null && t < 1) return;           // moins d'une heure : on ne fait rien
        await ecrireDansDossier(dbRef.current || db, dossierAuto);
        setDernierAuto(0);
      } catch (e) {
        console.warn("Sauvegarde horaire impossible :", e.message);
      }
    };
    tenter();                                       // une fois à l'ouverture
    const minuteur = setInterval(tenter, 5 * 60 * 1000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [dossierAuto, db]);

  // SAUVEGARDE AUTOMATIQUE : au premier lancement de la journée par un administrateur,
  // la base complète est téléchargée dans un fichier daté, sans rien demander.
  useEffect(() => {
    if (!db || !profile || profile.role !== "admin" || autoSauvFaite.current) return;
    autoSauvFaite.current = true;
    (async () => {
      try {
        const j = await joursDepuisSauvegarde();
        if (j === null || j >= 1) {
          telechargerSauvegarde(db, "_auto");
          await marquerSauvegarde();
          setRappelSauvegarde(false);
        }
      } catch {}
    })();
  }, [db, profile]);

  // ============ RÉPARATION DES COLLISIONS DE NUMÉROS (2.99.44 — Lot C) ============
  // Si deux appareils hors ligne ont émis le même numéro de reçu, la
  // synchronisation fait apparaître le doublon ici. La réparation est
  // DÉTERMINISTE (voir repararNumerosVentes) : tous les appareils calculent
  // la même correction, qui se propage ensuite normalement. L'ancien numéro
  // reste conservé sur la vente (numero_avant_collision) et une ligne de
  // journal est écrite — le reçu papier déjà imprimé reste retrouvable.
  const chargerEtReparer = async () => {
    const donnees = await chargerTout();
    const r = repararNumerosVentes(donnees);
    if (!r) return donnees;
    const final = {
      ...donnees,
      ventes: r.ventes,
      audits: [{
        id: uid(), date: new Date().toISOString(), user: "Système",
        action: `Collision de numéros de reçu réparée (ventes hors ligne simultanées) : ${r.corrections.map((c) => `${c.ancien} → ${c.nouveau}`).join(", ")}`,
      }, ...(donnees.audits || [])],
    };
    try { await sauvegarderDiff(donnees, final); synchroniser({ urgent: true }); } catch { /* réessaiera au prochain chargement */ }
    return final;
  };

  // ⚠ Numéro de version de l'état, et mémoire des derniers états servis.
  // Un écran qui enregistre renvoie `{ ...db, ... }` : il rapporte donc le
  // numéro de l'état qu'il avait reçu. S'il ne correspond plus à l'état
  // courant, c'est que des données sont arrivées entre-temps — et il faut
  // reporter la seule intention de l'écran au lieu d'écraser tout (voir
  // lib/rebase.js, et le défaut de suppression fantôme qu'il corrige).
  const versionRef = useRef(0);
  const etatsServis = useRef(new Map());

  const setDb = (d) => {
    // LOT D : index précalculés, TOUJOURS reconstruits ici (jamais réutilisés
    // d'un ancien état — un save({...db, ventes}) recopierait sinon un index
    // périmé). Construction O(ventes), payée UNE fois par vrai changement.
    const version = ++versionRef.current;
    const enrichi = { ...d, __index: construireIndexDb(d), __v: version };
    // On ne garde que les derniers états : au-delà, une fenêtre restée
    // ouverte si longtemps ne mérite plus d'être rejouée telle quelle.
    etatsServis.current.set(version, enrichi);
    if (etatsServis.current.size > 12) {
      const trop = etatsServis.current.size - 12;
      for (const cle of [...etatsServis.current.keys()].slice(0, trop)) etatsServis.current.delete(cle);
    }
    setColors(Object.fromEntries((enrichi.boutiques || []).map((b) => [b.nom, b.couleur])));
    dbRef.current = enrichi;
    setDbRaw(enrichi);
  };

  useEffect(() => {
    (async () => {
      await initialiserDonnees(SEED);      // 1er lancement : données de départ
      const donnees = await chargerEtReparer(); // lecture LOCALE (hors ligne OK) + réparation éventuelle des numéros
      setDb(donnees);

      // ⚠ RETIRÉ — ÉTAPE 2 de la fermeture du « trou n° 1 » (19/08/2026).
      // On téléchargeait ici TOUTE la table des comptes sur chaque appareil
      // neuf, avant même toute connexion : c'est ce qui obligeait à la
      // laisser lisible par n'importe qui, y compris sans compte. Les
      // téléphones du personnel partaient ainsi au premier venu, et les mots
      // de passe des comptes clients — qui se RECALCULENT depuis le nom et
      // le téléphone — devenaient reconstituables par un inconnu.
      // Désormais l'écran de connexion demande au serveur LA seule fiche
      // correspondant à l'identifiant saisi, et ne l'obtient que si le mot
      // de passe est le bon (api/chercher-compte.js). Rien ne change pour un
      // appareil déjà utilisé : sa copie locale suffit, hors réseau compris.
      // ⚠ Même besoin que ci-dessus, pour l'écran de connexion : sans ça, la
      // personnalisation (couleur, badge, image) d'un appareil neuf reste
      // aux valeurs par défaut jusqu'à la toute première connexion réussie.
      amorcerBoutiques().then((reussi) => { if (reussi) chargerTout().then(setDb); });
      // ⚠ Constaté par Timo (20/08/2026) : sur un appareil NEUF, les fiches
      // boutiques ne sont pas encore là — l'écran de connexion s'affichait
      // donc dans son habillage par défaut jusqu'à la première connexion.
      // Le serveur nous en donne l'apparence, et RIEN d'autre : ni adresses,
      // ni téléphones, ni réglages internes (voir api/apparence.js).
      chargerApparence().then((a) => { if (a) setApparence(a); });

      // Restaure la session après un rafraîchissement de page (site web),
      // à condition qu'elle date de moins de 15 minutes et que le compte
      // soit toujours actif — sinon, retour normal à l'écran de connexion.
      try {
        const brut = localStorage.getItem("bmi_session");
        if (brut) {
          const { id, ts } = JSON.parse(brut);
          let u = donnees.users.find((x) => x.id === id);
          // Table users vide (actualisation pendant la fenêtre purge → sync) :
          // on restaure depuis les comptes de secours, comme l'écran de
          // connexion. Si la table est remplie et que l'identifiant n'y est
          // pas, le compte n'existe vraiment plus : pas de repêchage.
          if (!u && donnees.users.length === 0) {
            u = (await lireComptesSecours()).find((x) => x.id === id);
          }
          if (u && u.actif !== false && Date.now() - ts < DUREE_INACTIVITE) {
            setProfile(u);
            setTab(tabDeDepart(u.role, u.id));
          } else {
            localStorage.removeItem("bmi_session");
          }
        }
      } catch {}

      // Fichier de secours des comptes : instantané au démarrage, puis
      // rafraîchi après chaque synchronisation réussie (etat.rafraichir).
      majComptesSecours().then(() => lireComptesSecours().then(setSecours)).catch(() => {});
      demarrerSync(async (etat) => {       // sync Supabase en arrière-plan
        setSync(etat);
        if (etat.rafraichir) {
          setDb(await chargerEtReparer());
          majComptesSecours().then(() => lireComptesSecours().then(setSecours)).catch(() => {});
        }
      });
      try {
        const j = await joursDepuisSauvegarde();
        setRappelSauvegarde(j === null || j > 7);
      } catch {}
      // Après la 1re synchro, on amorce le seed SEULEMENT si la base est encore
      // vide (vrai premier lancement). Ainsi, un nettoyage du navigateur suivi
      // d'une synchro ne réinstalle jamais de fausses boutiques par-dessus le serveur.
      const amorcageApresSync = async () => {
        try { await amorcerSiVide(); setDb(await chargerEtReparer()); } catch {}
      };

      // À CHAQUE OUVERTURE : synchronisation d'ouverture sûre.
      // Elle ENVOIE d'abord tout ce qui a été fait hors ligne, PUIS relit le
      // serveur. Les ventes du matin faites sans réseau partent donc en premier
      // et ne peuvent pas être écrasées. C'est la version prudente d'un
      // « tout retélécharger » — sans le danger de perdre des données locales.
      try {
        await synchroniserOuverture();
        await amorcageApresSync();
      } catch {}

      // Le rattrapage complet historique (données d'avant Supabase) reste fait
      // UNE seule fois par machine, après la synchro d'ouverture.
      try {
        const dejaFait = await autoResyncDejaFaite();
        if (!dejaFait) {
          await forcerResynchronisation();
          await synchroniser();
          await marquerAutoResyncFaite();
        }
      } catch {}
    })();
    return () => arreterSync();
  }, []);

  // Sécurité : déconnexion automatique après 15 minutes d'inactivité.
  // La session enregistrée localement est aussi rafraîchie pendant l'activité,
  // pour survivre à un rafraîchissement de page sans forcer une reconnexion.
  useEffect(() => {
    if (!profile) return;
    let derniereActivite = Date.now();
    const activite = () => {
      derniereActivite = Date.now();
      try {
        const brut = localStorage.getItem("bmi_session");
        if (brut) { const s = JSON.parse(brut); s.ts = Date.now(); localStorage.setItem("bmi_session", JSON.stringify(s)); }
      } catch {}
    };
    const evts = ["mousemove", "keydown", "click", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, activite));
    const minuterie = setInterval(() => {
      if (Date.now() - derniereActivite > DUREE_INACTIVITE) {
        deconnexion(true); // purge silencieuse si tout est synchronisé
      }
    }, 30000);
    return () => { evts.forEach((e) => window.removeEventListener(e, activite)); clearInterval(minuterie); };
  }, [profile]);

  // Toute modification est écrite d'abord en local (instantané, même sans
  // réseau), puis mise en file pour Supabase.
  // Toute action sensible est tracée dans le journal d'audit (onglet Historique)
  const save = async (next, action, options = {}) => {
    // ---- VERROU LECTURE SEULE À LA SOURCE ----
    // TOUTE écriture de l'application passe par ici : un compte privé du
    // pouvoir « act_ecriture » ne peut rien persister, quel que soit l'écran
    // ou le bouton — y compris ceux qui n'appellent pas bloquerSiLecture.
    // Les actions volontaires (avec libellé de journal) déclenchent l'alerte ;
    // les écritures techniques sans libellé (marquages « vu / lu ») sont
    // simplement ignorées, sans alerte.
    // SEULE exception : le POINTAGE DES DÉCAISSEMENTS par le comptable
    // (options.pointageComptable, posé uniquement par le panneau « Chez le
    // comptable ») — il marque « remis / pas encore remis » les sorties de SA
    // caisse, sans autre pouvoir d'écriture.
    const pointageAutorise = options.pointageComptable === true && profile?.role === "comptable";
    if (profile && !peutEcrire(dbRef.current, profile) && !pointageAutorise) {
      if (action) uAlert("🔒 Votre compte est en lecture seule : vous pouvez consulter et exporter, mais pas modifier ni supprimer.");
      return;
    }
    // ⚠ L'écran a-t-il travaillé sur un état périmé ? (fenêtre de
    // confirmation restée ouverte pendant qu'une synchronisation apportait
    // des données). Si oui, on ne retient QUE ce qu'il a voulu changer et on
    // le reporte sur l'état courant — sinon une vente arrivée entre-temps,
    // absente de l'état qu'il renvoie, serait prise pour une suppression
    // voulue et effacée partout, serveur compris.
    if (next && next.__v != null && dbRef.current && next.__v !== dbRef.current.__v) {
      const base = etatsServis.current.get(next.__v);
      if (base) {
        next = rebaser(base, next, dbRef.current, TABLES);
      } else {
        // État trop ancien pour être retrouvé : on refuse plutôt que de
        // risquer d'effacer ce qu'on ne sait plus comparer.
        uAlert("⏳ Cette fenêtre est restée ouverte trop longtemps pendant que d'autres données arrivaient.\n\nRien n'a été enregistré, pour ne rien effacer par erreur. Refaites l'opération : l'écran est à jour.");
        return;
      }
    }
    const prev = dbRef.current;
    // ---- VERROU DE CLOISONNEMENT FORMATION / RÉEL, À LA SOURCE ----
    // Deuxième verrou du même genre que celui juste au-dessus, et pour la
    // même raison : TOUTE écriture de l'application passe par ici, donc un
    // écran qui aurait oublié de filtrer ses boutiques (ou un circuit
    // indirect : demande de transfert, bon de ravitaillement, paiement de
    // prime) ne peut pas pour autant écrire dans l'autre espace. Le save
    // est refusé EN ENTIER — jamais à moitié : un paiement écrit toujours
    // sa dépense ET la fiche liée dans le même appel, les deux tombent
    // donc ensemble. `options.horsCloisonnement` est réservé aux actions
    // de l'admin principal qui doivent traverser volontairement les deux
    // espaces (réinitialisation de la formation).
    if (profile && !options.horsCloisonnement) {
      const infraction = verifierEcritureEspace(prev, next, profile);
      if (infraction) {
        uAlert(messageEcritureRefusee(infraction, estCompteFormation(prev, profile)));
        return;
      }
    }
    const final = action
      // ⚠ Le journal portait les actions des DEUX espaces mélangées : les
      // gestes d'entraînement apparaissaient dans l'historique réel, avec de
      // vrais montants dans leur libellé (point 13 de l'audit du 20/08/2026).
      // Il porte désormais sa marque, comme les prospects, et le serveur le
      // cloisonne (supabase/securite-1-audits-et-tombstones.sql).
      ? { ...next, audits: [{ id: uid(), date: new Date().toISOString(), user: profile?.nom || "Système", action, ...marqueEspace(next, profile) }, ...(next.audits || [])] }
      : next;
    setDb(final);
    setSaveStatus("saving");
    try {
      // ⚠ Qui écrit ? C'est ce qui décide des fiches de PAIE que cet appareil
      // a le droit de détacher et d'envoyer : la sienne toujours, celles des
      // autres seulement pour un administrateur. Sans cette précaution, un
      // appareil de vendeur — qui ne reçoit pas les fiches de paie des autres
      // — en fabriquerait des vides et les enverrait au serveur, qui les
      // refuserait : opération bloquée dans la file (voir lib/paie.js).
      await sauvegarderDiff(prev, final, { id: profile?.id, admin: profile?.role === "admin" });
      setSaveStatus("saved");
      // ⚠ « urgent » : si un cycle tourne déjà, cette demande est MÉMORISÉE et
      // repart dès sa fin, au lieu d'être abandonnée. C'est ce qui faisait
      // patienter une vente jusqu'à vingt secondes (signalé par Timo).
      synchroniser({ urgent: true }); // tentative immédiate si on est en ligne
    } catch {
      setSaveStatus("error");
    }
  };

  const [syncEnCours, setSyncEnCours] = useState(false);
  const load = async () => {
    if (syncEnCours) return;          // évite les clics multiples
    setSyncEnCours(true);
    try {
      await synchroniser();
      setDb(await chargerEtReparer());
    } finally {
      setSyncEnCours(false);          // s'arrête TOUJOURS, même en cas d'erreur
    }
  };

  // ⚠ PLACÉ AVANT TOUT POINT DE SORTIE de ce composant — il y en a DEUX :
  // l'écran de chargement juste en dessous (« if (!db) »), puis l'écran de
  // connexion plus bas. Un `useEffect` déclaré après l'un ou l'autre n'existe
  // pas au premier affichage puis apparaît ensuite : React refuse ce
  // changement du nombre de crochets et cesse d'afficher l'application.
  // Écran blanc, signalé par Timo en 2.100.76 — puis de nouveau en 2.100.77,
  // parce que je n'avais remonté ce bloc qu'au-dessus du SECOND point de
  // sortie, sans voir le premier.
  // ⚠ UN COMPTE BLOQUÉ PERD LA MAIN IMMÉDIATEMENT (point 12 de l'audit du
  // 20/08/2026). L'application ne vérifiait `actif` qu'à la connexion et à la
  // reprise de session : un employé bloqué — ou licencié — continuait donc de
  // travailler normalement jusqu'à l'expiration de son jeton.
  //
  // On surveille désormais SA fiche en continu. Dès que la synchronisation
  // rapporte le blocage (ou la désactivation faite depuis un autre appareil),
  // la session se ferme, avec un message qui explique.
  //
  // Ce que cela ne fait PAS, et il faut le savoir : le jeton de session reste
  // valable côté serveur jusqu'à son expiration. Quelqu'un qui contournerait
  // l'application pourrait donc encore écrire pendant ce laps de temps. La
  // fermeture complète demanderait au serveur de révoquer la session — c'est
  // le prolongement naturel de cette correction.
  useEffect(() => {
    if (!profile || !db?.users) return;
    const moi = db.users.find((u) => u.id === profile.id);
    const fermer = (message) => {
      setProfile(null);
      basculerEspaceRegarde(false);
      try { localStorage.removeItem("bmi_session"); } catch {}
      uAlert(message);
    };

    // ⚠ COMPTE SUPPRIMÉ PENDANT QU'IL TRAVAILLE (demande Timo, 20/08/2026 :
    // « les anciens comptes supprimés arrivent toujours à se connecter »).
    // Sa fiche a disparu de la table : la synchronisation vient de rapporter
    // la suppression faite ailleurs.
    //
    // ⚠ On exige que la table soit PEUPLÉE (plus d'un compte). Une fiche
    // absente d'une table quasi vide ne prouve rien : ce serait une
    // synchronisation encore en cours, ou un appareil neuf qui ne connaît
    // que celui qui vient de se connecter. Déconnecter sur ce seul indice
    // mettrait des gens dehors sans raison.
    if (!moi) {
      if ((db.users || []).length > 1) {
        fermer("🔒 Votre compte a été supprimé par l'administrateur.\n\nVous êtes déconnecté. Rapprochez-vous de la direction si vous pensez qu'il s'agit d'une erreur.");
      }
      return;
    }
    if (moi.actif === false) {
      fermer("🔒 Votre compte vient d'être désactivé par l'administrateur.\n\nVous êtes déconnecté. Rapprochez-vous de la direction si vous pensez qu'il s'agit d'une erreur.");
    }
  }, [db?.users, profile]);

  if (!db) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><LoadingSpinner /></div>;
  if (!profile) {
    // Table users vide (purge + hors ligne) : l'écran de connexion s'appuie
    // sur les comptes de secours. Dans ce mode, pas de sauvegarde (la
    // migration de mot de passe écrirait des fiches minimales par-dessus
    // les fiches complètes du serveur) — elle se fera à la prochaine
    // connexion avec la vraie table.
    const dbLogin = db.users.length > 0 ? db : { ...db, users: secours };
    const saveLogin = db.users.length > 0 ? save : null;
    return <><DialogHost /><Login db={dbLogin} apparence={apparence} save={saveLogin} onLogin={(u) => {
    setProfile(u);
    basculerEspaceRegarde(false);   // toute connexion démarre sur le RÉEL
    try { localStorage.setItem("bmi_session", JSON.stringify({ id: u.id, ts: Date.now() })); } catch {}
    (async () => {
      // MIROIR : à chaque connexion avec réseau, retéléchargement complet du
      // serveur (curseurs à 1970) PUIS réconciliation — toute ligne locale
      // inconnue du serveur est supprimée. Après cela, le local est une copie
      // exacte du serveur. Hors ligne : on travaille sur les données de la
      // dernière synchronisation (vente et dimensionnement restent possibles),
      // et rien n'est supprimé. S'il reste des opérations à envoyer, elles
      // partent d'abord ; le miroir attendra qu'elles soient toutes parties.
      setSyncInitiale(true);
      try {
        if ((await compterEnAttente()) === 0) await forcerResynchronisation();
      } catch {}
      try { await synchroniserOuverture(); } catch {}
      try { await reconcilierMiroir(); } catch {}
      setDb(await chargerEtReparer());
      majComptesSecours().then(() => lireComptesSecours().then(setSecours)).catch(() => {});
      setSyncInitiale(false);
    })();
    setTab(tabDeDepart(u.role, u.id));
  }} /></>;
  }

  // ---- DÉCONNEXION AVEC PURGE SÉCURISÉE ----
  // Objectif : plus jamais d'anciennes données affichées après un changement
  // d'utilisateur. À la déconnexion : on POUSSE d'abord tout ce qui attend,
  // puis on PURGE les données locales (sauf les comptes, pour pouvoir se
  // reconnecter même hors ligne). Si des opérations n'ont pas pu partir
  // (hors ligne), on NE purge PAS — perdre une vente serait bien pire que
  // voir un chiffre périmé — et on préviendra à la déconnexion suivante.
  const deconnexion = async (automatique = false) => {
    // Dernière tentative d'envoi immédiat avant toute décision.
    try { await synchroniser(); } catch { /* hors ligne : on vérifie l'outbox juste après */ }
    let restants = 0;
    try { restants = await compterEnAttente(); } catch {}
    if (restants > 0 && !automatique) {
      // PLUS DE BLOCAGE (décision Timo, 2.98.66) : depuis le passage au
      // miroir, la déconnexion ne purge RIEN — l'ancienne règle stricte
      // (héritée de l'époque où déconnexion = purge) n'avait plus que ses
      // inconvénients : elle EMPRISONNAIT l'utilisateur quand l'envoi était
      // durablement impossible (session refusée, réseau instable). On informe
      // et on laisse choisir : les opérations restent sur l'appareil et
      // partiront automatiquement, dans l'ordre, à la prochaine connexion —
      // le miroir ne supprime jamais rien tant que la file n'est pas vide.
      const ok = await uConfirm(
        `⚠ ${restants} opération(s) ne sont pas encore envoyées au serveur.\n\n` +
        `Se déconnecter quand même ?\n\n` +
        `Elles restent enregistrées sur CET appareil et partiront automatiquement, dans l'ordre, à la prochaine connexion. Rien n'est perdu — mais n'effacez pas les données du navigateur d'ici là.`
      );
      if (!ok) return;
    }
    // Pas de purge : les données locales restent le cache de travail hors
    // ligne. Leur exactitude est garantie par le miroir à chaque connexion
    // avec réseau — plus par l'effacement.
    setProfile(null);
    // ⚠ On repart TOUJOURS du réel : le prochain à se connecter ne doit pas
    // hériter d'un « je regarde l'entraînement » qu'il n'a pas choisi.
    basculerEspaceRegarde(false);
    try { localStorage.removeItem("bmi_session"); } catch {}
  };

  const isAdmin = profile.role === "admin";
  const isCommercial = profile.role === "commercial";
  const isMagasinier = profile.role === "magasinier";
  const isGerant = profile.role === "gerant";
  const isVendeur = profile.role === "vendeur";
  const isTechnicien = profile.role === "technicien";
  const isTechnicienBMI = profile.role === "technicien_bmi";
  const isRespCom = profile.role === "resp_commercial";
  const isComptable = profile.role === "comptable";
  const isClient = profile.role === "client";

  const nonLus = compterNonLus(db, profile);
  const labelMessages = `💬 Messages${nonLus ? ` (${nonLus})` : ""}`;
  const nouveauxDevis = compterNouveauxDevis(db, profile);
  const labelTousDevis = (
    <span className="inline-flex items-center gap-1.5">
      📋 Tous les devis
      {nouveauxDevis > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse">{nouveauxDevis}</span>
      )}
    </span>
  );
  const commandesEnAttente = compterCommandesEnAttente(db, profile);
  const labelCommandes = (
    <span className="inline-flex items-center gap-1.5">
      📥 Commandes reçues
      {commandesEnAttente > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse">{commandesEnAttente}</span>
      )}
    </span>
  );
  const chantiersAProgrammer = compterChantiersAProgrammer(db, profile);
  const labelParc = (
    <span className="inline-flex items-center gap-1.5">
      🏠 Clients installés
      {chantiersAProgrammer > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse" title="Chantier(s) payé(s) en attente de programmation">{chantiersAProgrammer}</span>
      )}
    </span>
  );
  const notifsPaie = compterNotifsSalaire(db, profile);
  const labelSalaire = `💵 Salaire${notifsPaie ? ` (${notifsPaie})` : ""}`;
  const jeSuisApporteur = estApporteur(db, profile);
  const nbReponsesRav = compterReponsesRavitaillement(db, profile);
  const labelRavitaillement = `🚚 Ravitaillement${nbReponsesRav ? ` (${nbReponsesRav})` : ""}`;
  const nbTransfertRecu = compterDemandesTransfertRecues(db, profile);
  const labelTransfert = `🔁 Transfert${nbTransfertRecu ? ` (${nbTransfertRecu})` : ""}`;
  const nbTransfertToutes = compterDemandesTransfertToutes(db, profile);
  const labelStocksAdmin = `📦 Stocks${nbTransfertToutes ? ` (${nbTransfertToutes})` : ""}`;
  const nbTaches = compterTaches(db, profile);
  const labelTaches = `✅ Mes tâches${nbTaches ? ` (${nbTaches})` : ""}`;
  const nbAValider = compterTachesAValider(db, profile);
  const labelEquipe = `👑 Équipe${nbAValider ? ` (${nbAValider})` : ""}`;
  const labelMonEquipe = `👑 Mon équipe${nbAValider ? ` (${nbAValider})` : ""}`;
  const demandesCredit = isAdmin ? compterDemandesCredit(db) : 0;
  const labelUsers = `👥 Utilisateurs${demandesCredit ? ` (${demandesCredit})` : ""}`;

  const tabs = isAdmin
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["contrats", "📄 Contrats"], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["stocks", labelStocksAdmin], ["fournisseurs", "🚚 Fournisseurs"], ["commerciaux", "🎯 Commerciaux"], ["equipe", labelEquipe], ["prospects", "🧲 Prospects"], ["parc", labelParc], ["messages", labelMessages], ["salaires", "💵 Salaires"], ["users", labelUsers], ["historique", "🕘 Historique"], ["parametres", "⚙ Paramètres"]]
    : isComptable
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["clients", "👤 Clients"], ["historique", "🕘 Historique"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isRespCom
    ? [["equipe", labelMonEquipe], ["ventes", "💰 Ventes"], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["parc", labelParc], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["contrats", "📄 Contrats"], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : (isCommercial || isTechnicien)
    ? [["commande", "🛒 Nouvelle commande"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["prospects", "🧲 Prospects"], ["parc", "🏠 Clients installés"], ["taches", labelTaches], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["nouveau_client", "🙋 Créer un client"], ...(estChefEquipe(db, profile) ? [["equipe", labelMonEquipe]] : []), ...(isTechnicien ? [["primes_recues", "💰 Primes reçues"]] : []), ["contrats", "📄 Contrats"]]
    : isTechnicienBMI
    ? [["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["contrats", "📄 Contrats"], ["parc", "🏠 Clients installés"], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["commission", "💵 Ma commission"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isMagasinier
    ? [["stocks", "📦 Stocks"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isGerant
    ? [["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["contrats", "📄 Contrats"], ["stocks", "📦 Stocks"], ["transfert", labelTransfert], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["fournisseurs", "🚚 Fournisseurs"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isClient
    ? [["espace_client", "🏠 Mon espace"], ["messages", labelMessages]]
    // ⚠ "parc" (Clients installés) ajouté au menu vendeur — demande Timo :
    // un vendeur doit pouvoir encaisser un chantier "pose seule" payé en
    // boutique (cas rare), ce qui exige d'atteindre cette fiche.
    : [["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["ravitaillement", labelRavitaillement], ["transfert", labelTransfert], ["parc", labelParc], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"], ["primes_remises", "💰 Primes remises"], ["contrats", "📄 Contrats"]];

  // Tout utilisateur qui amène un client voit son onglet « Ma commission »
  const tabsPlus = jeSuisApporteur && !tabs.some(([id]) => id === "commission") && !isClient
    ? [...tabs, ["commission", "💵 Ma commission"]]
    : tabs;

  // "Mes contrats" apparaît pour un client SEULEMENT le jour où il a
  // effectivement signé au moins un contrat — pas avant (demande Timo).
  // Même principe que "Ma commission" ci-dessus pour un apporteur.
  const aUnContratSigne = isClient && (db.users.find((u) => u.id === profile.id)?.devis || []).some((d) => d.contrat_signature);
  const tabsPlus2 = aUnContratSigne && !tabsPlus.some(([id]) => id === "mes_contrats")
    ? [...tabsPlus, ["mes_contrats", "📄 Mes contrats"]]
    : tabsPlus;

  // Pouvoirs retirés par l'administrateur
  const tabsAutorises = tabsPlus2.filter(([id]) => aDroit(db, profile, id));
  const ongletAutorise = tabsAutorises.some(([id]) => id === tab);
  const titreOnglet = (tabsAutorises.find(([id]) => id === tab) || ["", ""])[1];

  const BadgeSync = ({ sombre }) => (
    <span className="inline-flex flex-col shrink-0">
      <span className="inline-flex items-center gap-1.5">
        {sync.enLigne && sync.supabaseOk
          ? <span className={`text-xs font-semibold whitespace-nowrap ${sombre ? "text-green-400" : "text-green-700"}`}>🟢 En ligne{sync.enAttente ? ` · ${sync.enAttente} à envoyer` : ""}</span>
          : <span className={`text-xs font-semibold whitespace-nowrap ${sombre ? "text-amber-400" : "text-amber-600"}`}>🔌 Hors ligne{sync.enAttente ? ` · ${sync.enAttente} en attente` : ""}</span>}
        {/* La version : maintenant déjà affichée en haut à côté de « Lomé, Togo »
            (visible partout, y compris sur téléphone). Ici, on ne la garde en double
            que sur ordinateur, où la barre latérale est toujours visible — sur
            téléphone, elle ferait doublon avec l'en-tête juste au-dessus. */}
        <span className={`hidden lg:inline text-[10px] font-bold ${sombre ? "text-sky-300/80" : "text-slate-400"}`}>v{VERSION}</span>
      </span>
      {/* Le nom de l'utilisateur connecté, en orange, sous le point vert.
          Visible partout — y compris sur téléphone où la barre latérale est cachée. */}
      {profile?.nom && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs font-bold text-orange-500">👤 {profile.nom}</span>
          {nonLus > 0 && (
            <button
              onClick={() => setTab("messages")}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-red-600 rounded-full px-1.5 py-0.5 animate-pulse"
              title={`${nonLus} message${nonLus > 1 ? "s" : ""} non lu${nonLus > 1 ? "s" : ""}`}
            >
              💬 +{nonLus}
            </button>
          )}
        </span>
      )}
      {sync.erreur && <span className="text-[10px] text-red-400 max-w-[260px] truncate" title={sync.erreur}>⚠ {sync.erreur}</span>}
      {/* Dans le logiciel Windows, l'absence de VITE_SYNC_AUTH_URL empêche toute
          session sécurisée. On le dit, au lieu de laisser un « Failed to fetch » nu. */}
      {estAppWindows() && !etatAuth.ok && (
        <span className="text-[10px] text-amber-400 max-w-[260px] truncate" title={etatAuth.raison}>🔐 {etatAuth.raison}</span>
      )}
    </span>
  );

  const contenu = !tabsAutorises.length ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <div className="font-bold text-slate-800">Aucun accès</div>
      <div className="text-sm text-slate-500 mt-1">Tous vos pouvoirs ont été retirés par l'administrateur.</div>
    </div>
  ) : !ongletAutorise ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <div className="font-bold text-slate-800">Accès non autorisé</div>
      <div className="text-sm text-slate-500 mt-1">Cet onglet a été désactivé par l'administrateur, ou n'est pas disponible pour votre compte. Choisissez un autre onglet dans le menu.</div>
    </div>
  ) : (
    <>
      {!peutEcrire(db, profile) && (
        <div className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          🔒 <b>Compte en lecture seule.</b> Vous pouvez consulter les données et faire les exports, mais pas créer, modifier ni supprimer.
        </div>
      )}
      {sync.enLigne && sync.enAttente > 0 && sync.erreur && (
        <div className="mb-4 rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          ⚠ <b>{sync.enAttente} opération(s) n'arrivent pas à partir vers le serveur.</b>
          <div className="text-xs mt-1">{sync.erreur}</div>
          <div className="text-xs mt-1 text-red-700">L'application réessaie toutes les 20 secondes. Si le compteur ne descend pas d'ici une minute : déconnectez-vous puis reconnectez-vous — le bouton de déconnexion vous guidera, et vos opérations partiront automatiquement après. Rien n'est perdu : elles sont enregistrées sur cet appareil.</div>
        </div>
      )}
      {isAdmin && rappelSauvegarde && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          💾 Aucune sauvegarde de secours récente. Allez dans <b>⚙ Paramètres → Sauvegarde de secours</b> pour exporter une copie de vos données.
        </div>
      )}
      {/* Interrupteur de disponibilité — pour les techniciens (commission et BMI). */}
      {profile.role === "technicien" && (() => {
        const moi = db.users.find((u) => u.id === profile.id) || {};
        const dispo = moi.indisponible !== true;
        const basculer = () => {
          const next = !dispo; // next = nouvelle disponibilité
          save({
            ...db,
            users: db.users.map((u) => (u.id === profile.id ? { ...u, indisponible: !next } : u)),
          }, `${profile.nom} se déclare ${next ? "DISPONIBLE" : "INDISPONIBLE"}`);
        };
        return (
          <div className={`mb-4 rounded-xl p-4 border-2 ${dispo ? "bg-green-50 border-green-300" : "bg-slate-100 border-slate-300"}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className={`font-bold ${dispo ? "text-green-800" : "text-slate-600"}`}>
                  {dispo ? "🟢 Vous êtes DISPONIBLE" : "⛔ Vous êtes INDISPONIBLE"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dispo
                    ? "On peut vous affecter à des installations."
                    : "Vous n'apparaîtrez pas dans les équipes à affecter, tant que vous restez indisponible."}
                </div>
              </div>
              <button onClick={basculer} className={`px-5 py-2 rounded-lg font-bold text-sm ${dispo ? "bg-slate-700 text-white hover:bg-slate-800" : "bg-green-700 text-white hover:bg-green-800"}`}>
                {dispo ? "Me mettre indisponible" : "Me remettre disponible"}
              </button>
            </div>
          </div>
        );
      })()}

      {ongletsVisites.dashboard && (isAdmin || isComptable) && (
        <div style={{ display: tab === "dashboard" ? "block" : "none" }}>
          <M.Dashboard db={db} profile={profile} />
        </div>
      )}
      {ongletsVisites.ventes && !isCommercial && (
        <div style={{ display: tab === "ventes" ? "block" : "none" }}>
          <M.Ventes db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)}
            onTransformerEnDevis={(pseudoDevis) => { setDevisAReprendre(pseudoDevis); setTab("dimensionnement"); }} />
        </div>
      )}
      {ongletsVisites.commande && (isCommercial || isTechnicien) && (
        <div style={{ display: tab === "commande" ? "block" : "none" }}>
          <M.NouvelleCommande db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)} />
        </div>
      )}
      {ongletsVisites.commandes && !isCommercial && (
        <div style={{ display: tab === "commandes" ? "block" : "none" }}>
          <M.CommandesRecues db={db} save={save} profile={profile} onValider={(boutique, panier, commercial, responsable, rabais, origineDevis, remisePct, client, tel, commandeId) => { setPreRempli({ boutique, panier, commercial, responsable, rabais, origineDevis, remise: remisePct, client, tel, commandeId }); setTab("ventes"); }} />
        </div>
      )}
      {ongletsVisites.dimensionnement && (
        <div style={{ display: tab === "dimensionnement" ? "block" : "none" }}>
          <M.Dimensionnement db={db} profile={profile} save={save} devisAReprendre={devisAReprendre} onDevisRepriseConsomme={() => setDevisAReprendre(null)} onConvertirEnVente={(boutique, panier, remise) => {
            if (isTechnicienBMI) { uAlert("Un compte Technicien BMI ne peut pas convertir un devis en vente. Transmettez le devis à un vendeur ou à l'administration."); return; }
            setPreRempli({ boutique, panier, remise });
            setTab((isCommercial || isTechnicien) ? "commande" : "ventes");
          }} />
        </div>
      )}
      {ongletsVisites.tous_devis && (
        <div style={{ display: tab === "tous_devis" ? "block" : "none" }}>
          <M.TousLesDevis db={db} save={save} profile={profile} onModifierDevis={(devis, client) => { setDevisAReprendre({ devis, client }); setTab("dimensionnement"); }} />
        </div>
      )}
      {ongletsVisites.depenses && (
        <div style={{ display: tab === "depenses" ? "block" : "none" }}>
          <M.Depenses db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.chez_comptable && (
        <div style={{ display: tab === "chez_comptable" ? "block" : "none" }}>
          <M.ChezComptable db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.dettes && (
        <div style={{ display: tab === "dettes" ? "block" : "none" }}>
          <M.Dettes db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.clients && (
        <div style={{ display: tab === "clients" ? "block" : "none" }}>
          <M.Clients db={db} profile={profile} />
        </div>
      )}
      {ongletsVisites.nouveau_client && (
        <div style={{ display: tab === "nouveau_client" ? "block" : "none" }}>
          <M.CreerClient db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.caisse && (
        <div style={{ display: tab === "caisse" ? "block" : "none" }}>
          <M.Caisse db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.stocks && (isAdmin || isMagasinier || isGerant || isComptable) && (
        <div style={{ display: tab === "stocks" ? "block" : "none" }}>
          <M.Stocks db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.fournisseurs && (isAdmin || isGerant) && (
        <div style={{ display: tab === "fournisseurs" ? "block" : "none" }}>
          <M.Fournisseurs db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.commerciaux && isAdmin && (
        <div style={{ display: tab === "commerciaux" ? "block" : "none" }}>
          <M.Commerciaux db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.rentabilite && (isAdmin || isComptable) && (
        <div style={{ display: tab === "rentabilite" ? "block" : "none" }}>
          <M.Rentabilite db={db} profile={profile} />
        </div>
      )}
      {ongletsVisites.salaires && isAdmin && (
        <div style={{ display: tab === "salaires" ? "block" : "none" }}>
          <M.SalairesAdmin db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.users && isAdmin && (
        <div style={{ display: tab === "users" ? "block" : "none" }}>
          <M.Users db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.historique && (isAdmin || isComptable) && (
        <div style={{ display: tab === "historique" ? "block" : "none" }}>
          <M.Historique db={db} />
        </div>
      )}
      {ongletsVisites.commission && (jeSuisApporteur || isTechnicienBMI || isRespCom || isCommercial || isTechnicien) && (
        <div style={{ display: tab === "commission" ? "block" : "none" }}>
          <M.MaCommission db={db} profile={profile} />
        </div>
      )}
      {ongletsVisites.equipe && (isAdmin || isRespCom || ((isCommercial || isTechnicien) && estChefEquipe(db, profile))) && (
        <div style={{ display: tab === "equipe" ? "block" : "none" }}>
          <M.MonEquipe db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.taches && (isCommercial || isTechnicien || isTechnicienBMI || isRespCom) && (
        <div style={{ display: tab === "taches" ? "block" : "none" }}>
          <M.MesTaches db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.parc && (isAdmin || isCommercial || isTechnicien || isTechnicienBMI || isRespCom || isVendeur) && (
        <div style={{ display: tab === "parc" ? "block" : "none" }}>
          <M.ClientsInstalles db={db} save={save} profile={profile} isAdmin={isAdmin} />
        </div>
      )}
      {ongletsVisites.primes_remises && isVendeur && (
        <div style={{ display: tab === "primes_remises" ? "block" : "none" }}>
          <M.PrimesRemises db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.primes_recues && isTechnicien && (
        <div style={{ display: tab === "primes_recues" ? "block" : "none" }}>
          <M.PrimesRecues db={db} profile={profile} />
        </div>
      )}
      {ongletsVisites.contrats && (isAdmin || isRespCom || isCommercial || isTechnicien || isTechnicienBMI || isGerant || isVendeur) && (
        <div style={{ display: tab === "contrats" ? "block" : "none" }}>
          <M.ContratsInstallation db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.mes_contrats && isClient && (
        <div style={{ display: tab === "mes_contrats" ? "block" : "none" }}>
          <M.ContratsInstallation db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.messages && (
        <div style={{ display: tab === "messages" ? "block" : "none" }}>
          <M.Messagerie db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.ravitaillement && profile.boutique && (
        <div style={{ display: tab === "ravitaillement" ? "block" : "none" }}>
          <M.DemandeRavitaillement db={db} save={save} profile={profile} boutique={profile.boutique} marquerVues />
        </div>
      )}
      {ongletsVisites.transfert && profile.boutique && (
        <div style={{ display: tab === "transfert" ? "block" : "none" }}>
          <M.DemandesTransfertRecues db={db} save={save} profile={profile} boutique={profile.boutique} />
        </div>
      )}
      {ongletsVisites.salaire && SALARIES.includes(profile.role) && (
        <div style={{ display: tab === "salaire" ? "block" : "none" }}>
          <M.Salaire db={db} save={save} profile={profile} />
        </div>
      )}
      {ongletsVisites.espace_client && isClient && (
        <div style={{ display: tab === "espace_client" ? "block" : "none" }}>
          <M.EspaceClient db={db} profile={profile} save={save} setTab={setTab} />
        </div>
      )}
      {ongletsVisites.prospects && (isAdmin || isCommercial || isTechnicien || isTechnicienBMI || isRespCom) && (
        <div style={{ display: tab === "prospects" ? "block" : "none" }}>
          <M.Prospects db={db} save={save} profile={profile} isAdmin={isAdmin} />
        </div>
      )}
      {ongletsVisites.parametres && isAdmin && (
        <div style={{ display: tab === "parametres" ? "block" : "none" }}>
          <M.Parametres db={db} save={save} setDb={setDb} profile={profile} dossierAuto={dossierAuto} setDossierAuto={setDossierAuto} dernierAuto={dernierAuto} />
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      {syncInitiale && (
        <div className="fixed top-0 inset-x-0 z-[9999] bg-sky-800 text-white text-center text-sm font-semibold py-2 shadow-lg">
          ⏳ Synchronisation avec le serveur — les données arrivent…
        </div>
      )}
      <DialogHost />
      <ExportHost />
      <PrintHost />
      {rechercheOuverte && (
        <RechercheGlobale
          db={db}
          profile={profile}
          onFermer={() => setRechercheOuverte(false)}
          onNaviguer={(t) => { setTab(t); setRechercheOuverte(false); }}
        />
      )}

      {/* ══ Barre latérale professionnelle (grand écran) ══ */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-950 via-sky-950 to-slate-900 text-white h-screen sticky top-0">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
          {/* ⚠ Version CLAIRE, posée directement sur le menu — plus de plaque
              blanche. Le logo est déjà sans fond ; c'était `bg-white` qui lui
              collait ce carré. Voir LOGO_CLAIR dans lib/constants.js. */}
          <img src={LOGO_CLAIR} alt="BMI Togo" className="h-11 w-auto" />
          <div>
            <div className="font-bold leading-tight tracking-wide">BMI-GESTION SYSTÈME</div>
            <div className="text-[10px] text-sky-200/70 uppercase tracking-widest">v{VERSION} — Lomé, Togo</div>
          </div>
        </div>
        <div className="px-4 pt-3">
          <button onClick={() => setRechercheOuverte(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm text-sky-100/80 text-left">
            🔍 Rechercher…
          </button>
        </div>
        {peutRegarderLaFormation && (
          <div className="px-4 pt-3">
            <div className="text-[10px] font-bold text-sky-200/60 uppercase tracking-widest mb-1">Je regarde</div>
            <div className="flex gap-1">
              <button onClick={() => basculerEspaceRegarde(false)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${!regardeFormation ? "bg-sky-600 text-white" : "bg-white/10 text-sky-100/70 hover:bg-white/20"}`}>
                Le réel
              </button>
              <button onClick={() => basculerEspaceRegarde(true)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold ${regardeFormation ? "bg-violet-600 text-white" : "bg-white/10 text-sky-100/70 hover:bg-white/20"}`}>
                🎓 Formation
              </button>
            </div>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {tabsAutorises.map(([id, label]) => (
            <button key={id} data-tab-id={id} onClick={() => setTab(id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === id ? "bg-sky-700/60 text-white shadow-inner" : "text-sky-100/70 hover:bg-white/10 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 space-y-2">
          <BadgeSync sombre />
          {profile.boutique && <div className="text-xs text-sky-100 flex items-center gap-2"><Badge boutique={profile.boutique} /></div>}
          <div className="flex gap-2">
            <button onClick={load} disabled={syncEnCours} className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold disabled:opacity-70">
              <span className={`inline-block ${syncEnCours ? "animate-spin" : ""}`}>⟳</span> {syncEnCours ? "Synchronisation…" : "Synchroniser"}
            </button>
            <button onClick={() => deconnexion(false)} title={sync.enAttente > 0 ? "Des opérations restent à envoyer — vous pouvez vous déconnecter : elles partiront à la prochaine connexion" : ""} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold ${sync.enAttente > 0 ? "bg-amber-500/30 text-amber-100 hover:bg-amber-500/40" : "bg-white/10 hover:bg-white/20"}`}>{sync.enAttente > 0 ? `📤 ${sync.enAttente} à envoyer — se déconnecter` : "Se déconnecter"}</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ══ En-tête compact (petit écran) ══ */}
        <header className="lg:hidden bg-gradient-to-r from-slate-900 via-sky-950 to-sky-900 text-white shadow-md">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO_CLAIR} alt="BMI Togo" className="h-10 w-auto shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-lg leading-tight truncate">BMI-GESTION SYSTÈME</div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-2 flex-wrap">
                  {profile?.nom && <span className="font-bold text-orange-500">👤 {profile.nom}</span>}
                  <span>v{VERSION}</span>
                </div>
              </div>
            </div>
            {peutRegarderLaFormation && (
              <button onClick={() => basculerEspaceRegarde(!regardeFormation)}
                className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold ${regardeFormation ? "bg-violet-600 text-white" : "bg-white/15 text-sky-100"}`}
                title="Basculer entre les chiffres réels et ceux de l'entraînement">
                {regardeFormation ? "🎓 Formation" : "Réel"}
              </button>
            )}
            {nonLus > 0 && (
              <button onClick={() => setTab("messages")} className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-red-600 rounded-full px-1.5 py-0.5 animate-pulse" title={`${nonLus} message${nonLus > 1 ? "s" : ""} non lu${nonLus > 1 ? "s" : ""}`}>
                💬 +{nonLus}
              </button>
            )}
          </div>
          {/* Une seule ligne, qui défile sur le côté si l'écran est trop étroit —
              plutôt qu'un empilement désordonné quand tout ne tient pas. */}
          <div className="px-4 pb-3 flex items-center gap-2 text-sm overflow-x-auto">
            <button onClick={() => setRechercheOuverte(true)} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold" aria-label="Rechercher">🔍</button>
            <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap">
              {sync.enLigne && sync.supabaseOk
                ? <span className="text-xs font-semibold text-green-400 whitespace-nowrap">🟢 En ligne{sync.enAttente ? ` · ${sync.enAttente}` : ""}</span>
                : <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">🔌 Hors ligne{sync.enAttente ? ` · ${sync.enAttente}` : ""}</span>}
            </span>
            {saveStatus === "error" && <span className="shrink-0 text-xs text-red-400 whitespace-nowrap">⚠ Erreur locale</span>}
            <button onClick={load} disabled={syncEnCours} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-70 whitespace-nowrap">
              <span className={`inline-block ${syncEnCours ? "animate-spin" : ""}`}>⟳</span> {syncEnCours ? "Synchronisation…" : "Synchroniser"}
            </button>
            {profile.boutique && <span className="shrink-0 hidden sm:flex items-center gap-2 text-slate-300"><Badge boutique={profile.boutique} /></span>}
            <button onClick={() => deconnexion(false)} title={sync.enAttente > 0 ? "Des opérations restent à envoyer — vous pouvez vous déconnecter : elles partiront à la prochaine connexion" : ""} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${sync.enAttente > 0 ? "bg-amber-600 text-white opacity-90 hover:opacity-100" : "bg-slate-700 hover:bg-slate-600"}`}>{sync.enAttente > 0 ? `📤 ${sync.enAttente} à envoyer — se déconnecter` : "Se déconnecter"}</button>
          </div>
          <nav className="px-4 flex gap-1 overflow-x-auto">
            {tabsAutorises.map(([id, label]) => (
              <button key={id} data-tab-id={id} onClick={() => setTab(id)}
                className={`px-3 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg ${tab === id ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:text-white"}`}>{label}</button>
            ))}
          </nav>
        </header>

        {/* ══ Barre supérieure (grand écran) ══ */}
        <div className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-20 shadow-sm">
          <div className="text-lg font-bold text-slate-800">{titreOnglet}</div>
          <div className="flex items-center gap-4">
            {saveStatus === "error" && <span className="text-xs text-red-600 font-semibold">⚠ Erreur locale</span>}
            <BadgeSync />
            <span className="text-xs text-slate-400">{dFR(today())}</span>
          </div>
        </div>

        <main className="w-full max-w-6xl mx-auto px-4 py-5">
          {contenu}
        </main>
      </div>
    </div>
  );
}



function compterNonLus(db, profile) {
  const messages = db.messages || [];
  const groupes = db.groupes || [];
  return messages.filter((m) => {
    if (m.de_id === profile.id) return false;
    if ((m.lu_par || []).includes(profile.id)) return false;
    if (m.canal === "support") return peutVoirFilClient(profile, m.client_id, db);
    if (m.canal === "groupe") {
      if (profile.role === "admin") return true;
      const g = groupes.find((x) => x.id === m.groupe_id);
      return !!g && (g.membres || []).includes(profile.id);
    }
    return m.a_id === profile.id;
  }).length;
}

// Nombre de devis pas encore ouverts par cet utilisateur, dans la même
// visibilité que « Tous les devis » (l'admin et le resp. commercial voient
// tout ; les autres élaborateurs ne comptent que les leurs).
function compterNouveauxDevis(db, profile) {
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial";
  // Même visibilité que l'écran, cloisonnement compris : sans cela, la
  // pastille rouge comptait les devis de l'autre espace — et pointait vers
  // une liste où ils n'apparaissent pas.
  const espace = espaceDuCompte(db, profile);
  return db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => u.devis || [])
    .filter((d) => espace === undefined || !!d.formation === espace)
    .filter((d) => voitTout || d.par_id === profile.id)
    .filter((d) => !(d.vu_par || []).includes(profile.id))
    .length;
}

// Commandes en attente de validation, dans la même visibilité que l'écran
// « Commandes reçues » (l'admin voit toutes les boutiques ; un gérant ou
// vendeur ne voit que la sienne, et seulement celles qui lui sont destinées).
function compterCommandesEnAttente(db, profile) {
  const isAdmin = profile.role === "admin";
  return (db.commandes || []).filter((c) =>
    c.statut === "en_attente" &&
    (isAdmin || c.boutique === profile.boutique) &&
    (isAdmin || !c.vendeur_cible || c.vendeur_cible === profile.nom)
  ).length;
}

// Chantiers créés par le paiement d'un devis, mais jamais encore programmés —
// sans alerte, ils peuvent rester en dormance indéfiniment, personne ne
// pensant à revenir les vérifier. Seuls l'administrateur et le responsable
// commercial peuvent programmer : eux seuls voient cette pastille.
function compterChantiersAProgrammer(db, profile) {
  if (profile.role !== "admin" && profile.role !== "resp_commercial") return 0;
  return (db.clients_installes || []).filter((c) => c.a_programmer && !c.date_installation).length;
}
