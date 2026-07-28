import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Login } from "./screens/Connexion";
import { Dashboard } from "./screens/Dashboard";
import { Ventes } from "./screens/Ventes";
import { NouvelleCommande, CommandesRecues } from "./screens/Commandes";
import { Depenses, ChezComptable } from "./screens/Depenses";
import { Dettes } from "./screens/Dettes";
import { CreerClient, Clients } from "./screens/Clients";
import { Caisse } from "./screens/Caisse";
import { DemandeRavitaillement } from "./screens/Ravitaillement";
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
import {
  ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, envoyerIdentifiantsWhatsApp,
  envoyerAccueilProspectWhatsApp, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu,
} from "./lib/comptesClients";
import { initialiserDonnees, amorcerSiVide, chargerTout, sauvegarderDiff, joursDepuisSauvegarde, marquerSauvegarde, forcerResynchronisation, autoResyncDejaFaite, marquerAutoResyncFaite,
  memoriserDossier, lireDossier, oublierDossier, marquerSauvegardeAuto, heuresDepuisSauvegardeAuto, viderLocal, compterEnAttente, majComptesSecours, lireComptesSecours } from "./db";
import { demarrerSync, arreterSync, synchroniser, synchroniserOuverture, reinitialiserDistant, amorcerComptes, reconcilierMiroir } from "./sync";
import { synchroniserAuth, etatAuth, etatComptesAuth, supabaseConfigure } from "./supabaseClient";
import { genererPDF, genererDevis, genererProforma } from "./pdf";
import { LOGO, SEED, VERSION, PAIEMENTS, CATEGORIES, SALARIES, SALARIES_BOUTIQUE, PALETTE, COMPTE_TRESORERIE, COMPTE_CHARGE, TYPES_INSTALLATION,
} from "./lib/constants";
import { uid, normPaiement, lignesJournal, lignesVente, brutVente, qteVente, resumeArticles, totalVente, hacher, PBKDF2_ITERATIONS, genererSelHex, hacherFort, definirMotDePasse, verifierMotDePasse, prefixeBoutique, numeroRecu, fmt, today, dFR, telDigits, inP, COLORS, col, light, setColors } from "./lib/core";
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
  tachesDe, tachesOuvertes, compterReponsesRavitaillement, compterTaches, compterTachesAValider, compterNotifsSalaire, compterDemandesCredit,
  paieMois, libelleMoisFR, periodes,
  NOTE_DIM_DEFAUT, noteDimensionnement, statutChantier, estAppWindows,
  debloquerCommissionsReception,
} from "./lib/calculs";
import { imprimerRecu, imprimerProforma, imprimerBonRavitaillement, imprimerBulletin, recuWhatsApp } from "./lib/impression";
import { telechargerSauvegarde, NOM_FICHIER_AUTO, dossierDispo, ecrireDansDossier } from "./lib/sauvegarde";
import { exportCSV } from "./lib/export";

// Détecte la plateforme pour adapter la durée avant déconnexion automatique :
// 5 min sur navigateur Android (usage tactile, souvent posé/repris — plus
// sensible si l'appareil est partagé ou laissé sans surveillance),
// 30 min partout ailleurs (application Windows, ou navigateur sur PC).
const DUREE_INACTIVITE = /Android/i.test(navigator.userAgent || "") ? 5 * 60 * 1000 : 30 * 60 * 1000;

// ============ APPLICATION PRINCIPALE ============
export default function App() {
  const [db, setDbRaw] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("ventes");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [sync, setSync] = useState({ enLigne: navigator.onLine, supabaseOk: false, enAttente: 0 });
  // Vrai pendant le rechargement complet qui suit une connexion : l'écran
  // part de zéro et un bandeau explique que les données arrivent du serveur.
  const [syncInitiale, setSyncInitiale] = useState(false);

  // ---- Réception AUTOMATIQUE : 7 jours après la fin de travaux déclarée
  // par BMI, si le client n'a pas réceptionné dans son espace, la réception
  // est actée d'office (statut « Réceptionné », commissions débloquées,
  // parrain prévenu). S'exécute à la connexion d'un compte pouvant écrire.
  useEffect(() => {
    if (!db || !profile || syncInitiale) return;
    if (!peutEcrire(dbRef.current, profile)) return;
    const seuil = Date.now() - 7 * 86400000;
    const eligibles = (db.clients_installes || []).filter((x) =>
      x.statut === "termine" && x.date_fin && new Date(x.date_fin).getTime() <= seuil);
    if (!eligibles.length) return;
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
    save(next, `Réception AUTOMATIQUE (7 jours après fin de travaux) : ${noms.join(", ")} — commissions débloquées`);
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

  const setDb = (d) => {
    setColors(Object.fromEntries((d.boutiques || []).map((b) => [b.nom, b.couleur])));
    dbRef.current = d;
    setDbRaw(d);
  };

  useEffect(() => {
    (async () => {
      await initialiserDonnees(SEED);      // 1er lancement : données de départ
      const donnees = await chargerTout(); // lecture de la base LOCALE (hors ligne OK)
      setDb(donnees);

      // Amorçage rapide et dédié de la table des comptes : indispensable sur un
      // appareil neuf pour qu'un utilisateur (client qui vient de recevoir ses
      // identifiants, par exemple) puisse être retrouvé DÈS sa toute première
      // tentative de connexion — avant même que la synchronisation générale,
      // plus longue et plus complexe, n'ait eu le temps de s'exécuter.
      amorcerComptes().then((reussi) => { if (reussi) chargerTout().then(setDb); });

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
            setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
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
          setDb(await chargerTout());
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
        try { await amorcerSiVide(); setDb(await chargerTout()); } catch {}
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
    const prev = dbRef.current;
    const final = action
      ? { ...next, audits: [{ id: uid(), date: new Date().toISOString(), user: profile?.nom || "Système", action }, ...(next.audits || [])] }
      : next;
    setDb(final);
    setSaveStatus("saving");
    try {
      await sauvegarderDiff(prev, final);
      setSaveStatus("saved");
      synchroniser(); // tentative immédiate si on est en ligne
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
      setDb(await chargerTout());
    } finally {
      setSyncEnCours(false);          // s'arrête TOUJOURS, même en cas d'erreur
    }
  };

  if (!db) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><LoadingSpinner /></div>;
  if (!profile) {
    // Table users vide (purge + hors ligne) : l'écran de connexion s'appuie
    // sur les comptes de secours. Dans ce mode, pas de sauvegarde (la
    // migration de mot de passe écrirait des fiches minimales par-dessus
    // les fiches complètes du serveur) — elle se fera à la prochaine
    // connexion avec la vraie table.
    const dbLogin = db.users.length > 0 ? db : { ...db, users: secours };
    const saveLogin = db.users.length > 0 ? save : null;
    return <><DialogHost /><Login db={dbLogin} save={saveLogin} onLogin={(u) => {
    setProfile(u);
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
      setDb(await chargerTout());
      majComptesSecours().then(() => lireComptesSecours().then(setSecours)).catch(() => {});
      setSyncInitiale(false);
    })();
    setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
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
      // RÈGLE : impossible de se déconnecter tant que tout n'est pas envoyé.
      uAlert(`🔒 Déconnexion impossible : ${restants} opération(s) restent à envoyer au serveur.\n\nL'application réessaie automatiquement toutes les 20 secondes et dès que le réseau revient. Le bouton se réactivera dès que tout sera parti — ne fermez pas la page.`);
      return;
    }
    // Pas de purge : les données locales restent le cache de travail hors
    // ligne. Leur exactitude est garantie par le miroir à chaque connexion
    // avec réseau — plus par l'effacement.
    setProfile(null);
    try { localStorage.removeItem("bmi_session"); } catch {}
  };

  const isAdmin = profile.role === "admin";
  const isCommercial = profile.role === "commercial";
  const isMagasinier = profile.role === "magasinier";
  const isGerant = profile.role === "gerant";
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
  const nbTaches = compterTaches(db, profile);
  const labelTaches = `✅ Mes tâches${nbTaches ? ` (${nbTaches})` : ""}`;
  const nbAValider = compterTachesAValider(db, profile);
  const labelEquipe = `👑 Équipe${nbAValider ? ` (${nbAValider})` : ""}`;
  const labelMonEquipe = `👑 Mon équipe${nbAValider ? ` (${nbAValider})` : ""}`;
  const demandesCredit = isAdmin ? compterDemandesCredit(db) : 0;
  const labelUsers = `👥 Utilisateurs${demandesCredit ? ` (${demandesCredit})` : ""}`;

  const tabs = isAdmin
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["fournisseurs", "🚚 Fournisseurs"], ["commerciaux", "🎯 Commerciaux"], ["equipe", labelEquipe], ["prospects", "🧲 Prospects"], ["parc", labelParc], ["messages", labelMessages], ["salaires", "💵 Salaires"], ["users", labelUsers], ["historique", "🕘 Historique"], ["parametres", "⚙ Paramètres"]]
    : isComptable
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["clients", "👤 Clients"], ["historique", "🕘 Historique"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isRespCom
    ? [["equipe", labelMonEquipe], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["parc", labelParc], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : (isCommercial || isTechnicien)
    ? [["commande", "🛒 Nouvelle commande"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["prospects", "🧲 Prospects"], ["parc", "🏠 Clients installés"], ["taches", labelTaches], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["nouveau_client", "🙋 Créer un client"], ...(estChefEquipe(db, profile) ? [["equipe", labelMonEquipe]] : [])]
    : isTechnicienBMI
    ? [["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["parc", "🏠 Clients installés"], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["commission", "💵 Ma commission"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isMagasinier
    ? [["stocks", "📦 Stocks"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isGerant
    ? [["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["stocks", "📦 Stocks"], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["fournisseurs", "🚚 Fournisseurs"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isClient
    ? [["espace_client", "🏠 Mon espace"], ["messages", labelMessages]]
    : [["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["ravitaillement", labelRavitaillement], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]];

  // Tout utilisateur qui amène un client voit son onglet « Ma commission »
  const tabsPlus = jeSuisApporteur && !tabs.some(([id]) => id === "commission") && !isClient
    ? [...tabs, ["commission", "💵 Ma commission"]]
    : tabs;

  // Pouvoirs retirés par l'administrateur
  const tabsAutorises = tabsPlus.filter(([id]) => aDroit(db, profile, id));
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

      {tab === "dashboard" && (isAdmin || isComptable) && <Dashboard db={db} />}
      {tab === "ventes" && !isCommercial && <Ventes db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)} />}
      {tab === "commande" && isCommercial && <NouvelleCommande db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)} />}
      {tab === "commandes" && !isCommercial && <CommandesRecues db={db} save={save} profile={profile} onValider={(boutique, panier, commercial, responsable, rabais, origineDevis, remisePct, client, tel, commandeId) => { setPreRempli({ boutique, panier, commercial, responsable, rabais, origineDevis, remise: remisePct, client, tel, commandeId }); setTab("ventes"); }} />}
      {tab === "dimensionnement" && <Dimensionnement db={db} profile={profile} save={save} devisAReprendre={devisAReprendre} onDevisRepriseConsomme={() => setDevisAReprendre(null)} onConvertirEnVente={(boutique, panier, remise) => {
        if (isTechnicienBMI) { uAlert("Un compte Technicien BMI ne peut pas convertir un devis en vente. Transmettez le devis à un vendeur ou à l'administration."); return; }
        setPreRempli({ boutique, panier, remise });
        setTab((isCommercial || isTechnicien) ? "commande" : "ventes");
      }} />}
      {tab === "tous_devis" && <TousLesDevis db={db} save={save} profile={profile} onModifierDevis={(devis, client) => { setDevisAReprendre({ devis, client }); setTab("dimensionnement"); }} />}
      {tab === "depenses" && <Depenses db={db} save={save} profile={profile} />}
      {tab === "chez_comptable" && <ChezComptable db={db} save={save} profile={profile} />}
      {tab === "dettes" && <Dettes db={db} save={save} profile={profile} />}
      {tab === "clients" && <Clients db={db} profile={profile} />}
      {tab === "nouveau_client" && <CreerClient db={db} save={save} profile={profile} />}
      {tab === "caisse" && <Caisse db={db} save={save} profile={profile} />}
      {tab === "stocks" && (isAdmin || isMagasinier || isGerant || isComptable) && <Stocks db={db} save={save} profile={profile} />}
      {tab === "fournisseurs" && (isAdmin || isGerant) && <Fournisseurs db={db} save={save} />}
      {tab === "commerciaux" && isAdmin && <Commerciaux db={db} save={save} />}
      {tab === "rentabilite" && (isAdmin || isComptable) && <Rentabilite db={db} />}
      {tab === "salaires" && isAdmin && <SalairesAdmin db={db} save={save} profile={profile} />}
      {tab === "users" && isAdmin && <Users db={db} save={save} profile={profile} />}
      {tab === "historique" && (isAdmin || isComptable) && <Historique db={db} />}
      {tab === "commission" && (jeSuisApporteur || isTechnicienBMI || isRespCom) && <MaCommission db={db} profile={profile} />}
      {tab === "equipe" && (isAdmin || isRespCom || ((isCommercial || isTechnicien) && estChefEquipe(db, profile))) && <MonEquipe db={db} save={save} profile={profile} />}
      {tab === "taches" && (isCommercial || isTechnicien || isTechnicienBMI || isRespCom) && <MesTaches db={db} save={save} profile={profile} />}
      {tab === "parc" && (isAdmin || isCommercial || isTechnicien || isTechnicienBMI || isRespCom) && <ClientsInstalles db={db} save={save} profile={profile} isAdmin={isAdmin} />}
      {tab === "messages" && <Messagerie db={db} save={save} profile={profile} />}
      {tab === "ravitaillement" && profile.boutique && <DemandeRavitaillement db={db} save={save} profile={profile} boutique={profile.boutique} marquerVues />}
      {tab === "salaire" && SALARIES.includes(profile.role) && <Salaire db={db} save={save} profile={profile} />}
      {tab === "espace_client" && isClient && <EspaceClient db={db} profile={profile} save={save} setTab={setTab} />}
      {tab === "prospects" && (isAdmin || isCommercial || isTechnicienBMI || isRespCom) && <Prospects db={db} save={save} profile={profile} isAdmin={isAdmin} />}
      {tab === "parametres" && isAdmin && <Parametres db={db} save={save} setDb={setDb} profile={profile} dossierAuto={dossierAuto} setDossierAuto={setDossierAuto} dernierAuto={dernierAuto} />}
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
          <img src={LOGO} alt="BMI" className="h-11 w-auto rounded-lg bg-white p-1" />
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
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {tabsAutorises.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
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
            <button onClick={() => deconnexion(false)} disabled={sync.enAttente > 0} title={sync.enAttente > 0 ? "Déconnexion bloquée : des opérations restent à envoyer au serveur (envoi automatique en cours)" : ""} className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold ${sync.enAttente > 0 ? "bg-amber-500/30 text-amber-100 cursor-not-allowed" : "bg-white/10 hover:bg-white/20"}`}>{sync.enAttente > 0 ? `📤 ${sync.enAttente} à envoyer…` : "Se déconnecter"}</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ══ En-tête compact (petit écran) ══ */}
        <header className="lg:hidden bg-gradient-to-r from-slate-900 via-sky-950 to-sky-900 text-white shadow-md">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO} alt="BMI Togo" className="h-10 w-auto rounded bg-white p-1 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-lg leading-tight truncate">BMI-GESTION SYSTÈME</div>
                <div className="text-xs text-slate-400 truncate flex items-center gap-2 flex-wrap">
                  {profile?.nom && <span className="font-bold text-orange-500">👤 {profile.nom}</span>}
                  <span>v{VERSION}</span>
                </div>
              </div>
            </div>
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
            <button onClick={() => deconnexion(false)} disabled={sync.enAttente > 0} title={sync.enAttente > 0 ? "Déconnexion bloquée : des opérations restent à envoyer au serveur (envoi automatique en cours)" : ""} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${sync.enAttente > 0 ? "bg-amber-600 text-white cursor-not-allowed opacity-80" : "bg-slate-700 hover:bg-slate-600"}`}>{sync.enAttente > 0 ? `📤 ${sync.enAttente} à envoyer…` : "Se déconnecter"}</button>
          </div>
          <nav className="px-4 flex gap-1 overflow-x-auto">
            {tabsAutorises.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
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
  return db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => u.devis || [])
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
