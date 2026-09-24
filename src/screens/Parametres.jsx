// ============================================================
// screens/Parametres.jsx — Paramètres : boutiques, note de
// dimensionnement, sauvegarde automatique, administrateur
// principal et réinitialisation (réservée au logiciel Windows
// et à l'admin principal — helpers dans lib/calculs.js).
// ============================================================
import { useState, useEffect } from "react";
import { CarteChoixPosition } from "../components/Carte";
import { chargerTout, marquerSauvegarde, forcerResynchronisation, memoriserDossier, oublierDossier, viderLocal } from "../db";
import { synchroniser, reinitialiserDistant } from "../sync";
import { etatComptesAuth, supabaseConfigure } from "../supabaseClient";
import { etatPermissionPush } from "../push";
import { PALETTE, LOGO, MOYENS_MOBILES } from "../lib/constants";
// Timo (14/09/2026) : « fonds de caisse, les deux ne peuvent jamais être deux
// choses différentes… je le préfère dans la fiche de la boutique » — UN geste.
import { ORIGINES_FONDS, DEST_BANQUE, DEST_DG, planFondsCaisse, SENS_REPRISE, manqueRemises, totalRemisesFonds, construireRemiseFonds, corrigerDateRemise, remisesFondsDe, libelleOrigineFonds, fondsCaisseFixe } from "../lib/versements";
import { uid, verifierMotDePasse, col, compresserPhoto, fmt, prefixeDe, today, dFR } from "../lib/core";
import { Field, inputCls, btnDark, Badge, uAlert, uConfirm, uPrompt, uChoix, demanderDate, champRecherche } from "../components/ui";
import { PERTES_PCT_DEFAUT } from "../lib/pompes.js";
import { pertesTuyauPct, tauxParrainageDefaut, NOTE_DIM_DEFAUT, noteDimensionnement, prixRailMetre, PRIX_RAIL_DEFAUT, longueurRailBarre, estAppWindows, boutiquesVisibles, changerEspaceRegarde, adminPrincipal, estAdminPrincipal, refuserSaufAdmin, refuserSaufAdminPrincipal, codeConfirmation, bloquerSiLecture, boutiquesFormation, voitLesDeuxEspaces, estCompteFormation, domainesDefinis, idDepuisNom, espaceDuCompte, utilisateursDeLEspace, filtreEspaceAffichage, chantiersDeLEspaceRegarde, evaluationsDe } from "../lib/calculs";
import { telechargerSauvegarde, NOM_FICHIER_AUTO, dossierDispo, dossierAutorise, ecrireDansDossier } from "../lib/sauvegarde";
import { separerCorbeille, contenuCorbeille, restaurerDeLaCorbeille, supprimerDefinitivement, nomDeLaFiche, DUREE_CORBEILLE_JOURS } from "../lib/corbeille";
import { catalogueAppareils, appareilsAClasser, idAppareil, CATALOGUE_APPAREILS } from "../lib/appareils";
import { barresDeRail } from "../lib/solaire";
import { banquesReglees, ajouterBanque, retirerBanque, nettoyerNomBanque } from "../lib/banques";
import { mesOutils, sortieEnCours } from "../lib/outillage";
import { MESSAGE_FIDELITE_DEFAUT, messageFideliteRegle, texteFidelite } from "../lib/comptesClients";
// 🔒 LE DROIT À L'EFFACEMENT (Timo, 18/09/2026) — voir lib/effacementClient.js.
import { clientsEffacables, cleDuClient, dossierClient, critiqueEffacement, avertissementsEffacement, resumeEffacement, effacerClient, journalEffacement, prochainNumeroEffacement, pseudonyme } from "../lib/effacementClient";
import { assistantActif, poserAssistant, TEXTE_ACCUEIL } from "../lib/assistantWhatsapp";
import { modeAssistant, poserModeAssistant, PHRASE_PRESENTATION } from "../lib/assistantIA";
import { dureeConservation, poserDureeConservation, critiqueDuree, clientsDepasses, libelleAnciennete, phraseConservation, DUREE_CONSERVATION_DEFAUT } from "../lib/conservation";
import { motsDuNumero } from "../lib/clientsConnus";
// 📄 LE DROIT D'ACCÈS (Timo, 18/09/2026) — voir lib/dossierPersonnel.js.
import { dossierPersonnel, critiqueDossier, journalDossier, nomDossierPersonnel, lignesCsvDossier } from "../lib/dossierPersonnel";
import { genererDossierPersonnel } from "../pdf";
// 👥 LE DROIT D'ACCÈS D'UN EMPLOYÉ (Timo, 19/09/2026) — MÊME document, MÊME
// dessinateur que celui d'un client : seules les données changent.
import { dossierEmploye, critiqueDossierEmploye, journalDossierEmploye, nomDossierEmploye } from "../lib/dossierEmploye";
import { exportCSV } from "../lib/export";
import { correspond } from "../lib/suggestions";

// ============ PARAMÈTRES ============
export function Parametres({ db, save, setDb, profile, dossierAuto, setDossierAuto, dernierAuto }) {
  // ⚠⚠⚠ TEMPORAIRE — demande EXPLICITE de Timo (16/08/2026), retiré
  // volontairement pour pouvoir réinitialiser depuis le site web en
  // attendant. Timo a dit lui-même qu'il remettrait cette obligation —
  // NE PAS supprimer cette barrière définitivement de soi-même, et la
  // restaurer dès qu'il le redemande (repasser `barriereWindowsActive`
  // à `estAppWindows()` partout ci-dessous). Les deux AUTRES barrières
  // (admin principal, connexion internet) restent pleinement actives.
  const barriereWindowsActive = true; // ← mettre estAppWindows() ici pour restaurer
  // ---- SÉCURITÉ SUPABASE : écran de contrôle avant durcissement ----
  const [verifSecu, setVerifSecu] = useState({ statut: "idle", existants: [], total: 0, erreur: "" });
  const [onglet, setOnglet] = useState("boutiques"); // sous-onglet ouvert

  // ---- 🔌 LES APPAREILS DU VOLET SOLAIRE (demande Timo, 09/09/2026) ----
  // La liste de départ (lib/appareils.js) plus ce qui a été ajouté, corrigé
  // ou retiré ici ; « à classer » = les appareils tapés dans les devis de
  // l'espace regardé que la liste ne connaît pas (dérivé, jamais écrit).
  const catalogueApp = catalogueAppareils(db, profile);
  const aClasser = appareilsAClasser(utilisateursDeLEspace(db, profile), catalogueApp);
  const persoApp = (boutiquesVisibles(db, profile, db.boutiques || []).find((x) => Array.isArray(x.appareils_catalogue))?.appareils_catalogue) || [];
  const ecrireCatalogue = (liste, journal) => {
    const visibles = new Set(boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom));
    save({ ...db, boutiques: db.boutiques.map((b) => (visibles.has(b.nom) ? { ...b, appareils_catalogue: liste } : b)) }, journal);
  };
  const ajouterAppareilCatalogue = async (prefil = {}) => {
    if (refuserSaufAdmin(profile, "Compléter la liste des appareils")) return;
    const nom = await uPrompt("Nom de l'appareil (tel qu'il apparaîtra dans la liste) :", prefil.nom || "");
    if (!nom || !nom.trim()) return;
    const p = await uPrompt(`Puissance typique de « ${nom.trim()} » (W) :`, prefil.puissance ? String(prefil.puissance) : "");
    if (p === null) return;
    const puissance = Number(p);
    if (!(puissance > 0)) { uAlert("Indiquez une puissance en watts, supérieure à zéro."); return; }
    const autres = await uPrompt("Autres noms, abréviations (séparés par des virgules, facultatif) :", "");
    if (autres === null) return;
    const id = idAppareil(nom.trim());
    const entree = { id, nom: nom.trim(), puissance, autres: autres.split(",").map((x) => x.trim()).filter(Boolean) };
    ecrireCatalogue([...persoApp.filter((x) => x.id !== id), entree], `🔌 Appareil ajouté à la liste : ${entree.nom} (${puissance} W) par ${profile.nom}`);
  };
  const corrigerAppareilCatalogue = async (a) => {
    if (refuserSaufAdmin(profile, "Corriger la liste des appareils")) return;
    const p = await uPrompt(`Puissance typique de « ${a.nom} » (W) :`, String(a.puissance));
    if (p === null) return;
    const puissance = Number(p);
    if (!(puissance > 0)) { uAlert("Indiquez une puissance en watts, supérieure à zéro."); return; }
    const autres = await uPrompt("Autres noms, abréviations (séparés par des virgules) :", (a.autres || []).join(", "));
    if (autres === null) return;
    const entree = { id: a.id, nom: a.nom, puissance, autres: autres.split(",").map((x) => x.trim()).filter(Boolean) };
    ecrireCatalogue([...persoApp.filter((x) => x.id !== a.id), entree], `🔌 Appareil corrigé : ${a.nom} → ${puissance} W par ${profile.nom}`);
  };
  const retirerAppareilCatalogue = async (a) => {
    if (refuserSaufAdmin(profile, "Retirer un appareil de la liste")) return;
    if (!await uConfirm(`Retirer « ${a.nom} » de la liste des appareils proposés ?\n\nLes devis déjà faits ne changent pas.`)) return;
    const deDepart = CATALOGUE_APPAREILS.some((x) => x.id === a.id);
    const liste = persoApp.filter((x) => x.id !== a.id);
    ecrireCatalogue(deDepart ? [...liste, { id: a.id, retire: true }] : liste, `🔌 Appareil retiré de la liste : ${a.nom} par ${profile.nom}`);
  };
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
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Transférer le rôle d'administrateur principal")) return;
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

  // ---- 🗑 CORBEILLE (demande Timo, 05/09/2026) ----
  // Les fiches supprimées attendent ici 30 jours ; l'administrateur principal
  // seul les voit, les restaure ou les efface pour de bon (lib/corbeille.js).
  const jeSuisPrincipal = estAdminPrincipal(db, profile);
  const corbeille = contenuCorbeille(db);
  const restaurerFiche = async (x) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Restaurer une fiche de la corbeille")) return;
    if (!await uConfirm(`Restaurer ${x.libelle.toLowerCase()} « ${nomDeLaFiche(x.table, x.fiche)} » ?\n\nLa fiche revient exactement telle qu'elle était au moment de sa suppression, sur tous les appareils.`)) return;
    save(restaurerDeLaCorbeille(db, x.table, x.fiche.id), `♻ ${x.libelle} « ${nomDeLaFiche(x.table, x.fiche)} » restauré(e) de la corbeille par ${profile.nom}`);
  };
  const effacerFiche = async (x) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Supprimer définitivement une fiche")) return;
    if (!await uConfirm(`Supprimer DÉFINITIVEMENT ${x.libelle.toLowerCase()} « ${nomDeLaFiche(x.table, x.fiche)} » ?\n\nCette fois, aucun retour possible.`)) return;
    save(supprimerDefinitivement(db, x.table, x.fiche.id), `Suppression définitive : ${x.libelle} « ${nomDeLaFiche(x.table, x.fiche)} » (corbeille) par ${profile.nom}`);
  };

  // ---- 🔒 DONNÉES PERSONNELLES : LE DROIT À L'EFFACEMENT (Timo, 18/09/2026) ----
  // « Mon app respecte déjà la législation togolaise sur cet aspect ? » — pas
  // encore : l'article 18 de nos contrats promet au client la suppression de
  // ses données, et l'application ne savait pas la faire. Elle le sait ici.
  // Toute la règle vit dans lib/effacementClient.js ; cet écran ne fait que
  // MONTRER ce qui va partir et demander le motif.
  const [qEff, setQEff] = useState("");
  const [cibleEff, setCibleEff] = useState(null);   // { nom, tel }
  // ⏳ La durée de conservation (Timo, 19/09/2026 : « 6 ans après le dernier
  // achat. On peut à tout moment changer cette durée »).
  const [dureeSaisie, setDureeSaisie] = useState(String(dureeConservation(db)));
  const [motifEff, setMotifEff] = useState("");

  // ⚠ LE MUR : on ne construit le dossier QUE sur l'espace regardé. Les
  // comptes passent par utilisateursDeLEspace (la table des comptes n'est PAS
  // cloisonnée par le serveur), les lignes par filtreEspaceAffichage, les
  // chantiers par chantiersDeLEspaceRegarde — jamais db.users ni db.ventes
  // en entier.
  const espaceEff = filtreEspaceAffichage(db, profile);
  const chantiersEff = chantiersDeLEspaceRegarde(db, profile);
  const enFormationEff = !!espaceDuCompte(db, profile);
  const comptesEff = utilisateursDeLEspace(db, profile);
  const idsEspaceEff = new Set(comptesEff.map((u) => u.id));
  const visibleEff = {
    comptes: comptesEff,
    ventes: (db.ventes || []).filter(espaceEff),
    dettes: (db.dettes || []).filter(espaceEff),
    proformas: (db.proformas || []).filter(espaceEff),
    commandes: (db.commandes || []).filter(espaceEff),
    // Un chantier mis à la corbeille porte encore le nom du client : il doit
    // être effacé lui aussi, sinon il ressortirait nommé à la restauration.
    chantiers: [...chantiersEff, ...(db.corbeille_clients_installes || [])],
    // Les prospects portent leur propre marque d'espace (ils n'ont pas de
    // boutique) : on compare à l'espace REGARDÉ, jamais à ce qu'EST le compte.
    prospects: (db.prospects || []).filter((p) => !!p.formation === !!espaceDuCompte(db, profile)),
    // ⚠ LE MUR sur les textes libres : un message appartient à l'espace des
    // gens qui se parlent, une ligne de journal porte sa propre marque. Sans
    // ces deux filtres, effacer en formation nettoierait le journal RÉEL.
    messages: (db.messages || []).filter((m) => idsEspaceEff.has(m.de_id) || idsEspaceEff.has(m.a_id)),
    audits: (db.audits || []).filter((a) => !!a.formation === !!espaceDuCompte(db, profile)),
  };
  const listeEff = clientsEffacables(visibleEff);
  const listeEffFiltree = qEff.trim()
    ? listeEff.filter((c) => correspond(`${c.nom} ${motsDuNumero(c.tel)}`, qEff))
    : listeEff.slice(0, 40);
  const dossierEff = cibleEff ? dossierClient(visibleEff, cibleEff) : null;
  // Les noms que portent LES AUTRES : un mot qu'ils partagent n'est pas
  // retiré des textes libres (voir motsSensibles). On le calcule ici parce
  // que seule l'application connaît les gens.
  const cleCibleEff = cibleEff ? cleDuClient(cibleEff.nom, cibleEff.tel) : null;
  const autresNomsEff = dossierEff ? [
    ...comptesEff.filter((u) => !dossierEff.compte || u.id !== dossierEff.compte.id).flatMap((u) => [u.nom, u.nom_base]),
    ...listeEff.filter((c) => c.cle !== cleCibleEff).map((c) => c.nom),
  ].filter(Boolean) : [];
  const refusEff = dossierEff ? critiqueEffacement(dossierEff, fmt) : "";
  const avertEff = dossierEff ? avertissementsEffacement(dossierEff, today(), autresNomsEff) : [];

  // ---- 📄 LE DROIT D'ACCÈS : remettre au client tout ce qu'on a sur lui ----
  // Même dossier que l'effacement (dossierClient), donc même mur et même
  // façon de le reconnaître — une seule source, sinon les deux finiraient
  // par se contredire.
  const dureeEnCours = dureeConservation(db);
  const vueDossier = dossierEff ? dossierPersonnel(dossierEff, { fmt, dFR, duree: dureeEnCours }) : null;
  // ⚠ La liste des dépassés part de `listeEff` — DÉJÀ filtrée par l'espace
  // regardé — jamais de db : une fonction qui reçoit une table entière et la
  // parcourt est un passage de mur en puissance (leçon du 18/09).
  const depassesEff = clientsDepasses(listeEff, dureeEnCours, today());
  const refusDossier = dossierEff ? critiqueDossier(dossierEff) : "";

  const remettreDossier = async (format) => {
    if (refuserSaufAdminPrincipal(db, profile, "Remettre à un client le dossier de ses données")) return;
    if (!vueDossier) return;
    const refus = critiqueDossier(dossierEff);
    if (refus) { uAlert(refus); return; }
    const ok = await uConfirm(
      `Établir le dossier personnel de « ${cibleEff.nom} » (${format}) ?\n\n`
      + `${dossierEff.total} enregistrement(s) y figureront.\n\n`
      + `⚠ Ce document rassemble TOUTES ses données : il ne se remet qu'à LUI, en main propre ou sur SON numéro.`
    );
    if (!ok) return;
    if (format === "PDF") {
      genererDossierPersonnel(vueDossier, { logo: LOGO, formation: enFormationEff, edite: dFR(today()), client: cibleEff.nom });
    } else {
      exportCSV(nomDossierPersonnel(cibleEff).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        ["", "", "", "", "", ""], lignesCsvDossier(vueDossier));
    }
    // Le journal garde la trace de la demande honorée — et il NOMME le
    // client : on n'efface rien ici, il faut pouvoir dire à qui on a remis.
    save(db, journalDossier(dossierEff, profile, { format }));
  };

  // ---- 👥 LE DROIT D'ACCÈS D'UN EMPLOYÉ (Timo, 19/09/2026) ----
  // « Et les employés dans cette histoire ? » — les trois premiers chantiers
  // ne couvraient QUE les clients. Ici, le MÊME document, dessiné par la MÊME
  // fonction : seules les données changent.
  // ⚠ AUCUN bouton d'effacement de ce côté, et ce n'est pas un oubli : la
  // paie et les déclarations CNSS se conservent par obligation légale.
  const [qEmp, setQEmp] = useState("");
  const [cibleEmp, setCibleEmp] = useState(null); // l'id

  // ⚠ LE MUR : les personnes passent par utilisateursDeLEspace (la table des
  // comptes n'est PAS cloisonnée par le serveur), jamais par db.users.
  const employesEff = comptesEff.filter((x) => x.role !== "client");
  const employesFiltres = qEmp.trim()
    ? employesEff.filter((x) => correspond(`${x.nom} ${x.nom_complet || ""} ${motsDuNumero(x.tel)}`, qEmp))
    : employesEff.slice(0, 40);
  const employeChoisi = cibleEmp ? employesEff.find((x) => x.id === cibleEmp) : null;

  // Ce qu'il a fait, rassemblé dans l'espace regardé seulement.
  const activiteEmp = employeChoisi ? {
    evaluations: evaluationsDe(db, employeChoisi),
    ventes: (db.ventes || []).filter(espaceEff).filter((v) => v.par === employeChoisi.nom),
    depenses: (db.depenses || []).filter(espaceEff).filter((d) => d.par_id === employeChoisi.id || d.par === employeChoisi.nom),
    chantiers: chantiersEff.filter((c) => (c.equipe || []).some((e) => e.user_id === employeChoisi.id)),
    outils: mesOutils(boutiquesVisibles(db, profile, db.boutiques || []), employeChoisi.id).map(({ outil }) => {
      const sortie = sortieEnCours(outil) || {};
      return { nom: outil.nom, numero: outil.numero, depuis: sortie.date, retour_prevu: sortie.retour_prevu };
    }),
    messages: (db.messages || []).filter((m) => m.de_id === employeChoisi.id || m.a_id === employeChoisi.id),
  } : null;
  const vueEmp = employeChoisi ? dossierEmploye(employeChoisi, activiteEmp, { fmt, dFR }) : null;

  const remettreDossierEmploye = async (format) => {
    if (refuserSaufAdminPrincipal(db, profile, "Remettre à un employé le dossier de ses données")) return;
    const refus = critiqueDossierEmploye(employeChoisi);
    if (refus) { uAlert(refus); return; }
    const nom = employeChoisi.nom_complet || employeChoisi.nom;
    const ok = await uConfirm(
      `Établir le dossier personnel de « ${nom} » (${format}) ?\n\n`
      + `Il contient sa rémunération, ses avances, son déclaratif CNSS et sa banque.\n\n`
      + `⚠ Ce document ne se remet qu'à LUI, en main propre.`
    );
    if (!ok) return;
    if (format === "PDF") {
      genererDossierPersonnel(vueEmp, { logo: LOGO, formation: enFormationEff, edite: dFR(today()), client: nom });
    } else {
      exportCSV(nomDossierEmploye(employeChoisi).toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        ["", "", "", "", "", ""], lignesCsvDossier(vueEmp));
    }
    save(db, journalDossierEmploye(employeChoisi, profile, { format }));
  };

  const lancerEffacement = async () => {
    if (bloquerSiLecture(db, profile)) return;
    // Revérifié DANS le geste, comme tout geste réservé à un rôle.
    if (refuserSaufAdminPrincipal(db, profile, "Effacer les données personnelles d'un client")) return;
    if (!dossierEff) return;
    const refus = critiqueEffacement(dossierEff, fmt);
    if (refus) { uAlert(`🔒 Effacement impossible.\n\n${refus}`); return; }
    const motif = motifEff.trim();
    if (!motif) { uAlert("Le motif est obligatoire : c'est lui qui prouve, plus tard, pourquoi ces données ont été effacées."); return; }
    const numero = prochainNumeroEffacement(db);
    const ok = await uConfirm(
      `Effacer les données personnelles de « ${cibleEff.nom} »${cibleEff.tel ? ` (${cibleEff.tel})` : ""} ?\n\n`
      + `${dossierEff.total} enregistrement(s) sont concernés.\n`
      + `Son nom sera remplacé partout par « ${pseudonyme(numero)} ».\n\n`
      + `⚠ AUCUN RETOUR POSSIBLE : ni la corbeille, ni une restauration de sauvegarde antérieure ne le ramèneront tel quel.`
    );
    if (!ok) return;
    save(
      effacerClient(db, dossierEff, profile, { motif, numero, autresNoms: autresNomsEff }),
      journalEffacement(dossierEff, profile, { motif, numero })
    );
    setCibleEff(null); setMotifEff(""); setQEff("");
    uAlert(`✅ Données effacées.\n\nCe client s'appelle désormais « ${pseudonyme(numero)} » dans les ventes et les chantiers gardés par obligation comptable.\n\nConservez la demande écrite du client : le journal garde la trace de l'opération, pas la demande.`);
  };

  // ---- PERSONNALISATION DE L'ÉCRAN DE CONNEXION (fêtes, etc.) ----
  // Réservé à l'admin PRINCIPAL, comme le transfert de rôle ci-dessus.
  // Stocké sur CHAQUE boutique (même mécanisme que taux_parrainage /
  // note_dim juste au-dessus) : pas de nouvelle table, pas de nouvelle
  // règle de sécurité côté Supabase — l'écran de connexion lit déjà
  // db.boutiques avant toute authentification (c'est ainsi qu'il colore
  // déjà le bandeau aujourd'hui), donc cette donnée y est visible de la
  // même façon, sans rien changer côté serveur.
  const boutiqueRef = db.boutiques[0] || {};
  // ⚠ RELEVÉ PAR TIMO (29/08/2026, capture) : « nous sommes dans les
  // paramètres du RÉEL » — et DFORMATION comme AFORMATION apparaissaient
  // quand même dans la liste. Cet écran lisait db.boutiques BRUT. C'est
  // pourtant ici qu'on renomme, qu'on supprime et qu'on bascule
  // boutique ↔ magasin : se tromper d'espace y est sans retour.
  const boutiquesDeLEcran = boutiquesVisibles(db, profile, db.boutiques);
  const [accueilTexte, setAccueilTexte] = useState(boutiqueRef.accueil_texte || "");
  const [accueilBadge, setAccueilBadge] = useState(boutiqueRef.accueil_couleur_badge || "#0284c7");
  const [accueilFond, setAccueilFond] = useState(boutiqueRef.accueil_couleur_fond || "#ffffff");
  const [imageEnCours, setImageEnCours] = useState(false);

  const enregistrerAccueil = (champs) => {
    if (refuserSaufAdminPrincipal(db, profile, "Personnaliser l'écran de connexion")) return;
    if (bloquerSiLecture(db, profile)) return;
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, ...champs })) }, `Personnalisation de l'écran de connexion modifiée`);
  };

  const chargerImageAccueil = async (fichier) => {
    if (!fichier) return;
    setImageEnCours(true);
    try {
      // ⚠ 500 px suffisaient quand l'image n'était qu'un fond flouté derrière
      // deux cadres opaques. Depuis que les cadres peuvent devenir
      // transparents (demande Timo, 20/08/2026), l'image se voit vraiment :
      // à 500 px elle paraissait floue et mal découpée sur un téléphone à
      // écran dense. 900 px reste raisonnable à synchroniser (~150 Ko).
      const data = await compresserPhoto(fichier, 900, 0.72);
      enregistrerAccueil({ accueil_image: data });
    } catch {
      uAlert("Impossible de lire cette image.");
    } finally {
      setImageEnCours(false);
    }
  };

  const reinitialiserAccueil = async () => {
    if (refuserSaufAdminPrincipal(db, profile, "Personnaliser l'écran de connexion")) return;
    if (!await uConfirm("Revenir à l'écran de connexion normal (texte, couleurs et image par défaut) ?")) return;
    setAccueilTexte(""); setAccueilBadge("#0284c7"); setAccueilFond("#ffffff");
    enregistrerAccueil({
      accueil_texte: "", accueil_couleur_badge: "", accueil_couleur_fond: "", accueil_image: "",
      accueil_opacite_cadres: "", accueil_bulles: false,
      accueil_image_ajustement: "", accueil_image_position: "",
      accueil_messages: "", accueil_anniversaires: false, accueil_image_etendue: false,
      accueil_etoiles: false, accueil_couleur_bulles: "",
      verrou_couleur_carte: "", verrou_opacite_carte: "",
    });
  };

  // ---- CACHET BMI TOGO — utilisé sur tous les contrats d'installation,
  // quel que soit l'initiateur (demande Timo). Même mécanisme de stockage
  // que l'image d'accueil ci-dessus (broadcast sur chaque boutique, déjà
  // lisible avant authentification) — pas de nouvelle table.
  const [cachetEnCours, setCachetEnCours] = useState(false);
  const chargerCachet = async (fichier) => {
    if (refuserSaufAdminPrincipal(db, profile, "Changer le cachet de l'entreprise")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!fichier) return;
    setCachetEnCours(true);
    try {
      const data = await compresserPhoto(fichier, 400, 0.7);
      save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, cachet_bmi: data })) }, "Cachet BMI Togo mis à jour");
    } catch {
      uAlert("Impossible de lire cette image.");
    } finally {
      setCachetEnCours(false);
    }
  };

  // ---- NOTE AFFICHÉE SOUS LE DIMENSIONNEMENT ----
  const [note, setNote] = useState(noteDimensionnement(db));
  const [msgFid, setMsgFid] = useState(messageFideliteRegle(db));

  const [tauxParr, setTauxParr] = useState(String(tauxParrainageDefaut(db)));

  const enregistrerTauxParrainage = () => {
    if (refuserSaufAdmin(profile, "Modifier le taux de parrainage")) return;
    if (bloquerSiLecture(db, profile)) return;
    const t = Number(tauxParr);
    if (Number.isNaN(t) || t < 0 || t > 100) { uAlert("Entrez un taux entre 0 et 100."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, taux_parrainage: t })) },
      `Taux de parrainage par défaut fixé à ${t} %`);
    uAlert(`✅ Le taux de parrainage par défaut est désormais ${t} %.\n\nIl s'applique aux clients qui n'ont pas de taux personnel.`);
  };

  // ---- 🏦 LA LISTE DES BANQUES (14/09/2026) ----
  // Timo : « une liste dans paramètres ». Elle sert au versement des fonds
  // vers BANQUE et à la banque de chaque employé — plus de nom retapé.
  // Rangée sur les boutiques, comme le prix du rail : rien à coller.
  const banques = banquesReglees(db);
  const [nouvelleBanque, setNouvelleBanque] = useState("");
  const ecrireBanques = (liste, journal) =>
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, banques: liste })) }, journal);
  const ajouterUneBanque = () => {
    if (refuserSaufAdmin(profile, "Modifier la liste des banques")) return;
    if (bloquerSiLecture(db, profile)) return;
    const r = ajouterBanque(banques, nouvelleBanque);
    if (r.refus) { uAlert(r.refus); return; }
    ecrireBanques(r.liste, `Banque ajoutée à la liste : ${nettoyerNomBanque(nouvelleBanque)}`);
    setNouvelleBanque("");
  };
  const retirerUneBanque = async (nom) => {
    if (refuserSaufAdmin(profile, "Modifier la liste des banques")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Retirer « ${nom} » de la liste des banques ?\n\nLes fiches et les versements qui la citent déjà ne changent pas.`)) return;
    ecrireBanques(retirerBanque(banques, nom), `Banque retirée de la liste : ${nom}`);
  };

  // ---- PRIX DU RAIL DE FIXATION (au mètre) ----
  // ⚠ Ce prix était écrit en dur dans le code du Dimensionnement : Timo ne
  // pouvait pas le changer lui-même quand son fournisseur augmentait.
  const [prixRail, setPrixRail] = useState(String(prixRailMetre(db)));
  // Longueur d'une barre (14/09/2026) : le stock compte des barres, le devis
  // des mètres ; le client paie les barres entamées (décision Timo, « b »).
  const [longueurRail, setLongueurRail] = useState(String(longueurRailBarre(db)));
  const enregistrerLongueurRail = () => {
    if (refuserSaufAdmin(profile, "Modifier la longueur d'une barre de rail")) return;
    if (bloquerSiLecture(db, profile)) return;
    const v = Number(String(longueurRail).replace(",", "."));
    if (Number.isNaN(v) || v <= 0) { uAlert("Entrez la longueur d'UNE barre de rail, en mètres (par exemple 4,2)."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, longueur_rail: v })) },
      `Longueur d'une barre de rail fixée à ${v} m`);
    uAlert(`✅ Une barre de rail fait désormais ${v} m.\n\nLe dimensionnement compte les mètres, arrondit aux barres entamées et facture ces barres au prix du mètre ; le stock perd ce nombre de barres à l'encaissement. S'applique aux PROCHAINS devis.`);
  };

  // ⚠ LES FROTTEMENTS DANS LE TUYAU D'UN FORAGE (20/09/2026) — une ESTIMATION,
  // pas un chiffre exact : ils dépendent du diamètre du tuyau, que nous ne
  // demandons pas. Réglable comme la longueur d'une barre de rail.
  const [pertesTuyau, setPertesTuyau] = useState(String(pertesTuyauPct(db)));
  const enregistrerPertesTuyau = () => {
    if (refuserSaufAdmin(profile, "Modifier l'estimation des frottements")) return;
    if (bloquerSiLecture(db, profile)) return;
    const v = Number(String(pertesTuyau).replace(",", "."));
    if (Number.isNaN(v) || v <= 0 || v > 50) { uAlert("Entrez un pourcentage entre 1 et 50 (par exemple 5)."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, pertes_tuyau_pct: v })) },
      `Frottements dans le tuyau estimés à ${v} % de sa longueur`);
    uAlert(`✅ Les frottements sont désormais estimés à ${v} % de la longueur du tuyau.\n\nC'est une ESTIMATION : le chiffre exact dépend du diamètre du tuyau. Elle sert au calcul « 💧 Quelle pompe pour ce forage ? » du devis.`);
  };

  const enregistrerPrixRail = () => {
    if (refuserSaufAdmin(profile, "Modifier le prix du rail")) return;
    if (bloquerSiLecture(db, profile)) return;
    const v = Number(prixRail);
    if (Number.isNaN(v) || v <= 0) { uAlert("Entrez un prix supérieur à 0 (le prix d'UN mètre de rail)."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, prix_rail: v })) },
      `Prix du rail de fixation fixé à ${fmt(v)} le mètre`);
    uAlert(`✅ Le rail de fixation est désormais facturé ${fmt(v)} le mètre.\n\nCe prix s'applique aux PROCHAINS devis. Les devis déjà envoyés gardent le prix auquel ils ont été établis.`);
  };

  // ---- DOMAINES DE PRODUITS ET LEURS FAMILLES ----
  // ⚠ Demande Timo : créer un domaine ici doit suffire à le faire apparaître
  // dans le dimensionnement. Cette livraison pose la liste ; le
  // dimensionnement la lira dans la livraison suivante.
  const [domaines, setDomaines] = useState(() => domainesDefinis(db).map((d) => ({ ...d, familles: [...(d.familles || [])] })));
  const [nouvDom, setNouvDom] = useState({ nom: "", icone: "📦", calcul: "libre" });
  const [nouvFam, setNouvFam] = useState({});

  const enregistrerDomaines = (liste, trace) => {
    if (refuserSaufAdmin(profile, "Modifier les domaines")) return;
    if (bloquerSiLecture(db, profile)) return;
    setDomaines(liste);
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, domaines: liste })) }, trace);
  };

  const ajouterDomaine = () => {
    const nom = nouvDom.nom.trim();
    if (!nom) { uAlert("Donnez un nom au domaine (ex : Caméra)."); return; }
    const id = idDepuisNom(nom);
    if (!id) { uAlert("Ce nom ne peut pas servir d'identifiant. Utilisez des lettres."); return; }
    if (domaines.some((d) => d.id === id)) { uAlert("Ce domaine existe déjà."); return; }
    enregistrerDomaines([...domaines, { id, nom, icone: nouvDom.icone || "📦", calcul: nouvDom.calcul, familles: [] }],
      `Domaine « ${nom} » créé`);
    setNouvDom({ nom: "", icone: "📦", calcul: "libre" });
    uAlert(`✅ Domaine « ${nom} » créé.\n\nAjoutez-lui ses familles de produits juste en dessous.`);
  };

  const supprimerDomaine = async (d) => {
    const utilises = db.produits.filter((p) => p.domaine === d.id).length;
    if (!await uConfirm(`Supprimer le domaine « ${d.nom} » ?` +
      (utilises ? `\n\n⚠ ${utilises} article(s) y sont rattachés. Ils ne seront pas effacés, mais se retrouveront sans domaine.` : ""))) return;
    enregistrerDomaines(domaines.filter((x) => x.id !== d.id), `Domaine « ${d.nom} » supprimé`);
  };

  const ajouterFamille = (d) => {
    const nom = String(nouvFam[d.id] || "").trim();
    if (!nom) return;
    if ((d.familles || []).some((f) => f.toLowerCase() === nom.toLowerCase())) { uAlert("Cette famille existe déjà dans ce domaine."); return; }
    enregistrerDomaines(domaines.map((x) => (x.id === d.id ? { ...x, familles: [...(x.familles || []), nom] } : x)),
      `Famille « ${nom} » ajoutée au domaine ${d.nom}`);
    setNouvFam({ ...nouvFam, [d.id]: "" });
  };

  const retirerFamille = async (d, f) => {
    const utilises = db.produits.filter((p) => p.domaine === d.id && p.categorie === f).length;
    if (!await uConfirm(`Retirer la famille « ${f} » du domaine ${d.nom} ?` +
      (utilises ? `\n\n⚠ ${utilises} article(s) l'utilisent. Ils gardent ce nom, mais il ne sera plus proposé.` : ""))) return;
    enregistrerDomaines(domaines.map((x) => (x.id === d.id ? { ...x, familles: (x.familles || []).filter((y) => y !== f) } : x)),
      `Famille « ${f} » retirée du domaine ${d.nom}`);
  };

  const enregistrerNote = () => {
    if (refuserSaufAdmin(profile, "Modifier la note de dimensionnement")) return;
    if (bloquerSiLecture(db, profile)) return;
    // L'écran Paramètres est déjà réservé à l'administrateur : pas de contrôle en plus.
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: note })) },
      "Note du dimensionnement modifiée");
    uAlert("✅ Note enregistrée. Elle s'affiche désormais sous le tableau des équipements proposés.");
  };

  // ---- 💬 Le mot de fidélité envoyé au client (Timo, 16/09/2026) ----
  // « Il peut être aussi paramétré dans les paramètres. » Rangé sur les
  // boutiques (`message_fidelite`), comme la liste des banques : rien à
  // coller dans Supabase.
  const enregistrerMsgFidelite = () => {
    if (refuserSaufAdmin(profile, "Modifier le mot de fidélité")) return;
    if (bloquerSiLecture(db, profile)) return;
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, message_fidelite: msgFid })) },
      "Mot de fidélité au client modifié");
    uAlert("✅ Enregistré. Ce mot est pré-rempli au clic sur WhatsApp, dans 👥 Utilisateurs, sur la fiche d'un client.");
  };

  // ---- ⏳ La durée de conservation des données d'un client (19/09/2026) ----
  // Timo : « 6 ans après le dernier achat. On peut à tout moment changer cette
  // durée. » Rangée sur les boutiques (`duree_conservation_ans`), comme le mot
  // de fidélité : rien à coller dans Supabase. Administrateur PRINCIPAL seul —
  // c'est lui qui répond de la promesse faite au client.
  const enregistrerDuree = async () => {
    if (refuserSaufAdminPrincipal(db, profile, "Changer la durée de conservation des données")) return;
    if (bloquerSiLecture(db, profile)) return;
    const refus = critiqueDuree(dureeSaisie);
    if (refus) { await uAlert(refus); return; }
    const ans = Number(dureeSaisie);
    save({ ...db, boutiques: poserDureeConservation(db.boutiques, ans) },
      `Durée de conservation des données : ${ans} ans`);
    uAlert(`✅ Enregistré. À partir de maintenant, le dossier que vous remettez à un client et son espace annoncent ${ans} ans. Rien ne s'efface pour autant : c'est vous qui effacez, client par client.`);
  };

  // ---- 🤖 L'assistant du numéro WhatsApp BMI (24/09/2026) ----
  // Une politique, pas une donnée : rangée sur les boutiques (`assistant_wa`),
  // comme la durée de conservation — rien à coller. Administrateur PRINCIPAL
  // seul : c'est le numéro de la maison qui parle.
  const assistantOn = assistantActif(db.boutiques);
  const basculerAssistant = async () => {
    if (refuserSaufAdminPrincipal(db, profile, "Couper ou remettre l'assistant WhatsApp")) return;
    if (bloquerSiLecture(db, profile)) return;
    const suivant = !assistantOn;
    if (!await uConfirm(suivant
      ? "Remettre l'assistant ? Il répondra tout seul aux clients qui écrivent au numéro BMI (conversations sans propriétaire seulement)."
      : "Couper l'assistant ? Les messages des clients continueront d'arriver dans 📲 WhatsApp, mais plus aucune réponse automatique ne partira.")) return;
    save({ ...db, boutiques: poserAssistant(db.boutiques, suivant) }, suivant ? "Assistant WhatsApp remis en service" : "Assistant WhatsApp coupé");
  };
  // Niveau 3 (24/09/2026) : l'assistant DISCUTE par une intelligence
  // artificielle, ou reste au menu à chiffres. Même réglage, même droit ;
  // sans clé côté serveur, le menu reprend de lui-même.
  const assistantMode = modeAssistant(db.boutiques);
  const changerModeAssistant = async (mode) => {
    if (refuserSaufAdminPrincipal(db, profile, "Changer la façon de répondre de l'assistant WhatsApp")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (mode === assistantMode) return;
    if (!await uConfirm(mode === "ia"
      ? "Faire discuter l'assistant par l'intelligence artificielle ? Les messages des clients seront lus par un service situé hors du Togo pour préparer la réponse (le client en est informé au premier message). Le menu à chiffres reprend tout seul si le service ne répond pas."
      : "Revenir au menu à chiffres ? Plus aucun message de client ne sera lu par le service d'IA.")) return;
    save({ ...db, boutiques: poserModeAssistant(db.boutiques, mode) }, mode === "ia" ? "Assistant WhatsApp : conversation par IA" : "Assistant WhatsApp : menu à chiffres");
  };

  const retablirMsgFidelite = async () => {
    if (refuserSaufAdmin(profile, "Modifier le mot de fidélité")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm("Rétablir le texte d'origine ?")) return;
    setMsgFid(MESSAGE_FIDELITE_DEFAUT);
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, message_fidelite: MESSAGE_FIDELITE_DEFAUT })) },
      "Mot de fidélité au client rétabli");
  };

  const retablirNote = async () => {
    if (refuserSaufAdmin(profile, "Modifier la note de dimensionnement")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm("Rétablir le texte d'origine ?")) return;
    setNote(NOTE_DIM_DEFAUT);
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: NOTE_DIM_DEFAUT })) },
      "Note du dimensionnement rétablie");
  };

  // ---- SAUVEGARDE HORAIRE DANS UN DOSSIER (Google Drive, clé USB...) ----
  // ⚠ Capture Timo (15/09/2026) : « Autoriser ce site à modifier les fichiers ? »
  // à chaque connexion. Le navigateur ne garde l'autorisation que tant qu'un
  // onglet du site reste ouvert. On la REGARDE ici (jamais on ne la demande) ;
  // si elle est tombée, l'écran le dit et c'est un CLIC qui la redemande.
  const [dossierEnPause, setDossierEnPause] = useState(false);
  useEffect(() => {
    let vivant = true;
    (async () => {
      if (!dossierAuto) { setDossierEnPause(false); return; }
      const ok = await dossierAutorise(dossierAuto);
      if (vivant) setDossierEnPause(!ok);
    })();
    return () => { vivant = false; };
  }, [dossierAuto]);

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
      await ecrireDansDossier(db, handle, { demander: true });  // première écriture immédiate : on vérifie que ça marche
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

  // Le CLIC qui redemande l'autorisation, quand le navigateur l'a laissée
  // tomber (il ne la garde que tant qu'un onglet du site reste ouvert). C'est
  // le seul endroit où une fenêtre d'autorisation peut s'ouvrir.
  const sauvegarderMaintenant = async () => {
    if (!dossierAuto) return;
    try {
      await ecrireDansDossier(db, dossierAuto, { demander: true });
      setDossierEnPause(false);
      uAlert(`✅ Sauvegarde écrite dans « ${dossierAuto.name} / ${NOM_FICHIER_AUTO} ».`);
    } catch (e) {
      uAlert("Échec : " + e.message);
    }
  };

  // ⚠ CONTRADICTION RELEVÉE PAR TIMO (18/08/2026) — l'écran proposait de
  // créer une boutique de FORMATION à un compte que le serveur empêche
  // d'écrire dans cet espace. L'application enregistrait sur l'appareil, le
  // serveur refusait, et l'opération restait bloquée dans la file d'attente
  // à réessayer toutes les 20 secondes, pour toujours.
  // Un écran ne doit jamais proposer un geste que le serveur refusera :
  // un compte cloisonné ne peut créer une boutique que DANS SON ESPACE, et
  // la case est verrouillée sur la bonne valeur, avec l'explication.
  const jeVoisLesDeuxEspaces = voitLesDeuxEspaces(db, profile);
  // Le sélecteur n'a de sens que pour qui traverse le mur — l'administrateur
  // principal — ET seulement s'il existe quelque chose à regarder de l'autre
  // côté. Sans boutique d'entraînement, le bouton ne mènerait nulle part.
  const peutRegarderLaFormation = estAdminPrincipal(db, profile) && boutiquesFormation(db).size > 0;
  const enFormation = espaceDuCompte(db, profile);
  const changerEspace = async (v) => {
    if (v === enFormation) return;
    if (!await uConfirm(v
      ? "Passer dans l'espace D'ENTRAÎNEMENT ?\n\nL'application devient violette. Tout ce que vous verrez et créerez appartiendra à l'entraînement, jusqu'à ce que vous reveniez au réel.\n\nLa page va se recharger."
      : "Revenir dans l'espace RÉEL ?\n\nL'application redevient bleue.\n\nLa page va se recharger.")) return;
    changerEspaceRegarde(profile.id, v);
  };
  const monEspaceFormation = estCompteFormation(db, profile);
  const [f, setF] = useState({ nom: "", couleur: PALETTE[0][1], depot: false,
    formation: voitLesDeuxEspaces(db, profile) ? false : estCompteFormation(db, profile),
    adresse: "", tel: "" });
  const [couleurPour, setCouleurPour] = useState(null);
  const [positionPour, setPositionPour] = useState(null); // boutique dont on choisit la position GPS
  // Le fonds de caisse d'une boutique : UN geste (14/09/2026), montant + origine de l'argent.
  const [fondsPour, setFondsPour] = useState(null);
  const [fondsForm, setFondsForm] = useState({ nouveau: "", montant: "", origine: DEST_DG, banque: "", date: today(), note: "", regularisation: false });
  const nomCouleur = (hex) => (PALETTE.find(([, h]) => h === hex) || [hex])[0];

  const utilisee = (nom) =>
    db.produits.some((x) => x.boutique === nom) || db.ventes.some((x) => x.boutique === nom) ||
    db.depenses.some((x) => x.boutique === nom) || db.dettes.some((x) => x.boutique === nom);

  const ajouter = () => {
    if (refuserSaufAdmin(profile, "Créer une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    const nom = f.nom.trim().toUpperCase();
    if (!nom) { uAlert("Veuillez saisir un nom."); return; }
    if (db.boutiques.some((b) => b.nom === nom)) { uAlert("Cette boutique existe déjà."); return; }
    // Le serveur refuserait la ligne : on l'arrête ici, avec la raison,
    // plutôt que de la laisser bloquer la file d'attente.
    // ⚠ PLUS DE CASE À COCHER (demande Timo, 26/08/2026) : la boutique naît
    // dans l'espace que vous REGARDEZ. Cocher une case en regardant l'autre
    // espace créait une boutique qui disparaissait aussitôt de la vue.
    const formation = espaceDuCompte(db, profile);
    save({ ...db, boutiques: [...db.boutiques, { id: uid(), nom, couleur: f.couleur, depot: !!f.depot, formation, adresse: f.adresse.trim(), tel: f.tel.trim() }] });
    setF({ nom: "", couleur: "#2563eb", depot: false, adresse: "", tel: "" });
    uAlert(`${f.depot ? "Magasin" : "Boutique"} ${nom}${formation ? " — espace D'ENTRAÎNEMENT" : ""} créé(e) !`);
  };

  const basculerDepot = async (b) => {
    if (refuserSaufAdmin(profile, "Changer le type d'une boutique (magasin / boutique)")) return;
    if (bloquerSiLecture(db, profile)) return;
    const versDepot = !b.depot;
    if (versDepot && db.ventes.some((v) => v.boutique === b.nom)) {
      if (!await uConfirm(`⚠ « ${b.nom} » a déjà des ventes enregistrées.\n\nEn faire un magasin la retirera des écrans de vente et de caisse (les ventes passées restent consultables).\n\nContinuer ?`)) return;
    }
    if (!versDepot && !await uConfirm(`Transformer le magasin « ${b.nom} » en boutique de vente ?`)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, depot: versDepot } : x)) },
      `« ${b.nom} » devient ${versDepot ? "un magasin (dépôt)" : "une boutique de vente"}`);
  };

  const supprimer = async (b) => {
    if (refuserSaufAdmin(profile, "Supprimer une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (db.boutiques.length <= 1) { uAlert("Gardez au moins une boutique."); return; }
    if (utilisee(b.nom)) { uAlert(`« ${b.nom} » contient des données. Utilisez « Supprimer avec ses données » si vous voulez vraiment la retirer.`); return; }
    if (await uConfirm(`Supprimer « ${b.nom} » ?`)) save({ ...db, boutiques: db.boutiques.filter((x) => x.id !== b.id) }, `Suppression boutique ${b.nom}`);
  };

  // Suppression forcée : retire la boutique ET tout ce qui lui est rattaché
  // (produits, ventes, dépenses, dettes, ajustements, clôtures, prospects,
  // commandes). Irréversible — double confirmation obligatoire.
  const supprimerAvecDonnees = async (b) => {
    if (refuserSaufAdminPrincipal(db, profile, "Supprimer une boutique avec toutes ses données")) return;
    if (bloquerSiLecture(db, profile)) return;
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
    if (refuserSaufAdmin(profile, "Changer le logo d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
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
    if (refuserSaufAdmin(profile, "Changer le logo d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
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

  // ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026) — LE GESTE LE PLUS DESTRUCTEUR DE
  // L'APPLICATION, ET IL N'AVERTISSAIT PRESQUE PAS.
  //
  // `save()` remplace l'état complet, puis sauvegarderDiff (db.js) compare
  // l'avant et l'après et met en file une SUPPRESSION pour chaque ligne
  // absente du nouveau. Or une sauvegarde est, par définition, plus ancienne
  // que la base : toutes les ventes, dettes, dépenses et fiches créées depuis
  // ce jour-là étaient supprimées — localement, puis sur le serveur, donc sur
  // TOUS les appareils.
  //
  // Et le garde-fou anti-écran-périmé de save() — celui qui refuse justement
  // d'effacer ce qu'il ne sait plus comparer — ne se déclenchait pas : un
  // fichier ne porte pas de numéro d'état (`__v`). La restauration passait
  // tout droit.
  //
  // L'avertissement disait « ⚠ Les données actuelles seront remplacées ». Il
  // ne disait ni « sur tous les appareils », ni « définitivement », ni
  // combien de jours de travail. Le fichier n'affichait même pas sa date.
  //
  // Quatre garde-fous, maintenant :
  //   1. réservé à l'administrateur PRINCIPAL ;
  //   2. on COMPTE et on NOMME ce qui serait perdu, table par table ;
  //   3. une copie de l'état actuel est exportée AVANT — sans elle, le geste
  //      est sans retour ;
  //   4. il faut recopier un mot pour confirmer, comme pour la
  //      réinitialisation (le clic seul ne suffit pas à ce niveau de dégât).
  const restaurerSauvegarde = () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!estAdminPrincipal(db, profile)) {
      uAlert("🔒 Seul l'administrateur PRINCIPAL peut restaurer une sauvegarde.\n\nCe geste peut effacer, sur tous les appareils, tout ce qui a été enregistré depuis la date du fichier.");
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const fich = input.files && input.files[0];
      if (!fich) return;
      const lecteur = new FileReader();
      lecteur.onload = async () => {
        let donnees;
        try {
          donnees = JSON.parse(lecteur.result);
        } catch {
          uAlert("Fichier illisible ou corrompu.");
          return;
        }
        if (!donnees.ventes || !donnees.boutiques) { uAlert("Ce fichier n'est pas une sauvegarde valide."); return; }

        // ---- CE QUI SERAIT PERDU, table par table ----
        // On compare les identifiants, pas les nombres : une ligne modifiée
        // depuis n'est pas une ligne perdue, une ligne ABSENTE si.
        const TABLES_SUIVIES = [
          ["ventes", "vente(s)"], ["dettes", "dette(s)"], ["depenses", "dépense(s)"],
          ["produits", "article(s)"], ["users", "compte(s)"],
          ["clients_installes", "chantier(s)"], ["commandes", "commande(s)"],
          ["prospects", "prospect(s)"], ["clotures", "clôture(s) de caisse"],
        ];
        const perdus = [];
        let totalPerdu = 0;
        for (const [table, libelle] of TABLES_SUIVIES) {
          const dansLeFichier = new Set((donnees[table] || []).map((r) => r.id));
          const n = (db[table] || []).filter((r) => !dansLeFichier.has(r.id)).length;
          if (n > 0) { perdus.push(`• ${n} ${libelle}`); totalPerdu += n; }
        }

        // La date du fichier : celle de la vente la plus récente qu'il
        // contient, à défaut celle du fichier lui-même.
        const derniereDate = (donnees.ventes || []).reduce((m, v) => (String(v.date || "") > m ? String(v.date) : m), "");
        const jours = derniereDate
          ? Math.max(0, Math.round((new Date(today()) - new Date(derniereDate)) / 86400000))
          : null;

        const entete = derniereDate
          ? `Sauvegarde du ${dFR(derniereDate)}${jours !== null ? ` — il y a ${jours} jour(s)` : ""}.`
          : "Sauvegarde sans date lisible.";

        if (totalPerdu === 0) {
          if (!await uConfirm(`${entete}\n\nElle contient tout ce que la base contient aujourd'hui : rien ne serait perdu.\n\nRestaurer quand même ?`)) return;
        } else {
          if (!await uConfirm(
            `⚠️ ATTENTION — CE GESTE EFFACE DU TRAVAIL.\n\n${entete}\n\n` +
            `${totalPerdu} enregistrement(s) existent aujourd'hui et ne sont PAS dans ce fichier :\n${perdus.join("\n")}\n\n` +
            `Ils seront supprimés ici, sur le serveur, et donc sur TOUS les appareils. C'est définitif.\n\n` +
            `Une copie de l'état ACTUEL va d'abord être téléchargée sur cet appareil.\n\nContinuer ?`
          )) return;

          // Un code TIRÉ AU HASARD, pas un mot fixe : on ne peut pas le taper
          // machinalement. Même procédé que la réinitialisation de la base.
          const code = codeConfirmation();
          const saisi = await uPrompt(
            `Dernière étape.\n\nPour confirmer la suppression de ${totalPerdu} enregistrement(s), recopiez ce code :\n\n${code}`,
            ""
          );
          if (saisi === null) return;
          if (String(saisi).trim().toUpperCase() !== code) { uAlert("Le code ne correspond pas. Rien n'a été touché."); return; }
        }

        // ---- LE FILET : l'état actuel part sur cet appareil AVANT tout ----
        try {
          telechargerSauvegarde(db, "avant-restauration");
        } catch {
          if (!await uConfirm("⚠ La copie de sécurité n'a pas pu être téléchargée.\n\nSans elle, ce geste est SANS RETOUR. Continuer quand même ?")) return;
        }

        // Une sauvegarde emporte la corbeille : on la remet de côté avant d'afficher.
        save(separerCorbeille(donnees), `Restauration d'une sauvegarde${derniereDate ? ` du ${dFR(derniereDate)}` : ""}${totalPerdu ? ` — ${totalPerdu} enregistrement(s) supprimé(s)` : ""} (par ${profile.nom})`);
        uAlert(`✅ Sauvegarde restaurée.${totalPerdu ? `\n\n${totalPerdu} enregistrement(s) ont été supprimés. La copie de l'état précédent est dans vos téléchargements.` : ""}`);
      };
      lecteur.readAsText(fich);
    };
    input.click();
  };

  // ⚠ Réinitialisation FORMATION SEULE (demande Timo, suite à la séparation
  // formation/réel par compte, 2.100.23) : contrairement à la vraie
  // réinitialisation ci-dessous (6 barrières, dont Windows + internet
  // obligatoire), Timo a confirmé EXPLICITEMENT vouloir UNIQUEMENT la
  // barrière admin principal ici — "c'est suffisant", ses propres mots.
  // Passe par le save() NORMAL de l'app (pas d'appel Supabase direct) :
  // fonctionne donc aussi hors ligne, comme n'importe quelle autre action.
  const reinitialiserFormationSeule = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!estAdminPrincipal(db, profile)) { uAlert("🔒 Seul l'administrateur PRINCIPAL peut faire ce changement."); return; }
    const bf = boutiquesFormation(db);
    if (bf.size === 0) { uAlert("Aucune boutique de formation n'existe pour le moment."); return; }

    // Boutique d'un chantier : via la vente si elle existe, sinon via la
    // dette liée (pose seule) — même repli qu'ailleurs dans l'app (imprimerPV).
    const boutiqueDuChantier = (c) => {
      const vente = db.ventes.find((v) => v.id === c.vente_id);
      if (vente) return vente.boutique;
      const dette = c.dette_id ? (db.dettes || []).find((d) => d.id === c.dette_id) : null;
      return dette?.boutique;
    };

    // ⚠ Le nettoyage était INCOMPLET : dépenses, mouvements de stock,
    // articles, clôtures, demandes de ravitaillement, prospects et comptes
    // clients d'entraînement restaient en base pour toujours — et les
    // dépenses continuaient d'alimenter les totaux du Tableau de bord.
    // Tout ce qui porte une boutique de formation, ou la marque d'espace
    // `formation` (devis, clients, prospects — qui n'ont pas de boutique),
    // part maintenant ensemble.
    const deB = (x) => bf.has(x.boutique);
    const clientsFormation = new Set(db.users.filter((u) => u.role === "client" && u.formation).map((u) => u.id));
    const produitsFormation = new Set((db.produits || []).filter(deB).map((p) => p.id));

    const compte = {
      ventes: db.ventes.filter(deB).length,
      dettes: (db.dettes || []).filter(deB).length,
      chantiers: (db.clients_installes || []).filter((c) => bf.has(boutiqueDuChantier(c))).length,
      commandes: (db.commandes || []).filter(deB).length,
      proformas: (db.proformas || []).filter(deB).length,
      depenses: (db.depenses || []).filter(deB).length,
      articles: produitsFormation.size,
      mouvements: (db.ajustements || []).filter((a) => deB(a) || produitsFormation.has(a.produit_id)).length,
      clotures: (db.clotures || []).filter(deB).length,
      prospects: (db.prospects || []).filter((p) => p.formation).length,
      clients: clientsFormation.size,
      devis: db.users.reduce((s, u) => s + (u.devis || []).filter((d) => d.formation).length, 0),
    };
    const total = Object.values(compte).reduce((s, n) => s + n, 0);
    if (total === 0) { uAlert("Rien à effacer : aucune donnée de formation n'a encore été saisie."); return; }

    const detail = [
      ["ventes", "vente(s)"], ["dettes", "dette(s) / réservation(s)"], ["chantiers", "chantier(s)"],
      ["commandes", "commande(s)"], ["proformas", "proforma(s)"], ["depenses", "dépense(s)"],
      ["articles", "article(s) de stock"], ["mouvements", "mouvement(s) de stock"],
      ["clotures", "clôture(s) de caisse"], ["devis", "devis"], ["clients", "compte(s) client"],
      ["prospects", "prospect(s)"],
    ].filter(([k]) => compte[k] > 0).map(([k, lbl]) => `• ${compte[k]} ${lbl}`).join("\n");

    if (!(await uConfirm(
      `Réinitialiser UNIQUEMENT les données de formation ?\n\n${detail}\n\n` +
      `soit ${total} enregistrement(s), sur les ${bf.size} boutique(s) de formation.\n\n` +
      `Les VRAIES boutiques ne seront jamais touchées. Les fiches du personnel (crédits BMI, signature, notes) ne sont pas touchées non plus, dans aucun des deux espaces.`
    ))) return;

    // ⚠ Ce nettoyage NE TOUCHE PAS aux fiches du personnel. La version
    // précédente retirait `devis`, `credits`, `signature_personnelle` et
    // `notes` de tout compte marqué formation : un employé RÉEL basculé
    // temporairement en formation perdait alors son historique de CRÉDIT
    // BMI — une donnée bien réelle, sans sauvegarde et sans avertissement.
    // Les devis, eux, sont rangés dans la fiche du CLIENT : c'est là qu'on
    // les enlève, et seulement ceux marqués formation.
    const nettoyerFiche = (u) => {
      const devis = (u.devis || []).filter((d) => !d.formation);
      return devis.length === (u.devis || []).length ? u : { ...u, devis };
    };

    save({
      ...db,
      ventes: db.ventes.filter((v) => !deB(v)),
      dettes: (db.dettes || []).filter((d) => !deB(d)),
      clients_installes: (db.clients_installes || []).filter((c) => !bf.has(boutiqueDuChantier(c))),
      commandes: (db.commandes || []).filter((c) => !deB(c)),
      proformas: (db.proformas || []).filter((p) => !deB(p)),
      depenses: (db.depenses || []).filter((d) => !deB(d)),
      produits: (db.produits || []).filter((p) => !deB(p)),
      ajustements: (db.ajustements || []).filter((a) => !deB(a) && !produitsFormation.has(a.produit_id)),
      clotures: (db.clotures || []).filter((c) => !deB(c)),
      prospects: (db.prospects || []).filter((p) => !p.formation),
      // Les demandes de ravitaillement / transfert vivent DANS la fiche
      // boutique : la boutique de formation reste, sa file d'attente est vidée.
      boutiques: db.boutiques.map((b) => (b.formation && (b.demandes || []).length ? { ...b, demandes: [] } : b)),
      // Comptes clients d'entraînement supprimés, et les messages qui leur
      // étaient adressés avec eux (sinon ils resteraient orphelins).
      users: db.users.filter((u) => !clientsFormation.has(u.id)).map(nettoyerFiche),
      messages: (db.messages || []).filter((m) => !clientsFormation.has(m.client_id) && !clientsFormation.has(m.a_id) && !clientsFormation.has(m.de_id)),
    }, `🎓 Réinitialisation FORMATION SEULE par l'administrateur principal — ${total} enregistrement(s) effacé(s), vraies boutiques et fiches du personnel non touchées`,
      { horsCloisonnement: true });

    uAlert(`✅ Formation réinitialisée.\n\n${total} enregistrement(s) effacés.\nLes vraies boutiques, les vraies données et les fiches du personnel n'ont pas été touchées.`);
  };

  const reinitialiserToutesLesDonnees = async () => {
    if (bloquerSiLecture(db, profile)) return;
    // ══════ BARRIÈRE 1 : uniquement depuis le LOGICIEL WINDOWS ══════
    if (!barriereWindowsActive) {
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
      uAlert(`✅ Réinitialisation terminée.\n\n${rapport.effacees.length} collections effacées, ici et sur le serveur.\nLes COMPTES utilisateurs sont conservés (nom, mot de passe, rôle) — mais leurs devis, contrats, crédits BMI et infos d'équipe ont bien été effacés.\n\nLes AUTRES appareils videront leur base automatiquement à leur prochaine synchronisation — demandez à chacun d'ouvrir l'application une fois.`);
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

  // Timo (13/09/2026) : « ajoute le réglage fonds de caisse fixe par boutique »
  // — le fonds qu'on laisse dans le tiroir pour les petites dépenses ; le
  // versement attendu devient solde − fonds fixe (lib/versements.js).
  // Puis (14/09/2026) : « les deux ne peuvent jamais être deux choses
  // différentes… je le préfère dans la fiche de la boutique » et « aucun lien
  // entre le fonds de caisse et les ventes ; le seul lien, c'est la
  // compensation ». Puis (15/09/2026, réponse B) : le fonds est GARDÉ À PART,
  // dans une enveloppe — il n'entre jamais dans le tiroir des ventes. Et « le
  // réglage dans les paramètres doit rester utile, car à tout moment je peux
  // augmenter ou diminuer le fonds de caisse » : on saisit ici le NOUVEAU
  // montant, le DG apporte la différence ou la reprend (règle pure
  // planFondsCaisse / construireRemiseFonds, serveur securite-20) ;
  // « Régulariser » comble un fonds réglé sans remise enregistrée (le trou).
  const modifierFondsFixe = (b) => {
    if (refuserSaufAdmin(profile, "Régler le fonds de caisse fixe d'une boutique")) return;
    setFondsForm({ nouveau: String(fondsCaisseFixe(db, b.nom) || ""), montant: "", origine: DEST_DG, banque: "", date: today(), note: "", regularisation: false });
    setFondsPour(b);
  };
  // ⚠ Timo, 15/09/2026 : une régularisation parle d'un argent remis dans le
  // PASSÉ. La dater d'aujourd'hui la fait tomber dans la clôture du jour — ce
  // qui a mis 50 000 F dans la caisse du 14/09 à DEMAKPOE. La date part donc
  // VIDE : c'est au DG de dire quel jour il a réellement remis cet argent.
  const regulariserFonds = (b) => setFondsForm({ nouveau: String(fondsCaisseFixe(db, b.nom) || ""), montant: String(manqueRemises(db, b.nom)), origine: DEST_DG, banque: "", date: "", note: "", regularisation: true });
  const enregistrerFonds = async () => {
    const b = fondsPour;
    if (!b) return;
    // L'argent sort de chez le DG (ou de la banque), ou y retourne : le DG seul
    // (serveur : securite-16 / -19 / -20).
    if (refuserSaufAdminPrincipal(db, profile, "Régler le fonds de caisse d'une boutique (DG)")) return;
    if (bloquerSiLecture(db, profile)) return;
    const plan = planFondsCaisse({ fondsActuel: fondsCaisseFixe(db, b.nom), nouveau: fondsForm.nouveau, manque: manqueRemises(db, b.nom), montant: fondsForm.montant, regularisation: fondsForm.regularisation });
    if (plan.refus) { uAlert(plan.refus); return; }
    const r = construireRemiseFonds(profile, { boutique: b.nom, montant: plan.montant, origine: fondsForm.origine, banque: fondsForm.banque, note: fondsForm.note, date: fondsForm.date, regularisation: plan.regularisation, sens: plan.sens });
    if (r.refus) { uAlert(r.refus); return; }
    const reprise = plan.sens === SENS_REPRISE;
    // ⚠ Timo (15/09/2026, réponse B) : le fonds est gardé À PART, dans une
    // enveloppe — jamais dans le tiroir. Une remise ou une reprise ne touche
    // donc ni la recette, ni ce qu'il y a à verser.
    const explication = reprise
      ? `${fmt(plan.montant)} sortent de l'enveloppe de ${b.nom} le ${dFR(fondsForm.date)} et rentrent dans la caisse « ${fondsForm.origine} ». Le tiroir des ventes n'est pas touché.`
      : `${fmt(plan.montant)} entrent dans l'enveloppe de ${b.nom} le ${dFR(fondsForm.date)} (ni vente, ni dépense) et sortent de la caisse « ${fondsForm.origine} ». Le tiroir des ventes n'est pas touché.`;
    const titre = plan.regularisation
      ? `Régulariser le fonds de caisse de ${b.nom} : le fonds reste à ${fmt(plan.fondsApres)}.`
      : `Fonds de caisse de ${b.nom} : ${fmt(fondsCaisseFixe(db, b.nom))} → ${fmt(plan.fondsApres)} (${reprise ? "le DG reprend" : "le DG apporte"} ${fmt(plan.montant)}).`;
    if (!await uConfirm(`${titre}\n\n${explication}`)) return;
    save({
      ...db,
      boutiques: db.boutiques.map((x) => (x.nom === b.nom ? { ...x, fonds_caisse_fixe: plan.fondsApres } : x)),
      depenses: [r.entree, ...(db.depenses || [])],
    }, r.journal + (plan.regularisation ? " (régularisation)" : ` → fonds ${fmt(plan.fondsApres)}`));
    setFondsPour(null);
  };

  // La remise était juste, sa DATE était fausse : on corrige la date seule —
  // montant, origine et fonds ne bougent pas (règle pure corrigerDateRemise).
  const corrigerRemise = async (d) => {
    if (refuserSaufAdminPrincipal(db, profile, "Corriger la date d'une remise de fonds de caisse")) return;
    if (bloquerSiLecture(db, profile)) return;
    const date = await demanderDate(`Quel jour ce mouvement de fonds de caisse (${fmt(Math.abs(d.fonds_caisse.montant))}) a-t-il réellement eu lieu à ${d.boutique} ?\n\nEnregistré au ${dFR(d.date)} — tant que la date est fausse, ce mouvement tombe dans la mauvaise journée.`, d.date);
    if (!date) return;
    const r = corrigerDateRemise(d, date);
    if (r.refus) { uAlert(r.refus); return; }
    save({ ...db, depenses: db.depenses.map((x) => (x.id === d.id ? r.remise : x)) }, r.journal);
  };

  // ---- 📱 LES COMPTES MOBILES D'UNE BOUTIQUE (Timo, 21/09/2026) ----
  // Décision « 1b » : « chaque boutique a son numéro… on peut ajouter les 2
  // numéros dans la fiche de la boutique ». Deux champs de plus sur la fiche
  // (`numero_flooz`, `numero_mixx`), comme la liste des banques et le prix du
  // rail — RIEN À COLLER dans Supabase. Le numéro ne COMMANDE rien : il dit
  // quel compte on regarde, sur les carrés de 🔒 Caisse et sur le relevé.
  const modifierComptesMobiles = async (b) => {
    if (refuserSaufAdmin(profile, "Modifier les comptes mobiles d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    const suite = {};
    for (const m of MOYENS_MOBILES) {
      const v = await uPrompt(`Numéro ${m.court} de ${b.nom} (laisser vide si cette boutique n'en a pas) :`, String(b[m.champ] || ""));
      if (v === null) return;
      suite[m.champ] = String(v).trim();
    }
    const dit = MOYENS_MOBILES.map((m) => `${m.court} : ${suite[m.champ] || "—"}`).join(" · ");
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, ...suite } : x)) }, `Comptes mobiles de ${b.nom} — ${dit}`);
    uAlert(`Comptes mobiles de ${b.nom} : ${dit}`);
  };
  const modifierInfos = async (b) => {
    if (refuserSaufAdmin(profile, "Modifier les informations d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    const adresse = await uPrompt(`Adresse de ${b.nom} (imprimée sur les reçus) :`, b.adresse || "Lomé, Togo");
    if (adresse === null) return;
    const tel = await uPrompt(`Téléphone de ${b.nom} (imprimé sur les reçus) :`, b.tel || "");
    if (tel === null) return;
    const email = await uPrompt(`Email de ${b.nom} (imprimé sur les reçus) :`, b.email || "Bmitogo.info@gmail.com");
    if (email === null) return;
    const message = await uPrompt(`Message en bas du reçu :`, b.message || "Merci pour votre achat ! / Thank you for your purchase!");
    if (message === null) return;
    const choix = await uChoix(`Impression des reçus de ${b.nom} — actuellement : ${b.recu_duplicata ? "2 exemplaires" : "1 exemplaire"}.`, ["1 exemplaire (client)", "2 exemplaires (client + DUPLICATA boutique)"]);
    if (choix === null) return;
    const duplicata = String(choix).startsWith("2");
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, adresse, tel, email, message, recu_duplicata: duplicata } : x)) }, `Reçus de ${b.nom} : ${duplicata ? "2 exemplaires (client + duplicata)" : "1 exemplaire"}`);
    uAlert("Informations du reçu mises à jour !");
  };

  // ⚠ Point 16 de l'audit du 20/08/2026 : deux boutiques dont le nom commence
  // par les mêmes trois lettres — « Agoè Nord » et « Agoè Sud » — partagent le
  // préfixe des numéros de reçu (« AGO »). Aucun doublon n'en résulte, mais un
  // reçu ne dit plus de quelle boutique il vient. Chacune peut désormais
  // porter son propre préfixe.
  const prefixesPartages = (() => {
    const parPrefixe = new Map();
    for (const b of (db.boutiques || []).filter((x) => !x.terrain)) {
      const p = prefixeDe(db, b.nom);
      if (!parPrefixe.has(p)) parPrefixe.set(p, []);
      parPrefixe.get(p).push(b.nom);
    }
    return [...parPrefixe.entries()].filter(([, noms]) => noms.length > 1);
  })();

  const changerPrefixe = async (b) => {
    if (refuserSaufAdmin(profile, "Modifier les informations d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    const actuel = prefixeDe(db, b.nom);
    const v = await uPrompt(
      `Préfixe des numéros de reçu de ${b.nom} — actuellement « ${actuel} ».\n\n` +
      `Lettres et chiffres uniquement, 2 à 5 caractères. Laissez vide pour revenir au préfixe automatique ` +
      `(les 3 premières lettres du nom).\n\n` +
      `⚠ Les reçus DÉJÀ ÉMIS gardent leur numéro : seuls les prochains utiliseront ce préfixe, ` +
      `et leur numérotation repartira de 1.`, actuel);
    if (v === null) return;
    const propre = String(v).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5);
    if (propre && propre.length < 2) { uAlert("Le préfixe doit faire au moins 2 caractères."); return; }
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, prefixe: propre } : x)) },
      `Préfixe des reçus de ${b.nom} : ${propre || "automatique"}`);
    uAlert(propre ? `✅ Les prochains reçus de ${b.nom} commenceront par « ${propre} ».` : "✅ Préfixe automatique rétabli.");
  };

  const enregistrerPosition = (b, lat, lng) => {
    if (refuserSaufAdmin(profile, "Modifier la position d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat, lng } : x)) }, `Position GPS de ${b.nom} mise à jour`);
  };
  const retirerPosition = async (b) => {
    if (refuserSaufAdmin(profile, "Modifier la position d'une boutique")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(`Retirer la position GPS de ${b.nom} ?`)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat: null, lng: null } : x)) }, `Position GPS de ${b.nom} retirée`);
    setPositionPour(null);
  };

  const permissionPush = etatPermissionPush();
  return (
    <div className="space-y-4">
      {/* Notifications (13/09/2026) : rien à activer dans l'application — mais
          si l'appareil a REFUSÉ la question du téléphone, seul son réglage
          peut revenir dessus : on le dit, discrètement, ici. */}
      {permissionPush === "refusee" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-notifications="refusees">
          🔕 Les notifications sont bloquées sur cet appareil. Pour les recevoir, autorisez-les dans les réglages du téléphone ou du navigateur (Notifications → BMI Gestion), puis reconnectez-vous.
        </div>
      )}
      {fondsPour && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-fenetre="fonds-de-caisse">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="font-bold text-slate-900 mb-1">💼 Fonds de caisse de {fondsPour.nom}</div>
            <div className="text-xs text-slate-500 mb-2">L'argent que vous laissez à la boutique pour ses petites dépenses, GARDÉ À PART du tiroir des ventes et jamais versé. On n'y touche que quand la recette ne suffit pas ; les ventes suivantes le remboursent. Indiquez le nouveau montant : le DG apporte la différence, ou la reprend.</div>
            <div className="text-sm mb-3">Fonds actuel : <b className="tabular-nums">{fmt(fondsCaisseFixe(db, fondsPour.nom))}</b> <span className="text-xs text-slate-500">· remises enregistrées {fmt(totalRemisesFonds(db, fondsPour.nom))}</span></div>
            {manqueRemises(db, fondsPour.nom) > 0 && !fondsForm.regularisation && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 mb-3" data-fonds="manque">
                ⚠ {fmt(manqueRemises(db, fondsPour.nom))} de ce fonds n'ont aucune remise enregistrée : le tiroir de {fondsPour.nom} ne les connaît pas (fonds à verser et clôture sont faussés d'autant).
                <button onClick={() => regulariserFonds(fondsPour)} className="ml-2 font-bold underline">Régulariser</button>
              </div>
            )}
            {fondsForm.regularisation && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 mb-3" data-fonds="regularisation">Régularisation : cette remise comble le manque, le fonds reste à {fmt(fondsCaisseFixe(db, fondsPour.nom))}. <b className="text-red-700">Indiquez le jour où le DG a RÉELLEMENT remis cet argent — pas aujourd'hui : daté du jour, il tombe dans la clôture du jour.</b> <button onClick={() => setFondsForm({ ...fondsForm, montant: "", regularisation: false })} className="ml-1 underline">Annuler</button></div>}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Timo (15/09/2026) : « à tout moment je peux augmenter ou diminuer
                  le fonds de caisse et ça devrait passer par les paramètres » — on
                  saisit le NOUVEAU montant du fonds ; l'application en déduit ce que
                  le DG apporte ou reprend. */}
              {fondsForm.regularisation
                ? <Field label="Montant à régulariser (F)"><input type="number" inputMode="numeric" className={inputCls} value={fondsForm.montant} onChange={(e) => setFondsForm({ ...fondsForm, montant: e.target.value })} /></Field>
                : <Field label="Nouveau montant du fonds (F)"><input type="number" inputMode="numeric" className={inputCls} value={fondsForm.nouveau} onChange={(e) => setFondsForm({ ...fondsForm, nouveau: e.target.value })} data-fonds="nouveau" /></Field>}
              <Field label={fondsForm.regularisation || Number(fondsForm.nouveau || 0) >= fondsCaisseFixe(db, fondsPour.nom) ? "D'où vient l'argent" : "Où retourne l'argent"}>
                <select className={inputCls} value={fondsForm.origine} onChange={(e) => setFondsForm({ ...fondsForm, origine: e.target.value })}>
                  {ORIGINES_FONDS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              {fondsForm.origine === DEST_BANQUE && <Field label="Nom de la banque"><input className={inputCls} value={fondsForm.banque} onChange={(e) => setFondsForm({ ...fondsForm, banque: e.target.value })} placeholder="Ex : Ecobank" /></Field>}
              <Field label="Date de la remise"><input type="date" className={inputCls} value={fondsForm.date} max={today()} onChange={(e) => setFondsForm({ ...fondsForm, date: e.target.value })} /></Field>
              <Field label="Précision (facultatif)"><input className={inputCls} value={fondsForm.note} onChange={(e) => setFondsForm({ ...fondsForm, note: e.target.value })} /></Field>
            </div>
            {remisesFondsDe(db, fondsPour.nom).length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-bold text-slate-500 uppercase mb-1">Fonds remis à {fondsPour.nom}</div>
                <div className="max-h-[160px] overflow-y-auto text-sm space-y-1">
                  {remisesFondsDe(db, fondsPour.nom).map((d) => (
                    <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 flex items-center gap-2" data-remise={d.id}>
                      <span className="flex-1">{dFR(d.date)} — <b className={`tabular-nums ${d.fonds_caisse.montant < 0 ? "text-amber-700" : "text-slate-900"}`}>{d.fonds_caisse.montant < 0 ? `− ${fmt(-d.fonds_caisse.montant)}` : fmt(d.fonds_caisse.montant)}</b> — {d.fonds_caisse.montant < 0 ? "repris" : "remis"} · {libelleOrigineFonds(d.fonds_caisse)}{d.fonds_caisse.regularisation ? <span className="text-xs text-amber-700"> · régularisation</span> : null}{d.fonds_caisse.note ? <span className="text-xs text-slate-500"> · {d.fonds_caisse.note}</span> : null} <span className="text-xs text-slate-400">par {d.par}</span></span>
                      {estAdminPrincipal(db, profile) && <button onClick={() => corrigerRemise(d)} title="Corriger la date de cette remise" className="shrink-0 text-xs font-bold text-sky-700 underline">📅 Date</button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setFondsPour(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
              <button onClick={enregistrerFonds} className={btnDark}>💼 {fondsForm.regularisation ? "Régulariser" : Number(fondsForm.nouveau || 0) < fondsCaisseFixe(db, fondsPour.nom) ? "Diminuer le fonds" : "Régler le fonds"}</button>
            </div>
          </div>
        </div>
      )}
      {couleurPour && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
            <div className="font-bold text-slate-900 mb-3">Couleur de {couleurPour.nom}</div>
            <div className="flex flex-wrap gap-3">
              {PALETTE.map(([nomC, hex]) => (
                <button key={hex} title={nomC}
                  onClick={() => { if (bloquerSiLecture(db, profile)) return; save({ ...db, boutiques: db.boutiques.map((x) => (x.id === couleurPour.id ? { ...x, couleur: hex } : x)) }, `Couleur de ${couleurPour.nom} → ${nomC}`); setCouleurPour(null); }}
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
      {/* ⚠ Demande Timo (18/08/2026) : « classer en sous-onglets les
          informations dans Paramètres — un seul écran, ce n'est pas pro ».
          Les douze blocs sont INCHANGÉS : seulement rangés derrière cinq
          onglets. Masqués, jamais démontés — un formulaire à moitié rempli
          survit au changement d'onglet (même principe que Dimensionnement).
          🔐 Sécurité est volontairement en dernier : les gestes lourds ne
          doivent pas être sur le chemin de tous les jours. */}
      <div className="inline-flex flex-wrap rounded-lg border border-slate-300 bg-white p-1 shadow-sm gap-1">
        {[["boutiques", "🏪 Boutiques"], ["catalogue", "🗂 Catalogue & devis"], ["appareils", `🔌 Appareils${aClasser.length ? ` (${aClasser.length} à classer)` : ""}`], ["apparence", "🎨 Apparence"], ["donnees", "💾 Données"],
          ...(jeSuisPrincipal ? [["donnees_perso", "🔒 Données personnelles"], ["corbeille", `🗑 Corbeille${corbeille.length ? ` (${corbeille.length})` : ""}`]] : []),
          ["securite", "🔐 Sécurité"]].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)} className={`px-4 py-1.5 rounded-md text-sm font-bold ${onglet === id ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-4" style={{ display: onglet === "boutiques" ? undefined : "none" }}>

      {/* ⚠ LE SÉLECTEUR « JE REGARDE » (demande Timo, 29/08/2026 : « ramener
          le basculement dans les paramètres »). Il occupait le menu de tous
          les écrans, alors que changer d'espace est un geste rare. Le menu
          ne garde qu'un rappel — et la couleur violette dit déjà l'essentiel.

          Le basculement RECHARGE la page : les écrans déjà visités restent
          montés en veille, et ne se reconstruisaient qu'au fil des re-rendus.
          D'où les vingt secondes d'attente qu'il a signalées. */}
      {peutRegarderLaFormation && (
        <div className={`rounded-xl p-4 border-2 ${enFormation ? "bg-violet-50 border-violet-300" : "bg-sky-50 border-sky-300"}`}>
          <div className="font-bold mb-1">👁 Je regarde</div>
          <div className="text-xs text-slate-600 mb-3">
            Décide de TOUT ce que vous voyez et de tout ce que vous créez : chiffres, boutiques,
            comptes, listes déroulantes. L'application devient <b>violette</b> dans l'entraînement.
            Le réglage vous suit d'un écran à l'autre et survit au rechargement ; il revient au réel
            à votre déconnexion.
          </div>
          <div className="flex gap-2">
            <button onClick={() => changerEspace(false)} disabled={!enFormation}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${!enFormation ? "bg-sky-800 text-white" : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              💼 Le réel{!enFormation ? " ✓" : ""}
            </button>
            <button onClick={() => changerEspace(true)} disabled={enFormation}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${enFormation ? "bg-violet-700 text-white" : "bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50"}`}>
              🎓 L'entraînement{enFormation ? " ✓" : ""}
            </button>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">La page se recharge aussitôt, pour que tous les écrans suivent d'un coup.</div>
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
                    className={`w-8 h-8 rounded-full border-2 ${f.couleur === hex ? "border-slate-900 scale-110 shadow" : "border-white shadow-sm"}`}
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
        {/* ⚠ Une phrase qui ne se coche pas ne peut pas être oubliée. Elle
            suit le sélecteur « je regarde » du menu. */}
        <div className={`mt-2 text-xs font-semibold rounded-lg px-3 py-2 ${espaceDuCompte(db, profile) ? "bg-violet-50 border border-violet-200 text-violet-800" : "bg-sky-50 border border-sky-200 text-sky-800"}`}>
          {espaceDuCompte(db, profile)
            ? "🎓 Cette boutique sera créée dans l'espace D'ENTRAÎNEMENT — c'est celui que vous regardez."
            : "Cette boutique sera créée dans l'espace RÉEL — c'est celui que vous regardez."}
          {jeVoisLesDeuxEspaces && " Pour créer dans l'autre espace, changez « 👁 Je regarde » juste au-dessus."}
        </div>
        <div className="text-xs text-slate-400 mt-2">La localisation et le téléphone pourront toujours être ajoutés ou modifiés plus tard, ci-dessous (« 📍 Infos reçu »).</div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Créer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Boutiques ({boutiquesDeLEcran.length})</div>
        <table className="w-full text-sm min-w-[480px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Boutique", "Logo", "Coordonnées reçu", "Couleur", "Données", ""].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {boutiquesDeLEcran.map((b) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2"><Badge boutique={b.nom} />
                  <div className="text-xs font-bold mt-1">{b.depot ? <span className="text-purple-700">🏭 Magasin (dépôt)</span> : <span className="text-slate-400">Boutique de vente</span>}</div>
                  {b.formation && <div className="text-xs font-bold mt-0.5 text-amber-700">🎓 Formation — hors Tableau de bord</div>}
                  <button onClick={() => basculerDepot(b)} className="text-xs font-bold text-sky-800 underline">{b.depot ? "→ En faire une boutique" : "→ En faire un magasin"}</button>
                </td>
                <td className="px-4 py-2">{b.logo ? <img src={b.logo} alt="" className="h-9 w-auto rounded border border-slate-200 bg-white" /> : <span className="text-xs text-slate-400">Logo BMI (défaut)</span>}</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  <div>{b.adresse || "Lomé, Togo"}</div>
                  <div className="mt-1">
                    Numéros de reçu : <b>{prefixeDe(db, b.nom)}-…</b>
                    <button onClick={() => changerPrefixe(b)} className="ml-2 text-xs font-bold text-sky-800 underline">modifier</button>
                    {prefixesPartages.some(([, noms]) => noms.includes(b.nom)) && (
                      <span className="block text-xs font-bold text-amber-700 mt-0.5">
                        ⚠ Ce préfixe est partagé avec {prefixesPartages.find(([, noms]) => noms.includes(b.nom))[1].filter((n) => n !== b.nom).join(", ")} — un reçu ne dit pas de quelle boutique il vient.
                      </span>
                    )}
                  </div>
                  {b.tel ? <div>Tél : {b.tel}</div> : <div className="text-amber-700">⚠ Sans téléphone : le reçu WhatsApp automatique indiquera le numéro BMI principal.</div>}
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
                  {!b.depot && <button onClick={() => modifierFondsFixe(b)} className={`text-xs font-bold underline mr-2 ${b.fonds_caisse_fixe > 0 ? "text-green-700" : "text-sky-800"}`}>💼 Fonds de caisse{b.fonds_caisse_fixe > 0 ? ` ${fmt(b.fonds_caisse_fixe)}` : ""}</button>}
                  {!b.depot && <button onClick={() => modifierComptesMobiles(b)} className={`text-xs font-bold underline mr-2 ${MOYENS_MOBILES.some((m) => b[m.champ]) ? "text-green-700" : "text-sky-800"}`}>📱 Comptes mobiles{MOYENS_MOBILES.filter((m) => b[m.champ]).length ? ` (${MOYENS_MOBILES.filter((m) => b[m.champ]).length})` : ""}</button>}
                  <button onClick={() => supprimer(b)} className="text-xs text-red-600 underline mr-2">Suppr.</button>
                  {utilisee(b.nom) && <button onClick={() => supprimerAvecDonnees(b)} className="text-xs font-bold text-white bg-red-700 rounded px-2 py-0.5 hover:bg-red-800">Suppr. avec ses données</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      </div>
      <div className="space-y-4" style={{ display: onglet === "catalogue" ? undefined : "none" }}>
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
        <div className="font-bold mb-1">🗂 Domaines de produits et leurs familles</div>
        <div className="text-xs text-slate-500 mb-3">
          Un <b>domaine</b> est un métier : Solaire, Garage, Caméra… Chaque domaine porte ses <b>familles</b> de produits.
          C'est ce que vous choisirez à la création d'un article, au lieu de taper la catégorie à la main — c'est cette
          saisie libre qui laissait passer « BATERIE » et empêchait l'application de retrouver vos articles.
          <br />
          <b>Solaire</b> et <b>Garage</b> savent calculer (puissances, capacités, courants). Un domaine que vous créez
          sera de type <b>libre</b> : pas de calcul automatique, mais vos familles, vos articles et votre devis.
        </div>

        <div className="space-y-3">
          {domaines.map((d) => (
            <div key={d.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="font-bold text-sm">
                  {d.icone} {d.nom}
                  <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded border ${d.calcul === "libre" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-sky-50 text-sky-800 border-sky-200"}`}>
                    {d.calcul === "libre" ? "sans calcul" : "avec calcul automatique"}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{db.produits.filter((p) => p.domaine === d.id).length} article(s)</span>
                </div>
                {d.calcul === "libre" && (
                  <button onClick={() => supprimerDomaine(d)} className="text-xs font-semibold text-red-600 underline">Supprimer</button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(d.familles || []).length === 0 && <span className="text-xs text-slate-400">Aucune famille pour l'instant.</span>}
                {(d.familles || []).map((f) => (
                  <span key={f} className="text-xs bg-slate-100 rounded px-2 py-1 flex items-center gap-1.5">
                    {f}
                    <button onClick={() => retirerFamille(d, f)} className="font-bold text-slate-400 hover:text-red-600" title="Retirer">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 flex-wrap">
                <input className={inputCls + " w-56"} placeholder="Ex : Câbles, Parafoudre…"
                       value={nouvFam[d.id] || ""} onChange={(e) => setNouvFam({ ...nouvFam, [d.id]: e.target.value })}
                       onKeyDown={(e) => { if (e.key === "Enter") ajouterFamille(d); }} />
                <button onClick={() => ajouterFamille(d)} className="text-xs font-bold text-sky-800 underline">➕ Ajouter cette famille</button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200">
          <div className="font-bold text-sm mb-2">➕ Nouveau domaine</div>
          <div className="flex gap-2 items-end flex-wrap">
            <Field label="Icône">
              <input className={inputCls + " w-16 text-center"} maxLength={2} value={nouvDom.icone}
                     onChange={(e) => setNouvDom({ ...nouvDom, icone: e.target.value })} />
            </Field>
            <Field label="Nom du domaine">
              <input className={inputCls + " w-48"} placeholder="Ex : Caméra" value={nouvDom.nom}
                     onChange={(e) => setNouvDom({ ...nouvDom, nom: e.target.value })} />
            </Field>
            <button onClick={ajouterDomaine} className={btnDark}>Créer le domaine</button>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Il apparaîtra dans ☀️ Dimensionnement une fois la prochaine mise à jour installée.
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🔩 Prix du rail de fixation (au mètre)</div>
        <div className="text-xs text-slate-500 mb-3">
          Utilisé par ☀️ Dimensionnement solaire, qui compte <b>2,2 mètres de rail par panneau</b>. Ce prix s'applique aux prochains devis — les devis déjà envoyés gardent le prix auquel ils ont été établis.
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Prix du mètre (F)">
            <input type="number" min="0" step="100" className={inputCls + " w-36"} value={prixRail} onChange={(e) => setPrixRail(e.target.value)} />
          </Field>
          <button onClick={enregistrerPrixRail} className={btnDark}>✅ Enregistrer le prix</button>
        </div>
        <div className="flex gap-2 items-end flex-wrap mt-3" data-reglage="longueur-rail">
          <Field label="Longueur d'une barre (m)">
            <input type="number" min="0" step="0.1" className={inputCls + " w-36"} value={longueurRail} onChange={(e) => setLongueurRail(e.target.value)} />
          </Field>
          <button onClick={enregistrerLongueurRail} className={btnDark}>✅ Enregistrer la longueur</button>
          {Number(prixRail) > 0 && Number(longueurRail) > 0 && (() => { const ex = barresDeRail(22, Number(longueurRail)); return (
            <div className="text-xs text-slate-500 pb-2">
              Exemple : 10 panneaux → 22 m → <b>{ex.barres} barres de {ex.longueurBarre} m</b> = {ex.metresFactures} m facturés → <b>{fmt(ex.barres * Math.round(ex.longueurBarre * Number(prixRail)))}</b>
            </div>
          ); })()}
        </div>
        <div className="text-xs text-slate-500 mt-2">
          Le stock compte des barres : le devis arrondit les mètres calculés aux barres entamées, le client paie ces barres au prix du mètre, et le stock perd ce nombre de barres à l'encaissement.
        </div>
        <div className="flex gap-2 items-end flex-wrap mt-4 pt-3 border-t border-slate-200" data-reglage="pertes-tuyau">
          <Field label="💧 Forage — frottements dans le tuyau (%)">
            <input type="number" min="1" max="50" step="1" className={inputCls + " w-36"} value={pertesTuyau} onChange={(e) => setPertesTuyau(e.target.value)} />
          </Field>
          <button onClick={enregistrerPertesTuyau} className={btnDark}>✅ Enregistrer</button>
          <div className="text-xs text-slate-500 pb-2">
            Exemple : 60 m de tuyau → <b>{Math.round(60 * (Number(pertesTuyau) || PERTES_PCT_DEFAUT)) / 100} m</b> ajoutés à la hauteur à vaincre.
          </div>
        </div>
        <div className="text-xs text-slate-500 mt-2">
          ⚠ C'est une <b>estimation</b> : le chiffre exact dépend du diamètre du tuyau, que l'application ne demande pas. Elle sert au calcul « 💧 Quelle pompe pour ce forage ? » dans le devis.
        </div>
        {Number(prixRail) !== PRIX_RAIL_DEFAUT && (
          <button
            onClick={() => setPrixRail(String(PRIX_RAIL_DEFAUT))}
            className="mt-2 text-xs font-semibold text-slate-500 underline"
          >
            Revenir au prix d'origine ({fmt(PRIX_RAIL_DEFAUT)} le mètre)
          </button>
        )}
      </div>

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm" data-reglage="banques">
        <div className="font-bold mb-1">🏦 Banques</div>
        <div className="text-xs text-slate-500 mb-3">
          La liste proposée au <b>versement des fonds vers BANQUE</b> et sur la <b>fiche de chaque employé</b> (👥 Utilisateurs → ⋯ Gérer → 🏦 Banque). Plus de nom retapé, plus de faute de frappe.
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Field label="Nom de la banque">
            <input className={inputCls + " w-56"} value={nouvelleBanque} onChange={(e) => setNouvelleBanque(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ajouterUneBanque()} placeholder="Ex : Ecobank" />
          </Field>
          <button onClick={ajouterUneBanque} className={btnDark}>➕ Ajouter</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {banques.length === 0 && <div className="text-xs text-slate-400">Aucune banque pour l'instant : le nom se tape librement au versement et sur les fiches, comme avant.</div>}
          {banques.map((b) => (
            <span key={b} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700">
              {b}
              <button onClick={() => retirerUneBanque(b)} className="text-red-600 font-bold" title={`Retirer ${b} de la liste`} aria-label={`Retirer ${b}`}>✖</button>
            </span>
          ))}
        </div>
      </div>

      {/* Timo (16/09/2026) a écrit ce texte lui-même, et tranché : le mot est
          « exclusivement pour les clients », et « il peut être aussi paramétré
          dans les paramètres ». */}
      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm" data-reglage="message-fidelite">
        <div className="font-bold mb-1">💬 Mot de fidélité envoyé au client</div>
        <div className="text-xs text-slate-500 mb-3">
          Pré-rempli dans WhatsApp quand on clique sur le logo vert d'un <b>client</b>, dans 👥 Utilisateurs (jamais sur la fiche d'un employé).
          WhatsApp <b>n'envoie jamais tout seul</b> : le mot arrive dans la case de saisie, chacun le complète ou l'efface avant d'appuyer.
          ⚠ Dans 📋 Clients, le bouton WhatsApp envoie <b>du numéro BMI</b> le mot de fidélité approuvé par Meta (modèles <b>mot_fidelite</b> / <b>mot_fidelite_simple</b>, texte figé chez Meta) : ce réglage-ci ne le change pas.
        </div>
        <div className="text-xs text-slate-500 mb-2">
          Trois mots se remplacent tout seuls : <b>{"{client}"}</b> le nom du client · <b>{"{auteur}"}</b> celui qui écrit · <b>{"{role}"}</b> son rôle,
          <b> avec son article déjà dedans</b> (« le vendeur », « l'administrateur ») — écrivez donc <b>{"{role}"}</b>, jamais « le {"{role}"} ».
        </div>
        <textarea
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[150px]"
          value={msgFid}
          onChange={(e) => setMsgFid(e.target.value)}
          placeholder="Laissez vide pour ouvrir une conversation vide, comme pour un employé."
        />
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-[11px] font-bold uppercase text-slate-500 mb-1">Ce que le client recevra</div>
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{texteFidelite(msgFid, { client: "DJEDJE", auteur: profile.nom, role: profile.role }) || "— rien : la conversation s'ouvrira vide —"}</div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          <button onClick={enregistrerMsgFidelite} className={btnDark}>✅ Enregistrer le mot</button>
          <button onClick={retablirMsgFidelite} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">↺ Rétablir le texte d'origine</button>
        </div>
      </div>

      {/* 🤖 L'assistant du numéro WhatsApp BMI (Timo, 24/09/2026 : « Lance »,
          avec ses lignes de menu, ce qu'il a le droit de dire, et son mot
          d'accueil). Règle pure lib/assistantWhatsapp.js, lue par le serveur. */}
      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm" data-reglage="assistant-whatsapp">
        <div className="font-bold mb-1">🤖 Assistant du numéro WhatsApp BMI</div>
        <div className="text-xs text-slate-500 mb-3">
          Quand un client écrit au numéro BMI et que la conversation n'est à personne, l'assistant répond tout seul.
          <b> En conversation par IA</b>, il discute en phrases et pose ses questions ; tout ce qu'il affirme vient de l'application :
          prix et disponibilité d'un article (jamais la quantité en stock), demande de devis (une fiche dans 🧲 Prospects, le devis reste à faire par un vendeur), passage à un conseiller.
          Il n'invente <b>jamais</b> un prix, un délai ni une caractéristique, ne parle <b>jamais</b> d'une dette ni d'un crédit, ne se fait jamais passer pour une personne ; une réponse qui sortirait de ces règles est jetée avant de partir.
          <b> En menu à chiffres</b>, il propose les huit choix de votre mot d'accueil.
          <b> Il se tait</b> dans les deux cas sur une conversation confiée, dès qu'un employé a répondu (pendant 24 h), et après une demande de conseiller, de SAV ou de devis.
          Coût : environ 4 F par réponse WhatsApp (1 000 offertes par mois à partir du 1er octobre 2026), plus quelques francs par réponse pour le service d'IA, facturés par son fournisseur.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-bold ${assistantOn ? "text-emerald-700" : "text-slate-500"}`} data-assistant-etat={assistantOn ? "actif" : "coupe"}>{assistantOn ? "● En service" : "○ Coupé"}</span>
          {jeSuisPrincipal && <button onClick={basculerAssistant} className={btnDark}>{assistantOn ? "Couper l'assistant" : "Remettre l'assistant"}</button>}
        </div>
        {assistantOn && (
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm" data-assistant-mode={assistantMode}>
            <span className="text-slate-600">Façon de répondre :</span>
            {[["ia", "🗣 Conversation par IA"], ["menu", "🔢 Menu à chiffres"]].map(([mode, libelle]) => (
              <button key={mode} onClick={() => changerModeAssistant(mode)} disabled={!jeSuisPrincipal}
                className={`px-3 py-1.5 rounded-lg border ${assistantMode === mode ? "bg-sky-800 text-white border-sky-800" : "bg-white text-slate-700 border-slate-300"} ${jeSuisPrincipal ? "" : "opacity-60"}`}>
                {libelle}
              </button>
            ))}
          </div>
        )}
        {assistantOn && assistantMode === "ia" && (
          <div className="text-xs text-slate-500 mt-2">
            ⚠ La conversation par IA a besoin de deux réglages côté serveur (la clé d'accès au service et le nom du modèle) : tant qu'ils ne sont pas posés, le menu à chiffres répond à sa place.
            Chaque nouvelle conversation commence par cette phrase, que l'IA ne peut pas oublier : « {PHRASE_PRESENTATION} »
          </div>
        )}
        <details className="mt-2">
          <summary className="text-xs text-slate-500 cursor-pointer">Le message d'accueil du menu à chiffres (votre texte, figé dans l'application)</summary>
          <div className="text-sm text-slate-700 whitespace-pre-wrap mt-1 rounded-lg bg-slate-50 border border-slate-200 p-3">{TEXTE_ACCUEIL}</div>
        </details>
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

      </div>
      <div className="space-y-4" style={{ display: onglet === "appareils" ? undefined : "none" }}>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">🔌 Appareils proposés dans le volet solaire</div>
          <div className="text-xs text-slate-500 mb-3">
            Quand un vendeur tape « tv », « frigo » ou « clim » dans les besoins du client, l'application propose l'appareil et
            pré-remplit sa puissance typique. Chaque appareil a ses autres noms et abréviations : c'est ce qui permet de le
            reconnaître quelle que soit la façon de l'écrire. Un appareil hors liste reste possible en saisie libre.
          </div>
          <button onClick={() => ajouterAppareilCatalogue()} className={btnDark}>➕ Ajouter un appareil</button>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-sm min-w-[640px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Appareil", "Puissance", "Reconnu aussi sous", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {catalogueApp.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{a.nom}</td>
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{a.puissance} W</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{(a.autres || []).join(", ")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => corrigerAppareilCatalogue(a)} className="text-xs text-sky-800 underline mr-3">✏️ Corriger</button>
                      <button onClick={() => retirerAppareilCatalogue(a)} className="text-xs text-red-600 underline">Retirer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">🗂 À classer{aClasser.length ? ` (${aClasser.length})` : ""}</div>
          <div className="text-xs text-slate-500 mb-3">
            Les appareils tapés dans les devis que la liste ne connaît pas encore, avec la puissance la plus souvent saisie.
            Ajoutez-les d'un clic : la prochaine fois, ils seront proposés avec leur puissance.
          </div>
          {aClasser.length === 0 ? (
            <div className="text-sm text-slate-500">Rien à classer : tous les appareils des devis sont dans la liste.</div>
          ) : (
            <div className="space-y-1">
              {aClasser.map((x) => (
                <div key={x.nom} className="flex items-center justify-between gap-2 flex-wrap border-t border-slate-100 py-1.5 text-sm">
                  <span><b>{x.nom}</b> <span className="text-xs text-slate-500">— {x.puissance ? `${x.puissance} W` : "puissance non saisie"} · {x.devis} devis</span></span>
                  <button onClick={() => ajouterAppareilCatalogue({ nom: x.nom, puissance: x.puissance })} className="text-xs font-bold text-white bg-sky-800 rounded px-2 py-0.5">➕ Ajouter à la liste</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* ⚠ 🔒 DONNÉES PERSONNELLES — LE DROIT À L'EFFACEMENT (Timo, 18/09/2026).
          L'article 18 de nos contrats promet au client la suppression de ses
          données « dans les conditions prévues par la loi ». Cet écran tient
          la promesse, et DIT ce qu'il ne peut pas faire : une facture payée
          ne se détruit pas, elle perd son nom. */}
      <div className="space-y-4" style={{ display: onglet === "donnees_perso" ? undefined : "none" }}>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">🔒 Les données d'un client</div>
          <div className="text-xs text-slate-600 mb-3 space-y-1">
            <p>
              Quand un client demande à <b>voir</b> ou à <b>effacer</b> ses données, c'est ici. Vous seul pouvez le faire.
              L'article 18 de vos contrats le lui promet — et cite la <b>loi n° 2019-014</b> sur la protection des données à caractère personnel.
            </p>
            <p className="text-slate-500">
              <b>Ce qui part&nbsp;:</b> son compte, son numéro, son adresse, la position de son chantier, sa signature, ses messages, sa fiche de prospection.
              {" "}<b>Ce qui reste&nbsp;:</b> ses ventes et ses chantiers — montants, articles, numéros de reçu —, parce que la loi commerciale vous oblige à les garder.
              Son nom y est remplacé par une référence qui ne désigne personne.
            </p>
          </div>

          <input className={champRecherche} placeholder="Rechercher un client (nom ou numéro)…" value={qEff} onChange={(e) => setQEff(e.target.value)} />

          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {listeEffFiltree.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">{qEff.trim() ? "Aucun client ne correspond." : "Aucun client dans cet espace."}</div>
            ) : listeEffFiltree.map((c) => (
              <button
                key={c.cle}
                onClick={() => { setCibleEff({ nom: c.nom, tel: c.tel }); setMotifEff(""); }}
                className={`w-full text-left px-3 py-2 text-sm ${cleCibleEff === c.cle ? "bg-sky-50 border-l-4 border-sky-700 font-bold" : "hover:bg-slate-50"}`}
              >
                {c.nom}
                <span className="block text-xs text-slate-500">{c.tel || "sans numéro"}</span>
              </button>
            ))}
          </div>
          {!qEff.trim() && listeEff.length > listeEffFiltree.length && (
            <div className="mt-1 text-xs text-slate-500">{listeEff.length} clients en tout — tapez pour trouver le vôtre.</div>
          )}
        </div>

        {dossierEff && (
          <div className="rounded-xl p-4 bg-white border-2 border-slate-300 shadow-sm">
            <div className="font-bold mb-2">Dossier de « {cibleEff.nom} »{cibleEff.tel ? ` — ${cibleEff.tel}` : ""}</div>

            {/* ⚠ LE DROIT D'ACCÈS VIENT AVANT LE DROIT À L'EFFACEMENT, ici comme
                dans l'article 18 du contrat : on remet, on n'efface qu'ensuite.
                Et il reste ouvert même quand l'effacement est refusé — une dette
                non soldée n'empêche personne de demander ce qu'on a sur lui. */}
            <div className="mb-3 rounded-lg bg-sky-50 border border-sky-200 p-3">
              <div className="text-sm font-bold text-sky-900 mb-1">📄 Lui remettre ses données</div>
              {refusDossier ? (
                <div className="text-xs text-slate-600">{refusDossier}</div>
              ) : (
                <>
                  <div className="text-xs text-slate-600 mb-2">
                    {dossierEff.total} enregistrement(s) : identité, achats, dettes, devis, chantiers, messages.
                    <b> Son mot de passe n'y figure pas</b> — il n'existe en clair nulle part.
                    Ce document ne se remet qu'à lui.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => remettreDossier("PDF")} className="px-4 py-1.5 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900">🖨 Dossier personnel (PDF)</button>
                    <button onClick={() => remettreDossier("CSV")} className="px-4 py-1.5 rounded-lg border border-sky-700 text-sky-800 text-xs font-bold hover:bg-sky-100">Exporter (CSV)</button>
                  </div>
                </>
              )}
            </div>

            {refusEff ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 whitespace-pre-line">🔒 {refusEff}</div>
            ) : (
              <>
                {avertEff.map((a, i) => (
                  <div key={i} className="mb-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{a}</div>
                ))}

                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <div className="text-xs font-bold text-red-800 mb-1">CE QUI PART POUR DE BON</div>
                    {resumeEffacement(dossierEff).part.length === 0 ? (
                      <div className="text-xs text-slate-500">Rien qui n'appartienne qu'à lui.</div>
                    ) : (
                      <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                        {resumeEffacement(dossierEff).part.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-700 mb-1">CE QUI RESTE, SANS SON NOM</div>
                    {resumeEffacement(dossierEff).reste.length === 0 ? (
                      <div className="text-xs text-slate-500">Aucune écriture comptable à son nom.</div>
                    ) : (
                      <ul className="text-xs text-slate-700 list-disc pl-4 space-y-0.5">
                        {resumeEffacement(dossierEff).reste.map((x, i) => <li key={i}>{x}</li>)}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <Field label="Motif — pourquoi ces données sont effacées (obligatoire)">
                    <input className={inputCls} placeholder="Ex. : demande écrite du client du 18/09/2026" value={motifEff} onChange={(e) => setMotifEff(e.target.value)} />
                  </Field>
                  <div className="text-xs text-slate-500 mt-1">
                    Le journal gardera la trace de l'opération — la date, vous, ce motif, et la référence — <b>sans jamais renommer ce client</b>.
                    Gardez sa demande écrite de votre côté&nbsp;: c'est elle qui prouve qu'il l'a demandée.
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={lancerEffacement} className="px-5 py-2 rounded-lg bg-red-700 text-white font-bold text-sm hover:bg-red-800">
                    🔒 Effacer les données de ce client
                  </button>
                  <button onClick={() => { setCibleEff(null); setMotifEff(""); }} className="px-5 py-2 rounded-lg border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50">
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════ 👥 LE DOSSIER D'ACCÈS D'UN EMPLOYÉ (19/09/2026) ═══════
            « Et les employés dans cette histoire ? » — ils sont des sujets de
            données comme les clients, et l'application en sait plus sur eux.
            ⚠ Pas d'effacement ici : la paie et la CNSS se gardent par la loi. */}
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">👥 Les données d'un employé</div>
          <div className="text-xs text-slate-600 mb-3">
            Quand un employé demande à voir ce que vous conservez sur lui. Le document reprend sa rémunération,
            ses avances, son déclaratif CNSS, sa banque et son activité.
            {" "}<b>Son mot de passe n'y figure pas</b>, et <b>son numéro de compte n'y figure que par ses 4 derniers chiffres</b>.
            <br />
            <span className="text-slate-500">
              ⚠ Il n'y a pas de bouton « effacer » ici, et ce n'est pas un oubli : sa rémunération et ses déclarations
              sociales doivent être conservées par obligation légale. Pour un employé, c'est le droit d'accès qui s'applique.
            </span>
          </div>

          <input className={champRecherche} placeholder="Rechercher un employé (nom ou numéro)…" value={qEmp} onChange={(e) => setQEmp(e.target.value)} />

          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {employesFiltres.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">{qEmp.trim() ? "Aucun employé ne correspond." : "Aucun employé dans cet espace."}</div>
            ) : employesFiltres.map((x) => (
              <button
                key={x.id}
                onClick={() => setCibleEmp(x.id)}
                className={`w-full text-left px-3 py-2 text-sm ${cibleEmp === x.id ? "bg-sky-50 border-l-4 border-sky-700 font-bold" : "hover:bg-slate-50"}`}
              >
                {x.nom_complet || x.nom}
                <span className="block text-xs text-slate-500">{x.role} {x.boutique ? `· ${x.boutique}` : ""}</span>
              </button>
            ))}
          </div>

          {vueEmp && (
            <div className="mt-3 rounded-lg bg-sky-50 border border-sky-200 p-3">
              <div className="text-sm font-bold text-sky-900 mb-1">
                Dossier de « {employeChoisi.nom_complet || employeChoisi.nom} »
              </div>
              <div className="text-xs text-slate-600 mb-2">
                {vueEmp.sections.filter((x) => x.lignes.length).length} rubrique(s) renseignée(s) : {vueEmp.sections.filter((x) => x.lignes.length).map((x) => x.titre.replace(/^Vos?\s+|^Votre\s+|^Le\s+/i, "")).join(", ")}.
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => remettreDossierEmploye("PDF")} className="px-4 py-1.5 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900">🖨 Dossier personnel (PDF)</button>
                <button onClick={() => remettreDossierEmploye("CSV")} className="px-4 py-1.5 rounded-lg border border-sky-700 text-sky-800 text-xs font-bold hover:bg-sky-100">Exporter (CSV)</button>
                <button onClick={() => setCibleEmp(null)} className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
              </div>
            </div>
          )}
        </div>

        {/* ⏳ LA DURÉE DE CONSERVATION (Timo, 19/09/2026 : « 6 ans après le
            dernier achat. On peut à tout moment changer cette durée »).
            ⚠ RIEN NE S'EFFACE TOUT SEUL — sa décision, entre trois
            propositions : l'application PROPOSE, l'administrateur CONFIRME.
            Un effacement ne se défait pas ; un balayage automatique serait le
            premier geste de l'application à détruire sans que personne ne
            regarde. La liste ci-dessous n'a donc AUCUN bouton « tout
            effacer » : on ouvre un client, on lit ses avertissements, on
            décide. */}
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">⏳ Combien de temps garder les données d'un client</div>
          <div className="text-xs text-slate-600 mb-3">
            C'est ce que vous annoncez au client : le chiffre s'écrit sur le dossier que vous lui remettez et dans son espace.
            Vous pouvez le changer à tout moment — tout suit d'un coup.
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Durée (années)</div>
              <input
                type="number" min="1" inputMode="numeric"
                className={`${inputCls} sm:w-24`}
                value={dureeSaisie}
                onChange={(e) => setDureeSaisie(e.target.value)}
              />
            </div>
            <button onClick={enregistrerDuree} className="px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">
              Enregistrer
            </button>
            {Number(dureeSaisie) !== dureeEnCours && (
              <div className="text-xs text-amber-700 font-bold">En vigueur aujourd'hui : {dureeEnCours} ans.</div>
            )}
          </div>

          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
            <div className="font-bold text-slate-700 mb-0.5">Ce que le client lit, mot pour mot :</div>
            {phraseConservation(dureeEnCours)}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="font-bold text-sm mb-1">
              Clients dont la durée est dépassée {depassesEff.length > 0 && <span className="text-amber-700">({depassesEff.length})</span>}
            </div>
            {depassesEff.length === 0 ? (
              <div className="text-xs text-slate-500">
                Aucun pour le moment : aucun client n'est resté {dureeEnCours} ans sans rien acheter.
                {" "}Quand il y en aura, ils apparaîtront ici — <b>rien ne s'effacera tout seul</b>, c'est vous qui déciderez, client par client.
              </div>
            ) : (
              <>
                <div className="text-xs text-slate-500 mb-2">
                  Ouvrez-en un : vous verrez ce qu'il a chez vous, les avertissements, et le bouton pour effacer.
                  <b> Rien ne part sans votre geste.</b>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-amber-200 divide-y divide-amber-100">
                  {depassesEff.map((c) => (
                    <button
                      key={c.cle}
                      onClick={() => { setCibleEff({ nom: c.nom, tel: c.tel }); setMotifEff(""); }}
                      className={`w-full text-left px-3 py-2 text-sm ${cleCibleEff === c.cle ? "bg-sky-50 border-l-4 border-sky-700 font-bold" : "bg-amber-50/50 hover:bg-amber-50"}`}
                    >
                      {c.nom}
                      <span className="block text-xs text-slate-500">
                        {c.tel || "sans numéro"} · rien depuis {libelleAnciennete(c.depuis)} ({dFR(c.derniere)})
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4 bg-slate-50 border border-slate-200">
          <div className="font-bold text-sm mb-1">Ce que l'application ne peut pas faire à votre place</div>
          <ul className="text-xs text-slate-600 list-disc pl-4 space-y-1">
            <li>La déclaration de vos traitements auprès de l'<b>IPDCP</b> (l'autorité togolaise) — c'est une démarche, pas un réglage.</li>
            <li>La question de l'<b>hébergement hors du Togo</b> : la base et le site sont à l'étranger.</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4" style={{ display: onglet === "corbeille" ? undefined : "none" }}>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
          <div className="font-bold mb-1">🗑 Corbeille</div>
          <div className="text-xs text-slate-500 mb-3">
            Une fiche supprimée attend ici {DUREE_CORBEILLE_JOURS} jours avant d'être effacée pour de bon. Vous seul la voyez.
            Restaurer la remet exactement comme elle était au moment de sa suppression — ce qui s'est passé entre-temps ailleurs n'y figure pas.
          </div>
          {corbeille.length === 0 ? (
            <div className="text-sm text-slate-500">La corbeille est vide.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {corbeille.map((x) => (
                <div key={`${x.table}:${x.fiche.id}`} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <div className="flex-1 min-w-[12rem]">
                    <span className="font-bold">{x.libelle} — {nomDeLaFiche(x.table, x.fiche)}</span>
                    <div className="text-xs text-slate-500">Supprimé le {dFR(String(x.fiche.supprime_le || "").slice(0, 10))} par {x.fiche.supprime_par || "?"} · {x.restants > 0 ? `effacement dans ${x.restants} jour(s)` : "effacement imminent"}</div>
                  </div>
                  <button onClick={() => restaurerFiche(x)} className="px-3 py-1 rounded-lg bg-green-700 text-white text-xs font-bold hover:bg-green-800">♻ Restaurer</button>
                  <button onClick={() => effacerFiche(x)} className="px-3 py-1 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Supprimer définitivement</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4" style={{ display: onglet === "donnees" ? undefined : "none" }}>
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
            {/* Le rappel discret quand le navigateur a laissé tomber
                l'autorisation : on le DIT ici, on n'ouvre rien tout seul. */}
            {dossierEnPause && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 mb-3" data-sauvegarde="pause">
                ⏸ <b>En pause</b> : le navigateur a oublié l'autorisation du dossier (il ne la garde que tant qu'un onglet du site reste ouvert). Rien n'est écrit pour l'instant, et vos données restent en sécurité dans le cloud.
                Cliquez sur <b>⏱ Sauvegarder maintenant</b> pour la redonner — l'écriture horaire repart aussitôt.
              </div>
            )}
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

      </div>
      <div className="space-y-4" style={{ display: onglet === "securite" ? undefined : "none" }}>
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
                {utilisateursDeLEspace(db, profile).filter((u) => u.role === "admin" && u.actif !== false && u.id !== profile.id).map((u) => (
                  <option key={u.id} value={u.id}>{u.nom}</option>
                ))}
              </select>
            </Field>
            <button onClick={transfererPrincipal} className="px-4 py-2 rounded-lg border-2 border-amber-500 text-amber-700 font-bold text-sm hover:bg-amber-50">⚠ Transférer</button>
          </div>
        )}
      </div>

      </div>
      <div className="space-y-4" style={{ display: onglet === "apparence" ? undefined : "none" }}>
      {/* ---- PERSONNALISATION DE L'ÉCRAN DE CONNEXION (fêtes, etc.) ---- */}
      {estAdminPrincipal(db, profile) && (
        <div className="rounded-xl p-4 bg-white border-2 border-purple-200">
          <div className="font-bold mb-1 text-purple-900">🎉 Personnaliser l'écran de connexion</div>
          <div className="text-xs text-slate-500 mb-3">
            Pour souhaiter une bonne fête (Noël, Nouvel An…) à tous ceux qui se connectent. Visible par tout le monde, sur tous les appareils, dès la prochaine synchronisation.
          </div>
          <div className="space-y-3">
            <Field label="Texte du bandeau (vide = « BIENVENUE SUR NOTRE SYSTÈME »)">
              <div className="flex gap-2">
                <input className={inputCls} maxLength={60} placeholder="Ex. : Joyeux Noël !" value={accueilTexte} onChange={(e) => setAccueilTexte(e.target.value)} />
                <button onClick={() => enregistrerAccueil({ accueil_texte: accueilTexte.trim() })} className="px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-bold hover:bg-purple-800 whitespace-nowrap">Enregistrer</button>
              </div>
            </Field>
            <div className="flex flex-wrap gap-4">
              <Field label="Couleur du bandeau">
                <input type="color" value={accueilBadge} onChange={(e) => { setAccueilBadge(e.target.value); enregistrerAccueil({ accueil_couleur_badge: e.target.value }); }} className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer" />
              </Field>
              <Field label="Couleur de fond de la carte">
                <input type="color" value={accueilFond} onChange={(e) => { setAccueilFond(e.target.value); enregistrerAccueil({ accueil_couleur_fond: e.target.value }); }} className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4">
              <Field label="Transparence des cadres">
                <select
                  className={inputCls}
                  value={boutiqueRef.accueil_opacite_cadres ?? ""}
                  onChange={(e) => enregistrerAccueil({ accueil_opacite_cadres: e.target.value })}
                >
                  <option value="">Par défaut</option>
                  <option value="100">Opaque — cadres blancs pleins</option>
                  <option value="85">Léger voile (85 %)</option>
                  <option value="60">Moyen (60 %)</option>
                  <option value="30">Fort (30 %)</option>
                  <option value="20">Très fort (20 %)</option>
                  <option value="15">Presque invisible (15 %)</option>
                  <option value="0">Totalement transparent</option>
                </select>
              </Field>
              <Field label="Ciel étoilé autour de la carte">
                <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boutiqueRef.accueil_etoiles === true}
                    onChange={(e) => enregistrerAccueil({ accueil_etoiles: e.target.checked })}
                  />
                  <span className="text-sm font-semibold text-slate-700">{boutiqueRef.accueil_etoiles === true ? "Activé" : "Désactivé"}</span>
                </label>
              </Field>
              <Field label="Bulles animées dans les cadres">
                <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={boutiqueRef.accueil_bulles === true}
                    onChange={(e) => enregistrerAccueil({ accueil_bulles: e.target.checked })}
                  />
                  <span className="text-sm font-semibold text-slate-700">{boutiqueRef.accueil_bulles === true ? "Activées" : "Désactivées"}</span>
                </label>
              </Field>
              {boutiqueRef.accueil_bulles === true && (
                <Field label="Couleur des bulles">
                  <input
                    type="color"
                    value={boutiqueRef.accueil_couleur_bulles || boutiqueRef.accueil_couleur_badge || "#0284c7"}
                    onChange={(e) => enregistrerAccueil({ accueil_couleur_bulles: e.target.value })}
                    className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer"
                  />
                </Field>
              )}
            </div>
            {/* ⚠ Demande Timo (09/09/2026) : « avoir le réglage des couleurs de
                la carte de verrouillage à lui seul ». Sa couleur et sa
                transparence, indépendantes de la carte de connexion ; le fond
                (photo) et les bulles, eux, restent ceux de la connexion. */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-bold text-slate-800 mb-2">🔒 Fenêtre de verrouillage</div>
              <div className="flex flex-wrap gap-4">
                <Field label="Couleur de la carte">
                  <input type="color" value={boutiqueRef.verrou_couleur_carte || "#ffffff"} onChange={(e) => enregistrerAccueil({ verrou_couleur_carte: e.target.value })} className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer" />
                </Field>
                <Field label="Transparence de la carte">
                  <select className={inputCls} value={boutiqueRef.verrou_opacite_carte ?? ""} onChange={(e) => enregistrerAccueil({ verrou_opacite_carte: e.target.value })}>
                    <option value="">Opaque (par défaut)</option>
                    <option value="85">Léger voile (85 %)</option>
                    <option value="60">Moyen (60 %)</option>
                    <option value="30">Fort (30 %)</option>
                    <option value="15">Presque invisible (15 %)</option>
                    <option value="0">Totalement transparent</option>
                  </select>
                </Field>
              </div>
              <div className="text-xs text-slate-500 mt-1">La photo de fond et les bulles de la fenêtre de verrouillage sont celles de l'écran de connexion. Une carte sombre passe son texte en clair d'elle-même.</div>
            </div>
            <div className="text-xs text-slate-500 -mt-1">
              ⭐ Les étoiles habillent le grand espace autour de la carte — surtout visible sur PC, où la fenêtre est large. Elles restent DERRIÈRE la carte : elles ne gênent jamais la saisie.
            </div>
            <div className="text-xs text-slate-500 -mt-1">
              💡 Plus le voile est léger, plus l'image se voit — mais plus le texte devient difficile à lire sur une image claire. Regardez l'écran de connexion avant de laisser comme ça. Un léger flou protège la lecture tant qu'il reste un voile ; à « totalement transparent », l'image est parfaitement nette. « Par défaut » remet l'écran d'origine.
            </div>
            <Field label="Messages qui montent à l'écran (un par ligne, 6 maximum)">
              <textarea
                className={`${inputCls} h-24`}
                placeholder={"Joyeuses fêtes de fin d'année !\nBonne et heureuse année à tous"}
                defaultValue={boutiqueRef.accueil_messages || ""}
                onBlur={(e) => {
                  if ((e.target.value || "") !== (boutiqueRef.accueil_messages || "")) {
                    enregistrerAccueil({ accueil_messages: e.target.value });
                  }
                }}
              />
              <div className="text-xs text-slate-500 mt-1">
                Ils montent doucement du bas de l'écran de connexion, un par un. Videz la case pour tout retirer.
              </div>
            </Field>
            <Field label="Souhaiter les anniversaires du jour">
              <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-300 bg-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={boutiqueRef.accueil_anniversaires === true}
                  onChange={(e) => enregistrerAccueil({ accueil_anniversaires: e.target.checked })}
                />
                <span className="text-sm font-semibold text-slate-700">{boutiqueRef.accueil_anniversaires === true ? "Activé" : "Désactivé"}</span>
              </label>
              <div className="text-xs text-slate-500 mt-1">
                🎂 Renseignez le jour et le mois sur chaque fiche employé (onglet Utilisateurs, bouton « Anniversaire »). Les employés dont c'est l'anniversaire sont alors souhaités automatiquement, chaque année. L'année de naissance n'est jamais demandée.
              </div>
            </Field>
            <Field label="Image de fond (remplace la couleur de fond si présente)">
              <input type="file" accept="image/*" onChange={(e) => chargerImageAccueil(e.target.files?.[0])} disabled={imageEnCours} className="text-sm" />
              {imageEnCours && <div className="text-xs text-slate-400 mt-1">Compression de l'image…</div>}
              {boutiqueRef.accueil_image && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={boutiqueRef.accueil_image} alt="Aperçu" className="h-16 rounded-lg border border-slate-300" />
                  <button onClick={() => enregistrerAccueil({ accueil_image: "" })} className="text-xs font-semibold text-red-600 underline">Retirer l'image</button>
                </div>
              )}
            </Field>
            {boutiqueRef.accueil_image && (
              <div className="flex flex-wrap gap-4">
                <Field label="Comment l'image se pose">
                  <select
                    className={inputCls}
                    value={boutiqueRef.accueil_image_ajustement || "remplir"}
                    onChange={(e) => enregistrerAccueil({ accueil_image_ajustement: e.target.value })}
                  >
                    <option value="remplir">Remplir la carte (bords recadrés)</option>
                    <option value="entier">Image entière (rien de coupé)</option>
                    <option value="etirer">Étirer (peut déformer)</option>
                  </select>
                </Field>
                <Field label="Où poser l'image">
                  <select
                    className={inputCls}
                    value={boutiqueRef.accueil_image_etendue === true ? "ecran" : "carte"}
                    onChange={(e) => enregistrerAccueil({ accueil_image_etendue: e.target.value === "ecran" })}
                  >
                    <option value="carte">Dans la carte seulement</option>
                    <option value="ecran">Sur tout l'écran (recommandé sur PC)</option>
                  </select>
                </Field>
                <Field label="Partie de l'image à privilégier">
                  <select
                    className={inputCls}
                    value={boutiqueRef.accueil_image_position || "centre"}
                    onChange={(e) => enregistrerAccueil({ accueil_image_position: e.target.value })}
                  >
                    <option value="haut">Le haut</option>
                    <option value="centre">Le centre</option>
                    <option value="bas">Le bas</option>
                  </select>
                </Field>
              </div>
            )}
            <button onClick={reinitialiserAccueil} className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50">↺ Revenir à l'écran normal</button>
          </div>
        </div>
      )}

      {/* ---- CACHET BMI TOGO (utilisé sur tous les contrats) ---- */}
      {estAdminPrincipal(db, profile) && (
        <div className="rounded-xl p-4 bg-white border-2 border-emerald-200">
          <div className="font-bold mb-1 text-emerald-900">🏷️ Cachet BMI Togo</div>
          <div className="text-xs text-slate-500 mb-3">
            Utilisé automatiquement sur tous les contrats d'installation, quel que soit l'initiateur (commercial, technicien, vous-même…). Un seul cachet pour toute l'entreprise.
          </div>
          <input type="file" accept="image/*" onChange={(e) => chargerCachet(e.target.files?.[0])} disabled={cachetEnCours} className="text-sm" />
          {cachetEnCours && <div className="text-xs text-slate-400 mt-1">Compression de l'image…</div>}
          {db.boutiques[0]?.cachet_bmi && (
            <div className="mt-2 flex items-center gap-2">
              <img src={db.boutiques[0].cachet_bmi} alt="Cachet BMI Togo" className="h-20 rounded-lg border border-slate-300 bg-white p-1" />
              <button onClick={() => { if (bloquerSiLecture(db, profile)) return; save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, cachet_bmi: "" })) }, "Cachet BMI Togo retiré"); }} className="text-xs font-semibold text-red-600 underline">Retirer le cachet</button>
            </div>
          )}
        </div>
      )}

      </div>
      <div className="space-y-4" style={{ display: onglet === "securite" ? undefined : "none" }}>
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

        {/* ---- ÉTAT DES MOTS DE PASSE STOCKÉS (lu localement, aucun appel réseau) ----
             Guide la purge côté Supabase (supabase/purger-mots-de-passe.sql) :
             la purge est SANS RISQUE dès qu'aucun compte n'est « à migrer ». */}
        {(() => {
          const forts = utilisateursActifs.filter((u) => u.pwd_salt && u.pwd_hash2);
          const fantomes = forts.filter((u) => u.pwd !== undefined || u.pwd_hash !== undefined);
          const anciens = utilisateursActifs.filter((u) => !(u.pwd_salt && u.pwd_hash2) && u.pwd_hash);
          const enClair = utilisateursActifs.filter((u) => !(u.pwd_salt && u.pwd_hash2) && !u.pwd_hash && u.pwd !== undefined);
          const aMigrer = [...anciens, ...enClair];
          return (
            <div className="mt-4 pt-3 border-t border-sky-100">
              <div className="text-xs font-bold text-slate-500 uppercase mb-1.5">🔑 Format des mots de passe enregistrés</div>
              <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
                <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-800 border border-green-200">🟢 Hachage fort : {forts.length}</span>
                <span className={`px-2 py-0.5 rounded-full border ${anciens.length ? "bg-amber-50 text-amber-800 border-amber-300" : "bg-slate-50 text-slate-400 border-slate-200"}`}>🟠 Ancien hachage : {anciens.length}</span>
                <span className={`px-2 py-0.5 rounded-full border ${enClair.length ? "bg-red-50 text-red-800 border-red-300" : "bg-slate-50 text-slate-400 border-slate-200"}`}>🔴 En clair : {enClair.length}</span>
                {fantomes.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">👻 Restes à nettoyer : {fantomes.length}</span>}
              </div>
              {aMigrer.length > 0 ? (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">Ces comptes doivent se <b>reconnecter une fois</b> (leur mot de passe sera automatiquement converti au format fort) avant de lancer la purge côté serveur :</div>
                  <div className="flex flex-wrap gap-1.5">
                    {aMigrer.map((u) => <span key={u.id} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">{u.nom}</span>)}
                  </div>
                </div>
              ) : (
                <div className="mt-2 text-xs font-bold text-green-700">✅ Tous les comptes actifs sont au format fort — la purge serveur (purger-mots-de-passe.sql) peut être lancée sans bloquer personne.</div>
              )}
              <div className="mt-1 text-[11px] text-slate-400">Cet état reflète les données de CET appareil (dernière synchronisation) — les comptes bloqués ne sont pas comptés.</div>
            </div>
          );
        })()}
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
          {!estAppWindows() && barriereWindowsActive && (
            <div className="text-amber-700 font-semibold">⚠ Barrière temporairement levée par Timo — le bouton reste actif malgré le ❌ ci-dessus.</div>
          )}
          <div className={estAdminPrincipal(db, profile) ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {estAdminPrincipal(db, profile) ? "✅" : "❌"} Être l'<b>administrateur principal</b>{estAdminPrincipal(db, profile) ? "" : ` — c'est ${adminPrincipal(db)?.nom || "quelqu'un d'autre"}`}
          </div>
          <div className="text-slate-600 mt-1">Puis : sauvegarde téléchargée · code aléatoire recopié · mot de passe confirmé.</div>
        </div>

        <button
          onClick={reinitialiserToutesLesDonnees}
          disabled={!barriereWindowsActive || !estAdminPrincipal(db, profile)}
          className={`px-5 py-2 rounded-lg font-bold text-sm ${(!barriereWindowsActive || !estAdminPrincipal(db, profile))
            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
            : "bg-red-700 text-white hover:bg-red-800"}`}>
          🧨 Réinitialiser toutes les données
        </button>

        {/* ⚠ Réinitialisation FORMATION SEULE : Timo a confirmé explicitement
            vouloir SEULEMENT la barrière admin principal ici, pas les 3
            barrières de la vraie réinitialisation ci-dessus. Style distinct
            (ambre, pas rouge) pour ne jamais confondre les deux boutons. */}
        {boutiquesFormation(db).size > 0 && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <div className="text-xs text-slate-600 mb-2">Efface uniquement les ventes/dettes/chantiers des boutiques de formation — les vraies données ne sont jamais touchées. Fonctionne aussi hors ligne.</div>
            <button
              onClick={reinitialiserFormationSeule}
              disabled={!estAdminPrincipal(db, profile)}
              className={`px-5 py-2 rounded-lg font-bold text-sm ${!estAdminPrincipal(db, profile)
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-amber-600 text-white hover:bg-amber-700"}`}>
              🎓 Réinitialiser uniquement la formation
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
