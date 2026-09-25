// ============================================================
// screens/Dettes.jsx — Dettes clients et réservations prépayées.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, heureCourte, telDigits, normPaiement, prochainNumeroVente, prochainNumeroDette, lignesDette } from "../lib/core";
import { PAIEMENTS } from "../lib/constants";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, usePagination, Pagination, AucuneBoutique, demanderMoyenPaiement, ListeArticles, ARTICLES_VISIBLES, boutonAction, classeLigneDepliable, IconeWhatsApp, enTeteFige, celluleFigee, fondLigneDepliable } from "../components/ui";
import { imprimerRecu, imprimerRecuVersement } from "../lib/impression";
import { bloquerSiLecture, boutiquesVente, estReservation, resteAPayer, stockActuel, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, espaceDeLaDette, boutiqueRetenue, compteClientPour, refuserSaufAdmin } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { clientsConnus, propositionsClients, propositionsNumeros } from "../lib/clientsConnus";
import { detteEnRetard, joursDeDette, RETARD_DETTE_JOURS } from "../lib/rappels";
import { envoiRappelDette, texteRappel, traceEnvoi, libelleTrace, envoiRecuReglement, envoiRecuReservation } from "../lib/whatsappModeles";
import { soldeApresAcompte, prochaineEcheance, PLAN_ACCEPTE } from "../lib/reglement";
import { envoyerModele, messagesAvecLigneEnvoi, envoyerRecuSansQuestion } from "../whatsapp";

// ============ DETTES ============
export function Dettes({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "dettes" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "dettes" });
  const [f, setF] = useState({ client: "", tel: "", motif: "", montant: "", paye: "", moyen: PAIEMENTS[0] });
  // 🧾 25/09/2026 : ce que le reçu WhatsApp automatique est devenu, dit
  // discrètement sous les boutiques (jamais une fenêtre).
  const [noteRecuWa, setNoteRecuWa] = useState("");
  const bqDe = (nom) => (db.boutiques || []).find((b) => b.nom === nom) || {};
  // Timo (13/09/2026) : « appliquer la même règle que dans Ventes pour
  // restructurer les dettes » — UNE dette dépliée à la fois (la suite des
  // articles au clic sur la ligne, un clic sur une autre la déplie directement).
  const [detteDepliee, setDetteDepliee] = useState(null);

  const ajouter = () => {
    if (!f.client || !f.montant) { uAlert("Veuillez saisir le nom du client et le montant."); return; }
    const acompte = Math.max(0, Number(f.paye || 0));
    // ⚠ DÉFAUT TROUVÉ EN AUDIT (20/08/2026) : le « Déjà payé » était inscrit
    // sur la dette (champ `paye`) mais SANS ligne de paiement. Or la caisse du
    // jour ne compte que les lignes de paiement (Caisse.jsx). Cet argent était
    // donc bel et bien encaissé et pourtant invisible : la clôture du soir
    // était courte d'autant, sans que rien n'explique l'écart.
    // Le circuit « réservation » du même écran, lui, créait déjà cette ligne —
    // seul ce formulaire l'oubliait.
    const paiements = acompte > 0 ? [{
      id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5),
      montant: acompte, paiement: normPaiement(f.moyen), par: profile.nom,
    }] : [];
    // ⚠ Vague 2, étape 1 : la ligne porte le COMPTE du client quand il en a
    // un (client_user_id, même nom de champ que sur les prospects) — c'est ce
    // qui permettra un jour de ne montrer à chacun que SES dettes.
    save({ ...db, dettes: [{ id: uid(), client_user_id: compteClientPour(db, f.tel, f.client), numero: prochainNumeroDette(db, boutique), date: today(), boutique, client: f.client, tel: f.tel, motif: f.motif, montant: Number(f.montant), paye: acompte, paiements, par: profile.nom }, ...db.dettes] }, `Nouvelle dette ${f.client} (${fmt(Number(f.montant))}) — ${boutique}${acompte > 0 ? ` — acompte ${fmt(acompte)} (${normPaiement(f.moyen)})` : ""}`);
    setF({ client: "", tel: "", motif: "", montant: "", paye: "", moyen: PAIEMENTS[0] });
    uAlert("Dette enregistrée avec succès !");
  };

  const encaisser = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(d);
    const s = await uPrompt(`Montant reçu de ${d.client} (F) — reste dû : ${fmt(reste)}`, String(reste || ""));
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    if (m > reste) { uAlert(`Le montant dépasse le reste dû (${fmt(reste)}).`); return; }
    const moyen = await demanderMoyenPaiement();
    if (moyen === null) return;
    if (!await uConfirm(`Confirmer le versement de ${fmt(m)} de ${d.client} ?`)) return;
    const paiement = { id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), montant: m, paiement: normPaiement(moyen), par: profile.nom };
    const dApres = { ...d, paye: Number(d.paye) + m, paiements: [...(d.paiements || []), paiement] };
    save({ ...db, dettes: db.dettes.map((x) => (x.id === d.id ? dApres : x)) },
      `${estReservation(d) ? "Versement réservation" : "Paiement dette"} ${fmt(m)} de ${d.client} — ${d.boutique}`);
    uAlert("Versement enregistré !");
    // ⚠ Demande Timo : un reçu sort à CHAQUE versement, reprenant tout
    // l'historique cumulé (pas seulement celui du jour) — et devient
    // automatiquement le reçu DÉFINITIF si ce versement solde la dette.
    imprimerRecuVersement(dApres, db.boutiques.find((b) => b.nom === d.boutique) || {});
    // 🧾 Le reçu du versement part du numéro BMI (Timo, 25/09/2026), tout
    // seul. ⚠ Le mur : l'espace de la BOUTIQUE de la dette.
    const bqD = bqDe(dApres.boutique);
    setNoteRecuWa(await envoyerRecuSansQuestion({
      envoi: envoiRecuReglement({ dette: dApres, versement: paiement, boutique: bqD, fmt, dFR }),
      tel: dApres.tel, nom: dApres.client, espaceFormation: !!bqD.formation, save, profile, ref: { dette_id: dApres.id },
    }));
  };

  // ---- RÉSERVATION PRÉPAYÉE ----
  // Le client paie d'avance, par tranches. Rien ne sort du stock avant la livraison.
  const [res, setRes] = useState({ client: "", tel: "", produit_id: "", qte: "", avance: "", moyen: "Espèces", echeance: "" });
  const [panierRes, setPanierRes] = useState([]);
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);
  const totalRes = panierRes.reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);

  const ajouterArticleRes = () => {
    const p = db.produits.find((x) => x.id === res.produit_id);
    const q = Number(res.qte);
    if (!p) { uAlert("Choisissez un article."); return; }
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    setPanierRes((b) => [...b, { produit_id: p.id, nom: p.nom, qte: q, pu: Number(p.prix_vente || 0) }]);
    setRes((r) => ({ ...r, produit_id: "", qte: "" }));
  };

  const creerReservation = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!res.client.trim()) { uAlert("Indiquez le nom du client."); return; }
    if (!panierRes.length) { uAlert("Ajoutez au moins un article à la réservation."); return; }
    const avance = Number(res.avance || 0);
    if (avance > totalRes) { uAlert("L'avance dépasse le total de la réservation."); return; }
    if (!await uConfirm(`Créer la réservation de ${res.client.trim()} ?\n\nTotal : ${fmt(totalRes)}\nAvance versée : ${fmt(avance)}\nReste à payer : ${fmt(totalRes - avance)}\n\nLa marchandise ne sortira du stock qu'à la livraison.`)) return;
    const r = {
      id: uid(), client_user_id: compteClientPour(db, res.tel, res.client), numero: prochainNumeroDette(db, boutique), type: "prepaye", date: today(), boutique, client: res.client.trim(), tel: res.tel.trim(),
      motif: `Réservation — ${panierRes.length} article(s)`,
      articles: panierRes, montant: totalRes, paye: avance,
      paiements: avance > 0 ? [{ id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), montant: avance, paiement: normPaiement(res.moyen), par: profile.nom }] : [],
      echeance: res.echeance || null, statut: "en_cours", par: profile.nom,
    };
    save({ ...db, dettes: [r, ...db.dettes] }, `Réservation prépayée ${res.client.trim()} (${fmt(totalRes)}) — ${boutique}`);
    // 🧾 Le reçu de la réservation part du numéro BMI (25/09/2026). Son avance
    // est dedans : pas de reçu de versement en plus.
    const bqR = bqDe(r.boutique);
    envoyerRecuSansQuestion({
      envoi: envoiRecuReservation({ reservation: r, boutique: bqR, fmt, dFR }),
      tel: r.tel, nom: r.client, espaceFormation: !!bqR.formation, save, profile, ref: { dette_id: r.id },
    }).then(setNoteRecuWa);
    setPanierRes([]);
    setRes({ client: "", tel: "", produit_id: "", qte: "", avance: "", moyen: "Espèces", echeance: "" });
    uAlert("✅ Réservation créée.");
  };

  // Livraison : c'est SEULEMENT ici que le stock sort et que la vente est créée.
  // ⚠ Décision Timo : une réservation, c'est le client qui paie AVANT
  // d'emporter — elle ne devrait normalement être livrée qu'une fois soldée.
  // S'il faut livrer avant que ce soit soldé (le client insiste), ce n'est
  // plus une réservation : elle BASCULE en dette classique — quitte
  // définitivement la liste des réservations, réapparaît dans "Dettes" avec
  // tout son historique de versements conservé (relançable comme une dette
  // normale). Le CA, lui, NE CHANGE PAS : une dette classique compte déjà sa
  // valeur totale au CA dès la livraison (comportement existant, partout
  // ailleurs dans l'app) — la bascule aligne juste le CLASSEMENT de la
  // fiche sur ce qui se passe réellement, elle ne touche à aucun calcul.
  const livrer = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(r);
    const basculeEnDette = reste > 0;
    if (basculeEnDette && !await uConfirm(`⚠ ${r.client} n'a pas tout payé : il reste ${fmt(reste)}.\n\nCe n'est plus une réservation prépayée si elle est livrée maintenant — elle va devenir une DETTE CLASSIQUE (elle quittera la liste des réservations pour rejoindre "Dettes", avec son historique de versements conservé). Continuer ?`)) return;
    const manquants = (r.articles || []).filter((l) => {
      const p = db.produits.find((x) => x.id === l.produit_id);
      return !p || stockActuel(db, p) < Number(l.qte);
    });
    if (manquants.length) { uAlert(`Stock insuffisant pour :\n${manquants.map((m) => m.nom).join("\n")}\n\nRavitaillez la boutique avant de livrer.`); return; }
    if (!await uConfirm(`Livrer la réservation de ${r.client} ?\n\n${(r.articles || []).length} article(s), ${fmt(r.montant)}\n\nLe stock sera déduit et la vente enregistrée.`)) return;
    const vente = {
      // 2.99.44 (Lot C) : cette vente n'avait AUCUN numéro (le reçu affichait
      // un numéro de secours dérivé de l'id) — elle entre maintenant dans la
      // même numérotation séquentielle que les ventes normales.
      id: uid(), client_user_id: r.client_user_id ?? compteClientPour(db, r.tel, r.client), numero: prochainNumeroVente(db, r.boutique),
      date: today(), heure: new Date().toTimeString().slice(0, 5), boutique: r.boutique, client: r.client, tel: r.tel,
      // ⚠ VRAI BUG trouvé par Timo (préexistant, pas introduit par les
      // réservations créées depuis Ventes.jsx) : les articles d'une
      // réservation portent un champ `nom` (voir creerReservation ci-dessus),
      // alors que tout le reste de l'app — dont le reçu imprimé — attend
      // `article`. Résultat : la description restait VIDE sur le reçu de
      // vente émis à la livraison. Corrigé en remappant ici, au seul endroit
      // où une réservation devient une vraie vente.
      articles: (r.articles || []).map((l) => ({ produit_id: l.produit_id, article: l.nom, qte: l.qte, pu: l.pu })),
      // ⚠ Demande Timo : sur le reçu d'une réservation livrée SANS être
      // soldée, il faut voir "Avance versée" et "RESTE À PAYER" — exactement
      // ce que sait déjà faire imprimerRecu() pour toute vente marquée
      // "Crédit (dette)" (voir impression.js). Il suffit donc de la marquer
      // ainsi ici, avec l'avance déjà versée reprise — sans toucher au
      // gabarit d'impression, qui gère déjà ce cas pour les ventes normales.
      remise: 0, paiement: basculeEnDette ? "Crédit (dette)" : "Prépayé", avance: basculeEnDette ? r.paye : 0,
      // ⚠ Repris de la réservation (r.commercial etc.) — pas systématiquement
      // null : sinon un commercial/apporteur choisi lors d'une vente à crédit
      // "non livrée" (Ventes.jsx) perdrait sa commission pour toujours, faute
      // d'avoir jamais été reporté sur la vraie vente créée ici.
      commercial: r.commercial || null, responsable: r.responsable || null,
      rabais: r.rabais || 0, apporteur: r.apporteur || null,
      par: profile.nom, reservation_id: r.id,
    };
    save({
      ...db,
      ventes: [vente, ...db.ventes],
      dettes: basculeEnDette
        // Bascule : la fiche RÉSERVATION disparaît (filter), remplacée par
        // une DETTE CLASSIQUE toute neuve — historique de versements et
        // montant/payé intégralement conservés, seul le classement change.
        ? [
            { id: uid(), client_user_id: r.client_user_id ?? compteClientPour(db, r.tel, r.client), numero: r.numero || prochainNumeroDette(db, r.boutique), date: today(), boutique: r.boutique, client: r.client, tel: r.tel, motif: "Vente livrée avant solde (ex-réservation)", articles: r.articles || [], montant: r.montant, paye: r.paye, paiements: r.paiements || [], par: r.par || profile.nom, vente_id: vente.id, date_livraison: today() },
            ...db.dettes.filter((x) => x.id !== r.id),
          ]
        : db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "livree", date_livraison: today(), vente_id: vente.id } : x)),
    }, basculeEnDette
      ? `Réservation de ${r.client} livrée AVANT solde — basculée en dette classique (${fmt(reste)} restant) — ${r.boutique}`
      : `Livraison de la réservation de ${r.client} (${fmt(r.montant)}) — ${r.boutique}`);
    imprimerRecu(vente, db.boutiques.find((b) => b.nom === r.boutique) || {}, db.produits);
  };

  const annulerReservation = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    if (Number(r.paye || 0) > 0 && !await uConfirm(`⚠ ${r.client} a déjà versé ${fmt(r.paye)}.\n\nAnnuler la réservation ? Vous devrez lui rembourser cette somme À LA MAIN (enregistrez-la en dépense).`)) return;
    if (Number(r.paye || 0) === 0 && !await uConfirm(`Annuler la réservation de ${r.client} ?`)) return;
    save({ ...db, dettes: db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "annulee", date_annulation: today() } : x)) },
      `Réservation de ${r.client} ANNULÉE (${fmt(r.paye || 0)} déjà versés)`);
  };

  // ---- 📲 RELANCER UNE DETTE, DU NUMÉRO BMI (20/09/2026, décision « c ») ----
  // Capture Timo : « la relance de dette ouvre encore le WhatsApp sur
  // l'ordinateur ». Ce n'était pas un défaut, ça n'avait jamais été
  // construit — l'étape 1 du 19/09 ne portait que sur les devis.
  //
  // ⚠ L'ÉCHÉANCE SE CHERCHE ICI, pas dans la règle pure : la règle reçoit
  // une date et un montant, jamais la base entière (leçon du 18/09). La
  // chaîne est dette → chantier (`dette_id`) → devis (`devis_id`) → son plan.
  const echeanceDeLaDette = (d) => {
    const chantier = (db.clients_installes || []).find((c) => c.dette_id === d.id);
    if (!chantier?.devis_id) return null;
    const compte = (db.users || []).find((u) => u.id === chantier.user_id);
    const devis = (compte?.devis || []).find((x) => x.id === chantier.devis_id);
    const plan = devis?.plan_reglement;
    // ⚠ UN PLAN SEULEMENT S'IL EST ACCEPTÉ : un plan proposé mais pas encore
    // validé par l'administrateur n'engage personne, et annoncer sa date au
    // client reviendrait à lui promettre un échéancier qui n'existe pas.
    if (!plan || plan.statut !== PLAN_ACCEPTE) return null;
    return prochaineEcheance(plan, soldeApresAcompte(devis), Number(d.paye || 0));
  };

  const relancer = async (d) => {
    const compte = compteClientPour(db, d);
    const echeance = echeanceDeLaDette(d);
    const envoi = envoiRappelDette({ dette: d, compte, echeance, fmt, dFR });
    // Une dette soldée ne se relance pas — la règle le dit, l'écran le répète.
    if (!envoi) { uAlert("Cette dette est soldée : il n'y a rien à relancer."); return; }
    const texte = texteRappel({ dette: d, compte, echeance, fmt, dFR });
    // ⚠ LE MUR : c'est l'espace de la DETTE qui décide, jamais celui de la
    // personne qui clique — l'administrateur principal est un compte RÉEL
    // même quand il regarde la formation.
    const r = await envoyerModele({
      tel: d.tel,
      modele: envoi.modele,
      variables: envoi.variables,
      espaceFormation: espaceDeLaDette(db, d, profile),
      texteRepli: texte,
      demanderConfirmation: uConfirm,
    });
    if (!r.auto) {
      // ⚠ UN REPLI MUET RESSEMBLE À UNE PANNE (leçon du 19/09) : on dit
      // POURQUOI le message n'est pas parti du numéro BMI, sauf quand c'est
      // la règle qui joue (formation) — là, personne n'a rien à apprendre.
      if (r.motif) uAlert(`${r.motif}\n\nWhatsApp s'est ouvert avec le texte : le message part de VOTRE numéro.`);
      return;
    }
    // ⚠ LA TRACE NE S'ÉCRIT QUE SI LE MESSAGE EST PARTI DU NUMÉRO BMI : une
    // ouverture WhatsApp ne prouve rien, personne ne sait si le vendeur a
    // appuyé sur envoyer.
    const trace = traceEnvoi({ modele: envoi.modele, par: profile.nom, par_id: profile.id, quand: today(), heure: heureCourte(), id: r.id });
    // 📲 23/09/2026 : la relance s'écrit AUSSI dans la conversation du client
    // (📲 WhatsApp), sinon elle ne remonte jamais (Timo). État COURANT, et
    // le propriétaire de la conversation ne change pas.
    save((etat) => ({
      ...etat,
      dettes: etat.dettes.map((x) => (x.id === d.id ? { ...x, envoi_whatsapp: trace } : x)),
      messages: r.auto ? messagesAvecLigneEnvoi(etat.messages, { profile, tel: d.tel, nom: compte?.nom_base || compte?.nom || d.client, modele: envoi.modele, variables: envoi.variables, ref: { dette_id: d.id } }) : etat.messages,
    }),
      `Relance de la dette de ${d.client} (${fmt(Math.max(0, d.montant - d.paye))}) envoyée du numéro BMI — ${d.boutique}`);
    uAlert(`✅ Message envoyé du numéro BMI à ${d.client}.`);
  };

  const supprimerDette = async (d) => {
    if (refuserSaufAdmin(profile, "Supprimer une dette")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (await uConfirm(`Supprimer la dette de ${d.client} (${fmt(d.montant)}) ?`)) {
      save({ ...db, dettes: db.dettes.filter((x) => x.id !== d.id) }, `Suppression dette ${d.client} (${fmt(d.montant)}) — ${d.boutique}`);
    }
  };

  const liste = db.dettes.filter((x) => x.boutique === boutique && !estReservation(x));
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);
  const mesReservations = db.dettes.filter((x) => x.boutique === boutique && estReservation(x) && x.statut !== "annulee");
  const statut = (d) => (d.montant - d.paye <= 0 ? "Payée" : d.paye > 0 ? "Partielle" : "En cours");

  const dettesEnRetard = liste.filter(d => {
    // UNE règle (lib/rappels.js) : la tournée du matin des notifications
    // la lit aussi — jamais une copie ici.
    return detteEnRetard(d, today());
  });

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="dettes" db={db} value={bq} onChange={setBq} profile={profile} />}
      {noteRecuWa && <div data-recu-whatsapp className="text-xs text-slate-600">{noteRecuWa}</div>}

      <div className="rounded-xl p-4 bg-white border-2 border-emerald-200">
        <div className="font-bold mb-1 text-emerald-800">💰 Réservation prépayée — paiement total avant d'emporter</div>
        <div className="text-xs text-slate-500 mb-4">Le prix est bloqué, les versements s'accumulent. La marchandise ne sort du stock qu'au moment de la livraison.</div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Client">
            {/* Timo (15/09/2026) : le client déjà connu de la boutique se
                propose — un clic remplit le nom ET le numéro. */}
            <ChampSuggestions valeur={res.client} onChange={(v) => setRes({ ...res, client: v })}
              onChoisir={(c) => setRes({ ...res, client: c.valeur, tel: c.tel || res.tel })}
              suggestions={propositionsClients(clientsConnus(db, boutique), { fmt, dFR })}
              placeholder="Nom, ou numéro du client" />
          </Field>
          <Field label="Téléphone">
            <ChampSuggestions type="tel" valeur={res.tel} onChange={(v) => setRes({ ...res, tel: v })}
              onChoisir={(c) => setRes({ ...res, tel: c.valeur, client: c.nom || res.client })}
              suggestions={propositionsNumeros(clientsConnus(db, boutique), { fmt, dFR })}
              placeholder="+228 ..." />
          </Field>
          <Field label="Article">
            <select className={inputCls} value={res.produit_id} onChange={(e) => setRes({ ...res, produit_id: e.target.value })}>
              <option value="">— Choisir —</option>
              {produitsBoutique.map((p) => <option key={p.id} value={p.id}>{p.nom} — {fmt(p.prix_vente)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2 items-end">
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={res.qte} onChange={(e) => setRes({ ...res, qte: e.target.value })} /></Field>
            <button onClick={ajouterArticleRes} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter</button>
          </div>
        </div>

        {panierRes.length > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <table className="w-full text-sm">
              <tbody>
                {panierRes.map((l, i) => (
                  <tr key={i} className="border-b border-emerald-100">
                    <td className="py-1 font-semibold">{l.qte} × {l.nom}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.qte * l.pu)}</td>
                    <td className="py-1 text-right"><button onClick={() => setPanierRes(panierRes.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button></td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="pt-2">TOTAL RÉSERVÉ</td><td className="pt-2 text-right tabular-nums text-emerald-800">{fmt(totalRes)}</td><td></td></tr>
              </tbody>
            </table>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <Field label="Avance versée aujourd'hui"><input type="number" min="0" className={inputCls} value={res.avance} onChange={(e) => setRes({ ...res, avance: e.target.value })} /></Field>
              <Field label="Moyen de paiement">
                <select className={inputCls} value={res.moyen} onChange={(e) => setRes({ ...res, moyen: e.target.value })}>
                  {PAIEMENTS.filter((p) => !/Crédit/i.test(p)).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Livraison prévue (facultatif)"><input type="date" className={inputCls} value={res.echeance} onChange={(e) => setRes({ ...res, echeance: e.target.value })} /></Field>
            </div>
            <button onClick={creerReservation} className="mt-3 px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">✅ Créer la réservation</button>
          </div>
        )}

        {mesReservations.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Articles réservés", "Total", "Versé", "Reste", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {mesReservations.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-emerald-50 align-top">
                    <td className="px-3 py-2 font-semibold">{r.client}<div className="text-xs font-normal text-slate-500">{dFR(r.date)}{r.echeance ? ` · prévu ${dFR(r.echeance)}` : ""}</div></td>
                    <td className="px-3 py-2 text-xs">{(r.articles || []).map((l) => `${l.qte} × ${l.nom}`).join(", ")}</td>
                    <td className="px-3 py-2 tabular-nums font-bold">{fmt(r.montant)}</td>
                    <td className="px-3 py-2 tabular-nums text-green-700">{fmt(r.paye)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${resteAPayer(r) > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(resteAPayer(r))}</td>
                    <td className="px-3 py-2">
                      {r.statut === "livree"
                        ? <span className="text-xs font-bold text-green-700">✅ Livrée le {dFR(r.date_livraison)}</span>
                        : resteAPayer(r) <= 0
                          ? <span className="text-xs font-bold text-blue-700">💰 Soldée — à livrer</span>
                          : <span className="text-xs font-bold text-amber-600">⏳ En cours</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => imprimerRecuVersement(r, db.boutiques.find((b) => b.nom === r.boutique) || {})} className="text-xs font-bold text-sky-800 underline mr-2" title="Imprimer le reçu (avec filigrane NON LIVRÉ si pas encore livrée)">🖨 Reçu</button>
                      {r.statut !== "livree" && <button onClick={() => encaisser(r)} className="text-xs font-bold text-sky-800 underline mr-2">+ Versement</button>}
                      {r.statut !== "livree" && <button onClick={() => livrer(r)} className="text-xs font-bold text-white bg-emerald-700 rounded px-2 py-1 hover:bg-emerald-800 mr-2">📦 Livrer</button>}
                      {r.statut !== "livree" && <button onClick={() => annulerReservation(r)} className="text-xs text-red-600 underline">Annuler</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dettesEnRetard.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <span className="text-sm font-semibold text-red-700">
            ⚠ {dettesEnRetard.length} dette(s) de plus de {RETARD_DETTE_JOURS} jours à relancer
          </span>
        </div>
      )}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dette client <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Client">
            {/* Timo (15/09/2026) : le client déjà connu de la boutique se
                propose — un clic remplit le nom ET le numéro. */}
            <ChampSuggestions valeur={f.client} onChange={(v) => setF({ ...f, client: v })}
              onChoisir={(c) => setF({ ...f, client: c.valeur, tel: c.tel || f.tel })}
              suggestions={propositionsClients(clientsConnus(db, boutique), { fmt, dFR })}
              placeholder="Nom, ou numéro du client" />
          </Field>
          <Field label="Téléphone">
            <ChampSuggestions type="tel" valeur={f.tel} onChange={(v) => setF({ ...f, tel: v })}
              onChoisir={(c) => setF({ ...f, tel: c.valeur, client: c.nom || f.client })}
              suggestions={propositionsNumeros(clientsConnus(db, boutique), { fmt, dFR })}
              placeholder="+228 ..." />
          </Field>
          <Field label="Article / Motif"><input className={inputCls} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} /></Field>
          <Field label="Montant dette (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Déjà payé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
          {/* Sans ce choix, tout acompte était supposé versé en espèces — et
              un acompte Mobile Money faussait la caisse du jour dans l'autre
              sens. Affiché seulement quand il y a un acompte à qualifier. */}
          {Number(f.paye || 0) > 0 && (
            <Field label="Payé comment ?">
              <select className={inputCls} value={f.moyen} onChange={(e) => setF({ ...f, moyen: e.target.value })}>
                {PAIEMENTS.filter((x) => !/Crédit/i.test(x)).map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          )}
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dette</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Dettes — {boutique} <span className="text-sm font-normal text-slate-500">· Reste total : {fmt(liste.reduce((s, d) => s + Math.max(0, d.montant - d.paye), 0))}</span>
        </div>
        {/* Même présentation que la liste des ventes (Timo, 12 et 13/09/2026) :
            date sur une ligne, client en gras avec son téléphone dessous, un
            article par ligne (deux au plus puis « + N autres », la suite au
            CLIC sur la ligne), montants à droite, statut en pastille avec
            l'ancienneté dessous, boutons ronds. Mêmes gestes, mêmes droits :
            seule la présentation change. */}
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">
            {[["Client", "text-left"], ["Date", "text-left"], ["Motif", "text-left"], ["Dette", "text-right"], ["Payé", "text-right"], ["Reste", "text-right"], ["Statut", "text-left"], ["Actions", "text-right"]].map(([h, al], i) => <th key={h} className={`${al} px-3 py-2 whitespace-nowrap${i === 0 ? ` ${enTeteFige("bg-slate-100")}` : ""}`}>{h}</th>)}
          </tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucune dette enregistrée.</td></tr>}
            {listePage.map((d, i) => {
              const st = statut(d);
              const jours = joursDeDette(d, today());
              const estRetard = detteEnRetard(d, today());
              const reste = Math.max(0, d.montant - d.paye);
              const lignes = lignesDette(d);
              return (
                <tr key={d.id} onClick={() => setDetteDepliee((x) => (x === d.id ? null : d.id))} className={`border-t border-slate-100 align-middle cursor-pointer ${classeLigneDepliable(detteDepliee === d.id, i, estRetard ? "bg-red-50" : "")}`} title={lignes.length > ARTICLES_VISIBLES ? (detteDepliee === d.id ? "Cliquer pour replier" : "Cliquer pour voir tous les articles") : undefined}>
                  {/* Timo (13/09/2026) : la première colonne reste figée (Stocks, Dépenses, Dettes — ordinateur aussi) ; la ligne dépliée garde sa barre bleue.
                      25/09/2026 : « dans Dettes aussi figer le nom du client » — le CLIENT passe en première colonne, la date juste après. */}
                  <td className={`px-3 py-2 min-w-[150px] ${celluleFigee(fondLigneDepliable(detteDepliee === d.id, i, estRetard ? "bg-red-50" : ""), detteDepliee === d.id)}`}><div className="font-semibold text-slate-800">{d.client}</div>{d.tel ? <div className="text-xs text-slate-500">{d.tel}</div> : null}</td>
                  <td className="px-3 py-2 whitespace-nowrap"><div className="font-semibold text-slate-800">{dFR(d.date)}</div>{d.numero && <div className="text-xs text-slate-400 font-mono">{d.numero}</div>}</td>
                  <td className="px-3 py-2 min-w-[240px]">{lignes.length ? <ListeArticles lignes={lignes} deplie={detteDepliee === d.id} /> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums text-right whitespace-nowrap">{fmt(d.montant)}</td>
                  <td className="px-3 py-2 tabular-nums text-right whitespace-nowrap text-green-700">{fmt(d.paye)}</td>
                  <td className={`px-3 py-2 tabular-nums text-right whitespace-nowrap font-bold ${reste > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(reste)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${st === "Payée" ? "bg-green-100 text-green-700 border-green-200" : st === "Partielle" ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200"}`}>{st}</span>
                    <div className={`text-xs mt-0.5 ${estRetard ? "text-red-600 font-bold" : "text-slate-400"}`}>{jours} jour{jours > 1 ? "s" : ""}{estRetard ? " ⚠" : ""}</div>
                    {/* ⚠ Une trace qui ne se lit nulle part ne sert à rien (leçon du
                        registre d'outillage, 18/09). Elle dit qui, quand — jamais
                        « livré » ni « lu », qu'on ne sait pas. */}
                    {d.envoi_whatsapp && <div className="text-xs mt-0.5 text-emerald-700">📲 {libelleTrace(d.envoi_whatsapp)}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => imprimerRecuVersement(d, db.boutiques.find((b) => b.nom === d.boutique) || {})} className={boutonAction("text-sky-800 bg-sky-50 border-sky-200 hover:bg-sky-100")} title="Imprimer le reçu (avec mention 'déjà livrée' si la marchandise est déjà partie)" aria-label="Imprimer le reçu">🖨</button>
                      {st !== "Payée" && (
                        <>
                          <button onClick={() => encaisser(d)} className={boutonAction("text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100")} title="+ Paiement : enregistrer un versement du client" aria-label="Paiement">💵</button>
                          <button onClick={() => relancer(d)} className={boutonAction("text-green-700 bg-green-50 border-green-200 hover:bg-green-100")} title="Relancer le client par WhatsApp" aria-label="Relancer"><IconeWhatsApp /></button>
                        </>
                      )}
                      {profile.role === "admin" && (
                        <button onClick={() => supprimerDette(d)} className={boutonAction("text-red-600 bg-red-50 border-red-200 hover:bg-red-100")} title="Supprimer cette dette" aria-label="Supprimer">🗑</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

