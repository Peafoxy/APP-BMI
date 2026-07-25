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
import { Dimensionnement, TYPES_PORTAIL } from "./screens/Dimensionnement";
import { TousLesDevis } from "./screens/TousLesDevis";
import { Prospects } from "./screens/Prospects";
import { EspaceClient } from "./screens/EspaceClient";
import { Messagerie, peutVoirFilClient } from "./screens/Messagerie";
import { ClientsInstalles } from "./screens/ClientsInstalles";
import {
  ADRESSE_APP, chiffresTel, identifiantClient, motDePasseClient, envoyerIdentifiantsWhatsApp,
  envoyerAccueilProspectWhatsApp, fabriquerCompteClient, messagesNouveauClient, motDePasseConnu,
} from "./lib/comptesClients";
import { initialiserDonnees, amorcerSiVide, chargerTout, sauvegarderDiff, joursDepuisSauvegarde, marquerSauvegarde, forcerResynchronisation, autoResyncDejaFaite, marquerAutoResyncFaite,
  memoriserDossier, lireDossier, oublierDossier, marquerSauvegardeAuto, heuresDepuisSauvegardeAuto, viderLocal } from "./db";
import { demarrerSync, arreterSync, synchroniser, synchroniserOuverture, reinitialiserDistant, amorcerComptes } from "./sync";
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
  tachesDe, tachesOuvertes, compterReponsesRavitaillement, compterTaches, compterNotifsSalaire, compterDemandesCredit,
  paieMois, libelleMoisFR, periodes,
  NOTE_DIM_DEFAUT, noteDimensionnement, statutChantier,
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
          const u = donnees.users.find((x) => x.id === id);
          if (u && u.actif !== false && Date.now() - ts < DUREE_INACTIVITE) {
            setProfile(u);
            setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
          } else {
            localStorage.removeItem("bmi_session");
          }
        }
      } catch {}

      demarrerSync(async (etat) => {       // sync Supabase en arrière-plan
        setSync(etat);
        if (etat.rafraichir) setDb(await chargerTout());
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
        setProfile(null);
        try { localStorage.removeItem("bmi_session"); } catch {}
      }
    }, 30000);
    return () => { evts.forEach((e) => window.removeEventListener(e, activite)); clearInterval(minuterie); };
  }, [profile]);

  // Toute modification est écrite d'abord en local (instantané, même sans
  // réseau), puis mise en file pour Supabase.
  // Toute action sensible est tracée dans le journal d'audit (onglet Historique)
  const save = async (next, action) => {
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
  if (!profile) return <><DialogHost /><Login db={db} save={save} onLogin={(u) => {
    setProfile(u);
    try { localStorage.setItem("bmi_session", JSON.stringify({ id: u.id, ts: Date.now() })); } catch {}
    // Synchronisation d'ouverture à CHAQUE connexion manuelle : envoie d'abord ce
    // qui est en attente, puis relit. Sans écraser les données locales.
    synchroniserOuverture().then(async () => { setDb(await chargerTout()); }).catch(() => {});
    setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
  }} /></>;

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
  const demandesCredit = isAdmin ? compterDemandesCredit(db) : 0;
  const labelUsers = `👥 Utilisateurs${demandesCredit ? ` (${demandesCredit})` : ""}`;

  const tabs = isAdmin
    ? [["dashboard", "📊 Tableau de bord"], ["ventes", "💰 Ventes"], ["commandes", labelCommandes], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["fournisseurs", "🚚 Fournisseurs"], ["commerciaux", "🎯 Commerciaux"], ["equipe", "👑 Équipe"], ["prospects", "🧲 Prospects"], ["parc", labelParc], ["messages", labelMessages], ["salaires", "💵 Salaires"], ["users", labelUsers], ["historique", "🕘 Historique"], ["parametres", "⚙ Paramètres"]]
    : isComptable
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["depenses", "📤 Dépenses"], ["chez_comptable", "🧾 Chez le comptable"], ["dettes", "🧾 Dettes"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["clients", "👤 Clients"], ["historique", "🕘 Historique"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isRespCom
    ? [["equipe", "👑 Mon équipe"], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["parc", labelParc], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : (isCommercial || isTechnicien)
    ? [["commande", "🛒 Nouvelle commande"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["prospects", "🧲 Prospects"], ["parc", "🏠 Clients installés"], ["taches", labelTaches], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["nouveau_client", "🙋 Créer un client"], ...(estChefEquipe(db, profile) ? [["equipe", "👑 Mon équipe"]] : [])]
    : isTechnicienBMI
    ? [["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["parc", "🏠 Clients installés"], ["prospects", "🧲 Prospects"], ["commission", "💵 Ma commission"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
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
      {tab === "commission" && jeSuisApporteur && <MaCommission db={db} profile={profile} />}
      {tab === "equipe" && (isAdmin || isRespCom || ((isCommercial || isTechnicien) && estChefEquipe(db, profile))) && <MonEquipe db={db} save={save} profile={profile} />}
      {tab === "taches" && (isCommercial || isTechnicien || isRespCom) && <MesTaches db={db} save={save} profile={profile} />}
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
            <button onClick={() => { setProfile(null); try { localStorage.removeItem("bmi_session"); } catch {} }} className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold">Se déconnecter</button>
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
            <button onClick={() => { setProfile(null); try { localStorage.removeItem("bmi_session"); } catch {} }} className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold whitespace-nowrap">Se déconnecter</button>
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



// ============ FOURNISSEURS ============
function Fournisseurs({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, fournisseurs: [...db.fournisseurs, { id: uid(), nom: f.nom, tel: f.tel, adresse: f.adresse, site_web: f.site_web, produits: f.produits, doit: Number(f.doit || 0), paye: Number(f.paye || 0) }] });
    setF({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });
    uAlert("Fournisseur ajouté !");
  };

  const payer = async (fo) => {
    const s = await uPrompt(`Montant réglé à ${fo.nom} (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, paye: Number(x.paye) + m } : x)) });
    uAlert(`Paiement de ${fmt(m)} enregistré !`);
  };

  const nouvelleDette = async (fo) => {
    const s = await uPrompt(`Nouvelle commande à crédit chez ${fo.nom} — montant (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, doit: Number(x.doit) + m } : x)) });
    uAlert(`Commande de ${fmt(m)} enregistrée !`);
  };

  const supprimer = async (fo) => {
    if (await uConfirm(`Supprimer le fournisseur « ${fo.nom} » ?`)) save({ ...db, fournisseurs: db.fournisseurs.filter((x) => x.id !== fo.id) });
  };

  const liste = db.fournisseurs || [];
  const resteTotal = liste.reduce((s, x) => s + Math.max(0, x.doit - x.paye), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau fournisseur</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Adresse"><input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></Field>
          <Field label="Site web"><input type="url" placeholder="https://..." className={inputCls} value={f.site_web} onChange={(e) => setF({ ...f, site_web: e.target.value })} /></Field>
          <Field label="Produits"><input className={inputCls} value={f.produits} onChange={(e) => setF({ ...f, produits: e.target.value })} /></Field>
          <Field label="Dû (F)"><input type="number" className={inputCls} value={f.doit} onChange={(e) => setF({ ...f, doit: e.target.value })} /></Field>
          <Field label="Réglé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Fournisseurs <span className="text-sm font-normal text-slate-500">· Reste à régler : {fmt(resteTotal)}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Téléphone", "Adresse", "Site", "Produits", "Dû", "Réglé", "Reste", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">Aucun fournisseur.</td></tr>}
            {liste.map((fo) => {
              const reste = Math.max(0, fo.doit - fo.paye);
              return (
                <tr key={fo.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{fo.nom}</td>
                  <td className="px-3 py-2">{fo.tel || "—"}</td>
                  <td className="px-3 py-2">{fo.adresse || "—"}</td>
                  <td className="px-3 py-2">{fo.site_web ? <a href={fo.site_web.startsWith("http") ? fo.site_web : "https://" + fo.site_web} target="_blank" rel="noreferrer" className="text-blue-700 underline">Visiter</a> : "—"}</td>
                  <td className="px-3 py-2">{fo.produits || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.doit)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.paye)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(reste)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => nouvelleDette(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Commande</button>
                    <button onClick={() => payer(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Règlement</button>
                    <button onClick={() => supprimer(fo)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ COMMERCIAUX ============
function Commerciaux({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
  const [periodeIndex, setPeriodeIndex] = useState(2); // Ce mois par défaut
  const [customDebut, setCustomDebut] = useState("");
  const [customFin, setCustomFin] = useState("");

  // Période d'évaluation choisie par l'administrateur
  const [labelP, debutP, finP] = (() => {
    if (periodeIndex === "custom") return ["Période personnalisée", customDebut || today(), customFin || today()];
    return periodes()[periodeIndex] || periodes()[2];
  })();

  // Nombre de mois couverts (pour proratiser l'objectif mensuel)
  const nbMois = (() => {
    if (debutP <= "0001-01-01") return null; // "Depuis le début" : pas d'objectif comparable
    const a1 = Number(debutP.slice(0, 4)), m1 = Number(debutP.slice(5, 7));
    const a2 = Number(finP.slice(0, 4)), m2 = Number(finP.slice(5, 7));
    return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1);
  })();

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, commerciaux: [...db.commerciaux, { id: uid(), nom: f.nom, tel: f.tel, zone: f.zone, taux: Number(f.taux || 0), objectif: Number(f.objectif || 0), actif: true }] });
    setF({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
    uAlert("Commercial ajouté !");
  };

  const modifier = async (c) => {
    const taux = await uPrompt(`Taux de commission de ${c.nom} (%) :`, c.taux);
    if (taux === null) return;
    const objectif = await uPrompt(`Objectif mensuel de ${c.nom} (F) :`, c.objectif);
    if (objectif === null) return;
    save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, taux: Number(taux || 0), objectif: Number(objectif || 0) } : x)) });
  };

  const toggleActif = (c) => save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, actif: x.actif === false } : x)) });

  const supprimer = async (c) => {
    if (await uConfirm(`Supprimer le commercial « ${c.nom} » ?`)) save({ ...db, commerciaux: db.commerciaux.filter((x) => x.id !== c.id) });
  };

  // Statistiques d'un commercial sur la période choisie
  const stats = (c) => {
    const vs = db.ventes.filter((v) => v.commercial === c.nom && inP(v.date, debutP, finP));
    const ca = vs.reduce((s, v) => s + totalVente(v), 0);
    const commission = Math.round((ca * Number(c.taux)) / 100);
    const objectifP = nbMois && c.objectif > 0 ? c.objectif * nbMois : null;
    const pct = objectifP ? Math.round((ca / objectifP) * 100) : null;
    const panier = vs.length ? Math.round(ca / vs.length) : 0;
    return { nb: vs.length, ca, commission, objectifP, pct, panier };
  };

  const liste = db.commerciaux || [];
  const classement = liste.map((c) => ({ c, s: stats(c) })).sort((a, b) => b.s.ca - a.s.ca);
  const totalCA = classement.reduce((s, x) => s + x.s.ca, 0);
  const totalCommissions = classement.reduce((s, x) => s + x.s.commission, 0);
  const totalVentes = classement.reduce((s, x) => s + x.s.nb, 0);

  const badgePerf = (pct) => {
    if (pct === null) return null;
    if (pct >= 100) return ["Objectif atteint", "bg-green-100 text-green-700"];
    if (pct >= 60) return ["En bonne voie", "bg-amber-100 text-amber-700"];
    return ["À suivre", "bg-red-100 text-red-700"];
  };
  const medaille = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}ᵉ`);

  const Stat = ({ label, value }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-sky-700">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau commercial</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Zone"><input className={inputCls} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} /></Field>
          <Field label="Commission (%)"><input type="number" step="0.5" className={inputCls} value={f.taux} onChange={(e) => setF({ ...f, taux: e.target.value })} /></Field>
          <Field label="Objectif mensuel (F)"><input type="number" className={inputCls} value={f.objectif} onChange={(e) => setF({ ...f, objectif: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-bold text-slate-800">Période d'évaluation :</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
            value={periodeIndex}
            onChange={(e) => setPeriodeIndex(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          >
            {periodes().map(([label], i) => <option key={i} value={i}>{label}</option>)}
            <option value="custom">Personnalisée</option>
          </select>
          {periodeIndex === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customDebut} onChange={(e) => setCustomDebut(e.target.value)} />
              <span className="text-slate-400">→</span>
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customFin} onChange={(e) => setCustomFin(e.target.value)} />
            </div>
          )}
          {nbMois > 1 && <span className="text-xs text-slate-500">Objectifs proratisés sur {nbMois} mois</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={`CA équipe — ${labelP}`} value={fmt(totalCA)} />
        <Stat label="Commissions à payer" value={fmt(totalCommissions)} />
        <Stat label="Ventes réalisées" value={totalVentes} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span>Performance — {labelP} <span className="text-sm font-normal text-slate-500">({dFR(debutP)} → {dFR(finP)})</span></span>
          <button
            className="px-4 py-1.5 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900"
            onClick={() => exportCSV("commissions", ["Rang", "Commercial", "Zone", "Période", "Ventes", "CA (F)", "Panier moyen (F)", "Taux (%)", "Commission (F)", "Objectif période (F)", "Atteinte (%)"],
              classement.map(({ c, s }, i) => [i + 1, c.nom, c.zone, `${dFR(debutP)} au ${dFR(finP)}`, s.nb, s.ca, s.panier, c.taux, s.commission, s.objectifP ?? "", s.pct ?? ""]))}
          >📄 Exporter les commissions</button>
        </div>
        <table className="w-full text-sm min-w-[1080px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Rang", "Commercial", "Zone", "Ventes", "CA", "Panier moyen", "Taux", "Commission", "Objectif période", "Progression", "Performance", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {classement.length === 0 && <tr><td colSpan={13} className="px-4 py-6 text-center text-slate-400">Aucun commercial.</td></tr>}
            {classement.map(({ c, s }, i) => {
              const perf = badgePerf(s.pct);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-bold">{medaille(i)}</td>
                  <td className="px-3 py-2 font-semibold">{c.nom}{c.tel && <a href={`https://wa.me/${telDigits(c.tel)}`} target="_blank" rel="noreferrer" className="ml-2 text-xs text-green-700 underline">WhatsApp</a>}</td>
                  <td className="px-3 py-2">{c.zone || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(s.ca)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb ? fmt(s.panier) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.taux}%</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(s.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.objectifP ? fmt(s.objectifP) : "—"}</td>
                  <td className="px-3 py-2 w-32">
                    {s.pct === null ? "—" : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.pct >= 100 ? "bg-green-500" : s.pct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, s.pct)}%` }}></div>
                        </div>
                        <span className="text-xs font-bold tabular-nums">{s.pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{perf ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${perf[1]}`}>{perf[0]}</span> : "—"}</td>
                  <td className="px-3 py-2">{c.actif === false ? <span className="text-xs font-bold text-red-600">Inactif</span> : <span className="text-xs font-bold text-green-700">Actif</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => modifier(c)} className="text-xs font-bold text-sky-800 underline mr-2">Modifier</button>
                    <button onClick={() => toggleActif(c)} className="text-xs font-bold text-sky-800 underline mr-2">{c.actif === false ? "Réactiver" : "Désactiver"}</button>
                    <button onClick={() => supprimer(c)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ UTILISATEURS ============
function Users({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [avisOuvert, setAvisOuvert] = useState(null);
  const vide = { nom: "", pwd: "", tel: "", role: "vendeur", boutique: premiere, taux: "5" };
  const [f, setF] = useState(vide);
  const [msg, setMsg] = useState("");

  const creer = async () => {
    // ══════ DEUX RÈGLES, ET DEUX SEULEMENT ══════
    // 1. CLIENT  → mot de passe GÉNÉRÉ (4 derniers chiffres du téléphone +
    //    2 premières lettres du nom). Il est donc recalculable : on peut le lui
    //    renvoyer à tout moment, sans jamais le stocker en clair.
    // 2. EMPLOYÉ → mot de passe SAISI À LA MAIN par l'administrateur.
    // Aucun mélange : un compte client créé avec un mot de passe manuel serait
    // irrécupérable, personne ne pourrait le lui renvoyer.
    if (f.role === "client") {
      if (!f.nom.trim() || chiffresTel(f.tel).length < 4) {
        setMsg("Pour un client : le NOM et le NUMÉRO suffisent. Le mot de passe est généré automatiquement.");
        return;
      }
      const identifiant = identifiantClient(db, f.nom, f.tel);
      const motDePasse = motDePasseClient(f.nom, f.tel);
      if (!await uConfirm(
        `Créer le compte client de ${f.nom.trim().toUpperCase()} ?\n\n` +
        `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
        `Remettez-lui ces identifiants.`
      )) return;
      const nomCli = f.nom, telCli = f.tel;
      const { user } = await fabriquerCompteClient(db, f.nom, f.tel, profile.nom);
      save({ ...db, users: [...db.users, user], messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])] }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}`);
      setF(vide);
      setMsg(`✅ Client créé — identifiant : ${identifiant} · mot de passe : ${motDePasse}`);
      // Envoi automatique des identifiants par WhatsApp.
      if (await uConfirm(`✅ Client créé.\n\n👤 ${identifiant}\n🔑 ${motDePasse}\n\nEnvoyer ces identifiants au client par WhatsApp ?`)) {
        envoyerIdentifiantsWhatsApp(nomCli, identifiant, motDePasse, telCli);
      }
      return;
    }

    if (!f.nom || f.pwd.length < 6) { setMsg("Remplissez le nom et un mot de passe (6 caractères minimum, exigé par la sécurisation Supabase)."); return; }
    const estMultiBoutique = f.role === "admin" || f.role === "commercial" || f.role === "technicien" || f.role === "technicien_bmi" || f.role === "resp_commercial" || f.role === "comptable" || f.role === "client";
    const nouvelUser = { id: uid(), nom: f.nom, ...await definirMotDePasse(f.pwd), role: f.role, boutique: estMultiBoutique ? null : f.boutique, actif: true };
    if (f.role === "commercial" || f.role === "technicien") {
      nouvelUser.taux_commission = Number(f.taux || 0);
      if (f.chef) nouvelUser.chef_equipe = true;
    }
    // Responsable Commercial : salarié, avec un taux de commission FACULTATIF
    // (il n'est commissionné que si un commercial l'associe volontairement à une commande).
    if (f.role === "resp_commercial") nouvelUser.taux_commission = Number(f.taux_resp || 0);
    // Technicien BMI : salarié, mais s'il apporte un client, il touche une commission
    // sur cette vente, exactement comme un commercial.
    if (f.role === "technicien_bmi") nouvelUser.taux_commission = Number(f.taux_resp || 0);
    if (SALARIES.includes(f.role) && f.taux_avancement) {
      nouvelUser.taux_avancement = Number(f.taux_avancement);
    }
    let next = { ...db, users: [...db.users, nouvelUser] };
    // Un compte Commercial ou Technicien apparaît aussi dans l'onglet Commerciaux (attribution des ventes/commandes)
    if ((f.role === "commercial" || f.role === "technicien" || f.role === "technicien_bmi") && !db.commerciaux.some((c) => c.nom === f.nom)) {
      next = { ...next, commerciaux: [...db.commerciaux, { id: uid(), nom: f.nom, actif: true }] };
    }
    save(next, `Création utilisateur ${f.nom} (${f.role})`);
    setF({ nom: "", pwd: "", role: "vendeur", boutique: premiere, taux: "5" });
    setMsg("✅ Utilisateur créé");
    setTimeout(() => setMsg(""), 3000);
  };

  const toggleActif = (u) => {
    if (u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.actif !== false).length === 1 && u.actif !== false) {
      uAlert("Impossible de bloquer le dernier administrateur actif."); return;
    }
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, actif: x.actif === false } : x)) }, `${u.actif === false ? "Réactivation" : "Blocage"} du compte ${u.nom}`);
  };

  const changerPwd = async (u) => {
    const p = await uPrompt(`Nouveau mot de passe pour ${u.nom} (6 caractères minimum, exigé par la sécurisation Supabase) :`);
    if (!p || p.length < 6) { if (p !== null) uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const nouveauxChamps = await definirMotDePasse(p);
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, ...nouveauxChamps } : x)) }, `Changement de mot de passe : ${u.nom}`);
  };

  const supprimerU = async (u) => {
    if (profile && u.id === profile.id) { uAlert("Vous ne pouvez pas supprimer le compte avec lequel vous êtes connecté."); return; }
    const autresAdmins = db.users.filter((x) => x.role === "admin" && x.actif !== false && x.id !== u.id);
    if (u.role === "admin" && autresAdmins.length === 0) { uAlert("Impossible : il faut garder au moins un administrateur actif."); return; }
    if (await uConfirm(`Supprimer définitivement le compte « ${u.nom} » (${u.role}) ?\nSes ventes et actions passées restent enregistrées.`)) {
      save({ ...db, users: db.users.filter((x) => x.id !== u.id) }, `Suppression du compte ${u.nom} (${u.role})`);
    }
  };

  const changerBoutique = async (u) => {
    const noms = db.boutiques.map((b) => b.nom);
    const nom = await uChoix(`Boutique assignée à ${u.nom} ?`, noms);
    if (!nom) return;
    if (!noms.includes(nom)) { uAlert("Boutique inconnue."); return; }
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, boutique: nom } : x)) });
  };

  const basculerChatLibre = (u) => {
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, chat_libre: !x.chat_libre } : x)) }, `${u.chat_libre ? "Retrait" : "Autorisation"} du chat libre pour ${u.nom}`);
  };

  const basculerChef = (u) => {
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, chef_equipe: !x.chef_equipe } : x)) }, `${u.chef_equipe ? "Retrait" : "Nomination"} chef d'équipe : ${u.nom}`);
  };

  const choisirBoutiqueDebit = (u, titre) => choisirBoutiqueDebitG(db, u, titre);

  // ---- POUVOIRS : l'admin active/désactive chaque droit d'un compte ----
  const [pouvoirsPour, setPouvoirsPour] = useState(null);
  const cible = pouvoirsPour ? db.users.find((x) => x.id === pouvoirsPour) : null;

  const basculerPouvoir = (u, id, label) => {
    const off = u.droits_off || [];
    const actif = !off.includes(id);
    if (u.id === profile.id) { uAlert("Vous ne pouvez pas modifier vos propres pouvoirs."); return; }
    const nouveau = actif ? [...off, id] : off.filter((x) => x !== id);
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, droits_off: nouveau } : x)) },
      `${actif ? "Retrait" : "Rétablissement"} du pouvoir « ${label} » pour ${u.nom}`);
  };

  const toutRetablir = async (u) => {
    if (!(u.droits_off || []).length) { uAlert("Ce compte a déjà tous ses pouvoirs."); return; }
    if (await uConfirm(`Rétablir TOUS les pouvoirs de ${u.nom} ?`)) {
      save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, droits_off: [] } : x)) }, `Tous les pouvoirs rétablis pour ${u.nom}`);
    }
  };

  // ---- PARRAINAGE : quel commercial a recruté cet utilisateur ----
  // À 5 filleuls, le parrain devient automatiquement chef d'équipe.
  const changerParrain = async (u) => {
    const parrains = db.users.filter((x) => x.actif !== false && ["commercial", "technicien"].includes(x.role) && x.id !== u.id);
    if (!parrains.length) { uAlert("Aucun commercial disponible comme parrain."); return; }
    const actuel = db.users.find((x) => x.id === u.parrain_id);
    const noms = parrains.map((x) => x.nom);
    const v = await uPrompt(
      `Qui a recruté ${u.nom} ?\n\nCommerciaux :\n${noms.join("\n")}\n\n(laisser vide pour retirer le parrain)`,
      actuel ? actuel.nom : ""
    );
    if (v === null) return;
    const nom = v.trim().toUpperCase();
    if (!nom) {
      save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, parrain_id: null } : x)) }, `Parrain retiré à ${u.nom}`);
      return;
    }
    const p = parrains.find((x) => x.nom.toUpperCase() === nom);
    if (!p) { uAlert("Ce commercial n'existe pas."); return; }
    const nb = filleulsDe(db, p).length + 1;
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, parrain_id: p.id } : x)) },
      `${u.nom} rattaché à l'équipe de ${p.nom} (${nb} filleul(s))`);
    if (nb === SEUIL_CHEF_EQUIPE) uAlert(`🎖 ${p.nom} atteint ${SEUIL_CHEF_EQUIPE} recrues : il devient CHEF D'ÉQUIPE et touchera une commission sur les commissions de son équipe.`);
  };

  const changerTauxEquipe = async (u) => {
    const v = await uPrompt(`Commission d'équipe de ${u.nom} (%) — pourcentage qu'il touche sur les commissions de ses filleuls :`, String(u.taux_equipe ?? TAUX_EQUIPE_DEFAUT));
    if (v === null) return;
    const t = Math.max(0, Math.min(50, Number(v) || 0));
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, taux_equipe: t } : x)) },
      `Commission d'équipe de ${u.nom} fixée à ${t} %`);
  };

  // ---- TAUX DE COMMISSION (tout rôle : celui qui amène un client est commissionné) ----
  const changerTauxCommission = async (u) => {
    const v = await uPrompt(`Taux de commission de ${u.nom} (%) — appliqué à toute vente qui lui est attribuée.\n0 = aucune commission.`, String(u.taux_commission ?? 0));
    if (v === null) return;
    const taux = Math.max(0, Math.min(100, Number(v) || 0));
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, taux_commission: taux } : x)) },
      `Taux de commission de ${u.nom} fixé à ${taux} %`);
  };

  // ---- IDENTITÉ OFFICIELLE (nom et prénoms + pièce d'identité) ----
  // Renseignée après la création du compte. C'est cette identité qui figure
  // sur le bulletin de paie (le « nom » du compte ne sert qu'à la connexion).
  const changerIdentite = async (u) => {
    const nc = await uPrompt(`Nom et prénom(s) officiels de ${u.nom} (tels qu'ils apparaîtront sur le bulletin de paie) :`, u.nom_complet || u.nom || "");
    if (nc === null) return;
    if (!nc.trim()) { uAlert("Le nom et prénom(s) sont obligatoires."); return; }
    const tp = await uPrompt("Type de pièce d'identité (CNI / Passeport / Carte d'électeur / Permis) :", u.piece_type || "CNI");
    if (tp === null) return;
    const num = await uPrompt("Numéro de la pièce d'identité (laisser vide si non communiqué) :", u.piece_num || "");
    if (num === null) return;
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, nom_complet: nc.trim(), piece_type: tp.trim(), piece_num: num.trim() } : x)) },
      `Identité de ${u.nom} enregistrée : ${nc.trim()}${num.trim() ? ` (${tp.trim()} n° ${num.trim()})` : ""}`);
  };

  const changerTauxAvancement = async (u) => {
    const v = await uPrompt(`Taux d'avancement annuel de ${u.nom} (en %) :`, String(u.taux_avancement || ""));
    if (v === null) return;
    const taux = Math.max(0, Number(v) || 0);
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, taux_avancement: taux } : x)) }, `Taux d'avancement de ${u.nom} fixé à ${taux} %`);
  };

  // Avancement : chaque changement de salaire est archivé dans un historique
  // (date, ancien montant, nouveau montant, motif). Si un taux d'avancement
  // est défini pour l'employé, le nouveau montant est pré-calculé
  // automatiquement (ancien × (1 + taux %)) — l'admin peut toujours l'ajuster.
  const changerSalaire = async (u) => {
    const ancien0 = Number(u.salaire_base || 0);
    const taux0 = Number(u.taux_avancement || 0);
    const suggestion = ancien0 > 0 && taux0 > 0 ? String(Math.round(ancien0 * (1 + taux0 / 100))) : String(u.salaire_base || "");
    const v = await uPrompt(`Nouveau salaire de base mensuel de ${u.nom} (en F CFA)${ancien0 > 0 && taux0 > 0 ? ` — proposition avec avancement de ${taux0} % appliqué` : ""} :`, suggestion);
    if (v === null) return;
    const montant = Math.max(0, Number(v) || 0);
    const ancien = Number(u.salaire_base || 0);
    let motif = "";
    if (ancien > 0 && montant !== ancien) {
      const m = await uPrompt(`Motif de cet avancement (ex : ancienneté, promotion, mérite...) :`, "");
      if (m === null) return;
      motif = m.trim();
    }
    // On archive aussi le taux d'avancement fixé par l'admin au moment du
    // changement, et le pourcentage réellement appliqué (calculé sur les montants).
    const pct = ancien > 0 ? Math.round(((montant - ancien) / ancien) * 1000) / 10 : null;
    const evolution = { date: today(), ancien, nouveau: montant, motif, par: profile.nom, taux_prevu: taux0 || null, pct };
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, salaire_base: montant, evolutions_salaire: ancien !== montant ? [...(x.evolutions_salaire || []), evolution] : (x.evolutions_salaire || []) } : x)) },
      `Salaire de ${u.nom} : ${ancien ? fmt(ancien) + " → " : ""}${fmt(montant)}${motif ? " (" + motif + ")" : ""}`);
  };

  // Enregistre une prime ou une avance sur salaire pour un mois donné.
  // L'avance est déduite du net à percevoir du mois concerné.
  const ajouterMouvementSalaire = async (u, type) => {
    const libelle = type === "prime" ? "prime" : "avance sur salaire";
    const mois = await uPrompt(`Mois de la ${libelle} pour ${u.nom} (AAAA-MM) :`, today().slice(0, 7));
    if (!mois) return;
    if (!/^\d{4}-\d{2}$/.test(mois.trim())) { uAlert("Format attendu : AAAA-MM (ex : 2026-07)."); return; }
    const v = await uPrompt(`Montant de la ${libelle} (F CFA) :`, "");
    if (v === null) return;
    const montant = Number(v);
    if (!montant || montant <= 0) { uAlert("Montant invalide."); return; }
    const motif = await uPrompt("Motif (facultatif) :", "");
    if (motif === null) return;
    const mouvement = { mois: mois.trim(), montant, motif: motif.trim(), date: today(), par: profile.nom };
    const champ = type === "prime" ? "primes" : "avances";
    let next = { ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, [champ]: [...(x[champ] || []), mouvement] } : x)) };

    // Une AVANCE est de l'argent réellement remis à l'employé : elle sort de la caisse.
    // (Une PRIME, elle, sera versée avec le salaire du mois : pas de sortie immédiate.)
    if (type === "avance") {
      const bq = await choisirBoutiqueDebit(u, `Avance de ${fmt(montant)} à ${u.nom}`);
      if (bq === null) return;
      const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
      if (moyen === null) return;
      const dep = {
        id: uid(), date: today(), boutique: bq, categorie: "Salaires",
        description: `Avance sur salaire ${libelleMoisFR(mois.trim())} — ${u.nom}`,
        montant, paiement: normPaiement(moyen), par: profile.nom, auto: "avance", user_id: u.id
      };
      next = { ...next, depenses: [dep, ...next.depenses], messages: [...messagesNotifSortieCaisse(db, profile, bq, u.nom, montant, "Avance versée à"), ...(db.messages || [])] };
    }

    save(next, `${type === "prime" ? "Prime" : "Avance"} de ${fmt(montant)} pour ${u.nom} (${mois.trim()})${motif.trim() ? " — " + motif.trim() : ""}`);
  };

  // ---- VIREMENT DE SALAIRE ----
  // L'admin envoie le versement ; il reste « en attente » jusqu'à ce que
  // l'employé le confirme depuis son onglet 💵 Salaire.
  const envoyerVirement = (u) => envoyerVirementG(db, save, profile, u);

  const annulerVirement = async (u) => {
    const attente = (u.virements || []).filter((v) => v.statut !== "accepte");
    if (!attente.length) { uAlert("Aucun virement en attente pour cet employé."); return; }
    const dernier = attente[attente.length - 1];
    if (await uConfirm(`Annuler le virement de ${fmt(dernier.montant)} (${libelleMoisFR(dernier.mois)}) envoyé à ${u.nom} ?\n\nSeuls les virements non encore confirmés peuvent être annulés.`)) {
      // On retire aussi les écritures de caisse générées par ce virement (même jour, même employé)
      const aRetirer = (d) => ["virement", "retenue"].includes(d.auto) && d.user_id === u.id && d.date === dernier.date_envoi;
      save({
        ...db,
        users: db.users.map((x) => (x.id === u.id ? { ...x, virements: (x.virements || []).filter((v) => v.id !== dernier.id) } : x)),
        depenses: db.depenses.filter((d) => !aRetirer(d))
      }, `Annulation du virement de ${fmt(dernier.montant)} pour ${u.nom} (${libelleMoisFR(dernier.mois)})`);
    }
  };

  // ---- CRÉDIT BMI : décision de l'administrateur ----
  const majCredit = (u, credit, label) =>
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, credits: creditsDe(x).map((c) => (c.id === credit.id ? credit : c)) } : x)) }, label);

  const approuverCredit = async (u, c) => {
    const v = await uPrompt(`Montant accordé à ${u.nom} (demandé : ${fmt(c.montant_demande)}) :`, String(c.montant_demande));
    if (v === null) return;
    const montant = Number(v);
    if (!montant || montant <= 0) { uAlert("Montant invalide."); return; }
    let echeances = [];
    let mensualites = 0;
    if (c.mode === "salaire") {
      const n = await uPrompt("Nombre de mensualités retenues sur salaire :", String(c.mensualites || 3));
      if (n === null) return;
      mensualites = Math.max(1, Math.min(36, Number(n) || 1));
      const depart = await uPrompt("Premier mois de retenue (AAAA-MM) :", moisPlus(today().slice(0, 7), 1));
      if (!depart) return;
      if (!/^\d{4}-\d{2}$/.test(depart.trim())) { uAlert("Format attendu : AAAA-MM (ex : 2026-08)."); return; }
      const part = Math.round(montant / mensualites);
      for (let i = 0; i < mensualites; i++) {
        echeances.push({ mois: moisPlus(depart.trim(), i), montant: i === mensualites - 1 ? montant - part * (mensualites - 1) : part, paye: false });
      }
    }
    const note = await uPrompt("Commentaire (facultatif) :", "");
    if (note === null) return;
    const moyen = await uPrompt("Moyen de remise des fonds (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebit(u, `Crédit de ${fmt(montant)} à ${u.nom}`);
    if (bq === null) return;
    const resume = c.mode === "salaire"
      ? `${mensualites} mensualité(s) de ${fmt(Math.round(montant / mensualites))} retenues sur salaire, à partir de ${libelleMoisFR(echeances[0].mois)}.`
      : "Remboursement libre (versements enregistrés par l'administration).";
    if (!await uConfirm(`Accorder un crédit de ${fmt(montant)} à ${u.nom} ?\n\n${resume}\n\nSortie de caisse ${bq || ""} : ${fmt(montant)} (compte « Prêt au personnel »).`)) return;
    const credit = { ...c, statut: "approuve", montant_accorde: montant, mensualites, echeances, commentaire: note.trim(), date_decision: today(), decide_par: profile.nom, boutique: bq };
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Prêt au personnel",
      description: `Crédit BMI accordé à ${u.nom}${c.motif ? " — " + c.motif : ""}`,
      montant, paiement: normPaiement(moyen), par: profile.nom, auto: "credit", user_id: u.id, credit_id: c.id
    };
    save({
      ...db,
      users: db.users.map((x) => (x.id === u.id ? { ...x, credits: creditsDe(x).map((y) => (y.id === c.id ? credit : y)) } : x)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifSortieCaisse(db, profile, bq, u.nom, montant, "Crédit BMI accordé à"), ...(db.messages || [])],
    }, `Crédit BMI de ${fmt(montant)} accordé à ${u.nom}`);
    uAlert(`✅ Crédit de ${fmt(montant)} accordé à ${u.nom}. Sortie de caisse enregistrée.`);
  };

  const refuserCredit = async (u, c) => {
    const motif = await uPrompt(`Motif du refus (visible par ${u.nom}) :`, "");
    if (motif === null) return;
    if (!await uConfirm(`Refuser la demande de crédit de ${fmt(c.montant_demande)} de ${u.nom} ?`)) return;
    majCredit(u, { ...c, statut: "refuse", commentaire: motif.trim(), date_decision: today(), decide_par: profile.nom },
      `Demande de crédit de ${u.nom} refusée (${fmt(c.montant_demande)})`);
  };

  const rembourserCredit = async (u, c) => {
    const reste = resteCredit(c);
    const v = await uPrompt(`Versement de remboursement de ${u.nom} (reste dû : ${fmt(reste)}) :`, String(reste));
    if (v === null) return;
    const montant = Number(v);
    if (!montant || montant <= 0) { uAlert("Montant invalide."); return; }
    if (montant > reste) { uAlert(`Le montant dépasse le reste dû (${fmt(reste)}).`); return; }
    const note = await uPrompt("Moyen de paiement reçu (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
    if (note === null) return;
    const bq = await choisirBoutiqueDebit(u, `Remboursement de ${fmt(montant)} par ${u.nom}`);
    if (bq === null) return;
    const remboursements = [...(c.remboursements || []), { date: today(), montant, par: profile.nom, source: "manuel", note: note.trim() }];
    const solde = Number(c.montant_accorde || 0) - remboursements.reduce((s, r) => s + Number(r.montant || 0), 0) <= 0;
    const credit = { ...c, remboursements, statut: solde ? "solde" : c.statut, date_solde: solde ? today() : c.date_solde };
    // Montant négatif : l'argent RENTRE dans la caisse
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Prêt au personnel",
      description: `Remboursement crédit BMI — ${u.nom}`,
      montant: -montant, paiement: normPaiement(note), par: profile.nom, auto: "remboursement", user_id: u.id, credit_id: c.id
    };
    save({
      ...db,
      users: db.users.map((x) => (x.id === u.id ? { ...x, credits: creditsDe(x).map((y) => (y.id === c.id ? credit : y)) } : x)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifSortieCaisse(db, profile, bq, u.nom, montant, "Remboursement de crédit reçu de", "entree"), ...(db.messages || [])],
    }, `Remboursement de crédit : ${fmt(montant)} de ${u.nom}${solde ? " — crédit soldé" : ""}`);
  };

  // Liste de tous les crédits, demandes en attente d'abord
  const rang = { en_attente: 0, approuve: 1, solde: 2, refuse: 3 };
  const tousCredits = db.users
    .flatMap((u) => creditsDe(u).map((c) => ({ u, c })))
    .sort((a, b) => (rang[a.c.statut] ?? 9) - (rang[b.c.statut] ?? 9) || String(b.c.date_demande).localeCompare(String(a.c.date_demande)));

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouvel utilisateur</div>

        {f.role === "client" && (
          <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-2 text-xs text-slate-700">
            🔑 <b>Compte client</b> : le mot de passe est <b>généré automatiquement</b> (4 derniers chiffres du numéro + 2 premières lettres du nom).
            Il reste ainsi recalculable — vous pourrez le lui renvoyer à tout moment.
            {f.nom.trim() && chiffresTel(f.tel).length >= 4 && (
              <div className="mt-1 font-bold text-sky-900">
                👤 {identifiantClient(db, f.nom, f.tel)} · 🔑 {motDePasseClient(f.nom, f.tel)}
              </div>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          {f.role === "client" ? (
            <Field label="Numéro de téléphone"><input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          ) : (
            <Field label="Mot de passe"><input className={inputCls} value={f.pwd} onChange={(e) => setF({ ...f, pwd: e.target.value })} /></Field>
          )}
          <Field label="Rôle"><select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="vendeur">Vendeur</option><option value="gerant">Gérant de boutique</option><option value="magasinier">Magasinier</option><option value="commercial">Commercial</option><option value="technicien">Technicien (commission)</option><option value="technicien_bmi">Technicien BMI (salarié)</option><option value="resp_commercial">Responsable Commercial (salarié)</option><option value="comptable">Comptable (lecture seule)</option><option value="client">Client</option><option value="admin">Administrateur</option></select></Field>
          {SALARIES_BOUTIQUE.includes(f.role) && <Field label="Boutique"><select className={inputCls} value={f.boutique} onChange={(e) => setF({ ...f, boutique: e.target.value })}>{db.boutiques.map((b) => <option key={b.nom} value={b.nom}>{b.depot ? "🏭 " : "🏪 "}{b.nom}</option>)}</select></Field>}
          {(f.role === "commercial" || f.role === "technicien") && <Field label="Taux de commission (%)"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.taux} onChange={(e) => setF({ ...f, taux: e.target.value })} /></Field>}
          {(f.role === "resp_commercial" || f.role === "technicien_bmi") && <Field label="Taux de commission (%) — facultatif"><input type="number" min="0" max="100" step="0.5" placeholder="0 = aucune commission" className={inputCls} value={f.taux_resp || ""} onChange={(e) => setF({ ...f, taux_resp: e.target.value })} /></Field>}
          {SALARIES.includes(f.role) && <Field label="Taux d'avancement annuel (%)"><input type="number" min="0" max="100" step="0.5" placeholder="Ex : 5" className={inputCls} value={f.taux_avancement || ""} onChange={(e) => setF({ ...f, taux_avancement: e.target.value })} /></Field>}
          {(f.role === "commercial" || f.role === "technicien") && (
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mt-6">
              <input type="checkbox" checked={!!f.chef} onChange={(e) => setF({ ...f, chef: e.target.checked })} />
              Chef d'équipe (responsable commercial)
            </label>
          )}
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button onClick={creer} className={btnDark}>Créer</button>
          {msg && <span className="text-sm font-semibold text-slate-700">{msg}</span>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Utilisateurs</div>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Rôle", "Boutique", "Salaire / Taux", "Statut", ""].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {db.users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2 font-semibold">{u.nom}
                  {u.nom_complet && <div className="text-xs font-normal text-slate-600">{u.nom_complet}</div>}
                  {["commercial", "technicien"].includes(u.role) && filleulsDe(db, u).length > 0 && (
                    <div className={`text-xs font-bold ${estChefEquipe(db, u) ? "text-amber-600" : "text-slate-500"}`}>
                      {estChefEquipe(db, u) ? "⭐ Chef d'équipe" : "👥"} — {filleulsDe(db, u).length} recrue(s){!estChefEquipe(db, u) ? ` / ${SEUIL_CHEF_EQUIPE}` : ""}
                    </div>
                  )}
                  {u.parrain_id && <div className="text-xs font-normal text-slate-400">Recruté par {(db.users.find((x) => x.id === u.parrain_id) || {}).nom || "?"}</div>}
                  {/* Les avis des clients : ils ne servent que s'ils remontent jusqu'ici. */}
                  {noteMoyenne(u) !== null && (
                    <button onClick={() => setAvisOuvert(avisOuvert === u.id ? null : u.id)} className="text-xs font-bold text-amber-600 hover:underline">
                      {etoiles(noteMoyenne(u))} {noteMoyenne(u).toFixed(1)}/5 ({(u.evaluations || []).length} avis)
                    </button>
                  )}
                  {avisOuvert === u.id && (
                    <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-2 space-y-2">
                      {CRITERES_NOTE.map((c) => {
                        const evs = u.evaluations || [];
                        const moy = evs.length ? evs.reduce((sm, e) => sm + Number(e[c.id] || 0), 0) / evs.length : 0;
                        return (
                          <div key={c.id} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{c.emoji} {c.label}</span>
                            <span className="font-bold text-amber-600">{etoiles(moy)} {moy.toFixed(1)}</span>
                          </div>
                        );
                      })}
                      {(u.evaluations || []).filter((e) => e.commentaire).slice(0, 5).map((e) => (
                        <div key={e.id} className="text-xs bg-white rounded border border-slate-200 p-2">
                          <div className="text-slate-700">« {e.commentaire} »</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{e.client_nom} · {dFR(e.date)} · {moyenneNote(e).toFixed(1)}/5</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {u.piece_num
                    ? <div className="text-xs font-normal text-slate-400">{u.piece_type || "Pièce"} n° {u.piece_num}</div>
                    : <div className="text-xs font-normal text-orange-500">⚠ Identité non renseignée</div>}
                </td>
                <td className="px-4 py-2">{u.role === "admin" ? "Administrateur" : u.role === "commercial" ? `Commercial (${u.taux_commission ?? 0}%)${u.chef_equipe ? " ⭐ Chef" : ""}` : u.role === "technicien" ? `Technicien (${u.taux_commission ?? 0}%)${u.chef_equipe ? " ⭐ Chef" : ""}` : u.role === "technicien_bmi" ? `🔧 Technicien BMI (salarié)${Number(u.taux_commission || 0) > 0 ? ` — commission ${u.taux_commission}%` : ""}` : u.role === "resp_commercial" ? `👑 Responsable Commercial${Number(u.taux_commission || 0) > 0 ? ` (${u.taux_commission}%)` : ""}` : u.role === "comptable" ? "📒 Comptable (lecture seule)" : u.role === "gerant" ? "Gérant de boutique" : u.role === "magasinier" ? "Magasinier" : u.role === "client" ? "Client" : "Vendeur"}</td>
                <td className="px-4 py-2">
                  {u.boutique
                    ? <Badge boutique={u.boutique} />
                    : u.role === "vendeur"
                    ? <span className="text-xs font-semibold text-orange-600">⚠ Boutique supprimée</span>
                    : "Toutes"}
                </td>
                <td className="px-4 py-2">
                  {SALARIES.includes(u.role) ? (
                    <div className="leading-tight">
                      <div className="font-semibold tabular-nums">{Number(u.salaire_base || 0) > 0 ? fmt(u.salaire_base) : <span className="text-slate-400">Non défini</span>}</div>
                      <div className="text-xs text-slate-500">
                        {Number(u.taux_avancement || 0) > 0 ? `Avancement : ${u.taux_avancement} %/an` : "Taux d'avancement non fixé"}
                      </div>
                      {(u.virements || []).some((v) => v.statut !== "accepte") && (
                        <div className="text-xs font-bold text-amber-600">⏳ {(u.virements || []).filter((v) => v.statut !== "accepte").length} virement(s) en attente</div>
                      )}
                      {creditsEnAttente(u).length > 0 && (
                        <div className="text-xs font-bold text-purple-700">📩 {creditsEnAttente(u).length} demande(s) de crédit</div>
                      )}
                      {creditsEnCours(u).length > 0 && (
                        <div className="text-xs font-bold text-red-600">🏦 Crédit : reste {fmt(creditsEnCours(u).reduce((s, c) => s + resteCredit(c), 0))}</div>
                      )}
                    </div>
                  ) : ["commercial", "technicien"].includes(u.role) ? (
                    <span className="text-xs text-slate-500">Commission {u.taux_commission ?? 0} %</span>
                  ) : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2">{u.actif === false ? <span className="text-xs font-bold text-red-600">Bloqué</span> : <span className="text-xs font-bold text-green-700">Actif</span>}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <button onClick={() => setPouvoirsPour(u.id)} className="text-xs font-bold text-purple-700 underline mr-2">🔐 Pouvoirs{(u.droits_off || []).length ? ` (${(u.droits_off || []).length} retiré${(u.droits_off || []).length > 1 ? "s" : ""})` : ""}</button>
                  {u.role !== "client" && <button onClick={() => changerTauxCommission(u)} className="text-xs font-bold text-green-700 underline mr-2">💰 Commission {u.taux_commission ?? 0}%</button>}
                  {["commercial", "technicien"].includes(u.role) && <button onClick={() => changerParrain(u)} className="text-xs font-bold text-amber-700 underline mr-2">🤝 Parrain</button>}
                  {["commercial", "technicien"].includes(u.role) && estChefEquipe(db, u) && <button onClick={() => changerTauxEquipe(u)} className="text-xs font-bold text-amber-700 underline mr-2">⭐ Équipe {u.taux_equipe ?? TAUX_EQUIPE_DEFAUT}%</button>}
                  <button onClick={() => changerIdentite(u)} className="text-xs font-bold text-sky-800 underline mr-2">🪪 Identité</button>
                  <button onClick={() => changerPwd(u)} className="text-xs font-bold text-sky-800 underline mr-2">Mot de passe</button>
                  {SALARIES_BOUTIQUE.includes(u.role) && <button onClick={() => changerBoutique(u)} className="text-xs font-bold text-sky-800 underline mr-2">Boutique</button>}
                  {SALARIES.includes(u.role) && <button onClick={() => changerSalaire(u)} className="text-xs font-bold text-sky-800 underline mr-2">Salaire</button>}
                  {SALARIES.includes(u.role) && <button onClick={() => changerTauxAvancement(u)} className="text-xs font-bold text-sky-800 underline mr-2">Taux %</button>}
                  {SALARIES.includes(u.role) && <button onClick={() => ajouterMouvementSalaire(u, "prime")} className="text-xs font-bold text-green-700 underline mr-2">+ Prime</button>}
                  {SALARIES.includes(u.role) && <button onClick={() => ajouterMouvementSalaire(u, "avance")} className="text-xs font-bold text-orange-600 underline mr-2">− Avance</button>}
                  {SALARIES.includes(u.role) && <button onClick={() => envoyerVirement(u)} className="text-xs font-bold text-blue-700 underline mr-2">💸 Virement</button>}
                  {SALARIES.includes(u.role) && (u.virements || []).some((v) => v.statut !== "accepte") && <button onClick={() => annulerVirement(u)} className="text-xs font-bold text-amber-700 underline mr-2">Annuler virement</button>}
                  {["commercial", "technicien"].includes(u.role) && <button onClick={() => basculerChef(u)} className="text-xs font-bold text-sky-800 underline mr-2">{u.chef_equipe ? "Retirer chef" : "Nommer chef"}</button>}
                  {u.role === "client" && <button onClick={() => basculerChatLibre(u)} className="text-xs font-bold text-sky-800 underline mr-2">{u.chat_libre ? "Retirer chat libre" : "Autoriser chat libre"}</button>}
                  <button onClick={() => toggleActif(u)} className="text-xs font-bold text-sky-800 underline mr-2">{u.actif === false ? "Réactiver" : "Bloquer"}</button>
                  <button onClick={() => supprimerU(u)} className="text-xs text-red-600 underline">Suppr.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cible && (
        <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3" onClick={() => setPouvoirsPour(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <div>
                <div className="font-bold text-slate-900">🔐 Pouvoirs de {cible.nom}</div>
                <div className="text-xs text-slate-500">Décochez un pouvoir pour le retirer à ce compte.</div>
              </div>
              <button onClick={() => setPouvoirsPour(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
            </div>
            <div className="overflow-auto p-4 space-y-4">
              {cible.id === profile.id && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  ⚠ C'est votre propre compte : vous ne pouvez pas modifier vos pouvoirs (sécurité anti-blocage).
                </div>
              )}
              {["Onglet", "Action"].map((groupe) => {
                const liste = pouvoirsDuRole(cible.role).filter(([, , g]) => g === groupe);
                if (!liste.length) return null;
                return (
                  <div key={groupe}>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-2">{groupe === "Onglet" ? "Onglets accessibles" : "Actions autorisées"}</div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {liste.map(([id, label]) => {
                        const actif = !(cible.droits_off || []).includes(id);
                        return (
                          <label key={id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${actif ? "bg-white border-slate-200" : "bg-red-50 border-red-200 text-red-700 line-through"}`}>
                            <input type="checkbox" checked={actif} onChange={() => basculerPouvoir(cible, id, label)} />
                            <span className="font-semibold">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">{(cible.droits_off || []).length} pouvoir(s) retiré(s)</span>
              <button onClick={() => toutRetablir(cible)} className={btnDark}>Tout rétablir</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>🏦 Crédits BMI</span>
          <span className="text-xs font-semibold text-slate-600">
            En attente : <b className="text-purple-700">{tousCredits.filter(({ c }) => c.statut === "en_attente").length}</b> ·
            Encours total : <b className="text-red-600 tabular-nums">{fmt(tousCredits.reduce((s, { c }) => s + (c.statut === "approuve" ? resteCredit(c) : 0), 0))}</b>
          </span>
        </div>
        {tousCredits.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucune demande de crédit pour le moment.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Employé", "Demande", "Montant", "Remboursement", "Remboursé", "Reste dû", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {tousCredits.map(({ u, c }) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50 align-top">
                  <td className="px-3 py-2 font-semibold">{u.nom}<div className="text-xs font-normal text-slate-500">{dFR(c.date_demande)}</div></td>
                  <td className="px-3 py-2 max-w-[220px]">
                    <div className="tabular-nums">{fmt(c.montant_demande)} demandés</div>
                    <div className="text-xs text-slate-500">{c.motif || "Sans motif"}</div>
                    {c.commentaire && <div className="text-xs text-slate-400 italic">« {c.commentaire} »</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{c.montant_accorde ? fmt(c.montant_accorde) : "—"}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.mode === "salaire"
                      ? <>Retenue sur salaire{c.mensualites ? ` · ${c.mensualites} mois` : ""}
                          {(c.echeances || []).some((e) => !e.paye) && (
                            <div className="text-slate-500">Prochaine : {libelleMoisFR((c.echeances || []).find((e) => !e.paye).mois)} · {fmt((c.echeances || []).find((e) => !e.paye).montant)}</div>
                          )}
                        </>
                      : "Remboursement libre"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(totalRembourseCredit(c))}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{c.statut === "approuve" ? fmt(resteCredit(c)) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.statut === "en_attente" ? <span className="text-xs font-bold text-purple-700">📩 En attente</span>
                      : c.statut === "approuve" ? <span className="text-xs font-bold text-blue-700">✅ Accordé</span>
                      : c.statut === "solde" ? <span className="text-xs font-bold text-green-700">🎉 Soldé</span>
                      : <span className="text-xs font-bold text-red-600">❌ Refusé</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.statut === "en_attente" && <button onClick={() => approuverCredit(u, c)} className="text-xs font-bold text-green-700 underline mr-2">Approuver</button>}
                    {c.statut === "en_attente" && <button onClick={() => refuserCredit(u, c)} className="text-xs font-bold text-red-600 underline mr-2">Refuser</button>}
                    {c.statut === "approuve" && resteCredit(c) > 0 && <button onClick={() => rembourserCredit(u, c)} className="text-xs font-bold text-sky-800 underline mr-2">+ Remboursement</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============ MA COMMISSION (rôle Commercial) ============
// ============ MES TÂCHES (agents commerciaux / techniciens / responsable) ============
function MesTaches({ db, save, profile }) {
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const taches = [...tachesDe(moi)].sort((a, b) => {
    if ((a.statut === "terminee") !== (b.statut === "terminee")) return a.statut === "terminee" ? 1 : -1;
    return String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"));
  });
  const ouvertes = taches.filter((t) => t.statut !== "terminee");
  const enRetard = ouvertes.filter((t) => t.echeance && t.echeance < today());

  const majTache = (t, maj, label) =>
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, taches: tachesDe(x).map((y) => (y.id === t.id ? { ...y, ...maj } : y)) } : x)) }, label);

  const terminer = async (t) => {
    if (!await uConfirm(`Marquer la tâche « ${t.titre} » comme terminée ?`)) return;
    majTache(t, { statut: "terminee", date_fin: today() }, `${moi.nom} a terminé la tâche : ${t.titre}`);
  };

  const rouvrir = (t) => majTache(t, { statut: "a_faire", date_fin: null }, `${moi.nom} a rouvert la tâche : ${t.titre}`);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">✅ Mes tâches</div>
        <div className="text-xs text-slate-500 mb-4">Tâches assignées par l'administration ou votre responsable commercial.</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">À faire</div>
            <div className="text-xl font-bold tabular-nums mt-1">{ouvertes.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">En retard</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{enRetard.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Terminées</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{taches.length - ouvertes.length}</div>
          </div>
        </div>
      </Panel>

      {taches.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-8">Aucune tâche ne vous est assignée pour le moment.</div>
      ) : (
        <div className="space-y-2">
          {taches.map((t) => {
            const retard = t.statut !== "terminee" && t.echeance && t.echeance < today();
            return (
              <div key={t.id} className={`rounded-xl border p-4 flex flex-wrap items-start justify-between gap-3 ${t.statut === "terminee" ? "bg-slate-50 border-slate-200" : retard ? "bg-red-50 border-red-200" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="min-w-[60%]">
                  <div className={`font-bold ${t.statut === "terminee" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titre}</div>
                  {t.detail && <div className="text-sm text-slate-600 mt-1">{t.detail}</div>}
                  <div className="text-xs text-slate-400 mt-1">
                    Assignée par {t.par} le {dFR(t.date)}
                    {t.echeance ? ` · Échéance : ${dFR(t.echeance)}` : ""}
                    {retard ? " · ⚠ EN RETARD" : ""}
                    {t.statut === "terminee" && t.date_fin ? ` · Terminée le ${dFR(t.date_fin)}` : ""}
                  </div>
                </div>
                <div>
                  {t.statut === "terminee"
                    ? <button onClick={() => rouvrir(t)} className="text-xs font-bold text-slate-500 underline">Rouvrir</button>
                    : <button onClick={() => terminer(t)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">✅ Terminer</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ RENTABILITÉ PAR PRODUIT ============
function Rentabilite({ db }) {
  const [lp, debut, fin] = periodes()[0] ? [null, null, null] : [null, null, null];
  const [periode, setPeriode] = useState("mois");
  const P = periodes();
  const choix = P.find((p) => p[0].toLowerCase().includes(periode)) || P[0];
  const [, a, b] = choix;
  const [tri, setTri] = useState("marge");

  const ventesP = db.ventes.filter((v) => inP(v.date, a, b));

  // Agrégation par NOM d'article (tous sites confondus)
  const parProduit = {};
  ventesP.forEach((v) => {
    (v.articles || []).forEach((l) => {
      const p = db.produits.find((x) => x.id === l.produit_id);
      const nom = p ? p.nom : (l.article || "?");
      const achat = p ? Number(p.prix_achat || 0) : 0;
      if (!parProduit[nom]) parProduit[nom] = { nom, categorie: p?.categorie || "—", qte: 0, ca: 0, cout: 0 };
      parProduit[nom].qte += Number(l.qte || 0);
      parProduit[nom].ca += Number(l.qte || 0) * Number(l.pu || 0);
      parProduit[nom].cout += Number(l.qte || 0) * achat;
    });
  });

  const lignes = Object.values(parProduit).map((x) => ({
    ...x, marge: x.ca - x.cout, tauxMarge: x.ca > 0 ? Math.round(((x.ca - x.cout) / x.ca) * 1000) / 10 : 0,
  }));
  lignes.sort((x, y) => tri === "marge" ? y.marge - x.marge : tri === "ca" ? y.ca - x.ca : tri === "qte" ? y.qte - x.qte : y.tauxMarge - x.tauxMarge);

  const caTotal = lignes.reduce((s, x) => s + x.ca, 0);
  const margeTotale = lignes.reduce((s, x) => s + x.marge, 0);
  const tauxGlobal = caTotal > 0 ? Math.round((margeTotale / caTotal) * 1000) / 10 : 0;

  // Articles jamais vendus sur la période, mais en stock : capital immobilisé
  const vendus = new Set(Object.keys(parProduit));
  const dormants = db.produits
    .filter((p) => !vendus.has(p.nom) && stockActuel(db, p) > 0)
    .map((p) => ({ p, valeur: stockActuel(db, p) * Number(p.prix_achat || 0) }))
    .sort((x, y) => y.valeur - x.valeur);
  const capitalDormant = dormants.reduce((s, x) => s + x.valeur, 0);

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">📈 Rentabilité par produit</div>
        <div className="text-xs text-slate-500 mb-3">Marge réelle = prix de vente encaissé − prix d'achat. Les remises sont donc prises en compte.</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Période">
            <select className={inputCls} value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="année">Cette année</option>
            </select>
          </Field>
          <Field label="Trier par">
            <select className={inputCls} value={tri} onChange={(e) => setTri(e.target.value)}>
              <option value="marge">Marge (F CFA)</option>
              <option value="taux">Taux de marge (%)</option>
              <option value="ca">Chiffre d'affaires</option>
              <option value="qte">Quantités vendues</option>
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Carte label="Chiffre d'affaires" valeur={fmt(caTotal)} couleur="border-l-sky-700" />
          <Carte label="Marge brute" valeur={<span className="text-green-700">{fmt(margeTotale)}</span>} couleur="border-l-green-700" />
          <Carte label="Taux de marge global" valeur={<span className={tauxGlobal < 15 ? "text-red-600" : "text-green-700"}>{tauxGlobal} %</span>} couleur="border-l-emerald-600" />
          <Carte label="Capital dormant" valeur={<span className="text-orange-600">{fmt(capitalDormant)}</span>} couleur="border-l-orange-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>Produits vendus — {choix[0]}</span>
          <button className={btnDark} onClick={() => exportCSV(`rentabilite_${today()}`,
            ["Article", "Catégorie", "Quantité vendue", "Chiffre d'affaires", "Coût d'achat", "Marge", "Taux de marge (%)"],
            lignes.map((x) => [x.nom, x.categorie, x.qte, x.ca, x.cout, x.marge, x.tauxMarge]), choix[0])}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucune vente sur cette période.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Catégorie", "Vendus", "CA", "Coût", "Marge", "Taux"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map((x) => (
                <tr key={x.nom} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{x.nom}</td>
                  <td className="px-3 py-2 text-slate-500">{x.categorie}</td>
                  <td className="px-3 py-2 tabular-nums">{x.qte}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(x.ca)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{fmt(x.cout)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.marge >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(x.marge)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.tauxMarge < 0 ? "text-red-600" : x.tauxMarge < 15 ? "text-orange-600" : "text-green-700"}`}>{x.tauxMarge} %</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal)}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal - margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums">{tauxGlobal} %</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {dormants.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-orange-800 border-b border-orange-200 bg-orange-50">
            😴 Produits dormants — invendus sur la période, mais en stock ({fmt(capitalDormant)} immobilisés)
          </div>
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Site", "Stock", "Valeur immobilisée"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {dormants.slice(0, 25).map(({ p, valeur }) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2"><Badge boutique={p.boutique} /></td>
                  <td className="px-3 py-2 tabular-nums">{stockActuel(db, p)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">{fmt(valeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ SALAIRES — VUE ADMINISTRATEUR ============
function SalairesAdmin({ db, save, profile }) {
  const [mois, setMois] = useState(today().slice(0, 7));
  const options = [];
  const d0 = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }

  const employes = db.users.filter((u) => SALARIES.includes(u.role) && u.actif !== false);
  const lignes = employes.map((u) => ({ u, p: paieMois(u, mois), credit: creditsEnCours(u).reduce((s, c) => s + resteCredit(c), 0) }));

  const masse = lignes.reduce((s, l) => s + l.p.net, 0);
  const verse = lignes.reduce((s, l) => s + l.p.verse, 0);
  const reste = lignes.reduce((s, l) => s + Math.max(0, l.p.reste), 0);
  const attente = lignes.reduce((s, l) => s + l.p.enAttente, 0);
  const encoursCredit = lignes.reduce((s, l) => s + l.credit, 0);

  const roleCourt = (r) => r === "gerant" ? "Gérant" : r === "magasinier" ? "Magasinier" : r === "technicien_bmi" ? "Technicien BMI" : "Vendeur";

  const statut = (p) => {
    if (p.net <= 0) return <span className="text-xs font-bold text-slate-400">—</span>;
    if (p.verse <= 0) return <span className="text-xs font-bold text-red-600">🔴 Non payé</span>;
    if (p.reste > 0) return <span className="text-xs font-bold text-orange-600">🟠 Partiel</span>;
    if (p.enAttente > 0) return <span className="text-xs font-bold text-amber-600">⏳ À confirmer</span>;
    return <span className="text-xs font-bold text-green-700">✅ Payé & confirmé</span>;
  };

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">💵 Masse salariale — {libelleMoisFR(mois)}</div>
        <div className="text-xs text-slate-500 mb-3">Vue d'ensemble de la paie du mois. Les virements envoyés d'ici sont enregistrés en dépense « Salaires ».</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMoisFR(m)}</option>)}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <Carte label="Masse salariale (net)" valeur={fmt(masse)} couleur="border-l-sky-700" />
          <Carte label="Déjà versé" valeur={fmt(verse)} couleur="border-l-green-600" />
          <Carte label="Reste à verser" valeur={fmt(reste)} couleur="border-l-red-500" />
          <Carte label="À confirmer par l'employé" valeur={fmt(attente)} couleur="border-l-amber-500" />
          <Carte label="Encours crédits BMI" valeur={fmt(encoursCredit)} couleur="border-l-purple-600" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span>Détail par employé</span>
          <button className={btnDark} onClick={() => exportCSV(`salaires_${mois}`,
            ["Employé", "Rôle", "Boutique", "Salaire de base", "Primes", "Avances", "Retenue crédit", "Net à percevoir", "Versé", "Reste à verser", "Crédit en cours"],
            lignes.map(({ u, p, credit }) => [u.nom, roleCourt(u.role), u.boutique || "Toutes", p.base, p.primes, p.avances, p.retenueCredit, p.net, p.verse, Math.max(0, p.reste), credit]),
            `Paie ${libelleMoisFR(mois)}`)}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun employé salarié actif. Créez des comptes Vendeur, Gérant, Magasinier ou Technicien BMI.</div>
        ) : (
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Employé", "Base", "Primes", "Avances", "Retenue crédit", "Net", "Versé", "Reste", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map(({ u, p, credit }) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}
                    <div className="text-xs font-normal text-slate-500">{roleCourt(u.role)} · {u.boutique || "Toutes boutiques"}</div>
                    {!u.nom_complet && <div className="text-xs font-normal text-orange-500">⚠ Identité non renseignée (👥 Utilisateurs → 🪪 Identité)</div>}
                    {credit > 0 && <div className="text-xs font-bold text-purple-700">🏦 Crédit : reste {fmt(credit)}</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.base ? fmt(p.base) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{p.primes ? "+" + fmt(p.primes) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-orange-600">{p.avances ? "−" + fmt(p.avances) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(p.net)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(p.verse)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${p.reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{statut(p)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.reste > 0 && <button onClick={() => envoyerVirementG(db, save, profile, u, mois)} className="text-xs font-bold text-blue-700 underline mr-2">💸 Virement</button>}
                    <button onClick={() => imprimerBulletin(u, mois, db)} className="text-xs font-bold text-sky-800 underline">🖨 Bulletin</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(lignes.reduce((s, l) => s + l.p.base, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(lignes.reduce((s, l) => s + l.p.primes, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-orange-600">{fmt(lignes.reduce((s, l) => s + l.p.avances, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(lignes.reduce((s, l) => s + l.p.retenueCredit, 0))}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(masse)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(verse)}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(reste)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============ SALAIRE (vendeurs, gérants, magasiniers) ============
function Salaire({ db, save, profile }) {
  // Lit la fiche À JOUR depuis la base (le profil de connexion est figé au
  // login, or l'admin peut ajouter primes/avances pendant la session).
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const [mois, setMois] = useState(today().slice(0, 7));

  // 12 derniers mois proposés
  const options = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  const libelleMois = libelleMoisFR;

  const base = Number(moi.salaire_base || 0);
  const primes = (moi.primes || []).filter((p) => p.mois === mois);
  const avances = (moi.avances || []).filter((a) => a.mois === mois);
  const totalPrimes = primes.reduce((s, p) => s + Number(p.montant || 0), 0);
  const totalAvances = avances.reduce((s, a) => s + Number(a.montant || 0), 0);
  // Virements + retenues de crédit pour ce mois
  const p = paieMois(moi, mois);
  const net = p.net;
  const enAttente = p.virements.filter((v) => v.statut !== "accepte");

  // ---- Crédit BMI ----
  const mesCredits = moi.credits || [];
  const enCours = mesCredits.filter((c) => c.statut === "approuve" && resteCredit(c) > 0);
  const enExamen = mesCredits.filter((c) => c.statut === "en_attente");
  const [dem, setDem] = useState({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
  const [msgC, setMsgC] = useState("");

  const demanderCredit = async () => {
    const montant = Number(dem.montant);
    if (!montant || montant <= 0) { setMsgC("Indiquez le montant souhaité."); return; }
    if (!dem.motif.trim()) { setMsgC("Indiquez le motif de votre demande."); return; }
    if (enExamen.length > 0) { setMsgC("Vous avez déjà une demande en cours d'examen."); return; }
    const n = dem.mode === "salaire" ? Math.max(1, Math.min(36, Number(dem.mensualites) || 1)) : 0;
    const resume = dem.mode === "salaire"
      ? `Remboursement par retenue sur salaire : ${n} mensualité(s) d'environ ${fmt(Math.round(montant / n))}.`
      : "Remboursement libre (vous remboursez directement à l'administration).";
    if (!await uConfirm(`Envoyer une demande de crédit de ${fmt(montant)} à BMI ?\n\n${resume}\n\nL'administration examinera votre demande.`)) return;
    const credit = {
      id: uid(), date_demande: today(), montant_demande: montant, motif: dem.motif.trim(),
      mode: dem.mode, mensualites: n, statut: "en_attente", remboursements: [], echeances: []
    };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: [...(x.credits || []), credit] } : x)) },
      `Demande de crédit BMI de ${fmt(montant)} par ${moi.nom}`);
    setDem({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
    setMsgC("✅ Demande envoyée. Vous serez informé de la décision ici même.");
    setTimeout(() => setMsgC(""), 6000);
  };

  // À l'ouverture de l'onglet, les décisions de crédit sont marquées comme vues
  // (la pastille de notification disparaît).
  useEffect(() => {
    const aVoir = mesCredits.filter((c) => (c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe);
    if (!aVoir.length) return;
    save({
      ...db,
      users: db.users.map((x) => (x.id === moi.id
        ? { ...x, credits: (x.credits || []).map((c) => ((c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe ? { ...c, vu_employe: true } : c)) }
        : x))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const annulerDemande = async (c) => {
    if (!await uConfirm(`Annuler votre demande de crédit de ${fmt(c.montant_demande)} ?`)) return;
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: (x.credits || []).filter((y) => y.id !== c.id) } : x)) },
      `${moi.nom} a annulé sa demande de crédit de ${fmt(c.montant_demande)}`);
  };

  const accepterVirement = async (v) => {
    if (!await uConfirm(`Confirmez-vous avoir bien reçu ${fmt(v.montant)}${v.moyen ? ` par ${v.moyen}` : ""} pour ${libelleMois(v.mois)} ?\n\nCette confirmation est enregistrée et visible par l'administration.`)) return;
    const maj = { ...v, statut: "accepte", date_acceptation: today() };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, virements: (x.virements || []).map((y) => (y.id === v.id ? maj : y)) } : x)) },
      `${moi.nom} a confirmé la réception du virement de ${fmt(v.montant)} (${libelleMois(v.mois)})`);
    uAlert("✅ Réception confirmée. Merci !");
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">💵 Mon salaire — {moi.nom_complet || moi.nom}</div>
        {moi.piece_num && <div className="text-xs text-slate-400 mb-1">{moi.piece_type || "Pièce"} n° {moi.piece_num}</div>}
        <div className="text-xs text-slate-500 mb-4">Informations indicatives, mois par mois. Pour toute question sur votre paie, adressez-vous à l'administration.{Number(moi.taux_avancement || 0) > 0 ? ` Taux d'avancement annuel : ${moi.taux_avancement} %.` : ""}</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
          </select>
        </Field>
        <div className="mt-3">
          <button onClick={() => imprimerBulletin(moi, mois, db)} className={btnDark}>🖨 Imprimer mon bulletin de paie</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Salaire de base</div>
            <div className="text-xl font-bold tabular-nums mt-1">{base > 0 ? fmt(base) : "—"}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-slate-500 uppercase">Primes du mois</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-700">{totalPrimes ? "+" + fmt(totalPrimes) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Avances perçues</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-orange-600">{totalAvances ? "−" + fmt(totalAvances) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Retenue crédit BMI</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Net à percevoir</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{fmt(net)}</div>
          </div>
        </div>
      </Panel>

      {enAttente.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="font-bold text-amber-800 mb-1">💸 Virement reçu de l'administration</div>
          <div className="text-xs text-amber-700 mb-3">Vérifiez que l'argent est bien arrivé, puis confirmez la réception.</div>
          <div className="space-y-3">
            {enAttente.map((v) => (
              <div key={v.id} className="rounded-lg bg-white border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-slate-800">{fmt(v.montant)}</div>
                  <div className="text-xs text-slate-500">
                    {libelleMois(v.mois)} · {v.moyen || "Non précisé"} · envoyé le {dFR(v.date_envoi)} par {v.par || "—"}
                    {v.ref ? ` · Réf : ${v.ref}` : ""}
                  </div>
                </div>
                <button onClick={() => accepterVirement(v)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">
                  ✅ J'ai bien reçu ce montant
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.virements.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
            <span>💸 Virements — {libelleMois(mois)}</span>
            <span className="text-xs font-semibold text-slate-600">
              Versé : <b className="tabular-nums">{fmt(p.verse)}</b> · Reste à percevoir : <b className={`tabular-nums ${p.reste > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</b>
            </span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date d'envoi", "Montant", "Moyen", "Référence", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {p.virements.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date_envoi)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(v.montant)}</td>
                  <td className="px-3 py-2">{v.moyen || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{v.ref || "—"}</td>
                  <td className="px-3 py-2">
                    {v.statut === "accepte"
                      ? <span className="text-xs font-bold text-green-700">✅ Reçu confirmé le {dFR(v.date_acceptation)}</span>
                      : <span className="text-xs font-bold text-amber-600">⏳ En attente de votre confirmation</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(primes.length > 0 || avances.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail — {libelleMois(mois)}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Type", "Motif", "Enregistré par", "Montant"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {primes.map((p, i) => (
                <tr key={"p" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-green-700">PRIME</span></td>
                  <td className="px-3 py-2">{p.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-green-700">+{fmt(Number(p.montant || 0))}</td>
                </tr>
              ))}
              {avances.map((a, i) => (
                <tr key={"a" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-orange-600">AVANCE</span></td>
                  <td className="px-3 py-2">{a.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">−{fmt(Number(a.montant || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🏦 Crédit BMI</div>
        <div className="text-xs text-slate-500 mb-4">Vous pouvez demander un crédit à l'entreprise. L'administration examine votre demande et fixe le montant accordé.</div>

        {!aDroit(db, profile, "act_credit") && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
            🔒 La demande de crédit a été désactivée pour votre compte par l'administration.
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Montant souhaité (F CFA)">
              <input type="number" min="0" className={inputCls} value={dem.montant} onChange={(e) => setDem({ ...dem, montant: e.target.value })} />
            </Field>
            <Field label="Motif">
              <input className={inputCls} placeholder="Ex : frais de santé, scolarité…" value={dem.motif} onChange={(e) => setDem({ ...dem, motif: e.target.value })} />
            </Field>
            <Field label="Remboursement souhaité">
              <select className={inputCls} value={dem.mode} onChange={(e) => setDem({ ...dem, mode: e.target.value })}>
                <option value="salaire">Retenue sur salaire (mensualités)</option>
                <option value="libre">Remboursement libre</option>
              </select>
            </Field>
            {dem.mode === "salaire" && (
              <Field label="Nombre de mensualités">
                <input type="number" min="1" max="36" className={inputCls} value={dem.mensualites} onChange={(e) => setDem({ ...dem, mensualites: e.target.value })} />
              </Field>
            )}
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button onClick={demanderCredit} className={btnDark}>Envoyer ma demande</button>
            {msgC && <span className="text-sm font-semibold text-slate-700">{msgC}</span>}
          </div>
        )}

        {enCours.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            Vous avez un crédit en cours de remboursement. Une nouvelle demande sera possible une fois celui-ci soldé.
          </div>
        )}
        {enExamen.length > 0 && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-900">
            📩 Votre demande est en cours d'examen par l'administration.
          </div>
        )}

        {mesCredits.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Demandé", "Accordé", "Remboursement", "Reste dû", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {[...mesCredits].reverse().map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date_demande)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(c.montant_demande)}<div className="text-xs font-normal text-slate-500">{c.motif}</div></td>
                    <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{c.montant_accorde ? fmt(c.montant_accorde) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.mode === "salaire" ? `Retenue sur salaire${c.mensualites ? ` · ${c.mensualites} mois` : ""}` : "Remboursement libre"}
                      {(c.echeances || []).some((e) => !e.paye) && (
                        <div className="text-slate-500">Prochaine : {libelleMoisFR((c.echeances || []).find((e) => !e.paye).mois)} · {fmt((c.echeances || []).find((e) => !e.paye).montant)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-bold text-red-600">{c.statut === "approuve" ? fmt(resteCredit(c)) : "—"}</td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" ? <span className="text-xs font-bold text-purple-700">📩 En attente</span>
                        : c.statut === "approuve" ? <span className="text-xs font-bold text-blue-700">✅ Accordé</span>
                        : c.statut === "solde" ? <span className="text-xs font-bold text-green-700">🎉 Soldé</span>
                        : <span className="text-xs font-bold text-red-600">❌ Refusé</span>}
                      {c.commentaire && <div className="text-xs text-slate-500 italic">« {c.commentaire} »</div>}
                    </td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" && <button onClick={() => annulerDemande(c)} className="text-xs font-bold text-red-600 underline">Annuler</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(moi.evolutions_salaire || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">📈 Mon avancement</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Ancien salaire", "Nouveau salaire", "Évolution", "%", "Motif"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...moi.evolutions_salaire].reverse().map((e, i) => {
                const delta = Number(e.nouveau) - Number(e.ancien);
                const pct = e.pct != null ? e.pct : (Number(e.ancien) > 0 ? Math.round(((Number(e.nouveau) - Number(e.ancien)) / Number(e.ancien)) * 1000) / 10 : null);
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(e.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.ancien ? fmt(e.ancien) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums font-bold">{fmt(e.nouveau)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${delta >= 0 ? "text-green-700" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{fmt(delta)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${pct == null ? "text-slate-400" : pct >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct} %`}
                      {e.taux_prevu ? <span className="block text-[10px] font-normal text-slate-400">taux fixé : {e.taux_prevu} %</span> : null}
                    </td>
                    <td className="px-3 py-2">{e.motif || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {base === 0 && primes.length === 0 && avances.length === 0 && p.virements.length === 0 && mesCredits.length === 0 && (
        <div className="text-sm text-slate-400 text-center py-6">Aucune information de salaire n'a encore été renseignée par l'administration pour ce mois.</div>
      )}
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

// ============ RÉINITIALISATION : QUI, ET DEPUIS OÙ ============
// La réinitialisation efface TOUT. Elle est donc réservée :
//   1. au LOGICIEL WINDOWS (le .exe) — jamais depuis le site web,
//   2. à l'ADMINISTRATEUR PRINCIPAL — jamais à un autre administrateur.
// Un administrateur qui se connecte depuis Vercel, même légitime, ne peut rien
// effacer : il faut être physiquement sur la machine de direction.
const estAppWindows = () => typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");

// L'administrateur principal est celui qui porte le drapeau. À défaut, c'est le
// PREMIER administrateur créé (les comptes sont ajoutés en fin de liste).
const adminPrincipal = (db) =>
  (db.users || []).find((u) => u.admin_principal && u.role === "admin" && u.actif !== false) ||
  (db.users || []).find((u) => u.role === "admin" && u.actif !== false) || null;

const estAdminPrincipal = (db, profile) => {
  const p = adminPrincipal(db);
  return !!p && p.id === profile.id;
};

// Code aléatoire à recopier : impossible à taper machinalement, contrairement
// à un mot toujours identique.
const codeConfirmation = () => {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 : illisibles
  let c = "";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  return c;
};

// ============ MON ÉQUIPE (chef d'équipe commercial) ============
function MonEquipe({ db, save, profile }) {
  const estAdmin = profile.role === "admin";
  const [periode, setPeriode] = useState("mois");
  const bornes = () => {
    if (periode === "mois") return [today().slice(0, 7) + "-01", today()];
    if (periode === "annee") return [today().slice(0, 4) + "-01-01", today()];
    return ["2000-01-01", today()];
  };
  const [debut, fin] = bornes();

  // Tous ceux qui peuvent toucher une commission : commerciaux, techniciens,
  // mais aussi tout autre employé qui a un taux ou des ventes à son nom.
  const equipe = db.users.filter((u) => u.actif !== false && u.role !== "client" && (
    ["commercial", "technicien", "technicien_bmi"].includes(u.role) ||
    Number(u.taux_commission || 0) > 0 ||
    db.ventes.some((v) => v.commercial === u.nom)
  ));

  const stats = equipe.map((u) => {
    const ventes = db.ventes.filter((v) => v.commercial === u.nom && inP(v.date, debut, fin));
    const enAttente = ventes.filter((v) => !v.commission_payee);
    const reglees = ventes.filter((v) => v.commission_payee);
    const ca = ventes.reduce((s, v) => s + totalVente(v), 0);
    const caAttente = enAttente.reduce((s, v) => s + totalVente(v), 0);
    const caRegle = reglees.reduce((s, v) => s + totalVente(v), 0);
    const taux = Number(u.taux_commission || 0);
    return {
      u, nbVentes: ventes.length, ca, caAttente, caRegle, nbReglees: reglees.length,
      commissionDue: enAttente.reduce((s, v) => s + commissionVente(v, taux), 0),
      commissionReglee: Math.round((caRegle * taux) / 100),
      prospects: db.prospects.filter((p) => p.commercial === u.nom).length,
      commandesAttente: (db.commandes || []).filter((c) => c.commercial === u.nom && c.statut === "en_attente").length,
    };
  }).sort((a, b) => b.ca - a.ca);

  const totalCA = stats.reduce((s, x) => s + x.ca, 0);
  const totalDu = stats.reduce((s, x) => s + x.commissionDue, 0);

  // Annulation d'un règlement de commission : réservée à l'administrateur.
  // Remet les ventes réglées de la période en « commission due » (en cas
  // d'erreur de validation). Tracé dans l'historique.
  const annulerPaiement = async (st) => {
    if (!estAdmin) return;
    if (st.nbReglees === 0) { uAlert("Aucune commission réglée à annuler pour " + st.u.nom + " sur cette période."); return; }
    if (!await uConfirm(`⚠ ANNULER le règlement de commission de ${st.u.nom} sur cette période ?\n\n${st.nbReglees} vente(s) réglée(s), soit ${fmt(st.commissionReglee)} de commission, redeviendront « à payer ».`)) return;
    const ventesConcernees = db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && v.commission_payee);
    const ids = new Set(ventesConcernees.map((v) => v.id));
    // On retire aussi les dépenses « Commissions » générées par ces paiements
    const depsAnnulees = new Set(ventesConcernees.map((v) => v.commission_dep).filter(Boolean));
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: false, commission_dep: null } : v)),
      depenses: db.depenses.filter((d) => !depsAnnulees.has(d.id)),
    }, `ANNULATION règlement commission de ${st.u.nom} : ${fmt(st.commissionReglee)} remis à payer (par ${profile.nom})`);
  };

  // ---- APPORTEURS EXTERNES (non-utilisateurs) ----
  // Regroupés par nom + téléphone, sur la période choisie.
  const apporteursExt = (() => {
    const g = {};
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom && inP(v.date, debut, fin)).forEach((v) => {
      const cle = `${v.apporteur.nom}|${v.apporteur.tel || ""}`;
      if (!g[cle]) g[cle] = { nom: v.apporteur.nom, tel: v.apporteur.tel || "", taux: Number(v.apporteur.taux || 0), nb: 0, ca: 0, due: 0, payee: 0, ventes: [] };
      const m = Number(v.apporteur.montant || 0);
      g[cle].nb += 1;
      g[cle].ca += totalVente(v);
      // Une part bloquée (installation non réceptionnée) n'est pas encore exigible.
      if (v.apporteur.payee) g[cle].payee += m;
      else if (v.apporteur.a_la_reception) { g[cle].attente = (g[cle].attente || 0) + m; }
      else { g[cle].due += m; g[cle].ventes.push(v.id); }
    });
    return Object.values(g).sort((a, b) => b.due - a.due);
  })();

  const totalExtDu = apporteursExt.reduce((s, a) => s + a.due, 0);

  // ---- COMMISSIONS D'ÉQUIPE (les chefs touchent un % sur leurs filleuls) ----
  const chefs = db.users.filter((u) => u.actif !== false && estChefEquipe(db, u) && filleulsDe(db, u).length > 0)
    .map((u) => {
      const tauxEq = Number(u.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
      let due = 0, versees = 0, ventesDues = [];
      filleulsDe(db, u).forEach((fu) => {
        const tu = Number(fu.taux_commission || 0);
        db.ventes.filter((v) => v.commercial === fu.nom && inP(v.date, debut, fin)).forEach((v) => {
          const part = Math.round((commissionVente(v, tu) * tauxEq) / 100);
          if (v.override_payee) versees += part; else { due += part; ventesDues.push(v.id); }
        });
      });
      return { u, tauxEq, nbFilleuls: filleulsDe(db, u).length, due, versees, ventesDues };
    })
    .filter((c) => c.due > 0 || c.versees > 0);

  const totalEquipeDu = chefs.reduce((s, c) => s + c.due, 0);

  const payerCommissionEquipe = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (c.due <= 0) { uAlert("Aucune commission d'équipe en attente pour " + c.u.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${c.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, c.u, `Commission d'équipe de ${fmt(c.due)} à ${c.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer ${fmt(c.due)} de commission d'équipe à ${c.u.nom} ?\n\n${c.tauxEq} % sur les commissions de ses ${c.nbFilleuls} recrue(s).\nSortie de caisse ${bq} : ${fmt(c.due)}`)) return;
    const ids = new Set(c.ventesDues);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission d'équipe — ${c.u.nom} (${c.tauxEq} % sur ${c.nbFilleuls} recrue(s))`,
      montant: c.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_equipe", user_id: c.u.id,
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, override_payee: true, override_dep: dep.id } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, c.u.nom, c.due), ...(db.messages || [])],
    }, `Commission d'équipe payée à ${c.u.nom} : ${fmt(c.due)}`);
    uAlert(`✅ ${fmt(c.due)} payés à ${c.u.nom}. Sortie de caisse : ${bq}.`);
  };

  // Nombre de CLIENTS DISTINCTS apportés depuis toujours (pas seulement sur la période)
  const clientsApportes = (a) => {
    const clients = new Set();
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom === a.nom && (v.apporteur.tel || "") === a.tel)
      .forEach((v) => clients.add(((v.client || "") + "|" + (v.tel || "")).trim().toLowerCase()));
    clients.delete("|");
    return clients.size;
  };
  const dejaUtilisateur = (a) => db.users.some((u) => u.nom.trim().toLowerCase() === a.nom.trim().toLowerCase());

  // Promotion : l'apporteur externe devient un COMMERCIAL avec son propre compte
  const promouvoir = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    const n = clientsApportes(a);
    const identifiant = await uPrompt(
      `🎖 ${a.nom} a apporté ${n} client(s).\n\nLe promouvoir COMMERCIAL : il aura son propre compte, ses prospects, ses commandes et son onglet « Ma commission ».\n\nIdentifiant de connexion :`,
      a.nom.trim().toUpperCase().split(" ")[0]
    );
    if (identifiant === null) return;
    const nom = identifiant.trim().toUpperCase();
    if (!nom) { uAlert("Identifiant obligatoire."); return; }
    if (db.users.some((u) => u.nom.toUpperCase() === nom)) { uAlert("Cet identifiant existe déjà."); return; }
    const pwd = await uPrompt("Mot de passe provisoire (6 caractères minimum) :", "");
    if (pwd === null) return;
    if (String(pwd).length < 6) { uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const tx = await uPrompt("Taux de commission (%) :", String(a.taux || 5));
    if (tx === null) return;
    const taux = Math.max(0, Math.min(100, Number(tx) || 0));
    if (!await uConfirm(`Créer le compte COMMERCIAL « ${nom} » pour ${a.nom} avec ${taux} % de commission ?`)) return;
    const nouvel = {
      id: uid(), nom, ...await definirMotDePasse(String(pwd)), role: "commercial", boutique: null, actif: true,
      taux_commission: taux, nom_complet: a.nom, tel: a.tel || "", promu_de: "apporteur_externe", date_promotion: today()
    };
    save({
      ...db,
      users: [...db.users, nouvel],
      commerciaux: [...(db.commerciaux || []), { id: uid(), nom, tel: a.tel || "", taux, actif: true }]
    }, `🎖 ${a.nom} promu COMMERCIAL (${n} clients apportés) — compte « ${nom} », commission ${taux} %`);
    uAlert(`🎖 ${a.nom} est désormais Commercial !\n\nIdentifiant : ${nom}\nMot de passe : ${pwd}\n\nDemandez-lui de le changer à la première connexion.`);
  };

  const payerApporteur = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    if (a.due <= 0) { uAlert("Aucune commission en attente pour " + a.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${a.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, {}, `Commission de ${fmt(a.due)} à l'apporteur ${a.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer ${fmt(a.due)} de commission à ${a.nom}${a.tel ? ` (${a.tel})` : ""} ?\n\n${a.ventes.length} vente(s) concernée(s).\nSortie de caisse ${bq} : ${fmt(a.due)}.`)) return;
    const ids = new Set(a.ventes);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission apporteur externe — ${a.nom}${a.tel ? ` (${a.tel})` : ""}`,
      montant: a.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_ext"
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, apporteur: { ...v.apporteur, payee: true, date_paiement: today(), par: profile.nom, dep_id: dep.id } } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, a.nom, a.due), ...(db.messages || [])],
    }, `Commission de ${fmt(a.due)} payée à l'apporteur externe ${a.nom}`);
    uAlert(`✅ ${fmt(a.due)} payés à ${a.nom}. Dépense enregistrée — sortie de caisse : ${bq}.`);
  };

  // Assigner une tâche à un agent (stockée dans sa fiche : visible dans son onglet ✅ Mes tâches)
  const assignerTache = async (st) => {
    const titre = await uPrompt(`Tâche à assigner à ${st.u.nom} :`, "");
    if (titre === null) return;
    if (!titre.trim()) { uAlert("Le titre de la tâche est obligatoire."); return; }
    const detail = await uPrompt("Détails (facultatif) :", "");
    if (detail === null) return;
    const ech = await uPrompt("Échéance (AAAA-MM-JJ, facultatif) :", "");
    if (ech === null) return;
    if (ech.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(ech.trim())) { uAlert("Format attendu : AAAA-MM-JJ (ex : 2026-07-20)."); return; }
    const tache = { id: uid(), titre: titre.trim(), detail: detail.trim(), echeance: ech.trim() || null, statut: "a_faire", par: profile.nom, date: today() };
    save({ ...db, users: db.users.map((x) => (x.id === st.u.id ? { ...x, taches: [...(x.taches || []), tache] } : x)) },
      `Tâche assignée à ${st.u.nom} : ${titre.trim()}`);
    uAlert(`✅ Tâche assignée à ${st.u.nom}.`);
  };

  const payerCommission = async (st) => {
    if (bloquerSiLecture(db, profile)) return;
    if (st.commissionDue === 0) { uAlert("Aucune commission en attente pour " + st.u.nom + " sur cette période."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${st.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, st.u, `Commission de ${fmt(st.commissionDue)} à ${st.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer la commission de ${st.u.nom} ?\n\nMontant : ${fmt(st.commissionDue)} (${fmt(st.caAttente)} de ventes × ${st.u.taux_commission ?? 0} %)\n\nSortie de caisse ${bq} : ${fmt(st.commissionDue)}\nElle sera enregistrée en dépense « Commissions ».\n\nCes ventes ne seront plus comptées (action définitive).`)) return;
    const ids = new Set(db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && !v.commission_payee).map((v) => v.id));
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission — ${st.u.nom} (${ids.size} vente(s))`,
      montant: st.commissionDue, paiement: normPaiement(moyen), par: profile.nom, auto: "commission", user_id: st.u.id
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: true, commission_dep: dep.id } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, st.u.nom, st.commissionDue), ...(db.messages || [])],
    }, `Commission payée à ${st.u.nom} : ${fmt(st.commissionDue)} (validée par ${profile.nom})`);
    uAlert(`✅ ${fmt(st.commissionDue)} payés à ${st.u.nom}. Dépense « Commissions » enregistrée — sortie de caisse : ${bq}.`);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">👑 Mon équipe — vue d'ensemble</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Commerciaux actifs</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{equipe.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">CA de l'équipe</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(totalCA)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commissions à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(totalDu)}</div>
          </div>
        </div>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Performances par commercial</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial", "Ventes", "Chiffre d'affaires", "Commission due", "Prospects", "Commandes en attente", "Tâches", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {stats.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun commercial actif.</td></tr>}
            {stats.map((st) => (
              <tr key={st.u.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 font-semibold">{st.u.nom}{st.u.chef_equipe ? " ⭐" : ""}{st.u.role === "technicien" ? " 🔧" : ""}{st.u.role === "technicien_bmi" ? " 🔧 (salarié)" : ""}</td>
                <td className="px-3 py-2 tabular-nums">{st.nbVentes}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(st.ca)}</td>
                <td className="px-3 py-2 tabular-nums font-bold text-green-700">{fmt(st.commissionDue)}</td>
                <td className="px-3 py-2 tabular-nums">{st.prospects}</td>
                <td className="px-3 py-2 tabular-nums">{st.commandesAttente}</td>
                <td className="px-3 py-2 tabular-nums">{tachesOuvertes(st.u).length > 0 ? <span className="font-bold text-amber-600">{tachesOuvertes(st.u).length} en cours</span> : <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {aDroit(db, profile, "act_taches") && <button onClick={() => assignerTache(st)} className="text-xs font-bold text-sky-800 underline mr-2">✅ Tâche</button>}
                  {st.commissionDue > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommission(st)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Marquer payé</button>}
                  {estAdmin && st.nbReglees > 0 && <button onClick={() => annulerPaiement(st)} className="text-xs font-bold text-red-700 border border-red-300 rounded px-2 py-1 hover:bg-red-50">↩ Annuler paiement</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chefs.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-amber-800 border-b border-amber-200 bg-amber-50 flex flex-wrap justify-between gap-2">
            <span>⭐ Chefs d'équipe — commissions sur leurs recrues</span>
            <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalEquipeDu)}</b></span>
          </div>
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Chef d'équipe", "Recrues", "Taux d'équipe", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {chefs.map((c) => (
                <tr key={c.u.id} className="border-t border-slate-100 hover:bg-amber-50">
                  <td className="px-3 py-2 font-semibold">{c.u.nom_complet || c.u.nom}</td>
                  <td className="px-3 py-2 tabular-nums">{c.nbFilleuls}</td>
                  <td className="px-3 py-2 tabular-nums">{c.tauxEq} %</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(c.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(c.versees)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommissionEquipe(c)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">✓ Payer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>🤝 Apporteurs externes</span>
          <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalExtDu)}</b></span>
        </div>
        {apporteursExt.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun apporteur externe sur cette période. Renseignez-le au moment de la vente (💰 Ventes → 🤝 Apporteur externe).</div>
        ) : (
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Apporteur", "Téléphone", "Clients apportés", "Ventes", "CA apporté", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {apporteursExt.map((a) => (
                <tr key={a.nom + a.tel} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{a.nom}
                    {clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <div className="text-xs font-bold text-amber-600">🎖 Éligible commercial</div>}
                    {dejaUtilisateur(a) && <div className="text-xs font-bold text-green-700">✅ Déjà commercial</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{a.tel || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`tabular-nums font-bold ${clientsApportes(a) >= SEUIL_COMMERCIAL ? "text-amber-600" : "text-slate-700"}`}>{clientsApportes(a)}</span>
                    <span className="text-xs text-slate-400"> / {SEUIL_COMMERCIAL}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{a.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(a.ca)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(a.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(a.payee)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerApporteur(a)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Payer</button>}
                    {estAdmin && clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <button onClick={() => promouvoir(a)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">🎖 Promouvoir commercial</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-slate-400">Le chiffre d'affaires inclut toutes les ventes de la période ; la commission due ne compte que les ventes pas encore réglées. 🔧 = technicien, ⭐ = chef d'équipe. Le paiement d'un apporteur externe est enregistré en dépense.</div>
    </div>
  );
}

// ============ MA COMMISSION (commerciaux et techniciens) ============
function MaCommission({ db, profile }) {
  const [periode, setPeriode] = useState("mois");
  const [pa, setPa] = useState(today().slice(0, 8) + "01");
  const [pb, setPb] = useState(today());

  const bornes = () => {
    if (periode === "mois") { const d = today().slice(0, 7); return [d + "-01", today()]; }
    if (periode === "annee") { const d = today().slice(0, 4); return [d + "-01-01", today()]; }
    if (periode === "tout") return ["2000-01-01", today()];
    return [pa, pb];
  };
  const [debut, fin] = bornes();

  // Une vente déjà réglée au commercial (payee_commission = true) n'entre plus
  // dans le calcul de la commission due — elle a déjà été comptabilisée.
  const mesVentesTotales = db.ventes.filter((v) => (v.commercial === profile.nom || v.responsable === profile.nom) && inP(v.date, debut, fin));
  const mesVentes = mesVentesTotales.filter((v) => !v.commission_payee);
  const ca = mesVentes.reduce((s, v) => s + totalVente(v), 0);
  const taux = Number(profile.taux_commission || 0);
  const commission = mesVentes.reduce((s, v) => s + commissionPour(v, profile.nom, taux), 0);
  // Gagné, mais pas encore exigible : le client n'a pas réceptionné l'installation.
  const enAttenteReception = mesVentes.reduce((s, v) => s + commissionEnAttente(v, taux), 0);
  const rabaisAccordes = mesVentesTotales.filter((v) => v.commercial === profile.nom).reduce((s, v) => s + Number(v.rabais || 0), 0);
  const dejaRegle = mesVentesTotales.filter((v) => v.commission_payee).reduce((s, v) => s + totalVente(v), 0);

  // ---- MON ÉQUIPE (les commerciaux que j'ai recrutés) ----
  const moiLive = db.users.find((u) => u.id === profile.id) || profile;
  const monEquipe = filleulsDe(db, moiLive);
  const jeSuisChef = estChefEquipe(db, moiLive);
  const tauxEquipe = Number(moiLive.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
  const detailEquipe = monEquipe.map((u) => {
    const ventesU = db.ventes.filter((v) => v.commercial === u.nom && inP(v.date, debut, fin));
    const tu = Number(u.taux_commission || 0);
    const comDue = ventesU.filter((v) => !v.commission_payee).reduce((s, v) => s + commissionVente(v, tu), 0);
    const comTotale = ventesU.reduce((s, v) => s + commissionVente(v, tu), 0);
    const monOverride = ventesU.filter((v) => !v.override_payee).reduce((s, v) => s + Math.round((commissionVente(v, tu) * tauxEquipe) / 100), 0);
    return { u, nbVentes: ventesU.length, comDue, comTotale, monOverride };
  });
  const commissionEquipe = detailEquipe.reduce((s, x) => s + x.monOverride, 0);

  const blocEquipe = (
    <>
      {monEquipe.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <span>👥 Mon équipe — {monEquipe.length} commercial(aux) recruté(s)</span>
            <span className="text-xs font-semibold text-slate-600">
              {jeSuisChef
                ? <>⭐ <b className="text-amber-600">Chef d'équipe</b> · je touche <b>{tauxEquipe} %</b> de leurs commissions</>
                : <>Encore <b className="text-amber-600">{SEUIL_CHEF_EQUIPE - monEquipe.length}</b> recrue(s) pour devenir chef d'équipe</>}
            </span>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial recruté", "Ventes", "Sa commission (période)", jeSuisChef ? "Ma part" : ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {detailEquipe.map(({ u, nbVentes, comTotale, monOverride }) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}<div className="text-xs font-normal text-slate-500">{u.taux_commission ?? 0} % de commission</div></td>
                  <td className="px-3 py-2 tabular-nums">{nbVentes}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(comTotale)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-amber-600">{jeSuisChef ? fmt(monOverride) : "—"}</td>
                </tr>
              ))}
              {jeSuisChef && (
                <tr className="border-t-2 border-slate-300 bg-amber-50 font-bold">
                  <td className="px-3 py-2" colSpan={3}>MA COMMISSION D'ÉQUIPE (en attente)</td>
                  <td className="px-3 py-2 tabular-nums text-amber-700">{fmt(commissionEquipe)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {!jeSuisChef && (
            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
              À {SEUIL_CHEF_EQUIPE} commerciaux recrutés, vous devenez automatiquement chef d'équipe et touchez un pourcentage de leurs commissions.
            </div>
          )}
        </div>
      )}
    </>
  );

  const parBoutique = {};
  mesVentes.forEach((v) => { parBoutique[v.boutique] = (parBoutique[v.boutique] || 0) + totalVente(v); });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">💵 Ma commission — {profile.nom}</div>

        {enAttenteReception > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="font-bold text-amber-900">⏳ {fmt(enAttenteReception)} en attente de réception</div>
            <div className="text-xs text-slate-600 mt-1">
              Cette commission est acquise, mais elle ne devient exigible que le jour où le client <b>réceptionne son installation</b>. Elle s'ajoutera automatiquement à votre dû à ce moment-là.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"], ["perso", "Personnalisée"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        {periode === "perso" && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <Field label="Du"><input type="date" className={inputCls} value={pa} onChange={(e) => setPa(e.target.value)} /></Field>
            <Field label="Au"><input type="date" className={inputCls} value={pb} onChange={(e) => setPb(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Chiffre d'affaires (non réglé)</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(ca)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Taux de commission</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{taux} %</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commission à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(commission)}</div>
            {jeSuisChef && commissionEquipe > 0 && <div className="text-xs font-bold text-amber-600 mt-1">+ {fmt(commissionEquipe)} de commission d'équipe</div>}
          </div>
        </div>
        {rabaisAccordes > 0 && (
          <div className="text-xs font-bold text-orange-600 mt-2">
            🏷 Rabais accordés à vos clients sur cette période : −{fmt(rabaisAccordes)} — déduits de votre commission.
          </div>
        )}
        {dejaRegle > 0 && <div className="text-xs text-slate-500 mt-2">Sur cette période, {fmt(dejaRegle)} de ventes ont déjà donné lieu à une commission réglée.</div>}
        <div className="text-xs text-slate-400 mt-2">Le règlement des commissions est validé par l'administration ou votre chef d'équipe.</div>
      </Panel>

      {blocEquipe}

      {Object.keys(parBoutique).length > 0 && (
        <Panel>
          <div className="font-bold mb-3">Répartition par boutique</div>
          <div className="space-y-2">
            {Object.entries(parBoutique).sort((a, b) => b[1] - a[1]).map(([nom, montant]) => (
              <div key={nom} className="flex items-center justify-between text-sm">
                <Badge boutique={nom} />
                <span className="font-bold tabular-nums">{fmt(montant)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail de mes ventes en attente ({mesVentes.length})</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "N° reçu", "Boutique", "Articles", "Total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mesVentes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucune vente sur cette période.</td></tr>}
            {mesVentes.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{numeroRecu(v)}</td>
                <td className="px-3 py-2"><Badge boutique={v.boutique} /></td>
                <td className="px-3 py-2">{resumeArticles(v)}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(totalVente(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">La commission affichée est une estimation calculée automatiquement (chiffre d'affaires × taux). Elle ne constitue pas un document de paie officiel.</div>
    </div>
  );
}

// ============ HISTORIQUE (JOURNAL D'AUDIT) ============
function Historique({ db }) {
  const [q, setQ] = useState("");
  let liste = (db.audits || []).slice(0, 500);
  if (q) liste = liste.filter((a) => (String(a.user) + " " + String(a.action)).toLowerCase().includes(q.toLowerCase()));
  const dh = (iso) => `${dFR(iso)} ${String(iso).slice(11, 16)}`;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Historique des actions <span className="text-sm font-normal text-slate-500">(500 dernières)</span></span>
          <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-64" placeholder="Rechercher (utilisateur, action)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date et heure", "Utilisateur", "Action"].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Aucune action enregistrée pour l'instant.</td></tr>}
            {liste.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{dh(a.date)}</td>
                <td className="px-4 py-2 font-semibold">{a.user}</td>
                <td className="px-4 py-2">{a.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">Chaque vente, dépense, dette, mouvement de stock, clôture et action sur les comptes est tracée automatiquement, avec l'utilisateur et l'heure. Ce journal se synchronise entre toutes les machines.</div>
    </div>
  );
}

// ============ PARAMÈTRES ============
function Parametres({ db, save, setDb, profile, dossierAuto, setDossierAuto, dernierAuto }) {
  // ---- SÉCURITÉ SUPABASE : écran de contrôle avant durcissement ----
  const [verifSecu, setVerifSecu] = useState({ statut: "idle", existants: [], total: 0, erreur: "" });
  const utilisateursActifs = db.users.filter((u) => u.actif !== false);
  const verifierSecurite = async () => {
    setVerifSecu({ statut: "chargement", existants: [], total: 0, erreur: "" });
    const r = await etatComptesAuth(utilisateursActifs.map((u) => u.id));
    if (!r.ok) { setVerifSecu({ statut: "erreur", existants: [], total: 0, erreur: r.raison }); return; }
    setVerifSecu({ statut: "fait", existants: r.existants, total: r.total, erreur: "" });
  };

  // ---- TRANSFERT DU RÔLE D'ADMINISTRATEUR PRINCIPAL ----
  const [nouveauPrincipal, setNouveauPrincipal] = useState("");

  const transfererPrincipal = async () => {
    if (!estAdminPrincipal(db, profile)) return;
    const u = db.users.find((x) => x.id === nouveauPrincipal);
    if (!u) { uAlert("Choisissez un administrateur."); return; }
    if (!await uConfirm(
      `⚠ Transférer le rôle d'administrateur principal à ${u.nom} ?\n\n` +
      `Il pourra alors réinitialiser l'application (depuis le logiciel Windows), et VOUS ne le pourrez plus.\n\nCette action est immédiate.`
    )) return;
    save({
      ...db,
      users: db.users.map((x) => ({ ...x, admin_principal: x.id === u.id })),
    }, `👑 Rôle d'administrateur principal transféré de ${profile.nom} à ${u.nom}`);
    setNouveauPrincipal("");
    uAlert(`✅ ${u.nom} est désormais l'administrateur principal.`);
  };

  // ---- NOTE AFFICHÉE SOUS LE DIMENSIONNEMENT ----
  const [note, setNote] = useState(noteDimensionnement(db));

  const [tauxParr, setTauxParr] = useState(String(tauxParrainageDefaut(db)));

  const enregistrerTauxParrainage = () => {
    const t = Number(tauxParr);
    if (Number.isNaN(t) || t < 0 || t > 100) { uAlert("Entrez un taux entre 0 et 100."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, taux_parrainage: t })) },
      `Taux de parrainage par défaut fixé à ${t} %`);
    uAlert(`✅ Le taux de parrainage par défaut est désormais ${t} %.\n\nIl s'applique aux clients qui n'ont pas de taux personnel.`);
  };

  const enregistrerNote = () => {
    // L'écran Paramètres est déjà réservé à l'administrateur : pas de contrôle en plus.
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: note })) },
      "Note du dimensionnement modifiée");
    uAlert("✅ Note enregistrée. Elle s'affiche désormais sous le tableau des équipements proposés.");
  };

  const retablirNote = async () => {
    if (!await uConfirm("Rétablir le texte d'origine ?")) return;
    setNote(NOTE_DIM_DEFAUT);
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: NOTE_DIM_DEFAUT })) },
      "Note du dimensionnement rétablie");
  };

  // ---- SAUVEGARDE HORAIRE DANS UN DOSSIER (Google Drive, clé USB...) ----
  const choisirDossier = async () => {
    if (!dossierDispo()) {
      uAlert("Cette fonction nécessite Google Chrome ou Microsoft Edge sur ordinateur.\n\nSur téléphone, la sauvegarde quotidienne classique reste active.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
      const perm = await handle.requestPermission({ mode: "readwrite" });
      if (perm !== "granted") { uAlert("Autorisation refusée."); return; }
      await ecrireDansDossier(db, handle);      // première écriture immédiate : on vérifie que ça marche
      await memoriserDossier(handle);
      setDossierAuto(handle);
      uAlert(`✅ Dossier « ${handle.name} » configuré.\n\nLe fichier « ${NOM_FICHIER_AUTO} » y sera réécrit toutes les heures, automatiquement.\n\nSi ce dossier est synchronisé par Google Drive, vos données partent dans le cloud toutes seules.`);
    } catch (e) {
      if (e && e.name === "AbortError") return;  // l'utilisateur a fermé la fenêtre
      uAlert("Impossible d'utiliser ce dossier : " + e.message);
    }
  };

  const retirerDossier = async () => {
    if (!await uConfirm("Désactiver la sauvegarde horaire automatique ?\n\nLe fichier déjà écrit ne sera pas supprimé.")) return;
    await oublierDossier();
    setDossierAuto(null);
  };

  const sauvegarderMaintenant = async () => {
    if (!dossierAuto) return;
    try {
      await ecrireDansDossier(db, dossierAuto);
      uAlert(`✅ Sauvegarde écrite dans « ${dossierAuto.name} / ${NOM_FICHIER_AUTO} ».`);
    } catch (e) {
      uAlert("Échec : " + e.message);
    }
  };

  const [f, setF] = useState({ nom: "", couleur: PALETTE[0][1], depot: false, adresse: "", tel: "" });
  const [couleurPour, setCouleurPour] = useState(null);
  const [positionPour, setPositionPour] = useState(null); // boutique dont on choisit la position GPS
  const nomCouleur = (hex) => (PALETTE.find(([, h]) => h === hex) || [hex])[0];

  const utilisee = (nom) =>
    db.produits.some((x) => x.boutique === nom) || db.ventes.some((x) => x.boutique === nom) ||
    db.depenses.some((x) => x.boutique === nom) || db.dettes.some((x) => x.boutique === nom);

  const ajouter = () => {
    const nom = f.nom.trim().toUpperCase();
    if (!nom) { uAlert("Veuillez saisir un nom."); return; }
    if (db.boutiques.some((b) => b.nom === nom)) { uAlert("Cette boutique existe déjà."); return; }
    save({ ...db, boutiques: [...db.boutiques, { id: uid(), nom, couleur: f.couleur, depot: !!f.depot, adresse: f.adresse.trim(), tel: f.tel.trim() }] });
    setF({ nom: "", couleur: "#2563eb", depot: false, adresse: "", tel: "" });
    uAlert(`${f.depot ? "Magasin" : "Boutique"} ${nom} créé(e) !`);
  };

  const basculerDepot = async (b) => {
    const versDepot = !b.depot;
    if (versDepot && db.ventes.some((v) => v.boutique === b.nom)) {
      if (!await uConfirm(`⚠ « ${b.nom} » a déjà des ventes enregistrées.\n\nEn faire un magasin la retirera des écrans de vente et de caisse (les ventes passées restent consultables).\n\nContinuer ?`)) return;
    }
    if (!versDepot && !await uConfirm(`Transformer le magasin « ${b.nom} » en boutique de vente ?`)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, depot: versDepot } : x)) },
      `« ${b.nom} » devient ${versDepot ? "un magasin (dépôt)" : "une boutique de vente"}`);
  };

  const supprimer = async (b) => {
    if (db.boutiques.length <= 1) { uAlert("Gardez au moins une boutique."); return; }
    if (utilisee(b.nom)) { uAlert(`« ${b.nom} » contient des données. Utilisez « Supprimer avec ses données » si vous voulez vraiment la retirer.`); return; }
    if (await uConfirm(`Supprimer « ${b.nom} » ?`)) save({ ...db, boutiques: db.boutiques.filter((x) => x.id !== b.id) }, `Suppression boutique ${b.nom}`);
  };

  // Suppression forcée : retire la boutique ET tout ce qui lui est rattaché
  // (produits, ventes, dépenses, dettes, ajustements, clôtures, prospects,
  // commandes). Irréversible — double confirmation obligatoire.
  const supprimerAvecDonnees = async (b) => {
    if (db.boutiques.length <= 1) { uAlert("Gardez au moins une boutique."); return; }
    const nom = b.nom;
    const compte = (arr) => arr.filter((x) => x.boutique === nom).length;
    const resume = [
      compte(db.produits) && `${compte(db.produits)} article(s)`,
      compte(db.ventes) && `${compte(db.ventes)} vente(s)`,
      compte(db.depenses) && `${compte(db.depenses)} dépense(s)`,
      compte(db.dettes) && `${compte(db.dettes)} dette(s)`,
    ].filter(Boolean).join(", ") || "aucune donnée détectée";
    if (!await uConfirm(`⚠ SUPPRESSION DÉFINITIVE de « ${nom} » ET de toutes ses données :\n${resume}\n\nCeci est IRRÉVERSIBLE et se synchronisera sur tous les appareils. Continuer ?`)) return;
    const confirmation = await uPrompt(`Pour confirmer, tapez exactement le nom de la boutique : ${nom}`, "");
    if (confirmation !== nom) { if (confirmation !== null) uAlert("Le nom tapé ne correspond pas — suppression annulée."); return; }
    const retirer = (arr) => (arr || []).filter((x) => x.boutique !== nom);
    const next = {
      ...db,
      boutiques: db.boutiques.filter((x) => x.id !== b.id),
      produits: retirer(db.produits),
      ventes: retirer(db.ventes),
      depenses: retirer(db.depenses),
      dettes: retirer(db.dettes),
      ajustements: retirer(db.ajustements),
      clotures: retirer(db.clotures),
      commandes: (db.commandes || []).filter((x) => x.boutique !== nom),
      users: db.users.map((u) => (u.boutique === nom ? { ...u, boutique: null, actif: false } : u)),
    };
    save(next, `Suppression définitive de ${nom} avec toutes ses données`);
    uAlert(`« ${nom} » et toutes ses données ont été supprimées.`);
  };

  // Téléverser le logo d'une boutique (redimensionné puis stocké dans la
  // base : il se synchronise automatiquement sur toutes les machines)
  const chargerLogo = (b) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const fichier = input.files && input.files[0];
      if (!fichier) return;
      const lecteur = new FileReader();
      lecteur.onload = () => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          // Dimensions et compression réduites : un logo n'a pas besoin d'être
          // grand pour un reçu, et ça évite tout blocage de synchronisation
          // sur une connexion lente (le fichier reste sous ~15 Ko en général).
          const ratio = Math.min(1, 220 / img.width, 130 / img.height);
          c.width = Math.max(1, Math.round(img.width * ratio));
          c.height = Math.max(1, Math.round(img.height * ratio));
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#ffffff"; // fond blanc (gère les PNG transparents)
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const data = c.toDataURL("image/jpeg", 0.7);
          save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, logo: data } : x)) });
          uAlert(`Logo de ${b.nom} mis à jour !\nIl apparaîtra sur les reçus de cette boutique, sur toutes les machines.`);
        };
        img.onerror = () => uAlert("Image illisible. Utilisez un fichier JPG ou PNG.");
        img.src = lecteur.result;
      };
      lecteur.readAsDataURL(fichier);
    };
    input.click();
  };

  const retirerLogo = async (b) => {
    if (await uConfirm(`Retirer le logo de ${b.nom} ? (le logo BMI sera utilisé sur les reçus)`)) {
      save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, logo: null } : x)) });
    }
  };

  // Sauvegarde de secours : export/restauration complète en un fichier JSON
  const exporterSauvegarde = async () => {
    telechargerSauvegarde(db);
    try { await marquerSauvegarde(); } catch {}
    uAlert("Sauvegarde téléchargée !\nConservez ce fichier en lieu sûr (clé USB, Google Drive...).");
  };

  const restaurerSauvegarde = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const fich = input.files && input.files[0];
      if (!fich) return;
      const lecteur = new FileReader();
      lecteur.onload = async () => {
        try {
          const donnees = JSON.parse(lecteur.result);
          if (!donnees.ventes || !donnees.boutiques) { uAlert("Ce fichier n'est pas une sauvegarde valide."); return; }
          if (await uConfirm(`Restaurer cette sauvegarde ?\n${(donnees.ventes || []).length} ventes · ${(donnees.produits || []).length} articles · ${(donnees.dettes || []).length} dettes\n\n⚠ Les données actuelles seront remplacées.`)) {
            save(donnees, "Restauration d'une sauvegarde de secours");
            uAlert("Sauvegarde restaurée avec succès !");
          }
        } catch {
          uAlert("Fichier illisible ou corrompu.");
        }
      };
      lecteur.readAsText(fich);
    };
    input.click();
  };

  const reinitialiserToutesLesDonnees = async () => {
    // ══════ BARRIÈRE 1 : uniquement depuis le LOGICIEL WINDOWS ══════
    if (!estAppWindows()) {
      uAlert(
        "🔒 Réinitialisation impossible depuis le site web.\n\n" +
        "Cette action n'est autorisée que depuis le LOGICIEL WINDOWS installé (le .exe), sur la machine de direction.\n\n" +
        "Un administrateur connecté depuis un navigateur — même légitime — ne peut pas effacer les données."
      );
      return;
    }

    // ══════ BARRIÈRE 2 : uniquement l'ADMINISTRATEUR PRINCIPAL ══════
    if (!estAdminPrincipal(db, profile)) {
      const p = adminPrincipal(db);
      uAlert(
        "🔒 Réinitialisation réservée à l'administrateur principal.\n\n" +
        (p ? `Seul « ${p.nom} » peut effectuer cette action.` : "Aucun administrateur principal n'est désigné.") +
        "\n\nVotre compte est administrateur, mais pas principal."
      );
      return;
    }

    // ══════ BARRIÈRE 3 : connexion obligatoire ══════
    if (!navigator.onLine) {
      uAlert("⚠ Vous êtes hors ligne.\n\nLa réinitialisation doit effacer les données SUR LE SERVEUR, sinon elles reviendront. Reconnectez-vous à internet et recommencez.");
      return;
    }

    // ══════ BARRIÈRE 4 : sauvegarde OBLIGATOIRE ══════
    if (!await uConfirm(
      "🧨 RÉINITIALISATION COMPLÈTE\n\n" +
      "Toutes les boutiques, produits, ventes, dépenses, dettes, prospects, chantiers et l'historique seront effacés — ici, sur le serveur, et sur TOUS les appareils.\n\n" +
      "Seuls les comptes utilisateurs seront conservés.\n\n" +
      "Une sauvegarde complète va d'abord être téléchargée. Continuer ?"
    )) return;

    telechargerSauvegarde(db, "_avant_reinitialisation");
    if (!await uConfirm(
      "💾 Une sauvegarde vient d'être téléchargée dans vos Téléchargements.\n\n" +
      "VÉRIFIEZ MAINTENANT qu'elle existe bien, et mettez-la en lieu sûr.\n\n" +
      "Confirmez-vous avoir la sauvegarde en main ?"
    )) { uAlert("Réinitialisation annulée. Aucune donnée n'a été touchée."); return; }

    // ══════ BARRIÈRE 5 : code aléatoire à recopier ══════
    const code = codeConfirmation();
    const saisi = await uPrompt(
      `⚠ DERNIER AVERTISSEMENT — action IRRÉVERSIBLE.\n\nPour confirmer, recopiez exactement ce code :\n\n        ${code}\n\n(Il change à chaque tentative : impossible de le taper machinalement.)`,
      ""
    );
    if (saisi === null) return;
    if (String(saisi).trim().toUpperCase() !== code) {
      uAlert("Réinitialisation annulée : le code ne correspond pas.\n\nAucune donnée n'a été touchée.");
      return;
    }

    // ══════ BARRIÈRE 6 : mot de passe de l'administrateur principal ══════
    const mdp = await uPrompt("🔑 Dernière étape : saisissez VOTRE mot de passe pour confirmer votre identité.", "");
    if (mdp === null) return;
    const moi = db.users.find((u) => u.id === profile.id);
    const { ok: bon } = await verifierMotDePasse(moi || {}, String(mdp));
    if (!bon) {
      uAlert("❌ Mot de passe incorrect. Réinitialisation annulée.\n\nAucune donnée n'a été touchée.");
      return;
    }

    // Combien d'enregistrements va-t-on effacer ? (pour la trace)
    const total = Object.keys(db).reduce((n, k) => n + (Array.isArray(db[k]) && k !== "users" ? db[k].length : 0), 0);

    uAlert("Effacement en cours… Ne fermez pas l'application.");

    // 1) On vide D'ABORD la file d'attente et la base locale.
    //    Sans cela, des écritures en attente reposteraient les données effacées.
    await viderLocal();

    // 2) On vide le SERVEUR, table par table, en une seule requête chacune,
    //    et on pose un marqueur global que les autres appareils liront.
    const rapport = await reinitialiserDistant();

    // 3) On repart d'une base propre.
    //    ATTENTION : on installe D'ABORD la base vide comme état de référence.
    //    Sinon, save() comparerait l'ANCIENNE base à la nouvelle et générerait
    //    une suppression par enregistrement — des milliers de requêtes, tout ce
    //    qu'on cherchait justement à éviter en effaçant le serveur en masse.
    const vide = {};
    Object.keys(db).forEach((k) => { vide[k] = Array.isArray(db[k]) ? [] : db[k]; });
    vide.users = db.users;
    vide.audits = [];
    setDb(vide); // dbRef pointe désormais sur la base vide : plus aucun diff destructeur

    // La trace est écrite APRÈS le marqueur global, avec un horodatage postérieur :
    // elle survit ainsi au vidage que le marqueur déclenche sur chaque appareil.
    await new Promise((r) => setTimeout(r, 1200));
    const trace = {
      id: uid(), date: new Date().toISOString(), user: profile.nom,
      action: `🧨 RÉINITIALISATION COMPLÈTE depuis le logiciel Windows — ${total} enregistrement(s) effacé(s)`,
    };
    save({ ...vide, audits: [trace] }); // un seul envoi : la trace

    if (rapport.echecs.length) {
      uAlert(`⚠ Réinitialisation INCOMPLÈTE.\n\nEffacées : ${rapport.effacees.length} collection(s).\nÉchecs :\n${rapport.echecs.join("\n")}\n\nRelancez la réinitialisation après avoir vérifié votre connexion.`);
    } else {
      uAlert(`✅ Réinitialisation terminée.\n\n${rapport.effacees.length} collections effacées, ici et sur le serveur.\nLes comptes utilisateurs sont conservés.\n\nLes AUTRES appareils videront leur base automatiquement à leur prochaine synchronisation — demandez à chacun d'ouvrir l'application une fois.`);
    }
    setTimeout(() => window.location.reload(), 1500);
  };

  const resyncComplet = async () => {
    if (!await uConfirm(
      "Tout retélécharger depuis le serveur ?\n\n" +
      "Cet appareil relira l'INTÉGRALITÉ des données du serveur. Vos modifications locales non encore envoyées seront D'ABORD sauvegardées sur le serveur : rien ne sera perdu.\n\nCela peut prendre quelques secondes."
    )) return;
    if (!navigator.onLine) {
      uAlert("⚠ Vous êtes hors ligne.\n\nLe retéléchargement a besoin d'internet. Reconnectez-vous et réessayez.");
      return;
    }
    try {
      // ÉTAPE 1 — envoyer tout ce qui est en attente. On protège ainsi les
      // données créées hors ligne AVANT toute relecture.
      await synchroniser();

      // ÉTAPE 2 — retélécharger, mais SEULEMENT si la file est bien vide.
      // forcerResynchronisation renvoie le nombre d'éléments restants.
      let reste = await forcerResynchronisation();

      // Si des éléments résistent (réseau lent), on réessaie l'envoi jusqu'à 3 fois.
      for (let i = 0; i < 3 && reste > 0; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        await synchroniser();
        reste = await forcerResynchronisation();
      }

      if (reste > 0) {
        // On n'a PAS retéléchargé : la file n'est pas vide. Aucune donnée locale
        // n'a été touchée — c'est exactement le comportement voulu.
        uAlert(`⚠ Retéléchargement annulé pour votre sécurité.\n\n${reste} élément(s) créé(s) ici ne sont pas encore partis sur le serveur (connexion instable ?).\n\nVos données locales sont INTACTES. Réessayez quand la connexion sera meilleure.`);
        return;
      }

      // ÉTAPE 3 — la file est vide : on peut relire sans rien écraser.
      await synchroniser();
      setDb(await chargerTout());
      uAlert("✅ Retéléchargement terminé. Vos données sont à jour avec le serveur.");
    } catch {
      uAlert("Erreur pendant le retéléchargement. Vérifiez votre connexion et réessayez.\n\nVos données locales n'ont pas été touchées.");
    }
  };

  const modifierInfos = async (b) => {
    const adresse = await uPrompt(`Adresse de ${b.nom} (imprimée sur les reçus) :`, b.adresse || "Lomé, Togo");
    if (adresse === null) return;
    const tel = await uPrompt(`Téléphone de ${b.nom} (imprimé sur les reçus) :`, b.tel || "");
    if (tel === null) return;
    const email = await uPrompt(`Email de ${b.nom} (imprimé sur les reçus) :`, b.email || "Bmitogo.info@gmail.com");
    if (email === null) return;
    const message = await uPrompt(`Message en bas du reçu :`, b.message || "Merci pour votre achat ! / Thank you for your purchase!");
    if (message === null) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, adresse, tel, email, message } : x)) });
    uAlert("Informations du reçu mises à jour !");
  };

  const enregistrerPosition = (b, lat, lng) => {
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat, lng } : x)) }, `Position GPS de ${b.nom} mise à jour`);
  };
  const retirerPosition = async (b) => {
    if (!await uConfirm(`Retirer la position GPS de ${b.nom} ?`)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat: null, lng: null } : x)) }, `Position GPS de ${b.nom} retirée`);
    setPositionPour(null);
  };

  return (
    <div className="space-y-4">
      {couleurPour && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <div className="font-bold text-slate-900 mb-3">Couleur de {couleurPour.nom}</div>
            <div className="flex flex-wrap gap-3">
              {PALETTE.map(([nomC, hex]) => (
                <button key={hex} title={nomC}
                  onClick={() => { save({ ...db, boutiques: db.boutiques.map((x) => (x.id === couleurPour.id ? { ...x, couleur: hex } : x)) }, `Couleur de ${couleurPour.nom} → ${nomC}`); setCouleurPour(null); }}
                  className={`w-10 h-10 rounded-full border-2 shadow ${couleurPour.couleur === hex ? "border-slate-900 scale-110" : "border-white"}`}
                  style={{ backgroundColor: hex }}></button>
              ))}
            </div>
            <div className="mt-2 text-xs text-slate-500">Survolez une pastille pour voir le nom de la couleur.</div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setCouleurPour(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
      {positionPour && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-lg">
            <div className="font-bold text-slate-900 mb-1">📌 Position GPS de {positionPour.nom}</div>
            <div className="text-xs text-slate-500 mb-3">Cliquez sur la carte, ou faites glisser le repère, pour marquer l'emplacement exact. C'est ce lien qui sera envoyé au client pour qu'il s'y rende facilement.</div>
            <CarteChoixPosition
              lat={db.boutiques.find((x) => x.id === positionPour.id)?.lat}
              lng={db.boutiques.find((x) => x.id === positionPour.id)?.lng}
              onChoisir={(lat, lng) => enregistrerPosition(positionPour, lat, lng)}
            />
            <div className="mt-4 flex justify-between items-center">
              {positionPour.lat
                ? <button onClick={() => retirerPosition(positionPour)} className="text-xs text-red-600 underline">Retirer la position</button>
                : <span />}
              <button onClick={() => setPositionPour(null)} className="px-4 py-2 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">Terminé</button>
            </div>
          </div>
        </div>
      )}
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Ajouter une boutique</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="Ex : BMISHOP CENTRE" /></Field>
          <Field label="Localisation (facultatif)"><input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} placeholder="Ex : Agoè, non loin de la station Total" /></Field>
          <Field label="Téléphone (facultatif)"><input type="tel" className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} placeholder="+228 90 00 00 00" /></Field>
          <div className="lg:col-span-3">
            <Field label="Couleur">
              <div className="flex flex-wrap gap-2 items-center">
                {PALETTE.map(([nomC, hex]) => (
                  <button key={hex} type="button" title={nomC} onClick={() => setF({ ...f, couleur: hex })}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${f.couleur === hex ? "border-slate-900 scale-110 shadow" : "border-white shadow-sm"}`}
                    style={{ backgroundColor: hex }}></button>
                ))}
                <span className="text-sm font-semibold text-slate-600 ml-1">{nomCouleur(f.couleur)}</span>
              </div>
            </Field>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mt-3">
          <input type="checkbox" checked={!!f.depot} onChange={(e) => setF({ ...f, depot: e.target.checked })} />
          🏭 C'est un <b>magasin (dépôt)</b> : on y stocke la marchandise, on n'y vend pas. Il sert à ravitailler les boutiques.
        </label>
        <div className="text-xs text-slate-400 mt-2">La localisation et le téléphone pourront toujours être ajoutés ou modifiés plus tard, ci-dessous (« 📍 Infos reçu »).</div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Créer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Boutiques ({db.boutiques.length})</div>
        <table className="w-full text-sm min-w-[480px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Boutique", "Logo", "Coordonnées reçu", "Couleur", "Données", ""].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {db.boutiques.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2"><Badge boutique={b.nom} />
                  <div className="text-xs font-bold mt-1">{b.depot ? <span className="text-purple-700">🏭 Magasin (dépôt)</span> : <span className="text-slate-400">Boutique de vente</span>}</div>
                  <button onClick={() => basculerDepot(b)} className="text-xs font-bold text-sky-800 underline">{b.depot ? "→ En faire une boutique" : "→ En faire un magasin"}</button>
                </td>
                <td className="px-4 py-2">{b.logo ? <img src={b.logo} alt="" className="h-9 w-auto rounded border border-slate-200 bg-white" /> : <span className="text-xs text-slate-400">Logo BMI (défaut)</span>}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  <div>{b.adresse || "Lomé, Togo"}</div>
                  {b.tel && <div>Tél : {b.tel}</div>}
                  {b.email && <div>{b.email}</div>}
                </td>
                <td className="px-4 py-2"><span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded-full inline-block border border-slate-200" style={{ backgroundColor: b.couleur }}></span>{nomCouleur(b.couleur)}</span></td>
                <td className="px-4 py-2 text-xs text-slate-500">{utilisee(b.nom) ? "Contient des données" : "Vide"}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <button onClick={() => chargerLogo(b)} className="text-xs font-bold text-blue-700 underline mr-2">🖼 Logo</button>
                  {b.logo && <button onClick={() => retirerLogo(b)} className="text-xs text-slate-500 underline mr-2">Retirer</button>}
                  <button onClick={() => modifierInfos(b)} className="text-xs font-bold text-sky-800 underline mr-2">📍 Infos reçu</button>
                  <button onClick={() => setPositionPour(b)} className={`text-xs font-bold underline mr-2 ${b.lat ? "text-green-700" : "text-sky-800"}`}>📌 {b.lat ? "Position GPS ✓" : "Position GPS"}</button>
                  <button onClick={() => setCouleurPour(b)} className="text-xs font-bold text-sky-800 underline mr-2">Couleur</button>
                  <button onClick={() => supprimer(b)} className="text-xs text-red-600 underline mr-2">Suppr.</button>
                  {utilisee(b.nom) && <button onClick={() => supprimerAvecDonnees(b)} className="text-xs font-bold text-white bg-red-700 rounded px-2 py-0.5 hover:bg-red-800">Suppr. avec ses données</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🤝 Taux de parrainage par défaut</div>
        <div className="text-xs text-slate-500 mb-3">
          Ce que touche un client qui en parraine un autre, sur l'installation de son filleul — versé à la réception. Un client peut avoir un taux personnel (👥 Utilisateurs → 💰 Commission) : celui-ci prime alors sur cette valeur.
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Taux (%)">
            <input type="number" min="0" max="100" step="0.5" className={inputCls + " w-32"} value={tauxParr} onChange={(e) => setTauxParr(e.target.value)} />
          </Field>
          <button onClick={enregistrerTauxParrainage} className={btnDark}>✅ Enregistrer le taux</button>
        </div>
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">☀️ Note affichée sous le dimensionnement</div>
        <div className="text-xs text-slate-500 mb-3">
          Ce texte apparaît sous le tableau « Équipements proposés ». Modifiez-le librement — ou videz-le pour ne rien afficher.
        </div>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[110px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Laissez vide pour n'afficher aucune note."
        />
        <div className="text-xs text-slate-400 mt-1">{note.length} caractère(s)</div>
        <div className="flex gap-2 flex-wrap mt-3">
          <button onClick={enregistrerNote} className={btnDark}>✅ Enregistrer la note</button>
          <button onClick={retablirNote} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">↺ Rétablir le texte d'origine</button>
        </div>
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">💾 Sauvegarde de secours</div>
        <div className="text-xs text-slate-500 mb-3">En plus de la synchronisation Supabase, exportez chaque semaine une copie complète des données (un rappel s'affiche automatiquement). Conservez le fichier sur une clé USB ou un Drive.</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exporterSauvegarde} className={btnDark}>💾 Exporter une sauvegarde complète</button>
          <button onClick={restaurerSauvegarde} className="px-5 py-2 rounded-lg border-2 border-sky-800 text-sky-800 font-bold text-sm hover:bg-sky-50">♻ Restaurer une sauvegarde</button>
        </div>
      </div>

      <div className={`rounded-xl p-4 bg-white border-2 ${dossierAuto ? "border-green-300" : "border-amber-300"}`}>
        <div className="font-bold mb-1 flex items-center gap-2">
          ⏱ Sauvegarde automatique toutes les heures
          {dossierAuto
            ? <span className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">ACTIVE</span>
            : <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">INACTIVE</span>}
        </div>

        {!dossierAuto ? (
          <>
            <div className="text-xs text-slate-600 mb-3">
              Désignez un dossier : l'application y réécrira le même fichier <b>{NOM_FICHIER_AUTO}</b> toutes les heures, sans rien vous demander.
              <b> Choisissez un dossier synchronisé par Google Drive</b> et vos données partiront dans le cloud toutes seules — sans compte Google Cloud, sans configuration.
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 mb-3">
              <b>Comment faire :</b>
              <div className="mt-1">1. Installez <b>Google Drive pour ordinateur</b> et connectez votre compte Gmail.</div>
              <div>2. Créez un dossier <b>Google Drive → Sauvegardes BMI</b>.</div>
              <div>3. Cliquez ci-dessous et sélectionnez ce dossier.</div>
            </div>
            <button onClick={choisirDossier} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">📁 Choisir le dossier de sauvegarde</button>
            {!dossierDispo() && <div className="mt-2 text-xs text-amber-700">⚠ Fonction disponible sur <b>Chrome ou Edge</b>, sur ordinateur uniquement.</div>}
          </>
        ) : (
          <>
            <div className="text-sm text-slate-700 mb-1">
              Dossier : <b>{dossierAuto.name}</b> → fichier <b>{NOM_FICHIER_AUTO}</b> (réécrit, jamais dupliqué)
            </div>
            <div className="text-xs text-slate-500 mb-3">
              {dernierAuto === null ? "Aucune écriture pour l'instant."
                : dernierAuto < 1 ? "✅ Dernière sauvegarde il y a moins d'une heure."
                : `Dernière sauvegarde il y a ${Math.floor(dernierAuto)} h.`}
              {" "}L'écriture se fait tant que l'application reste ouverte.
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={sauvegarderMaintenant} className={btnDark}>⏱ Sauvegarder maintenant</button>
              <button onClick={choisirDossier} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Changer de dossier</button>
              <button onClick={retirerDossier} className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50">Désactiver</button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🔁 Synchronisation forcée</div>
        <div className="text-xs text-slate-500 mb-3">La resynchronisation complète se fait maintenant automatiquement au premier démarrage de chaque machine après une mise à jour. Ce bouton reste disponible pour la relancer manuellement à tout moment, par exemple si des données locales semblent toujours absentes sur les autres appareils.</div>
        <button onClick={resyncComplet} className="px-5 py-2 rounded-lg bg-orange-600 text-white font-bold text-sm hover:bg-orange-700">🔁 Tout retélécharger depuis le serveur</button>
      </div>

      {/* ---- ADMINISTRATEUR PRINCIPAL ---- */}
      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">👑 Administrateur principal</div>
        <div className="text-xs text-slate-500 mb-3">
          Lui seul peut réinitialiser l'application — et uniquement depuis le logiciel Windows. Les autres administrateurs gardent tous leurs autres pouvoirs.
        </div>
        <div className="text-sm mb-3">
          Actuellement : <b className="text-sky-800">{adminPrincipal(db)?.nom || "aucun"}</b>
          {estAdminPrincipal(db, profile) && <span className="ml-2 text-xs font-bold text-green-700">(c'est vous)</span>}
        </div>
        {estAdminPrincipal(db, profile) && (
          <div className="flex gap-2 flex-wrap items-end">
            <Field label="Transférer à un autre administrateur">
              <select className={inputCls} value={nouveauPrincipal} onChange={(e) => setNouveauPrincipal(e.target.value)}>
                <option value="">— Choisir —</option>
                {db.users.filter((u) => u.role === "admin" && u.actif !== false && u.id !== profile.id).map((u) => (
                  <option key={u.id} value={u.id}>{u.nom}</option>
                ))}
              </select>
            </Field>
            <button onClick={transfererPrincipal} className="px-4 py-2 rounded-lg border-2 border-amber-500 text-amber-700 font-bold text-sm hover:bg-amber-50">⚠ Transférer</button>
          </div>
        )}
      </div>

      {/* ---- SÉCURITÉ SUPABASE : écran de contrôle avant durcissement ---- */}
      <div className="rounded-xl p-4 bg-white border-2 border-sky-200">
        <div className="font-bold mb-1 text-sky-900">🔐 Sécurité Supabase</div>
        <div className="text-xs text-slate-500 mb-3">
          Aujourd'hui, la base de données accepte les écritures avec la seule clé publique de l'application (visible dans son code).
          Chaque connexion crée en coulisse un vrai compte d'authentification Supabase — mais tant que <code>durcir_securite.sql</code> n'est
          pas exécuté, cette protection n'est pas encore appliquée. Vérifiez ici que tout le monde est prêt avant de l'activer.
        </div>

        {!supabaseConfigure ? (
          <div className="text-sm text-amber-700">Supabase n'est pas configuré sur cet appareil (mode 100 % local) — rien à vérifier ici.</div>
        ) : (
          <>
            <button onClick={verifierSecurite} disabled={verifSecu.statut === "chargement"} className={`${btnDark} disabled:opacity-50`}>
              {verifSecu.statut === "chargement" ? "Vérification…" : "🔍 Vérifier qui est prêt"}
            </button>

            {verifSecu.statut === "erreur" && (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">⚠ {verifSecu.erreur}</div>
            )}

            {verifSecu.statut === "fait" && (() => {
              const prets = utilisateursActifs.filter((u) => verifSecu.existants.includes(u.id));
              const pasPrets = utilisateursActifs.filter((u) => !verifSecu.existants.includes(u.id));
              const tousPrets = pasPrets.length === 0;
              return (
                <div className="mt-3">
                  <div className={`rounded-lg p-3 text-sm font-bold ${tousPrets ? "bg-green-50 border border-green-300 text-green-800" : "bg-amber-50 border border-amber-300 text-amber-800"}`}>
                    {tousPrets
                      ? `✅ Les ${prets.length} utilisateurs actifs ont une session sécurisée prête. Vous pouvez exécuter durcir_securite.sql.`
                      : `⚠ ${prets.length} / ${utilisateursActifs.length} utilisateurs actifs sont prêts. N'exécutez pas encore durcir_securite.sql — les autres perdraient la synchronisation.`}
                  </div>
                  {pasPrets.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs font-bold text-slate-500 uppercase mb-1">Pas encore prêts — ils doivent se reconnecter (avec internet actif) :</div>
                      <div className="flex flex-wrap gap-1.5">
                        {pasPrets.map((u) => <span key={u.id} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{u.nom}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ---- ZONE DANGEREUSE ---- */}
      <div className="rounded-xl p-4 bg-red-50 border-2 border-red-300">
        <div className="font-bold mb-1 text-red-800">🧨 Zone dangereuse — Réinitialisation complète</div>
        <div className="text-xs text-red-700 mb-3">
          Supprime définitivement TOUTES les données (boutiques, stocks, ventes, dettes, prospects, chantiers, historique...) — ici, sur le serveur, et sur tous les appareils. Seuls les comptes utilisateurs sont conservés.
        </div>

        <div className="rounded-lg bg-white border border-red-200 p-3 mb-3 text-xs">
          <div className="font-bold text-slate-800 mb-1">Conditions à réunir :</div>
          <div className={estAppWindows() ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {estAppWindows() ? "✅" : "❌"} Depuis le <b>logiciel Windows</b> {estAppWindows() ? "" : "— vous êtes actuellement sur le site web"}
          </div>
          <div className={estAdminPrincipal(db, profile) ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {estAdminPrincipal(db, profile) ? "✅" : "❌"} Être l'<b>administrateur principal</b>{estAdminPrincipal(db, profile) ? "" : ` — c'est ${adminPrincipal(db)?.nom || "quelqu'un d'autre"}`}
          </div>
          <div className="text-slate-600 mt-1">Puis : sauvegarde téléchargée · code aléatoire recopié · mot de passe confirmé.</div>
        </div>

        <button
          onClick={reinitialiserToutesLesDonnees}
          disabled={!estAppWindows() || !estAdminPrincipal(db, profile)}
          className={`px-5 py-2 rounded-lg font-bold text-sm ${(!estAppWindows() || !estAdminPrincipal(db, profile))
            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
            : "bg-red-700 text-white hover:bg-red-800"}`}>
          🧨 Réinitialiser toutes les données
        </button>
      </div>
    </div>
  );
}
