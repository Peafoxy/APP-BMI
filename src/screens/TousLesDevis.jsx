// ============================================================
// screens/TousLesDevis.jsx — Liste de tous les devis (admin,
// responsable commercial, élaborateur) : filtres, statuts, relance,
// reprise d'un devis pour modification.
// ============================================================
import { Fragment, useState, useRef } from "react";
import { ZoneSignature } from "../components/ZoneSignature";
import { soldeApresAcompte, resumePlan, engagementDuContrat, echeancier, critiquePlan, finDuMoisCourant, PLAN_EN_ATTENTE, PLAN_ACCEPTE, PLAN_REJETE } from "../lib/reglement";
import { genererDevis } from "../pdf";
import { LOGO, CACHET_BMI_DEFAUT } from "../lib/constants";
import { fmt, dFR, today, heureCourte, envoyerWhatsApp, fichierPdf } from "../lib/core";
import { envoyerModele, messagesAvecLigneEnvoi } from "../whatsapp";
import { envoiRelanceDevis, envoiDevisDisponible, traceEnvoi, libelleTrace, SUITE_REPLI, lignePdfNonParti } from "../lib/whatsappModeles";
import { estLigneCfVisite, devisACompleter, attendLaVisite, ONGLET_A_COMPLETER, peutCompleterDevis, motifRefusCompletion, MENTION_CF_VISITE, PHRASE_A_COMPLETER } from "../lib/devisCfVisite";
import { completerDevis, peutEtablirPourAutrui, auteursDuFiltre, devisDeLAuteur, auteurDuDevis } from "./dimensionnement/devisCommun";
import { envoyerPdfDuDevis } from "./dimensionnement/Partages";
import { CompleterDevis } from "../components/CompleterDevis";
import { texteRelanceDevis, devisRelancable, motDePasseConnu, peutModifierDevis, motifRefusModification, ADRESSE_APP, LIBELLE_ROLE_EMPLOYE, estSansAcces } from "../lib/comptesClients";
import { devisARelancer, joursSansReponse as joursSansReponseDepuis, SEUIL_RELANCE_JOURS, offreExpiree, phraseOffreExpiree } from "../lib/rappels";
import { peutDemanderModif, motifRefusDemandeModif, poserDemandeModif, demandeModifEnCours, demandeModifAcceptee, cyclesModif, MAX_CYCLES_MODIF } from "../lib/modifDevis";
import { inputCls, usePagination, Pagination, uAlert, uConfirm, uPrompt, champRecherche, CochesEnvoi, enTeteFige, celluleFigee, classeLigneDepliable, fondLigneDepliable, BoutonRond, CelluleActions, IconeWhatsApp } from "../components/ui";
import { dernierEnvoiPour } from "../lib/suiviEnvoi";
import { etatRelanceAuto } from "../lib/relanceAutoDevis";
import { normNom, espaceDuCompte, espaceDuDevis, bloquerSiLecture, estAdminPrincipal, boutiquesVente, boutiquesVisibles , refuserSaufAdminPrincipal, refuserSaufAdmin, utilisateursDeLEspace, ONGLETS_ROLE, remiseExigeAdmin, plafondRemise } from "../lib/calculs";
import { htmlContratInstallation, imprimerContratInstallation } from "../lib/impression";
import { validerDevis } from "../lib/validationDevis";
import { numeroContrat, planReglementSigne } from "../lib/contrat";
import { TYPES_PORTAIL, LABEL_FREQUENCE } from "./dimensionnement/Garage";
import { STATUT_DEVIS } from "../lib/libellesStatuts";
import { useFiltrePeriode } from "../components/FiltrePeriode";
import { STATUT_SANS_SUITE, estSansSuite, peutClasserDevis, critiqueClassement, classerSansSuite, critiqueReouverture, rouvrirDevis, avecDevis, devisDans } from "../lib/devisSansSuite";
import { mettreDevisALaCorbeille, critiqueSuppressionDevis, critiqueSuppressionDevisDans, DUREE_CORBEILLE_JOURS } from "../lib/corbeille";
import { useRetour } from "../retour";

// ============ TOUS LES DEVIS (admin, responsable commercial, élaborateur) ============
export function libelleTypeDevis(d) {
  if (d.type_devis === "garage") return "🚪 Garage";
  if (d.type_devis === "autre") return `📦 ${d.besoins?.categorie || "Autre"}`;
  return "☀️ Solaire";
}

// Les colonnes de 📋 Tous les devis (15/10/2026, la règle des lignes).
export const COLONNES_DEVIS = ["Client", "Date", "Total", "Statut", "Suivi", ""];

const BadgeStatutDevis = ({ statut }) => {
  const [label, cls] = STATUT_DEVIS[statut || "propose"] || STATUT_DEVIS.propose;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
};

// ⚠ Timo (09/09/2026) : « Lance, seuil 15 jours. » Les jours se comptent
// depuis la DERNIÈRE relance (relance_le) quand il y en a eu une, sinon
// depuis la date du devis — un devis relancé hier ne ressort pas. La règle
// vit dans lib/rappels.js (la tournée du matin des notifications la lit
// aussi) : ici on la lit, jamais une copie.
const joursSansReponse = (d) => joursSansReponseDepuis(d, today());

// ⚠ Demande Timo : la liste est classée par STATUT (proposé → validé → payé →
// modification demandée → rejeté), et à l'intérieur d'un même statut, du plus
// récent au plus ancien (ordre déjà en place avant ce classement).
const ORDRE_STATUT_DEVIS = { propose: 0, valide: 1, paye: 2, corrige: 3, modification: 4, rejete: 5, [STATUT_SANS_SUITE]: 6 };
const NB_DEVIS_AFFICHES = 7;

// 🖨 LE DEVIS IMPRIMÉ SANS COMPTE (Timo, 15/10/2026, « Ab, Ba, Ça, Da, b ») :
// son client n'a pas d'accès à l'application — rien ne lui part.
const RELANCE_SANS_ACCES = "🖨 Ce devis a été imprimé sans compte : son client n'a pas d'accès à l'application, il ne reçoit aucun message. Relancez-le par téléphone, ou envoyez-lui le devis par WhatsApp (✏️ Modifier → 📲 Envoyer) : son espace s'ouvrira.";
const MODIF_SANS_ACCES = "🖨 Ce devis a été imprimé sans compte : son client ne peut pas accepter une demande de modification dans un espace qu'il n'a pas. Établissez un nouveau devis, imprimé, et faites-le signer sur papier.";

// 💰 La commande d'un devis validé qui attend encore d'être encaissée (« b ») :
// en attente dans 🧾 Commandes, ou validée sans qu'aucune vente ne la porte.
export function commandeAEncaisser(db, d) {
  if (!d || d.statut !== "valide" || d.pose_seule) return null;
  return (db.commandes || []).find((c) => c.origine_devis?.devis_id === d.id
    && (c.statut === "en_attente"
      || (c.statut === "validee" && !(db.ventes || []).some((v) => v.commande_id === c.id || v.origine_devis?.devis_id === d.id)))) || null;
}

// 📄 Le PDF d'un devis — écrit UNE fois : le bouton « 📄 Devis PDF » ET
// « 🖨 Imprimer le devis (sans l'envoyer) » du volet (15/10/2026, chargé à la
// demande par Partages.jsx, qui ne peut pas importer cet écran directement :
// cet écran importe Garage, qui importe Partages). `d.client` = sa fiche.
// 📎 17/10/2026 : les DONNÉES du PDF, écrites UNE fois — « 📄 Devis PDF »
// (téléchargé) et le PDF joint au message WhatsApp (`fichierPdfDuDevis`)
// sortent de la même fabrique : le client reçoit le document qu'on imprime.
function donneesPdfDuDevis(db, d) {
  // ⚠ Bandeau formation (demande Timo) : le devis n'a pas de champ
  // boutique direct avant vente — même repli que le contrat d'installation
  // (impression.js) : la boutique de la personne qui l'a créé (d.par).
  const initiateur = (db.users || []).find((u) => u.nom === d.par);
  const estFormation = !!(db.boutiques || []).find((b) => b.nom === initiateur?.boutique)?.formation;
  return {
    numero: d.id.slice(0, 8).toUpperCase(),
    date: dFR(d.date),
    boutique: d.boutique,
    client: d.client?.nom_base || d.client?.nom || "—",
    // 29/09/2026 : le prénom et l'entreprise cliente du devis (lib/clientEntreprise.js).
    prenom: d.prenom || d.client?.prenom || "",
    entreprise: d.entreprise || null,
    tel: d.client?.tel || "",
    titre: libelleTypeDevis(d).replace(/^\S+\s/, ""),
    statut: (STATUT_DEVIS[d.statut || "propose"] || STATUT_DEVIS.propose)[0].replace(/^\S+\s/, ""),
    par: d.par, par_id: d.par_id || null,
    lignes: d.lignes || [],
    // La charge dimensionnée (appareils, mesures de porte, demande) part
    // avec le devis : le PDF la rend au-dessus de la table des prix. Les
    // identifiants techniques du garage (« portail_coulissant »,
    // « moyenne ») sont réécrits ICI en libellés lisibles — le module PDF
    // n'a accès ni aux écrans ni à db.
    besoins: d.besoins ? {
      ...d.besoins,
      ...(d.besoins.type_ouvrant ? {
        type_ouvrant: TYPES_PORTAIL.find((t) => t.id === d.besoins.type_ouvrant)?.label || d.besoins.type_ouvrant,
        frequence: LABEL_FREQUENCE[d.besoins.frequence] || d.besoins.frequence,
      } : {}),
    } : null,
    total: d.total,
    // Le bloc financier du devis solaire (Timo, 11/09/2026) : acompte, solde, délai.
    pct_acompte: d.pct_acompte, montant_acompte: d.montant_acompte, delai_installation: d.delai_installation,
    // 📝 La ligne NB tapée sur le devis (08/10/2026).
    nb: d.nb || "",
    // Le devis engage BMI (Timo, 11/09/2026) : sa signature au bas du
    // document, c'est la signature personnelle de celui qui l'a élaboré —
    // si sa fiche en porte une — et LE cachet de l'entreprise, le même
    // que sur les contrats d'installation (⚙ Paramètres, un seul cachet).
    signature: initiateur?.signature_personnelle || "",
    cachet: (db.boutiques || []).find((b) => b.cachet_bmi)?.cachet_bmi || CACHET_BMI_DEFAUT,
    formation: estFormation,
    // 26/09/2026 (« b, lance ») : l'en-tête dit l'adresse, le téléphone et
    // l'e-mail de la boutique du devis, comme le reçu — sinon celle de son
    // auteur. Sans fiche trouvée, l'en-tête d'avant.
    bq: (db.boutiques || []).find((b) => b.nom === d.boutique) || (db.boutiques || []).find((b) => b.nom === initiateur?.boutique) || null,
  };
}

export function genererPdfDuDevis(db, d) {
  genererDevis(donneesPdfDuDevis(db, d), LOGO);
}

// 📎 Le PDF du devis en FICHIER, pour le joindre au message WhatsApp du numéro
// BMI (case « 📎 Joindre le PDF du devis », 17/10/2026) : { nom, mime,
// taille, donnees } — les données en base64, comme un fichier du 📎 de
// 📲 WhatsApp. Le nom suit la règle des documents (« Devis - Client - N° »).
export function fichierPdfDuDevis(db, d) {
  const donnees = donneesPdfDuDevis(db, d);
  const doc = genererDevis(donnees, LOGO, true);
  const base64 = String(doc.output("datauristring") || "").split(",")[1] || "";
  return { nom: fichierPdf("Devis", { client: donnees.client, numero: donnees.numero }), mime: "application/pdf", taille: Math.floor(base64.length * 3 / 4), donnees: base64 };
}

export function TousLesDevis({ db, save, profile, onModifierDevis, onEncaisserCommande = null, ouvertInitial = null }) {
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial";

  // ⚠ Cloisonnement : un devis porte l'espace de son auteur (`formation`,
  // posé à l'envoi — voir envoyerDevisEtOuvrirWhatsApp). Sans ce filtre,
  // les devis d'entraînement s'affichaient dans la liste de l'admin et du
  // responsable commercial, et comptaient dans la pastille rouge. `espace`
  // vaut undefined pour l'admin principal, qui doit continuer à tout voir.
  const espace = espaceDuCompte(db, profile);
  const devisDeLEspace = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter((d) => espace === undefined || !!d.formation === espace)
    // ⚠ Décision Timo (04/09/2026) : le vendeur de la boutique où le client
    // vient PAYER voit aussi les devis à encaisser chez lui, même s'il ne
    // les a pas faits — c'est lui qui le fera signer et encaissera. La
    // boutique de paiement est celle choisie par le client à la validation,
    // sinon celle du devis (indiquée par le commercial).
    .filter((d) => voitTout || d.par_id === profile.id
      || (!!profile.boutique && (d.boutique_paiement || d.boutique) === profile.boutique))
    .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));

  // 👥 « TOUS MES DEVIS » / « TOUS LES DEVIS DE … » (Timo, 12/10/2026, « A a,
  // B b ») : l'affichage d'aujourd'hui reste d'office (« A a ») ; une liste
  // « Utilisateur » devant le titre montre les devis d'UNE personne —
  // l'administrateur choisit n'importe qui de l'espace, le responsable
  // commercial ses commerciaux. Rien de mémorisé : d'office à chaque ouverture.
  // Les personnes viennent de l'espace REGARDÉ (utilisateursDeLEspace).
  const [filtreAuteur, setFiltreAuteur] = useState("");
  const auteursListe = auteursDuFiltre(devisDeLEspace, utilisateursDeLEspace(db, profile), profile, ONGLETS_ROLE);
  const auteurFiltre = auteursListe.find((u) => u.id === filtreAuteur) || null;
  const tousDevis = auteurFiltre ? devisDeLEspace.filter((d) => devisDeLAuteur(d, auteurFiltre)) : devisDeLEspace;

  // ⚠ DEMANDE TIMO (25/08/2026) : « côté administration et commercial, il voit
  // le montant mentionné par le client... si ça ne correspond pas aux
  // engagements du client il rejette, si ça correspond il accepte ».
  // Et à ma question « qui décide ? », sa réponse : L'ADMINISTRATEUR SEUL.
  // Le commercial VOIT la proposition — c'est utile pour son suivi — mais il
  // ne peut pas engager l'entreprise sur un échéancier.
  //
  // ⚠ PRÉCISÉ LE 29/08/2026, à la relecture de l'audit : « l'administrateur
  // seul » avait été compris comme TOUT compte administrateur. Question posée
  // à Timo, réponse : « MOI SEUL ». Accepter un plan, c'est engager BMI sur un
  // échéancier — au même titre que changer un mot de passe ou basculer un
  // compte d'espace, gestes déjà réservés à l'administrateur PRINCIPAL.
  const peutDeciderDuPlan = estAdminPrincipal(db, profile);

  const deciderPlan = async (d, accepte) => {
    if (bloquerSiLecture(db, profile)) return;
    // Le bouton est déjà caché aux autres ; on garde aussi le geste, pour que
    // la règle tienne même si un jour l'affichage change.
    if (refuserSaufAdminPrincipal(db, profile, "Accepter ou rejeter un plan de règlement")) return;
    const solde = soldeApresAcompte(d);
    let motif = "";
    if (!accepte) {
      motif = await uPrompt(`Pourquoi refusez-vous ce plan ?\n\nLe client le lira dans son espace et pourra en proposer un autre.`, "Échéancier trop long");
      if (motif === null) return;
    } else if (!await uConfirm(`Accepter ce plan de règlement ?\n\n${resumePlan(d.plan_reglement, solde)}\n\nLe client sera engagé sur cet échéancier.`)) return;
    const decide = {
      ...d.plan_reglement,
      statut: accepte ? PLAN_ACCEPTE : PLAN_REJETE,
      decide_par: profile.nom, decide_le: today(),
      motif_rejet: accepte ? "" : (motif || "").trim(),
    };
    save({
      ...db,
      users: db.users.map((u) => (u.id === d.client.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, plan_reglement: decide } : x)) }
        : u)),
    }, `Plan de règlement ${accepte ? "ACCEPTÉ" : "REFUSÉ"} — devis de ${d.client.nom} (${resumePlan(decide, solde)})${accepte ? "" : ` — motif : ${decide.motif_rejet}`}`);
  };

  // 🗑 Supprimer un devis ⏳ Proposé (26/09/2026, Timo : « a, lance ») :
  // l'administrateur PRINCIPAL seul, motif obligatoire, et le devis part à la
  // CORBEILLE 30 jours (⚙ Paramètres → 🗑 Corbeille), jamais détruit d'un coup.
  // Les messages WhatsApp déjà partis restent ; la fiche d'un prospect garde
  // son lien. Revérifié DANS le geste, sur la fiche fraîche.
  const supprimerDevis = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Supprimer un devis")) return;
    const refus = critiqueSuppressionDevisDans(db, d.client.id, d.id);
    if (refus) { await uAlert(refus); return; }
    const nomClient = d.client?.nom_base || d.client?.nom || "ce client";
    const motif = await uPrompt(`Pourquoi supprimer ce devis de ${fmt(d.total)} pour ${nomClient} ?\n\nLe motif est obligatoire : il reste dans le journal.`, "Devis établi par erreur");
    if (motif === null) return;
    if (!String(motif).trim()) { await uAlert("Le motif est obligatoire : un devis ne se supprime pas sans dire pourquoi."); return; }
    if (!await uConfirm(`Supprimer le devis de ${fmt(d.total)} du ${dFR(d.date)} pour ${nomClient} ?\n\nIl part dans la corbeille ${DUREE_CORBEILLE_JOURS} jours : vous pourrez le restaurer dans ⚙ Paramètres → 🗑 Corbeille, puis il s'effacera tout seul.\nLes messages WhatsApp déjà envoyés au client restent.`)) return;
    save(mettreDevisALaCorbeille(db, d.client.id, d.id, profile, motif),
      `🗑 Devis supprimé (corbeille) — ${nomClient}, ${fmt(d.total)} du ${dFR(d.date)} — motif : ${String(motif).trim()} — par ${profile.nom}`);
  };

  // 📁 Classer sans suite / rouvrir (26/09/2026, Timo : « a, auteur admin et
  // resp com, lance ») : le devis reste ENTIER, il sort de la liste active.
  // Règle pure lib/devisSansSuite.js, revérifiée DANS le geste sur la fiche
  // fraîche.
  const classerDevis = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const refus = critiqueClassement(devisDans(db, d.client.id, d.id), profile);
    if (refus) { await uAlert(refus); return; }
    const nomClient = d.client?.nom_base || d.client?.nom || "ce client";
    const motif = await uPrompt(`Pourquoi classer sans suite ce devis de ${fmt(d.total)} pour ${nomClient} ?\n\nLe motif est obligatoire : il reste sur le devis et dans le journal.`, "Le client ne donne plus de nouvelles");
    if (motif === null) return;
    const refus2 = critiqueClassement(devisDans(db, d.client.id, d.id), profile, motif);
    if (refus2) { await uAlert(refus2); return; }
    if (!await uConfirm(`Classer sans suite le devis de ${fmt(d.total)} du ${dFR(d.date)} pour ${nomClient} ?\n\nIl reste entier (articles, prix, relances), mais sort de la liste active : vous le retrouverez sous « 📁 Sans suite ».\nLe client ne pourra plus le valider et il ne sera plus relancé.\nVous pourrez le rouvrir à tout moment.`)) return;
    save(avecDevis(db, d.client.id, d.id, (x) => classerSansSuite(x, profile, motif, today())),
      `📁 Devis classé sans suite — ${nomClient}, ${fmt(d.total)} du ${dFR(d.date)} — motif : ${String(motif).trim()} — par ${profile.nom}`);
  };
  const rouvrirDevisClasse = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const refus = critiqueReouverture(devisDans(db, d.client.id, d.id), profile);
    if (refus) { await uAlert(refus); return; }
    const nomClient = d.client?.nom_base || d.client?.nom || "ce client";
    if (!await uConfirm(`Rouvrir le devis de ${fmt(d.total)} du ${dFR(d.date)} pour ${nomClient} ?\n\nIl redevient ⏳ Proposé, tel qu'il était : le client pourra de nouveau le valider.\nSon offre date toujours du ${dFR(d.date)} : pour de nouveaux prix, utilisez ensuite « ✏️ Modifier et renvoyer ».`)) return;
    save(avecDevis(db, d.client.id, d.id, (x) => rouvrirDevis(x, profile, today())),
      `↩ Devis rouvert (était classé sans suite) — ${nomClient}, ${fmt(d.total)} du ${dFR(d.date)} — par ${profile.nom}`);
    setFiltreStatut("propose");
  };

  const [ouvert, setOuvert] = useState(ouvertInitial); // ouvertInitial : pour le banc seul
  // ✍️ Le devis en cours de complétion après la visite (08/10/2026).
  const [completion, setCompletion] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [relanceSeule, setRelanceSeule] = useState(false);
  // 📅 Le filtre de période (Timo, 05/10/2026 : « Toute période » à chaque
  // ouverture) — sur la DATE du devis. Les compteurs des pastilles le suivent ;
  // la bande des devis sans réponse, non (c'est une alerte).
  const periode = useFiltrePeriode();

  // Ouvrir un devis le marque comme « vu » — la pastille rouge ne le comptera plus.
  const ouvrirDevis = (d) => {
    setOuvert(ouvert === d.id ? null : d.id);
    if (!(d.vu_par || []).includes(profile.id)) {
      save({
        ...db,
        users: db.users.map((u) => (u.id === d.client?.id
          ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, vu_par: [...(x.vu_par || []), profile.id] } : x)) }
          : u)),
      });
    }
  };

  // ⚠ Timo (09/09/2026) : proposé ET validé (accepté mais pas payé) se
  // relancent ; « payé ne doit plus être relancé » — ni rejeté, ni
  // modification demandée (là, c'est au vendeur de répondre). La règle du
  // message est dans lib/comptesClients.js (texteRelanceDevis).
  // 🖨 Un devis imprimé sans compte n'est pas « à relancer » : son client ne
  // reçoit rien de l'application (15/10/2026).
  const enAttenteDeRelance = (d) => !estSansAcces(d.client) && devisARelancer(d, today());
  const nbARelancer = tousDevis.filter(enAttenteDeRelance).length;

  // 📲 Relancer : UN clic, le message est déjà écrit selon le statut ; la
  // date de relance est notée sur le devis (le compteur repart de là).
  const relancerDevis = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    // 🖨 Un devis imprimé sans compte ne se relance pas : le message renvoie à
    // un espace où le client ne peut pas entrer (15/10/2026).
    if (estSansAcces(d.client)) { uAlert(RELANCE_SANS_ACCES); return; }
    const texte = texteRelanceDevis({ devis: d, compte: d.client, motDePasse: motDePasseConnu(d.client), vendeur: profile.nom, formaterMontant: fmt });
    if (!texte) { uAlert("Ce devis n'est plus à relancer."); return; }
    if (!d.client?.tel) { uAlert("Ce client n'a pas de numéro de téléphone enregistré."); return; }

    // 📲 Depuis le 19/09/2026 le message part du NUMÉRO BMI, tout seul, par
    // un modèle approuvé par Meta (relance d'un devis proposé, ou rappel de
    // règlement sur un devis validé). ⚠ Tout refus et toute panne ramènent
    // l'ouverture WhatsApp d'aujourd'hui, avec son texte complet : un
    // message ne se perd jamais en silence (src/whatsapp.js).
    // ⚠ C'est l'espace du DEVIS qui décide, jamais celui de la personne qui
    // clique — l'administrateur principal est un compte réel même quand il
    // regarde la formation.
    const envoi = envoiRelanceDevis({ devis: d, compte: d.client, fmt, dFR });
    // ⚠ ON CONFIRME AVANT (Timo, 25/09/2026, sur les dettes — même risque
    // ici) : le message part tout seul du numéro BMI.
    if (!await uConfirm(`Relancer ${d.client?.nom_base || d.client?.nom || "ce client"} (${d.client.tel}) pour son devis de ${fmt(d.total)} ?\n\nLe message part du numéro WhatsApp BMI.`)) return;
    const r = await envoyerModele({
      tel: d.client.tel,
      modele: envoi?.modele,
      variables: envoi?.variables,
      espaceFormation: espaceDuDevis(db, d, profile),
      texteRepli: texte,
      demanderConfirmation: uConfirm,
      prevenir: uAlert,
    });
    // ⚠ UN REPLI MUET RESSEMBLE À UNE PANNE. Si l'envoi du numéro BMI n'a pas
    // eu lieu pour une raison qu'on n'attendait pas (serveur pas encore
    // configuré, modèle pas encore approuvé, réseau), on le DIT. Les motifs
    // attendus — formation, premier message d'un client — ne dérangent
    // personne : c'est la règle qui joue, et elle est connue.
    // Le motif d'un repli est dit AVANT l'ouverture de WhatsApp (`prevenir`, 29/09/2026), jamais après.
    if (!r.parti) return;
    // 👥 Relancé par l'administrateur ou le responsable commercial POUR son
    // auteur (12/10/2026) : la réponse du client revient à l'auteur.
    const auteurD = peutEtablirPourAutrui(profile) ? auteurDuDevis(d) : {};
    const trace = r.auto ? traceEnvoi({ modele: envoi.modele, par: profile.nom, par_id: profile.id, quand: today(), heure: heureCourte(), id: r.id, pour: auteurD.par, pour_id: auteurD.par_id }) : null;
    // 📲 23/09/2026 : la relance partie du numéro BMI s'écrit AUSSI dans la
    // conversation du client (📲 WhatsApp), sinon elle ne remonte jamais
    // (Timo). Sur l'état COURANT, sans changer le propriétaire.
    save((etat) => ({
      ...etat,
      users: etat.users.map((u) => (u.id === d.client?.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id
            ? { ...x, relance_le: today(), relance_par: profile.nom, nb_relances: (x.nb_relances || 0) + 1, ...(trace ? { envoi_whatsapp: trace } : {}) }
            : x)) }
        : u)),
      messages: r.auto ? messagesAvecLigneEnvoi(etat.messages, { profile, tel: d.client.tel, nom: d.client.nom_base || d.client.nom, modele: envoi.modele, variables: envoi.variables, ref: { devis_id: d.id }, envoi: r }) : etat.messages,
    }), `Devis ${STATUT_DEVIS[d.statut || "propose"][0]} de ${d.client?.nom_base || d.client?.nom} (${fmt(d.total)}) relancé ${r.auto ? "du numéro BMI" : "par WhatsApp"} — ${profile.nom}`);
  };

  // Base pour les compteurs des onglets de statut : tous les AUTRES filtres
  // s'appliquent (recherche, type, relance), mais PAS le statut lui-même —
  // sinon le compteur d'un onglet non sélectionné retomberait toujours à 0.
  const devisAvantStatut = tousDevis.filter((d) => {
    if (relanceSeule && !enAttenteDeRelance(d)) return false;
    if (!periode.dans(d.date)) return false;
    if (filtreType && (d.type_devis || "solaire") !== filtreType) return false;
    if (recherche) {
      const texte = normNom(`${d.client?.nom_base || d.client?.nom || ""} ${d.par || ""}`);
      if (!texte.includes(normNom(recherche))) return false;
    }
    return true;
  });
  // 📁 « Tous » est la liste ACTIVE : un devis classé sans suite n'y est pas,
  // il se retrouve sous son propre onglet (Timo, 26/09/2026).
  // 📋 « À compléter » : un raccourci vers les devis Proposé qui attendent la
  // visite — ils restent AUSSI dans « ⏳ Proposé » (Timo, 08/10/2026, « a »).
  const dansOnglet = (d, s) => (s === ONGLET_A_COMPLETER ? attendLaVisite(d) : s ? (d.statut || "propose") === s : !estSansSuite(d));
  const compteStatut = (s) => devisAvantStatut.filter((d) => dansOnglet(d, s)).length;

  const devisFiltres = devisAvantStatut.filter((d) => dansOnglet(d, filtreStatut))
    .sort((a, b) =>
    (ORDRE_STATUT_DEVIS[a.statut || "propose"] - ORDRE_STATUT_DEVIS[b.statut || "propose"])
    || `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));
  const { pageItems: devisPage, page, setPage, totalPages } = usePagination(devisFiltres, 50);

  // ---- SIGNATURE EN BOUTIQUE (demande Timo, 04/09/2026) ----
  // « Un client qui ne passe pas par l'app et veut signer le contrat » :
  // deux gestes réservés aux employés, sur un devis encore proposé.
  //   ✍️ Faire signer ici — le contrat s'affiche sur l'appareil du vendeur,
  //      le client signe avec le doigt ; enregistré EXACTEMENT comme une
  //      signature dans son espace (même règle : lib/validationDevis.js),
  //      avec la mention « signé en boutique X devant Y ».
  //   🖨 Imprimer pour signature papier — le contrat complet, cases vides,
  //      avec un numéro attribué tout de suite (le papier et l'application
  //      portent le même) ; puis 📝 Signé sur papier — date, boutique,
  //      vendeur, original archivé à la boutique.
  // ⚠ Décision Timo (04/09/2026) : « laisser cette possibilité à
  // l'administrateur principal seul — avec le temps, quand on mettra en
  // place le code superviseur, on pourra ouvrir ce geste aux vendeurs pour
  // un seul geste ». Le bouton est caché aux autres ET le geste refuse.
  const peutSignerEnBoutique = estAdminPrincipal(db, profile);
  // 🖨 Un devis IMPRIMÉ SANS COMPTE (15/10/2026, « B a, D a ») : sa signature
  // SUR PAPIER est ouverte à tout administrateur — c'est le seul chemin par
  // lequel ce client valide. La signature à l'écran reste au principal.
  const papierOuvertATousLesAdmins = (d) => estSansAcces(d?.client) && profile.role === "admin";
  // 📋 Un devis à compléter après la visite ne se signe pas (décision « A a »).
  const peutFaireSigner = (d) => (peutSignerEnBoutique || papierOuvertATousLesAdmins(d)) && (d.statut || "propose") === "propose" && !devisACompleter(d);
  const refuserSiPasAdminPrincipal = (d, mode) => {
    if (mode === "papier" && estSansAcces(d?.client)) return refuserSaufAdmin(profile, "Enregistrer la signature papier d'un devis imprimé sans compte");
    return refuserSaufAdminPrincipal(db, profile, "Faire signer un contrat en boutique (pour l'instant)");
  };
  const [signature, setSignature] = useState(null); // { devis, mode: "ecran" | "papier", boutique }
  useRetour(!!signature, () => setSignature(null)); // ⬅ touche retour = Annuler (13/10/2026)
  const [plan, setPlan] = useState({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() });
  const signatureRef = useRef(null); // LA zone de signature commune (components/ZoneSignature.jsx)
  const boutiquesPaiement = boutiquesVisibles(db, profile, boutiquesVente(db));
  const lieuSignature = profile.boutique || signature?.boutique || "";

  const ouvrirSignature = (d, mode) => {
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal(d, mode)) return;
    setPlan({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() });
    setSignature({ devis: d, mode, boutique: d.boutique_paiement || profile.boutique || d.boutique || "" });
  };

  // Le numéro de contrat est attribué à l'IMPRESSION et enregistré sur le
  // devis : le papier signé et l'application portent le même numéro.
  const imprimerPourPapier = (d) => {
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal(d, "papier")) return;
    const numero = d.contrat_numero || numeroContrat();
    if (!d.contrat_numero) {
      save({ ...db, users: db.users.map((u) => (u.id === d.client?.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, contrat_numero: numero } : x)) }
        : u)) }, `Contrat ${numero} imprimé pour signature papier — devis de ${d.client?.nom_base || d.client?.nom} (par ${profile.nom})`);
    }
    imprimerContratInstallation({ ...d, contrat_numero: numero, contrat_date_signature: today(),
      boutique_paiement: d.boutique_paiement || d.boutique || "" }, db);
  };


  const confirmerSignature = async () => {
    if (!signature) return;
    const { devis: d, mode, boutique } = signature;
    if (bloquerSiLecture(db, profile) || refuserSiPasAdminPrincipal(d, mode)) return;
    // Le plan de règlement, comme dans l'espace client : seulement s'il
    // restera un solde après l'acompte.
    const solde = soldeApresAcompte(d);
    if (solde > 0) {
      const souci = critiquePlan(plan, solde);
      if (souci) { uAlert(souci); return; }
    }
    const planSigne = planReglementSigne(plan, solde);
    const numero = d.contrat_numero || numeroContrat();
    let infosContrat, mention;
    if (mode === "ecran") {
      if (!signatureRef.current?.aSigne()) { uAlert("Le client doit signer dans le cadre prévu."); return; }
      if (!await uConfirm(`Enregistrer la signature de ${d.client?.nom_base || d.client?.nom} pour le devis de ${fmt(d.total)} ?\n\nContrat ${numero}, signé en boutique ${lieuSignature || "—"} devant ${profile.nom}.${d.pose_seule ? "" : `\nPaiement prévu à ${boutique}.`}${offreExpiree(d, today()) ? `\n\n⌛ ${phraseOffreExpiree(d)} : confirmez le prix avec le client.` : ""}`)) return;
      infosContrat = { contrat_numero: numero, contrat_signature: signatureRef.current.image(), contrat_date_signature: today(),
        contrat_signe_en_boutique: lieuSignature, contrat_signe_devant: profile.nom };
      mention = ` — signé en boutique ${lieuSignature || "—"} devant ${profile.nom}`;
    } else {
      if (!await uConfirm(`Le client ${d.client?.nom_base || d.client?.nom} a signé le contrat ${numero} SUR PAPIER ?\n\nL'original signé doit être archivé à la boutique ${lieuSignature || "—"}. Ce geste vaut validation du devis${d.pose_seule ? "" : ` — paiement prévu à ${boutique}`}.`)) return;
      infosContrat = { contrat_numero: numero, contrat_date_signature: today(),
        contrat_papier: true, contrat_papier_boutique: lieuSignature, contrat_papier_par: profile.nom };
      mention = ` — signé sur papier, original archivé à ${lieuSignature || "—"} (reçu par ${profile.nom})`;
    }
    if (planSigne) infosContrat.plan_reglement = planSigne;
    const r = validerDevis(db, { clientId: d.client?.id, devisId: d.id, boutique, infosContrat, acteur: { nom: profile.nom }, mention });
    if (r.erreur) { uAlert(r.erreur); return; }
    save(r.db, r.journal);
    setSignature(null);
    uAlert(d.pose_seule
      ? `✅ Contrat ${numero} enregistré. Le chantier est créé — à programmer dans 🏠 Clients installés.`
      : `✅ Contrat ${numero} enregistré. Le devis est validé : encaissez-le dans 💰 Ventes (commande en attente à ${boutique}).`);
  };

  // ⚠ Timo (11/09/2026) : un devis SIGNÉ ne se modifie pas tout seul — on le
  // DEMANDE au client, et c'est lui qui ouvre la porte.
  const demanderModifAuClient = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    // 🖨 Le client d'un devis imprimé sans compte ne peut pas accepter dans
    // son espace : la demande resterait en attente pour toujours.
    if (estSansAcces(d.client)) { uAlert(MODIF_SANS_ACCES); return; }
    const refus = motifRefusDemandeModif(db, d, profile);
    if (refus) { uAlert(refus); return; }
    const motif = await uPrompt(
      `Pourquoi faut-il modifier ce devis de ${fmt(d.total)} ?\n\n${d.client?.nom_base || d.client?.nom} l'a déjà signé : il verra ce motif et devra accepter avant que vous puissiez le corriger.`,
      ""
    );
    if (motif === null) return;
    const r = poserDemandeModif(db, d.client, d, profile, motif, today());
    if (r.erreur) { uAlert(r.erreur); return; }
    save(r.db, r.journal);
    uAlert(`✅ Demande envoyée à ${d.client?.nom_base || d.client?.nom}.\n\nVous pourrez corriger le devis dès qu'il aura accepté.`);
  };

  // 💰 ENCAISSER DEPUIS LA LIGNE DU DEVIS (Timo, 15/10/2026, « b ») : la même
  // chose que « Valider » dans 🧾 Commandes — la commande passe validée, et
  // 💰 Ventes s'ouvre avec le panier, le client et le devis d'origine.
  // L'encaissement reste celui de 💰 Ventes (la fiche 🏠 y naît).
  const encaisserDevis = (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdmin(profile, "Encaisser un devis depuis 📋 Tous les devis")) return;
    const c = commandeAEncaisser(db, d);
    if (!c) { uAlert("Ce devis n'a plus de commande à encaisser : elle a été encaissée ou refusée entre-temps (🧾 Commandes)."); return; }
    if (!onEncaisserCommande) return;
    const panier = c.statut === "en_attente" ? (c.articles || []) : (d.panier?.length ? d.panier : (c.articles || []));
    if (c.statut === "en_attente") {
      save({ ...db, commandes: (db.commandes || []).map((x) => (x.id === c.id ? { ...x, statut: "validee", valide_par: profile.nom, suivi_vente: true } : x)) },
        `Commande du devis de ${d.client?.nom_base || d.client?.nom} validée depuis 📋 Tous les devis par ${profile.nom} — ${c.boutique}`);
    }
    onEncaisserCommande({ boutique: c.boutique, panier, commercial: c.commercial, responsable: c.responsable, rabais: c.rabais,
      origineDevis: c.origine_devis || null, remise: c.remise_pct || 0, client: c.client || "", tel: c.tel || "", commandeId: c.id });
  };

  // ⚠ Le bouton ne suffit pas : tout geste réservé se revérifie DANS le geste.
  const modifierDevis = (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const refus = motifRefusModification(d, profile);
    if (refus) { uAlert(refus); return; }
    onModifierDevis(d, d.client);
  };

  // ✍️ COMPLÉTER LE DEVIS APRÈS LA VISITE (Timo, 08/10/2026 : « après c'est à
  // compléter et non modifié »). Revérifié DANS le geste sur la fiche
  // FRAÎCHE ; les lignes déjà chiffrées ne bougent pas (completerDevis) ; la
  // trace dit « complété », jamais « modifié ». Puis le devis complété repart
  // au client du numéro BMI, comme un devis — après une question.
  const completerEtEnvoyer = async (d, saisie) => {
    if (bloquerSiLecture(db, profile)) return;
    const client = (db.users || []).find((u) => u.id === d.client?.id);
    const frais = (client?.devis || []).find((x) => x.id === d.id);
    const refus = motifRefusCompletion(frais, profile);
    if (refus) { uAlert(refus); return; }
    const produits = (db.produits || []).filter((p) => p.boutique === frais.boutique);
    const res = completerDevis(frais, { ...saisie, produits, par: profile.nom, par_id: profile.id, le: today() });
    if (res.erreur) { uAlert(res.erreur); return; }
    // ⚠⚠ 27/10/2026 (capture Timo, « Remise supérieure à 3 % sur un devis :
    // réservé à l'administrateur (vous : gerant) ») : UN DEVIS DÉJÀ TAMPONNÉ
    // D'UNE REMISE > 3 % (fixée plus tôt par l'administrateur) ne se
    // complétait par AUCUNE revérification locale — seul l'envoi d'un
    // NOUVEAU devis passe par rangerDevisChezLeClient. `completerDevis`
    // recalcule le pourcentage ÉQUIVALENT d'une remise libre sur le nouveau
    // total (les éléments cf. visite s'y ajoutent) : ce recalcul, même sans
    // toucher à la remise, suffisait à faire REFUSER le geste par le
    // serveur (users_regles_remise) — après coup, dans la file d'attente,
    // en rouge. LA MÊME limite que pour envoyer un devis : l'administrateur
    // seul complète un devis qui porte déjà une remise au-delà de 3 %.
    const plafond = plafondRemise(db);
    if (remiseExigeAdmin(res.devis.pct_remise, plafond) && profile.role !== "admin") {
      uAlert(`🔒 Ce devis porte une remise supérieure à ${plafond} % : seul l'administrateur peut le compléter. Faites-le compléter par lui, ou faites-lui ramener d'abord la remise à ${plafond} % au plus.`);
      return;
    }
    const nomClient = client.nom_base || client.nom;
    if (!await uConfirm(`Compléter le devis de ${nomClient} ?\n\nTotal provisoire : ${fmt(frais.total)}\nTotal du devis complété : ${fmt(res.devis.total)}\n\nLes lignes déjà chiffrées ne changent pas. Le devis garde son numéro et redevient validable par le client.`)) return;
    save((etat) => ({
      ...etat,
      users: etat.users.map((u) => (u.id === client.id ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? res.devis : x)) } : u)),
    }), `✍️ Devis de ${nomClient} complété après la visite (${fmt(frais.total)} → ${fmt(res.devis.total)}) par ${profile.nom}`);
    setCompletion(null);
    // 🖨 Sans accès : rien ne lui est envoyé, le devis complété s'imprime.
    if (estSansAcces(client)) { uAlert(`✅ Devis complété : ${fmt(res.devis.total)}.\n\n${client.nom_base || client.nom} n'a pas d'accès à l'application (devis imprimé sans compte) : rien ne lui est envoyé. Imprimez-le (📄 Devis PDF).`); return; }
    if (!client.tel) { uAlert(`✅ Devis complété : ${fmt(res.devis.total)}.\n\nCe client n'a pas de numéro enregistré : prévenez-le vous-même qu'il peut le valider dans son espace.`); return; }
    if (!await uConfirm(`✅ Devis complété : ${fmt(res.devis.total)}.\n\nL'envoyer à ${nomClient} (${client.tel}) du numéro WhatsApp BMI${saisie.avecPdf ? ", avec le PDF du devis" : ""} ?`)) return;
    const espaceFormation = espaceDuDevis(db, res.devis, profile);
    // 📎 « C a » (17/10/2026) : la case « Joindre le PDF » d'ici suit la même
    // règle que le volet — le PDF d'abord (sans repli), sinon le message
    // habituel sans PDF (« B a »). Le PDF est celui du devis COMPLÉTÉ.
    const dbComplete = { ...db, users: (db.users || []).map((u) => (u.id === client.id ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? res.devis : x)) } : u)) };
    const pdf = saisie.avecPdf && !espaceFormation
      ? await envoyerPdfDuDevis({ db: dbComplete, compte: client, idDevis: d.id, devisMarque: res.devis, tel: client.tel, espaceFormation })
      : { r: null, motif: "" };
    const envoi = envoiDevisDisponible({ devis: res.devis, compte: client, fmt, avecPdf: !!pdf.r });
    const texte = [
      `Bonjour ${nomClient}, votre devis BMI TOGO a été complété après la visite.`, ``,
      `Montant : ${fmt(res.devis.total)}`, ``,
      `Consultez-le et validez-le dans votre espace client :`, ADRESSE_APP, ``,
      `BMI TOGO — Les bâtiments modernes et intelligents`,
    ].join("\n");
    const motifPdf = saisie.avecPdf && !espaceFormation && !pdf.r ? (pdf.motif || "le numéro BMI n'a pas pu l'envoyer.") : "";
    const r = pdf.r || await envoyerModele({
      tel: client.tel, modele: envoi.modele, variables: envoi.variables,
      espaceFormation,
      texteRepli: texte, demanderConfirmation: uConfirm, prevenir: uAlert,
      ...(motifPdf ? { annonceRepli: `${lignePdfNonParti(motifPdf, pdf.incertain)}\n\n${SUITE_REPLI}` } : {}),
    });
    if (!r.auto) return;
    const trace = traceEnvoi({ modele: envoi.modele, par: profile.nom, par_id: profile.id, quand: today(), heure: heureCourte(), id: r.id });
    save((etat) => ({
      ...etat,
      users: etat.users.map((u) => (u.id === client.id ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, envoi_whatsapp: trace } : x)) } : u)),
      messages: r.auto ? messagesAvecLigneEnvoi(etat.messages, { profile, tel: client.tel, nom: nomClient, modele: envoi.modele, variables: envoi.variables, ref: { devis_id: d.id }, envoi: r }) : etat.messages,
    }));
    uAlert(`✅ Le devis complété est parti à ${nomClient} du numéro WhatsApp BMI${pdf.r ? ", avec le PDF du devis" : ""}.${motifPdf ? `\n\n${lignePdfNonParti(motifPdf, pdf.incertain)}\nLe message habituel est parti${pdf.incertain ? "" : " à la place"}, sans PDF.` : ""}`);
  };

  const telechargerPDF = (d) => genererPdfDuDevis(db, d);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {peutEtablirPourAutrui(profile) && (
            <select className={`${inputCls} sm:w-72`} value={auteurFiltre ? filtreAuteur : ""} onChange={(e) => setFiltreAuteur(e.target.value)} data-filtre-auteur-devis>
              <option value="">👥 Utilisateur — tous</option>
              {auteursListe.map((u) => (
                <option key={u.id} value={u.id}>{u.nom} — {LIBELLE_ROLE_EMPLOYE[u.role] || u.role} ({devisDeLEspace.filter((d) => devisDeLAuteur(d, u)).length})</option>
              ))}
            </select>
          )}
          <div className="font-bold text-slate-800" data-titre-tous-devis>📋 {auteurFiltre ? `TOUS LES DEVIS DE ${String(auteurFiltre.nom || "").toUpperCase()}` : "TOUS MES DEVIS"}</div>
        </div>
        {peutEtablirPourAutrui(profile) && auteursListe.length === 0 && profile.role !== "admin" && (
          <div className="text-xs text-slate-500 -mt-2 mb-3">Aucun commercial n'est sous votre responsabilité (👥 Utilisateurs → ⋯ Gérer → Parrain).</div>
        )}
        {/* ⚠ Demande Timo : de VRAIS boutons cliquables pour filtrer par statut,
            juste sous le titre — pas un simple classement passif de la liste. */}
        <div className="flex flex-wrap gap-2 mb-3">
          {[["", "📋 Tous"], ["propose", "⏳ Proposé"], [ONGLET_A_COMPLETER, "📋 À compléter"], ["valide", "✅ Validé"], ["paye", "💰 Payé"], ["modification", "✏️ Modification"], ["rejete", "❌ Rejeté"], [STATUT_SANS_SUITE, "📁 Sans suite"]].map(([id, label]) => (
            <button key={id || "tous"} onClick={() => setFiltreStatut(id)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border ${filtreStatut === id ? "bg-sky-800 text-white border-sky-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
              {label} <span className={`ml-1 ${filtreStatut === id ? "text-sky-200" : "text-slate-400"}`}>({compteStatut(id)})</span>
            </button>
          ))}
        </div>
        {nbARelancer > 0 && (
          <button onClick={() => setRelanceSeule((v) => !v)} className={`mb-3 w-full text-left rounded-lg border px-3 py-2 text-sm font-semibold ${relanceSeule ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"}`}>
            ⚠️ {nbARelancer} devis sans réponse depuis plus de {SEUIL_RELANCE_JOURS} jours (proposé{nbARelancer > 1 ? "s" : ""} ou validé{nbARelancer > 1 ? "s" : ""} non payé{nbARelancer > 1 ? "s" : ""}) — {relanceSeule ? "voir tous les devis" : "voir uniquement ceux-ci"}
          </button>
        )}
        <div className="grid sm:grid-cols-2 gap-2">
          <input className={champRecherche} placeholder="Rechercher un client ou un vendeur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select className={inputCls} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="solaire">☀️ Solaire</option>
            <option value="garage">🚪 Garage</option>
            <option value="autre">📦 Autre</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">{periode.selecteur}</div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {devisFiltres.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">{periode.actif ? "Aucun devis sur cette période." : <>Aucun devis{auteurFiltre ? ` de ${auteurFiltre.nom}` : voitTout ? "" : " établi par vous"} pour l'instant.</>}</div>
        ) : (
          <div className="max-h-[455px] overflow-auto">
            {/* 🧾 La ligne suit la règle de 💰 Ventes et 📋 Dettes (15/10/2026,
                « Tous, lance ») : le client figé en première colonne, un clic
                déplie le devis (une ligne à la fois), les gestes en boutons
                ronds — le libellé au survol. */}
            <table className="w-full text-sm min-w-[860px]">
              <thead className="sticky top-0 z-30 bg-white">
                <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                  {COLONNES_DEVIS.map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
            {devisPage.map((d, i) => {
              const deplie = ouvert === d.id;
              return (
              <Fragment key={d.id}>
                <tr data-ligne-devis={deplie ? "deplie" : "replie"} data-ligne={d.id} onClick={() => ouvrirDevis(d)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(deplie, i)}`}>
                  <td className={`px-3 py-2 min-w-[170px] ${celluleFigee(fondLigneDepliable(deplie, i), deplie)}`}>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      {d.client?.nom_base || d.client?.nom || "Client"}
                      {!(d.vu_par || []).includes(profile.id) && (
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0" title="Nouveau — pas encore ouvert"></span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{libelleTypeDevis(d)}</div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>{dFR(d.date)}</div>
                    <div className="text-xs text-slate-500">par {d.par}{d.prepare_par && d.prepare_par !== d.par ? <span data-prepare-par> · préparé par {d.prepare_par}</span> : null}</div>
                    <div className="text-xs text-slate-400">{d.boutique}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-sky-800 whitespace-nowrap tabular-nums">{fmt(d.total)}</td>
                  <td className="px-3 py-2"><BadgeStatutDevis statut={d.statut} /></td>
                  <td className="px-3 py-2 min-w-[240px]">
                    <div className="flex flex-wrap gap-1 max-w-[380px]">
                      {enAttenteDeRelance(d) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-red-50 text-red-700 border-red-300" title={d.relance_le ? `Relancé le ${dFR(d.relance_le)}, toujours sans réponse` : "Devis sans réponse depuis longtemps"}>
                          ⚠️ Sans réponse depuis {joursSansReponse(d)} j
                        </span>
                      )}
                      {d.relance_le && devisRelancable(d) && !enAttenteDeRelance(d) && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${d.envoi_whatsapp ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-slate-50 text-slate-600 border-slate-300"}`}
                          title={d.envoi_whatsapp ? libelleTrace(d.envoi_whatsapp) : `Relancé par ${d.relance_par || "?"}`}>
                          📲 Relancé le {dFR(d.relance_le)}{d.envoi_whatsapp ? " — du n° BMI" : ""}
                        </span>
                      )}
                      {(() => {
                          // ✓✓ Le dernier message parti du numéro BMI pour cette ligne,
                          // et où il en est (lib/suiviEnvoi.js, 26/09/2026).
                          const e = dernierEnvoiPour(db.messages, { devis_id: d.id });
                          return e ? <span data-suivi-envoi className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-white text-slate-600 border-slate-200">📲 n° BMI<CochesEnvoi statut={e.wa_statut} /></span> : null;
                        })()}
                      {offreExpiree(d, today()) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-300" data-offre-expiree
                          title={`${phraseOffreExpiree(d)}. Le client peut toujours le valider.`}>
                          ⌛ Offre expirée — prix à confirmer
                        </span>
                      )}
                      {d.offre_expiree_a_validation && (d.statut === "valide" || d.statut === "paye") && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-300"
                          title="Le client a validé après la fin de l'offre (15 jours) : le prix est à confirmer avec lui.">
                          ⌛ Validé après expiration — prix à confirmer
                        </span>
                      )}
                      {d.relance_auto_le && (d.statut || "propose") === "propose" && (() => {
                        // ❌ Une relance automatique NON REÇUE ne s'écrit pas « relancé »
                        // (16/10/2026, capture d'ONG, « les deux, lance ») : la dernière
                        // ligne du fil décide (lib/relanceAutoDevis.js).
                        const r = etatRelanceAuto(db.messages, d, today());
                        if (r?.echec) return (
                          <span data-relance-auto-non-recue className="text-xs font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-800 border-red-300"
                            title={r.motif || "WhatsApp n'a pas remis la relance."}>
                            🤖 Relance automatique non reçue le {dFR(r.le)}{r.limite ? " (limite de WhatsApp)" : ""} — appelez le client{r.retentera ? " · nouvel essai demain à 7 h" : ""}
                          </span>
                        );
                        return (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-300"
                            title="Relance automatique du 8e jour, partie du numéro WhatsApp BMI">
                            🤖 Relancé automatiquement le {dFR(d.relance_auto_le)}
                          </span>
                        );
                      })()}
                      {demandeModifEnCours(d) && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-300"
                          title={`Motif : ${d.demande_bmi.motif}`}>
                          ⏳ Modification demandée au client
                        </span>
                      )}
                      {demandeModifAcceptee(d) && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-green-50 text-green-800 border-green-300">
                          ✅ Le client a accepté — à corriger
                        </span>
                      )}
                      {cyclesModif(d) > 0 && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${cyclesModif(d) >= MAX_CYCLES_MODIF ? "bg-red-50 text-red-800 border-red-300" : "bg-slate-50 text-slate-600 border-slate-300"}`}>
                          🔁 {cyclesModif(d)}/{MAX_CYCLES_MODIF} aller-retour{cyclesModif(d) > 1 ? "s" : ""}
                        </span>
                      )}
                      {d.modifie_le && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-300"
                          title={`Devis corrigé par ${d.modifie_par || "?"}${d.nb_modifications > 1 ? ` — ${d.nb_modifications} corrections` : ""}`}>
                          ✏️ Modifié le {dFR(d.modifie_le)} par {d.modifie_par || "?"}{d.nb_modifications > 1 ? ` (${d.nb_modifications}×)` : ""}
                        </span>
                      )}
                      {devisACompleter(d) && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-amber-50 text-amber-800 border-amber-300" data-badge-cf-visite
                          title={PHRASE_A_COMPLETER}>
                          📋 À compléter après la visite
                        </span>
                      )}
                      {d.complete_le && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-300" data-badge-complete>
                          ✍️ Complété le {dFR(d.complete_le)} par {d.complete_par || "?"}
                        </span>
                      )}
                      {estSansAcces(d.client) ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-slate-100 text-slate-700 border-slate-400" data-badge-sans-compte
                          title={`Devis imprimé${d.imprime ? ` le ${dFR(d.imprime.le)} par ${d.imprime.par}` : ""} : le client n'a pas d'accès à l'application, rien ne lui est envoyé.`}>
                          🖨 Sans compte
                        </span>
                      ) : d.imprime ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap bg-slate-50 text-slate-600 border-slate-300" data-badge-imprime>
                          🖨 Imprimé le {dFR(d.imprime.le)}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <CelluleActions largeur="min-w-[120px] max-w-[200px]">
                    {/* 💰 Encaisser (« b ») : l'administrateur, devis validé dont la commande attend. */}
                    {profile.role === "admin" && onEncaisserCommande && commandeAEncaisser(db, d) && (
                      <BoutonRond data-encaisser-devis icone="💰" teinte="vert" onClick={() => encaisserDevis(d)}
                        titre={`💰 Encaisser — ouvre 💰 Ventes avec ce devis (commande à ${commandeAEncaisser(db, d).boutique})`} />
                    )}
                    {devisRelancable(d) && !estSansAcces(d.client) && (
                      <BoutonRond icone={<IconeWhatsApp taille={16} />} teinte="vert" envoi onClick={() => relancerDevis(d)}
                        titre={`📲 Relancer sur WhatsApp${d.relance_le ? ` (déjà le ${dFR(d.relance_le)}${d.nb_relances > 1 ? `, ${d.nb_relances} fois` : ""})` : ""} — ${(d.statut || "propose") === "valide" ? "rappeler au client qu'il reste à régler" : "rappeler le devis au client"}`} />
                    )}
                    {peutModifierDevis(d, profile) && onModifierDevis && (
                      <BoutonRond icone="✏️" teinte="ambre" onClick={() => modifierDevis(d)} titre={estSansAcces(d.client) ? "✏️ Modifier (puis réimprimer)" : "✏️ Modifier et renvoyer"} />
                    )}
                    {peutDemanderModif(db, d, profile) && !estSansAcces(d.client) && (
                      <BoutonRond icone="📝" teinte="ambre" onClick={() => demanderModifAuClient(d)} titre="✏️ Demander une modification au client — ce devis est signé : le client doit accepter avant toute correction" />
                    )}
                    {peutCompleterDevis(d, profile) && (
                      <BoutonRond data-bouton-completer icone="✍️" teinte="ambre" onClick={() => { setCompletion(completion === d.id ? null : d.id); if (!deplie) ouvrirDevis(d); }}
                        titre="✍️ Compléter le devis — chiffrer les éléments « cf. visite », les lignes déjà chiffrées ne changent pas" />
                    )}
                    <BoutonRond data-devis-pdf icone="📄" onClick={() => telechargerPDF(d)} titre="📄 Devis PDF" />
                    {peutClasserDevis(d, profile) && (d.statut || "propose") === "propose" && (
                      <BoutonRond data-classer-sans-suite icone="📁" teinte="gris" onClick={() => classerDevis(d)} titre="📁 Classer sans suite — le devis reste entier mais sort de la liste active" />
                    )}
                    {peutClasserDevis(d, profile) && estSansSuite(d) && (
                      <BoutonRond data-rouvrir-devis icone="↩" onClick={() => rouvrirDevisClasse(d)} titre="↩ Rouvrir le devis — il redevient ⏳ Proposé" />
                    )}
                    {peutDeciderDuPlan && !critiqueSuppressionDevis(d) && (
                      <BoutonRond data-supprimer-devis icone="🗑" teinte="rouge" onClick={() => supprimerDevis(d)} titre={`🗑 Supprimer — le devis part dans la corbeille ${DUREE_CORBEILLE_JOURS} jours`} />
                    )}
                  </CelluleActions>
                </tr>

                {deplie && (
                  <tr className="bg-slate-50" data-detail-devis><td colSpan={COLONNES_DEVIS.length} className="px-4 pt-2 pb-4">
                  {/* Sur téléphone, le détail tient dans l'écran (le tableau, lui, défile). */}
                  <div className="max-w-[min(900px,calc(100vw-56px))]">
                    {estSansSuite(d) && (
                      <div className="mb-3 rounded-xl border-2 border-slate-300 bg-white p-3 text-sm" data-sans-suite>
                        <div className="font-bold text-slate-800">📁 Classé sans suite le {dFR(d.sans_suite?.le)} par {d.sans_suite?.par || "?"}</div>
                        {d.sans_suite?.motif && <div className="text-slate-700 mt-1">Motif : « {d.sans_suite.motif} »</div>}
                        <div className="text-xs text-slate-500 mt-1">Le devis est gardé entier. Le client ne peut plus le valider ; il n'est plus relancé.</div>
                      </div>
                    )}
                    {(d.historique_sans_suite || []).length > 0 && !estSansSuite(d) && (
                      <div className="mb-3 text-xs text-slate-500">
                        {(d.historique_sans_suite || []).map((h, i) => (
                          <div key={i}>📁 Classé sans suite le {dFR(h.le)} par {h.par || "?"}{h.motif ? ` (« ${h.motif} »)` : ""} — rouvert le {dFR(h.rouvert_le)} par {h.rouvert_par || "?"}</div>
                        ))}
                      </div>
                    )}
                    {d.plan_reglement && (() => {
                      const pl = d.plan_reglement;
                      const solde = soldeApresAcompte(d);
                      const couleur = pl.statut === PLAN_ACCEPTE ? "border-green-300 bg-green-50"
                        : pl.statut === PLAN_REJETE ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50";
                      return (
                        <div className={`mb-3 rounded-xl border-2 p-3 ${couleur}`}>
                          <div className="font-bold text-slate-800 text-sm">
                            💰 Plan de règlement proposé par le client
                            {pl.statut === PLAN_EN_ATTENTE && " — en attente"}
                            {pl.statut === PLAN_ACCEPTE && ` — accepté par ${pl.decide_par || "?"} le ${dFR(pl.decide_le)}`}
                            {pl.statut === PLAN_REJETE && ` — refusé par ${pl.decide_par || "?"} le ${dFR(pl.decide_le)}`}
                          </div>
                          <div className="text-sm text-slate-700 mt-1">Solde concerné : <b>{fmt(solde)}</b></div>
                          <div className="text-sm text-slate-800 font-semibold mt-0.5">{resumePlan(pl, solde)}</div>
                          {/* ⚠ La ligne qui permet de juger en une seconde, au lieu
                              d'aller relire l'Article 4 du contrat. */}
                          <div className="text-xs text-slate-500 mt-1">{engagementDuContrat(d)}</div>
                          {pl.statut === PLAN_REJETE && pl.motif_rejet && (
                            <div className="text-xs text-red-700 mt-1">Motif : {pl.motif_rejet}</div>
                          )}
                          {pl.statut === PLAN_EN_ATTENTE && (
                            peutDeciderDuPlan ? (
                              <div className="flex gap-2 mt-2 flex-wrap">
                                <button onClick={() => deciderPlan(d, true)} className="px-4 py-1.5 rounded-lg bg-green-700 text-white text-xs font-bold hover:bg-green-800">✅ Accepter</button>
                                <button onClick={() => deciderPlan(d, false)} className="px-4 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">❌ Rejeter</button>
                              </div>
                            ) : (
                              <div className="text-xs font-semibold text-slate-500 mt-2">Seul l'administrateur PRINCIPAL peut accepter ou rejeter ce plan.</div>
                            )
                          )}
                        </div>
                      );
                    })()}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                          <th className="text-left px-2 py-1">Article</th>
                          <th className="text-right px-2 py-1">Qté</th>
                          <th className="text-right px-2 py-1">P.U.</th>
                          <th className="text-right px-2 py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.lignes || []).map((l, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-1">{l.article}</td>
                            <td className="px-2 py-1 text-right">{estLigneCfVisite(l) && !l.qte ? "—" : l.qte}</td>
                            {estLigneCfVisite(l)
                              ? <td colSpan={2} className="px-2 py-1 text-right italic text-amber-800" data-cf-visite>{MENTION_CF_VISITE}</td>
                              : <>
                                <td className="px-2 py-1 text-right">{fmt(l.pu)}</td>
                                <td className="px-2 py-1 text-right font-semibold">{fmt(l.total)}</td>
                              </>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {completion === d.id && peutCompleterDevis(d, profile) && (
                      <CompleterDevis devis={d} produits={(db.produits || []).filter((p) => p.boutique === d.boutique)}
                        onAnnuler={() => setCompletion(null)} onEnregistrer={(saisie) => completerEtEnvoyer(d, saisie)} />
                    )}
                    {peutFaireSigner(d) && (
                      <div className="mt-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-xs font-bold text-emerald-900 mb-2">{estSansAcces(d.client) ? "🖨 Devis imprimé sans compte : le client signe le contrat sur papier." : "Le client est en boutique et n'utilise pas l'application ?"}</div>
                        <div className="flex gap-2 flex-wrap">
                          {peutSignerEnBoutique && <button onClick={() => ouvrirSignature(d, "ecran")} className="text-xs font-bold text-white bg-emerald-700 rounded-lg px-3 py-1.5 hover:bg-emerald-800">✍️ Faire signer ici</button>}
                          <button onClick={() => imprimerPourPapier(d)} className="text-xs font-bold text-emerald-800 border border-emerald-400 bg-white rounded-lg px-3 py-1.5 hover:bg-emerald-100">🖨 Imprimer pour signature papier</button>
                          <button onClick={() => ouvrirSignature(d, "papier")} className="text-xs font-bold text-emerald-800 border border-emerald-400 bg-white rounded-lg px-3 py-1.5 hover:bg-emerald-100">📝 Signé sur papier</button>
                        </div>
                        {d.contrat_numero && <div className="text-[11px] text-slate-500 mt-1">Contrat {d.contrat_numero} déjà imprimé — le numéro sera conservé.</div>}
                      </div>
                    )}
                  </div>
                  </td></tr>
                )}
              </Fragment>
              );
            })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>

      {signature && (() => {
        const d = signature.devis;
        const numero = d.contrat_numero || "(attribué à l'enregistrement)";
        const apercu = { ...d, contrat_numero: d.contrat_numero || "", contrat_date_signature: today(), boutique_paiement: signature.boutique, contrat_signature: null };
        // Le texte du contrat vient de l'impression (impression.js) : une
        // seule source. Les styles y ciblent #zone-impression ; on les
        // retourne vers un cadre à nous pour l'aperçu.
        const html = htmlContratInstallation(apercu, db).replace(/#zone-impression/g, ".apercu-contrat");
        const solde = soldeApresAcompte(d);
        const lignes = plan.type === "mensuel" ? echeancier({ ...plan, montant_mensuel: Number(plan.montant_mensuel || 0) }, solde) : [];
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-bold text-slate-800">{signature.mode === "ecran" ? "✍️ Signature du client en boutique" : "📝 Contrat signé sur papier"}</div>
                  <div className="text-xs text-slate-500">{d.client?.nom_base || d.client?.nom} · {fmt(d.total)} · contrat {numero} · devant {profile.nom}{lieuSignature ? ` — ${lieuSignature}` : ""}</div>
                </div>
                <button onClick={() => setSignature(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
              </div>
              {!d.pose_seule && (
                <div className="mb-3 flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-semibold text-slate-700">Le client paiera à :</span>
                  <select className={inputCls + " sm:w-60"} value={signature.boutique} onChange={(e) => setSignature({ ...signature, boutique: e.target.value })}>
                    <option value="">— choisir —</option>
                    {boutiquesPaiement.map((b) => <option key={b.nom} value={b.nom}>{b.nom}</option>)}
                  </select>
                </div>
              )}
              <div className="apercu-contrat max-h-[38vh] overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50" dangerouslySetInnerHTML={{ __html: html }} />
              {solde > 0 && (
                <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                  <div className="font-bold text-amber-900 text-sm">Comment le client réglera-t-il le solde de {fmt(solde)} ?</div>
                  <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="plan-boutique" className="mt-1" checked={plan.type === "solde_signature"} onChange={() => setPlan({ ...plan, type: "solde_signature" })} />
                    <span>La <b>totalité</b> à la signature du PV de réception (ou dans les 3 jours)</span>
                  </label>
                  <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                    <input type="radio" name="plan-boutique" className="mt-1" checked={plan.type === "mensuel"} onChange={() => setPlan({ ...plan, type: "mensuel" })} />
                    <span><b>Chaque fin de mois</b></span>
                  </label>
                  {plan.type === "mensuel" && (
                    <div className="mt-2 pl-6 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input type="number" inputMode="numeric" className={inputCls + " sm:w-36"} placeholder="Montant" value={plan.montant_mensuel} onChange={(e) => setPlan({ ...plan, montant_mensuel: e.target.value })} />
                        <span className="text-sm text-slate-600">F, à partir du</span>
                        <input type="date" className={inputCls + " sm:w-44"} value={plan.premiere_echeance} onChange={(e) => setPlan({ ...plan, premiere_echeance: e.target.value })} />
                      </div>
                      {lignes.length > 0 && <div className="text-xs font-semibold text-amber-900">→ {lignes.length} versement(s), le dernier de {fmt(lignes[lignes.length - 1].montant)} le {dFR(lignes[lignes.length - 1].date)}</div>}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 mt-2">Le plan sera soumis à l'administrateur principal, comme depuis l'espace client.</div>
                </div>
              )}
              {signature.mode === "ecran" ? (
                <>
                  <div className="text-xs font-semibold text-slate-600 mt-3 mb-1">Signature du client (avec le doigt) :</div>
                  <ZoneSignature ref={signatureRef} />
                </>
              ) : (
                <div className="mt-3 text-sm text-slate-700 rounded-lg border border-slate-200 p-3">
                  Le client a signé <b>le contrat imprimé</b>. L'original signé reste archivé à la boutique <b>{lieuSignature || "—"}</b> ; l'application enregistre la date, la boutique et votre nom.
                  {!d.contrat_numero && <div className="text-xs text-amber-700 mt-1">⚠ Ce contrat n'a pas été imprimé depuis l'application : un numéro sera attribué maintenant. Reportez-le sur le papier.</div>}
                </div>
              )}
              <div className="flex gap-2 mt-3 flex-wrap">
                {signature.mode === "ecran" && <button onClick={() => signatureRef.current?.effacer()} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>}
                <button onClick={confirmerSignature} className="flex-1 px-4 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">{signature.mode === "ecran" ? "✍️ Enregistrer la signature et valider" : "📝 Confirmer la signature papier et valider"}</button>
                <button onClick={() => setSignature(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
