// ============================================================
// screens/Prospects.jsx — Gestion des prospects (rôle Commercial +
// vue Admin) : catégories, contact WhatsApp, position sur carte,
// détection des dormants, conversion en client.
// ============================================================
import { Fragment, useState } from "react";
import { correspond } from "../lib/suggestions";
import { Clients } from "../screens/Clients";
import { CarteChoixPosition } from "../components/Carte";
import { chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, fabriquerCompteClient, messagesNouveauClient } from "../lib/comptesClients";
import { uid, fmt, today, dFR, col } from "../lib/core";
// 🔑 Les identifiants partent du numéro BMI (22/09/2026), repli WhatsApp à la main.
import { envoyerIdentifiantsDuNumeroBmi, messagesAvecLigneAcces, envoyerModele, messagesAvecLigneEnvoi } from "../whatsapp";
import { messageIdentifiants, texteEnvoi, envoiAccueilProspect, envoiRelanceProspect, projetDansLaPhrase, texteVariable } from "../lib/whatsappModeles";
import { prospectAcquis, estDemandeAssistant, prendreEnCharge, critiquePriseEnCharge } from "../lib/prospects";
import { lireAppareils, resumeLecture } from "../lib/besoinSolaire";
import { critiquePrenom, champsCompteClient } from "../lib/clientEntreprise";
import { catalogueAppareils } from "../lib/appareils";
import { Field, inputCls, btnDark, Panel, uAlert, uConfirm, uPrompt, uChoix, usePagination, Pagination, demanderDate, champRecherche, enTeteFige, celluleFigee } from "../components/ui";
import { derniereActivite, joursSansActivite, estDormant, toucher, aDroit, bloquerSiLecture, refuserSaufAdmin, refuserSaufProprietaire, refuserSaufReaffectation, marqueEspace, espaceDuCompte, memeNumero, comptesAvecCeNumero, utilisateursDeLEspace, domainesDefinis, clientsSansSuiteDeLEspace, devisDuProspect, prospectVisiblePour } from "../lib/calculs";

// ============ PROSPECTS (rôle Commercial + vue Admin) ============
export function Prospects({ db, save, profile, isAdmin, onPreparerDevis, onVoirDevis }) {
  const estChef = !!profile.chef_equipe;
  const voitTout = isAdmin || estChef || profile.role === "resp_commercial";
  const categories = db.categories_prospects.filter((c) => c.actif !== false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const vide = { categorie: categories[0]?.nom || "", projet: "", localisation: "", nom: "", tel: "", nature: "", statut: "Favorable", interet: "Intéressé", relance: "", lat: null, lng: null };
  const [f, setF] = useState(vide);
  const [carteOuverte, setCarteOuverte] = useState(false);
  // 🎯 LE PROJET (décision « a », 01/10/2026) : la relance du numéro BMI le
  // nomme (« votre projet d'installation solaire »). La liste = les métiers
  // réglés dans ⚙ Paramètres, sauf « Autre », qui se TAPE. Le texte libre
  // « Nature du chantier / besoin » ne part JAMAIS au client (notes internes).
  const PROJET_AUTRE = "✏️ Autre…";
  const projetsProposes = domainesDefinis(db).map((d) => d && d.nom).filter((n) => n && !/^autre$/i.test(n));
  const [projetLibre, setProjetLibre] = useState(false);
  const demanderProjet = async (nom) => {
    const choix = await uChoix(`De quel projet s'agit-il pour ${nom} ?\n\nIl sera écrit dans le message (« votre projet … ») et gardé sur sa fiche.`, [...projetsProposes, PROJET_AUTRE]);
    if (!choix) return "";
    if (choix !== PROJET_AUTRE) return choix;
    const t = await uPrompt("Le projet, en quelques mots (ex : vidéosurveillance, éclairage) :", "");
    return texteVariable(t);
  };
  const [filtreRelance, setFiltreRelance] = useState(false);
  const [q, setQ] = useState("");
  // Le besoin d'UN prospect déplié à la fois (règle de dépliage de 💰 Ventes).
  const [besoinDeplie, setBesoinDeplie] = useState(null);

  // ---- Gestion des catégories (Admin uniquement) ----
  const ajouterCategorie = () => {
    if (refuserSaufAdmin(profile, "Gérer les catégories de prospects")) return;
    if (!nouvelleCat.trim()) return;
    if (db.categories_prospects.some((c) => c.nom.toLowerCase() === nouvelleCat.trim().toLowerCase())) { uAlert("Cette catégorie existe déjà."); return; }
    save({ ...db, categories_prospects: [...db.categories_prospects, { id: uid(), nom: nouvelleCat.trim(), actif: true }] }, `Nouvelle catégorie de prospect : ${nouvelleCat.trim()}`);
    setNouvelleCat("");
  };
  const supprimerCategorie = async (c) => {
    if (refuserSaufAdmin(profile, "Gérer les catégories de prospects")) return;
    if (await uConfirm(`Supprimer la catégorie « ${c.nom} » ? Les prospects déjà enregistrés avec cette catégorie la garderont en texte.`)) {
      save({ ...db, categories_prospects: db.categories_prospects.filter((x) => x.id !== c.id) }, `Suppression catégorie de prospect : ${c.nom}`);
    }
  };

  // ---- Enregistrement d'un prospect ----
  const ajouter = async () => {
    if (!f.nom.trim() || !f.tel.trim()) { uAlert("Le nom et le numéro du prospect sont obligatoires."); return; }
    // ⚠ Cloisonnement : un prospect n'appartient à aucune boutique — sans
    // cette marque, une fiche inventée pendant un entraînement entrait dans
    // la vraie file de relance des commerciaux.
    const p = { id: uid(), date: today(), maj_le: today(), commercial: profile.nom, ...f, projet: texteVariable(f.projet), ...marqueEspace(db, profile, f.boutique) };
    save({ ...db, prospects: [p, ...db.prospects] }, `Nouveau prospect « ${f.nom} » (${f.categorie}) — ${profile.nom}`);
    setF(vide);
    setProjetLibre(false);
    setCarteOuverte(false);
    // 📲 01/10/2026 : le message d'accueil part du NUMÉRO BMI (modèle
    // `accueil_prospect`, texte de Timo). Repli — formation, refus, modèle
    // pas encore approuvé : l'ouverture d'aujourd'hui, ANNONCÉE avant
    // (décision « a » du 29/09/2026). ⚠ LE MUR : l'espace de la FICHE.
    const envoi = envoiAccueilProspect({ nom: f.nom });
    const r = await envoyerModele({ tel: f.tel, modele: envoi.modele, variables: envoi.variables, espaceFormation: !!p.formation,
      texteRepli: texteEnvoi(envoi), prevenir: uAlert, demanderConfirmation: uConfirm,
      annonceRepli: `✅ Prospect « ${f.nom} » enregistré.\n\nAppuyez sur OK : WhatsApp s'ouvre avec le message d'accueil, à lui envoyer.` });
    if (r.auto) {
      // La conversation revient au commercial qui l'a enregistré, si elle
      // n'est à personne (comme « ✍️ Écrire ») : la réponse lui arrive.
      save((e) => ({ ...e, messages: messagesAvecLigneEnvoi(e.messages, { profile, tel: f.tel, nom: f.nom, modele: envoi.modele, variables: envoi.variables, ref: { prospect_id: p.id }, donnerAuSender: true, envoi: r }) }));
      await uAlert(`✅ Prospect « ${f.nom} » enregistré.\n\n📲 Le message d'accueil est parti du numéro BMI.`);
    }
  };

  const supprimer = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Supprimer un prospect")) return;
    if (await uConfirm(`Supprimer le prospect « ${p.nom} » ?`)) {
      save({ ...db, prospects: db.prospects.filter((x) => x.id !== p.id) }, `Suppression prospect « ${p.nom} »`);
    }
  };

  // ---- « JE L'AI CONTACTÉ » ----
  // Sans ce bouton, la détection des dormants serait FAUSSE : un commercial qui
  // appelle un prospect ne laisse aucune trace, et le prospect finirait par
  // paraître mort alors qu'il est activement suivi.
  const contacte = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Noter un contact avec un prospect")) return;
    const note = await uPrompt(
      `Vous venez de contacter « ${p.nom} » ?\n\nCe que ça a donné (facultatif) :`,
      ""
    );
    if (note === null) return;
    const historique = [
      { date: today(), par: profile.nom, note: note.trim() || "Contacté" },
      ...(p.contacts || []),
    ].slice(0, 20);
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, maj_le: today(), contacts: historique }
        : x)),
    }, `📞 ${p.nom} contacté par ${profile.nom}${note.trim() ? " — " + note.trim() : ""}`);
  };

  // ---- 🤖 UNE DEMANDE DE L'ASSISTANT WHATSAPP SE PREND EN CHARGE (24/09/2026) ----
  // Le premier qui clique en devient le commercial ; règle pure
  // lib/prospects.js, revérifiée DANS le geste ; serveur securite-32.
  const prendre = async (p) => {
    if (bloquerSiLecture(db, profile)) return;
    const refus = critiquePriseEnCharge(p, profile);
    if (refus) { uAlert(refus); return; }
    if (!await uConfirm(`Prendre en charge la demande de « ${p.nom} » (${p.tel}) ?\n\nVous en devenez le commercial : relance, devis et conversion vous reviennent.`)) return;
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? prendreEnCharge(x, profile) : x)) },
      `Demande de l'assistant « ${p.nom} » prise en charge par ${profile.nom}`);
  };

  // ---- 🔆 PRÉPARER LE DEVIS SOLAIRE DEPUIS LA FICHE (24/09/2026) ----
  // Les appareils sont LUS dans le besoin (règle pure lib/besoinSolaire.js)
  // et le volet solaire s'ouvre pré-rempli — le vendeur vérifie et envoie.
  // ⚠ LE MUR : le compte du client est cherché par `comptesAvecCeNumero`
  // (l'espace regardé), jamais dans db.users en entier.
  const preparerDevis = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Préparer le devis d'un prospect")) return;
    if (!onPreparerDevis) return;
    const appareils = lireAppareils(p.nature || "", catalogueAppareils(db, profile));
    const compte = p.tel ? comptesAvecCeNumero(db, profile, p.tel).find((u) => u.role === "client") : null;
    if (!await uConfirm(`Préparer le devis solaire de « ${p.nom} » ?\n\n${resumeLecture(appareils)}\n\n${compte ? `Client : le compte ${compte.nom}.` : "Le client n'a pas encore de compte : il sera créé à l'envoi du devis."}`)) return;
    onPreparerDevis({
      depuis_prospect: true,
      prospect_id: p.id,
      client: compte ? compte : { nom: p.nom, tel: p.tel },
      devis: { type_devis: "solaire", besoins: { appareils: appareils.map(({ nom, puissance, heures, qte }) => ({ nom, puissance, heures, qte })) } },
    });
  };

  // ---- ARCHIVER (sans supprimer) ----
  // Le motif est obligatoire : sans lui, l'archivage ne vous apprend rien.
  // Au bout d'un an, ces motifs vous diront POURQUOI vos prospects meurent.
  const MOTIFS_ARCHIVE = ["Ne répond plus", "Trop cher", "A choisi un concurrent", "Projet abandonné", "Reporté à plus tard", "Autre"];
  // Convertir un prospect en client — SEULEMENT quand il a dit oui. Crée le
  // compte (règle d'identifiants automatique) et envoie ses accès par WhatsApp.
  const convertirEnClient = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Convertir un prospect en client")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (chiffresTel(p.tel).length < 4) { uAlert("Ce prospect n'a pas de numéro valide : impossible de créer son compte."); return; }

    // Déjà un compte pour ce numéro ? On ne recrée pas.
    // ⚠ Même correctif que dans Clients : « +228 90 11 22 33 » et
    // « 90112233 » sont la MÊME personne (voir lib/identiteClient.js).
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && memeNumero(u.tel, p.tel));
    if (existant) {
      // ⚠ 24/09/2026 : avant, on s'arrêtait là (« Rien n'a été recréé ») et
      // le prospect restait dans la file pour toujours. Un compte qui
      // existe déjà (créé au devis, par exemple) se RATTACHE : même fiche
      // acquise, aucun compte en double.
      if (!await uConfirm(`Un compte client existe déjà pour ce numéro (${existant.nom}).\n\nRattacher « ${p.nom} » à ce compte et le marquer client ? Aucun compte ne sera recréé.`)) return;
      save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? prospectAcquis(x, { client_user_id: existant.id }) : x)) },
        `Prospect « ${p.nom} » rattaché au compte client ${existant.nom} par ${profile.nom}`);
      return;
    }

    // 29/09/2026 (« C a ») : le prénom est OBLIGATOIRE à la création d'un
    // compte client. Il ne change ni l'identifiant ni le mot de passe.
    const prenomSaisi = p.prenom || await uPrompt(`Prénom de « ${p.nom} » ?\n\nIl est demandé pour créer son compte client.`, "");
    if (prenomSaisi === null) return;
    const refusPrenom = critiquePrenom(prenomSaisi);
    if (refusPrenom) { uAlert(refusPrenom); return; }

    const identifiant = identifiantClient(db, p.nom, p.tel);
    const { motDePasse } = await resoudreMotDePasseClient(db, p.nom, p.tel);
    if (!await uConfirm(
      `Convertir « ${p.nom} » en client ?\n\n` +
      `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
      `Un compte sera créé et ses identifiants lui seront envoyés par WhatsApp.\n\nÀ ne faire que s'il a accepté de devenir client.`
    )) return;

    const { user } = await fabriquerCompteClient(db, p.nom, p.tel, profile.nom, { ...marqueEspace(db, profile), ...champsCompteClient(p.nom, prenomSaisi, p.entreprise) });
    // Le prospect est marqué converti (il sort de la file active) et lié au compte.
    save({
      ...db,
      users: [...db.users, user],
      prospects: db.prospects.map((x) => (x.id === p.id
        ? prospectAcquis(x, { client_user_id: user.id })
        : x)),
      messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])],
    }, `Prospect « ${p.nom} » CONVERTI en client par ${profile.nom}`);

    // ⚠ LE MUR : l'espace du COMPTE CRÉÉ, jamais celui de qui clique.
    const r = await envoyerIdentifiantsDuNumeroBmi({ nomAffiche: p.nom, identifiant, motDePasse, tel: p.tel, role: "client", espaceFormation: !!user.formation, demanderConfirmation: uConfirm, prevenir: uAlert });
    if (r && r.auto) save((etat) => ({ ...etat, messages: messagesAvecLigneAcces(etat.messages, { profile, client: user, envoi: r }) }));
    // ⚠ L'écran ne décrit jamais autre chose que ce qui vient de se passer
    // (leçon du 19/09) : la phrase dépend du chemin réellement emprunté.
    uAlert(`✅ ${p.nom} est désormais client.${messageIdentifiants(p.nom, r) ? `\n\n${messageIdentifiants(p.nom, r)}` : ""}`);
  };

  const archiver = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Archiver un prospect")) return;
    const motif = await uPrompt(
      `Archiver « ${p.nom} » ? (${joursSansActivite(p)} jours sans activité)\n\n` +
      `Il sort de la liste active mais N'EST PAS supprimé : vous pourrez le recontacter lors d'une campagne.\n\n` +
      `Motif (obligatoire) :\n${MOTIFS_ARCHIVE.join(" / ")}`,
      MOTIFS_ARCHIVE[0]
    );
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Le motif est obligatoire."); return; }
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, archive: true, archive_motif: motif.trim(), archive_le: today(), maj_le: today() }
        : x)),
    }, `📦 Prospect « ${p.nom} » archivé — ${motif.trim()}`);
  };

  const reactiver = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Réactiver un prospect")) return;
    if (!await uConfirm(`Remettre « ${p.nom} » dans la liste active ?`)) return;
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, archive: false, archive_motif: null, maj_le: today() }
        : x)),
    }, `Prospect « ${p.nom} » réactivé`);
  };

  // Réassigner un prospect à un autre commercial/technicien (admin ou chef d'équipe)
  const reassigner = async (p) => {
    if (refuserSaufReaffectation(db, profile, "Réassigner un prospect")) return;
    const equipe = utilisateursDeLEspace(db, profile).filter((u) => ["commercial", "technicien"].includes(u.role) && u.actif !== false).map((u) => u.nom);
    if (equipe.length === 0) { uAlert("Aucun commercial actif."); return; }
    const choix = await uPrompt(`Réassigner « ${p.nom} » à quel commercial ?\n(${equipe.join(" / ")})`, p.commercial || equipe[0]);
    if (!choix) return;
    const cible = equipe.find((n) => n.trim().toLowerCase() === choix.trim().toLowerCase());
    if (!cible) { uAlert("Commercial introuvable parmi l'équipe active."); return; }
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, commercial: cible }) : x)) }, `Prospect « ${p.nom} » réassigné de ${p.commercial || "?"} à ${cible}`);
  };

  const modifierRelance = async (p) => {
    // Vide = retirer la relance ; une date mal écrite est refusée (même
    // contrôle que partout, components/ui.jsx).
    const d = await demanderDate(`Nouvelle date de relance pour ${p.nom}`, p.relance || "", true);
    if (d === null) return;
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, relance: d.trim() }) : x)) }, `Relance mise à jour pour ${p.nom}`);
  };

  // 📲 RELANCE DU NUMÉRO BMI (01/10/2026, modèle `relance_prospect`) : elle
  // NOMME le projet (décision « a ») — demandé une fois s'il manque, puis
  // gardé sur la fiche. Une question AVANT de partir (la règle des relances :
  // un clic à côté ne se rattrape pas). Repli sans fenêtre de plus (décision
  // « b » du 29/09/2026), avec le texte du modèle mot pour mot. Le contact se
  // note dans l'historique (dernière activité, sortie de l'état « dormant »).
  const relancerWhatsApp = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Relancer un prospect")) return;
    let projet = texteVariable(p.projet);
    const projetDemande = !projet;
    if (!projet) { projet = await demanderProjet(p.nom); if (!projet) return; }
    const envoi = envoiRelanceProspect({ nom: p.nom, auteur: profile.nom, projet: projetDansLaPhrase(projet) });
    if (!envoi) return;
    if (!await uConfirm(`Relancer ${p.nom} (${p.tel}) du numéro WhatsApp BMI, au sujet de son projet ${projetDansLaPhrase(projet)} ?`)) return;
    const r = await envoyerModele({ tel: p.tel, modele: envoi.modele, variables: envoi.variables, espaceFormation: !!p.formation,
      texteRepli: texteEnvoi(envoi), prevenir: uAlert, demanderConfirmation: uConfirm });
    if (!r.auto && !r.parti && !projetDemande) return;
    const note = r.auto ? "Relance WhatsApp envoyée du numéro BMI" : "Relance WhatsApp envoyée";
    save((e) => ({
      ...e,
      prospects: (e.prospects || []).map((x) => (x.id === p.id
        ? (r.auto || r.parti ? toucher({ ...x, projet, contacts: [{ date: today(), par: profile.nom, note }, ...(x.contacts || [])] }) : { ...x, projet })
        : x)),
      messages: r.auto ? messagesAvecLigneEnvoi(e.messages, { profile, tel: p.tel, nom: p.nom, modele: envoi.modele, variables: envoi.variables, ref: { prospect_id: p.id }, donnerAuSender: true, envoi: r }) : e.messages,
    }), r.auto || r.parti ? `Relance WhatsApp envoyée à ${p.nom}` : `Projet de ${p.nom} : ${projet}`);
    if (r.auto) await uAlert(`📲 Relance envoyée du numéro BMI à ${p.nom}.`);
  };

  // 🎯 Changer le projet d'un prospect (son commercial, l'administrateur).
  const changerProjet = async (p) => {
    if (refuserSaufProprietaire(profile, p.commercial, "Changer le projet d'un prospect")) return;
    const projet = await demanderProjet(p.nom);
    if (!projet) return;
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? { ...x, projet } : x)) }, `Projet de ${p.nom} : ${projet}`);
  };

  // ---- Liste : ses propres prospects (Commercial) ou tous (Admin) ----
  // Les prospects DEVENUS CLIENTS sortent de la liste : on ne relance pas
  // quelqu'un qui a déjà payé et été installé. Ils restent consultables.
  const [voirAcquis, setVoirAcquis] = useState(false);
  const [vue, setVue] = useState("actifs"); // actifs | dormants | archives
  // ⚠ Cloisonnement : un prospect créé pendant un entraînement porte
  // `formation` (voir marqueEspace). Sans ce filtre, un commercial en
  // formation — et surtout un chef d'équipe ou un responsable, qui voient
  // TOUT — retrouvait la vraie file de relance de l'entreprise.
  const espace = espaceDuCompte(db, profile);
  const tousProspects = (db.prospects || []).filter((p) => espace === undefined || !!p.formation === espace);
  const acquis = tousProspects.filter((p) => p.converti);
  const archives = tousProspects.filter((p) => p.archive && !p.converti);
  const dormants = tousProspects.filter(estDormant);
  const actifs = tousProspects.filter((p) => !p.converti && !p.archive);

  const base = vue === "archives" ? archives
    : vue === "dormants" ? dormants
    : voirAcquis ? tousProspects.filter((p) => !p.archive)
    : actifs;
  // Taux de conversion : parmi tous les prospects qui ont un jour existé
  // pour cette vue (actifs + archivés + déjà convertis), combien sont
  // devenus clients. Les dormants sont un sous-ensemble des actifs (pas
  // comptés en double).
  const perimetre = voitTout ? { actifs, archives, acquis } : {
    actifs: actifs.filter((p) => p.commercial === profile.nom),
    archives: archives.filter((p) => p.commercial === profile.nom),
    acquis: acquis.filter((p) => p.commercial === profile.nom),
  };
  const totalPerimetre = perimetre.actifs.length + perimetre.archives.length + perimetre.acquis.length;
  const tauxConversion = totalPerimetre > 0 ? Math.round((perimetre.acquis.length / totalPerimetre) * 100) : 0;

  // 🤖 Une demande de l'assistant n'est à personne : tout le monde la voit,
  // jusqu'à ce que quelqu'un la prenne en charge.
  let liste = voitTout ? base : base.filter((p) => p.commercial === profile.nom || estDemandeAssistant(p));
  if (filtreRelance) liste = liste.filter((p) => p.relance && p.relance <= today());
  if (q) liste = liste.filter((p) => correspond(p.nom + " " + p.tel + " " + p.localisation + " " + (p.projet || ""), q));
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);

  // 🧲 LES COMPTES AVEC DEVIS, RIEN ACHETÉ (03/10/2026, Timo : « oui pour la
  // liste dans prospects »). LA règle des comptes sans suite (calculs.js),
  // déjà filtrée par l'espace regardé ; une LECTURE — le compte reste un
  // compte client, ses gestes restent dans 📋 Tous les devis. Le commercial
  // ne voit que les comptes dont il a établi un devis.
  const comptesAvecDevis = clientsSansSuiteDeLEspace(db, profile).filter((c) => prospectVisiblePour(c, profile, voitTout));
  const [voirComptesDevis, setVoirComptesDevis] = useState(true);

  const aRelancerAujourdhui = (voitTout ? actifs : actifs.filter((p) => p.commercial === profile.nom)).filter((p) => p.relance && p.relance <= today()).length;

  return (
    <div className="space-y-4">
      {/* ═══ Tableau de bord commercial ═══ */}
      <Panel>
        <div className="font-bold mb-3">📊 Tableau de bord commercial</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-slate-800">{actifs.length}</div>
            <div className="text-xs text-slate-500 mt-1">Prospects actifs</div>
          </div>
          <div className={`rounded-lg border p-3 text-center ${aRelancerAujourdhui > 0 ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-2xl font-extrabold ${aRelancerAujourdhui > 0 ? "text-orange-700" : "text-slate-800"}`}>{aRelancerAujourdhui}</div>
            <div className="text-xs text-slate-500 mt-1">🔔 À relancer aujourd'hui</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-slate-800">{dormants.length}</div>
            <div className="text-xs text-slate-500 mt-1">💤 Dormants</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-green-700">{tauxConversion}%</div>
            <div className="text-xs text-slate-500 mt-1">✅ Taux de conversion</div>
          </div>
        </div>
        {aRelancerAujourdhui > 0 && (
          <button onClick={() => setFiltreRelance(true)} className="mt-3 text-xs font-bold text-orange-700 underline">Voir les {aRelancerAujourdhui} prospect(s) à relancer →</button>
        )}
      </Panel>
      {isAdmin && (
        <Panel>
          <div className="font-bold mb-3">Catégories de prospects <span className="text-xs font-normal text-slate-500">(gérées par l'administrateur)</span></div>
          <div className="flex flex-wrap gap-2 mb-3">
            {db.categories_prospects.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-2 bg-white rounded-full border border-slate-300 px-3 py-1 text-sm">
                {c.nom}
                <button onClick={() => supprimerCategorie(c)} className="text-red-500 hover:text-red-700 font-bold">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input className={inputCls} placeholder="Nouvelle catégorie…" value={nouvelleCat} onChange={(e) => setNouvelleCat(e.target.value)} />
            <button onClick={ajouterCategorie} className={btnDark}>Ajouter</button>
          </div>
        </Panel>
      )}

      {!isAdmin && (
        <Panel>
          <div className="font-bold mb-3">Nouveau prospect</div>
          {categories.length === 0 ? (
            <div className="text-sm text-slate-600">Aucune catégorie disponible. Demandez à l'administrateur d'en créer : il le fait depuis cet écran 🧲 Prospects (cadre « Catégories de prospects »).</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Catégorie">
                  <select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  </select>
                </Field>
                <Field label="Projet">
                  <select className={inputCls} data-projet-prospect value={projetLibre ? PROJET_AUTRE : f.projet}
                    onChange={(e) => { const v = e.target.value; if (v === PROJET_AUTRE) { setProjetLibre(true); setF({ ...f, projet: "" }); } else { setProjetLibre(false); setF({ ...f, projet: v }); } }}>
                    <option value="">— Choisir —</option>
                    {projetsProposes.map((n) => <option key={n} value={n}>{n}</option>)}
                    <option value={PROJET_AUTRE}>{PROJET_AUTRE}</option>
                  </select>
                  {projetLibre && <input className={inputCls + " mt-1"} value={f.projet} onChange={(e) => setF({ ...f, projet: e.target.value })} placeholder="Ex : vidéosurveillance, éclairage" />}
                </Field>
                <Field label="Nom du prospect"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
                <Field label="Numéro">
                  <input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} />
                  {/* Présélection : ce numéro est-il déjà un client ? */}
                  {(() => {
                    const dejaLa = comptesAvecCeNumero(db, profile, f.tel);
                    if (!dejaLa.length) return null;
                    return (
                      <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50">
                        {dejaLa.map((u) => (
                          <button key={u.id} type="button" onClick={() => setF({ ...f, nom: u.nom_base || u.nom, tel: u.tel })}
                            className="block w-full text-left px-2 py-1 text-xs font-semibold text-amber-900 whitespace-nowrap hover:bg-amber-100 border-b border-amber-200 last:border-b-0">
                            ⚠ Déjà client : {u.nom_base || u.nom} — {u.tel}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Localisation (quartier, repère)">
                    <div className="flex gap-2">
                      <input className={inputCls} value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ex : Quartier Bè, près de la pharmacie..." />
                      <button type="button" onClick={() => setCarteOuverte(!carteOuverte)} className={`px-4 rounded-lg text-sm font-bold whitespace-nowrap ${f.lat ? "bg-green-700 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                        📍 {f.lat ? "Position ✓" : "Choisir sur la carte"}
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="lg:col-span-2">
                  <Field label="Nature du chantier / besoin (facultatif)">
                    <textarea className={inputCls + " min-h-[70px]"} value={f.nature} onChange={(e) => setF({ ...f, nature: e.target.value })}
                      placeholder="Ex : électrifier une maison 4 pièces, 3 ventilateurs + frigo. Pas encore de budget arrêté. Rappeler après le 15." />
                  </Field>
                </div>
                <Field label="Avis">
                  <select className={inputCls} value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value })}>
                    <option>Favorable</option>
                    <option>Défavorable</option>
                  </select>
                </Field>
                <Field label="Intérêt">
                  <select className={inputCls} value={f.interet} onChange={(e) => setF({ ...f, interet: e.target.value })}>
                    <option>Intéressé</option>
                    <option>Désintéressé</option>
                  </select>
                </Field>
                <Field label="Date de relance (facultatif)"><input type="date" className={inputCls} value={f.relance} onChange={(e) => setF({ ...f, relance: e.target.value })} /></Field>
              </div>
              {carteOuverte && (
                <div className="mt-3">
                  <CarteChoixPosition lat={f.lat} lng={f.lng} onChoisir={(lat, lng) => setF((prev) => ({ ...prev, lat, lng }))} />
                </div>
              )}
              <button onClick={ajouter} className={`mt-4 ${btnDark}`}>➕ Enregistrer le prospect</button>
            </>
          )}
        </Panel>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">{isAdmin ? "Tous les prospects" : "Mes prospects"} ({liste.length})</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input className={champRecherche} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            {acquis.length > 0 && (
              <button onClick={() => setVoirAcquis(!voirAcquis)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${voirAcquis ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {voirAcquis ? "✅ Clients acquis affichés" : `Afficher les clients acquis (${acquis.length})`}
              </button>
            )}
            <button onClick={() => setVue(vue === "dormants" ? "actifs" : "dormants")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${vue === "dormants" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              💤 Dormants{dormants.length > 0 ? ` (${dormants.length})` : ""}
            </button>
            {archives.length > 0 && (
              <button onClick={() => setVue(vue === "archives" ? "actifs" : "archives")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${vue === "archives" ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                📦 Archivés ({archives.length})
              </button>
            )}
            <button onClick={() => setFiltreRelance(!filtreRelance)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filtreRelance ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              🔔 À relancer{aRelancerAujourdhui > 0 ? ` (${aRelancerAujourdhui})` : ""}
            </button>
          </div>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Date", "Numéro", "Catégorie / projet", "Localisation", "Avis", "Intérêt", "Relance", ...(isAdmin ? ["Commercial"] : []), ""].map((h, i) => <th key={h} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">Aucun prospect pour l'instant.</td></tr>}
            {listePage.map((p) => {
              const enRetard = p.relance && p.relance <= today();
              const deplie = besoinDeplie === p.id;
              return (
                <Fragment key={p.id}>
                <tr className={`border-t border-slate-100 hover:bg-sky-50 ${enRetard ? "bg-orange-50" : ""}`}>
                  {/* Le NOM reste FIGÉ pendant le défilement horizontal (Timo,
                      25/09/2026 : « figer le nom du client… comme dans stock ») :
                      il passe en PREMIÈRE colonne, par LA règle commune. */}
                  <td className={`px-3 py-2 font-semibold min-w-[170px] ${celluleFigee(enRetard ? "bg-orange-50" : "bg-white")}`}>
                    {p.nom}
                    {estDemandeAssistant(p) && <div className="text-xs font-semibold text-violet-700" data-demande-assistant>🤖 Demande de l'assistant WhatsApp</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(p.date)}</td>
                  <td className="px-3 py-2">{p.tel}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {p.categorie}
                    {p.projet && <div className="text-xs font-semibold text-sky-800" data-projet>🎯 {p.projet}</div>}
                  </td>
                  <td className="px-3 py-2">
                    {p.localisation || (p.lat ? "" : "—")}
                    {p.lat && p.lng && (
                      <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-sky-700 underline text-xs whitespace-nowrap">📍 Voir sur la carte</a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.statut === "Favorable" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.statut}</span>
                    {estDormant(p) && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300" title={`Aucune activité depuis ${joursSansActivite(p)} jours`}>
                        💤 Dormant — {Math.floor(joursSansActivite(p) / 30)} mois
                      </span>
                    )}
                    {p.archive && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300" title={`Archivé le ${dFR(p.archive_le)}`}>
                        📦 {p.archive_motif}
                      </span>
                    )}
                    {p.devis_valide && !p.converti && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300" title={`Devis de ${fmt(p.devis_total)} validé le ${dFR(p.devis_valide_le)} — paiement prévu à ${p.devis_boutique}`}>
                        ⏳ Devis validé — attend le paiement
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.interet === "Intéressé" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>{p.interet}</span>
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${enRetard ? "text-orange-700 font-bold" : ""}`}>{p.relance ? dFR(p.relance) : "—"}</td>
                  {isAdmin && <td className="px-3 py-2">{p.commercial}</td>}
                  {/* Les gestes passent à la ligne au lieu de courir à droite
                      (capture Timo, 25/09/2026 : « ArchiverSuppr. » collés). */}
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-[260px] max-w-[420px]">
                    {!isAdmin && <button onClick={() => modifierRelance(p)} className="text-xs font-bold text-sky-800 underline mr-2">Relance</button>}
                    {enRetard && p.tel && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => relancerWhatsApp(p)} className="text-xs font-bold text-white bg-orange-600 rounded px-2 py-0.5 hover:bg-orange-700 mr-2">📱 Relancer</button>
                    )}
                    {!p.archive && !p.converti && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => changerProjet(p)} className="text-xs font-bold text-sky-800 underline mr-2">🎯 Projet</button>
                    )}
                    {voitTout && aDroit(db, profile, "act_reaffecter") && <button onClick={() => reassigner(p)} className="text-xs font-bold text-sky-800 underline mr-2">Réassigner</button>}
                    {estDemandeAssistant(p) && !p.archive && (
                      <button onClick={() => prendre(p)} className="text-xs font-bold text-white bg-violet-700 rounded px-2 py-0.5 hover:bg-violet-800 mr-2">🙋 Prendre en charge</button>
                    )}
                    {!p.archive && !p.converti && onPreparerDevis && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => preparerDevis(p)} className="text-xs font-bold text-white bg-sky-800 rounded px-2 py-0.5 hover:bg-sky-900 mr-2" title="Ouvre le dimensionnement solaire avec les appareils lus dans le besoin">🔆 Préparer le devis</button>
                    )}
                    {!p.archive && !p.converti && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => contacte(p)} className="text-xs text-sky-700 underline font-semibold" title={`Dernière activité : ${dFR(derniereActivite(p))}`}>📞 Contacté</button>
                    )}
                    {!p.archive && !p.converti && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => convertirEnClient(p)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-0.5 hover:bg-green-800">✅ Convertir en client</button>
                    )}
                    {p.archive
                      ? (isAdmin || p.commercial === profile.nom) && <button onClick={() => reactiver(p)} className="text-xs text-green-700 underline font-semibold">↩ Réactiver</button>
                      : (isAdmin || p.commercial === profile.nom) && !p.converti && <button onClick={() => archiver(p)} className="text-xs text-amber-700 underline font-semibold">📦 Archiver</button>}
                    {(isAdmin || p.commercial === profile.nom) && <button onClick={() => supprimer(p)} className="text-xs text-red-600 underline">Suppr.</button>}
                    </div>
                  </td>
                </tr>
                {/* 🔧 LE BESOIN SUR SA PROPRE LIGNE (capture Timo, 25/09/2026 : « ce
                    n'est pas agréable à regarder… tous les détails dans
                    localisation ? »). Toute la largeur, deux lignes au plus, un
                    clic l'ouvre en entier, un second le replie. L'estimation de
                    l'assistant y est une pastille, une seule fois. */}
                {(p.nature || p.estimation_assistant) && (
                  <tr className={`${enRetard ? "bg-orange-50" : ""} cursor-pointer`} onClick={() => setBesoinDeplie(deplie ? null : p.id)} data-besoin-prospect={deplie ? "deplie" : "replie"}>
                    <td colSpan={10} className="px-3 pb-2 pt-0">
                      <div className="flex flex-wrap items-start gap-2 text-xs">
                        {p.nature && <span className={`flex-1 min-w-[240px] text-slate-600 ${deplie ? "whitespace-pre-wrap" : "line-clamp-2"}`} title={deplie ? "Cliquer pour replier" : "Cliquer pour tout lire"}><b className="text-slate-700 not-italic">🔧 Besoin :</b> {p.nature}</span>}
                        {p.estimation_assistant && <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-semibold whitespace-nowrap" data-estimation-assistant title="Estimation indicative, pose comprise, donnée au client par l'assistant WhatsApp">🤖 Estimation donnée le {dFR(p.estimation_assistant.le)} : {fmt(p.estimation_assistant.bas)} – {fmt(p.estimation_assistant.haut)}</span>}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
      {comptesAvecDevis.length > 0 && (
        <Panel>
          <div data-comptes-avec-devis>
            <button onClick={() => setVoirComptesDevis((x) => !x)} className="font-bold text-slate-800">
              📄 Comptes avec devis, rien acheté ({comptesAvecDevis.length}) {voirComptesDevis ? "▴" : "▾"}
            </button>
            <div className="text-xs text-slate-500 mt-0.5 mb-2">
              Ils ont reçu un devis, n'en ont validé aucun et n'ont rien acheté : ce sont encore des prospects. Ils deviennent
              clients tout seuls au premier devis validé ou au premier achat. Pour relancer ou corriger un devis : 📋 Tous les devis.
            </div>
            {voirComptesDevis && (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {comptesAvecDevis.map((c) => {
                  const devis = devisDuProspect(c.compte);
                  const dernier = devis[0] || {};
                  return (
                    <div key={c.compte.id} className="px-3 py-2 text-sm flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="flex-1 min-w-[200px]">
                        <span className="font-semibold">{c.nom}</span>
                        {c.archive && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">📁 Archivé</span>}
                        <span className="block text-xs text-slate-500">
                          {c.tel || "sans numéro"} · {devis.length} devis · dernier le {dFR(c.reference)}{dernier.total ? ` (${fmt(dernier.total)})` : ""}{dernier.par ? ` · par ${dernier.par}` : ""}
                        </span>
                      </div>
                      {typeof onVoirDevis === "function" && (
                        <button onClick={onVoirDevis} className="text-xs font-bold text-sky-700 underline">📋 Voir ses devis</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
