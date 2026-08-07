// ============================================================
// screens/Ventes.jsx — Écran d'encaissement d'une vente (panier,
// proforma, impression, envoi WhatsApp).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { genererProforma } from "../pdf";
import { chiffresTel } from "../lib/comptesClients";
import { TYPES_INSTALLATION } from "../lib/constants";
import { LOGO, PAIEMENTS } from "../lib/constants";
import { uid, qteVente, resumeArticles, totalVente, prefixeBoutique, numeroRecu, fmt, today, dFR, telDigits, col } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm } from "../components/ui";
import { imprimerRecu, imprimerProforma, recuWhatsApp } from "../lib/impression";
import { stockActuel, tauxParrain, apporteursPossibles, boutiquesVente, bloquerSiLecture, normNom } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { SelecteurArticle } from "../components/SelecteurArticle";

// ============ VENTES ============
export function Ventes({ db, save, profile, preRempli, onPreRempliConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || preRempli?.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produits = db.produits.filter((p) => p.boutique === boutique);
  const commerciaux = apporteursPossibles(db);
  const categories = [...new Set(produits.map((p) => p.categorie || "Autre"))].sort();

  const [cat, setCat] = useState("");
  const [sel, setSel] = useState({ produit_id: "", qte: "", pu: "", remF: "", remP: "" });
  const [panier, setPanier] = useState(() => preRempli?.panier || []);
  // ATTENTION : preRempli est vidé dès l'affichage. On garde donc l'origine du
  // devis dans l'état local, sinon elle serait perdue avant l'encaissement.
  const [origineDevis, setOrigineDevis] = useState(() => preRempli?.origineDevis || null);
  // Id de la commande d'origine (si cette vente vient d'une commande validée
  // par un commercial) : permet de retrouver la vente depuis la commande,
  // et donc de savoir si une commande validée a bien été encaissée ou non.
  const [origineCommande, setOrigineCommande] = useState(() => preRempli?.commandeId || null);
  // Le devis d'origine : c'est LUI qui porte les frais d'installation et de
  // transport facturés au client. Sans ça, l'écran d'encaissement ne montrait
  // que le total des articles — le vendeur n'avait alors aucune indication du
  // montant RÉEL à demander au client (articles + frais), et la caisse ne
  // comptait jamais ces frais, même quand ils étaient bel et bien encaissés.
  const devisOrigine = origineDevis
    ? (db.users.find((u) => u.id === origineDevis.client_id)?.devis || []).find((d) => d.id === origineDevis.devis_id)
    : null;
  const fraisInstallDevis = Number(devisOrigine?.frais_installation || 0);
  const fraisTransportDevis = Number(devisOrigine?.frais_transport || 0);
  // RÉACTIF à chaque nouveau preRempli — pas seulement au tout premier
  // montage. Depuis que les écrans restent en veille plutôt que d'être
  // redémarrés entre deux visites (2.98.99), un simple useState(() => ...)
  // ne se déclenche plus qu'une fois pour toute la session : si Ventes a
  // déjà été visité avant qu'un devis soit converti, le panier du devis
  // n'arrivait plus jamais. Signalé par Timo : « convertir en vente un
  // devis ne ramène rien dans le panier du vendeur ».
  useEffect(() => {
    if (!preRempli) return;
    if (preRempli.boutique) setBq(preRempli.boutique);
    setPanier(preRempli.panier || []);
    setOrigineDevis(preRempli.origineDevis || null);
    setOrigineCommande(preRempli.commandeId || null);
    setF((f0) => ({
      ...f0,
      client: preRempli.client || f0.client,
      tel: preRempli.tel || f0.tel,
      remise: preRempli.remise ? String(preRempli.remise) : f0.remise,
      commercial: preRempli.commercial || f0.commercial,
      responsable: preRempli.responsable || f0.responsable,
      rabais: preRempli.rabais || f0.rabais,
    }));
    if (onPreRempliConsomme) onPreRempliConsomme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preRempli]);
  const [f, setF] = useState({ client: preRempli?.client || "", tel: preRempli?.tel || "", remise: preRempli?.remise ? String(preRempli.remise) : "", paiement: PAIEMENTS[0], avance: "", commercial: preRempli?.commercial || (profile.role === "commercial" ? profile.nom : ""), responsable: preRempli?.responsable || null, rabais: preRempli?.rabais || "" });
  // Apporteur d'affaires EXTERNE (pas un utilisateur de l'application)
  const [ext, setExt] = useState({ actif: false, nom: "", tel: "", taux: "", montant: "" });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  const produitsFiltres = cat ? produits.filter((p) => (p.categorie || "Autre") === cat) : produits;
  const dansPanier = (pid) => panier.reduce((s, l) => s + (l.produit_id === pid ? Number(l.qte) : 0), 0);
  const dispoRestant = (p) => stockActuel(db, p) - dansPanier(p.id);

  const choisir = (id) => {
    // Recherche dans TOUS les produits de la boutique (plus robuste)
    const p = produits.find((x) => x.id === id);
    setSel({ produit_id: id, qte: "1", pu: p && p.prix_vente != null ? String(p.prix_vente) : "", remF: "", remP: "" });
    // La catégorie de l'article choisi s'affiche automatiquement dans le filtre
    if (p) setCat(p.categorie || "Autre");
  };

  // ---- REMISE LIGNE : deux champs liés. Taper des FCFA calcule le %,
  // taper un % calcule les FCFA — toujours sur la base qté × prix unitaire. ----
  const baseLigne = () => Number(sel.qte || 0) * Number(sel.pu || 0);
  const saisirRemF = (txt) => {
    const base = baseLigne();
    const f_ = Math.max(0, Number(txt || 0));
    setSel({ ...sel, remF: txt, remP: base > 0 && txt !== "" ? String(Math.round((f_ / base) * 1000) / 10) : "" });
  };
  const saisirRemP = (txt) => {
    const base = baseLigne();
    const p_ = Math.max(0, Number(txt || 0));
    setSel({ ...sel, remP: txt, remF: base > 0 && txt !== "" ? String(Math.round((base * p_) / 100)) : "" });
  };

  const mettreAuPanier = (p, q, pu, remiseLigne = 0) => {
    setPanier((pan) => {
      const i = pan.findIndex((l) => l.produit_id === p.id && Number(l.pu) === Number(pu));
      if (i >= 0) { const cp = [...pan]; cp[i] = { ...cp[i], qte: Number(cp[i].qte) + q, remise_ligne: Number(cp[i].remise_ligne || 0) + Number(remiseLigne || 0) }; return cp; }
      return [...pan, { produit_id: p.id, article: p.nom, qte: q, pu: Number(pu), remise_ligne: Number(remiseLigne || 0) }];
    });
  };

  const ajouterAuPanier = () => {
    const p = produits.find((x) => x.id === sel.produit_id);
    const q = Number(sel.qte);
    if (!p || !q || q <= 0 || !sel.pu) { setMsg("Choisissez un article, la quantité et le prix."); return; }
    if (q > dispoRestant(p)) { setMsg(`Stock insuffisant : il reste ${dispoRestant(p)} pour « ${p.nom} ».`); return; }
    setMsg("");
    const remL = Math.max(0, Number(sel.remF || 0));
    if (remL > q * Number(sel.pu)) { setMsg("La remise de la ligne ne peut pas dépasser son montant."); return; }
    mettreAuPanier(p, q, sel.pu, remL);
    setSel({ produit_id: "", qte: "", pu: "", remF: "", remP: "" });
  };

  // Lecteur de code-barres USB : il « tape » le code puis Entrée
  const scanner = (e) => {
    if (e.key !== "Enter") return;
    const c = code.trim();
    setCode("");
    if (!c) return;
    const p = produits.find((x) => String(x.code || "").trim() === c);
    if (!p) { setMsg(`Aucun article avec le code « ${c} » dans ${boutique}. Assignez les codes dans l'onglet Stocks.`); return; }
    if (dispoRestant(p) < 1) { setMsg(`Stock épuisé pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, 1, p.prix_vente);
  };

  const retirer = (i) => setPanier(panier.filter((_, j) => j !== i));

  const brut = panier.reduce((s, l) => s + Number(l.qte) * Number(l.pu) - Number(l.remise_ligne || 0), 0);
  const totalRemisesLigne = panier.reduce((s, l) => s + Number(l.remise_ligne || 0), 0);
  const remisePct = Number(f.remise || 0);
  const remise = Math.round((brut * remisePct) / 100);
  // RABAIS COMMERCIAL : le commercial l'offre au client sur SA commission.
  // Il est plafonné au montant de sa commission — il ne peut pas donner ce qu'il n'a pas.
  const apporteurUser = db.users.find((u) => u.nom === f.commercial);
  const tauxCom = Number(apporteurUser?.taux_commission || 0);
  const rabaisMax = Math.round(((brut - remise) * tauxCom) / 100);
  const rabais = Math.min(Number(f.rabais || 0), rabaisMax);
  const total = brut - remise - rabais;
  // Ce que le vendeur doit RÉELLEMENT demander au client : le total des
  // articles, PLUS les frais d'installation et de transport du devis d'origine
  // (qui, eux, n'entrent jamais dans le chiffre d'affaires — voir plus haut).
  const totalAEncaisser = total + fraisInstallDevis + fraisTransportDevis;

  // Commission de l'apporteur externe : soit un pourcentage du total, soit un montant fixe.
  const commissionExt = (montantVente) => {
    if (!ext.actif || !ext.nom.trim()) return 0;
    const fixe = Number(ext.montant || 0);
    if (fixe > 0) return Math.round(fixe);
    const pct = Number(ext.taux || 0);
    return pct > 0 ? Math.round((montantVente * pct) / 100) : 0;
  };
  const apporteurExterne = (montantVente) => {
    if (!ext.actif || !ext.nom.trim()) return null;
    return {
      nom: ext.nom.trim(), tel: ext.tel.trim(),
      taux: Number(ext.montant || 0) > 0 ? 0 : Number(ext.taux || 0),
      montant: commissionExt(montantVente),
      payee: false,
    };
  };

  // ---- PROFORMA ----
  // Un client demande juste un prix. Le proforma N'EST PAS une vente : aucun stock
  // déduit, rien dans le chiffre d'affaires. On l'émet, on l'envoie, on l'imprime.
  const numeroProforma = () => "PRF-" + Date.now().toString(36).toUpperCase().slice(-6);

  const construireProforma = () => ({
    numero: numeroProforma(),
    date: new Date().toLocaleDateString("fr-FR"),
    boutique,
    client: f.client || "",
    tel: f.tel || "",
    lignes: panier.map((l) => ({
      article: l.article || (produits.find((x) => x.id === l.produit_id)?.nom) || "Article",
      qte: Number(l.qte), pu: Number(l.pu), remise_ligne: Number(l.remise_ligne || 0),
      total: Number(l.qte) * Number(l.pu) - Number(l.remise_ligne || 0),
    })),
    // La remise globale saisie dans la machine s'applique aussi à la proforma :
    // le client voit le sous-total, la remise, et le total net — comme sur le reçu.
    sous_total: brut,
    remise_pct: Number(remise || 0),
    remise_montant: Math.round((brut * Number(remise || 0)) / 100),
    total: brut - Math.round((brut * Number(remise || 0)) / 100),
    validite: "15 jours",
  });

  const enregistrerProforma = (pf) => {
    // On garde une trace (liste visible par vendeur / resp. commercial / admin).
    const ligne = { id: uid(), date: today(), ts: new Date().toISOString(),
      numero: pf.numero, boutique, client: pf.client, tel: pf.tel,
      sous_total: pf.sous_total, remise_pct: pf.remise_pct, remise_montant: pf.remise_montant,
      total: pf.total, lignes: pf.lignes, par: profile.nom };
    save({ ...db, proformas: [ligne, ...(db.proformas || [])] }, `Proforma ${pf.numero} émis par ${profile.nom} (${fmt(pf.total)})`);
  };

  const proformaWhatsApp = () => {
    if (panier.length === 0) { setMsg("Ajoutez au moins un article avant d'émettre un proforma."); return; }
    const pf = construireProforma();
    enregistrerProforma(pf);
    const lignes = [
      `*FACTURE PROFORMA* — BMI TOGO`,
      `N° ${pf.numero} · ${pf.date}`,
      ``,
      ...pf.lignes.map((l) => `• ${l.article} ×${l.qte} : ${l.total.toLocaleString("fr-FR")} F`),
      ``,
      ...(pf.remise_montant > 0 ? [`Sous-total : ${pf.sous_total.toLocaleString("fr-FR")} F`, `Remise ${pf.remise_pct} % : -${pf.remise_montant.toLocaleString("fr-FR")} F`] : []),
      `*TOTAL : ${pf.total.toLocaleString("fr-FR")} FCFA*`,
      ``,
      `Ceci est une offre de prix (proforma), sans valeur de reçu. Valable ${pf.validite}.`,
      `BMI TOGO — Les bâtiments modernes et intelligents`,
    ];
    const num = telDigits(pf.tel);
    const txt = encodeURIComponent(lignes.join("\n"));
    // On ouvre WhatsApp EN PREMIER et de façon strictement synchrone (avant
    // tout traitement du PDF) : dès qu'un await s'intercale avant window.open,
    // le navigateur considère que ce n'est plus une action directe de l'utilisateur
    // et bloque l'ouverture silencieusement — c'était la cause du souci.
    // Le numéro du client (déjà saisi sur la commande) est utilisé directement :
    // la discussion s'ouvre sur SON contact, pas sur un choix générique.
    window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
    // Le PDF est généré et téléchargé juste après, prêt à être joint au message.
    genererProforma(pf, LOGO);
    setMsg(num
      ? `✅ Proforma ${pf.numero} émis : WhatsApp ouvert sur le numéro du client et PDF téléchargé — joignez-le au message (non comptabilisé).`
      : `✅ Proforma ${pf.numero} émis : aucun numéro sur cette commande, WhatsApp ouvert en générique. PDF téléchargé, à joindre au message (non comptabilisé).`);
  };

  const proformaPDF = () => {
    if (panier.length === 0) { setMsg("Ajoutez au moins un article avant d'émettre un proforma."); return; }
    const pf = construireProforma();
    enregistrerProforma(pf);
    imprimerProforma(pf, LOGO);
    setMsg(`✅ Proforma ${pf.numero} imprimé (non comptabilisé).`);
  };

  const encaisserVente = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (panier.length === 0) { setMsg("Le panier est vide : ajoutez au moins un article."); return; }
    if (remisePct < 0 || remisePct > 100) { setMsg("La remise doit être comprise entre 0 et 100 %."); return; }
    for (const l of panier) {
      const p = produits.find((x) => x.id === l.produit_id);
      if (p && Number(l.qte) > stockActuel(db, p)) { setMsg(`Stock insuffisant pour « ${p.nom} ».`); return; }
    }
    setMsg("");
    const messageConfirm = (fraisInstallDevis > 0 || fraisTransportDevis > 0)
      ? `Confirmer la vente de ${panier.length} article(s) ?\n\nArticles : ${fmt(total)}${remise ? ` (remise ${remisePct} % = −${fmt(remise)})` : ""}\n${fraisInstallDevis > 0 ? `Frais d'installation : ${fmt(fraisInstallDevis)}\n` : ""}${fraisTransportDevis > 0 ? `Transport : ${fmt(fraisTransportDevis)}\n` : ""}\nMONTANT TOTAL À ENCAISSER : ${fmt(totalAEncaisser)}`
      : `Confirmer la vente de ${panier.length} article(s) pour ${fmt(total)}${remise ? ` (remise ${remisePct} % = −${fmt(remise)})` : ""} ?`;
    if (!await uConfirm(messageConfirm)) return;

    const annee = today().slice(0, 4);
    const numero = `${prefixeBoutique(boutique)}-${annee}-${String(db.ventes.filter((x) => x.boutique === boutique && String(x.date).slice(0, 4) === annee).length + 1).padStart(4, "0")}`;
    const vente = {
      id: uid(),
      numero,
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      boutique,
      articles: panier,
      client: f.client || "Client non renseigné",
      tel: f.tel,
      remise,
      remise_pct: remisePct,
      // Frais du devis d'origine, réellement encaissés en plus des articles —
      // jamais comptés dans le chiffre d'affaires, mais désormais tracés :
      // visibles sur le reçu, comptés en caisse, et disponibles pour la
      // répartition d'équipe sans ressaisie.
      frais_installation: fraisInstallDevis,
      frais_transport: fraisTransportDevis,
      paiement: f.paiement,
      avance: f.paiement === "Crédit (dette)" ? Math.max(0, Math.min(total, Number(f.avance) || 0)) : 0,
      commercial: f.commercial || null,
      responsable: f.responsable || null,
      rabais,                                   // rabais RÉELLEMENT appliqué (plafonné à sa commission)
      apporteur: apporteurExterne(total),
      par: profile.nom,
      commande_id: origineCommande,
    };

    let next = { ...db, ventes: [vente, ...db.ventes] };

    // ══════ LE PAIEMENT D'UN DEVIS DÉCLENCHE L'INSTALLATION ══════
    // C'est ici que le devis devient un chantier. Tant que le client n'a pas
    // payé, rien n'est programmé : c'est l'encaissement qui engage BMI.
    const od = origineDevis;
    if (od) {
      const compteClient = db.users.find((u) => u.id === od.client_id);
      const devisPaye = (compteClient?.devis || []).find((x) => x.id === od.devis_id);

      const chantier = {
        id: uid(),
        date: today(),
        nom: compteClient?.nom_base || compteClient?.nom || f.client || "Client",
        prenom: "",
        tel: compteClient?.tel || f.tel || "",
        user_id: od.client_id,                 // le client suivra son chantier depuis son espace
        type_installation: TYPES_INSTALLATION[0],
        date_installation: "",                 // ← à programmer par l'admin ou le resp. commercial
        date_entretien: "",
        localisation: "",
        lat: null, lng: null,
        vente_id: vente.id,
        devis_id: od.devis_id,
        commercial: od.par_role === "commercial" || od.par_role === "technicien" ? devisPaye?.par : null,
        garantie_mois: 24,
        equipe: [],                            // ← à composer par l'admin ou le resp. commercial
        materiel: (devisPaye?.lignes || []).map((l) => ({ nom: l.article, qte: l.qte, serie: "" })),
        // Les frais d'installation facturés dans le devis sont repris ici : c'est
        // l'enveloppe qui servira à payer l'équipe (répartition dans Clients installés).
        frais_installation: Number(devisPaye?.frais_installation || 0),
        statut: "en_cours",
        a_programmer: true,                    // signale qu'il attend une date et une équipe
      };

      // La vente est reliée au chantier : la commission ne sera due qu'à la
      // réception des travaux par le client.
      vente.installation_id = chantier.id;
      vente.commission_a_la_reception = od.par_role === "commercial" || od.par_role === "technicien";

      // ---- LE PARRAIN DU CLIENT ----
      // Si ce client a été amené par un autre client, celui-ci touche sa part.
      // Il est enregistré comme APPORTEUR : le mécanisme de paiement existe déjà
      // (👑 Équipe), on ne réinvente rien. Sa part est elle aussi bloquée
      // jusqu'à la réception des travaux.
      const parrain = compteClient?.parrain_client_id
        ? db.users.find((u) => u.id === compteClient.parrain_client_id)
        : null;
      if (parrain && !vente.apporteur) {
        const tx = tauxParrain(parrain, db);
        vente.apporteur = {
          nom: parrain.nom_base || parrain.nom,
          tel: parrain.tel || "",
          taux: tx,
          montant: Math.round((total * tx) / 100),
          payee: false,
          parrain_user_id: parrain.id,   // ← permet au parrain de suivre ses gains
          a_la_reception: true,          // ← bloqué jusqu'à la réception
        };
      }

      // Le prospect devient CLIENT : on le clôture, sinon les commerciaux
      // continueraient de relancer quelqu'un qui a déjà payé et été installé.
      const telClient = chiffresTel(compteClient?.tel || f.tel || "");
      const prospectsMaj = (db.prospects || []).map((pr) => {
        const correspond = pr.client_user_id === od.client_id
          || (telClient.length >= 6 && chiffresTel(pr.tel) === telClient);
        return correspond && !pr.converti
          ? { ...pr, converti: true, statut: "Client acquis", date_conversion: today(), vente_id: vente.id }
          : pr;
      });

      next = {
        ...next,
        // `next.ventes` contient DÉJÀ cette vente (ajoutée plus haut). On ne la
        // rajoute donc pas : on garde next.ventes tel quel pour éviter tout doublon.
        clients_installes: [chantier, ...(db.clients_installes || [])],
        prospects: prospectsMaj,
        users: db.users.map((u) => (u.id === od.client_id
          ? { ...u, devis: (u.devis || []).map((x) => (x.id === od.devis_id
              ? { ...x, statut: "paye", paye_le: today(), vente_id: vente.id, chantier_id: chantier.id }
              : x)) }
          : u)),
      };
    }
    if (f.paiement === "Crédit (dette)") {
      const avance = Math.max(0, Math.min(total, Number(f.avance) || 0));
      if (await uConfirm(`Enregistrer cette vente à crédit pour ${f.client || "ce client"} ?\n\nTotal : ${fmt(total)}\nAvance versée : ${fmt(avance)}\nReste à payer : ${fmt(total - avance)}`)) {
        const paiementsInitiaux = avance > 0 ? [{ date: today(), montant: avance, par: profile.nom }] : [];
        next = { ...next, dettes: [{ id: uid(), date: today(), boutique, client: f.client || "Client non renseigné", tel: f.tel, motif: resumeArticles(vente), montant: total, paye: avance, paiements: paiementsInitiaux, par: profile.nom }, ...db.dettes] };
      }
    }
    const noteRemLigne = totalRemisesLigne > 0 ? ` — remises ligne : −${fmt(totalRemisesLigne)}` : "";
    save(next, od
      ? `Vente ${numero} (${fmt(total)}) — ${boutique}${noteRemLigne} — DEVIS PAYÉ : chantier créé, à programmer`
      : `Vente ${numero} (${fmt(total)}) — ${boutique}${noteRemLigne}`);
    // Le reçu s'imprime immédiatement, sans clic supplémentaire : au comptoir,
    // l'encaissement et le reçu ne font qu'un geste.
    try { imprimerRecu(vente, infoBq(boutique), db.produits); } catch {}
    if (od) {
      setOrigineDevis(null); // consommé : une seule fiche d'installation par devis
      uAlert("✅ Devis encaissé.\n\nUne fiche d'installation a été créée automatiquement. L'administrateur ou le responsable commercial va programmer la date et l'équipe.");
    }
    setPanier([]);
    setF({ client: "", tel: "", remise: "", paiement: PAIEMENTS[0], avance: "", commercial: profile.role === "commercial" ? profile.nom : "", rabais: "" });
    setExt({ actif: false, nom: "", tel: "", taux: "", montant: "" });
    setCat("");
  };

  const supprimerVente = async (v) => {
    if (await uConfirm(`Supprimer la vente ${numeroRecu(v)} (${fmt(totalVente(v))}) du ${dFR(v.date)} ?`)) {
      save({ ...db, ventes: db.ventes.filter((x) => x.id !== v.id) }, `Suppression vente ${numeroRecu(v)} (${fmt(totalVente(v))}) — ${v.boutique}`);
    }
  };

  const liste = db.ventes.filter((v) => v.boutique === boutique);
  const totalJour = liste.filter((v) => String(v.date) === today()).reduce((s, v) => s + totalVente(v), 0);

  // ---- Listes regroupées : Ventes (par défaut) / Proformas, avec recherche ----
  const [vueListe, setVueListe] = useState("ventes");
  const [rechercheListe, setRechercheListe] = useState("");
  const voitProformas = ["vendeur", "gerant", "resp_commercial", "admin"].includes(profile.role);
  const proformasListe = db.proformas || [];
  const qListe = normNom(rechercheListe);
  // Ordre DÉCROISSANT : les ventes et proformas les plus récentes d'abord
  // (ventes : date + heure ; proformas : date + horodatage précis).
  const cleDate = (x) => `${x.date || ""} ${x.heure || ""} ${x.ts || ""}`;
  const triDesc = (a, b) => cleDate(b).localeCompare(cleDate(a));
  const listeFiltree = (!qListe ? liste : liste.filter((x) => normNom(`${numeroRecu(x)} ${x.client || ""} ${x.tel || ""}`).includes(qListe))).slice().sort(triDesc);
  const proformasFiltres = (!qListe ? proformasListe : proformasListe.filter((pf) => normNom(`${pf.numero || ""} ${pf.client || ""} ${pf.tel || ""}`).includes(qListe))).slice().sort(triDesc);
  const btnVue = (actif) => `px-4 py-1.5 rounded-lg text-sm font-bold ${actif ? "bg-sky-800 text-white" : "bg-white border border-slate-300 text-slate-600 hover:bg-slate-100"}`;
  const infoBq = (nom) => db.boutiques.find((b) => b.nom === nom) || {};

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle vente <Badge boutique={boutique} /></div>
        {produits.length === 0 ? (
          <div className="text-sm text-slate-600">Aucun article en stock. L'administrateur doit d'abord enregistrer les articles dans Stocks.</div>
        ) : (
          <>
            <div className="mb-3">
              <Field label="🔍 Scanner un code-barres (le lecteur USB tape le code puis Entrée)">
                <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={scanner} placeholder="Scannez ou tapez le code puis Entrée…" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Catégorie (filtre facultatif)">
                <select className={inputCls} value={cat} onChange={(e) => { setCat(e.target.value); setSel({ produit_id: "", qte: "", pu: "", remF: "", remP: "" }); }}>
                  <option value="">— Toutes —</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Article">
                <SelecteurArticle produits={produits} valeur={sel.produit_id} onChoisir={choisir} dispoRestant={dispoRestant} categorieFiltre={cat} />
              </Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={sel.qte} onChange={(e) => setSel({ ...sel, qte: e.target.value })} /></Field>
              <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={sel.pu} onChange={(e) => setSel({ ...sel, pu: e.target.value, remF: "", remP: "" })} /></Field>
              <Field label="Remise ligne (F)"><input type="number" min="0" className={inputCls} value={sel.remF} onChange={(e) => saisirRemF(e.target.value)} placeholder="0" /></Field>
              <Field label="Remise ligne (%)"><input type="number" min="0" max="100" step="0.1" className={inputCls} value={sel.remP} onChange={(e) => saisirRemP(e.target.value)} placeholder="0" /></Field>
              <div className="flex items-end"><button onClick={ajouterAuPanier} className={`w-full ${btnDark}`}>➕ Ajouter au panier</button></div>
            </div>

            <div className="mt-4 bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <div className="px-3 py-2 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">🛒 Panier ({panier.length} article{panier.length > 1 ? "s" : ""})</div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "P.U.", "Remise", "Montant", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {panier.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-400">Panier vide — scannez ou choisissez des articles.</td></tr>}
                  {panier.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{l.article}</td>
                      <td className="px-3 py-2 tabular-nums">{l.qte}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(l.pu)}</td>
                      <td className="px-3 py-2 tabular-nums text-red-600">{Number(l.remise_ligne || 0) > 0 ? `−${fmt(l.remise_ligne)}` : "—"}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.qte * l.pu - Number(l.remise_ligne || 0))}</td>
                      <td className="px-3 py-2"><button onClick={() => retirer(i)} className="text-xs text-red-600 underline">Retirer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label={origineDevis ? "Payeur (si différent du client)" : "Client (facultatif)"}><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} placeholder={origineDevis ? "Pré-rempli avec le nom du client — modifiez si quelqu'un d'autre paie" : ""} /></Field>
              <Field label={origineDevis ? "Son numéro" : "Numéro du client"}><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
              {origineDevis ? (
                Number(f.remise || 0) > 0 && (
                  <Field label="Remise (déjà fixée sur le devis)">
                    <div className={`${inputCls} bg-slate-50 text-slate-600 flex items-center`}>{f.remise} %</div>
                  </Field>
                )
              ) : (
                <Field label="Remise (%) — facultatif"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.remise} onChange={(e) => setF({ ...f, remise: e.target.value })} /></Field>
              )}
              {f.commercial && tauxCom > 0 && (
                <Field label={`Rabais offert par ${f.commercial} (F)`}>
                  <input type="number" min="0" max={rabaisMax} className={inputCls} value={f.rabais} onChange={(e) => setF({ ...f, rabais: e.target.value })} />
                  <div className="text-xs text-orange-600 mt-1 font-semibold">
                    Maximum : {fmt(rabaisMax)} — pris sur sa commission, pas sur la marge BMI.
                  </div>
                </Field>
              )}
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={ext.actif} onChange={(e) => setExt({ ...ext, actif: e.target.checked })} />
                  🤝 Un <b>apporteur externe</b> (non-utilisateur) a amené ce client
                </label>
                {ext.actif && (
                  <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <Field label="Nom et prénom(s)"><input className={inputCls} value={ext.nom} onChange={(e) => setExt({ ...ext, nom: e.target.value })} /></Field>
                    <Field label="Téléphone"><input className={inputCls} value={ext.tel} onChange={(e) => setExt({ ...ext, tel: e.target.value })} /></Field>
                    <Field label="Commission (%)"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={ext.taux} onChange={(e) => setExt({ ...ext, taux: e.target.value, montant: "" })} /></Field>
                    <Field label="… ou montant fixe (F)"><input type="number" min="0" className={inputCls} value={ext.montant} onChange={(e) => setExt({ ...ext, montant: e.target.value, taux: "" })} /></Field>
                    <div className="sm:col-span-2 lg:col-span-4 text-sm font-bold text-amber-800">
                      Commission de {ext.nom || "l'apporteur"} : <span className="tabular-nums">{fmt(commissionExt(total))}</span>
                    </div>
                  </div>
                )}
              </div>
              <Field label="Paiement">
                <select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>
                  {PAIEMENTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              {f.paiement === "Crédit (dette)" && (
                <Field label="Avance versée (facultatif)">
                  <input type="number" min="0" placeholder="0" className={inputCls} value={f.avance || ""} onChange={(e) => setF({ ...f, avance: e.target.value })} />
                </Field>
              )}
              {(profile.role === "commercial" || f.commercial) ? (
                <Field label="Commercial"><input className={inputCls} value={f.commercial || profile.nom} disabled /></Field>
              ) : commerciaux.length > 0 && (
                <Field label="Commercial (facultatif)">
                  <select className={inputCls} value={f.commercial} onChange={(e) => setF({ ...f, commercial: e.target.value })}>
                    <option value="">— Aucun —</option>
                    {commerciaux.map((c) => <option key={c.id} value={c.nom}>{c.nom}{c.taux ? ` — ${c.taux} %` : ""}</option>)}
                  </select>
                </Field>
              )}
            </div>

            {(fraisInstallDevis > 0 || fraisTransportDevis > 0) && (
              <div className="mt-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
                <div className="font-bold text-amber-900 text-sm mb-1">🔧 Ce devis inclut des frais en plus des articles</div>
                <div className="text-sm text-slate-700 space-y-0.5">
                  <div>Articles : {fmt(total)}</div>
                  {fraisInstallDevis > 0 && <div>Frais d'installation : {fmt(fraisInstallDevis)}</div>}
                  {fraisTransportDevis > 0 && <div>Transport / livraison : {fmt(fraisTransportDevis)}</div>}
                </div>
                <div className="text-base font-bold text-amber-900 mt-2 pt-2 border-t border-amber-300">
                  MONTANT TOTAL À DEMANDER AU CLIENT : {fmt(totalAEncaisser)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Les frais ne sont pas comptés dans le chiffre d'affaires (ils servent à payer l'équipe d'installation) — mais ils sont bien réels : demandez le montant total ci-dessus.</div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button onClick={encaisserVente} className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800 shadow-sm">💳 Encaisser la vente</button>
              <button onClick={proformaWhatsApp} title="Envoyer une offre de prix au client (non comptabilisée)" className="px-4 py-2.5 rounded-lg bg-white border-2 border-sky-400 text-sky-700 font-bold text-sm hover:bg-sky-50">🧾 Proforma WhatsApp</button>
              <button onClick={proformaPDF} title="Imprimer une offre de prix (non comptabilisée)" className="px-3 py-2.5 rounded-lg bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50">🖨️</button>
              <span className="text-base font-bold tabular-nums">Total{fraisInstallDevis > 0 || fraisTransportDevis > 0 ? " articles" : ""} : {fmt(total)}{remise > 0 && <span className="text-red-600 text-sm font-semibold"> (remise −{fmt(remise)})</span>}</span>
              {msg && <span className="text-sm text-red-600 font-semibold">{msg}</span>}
            </div>
          </>
        )}
      </Panel>

      {/* ══════ VENTES & PROFORMAS : regroupés, ventes par défaut, recherche ══════ */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2">
            <button onClick={() => setVueListe("ventes")} className={btnVue(vueListe === "ventes")}>💰 Ventes ({liste.length})</button>
            {voitProformas && <button onClick={() => setVueListe("proformas")} className={btnVue(vueListe === "proformas")}>🧾 Proformas ({proformasListe.length})</button>}
          </div>
          {vueListe === "ventes"
            ? <span className="text-sm font-semibold text-slate-500">{boutique} — Aujourd'hui : {fmt(totalJour)}</span>
            : <span className="text-xs font-semibold text-slate-500">Offres de prix — non comptabilisées dans le chiffre d'affaires</span>}
        </div>
        <div className="px-4 py-2 border-b border-slate-100 bg-white">
          <input value={rechercheListe} onChange={(e) => setRechercheListe(e.target.value)} placeholder="🔍 Rechercher par numéro ou nom de client…" className={inputCls} />
        </div>
        <div className="max-h-[480px] overflow-y-auto">
        {vueListe === "proformas" && voitProformas ? (
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Date", "N°", "Client", "Articles", "Total", "Émis par", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {proformasFiltres.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">{qListe ? "Aucune proforma ne correspond à la recherche." : "Aucune proforma émise pour l'instant."}</td></tr>}
              {proformasFiltres.map((pf) => (
                <tr key={pf.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(pf.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{pf.numero}</td>
                  <td className="px-3 py-2">{pf.client || "—"}{pf.tel ? <span className="text-slate-400"> · {pf.tel}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-500">{(pf.lignes || []).length} article(s)</td>
                  <td className="px-3 py-2 font-semibold">{fmt(pf.total)}</td>
                  <td className="px-3 py-2 text-slate-500">{pf.par}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => imprimerProforma({ numero: pf.numero, date: dFR(pf.date), boutique: pf.boutique, client: pf.client, tel: pf.tel, lignes: pf.lignes, total: pf.total, validite: "15 jours" }, LOGO)} className="text-xs text-sky-700 underline">🖨️ Réimprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm min-w-[1000px]">
          <thead className="sticky top-0 z-10"><tr className="text-xs text-slate-500 uppercase bg-slate-100">{["Date", "N° reçu", "Articles", "Client", "Qté", "Remise", "Total", "Paiement", "Commercial", "Reçu", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {listeFiltree.length === 0 && <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-400">{qListe ? "Aucune vente ne correspond à la recherche." : "Aucune vente pour l'instant."}</td></tr>}
            {listeFiltree.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date)}{v.heure ? ` ${v.heure}` : ""}</td>
                <td className="px-3 py-2 font-mono text-xs">{numeroRecu(v)}</td>
                <td className="px-3 py-2 font-semibold">{resumeArticles(v)}</td>
                <td className="px-3 py-2">{v.client || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{qteVente(v)}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{v.remise ? `−${fmt(v.remise)}${v.remise_pct ? ` (${v.remise_pct} %)` : ""}` : "—"}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(totalVente(v))}</td>
                <td className="px-3 py-2">{v.paiement}</td>
                <td className="px-3 py-2">{v.commercial || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  <button onClick={() => imprimerRecu(v, infoBq(v.boutique), db.produits)} className="text-xs font-bold text-sky-800 underline mr-2" title="Imprimer le reçu">🖨</button>
                  <button onClick={() => recuWhatsApp(v, infoBq(v.boutique))} className="text-xs font-bold text-green-700 underline" title="Envoyer par WhatsApp">WhatsApp</button>
                </td>
                <td className="px-3 py-2">
                  {profile.role === "admin" && (
                    <button onClick={() => supprimerVente(v)} className="text-xs text-red-600 underline">Suppr.</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        </div>
      </div>
    </div>
  );
}

