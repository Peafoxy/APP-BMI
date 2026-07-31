// ============================================================
// screens/Utilisateurs.jsx — Gestion des comptes : création par
// rôle, activation, mots de passe, pouvoirs, demandes de crédit.
// ============================================================
import { useState } from "react";
import { Commerciaux } from "../screens/Commerciaux";
import { Salaire } from "../screens/Salaires";
import { chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, motDePasseConnu, envoyerIdentifiantsWhatsApp, envoyerIdentifiantsEmployeWhatsApp, fabriquerCompteClient, messagesNouveauClient } from "../lib/comptesClients";
import { SALARIES, SALARIES_BOUTIQUE } from "../lib/constants";
import { uid, normPaiement, definirMotDePasse, fmt, today, dFR, col } from "../lib/core";
import { Field, inputCls, btnDark, Badge, uAlert, uConfirm, uPrompt, uChoix } from "../components/ui";
import { totalRembourseCredit, resteCredit, creditsDe, creditsEnAttente, creditsEnCours, moisPlus, choisirBoutiqueDebitG, messagesNotifSortieCaisse, envoyerVirementG, CRITERES_NOTE, moyenneNote, noteMoyenne, etoiles, SEUIL_CHEF_EQUIPE, TAUX_EQUIPE_DEFAUT, filleulsDe, estChefEquipe, boutiquesVente, pouvoirsDuRole, libelleMoisFR, estAdminPrincipal, adminPrincipal } from "../lib/calculs";

// ============ UTILISATEURS ============
export function Users({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  // Changer OU consulter un mot de passe est réservé à l'administrateur
  // PRINCIPAL — jamais aux autres administrateurs, même avec le pouvoir
  // « Utilisateurs ». Décision de Timo.
  const jeSuisAdminPrincipal = estAdminPrincipal(db, profile);
  const [avisOuvert, setAvisOuvert] = useState(null);
  // ---- Liste classée par rôle : un bouton par rôle, ~5 lignes visibles
  // avec défilement, et une recherche par nom qui traverse tous les rôles. ----
  const [roleActif, setRoleActif] = useState("admin");
  const [rechercheU, setRechercheU] = useState("");
  const ROLES_LISTE = [
    ["admin", "👑 Admins"], ["gerant", "Gérants"], ["vendeur", "Vendeurs"],
    ["magasinier", "Magasiniers"], ["commercial", "Commerciaux"], ["technicien", "Techniciens"],
    ["technicien_bmi", "🔧 Tech. BMI"], ["resp_commercial", "Resp. com."],
    ["comptable", "📒 Comptables"], ["client", "Clients"],
  ];
  const nbParRole = Object.fromEntries(ROLES_LISTE.map(([r]) => [r, db.users.filter((x) => x.role === r).length]));
  const rolesPresents = ROLES_LISTE.filter(([r]) => nbParRole[r] > 0);
  const roleAffiche = nbParRole[roleActif] > 0 ? roleActif : (rolesPresents[0]?.[0] || "admin");
  const qU = rechercheU.trim().toLowerCase();
  const enRecherche = qU.length > 0;
  const listeAffichee = enRecherche
    ? db.users.filter((x) => `${x.nom || ""} ${x.nom_complet || ""}`.toLowerCase().includes(qU))
    : db.users.filter((x) => x.role === roleAffiche);
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
      const { motDePasse } = await resoudreMotDePasseClient(db, f.nom, f.tel);
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
    // Invitation WhatsApp — comme pour un client, mais sans conseil de
    // changer le mot de passe (impossible pour un employé : seul l'admin
    // principal peut le faire). Seulement si un numéro a été renseigné.
    if (chiffresTel(f.tel).length >= 4) {
      const { nom: nomEmp, pwd: pwdEmp, role: roleEmp, tel: telEmp } = f;
      if (await uConfirm(`✅ Compte créé.\n\n👤 ${nomEmp}\n🔑 ${pwdEmp}\n\nEnvoyer ces identifiants à ${nomEmp} par WhatsApp ?`)) {
        envoyerIdentifiantsEmployeWhatsApp(nomEmp, nomEmp, pwdEmp, roleEmp, telEmp);
      }
    }
    setF(vide);
    setF({ nom: "", pwd: "", role: "vendeur", boutique: premiere, taux: "5" });
    setMsg("✅ Utilisateur créé");
    setTimeout(() => setMsg(""), 3000);
  };

  const toggleActif = (u) => {
    if (u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.actif !== false).length === 1 && u.actif !== false) {
      uAlert("Impossible de bloquer le dernier administrateur actif."); return;
    }
    // Bloquer PRÉCISÉMENT le compte qui porte le drapeau d'admin principal —
    // sinon la solution de secours (« premier admin trouvé », voir
    // adminPrincipal dans calculs.js) désigne quelqu'un d'autre à sa place,
    // en silence, sans que personne ne l'ait décidé. Signalé par Timo :
    // le rôle « changeait tout seul » après certaines mises à jour — la
    // cause était ce trou, pas la synchronisation.
    if (u.actif !== false && adminPrincipal(db)?.id === u.id) {
      uAlert(`🔒 Impossible de bloquer ${u.nom} : ce compte est l'administrateur PRINCIPAL.\n\nTransférez d'abord ce rôle à quelqu'un d'autre (⚙ Paramètres → Transférer le rôle) avant de le bloquer.`);
      return;
    }
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, actif: x.actif === false } : x)) }, `${u.actif === false ? "Réactivation" : "Blocage"} du compte ${u.nom}`);
  };

  const changerPwd = async (u) => {
    if (!jeSuisAdminPrincipal) { uAlert("🔒 Seul l'administrateur PRINCIPAL peut changer un mot de passe."); return; }
    const p = await uPrompt(`Nouveau mot de passe pour ${u.nom} (6 caractères minimum, exigé par la sécurisation Supabase) :`);
    if (!p || p.length < 6) { if (p !== null) uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const nouveauxChamps = await definirMotDePasse(p);
    save({
      ...db,
      users: db.users.map((x) => (x.id === u.id
        ? {
            ...x, ...nouveauxChamps,
            pwd_visible: p, // gardé EN CLAIR uniquement pour que l'admin principal puisse le consulter plus tard (bouton « 👁 Voir ») — c'est un choix de gestion assumé, pas le mécanisme de connexion (qui reste le hachage ci-dessus)
            ...(x.role === "client" ? { mdp_auto: false } : {}), // ce n'est plus le mot de passe auto-généré
          }
        : x)),
    }, `Changement de mot de passe : ${u.nom} (par l'administrateur principal)`);
  };

  const voirPwd = (u) => {
    if (!jeSuisAdminPrincipal) { uAlert("🔒 Seul l'administrateur PRINCIPAL peut consulter un mot de passe."); return; }
    const mdp = u.pwd_visible || motDePasseConnu(u);
    if (!mdp) {
      uAlert(`Aucun mot de passe consultable pour ${u.nom}.\n\nIl a été défini avant cette fonctionnalité (ou changé par le client lui-même depuis son espace). Utilisez « Mot de passe » pour lui en attribuer un nouveau — il deviendra alors consultable.`);
      return;
    }
    uAlert(`🔑 Mot de passe de ${u.nom} : ${mdp}`);
  };

  const supprimerU = async (u) => {
    if (profile && u.id === profile.id) { uAlert("Vous ne pouvez pas supprimer le compte avec lequel vous êtes connecté."); return; }
    // Même protection que pour le blocage : ne jamais supprimer le porteur
    // du drapeau d'admin principal sans un transfert explicite d'abord.
    if (adminPrincipal(db)?.id === u.id) {
      uAlert(`🔒 Impossible de supprimer ${u.nom} : ce compte est l'administrateur PRINCIPAL.\n\nTransférez d'abord ce rôle à quelqu'un d'autre (⚙ Paramètres → Transférer le rôle) avant de le supprimer.`);
      return;
    }
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
          {f.role !== "client" && (
            <Field label="Téléphone (pour lui envoyer ses identifiants par WhatsApp, facultatif)"><input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="font-bold text-slate-800 mb-2">Utilisateurs ({db.users.length})</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {rolesPresents.map(([r, lbl]) => (
              <button key={r} onClick={() => { setRoleActif(r); setRechercheU(""); }}
                className={`px-3 py-1 rounded-lg text-xs font-bold ${!enRecherche && roleAffiche === r ? "bg-sky-800 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"}`}>
                {lbl} ({nbParRole[r]})
              </button>
            ))}
          </div>
          <input value={rechercheU} onChange={(e) => setRechercheU(e.target.value)}
            placeholder="🔍 Rechercher un utilisateur par son nom (tous rôles confondus)…" className={inputCls} />
          {enRecherche && <div className="mt-1 text-xs font-semibold text-slate-500">{listeAffichee.length} résultat(s) dans tous les rôles</div>}
        </div>
        <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Nom", "Rôle", "Boutique", "Salaire / Taux", "Statut", ""].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {listeAffichee.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">{enRecherche ? "Aucun utilisateur ne correspond à cette recherche." : "Aucun compte pour ce rôle."}</td></tr>}
            {listeAffichee.map((u) => (
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
                  {jeSuisAdminPrincipal && <button onClick={() => voirPwd(u)} className="text-xs font-bold text-purple-700 underline mr-2">👁 Voir</button>}
                  {jeSuisAdminPrincipal && <button onClick={() => changerPwd(u)} className="text-xs font-bold text-sky-800 underline mr-2">Mot de passe</button>}
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
