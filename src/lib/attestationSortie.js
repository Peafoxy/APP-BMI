// ============================================================
// lib/attestationSortie.js — L'ATTESTATION DE FIN DE CONTRAT DANS L'ESPACE DE
// L'EMPLOYÉ, PUIS SON ACCÈS FERMÉ 24 HEURES APRÈS (14/10/2026)
//
// Timo : « un modèle Meta qui envoie un message automatique à l'employé que
// son attestation de travail est disponible dans son espace, et il a 24 heures
// maximum avant que son compte ne soit désactivé », puis « A a pour les CDI et
// b pour les CDD, B b, C ok, D oui, lance ».
//   • « A a » (CDI, contrat jamais saisi) : l'administrateur PRINCIPAL clique
//     « 📤 Mettre à disposition » (👥 Utilisateurs → ⋯ Gérer → Documents).
//   • « A b » (CDD — et le stage, l'apprentissage : contrats à durée fixe) :
//     la tournée de 7 h le fait TOUTE SEULE dès que la date de sortie arrive.
//   • « B b » : pendant les 24 h, l'employé ne voit QUE « 📄 Mon attestation ».
//   • « C » : le modèle `attestation_disponible` (lib/whatsappModeles.js).
//   • « D oui » : sans numéro, l'attestation est quand même mise à
//     disposition et les 24 h courent ; l'écran le dit.
// La mise à disposition est rangée sur la FICHE (`attestation_sortie`) ; le
// document lui-même n'est jamais rangé : il se refait à la demande, signé du
// nom de celui qui l'a mis à disposition (lib/certificatTravail.js).
// ⚠ L'heure est celle du SERVEUR (lib/horloge.js côté application ; le serveur
// a la sienne). ⚠ Lisible par le serveur : imports écrits avec « .js ».
// ============================================================
import { codeContrat, CODE_CDD } from "./contratTravail.js";
import { estSorti, documentDeSortie, critiqueDocument, DOCUMENTS_EMPLOYE, CODE_APPRENTISSAGE, CODE_STAGE } from "./certificatTravail.js";
import { estCompteFormation } from "./espace.js";
import { ligneEnvoiModele, ligneMasquee } from "./whatsappModeles.js";
import { cleConversation, CANAL_WA, construireEntete } from "./whatsappConversations.js";

export const DUREE_ACCES_SORTIE_MS = 24 * 60 * 60 * 1000;
// La tournée de 7 h passe une fois par jour : une fermeture prévue à 7 h 02 se
// fait dès la tournée de 7 h 00 (l'application, elle, ferme à la minute).
export const TOLERANCE_FERMETURE_MS = 15 * 60 * 1000;
// « A b » : les contrats à durée fixe. CDI et contrat jamais saisi : « A a ».
export const CODES_AUTOMATIQUES = [CODE_CDD, CODE_APPRENTISSAGE, CODE_STAGE];
export const ONGLET_ATTESTATION = ["mon_attestation", "📄 Mon attestation"];

export const miseADispositionAutomatique = (u) => CODES_AUTOMATIQUES.includes(codeContrat(u));
export const attestationDe = (u) => (u && u.attestation_sortie && u.attestation_sortie.ferme_le ? u.attestation_sortie : null);
const ms = (iso) => Date.parse(iso || "");
export const enPeriodeDeSortie = (u, maintenant) => { const a = attestationDe(u); return !!a && Number(maintenant) < ms(a.ferme_le); };
export const accesFerme = (u, maintenant) => { const a = attestationDe(u); return !!a && Number(maintenant) >= ms(a.ferme_le); };

const deux = (n) => String(n).padStart(2, "0");
// La fermeture en clair, heure de Lomé (GMT) : { date: "15/10/2026", heure: "11:05" }.
export function momentFermeture(a) {
  const d = new Date(ms(a?.ferme_le));
  if (Number.isNaN(d.getTime())) return { date: "", heure: "" };
  return { date: `${deux(d.getUTCDate())}/${deux(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, heure: `${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}` };
}
export const nomDocument = (a) => (DOCUMENTS_EMPLOYE[a?.type] || DOCUMENTS_EMPLOYE.certificat).nom;

// "" = accepté. Revérifié DANS le geste, sur la fiche fraîche (paie recollée).
export function critiqueMiseADisposition(u, aujourdhui) {
  if (!u || !u.role || u.role === "client") return "L'attestation de fin de contrat ne se met à disposition que d'un membre du personnel.";
  const deja = attestationDe(u);
  if (deja) { const f = momentFermeture(deja); return `${nomDocument(deja)} de ${u.nom} est déjà à sa disposition : son accès se ferme le ${f.date} à ${f.heure}.`; }
  if (u.actif === false) return `Le compte de ${u.nom} est déjà bloqué : il ne pourrait pas ouvrir son espace.`;
  // La date d'embauche, la date de sortie ARRIVÉE, le bon document : la règle du certificat.
  return critiqueDocument(documentDeSortie(u), u, aujourdhui);
}

// La marque posée sur la fiche. `maintenant` = l'heure du serveur, en ms.
export function construireMiseADisposition({ u, par, maintenant, appreciation = "", auto = false }) {
  return {
    type: documentDeSortie(u),
    dispo_le: new Date(maintenant).toISOString(),
    ferme_le: new Date(maintenant + DUREE_ACCES_SORTIE_MS).toISOString(),
    par: par?.nom_complet || par?.nom || "BMI TOGO",
    par_id: par?.id || null,
    appreciation: String(appreciation || ""),
    auto: !!auto,
  };
}

// « A b » — la tournée de 7 h. `db.users` porte la fiche de paie recollée
// (fusionnerPaie). Le mur : jamais un compte de formation.
export function aMettreADispositionAuto(db, aujourdhui) {
  return (db?.users || []).filter((u) => u && u.role && u.role !== "client" && u.actif !== false
    && !estCompteFormation(db, u) && miseADispositionAutomatique(u) && estSorti(u, aujourdhui) && !attestationDe(u));
}

// Les comptes à fermer (la tournée) : leurs 24 h sont passées (à la tolérance près).
export function comptesAFermer(db, maintenant) {
  return (db?.users || []).filter((u) => u && u.actif !== false && attestationDe(u)
    && Number(maintenant) + TOLERANCE_FERMETURE_MS >= ms(attestationDe(u).ferme_le));
}

// Ce que dit l'écran de connexion — et le serveur — à un accès fermé.
export function messageAccesFerme(u) {
  const f = momentFermeture(attestationDe(u));
  return `Votre accès à l'application BMI a été fermé le ${f.date} à ${f.heure} : votre contrat est terminé. Pour toute question, contactez BMI TOGO au +228 99 96 84 88.`;
}

// ---- La tournée de 7 h : la ligne PRIVÉE du fil 📲 WhatsApp (le détail se
// recompose depuis la fiche, lib/lignesPrivees.js) et la fiche légère. ----
export const MODELE_ATTESTATION = "attestation_disponible";
export function ligneAttestation({ id, tel, employe, variables, ts, auteur }) {
  const cle = cleConversation(tel);
  if (!cle || !ligneEnvoiModele(MODELE_ATTESTATION, variables)) return null;
  return {
    id, date: String(ts).slice(0, 10), ts,
    de_id: auteur?.id || "bmi-systeme", de_nom: auteur?.nom || "BMI TOGO", lu_par: [],
    canal: CANAL_WA, wa_tel: cle, wa_numero: tel, wa_nom: employe?.nom_complet || employe?.nom || "",
    texte: ligneMasquee(MODELE_ATTESTATION), wa_modele: MODELE_ATTESTATION, wa_prive: true,
    attestation_user_id: employe?.id,
  };
}
export const enteteApresAttestation = ({ tel, employe, ts, entete }) =>
  construireEntete({
    cle: cleConversation(tel), tel, nom: employe?.nom_complet || employe?.nom || "",
    proprietaire_id: entete?.proprietaire_id || "", proprietaire_nom: entete?.proprietaire_nom || "", derniere: ts, entete,
  });

// La notification du matin à l'administrateur PRINCIPAL : ce qui a été mis à
// disposition, ce qui manque pour le faire, les comptes fermés. null = rien.
export function notificationFinsDeContrat({ principal, faits = [], aCompleter = [], fermes = [], aujourdhui }) {
  if (!principal || (!faits.length && !aCompleter.length && !fermes.length)) return null;
  const morceaux = [];
  if (faits.length) morceaux.push(`Mis à disposition : ${faits.join(" ; ")}`);
  if (aCompleter.length) morceaux.push(`Date d'embauche à saisir avant la mise à disposition : ${aCompleter.join(", ")}`);
  if (fermes.length) morceaux.push(`Accès fermé : ${fermes.join(", ")}`);
  return { destinataires: [principal.id], titre: "📄 Fins de contrat", texte: `${morceaux.join(". ")}.`, ecran: "users", tag: `attestations:${String(aujourdhui).slice(0, 10)}` };
}
