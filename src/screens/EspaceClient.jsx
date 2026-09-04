// ============================================================
// screens/EspaceClient.jsx — Espace du rôle Client : ses devis, ses
// achats, son chantier, le parrainage et le fil de discussion.
// ============================================================
import { useState, useRef } from "react";
import { Dimensionnement, TYPES_PORTAIL } from "./dimensionnement";
import { ADRESSE_APP, chiffresTel } from "../lib/comptesClients";
import { creerFilleulEnLigne } from "../supabaseClient";
import { PAIEMENTS } from "../lib/constants";
import { uid, fmt, today, dFR, telDigits, definirMotDePasse, totalVente, ouvrirWhatsApp } from "../lib/core";
import { soldeApresAcompte, echeancier, critiquePlan, resumePlan, prochaineEcheance, finDuMoisCourant, PLAN_EN_ATTENTE, PLAN_ACCEPTE, PLAN_REJETE } from "../lib/reglement";
import { Field, inputCls, Panel, uAlert, uConfirm, uPrompt, Info } from "../components/ui";
import { CRITERES_NOTE, moyenneNote, tauxParrain, boutiquesVente, statutChantier, debloquerCommissionsReception, partParrainBloquee, memeNumero, boutiquesVisibles, estCompteFormation, marqueEspace } from "../lib/calculs";
import { imprimerContratInstallation } from "../lib/impression";
import { validerDevis } from "../lib/validationDevis";

// ============ ESPACE CLIENT (rôle client) ============
export function EspaceClient({ db, profile, save, setTab }) {
  // Fiche du client installé correspondant à ce compte (rattaché par user_id)
  const fiche = (db.clients_installes || []).find((c) => c.user_id === profile.id);
  // Ses devis, déposés par un technicien depuis l'écran Dimensionnement
  const moi = (db.users || []).find((u) => u.id === profile.id) || {};
  const mesDevis = moi.devis || [];
  const [devisOuvert, setDevisOuvert] = useState(null);
  const [bqPaiement, setBqPaiement] = useState({});

  // Ouvrir un devis le marque comme vu par le client — la pastille clignotante
  // ne le signalera plus comme nouveau une fois consulté.
  const ouvrirMonDevis = (d) => {
    setDevisOuvert(devisOuvert === d.id ? null : d.id);
    if (!(d.vu_par || []).includes(profile.id)) {
      save({
        ...db,
        users: db.users.map((u) => (u.id === profile.id
          ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, vu_par: [...(x.vu_par || []), profile.id] } : x)) }
          : u)),
      });
    }
  };

  // ---- PARRAINAGE : le client amène un autre client ----
  const [parr, setParr] = useState({ nom: "", tel: "", note: "" });
  // ⚠ Le parrainage part maintenant sur le réseau : sans ce drapeau, deux
  // appuis rapides créeraient deux comptes pour la même personne.
  const [parrainageEnCours, setParrainageEnCours] = useState(false);

  // Ses filleuls : les comptes clients qu'il a lui-même amenés.
  const mesFilleuls = (db.users || []).filter((u) => u.parrain_client_id === profile.id);

  // Ses gains : les ventes où il figure comme apporteur.
  const mesVentesParrain = (db.ventes || []).filter((v) => v.apporteur && v.apporteur.parrain_user_id === profile.id);
  // ⚠ Une part de parrainage attend DEUX choses (règle Timo, 29/08/2026) :
  // que l'installation du filleul soit réceptionnée, ET que le filleul ait
  // soldé sa dette. Le parrain voit donc « en attente » tant que l'un des
  // deux manque — il n'a pas à connaître le détail des dettes d'autrui.
  const gainsDus = mesVentesParrain.filter((v) => !v.apporteur.payee && !partParrainBloquee(v, db)).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);
  const gainsEnAttente = mesVentesParrain.filter((v) => !v.apporteur.payee && partParrainBloquee(v, db)).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);
  const gainsPayes = mesVentesParrain.filter((v) => v.apporteur.payee).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);

  const parrainer = async () => {
    const nom = parr.nom.trim();
    const tel = parr.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom de votre filleul et son numéro."); return; }
    if (!await uConfirm(
      `Parrainer ${nom.toUpperCase()} ?\n\n` +
      `Un compte lui sera créé, et notre équipe le contactera.\n\n` +
      `Vous toucherez ${tauxParrain(moi, db)} % sur son installation — le jour où il l'aura réceptionnée.`
    )) return;

    // ⚠ TOUT LE TRAVAIL PASSE PAR LE SERVEUR DEPUIS LE 25/08/2026.
    //
    // Avant, cet écran cherchait lui-même si le téléphone était déjà connu,
    // fabriquait un identifiant libre et un mot de passe sans conflit, puis
    // prévenait les administrateurs — quatre contrôles qui exigent de voir
    // TOUTE la table des comptes. C'est ce qui obligeait à laisser l'annuaire
    // entier de vos clients descendre sur le téléphone de chacun d'eux.
    //
    // Le serveur fait exactement les mêmes contrôles, et ne renvoie ici que
    // l'identifiant et le mot de passe du filleul — de quoi écrire le
    // message WhatsApp, rien de plus.
    setParrainageEnCours(true);
    const r = await creerFilleulEnLigne({ nom, tel, note: parr.note.trim() });
    setParrainageEnCours(false);
    if (r.error) { uAlert(r.error); return; }
    const user = r.filleul;
    const motDePasse = r.motDePasse;

    // ---- LE MESSAGE WHATSAPP AU FILLEUL ----
    // Exactement comme pour un devis : ses identifiants + le lien vers son espace.
    // Sans cela, le filleul aurait un compte sans le savoir.
    const lignesMsg = [
      `Bonjour ${nom.toUpperCase()},`,
      ``,
      `${moi.nom_base || profile.nom} vous recommande BMI TOGO pour votre installation solaire.`,
      ``,
      `Nous vous avons ouvert un espace personnel — vous pourrez y suivre votre devis et votre installation :`,
      ADRESSE_APP,
      ``,
      `👤 Identifiant : *${user.nom}*`,
      `🔑 Mot de passe : *${motDePasse}*`,
      ``,
      `Notre équipe vous contactera très vite. À bientôt !`,
      `BMI TOGO — Les bâtiments modernes et intelligents`,
    ];
    const num = telDigits(tel);
    const texteWA = encodeURIComponent(lignesMsg.join("\n"));
    // ⚠ Même protection que l'envoi de devis (2.100.44) : cette ouverture
    // arrive APRÈS une fenêtre de confirmation, donc le navigateur peut la
    // bloquer. Sans le bouton de secours, le filleul avait un compte sans le
    // savoir — et personne n'était prévenu.
    await ouvrirWhatsApp(num ? `https://wa.me/${num}?text=${texteWA}` : `https://wa.me/?text=${texteWA}`, uConfirm);

    setParr({ nom: "", tel: "", note: "" });
    uAlert(`✅ Merci ! WhatsApp s'ouvre pour prévenir ${nom.toUpperCase()} — avec ses identifiants et le lien.\n\nVotre commission de ${tauxParrain(moi, db)} % vous sera versée dès qu'il aura réceptionné son installation.`);
  };

  // ---- LE CLIENT REJETTE SON DEVIS ----
  // Un rejet sans motif ne sert à rien : on l'exige. Et l'auteur du devis en est
  // averti par message — sinon il ne le saurait jamais.
  const rejeterDevis = async (d) => {
    const motif = await uPrompt(
      "Pourquoi rejetez-vous ce devis ?\n\n(Trop cher, plus besoin, j'ai choisi un autre prestataire...)\n\nVotre réponse nous aide à nous améliorer.",
      ""
    );
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Merci d'indiquer la raison du rejet."); return; }

    const message = {
      id: uid(), date: today(), ts: new Date().toISOString(),
      de_id: profile.id, de_nom: profile.nom,
      a_id: d.par_id,
      devis_id: d.id,
      texte: `❌ DEVIS REJETÉ (${fmt(d.total)}) — motif : ${motif.trim()}`,
      lu_par: [profile.id],
    };

    save({
      ...db,
      messages: [message, ...(db.messages || [])],
      users: db.users.map((u) => (u.id === profile.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id
            ? { ...x, statut: "rejete", motif_rejet: motif.trim(), rejete_le: today(), vu_par: [] }
            : x)) }
        : u)),
    }, `❌ Devis ${fmt(d.total)} REJETÉ par le client ${profile.nom} — ${motif.trim()}`);
    uAlert("Votre réponse a bien été transmise. Merci de nous avoir dit pourquoi.");
  };

  // ---- LE CLIENT DEMANDE UNE MODIFICATION ----
  const demanderModification = async (d) => {
    const quoi = await uPrompt(
      "Que faut-il modifier dans ce devis ?\n\n(Moins de panneaux, une autre batterie, étaler le paiement...)",
      ""
    );
    if (quoi === null) return;
    if (!quoi.trim()) { uAlert("Décrivez ce que vous souhaitez changer."); return; }

    const message = {
      id: uid(), date: today(), ts: new Date().toISOString(),
      de_id: profile.id, de_nom: profile.nom,
      a_id: d.par_id,
      devis_id: d.id,
      texte: `✏️ MODIFICATION DEMANDÉE sur le devis de ${fmt(d.total)} : ${quoi.trim()}`,
      lu_par: [profile.id],
    };

    save({
      ...db,
      messages: [message, ...(db.messages || [])],
      users: db.users.map((u) => (u.id === profile.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id
            ? { ...x, statut: "modification", demande_modif: quoi.trim(), modif_le: today(), vu_par: [] }
            : x)) }
        : u)),
    }, `✏️ Modification demandée par le client ${profile.nom} sur un devis de ${fmt(d.total)}`);
    uAlert(`Votre demande est transmise à ${d.par}. Il vous préparera un nouveau devis.`);
  };

  // ---- LE CLIENT NOTE CELUI QUI EST VENU CHEZ LUI ----
  const [notes, setNotes] = useState({});

  const noter = async (d) => {
    const n = notes[d.id] || {};
    if (CRITERES_NOTE.some((c) => !n[c.id])) { uAlert("Merci de noter les trois critères."); return; }

    const evaluation = {
      id: uid(), date: today(),
      client_id: profile.id,
      client_nom: moi.nom_base || profile.nom,
      devis_id: d.id,
      habillement: Number(n.habillement),
      maitrise: Number(n.maitrise),
      respect: Number(n.respect),
      commentaire: (n.commentaire || "").trim(),
    };

    // ⚠ La note se range dans la fiche du CLIENT (la sienne), plus dans celle
    // de l'employé noté. Depuis la fermeture de l'annuaire (client-1), un
    // client ne peut plus écrire dans la fiche d'un autre compte : le serveur
    // refusait la note, et ce refus bloquait tout son lot d'écritures
    // (même mécanique que le badge prospect — vécu par Timo, 31/08/2026).
    // L'écran Utilisateurs agrège les deux emplacements : evaluationsDe()
    // dans lib/calculs.js additionne l'ancien (fiche employé) et le nouveau.
    save({
      ...db,
      users: db.users.map((u) => (u.id === profile.id
        ? {
            ...u,
            evaluations_donnees: [{ ...evaluation, par_id: d.par_id, par_nom: d.par }, ...(u.evaluations_donnees || [])],
            devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, note_donnee: true } : x)),
          }
        : u)),
    }, `⭐ ${d.par} noté ${moyenneNote(evaluation).toFixed(1)}/5 par le client ${profile.nom}`);

    setNotes({ ...notes, [d.id]: {} });
    uAlert("Merci ! Votre avis nous aide à mieux vous servir.");
  };

  // ---- LE CLIENT VALIDE SON DEVIS ----
  // Il choisit la boutique où il ira payer. La demande part chez les vendeurs de
  // cette boutique, qui l'encaisseront. C'est le paiement qui déclenche
  // l'installation — pas la validation.
  // ---- CONTRAT D'INSTALLATION — lu et signé AVANT que la validation du
  // devis ne se poursuive (demande Timo : « il lit le contrat et signe
  // avant de continuer »). Signature numérique capturée directement ici,
  // dans l'app (pas via bmitogo.com, contrairement au PV de réception qui,
  // lui, doit rester accessible sans compte). Un seul état possible pour ce
  // contrat : signé — pas d'étape "en attente" séparée, il est créé au
  // moment même de la signature.
  const [contratOuvert, setContratOuvert] = useState(null); // devis en cours de lecture/signature
  // ⚠ DEMANDE TIMO (25/08/2026) : le client dit COMMENT il va solder, et il le
  // dit À LA SIGNATURE DU CONTRAT — pas à la réception. Il s'engage au départ.
  // L'administrateur SEUL acceptera ou rejettera ensuite.
  const [plan, setPlan] = useState({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() });
  const [dessinEnCours, setDessinEnCours] = useState(false);
  const canvasRef = useRef(null);
  const aSigneRef = useRef(false);

  const ouvrirContrat = (d) => {
    if (!d.pose_seule) {
      const boutique = bqPaiement[d.id];
      if (!boutique) { uAlert("Choisissez d'abord la boutique où vous irez payer."); return; }
    }
    setContratOuvert(d.id);
    aSigneRef.current = false;
  };

  const positionCanvas = (e, canvas) => {
    // Le canevas a une résolution interne fixe (440×120) mais s'affiche à
    // une largeur variable selon l'écran (className w-full) — sans cette
    // mise à l'échelle, la position dessinée ne correspondait pas à celle
    // du doigt dès que la taille affichée différait de la résolution
    // interne (systématique sur mobile). Signalé par Timo.
    // ⚠ Bug trouvé plus tard (signalé par Timo, décalage constaté au clavier-souris
    // dans un navigateur) : getBoundingClientRect() inclut la bordure CSS
    // (border-2, 2px) alors que le TRAIT dessiné se cale sur le bord
    // intérieur (la zone de contenu du canevas, sans la bordure). L'échelle
    // ET le décalage devaient donc utiliser clientWidth/clientHeight (zone
    // de contenu réelle, bordure exclue) et clientLeft/clientTop (épaisseur
    // de la bordure), pas le rectangle englobant seul.
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const echelleX = canvas.width / canvas.clientWidth;
    const echelleY = canvas.height / canvas.clientHeight;
    return {
      x: (point.clientX - rect.left - canvas.clientLeft) * echelleX,
      y: (point.clientY - rect.top - canvas.clientTop) * echelleY,
    };
  };
  const debuterTrait = (e) => {
    e.preventDefault();
    setDessinEnCours(true);
    aSigneRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const continuerTrait = (e) => {
    if (!dessinEnCours) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasRef.current);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const terminerTrait = () => setDessinEnCours(false);
  const effacerSignature = () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    aSigneRef.current = false;
  };

  const signerEtValider = async (d) => {
    if (!aSigneRef.current) { uAlert("Merci de signer dans le cadre prévu avant de continuer."); return; }
    // ⚠ Le choix est OBLIGATOIRE dès qu'un solde restera dû après l'acompte.
    // Sans cela, un chantier partirait sans le moindre engagement écrit du
    // client sur la façon dont il compte payer le reste.
    const solde = soldeApresAcompte(d);
    let planSigne = null;
    if (solde > 0) {
      const souci = critiquePlan(plan, solde);
      if (souci) { uAlert(souci); return; }
      planSigne = {
        type: plan.type,
        montant_mensuel: plan.type === "mensuel" ? Number(plan.montant_mensuel) : null,
        premiere_echeance: plan.type === "mensuel" ? plan.premiere_echeance : null,
        solde_engage: solde,
        propose_le: today(),
        statut: PLAN_EN_ATTENTE,
      };
    }
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");
    const numeroContrat = `CTR-${new Date().getFullYear()}-${uid().slice(0, 8).toUpperCase()}`;
    // ⚠ Le contrat ne se ferme QUE si la validation est allée au bout
    // (défaut trouvé lors de la revue, lot 2) : on fermait AVANT d'appeler
    // finaliserValidation, dont la confirmation peut encore être refusée —
    // le client qui répondait « Annuler » perdait alors sa signature, le
    // canevas ayant été démonté, et devait tout recommencer.
    const valide = await finaliserValidation(d, {
      contrat_numero: numeroContrat, contrat_signature: signatureDataUrl, contrat_date_signature: today(),
      ...(planSigne ? { plan_reglement: planSigne } : {}),
    });
    if (valide) { setContratOuvert(null); setPlan({ type: "", montant_mensuel: "", premiere_echeance: finDuMoisCourant() }); }
  };

  // ⚠ Demande Timo : signer le PV de réception (ou son avenant) DIRECTEMENT
  // dans l'app, EN PLUS du lien WhatsApp/bmitogo.com existant — le client
  // choisit. Repose sur le même canevas tactile que le contrat d'installation
  // ci-dessus (positionCanvas déjà générique), mais avec son propre état :
  // un client pourrait en théorie avoir un devis à signer ET un chantier en
  // attente de PV en même temps, les deux ne doivent jamais se mélanger.
  const [dessinPvEnCours, setDessinPvEnCours] = useState(false);
  const canvasPvRef = useRef(null);
  const aSignePvRef = useRef(false);
  // ⚠ Demande Timo : le client ne doit plus voir la zone de signature
  // directement — il doit d'abord LIRE le PV en entier, comme pour le
  // contrat d'installation ci-dessus. "pvLectureOuverte" distingue le cas
  // normal de l'avenant (même principe que "estAvenant" dans signerPv).
  const [pvLectureOuverte, setPvLectureOuverte] = useState(null); // null | "normal" | "avenant"
  const debuterTraitPv = (e) => {
    e.preventDefault();
    setDessinPvEnCours(true);
    aSignePvRef.current = true;
    const ctx = canvasPvRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasPvRef.current);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const continuerTraitPv = (e) => {
    if (!dessinPvEnCours) return;
    e.preventDefault();
    const ctx = canvasPvRef.current.getContext("2d");
    const { x, y } = positionCanvas(e, canvasPvRef.current);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const terminerTraitPv = () => setDessinPvEnCours(false);
  const effacerSignaturePv = () => {
    const ctx = canvasPvRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasPvRef.current.width, canvasPvRef.current.height);
    aSignePvRef.current = false;
  };
  // estAvenant distingue les 2 cas : PV normal (fin de chantier) vs avenant
  // (réserves corrigées) — mêmes champs que ceux déjà écrits par la page
  // externe (voir imprimerPV, lib/impression.js), donc le document généré
  // ensuite est rigoureusement identique, peu importe où le client a signé.
  const signerPv = async (estAvenant) => {
    if (!aSignePvRef.current) { uAlert("Merci de signer dans le cadre prévu avant de continuer."); return false; }
    const signatureDataUrl = canvasPvRef.current.toDataURL("image/png");
    const maintenant = new Date().toISOString();
    const champs = estAvenant
      ? { avenant_signature: signatureDataUrl, avenant_statut: "signe", avenant_date_signature: maintenant, statut: "receptionne", receptionne_le: today(), receptionne_par: profile.nom }
      : { contrat_signature: signatureDataUrl, contrat_statut: "signe", contrat_date_signature: maintenant, statut: "receptionne", receptionne_le: today(), receptionne_par: profile.nom };
    aSignePvRef.current = false;
    // ⚠ debloquerCommissionsReception était importée ici… et jamais appelée
    // (défaut trouvé lors de la revue, 18/08/2026) : signer le PV marquait le
    // chantier réceptionné SANS débloquer la commission du commercial ni la
    // part du parrain — et le rattrapage J+7, réservé aux chantiers encore
    // « terminés », ne repassait jamais derrière. Gelées pour toujours.
    // Le déblocage est maintenant immédiat, et le rattrapage de App.jsx
    // couvre les signatures faites sur bmitogo.com ainsi que le passé.
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === fiche.id ? { ...x, ...champs } : x)),
      ...debloquerCommissionsReception(db, fiche.vente_id, "PV signé dans l'application"),
    }, `${estAvenant ? "Avenant" : "PV de réception"} signé directement dans l'app par ${profile.nom} — ${fiche.nom} — commissions débloquées`);
    return true;
  };

  // ⚠ La règle de validation (commande / chantier + dette « pose seule »,
  // badge prospect, infos de la boutique de paiement) vit dans
  // lib/validationDevis.js — la même sert au vendeur qui fait signer en
  // boutique (TousLesDevis). Ici : les questions et les messages au client.
  const finaliserValidation = async (d, infosContrat) => {
    if (d.pose_seule) {
      if (!await uConfirm(
        `Valider ce devis de ${fmt(d.total)} (pose seule — matériel déjà en votre possession) ?\n\n` +
        `Nos équipes vous contacteront pour programmer l'intervention. Le règlement se fait au technicien à la fin des travaux (ou en boutique si besoin).`
      )) return false;
      const r = validerDevis(db, { clientId: profile.id, devisId: d.id, infosContrat, acteur: { nom: profile.nom, estClient: true } });
      if (r.erreur) { uAlert(r.erreur); return false; }
      save(r.db, r.journal);
      uAlert("✅ Contrat signé. Votre chantier est créé — nos équipes vous contacteront pour programmer l'intervention.");
      return true;
    }
    const boutique = bqPaiement[d.id];
    if (!boutique) { uAlert("Choisissez d'abord la boutique où vous irez payer."); return false; }
    const infosBoutique = db.boutiques.find((b) => b.nom === boutique);
    const localisation = infosBoutique?.adresse ? `\n📍 ${infosBoutique.adresse}` : "";
    const lienCarte = infosBoutique?.lat && infosBoutique?.lng ? `\n🗺️ Itinéraire : https://www.google.com/maps?q=${infosBoutique.lat},${infosBoutique.lng}` : "";
    const telBoutique = infosBoutique?.tel ? `\n📞 ${infosBoutique.tel}` : "";
    if (!await uConfirm(
      `Valider ce devis de ${fmt(d.total)} ?\n\n` +
      `Vous vous engagez à passer payer à la boutique ${boutique}.${localisation}${lienCarte}${telBoutique}\n` +
      `Le vendeur y sera prévenu de votre venue.\n\n` +
      `L'installation sera programmée après votre paiement.`
    )) return false;
    const r = validerDevis(db, { clientId: profile.id, devisId: d.id, boutique, infosContrat, acteur: { nom: profile.nom, estClient: true } });
    if (r.erreur) { uAlert(r.erreur); return false; }
    save(r.db, r.journal);
    uAlert(`✅ Merci ! Votre devis est validé.\n\nPassez à la boutique ${boutique} pour régler.${localisation}${lienCarte}${telBoutique}\nLe vendeur vous attend.\n\nDès votre paiement, nous programmerons votre installation.`);
    return true;
  };

  // ---- RÉCEPTION DES TRAVAUX PAR LE CLIENT ----
  // receptionner() et emettreReserves() retirées (Timo, chantier contrat de
  // prestation) : ce bouton permettait de réceptionner SANS AUCUNE signature,
  // contournant complètement la nouvelle exigence — un client avec un compte
  // aurait pu passer à côté du contrat, contrairement à celui sans compte
  // qui, lui, doit obligatoirement passer par le lien de signature. Un seul
  // chemin de réception désormais, cohérent pour tous : le lien signé.
  // Le client change SON PROPRE mot de passe — c'est le seul mot de passe
  // qu'il a le droit de modifier lui-même (décision de Timo). Une fois
  // changé, il n'est plus le mot de passe auto-généré : personne ne peut
  // plus le recalculer — sauf l'administrateur principal, qui peut toujours
  // en attribuer un nouveau depuis Utilisateurs si besoin.
  const changerMonMotDePasse = async () => {
    const p = await uPrompt("Nouveau mot de passe (6 caractères minimum) :");
    if (!p || p.length < 6) { if (p !== null) uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const confirmation = await uPrompt("Retapez-le pour confirmer :");
    if (confirmation !== p) { uAlert("Les deux mots de passe ne correspondent pas. Rien n'a été changé."); return; }
    const nouveauxChamps = await definirMotDePasse(p);
    save({
      ...db,
      users: db.users.map((x) => (x.id === profile.id ? { ...x, ...nouveauxChamps, mdp_auto: false } : x)),
    }, `Mot de passe changé par le client ${profile.nom} lui-même`);
    uAlert("✅ Votre mot de passe a été changé. Utilisez-le dès votre prochaine connexion.");
  };

  const garantiesDuDevis = (d) => (d.panier || [])
    .map((l) => (db.produits || []).find((p) => p.id === l.produit_id))
    .filter((p) => p?.garantie_fabricant)
    .map((p) => `${p.nom} : garantie fabricant ${p.garantie_fabricant}${p.conditions_garantie ? ` (${p.conditions_garantie})` : ""}`);

  return (
    <div className="space-y-4">
      {/* ═══════ CADEAU ═══════ */}
      {fiche?.cadeau && !fiche.cadeau.retire && (
        <div className="rounded-xl p-4 bg-pink-50 border-2 border-pink-300">
          <div className="font-bold text-pink-800 text-lg mb-1">🎁 Un cadeau vous attend !</div>
          <div className="text-slate-800 mb-2">BMI Togo vous offre : <b>{fiche.cadeau.quoi}</b></div>
          <div className="text-sm text-slate-700">
            Passez le récupérer à la boutique <b>{fiche.cadeau.boutique}</b>. À très bientôt !
          </div>
          <div className="text-xs text-slate-500 mt-2">Offert le {dFR(fiche.cadeau.date)}</div>
        </div>
      )}

      {/* ═══════ PARRAINAGE ═══════ */}
      <Panel>
        <div className="font-bold mb-1">🤝 Parrainez vos proches</div>
        <div className="text-xs text-slate-500 mb-3">
          Vous connaissez quelqu'un qui a besoin d'une installation solaire ? Présentez-le-nous.
          Vous touchez <b>{tauxParrain(moi, db)} %</b> du montant de son installation — versés le jour où il l'a réceptionnée.
        </div>

        {(gainsDus > 0 || gainsEnAttente > 0 || gainsPayes > 0) && (
          <div className="grid sm:grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl border-2 border-green-300 bg-green-50 p-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase">À vous verser</div>
              <div className="text-lg font-bold text-green-800">{fmt(gainsDus)}</div>
            </div>
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase">En attente de réception</div>
              <div className="text-lg font-bold text-amber-700">{fmt(gainsEnAttente)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Déjà reçu</div>
              <div className="text-lg font-bold text-slate-600">{fmt(gainsPayes)}</div>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
          <Field label="Nom de votre filleul"><input className={inputCls} placeholder="KOFFI AMA" value={parr.nom} onChange={(e) => setParr({ ...parr, nom: e.target.value })} /></Field>
          <Field label="Son numéro"><input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={parr.tel} onChange={(e) => setParr({ ...parr, tel: e.target.value })} /></Field>
          <Field label="Son besoin (facultatif)"><input className={inputCls} placeholder="Ex : maison 4 pièces" value={parr.note} onChange={(e) => setParr({ ...parr, note: e.target.value })} /></Field>
          <button onClick={parrainer} disabled={parrainageEnCours} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 disabled:opacity-60">{parrainageEnCours ? "⏳ Création du compte…" : "🤝 Parrainer"}</button>
        </div>

        {mesFilleuls.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Mes filleuls ({mesFilleuls.length})</div>
            <div className="space-y-1">
              {mesFilleuls.map((fl) => {
                const sonChantier = (db.clients_installes || []).find((c) => c.user_id === fl.id);
                const saVente = sonChantier ? (db.ventes || []).find((v) => v.id === sonChantier.vente_id) : null;
                const maPart = saVente?.apporteur?.parrain_user_id === profile.id ? Number(saVente.apporteur.montant || 0) : 0;
                return (
                  <div key={fl.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <span className="font-semibold">{fl.nom_base || fl.nom}</span>
                    <span className="text-xs">
                      {!sonChantier ? <span className="text-slate-400">En cours de contact</span>
                        : statutChantier(sonChantier) === "receptionne"
                          ? <span className="text-green-700 font-bold">✅ Installé — {fmt(maPart)} pour vous</span>
                          : <span className="text-amber-700 font-bold">🔧 Installation en cours — {fmt(maPart)} à venir</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {/* ═══════ MES DEVIS ═══════ */}
      {mesDevis.length > 0 && (
        <Panel>
          <div className="font-bold mb-1">📋 Mes devis</div>
          <div className="text-xs text-slate-500 mb-3">Les propositions d'installation préparées pour vous par BMI Togo.</div>
          <div className="space-y-2">
            {mesDevis.map((d) => (
              <div key={d.id} className="rounded-xl border-2 border-emerald-200 bg-emerald-50 overflow-hidden">
                <button onClick={() => ouvrirMonDevis(d)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-emerald-100">
                  <span>
                    <span className="font-bold text-emerald-900">{d.type_devis === "garage" ? "Motorisation portail/garage" : d.type_devis === "autre" ? (d.besoins?.categorie || "Devis") : "Installation solaire"} — {fmt(d.total)}</span>
                    <span className="block text-xs text-slate-500">Établi le {dFR(d.date)} par {d.par}</span>
                  </span>
                  {!(d.vu_par || []).includes(profile.id) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-red-600 rounded-full px-2 py-0.5 animate-pulse">🆕 Nouveau</span>
                  )}
                  <span className="text-sm font-bold text-emerald-800">{devisOuvert === d.id ? "▾" : "▸"}</span>
                </button>

                {devisOuvert === d.id && (
                  <div className="px-4 pb-4 bg-white">
                    {d.besoins && d.type_devis === "garage" && (
                      <div className="grid sm:grid-cols-3 gap-2 my-3">
                        <Info label="Installation" valeur={TYPES_PORTAIL.find((t) => t.id === d.besoins.type_ouvrant)?.label || "—"} />
                        <Info label="Surface de la porte" valeur={d.besoins.surface_porte ? `${d.besoins.surface_porte} m²` : "—"} />
                        <Info label="Poids motorisé" valeur={`${d.besoins.poids_ajuste} kg`} />
                        <Info label="Télécommandes" valeur={`× ${d.besoins.telecommandes}`} />
                      </div>
                    )}
                    {d.besoins && d.type_devis === "autre" && (
                      <div className="my-3">
                        <Info label="Catégorie" valeur={d.besoins.categorie || "—"} />
                      </div>
                    )}
                    {d.besoins && d.type_devis !== "garage" && d.type_devis !== "autre" && (
                      <div className="grid sm:grid-cols-3 gap-2 my-3">
                        <Info label="Besoin quotidien" valeur={`${Math.round(d.besoins.wh_jour)} Wh/jour`} />
                        <Info label="Puissance simultanée" valeur={`${Math.round(d.besoins.puissance_simultanee)} W`} />
                        <Info label="Autonomie" valeur={`${d.besoins.autonomie} jour(s)`} />
                      </div>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-200">
                          <th className="text-left px-2 py-1">Équipement</th>
                          <th className="text-right px-2 py-1">Qté</th>
                          <th className="text-right px-2 py-1">P.U.</th>
                          <th className="text-right px-2 py-1">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d.lignes || []).map((l, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="px-2 py-1">
                              <div className="font-semibold">{l.article}</div>
                              <div className="text-[10px] text-slate-400 uppercase">{l.categorie}</div>
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums">{l.qte}</td>
                            <td className="px-2 py-1 text-right tabular-nums">{fmt(l.pu)}</td>
                            <td className="px-2 py-1 text-right tabular-nums font-semibold">{fmt(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-emerald-300">
                      <span className="font-bold text-slate-700">TOTAL</span>
                      <span className="text-xl font-bold text-emerald-800">{fmt(d.total)}</span>
                    </div>
                    {/* ---- VALIDATION PAR LE CLIENT ---- */}
                    {d.refus_motif && (!d.statut || d.statut === "propose") && (
                      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                        ⚠ La boutique n'a pas pu donner suite : <b>{d.refus_motif}</b>. Vous pouvez revalider, éventuellement dans une autre boutique.
                      </div>
                    )}
                    {(!d.statut || d.statut === "propose") && (
                      <div className="mt-4 rounded-xl border-2 border-sky-300 bg-sky-50 p-3">
                        <div className="font-bold text-sky-900 mb-1">Ce devis vous convient ?</div>
                        <div className="text-xs text-slate-600 mb-3">
                          {d.pose_seule
                            ? <>Validez-le pour signer le contrat. <b>Nos équipes vous contacteront pour programmer l'intervention.</b> Le règlement se fait au technicien à la fin des travaux.</>
                            : <>Validez-le, et choisissez la boutique où vous passerez régler. Le vendeur y sera prévenu. <b>Votre installation sera programmée dès votre paiement.</b></>}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 items-end">
                          {!d.pose_seule && (
                            <Field label="Boutique où je vais payer">
                              <select className={inputCls} value={bqPaiement[d.id] || ""} onChange={(e) => setBqPaiement({ ...bqPaiement, [d.id]: e.target.value })}>
                                <option value="">— Choisir la boutique —</option>
                                {/* ⚠ Cloisonnement (29/08/2026) : la liste n'était pas filtrée —
                                    un client d'entraînement se voyait proposer les VRAIES
                                    boutiques, et sa commande partait chez de vrais vendeurs. */}
                                {boutiquesVisibles(db, profile, boutiquesVente(db)).map((b) => <option key={b.nom} value={b.nom}>{b.nom}</option>)}
                              </select>
                            </Field>
                          )}
                          <button onClick={() => ouvrirContrat(d)} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✅ JE VALIDE</button>
                        </div>

                        <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-sky-200">
                          <button onClick={() => demanderModification(d)} className="px-4 py-2 rounded-lg border-2 border-amber-400 text-amber-700 font-bold text-sm hover:bg-amber-50">✏️ Demander une modification</button>
                          <button onClick={() => rejeterDevis(d)} className="px-4 py-2 rounded-lg border-2 border-red-400 text-red-700 font-bold text-sm hover:bg-red-50">❌ Rejeter ce devis</button>
                        </div>
                      </div>
                    )}

                    {d.statut === "modification" && (
                      <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                        <div className="font-bold text-amber-900">✏️ Modification demandée</div>
                        <div className="text-sm text-slate-700 mt-1">« {d.demande_modif} »</div>
                        <div className="text-xs text-slate-500 mt-2">Demandée le {dFR(d.modif_le)}. {d.par} vous prépare un nouveau devis.</div>
                      </div>
                    )}

                    {d.statut === "rejete" && (
                      <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3">
                        <div className="font-bold text-red-800">❌ Devis rejeté</div>
                        <div className="text-sm text-slate-700 mt-1">Motif : « {d.motif_rejet} »</div>
                        <div className="text-xs text-slate-500 mt-2">Le {dFR(d.rejete_le)}. Merci de nous avoir dit pourquoi.</div>
                      </div>
                    )}

                    {/* ---- NOTER CELUI QUI EST VENU ---- */}
                    {d.par_id && !d.note_donnee && (
                      <div className="mt-4 rounded-xl border-2 border-purple-200 bg-purple-50 p-3">
                        <div className="font-bold text-purple-900 mb-1">⭐ Comment s'est passée votre rencontre avec {d.par} ?</div>
                        <div className="text-xs text-slate-600 mb-3">Votre avis est anonyme pour lui — il ne sert qu'à la direction de BMI Togo.</div>

                        {CRITERES_NOTE.map((c) => (
                          <div key={c.id} className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-sm text-slate-700">{c.emoji} {c.label}</span>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const actuel = Number((notes[d.id] || {})[c.id] || 0);
                                return (
                                  <button key={n} onClick={() => setNotes({ ...notes, [d.id]: { ...(notes[d.id] || {}), [c.id]: n } })}
                                    className={`w-7 h-7 rounded text-sm font-bold ${n <= actuel ? "bg-amber-400 text-white" : "bg-white text-slate-300 border border-slate-200"}`}>★</button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <input className={inputCls} placeholder="Un commentaire (facultatif)"
                          value={(notes[d.id] || {}).commentaire || ""}
                          onChange={(e) => setNotes({ ...notes, [d.id]: { ...(notes[d.id] || {}), commentaire: e.target.value } })} />

                        <button onClick={() => noter(d)} className="mt-3 px-5 py-2 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800">⭐ Envoyer mon avis</button>
                      </div>
                    )}

                    {d.note_donnee && (
                      <div className="mt-4 text-xs text-slate-500">⭐ Merci, votre avis sur {d.par} a bien été enregistré.</div>
                    )}

                    {d.statut === "valide" && (() => {
                      // Lu EN DIRECT depuis la fiche boutique — pas figé au moment de la validation,
                      // pour que le client voie toujours les informations à jour, même si elles ont
                      // été complétées après coup.
                      const infosBoutique = db.boutiques.find((b) => b.nom === d.boutique_paiement);
                      const adresse = infosBoutique?.adresse || d.boutique_adresse;
                      const tel = infosBoutique?.tel || d.boutique_tel;
                      const lat = infosBoutique?.lat || d.boutique_lat;
                      const lng = infosBoutique?.lng || d.boutique_lng;
                      return (
                        <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                          <div className="font-bold text-amber-900">⏳ Validé — en attente de votre paiement</div>
                          <div className="text-sm text-slate-700 mt-1">
                            Passez à la boutique <b>{d.boutique_paiement}</b> pour régler {fmt(d.total)}. Le vendeur vous attend.
                          </div>
                          {(adresse || tel || (lat && lng)) && (
                            <div className="text-sm text-slate-700 mt-2 pt-2 border-t border-amber-200">
                              {adresse && <div>📍 {adresse}</div>}
                              {tel && <div>📞 {tel}</div>}
                              {lat && lng && (
                                <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="inline-block mt-1 text-sky-700 font-bold underline">🗺️ Voir l'itinéraire sur la carte</a>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ⚠ OÙ EN EST SON PAIEMENT (demande Timo). Jusqu'ici le
                        client ne trouvait NULLE PART combien il lui restait
                        ni quand verser : il devait appeler la boutique.
                        ⚠ On ne lit QUE la dette qui porte l'identifiant de ce
                        devis : sans ce filtre, on afficherait au client le
                        solde d'un autre. */}
                    {(() => {
                      const pl = d.plan_reglement;
                      const solde = soldeApresAcompte(d);
                      if (!pl && solde <= 0) return null;
                      const maDette = (db.dettes || []).find((x) => x.devis_id === d.id);
                      const verse = Number(maDette?.paye || 0);
                      const reste = Math.max(0, solde - verse);
                      const suivante = pl ? prochaineEcheance(pl, solde, verse) : null;
                      const enRetard = suivante && suivante.date < today();
                      return (
                        <div className="mt-4 rounded-xl border-2 border-sky-300 bg-sky-50 p-3">
                          <div className="font-bold text-sky-900">💰 Où en est votre paiement</div>
                          <div className="text-sm text-slate-700 mt-1 space-y-0.5">
                            <div>Montant total : <b>{fmt(d.total)} F</b></div>
                            {solde !== Number(d.total) && <div>Acompte prévu avant travaux : {fmt(Number(d.total) - solde)} F</div>}
                            {verse > 0 && <div>Déjà versé sur le solde : {fmt(verse)} F</div>}
                            <div className="text-base font-bold text-sky-900">Reste à payer : {fmt(reste)} F</div>
                          </div>
                          {(maDette?.paiements || []).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-sky-200 text-xs text-slate-600">
                              {maDette.paiements.map((v, i) => (
                                <div key={i}>• {dFR(v.date)} — {fmt(v.montant)} F</div>
                              ))}
                            </div>
                          )}
                          {pl && (
                            <div className="mt-2 pt-2 border-t border-sky-200 text-sm">
                              <div className="text-xs font-bold text-slate-500 uppercase">Votre engagement</div>
                              <div className="text-slate-700">{resumePlan(pl, solde)}</div>
                              {pl.statut === PLAN_EN_ATTENTE && <div className="mt-1 text-xs font-bold text-amber-700">⏳ En attente de l'accord de BMI TOGO</div>}
                              {pl.statut === PLAN_REJETE && (
                                <div className="mt-1 text-xs font-bold text-red-700">
                                  ❌ Refusé par BMI TOGO{pl.motif_rejet ? ` : ${pl.motif_rejet}` : ""}. Rapprochez-vous de votre commercial pour convenir d'un autre échéancier.
                                </div>
                              )}
                              {pl.statut === PLAN_ACCEPTE && reste > 0 && suivante && (
                                <div className={`mt-1 text-sm font-bold ${enRetard ? "text-red-700" : "text-green-800"}`}>
                                  {enRetard ? "⚠ Versement en retard" : "Prochain versement"} : {fmt(suivante.montant)} F le {dFR(suivante.date)}
                                </div>
                              )}
                              {pl.statut === PLAN_ACCEPTE && reste === 0 && <div className="mt-1 text-sm font-bold text-green-800">✅ Soldé — merci !</div>}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {d.statut === "paye" && (
                      <div className="mt-4 rounded-xl border-2 border-green-300 bg-green-50 p-3">
                        <div className="font-bold text-green-800">✅ Payé — installation programmée</div>
                        <div className="text-sm text-slate-700 mt-1">
                          Réglé le {dFR(d.paye_le)} à {d.boutique_paiement}. Nos équipes vous contacteront pour convenir de la date. Suivez l'avancement ci-dessous.
                        </div>
                        {d.contrat_signature && (
                          <button onClick={() => imprimerContratInstallation(d, db)} className="mt-3 px-4 py-1.5 rounded-lg bg-white border-2 border-green-700 text-green-800 font-bold text-xs hover:bg-green-100">📄 Télécharger mon contrat</button>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-400 mt-2">
                      Devis indicatif, valable sous réserve de disponibilité du matériel. Contactez BMI Togo pour le confirmer.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <div className="font-bold mb-1">🏠 Bienvenue, {profile.nom}</div>
        <div className="text-xs text-slate-500 mb-4">Votre espace personnel BMI Togo.</div>
        {fiche ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Info label="Type d'installation" valeur={fiche.type_installation} />
              <Info label="Date d'installation" valeur={fiche.date_installation ? dFR(fiche.date_installation) : "—"} />
              <Info label="Prochain entretien" valeur={fiche.date_entretien ? dFR(fiche.date_entretien) : "—"} />
              <Info label="Téléphone" valeur={fiche.tel} />
            </div>

            {/* ---- CHEF D'ÉQUIPE ASSIGNÉ : le client peut lui écrire directement ---- */}
            {(() => {
              // ⚠ Le nom du chef est DÉJÀ inscrit sur la fiche du chantier
              // (voir ClientsInstalles : { user_id, nom, chef }). On le lisait
              // pourtant dans la table des comptes — c'est la seule raison qui
              // obligeait l'espace client à connaître les employés. Depuis que
              // cette table lui est fermée (étape 2), la lecture ne renverrait
              // plus rien et le bloc disparaîtrait EN SILENCE. On prend donc le
              // nom là où il est, et la table des comptes n'est qu'un secours
              // pour les vieilles fiches qui ne le portaient pas.
              const chefEntree = (fiche.equipe || []).find((e) => e.chef);
              const nomChef = chefEntree
                ? (chefEntree.nom && chefEntree.nom !== "?" ? chefEntree.nom
                  : (db.users.find((u) => u.id === chefEntree.user_id)?.nom || ""))
                : "";
              if (!nomChef) return null;
              return (
                <div className="mt-3 rounded-xl p-3 bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Chef d'équipe</div>
                    <div className="text-sm font-bold mt-0.5">👷 {nomChef}</div>
                  </div>
                  <button onClick={() => setTab && setTab("messages")} className="px-4 py-1.5 rounded-lg bg-sky-800 text-white font-bold text-xs hover:bg-sky-900 whitespace-nowrap">✉️ Écrire au chef d'équipe</button>
                </div>
              );
            })()}

            {/* ---- RÉCEPTION DES TRAVAUX ---- */}
            {statutChantier(fiche) === "termine" && (
              <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
                <div className="font-bold text-amber-900 mb-1">🔔 Votre installation est terminée</div>
                <div className="text-sm text-slate-700 mb-3">
                  {fiche.termine_par ? `${fiche.termine_par} a déclaré les travaux achevés` : "Nos équipes ont déclaré les travaux achevés"}
                  {fiche.date_fin ? ` le ${dFR(fiche.date_fin)}` : ""}.
                  <b> Vérifiez l'installation, puis confirmez ci-dessous.</b> Si quelque chose ne va pas, dites-le-nous — un technicien reviendra.
                </div>
                {/* ⚠ Ne PAS affirmer qu'un lien WhatsApp a été envoyé quand il
                    ne l'a pas été (défaut trouvé lors de la revue, lot 2) :
                    marquerTermine saute l'envoi si l'adresse formelle ou le
                    téléphone manque sur la fiche — le chantier passe alors
                    « terminé » SANS jeton de signature (contrat_statut vide).
                    Le client lisait pourtant « un lien vous a été envoyé »,
                    attendait un message qui n'existait pas, et rappelait BMI
                    pour rien. On ne l'affirme que si le lien existe vraiment. */}
                <div className="text-sm text-slate-600 bg-white border border-amber-200 rounded-lg px-3 py-2">
                  {fiche.contrat_statut === "attente_signature"
                    ? "📲 Un lien de réception sécurisé vous a été envoyé par WhatsApp, pour signer directement depuis votre téléphone. Si vous ne l'avez pas reçu, contactez BMI Togo."
                    : "📲 Nos équipes vont vous envoyer par WhatsApp un lien de réception sécurisé, pour signer directement depuis votre téléphone. Si rien ne vient, contactez BMI Togo."}
                </div>
                {fiche.contrat_statut === "attente_signature" && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-white p-3">
                    <button onClick={() => { setPvLectureOuverte("normal"); aSignePvRef.current = false; }} className="w-full px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">📄 Lire et signer le PV directement ici</button>
                  </div>
                )}
              </div>
            )}

            {statutChantier(fiche) === "receptionne" && (
              <div className="mt-4 rounded-xl border-2 border-green-300 bg-green-50 p-4">
                <div className="font-bold text-green-800">✅ Travaux réceptionnés</div>
                <div className="text-sm text-slate-700 mt-1">
                  Vous avez confirmé la bonne réalisation de l'installation le <b>{dFR(fiche.receptionne_le)}</b>. Merci de votre confiance !
                </div>
              </div>
            )}

            {statutChantier(fiche) === "reserves" && (
              <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-4">
                <div className="font-bold text-red-800">⚠ Vous avez signalé un problème</div>
                <div className="text-sm text-slate-700 mt-1">« {fiche.reserves} »</div>
                <div className="text-xs text-slate-500 mt-2">Signalé le {dFR(fiche.reserves_le)}. Nos équipes ont été prévenues et vous recontacteront.</div>
                {fiche.avenant_statut === "attente_signature" && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                    <button onClick={() => { setPvLectureOuverte("avenant"); aSignePvRef.current = false; }} className="w-full px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">📄 Lire et signer l'avenant directement ici</button>
                  </div>
                )}
              </div>
            )}

            {statutChantier(fiche) === "en_cours" && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                🔧 Installation en cours. Vous pourrez la réceptionner ici dès que nos équipes l'auront déclarée terminée.
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-slate-400 py-4">Votre fiche d'installation n'est pas encore disponible. Elle apparaîtra ici une fois créée par nos équipes.</div>
        )}
      </Panel>
      <Panel>
        <div className="font-bold mb-1">🔑 Mon mot de passe</div>
        <div className="text-xs text-slate-500 mb-3">Vous pouvez le changer à tout moment. Ne le partagez avec personne.</div>
        <button onClick={changerMonMotDePasse} className="px-4 py-2 rounded-lg bg-slate-800 text-white font-bold text-sm hover:bg-slate-900">Changer mon mot de passe</button>
      </Panel>
      <div className="text-xs text-slate-400">Utilisez l'onglet 💬 Messages pour écrire à nos équipes.</div>

      {/* ═══════ CONTRAT D'INSTALLATION — lecture + signature obligatoires
          avant que la validation du devis ne se poursuive ═══════ */}
      {contratOuvert && (() => {
        const d = mesDevis.find((x) => x.id === contratOuvert);
        if (!d) return null;
        const boutique = bqPaiement[d.id];
        const garanties = garantiesDuDevis(d);
        const listeEquipements = (d.panier || []).map((l) => `${l.article} — quantité : ${l.qte}`);
        const equipementsBMI = (d.panier || []).filter((l) => l.categorie !== "Installation");
        const totalEquipementsBMI = equipementsBMI.reduce((s, l) => s + Number(l.total || 0), 0);
        const estSolaire = d.type_devis !== "garage" && d.type_devis !== "autre";
        const montantAcompte = Number(d.montant_acompte ?? d.total);
        const pctAcompteAffiche = Number(d.pct_acompte ?? 100);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5">
              <div className="text-center mb-3">
                <div className="font-bold text-lg text-sky-900">{d.pose_seule ? "CONTRAT DE PRESTATION DE POSE" : `CONTRAT DE FOURNITURE D'INSTALLATION${d.type_devis === "garage" ? " D'UN SYSTEME DE MOTORISATION" : d.type_devis === "autre" ? "" : " D'UN SYSTEME SOLAIRE PHOTOVOLTAIQUE"}`}</div>
                <div className="text-xs text-slate-400">E-mail : info@bmitogo.com · NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523</div>
              </div>
              <div className="text-sm text-slate-700 space-y-2 mb-4">
                <p>Date : {dFR(today())}</p>
                <p>Entre les soussignés :</p>
                <p>BMI (Bâtiments Modernes et Intelligents) E-mail : info@bmitogo.com ; NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523 ; représenté par Mr EGBAOU Essozimna</p>
                <p>Et :</p>
                <p>Mr/Mme : {profile.nom}{profile.tel ? `, tél. ${profile.tel}` : ""}</p>
                {d.pose_seule ? (<>
                  <p><b>Article 1 — Objet.</b> Le présent contrat a pour objet la prestation de pose, d'installation, d'essais et de mise en service d'équipements <b>fournis par le Client</b>{totalEquipementsBMI > 0 ? ", ainsi que la fourniture des équipements complémentaires listés ci-dessous" : ""}, pour un <b>montant total dû à BMI TOGO de {fmt(d.total)} FCFA</b>, se décomposant comme suit : main d'œuvre de pose — <b>{fmt(d.total - totalEquipementsBMI)} FCFA</b>{totalEquipementsBMI > 0 ? <> ; équipements fournis par BMI TOGO — <b>{fmt(totalEquipementsBMI)} FCFA</b></> : null}. <b>Ce montant ne comprend pas le coût des équipements que le Client a acquis par ailleurs, hors du présent contrat.</b> Le Client déclare avoir acquis lui-même le matériel principal à installer, dont la liste figure en annexe ou sera constatée sur le procès-verbal de réception.
                    {totalEquipementsBMI > 0 && <span className="block mt-1"><b>Équipements fournis par BMI TOGO :</b><ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{equipementsBMI.map((l, i) => <li key={i}>{l.article} — quantité : {l.qte}</li>)}</ul></span>}</p>
                  {totalEquipementsBMI > 0 && (
                    <p><b>Article 1 bis — Garantie, propriété et risques des équipements fournis par BMI TOGO.</b> {garanties.length > 0 ? garanties.join(" ; ") + "." : "Selon la garantie fabricant de chaque équipement, le cas échéant."} Ces équipements demeurent la propriété de BMI TOGO jusqu'au paiement intégral du prix convenu ; les risques de perte, vol ou détérioration les concernant sont transférés au Client à compter de leur livraison ou de leur installation. Ces dispositions ne s'appliquent en aucun cas au matériel apporté par le Client lui-même (Article 2).</p>
                  )}
                  <p><b>Article 2 — Origine et conformité du matériel.</b> Le Client garantit que les équipements fournis sont neufs ou en bon état de fonctionnement, conformes à l'usage prévu, et compatibles entre eux. Le Prestataire se réserve le droit de refuser la pose d'un équipement qu'il jugerait manifestement défectueux ou non conforme aux normes de sécurité, sans que ce refus n'engage sa responsabilité.</p>
                  <p><b>Article 3 — Documents remis.</b> BMI TOGO remettra au Client les consignes d'utilisation et de sécurité relatives à la pose réalisée.</p>
                  <p><b>Article 4 — Modalités de paiement.</b> Le montant de la prestation, fixé au présent contrat, est payable à 70 % avant le début des travaux et les 30 % restants à la signature du procès-verbal de réception, qui constate l'achèvement des travaux. Le Client s'engage à régler ce solde au moment de cette signature, ou dans les 3 jours qui suivent au plus tard.</p>
                  <p><b>Article 5 — Délai d'exécution.</b> Les travaux seront exécutés dans un délai indicatif de {d.delai_installation || "à convenir avec le Client"} à compter de la signature du présent contrat ou de la mise à disposition effective du matériel par le Client, selon la dernière de ces deux dates.</p>
                  <p><b>Article 6 — Garantie de la pose.</b> Le Prestataire garantit la qualité de son intervention (pose, raccordement, mise en service) pendant 12 mois à compter de la signature du procès-verbal de réception, contre tout défaut lié directement à l'installation. Cette garantie ne couvre en aucun cas les équipements eux-mêmes : leur garantie relève exclusivement du fabricant ou du vendeur auprès duquel le Client les a acquis.</p>
                  <p><b>Article 7 — Exclusions de garantie.</b> La garantie de pose ne s'applique pas en cas de : défaut inhérent au matériel fourni par le Client ; catastrophe naturelle ; surtension ou défaut du réseau électrique ; mauvaise utilisation ou négligence ; modification ou intervention effectuée par un tiers non autorisé par BMI TOGO.</p>
                  <p><b>Article 8 — Responsabilité limitée.</b> Le Prestataire n'est pas responsable des dommages, pannes ou dysfonctionnements résultant d'un défaut, d'une non-conformité, ou d'une incompatibilité du matériel fourni par le Client — y compris lorsque ce défaut n'était pas décelable au moment de la pose.</p>
                  <p><b>Article 9 — Obligations de BMI TOGO.</b> Réaliser la pose conformément aux règles de l'art et aux normes de sécurité applicables, et former le Client à l'utilisation de l'installation.</p>
                  <p><b>Article 10 — Obligations du Client.</b> Mettre à disposition le matériel à installer, en bon état et complet, à la date convenue ; faciliter l'accès au chantier ; garantir la sécurité du site ; s'assurer de la solidité de tout support d'installation concerné.</p>
                  <p><b>Article 11 — Travaux supplémentaires.</b> Toute prestation non prévue au présent contrat fait l'objet d'un devis complémentaire, soumis à l'accord écrit préalable du Client.</p>
                  <p><b>Article 12 — Réception.</b> Un procès-verbal de réception sera signé à la fin des travaux ; sa date de signature marque le début de la garantie de pose (Article 6).</p>
                  <p><b>Article 13 — Résiliation ou renonciation du Client.</b> Le Client peut renoncer au présent contrat avant le commencement des travaux, par notification écrite. Si les travaux ont déjà commencé, le Client reste tenu du paiement des prestations déjà exécutées.</p>
                  <p><b>Article 14 — Force majeure.</b> Aucune des parties ne pourra être tenue responsable d'un manquement résultant d'un événement de force majeure.</p>
                  <p><b>Article 15 — Confidentialité des données.</b> BMI TOGO s'engage à traiter les données personnelles du Client conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise.</p>
                  <p><b>Article 16 — Hiérarchie des documents.</b> En cas de contradiction entre le présent contrat et tout autre document, le présent contrat prévaut, sauf accord écrit contraire des parties.</p>
                  <p><b>Article 17 — Litiges.</b> Tout différend sera réglé à l'amiable ; à défaut, les tribunaux compétents de la République Togolaise seront seuls compétents.</p>
                  <p><b>Article 18 — Défaut de paiement.</b> En cas de non-paiement à l'échéance convenue, BMI TOGO pourra suspendre toute intervention restant à exécuter et réclamer le paiement des sommes dues.</p>
                </>) : (<>
                <p><b>Article 1 — Objet.</b> Le présent contrat a pour objet la fourniture, l'installation, les essais et la mise en service des équipements prévus au devis accepté, pour un montant total de {fmt(d.total)} FCFA. Le devis accepté, ainsi que ses éventuelles annexes techniques, nomenclatures, fiches techniques et plans validés par les parties, font partie intégrante du présent contrat. Ils définissent notamment les équipements fournis, leurs quantités, leurs caractéristiques principales et les prestations d'installation comprises dans le prix. Toute prestation ou fourniture non expressément prévue dans ces documents fait l'objet d'un devis complémentaire soumis à l'accord préalable du Client.
                  {listeEquipements.length > 0 && <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{listeEquipements.map((l, i) => <li key={i}>{l}</li>)}</ul>}</p>
                <p><b>Article 2 — Documents remis.</b> BMI TOGO remettra au Client les fiches techniques, le rapport de mise en service, les consignes d'utilisation et de sécurité.</p>
                <p><b>Article 3 — Modalités de paiement.</b> {pctAcompteAffiche >= 100
                  ? `Le prix est payable intégralement, soit ${fmt(d.total)} FCFA, avant le commencement des travaux.`
                  : `Un acompte de ${pctAcompteAffiche} % du montant total, soit ${fmt(montantAcompte)} FCFA, est exigible avant le commencement des travaux. Le solde, soit ${fmt(d.total - montantAcompte)} FCFA, est exigible selon les modalités prévues à l'Article 21.`}</p>
                <p><b>Article 4 — Délai d'exécution.</b> Les travaux seront exécutés dans un délai indicatif de {d.delai_installation || "à convenir avec le Client"} à compter du paiement de l'acompte ou de la signature du présent contrat, selon le cas. Ce délai pourra être prolongé en cas de force majeure ou de retard imputable au Client, sans que cela n'engage la responsabilité de BMI TOGO.</p>
                <p><b>Article 5 — Garanties des équipements.</b> {garanties.length > 0 ? garanties.join(" ; ") + "." : "Selon la garantie fabricant de chaque équipement."}</p>
                <p><b>Article 6 — Garantie d'installation.</b> BMI TOGO garantit les travaux d'installation pendant 12 mois à compter de la signature du procès-verbal de réception, contre tout défaut lié à la pose. En cas de dysfonctionnement, BMI TOGO procède d'abord à un diagnostic pour déterminer l'origine du problème. Si le défaut relève de l'installation, la réparation est prise en charge intégralement et gratuitement par BMI TOGO. Si le défaut relève de l'équipement lui-même, BMI TOGO accompagne le Client dans les démarches de prise en charge auprès du fabricant ou du fournisseur ; le remplacement ou la réparation est soumis aux conditions de garantie du fabricant, et les frais de main-d'œuvre, de déplacement ou de réinstallation pourront être facturés au Client si ceux-ci ne sont pas pris en charge par le fabricant. Cette garantie ne constitue pas une garantie de performance des équipements : toute baisse de performance liée au vieillissement normal, aux conditions climatiques, à une mauvaise utilisation ou à des facteurs externes relève, le cas échéant, de la garantie du fabricant.</p>
                <p><b>Article 7 — Exclusions de garantie.</b> La garantie ne s'applique pas en cas de : catastrophe naturelle (foudre, inondation, incendie...) ; surtension ou défaut du réseau électrique ; mauvaise utilisation ou négligence ; défaut d'entretien ; modification, réparation ou intervention effectuée par une personne non autorisée par BMI TOGO ; usure normale des équipements.</p>
                <p><b>Article 8 — Performance {estSolaire ? "du système solaire" : "des équipements"}.</b> {estSolaire
                  ? "La production effective du système photovoltaïque dépend notamment de l'ensoleillement, de la consommation du Client, de l'orientation et de l'inclinaison des équipements, de l'ombrage, des conditions météorologiques et de la qualité du réseau électrique. BMI TOGO ne garantit aucun niveau de production déterminé."
                  : "Les performances de fonctionnement des équipements dépendent des conditions d'usage et de l'environnement d'installation. BMI TOGO ne garantit aucun niveau de performance déterminé au-delà des spécifications du fabricant."}</p>
                <p><b>Article 9 — Réserve de propriété.</b> Les équipements fournis demeurent la propriété de BMI TOGO jusqu'au paiement intégral du prix convenu, nonobstant leur installation. Le Client s'interdit de céder, gager ou transférer à un tiers les équipements avant paiement complet.</p>
                <p><b>Article 10 — Transfert des risques.</b> Les risques de perte, vol ou détérioration des équipements sont transférés au Client à compter de leur livraison sur le site, ou de leur installation si celle-ci est immédiate, sous réserve des dispositions de l'Article 9 relatives à la propriété.</p>
                <p><b>Article 11 — Obligations de BMI TOGO.</b> Installer les équipements conformément aux règles de l'art, respecter les normes de sécurité, former le Client à l'utilisation du système.</p>
                <p><b>Article 12 — Obligations du Client.</b> Régler les paiements conformément au devis accepté, faciliter l'accès au chantier, ne pas modifier l'installation sans accord écrit de BMI TOGO. Le Client s'engage également à garantir l'accès et la sécurité du site, à s'assurer de la solidité de la toiture, du mur, du pilier ou de tout autre support d'installation concerné, à réaliser, le cas échéant, les travaux préparatoires convenus, et à mettre à disposition un réseau électrique conforme.</p>
                <p><b>Article 13 — Travaux supplémentaires.</b> Toute prestation ou fourniture non prévue au devis initial fait l'objet d'un devis complémentaire, soumis à l'accord écrit préalable du Client avant exécution.</p>
                <p><b>Article 14 — Maintenance.</b> La garantie prévue au présent contrat ne comprend pas les prestations de maintenance préventive ou périodique, qui font l'objet d'une offre distincte si le Client le souhaite.</p>
                <p><b>Article 15 — Réception.</b> Un procès-verbal de réception sera signé à la fin des travaux ; sa date de signature marque le début des garanties. Le Client vérifie l'installation lors de la réception et peut formuler des réserves précises dans le procès-verbal ; ces réserves ne peuvent porter que sur des éléments constatables lors de la réception, et leur levée fait l'objet d'une constatation ultérieure. En cas de refus du Client de procéder à la réception sans motif valable, BMI TOGO pourra constater la mise à disposition de l'installation par tout moyen, notamment par notification écrite au Client.</p>
                <p><b>Article 16 — Résiliation ou renonciation du Client.</b> Le Client peut renoncer au présent contrat avant le commencement des travaux, par notification écrite à BMI TOGO. Dans ce cas, le Client reste tenu du remboursement des sommes effectivement engagées par BMI TOGO pour l'exécution du contrat, notamment les commandes de matériel, frais de transport, d'importation, de réservation, de mobilisation ou toute autre dépense directement liée au projet, sous réserve des dispositions légales applicables. Lorsque les travaux ont déjà commencé ou que tout ou partie du matériel a été commandé, livré ou installé, le Client reste tenu du paiement des prestations déjà exécutées et des dépenses effectivement engagées par BMI TOGO. Toute résiliation ou renonciation du Client ne peut avoir pour effet d'annuler les sommes déjà devenues exigibles.</p>
                <p><b>Article 17 — Force majeure.</b> Aucune des parties ne pourra être tenue responsable d'un manquement à ses obligations résultant d'un événement de force majeure, c'est-à-dire un événement extérieur, imprévisible et irrésistible au sens de la loi applicable, rendant impossible l'exécution de tout ou partie des obligations. La partie affectée en informe l'autre dans les meilleurs délais. Les obligations concernées sont suspendues pendant la durée de l'événement. Si celui-ci se prolonge au-delà d'un délai raisonnable, chacune des parties pourra résilier le présent contrat, sans indemnité, sous réserve du règlement des prestations déjà exécutées.</p>
                <p><b>Article 18 — Confidentialité des données.</b> BMI TOGO s'engage à collecter, traiter et conserver les données personnelles du Client (identité, coordonnées, adresse, et toute donnée enregistrée dans son système de gestion) conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise. Ces données sont utilisées exclusivement dans le cadre de l'exécution du présent contrat et de la relation commerciale, conservées pour la durée nécessaire à cette finalité, et ne sont communiquées à des tiers sans l'accord du Client, sauf obligation légale. Le Client dispose d'un droit d'accès, de rectification et, dans les conditions prévues par la loi, de suppression de ses données, qu'il peut exercer auprès de BMI TOGO.</p>
                <p><b>Article 19 — Hiérarchie des documents.</b> En cas de contradiction entre le présent contrat, le devis accepté et toute fiche technique ou annexe, le présent contrat prévaut, sauf stipulation contraire expresse et écrite des parties.</p>
                <p><b>Article 20 — Litiges.</b> Tout différend sera réglé à l'amiable ; à défaut, les tribunaux compétents de la République Togolaise seront seuls compétents.</p>
                <p><b>Article 21 — Paiement, défaut de paiement et suspension des prestations.</b> Le Client s'engage à effectuer les paiements conformément aux échéances prévues à l'Article 3 et au devis accepté. En cas de non-paiement total ou partiel d'une somme arrivée à échéance, BMI TOGO pourra adresser au Client une mise en demeure de payer. À défaut de régularisation dans le délai indiqué dans la mise en demeure, BMI TOGO pourra, conformément aux dispositions légales applicables : a) suspendre les travaux, la livraison, la mise en service ou toute autre prestation restant à exécuter ; b) suspendre toute intervention ou prestation non encore exécutée ; c) demander le paiement des sommes échues et de toute somme devenue exigible ; d) résilier le contrat en cas de manquement suffisamment grave du Client ; e) réclamer, lorsque les conditions légales sont réunies, la réparation des préjudices et frais résultant du défaut de paiement. Les prestations déjà exécutées, les équipements déjà fournis ou commandés ainsi que les frais effectivement engagés par BMI TOGO restent dus par le Client, sous réserve des dispositions légales applicables. La réception de l'installation ne constitue pas une renonciation de BMI TOGO au paiement du solde restant dû : lorsque le prix n'a pas été intégralement payé, la signature du procès-verbal de réception ne vaut pas quittance du prix total. En cas de défaut de paiement, BMI TOGO conserve l'ensemble des droits et recours prévus par la législation applicable.</p>
                <p className="text-xs text-slate-500">Paiement prévu à la boutique <b>{boutique}</b>.</p>
                </>)}
              </div>
              {/* ⚠ COMMENT LE CLIENT VA SOLDER (demande Timo, 25/08/2026).
                  N'apparaît QUE s'il restera quelque chose à payer après
                  l'acompte : pas de question inutile à un client qui paie
                  tout d'avance. Le calcul s'affiche pendant qu'il tape — il
                  voit tout de suite qu'à 10 000 F/mois il en a pour trois
                  ans, et l'administrateur verra exactement le même chiffre. */}
              {(() => {
                const solde = soldeApresAcompte(d);
                if (solde <= 0) return null;
                const lignes = plan.type === "mensuel" ? echeancier({ ...plan, montant_mensuel: Number(plan.montant_mensuel || 0) }, solde) : [];
                return (
                  <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                    <div className="font-bold text-amber-900 text-sm">Comment allez-vous régler le solde de {fmt(solde)} F ?</div>
                    <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" name="plan" className="mt-1" checked={plan.type === "solde_signature"}
                        onChange={() => setPlan({ ...plan, type: "solde_signature" })} />
                      <span>Je verse <b>la totalité</b> à la signature du procès-verbal de réception (ou dans les 3 jours qui suivent)</span>
                    </label>
                    <label className="flex items-start gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
                      <input type="radio" name="plan" className="mt-1" checked={plan.type === "mensuel"}
                        onChange={() => setPlan({ ...plan, type: "mensuel" })} />
                      <span>Je verse <b>chaque fin de mois</b></span>
                    </label>
                    {plan.type === "mensuel" && (
                      <div className="mt-2 pl-6 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input type="number" inputMode="numeric" className={inputCls + " max-w-[140px]"} placeholder="Montant"
                            value={plan.montant_mensuel} onChange={(e) => setPlan({ ...plan, montant_mensuel: e.target.value })} />
                          <span className="text-sm text-slate-600">F, à partir du</span>
                          <input type="date" className={inputCls + " max-w-[170px]"}
                            value={plan.premiere_echeance} onChange={(e) => setPlan({ ...plan, premiere_echeance: e.target.value })} />
                        </div>
                        {lignes.length > 0 && (
                          <div className="text-xs font-semibold text-amber-900">
                            → {lignes.length} versement(s), le dernier de {fmt(lignes[lignes.length - 1].montant)} F le {dFR(lignes[lignes.length - 1].date)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 mt-2">Votre choix sera soumis à BMI TOGO pour accord.</div>
                  </div>
                );
              })()}
              <div className="text-xs font-semibold text-slate-600 mb-1">Votre signature :</div>
              <canvas ref={canvasRef} width={440} height={160} className="w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50"
                onMouseDown={debuterTrait} onMouseMove={continuerTrait} onMouseUp={terminerTrait} onMouseLeave={terminerTrait}
                onTouchStart={debuterTrait} onTouchMove={continuerTrait} onTouchEnd={terminerTrait} />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={effacerSignature} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>
                <button onClick={() => signerEtValider(d)} className="flex-1 px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✍️ Signer et valider</button>
                <button onClick={() => setContratOuvert(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}

      {pvLectureOuverte && fiche && (() => {
        const estAvenant = pvLectureOuverte === "avenant";
        const vente = (db.ventes || []).find((v) => v.id === fiche.vente_id);
        const montant = vente ? totalVente(vente) : Number(fiche.frais_installation || 0);
        const chef = (fiche.equipe || []).find((e) => e.chef);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5">
              <div className="text-center mb-3">
                <div className="font-bold text-lg text-sky-900">{estAvenant ? "AVENANT AU PROCÈS-VERBAL DE RÉCEPTION" : "PROCÈS-VERBAL DE RÉCEPTION"}{fiche.contrat_numero ? ` N° ${fiche.contrat_numero}` : ""}</div>
                <div className="text-xs text-slate-400">BMI Togo · Lomé, Togo · NIF 1001790098 · RCCM TG-LFW-01-2022-A10-01523</div>
              </div>
              <div className="text-sm text-slate-700 space-y-2 mb-4">
                <p>Entre <b>BMI Togo</b> (Les Bâtiments Modernes et Intelligents), NIF 1001790098, RCCM TG-LFW-01-2022-A10-01523, ci-après « le Prestataire »,<br />
                Et <b>{fiche.prenom} {fiche.nom}</b>{fiche.tel ? `, tél. ${fiche.tel}` : ""}, ci-après « le Client »,</p>
                {estAvenant ? (
                  <p><b>Objet.</b> Le présent avenant constate que les réserves émises lors de la réception initiale (contrat N° {fiche.contrat_numero || "—"}) ont été corrigées par le Prestataire, à savoir : <i>{fiche.contrat_reserve_texte || "—"}</i>. En signant, le Client confirme la réception définitive, sans réserve, de la prestation.</p>
                ) : (
                  <>
                    <p><b>Article 1 — Objet.</b> Le présent procès-verbal constate la réception, par le Client, des travaux de <b>{fiche.type_installation}</b> réalisés à l'adresse suivante : <b>{fiche.adresse_contrat || "—"}</b>, pour un montant total de <b>{fmt(montant)} FCFA</b>.</p>
                    <p><b>Article 2 — Matériel installé{fiche.pose_seule ? " (fourni par le Client)" : ""}.</b> {(fiche.materiel || []).length > 0
                      ? <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>{fiche.materiel.map((m, i) => <li key={i}>{m.nom} — quantité : {m.qte}{m.serie ? ` — N° de série : ${m.serie}` : ""}</li>)}</ul>
                      : "Liste du matériel non renseignée."}{fiche.pose_seule && <span className="block text-xs text-slate-500 mt-1">Ce matériel a été fourni par le Client — BMI Togo n'assure que la pose.</span>}{chef && <span className="block text-xs text-slate-500 mt-1">Constaté par {chef.nom}, chef d'équipe.</span>}</p>
                    <p className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2"><b>Article 3 — État de la réception.</b> {fiche.contrat_reserve_texte
                      ? <>Le Client accepte les travaux <b className="text-red-700">avec les réserves suivantes</b>, que le Prestataire s'engage à corriger{fiche.reserves_delai ? ` avant le ${dFR(fiche.reserves_delai)}` : " dans un délai raisonnable"} : <i>{fiche.contrat_reserve_texte}</i>.</>
                      : "Le Client reconnaît que les travaux sont entièrement achevés conformément au devis accepté, testés en sa présence, et réceptionnés sans réserve."} Les documents remis (fiches techniques, consignes d'utilisation et de sécurité) ont été transmis au Client, conformément à l'Article 2 du contrat d'installation.</p>
                    <p><b>Article 4 — Garantie.</b> Le Prestataire garantit les équipements installés contre tout défaut de fabrication ou d'installation pour une durée de <b>{fiche.garantie_mois || "24"} mois</b> à compter de la date de signature, hors usure normale, mauvaise utilisation, ou intervention d'un tiers non autorisé.</p>
                    <p><b>Article 5 — Transfert de responsabilité.</b> À compter de la signature du présent procès-verbal, l'installation est réputée réceptionnée. La garde, l'utilisation et l'entretien de l'installation sont transférés au Client, sous réserve des garanties prévues à l'Article 4.</p>
                    <p><b>Article 6 — Signature.</b> En signant ci-dessous, le Client reconnaît avoir vérifié la conformité des travaux et accepte les termes du présent procès-verbal.</p>
                  </>
                )}
                <p className="text-xs text-slate-500">Fait à Lomé, le {dFR(today())}.</p>
              </div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Votre signature :</div>
              <canvas ref={canvasPvRef} width={440} height={160} className="w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50"
                onMouseDown={debuterTraitPv} onMouseMove={continuerTraitPv} onMouseUp={terminerTraitPv} onMouseLeave={terminerTraitPv}
                onTouchStart={debuterTraitPv} onTouchMove={continuerTraitPv} onTouchEnd={terminerTraitPv} />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={effacerSignaturePv} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>
                <button onClick={async () => { const ok = await signerPv(estAvenant); if (ok) setPvLectureOuverte(null); }} className="flex-1 px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✍️ Signer {estAvenant ? "l'avenant" : "la réception"}</button>
                <button onClick={() => setPvLectureOuverte(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
