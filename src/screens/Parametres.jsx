// ============================================================
// screens/Parametres.jsx — Paramètres : boutiques, note de
// dimensionnement, sauvegarde automatique, administrateur
// principal et réinitialisation (réservée au logiciel Windows
// et à l'admin principal — helpers dans lib/calculs.js).
// ============================================================
import { useState } from "react";
import { CarteChoixPosition } from "../components/Carte";
import { chargerTout, marquerSauvegarde, forcerResynchronisation, memoriserDossier, oublierDossier, viderLocal } from "../db";
import { synchroniser, reinitialiserDistant } from "../sync";
import { etatComptesAuth, supabaseConfigure } from "../supabaseClient";
import { PALETTE } from "../lib/constants";
import { uid, verifierMotDePasse, col, compresserPhoto, fmt } from "../lib/core";
import { Field, inputCls, btnDark, Badge, uAlert, uConfirm, uPrompt, uChoix } from "../components/ui";
import { tauxParrainageDefaut, NOTE_DIM_DEFAUT, noteDimensionnement, prixRailMetre, PRIX_RAIL_DEFAUT, estAppWindows, adminPrincipal, estAdminPrincipal, codeConfirmation, bloquerSiLecture, boutiquesFormation, voitLesDeuxEspaces, estCompteFormation, domainesDefinis, idDepuisNom } from "../lib/calculs";
import { telechargerSauvegarde, NOM_FICHIER_AUTO, dossierDispo, ecrireDansDossier } from "../lib/sauvegarde";

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

  // ---- PERSONNALISATION DE L'ÉCRAN DE CONNEXION (fêtes, etc.) ----
  // Réservé à l'admin PRINCIPAL, comme le transfert de rôle ci-dessus.
  // Stocké sur CHAQUE boutique (même mécanisme que taux_parrainage /
  // note_dim juste au-dessus) : pas de nouvelle table, pas de nouvelle
  // règle de sécurité côté Supabase — l'écran de connexion lit déjà
  // db.boutiques avant toute authentification (c'est ainsi qu'il colore
  // déjà le bandeau aujourd'hui), donc cette donnée y est visible de la
  // même façon, sans rien changer côté serveur.
  const boutiqueRef = db.boutiques[0] || {};
  const [accueilTexte, setAccueilTexte] = useState(boutiqueRef.accueil_texte || "");
  const [accueilBadge, setAccueilBadge] = useState(boutiqueRef.accueil_couleur_badge || "#0284c7");
  const [accueilFond, setAccueilFond] = useState(boutiqueRef.accueil_couleur_fond || "#ffffff");
  const [imageEnCours, setImageEnCours] = useState(false);

  const enregistrerAccueil = (champs) => {
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
    if (!await uConfirm("Revenir à l'écran de connexion normal (texte, couleurs et image par défaut) ?")) return;
    setAccueilTexte(""); setAccueilBadge("#0284c7"); setAccueilFond("#ffffff");
    enregistrerAccueil({
      accueil_texte: "", accueil_couleur_badge: "", accueil_couleur_fond: "", accueil_image: "",
      accueil_opacite_cadres: "", accueil_bulles: false,
      accueil_image_ajustement: "", accueil_image_position: "",
    });
  };

  // ---- CACHET BMI TOGO — utilisé sur tous les contrats d'installation,
  // quel que soit l'initiateur (demande Timo). Même mécanisme de stockage
  // que l'image d'accueil ci-dessus (broadcast sur chaque boutique, déjà
  // lisible avant authentification) — pas de nouvelle table.
  const [cachetEnCours, setCachetEnCours] = useState(false);
  const chargerCachet = async (fichier) => {
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

  const [tauxParr, setTauxParr] = useState(String(tauxParrainageDefaut(db)));

  const enregistrerTauxParrainage = () => {
    if (bloquerSiLecture(db, profile)) return;
    const t = Number(tauxParr);
    if (Number.isNaN(t) || t < 0 || t > 100) { uAlert("Entrez un taux entre 0 et 100."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, taux_parrainage: t })) },
      `Taux de parrainage par défaut fixé à ${t} %`);
    uAlert(`✅ Le taux de parrainage par défaut est désormais ${t} %.\n\nIl s'applique aux clients qui n'ont pas de taux personnel.`);
  };

  // ---- PRIX DU RAIL DE FIXATION (au mètre) ----
  // ⚠ Ce prix était écrit en dur dans le code du Dimensionnement : Timo ne
  // pouvait pas le changer lui-même quand son fournisseur augmentait.
  const [prixRail, setPrixRail] = useState(String(prixRailMetre(db)));

  const enregistrerPrixRail = () => {
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
    if (bloquerSiLecture(db, profile)) return;
    // L'écran Paramètres est déjà réservé à l'administrateur : pas de contrôle en plus.
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: note })) },
      "Note du dimensionnement modifiée");
    uAlert("✅ Note enregistrée. Elle s'affiche désormais sous le tableau des équipements proposés.");
  };

  const retablirNote = async () => {
    if (bloquerSiLecture(db, profile)) return;
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

  // ⚠ CONTRADICTION RELEVÉE PAR TIMO (18/08/2026) — l'écran proposait de
  // créer une boutique de FORMATION à un compte que le serveur empêche
  // d'écrire dans cet espace. L'application enregistrait sur l'appareil, le
  // serveur refusait, et l'opération restait bloquée dans la file d'attente
  // à réessayer toutes les 20 secondes, pour toujours.
  // Un écran ne doit jamais proposer un geste que le serveur refusera :
  // un compte cloisonné ne peut créer une boutique que DANS SON ESPACE, et
  // la case est verrouillée sur la bonne valeur, avec l'explication.
  const jeVoisLesDeuxEspaces = voitLesDeuxEspaces(db, profile);
  const monEspaceFormation = estCompteFormation(db, profile);
  const [f, setF] = useState({ nom: "", couleur: PALETTE[0][1], depot: false,
    formation: voitLesDeuxEspaces(db, profile) ? false : estCompteFormation(db, profile),
    adresse: "", tel: "" });
  const [couleurPour, setCouleurPour] = useState(null);
  const [positionPour, setPositionPour] = useState(null); // boutique dont on choisit la position GPS
  const nomCouleur = (hex) => (PALETTE.find(([, h]) => h === hex) || [hex])[0];

  const utilisee = (nom) =>
    db.produits.some((x) => x.boutique === nom) || db.ventes.some((x) => x.boutique === nom) ||
    db.depenses.some((x) => x.boutique === nom) || db.dettes.some((x) => x.boutique === nom);

  const ajouter = () => {
    if (bloquerSiLecture(db, profile)) return;
    const nom = f.nom.trim().toUpperCase();
    if (!nom) { uAlert("Veuillez saisir un nom."); return; }
    if (db.boutiques.some((b) => b.nom === nom)) { uAlert("Cette boutique existe déjà."); return; }
    // Le serveur refuserait la ligne : on l'arrête ici, avec la raison,
    // plutôt que de la laisser bloquer la file d'attente.
    const formation = jeVoisLesDeuxEspaces ? !!f.formation : monEspaceFormation;
    if (!jeVoisLesDeuxEspaces && !!f.formation !== monEspaceFormation) {
      uAlert(`Votre compte travaille dans l'espace ${monEspaceFormation ? "FORMATION" : "RÉEL"} : vous ne pouvez créer qu'une boutique de cet espace.\n\nDemandez à l'administrateur principal s'il vous en faut une autre.`);
      return;
    }
    save({ ...db, boutiques: [...db.boutiques, { id: uid(), nom, couleur: f.couleur, depot: !!f.depot, formation, adresse: f.adresse.trim(), tel: f.tel.trim() }] });
    setF({ nom: "", couleur: "#2563eb", depot: false, formation: jeVoisLesDeuxEspaces ? false : monEspaceFormation, adresse: "", tel: "" });
    uAlert(`${f.depot ? "Magasin" : "Boutique"} ${nom}${f.formation ? " (formation)" : ""} créé(e) !`);
  };

  const basculerDepot = async (b) => {
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
    if (bloquerSiLecture(db, profile)) return;
    if (db.boutiques.length <= 1) { uAlert("Gardez au moins une boutique."); return; }
    if (utilisee(b.nom)) { uAlert(`« ${b.nom} » contient des données. Utilisez « Supprimer avec ses données » si vous voulez vraiment la retirer.`); return; }
    if (await uConfirm(`Supprimer « ${b.nom} » ?`)) save({ ...db, boutiques: db.boutiques.filter((x) => x.id !== b.id) }, `Suppression boutique ${b.nom}`);
  };

  // Suppression forcée : retire la boutique ET tout ce qui lui est rattaché
  // (produits, ventes, dépenses, dettes, ajustements, clôtures, prospects,
  // commandes). Irréversible — double confirmation obligatoire.
  const supprimerAvecDonnees = async (b) => {
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

  const modifierInfos = async (b) => {
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

  const enregistrerPosition = (b, lat, lng) => {
    if (bloquerSiLecture(db, profile)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat, lng } : x)) }, `Position GPS de ${b.nom} mise à jour`);
  };
  const retirerPosition = async (b) => {
    if (bloquerSiLecture(db, profile)) return;
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
        {[["boutiques", "🏪 Boutiques"], ["catalogue", "🗂 Catalogue & devis"], ["apparence", "🎨 Apparence"], ["donnees", "💾 Données"], ["securite", "🔐 Sécurité"]].map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${onglet === id ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
        ))}
      </div>
      <div className="space-y-4" style={{ display: onglet === "boutiques" ? undefined : "none" }}>
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
        <label className={`flex items-center gap-2 text-sm font-semibold mt-2 ${jeVoisLesDeuxEspaces ? "text-slate-700" : "text-slate-400"}`}>
          <input type="checkbox" checked={!!f.formation} disabled={!jeVoisLesDeuxEspaces}
                 onChange={(e) => setF({ ...f, formation: e.target.checked })} />
          🎓 C'est une <b>boutique de formation</b> : pour s'entraîner sans risque — ses chiffres n'apparaissent jamais dans le Tableau de bord.
        </label>
        {!jeVoisLesDeuxEspaces && (
          <div className="text-xs text-amber-700 mt-1">
            Votre compte travaille dans l'espace {monEspaceFormation ? "FORMATION" : "RÉEL"} : toute boutique que vous créez appartient à cet espace. Seul l'administrateur principal peut créer dans l'autre.
          </div>
        )}
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
                  {b.formation && <div className="text-xs font-bold mt-0.5 text-amber-700">🎓 Formation — hors Tableau de bord</div>}
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
          {Number(prixRail) > 0 && (
            <div className="text-xs text-slate-500 pb-2">
              Exemple : 10 panneaux → 22 m → <b>{fmt(22 * Number(prixRail))}</b>
            </div>
          )}
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
                {db.users.filter((u) => u.role === "admin" && u.actif !== false && u.id !== profile.id).map((u) => (
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
                  <option value="0">Totalement transparent</option>
                </select>
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
            </div>
            <div className="text-xs text-slate-500 -mt-1">
              💡 En dessous de 30 %, le texte peut devenir difficile à lire sur une image claire — regardez l'écran de connexion avant de laisser comme ça. « Par défaut » remet l'écran d'origine.
            </div>
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
