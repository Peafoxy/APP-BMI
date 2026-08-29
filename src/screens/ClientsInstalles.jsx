// ============================================================
// screens/ClientsInstalles.jsx — Parc client : dossiers de chantier
// (photos compressées, garantie), réception des travaux (cycle
// en cours → terminé → réceptionné/réserves), frais d'installation
// répartis entre techniciens avec part majorée du chef de chantier.
// ============================================================
import { useState, Fragment } from "react";
import { Clients } from "../screens/Clients";
import { CarteChoixPosition } from "../components/Carte";
import { chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, motDePasseConnu, envoyerIdentifiantsWhatsApp, fabriquerCompteClient, messagesNouveauClient, ADRESSE_APP } from "../lib/comptesClients";
import { TYPES_INSTALLATION } from "../lib/constants";
import { uid, normPaiement, lignesVente, totalVente, fmt, today, dFR, col, compresserPhoto, genererJetonSignature, telDigits } from "../lib/core";
import { imprimerPV } from "../lib/impression";
import { Field, inputCls, Panel, uAlert, uConfirm, uPrompt, uChoix, Info } from "../components/ui";
import { choisirBoutiqueDebitG, messagesNotifSortieCaisse, boutiquesVente, bloquerSiLecture, statutChantier, debloquerCommissionsReception, construirePaiementPrime, primeDejaPayee, resteAPayer, memeNumero, marqueEspace, chantiersDeMonEspace, boutiqueDuChantier, estBoutiqueFormation, voitLesDeuxEspaces, techniciensDeLEspace, espaceDuChantier } from "../lib/calculs";

// ============ FRAIS D'INSTALLATION ============
// Les frais facturés au client sont répartis entre les techniciens présents sur le
// chantier. Le CHEF DU CHANTIER (désigné par l'administrateur, chantier par chantier)
// prend une part majorée : sa part de chef, PLUS une part du solde partagé.
const PART_CHEF_DEFAUT = 40;

// Qui peut intervenir sur un chantier

// ============ DOSSIER DE CHANTIER ============
const MAX_PHOTOS = 6;

// Fin de garantie = date d'installation + N mois
const finGarantie = (c) => {
  if (!c.date_installation || !c.garantie_mois) return null;
  const d = new Date(c.date_installation);
  d.setMonth(d.getMonth() + Number(c.garantie_mois));
  return d.toISOString().slice(0, 10);
};
const garantieActive = (c) => {
  const f = finGarantie(c);
  return f ? f >= today() : false;
};

// ============ RÉCEPTION DES TRAVAUX ============
// Cycle : en cours → le CHEF DE CHANTIER marque « Terminé » → le CLIENT
// réceptionne (ou émet des réserves). Tant que le client n'a pas réceptionné,
// le chantier n'est pas clos : c'est la protection des deux parties.
const STATUT_CHANTIER = {
  en_cours: { label: "🔧 En cours", couleur: "text-slate-600 bg-slate-100 border-slate-200" },
  termine: { label: "⏳ Terminé — en attente du client", couleur: "text-amber-700 bg-amber-50 border-amber-200" },
  receptionne: { label: "✅ Réceptionné par le client", couleur: "text-green-700 bg-green-50 border-green-200" },
  reserves: { label: "⚠ Réserves émises par le client", couleur: "text-red-700 bg-red-50 border-red-200" },
};
const chefDuChantier = (c) => (c.equipe || []).find((e) => e.chef);
// Le chef de CE chantier, ou l'administrateur, peut le déclarer terminé.
const peutTerminer = (c, profile, isAdmin) =>
  statutChantier(c) === "en_cours" && (isAdmin || chefDuChantier(c)?.user_id === profile.id);

const techniciensActifs = (db) => (db.users || []).filter((u) => {
  if (u.actif === false) return false;
  if (!["technicien", "technicien_bmi"].includes(u.role)) return false;
  // Le technicien BMI est salarié : toujours affectable. Seul le technicien
  // COMMISSION peut se retirer en se déclarant indisponible.
  if (u.role === "technicien" && u.indisponible === true) return false;
  return true;
});

// Calcule la répartition proposée : chef = part_chef + une part égale du reste.
// ⚠ Les parts étaient arrondies CHACUNE au dixième, sans jamais vérifier leur
// somme. Avec 7 ou 9 techniciens (60 / 7 = 8,571… → 8,6) le total montait à
// 100,2 ou 100,3 % : BMI distribuait plus que les frais facturés au client,
// et l'ancienne tolérance de 100,5 % laissait passer l'écart en silence.
// On arrondit maintenant les parts des NON-CHEFS, et le chef reçoit le reste
// exact — la somme fait toujours 100 %, au centième près.
function repartitionProposee(equipeIds, chefId, partChef) {
  const n = equipeIds.length;
  if (!n) return {};
  const reste = Math.max(0, 100 - Number(partChef || 0));
  const partEgale = Math.round((reste / n) * 10) / 10;
  const r = {};
  let distribue = 0;
  equipeIds.forEach((id) => {
    if (id === chefId) return;
    r[id] = partEgale;
    distribue += partEgale;
  });
  const chef = equipeIds.includes(chefId) ? chefId : equipeIds[0];
  r[chef] = Math.round((100 - distribue) * 100) / 100;
  return r;
}

const fraisRepartis = (c) => (c.equipe || []).reduce((s, e) => s + Number(e.montant || 0), 0);

// ============ CLIENTS INSTALLÉS (parc client) ============

export function ClientsInstalles({ db, save, profile, isAdmin }) {
  const estChef = !!profile.chef_equipe;
  const estTechnicien = profile.role === "technicien";
  // Un technicien voyait TOUT auparavant (au même titre qu'un chef d'équipe
  // ou un admin) — demande Timo : il ne doit voir que SES PROPRES dossiers
  // (créés par lui) et ceux où il intervient réellement (présent dans
  // l'équipe du chantier). Le chef d'équipe et l'admin gardent leur vue
  // complète, inchangée.
  const voitTout = isAdmin || estChef;

  const vide = { nom: "", prenom: "", tel: "", type_installation: TYPES_INSTALLATION[0], date_installation: today(), date_entretien: "", localisation: "", adresse_contrat: "", lat: null, lng: null, user_id: "", vente_id: "", garantie_mois: "24", equipe_prevue: [], chef_prevu: "", materiel: [] };
  const [f, setF] = useState(vide);
  const [carteOuverte, setCarteOuverte] = useState(false);
  const [q, setQ] = useState("");
  const [filtreEntretien, setFiltreEntretien] = useState(false);

  // Comptes de rôle "client" pas encore rattachés à une fiche (pour lier un accès à l'app)
  const comptesClientsLibres = db.users.filter((u) => u.role === "client" && u.actif !== false && !(db.clients_installes || []).some((c) => c.user_id === u.id));

  // ---- CRÉER UN COMPTE CLIENT SUR PLACE ----
  // Tout employé peut créer un compte CLIENT — et RIEN d'autre. Le rôle est
  // imposé dans le code : impossible de fabriquer un vendeur ou un admin par ce
  // chemin. C'est ce qui permet au technicien ou au vendeur, face au client,
  // de lui ouvrir son espace immédiatement.
  // UNE SEULE règle d'identifiants dans toute l'application (fabriquerCompteClient) :
  // nom + téléphone suffisent, le mot de passe est CALCULÉ — donc recalculable,
  // donc renvoyable au client à tout moment sans jamais être stocké en clair.
  const creerCompteClient = async () => {
    if (bloquerSiLecture(db, profile)) return;

    const nom = (f.nom || "").trim();
    const tel = (f.tel || "").trim();
    if (!nom || chiffresTel(tel).length < 4) {
      uAlert("Renseignez d'abord le NOM et le NUMÉRO du client dans la fiche.\n\nLe mot de passe en est déduit automatiquement.");
      return;
    }

    const identifiant = identifiantClient(db, nom, tel);
    const { motDePasse } = await resoudreMotDePasseClient(db, nom, tel);
    if (!await uConfirm(
      `Créer le compte client de ${nom.toUpperCase()} ?\n\n` +
      `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
      `Remettez-lui ces identifiants : c'est avec eux qu'il suivra son installation et réceptionnera les travaux.`
    )) return;

    const { user } = await fabriquerCompteClient(db, nom, tel, profile.nom, marqueEspace(db, profile));
    save({ ...db, users: [...db.users, user], messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])] }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}`);
    setF((p) => ({ ...p, user_id: user.id }));
    // Envoi automatique des identifiants par WhatsApp.
    if (await uConfirm(`✅ Compte créé.\n\n👤 ${identifiant}\n🔑 ${motDePasse}\n\nEnvoyer ces identifiants au client par WhatsApp ?`)) {
      envoyerIdentifiantsWhatsApp(nom, identifiant, motDePasse, tel);
    }
  };

  // ---- MATÉRIEL POSÉ ----
  const [mat, setMat] = useState({ nom: "", qte: "", serie: "" });

  // Reprend automatiquement les articles de la vente rattachée : plus de double saisie.
  // ⚠ CORRECTIF : avant, cette fonction préremplissait juste le nom/téléphone
  // en texte libre, SANS JAMAIS chercher si un compte client existait déjà —
  // d'où le message « aucun compte rattaché » même quand le client avait
  // bel et bien un compte, simplement parce que personne ne l'avait
  // sélectionné à la main dans le menu déroulant plus bas.
  const chargerDepuisVente = (venteId) => {
    const v = db.ventes.find((x) => x.id === venteId);
    if (!v) { setF((p) => ({ ...p, vente_id: "" })); return; }
    const lignes = lignesVente(v).map((l) => ({ nom: l.article, qte: Number(l.qte), serie: "" }));
    const telVente = chiffresTel(v.tel);
    const motsNom = (v.client || "").trim().split(/\s+/).filter(Boolean);
    // On cherche un compte "client" déjà existant correspondant à cette vente :
    // d'abord par téléphone (le plus fiable), puis par nom si pas de téléphone.
    const compteTrouve = db.users.find((u) => u.role === "client" && u.actif !== false && (
      // ⚠ memeNumero (audit du 29/08/2026) : avec les chiffres bruts, un
      // numéro noté avec l'indicatif ne retrouvait pas son compte — et le
      // client ne voyait jamais son installation dans son espace.
      (telVente.length >= 6 && memeNumero(u.tel, v.tel))
      || (v.client && (u.nom_complet || u.nom_base || u.nom || "").trim().toLowerCase() === v.client.trim().toLowerCase())
    ));
    setF((p) => ({
      ...p,
      vente_id: venteId,
      materiel: lignes,
      prenom: p.prenom || (motsNom.length > 1 ? motsNom.slice(0, -1).join(" ") : ""),
      nom: p.nom || (motsNom.length ? motsNom.slice(-1)[0] : ""),
      tel: p.tel || v.tel || "",
      user_id: p.user_id || compteTrouve?.id || "",
    }));
  };

  const ajouterMateriel = () => {
    if (!mat.nom.trim()) { uAlert("Indiquez le matériel."); return; }
    const q = Number(mat.qte) || 1;
    setF((p) => ({ ...p, materiel: [...(p.materiel || []), { nom: mat.nom.trim(), qte: q, serie: mat.serie.trim() }] }));
    setMat({ nom: "", qte: "", serie: "" });
  };

  // ---- ÉQUIPE PRÉVUE (avant le chantier) ----
  const basculerTechPrevu = (id) => {
    setF((p) => {
      const eq = (p.equipe_prevue || []).includes(id)
        ? p.equipe_prevue.filter((x) => x !== id)
        : [...(p.equipe_prevue || []), id];
      const chef = eq.includes(p.chef_prevu) ? p.chef_prevu : (eq[0] || "");
      return { ...p, equipe_prevue: eq, chef_prevu: chef };
    });
  };

  // ---- PHOTOS DU CHANTIER ----
  const ajouterPhoto = async (c, fichier) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!fichier) return;
    if ((c.photos || []).length >= MAX_PHOTOS) { uAlert(`Maximum ${MAX_PHOTOS} photos par chantier.`); return; }
    try {
      const data = await compresserPhoto(fichier);
      const photo = { id: uid(), data, par: profile.nom, date: today() };
      save({
        ...db,
        clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, photos: [...(x.photos || []), photo] } : x)),
      }, `Photo ajoutée au chantier ${c.nom} ${c.prenom} (par ${profile.nom})`);
    } catch (e) {
      uAlert("Photo illisible : " + e.message);
    }
  };

  const supprimerPhoto = async (c, photoId) => {
    if (!await uConfirm("Supprimer cette photo ?")) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, photos: (x.photos || []).filter((p) => p.id !== photoId) } : x)),
    }, `Photo supprimée — chantier ${c.nom}`);
  };

  // ---- 🎁 OFFRIR UN CADEAU (administrateur uniquement) ----
  // Le client est prévenu DANS SON ESPACE, et par un message. Il vient le chercher
  // en boutique — c'est aussi une occasion de le revoir.
  const offrirCadeau = async (c) => {
    if (!isAdmin) return;
    if (c.cadeau && !c.cadeau.retire) {
      if (!await uConfirm(`Un cadeau est déjà en attente pour ${c.prenom} ${c.nom}.\n\nLe remplacer ?`)) return;
    }

    const quoi = await uPrompt(`🎁 Cadeau pour ${c.prenom} ${c.nom}\n\nQue lui offrez-vous ?\n(ex : une lampe solaire, un bon d'entretien gratuit...)`, "");
    if (quoi === null || !quoi.trim()) return;

    const bqs = boutiquesVente(db).map((b) => b.nom);
    if (bqs.length === 0) { uAlert("Aucune boutique enregistrée."); return; }
    const ou = await uPrompt(`Où doit-il venir le récupérer ?\n\n(${bqs.join(" / ")})`, bqs[0]);
    if (ou === null) return;
    const boutique = bqs.find((b) => b.toLowerCase() === String(ou).trim().toLowerCase());
    if (!boutique) { uAlert("Boutique inconnue."); return; }

    const cadeau = {
      id: uid(), date: today(), par: profile.nom,
      quoi: quoi.trim(), boutique, retire: false,
    };

    // Le message : il le verra même s'il ne regarde pas sa fiche.
    const message = c.user_id ? {
      id: uid(), date: today(), ts: new Date().toISOString(),
      de_id: profile.id, de_nom: profile.nom,
      canal: "support", client_id: c.user_id,
      texte: `🎁 Bonne nouvelle ! BMI Togo vous offre : ${quoi.trim()}.\n\nPassez le récupérer à la boutique ${boutique}. À très bientôt !`,
      lu_par: [profile.id],
    } : null;

    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, cadeau } : x)),
      messages: message ? [message, ...(db.messages || [])] : (db.messages || []),
    }, `🎁 Cadeau « ${quoi.trim()} » offert à ${c.prenom} ${c.nom} — à retirer à ${boutique}`);

    uAlert(c.user_id
      ? `🎁 C'est fait.\n\n${c.prenom} ${c.nom} voit le cadeau dans son espace client et a reçu un message.`
      : `🎁 Cadeau enregistré.\n\n⚠ Ce client n'a PAS de compte : il ne sera pas prévenu automatiquement. Appelez-le.`);
  };

  const marquerRetire = async (c) => {
    if (!isAdmin) return;
    if (!await uConfirm(`Confirmer que ${c.prenom} ${c.nom} a bien récupéré son cadeau ?`)) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, cadeau: { ...x.cadeau, retire: true, retire_le: today() } }
        : x)),
    }, `🎁 Cadeau retiré par ${c.prenom} ${c.nom}`);
  };

  // ---- OBSERVATIONS DU TECHNICIEN ----
  const ecrireObservation = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    const txt = await uPrompt(`Observation du technicien — ${c.prenom} ${c.nom}\n\n(matériel particulier, difficulté rencontrée, conseil au client...)`, "");
    if (txt === null || !txt.trim()) return;
    const obs = { id: uid(), date: today(), par: profile.nom, texte: txt.trim() };
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, observations: [obs, ...(x.observations || [])] } : x)),
    }, `Observation ajoutée — chantier ${c.nom} ${c.prenom}`);
  };

  // Le dossier détaillé, ouvert fiche par fiche
  const [dossierOuvert, setDossierOuvert] = useState(null);

  const ajouter = async () => {
    if (!f.nom.trim() || !f.tel.trim()) { uAlert("Le nom et le numéro du client sont obligatoires."); return; }
    // Sans compte rattaché, le client ne pourra JAMAIS réceptionner les travaux.
    // On le signale maintenant, pas à la fin du chantier.
    if (!f.user_id) {
      const ok = await uConfirm(
        `⚠ Aucun compte client rattaché.\n\n${f.prenom} ${f.nom} ne pourra pas réceptionner les travaux depuis l'application : le bouton n'apparaîtra pas chez lui.\n\nPour lui créer un compte : 👥 Utilisateurs → rôle « Client ».\n\nCréer quand même la fiche sans compte ?`
      );
      if (!ok) return;
    }
    // L'équipe prévue devient l'équipe du chantier. Les montants restent à 0 :
    // ils seront calculés plus tard, quand l'administrateur répartira les frais.
    const equipe = (f.equipe_prevue || []).map((id) => {
      const u = db.users.find((x) => x.id === id);
      return { user_id: id, nom: u ? u.nom : "?", chef: id === f.chef_prevu, pct: 0, montant: 0, paye: false };
    });
    const c = {
      id: uid(), date: today(),
      commercial: profile.role === "admin" ? (f.commercial || null) : profile.nom,
      ...f, user_id: f.user_id || null, statut: "en_cours",
      equipe, garantie_mois: Number(f.garantie_mois || 0),
    };
    delete c.equipe_prevue; delete c.chef_prevu;
    save({ ...db, clients_installes: [c, ...(db.clients_installes || [])] }, `Nouveau client installé « ${f.prenom} ${f.nom} » (${f.type_installation})`);
    setF(vide);
    setCarteOuverte(false);
  };

  const supprimer = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin && c.commercial !== profile.nom) { uAlert("Seul l'administrateur ou le commercial rattaché peut supprimer cette fiche."); return; }
    // ⚠ Supprimer un chantier dont des primes ont été PAYÉES laisse en caisse
    // des dépenses qui ne se rattachent plus à rien : impossible de savoir à
    // quoi correspond la sortie d'argent, ni de l'annuler proprement.
    const primesPayees = (c.equipe || []).filter((e) => e.paye && Number(e.montant || 0) > 0);
    if (primesPayees.length) {
      uAlert(
        `Suppression impossible : ${primesPayees.length} prime(s) d'installation ont déjà été payées sur ce chantier ` +
        `(${fmt(primesPayees.reduce((s, e) => s + Number(e.montant || 0), 0))} au total).\n\n` +
        `Supprimer la fiche laisserait ces sorties d'argent en caisse sans plus rien à quoi les rattacher.\n\n` +
        `➡ Si ce chantier est une erreur, annulez d'abord les paiements depuis 📤 Dépenses, puis revenez ici.`);
      return;
    }
    // Un chantier réceptionné (a fortiori avec un PV signé) est une pièce du
    // dossier client : on ne l'efface pas par simple clic.
    const receptionne = statutChantier(c) === "receptionne";
    const enAttente = (c.equipe || []).filter((e) => e.demande_prime).length;
    const avertissements = [
      receptionne ? `⚠ Ce chantier est RÉCEPTIONNÉ${c.contrat_numero ? ` et un PV existe (${c.contrat_numero})` : ""} : c'est une pièce du dossier client.` : "",
      enAttente ? `⚠ ${enAttente} demande(s) de paiement de prime en attente chez un vendeur seront annulées.` : "",
    ].filter(Boolean).join("\n");
    if (!await uConfirm(`Supprimer la fiche de « ${c.prenom || ""} ${c.nom} » ?${avertissements ? `\n\n${avertissements}` : ""}\n\nCette suppression est définitive.`)) return;
    save({ ...db, clients_installes: db.clients_installes.filter((x) => x.id !== c.id) },
      `Suppression fiche client installé « ${c.nom} »${receptionne ? " (chantier RÉCEPTIONNÉ)" : ""} par ${profile.nom}`);
  };

  // ---- FRAIS D'INSTALLATION ----
  // L'admin saisit les frais facturés, désigne le chef DU CHANTIER, coche les
  // techniciens présents, et l'application propose la répartition.
  const [chantier, setChantier] = useState(null); // fiche en cours de répartition
  const [rep, setRep] = useState({ frais: "", chef: "", partChef: String(PART_CHEF_DEFAUT), equipe: [], pcts: {} });
  // ⚠ CLOISONNEMENT (2.100.38) — la liste des techniciens ne regardait aucun
  // espace : on pouvait affecter un VRAI technicien à un chantier
  // d'entraînement (et l'inverse). Sa part de frais était alors calculée à son
  // nom, et payable depuis une vraie caisse. C'est l'espace du CHANTIER qui
  // décide, pas celui de la personne qui regarde — sinon l'administrateur,
  // qui voit les deux, resterait libre de mélanger. Sur le formulaire de
  // création (pas encore de chantier), c'est l'espace du compte connecté.
  const tousLesTechs = techniciensActifs(db);
  const techsPour = (c) => techniciensDeLEspace(db, tousLesTechs, espaceDuChantier(db, c, profile));
  const techsMasques = (c) => tousLesTechs.filter((u) => !techsPour(c).some((x) => x.id === u.id));
  // On ne cache jamais quelqu'un en silence : si un technicien manque à
  // l'appel, l'écran dit qui, et pourquoi. Sans ça, un rattachement erroné
  // se traduirait par un nom introuvable et aucune explication.
  const noteMasques = (c) => {
    const m = techsMasques(c);
    if (!m.length) return null;
    return (
      <div className="text-xs text-amber-700 mt-2">
        🎓 {m.length} technicien(s) ne sont pas proposés ici : ils appartiennent à l'autre espace de travail — {m.map((u) => u.nom).join(", ")}.
        {" "}Si l'un d'eux devrait être disponible, corrigez son rattachement dans 👥 Utilisateurs.
      </div>
    );
  };
  // L'admin et le responsable commercial programment les chantiers.
  const peutProgrammer = isAdmin || profile.role === "resp_commercial";

  // État d'édition de la programmation, par chantier
  const [prog, setProg] = useState({}); // { [id]: { date, equipe:[], chef } }
  const progDe = (c) => prog[c.id] || {
    date: c.date_installation || "",
    equipe: (c.equipe || []).map((e) => e.user_id),
    chef: (c.equipe || []).find((e) => e.chef)?.user_id || "",
  };
  const setProgDe = (c, patch) => setProg((p) => ({ ...p, [c.id]: { ...progDe(c), ...patch } }));

  const basculerTechProg = (c, id) => {
    const p = progDe(c);
    const equipe = p.equipe.includes(id) ? p.equipe.filter((x) => x !== id) : [...p.equipe, id];
    const chef = equipe.includes(p.chef) ? p.chef : (equipe[0] || "");
    setProgDe(c, { equipe, chef });
  };

  const enregistrerProgrammation = (c) => {
    if (!peutProgrammer) return;
    const p = progDe(c);
    if (!p.date) { uAlert("Choisissez la date d'installation."); return; }
    if (p.equipe.length === 0) { uAlert("Affectez au moins un technicien."); return; }
    if (!p.chef) { uAlert("Désignez le chef d'équipe ⭐."); return; }
    const equipe = p.equipe.map((id) => {
      const u = db.users.find((x) => x.id === id);
      const ancien = (c.equipe || []).find((e) => e.user_id === id);
      return ancien ? { ...ancien, chef: id === p.chef, nom: u?.nom || ancien.nom }
                    : { user_id: id, nom: u?.nom || "?", chef: id === p.chef, pct: 0, montant: 0, paye: false };
    });

    // Notifie chaque membre nouvellement affecté (ou dont le rôle chef/date a
    // changé) — pas de rappel en double si l'équipe était déjà inchangée.
    const idsAvant = new Set((c.equipe || []).map((e) => e.user_id));
    const dateAvant = c.date_installation || "";
    const dateAChange = dateAvant !== p.date;
    const nouveauxMembres = equipe.filter((e) => !idsAvant.has(e.user_id) || dateAChange);
    const messagesNotif = nouveauxMembres.map((e) => ({
      id: uid(),
      date: today(),
      ts: new Date().toISOString(),
      de_id: profile.id,
      de_nom: profile.nom,
      a_id: e.user_id,
      lu_par: [profile.id],
      texte: `📅 Vous avez été affecté${e.chef ? " comme chef d'équipe ⭐" : ""} à l'installation de ${c.prenom} ${c.nom} le ${dFR(p.date)}${c.localisation ? ` (${c.localisation})` : ""}.`,
    }));

    // Le CLIENT aussi doit savoir — surtout s'il avait émis des réserves et
    // attend un passage de rattrapage. Sans ce message, il n'avait aucun moyen
    // de savoir qu'une date (nouvelle ou changée) venait d'être fixée.
    const messageClient = (c.user_id && dateAChange) ? [{
      id: uid(),
      date: today(),
      ts: new Date().toISOString(),
      de_id: profile.id,
      de_nom: profile.nom,
      a_id: c.user_id,
      lu_par: [profile.id],
      texte: dateAvant
        ? `📅 La date de votre installation a été mise à jour : ${dFR(p.date)}${c.localisation ? ` (${c.localisation})` : ""}.`
        : `📅 Votre installation est programmée le ${dFR(p.date)}${c.localisation ? ` (${c.localisation})` : ""}.`,
    }] : [];

    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, date_installation: p.date, equipe, a_programmer: false }
        : x)),
      messages: [...messagesNotif, ...messageClient, ...(db.messages || [])],
    }, `📅 Installation de ${c.prenom} ${c.nom} programmée le ${dFR(p.date)} — chef ${db.users.find((u) => u.id === p.chef)?.nom || "?"}`);
    uAlert(`✅ Installation programmée le ${dFR(p.date)}.\n\nLe chef d'équipe pourra marquer les travaux terminés le jour venu.${messagesNotif.length ? `\n\n${messagesNotif.length} membre(s) de l'équipe ont été notifiés par message.` : ""}${messageClient.length ? `\nLe client a aussi été prévenu par message.` : ""}`);
  };

  // ---- LE CHEF DE CHANTIER DÉCLARE LES TRAVAUX TERMINÉS ----
  // ⚠ Demande Timo : le message envoyé par WhatsApp propose maintenant DEUX
  // façons de signer — directement dans l'app (avec les identifiants du
  // client, si un compte existe) OU via le lien externe sans compte, comme
  // avant. Le mot de passe n'est JAMAIS stocké en clair : motDePasseConnu()
  // le RECALCULE de façon déterministe (comptesClients.js) — s'il renvoie
  // null (compte changé de mot de passe manuellement, ou pas de compte du
  // tout), seul le lien externe est proposé, sans bloc identifiants.
  const construireMessagePv = (c, lien) => {
    const compte = c.user_id ? (db.users || []).find((u) => u.id === c.user_id) : null;
    const mdp = compte ? motDePasseConnu(compte) : null;
    const intro = `Bonjour ${c.prenom || ""} ${c.nom},\n\nVos travaux d'installation (${c.type_installation}) sont terminés. Merci de confirmer la réception en signant le procès-verbal.`;
    if (compte && mdp) {
      return `${intro}\n\n👉 Directement depuis votre espace client sur ${ADRESSE_APP} :\n👤 Identifiant : *${compte.nom}*\n🔑 Mot de passe : *${mdp}*\n\n👉 Ou sans compte, en cliquant sur ce lien :\n${lien}\n\nBMI Togo`;
    }
    return `${intro}\n\n${lien}\n\nBMI Togo`;
  };

  const genererEtEnvoyerLienPv = (c) => {
    const jeton = genererJetonSignature();
    const numero = `PV-${today().slice(0, 4)}-${c.id.slice(0, 6).toUpperCase()}`;
    const lien = `https://bmitogo.com/signature/${jeton}`;
    return { jeton, numero, texte: construireMessagePv(c, lien) };
  };

  // ⚠ Demande Timo : dès que le chantier passe « terminé », le lien de
  // signature part AUTOMATIQUEMENT par WhatsApp — plus besoin du clic
  // séparé « Envoyer pour signature » (qui reste disponible juste après,
  // pour un RENVOI si le premier message a été perdu ou mal envoyé). Ce
  // geste étant désormais déclenché par la même personne qui termine le
  // chantier (souvent un technicien, pas forcément l'admin), la
  // restriction « admin seulement » ne s'applique qu'au bouton de renvoi
  // manuel ci-dessous, jamais à cet envoi automatique.
  const marquerTermine = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm(
      `Déclarer l'installation de ${c.nom} ${c.prenom} TERMINÉE ?\n\n` +
      `Le lien de signature du PV sera envoyé automatiquement au client par WhatsApp, juste après.`
    )) return;
    const champs = { statut: "termine", termine_par: profile.nom, date_fin: today() };
    if (!c.adresse_contrat || !c.tel) {
      save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, ...champs } : x)) },
        `Installation ${c.nom} ${c.prenom} déclarée TERMINÉE par ${profile.nom}`);
      uAlert(`✅ Travaux déclarés terminés.\n\n⚠ Le lien de signature n'a PAS pu être envoyé automatiquement : ${!c.adresse_contrat ? "l'« Adresse formelle (pour le PV) »" : "le numéro de téléphone"} manque sur la fiche. Renseignez-le, puis utilisez « Envoyer pour signature ».`);
      return;
    }
    const { jeton, numero, texte } = genererEtEnvoyerLienPv(c);
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, ...champs, contrat_jeton: jeton, contrat_jeton_le: new Date().toISOString(), contrat_numero: numero, contrat_statut: "attente_signature" }
        : x)),
    }, `Installation ${c.nom} ${c.prenom} déclarée TERMINÉE par ${profile.nom} — lien de signature envoyé automatiquement (${numero})`);
    window.open(`https://wa.me/${telDigits(c.tel)}?text=${encodeURIComponent(texte)}`, "_blank");
    uAlert("✅ Travaux déclarés terminés. Le lien de signature vient de s'ouvrir dans WhatsApp.");
  };

  // ---- ENVOI DU LIEN DE SIGNATURE (contrat de réception) ----
  // Remplace l'ancien circuit "réception dans l'app" : désormais le SEUL
  // chemin normal vers "Réceptionné"/"Réserves" passe par la signature du
  // client sur bmitogo.com (jeton unique, aucun compte requis). Demande
  // Timo, "carte blanche" puis précisions successives. Sert maintenant de
  // RENVOI manuel — l'envoi initial est automatique (voir marquerTermine).
  const envoyerPourSignature = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin) { uAlert("Seul l'administrateur envoie le lien de signature."); return; }
    if (!c.adresse_contrat) { uAlert("Merci de renseigner l'« Adresse formelle (pour le PV) » sur la fiche de ce chantier avant d'envoyer le lien de signature."); return; }
    if (!c.tel) { uAlert("Aucun numéro de téléphone enregistré pour ce client."); return; }
    const { jeton, numero, texte } = genererEtEnvoyerLienPv(c);
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, contrat_jeton: jeton, contrat_jeton_le: new Date().toISOString(), contrat_numero: numero, contrat_statut: "attente_signature" }
        : x)),
    }, `Lien de signature du PV envoyé — ${c.nom} ${c.prenom || ""} (${numero})`);
    window.open(`https://wa.me/${telDigits(c.tel)}?text=${encodeURIComponent(texte)}`, "_blank");
  };

  // ⚠ « Pose seule » (demande Timo) : le règlement de la main d'œuvre se
  // fait APRÈS les travaux, en un ou plusieurs versements — jamais figé en
  // un seul geste, exactement comme une dette classique. Réutilise ici la
  // MÊME mécanique que Dettes.jsx (resteAPayer, tableau paiements) plutôt
  // que d'en recréer une séparée. Visible : le chef d'équipe du chantier
  // (encaissement sur le terrain, caisse TERRAIN) OU tout vendeur/
  // responsable commercial/admin (cas rare : client venu payer en
  // boutique — l'argent tombe alors dans LEUR caisse, pas TERRAIN).
  const peutEncaisserPose = (c) =>
    chefDuChantier(c)?.user_id === profile.id
    || ["vendeur", "resp_commercial", "admin"].includes(profile.role);

  const encaisserPose = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    const dette = (db.dettes || []).find((x) => x.id === c.dette_id);
    if (!dette) { uAlert("Aucun encaissement en attente pour ce chantier."); return; }
    const reste = resteAPayer(dette);
    if (reste <= 0) { uAlert("Ce chantier est déjà entièrement réglé."); return; }
    const enBoutique = profile.role !== "technicien" && profile.role !== "technicien_bmi";
    // ⚠ Bug trouvé par Timo (capture) : un admin (ou resp_commercial) n'est
    // rattaché à AUCUNE boutique précise (`profile.boutique` vaut null) —
    // le code prenait alors silencieusement la PREMIÈRE boutique de la
    // liste, sans jamais demander. Corrigé : on lui demande explicitement.
    // Un vendeur, lui, reste rattaché à sa boutique — pas de question.
    let boutiqueEncaissement = enBoutique ? profile.boutique : dette.boutique;
    if (enBoutique && !boutiqueEncaissement) {
      boutiqueEncaissement = await uChoix("Encaissé dans quelle boutique ?", boutiquesVente(db).map((b) => b.nom));
      if (!boutiqueEncaissement) return;
    }
    const s = await uPrompt(`Montant reçu de ${c.nom} (F) — reste dû : ${fmt(reste)}`, String(reste || ""));
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    if (m > reste) { uAlert(`Le montant dépasse le reste dû (${fmt(reste)}).`); return; }
    const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
    if (moyen === null) return;
    // Le libellé nomme la caisse RÉELLEMENT utilisée : sur le terrain c'est
    // celle de la dette — TERRAIN, sa jumelle d'entraînement « TERRAIN
    // (formation) » pour un chantier de formation (lot 2 Espace client), ou
    // une boutique si un versement précédent y a déjà déplacé la dette.
    if (!await uConfirm(`Confirmer le versement de ${fmt(m)} de ${c.nom} ?\n\n${enBoutique ? `Encaissé en boutique (${boutiqueEncaissement}).` : `Encaissé sur le terrain (caisse ${boutiqueEncaissement}).`}`)) return;
    const paiement = { id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), montant: m, paiement: normPaiement(moyen), par: profile.nom };
    // Le versement change la boutique de la dette UNIQUEMENT s'il vient
    // d'être payé en boutique cette fois-ci — chaque versement peut donc
    // provenir d'un endroit différent (terrain puis boutique, ou l'inverse).
    const detteApres = { ...dette, boutique: boutiqueEncaissement, paye: Number(dette.paye) + m, paiements: [...(dette.paiements || []), paiement] };
    save({ ...db, dettes: db.dettes.map((x) => (x.id === dette.id ? detteApres : x)) },
      `Versement pose seule ${fmt(m)} de ${c.nom} — ${boutiqueEncaissement} (${enBoutique ? "boutique" : "terrain"})`);
    uAlert("✅ Versement enregistré !");
  };

  // BMI constate la réception SANS AUCUNE SIGNATURE (cas exceptionnel —
  // client injoignable, refus catégorique). Volontairement dissuasif :
  // confirmation explicite + trace PERMANENTE et visible sur la fiche
  // ensuite (pas juste un message qui disparait). Demande Timo.
  const forcerReceptionSansSignature = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin) return;
    if (!await uConfirm(
      `⚠ Vous êtes sur le point de marquer ce chantier « Réceptionné » SANS SIGNATURE du client.\n\n` +
      `Aucun PV n'existera pour cette installation. Cette exception doit rester rare.\n\n` +
      `Confirmez-vous vraiment vouloir continuer ?`
    )) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, statut: "receptionne", receptionne_le: today(), receptionne_par: `BMI — forcé par ${profile.nom}`, contrat_force_par: profile.nom, contrat_force_le: today() }
        : x)),
      ...debloquerCommissionsReception(db, c.vente_id, `forcée par BMI (${profile.nom}), sans signature`),
    }, `⚠ Réception FORCÉE sans signature par ${profile.nom} — ${c.nom} ${c.prenom || ""}`);
    uAlert("⚠ Réception forcée sans signature — cette exception reste visible en permanence sur la fiche.");
  };


  // Une fois les réserves corrigées : un AVENANT (pas un nouveau contrat
  // entier) est signé par le client, référençant le contrat initial. Une
  // fois SIGNÉ (par le site, pas ici), le statut passera enfin à
  // "receptionne" définitif. Demande Timo.
  const envoyerAvenant = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin) return;
    if (!await uConfirm(`Les réserves de ${c.nom} ${c.prenom} ont-elles bien été corrigées ?\n\nUn nouveau lien de signature (avenant de levée de réserves, référençant le PV ${c.contrat_numero || "initial"}) sera envoyé au client.`)) return;
    const jeton = genererJetonSignature();
    const lien = `https://bmitogo.com/avenant/${jeton}`;
    const texte = `Bonjour ${c.prenom || ""} ${c.nom},\n\nLes réserves signalées sur votre installation ont été corrigées. Merci de confirmer en signant l'avenant, directement depuis votre téléphone :\n\n${lien}\n\nBMI Togo`;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, avenant_jeton: jeton, avenant_jeton_le: new Date().toISOString(), avenant_statut: "attente_signature", reserves_levees_le: today(), reserves_levees_par: profile.nom }
        : x)),
    }, `Avenant de levée de réserves envoyé — ${c.nom} ${c.prenom} (par ${profile.nom})`);
    window.open(`https://wa.me/${telDigits(c.tel)}?text=${encodeURIComponent(texte)}`, "_blank");
  };

  const ouvrirRepartition = (c) => {
    if (!isAdmin) { uAlert("Seul l'administrateur répartit les frais d'installation."); return; }
    const equipe = (c.equipe || []).map((e) => e.user_id);
    setChantier(c.id);
    setRep({
      frais: String(c.frais_installation || ""),
      chef: c.chef_id || "",
      partChef: String(c.part_chef ?? PART_CHEF_DEFAUT),
      equipe,
      pcts: Object.fromEntries((c.equipe || []).map((e) => [e.user_id, e.pct])),
    });
  };

  const basculerTech = (id) => {
    const equipe = rep.equipe.includes(id) ? rep.equipe.filter((x) => x !== id) : [...rep.equipe, id];
    const chef = equipe.includes(rep.chef) ? rep.chef : (equipe[0] || "");
    setRep((r) => ({ ...r, equipe, chef, pcts: repartitionProposee(equipe, chef, r.partChef) }));
  };

  const designerChef = (id) => setRep((r) => ({ ...r, chef: id, pcts: repartitionProposee(r.equipe, id, r.partChef) }));
  const changerPartChef = (v) => setRep((r) => ({ ...r, partChef: v, pcts: repartitionProposee(r.equipe, r.chef, v) }));

  const totalPct = Object.values(rep.pcts).reduce((s, v) => s + Number(v || 0), 0);
  const fraisRep = Number(rep.frais || 0);

  const validerRepartition = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!fraisRep || fraisRep <= 0) { uAlert("Saisissez les frais d'installation facturés au client."); return; }
    if (!rep.equipe.length) { uAlert("Cochez au moins un technicien présent sur le chantier."); return; }
    if (!rep.chef) { uAlert("Désignez le chef du chantier."); return; }
    // Plus de tolérance à 100,5 % : au-dessus de 100, on distribue davantage
    // que les frais encaissés. L'arrondi ne peut plus créer l'écart (voir
    // repartitionProposee), il ne reste que les saisies manuelles.
    const totalArrondi = Math.round(totalPct * 10) / 10;
    if (totalArrondi > 100) { uAlert(`Le total des parts fait ${totalArrondi} % — il ne peut pas dépasser 100 %.\n\nAu-dessus de 100 %, vous verseriez aux techniciens plus que les ${fmt(fraisRep)} facturés au client.`); return; }
    // En dessous de 100 %, la différence est la PART BMI : on distribue une
    // partie des frais aux techniciens, l'entreprise garde le reste.
    // Protection des paiements : on ne réécrit pas une répartition dont des
    // parts réelles (> 0 F) ont déjà été payées.
    const partsPayees = (c.equipe || []).filter((e) => e.paye && Number(e.montant || 0) > 0);
    if (partsPayees.length) { uAlert(`Impossible de modifier : ${partsPayees.length} part(s) déjà payée(s). Les paiements effectués ne peuvent pas être effacés.`); return; }
    // ⚠ Une DEMANDE DE PAIEMENT en attente chez un vendeur disparaissait
    // silencieusement quand on refaisait la répartition : l'équipe était
    // reconstruite à neuf, sans les champs de la demande. Le vendeur voyait
    // la ligne s'évaporer de son écran « 💰 Primes remises », sans explication.
    // Désormais : une demande dont le MONTANT ne bouge pas est conservée ;
    // une demande devenue caduque est annulée, annoncée, et son vendeur prévenu.
    const annulees = [];
    const equipe = rep.equipe.map((id) => {
      const u = db.users.find((x) => x.id === id);
      const pct = Number(rep.pcts[id] || 0);
      const montant = Math.round((fraisRep * pct) / 100);
      const ancien = (c.equipe || []).find((e) => e.user_id === id);
      const base = { user_id: id, nom: u ? u.nom : "?", pct, montant, chef: id === rep.chef, paye: false };
      if (ancien?.demande_prime && Number(ancien.montant || 0) === montant) {
        return { ...base, demande_prime: true, prime_boutique: ancien.prime_boutique,
                 prime_demandee_par: ancien.prime_demandee_par, prime_demandee_le: ancien.prime_demandee_le };
      }
      if (ancien?.demande_prime) annulees.push(ancien);
      return base;
    });
    // Les membres RETIRÉS de l'équipe qui avaient une demande en cours.
    (c.equipe || []).forEach((e) => {
      if (e.demande_prime && !rep.equipe.includes(e.user_id)) annulees.push(e);
    });

    const resume = equipe.map((e) => `${e.chef ? "⭐ " : ""}${e.nom} : ${e.pct} % = ${fmt(e.montant)}`).join("\n");
    const pctBMI = Math.round((100 - totalPct) * 10) / 10;
    const ligneBMI = pctBMI > 0.5 ? `\n🏢 Part BMI (non distribuée) : ${pctBMI} % = ${fmt(Math.round((fraisRep * pctBMI) / 100))}` : "";
    const ligneAnnulees = annulees.length
      ? `\n\n⚠ ${annulees.length} demande(s) de paiement en attente seront ANNULÉES (le montant a changé ou la personne quitte le chantier) :\n${annulees.map((e) => `• ${e.nom} — ${fmt(e.montant)} chez ${e.prime_boutique}`).join("\n")}\nLes vendeurs concernés seront prévenus.`
      : "";
    if (!await uConfirm(`Répartir ${fmt(fraisRep)} de frais d'installation ?\n\n${resume}${ligneBMI}${ligneAnnulees}\n\nLes techniciens verront leur part. Le paiement se fait ensuite, technicien par technicien.`)) return;

    // Prévenir les vendeurs dont la demande disparaît de leur écran.
    const avis = annulees.flatMap((e) => (db.users || [])
      .filter((u) => u.actif !== false && u.boutique === e.prime_boutique && ["vendeur", "gerant"].includes(u.role))
      .map((u) => ({
        id: uid(), date: today(), ts: new Date().toISOString(),
        de_id: profile.id, de_nom: profile.nom, a_id: u.id, lu_par: [profile.id],
        texte: `↩ La demande de prime de ${e.nom} (${fmt(e.montant)}, chantier ${c.nom} ${c.prenom || ""}) a été annulée : la répartition des frais vient d'être refaite par ${profile.nom}. Ne la payez pas — une nouvelle demande vous sera envoyée si besoin.`,
      })));

    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, frais_installation: fraisRep, chef_id: rep.chef, part_chef: Number(rep.partChef), equipe, date_repartition: today(), par_repartition: profile.nom }
        : x)),
      ...(avis.length ? { messages: [...avis, ...(db.messages || [])] } : {}),
    }, `Frais d'installation de ${fmt(fraisRep)} répartis — chantier ${c.nom} (chef : ${equipe.find((e) => e.chef)?.nom}${pctBMI > 0.5 ? ` · part BMI ${pctBMI} %` : ""}${annulees.length ? ` · ${annulees.length} demande(s) de prime annulée(s)` : ""})`);
    setChantier(null);
    uAlert(`✅ Répartition enregistrée.${annulees.length ? `\n\n${annulees.length} demande(s) de paiement annulée(s) — les vendeurs ont été prévenus.` : ""}`);
  };

  // Paiement de la part d'un technicien, en DEUX temps (demande Timo) :
  // 1) demanderPaiementPrime — choisit la boutique qui paiera, crée une
  //    DEMANDE en attente (visible du vendeur de cette boutique-là).
  // 2) validerPaiementPrime — exécute la VRAIE sortie de caisse ; utilisable
  //    par le vendeur de la boutique concernée (plus besoin de l'admin à
  //    chaque fois), ou par l'admin directement comme avant.
  // Tout reste dans clients_installes (table déjà synchronisée) — aucune
  // nouvelle table Supabase à créer pour ce chantier.
  const demanderPaiementPrime = async (c, e) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin) { uAlert("Seul l'administrateur déclenche une demande de paiement de prime."); return; }
    if (!(Number(e.montant) > 0)) { uAlert("Cette part est de 0 F : rien à payer. Refaites la répartition avec le bon pourcentage."); return; }
    const bq = await choisirBoutiqueDebitG(db, {}, `Part d'installation de ${fmt(e.montant)} à ${e.nom}`, profile);
    if (bq === null) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, equipe: (x.equipe || []).map((y) => (y.user_id === e.user_id ? { ...y, demande_prime: true, prime_boutique: bq, prime_demandee_par: profile.nom, prime_demandee_le: today() } : y)) }
        : x)),
    }, `Demande de paiement de prime d'installation — ${e.nom} · ${fmt(e.montant)} · ${bq}`);
    uAlert(`✅ Demande envoyée. Le vendeur de ${bq} peut désormais la valider depuis son onglet « 💰 Primes remises ».`);
  };

  const validerPaiementPrime = async (c, e) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin && profile.boutique !== e.prime_boutique) { uAlert(`Seul le vendeur de ${e.prime_boutique} (ou l'administrateur) peut valider ce paiement.`); return; }
    if (primeDejaPayee(db, c, e)) { uAlert(`La part de ${e.nom} sur ce chantier a déjà été payée.\n\nRien n'a été enregistré : sans ce contrôle, la caisse aurait été débitée une seconde fois.`); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${e.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    if (!await uConfirm(`Payer ${fmt(e.montant)} à ${e.nom} pour l'installation de ${c.nom} ?\n\nSortie de caisse ${e.prime_boutique} : ${fmt(e.montant)}`)) return;
    // Deuxième lecture APRÈS les questions : entre l'ouverture de la fenêtre
    // et la confirmation, une synchronisation a pu ramener le paiement fait
    // par quelqu'un d'autre (l'admin et le vendeur peuvent payer tous les deux).
    if (primeDejaPayee(db, c, e)) { uAlert(`⚠ La part de ${e.nom} vient d'être payée par quelqu'un d'autre.\n\nRien n'a été enregistré — la caisse n'a pas été débitée deux fois.`); return; }
    save(construirePaiementPrime(db, profile, c, e, moyen), `Part d'installation payée : ${fmt(e.montant)} à ${e.nom} (chantier ${c.nom})`);
    uAlert(`✅ ${fmt(e.montant)} payés à ${e.nom}. Sortie de caisse : ${e.prime_boutique}.`);
  };

  const modifierEntretien = async (c) => {
    const d = await uPrompt(`Prochaine date d'entretien pour ${c.prenom || ""} ${c.nom} (AAAA-MM-JJ) :`, c.date_entretien || today());
    if (!d) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) { uAlert("Format attendu : AAAA-MM-JJ (ex : 2026-09-15)."); return; }
    save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, date_entretien: d.trim() } : x)) }, `Entretien de ${c.nom} programmé le ${dFR(d.trim())}`);
  };

  const lierCompte = async (c) => {
    if (!isAdmin) return;
    if (comptesClientsLibres.length === 0) { uAlert("Aucun compte « Client » disponible. Créez d'abord un compte avec le rôle Client dans Utilisateurs."); return; }
    const noms = comptesClientsLibres.map((u) => u.nom);
    const choix = await uPrompt(`Lier cette fiche à quel compte client ?\n(${noms.join(" / ")})`, noms[0]);
    if (!choix) return;
    const u = comptesClientsLibres.find((x) => x.nom.trim().toLowerCase() === choix.trim().toLowerCase());
    if (!u) { uAlert("Compte introuvable parmi les comptes clients libres."); return; }
    save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, user_id: u.id } : x)) }, `Fiche « ${c.nom} » liée au compte ${u.nom}`);
  };

  // Ses propres dossiers (créés par lui, champ "commercial") + ceux où il
  // intervient réellement (présent dans l'équipe du chantier).
  const voitCeDossier = (c) => c.commercial === profile.nom || (estTechnicien && (c.equipe || []).some((e) => e.user_id === profile.id))
    // ⚠ Demande Timo : un vendeur ou un responsable commercial doit pouvoir
    // retrouver N'IMPORTE QUEL chantier "pose seule" pas encore soldé, même
    // sans y être rattaché — c'est le cas rare où le client vient payer en
    // boutique plutôt que sur le terrain. Sans ça, impossible de l'encaisser.
    || (c.pose_seule && (profile.role === "vendeur" || profile.role === "resp_commercial") && (() => {
      const dette = (db.dettes || []).find((x) => x.id === c.dette_id);
      return dette && resteAPayer(dette) > 0;
    })());
  // ⚠ CLOISONNEMENT (2.100.38) — cet écran n'avait AUCUNE séparation
  // formation / réel. Un compte de formation administrateur ou chef d'équipe
  // y lisait tous les vrais chantiers : noms, téléphones, adresses formelles,
  // photos des installations, matériel et numéros de série. Plus sensible que
  // des chiffres : ce sont les coordonnées et le domicile de vos clients.
  //
  // Même précaution que sur 👑 Mon équipe : un compte qui voit les deux
  // espaces (l'administrateur principal) garde EXACTEMENT la même liste
  // qu'avant — aucun chantier ne disparaît, ceux de formation portent un
  // badge 🎓. Un compte cloisonné ne voit que son espace.
  const mesChantiers = chantiersDeMonEspace(db, profile);
  const chantierEnFormation = (c) => {
    const b = boutiqueDuChantier(db, c);
    return !!b && estBoutiqueFormation(db, b);
  };
  let liste = voitTout ? mesChantiers : mesChantiers.filter(voitCeDossier);
  if (q) liste = liste.filter((c) => (String(c.nom) + " " + String(c.prenom) + " " + String(c.tel) + " " + String(c.type_installation)).toLowerCase().includes(q.toLowerCase()));
  if (filtreEntretien) liste = liste.filter((c) => c.date_entretien && c.date_entretien <= today());

  const entretiensDus = (voitTout ? mesChantiers : mesChantiers.filter(voitCeDossier)).filter((c) => c.date_entretien && c.date_entretien <= today()).length;

  const commerciauxActifs = db.users.filter((u) => ["commercial", "technicien"].includes(u.role) && u.actif !== false);

  // ---- Regroupement par catégorie (demande Timo) : à programmer / en cours
  // / à réceptionner / réserves / réceptionné. Purement un tri + des lignes
  // d'en-tête insérées dans le MÊME tableau — le rendu de chaque ligne de
  // client, plus bas, reste totalement inchangé.
  const CATEGORIES_CHANTIER = [
    { id: "a_programmer", label: "📅 À programmer", test: (c) => statutChantier(c) === "en_cours" && !(c.equipe || []).length },
    { id: "en_cours", label: "🔧 En cours", test: (c) => statutChantier(c) === "en_cours" && (c.equipe || []).length > 0 },
    { id: "termine", label: "⏳ En attente du client", test: (c) => statutChantier(c) === "termine" },
    { id: "reserves", label: "⚠ Réserves émises", test: (c) => statutChantier(c) === "reserves" },
    { id: "receptionne", label: "✅ Réceptionné", test: (c) => statutChantier(c) === "receptionne" },
  ];
  const categorieDe = (c) => CATEGORIES_CHANTIER.find((cat) => cat.test(c))?.id || "en_cours";
  const indexCategorie = (c) => CATEGORIES_CHANTIER.findIndex((cat) => cat.id === categorieDe(c));
  // ⚠ Onglets par catégorie (demande Timo, même principe que TousLesDevis.jsx
  // — filtres en pilule avec compteur). "Tout" garde les en-têtes de
  // catégorie groupées comme avant ; un onglet précis affiche sa liste
  // seule, sans en-tête redondant puisque déjà filtrée à cette catégorie.
  const [ongletChantier, setOngletChantier] = useState("tout");
  const listeTriee = [...liste].sort((a, b) => indexCategorie(a) - indexCategorie(b));
  const listeGroupee = ongletChantier === "tout" ? listeTriee : listeTriee.filter((c) => categorieDe(c) === ongletChantier);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">🏠 Nouveau client installé</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Prénom"><input className={inputCls} value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></Field>
          <Field label="Numéro"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          {/* Le bouton est HORS du <label> : sinon un clic dessus ouvrirait la liste. */}
          <div className="block">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">🔑 Compte client (réception)</span>
              <button type="button" onClick={creerCompteClient} className="text-[10px] font-bold text-white bg-green-700 rounded px-2 py-0.5 hover:bg-green-800 shrink-0">+ Créer</button>
            </div>
            <div className="mt-1">
              <select className={inputCls} value={f.user_id} onChange={(e) => {
                const u = db.users.find((x) => x.id === e.target.value);
                // Sélectionner un compte pré-remplit le nom, s'il est encore vide
                setF((p) => ({ ...p, user_id: e.target.value, nom: p.nom || (u ? (u.nom_complet || u.nom) : "") }));
              }}>
                <option value="">— Aucun compte —</option>
                {comptesClientsLibres.map((u) => <option key={u.id} value={u.id}>{u.nom_complet || u.nom}</option>)}
              </select>
            </div>
          </div>
          <Field label="Type d'installation">
            <select className={inputCls} value={f.type_installation} onChange={(e) => setF({ ...f, type_installation: e.target.value })}>
              {TYPES_INSTALLATION.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Date d'installation"><input type="date" className={inputCls} value={f.date_installation} onChange={(e) => setF({ ...f, date_installation: e.target.value })} /></Field>
          <Field label="Prochain entretien (facultatif)"><input type="date" className={inputCls} value={f.date_entretien} onChange={(e) => setF({ ...f, date_entretien: e.target.value })} /></Field>
          <Field label="🧾 Vente rattachée (facultatif)">
            <select className={inputCls} value={f.vente_id} onChange={(e) => chargerDepuisVente(e.target.value)}>
              <option value="">— Aucune —</option>
              {[...db.ventes].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 80).map((v) => (
                <option key={v.id} value={v.id}>{dFR(v.date)} — {v.client || "client"} — {fmt(totalVente(v))}</option>
              ))}
            </select>
          </Field>
          <Field label="🛡 Garantie (mois)"><input type="number" min="0" className={inputCls} value={f.garantie_mois} onChange={(e) => setF({ ...f, garantie_mois: e.target.value })} /></Field>
          {isAdmin && (
            <Field label="Commercial rattaché (facultatif)">
              <select className={inputCls} value={f.commercial || ""} onChange={(e) => setF({ ...f, commercial: e.target.value })}>
                <option value="">— Aucun —</option>
                {commerciauxActifs.map((u) => <option key={u.id} value={u.nom}>{u.nom}</option>)}
              </select>
            </Field>
          )}
          <div className="lg:col-span-2">
            <Field label="Localisation de la maison (quartier, repère)">
              <div className="flex gap-2">
                <input className={inputCls} value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ex : Quartier Bè, près de la pharmacie..." />
                <button type="button" onClick={() => setCarteOuverte(!carteOuverte)} className={`px-4 rounded-lg text-sm font-bold whitespace-nowrap ${f.lat ? "bg-green-700 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                  📍 {f.lat ? "Position ✓" : "Choisir sur la carte"}
                </button>
              </div>
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="Adresse formelle (numéro, rue/quartier, ville) — pour le PV de réception">
              <input className={inputCls} value={f.adresse_contrat} onChange={(e) => setF({ ...f, adresse_contrat: e.target.value })} placeholder="Ex : 12 Rue des Palmiers, Bè, Lomé" />
            </Field>
          </div>
        </div>
        {carteOuverte && <div className="mt-3"><CarteChoixPosition lat={f.lat} lng={f.lng} onChoisir={(lat, lng) => setF({ ...f, lat, lng })} /></div>}
        {/* ---- ÉQUIPE PRÉVUE ---- */}
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="font-bold text-sm text-sky-900 mb-1">👷 Équipe prévue sur le chantier</div>
          <div className="text-xs text-slate-500 mb-2">Cochez les techniciens, puis désignez le chef ⭐. C'est lui qui pourra déclarer les travaux terminés.</div>
          {noteMasques(null)}
          {techsPour(null).length === 0 ? (
            <div className="text-xs text-slate-400">Aucun technicien enregistré dans votre espace de travail.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {techsPour(null).map((t) => {
                const choisi = (f.equipe_prevue || []).includes(t.id);
                const chef = f.chef_prevu === t.id;
                return (
                  <div key={t.id} className={`rounded-lg border px-2 py-1 text-xs flex items-center gap-2 ${choisi ? "bg-white border-sky-400" : "bg-white border-slate-200"}`}>
                    <label className="flex items-center gap-1 cursor-pointer font-semibold">
                      <input type="checkbox" checked={choisi} onChange={() => basculerTechPrevu(t.id)} />
                      {t.nom}
                    </label>
                    {choisi && (
                      <button onClick={() => setF({ ...f, chef_prevu: t.id })} className={`rounded px-1.5 py-0.5 font-bold ${chef ? "bg-amber-500 text-white" : "text-amber-600 hover:bg-amber-50"}`}>
                        {chef ? "⭐ Chef" : "⭐"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- MATÉRIEL POSÉ ---- */}
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="font-bold text-sm text-emerald-900 mb-1">🔩 Matériel posé</div>
          <div className="text-xs text-slate-500 mb-2">
            {f.vente_id
              ? "Repris automatiquement de la vente rattachée. Ajoutez les numéros de série si vous les avez."
              : "Rattachez une vente pour le remplir automatiquement, ou saisissez-le à la main."}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <input className={inputCls} placeholder="Matériel (ex : Panneau 555W)" list="liste-materiel" value={mat.nom} onChange={(e) => setMat({ ...mat, nom: e.target.value })} />
            <datalist id="liste-materiel">{[...new Set(db.produits.map((p) => p.nom))].map((n) => <option key={n} value={n} />)}</datalist>
            <input type="number" min="1" className={inputCls} placeholder="Quantité" value={mat.qte} onChange={(e) => setMat({ ...mat, qte: e.target.value })} />
            <input className={inputCls} placeholder="N° de série (facultatif)" value={mat.serie} onChange={(e) => setMat({ ...mat, serie: e.target.value })} />
            <button onClick={ajouterMateriel} className="px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter</button>
          </div>
          {(f.materiel || []).length > 0 && (
            <table className="w-full text-sm mt-3">
              <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-2 py-1">Matériel</th><th className="text-left px-2 py-1">Qté</th><th className="text-left px-2 py-1">N° série</th><th></th></tr></thead>
              <tbody>
                {f.materiel.map((m, i) => (
                  <tr key={i} className="border-t border-emerald-100">
                    <td className="px-2 py-1 font-semibold">{m.nom}</td>
                    <td className="px-2 py-1 tabular-nums">{m.qte}</td>
                    <td className="px-2 py-1">
                      <input className="w-32 rounded border border-slate-300 px-1 py-0.5 text-xs" placeholder="—" value={m.serie || ""}
                        onChange={(e) => setF({ ...f, materiel: f.materiel.map((x, j) => (j === i ? { ...x, serie: e.target.value } : x)) })} />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button onClick={() => setF({ ...f, materiel: f.materiel.filter((_, j) => j !== i) })} className="text-xs text-red-600 underline">Retirer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button onClick={ajouter} className="mt-4 px-6 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">Enregistrer le client</button>
      </Panel>

      {/* ═══════ DOSSIER DE CHANTIER ═══════ */}
      {dossierOuvert && (() => {
        const c = db.clients_installes.find((x) => x.id === dossierOuvert);
        if (!c) return null;
        const fin = finGarantie(c);
        const jeSuisDeLEquipe = (c.equipe || []).some((e) => e.user_id === profile.id);
        const peutEcrireDossier = isAdmin || jeSuisDeLEquipe;
        return (
          <div className="rounded-xl p-4 bg-white border-2 border-sky-300">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="font-bold text-sky-900">📁 Dossier de chantier — {c.prenom} {c.nom}</div>
              <button onClick={() => setDossierOuvert(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <Info label="Statut" valeur={STATUT_CHANTIER[statutChantier(c)].label} />
              <Info label="🛡 Garantie" valeur={fin ? `${garantieActive(c) ? "Active" : "Expirée"} — jusqu'au ${dFR(fin)}` : "Non renseignée"} />
              <Info label="🧾 Vente rattachée" valeur={c.vente_id ? (db.ventes.find((v) => v.id === c.vente_id) ? `${dFR(db.ventes.find((v) => v.id === c.vente_id).date)} — ${fmt(totalVente(db.ventes.find((v) => v.id === c.vente_id)))}` : "Vente supprimée") : "—"} />
              <Info label="👷 Équipe" valeur={(c.equipe || []).length ? c.equipe.map((e) => `${e.chef ? "⭐ " : ""}${e.nom}`).join(", ") : "Non affectée"} />
            </div>

            {/* ADRESSE FORMELLE + GARANTIE — éditables ici, pas seulement à
                la création : même défaut repéré pour la garantie que pour
                l'adresse (Timo, en vérifiant après le correctif précédent).
                Les chantiers créés avant ces champs (ou toute fiche à
                corriger) doivent pouvoir les renseigner après coup. */}
            {isAdmin && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 grid sm:grid-cols-2 gap-3">
                <Field label="🏠 Adresse formelle (numéro, rue/quartier, ville) — pour le PV">
                  <div className="flex gap-2">
                    <input className={inputCls} defaultValue={c.adresse_contrat || ""} placeholder="Ex : 12 Rue des Palmiers, Bè, Lomé"
                      onBlur={(e) => {
                        if (e.target.value === (c.adresse_contrat || "")) return;
                        save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, adresse_contrat: e.target.value } : x)) }, `Adresse (contrat) mise à jour — ${c.nom} ${c.prenom || ""}`);
                      }} />
                  </div>
                </Field>
                <Field label="🛡 Garantie (mois) — pour le PV">
                  <input type="number" min="0" className={inputCls} defaultValue={c.garantie_mois ?? ""} placeholder="Ex : 24"
                    onBlur={(e) => {
                      const val = Number(e.target.value || 0);
                      if (val === Number(c.garantie_mois || 0)) return;
                      save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, garantie_mois: val } : x)) }, `Garantie mise à jour — ${c.nom} ${c.prenom || ""} (${val} mois)`);
                    }} />
                </Field>
                {c.contrat_reserve_texte && (
                  <Field label="⏳ Délai convenu pour la levée des réserves — pour le PV">
                    <input type="date" className={inputCls} defaultValue={c.reserves_delai || ""}
                      onBlur={(e) => {
                        if (e.target.value === (c.reserves_delai || "")) return;
                        save({ ...db, clients_installes: db.clients_installes.map((x) => (x.id === c.id ? { ...x, reserves_delai: e.target.value } : x)) }, `Délai de levée des réserves fixé — ${c.nom} ${c.prenom || ""} (${e.target.value})`);
                      }} />
                  </Field>
                )}
              </div>
            )}

            {/* PROGRAMMATION — admin et responsable commercial */}
            {peutProgrammer && statutChantier(c) !== "receptionne" && (
              <div className="rounded-lg border-2 border-purple-300 bg-purple-50 p-3 mb-3">
                <div className="font-bold text-sm text-purple-900 mb-1">📅 Programmer l'installation</div>
                <div className="text-xs text-slate-600 mb-3">Fixez la date et composez l'équipe. Le chef ⭐ pourra ensuite déclarer les travaux terminés.</div>

                <Field label="Date d'installation">
                  <input type="date" className={inputCls + " max-w-xs"} value={progDe(c).date} onChange={(e) => setProgDe(c, { date: e.target.value })} />
                </Field>

                <div className="mt-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Équipe — cochez, puis désignez le chef ⭐</div>
                  {noteMasques(c)}
                  {noteMasques(c)}
            {techsPour(c).length === 0 ? (
                    <div className="text-xs text-slate-400">Aucun technicien enregistré dans l'espace de ce chantier.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {techsPour(c).map((t) => {
                        const choisi = progDe(c).equipe.includes(t.id);
                        const chef = progDe(c).chef === t.id;
                        return (
                          <div key={t.id} className={`rounded-lg border px-2 py-1 text-xs flex items-center gap-2 ${choisi ? "bg-white border-purple-400" : "bg-white border-slate-200"}`}>
                            <label className="flex items-center gap-1 cursor-pointer font-semibold">
                              <input type="checkbox" checked={choisi} onChange={() => basculerTechProg(c, t.id)} />
                              {t.nom}
                            </label>
                            {choisi && (
                              <button onClick={() => setProgDe(c, { chef: t.id })} className={`rounded px-1.5 py-0.5 font-bold ${chef ? "bg-amber-500 text-white" : "text-amber-600 hover:bg-amber-50"}`}>
                                {chef ? "⭐ Chef" : "⭐"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <button onClick={() => enregistrerProgrammation(c)} className="mt-3 px-5 py-2 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800">
                  {c.date_installation ? "✅ Mettre à jour la programmation" : "✅ Programmer l'installation"}
                </button>
              </div>
            )}

            {/* MATÉRIEL POSÉ */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 mb-3">
              <div className="font-bold text-sm text-emerald-900 mb-2">🔩 Matériel posé</div>
              {(c.materiel || []).length === 0 ? (
                <div className="text-xs text-slate-500">Aucun matériel enregistré. C'est l'information la plus précieuse dans deux ans, au moment d'un dépannage.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-2 py-1">Matériel</th><th className="text-left px-2 py-1">Qté</th><th className="text-left px-2 py-1">N° de série</th></tr></thead>
                  <tbody>
                    {c.materiel.map((m, i) => (
                      <tr key={i} className="border-t border-emerald-100">
                        <td className="px-2 py-1 font-semibold">{m.nom}</td>
                        <td className="px-2 py-1 tabular-nums">{m.qte}</td>
                        <td className="px-2 py-1 font-mono text-xs text-slate-600">{m.serie || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* PHOTOS */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="font-bold text-sm text-slate-800">📷 Photos du chantier ({(c.photos || []).length} / {MAX_PHOTOS})</div>
                {peutEcrireDossier && (c.photos || []).length < MAX_PHOTOS && (
                  <label className="px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 cursor-pointer">
                    + Ajouter une photo
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => { ajouterPhoto(c, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                )}
              </div>
              {(c.photos || []).length === 0 ? (
                <div className="text-xs text-slate-500">Aucune photo. Les photos avant/après protègent en cas de contestation.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {c.photos.map((ph) => (
                    <div key={ph.id} className="relative">
                      <a href={ph.data} target="_blank" rel="noreferrer">
                        <img src={ph.data} alt="" className="h-24 w-32 object-cover rounded-lg border border-slate-300" />
                      </a>
                      <div className="text-[10px] text-slate-500 mt-0.5">{ph.par} · {dFR(ph.date)}</div>
                      {isAdmin && <button onClick={() => supprimerPhoto(c, ph.id)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 text-xs font-bold leading-none">×</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* OBSERVATIONS */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="font-bold text-sm text-amber-900">📝 Observations du technicien</div>
                {peutEcrireDossier && (
                  <button onClick={() => ecrireObservation(c)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">+ Ajouter une observation</button>
                )}
              </div>
              {(c.observations || []).length === 0 ? (
                <div className="text-xs text-slate-500">Aucune observation. Notez ici tout ce qui servira au prochain technicien : difficulté d'accès, matériel particulier, conseil donné au client.</div>
              ) : (
                <div className="space-y-2">
                  {c.observations.map((o) => (
                    <div key={o.id} className="rounded-lg bg-white border border-amber-100 p-2">
                      <div className="text-sm text-slate-800">{o.texte}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{o.par} · {dFR(o.date)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {chantier && (() => {
        const c = db.clients_installes.find((x) => x.id === chantier);
        if (!c) return null;
        return (
          <div className="rounded-xl p-4 bg-white border-2 border-purple-300">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <div className="font-bold text-purple-800">🔧 Frais d'installation — {c.prenom || ""} {c.nom}</div>
              <button onClick={() => setChantier(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
            </div>
            <div className="text-xs text-slate-500 mb-4">Le chef du chantier prend sa part, puis le reste est partagé également entre tous les techniciens présents (chef compris). Vous pouvez ajuster chaque pourcentage à la main.</div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Frais facturés au client (F CFA)">
                <input type="number" min="0" className={inputCls} value={rep.frais} onChange={(e) => setRep({ ...rep, frais: e.target.value })} />
              </Field>
              <Field label="Part du chef de chantier (%)">
                <input type="number" min="0" max="100" step="5" className={inputCls} value={rep.partChef} onChange={(e) => changerPartChef(e.target.value)} />
              </Field>
              <div className="flex flex-col justify-end text-sm font-bold text-slate-600">
                <div>Total réparti : <span className={`ml-1 tabular-nums ${totalPct > 100.5 ? "text-red-600" : "text-green-700"}`}>{Math.round(totalPct * 10) / 10} %</span></div>
                {totalPct < 99.5 && (
                  <div className="text-xs text-slate-500">🏢 Part BMI : {Math.round((100 - totalPct) * 10) / 10} % = {fmt(Math.round((fraisRep * (100 - totalPct)) / 100))}</div>
                )}
              </div>
            </div>

            <div className="mt-4 text-xs font-bold text-slate-500 uppercase mb-2">Techniciens présents sur le chantier</div>
            {techsPour(c).length === 0 ? (
              <div className="text-sm text-slate-400">Aucun technicien actif dans l'espace de ce chantier. Créez des comptes Technicien ou Technicien BMI.</div>
            ) : (
              <div className="space-y-2">
                {techsPour(c).map((u) => {
                  const present = rep.equipe.includes(u.id);
                  const pct = Number(rep.pcts[u.id] || 0);
                  return (
                    <div key={u.id} className={`rounded-lg border p-2 grid sm:grid-cols-4 gap-2 items-center ${present ? "bg-purple-50 border-purple-200" : "bg-white border-slate-200"}`}>
                      <label className="flex items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" checked={present} onChange={() => basculerTech(u.id)} />
                        {u.nom_complet || u.nom}
                      </label>
                      <div>
                        {present && (
                          <label className="flex items-center gap-2 text-xs font-bold text-amber-700">
                            <input type="radio" name="chefChantier" checked={rep.chef === u.id} onChange={() => designerChef(u.id)} />
                            ⭐ Chef du chantier
                          </label>
                        )}
                      </div>
                      <div>
                        {present && (
                          <div className="flex items-center gap-2">
                            <input type="number" min="0" max="100" step="0.5" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                              value={pct} onChange={(e) => setRep({ ...rep, pcts: { ...rep.pcts, [u.id]: e.target.value } })} />
                            <span className="text-xs text-slate-500">%</span>
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-bold tabular-nums text-right">
                        {present ? fmt(Math.round((fraisRep * pct) / 100)) : <span className="text-slate-300">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => validerRepartition(c)} className="mt-4 px-5 py-2 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800">✅ Valider la répartition</button>

            {(c.equipe || []).length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Répartition enregistrée — paiement des parts</div>
                <table className="w-full text-sm min-w-[520px]">
                  <thead><tr className="text-xs text-slate-500 uppercase">{["Technicien", "Rôle", "%", "Montant", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                  <tbody>
                    {(c.equipe || []).map((e) => (
                      <tr key={e.user_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-semibold">{e.nom}</td>
                        <td className="px-3 py-2 text-xs">{e.chef ? <span className="font-bold text-amber-600">⭐ Chef de chantier</span> : "Technicien"}</td>
                        <td className="px-3 py-2 tabular-nums">{e.pct} %</td>
                        <td className="px-3 py-2 tabular-nums font-bold">{fmt(e.montant)}</td>
                        <td className="px-3 py-2">{e.paye
                          ? <span className="text-xs font-bold text-green-700">✅ Payé le {dFR(e.date_paiement)}</span>
                          : e.demande_prime
                            ? <span className="text-xs font-bold text-sky-700">📤 Demandé — {e.prime_boutique}</span>
                            : <span className="text-xs font-bold text-orange-600">⏳ À payer</span>}</td>
                        <td className="px-3 py-2">
                          {!e.paye && !e.demande_prime && isAdmin && <button onClick={() => demanderPaiementPrime(c, e)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900">📤 Demander le paiement</button>}
                          {!e.paye && e.demande_prime && (isAdmin || profile.boutique === e.prime_boutique) && <button onClick={() => validerPaiementPrime(c, e)} className="text-xs font-bold text-white bg-emerald-700 rounded px-2 py-1 hover:bg-emerald-800">✓ Valider et payer</button>}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                      <td className="px-3 py-2" colSpan={3}>TOTAL RÉPARTI</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(fraisRepartis(c))}</td>
                      <td className="px-3 py-2 text-xs text-slate-500" colSpan={2}>sur {fmt(c.frais_installation)} facturés</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Clients installés ({liste.length})</span>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setFiltreEntretien(!filtreEntretien)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filtreEntretien ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              🔔 Entretien dû{entretiensDus ? ` (${entretiensDus})` : ""}
            </button>
            <input className={`${inputCls} w-48`} placeholder="🔍 Rechercher..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="px-4 py-2 border-b border-slate-200 flex gap-2 flex-wrap">
          <button onClick={() => setOngletChantier("tout")}
            className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${ongletChantier === "tout" ? "bg-sky-800 text-white border-sky-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
            Tout <span className={`ml-1 ${ongletChantier === "tout" ? "text-sky-200" : "text-slate-400"}`}>({liste.length})</span>
          </button>
          {CATEGORIES_CHANTIER.map(({ id, label }) => {
            const n = liste.filter((c) => categorieDe(c) === id).length;
            return (
              <button key={id} onClick={() => setOngletChantier(id)}
                className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-colors ${ongletChantier === id ? "bg-sky-800 text-white border-sky-800" : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"}`}>
                {label} <span className={`ml-1 ${ongletChantier === id ? "text-sky-200" : "text-slate-400"}`}>({n})</span>
              </button>
            );
          })}
        </div>
        <div className="max-h-[625px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Client", "Numéro", "Installation", "Installé le", "Entretien", "Localisation", "Commercial", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {listeGroupee.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun client installé{q ? " ne correspond à la recherche" : ongletChantier !== "tout" ? " dans cette catégorie" : " pour l'instant"}.</td></tr>}
            {listeGroupee.map((c, idx) => {
              const cat = categorieDe(c);
              const catPrecedente = idx > 0 ? categorieDe(listeGroupee[idx - 1]) : null;
              const infoCat = CATEGORIES_CHANTIER.find((x) => x.id === cat);
              const entretienDu = c.date_entretien && c.date_entretien <= today();
              return (
                <Fragment key={c.id}>
                  {ongletChantier === "tout" && cat !== catPrecedente && (
                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                      <td colSpan={8} className="px-3 py-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
                        {infoCat.label} ({listeGroupee.filter((x) => categorieDe(x) === cat).length})
                      </td>
                    </tr>
                  )}
                <tr key={c.id} className={`border-t border-slate-100 hover:bg-sky-50 ${entretienDu ? "bg-orange-50" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{c.prenom} {c.nom}{c.user_id ? " 🔑" : ""}
                    {/* Rien ne disparaît pour l'administrateur : les chantiers
                        d'entraînement restent listés, simplement signalés. */}
                    {voitLesDeuxEspaces(db, profile) && chantierEnFormation(c) && (
                      <div className="text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 bg-violet-50 text-violet-700 border-violet-300 ml-1" title="Chantier d'entraînement : il n'appartient pas à vos données réelles.">
                        🎓 formation
                      </div>
                    )}
                    <div className={`text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 ${STATUT_CHANTIER[statutChantier(c)].couleur}`}>
                      {STATUT_CHANTIER[statutChantier(c)].label}
                    </div>
                    {c.contrat_force_par && (
                      <div className="text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 bg-red-50 text-red-700 border-red-300 ml-1" title="Aucun contrat signé n'existe pour ce chantier">
                        ⚠ Réceptionné SANS SIGNATURE par {c.contrat_force_par}, le {dFR(c.contrat_force_le)}
                      </div>
                    )}
                    {c.a_programmer && !c.date_installation && (
                      <div className="text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 bg-red-50 text-red-700 border-red-300 ml-1 animate-pulse">
                        🔔 À PROGRAMMER
                      </div>
                    )}
                    {statutChantier(c) === "reserves" && <div className="text-[10px] text-red-600 mt-0.5 italic">« {c.reserves} »</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.tel}</td>
                  <td className="px-3 py-2">{c.type_installation}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{c.date_installation ? dFR(c.date_installation) : "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.date_entretien ? <span className={entretienDu ? "font-bold text-orange-700" : ""}>{entretienDu ? "⚠ " : ""}{dFR(c.date_entretien)}</span> : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {c.localisation || "—"}
                    {c.lat && c.lng && <a href={`https://www.google.com/maps?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-sky-700 underline text-xs whitespace-nowrap">📍 Carte</a>}
                  </td>
                  <td className="px-3 py-2">{c.commercial || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => setDossierOuvert(dossierOuvert === c.id ? null : c.id)} className="text-xs font-bold text-sky-800 underline mr-2">
                      {dossierOuvert === c.id ? "▾ Dossier" : "▸ Dossier"}
                    </button>
                    {/* 🎁 Réservé à l'administrateur : offrir un cadeau au client. */}
                    {isAdmin && (
                      c.cadeau && !c.cadeau.retire ? (
                        <button onClick={() => marquerRetire(c)} className="text-xs font-bold text-white bg-pink-600 rounded px-2 py-0.5 hover:bg-pink-700 mr-2" title={`${c.cadeau.quoi} — à retirer à ${c.cadeau.boutique}`}>
                          🎁 En attente de retrait
                        </button>
                      ) : (
                        <button onClick={() => offrirCadeau(c)} className="text-xs font-bold text-pink-700 border border-pink-300 rounded px-2 py-0.5 hover:bg-pink-50 mr-2" title="Offrir un cadeau à ce client">
                          🎁 {c.cadeau?.retire ? "Offrir à nouveau" : "Cadeau"}
                        </button>
                      )
                    )}
                    {peutTerminer(c, profile, isAdmin) && (
                      <button onClick={() => marquerTermine(c)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700 mr-2">🏁 Marquer terminé</button>
                    )}
                    {statutChantier(c) === "termine" && isAdmin && c.contrat_statut !== "attente_signature" && (
                      <button onClick={() => envoyerPourSignature(c)} className="text-xs font-bold text-white bg-sky-800 rounded px-2 py-1 hover:bg-sky-900 mr-2">📤 Envoyer pour signature</button>
                    )}
                    {statutChantier(c) === "termine" && c.contrat_statut === "attente_signature" && (
                      <span className="text-xs font-bold text-sky-700 mr-2">📤 En attente de signature{isAdmin ? " — " : ""}
                        {isAdmin && <button onClick={() => envoyerPourSignature(c)} className="underline">renvoyer le lien</button>}
                      </span>
                    )}
                    {statutChantier(c) === "termine" && isAdmin && (
                      <button onClick={() => forcerReceptionSansSignature(c)} className="text-xs font-bold text-red-700 border border-red-300 rounded px-2 py-1 hover:bg-red-50 mr-2" title="Cas exceptionnel — aucun PV n'existera">⚠ Forcer sans signature</button>
                    )}
                    {statutChantier(c) === "reserves" && isAdmin && c.avenant_statut !== "attente_signature" && (
                      <button onClick={() => envoyerAvenant(c)} className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1 hover:bg-red-700 mr-2">📤 Envoyer l'avenant (réserves corrigées)</button>
                    )}
                    {statutChantier(c) === "reserves" && c.avenant_statut === "attente_signature" && (
                      <span className="text-xs font-bold text-sky-700 mr-2">📤 Avenant en attente de signature</span>
                    )}
                    {(c.contrat_statut === "signe" || c.avenant_statut === "signe" || c.contrat_force_par) && (
                      <button onClick={() => imprimerPV(c, db)} className="text-xs font-bold text-white bg-slate-700 rounded px-2 py-1 hover:bg-slate-800 mr-2">📄 Voir le PV</button>
                    )}
                    {c.pose_seule && peutEncaisserPose(c) && (() => {
                      const dette = (db.dettes || []).find((x) => x.id === c.dette_id);
                      const reste = dette ? resteAPayer(dette) : 0;
                      return reste > 0 ? (
                        <button onClick={() => encaisserPose(c)} className="text-xs font-bold text-white bg-emerald-700 rounded px-2 py-1 hover:bg-emerald-800 mr-2">
                          💰 Encaisser (reste {fmt(reste)})
                        </button>
                      ) : dette ? (
                        <span className="text-xs font-bold text-emerald-700 mr-2">✅ Pose soldée</span>
                      ) : null;
                    })()}
                    <button onClick={() => ouvrirRepartition(c)} className="text-xs font-bold text-purple-700 underline mr-2">
                      🔧 Frais {Number(c.frais_installation || 0) > 0 ? `(${fmt(c.frais_installation)})` : ""}
                    </button>
                    <button onClick={() => modifierEntretien(c)} className="text-xs font-bold text-sky-800 underline mr-2">Entretien</button>
                    {isAdmin && !c.user_id && <button onClick={() => lierCompte(c)} className="text-xs font-bold text-sky-800 underline mr-2">Lier un compte</button>}
                    {(isAdmin || c.commercial === profile.nom) && <button onClick={() => supprimer(c)} className="text-xs text-red-600 underline">Suppr.</button>}
                  </td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
      <div className="text-xs text-slate-400">🔑 = fiche liée à un compte d'accès client. ⚠ fond orange = entretien dû. Les commerciaux ne voient que leurs propres clients ; l'administrateur, les techniciens et les chefs d'équipe voient tout le parc.</div>
    </div>
  );
}
