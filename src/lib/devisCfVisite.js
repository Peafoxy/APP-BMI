// ============================================================
// lib/devisCfVisite.js — LES ÉLÉMENTS D'UN DEVIS « À COMPLÉTER APRÈS LA
// VISITE » (cf. visite).
//
// Timo (08/10/2026), capture d'un client : « Mettez tout et les trucs qui
// manquent, mettez cf visite. Après c'est à compléter et non modifié. À notre
// niveau on ne parle pas de modification. » Puis ses trois décisions :
//   A « a » — on complète SEULEMENT tant que le devis est ⏳ Proposé : le
//             client valide le devis COMPLET, jamais un total partiel ;
//   B        — PAS d'acompte tant que le devis n'est pas complété ;
//   C        — celui qui l'a établi, l'administrateur, le responsable
//             commercial complètent (les mêmes que « Modifier et renvoyer »).
//
// Une ligne cf. visite vit dans `devis.lignes` : un nom, une quantité
// facultative, AUCUN prix (pu 0, total 0) et la marque `cf_visite`. Elle ne
// compte dans aucun total et n'entre jamais dans le panier encaissé.
//
// Ce fichier n'importe RIEN : il est lu par la validation du devis, le PDF,
// l'espace client et le message WhatsApp, sans entraîner d'autre règle.
// ============================================================

export const CATEGORIE_CF_VISITE = "À compléter après la visite";
export const MENTION_CF_VISITE = "Cf. visite";

export const estLigneCfVisite = (l) => !!(l && l.cf_visite);
export const lignesCfVisite = (devis) => (Array.isArray(devis && devis.lignes) ? devis.lignes : []).filter(estLigneCfVisite);
export const devisACompleter = (devis) => lignesCfVisite(devis).length > 0;

// La phrase que le PDF, l'espace client et l'écran du devis disent — UNE fois.
export const PHRASE_A_COMPLETER = "Éléments à compléter après la visite technique (cf. visite) : total, acompte et solde arrêtés au devis complété.";
export const MOTIF_VALIDATION_A_COMPLETER = "Ce devis n'est pas encore complet : des éléments seront chiffrés après la visite technique (cf. visite). Il pourra être validé une fois complété.";

// Qui complète (décision « C ») : les mêmes rôles que « Modifier et renvoyer »
// (lib/comptesClients.js, ROLES_MODIFIENT_TOUT_DEVIS — recopié ici en liste
// courte parce que ce fichier n'importe rien ; le banc compare les deux).
export const ROLES_COMPLETENT_TOUT_DEVIS = ["admin", "resp_commercial"];

// « » si le geste est permis ; sinon le motif, dit en français.
export function motifRefusCompletion(devis, profile) {
  if (!devis) return "Devis introuvable.";
  if (!devisACompleter(devis)) return "Ce devis n'a plus d'élément à compléter.";
  // Décision « A a » : ⏳ Proposé seulement.
  if ((devis.statut || "propose") !== "propose") return "🔒 Ce devis n'est plus ⏳ Proposé : il ne se complète plus.";
  const auteur = !!devis.par_id && devis.par_id === (profile && profile.id);
  if (!auteur && !ROLES_COMPLETENT_TOUT_DEVIS.includes(profile && profile.role))
    return `🔒 Seul ${devis.par || "celui qui a établi ce devis"}, l'administrateur ou le responsable commercial peut le compléter.`;
  return "";
}
export const peutCompleterDevis = (devis, profile) => motifRefusCompletion(devis, profile) === "";

// Ce que la personne a saisi pour compléter : une réponse par ligne cf. visite
// (dans l'ordre des lignes) — chiffrée, ou « sans objet » — et des lignes
// ajoutées découvertes à la visite. « » si tout est en ordre.
const nombre = (v) => Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
export function critiqueCompletion(devis, { reponses = [], ajouts = [] } = {}) {
  const cf = lignesCfVisite(devis);
  if (reponses.length !== cf.length) return "Le devis a changé entre-temps : rouvrez « Compléter le devis ».";
  for (let i = 0; i < cf.length; i++) {
    const r = reponses[i] || {};
    if (r.sans_objet) continue;
    const nom = cf[i].article || "cet élément";
    if (!String(r.nom || "").trim()) return `Donnez un article pour « ${nom} », ou marquez-le « sans objet ».`;
    if (!(nombre(r.qte) > 0)) return `Indiquez la quantité pour « ${nom} ».`;
    if (!(nombre(r.prix) > 0)) return `Indiquez le prix unitaire pour « ${nom} », ou marquez-le « sans objet ».`;
  }
  for (const a of ajouts) {
    if (!String(a.nom || "").trim() && !String(a.prix || "").trim()) continue;
    if (!String(a.nom || "").trim()) return "Une ligne ajoutée n'a pas de nom.";
    if (!(nombre(a.qte) > 0)) return `Indiquez la quantité pour « ${a.nom} ».`;
    if (!(nombre(a.prix) > 0)) return `Indiquez le prix unitaire pour « ${a.nom} ».`;
  }
  const chiffre = reponses.some((r) => r && !r.sans_objet) || ajouts.some((a) => String(a.nom || "").trim());
  if (!chiffre && !cf.length) return "Rien à compléter.";
  return "";
}
export const nombreSaisi = nombre;
