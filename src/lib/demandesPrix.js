// ============================================================
// lib/demandesPrix.js — 📨 LES DEMANDES DE PRIX AUX FOURNISSEURS
//
// Timo, 11/11/2026 (« Dans fournisseur, on peut faire une demande de
// quotation ? » → « 1+2 ok, Ba, Cb, Db, lance », et le document en ANGLAIS) :
// une demande part à UN ou PLUSIEURS fournisseurs (un PDF, en anglais ou en
// français, et — pour l'administrateur — un WhatsApp ouvert sur son
// téléphone) ; chaque réponse se recopie sur la ligne du fournisseur ; un
// tableau les compare article par article ET par total (« C b ») ; on retient
// un fournisseur PAR ARTICLE (« D b ») — chaque fournisseur retenu reçoit SA
// 🛒 commande à l'étranger, déjà remplie.
// « B a » : le gérant et l'administrateur (ROLES_FOURNISSEURS).
//
// Où ça vit : une demande est COPIÉE sur la fiche de chaque fournisseur
// sollicité (`demandes_prix`), sous le MÊME numéro (DP-AAAA-NNNN) ; chaque
// copie porte la réponse de SON fournisseur. Rien à coller : la table des
// fournisseurs est déjà réservée au gérant et à l'administrateur (securite-4).
//
// ⚠ Les prix d'une réponse sont en DOLLARS : ce qui est retenu devient une
// commande à l'étranger, qui compte en dollars.
//
// Module PUR, sans aucun import.
// ============================================================

export const LANGUES_DEMANDE = [["en", "English"], ["fr", "Français"]];
export const LANGUE_DEFAUT = "en";

const sans = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const nombre = (v) => {
  if (v === "" || v === null || v === undefined) return NaN;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const centimes = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Toutes les copies d'une liste de fournisseurs (déjà filtrée par l'espace).
export const copiesDe = (fournisseurs) => (fournisseurs || []).flatMap((fo) =>
  (fo?.demandes_prix || []).map((d) => ({ ...d, fournisseur_id: fo.id, fournisseur_nom: fo.nom, fournisseur_tel: fo.representant_tel || fo.tel || "" })));

// Les demandes, regroupées par numéro : { numero, le, lieu, lignes, note, langue, copies[] }.
export function demandesGroupees(fournisseurs) {
  const parNumero = new Map();
  for (const c of copiesDe(fournisseurs)) {
    const g = parNumero.get(c.numero) || { numero: c.numero, le: c.le, par: c.par, lieu: c.lieu, lignes: c.lignes || [], note: c.note || "", langue: c.langue || LANGUE_DEFAUT, copies: [] };
    g.copies.push(c);
    parNumero.set(c.numero, g);
  }
  return [...parNumero.values()].map((g) => ({ ...g, statut: statutDemande(g) }))
    .sort((a, b) => String(b.le).localeCompare(String(a.le)) || String(b.numero).localeCompare(String(a.numero)));
}
export function statutDemande(g) {
  const copies = g.copies || [];
  if (copies.some((c) => c.retenue)) return "commandee";
  if (copies.length && copies.every((c) => c.close)) return "close";
  return "ouverte";
}
export const estOuverte = (g) => statutDemande(g) === "ouverte";

// DP-2026-0001 : le plus grand déjà donné + 1.
export function prochainNumeroDemande(fournisseurs, annee) {
  const pref = `DP-${annee}-`;
  let max = 0;
  for (const c of copiesDe(fournisseurs)) {
    const s = String(c.numero || "");
    if (s.startsWith(pref)) max = Math.max(max, Number(s.slice(pref.length)) || 0);
  }
  return `${pref}${String(max + 1).padStart(4, "0")}`;
}

// ---- LA DEMANDE ----
export function critiqueDemande({ lieu, lignes, fournisseurs }) {
  if (!(fournisseurs || []).length) return "Choisissez au moins un fournisseur.";
  if (!lieu) return "Choisissez où la marchandise serait reçue (boutique ou magasin).";
  if (!(lignes || []).length) return "Ajoutez au moins un article.";
  const vus = new Set();
  for (const l of lignes) {
    if (!String(l?.nom || "").trim()) return "Indiquez l'article.";
    const q = nombre(l.qte);
    if (!(q > 0) || !Number.isInteger(q)) return `« ${l.nom} » : la quantité doit être un nombre entier positif.`;
    const k = l.produit_id || sans(l.nom);
    if (vus.has(k)) return `« ${l.nom} » est deux fois dans la demande : mettez la quantité totale sur une seule ligne.`;
    vus.add(k);
  }
  return "";
}
export const ligneDemande = (l) => ({ id: l.id, produit_id: l.produit_id || null, nom: String(l.nom).trim(), qte: nombre(l.qte), precision: String(l.precision || "").trim() });

// La copie posée sur la fiche d'UN fournisseur.
export const copiePour = ({ id, numero, le, par, par_id, lieu, lignes, note, langue }) =>
  ({ id, numero, le, par, par_id: par_id ?? null, lieu, lignes, note: String(note || "").trim(), langue: langue || LANGUE_DEFAUT, envois: [], reponse: null });

// ---- LA RÉPONSE D'UN FOURNISSEUR ----
// `prix` : { [ligne_id]: "12.5" } — une case vide = pas proposé.
export function critiqueReponse(copie, { prix, decline }) {
  if (decline) return "";
  const lignes = copie?.lignes || [];
  let un = false;
  for (const l of lignes) {
    const v = prix?.[l.id];
    if (v === "" || v === undefined || v === null) continue;
    const n = nombre(v);
    if (!(n >= 0)) return `« ${l.nom} » : le prix doit être un nombre (en dollars).`;
    un = true;
  }
  if (!un) return "Indiquez au moins un prix (en dollars), ou cochez « Le fournisseur ne fait pas d'offre ».";
  return "";
}
export function reponseRangee({ prix, delai, validite, note, decline }, quand, par) {
  if (decline) return { decline: true, le: quand, par, note: String(note || "").trim() };
  const p = {};
  for (const [k, v] of Object.entries(prix || {})) { const n = nombre(v); if (Number.isFinite(n) && n >= 0) p[k] = centimes(n); }
  return { prix: p, delai: String(delai || "").trim(), validite: String(validite || "").trim(), note: String(note || "").trim(), le: quand, par };
}

// ---- LA COMPARAISON (« C b ») ----
// Pour chaque article : le prix de chaque fournisseur et le moins cher ;
// pour chaque fournisseur : son total sur ce qu'il propose, et s'il propose tout.
export function comparaison(g) {
  const offres = (g.copies || []).filter((c) => c.reponse && !c.reponse.decline);
  const lignes = (g.lignes || []).map((l) => {
    const prix = offres.map((c) => ({ copie: c, pu: c.reponse.prix?.[l.id] })).filter((x) => Number.isFinite(x.pu));
    const min = prix.length ? Math.min(...prix.map((x) => x.pu)) : NaN;
    return { ligne: l, prix, min, moinsCher: prix.filter((x) => x.pu === min).map((x) => x.copie.fournisseur_id) };
  });
  const totaux = offres.map((c) => {
    let total = 0; let manque = 0;
    for (const l of g.lignes || []) {
      const pu = c.reponse.prix?.[l.id];
      if (Number.isFinite(pu)) total += pu * l.qte; else manque += 1;
    }
    return { copie: c, total: centimes(total), complet: manque === 0, manque };
  });
  const complets = totaux.filter((t) => t.complet);
  const meilleurTotal = complets.length ? Math.min(...complets.map((t) => t.total)) : NaN;
  return { lignes, totaux, meilleurTotal, offres };
}

// Le choix proposé d'office : le moins cher de chaque article (à égalité, le
// premier fournisseur qui a répondu).
export function choixParDefaut(g) {
  const out = {};
  for (const x of comparaison(g).lignes) if (x.moinsCher.length) out[x.ligne.id] = x.moinsCher[0];
  return out;
}

// ---- RETENIR (« D b ») ----
// `choix` : { [ligne_id]: fournisseur_id | "" } — "" = article laissé de côté.
// Rend les commandes à créer, une par fournisseur retenu.
export function critiqueRetenue(g, choix) {
  if (!estOuverte(g)) return "Cette demande est déjà commandée ou close.";
  for (const [lid, fid] of Object.entries(choix || {})) {
    if (!fid) continue;
    const c = (g.copies || []).find((x) => x.fournisseur_id === fid);
    const l = (g.lignes || []).find((x) => x.id === lid);
    if (!c || !l) return "Un choix ne correspond à aucune offre.";
    if (!c.reponse || c.reponse.decline || !Number.isFinite(c.reponse.prix?.[lid])) return `${c.fournisseur_nom} n'a pas donné de prix pour « ${l.nom} ».`;
  }
  if (!commandesARetenir(g, choix).length) return "Choisissez un fournisseur pour au moins un article.";
  return "";
}
export function commandesARetenir(g, choix) {
  const map = new Map();
  for (const l of g.lignes || []) {
    const fid = choix?.[l.id];
    if (!fid) continue;
    const c = (g.copies || []).find((x) => x.fournisseur_id === fid);
    if (!c || !c.reponse || c.reponse.decline || !Number.isFinite(c.reponse.prix?.[l.id])) continue;
    const e = map.get(fid) || { fournisseur_id: fid, fournisseur_nom: c.fournisseur_nom, lignes: [] };
    e.lignes.push({ id: l.id, produit_id: l.produit_id || null, nom: l.nom, qte: l.qte, pu: c.reponse.prix[l.id] });
    map.set(fid, e);
  }
  return [...map.values()];
}

// ---- LE TEXTE DU WHATSAPP ----
const MOTS = {
  en: {
    bonjour: "Hello", demande: "Request for quotation", de: "from BMI TOGO (Lomé, Togo)",
    merci: "Please quote your best unit price (USD), lead time, shipping terms and offer validity. The detailed request is attached (PDF).",
    fin: "Thank you, BMI TOGO",
  },
  fr: {
    bonjour: "Bonjour", demande: "Demande de prix", de: "de BMI TOGO (Lomé, Togo)",
    merci: "Merci de nous indiquer votre meilleur prix unitaire (USD), votre délai, vos conditions de livraison et la validité de votre offre. La demande détaillée est jointe (PDF).",
    fin: "Merci, BMI TOGO",
  },
};
export function texteWhatsappDemande(g, nomFournisseur) {
  const m = MOTS[g.langue === "fr" ? "fr" : "en"];
  const articles = (g.lignes || []).map((l) => `- ${l.qte} x ${l.nom}${l.precision ? ` (${l.precision})` : ""}`).join("\n");
  return `${m.bonjour}${nomFournisseur ? ` ${nomFournisseur}` : ""},\n\n${m.demande} ${g.numero} ${m.de} :\n${articles}${g.note ? `\n\n${g.note}` : ""}\n\n${m.merci}\n\n${m.fin}`;
}

// ---- LES MOTS DU PDF (anglais / français) ----
export const MOTS_PDF = {
  en: {
    titre: "REQUEST FOR QUOTATION", numero: "RFQ No.", date: "Date", a: "To", livraison: "Delivery to", lomé: "Lomé, Togo",
    colonnes: ["#", "Item / specification", "Qty", "Unit price (USD)", "Total (USD)"],
    note: "Notes", demandeTitre: "Please quote, for each item:",
    demandes: ["Your best unit price in US dollars (USD)", "Lead time (production + shipping)", "Shipping terms (EXW, FOB, CIF Lomé...) and payment terms", "Validity of your offer"],
    retour: "Please reply by WhatsApp or e-mail, quoting the RFQ number above.", contact: "Contact", tel: "Phone", email: "E-mail", merci: "Thank you for your quotation.",
    formation: "TRAINING DOCUMENT - NOT VALID",
  },
  fr: {
    titre: "DEMANDE DE PRIX", numero: "N°", date: "Date", a: "À", livraison: "Livraison à", lomé: "Lomé, Togo",
    colonnes: ["#", "Article / précision", "Qté", "Prix unitaire (USD)", "Total (USD)"],
    note: "Notes", demandeTitre: "Merci de nous indiquer, pour chaque article :",
    demandes: ["Votre meilleur prix unitaire en dollars (USD)", "Le délai (fabrication + transport)", "Les conditions de livraison (EXW, FOB, CIF Lomé...) et de paiement", "La validité de votre offre"],
    retour: "Merci de répondre par WhatsApp ou par e-mail, en rappelant le numéro ci-dessus.", contact: "Contact", tel: "Tél", email: "E-mail", merci: "Merci pour votre offre.",
    formation: "DOCUMENT DE FORMATION - SANS VALEUR",
  },
};
export const motsPdf = (langue) => MOTS_PDF[langue === "fr" ? "fr" : "en"];
