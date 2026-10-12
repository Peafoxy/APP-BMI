// ============================================================
// lib/certificatTravail.js — LES ATTESTATIONS REMISES À UN EMPLOYÉ (12/10/2026)
//
// Timo, devant la question « Contrat de travail de FRED » : « maintenant les
// attestations pour les 4 types de contrat… à chaque sortie, on puisse les
// délivrer à la personne concernée ? », puis « Aa, Bb, Cb, Db… actuellement
// l'administrateur principal est le Directeur Général, lance ».
//   • À LA SORTIE : CDI et CDD → CERTIFICAT DE TRAVAIL ; apprentissage →
//     ATTESTATION DE FIN D'APPRENTISSAGE ; stage → ATTESTATION DE STAGE.
//   • « D b » : PENDANT le contrat, une ATTESTATION DE TRAVAIL (banque, visa,
//     logement).
//   • « A a » : l'administrateur PRINCIPAL seul délivre (revérifié DANS le geste).
//   • « B b » : signé par celui qui délivre — sa signature personnelle si sa
//     fiche en porte une — avec LE cachet de la maison. Le principal est le
//     Directeur Général (`TITRE_SIGNATAIRE`).
//   • « C b » : une phrase d'appréciation FACULTATIVE pour le stage et
//     l'apprentissage seulement.
//
// ⚠ LE CERTIFICAT DE TRAVAIL RESTE NEUTRE : jamais le motif du départ, jamais
// une appréciation — il ne doit pas pouvoir nuire à la personne.
// ⚠ Le sexe vient de la fiche (lib/civilite.js, 12/10/2026, « Ab, Ba, Ca ») :
// « Monsieur … a été employé » / « Madame … a été employée ». Pas saisi : on
// n'invente rien — « M./Mme », « employé(e) ». Le signataire aussi.
// ⚠ Inspiré de deux attestations remises par Timo (12/10/2026, « Les 6, Ab,
// Bb ») : la MAISON parle (« Nous soussignés, BMI TOGO… »), la pièce
// d'identité, le parcours si le rôle a changé, « nous quitte à la date du ».
// ⚠ Les dates viennent de la fiche de paie : `cnss_date_embauche`,
// `cnss_date_sortie` (🚪 Sortie), `cnss_code_type` (UNE source avec la
// déclaration CNSS, lib/contratTravail.js). Rien n'est écrit ici.
// ============================================================
import { codeContrat, phraseContrat, CODE_CDI } from "./contratTravail.js";
import { accorde } from "./civilite.js";

export const CODE_APPRENTISSAGE = 4;
export const CODE_STAGE = 12;
export const TITRE_SIGNATAIRE = "Directeur Général";
// Le titre accordé au sexe du signataire (« Directrice Générale »).
export const titreSignataire = (signataire) => accorde(signataire, TITRE_SIGNATAIRE, "Directrice Générale", TITRE_SIGNATAIRE);
export const APPRECIATION_MAX = 300;

export const DOCUMENTS_EMPLOYE = {
  certificat: { titre: "CERTIFICAT DE TRAVAIL", nom: "Certificat de travail" },
  apprentissage: { titre: "ATTESTATION DE FIN D'APPRENTISSAGE", nom: "Attestation de fin d'apprentissage" },
  stage: { titre: "ATTESTATION DE STAGE", nom: "Attestation de stage" },
  attestation: { titre: "ATTESTATION DE TRAVAIL", nom: "Attestation de travail" },
};

const iso = (d) => String(d || "").slice(0, 10);
// La forme seulement, sans recopier le contrôle de l'écran (règle du banc, components/ui.jsx).
const estDate = (d) => { const p = iso(d).split("-"); return p.length === 3 && p[0].length === 4 && p[1].length === 2 && p[2].length === 2 && !Number.isNaN(Date.parse(`${iso(d)}T00:00:00Z`)); };
const dFR = (d) => (estDate(d) ? iso(d).split("-").reverse().join("/") : "");
// Les paragraphes portent un peu de HTML (le gras) : tout ce qui vient des
// données est échappé ICI, une fois.
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Sorti = une date de sortie saisie, arrivée (aujourd'hui compris).
export const estSorti = (u, aujourdhui) => estDate(u?.cnss_date_sortie) && iso(u.cnss_date_sortie) <= iso(aujourdhui);

// Le document de FIN, selon le contrat. Un contrat jamais saisi reçoit le
// certificat de travail (le document neutre que la loi demande).
export function documentDeSortie(u) {
  const c = codeContrat(u);
  if (c === CODE_APPRENTISSAGE) return "apprentissage";
  if (c === CODE_STAGE) return "stage";
  return "certificat";
}

// Le document que ⋯ Gérer propose aujourd'hui : celui de fin une fois sorti,
// l'attestation de travail sinon. Jamais les deux.
export const documentPropose = (u, aujourdhui) => (estSorti(u, aujourdhui) ? documentDeSortie(u) : "attestation");

// "" = accepté. Revérifié DANS le geste, sur la fiche fraîche.
export function critiqueDocument(type, u, aujourdhui) {
  if (!DOCUMENTS_EMPLOYE[type]) return "Document inconnu.";
  if (!u || !u.role || u.role === "client") return "Ce document ne se délivre qu'à un membre du personnel.";
  if (!estDate(u.cnss_date_embauche)) return `La date d'embauche de ${u.nom} n'est pas saisie : ⋯ Gérer → 📅 Embauche et contrat.`;
  if (type === "attestation") {
    if (estSorti(u, aujourdhui)) return `${u.nom} a quitté l'entreprise le ${dFR(u.cnss_date_sortie)} : c'est le document de fin de contrat qui se délivre.`;
    return "";
  }
  if (!estSorti(u, aujourdhui)) return `Saisissez d'abord la date de sortie de ${u.nom} (⋯ Gérer → 🚪 Sortie) : le document de fin ne se délivre qu'une fois la personne sortie.`;
  if (type !== documentDeSortie(u)) return `Le contrat de ${u.nom} demande : ${DOCUMENTS_EMPLOYE[documentDeSortie(u)].nom}.`;
  return "";
}

// Une appréciation tient sur une ligne et 300 caractères ; jamais sur un
// certificat de travail ni une attestation de travail.
export const nettoyerAppreciation = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, APPRECIATION_MAX);
export const accepteAppreciation = (type) => type === "stage" || type === "apprentissage";

// L'identité de la maison, dite par elle-même (« A b », 12/10/2026 : « Nous
// soussignés, BMI TOGO… »). Les mêmes chiffres que l'en-tête des documents.
export const IDENTITE_BMI = "<b>BMI TOGO</b> (Les Bâtiments Modernes et Intelligents), NIF 1001790098, RCCM TG-LFW-01-2022-A10-01523, dont le siège est à Lomé (Togo)";

// La veille d'une date ("2026-06-15" → "2026-06-14").
const veille = (d) => { const t = new Date(`${iso(d)}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - 1); return t.toISOString().slice(0, 10); };

// Les postes occupés pendant le contrat : le poste d'avant le dernier
// changement de rôle (`role_avant`, `role_change_le`, posés par 🎭 Rôle) s'il
// tombe DANS le contrat, puis le poste actuel. ⚠ Seul le DERNIER changement
// est connu de la fiche : un parcours plus long ne se reconstitue pas.
export function postesOccupes(u, poste, libelleRole = (r) => r) {
  const change = iso(u?.role_change_le), debut = iso(u?.cnss_date_embauche);
  const finContrat = estDate(u?.cnss_date_sortie) ? iso(u.cnss_date_sortie) : "9999-12-31";
  if (!u?.role_avant || u.role_avant === u.role || u.role_avant === "client" || !estDate(change) || !estDate(debut) || change <= debut || change > finContrat) return [{ poste }];
  return [{ poste: libelleRole(u.role_avant) || u.role_avant, au: veille(change) }, { poste, du: change }];
}

// Le contenu du document : titre, paragraphes, date et signataire. `poste` =
// la fonction lisible (« Vendeur »…), `lieu` = la boutique ou le lieu
// d'affectation, `signataire` = { nom, signature, sexe }, `libelleRole` = le
// libellé d'un rôle (pour un poste d'avant).
export function contenuDocument(type, { u, poste, lieu, signataire, appreciation, aujourdhui, libelleRole }) {
  const doc = DOCUMENTS_EMPLOYE[type];
  if (!doc || !u) return null;
  const nom = String(u.nom_complet || u.nom || "").trim();
  const piece = String(u.piece_num || "").trim()
    ? `, titulaire de la pièce d'identité ${esc(String(u.piece_type || "CNI").trim() || "CNI")} n° ${esc(String(u.piece_num).trim())}` : "";
  const matricule = u.cnss_matricule ? `, matricule ${esc(u.cnss_matricule)}` : "";
  // Une incise (pièce, matricule) se ferme par une virgule : « Monsieur X, titulaire…, matricule…, a été ».
  const qui = `${accorde(u, "Monsieur", "Madame", "M./Mme")} <b>${esc(nom)}</b>${piece}${matricule}${piece || matricule ? "," : ""}`;
  const employe = accorde(u, "employé", "employée", "employé(e)");
  const pronom = accorde(u, "Il", "Elle", "L'intéressé(e)");
  const titre = titreSignataire(signataire);
  const ou = lieu ? ` (${esc(lieu)})` : "";
  const fonction = esc(poste || "—");
  const debut = dFR(u.cnss_date_embauche), fin = dFR(u.cnss_date_sortie);
  const civSig = accorde(signataire, "Monsieur ", "Madame ", "");
  const nous = `Nous soussignés, ${IDENTITE_BMI}, représentée par ${civSig}<b>${esc(signataire?.nom || "")}</b>, ${titre},`;
  const phrase = accepteAppreciation(type) ? esc(nettoyerAppreciation(appreciation)) : "";
  // Un poste, ou le parcours : « d'abord en qualité de A jusqu'au …, puis en qualité de B à partir du … ».
  const parcours = (enCours) => {
    const ps = postesOccupes(u, poste || "—", libelleRole);
    if (ps.length < 2) return `en qualité de <b>${fonction}</b>${ou}`;
    return `d'abord en qualité de <b>${esc(ps[0].poste)}</b> jusqu'au ${dFR(ps[0].au)}, puis en qualité de <b>${fonction}</b>${ou} ${enCours ? "depuis le" : "à partir du"} ${dFR(ps[1].du)}`;
  };
  const p = [];
  if (type === "certificat") {
    p.push(`${nous} certifions que ${qui} a été ${employe} au sein de notre entreprise du <b>${debut}</b> au <b>${fin}</b>, ${parcours(false)}.`);
    p.push(`${pronom} nous quitte à la date du <b>${fin}</b>, libre de tout engagement.`);
    p.push("En foi de quoi, nous lui délivrons le présent certificat pour servir et valoir ce que de droit.");
  } else if (type === "apprentissage") {
    p.push(`${nous} attestons que ${qui} a suivi un apprentissage au sein de notre entreprise du <b>${debut}</b> au <b>${fin}</b>, dans le métier de <b>${fonction}</b>${ou}.`);
    if (phrase) p.push(phrase);
    p.push("En foi de quoi, nous lui délivrons la présente attestation pour servir et valoir ce que de droit.");
  } else if (type === "stage") {
    p.push(`${nous} attestons que ${qui} a effectué un stage au sein de notre entreprise du <b>${debut}</b> au <b>${fin}</b>, au poste de <b>${fonction}</b>${ou}.`);
    if (phrase) p.push(phrase);
    p.push("En foi de quoi, nous lui délivrons la présente attestation pour servir et valoir ce que de droit.");
  } else {
    const c = codeContrat(u);
    const etat = c === CODE_STAGE ? `effectue un stage au sein de notre entreprise depuis le <b>${debut}</b>, au poste de <b>${fonction}</b>${ou}`
      : c === CODE_APPRENTISSAGE ? `suit un apprentissage au sein de notre entreprise depuis le <b>${debut}</b>, dans le métier de <b>${fonction}</b>${ou}`
      : `est ${employe} au sein de notre entreprise depuis le <b>${debut}</b>, ${parcours(true)}`;
    const contrat = phraseContrat(u);
    const sous = contrat && c !== CODE_STAGE && c !== CODE_APPRENTISSAGE ? `, sous contrat ${c === CODE_CDI ? "à durée indéterminée (CDI)" : contrat}` : "";
    p.push(`${nous} attestons que ${qui} ${etat}${sous}.`);
    p.push("En foi de quoi, nous lui délivrons la présente attestation, à sa demande, pour servir et valoir ce que de droit.");
  }
  return { type, titre: doc.titre, nom: doc.nom, paragraphes: p, fait: `Fait à Lomé, le ${dFR(aujourdhui)}.`, signataire: { nom: signataire?.nom || "", titre: `${accorde(signataire, "Le", "La", "Le")} ${titre}`, signature: signataire?.signature || "" }, employe: nom };
}

// La ligne du journal : qui a reçu quoi, et quand (l'appréciation n'y entre pas).
export const journalDocument = (contenu, aujourdhui) =>
  `${contenu.nom} délivré(e) à ${contenu.employe} le ${dFR(aujourdhui)}`;
