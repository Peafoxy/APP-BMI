import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { initialiserDonnees, amorcerSiVide, chargerTout, sauvegarderDiff, joursDepuisSauvegarde, marquerSauvegarde, forcerResynchronisation, autoResyncDejaFaite, marquerAutoResyncFaite,
  memoriserDossier, lireDossier, oublierDossier, marquerSauvegardeAuto, heuresDepuisSauvegardeAuto, viderLocal } from "./db";
import { demarrerSync, arreterSync, synchroniser, synchroniserOuverture, reinitialiserDistant, amorcerComptes } from "./sync";
import { synchroniserAuth, etatAuth, etatComptesAuth, supabaseConfigure } from "./supabaseClient";
import { genererPDF, genererProforma, genererDevis } from "./pdf";
const LOGO = "data:image/jpeg;base64,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";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

// ============ DONNÉES DE DÉMONSTRATION ============
const SEED = {
  // Données de départ : vides. Créez vos boutiques dans ⚙ Paramètres,
  // vos utilisateurs dans 👥 Utilisateurs, vos articles dans 📦 Stocks.
  boutiques: [],
  users: [
    // Compte initial obligatoire — changez ce mot de passe dès la mise en service !
    { id: "u1", nom: "Administrateur", pwd: "ADMIN2026", role: "admin", boutique: null, actif: true },
  ],
  produits: [],
  ventes: [],
  depenses: [],
  dettes: [],
  fournisseurs: [],
  ajustements: [],
  audits: [],
  commandes: [],
  prospects: [],
  categories_prospects: [
    { id: "cp1", nom: "Particulier", actif: true },
    { id: "cp2", nom: "Entreprise", actif: true },
    { id: "cp3", nom: "Administration", actif: true },
  ],
  clotures: [],
  commerciaux: [],
};

// ============ CONSTANTES ============
// Version affichée dans l'application, à côté du nom.
// Elle permet de vérifier d'un coup d'œil QUELLE version tourne réellement
// après un déploiement — sans avoir à deviner.
const VERSION = "2.90.2";

const PAIEMENTS = ["Espèces", "Mobile Money (Flooz)", "Mobile Money (Mixx/T-Money)", "Virement bancaire", "Crédit (dette)"];
const CATEGORIES = ["Loyer", "Électricité / Eau", "Salaires", "Commissions", "Prime d'installation", "Transport", "Achat marchandises", "Communication", "Impôts / Taxes", "Prêt au personnel", "Autre"];

// ============ RÔLES ============
// Salariés : fiche de paie, avancement, primes/avances, virements, crédit BMI.
const SALARIES = ["vendeur", "gerant", "magasinier", "technicien_bmi", "resp_commercial", "comptable"];
// Salariés rattachés à UNE boutique précise (le Technicien BMI intervient partout).
const SALARIES_BOUTIQUE = ["vendeur", "gerant", "magasinier"];

// Palette de couleurs proposées pour les boutiques (au lieu des codes hex)
const PALETTE = [
  ["Bleu", "#1d4ed8"], ["Bleu ciel", "#0284c7"], ["Turquoise", "#0d9488"], ["Vert", "#16a34a"],
  ["Vert olive", "#65a30d"], ["Jaune or", "#ca8a04"], ["Orange", "#d97706"], ["Rouge", "#dc2626"],
  ["Rose", "#db2777"], ["Violet", "#7c3aed"], ["Marron", "#92400e"], ["Gris", "#475569"],
];

// ============ PLAN COMPTABLE SYSCOHADA (codes de base, ajustables) ============
const COMPTE_TRESORERIE = (paiement) => {
  if (/Flooz/i.test(paiement)) return ["5211", "Mobile Money — Flooz"];
  if (/Mixx|T-Money/i.test(paiement)) return ["5212", "Mobile Money — Mixx/T-Money"];
  if (/Virement/i.test(paiement)) return ["521", "Banques locales"];
  if (/Prépay/i.test(paiement)) return ["4191", "Clients — avances et acomptes reçus"];
  if (/Crédit/i.test(paiement)) return ["411", "Clients"];
  return ["571", "Caisse"];
};

const COMPTE_CHARGE = {
  "Loyer": ["622", "Locations et charges locatives"],
  "Électricité / Eau": ["605", "Autres achats (eau, électricité)"],
  "Salaires": ["661", "Rémunérations du personnel"],
  "Transport": ["618", "Autres frais de transport"],
  "Achat marchandises": ["601", "Achats de marchandises"],
  "Communication": ["628", "Frais de télécommunications"],
  "Impôts / Taxes": ["641", "Impôts et taxes directs"],
  "Commissions": ["632", "Rémunérations d'intermédiaires et de conseils"],
  "Prime d'installation": ["661", "Rémunérations directes du personnel"],
  "Prêt au personnel": ["421", "Personnel — avances et acomptes"],
  "Autre": ["658", "Charges diverses"],
};

// Normalise un moyen de paiement saisi librement vers la liste officielle
const normPaiement = (t) => {
  const s = String(t || "").toLowerCase();
  if (/flooz/.test(s)) return "Mobile Money (Flooz)";
  if (/mixx|t-?money/.test(s)) return "Mobile Money (Mixx/T-Money)";
  if (/banqu|virement|bank/.test(s)) return "Virement bancaire";
  return "Espèces";
};

// Journal en partie double : chaque opération produit une ligne au débit
// et une ligne au crédit, équilibrées, avec les comptes SYSCOHADA.
function lignesJournal(db, a, b) {
  const lignes = [];
  const pousser = (date, journal, piece, compte, intitule, libelle, debit, credit, boutique) =>
    lignes.push([String(date).slice(0, 10), journal, piece, compte, intitule, libelle, debit || "", credit || "", boutique || ""]);

  // Ventes : débit trésorerie (ou clients si crédit) / crédit 701
  db.ventes.filter((v) => inP(v.date, a, b)).forEach((v) => {
    const net = totalVente(v);
    const [ct, it] = COMPTE_TRESORERIE(v.paiement || "");
    const piece = numeroRecu(v);
    const lib = `Vente ${resumeArticles(v)}${v.client ? " — " + v.client : ""}`;
    pousser(v.date, "VE", piece, ct, it, lib, net, "", v.boutique);
    pousser(v.date, "VE", piece, "701", "Ventes de marchandises", lib, "", net, v.boutique);
  });

  // Dépenses : débit compte de charge / crédit trésorerie
  db.depenses.filter((x) => inP(x.date, a, b)).forEach((x) => {
    const [cc, ic] = COMPTE_CHARGE[x.categorie] || COMPTE_CHARGE["Autre"];
    const [ct, it] = COMPTE_TRESORERIE(x.paiement || "");
    const piece = "DEP-" + String(x.id).slice(0, 6).toUpperCase();
    const lib = `${x.categorie}${x.description ? " — " + x.description : ""}`;
    const m = Number(x.montant);
    if (m < 0) {
      // Montant négatif = argent qui RENTRE (ex : remboursement d'un prêt au personnel)
      pousser(x.date, "AC", piece, ct, it, lib, -m, "", x.boutique);
      pousser(x.date, "AC", piece, cc, ic, lib, "", -m, x.boutique);
    } else {
      pousser(x.date, "AC", piece, cc, ic, lib, m, "", x.boutique);
      pousser(x.date, "AC", piece, ct, it, lib, "", m, x.boutique);
    }
  });

  // Règlements de dettes clients : débit caisse / crédit clients
  db.dettes.forEach((d) => (d.paiements || []).filter((p) => inP(p.date, a, b)).forEach((p) => {
    const piece = "REG-" + String(p.id).slice(0, 6).toUpperCase();
    // Une RÉSERVATION prépayée n'est pas une créance client : c'est une AVANCE reçue (4191).
    const prepaye = d.type === "prepaye";
    const [cc, ic] = prepaye ? ["4191", "Clients — avances et acomptes reçus"] : ["411", "Clients"];
    const lib = `${prepaye ? "Versement réservation" : "Règlement dette"} — ${d.client}`;
    const [ct, it] = COMPTE_TRESORERIE(p.paiement || "Espèces");
    pousser(p.date, "CA", piece, ct, it, lib, p.montant, "", d.boutique);
    pousser(p.date, "CA", piece, cc, ic, lib, "", p.montant, d.boutique);
  }));

  lignes.sort((l1, l2) => String(l1[0]).localeCompare(String(l2[0])));
  return lignes.map((l) => [dFR(l[0]), ...l.slice(1)]);
}

// Une vente peut contenir plusieurs articles (panier). Les anciennes ventes
// à article unique restent compatibles.
const lignesVente = (v) => (v.articles && v.articles.length ? v.articles : [{ produit_id: v.produit_id, article: v.article, qte: v.qte, pu: v.pu }]);
const brutVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0) * Number(l.pu || 0), 0);
const qteVente = (v) => lignesVente(v).reduce((s, l) => s + Number(l.qte || 0), 0);
const resumeArticles = (v) => lignesVente(v).map((l) => `${l.qte}× ${l.article}`).join(", ");
const totalVente = (v) => brutVente(v) - Number(v.remise || 0);

// Hachage SHA-256 des mots de passe (plus de stockage en clair)
async function hacher(txt) {
  const donnees = new TextEncoder().encode("bmi-sel-2026::" + String(txt));
  const buf = await crypto.subtle.digest("SHA-256", donnees);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const prefixeBoutique = (nom) => (String(nom || "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "RCP");
const numeroRecu = (v) => v.numero || `${prefixeBoutique(v.boutique)}-${String(v.date).slice(0, 4)}-${String(v.id).slice(0, 4).toUpperCase()}`;
const fmt = (n) => (n === 0 || n ? new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " F" : "—");
const today = () => new Date().toISOString().slice(0, 10);
const dFR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

const telDigits = (t) => {
  if (!t) return "";
  let num = String(t).replace(/[^0-9]/g, "");
  if (num.startsWith("0")) num = num.slice(1);
  if (!num.startsWith("228") && num.length === 8) num = "228" + num;
  return num;
};

let COLORS = {};
const col = (nom) => COLORS[nom] || "#475569";
const light = (nom) => col(nom) + "14";

// ============ COMPOSANTS UI ============
const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100";
const btnDark = "px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 transition-colors shadow-sm";

const Badge = ({ boutique }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: col(boutique) }}>{boutique}</span>
);

const Panel = ({ boutique, children }) => (
  <div className="rounded-xl p-4 border-2" style={{ borderColor: col(boutique), backgroundColor: light(boutique) }}>{children}</div>
);

// ============ COMPOSANT DE CHARGEMENT ============
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      <span className="ml-3 text-sm text-slate-500">Chargement...</span>
    </div>
  );
}

// ============ DIALOGUES INTÉGRÉS ============
let dialogApi = null;
const uAlert = (m) => (dialogApi ? dialogApi.open("alert", m) : Promise.resolve());
const uConfirm = (m) => (dialogApi ? dialogApi.open("confirm", m) : Promise.resolve(false));
const uPrompt = (m, def = "") => (dialogApi ? dialogApi.open("prompt", m, def) : Promise.resolve(null));

function DialogHost() {
  const [d, setD] = useState(null);
  const [val, setVal] = useState("");
  dialogApi = {
    open: (type, m, def = "") => new Promise((resolve) => { setVal(def == null ? "" : String(def)); setD({ type, m, resolve }); }),
  };
  if (!d) return null;
  const close = (result) => { d.resolve(result); setD(null); };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="text-sm text-slate-800 whitespace-pre-line font-medium">{d.m}</div>
        {d.type === "prompt" && (
          <input autoFocus className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
            value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(val)} />
        )}
        <div className="mt-4 flex justify-end gap-2">
          {d.type !== "alert" && <button onClick={() => close(d.type === "prompt" ? null : false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>}
          <button onClick={() => close(d.type === "prompt" ? val : true)} className="px-4 py-2 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">OK</button>
        </div>
      </div>
    </div>
  );
}

// ============ CALCULS ============
const stockVendu = (db, pid) =>
  db.ventes.reduce((s, v) => s + lignesVente(v).filter((l) => l.produit_id === pid).reduce((t, l) => t + Number(l.qte || 0), 0), 0);

const stockAjuste = (db, pid) =>
  (db.ajustements || []).filter((a) => a.produit_id === pid)
    .reduce((s, a) => s + Number(a.qte || 0), 0);

const stockActuel = (db, p) =>
  Number(p.initial || 0) + Number(p.entrees || 0)
  - stockVendu(db, p.id) + stockAjuste(db, p.id);

// ============ PAIE : calcul du net d'un mois + virements ============
// Un « virement » est un versement de salaire envoyé par l'administrateur.
// Il reste « en attente » tant que l'employé ne l'a pas confirmé (accepté).
const virementsMois = (u, mois) => (u.virements || []).filter((v) => v.mois === mois);

// ============ CRÉDIT BMI (prêt accordé à un employé) ============
// Un employé demande un crédit ; l'admin approuve ou refuse.
// Remboursement : soit par retenue automatique sur salaire (échéancier),
// soit librement (versements saisis par l'admin).
const totalRembourseCredit = (c) => (c.remboursements || []).reduce((s, r) => s + Number(r.montant || 0), 0);
const resteCredit = (c) => Math.max(0, Number(c.montant_accorde || 0) - totalRembourseCredit(c));
const creditsDe = (u) => u.credits || [];
const creditsEnAttente = (u) => creditsDe(u).filter((c) => c.statut === "en_attente");
const creditsEnCours = (u) => creditsDe(u).filter((c) => c.statut === "approuve" && resteCredit(c) > 0);

// Décale un mois "AAAA-MM" de k mois
const moisPlus = (mois, k) => {
  const [a, m] = String(mois).split("-").map(Number);
  const d = new Date(a, m - 1 + k, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Retenue de crédit prévue sur le salaire d'un mois donné
const retenueCreditMois = (u, mois) =>
  creditsDe(u).filter((c) => c.statut === "approuve" || c.statut === "solde")
    .reduce((s, c) => s + (c.echeances || []).filter((e) => e.mois === mois).reduce((t, e) => t + Number(e.montant || 0), 0), 0);

// Marque les échéances du mois comme retenues (appelé quand l'admin verse le salaire)
const appliquerRetenuesCredit = (u, mois, par) =>
  creditsDe(u).map((c) => {
    if (c.statut !== "approuve") return c;
    const dues = (c.echeances || []).filter((e) => e.mois === mois && !e.paye);
    if (!dues.length) return c;
    const total = dues.reduce((s, e) => s + Number(e.montant || 0), 0);
    const echeances = (c.echeances || []).map((e) => (e.mois === mois && !e.paye ? { ...e, paye: true, date_paiement: today() } : e));
    const remboursements = [...(c.remboursements || []), { date: today(), montant: total, par, source: "salaire", note: `Retenue sur salaire ${libelleMoisFR(mois)}` }];
    const rembourse = remboursements.reduce((s, r) => s + Number(r.montant || 0), 0);
    const solde = Number(c.montant_accorde || 0) - rembourse <= 0;
    return { ...c, echeances, remboursements, statut: solde ? "solde" : "approuve", date_solde: solde ? today() : c.date_solde };
  });

// Boutique dont la caisse supporte la sortie d'argent (salaire, prêt…)
async function choisirBoutiqueDebitG(db, u, titre) {
  const noms = db.boutiques.map((b) => b.nom);
  if (!noms.length) return "";
  if (noms.length === 1) return noms[0];
  const defaut = u.boutique && noms.includes(u.boutique) ? u.boutique : noms[0];
  const b = await uPrompt(`${titre}\n\nBoutique dont la caisse est débitée ? (${noms.join(" / ")})`, defaut);
  if (b === null) return null;
  const nom = String(b).trim().toUpperCase();
  if (!noms.includes(nom)) { uAlert("Boutique inconnue."); return null; }
  return nom;
}

// Envoi d'un virement de salaire (utilisé par 👥 Utilisateurs et 💵 Salaires)
async function envoyerVirementG(db, save, profile, u, moisImpose) {
  const mois = moisImpose || await uPrompt(`Mois du virement pour ${u.nom} (AAAA-MM) :`, today().slice(0, 7));
  if (!mois) return;
  if (!/^\d{4}-\d{2}$/.test(String(mois).trim())) { uAlert("Format attendu : AAAA-MM (ex : 2026-07)."); return; }
  const m = String(mois).trim();
  const p = paieMois(u, m);
  const suggestion = Math.max(0, p.reste);
  const v = await uPrompt(
    `Montant du virement (F CFA) — ${libelleMoisFR(m)}\n\n` +
    `Salaire de base : ${fmt(p.base)}\nPrimes : +${fmt(p.primes)}\nAvances : −${fmt(p.avances)}\nRetenue crédit BMI : −${fmt(p.retenueCredit)}\nNet à percevoir : ${fmt(p.net)}\n` +
    `Déjà envoyé ce mois : ${fmt(p.verse)}\nReste à verser : ${fmt(Math.max(0, p.reste))}`,
    String(suggestion || "")
  );
  if (v === null) return;
  const montant = Number(v);
  if (!montant || montant <= 0) { uAlert("Montant invalide."); return; }
  const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Virement bancaire");
  if (moyen === null) return;
  const ref = await uPrompt("Référence ou note (facultatif) :", "");
  if (ref === null) return;
  const bq = await choisirBoutiqueDebitG(db, u, `Virement de ${fmt(montant)} à ${u.nom}`);
  if (bq === null) return;
  const retenue = (u.credits || []).filter((c) => c.statut === "approuve")
    .reduce((s, c) => s + (c.echeances || []).filter((e) => e.mois === m && !e.paye).reduce((t, e) => t + Number(e.montant || 0), 0), 0);
  if (!await uConfirm(`Envoyer un virement de ${fmt(montant)} à ${u.nom} pour ${libelleMoisFR(m)} ?\n\nSortie de caisse ${bq || ""} : ${fmt(montant)}${retenue ? `\nRetenue crédit BMI comptabilisée : ${fmt(retenue)}` : ""}\n\nIl devra confirmer la réception depuis son espace « Salaire ».`)) return;
  const virement = {
    id: uid(), mois: m, montant, moyen: String(moyen).trim(), ref: String(ref).trim(), boutique: bq,
    statut: "envoye", date_envoi: today(), par: profile.nom
  };
  const paie = normPaiement(moyen);
  const deps = [{
    id: uid(), date: today(), boutique: bq, categorie: "Salaires",
    description: `Salaire ${libelleMoisFR(m)} — ${u.nom}`,
    montant: montant + retenue, paiement: paie, par: profile.nom, auto: "virement", user_id: u.id
  }];
  if (retenue > 0) {
    deps.push({
      id: uid(), date: today(), boutique: bq, categorie: "Prêt au personnel",
      description: `Remboursement crédit BMI retenu sur salaire ${libelleMoisFR(m)} — ${u.nom}`,
      montant: -retenue, paiement: paie, par: profile.nom, auto: "retenue", user_id: u.id
    });
  }
  save({
    ...db,
    users: db.users.map((x) => (x.id === u.id ? { ...x, virements: [...(x.virements || []), virement], credits: appliquerRetenuesCredit(x, m, profile.nom) } : x)),
    depenses: [...deps, ...db.depenses]
  }, `Virement de ${fmt(montant)} envoyé à ${u.nom} (${libelleMoisFR(m)})`);
  uAlert(`✅ Virement de ${fmt(montant)} envoyé à ${u.nom}. Enregistré en dépense « Salaires ».`);
}

// À partir de ce nombre de clients apportés, un apporteur externe devient
// éligible au statut de Commercial (compte utilisateur avec commission).
const SEUIL_COMMERCIAL = 5;

// ---- PROSPECTS DORMANTS ----
// Un prospect qui n'a pas bougé depuis des mois n'est plus un prospect : c'est un
// contact. Le laisser dans la file active fausse les tableaux de bord et noie les
// vraies pistes. On le signale, on l'archive — on ne le supprime jamais : un numéro
// qualifié garde de la valeur pour une campagne future.
const SEUIL_DORMANT_JOURS = 150; // ~5 mois

// Dernière trace d'activité : la dernière modification, à défaut la création.
const derniereActivite = (p) => p.maj_le || p.date;
const joursSansActivite = (p) => {
  const d = Date.parse(derniereActivite(p));
  if (Number.isNaN(d)) return 0;
  return Math.floor((Date.now() - d) / 86400000);
};
const estDormant = (p) => !p.converti && !p.archive && joursSansActivite(p) >= SEUIL_DORMANT_JOURS;

// Toute modification d'un prospect l'horodate : sans cela, impossible de savoir
// lequel dort vraiment.
const toucher = (p) => ({ ...p, maj_le: today() });

// Un CLIENT peut en parrainer un autre. Il touche alors une commission sur la
// vente de son filleul — comme un apporteur externe, mais avec un compte.
// Taux par défaut ; l'administrateur peut le régler compte par compte
// (users[].taux_commission), exactement comme pour un commercial.
const TAUX_PARRAINAGE_CLIENT = 3;

// Le client note celui qui est venu chez lui. Trois critères, notés sur 5.
const CRITERES_NOTE = [
  { id: "habillement", label: "Présentation / tenue", emoji: "👔" },
  { id: "maitrise", label: "Maîtrise du sujet", emoji: "🎓" },
  { id: "respect", label: "Respect et courtoisie", emoji: "🤝" },
];
const moyenneNote = (e) => {
  const n = CRITERES_NOTE.map((c) => Number(e[c.id] || 0)).filter((x) => x > 0);
  return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
};
// Moyenne d'un employé sur toutes ses évaluations.
const noteMoyenne = (u) => {
  const evs = u.evaluations || [];
  if (!evs.length) return null;
  return evs.reduce((s, e) => s + moyenneNote(e), 0) / evs.length;
};
const etoiles = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
// Taux par défaut du parrainage, réglable dans ⚙ Paramètres. Rangé dans la fiche
// boutique — comme la note du dimensionnement — donc AUCUNE migration de base.
const tauxParrainageDefaut = (db) => {
  const b = (db?.boutiques || []).find((x) => typeof x.taux_parrainage === "number");
  return b ? b.taux_parrainage : TAUX_PARRAINAGE_CLIENT;
};
// Le taux d'un parrain : son taux personnel s'il en a un, sinon le taux par défaut.
const tauxParrain = (u, db) => Number(u?.taux_commission || tauxParrainageDefaut(db));

// Un commercial qui a recruté ce nombre de filleuls devient CHEF D'ÉQUIPE
// automatiquement, et touche une commission sur les commissions de son équipe.
const SEUIL_CHEF_EQUIPE = 5;
const TAUX_EQUIPE_DEFAUT = 10; // % de la commission de chaque filleul

// Les commerciaux recrutés par u (son équipe)
// Réseau COMMERCIAL uniquement : un client parrainé ne doit JAMAIS compter ici,
// sinon un client cumulant 5 filleuls deviendrait « chef d'équipe ».
// Le parrainage entre clients utilise un champ distinct : parrain_client_id.
const filleulsDe = (db, u) => (db.users || []).filter((x) =>
  x.parrain_id === u.id && x.actif !== false && (x.role === "commercial" || x.role === "technicien"));

// Chef d'équipe : soit désigné par l'admin, soit atteint le seuil de recrutement
const estChefEquipe = (db, u) => !!u.chef_equipe || filleulsDe(db, u).length >= SEUIL_CHEF_EQUIPE;

// COMMISSION D'UNE VENTE pour son commercial.
// Le RABAIS accordé au client est déduit de la commission : c'est le commercial
// qui l'offre, pas l'entreprise. La marge de BMI est donc préservée.
// Le verrou est posé ICI, à la source : toutes les vues des commissions passent
// par cette fonction. Une vente issue d'un devis ne rapporte RIEN tant que le
// client n'a pas réceptionné l'installation.
const commissionBloquee = (v) => v.commission_a_la_reception === true;

const commissionBrute = (v, taux) => {
  const base = totalVente(v) + Number(v.rabais || 0); // total avant le rabais du commercial
  return Math.max(0, Math.round((base * Number(taux || 0)) / 100) - Number(v.rabais || 0));
};

const commissionVente = (v, taux) => (commissionBloquee(v) ? 0 : commissionBrute(v, taux));

// Ce qui est gagné mais pas encore exigible : en attente de la réception des travaux.
const commissionEnAttente = (v, taux) => (commissionBloquee(v) ? commissionBrute(v, taux) : 0);

// Commission d'une personne sur une vente : seul le COMMERCIAL supporte le rabais
// qu'il a lui-même offert. Le responsable associé, lui, n'a pas à le payer.
//
// Le blocage « réception » est déjà appliqué par commissionVente ci-dessus.
const commissionPour = (v, nom, taux) => (v.commercial === nom
  ? commissionVente(v, taux)
  : (commissionBloquee(v) ? 0 : Math.round((totalVente(v) * Number(taux || 0)) / 100)));

// Normalise un nom d'article pour le comparer : majuscules, sans accents,
// sans ponctuation, sans espaces multiples, et au singulier grossier.
// « Panneaux 550 W » et « PANNEAU 550W » deviennent la même chose.
const normNom = (s) => String(s || "")
  .toUpperCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/g, " ")
  .trim()
  .split(" ").map((m) => (m.length > 3 && m.endsWith("S") ? m.slice(0, -1) : m)).join(" ");

// Cherche l'article correspondant dans une liste : d'abord exact, puis par inclusion.
const trouverArticle = (liste, nom) => {
  const n = normNom(nom);
  if (!n) return null;
  return liste.find((p) => normNom(p.nom) === n)
    || liste.find((p) => normNom(p.nom).includes(n) || n.includes(normNom(p.nom)))
    || null;
};

// ============ RÉSERVATIONS PRÉPAYÉES ============
// Le client paie par tranches AVANT d'emporter. L'argent encaissé est une AVANCE
// (compte 4191), pas un chiffre d'affaires : il ne devient CA qu'à la livraison.
// Le stock n'est réservé qu'à la livraison (décision retenue).
const estReservation = (d) => d.type === "prepaye";
const reservations = (db) => (db.dettes || []).filter(estReservation);
const dettesClassiques = (db) => (db.dettes || []).filter((d) => !estReservation(d));
const resteAPayer = (d) => Math.max(0, Number(d.montant || 0) - Number(d.paye || 0));
const totalReservation = (r) => (r.articles || []).reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);

// ============ DEMANDES DE RAVITAILLEMENT ============
// Une boutique demande de la marchandise ; la demande est stockée dans SA fiche
// (aucune migration de base). Le magasinier la voit, prépare le bon, et sert.
const demandesDe = (b) => b.demandes || [];
const demandesEnAttente = (db) =>
  (db.boutiques || []).filter((b) => !b.depot)
    .flatMap((b) => demandesDe(b).filter((d) => d.statut === "en_attente").map((d) => ({ boutique: b.nom, d })));

// Articles sous le seuil dans les boutiques de vente (le magasinier voit l'alerte,
// pas le stock complet de la boutique).
const alertesBoutiques = (db, stock) =>
  (db.produits || [])
    .filter((p) => !estDepot(db, p.boutique))
    .map((p) => ({ p, actuel: stock(db, p) }))
    .filter((x) => x.actuel <= Number(x.p.seuil || 0))
    .sort((a, b) => a.actuel - b.actuel);

// ============ APPORTEURS D'AFFAIRES ============
// N'IMPORTE QUEL utilisateur qui amène un client peut être crédité de la vente
// et toucher sa commission, s'il a un taux de commission défini par l'admin.
const aUnTaux = (u) => Number(u.taux_commission || 0) > 0;
const apporteursPossibles = (db) => {
  const noms = new Map();
  (db.users || []).filter((u) => u.actif !== false && u.role !== "client" && aUnTaux(u))
    .forEach((u) => noms.set(u.nom, { id: u.id, nom: u.nom, taux: Number(u.taux_commission || 0), role: u.role }));
  (db.commerciaux || []).filter((c) => c.actif !== false)
    .forEach((c) => { if (!noms.has(c.nom)) noms.set(c.nom, { id: c.id, nom: c.nom, taux: Number(c.taux || 0), role: "commercial" }); });
  return [...noms.values()].sort((a, b) => a.nom.localeCompare(b.nom));
};
// A-t-il quelque chose à voir dans « Ma commission » ?
const estApporteur = (db, profile) => {
  const moi = (db.users || []).find((u) => u.id === profile.id);
  return (moi && aUnTaux(moi)) || (db.ventes || []).some((v) => v.commercial === profile.nom || v.responsable === profile.nom);
};

// ============ MAGASINS (dépôts) ============
// Une « boutique » marquée depot:true est un MAGASIN : on y stocke, on n'y vend pas.
// Les boutiques de vente sont ravitaillées depuis les magasins (transferts).
const estDepot = (db, nom) => !!(db.boutiques || []).find((b) => b.nom === nom)?.depot;
const boutiquesVente = (db) => (db.boutiques || []).filter((b) => !b.depot);
const magasinsDe = (db) => (db.boutiques || []).filter((b) => b.depot);

// ============ POUVOIRS (droits désactivables par l'administrateur) ============
// Chaque compte possède, selon son rôle, une liste de pouvoirs par défaut.
// L'administrateur peut en désactiver n'importe lequel : les identifiants
// désactivés sont stockés dans u.droits_off.
const LIBELLE_ONGLET = {
  dashboard: "📊 Tableau de bord", ventes: "💰 Ventes", commande: "🛒 Nouvelle commande", commandes: "📥 Commandes reçues",
  dimensionnement: "☀️ Dimensionnement", depenses: "📤 Dépenses", dettes: "🧾 Dettes", clients: "👤 Clients",
  caisse: "🔒 Caisse", stocks: "📦 Stocks", fournisseurs: "🚚 Fournisseurs", commerciaux: "🎯 Commerciaux",
  equipe: "👑 Équipe", prospects: "🧲 Prospects", parc: "🏠 Clients installés", messages: "💬 Messages",
  salaires: "💵 Salaires (tous)", users: "👥 Utilisateurs", historique: "🕘 Historique", parametres: "⚙ Paramètres", rentabilite: "📈 Rentabilité",
  commission: "💵 Ma commission", taches: "✅ Mes tâches", salaire: "💵 Salaire", espace_client: "🏠 Mon espace", ravitaillement: "🚚 Ravitaillement",
  nouveau_client: "🙋 Créer un client", tous_devis: "📋 Tous les devis",
};

const ONGLETS_ROLE = {
  admin: ["dashboard", "rentabilite", "ventes", "commandes", "dimensionnement", "tous_devis", "depenses", "dettes", "clients", "caisse", "stocks", "fournisseurs", "commerciaux", "equipe", "prospects", "parc", "messages", "salaires", "users", "historique", "parametres"],
  commercial: ["commande", "dimensionnement", "tous_devis", "prospects", "parc", "taches", "messages", "commission", "equipe", "nouveau_client"],
  technicien: ["commande", "dimensionnement", "tous_devis", "prospects", "parc", "taches", "messages", "commission", "equipe", "nouveau_client"],
  resp_commercial: ["equipe", "prospects", "taches", "parc", "dimensionnement", "tous_devis", "messages", "commission", "salaire", "nouveau_client"],
  technicien_bmi: ["dimensionnement", "tous_devis", "parc", "prospects", "commission", "messages", "salaire", "nouveau_client"],
  magasinier: ["stocks", "salaire", "messages", "nouveau_client"],
  gerant: ["ventes", "commandes", "dimensionnement", "tous_devis", "stocks", "depenses", "dettes", "clients", "caisse", "fournisseurs", "salaire", "messages", "nouveau_client"],
  vendeur: ["ventes", "commandes", "dimensionnement", "tous_devis", "ravitaillement", "depenses", "dettes", "clients", "caisse", "salaire", "messages", "nouveau_client"],
  comptable: ["dashboard", "rentabilite", "depenses", "dettes", "caisse", "stocks", "clients", "historique", "messages", "salaire", "nouveau_client"],
  client: ["espace_client", "messages"],
};

// Pouvoirs d'action (au-delà des onglets)
const ACTIONS_POUVOIR = [
  ["act_ecriture", "✏️ Créer / modifier / supprimer (sinon : lecture seule)", (r) => r !== "comptable" && r !== "client"],
  ["act_credit", "🏦 Demander un crédit BMI", (r) => SALARIES.includes(r)],
  ["act_reaffecter", "🔁 Réaffecter les prospects", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
  ["act_commission", "💰 Valider / payer les commissions", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
  ["act_taches", "✅ Assigner des tâches", (r) => ["admin", "resp_commercial", "commercial", "technicien"].includes(r)],
];

const pouvoirsDuRole = (role) => [
  ...(ONGLETS_ROLE[role] || []).map((id) => [id, LIBELLE_ONGLET[id] || id, "Onglet"]),
  ...ACTIONS_POUVOIR.filter(([, , cond]) => cond(role)).map(([id, lbl]) => [id, lbl, "Action"]),
];

// Lecture EN DIRECT des droits (le profil de connexion est figé au login)
const droitsOffDe = (db, profile) => (((db.users || []).find((u) => u.id === profile.id) || profile).droits_off) || [];
const aDroit = (db, profile, id) => !droitsOffDe(db, profile).includes(id);

// Le comptable est en LECTURE SEULE par nature (consultation + exports).
// Pour les autres rôles, l'admin peut retirer le pouvoir « act_ecriture ».
const peutEcrire = (db, profile) => profile.role !== "comptable" && aDroit(db, profile, "act_ecriture");
const bloquerSiLecture = (db, profile) => {
  if (peutEcrire(db, profile)) return false;
  uAlert("🔒 Votre compte est en lecture seule : vous pouvez consulter et exporter, mais pas modifier les données.");
  return true;
};

// ============ TÂCHES ASSIGNÉES ============
const tachesDe = (u) => u.taches || [];
const tachesOuvertes = (u) => tachesDe(u).filter((t) => t.statut !== "terminee");
// Réponses du magasin (demande servie ou refusée) que la boutique n'a pas encore vues
function compterReponsesRavitaillement(db, profile) {
  if (!profile.boutique) return 0;
  const b = (db.boutiques || []).find((x) => x.nom === profile.boutique);
  if (!b) return 0;
  return demandesDe(b).filter((d) => d.statut !== "en_attente" && !d.vu_boutique).length;
}

function compterTaches(db, profile) {
  const moi = (db.users || []).find((u) => u.id === profile.id);
  return moi ? tachesOuvertes(moi).length : 0;
}

// Notifications de l'onglet 💵 Salaire d'un employé :
// virements à confirmer + décisions de crédit pas encore vues.
function compterNotifsSalaire(db, profile) {
  if (!SALARIES.includes(profile.role)) return 0;
  const moi = (db.users || []).find((u) => u.id === profile.id);
  if (!moi) return 0;
  const virements = (moi.virements || []).filter((v) => v.statut !== "accepte").length;
  const decisions = creditsDe(moi).filter((c) => (c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe).length;
  return virements + decisions;
}

// Notifications de l'onglet 👥 Utilisateurs (admin) : demandes de crédit à traiter.
const compterDemandesCredit = (db) => (db.users || []).reduce((s, u) => s + creditsEnAttente(u).length, 0);

function paieMois(u, mois) {
  const base = Number(u.salaire_base || 0);
  const primes = (u.primes || []).filter((p) => p.mois === mois).reduce((s, p) => s + Number(p.montant || 0), 0);
  const avances = (u.avances || []).filter((a) => a.mois === mois).reduce((s, a) => s + Number(a.montant || 0), 0);
  const retenueCredit = retenueCreditMois(u, mois);
  const vs = virementsMois(u, mois);
  const verse = vs.reduce((s, v) => s + Number(v.montant || 0), 0);
  const accepte = vs.filter((v) => v.statut === "accepte").reduce((s, v) => s + Number(v.montant || 0), 0);
  const enAttente = vs.filter((v) => v.statut !== "accepte").reduce((s, v) => s + Number(v.montant || 0), 0);
  const net = base + primes - avances - retenueCredit;
  return { base, primes, avances, retenueCredit, net, verse, accepte, enAttente, reste: net - verse, virements: vs };
}

const libelleMoisFR = (m) => {
  const noms = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const i = Number(String(m).slice(5, 7)) - 1;
  return noms[i] ? `${noms[i]} ${String(m).slice(0, 4)}` : String(m);
};

function periodes() {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const t = iso(now);
  const lundi = new Date(now); lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return [
    ["Aujourd'hui", t, t],
    ["Cette semaine", iso(lundi), t],
    ["Ce mois", `${t.slice(0, 7)}-01`, t],
    ["Cette année", `${t.slice(0, 4)}-01-01`, t],
    ["Depuis le début", "0000-01-01", "9999-12-31"]
  ];
}

const inP = (dt, a, b) => {
  const d = String(dt).slice(0, 10);
  return d >= a && d <= b;
};

// ============ REÇU CLIENT ============
function imprimerRecu(v, bq = {}) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const logo = bq.logo || LOGO;
  const brut = brutVente(v);
  const net = totalVente(v);
  const numero = numeroRecu(v);
  const modes = [
    ["Espèces", /Espèces/i],
    ["Mobile Money", /Mobile Money/i],
    ["Virement", /Virement/i],
    ["Crédit", /Crédit/i],
  ];
  const casesMode = modes
    .map(([lbl, re]) => `<span class="case">${re.test(v.paiement || "") ? "☑" : "☐"} ${lbl}</span>`)
    .join("");

  const html = `
  <style>
  #zone-impression .recu-doc{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .recu-doc .entete{width:100%;border-collapse:collapse}
  #zone-impression .recu-doc .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .recu-doc .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .recu-doc .soc{text-align:right;line-height:1.5}
  #zone-impression .recu-doc .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .recu-doc .soc .marque{font-size:12px;font-weight:bold;color:#3d8b40}
  #zone-impression .recu-doc h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .recu-doc .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .recu-doc .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:10px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .recu-doc .client div{padding:2px 0}
  #zone-impression .recu-doc table.articles{width:100%;border-collapse:collapse;margin:10px 0 6px}
  #zone-impression .recu-doc table.articles th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .recu-doc table.articles th:not(:first-child),#zone-impression .recu-doc table.articles td:not(:first-child){text-align:right}
  #zone-impression .recu-doc table.articles td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .recu-doc table.totaux{width:52%;margin-left:auto;border-collapse:collapse}
  #zone-impression .recu-doc table.totaux td{padding:4px 6px}
  #zone-impression .recu-doc table.totaux td:last-child{text-align:right;white-space:nowrap}
  #zone-impression .recu-doc table.totaux tr.total td{border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .recu-doc .paiement{margin:12px 0;padding:8px 10px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px}
  #zone-impression .recu-doc .case{margin-right:14px;white-space:nowrap}
  #zone-impression .recu-doc table.sign{width:100%;border-collapse:collapse;margin-top:26px}
  #zone-impression .recu-doc table.sign td{width:33%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .recu-doc table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  #zone-impression .recu-doc .merci{text-align:center;font-style:italic;color:#555;margin-top:16px;border-top:1px dashed #aaa;padding-top:8px}
  </style>
  <div class="recu-doc">
    <table class="entete"><tr>
      <td><img src="${logo}" alt="${esc(v.boutique)}"></td>
      <td class="soc">
        <div class="nom">${esc(v.boutique)}</div>
        <div class="marque">BMI TOGO</div>
        <div>${esc(bq.adresse || "Lomé, Togo")}</div>
        ${bq.tel ? `<div>Tél : ${esc(bq.tel)}</div>` : ""}
        <div>Email : ${esc(bq.email || "Bmitogo.info@gmail.com")}</div>
      </td>
    </tr></table>

    <h1>REÇU DE VENTE</h1>

    <div class="meta">
      <div><b>Numéro de reçu :</b> ${numero}</div>
      <div><b>Date :</b> ${dFR(v.date)}</div>
      <div><b>Heure :</b> ${esc(v.heure || "—")}</div>
    </div>

    <div class="btitre">CLIENT</div>
    <div class="client">
      <div><b>Nom :</b> ${esc(v.client || "________________________")}</div>
      <div><b>Téléphone :</b> ${esc(v.tel || "________________________")}</div>
    </div>

    <table class="articles">
      <thead><tr><th>Description</th><th>Quantité</th><th>Prix Unitaire</th><th>Montant</th></tr></thead>
      <tbody>
        ${lignesVente(v).map((l) => `<tr><td>${esc(l.article)}</td><td>${l.qte}</td><td>${fmt(l.pu)}</td><td>${fmt(Number(l.qte) * Number(l.pu))}</td></tr>`).join("")}
      </tbody>
    </table>

    <table class="totaux">
      <tr><td>Sous-total :</td><td>${fmt(brut)}</td></tr>
      <tr><td>Remise${v.remise_pct ? ` (${v.remise_pct} %)` : ""} :</td><td>${v.remise ? "−" + fmt(v.remise) : fmt(0)}</td></tr>
      <tr class="total"><td>TOTAL TTC :</td><td>${fmt(net)}</td></tr>
      ${v.paiement === "Crédit (dette)" ? `<tr><td>Avance versée :</td><td>${fmt(v.avance || 0)}</td></tr><tr class="total"><td>RESTE À PAYER :</td><td>${fmt(Math.max(0, net - (Number(v.avance) || 0)))}</td></tr>` : ""}
    </table>

    <div class="paiement"><b>Mode de paiement :</b><br>${casesMode}<div style="margin-top:4px;font-size:11px;color:#555">${esc(v.paiement || "")}</div></div>

    <table class="sign"><tr>
      <td></td>
      <td><div class="ligne">Vendeur${v.par ? ` : ${esc(v.par)}` : ""}${v.apporteur && v.apporteur.nom ? `<br><span style="font-size:10px;color:#666">Apporté par ${esc(v.apporteur.nom)}</span>` : ""}${Number(v.rabais || 0) > 0 ? `<br><span style="font-size:10px;color:#666">Rabais de ${esc(v.commercial || "")} : ${fmt(v.rabais)}</span>` : ""}</div></td>
      <td></td>
    </tr></table>

    <div class="merci">${esc(bq.message || "Merci pour votre achat ! / Thank you for your purchase!")}</div>
  </div>`;
  if (printApi) printApi.open(html);
}

// ============ BON DE RAVITAILLEMENT ============
function imprimerBonRavitaillement(bon, db) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bqSrc = (db.boutiques || []).find((b) => b.nom === bon.source) || {};
  const logo = bqSrc.logo || LOGO;
  const total = bon.lignes.reduce((s, l) => s + Number(l.qte || 0), 0);
  const html = `
  <style>
  #zone-impression .bon{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .bon .entete{width:100%;border-collapse:collapse}
  #zone-impression .bon .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .bon .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .bon .soc{text-align:right;line-height:1.5}
  #zone-impression .bon .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .bon h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .bon .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .bon .flux{text-align:center;font-size:14px;font-weight:bold;color:#1e5a8a;margin:10px 0}
  #zone-impression .bon table.art{width:100%;border-collapse:collapse;margin:8px 0}
  #zone-impression .bon table.art th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .bon table.art th:last-child,#zone-impression .bon table.art td:last-child{text-align:right}
  #zone-impression .bon table.art td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .bon table.art tr.tot td{background:#eaf3ea;border-top:2px solid #1e5a8a;font-weight:bold;color:#1e5a8a}
  #zone-impression .bon table.sign{width:100%;border-collapse:collapse;margin-top:30px}
  #zone-impression .bon table.sign td{width:50%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .bon table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  </style>
  <div class="bon">
    <table class="entete"><tr>
      <td><img src="${logo}" alt="BMI" /></td>
      <td class="soc"><div class="nom">BMI TOGO</div><div>${esc(bqSrc.adresse || "Lomé, Togo")}</div></td>
    </tr></table>
    <h1>BON DE RAVITAILLEMENT</h1>
    <div class="meta">
      <div><b>N° :</b> ${esc(bon.numero)}</div>
      <div><b>Date :</b> ${esc(dFR(bon.date))}</div>
      <div><b>Établi par :</b> ${esc(bon.par)}</div>
    </div>
    <div class="flux">🏭 ${esc(bon.source)} &nbsp;→&nbsp; 🏪 ${esc(bon.destination)}</div>
    <table class="art">
      <thead><tr><th>Article</th><th>Catégorie</th><th>Quantité</th></tr></thead>
      <tbody>
        ${bon.lignes.map((l) => `<tr><td>${esc(l.nom)}</td><td>${esc(l.categorie || "—")}</td><td>${l.qte}</td></tr>`).join("")}
        <tr class="tot"><td colspan="2">TOTAL ARTICLES</td><td>${total}</td></tr>
      </tbody>
    </table>
    <table class="sign"><tr>
      <td><div class="ligne">Le magasinier (sortie)</div></td>
      <td><div class="ligne">Le réceptionnaire (boutique)</div></td>
    </tr></table>
  </div>`;
  if (printApi) printApi.open(html);
}

// ============ BULLETIN DE PAIE ============
function imprimerBulletin(u, mois, db) {
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bq = (db.boutiques || []).find((b) => b.nom === u.boutique) || (db.boutiques || [])[0] || {};
  const logo = bq.logo || LOGO;
  const p = paieMois(u, mois);
  const primes = (u.primes || []).filter((x) => x.mois === mois);
  const avances = (u.avances || []).filter((x) => x.mois === mois);
  const credits = (u.credits || []).filter((c) => c.statut === "approuve" && resteCredit(c) > 0);
  const roleLbl = u.role === "gerant" ? "Gérant de boutique" : u.role === "magasinier" ? "Magasinier" : u.role === "technicien_bmi" ? "Technicien BMI" : "Vendeur";
  const numero = `BP-${mois.replace("-", "")}-${String(u.id).slice(0, 4).toUpperCase()}`;

  const ligne = (lib, montant, signe) =>
    `<tr><td>${esc(lib)}</td><td class="${signe === "-" ? "moins" : signe === "+" ? "plus" : ""}">${signe === "-" ? "−" : signe === "+" ? "+" : ""}${fmt(Math.abs(Number(montant) || 0))}</td></tr>`;

  const html = `
  <style>
  #zone-impression .bp{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;max-width:680px;margin:0 auto}
  #zone-impression .bp .entete{width:100%;border-collapse:collapse}
  #zone-impression .bp .entete td{vertical-align:middle;padding:0 0 8px 0}
  #zone-impression .bp .entete img{max-width:150px;max-height:110px;object-fit:contain}
  #zone-impression .bp .soc{text-align:right;line-height:1.5}
  #zone-impression .bp .soc .nom{font-size:20px;font-weight:bold;color:#1e5a8a}
  #zone-impression .bp h1{text-align:center;font-size:17px;letter-spacing:2px;margin:10px 0 12px;color:#1e5a8a;border-bottom:3px solid #1e5a8a;padding-bottom:8px}
  #zone-impression .bp .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#f2f6fa;border:1px solid #d5e2ee;border-radius:6px;padding:8px 10px;margin-bottom:10px}
  #zone-impression .bp .btitre{font-weight:bold;color:#1e5a8a;border-bottom:1px solid #d5e2ee;margin:12px 0 4px;font-size:12px;letter-spacing:1px}
  #zone-impression .bp .sal div{padding:2px 0}
  #zone-impression .bp table.el{width:100%;border-collapse:collapse;margin:6px 0}
  #zone-impression .bp table.el th{background:#1e5a8a;color:#fff;padding:6px;font-size:11px;text-align:left}
  #zone-impression .bp table.el th:last-child,#zone-impression .bp table.el td:last-child{text-align:right;white-space:nowrap}
  #zone-impression .bp table.el td{border:1px solid #d5e2ee;padding:6px}
  #zone-impression .bp table.el td.plus{color:#2e7d32;font-weight:bold}
  #zone-impression .bp table.el td.moins{color:#c62828;font-weight:bold}
  #zone-impression .bp table.el tr.net td{background:#eaf3ea;border-top:2px solid #1e5a8a;font-weight:bold;font-size:14px;color:#1e5a8a}
  #zone-impression .bp .enc{background:#f7f2fb;border:1px solid #e0d3ee;border-radius:6px;padding:8px 10px;margin-top:8px;font-size:11px}
  #zone-impression .bp table.sign{width:100%;border-collapse:collapse;margin-top:30px}
  #zone-impression .bp table.sign td{width:50%;text-align:center;font-size:11px;color:#333;padding:0 12px}
  #zone-impression .bp table.sign .ligne{border-top:1px solid #555;padding-top:4px}
  #zone-impression .bp .pied{text-align:center;font-style:italic;color:#555;margin-top:16px;border-top:1px dashed #aaa;padding-top:8px;font-size:11px}
  </style>
  <div class="bp">
    <table class="entete"><tr>
      <td><img src="${logo}" alt="BMI" /></td>
      <td class="soc">
        <div class="nom">BMI TOGO</div>
        <div>${esc(bq.adresse || "Lomé, Togo")}</div>
        ${bq.tel ? `<div>Tél : ${esc(bq.tel)}</div>` : ""}
      </td>
    </tr></table>

    <h1>BULLETIN DE PAIE</h1>

    <div class="meta">
      <div><b>Période :</b> ${esc(libelleMoisFR(mois))}</div>
      <div><b>N° :</b> ${esc(numero)}</div>
      <div><b>Édité le :</b> ${esc(dFR(today()))}</div>
    </div>

    <div class="btitre">SALARIÉ</div>
    <div class="sal">
      <div><b>Nom et prénom(s) :</b> ${esc(u.nom_complet || u.nom)}</div>
      ${u.piece_num ? `<div><b>Pièce d'identité :</b> ${esc(u.piece_type || "CNI")} n° ${esc(u.piece_num)}</div>` : ""}
      <div><b>Fonction :</b> ${esc(roleLbl)}</div>
      <div><b>Affectation :</b> ${esc(u.boutique || "Toutes boutiques")}</div>
      ${Number(u.taux_avancement || 0) > 0 ? `<div><b>Taux d'avancement annuel :</b> ${esc(u.taux_avancement)} %</div>` : ""}
    </div>

    <div class="btitre">ÉLÉMENTS DE PAIE</div>
    <table class="el">
      <thead><tr><th>Libellé</th><th>Montant (F CFA)</th></tr></thead>
      <tbody>
        ${ligne("Salaire de base", p.base, "")}
        ${primes.map((x) => ligne(`Prime${x.motif ? " — " + x.motif : ""}`, x.montant, "+")).join("")}
        ${avances.map((x) => ligne(`Avance sur salaire${x.motif ? " — " + x.motif : ""}`, x.montant, "-")).join("")}
        ${p.retenueCredit > 0 ? ligne("Retenue crédit BMI", p.retenueCredit, "-") : ""}
        <tr class="net"><td>NET À PERCEVOIR</td><td>${fmt(p.net)}</td></tr>
      </tbody>
    </table>

    <div class="btitre">VERSEMENTS</div>
    <table class="el">
      <thead><tr><th>Date · Moyen</th><th>Montant</th></tr></thead>
      <tbody>
        ${p.virements.length
          ? p.virements.map((v) => `<tr><td>${esc(dFR(v.date_envoi))} · ${esc(v.moyen || "—")} · ${v.statut === "accepte" ? "Réception confirmée" : "En attente de confirmation"}</td><td>${fmt(v.montant)}</td></tr>`).join("")
          : `<tr><td colspan="2" style="text-align:center;color:#888">Aucun versement enregistré pour cette période</td></tr>`}
        <tr class="net"><td>RESTE À PERCEVOIR</td><td>${fmt(Math.max(0, p.reste))}</td></tr>
      </tbody>
    </table>

    ${credits.length ? `<div class="enc"><b>🏦 Crédit BMI en cours :</b> ${credits.map((c) => `accordé ${fmt(c.montant_accorde)} · remboursé ${fmt(totalRembourseCredit(c))} · <b>reste dû ${fmt(resteCredit(c))}</b>${c.mode === "salaire" ? " (retenue sur salaire)" : " (remboursement libre)"}`).join(" ; ")}</div>` : ""}

    <table class="sign"><tr>
      <td><div class="ligne">Le salarié</div></td>
      <td><div class="ligne">L'administration</div></td>
    </tr></table>

    <div class="pied">Document généré par BMI-Gestions Boutiques — à conserver.</div>
  </div>`;
  if (printApi) printApi.open(html);
}

function recuWhatsApp(v, bq = {}) {
  const lignes = [
    `🧾 *REÇU — ${v.boutique}*`,
    bq.adresse || "Lomé, Togo",
    bq.tel ? `Tél : ${bq.tel}` : null,
    `------------------------`,
    `Date : ${dFR(v.date)}${v.heure ? ` à ${v.heure}` : ""}`,
    `Reçu N° : ${numeroRecu(v)}`,
    v.client ? `Client : ${v.client}` : null,
    `------------------------`,
    ...lignesVente(v).map((l) => `${l.qte} × ${l.article} = ${fmt(Number(l.qte) * Number(l.pu))}`),
    `Sous-total : ${fmt(brutVente(v))}`,
    v.remise ? `Remise${v.remise_pct ? ` (${v.remise_pct}%)` : ""} : −${fmt(v.remise)}` : null,
    `*TOTAL : ${fmt(totalVente(v))}*`,
    v.paiement === "Crédit (dette)" ? `Avance versée : ${fmt(v.avance || 0)}` : null,
    v.paiement === "Crédit (dette)" ? `*RESTE À PAYER : ${fmt(Math.max(0, totalVente(v) - (Number(v.avance) || 0)))}*` : null,
    `Paiement : ${v.paiement}`,
    `Vendeur : ${v.par || ""}`,
    `------------------------`,
    bq.message || "Merci de votre confiance !",
  ].filter(Boolean);
  const txt = lignes.join("\n");
  const num = telDigits(v.tel);
  window.open(num ? `https://wa.me/${num}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
}

// ============ EXPORT CSV ============
let exportApi = null;

// Télécharge la base complète dans un fichier JSON daté.
function telechargerSauvegarde(db, suffixe = "") {
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sauvegarde_bmi_${today()}${suffixe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ============ SAUVEGARDE HORAIRE DANS UN DOSSIER ============
// Chrome / Edge permettent à l'application d'écrire dans un dossier que vous
// désignez. Si ce dossier est synchronisé par Google Drive, la sauvegarde part
// dans le cloud toute seule. Le MÊME fichier est réécrit : pas d'accumulation.
const NOM_FICHIER_AUTO = "sauvegarde_bmi.json";
const dossierDispo = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

// Écrit (ou réécrit) le fichier dans le dossier mémorisé.
async function ecrireDansDossier(db, handle) {
  const perm = await handle.queryPermission({ mode: "readwrite" });
  if (perm !== "granted") {
    const demande = await handle.requestPermission({ mode: "readwrite" });
    if (demande !== "granted") throw new Error("Autorisation refusée sur le dossier.");
  }
  const fichier = await handle.getFileHandle(NOM_FICHIER_AUTO, { create: true });
  const flux = await fichier.createWritable();
  await flux.write(JSON.stringify({ ...db, _sauvegarde: new Date().toISOString() }, null, 1));
  await flux.close();
  await marquerSauvegardeAuto();
}

function exportCSV(nom, headers, rows, filtre = "") {
  const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map(esc).join(";"))
  ].join("\n");
  const tsv = [
    headers.join("\t"),
    ...rows.map((r) => r.map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t"))
  ].join("\n");
  const fichier = `${nom}_${today()}${filtre ? `_${filtre}` : ""}.csv`;
  if (exportApi) exportApi.open({ nom, fichier, csv, tsv, headers, rows, lignes: rows.length });
}

let printApi = null;
function PrintHost() {
  const [html, setHtml] = useState(null);
  printApi = { open: (h) => setHtml(h) };
  if (!html) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #zone-impression, #zone-impression * { visibility: visible !important; }
        #zone-impression { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-height: none !important; overflow: visible !important; padding: 0 !important; }
      }`}</style>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="font-bold text-slate-900 text-sm">Aperçu avant impression</div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">🖨 Imprimer / Enregistrer en PDF</button>
            <button onClick={() => setHtml(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
          </div>
        </div>
        <div id="zone-impression" className="overflow-auto p-4" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

function ExportHost() {
  const [d, setD] = useState(null);
  const [info, setInfo] = useState("");
  exportApi = { open: (data) => { setInfo(""); setD(data); } };
  if (!d) return null;

  const telecharger = () => {
    try {
      const blob = new Blob([d.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.fichier;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setInfo("Téléchargement lancé. Si rien ne se passe, utilisez « Copier pour Excel ».");
    } catch {
      setInfo("Téléchargement impossible ici. Utilisez « Copier pour Excel ».");
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(d.tsv);
      setInfo("✓ Copié ! Ouvrez Excel et collez (Ctrl+V) : les colonnes se placeront automatiquement.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = d.tsv;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setInfo("✓ Copié ! Ouvrez Excel et collez (Ctrl+V) : les colonnes se placeront automatiquement.");
      } catch {
        setInfo("Copie impossible. Sélectionnez le texte ci-dessous et copiez-le manuellement.");
      }
    }
  };

  const pdf = () => {
    try {
      genererPDF(d, LOGO);
      setInfo("✓ Fichier PDF généré ! Vérifiez votre dossier Téléchargements (ou la fenêtre d'enregistrement).");
    } catch (e) {
      setInfo("Échec de la génération PDF : " + (e?.message || e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="font-bold text-slate-900">Exporter : {d.nom}</div>
        <div className="text-xs text-slate-500 mt-1">{d.lignes} ligne(s) — {d.fichier}</div>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={pdf} className="w-full py-2.5 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">📄 Télécharger en PDF</button>
          <button onClick={telecharger} className="w-full py-2.5 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">📥 Télécharger le fichier CSV</button>
          <button onClick={copier} className="w-full py-2.5 rounded-lg border-2 border-slate-900 text-slate-900 text-sm font-bold hover:bg-slate-50">📋 Copier pour Excel</button>
        </div>
        {info && <div className="mt-3 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg p-2">{info}</div>}
        {info.startsWith("Copie impossible") && (
          <textarea readOnly className="mt-2 w-full h-32 rounded-lg border border-slate-300 p-2 text-xs font-mono" value={d.tsv} onFocus={(e) => e.target.select()} />
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={() => setD(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// Détecte la plateforme pour adapter la durée avant déconnexion automatique :
// 5 min sur navigateur Android (usage tactile, souvent posé/repris — plus
// sensible si l'appareil est partagé ou laissé sans surveillance),
// 30 min partout ailleurs (application Windows, ou navigateur sur PC).
const DUREE_INACTIVITE = /Android/i.test(navigator.userAgent || "") ? 5 * 60 * 1000 : 30 * 60 * 1000;

// ============ APPLICATION PRINCIPALE ============
export default function App() {
  const [db, setDbRaw] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("ventes");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [sync, setSync] = useState({ enLigne: navigator.onLine, supabaseOk: false, enAttente: 0 });
  const [rappelSauvegarde, setRappelSauvegarde] = useState(false);
  const [preRempli, setPreRempli] = useState(null); // { boutique, panier } transmis depuis le Dimensionnement solaire
  const [devisAReprendre, setDevisAReprendre] = useState(null); // { devis, client } — devis en modification/rejeté que le vendeur reprend
  const dbRef = useRef(null);
  const autoSauvFaite = useRef(false);
  const [dossierAuto, setDossierAuto] = useState(null);
  const [dernierAuto, setDernierAuto] = useState(null);

  // Au démarrage : on récupère le dossier mémorisé, s'il y en a un
  useEffect(() => {
    if (!dossierDispo()) return;
    (async () => {
      try {
        const h = await lireDossier();
        if (h) setDossierAuto(h);
        const t = await heuresDepuisSauvegardeAuto();
        setDernierAuto(t);
      } catch {}
    })();
  }, []);

  // SAUVEGARDE HORAIRE : réécrit le même fichier toutes les heures, en silence.
  // Contrôle toutes les 5 minutes ; n'écrit que si plus d'une heure s'est écoulée
  // ET que des données ont changé depuis la dernière écriture.
  useEffect(() => {
    if (!dossierAuto || !db) return;
    let vivant = true;
    const tenter = async () => {
      if (!vivant) return;
      try {
        const t = await heuresDepuisSauvegardeAuto();
        if (t !== null && t < 1) return;           // moins d'une heure : on ne fait rien
        await ecrireDansDossier(dbRef.current || db, dossierAuto);
        setDernierAuto(0);
      } catch (e) {
        console.warn("Sauvegarde horaire impossible :", e.message);
      }
    };
    tenter();                                       // une fois à l'ouverture
    const minuteur = setInterval(tenter, 5 * 60 * 1000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [dossierAuto, db]);

  // SAUVEGARDE AUTOMATIQUE : au premier lancement de la journée par un administrateur,
  // la base complète est téléchargée dans un fichier daté, sans rien demander.
  useEffect(() => {
    if (!db || !profile || profile.role !== "admin" || autoSauvFaite.current) return;
    autoSauvFaite.current = true;
    (async () => {
      try {
        const j = await joursDepuisSauvegarde();
        if (j === null || j >= 1) {
          telechargerSauvegarde(db, "_auto");
          await marquerSauvegarde();
          setRappelSauvegarde(false);
        }
      } catch {}
    })();
  }, [db, profile]);

  const setDb = (d) => {
    COLORS = Object.fromEntries((d.boutiques || []).map((b) => [b.nom, b.couleur]));
    dbRef.current = d;
    setDbRaw(d);
  };

  useEffect(() => {
    (async () => {
      await initialiserDonnees(SEED);      // 1er lancement : données de départ
      const donnees = await chargerTout(); // lecture de la base LOCALE (hors ligne OK)
      setDb(donnees);

      // Amorçage rapide et dédié de la table des comptes : indispensable sur un
      // appareil neuf pour qu'un utilisateur (client qui vient de recevoir ses
      // identifiants, par exemple) puisse être retrouvé DÈS sa toute première
      // tentative de connexion — avant même que la synchronisation générale,
      // plus longue et plus complexe, n'ait eu le temps de s'exécuter.
      amorcerComptes().then((reussi) => { if (reussi) chargerTout().then(setDb); });

      // Restaure la session après un rafraîchissement de page (site web),
      // à condition qu'elle date de moins de 15 minutes et que le compte
      // soit toujours actif — sinon, retour normal à l'écran de connexion.
      try {
        const brut = localStorage.getItem("bmi_session");
        if (brut) {
          const { id, ts } = JSON.parse(brut);
          const u = donnees.users.find((x) => x.id === id);
          if (u && u.actif !== false && Date.now() - ts < DUREE_INACTIVITE) {
            setProfile(u);
            setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
          } else {
            localStorage.removeItem("bmi_session");
          }
        }
      } catch {}

      demarrerSync(async (etat) => {       // sync Supabase en arrière-plan
        setSync(etat);
        if (etat.rafraichir) setDb(await chargerTout());
      });
      try {
        const j = await joursDepuisSauvegarde();
        setRappelSauvegarde(j === null || j > 7);
      } catch {}
      // Après la 1re synchro, on amorce le seed SEULEMENT si la base est encore
      // vide (vrai premier lancement). Ainsi, un nettoyage du navigateur suivi
      // d'une synchro ne réinstalle jamais de fausses boutiques par-dessus le serveur.
      const amorcageApresSync = async () => {
        try { await amorcerSiVide(); setDb(await chargerTout()); } catch {}
      };

      // À CHAQUE OUVERTURE : synchronisation d'ouverture sûre.
      // Elle ENVOIE d'abord tout ce qui a été fait hors ligne, PUIS relit le
      // serveur. Les ventes du matin faites sans réseau partent donc en premier
      // et ne peuvent pas être écrasées. C'est la version prudente d'un
      // « tout retélécharger » — sans le danger de perdre des données locales.
      try {
        await synchroniserOuverture();
        await amorcageApresSync();
      } catch {}

      // Le rattrapage complet historique (données d'avant Supabase) reste fait
      // UNE seule fois par machine, après la synchro d'ouverture.
      try {
        const dejaFait = await autoResyncDejaFaite();
        if (!dejaFait) {
          await forcerResynchronisation();
          await synchroniser();
          await marquerAutoResyncFaite();
        }
      } catch {}
    })();
    return () => arreterSync();
  }, []);

  // Sécurité : déconnexion automatique après 15 minutes d'inactivité.
  // La session enregistrée localement est aussi rafraîchie pendant l'activité,
  // pour survivre à un rafraîchissement de page sans forcer une reconnexion.
  useEffect(() => {
    if (!profile) return;
    let derniereActivite = Date.now();
    const activite = () => {
      derniereActivite = Date.now();
      try {
        const brut = localStorage.getItem("bmi_session");
        if (brut) { const s = JSON.parse(brut); s.ts = Date.now(); localStorage.setItem("bmi_session", JSON.stringify(s)); }
      } catch {}
    };
    const evts = ["mousemove", "keydown", "click", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, activite));
    const minuterie = setInterval(() => {
      if (Date.now() - derniereActivite > DUREE_INACTIVITE) {
        setProfile(null);
        try { localStorage.removeItem("bmi_session"); } catch {}
      }
    }, 30000);
    return () => { evts.forEach((e) => window.removeEventListener(e, activite)); clearInterval(minuterie); };
  }, [profile]);

  // Toute modification est écrite d'abord en local (instantané, même sans
  // réseau), puis mise en file pour Supabase.
  // Toute action sensible est tracée dans le journal d'audit (onglet Historique)
  const save = async (next, action) => {
    const prev = dbRef.current;
    const final = action
      ? { ...next, audits: [{ id: uid(), date: new Date().toISOString(), user: profile?.nom || "Système", action }, ...(next.audits || [])] }
      : next;
    setDb(final);
    setSaveStatus("saving");
    try {
      await sauvegarderDiff(prev, final);
      setSaveStatus("saved");
      synchroniser(); // tentative immédiate si on est en ligne
    } catch {
      setSaveStatus("error");
    }
  };

  const [syncEnCours, setSyncEnCours] = useState(false);
  const load = async () => {
    if (syncEnCours) return;          // évite les clics multiples
    setSyncEnCours(true);
    try {
      await synchroniser();
      setDb(await chargerTout());
    } finally {
      setSyncEnCours(false);          // s'arrête TOUJOURS, même en cas d'erreur
    }
  };

  if (!db) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><LoadingSpinner /></div>;
  if (!profile) return <><DialogHost /><Login db={db} save={save} onLogin={(u) => {
    setProfile(u);
    try { localStorage.setItem("bmi_session", JSON.stringify({ id: u.id, ts: Date.now() })); } catch {}
    // Synchronisation d'ouverture à CHAQUE connexion manuelle : envoie d'abord ce
    // qui est en attente, puis relit. Sans écraser les données locales.
    synchroniserOuverture().then(async () => { setDb(await chargerTout()); }).catch(() => {});
    setTab(u.role === "admin" || u.role === "comptable" ? "dashboard" : (u.role === "commercial" || u.role === "technicien") ? "commande" : u.role === "resp_commercial" ? "equipe" : u.role === "technicien_bmi" ? "dimensionnement" : u.role === "magasinier" ? "stocks" : u.role === "client" ? "espace_client" : "ventes");
  }} /></>;

  const isAdmin = profile.role === "admin";
  const isCommercial = profile.role === "commercial";
  const isMagasinier = profile.role === "magasinier";
  const isGerant = profile.role === "gerant";
  const isTechnicien = profile.role === "technicien";
  const isTechnicienBMI = profile.role === "technicien_bmi";
  const isRespCom = profile.role === "resp_commercial";
  const isComptable = profile.role === "comptable";
  const isClient = profile.role === "client";

  const nonLus = compterNonLus(db, profile);
  const labelMessages = `💬 Messages${nonLus ? ` (${nonLus})` : ""}`;
  const nouveauxDevis = compterNouveauxDevis(db, profile);
  const labelTousDevis = (
    <span className="inline-flex items-center gap-1.5">
      📋 Tous les devis
      {nouveauxDevis > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full animate-pulse">{nouveauxDevis}</span>
      )}
    </span>
  );
  const notifsPaie = compterNotifsSalaire(db, profile);
  const labelSalaire = `💵 Salaire${notifsPaie ? ` (${notifsPaie})` : ""}`;
  const jeSuisApporteur = estApporteur(db, profile);
  const nbReponsesRav = compterReponsesRavitaillement(db, profile);
  const labelRavitaillement = `🚚 Ravitaillement${nbReponsesRav ? ` (${nbReponsesRav})` : ""}`;
  const nbTaches = compterTaches(db, profile);
  const labelTaches = `✅ Mes tâches${nbTaches ? ` (${nbTaches})` : ""}`;
  const demandesCredit = isAdmin ? compterDemandesCredit(db) : 0;
  const labelUsers = `👥 Utilisateurs${demandesCredit ? ` (${demandesCredit})` : ""}`;

  const tabs = isAdmin
    ? [["dashboard", "📊 Tableau de bord"], ["ventes", "💰 Ventes"], ["commandes", "📥 Commandes reçues"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["fournisseurs", "🚚 Fournisseurs"], ["commerciaux", "🎯 Commerciaux"], ["equipe", "👑 Équipe"], ["prospects", "🧲 Prospects"], ["parc", "🏠 Clients installés"], ["messages", labelMessages], ["salaires", "💵 Salaires"], ["users", labelUsers], ["historique", "🕘 Historique"], ["parametres", "⚙ Paramètres"]]
    : isComptable
    ? [["dashboard", "📊 Tableau de bord"], ["rentabilite", "📈 Rentabilité"], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["caisse", "🔒 Caisse"], ["stocks", "📦 Stocks"], ["clients", "👤 Clients"], ["historique", "🕘 Historique"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isRespCom
    ? [["equipe", "👑 Mon équipe"], ["prospects", "🧲 Prospects"], ["taches", labelTaches], ["parc", "🏠 Clients installés"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : (isCommercial || isTechnicien)
    ? [["commande", "🛒 Nouvelle commande"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["prospects", "🧲 Prospects"], ["parc", "🏠 Clients installés"], ["taches", labelTaches], ["messages", labelMessages], ["commission", "💵 Ma commission"], ["nouveau_client", "🙋 Créer un client"], ...(estChefEquipe(db, profile) ? [["equipe", "👑 Mon équipe"]] : [])]
    : isTechnicienBMI
    ? [["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["parc", "🏠 Clients installés"], ["prospects", "🧲 Prospects"], ["commission", "💵 Ma commission"], ["messages", labelMessages], ["salaire", labelSalaire], ["nouveau_client", "🙋 Créer un client"]]
    : isMagasinier
    ? [["stocks", "📦 Stocks"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isGerant
    ? [["ventes", "💰 Ventes"], ["commandes", "📥 Commandes reçues"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["stocks", "📦 Stocks"], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["fournisseurs", "🚚 Fournisseurs"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]]
    : isClient
    ? [["espace_client", "🏠 Mon espace"], ["messages", labelMessages]]
    : [["ventes", "💰 Ventes"], ["commandes", "📥 Commandes reçues"], ["dimensionnement", "☀️ Dimensionnement"], ["tous_devis", labelTousDevis], ["ravitaillement", labelRavitaillement], ["depenses", "📤 Dépenses"], ["dettes", "🧾 Dettes"], ["clients", "👤 Clients"], ["caisse", "🔒 Caisse"], ["salaire", labelSalaire], ["messages", labelMessages], ["nouveau_client", "🙋 Créer un client"]];

  // Tout utilisateur qui amène un client voit son onglet « Ma commission »
  const tabsPlus = jeSuisApporteur && !tabs.some(([id]) => id === "commission") && !isClient
    ? [...tabs, ["commission", "💵 Ma commission"]]
    : tabs;

  // Pouvoirs retirés par l'administrateur
  const tabsAutorises = tabsPlus.filter(([id]) => aDroit(db, profile, id));
  const ongletAutorise = tabsAutorises.some(([id]) => id === tab);
  const titreOnglet = (tabsAutorises.find(([id]) => id === tab) || ["", ""])[1];

  const BadgeSync = ({ sombre }) => (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1.5">
        {sync.enLigne && sync.supabaseOk
          ? <span className={`text-xs font-semibold ${sombre ? "text-green-400" : "text-green-700"}`}>🟢 En ligne{sync.enAttente ? ` · ${sync.enAttente} à envoyer` : ""}</span>
          : <span className={`text-xs font-semibold ${sombre ? "text-amber-400" : "text-amber-600"}`}>🔌 Hors ligne{sync.enAttente ? ` · ${sync.enAttente} en attente` : ""}</span>}
        {/* La version, TOUJOURS visible — y compris sur téléphone, où la barre
            latérale est cachée. C'est le premier réflexe après un déploiement. */}
        <span className={`text-[10px] font-bold ${sombre ? "text-sky-300/80" : "text-slate-400"}`}>v{VERSION}</span>
      </span>
      {/* Le nom de l'utilisateur connecté, en orange, sous le point vert.
          Visible partout — y compris sur téléphone où la barre latérale est cachée. */}
      {profile?.nom && (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-xs font-bold text-orange-500">👤 {profile.nom}</span>
          {nonLus > 0 && (
            <button
              onClick={() => setTab("messages")}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-red-600 rounded-full px-1.5 py-0.5 animate-pulse"
              title={`${nonLus} message${nonLus > 1 ? "s" : ""} non lu${nonLus > 1 ? "s" : ""}`}
            >
              💬 +{nonLus}
            </button>
          )}
        </span>
      )}
      {sync.erreur && <span className="text-[10px] text-red-400 max-w-[260px] truncate" title={sync.erreur}>⚠ {sync.erreur}</span>}
      {/* Dans le logiciel Windows, l'absence de VITE_SYNC_AUTH_URL empêche toute
          session sécurisée. On le dit, au lieu de laisser un « Failed to fetch » nu. */}
      {estAppWindows() && !etatAuth.ok && (
        <span className="text-[10px] text-amber-400 max-w-[260px] truncate" title={etatAuth.raison}>🔐 {etatAuth.raison}</span>
      )}
    </span>
  );

  const contenu = !tabsAutorises.length ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <div className="font-bold text-slate-800">Aucun accès</div>
      <div className="text-sm text-slate-500 mt-1">Tous vos pouvoirs ont été retirés par l'administrateur.</div>
    </div>
  ) : !ongletAutorise ? (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">🔒</div>
      <div className="font-bold text-slate-800">Accès non autorisé</div>
      <div className="text-sm text-slate-500 mt-1">Cet onglet a été désactivé par l'administrateur, ou n'est pas disponible pour votre compte. Choisissez un autre onglet dans le menu.</div>
    </div>
  ) : (
    <>
      {!peutEcrire(db, profile) && (
        <div className="mb-4 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
          🔒 <b>Compte en lecture seule.</b> Vous pouvez consulter les données et faire les exports, mais pas créer, modifier ni supprimer.
        </div>
      )}
      {isAdmin && rappelSauvegarde && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          💾 Aucune sauvegarde de secours récente. Allez dans <b>⚙ Paramètres → Sauvegarde de secours</b> pour exporter une copie de vos données.
        </div>
      )}
      {/* Interrupteur de disponibilité — pour les techniciens (commission et BMI). */}
      {profile.role === "technicien" && (() => {
        const moi = db.users.find((u) => u.id === profile.id) || {};
        const dispo = moi.indisponible !== true;
        const basculer = () => {
          const next = !dispo; // next = nouvelle disponibilité
          save({
            ...db,
            users: db.users.map((u) => (u.id === profile.id ? { ...u, indisponible: !next } : u)),
          }, `${profile.nom} se déclare ${next ? "DISPONIBLE" : "INDISPONIBLE"}`);
        };
        return (
          <div className={`mb-4 rounded-xl p-4 border-2 ${dispo ? "bg-green-50 border-green-300" : "bg-slate-100 border-slate-300"}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className={`font-bold ${dispo ? "text-green-800" : "text-slate-600"}`}>
                  {dispo ? "🟢 Vous êtes DISPONIBLE" : "⛔ Vous êtes INDISPONIBLE"}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {dispo
                    ? "On peut vous affecter à des installations."
                    : "Vous n'apparaîtrez pas dans les équipes à affecter, tant que vous restez indisponible."}
                </div>
              </div>
              <button onClick={basculer} className={`px-5 py-2 rounded-lg font-bold text-sm ${dispo ? "bg-slate-700 text-white hover:bg-slate-800" : "bg-green-700 text-white hover:bg-green-800"}`}>
                {dispo ? "Me mettre indisponible" : "Me remettre disponible"}
              </button>
            </div>
          </div>
        );
      })()}

      {tab === "dashboard" && (isAdmin || isComptable) && <Dashboard db={db} />}
      {tab === "ventes" && !isCommercial && <Ventes db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)} />}
      {tab === "commande" && isCommercial && <NouvelleCommande db={db} save={save} profile={profile} preRempli={preRempli} onPreRempliConsomme={() => setPreRempli(null)} />}
      {tab === "commandes" && !isCommercial && <CommandesRecues db={db} save={save} profile={profile} onValider={(boutique, panier, commercial, responsable, rabais, origineDevis, remisePct) => { setPreRempli({ boutique, panier, commercial, responsable, rabais, origineDevis, remise: remisePct }); setTab("ventes"); }} />}
      {tab === "dimensionnement" && <Dimensionnement db={db} profile={profile} save={save} devisAReprendre={devisAReprendre} onDevisRepriseConsomme={() => setDevisAReprendre(null)} onConvertirEnVente={(boutique, panier, remise) => {
        if (isTechnicienBMI) { uAlert("Un compte Technicien BMI ne peut pas convertir un devis en vente. Transmettez le devis à un vendeur ou à l'administration."); return; }
        setPreRempli({ boutique, panier, remise });
        setTab((isCommercial || isTechnicien) ? "commande" : "ventes");
      }} />}
      {tab === "tous_devis" && <TousLesDevis db={db} save={save} profile={profile} onModifierDevis={(devis, client) => { setDevisAReprendre({ devis, client }); setTab("dimensionnement"); }} />}
      {tab === "depenses" && <Depenses db={db} save={save} profile={profile} />}
      {tab === "dettes" && <Dettes db={db} save={save} profile={profile} />}
      {tab === "clients" && <Clients db={db} profile={profile} />}
      {tab === "nouveau_client" && <CreerClient db={db} save={save} profile={profile} />}
      {tab === "caisse" && <Caisse db={db} save={save} profile={profile} />}
      {tab === "stocks" && (isAdmin || isMagasinier || isGerant || isComptable) && <Stocks db={db} save={save} profile={profile} />}
      {tab === "fournisseurs" && (isAdmin || isGerant) && <Fournisseurs db={db} save={save} />}
      {tab === "commerciaux" && isAdmin && <Commerciaux db={db} save={save} />}
      {tab === "rentabilite" && (isAdmin || isComptable) && <Rentabilite db={db} />}
      {tab === "salaires" && isAdmin && <SalairesAdmin db={db} save={save} profile={profile} />}
      {tab === "users" && isAdmin && <Users db={db} save={save} profile={profile} />}
      {tab === "historique" && (isAdmin || isComptable) && <Historique db={db} />}
      {tab === "commission" && jeSuisApporteur && <MaCommission db={db} profile={profile} />}
      {tab === "equipe" && (isAdmin || isRespCom || ((isCommercial || isTechnicien) && estChefEquipe(db, profile))) && <MonEquipe db={db} save={save} profile={profile} />}
      {tab === "taches" && (isCommercial || isTechnicien || isRespCom) && <MesTaches db={db} save={save} profile={profile} />}
      {tab === "parc" && (isAdmin || isCommercial || isTechnicien || isTechnicienBMI || isRespCom) && <ClientsInstalles db={db} save={save} profile={profile} isAdmin={isAdmin} />}
      {tab === "messages" && <Messagerie db={db} save={save} profile={profile} />}
      {tab === "ravitaillement" && profile.boutique && <DemandeRavitaillement db={db} save={save} profile={profile} boutique={profile.boutique} marquerVues />}
      {tab === "salaire" && SALARIES.includes(profile.role) && <Salaire db={db} save={save} profile={profile} />}
      {tab === "espace_client" && isClient && <EspaceClient db={db} profile={profile} save={save} setTab={setTab} />}
      {tab === "prospects" && (isAdmin || isCommercial || isTechnicienBMI || isRespCom) && <Prospects db={db} save={save} profile={profile} isAdmin={isAdmin} />}
      {tab === "parametres" && isAdmin && <Parametres db={db} save={save} setDb={setDb} profile={profile} dossierAuto={dossierAuto} setDossierAuto={setDossierAuto} dernierAuto={dernierAuto} />}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <DialogHost />
      <ExportHost />
      <PrintHost />

      {/* ══ Barre latérale professionnelle (grand écran) ══ */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-gradient-to-b from-slate-950 via-sky-950 to-slate-900 text-white h-screen sticky top-0">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
          <img src={LOGO} alt="BMI" className="h-11 w-auto rounded-lg bg-white p-1" />
          <div>
            <div className="font-bold leading-tight tracking-wide">BMI-GESTION SYSTÈME <span className="text-[10px] font-semibold text-sky-300/80">v{VERSION}</span></div>
            <div className="text-[10px] text-sky-200/70 uppercase tracking-widest">Lomé, Togo</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {tabsAutorises.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === id ? "bg-sky-700/60 text-white shadow-inner" : "text-sky-100/70 hover:bg-white/10 hover:text-white"}`}>
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-white/10 space-y-2">
          <BadgeSync sombre />
          {profile.boutique && <div className="text-xs text-sky-100 flex items-center gap-2"><Badge boutique={profile.boutique} /></div>}
          <div className="flex gap-2">
            <button onClick={load} disabled={syncEnCours} className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold disabled:opacity-70">
              <span className={`inline-block ${syncEnCours ? "animate-spin" : ""}`}>⟳</span> {syncEnCours ? "Synchronisation…" : "Synchroniser"}
            </button>
            <button onClick={() => { setProfile(null); try { localStorage.removeItem("bmi_session"); } catch {} }} className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold">Se déconnecter</button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* ══ En-tête compact (petit écran) ══ */}
        <header className="lg:hidden bg-gradient-to-r from-slate-900 via-sky-950 to-sky-900 text-white shadow-md">
          <div className="px-4 py-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="BMI Togo" className="h-10 w-auto rounded bg-white p-1" />
              <div>
                <div className="font-bold text-lg leading-tight">BMI-GESTION SYSTÈME</div>
                <div className="text-xs text-slate-400">Lomé, Togo</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <BadgeSync sombre />
              {saveStatus === "error" && <span className="text-xs text-red-400">⚠ Erreur locale</span>}
              <button onClick={load} disabled={syncEnCours} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold disabled:opacity-70">
                <span className={`inline-block ${syncEnCours ? "animate-spin" : ""}`}>⟳</span> {syncEnCours ? "Synchronisation…" : "Synchroniser"}
              </button>
              {profile.boutique && <span className="hidden sm:flex items-center gap-2 text-slate-300"><Badge boutique={profile.boutique} /></span>}
              <button onClick={() => { setProfile(null); try { localStorage.removeItem("bmi_session"); } catch {} }} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-semibold">Se déconnecter</button>
            </div>
          </div>
          <nav className="px-4 flex gap-1 overflow-x-auto">
            {tabsAutorises.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-2 text-sm font-semibold whitespace-nowrap rounded-t-lg ${tab === id ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:text-white"}`}>{label}</button>
            ))}
          </nav>
        </header>

        {/* ══ Barre supérieure (grand écran) ══ */}
        <div className="hidden lg:flex items-center justify-between bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-20 shadow-sm">
          <div className="text-lg font-bold text-slate-800">{titreOnglet}</div>
          <div className="flex items-center gap-4">
            {saveStatus === "error" && <span className="text-xs text-red-600 font-semibold">⚠ Erreur locale</span>}
            <BadgeSync />
            <span className="text-xs text-slate-400">{dFR(today())}</span>
          </div>
        </div>

        <main className="w-full max-w-6xl mx-auto px-4 py-5">
          {contenu}
        </main>
      </div>
    </div>
  );
}

// ============ CONNEXION ============
function Login({ db, onLogin, save }) {
  const [nomSaisi, setNomSaisi] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const go = async () => {
    const saisie = nomSaisi.trim().toLowerCase();
    if (!saisie) { setErr("Entrez votre nom d'utilisateur."); return; }
    const u = db.users.find((x) => x.nom.trim().toLowerCase() === saisie);
    if (!u) { setErr("Utilisateur introuvable."); return; }
    if (u.actif === false) { setErr("Ce compte a été bloqué par l'administrateur."); return; }
    const h = await hacher(pwd);
    const ok = u.pwd_hash ? u.pwd_hash === h : u.pwd === pwd;
    if (!ok) { setErr("Mot de passe incorrect."); return; }
    // Migration : les anciens mots de passe en clair sont hachés au 1er login
    if (!u.pwd_hash && save) {
      save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, pwd_hash: h, pwd: undefined } : x)) });
    }
    // Établit une vraie session Supabase sécurisée (en arrière-plan, sans
    // bloquer la connexion si hors ligne ou serveur indisponible)
    synchroniserAuth(u.id, pwd);
    onLogin(u);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="text-center mb-5">
          <img src={LOGO} alt="BMI Togo" className="mx-auto mb-3 w-40 h-auto" />
          <div className="text-xl font-bold text-slate-900">GESTION SYSTÈME</div>
          <span className="inline-block px-3 py-1 rounded-full text-sm font-bold text-white mt-2" style={{ backgroundColor: db.boutiques.find((b) => b.nom === "DEMAKPOE")?.couleur || "#0284c7" }}>BIENVENUE SUR NOTRE SYSTÈME</span>
          <div className="text-xs text-slate-400 mt-1">Espace de gestion — Lomé, Togo</div>
        </div>
        <div className="space-y-3">
          <Field label="Utilisateur">
            <input className={inputCls} autoCapitalize="words" placeholder="Votre nom" value={nomSaisi} onChange={(e) => { setNomSaisi(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
          </Field>
          <Field label="Mot de passe">
            <input type="password" className={inputCls} value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && go()} />
          </Field>
          {err && <div className="text-xs text-red-600 font-semibold">{err}</div>}
          <button onClick={go} className="w-full py-2.5 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">Se connecter</button>
          <div className="text-center text-[11px] text-slate-400">Version {VERSION}</div>
        </div>
      </div>
    </div>
  );
}

// ============ TABLEAU DE BORD ============
function Dashboard({ db }) {
  const NOMS = db.boutiques.map((b) => b.nom);
  const [periodeIndex, setPeriodeIndex] = useState(2);
  const [customDebut, setCustomDebut] = useState("");
  const [customFin, setCustomFin] = useState("");

  const getPeriod = useCallback(() => {
    if (periodeIndex === "custom") {
      return ["Personnalisée", customDebut || today(), customFin || today()];
    }
    return periodes()[periodeIndex] || periodes()[2];
  }, [periodeIndex, customDebut, customFin]);

  const rows = periodes().map(([label, a, b]) => {
    const v = {}, d = {};
    NOMS.forEach((bq) => {
      v[bq] = db.ventes.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + totalVente(x), 0);
      d[bq] = db.depenses.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + Number(x.montant), 0);
    });
    return { label, v, d };
  });

  const customRow = (() => {
    const [label, a, b] = getPeriod();
    const v = {}, d = {};
    NOMS.forEach((bq) => {
      v[bq] = db.ventes.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + totalVente(x), 0);
      d[bq] = db.depenses.filter((x) => x.boutique === bq && inP(x.date, a, b)).reduce((s, x) => s + Number(x.montant), 0);
    });
    return { label, v, d };
  })();

  const dettes = {}, alertes = {}, valA = {}, valV = {};
  NOMS.forEach((b) => {
    // Les réservations prépayées ne sont PAS des créances : le client n'a rien reçu.
    dettes[b] = dettesClassiques(db).filter((x) => x.boutique === b).reduce((s, x) => s + Math.max(0, x.montant - x.paye), 0);
    const ps = db.produits.filter((p) => p.boutique === b);
    alertes[b] = ps.filter((p) => stockActuel(db, p) <= Number(p.seuil)).length;
    valA[b] = ps.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_achat), 0);
    valV[b] = ps.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_vente), 0);
  });

  const somme = (obj) => NOMS.reduce((s, b) => s + (obj[b] || 0), 0);
  const m = rows[2];
  const resM = somme(m.v) - somme(m.d);
  const resCustom = somme(customRow.v) - somme(customRow.d);

  const totalVentes = db.ventes.reduce((s, v) => s + totalVente(v), 0);
  const totalDepenses = db.depenses.reduce((s, d) => s + Number(d.montant), 0);
  const totalDettes = dettesClassiques(db).reduce((s, d) => s + Math.max(0, d.montant - d.paye), 0);
  // Avances encaissées sur réservations non encore livrées : c'est de l'argent reçu
  // que l'entreprise DOIT en marchandise. C'est un engagement, pas une créance.
  const totalAvances = reservations(db).filter((r) => r.statut !== "livree" && r.statut !== "annulee")
    .reduce((s, r) => s + Number(r.paye || 0), 0);
  const nbVentes = db.ventes.length;
  const nbClients = new Set(db.ventes.filter(v => v.client).map(v => v.client)).size;

  const Stat = ({ label, value, accent }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-sky-700">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${accent || "text-slate-900"}`}>{value}</div>
    </div>
  );

  const moisNoms = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const mois6 = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const vals = {};
    NOMS.forEach((b) => {
      vals[b] = db.ventes.filter((x) => x.boutique === b && String(x.date).slice(0, 7) === key).reduce((s, x) => s + totalVente(x), 0);
    });
    mois6.push({ nom: moisNoms[d.getMonth()], vals });
  }
  const maxV = Math.max(1, ...mois6.flatMap((x) => NOMS.map((b) => x.vals[b])));

  // Analyses sur la période sélectionnée
  const [, paG, pbG] = getPeriod();
  const ventesPeriode = db.ventes.filter((v) => inP(v.date, paG, pbG));
  const topProduits = (() => {
    const cumul = {};
    ventesPeriode.forEach((v) => lignesVente(v).forEach((l) => { cumul[l.article] = (cumul[l.article] || 0) + Number(l.qte) * Number(l.pu); }));
    return Object.entries(cumul).sort((x, y) => y[1] - x[1]).slice(0, 5);
  })();
  const maxTop = Math.max(1, ...topProduits.map((x) => x[1]));
  const repPaiements = (() => {
    const cumul = {};
    ventesPeriode.forEach((v) => { const k = v.paiement || "Autre"; cumul[k] = (cumul[k] || 0) + totalVente(v); });
    return Object.entries(cumul).sort((x, y) => y[1] - x[1]);
  })();
  const totalPai = Math.max(1, repPaiements.reduce((s, x) => s + x[1], 0));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total des ventes" value={fmt(totalVentes)} />
        <Stat label="Total des dépenses" value={fmt(totalDepenses)} />
        <Stat label="Total des dettes" value={fmt(totalDettes)} accent="text-red-600" />
        {totalAvances > 0 && <Stat label="Avances clients à livrer" value={fmt(totalAvances)} accent="text-orange-600" />}
        <Stat label="Clients uniques" value={nbClients} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-bold text-slate-800">Période :</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
            value={periodeIndex}
            onChange={(e) => setPeriodeIndex(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          >
            {periodes().map(([label], i) => (
              <option key={i} value={i}>{label}</option>
            ))}
            <option value="custom">Personnalisée</option>
          </select>

          {periodeIndex === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={customDebut}
                onChange={(e) => setCustomDebut(e.target.value)}
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={customFin}
                onChange={(e) => setCustomFin(e.target.value)}
              />
            </div>
          )}

          {periodeIndex === "custom" && (
            <div className="ml-auto text-sm font-semibold">
              Résultat : <span className={resCustom >= 0 ? "text-green-700" : "text-red-600"}>{fmt(resCustom)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Ventes du mois" value={fmt(somme(m.v))} />
        <Stat label="Dépenses du mois" value={fmt(somme(m.d))} />
        <Stat label="Résultat du mois" value={fmt(resM)} accent={resM >= 0 ? "text-green-700" : "text-red-600"} />
        <Stat label="Dettes en cours" value={fmt(somme(dettes))} accent="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="font-bold text-slate-800">Ventes des 6 derniers mois</div>
          <div className="flex gap-3 text-xs font-semibold flex-wrap">
            {NOMS.map((b) => (
              <span key={b} className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: col(b) }}></span>{b}</span>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2 h-40">
          {mois6.map((x) => (
            <div key={x.nom} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-1 h-32">
                {NOMS.map((b) => (
                  <div key={b} className="rounded-t" title={`${b} : ${fmt(x.vals[b])}`}
                    style={{ width: `${Math.max(8, 30 / NOMS.length)}%`, backgroundColor: col(b), height: `${(x.vals[b] / maxV) * 100}%`, minHeight: x.vals[b] ? 3 : 0 }}></div>
                ))}
              </div>
              <div className="text-xs font-semibold text-slate-500">{x.nom}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">🏆 Top 5 des produits (période sélectionnée)</div>
          {topProduits.length === 0 && <div className="text-sm text-slate-400">Aucune vente sur cette période.</div>}
          <div className="space-y-2">
            {topProduits.map(([nom, ca]) => (
              <div key={nom}>
                <div className="flex justify-between text-xs font-semibold text-slate-700"><span>{nom}</span><span className="tabular-nums">{fmt(ca)}</span></div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-sky-700" style={{ width: `${Math.max(4, (ca / maxTop) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="font-bold text-slate-800 mb-3">💳 Répartition des paiements (période sélectionnée)</div>
          {repPaiements.length === 0 && <div className="text-sm text-slate-400">Aucune vente sur cette période.</div>}
          <div className="space-y-2">
            {repPaiements.map(([mode, ca]) => (
              <div key={mode}>
                <div className="flex justify-between text-xs font-semibold text-slate-700"><span>{mode}</span><span className="tabular-nums">{fmt(ca)} · {Math.round((ca / totalPai) * 100)} %</span></div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.max(4, (ca / totalPai) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Synthèse par période</div>
        <table className="w-full text-sm" style={{ minWidth: 480 + NOMS.length * 140 }}>
          <thead><tr className="text-xs text-slate-500 uppercase">
            <th className="text-left px-4 py-2">Période</th>
            {NOMS.map((b) => <th key={b} className="text-right px-3 py-2">Ventes {b}</th>)}
            <th className="text-right px-3 py-2">Dépenses</th>
            <th className="text-right px-4 py-2">Résultat</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const res = somme(r.v) - somme(r.d);
              return (
                <tr key={r.label} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-4 py-2 font-semibold">{r.label}</td>
                  {NOMS.map((b) => <td key={b} className="px-3 py-2 text-right tabular-nums" style={{ color: col(b) }}>{fmt(r.v[b])}</td>)}
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(somme(r.d))}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-bold ${res >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(res)}</td>
                </tr>
              );
            })}
            {periodeIndex === "custom" && (
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="px-4 py-2 font-bold">{customRow.label}</td>
                {NOMS.map((b) => <td key={b} className="px-3 py-2 text-right tabular-nums font-bold" style={{ color: col(b) }}>{fmt(customRow.v[b])}</td>)}
                <td className="px-3 py-2 text-right tabular-nums font-bold">{fmt(somme(customRow.d))}</td>
                <td className={`px-4 py-2 text-right tabular-nums font-bold ${resCustom >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(resCustom)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-2">Exporter les données (Excel / CSV)</div>
        <div className="flex gap-2 flex-wrap">
          <button className={btnDark} onClick={() => exportCSV("ventes", ["Date", "N° reçu", "Boutique", "Articles", "Client", "Téléphone", "Qté totale", "Remise (%)", "Remise (F)", "Total", "Paiement", "Commercial", "Saisi par"],
            db.ventes.map((v) => [dFR(v.date), numeroRecu(v), v.boutique, resumeArticles(v), v.client, v.tel, qteVente(v), v.remise_pct || "", v.remise || 0, totalVente(v), v.paiement, v.commercial, v.par]))}>Ventes</button>
          <button className={btnDark} onClick={() => exportCSV("depenses", ["Date", "Boutique", "Catégorie", "Description", "Montant", "Paiement", "Saisi par"],
            db.depenses.map((x) => [dFR(x.date), x.boutique, x.categorie, x.description, x.montant, x.paiement, x.par]))}>Dépenses</button>
          <button className={btnDark} onClick={() => exportCSV("dettes", ["Date", "Nature", "Boutique", "Client", "Téléphone", "Motif", "Montant", "Payé", "Reste", "Saisi par"],
            db.dettes.map((d) => [dFR(d.date), estReservation(d) ? "Réservation prépayée" : "Dette", d.boutique, d.client, d.tel, d.motif, d.montant, d.paye, Math.max(0, d.montant - d.paye), d.par]))}>Dettes</button>
          <button className={btnDark} onClick={() => exportCSV("stocks", ["Boutique", "Article", "Catégorie", "Initial", "Entrées", "Vendus", "Ajustements", "Stock actuel", "Seuil", "Prix achat", "Prix vente"],
            db.produits.map((p) => [p.boutique, p.nom, p.categorie, p.initial, p.entrees, stockVendu(db, p.id), stockAjuste(db, p.id), stockActuel(db, p), p.seuil, p.prix_achat, p.prix_vente]))}>Stocks</button>
          <button className="px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800"
            onClick={() => { const [lp, pa, pb] = getPeriod(); exportCSV("journal_comptable", ["Date", "Journal", "Pièce", "Compte", "Intitulé du compte", "Libellé", "Débit", "Crédit", "Boutique"], lignesJournal(db, pa, pb), lp.replace(/\s/g, "_")); }}>📒 Journal comptable (SYSCOHADA)</button>
        </div>
        <div className="text-xs text-slate-400 mt-2">Fichiers CSV compatibles Excel (séparateur point-virgule). Le journal comptable couvre la période sélectionnée plus haut : écritures en partie double (ventes, dépenses, règlements de dettes) avec les comptes SYSCOHADA de base — à remettre à votre comptable, qui peut adapter les codes si besoin.</div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {NOMS.map((b) => (
          <div key={b} className="bg-white rounded-xl border-2 p-4" style={{ borderColor: col(b) }}>
            <div className="mb-3"><Badge boutique={b} /></div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-xs text-slate-500">Dettes clients</div><div className="font-bold tabular-nums">{fmt(dettes[b])}</div></div>
              <div><div className="text-xs text-slate-500">Alertes stock</div><div className={`font-bold ${alertes[b] ? "text-red-600" : ""}`}>{alertes[b]} article(s)</div></div>
              <div><div className="text-xs text-slate-500">Stock (prix d'achat)</div><div className="font-bold tabular-nums">{fmt(valA[b])}</div></div>
              <div><div className="text-xs text-slate-500">Stock (prix de vente)</div><div className="font-bold tabular-nums">{fmt(valV[b])}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SÉLECTEUR BOUTIQUE ============
function BoutiqueTabs({ db, value, onChange, avecDepots = false }) {
  const liste = avecDepots ? db.boutiques : boutiquesVente(db);
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {liste.map((b) => (
        <button key={b.nom} onClick={() => onChange(b.nom)}
          className={`px-4 py-1.5 rounded-full text-sm font-bold ${value === b.nom ? "text-white" : "bg-white border border-slate-300 text-slate-600"}`}
          style={value === b.nom ? { backgroundColor: b.couleur } : {}}>{b.depot ? "🏭 " : ""}{b.nom}</button>
      ))}
    </div>
  );
}

// ============ SÉLECTEUR D'ARTICLE (recherche tactile, sans menu natif) ============
function SelecteurArticle({ produits, valeur, onChoisir, dispoRestant, categorieFiltre }) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const selectionne = produits.find((p) => p.id === valeur);
  const base = categorieFiltre ? produits.filter((p) => (p.categorie || "Autre") === categorieFiltre) : produits;
  const filtres = recherche ? base.filter((p) => p.nom.toLowerCase().includes(recherche.toLowerCase())) : base;
  const categories = [...new Set(filtres.map((p) => p.categorie || "Autre"))].sort();

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className={`${inputCls} text-left flex items-center justify-between`}>
        <span className={selectionne ? "" : "text-slate-400"}>{selectionne ? selectionne.nom : "— Choisir un article —"}</span>
        <span className="text-slate-400">▾</span>
      </button>
      {ouvert && createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => { setOuvert(false); setRecherche(""); }}>
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-200">
              <input autoFocus className={inputCls} placeholder="🔍 Rechercher un article…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtres.length === 0 && <div className="p-6 text-sm text-slate-400 text-center">Aucun article trouvé.</div>}
              {categories.map((c) => (
                <div key={c}>
                  <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50 sticky top-0">{c}</div>
                  {filtres.filter((p) => (p.categorie || "Autre") === c).map((p) => (
                    <button key={p.id} type="button" onClick={() => { onChoisir(p.id); setOuvert(false); setRecherche(""); }}
                      className="w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between">
                      <span className="font-medium">{p.nom}</span>
                      <span className="text-xs text-slate-400 whitespace-nowrap ml-2">dispo : {dispoRestant(p)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => { setOuvert(false); setRecherche(""); }} className="p-3 text-sm font-semibold text-slate-500 border-t border-slate-200">Fermer</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ============ VENTES ============
function Ventes({ db, save, profile, preRempli, onPreRempliConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || preRempli?.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produits = db.produits.filter((p) => p.boutique === boutique);
  const commerciaux = apporteursPossibles(db);
  const categories = [...new Set(produits.map((p) => p.categorie || "Autre"))].sort();

  const [cat, setCat] = useState("");
  const [sel, setSel] = useState({ produit_id: "", qte: "", pu: "" });
  const [panier, setPanier] = useState(() => preRempli?.panier || []);
  // ATTENTION : preRempli est vidé dès l'affichage. On garde donc l'origine du
  // devis dans l'état local, sinon elle serait perdue avant l'encaissement.
  const [origineDevis, setOrigineDevis] = useState(() => preRempli?.origineDevis || null);
  useEffect(() => { if (preRempli && onPreRempliConsomme) onPreRempliConsomme(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [f, setF] = useState({ client: "", tel: "", remise: preRempli?.remise ? String(preRempli.remise) : "", paiement: PAIEMENTS[0], avance: "", commercial: preRempli?.commercial || (profile.role === "commercial" ? profile.nom : ""), responsable: preRempli?.responsable || null, rabais: preRempli?.rabais || "" });
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
    setSel({ produit_id: id, qte: "1", pu: p && p.prix_vente != null ? String(p.prix_vente) : "" });
    // La catégorie de l'article choisi s'affiche automatiquement dans le filtre
    if (p) setCat(p.categorie || "Autre");
  };

  const mettreAuPanier = (p, q, pu) => {
    setPanier((pan) => {
      const i = pan.findIndex((l) => l.produit_id === p.id && Number(l.pu) === Number(pu));
      if (i >= 0) { const cp = [...pan]; cp[i] = { ...cp[i], qte: Number(cp[i].qte) + q }; return cp; }
      return [...pan, { produit_id: p.id, article: p.nom, qte: q, pu: Number(pu) }];
    });
  };

  const ajouterAuPanier = () => {
    const p = produits.find((x) => x.id === sel.produit_id);
    const q = Number(sel.qte);
    if (!p || !q || q <= 0 || !sel.pu) { setMsg("Choisissez un article, la quantité et le prix."); return; }
    if (q > dispoRestant(p)) { setMsg(`Stock insuffisant : il reste ${dispoRestant(p)} pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, q, sel.pu);
    setSel({ produit_id: "", qte: "", pu: "" });
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

  const brut = panier.reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);
  const remisePct = Number(f.remise || 0);
  const remise = Math.round((brut * remisePct) / 100);
  // RABAIS COMMERCIAL : le commercial l'offre au client sur SA commission.
  // Il est plafonné au montant de sa commission — il ne peut pas donner ce qu'il n'a pas.
  const apporteurUser = db.users.find((u) => u.nom === f.commercial);
  const tauxCom = Number(apporteurUser?.taux_commission || 0);
  const rabaisMax = Math.round(((brut - remise) * tauxCom) / 100);
  const rabais = Math.min(Number(f.rabais || 0), rabaisMax);
  const total = brut - remise - rabais;

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
      article: l.nom || (produits.find((x) => x.id === l.produit_id)?.nom) || "Article",
      qte: Number(l.qte), pu: Number(l.pu), total: Number(l.qte) * Number(l.pu),
    })),
    total: brut,           // total des articles, SANS remise ni rabais : c'est un prix affiché
    validite: "15 jours",
  });

  const enregistrerProforma = (pf) => {
    // On garde une trace (liste visible par vendeur / resp. commercial / admin).
    const ligne = { id: uid(), date: today(), ts: new Date().toISOString(),
      numero: pf.numero, boutique, client: pf.client, tel: pf.tel,
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
      `*TOTAL : ${pf.total.toLocaleString("fr-FR")} FCFA*`,
      ``,
      `Ceci est une offre de prix (proforma), sans valeur de reçu. Valable ${pf.validite}.`,
      `BMI TOGO — Les bâtiments modernes et intelligents`,
    ];
    const num = telDigits(pf.tel);
    const txt = encodeURIComponent(lignes.join("\n"));
    window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
    setMsg(`✅ Proforma ${pf.numero} émis et envoyé par WhatsApp (non comptabilisé).`);
  };

  const proformaPDF = () => {
    if (panier.length === 0) { setMsg("Ajoutez au moins un article avant d'émettre un proforma."); return; }
    const pf = construireProforma();
    enregistrerProforma(pf);
    genererProforma(pf, LOGO);
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
    if (!await uConfirm(`Confirmer la vente de ${panier.length} article(s) pour ${fmt(total)}${remise ? ` (remise ${remisePct} % = −${fmt(remise)})` : ""} ?`)) return;

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
      paiement: f.paiement,
      avance: f.paiement === "Crédit (dette)" ? Math.max(0, Math.min(total, Number(f.avance) || 0)) : 0,
      commercial: f.commercial || null,
      responsable: f.responsable || null,
      rabais,                                   // rabais RÉELLEMENT appliqué (plafonné à sa commission)
      apporteur: apporteurExterne(total),
      par: profile.nom,
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
    save(next, od
      ? `Vente ${numero} (${fmt(total)}) — ${boutique} — DEVIS PAYÉ : chantier créé, à programmer`
      : `Vente ${numero} (${fmt(total)}) — ${boutique}`);
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
                <select className={inputCls} value={cat} onChange={(e) => { setCat(e.target.value); setSel({ produit_id: "", qte: "", pu: "" }); }}>
                  <option value="">— Toutes —</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Article">
                <SelecteurArticle produits={produits} valeur={sel.produit_id} onChoisir={choisir} dispoRestant={dispoRestant} categorieFiltre={cat} />
              </Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={sel.qte} onChange={(e) => setSel({ ...sel, qte: e.target.value })} /></Field>
              <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={sel.pu} onChange={(e) => setSel({ ...sel, pu: e.target.value })} /></Field>
              <div className="flex items-end"><button onClick={ajouterAuPanier} className={`w-full ${btnDark}`}>➕ Ajouter au panier</button></div>
            </div>

            <div className="mt-4 bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <div className="px-3 py-2 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">🛒 Panier ({panier.length} article{panier.length > 1 ? "s" : ""})</div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "P.U.", "Montant", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {panier.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Panier vide — scannez ou choisissez des articles.</td></tr>}
                  {panier.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{l.article}</td>
                      <td className="px-3 py-2 tabular-nums">{l.qte}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(l.pu)}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.qte * l.pu)}</td>
                      <td className="px-3 py-2"><button onClick={() => retirer(i)} className="text-xs text-red-600 underline">Retirer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Client (facultatif)"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
              <Field label="Numéro du client"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
              <Field label="Remise (%) — facultatif"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.remise} onChange={(e) => setF({ ...f, remise: e.target.value })} /></Field>
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

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button onClick={encaisserVente} className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800 shadow-sm">💳 Encaisser la vente</button>
              <button onClick={proformaWhatsApp} title="Envoyer une offre de prix au client (non comptabilisée)" className="px-4 py-2.5 rounded-lg bg-white border-2 border-sky-400 text-sky-700 font-bold text-sm hover:bg-sky-50">🧾 Proforma WhatsApp</button>
              <button onClick={proformaPDF} title="Imprimer une offre de prix (non comptabilisée)" className="px-3 py-2.5 rounded-lg bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50">🖨️</button>
              <span className="text-base font-bold tabular-nums">Total : {fmt(total)}{remise > 0 && <span className="text-red-600 text-sm font-semibold"> (remise −{fmt(remise)})</span>}</span>
              {msg && <span className="text-sm text-red-600 font-semibold">{msg}</span>}
            </div>
          </>
        )}
      </Panel>

      {/* Liste des proformas émis — visible par vendeur, resp. commercial, admin. */}
      {["vendeur", "gerant", "resp_commercial", "admin"].includes(profile.role) && (db.proformas || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-sky-50">🧾 Proformas émis ({(db.proformas || []).length}) — non comptabilisés</div>
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "N°", "Client", "Articles", "Total", "Émis par", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {(db.proformas || []).map((pf) => (
                <tr key={pf.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(pf.date)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{pf.numero}</td>
                  <td className="px-3 py-2">{pf.client || "—"}{pf.tel ? <span className="text-slate-400"> · {pf.tel}</span> : null}</td>
                  <td className="px-3 py-2 text-slate-500">{(pf.lignes || []).length} article(s)</td>
                  <td className="px-3 py-2 font-semibold">{fmt(pf.total)}</td>
                  <td className="px-3 py-2 text-slate-500">{pf.par}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => genererProforma({ numero: pf.numero, date: dFR(pf.date), boutique: pf.boutique, client: pf.client, tel: pf.tel, lignes: pf.lignes, total: pf.total, validite: "15 jours" }, LOGO)} className="text-xs text-sky-700 underline">🖨️ Réimprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Ventes — {boutique}</span><span className="text-sm font-semibold text-slate-500">Aujourd'hui : {fmt(totalJour)}</span>
        </div>
        <table className="w-full text-sm min-w-[1000px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "N° reçu", "Articles", "Client", "Qté", "Remise", "Total", "Paiement", "Commercial", "Reçu", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={11} className="px-4 py-6 text-center text-slate-400">Aucune vente pour l'instant.</td></tr>}
            {liste.map((v) => (
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
                  <button onClick={() => imprimerRecu(v, infoBq(v.boutique))} className="text-xs font-bold text-sky-800 underline mr-2" title="Imprimer le reçu">🖨</button>
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
      </div>
    </div>
  );
}

// ============ NOUVELLE COMMANDE (rôle Commercial) ============
// Le commercial compose un panier et l'envoie à une boutique — il ne peut
// pas encaisser lui-même, c'est un vendeur de cette boutique qui validera.
function NouvelleCommande({ db, save, profile, preRempli, onPreRempliConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(preRempli?.boutique || premiere);
  const boutique = bq;
  const produits = db.produits.filter((p) => p.boutique === boutique);
  const categories = [...new Set(produits.map((p) => p.categorie || "Autre"))].sort();

  const [cat, setCat] = useState("");
  const [sel, setSel] = useState({ produit_id: "", qte: "", pu: "" });
  const [panier, setPanier] = useState([]);
  const [f, setF] = useState({ client: "", tel: "", remise: preRempli?.remise ? String(preRempli.remise) : "", paiement: PAIEMENTS[0], vendeurCible: "", responsable: "", rabais: "" });
  // Responsables commerciaux actifs, que le commercial peut associer VOLONTAIREMENT
  // à sa commande pour partager la commission.
  const responsables = db.users.filter((u) => u.role === "resp_commercial" && u.actif !== false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { if (preRempli && onPreRempliConsomme) onPreRempliConsomme(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vendeursBoutique = db.users.filter((u) => u.role === "vendeur" && u.boutique === boutique && u.actif !== false);
  const produitsFiltres = cat ? produits.filter((p) => (p.categorie || "Autre") === cat) : produits;
  const dansPanier = (pid) => panier.reduce((s, l) => s + (l.produit_id === pid ? Number(l.qte) : 0), 0);
  const dispoRestant = (p) => stockActuel(db, p) - dansPanier(p.id);

  const choisir = (id) => {
    const p = produits.find((x) => x.id === id);
    setSel({ produit_id: id, qte: "1", pu: p && p.prix_vente != null ? String(p.prix_vente) : "" });
    if (p) setCat(p.categorie || "Autre");
  };

  const mettreAuPanier = (p, q, pu) => {
    setPanier((pan) => {
      const i = pan.findIndex((l) => l.produit_id === p.id && Number(l.pu) === Number(pu));
      if (i >= 0) { const cp = [...pan]; cp[i] = { ...cp[i], qte: Number(cp[i].qte) + q }; return cp; }
      return [...pan, { produit_id: p.id, article: p.nom, qte: q, pu: Number(pu) }];
    });
  };

  const ajouterAuPanier = () => {
    const p = produits.find((x) => x.id === sel.produit_id);
    const q = Number(sel.qte);
    if (!p || !q || q <= 0 || !sel.pu) { setMsg("Choisissez un article, la quantité et le prix."); return; }
    if (q > dispoRestant(p)) { setMsg(`Stock insuffisant : il reste ${dispoRestant(p)} pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, q, sel.pu);
    setSel({ produit_id: "", qte: "", pu: "" });
  };

  const scanner = (e) => {
    if (e.key !== "Enter") return;
    const c = code.trim();
    setCode("");
    if (!c) return;
    const p = produits.find((x) => String(x.code || "").trim() === c);
    if (!p) { setMsg(`Aucun article avec le code « ${c} » dans ${boutique}.`); return; }
    if (dispoRestant(p) < 1) { setMsg(`Stock épuisé pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, 1, p.prix_vente);
  };

  const retirer = (i) => setPanier(panier.filter((_, j) => j !== i));

  const brut = panier.reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);
  const remisePct = Number(f.remise || 0);
  const remise = Math.round((brut * remisePct) / 100);
  const total = brut - remise;

  const envoyer = async () => {
    if (panier.length === 0) { setMsg("Le panier est vide : ajoutez au moins un article."); return; }
    if (remisePct < 0 || remisePct > 100) { setMsg("La remise doit être comprise entre 0 et 100 %."); return; }
    setMsg("");
    const dest = f.vendeurCible || "un vendeur disponible";
    if (!await uConfirm(`Envoyer cette commande (${panier.length} article(s), ${fmt(total)}) à ${boutique} pour ${dest} ?`)) return;

    const commande = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      commercial: profile.nom,
      responsable: f.responsable || null,
      // Le rabais est plafonné à la commission du commercial sur cette commande.
      rabais: Math.min(Number(f.rabais || 0), Math.round((total * Number(profile.taux_commission || 0)) / 100)),
      boutique,
      vendeur_cible: f.vendeurCible || null,
      articles: panier,
      client: f.client,
      tel: f.tel,
      remise,
      remise_pct: remisePct,
      paiement: f.paiement,
      statut: "en_attente",
    };
    save({ ...db, commandes: [commande, ...(db.commandes || [])] }, `Commande envoyée à ${boutique} (${fmt(total)}) — ${profile.nom}`);
    setPanier([]);
    setF({ client: "", tel: "", remise: "", paiement: PAIEMENTS[0], vendeurCible: "", responsable: "", rabais: "" });
    setCat("");
    uAlert("Commande envoyée ! Le vendeur de la boutique la validera et encaissera la vente.");
  };

  const mesCommandes = (db.commandes || []).filter((c) => c.commercial === profile.nom);
  const badgeStatut = (s) => {
    if (s === "validee") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Validée</span>;
    if (s === "refusee") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Refusée</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ En attente</span>;
  };

  return (
    <div className="space-y-4">
      <BoutiqueTabs db={db} value={bq} onChange={setBq} />
      <Panel boutique={boutique}>
        <div className="font-bold mb-3">🛒 Nouvelle commande <Badge boutique={boutique} /></div>
        {produits.length === 0 ? (
          <div className="text-sm text-slate-600">Aucun article en stock pour cette boutique.</div>
        ) : (
          <>
            <div className="mb-3">
              <Field label="🔍 Scanner un code-barres">
                <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={scanner} placeholder="Scannez ou tapez le code puis Entrée…" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Catégorie">
                <select className={inputCls} value={cat} onChange={(e) => { setCat(e.target.value); setSel({ produit_id: "", qte: "", pu: "" }); }}>
                  <option value="">— Toutes —</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Article">
                <SelecteurArticle produits={produits} valeur={sel.produit_id} onChoisir={choisir} dispoRestant={dispoRestant} categorieFiltre={cat} />
              </Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={sel.qte} onChange={(e) => setSel({ ...sel, qte: e.target.value })} /></Field>
              <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={sel.pu} onChange={(e) => setSel({ ...sel, pu: e.target.value })} /></Field>
              <div className="flex items-end"><button onClick={ajouterAuPanier} className={`w-full ${btnDark}`}>➕ Ajouter</button></div>
            </div>

            <div className="mt-4 bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <div className="px-3 py-2 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">🛒 Panier ({panier.length} article{panier.length > 1 ? "s" : ""})</div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "P.U.", "Montant", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {panier.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Panier vide.</td></tr>}
                  {panier.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{l.article}</td>
                      <td className="px-3 py-2 tabular-nums">{l.qte}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(l.pu)}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.qte * l.pu)}</td>
                      <td className="px-3 py-2"><button onClick={() => retirer(i)} className="text-xs text-red-600 underline">Retirer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Client (facultatif)"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
              <Field label="Numéro du client"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
              <Field label="Remise (%) — facultatif"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.remise} onChange={(e) => setF({ ...f, remise: e.target.value })} /></Field>
              <Field label="Paiement proposé">
                <select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>
                  {PAIEMENTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Vendeur destinataire (facultatif)">
                <select className={inputCls} value={f.vendeurCible} onChange={(e) => setF({ ...f, vendeurCible: e.target.value })}>
                  <option value="">— N'importe quel vendeur —</option>
                  {vendeursBoutique.map((v) => <option key={v.id} value={v.nom}>{v.nom}</option>)}
                </select>
              </Field>
              {Number(profile.taux_commission || 0) > 0 && (
                <Field label="Rabais offert au client (F) — facultatif">
                  <input type="number" min="0" className={inputCls} value={f.rabais} onChange={(e) => setF({ ...f, rabais: e.target.value })} />
                  <div className="text-xs text-orange-600 mt-1 font-semibold">Ce rabais est pris sur VOTRE commission ({profile.taux_commission} %), pas sur la marge de BMI.</div>
                </Field>
              )}
              {responsables.length > 0 && (
                <Field label="Associer mon responsable (facultatif)">
                  <select className={inputCls} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })}>
                    <option value="">— Aucun (je garde toute ma commission) —</option>
                    {responsables.map((r) => <option key={r.id} value={r.nom}>{r.nom}{Number(r.taux_commission || 0) > 0 ? ` — ${r.taux_commission} %` : ""}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button onClick={envoyer} className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800 shadow-sm">📤 Envoyer la commande à la boutique</button>
              <span className="text-base font-bold tabular-nums">Total : {fmt(total)}{remise > 0 && <span className="text-red-600 text-sm font-semibold"> (remise −{fmt(remise)})</span>}</span>
              {msg && <span className="text-sm text-red-600 font-semibold">{msg}</span>}
            </div>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Mes commandes envoyées ({mesCommandes.length})</div>
        <table className="w-full text-sm min-w-[700px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Boutique", "Articles", "Total", "Vendeur ciblé", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mesCommandes.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune commande envoyée pour l'instant.</td></tr>}
            {mesCommandes.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}{c.heure ? ` ${c.heure}` : ""}</td>
                <td className="px-3 py-2"><Badge boutique={c.boutique} /></td>
                <td className="px-3 py-2">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt((c.articles || []).reduce((s, l) => s + l.qte * l.pu, 0) - (c.remise || 0))}</td>
                <td className="px-3 py-2">{c.vendeur_cible || "N'importe qui"}</td>
                <td className="px-3 py-2">{badgeStatut(c.statut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ COMMANDES REÇUES (rôle Vendeur + Admin) ============
// Le vendeur voit les commandes envoyées par les commerciaux pour sa
// boutique, et les valide pour finaliser la vente (encaissement dans
// l'onglet Ventes, panier déjà prêt).
function CommandesRecues({ db, save, profile, onValider }) {
  const isAdmin = profile.role === "admin";
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;

  const enAttente = (db.commandes || []).filter((c) =>
    c.statut === "en_attente" &&
    c.boutique === boutique &&
    (isAdmin || !c.vendeur_cible || c.vendeur_cible === profile.nom)
  );
  const historique = (db.commandes || []).filter((c) => c.statut !== "en_attente" && c.boutique === boutique).slice(0, 30);

  const valider = (c) => {
    save({ ...db, commandes: db.commandes.map((x) => (x.id === c.id ? { ...x, statut: "validee", valide_par: profile.nom } : x)) }, `Commande de ${c.commercial} validée par ${profile.nom} — ${c.boutique}`);
    // origine_devis suit jusqu'à l'encaissement : c'est lui qui déclenchera la
    // création de la fiche d'installation.
    onValider(c.boutique, c.articles, c.commercial, c.responsable, c.rabais, c.origine_devis || null, c.remise_pct || 0);
  };

  const refuser = async (c) => {
    const motif = await uPrompt(`Motif du refus de la commande de ${c.commercial || "ce client"} (facultatif) :`, "");
    if (motif === null) return;
    let next = { ...db, commandes: db.commandes.map((x) => (x.id === c.id ? { ...x, statut: "refusee", valide_par: profile.nom, motif_refus: motif } : x)) };

    // Si la commande venait d'un DEVIS, on le rend au client : sinon son devis
    // resterait « validé » à jamais, sans bouton pour recommencer. Il pourra
    // re-valider, éventuellement dans une autre boutique.
    const od = c.origine_devis;
    if (od) {
      next = {
        ...next,
        users: next.users.map((u) => (u.id === od.client_id
          ? { ...u, devis: (u.devis || []).map((d) => (d.id === od.devis_id
              ? { ...d, statut: "propose", boutique_paiement: null, commande_id: null, refus_motif: motif || "Refusé par la boutique" }
              : d)) }
          : u)),
      };
    }
    save(next, `Commande de ${c.commercial || "client"} refusée par ${profile.nom}${motif ? " (" + motif + ")" : ""}${od ? " — devis rendu au client" : ""}`);
  };

  // Une commande issue d'un devis, validée mais JAMAIS encaissée, laisserait le
  // devis en suspens et le chantier inexistant. On permet de la reprendre.
  const devisEnSuspens = (c) => {
    const od = c.origine_devis;
    if (!od || c.statut !== "validee") return false;
    const cl = db.users.find((u) => u.id === od.client_id);
    const d = (cl?.devis || []).find((x) => x.id === od.devis_id);
    return !!d && d.statut !== "paye";
  };

  // Le panier « figé » sur la commande peut être vide ou périmé (ancien
  // enregistrement, resynchronisation…) : on reconstruit depuis le devis
  // d'origine — la source la plus fiable — et on ne retombe sur celui de
  // la commande qu'en dernier recours.
  const panierDeReprise = (c) => {
    const od = c.origine_devis;
    if (od) {
      const cl = db.users.find((u) => u.id === od.client_id);
      const d = (cl?.devis || []).find((x) => x.id === od.devis_id);
      if (d?.panier?.length) return d.panier;
    }
    return c.articles || [];
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">📥 Commandes en attente <Badge boutique={boutique} /><span className="text-sm font-normal text-slate-500">({enAttente.length})</span></div>
        {enAttente.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400">Aucune commande en attente pour {boutique}.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {enAttente.map((c) => {
              const totalC = (c.articles || []).reduce((s, l) => s + l.qte * l.pu, 0) - (c.remise || 0);
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="font-bold text-slate-800">{c.commercial} <span className="text-xs font-normal text-slate-400">— {dFR(c.date)}{c.heure ? ` ${c.heure}` : ""}</span></div>
                    {c.vendeur_cible && <span className="text-xs font-semibold text-sky-700">Destinée à : {c.vendeur_cible}</span>}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    {c.client && <>Client : {c.client} · </>}
                    {c.tel && <>{c.tel} · </>}
                    Paiement proposé : {c.paiement}
                    {c.remise ? ` · Remise ${c.remise_pct}%` : ""}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold tabular-nums">{fmt(totalC)}</span>
                    <button onClick={() => valider(c)} className="px-4 py-1.5 rounded-lg bg-green-700 text-white font-bold text-xs hover:bg-green-800">✅ Valider et encaisser</button>
                    <button onClick={() => refuser(c)} className="px-4 py-1.5 rounded-lg border-2 border-red-500 text-red-600 font-bold text-xs hover:bg-red-50">❌ Refuser</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200 bg-slate-50 text-sm">Historique récent</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Commercial", "Articles", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {historique.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}</td>
                  <td className="px-3 py-2">{c.commercial}</td>
                  <td className="px-3 py-2">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</td>
                  <td className="px-3 py-2">
                    {c.statut === "validee"
                      ? <span className="text-green-700 font-semibold">✓ Validée</span>
                      : <span className="text-red-600 font-semibold">✗ Refusée{c.motif_refus ? ` (${c.motif_refus})` : ""}</span>}
                    {devisEnSuspens(c) && (
                      <div className="mt-1">
                        <div className="text-[10px] font-bold text-amber-700">⚠ Devis validé mais NON ENCAISSÉ</div>
                        <button onClick={() => {
                          const panier = panierDeReprise(c);
                          if (panier.length === 0) { uAlert("Aucun article retrouvé pour ce devis (ni sur la commande, ni sur le devis d'origine). Contactez l'administrateur pour vérifier ce dossier avant d'encaisser."); return; }
                          onValider(c.boutique, panier, c.commercial, c.responsable, c.rabais, c.origine_devis, c.remise_pct || 0);
                        }} className="mt-1 text-[10px] font-bold text-white bg-amber-600 rounded px-2 py-0.5 hover:bg-amber-700">↻ Reprendre l'encaissement</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ DÉPENSES ============
function Depenses({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [f, setF] = useState({ categorie: CATEGORIES[0], description: "", montant: "", paiement: PAIEMENTS[0] });

  const ajouter = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!f.montant) { uAlert("Veuillez saisir un montant."); return; }
    if (!await uConfirm(`Confirmer la dépense de ${fmt(Number(f.montant))} en ${f.categorie} ?`)) return;
    save({ ...db, depenses: [{ id: uid(), date: today(), boutique, ...f, montant: Number(f.montant), par: profile.nom }, ...db.depenses] }, `Dépense ${fmt(Number(f.montant))} (${f.categorie}) — ${boutique}`);
    setF({ categorie: CATEGORIES[0], description: "", montant: "", paiement: PAIEMENTS[0] });
  };

  const supprimerDepense = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (await uConfirm(`Supprimer la dépense de ${fmt(d.montant)} (${d.categorie}) du ${dFR(d.date)} ?`)) {
      save({ ...db, depenses: db.depenses.filter((x) => x.id !== d.id) }, `Suppression dépense ${fmt(d.montant)} (${d.categorie}) — ${d.boutique}`);
    }
  };

  const liste = db.depenses.filter((x) => x.boutique === boutique);
  const totalMois = liste.filter((x) => String(x.date).slice(0, 7) === today().slice(0, 7)).reduce((s, x) => s + Number(x.montant), 0);

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dépense <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Catégorie"><select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Montant (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Paiement"><select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>{PAIEMENTS.map((p) => <option key={p}>{p}</option>)}</select></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dépense</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>Dépenses — {boutique}</span>
          <span className="text-sm font-semibold text-slate-500">Ce mois : {fmt(totalMois)}</span>
        </div>
        <table className="w-full text-sm min-w-[680px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Catégorie", "Description", "Montant", "Paiement", "Saisi par", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucune dépense enregistrée.</td></tr>}
            {liste.map((x) => (
              <tr key={x.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2">{dFR(x.date)}</td>
                <td className="px-3 py-2 font-semibold">{x.categorie}</td>
                <td className="px-3 py-2">{x.description || "—"}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(x.montant)}</td>
                <td className="px-3 py-2">{x.paiement}</td>
                <td className="px-3 py-2">{x.par}</td>
                <td className="px-3 py-2">
                  {profile.role === "admin" && (
                    <button onClick={() => supprimerDepense(x)} className="text-xs text-red-600 underline">Suppr.</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ DETTES ============
function Dettes({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [f, setF] = useState({ client: "", tel: "", motif: "", montant: "", paye: "" });

  const ajouter = () => {
    if (!f.client || !f.montant) { uAlert("Veuillez saisir le nom du client et le montant."); return; }
    save({ ...db, dettes: [{ id: uid(), date: today(), boutique, client: f.client, tel: f.tel, motif: f.motif, montant: Number(f.montant), paye: Number(f.paye || 0), par: profile.nom }, ...db.dettes] }, `Nouvelle dette ${f.client} (${fmt(Number(f.montant))}) — ${boutique}`);
    setF({ client: "", tel: "", motif: "", montant: "", paye: "" });
    uAlert("Dette enregistrée avec succès !");
  };

  const encaisser = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(d);
    const s = await uPrompt(`Montant reçu de ${d.client} (F) — reste dû : ${fmt(reste)}`, String(reste || ""));
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    if (m > reste) { uAlert(`Le montant dépasse le reste dû (${fmt(reste)}).`); return; }
    const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
    if (moyen === null) return;
    if (!await uConfirm(`Confirmer le versement de ${fmt(m)} de ${d.client} ?`)) return;
    const paiement = { id: uid(), date: today(), montant: m, paiement: normPaiement(moyen), par: profile.nom };
    save({ ...db, dettes: db.dettes.map((x) => (x.id === d.id ? { ...x, paye: Number(x.paye) + m, paiements: [...(x.paiements || []), paiement] } : x)) },
      `${estReservation(d) ? "Versement réservation" : "Paiement dette"} ${fmt(m)} de ${d.client} — ${d.boutique}`);
    uAlert("Versement enregistré !");
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
      id: uid(), type: "prepaye", date: today(), boutique, client: res.client.trim(), tel: res.tel.trim(),
      motif: `Réservation — ${panierRes.length} article(s)`,
      articles: panierRes, montant: totalRes, paye: avance,
      paiements: avance > 0 ? [{ id: uid(), date: today(), montant: avance, paiement: normPaiement(res.moyen), par: profile.nom }] : [],
      echeance: res.echeance || null, statut: "en_cours", par: profile.nom,
    };
    save({ ...db, dettes: [r, ...db.dettes] }, `Réservation prépayée ${res.client.trim()} (${fmt(totalRes)}) — ${boutique}`);
    setPanierRes([]);
    setRes({ client: "", tel: "", produit_id: "", qte: "", avance: "", moyen: "Espèces", echeance: "" });
    uAlert("✅ Réservation créée.");
  };

  // Livraison : c'est SEULEMENT ici que le stock sort et que la vente est créée.
  const livrer = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(r);
    if (reste > 0 && !await uConfirm(`⚠ ${r.client} n'a pas tout payé : il reste ${fmt(reste)}.\n\nLivrer quand même ? Le solde restera dû.`)) return;
    const manquants = (r.articles || []).filter((l) => {
      const p = db.produits.find((x) => x.id === l.produit_id);
      return !p || stockActuel(db, p) < Number(l.qte);
    });
    if (manquants.length) { uAlert(`Stock insuffisant pour :\n${manquants.map((m) => m.nom).join("\n")}\n\nRavitaillez la boutique avant de livrer.`); return; }
    if (!await uConfirm(`Livrer la réservation de ${r.client} ?\n\n${(r.articles || []).length} article(s), ${fmt(r.montant)}\n\nLe stock sera déduit et la vente enregistrée.`)) return;
    const vente = {
      id: uid(), date: today(), boutique: r.boutique, client: r.client, tel: r.tel,
      articles: r.articles, remise: 0, paiement: "Prépayé", avance: 0,
      commercial: null, responsable: null, apporteur: null, par: profile.nom, reservation_id: r.id,
    };
    save({
      ...db,
      ventes: [vente, ...db.ventes],
      dettes: db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "livree", date_livraison: today(), vente_id: vente.id } : x)),
    }, `Livraison de la réservation de ${r.client} (${fmt(r.montant)}) — ${r.boutique}`);
    imprimerRecu(vente, db.boutiques.find((b) => b.nom === r.boutique) || {});
  };

  const annulerReservation = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    if (Number(r.paye || 0) > 0 && !await uConfirm(`⚠ ${r.client} a déjà versé ${fmt(r.paye)}.\n\nAnnuler la réservation ? Vous devrez lui rembourser cette somme À LA MAIN (enregistrez-la en dépense).`)) return;
    if (Number(r.paye || 0) === 0 && !await uConfirm(`Annuler la réservation de ${r.client} ?`)) return;
    save({ ...db, dettes: db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "annulee", date_annulation: today() } : x)) },
      `Réservation de ${r.client} ANNULÉE (${fmt(r.paye || 0)} déjà versés)`);
  };

  const relancer = (d) => {
    const reste = Math.max(0, d.montant - d.paye);
    const txt = `Bonjour ${d.client}, nous vous rappelons gentiment votre solde de ${fmt(reste)} chez ${d.boutique}${d.motif ? ` (${d.motif})` : ""}. Merci de passer régulariser quand vous pouvez. Bonne journée !`;
    const num = telDigits(d.tel);
    window.open(num ? `https://wa.me/${num}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const supprimerDette = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (await uConfirm(`Supprimer la dette de ${d.client} (${fmt(d.montant)}) ?`)) {
      save({ ...db, dettes: db.dettes.filter((x) => x.id !== d.id) }, `Suppression dette ${d.client} (${fmt(d.montant)}) — ${d.boutique}`);
    }
  };

  const liste = db.dettes.filter((x) => x.boutique === boutique && !estReservation(x));
  const mesReservations = db.dettes.filter((x) => x.boutique === boutique && estReservation(x) && x.statut !== "annulee");
  const statut = (d) => (d.montant - d.paye <= 0 ? "Payée" : d.paye > 0 ? "Partielle" : "En cours");

  const dettesEnRetard = liste.filter(d => {
    const jours = (new Date(today()) - new Date(d.date)) / (1000 * 60 * 60 * 24);
    return jours > 30 && d.montant - d.paye > 0;
  });

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <div className="rounded-xl p-4 bg-white border-2 border-emerald-200">
        <div className="font-bold mb-1 text-emerald-800">💰 Réservation prépayée — le client paie avant d'emporter</div>
        <div className="text-xs text-slate-500 mb-4">Le prix est bloqué, les versements s'accumulent. La marchandise ne sort du stock qu'au moment de la livraison.</div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Client"><input className={inputCls} value={res.client} onChange={(e) => setRes({ ...res, client: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={res.tel} onChange={(e) => setRes({ ...res, tel: e.target.value })} /></Field>
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
            ⚠ {dettesEnRetard.length} dette(s) de plus de 30 jours à relancer
          </span>
        </div>
      )}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dette client <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Client"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Article / Motif"><input className={inputCls} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} /></Field>
          <Field label="Montant dette (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Déjà payé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dette</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Dettes — {boutique} <span className="text-sm font-normal text-slate-500">· Reste total : {fmt(liste.reduce((s, d) => s + Math.max(0, d.montant - d.paye), 0))}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Client", "Téléphone", "Motif", "Dette", "Payé", "Reste", "Statut", "Ancienneté", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">Aucune dette enregistrée.</td></tr>}
            {liste.map((d) => {
              const st = statut(d);
              const jours = Math.floor((new Date(today()) - new Date(d.date)) / (1000 * 60 * 60 * 24));
              const estRetard = jours > 30 && d.montant - d.paye > 0;
              return (
                <tr key={d.id} className={`border-t border-slate-100 ${estRetard ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">{dFR(d.date)}</td>
                  <td className="px-3 py-2 font-semibold">{d.client}</td>
                  <td className="px-3 py-2">{d.tel || "—"}</td>
                  <td className="px-3 py-2">{d.motif || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(d.montant)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(d.paye)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(Math.max(0, d.montant - d.paye))}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st === "Payée" ? "bg-green-100 text-green-700" : st === "Partielle" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{st}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {jours} jour{jours > 1 ? 's' : ''}
                    {estRetard && <span className="ml-1 text-red-600 font-bold">⚠</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {st !== "Payée" && (
                      <>
                        <button onClick={() => encaisser(d)} className="text-xs font-bold text-sky-800 underline mr-2">+ Paiement</button>
                        <button onClick={() => relancer(d)} className="text-xs font-bold text-green-700 underline mr-2">Relancer</button>
                      </>
                    )}
                    {profile.role === "admin" && (
                      <button onClick={() => supprimerDette(d)} className="text-xs text-red-600 underline">Suppr.</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ CLIENTS ============
// ============ CRÉER UN CLIENT (parrainage employé) ============
// Onglet dédié, ouvert à tous les employés SAUF l'admin (qui a 👥 Utilisateurs)
// et le client (qui a 🤝 Parrainer). Crée UNIQUEMENT un compte de rôle "client",
// avec identifiants automatiques + envoi WhatsApp. AUCUNE commission.
function CreerClient({ db, save, profile }) {
  const [f, setF] = useState({ nom: "", tel: "" });
  const [aussiProspect, setAussiProspect] = useState(false); // client simple, ou aussi un prospect à relancer
  const [dernier, setDernier] = useState(null); // { nom, identifiant, motDePasse, tel }

  // Les clients que CET employé a lui-même amenés (traçabilité, sans commission).
  const mesClients = (db.users || []).filter((u) => u.role === "client" && u.amene_par_id === profile.id);

  const creer = async () => {
    const nom = f.nom.trim(), tel = f.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom du client et son numéro (au moins 4 chiffres)."); return; }
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && chiffresTel(u.tel) === chiffresTel(tel));
    if (existant) { uAlert(`Un compte existe déjà pour ce numéro : ${existant.nom}.\n\nRien n'a été recréé.`); return; }

    const identifiant = identifiantClient(db, nom, tel);
    const motDePasse = motDePasseClient(nom, tel);
    if (!await uConfirm(
      `Créer le compte de ${nom.toUpperCase()} ?\n\n👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\nSes identifiants lui seront envoyés par WhatsApp.`
    )) return;

    const { user } = await fabriquerCompteClient(db, nom, tel, profile.nom);
    // On note QUI a amené ce client — pour la traçabilité, PAS pour une commission.
    const client = { ...user, amene_par_id: profile.id, amene_par_nom: profile.nom };

    // Si l'employé a coché « à relancer », on crée AUSSI un prospect lié — la
    // personne entre dans la file de démarchage, et en sortira à son paiement.
    const nouveauxProspects = aussiProspect ? [{
      id: uid(), date: today(), maj_le: today(), commercial: profile.role === "commercial" ? profile.nom : null,
      nom: nom.toUpperCase(), tel,
      categorie: (db.categories_prospects || [])[0]?.nom || "Particulier",
      statut: "Favorable", interet: "Intéressé",
      note: `Amené par ${profile.nom}`,
      client_user_id: user.id,
    }, ...(db.prospects || [])] : (db.prospects || []);

    save({
      ...db,
      users: [...db.users, client],
      prospects: nouveauxProspects,
    }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}${aussiProspect ? " (+ prospect à relancer)" : ""}`);

    setDernier({ nom, identifiant, motDePasse, tel });
    setF({ nom: "", tel: "" });
    envoyerIdentifiantsWhatsApp(nom, identifiant, motDePasse, tel);
  };

  const renvoyer = (c) => {
    const id = c.nom;
    const mdp = motDePasseConnu(c);
    if (!mdp) { uAlert("Ce compte a un mot de passe personnalisé, impossible de le régénérer ici."); return; }
    envoyerIdentifiantsWhatsApp(c.nom_base || c.nom, id, mdp, c.tel);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">🙋 Créer un compte client</div>
        <div className="text-xs text-slate-500 mb-4">
          Ouvrez un accès à un client (actuel ou potentiel) : il pourra suivre ses devis et ses installations.
          Le nom et le numéro suffisent — le mot de passe est généré, et ses identifiants partent par WhatsApp.
        </div>

        <div className="grid sm:grid-cols-2 gap-2 items-end mb-3">
          <Field label="Nom du client"><input className={inputCls} placeholder="KOFFI AMA" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Numéro WhatsApp"><input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Ce contact est…</div>
          <label className="flex items-start gap-2 mb-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={!aussiProspect} onChange={() => setAussiProspect(false)} />
            <span className="text-sm"><b>Client décidé</b> — <span className="text-slate-500">il va suivre son devis / son installation. Pas de relance.</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={aussiProspect} onChange={() => setAussiProspect(true)} />
            <span className="text-sm"><b>Prospect</b> — <span className="text-slate-500">un compte est créé ET il entre dans la file de relance de vos commerciaux.</span></span>
          </label>
        </div>

        <button onClick={creer} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🙋 Créer + envoyer</button>

        {f.nom.trim() && chiffresTel(f.tel).length >= 4 && (
          <div className="mt-2 rounded-lg bg-green-50 border border-green-200 p-2 text-xs">
            Sera créé — 👤 <b>{identifiantClient(db, f.nom, f.tel)}</b> · 🔑 <b>{motDePasseClient(f.nom, f.tel)}</b>
          </div>
        )}

        {dernier && (
          <div className="mt-3 rounded-lg bg-white border-2 border-green-300 p-3 text-sm">
            ✅ <b>{dernier.nom.toUpperCase()}</b> créé — 👤 {dernier.identifiant} · 🔑 {dernier.motDePasse}
            <div className="text-xs text-slate-500 mt-1">WhatsApp s'est ouvert avec le message. Si rien ne s'est passé, vérifiez que WhatsApp est installé.</div>
          </div>
        )}
      </Panel>

      {mesClients.length > 0 && (
        <Panel>
          <div className="font-bold mb-2">Les clients que j'ai amenés ({mesClients.length})</div>
          <div className="space-y-1">
            {mesClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{c.nom_base || c.nom}{c.tel ? <span className="text-slate-400 font-normal"> · {c.tel}</span> : null}</span>
                <button onClick={() => renvoyer(c)} className="text-xs font-bold text-green-700 underline">↻ Renvoyer ses accès</button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Clients({ db, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [q, setQ] = useState("");
  const map = {};
  const key = (nom, tel) => (telDigits(tel) || String(nom || "").trim().toLowerCase());

  db.ventes.filter((v) => v.boutique === boutique && (v.client || v.tel)).forEach((v) => {
    const k = key(v.client, v.tel);
    if (!map[k]) map[k] = { nom: v.client || "(sans nom)", tel: v.tel, achats: 0, totalAchats: 0, dette: 0, derniere: v.date };
    map[k].achats += 1;
    map[k].totalAchats += totalVente(v);
    if (!map[k].tel && v.tel) map[k].tel = v.tel;
    if (String(v.date) > String(map[k].derniere)) map[k].derniere = v.date;
  });

  dettesClassiques(db).filter((d) => d.boutique === boutique).forEach((d) => {
    const k = key(d.client, d.tel);
    if (!map[k]) map[k] = { nom: d.client, tel: d.tel, achats: 0, totalAchats: 0, dette: 0, derniere: d.date };
    map[k].dette += Math.max(0, d.montant - d.paye);
    if (!map[k].tel && d.tel) map[k].tel = d.tel;
  });

  let clients = Object.values(map).sort((a, b) => b.totalAchats - a.totalAchats);
  if (q) clients = clients.filter((c) => (c.nom + " " + (c.tel || "")).toLowerCase().includes(q.toLowerCase()));

  const contacter = (c) => {
    const num = telDigits(c.tel);
    if (!num) { uAlert("Aucun numéro enregistré pour ce client."); return; }
    window.open(`https://wa.me/${num}`, "_blank");
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Clients — {boutique} <span className="text-sm font-normal text-slate-500">({clients.length})</span></span>
          <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-56" placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Téléphone", "Achats", "Total acheté", "Dette en cours", "Dernier achat", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucun client trouvé.</td></tr>}
            {clients.map((c, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 font-semibold">{c.nom}</td>
                <td className="px-3 py-2">{c.tel || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{c.achats}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(c.totalAchats)}</td>
                <td className={`px-3 py-2 tabular-nums font-bold ${c.dette > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(c.dette)}</td>
                <td className="px-3 py-2">{dFR(c.derniere)}</td>
                <td className="px-3 py-2">{c.tel && <button onClick={() => contacter(c)} className="text-xs font-bold text-green-700 underline">WhatsApp</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ CAISSE ============
function Caisse({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [compte, setCompte] = useState("");
  const [notes, setNotes] = useState("");
  const t = today();

  const especesVentes = db.ventes.filter((v) => v.boutique === boutique && String(v.date) === t && v.paiement === "Espèces").reduce((s, v) => s + totalVente(v), 0);
  const especesDepenses = db.depenses.filter((x) => x.boutique === boutique && String(x.date) === t && x.paiement === "Espèces").reduce((s, x) => s + Number(x.montant), 0);
  // Les règlements de dettes et les versements sur réservation entrent aussi dans la caisse.
  // (Ils étaient oubliés : le théorique du jour était donc faux.)
  const especesReglements = (db.dettes || []).filter((d) => d.boutique === boutique)
    .reduce((s, d) => s + (d.paiements || [])
      .filter((p) => String(p.date) === t && (p.paiement || "Espèces") === "Espèces")
      .reduce((t2, p) => t2 + Number(p.montant || 0), 0), 0);
  const theorique = especesVentes + especesReglements - especesDepenses;
  const dejaCloturee = db.clotures.some((c) => c.boutique === boutique && String(c.date) === t);
  const ecart = compte === "" ? null : Number(compte) - theorique;

  const cloturer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (compte === "") { uAlert("Comptez la caisse et saisissez le montant."); return; }
    if (!await uConfirm(`Confirmer la clôture du ${dFR(t)} ?\nThéorique : ${fmt(theorique)}\nCompté : ${fmt(Number(compte))}\nÉcart : ${fmt(Number(compte) - theorique)}`)) return;
    save({ ...db, clotures: [{ id: uid(), date: t, boutique, theorique, compte: Number(compte), notes, par: profile.nom }, ...db.clotures] }, `Clôture caisse ${boutique} : compté ${fmt(Number(compte))} (écart ${fmt(Number(compte) - theorique)})`);
    setCompte(""); setNotes("");
    uAlert("Clôture enregistrée !");
  };

  const liste = db.clotures.filter((c) => c.boutique === boutique);

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}
      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Clôture de caisse du jour <Badge boutique={boutique} /></div>
        {dejaCloturee ? (
          <div className="text-sm font-semibold text-green-700">✓ La caisse du {dFR(t)} a déjà été clôturée.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-3">
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Ventes en espèces</div><div className="font-bold tabular-nums">{fmt(especesVentes)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Encaissements (dettes / réservations)</div><div className="font-bold tabular-nums text-emerald-700">{fmt(especesReglements)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Dépenses en espèces</div><div className="font-bold tabular-nums">− {fmt(especesDepenses)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200"><div className="text-xs text-slate-500">Espèces attendues</div><div className="font-bold tabular-nums">{fmt(theorique)}</div></div>
              <div className="bg-white rounded-lg p-3 border border-slate-200">
                <div className="text-xs text-slate-500">Écart</div>
                <div className={`font-bold tabular-nums ${ecart === null ? "text-slate-400" : ecart === 0 ? "text-green-700" : "text-red-600"}`}>{ecart === null ? "—" : fmt(ecart)}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Field label="Espèces comptées (F)"><input type="number" className={inputCls} value={compte} onChange={(e) => setCompte(e.target.value)} /></Field>
              <div className="lg:col-span-2"><Field label="Remarques"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : Monnaie rendue..." /></Field></div>
            </div>
            <button onClick={cloturer} className={`mt-3 ${btnDark}`}>Clôturer la caisse</button>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Historique des clôtures — {boutique}</div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Attendu", "Compté", "Écart", "Remarques", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune clôture enregistrée.</td></tr>}
            {liste.map((c) => {
              const e = Number(c.compte) - Number(c.theorique);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2">{dFR(c.date)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.theorique)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(c.compte)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${e === 0 ? "text-green-700" : "text-red-600"}`}>{fmt(e)}</td>
                  <td className="px-3 py-2">{c.notes || "—"}</td>
                  <td className="px-3 py-2">{c.par}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ DEMANDE DE RAVITAILLEMENT (côté boutique) ============
// Utilisé à deux endroits : dans l'onglet 📦 Stocks (gérant, admin) et comme
// onglet 🚚 Ravitaillement à part entière (vendeur, qui n'a pas accès au stock).
function DemandeRavitaillement({ db, save, profile, boutique, marquerVues }) {
  const bq = boutique || profile.boutique || "";
  const maBoutique = db.boutiques.find((b) => b.nom === bq);
  const mesDemandes = demandesDe(maBoutique || {});
  const [dem, setDem] = useState({ nom: "", categorie: "", qte: "", note: "" });
  const [panierDem, setPanierDem] = useState([]);

  // À l'ouverture de l'onglet dédié, les réponses du magasin sont marquées comme vues
  useEffect(() => {
    if (!marquerVues || !maBoutique) return;
    const aVoir = demandesDe(maBoutique).filter((d) => d.statut !== "en_attente" && !d.vu_boutique);
    if (!aVoir.length) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq
      ? { ...b, demandes: demandesDe(b).map((d) => (d.statut !== "en_attente" && !d.vu_boutique ? { ...d, vu_boutique: true } : d)) }
      : b)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ajouterLigneDemande = () => {
    if (!dem.nom.trim()) { uAlert("Indiquez l'article souhaité."); return; }
    const q = Number(dem.qte);
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    setPanierDem((p) => [...p, { nom: dem.nom.trim(), categorie: dem.categorie.trim(), qte: q }]);
    setDem((d) => ({ ...d, nom: "", categorie: "", qte: "" }));
  };

  const envoyerDemande = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!bq) { uAlert("Votre compte n'est rattaché à aucune boutique. Voyez avec l'administrateur."); return; }
    if (!panierDem.length) { uAlert("Ajoutez au moins un article à la demande."); return; }
    if (!magasinsDe(db).length) { uAlert("Aucun magasin n'est déclaré. Demandez à l'administrateur d'en créer un (⚙ Paramètres)."); return; }
    if (!await uConfirm(`Envoyer la demande de ravitaillement ?\n\n${panierDem.length} article(s) — elle sera visible par le magasinier.`)) return;
    const demande = { id: uid(), date: today(), par: profile.nom, lignes: panierDem, note: dem.note.trim(), statut: "en_attente" };
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq ? { ...b, demandes: [...demandesDe(b), demande] } : b)) },
      `Demande de ravitaillement de ${bq} : ${panierDem.length} article(s) (par ${profile.nom})`);
    setPanierDem([]);
    setDem({ nom: "", categorie: "", qte: "", note: "" });
    uAlert("✅ Demande envoyée au magasin.");
  };

  const annulerDemande = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!await uConfirm("Annuler cette demande de ravitaillement ?")) return;
    save({ ...db, boutiques: db.boutiques.map((b) => (b.nom === bq ? { ...b, demandes: demandesDe(b).filter((x) => x.id !== d.id) } : b)) },
      `Demande de ravitaillement annulée — ${bq}`);
  };

  return (
    <div className="rounded-xl p-4 bg-white border-2 border-blue-200">
      <div className="font-bold mb-1 text-blue-800">🚚 Demander un ravitaillement au magasin</div>
      <div className="text-xs text-slate-500 mb-4">Listez ce dont la boutique {bq} a besoin. Le magasinier reçoit la demande et prépare le bon.</div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Article souhaité">
          <select className={inputCls} value={dem.nom} onChange={(e) => {
            const p = db.produits.find((x) => x.nom === e.target.value);
            setDem({ ...dem, nom: e.target.value, categorie: p ? (p.categorie || "") : dem.categorie });
          }}>
            <option value="">— Choisir dans le catalogue du magasin —</option>
            {[...new Map(db.produits.filter((p) => estDepot(db, p.boutique)).map((p) => [p.nom, p])).values()]
              .sort((a, b) => a.nom.localeCompare(b.nom))
              .map((p) => <option key={p.id} value={p.nom}>{p.nom}{p.categorie ? ` — ${p.categorie}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Catégorie (facultatif)">
          <input className={inputCls} list="liste-cat-demande" value={dem.categorie} onChange={(e) => setDem({ ...dem, categorie: e.target.value })} />
          <datalist id="liste-cat-demande">{[...new Set(db.produits.map((p) => p.categorie).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label="Quantité"><input type="number" min="1" className={inputCls} value={dem.qte} onChange={(e) => setDem({ ...dem, qte: e.target.value })} /></Field>
        <div className="flex items-end">
          <button onClick={ajouterLigneDemande} className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter</button>
        </div>
      </div>

      {panierDem.length > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="font-bold text-sm text-blue-900 mb-2">Demande en préparation</div>
          <ul className="text-sm text-slate-700 space-y-1">
            {panierDem.map((l, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span><b>{l.qte}</b> × {l.nom}{l.categorie ? ` (${l.categorie})` : ""}</span>
                <button onClick={() => setPanierDem(panierDem.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button>
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Field label="Note pour le magasinier (facultatif)">
              <input className={inputCls} value={dem.note} onChange={(e) => setDem({ ...dem, note: e.target.value })} placeholder="Ex : urgent, chantier de vendredi" />
            </Field>
          </div>
          <button onClick={envoyerDemande} className="mt-3 px-5 py-2 rounded-lg bg-blue-700 text-white font-bold text-sm hover:bg-blue-800">📤 Envoyer la demande</button>
        </div>
      )}

      {mesDemandes.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className="text-xs font-bold text-slate-500 uppercase mb-2">Mes demandes</div>
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Articles", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...mesDemandes].reverse().slice(0, 10).map((d) => (
                <tr key={d.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(d.date)}</td>
                  <td className="px-3 py-2">{d.lignes.map((l) => `${l.qte} × ${l.nom}`).join(", ")}</td>
                  <td className="px-3 py-2">
                    {d.statut === "en_attente" ? <span className="text-xs font-bold text-amber-600">⏳ En attente</span>
                      : d.statut === "servie" ? <span className="text-xs font-bold text-green-700">✅ Servie {d.numero_bon ? `(${d.numero_bon})` : ""}</span>
                      : <span className="text-xs font-bold text-red-600">❌ Refusée{d.motif ? ` — ${d.motif}` : ""}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {d.statut === "en_attente" && <button onClick={() => annulerDemande(d)} className="text-xs text-red-600 underline">Annuler</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ STOCKS ============
function Stocks({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  // Un employé rattaché à un site (vendeur, gérant, magasinier) est VERROUILLÉ dessus :
  // il ne voit et ne modifie que le stock de sa boutique ou de son magasin.
  const [bqSel, setBqSel] = useState(profile.boutique || premiere);
  const bq = profile.boutique || bqSel;
  const [f, setF] = useState({ nom: "", categorie: "", fournisseur: "", initial: "", seuil: "", prix_achat: "", prix_vente: "", code: "" });
  const autres = db.boutiques.map((b) => b.nom).filter((n) => n !== bq);

  // ---- RAVITAILLEMENT : d'un magasin vers une boutique ----
  const estMagasin = estDepot(db, bq);
  const cibles = boutiquesVente(db).map((b) => b.nom).filter((n) => n !== bq);
  const [rav, setRav] = useState({ dest: "", categorie: "", produit_id: "", qte: "" });
  const [bon, setBon] = useState([]); // lignes du bon en préparation

  const dejaAuBon = (pid) => bon.reduce((s, l) => s + (l.produit_id === pid ? Number(l.qte) : 0), 0);

  const ajouterAuBon = () => {
    const p = db.produits.find((x) => x.id === rav.produit_id);
    const q = Number(rav.qte);
    if (!p) { uAlert("Choisissez un article."); return; }
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    const dispo = stockActuel(db, p) - dejaAuBon(p.id);
    if (q > dispo) { uAlert(`Stock insuffisant dans ${bq} : il reste ${dispo} « ${p.nom} ».`); return; }
    setBon((b) => [...b, { produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: q }]);
    setRav((r) => ({ ...r, produit_id: "", qte: "" }));
  };

  const validerBon = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!rav.dest) { uAlert("Choisissez la boutique à ravitailler."); return; }
    if (!bon.length) { uAlert("Ajoutez au moins un article au bon."); return; }
    const total = bon.reduce((s, l) => s + Number(l.qte), 0);
    if (!await uConfirm(`Valider le ravitaillement ?\n\n🏭 ${bq} → 🏪 ${rav.dest}\n${bon.length} article(s), ${total} unité(s) au total.\n\nLe stock sera déduit du magasin et ajouté à la boutique.`)) return;

    const ref = uid();
    const numero = `RAV-${today().replace(/-/g, "")}-${ref.slice(0, 4).toUpperCase()}`;
    let produits = db.produits;
    const ajusts = [];

    bon.forEach((l) => {
      const p = produits.find((x) => x.id === l.produit_id);
      let cible = produits.find((x) => x.boutique === rav.dest && x.nom.trim().toLowerCase() === l.nom.trim().toLowerCase());
      if (!cible) {
        // L'article n'existe pas encore dans la boutique : on le crée automatiquement
        cible = { id: uid(), boutique: rav.dest, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente, code: p.code || "" };
        produits = [...produits, cible];
      }
      ajusts.push({ id: uid(), date: today(), produit_id: p.id, boutique: bq, qte: -Number(l.qte), motif: `Ravitaillement ${numero} → ${rav.dest}`, par: profile.nom, ref, type: "ravitaillement" });
      ajusts.push({ id: uid(), date: today(), produit_id: cible.id, boutique: rav.dest, qte: Number(l.qte), motif: `Ravitaillement ${numero} ← ${bq}`, par: profile.nom, ref, type: "ravitaillement" });
    });

    // Si le bon répond à une demande, on la marque comme servie
    const boutiques = demandeEnCours
      ? db.boutiques.map((b) => (b.nom === demandeEnCours.boutique
          ? { ...b, demandes: demandesDe(b).map((x) => (x.id === demandeEnCours.d.id ? { ...x, statut: "servie", numero_bon: numero, traite_par: profile.nom, date_traitement: today() } : x)) }
          : b))
      : db.boutiques;

    save({ ...db, boutiques, produits, ajustements: [...ajusts, ...db.ajustements] },
      `Ravitaillement ${numero} : ${bq} → ${rav.dest} (${bon.length} article(s), ${total} unité(s))${demandeEnCours ? " — demande servie" : ""}`);
    setDemandeEnCours(null);

    imprimerBonRavitaillement({ numero, date: today(), par: profile.nom, source: bq, destination: rav.dest, lignes: bon }, db);
    setBon([]);
    setAAssocier([]);
    setAssoc({});
    setRav({ dest: rav.dest, categorie: "", produit_id: "", qte: "" });
  };

  // ---- CÔTÉ MAGASIN : demandes reçues + alertes des boutiques ----
  const demandesRecues = estMagasin ? demandesEnAttente(db) : [];
  const alertesDesBoutiques = estMagasin ? alertesBoutiques(db, stockActuel) : [];

  // Charge une demande dans le bon de ravitaillement en préparation.
  // La correspondance des noms est SOUPLE (accents, pluriel, espaces, casse).
  // Ce qui ne peut pas être associé automatiquement est proposé à la main.
  const preparerDepuisDemande = (dm) => {
    const monStock = db.produits.filter((x) => x.boutique === bq);
    const lignes = [];
    const aAssocier = [];
    dm.d.lignes.forEach((l) => {
      const p = trouverArticle(monStock, l.nom);
      if (!p) { aAssocier.push({ ...l, raison: "nom inconnu dans votre magasin" }); return; }
      const dispo = stockActuel(db, p);
      if (dispo <= 0) { aAssocier.push({ ...l, raison: `« ${p.nom} » est à 0 en stock` }); return; }
      lignes.push({ produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: Math.min(Number(l.qte), dispo) });
    });
    setRav((r) => ({ ...r, dest: dm.boutique, categorie: "", produit_id: "", qte: "" }));
    setBon(lignes);
    setDemandeEnCours(dm);
    setAAssocier(aAssocier);
  };

  const [demandeEnCours, setDemandeEnCours] = useState(null);
  const [aAssocier, setAAssocier] = useState([]);   // lignes demandées non reconnues
  const [assoc, setAssoc] = useState({});           // index de ligne -> id de l'article du magasin

  // Le magasinier dit lui-même : « ce qu'ils appellent X, chez moi c'est Y »
  const associerLigne = (i, l) => {
    const p = db.produits.find((x) => x.id === assoc[i]);
    if (!p) { uAlert("Choisissez l'article correspondant dans votre magasin."); return; }
    const dispo = stockActuel(db, p) - dejaAuBon(p.id);
    if (dispo <= 0) { uAlert(`« ${p.nom} » n'a plus de stock disponible.`); return; }
    const q = Math.min(Number(l.qte), dispo);
    setBon((b) => [...b, { produit_id: p.id, nom: p.nom, categorie: p.categorie, qte: q }]);
    setAAssocier((a) => a.filter((_, j) => j !== i));
    setAssoc((a) => { const c = { ...a }; delete c[i]; return c; });
    if (q < Number(l.qte)) uAlert(`Stock limité : ${q} unité(s) ajoutée(s) au lieu de ${l.qte}.`);
  };

  const refuserDemande = async (dm) => {
    if (bloquerSiLecture(db, profile)) return;
    const motif = await uPrompt(`Motif du refus (visible par ${dm.boutique}) :`, "Rupture de stock");
    if (motif === null) return;
    save({
      ...db,
      boutiques: db.boutiques.map((b) => (b.nom === dm.boutique
        ? { ...b, demandes: demandesDe(b).map((x) => (x.id === dm.d.id ? { ...x, statut: "refusee", motif: motif.trim(), traite_par: profile.nom, date_traitement: today() } : x)) }
        : b))
    }, `Demande de ${dm.boutique} refusée : ${motif.trim()} (par ${profile.nom})`);
  };

  // ---- INVENTAIRE PHYSIQUE ----
  // On compte réellement les articles, l'app calcule l'écart et génère les ajustements.
  const [inv, setInv] = useState(null); // null = fermé, sinon { comptes: { [id]: "12" } }

  const ouvrirInventaire = () => {
    if (bloquerSiLecture(db, profile)) return;
    const liste0 = db.produits.filter((p) => p.boutique === bq);
    if (!liste0.length) { uAlert("Aucun article à inventorier sur ce site."); return; }
    setInv({ comptes: {} });
  };

  const ecartsInventaire = () => {
    if (!inv) return [];
    return db.produits.filter((p) => p.boutique === bq)
      .map((p) => {
        const brut = inv.comptes[p.id];
        if (brut === undefined || brut === "") return null;
        const theorique = stockActuel(db, p);
        const compte = Number(brut);
        return { p, theorique, compte, ecart: compte - theorique };
      })
      .filter(Boolean);
  };

  const validerInventaire = async () => {
    if (bloquerSiLecture(db, profile)) return;
    const lignes = ecartsInventaire();
    if (!lignes.length) { uAlert("Saisissez au moins une quantité comptée."); return; }
    const ecarts = lignes.filter((l) => l.ecart !== 0);
    const manquants = ecarts.filter((l) => l.ecart < 0);
    const excedents = ecarts.filter((l) => l.ecart > 0);
    const valeurEcart = ecarts.reduce((s, l) => s + l.ecart * Number(l.p.prix_achat || 0), 0);

    if (!ecarts.length) {
      if (await uConfirm(`✅ Aucun écart sur les ${lignes.length} article(s) comptés.\n\nEnregistrer quand même l'inventaire dans l'historique ?`)) {
        save({ ...db }, `Inventaire ${bq} : ${lignes.length} article(s) comptés, aucun écart (par ${profile.nom})`);
      }
      setInv(null);
      return;
    }

    const resume = ecarts.slice(0, 8).map((l) => `• ${l.p.nom} : théorique ${l.theorique}, compté ${l.compte} (${l.ecart > 0 ? "+" : ""}${l.ecart})`).join("\n");
    if (!await uConfirm(
      `📋 INVENTAIRE — ${bq}\n\n${lignes.length} article(s) comptés, ${ecarts.length} écart(s) :\n${manquants.length} manquant(s), ${excedents.length} excédent(s)\nValeur de l'écart : ${fmt(valeurEcart)}\n\n${resume}${ecarts.length > 8 ? `\n… et ${ecarts.length - 8} autre(s)` : ""}\n\nValider ? Le stock sera aligné sur le comptage (ajustements définitifs).`
    )) return;

    const ref = uid();
    const ajusts = ecarts.map((l) => ({
      id: uid(), date: today(), produit_id: l.p.id, boutique: bq, qte: l.ecart,
      motif: `Inventaire du ${dFR(today())} (théorique ${l.theorique} → compté ${l.compte})`,
      par: profile.nom, ref, type: "inventaire",
    }));
    save({ ...db, ajustements: [...ajusts, ...db.ajustements] },
      `Inventaire ${bq} : ${lignes.length} comptés, ${ecarts.length} écart(s), valeur ${fmt(valeurEcart)} (par ${profile.nom})`);
    setInv(null);
    uAlert(`✅ Inventaire validé. ${ecarts.length} ajustement(s) enregistré(s).`);
  };

  // Historique des ravitaillements (reconstruit à partir des ajustements)
  const historiqueRav = (() => {
    const groupes = {};
    (db.ajustements || []).filter((a) => a.type === "ravitaillement" && a.qte < 0 && a.boutique === bq).forEach((a) => {
      const m = String(a.motif || "").match(/^Ravitaillement (\S+) → (.+)$/);
      if (!m) return;
      const cle = a.ref || m[1];
      if (!groupes[cle]) groupes[cle] = { numero: m[1], dest: m[2], date: a.date, par: a.par, articles: 0, unites: 0 };
      groupes[cle].articles += 1;
      groupes[cle].unites += Math.abs(Number(a.qte));
    });
    return Object.values(groupes).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15);
  })();


  const ajouter = () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!f.nom) { uAlert("Veuillez saisir un nom d'article."); return; }
    save({ ...db, produits: [...db.produits, { id: uid(), boutique: bq, nom: f.nom, categorie: f.categorie || "Autre", fournisseur: f.fournisseur || "", initial: Number(f.initial || 0), entrees: 0, seuil: Number(f.seuil || 0), prix_achat: Number(f.prix_achat || 0), prix_vente: Number(f.prix_vente || 0), code: (f.code || "").trim() }] }, `Nouvel article « ${f.nom} » — ${bq}${f.fournisseur ? ` (fournisseur : ${f.fournisseur})` : ""}`);
    setF({ nom: "", categorie: "", fournisseur: "", initial: "", seuil: "", prix_achat: "", prix_vente: "", code: "" });
    uAlert("Article ajouté !");
  };

  // Changer le fournisseur d'un article existant
  const changerFournisseur = async (p) => {
    if (bloquerSiLecture(db, profile)) return;
    const noms = (db.fournisseurs || []).map((x) => x.nom);
    if (!noms.length) { uAlert("Aucun fournisseur enregistré. Créez-le d'abord dans l'onglet 🚚 Fournisseurs."); return; }
    const v = await uPrompt(`Fournisseur de « ${p.nom} » ?\n\nFournisseurs enregistrés :\n${noms.join("\n")}\n\n(laisser vide pour retirer le fournisseur)`, p.fournisseur || "");
    if (v === null) return;
    const nom = v.trim();
    if (nom && !noms.some((n) => n.toLowerCase() === nom.toLowerCase())) { uAlert("Ce fournisseur n'existe pas. Créez-le d'abord dans 🚚 Fournisseurs."); return; }
    const exact = noms.find((n) => n.toLowerCase() === nom.toLowerCase()) || "";
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, fournisseur: exact } : x)) },
      exact ? `Fournisseur de « ${p.nom} » : ${exact}` : `Fournisseur retiré de « ${p.nom} »`);
  };

  const importerArticles = async () => {
    const texte = await uPrompt(
      "Collez les articles (un par ligne) :\nFormat : Nom, Catégorie, Initial, Seuil, PrixAchat, PrixVente\nExemple :\nPanneau Solaire 150W, Panneaux, 10, 3, 45000, 65000"
    );
    if (!texte) return;

    const lignes = texte.split("\n").filter(l => l.trim());
    const nouveaux = [];
    let erreurs = [];

    lignes.forEach((ligne, i) => {
      const parts = ligne.split(",").map(s => s.trim());
      if (parts.length >= 3) {
        nouveaux.push({
          id: uid(),
          boutique: bq,
          nom: parts[0],
          categorie: parts[1] || "Autre",
          initial: Number(parts[2]) || 0,
          entrees: 0,
          seuil: Number(parts[3]) || 0,
          prix_achat: Number(parts[4]) || 0,
          prix_vente: Number(parts[5]) || 0
        });
      } else {
        erreurs.push(`Ligne ${i+1} : format incorrect`);
      }
    });

    if (nouveaux.length === 0) {
      uAlert("Aucun article valide à importer.\n" + erreurs.join("\n"));
      return;
    }

    if (await uConfirm(`Importer ${nouveaux.length} articles ?${erreurs.length ? `\n${erreurs.length} erreurs ignorées.` : ""}`)) {
      save({ ...db, produits: [...db.produits, ...nouveaux] }, `Import de ${nouveaux.length} articles — ${bq}`);
      uAlert(`${nouveaux.length} articles importés avec succès !`);
    }
  };

  const reappro = async (p) => {
    const s = await uPrompt(`Quantité reçue pour « ${p.nom} » :`);
    const q = Number(s);
    if (!s || isNaN(q) || q <= 0) return;
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, entrees: Number(x.entrees) + q } : x)) }, `Entrée stock +${q} « ${p.nom} » — ${bq}`);
    uAlert(`${q} ${p.nom} ajoutés au stock !`);
  };

  const ajuster = async (p) => {
    const s = await uPrompt(`Ajustement d'inventaire pour « ${p.nom} »\nQuantité (+ pour ajouter, − pour retirer, ex : -2) :`);
    const q = Number(s);
    if (!s || isNaN(q) || q === 0) return;
    const motif = await uPrompt("Motif :") || "Ajustement";
    save({ ...db, ajustements: [{ id: uid(), date: today(), produit_id: p.id, boutique: p.boutique, qte: q, motif, par: profile.nom }, ...db.ajustements] }, `Ajustement ${q > 0 ? "+" + q : q} « ${p.nom} » (${motif}) — ${p.boutique}`);
    uAlert("Ajustement enregistré !");
  };

  const transferer = async (p) => {
    const dispo = stockActuel(db, p);
    let dest = autres[0];
    if (autres.length > 1) {
      dest = await uPrompt(`Vers quelle boutique ? (${autres.join(" / ")})`);
      if (!dest || !autres.includes(dest.trim().toUpperCase())) { uAlert("Boutique de destination invalide."); return; }
      dest = dest.trim().toUpperCase();
    }
    if (!dest) { uAlert("Aucune autre boutique disponible."); return; }
    const s = await uPrompt(`Transfert de « ${p.nom} » : ${bq} → ${dest}\nQuantité (disponible : ${dispo}) :`);
    const q = Number(s);
    if (!s || isNaN(q) || q <= 0) return;
    if (q > dispo) { uAlert(`Stock insuffisant : il reste ${dispo}.`); return; }
    let produits = db.produits;
    let cible = produits.find((x) => x.boutique === dest && x.nom.trim().toLowerCase() === p.nom.trim().toLowerCase());
    if (!cible) {
      cible = { id: uid(), boutique: dest, nom: p.nom, categorie: p.categorie, initial: 0, entrees: 0, seuil: p.seuil, prix_achat: p.prix_achat, prix_vente: p.prix_vente };
      produits = [...produits, cible];
    }
    save({ ...db, produits, ajustements: [
      { id: uid(), date: today(), produit_id: p.id, boutique: bq, qte: -q, motif: `Transfert vers ${dest}`, par: profile.nom },
      { id: uid(), date: today(), produit_id: cible.id, boutique: dest, qte: q, motif: `Transfert depuis ${bq}`, par: profile.nom },
      ...db.ajustements] }, `Transfert ${q} « ${p.nom} » : ${bq} → ${dest}`);
    uAlert(`Transfert de ${q} ${p.nom} vers ${dest} effectué !`);
  };

  const supprimer = async (p) => {
    // Suppression d'un article : ADMINISTRATEUR UNIQUEMENT.
    // Le magasinier et le gérant peuvent entrer du stock et l'ajuster, jamais l'effacer.
    if (profile.role !== "admin") { uAlert("🔒 Seul l'administrateur peut supprimer un article. Vous pouvez ajuster le stock (± Ajuster) en indiquant le motif."); return; }
    if (bloquerSiLecture(db, profile)) return;
    if (stockVendu(db, p.id) > 0) { uAlert("Cet article a des ventes enregistrées : impossible de le supprimer."); return; }
    if (await uConfirm(`Supprimer « ${p.nom} » ?`)) save({ ...db, produits: db.produits.filter((x) => x.id !== p.id) }, `Suppression article « ${p.nom} » — ${bq}`);
  };

  const definirCode = async (p) => {
    const c = await uPrompt(`Code-barres de « ${p.nom} » (scannez dans le champ) :`, p.code || "");
    if (c === null) return;
    save({ ...db, produits: db.produits.map((x) => (x.id === p.id ? { ...x, code: c.trim() } : x)) }, `Code-barres « ${p.nom} » : ${c.trim() || "retiré"} — ${bq}`);
  };

  const liste = db.produits.filter((p) => p.boutique === bq);
  const mouvements = (db.ajustements || []).filter((a) => a.boutique === bq).slice(0, 20);
  const nomProduit = (pid) => db.produits.find((p) => p.id === pid)?.nom || "?";

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBqSel} avecDepots />}
      {profile.boutique && (
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-600">
          <span>{estMagasin ? "🏭 Magasin" : "🏪 Boutique"} :</span> <Badge boutique={bq} />
        </div>
      )}

      {/* Espace personnel du responsable du site : l'état de SON stock, rien d'autre */}
      {(() => {
        const mesArticles = db.produits.filter((p) => p.boutique === bq);
        const unites = mesArticles.reduce((s, p) => s + stockActuel(db, p), 0);
        const valeur = mesArticles.reduce((s, p) => s + stockActuel(db, p) * Number(p.prix_achat || 0), 0);
        const alertes = mesArticles.filter((p) => stockActuel(db, p) <= Number(p.seuil || 0)).length;
        const moisCourant = today().slice(0, 7);
        const sorties = (db.ajustements || []).filter((a) => a.type === "ravitaillement" && a.boutique === bq && a.qte < 0 && String(a.date).startsWith(moisCourant))
          .reduce((s, a) => s + Math.abs(Number(a.qte)), 0);
        const Case = ({ label, valeur: v, couleur }) => (
          <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
            <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
            <div className="text-xl font-bold tabular-nums mt-1">{v}</div>
          </div>
        );
        return (
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Case label="Articles référencés" valeur={mesArticles.length} couleur="border-l-sky-700" />
            <Case label="Unités en stock" valeur={unites} couleur="border-l-slate-500" />
            <Case label="Valeur du stock" valeur={fmt(valeur)} couleur="border-l-green-700" />
            <Case label="À réapprovisionner" valeur={<span className={alertes ? "text-red-600" : "text-green-700"}>{alertes}</span>} couleur={alertes ? "border-l-red-500" : "border-l-green-600"} />
            {estMagasin && <Case label="Sorties ce mois" valeur={<span className="text-purple-700">{sorties}</span>} couleur="border-l-purple-600" />}
          </div>
        );
      })()}

      {estMagasin && demandesRecues.length > 0 && (
        <div className="rounded-xl p-4 bg-white border-2 border-blue-300">
          <div className="font-bold mb-1 text-blue-800">📥 Demandes des boutiques ({demandesRecues.length})</div>
          <div className="text-xs text-slate-500 mb-3">Cliquez sur « Préparer le bon » : les articles demandés sont chargés automatiquement dans le bon de ravitaillement ci-dessous.</div>
          <div className="space-y-3">
            {demandesRecues.map((dm) => (
              <div key={dm.d.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-slate-800">🏪 {dm.boutique} <span className="text-xs font-normal text-slate-500">— demandé par {dm.d.par} le {dFR(dm.d.date)}</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => preparerDepuisDemande(dm)} className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-bold hover:bg-blue-800">📋 Préparer le bon</button>
                    <button onClick={() => refuserDemande(dm)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50">Refuser</button>
                  </div>
                </div>
                <ul className="mt-2 text-sm text-slate-700 list-disc pl-5">
                  {dm.d.lignes.map((l, i) => <li key={i}><b>{l.qte}</b> × {l.nom}{l.categorie ? ` (${l.categorie})` : ""}</li>)}
                </ul>
                {dm.d.note && <div className="mt-1 text-xs italic text-slate-500">« {dm.d.note} »</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {estMagasin && alertesDesBoutiques.length > 0 && (
        <div className="rounded-xl p-4 bg-white border-2 border-red-200">
          <div className="font-bold mb-1 text-red-700">⚠ Alertes de stock dans les boutiques ({alertesDesBoutiques.length})</div>
          <div className="text-xs text-slate-500 mb-3">Articles passés sous leur seuil. Anticipez le ravitaillement sans attendre la demande.</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Boutique", "Article", "Reste", "Seuil"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {alertesDesBoutiques.slice(0, 20).map(({ p, actuel }) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2"><Badge boutique={p.boutique} /></td>
                    <td className="px-3 py-2 font-semibold">{p.nom}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${actuel <= 0 ? "text-red-600" : "text-orange-600"}`}>{actuel}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-500">{p.seuil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {estMagasin && (
        <div className="rounded-xl p-4 bg-white border-2 border-purple-200">
          <div className="font-bold mb-1 text-purple-800">🚚 Ravitailler une boutique depuis 🏭 {bq}</div>
          {demandeEnCours && (
            <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs font-bold text-blue-800">
              📋 Ce bon répond à la demande de {demandeEnCours.boutique} — elle sera marquée « servie » à la validation.
              <button onClick={() => { setDemandeEnCours(null); setAAssocier([]); }} className="ml-2 underline font-normal">détacher</button>
            </div>
          )}

          {aAssocier.length > 0 && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-300 p-3">
              <div className="font-bold text-sm text-amber-800 mb-1">🔎 {aAssocier.length} article(s) à associer</div>
              <div className="text-xs text-amber-700 mb-3">La boutique les a nommés autrement, ou ils sont à zéro chez vous. Indiquez à quel article de VOTRE magasin cela correspond — ou ignorez la ligne.</div>
              <div className="space-y-2">
                {aAssocier.map((l, i) => (
                  <div key={i} className="rounded-lg bg-white border border-amber-200 p-2 grid sm:grid-cols-3 gap-2 items-end">
                    <div className="text-sm">
                      <div className="font-bold text-slate-800">{l.qte} × {l.nom}</div>
                      <div className="text-xs text-slate-500">{l.raison}</div>
                    </div>
                    <select className={inputCls} value={assoc[i] || ""} onChange={(e) => setAssoc({ ...assoc, [i]: e.target.value })}>
                      <option value="">— Article correspondant dans mon magasin —</option>
                      {db.produits.filter((p) => p.boutique === bq).map((p) => {
                        const d = stockActuel(db, p) - dejaAuBon(p.id);
                        return <option key={p.id} value={p.id} disabled={d <= 0}>{p.nom} (dispo : {d})</option>;
                      })}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => associerLigne(i, l)} className="flex-1 px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700">Associer</button>
                      <button onClick={() => setAAssocier(aAssocier.filter((_, j) => j !== i))} className="px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50">Ignorer</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-slate-500 mb-4">Préparez le bon, validez : le stock sort du magasin, entre en boutique, et le bon s'imprime.</div>

          {cibles.length === 0 ? (
            <div className="text-sm text-slate-400">Aucune boutique de vente disponible. Créez-en une dans ⚙ Paramètres.</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <Field label="Boutique à ravitailler">
                  <select className={inputCls} value={rav.dest} onChange={(e) => setRav({ ...rav, dest: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {cibles.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Catégorie">
                  <select className={inputCls} value={rav.categorie} onChange={(e) => setRav({ ...rav, categorie: e.target.value, produit_id: "" })}>
                    <option value="">— Toutes —</option>
                    {[...new Set(db.produits.filter((p) => p.boutique === bq).map((p) => p.categorie || "Autre"))].sort().map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Article du magasin">
                  <select className={inputCls} value={rav.produit_id} onChange={(e) => setRav({ ...rav, produit_id: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {db.produits.filter((p) => p.boutique === bq && (!rav.categorie || (p.categorie || "Autre") === rav.categorie)).map((p) => {
                      const d = stockActuel(db, p) - dejaAuBon(p.id);
                      return <option key={p.id} value={p.id} disabled={d <= 0}>{p.nom} (dispo : {d})</option>;
                    })}
                  </select>
                </Field>
                <Field label="Quantité">
                  <input type="number" min="1" className={inputCls} value={rav.qte} onChange={(e) => setRav({ ...rav, qte: e.target.value })} />
                </Field>
                <div className="flex items-end">
                  <button onClick={ajouterAuBon} className="w-full px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter au bon</button>
                </div>
              </div>

              {bon.length > 0 && (
                <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <div className="font-bold text-sm text-purple-900 mb-2">Bon en préparation — {bq} → {rav.dest || "…"}</div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase"><th className="text-left px-2 py-1">Article</th><th className="text-left px-2 py-1">Quantité</th><th></th></tr></thead>
                    <tbody>
                      {bon.map((l, i) => (
                        <tr key={i} className="border-t border-purple-100">
                          <td className="px-2 py-1 font-semibold">{l.nom}</td>
                          <td className="px-2 py-1 tabular-nums">{l.qte}</td>
                          <td className="px-2 py-1 text-right"><button onClick={() => setBon(bon.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button></td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-purple-300 font-bold">
                        <td className="px-2 py-1">TOTAL</td>
                        <td className="px-2 py-1 tabular-nums">{bon.reduce((s, l) => s + Number(l.qte), 0)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <button onClick={validerBon} className="px-5 py-2 rounded-lg bg-purple-700 text-white font-bold text-sm hover:bg-purple-800">✅ Valider le ravitaillement</button>
                    <button onClick={() => setBon([])} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Vider le bon</button>
                  </div>
                </div>
              )}

              {historiqueRav.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-2">Derniers ravitaillements depuis ce magasin</div>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-slate-500 uppercase">{["N°", "Date", "Boutique", "Articles", "Unités", "Par"].map((h) => <th key={h} className="text-left px-2 py-1">{h}</th>)}</tr></thead>
                    <tbody>
                      {historiqueRav.map((r) => (
                        <tr key={r.numero} className="border-t border-slate-100">
                          <td className="px-2 py-1 font-mono text-xs">{r.numero}</td>
                          <td className="px-2 py-1">{dFR(r.date)}</td>
                          <td className="px-2 py-1"><Badge boutique={r.dest} /></td>
                          <td className="px-2 py-1 tabular-nums">{r.articles}</td>
                          <td className="px-2 py-1 tabular-nums font-bold">{r.unites}</td>
                          <td className="px-2 py-1 text-xs text-slate-500">{r.par}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!estMagasin && magasinsDe(db).length > 0 && <DemandeRavitaillement db={db} save={save} profile={profile} boutique={bq} />}

      <Panel boutique={bq}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvel article <Badge boutique={bq} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-8 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Fournisseur">
            <select className={inputCls} value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })}>
              <option value="">— Aucun —</option>
              {(db.fournisseurs || []).map((x) => <option key={x.id} value={x.nom}>{x.nom}</option>)}
            </select>
          </Field>
          <Field label="Catégorie">
            <input className={inputCls} list="liste-categories" value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })} placeholder="Ex : Panneaux..." />
            <datalist id="liste-categories">{[...new Set(db.produits.map((p) => p.categorie).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Initial"><input type="number" className={inputCls} value={f.initial} onChange={(e) => setF({ ...f, initial: e.target.value })} /></Field>
          <Field label="Seuil"><input type="number" className={inputCls} value={f.seuil} onChange={(e) => setF({ ...f, seuil: e.target.value })} /></Field>
          <Field label="Prix achat (F)"><input type="number" className={inputCls} value={f.prix_achat} onChange={(e) => setF({ ...f, prix_achat: e.target.value })} /></Field>
          <Field label="Prix vente (F)"><input type="number" className={inputCls} value={f.prix_vente} onChange={(e) => setF({ ...f, prix_vente: e.target.value })} /></Field>
          <Field label="Code-barres (facultatif)"><input className={inputCls} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="Scannez ou tapez" /></Field>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button onClick={ajouter} className={btnDark}>Ajouter</button>
          <button onClick={importerArticles} className="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700">📥 Importation rapide</button>
        </div>
      </Panel>

      {inv && (
        <div className="rounded-xl p-4 bg-white border-2 border-emerald-300">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="font-bold text-emerald-800">📋 Inventaire physique — {bq}</div>
            <div className="text-xs text-slate-500">{ecartsInventaire().length} / {db.produits.filter((p) => p.boutique === bq).length} article(s) comptés</div>
          </div>
          <div className="text-xs text-slate-500 mb-3">Comptez les articles un par un et saisissez la quantité réelle. Laissez vide ce que vous ne comptez pas.</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Stock théorique", "Quantité comptée", "Écart", "Valeur écart"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {db.produits.filter((p) => p.boutique === bq).map((p) => {
                  const th = stockActuel(db, p);
                  const brut = inv.comptes[p.id];
                  const saisi = brut !== undefined && brut !== "";
                  const ec = saisi ? Number(brut) - th : 0;
                  return (
                    <tr key={p.id} className={`border-t border-slate-100 ${saisi && ec !== 0 ? (ec < 0 ? "bg-red-50" : "bg-amber-50") : ""}`}>
                      <td className="px-3 py-2 font-semibold">{p.nom}</td>
                      <td className="px-3 py-2 tabular-nums">{th}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                          value={brut ?? ""} onChange={(e) => setInv({ comptes: { ...inv.comptes, [p.id]: e.target.value } })} />
                      </td>
                      <td className={`px-3 py-2 tabular-nums font-bold ${!saisi ? "text-slate-300" : ec === 0 ? "text-green-700" : ec < 0 ? "text-red-600" : "text-amber-600"}`}>
                        {!saisi ? "—" : ec === 0 ? "✅ 0" : (ec > 0 ? "+" : "") + ec}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${ec < 0 ? "text-red-600" : "text-slate-500"}`}>
                        {saisi && ec !== 0 ? fmt(ec * Number(p.prix_achat || 0)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={validerInventaire} className="px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">✅ Valider l'inventaire</button>
            <button onClick={() => setInv(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span>Stocks — {bq}</span>
          {!inv && <button onClick={ouvrirInventaire} className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800">📋 Faire l'inventaire</button>}
        </div>
        <table className="w-full text-sm min-w-[960px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Fournisseur", "Catégorie", "Code", "Initial", "Entrées", "Vendus", "Ajust.", "Stock", "Seuil", "État", "P. achat", "P. vente", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={14} className="px-4 py-6 text-center text-slate-400">Aucun article.</td></tr>}
            {liste.map((p) => {
              const vendu = stockVendu(db, p.id), aj = stockAjuste(db, p.id), actuel = stockActuel(db, p), al = actuel <= Number(p.seuil);
              return (
                <tr key={p.id} className={`border-t border-slate-100 ${al ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => changerFournisseur(p)} className={`text-xs font-semibold underline ${p.fournisseur ? "text-slate-600" : "text-slate-400"}`}>
                      {p.fournisseur || "— Définir —"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{p.categorie || "Autre"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{p.code || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{p.initial}</td>
                  <td className="px-3 py-2 tabular-nums">{p.entrees}</td>
                  <td className="px-3 py-2 tabular-nums">{vendu}</td>
                  <td className={`px-3 py-2 tabular-nums ${aj < 0 ? "text-red-600" : ""}`}>{aj > 0 ? "+" + aj : aj || 0}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{actuel}</td>
                  <td className="px-3 py-2 tabular-nums">{p.seuil}</td>
                  <td className="px-3 py-2">{al ? <span className="text-xs font-bold text-red-600">⚠ Réappro.</span> : <span className="text-xs font-bold text-green-700">OK</span>}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(p.prix_achat)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(p.prix_vente)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => definirCode(p)} className="text-xs font-bold text-sky-800 underline mr-2">Code</button>
                    <button onClick={() => reappro(p)} className="text-xs font-bold text-sky-800 underline mr-2">+ Entrée</button>
                    <button onClick={() => ajuster(p)} className="text-xs font-bold text-sky-800 underline mr-2">± Ajuster</button>
                    <button onClick={() => transferer(p)} className="text-xs font-bold text-blue-700 underline mr-2">⇄ Transfert</button>
                    {profile.role === "admin" && <button onClick={() => supprimer(p)} className="text-xs text-red-600 underline">Suppr.</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Derniers mouvements — {bq}</div>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Article", "Qté", "Motif", "Par"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mouvements.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucun mouvement.</td></tr>}
            {mouvements.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2">{dFR(a.date)}</td>
                <td className="px-3 py-2 font-semibold">{nomProduit(a.produit_id)}</td>
                <td className={`px-3 py-2 tabular-nums font-bold ${a.qte < 0 ? "text-red-600" : "text-green-700"}`}>{a.qte > 0 ? "+" + a.qte : a.qte}</td>
                <td className="px-3 py-2">{a.motif}</td>
                <td className="px-3 py-2">{a.par}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ FOURNISSEURS ============
function Fournisseurs({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, fournisseurs: [...db.fournisseurs, { id: uid(), nom: f.nom, tel: f.tel, adresse: f.adresse, site_web: f.site_web, produits: f.produits, doit: Number(f.doit || 0), paye: Number(f.paye || 0) }] });
    setF({ nom: "", tel: "", adresse: "", site_web: "", produits: "", doit: "", paye: "" });
    uAlert("Fournisseur ajouté !");
  };

  const payer = async (fo) => {
    const s = await uPrompt(`Montant réglé à ${fo.nom} (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, paye: Number(x.paye) + m } : x)) });
    uAlert(`Paiement de ${fmt(m)} enregistré !`);
  };

  const nouvelleDette = async (fo) => {
    const s = await uPrompt(`Nouvelle commande à crédit chez ${fo.nom} — montant (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, doit: Number(x.doit) + m } : x)) });
    uAlert(`Commande de ${fmt(m)} enregistrée !`);
  };

  const supprimer = async (fo) => {
    if (await uConfirm(`Supprimer le fournisseur « ${fo.nom} » ?`)) save({ ...db, fournisseurs: db.fournisseurs.filter((x) => x.id !== fo.id) });
  };

  const liste = db.fournisseurs || [];
  const resteTotal = liste.reduce((s, x) => s + Math.max(0, x.doit - x.paye), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau fournisseur</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Adresse"><input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></Field>
          <Field label="Site web"><input type="url" placeholder="https://..." className={inputCls} value={f.site_web} onChange={(e) => setF({ ...f, site_web: e.target.value })} /></Field>
          <Field label="Produits"><input className={inputCls} value={f.produits} onChange={(e) => setF({ ...f, produits: e.target.value })} /></Field>
          <Field label="Dû (F)"><input type="number" className={inputCls} value={f.doit} onChange={(e) => setF({ ...f, doit: e.target.value })} /></Field>
          <Field label="Réglé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Fournisseurs <span className="text-sm font-normal text-slate-500">· Reste à régler : {fmt(resteTotal)}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Téléphone", "Adresse", "Site", "Produits", "Dû", "Réglé", "Reste", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">Aucun fournisseur.</td></tr>}
            {liste.map((fo) => {
              const reste = Math.max(0, fo.doit - fo.paye);
              return (
                <tr key={fo.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{fo.nom}</td>
                  <td className="px-3 py-2">{fo.tel || "—"}</td>
                  <td className="px-3 py-2">{fo.adresse || "—"}</td>
                  <td className="px-3 py-2">{fo.site_web ? <a href={fo.site_web.startsWith("http") ? fo.site_web : "https://" + fo.site_web} target="_blank" rel="noreferrer" className="text-blue-700 underline">Visiter</a> : "—"}</td>
                  <td className="px-3 py-2">{fo.produits || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.doit)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(fo.paye)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(reste)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => nouvelleDette(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Commande</button>
                    <button onClick={() => payer(fo)} className="text-xs font-bold text-sky-800 underline mr-2">+ Règlement</button>
                    <button onClick={() => supprimer(fo)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ COMMERCIAUX ============
function Commerciaux({ db, save }) {
  const [f, setF] = useState({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
  const [periodeIndex, setPeriodeIndex] = useState(2); // Ce mois par défaut
  const [customDebut, setCustomDebut] = useState("");
  const [customFin, setCustomFin] = useState("");

  // Période d'évaluation choisie par l'administrateur
  const [labelP, debutP, finP] = (() => {
    if (periodeIndex === "custom") return ["Période personnalisée", customDebut || today(), customFin || today()];
    return periodes()[periodeIndex] || periodes()[2];
  })();

  // Nombre de mois couverts (pour proratiser l'objectif mensuel)
  const nbMois = (() => {
    if (debutP <= "0001-01-01") return null; // "Depuis le début" : pas d'objectif comparable
    const a1 = Number(debutP.slice(0, 4)), m1 = Number(debutP.slice(5, 7));
    const a2 = Number(finP.slice(0, 4)), m2 = Number(finP.slice(5, 7));
    return Math.max(1, (a2 - a1) * 12 + (m2 - m1) + 1);
  })();

  const ajouter = () => {
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, commerciaux: [...db.commerciaux, { id: uid(), nom: f.nom, tel: f.tel, zone: f.zone, taux: Number(f.taux || 0), objectif: Number(f.objectif || 0), actif: true }] });
    setF({ nom: "", tel: "", zone: "", taux: "", objectif: "" });
    uAlert("Commercial ajouté !");
  };

  const modifier = async (c) => {
    const taux = await uPrompt(`Taux de commission de ${c.nom} (%) :`, c.taux);
    if (taux === null) return;
    const objectif = await uPrompt(`Objectif mensuel de ${c.nom} (F) :`, c.objectif);
    if (objectif === null) return;
    save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, taux: Number(taux || 0), objectif: Number(objectif || 0) } : x)) });
  };

  const toggleActif = (c) => save({ ...db, commerciaux: db.commerciaux.map((x) => (x.id === c.id ? { ...x, actif: x.actif === false } : x)) });

  const supprimer = async (c) => {
    if (await uConfirm(`Supprimer le commercial « ${c.nom} » ?`)) save({ ...db, commerciaux: db.commerciaux.filter((x) => x.id !== c.id) });
  };

  // Statistiques d'un commercial sur la période choisie
  const stats = (c) => {
    const vs = db.ventes.filter((v) => v.commercial === c.nom && inP(v.date, debutP, finP));
    const ca = vs.reduce((s, v) => s + totalVente(v), 0);
    const commission = Math.round((ca * Number(c.taux)) / 100);
    const objectifP = nbMois && c.objectif > 0 ? c.objectif * nbMois : null;
    const pct = objectifP ? Math.round((ca / objectifP) * 100) : null;
    const panier = vs.length ? Math.round(ca / vs.length) : 0;
    return { nb: vs.length, ca, commission, objectifP, pct, panier };
  };

  const liste = db.commerciaux || [];
  const classement = liste.map((c) => ({ c, s: stats(c) })).sort((a, b) => b.s.ca - a.s.ca);
  const totalCA = classement.reduce((s, x) => s + x.s.ca, 0);
  const totalCommissions = classement.reduce((s, x) => s + x.s.commission, 0);
  const totalVentes = classement.reduce((s, x) => s + x.s.nb, 0);

  const badgePerf = (pct) => {
    if (pct === null) return null;
    if (pct >= 100) return ["Objectif atteint", "bg-green-100 text-green-700"];
    if (pct >= 60) return ["En bonne voie", "bg-amber-100 text-amber-700"];
    return ["À suivre", "bg-red-100 text-red-700"];
  };
  const medaille = (i) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}ᵉ`);

  const Stat = ({ label, value }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-sky-700">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-xl font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-3">Nouveau commercial</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Zone"><input className={inputCls} value={f.zone} onChange={(e) => setF({ ...f, zone: e.target.value })} /></Field>
          <Field label="Commission (%)"><input type="number" step="0.5" className={inputCls} value={f.taux} onChange={(e) => setF({ ...f, taux: e.target.value })} /></Field>
          <Field label="Objectif mensuel (F)"><input type="number" className={inputCls} value={f.objectif} onChange={(e) => setF({ ...f, objectif: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-bold text-slate-800">Période d'évaluation :</div>
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
            value={periodeIndex}
            onChange={(e) => setPeriodeIndex(e.target.value === "custom" ? "custom" : Number(e.target.value))}
          >
            {periodes().map(([label], i) => <option key={i} value={i}>{label}</option>)}
            <option value="custom">Personnalisée</option>
          </select>
          {periodeIndex === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customDebut} onChange={(e) => setCustomDebut(e.target.value)} />
              <span className="text-slate-400">→</span>
              <input type="date" className="rounded-lg border border-slate-300 px-2 py-1 text-sm" value={customFin} onChange={(e) => setCustomFin(e.target.value)} />
            </div>
          )}
          {nbMois > 1 && <span className="text-xs text-slate-500">Objectifs proratisés sur {nbMois} mois</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat label={`CA équipe — ${labelP}`} value={fmt(totalCA)} />
        <Stat label="Commissions à payer" value={fmt(totalCommissions)} />
        <Stat label="Ventes réalisées" value={totalVentes} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span>Performance — {labelP} <span className="text-sm font-normal text-slate-500">({dFR(debutP)} → {dFR(finP)})</span></span>
          <button
            className="px-4 py-1.5 rounded-lg bg-sky-800 text-white text-xs font-bold hover:bg-sky-900"
            onClick={() => exportCSV("commissions", ["Rang", "Commercial", "Zone", "Période", "Ventes", "CA (F)", "Panier moyen (F)", "Taux (%)", "Commission (F)", "Objectif période (F)", "Atteinte (%)"],
              classement.map(({ c, s }, i) => [i + 1, c.nom, c.zone, `${dFR(debutP)} au ${dFR(finP)}`, s.nb, s.ca, s.panier, c.taux, s.commission, s.objectifP ?? "", s.pct ?? ""]))}
          >📄 Exporter les commissions</button>
        </div>
        <table className="w-full text-sm min-w-[1080px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Rang", "Commercial", "Zone", "Ventes", "CA", "Panier moyen", "Taux", "Commission", "Objectif période", "Progression", "Performance", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {classement.length === 0 && <tr><td colSpan={13} className="px-4 py-6 text-center text-slate-400">Aucun commercial.</td></tr>}
            {classement.map(({ c, s }, i) => {
              const perf = badgePerf(s.pct);
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-bold">{medaille(i)}</td>
                  <td className="px-3 py-2 font-semibold">{c.nom}{c.tel && <a href={`https://wa.me/${telDigits(c.tel)}`} target="_blank" rel="noreferrer" className="ml-2 text-xs text-green-700 underline">WhatsApp</a>}</td>
                  <td className="px-3 py-2">{c.zone || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(s.ca)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.nb ? fmt(s.panier) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.taux}%</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(s.commission)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.objectifP ? fmt(s.objectifP) : "—"}</td>
                  <td className="px-3 py-2 w-32">
                    {s.pct === null ? "—" : (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.pct >= 100 ? "bg-green-500" : s.pct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, s.pct)}%` }}></div>
                        </div>
                        <span className="text-xs font-bold tabular-nums">{s.pct}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">{perf ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${perf[1]}`}>{perf[0]}</span> : "—"}</td>
                  <td className="px-3 py-2">{c.actif === false ? <span className="text-xs font-bold text-red-600">Inactif</span> : <span className="text-xs font-bold text-green-700">Actif</span>}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => modifier(c)} className="text-xs font-bold text-sky-800 underline mr-2">Modifier</button>
                    <button onClick={() => toggleActif(c)} className="text-xs font-bold text-sky-800 underline mr-2">{c.actif === false ? "Réactiver" : "Désactiver"}</button>
                    <button onClick={() => supprimer(c)} className="text-xs text-red-600 underline">Suppr.</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ UTILISATEURS ============
function Users({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [avisOuvert, setAvisOuvert] = useState(null);
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
      const motDePasse = motDePasseClient(f.nom, f.tel);
      if (!await uConfirm(
        `Créer le compte client de ${f.nom.trim().toUpperCase()} ?\n\n` +
        `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
        `Remettez-lui ces identifiants.`
      )) return;
      const nomCli = f.nom, telCli = f.tel;
      const { user } = await fabriquerCompteClient(db, f.nom, f.tel, profile.nom);
      save({ ...db, users: [...db.users, user] }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}`);
      setF(vide);
      setMsg(`✅ Client créé — identifiant : ${identifiant} · mot de passe : ${motDePasse}`);
      // Envoi automatique des identifiants par WhatsApp.
      if (await uConfirm(`✅ Client créé.\n\n👤 ${identifiant}\n🔑 ${motDePasse}\n\nEnvoyer ces identifiants au client par WhatsApp ?`)) {
        envoyerIdentifiantsWhatsApp(nomCli, identifiant, motDePasse, telCli);
      }
      return;
    }

    if (!f.nom || f.pwd.length < 6) { setMsg("Remplissez le nom et un mot de passe (6 caractères minimum, exigé par la sécurisation Supabase)."); return; }
    const pwd_hash = await hacher(f.pwd);
    const estMultiBoutique = f.role === "admin" || f.role === "commercial" || f.role === "technicien" || f.role === "technicien_bmi" || f.role === "resp_commercial" || f.role === "comptable" || f.role === "client";
    const nouvelUser = { id: uid(), nom: f.nom, pwd_hash, role: f.role, boutique: estMultiBoutique ? null : f.boutique, actif: true };
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
    setF({ nom: "", pwd: "", role: "vendeur", boutique: premiere, taux: "5" });
    setMsg("✅ Utilisateur créé");
    setTimeout(() => setMsg(""), 3000);
  };

  const toggleActif = (u) => {
    if (u.role === "admin" && db.users.filter((x) => x.role === "admin" && x.actif !== false).length === 1 && u.actif !== false) {
      uAlert("Impossible de bloquer le dernier administrateur actif."); return;
    }
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, actif: x.actif === false } : x)) }, `${u.actif === false ? "Réactivation" : "Blocage"} du compte ${u.nom}`);
  };

  const changerPwd = async (u) => {
    const p = await uPrompt(`Nouveau mot de passe pour ${u.nom} (6 caractères minimum, exigé par la sécurisation Supabase) :`);
    if (!p || p.length < 6) { if (p !== null) uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const pwd_hash = await hacher(p);
    save({ ...db, users: db.users.map((x) => (x.id === u.id ? { ...x, pwd_hash, pwd: undefined } : x)) }, `Changement de mot de passe : ${u.nom}`);
  };

  const supprimerU = async (u) => {
    if (profile && u.id === profile.id) { uAlert("Vous ne pouvez pas supprimer le compte avec lequel vous êtes connecté."); return; }
    const autresAdmins = db.users.filter((x) => x.role === "admin" && x.actif !== false && x.id !== u.id);
    if (u.role === "admin" && autresAdmins.length === 0) { uAlert("Impossible : il faut garder au moins un administrateur actif."); return; }
    if (await uConfirm(`Supprimer définitivement le compte « ${u.nom} » (${u.role}) ?\nSes ventes et actions passées restent enregistrées.`)) {
      save({ ...db, users: db.users.filter((x) => x.id !== u.id) }, `Suppression du compte ${u.nom} (${u.role})`);
    }
  };

  const changerBoutique = async (u) => {
    const noms = db.boutiques.map((b) => b.nom);
    const b = await uPrompt(`Boutique assignée à ${u.nom} ? (${noms.join(" / ")})`, u.boutique || noms[0]);
    if (!b) return;
    const nom = b.trim().toUpperCase();
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
      next = { ...next, depenses: [dep, ...next.depenses] };
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
      depenses: [dep, ...db.depenses]
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
      depenses: [dep, ...db.depenses]
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Utilisateurs</div>
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Nom", "Rôle", "Boutique", "Salaire / Taux", "Statut", ""].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {db.users.map((u) => (
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
                  <button onClick={() => changerPwd(u)} className="text-xs font-bold text-sky-800 underline mr-2">Mot de passe</button>
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

// ============ OUTILS DE DIMENSIONNEMENT SOLAIRE ============
// Extrait une caractéristique numérique du nom d'un article
// (ex: "Panneau JKM 555W" -> 555 wc, "Convertisseur hybride 3KW" -> 3000 w, "Batterie 200Ah" -> 200 ah)
function specDepuisNom(nom) {
  const m = String(nom || "").match(/(\d+(?:[.,]\d+)?)\s*(kwc|wc|kw|w|kva|va|ah|kg|a|m)\b/i);
  if (!m) return null;
  let valeur = parseFloat(m[1].replace(",", "."));
  let unite = m[2].toLowerCase();
  if (unite === "kwc") { unite = "wc"; valeur *= 1000; }
  if (unite === "kw") { unite = "w"; valeur *= 1000; }
  if (unite === "kva") { unite = "va"; valeur *= 1000; }
  return { valeur, unite };
}

const estHybrideTexte = (texte) => /hybride|hybrid/i.test(texte || "");
const PRIX_RAIL = 5500;

const ROLES_EQUIPEMENT = [
  { id: "panneau", label: "Panneaux solaires", mots: ["panneau", "panel", "photovolta", "pv "], unites: ["w", "wc"] },
  { id: "batterie", label: "Batteries", mots: ["batterie", "battery", "lifepo4", "lithium"], unites: ["ah"] },
  { id: "convertisseur", label: "Convertisseur", mots: ["convertisseur", "onduleur", "inverter", "inverseur"], unites: ["w", "va"] },
  { id: "regulateur", label: "Régulateur MPPT", mots: ["régulateur", "regulateur", "mppt", "chargeur solaire", "controller"], unites: ["a"] },
];

// ============ OUTIL DE DIMENSIONNEMENT — PORTAIL / PORTE DE GARAGE MOTORISÉ ============
// Même logique que le solaire : caractéristique numérique (ici le poids en kg, ou la
// longueur en m pour la crémaillère) extraite du nom de l'article via specDepuisNom().
// « unites: [] » = accessoire compté à la pièce, sans caractéristique à comparer.
const ROLES_EQUIPEMENT_GARAGE = [
  { id: "moteur", label: "Moteur / motorisation", mots: ["moteur portail", "moteur garage", "moteur porte", "motorisation", "opérateur", "operateur", "kit motorisation"], unites: ["kg"] },
  { id: "cremaillere", label: "Crémaillère", mots: ["crémaillère", "cremaillere"], unites: ["m"] },
  { id: "telecommande", label: "Télécommande", mots: ["télécommande", "telecommande", "émetteur", "emetteur"], unites: [] },
  { id: "cellule", label: "Photocellules (cellules infrarouges)", mots: ["cellule", "photocellule", "capteur infrarouge", "cellule infrarouge"], unites: [] },
  { id: "clignotant", label: "Lampe clignotante", mots: ["clignotant", "lampe flash", "gyrophare"], unites: [] },
  { id: "verrouillage_manuel", label: "Déverrouillage manuel", mots: ["déverrouillage manuel", "deverrouillage manuel", "clé de déverrouillage", "cle de deverrouillage", "verrouillage manuel", "débrayage manuel", "debrayage manuel"], unites: [] },
];

const TYPES_PORTAIL = [
  { id: "portail_coulissant", label: "Portail coulissant" },
  { id: "portail_battant", label: "Portail battant" },
  { id: "porte_sectionnelle", label: "Porte de garage sectionnelle" },
  { id: "porte_basculante", label: "Porte de garage basculante" },
  { id: "porte_rideau", label: "Rideau métallique" },
];

// Prix par défaut de la porte/du portail, au m² (largeur × hauteur). Modifiables par
// le vendeur lors du dimensionnement — ce sont juste des valeurs de départ.
const PRIX_PORTE_M2 = {
  portail_coulissant: 80000,
  portail_battant: 55000,
  porte_sectionnelle: 130000,
  porte_basculante: 80000,
  porte_rideau: 95000,
};

// Marge de sécurité appliquée au poids selon la fréquence d'usage quotidienne :
// un usage intensif use le moteur plus vite, on dimensionne donc plus large.
const FACTEUR_FREQUENCE = { faible: 1.1, moyenne: 1.25, intensive: 1.5 };
const LABEL_FREQUENCE = { faible: "Faible (< 10 cycles/j)", moyenne: "Moyenne (10 à 30 cycles/j)", intensive: "Intensive (> 30 cycles/j)" };

function categorieMoteur(poidsKg) {
  if (poidsKg <= 0) return "—";
  if (poidsKg <= 300) return "Léger (≤ 300 kg)";
  if (poidsKg <= 500) return "Standard (300 à 500 kg)";
  if (poidsKg <= 800) return "Robuste (500 à 800 kg)";
  return "Industriel (> 800 kg)";
}

// ============ ÉLÉMENTS PARTAGÉS ENTRE LES 3 OUTILS DE DIMENSIONNEMENT ============
// Solaire, Garage et Autre suivent tous la même mécanique de fond (besoins du
// client → équipements → remise/installation/transport → devis → envoi/vente).
// Cette section factorise les morceaux identiques pour n'avoir à les corriger
// qu'UNE fois — c'est le verrou anti-écrasement (voir useSelectionAvecVerrou)
// qui avait le bug corrigé en v2.77.1, dupliqué à l'époque dans 2 outils.

// ---- Verrou anti-écrasement : une fois qu'un article est choisi/saisi à la
// main pour un rôle/besoin donné, la recherche automatique ne doit plus jamais
// y toucher tant que le vendeur n'a pas explicitement demandé à y revenir.
// Générique pour Garage et Autre (rôles fixes ou besoins dynamiques, sans
// dépendance entre deux lignes). Le Solaire garde sa propre version : le choix
// du convertisseur y détermine si un régulateur est nécessaire, une dépendance
// entre deux rôles que cette version générique ne gère pas.
function useSelectionAvecVerrou(meilleurChoix, initial) {
  const [choix, setChoix] = useState(() => initial?.choix || {});
  const [manuelOuvert, setManuelOuvert] = useState({});
  const [brouillonManuel, setBrouillonManuel] = useState({});
  const [verrous, setVerrous] = useState(() => initial?.verrous || {});

  const recalculerNonVerrouilles = (items) => {
    setChoix((avant) => {
      const nouveau = { ...avant };
      for (const item of items) {
        if (verrous[item.id]) continue;
        const c = meilleurChoix(item);
        if (c) nouveau[item.id] = c; else delete nouveau[item.id];
      }
      return nouveau;
    });
  };

  const changerProduit = (itemId, produitId, calculerQte) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // choix explicite : plus jamais recalculé tout seul
    if (!produitId) { setChoix((avant) => { const n = { ...avant }; delete n[itemId]; return n; }); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "stock", produit_id: produitId, qte: calculerQte(produitId) } }));
  };

  const changerQte = (itemId, qte) => setChoix((avant) => ({ ...avant, [itemId]: { ...avant[itemId], qte: Math.max(1, Number(qte) || 1) } }));

  const ouvrirManuel = (itemId, brouillonParDefaut) => {
    setVerrous((v) => ({ ...v, [itemId]: true })); // dès l'ouverture : plus de recalcul automatique
    setManuelOuvert((v) => ({ ...v, [itemId]: true }));
    setBrouillonManuel((v) => ({ ...v, [itemId]: v[itemId] || brouillonParDefaut }));
  };
  const validerManuel = (itemId) => {
    const b = brouillonManuel[itemId];
    if (!b || !b.nom.trim() || !b.prix) { uAlert("Indiquez au moins le nom et le prix de l'article."); return; }
    setChoix((avant) => ({ ...avant, [itemId]: { type: "manuel", nom: b.nom.trim(), prix: Number(b.prix), qte: Math.max(1, Number(b.qte) || 1) } }));
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
  };
  // Repasse cet item en sélection/recherche automatique (relâche le verrou et relance meilleurChoix)
  const annulerManuel = (itemId, item) => {
    setManuelOuvert((v) => ({ ...v, [itemId]: false }));
    setVerrous((v) => { const n = { ...v }; delete n[itemId]; return n; });
    const c = item ? meilleurChoix(item) : null;
    setChoix((avant) => { const n = { ...avant }; if (c) n[itemId] = c; else delete n[itemId]; return n; });
  };

  return { choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous, recalculerNonVerrouilles, changerProduit, changerQte, ouvrirManuel, validerManuel, annulerManuel };
}

// ---- Bloc « Autres équipements » : lignes libres (nom + prix + quantité) ----
function BlocAutresEquipements({ titre, autres, onAjouter, onModifier, onRetirer, placeholder }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <div className="font-bold text-sm text-slate-700 mb-2">{titre}</div>
      <div className="space-y-2">
        {autres.map((a) => (
          <div key={a.id} className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <Field label="Article"><input className={inputCls} placeholder={placeholder} value={a.nom} onChange={(e) => onModifier(a.id, "nom", e.target.value)} /></Field>
            <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={a.prix} onChange={(e) => onModifier(a.id, "prix", e.target.value)} /></Field>
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => onModifier(a.id, "qte", e.target.value)} /></Field>
            <button onClick={() => onRetirer(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
          </div>
        ))}
      </div>
      <button onClick={onAjouter} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter un équipement</button>
    </div>
  );
}

// ---- Bloc totaux : remise (sur les articles uniquement) → installation → transport → total ----
function BlocTotauxDevis({ totalArticles, pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis, onConvertir }) {
  return (
    <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Articles :</span><span className="font-semibold">{fmt(totalArticles)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Remise</span>
          <input type="number" min="0" max="100" step="0.5" value={pctRemise} onChange={(e) => setPctRemise(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% = −</span><span className="font-semibold text-red-600">{fmt(remise)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Frais d'installation</span>
          <input type="number" min="0" max="100" step="0.5" value={pctInstall} onChange={(e) => setPctInstall(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% =</span><span className="font-semibold">{fmt(fraisInstallation)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Transport / livraison</span>
          <input type="number" min="0" max="100" step="0.5" value={pctTransport} onChange={(e) => setPctTransport(e.target.value)} className="w-16 rounded border border-slate-300 px-2 py-0.5 text-right" />
          <span className="text-slate-500">% =</span><span className="font-semibold">{fmt(fraisTransport)}</span>
        </div>
        <span className="text-lg font-bold text-sky-800">Total : {fmt(totalDevis)}</span>
      </div>
      <button onClick={onConvertir} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🛒 Convertir en vente</button>
    </div>
  );
}

// Calcule remise/installation/transport/total à partir du montant des articles.
// Toujours la même règle : la remise ne porte QUE sur les articles ; installation
// et transport restent calculés sur le montant plein (non réduit par la remise).
function useTotauxDevis(totalArticles) {
  const [pctRemise, setPctRemise] = useState("0");
  const remise = Math.round((totalArticles * Number(pctRemise || 0)) / 100);
  const [pctInstall, setPctInstall] = useState("10");
  const fraisInstallation = Math.round((totalArticles * Number(pctInstall || 0)) / 100);
  const [pctTransport, setPctTransport] = useState("0");
  const fraisTransport = Math.round((totalArticles * Number(pctTransport || 0)) / 100);
  const totalDevis = totalArticles - remise + fraisInstallation + fraisTransport;
  return { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis };
}

// ---- Bloc « Envoyer le devis au client » : sélection/création du compte + bouton WhatsApp ----
function BlocEnvoiDevisClient({ db, clientDevis, setClientDevis, nouvClient, setNouvClient, comptesClients, onEnvoyer }) {
  return (
    <div className="rounded-xl p-4 bg-white border-2 border-emerald-300">
      <div className="font-bold text-emerald-900 mb-1">📲 Envoyer ce devis au client</div>
      <div className="text-xs text-slate-500 mb-3">
        Le devis est déposé dans son espace client, et WhatsApp s'ouvre avec ses identifiants et le lien. S'il n'a pas encore de compte, il est créé automatiquement : le nom et le numéro suffisent.
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 items-end">
        <Field label="Client destinataire">
          <select className={inputCls} value={clientDevis} onChange={(e) => setClientDevis(e.target.value)}>
            <option value="">— Choisir —</option>
            <option value="__nouveau__">➕ Nouveau client (nom + numéro)</option>
            {comptesClients.map((u) => <option key={u.id} value={u.id}>{u.nom_base || u.nom}{u.tel ? ` — ${u.tel}` : ""}</option>)}
          </select>
        </Field>
        {clientDevis === "__nouveau__" && (
          <>
            <Field label="Nom du client">
              <input className={inputCls} placeholder="KOFFI AMA" value={nouvClient.nom} onChange={(e) => setNouvClient({ ...nouvClient, nom: e.target.value })} />
            </Field>
            <Field label="Numéro WhatsApp">
              <input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={nouvClient.tel} onChange={(e) => setNouvClient({ ...nouvClient, tel: e.target.value })} />
            </Field>
          </>
        )}
      </div>

      {clientDevis === "__nouveau__" && nouvClient.nom && chiffresTel(nouvClient.tel).length >= 4 && (
        <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs">
          Compte qui sera créé — identifiant : <b>{identifiantClient(db, nouvClient.nom, nouvClient.tel)}</b> · mot de passe : <b>{motDePasseClient(nouvClient.nom, nouvClient.tel)}</b>
        </div>
      )}

      <button onClick={onEnvoyer} disabled={!clientDevis} className={`mt-3 px-5 py-2 rounded-lg font-bold text-sm ${clientDevis ? "bg-green-600 text-white hover:bg-green-700" : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}>
        📲 Envoyer par WhatsApp
      </button>
    </div>
  );
}

// Résout le compte client destinataire : crée un compte à la volée (nom + tel) ou
// récupère un compte existant. Retourne null (une alerte a déjà été affichée) en
// cas de saisie invalide, sinon { compte, motDePasse, dbApres }.
async function resoudreClientDevis(db, clientDevis, nouvClient, profile) {
  if (clientDevis === "__nouveau__") {
    const nom = nouvClient.nom.trim();
    const tel = nouvClient.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) {
      uAlert("Pour créer le compte, il faut le nom du client et son numéro (au moins 4 chiffres).");
      return null;
    }
    const fab = await fabriquerCompteClient(db, nom, tel, profile.nom);
    return { compte: fab.user, motDePasse: fab.motDePasse, dbApres: { ...db, users: [...db.users, fab.user] } };
  }
  const compte = db.users.find((u) => u.id === clientDevis);
  if (!compte) { uAlert("Choisissez le client à qui envoyer ce devis."); return null; }
  return { compte, motDePasse: motDePasseConnu(compte), dbApres: db };
}

// Enregistre le devis dans la fiche du client puis ouvre WhatsApp avec ses
// identifiants et le lien vers son espace. `ligneEntete` = les 1-2 lignes
// spécifiques à l'outil (type d'installation + montant), le reste du message
// (identifiants, lien, signature) est commun aux 3 outils.
function envoyerDevisEtOuvrirWhatsApp({ dbApres, compte, motDePasse, devis, save, profile, nouvClient, ligneEntete, idAReprendre }) {
  const dbFinal = {
    ...dbApres,
    users: dbApres.users.map((u) => (u.id === compte.id
      ? { ...u, devis: idAReprendre ? u.devis.map((x) => (x.id === idAReprendre ? { ...devis, id: idAReprendre } : x)) : [devis, ...(u.devis || [])] }
      : u)),
    // Le message de demande de modification / rejet n'a plus lieu d'être : le vendeur vient d'y répondre.
    messages: idAReprendre ? (dbApres.messages || []).filter((m) => m.devis_id !== idAReprendre) : dbApres.messages,
  };
  save(dbFinal, idAReprendre
    ? `Devis corrigé (${fmt(devis.total)}) renvoyé au client ${compte.nom} par ${profile.nom}`
    : `Devis (${fmt(devis.total)}) envoyé au client ${compte.nom} par ${profile.nom}`);

  const lignesMsg = [
    `Bonjour${compte.nom_base ? " " + compte.nom_base : ""}, voici votre devis BMI TOGO${idAReprendre ? ", corrigé selon votre demande" : ""}.`,
    ``,
    ...ligneEntete,
    ``,
    `Consultez le détail dans votre espace client :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${compte.nom}*`,
    motDePasse ? `🔑 Mot de passe : *${motDePasse}*` : `🔑 Mot de passe : celui qui vous a été communiqué`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  const num = telDigits(compte.tel || nouvClient.tel);
  const txt = encodeURIComponent(lignesMsg.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
}

function DimensionnementSolaire({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client (liste d'appareils) ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [appareils, setAppareils] = useState(() =>
    besoinsRepris?.appareils?.length
      ? besoinsRepris.appareils.map((a) => ({ id: uid(), nom: a.nom, puissance: String(a.puissance), heures: String(a.heures), qte: String(a.qte || 1) }))
      : [{ id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]
  );
  const [autonomie, setAutonomie] = useState(() => besoinsRepris?.autonomie ? String(besoinsRepris.autonomie) : "1");
  const [soleil, setSoleil] = useState("5");
  const [tension, setTension] = useState(() => besoinsRepris?.tension ? String(besoinsRepris.tension) : "24");
  const [typeBatterie, setTypeBatterie] = useState(() => besoinsRepris?.type_batterie || "lifepo4");

  const majAppareil = (id, champ, val) => setAppareils(appareils.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const ajouterAppareil = () => setAppareils([...appareils, { id: uid(), nom: "", puissance: "", heures: "", qte: "1" }]);
  const retirerAppareil = (id) => setAppareils(appareils.filter((a) => a.id !== id));

  const whParJour = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.heures || 0) * Number(a.qte || 1), 0);
  const puissanceSimultanee = appareils.reduce((s, a) => s + Number(a.puissance || 0) * Number(a.qte || 1), 0);

  // ---- Calculs de dimensionnement (indicatifs, avec marges de sécurité usuelles) ----
  const dod = typeBatterie === "lifepo4" ? 0.9 : 0.5;
  const rendementSysteme = 0.8;

  const wcPanneaux = soleil > 0 ? Math.ceil(whParJour / Number(soleil) / rendementSysteme) : 0;
  const whBatterie = whParJour * Number(autonomie || 1);
  const ahBatterie = tension > 0 ? Math.ceil(whBatterie / Number(tension) / dod) : 0;
  const wConvertisseur = Math.ceil(puissanceSimultanee * 2); // marge : somme des puissances × 2
  const kwConvertisseur = wConvertisseur / 1000;
  const aRegulateur = tension > 0 ? Math.ceil((wcPanneaux / Number(tension)) * 1.25) : 0;

  const besoinParRole = { panneau: wcPanneaux, batterie: ahBatterie, convertisseur: wConvertisseur, regulateur: aRegulateur };

  const candidats = (role) => produitsBoutique
    .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
    .filter(({ p, spec }) => {
      const texte = (p.nom + " " + (p.categorie || "")).toLowerCase();
      const motCorrespond = role.mots.some((m) => texte.includes(m));
      const uniteOk = spec && role.unites.includes(spec.unite);
      return motCorrespond && uniteOk;
    });

  // Panneaux/batteries : le plus gros calibre dispo (on empile plusieurs unités).
  // Convertisseur/régulateur : le plus PETIT modèle qui couvre le besoin (un seul article,
  // inutile de payer un calibre surdimensionné) ; si aucun ne suffit seul, on prend le plus
  // gros dispo et on complète avec plusieurs unités.
  const empilable = (roleId) => roleId === "panneau" || roleId === "batterie";

  const meilleurChoix = (role) => {
    const options = candidats(role).sort((a, b) => a.spec.valeur - b.spec.valeur);
    const besoin = besoinParRole[role.id];
    if (options.length === 0 || besoin <= 0) return null;

    if (!empilable(role.id)) {
      const suffisant = options.find((o) => o.spec.valeur >= besoin);
      if (suffisant) return { type: "stock", produit_id: suffisant.p.id, qte: 1 };
      // Aucun modèle seul ne suffit : on prend le plus gros et on complète en quantité
      const plusGros = options[options.length - 1];
      const qte = Math.min(50, Math.max(1, Math.ceil(besoin / plusGros.spec.valeur)));
      return { type: "stock", produit_id: plusGros.p.id, qte };
    }

    const meilleur = options[options.length - 1];
    const qte = Math.min(50, Math.max(1, Math.ceil(besoin / meilleur.spec.valeur)));
    return { type: "stock", produit_id: meilleur.p.id, qte };
  };

  // choix[roleId] = { type: "stock", produit_id, qte } OU { type: "manuel", nom, prix, qte }
  // Reconstruit les équipements déjà choisis depuis les lignes RÉELLES du devis
  // repris — restitue aussi ceux saisis directement à la main.
  const initialSelectionSolaire = (() => {
    if (!lignesReprises.length || !devisAReprendre) return null;
    const choix = {}, verrous = {};
    ROLES_EQUIPEMENT.forEach((role) => {
      const ligne = lignesReprises.find((l) => l.categorie === role.label);
      if (!ligne) return;
      const options = candidats(role);
      const trouve = options.find((o) => o.p.nom === ligne.article);
      choix[role.id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(ligne.qte) || 1 }
        : { type: "manuel", nom: ligne.article, prix: Number(ligne.pu) || 0, qte: Number(ligne.qte) || 1 };
      verrous[role.id] = true;
    });
    return { choix, verrous };
  })();
  const [choix, setChoix] = useState(() => initialSelectionSolaire?.choix || {});
  const [manuelOuvert, setManuelOuvert] = useState({}); // { roleId: bool } — affiche le mini-formulaire de saisie libre
  const [brouillonManuel, setBrouillonManuel] = useState({}); // { roleId: { nom, prix, qte } }
  // Rôles que le vendeur a choisi de saisir/sélectionner lui-même : la sélection
  // automatique ne doit plus jamais y toucher tant qu'il ne revient pas en arrière.
  const [rolesManuels, setRolesManuels] = useState(() => initialSelectionSolaire?.verrous || {});

  useEffect(() => {
    setChoix((avant) => {
      const nouveauChoix = { ...avant };
      for (const role of ROLES_EQUIPEMENT) {
        if (rolesManuels[role.id]) continue; // ne pas écraser un choix fait à la main
        if (role.id === "regulateur") {
          const convChoice = nouveauChoix.convertisseur;
          const conv = convChoice?.type === "stock" && produitsBoutique.find((p) => p.id === convChoice.produit_id);
          const hybride = convChoice?.type === "manuel" ? estHybrideTexte(convChoice.nom) : !!(conv && estHybrideTexte(conv.nom + " " + (conv.categorie || "")));
          if (hybride) { delete nouveauChoix.regulateur; continue; }
        }
        const c = meilleurChoix(role);
        if (c) nouveauChoix[role.id] = c; else delete nouveauChoix[role.id];
      }
      return nouveauChoix;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whParJour, autonomie, soleil, tension, typeBatterie, boutique, db.produits]);

  const produitConvertisseurChoisi = choix.convertisseur?.type === "stock" && produitsBoutique.find((p) => p.id === choix.convertisseur.produit_id);
  const convertisseurEstHybride = choix.convertisseur?.type === "manuel"
    ? estHybrideTexte(choix.convertisseur.nom)
    : !!(produitConvertisseurChoisi && estHybrideTexte(produitConvertisseurChoisi.nom + " " + (produitConvertisseurChoisi.categorie || "")));

  const ligneRole = (role) => {
    const c = choix[role.id];
    if (!c) return { role, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { role, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { role, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { role, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = ROLES_EQUIPEMENT.map(ligneRole);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  const changerProduit = (roleId, produitId) => {
    setRolesManuels({ ...rolesManuels, [roleId]: true }); // choix explicite : on ne le recalcule plus tout seul
    if (!produitId) { const c2 = { ...choix }; delete c2[roleId]; setChoix(c2); return; }
    const p = produitsBoutique.find((x) => x.id === produitId);
    const spec = p ? specDepuisNom(p.nom + " " + (p.categorie || "")) : null;
    const besoin = besoinParRole[roleId];
    const qte = spec && spec.valeur > 0
      ? (!empilable(roleId) && spec.valeur >= besoin ? 1 : Math.min(50, Math.max(1, Math.ceil(besoin / spec.valeur))))
      : 1;
    const nouveauChoix = { ...choix, [roleId]: { type: "stock", produit_id: produitId, qte } };
    if (roleId === "convertisseur") {
      const hybride = p && estHybrideTexte(p.nom + " " + (p.categorie || ""));
      if (hybride) delete nouveauChoix.regulateur;
      else { const c = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur")); if (c) nouveauChoix.regulateur = c; else delete nouveauChoix.regulateur; }
    }
    setChoix(nouveauChoix);
  };

  const changerQte = (roleId, qte) => setChoix({ ...choix, [roleId]: { ...choix[roleId], qte: Math.max(1, Number(qte) || 1) } });

  const ouvrirManuel = (roleId) => {
    setRolesManuels({ ...rolesManuels, [roleId]: true }); // dès l'ouverture : la sélection automatique n'y touche plus
    setManuelOuvert({ ...manuelOuvert, [roleId]: true });
    setBrouillonManuel({ ...brouillonManuel, [roleId]: brouillonManuel[roleId] || { nom: "", prix: "", qte: "1" } });
  };
  const validerManuel = (roleId) => {
    const b = brouillonManuel[roleId];
    if (!b || !b.nom.trim() || !b.prix) { uAlert("Indiquez au moins le nom et le prix de l'article."); return; }
    const nouveauChoix = { ...choix, [roleId]: { type: "manuel", nom: b.nom.trim(), prix: Number(b.prix), qte: Math.max(1, Number(b.qte) || 1) } };
    if (roleId === "convertisseur" && !estHybrideTexte(b.nom)) {
      const c = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur"));
      if (c) nouveauChoix.regulateur = c;
    }
    if (roleId === "convertisseur" && estHybrideTexte(b.nom)) delete nouveauChoix.regulateur;
    setChoix(nouveauChoix);
    setManuelOuvert({ ...manuelOuvert, [roleId]: false });
  };
  // Repasse ce rôle en sélection automatique (relâche le verrou et relance meilleurChoix)
  const annulerManuel = (roleId) => {
    setManuelOuvert({ ...manuelOuvert, [roleId]: false });
    setRolesManuels((v) => { const n = { ...v }; delete n[roleId]; return n; });
    const role = ROLES_EQUIPEMENT.find((r) => r.id === roleId);
    const c = role ? meilleurChoix(role) : null;
    const nouveauChoix = { ...choix };
    if (c) nouveauChoix[roleId] = c; else delete nouveauChoix[roleId];
    if (roleId === "convertisseur") {
      const p = c?.type === "stock" && produitsBoutique.find((x) => x.id === c.produit_id);
      const hybride = p && estHybrideTexte(p.nom + " " + (p.categorie || ""));
      if (hybride) delete nouveauChoix.regulateur;
      else if (!rolesManuels.regulateur) { const cr = meilleurChoix(ROLES_EQUIPEMENT.find((r) => r.id === "regulateur")); if (cr) nouveauChoix.regulateur = cr; else delete nouveauChoix.regulateur; }
    }
    setChoix(nouveauChoix);
  };

  // ---- Rails de fixation : quantité et prix calculés automatiquement ----
  // Formule : (nombre de panneaux × 2,2) ÷ 4,2 = quantité de rails ; prix fixe 5 500 F/rail
  const nombrePanneaux = choix.panneau?.qte || 0;
  const ligneRailsReprise = lignesReprises.find((l) => l.categorie === "Rails de fixation");
  const [railsQte, setRailsQte] = useState(ligneRailsReprise ? Number(ligneRailsReprise.qte) : 0);
  const premierRenduRails = useRef(true);
  useEffect(() => {
    if (premierRenduRails.current) { premierRenduRails.current = false; return; } // ne pas écraser la reprise au montage
    setRailsQte(nombrePanneaux > 0 ? Math.ceil(nombrePanneaux * 2.2) : 0);
  }, [nombrePanneaux]);
  const sousTotalRails = railsQte * PRIX_RAIL;

  // ---- Autres équipements : câbles, protections AC/DC, accessoires (saisie libre) ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + sousTotalRails + totalAutres;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");   // compte client existant
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : choisissez d'abord les équipements."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    // Le panier prêt à encaisser : le vendeur n'aura rien à ressaisir.
    const panier = [
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
      ...(railsQte > 0 ? [{ produit_id: null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
    ];

    // Le devis, rangé DANS la fiche du client : aucune migration de base.
    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,           // décide si une commission sera due
      statut: "propose",                // propose → valide → paye
      panier,                           // ce que le vendeur encaissera
      boutique,
      besoins: {
        wh_jour: whParJour,
        puissance_simultanee: puissanceSimultanee,
        autonomie: Number(autonomie || 1),
        tension: Number(tension),
        type_batterie: typeBatterie,
        appareils: appareils.filter((a) => a.nom && a.puissance).map((a) => ({
          nom: a.nom, puissance: Number(a.puissance), heures: Number(a.heures || 0), qte: Number(a.qte || 1),
        })),
      },
      lignes: [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: l.role.label, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...(railsQte > 0 ? [{ categorie: "Rails de fixation", article: "Rail de fixation", qte: railsQte, pu: PRIX_RAIL, total: sousTotalRails }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`☀️ Installation solaire — *${fmt(totalDevis)}*`, `Besoin estimé : ${Math.round(whParJour)} Wh/jour`],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = [
      ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
      ...(railsQte > 0 ? [{ produit_id: null, article: "Rails de fixation", qte: railsQte, pu: PRIX_RAIL }] : []),
      ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
    ];
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">☀️ Besoins électriques du client <Badge boutique={boutique} /></div>
        <div className="space-y-2">
          {appareils.map((a) => (
            <div key={a.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <Field label="Appareil"><input className={inputCls} placeholder="Ex : Téléviseur" value={a.nom} onChange={(e) => majAppareil(a.id, "nom", e.target.value)} /></Field>
              <Field label="Puissance (W)"><input type="number" className={inputCls} value={a.puissance} onChange={(e) => majAppareil(a.id, "puissance", e.target.value)} /></Field>
              <Field label="Heures/jour"><input type="number" className={inputCls} value={a.heures} onChange={(e) => majAppareil(a.id, "heures", e.target.value)} /></Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={a.qte} onChange={(e) => majAppareil(a.id, "qte", e.target.value)} /></Field>
              <button onClick={() => retirerAppareil(a.id)} className="text-xs text-red-600 underline pb-2">Retirer</button>
            </div>
          ))}
        </div>
        <button onClick={ajouterAppareil} className="mt-2 text-sm font-bold text-sky-800 underline">➕ Ajouter un appareil</button>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Field label="Autonomie souhaitée (jours)"><input type="number" min="1" className={inputCls} value={autonomie} onChange={(e) => setAutonomie(e.target.value)} /></Field>
          <Field label="Ensoleillement (h/jour)"><input type="number" className={inputCls} value={soleil} onChange={(e) => setSoleil(e.target.value)} /></Field>
          <Field label="Tension du système">
            <select className={inputCls} value={tension} onChange={(e) => setTension(e.target.value)}>
              <option value="12">12 V</option><option value="24">24 V</option><option value="48">48 V</option>
            </select>
          </Field>
          <Field label="Type de batterie">
            <select className={inputCls} value={typeBatterie} onChange={(e) => setTypeBatterie(e.target.value)}>
              <option value="lifepo4">LiFePO4 (lithium)</option><option value="plomb">Plomb / AGM</option>
            </select>
          </Field>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Consommation</div>
          <div className="text-xl font-bold tabular-nums mt-1">{Math.round(whParJour)} Wh/j</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Panneaux nécessaires</div>
          <div className="text-xl font-bold tabular-nums mt-1">{wcPanneaux} Wc</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Batterie ({tension}V)</div>
          <div className="text-xl font-bold tabular-nums mt-1">{ahBatterie} Ah</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Convertisseur{!convertisseurEstHybride ? " / MPPT" : ""}</div>
          <div className="text-xl font-bold tabular-nums mt-1">{kwConvertisseur.toFixed(2)} kW{!convertisseurEstHybride ? ` · ${aRegulateur} A` : ""}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Équipements proposés (stock de {boutique})</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              if (l.role.id === "regulateur" && convertisseurEstHybride) {
                return (
                  <tr key={l.role.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{l.role.label}</td>
                    <td className="px-3 py-2 text-xs text-green-700">✓ Intégré au convertisseur hybride — pas d'article séparé nécessaire</td>
                    <td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td><td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400">{fmt(0)}</td>
                  </tr>
                );
              }
              const options = candidats(l.role);
              const besoinAffiche = l.role.id === "convertisseur" ? `${(besoinParRole[l.role.id] / 1000).toFixed(2)} kW` : `${besoinParRole[l.role.id]}${l.role.id === "regulateur" ? " A" : ""}`;
              const enManuel = manuelOuvert[l.role.id] || (l.produit?.manuel);
              return (
                <tr key={l.role.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{l.role.label}</td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.role.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.role.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.role.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.role.id)} className="text-xs text-slate-500 underline">Annuler (revenir à la sélection automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {options.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans le stock de {boutique}</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.role.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {options.map(({ p, spec }) => <option key={p.id} value={p.id}>{p.nom} ({spec.valeur >= 1000 ? (spec.valeur / 1000).toFixed(1) + "k" : spec.valeur}{spec.unite}){estHybrideTexte(p.nom) ? " — hybride" : ""}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.role.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{besoinAffiche}</td>
                  <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit} onChange={(e) => changerQte(l.role.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                </tr>
              );
            })}

            {/* Rails de fixation : quantité et prix calculés automatiquement */}
            <tr className="border-t border-slate-100 bg-amber-50/40">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">Rails de fixation</td>
              <td className="px-3 py-2 text-xs text-slate-500">Calculé automatiquement : {nombrePanneaux} panneaux × 2,2</td>
              <td className="px-3 py-2 text-slate-400">—</td>
              <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={railsQte} onChange={(e) => setRailsQte(Math.max(0, Number(e.target.value) || 0))} /></td>
              <td className="px-3 py-2 tabular-nums">{fmt(PRIX_RAIL)}</td>
              <td className="px-3 py-2 tabular-nums font-bold">{fmt(sousTotalRails)}</td>
            </tr>
          </tbody>
        </table>

        <BlocAutresEquipements
          titre="Autres équipements (câbles, protections AC/DC, accessoires…)"
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Câble 6mm² (rouleau)"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

// ============ SÉLECTEUR : Dimensionnement Solaire, Garage ou Autre ============
// Point d'entrée affiché dans l'onglet « Dimensionnement ». Un simple aiguillage
// entre les trois outils, qui partagent la même mécanique (besoins du
// client → équipements proposés depuis le stock → devis → envoi WhatsApp / vente).
function Dimensionnement({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const [mode, setMode] = useState("solaire");
  // Bascule automatiquement sur le bon outil dès qu'un devis à reprendre arrive.
  useEffect(() => {
    if (devisAReprendre) setMode(devisAReprendre.devis.type_devis === "garage" ? "garage" : devisAReprendre.devis.type_devis === "autre" ? "autre" : "solaire");
  }, [devisAReprendre]);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm">
        <button onClick={() => setMode("solaire")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "solaire" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>☀️ Solaire</button>
        <button onClick={() => setMode("garage")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "garage" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>🚪 Garage</button>
        <button onClick={() => setMode("autre")} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${mode === "autre" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50"}`}>📦 Autre</button>
      </div>
      {devisAReprendre && (
        <div className="rounded-xl p-3 bg-amber-50 border-2 border-amber-300 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-amber-900">
            <b>✏️ Reprise du devis de {devisAReprendre.client?.nom_base || devisAReprendre.client?.nom}</b> ({fmt(devisAReprendre.devis.total)})
            {devisAReprendre.devis.demande_modif && <span> — souhaite : « {devisAReprendre.devis.demande_modif} »</span>}
            {devisAReprendre.devis.motif_rejet && <span> — avait rejeté : « {devisAReprendre.devis.motif_rejet} »</span>}
          </div>
          <button onClick={onDevisRepriseConsomme} className="text-xs font-bold text-amber-700 underline whitespace-nowrap">Annuler la reprise</button>
        </div>
      )}
      {mode === "solaire" && <DimensionnementSolaire db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis !== "garage" && devisAReprendre?.devis?.type_devis !== "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
      {mode === "garage" && <DimensionnementGarage db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "garage" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
      {mode === "autre" && <DimensionnementAutre db={db} profile={profile} save={save} onConvertirEnVente={onConvertirEnVente} devisAReprendre={devisAReprendre?.devis?.type_devis === "autre" ? devisAReprendre : null} onDevisRepriseConsomme={onDevisRepriseConsomme} />}
    </div>
  );
}

// ============ OUTIL DE DIMENSIONNEMENT — PORTAIL / PORTE DE GARAGE MOTORISÉ ============
function DimensionnementGarage({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  // ---- Besoins du client ----
  // Si on reprend un devis (modification/rejet), on repart de ses besoins d'origine.
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [type, setType] = useState(besoinsRepris?.type_ouvrant || "portail_coulissant");
  const [largeur, setLargeur] = useState(besoinsRepris?.largeur ? String(besoinsRepris.largeur) : "");
  const [hauteur, setHauteur] = useState(besoinsRepris?.hauteur ? String(besoinsRepris.hauteur) : "");
  const [poids, setPoids] = useState(besoinsRepris?.poids ? String(besoinsRepris.poids) : "");
  const [vantaux, setVantaux] = useState(besoinsRepris?.vantaux ? String(besoinsRepris.vantaux) : "1");
  const [frequence, setFrequence] = useState(besoinsRepris?.frequence || "moyenne");
  const [telecosSouhaitees, setTelecosSouhaitees] = useState(besoinsRepris?.telecommandes != null ? String(besoinsRepris.telecommandes) : "2");
  const [alimentationProche, setAlimentationProche] = useState(besoinsRepris?.alimentation_proche != null ? besoinsRepris.alimentation_proche : true);

  const estCoulissant = type === "portail_coulissant";
  const estBattant = type === "portail_battant";

  // ---- Calculs de dimensionnement (indicatifs, avec marge de sécurité selon l'usage) ----
  const poidsAjuste = Math.ceil(Number(poids || 0) * (FACTEUR_FREQUENCE[frequence] || 1.25));
  const longueurCremaillere = estCoulissant && Number(largeur) > 0 ? Math.ceil(Number(largeur) + 1) : 0; // +1 m de marge

  // ---- Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable ----
  const [prixM2Porte, setPrixM2Porte] = useState(besoinsRepris?.prix_m2_porte || PRIX_PORTE_M2[type] || 0);
  const premierRenduPorte = useRef(true);
  useEffect(() => {
    if (premierRenduPorte.current) { premierRenduPorte.current = false; return; } // ne pas écraser la reprise au montage
    setPrixM2Porte(PRIX_PORTE_M2[type] || 0);
  }, [type]);
  const surfacePorte = Math.round(Number(largeur || 0) * Number(hauteur || 0) * 100) / 100;
  const sousTotalPorte = Math.round(surfacePorte * Number(prixM2Porte || 0));

  const besoinParRole = {
    moteur: poidsAjuste,
    cremaillere: longueurCremaillere,
    telecommande: Math.max(0, Number(telecosSouhaitees || 0)),
    cellule: 2,
    clignotant: 1,
    verrouillage_manuel: 1,
  };

  const roleActif = (role) => role.id !== "cremaillere" || estCoulissant;

  const candidats = (role) => produitsBoutique
    .map((p) => ({ p, spec: specDepuisNom(p.nom + " " + (p.categorie || "")) }))
    .filter(({ p, spec }) => {
      const texte = (p.nom + " " + (p.categorie || "")).toLowerCase();
      const motCorrespond = role.mots.some((m) => texte.includes(m));
      if (!motCorrespond) return false;
      if (role.unites.length === 0) return true; // accessoire compté à la pièce : pas de spec à vérifier
      return spec && role.unites.includes(spec.unite);
    });

  const empilable = (roleId) => roleId === "cremaillere"; // seule la crémaillère s'empile (barres de 1 m)

  const meilleurChoix = (role) => {
    if (!roleActif(role)) return null;
    const besoin = besoinParRole[role.id];
    const options = role.unites.length === 0
      ? candidats(role) // accessoires : pas de tri par capacité
      : candidats(role).sort((a, b) => a.spec.valeur - b.spec.valeur);
    if (options.length === 0 || besoin <= 0) return null;

    if (role.unites.length === 0) {
      // Accessoire à la pièce (télécommande, cellule, clignotant) : le premier article trouvé, quantité = besoin direct.
      return { type: "stock", produit_id: options[0].p.id, qte: Math.max(1, besoin) };
    }
    if (!empilable(role.id)) {
      const suffisant = options.find((o) => o.spec.valeur >= besoin);
      if (suffisant) return { type: "stock", produit_id: suffisant.p.id, qte: 1 };
      const plusGros = options[options.length - 1];
      return { type: "stock", produit_id: plusGros.p.id, qte: 1 };
    }
    const meilleur = options[options.length - 1];
    const qte = Math.min(50, Math.max(1, Math.ceil(besoin / meilleur.spec.valeur)));
    return { type: "stock", produit_id: meilleur.p.id, qte };
  };

  // Reconstruit les équipements déjà choisis depuis les lignes RÉELLES du devis
  // repris — restitue aussi ceux saisis directement à la main, sans quoi ils
  // disparaissaient à la reprise.
  const initialSelectionGarage = (() => {
    if (!lignesReprises.length || !devisAReprendre) return undefined;
    const choix = {}, verrous = {};
    ROLES_EQUIPEMENT_GARAGE.forEach((role) => {
      const ligne = lignesReprises.find((l) => l.categorie === role.label);
      if (!ligne) return;
      const options = candidats(role);
      const trouve = options.find((o) => o.p.nom === ligne.article);
      choix[role.id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(ligne.qte) || 1 }
        : { type: "manuel", nom: ligne.article, prix: Number(ligne.pu) || 0, qte: Number(ligne.qte) || 1 };
      verrous[role.id] = true;
    });
    return { choix, verrous };
  })();

  const {
    choix, manuelOuvert, brouillonManuel, setBrouillonManuel,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoix, initialSelectionGarage);

  useEffect(() => {
    recalculerNonVerrouilles(ROLES_EQUIPEMENT_GARAGE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, largeur, poids, frequence, telecosSouhaitees, boutique, db.produits]);

  const ligneRole = (role) => {
    const c = choix[role.id];
    if (!c) return { role, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { role, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { role, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { role, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = ROLES_EQUIPEMENT_GARAGE.filter(roleActif).map(ligneRole);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  const changerProduit = (roleId, produitId) => changerProduitBase(roleId, produitId, (pid) => {
    const role = ROLES_EQUIPEMENT_GARAGE.find((r) => r.id === roleId);
    const p = produitsBoutique.find((x) => x.id === pid);
    const spec = p ? specDepuisNom(p.nom + " " + (p.categorie || "")) : null;
    const besoin = besoinParRole[roleId];
    return role.unites.length === 0
      ? Math.max(1, besoin)
      : spec && spec.valeur > 0
      ? (!empilable(roleId) && spec.valeur >= besoin ? 1 : Math.min(50, Math.max(1, Math.ceil(besoin / spec.valeur))))
      : 1;
  });

  const ouvrirManuel = (roleId) => ouvrirManuelBase(roleId, { nom: "", prix: "", qte: "1" });


  // ---- Kit solaire autonome (si pas d'électricité à proximité) ----
  const ligneKitSolaire = lignesReprises.find((l) => l.article === "Kit solaire autonome (motorisation)");
  const [kitSolaire, setKitSolaire] = useState(!!ligneKitSolaire);
  const [prixKitSolaire, setPrixKitSolaire] = useState(ligneKitSolaire ? String(ligneKitSolaire.pu) : "");

  // ---- Batterie de secours (externe) : en option, cochée par le client ----
  const ligneBatterieSecours = lignesReprises.find((l) => l.article === "Batterie de secours (externe)");
  const [batterieSecours, setBatterieSecours] = useState(!!ligneBatterieSecours);
  const [prixBatterieSecours, setPrixBatterieSecours] = useState(ligneBatterieSecours ? String(ligneBatterieSecours.pu) : "");

  // ---- Autres équipements : coffret de commande, câblage… ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalKitSolaire = kitSolaire ? Number(prixKitSolaire || 0) : 0;
  const totalBatterieSecours = batterieSecours ? Number(prixBatterieSecours || 0) : 0;
  const totalArticles = totalRoles + totalAutres + totalKitSolaire + totalBatterieSecours + sousTotalPorte;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  const construirePanier = () => [
    ...(sousTotalPorte > 0 ? [{ produit_id: null, article: `Porte — ${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} (${surfacePorte} m²)`, qte: surfacePorte, pu: prixM2Porte }] : []),
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
    ...(kitSolaire && totalKitSolaire > 0 ? [{ produit_id: null, article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire }] : []),
    ...(batterieSecours && totalBatterieSecours > 0 ? [{ produit_id: null, article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours }] : []),
    ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
  ];

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : choisissez d'abord les équipements."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    const panier = construirePanier();

    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,
      statut: "propose",
      panier,
      boutique,
      type_devis: "garage",
      besoins: {
        type_ouvrant: type,
        largeur: Number(largeur || 0),
        hauteur: Number(hauteur || 0),
        surface_porte: surfacePorte,
        prix_m2_porte: Number(prixM2Porte || 0),
        poids: Number(poids || 0),
        poids_ajuste: poidsAjuste,
        vantaux: Number(vantaux || 1),
        frequence,
        telecommandes: Number(telecosSouhaitees || 0),
        alimentation_proche: alimentationProche,
      },
      lignes: [
        ...(sousTotalPorte > 0 ? [{ categorie: "Porte", article: `Porte — ${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} (${surfacePorte} m²)`, qte: surfacePorte, pu: prixM2Porte, total: sousTotalPorte }] : []),
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: l.role.label, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...(kitSolaire && totalKitSolaire > 0 ? [{ categorie: "Alimentation", article: "Kit solaire autonome (motorisation)", qte: 1, pu: totalKitSolaire, total: totalKitSolaire }] : []),
        ...(batterieSecours && totalBatterieSecours > 0 ? [{ categorie: "Alimentation", article: "Batterie de secours (externe)", qte: 1, pu: totalBatterieSecours, total: totalBatterieSecours }] : []),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [
        `🚪 Motorisation de portail/garage — *${fmt(totalDevis)}*`,
        `${TYPES_PORTAIL.find((t) => t.id === type)?.label || ""}${Number(largeur) > 0 ? ` · ${largeur} m` : ""}${Number(poids) > 0 ? ` · ${poids} kg` : ""}`,
      ],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = construirePanier();
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">🚪 Besoins du client <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Type d'installation">
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES_PORTAIL.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Largeur à motoriser (m)"><input type="number" min="0" step="0.1" className={inputCls} value={largeur} onChange={(e) => setLargeur(e.target.value)} /></Field>
          <Field label="Hauteur (m)"><input type="number" min="0" step="0.1" className={inputCls} value={hauteur} onChange={(e) => setHauteur(e.target.value)} /></Field>
          <Field label="Poids du vantail / de la porte (kg)"><input type="number" min="0" className={inputCls} value={poids} onChange={(e) => setPoids(e.target.value)} /></Field>
          {estBattant && (
            <Field label="Nombre de vantaux">
              <select className={inputCls} value={vantaux} onChange={(e) => setVantaux(e.target.value)}>
                <option value="1">1 (portillon / vantail unique)</option><option value="2">2 (double vantail)</option>
              </select>
            </Field>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Field label="Fréquence d'usage quotidienne">
            <select className={inputCls} value={frequence} onChange={(e) => setFrequence(e.target.value)}>
              {Object.entries(LABEL_FREQUENCE).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="Télécommandes souhaitées"><input type="number" min="0" className={inputCls} value={telecosSouhaitees} onChange={(e) => setTelecosSouhaitees(e.target.value)} /></Field>
          <Field label="Électricité disponible à proximité ?">
            <select className={inputCls} value={alimentationProche ? "oui" : "non"} onChange={(e) => setAlimentationProche(e.target.value === "oui")}>
              <option value="oui">Oui</option><option value="non">Non — prévoir une alimentation autonome</option>
            </select>
          </Field>
        </div>
      </Panel>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Poids à motoriser</div>
          <div className="text-xl font-bold tabular-nums mt-1">{poidsAjuste} kg</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Catégorie de moteur</div>
          <div className="text-base font-bold mt-1.5">{categorieMoteur(poidsAjuste)}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Crémaillère</div>
          <div className="text-xl font-bold tabular-nums mt-1">{estCoulissant ? `${longueurCremaillere} m` : "— (non requise)"}</div>
        </div>
        <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <div className="text-xs font-semibold text-slate-500 uppercase">Télécommandes</div>
          <div className="text-xl font-bold tabular-nums mt-1">× {besoinParRole.telecommande}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Équipements proposés (stock de {boutique})</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Catégorie", "Article", "Besoin calculé", "Quantité", "Prix unit.", "Sous-total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {/* Porte / portail : calculée automatiquement au m² (largeur × hauteur), prix modifiable */}
            <tr className="border-t border-slate-100 bg-amber-50/40">
              <td className="px-3 py-2 font-semibold whitespace-nowrap">Porte</td>
              <td className="px-3 py-2 text-xs text-slate-500">{TYPES_PORTAIL.find((t) => t.id === type)?.label || ""} — {Number(largeur || 0)} m × {Number(hauteur || 0)} m</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{surfacePorte} m²</td>
              <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-28`} value={prixM2Porte} onChange={(e) => setPrixM2Porte(Math.max(0, Number(e.target.value) || 0))} /></td>
              <td className="px-3 py-2 tabular-nums font-bold">{fmt(sousTotalPorte)}</td>
            </tr>
            {lignesDevis.map((l) => {
              const options = candidats(l.role);
              const besoinAffiche = l.role.id === "moteur" ? `${besoinParRole.moteur} kg` : l.role.id === "cremaillere" ? `${besoinParRole.cremaillere} m` : `× ${besoinParRole[l.role.id]}`;
              const enManuel = manuelOuvert[l.role.id] || (l.produit?.manuel);
              return (
                <tr key={l.role.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{l.role.label}</td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.role.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.role.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.role.id]: { ...(brouillonManuel[l.role.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.role.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.role.id, l.role)} className="text-xs text-slate-500 underline">Annuler (revenir à la sélection automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {options.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans le stock de {boutique}</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.role.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {options.map(({ p, spec }) => <option key={p.id} value={p.id}>{p.nom}{spec ? ` (${spec.valeur}${spec.unite})` : ""}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.role.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-500 whitespace-nowrap">{besoinAffiche}</td>
                  <td className="px-3 py-2"><input type="number" min="0" className={`${inputCls} w-20`} value={l.qte} disabled={!l.produit} onChange={(e) => changerQte(l.role.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Kit solaire autonome : proposé si pas d'électricité à proximité */}
        <div className="px-4 py-3 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={kitSolaire} onChange={(e) => setKitSolaire(e.target.checked)} />
            ☀️ Ajouter un kit solaire autonome pour la motorisation {!alimentationProche && <span className="text-amber-600 font-normal">(recommandé — pas d'électricité à proximité)</span>}
          </label>
          {kitSolaire && (
            <div className="mt-2 max-w-xs">
              <Field label="Prix du kit solaire (F)"><input type="number" min="0" className={inputCls} value={prixKitSolaire} onChange={(e) => setPrixKitSolaire(e.target.value)} /></Field>
            </div>
          )}
        </div>

        {/* Batterie de secours (externe) : en option */}
        <div className="px-4 py-3 border-t border-slate-200">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={batterieSecours} onChange={(e) => setBatterieSecours(e.target.checked)} />
            🔋 Ajouter une batterie de secours (externe)
          </label>
          {batterieSecours && (
            <div className="mt-2 max-w-xs">
              <Field label="Prix de la batterie de secours (F)"><input type="number" min="0" className={inputCls} value={prixBatterieSecours} onChange={(e) => setPrixBatterieSecours(e.target.value)} /></Field>
            </div>
          )}
        </div>

        <BlocAutresEquipements
          titre="Autres équipements (coffret de commande, câblage…)"
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Coffret de commande"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

// ============ RECHERCHE DE CORRESPONDANCE (Autre dimensionnement) ============
// Contrairement au solaire/garage (caractéristique numérique extraite du nom),
// ici on compare le besoin décrit par le vendeur au nom des articles de la
// catégorie choisie, par ressemblance textuelle (accents/casse ignorés).
function correspondancesBesoin(nomBesoin, produits) {
  const cible = normNom(nomBesoin);
  if (!cible) return [];
  const motsCible = cible.split(" ").filter((m) => m.length >= 3);
  return produits
    .map((p) => {
      const nomP = normNom(p.nom);
      let score = 0;
      if (nomP === cible) score += 20;
      else if (nomP.includes(cible) || cible.includes(nomP)) score += 10;
      for (const mot of motsCible) if (nomP.includes(mot)) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ============ OUTIL DE DIMENSIONNEMENT — AUTRE (par catégorie de produit) ============
// Le vendeur choisit une catégorie déjà utilisée dans la gestion de stock, décrit
// les besoins du client au fil de l'eau, et l'article correspondant se propose
// automatiquement depuis le stock de cette catégorie — saisie manuelle sinon.
function DimensionnementAutre({ db, profile, save, onConvertirEnVente, devisAReprendre, onDevisRepriseConsomme }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);

  const categories = [...new Set(produitsBoutique.map((p) => p.categorie || "Autre"))].sort();
  const besoinsRepris = devisAReprendre?.devis?.besoins;
  const lignesReprises = devisAReprendre?.devis?.lignes || [];
  const [categorieChoisie, setCategorieChoisie] = useState(besoinsRepris?.categorie || "");
  useEffect(() => { if (!categorieChoisie && categories.length > 0) setCategorieChoisie(categories[0]); }, [categories.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  const produitsCategorie = produitsBoutique.filter((p) => (p.categorie || "Autre") === categorieChoisie);

  // ---- Besoins du client : liste libre, remplie au fil de l'eau ----
  // Si on reprend un devis (modification/rejet), on repart des lignes RÉELLES du
  // devis d'origine (et non de la simple liste de recherche) : ça restitue aussi
  // les articles qui avaient été saisis directement à la main, sans jamais passer
  // par le champ de recherche — sinon ils disparaissaient purement et simplement.
  const lignesCategorie = besoinsRepris ? lignesReprises.filter((l) => l.categorie === besoinsRepris.categorie) : [];
  // Reconstruit besoins + choix/verrous à partir des mêmes lignes, en tentant de
  // retrouver l'article correspondant en stock — sinon on restitue le prix d'origine tel quel.
  const initialSelection = (() => {
    if (!lignesCategorie.length) return undefined;
    const choix = {}, verrous = {}, besoinsInit = [];
    lignesCategorie.forEach((l) => {
      const id = uid();
      besoinsInit.push({ id, nom: l.article, qte: String(l.qte) });
      const matches = correspondancesBesoin(l.article, produitsCategorie);
      const trouve = matches.find((m) => m.p.nom === l.article) || matches[0];
      choix[id] = trouve
        ? { type: "stock", produit_id: trouve.p.id, qte: Number(l.qte) || 1 }
        : { type: "manuel", nom: l.article, prix: Number(l.pu) || 0, qte: Number(l.qte) || 1 };
      verrous[id] = true;
    });
    return { choix, verrous, besoinsInit };
  })();
  const [besoins, setBesoins] = useState(() => initialSelection?.besoinsInit || [{ id: uid(), nom: "", qte: "1" }]);

  const meilleurChoixBesoin = (besoin) => {
    if (!besoin || !besoin.nom || !besoin.nom.trim()) return null;
    const matches = correspondancesBesoin(besoin.nom, produitsCategorie);
    if (matches.length === 0) return null;
    return { type: "stock", produit_id: matches[0].p.id, qte: Math.max(1, Number(besoin.qte) || 1) };
  };

  const {
    choix, setChoix, manuelOuvert, brouillonManuel, setBrouillonManuel, verrous: besoinsManuels,
    recalculerNonVerrouilles, changerProduit: changerProduitBase, changerQte: changerQteChoix,
    ouvrirManuel: ouvrirManuelBase, validerManuel, annulerManuel,
  } = useSelectionAvecVerrou(meilleurChoixBesoin, initialSelection);

  const changerProduit = (besoinId, produitId) => changerProduitBase(besoinId, produitId, () => {
    const besoin = besoins.find((b) => b.id === besoinId);
    return Math.max(1, Number(besoin?.qte) || 1);
  });

  // Recalcule les besoins non verrouillés quand la catégorie ou le stock changent.
  useEffect(() => {
    recalculerNonVerrouilles(besoins);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorieChoisie, boutique, db.produits]);

  const ajouterBesoin = () => setBesoins([...besoins, { id: uid(), nom: "", qte: "1" }]);

  const majBesoinNom = (id, nom) => {
    const suivant = besoins.map((b) => (b.id === id ? { ...b, nom } : b));
    setBesoins(suivant);
    if (!besoinsManuels[id]) {
      const c = meilleurChoixBesoin(suivant.find((b) => b.id === id));
      setChoix((avant) => { const n = { ...avant }; if (c) n[id] = c; else delete n[id]; return n; });
    }
  };

  const majBesoinQte = (id, qte) => {
    setBesoins(besoins.map((b) => (b.id === id ? { ...b, qte } : b)));
    changerQteChoix(id, qte);
  };

  const retirerBesoin = (id) => {
    setBesoins(besoins.filter((b) => b.id !== id));
    setChoix((avant) => { const n = { ...avant }; delete n[id]; return n; });
  };

  const ouvrirManuel = (besoinId) => {
    const besoin = besoins.find((b) => b.id === besoinId);
    ouvrirManuelBase(besoinId, { nom: besoin?.nom || "", prix: "", qte: besoin?.qte || "1" });
  };


  const ligneBesoin = (besoin) => {
    const c = choix[besoin.id];
    if (!c) return { besoin, produit: null, qte: 0, sousTotal: 0 };
    if (c.type === "manuel") return { besoin, produit: { nom: c.nom, prix_vente: c.prix, manuel: true }, qte: c.qte, sousTotal: c.prix * c.qte };
    const p = produitsBoutique.find((x) => x.id === c.produit_id);
    return p ? { besoin, produit: p, qte: c.qte, sousTotal: p.prix_vente * c.qte } : { besoin, produit: null, qte: 0, sousTotal: 0 };
  };

  const lignesDevis = besoins.map(ligneBesoin);
  const totalRoles = lignesDevis.reduce((s, l) => s + l.sousTotal, 0);

  // ---- Autres équipements : hors de la catégorie choisie ----
  const [autres, setAutres] = useState(() =>
    lignesReprises.filter((l) => l.categorie === "Autres équipements")
      .map((l) => ({ id: uid(), nom: l.article, prix: String(l.pu), qte: String(l.qte) }))
  );
  const ajouterAutre = () => setAutres([...autres, { id: uid(), nom: "", prix: "", qte: "1" }]);
  const majAutre = (id, champ, val) => setAutres(autres.map((a) => (a.id === id ? { ...a, [champ]: val } : a)));
  const retirerAutre = (id) => setAutres(autres.filter((a) => a.id !== id));
  const totalAutres = autres.reduce((s, a) => s + Number(a.prix || 0) * Number(a.qte || 1), 0);

  const totalArticles = totalRoles + totalAutres;
  const { pctRemise, setPctRemise, remise, pctInstall, setPctInstall, fraisInstallation, pctTransport, setPctTransport, fraisTransport, totalDevis } = useTotauxDevis(totalArticles);

  const construirePanier = () => [
    ...lignesDevis.filter((l) => l.produit).map((l) => ({ produit_id: l.produit.manuel ? null : l.produit.id, article: l.produit.nom, qte: l.qte, pu: l.produit.prix_vente })),
    ...autres.filter((a) => a.nom.trim() && a.prix).map((a) => ({ produit_id: null, article: a.nom.trim(), qte: Number(a.qte || 1), pu: Number(a.prix) })),
  ];

  // ============ ENVOYER LE DEVIS DANS L'ESPACE DU CLIENT ============
  const [clientDevis, setClientDevis] = useState(() => devisAReprendre?.client?.id || "");
  const [nouvClient, setNouvClient] = useState({ nom: "", tel: "" });
  const comptesClients = db.users.filter((u) => u.role === "client" && u.actif !== false);

  const envoyerDevisWhatsApp = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (totalDevis <= 0) { uAlert("Le devis est vide : décrivez d'abord les besoins du client."); return; }

    const resolu = await resoudreClientDevis(db, clientDevis, nouvClient, profile);
    if (!resolu) return;
    const { compte, motDePasse, dbApres } = resolu;

    const panier = construirePanier();

    const devis = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      par: profile.nom,
      par_id: profile.id,
      par_role: profile.role,
      statut: "propose",
      panier,
      boutique,
      type_devis: "autre",
      besoins: {
        categorie: categorieChoisie,
        articles_demandes: besoins.filter((b) => b.nom.trim()).map((b) => ({ nom: b.nom.trim(), qte: Number(b.qte || 1) })),
      },
      lignes: [
        ...lignesDevis.filter((l) => l.produit).map((l) => ({
          categorie: categorieChoisie, article: l.produit.nom, qte: l.qte,
          pu: l.produit.prix_vente, total: l.sousTotal,
        })),
        ...autres.filter((a) => a.nom).map((a) => ({
          categorie: "Autres équipements", article: a.nom, qte: Number(a.qte || 1),
          pu: Number(a.prix || 0), total: Number(a.prix || 0) * Number(a.qte || 1),
        })),
        ...(fraisInstallation > 0 ? [{ categorie: "Installation", article: `Frais d'installation (${pctInstall} %)`, qte: 1, pu: fraisInstallation, total: fraisInstallation }] : []),
        ...(fraisTransport > 0 ? [{ categorie: "Transport", article: `Transport / livraison (${pctTransport} %)`, qte: 1, pu: fraisTransport, total: fraisTransport }] : []),
        ...(remise > 0 ? [{ categorie: "Remise", article: `Remise (${pctRemise} %)`, qte: 1, pu: -remise, total: -remise }] : []),
      ],
      total: totalDevis,
      frais_installation: fraisInstallation,
      pct_installation: Number(pctInstall || 0),
      frais_transport: fraisTransport,
      pct_transport: Number(pctTransport || 0),
      remise,
      pct_remise: Number(pctRemise || 0),
    };

    envoyerDevisEtOuvrirWhatsApp({
      dbApres, compte, motDePasse, devis, save, profile, nouvClient,
      ligneEntete: [`📦 ${categorieChoisie} — *${fmt(totalDevis)}*`],
      idAReprendre: devisAReprendre?.devis?.id,
    });

    setClientDevis("");
    setNouvClient({ nom: "", tel: "" });
    if (devisAReprendre && onDevisRepriseConsomme) onDevisRepriseConsomme();
    uAlert(`✅ Devis envoyé dans l'espace de ${compte.nom}.\n\nWhatsApp s'ouvre avec ses identifiants et le lien.`);
  };


  const convertir = () => {
    const panier = construirePanier();
    if (panier.length === 0) { uAlert("Aucun équipement sélectionné à convertir."); return; }
    onConvertirEnVente(boutique, panier, Number(pctRemise || 0));
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3">📦 Catégorie de produit <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Catégorie (celles déjà en stock, ou saisissez-en une nouvelle)">
            <input
              className={inputCls}
              list="liste-categories-autre"
              placeholder="Ex : Interphonie, Climatisation…"
              value={categorieChoisie}
              onChange={(e) => setCategorieChoisie(e.target.value)}
            />
            <datalist id="liste-categories-autre">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            {categories.length === 0 && (
              <div className="text-xs text-orange-600 mt-1">Aucune catégorie trouvée dans le stock de {boutique} — vous pouvez quand même en saisir une, la recherche d'articles se fera dessus si des articles portent déjà cette catégorie.</div>
            )}
          </Field>
        </div>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Besoins du client → articles (stock « {categorieChoisie || "—"} » de {boutique})</div>
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Besoin du client", "Article proposé", "Quantité", "Prix unit.", "Sous-total", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {lignesDevis.map((l) => {
              const matches = correspondancesBesoin(l.besoin.nom, produitsCategorie);
              const enManuel = manuelOuvert[l.besoin.id] || (l.produit?.manuel);
              return (
                <tr key={l.besoin.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <input
                      className={`${inputCls} w-48`}
                      list={`liste-${categorieChoisie}`}
                      placeholder="Ex : Caméra extérieure"
                      value={l.besoin.nom}
                      onChange={(e) => majBesoinNom(l.besoin.id, e.target.value)}
                    />
                    <datalist id={`liste-${categorieChoisie}`}>{produitsCategorie.map((p) => <option key={p.id} value={p.nom} />)}</datalist>
                  </td>
                  <td className="px-3 py-2">
                    {enManuel ? (
                      <div className="flex flex-wrap gap-2 items-center">
                        <input className={`${inputCls} w-40`} placeholder="Nom de l'article" value={brouillonManuel[l.besoin.id]?.nom ?? l.produit?.nom ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.besoin.id]: { ...(brouillonManuel[l.besoin.id] || { qte: "1" }), nom: e.target.value } })} />
                        <input type="number" className={`${inputCls} w-24`} placeholder="Prix (F)" value={brouillonManuel[l.besoin.id]?.prix ?? l.produit?.prix_vente ?? ""} onChange={(e) => setBrouillonManuel({ ...brouillonManuel, [l.besoin.id]: { ...(brouillonManuel[l.besoin.id] || { nom: l.produit?.nom || "" }), prix: e.target.value } })} />
                        <button onClick={() => validerManuel(l.besoin.id)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">Valider</button>
                        <button onClick={() => annulerManuel(l.besoin.id, l.besoin)} className="text-xs text-slate-500 underline">Annuler (revenir à la recherche automatique)</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {!l.besoin.nom.trim() ? (
                          <span className="text-xs text-slate-400">Décrivez le besoin à gauche…</span>
                        ) : matches.length === 0 ? (
                          <span className="text-xs text-orange-600">Aucun article correspondant dans « {categorieChoisie} »</span>
                        ) : (
                          <select className={inputCls} value={l.produit && !l.produit.manuel ? l.produit.id : ""} onChange={(e) => changerProduit(l.besoin.id, e.target.value)}>
                            <option value="">— Aucun —</option>
                            {matches.map(({ p }) => <option key={p.id} value={p.id}>{p.nom}</option>)}
                          </select>
                        )}
                        <button onClick={() => ouvrirManuel(l.besoin.id)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">✏️ Saisir un article hors stock</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2"><input type="number" min="1" className={`${inputCls} w-20`} value={l.besoin.qte} onChange={(e) => majBesoinQte(l.besoin.id, e.target.value)} /></td>
                  <td className="px-3 py-2 tabular-nums">{l.produit ? fmt(l.produit.prix_vente) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.sousTotal)}</td>
                  <td className="px-3 py-2"><button onClick={() => retirerBesoin(l.besoin.id)} className="text-xs text-red-600 underline whitespace-nowrap">Retirer</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-slate-200">
          <button onClick={ajouterBesoin} className="text-sm font-bold text-sky-800 underline">➕ Ajouter un besoin</button>
        </div>

        <BlocAutresEquipements
          titre={`Autres équipements (hors catégorie « ${categorieChoisie} »)`}
          autres={autres} onAjouter={ajouterAutre} onModifier={majAutre} onRetirer={retirerAutre}
          placeholder="Ex : Câblage"
        />

        <BlocTotauxDevis
          totalArticles={totalArticles}
          pctRemise={pctRemise} setPctRemise={setPctRemise} remise={remise}
          pctInstall={pctInstall} setPctInstall={setPctInstall} fraisInstallation={fraisInstallation}
          pctTransport={pctTransport} setPctTransport={setPctTransport} fraisTransport={fraisTransport}
          totalDevis={totalDevis} onConvertir={convertir}
        />
      </div>

      {/* ---- ENVOYER LE DEVIS AU CLIENT ---- */}
      <BlocEnvoiDevisClient
        db={db} clientDevis={clientDevis} setClientDevis={setClientDevis}
        nouvClient={nouvClient} setNouvClient={setNouvClient}
        comptesClients={comptesClients} onEnvoyer={envoyerDevisWhatsApp}
      />


      {noteDimensionnement(db) && (
        <div className="text-xs text-slate-400 whitespace-pre-line">
          {noteDimensionnement(db)}
        </div>
      )}
    </div>
  );
}

// ============ TOUS LES DEVIS (admin, responsable commercial, élaborateur) ============
function libelleTypeDevis(d) {
  if (d.type_devis === "garage") return "🚪 Garage";
  if (d.type_devis === "autre") return `📦 ${d.besoins?.categorie || "Autre"}`;
  return "☀️ Solaire";
}

const STATUT_DEVIS = {
  propose: ["⏳ Proposé", "bg-amber-100 text-amber-800 border-amber-300"],
  valide: ["✅ Validé", "bg-sky-100 text-sky-800 border-sky-300"],
  paye: ["💰 Payé", "bg-green-100 text-green-800 border-green-300"],
  modification: ["✏️ Modification demandée", "bg-purple-100 text-purple-800 border-purple-300"],
  rejete: ["❌ Rejeté", "bg-red-100 text-red-800 border-red-300"],
};
const BadgeStatutDevis = ({ statut }) => {
  const [label, cls] = STATUT_DEVIS[statut || "propose"] || STATUT_DEVIS.propose;
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
};

// Nombre de jours écoulés depuis la date du devis (chaîne "AAAA-MM-JJ").
function joursDepuis(dateStr) {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
const SEUIL_RELANCE_JOURS = 15;

function TousLesDevis({ db, save, profile, onModifierDevis }) {
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial";

  const tousDevis = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter((d) => voitTout || d.par_id === profile.id)
    .sort((a, b) => `${b.date} ${b.heure || ""}`.localeCompare(`${a.date} ${a.heure || ""}`));

  const [ouvert, setOuvert] = useState(null);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [recherche, setRecherche] = useState("");
  const [relanceSeule, setRelanceSeule] = useState(false);

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

  const enAttenteDeRelance = (d) => (d.statut || "propose") === "propose" && joursDepuis(d.date) >= SEUIL_RELANCE_JOURS;
  const nbARelancer = tousDevis.filter(enAttenteDeRelance).length;

  const devisFiltres = tousDevis.filter((d) => {
    if (relanceSeule && !enAttenteDeRelance(d)) return false;
    if (filtreStatut && (d.statut || "propose") !== filtreStatut) return false;
    if (filtreType && (d.type_devis || "solaire") !== filtreType) return false;
    if (recherche) {
      const texte = normNom(`${d.client?.nom_base || d.client?.nom || ""} ${d.par || ""}`);
      if (!texte.includes(normNom(recherche))) return false;
    }
    return true;
  });

  const telechargerPDF = (d) => {
    genererDevis({
      numero: d.id.slice(0, 8).toUpperCase(),
      date: dFR(d.date),
      boutique: d.boutique,
      client: d.client?.nom_base || d.client?.nom || "—",
      tel: d.client?.tel || "",
      titre: libelleTypeDevis(d).replace(/^\S+\s/, ""),
      statut: (STATUT_DEVIS[d.statut || "propose"] || STATUT_DEVIS.propose)[0].replace(/^\S+\s/, ""),
      par: d.par,
      lignes: d.lignes || [],
      total: d.total,
    }, LOGO);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="font-bold text-slate-800 mb-3">📋 Tous les devis {voitTout ? "" : "— les vôtres"}</div>
        {nbARelancer > 0 && (
          <button onClick={() => setRelanceSeule((v) => !v)} className={`mb-3 w-full text-left rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${relanceSeule ? "bg-amber-100 border-amber-400 text-amber-900" : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"}`}>
            ⚠️ {nbARelancer} devis proposé{nbARelancer > 1 ? "s" : ""} depuis plus de {SEUIL_RELANCE_JOURS} jours sans réponse — {relanceSeule ? "voir tous les devis" : "voir uniquement ceux-ci"}
          </button>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input className={inputCls} placeholder="Rechercher un client ou un vendeur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select className={inputCls} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="solaire">☀️ Solaire</option>
            <option value="garage">🚪 Garage</option>
            <option value="autre">📦 Autre</option>
          </select>
          <select className={inputCls} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
            <option value="">Tous les statuts</option>
            <option value="propose">⏳ Proposé</option>
            <option value="valide">✅ Validé</option>
            <option value="paye">💰 Payé</option>
            <option value="modification">✏️ Modification demandée</option>
            <option value="rejete">❌ Rejeté</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {devisFiltres.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">Aucun devis{voitTout ? "" : " établi par vous"} pour l'instant.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {devisFiltres.map((d) => (
              <div key={d.id}>
                <button onClick={() => ouvrirDevis(d)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-slate-50 flex-wrap">
                  <span className="flex-1 min-w-[180px]">
                    <span className="font-bold text-slate-800">{d.client?.nom_base || d.client?.nom || "Client"}</span>
                    <span className="text-xs text-slate-500 ml-2">{libelleTypeDevis(d)}</span>
                    <span className="block text-xs text-slate-400">Le {dFR(d.date)} par {d.par} — {d.boutique}</span>
                  </span>
                  {!(d.vu_par || []).includes(profile.id) && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" title="Nouveau — pas encore ouvert"></span>
                  )}
                  <span className="font-bold text-sky-800 whitespace-nowrap">{fmt(d.total)}</span>
                  {enAttenteDeRelance(d) && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full border whitespace-nowrap bg-red-50 text-red-700 border-red-300" title="Devis proposé sans réponse depuis longtemps">
                      ⚠️ En attente depuis {joursDepuis(d.date)} j
                    </span>
                  )}
                  <BadgeStatutDevis statut={d.statut} />
                  <span className="text-sm text-slate-400">{ouvert === d.id ? "▾" : "▸"}</span>
                </button>
                {ouvert === d.id && (
                  <div className="px-4 pb-4 bg-slate-50">
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
                            <td className="px-2 py-1 text-right">{l.qte}</td>
                            <td className="px-2 py-1 text-right">{fmt(l.pu)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmt(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mt-3 gap-2">
                      {(d.statut === "modification" || d.statut === "rejete") && onModifierDevis && (
                        <button onClick={() => onModifierDevis(d, d.client)} className="text-xs font-bold text-white bg-amber-600 rounded-lg px-3 py-1.5 hover:bg-amber-700">✏️ Modifier et renvoyer</button>
                      )}
                      <button onClick={() => telechargerPDF(d)} className="text-xs font-bold text-white bg-sky-800 rounded-lg px-3 py-1.5">📄 PDF (télécharger / imprimer)</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ CARTE (sélection de position — OpenStreetMap/Leaflet) ============
let leafletChargement = null;
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletChargement) return leafletChargement;
  leafletChargement = new Promise((resolve, reject) => {
    const lien = document.createElement("link");
    lien.rel = "stylesheet";
    lien.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(lien);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Impossible de charger la carte (vérifiez la connexion internet)."));
    document.head.appendChild(script);
  });
  return leafletChargement;
}

// Centre par défaut : Lomé, Togo
const LOME = [6.1319, 1.2228];

function CarteChoixPosition({ lat, lng, onChoisir }) {
  const conteneurRef = useRef(null);
  const mapRef = useRef(null);
  const marqueurRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    chargerLeaflet()
      .then((L) => {
        if (annule || !conteneurRef.current || mapRef.current) return;
        const depart = lat && lng ? [lat, lng] : LOME;
        const map = L.map(conteneurRef.current).setView(depart, lat && lng ? 15 : 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        const marqueur = L.marker(depart, { draggable: true }).addTo(map);
        marqueur.on("dragend", () => { const p = marqueur.getLatLng(); onChoisir(p.lat, p.lng); });
        map.on("click", (e) => { marqueur.setLatLng(e.latlng); onChoisir(e.latlng.lat, e.latlng.lng); });
        mapRef.current = map;
        marqueurRef.current = marqueur;
        setPret(true);
      })
      .catch((e) => setErreur(e.message));
    return () => {
      annule = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maPosition = () => {
    if (!navigator.geolocation) { uAlert("La géolocalisation n'est pas disponible sur cet appareil."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChoisir(latitude, longitude);
        if (mapRef.current && marqueurRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          marqueurRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => uAlert("Impossible de récupérer votre position. Vérifiez que la localisation est activée."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs text-slate-500">Cliquez sur la carte, ou faites glisser le repère, pour indiquer la maison du prospect.</span>
        <button type="button" onClick={maPosition} className="text-xs font-bold text-sky-800 underline whitespace-nowrap ml-2">📍 Ma position actuelle</button>
      </div>
      {erreur && <div className="p-3 text-sm text-red-600">{erreur}</div>}
      <div ref={conteneurRef} style={{ height: 260 }} className={pret ? "" : "flex items-center justify-center bg-slate-50 text-slate-400 text-sm"}>
        {!pret && !erreur && "Chargement de la carte…"}
      </div>
      {lat && lng && <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">Position choisie : {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>}
    </div>
  );
}

// ============ PROSPECTS (rôle Commercial + vue Admin) ============
function Prospects({ db, save, profile, isAdmin }) {
  const estChef = !!profile.chef_equipe;
  const voitTout = isAdmin || estChef || profile.role === "resp_commercial";
  const categories = db.categories_prospects.filter((c) => c.actif !== false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const vide = { categorie: categories[0]?.nom || "", localisation: "", nom: "", tel: "", nature: "", statut: "Favorable", interet: "Intéressé", relance: "", lat: null, lng: null };
  const [f, setF] = useState(vide);
  const [carteOuverte, setCarteOuverte] = useState(false);
  const [filtreRelance, setFiltreRelance] = useState(false);
  const [q, setQ] = useState("");

  // ---- Gestion des catégories (Admin uniquement) ----
  const ajouterCategorie = () => {
    if (!nouvelleCat.trim()) return;
    if (db.categories_prospects.some((c) => c.nom.toLowerCase() === nouvelleCat.trim().toLowerCase())) { uAlert("Cette catégorie existe déjà."); return; }
    save({ ...db, categories_prospects: [...db.categories_prospects, { id: uid(), nom: nouvelleCat.trim(), actif: true }] }, `Nouvelle catégorie de prospect : ${nouvelleCat.trim()}`);
    setNouvelleCat("");
  };
  const supprimerCategorie = async (c) => {
    if (await uConfirm(`Supprimer la catégorie « ${c.nom} » ? Les prospects déjà enregistrés avec cette catégorie la garderont en texte.`)) {
      save({ ...db, categories_prospects: db.categories_prospects.filter((x) => x.id !== c.id) }, `Suppression catégorie de prospect : ${c.nom}`);
    }
  };

  // ---- Enregistrement d'un prospect ----
  const ajouter = () => {
    if (!f.nom.trim() || !f.tel.trim()) { uAlert("Le nom et le numéro du prospect sont obligatoires."); return; }
    const p = { id: uid(), date: today(), maj_le: today(), commercial: profile.nom, ...f };
    save({ ...db, prospects: [p, ...db.prospects] }, `Nouveau prospect « ${f.nom} » (${f.categorie}) — ${profile.nom}`);
    setF(vide);
    setCarteOuverte(false);
  };

  const supprimer = async (p) => {
    if (await uConfirm(`Supprimer le prospect « ${p.nom} » ?`)) {
      save({ ...db, prospects: db.prospects.filter((x) => x.id !== p.id) }, `Suppression prospect « ${p.nom} »`);
    }
  };

  // ---- « JE L'AI CONTACTÉ » ----
  // Sans ce bouton, la détection des dormants serait FAUSSE : un commercial qui
  // appelle un prospect ne laisse aucune trace, et le prospect finirait par
  // paraître mort alors qu'il est activement suivi.
  const contacte = async (p) => {
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

  // ---- ARCHIVER (sans supprimer) ----
  // Le motif est obligatoire : sans lui, l'archivage ne vous apprend rien.
  // Au bout d'un an, ces motifs vous diront POURQUOI vos prospects meurent.
  const MOTIFS_ARCHIVE = ["Ne répond plus", "Trop cher", "A choisi un concurrent", "Projet abandonné", "Reporté à plus tard", "Autre"];
  // Convertir un prospect en client — SEULEMENT quand il a dit oui. Crée le
  // compte (règle d'identifiants automatique) et envoie ses accès par WhatsApp.
  const convertirEnClient = async (p) => {
    if (bloquerSiLecture(db, profile)) return;
    if (chiffresTel(p.tel).length < 4) { uAlert("Ce prospect n'a pas de numéro valide : impossible de créer son compte."); return; }

    // Déjà un compte pour ce numéro ? On ne recrée pas.
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && chiffresTel(u.tel) === chiffresTel(p.tel));
    if (existant) {
      uAlert(`Un compte client existe déjà pour ce numéro (${existant.nom}).\n\nRien n'a été recréé.`);
      return;
    }

    const identifiant = identifiantClient(db, p.nom, p.tel);
    const motDePasse = motDePasseClient(p.nom, p.tel);
    if (!await uConfirm(
      `Convertir « ${p.nom} » en client ?\n\n` +
      `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
      `Un compte sera créé et ses identifiants lui seront envoyés par WhatsApp.\n\nÀ ne faire que s'il a accepté de devenir client.`
    )) return;

    const { user } = await fabriquerCompteClient(db, p.nom, p.tel, profile.nom);
    // Le prospect est marqué converti (il sort de la file active) et lié au compte.
    save({
      ...db,
      users: [...db.users, user],
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, converti: true, statut: "Client acquis", client_user_id: user.id, date_conversion: today(), maj_le: today() }
        : x)),
    }, `Prospect « ${p.nom} » CONVERTI en client par ${profile.nom}`);

    envoyerIdentifiantsWhatsApp(p.nom, identifiant, motDePasse, p.tel);
    uAlert(`✅ ${p.nom} est désormais client.\n\nWhatsApp s'ouvre avec ses identifiants.`);
  };

  const archiver = async (p) => {
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
    const equipe = db.users.filter((u) => ["commercial", "technicien"].includes(u.role) && u.actif !== false).map((u) => u.nom);
    if (equipe.length === 0) { uAlert("Aucun commercial actif."); return; }
    const choix = await uPrompt(`Réassigner « ${p.nom} » à quel commercial ?\n(${equipe.join(" / ")})`, p.commercial || equipe[0]);
    if (!choix) return;
    const cible = equipe.find((n) => n.trim().toLowerCase() === choix.trim().toLowerCase());
    if (!cible) { uAlert("Commercial introuvable parmi l'équipe active."); return; }
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, commercial: cible }) : x)) }, `Prospect « ${p.nom} » réassigné de ${p.commercial || "?"} à ${cible}`);
  };

  const modifierRelance = async (p) => {
    const d = await uPrompt(`Nouvelle date de relance pour ${p.nom} (AAAA-MM-JJ, ou vide pour retirer) :`, p.relance || "");
    if (d === null) return;
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, relance: d.trim() }) : x)) }, `Relance mise à jour pour ${p.nom}`);
  };

  // ---- Liste : ses propres prospects (Commercial) ou tous (Admin) ----
  // Les prospects DEVENUS CLIENTS sortent de la liste : on ne relance pas
  // quelqu'un qui a déjà payé et été installé. Ils restent consultables.
  const [voirAcquis, setVoirAcquis] = useState(false);
  const [vue, setVue] = useState("actifs"); // actifs | dormants | archives
  const acquis = (db.prospects || []).filter((p) => p.converti);
  const archives = (db.prospects || []).filter((p) => p.archive && !p.converti);
  const dormants = (db.prospects || []).filter(estDormant);
  const actifs = (db.prospects || []).filter((p) => !p.converti && !p.archive);

  const base = vue === "archives" ? archives
    : vue === "dormants" ? dormants
    : voirAcquis ? db.prospects.filter((p) => !p.archive)
    : actifs;
  let liste = voitTout ? base : base.filter((p) => p.commercial === profile.nom);
  if (filtreRelance) liste = liste.filter((p) => p.relance && p.relance <= today());
  if (q) liste = liste.filter((p) => (p.nom + " " + p.tel + " " + p.localisation).toLowerCase().includes(q.toLowerCase()));

  const aRelancerAujourdhui = (voitTout ? actifs : actifs.filter((p) => p.commercial === profile.nom)).filter((p) => p.relance && p.relance <= today()).length;

  return (
    <div className="space-y-4">
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
            <div className="text-sm text-slate-600">Aucune catégorie disponible. Demandez à l'administrateur d'en créer dans Paramètres.</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Catégorie">
                  <select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  </select>
                </Field>
                <Field label="Nom du prospect"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
                <Field label="Numéro"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
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
            <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-52" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
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
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Nom", "Numéro", "Catégorie", "Localisation", "Avis", "Intérêt", "Relance", ...(isAdmin ? ["Commercial"] : []), ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">Aucun prospect pour l'instant.</td></tr>}
            {liste.map((p) => {
              const enRetard = p.relance && p.relance <= today();
              return (
                <tr key={p.id} className={`border-t border-slate-100 hover:bg-sky-50 ${enRetard ? "bg-orange-50" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(p.date)}</td>
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2">{p.tel}</td>
                  <td className="px-3 py-2 text-slate-500">{p.categorie}</td>
                  <td className="px-3 py-2">
                    {p.localisation || (p.lat ? "" : "—")}
                    {p.lat && p.lng && (
                      <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-sky-700 underline text-xs whitespace-nowrap">📍 Voir sur la carte</a>
                    )}
                    {p.nature && <div className="text-xs text-slate-500 mt-1 italic">🔧 {p.nature}</div>}
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
                  <td className="px-3 py-2 whitespace-nowrap">
                    {!isAdmin && <button onClick={() => modifierRelance(p)} className="text-xs font-bold text-sky-800 underline mr-2">Relance</button>}
                    {voitTout && aDroit(db, profile, "act_reaffecter") && <button onClick={() => reassigner(p)} className="text-xs font-bold text-sky-800 underline mr-2">Réassigner</button>}
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ MA COMMISSION (rôle Commercial) ============
// ============ MES TÂCHES (agents commerciaux / techniciens / responsable) ============
function MesTaches({ db, save, profile }) {
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const taches = [...tachesDe(moi)].sort((a, b) => {
    if ((a.statut === "terminee") !== (b.statut === "terminee")) return a.statut === "terminee" ? 1 : -1;
    return String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"));
  });
  const ouvertes = taches.filter((t) => t.statut !== "terminee");
  const enRetard = ouvertes.filter((t) => t.echeance && t.echeance < today());

  const majTache = (t, maj, label) =>
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, taches: tachesDe(x).map((y) => (y.id === t.id ? { ...y, ...maj } : y)) } : x)) }, label);

  const terminer = async (t) => {
    if (!await uConfirm(`Marquer la tâche « ${t.titre} » comme terminée ?`)) return;
    majTache(t, { statut: "terminee", date_fin: today() }, `${moi.nom} a terminé la tâche : ${t.titre}`);
  };

  const rouvrir = (t) => majTache(t, { statut: "a_faire", date_fin: null }, `${moi.nom} a rouvert la tâche : ${t.titre}`);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">✅ Mes tâches</div>
        <div className="text-xs text-slate-500 mb-4">Tâches assignées par l'administration ou votre responsable commercial.</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">À faire</div>
            <div className="text-xl font-bold tabular-nums mt-1">{ouvertes.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">En retard</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{enRetard.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Terminées</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{taches.length - ouvertes.length}</div>
          </div>
        </div>
      </Panel>

      {taches.length === 0 ? (
        <div className="text-sm text-slate-400 text-center py-8">Aucune tâche ne vous est assignée pour le moment.</div>
      ) : (
        <div className="space-y-2">
          {taches.map((t) => {
            const retard = t.statut !== "terminee" && t.echeance && t.echeance < today();
            return (
              <div key={t.id} className={`rounded-xl border p-4 flex flex-wrap items-start justify-between gap-3 ${t.statut === "terminee" ? "bg-slate-50 border-slate-200" : retard ? "bg-red-50 border-red-200" : "bg-white border-slate-200 shadow-sm"}`}>
                <div className="min-w-[60%]">
                  <div className={`font-bold ${t.statut === "terminee" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titre}</div>
                  {t.detail && <div className="text-sm text-slate-600 mt-1">{t.detail}</div>}
                  <div className="text-xs text-slate-400 mt-1">
                    Assignée par {t.par} le {dFR(t.date)}
                    {t.echeance ? ` · Échéance : ${dFR(t.echeance)}` : ""}
                    {retard ? " · ⚠ EN RETARD" : ""}
                    {t.statut === "terminee" && t.date_fin ? ` · Terminée le ${dFR(t.date_fin)}` : ""}
                  </div>
                </div>
                <div>
                  {t.statut === "terminee"
                    ? <button onClick={() => rouvrir(t)} className="text-xs font-bold text-slate-500 underline">Rouvrir</button>
                    : <button onClick={() => terminer(t)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">✅ Terminer</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ RENTABILITÉ PAR PRODUIT ============
function Rentabilite({ db }) {
  const [lp, debut, fin] = periodes()[0] ? [null, null, null] : [null, null, null];
  const [periode, setPeriode] = useState("mois");
  const P = periodes();
  const choix = P.find((p) => p[0].toLowerCase().includes(periode)) || P[0];
  const [, a, b] = choix;
  const [tri, setTri] = useState("marge");

  const ventesP = db.ventes.filter((v) => inP(v.date, a, b));

  // Agrégation par NOM d'article (tous sites confondus)
  const parProduit = {};
  ventesP.forEach((v) => {
    (v.articles || []).forEach((l) => {
      const p = db.produits.find((x) => x.id === l.produit_id);
      const nom = p ? p.nom : (l.nom || "?");
      const achat = p ? Number(p.prix_achat || 0) : 0;
      if (!parProduit[nom]) parProduit[nom] = { nom, categorie: p?.categorie || "—", qte: 0, ca: 0, cout: 0 };
      parProduit[nom].qte += Number(l.qte || 0);
      parProduit[nom].ca += Number(l.qte || 0) * Number(l.pu || 0);
      parProduit[nom].cout += Number(l.qte || 0) * achat;
    });
  });

  const lignes = Object.values(parProduit).map((x) => ({
    ...x, marge: x.ca - x.cout, tauxMarge: x.ca > 0 ? Math.round(((x.ca - x.cout) / x.ca) * 1000) / 10 : 0,
  }));
  lignes.sort((x, y) => tri === "marge" ? y.marge - x.marge : tri === "ca" ? y.ca - x.ca : tri === "qte" ? y.qte - x.qte : y.tauxMarge - x.tauxMarge);

  const caTotal = lignes.reduce((s, x) => s + x.ca, 0);
  const margeTotale = lignes.reduce((s, x) => s + x.marge, 0);
  const tauxGlobal = caTotal > 0 ? Math.round((margeTotale / caTotal) * 1000) / 10 : 0;

  // Articles jamais vendus sur la période, mais en stock : capital immobilisé
  const vendus = new Set(Object.keys(parProduit));
  const dormants = db.produits
    .filter((p) => !vendus.has(p.nom) && stockActuel(db, p) > 0)
    .map((p) => ({ p, valeur: stockActuel(db, p) * Number(p.prix_achat || 0) }))
    .sort((x, y) => y.valeur - x.valeur);
  const capitalDormant = dormants.reduce((s, x) => s + x.valeur, 0);

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">📈 Rentabilité par produit</div>
        <div className="text-xs text-slate-500 mb-3">Marge réelle = prix de vente encaissé − prix d'achat. Les remises sont donc prises en compte.</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Période">
            <select className={inputCls} value={periode} onChange={(e) => setPeriode(e.target.value)}>
              <option value="jour">Aujourd'hui</option>
              <option value="semaine">Cette semaine</option>
              <option value="mois">Ce mois</option>
              <option value="année">Cette année</option>
            </select>
          </Field>
          <Field label="Trier par">
            <select className={inputCls} value={tri} onChange={(e) => setTri(e.target.value)}>
              <option value="marge">Marge (F CFA)</option>
              <option value="taux">Taux de marge (%)</option>
              <option value="ca">Chiffre d'affaires</option>
              <option value="qte">Quantités vendues</option>
            </select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Carte label="Chiffre d'affaires" valeur={fmt(caTotal)} couleur="border-l-sky-700" />
          <Carte label="Marge brute" valeur={<span className="text-green-700">{fmt(margeTotale)}</span>} couleur="border-l-green-700" />
          <Carte label="Taux de marge global" valeur={<span className={tauxGlobal < 15 ? "text-red-600" : "text-green-700"}>{tauxGlobal} %</span>} couleur="border-l-emerald-600" />
          <Carte label="Capital dormant" valeur={<span className="text-orange-600">{fmt(capitalDormant)}</span>} couleur="border-l-orange-500" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>Produits vendus — {choix[0]}</span>
          <button className={btnDark} onClick={() => exportCSV(`rentabilite_${today()}`,
            ["Article", "Catégorie", "Quantité vendue", "Chiffre d'affaires", "Coût d'achat", "Marge", "Taux de marge (%)"],
            lignes.map((x) => [x.nom, x.categorie, x.qte, x.ca, x.cout, x.marge, x.tauxMarge]), choix[0])}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucune vente sur cette période.</div>
        ) : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Catégorie", "Vendus", "CA", "Coût", "Marge", "Taux"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map((x) => (
                <tr key={x.nom} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{x.nom}</td>
                  <td className="px-3 py-2 text-slate-500">{x.categorie}</td>
                  <td className="px-3 py-2 tabular-nums">{x.qte}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(x.ca)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-500">{fmt(x.cout)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.marge >= 0 ? "text-green-700" : "text-red-600"}`}>{fmt(x.marge)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${x.tauxMarge < 0 ? "text-red-600" : x.tauxMarge < 15 ? "text-orange-600" : "text-green-700"}`}>{x.tauxMarge} %</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal)}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(caTotal - margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(margeTotale)}</td>
                <td className="px-3 py-2 tabular-nums">{tauxGlobal} %</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {dormants.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-orange-800 border-b border-orange-200 bg-orange-50">
            😴 Produits dormants — invendus sur la période, mais en stock ({fmt(capitalDormant)} immobilisés)
          </div>
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Site", "Stock", "Valeur immobilisée"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {dormants.slice(0, 25).map(({ p, valeur }) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2"><Badge boutique={p.boutique} /></td>
                  <td className="px-3 py-2 tabular-nums">{stockActuel(db, p)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">{fmt(valeur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ SALAIRES — VUE ADMINISTRATEUR ============
function SalairesAdmin({ db, save, profile }) {
  const [mois, setMois] = useState(today().slice(0, 7));
  const options = [];
  const d0 = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d0.getFullYear(), d0.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }

  const employes = db.users.filter((u) => SALARIES.includes(u.role) && u.actif !== false);
  const lignes = employes.map((u) => ({ u, p: paieMois(u, mois), credit: creditsEnCours(u).reduce((s, c) => s + resteCredit(c), 0) }));

  const masse = lignes.reduce((s, l) => s + l.p.net, 0);
  const verse = lignes.reduce((s, l) => s + l.p.verse, 0);
  const reste = lignes.reduce((s, l) => s + Math.max(0, l.p.reste), 0);
  const attente = lignes.reduce((s, l) => s + l.p.enAttente, 0);
  const encoursCredit = lignes.reduce((s, l) => s + l.credit, 0);

  const roleCourt = (r) => r === "gerant" ? "Gérant" : r === "magasinier" ? "Magasinier" : r === "technicien_bmi" ? "Technicien BMI" : "Vendeur";

  const statut = (p) => {
    if (p.net <= 0) return <span className="text-xs font-bold text-slate-400">—</span>;
    if (p.verse <= 0) return <span className="text-xs font-bold text-red-600">🔴 Non payé</span>;
    if (p.reste > 0) return <span className="text-xs font-bold text-orange-600">🟠 Partiel</span>;
    if (p.enAttente > 0) return <span className="text-xs font-bold text-amber-600">⏳ À confirmer</span>;
    return <span className="text-xs font-bold text-green-700">✅ Payé & confirmé</span>;
  };

  const Carte = ({ label, valeur, couleur }) => (
    <div className={`rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 ${couleur}`}>
      <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-1">{valeur}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <div className="font-bold mb-1">💵 Masse salariale — {libelleMoisFR(mois)}</div>
        <div className="text-xs text-slate-500 mb-3">Vue d'ensemble de la paie du mois. Les virements envoyés d'ici sont enregistrés en dépense « Salaires ».</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMoisFR(m)}</option>)}
          </select>
        </Field>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <Carte label="Masse salariale (net)" valeur={fmt(masse)} couleur="border-l-sky-700" />
          <Carte label="Déjà versé" valeur={fmt(verse)} couleur="border-l-green-600" />
          <Carte label="Reste à verser" valeur={fmt(reste)} couleur="border-l-red-500" />
          <Carte label="À confirmer par l'employé" valeur={fmt(attente)} couleur="border-l-amber-500" />
          <Carte label="Encours crédits BMI" valeur={fmt(encoursCredit)} couleur="border-l-purple-600" />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <span>Détail par employé</span>
          <button className={btnDark} onClick={() => exportCSV(`salaires_${mois}`,
            ["Employé", "Rôle", "Boutique", "Salaire de base", "Primes", "Avances", "Retenue crédit", "Net à percevoir", "Versé", "Reste à verser", "Crédit en cours"],
            lignes.map(({ u, p, credit }) => [u.nom, roleCourt(u.role), u.boutique || "Toutes", p.base, p.primes, p.avances, p.retenueCredit, p.net, p.verse, Math.max(0, p.reste), credit]),
            `Paie ${libelleMoisFR(mois)}`)}>📄 Exporter</button>
        </div>
        {lignes.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun employé salarié actif. Créez des comptes Vendeur, Gérant, Magasinier ou Technicien BMI.</div>
        ) : (
          <table className="w-full text-sm min-w-[860px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Employé", "Base", "Primes", "Avances", "Retenue crédit", "Net", "Versé", "Reste", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {lignes.map(({ u, p, credit }) => (
                <tr key={u.id} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}
                    <div className="text-xs font-normal text-slate-500">{roleCourt(u.role)} · {u.boutique || "Toutes boutiques"}</div>
                    {!u.nom_complet && <div className="text-xs font-normal text-orange-500">⚠ Identité non renseignée (👥 Utilisateurs → 🪪 Identité)</div>}
                    {credit > 0 && <div className="text-xs font-bold text-purple-700">🏦 Crédit : reste {fmt(credit)}</div>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.base ? fmt(p.base) : <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{p.primes ? "+" + fmt(p.primes) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-orange-600">{p.avances ? "−" + fmt(p.avances) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(p.net)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(p.verse)}</td>
                  <td className={`px-3 py-2 tabular-nums font-bold ${p.reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{statut(p)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.reste > 0 && <button onClick={() => envoyerVirementG(db, save, profile, u, mois)} className="text-xs font-bold text-blue-700 underline mr-2">💸 Virement</button>}
                    <button onClick={() => imprimerBulletin(u, mois, db)} className="text-xs font-bold text-sky-800 underline">🖨 Bulletin</button>
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 tabular-nums">{fmt(lignes.reduce((s, l) => s + l.p.base, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(lignes.reduce((s, l) => s + l.p.primes, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-orange-600">{fmt(lignes.reduce((s, l) => s + l.p.avances, 0))}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(lignes.reduce((s, l) => s + l.p.retenueCredit, 0))}</td>
                <td className="px-3 py-2 tabular-nums">{fmt(masse)}</td>
                <td className="px-3 py-2 tabular-nums text-green-700">{fmt(verse)}</td>
                <td className="px-3 py-2 tabular-nums text-red-600">{fmt(reste)}</td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ============ SALAIRE (vendeurs, gérants, magasiniers) ============
function Salaire({ db, save, profile }) {
  // Lit la fiche À JOUR depuis la base (le profil de connexion est figé au
  // login, or l'admin peut ajouter primes/avances pendant la session).
  const moi = db.users.find((u) => u.id === profile.id) || profile;
  const [mois, setMois] = useState(today().slice(0, 7));

  // 12 derniers mois proposés
  const options = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    options.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  const libelleMois = libelleMoisFR;

  const base = Number(moi.salaire_base || 0);
  const primes = (moi.primes || []).filter((p) => p.mois === mois);
  const avances = (moi.avances || []).filter((a) => a.mois === mois);
  const totalPrimes = primes.reduce((s, p) => s + Number(p.montant || 0), 0);
  const totalAvances = avances.reduce((s, a) => s + Number(a.montant || 0), 0);
  // Virements + retenues de crédit pour ce mois
  const p = paieMois(moi, mois);
  const net = p.net;
  const enAttente = p.virements.filter((v) => v.statut !== "accepte");

  // ---- Crédit BMI ----
  const mesCredits = moi.credits || [];
  const enCours = mesCredits.filter((c) => c.statut === "approuve" && resteCredit(c) > 0);
  const enExamen = mesCredits.filter((c) => c.statut === "en_attente");
  const [dem, setDem] = useState({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
  const [msgC, setMsgC] = useState("");

  const demanderCredit = async () => {
    const montant = Number(dem.montant);
    if (!montant || montant <= 0) { setMsgC("Indiquez le montant souhaité."); return; }
    if (!dem.motif.trim()) { setMsgC("Indiquez le motif de votre demande."); return; }
    if (enExamen.length > 0) { setMsgC("Vous avez déjà une demande en cours d'examen."); return; }
    const n = dem.mode === "salaire" ? Math.max(1, Math.min(36, Number(dem.mensualites) || 1)) : 0;
    const resume = dem.mode === "salaire"
      ? `Remboursement par retenue sur salaire : ${n} mensualité(s) d'environ ${fmt(Math.round(montant / n))}.`
      : "Remboursement libre (vous remboursez directement à l'administration).";
    if (!await uConfirm(`Envoyer une demande de crédit de ${fmt(montant)} à BMI ?\n\n${resume}\n\nL'administration examinera votre demande.`)) return;
    const credit = {
      id: uid(), date_demande: today(), montant_demande: montant, motif: dem.motif.trim(),
      mode: dem.mode, mensualites: n, statut: "en_attente", remboursements: [], echeances: []
    };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: [...(x.credits || []), credit] } : x)) },
      `Demande de crédit BMI de ${fmt(montant)} par ${moi.nom}`);
    setDem({ montant: "", motif: "", mode: "salaire", mensualites: "3" });
    setMsgC("✅ Demande envoyée. Vous serez informé de la décision ici même.");
    setTimeout(() => setMsgC(""), 6000);
  };

  // À l'ouverture de l'onglet, les décisions de crédit sont marquées comme vues
  // (la pastille de notification disparaît).
  useEffect(() => {
    const aVoir = mesCredits.filter((c) => (c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe);
    if (!aVoir.length) return;
    save({
      ...db,
      users: db.users.map((x) => (x.id === moi.id
        ? { ...x, credits: (x.credits || []).map((c) => ((c.statut === "approuve" || c.statut === "refuse") && !c.vu_employe ? { ...c, vu_employe: true } : c)) }
        : x))
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const annulerDemande = async (c) => {
    if (!await uConfirm(`Annuler votre demande de crédit de ${fmt(c.montant_demande)} ?`)) return;
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, credits: (x.credits || []).filter((y) => y.id !== c.id) } : x)) },
      `${moi.nom} a annulé sa demande de crédit de ${fmt(c.montant_demande)}`);
  };

  const accepterVirement = async (v) => {
    if (!await uConfirm(`Confirmez-vous avoir bien reçu ${fmt(v.montant)}${v.moyen ? ` par ${v.moyen}` : ""} pour ${libelleMois(v.mois)} ?\n\nCette confirmation est enregistrée et visible par l'administration.`)) return;
    const maj = { ...v, statut: "accepte", date_acceptation: today() };
    save({ ...db, users: db.users.map((x) => (x.id === moi.id ? { ...x, virements: (x.virements || []).map((y) => (y.id === v.id ? maj : y)) } : x)) },
      `${moi.nom} a confirmé la réception du virement de ${fmt(v.montant)} (${libelleMois(v.mois)})`);
    uAlert("✅ Réception confirmée. Merci !");
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">💵 Mon salaire — {moi.nom_complet || moi.nom}</div>
        {moi.piece_num && <div className="text-xs text-slate-400 mb-1">{moi.piece_type || "Pièce"} n° {moi.piece_num}</div>}
        <div className="text-xs text-slate-500 mb-4">Informations indicatives, mois par mois. Pour toute question sur votre paie, adressez-vous à l'administration.{Number(moi.taux_avancement || 0) > 0 ? ` Taux d'avancement annuel : ${moi.taux_avancement} %.` : ""}</div>
        <Field label="Mois">
          <select className={inputCls} value={mois} onChange={(e) => setMois(e.target.value)}>
            {options.map((m) => <option key={m} value={m}>{libelleMois(m)}</option>)}
          </select>
        </Field>
        <div className="mt-3">
          <button onClick={() => imprimerBulletin(moi, mois, db)} className={btnDark}>🖨 Imprimer mon bulletin de paie</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Salaire de base</div>
            <div className="text-xl font-bold tabular-nums mt-1">{base > 0 ? fmt(base) : "—"}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-slate-500 uppercase">Primes du mois</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-700">{totalPrimes ? "+" + fmt(totalPrimes) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Avances perçues</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-orange-600">{totalAvances ? "−" + fmt(totalAvances) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <div className="text-xs font-semibold text-slate-500 uppercase">Retenue crédit BMI</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-red-600">{p.retenueCredit ? "−" + fmt(p.retenueCredit) : fmt(0)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-700">
            <div className="text-xs font-semibold text-green-700 uppercase">Net à percevoir</div>
            <div className="text-xl font-bold tabular-nums mt-1 text-green-800">{fmt(net)}</div>
          </div>
        </div>
      </Panel>

      {enAttente.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="font-bold text-amber-800 mb-1">💸 Virement reçu de l'administration</div>
          <div className="text-xs text-amber-700 mb-3">Vérifiez que l'argent est bien arrivé, puis confirmez la réception.</div>
          <div className="space-y-3">
            {enAttente.map((v) => (
              <div key={v.id} className="rounded-lg bg-white border border-amber-200 p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-slate-800">{fmt(v.montant)}</div>
                  <div className="text-xs text-slate-500">
                    {libelleMois(v.mois)} · {v.moyen || "Non précisé"} · envoyé le {dFR(v.date_envoi)} par {v.par || "—"}
                    {v.ref ? ` · Réf : ${v.ref}` : ""}
                  </div>
                </div>
                <button onClick={() => accepterVirement(v)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">
                  ✅ J'ai bien reçu ce montant
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {p.virements.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
            <span>💸 Virements — {libelleMois(mois)}</span>
            <span className="text-xs font-semibold text-slate-600">
              Versé : <b className="tabular-nums">{fmt(p.verse)}</b> · Reste à percevoir : <b className={`tabular-nums ${p.reste > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(Math.max(0, p.reste))}</b>
            </span>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date d'envoi", "Montant", "Moyen", "Référence", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {p.virements.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date_envoi)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{fmt(v.montant)}</td>
                  <td className="px-3 py-2">{v.moyen || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{v.ref || "—"}</td>
                  <td className="px-3 py-2">
                    {v.statut === "accepte"
                      ? <span className="text-xs font-bold text-green-700">✅ Reçu confirmé le {dFR(v.date_acceptation)}</span>
                      : <span className="text-xs font-bold text-amber-600">⏳ En attente de votre confirmation</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(primes.length > 0 || avances.length > 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail — {libelleMois(mois)}</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Type", "Motif", "Enregistré par", "Montant"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {primes.map((p, i) => (
                <tr key={"p" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-green-700">PRIME</span></td>
                  <td className="px-3 py-2">{p.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{p.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-green-700">+{fmt(Number(p.montant || 0))}</td>
                </tr>
              ))}
              {avances.map((a, i) => (
                <tr key={"a" + i} className="border-t border-slate-100">
                  <td className="px-3 py-2"><span className="text-xs font-bold text-orange-600">AVANCE</span></td>
                  <td className="px-3 py-2">{a.motif || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.par || "—"}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-orange-600">−{fmt(Number(a.montant || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
        <div className="font-bold mb-1">🏦 Crédit BMI</div>
        <div className="text-xs text-slate-500 mb-4">Vous pouvez demander un crédit à l'entreprise. L'administration examine votre demande et fixe le montant accordé.</div>

        {!aDroit(db, profile, "act_credit") && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600">
            🔒 La demande de crédit a été désactivée pour votre compte par l'administration.
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Montant souhaité (F CFA)">
              <input type="number" min="0" className={inputCls} value={dem.montant} onChange={(e) => setDem({ ...dem, montant: e.target.value })} />
            </Field>
            <Field label="Motif">
              <input className={inputCls} placeholder="Ex : frais de santé, scolarité…" value={dem.motif} onChange={(e) => setDem({ ...dem, motif: e.target.value })} />
            </Field>
            <Field label="Remboursement souhaité">
              <select className={inputCls} value={dem.mode} onChange={(e) => setDem({ ...dem, mode: e.target.value })}>
                <option value="salaire">Retenue sur salaire (mensualités)</option>
                <option value="libre">Remboursement libre</option>
              </select>
            </Field>
            {dem.mode === "salaire" && (
              <Field label="Nombre de mensualités">
                <input type="number" min="1" max="36" className={inputCls} value={dem.mensualites} onChange={(e) => setDem({ ...dem, mensualites: e.target.value })} />
              </Field>
            )}
          </div>
        )}

        {aDroit(db, profile, "act_credit") && enExamen.length === 0 && enCours.length === 0 && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button onClick={demanderCredit} className={btnDark}>Envoyer ma demande</button>
            {msgC && <span className="text-sm font-semibold text-slate-700">{msgC}</span>}
          </div>
        )}

        {enCours.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
            Vous avez un crédit en cours de remboursement. Une nouvelle demande sera possible une fois celui-ci soldé.
          </div>
        )}
        {enExamen.length > 0 && (
          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 text-sm text-purple-900">
            📩 Votre demande est en cours d'examen par l'administration.
          </div>
        )}

        {mesCredits.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Demandé", "Accordé", "Remboursement", "Reste dû", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {[...mesCredits].reverse().map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date_demande)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(c.montant_demande)}<div className="text-xs font-normal text-slate-500">{c.motif}</div></td>
                    <td className="px-3 py-2 tabular-nums font-bold text-blue-700">{c.montant_accorde ? fmt(c.montant_accorde) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {c.mode === "salaire" ? `Retenue sur salaire${c.mensualites ? ` · ${c.mensualites} mois` : ""}` : "Remboursement libre"}
                      {(c.echeances || []).some((e) => !e.paye) && (
                        <div className="text-slate-500">Prochaine : {libelleMoisFR((c.echeances || []).find((e) => !e.paye).mois)} · {fmt((c.echeances || []).find((e) => !e.paye).montant)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-bold text-red-600">{c.statut === "approuve" ? fmt(resteCredit(c)) : "—"}</td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" ? <span className="text-xs font-bold text-purple-700">📩 En attente</span>
                        : c.statut === "approuve" ? <span className="text-xs font-bold text-blue-700">✅ Accordé</span>
                        : c.statut === "solde" ? <span className="text-xs font-bold text-green-700">🎉 Soldé</span>
                        : <span className="text-xs font-bold text-red-600">❌ Refusé</span>}
                      {c.commentaire && <div className="text-xs text-slate-500 italic">« {c.commentaire} »</div>}
                    </td>
                    <td className="px-3 py-2">
                      {c.statut === "en_attente" && <button onClick={() => annulerDemande(c)} className="text-xs font-bold text-red-600 underline">Annuler</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(moi.evolutions_salaire || []).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">📈 Mon avancement</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Ancien salaire", "Nouveau salaire", "Évolution", "%", "Motif"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {[...moi.evolutions_salaire].reverse().map((e, i) => {
                const delta = Number(e.nouveau) - Number(e.ancien);
                const pct = e.pct != null ? e.pct : (Number(e.ancien) > 0 ? Math.round(((Number(e.nouveau) - Number(e.ancien)) / Number(e.ancien)) * 1000) / 10 : null);
                return (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{dFR(e.date)}</td>
                    <td className="px-3 py-2 tabular-nums">{e.ancien ? fmt(e.ancien) : "—"}</td>
                    <td className="px-3 py-2 tabular-nums font-bold">{fmt(e.nouveau)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${delta >= 0 ? "text-green-700" : "text-red-600"}`}>{delta >= 0 ? "+" : ""}{fmt(delta)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${pct == null ? "text-slate-400" : pct >= 0 ? "text-green-700" : "text-red-600"}`}>
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct} %`}
                      {e.taux_prevu ? <span className="block text-[10px] font-normal text-slate-400">taux fixé : {e.taux_prevu} %</span> : null}
                    </td>
                    <td className="px-3 py-2">{e.motif || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {base === 0 && primes.length === 0 && avances.length === 0 && p.virements.length === 0 && mesCredits.length === 0 && (
        <div className="text-sm text-slate-400 text-center py-6">Aucune information de salaire n'a encore été renseignée par l'administration pour ce mois.</div>
      )}
    </div>
  );
}

// ============ ESPACE CLIENT (rôle client) ============
function EspaceClient({ db, profile, save, setTab }) {
  // Fiche du client installé correspondant à ce compte (rattaché par user_id)
  const fiche = (db.clients_installes || []).find((c) => c.user_id === profile.id);
  // Ses devis, déposés par un technicien depuis l'écran Dimensionnement
  const moi = (db.users || []).find((u) => u.id === profile.id) || {};
  const mesDevis = moi.devis || [];
  const [devisOuvert, setDevisOuvert] = useState(null);
  const [bqPaiement, setBqPaiement] = useState({});

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
            ? { ...x, statut: "rejete", motif_rejet: motif.trim(), rejete_le: today() }
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
            ? { ...x, statut: "modification", demande_modif: quoi.trim(), modif_le: today() }
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
  const validerDevis = async (d) => {
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
            ? { ...x, statut: "valide", boutique_paiement: boutique, boutique_adresse: infosBoutique?.adresse || "", boutique_tel: infosBoutique?.tel || "", boutique_lat: infosBoutique?.lat || null, boutique_lng: infosBoutique?.lng || null, valide_le: today(), commande_id: commande.id }
            : x)) }
        : u)),
    }, `Devis ${fmt(d.total)} VALIDÉ par le client ${profile.nom} — paiement prévu à ${boutique}`);

    uAlert(`✅ Merci ! Votre devis est validé.\n\nPassez à la boutique ${boutique} pour régler.${localisation}${lienCarte}${telBoutique}\nLe vendeur vous attend.\n\nDès votre paiement, nous programmerons votre installation.`);
  };

  // ---- RÉCEPTION DES TRAVAUX PAR LE CLIENT ----
  const receptionner = async () => {
    if (!await uConfirm(
      `Confirmez-vous que l'installation a bien été réalisée, et que vous l'acceptez en l'état ?\n\n` +
      `Cette confirmation vaut réception des travaux. Elle est enregistrée à votre nom et à la date du jour.`
    )) return;
    // La réception DÉBLOQUE la commission de celui qui a fait le devis.
    // C'est le jour où le client dit « c'est bon » que la vente est vraiment faite.
    save({
      ...db,
      clients_installes: db.clients_installes.map((c) => (c.id === fiche.id
        ? { ...c, statut: "receptionne", receptionne_le: today(), receptionne_par: profile.nom }
        : c)),
      ventes: (db.ventes || []).map((v) => (v.id === fiche.vente_id
        ? {
            ...v,
            commission_a_la_reception: false,
            commission_debloquee_le: today(),
            // La part du parrain se débloque en même temps.
            apporteur: v.apporteur ? { ...v.apporteur, a_la_reception: false } : v.apporteur,
          }
        : v)),
    }, `Travaux RÉCEPTIONNÉS par le client ${profile.nom}${fiche.vente_id ? " — commission débloquée" : ""}`);
    uAlert("✅ Merci ! Votre réception a bien été enregistrée.");
  };

  const emettreReserves = async () => {
    const motif = await uPrompt(
      "Qu'est-ce qui ne va pas ? Décrivez le problème constaté.\n\nBMI Togo en sera informé immédiatement.",
      ""
    );
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Merci de décrire le problème."); return; }
    save({
      ...db,
      clients_installes: db.clients_installes.map((c) => (c.id === fiche.id
        ? { ...c, statut: "reserves", reserves: motif.trim(), reserves_le: today() }
        : c)),
    }, `⚠ RÉSERVES émises par le client ${profile.nom} : ${motif.trim()}`);
    uAlert("Vos réserves ont été transmises à BMI Togo. Un technicien vous recontactera.");
  };
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
                <button onClick={() => setDevisOuvert(devisOuvert === d.id ? null : d.id)} className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-emerald-100">
                  <span>
                    <span className="font-bold text-emerald-900">{d.type_devis === "garage" ? "Motorisation portail/garage" : d.type_devis === "autre" ? (d.besoins?.categorie || "Devis") : "Installation solaire"} — {fmt(d.total)}</span>
                    <span className="block text-xs text-slate-500">Établi le {dFR(d.date)} par {d.par}</span>
                  </span>
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
                          <button onClick={() => validerDevis(d)} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✅ JE VALIDE</button>
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
                <div className="flex gap-2 flex-wrap">
                  <button onClick={receptionner} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">✅ Je réceptionne les travaux</button>
                  <button onClick={emettreReserves} className="px-4 py-2 rounded-lg border-2 border-red-400 text-red-700 font-bold text-sm hover:bg-red-50">⚠ Signaler un problème</button>
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
      <div className="text-xs text-slate-400">Utilisez l'onglet 💬 Messages pour écrire à nos équipes.</div>
    </div>
  );
}

const Info = ({ label, valeur }) => (
  <div className="rounded-xl p-3 bg-white border border-slate-200">
    <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
    <div className="text-sm font-bold mt-0.5">{valeur || "—"}</div>
  </div>
);

// ============ MESSAGERIE INTERNE (en différé, via la synchronisation) ============
// - Conversations 1-à-1 entre tous les membres de l'équipe (tous rôles sauf client)
// - Fil « Support » par client : le client écrit, et l'admin, les techniciens,
//   les chefs d'équipe et le commercial rattaché à sa fiche voient et répondent
// - Un client autorisé par l'admin (chat_libre) peut aussi discuter en 1-à-1
function peutVoirFilClient(moi, clientId, db) {
  if (moi.role === "admin" || moi.role === "technicien" || moi.role === "technicien_bmi" || moi.chef_equipe) return true;
  if (moi.role === "commercial") {
    const fiche = (db.clients_installes || []).find((c) => c.user_id === clientId);
    return fiche && fiche.commercial === moi.nom;
  }
  return moi.id === clientId; // le client lui-même
}

// Libellé du rôle affiché dans les listes de contacts / membres
function libelleRole(role) {
  return role === "admin" ? "Admin" : role === "gerant" ? "Gérant" : role === "magasinier" ? "Magasinier" : role === "commercial" ? "Commercial" : role === "technicien" ? "Technicien" : role === "technicien_bmi" ? "Technicien BMI" : role === "resp_commercial" ? "Resp. Commercial" : role === "comptable" ? "Comptable" : role === "client" ? "Client" : "Vendeur";
}

function Messagerie({ db, save, profile }) {
  const estClient = profile.role === "client";
  const chatLibre = !!profile.chat_libre;
  const isAdmin = profile.role === "admin";
  const [conv, setConv] = useState(null); // { type: "user"|"client"|"groupe", id }
  const [texte, setTexte] = useState("");
  const [creationGroupe, setCreationGroupe] = useState(false); // formulaire de création
  const [gestionMembres, setGestionMembres] = useState(false); // édition des membres du groupe ouvert
  const messages = db.messages || [];
  const groupes = db.groupes || [];

  // ---- Interlocuteurs 1-à-1 : équipe active (+ clients autorisés au chat libre) ----
  const equipe = db.users.filter((u) => u.id !== profile.id && u.actif !== false && (u.role !== "client" || u.chat_libre));
  const contacts = estClient && !chatLibre ? [] : equipe;

  // ---- Chef d'équipe assigné à MON installation (visible même sans chat libre) ----
  const monChefEquipe = estClient
    ? (() => {
        const fiche = (db.clients_installes || []).find((c) => c.user_id === profile.id);
        const chefEntree = (fiche?.equipe || []).find((e) => e.chef);
        return chefEntree ? db.users.find((u) => u.id === chefEntree.user_id && u.actif !== false) : null;
      })()
    : null;

  // ---- Clients dont JE suis le chef d'équipe (visible même sans chat libre côté client) ----
  const mesClientsEnTantQueChef = !estClient
    ? (db.clients_installes || [])
        .filter((c) => (c.equipe || []).some((e) => e.user_id === profile.id && e.chef))
        .map((c) => db.users.find((u) => u.id === c.user_id))
        .filter(Boolean)
    : [];

  // ---- Clients qui M'ONT ÉCRIT directement (ex. demande de modification/rejet
  // d'un devis) : sans ça, leur message compte dans le badge « non lus » mais
  // reste invisible et impossible à ouvrir — un message orphelin, sans conversation.
  const clientsQuiMOntEcrit = !estClient
    ? [...new Set(messages.filter((m) => m.a_id === profile.id && !m.canal && m.de_id).map((m) => m.de_id))]
        .map((id) => db.users.find((u) => u.id === id && u.role === "client" && u.actif !== false))
        .filter(Boolean)
    : [];

  // ---- Fils clients visibles par moi ----
  const clientsAvecFil = db.users.filter((u) => u.role === "client" && u.actif !== false && peutVoirFilClient(profile, u.id, db));

  // ---- Groupes visibles par moi : l'admin voit tout, les autres seulement ceux dont ils sont membres ----
  const mesGroupes = groupes.filter((g) => isAdmin || (g.membres || []).includes(profile.id));

  const messagesDe = (c) => {
    if (!c) return [];
    if (c.type === "client") return messages.filter((m) => m.canal === "support" && m.client_id === c.id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (c.type === "groupe") return messages.filter((m) => m.canal === "groupe" && m.groupe_id === c.id).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    return messages.filter((m) => !m.canal && ((m.de_id === profile.id && m.a_id === c.id) || (m.de_id === c.id && m.a_id === profile.id))).sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  };

  const nonLusPour = (c) => messagesDe(c).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id)).length;

  const ouvrir = (c) => {
    setConv(c);
    setGestionMembres(false);
    // Marque les messages de cette conversation comme lus (si besoin)
    const aLire = messagesDe(c).filter((m) => m.de_id !== profile.id && !(m.lu_par || []).includes(profile.id));
    if (aLire.length > 0) {
      const ids = new Set(aLire.map((m) => m.id));
      save({ ...db, messages: messages.map((m) => (ids.has(m.id) ? { ...m, lu_par: [...(m.lu_par || []), profile.id] } : m)) });
    }
  };

  const envoyer = () => {
    const t = texte.trim();
    if (!t || !conv) return;
    const base = { id: uid(), date: today(), ts: new Date().toISOString(), de_id: profile.id, de_nom: profile.nom, texte: t, lu_par: [profile.id] };
    const m = conv.type === "client" ? { ...base, canal: "support", client_id: conv.id } : conv.type === "groupe" ? { ...base, canal: "groupe", groupe_id: conv.id } : { ...base, a_id: conv.id };
    save({ ...db, messages: [m, ...messages] });
    setTexte("");
  };

  // ---- Gestion des groupes (admin uniquement) ----
  const creerGroupe = (nom, membresChoisis) => {
    const n = nom.trim();
    if (!n) return;
    const g = { id: uid(), nom: n, membres: [...new Set([profile.id, ...membresChoisis])], createur_id: profile.id, createur_nom: profile.nom, date: today(), ts: new Date().toISOString() };
    save({ ...db, groupes: [g, ...groupes] }, `Groupe « ${n} » créé par ${profile.nom}`);
    setCreationGroupe(false);
    ouvrir({ type: "groupe", id: g.id });
  };

  const supprimerGroupe = async (g) => {
    if (!(await uConfirm(`Supprimer le groupe « ${g.nom} » ?\n\nTous les messages échangés dans ce groupe seront définitivement effacés. Cette action est irréversible.`))) return;
    save({
      ...db,
      groupes: groupes.filter((x) => x.id !== g.id),
      messages: messages.filter((m) => !(m.canal === "groupe" && m.groupe_id === g.id)),
    }, `Groupe « ${g.nom} » supprimé par ${profile.nom}`);
    if (conv?.type === "groupe" && conv.id === g.id) setConv(null);
  };

  const basculerMembre = (g, userId) => {
    const membres = (g.membres || []).includes(userId) ? g.membres.filter((id) => id !== userId) : [...(g.membres || []), userId];
    save({ ...db, groupes: groupes.map((x) => (x.id === g.id ? { ...x, membres } : x)) });
  };

  const fil = messagesDe(conv);
  const groupeOuvert = conv?.type === "groupe" ? groupes.find((g) => g.id === conv.id) : null;
  const nomConv = conv
    ? conv.type === "client"
      ? `Support — ${db.users.find((u) => u.id === conv.id)?.nom || "Client"}`
      : conv.type === "groupe"
      ? `👥 ${groupeOuvert?.nom || "Groupe"}`
      : db.users.find((u) => u.id === conv.id)?.nom || ""
    : "";

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {/* Liste des conversations (sur mobile : masquée quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${conv ? "hidden lg:block" : ""}`}>
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">💬 Conversations</div>
        <div className="max-h-[60vh] overflow-y-auto">
          {estClient && (
            <button onClick={() => ouvrir({ type: "client", id: profile.id })} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "client" && conv?.id === profile.id ? "bg-sky-50" : ""}`}>
              <span className="font-semibold text-sm">🛟 Écrire à BMI Togo</span>
              {nonLusPour({ type: "client", id: profile.id }) > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nonLusPour({ type: "client", id: profile.id })}</span>}
            </button>
          )}
          {estClient && monChefEquipe && (
            <button onClick={() => ouvrir({ type: "user", id: monChefEquipe.id })} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === monChefEquipe.id ? "bg-sky-50" : ""}`}>
              <span className="font-semibold text-sm">👷 {monChefEquipe.nom} <span className="text-xs font-normal text-slate-400">(chef d'équipe)</span></span>
              {nonLusPour({ type: "user", id: monChefEquipe.id }) > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nonLusPour({ type: "user", id: monChefEquipe.id })}</span>}
            </button>
          )}
          {!estClient && mesClientsEnTantQueChef.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👷 Mes clients (chef d'équipe)</div>
              {mesClientsEnTantQueChef.map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"chef" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && clientsQuiMOntEcrit.filter((u) => !mesClientsEnTantQueChef.some((c) => c.id === u.id)).length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👤 Clients qui vous ont écrit</div>
              {clientsQuiMOntEcrit.filter((u) => !mesClientsEnTantQueChef.some((c) => c.id === u.id)).map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"ecrit" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && clientsAvecFil.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">🛟 Support clients</div>
              {clientsAvecFil.map((u) => {
                const c = { type: "client", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"cl" + u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "client" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="font-semibold text-sm">{u.nom}</span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {!estClient && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50 flex items-center justify-between">
                <span>👥 Groupes</span>
                {isAdmin && <button onClick={() => setCreationGroupe(true)} className="text-sky-800 font-bold normal-case text-xs">+ Nouveau</button>}
              </div>
              {mesGroupes.length === 0 && <div className="px-4 py-3 text-xs text-slate-400">{isAdmin ? "Créez un groupe pour discuter avec plusieurs collaborateurs à la fois." : "Aucun groupe pour l'instant."}</div>}
              {mesGroupes.map((g) => {
                const c = { type: "groupe", id: g.id };
                const nb = nonLusPour(c);
                return (
                  <button key={"gr" + g.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "groupe" && conv?.id === g.id ? "bg-sky-50" : ""}`}>
                    <span className="text-sm"><span className="font-semibold">{g.nom}</span> <span className="text-xs text-slate-400">({(g.membres || []).length})</span></span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {contacts.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-xs font-bold text-slate-500 uppercase bg-slate-50">👤 Équipe</div>
              {contacts.map((u) => {
                const c = { type: "user", id: u.id };
                const nb = nonLusPour(c);
                return (
                  <button key={u.id} onClick={() => ouvrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-sky-50 flex items-center justify-between ${conv?.type === "user" && conv?.id === u.id ? "bg-sky-50" : ""}`}>
                    <span className="text-sm"><span className="font-semibold">{u.nom}</span> <span className="text-xs text-slate-400">{libelleRole(u.role)}</span></span>
                    {nb > 0 && <span className="text-xs font-bold text-white bg-red-600 rounded-full px-2 py-0.5">{nb}</span>}
                  </button>
                );
              })}
            </>
          )}
          {estClient && !chatLibre && <div className="px-4 py-3 text-xs text-slate-400">Vos messages sont transmis à l'équipe BMI Togo (administration, techniciens et votre commercial).</div>}
          {!estClient && contacts.length === 0 && clientsAvecFil.length === 0 && mesGroupes.length === 0 && mesClientsEnTantQueChef.length === 0 && clientsQuiMOntEcrit.length === 0 && !isAdmin && <div className="px-4 py-6 text-sm text-slate-400 text-center">Aucun contact pour l'instant — les autres membres de l'équipe apparaîtront ici dès leur création.</div>}
        </div>
      </div>

      {/* Fil de la conversation (sur mobile : affiché seulement quand un fil est ouvert) */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-sm flex-col ${conv ? "flex" : "hidden lg:flex"}`} style={{ minHeight: 420 }}>
        {!conv ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-6 text-center">Sélectionnez une conversation dans la liste pour lire et écrire des messages.</div>
        ) : (
          <>
            <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <button onClick={() => setConv(null)} className="lg:hidden text-sky-800 font-bold text-lg leading-none" aria-label="Retour">←</button>
              <span className="flex-1">{nomConv}</span>
              {groupeOuvert && isAdmin && (
                <>
                  <button onClick={() => setGestionMembres((v) => !v)} className="text-xs font-bold text-sky-800 underline whitespace-nowrap">Membres</button>
                  <button onClick={() => supprimerGroupe(groupeOuvert)} className="text-xs font-bold text-red-600 underline whitespace-nowrap">Supprimer</button>
                </>
              )}
            </div>
            {groupeOuvert && gestionMembres && isAdmin && (
              <div className="border-b border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Membres du groupe</div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {db.users.filter((u) => u.actif !== false).map((u) => {
                    const dedans = (groupeOuvert.membres || []).includes(u.id);
                    return (
                      <label key={u.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${dedans ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200"} ${u.id === profile.id ? "opacity-60" : ""}`}>
                        <input type="checkbox" checked={dedans} disabled={u.id === profile.id} onChange={() => basculerMembre(groupeOuvert, u.id)} />
                        <span className="font-semibold">{u.nom}</span>
                        <span className="text-slate-400">{libelleRole(u.role)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {groupeOuvert && !isAdmin && (
              <div className="border-b border-slate-100 px-4 py-1.5 text-xs text-slate-400">Membres : {(groupeOuvert.membres || []).map((id) => db.users.find((u) => u.id === id)?.nom).filter(Boolean).join(", ")}</div>
            )}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: "50vh" }}>
              {fil.length === 0 && <div className="text-center text-slate-400 text-sm py-8">Aucun message pour l'instant. Écrivez le premier !</div>}
              {fil.map((m) => (
                <div key={m.id} className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${m.de_id === profile.id ? "ml-auto bg-sky-800 text-white" : "bg-slate-100 text-slate-800"}`}>
                  {m.de_id !== profile.id && <div className="text-xs font-bold mb-0.5 opacity-70">{m.de_nom}</div>}
                  <div>{m.texte}</div>
                  <div className={`text-[10px] mt-1 ${m.de_id === profile.id ? "text-sky-200" : "text-slate-400"}`}>{dFR(m.date)} {String(m.ts || "").slice(11, 16)}</div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 flex gap-2">
              <input className={inputCls} placeholder="Votre message..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => e.key === "Enter" && envoyer()} />
              <button onClick={envoyer} className="px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 whitespace-nowrap">Envoyer</button>
            </div>
          </>
        )}
      </div>

      {creationGroupe && <CreationGroupeModal db={db} profile={profile} onFermer={() => setCreationGroupe(false)} onCreer={creerGroupe} />}
    </div>
  );
}

// Formulaire de création d'un groupe : nom + sélection des membres (admin uniquement)
function CreationGroupeModal({ db, profile, onFermer, onCreer }) {
  const [nom, setNom] = useState("");
  const [choisis, setChoisis] = useState([]);
  const candidats = db.users.filter((u) => u.id !== profile.id && u.actif !== false);

  const basculer = (id) => setChoisis((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className="fixed inset-0 z-[55] bg-black/50 flex items-center justify-center p-3" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="font-bold text-slate-900">👥 Nouveau groupe de discussion</div>
          <button onClick={onFermer} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
        <div className="overflow-auto p-4 space-y-4">
          <Field label="Nom du groupe">
            <input className={inputCls} placeholder="Ex. : Chantier Agoè, Équipe technique..." value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
          </Field>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Membres à ajouter ({choisis.length} sélectionné{choisis.length > 1 ? "s" : ""})</div>
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {candidats.map((u) => {
                const dedans = choisis.includes(u.id);
                return (
                  <label key={u.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer ${dedans ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200"}`}>
                    <input type="checkbox" checked={dedans} onChange={() => basculer(u.id)} />
                    <span className="font-semibold">{u.nom}</span>
                    <span className="text-slate-400">{libelleRole(u.role)}</span>
                  </label>
                );
              })}
              {candidats.length === 0 && <div className="text-xs text-slate-400 col-span-2">Aucun autre utilisateur actif.</div>}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
          <button onClick={onFermer} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => onCreer(nom, choisis)} disabled={!nom.trim() || choisis.length === 0} className={`${btnDark} disabled:opacity-40 disabled:cursor-not-allowed`}>Créer le groupe</button>
        </div>
      </div>
    </div>
  );
}

// Nombre total de messages non lus pour un utilisateur (badge de l'onglet)
function compterNonLus(db, profile) {
  const messages = db.messages || [];
  const groupes = db.groupes || [];
  return messages.filter((m) => {
    if (m.de_id === profile.id) return false;
    if ((m.lu_par || []).includes(profile.id)) return false;
    if (m.canal === "support") return peutVoirFilClient(profile, m.client_id, db);
    if (m.canal === "groupe") {
      if (profile.role === "admin") return true;
      const g = groupes.find((x) => x.id === m.groupe_id);
      return !!g && (g.membres || []).includes(profile.id);
    }
    return m.a_id === profile.id;
  }).length;
}

// Nombre de devis pas encore ouverts par cet utilisateur, dans la même
// visibilité que « Tous les devis » (l'admin et le resp. commercial voient
// tout ; les autres élaborateurs ne comptent que les leurs).
function compterNouveauxDevis(db, profile) {
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial";
  return db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => u.devis || [])
    .filter((d) => voitTout || d.par_id === profile.id)
    .filter((d) => !(d.vu_par || []).includes(profile.id))
    .length;
}

// ============ FRAIS D'INSTALLATION ============
// Les frais facturés au client sont répartis entre les techniciens présents sur le
// chantier. Le CHEF DU CHANTIER (désigné par l'administrateur, chantier par chantier)
// prend une part majorée : sa part de chef, PLUS une part du solde partagé.
const PART_CHEF_DEFAUT = 40;

// Qui peut intervenir sur un chantier
// Adresse publique de l'application, envoyée au client par WhatsApp.
const ADRESSE_APP = "https://app-bmi-iota.vercel.app";

// ============ COMPTES CLIENTS : IDENTIFIANTS AUTOMATIQUES ============
// Le client ne choisit rien : nom + téléphone suffisent.
//   Mot de passe = 4 DERNIERS chiffres du téléphone + 2 PREMIÈRES lettres du nom
//   Identifiant   = le nom ; si déjà pris, on y accole les 2 PREMIERS chiffres du numéro
// Le mot de passe est donc RECALCULABLE : on peut le renvoyer au client à tout
// moment, sans jamais le stocker en clair.
const chiffresTel = (tel) => String(tel || "").replace(/\D/g, "");
const lettresNom = (nom) => String(nom || "").replace(/[^A-Za-zÀ-ÿ]/g, "").toUpperCase();

function motDePasseClient(nom, tel) {
  const d = chiffresTel(tel);
  const quatre = d.slice(-4).padStart(4, "0");
  const deux = (lettresNom(nom).slice(0, 2) || "XX").padEnd(2, "X");
  return quatre + deux; // 6 caractères : le minimum exigé par Supabase
}

function identifiantClient(db, nom, tel) {
  const base = String(nom || "").trim().toUpperCase();
  const pris = (n) => (db.users || []).some((u) => String(u.nom).toUpperCase() === n);
  if (!pris(base)) return base;
  const d = chiffresTel(tel);
  const avecDeux = base + d.slice(0, 2);   // collision : on ajoute les 2 premiers chiffres
  if (!pris(avecDeux)) return avecDeux;
  const avecQuatre = base + d.slice(0, 4); // collision encore : on en ajoute 4
  if (!pris(avecQuatre)) return avecQuatre;
  let i = 2;
  while (pris(base + d.slice(0, 2) + i)) i++;
  return base + d.slice(0, 2) + i;
}

// Crée le compte client et renvoie { user, motDePasse }. Le rôle est IMPOSÉ.
// Ouvre WhatsApp avec les identifiants du client — un seul message, réutilisé
// partout (Utilisateurs, Clients installés, Dimensionnement, Parrainage).
function envoyerIdentifiantsWhatsApp(nomAffiche, identifiant, motDePasse, tel) {
  const lignes = [
    `Bonjour ${String(nomAffiche || "").toUpperCase()},`,
    ``,
    `Bienvenue chez BMI TOGO ! Voici votre espace personnel pour suivre votre installation solaire :`,
    ADRESSE_APP,
    ``,
    `👤 Identifiant : *${identifiant}*`,
    `🔑 Mot de passe : *${motDePasse}*`,
    ``,
    `À bientôt !`,
    `BMI TOGO — Les bâtiments modernes et intelligents`,
  ];
  const num = telDigits(tel);
  const txt = encodeURIComponent(lignes.join("\n"));
  window.open(num ? `https://wa.me/${num}?text=${txt}` : `https://wa.me/?text=${txt}`, "_blank");
}

async function fabriquerCompteClient(db, nom, tel, parQui) {
  const identifiant = identifiantClient(db, nom, tel);
  const motDePasse = motDePasseClient(nom, tel);
  const user = {
    id: uid(),
    nom: identifiant,
    nom_base: String(nom || "").trim().toUpperCase(), // sert à RECALCULER le mot de passe
    tel: String(tel || "").trim(),
    pwd_hash: await hacher(motDePasse),
    role: "client",            // ← imposé : ce chemin ne crée QUE des clients
    boutique: null,
    actif: true,
    mdp_auto: true,
    cree_par: parQui,
  };
  return { user, motDePasse };
}

// Retrouve le mot de passe d'un compte client généré automatiquement.
const motDePasseConnu = (u) => (u && u.mdp_auto && u.tel ? motDePasseClient(u.nom_base || u.nom, u.tel) : null);

// ============ RÉINITIALISATION : QUI, ET DEPUIS OÙ ============
// La réinitialisation efface TOUT. Elle est donc réservée :
//   1. au LOGICIEL WINDOWS (le .exe) — jamais depuis le site web,
//   2. à l'ADMINISTRATEUR PRINCIPAL — jamais à un autre administrateur.
// Un administrateur qui se connecte depuis Vercel, même légitime, ne peut rien
// effacer : il faut être physiquement sur la machine de direction.
const estAppWindows = () => typeof navigator !== "undefined" && /electron/i.test(navigator.userAgent || "");

// L'administrateur principal est celui qui porte le drapeau. À défaut, c'est le
// PREMIER administrateur créé (les comptes sont ajoutés en fin de liste).
const adminPrincipal = (db) =>
  (db.users || []).find((u) => u.admin_principal && u.role === "admin" && u.actif !== false) ||
  (db.users || []).find((u) => u.role === "admin" && u.actif !== false) || null;

const estAdminPrincipal = (db, profile) => {
  const p = adminPrincipal(db);
  return !!p && p.id === profile.id;
};

// Code aléatoire à recopier : impossible à taper machinalement, contrairement
// à un mot toujours identique.
const codeConfirmation = () => {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1 : illisibles
  let c = "";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  c += "-";
  for (let i = 0; i < 3; i++) c += L[Math.floor(Math.random() * L.length)];
  return c;
};

// ============ NOTE DU DIMENSIONNEMENT (texte modifiable) ============
// Le texte affiché sous le tableau des équipements proposés. Modifiable par
// l'administrateur (⚙ Paramètres). Rangé dans la fiche boutique — comme le
// message du reçu — donc AUCUNE migration de base.
const NOTE_DIM_DEFAUT = "Calcul indicatif basé sur des marges de sécurité usuelles (pertes système 20 %, convertisseur dimensionné à 2 fois la puissance totale des appareils). Les équipements « hors stock » saisis manuellement ne modifient aucun stock lors de la vente — pensez à les commander séparément si besoin. Un article contenant le mot « hybride » est considéré comme intégrant déjà le chargeur MPPT.";
const noteDimensionnement = (db) => {
  const b = (db.boutiques || []).find((x) => typeof x.note_dim === "string");
  return b ? b.note_dim : NOTE_DIM_DEFAUT;
};

// ============ DOSSIER DE CHANTIER ============
// Compresse une photo avant stockage : sans cela, quelques clichés suffiraient
// à saturer la base. Cible : ~1000 px de large, qualité 55 % → environ 80 Ko.
function compresserPhoto(fichier, maxLargeur = 1000, qualite = 0.55) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error("Lecture impossible"));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const ratio = Math.min(1, maxLargeur / img.width);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", qualite));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}
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
const statutChantier = (c) => c.statut || "en_cours";
const chefDuChantier = (c) => (c.equipe || []).find((e) => e.chef);
// Le chef de CE chantier, ou l'administrateur, peut le déclarer terminé.
const peutTerminer = (c, profile, isAdmin) =>
  statutChantier(c) === "en_cours" && (isAdmin || chefDuChantier(c)?.user_id === profile.id);

const techniciensDispo = (db) => (db.users || []).filter((u) => {
  if (u.actif === false) return false;
  if (!["technicien", "technicien_bmi"].includes(u.role)) return false;
  // Le technicien BMI est salarié : toujours affectable. Seul le technicien
  // COMMISSION peut se retirer en se déclarant indisponible.
  if (u.role === "technicien" && u.indisponible === true) return false;
  return true;
});

// Calcule la répartition proposée : chef = part_chef + une part égale du reste.
function repartitionProposee(equipeIds, chefId, partChef) {
  const n = equipeIds.length;
  if (!n) return {};
  const reste = Math.max(0, 100 - Number(partChef || 0));
  const partEgale = reste / n;
  const r = {};
  equipeIds.forEach((id) => {
    r[id] = Math.round((partEgale + (id === chefId ? Number(partChef || 0) : 0)) * 10) / 10;
  });
  return r;
}

const fraisRepartis = (c) => (c.equipe || []).reduce((s, e) => s + Number(e.montant || 0), 0);

// ============ CLIENTS INSTALLÉS (parc client) ============
const TYPES_INSTALLATION = ["Solaire résidentiel", "Solaire commercial", "Pompage solaire", "Éclairage public", "Kit autonome", "Autre"];

function ClientsInstalles({ db, save, profile, isAdmin }) {
  const estChef = !!profile.chef_equipe;
  const estTechnicien = profile.role === "technicien";
  const voitTout = isAdmin || estChef || estTechnicien;

  const vide = { nom: "", prenom: "", tel: "", type_installation: TYPES_INSTALLATION[0], date_installation: today(), date_entretien: "", localisation: "", lat: null, lng: null, user_id: "", vente_id: "", garantie_mois: "24", equipe_prevue: [], chef_prevu: "", materiel: [] };
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
    const motDePasse = motDePasseClient(nom, tel);
    if (!await uConfirm(
      `Créer le compte client de ${nom.toUpperCase()} ?\n\n` +
      `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
      `Remettez-lui ces identifiants : c'est avec eux qu'il suivra son installation et réceptionnera les travaux.`
    )) return;

    const { user } = await fabriquerCompteClient(db, nom, tel, profile.nom);
    save({ ...db, users: [...db.users, user] }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}`);
    setF((p) => ({ ...p, user_id: user.id }));
    // Envoi automatique des identifiants par WhatsApp.
    if (await uConfirm(`✅ Compte créé.\n\n👤 ${identifiant}\n🔑 ${motDePasse}\n\nEnvoyer ces identifiants au client par WhatsApp ?`)) {
      envoyerIdentifiantsWhatsApp(nom, identifiant, motDePasse, tel);
    }
  };

  // ---- MATÉRIEL POSÉ ----
  const [mat, setMat] = useState({ nom: "", qte: "", serie: "" });

  // Reprend automatiquement les articles de la vente rattachée : plus de double saisie.
  const chargerDepuisVente = (venteId) => {
    const v = db.ventes.find((x) => x.id === venteId);
    if (!v) { setF((p) => ({ ...p, vente_id: "" })); return; }
    const lignes = lignesVente(v).map((l) => ({ nom: l.article, qte: Number(l.qte), serie: "" }));
    setF((p) => ({
      ...p,
      vente_id: venteId,
      materiel: lignes,
      nom: p.nom || (v.client ? v.client.split(" ").slice(-1)[0] : ""),
      tel: p.tel || v.tel || "",
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
    if (!isAdmin && c.commercial !== profile.nom) { uAlert("Seul l'administrateur ou le commercial rattaché peut supprimer cette fiche."); return; }
    if (await uConfirm(`Supprimer la fiche de « ${c.prenom || ""} ${c.nom} » ?`)) {
      save({ ...db, clients_installes: db.clients_installes.filter((x) => x.id !== c.id) }, `Suppression fiche client installé « ${c.nom} »`);
    }
  };

  // ---- FRAIS D'INSTALLATION ----
  // L'admin saisit les frais facturés, désigne le chef DU CHANTIER, coche les
  // techniciens présents, et l'application propose la répartition.
  const [chantier, setChantier] = useState(null); // fiche en cours de répartition
  const [rep, setRep] = useState({ frais: "", chef: "", partChef: String(PART_CHEF_DEFAUT), equipe: [], pcts: {} });
  const techs = techniciensDispo(db);
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
    const nouveauxMembres = equipe.filter((e) => !idsAvant.has(e.user_id) || dateAvant !== p.date);
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

    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, date_installation: p.date, equipe, a_programmer: false }
        : x)),
      messages: [...messagesNotif, ...(db.messages || [])],
    }, `📅 Installation de ${c.prenom} ${c.nom} programmée le ${dFR(p.date)} — chef ${db.users.find((u) => u.id === p.chef)?.nom || "?"}`);
    uAlert(`✅ Installation programmée le ${dFR(p.date)}.\n\nLe chef d'équipe pourra marquer les travaux terminés le jour venu.${messagesNotif.length ? `\n\n${messagesNotif.length} membre(s) de l'équipe ont été notifiés par message.` : ""}`);
  };

  // ---- LE CHEF DE CHANTIER DÉCLARE LES TRAVAUX TERMINÉS ----
  const marquerTermine = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    const compte = db.users.find((u) => u.id === c.user_id);
    if (!await uConfirm(
      `Déclarer l'installation de ${c.nom} ${c.prenom} TERMINÉE ?\n\n` +
      (compte
        ? `Le client verra alors un bouton « Je réceptionne les travaux » dans son espace.`
        : `⚠ Ce client n'a PAS de compte : il ne pourra pas réceptionner depuis l'application.\nRattachez-lui un compte client pour cela.`)
    )) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, statut: "termine", termine_par: profile.nom, date_fin: today() }
        : x)),
    }, `Installation ${c.nom} ${c.prenom} déclarée TERMINÉE par ${profile.nom}`);
    uAlert(compte
      ? "✅ Travaux déclarés terminés. Le client peut maintenant les réceptionner depuis son espace."
      : "✅ Travaux déclarés terminés. (Ce client n'a pas de compte : la réception ne pourra pas se faire dans l'application.)");
  };

  // L'administrateur peut lever des réserves une fois corrigées
  const releverReserves = async (c) => {
    if (!isAdmin) return;
    if (!await uConfirm(`Les réserves de ${c.nom} ${c.prenom} ont-elles été corrigées ?\n\nLe chantier repassera « Terminé », et le client pourra réceptionner à nouveau.`)) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, statut: "termine", reserves_levees_le: today(), reserves_levees_par: profile.nom }
        : x)),
    }, `Réserves levées — ${c.nom} ${c.prenom} (par ${profile.nom})`);
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
    if (Math.abs(totalPct - 100) > 0.5) { uAlert(`Le total des pourcentages fait ${totalPct} % — il doit faire 100 %.`); return; }
    const equipe = rep.equipe.map((id) => {
      const u = db.users.find((x) => x.id === id);
      const pct = Number(rep.pcts[id] || 0);
      return { user_id: id, nom: u ? u.nom : "?", pct, montant: Math.round((fraisRep * pct) / 100), chef: id === rep.chef, paye: false };
    });
    const resume = equipe.map((e) => `${e.chef ? "⭐ " : ""}${e.nom} : ${e.pct} % = ${fmt(e.montant)}`).join("\n");
    if (!await uConfirm(`Répartir ${fmt(fraisRep)} de frais d'installation ?\n\n${resume}\n\nLes techniciens verront leur part. Le paiement se fait ensuite, technicien par technicien.`)) return;
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, frais_installation: fraisRep, chef_id: rep.chef, part_chef: Number(rep.partChef), equipe, date_repartition: today(), par_repartition: profile.nom }
        : x)),
    }, `Frais d'installation de ${fmt(fraisRep)} répartis — chantier ${c.nom} (chef : ${equipe.find((e) => e.chef)?.nom})`);
    setChantier(null);
    uAlert("✅ Répartition enregistrée.");
  };

  // Paiement de la part d'un technicien → vraie sortie de caisse
  const payerPart = async (c, e) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!isAdmin) { uAlert("Seul l'administrateur paie les parts d'installation."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${e.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const noms = boutiquesVente(db).map((b) => b.nom);
    let bq = noms[0] || "";
    if (noms.length > 1) {
      const r = await uPrompt(`Boutique dont la caisse est débitée ? (${noms.join(" / ")})`, noms[0]);
      if (r === null) return;
      bq = String(r).trim().toUpperCase();
      if (!noms.includes(bq)) { uAlert("Boutique inconnue."); return; }
    }
    if (!await uConfirm(`Payer ${fmt(e.montant)} à ${e.nom} pour l'installation de ${c.nom} ?\n\nSortie de caisse ${bq} : ${fmt(e.montant)}`)) return;
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Prime d'installation",
      description: `Installation ${c.nom} — ${e.nom}${e.chef ? " (chef de chantier)" : ""} · ${e.pct} %`,
      montant: e.montant, paiement: normPaiement(moyen), par: profile.nom, auto: "installation", user_id: e.user_id,
    };
    save({
      ...db,
      clients_installes: db.clients_installes.map((x) => (x.id === c.id
        ? { ...x, equipe: (x.equipe || []).map((y) => (y.user_id === e.user_id ? { ...y, paye: true, date_paiement: today() } : y)) }
        : x)),
      depenses: [dep, ...db.depenses],
    }, `Part d'installation payée : ${fmt(e.montant)} à ${e.nom} (chantier ${c.nom})`);
    uAlert(`✅ ${fmt(e.montant)} payés à ${e.nom}.`);
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

  let liste = voitTout ? (db.clients_installes || []) : (db.clients_installes || []).filter((c) => c.commercial === profile.nom);
  if (q) liste = liste.filter((c) => (String(c.nom) + " " + String(c.prenom) + " " + String(c.tel) + " " + String(c.type_installation)).toLowerCase().includes(q.toLowerCase()));
  if (filtreEntretien) liste = liste.filter((c) => c.date_entretien && c.date_entretien <= today());

  const entretiensDus = (voitTout ? (db.clients_installes || []) : (db.clients_installes || []).filter((c) => c.commercial === profile.nom)).filter((c) => c.date_entretien && c.date_entretien <= today()).length;

  const commerciauxActifs = db.users.filter((u) => ["commercial", "technicien"].includes(u.role) && u.actif !== false);

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
        </div>
        {carteOuverte && <div className="mt-3"><CarteChoixPosition lat={f.lat} lng={f.lng} onChoisir={(lat, lng) => setF({ ...f, lat, lng })} /></div>}
        {/* ---- ÉQUIPE PRÉVUE ---- */}
        <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="font-bold text-sm text-sky-900 mb-1">👷 Équipe prévue sur le chantier</div>
          <div className="text-xs text-slate-500 mb-2">Cochez les techniciens, puis désignez le chef ⭐. C'est lui qui pourra déclarer les travaux terminés.</div>
          {techs.length === 0 ? (
            <div className="text-xs text-slate-400">Aucun technicien enregistré.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {techs.map((t) => {
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
                  {techs.length === 0 ? (
                    <div className="text-xs text-slate-400">Aucun technicien enregistré.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {techs.map((t) => {
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
              <div className="flex items-end text-sm font-bold text-slate-600">
                Total réparti : <span className={`ml-2 tabular-nums ${Math.abs(totalPct - 100) > 0.5 ? "text-red-600" : "text-green-700"}`}>{Math.round(totalPct * 10) / 10} %</span>
              </div>
            </div>

            <div className="mt-4 text-xs font-bold text-slate-500 uppercase mb-2">Techniciens présents sur le chantier</div>
            {techs.length === 0 ? (
              <div className="text-sm text-slate-400">Aucun technicien actif. Créez des comptes Technicien ou Technicien BMI.</div>
            ) : (
              <div className="space-y-2">
                {techs.map((u) => {
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
                          : <span className="text-xs font-bold text-orange-600">⏳ À payer</span>}</td>
                        <td className="px-3 py-2">
                          {!e.paye && isAdmin && <button onClick={() => payerPart(c, e)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900">✓ Payer</button>}
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
        <table className="w-full text-sm min-w-[820px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Numéro", "Installation", "Installé le", "Entretien", "Localisation", "Commercial", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun client installé{q ? " ne correspond à la recherche" : " pour l'instant"}.</td></tr>}
            {liste.map((c) => {
              const entretienDu = c.date_entretien && c.date_entretien <= today();
              return (
                <tr key={c.id} className={`border-t border-slate-100 hover:bg-sky-50 ${entretienDu ? "bg-orange-50" : ""}`}>
                  <td className="px-3 py-2 font-semibold">{c.prenom} {c.nom}{c.user_id ? " 🔑" : ""}
                    <div className={`text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 ${STATUT_CHANTIER[statutChantier(c)].couleur}`}>
                      {STATUT_CHANTIER[statutChantier(c)].label}
                    </div>
                    {c.a_programmer && !c.date_installation && (
                      <div className="text-[10px] font-bold mt-1 inline-block rounded border px-1.5 py-0.5 bg-purple-50 text-purple-700 border-purple-200 ml-1">
                        📅 À PROGRAMMER
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
                    {statutChantier(c) === "reserves" && isAdmin && (
                      <button onClick={() => releverReserves(c)} className="text-xs font-bold text-white bg-red-600 rounded px-2 py-1 hover:bg-red-700 mr-2">↻ Réserves levées</button>
                    )}
                    <button onClick={() => ouvrirRepartition(c)} className="text-xs font-bold text-purple-700 underline mr-2">
                      🔧 Frais {Number(c.frais_installation || 0) > 0 ? `(${fmt(c.frais_installation)})` : ""}
                    </button>
                    <button onClick={() => modifierEntretien(c)} className="text-xs font-bold text-sky-800 underline mr-2">Entretien</button>
                    {isAdmin && !c.user_id && <button onClick={() => lierCompte(c)} className="text-xs font-bold text-sky-800 underline mr-2">Lier un compte</button>}
                    {(isAdmin || c.commercial === profile.nom) && <button onClick={() => supprimer(c)} className="text-xs text-red-600 underline">Suppr.</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">🔑 = fiche liée à un compte d'accès client. ⚠ fond orange = entretien dû. Les commerciaux ne voient que leurs propres clients ; l'administrateur, les techniciens et les chefs d'équipe voient tout le parc.</div>
    </div>
  );
}

// ============ MON ÉQUIPE (chef d'équipe commercial) ============
function MonEquipe({ db, save, profile }) {
  const estAdmin = profile.role === "admin";
  const [periode, setPeriode] = useState("mois");
  const bornes = () => {
    if (periode === "mois") return [today().slice(0, 7) + "-01", today()];
    if (periode === "annee") return [today().slice(0, 4) + "-01-01", today()];
    return ["2000-01-01", today()];
  };
  const [debut, fin] = bornes();

  // Tous ceux qui peuvent toucher une commission : commerciaux, techniciens,
  // mais aussi tout autre employé qui a un taux ou des ventes à son nom.
  const equipe = db.users.filter((u) => u.actif !== false && u.role !== "client" && (
    ["commercial", "technicien", "technicien_bmi"].includes(u.role) ||
    Number(u.taux_commission || 0) > 0 ||
    db.ventes.some((v) => v.commercial === u.nom)
  ));

  const stats = equipe.map((u) => {
    const ventes = db.ventes.filter((v) => v.commercial === u.nom && inP(v.date, debut, fin));
    const enAttente = ventes.filter((v) => !v.commission_payee);
    const reglees = ventes.filter((v) => v.commission_payee);
    const ca = ventes.reduce((s, v) => s + totalVente(v), 0);
    const caAttente = enAttente.reduce((s, v) => s + totalVente(v), 0);
    const caRegle = reglees.reduce((s, v) => s + totalVente(v), 0);
    const taux = Number(u.taux_commission || 0);
    return {
      u, nbVentes: ventes.length, ca, caAttente, caRegle, nbReglees: reglees.length,
      commissionDue: enAttente.reduce((s, v) => s + commissionVente(v, taux), 0),
      commissionReglee: Math.round((caRegle * taux) / 100),
      prospects: db.prospects.filter((p) => p.commercial === u.nom).length,
      commandesAttente: (db.commandes || []).filter((c) => c.commercial === u.nom && c.statut === "en_attente").length,
    };
  }).sort((a, b) => b.ca - a.ca);

  const totalCA = stats.reduce((s, x) => s + x.ca, 0);
  const totalDu = stats.reduce((s, x) => s + x.commissionDue, 0);

  // Annulation d'un règlement de commission : réservée à l'administrateur.
  // Remet les ventes réglées de la période en « commission due » (en cas
  // d'erreur de validation). Tracé dans l'historique.
  const annulerPaiement = async (st) => {
    if (!estAdmin) return;
    if (st.nbReglees === 0) { uAlert("Aucune commission réglée à annuler pour " + st.u.nom + " sur cette période."); return; }
    if (!await uConfirm(`⚠ ANNULER le règlement de commission de ${st.u.nom} sur cette période ?\n\n${st.nbReglees} vente(s) réglée(s), soit ${fmt(st.commissionReglee)} de commission, redeviendront « à payer ».`)) return;
    const ventesConcernees = db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && v.commission_payee);
    const ids = new Set(ventesConcernees.map((v) => v.id));
    // On retire aussi les dépenses « Commissions » générées par ces paiements
    const depsAnnulees = new Set(ventesConcernees.map((v) => v.commission_dep).filter(Boolean));
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: false, commission_dep: null } : v)),
      depenses: db.depenses.filter((d) => !depsAnnulees.has(d.id)),
    }, `ANNULATION règlement commission de ${st.u.nom} : ${fmt(st.commissionReglee)} remis à payer (par ${profile.nom})`);
  };

  // ---- APPORTEURS EXTERNES (non-utilisateurs) ----
  // Regroupés par nom + téléphone, sur la période choisie.
  const apporteursExt = (() => {
    const g = {};
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom && inP(v.date, debut, fin)).forEach((v) => {
      const cle = `${v.apporteur.nom}|${v.apporteur.tel || ""}`;
      if (!g[cle]) g[cle] = { nom: v.apporteur.nom, tel: v.apporteur.tel || "", taux: Number(v.apporteur.taux || 0), nb: 0, ca: 0, due: 0, payee: 0, ventes: [] };
      const m = Number(v.apporteur.montant || 0);
      g[cle].nb += 1;
      g[cle].ca += totalVente(v);
      // Une part bloquée (installation non réceptionnée) n'est pas encore exigible.
      if (v.apporteur.payee) g[cle].payee += m;
      else if (v.apporteur.a_la_reception) { g[cle].attente = (g[cle].attente || 0) + m; }
      else { g[cle].due += m; g[cle].ventes.push(v.id); }
    });
    return Object.values(g).sort((a, b) => b.due - a.due);
  })();

  const totalExtDu = apporteursExt.reduce((s, a) => s + a.due, 0);

  // ---- COMMISSIONS D'ÉQUIPE (les chefs touchent un % sur leurs filleuls) ----
  const chefs = db.users.filter((u) => u.actif !== false && estChefEquipe(db, u) && filleulsDe(db, u).length > 0)
    .map((u) => {
      const tauxEq = Number(u.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
      let due = 0, versees = 0, ventesDues = [];
      filleulsDe(db, u).forEach((fu) => {
        const tu = Number(fu.taux_commission || 0);
        db.ventes.filter((v) => v.commercial === fu.nom && inP(v.date, debut, fin)).forEach((v) => {
          const part = Math.round((commissionVente(v, tu) * tauxEq) / 100);
          if (v.override_payee) versees += part; else { due += part; ventesDues.push(v.id); }
        });
      });
      return { u, tauxEq, nbFilleuls: filleulsDe(db, u).length, due, versees, ventesDues };
    })
    .filter((c) => c.due > 0 || c.versees > 0);

  const totalEquipeDu = chefs.reduce((s, c) => s + c.due, 0);

  const payerCommissionEquipe = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (c.due <= 0) { uAlert("Aucune commission d'équipe en attente pour " + c.u.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${c.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, c.u, `Commission d'équipe de ${fmt(c.due)} à ${c.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer ${fmt(c.due)} de commission d'équipe à ${c.u.nom} ?\n\n${c.tauxEq} % sur les commissions de ses ${c.nbFilleuls} recrue(s).\nSortie de caisse ${bq} : ${fmt(c.due)}`)) return;
    const ids = new Set(c.ventesDues);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission d'équipe — ${c.u.nom} (${c.tauxEq} % sur ${c.nbFilleuls} recrue(s))`,
      montant: c.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_equipe", user_id: c.u.id,
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, override_payee: true } : v)),
      depenses: [dep, ...db.depenses],
    }, `Commission d'équipe payée à ${c.u.nom} : ${fmt(c.due)}`);
    uAlert(`✅ ${fmt(c.due)} payés à ${c.u.nom}.`);
  };

  // Nombre de CLIENTS DISTINCTS apportés depuis toujours (pas seulement sur la période)
  const clientsApportes = (a) => {
    const clients = new Set();
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom === a.nom && (v.apporteur.tel || "") === a.tel)
      .forEach((v) => clients.add(((v.client || "") + "|" + (v.tel || "")).trim().toLowerCase()));
    clients.delete("|");
    return clients.size;
  };
  const dejaUtilisateur = (a) => db.users.some((u) => u.nom.trim().toLowerCase() === a.nom.trim().toLowerCase());

  // Promotion : l'apporteur externe devient un COMMERCIAL avec son propre compte
  const promouvoir = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    const n = clientsApportes(a);
    const identifiant = await uPrompt(
      `🎖 ${a.nom} a apporté ${n} client(s).\n\nLe promouvoir COMMERCIAL : il aura son propre compte, ses prospects, ses commandes et son onglet « Ma commission ».\n\nIdentifiant de connexion :`,
      a.nom.trim().toUpperCase().split(" ")[0]
    );
    if (identifiant === null) return;
    const nom = identifiant.trim().toUpperCase();
    if (!nom) { uAlert("Identifiant obligatoire."); return; }
    if (db.users.some((u) => u.nom.toUpperCase() === nom)) { uAlert("Cet identifiant existe déjà."); return; }
    const pwd = await uPrompt("Mot de passe provisoire (6 caractères minimum) :", "");
    if (pwd === null) return;
    if (String(pwd).length < 6) { uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const tx = await uPrompt("Taux de commission (%) :", String(a.taux || 5));
    if (tx === null) return;
    const taux = Math.max(0, Math.min(100, Number(tx) || 0));
    if (!await uConfirm(`Créer le compte COMMERCIAL « ${nom} » pour ${a.nom} avec ${taux} % de commission ?`)) return;
    const pwd_hash = await hacher(String(pwd));
    const nouvel = {
      id: uid(), nom, pwd_hash, role: "commercial", boutique: null, actif: true,
      taux_commission: taux, nom_complet: a.nom, tel: a.tel || "", promu_de: "apporteur_externe", date_promotion: today()
    };
    save({
      ...db,
      users: [...db.users, nouvel],
      commerciaux: [...(db.commerciaux || []), { id: uid(), nom, tel: a.tel || "", taux, actif: true }]
    }, `🎖 ${a.nom} promu COMMERCIAL (${n} clients apportés) — compte « ${nom} », commission ${taux} %`);
    uAlert(`🎖 ${a.nom} est désormais Commercial !\n\nIdentifiant : ${nom}\nMot de passe : ${pwd}\n\nDemandez-lui de le changer à la première connexion.`);
  };

  const payerApporteur = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    if (a.due <= 0) { uAlert("Aucune commission en attente pour " + a.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${a.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const noms = db.boutiques.filter((b) => !b.depot).map((b) => b.nom);
    let bq = noms[0] || "";
    if (noms.length > 1) {
      const r = await uPrompt(`Boutique dont la caisse est débitée ? (${noms.join(" / ")})`, noms[0]);
      if (r === null) return;
      bq = String(r).trim().toUpperCase();
      if (!noms.includes(bq)) { uAlert("Boutique inconnue."); return; }
    }
    if (!await uConfirm(`Payer ${fmt(a.due)} de commission à ${a.nom}${a.tel ? ` (${a.tel})` : ""} ?\n\n${a.ventes.length} vente(s) concernée(s).\nSortie de caisse ${bq} : ${fmt(a.due)}.`)) return;
    const ids = new Set(a.ventes);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission apporteur externe — ${a.nom}${a.tel ? ` (${a.tel})` : ""}`,
      montant: a.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_ext"
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, apporteur: { ...v.apporteur, payee: true, date_paiement: today(), par: profile.nom } } : v)),
      depenses: [dep, ...db.depenses]
    }, `Commission de ${fmt(a.due)} payée à l'apporteur externe ${a.nom}`);
    uAlert(`✅ ${fmt(a.due)} payés à ${a.nom}. Dépense enregistrée.`);
  };

  // Assigner une tâche à un agent (stockée dans sa fiche : visible dans son onglet ✅ Mes tâches)
  const assignerTache = async (st) => {
    const titre = await uPrompt(`Tâche à assigner à ${st.u.nom} :`, "");
    if (titre === null) return;
    if (!titre.trim()) { uAlert("Le titre de la tâche est obligatoire."); return; }
    const detail = await uPrompt("Détails (facultatif) :", "");
    if (detail === null) return;
    const ech = await uPrompt("Échéance (AAAA-MM-JJ, facultatif) :", "");
    if (ech === null) return;
    if (ech.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(ech.trim())) { uAlert("Format attendu : AAAA-MM-JJ (ex : 2026-07-20)."); return; }
    const tache = { id: uid(), titre: titre.trim(), detail: detail.trim(), echeance: ech.trim() || null, statut: "a_faire", par: profile.nom, date: today() };
    save({ ...db, users: db.users.map((x) => (x.id === st.u.id ? { ...x, taches: [...(x.taches || []), tache] } : x)) },
      `Tâche assignée à ${st.u.nom} : ${titre.trim()}`);
    uAlert(`✅ Tâche assignée à ${st.u.nom}.`);
  };

  const payerCommission = async (st) => {
    if (bloquerSiLecture(db, profile)) return;
    if (st.commissionDue === 0) { uAlert("Aucune commission en attente pour " + st.u.nom + " sur cette période."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${st.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, st.u, `Commission de ${fmt(st.commissionDue)} à ${st.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer la commission de ${st.u.nom} ?\n\nMontant : ${fmt(st.commissionDue)} (${fmt(st.caAttente)} de ventes × ${st.u.taux_commission ?? 0} %)\n\nSortie de caisse ${bq} : ${fmt(st.commissionDue)}\nElle sera enregistrée en dépense « Commissions ».\n\nCes ventes ne seront plus comptées (action définitive).`)) return;
    const ids = new Set(db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && !v.commission_payee).map((v) => v.id));
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission — ${st.u.nom} (${ids.size} vente(s))`,
      montant: st.commissionDue, paiement: normPaiement(moyen), par: profile.nom, auto: "commission", user_id: st.u.id
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: true, commission_dep: dep.id } : v)),
      depenses: [dep, ...db.depenses]
    }, `Commission payée à ${st.u.nom} : ${fmt(st.commissionDue)} (validée par ${profile.nom})`);
    uAlert(`✅ ${fmt(st.commissionDue)} payés à ${st.u.nom}. Dépense « Commissions » enregistrée.`);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">👑 Mon équipe — vue d'ensemble</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Commerciaux actifs</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{equipe.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">CA de l'équipe</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(totalCA)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commissions à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(totalDu)}</div>
          </div>
        </div>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Performances par commercial</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial", "Ventes", "Chiffre d'affaires", "Commission due", "Prospects", "Commandes en attente", "Tâches", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {stats.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun commercial actif.</td></tr>}
            {stats.map((st) => (
              <tr key={st.u.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 font-semibold">{st.u.nom}{st.u.chef_equipe ? " ⭐" : ""}{st.u.role === "technicien" ? " 🔧" : ""}{st.u.role === "technicien_bmi" ? " 🔧 (salarié)" : ""}</td>
                <td className="px-3 py-2 tabular-nums">{st.nbVentes}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(st.ca)}</td>
                <td className="px-3 py-2 tabular-nums font-bold text-green-700">{fmt(st.commissionDue)}</td>
                <td className="px-3 py-2 tabular-nums">{st.prospects}</td>
                <td className="px-3 py-2 tabular-nums">{st.commandesAttente}</td>
                <td className="px-3 py-2 tabular-nums">{tachesOuvertes(st.u).length > 0 ? <span className="font-bold text-amber-600">{tachesOuvertes(st.u).length} en cours</span> : <span className="text-slate-400">—</span>}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {aDroit(db, profile, "act_taches") && <button onClick={() => assignerTache(st)} className="text-xs font-bold text-sky-800 underline mr-2">✅ Tâche</button>}
                  {st.commissionDue > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommission(st)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Marquer payé</button>}
                  {estAdmin && st.nbReglees > 0 && <button onClick={() => annulerPaiement(st)} className="text-xs font-bold text-red-700 border border-red-300 rounded px-2 py-1 hover:bg-red-50">↩ Annuler paiement</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chefs.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-amber-800 border-b border-amber-200 bg-amber-50 flex flex-wrap justify-between gap-2">
            <span>⭐ Chefs d'équipe — commissions sur leurs recrues</span>
            <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalEquipeDu)}</b></span>
          </div>
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Chef d'équipe", "Recrues", "Taux d'équipe", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {chefs.map((c) => (
                <tr key={c.u.id} className="border-t border-slate-100 hover:bg-amber-50">
                  <td className="px-3 py-2 font-semibold">{c.u.nom_complet || c.u.nom}</td>
                  <td className="px-3 py-2 tabular-nums">{c.nbFilleuls}</td>
                  <td className="px-3 py-2 tabular-nums">{c.tauxEq} %</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(c.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(c.versees)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommissionEquipe(c)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">✓ Payer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>🤝 Apporteurs externes</span>
          <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalExtDu)}</b></span>
        </div>
        {apporteursExt.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun apporteur externe sur cette période. Renseignez-le au moment de la vente (💰 Ventes → 🤝 Apporteur externe).</div>
        ) : (
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Apporteur", "Téléphone", "Clients apportés", "Ventes", "CA apporté", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {apporteursExt.map((a) => (
                <tr key={a.nom + a.tel} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{a.nom}
                    {clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <div className="text-xs font-bold text-amber-600">🎖 Éligible commercial</div>}
                    {dejaUtilisateur(a) && <div className="text-xs font-bold text-green-700">✅ Déjà commercial</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{a.tel || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`tabular-nums font-bold ${clientsApportes(a) >= SEUIL_COMMERCIAL ? "text-amber-600" : "text-slate-700"}`}>{clientsApportes(a)}</span>
                    <span className="text-xs text-slate-400"> / {SEUIL_COMMERCIAL}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{a.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(a.ca)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(a.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(a.payee)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerApporteur(a)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Payer</button>}
                    {estAdmin && clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <button onClick={() => promouvoir(a)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">🎖 Promouvoir commercial</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-slate-400">Le chiffre d'affaires inclut toutes les ventes de la période ; la commission due ne compte que les ventes pas encore réglées. 🔧 = technicien, ⭐ = chef d'équipe. Le paiement d'un apporteur externe est enregistré en dépense.</div>
    </div>
  );
}

// ============ MA COMMISSION (commerciaux et techniciens) ============
function MaCommission({ db, profile }) {
  const [periode, setPeriode] = useState("mois");
  const [pa, setPa] = useState(today().slice(0, 8) + "01");
  const [pb, setPb] = useState(today());

  const bornes = () => {
    if (periode === "mois") { const d = today().slice(0, 7); return [d + "-01", today()]; }
    if (periode === "annee") { const d = today().slice(0, 4); return [d + "-01-01", today()]; }
    if (periode === "tout") return ["2000-01-01", today()];
    return [pa, pb];
  };
  const [debut, fin] = bornes();

  // Une vente déjà réglée au commercial (payee_commission = true) n'entre plus
  // dans le calcul de la commission due — elle a déjà été comptabilisée.
  const mesVentesTotales = db.ventes.filter((v) => (v.commercial === profile.nom || v.responsable === profile.nom) && inP(v.date, debut, fin));
  const mesVentes = mesVentesTotales.filter((v) => !v.commission_payee);
  const ca = mesVentes.reduce((s, v) => s + totalVente(v), 0);
  const taux = Number(profile.taux_commission || 0);
  const commission = mesVentes.reduce((s, v) => s + commissionPour(v, profile.nom, taux), 0);
  // Gagné, mais pas encore exigible : le client n'a pas réceptionné l'installation.
  const enAttenteReception = mesVentes.reduce((s, v) => s + commissionEnAttente(v, taux), 0);
  const rabaisAccordes = mesVentesTotales.filter((v) => v.commercial === profile.nom).reduce((s, v) => s + Number(v.rabais || 0), 0);
  const dejaRegle = mesVentesTotales.filter((v) => v.commission_payee).reduce((s, v) => s + totalVente(v), 0);

  // ---- MON ÉQUIPE (les commerciaux que j'ai recrutés) ----
  const moiLive = db.users.find((u) => u.id === profile.id) || profile;
  const monEquipe = filleulsDe(db, moiLive);
  const jeSuisChef = estChefEquipe(db, moiLive);
  const tauxEquipe = Number(moiLive.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
  const detailEquipe = monEquipe.map((u) => {
    const ventesU = db.ventes.filter((v) => v.commercial === u.nom && inP(v.date, debut, fin));
    const tu = Number(u.taux_commission || 0);
    const comDue = ventesU.filter((v) => !v.commission_payee).reduce((s, v) => s + commissionVente(v, tu), 0);
    const comTotale = ventesU.reduce((s, v) => s + commissionVente(v, tu), 0);
    const monOverride = ventesU.filter((v) => !v.override_payee).reduce((s, v) => s + Math.round((commissionVente(v, tu) * tauxEquipe) / 100), 0);
    return { u, nbVentes: ventesU.length, comDue, comTotale, monOverride };
  });
  const commissionEquipe = detailEquipe.reduce((s, x) => s + x.monOverride, 0);

  const blocEquipe = (
    <>
      {monEquipe.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
            <span>👥 Mon équipe — {monEquipe.length} commercial(aux) recruté(s)</span>
            <span className="text-xs font-semibold text-slate-600">
              {jeSuisChef
                ? <>⭐ <b className="text-amber-600">Chef d'équipe</b> · je touche <b>{tauxEquipe} %</b> de leurs commissions</>
                : <>Encore <b className="text-amber-600">{SEUIL_CHEF_EQUIPE - monEquipe.length}</b> recrue(s) pour devenir chef d'équipe</>}
            </span>
          </div>
          <table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial recruté", "Ventes", "Sa commission (période)", jeSuisChef ? "Ma part" : ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {detailEquipe.map(({ u, nbVentes, comTotale, monOverride }) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold">{u.nom_complet || u.nom}<div className="text-xs font-normal text-slate-500">{u.taux_commission ?? 0} % de commission</div></td>
                  <td className="px-3 py-2 tabular-nums">{nbVentes}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(comTotale)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-amber-600">{jeSuisChef ? fmt(monOverride) : "—"}</td>
                </tr>
              ))}
              {jeSuisChef && (
                <tr className="border-t-2 border-slate-300 bg-amber-50 font-bold">
                  <td className="px-3 py-2" colSpan={3}>MA COMMISSION D'ÉQUIPE (en attente)</td>
                  <td className="px-3 py-2 tabular-nums text-amber-700">{fmt(commissionEquipe)}</td>
                </tr>
              )}
            </tbody>
          </table>
          {!jeSuisChef && (
            <div className="px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
              À {SEUIL_CHEF_EQUIPE} commerciaux recrutés, vous devenez automatiquement chef d'équipe et touchez un pourcentage de leurs commissions.
            </div>
          )}
        </div>
      )}
    </>
  );

  const parBoutique = {};
  mesVentes.forEach((v) => { parBoutique[v.boutique] = (parBoutique[v.boutique] || 0) + totalVente(v); });

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-3">💵 Ma commission — {profile.nom}</div>

        {enAttenteReception > 0 && (
          <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="font-bold text-amber-900">⏳ {fmt(enAttenteReception)} en attente de réception</div>
            <div className="text-xs text-slate-600 mt-1">
              Cette commission est acquise, mais elle ne devient exigible que le jour où le client <b>réceptionne son installation</b>. Elle s'ajoutera automatiquement à votre dû à ce moment-là.
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"], ["perso", "Personnalisée"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        {periode === "perso" && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <Field label="Du"><input type="date" className={inputCls} value={pa} onChange={(e) => setPa(e.target.value)} /></Field>
            <Field label="Au"><input type="date" className={inputCls} value={pb} onChange={(e) => setPb(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Chiffre d'affaires (non réglé)</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(ca)}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Taux de commission</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{taux} %</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commission à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(commission)}</div>
            {jeSuisChef && commissionEquipe > 0 && <div className="text-xs font-bold text-amber-600 mt-1">+ {fmt(commissionEquipe)} de commission d'équipe</div>}
          </div>
        </div>
        {rabaisAccordes > 0 && (
          <div className="text-xs font-bold text-orange-600 mt-2">
            🏷 Rabais accordés à vos clients sur cette période : −{fmt(rabaisAccordes)} — déduits de votre commission.
          </div>
        )}
        {dejaRegle > 0 && <div className="text-xs text-slate-500 mt-2">Sur cette période, {fmt(dejaRegle)} de ventes ont déjà donné lieu à une commission réglée.</div>}
        <div className="text-xs text-slate-400 mt-2">Le règlement des commissions est validé par l'administration ou votre chef d'équipe.</div>
      </Panel>

      {blocEquipe}

      {Object.keys(parBoutique).length > 0 && (
        <Panel>
          <div className="font-bold mb-3">Répartition par boutique</div>
          <div className="space-y-2">
            {Object.entries(parBoutique).sort((a, b) => b[1] - a[1]).map(([nom, montant]) => (
              <div key={nom} className="flex items-center justify-between text-sm">
                <Badge boutique={nom} />
                <span className="font-bold tabular-nums">{fmt(montant)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Détail de mes ventes en attente ({mesVentes.length})</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "N° reçu", "Boutique", "Articles", "Total"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mesVentes.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucune vente sur cette période.</td></tr>}
            {mesVentes.map((v) => (
              <tr key={v.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(v.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{numeroRecu(v)}</td>
                <td className="px-3 py-2"><Badge boutique={v.boutique} /></td>
                <td className="px-3 py-2">{resumeArticles(v)}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(totalVente(v))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">La commission affichée est une estimation calculée automatiquement (chiffre d'affaires × taux). Elle ne constitue pas un document de paie officiel.</div>
    </div>
  );
}

// ============ HISTORIQUE (JOURNAL D'AUDIT) ============
function Historique({ db }) {
  const [q, setQ] = useState("");
  let liste = (db.audits || []).slice(0, 500);
  if (q) liste = liste.filter((a) => (String(a.user) + " " + String(a.action)).toLowerCase().includes(q.toLowerCase()));
  const dh = (iso) => `${dFR(iso)} ${String(iso).slice(11, 16)}`;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Historique des actions <span className="text-sm font-normal text-slate-500">(500 dernières)</span></span>
          <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-64" placeholder="Rechercher (utilisateur, action)…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm min-w-[640px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date et heure", "Utilisateur", "Action"].map((h) => <th key={h} className="text-left px-4 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-400">Aucune action enregistrée pour l'instant.</td></tr>}
            {liste.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-4 py-2 whitespace-nowrap tabular-nums">{dh(a.date)}</td>
                <td className="px-4 py-2 font-semibold">{a.user}</td>
                <td className="px-4 py-2">{a.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-400">Chaque vente, dépense, dette, mouvement de stock, clôture et action sur les comptes est tracée automatiquement, avec l'utilisateur et l'heure. Ce journal se synchronise entre toutes les machines.</div>
    </div>
  );
}

// ============ PARAMÈTRES ============
function Parametres({ db, save, setDb, profile, dossierAuto, setDossierAuto, dernierAuto }) {
  // ---- SÉCURITÉ SUPABASE : écran de contrôle avant durcissement ----
  const [verifSecu, setVerifSecu] = useState({ statut: "idle", existants: [], total: 0, erreur: "" });
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

  // ---- NOTE AFFICHÉE SOUS LE DIMENSIONNEMENT ----
  const [note, setNote] = useState(noteDimensionnement(db));

  const [tauxParr, setTauxParr] = useState(String(tauxParrainageDefaut(db)));

  const enregistrerTauxParrainage = () => {
    const t = Number(tauxParr);
    if (Number.isNaN(t) || t < 0 || t > 100) { uAlert("Entrez un taux entre 0 et 100."); return; }
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, taux_parrainage: t })) },
      `Taux de parrainage par défaut fixé à ${t} %`);
    uAlert(`✅ Le taux de parrainage par défaut est désormais ${t} %.\n\nIl s'applique aux clients qui n'ont pas de taux personnel.`);
  };

  const enregistrerNote = () => {
    // L'écran Paramètres est déjà réservé à l'administrateur : pas de contrôle en plus.
    save({ ...db, boutiques: db.boutiques.map((b) => ({ ...b, note_dim: note })) },
      "Note du dimensionnement modifiée");
    uAlert("✅ Note enregistrée. Elle s'affiche désormais sous le tableau des équipements proposés.");
  };

  const retablirNote = async () => {
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

  const [f, setF] = useState({ nom: "", couleur: PALETTE[0][1], depot: false, adresse: "", tel: "" });
  const [couleurPour, setCouleurPour] = useState(null);
  const [positionPour, setPositionPour] = useState(null); // boutique dont on choisit la position GPS
  const nomCouleur = (hex) => (PALETTE.find(([, h]) => h === hex) || [hex])[0];

  const utilisee = (nom) =>
    db.produits.some((x) => x.boutique === nom) || db.ventes.some((x) => x.boutique === nom) ||
    db.depenses.some((x) => x.boutique === nom) || db.dettes.some((x) => x.boutique === nom);

  const ajouter = () => {
    const nom = f.nom.trim().toUpperCase();
    if (!nom) { uAlert("Veuillez saisir un nom."); return; }
    if (db.boutiques.some((b) => b.nom === nom)) { uAlert("Cette boutique existe déjà."); return; }
    save({ ...db, boutiques: [...db.boutiques, { id: uid(), nom, couleur: f.couleur, depot: !!f.depot, adresse: f.adresse.trim(), tel: f.tel.trim() }] });
    setF({ nom: "", couleur: "#2563eb", depot: false, adresse: "", tel: "" });
    uAlert(`${f.depot ? "Magasin" : "Boutique"} ${nom} créé(e) !`);
  };

  const basculerDepot = async (b) => {
    const versDepot = !b.depot;
    if (versDepot && db.ventes.some((v) => v.boutique === b.nom)) {
      if (!await uConfirm(`⚠ « ${b.nom} » a déjà des ventes enregistrées.\n\nEn faire un magasin la retirera des écrans de vente et de caisse (les ventes passées restent consultables).\n\nContinuer ?`)) return;
    }
    if (!versDepot && !await uConfirm(`Transformer le magasin « ${b.nom} » en boutique de vente ?`)) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, depot: versDepot } : x)) },
      `« ${b.nom} » devient ${versDepot ? "un magasin (dépôt)" : "une boutique de vente"}`);
  };

  const supprimer = async (b) => {
    if (db.boutiques.length <= 1) { uAlert("Gardez au moins une boutique."); return; }
    if (utilisee(b.nom)) { uAlert(`« ${b.nom} » contient des données. Utilisez « Supprimer avec ses données » si vous voulez vraiment la retirer.`); return; }
    if (await uConfirm(`Supprimer « ${b.nom} » ?`)) save({ ...db, boutiques: db.boutiques.filter((x) => x.id !== b.id) }, `Suppression boutique ${b.nom}`);
  };

  // Suppression forcée : retire la boutique ET tout ce qui lui est rattaché
  // (produits, ventes, dépenses, dettes, ajustements, clôtures, prospects,
  // commandes). Irréversible — double confirmation obligatoire.
  const supprimerAvecDonnees = async (b) => {
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

  const reinitialiserToutesLesDonnees = async () => {
    // ══════ BARRIÈRE 1 : uniquement depuis le LOGICIEL WINDOWS ══════
    if (!estAppWindows()) {
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
    const empreinte = await hacher(String(mdp));
    const bon = moi?.pwd_hash ? moi.pwd_hash === empreinte : moi?.pwd === mdp;
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
      uAlert(`✅ Réinitialisation terminée.\n\n${rapport.effacees.length} collections effacées, ici et sur le serveur.\nLes comptes utilisateurs sont conservés.\n\nLes AUTRES appareils videront leur base automatiquement à leur prochaine synchronisation — demandez à chacun d'ouvrir l'application une fois.`);
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
    const adresse = await uPrompt(`Adresse de ${b.nom} (imprimée sur les reçus) :`, b.adresse || "Lomé, Togo");
    if (adresse === null) return;
    const tel = await uPrompt(`Téléphone de ${b.nom} (imprimé sur les reçus) :`, b.tel || "");
    if (tel === null) return;
    const email = await uPrompt(`Email de ${b.nom} (imprimé sur les reçus) :`, b.email || "Bmitogo.info@gmail.com");
    if (email === null) return;
    const message = await uPrompt(`Message en bas du reçu :`, b.message || "Merci pour votre achat ! / Thank you for your purchase!");
    if (message === null) return;
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, adresse, tel, email, message } : x)) });
    uAlert("Informations du reçu mises à jour !");
  };

  const enregistrerPosition = (b, lat, lng) => {
    save({ ...db, boutiques: db.boutiques.map((x) => (x.id === b.id ? { ...x, lat, lng } : x)) }, `Position GPS de ${b.nom} mise à jour`);
  };
  const retirerPosition = async (b) => {
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
                  onClick={() => { save({ ...db, boutiques: db.boutiques.map((x) => (x.id === couleurPour.id ? { ...x, couleur: hex } : x)) }, `Couleur de ${couleurPour.nom} → ${nomC}`); setCouleurPour(null); }}
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
          <div className={estAdminPrincipal(db, profile) ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
            {estAdminPrincipal(db, profile) ? "✅" : "❌"} Être l'<b>administrateur principal</b>{estAdminPrincipal(db, profile) ? "" : ` — c'est ${adminPrincipal(db)?.nom || "quelqu'un d'autre"}`}
          </div>
          <div className="text-slate-600 mt-1">Puis : sauvegarde téléchargée · code aléatoire recopié · mot de passe confirmé.</div>
        </div>

        <button
          onClick={reinitialiserToutesLesDonnees}
          disabled={!estAppWindows() || !estAdminPrincipal(db, profile)}
          className={`px-5 py-2 rounded-lg font-bold text-sm ${(!estAppWindows() || !estAdminPrincipal(db, profile))
            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
            : "bg-red-700 text-white hover:bg-red-800"}`}>
          🧨 Réinitialiser toutes les données
        </button>
      </div>
    </div>
  );
}
