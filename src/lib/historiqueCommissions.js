// ============================================================
// lib/historiqueCommissions.js — 🧾 L'HISTORIQUE DES PAIEMENTS DE COMMISSION
// (Timo, 13/11/2026 : « EST CE ON A UN HISTORIQUE DE PAIEMENT DE COMMISSION ?
// TELECHARGEABLE EN PDF » → « A c, B b, C oui, lance »).
//   A c — dans 👑 Mon équipe (celui qui paie) ET dans 💵 Ma commission
//         (chacun télécharge son relevé) ;
//   B b — les commissions (sur ventes, d'équipe, apporteurs externes,
//         parrains) ET les primes d'installation (parts des frais de
//         chantier, primes de chantier) ;
//   C oui — un relevé PDF par personne (bouton 📄 sur sa ligne).
//
// RIEN N'EST ÉCRIT. Chaque paiement est DÉJÀ une dépense posée par son geste
// (catégorie « Commissions » — auto commission / commission_equipe /
// commission_ext — ou « Prime d'installation » — auto installation), et ce
// qu'il a payé porte son numéro (commission_dep, override_dep,
// apporteur.dep_id, la ligne de l'équipe d'un chantier : dep_id). Vérifié
// dans l'histoire du code : ces marques existent depuis le 25/07/2026. On
// RELIT donc là. Un paiement annulé (dépense retirée, ventes rouvertes) n'y
// est plus. Une part d'installation entièrement retenue pour un outil perdu
// (aucune dépense : rien n'est sorti) y figure, à 0 F versé.
//
// ⚠ LE MUR : la règle reçoit des listes DÉJÀ filtrées par l'espace regardé
// (dépenses, ventes, dettes, chantiers, personnes) — jamais `db` en entier.
// Une fonction pure qui reçoit une table entière et la PARCOURT est un
// passage de mur en puissance (leçon payée deux fois le 18/09/2026).
// ============================================================
import { inP, dFR, fmt } from "./core";
import { cleApporteur } from "./calculs";
import { libellePayeAvecDe } from "./validationDepenses";

export const TYPES_PAIEMENT = {
  commission: "Commission sur ventes",
  commission_equipe: "Commission d'équipe",
  apporteur: "Apporteur externe",
  parrain: "Parrainage",
  installation: "Prime d'installation",
  prime_chantier: "Prime de chantier",
};
// Les deux familles du résumé (le PDF les dit à part).
export const TYPES_PRIMES = ["installation", "prime_chantier"];
export const estPrime = (p) => TYPES_PRIMES.includes(p?.type);

// QUI VOIT QUOI dans 👑 Mon équipe. L'administrateur, le responsable
// commercial et le gérant voient TOUS les paiements de l'espace regardé ; un
// chef d'équipe, les siens et ceux de ses recrues — c'est ce qui a été dit à
// Timo avant qu'il ne dise « lance » (13/11/2026). ⚠ Le reste de l'écran 👑
// montre aujourd'hui tout le monde à un chef : trouvé en construisant, DIT à
// Timo, pas changé sans lui.
export const ROLES_HISTORIQUE_COMPLET = ["admin", "resp_commercial", "gerant"];
export const voitTousLesPaiements = (profile) => ROLES_HISTORIQUE_COMPLET.includes(profile?.role);

// La clé d'un bénéficiaire : un compte (u:…) ou un apporteur externe / un
// parrain, reconnu comme partout par son nom et son numéro (a:…).
export const cleUtilisateur = (id) => `u:${id}`;
export const cleDApporteur = (nom, tel) => `a:${cleApporteur(nom, tel)}`;
// Les clés qu'un chef d'équipe peut lire : lui, et ses recrues.
export const clesDuChef = (chef, recrues = []) =>
  new Set([chef, ...recrues].filter((u) => u && u.id).map((u) => cleUtilisateur(u.id)));

const nomPersonne = (u) => (u ? String(u.nom_complet || u.nom || "").trim() : "");
const nomChantier = (c) => [c?.nom, c?.prenom].filter(Boolean).join(" ").trim();
const clientsDistincts = (liste) => [...new Set(liste.map((x) => String(x?.client || "").trim()).filter(Boolean))];
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

// « 1 vente : MR ERIC », « 3 ventes et 1 pose seule : A, B, C ».
function phraseVentes(ventes = [], poses = []) {
  const morceaux = [];
  if (ventes.length) morceaux.push(pluriel(ventes.length, "vente"));
  if (poses.length) morceaux.push(`${pluriel(poses.length, "pose")} seule${poses.length > 1 ? "s" : ""}`);
  if (!morceaux.length) return "";
  const noms = clientsDistincts([...ventes, ...poses]);
  return `${morceaux.join(" et ")}${noms.length ? ` : ${noms.join(", ")}` : ""}`;
}

// Le nom d'un bénéficiaire lu dans la description posée par le geste — le
// filet d'un paiement dont les ventes ne sont plus là (vente à la corbeille).
const DESCRIPTIONS = [
  { type: "commission_equipe", re: /^Commission d'équipe — (.+?) \(/ },
  { type: "apporteur", re: /^Commission apporteur externe — (.+?)(?: \(([^)]*)\))?$/ },
  { type: "commission", re: /^Commission — (.+?) \(/ },
];
function lireDescription(d) {
  const t = String(d?.description || "").trim();
  for (const x of DESCRIPTIONS) {
    const m = t.match(x.re);
    if (m) return { type: x.type, nom: m[1].trim(), tel: (m[2] || "").trim() };
  }
  return null;
}

// LA LISTE DES PAIEMENTS, du plus récent au plus ancien.
// Chaque paiement : { id, date, heure, type, libelleType, cle, beneficiaire,
// tel, user_id, pour, detail, clients, montant (ce qui est réellement sorti),
// part, retenue (une prime), moyen, caisse, par, depense_id }.
export function paiementsDeCommission({ depenses = [], ventes = [], dettes = [], chantiers = [], personnes = [] } = {}) {
  const parId = new Map(personnes.map((u) => [u.id, u]));
  const depParId = new Map(depenses.map((d) => [d.id, d]));
  const dejaLues = new Set();
  const sortie = [];
  const depuisDepense = (d) => ({
    heure: d?.heure || "",
    moyen: d?.paiement || "",
    caisse: d ? libellePayeAvecDe(d) : "",
    par: d?.par || "",
    depense_id: d?.id || "",
  });

  // 1. LES PRIMES D'INSTALLATION : la ligne de l'équipe payée est la vérité —
  // elle existe même quand tout a été retenu pour un outil perdu (aucune
  // dépense : rien n'est sorti de la caisse).
  chantiers.forEach((c) => (c.equipe || []).forEach((e) => {
    const part = Number(e.montant || 0);
    if (!e.paye || !(part > 0)) return;
    const d = e.dep_id ? depParId.get(e.dep_id) || null : null;
    if (d) dejaLues.add(d.id);
    // dep_id vide = tout retenu (rien versé) ; une dépense absente de la liste
    // (une caisse de l'autre espace) : la part, telle quelle.
    const verse = d ? Number(d.montant || 0) : e.dep_id === "" ? 0 : part;
    const retenue = Math.max(0, part - verse);
    const u = parId.get(e.user_id);
    const type = e.prime_employe ? "prime_chantier" : "installation";
    sortie.push({
      id: `prime:${c.id}:${e.user_id || e.nom || ""}`,
      date: String(e.date_paiement || d?.date || "").slice(0, 10),
      type, libelleType: TYPES_PAIEMENT[type],
      cle: e.user_id ? cleUtilisateur(e.user_id) : `n:${e.nom || ""}`,
      beneficiaire: nomPersonne(u) || e.nom || "—", tel: u?.tel || "", user_id: e.user_id || "",
      pour: `Chantier ${nomChantier(c) || "—"}${e.chef ? " (chef de chantier)" : ""}${Number(e.pct) > 0 ? ` - ${e.pct} %` : ""}`,
      detail: retenue > 0 ? `part de ${fmt(part)}, dont ${fmt(retenue)} retenus (outil perdu)` : "",
      clients: nomChantier(c) ? [nomChantier(c)] : [],
      montant: verse, part, retenue,
      ...depuisDepense(d),
      par: d?.par || e.validee_par || "",
    });
  }));

  // 2. LES DÉPENSES DE PAIEMENT qui restent.
  depenses.forEach((d) => {
    if (dejaLues.has(d.id)) return;
    const auto = d.auto;
    const base = { id: `dep:${d.id}`, date: String(d.date || "").slice(0, 10), montant: Number(d.montant || 0), part: 0, retenue: 0, detail: "", ...depuisDepense(d) };
    if (auto === "commission" || auto === "commission_equipe") {
      const payees = ventes.filter((v) => (auto === "commission" ? v.commission_dep : v.override_dep) === d.id);
      const u = parId.get(d.user_id);
      const lu = lireDescription(d);
      const recrues = [...new Set(payees.map((v) => String(v.commercial || "").trim()).filter(Boolean))];
      sortie.push({
        ...base, type: auto, libelleType: TYPES_PAIEMENT[auto],
        cle: d.user_id ? cleUtilisateur(d.user_id) : `n:${lu?.nom || ""}`,
        beneficiaire: nomPersonne(u) || lu?.nom || "—", tel: u?.tel || "", user_id: d.user_id || "",
        pour: auto === "commission"
          ? phraseVentes(payees) || String(d.description || "")
          : payees.length
            ? `${pluriel(payees.length, "vente")} de ses recrues${recrues.length ? ` (${recrues.join(", ")})` : ""}`
            : String(d.description || ""),
        clients: clientsDistincts(payees),
      });
      return;
    }
    if (auto === "commission_ext") {
      const vs = ventes.filter((v) => v.apporteur && v.apporteur.dep_id === d.id);
      const ps = dettes.filter((x) => x.apporteur && x.apporteur.dep_id === d.id);
      const a = (vs[0] || ps[0])?.apporteur || null;
      const lu = a ? null : lireDescription(d);
      const nom = String(a?.nom || lu?.nom || "").trim();
      const tel = String(a?.tel || lu?.tel || "").trim();
      const type = a?.parrain_user_id ? "parrain" : "apporteur";
      sortie.push({
        ...base, type, libelleType: TYPES_PAIEMENT[type],
        cle: cleDApporteur(nom, tel), beneficiaire: nom || "—", tel, user_id: a?.parrain_user_id || "",
        pour: phraseVentes(vs, ps) || String(d.description || ""),
        clients: clientsDistincts([...vs, ...ps]),
      });
      return;
    }
    if (auto === "installation") {
      // Une prime dont le chantier n'est plus dans la liste (à la corbeille) :
      // la dépense suffit à ne pas la perdre.
      const u = parId.get(d.user_id);
      sortie.push({
        ...base, type: "installation", libelleType: TYPES_PAIEMENT.installation,
        cle: d.user_id ? cleUtilisateur(d.user_id) : "n:", beneficiaire: nomPersonne(u) || "—", tel: u?.tel || "", user_id: d.user_id || "",
        pour: String(d.description || ""), clients: [], part: base.montant,
      });
      return;
    }
    if (d.categorie === "Commissions") {
      // Une commission sans sa marque : jamais vue depuis le 25/07/2026, gardée
      // pour que rien ne se perde. Le bénéficiaire est lu dans la description.
      const lu = lireDescription(d);
      const type = lu?.type || "commission";
      const u = lu && type !== "apporteur" ? personnes.find((p) => p.nom === lu.nom) : null;
      sortie.push({
        ...base, type, libelleType: TYPES_PAIEMENT[type],
        cle: type === "apporteur" ? cleDApporteur(lu?.nom, lu?.tel) : u ? cleUtilisateur(u.id) : `n:${lu?.nom || ""}`,
        beneficiaire: nomPersonne(u) || lu?.nom || "—", tel: u?.tel || lu?.tel || "", user_id: u?.id || "",
        pour: String(d.description || ""), clients: [],
      });
    }
  });

  return sortie.sort((a, b) => String(b.date).localeCompare(String(a.date))
    || String(b.heure || "").localeCompare(String(a.heure || ""))
    || String(b.id).localeCompare(String(a.id)));
}

// La période (bornes « AAAA-MM-JJ », vides = ouvertes) et les personnes
// visibles (un Set de clés, ou null = toutes).
export function filtrerPaiements(liste, { du = "", au = "", cles = null, cle = "" } = {}) {
  const a = du || "0000-01-01", b = au || "9999-12-31";
  return (liste || []).filter((p) => inP(p.date, a, b) && (!cles || cles.has(p.cle)) && (!cle || p.cle === cle));
}

export const totalPaiements = (liste) => (liste || []).reduce((s, p) => s + Number(p.montant || 0), 0);
export function resumePaiements(liste) {
  const l = liste || [];
  const primes = l.filter(estPrime);
  return { nb: l.length, total: totalPaiements(l), primes: totalPaiements(primes), commissions: totalPaiements(l.filter((p) => !estPrime(p))) };
}

// Les bénéficiaires d'une liste, pour le choix d'une personne : par nom.
export function personnesDesPaiements(liste) {
  const g = new Map();
  (liste || []).forEach((p) => {
    if (!g.has(p.cle)) g.set(p.cle, { cle: p.cle, nom: p.beneficiaire, tel: p.tel, nb: 0, total: 0 });
    const x = g.get(p.cle);
    x.nb += 1; x.total += Number(p.montant || 0);
  });
  return [...g.values()].sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr", { sensitivity: "base" }));
}

// LES LIGNES DU PDF ET DE L'EXCEL — UNE fabrique : le document reprend
// l'écran tel quel, dans l'ordre des dates (le plus ancien d'abord, comme un
// relevé). Le montant reste un NOMBRE (l'Excel calcule ; le PDF le met en forme).
export const COLONNE_MONTANT = "Montant versé";
export const entetesHistorique = ({ avecBeneficiaire = true } = {}) =>
  ["Date", ...(avecBeneficiaire ? ["Bénéficiaire"] : []), "Type", "Pour", COLONNE_MONTANT, "Moyen", "Caisse", "Payé par"];
export function lignesHistorique(liste, { avecBeneficiaire = true } = {}) {
  return [...(liste || [])].reverse().map((p) => [
    `${dFR(p.date)}${p.heure ? ` ${p.heure}` : ""}`,
    ...(avecBeneficiaire ? [`${p.beneficiaire}${p.tel ? ` (${p.tel})` : ""}`] : []),
    p.libelleType,
    [p.pour, p.detail].filter(Boolean).join(" - "),
    Number(p.montant || 0),
    p.moyen || "-",
    p.caisse || "-",
    p.par || "-",
  ]);
}
