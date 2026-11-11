// ============================================================
// components/CommandesImport.jsx — 🛒 LES COMMANDES À L'ÉTRANGER (Alibaba…)
//
// Timo, 10/11/2026 (« 1b, 2a, 3a, 4b », puis « a, lance ») : une commande
// porte ses articles et son étape, ses paiements en dollars au taux du jour,
// ses frais (plusieurs intervenants), et à la réception le prix de revient
// rendu Lomé. Les règles vivent dans lib/commandesImport.js.
//
// ⚠ Paiements et frais sont des DÉPENSES ordinaires (construireDepenseSaisie :
// validation du DG au-delà de 5 000 F, limite du tiroir) qui portent
// `commande_import` — elles ne se modifient ni ne se suppriment depuis
// 📤 Dépenses (calculs.js / validationDepenses.js).
// ⚠ Le prix d'achat d'un article EXISTANT ne change que par l'administrateur
// (règle du 04/09, gardée par le serveur, securite-4) : reçue par le gérant,
// la commande garde les prix calculés et l'administrateur les applique.
// ============================================================
import { useState, useEffect } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { libelleCaisse, CATEGORIE_FRAIS_IMPORT } from "../lib/constants";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt, uChoix, demanderMoyenPaiement, BoutonRond, PanneauQuiSeMontre } from "./ui";
import { ChampSuggestions } from "./ChampSuggestions";
import { bloquerSiLecture, refuserSaufRoles, refuserSaufAdmin, ROLES_FOURNISSEURS, boutiquesVisibles, boutiquesVente, stockActuel, normNom, estAdminPrincipal, espaceDuCompte } from "../lib/calculs";
import { construireDepenseSaisie, optionsPayeAvec, interpreterPayeAvec, PAYE_AVEC_CAISSE } from "../lib/validationDepenses";
import { critiqueSortieTiroir, fondsAVerser } from "../lib/versements";
import {
  ETAPES_COMMANDE, libelleEtape, etapeSuivante, MODE_CALCUL, MODE_CONNU, SORTES_FRAIS,
  nombreSaisi, fmtDevise, commandesDe, estEnCours, prochainNumeroCommande, critiqueCommande, ligneRangee,
  totalDevise, etatPaiements, etatFrais, etatDeLaDepense, critiquePaiement, critiqueFrais, calculerCouts,
  prixMoyen, critiqueReception, resteAPayerAuTaux, prixAAppliquer,
  critiqueModification, depensesRattachables, DEVISES_SAISIE, dollarsDepuis, critiqueRattachement, CATEGORIES_RATTACHABLES,
} from "../lib/commandesImport";
import { CAISSE_DG, CAISSE_BANQUE, CAISSE_COMPTABLE } from "../lib/caissesCentrales";

const LIGNE_VIDE = () => ({ id: uid(), produit_id: null, nom: "", qte: "", pu: "", mode: MODE_CALCUL, prix_connu: "" });

export function CommandesImport({ db, save, profile, fournisseurs, commandePour, onCommandePourFini }) {
  const admin = profile.role === "admin";
  const principal = estAdminPrincipal(db, profile);
  const [ouverte, setOuverte] = useState(null); // id de la commande dépliée
  const [voirRecues, setVoirRecues] = useState(false);
  const [forme, setForme] = useState(null); // la nouvelle commande en cours de saisie
  const [reception, setReception] = useState(null); // { cmdId, qtes, taux }
  const [rattache, setRattache] = useState(null); // 🔗 { cmdId, choix: { depense_id → { coche, type, devise, montant, taux, sorte } } }

  // Les lieux : boutiques ET magasins de l'espace regardé (jamais la caisse DÉPÔT CHANTIER).
  const lieux = boutiquesVisibles(db, profile, (db.boutiques || []).filter((b) => !b.terrain));
  const nomsCaisses = boutiquesVisibles(db, profile, boutiquesVente(db)).map((b) => b.nom);
  const formation = espaceDuCompte(db, profile) === true;
  // Les caisses dont on peut rattacher une dépense : l'espace regardé (le mur),
  // plus les caisses centrales en réel.
  const nomsDepenses = [...boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom),
    ...(formation ? [] : [CAISSE_DG, CAISSE_BANQUE, CAISSE_COMPTABLE])];

  const toutes = commandesDe(fournisseurs).sort((a, b) => String(b.le).localeCompare(String(a.le)));
  const enCours = toutes.filter(estEnCours);
  const finies = toutes.filter((c) => !estEnCours(c));

  // Ouvrir le formulaire depuis la ligne d'un fournisseur (bouton 🛒).
  useEffect(() => {
    if (!commandePour) return;
    setForme({ fournisseur_id: commandePour, lieu: lieux[0]?.nom || "", lignes: [LIGNE_VIDE()], note: "" });
    onCommandePourFini?.();
  }, [commandePour]); // eslint-disable-line react-hooks/exhaustive-deps

  const fournisseurDe = (c) => (db.fournisseurs || []).find((x) => x.id === c.fournisseur_id);
  const ecrireCommande = (base, fid, cid, maj) => ({
    ...base,
    fournisseurs: (base.fournisseurs || []).map((fo) => (fo.id !== fid ? fo : {
      ...fo, commandes_import: (fo.commandes_import || []).map((c) => (c.id === cid ? maj(c) : c)),
    })),
  });
  const commandeFraiche = (c) => (fournisseurDe(c)?.commandes_import || []).find((x) => x.id === c.id);
  const garde = (geste) => refuserSaufRoles(profile, ROLES_FOURNISSEURS, geste) || bloquerSiLecture(db, profile);

  // ---- 1. CRÉER ----
  const produitsDuLieu = (lieu) => (db.produits || []).filter((p) => p.boutique === lieu);
  const enregistrerCommande = () => {
    if (garde("Enregistrer une commande à l'étranger")) return;
    const fo = (db.fournisseurs || []).find((x) => x.id === forme.fournisseur_id);
    if (!fo) { uAlert("Choisissez le fournisseur."); return; }
    const lignes = forme.lignes.filter((l) => String(l.nom).trim() || l.qte || l.pu);
    if (forme.modif) { modifierCommande(fo, lignes); return; }
    const refus = critiqueCommande({ lieu: forme.lieu, lignes });
    if (refus) { uAlert(refus); return; }
    const numero = prochainNumeroCommande(db.fournisseurs, today().slice(0, 4));
    const cmd = { id: uid(), numero, le: today(), par: profile.nom, par_id: profile.id ?? null, lieu: forme.lieu,
      etape: "commandee", etapes: {}, lignes: lignes.map(ligneRangee), paiements: [], frais: [], note: String(forme.note || "").trim() };
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, commandes_import: [...(x.commandes_import || []), cmd] } : x)) },
      `🛒 Commande ${numero} chez ${fo.nom} : ${cmd.lignes.length} article(s), ${fmtDevise(totalDevise(cmd))} — réception à ${forme.lieu}`);
    setForme(null);
    setOuverte(cmd.id);
    uAlert(`✅ Commande ${numero} enregistrée (${fmtDevise(totalDevise(cmd))}).\n\nRien n'est encore payé ni en stock : enregistrez les paiements et les frais sur la commande, puis « ✅ Réceptionner » à l'arrivée.`);
  };

  // ---- 1 bis. ✏️ MODIFIER (11/11/2026, « A a » : tout sauf le fournisseur) ----
  const ouvrirModification = (c0) => {
    if (garde("Modifier une commande à l'étranger")) return;
    const c = commandeFraiche(c0);
    if (!c || c.annulee || c.etape === "recue") { uAlert("Cette commande ne se modifie plus (reçue ou annulée)."); return; }
    setReception(null); setRattache(null);
    setForme({ modif: c.id, fournisseur_id: c0.fournisseur_id, lieu: c.lieu, note: c.note || "",
      lignes: (c.lignes || []).map((l) => ({ id: l.id, produit_id: l.produit_id || null, nom: l.nom, qte: String(l.qte), pu: String(l.pu), mode: l.mode || MODE_CALCUL, prix_connu: l.prix_connu != null ? String(l.prix_connu) : "" })) });
  };
  const modifierCommande = async (fo, lignes) => {
    const c = (fo.commandes_import || []).find((x) => x.id === forme.modif);
    const refus = critiqueModification(c, { lieu: forme.lieu, lignes }, db.depenses);
    if (refus) { uAlert(refus); return; }
    const nouvelles = lignes.map(ligneRangee);
    const avant = totalDevise(c), apres = totalDevise({ lignes: nouvelles });
    if (!await uConfirm(`Enregistrer les modifications de la commande ${c.numero} ?\n\nTotal : ${fmtDevise(avant)} → ${fmtDevise(apres)} · ${nouvelles.length} article(s) · réception à ${libelleCaisse(forme.lieu)}.`)) return;
    const trace = { le: today(), par: profile.nom, total_avant: avant, total_apres: apres };
    save((etat) => ecrireCommande(etat, fo.id, c.id, (x) => ({ ...x, lieu: forme.lieu, note: String(forme.note || "").trim(), lignes: nouvelles,
      modifications: [...(x.modifications || []), trace] })),
    `✏️ Commande ${c.numero} (${fo.nom}) modifiée : ${fmtDevise(avant)} → ${fmtDevise(apres)}, ${nouvelles.length} article(s), réception à ${forme.lieu}`);
    setForme(null);
    setOuverte(c.id);
  };

  // ---- 2. D'OÙ SORT L'ARGENT ? (paiement ou frais) ----
  const choisirOrigine = async (montantF, libelle, lieu) => {
    const moyen = await demanderMoyenPaiement(libelle);
    if (!moyen) return null;
    if (moyen === "Virement bancaire") return { moyen, choix: { paye_avec: PAYE_AVEC_CAISSE, boutique: lieu }, libelle: "🏦 BANQUE (virement)" };
    const options = optionsPayeAvec(nomsCaisses, lieu, { avecComptable: !formation });
    const choisi = await uChoix(`Payé avec — ${fmt(montantF)} :`, options.map(([, l]) => l));
    if (!choisi) return null;
    const code = (options.find(([, l]) => l === choisi) || [])[0];
    return { moyen, choix: interpreterPayeAvec(code, lieu), libelle: choisi };
  };
  const preparerDepense = (origine, { categorie, description, montant }) => {
    const r = construireDepenseSaisie(db, profile, { ...origine.choix, categorie, description, montant, paiement: origine.moyen }, today());
    if (r.refus) return r;
    if (r.depense.paiement === "Espèces" && r.depense.paye_avec === PAYE_AVEC_CAISSE) {
      const p = fondsAVerser(db, origine.choix.boutique, totalVente);
      const refusT = critiqueSortieTiroir({ tiroir: p.montant + p.resteFonds, fondsFixe: p.resteFonds, montant, geste: "Ce paiement", boutique: origine.choix.boutique });
      if (refusT) return { refus: refusT };
    }
    return r;
  };
  const phraseDG = (r) => (r.aValider && !principal ? `\n\n⏳ Au-delà de 5 000 F : la dépense attend la validation du DG et ne comptera qu'une fois validée.` : "");

  // ---- 3. PAYER LE FOURNISSEUR (en dollars, au taux du jour) ----
  const payer = async (c0) => {
    if (garde("Payer une commande à l'étranger")) return;
    const c = commandeFraiche(c0);
    const e = etatPaiements(c, db.depenses);
    const s = await uPrompt(`Paiement à ${c0.fournisseur_nom} — commande ${c.numero}.\nReste à payer : ${fmtDevise(e.resteDevise)}.\n\nMontant payé en DOLLARS :`, e.resteDevise ? String(e.resteDevise) : "");
    if (s === null) return;
    const t = await uPrompt("Taux du jour : combien de francs pour 1 dollar ?", c.dernier_taux ? String(c.dernier_taux) : "");
    if (t === null) return;
    const refus = critiquePaiement(c, { montant_devise: s, taux: t }, db.depenses);
    if (refus) { uAlert(refus); return; }
    const md = nombreSaisi(s); const tx = nombreSaisi(t); const mf = Math.round(md * tx);
    const origine = await choisirOrigine(mf, `à ${c0.fournisseur_nom}`, c.lieu);
    if (!origine) return;
    const r = preparerDepense(origine, { categorie: "Commande en Chine", description: `Paiement ${c0.fournisseur_nom} — commande ${c.numero} : ${fmtDevise(md)} × ${tx}`, montant: mf });
    if (r.refus) { uAlert(r.refus); return; }
    if (!await uConfirm(`Payer ${fmtDevise(md)} × ${tx} = ${fmt(mf)} à ${c0.fournisseur_nom} (commande ${c.numero}), payé avec : ${origine.libelle} ?${phraseDG(r)}`)) return;
    const dep = { ...r.depense, commande_import: { fournisseur_id: c0.fournisseur_id, fournisseur: c0.fournisseur_nom, commande_id: c.id, numero: c.numero, type: "paiement" } };
    const paiement = { id: uid(), le: today(), montant_devise: md, taux: tx, montant_f: mf, depense_id: dep.id, par: profile.nom };
    save((etat) => ({ ...ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, dernier_taux: tx, paiements: [...(x.paiements || []), paiement] })),
      depenses: [dep, ...(etat.depenses || [])], messages: [...r.messages, ...(etat.messages || [])] }),
    `${r.journal} — paiement commande ${c.numero} (${fmtDevise(md)} × ${tx})`);
  };

  // ---- 4. UN FRAIS (fret, transitaire, douane…) ----
  const ajouterFrais = async (c0) => {
    if (garde("Ajouter un frais à une commande")) return;
    const c = commandeFraiche(c0);
    let sorte = await uChoix(`Quel frais pour la commande ${c.numero} ?`, [...SORTES_FRAIS, "✏️ Autre…"]);
    if (!sorte) return;
    if (sorte === "✏️ Autre…") { sorte = await uPrompt("De quel frais s'agit-il ?"); if (!sorte) return; }
    const qui = await uPrompt(`${sorte} — payé à qui (nom du transitaire, de l'agent…) ?`);
    if (qui === null) return;
    const s = await uPrompt(`${sorte}${qui ? ` — ${qui}` : ""} : montant en FRANCS :`);
    if (s === null) return;
    const refus = critiqueFrais(c, { sorte, montant: s });
    if (refus) { uAlert(refus); return; }
    const m = Math.round(nombreSaisi(s));
    const origine = await choisirOrigine(m, `pour ${sorte}`, c.lieu);
    if (!origine) return;
    const r = preparerDepense(origine, { categorie: CATEGORIE_FRAIS_IMPORT, description: `${sorte}${qui ? ` — ${String(qui).trim()}` : ""} — commande ${c.numero} (${c0.fournisseur_nom})`, montant: m });
    if (r.refus) { uAlert(r.refus); return; }
    if (!await uConfirm(`Frais « ${sorte} » de ${fmt(m)} sur la commande ${c.numero}, payé avec : ${origine.libelle} ?\n\nIl sera réparti sur les articles « à calculer » au prorata de leur valeur.${phraseDG(r)}`)) return;
    const dep = { ...r.depense, commande_import: { fournisseur_id: c0.fournisseur_id, fournisseur: c0.fournisseur_nom, commande_id: c.id, numero: c.numero, type: "frais" } };
    const frais = { id: uid(), le: today(), sorte, qui: String(qui || "").trim(), montant: m, depense_id: dep.id, par: profile.nom };
    save((etat) => ({ ...ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, frais: [...(x.frais || []), frais] })),
      depenses: [dep, ...(etat.depenses || [])], messages: [...r.messages, ...(etat.messages || [])] }),
    `${r.journal} — frais « ${sorte} » commande ${c.numero}`);
  };

  // ---- 5. RETIRER un paiement ou un frais saisi par erreur (administrateur, avant réception) ----
  const retirer = async (c0, genre, item) => {
    if (refuserSaufAdmin(profile, "Retirer un paiement ou un frais d'une commande")) return;
    if (bloquerSiLecture(db, profile)) return;
    const c = commandeFraiche(c0);
    if (c.etape === "recue") { uAlert("La commande est reçue : ses prix de revient sont calculés, plus rien ne se retire."); return; }
    const montant = genre === "paiements" ? item.montant_f : item.montant;
    if (item.rattachee) {
      if (!await uConfirm(`Détacher ce ${genre === "paiements" ? "paiement" : "frais"} de ${fmt(montant)} de la commande ${c.numero} ?\n\nLa dépense reste dans 📤 Dépenses, telle qu'elle était avant d'être rattachée.`)) return;
      save((etat) => ({ ...ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, [genre]: (x[genre] || []).filter((y) => y.id !== item.id) })),
        depenses: (etat.depenses || []).map((d) => { if (d.id !== item.depense_id) return d; const { commande_import, ...reste } = d; return reste; }) }),
      `🔗 Commande ${c.numero} : ${genre === "paiements" ? "paiement" : "frais"} de ${fmt(montant)} détaché (la dépense reste dans 📤 Dépenses)`);
      return;
    }
    if (!await uConfirm(`Retirer ce ${genre === "paiements" ? "paiement" : "frais"} de ${fmt(genre === "paiements" ? item.montant_f : item.montant)} ?\n\nSa dépense est supprimée avec lui : l'argent est compté de nouveau dans la caisse qui l'avait payé.`)) return;
    save((etat) => ({ ...ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, [genre]: (x[genre] || []).filter((y) => y.id !== item.id) })),
      depenses: (etat.depenses || []).filter((d) => d.id !== item.depense_id) }),
    `🛒 Commande ${c.numero} : ${genre === "paiements" ? "paiement" : "frais"} de ${fmt(genre === "paiements" ? item.montant_f : item.montant)} retiré`);
  };

  // ---- 5 bis. 🔗 RATTACHER DES DÉPENSES DÉJÀ PAYÉES (11/11/2026) ----
  const ouvrirRattachement = (c0) => {
    if (garde("Rattacher des dépenses à une commande")) return;
    setReception(null);
    setRattache({ cmdId: c0.id, choix: {} });
  };
  const fixeChoix = (id, champs) => setRattache((r) => ({ ...r, choix: { ...r.choix, [id]: { type: "paiement", devise: "dollars", montant: "", taux: "", sorte: "", ...(r.choix[id] || {}), ...champs } } }));
  const rattacher = async (c0) => {
    if (garde("Rattacher des dépenses à une commande")) return;
    const c = commandeFraiche(c0);
    const coches = Object.entries(rattache.choix).filter(([, x]) => x.coche);
    const lot = [];
    for (const [id, x] of coches) {
      const d = (db.depenses || []).find((y) => y.id === id);
      if (!d) { uAlert("Une des dépenses choisies n'existe plus : rouvrez la liste."); return; }
      if (x.type === "paiement") {
        const r = dollarsDepuis({ devise: x.devise, montant: x.montant, taux: x.taux, francs: d.montant });
        if (r.refus) { uAlert(`${dFR(d.date)} · ${fmt(d.montant)} : ${r.refus}`); return; }
        lot.push({ depense_id: id, d, type: "paiement", md: r.md, taux: r.taux, devise: x.devise, saisie: x.devise === "dollars" ? null : { montant: x.montant, taux: x.taux } });
      } else lot.push({ depense_id: id, d, type: "frais", sorte: String(x.sorte || "").trim() });
    }
    const refus = critiqueRattachement(c, lot, db.depenses);
    if (refus) { uAlert(refus); return; }
    const texte = lot.map((x) => x.type === "paiement"
      ? `• ${dFR(x.d.date)} · ${fmt(x.d.montant)} → paiement de ${fmtDevise(x.md)} (taux ${x.taux} F / $)`
      : `• ${dFR(x.d.date)} · ${fmt(x.d.montant)} → frais « ${x.sorte} »`).join("\n");
    if (!await uConfirm(`Rattacher ${lot.length} dépense(s) à la commande ${c.numero} ?\n\n${texte}\n\nRien n'est dépensé de nouveau : les dépenses existent déjà. Elles ne se modifieront plus depuis 📤 Dépenses.`)) return;
    const marque = (x) => ({ fournisseur_id: c0.fournisseur_id, fournisseur: c0.fournisseur_nom, commande_id: c.id, numero: c.numero, type: x.type, rattachee: { le: today(), par: profile.nom } });
    const paiements = lot.filter((x) => x.type === "paiement").map((x) => ({ id: uid(), le: x.d.date || today(), montant_devise: x.md, taux: x.taux, montant_f: Number(x.d.montant), depense_id: x.depense_id, par: profile.nom, rattachee: true, devise_saisie: x.devise, ...(x.saisie ? { saisie: x.saisie } : {}) }));
    const frais = lot.filter((x) => x.type === "frais").map((x) => ({ id: uid(), le: x.d.date || today(), sorte: x.sorte, qui: "", montant: Number(x.d.montant), depense_id: x.depense_id, par: profile.nom, rattachee: true }));
    const parId = Object.fromEntries(lot.map((x) => [x.depense_id, x]));
    save((etat) => ({ ...ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, paiements: [...(x.paiements || []), ...paiements], frais: [...(x.frais || []), ...frais] })),
      depenses: (etat.depenses || []).map((d) => (parId[d.id] ? { ...d, commande_import: marque(parId[d.id]) } : d)) }),
    `🔗 Commande ${c.numero} : ${lot.length} dépense(s) déjà payée(s) rattachée(s) — ${lot.map((x) => `${fmt(x.d.montant)} (${x.type === "paiement" ? fmtDevise(x.md) : x.sorte})`).join(" ; ")}`);
    setRattache(null);
  };

  // ---- 6. L'ÉTAPE ----
  const avancer = async (c0) => {
    if (garde("Changer l'étape d'une commande")) return;
    const c = commandeFraiche(c0);
    const suite = etapeSuivante(c.etape);
    if (!suite) return;
    if (!await uConfirm(`Commande ${c.numero} : passer à « ${libelleEtape(suite)} » ?`)) return;
    save((etat) => ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, etape: suite, etapes: { ...(x.etapes || {}), [suite]: { le: today(), par: profile.nom } } })),
      `🛒 Commande ${c.numero} → ${libelleEtape(suite)}`);
  };

  const annuler = async (c0) => {
    if (refuserSaufAdmin(profile, "Annuler une commande à l'étranger")) return;
    if (bloquerSiLecture(db, profile)) return;
    const c = commandeFraiche(c0);
    if ((c.paiements || []).length || (c.frais || []).length) { uAlert("Cette commande porte des paiements ou des frais : retirez-les d'abord (🗑), ou réceptionnez-la."); return; }
    const motif = await uPrompt(`Annuler la commande ${c.numero} — pourquoi ?`);
    if (!motif || !motif.trim()) return;
    save((etat) => ecrireCommande(etat, c0.fournisseur_id, c.id, (x) => ({ ...x, annulee: { le: today(), par: profile.nom, motif: motif.trim() } })),
      `🛒 Commande ${c.numero} annulée : ${motif.trim()}`);
  };

  // ---- 7. LA RÉCEPTION ----
  const ouvrirReception = (c) => setReception({ cmdId: c.id, qtes: Object.fromEntries((c.lignes || []).map((l) => [l.id, String(l.qte)])), taux: c.dernier_taux ? String(c.dernier_taux) : "" });
  const receptionner = async (c0) => {
    if (garde("Réceptionner une commande à l'étranger")) return;
    const c = commandeFraiche(c0);
    const qtes = Object.fromEntries(Object.entries(reception.qtes).map(([k, v]) => [k, v === "" ? 0 : nombreSaisi(v)]));
    const opts = { qtes, tauxReste: nombreSaisi(reception.taux) };
    const refus = critiqueReception(c, db.depenses, opts);
    if (refus) { uAlert(refus); return; }
    const calc = calculerCouts(c, db.depenses, opts);
    const produits = produitsDuLieu(c.lieu);
    const fo = fournisseurDe(c0);
    const lignes = calc.lignes.filter((l) => l.qte > 0).map((l) => {
      const p = produits.find((x) => x.id === l.produit_id) || produits.find((x) => normNom(x.nom) === normNom(l.nom)) || null;
      const avant = p ? stockActuel(db, p) : 0;
      return { ...l, produit: p, stock_avant: avant, prix_avant: p ? Number(p.prix_achat || 0) : 0, prix_moyen: p ? prixMoyen(avant, p.prix_achat, l.qte, l.cout) : l.cout };
    });
    const nouveaux = lignes.filter((l) => !l.produit);
    const texte = lignes.map((l) => `• ${l.qte} × ${l.nom} : revient à ${fmt(l.cout)}${l.mode === MODE_CONNU ? " (prix connu)" : ""}${l.produit ? ` → prix d'achat ${fmt(l.prix_moyen)}${l.stock_avant > 0 && l.prix_avant > 0 ? ` (moyenne avec ${l.stock_avant} en stock à ${fmt(l.prix_avant)})` : ""}` : " → nouvel article"}`).join("\n");
    const manque = (c.lignes || []).filter((l) => (qtes[l.id] ?? l.qte) < l.qte).map((l) => `${l.qte - (qtes[l.id] ?? l.qte)} × ${l.nom}`);
    if (!await uConfirm(`Réceptionner la commande ${c.numero} à ${libelleCaisse(c.lieu)} ?\n\nTaux retenu : ${Number.isFinite(calc.taux) ? Math.round(calc.taux * 100) / 100 : "—"} F / $ · frais répartis : ${fmt(calc.frais)}\n\n${texte}`
      + (manque.length ? `\n\n⚠ Pas reçu : ${manque.join(", ")} — à régler avec le fournisseur.` : "")
      + (calc.fraisPerdus ? "\n\n⚠ Aucun article « à calculer » : les frais ne sont répartis sur aucun prix." : "")
      + (nouveaux.length ? `\n\n🆕 ${nouveaux.length} article(s) seront créés dans le stock avec un prix de vente à 0 F : fixez leur prix de vente dans 📦 Stocks avant de les vendre.` : "")
      + (admin ? "" : "\n\n🔒 Les prix d'achat des articles déjà en stock seront appliqués par l'administrateur (« 💲 Appliquer les prix »)."))) return;
    const ids = Object.fromEntries(lignes.map((l) => [l.ligne_id, l.produit?.id || uid()]));
    const recue = {
      le: today(), par: profile.nom, par_id: profile.id ?? null, taux: calc.taux, frais: calc.frais,
      lignes: lignes.map((l) => ({ ligne_id: l.ligne_id, produit_id: ids[l.ligne_id], nom: l.nom, qte: l.qte, cout: l.cout, part_frais: l.part_frais, nouveau: !l.produit, prix_avant: l.prix_avant, prix_moyen: l.prix_moyen })),
      ...(admin || !lignes.some((l) => l.produit) ? { prix_appliques_le: today(), prix_appliques_par: profile.nom } : {}),
    };
    save((etat) => {
      const parId = Object.fromEntries(lignes.filter((l) => l.produit).map((l) => [l.produit.id, l]));
      const existants = (etat.produits || []).map((p) => {
        const l = parId[p.id];
        if (!l) return p;
        return { ...p, entrees: Number(p.entrees || 0) + l.qte, ...(admin ? { prix_achat: l.prix_moyen } : {}) };
      });
      const crees = nouveaux.map((l) => ({ id: ids[l.ligne_id], boutique: c.lieu, nom: l.nom, domaine: "", categorie: "Autre", fournisseur: fo?.nom || "",
        initial: 0, entrees: l.qte, seuil: 0, prix_achat: l.cout, prix_vente: 0, code: "", tension: "" }));
      return { ...ecrireCommande({ ...etat, produits: [...existants, ...crees] }, c0.fournisseur_id, c.id, (x) => ({ ...x, etape: "recue", etapes: { ...(x.etapes || {}), recue: { le: today(), par: profile.nom } }, reception: recue })) };
    }, `🛒 Commande ${c.numero} reçue à ${c.lieu} : ${lignes.map((l) => `+${l.qte} « ${l.nom} » (revient à ${l.cout})`).join(" ; ")}`);
    setReception(null);
  };

  // ---- 8. APPLIQUER LES PRIX (administrateur) ----
  const appliquerPrix = async (c0) => {
    if (refuserSaufAdmin(profile, "Appliquer les prix d'achat d'une commande")) return;
    if (bloquerSiLecture(db, profile)) return;
    const c = commandeFraiche(c0);
    if (!prixAAppliquer(c)) return;
    const lignes = (c.reception.lignes || []).filter((l) => !l.nouveau);
    if (!await uConfirm(`Appliquer les prix d'achat de la commande ${c.numero} ?\n\n${lignes.map((l) => `• ${l.nom} : ${fmt(l.prix_avant)} → ${fmt(l.prix_moyen)}`).join("\n")}\n\n(Calculés à la réception, moyenne avec le stock d'alors.)`)) return;
    const parId = Object.fromEntries(lignes.map((l) => [l.produit_id, l]));
    save((etat) => ({
      ...ecrireCommande({ ...etat, produits: (etat.produits || []).map((p) => (parId[p.id] ? { ...p, prix_achat: parId[p.id].prix_moyen } : p)) },
        c0.fournisseur_id, c.id, (x) => ({ ...x, reception: { ...x.reception, prix_appliques_le: today(), prix_appliques_par: profile.nom } })),
    }), `🛒 Commande ${c.numero} : prix d'achat appliqués — ${lignes.map((l) => `« ${l.nom} » ${l.prix_avant} → ${l.prix_moyen}`).join(" ; ")}`);
  };

  // ---- L'AFFICHAGE ----
  const fixeLigne = (i, champs) => setForme({ ...forme, lignes: forme.lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)) });
  const suggestions = forme ? produitsDuLieu(forme.lieu).map((p) => ({ cle: p.id, produit_id: p.id, valeur: p.nom, detail: `${stockActuel(db, p)} en stock · achat ${fmt(p.prix_achat)}` })) : [];

  const panneauRattachement = (c) => {
    const liste = depensesRattachables(db.depenses, nomsDepenses);
    const nb = Object.values(rattache.choix).filter((x) => x.coche).length;
    return (
      <div data-panneau-rattachement className="rounded-lg border-2 border-green-300 p-3 space-y-2">
        <div className="font-semibold">🔗 Dépenses déjà payées — cochez celles qui concernent la commande {c.numero}</div>
        <div className="text-xs text-slate-600">Catégories « {CATEGORIES_RATTACHABLES.join(" » et « ")} », pas encore rattachées à une commande. Rien n'est dépensé de nouveau.</div>
        {liste.length === 0 && <div className="text-slate-500">Aucune dépense libre dans ces catégories.</div>}
        {liste.map((d) => {
          const x = rattache.choix[d.id] || {};
          return (
            <div key={d.id} data-depense-rattachable className={`border rounded-lg p-2 ${x.coche ? "border-green-400 bg-green-50" : "border-slate-200"}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" className="mt-1" checked={!!x.coche} onChange={(e) => fixeChoix(d.id, { coche: e.target.checked })} />
                <span><span className="font-semibold tabular-nums">{fmt(d.montant)}</span> · {dFR(d.date)} · {d.categorie} · {libelleCaisse(d.boutique)}{d.validation?.statut === "attente" ? <span className="text-amber-700"> · ⏳ à valider par le DG</span> : null}
                  {d.description ? <span className="block text-xs text-slate-600">{d.description}</span> : null}</span>
              </label>
              {x.coche && (
                <div className="grid sm:grid-cols-4 gap-2 mt-2">
                  <Field label="C'est">
                    <select className={inputCls} value={x.type || "paiement"} onChange={(e) => fixeChoix(d.id, { type: e.target.value })}>
                      <option value="paiement">Un paiement au fournisseur</option>
                      <option value="frais">Un frais (fret, douane…)</option>
                    </select>
                  </Field>
                  {(x.type || "paiement") === "paiement" ? (<>
                    <Field label="Montant dit">
                      <select data-devise-rattachement className={inputCls} value={x.devise || "dollars"} onChange={(e) => fixeChoix(d.id, { devise: e.target.value })}>
                        {DEVISES_SAISIE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </Field>
                    {(x.devise || "dollars") !== "cfa" && <Field label={(x.devise || "dollars") === "yuan" ? "Montant (¥)" : "Montant ($)"}><input type="number" step="0.01" className={inputCls} value={x.montant || ""} onChange={(e) => fixeChoix(d.id, { montant: e.target.value })} /></Field>}
                    {(x.devise || "dollars") !== "dollars" && <Field label={x.devise === "yuan" ? "Taux (¥ pour 1 $)" : "Taux (F pour 1 $)"}><input type="number" step="0.01" className={inputCls} value={x.taux || ""} onChange={(e) => fixeChoix(d.id, { taux: e.target.value })} /></Field>}
                  </>) : (
                    <Field label="Quel frais ?">
                      <select className={inputCls} value={SORTES_FRAIS.includes(x.sorte) || !x.sorte ? (x.sorte || "") : "autre"} onChange={(e) => fixeChoix(d.id, { sorte: e.target.value === "autre" ? " " : e.target.value })}>
                        <option value="">— Choisir —</option>
                        {SORTES_FRAIS.map((s) => <option key={s} value={s}>{s}</option>)}
                        <option value="autre">✏️ Autre…</option>
                      </select>
                      {x.sorte && !SORTES_FRAIS.includes(x.sorte) && <input className={`${inputCls} mt-1`} placeholder="De quel frais s'agit-il ?" value={x.sorte.trim() ? x.sorte : ""} onChange={(e) => fixeChoix(d.id, { sorte: e.target.value || " " })} />}
                    </Field>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="flex gap-2">
          <button onClick={() => rattacher(c)} disabled={!nb} className={btnDark}>Rattacher {nb ? `(${nb})` : ""}</button>
          <button onClick={() => setRattache(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">Annuler</button>
        </div>
      </div>
    );
  };

  const carte = (c) => {
    const ep = etatPaiements(c, db.depenses);
    const ef = etatFrais(c, db.depenses);
    const deplie = ouverte === c.id;
    const enRecep = reception?.cmdId === c.id;
    return (
      <div key={c.id} data-commande-import={c.numero} className="border border-slate-200 rounded-lg">
        <button onClick={() => setOuverte(deplie ? null : c.id)} className="w-full text-left px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">{c.numero}</span>
          <span className="text-slate-700">{c.fournisseur_nom}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">{c.annulee ? "✖ Annulée" : libelleEtape(c.etape)}</span>
          <span className="text-sm tabular-nums">{fmtDevise(ep.total)} · payé {fmtDevise(ep.payeDevise)}{ep.resteDevise > 0 && !c.annulee && c.etape !== "recue" ? <span className="text-red-600"> · reste {fmtDevise(ep.resteDevise)}</span> : null}</span>
          {ef.total > 0 && <span className="text-sm text-slate-600">frais {fmt(ef.total)}</span>}
          {prixAAppliquer(c) && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">💲 prix à appliquer</span>}
          <span className="text-xs text-slate-500 ml-auto">{dFR(c.le)} · {libelleCaisse(c.lieu)}</span>
        </button>
        {deplie && (
          <div className="px-3 pb-3 space-y-3 text-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "Prix $", "Total $", "Prix"].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                <tbody>{(c.lignes || []).map((l) => {
                  const r = c.reception?.lignes?.find((x) => x.ligne_id === l.id);
                  return (<tr key={l.id} className="border-t border-slate-100">
                    <td className="px-2 py-1">{l.nom}{!l.produit_id && <span className="text-xs text-slate-500"> · nouvel article</span>}</td>
                    <td className="px-2 py-1 tabular-nums">{l.qte}{r && r.qte !== l.qte ? <span className="text-amber-700"> (reçu {r.qte})</span> : null}</td>
                    <td className="px-2 py-1 tabular-nums">{fmtDevise(l.pu)}</td>
                    <td className="px-2 py-1 tabular-nums">{fmtDevise(l.qte * l.pu)}</td>
                    <td className="px-2 py-1">{l.mode === MODE_CONNU ? <span>connu : {fmt(l.prix_connu)}</span> : <span className="text-slate-500">à calculer</span>}{r ? <div data-prix-revient className="text-xs font-semibold text-green-700">revient à {fmt(r.cout)}{r.part_frais ? ` (dont ${fmt(Math.round(r.part_frais / Math.max(1, r.qte)))} de frais)` : ""}</div> : null}</td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
            {c.note && <div className="text-slate-600">📝 {c.note}</div>}
            {(c.modifications || []).length > 0 && <div className="text-xs text-slate-500">✏️ Modifiée {c.modifications.length} fois — dernière le {dFR(c.modifications[c.modifications.length - 1].le)} par {c.modifications[c.modifications.length - 1].par} ({fmtDevise(c.modifications[c.modifications.length - 1].total_avant)} → {fmtDevise(c.modifications[c.modifications.length - 1].total_apres)})</div>}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="font-semibold mb-1">💳 Paiements au fournisseur</div>
                {(c.paiements || []).length === 0 && <div className="text-slate-500">Aucun paiement.</div>}
                {(c.paiements || []).map((p) => {
                  const e = etatDeLaDepense(db.depenses, p.depense_id);
                  return (<div key={p.id} className="flex items-center gap-2">
                    <span className="tabular-nums">{dFR(p.le)} · {fmtDevise(p.montant_devise)} × {p.taux} = {fmt(p.montant_f)}</span>
                    {p.rattachee && <span data-paiement-rattache className="text-xs text-slate-500">🔗 dépense rattachée{p.saisie ? ` (${p.devise_saisie === "yuan" ? `${p.saisie.montant} ¥ à ${p.saisie.taux} ¥ / $` : `taux ${p.saisie.taux} F / $`})` : ""}</span>}
                    {e === "attente" && <span className="text-xs text-amber-700">⏳ à valider par le DG</span>}
                    {e === "rejetee" && <span className="text-xs text-red-700">✖ rejeté</span>}
                    {admin && c.etape !== "recue" && <BoutonRond icone={p.rattachee ? "⛓" : "🗑"} teinte="rouge" titre={p.rattachee ? "Détacher cette dépense (elle reste dans 📤 Dépenses)" : "Retirer ce paiement"} onClick={() => retirer(c, "paiements", p)} />}
                  </div>);
                })}
                <div className="text-xs text-slate-600 mt-1">Payé : {fmt(ep.payeF)}{ep.payeDevise > 0 ? ` (taux moyen ${Math.round(ep.tauxMoyen * 100) / 100} F / $)` : ""}</div>
              </div>
              <div>
                <div className="font-semibold mb-1">🚢 Frais (fret, transitaire, douane…)</div>
                {(c.frais || []).length === 0 && <div className="text-slate-500">Aucun frais.</div>}
                {(c.frais || []).map((f) => {
                  const e = etatDeLaDepense(db.depenses, f.depense_id);
                  return (<div key={f.id} className="flex items-center gap-2">
                    <span>{dFR(f.le)} · {f.sorte}{f.qui ? ` — ${f.qui}` : ""} : <span className="tabular-nums">{fmt(f.montant)}</span>{f.rattachee && <span className="text-xs text-slate-500"> · 🔗 dépense rattachée</span>}</span>
                    {e === "attente" && <span className="text-xs text-amber-700">⏳ à valider par le DG</span>}
                    {e === "rejetee" && <span className="text-xs text-red-700">✖ rejeté</span>}
                    {admin && c.etape !== "recue" && <BoutonRond icone={f.rattachee ? "⛓" : "🗑"} teinte="rouge" titre={f.rattachee ? "Détacher cette dépense (elle reste dans 📤 Dépenses)" : "Retirer ce frais"} onClick={() => retirer(c, "frais", f)} />}
                  </div>);
                })}
                <div className="text-xs text-slate-600 mt-1">Total des frais : {fmt(ef.total)}</div>
              </div>
            </div>
            {!c.annulee && c.etape !== "recue" && !enRecep && (
              <div className="flex flex-wrap gap-2">
                <button data-modifier-commande onClick={() => ouvrirModification(c)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">✏️ Modifier</button>
                <button onClick={() => payer(c)} className="px-3 py-1.5 rounded-lg bg-green-700 text-white text-sm font-semibold">💳 Payer le fournisseur</button>
                <button data-rattacher-depenses onClick={() => ouvrirRattachement(c)} className="px-3 py-1.5 rounded-lg border border-green-700 text-green-800 text-sm font-semibold">🔗 Dépenses déjà payées</button>
                <button onClick={() => ajouterFrais(c)} className="px-3 py-1.5 rounded-lg bg-sky-700 text-white text-sm font-semibold">➕ Frais</button>
                {etapeSuivante(c.etape) && <button onClick={() => avancer(c)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">➡ {libelleEtape(etapeSuivante(c.etape))}</button>}
                <button data-receptionner onClick={() => ouvrirReception(c)} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold">✅ Réceptionner</button>
                {admin && <button onClick={() => annuler(c)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold">✖ Annuler la commande</button>}
              </div>
            )}
            {rattache?.cmdId === c.id && panneauRattachement(c)}
            {enRecep && (
              <div data-reception-commande className="rounded-lg border-2 border-emerald-300 p-3 space-y-2">
                <div className="font-semibold">✅ Réception à {libelleCaisse(c.lieu)} — quantités réellement reçues</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(c.lignes || []).map((l) => (
                    <Field key={l.id} label={`${l.nom} (commandé : ${l.qte})`}>
                      <input type="number" min="0" className={inputCls} value={reception.qtes[l.id] ?? ""} onChange={(e) => setReception({ ...reception, qtes: { ...reception.qtes, [l.id]: e.target.value } })} />
                    </Field>
                  ))}
                  {resteAPayerAuTaux(c, db.depenses) && (
                    <Field label="Taux du jour pour la part pas encore payée (F / $)">
                      <input type="number" className={inputCls} value={reception.taux} onChange={(e) => setReception({ ...reception, taux: e.target.value })} />
                    </Field>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => receptionner(c)} className={btnDark}>Calculer et réceptionner</button>
                  <button onClick={() => setReception(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">Annuler</button>
                </div>
              </div>
            )}
            {c.reception && (
              <div className="text-xs text-slate-600">
                Reçue le {dFR(c.reception.le)} par {c.reception.par} · taux {Math.round(Number(c.reception.taux || 0) * 100) / 100} F / $ · frais {fmt(c.reception.frais)}
                {c.reception.prix_appliques_le ? ` · prix appliqués le ${dFR(c.reception.prix_appliques_le)} par ${c.reception.prix_appliques_par}` : ""}
              </div>
            )}
            {prixAAppliquer(c) && (admin
              ? <button data-appliquer-prix onClick={() => appliquerPrix(c)} className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-semibold">💲 Appliquer les prix d'achat</button>
              : <div className="text-xs text-amber-800">💲 Les prix d'achat des articles déjà en stock attendent l'administrateur.</div>)}
            {c.annulee && <div className="text-xs text-red-700">Annulée le {dFR(c.annulee.le)} par {c.annulee.par} : {c.annulee.motif}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-commandes-import className="rounded-xl p-4 bg-white border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="font-bold">🛒 Commandes à l'étranger (Alibaba…) {enCours.length ? <span className="text-sm font-normal text-slate-500">· {enCours.length} en cours</span> : null}</div>
        {!forme && <button onClick={() => setForme({ fournisseur_id: fournisseurs[0]?.id || "", lieu: lieux[0]?.nom || "", lignes: [LIGNE_VIDE()], note: "" })} className={btnDark}>➕ Nouvelle commande</button>}
      </div>

      {forme && (
        <PanneauQuiSeMontre cle="nouvelle-commande-import" onFermer={() => setForme(null)} data-nouvelle-commande-import="" className="rounded-lg border-2 border-sky-300 p-3 space-y-3">
          <div className="flex items-center justify-between"><div className="font-semibold">{forme.modif ? `✏️ Modifier la commande ${(commandesDe(fournisseurs).find((x) => x.id === forme.modif) || {}).numero || ""}` : "Nouvelle commande"}</div><button onClick={() => setForme(null)} className="px-3 py-1 rounded-lg border border-slate-300 text-sm font-semibold">Fermer</button></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Fournisseur">
              <select className={inputCls} disabled={!!forme.modif} title={forme.modif ? "Le fournisseur d'une commande ne change pas" : undefined} value={forme.fournisseur_id} onChange={(e) => setForme({ ...forme, fournisseur_id: e.target.value })}>
                <option value="">— Choisir —</option>
                {fournisseurs.map((fo) => <option key={fo.id} value={fo.id}>{fo.nom}</option>)}
              </select>
            </Field>
            <Field label="Reçue à">
              <select className={inputCls} value={forme.lieu} onChange={(e) => setForme({ ...forme, lieu: e.target.value })}>
                {lieux.map((b) => <option key={b.nom} value={b.nom}>{libelleCaisse(b.nom)}{b.depot ? " (magasin)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Note"><input className={inputCls} value={forme.note} onChange={(e) => setForme({ ...forme, note: e.target.value })} placeholder="N° de commande Alibaba…" /></Field>
          </div>
          <div className="space-y-2">
            {forme.lignes.map((l, i) => (
              <div key={l.id} data-ligne-commande className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border-t border-slate-100 pt-2">
                <div className="col-span-2">
                  <Field label="Article">
                    <ChampSuggestions className={inputCls} valeur={l.nom} placeholder="Tapez son nom (ou un nouvel article)"
                      onChange={(v) => fixeLigne(i, { nom: v, produit_id: null })}
                      onChoisir={(s) => fixeLigne(i, { nom: s.valeur, produit_id: s.produit_id })}
                      suggestions={suggestions} />
                  </Field>
                </div>
                <Field label="Quantité"><input type="number" min="1" className={inputCls} value={l.qte} onChange={(e) => fixeLigne(i, { qte: e.target.value })} /></Field>
                <Field label="Prix unitaire ($)"><input type="number" step="0.01" className={inputCls} value={l.pu} onChange={(e) => fixeLigne(i, { pu: e.target.value })} /></Field>
                <Field label="Prix d'achat">
                  <select className={inputCls} value={l.mode} onChange={(e) => fixeLigne(i, { mode: e.target.value })}>
                    <option value={MODE_CALCUL}>À calculer</option>
                    <option value={MODE_CONNU}>Prix connu (rendu Lomé)</option>
                  </select>
                </Field>
                <div className="flex items-end gap-2">
                  {l.mode === MODE_CONNU && <Field label="Prix rendu Lomé (F)"><input type="number" className={inputCls} value={l.prix_connu} onChange={(e) => fixeLigne(i, { prix_connu: e.target.value })} /></Field>}
                  {forme.lignes.length > 1 && <BoutonRond icone="✕" teinte="rouge" titre="Retirer la ligne" onClick={() => setForme({ ...forme, lignes: forme.lignes.filter((_, j) => j !== i) })} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setForme({ ...forme, lignes: [...forme.lignes, LIGNE_VIDE()] })} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">➕ Article</button>
            <span className="text-sm text-slate-600">Total : {fmtDevise(forme.lignes.reduce((s, l) => s + (nombreSaisi(l.qte) || 0) * (nombreSaisi(l.pu) || 0), 0))}</span>
            <button onClick={enregistrerCommande} className={`ml-auto ${btnDark}`}>{forme.modif ? "Enregistrer les modifications" : "Enregistrer la commande"}</button>
          </div>
          <div className="text-xs text-slate-500">« Prix connu » : le prix rendu Lomé est gardé tel quel, aucun frais ne s'y ajoute. « À calculer » : prix en dollars × taux, plus sa part des frais (au prorata de la valeur).</div>
        </PanneauQuiSeMontre>
      )}

      {enCours.length === 0 && !forme && <div className="text-sm text-slate-500">Aucune commande en cours.</div>}
      <div className="space-y-2">{enCours.map(carte)}</div>
      {finies.length > 0 && (
        <div>
          <button onClick={() => setVoirRecues(!voirRecues)} className="text-sm font-semibold text-slate-700">{voirRecues ? "▾" : "▸"} Commandes reçues ou annulées ({finies.length})</button>
          {voirRecues && <div className="space-y-2 mt-2">{finies.map(carte)}</div>}
        </div>
      )}
      <div className="text-xs text-slate-500">Étapes : {ETAPES_COMMANDE.map(([, l]) => l).join(" → ")}. Paiements et frais sont des dépenses (validation du DG au-delà de 5 000 F) ; ils ne comptent pas dans le Résultat : ils entrent dans le prix d'achat des articles reçus.</div>
    </div>
  );
}
