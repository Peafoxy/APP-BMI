// ============================================================
// screens/EspaceClient.jsx — Espace du rôle Client : ses devis, ses
// achats, son chantier, le parrainage et le fil de discussion.
// ============================================================
import { useState, useRef } from "react";
import { Dimensionnement, TYPES_PORTAIL } from "./dimensionnement";
import { ADRESSE_APP, chiffresTel, fabriquerCompteClient, messagesNouveauClient } from "../lib/comptesClients";
import { PAIEMENTS } from "../lib/constants";
import { uid, fmt, today, dFR, telDigits, definirMotDePasse } from "../lib/core";
import { Field, inputCls, Panel, uAlert, uConfirm, uPrompt, Info } from "../components/ui";
import { CRITERES_NOTE, moyenneNote, tauxParrain, boutiquesVente, statutChantier, debloquerCommissionsReception } from "../lib/calculs";
import { imprimerContratInstallation } from "../lib/impression";

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

  // Ses filleuls : les comptes clients qu'il a lui-même amenés.
  const mesFilleuls = (db.users || []).filter((u) => u.parrain_client_id === profile.id);

  // Ses gains : les ventes où il figure comme apporteur.
  const mesVentesParrain = (db.ventes || []).filter((v) => v.apporteur && v.apporteur.parrain_user_id === profile.id);
  const gainsDus = mesVentesParrain.filter((v) => !v.apporteur.payee && !v.apporteur.a_la_reception).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);
  const gainsEnAttente = mesVentesParrain.filter((v) => v.apporteur.a_la_reception).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);
  const gainsPayes = mesVentesParrain.filter((v) => v.apporteur.payee).reduce((s, v) => s + Number(v.apporteur.montant || 0), 0);

  const parrainer = async () => {
    const nom = parr.nom.trim();
    const tel = parr.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom de votre filleul et son numéro."); return; }
    if ((db.users || []).some((u) => u.tel && chiffresTel(u.tel) === chiffresTel(tel))) {
      uAlert("Cette personne est déjà connue de BMI Togo. Le parrainage ne s'applique qu'aux nouveaux clients.");
      return;
    }
    if (!await uConfirm(
      `Parrainer ${nom.toUpperCase()} ?\n\n` +
      `Un compte lui sera créé, et notre équipe le contactera.\n\n` +
      `Vous toucherez ${tauxParrain(moi, db)} % sur son installation — le jour où il l'aura réceptionnée.`
    )) return;

    // Son compte : mêmes règles d'identifiant automatique. Il porte le lien vers vous.
    const { user, motDePasse } = await fabriquerCompteClient(db, nom, tel, profile.nom);
    const filleul = { ...user, parrain_client_id: profile.id, parrain_nom: moi.nom_base || profile.nom };

    // Un prospect, pour que l'équipe commerciale le rappelle vraiment.
    const prospect = {
      id: uid(), date: today(), commercial: null,
      nom: nom.toUpperCase(), tel,
      categorie: (db.categories_prospects || [])[0]?.nom || "Particulier",
      statut: "Favorable",
      interet: "Intéressé",
      note: `🤝 Parrainé par le client ${moi.nom_base || profile.nom}${parr.note.trim() ? " — " + parr.note.trim() : ""}`,
      parrain_user_id: profile.id,
      client_user_id: null, // rempli à la création du compte, juste après
    };

    save({
      ...db,
      users: [...db.users, filleul],
      prospects: [{ ...prospect, client_user_id: filleul.id }, ...(db.prospects || [])],
      messages: [...messagesNouveauClient(db, filleul, profile), ...(db.messages || [])],
    }, `🤝 PARRAINAGE : ${nom.toUpperCase()} amené par le client ${profile.nom}`);

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
    window.open(num ? `https://wa.me/${num}?text=${texteWA}` : `https://wa.me/?text=${texteWA}`, "_blank");

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

    save({
      ...db,
      users: db.users.map((u) => (u.id === d.par_id
        ? { ...u, evaluations: [evaluation, ...(u.evaluations || [])] }
        : u.id === profile.id
          ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id ? { ...x, note_donnee: true } : x)) }
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
  const [dessinEnCours, setDessinEnCours] = useState(false);
  const canvasRef = useRef(null);
  const aSigneRef = useRef(false);

  const ouvrirContrat = (d) => {
    const boutique = bqPaiement[d.id];
    if (!boutique) { uAlert("Choisissez d'abord la boutique où vous irez payer."); return; }
    setContratOuvert(d.id);
    aSigneRef.current = false;
  };

  const positionCanvas = (e, canvas) => {
    // Le canevas a une résolution interne fixe (440×120) mais s'affiche à
    // une largeur variable selon l'écran (className w-full) — sans cette
    // mise à l'échelle, la position dessinée ne correspondait pas à celle
    // du doigt dès que la taille affichée différait de la résolution
    // interne (systématique sur mobile). Signalé par Timo.
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    const echelleX = canvas.width / rect.width;
    const echelleY = canvas.height / rect.height;
    return { x: (point.clientX - rect.left) * echelleX, y: (point.clientY - rect.top) * echelleY };
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
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");
    const numeroContrat = `CTR-${new Date().getFullYear()}-${uid().slice(0, 8).toUpperCase()}`;
    setContratOuvert(null);
    await finaliserValidation(d, { contrat_numero: numeroContrat, contrat_signature: signatureDataUrl, contrat_date_signature: today() });
  };

  const finaliserValidation = async (d, infosContrat) => {
    const boutique = bqPaiement[d.id];
    if (!boutique) { uAlert("Choisissez d'abord la boutique où vous irez payer."); return; }
    const infosBoutique = db.boutiques.find((b) => b.nom === boutique);
    const localisation = infosBoutique?.adresse ? `\n📍 ${infosBoutique.adresse}` : "";
    const lienCarte = infosBoutique?.lat && infosBoutique?.lng ? `\n🗺️ Itinéraire : https://www.google.com/maps?q=${infosBoutique.lat},${infosBoutique.lng}` : "";
    const telBoutique = infosBoutique?.tel ? `\n📞 ${infosBoutique.tel}` : "";
    if (!await uConfirm(
      `Valider ce devis de ${fmt(d.total)} ?\n\n` +
      `Vous vous engagez à passer payer à la boutique ${boutique}.${localisation}${lienCarte}${telBoutique}\n` +
      `Le vendeur y sera prévenu de votre venue.\n\n` +
      `L'installation sera programmée après votre paiement.`
    )) return;

    // La commande part chez les vendeurs — exactement comme une commande commerciale.
    const commande = {
      id: uid(),
      date: today(),
      // SEULS un commercial ou un technicien (commission) sont commissionnés.
      // Un devis fait par un salarié (technicien BMI, admin, vendeur) ne génère
      // AUCUNE commission : le champ reste vide.
      commercial: (d.par_role === "commercial" || d.par_role === "technicien") ? d.par : null,
      responsable: null,
      rabais: 0,
      boutique,
      vendeur_cible: null,
      articles: d.panier || [],
      client: moi.nom_base || profile.nom,
      tel: moi.tel || "",
      remise: d.remise || 0,
      remise_pct: d.pct_remise || 0,
      paiement: PAIEMENTS[0],
      statut: "en_attente",
      // Le lien avec le devis : c'est ce qui permettra de créer la fiche
      // d'installation au moment de l'encaissement.
      origine_devis: { client_id: profile.id, devis_id: d.id, par_id: d.par_id, par_role: d.par_role },
    };

    // Le prospect correspondant porte désormais un badge : les commerciaux voient
    // d'un coup d'œil qui a dit oui mais n'a pas encore payé. C'est LA file à relancer.
    const monTel = chiffresTel(moi.tel || "");
    const prospectsMaj = (db.prospects || []).map((pr) => {
      const correspond = pr.client_user_id === profile.id
        || (monTel.length >= 6 && chiffresTel(pr.tel) === monTel);
      return correspond && !pr.converti
        ? { ...pr, devis_valide: true, devis_total: d.total, devis_boutique: boutique, devis_valide_le: today(), maj_le: today() }
        : pr;
    });

    save({
      ...db,
      commandes: [commande, ...(db.commandes || [])],
      prospects: prospectsMaj,
      users: db.users.map((u) => (u.id === profile.id
        ? { ...u, devis: (u.devis || []).map((x) => (x.id === d.id
            ? { ...x, statut: "valide", boutique_paiement: boutique, boutique_adresse: infosBoutique?.adresse || "", boutique_tel: infosBoutique?.tel || "", boutique_lat: infosBoutique?.lat || null, boutique_lng: infosBoutique?.lng || null, valide_le: today(), commande_id: commande.id, ...infosContrat }
            : x)) }
        : u)),
    }, `Devis ${fmt(d.total)} VALIDÉ par le client ${profile.nom} — paiement prévu à ${boutique}`);

    uAlert(`✅ Merci ! Votre devis est validé.\n\nPassez à la boutique ${boutique} pour régler.${localisation}${lienCarte}${telBoutique}\nLe vendeur vous attend.\n\nDès votre paiement, nous programmerons votre installation.`);
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
          <button onClick={parrainer} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">🤝 Parrainer</button>
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
                          Validez-le, et choisissez la boutique où vous passerez régler. Le vendeur y sera prévenu. <b>Votre installation sera programmée dès votre paiement.</b>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2 items-end">
                          <Field label="Boutique où je vais payer">
                            <select className={inputCls} value={bqPaiement[d.id] || ""} onChange={(e) => setBqPaiement({ ...bqPaiement, [d.id]: e.target.value })}>
                              <option value="">— Choisir la boutique —</option>
                              {boutiquesVente(db).map((b) => <option key={b.nom} value={b.nom}>{b.nom}</option>)}
                            </select>
                          </Field>
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
              const chefEntree = (fiche.equipe || []).find((e) => e.chef);
              const chefUser = chefEntree ? db.users.find((u) => u.id === chefEntree.user_id) : null;
              if (!chefUser) return null;
              return (
                <div className="mt-3 rounded-xl p-3 bg-white border border-slate-200 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">Chef d'équipe</div>
                    <div className="text-sm font-bold mt-0.5">👷 {chefUser.nom}</div>
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
                <div className="text-sm text-slate-600 bg-white border border-amber-200 rounded-lg px-3 py-2">
                  📲 Un lien de réception sécurisé vous a été envoyé par WhatsApp, pour signer directement depuis votre téléphone. Si vous ne l'avez pas reçu, contactez BMI Togo.
                </div>
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
        const estSolaire = d.type_devis !== "garage" && d.type_devis !== "autre";
        const montantAcompte = Number(d.montant_acompte ?? d.total);
        const pctAcompteAffiche = Number(d.pct_acompte ?? 100);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5">
              <div className="text-center mb-3">
                <div className="font-bold text-lg text-sky-900">CONTRAT DE FOURNITURE D'INSTALLATION{d.type_devis === "garage" ? " D'UN SYSTEME DE MOTORISATION" : d.type_devis === "autre" ? "" : " D'UN SYSTEME SOLAIRE PHOTOVOLTAIQUE"}</div>
                <div className="text-xs text-slate-400">E-mail : info@bmitogo.com · NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523</div>
              </div>
              <div className="text-sm text-slate-700 space-y-2 mb-4">
                <p>Date : {dFR(today())}</p>
                <p>Entre les soussignés :</p>
                <p>BMI (Bâtiments Modernes et Intelligents) E-mail : info@bmitogo.com ; NIF : 1001790098 · RCCM : TG-LFW-01-2022-A10-01523 ; représenté par Mr EGBAOU Essozimna</p>
                <p>Et :</p>
                <p>Mr/Mme : {profile.nom}{profile.tel ? `, tél. ${profile.tel}` : ""}</p>
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
              </div>
              <div className="text-xs font-semibold text-slate-600 mb-1">Votre signature :</div>
              <canvas ref={canvasRef} width={440} height={120} className="w-full border-2 border-slate-300 rounded-lg touch-none bg-slate-50"
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
    </div>
  );
}
