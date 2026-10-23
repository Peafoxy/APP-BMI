// ============================================================
// scripts/verifier-whatsapp.mjs — L'ENVOI WHATSAPP DEPUIS LE NUMÉRO BMI
//
//   npm run verifier-whatsapp
//
// ⚠ POURQUOI CE BANC EXISTE. Un message qui part au nom de BMI ne se
// rattrape pas : il est chez le client. Trois fautes seraient silencieuses
// et graves — (1) les trous d'un modèle remplis DANS LE MAUVAIS ORDRE (le
// client lirait son montant à la place de son nom), (2) un message parti
// d'un devis d'ENTRAÎNEMENT vers un vrai client, (3) un mot de passe glissé
// dans un modèle, que Meta refuse et qui promènerait une clé.
//
// Le banc exerce les VRAIES fonctions (le module est sans import, Node le
// lit tel quel) et LIT le code des écrans pour les règles qui ne se
// mesurent pas autrement (un seul chemin, aucun secret, la trace).
// ============================================================
import { readFileSync, unlinkSync, readdirSync, mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { execSync } from "node:child_process";
import * as M from "../src/lib/whatsappModeles.js";

let ok = 0, ko = 0;
const test = (nom, cond, detail) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); if (detail !== undefined) console.log(`      → ${String(detail).slice(0, 400)}`); } };
const titre = (t) => console.log(`\n${t}`);
const lire = (f) => readFileSync(f, "utf8");

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} F`;
const dFR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

// ──────────────────────────────────────────────────────────────
titre("① LES SIX MODÈLES, ET L'ORDRE DE LEURS TROUS");
// ⚠ Ces nombres sont ceux des modèles SOUMIS À META le 19/09/2026. Changer
// l'ordre ou le nombre ici sans le changer chez Meta enverrait le montant à
// la place du nom — et Meta ne s'en plaindrait pas.
const ATTENDU = {
  devis_disponible: { categorie: "marketing", n: 3 },
  // 📎 17/10/2026 (« A a, B a, C a ») : le devis AVEC son PDF en en-tête
  // document. MARKETING (une offre), les trois trous de devis_disponible.
  devis_pdf: { categorie: "utility", n: 3 }, // RETOURNÉ le 17/10/2026 : Meta l'a rangé en utility
  // 📎 19/10/2026 (« Ab, Ba, Cb, textes ok ») : le reçu et la proforma avec leur PDF.
  recu_pdf: { categorie: "utility", n: 4 },
  proforma_pdf: { categorie: "marketing", n: 5 },
  relance_devis: { categorie: "marketing", n: 4 },
  // ⚠ LE DIX-SEPTIÈME (26/09/2026, « texte ok, une seule relance, lance ») :
  // la relance AUTOMATIQUE du 8e jour, qui annonce la fin de l'offre.
  // MARKETING (un devis est une offre), CINQ trous. Serveur seul.
  relance_devis_expiration: { categorie: "marketing", n: 5 },
  devis_valide_paiement: { categorie: "utility", n: 4 },
  rappel_echeance: { categorie: "utility", n: 5 },
  // ⚠ LE SIXIÈME (20/09/2026, décision « c ») : la relance d'une DETTE
  // ordinaire. UTILITY — un rappel de paiement porte sur une transaction en
  // cours, au contraire d'un devis qui est une OFFRE.
  rappel_dette: { categorie: "utility", n: 4 },
  // ⚠ LE CINQUIÈME (20/09/2026) : le SEUL qui ne parle pas d'un devis —
  // c'est ce qui permet d'écrire le premier à quelqu'un qui n'en a pas.
  prise_de_contact: { categorie: "marketing", n: 3 },
  // ⚠ LE SEPTIÈME (22/09/2026, capture Timo : « le message ne passe pas
  // par le numéro BMI ») : les identifiants d'un compte qu'on vient de
  // créer. UTILITY (sa précision). Trois trous : nom, identifiant, mot de
  // passe — le SEUL modèle qui porte un secret (voir la section ②).
  espace: { categorie: "utility", n: 3 },
  espace_portail: { categorie: "marketing", n: 3 }, // 14/10/2026, essayé AVANT `espace` (« a »)
  // ⚠ LES TROIS DE TIMO (23/09/2026) : le mot de fidélité, MARKETING (il fait
  // de la promotion), en DEUX textes — avec et sans les lignes de l'espace
  // client (décision « 2 ») — un seul trou, le nom ; et le reçu de vente,
  // UTILITY (une transaction), SEPT trous remplis depuis la vente.
  mot_fidelite: { categorie: "marketing", n: 1 },
  mot_fidelite_simple: { categorie: "marketing", n: 1 },
  recu_vente: { categorie: "utility", n: 7 },
  // ⚠ LE QUATORZIÈME (25/09/2026, « écris-moi le texte… on implémente avec
  // le détail des trous ») : le reçu de vente AVEC la liste des articles,
  // sur une ligne. UTILITY, HUIT trous. Il est tenté d'abord, le court ensuite.
  recu_vente_detail: { categorie: "utility", n: 8 },
  // 🏗 13/10/2026 (« A ok, B non, C b ») : le reçu d'un DÉPÔT CHANTIER, sept trous.
  recu_depot_chantier: { categorie: "utility", n: 7 },
  // ⚠ LE ONZIÈME (25/09/2026, « Lance avec ce texte ») : l'alerte à
  // l'administrateur quand un client demande un conseiller. UTILITY, trois
  // trous. Il ne part JAMAIS d'un écran : c'est le serveur qui l'envoie.
  alerte_conseiller: { categorie: "utility", n: 3 },
  // ⚠ LES DOUZIÈME ET TREIZIÈME (25/09/2026, « Lance avec ces deux textes ») :
  // le reçu d'un versement sur une dette et celui d'une réservation. UTILITY
  // (des transactions en cours), SEPT trous chacun.
  recu_reglement: { categorie: "utility", n: 7 },
  recu_reservation: { categorie: "utility", n: 7 },
  // ⚠ LES QUINZIÈME ET SEIZIÈME (25/09/2026, « lance les deux bons ») : le bon
  // de reprise et le bon de retour, dans la forme du bon imprimé. UTILITY.
  bon_reprise: { categorie: "utility", n: 12 },
  bon_retour: { categorie: "utility", n: 11 },
  // (`devis_premier`, un temps dix-septième, a été RETIRÉ le 25/09/2026 :
  // refusé trois fois par Meta.)
  // ⚠ LE DIX-HUITIÈME (26/09/2026, « 5 ») : le rappel d'entretien, envoyé par
  // la tournée de 7 h. UTILITY (un service), trois trous.
  rappel_entretien: { categorie: "utility", n: 3 },
  // ⚠ LE DIX-NEUVIÈME (26/09/2026, « 6 ») : la demande d'avis Google, dix
  // jours après la réception. MARKETING, trois trous, serveur seul.
  demande_avis: { categorie: "marketing", n: 3 },
  // ⚠ LE VINGTIÈME (29/09/2026, son texte) : le rappel du solde d'une pose
  // seule, 3 jours après le PV. UTILITY, quatre trous, serveur seul.
  rappel_solde_pose: { categorie: "utility", n: 4 },
  proforma: { categorie: "marketing", n: 8 },
  // ⚠ LES VINGT-DEUXIÈME À VINGT-CINQUIÈME (01/10/2026, « Lance ») : le lien
  // de signature du PV et l'avenant (UTILITY), l'accueil et la relance d'un
  // prospect (MARKETING).
  lien_signature_pv: { categorie: "utility", n: 3 },
  avenant_reserves: { categorie: "utility", n: 3 },
  accueil_prospect: { categorie: "marketing", n: 1 },
  relance_prospect: { categorie: "marketing", n: 3 },
  // 03/10/2026 : l'avis de paiement d'un salaire (texte de Timo).
  virement_salaire: { categorie: "utility", n: 7 },
  virement_salaire_credit: { categorie: "utility", n: 10 },
  // 03/10/2026 : la commission devenue due (texte de Timo).
  commission_due: { categorie: "utility", n: 4 },
  avancement_employe: { categorie: "utility", n: 5 },
  anniversaire_employe: { categorie: "marketing", n: 1 },
  rappel_anniversaire: { categorie: "utility", n: 2 },
  // 07/10/2026 : la part des frais d'installation payée (« b, texte ok »).
  prime_installation_payee: { categorie: "utility", n: 6 },
  // 10/10/2026 : le loyer qui attend le propriétaire (« A a, B b, C a »).
  loyer_disponible: { categorie: "utility", n: 6 },
  // 12/10/2026 : l'affectation à un chantier, son changement, le rappel de
  // la veille au chef (« Aa, Ba, Ca, texte ok »).
  affectation_chantier: { categorie: "utility", n: 9 },
  changement_affectation: { categorie: "utility", n: 3 },
  rappel_installation: { categorie: "utility", n: 8 },
  // 12/10/2026 (« Ab, Bb, Ca ») : le client prévenu, puis la date déplacée.
  installation_programmee: { categorie: "utility", n: 6 },
  installation_deplacee: { categorie: "utility", n: 7 },
  // 12/10/2026 (📅 Rendez-vous, « D a », « G », « C ») : le participant
  // ajouté, le changement, la visite au client ; puis les deux rappels du
  // serveur (la veille à 14 h, le jour même à 7 h), dont le privé neutre.
  rendez_vous_equipe: { categorie: "utility", n: 7 },
  rendez_vous_modifie: { categorie: "utility", n: 3 },
  visite_client: { categorie: "utility", n: 6 },
  rappel_rendez_vous: { categorie: "utility", n: 6 },
  rappel_rendez_vous_prive: { categorie: "utility", n: 3 },
  // 13/10/2026 (« A a, B b, C ok ») : le CHEF d'une visite, avec le numéro
  // du client — l'avis (écran) et le rappel (serveur seul).
  depense_rejetee: { categorie: "utility", n: 7 },
  depense_validee: { categorie: "utility", n: 6 },
  // 22/10/2026 (« Ab, Bb, Cb, texte ok ») : l'argent remis directement à quelqu'un.
  fonds_remis: { categorie: "utility", n: 6 },
  tache_assignee: { categorie: "utility", n: 5 },
  tache_validee: { categorie: "utility", n: 3 },
  // 14/10/2026 (« A a CDI, b CDD, B b, C ok, D oui ») : l'attestation de fin de contrat disponible.
  attestation_disponible: { categorie: "utility", n: 5 },
  visite_chef: { categorie: "utility", n: 9 },
  rappel_visite_chef: { categorie: "utility", n: 8 },
};
// ⚠ RETOURNÉ le 23/09/2026 : DIX modèles — les trois de Timo (mot de fidélité
// avec et sans espace, reçu de vente) s'ajoutent aux sept.
test("les cinquante-six modèles sont là, et eux seuls (RETOURNÉ le 22/10/2026 : + `fonds_remis`, l'argent remis directement à quelqu'un ; le 19/10/2026 : + `recu_pdf` et `proforma_pdf`, le reçu et la proforma avec leur PDF ; le 17/10/2026 : + `devis_pdf`, le devis avec son PDF ; le 14/10/2026 : + `espace_portail`, puis + l'avis d'une tâche assignée et validée, puis + l'attestation de fin de contrat disponible ; le 13/10/2026 : + les deux avis de décision du DG sur une dépense, puis + l'avis et le rappel du chef d'une visite, puis + le reçu de dépôt chantier ; le 12/10/2026 au soir : + les cinq des rendez-vous ; le 12/10/2026 : + l'affectation à un chantier, son changement, le rappel de la veille au chef, puis l'avis au client et son changement de date ; le 10/10/2026 : + le loyer disponible ; le 07/10/2026 : + la part d'installation payée ; le 03/10/2026 : + l'avis de salaire, puis sa version avec crédit, puis la commission due, puis l'avis d'avancement, puis les vœux d'anniversaire, puis le rappel de la veille à l'administrateur ; le 01/10/2026 : + PV, avenant, accueil et relance d'un prospect ; le 30/09/2026 : + la proforma ; le 29/09/2026 : + le rappel du solde de pose ; le 26/09/2026 : + la relance automatique du 8e jour, puis + le rappel d'entretien, puis + la demande d'avis ; avant : dix + l'alerte + les deux reçus de dette et de réservation, le reçu de vente détaillé, les deux bons ; `devis_premier` RETIRÉ, refusé par Meta)", M.NOMS_MODELES.join(",") === Object.keys(ATTENDU).join(","));
for (const [nom, a] of Object.entries(ATTENDU)) {
  test(`★ « ${nom} » : ${a.n} trous, catégorie ${a.categorie}`,
    M.MODELES[nom]?.variables.length === a.n && M.MODELES[nom]?.categorie === a.categorie);
}
test("un devis est du MARKETING (leçon des refus du 19/09)",
  M.MODELES.devis_disponible.categorie === "marketing" && M.MODELES.relance_devis.categorie === "marketing");
test("un contrat signé est de l'UTILITY",
  M.MODELES.devis_valide_paiement.categorie === "utility" && M.MODELES.rappel_echeance.categorie === "utility");
// ⚠ CONTRÔLE RETOURNÉ LE 20/09/2026, PAS SUPPRIMÉ : il exigeait que
// `rappel_echeance` NE SOIT PAS employé, parce qu'aucune règle ne savait
// quand une dette a une vraie échéance. Cette règle existe depuis
// `envoiRappelDette` — il est donc en service, mais SEULEMENT sur un plan
// de règlement. Ce qui est protégé n'a pas changé d'un mot : on n'écrit
// jamais une date d'échéance à un client qui n'en a pas.
test("★★ rappel_echeance est en service, et ne part QUE sur une échéance réelle",
  M.MODELES_EN_SERVICE.includes("rappel_echeance")
  && M.envoiRappelDette({ dette: { montant: 100, paye: 0 }, compte: null, fmt, dFR }).modele === "rappel_dette"
  && M.envoiRappelDette({ dette: { montant: 100, paye: 0 }, compte: null, echeance: { date: "" }, fmt, dFR }).modele === "rappel_dette");
// ⚠ RETOURNÉ le 25/09/2026 : tous en service POUR LES ÉCRANS, SAUF l'alerte,
// que seul le serveur envoie (un écran qui l'enverrait serait une faute).
// RETOURNÉ le 26/09/2026 : la relance automatique du 8e jour est, elle
// aussi, envoyée par le SERVEUR seul (la tournée de 7 h).
// RETOURNÉ encore le 26/09/2026 : le rappel d'entretien aussi (même tournée).
// RETOURNÉ le 29/09/2026 : + le rappel du solde d'une pose (tournée de 7 h).
const SERVEUR_SEUL = ["alerte_conseiller", "relance_devis_expiration", "rappel_entretien", "demande_avis", "rappel_solde_pose", "anniversaire_employe", "rappel_anniversaire", "rappel_installation", "rappel_rendez_vous", "rappel_rendez_vous_prive", "rappel_visite_chef"]; /* RETOURNÉ le 13/10/2026 : + le rappel du chef d'une visite ; le 12/10/2026 au soir : + les deux rappels de rendez-vous (tournées de 14 h et de 7 h) ; le 12/10/2026 : + le rappel d'installation de la veille au chef (tournée de 17 h) ; le 03/10/2026 : + les vœux d'anniversaire (tournée de 7 h), + le rappel de la veille (tournée de 17 h) */
test("tous les modèles sont en service pour les écrans, sauf ceux du serveur seul (l'alerte, la relance automatique, le rappel d'entretien, la demande d'avis)",
  M.NOMS_MODELES.filter((n) => !SERVEUR_SEUL.includes(n)).every((n) => M.MODELES_EN_SERVICE.includes(n))
  && SERVEUR_SEUL.every((n) => !M.MODELES_EN_SERVICE.includes(n)));

// ──────────────────────────────────────────────────────────────
titre("② AUCUN SECRET NE VOYAGE DANS UN MODÈLE");
// Meta range tout identifiant de connexion dans sa catégorie
// « authentication » et refuse le modèle. Et un message qui promène un mot
// de passe est une clé qui se promène.
// ⚠ CONTRÔLE RETOURNÉ LE 22/09/2026, PAS SUPPRIMÉ : il exigeait qu'AUCUN
// modèle ne porte un secret. Le modèle `espace`, écrit par Timo sans les
// mots « mot de passe » ni « identifiant », a été APPROUVÉ par Meta et
// branché sur sa capture (« le message ne passe pas par le numéro BMI »).
// Ce qui est protégé n'a pas changé : les modèles de DEVIS et de RELANCE
// ne portent aucun secret — `espace` est le SEUL, et il ne sert qu'à
// remettre ses identifiants à un compte qu'on vient de créer.
const MOTS_SECRETS = ["motdepasse", "mot_de_passe", "pwd", "identifiant", "mdp"];
// ⚠ RETOURNÉ deux fois le 25/09/2026 : `devis_premier` (un devis avec ses
// accès) y est entré, puis en est RESSORTI — refusé par Meta, supprimé par
// Timo. `espace` est de nouveau le SEUL modèle qui porte un secret.
// ⚠ RETOURNÉ le 14/10/2026 : `espace_portail` (même rôle, autre texte, essayé
// avant `espace`) porte les MÊMES trois trous. Ce sont les DEUX seuls.
const PORTEURS_DE_SECRET = ["espace", "espace_portail"];
const trousHorsEspace = Object.entries(M.MODELES).filter(([n]) => !PORTEURS_DE_SECRET.includes(n)).flatMap(([, m]) => m.variables).join(" ").toLowerCase();
test("★ aucun trou d'un modèle de devis ou de relance ne s'appelle mot de passe ou identifiant (sauf espace et espace_portail)",
  !MOTS_SECRETS.some((s) => trousHorsEspace.includes(s)));
test("★ `espace` et `espace_portail` sont les SEULS qui portent un secret (les mêmes trois trous, dans le même ordre), et `devis_premier` (refusé par Meta) n'existe plus",
  M.MODELES.espace.variables.join(",") === "client,identifiant,mot_de_passe"
  && M.MODELES.espace_portail.variables.join(",") === "client,identifiant,mot_de_passe"
  && !M.MODELES.devis_premier && !M.MODELES_EN_SERVICE.includes("devis_premier") && !M.envoiDevisPremier && !M.TEXTE_DEVIS_PREMIER);
const srcPartages = lire("src/screens/dimensionnement/Partages.jsx");
const srcDevis = lire("src/screens/TousLesDevis.jsx");
test("★ aucun écran ne passe un mot de passe à l'envoi automatique",
  !/envoyerModele\([^)]*motDePasse/s.test(srcPartages) && !/envoyerModele\([^)]*motDePasse/s.test(srcDevis));

// ──────────────────────────────────────────────────────────────
titre("③ CE QU'ON MET DANS UN TROU (Meta refuse un retour à la ligne)");
test("un retour à la ligne devient une espace", M.texteVariable("KOSSI\nMENSAH") === "KOSSI MENSAH");
test("une tabulation aussi", M.texteVariable("A\tB") === "A B");
test("quatre espaces de suite sont ramenées à une", M.texteVariable("A    B") === "A B");
test("les bords sont rognés", M.texteVariable("  AMA  ") === "AMA");
test("un texte trop long est coupé", M.texteVariable("x".repeat(500)).length === M.LONGUEUR_MAX_VARIABLE);
test("rien du tout rend une chaîne vide", M.texteVariable(null) === "");

// ──────────────────────────────────────────────────────────────
titre("④ LE REFUS DIT POURQUOI, EN FRANÇAIS");
test("un modèle inconnu est refusé", !!M.critiqueModele("inconnu", []));
test("★ trop peu d'informations est refusé", !!M.critiqueModele("devis_disponible", ["AMA", "solaire"]));
test("★ trop d'informations aussi", !!M.critiqueModele("devis_disponible", ["AMA", "solaire", "1 F", "en trop"]));
test("un trou vide est refusé, et le refus le NOMME",
  (M.critiqueModele("devis_disponible", ["AMA", "", "1 F"]) || "").includes("domaine"));
test("trois informations justes passent", M.critiqueModele("devis_disponible", ["AMA", "solaire", "1 000 F"]) === "");

// ──────────────────────────────────────────────────────────────
titre("⑤ LE MUR — un devis de formation n'écrit jamais à un vrai client");
const bon = { modele: "relance_devis", variables: ["AMA", "solaire", "1 F", "12/09/2026"], tel: "90112233" };
test("★ espace formation : refusé", M.critiqueEnvoiAuto({ ...bon, espaceFormation: true }) === M.MOTIF_FORMATION);
test("espace réel : accepté", M.critiqueEnvoiAuto({ ...bon, espaceFormation: false }) === "");
test("★ premier contact : refusé (le message porte ses identifiants)",
  M.critiqueEnvoiAuto({ ...bon, espaceFormation: false, premierContact: true }) === M.MOTIF_PREMIER_CONTACT);
test("sans numéro : refusé", !!M.critiqueEnvoiAuto({ ...bon, tel: "", espaceFormation: false }));
test("hors ligne : refusé (pas de file d'attente, une relance en retard est une faute)",
  !!M.critiqueEnvoiAuto({ ...bon, espaceFormation: false, enLigne: false }));
// ⚠ CONTRÔLE RETOURNÉ LE 20/09/2026 : il s'appuyait sur `rappel_echeance`,
// qui est en service depuis la relance des dettes. La GARDE, elle, n'a pas
// bougé d'un mot — elle est éprouvée sur un nom qui n'est dans aucune liste.
test("un modèle pas encore en service est refusé",
  /pas encore en service/.test(M.critiqueEnvoiAuto({ ...bon, modele: "modele_pas_encore_approuve", variables: ["a"], espaceFormation: false })));

// ──────────────────────────────────────────────────────────────
titre("⑥ LE NUMÉRO, TEL QUE WHATSAPP LE VEUT");
test("8 chiffres → indicatif togolais", M.numeroWhatsApp("90112233") === "+22890112233");
test("écrit avec des espaces et un +", M.numeroWhatsApp("+228 90 11 22 33") === "+22890112233");
test("écrit en 00228", M.numeroWhatsApp("0022890112233") === "+22890112233");
test("un numéro étranger est gardé tel quel", M.numeroWhatsApp("+33612345678") === "+33612345678");
test("pas de numéro → rien", M.numeroWhatsApp("") === "");

// ──────────────────────────────────────────────────────────────
titre("⑦ LE DOCUMENT PARLE LA LANGUE DU CLIENT");
test("★ « garage » se dit PORTAIL au client (jamais le mot du code)", M.domaineDevis({ type_devis: "garage" }) === "portail");
test("le solaire se dit solaire", M.domaineDevis({ type_devis: "solaire" }) === "solaire");
test("un devis sans type est solaire", M.domaineDevis({}) === "solaire");
test("un devis « autre » prend le besoin du client", M.domaineDevis({ type_devis: "autre", besoins: { categorie: "Vidéo surveillance" } }) === "Vidéo surveillance");
test("★ un devis « autre » SANS besoin n'est jamais vide (Meta refuse un trou vide)",
  M.domaineDevis({ type_devis: "autre" }) === "installation");

// ──────────────────────────────────────────────────────────────
titre("⑧ LA RELANCE CHOISIT SON MODÈLE SELON LE STATUT");
const client = { nom: "KOSSI90112233", nom_base: "KOSSI MENSAH", tel: "90112233" };
const propose = { id: "d1", statut: "propose", type_devis: "solaire", total: 1250000, date: "2026-09-12" };
const valide = { id: "d2", statut: "valide", total: 1250000, contrat_numero: "CT-2026-014", boutique_paiement: "BMI DEMAKPOE" };
const r1 = M.envoiRelanceDevis({ devis: propose, compte: client, fmt, dFR });
test("★ un devis PROPOSÉ part en relance_devis", r1.modele === "relance_devis");
test("…avec nom, domaine, montant, date, dans CET ordre",
  r1.variables[0] === "KOSSI MENSAH" && r1.variables[1] === "solaire" && r1.variables[2] === fmt(1250000) && r1.variables[3] === "12/09/2026");
test("…et il passe le contrôle", M.critiqueModele(r1.modele, r1.variables) === "");
const r2 = M.envoiRelanceDevis({ devis: valide, compte: client, fmt, dFR });
test("★ un devis VALIDÉ part en devis_valide_paiement", r2.modele === "devis_valide_paiement");
test("…avec nom, montant, contrat, boutique",
  r2.variables[1] === fmt(1250000) && r2.variables[2] === "CT-2026-014" && r2.variables[3] === "BMI DEMAKPOE");
test("…et il passe le contrôle", M.critiqueModele(r2.modele, r2.variables) === "");
test("un devis validé SANS numéro de contrat ne laisse pas un trou vide",
  M.critiqueModele("devis_valide_paiement", M.envoiRelanceDevis({ devis: { statut: "valide", total: 1 }, compte: client, fmt, dFR }).variables) === "");
test("★ un devis PAYÉ ne se relance pas (règle du 09/09/2026)", M.envoiRelanceDevis({ devis: { statut: "paye" }, compte: client, fmt, dFR }) === null);
test("★ un devis REJETÉ non plus", M.envoiRelanceDevis({ devis: { statut: "rejete" }, compte: client, fmt, dFR }) === null);

// ──────────────────────────────────────────────────────────────
titre("⑨ LE PREMIER MESSAGE PART TOUJOURS À LA MAIN");
test("★ un client tout neuf est un premier contact", !M.clientDejaContacte({ nom: "AMA" }, "d1"));
test("un client qui n'a QUE ce devis-ci aussi", !M.clientDejaContacte({ devis: [{ id: "d1" }] }, "d1"));
test("★ un client qui porte un AUTRE devis a déjà ses codes", M.clientDejaContacte({ devis: [{ id: "d0" }, { id: "d1" }] }, "d1"));
test("★ un client qui a déjà ouvert l'application aussi", M.clientDejaContacte({ info_donnees_le: "2026-09-01" }, "d1"));
test("pas de compte du tout : premier contact", !M.clientDejaContacte(null, "d1"));

// ──────────────────────────────────────────────────────────────
titre("⑩ LA TRACE DIT CE QU'ELLE SAIT, ET RIEN DE PLUS");
const t = M.traceEnvoi({ modele: "relance_devis", par: "AKOSSIWA", quand: "2026-09-19", heure: "14:12", id: "msg_1" });
test("elle nomme qui, quand, et par quel modèle", t.par === "AKOSSIWA" && t.le === "2026-09-19" && t.modele === "relance_devis");
const lisible = M.libelleTrace(t);
test("elle se lit en français", lisible.includes("AKOSSIWA") && lisible.includes("14:12"));
test("★ elle ne prétend JAMAIS que le client a LU (on ne le sait pas encore)",
  !/\blu\b|livré|reçu par/i.test(lisible) && !/\blu\b|livré/i.test(JSON.stringify(t)));
test("une trace vide ne s'affiche pas", M.libelleTrace(null) === "" && M.libelleTrace({}) === "");

// ──────────────────────────────────────────────────────────────
titre("⑪ UN SEUL CHEMIN, ET LA CLÉ N'EST NULLE PART DANS L'APPLICATION");
const srcWhatsapp = lire("src/whatsapp.js");
const apiWhatsapp = lire("api/whatsapp.js");
const fichiers = [
  "src/screens/TousLesDevis.jsx", "src/screens/dimensionnement/Partages.jsx",
  "src/screens/Dettes.jsx", "src/screens/Ventes.jsx", "src/screens/Clients.jsx",
  "src/screens/ClientsInstalles.jsx", "src/screens/Utilisateurs.jsx", "src/App.jsx",
];
test("★ seul src/whatsapp.js appelle le serveur (whatsappEnLigne)",
  srcWhatsapp.includes("whatsappEnLigne") && fichiers.every((f) => !lire(f).includes("whatsappEnLigne")));
test("★ aucun écran n'appelle /api/whatsapp lui-même",
  fichiers.every((f) => !lire(f).includes("/api/whatsapp")));
// ⚠ RETOURNÉ le 24/09/2026 : la porte vers YCloud est écrite UNE fois
// (api/_ycloud.js), parce que l'assistant du webhook envoie lui aussi. La
// clé n'est LUE que là (et dans api/whatsapp-media.js, qui va chercher un
// fichier) ; api/whatsapp.js passe par la porte, il ne lit plus la clé.
test("★ la clé YCloud n'existe que dans la fonction serveur (api/_ycloud.js), et api/whatsapp.js passe par cette porte",
  /process\.env\.YCLOUD_API_KEY/.test(lire("api/_ycloud.js"))
  && !/process\.env\.YCLOUD/.test(apiWhatsapp)
  && /import \{[^}]*envoyerYCloud[^}]*\} from "\.\/_ycloud\.js"/.test(apiWhatsapp)
  && !fichiers.some((f) => lire(f).includes("YCLOUD"))
  && !srcWhatsapp.includes("YCLOUD") && !lire("src/lib/whatsappModeles.js").includes("YCLOUD"));
test("★★ elle n'est JAMAIS préfixée VITE_ (Vite l'embarquerait dans le navigateur)",
  !apiWhatsapp.includes("VITE_YCLOUD") && !apiWhatsapp.includes("VITE_WHATSAPP")
  // (on retire les commentaires avant de chercher : la phrase qui EXPLIQUE la règle contient le mot)
  && !lire("api/_ycloud.js").replace(/\/\/[^\n]*/g, "").includes("VITE_"));
test("★ le serveur IMPORTE la liste des modèles, il ne la recopie pas",
  /import\s*\{[^}]*MODELES[^}]*\}\s*from\s*["']\.\.\/src\/lib\/whatsappModeles\.js["']/.test(apiWhatsapp)
  && !/const\s+MODELES\s*=/.test(apiWhatsapp));
test("★ le serveur revérifie le mur lui-même", apiWhatsapp.includes("estCompteFormation"));
test("★ le serveur refuse un compte client ou bloqué", /role === "client"/.test(apiWhatsapp) && /actif === false/.test(apiWhatsapp));
test("la règle pure ne dépend de rien (le serveur la lit telle quelle)",
  !/^\s*import\s/m.test(lire("src/lib/whatsappModeles.js")));

// ──────────────────────────────────────────────────────────────
titre("⑫ RIEN N'EST JAMAIS PERDU EN SILENCE");
// ⚠ RETOURNÉ le 29/09/2026 : le repli passe par LA règle des fenêtres.
test("★ tout refus ramène l'ouverture WhatsApp d'aujourd'hui (par la règle qui annonce AVANT)",
  /const repli = async[\s\S]*ouvrirWhatsAppApresAnnonce\(\{ tel, texte: texteRepli/.test(srcWhatsapp));
test("★ une panne du serveur aussi", /catch[\s\S]*return repli\(/.test(srcWhatsapp));
test("★ une réponse en erreur aussi", /reponse\.error[\s\S]*return repli\(/.test(srcWhatsapp));
// ⚠ RETOURNÉ le 23/10/2026 : le seul minuteur permis est celui d'`avecDelai`
// (le PDF du reçu a 20 s pour être prêt) — il ABANDONNE, il ne renvoie rien.
test("★ aucune file d'attente (une relance en retard est une faute) : le seul minuteur est celui qui abandonne un PDF trop lent",
  !/localStorage/.test(srcWhatsapp) && (srcWhatsapp.match(/setTimeout/g) || []).length === 1
  && /export function avecDelai\(promesse, ms\) \{\n  let minuteur;\n  const delai = new Promise\(\(resoudre\) => \{ minuteur = setTimeout\(\(\) => resoudre\(\{ hors_delai: true \}\), ms\); \}\);/.test(srcWhatsapp));
// ⚠ RETOURNÉ le 25/09/2026 : Partages envoie aussi `espace` AVANT le premier
// devis, SANS repli (sinon WhatsApp s'ouvrirait deux fois) — c'est le repli
// du DEVIS qui porte alors les codes. Seul cet envoi-là est dispensé.
test("★ les écrans passent TOUJOURS un texte de repli (sauf l'envoi d'`espace` avant le premier devis, sansRepli)",
  (srcDevis.match(/envoyerModele\(\{/g) || []).length === (srcDevis.match(/texteRepli:/g) || []).length
  && (srcPartages.match(/envoyerModele\(\{/g) || []).length === (srcPartages.match(/texteRepli:/g) || []).length + (srcPartages.match(/modele: acces\.modele[^}]*sansRepli: true/g) || []).length
    // ⚠ RETOURNÉ le 17/10/2026 : l'essai du PDF (`devis_pdf`) part SANS repli — s'il échoue, le devis repart par l'envoi ordinaire, AVEC son repli.
    + (srcPartages.match(/modele: envoiPdf\.modele[^}]*sansRepli: true, fichier/g) || []).length);
test("★ la trace ne s'écrit QUE si le message est vraiment parti du n° BMI",
  /if \(r\.auto\)/.test(srcPartages) && /r\.auto \? traceEnvoi/.test(srcDevis));
test("★ les écrans passent l'espace du DEVIS, jamais celui de la personne",
  /espaceFormation: espaceDuDevis\(db, d, profile\)/.test(srcDevis)
  // ⚠ RETOURNÉ le 25/09/2026 : calculé UNE fois pour les deux envois (espace, puis le devis).
  && /const espaceFormation = !!espaceDeLaFiche\(devisMarque\);/.test(srcPartages)
  && !/espaceFormation: (?!!!espaceDeLaFiche)[^,\n]*estCompteFormation/.test(srcPartages));

// ──────────────────────────────────────────────────────────────
titre("⑬ UN REPLI MUET RESSEMBLE À UNE PANNE (Timo, 19/09/2026)");
// « Quand je clique sur relancer, ça ouvre le WhatsApp sur l'ordinateur » —
// le repli marchait, mais le motif était CALCULÉ PUIS JETÉ : impossible de
// savoir si c'était voulu ou si quelque chose n'allait pas.
test("★ formation et premier contact sont ATTENDUS : aucune fenêtre",
  M.motifAttendu(M.MOTIF_FORMATION) && M.motifAttendu(M.MOTIF_PREMIER_CONTACT));
test("★ un serveur pas configuré SE DIT", !M.motifAttendu(M.MOTIF_ECHEC[500]));
test("★ une session expirée aussi", !M.motifAttendu(M.MOTIF_ECHEC[401]));
// ⚠⚠ 25/09/2026 (capture Timo, 📋 Clients → WhatsApp : « Votre session a
// expiré. Reconnectez-vous ») : le jeton partait tel quel, périmé après une
// veille. Il se renouvelle AVANT l'appel et une fois de plus sur un 401 ;
// sinon la fenêtre de verrou redemande le mot de passe. Jamais « reconnectez-vous ».
{
  const cli = lire("src/supabaseClient.js");
  // ⚠ RETOURNÉ le 20/10/2026 : le renouvellement vit dans LA porte commune
  // `reponseAvecJeton`, qu'`appelAvecJeton` ET `mediaWaEnLigne` empruntent.
  const i = cli.indexOf("async function reponseAvecJeton");
  const corpsAppel = cli.slice(i, cli.indexOf("export const abonnerPushEnLigne", i));
  test("★ session : le jeton est RENOUVELÉ avant l'appel (assurerSession avant le premier envoi)",
    corpsAppel.indexOf("assurerSession()") > -1 && corpsAppel.indexOf("assurerSession()") < corpsAppel.indexOf("let reponse = await envoyer()"));
  test("★ session : un 401 déclenche un rafraîchissement et UN second essai",
    /reponse\.status === 401\)\s*\{[\s\S]*?refreshSession\(\)[\s\S]*?reponse = await envoyer\(\)/.test(corpsAppel));
  test("★ session : un second 401 ouvre la fenêtre de verrou (marquerSessionPerdue)",
    /marquerSessionPerdue\(/.test(corpsAppel));
  test("★ le motif 401 ne dit JAMAIS « reconnectez-vous » (règle du 09/09/2026)",
    !/reconnect/i.test(M.MOTIF_ECHEC[401]) && /mot de passe/.test(M.MOTIF_ECHEC[401]));
  test("★ le parrainage renouvelle aussi la session et ne dit plus « reconnectez-vous »",
    /creerFilleulEnLigne[\s\S]*?assurerSession\(\)[\s\S]*?getSession/.test(cli)
    && !/pour parrainer\." \}/.test(cli.slice(cli.indexOf("creerFilleulEnLigne"), cli.indexOf("URL_ETAT_AUTH"))));
}
test("★ un refus de WhatsApp aussi (motif rendu tel quel)", !M.motifAttendu("Template not approved"));
test("un motif vide n'est pas « attendu » par défaut", !M.motifAttendu("") && !M.motifAttendu(null));
test("★ le message de repli DIT ce qui s'est passé à la place",
  /WhatsApp s'ouvre avec le texte complet/.test(M.messageRepli("peu importe"))
  && M.messageRepli("PANNE X").includes("PANNE X"));
// ⚠ RETOURNÉ le 29/09/2026 (capture Timo : « pourquoi elle vient après que le
// message soit déjà passé ? ») : le motif se dit AVANT l'ouverture de
// WhatsApp, par `prevenir`, jamais après. Les écrans ne l'affichent plus
// après coup ; `envoyerModele` l'ATTEND avant d'ouvrir.
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const wa = sansComm(lire("src/whatsapp.js"));
  const corpsRepli = (wa.match(/const repli = async \(motif, reseau = false\) => \{[\s\S]*?\n  \};/) || [""])[0];
  test("★★ le motif d'un repli se dit AVANT l'ouverture de WhatsApp (attendu, puis ouverture), et jamais pour un motif attendu",
    corpsRepli.length > 0
    && /messageRepli\(motif, annonceRepli\)/.test(corpsRepli) && /!motifAttendu\(motif\)/.test(corpsRepli)
    && /ouvrirWhatsAppApresAnnonce\(\{ tel, texte: texteRepli, annonce: texteAnnonce, prevenir, demanderConfirmation \}\)/.test(corpsRepli));
  const ecrans = ["src/screens/TousLesDevis.jsx", "src/screens/dimensionnement/Partages.jsx", "src/screens/Utilisateurs.jsx", "src/screens/Clients.jsx", "src/screens/Dettes.jsx", "src/screens/Whatsapp.jsx", "src/screens/Prospects.jsx", "src/screens/ClientsInstalles.jsx"];
  // Appel par appel : tout envoi qui PEUT ouvrir WhatsApp (pas `sansRepli`)
  // doit porter `prevenir: uAlert` — un seul oublié suffit à faire tomber.
  const appelsSansPrevenir = (code) => (code.match(/envoyer(?:Modele|IdentifiantsDuNumeroBmi)\(\{[\s\S]*?\}\);/g) || [])
    .filter((a) => !/sansRepli: true/.test(a) && !/prevenir: uAlert/.test(a));
  const fautifs = ecrans.filter((f) => { const c = sansComm(lire(f)); return /uAlert\(messageRepli\(r\.motif\)\)/.test(c) || appelsSansPrevenir(c).length > 0; });
  test("★★ les huit écrans qui envoient par le numéro BMI passent `prevenir: uAlert` et n'affichent plus le motif APRÈS", fautifs.length === 0);
  if (fautifs.length) console.log("     fautifs :", fautifs.join(", "));
  test("★ la phrase dit ce qui VA se passer (« Appuyez sur OK »), jamais « s'est ouvert »",
    /Appuyez sur OK : WhatsApp s'ouvre avec le texte complet/.test(M.messageRepli("x")) && !/s'est ouvert/.test(M.messageRepli("x")));
  test("★ les identifiants : un motif déjà dit avant n'est pas répété après",
    M.messageIdentifiants("x", { auto: false, motif: "Pas de connexion.", annonce: true }) === "");
}

titre("⑭ L'ÉCRAN NE DÉCRIT JAMAIS AUTRE CHOSE QUE CE QUI VIENT DE SE PASSER");
test("★ parti du numéro BMI → on ne promet pas que WhatsApp s'ouvre",
  !/WhatsApp s'ouvre/.test(M.messageDevisEnvoye("AMA", true)) && /numéro BMI/.test(M.messageDevisEnvoye("AMA", true)));
// ⚠ RETOURNÉ le 29/09/2026 : envoi à la main → TOUT est dit AVANT
// l'ouverture (`annonceRepli`) ; après coup, la phrase ne parle plus
// d'ouverture, et elle ne s'affiche que si le message est parti du numéro BMI.
test("★ envoi à la main → la phrase d'après ne parle plus d'ouverture",
  !/WhatsApp/.test(M.messageDevisEnvoye("AMA", false)) && M.messageDevisEnvoye("AMA", false).includes("AMA"));
test("les deux nomment le client", ["AMA"].every((n) => M.messageDevisEnvoye(n, true).includes(n) && M.messageDevisEnvoye(n, false).includes(n)));
test("★ les DEUX endroits qui envoient un devis passent par cette phrase — aucune copie — et seulement si parti du numéro BMI",
  /if \(envoye\.auto && m\) uAlert\(m\)/.test(srcPartages) && /messageDevisEnvoye\(compte\.nom, envoye\.auto, envoye\)/.test(srcPartages) /* RETOURNÉ le 17/10/2026 : la phrase dit aussi ce qu'est devenu le PDF */
  && /if \(envoye && envoye\.auto\) uAlert\(messageDevisEnvoye\(compte\.nom, true\)\)/.test(lire("src/screens/dimensionnement/Brouillons.jsx"))
  // La seule phrase « WhatsApp s'ouvre avec ses identifiants » est l'ANNONCE, dite avant (« Appuyez sur OK »).
  && /Appuyez sur OK : WhatsApp s'ouvre avec ses identifiants et le lien/.test(srcPartages)
  && !/WhatsApp s'ouvre avec ses identifiants/.test(lire("src/screens/dimensionnement/Brouillons.jsx")));
test("★ l'envoi rend CE QUI S'EST PASSÉ, pas un simple oui (RETOURNÉ le 17/10/2026 : et ce qu'est devenu le PDF)", /return \{ ok: true, auto: !!r\.auto, pdfDemande: !!avecPdf, pdf: !!pdf\.r, motifPdf: pdf\.motif, pdfIncertain: !!pdf\.incertain \};/.test(srcPartages));

// ──────────────────────────────────────────────────────────────
titre("⑮ LE REFUS DE WHATSAPP SE DIT EN FRANÇAIS (Timo, 20/09/2026)");
// Meta refuse EN ANGLAIS, et tel quel. « The template is unavailable,
// status: PENDING » n'apprend rien à une vendeuse de Lomé — et un message
// qu'on ne comprend pas ressemble à une panne.
test("★★ le motif qu'il a VU se dit en français",
  M.motifEchecWhatsApp({ statut: 502, erreur: "The template is unavailable, status: PENDING" })
    === "Ce modèle de message n'est pas encore approuvé par WhatsApp. Il faut attendre la réponse de Meta.");
test("★ un CODE de Meta se traduit sans lire la phrase",
  /commerciaux/.test(M.motifEchecWhatsApp({ statut: 502, erreur: "User is not eligible", code: 131050 })));
test("★ le code PRIME sur les mots (Meta peut réécrire ses phrases)",
  M.traduireMotifWhatsApp("template is unavailable", 131050) === M.traduireMotifWhatsApp("", 131050));
test("★ un code en texte (« 132001 ») marche aussi", /pas en français/.test(M.traduireMotifWhatsApp("", "132001")));
test("★ le crédit YCloud épuisé dit OÙ recharger",
  /Recharge/.test(M.motifEchecWhatsApp({ statut: 502, erreur: "Insufficient balance in wallet" })));

// ⚠⚠ LE POINT LE PLUS IMPORTANT : ce qu'on ne connaît pas reste ENTIER.
const inconnu = "Totally new refusal nobody has ever seen";
const renduInconnu = M.motifEchecWhatsApp({ statut: 502, erreur: inconnu });
test("★★ un motif INCONNU n'est jamais deviné : la phrase d'origine reste, entière",
  renduInconnu.includes(inconnu) && renduInconnu.startsWith(M.PREFIXE_REFUS_WHATSAPP));
test("★★ et le préfixe ne ment pas : une panne de CHEZ NOUS n'est pas un refus de WhatsApp",
  M.motifEchecWhatsApp({ erreur: "Serveur injoignable : failed to fetch" }) === "Serveur injoignable : failed to fetch");
test("★ un refus sans phrase ni code ne reste pas muet",
  M.motifEchecWhatsApp({ statut: 502 }) === "L'envoi automatique n'a pas abouti.");

// ⚠ Une règle à mots exige TOUS ses mots : « template » seul attraperait
// n'importe quel refus parlant d'un modèle, et on traduirait de travers.
test("★★ un seul mot ne suffit jamais à reconnaître un motif",
  M.traduireMotifWhatsApp("the template was sent", 0) === "");
test("★ « Template not found » de YCloud (sans code, 28/09/2026) se dit en français",
  /n'existe pas sur le compte WhatsApp de BMI/.test(M.traduireMotifWhatsApp("Template not found. WABA: 2016129029105220, name: mot_fidelite, language: fr", 0)));
test("★ le refus d'un numéro chinois (+86, capture du 30/09/2026) se dit en français",
  /Chine continentale/.test(M.motifEchecWhatsApp({ statut: 502, erreur: "Sending WhatsApp messages to Mainland China (+86) recipients is not supported." })));
test("majuscules et accents ne gênent pas", M.traduireMotifWhatsApp("INSUFFICIENT BALANCE", 0) !== "");
test("★ les mots-repères sont écrits en minuscules sans accent (sinon ils ne trouveraient JAMAIS rien)",
  M.MOTIFS_WHATSAPP.every((r) => (r.marques || []).every((m) => m === M.normaliseMotif(m))));
test("★ chaque règle a soit un code, soit des mots", M.MOTIFS_WHATSAPP.every((r) => r.code || (r.marques || []).length));
test("★ aucune phrase ne promet « livré » ni « lu » (on ne le sait pas)",
  M.MOTIFS_WHATSAPP.every((r) => !/\blivré|\blu\b/i.test(r.dit)));
test("★ un motif traduit n'est jamais « attendu » : il DOIT s'afficher",
  !M.motifAttendu(M.motifEchecWhatsApp({ statut: 502, erreur: "The template is unavailable" })));
test("nos propres statuts n'ont pas bougé",
  M.motifEchecWhatsApp({ statut: 500 }) === M.MOTIF_ECHEC[500] && M.motifEchecWhatsApp({ statut: 401 }) === M.MOTIF_ECHEC[401]);

// ⚠⚠ LA CHAÎNE : le code de Meta traverse TROIS fichiers. S'il est jeté en
// route, la traduction retombe sur les mots et personne ne le voit.
// ⚠ RETOURNÉ le 24/09/2026 : le code est LU par la porte commune (_ycloud.js)
// et RENDU tel quel par api/whatsapp.js — deux maillons, les deux mesurés.
test("★★ le serveur rend le code de refus de WhatsApp",
  /code_whatsapp: code/.test(lire("api/_ycloud.js")) && /code_whatsapp: resultat\.code_whatsapp/.test(apiWhatsapp));
test("★★ le transport ne le jette pas en route",
  /if \(!reponse\.ok\) return \{ \.\.\.resultat,/.test(lire("src/supabaseClient.js")));
test("★★ le seul chemin le passe à la règle", /code: reponse\?\.code_whatsapp/.test(srcWhatsapp));
test("★ la phrase anglaise part dans la CONSOLE, jamais à l'écran",
  /console\.info\("\[whatsapp\] refus :"/.test(srcWhatsapp)
  && !/uAlert\([^)]*reponse\.error/.test(srcWhatsapp));


// ──────────────────────────────────────────────────────────────
titre("⑨ ÉTAPE 2 — LES RÉPONSES DU CLIENT DANS 💬 MESSAGES (20/09/2026)");
// Les trois décisions de Timo : (1) voient TOUT = « tous les salariés à
// BMI » ; (2) un client qui écrit le premier → support, visible par tout
// le personnel ; (3) l'administrateur réattribue.
const C = await import("../src/lib/whatsappConversations.js");
const entrant = lire("api/whatsapp-entrant.js");
const messagerie = lire("src/screens/Messagerie.jsx");
// ⚠ 20/09/2026, décision « b » de Timo : les conversations WhatsApp ont
// QUITTÉ 💬 Messages pour leur propre écran. Les contrôles ci-dessous ne
// sont pas assouplis — ils sont RETOURNÉS vers le fichier qui commande.
const ecranWa = lire("src/screens/Whatsapp.jsx");

const filDe = (heures) => [{ ts: new Date(Date.now() - heures * 3600e3).toISOString(), wa_entrant: true, texte: "bonjour" }];

test("★★ la fenêtre de 24 h s'ouvre sur le dernier message DU CLIENT, et se ferme après",
  C.fenetre(filDe(1)).ouverte === true
  && C.fenetre(filDe(23.5)).ouverte === true
  && C.fenetre(filDe(25)).ouverte === false
  && C.fenetre([]).jamais === true);
test("★★ NOTRE propre réponse ne prolonge PAS la fenêtre — seul le client la rouvre",
  C.fenetre([...filDe(25), { ts: new Date().toISOString(), texte: "on vous répond" }]).ouverte === false);
test("★ la phrase de la fenêtre est écrite UNE fois, et dit ce qu'il reste",
  /Il reste 2 h 00/.test(C.libelleFenetre(C.fenetre(filDe(22))))
  && /plus qu'un modèle approuvé/.test(C.libelleFenetre(C.fenetre(filDe(30))))
  && (ecranWa.match(/libelleFenetre\(/g) || []).length >= 1);

// ── QUI VOIT QUOI
const conv = (p) => ({ proprietaire_id: p });
// ⚠ CONTRÔLE RETOURNÉ DEUX FOIS, JAMAIS ASSOUPLI. Le 20/09 au matin il
// exigeait que le COMPTABLE voie tout (« tous les salariés ») ; Timo l'en a
// retiré le soir (« 2a »). Le 21/09, devant ANGELE écrivant dans une
// conversation confiée à TIMO1, il a retiré TOUS LES AUTRES : « assigned_to
// = TIMO1 → visible à TIMO1 + admin ». Il ne reste que l'administrateur.
test("★★ décision du 21/09 : SEUL l'administrateur voit une conversation confiée à quelqu'un d'autre",
  C.peutVoirConversation({ id: "x", role: "admin" }, conv("autre")) === true
  && ["vendeur", "gerant", "magasinier", "technicien_bmi", "resp_commercial", "commercial", "technicien"]
    .every((role) => C.peutVoirConversation({ id: "x", role }, conv("autre")) === false)
  && C.ROLES_TOUTES_CONVERSATIONS.join(",") === "admin");
test("★★ …et le propriétaire, lui, garde la sienne",
  ["vendeur", "gerant", "commercial", "technicien"]
    .every((role) => C.peutVoirConversation({ id: "moi", role }, conv("moi")) === true));
test("★★ décision 1 (l'autre moitié) : un COMMERCIAL et un TECHNICIEN À COMMISSION ne voient QUE ce qu'ils ont engagé",
  ["commercial", "technicien"].every((role) =>
    C.peutVoirConversation({ id: "moi", role }, conv("moi")) === true
    && C.peutVoirConversation({ id: "moi", role }, conv("autre")) === false));
test("★★ décision 2 « c » : une conversation que PERSONNE n'a engagée est du support — tout le personnel la voit",
  ["commercial", "technicien", "vendeur"].every((role) => C.peutVoirConversation({ id: "moi", role }, conv(""))));
test("★★ un CLIENT ne voit jamais une conversation WhatsApp : c'est la sienne, elle est sur son téléphone",
  C.peutVoirConversation({ id: "c1", role: "client" }, conv("")) === false
  && C.peutVoirConversation({ id: "c1", role: "client" }, conv("c1")) === false);
test("★★ décision 3 « a » : seul l'ADMINISTRATEUR confie une conversation à quelqu'un d'autre",
  C.peutReattribuer({ role: "admin" }) === true
  && ["gerant", "resp_commercial", "commercial", "vendeur"].every((role) => !C.peutReattribuer({ role })));

// ── LA LISTE, FILTRÉE
const msgs = [
  { canal: "whatsapp", wa_tel: "90112233", wa_entrant: true, ts: "2026-09-20T10:00:00Z", texte: "a", proprietaire_id: "u1", proprietaire_nom: "KOSSI" },
  { canal: "whatsapp", wa_tel: "90445566", wa_entrant: true, ts: "2026-09-20T11:00:00Z", texte: "b" },
  { canal: "support", client_id: "c9", ts: "2026-09-20T12:00:00Z", texte: "pas whatsapp" },
];
test("★★ le commercial ne reçoit QUE la sienne et le support — jamais celle d'un collègue",
  C.conversationsWa(msgs, { id: "u2", role: "commercial" }).map((c) => c.cle).join(",") === "90445566"
  && C.conversationsWa(msgs, { id: "u1", role: "commercial" }).map((c) => c.cle).sort().join(",") === "90112233,90445566");
// ⚠ RETOURNÉ LE 21/09/2026 : le gérant voyait les DEUX (règle du 20/09).
// Sans fiche légère il ne voit plus que le support — une conversation qu'on
// ne connaît pas ne se devine pas.
test("★★ un gérant ne voit plus la conversation d'un collègue, et sans fiche il n'en sait rien",
  C.conversationsWa(msgs, { id: "u9", role: "gerant" }).map((c) => c.cle).join(",") === "90445566");
test("★ une conversation est rangée sous le NUMÉRO, pas sous un compte (un prospect n'en a pas)",
  C.cleConversation("+228 90 11 22 33") === "90112233" && C.cleConversation("90112233") === "90112233" && C.cleConversation("") === "");

// ── LE REFUS, REVÉRIFIÉ DANS LE GESTE
const convOuverte = { proprietaire_id: "u1", fil: filDe(1), fenetre: C.fenetre(filDe(1)), tel: "90112233" };
const convFermee = { proprietaire_id: "u1", fil: filDe(30), fenetre: C.fenetre(filDe(30)), tel: "90112233" };
test("★★ une réponse hors fenêtre est REFUSÉE, et le refus DIT pourquoi",
  /plus qu'un modèle approuvé/.test(C.critiqueReponse({ profile: { id: "u1", role: "commercial" }, conv: convFermee, texte: "salut" }))
  && C.critiqueReponse({ profile: { id: "u1", role: "commercial" }, conv: convOuverte, texte: "salut" }) === ""
  && /Seule cette personne, ou un administrateur/.test(C.critiqueReponse({ profile: { id: "u2", role: "commercial" }, conv: { ...convOuverte, proprietaire_nom: "KOSSI" }, texte: "salut" }))
  && /connexion/.test(C.critiqueReponse({ profile: { id: "u1", role: "commercial" }, conv: convOuverte, texte: "salut", enLigne: false })));

// ── LE SERVEUR : TROIS BARRIÈRES QUI NE SE CROIENT PAS SUR PAROLE
test("★★ l'adresse d'arrivée n'accepte QUE les appels qui portent le secret",
  /WHATSAPP_WEBHOOK_SECRET/.test(entrant) && /donne !== attendu\) return res\.status\(401\)/.test(entrant));
test("★★ le secret n'est JAMAIS préfixé VITE_ (Vite l'embarquerait chez tout le monde)",
  !/VITE_WHATSAPP_WEBHOOK_SECRET/.test(entrant) && !/VITE_YCLOUD/.test(lire("api/whatsapp.js")));
test("★★ le serveur RECALCULE la fenêtre sur la base avant d'envoyer une réponse libre",
  /if \(reponseLibre\) \{[\s\S]{0,600}fenetre\(fil\)/.test(lire("api/whatsapp.js"))
  && /return res\.status\(403\)\.json\(\{ error: libelleFenetre\(f\) \}\)/.test(lire("api/whatsapp.js")));
// RETOURNÉ le 18/10/2026 : la garde vit dans LA règle `doublonEntrant`
// (identifiant YCloud, wamid, ou même texte à la même seconde) — section 58.
test("★ le même message reçu deux fois ne s'écrit qu'une fois (YCloud réessaie)",
  /if \(doublonEntrant\(messages, \{[^}]*\}\)\) return res\.status\(200\)\.json\(\{ deja: true \}\)/.test(entrant));
test("★★ un paquet illisible répond 200 et DIT ce qu'il n'a pas su lire (sinon YCloud le renvoie sans fin)",
  /status\(200\)\.json\(\{ ignore: true/.test(entrant) && /pourquoi: "numéro illisible"/.test(entrant));
test("★ `updated_at` est posé sur la ligne : sans lui le message n'arriverait jamais sur les téléphones",
  /updated_at: ligne\.ts/.test(entrant));
// ⚠⚠ LE DÉFAUT DU 20/09/2026, ET POURQUOI LE BANC NE L'AVAIT PAS VU. Le
// contrôle d'ici vérifiait que le serveur LISAIT `envoi_whatsapp.par_id` —
// il le lisait bien. Personne ne l'ÉCRIVAIT. Un contrôle qui ne regarde
// qu'un bout d'un couple rassure sans protéger : on exerce maintenant la
// règle POUR DE VRAI, sur les deux bouts.
test("★★ la trace d'un envoi porte l'identifiant de l'envoyeur, pas seulement son nom",
  M.traceEnvoi({ modele: "relance_devis", par: "KOSSI", par_id: "u7", quand: "2026-09-20", heure: "18:08", id: "wamid" }).par_id === "u7");
test("★★ les DEUX écrans qui envoient du numéro BMI le passent (sinon la trace ne sert à rien)",
  /traceEnvoi\(\{ modele: envoi\.modele, par: profile\.nom, par_id: profile\.id,/.test(lire("src/screens/TousLesDevis.jsx"))
  && /traceEnvoi\(\{ modele: envoi\.modele, par: profile\.nom, par_id: profile\.id,/.test(lire("src/screens/dimensionnement/Partages.jsx")));
const EMPLOYES = [
  { id: "u7", nom: "KOSSI", role: "commercial" },
  { id: "u8", nom: "AMA", role: "vendeur" },
  { id: "u9", nom: "AMA", role: "gerant" },
];
const devisDe = (traces) => ({ devis: traces.map((t, i) => ({ id: `d${i}`, envoi_whatsapp: t })) });
test("★★ le propriétaire vient du DERNIER devis parti du numéro BMI — la trace de l'étape 1, pas une invention",
  C.proprietaireDepuisDevis(devisDe([
    { le: "2026-09-11", par: "AMA", par_id: "u8" },
    { le: "2026-09-20", par: "KOSSI", par_id: "u7" },
  ]), EMPLOYES).id === "u7");
test("★★ un devis parti AVANT le correctif (le nom seul) retrouve quand même son envoyeur",
  C.proprietaireDepuisDevis(devisDe([{ le: "2026-09-20", par: "KOSSI" }]), EMPLOYES).id === "u7");
test("★★ mais deux employés du même nom ne se devinent PAS : au support, jamais au mauvais",
  C.proprietaireDepuisDevis(devisDe([{ le: "2026-09-20", par: "AMA" }]), EMPLOYES).id === "");
test("★ un client sans aucun devis parti du numéro BMI va au support",
  C.proprietaireDepuisDevis({ devis: [{ id: "d1" }] }, EMPLOYES).id === ""
  && C.proprietaireDepuisDevis(null, EMPLOYES).id === "");
test("★★ le serveur ne recopie pas la règle : il l'IMPORTE (deux copies finissent par diverger)",
  /proprietaireDepuisDevis/.test(entrant) && /proprietaire = proprietaireDepuisDevis\(client, employes\)/.test(entrant)
  && !/envoi_whatsapp\.par_id/.test(entrant));
test("★ l'arrivée d'un message PRÉVIENT son propriétaire (le save de l'application ne le voit jamais passer)",
  /envoyerAuxPersonnes\(admin, \[\{/.test(entrant) && /ecran: "whatsapp"/.test(entrant));

// ── L'ÉCRAN
test("★★ l'écran passe par LE seul chemin (src/whatsapp.js), jamais par le serveur lui-même",
  /from "\.\.\/whatsapp"/.test(ecranWa) && !/supabaseClient/.test(ecranWa));
test("★★ RIEN n'est écrit dans la base tant que le message n'est pas PARTI (un fil qui ment est pire qu'un fil vide)",
  // ⚠ RETOURNÉ le 03/10/2026 (📎 le fichier) : la ligne porte désormais le
  // nom du fichier, le corps s'est allongé — la règle n'a pas bougé : save()
  // vient APRÈS le refus, et rien ne s'écrit avant.
  /if \(!r\.parti\) \{ uAlert\(r\.motif[\s\S]{0,40}return; \}[\s\S]{0,1000}save\(/.test(ecranWa)
  && ecranWa.indexOf("save(", ecranWa.indexOf("const envoyer = async")) > ecranWa.indexOf("if (!r.parti)", ecranWa.indexOf("const envoyer = async")));
// ⚠ AFFÛTÉ, PAS ASSOUPLI (20/09/2026) : il lisait le FICHIER entier, ce qui
// marchait tant que personne d'autre ne posait un propriétaire. Depuis qu'on
// peut écrire le PREMIER à un client, l'auteur de ce message-là devient
// légitimement le propriétaire. La règle protégée n'a pas bougé — « RÉPONDRE
// ne s'approprie pas » —, alors on découpe le corps de la réponse et on ne
// regarde QUE lui.
const corpsReponse = ecranWa.slice(ecranWa.indexOf("const envoyer = async"), ecranWa.indexOf("const envoyerContact = async"));
test("★★ répondre ne s'approprie PAS une conversation : seul « 🔁 Confier » change le propriétaire",
  /peutReattribuer\(profile\)/.test(ecranWa)
  && /proprietaire_id: u\.id, proprietaire_nom: u\.nom/.test(ecranWa)
  && corpsReponse.length > 200
  && !/proprietaire_id: profile\.id/.test(corpsReponse));

// ── ✍️ ÉCRIRE LE PREMIER (20/09/2026)
test("★★ un modèle qui ne parle d'AUCUN devis existe — sans lui on ne peut pas écrire à qui n'en a pas",
  M.MODELES.prise_de_contact.variables.join(",") === "client,auteur,sujet"
  && M.MODELES_EN_SERVICE.includes("prise_de_contact"));
test("★★ le texte de repli est MOT POUR MOT celui du modèle (le client reçoit la même chose des deux côtés)",
  M.texteContact({ client: "ESSO", auteur: "TIMO", sujet: "votre pompe" })
    === "Bonjour ESSO, c'est TIMO de BMI Togo.\nNous revenons vers vous concernant votre pompe.\nRépondez simplement à ce message et nous poursuivrons notre échange ici.\nMerci et à bientôt. BMI Togo");
test("★★ « {{2}} » est le NOM DE L'UTILISATEUR qui écrit, jamais la boutique (sa précision, 20/09/2026)",
  /variables: \[nom \|\| client\?\.nom \|\| "cher client", profile\.nom, sujet\]/.test(ecranWa));
test("★★ écrire le premier DONNE la conversation à son auteur — c'est là que « dans l'espace du personnel qui a écrit » se joue",
  /proprietaire_id: profile\.id, proprietaire_nom: profile\.nom/.test(ecranWa));
test("★★ rien n'est écrit dans le fil si le message n'est PAS parti du numéro BMI (une ouverture WhatsApp part d'un autre numéro)",
  /if \(!r\.auto\) \{[\s\S]{0,400}return;\n {4}\}/.test(ecranWa));
test("★★ le MUR : l'espace du DESTINATAIRE décide quand on le connaît, jamais celui de qui clique",
  /espaceFormation: client \? estCompteFormation\(db, client\) : espaceDuCompte\(db, profile\)/.test(ecranWa));
// ⚠ On retire les COMMENTAIRES avant de chercher : ce contrôle a crié à tort
// sur la phrase « Jamais `db.users` en entier » écrite juste au-dessus de la
// bonne ligne. Un contrôle qui lit du français au lieu du code se trompe.
const codeWa = ecranWa.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
// ⚠ DÉFAUT DU 20/09/2026 : fenêtre fermée, l'écran envoyait le vendeur vers
// 📋 Tous les devis — où un client SANS devis n'est pas. Un écran qui donne
// une issue qui n'existe pas est pire qu'un écran muet.
test("★★ fenêtre fermée : l'écran donne une issue qui MARCHE (écrire un modèle depuis ici), pas seulement un renvoi ailleurs",
  /Lui écrire quand même/.test(ecranWa)
  && /setContact\(\{ nom: ouverte\.nom \|\| \(ouverte\.origineNom \? ouverte\.nomAffiche : ""\), tel: ouverte\.tel \|\| "", sujet: "" \}\); setCleOuverte\(null\);/.test(ecranWa));
test("★ les personnes proposées passent par le filtre d'espace, jamais db.users en entier",
  /utilisateursDeLEspace\(db, profile\)/.test(codeWa) && !/db\.users/.test(codeWa));
test("★ la case de saisie se ferme avec la fenêtre, et dit par où relancer",
  /!ouverte\.fenetre\.ouverte \?/.test(ecranWa) && /Tous les devis/.test(ecranWa));

// ── 🔍 CHERCHER ET ARCHIVER DANS 📲 WHATSAPP (20/09/2026, « lance les 3 »)
const Arch = await import("../src/lib/archivage.js");
const Conv = await import("../src/lib/conversations.js");
// ⚠ RETOURNÉ le 07/10/2026 : il EXIGEAIT `motsDuNumero(c.tel).join(" ")` —
// la forme fautive (motsDuNumero rend déjà un texte : écran blanc à la
// première lettre tapée). Il exige maintenant le texte tel quel, et ㊿ REND
// l'écran avec une recherche tapée.
test("★★ la recherche passe par LA règle commune et cherche le NOM (donné, compte, WhatsApp) comme le NUMÉRO",
  /correspond\(`\$\{c\.nomAffiche \|\| ""\} \$\{c\.nom \|\| ""\} \$\{c\.profil \|\| ""\} \$\{motsDuNumero\(c\.tel\)\}`, recherche\)/.test(ecranWa)
  && !/motsDuNumero\([^)]*\)\.join/.test(ecranWa)
  && !/toLowerCase\(\)\.includes/.test(ecranWa));
test("★★ elle cherche dans TOUTES les conversations, archives comprises — une recherche qui ne voit que l'affiché ment",
  /const convs = !recherche\.trim\(\) \? tousConvs\n/.test(ecranWa)
  && /: tousConvs\.filter\(/.test(ecranWa));
test("★ la ligne de recherche passe par la règle commune des largeurs",
  /className=\{champRecherche\}/.test(ecranWa));
test("★★ l'archivage passe par LE composant commun (la règle de Timo), jamais un slice maison",
  /<HistoriqueArchive/.test(ecranWa) && !/\.slice\(0, ?\d+\)/.test(codeWa));

// ⚠⚠ LE POINT LE PLUS IMPORTANT, ET IL S'EXERCE : un client qui ATTEND une
// réponse ne doit jamais tomber dans les archives, même après trois mois de
// silence de NOTRE côté. L'écran compose `separerNonLues` PUIS l'archivage
// sur ce qui reste : on rejoue exactement cette composition.
const vieux = "2026-01-05T09:00:00.000Z";
const itemsTest = [
  { cle: "vieux-non-lu", conv: { type: "wa", id: "vieux-non-lu" } },
  ...Array.from({ length: 25 }, (_, i) => ({ cle: `r${i}`, conv: { type: "wa", id: `r${i}` } })),
  { cle: "vieux-lu", conv: { type: "wa", id: "vieux-lu" } },
];
const activiteTest = (conv) => (String(conv.id).startsWith("vieux") ? vieux : `2026-09-${String(10 + (Number(String(conv.id).slice(1)) % 10)).padStart(2, "0")}T09:00:00.000Z`);
const sep = Conv.separerNonLues(
  [{ cle: "whatsapp", items: itemsTest }],
  (conv) => (conv.id === "vieux-non-lu" ? 2 : 0),
  activiteTest
);
const archTest = Arch.separerArchives(sep.sections[0].items, { aujourdhui: "2026-09-20", dateDe: (it) => activiteTest(it.conv) });
test("★★ une conversation NON LUE n'est JAMAIS archivée, même vieille de 8 mois (le client attend)",
  sep.nonLues.some((it) => it.cle === "vieux-non-lu")
  && !archTest.archives.some((it) => it.cle === "vieux-non-lu")
  && !archTest.visibles.some((it) => it.cle === "vieux-non-lu"));
test("★ une conversation LUE et sans activité depuis 3 mois passe bien aux archives, au-delà des 20 récentes",
  archTest.archives.some((it) => it.cle === "vieux-lu"));
test("★★ et l'ÉCRAN ne donne QUE les lues à l'archivage — la règle juste ne suffit pas si l'écran s'en sert mal",
  /lignes=\{lues\}/.test(ecranWa) && !/lignes=\{\[\.\.\.liste\.nonLues/.test(ecranWa));

// ── LA SÉPARATION (décision « b » de Timo, 20/09/2026)
const calculs = lire("src/lib/calculs.js");
const app = lire("src/App.jsx");
test("★★ 💬 Messages ne porte plus AUCUNE conversation WhatsApp (sinon on aurait séparé d'un côté et remélangé de l'autre)",
  !/CANAL_WA|conversationsWa|convWaOuverte|whatsappConversations/.test(messagerie));
test("★★ l'onglet 📲 WhatsApp existe, et JAMAIS pour un compte client (c'est LUI qui est au bout du fil)",
  /whatsapp: "📲 WhatsApp"/.test(calculs)
  && /client: \[[^\]]*\]/.test(calculs) && !/client: \[[^\]]*"whatsapp"/.test(calculs));
test("★★ le compteur de l'onglet compte les non lus WhatsApp — sans lui, une fenêtre de 24 h se fermerait derrière un onglet qu'on ne regarde pas",
  /compterNonLusWa\(db, profile\)/.test(app) && /labelWhatsapp = `📲 WhatsApp\$\{nonLusWa/.test(app)
  && /\["whatsapp", labelWhatsapp\]/.test(app));
test("★ le classement « nouveaux messages d'abord » passe par LA règle commune, pas par un tri maison",
  /separerNonLues\(/.test(ecranWa) && !/\.sort\(\(a, b\) => b\./.test(ecranWa));

// ──────────────────────────────────────────────────────────────
titre("⑨ LE COMPTABLE EST SORTI, ET LA BASE FERME LA PORTE (20/09/2026, « 1a » et « 2a »)");
// ⚠ Timo, le 20/09/2026 au soir, devant les trois avertissements que je lui
// avais écrits le matin : « 1a, 2a, 3a ». Trois décisions, trois familles de
// contrôles ci-dessous.
const sql27 = lire("supabase/securite-27-conversations-whatsapp.sql");
// ⚠ LE COUPLE REGARDE MAINTENANT `securite-28` (21/09/2026) : il REPREND le
// -27 en entier et n'en change que la politique. Le -27 reste lu pour une
// seule chose — vérifier que le -28 le contient bien.
const sql28 = lire("supabase/securite-28-conversations-confiees.sql");
const apiMedia = lire("api/whatsapp-media.js");

// ── « 2a » : LE COMPTABLE N'A PLUS WHATSAPP DU TOUT
test("★★ le comptable ne voit plus AUCUNE conversation — pas même le support",
  C.aAccesWhatsapp({ role: "comptable" }) === false
  && C.peutVoirConversation({ id: "cpt", role: "comptable" }, conv("")) === false
  && C.peutVoirConversation({ id: "cpt", role: "comptable" }, conv("cpt")) === false
  && C.voitToutesLesConversations({ role: "comptable" }) === false);
test("★ …et il garde 💬 Messages : c'est 📲 WhatsApp qu'il perd, pas la messagerie",
  /comptable: \[[^\]]*"messages"/.test(calculs) && !/comptable: \[[^\]]*"whatsapp"/.test(calculs));
// ⚠ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER : la phrase française qui
// EXPLIQUE la règle contient les mots de la faute. Un contrôle qui lit du
// français au lieu du code se trompe — leçon déjà payée le 20/09 au matin.
const codeRegle = lire("src/lib/whatsappConversations.js")
  .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
test("★ la liste ne se DÉDUIT plus de SALARIES (une liste de paie ne dit pas qui lit les clients)",
  !/SALARIES/.test(codeRegle) && /ROLES_TOUTES_CONVERSATIONS = \[/.test(codeRegle));
test("★ un commercial et un technicien à commission, eux, gardent l'accès",
  C.aAccesWhatsapp({ role: "commercial" }) && C.aAccesWhatsapp({ role: "technicien" })
  && C.aAccesWhatsapp({ role: "client" }) === false);

// ── « 1a » : LE COUPLE APPLICATION / BASE
// ⚠ L'application filtre ce qui s'AFFICHE, la base filtre ce qui DESCEND.
// Si les deux divergent, un employé lit un écran vide sans comprendre — ou
// pire, la conversation redescend sur son téléphone alors qu'on croit
// l'avoir fermée. Le banc compare les deux côtés, comme pour `ROLES_TACHES`.
const rolesSql = (sql28.match(/public\.wa_role\(\) in \(([^)]*)\)/) || ["", ""])[1]
  .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean).sort();
test("★★ LE COUPLE : la liste « voit tout » est la MÊME des deux côtés",
  rolesSql.join(",") === [...C.ROLES_TOUTES_CONVERSATIONS].sort().join(","));
const exclusSql = (sql28.match(/public\.wa_role\(\) not in \(([^)]*)\)/) || ["", ""])[1]
  .split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean).sort();
test("★★ LE COUPLE (l'autre moitié) : les deux rôles exclus sont les mêmes des deux côtés",
  exclusSql.join(",") === "client,comptable"
  && exclusSql.every((role) => C.aAccesWhatsapp({ role }) === false));
// ⚠⚠ RETOURNÉ LE 21/09/2026, PAS ASSOUPLI : la règle épargne désormais DEUX
// canaux (les messages ET leur fiche légère). Ce qui est protégé n'a pas
// bougé d'un mot — une ligne de 💬 Messages n'est toujours pas examinée.
test("★★ la règle de la base ne touche QUE les lignes WhatsApp — c'est la table de TOUS les messages",
  /coalesce\(data ->> 'canal', ''\) not in \('whatsapp', 'whatsapp_entete'\)/.test(sql28));
test("★★ …et `securite-28` REPREND `securite-27` en entier : c'est le seul à coller",
  ["public.wa_role()", "public.wa_moi()", "public.wa_proprietaire(cle text)", "messages_wa_tel_idx"]
    .every((bout) => sql27.includes(bout) && sql28.includes(bout)));
test("★ elle s'AJOUTE aux règles existantes (restrictive), elle n'en remplace aucune",
  /as restrictive for select to authenticated/.test(sql28));
test("★ la lecture du propriétaire est en SECURITY DEFINER (sinon PostgreSQL tournerait en rond)",
  /security definer/.test(sql28) && /revoke all on function public\.wa_proprietaire\(text\) from public, anon/.test(sql28));
test("★ le propriétaire lu par la base est le DERNIER qui en porte un — comme `proprietaireDe`",
  /order by m\.data ->> 'ts' desc/.test(sql28)
  && C.proprietaireDe([
    { ts: "2026-09-20T10:00:00Z", proprietaire_id: "a" },
    { ts: "2026-09-20T11:00:00Z", proprietaire_id: "b" },
    { ts: "2026-09-20T12:00:00Z" },
  ]).id === "b");

// ── « 3a » : CE QUE LE CLIENT ENVOIE QUI N'EST PAS DU TEXTE
// ⚠ Les formes sont celles de la documentation YCloud (consultée le
// 20/09/2026) : un bloc portant le TYPE du message, avec `link`, `id`,
// `mime_type`, et `caption` / `filename` selon les cas.
const photo = C.lireMedia({ type: "image", image: { link: "https://x/y.jpg", id: "m1", mime_type: "image/jpeg", caption: "mon compteur" } });
test("★★ une photo est reconnue, avec son lien, son type et sa légende",
  photo && photo.type === "image" && photo.lien === "https://x/y.jpg" && photo.mime === "image/jpeg" && photo.legende === "mon compteur");
test("★ une note vocale et un document aussi, le document avec son nom",
  C.lireMedia({ type: "voice", voice: { link: "https://x/v.ogg", id: "m2" } })?.type === "voice"
  && C.lireMedia({ type: "document", document: { link: "https://x/f.pdf", filename: "facture.pdf" } })?.nom === "facture.pdf");
test("★★ un message de TEXTE ne porte aucun fichier — et un type inconnu non plus",
  C.lireMedia({ type: "text", text: { body: "bonjour" } }) === null
  && C.lireMedia({ type: "location", location: { latitude: 6.1 } }) === null
  && C.lireMedia(null) === null);
test("★ un bloc sans lien NI identifiant ne compte pas pour un fichier",
  C.lireMedia({ type: "image", image: { mime_type: "image/jpeg" } }) === null);
test("★ chaque sorte a son mot, en français — une notification vide ne dit rien",
  C.libelleMedia(photo) === "📷 Photo"
  && C.libelleMedia({ type: "voice" }) === "🎤 Note vocale"
  && C.libelleMedia({ type: "document", nom: "facture.pdf" }) === "📄 Document : facture.pdf"
  && C.libelleMedia(null) === "");

// ⚠ LE VRAI CONTRÔLE : la fonction d'ENTRÉE elle-même, exercée pour de vrai.
// Avant le 20/09/2026 elle REFUSAIT un message sans texte : le client
// envoyait la photo de son compteur, personne ne savait qu'elle avait existé.
const E = await import("../api/whatsapp-entrant.js");
const luPhoto = E.lireEntrant({ whatsappInboundMessage: { from: "+22890112233", type: "image", image: { link: "https://x/y.jpg", id: "m1", mime_type: "image/jpeg" }, id: "wamid.1" } });
test("★★ une photo SANS légende est maintenant retenue (elle l'était perdue en silence)",
  luPhoto.media !== null && luPhoto.media.type === "image" && luPhoto.from === "+22890112233");
test("★★ la légende d'une photo devient le texte du message",
  E.lireEntrant({ type: "image", image: { link: "https://x/y.jpg", caption: "mon compteur" } }).texte === "mon compteur");
test("★ un message de texte n'a pas changé d'un mot",
  E.lireEntrant({ whatsappInboundMessage: { from: "90112233", type: "text", text: { body: "bonjour" } } }).texte === "bonjour");
test("★ un type qu'on ne sait pas lire est écrit quand même, avec son nom",
  E.lireEntrant({ type: "location", location: { latitude: 6.1 } }).texte === "[location]");
test("★★ et l'entrée ne refuse plus que ce qui ne porte RIEN",
  /if \(!texte && !media\)/.test(entrant) && /wa_media: media/.test(entrant));

// ── LE FICHIER NE S'OUVRE QU'AVEC LA CLÉ, ET QUE POUR QUI Y A DROIT
test("★★ la clé YCloud n'existe QUE dans la fonction serveur — jamais dans le navigateur",
  /process\.env\.YCLOUD_API_KEY/.test(apiMedia)
  && !/YCLOUD/.test(lire("src/whatsapp.js").replace(/\/\/[^\n]*/g, "")) && !/YCLOUD/.test(codeWa)
  && !/VITE_YCLOUD/.test(apiMedia));
test("★★ le mur est REVÉRIFIÉ DANS LE GESTE : la règle est importée, jamais recopiée",
  /import \{[^}]*peutVoirConversation[^}]*\} from "\.\.\/src\/lib\/whatsappConversations\.js"/.test(apiMedia)
  && /if \(!peutVoirConversation\(compte, \{ proprietaire_id: prop\.id \}\)\)/.test(apiMedia));
test("★ un fichier effacé par WhatsApp (30 jours) se DIT, il n'affiche pas un cadre vide",
  /30 jours/.test(apiMedia) && /30 jours|n'est plus disponible/.test(ecranWa + apiMedia));
test("★★ UN SEUL CHEMIN : l'écran passe par src/whatsapp.js, il n'appelle pas le serveur lui-même",
  /chargerMediaWa/.test(codeWa) && !/whatsapp-media/.test(codeWa)
  && /whatsapp-media/.test(lire("src/supabaseClient.js")));
test("★ le jeton reste dans le CORPS de la requête, jamais dans l'adresse (les journaux la gardent)",
  !/whatsapp-media\?[^"']*jeton/.test(lire("src/supabaseClient.js")));


// ──────────────────────────────────────────────────────────────
titre("⑩ L'ÉCRAN EST MONTÉ POUR DE BON — sur une base garnie ET sur une base NUE");
// ⚠ « Un écran qui PRÉSUME une table est un écran blanc en puissance », et
// le seul contrôle qui attrape un écran blanc est celui qui REND l'écran
// (leçon du 19/09/2026). `npm run build` et `verifier-imports` ne voient
// RIEN d'un argument oublié ou d'une table absente.
const sortie = join("node_modules", ".cache", `bmi-wa-${process.pid}.mjs`);
await build({
  entryPoints: ["scripts/_rendu-whatsapp.jsx"], bundle: true, format: "esm", platform: "node",
  outfile: sortie, logLevel: "silent", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/server"],
});
const V = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

// ⚠ Un rendu qui LÈVE doit donner un ✗ lisible, pas une pile d'erreurs :
// c'est exactement ce que voit l'utilisateur (un écran blanc), et le banc
// doit le NOMMER.
const monte = (f) => { try { return f(); } catch (e) { return `⛔ ${e?.message || e}`; } };
const vuAdmin = monte(V.htmlAdmin), vuNu = monte(V.htmlNu), vuCpt = monte(V.htmlComptable);
test("★★ l'écran se monte sur une base garnie, et la conversation s'y voit",
  vuAdmin.includes("ESSO") && vuAdmin.includes("Rechercher"));

// ──────────────────────────────────────────────────────────────
titre("⑫ LE MESSAGE `espace` DANS 📲 WHATSAPP : EN CLAIR POUR LE CRÉATEUR ET L'ADMIN, MASQUÉ POUR LES AUTRES (23/09/2026)");
{
  const mdp = monte(V.mdpClient);
  const liste = monte(V.ligneAcces);
  const ligne = Array.isArray(liste) ? liste.find((x) => x && x.wa_acces) : null;
  test("★★ la ligne écrite dans le fil ne porte JAMAIS le mot de passe, ni l'identifiant : ses deux trous sont masqués",
    !!ligne && typeof mdp === "string" && mdp.length >= 6 && !ligne.texte.includes(mdp) && !ligne.texte.includes("KOFFI et")
    && (ligne.texte.match(/••••••/g) || []).length === 2 && /BIENVENUE SUR/.test(ligne.texte) && !JSON.stringify(ligne).includes(mdp));
  test("★ la ligne est une ligne de conversation WhatsApp sortante (canal, clé du numéro, fiche du compte, auteur = le créateur), jamais un entrant",
    !!ligne && ligne.canal === "whatsapp" && ligne.wa_tel === "90117788" && ligne.wa_acces?.client_id === "CLI3"
    && ligne.de_id === "KOSSI" && !ligne.wa_entrant);
  test("★ la fiche légère de la conversation suit (une ligne grisée chez qui n'y a pas droit, jamais une conversation absente)",
    Array.isArray(liste) && liste.some((x) => x && x.id === "waent_90117788" && x.canal === "whatsapp_entete" && !("texte" in x && x.texte)));
  const clairAdmin = monte(() => V.lectureAcces(V.lecteurAdmin));
  const clairCreateur = monte(() => V.lectureAcces(V.lecteurCreateur));
  const masqueAutre = monte(() => V.lectureAcces(V.lecteurAutre));
  test("★★ l'ADMINISTRATEUR lit le message en clair : identifiant et mot de passe remplis",
    typeof clairAdmin === "string" && clairAdmin.includes(`KOFFI et\n${mdp}`) && !clairAdmin.includes("••••••"));
  test("★★ le CRÉATEUR du compte lit le message en clair",
    typeof clairCreateur === "string" && clairCreateur.includes(mdp) && !clairCreateur.includes("••••••"));
  test("★★ TOUT AUTRE utilisateur lit les deux trous masqués — jamais le mot de passe",
    typeof masqueAutre === "string" && !masqueAutre.includes(mdp) && (masqueAutre.match(/••••••/g) || []).length === 2);
  test("★ sans fiche du client (compte parti), même l'administrateur ne lit que le texte masqué : rien n'est inventé",
    M.texteAccesAffiche(ligne, V.lecteurAdmin, null) === ligne.texte);
  // 🔑 14/10/2026 : `espace_portail` — sa ligne porte SON texte, sans les
  // étoiles du gras (l'écran ne les dessine pas), et le modèle parti.
  const lignePortail = { id: "mp", de_id: V.lecteurCreateur.id, wa_nom: "koffi", texte: M.texteEspaceMasque("koffi", "espace_portail"), wa_acces: { client_id: "c1", modele: "espace_portail" } };
  test("★★ `espace_portail` : la ligne masquée est SON texte (Timo, mot pour mot, sans étoiles), trous 2 et 3 masqués",
    lignePortail.texte === "Bonjour Mr/Mme KOFFI,\nBIENVENUE SUR LE PORTAIL GESTION DE BMI\nClick sur 👇🏿\nhttps://gestion.bmitogo.com\n\n•••••• et ••••••\n\nPour tous besoins :\n📧Contact@bmitogo.com\n☎️ +228 99 96 84 88 / +228 91 13 05 11\nWeb: https://www.bmitogo.com\n\nÀ bientôt !\nBMI TOGO — Les bâtiments modernes et intelligents");
  test("★★ `espace_portail` : l'administrateur lit les codes en clair dans SON texte, un autre lit le masque",
    M.texteAccesAffiche(lignePortail, V.lecteurAdmin, { identifiant: "KOFFI", motDePasse: "K9F2O1" }).includes("KOFFI et K9F2O1\n\nPour tous besoins")
    && M.texteAccesAffiche(lignePortail, V.lecteurAutre, { identifiant: "KOFFI", motDePasse: "K9F2O1" }) === lignePortail.texte);
  test("★★ le texte de `espace_portail` chez Meta met les deux codes en GRAS, une étoile collée de chaque côté",
    /\n\*\{\{2\}\}\* et \*\{\{3\}\}\*\n/.test(M.TEXTE_ESPACE_PORTAIL) && (M.TEXTE_ESPACE_PORTAIL.match(/\*/g) || []).length === 4);
  test("★ le texte de la ligne est celui du modèle `espace` écrit par Timo, trous 2 et 3 masqués",
    M.texteEspaceMasque("koffi") === "Bonjour Mr/Mme KOFFI,\n\nBIENVENUE SUR\nhttps://gestion.bmitogo.com\n\nvotre espace avec :\n•••••• et\n••••••\n\nÀ bientôt !\nBMI TOGO — Les bâtiments modernes et intelligents");
  // L'ÉCRAN : le fil passe par la règle, et ne dessine jamais m.texte brut.
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ecran = sansComm(lire("src/screens/Whatsapp.jsx"));
  test("★★ 📲 WhatsApp dessine chaque ligne du fil par texteAccesAffiche (texteDuFil), jamais m.texte brut, et recalcule le mot de passe depuis la fiche de l'espace regardé",
    /texteDuFil\(m\)/.test(ecran) && !/<div>\{m\.texte\}<\/div>/.test(ecran)
    && /texteAccesAffiche\(m, profile, client \? \{ identifiant: client\.nom, motDePasse: motDePasseConnu\(client\) \} : null\)/.test(ecran)
    && /utilisateursDeLEspace\(db, profile\)\.find\(\(u\) => u\.id === m\.wa_acces\.client_id\)/.test(ecran));
  // LE SAVE : une fonction de l'état COURANT, sinon la création d'un compte
  // serait reprise pour une suppression par le second enregistrement.
  test("★★ save() accepte une fonction de l'état courant (dbRef.current), AVANT tout le reste",
    /const save = async \(next, action, options = \{\}\) => \{[\s\S]{0,600}?if \(typeof next === "function"\) next = next\(dbRef\.current\);/.test(lire("src/App.jsx")));
  // L'EMPLOYÉ : jamais le numéro BMI, jamais une ligne dans le fil.
  const util = sansComm(lire("src/screens/Utilisateurs.jsx"));
  const blocEmp = (util.match(/if \(chiffresTel\(f\.tel\)\.length >= 4\) \{[\s\S]*?\n    \}\n/) || [""])[0];
  test("★★ un EMPLOYÉ reçoit ses accès depuis le téléphone de l'administrateur (envoyerIdentifiantsEmployeWhatsApp), jamais du numéro BMI, et rien ne s'écrit dans 📲 WhatsApp",
    blocEmp.length > 0 && /envoyerIdentifiantsEmployeWhatsApp\(nomEmp, nomEmp, pwdEmp, roleEmp, telEmp, uConfirm\)/.test(blocEmp)
    && !/envoyerIdentifiantsDuNumeroBmi/.test(blocEmp) && !/messagesAvecLigneAcces/.test(blocEmp) && /VOTRE numéro/.test(blocEmp));
}
test("★★ une PHOTO, une note vocale, un document : chacun se dessine avec SON mot",
  monte(V.htmlPhoto).includes("📷 Photo") && monte(V.htmlVocale).includes("🎤 Note vocale")
  && monte(V.htmlDoc).includes("📄 Document : facture.pdf"));
test("★★ l'écran se monte sur une base NUE sans rien présumer (le cas de l'écran blanc)",
  !vuNu.startsWith("⛔") && vuNu.length > 0);
test("★★ le comptable, lui, n'y trouve AUCUNE conversation",
  !vuCpt.startsWith("⛔") && !vuCpt.includes("ESSO"));


// ──────────────────────────────────────────────────────────────
titre("⑪ 📋 LA RELANCE D'UNE DETTE PART DU NUMÉRO BMI (20/09/2026, « c »)");
// Capture Timo : « la relance de dette ouvre encore le WhatsApp sur
// l'ordinateur ». Ce n'était pas un défaut — ça n'avait jamais été construit.
const ecranDettes = lire("src/screens/Dettes.jsx");
const codeDettes = ecranDettes.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const detteSimple = { id: "t1", client: "MR ERIC", tel: "90112233", boutique: "BMI DEMAKPOE", date: "2026-09-14", montant: 1000000, paye: 0 };
const dettePlan = { id: "t2", client: "AMA", tel: "90114455", boutique: "BMI APESSITO", date: "2026-09-11", montant: 232800, paye: 150000 };

const rd = M.envoiRappelDette({ dette: detteSimple, compte: { nom_base: "MR ERIC" }, fmt, dFR });
test("★★ une dette ORDINAIRE part avec `rappel_dette` — jamais une date d'échéance inventée",
  rd.modele === "rappel_dette" && rd.variables.length === 4
  && rd.variables[0] === "MR ERIC" && rd.variables[1] === "14/09/2026"
  && rd.variables[2] === fmt(1000000) && rd.variables[3] === fmt(1000000));

const re = M.envoiRappelDette({ dette: dettePlan, compte: null, echeance: { date: "2026-10-31", montant: 60000 }, fmt, dFR });
test("★★ une dette adossée à un PLAN part avec `rappel_echeance`, et le RESTE est juste",
  re.modele === "rappel_echeance" && re.variables.length === 5
  && re.variables[1] === "31/10/2026" && re.variables[2] === fmt(60000)
  && re.variables[3] === fmt(82800) && re.variables[4] === "BMI APESSITO");
test("★★ une dette SOLDÉE ne se relance pas — on ne réclame pas un argent déjà reçu",
  M.envoiRappelDette({ dette: { montant: 5000, paye: 5000 }, compte: null, fmt, dFR }) === null
  && M.envoiRappelDette({ dette: { montant: 5000, paye: 9000 }, compte: null, fmt, dFR }) === null);
test("★ sans compte client, le nom de la dette suffit (un prospect n'a pas de fiche)",
  M.envoiRappelDette({ dette: { ...detteSimple }, compte: null, fmt, dFR }).variables[0] === "MR ERIC");
test("★ aucun trou ne part vide — Meta refuse une variable vide",
  M.critiqueModele(rd.modele, rd.variables) === "" && M.critiqueModele(re.modele, re.variables) === "");

// ── LE TEXTE DE REPLI DIT LA MÊME CHOSE QUE LE MODÈLE
const replDette = M.texteRappel({ dette: detteSimple, compte: null, fmt, dFR });
const replEch = M.texteRappel({ dette: dettePlan, compte: null, echeance: { date: "2026-10-31", montant: 60000 }, fmt, dFR });
test("★★ le repli porte les MÊMES chiffres que le modèle (deux textes qui divergent = deux relances différentes)",
  replDette.includes(fmt(1000000)) && replDette.includes("14/09/2026")
  && replEch.includes(fmt(60000)) && replEch.includes(fmt(82800)) && replEch.includes("31/10/2026"));
test("★ et le repli suit le MÊME aiguillage que le modèle",
  replEch.includes("échéance") && !replDette.includes("échéance"));

// ── L'ÉCRAN
test("★★ LE MUR : l'écran passe l'espace de la DETTE, jamais celui de qui clique",
  /espaceFormation: espaceDeLaDette\(db, d, profile\)/.test(codeDettes));
test("★★ la trace porte l'IDENTIFIANT, pas seulement le nom (le défaut du 20/09 au matin)",
  /traceEnvoi\(\{ modele: envoi\.modele, par: profile\.nom, par_id: profile\.id/.test(codeDettes));
test("★★ elle ne s'écrit QUE si le message est parti du numéro BMI",
  /if \(!r\.auto\)/.test(codeDettes) && codeDettes.indexOf("if (!r.auto)") < codeDettes.indexOf("traceEnvoi("));
test("★★ …et elle SE LIT sous la ligne — une trace qu'on ne voit pas ne sert à rien",
  /libelleTrace\(d\.envoi_whatsapp\)/.test(ecranDettes));
test("★★ UN SEUL CHEMIN : l'écran passe par envoyerModele, il n'ouvre plus WhatsApp lui-même pour une relance",
  /envoyerModele\(\{/.test(codeDettes) && !/const relancer[\s\S]{0,400}envoyerWhatsApp\(/.test(codeDettes));
{
  // ★★ ON CONFIRME AVANT DE RELANCER (Timo, 25/09/2026 : « sinon on peut
  // relancer une personne qu'on ne devrait pas ») : le message part tout
  // seul du numéro BMI. On découpe le CORPS de chaque geste et on exige la
  // question AVANT l'envoi — dettes ET devis (même risque).
  const corps = (code, nom) => { const i = code.indexOf(`const ${nom} = async`); return i < 0 ? "" : code.slice(i, code.indexOf("\n  };", i)); };
  const confirmeAvant = (c) => { const q = c.search(/if \(!await uConfirm\(`Relancer /); const e = c.indexOf("envoyerModele("); return q > 0 && e > 0 && q < e; };
  const cDette = corps(codeDettes, "relancer");
  const cDevis = corps(lire("src/screens/TousLesDevis.jsx"), "relancerDevis");
  test("★★ 📋 Dettes : « Relancer X (numéro) ? » est demandé AVANT que le message parte",
    confirmeAvant(cDette) && /Reste à payer/.test(cDette));
  test("★★ 📋 Tous les devis : même question AVANT l'envoi", confirmeAvant(cDevis));
}
{
  // ★★ La cellule FIGÉE a un fond OPAQUE (capture Timo, 25/09/2026 :
  // « SEBASTINO » mêlé au motif qui glissait dessous, sur la rayure
  // transparente bg-slate-50/60). On exerce la vraie fonction de ui.jsx.
  const ui = lire("src/components/ui.jsx");
  const m = ui.match(/const fondOpaque = (\(fond\) => [^;]+);/);
  const fondOpaque = m ? eval(m[1]) : null;
  test("★★ la rayure transparente perd sa transparence sous le nom figé (bg-slate-50/60 → bg-slate-50)",
    !!fondOpaque && fondOpaque("bg-slate-50/60") === "bg-slate-50" && fondOpaque("bg-red-50") === "bg-red-50" && fondOpaque("") === "bg-white"
    && /export const celluleFigee = [^\n]*\$\{fondOpaque\(fond\)\}/.test(ui));
}
// ⚠ RETOURNÉ le 29/09/2026 : il se dit AVANT l'ouverture (`prevenir`), plus après.
test("★ un repli qui n'est pas la règle SE DIT, avant l'ouverture (un repli muet ressemble à une panne)",
  /prevenir: uAlert/.test(codeDettes) && !/if \(r\.motif\) uAlert\(/.test(codeDettes));
test("★★ un plan PROPOSÉ mais pas encore accepté ne donne aucune échéance",
  /plan\.statut !== PLAN_ACCEPTE/.test(codeDettes) && /return null/.test(codeDettes));
test("★ l'échéance est cherchée par l'ÉCRAN, la règle pure ne reçoit jamais la base",
  !/db\b/.test(M.envoiRappelDette.toString()) && /prochaineEcheance\(plan,/.test(codeDettes));


// ──────────────────────────────────────────────────────────────
titre("⑫ 🔒 UNE CONVERSATION CONFIÉE SE VOIT, GRISÉE, ET NE S'OUVRE PAS (21/09/2026)");
// Timo, capture de 📲 WhatsApp : une conversation confiée à TIMO1 dans
// laquelle ANGELE écrivait encore. Sa règle, mot pour mot : « assigned_to =
// null → visible à tous ; assigned_to = TIMO1 → visible à TIMO1 + admin ».
// Et sur la façon : « on peut voir la discussion mais GRISÉ. Impossible
// d'ouvrir par les autres. PAS JUSTE LA FAIRE DISPARAÎTRE. » (décision « B »)
const codeEcranWa = ecranWa.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
const codeEntrant = entrant.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

// ── LA FICHE LÉGÈRE NE PORTE RIEN
const fiche = C.construireEntete({
  cle: "90114455", tel: "+22890114455", nom: "AYOKO",
  proprietaire_id: "u1", proprietaire_nom: "COM1", derniere: "2026-09-21T09:00:00Z",
});
test("★★★ LA FICHE NE PORTE PAS UN MOT DU CONTENU — c'est tout l'intérêt",
  !("texte" in fiche) && !("de_id" in fiche) && !("lu_par" in fiche) && !("wa_media" in fiche)
  && JSON.stringify(fiche).includes("AYOKO") === true);
test("★★ son id est DÉRIVÉ de la clé : on la REMPLACE, on n'en empile pas une par message",
  fiche.id === C.idEntete("90114455")
  && C.construireEntete({ cle: "90114455", derniere: "2026-09-22T00:00:00Z" }).id === fiche.id);
test("★ elle dit à qui la conversation est confiée, et depuis quand",
  fiche.proprietaire_nom === "COM1" && fiche.derniere === "2026-09-21T09:00:00Z" && fiche.wa_numero === "+22890114455");
test("★ sans clé, pas de fiche (on ne fabrique jamais une ligne vide)",
  C.construireEntete({}) === null && C.construireEntete() === null);
const avecDeux = C.messagesAvecEntete(C.messagesAvecEntete([], { cle: "90114455", derniere: "a" }), { cle: "90114455", derniere: "b" });
test("★★ `messagesAvecEntete` remplace la fiche, il n'en laisse jamais deux",
  avecDeux.filter((m) => m.id === fiche.id).length === 1 && avecDeux[0].derniere === "b");

// ── LA LISTE : GRISÉE, ET VIDE DE TOUT CONTENU
// ⚠⚠ ON MET EXPRÈS LES MESSAGES DE LA CONVERSATION CONFIÉE DANS LA LISTE,
// alors que la base ne les enverrait pas (`securite-28`). C'est le PIRE cas :
// si la règle les laissait ressortir par une ligne grisée, on le verrait ici.
const msgsConfiee = [
  { canal: "whatsapp", wa_tel: "90114455", wa_entrant: true, ts: "2026-09-21T09:00:00Z", texte: "SECRET", proprietaire_id: "u1", proprietaire_nom: "COM1" },
  fiche,
  { canal: "whatsapp", wa_tel: "90445566", wa_entrant: true, ts: "2026-09-21T10:00:00Z", texte: "support" },
];
const vuVendeur = C.conversationsWa(msgsConfiee, { id: "u9", role: "vendeur" });
const grisee = vuVendeur.find((c) => c.cle === "90114455");
test("★★★ « PAS JUSTE LA FAIRE DISPARAÎTRE » : la ligne est là, et elle est VERROUILLÉE",
  !!grisee && grisee.verrouillee === true && grisee.nom === "AYOKO" && grisee.proprietaire_nom === "COM1");
test("★★★ …et elle ne porte AUCUN message, même si un message avait fuité jusqu'ici",
  grisee.fil.length === 0 && grisee.nonLus === 0 && !JSON.stringify(grisee).includes("SECRET"));
test("★★ le support, lui, s'ouvre normalement pour tout le personnel",
  (vuVendeur.find((c) => c.cle === "90445566") || {}).verrouillee === false);
test("★★ le propriétaire, lui, l'ouvre en entier",
  (C.conversationsWa(msgsConfiee, { id: "u1", role: "commercial" }).find((c) => c.cle === "90114455") || {}).verrouillee === false);
test("★★ l'administrateur aussi — il voit tout, c'est sa décision",
  (C.conversationsWa(msgsConfiee, { id: "zz", role: "admin" }).find((c) => c.cle === "90114455") || {}).verrouillee === false);
// ⚠⚠ LE GARDE-FOU QUI MANQUAIT D'UN CHEVEU : sans lui, « non » voulant
// désormais dire « grisée », le comptable et le client auraient vu la liste
// entière en lignes grisées. Éprouvé en le retirant : ce contrôle tombe.
test("★★★ le comptable et un client ne voient RIEN — pas même une ligne grisée",
  C.conversationsWa(msgsConfiee, { id: "cpt", role: "comptable" }).length === 0
  && C.conversationsWa(msgsConfiee, { id: "c1", role: "client" }).length === 0);
test("★★ une conversation confiée SANS fiche reste inconnue (on ne devine pas ce qu'on n'a pas)",
  C.conversationsWa(msgsConfiee.filter((m) => m !== fiche), { id: "u9", role: "vendeur" })
    .every((c) => c.cle !== "90114455"));

// ── LE REFUS NOMME, ET L'ÉCRAN OBÉIT
test("★★ le refus NOMME la personne et dit la porte de sortie",
  /COM1/.test(C.motifVerrouillee({ proprietaire_nom: "COM1" }))
  && /administrateur/.test(C.motifVerrouillee({ proprietaire_nom: "COM1" })));
test("★ il ne dit jamais « lui » ni « elle » : on ne connaît pas la personne",
  !/\b(lui|elle)\b/.test(C.motifVerrouillee({ proprietaire_nom: "COM1" })));
test("★★ REVÉRIFIÉ DANS LE GESTE : l'écran refuse d'ouvrir une ligne grisée, et DIT pourquoi",
  /if \(c\.verrouillee\) \{ uAlert\(motifVerrouillee\(c\)\); return; \}/.test(codeEcranWa));
test("★★ une ligne grisée ne porte NI pastille de non-lus, NI compteur d'onglet",
  /!verrou && item\.nb > 0/.test(codeEcranWa) && /c\.verrouillee \? 0 :/.test(codeEcranWa));

// ── LA FICHE EST POSÉE PARTOUT OÙ LA CONVERSATION BOUGE
// ⚠ RETOURNÉ le 09/10/2026 : un septième geste pose la fiche — 📇 la trace
// « enregistré dans les contacts Google de BMI » (elle vit sur la fiche).
test("★★ les gestes de l'écran posent la fiche : répondre, écrire le premier, confier, rendre à tous, le rattrapage, ✏️ Nommer (06/10/2026) et 📇 le contact Google (09/10/2026)",
  (codeEcranWa.match(/messagesAvecEntete\(/g) || []).length === 7);
test("★★★ …et le WEBHOOK aussi, par UPSERT (sinon la ligne grisée resterait figée)",
  /construireEntete\(\{/.test(codeEntrant)
  && /\.upsert\(\{ id: fiche\.id, data: fiche, updated_at: fiche\.ts \}\)/.test(codeEntrant));
test("★ une fiche qui ne se pose pas ne fait JAMAIS perdre le message du client",
  /console\.error\("whatsapp-entrant : fiche de conversation non posée"/.test(entrant)
  && entrant.indexOf("insert({ id: ligne.id") < entrant.indexOf("construireEntete({"));

// ── LES CONVERSATIONS D'AVANT : ELLES NE DISPARAISSENT PAS
// ⚠⚠ SANS CE RATTRAPAGE LA RÈGLE MENTIRAIT LE PREMIER JOUR : une
// conversation qui existait avant la fiche légère n'en a pas, donc elle
// disparaîtrait chez les autres au lieu d'être grisée — ce que Timo a
// justement refusé. Éprouvé en retirant le rattrapage : ce contrôle tombe.
test("★★★ l'administrateur POSE les fiches manquantes des conversations d'avant",
  /rattrape\.current/.test(codeEcranWa)
  && /!messages\.some\(\(m\) => m\.id === idEntete\(c\.cle\)\)/.test(codeEcranWa));
test("★★ …lui seul (il est le seul à toutes les voir), et une seule fois par ouverture",
  /if \(rattrape\.current \|\| !peutReattribuer\(profile\)\) return;/.test(codeEcranWa));
test("★ …et seulement s'il en manque : rien à écrire, rien n'est écrit",
  /if \(!manquantes\.length\) return;/.test(codeEcranWa));

// ── L'ÉCRAN, MONTÉ POUR DE BON
const vuVend = monte(V.htmlVendeur);
test("★★★ RENDU : le vendeur VOIT la ligne grisée, avec son cadenas et le nom",
  !vuVend.startsWith("⛔") && vuVend.includes("AYOKO") && vuVend.includes("🔒")
  && /Confiée à COM1/.test(vuVend));
test("★★★ RENDU : et pas un mot du contenu de cette conversation",
  !vuVend.includes("SECRET DE LA CONVERSATION"));
test("★★ RENDU : la ligne grisée est marquée comme telle, et l'autre non",
  /data-wa-verrou="1"/.test(vuVend) && /data-wa-verrou="0"/.test(vuVend));
test("★★ RENDU : l'administrateur, lui, n'a aucune ligne grisée",
  !/data-wa-verrou="1"/.test(vuAdmin) && vuAdmin.includes("AYOKO"));


// ──────────────────────────────────────────────────────────────
titre("⑬ 🔓 RENDRE UNE CONVERSATION À TOUT LE MONDE (21/09/2026)");
// Timo : « donner la possibilité à l'administrateur de rendre la discussion
// déjà confiée à redevenir accessible à tous les utilisateurs ». Sans ça,
// une conversation confiée à quelqu'un qui part en congé n'avait aucune
// porte de sortie — on ne pouvait que la donner à quelqu'un d'autre.
const sql29 = lire("supabase/securite-29-rendre-a-tous.sql");
const filConfie = [
  { ts: "1", proprietaire_id: "u1", proprietaire_nom: "KOSSI" },
  { ts: "2", texte: "bonjour" },
];
const filRendu = [...filConfie, { ts: "3", wa_systeme: true, [C.MARQUE_RENDUE]: true }];

test("★★★ la MARQUE rend la conversation au support — sans rien effacer du fil",
  C.proprietaireDe(filConfie).id === "u1"
  && C.proprietaireDe(filRendu).id === ""
  && filRendu.length === 3);
test("★★ et on peut la RECONFIER après : la marque ne grave rien dans le marbre",
  C.proprietaireDe([...filRendu, { ts: "4", proprietaire_id: "u2", proprietaire_nom: "AMA" }]).id === "u2");
test("★★★ une fois rendue, TOUT le personnel peut l'ouvrir — c'est ce qui était demandé",
  ["vendeur", "gerant", "commercial", "technicien", "magasinier"].every((role) =>
    C.peutVoirConversation({ id: "zz", role }, { proprietaire_id: C.proprietaireDe(filRendu).id })));
test("★ …et ni le client ni le comptable, eux, n'y gagnent rien",
  ["client", "comptable"].every((role) =>
    C.peutVoirConversation({ id: "zz", role }, { proprietaire_id: "" }) === false));

// ── LE COUPLE : l'écran et la base s'arrêtent sur LE MÊME MOT
test("★★★ LE COUPLE : `securite-29` s'arrête sur la MÊME marque que la règle",
  sql29.includes(`'${C.MARQUE_RENDUE}'`)
  && /or coalesce\(m\.data ->> 'proprietaire_efface', ''\) = 'true'/.test(sql29));
test("★★ …et il REPREND `securite-28` en entier : c'est le seul à coller",
  ["public.wa_role()", "public.wa_moi()", "wa_conversations_visibles", "whatsapp_entete", "messages_wa_tel_idx"]
    .every((bout) => sql29.includes(bout)));

// ── LE GESTE, DANS L'ÉCRAN
test("★★ le bouton est réservé à l'ADMINISTRATEUR, revérifié DANS le geste",
  /if \(!peutReattribuer\(profile\)\) \{ uAlert\("Seul un administrateur peut rendre une conversation à tout le monde\./.test(codeEcranWa)
  // ⚠ RETOURNÉ le 09/10/2026 (« a1 ») : les boutons vivent dans le PROFIL ;
  // le bloc entier est gardé par peutReattribuer, « Rendre » par le propriétaire.
  && /actions=\{peutReattribuer\(profile\) && \(<>/.test(codeEcranWa)
  && /\{ouverte\.proprietaire_id && \(\s*<button onClick=\{rendreATous\}/.test(codeEcranWa));
test("★★ un bouton qui ne commanderait rien ne s'affiche pas : sans propriétaire, rien à rendre",
  /if \(!ouverte\.proprietaire_id\) \{ uAlert\(/.test(codeEcranWa));
test("★★★ le geste POSE la marque, il ne réécrit aucun message",
  /\[MARQUE_RENDUE\]: true,/.test(codeEcranWa)
  && /wa_systeme: true,[\s\S]{0,200}\[MARQUE_RENDUE\]/.test(codeEcranWa));
test("★★ la fiche légère suit, SANS propriétaire (la ligne cesse d'être grisée)",
  /messagesAvecEntete\(\[m, \.\.\.messages\], \{\s*cle: ouverte\.cle, tel: ouverte\.tel, nom: ouverte\.nom, derniere: m\.ts,\s*\}\)/.test(codeEcranWa));
test("★ le geste laisse sa ligne de journal, comme « Confier »",
  /rendue à tout le personnel par \$\{profile\.nom\}/.test(codeEcranWa));


// ──────────────────────────────────────────────────────────────
titre("⑯ 🎓 LES CONVERSATIONS WHATSAPP N'EXISTENT QU'EN RÉEL (22/09/2026, décision « B »)");
// Timo : « les messages WhatsApp sont-ils finalement bloqués sur l'espace
// formation ? ». L'envoi l'était ; la RÉPONSE libre et la LISTE, non. Il a
// choisi « B » : écran vide et qui le dit, refus dans le geste, et
// securite-30 pour qu'un compte de formation ne reçoive rien.
const sql30 = lire("supabase/securite-30-whatsapp-reel-seulement.sql");
const bancSql = lire("scripts/tester-conversations-sql.sh");
const msgsReels = [
  { id: "f1", canal: "whatsapp", wa_tel: "90112233", wa_nom: "ESSO", ts: "2026-09-22T08:00:00Z", wa_entrant: true, texte: "bonjour", lu_par: [] },
  { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: "90112233", wa_nom: "ESSO", derniere: "2026-09-22T08:00:00Z", ts: "2026-09-22T08:00:00Z" },
];
test("★★★ SON CAS : en regardant la formation, la liste est VIDE — même pour l'administrateur, même avec des messages en base",
  C.conversationsWa(msgsReels, { id: "TIMO", role: "admin" }).length === 1
  && C.conversationsWa(msgsReels, { id: "TIMO", role: "admin" }, undefined, { espaceFormation: true }).length === 0
  && C.conversationsWa(msgsReels, { id: "u1", role: "commercial" }, undefined, { espaceFormation: true }).length === 0);
test("★★ pas même une ligne GRISÉE : la fiche légère ne ressort pas non plus en formation",
  C.conversationsWa([msgsReels[1]], { id: "u9", role: "vendeur" }, undefined, { espaceFormation: true }).length === 0
  && C.conversationsWa([msgsReels[1]], { id: "u9", role: "vendeur" }).length === 1);
test("★★★ RÉPONDRE EST REFUSÉ DANS LE GESTE en formation, avant toute autre vérification",
  C.critiqueReponse({ profile: { id: "TIMO", role: "admin" }, conv: convOuverte, texte: "salut", espaceFormation: true }) === C.MOTIF_WA_FORMATION
  && C.critiqueReponse({ profile: { id: "TIMO", role: "admin" }, conv: convOuverte, texte: "salut" }) === "");
test("★ le motif parle français et ne dit ni « RLS » ni « espace_cloisonnement »",
  /formation/.test(C.MOTIF_WA_FORMATION) && !/RLS|cloisonnement|jwt/i.test(C.MOTIF_WA_FORMATION));

// ── L'ÉCRAN : c'est l'espace REGARDÉ qui décide (jamais celui du compte)
test("★★★ l'écran passe l'espace REGARDÉ (`espaceDuCompte`) à la liste, au compteur et au geste — jamais `estCompteFormation(db, profile)`",
  /const regardeFormation = espaceDuCompte\(db, profile\) === true;/.test(codeEcranWa)
  && /conversationsWa\(messages, profile, undefined, \{ espaceFormation: regardeFormation \}\)/.test(codeEcranWa)
  && /const espaceFormation = espaceDuCompte\(db, profile\) === true;\s*return conversationsWa\(messages, profile, undefined, \{ espaceFormation \}\)/.test(codeEcranWa)
  && /critiqueReponse\(\{ profile, conv: ouverte, texte: t, fichier: piece, enLigne: navigator\.onLine !== false, espaceFormation: regardeFormation \}\)/.test(codeEcranWa)
  && !/estCompteFormation\(db, profile\)/.test(codeEcranWa));
test("★★ l'écran vide le DIT, avec la porte de sortie (👁 Je regarde) — jamais une liste vide qui ressemble à une panne",
  /if \(regardeFormation\) \{\s*return \(/.test(codeEcranWa)
  && /data-whatsapp="formation"/.test(codeEcranWa) && /\{MOTIF_WA_FORMATION\}/.test(codeEcranWa)
  && /Je regarde/.test(codeEcranWa));
// ⚠ Un retour anticipé AVANT un hook est un écran blanc (piège du § 5) :
// on vérifie que le retour est posé après le dernier hook du composant.
{
  const debut = codeEcranWa.indexOf("export function Whatsapp(");
  const fin = codeEcranWa.indexOf("export function MediaWa(", debut);
  const corps = codeEcranWa.slice(debut, fin);
  const retour = corps.indexOf("if (regardeFormation) {");
  const dernierHook = Math.max(corps.lastIndexOf("useState("), corps.lastIndexOf("useEffect("), corps.lastIndexOf("useRef("));
  test("★★ le retour anticipé de la formation est posé APRÈS le dernier hook (sinon écran blanc)",
    retour > 0 && dernierHook > 0 && retour > dernierHook);
}
// ── LE RENDU, POUR DE BON
const vuFormation = monte(V.htmlFormation);
test("★★★ MONTÉ : en formation l'écran se dessine, sans une seule conversation, et dit pourquoi",
  !vuFormation.startsWith("⛔") && vuFormation.includes('data-whatsapp="formation"')
  && !vuFormation.includes("ESSO") && !vuFormation.includes("AYOKO") && !vuFormation.includes("Rechercher"));
test("★★ le compteur de l'onglet reste à ZÉRO en formation, et compte en réel",
  V.nonLusFormation() === 0 && V.nonLusReel() > 0);

// ── LE COUPLE : la base ferme la même porte, pour un compte de formation
test("★★★ LE COUPLE : `securite-30` refuse `espace = formation` avec la revendication d'espace-3-politiques",
  /and coalesce\(auth\.jwt\(\) -> 'app_metadata' ->> 'espace', 'reel'\) <> 'formation'/.test(sql30)
  && /as formation_fermee;/.test(sql30));
test("★★ …et il REPREND `securite-29` en entier : c'est le seul à coller",
  ["public.wa_role()", "public.wa_moi()", "wa_conversations_visibles", "whatsapp_entete", "messages_wa_tel_idx", "proprietaire_efface"]
    .every((bout) => sql30.includes(bout))
  && sql30.includes(sql29.slice(sql29.indexOf("create or replace function public.wa_proprietaire"), sql29.indexOf("-- ⚠ Supabase accorde"))));
test("★★ le banc SQL rejoue securite-30 sur un compte de formation, ET vérifie que la messagerie interne n'a pas bougé",
  /securite-30-whatsapp-reel-seulement\.sql/.test(bancSql)
  && /"espace":"formation"/.test(bancSql)
  && /la messagerie INTERNE d'un compte de formation n'a pas bougé" "\$FORMA" "\$INT"/.test(bancSql));
// ⚠ Ce que la base ne peut PAS faire, dit dans le SQL lui-même.
test("★ le SQL DIT que la base ne protège pas l'administrateur principal qui regarde la formation — c'est l'écran",
  /ne sait pas ce que\s*-- l'administrateur PRINCIPAL regarde/.test(sql30));



// ──────────────────────────────────────────────────────────────
titre("⑰ 🔑 LES IDENTIFIANTS D'UN COMPTE PARTENT DU NUMÉRO BMI (22/09/2026)");
// Capture Timo : « la création d'un compte redirige toujours vers le
// WhatsApp du téléphone… le message ne passe pas par le numéro BMI ». Le
// modèle `espace` était approuvé et volontairement PAS branché (21/09) ;
// sa capture le branche. L'envoi à la main reste le REPLI, mot pour mot.
{
  const env = M.envoiIdentifiants({ nomAffiche: "gaelle", identifiant: "GAELLE", motDePasse: "1234G@EL" });
  test("★★ l'ORDRE des trous est celui du modèle chez Meta : nom, identifiant, mot de passe",
    env.modele === "espace" && env.variables.join("|") === "GAELLE|GAELLE|1234G@EL");
  test("★ le nom part en MAJUSCULES, l'identifiant et le mot de passe tels quels",
    M.envoiIdentifiants({ nomAffiche: "ama", identifiant: "AMA99", motDePasse: "aB@c" }).variables.join("|") === "AMA|AMA99|aB@c");
  test("★ `espace` est en service (sans ça, tout retomberait sur l'ouverture WhatsApp)",
    M.MODELES_EN_SERVICE.includes("espace")
    && M.critiqueEnvoiAuto({ modele: "espace", variables: env.variables, tel: "90112233", espaceFormation: false }) === "");
  test("★★ LE MUR : un compte de formation n'écrit jamais à un vrai numéro",
    M.critiqueEnvoiAuto({ modele: "espace", variables: env.variables, tel: "90112233", espaceFormation: true }) === M.MOTIF_FORMATION);
  test("un mot de passe vide est refusé, et le refus le nomme",
    (M.critiqueModele("espace", ["GAELLE", "GAELLE", ""]) || "").includes("mot_de_passe"));

  // La phrase de l'écran : UNE règle pour six écrans.
  test("★ parti du numéro BMI : l'écran le dit", /numéro BMI/.test(M.messageIdentifiants("gaelle", { auto: true })));
  test("★ formation : RIEN à dire (c'est la règle qui joue, personne n'a rien à apprendre)",
    M.messageIdentifiants("gaelle", { auto: false, motif: M.MOTIF_FORMATION }) === "");
  // ⚠ RETOURNÉ le 29/09/2026 : un autre repli SE DIT toujours — mais AVANT
  // l'ouverture (`prevenir`), plus après. Après coup : rien.
  test("★ tout autre repli se dit AVANT (plus rien après coup)",
    M.messageIdentifiants("gaelle", { auto: false, motif: "Pas de connexion : le message ne peut pas partir du numéro BMI." }) === "");
  test("★ « livré » et « lu » ne s'écrivent jamais",
    !/livr|\blu\b/i.test(M.messageIdentifiants("x", { auto: true })));

  // UN SEUL CHEMIN : les écrans passent par src/whatsapp.js, jamais par
  // l'ouverture WhatsApp directe des identifiants.
  const ecransComptes = ["src/screens/Utilisateurs.jsx", "src/screens/Clients.jsx", "src/screens/Prospects.jsx", "src/screens/ClientsInstalles.jsx"];
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★★ src/whatsapp.js porte la fonction, et le repli est le TEXTE d'avant (lib/comptesClients)",
    /export async function envoyerIdentifiantsDuNumeroBmi/.test(srcWhatsapp)
    && /texteIdentifiantsEmploye\(/.test(srcWhatsapp) && /texteIdentifiantsClient\(/.test(srcWhatsapp)
    && /envoiIdentifiants\(/.test(srcWhatsapp));
  // 🔑 14/10/2026, « a » : `espace_portail` d'abord SANS repli, `espace` en
  // relais AVEC le repli d'avant ; le modèle parti suit la réponse.
  const corpsIdent = srcWhatsapp.slice(srcWhatsapp.indexOf("export async function envoyerIdentifiantsDuNumeroBmi"), srcWhatsapp.indexOf("export async function envoyerAccesSansRepli"));
  test("★★ « a » : MODELES_IDENTIFIANTS = espace_portail PUIS espace, les deux en service",
    M.MODELES_IDENTIFIANTS.join(",") === "espace_portail,espace"
    && M.MODELES_EN_SERVICE.includes("espace_portail") && M.MODELES_EN_SERVICE.includes("espace")
    && M.envoiIdentifiants({ nomAffiche: "a", identifiant: "A", motDePasse: "x", modele: "espace_portail" }).modele === "espace_portail"
    && M.envoiIdentifiants({ nomAffiche: "a", identifiant: "A", motDePasse: "x", modele: "devis_disponible" }).modele === "espace");
  test("★★ « a » : le premier part SANS repli, le relais AVEC le texte d'avant, et rien ne part deux fois",
    /const \[premier, relais\] = MODELES_IDENTIFIANTS;/.test(corpsIdent)
    && /modele: premier \}\);\s*const r1 = await envoyerModele\(\{[^}]*sansRepli: true \}\);\s*if \(r1\.auto\) return \{ \.\.\.r1, modele: a\.modele \};/.test(corpsIdent)
    && /const r2 = await envoyerModele\(\{[^}]*texteRepli, demanderConfirmation, prevenir \}\);/.test(corpsIdent));
  test("★★ la ligne d'accès range le modèle parti (son texte), `espace` d'office pour les lignes d'avant",
    /texte: texteEspaceMasque\(nom, envoi && envoi\.modele\),/.test(srcWhatsapp)
    && /modele: \(envoi && envoi\.modele\) \|\| "espace" \}/.test(srcWhatsapp));
  for (const f of ecransComptes) {
    const src = sansCommentaires(lire(f));
    // ⚠ CONTRÔLE RETOURNÉ LE 23/09/2026 (décision Timo) : un EMPLOYÉ ne passe
    // plus par le numéro BMI — WhatsApp s'ouvre sur le téléphone de
    // l'administrateur (envoyerIdentifiantsEmployeWhatsApp), et rien ne
    // s'écrit dans 📲 WhatsApp. Seuls les CLIENTS partent du numéro BMI.
    const appels = src.match(/envoyerIdentifiantsDuNumeroBmi\(\{[^}]*\}/g) || [];
    const employeIci = f === "src/screens/Utilisateurs.jsx";
    test(`★★ ${f} : les identifiants d'un CLIENT partent par envoyerIdentifiantsDuNumeroBmi, jamais par l'ouverture directe`,
      /envoyerIdentifiantsDuNumeroBmi\(\{/.test(src) && appels.every((a) => /role: "client"/.test(a))
      && !/envoyerIdentifiantsWhatsApp\(/.test(src)
      && (employeIci ? /envoyerIdentifiantsEmployeWhatsApp\(nomEmp, nomEmp, pwdEmp, roleEmp, telEmp, uConfirm\)/.test(src) : !/envoyerIdentifiantsEmployeWhatsApp\(/.test(src)));
    // 🔑 LA LIGNE DU FIL (23/09/2026) : après CHAQUE envoi d'un client, si le
    // message est PARTI du numéro BMI (r.auto), la ligne s'écrit par
    // save((etat) => …) — jamais depuis le `db` d'avant la création.
    const lignes = src.match(/if \(r && r\.auto\) save\(\(etat\) => \(\{ \.\.\.etat, messages: messagesAvecLigneAcces\(etat\.messages, \{ profile, client: \w+(, renvoi: true)?, envoi: r \}\) \}\)\);/g) || [];
    test(`★★ ${f} : chaque envoi d'un client écrit la ligne « accès envoyés » dans 📲 WhatsApp, seulement si le message est parti du numéro BMI, sur l'état COURANT (${lignes.length}/${appels.length})`,
      appels.length > 0 && lignes.length === appels.length && /import \{[^}]*messagesAvecLigneAcces[^}]*\} from "\.\.\/whatsapp"/.test(src));
    // LE MUR : l'espace du COMPTE (sa marque), jamais estCompteFormation(db, profile).
    test(`★★ ${f} : chaque envoi passe l'espace du COMPTE CRÉÉ (${appels.length} envoi(s))`,
      appels.length > 0 && appels.every((a) => /espaceFormation: (!!user\.formation|!!c\.formation|!!existant\.formation|!!ouvert\.formation|espaceCree === true)/.test(a)));
    // RETOURNÉ le 17/10/2026 : 👥 Utilisateurs ouvre la fiche FERMÉE d'un devis imprimé sans compte — l'espace de CETTE fiche (`ouvert`).
    // RETOURNÉ le 15/10/2026 : « Convertir » sur une fiche SANS ACCÈS (devis imprimé) lui ouvre son espace — l'espace de CETTE fiche (`existant`).
    test(`★ ${f} : chaque envoi porte un texte de repli (la fonction le construit) et la phrase de l'écran`,
      appels.length > 0 && (src.match(/messageIdentifiants\(/g) || []).length >= appels.length);
  }
  test("★ le texte d'avant existe toujours, mot pour mot (« je veux que les 2 existent », 21/09)",
    /export function envoyerIdentifiantsWhatsApp/.test(lire("src/lib/comptesClients.js"))
    && /export function envoyerIdentifiantsEmployeWhatsApp/.test(lire("src/lib/comptesClients.js"))
    && /🔑 Mot de passe : \*\$\{motDePasse\}\*/.test(lire("src/lib/comptesClients.js")));
  test("★ le parrainage part toujours du téléphone du PARRAIN (c'est voulu)",
    !/envoyerIdentifiantsDuNumeroBmi/.test(lire("src/lib/comptesClients.js")));
  test("★ « premierContact » n'est pas passé à cet envoi : c'est CE message qui porte les identifiants",
    !/envoyerIdentifiantsDuNumeroBmi[\s\S]{0,900}premierContact/.test(srcWhatsapp.slice(srcWhatsapp.indexOf("envoyerIdentifiantsDuNumeroBmi"))));
}

// ──────────────────────────────────────────────────────────────
titre("⑱ 📲 UN ENVOI PAR MODÈLE S'ÉCRIT DANS LA CONVERSATION, QUI REMONTE (23/09/2026)");
{
  // Timo : « pourquoi les discussions de relance n'apparaissent pas comme
  // discussion récente ?… elles ne remontent pas ». La conversation est
  // classée par son DERNIER message ; une relance n'en écrivait aucun.
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // LA RÈGLE PURE : une phrase en français par modèle, jamais un secret.
  const cas = {
    devis_disponible: ["ESSO", "solaire", "1 250 000 F"],
    relance_devis: ["ESSO", "solaire", "1 250 000 F", "15/09/2026"],
    devis_valide_paiement: ["ESSO", "1 250 000 F", "C-0012", "DEMAKPOE"],
    rappel_echeance: ["ESSO", "30/09/2026", "200 000 F", "600 000 F", "DEMAKPOE"],
    rappel_dette: ["ESSO", "01/09/2026", "80 000 F", "200 000 F"],
  };
  for (const [modele, v] of Object.entries(cas)) {
    const t = M.ligneEnvoiModele(modele, v);
    test(`★ « ${modele} » donne une ligne en français qui dit ce qui est parti, avec le préfixe du numéro BMI, tous les mots des trous, jamais « livré » ni « lu »`,
      t.startsWith(M.PREFIXE_LIGNE_ENVOI) && v.every((x) => t.includes(x)) && !/livr|\blu\b/i.test(t));
  }
  test("★★ le modèle `espace` (le seul qui porte un secret) n'a PAS de ligne ici : sa règle est celle des trous masqués",
    M.ligneEnvoiModele("espace", ["KOFFI", "KOFFI", "abc123"]) === "" && !M.MODELES_AVEC_LIGNE.includes("espace"));
  test("★ `prise_de_contact` n'en a pas non plus : l'écran écrit déjà son vrai texte",
    M.ligneEnvoiModele("prise_de_contact", ["ESSO", "TIMO", "la dette"]) === "" && !M.MODELES_AVEC_LIGNE.includes("prise_de_contact"));
  test("★ un modèle inconnu, un trou vide ou un nombre de trous faux → rien (on n'invente pas une phrase)",
    M.ligneEnvoiModele("inconnu", ["a"]) === "" && M.ligneEnvoiModele("rappel_dette", ["ESSO", "", "80 000 F", "200 000 F"]) === ""
    && M.ligneEnvoiModele("rappel_dette", ["ESSO", "01/09/2026", "80 000 F"]) === "");
  // ⚠ RETOURNÉ le 23/09/2026 : HUIT — le mot de fidélité (deux textes) et le
  // reçu de vente s'écrivent aussi dans le fil.
  // ⚠ RETOURNÉ le 25/09/2026 : dix — les reçus de versement et de réservation.
  // ⚠ RETOURNÉ le 25/09/2026 (soir) : onze — le reçu de vente détaillé.
  // ⚠ RETOURNÉ le 25/09/2026 (nuit) : treize — les deux bons.
  // ⚠ RETOURNÉ le 25/09/2026 : quatorze — le premier devis ; puis treize à nouveau, il a été retiré (refusé par Meta).
  // RETOURNÉ le 26/09/2026 : quatorze, avec la relance automatique.
  test("★ les modèles à ligne (RETOURNÉ le 22/10/2026 : + l'argent remis directement ; le 01/10/2026 : + PV, avenant, accueil et relance prospect ; le 30/09/2026 : + la proforma) : devis, relance automatique, dette, mot de fidélité, les quatre reçus, les deux bons, le rappel d'entretien, la demande d'avis (RETOURNÉ le 26/09/2026) — jamais espace ni prise_de_contact",
    M.MODELES_AVEC_LIGNE.slice().sort().join(",") === "accueil_prospect,affectation_chantier,anniversaire_employe,attestation_disponible,avancement_employe,avenant_reserves,bon_reprise,bon_retour,changement_affectation,commission_due,demande_avis,depense_rejetee,depense_validee,devis_disponible,devis_pdf,devis_valide_paiement,fonds_remis,installation_deplacee,installation_programmee,lien_signature_pv,loyer_disponible,mot_fidelite,mot_fidelite_simple,prime_installation_payee,proforma,proforma_pdf,rappel_dette,rappel_echeance,rappel_entretien,rappel_solde_pose,recu_depot_chantier,recu_pdf,recu_reglement,recu_reservation,recu_vente,recu_vente_detail,relance_devis,relance_devis_expiration,relance_prospect,rendez_vous_equipe,rendez_vous_modifie,tache_assignee,tache_validee,virement_salaire,virement_salaire_credit,visite_chef,visite_client"); /* RETOURNÉ le 19/10/2026 : + recu_pdf, proforma_pdf ; le 17/10/2026 : + devis_pdf ; le 14/10/2026 : + les deux avis d'une tâche, + l'attestation de fin de contrat ; le 13/10/2026 : + les deux avis de décision du DG sur une dépense, + l'avis au chef d'une visite (son rappel, serveur, n'écrit rien), + le reçu de dépôt chantier ; le 12/10/2026 au soir : + les trois avis de rendez-vous envoyés par l'écran (les deux rappels du serveur n'écrivent rien) ; le 12/10/2026 : + l'affectation et son changement (le rappel de la veille n'écrit rien) ; le 10/10/2026 : + le loyer disponible ; le 07/10/2026 : + la part d'installation payée ; le 03/10/2026 : + l'avis de salaire (avec et sans crédit), + la commission due, + les vœux d'anniversaire, + l'avancement */

  // LA VRAIE CHAÎNE : la ligne dans le fil, la conversation qui remonte,
  // le propriétaire qui ne bouge pas.
  const avant = monte(V.convsAvantEnvoi);
  const liste = monte(V.ligneEnvoi);
  const garnieTaille = Array.isArray(liste) ? liste.length - 1 : -1; // la ligne ajoutée ; la fiche légère est REMPLACÉE, pas empilée
  const apres = monte(V.convsApresEnvoi);
  const ligne = Array.isArray(liste) ? liste.find((x) => x && x.wa_modele === "relance_devis") : null;
  test("★★ la ligne est une ligne de conversation WhatsApp SORTANTE (canal, clé du numéro, modèle, devis lié, auteur), jamais un entrant",
    !!ligne && ligne.canal === "whatsapp" && ligne.wa_tel === "90114455" && ligne.devis_id === "DV1" && ligne.de_id === "KOSSI"
    && !ligne.wa_entrant && ligne.texte.includes("1 250 000 F") && ligne.texte.startsWith("📲 Envoyé du numéro BMI"));
  test("★★ AVANT l'envoi, la conversation d'AYOKO n'était pas en tête ; APRÈS, elle l'est (elle REMONTE)",
    Array.isArray(avant) && Array.isArray(apres) && avant[0]?.cle !== "90114455" && apres[0]?.cle === "90114455");
  test("★★ la conversation reste CONFIÉE à COM1 : l'envoi ne change jamais le propriétaire (seul « 🔁 Confier » le fait)",
    Array.isArray(apres) && apres.find((c) => c.cle === "90114455")?.proprietaire_id === "COM1"
    && (liste.find((x) => x && x.id === "waent_90114455") || {}).proprietaire_id === "COM1");
  test("★ la ligne n'ouvre pas la fenêtre de 24 h et ne compte pas comme non lu",
    Array.isArray(apres) && apres.find((c) => c.cle === "90114455")?.fenetre?.ouverte === false
    && apres.find((c) => c.cle === "90114455")?.nonLus === 0);
  test("★ sans numéro, rien ne s'écrit et la liste revient telle quelle",
    Array.isArray(monte(V.ligneEnvoiSansTel)) && monte(V.ligneEnvoiSansTel).length === garnieTaille);

  // LES TROIS ÉCRANS : chaque envoi par modèle qui a réussi (r.auto) écrit
  // la ligne, sur l'état COURANT, par la fonction commune.
  const ecrans = [
    ["src/screens/TousLesDevis.jsx", "devis_id: d.id", "../whatsapp"],
    ["src/screens/Dettes.jsx", "dette_id: d.id", "../whatsapp"],
    ["src/screens/dimensionnement/Partages.jsx", "devis_id: idDevis", "../../whatsapp"],
  ];
  for (const [f, ref, chemin] of ecrans) {
    const src = sansComm(lire(f));
    // ⚠ RETOURNÉ le 25/09/2026 : l'envoi d'`espace` avant le premier devis
    // (Partages) écrit SA ligne, masquée, par messagesAvecLigneAcces — il
    // n'est pas compté ici (contrôlé en ㉚).
    const envois = (src.match(/await envoyerModele\(\{/g) || []).length - (src.match(/await envoyerModele\(\{\s*tel: telClient, modele: acces\.modele/g) || []).length
      // ⚠ RETOURNÉ le 17/10/2026 : l'essai du PDF (envoyerPdfDuDevis) n'écrit pas la ligne lui-même — c'est l'appelant qui l'écrit, avec le modèle réellement parti.
      - (src.match(/await envoyerModele\(\{ tel, modele: envoiPdf\.modele/g) || []).length;
    const lignes = (src.match(/messages: r\.auto \? messagesAvecLigneEnvoi\(etat\.messages, \{ profile, tel: [^}]*modele: envoi\.modele, variables: envoi\.variables, ref: \{ [a-z_]+: [\w.]+ \}, envoi: r \}\) : etat\.messages/g) || []);
    test(`★★ ${f} : chaque envoi par modèle écrit la ligne dans 📲 WhatsApp si le message est parti du numéro BMI, par save((etat) => …) (${lignes.length}/${envois})`,
      envois > 0 && lignes.length === envois && lignes.every((l) => l.includes(ref))
      // ⚠ RETOURNÉ le 25/09/2026 : l'import peut porter d'autres noms (le reçu automatique).
      && new RegExp(`messagesAvecLigneEnvoi[^}]*\\} from "${chemin.replace(/\./g, "\\.")}"`).test(src)
      && /save\(\(etat\) => \(\{\s*\.\.\.etat,/.test(src));
  }
  test("★★ src/whatsapp.js porte la fonction, écrite UNE fois, qui passe par la règle pure et garde le propriétaire de la fiche légère",
    /export function messagesAvecLigneEnvoi/.test(srcWhatsapp) && /ligneEnvoiModele\(modele, variables\)/.test(srcWhatsapp)
    && (srcWhatsapp.match(/entete\.proprietaire_id/g) || []).length >= 3
    && /proprietaire_id: prop\.proprietaire_id \|\| entete\.proprietaire_id/.test(srcWhatsapp));
  test("★ 📲 WhatsApp dessine cette ligne comme les autres (texteDuFil rend m.texte quand il n'y a pas d'accès à remplir)",
    /if \(!m \|\| !m\.wa_acces\) return m \? m\.texte : "";/.test(sansComm(lire("src/screens/Whatsapp.jsx"))));
}

// ──────────────────────────────────────────────────────────────
titre("⑲ 💙 LE MOT DE FIDÉLITÉ DEPUIS 📋 CLIENTS, ET 🧾 LE REÇU AUTOMATIQUE À L'ENCAISSEMENT (23/09/2026)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} F`;
  // LES TEXTES DE TIMO, mot pour mot.
  test("★★ le mot de fidélité (compte) est le texte de Timo : Bonjour {{1}}, la confiance, les quatre métiers, les deux sites, les DEUX numéros BMI, la signature",
    M.TEXTE_FIDELITE.startsWith("Bonjour {{1}},\n🙏 Merci pour votre confiance !")
    && M.TEXTE_FIDELITE.includes("énergie solaire, automatisation de garage, ventilation et domotique industrielle.")
    && M.TEXTE_FIDELITE.includes("🌐 Découvrez nos services :\nbmitogo.com\n📋 Votre espace client :\ngestion.bmitogo.com\n📞 +228 99 96 84 88 / +228 91 13 05 11\nBMI TOGO — Les bâtiments modernes et intelligents\n💙💚 Merci de faire partie de nos clients !")
    && !M.TEXTE_FIDELITE.endsWith("\n") && !/  /.test(M.TEXTE_FIDELITE) && !/votre achat/.test(M.TEXTE_FIDELITE));
  test("★★ la version SIMPLE est la même SANS les deux lignes de l'espace client (un client sans compte n'a pas d'espace)",
    M.TEXTE_FIDELITE_SIMPLE === M.TEXTE_FIDELITE.replace("📋 Votre espace client :\ngestion.bmitogo.com\n", "")
    && !M.TEXTE_FIDELITE_SIMPLE.includes("gestion.bmitogo.com"));
  test("★ le modèle suit le compte : avec compte → mot_fidelite, sans → mot_fidelite_simple ; un seul trou, le nom (« cher client » à défaut)",
    M.envoiMotFidelite({ nom: "ESSO", avecCompte: true }).modele === "mot_fidelite"
    && M.envoiMotFidelite({ nom: "ESSO", avecCompte: false }).modele === "mot_fidelite_simple"
    && M.envoiMotFidelite({ nom: "ESSO", avecCompte: true }).variables.join() === "ESSO"
    && M.envoiMotFidelite({ nom: "", avecCompte: false }).variables.join() === "cher client");
  test("★ le repli est le texte du modèle choisi, mot pour mot, le trou rempli",
    M.texteMotFidelite({ nom: "ESSO", avecCompte: true }) === M.TEXTE_FIDELITE.replace("{{1}}", "ESSO")
    && M.texteMotFidelite({ nom: "ESSO", avecCompte: false }) === M.TEXTE_FIDELITE_SIMPLE.replace("{{1}}", "ESSO"));
  test("★★ le reçu de vente est le texte de Timo : sept trous, « veuillez contacter », le site en dernière ligne, rien après",
    M.TEXTE_RECU_VENTE === "Bonjour {{1}},\nMerci pour votre achat du {{2}} à {{3}}.\nReçu N° {{4}} : {{5}}, {{6}}.\nPour toute question veuillez contacter : {{7}}.\nMerci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents\nwww.bmitogo.com");
  test("★ les catégories : le mot de fidélité est MARKETING (il fait de la promotion), le reçu UTILITY (une transaction)",
    M.MODELES.mot_fidelite.categorie === "marketing" && M.MODELES.mot_fidelite_simple.categorie === "marketing" && M.MODELES.recu_vente.categorie === "utility"
    && M.MODELES_EN_SERVICE.includes("mot_fidelite") && M.MODELES_EN_SERVICE.includes("mot_fidelite_simple") && M.MODELES_EN_SERVICE.includes("recu_vente"));
  // LA FORMULE DU PAIEMENT : « payé par Espèces » se lisait mal.
  test("★★ la formule du trou 6 : espèces, Flooz, Mixx, virement, crédit avec ou sans avance",
    M.formulePaiement({ paiement: "Espèces" }) === "payé en espèces"
    && M.formulePaiement({ paiement: "Mobile Money (Flooz)" }) === "payé par Mobile Money (Flooz)"
    && M.formulePaiement({ paiement: "Mobile Money (Mixx)" }) === "payé par Mobile Money (Mixx)"
    && M.formulePaiement({ paiement: "Virement bancaire" }) === "payé par virement bancaire"
    && M.formulePaiement({ paiement: "Crédit (dette)", avance: 50000, reste: 110000, fmt }) === `à crédit : avance ${fmt(50000)}, reste ${fmt(110000)}`
    && M.formulePaiement({ paiement: "Crédit (dette)", avance: 0, reste: 160000, fmt }) === `à crédit : reste ${fmt(160000)}`);
  // ⚠ RETOURNÉ le 25/09/2026 : la vente d'essai portait un champ `total`
  // qu'AUCUNE vraie vente ne porte — le contrôle passait pendant que chaque
  // client recevait « 0 F » (capture Timo, EZO ENERGY, 18 000 F). La vente
  // d'essai est maintenant une vraie vente (des `articles`), et le montant
  // vient de LA formule de la caisse, comme à l'écran.
  const { montantEncaisseVente } = await import("../src/lib/versements.js");
  const { totalVente } = await import("../src/lib/core.js");
  const vente = { id: "V1", tel: "90112233", client: "ESSO", date: "2026-09-23", boutique: "BMI DEMAKPOE", numero: "DEM-0142", paiement: "Espèces", articles: [{ article: "Batterie", qte: 1, pu: 150000 }], frais_transport: 10000 };
  const montantV = montantEncaisseVente(vente, totalVente);
  const e = M.envoiRecuVente({ vente, boutique: { tel: "+228 91 13 05 11" }, montant: montantV, fmt, dFR });
  const ezo = { id: "V2", tel: "99770055", client: "EZO ENERGY DU TOGO", date: "2026-09-25", boutique: "BMI DEMAKPOE", numero: "BMID-2026-0028", paiement: "Espèces", articles: [{ article: "Étrier du milieu", qte: 20, pu: 600 }, { article: "Étrier final", qte: 10, pu: 600 }] };
  test("★★ LE CAS DE TIMO : la vente d'EZO à 18 000 F écrit 18 000 F dans le reçu, jamais « 0 F »",
    M.envoiRecuVente({ vente: ezo, boutique: {}, montant: montantEncaisseVente(ezo, totalVente), fmt, dFR }).variables[4] === fmt(18000));
  test("★★ sans montant donné par l'écran, AUCUN reçu ne part (jamais un « 0 F » inventé)",
    M.envoiRecuVente({ vente: ezo, boutique: {}, fmt, dFR }) === null
    && !/vente\.total/.test(M.envoiRecuVente.toString()));
  // RETOURNÉ le 26/09/2026 : la fabrique des deux reçus a quitté 💰 Ventes pour
  // lib/lignesPrivees.js (📲 WhatsApp la relit pour recomposer le détail) —
  // la formule du montant est la même, lue au même endroit pour les deux.
  // RETOURNÉ le 19/10/2026 : elle vit dans lib/recuDeVente.js (le serveur la
  // relit pour relayer un `recu_pdf` refusé) ; lignesPrivees la réexporte.
  test("★★ le reçu passe le montant de LA formule de la caisse (articles − remises + frais), par LA fabrique commune que 💰 Ventes appelle",
    /const montant = montantEncaisseVente\(vente, totalVente\);/.test(lire("src/lib/recuDeVente.js"))
    && /import \{ montantEncaisseVente \} from "\.\/versements\.js";/.test(lire("src/lib/recuDeVente.js"))
    && /import \{ envoisRecuDeVente \} from "\.\/recuDeVente";/.test(lire("src/lib/lignesPrivees.js")) && /export \{ envoisRecuDeVente \};/.test(lire("src/lib/lignesPrivees.js"))
    && /const envois = envoisRecuDeVente\(vente, \{ boutique: bq, dette: dette \|\| \{ paye: 0, montant: 0 \} \}\);/.test(lire("src/screens/Ventes.jsx")));
  test("★★ les sept trous viennent de la vente : nom, date, boutique, reçu, montant, formule, TÉLÉPHONE DE LA BOUTIQUE",
    e && e.modele === "recu_vente" && e.variables.join("|") === `ESSO|23/09/2026|BMI DEMAKPOE|DEM-0142|${fmt(160000)}|payé en espèces|+228 91 13 05 11`);
  test("★★ une boutique sans téléphone → le numéro BMI principal (Meta refuse un trou vide), jamais un trou vide",
    M.envoiRecuVente({ vente, boutique: {}, montant: montantV, fmt, dFR }).variables[6] === M.NUMERO_BMI_PRINCIPAL
    && M.critiqueModele("recu_vente", M.envoiRecuVente({ vente, boutique: {}, montant: montantV, fmt, dFR }).variables) === "");
  test("★ « Client non renseigné » ou sans nom → « cher client » ; SANS numéro → null (rien à envoyer, pas une panne)",
    M.envoiRecuVente({ vente: { ...vente, client: "Client non renseigné" }, boutique: {}, montant: montantV, fmt, dFR }).variables[0] === "cher client"
    && M.envoiRecuVente({ vente: { ...vente, tel: "" }, boutique: {}, montant: montantV, fmt, dFR }) === null);
  test("★ le texte lisible du reçu remplit les sept trous, dans l'ordre",
    M.texteRecuVente(e) === `Bonjour ESSO,\nMerci pour votre achat du 23/09/2026 à BMI DEMAKPOE.\nReçu N° DEM-0142 : ${fmt(160000)}, payé en espèces.\nPour toute question veuillez contacter : +228 91 13 05 11.\nMerci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents\nwww.bmitogo.com`);
  test("★ les trois modèles ont leur ligne dans le fil, sans secret, jamais « livré » ni « lu »",
    /Mot de fidélité envoyé à ESSO/.test(M.ligneEnvoiModele("mot_fidelite", ["ESSO"])) && /Mot de fidélité envoyé à ESSO/.test(M.ligneEnvoiModele("mot_fidelite_simple", ["ESSO"]))
    && /Reçu N° DEM-0142 envoyé à ESSO/.test(M.ligneEnvoiModele("recu_vente", e.variables)) && !/livr|\blu\b/i.test(M.ligneEnvoiModele("recu_vente", e.variables)));

  // LA VRAIE CHAÎNE : à qui va la conversation.
  const libre = monte(V.convsFideliteLibre), confiee = monte(V.convsFideliteConfiee), recu = monte(V.convsRecu);
  const conv = (l, cle) => (Array.isArray(l) ? l.find((c) => c.cle === cle) : null);
  test("★★ le mot de fidélité DONNE la conversation à celui qui l'envoie quand elle n'est à personne (ESSO, support → KOSSI)",
    conv(libre, "90112233")?.proprietaire_id === "KOSSI" && conv(libre, "90112233")?.fil?.some((m) => m.wa_modele === "mot_fidelite" && m.proprietaire_id === "KOSSI"));
  test("★★ …mais ne PREND JAMAIS une conversation déjà confiée à un collègue (AYOKO reste à COM1)",
    conv(confiee, "90114455")?.proprietaire_id === "COM1");
  test("★★ le reçu de vente n'en donne aucune : ESSO reste au support, la ligne porte la vente",
    conv(recu, "90112233")?.proprietaire_id === "" && conv(recu, "90112233")?.fil?.some((m) => m.wa_modele === "recu_vente" && m.vente_id === "V1" && !m.proprietaire_id));
  test("★ dans les trois cas la conversation remonte en tête",
    libre[0]?.cle === "90112233" && confiee[0]?.cle === "90114455" && recu[0]?.cle === "90112233");

  // 📋 CLIENTS : le bouton, la question, le compte, le mur, le repli, la ligne.
  const cli = sansComm(lire("src/screens/Clients.jsx"));
  const corps = (cli.match(/const contacter = async \(c\) => \{[\s\S]*?\n  \};/) || [""])[0];
  test("★★ 📋 Clients : le bouton WhatsApp envoie le mot de fidélité du numéro BMI, après UNE question, le modèle choisi selon le compte (comptesAvecCeNumero, jamais db.users), l'espace de la BOUTIQUE regardée",
    corps.length > 0 && /await uConfirm\(`Envoyer le mot de fidélité à \$\{nom\} du numéro BMI \?`\)/.test(corps)
    // RETOURNÉ le 15/10/2026 : une fiche SANS ACCÈS (devis imprimé) reçoit le mot sans les lignes de l'espace.
    && /comptesAvecCeNumero\(db, profile, c\.tel\)\.find\(\(u\) => u\.role === "client" && !estSansAcces\(u\)\)/.test(corps)
    && /envoiMotFidelite\(\{ nom, avecCompte: !!compte \}\)/.test(corps)
    && /espaceFormation: !!bqRegardee\.formation/.test(corps) && !/estCompteFormation\(db, profile\)/.test(corps)
    && /texteRepli: texteMotFidelite\(\{ nom, avecCompte: !!compte \}\)/.test(corps) && /demanderConfirmation: uConfirm/.test(corps)
    && !/db\.users/.test(corps));
  test("★★ 📋 Clients : la ligne s'écrit sur l'état COURANT, seulement si parti du numéro BMI, et DONNE la conversation (donnerAuSender) ; le repli se dit",
    /if \(!r\.auto\) return;/.test(corps) && /save\(\(etat\) => \(\{\s*\.\.\.etat,\s*messages: messagesAvecLigneEnvoi\(etat\.messages, \{ profile, tel: c\.tel, nom, modele: envoi\.modele, variables: envoi\.variables, donnerAuSender: true, envoi: r \}\)/.test(corps)
    && /prevenir: uAlert/.test(corps) && !/uAlert\(messageRepli/.test(corps)
    && /<M\.Clients db=\{db\} save=\{save\} profile=\{profile\} \/>/.test(lire("src/App.jsx")));
  // 💰 VENTES : automatique, sans question, sans repli, le mur, la ligne sans propriétaire.
  const ven = sansComm(lire("src/screens/Ventes.jsx"));
  // ⚠ RETOURNÉ le 25/09/2026 (soir) : l'envoi vit dans UNE fonction,
  // `envoyerRecuDuNumeroBmi`, partagée par l'encaissement et le bouton de la
  // ligne ; le reçu DÉTAILLÉ est tenté d'abord, le court ensuite.
  const auto = (ven.match(/const envoyerRecuAutomatique = async \(vente, apres\) => \{[\s\S]*?\n  \};/) || [""])[0];
  const commun = (ven.match(/const envoyerRecuDuNumeroBmi = async \(vente, etat\) => \{[\s\S]*?\n  \};/) || [""])[0];
  test("★★ 💰 Ventes : le reçu part tout seul après l'encaissement (appelé après l'impression du reçu), SANS question, SANS repli (sansRepli), l'espace de la BOUTIQUE qui a vendu",
    auto.length > 0 && commun.length > 0 && /envoyerRecuAutomatique\(vente, next\);/.test(ven)
    && /envoyerRecuDuNumeroBmi\(vente, apres\)/.test(auto)
    && /sansRepli: true/.test(commun) && !/demanderConfirmation/.test(commun + auto) && !/uConfirm/.test(commun + auto) && !/envoyerWhatsApp\(/.test(commun + auto)
    && /espaceFormation: !!bq\.formation/.test(commun) && !/estCompteFormation/.test(commun)
    && /envoisRecuDeVente\(vente, \{ boutique: bq,/.test(commun) && /envoiRecuVente\(base\)/.test(lire("src/lib/recuDeVente.js")));
  test("★★ 💰 Ventes : à crédit, l'avance et le reste viennent de la DETTE née de la vente ; la ligne s'écrit sur l'état courant, porte la vente et ne donne PAS la conversation",
    /\(etat\.dettes \|\| \[\]\)\.find\(\(d\) => d\.vente_id === vente\.id\)/.test(commun)
    && /save\(\(e\) => \(\{\s*\.\.\.e,\s*messages: messagesAvecLigneEnvoi\(e\.messages, \{ profile, tel: vente\.tel, nom: vente\.client, modele: envoi\.modele, variables: envoi\.variables, ref: \{ vente_id: vente\.id \}, envoi: r \}\)/.test(commun)
    && !/donnerAuSender/.test(commun));
  test("★ 💰 Ventes : ce qui s'est passé se lit sous le titre, discrètement (jamais une fenêtre) ; sans numéro ou en formation, rien",
    /setNoteRecuWa\(r\.motif && !motifAttendu\(r\.motif\) \?/.test(auto) && !/uAlert\(/.test(auto + commun)
    && /data-recu-whatsapp/.test(ven));
  test("★ src/whatsapp.js : `sansRepli` n'ouvre jamais WhatsApp, `donnerAuSender` ne donne qu'une conversation LIBRE",
    // ⚠ RETOURNÉ le 29/09/2026 : `sansRepli` sort AVANT toute ouverture.
    /if \(sansRepli\) return \{ auto: false, motif, annonce: false, parti: false, reseau \};/.test(srcWhatsapp)
    && /const libre = !entete\.proprietaire_id \|\| entete\.proprietaire_id === profile\?\.id;/.test(srcWhatsapp)
    && /donnerAuSender && libre && profile\?\.id/.test(srcWhatsapp));
  test("★ ⚙ Paramètres : une boutique sans téléphone est signalée (le reçu indiquerait le numéro BMI principal), et le texte réglable du mot de fidélité n'y est plus (RETOURNÉ le 25/09/2026, décision « a » : la phrase vit chez Meta)",
    /Sans téléphone : le reçu WhatsApp automatique indiquera le numéro BMI principal/.test(lire("src/screens/Parametres.jsx"))
    && !/data-reglage="message-fidelite"/.test(lire("src/screens/Parametres.jsx")));
  {
    const u = lire("src/screens/Utilisateurs.jsx");
    const i = u.indexOf("const envoyerFidelite = async");
    const corps = u.slice(i, u.indexOf("\n  };", i));
    test("★ 👥 Utilisateurs passe par envoyerModele (mot_fidelite du numéro BMI), jamais un texte ouvert sur l'ordinateur d'office",
      i > 0 && /await envoyerModele\(\{/.test(corps) && /modele: envoi\.modele/.test(corps)
      && M.envoiMotFidelite({ nom: "AYOKO", avecCompte: true }).modele === "mot_fidelite");
  }
}

// ──────────────────────────────────────────────────────────────
titre("⑳ 🤖 L'ASSISTANT DU NUMÉRO WHATSAPP BMI (24/09/2026, « Lance »)");
// Timo a écrit lui-même les lignes du menu, ce que l'assistant a le droit
// de dire, et le message d'accueil. Ce qui est protégé ici : ses mots, le
// silence du robot quand une personne parle, jamais une dette, jamais une
// quantité, jamais une invention, le mur, et « rien n'est écrit tant que le
// message n'est pas parti ».
{
  const A = await import("../src/lib/assistantWhatsapp.js");
  const codeA = lire("src/lib/assistantWhatsapp.js").replace(/\/\/[^\n]*/g, "");
  // ⚠ Les commentaires partent avant de chercher un mot — mais PAS avant de
  // chercher l'adresse : « https:// » ressemble à un commentaire.
  const ycloudBrut = lire("api/_ycloud.js");
  const ycloud = ycloudBrut.replace(/\/\/[^\n]*/g, "");
  const entrantA = lire("api/whatsapp-entrant.js").replace(/\/\/[^\n]*/g, "");
  const ecranA = lire("src/screens/Whatsapp.jsx").replace(/\/\/[^\n]*/g, "");
  const param = lire("src/screens/Parametres.jsx");
  const il = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const entrant = (texte, h = 0, extra = {}) => ({ id: `e${h}`, canal: "whatsapp", wa_tel: "90112233", wa_entrant: true, ts: il(h), texte, ...extra });
  const humain = (h) => ({ id: `h${h}`, canal: "whatsapp", wa_tel: "90112233", ts: il(h), texte: "Bonjour, je vous réponds", de_id: "KOSSI", de_nom: "KOSSI" });
  const robot = (etape, h, memoire) => A.ligneAssistant({ cle: "90112233", tel: "+22890112233", nom: "", texte: "…", etape, ts: il(h), memoire });

  // ── SES MOTS
  test("★★ le message d'accueil est celui de Timo, mot pour mot (les 8 lignes, la consigne, la signature)",
    A.TEXTE_ACCUEIL.startsWith("👋 Bonjour et bienvenue chez BMI TOGO !")
    && A.TEXTE_ACCUEIL.includes("Je suis l'assistant virtuel de BMI TOGO. Je peux vous aider à trouver un produit, connaître son prix, vérifier sa disponibilité, demander un devis ou obtenir une assistance.")
    && ["1️⃣ Énergie solaire", "2️⃣ Automatisation de garage", "3️⃣ Domotique & automatisation", "4️⃣ VMC & ventilation", "5️⃣ Produits & équipements", "6️⃣ Demander un devis", "7️⃣ SAV & assistance technique", "8️⃣ Parler à un conseiller"].every((l) => A.TEXTE_ACCUEIL.includes(l))
    && A.TEXTE_ACCUEIL.includes("👉 Répondez simplement avec le numéro correspondant à votre demande.")
    && A.TEXTE_ACCUEIL.trimEnd().endsWith("BMI TOGO — Les bâtiments modernes et intelligents"));
  test("★ les huit lignes du menu, dans son ordre, avec ses mots",
    A.LIGNES_MENU.length === 8 && A.LIGNES_MENU.every((l, i) => l.n === i + 1)
    && A.LIGNES_MENU.map((l) => l.id).join(",") === "solaire,garage,domotique,vmc,produits,devis,sav,conseiller"
    && A.LIGNES_MENU[0].detail === "panneaux, onduleurs, batteries et installations"
    && A.LIGNES_MENU[1].detail === "moteurs, portes, portails et accessoires"
    && A.LIGNES_MENU[2].detail === "solutions pour bâtiments intelligents"
    && A.LIGNES_MENU[4].detail === "prix, disponibilité et caractéristiques");
  test("★ garage, domotique, VMC sont PRÉSENTÉS (pas des métiers de l'application : rien n'est cherché dans la base pour eux)",
    A.LIGNES_MENU.slice(0, 4).every((l) => l.activite) && A.LIGNES_MENU.slice(4).every((l) => !l.activite));

  // ── CE QUE LE CLIENT TAPE
  test("★ un chiffre seul est un choix (avec ou sans son emoji), « menu » et « 0 » ramènent à l'accueil, le reste est du texte",
    A.interpreterEntree("5").chiffre === 5 && A.interpreterEntree("5️⃣").chiffre === 5 && A.interpreterEntree(" 8. ").chiffre === 8
    && A.interpreterEntree("Menu").menu && A.interpreterEntree("0").menu
    && A.interpreterEntree("bonjour 5").chiffre === null && A.interpreterEntree("9").chiffre === null
    && A.interpreterEntree("").vide);

  // ── QUAND IL RÉPOND, QUAND IL SE TAIT
  test("★ une conversation neuve : il accueille", A.decisionAssistant({ fil: [entrant("bonjour")] }).repondre === true && A.decisionAssistant({ fil: [entrant("bonjour")] }).etape === null);
  test("★★ coupé dans ⚙ Paramètres : silence", A.decisionAssistant({ fil: [entrant("bonjour")], actif: false }).repondre === false);
  test("★★ une conversation CONFIÉE à quelqu'un n'a pas d'assistant (c'est à cette personne que le client parle)",
    A.decisionAssistant({ fil: [entrant("bonjour")], proprietaireId: "COM1" }).repondre === false);
  test("★★ un EMPLOYÉ a répondu il y a moins de 24 h : silence — passé 24 h, nouvelle conversation, il accueille",
    A.decisionAssistant({ fil: [entrant("prix ?", 3), humain(2), entrant("merci", 0)] }).repondre === false
    && A.decisionAssistant({ fil: [entrant("prix ?", 30), humain(26), entrant("re-bonjour", 0)] }).repondre === true
    && A.decisionAssistant({ fil: [entrant("prix ?", 30), humain(26), entrant("re-bonjour", 0)] }).etape === null);
  test("★★ un MODÈLE parti de l'application (relance, accès) compte comme une personne : silence",
    A.decisionAssistant({ fil: [{ id: "m", canal: "whatsapp", wa_tel: "90112233", ts: il(1), texte: "📲 Envoyé du numéro BMI — …", wa_modele: "relance_devis" }, entrant("ok", 0)] }).repondre === false);
  test("★ après « conseiller » : silence, sauf si le client redemande le menu",
    A.decisionAssistant({ fil: [entrant("8", 1), robot(A.ETAPE_CONSEILLER, 1), entrant("j'attends", 0)] }).repondre === false
    && A.decisionAssistant({ fil: [entrant("8", 1), robot(A.ETAPE_CONSEILLER, 1), entrant("menu", 0)] }).repondre === true);
  test("★ il reprend à l'étape où il en était, avec sa mémoire",
    A.decisionAssistant({ fil: [entrant("6", 1), robot(A.ETAPE_DEVIS_NOM, 1, { besoin: "3 clims" }), entrant("KOFFI", 0)] }).etape === A.ETAPE_DEVIS_NOM
    && A.decisionAssistant({ fil: [entrant("6", 1), robot(A.ETAPE_DEVIS_NOM, 1, { besoin: "3 clims" }), entrant("KOFFI", 0)] }).memoire.besoin === "3 clims");
  test("★ une ligne système (confier, rendre à tous) n'est pas « un mot de BMI »",
    A.decisionAssistant({ fil: [entrant("bonjour", 2), { id: "s", canal: "whatsapp", wa_tel: "90112233", ts: il(1), wa_systeme: true, texte: "rendue à tous" }, entrant("re", 0)] }).repondre === true);

  // ── CE QU'IL DIT
  // ⚠ RETOURNÉ le 24/09/2026 : un premier message SANS mot du menu → l'accueil ;
  // avec un mot du menu (« prix ») → sa ligne, sans passer par l'accueil.
  const r0 = A.reponseAssistant({ etape: null, texte: "Bonjour, comment allez-vous" });
  test("★ premier message sans mot du menu → l'accueil, et on attend un chiffre ; « je veux un prix » → la ligne produits",
    r0.texte === A.TEXTE_ACCUEIL && r0.etape === A.ETAPE_MENU
    && A.reponseAssistant({ etape: null, texte: "Bonjour, je veux un prix" }).etape === A.ETAPE_PRODUIT);
  const choix = (n) => A.reponseAssistant({ etape: A.ETAPE_MENU, texte: String(n) });
  test("★ 1 à 4 présentent l'activité dans ses mots et proposent 5, 6, 8",
    [1, 2, 3, 4].every((n) => choix(n).etape === A.ETAPE_MENU && choix(n).texte.includes(A.LIGNES_MENU[n - 1].titre) && /5️⃣[\s\S]*6️⃣[\s\S]*8️⃣/.test(choix(n).texte))
    && choix(1).texte.includes("panneaux, onduleurs, batteries et installations"));
  test("★ 5 demande le nom d'un produit, 6 le besoin, 7 et 8 passent la main",
    choix(5).etape === A.ETAPE_PRODUIT && choix(6).etape === A.ETAPE_DEVIS_BESOIN
    && choix(7).etape === A.ETAPE_CONSEILLER && choix(7).conseiller && choix(8).etape === A.ETAPE_CONSEILLER && choix(8).conseiller);
  test("★ un texte qu'il ne comprend pas : il le DIT et redonne le menu court, sans changer d'étape",
    A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "blabla" }).texte.includes("Je n'ai pas compris") && A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "blabla" }).etape === A.ETAPE_MENU);
  test("★ une photo sans un mot : une personne regarde (conseiller)",
    A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "", media: { type: "image" } }).conseiller === true
    && A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "" }) === null);
  test("★ un chiffre à n'importe quelle étape est un choix du menu", A.reponseAssistant({ etape: A.ETAPE_PRODUIT, texte: "8" }).conseiller === true);

  // ── LES ARTICLES : le mur, jamais la quantité
  const boutiquesA = [{ nom: "DEMAKPOE" }, { nom: "ECOLE", formation: true }];
  const produitsA = [
    { id: "p1", nom: "Panneau solaire 400 W", categorie: "Panneaux", boutique: "DEMAKPOE", prix_vente: 85000, initial: 10, entrees: 2 },
    { id: "p2", nom: "Batterie lithium 5 kWh", categorie: "Batteries", boutique: "DEMAKPOE", prix_vente: 900000, initial: 1, tension: "48 V" },
    { id: "p3", nom: "Panneau solaire 400 W", categorie: "Panneaux", boutique: "ECOLE", prix_vente: 1, initial: 99 },
  ];
  const ventesA = [{ id: "v1", articles: [{ produit_id: "p2", qte: 1 }, { produit_id: "p1", qte: 3 }] }, { id: "v2", produit_id: "p1", qte: 2 }];
  const ajustementsA = [{ produit_id: "p1", qte: -1 }];
  const articles = A.articlesPourAssistant({ produits: produitsA, boutiques: boutiquesA, ventes: ventesA, ajustements: ajustementsA });
  test("★★ LE MUR : un article d'une boutique de FORMATION n'est jamais cité",
    articles.length === 2 && articles.every((a) => a.boutique === "DEMAKPOE"));
  // ⚠ RETOURNÉ le 01/10/2026 : + le métier (et la fiche quand elle est renseignée — contrôlée en ㊸).
  test("★★ un article cité ne porte QUE nom, catégorie, métier, boutique, prix, disponible (oui/non), tension, description — JAMAIS une quantité",
    articles.every((a) => Object.keys(a).sort().join(",") === "boutique,categorie,description,disponible,metier,nom,prix,tension")
    && articles.find((a) => a.nom.startsWith("Panneau")).disponible === true
    && articles.find((a) => a.nom.startsWith("Batterie")).disponible === false);
  test("★ le stock se calcule comme lib/calculs.js : initial + entrées − vendu + ajustements (10 + 2 − 5 − 1 = 6 ; 1 − 1 = 0)",
    A.stockDepuisLignes(produitsA[0], ventesA, ajustementsA) === 6 && A.stockDepuisLignes(produitsA[1], ventesA, ajustementsA) === 0);
  const rP = A.reponseAssistant({ etape: A.ETAPE_PRODUIT, texte: "panneau 400", articles });
  test("★ « panneau 400 » → le prix, « disponible », la boutique — par LA règle commune de recherche",
    rP.trouves === 1 && rP.texte.includes("Panneau solaire 400 W") && rP.texte.includes("85 000 F") && rP.texte.includes("disponible (DEMAKPOE)") && rP.etape === A.ETAPE_PRODUIT);
  test("★ « batterie » → « sur commande » (plus rien en stock), avec sa tension",
    A.reponseAssistant({ etape: A.ETAPE_PRODUIT, texte: "batterie", articles }).texte.includes("Batterie lithium 5 kWh (48 V) — 900 000 F — sur commande"));
  test("★ un article introuvable : il le DIT et propose un conseiller, il n'invente rien",
    A.reponseAssistant({ etape: A.ETAPE_PRODUIT, texte: "tondeuse", articles }).texte.startsWith("Je ne trouve pas « tondeuse »") && A.reponseAssistant({ etape: A.ETAPE_PRODUIT, texte: "tondeuse", articles }).texte.includes("« conseiller » (ou 8)"));
  test("★ au plus 6 articles cités, les disponibles d'abord",
    A.chercherArticles(Array.from({ length: 9 }, (_, i) => ({ nom: `Câble ${i}`, categorie: "", boutique: "D", prix: 1, disponible: i % 2 === 0 })), "cable").length === 6
    && A.chercherArticles(Array.from({ length: 9 }, (_, i) => ({ nom: `Câble ${i}`, categorie: "", boutique: "D", prix: 1, disponible: i % 2 === 0 })), "cable")[0].disponible === true);

  // ── LES MOTS DU CLIENT (capture Timo, 24/09/2026 : « Je veux un devis » →
  // « Je ne trouve pas… » — « la règle est trop rigide… il devrait se référer
  // à sa liste de sélection »)
  const libre = (etape, texte) => A.reponseAssistant({ etape, texte, articles, client: null });
  test("★★ « Je veux un devis » à l'étape produit N'EST PAS un nom d'article : c'est la demande de devis",
    libre(A.ETAPE_PRODUIT, "Je veux un devis").etape === A.ETAPE_DEVIS_BESOIN);
  test("★★ un mot du menu est un choix, à l'accueil comme au menu : conseiller, panne (SAV), devis, solaire",
    libre(A.ETAPE_MENU, "je voudrais parler à quelqu'un").conseiller === true
    && libre(A.ETAPE_MENU, "ma pompe est en panne").texte.includes("SAV")
    && libre(null, "Je veux un devis").etape === A.ETAPE_DEVIS_BESOIN
    && libre(A.ETAPE_MENU, "énergie solaire").texte.includes(A.LIGNES_MENU[0].titre)
    && libre(null, "bonjour").texte === A.TEXTE_ACCUEIL);
  test("★★ un GESTE prime sur une activité : « je veux un devis solaire » est un devis",
    libre(A.ETAPE_MENU, "je veux un devis solaire").etape === A.ETAPE_DEVIS_BESOIN);
  test("★ « combien coûte le panneau 400 ? » au menu cherche « panneau 400 » dans le stock, sans passer par 5",
    libre(A.ETAPE_MENU, "combien coûte le panneau 400 ?").trouves === 1 && A.motsUtiles("combien coûte le panneau 400 ?") === "panneau 400");
  test("★ « prix » seul demande le nom ; un mot inconnu redit le menu ; un article introuvable le dit avec les mots de sortie",
    libre(A.ETAPE_MENU, "prix").etape === A.ETAPE_PRODUIT && libre(A.ETAPE_MENU, "prix").texte.startsWith("🛒")
    && libre(A.ETAPE_MENU, "blabla").texte.includes("Je n'ai pas compris")
    && /écrivez « devis »/.test(libre(A.ETAPE_PRODUIT, "tondeuse").texte));
  test("★ « panne » ne réveille pas « panneau » (mot entier), « portes » vaut « porte »",
    A.choixParMots("un panneau 400 W") === null || A.choixParMots("un panneau 400 W").id === "solaire"
    && A.choixParMots("panne").id === "sav" && A.choixParMots("deux portes").id === "garage");
  test("★★ là où le client DÉCRIT (besoin, nom), rien n'est interprété : « installation solaire avec devis » est SA réponse",
    libre(A.ETAPE_DEVIS_BESOIN, "installation solaire avec devis pour 3 clims").etape === A.ETAPE_DEVIS_NOM
    && A.reponseAssistant({ etape: A.ETAPE_DEVIS_NOM, texte: "KOSSI SOLAIRE", memoire: { besoin: "x" } }).demandeDevis.nom === "KOSSI SOLAIRE");

  // ── LA DEMANDE DE DEVIS : une fiche prospect, RÉELLE, jamais un devis
  const rD1 = A.reponseAssistant({ etape: A.ETAPE_DEVIS_BESOIN, texte: "3 clims et une maison à Agoè", client: { nom: "ESSO" } });
  test("★ client connu : le besoin suffit, la demande est enregistrée et une personne prend le relais",
    rD1.demandeDevis.nom === "ESSO" && rD1.demandeDevis.besoin === "3 clims et une maison à Agoè" && rD1.etape === A.ETAPE_CONSEILLER && rD1.texte.includes("Merci ESSO"));
  const rD2 = A.reponseAssistant({ etape: A.ETAPE_DEVIS_BESOIN, texte: "un portail", client: null });
  const rD3 = A.reponseAssistant({ etape: A.ETAPE_DEVIS_NOM, texte: "KOFFI", memoire: rD2.memoire });
  test("★ numéro inconnu : il demande le nom, garde le besoin en mémoire, puis enregistre",
    rD2.etape === A.ETAPE_DEVIS_NOM && rD2.memoire.besoin === "un portail" && !rD2.demandeDevis
    && rD3.demandeDevis.nom === "KOFFI" && rD3.demandeDevis.besoin === "un portail");
  const fiche = A.construireDemandeDevis({ cle: "90112233", tel: "+22890112233", nom: "KOFFI", besoin: "un portail", ts: "2026-09-24T10:00:00.000Z" });
  test("★★ la fiche 🧲 Prospects naît RÉELLE (aucune marque formation), au nom de l'assistant, avec le numéro et le besoin",
    !("formation" in fiche) && fiche.commercial === A.NOM_ASSISTANT && fiche.categorie === "Assistant WhatsApp" && fiche.tel === "+22890112233" && fiche.nature === "un portail" && fiche.nom === "KOFFI" && fiche.date === "2026-09-24" && fiche.statut === "Favorable");
  test("★★ aucun texte de l'assistant ne parle de dette, de crédit ni de solde",
    [A.TEXTE_ACCUEIL, ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => choix(n).texte), rP.texte, rD1.texte, rD2.texte, A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "x" }).texte]
      .every((t) => !/dette|cr[ée]dit|solde|mot de passe|identifiant/i.test(t)));
  // ⚠ RETOURNÉ le 01/10/2026 : + la règle des pompes (sans import elle aussi), pour la fiche d'un article.
  // ⚠ RETOURNÉ le 14/10/2026 : + lib/horloge.js (l'heure du serveur, sans import elle aussi).
  test("★★ la règle ne reçoit JAMAIS `db` : des listes déjà filtrées, et ses trois imports sont la règle commune de recherche, celle des pompes et l'heure du serveur",
    !/\bdb\b/.test(codeA) && (codeA.match(/^import /mg) || []).length === 3 && /from "\.\/suggestions\.js"/.test(codeA) && /from "\.\/pompes\.js"/.test(codeA)
    && /from "\.\/horloge\.js"/.test(codeA)
    && !/^import /m.test(lire("src/lib/pompes.js")) && !/^import /m.test(lire("src/lib/horloge.js")));

  // ── LA LIGNE QU'IL ÉCRIT
  const lg = A.ligneAssistant({ cle: "90112233", tel: "+22890112233", nom: "ESSO", texte: "…", etape: A.ETAPE_MENU, ts: "2026-09-24T10:00:01.000Z" });
  test("★★ sa ligne est SORTANTE, sans propriétaire, signée par lui, avec son étape",
    lg.wa_entrant === false && !("proprietaire_id" in lg) && lg.de_id === A.ID_ASSISTANT && lg.de_nom === A.NOM_ASSISTANT && lg.wa_assistant.etape === A.ETAPE_MENU && lg.canal === "whatsapp" && A.estLigneAssistant(lg));
  test("★★ elle n'ouvre PAS la fenêtre de 24 h et ne compte pas comme non lue",
    C.fenetre([entrant("x", 25), { ...lg, ts: il(0) }]).ouverte === false
    && C.conversationsWa([entrant("x", 1), { ...lg, ts: il(0) }], { id: "TIMO", role: "admin" })[0].nonLus === 1);
  test("★ le réglage : allumé tant que personne ne l'a coupé, coupé sur toutes les boutiques d'un coup",
    A.assistantActif([]) === true && A.assistantActif([{ nom: "A" }]) === true && A.assistantActif([{ nom: "A", assistant_wa: false }]) === false
    && A.poserAssistant([{ nom: "A" }, { nom: "B" }], false).every((b) => b.assistant_wa === false));

  // ── LE SERVEUR
  test("★★ le webhook IMPORTE la règle et la porte YCloud commune, il ne recopie rien",
    /import \{[^}]*decisionAssistant[^}]*reponseAssistant[^}]*\} from "\.\.\/src\/lib\/assistantWhatsapp\.js"/.test(entrantA)
    && /import \{ configYCloud, envoyerYCloud, corpsTexte \} from "\.\/_ycloud\.js"/.test(entrantA));
  const corpsR = entrantA.slice(entrantA.indexOf("async function repondreParAssistant"));
  test("★★ RIEN N'EST ÉCRIT TANT QUE LE MESSAGE N'EST PAS PARTI : l'envoi précède l'écriture, et un refus sort avant",
    corpsR.indexOf("envoyerYCloud(") > 0 && corpsR.indexOf("envoyerYCloud(") < corpsR.indexOf('.from("messages").insert(')
    && /if \(!envoi\.ok\) \{[\s\S]{0,400}return \{ repondu: false/.test(corpsR));
  test("★★ il reçoit le PROPRIÉTAIRE de la conversation et le réglage — le silence est décidé par la règle",
    /decisionAssistant\(\{ fil, proprietaireId, actif: assistantActif\(boutiques\)/.test(corpsR)
    && /repondreParAssistant\(\{[^}]*proprietaireId: proprietaire\.id/.test(entrantA));
  // ⚠ RETOURNÉ le 24/09/2026 (capture Timo, « la règle est trop rigide ») : le
  // stock se charge pour tout message LIBRE au menu aussi — jamais pour un
  // chiffre, « menu », ou une étape où le client décrit.
  // ⚠ RETOURNÉ le 24/09/2026 (niveau 3) : le stock se charge par UNE fonction
  // à la demande (`chargerArticles`), que l'IA appelle pour chercher_article
  // et que le menu appelle seulement quand un message libre peut viser le stock.
  test("★ les ventes ne sont lues QUE quand un message libre peut viser le stock (un « 5 » tapé ne charge rien)",
    /const peutViserLeStock = \[null, undefined, ETAPE_MENU, ETAPE_PRODUIT\]\.includes\(decision\.etape\) && !entree\.chiffre && !entree\.menu && !entree\.vide;/.test(corpsR)
    && /const articles = peutViserLeStock \? await chargerArticles\(\) : \[\];/.test(corpsR)
    // ⚠ RETOURNÉ le 24/09/2026 : les produits sont lus UNE fois
    // (chargerProduits), pour la recherche d'articles et pour l'estimation.
    && /const chargerArticles = async \(\) => \{\s*if \(articlesCharges\) return articlesCharges;[\s\S]{0,200}chargerProduits\(\)/.test(corpsR)
    && /const chargerProduits = async \(\) => \{\s*if \(!produitsBruts\) \{\s*const \{ data: prods \} = await admin\.from\("produits"\)/.test(corpsR));
  // ⚠ RETOURNÉ le 21/10/2026 (« Rendre à l'assistant ») : la fiche suit SANS propriétaire nouveau — elle garde
  // celui d'une conversation confiée puis rendue à l'assistant (sinon elle cesserait d'être grisée).
  test("★ sa ligne et la demande de devis partent avec `updated_at`, la fiche légère suit sans s'approprier la conversation (elle garde le propriétaire d'une conversation confiée)",
    /insert\(\{ id: ligneR\.id, data: ligneR, updated_at: ligneR\.ts \}\)/.test(corpsR)
    && /from\("prospects"\)\.insert\(\{ id: p\.id, data: p, updated_at: ts \}\)/.test(corpsR)
    && /construireEntete\(\{ cle, tel: String\(from\), nom: client\?\.nom \|\| "", proprietaire_id: proprietaireId \|\| "", proprietaire_nom: garde,/.test(corpsR));
  test("★ une personne n'est prévenue que si l'assistant s'est tu ou a passé la main",
    /const aPrevenir = \(!assistant\.repondu && !assistant\.groupe\) \|\| assistant\.conseiller;/.test(entrantA) && /aPrevenir && destinataires\.length/.test(entrantA));
  test("★ un assistant qui trébuche ne perd jamais le message (try/catch autour, le message déjà écrit)",
    /assistant = await repondreParAssistant\(/.test(entrantA) && entrantA.indexOf("assistant = await repondreParAssistant(") > entrantA.indexOf('from("messages").insert({ id: ligne.id'));
  test("★★ DÉFAUT RÉPARÉ : le webhook lit le propriétaire par LA règle (marque « rendue à tous » comprise), et le repli par le devis ne rejoue pas sur une conversation rendue",
    /let proprietaire = proprietaireDe\(fil\);/.test(entrantA) && /const filMuet = !fil\.some\(\(m\) => m\.proprietaire_id \|\| m\[MARQUE_RENDUE\]\);/.test(entrantA)
    && /if \(!proprietaire\.id && filMuet && client\)/.test(entrantA) && !/for \(let i = fil\.length - 1; i >= 0 && !proprietaire\.id; i--\)/.test(entrantA));
  test("★ la porte YCloud : une seule adresse, la clé jamais préfixée VITE_, le refus rendu avec son code",
    /URL_YCLOUD = "https:\/\/api\.ycloud\.com\/v2\/whatsapp\/messages"/.test(ycloudBrut) && !/VITE_/.test(ycloud) && /code_whatsapp: code/.test(ycloud)
    && !/api\.ycloud\.com/.test(apiWhatsapp) && !/api\.ycloud\.com/.test(entrantA));

  // ── L'ÉCRAN ET LE RÉGLAGE
  test("★ 📲 WhatsApp montre la réponse du robot COMME telle (étiquette, cadre clair, `data-assistant`)",
    /import \{ estLigneAssistant, NOM_ASSISTANT(?:, [^}]*)? \} from "\.\.\/lib\/assistantWhatsapp"/.test(ecranA)
    && /data-assistant=\{estLigneAssistant\(m\) \? "oui" : undefined\}/.test(ecranA)
    && /🤖 \{NOM_ASSISTANT\}/.test(ecranA));
  test("★ ⚙ Paramètres : le réglage existe, PRINCIPAL seul, revérifié dans le geste, et montre le mot d'accueil de Timo tel quel",
    /data-reglage="assistant-whatsapp"/.test(param)
    && /const basculerAssistant = async \(\) => \{\s*if \(refuserSaufAdminPrincipal\(db, profile/.test(param)
    && /poserAssistant\(db\.boutiques, suivant\)/.test(param) && /\{TEXTE_ACCUEIL\}/.test(param)
    && /ne parle <b>jamais<\/b> d'une dette ni d'un crédit/.test(param));
  // Le rendu : la liste avec une ligne du robot en dernier ne fait pas d'écran blanc.
  const htmlA = V.renduAvecAssistant();
  test("★ l'écran 📲 WhatsApp se rend avec une réponse de l'assistant dans le fil (pas d'écran blanc)",
    typeof htmlA === "string" && htmlA.includes("ESSO") && !htmlA.startsWith("ERREUR"));
}

// ──────────────────────────────────────────────────────────────
titre("㉑ 🧲 LA DEMANDE DE L'ASSISTANT SE PREND EN CHARGE, ET SON DEVIS SE PRÉPARE (24/09/2026, « 1 et 2 »)");
// Timo, capture de MANDA : « comment reprendre ce devis ? ». Deux gestes :
// « 🙋 Prendre en charge » (la fiche de l'assistant n'était à personne, donc
// invisible aux commerciaux et convertible par le seul administrateur) et
// « 🔆 Préparer le devis » (les appareils LUS dans le besoin ouvrent le volet
// solaire pré-rempli — le vendeur vérifie et envoie).
{
  const sortieB = join(process.cwd(), "scripts", "_bundle-prospects.tmp.mjs");
  await build({
    entryPoints: ["scripts/_entree-prospects.mjs"], bundle: true, format: "esm", platform: "node",
    outfile: sortieB, logLevel: "silent", jsx: "automatic", external: ["react", "react-dom", "react-dom/server"],
  });
  const P = await import(pathToFileURL(sortieB).href);
  unlinkSync(sortieB);
  const B = await import("../src/lib/besoinSolaire.js");
  const CAT = P.CATALOGUE_APPAREILS;
  const prospectsJsx = lire("src/screens/Prospects.jsx").replace(/\/\/[^\n]*/g, "");
  const partagesJsx = lire("src/screens/dimensionnement/Partages.jsx").replace(/\/\/[^\n]*/g, "");
  const sql32 = lire("supabase/securite-32-prendre-demande-assistant.sql");
  const bancSql = lire("scripts/tester-devis-chantiers-sql.sh");

  // ── LA PHRASE DE TIMO, mot pour mot
  const phrase = "2 clim de 1,5hp 8h par jour 10 ampoule de 15w toute la nuit Un congélateur de 200w branché h24";
  const lus = B.lireAppareils(phrase, CAT);
  test("★★ la phrase de MANDA donne TROIS appareils : 2 clim 1,5 CV 8 h, 10 ampoules 15 W 12 h, 1 congélateur 200 W 24 h",
    lus.length === 3
    && lus[0].nom.startsWith("Climatiseur 1,5") && lus[0].qte === "2" && lus[0].heures === "8" && lus[0].puissance === "1500"
    && lus[1].nom === "Ampoule LED" && lus[1].qte === "10" && lus[1].puissance === "15" && lus[1].heures === "12"
    && lus[2].nom.startsWith("Congélateur") && lus[2].qte === "1" && lus[2].puissance === "200" && lus[2].heures === "24"
    && lus.every((a) => a.reconnu));
  const divers = B.lireAppareils("3 ventilateurs 6h, une télé 55 pouces le soir, un frigo jour et nuit, 2 machines bizarres 300w", CAT);
  test("★ « télé 55 pouces » n'ouvre pas un appareil « pouces » ; « jour et nuit » = 24 h ; « 6h » = 6 h ; un inconnu à 300 W est gardé comme tel",
    divers.length === 4 && divers[0].heures === "6" && divers[1].nom.includes("55") && divers[2].heures === "24"
    && divers[3].reconnu === false && divers[3].puissance === "300" && divers[3].qte === "2");
  test("★★ « électrifier une maison 4 pièces » ne fabrique AUCUN appareil (rien d'inventé), et la phrase le DIT",
    B.lireAppareils("électrifier une maison 4 pièces", CAT).length === 0
    && B.resumeLecture([]).startsWith("Aucun appareil reconnu"));
  test("★ le résumé compte les lignes lues et nomme les inconnus",
    /3 appareil\(s\) lu\(s\)/.test(B.resumeLecture(lus)) && /Non reconnus[^.]*Machines bizarres/.test(B.resumeLecture(divers)));
  test("★ la règle ne reçoit jamais `db` : le catalogue lui est passé, et son seul import est la règle commune",
    !/\bdb\b/.test(lire("src/lib/besoinSolaire.js").replace(/\/\/[^\n]*/g, ""))
    && (lire("src/lib/besoinSolaire.js").match(/^import /mg) || []).length === 1);

  // ── PRENDRE EN CHARGE
  const demande = { id: "p1", nom: "MANDA", tel: "+22899021319", commercial: "Assistant BMI TOGO", source: "assistant_whatsapp" };
  const moi = { id: "COM2", nom: "COM2", role: "commercial" };
  test("★★ une demande de l'assistant n'est à personne ; prise, elle devient la fiche de celui qui a cliqué, une seule fois",
    P.estDemandeAssistant(demande) === true
    && P.critiquePriseEnCharge(demande, moi) === null
    && P.prendreEnCharge(demande, moi).commercial === "COM2" && !!P.prendreEnCharge(demande, moi).pris_le
    && P.estDemandeAssistant(P.prendreEnCharge(demande, moi)) === false
    && /déjà été prise en charge par COM2/.test(P.critiquePriseEnCharge(P.prendreEnCharge(demande, moi), { nom: "COM" }))
    && /pas une demande de l'assistant/.test(P.critiquePriseEnCharge({ id: "x", commercial: "COM" }, moi)));
  test("★ le devis préparé lie le compte et le devis à la fiche SANS la marquer client",
    P.prospectAvecDevis(demande, { client_user_id: "c1", devis_id: "d1" }).client_user_id === "c1"
    && !P.prospectAvecDevis(demande, { client_user_id: "c1" }).converti);
  test("★★ LE COUPLE : le mot « assistant_whatsapp » est le MÊME dans l'assistant, la règle des prospects et le SQL",
    P.SOURCE_ASSISTANT === "assistant_whatsapp"
    && /source: "assistant_whatsapp"/.test(lire("src/lib/assistantWhatsapp.js"))
    && /'assistant_whatsapp'/.test(sql32));
  test("★★ securite-32 n'ouvre QU'UNE porte : source assistant, pas encore prise, prise POUR SOI — et reprend la règle de securite-6",
    /prise_pour_soi := coalesce\(old\.data ->> 'source', ''\) = 'assistant_whatsapp'\s*and \(old\.data ->> 'pris_le'\) is null\s*and coalesce\(new\.data ->> 'commercial', ''\) = public\.nom_jeton\(\);/.test(sql32)
    && /and not prise_pour_soi\s*and not \(\(r in \('admin', 'resp_commercial'\)/.test(sql32)
    && /foreach champ in array array\['archive', 'archive_motif', 'archive_le', 'contacts'\]/.test(sql32)
    && !/like '%[^%']*''[^%']*%'/.test(sql32));
  test("★ le banc SQL rejoue securite-32, LIT sa phrase de vérification, et éprouve les deux refus (pour un autre, déjà prise)",
    /securite-32-prendre-demande-assistant\.sql/.test(bancSql) && /VERIF32/.test(bancSql) && /"t\|t"/.test(bancSql)
    && /POUR UN AUTRE" "REFUSE"/.test(bancSql) && /DÉJÀ prise ne se reprend pas[^"]*" "REFUSE"/.test(bancSql)
    && /personne ne l'avait\)" "PERMIS"/.test(bancSql));

  // ── L'ÉCRAN 🧲 PROSPECTS
  test("★★ un commercial VOIT les demandes de l'assistant (elles ne sont à personne), et le bouton « Prendre en charge » revérifie la règle",
    /base\.filter\(\(p\) => p\.commercial === profile\.nom \|\| estDemandeAssistant\(p\)\)/.test(prospectsJsx)
    && /const refus = critiquePriseEnCharge\(p, profile\);\s*if \(refus\) \{ uAlert\(refus\); return; \}/.test(prospectsJsx)
    && /prendreEnCharge\(x, profile\)/.test(prospectsJsx) && /🙋 Prendre en charge/.test(prospectsJsx) && /data-demande-assistant/.test(prospectsJsx));
  test("★★ « Préparer le devis » : le droit revérifié, les appareils LUS par la règle avec le VRAI catalogue, le compte cherché par le mur (jamais db.users)",
    /const preparerDevis = async \(p\) => \{\s*if \(refuserSaufProprietaire\(profile, p\.commercial/.test(prospectsJsx)
    && /lireAppareils\(p\.nature \|\| "", catalogueAppareils\(db, profile\)\)/.test(prospectsJsx)
    && /comptesAvecCeNumero\(db, profile, p\.tel\)\.find\(\(u\) => u\.role === "client"\)/.test(prospectsJsx)
    && /resumeLecture\(appareils\)/.test(prospectsJsx)
    && /devis: \{ type_devis: "solaire", besoins: \{ appareils:/.test(prospectsJsx) && /prospect_id: p\.id/.test(prospectsJsx));
  test("★ App.jsx donne le chemin : la fiche part au dimensionnement comme un devis repris",
    /<M\.Prospects [^>]*onPreparerDevis=\{\(pseudoDevis\) => \{ setDevisAReprendre\(pseudoDevis\); setTab\("dimensionnement"\); \}\}/.test(lire("src/App.jsx")));
  test("★ à l'envoi, la fiche du prospect garde le compte et le devis — après que le message est PARTI, jamais marquée client ici",
    // RETOURNÉ le 15/10/2026 : la marque vit dans `apresLeDevis`, appelée APRÈS l'envoi (et après un devis imprimé, rangé).
    /if \(!envoye\) return;\s*apresLeDevis\(compte, devis\);/.test(partagesJsx)
    && /const apresLeDevis = \(compte, devis\) => \{[\s\S]{0,700}if \(devisAReprendre\?\.prospect_id\) \{[\s\S]{0,400}prospectAvecDevis\(x, \{ client_user_id: compte\.id, devis_id: devis\.id \}\)/.test(partagesJsx)
    && !/prospectAcquis/.test(partagesJsx)
    && /import \{ prospectAvecDevis \} from "\.\.\/\.\.\/lib\/prospects"/.test(partagesJsx));
  test("★ « Convertir » sur un numéro qui a DÉJÀ un compte rattache la fiche au lieu de s'arrêter",
    /prospectAcquis\(x, \{ client_user_id: existant\.id \}\)/.test(prospectsJsx) && !/Rien n'a été recréé\.`\);\s*return;/.test(prospectsJsx));
}

// ──────────────────────────────────────────────────────────────
titre("㉒ 🗣 L'ASSISTANT QUI DISCUTE — l'IA bridée par les outils et par le juge (24/09/2026, « Lance avec ces trois réponses »)");
// Timo : « il doit arriver à discuter comme un humain ». Ce qui est protégé
// ici : l'IA ne SAIT rien toute seule (trois outils, rien d'autre), sa
// réponse est JUGÉE avant de partir (un montant qu'aucun outil n'a donné,
// un mot sur une dette, un texte trop long → jetée), elle ne se fait jamais
// passer pour une personne, le client est prévenu qu'un service extérieur
// lit ses messages, le menu reprend quand elle échoue, et la clé comme le
// nom du modèle ne vivent QUE côté serveur. Le banc JOUE le service d'IA
// (un faux `appeler`) : on exerce la vraie boucle, pas une lecture de code.
{
  const I = await import("../src/lib/assistantIA.js");
  const A = await import("../src/lib/assistantWhatsapp.js");
  const codeI = lire("src/lib/assistantIA.js").replace(/\/\/[^\n]*/g, "");
  const porteBrut = lire("api/_assistantIA.js");
  const porte = porteBrut.replace(/\/\/[^\n]*/g, "");
  const entrantI = lire("api/whatsapp-entrant.js").replace(/\/\/[^\n]*/g, "");
  const param = lire("src/screens/Parametres.jsx");
  const ecranI = lire("src/screens/Whatsapp.jsx").replace(/\/\/[^\n]*/g, "");
  const il = (h) => new Date(Date.now() - h * 3600e3).toISOString();
  const entrant = (texte, h = 0, extra = {}) => ({ id: `e${h}`, canal: "whatsapp", wa_tel: "90112233", wa_entrant: true, ts: il(h), texte, ...extra });
  const articles = [
    { nom: "Panneau solaire 400 W", categorie: "Panneaux", boutique: "DEMAKPOE", prix: 85000, disponible: true, tension: "" },
    { nom: "Batterie lithium 5 kWh", categorie: "Batteries", boutique: "DEMAKPOE", prix: 900000, disponible: false, tension: "48 V" },
  ];
  const ctx = { articles, client: null, cle: "90112233", tel: "+22890112233" };

  // ── LA CONSIGNE : ses trois décisions, et les règles du 24/09
  test("★★ la consigne dit qui elle est (un programme, jamais une personne), vouvoie, et parle français simple",
    /Tu es un programme, pas une personne/.test(I.CONSIGNE_IA) && /Tu ne te fais JAMAIS passer pour un employé, un conseiller ou un humain/.test(I.CONSIGNE_IA)
    && /Tu vouvoies toujours/.test(I.CONSIGNE_IA) && /français simple/.test(I.CONSIGNE_IA));
  test("★★ la consigne grave les règles de Timo : rien d'inventé, jamais la quantité, jamais une dette, jamais un devis chiffré, un conseiller toujours possible",
    /Tu n'inventes RIEN/.test(I.CONSIGNE_IA) && /seulement « disponible » ou « sur commande »/.test(I.CONSIGNE_IA)
    && /Une dette, un crédit, un solde, un montant dû, un mot de passe, un identifiant/.test(I.CONSIGNE_IA)
    && /Un devis chiffré, une promesse d'installation, une remise, une date : seul un vendeur de BMI TOGO s'engage/.test(I.CONSIGNE_IA)
    && /passer_conseiller/.test(I.CONSIGNE_IA) && /Tu recopies le prix exactement/.test(I.CONSIGNE_IA));
  test("★ la consigne présente les activités de BMI avec les mots du menu de Timo (les quatre activités)",
    A.LIGNES_MENU.filter((l) => l.activite).every((l) => I.CONSIGNE_IA.includes(l.titre) && (!l.detail || I.CONSIGNE_IA.includes(l.detail))));
  test("★ un client connu est nommé à l'IA ; un numéro inconnu → elle doit demander le nom avant d'enregistrer",
    /il s'appelle ESSO/.test(I.consignePour({ client: { nom: "ESSO" } })) && /son nom est inconnu/.test(I.consignePour({})));
  // ⚠ RETOURNÉ le 24/09/2026 au soir : le texte est celui de Timo, mot pour
  // mot, et la mention « hors du Togo » a été RETIRÉE à sa demande.
  test("★★ LA PRÉSENTATION est posée par le serveur, pas confiée à l'IA : le texte de Timo mot pour mot — un assistant VIRTUEL, « conseiller » pour une personne — et plus la mention « hors du Togo » (retirée à sa demande)",
    I.PHRASE_PRESENTATION.startsWith("👋 Bonjour et bienvenue chez BMI TOGO !") && /🤖 Je suis l’assistant virtuel de BMI TOGO, conçu pour vous renseigner et vous orienter\./.test(I.PHRASE_PRESENTATION)
    && /👤 À tout moment, écrivez « conseiller » pour parler directement à un membre de notre équipe\./.test(I.PHRASE_PRESENTATION)
    && I.PHRASE_PRESENTATION.endsWith("Comment puis-je vous aider aujourd’hui ?")
    && !/hors du Togo/.test(I.PHRASE_PRESENTATION) && !("MENTION_SERVICE_EXTERIEUR" in I) && !("avecMention" in I)
    && /le serveur ajoute la phrase de présentation/.test(I.CONSIGNE_IA)
    && I.avecPresentation("x", { nouvelle: true }).startsWith(I.PHRASE_PRESENTATION) && I.avecPresentation("x", { nouvelle: false }) === "x"
    && I.conversationNouvelle({ etape: null }) === true && I.conversationNouvelle({ etape: A.ETAPE_MENU }) === false);

  // ── LES OUTILS : trois, et rien d'autre
  // ⚠ RETOURNÉ le 24/09/2026 : un quatrième outil, estimer_solaire
  // (décisions de Timo « 1 valeur par défaut, 2 en fourchette, 3 solaire »).
  // ⚠ RETOURNÉ le 18/10/2026 : + adresses_boutiques (« b, NON pour les horaires »).
  test("★★ neuf outils exactement (RETOURNÉ le 01/10/2026 : + calculer_total, + choisir_pompe, + panneaux_pour_pompe ; le 18/10/2026 : + adresses_boutiques, + guide_espace_client) — chercher un article, enregistrer une demande de devis, estimer le solaire, calculer un total, choisir une pompe, les panneaux d'une pompe, les adresses des boutiques, le mode d'emploi de l'espace client, passer la main — chacun avec son schéma",
    I.OUTILS_IA.map((o) => o.name).join(",") === "chercher_article,enregistrer_demande_devis,estimer_solaire,calculer_total,choisir_pompe,panneaux_pour_pompe,adresses_boutiques,guide_espace_client,passer_conseiller"
    && I.OUTILS_IA.every((o) => o.input_schema?.type === "object" && Array.isArray(o.input_schema.required) && o.description.length > 40));
  const cherche = I.executerOutil("chercher_article", { recherche: "panneau 400" }, ctx);
  // ⚠ RETOURNÉ le 01/10/2026 : un champ VIDE (ici la tension) ne part plus — on n'écrit pas « tension : ».
  test("★★ chercher_article passe par LA règle de recherche et rend prix, disponible (oui/non), boutique — JAMAIS une quantité",
    cherche.effets.prix.join() === "85000" && /"disponible":true/.test(cherche.resultat) && /"prix_fcfa":85000/.test(cherche.resultat)
    && !/qte|quantite|stock"/.test(cherche.resultat) && Object.keys(JSON.parse(cherche.resultat)[0]).sort().join(",") === "boutique,categorie,disponible,nom,prix_fcfa");
  test("★ un article introuvable : l'outil le DIT et interdit d'inventer un prix",
    /Aucun article trouvé/.test(I.executerOutil("chercher_article", { recherche: "tondeuse" }, ctx).resultat) && /Ne pas inventer de prix/.test(I.executerOutil("chercher_article", { recherche: "tondeuse" }, ctx).resultat));
  test("★★ enregistrer_demande_devis refuse sans besoin, refuse sans nom pour un inconnu, prend le nom du COMPTE pour un client connu",
    /Refusé : le besoin est vide/.test(I.executerOutil("enregistrer_demande_devis", { nom: "K" }, ctx).resultat)
    && /Refusé : le nom du client est inconnu/.test(I.executerOutil("enregistrer_demande_devis", { besoin: "3 clims" }, ctx).resultat)
    && I.executerOutil("enregistrer_demande_devis", { besoin: "3 clims", nom: "KOFFI" }, ctx).effets.demandeDevis.nom === "KOFFI"
    && I.executerOutil("enregistrer_demande_devis", { besoin: "3 clims", nom: "AUTRE" }, { ...ctx, client: { nom: "ESSO" } }).effets.demandeDevis.nom === "ESSO"
    && I.executerOutil("enregistrer_demande_devis", { besoin: "3 clims", nom: "KOFFI" }, ctx).effets.conseiller === true);
  test("★ passer_conseiller passe la main (conseiller, sav, paiement ; un type inconnu vaut conseiller), un outil inconnu ne fait rien",
    I.executerOutil("passer_conseiller", { motif: "x", type: "sav" }, ctx).effets.type === "sav"
    && I.executerOutil("passer_conseiller", { motif: "x", type: "bizarre" }, ctx).effets.type === "conseiller"
    && I.executerOutil("passer_conseiller", { motif: "x", type: "sav" }, ctx).effets.conseiller === true
    && I.executerOutil("voler_la_base", {}, ctx).effets.conseiller === false && /Outil inconnu/.test(I.executerOutil("voler_la_base", {}, ctx).resultat));
  test("★★ la fiche 🧲 Prospects d'une demande de l'IA est LA MÊME que celle du menu (une seule fabrique, réelle, au nom de l'assistant)",
    (() => { const f = I.demandeDevisIA({ cle: "90112233", tel: "+22890112233", demandeDevis: { nom: "KOFFI", besoin: "un portail" }, ts: "2026-09-24T10:00:00.000Z" }); return !("formation" in f) && f.commercial === A.NOM_ASSISTANT && f.source === "assistant_whatsapp" && f.nature === "un portail" && f.nom === "KOFFI"; })());

  // ── LA MÉMOIRE
  const filM = [entrant("bonjour", 3), A.ligneAssistant({ cle: "90112233", texte: "Bonjour, que cherchez-vous ?", etape: I.ETAPE_IA, ts: il(2.9), ia: true }),
    { id: "s", canal: "whatsapp", wa_tel: "90112233", ts: il(2), wa_systeme: true, texte: "confiée" },
    entrant("", 1, { wa_media: { type: "image" } }), entrant("le panneau 400 ?", 0)];
  const mem = I.messagesPourIA(filM);
  test("★★ le fil devient une suite user / assistant qui commence et finit par le client ; une photo devient « [photo … non lisible] » ; une ligne système est ignorée",
    mem.map((m) => m.role).join(",") === "user,assistant,user" && mem[2].content.startsWith("[photo envoyé par le client — non lisible]") && mem[2].content.endsWith("le panneau 400 ?")
    && !mem.some((m) => /confiée/.test(m.content)));
  test("★ la mémoire est bornée (les 24 dernières lignes) et vide si rien ne vient du client",
    I.messagesPourIA(Array.from({ length: 60 }, (_, i) => entrant(`m${i}`, 60 - i))).length === 1 && I.messagesPourIA(Array.from({ length: 60 }, (_, i) => entrant(`m${i}`, 60 - i)))[0].content.split("\n").length === I.MAX_MESSAGES_MEMOIRE
    && I.messagesPourIA([A.ligneAssistant({ cle: "9", texte: "x", etape: I.ETAPE_IA, ts: il(0) })]).length === 0);

  // ── LE JUGE : on ne se fie pas à la consigne, on VÉRIFIE
  test("★★ un montant en francs qu'AUCUN outil n'a donné → la réponse est JETÉE (un prix inventé est une faute au nom de BMI)",
    I.garderReponse("Le panneau est à 85 000 F.", { prixConnus: [85000] }).ok === true
    && I.garderReponse("Le panneau est à 90 000 F.", { prixConnus: [85000] }).ok === false
    && I.garderReponse("Comptez environ 1 200 000 FCFA pour l'installation.", { prixConnus: [85000] }).ok === false
    && I.garderReponse("Ça coûte 3500 francs.", { prixConnus: [] }).ok === false
    && I.montantsCites("85 000 F, 1 200 000 FCFA, 3500F").join() === "85000,1200000,3500");
  test("★★ un mot sur une dette, un crédit, un solde, un mot de passe, un identifiant → jetée, motif « sujet réservé »",
    ["Votre dette est de …", "Vous pouvez payer à crédit", "Votre solde est positif", "Voici votre mot de passe", "Donnez-moi votre identifiant", "Le montant dû est…"]
      .every((t) => I.garderReponse(t, {}).reserve === true)
    && I.garderReponse("Nous accréditons…", {}).ok === true);
  test("★ vide ou trop long → jetée ; un texte ordinaire passe",
    I.garderReponse("", {}).ok === false && I.garderReponse("x".repeat(I.MAX_LONGUEUR_REPONSE + 1), {}).ok === false
    && I.garderReponse("Bonjour ! Le Panneau solaire 400 W est disponible à DEMAKPOE. Voulez-vous un devis ?", { prixConnus: [] }).ok === true);
  test("★★ un verdict « sujet réservé » envoie la phrase fixe (espace client + conseiller) et passe la main ; une réponse jetée après une demande ENREGISTRÉE envoie la phrase du menu, rien n'est perdu ; jetée sans effet → null, le menu reprend",
    (() => {
      const r1 = I.reponseDepuisIA({ texte: "votre dette…", effets: { prix: [], demandeDevis: null, conseiller: false }, juge: I.garderReponse("votre dette…", {}), nouvelle: false });
      const r2 = I.reponseDepuisIA({ texte: "c'est 999 F", effets: { prix: [], demandeDevis: { nom: "KOFFI", besoin: "b" }, conseiller: true }, juge: I.garderReponse("c'est 999 F", {}), nouvelle: false });
      const r3 = I.reponseDepuisIA({ texte: "c'est 999 F", effets: { prix: [], demandeDevis: null, conseiller: false }, juge: I.garderReponse("c'est 999 F", {}), nouvelle: false });
      const r4 = I.reponseDepuisIA({ texte: "Bonjour !", effets: { prix: [], demandeDevis: null, conseiller: false }, juge: { ok: true }, nouvelle: true });
      return r1.texte === I.REPONSE_SUJET_RESERVE && r1.etape === A.ETAPE_CONSEILLER && r1.conseiller === true && /espace client/.test(r1.texte)
        && r2.texte === A.texteDemandeEnregistree("KOFFI") && r2.demandeDevis.nom === "KOFFI" && r2.etape === A.ETAPE_CONSEILLER
        && r3 === null
        && r4.texte.startsWith(I.PHRASE_PRESENTATION) && r4.etape === I.ETAPE_IA && r4.ia === true;
    })());
  test("★★ aucune phrase fixe de l'IA ne parle de dette, de crédit, de solde, de mot de passe (le juge s'applique aussi à ce qu'on écrit nous-mêmes)",
    [I.PHRASE_PRESENTATION, I.REPONSE_SUJET_RESERVE, A.TEXTE_RELAIS_CONSEILLER, A.texteDemandeEnregistree("X")].every((t) => I.garderReponse(t, {}).ok === true));

  // ── LA VRAIE BOUCLE, avec un faux service
  const joue = (reponses) => { let n = 0; const vus = []; return { vus, appeler: async (corps) => { vus.push(corps); return reponses[Math.min(n++, reponses.length - 1)]; } }; };
  const outil = (id, name, input) => ({ type: "tool_use", id, name, input });
  const filC = [entrant("le panneau 400 c'est combien ?", 0)];
  const j1 = joue([
    { stop_reason: "tool_use", content: [{ type: "text", text: "Je regarde." }, outil("t1", "chercher_article", { recherche: "panneau 400" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Le Panneau solaire 400 W est à 85 000 F, disponible à DEMAKPOE. Voulez-vous un devis ?" }] },
  ]);
  const c1 = await I.converserAvecIA({ consigne: I.consignePour({}), messages: I.messagesPourIA(filC), appeler: j1.appeler, executer: (n, e) => I.executerOutil(n, e, ctx) });
  test("★★ LA BOUCLE : l'outil est exécuté par NOUS, son résultat renvoyé sous `tool_result` avec le même id, la consigne et les trois outils sont passés à chaque tour",
    c1.tours === 1 && j1.vus.length === 2 && j1.vus[1].messages.at(-1).role === "user" && j1.vus[1].messages.at(-1).content[0].type === "tool_result"
    && j1.vus[1].messages.at(-1).content[0].tool_use_id === "t1" && /"prix_fcfa":85000/.test(j1.vus[1].messages.at(-1).content[0].content)
    && j1.vus[1].messages.at(-2).role === "assistant" && j1.vus.every((c) => c.system === I.consignePour({}) && c.tools === I.OUTILS_IA && c.max_tokens === I.MAX_TOKENS_REPONSE));
  test("★★ le prix cité vient de l'outil : le juge accepte ; si le service avait écrit un autre prix, il refuse",
    I.garderReponse(c1.texte, { prixConnus: c1.effets.prix }).ok === true && c1.effets.prix.join() === "85000"
    && I.garderReponse("Le Panneau solaire 400 W est à 95 000 F.", { prixConnus: c1.effets.prix }).ok === false);
  const j2 = joue([
    { stop_reason: "tool_use", content: [outil("t2", "enregistrer_demande_devis", { nom: "KOFFI", besoin: "3 clims 1,5 CV à Agoè" })] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Merci KOFFI, votre demande est enregistrée. Un conseiller BMI TOGO vous rappelle sur ce numéro." }] },
  ]);
  const c2 = await I.converserAvecIA({ consigne: "", messages: [{ role: "user", content: "je veux un devis, 3 clims, KOFFI" }], appeler: j2.appeler, executer: (n, e) => I.executerOutil(n, e, ctx) });
  test("★★ une demande de devis enregistrée par l'outil passe la main (étape conseiller), avec le nom et le besoin",
    c2.effets.demandeDevis.nom === "KOFFI" && c2.effets.demandeDevis.besoin === "3 clims 1,5 CV à Agoè" && c2.effets.conseiller === true
    && I.etapeApresIA(c2.effets) === A.ETAPE_CONSEILLER && I.etapeApresIA(c1.effets) === I.ETAPE_IA);
  // ⚠ Le faux service s'arrête de lui-même au 20e appel : si la borne de la
  // règle manquait, on lirait un ✗ (20 tours au lieu de 4), pas un banc
  // qui pend — un banc illisible est un banc qu'on cesse de lire.
  let k = 0;
  const boucle = async () => { k++; return k > 20 ? { stop_reason: "end_turn", content: [] } : { stop_reason: "tool_use", content: [outil(`t${k}`, "chercher_article", { recherche: "x" })] }; };
  const c3 = await I.converserAvecIA({ consigne: "", messages: [{ role: "user", content: "x" }], appeler: boucle, executer: (n, e) => I.executerOutil(n, e, ctx) });
  test("★★ un service qui redemande un outil sans fin est ARRÊTÉ : au plus 4 allers-retours (5 appels), jamais une boucle qui coûte sans fin",
    c3.tours === I.MAX_TOURS_OUTILS && k === I.MAX_TOURS_OUTILS + 1 && I.MAX_TOURS_OUTILS === 4);
  test("★ rien du client → pas d'appel du tout",
    (await I.converserAvecIA({ consigne: "", messages: [], appeler: async () => { throw new Error("ne doit pas être appelé"); }, executer: () => ({}) })).texte === "");

  // ── LA PORTE : la clé et le modèle côté serveur seulement, jamais dans le code
  test("★★ la clé d'accès et le nom du modèle sont des variables Vercel, lues UNIQUEMENT dans api/_assistantIA.js, jamais préfixées VITE_",
    /process\.env\.ANTHROPIC_API_KEY/.test(porte) && /process\.env\.ASSISTANT_IA_MODELE/.test(porte) && !/VITE_/.test(porte)
    && !/ANTHROPIC_API_KEY|ASSISTANT_IA_MODELE/.test(entrantI) && !/process\.env/.test(codeI)
    && /pret: !!cle && !!modele/.test(porte));
  test("★★ AUCUN nom de modèle d'IA dans le code (règle de la maison) : ni dans la règle, ni dans la porte, ni dans le webhook, ni dans les écrans",
    ["src/lib/assistantIA.js", "api/_assistantIA.js", "api/whatsapp-entrant.js", "src/screens/Parametres.jsx", "src/screens/Whatsapp.jsx"].every((f) => !/claude-[a-z0-9]/i.test(lire(f))));
  test("★ la porte : une seule adresse, la version d'API, la clé dans l'en-tête, un délai borné, et une réponse en erreur qui LÈVE (l'appelant retombe sur le menu)",
    /URL_IA = "https:\/\/api\.anthropic\.com\/v1\/messages"/.test(porteBrut) && /"anthropic-version": VERSION_API_IA/.test(porte) && /"x-api-key": cle/.test(porte)
    && /AbortController/.test(porte) && /DELAI_IA_MS = 25000/.test(porte) && /if \(!reponse\.ok\) \{[\s\S]{0,300}throw e;/.test(porte)
    && !/api\.anthropic\.com/.test(entrantI) && !/api\.anthropic\.com/.test(codeI));
  // ⚠ RETOURNÉ le 24/09/2026 : l'estimation lit LA lecture des appareils et
  // LE calcul de l'application — trois imports, tous des règles sans réseau.
  // ⚠ RETOURNÉ le 01/10/2026 : + la règle des pompes (choisir_pompe).
  // ⚠ RETOURNÉ le 18/10/2026 : + le mode d'emploi de l'espace client (guide_espace_client).
  test("★★ la règle ne parle JAMAIS au réseau et ne reçoit jamais `db` : aucun fetch, cinq imports (assistant à menu, lecture des appareils, choix du matériel, pompes, mode d'emploi de l'espace client)",
    !/fetch\(/.test(codeI) && !/\bdb\b/.test(codeI) && (codeI.match(/^import /mg) || []).length === 5 && /from "\.\/pompes\.js"/.test(codeI) && /from "\.\/guideEspaceClient\.js"/.test(codeI)
    && /from "\.\/assistantWhatsapp\.js"/.test(codeI) && /from "\.\/besoinSolaire\.js"/.test(codeI) && /from "\.\/choixSolaire\.js"/.test(codeI));

  // ── LE SERVEUR : l'IA d'abord, le menu en repli, et rien d'écrit avant l'envoi
  const corpsR = entrantI.slice(entrantI.indexOf("async function repondreParAssistant"));
  test("★★ le webhook tente l'IA seulement si elle est CHOISIE et CONFIGURÉE, puis retombe sur le menu (`if (!r)`) — la décision de silence est prise UNE fois, avant, par la règle",
    /if \(modeAssistant\(boutiques\) === "ia" && ia\.pret\) \{/.test(corpsR) && /if \(!r\) \{[\s\S]{0,900}r = reponseAssistant\(\{/.test(corpsR)
    // ⚠ RETOURNÉ le 18/10/2026 : DEUX décisions — une première pour ne pas attendre quand l'assistant doit se taire, puis celle qui compte, sur la conversation RELUE après l'attente ; les deux AVANT l'IA.
    && (corpsR.match(/decisionAssistant\(/g) || []).length === 2 && corpsR.lastIndexOf("decisionAssistant(") < corpsR.indexOf("modeAssistant(boutiques)"));
  // ⚠ RETOURNÉ le 25/09/2026 : la consigne sait si la conversation commence, et la réponse reçoit le nom du client (un seul bonjour).
  // ⚠ RETOURNÉ le 21/10/2026 : la consigne reçoit aussi `rendu` / `dejaVu` (une conversation rendue à l'assistant).
  test("★★ l'IA reçoit la consigne, la mémoire du fil, et exécute les outils par `executerOutil` avec les articles RÉELS chargés à la demande ; sa réponse passe par le juge puis `reponseDepuisIA`",
    // ⚠ RETOURNÉ le 01/10/2026 : converserAvecJuge (une réponse jetée se réécrit une fois), le juge vient de lui.
    /converserAvecJuge\(\{\s*consigne: consignePour\(\{ client: clientIA, nouvelle, presentation, metiers: domainesPourIA\(boutiques\), memo: memoAssistant\(boutiques\), rendu: !!decision\.rendu, dejaVu: [^}]* \}\),\s*messages: messagesPourIA\(fil\),\s*appeler: \(corps\) => appelerIA\(corps, ia\),/.test(corpsR)
    && /executerOutil\(nom, entree, \{[^}]*?articles: \["chercher_article", "calculer_total", "choisir_pompe", "panneaux_pour_pompe"\]\.includes\(nom\) \? await chargerArticles\(\) : \[\],/.test(corpsR)
    && /const juge = conv\.juge;[\s\S]{0,200}r = reponseDepuisIA\(\{ texte: conv\.texte, effets: conv\.effets, juge, nouvelle, presentation, nom: clientIA\?\.nom \|\| "" \}\);/.test(corpsR)
    && /articlesPourAssistant\(\{[\s\S]{0,300}boutiques,/.test(corpsR));
  test("★★ RIEN N'EST ÉCRIT TANT QUE LE MESSAGE N'EST PAS PARTI, IA comprise : un seul envoi YCloud, APRÈS l'IA et le menu, AVANT toute écriture",
    (corpsR.match(/envoyerYCloud\(/g) || []).length === 1
    && corpsR.indexOf("converserAvecIA(") < corpsR.indexOf("envoyerYCloud(") && corpsR.indexOf("reponseAssistant(") < corpsR.indexOf("envoyerYCloud(")
    && corpsR.indexOf("envoyerYCloud(") < corpsR.indexOf('.from("messages").insert(') && corpsR.indexOf("envoyerYCloud(") < corpsR.indexOf('.from("prospects").insert('));
  test("★★ une IA qui trébuche (réseau, refus, réponse jetée) ne laisse jamais le client sans réponse : try/catch, journal, et le menu — sans la mention « hors du Togo », retirée à la demande de Timo (RETOURNÉ le 24/09/2026)",
    /try \{\s*(?:\/\/[^\n]*\s*)*const conv = await converserAvecJuge/.test(corpsR) && /catch \(e\) \{\s*console\.error\("\[whatsapp-entrant\] IA indisponible, le menu reprend/.test(corpsR)
    && !/avecMention|MENTION_SERVICE_EXTERIEUR/.test(corpsR));
  test("★ la ligne écrite porte la marque `ia`, la demande de devis part par la même écriture qu'avant, la fiche légère suit sans propriétaire",
    // ⚠ RETOURNÉ le 24/09/2026 : la mémoire porte aussi l'estimation donnée.
    /ligneAssistant\(\{ cle, tel: from, nom: client\?\.nom \|\| "", texte: r\.texte, etape: r\.etape, ts, memoire: memoireR, ia: !!r\.ia \}\)/.test(corpsR)
    && A.ligneAssistant({ cle: "9", texte: "x", etape: I.ETAPE_IA, ts: il(0), ia: true }).wa_assistant.ia === true
    && !("ia" in A.ligneAssistant({ cle: "9", texte: "x", etape: A.ETAPE_MENU, ts: il(0) }).wa_assistant)
    && /from\("prospects"\)\.insert\(\{ id: p\.id, data: p, updated_at: ts \}\)/.test(corpsR));
  test("★★ les règles de SILENCE ne bougent pas : conversation confiée, employé qui a répondu, conseiller demandé — le même `decisionAssistant` décide avant l'IA",
    A.decisionAssistant({ fil: [entrant("bonjour")], proprietaireId: "COM1" }).repondre === false
    && A.decisionAssistant({ fil: [entrant("x", 3), { id: "h", canal: "whatsapp", wa_tel: "90112233", ts: il(2), texte: "je réponds", de_id: "KOSSI" }, entrant("ok", 0)] }).repondre === false
    && A.decisionAssistant({ fil: [entrant("8", 1), A.ligneAssistant({ cle: "90112233", texte: "…", etape: A.ETAPE_CONSEILLER, ts: il(1), ia: true }), entrant("j'attends", 0)] }).repondre === false
    && A.decisionAssistant({ fil: [entrant("x", 1), A.ligneAssistant({ cle: "90112233", texte: "…", etape: I.ETAPE_IA, ts: il(1), ia: true }), entrant("suite", 0)] }).repondre === true
    && A.decisionAssistant({ fil: [entrant("x", 1), A.ligneAssistant({ cle: "90112233", texte: "…", etape: I.ETAPE_IA, ts: il(1), ia: true }), entrant("suite", 0)] }).etape !== null);
  test("★ le webhook a le temps d'attendre le service (vercel.json : 60 s pour whatsapp-entrant)",
    /"api\/whatsapp-entrant\.js": \{ "maxDuration": 60 \}/.test(lire("vercel.json")));

  // ── LE RÉGLAGE ET L'ÉCRAN
  test("★ le réglage : « ia » tant que personne n'a choisi le menu, posé sur toutes les boutiques, un mode inconnu vaut « ia »",
    I.modeAssistant([]) === "ia" && I.modeAssistant([{ nom: "A", assistant_wa_mode: "menu" }]) === "menu" && I.modeAssistant([{ nom: "A", assistant_wa_mode: "bizarre" }]) === "ia"
    && I.poserModeAssistant([{ nom: "A" }, { nom: "B" }], "menu").every((b) => b.assistant_wa_mode === "menu") && I.poserModeAssistant([{ nom: "A" }], "bizarre")[0].assistant_wa_mode === "ia");
  test("★ ⚙ Paramètres : le choix IA / menu, PRINCIPAL seul, revérifié dans le geste, qui DIT au moment de choisir que les messages partent hors du Togo, et montre la phrase de présentation",
    /data-assistant-mode=\{assistantMode\}/.test(param) && /const changerModeAssistant = async \(mode\) => \{\s*if \(refuserSaufAdminPrincipal\(db, profile/.test(param)
    && /poserModeAssistant\(db\.boutiques, mode\)/.test(param) && /lus par un service situé hors du Togo/.test(param) && /\{PHRASE_PRESENTATION\}/.test(param)
    && /jetée avant de partir/.test(param) && /ne se fait jamais passer pour une personne/.test(param));
  test("★ 📲 WhatsApp étiquette une phrase de l'IA « (IA) » et l'écran se rend avec une ligne de l'IA dans le fil",
    /\{m\.wa_assistant\.ia \? " \(IA\)" : ""\}/.test(ecranI) && (() => { const h = V.renduAvecIA(); return typeof h === "string" && !h.startsWith("ERREUR") && h.includes("(IA)"); })());
}

// ──────────────────────────────────────────────────────────────
titre("㉓ ☀️ L'ESTIMATION SOLAIRE DE L'ASSISTANT (24/09/2026, « 1 valeur par défaut, 2 en fourchette, 3 solaire »)");
// Timo : « est-ce pas possible d'utiliser l'outil de dimensionnement pour
// envoyer un devis solaire au client ? » → pas un devis (il engage BMI),
// une ESTIMATION en texte. Ce qui est protégé : la MÊME règle que le vendeur
// (le choix du matériel a quitté l'écran pour lib/choixSolaire.js), les
// valeurs par défaut de l'écran, ± 15 % arrondi sans jamais rétrécir, rien
// d'inventé (heures manquantes, stock incomplet → pas de chiffre), le mur
// (boutiques réelles seulement), le juge qui n'accepte que les deux montants
// de l'outil, et l'estimation qui suit sur la fiche 🧲 Prospects.
{
  const S = await import("../src/lib/choixSolaire.js");
  const I = await import("../src/lib/assistantIA.js");
  const { lireAppareils } = await import("../src/lib/besoinSolaire.js");
  const { CATALOGUE_APPAREILS, fusionnerCatalogue } = await import("../src/lib/catalogueAppareils.js");
  const codeS = lire("src/lib/choixSolaire.js").replace(/\/\/[^\n]*/g, "");
  const codeCat = lire("src/lib/catalogueAppareils.js").replace(/\/\/[^\n]*/g, "");
  const solJsx = lire("src/screens/dimensionnement/Solaire.jsx").replace(/\/\/[^\n]*/g, "");
  const partJsx = lire("src/screens/dimensionnement/Partages.jsx").replace(/\/\/[^\n]*/g, "");
  const appJs = lire("src/lib/appareils.js").replace(/\/\/[^\n]*/g, "");
  const entrantS = lire("api/whatsapp-entrant.js").replace(/\/\/[^\n]*/g, "");
  const prospectsS = lire("src/screens/Prospects.jsx");
  const paramS = lire("src/screens/Parametres.jsx");
  const MANDA = "2 clim de 1,5hp 8h par jour 10 ampoule de 15w toute la nuit Un congélateur de 200w branché h24";
  const stockA = [
    { id: "p1", nom: "PANNEAU 550W", categorie: "Panneaux solaires", prix_vente: 85000 },
    { id: "b1", nom: "BATERIE 51,2V 300AH", categorie: "Batteries", prix_vente: 1200000 },
    { id: "b2", nom: "BATTERIE GEL 12V 200AH", categorie: "Batteries", prix_vente: 150000 },
    { id: "c1", nom: "CONVERTISSEUR HYBRIDE 10KW 48V", categorie: "Convertisseur", prix_vente: 900000, tension: 48 },
    { id: "c2", nom: "CONVERTISSEUR 5000VA 24V", categorie: "Convertisseur", prix_vente: 300000, tension: 24 },
    { id: "r1", nom: "REGULATEUR MPPT 100A", categorie: "Régulateur MPPT", prix_vente: 200000 },
    { id: "e1", nom: "ETRIER", prix_vente: 500 }, { id: "s1", nom: "SUPPORT RAIL M8", prix_vente: 1000 },
  ];
  const stockB = stockA.map((p) => ({ ...p, id: `B${p.id}`, prix_vente: Math.round(p.prix_vente * 1.1) }));
  const bq = (nom, produits) => ({ nom, produits, prixRail: 5500, longueurRail: 4.2, idDomaineSolaire: "solaire" });
  const apM = lireAppareils(MANDA, CATALOGUE_APPAREILS);

  // ── LA MÊME RÈGLE QUE LE VENDEUR
  test("★★ le choix du matériel a QUITTÉ l'écran : Solaire.jsx appelle candidatsSolaire et choixDuStock, il ne les réécrit plus",
    /const candidats = \(role\) => candidatsSolaire\(produitsBoutique, role, \{ tension, typeBatterie, idDomaineSolaire, raccordement \}\);/.test(solJsx)
    && /return choixDuStock\(produitsBoutique, role, besoinParRole\[role\.id\], \{ tension, typeBatterie, idDomaineSolaire, raccordement \}\);/.test(solJsx)
    && !/const tensionInfereeBatterie = /.test(solJsx) && !/const MOTS_TYPE_BATTERIE = /.test(solJsx) && !/const ROLES_EQUIPEMENT = \[/.test(solJsx)
    && /const idDomaineSolaire = idDomaineSolaireDes\(db\.boutiques\);/.test(solJsx));
  test("★ Partages.jsx IMPORTE puis RÉEXPORTE (jamais `export … from`, qui ne crée pas de nom local)",
    /import \{ FACTEUR_PUISSANCE_VA, puissanceUtileW, quantiteNecessaire, simplifierMot, memeFamille, contientLeMot, specDepuisNom \} from "\.\.\/\.\.\/lib\/choixSolaire";/.test(partJsx)
    && /export \{ FACTEUR_PUISSANCE_VA, puissanceUtileW, quantiteNecessaire, simplifierMot, memeFamille, contientLeMot, specDepuisNom \};/.test(partJsx)
    && !/export function specDepuisNom/.test(partJsx));
  test("★★ lib/choixSolaire.js ne reçoit jamais `db` et n'importe que la règle de calcul (lisible par le serveur tel quel)",
    !/\bdb\b/.test(codeS) && (codeS.match(/^import /mg) || []).length === 1 && /from "\.\/solaire\.js"/.test(codeS));
  test("★ le catalogue des 60 appareils est SANS import, et lib/appareils.js le reprend (une seule liste)",
    !/^import /m.test(codeCat) && CATALOGUE_APPAREILS.length === 60 && fusionnerCatalogue([]).length === 60
    && fusionnerCatalogue([{ id: "led", retire: true }]).length === 59
    && /import \{ CATALOGUE_APPAREILS, fusionnerCatalogue \} from "\.\/catalogueAppareils";/.test(appJs) && /return fusionnerCatalogue\(/.test(appJs));
  test("★ le prix et la longueur du rail : UNE règle, que calculs.js reprend",
    S.prixRailDesBoutiques([]) === 5500 && S.prixRailDesBoutiques([{ prix_rail: 6000 }]) === 6000 && S.longueurRailDesBoutiques([]) === 4.2
    && /export const prixRailMetre = \(db\) => prixRailDesBoutiques\(db\?\.boutiques\);/.test(lire("src/lib/calculs.js")));

  // ── SES TROIS DÉCISIONS
  test("★★ « 1 valeur par défaut » : les réglages d'office de l'écran (autonomie 1 j, soleil 5 h, 48 V, lithium) ; « 2 en fourchette » : ± 15 %",
    S.REGLAGES_ESTIMATION.autonomie === "1" && S.REGLAGES_ESTIMATION.soleil === S.SOLEIL_DEFAUT && S.SOLEIL_DEFAUT === "5"
    && S.REGLAGES_ESTIMATION.tension === S.TENSION_DEFAUT && S.TENSION_DEFAUT === "48" && S.REGLAGES_ESTIMATION.typeBatterie === "lifepo4"
    && S.MARGE_FOURCHETTE === 0.15 && S.PCT_INSTALLATION_DEFAUT === 10);
  const eM = S.estimationSolaire(apM, [bq("DEMAKPOE", stockA)]);
  test("★★ la phrase de MANDA donne une estimation : 30,6 kWh/j, panneaux 550 W, batteries LITHIUM 48 V (jamais la gel 12 V), le convertisseur 48 V (jamais le 24 V)",
    eM.ok && eM.kwhParJour === 30.6 && eM.wcPanneau === 550 && eM.ahBatterie === 300 && eM.tension === 48 && eM.kwConvertisseur === 10 && eM.panneaux > 0);
  const t1 = S.chiffrageBoutique(S.estimationSolaire ? (await import("../src/lib/solaire.js")).besoinsSolaires(apM, S.REGLAGES_ESTIMATION) : null, bq("DEMAKPOE", stockA)).total;
  test("★★ la fourchette ENTOURE le calcul (± 15 %), en chiffres ronds, l'arrondi ne la rétrécit jamais",
    eM.bas <= t1 * 0.85 && eM.haut >= t1 * 1.15 && eM.bas % 50000 === 0 && eM.haut % 50000 === 0
    && eM.bas > t1 * 0.85 - 50000 && eM.haut < t1 * 1.15 + 50000);
  test("★ plusieurs boutiques : de la moins chère − 15 % à la plus chère + 15 % — on ne choisit pas une boutique à la place du client",
    (() => { const e2 = S.estimationSolaire(apM, [bq("A", stockA), bq("B", stockB)]); return e2.ok && e2.bas === eM.bas && e2.haut > eM.haut && e2.boutiques === 2; })());
  test("★★ RIEN D'INVENTÉ : une télé et des ventilateurs sans heures → pas de chiffre, et on dit lesquels",
    (() => { const e = S.estimationSolaire(lireAppareils("une télé et 3 ventilateurs", CATALOGUE_APPAREILS), [bq("A", stockA)]); return !e.ok && /Il manque la puissance ou les heures/.test(e.motif) && /Ventilateur/.test(e.motif) && e.bas === undefined; })());
  // Timo, 25/09/2026 : « une ampoule (c'est bon), 1 ampoule (c'est aussi bon),
  // les ampoules (ce n'est pas bon), quelques lumières (pas bon aussi) ».
  const estQ = (t) => S.estimationSolaire(lireAppareils(t, CATALOGUE_APPAREILS), [bq("A", stockA)]);
  test("★★ LE NOMBRE EST OBLIGATOIRE : « une ampoule » et « 1 ampoule » s'estiment",
    estQ("une ampoule 10h").ok === true && estQ("1 ampoule 10h").ok === true && estQ("dix ampoules 10h").ok === true);
  test("★★ LE NOMBRE EST OBLIGATOIRE : « les ampoules » et « quelques lumières » sont REFUSÉES, et le motif nomme l'appareil et demande combien",
    (() => { const a = estQ("les ampoules 10h"), b = estQ("quelques lumières 10h"), c = estQ("2 clim 1,5hp 8h et les ampoules 10h");
      return !a.ok && !b.ok && !c.ok && a.bas === undefined && /Il manque le NOMBRE pour : Ampoule LED/.test(a.motif) && /combien/.test(a.motif) && !/Climatiseur/.test(c.motif); })());
  test("★ le volet (🔆 Préparer le devis) garde 1 d'office sur « les ampoules » — le vendeur corrige ; seul le drapeau dit que le nombre manquait",
    (() => { const l = lireAppareils("les ampoules 10h", CATALOGUE_APPAREILS)[0]; return l.qte === "1" && l.qteDite === false; })()
    && S.estimationSolaire([{ nom: "Ampoule", puissance: "10", heures: "10", qte: "2" }], [bq("A", stockA)]).ok === true);
  test("★ l'outil refuse aussi, sans aucun montant permis",
    (() => { const r = I.executerOutil("estimer_solaire", { description: "quelques lumières 10h" }, { catalogue: CATALOGUE_APPAREILS, boutiquesSolaire: [bq("A", stockA)] }); return r.effets.prix.length === 0 && /NOMBRE/.test(r.resultat); })()
    && /« les ampoules » ou « quelques lumières » n'en est PAS un/.test(I.CONSIGNE_IA));
  test("★★ un stock sans batterie (ou sans panneau, sans convertisseur) ne chiffre pas — pas de prix sur un article qui n'existe pas",
    !S.estimationSolaire(apM, [bq("A", stockA.filter((p) => !/BAT/.test(p.nom)))]).ok
    && !S.estimationSolaire(apM, [bq("A", stockA.filter((p) => !/PANNEAU/.test(p.nom)))]).ok
    && !S.estimationSolaire(apM, []).ok && !S.estimationSolaire([], [bq("A", stockA)]).ok);
  test("★ un convertisseur hybride ne fait pas payer de régulateur en plus ; un non hybride, si",
    (() => {
      const bes = { wcPanneaux: 3000, ahBatterie: 100, wConvertisseur: 4000, aRegulateur: 80 };
      const avec = S.chiffrageBoutique(bes, bq("A", stockA)).total;
      const sans = S.chiffrageBoutique(bes, bq("A", stockA.map((p) => (p.id === "c1" ? { ...p, nom: "CONVERTISSEUR 10KW 48V" } : p)))).total;
      return sans > avec;
    })());
  const phrase = S.texteEstimation(eM);
  test("★★ la phrase au client : une fourchette, jamais « devis » comme promesse, « indicative », « un conseiller vous confirme »",
    phrase.includes("Comptez entre") && phrase.includes(S.PHRASE_INDICATIVE) && /indicative/.test(phrase) && /conseiller BMI TOGO vous confirme/.test(phrase)
    && I.garderReponse(phrase, { prixConnus: [eM.bas, eM.haut] }).ok === true);

  // ── L'OUTIL ET LE JUGE
  const ctxS = { catalogue: CATALOGUE_APPAREILS, boutiquesSolaire: [bq("DEMAKPOE", stockA)] };
  const out = I.executerOutil("estimer_solaire", { description: MANDA }, ctxS);
  test("★★ l'outil lit les MOTS du client par la règle de lecture (jamais des puissances fournies par l'IA) et rend exactement deux montants permis",
    out.effets.prix.length === 2 && out.effets.prix[0] === eM.bas && out.effets.prix[1] === eM.haut && out.effets.estimation.texte === phrase
    && /Recopier cette phrase telle quelle/.test(out.resultat) && I.OUTILS_IA.find((o) => o.name === "estimer_solaire").input_schema.required.join() === "description");
  const refus = I.executerOutil("estimer_solaire", { description: "une télé" }, ctxS);
  test("★★ refusée, l'outil ne donne AUCUN montant permis — le juge jetterait tout chiffre",
    refus.effets.prix.length === 0 && /Ne donner AUCUN chiffre/.test(refus.resultat)
    && I.garderReponse("Comptez environ 2 000 000 F.", { prixConnus: refus.effets.prix }).ok === false);
  test("★★ le juge lit aussi « 5,5 millions » et « 500 mille » (trou fermé le même jour) : un chiffre retouché est jeté",
    I.montantsCites("environ 5,5 millions de francs").join() === "5500000" && I.montantsCites("500 mille").join() === "500000"
    && I.garderReponse("Comptez environ 5,5 millions de francs.", { prixConnus: [eM.bas, eM.haut] }).ok === (eM.bas === 5500000 || eM.haut === 5500000)
    && I.garderReponse(phrase.replace(String(eM.haut.toLocaleString("fr-FR")), "9 999 000"), { prixConnus: [eM.bas, eM.haut] }).ok === false);
  test("★★ la consigne : estimation pour le SOLAIRE seulement, recopiée sans changer un chiffre, jamais un devis",
    /Jamais d'estimation pour le garage, la domotique, la VMC ou un produit seul/.test(I.CONSIGNE_IA)
    && /recopie sa phrase telle quelle, sans changer un seul chiffre/.test(I.CONSIGNE_IA) && /Une estimation n'est JAMAIS un devis/.test(I.CONSIGNE_IA));

  // ── LA VRAIE BOUCLE : estimer, puis enregistrer la demande — l'estimation suit sur la fiche
  let n = 0;
  const appeler = async () => {
    n++;
    if (n === 1) return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "estimer_solaire", input: { description: MANDA } }] };
    if (n === 2) return { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "enregistrer_demande_devis", input: { nom: "MANDA", besoin: MANDA } }] };
    return { stop_reason: "end_turn", content: [{ type: "text", text: `${phrase} Votre demande est enregistrée.` }] };
  };
  const conv = await I.converserAvecIA({ consigne: "", messages: [{ role: "user", content: MANDA }], appeler, executer: (nom, e) => I.executerOutil(nom, e, ctxS) });
  const juge = I.garderReponse(conv.texte, { prixConnus: conv.effets.prix });
  const rep = I.reponseDepuisIA({ texte: conv.texte, effets: conv.effets, juge, nouvelle: false });
  const fiche = I.demandeDevisIA({ cle: "90112233", tel: "+22890112233", demandeDevis: rep.demandeDevis, ts: "2026-09-24T10:00:00.000Z", estimation: rep.estimation });
  test("★★ la boucle : estimation puis demande — le juge accepte, l'estimation suit sur la fiche 🧲 Prospects (réelle, au nom de l'assistant)",
    juge.ok && rep.estimation?.bas === eM.bas && fiche.estimation_assistant.bas === eM.bas && fiche.estimation_assistant.haut === eM.haut
    && fiche.estimation_assistant.le === "2026-09-24" && fiche.source === "assistant_whatsapp" && !("formation" in fiche));
  test("★ une demande d'un tour SUIVANT retrouve l'estimation donnée plus tôt dans le fil (derniereEstimation) ; une phrase fixe ne la porte pas",
    I.derniereEstimation([{ wa_assistant: { etape: "ia", memoire: { estimation: { bas: 1 } } } }, { wa_assistant: { etape: "ia" } }]).bas === 1
    && I.derniereEstimation([]) === null
    && !("estimation" in I.reponseDepuisIA({ texte: "x 1 F", effets: { ...conv.effets }, juge: { ok: false, motif: "m" }, nouvelle: false })));

  // ── LE SERVEUR : le mur, la mémoire, la fiche
  test("★★ LE MUR : l'estimation ne regarde que les boutiques RÉELLES, chacune avec SON stock",
    /const reelles = boutiques\.filter\(\(b\) => b && b\.nom && !b\.formation\);/.test(entrantS)
    && /boutiquesSolaire: reelles\.map\(\(b\) => \(\{\s*nom: b\.nom,\s*produits: produits\.filter\(\(p\) => p\.boutique === b\.nom\),/.test(entrantS)
    && /catalogue: fusionnerCatalogue\(perso\)/.test(entrantS));
  test("★ le serveur donne le contexte solaire à l'outil, range l'estimation dans la mémoire de la ligne, et la pose sur la fiche du prospect",
    /\.\.\.\(nom === "estimer_solaire" \? await contexteSolaire\(\) : \{\}\),/.test(entrantS)
    && /const memoireR = r\.estimation \? \{ \.\.\.\(r\.memoire \|\| \{\}\), estimation: r\.estimation \} : \(r\.memoire \|\| null\);/.test(entrantS)
    && /demandeDevisIA\(\{ cle, tel: from, demandeDevis: r\.demandeDevis, ts, estimation: r\.estimation \|\| derniereEstimation\(fil\) \}\)/.test(entrantS));
  test("★ 🧲 Prospects montre au vendeur l'estimation donnée au client (RETOURNÉ le 25/09 : une pastille « bas – haut » sur la ligne du besoin) ; ⚙ Paramètres la décrit (solaire seulement, ± 15 %, réglages d'office)",
    /data-estimation-assistant/.test(prospectsS) && /\{fmt\(p\.estimation_assistant\.bas\)\} – \{fmt\(p\.estimation_assistant\.haut\)\}/.test(prospectsS)
    && /<b>solaire seulement<\/b>/.test(paramS) && /± 15 %/.test(paramS));
  // 24/09/2026 au soir, Timo : « si le client demande « Que faites-vous ? », il peut répondre : … ».
  test("★ « Que faites-vous ? » : le texte de Timo, mot pour mot, est dans la consigne avec l'ordre de le recopier tel quel ; il passe le juge (aucun montant, aucun sujet réservé, sous la limite) et garde la porte « conseiller »",
    I.TEXTE_QUE_FAISONS_NOUS.startsWith("🏢 BMI TOGO — Les bâtiments modernes et intelligents") && /• Motorisation de volets roulants/.test(I.TEXTE_QUE_FAISONS_NOUS)
    && I.TEXTE_QUE_FAISONS_NOUS.endsWith("écrivez simplement « conseiller ».")
    && I.CONSIGNE_IA.includes(I.TEXTE_QUE_FAISONS_NOUS) && /ce que fait BMI TOGO[^\n]*TEL QUEL/.test(I.CONSIGNE_IA)
    && I.garderReponse(I.TEXTE_QUE_FAISONS_NOUS, {}).ok === true && I.TEXTE_QUE_FAISONS_NOUS.length < I.MAX_LONGUEUR_REPONSE);
  // 25/09/2026, capture Timo : « il y a 2 bonjour dans un seul message… il ne demande pas au client de préciser la quantité ».
  test("★★ UN SEUL BONJOUR : la consigne d'une conversation nouvelle interdit de saluer, et le filet retire le salut (et le nom du client) que l'IA mettrait quand même — sans toucher à la suite, ni à « Bonjournée », ni à une conversation en cours",
    /Ne dis PAS bonjour/.test(I.consignePour({ nouvelle: true })) && /Ne redis pas bonjour/.test(I.consignePour({ nouvelle: false }))
    && I.sansSalutation("Bonjour 👋 Je ne peux pas lire les vidéos.") === "Je ne peux pas lire les vidéos."
    && I.sansSalutation("Bonsoir ESSO 😊 Voici nos batteries :", "ESSO") === "Voici nos batteries :"
    && I.sansSalutation("Bonjournée") === "Bonjournée" && I.sansSalutation("Je vous dis bonjour") === "Je vous dis bonjour"
    && I.reponseDepuisIA({ texte: "Bonjour 👋 Je ne peux pas lire les vidéos.", effets: { prix: [] }, juge: { ok: true }, nouvelle: true }).texte === `${I.PHRASE_PRESENTATION}\n\nJe ne peux pas lire les vidéos.`
    && I.reponseDepuisIA({ texte: "Bonjour !", effets: { prix: [] }, juge: { ok: true }, nouvelle: true }).texte === I.PHRASE_PRESENTATION
    && I.reponseDepuisIA({ texte: "Bonjour Kossi", effets: { prix: [] }, juge: { ok: true }, nouvelle: false }).texte === "Bonjour Kossi"
    && /consignePour\(\{ client: clientIA, nouvelle, presentation, metiers: domainesPourIA\(boutiques\), memo: memoAssistant\(boutiques\), rendu: !!decision\.rendu, dejaVu: [^}]* \}\)/.test(entrantS) && /nouvelle, presentation, nom: clientIA\?\.nom/.test(entrantS));
  test("★ LA QUANTITÉ SE DEMANDE : pour le solaire, la consigne exige le NOMBRE de chaque appareil avant d'estimer, et interdit de supposer qu'il y en a un seul",
    /COMBIEN il y en a \(le nombre\)/.test(I.CONSIGNE_IA) && /Ne suppose jamais qu'il y en a un seul/.test(I.CONSIGNE_IA));
  // 24/09/2026 au soir, Timo : « retire les guillemets ».
  {
    const phrase = "Pour environ 18,6 kWh par jour : 12 panneaux. Comptez entre 3\u202f300\u202f000 F et 4\u00a0550\u00a0000 F.";
    const avec = "Voici l'estimation ⚡\n\n« Pour environ 18,6 kWh par jour : 12 panneaux. Comptez entre 3 300 000 F et 4 550 000 F. »\n\nVoulez-vous un devis ?";
    const juge = I.garderReponse(avec, { prixConnus: [3300000, 4550000] });
    const r = I.reponseDepuisIA({ texte: avec, effets: { prix: [3300000, 4550000], estimation: { bas: 3300000, haut: 4550000, texte: phrase } }, juge, nouvelle: false });
    test("★★ l'estimation part SANS guillemets (« retire les guillemets ») : la consigne le dit, et la réponse est nettoyée même si l'IA en met — la phrase et ses chiffres ne bougent pas, un autre « … » du texte reste",
      /SANS guillemets autour/.test(I.CONSIGNE_IA) && !!r && !/[«»]/.test(r.texte) && r.texte.includes("Comptez entre 3 300 000 F et 4 550 000 F.")
      && I.sansGuillemetsAutour('x "' + phrase + '" y', phrase) === "x " + phrase + " y"
      && I.sansGuillemetsAutour("Écrivez « conseiller ». " + phrase, phrase) === "Écrivez « conseiller ». " + phrase);
  }
}

// ──────────────────────────────────────────────────────────────
titre("㉔ LA MISE EN RELATION SE VOIT, ET L'ARTICLE SE DÉCRIT (25/09/2026)");
// Timo : « comment se fait la mise en relation avec un conseiller ?… j'ai
// compris qu'il n'y a pas une suite » → « lance les deux ».
{
  const A = await import("../src/lib/assistantWhatsapp.js");
  const I = await import("../src/lib/assistantIA.js");
  const stocksS = lire("src/screens/Stocks.jsx");
  const waS = lire("src/screens/Whatsapp.jsx").replace(/\/\/[^\n]*/g, "");
  const relais = A.ligneAssistant({ cle: "1", tel: "1", texte: "x", etape: A.ETAPE_CONSEILLER, ts: "2026-09-25T07:21:00Z" });
  const menu = A.ligneAssistant({ cle: "1", tel: "1", texte: "x", etape: A.ETAPE_MENU, ts: "2026-09-25T07:25:00Z" });
  const entrant = { canal: "whatsapp", wa_entrant: true, ts: "2026-09-25T07:22:00Z" };
  const personne = { canal: "whatsapp", wa_entrant: false, de_id: "TIMO", ts: "2026-09-25T07:30:00Z" };
  const systeme = { canal: "whatsapp", wa_systeme: true, ts: "2026-09-25T07:31:00Z" };
  test("★★ un client attend un conseiller tant que le DERNIER mot de BMI est l'assistant qui a passé la main (même si le client réécrit, même après un « Confier »)",
    A.attenteConseiller([relais])?.depuis === "2026-09-25T07:21:00Z" && !!A.attenteConseiller([relais, entrant]) && !!A.attenteConseiller([relais, entrant, systeme]));
  test("★★ la pastille disparaît dès qu'une PERSONNE a écrit après, ou que l'assistant a repris (le client a redemandé le menu)",
    A.attenteConseiller([relais, entrant, personne]) === null && A.attenteConseiller([relais, entrant, menu]) === null
    && A.attenteConseiller([menu]) === null && A.attenteConseiller([entrant]) === null && A.attenteConseiller([]) === null);
  test("★ le temps d'attente se lit en clair (min, h, j), jamais négatif",
    A.libelleAttente("2026-09-25T07:21:00Z", "2026-09-25T07:33:00Z") === "depuis 12 min"
    && A.libelleAttente("2026-09-25T07:21:00Z", "2026-09-25T09:26:00Z") === "depuis 2 h 05"
    && A.libelleAttente("2026-09-25T07:21:00Z", "2026-09-28T07:21:00Z") === "depuis 3 j"
    && A.libelleAttente("2026-09-25T07:21:00Z", "2026-09-25T07:00:00Z") === "depuis 0 min");
  const hL = V.renduAttente(false), hF = V.renduAttente(true), hR = V.renduAttenteRepondue();
  test("★★ l'écran RENDU : la ligne de la liste porte « 👨‍💼 Attend un conseiller depuis 12 min », le fil ouvert porte le bandeau",
    /data-attente-conseiller="1"[^>]*>👨‍💼 Attend un conseiller depuis 1[12] min/.test(hL) && /data-attente-conseiller="fil"/.test(hF) && /L’assistant s’est tu|L'assistant s'est tu|L&#x27;assistant s&#x27;est tu/.test(hF));
  test("★★ une personne a répondu : ni pastille, ni bandeau", !/data-attente-conseiller/.test(hR) && !/ERREUR/.test(hR));
  test("★ une ligne GRISÉE ne calcule rien (elle n'a pas de fil)", /const attente = verrou \? null : attenteConseiller\(c\.fil\);/.test(waS));

  // ── L'ARTICLE SE DÉCRIT : un champ À PART, jamais les notes internes
  const boutiques = [{ nom: "DEMAKPOE" }, { nom: "ECOLE", formation: true }];
  const produits = [
    { id: "m1", nom: "MOTEUR CENTRAL 600KG", categorie: "Moteurs", boutique: "DEMAKPOE", prix_vente: 250000, initial: 2,
      notes: "SECRET INTERNE acheté 150 000 chez X", note_assistant: "Moteur central pour rideau métallique, monté au centre de l'axe." },
    { id: "m2", nom: "MOTEUR BATTANT", categorie: "Moteurs", boutique: "DEMAKPOE", prix_vente: 300000, initial: 1, notes: "fournisseur Y" },
  ];
  const arts = A.articlesPourAssistant({ produits, boutiques });
  const json = I.executerOutil("chercher_article", { recherche: "moteur" }, { articles: arts }).resultat;
  test("★★ LES NOTES INTERNES NE SORTENT JAMAIS : ni dans la liste des articles, ni dans ce que l'outil rend à l'IA, ni dans le menu",
    !JSON.stringify(arts).includes("SECRET") && !json.includes("SECRET") && !json.includes("fournisseur Y")
    && !A.texteArticles("moteur", A.chercherArticles(arts, "moteur")).includes("SECRET"));
  test("★★ la description écrite pour l'assistant, elle, sort : dans l'outil (seulement si elle existe) et sous la ligne du menu",
    json.includes("rideau métallique") && JSON.parse(json).find((a) => a.nom === "MOTEUR BATTANT").description === undefined
    && A.texteArticles("moteur", A.chercherArticles(arts, "moteur")).includes("\n   Moteur central pour rideau métallique"));
  test("★★ la recherche regarde AUSSI la description : « moteur rideau » trouve le moteur central, rien de plus",
    A.chercherArticles(arts, "moteur rideau").map((a) => a.nom).join() === "MOTEUR CENTRAL 600KG");
  test("★ elle est bornée (400 caractères) et le mur tient toujours (formation jamais citée)",
    A.noteAssistantDe({ note_assistant: "x".repeat(900) }).length === A.NOTE_ASSISTANT_MAX && A.NOTE_ASSISTANT_MAX === 400
    && A.articlesPourAssistant({ produits: [{ ...produits[0], boutique: "ECOLE" }], boutiques }).length === 0);
  test("★★ la fiche article : le champ existe à la CRÉATION, à la PRÉSÉLECTION et à la CORRECTION (leçon des pompes : recopié dans `apres`)",
    /note_assistant: \(f\.note_assistant \|\| ""\)\.trim\(\) \}\] \}/.test(stocksS)
    && /notes: \(f\.notes \|\| ""\)\.trim\(\),\n(?:\s*\/\/[^\n]*\n)*\s*note_assistant: \(f\.note_assistant \|\| ""\)\.trim\(\),/.test(stocksS)
    && /note_assistant: p\.note_assistant \|\| ""/.test(stocksS) && /note_assistant: a\.note_assistant \|\| ""/.test(stocksS)
    && /\["note_assistant", "Ce que l'assistant dit aux clients", "texte"\]/.test(stocksS));
  test("★ l'écran AVERTIT que ce texte est répété aux clients (jamais de prix d'achat ni de fournisseur), à part des « Notes internes »",
    /répété aux clients<\/b> : jamais de prix d'achat, de fournisseur ni de remarque interne/.test(stocksS) && /📝 Notes internes/.test(stocksS));
  test("★ la consigne : la description se redit sans rien y ajouter ; sans elle, on ne décrit pas au-delà du nom",
    /c'est BMI TOGO qui l'a écrite/.test(I.CONSIGNE_IA) && /Sans description, tu ne décris pas l'article au-delà de son nom/.test(I.CONSIGNE_IA));
}

// ──────────────────────────────────────────────────────────────
titre("㉕ L'ALERTE WHATSAPP À L'ADMINISTRATEUR (25/09/2026, « Lance avec ce texte »)");
{
  const W = await import("../src/lib/whatsappModeles.js");
  const ent = lire("api/whatsapp-entrant.js").replace(/\/\/[^\n]*/g, "");
  const par = lire("src/screens/Parametres.jsx");
  test("★★ le texte de Timo, mot pour mot, avec ses trois trous dans l'ordre : l'administrateur, le client, son numéro",
    W.TEXTE_ALERTE_CONSEILLER === "Bonjour {{1}}, un client demande à parler à un conseiller : {{2}} ({{3}}). Répondez-lui depuis l'application BMI, onglet WhatsApp. BMI TOGO"
    && W.variablesAlerte({ administrateur: "TIMO", client: "ESSO", numero: "+22890112233" }).join("|") === "TIMO|ESSO|+22890112233"
    && W.MODELES.alerte_conseiller.variables.join() === "administrateur,client,numero");
  test("★ jamais un trou vide (Meta refuse) : un client sans nom reste nommé",
    W.variablesAlerte({ administrateur: "", client: "", numero: "" }).every((v) => v.length > 0));
  test("★★ le numéro : vide = coupée ; trop court refusé ; le numéro BMI LUI-MÊME refusé (il ne s'écrit pas à lui-même)",
    W.critiqueNumeroAlerte("") === "" && W.critiqueNumeroAlerte("90112233") === "" && W.critiqueNumeroAlerte("+228 90 11 22 33") === ""
    && /trop court/.test(W.critiqueNumeroAlerte("9011")) && /numéro BMI lui-même/.test(W.critiqueNumeroAlerte("+228 99 96 84 88")));
  // RETOURNÉ le 07/10/2026 (« A oui ») : une LISTE de 4 conseillers au plus, tous reçoivent l'alerte.
  test("★★ LE MUR : la liste ne se lit QUE sur une boutique réelle ; l'ancien réglage (un seul numéro) se lit encore",
    W.conseillersAlerte([{ nom: "ECOLE", formation: true, alerte_conseiller: { conseillers: [{ tel: "90000000", nom: "X" }] } }]).length === 0
    && W.conseillersAlerte([{ nom: "A", alerte_conseiller: { tel: "90112233", nom: "TIMO" } }]).map((c) => c.nom + c.tel).join() === "TIMO90112233"
    && W.conseillersAlerte(W.poserConseillersAlerte([{ nom: "A" }, { nom: "E", formation: true }], [{ tel: "90112233", nom: "TIMO" }, { tel: "91000000", nom: "KOSSI" }])).length === 2
    && W.conseillersAlerte(W.poserConseillersAlerte([{ nom: "A", alerte_conseiller: { tel: "90112233" } }], [])).length === 0);
  test("★★ la liste : 4 au plus, un nom et un vrai numéro chacun, jamais le numéro BMI, jamais deux fois le même numéro, vide = coupée",
    W.MAX_CONSEILLERS_ALERTE === 4 && W.critiqueConseillersAlerte([]) === ""
    && W.critiqueConseillersAlerte([{ nom: "TIMO", tel: "90112233" }, { nom: "KOSSI", tel: "+228 91 00 00 00" }]) === ""
    && /au plus/.test(W.critiqueConseillersAlerte([1, 2, 3, 4, 5].map((i) => ({ nom: `N${i}`, tel: `9${i}000000` }))))
    && /manque le numéro de KOSSI/.test(W.critiqueConseillersAlerte([{ nom: "KOSSI", tel: "" }]))
    && /manque le nom/.test(W.critiqueConseillersAlerte([{ nom: "", tel: "90112233" }]))
    && /numéro BMI lui-même/.test(W.critiqueConseillersAlerte([{ nom: "A", tel: "99968488" }]))
    && /déjà dans la liste/.test(W.critiqueConseillersAlerte([{ nom: "A", tel: "90112233" }, { nom: "B", tel: "+228 90 11 22 33" }]))
    && W.critiqueConseillersAlerte([{ nom: "", tel: "" }, { nom: "A", tel: "90112233" }]) === "");
  test("★★ le serveur l'envoie UNE fois par demande (le tour où l'assistant passe la main), jamais pour un devis, et un échec ne coupe rien",
    /if \(assistant\.repondu && assistant\.conseiller && !assistant\.devis\) \{\s*try \{\s*await envoyerAlerteConseiller\(/.test(ent)
    && /console\.error\("\[whatsapp-entrant\] alerte conseiller"/.test(ent)
    && (ent.match(/envoyerAlerteConseiller\(/g) || []).length === 2);
  test("★★ le serveur relit la liste, écarte un numéro refusé, envoie à CHAQUE conseiller avec SON nom par la porte commune, un refus n'arrête pas les autres, et n'écrit rien",
    (() => { const i = ent.indexOf("async function envoyerAlerteConseiller"); const corps = ent.slice(i, ent.indexOf("\n}", i));
      return /conseillersAlerte\(boutiques\)\.filter\(\(c\) => !critiqueNumeroAlerte\(c\.tel\)\)/.test(corps)
        && /for \(const c of conseillers\)/.test(corps) && /administrateur: c\.nom/.test(corps)
        && /try \{[\s\S]*envoyerYCloud\([\s\S]*\} catch/.test(corps)
        && /name: "alerte_conseiller"/.test(corps) && !/admin\.from\(/.test(corps) && !/return \{ envoyes: 0, pourquoi: "WhatsApp a refusé/.test(corps); })());
  test("★ ⚙ Paramètres : principal seul (revérifié dans le geste), la liste critiquée, le texte montré tel quel, ➕ jusqu'à 4",
    /refuserSaufAdminPrincipal\(db, profile, "Régler l'alerte WhatsApp des conseillers"\)/.test(par)
    && /const motif = critiqueConseillersAlerte\(conseillers\);/.test(par) && /\{TEXTE_ALERTE_CONSEILLER\}/.test(par)
    && /poserConseillersAlerte\(db\.boutiques, liste\)/.test(par)
    && /conseillers\.length < MAX_CONSEILLERS_ALERTE && <button onClick=\{ajouterConseiller\}/.test(par) && /data-liste-conseillers/.test(par));
  test("★ aucun écran ne l'envoie (serveur seul)",
    ["src/screens/Whatsapp.jsx", "src/whatsapp.js", "src/screens/Parametres.jsx"].every((f) => !/modele: "alerte_conseiller"|envoyerModele\([^)]*alerte_conseiller/.test(lire(f))));
}

// ──────────────────────────────────────────────────────────────
titre("㉖ LE CONSEIL GÉNÉRAL DANS LES MÉTIERS DE BMI (25/09/2026, décision « A »)");
// Timo : « il devrait avoir une large idée des domaines dans lesquels nous
// exerçons… conseiller et essayer d'orienter les clients ». Les FAITS de BMI
// restent aux outils ; le conseil général est ouvert, bridé.
{
  const I = await import("../src/lib/assistantIA.js");
  const C = I.CONSIGNE_IA;
  test("★★ le conseil général est OUVERT, dans les métiers de BMI, présenté comme général et confirmé par un conseiller, puis ramené vers un article, une estimation ou un devis",
    // ⚠ RETOURNÉ le 01/10/2026 : le pompage solaire et le forage entrent dans la liste du conseil général.
    /LE CONSEIL GÉNÉRAL dans les métiers de BMI TOGO/.test(C) && /énergie solaire, pompage solaire et forage, domotique, motorisation/.test(C) && /ventilation VMC/.test(C)
    && /conseil GÉNÉRAL \(« en général »/.test(C) && /un conseiller BMI TOGO confirme pour son cas précis/.test(C)
    && /tu ramènes vers une solution concrète/.test(C));
  test("★★ les FAITS de BMI restent aux outils : rien d'inventé sur BMI (prix, délai, garantie, article précis, stock)",
    /Un FAIT DE BMI TOGO que l'outil ne t'a pas donné/.test(C) && /Tu n'inventes RIEN sur BMI/.test(C));
  test("★★ jamais un prix « en général » ni une économie en francs, jamais une promesse chiffrée, jamais hors métier ni dangereux",
    /Un prix « en général », un ordre de prix ou une économie en francs/.test(C)
    && /Une promesse de résultat chiffrée/.test(C) && /conseil dangereux/.test(C));
  test("★★ et le juge tient toujours : un conseil qui glisse un prix « en général » est JETÉ, un conseil sans montant passe",
    I.garderReponse("En général un kit solaire complet coûte autour de 2 000 000 F.", { prixConnus: [] }).ok === false
    && I.garderReponse("En général, un système hybride convient quand vous avez le réseau CEET : il recharge les batteries la nuit. Un conseiller BMI TOGO confirme pour votre cas.", { prixConnus: [] }).ok === true);
}

// ──────────────────────────────────────────────────────────────
titre("㊳ L'ASSISTANT NE DIT JAMAIS CE QUE BMI NE FAIT PAS (30/09/2026, capture Timo : le forage)");
// « Installation de forage » → « ne fait pas partie des services de BMI
// TOGO » : FAUX, les pompes vivent dans le métier Forage. Un fait de BMI
// inventé : la consigne l'interdit, le juge le JETTE, un conseiller confirme.
{
  const I = await import("../src/lib/assistantIA.js");
  const W = await import("../src/lib/assistantWhatsapp.js");
  const phraseCapture = "Merci pour la précision 🙏 Mais l'installation de forage (pompage d'eau) ne fait pas partie des services de BMI TOGO. Nous nous occupons plutôt d'énergie solaire, d'automatisation (portails, garages), de domotique et de VMC.";
  const j = I.garderReponse(phraseCapture, { prixConnus: [] });
  test("★★ la phrase EXACTE de la capture est JETÉE par le juge",
    j.ok === false && j.metierNie === true);
  test("★★ d'autres façons de le dire aussi (« nous ne faisons pas », « BMI TOGO ne propose pas », « en dehors de nos services »)",
    ["Désolé, nous ne faisons pas de forage.", "BMI TOGO ne propose pas la vidéosurveillance.", "C'est en dehors de nos services.", "Ce n'est pas dans nos activités."]
      .every((t) => I.garderReponse(t, { prixConnus: [] }).metierNie === true));
  test("★★ jetée, elle ne se tait pas : un conseiller prend le relais (phrase fixe, étape conseiller)",
    (() => { const r = I.reponseDepuisIA({ texte: phraseCapture, effets: { prix: [], demandeDevis: null, conseiller: false }, juge: j, nouvelle: false });
      return !!r && r.texte.includes(W.TEXTE_RELAIS_CONSEILLER) && r.conseiller === true && r.etape === W.ETAPE_CONSEILLER; })());
  test("★ aucune de NOS phrases ne tombe sous ce juge (présentation, « que faites-vous », relais, sujet réservé)",
    [I.TEXTE_QUE_FAISONS_NOUS, I.REPONSE_SUJET_RESERVE, W.TEXTE_RELAIS_CONSEILLER, W.TEXTE_ACCUEIL].every((t) => !I.METIER_NIE.test(t)));
  test("★ un conseil ordinaire passe toujours",
    I.garderReponse("Pour un forage, en général on choisit la pompe d'après le niveau dynamique donné par le foreur. Je peux enregistrer une demande de devis.", { prixConnus: [] }).ok === true);
  test("★★ la consigne l'interdit en toutes lettres, et nomme le forage",
    /Que BMI TOGO NE FAIT PAS quelque chose/.test(I.CONSIGNE_IA) && /forage, pompe/.test(I.CONSIGNE_IA));
  test("★★ les métiers réglés dans l'application entrent dans la consigne — boutiques RÉELLES seulement (le mur)",
    (() => { const bq = [{ nom: "F", formation: true, domaines: [{ nom: "Entraînement" }] }, { nom: "R", domaines: [{ nom: "Solaire" }, { nom: "Forage" }] }];
      // ⚠ RETOURNÉ le 01/10/2026 (« il faut qu'il accède à nos domaines ») : les métiers arrivent AVEC leurs familles.
      const m = I.domainesPourIA(bq); const c = I.consignePour({ metiers: m });
      return m.map((d) => d.nom).join("|") === "Solaire|Forage" && /RÉGLÉS DANS L'APPLICATION, avec leurs familles d'articles : Solaire ; Forage/.test(c) && !/Entraînement/.test(c); })());
  test("★ le serveur les passe à la consigne",
    /consignePour\(\{ client: clientIA, nouvelle, presentation, metiers: domainesPourIA\(boutiques\), memo: memoAssistant\(boutiques\), rendu: !!decision\.rendu, dejaVu: [^}]* \}\)/.test(lire("api/whatsapp-entrant.js")));
}

// ──────────────────────────────────────────────────────────────
titre("㊴ LA PROFORMA PART DU NUMÉRO BMI (30/09/2026, le texte de Timo)");
{
  const M2 = await import("../src/lib/whatsappModeles.js");
  const V = lire("src/screens/Ventes.jsx");
  const f = (n) => `${Number(n).toLocaleString("fr-FR")} F`;
  const pf = { numero: "PRF-ABC123", date: "30/09/2026", boutique: "BMI DEMAKPOE", client: "KOFFI", tel: "90 11 22 33",
    lignes: [{ article: "Panneau 400W", qte: 4 }, { article: "Batterie 200Ah", qte: 1 }], total: 850000 };
  const e = M2.envoiProforma({ proforma: pf, boutique: { tel: "+228 91 00 00 00" }, fin: "15/10/2026", fmt: f });
  test("★★ les huit trous dans l'ordre : client, n°, date, boutique, articles sur UNE ligne, total, fin de validité, téléphone de la boutique",
    !!e && e.modele === "proforma" && e.variables[0] === "KOFFI" && e.variables[1] === "PRF-ABC123" && e.variables[2] === "30/09/2026"
    && e.variables[3] === "BMI DEMAKPOE" && e.variables[4] === "4 × Panneau 400W · 1 × Batterie 200Ah" && e.variables[5] === f(850000)
    && e.variables[6] === "15/10/2026" && e.variables[7] === "+228 91 00 00 00" && !e.variables.some((v) => /\n/.test(v)));
  test("★ sans numéro (ou sans article), rien ne part du numéro BMI",
    M2.envoiProforma({ proforma: { ...pf, tel: "+228" }, fin: "15/10/2026", fmt: f }) === null
    && M2.envoiProforma({ proforma: { ...pf, lignes: [] }, fin: "15/10/2026", fmt: f }) === null);
  test("★ sans téléphone sur la boutique, le numéro BMI principal (Meta refuse un trou vide)",
    M2.envoiProforma({ proforma: pf, boutique: {}, fin: "15/10/2026", fmt: f }).variables[7] === M2.NUMERO_BMI_PRINCIPAL);
  test("★ la fin de l'offre = le jour + 15 jours (fin de mois comprise)",
    M2.finDeValidite("2026-09-30", 15) === "2026-10-15" && M2.finDeValidite("2026-12-25", 15) === "2027-01-09");
  test("★ le message entier reste sous la limite de Meta, même avec 60 articles",
    (() => { const big = M2.envoiProforma({ proforma: { ...pf, lignes: Array.from({ length: 60 }, (_, i) => ({ article: `Article numéro ${i} assez long`, qte: 2 })) }, fin: "15/10/2026", fmt: f });
      return !!big && M2.texteRecu(big).length <= M2.LIMITE_MESSAGE_META && /\+ \d+ autres articles/.test(big.variables[4]); })());
  test("★ le texte de Timo, marketing, en service",
    M2.MODELES.proforma.categorie === "marketing" && M2.MODELES_EN_SERVICE.includes("proforma")
    && /Voici votre proforma BMI TOGO N° \{\{2\}\} du \{\{3\}\} \(\{\{4\}\}\)/.test(M2.TEXTE_PROFORMA) && /merci pour votre confiance$/.test(M2.TEXTE_PROFORMA));
  const corps = (() => { const i = V.indexOf("const proformaWhatsApp = async"); return V.slice(i, V.indexOf("const proformaPDF", i)); })();
  test("★★ 💰 Ventes : le PDF d'abord, UNE question, puis le numéro BMI — le mur = la BOUTIQUE de la proforma",
    corps.indexOf("genererProforma(") > 0 && corps.indexOf("genererProforma(") < corps.indexOf("uConfirm(`Envoyer la proforma")
    && corps.indexOf("uConfirm(`Envoyer la proforma") < corps.indexOf("envoyerModele(")
    && /espaceFormation: !!bqPf\.formation/.test(corps) && !/estCompteFormation\(db, profile\)/.test(corps));
  test("★★ partie du numéro BMI : la ligne entre dans 📲 WhatsApp, SANS donner la conversation ; sinon le repli d'avant, annoncé AVANT",
    /messagesAvecLigneEnvoi\(e\.messages, \{ profile, tel: pf\.tel/.test(corps) && !/donnerAuSender/.test(corps)
    && /texteRepli: lignes\.join/.test(corps) && /prevenir: uAlert/.test(corps) && /ouvrirWhatsAppApresAnnonce\(/.test(corps));
}

// ──────────────────────────────────────────────────────────────
titre("㉗ 🧲 PROSPECTS : LE BESOIN SUR SA LIGNE, L'ESTIMATION UNE FOIS (25/09/2026)");
// Capture Timo : « ce n'est pas agréable à regarder… tous les détails dans
// localisation ? » → « lance les deux ».
{
  const I = await import("../src/lib/assistantIA.js");
  const P = lire("src/screens/Prospects.jsx");
  const cellLoc = (() => { const i = P.indexOf("{p.localisation || (p.lat"); return P.slice(i, P.indexOf("</td>", i)); })();
  test("★★ la case Localisation ne porte QUE le lieu (ni le besoin, ni l'estimation)",
    cellLoc.length > 0 && !/p\.nature/.test(cellLoc) && !/estimation_assistant/.test(cellLoc));
  test("★★ le besoin a SA ligne sur toute la largeur, deux lignes au plus, un clic l'ouvre, un second le replie (un seul déplié)",
    /<td colSpan=\{10\}/.test(P) && /line-clamp-2/.test(P) && /setBesoinDeplie\(deplie \? null : p\.id\)/.test(P)
    && /const deplie = besoinDeplie === p\.id;/.test(P) && /data-besoin-prospect/.test(P));
  test("★ l'estimation n'apparaît qu'UNE fois sur l'écran, en pastille",
    (P.match(/data-estimation-assistant/g) || []).length === 1);
  // ⚠ RETOURNÉ le 15/10/2026 (« Tous, lance ») : la ligne se déplie au clic,
  // la cellule figée porte le fond de la ligne (orange en retard, bleu dépliée).
  test("★★ le NOM reste figé pendant le défilement horizontal (« comme dans stock ») : première colonne, par LA règle commune enTeteFige / celluleFigee, fond de la ligne gardé (orange sur une relance en retard, bleu dépliée)",
    /\{\["Nom", "Date", "Numéro",/.test(P) && /\$\{i === 0 \? ` \$\{enTeteFige\("bg-white"\)\}` : ""\}/.test(P)
    && /const fond = enRetard \? "bg-orange-50" : "";/.test(P)
    && /<td className=\{`px-3 py-2 font-semibold min-w-\[170px\] \$\{celluleFigee\(fondLigneDepliable\(deplie, i, fond\), deplie\)\}`\}>\s*\{p\.nom\}/.test(P)
    && !/sticky left-0/.test(P));
  test("★ les gestes sont des boutons ronds qui passent à la ligne (RETOURNÉ le 15/10/2026 : CelluleActions bridée)",
    /<CelluleActions largeur="min-w-\[150px\] max-w-\[230px\]">/.test(P) && !/className="text-xs[^"]*underline/.test(P.slice(P.indexOf("<table"), P.indexOf("</table>"))));
  const capture = "Installation solaire pour : clim 2 CV 13h/jour, frigo 24h/24, 7 ampoules 10h/jour, ventilateur 13h/jour, TV 9h/jour. Estimation donnée : ~34,2 kWh/jour, 22 panneaux 400W, 4 batteries 200Ah 48V, convertisseur 5,5 kW, entre 4 600 000 et 6 250 000 F CFA.";
  test("★★ le besoin enregistré par l'assistant ne garde QUE ce que le client a dit (la phrase de sa capture)",
    I.besoinSansEstimation(capture) === "Installation solaire pour : clim 2 CV 13h/jour, frigo 24h/24, 7 ampoules 10h/jour, ventilateur 13h/jour, TV 9h/jour."
    && I.executerOutil("enregistrer_demande_devis", { besoin: capture, nom: "Gaelle" }, {}).effets.demandeDevis.besoin.indexOf("Estimation") === -1);
  test("★ le filet ne vide jamais un besoin, et ne touche pas un besoin sans chiffre",
    I.besoinSansEstimation("Estimation") === "Estimation" && I.besoinSansEstimation("2 clim 1,5hp 8h. 10 ampoules 15w la nuit") === "2 clim 1,5hp 8h. 10 ampoules 15w la nuit");
  test("★ la consigne et l'outil le disent : jamais l'estimation ni un montant dans le besoin",
    /jamais l'estimation ni un montant : l'application garde l'estimation à part/.test(I.CONSIGNE_IA)
    && /Jamais l'estimation ni aucun montant/.test(JSON.stringify(I.OUTILS_IA)));
}

// ──────────────────────────────────────────────────────────────
titre("㉘ 🧾 LE REÇU D'UN VERSEMENT ET D'UNE RÉSERVATION (25/09/2026, « Lance avec ces deux textes »)");
{
  const fmtR = (n) => `${Number(n || 0).toLocaleString("fr-FR")} F`;
  const dFRr = (x) => String(x || "").split("-").reverse().join("/");
  test("★★ les deux textes de Timo, mot pour mot",
    M.TEXTE_RECU_REGLEMENT === "Bonjour {{1}},\nBMI TOGO a bien reçu votre versement de {{2}} le {{3}} ({{4}}).\nReçu N° {{5}} : {{6}}.\nPour toute question veuillez contacter : {{7}}.\nMerci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents\nwww.bmitogo.com"
    && M.TEXTE_RECU_RESERVATION === "Bonjour {{1}},\nVotre réservation du {{2}} à {{3}} est bien enregistrée.\nRéservation N° {{4}} : {{5}}, {{6}}.\nLa marchandise vous sera remise dès qu'elle sera disponible.\nPour toute question veuillez contacter : {{7}}.\nMerci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents");
  test("★ les deux sont EN SERVICE (un écran peut les envoyer)",
    M.MODELES_EN_SERVICE.includes("recu_reglement") && M.MODELES_EN_SERVICE.includes("recu_reservation"));
  const dette = { id: "D1", numero: "DET-0007", client: "ESSO", tel: "90112233", boutique: "BMI DEMAKPOE", montant: 160000, paye: 110000 };
  const versement = { montant: 60000, date: "2026-09-25", paiement: "Mobile Money (Flooz)" };
  const e1 = M.envoiRecuReglement({ dette, versement, boutique: { tel: "+228 91 13 05 11" }, fmt: fmtR, dFR: dFRr });
  test("★★ le versement : les sept trous — nom, montant VERSÉ, date, moyen, n° de la dette, CE QUI RESTE, téléphone de la boutique",
    e1 && e1.modele === "recu_reglement"
    && e1.variables.join("|") === `ESSO|${fmtR(60000)}|25/09/2026|par Mobile Money (Flooz)|DET-0007|il reste ${fmtR(50000)} sur un total de ${fmtR(160000)}|+228 91 13 05 11`
    && M.critiqueModele("recu_reglement", e1.variables) === "");
  test("★★ le DERNIER versement dit « votre compte est soldé, merci », jamais « il reste 0 F »",
    M.envoiRecuReglement({ dette: { ...dette, paye: 160000 }, versement, boutique: {}, fmt: fmtR, dFR: dFRr }).variables[5] === "votre compte est soldé, merci");
  test("★ en espèces → « en espèces » ; sans numéro, ou sans montant → aucun reçu ; boutique sans téléphone → le numéro BMI",
    M.moyenVersement("Espèces") === "en espèces" && M.moyenVersement("Virement bancaire") === "par virement bancaire"
    && M.envoiRecuReglement({ dette: { ...dette, tel: "" }, versement, boutique: {}, fmt: fmtR, dFR: dFRr }) === null
    && M.envoiRecuReglement({ dette, versement: { ...versement, montant: 0 }, boutique: {}, fmt: fmtR, dFR: dFRr }) === null
    && M.envoiRecuReglement({ dette, versement, boutique: {}, fmt: fmtR, dFR: dFRr }).variables[6] === M.NUMERO_BMI_PRINCIPAL);
  const resa = { id: "R1", numero: "DET-0008", client: "AYOKO", tel: "90114455", boutique: "BMI DEMAKPOE", date: "2026-09-25", montant: 300000, paye: 100000, type: "prepaye" };
  const e2 = M.envoiRecuReservation({ reservation: resa, boutique: {}, fmt: fmtR, dFR: dFRr });
  test("★★ la réservation : nom, date, boutique, n°, TOTAL, « avance …, reste … », téléphone",
    e2 && e2.modele === "recu_reservation"
    && e2.variables.join("|") === `AYOKO|25/09/2026|BMI DEMAKPOE|DET-0008|${fmtR(300000)}|avance ${fmtR(100000)}, reste ${fmtR(200000)}|${M.NUMERO_BMI_PRINCIPAL}`
    && M.critiqueModele("recu_reservation", e2.variables) === "");
  test("★ réservation sans avance, ou payée en entier : la formule le DIT",
    M.envoiRecuReservation({ reservation: { ...resa, paye: 0 }, boutique: {}, fmt: fmtR, dFR: dFRr }).variables[5] === `aucune avance, reste ${fmtR(300000)}`
    && M.envoiRecuReservation({ reservation: { ...resa, paye: 300000 }, boutique: {}, fmt: fmtR, dFR: dFRr }).variables[5] === "entièrement payée");
  test("★ le texte lisible remplit les sept trous, et la ligne du fil le raconte",
    M.texteRecu(e1).includes(`versement de ${fmtR(60000)} le 25/09/2026 (par Mobile Money (Flooz))`)
    && /Reçu de versement N° DET-0007 envoyé à ESSO/.test(M.ligneEnvoiModele("recu_reglement", e1.variables))
    && /Reçu de réservation N° DET-0008 envoyé à AYOKO/.test(M.ligneEnvoiModele("recu_reservation", e2.variables)));

  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ★ Une VIEILLE dette, née avant la numérotation, n'a pas de numéro
  // enregistré : le message porte le MÊME numéro que son reçu imprimé
  // (numeroRecuDette), jamais un tiret (Timo, 25/09/2026).
  {
    const { numeroRecuDette } = await import("../src/lib/core.js");
    const vieille = { id: "ab12cd34", date: "2025-11-03", client: "ESSO", tel: "90112233", boutique: "BMI DEMAKPOE", montant: 160000, paye: 110000 };
    const imprime = numeroRecuDette(vieille);
    const ev = M.envoiRecuReglement({ dette: vieille, versement, boutique: {}, fmt: fmtR, dFR: dFRr, numeroDe: numeroRecuDette });
    const er = M.envoiRecuReservation({ reservation: { ...resa, numero: undefined, id: "ef56ab78" }, boutique: {}, fmt: fmtR, dFR: dFRr, numeroDe: numeroRecuDette });
    test("★★ vieille dette SANS numéro : le versement porte le numéro du reçu imprimé (BMI-DET-2025-AB12), jamais « — »",
      imprime === "BMI-DET-2025-AB12" && ev.variables[4] === imprime && er.variables[3] !== "—" && /-DET-2026-EF56$/.test(er.variables[3]));
    test("★ une dette QUI A son numéro le garde tel quel (aucun préfixe ajouté : jamais « BMID-BMID-… »)",
      M.envoiRecuReglement({ dette: { ...dette, numero: "BMID-DET-2026-0003" }, versement, boutique: {}, fmt: fmtR, dFR: dFRr, numeroDe: numeroRecuDette }).variables[4] === "BMID-DET-2026-0003");
    // RETOURNÉ le 29/09/2026 : le versement d'une pose vit dans le geste commun.
    const appels = ["src/screens/Dettes.jsx", "src/screens/Ventes.jsx", "src/components/encaissementPose.js"]
      .flatMap((f) => (sansComm(lire(f)).match(/envoiRecu(?:Reglement|Reservation)\([^;]*?\)\s*,/g) || []));
    test("★ les QUATRE écrans passent la règle du numéro (numeroDe: numeroRecuDette)",
      appels.length === 4 && appels.every((a) => a.includes("numeroDe: numeroRecuDette")));
  }
  {
    // ★★ LE REÇU DE VENTE AVEC LES ARTICLES (25/09/2026, « écris-moi le texte
    // du modèle… on implémente avec le détail des trous »).
    test("★★ le texte du modèle recu_vente_detail, mot pour mot, huit trous dans l'ordre",
      M.TEXTE_RECU_VENTE_DETAIL === "Bonjour {{1}},\nMerci pour votre achat du {{2}} à {{3}}.\nReçu N° {{4}}\nArticles : {{5}}\nTotal : {{6}}, {{7}}.\nPour toute question veuillez contacter : {{8}}.\nMerci de votre confiance. BMI TOGO — Les bâtiments modernes et intelligents\nwww.bmitogo.com"
      && M.MODELES.recu_vente_detail.variables.join(",") === "client,date,boutique,recu,articles,montant,paiement,telephone"
      && M.MODELES_EN_SERVICE.includes("recu_vente_detail"));
    const venteEric = { id: "V16", numero: "BMID-2026-0016", client: "MR ERIC", tel: "90569661", boutique: "BMI DEMAKPOE", date: "2026-09-24", paiement: "Crédit (dette)" };
    const lignesEric = [{ article: "Panneau 370W", qte: 16 }, { article: "Panneau 250W", qte: 12 }];
    const ed = M.envoiRecuVenteDetail({ vente: venteEric, boutique: { tel: "+228 91 13 05 11" }, montant: 1000000, lignes: lignesEric, avance: 0, reste: 1000000, fmt: fmtR, dFR: dFRr });
    test("★★ la vente de MR ERIC : la liste sur UNE ligne, le montant, la formule du crédit, le téléphone — dans l'ordre",
      ed && ed.modele === "recu_vente_detail"
      && ed.variables.join("|") === `MR ERIC|24/09/2026|BMI DEMAKPOE|BMID-2026-0016|16 × Panneau 370W · 12 × Panneau 250W|${fmtR(1000000)}|à crédit : reste ${fmtR(1000000)}|+228 91 13 05 11`
      && M.critiqueModele("recu_vente_detail", ed.variables) === "");
    const beaucoup = Array.from({ length: 30 }, (_, i) => ({ article: `Câble solaire 6mm² rouge lot ${i + 1}`, qte: i + 1 }));
    const longue = M.listeArticlesRecu(beaucoup);
    test("★★ une grosse vente : jamais de retour à la ligne, jamais au-delà de la limite, des articles ENTIERS, et « + N autres articles » dit ce qui manque",
      !/[\r\n\t]/.test(longue) && longue.length <= M.LONGUEUR_MAX_ARTICLES
      && /\+ \d+ autres articles$/.test(longue) && longue.startsWith("1 × Câble solaire 6mm² rouge lot 1 · ")
      && longue.split(M.SEPARATEUR_ARTICLES).slice(0, -1).every((m) => /^\d+ × Câble solaire 6mm² rouge lot \d+$/.test(m)));
    const plein = M.texteRecu(M.envoiRecuVenteDetail({ vente: { ...venteEric, client: "X".repeat(300) }, boutique: {}, montant: 1000000, lignes: beaucoup, fmt: fmtR, dFR: dFRr }));
    test("★ même au pire (nom et liste au maximum), le message reste sous la limite de Meta (1 024 caractères)",
      plein.length > 0 && plein.length <= 1024);
    test("★ sans numéro, sans montant ou sans article lisible : aucun reçu détaillé (l'écran retombe sur le court)",
      M.envoiRecuVenteDetail({ vente: { ...venteEric, tel: "" }, boutique: {}, montant: 10, lignes: lignesEric }) === null
      && M.envoiRecuVenteDetail({ vente: venteEric, boutique: {}, montant: undefined, lignes: lignesEric }) === null
      && M.envoiRecuVenteDetail({ vente: venteEric, boutique: {}, montant: 10, lignes: [{ article: "", qte: 1 }] }) === null
      && M.listeArticlesRecu([{ article: "Onduleur", qte: 1 }]) === "1 × Onduleur");
    test("★ la ligne du fil raconte le reçu détaillé",
      /^📲 Envoyé du numéro BMI — Reçu N° BMID-2026-0016 envoyé à MR ERIC : achat du 24\/09\/2026 à BMI DEMAKPOE \(16 × Panneau 370W · 12 × Panneau 250W\)/.test(M.ligneEnvoiModele("recu_vente_detail", ed.variables)));
    const ven2 = sansComm(lire("src/screens/Ventes.jsx"));
    const commun2 = (ven2.match(/const envoyerRecuDuNumeroBmi = async \(vente, etat\) => \{[\s\S]*?\n  \};/) || [""])[0];
    const ligne2 = (ven2.match(/const envoyerRecuLigne = async \(v\) => \{[\s\S]*?\n  \};/) || [""])[0];
    test("★★ 💰 Ventes : le DÉTAILLÉ est tenté d'abord, le court ensuite, UNE écriture sur celui qui est parti, et on s'arrête en formation",
      /return \[envoiRecuVenteDetail\(\{ \.\.\.base, lignes: lignesVente\(vente\) \}\), envoiRecuVente\(base\)\]\.filter\(Boolean\);/.test(lire("src/lib/recuDeVente.js"))
      && /const envois = envoisRecuDeVente\(/.test(commun2)
      && /for \(const envoi of envois\)/.test(commun2) && /if \(r\.auto\) \{[\s\S]*?return \{ auto: true/.test(commun2)
      && /if \(motifAttendu\(r\.motif\)\) break;/.test(commun2) && (commun2.match(/save\(/g) || []).length === 1);
    const q = ligne2.indexOf("uConfirm("), e = ligne2.indexOf("envoyerRecuDuNumeroBmi(");
    test("★★ 💰 Ventes, le bouton de la LIGNE : il demande AVANT d'envoyer du numéro BMI, et le bouton l'appelle",
      q > 0 && e > q && /onClick=\{\(\) => envoyerRecuLigne\(v\)\}/.test(ven2) && !/onClick=\{\(\) => recuWhatsApp\(/.test(ven2));
    test("★★ …sans numéro ou en formation, WhatsApp s'ouvre avec le reçu COMPLET, sans question ; si le numéro BMI échoue, on dit pourquoi puis le reçu complet",
      /if \(!telDigits\(v\.tel\) \|\| bq\.formation\) \{ recuWhatsApp\(v, bq\); return; \}/.test(ligne2)
      && ligne2.indexOf("if (!telDigits(v.tel)") < q
      && /if \(r\.motif && !motifAttendu\(r\.motif\)\) await uAlert\(/.test(ligne2) && /\n    recuWhatsApp\(v, bq\);\n  \};$/.test(ligne2));
    // ★★ UNE VENTE SANS NUMÉRO DEMANDE D'ABORD (Timo, 25/09/2026, « 1 » :
    // toujours). On découpe le corps de l'encaissement et on exige la
    // question AVANT la moindre écriture, avec les deux sorties.
    const enc = (ven2.match(/const encaisserVente = async \(\) => \{[\s\S]*?\n  \};/) || [""])[0];
    const iQ = enc.indexOf("numeroManquant(f.tel)"), iSave = enc.search(/\bsave\(/);
    test("★★ 💰 Ventes : sans numéro, la question « Ajouter le client / Continuer sans » est posée AVANT d'enregistrer, et « Ajouter » n'enregistre rien",
      iQ > 0 && iSave > iQ
      && /if \(!origineDevis && numeroManquant\(f\.tel\)\) \{\s*const choix = await uChoix\(QUESTION_SANS_NUMERO, \[CHOIX_AJOUTER_CLIENT, CHOIX_CONTINUER_SANS\]\);\s*if \(choix !== CHOIX_CONTINUER_SANS\) \{[^}]*return;/.test(enc));
    const numeroManquant = (tel) => String(tel || "").replace(/\D/g, "").length < 8;
    test("★ un numéro de moins de 8 chiffres (« +228 » seul) compte comme absent ; un vrai numéro passe",
      /export const numeroManquant = \(tel\) => String\(tel \|\| ""\)\.replace\(\/\\D\/g, ""\)\.length < 8;/.test(ven2)
      && numeroManquant("") && numeroManquant("+228 ") && !numeroManquant("90 56 96 61") && !numeroManquant("+228 90569661"));
    test("★ « Ajouter le client » remet le curseur dans la case Client (la case est remontée avec autoFocus)",
      /setFocusClient\(\(n\) => n \+ 1\)/.test(enc) && /<ChampSuggestions key=\{`client-\$\{focusClient\}`\} autoFocus=\{focusClient > 0\}/.test(ven2));
    const imp = lire("src/lib/impression.js");
    test("★ le reçu COMPLET (un article par ligne) est écrit UNE fois : recuWhatsApp l'ouvre, texteRecuComplet le rédige",
      /export function recuWhatsApp\(v, bq = \{\}\) \{\n  envoyerWhatsApp\(v\.tel, texteRecuComplet\(v, bq\)\);\n\}/.test(imp)
      && /export function texteRecuComplet\(v, bq = \{\}\)/.test(imp) && /return lignes\.join\("\\n"\);/.test(imp));
  }
  const W = sansComm(lire("src/whatsapp.js"));
  // ⚠ RETOURNÉ le 23/10/2026 : le corps vit dans `envoyerRecuSansQuestionSur`,
  // `envoyerRecuSansQuestion` n'est plus que le filet qui l'entoure (une erreur
  // en route se dit, ⑦⑧).
  const i = W.indexOf("async function envoyerRecuSansQuestionSur");
  const corps = W.slice(i, W.indexOf("\n}", i));
  test("★★ UNE fonction envoie les deux reçus : SANS repli (WhatsApp ne s'ouvre jamais), la ligne du fil seulement si parti du numéro BMI, sans donner la conversation",
    i > 0 && /sansRepli: true/.test(corps) && !/envoyerWhatsApp\(/.test(corps)
    && /if \(r\.auto\)/.test(corps) && !/donnerAuSender/.test(corps) && /motifAttendu\(r\.motif\)/.test(corps));
  const D = sansComm(lire("src/screens/Dettes.jsx"));
  const enc = D.slice(D.indexOf("const encaisser = async"), D.indexOf("const ajouterArticleRes"));
  test("★★ 📋 Dettes, chaque versement : le reçu part sur la dette APRÈS le versement, le mur = l'espace de la BOUTIQUE de la dette",
    /envoiRecuReglement\(\{ dette: dApres, versement: paiement,/.test(enc)
    && /espaceFormation: !!bqD\.formation/.test(enc) && !/estCompteFormation\(db, profile\)/.test(enc));
  const cre = D.slice(D.indexOf("const creerReservation = async"), D.indexOf("const livrer = async"));
  test("★★ 📋 Dettes, une réservation : le reçu de RÉSERVATION seul (son avance est dedans, jamais un reçu de versement en plus)",
    /envoiRecuReservation\(\{ reservation: r,/.test(cre) && !/envoiRecuReglement/.test(cre) && /espaceFormation: !!bqR\.formation/.test(cre));
  const Vt = sansComm(lire("src/screens/Ventes.jsx"));
  const blocRes = Vt.slice(Vt.indexOf("if (creerCommeReservation) {"), Vt.indexOf("const messageConfirm ="));
  test("★★ 💰 Ventes, une vente devenue réservation : le reçu de réservation part aussi, jamais le reçu de vente",
    /envoiRecuReservation\(\{ reservation, boutique: bqR,/.test(blocRes) && !/envoyerRecuAutomatique\(/.test(blocRes)
    && /espaceFormation: !!bqR\.formation/.test(blocRes));
  const CI = sansComm(lire("src/screens/ClientsInstalles.jsx"));
  // RETOURNÉ le 29/09/2026 : le geste d'une pose seule vit UNE fois dans
  // components/encaissementPose.js (🧾 Commandes s'en sert aussi).
  const pose = sansComm(lire("src/components/encaissementPose.js"));
  const poseCI = CI.slice(CI.indexOf("const encaisserPose = async"), CI.indexOf("const forcerReceptionSansSignature"));
  test("★★ 🏠 Clients installés, un versement : le même reçu, sur la dette APRÈS le versement (geste commun)",
    /envoiRecuReglement\(\{ dette: \{ \.\.\.detteApres, tel: telV \}, versement: paiement,/.test(pose) && /envoyerRecuSansQuestion\(/.test(pose)
    // RETOURNÉ le 08/10/2026 (caisse 🏗 CHANTIER) : l'espace se lit sur la
    // caisse qui reçoit OU la boutique du document OU le chantier.
    && /espaceFormation: !!bqCaisse\.formation \|\| !!bqV\.formation \|\| !!chantier\.formation/.test(pose)
    && /encaisserDettePose\(/.test(poseCI) && /setNoteRecuWa\(note\)/.test(poseCI));
  test("★ les trois écrans DISENT ce qui s'est passé, discrètement (jamais une fenêtre)",
    [D, Vt, CI].every((x) => /data-recu-whatsapp/.test(x) && /setNoteRecuWa/.test(x)));
}

titre("㉙ 🧾 LE BON DE REPRISE ET LE BON DE RETOUR PARTENT DU NUMÉRO BMI (25/09/2026, « lance les deux bons »)");
{
  const fmtR = (n) => `${Number(n || 0).toLocaleString("fr-FR")} F`;
  const dFRr = (x) => String(x || "").split("-").reverse().join("/");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sortieBn = join(process.cwd(), "scripts", "_bundle-bons.tmp.mjs");
  await build({ entryPoints: ["src/lib/bons.js"], bundle: true, format: "esm", platform: "node", outfile: sortieBn, logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
  const Bn = await import(pathToFileURL(sortieBn).href);
  unlinkSync(sortieBn);
  // La vraie reprise de la capture de Timo : EZO ENERGY, 10 étriers, 6 000 F rendus en espèces.
  const vente = { id: "V28", numero: "BMID-2026-0028", date: "2026-09-25", boutique: "BMI DEMAKPOE", client: "EZO ENERGY DU TOGO", tel: "90112233", paiement: "Espèces" };
  const reprise = { ref: "REP-X", date: "2026-09-25", article: "Étrier du milieu", qte: 10, motif: "Il a changé d'avis", montant: 6000, rembourse: 6000, moyen: "Espèces", par: "TIMO" };
  const bq = { adresse: "Agoè démakpoè dans la von de MIAMI BEACH", tel: "99968488" };
  const bonR = Bn.bonReprise({ dettes: [] }, { ...vente, reprises: [reprise] }, reprise);
  const eR = M.envoiBon({ bon: bonR, boutique: bq, fmt: fmtR, dFR: dFRr });
  test("★★ le texte de bon_reprise, dans la forme du bon imprimé, douze trous dans l'ordre",
    M.TEXTE_BON_REPRISE.split("\n").length === 17 && M.TEXTE_BON_REPRISE.startsWith("↩ *BON DE REPRISE — {{1}}*\n{{2}}\nTél : {{3}}")
    && M.TEXTE_BON_REPRISE.endsWith("Établi par : {{12}}\nMerci de votre confiance. BMI TOGO")
    && M.MODELES.bon_reprise.variables.join(",") === "boutique,adresse,telephone,numero,date,recu,client,article,motif,valeur,reglement,par"
    && M.MODELES_EN_SERVICE.includes("bon_reprise") && M.MODELES_EN_SERVICE.includes("bon_retour"));
  test("★★ le bon d'EZO ENERGY : chaque trou à sa place, et le message complet est celui du bon imprimé",
    eR && eR.modele === "bon_reprise" && M.critiqueModele("bon_reprise", eR.variables) === ""
    && eR.variables.join("|") === `BMI DEMAKPOE|Agoè démakpoè dans la von de MIAMI BEACH|99968488|${bonR.numero}|25/09/2026|BMID-2026-0028 du 25/09/2026|EZO ENERGY DU TOGO|10 × Étrier du milieu|Il a changé d'avis|${fmtR(6000)}|Rendu au client : ${fmtR(6000)} (Espèces)|TIMO`
    && M.texteRecu(eR).includes(`Valeur reprise : ${fmtR(6000)}\nRendu au client : ${fmtR(6000)} (Espèces)\nL'article est repris par BMI`));
  test("★★ jamais « Les articles vendus ne sont ni repris ni échangés » sur un bon (la dernière ligne est fixe chez Meta)",
    ![M.TEXTE_BON_REPRISE, M.TEXTE_BON_RETOUR].some((t) => /ni repris/i.test(t)) && !M.texteRecu(M.envoiBon({ bon: bonR, boutique: { ...bq, message: "Les articles vendus ne sont ni repris, ni échangés" }, fmt: fmtR })).includes("ni repris"));
  const avecDette = { ...bonR, rembourse: 1500, dette: { numero: "DET-9", reduction: 6000 } };
  test("★ ce qui est réglé : dette réduite, argent rendu, ou les deux — jamais un trou vide",
    M.reglementReprise(avecDette, fmtR) === `Dette réduite de ${fmtR(6000)} (dette DET-9) ; Rendu au client : ${fmtR(1500)} (Espèces)`
    && M.reglementReprise({ ...avecDette, rembourse: 0 }, fmtR) === `Dette réduite de ${fmtR(6000)} (dette DET-9) : rien à rendre`
    && M.reglementReprise({ ...bonR, rembourse: 0 }, fmtR) === "Rien à rendre");
  const bonT = { type: "retour", numero: "RET-BMID-2026-0028-1", date: "2026-09-26", boutique: "BMI DEMAKPOE", client: "", tel: "90112233", recu: "BMID-2026-0028", dateVente: "2026-09-25", article: "Onduleur 5 kW", qte: 1, motif: "ne démarre plus", frais: null, gratuit: true, par: "ANGELE" };
  const eT = M.envoiBon({ bon: bonT, boutique: {}, fmt: fmtR, dFR: dFRr });
  test("★★ le bon de retour : onze trous, gratuit dit en toutes lettres, un client sans nom « Non renseigné », adresse et téléphone jamais vides",
    eT && eT.modele === "bon_retour" && M.critiqueModele("bon_retour", eT.variables) === ""
    && eT.variables[1] === "Lomé, Togo" && eT.variables[2] === M.NUMERO_BMI_PRINCIPAL && eT.variables[6] === "Non renseigné"
    && eT.variables[7] === "1 × Onduleur 5 kW" && eT.variables[9] === "Échange GRATUIT sous garantie." && eT.variables[10] === "ANGELE"
    && M.fraisRetour({ ...bonT, gratuit: false, frais: { montant: 15000, detail: "déplacement", numero: "DET-3" } }, fmtR) === `Frais facturés : ${fmtR(15000)} (déplacement) — dette DET-3`);
  test("★ sans numéro, rien à envoyer ; aucun trou ne porte de retour à la ligne",
    M.envoiBon({ bon: { ...bonR, tel: "" }, boutique: bq }) === null
    && M.envoiBon({ bon: { ...bonR, motif: "casse\nau déballage" }, boutique: bq, fmt: fmtR }).variables.every((v) => !/[\r\n]/.test(v)));
  test("★ la ligne du fil raconte le bon",
    /^📲 Envoyé du numéro BMI — Bon de reprise N° .+ envoyé à EZO ENERGY DU TOGO : 10 × Étrier du milieu repris le 25\/09\/2026/.test(M.ligneEnvoiModele("bon_reprise", eR.variables))
    && /^📲 Envoyé du numéro BMI — Bon de retour N° RET-BMID-2026-0028-1/.test(M.ligneEnvoiModele("bon_retour", eT.variables)));
  const V = sansComm(lire("src/screens/Ventes.jsx"));
  const env = V.slice(V.indexOf("const envoyerBonDuNumeroBmi = async"), V.indexOf("const proposerBon = async"));
  test("★★ UNE fonction envoie un bon : sans repli, le mur = la BOUTIQUE de la vente, la ligne du fil seulement si parti, sans donner la conversation",
    env.length > 0 && /envoiBon\(\{ bon, boutique: bq, fmt, dFR \}\)/.test(env) && /sansRepli: true/.test(env)
    && /espaceFormation: !!bq\.formation/.test(env) && /if \(r\.auto\)/.test(env) && /messagesAvecLigneEnvoi\(/.test(env)
    && !/donnerAuSender|proprietaire_id|estCompteFormation/.test(env));
  const pro = V.slice(V.indexOf("const proposerBon = async"), V.indexOf("const bonsDeVente ="));
  test("★★ juste APRÈS le geste : le bon part tout seul (aucune question avant), la note le dit sous le titre ; déjà parti, « Envoyer par WhatsApp » ne s'offre plus",
    /if \(apresGeste && telDigits\(bon\.tel\)\) \{\s*const r = await envoyerBonDuNumeroBmi\(bon, bq\);/.test(pro)
    && /setNoteRecuWa\(/.test(pro) && /bon\.tel && !parti \?/.test(pro)
    && pro.indexOf("envoyerBonDuNumeroBmi(bon, bq)") < pro.indexOf("uChoix("));
  const ligne = pro.slice(pro.indexOf('else if (choix === "Envoyer par WhatsApp")'));
  test("★★ depuis la ligne : une QUESTION avant le numéro BMI ; en formation ou sans numéro, WhatsApp s'ouvre sur l'appareil ; un échec se dit, puis le bon complet sur l'appareil",
    /if \(apresGeste \|\| !telDigits\(bon\.tel\) \|\| bq\.formation\) \{ bonWhatsApp\(bon, bq\); return; \}/.test(ligne)
    && /if \(!await uConfirm\(`Envoyer le /.test(ligne) && ligne.indexOf("if (!await uConfirm(") < ligne.indexOf("envoyerBonDuNumeroBmi(")
    && /motifAttendu\(r\.motif\)/.test(ligne));
  test("★★ la reprise ET le retour appellent le bon avec apresGeste (les deux gestes)",
    (V.match(/proposerBon\([^)]*\)[^;]*\{ apresGeste: true \}\);/g) || []).length === 2);
  // Le reçu détaillé : 500 caractères de liste, et le message reste sous la limite de Meta.
  const beaucoup = Array.from({ length: 40 }, (_, i) => ({ article: `Panneau solaire 450W bifacial lot ${i + 1}`, qte: i + 1 }));
  const l500 = M.listeArticlesRecu(beaucoup);
  test("★★ la liste des articles monte à 500 caractères (Timo, « oui 500 ») : plus d'articles qu'avant, toujours entiers",
    M.LONGUEUR_MAX_ARTICLES === 500 && l500.length <= 500 && l500.length > 400 && l500.split(M.SEPARATEUR_ARTICLES).length > 10
    && /\+ \d+ autres articles$/.test(l500));
  const venteX = { id: "VX", numero: "BMID-2026-0099", date: "2026-09-25", boutique: "BMI DEMAKPOE", client: "X".repeat(300), tel: "90112233", paiement: "Espèces" };
  const plein = M.envoiRecuVenteDetail({ vente: venteX, boutique: { tel: "9".repeat(300) }, montant: 99999999, lignes: beaucoup, fmt: fmtR, dFR: dFRr });
  test("★★ au pire (nom, téléphone et liste au maximum), la liste se raccourcit pour que le message tienne sous 1 024 caractères",
    plein && M.texteRecu(plein).length <= M.LIMITE_MESSAGE_META && plein.variables[4].length > 0);
}

titre("㉚ 📄🔑 LE PREMIER DEVIS : SES ACCÈS (espace) PUIS LE DEVIS (devis_disponible) — RETOURNÉ le 25/09/2026");
{
  // ⚠ RETOURNÉ : `devis_premier` (un seul message, devis + accès) a été
  // refusé trois fois par Meta et supprimé par Timo. « Lance » : deux
  // messages, `espace` d'abord, puis `devis_disponible` — et un seul si ses
  // accès sont déjà partis.
  const neuf = { id: "u9", nom: "KOSSI90112233", nom_base: "KOSSI MENSAH", tel: "90112233", devis: [{ id: "D1" }] };
  test("★★ un client tout neuf, sans ligne d'accès dans le fil : ses accès ne sont PAS partis",
    M.accesDejaEnvoyes(neuf, "D1", []) === false && M.accesDejaEnvoyes(neuf, "D1", undefined) === false);
  test("★★ la ligne `espace` du fil (wa_acces.client_id) prouve que ses accès sont partis : le devis part SEUL (on ne paie pas deux fois)",
    M.accesDejaEnvoyes(neuf, "D1", [{ id: "m1", wa_acces: { client_id: "u9" } }]) === true);
  test("★ la ligne d'accès d'un AUTRE client ne compte pas",
    M.accesDejaEnvoyes(neuf, "D1", [{ id: "m1", wa_acces: { client_id: "u8" } }]) === false);
  test("★ un client déjà contacté (autre devis, ou application ouverte) aussi",
    M.accesDejaEnvoyes({ ...neuf, info_donnees_le: "2026-09-01" }, "D1", []) === true
    && M.accesDejaEnvoyes({ ...neuf, devis: [{ id: "D0" }, { id: "D1" }] }, "D1", []) === true);
  const P = lire("src/screens/dimensionnement/Partages.jsx").replace(/^\s*\/\/.*$/gm, "");
  // ⚠ RETOURNÉ le 14/10/2026 : les accès partent par envoyerAccesSansRepli
  // (`espace_portail` d'abord, `espace` en relais).
  const iAcces = P.indexOf("envoyerAccesSansRepli({"), iDevis = P.indexOf("envoiDevisDisponible({ devis: devisMarque");
  test("★★ Partages : `espace` part AVANT le devis, et seulement si ses accès ne sont pas déjà partis",
    /let accesPartis = accesDejaEnvoyes\(compte, idDevis, dbApres\.messages\);/.test(P)
    && /if \(!accesPartis && motDePasse && compte\.nom\) \{/.test(P)
    && iAcces > 0 && iDevis > iAcces);
  const corpsSansRepli = srcWhatsapp.slice(srcWhatsapp.indexOf("export async function envoyerAccesSansRepli"), srcWhatsapp.indexOf("export async function envoyerAccesSansRepli") + 800);
  test("★★ `espace_portail` puis `espace` partent SANS repli (sinon WhatsApp s'ouvrirait deux fois), et le mur reste l'espace du DEVIS",
    /tel: telClient, espaceFormation,\s*\}\);/.test(P)
    && /for \(const modele of MODELES_IDENTIFIANTS\)/.test(corpsSansRepli)
    && /sansRepli: true/.test(corpsSansRepli) && !/texteRepli/.test(corpsSansRepli)
    && /const espaceFormation = !!espaceDeLaFiche\(devisMarque\);/.test(P));
  test("★★ si ses accès ne sont pas partis, le devis ne part PAS du numéro BMI : à la main, avec ses codes",
    /if \(rAcces\.auto\) \{ accesPartis = true; accesEnvoyes = rAcces; \}/.test(P)
    && /premierContact: !accesPartis,/.test(P));
  test("★★ les accès partis s'écrivent dans 📲 WhatsApp par LA ligne masquée (messagesAvecLigneAcces), jamais en clair",
    /if \(accesEnvoyes\) \{\s*save\(\(etat\) => \(\{ \.\.\.etat, messages: messagesAvecLigneAcces\(etat\.messages,/.test(P));
}

titre("㉛ ⌛ L'OFFRE EXPIRÉE (option « b ») ET LA RELANCE AUTOMATIQUE DU 8e JOUR (26/09/2026)");
{
  // Timo : « B, lance » puis « après 8 jours sans validation, une relance
  // automatique avec informations d'expiration après 15 jours » → « texte
  // ok, une seule relance, lance ».
  const R = await import(pathToFileURL(join(process.cwd(), "src/lib/rappels.js")).href);
  const A = await import(pathToFileURL(join(process.cwd(), "src/lib/relanceAutoDevis.js")).href);
  const sansCommR = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dv = { id: "D1", date: "2026-09-01", total: 450000, statut: "propose", type_devis: "solaire" };
  test("★★ l'offre est valable 15 jours À COMPTER du devis : le 16/09 encore valable, expirée le 17/09",
    R.finOffre(dv) === "2026-09-16" && !R.offreExpiree(dv, "2026-09-16") && R.offreExpiree(dv, "2026-09-17"));
  test("★ seul un devis ⏳ Proposé s'annonce expiré (validé, payé, corrigé, rejeté, supprimé : non)",
    ["valide", "paye", "corrige", "modification", "rejete"].every((st) => !R.offreExpiree({ ...dv, statut: st }, "2026-10-30"))
    && !R.offreExpiree({ ...dv, supprime_le: "2026-09-20" }, "2026-10-30"));
  test("★ la phrase dit la date de fin et « prix à confirmer »",
    /16\/09\/2026/.test(R.phraseOffreExpiree(dv)) && /prix à confirmer/.test(R.phraseOffreExpiree(dv)));
  const VD = lire("src/lib/validationDevis.js");
  test("★★ « b » : le devis reste VALIDABLE — la validation ne refuse pas une offre expirée, elle la MARQUE et le journal le dit",
    /const expiree = offreExpiree\(d, today\(\)\);/.test(VD) && /offre_expiree_a_validation: true/.test(VD)
    && !/expiree[^\n]*return \{ erreur/.test(VD) && /offre expirée, prix à confirmer/.test(VD));
  const EC = lire("src/screens/EspaceClient.jsx"), TD = lire("src/screens/TousLesDevis.jsx");
  test("★ l'espace du client le DIT avant qu'il valide (bandeau + fenêtre de confirmation)",
    /\{offreExpiree\(d, today\(\)\) && \(\s*<div[^>]*data-offre-expiree/.test(EC) && (EC.match(/\+ avisExpiration/g) || []).length === 2);
  test("★ 📋 Tous les devis le montre (proposé expiré, validé après expiration, relance automatique) et la signature en boutique le rappelle",
    /offreExpiree\(d, today\(\)\) && \(\s*<span[^>]*data-offre-expiree/.test(TD) && /d\.offre_expiree_a_validation &&/.test(TD)
    && /d\.relance_auto_le &&/.test(TD) && /Paiement prévu à \$\{boutique\}\.`\}\$\{offreExpiree\(d, today\(\)\)/.test(TD));

  // LE MODÈLE : le texte de Timo, cinq trous dans l'ordre.
  test("★★ « relance_devis_expiration » : MARKETING, cinq trous dans l'ordre client, domaine, montant, date, fin",
    M.MODELES.relance_devis_expiration?.categorie === "marketing"
    && M.MODELES.relance_devis_expiration.variables.join(",") === "client,domaine,montant,date,fin");
  test("★ le texte est celui de Timo, mot pour mot (cinq trous, la phrase des prix à confirmer)",
    (M.TEXTE_RELANCE_EXPIRATION.match(/\{\{\d\}\}/g) || []).join("") === "{{1}}{{2}}{{3}}{{4}}{{5}}"
    && /Passé cette date, les prix devront être confirmés\./.test(M.TEXTE_RELANCE_EXPIRATION));

  // LA RÈGLE DU JOUR : exactement une relance, entre le 8e et le 15e jour.
  test("★★ à relancer du 8e au 15e jour seulement (7e : trop tôt ; 16e : l'offre est finie, on n'annonce pas une date passée)",
    !A.devisARelancerAuto(dv, "2026-09-08") && A.devisARelancerAuto(dv, "2026-09-09")
    && A.devisARelancerAuto(dv, "2026-09-16") && !A.devisARelancerAuto(dv, "2026-09-17"));
  test("★★ UNE seule : déjà relancé automatiquement, ou à la main, ou plus ⏳ Proposé → rien",
    !A.devisARelancerAuto({ ...dv, relance_auto_le: "2026-09-09" }, "2026-09-10")
    && !A.devisARelancerAuto({ ...dv, relance_le: "2026-09-05" }, "2026-09-10")
    && !A.devisARelancerAuto({ ...dv, statut: "valide" }, "2026-09-10")
    && !A.devisARelancerAuto({ ...dv, supprime_le: "2026-09-05" }, "2026-09-10"));
  const client = { id: "c1", role: "client", nom: "MANDA90112233", nom_base: "MANDA", tel: "90112233", devis: [dv] };
  const base = { users: [client], boutiques: [{ nom: "BMI DEMAKPOE" }], messages: [] };
  const liste = A.relancesAutoDuJour(base, "2026-09-09");
  test("★★ la liste du jour porte le bon devis, au bon numéro, avec les cinq trous remplis (dont la date de fin)",
    liste.length === 1 && liste[0].devis.id === "D1" && liste[0].envoi.modele === "relance_devis_expiration"
    && liste[0].envoi.variables.length === 5 && liste[0].envoi.variables.every((x) => String(x).trim())
    && liste[0].envoi.variables[0] === "MANDA" && liste[0].envoi.variables[4] === "16/09/2026" && /90112233/.test(liste[0].tel));
  test("★★ LE MUR : un devis marqué formation, un compte de formation, un compte bloqué ou sans numéro → rien",
    A.relancesAutoDuJour({ ...base, users: [{ ...client, devis: [{ ...dv, formation: true }] }] }, "2026-09-09").length === 0
    && A.relancesAutoDuJour({ ...base, users: [{ ...client, formation: true }] }, "2026-09-09").length === 0
    && A.relancesAutoDuJour({ ...base, users: [{ ...client, actif: false }] }, "2026-09-09").length === 0
    && A.relancesAutoDuJour({ ...base, users: [{ ...client, tel: "" }] }, "2026-09-09").length === 0);
  const ligne = A.ligneRelanceAuto({ id: "m1", tel: liste[0].tel, compte: client, devis: dv, variables: liste[0].envoi.variables, ts: "2026-09-09T07:00:00Z" });
  test("★★ UNE seule, même si la marque du devis s'est perdue : la ligne du fil (qui ne se réécrit jamais) suffit à l'empêcher",
    !!ligne && A.relancesAutoDuJour({ ...base, messages: [ligne] }, "2026-09-10").length === 0);
  test("★ la ligne du fil dit ce qui est parti, sans propriétaire (la relance ne s'approprie rien)",
    ligne.texte.startsWith(M.PREFIXE_LIGNE_ENVOI) && /16\/09\/2026/.test(ligne.texte) && !("proprietaire_id" in ligne)
    && ligne.devis_id === "D1" && ligne.wa_modele === "relance_devis_expiration");
  test("★ la marque se pose sur le BON devis, et sur lui seul",
    A.compteApresRelance({ ...client, devis: [dv, { id: "D2" }] }, "D1", "2026-09-09T07:00:00Z").devis.map((d) => d.relance_auto_le || "").join("|") === "2026-09-09|");

  // ↻ UNE RELANCE NON REÇUE SE RETENTE UNE FOIS (16/10/2026, capture d'ONG,
  // ❌ 131049 « limite les messages commerciaux », « les deux, lance »).
  const dvR = { ...dv, relance_auto_le: "2026-09-09" };
  const clientR = { ...client, devis: [dvR] };
  const echec = { ...ligne, wa_statut: { etat: "echec", le: "2026-09-09T07:00:05Z", motif: M.traduireMotifWhatsApp("", 131049) } };
  const baseR = { ...base, users: [clientR], messages: [echec] };
  const reliste = A.relancesAutoDuJour(baseR, "2026-09-10");
  test("★★ « b » : une relance NON REÇUE (❌ posé par WhatsApp) repart le LENDEMAIN, une seule fois, avec les mêmes cinq trous",
    reliste.length === 1 && reliste[0].devis.id === "D1" && reliste[0].retente === true && reliste[0].envoi.variables[4] === "16/09/2026");
  test("★★ jamais le jour même de l'échec, ni sans nouvelle de WhatsApp (✓ envoyé, ✓✓ reçu, ✓✓ lu : rien)",
    A.relancesAutoDuJour(baseR, "2026-09-09").length === 0
    && ["envoye", "recu", "lu"].every((etat) => A.relancesAutoDuJour({ ...baseR, messages: [{ ...ligne, wa_statut: { etat, le: "2026-09-09T07:00:05Z" } }] }, "2026-09-10").length === 0));
  const echec2 = { ...echec, id: "m2", date: "2026-09-10", ts: "2026-09-10T07:00:00Z" };
  test("★★ UNE fois : deux essais non reçus → plus rien (MAX_ESSAIS_RELANCE_AUTO = 2)",
    A.MAX_ESSAIS_RELANCE_AUTO === 2 && A.relancesAutoDuJour({ ...baseR, messages: [echec, echec2] }, "2026-09-11").length === 0);
  test("★★ jamais hors de la fenêtre (après le 15e jour), ni relancé à la main, ni plus ⏳ Proposé, ni ligne à la corbeille, ni en formation",
    A.relancesAutoDuJour(baseR, "2026-09-17").length === 0
    && A.relancesAutoDuJour({ ...baseR, users: [{ ...clientR, devis: [{ ...dvR, relance_le: "2026-09-09" }] }] }, "2026-09-10").length === 0
    && A.relancesAutoDuJour({ ...baseR, users: [{ ...clientR, devis: [{ ...dvR, statut: "valide" }] }] }, "2026-09-10").length === 0
    && A.relancesAutoDuJour({ ...baseR, messages: [{ ...echec, supprime_le: "2026-09-09" }] }, "2026-09-10").length === 0
    && A.relancesAutoDuJour({ ...baseR, users: [{ ...clientR, formation: true }] }, "2026-09-10").length === 0);
  const et = A.etatRelanceAuto([echec], dvR, "2026-09-09");
  test("★★ « a » : l'état dit NON REÇUE, la limite de WhatsApp reconnue, et le nouvel essai de demain ; après le second échec, plus de nouvel essai",
    et && et.echec && et.limite && et.retentera && et.le === "2026-09-09"
    && A.etatRelanceAuto([echec, echec2], dvR, "2026-09-10").retentera === false
    && A.etatRelanceAuto([{ ...ligne, wa_statut: { etat: "lu", le: "x" } }], dvR, "2026-09-09").echec === false
    && A.etatRelanceAuto([], dvR, "2026-09-09") === null
    && A.etatRelanceAuto([{ ...echec, wa_statut: { etat: "echec", motif: "Something odd" } }], dvR, "2026-09-09").limite === false);
  const TDr = sansCommR(lire("src/screens/TousLesDevis.jsx"));
  test("★★ 📋 Tous les devis lit LA règle (etatRelanceAuto) et ne dit plus « Relancé automatiquement » d'une relance non reçue",
    /const r = etatRelanceAuto\(db\.messages, d, today\(\)\);\s*if \(r\?\.echec\) return \(/.test(TDr) && /data-relance-auto-non-recue/.test(TDr)
    && /Relance automatique non reçue le \{dFR\(r\.le\)\}\{r\.limite \? " \(limite de WhatsApp\)" : ""\} — appelez le client/.test(TDr));

  // LE SERVEUR : la tournée de 7 h envoie, et n'écrit qu'APRÈS l'accord de WhatsApp.
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const RM = sansComm(lire("api/rappels-du-matin.js"));
  const corps = RM.slice(RM.indexOf("async function relancerLesDevis"));
  const iEnvoi = corps.indexOf("envoyerYCloud("), iRefus = corps.indexOf("if (!envoi.ok)"), iEcrit = corps.indexOf('from("messages").insert');
  test("★★ la tournée envoie par LA règle (relancesAutoDuJour) et par LA porte YCloud, jamais une copie",
    /relancesAutoDuJour\(db, aujourdhui\)/.test(corps) && /from "\.\/_ycloud\.js"/.test(RM) && !/X-API-Key/.test(RM));
  test("★★ rien n'est écrit tant que WhatsApp n'a pas accepté (envoi, puis refus → on passe, puis écriture)",
    iEnvoi > 0 && iRefus > iEnvoi && iEcrit > iRefus && /bilan\.refusees\+\+;[^\n]*continue;/.test(corps));
  test("★ la fiche du client est RELUE juste avant de poser la marque, et `updated_at` est posé (sinon elle ne descend pas)",
    /from\("users"\)\.select\("id, data"\)\.eq\("id", r\.compte\.id\)/.test(corps) && /updated_at: ts \}\)\.eq\("id", frais\.id\)/.test(corps));
  test("★ la relance ne dépend pas des notifications : elle part AVANT le contrôle de la clé VAPID",
    RM.indexOf("relancerLesDevis(admin, db, aujourdhui)") > 0 && RM.indexOf("relancerLesDevis(admin, db, aujourdhui)") < RM.indexOf("if (!configurerWebPush())"));
  test("★ la tournée lit les messages (la preuve d'une relance déjà partie)",
    /const TABLES = \[[^\]]*"messages"/.test(RM));
  test("★ aucun nom de variable secrète dans la règle ni dans une chaîne affichée",
    !/VITE_YCLOUD|VITE_WHATSAPP/.test(lire("api/rappels-du-matin.js")) && !/YCLOUD_API_KEY/.test(lire("src/lib/relanceAutoDevis.js")));
}

// ===============================================================
titre("㉜ ✓✓ LES COCHES D'UN MESSAGE PARTI DU NUMÉRO BMI (26/09/2026, « oui, lance »)");
{
  const S = await import("../src/lib/suiviEnvoi.js");
  const nouvelle = (status, extra = {}) => ({ type: "whatsapp.message.updated", createTime: "2026-09-26T12:31:00Z", whatsappMessage: { id: "yc-1", wamid: "wamid.AB", status, ...extra } });
  const lu = S.lireStatut(nouvelle("read", { readTime: "2026-09-26T12:40:00Z" }));
  test("★★ une nouvelle de YCloud se lit : l'état, les deux numéros de suivi, l'heure (celle de la lecture pour « lu »)",
    lu && lu.etat === "lu" && lu.id === "yc-1" && lu.wamid === "wamid.AB" && lu.le === "2026-09-26T12:40:00.000Z"
    && S.lireStatut(nouvelle("delivered")).etat === "recu" && S.lireStatut(nouvelle("sent")).etat === "envoye" && S.lireStatut(nouvelle("failed")).etat === "echec");
  test("★★ un MESSAGE DU CLIENT n'est pas une nouvelle de suivi, ni un état inconnu, ni une nouvelle sans numéro",
    S.lireStatut({ type: "whatsapp.inbound_message.received", whatsappInboundMessage: { from: "+22890112233", text: { body: "Bonjour" } } }) === null
    && S.lireStatut(nouvelle("bizarre")) === null && S.lireStatut({ whatsappMessage: { status: "read" } }) === null && S.lireStatut(null) === null);
  const envoye = S.statutApres(null, S.lireStatut(nouvelle("sent")));
  const recu = S.statutApres(envoye, S.lireStatut(nouvelle("delivered")));
  const luS = S.statutApres(recu, lu);
  test("★★ les coches AVANCENT : envoyé → reçu → lu",
    envoye.etat === "envoye" && recu.etat === "recu" && luS.etat === "lu");
  test("★★ elles ne RECULENT JAMAIS : « reçu » après « lu », « envoyé » après « reçu », un échec après « reçu », la même nouvelle deux fois — rien ne change",
    S.statutApres(luS, S.lireStatut(nouvelle("delivered"))) === null && S.statutApres(recu, S.lireStatut(nouvelle("sent"))) === null
    && S.statutApres(recu, S.lireStatut(nouvelle("failed"))) === null && S.statutApres(luS, lu) === null);
  const echecConnu = S.statutApres(envoye, S.lireStatut(nouvelle("failed", { errorCode: 131050, errorMessage: "User opted out" })));
  const echecInconnu = S.statutApres(null, S.lireStatut(nouvelle("failed", { errorCode: 999999, errorMessage: "Something odd" })));
  test("★★ un ÉCHEC se dit en français par LA règle commune ; un motif inconnu reste tel quel (on n'invente pas d'explication)",
    echecConnu.etat === "echec" && /ne plus recevoir de messages commerciaux/.test(echecConnu.motif) && echecInconnu.motif === "Something odd");
  test("★ une nouvelle arrivée avant sa ligne se fait renvoyer quinze minutes, pas plus",
    S.ligneAttendue({ le: "2026-09-26T12:31:00Z" }, "2026-09-26T12:40:00Z") === true && S.ligneAttendue({ le: "2026-09-26T12:31:00Z" }, "2026-09-26T13:00:00Z") === false);
  const ch = S.champsEnvoi({ id: "yc-1", wamid: "wamid.AB" });
  test("★ l'envoi range ses deux numéros et part à « envoyé » ; un envoi sans numéro (repli, formation) ne range rien",
    ch.wa_envoi_id === "yc-1" && ch.wa_wamid === "wamid.AB" && ch.wa_statut.etat === "envoye" && JSON.stringify(S.champsEnvoi({})) === "{}" && JSON.stringify(S.champsEnvoi(null)) === "{}");
  test("★★ un numéro de suivi ne peut pas ouvrir le filtre de la base (virgule, parenthèse, point-virgule retirés)",
    S.valeurSure("yc-1),data->>role.eq.admin;--") === "yc-1data-role.eq.admin--" && !/[,();]/.test(S.valeurSure("a,b(c)d;e")));
  const cLu = S.coches({ etat: "lu", le: "2026-09-26T12:40:00Z" }), cRecu = S.coches({ etat: "recu", le: "" });
  test("★ ✓ parti · ✓✓ gris arrivé · ✓✓ bleu lu · ❌ non reçu — et jamais le mot « livré »",
    S.coches({ etat: "envoye" }).signe === "✓" && cRecu.signe === "✓✓" && cRecu.couleur === "gris" && cLu.couleur === "bleu" && /26\/09\/2026 à 12:40/.test(cLu.titre)
    && S.coches({ etat: "echec", motif: "X" }).signe === "❌" && S.coches(null) === null
    && ["envoye", "recu", "lu", "echec"].every((e) => !/livr/i.test(S.coches({ etat: e, motif: "m" }).titre)));
  const msgs = [
    { canal: "whatsapp", vente_id: "V1", ts: "1", wa_envoi_id: "a", wa_statut: { etat: "lu" } },
    { canal: "whatsapp", vente_id: "V1", ts: "3" },
    { canal: "whatsapp", vente_id: "V1", ts: "2", wa_envoi_id: "b", wa_statut: { etat: "recu" } },
    { canal: "whatsapp", vente_id: "V2", ts: "9", wa_envoi_id: "c" },
  ];
  test("★ la ligne d'une vente (dette, devis) lit le DERNIER message suivi qui la concerne, jamais celui d'une autre",
    S.dernierEnvoiPour(msgs, { vente_id: "V1" }).wa_envoi_id === "b" && S.dernierEnvoiPour(msgs, { vente_id: "V3" }) === null && S.dernierEnvoiPour(msgs, {}) === null);

  // LE SERVEUR
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const WE = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★ l'adresse d'arrivée reconnaît une nouvelle de suivi AVANT de lire un message du client (sinon elle ne l'écrit jamais comme un message)",
    WE.indexOf("lireStatut(req.body)") > 0 && WE.indexOf("lireStatut(req.body)") < WE.indexOf("lireEntrant(req.body)") && WE.indexOf("lireStatut(req.body)") > WE.indexOf("donne !== attendu"));
  // On APPELLE l'adresse d'arrivée pour de vrai, sans base : une nouvelle
  // de suivi doit atteindre traiterSuivi (qui réclame la base → 500), jamais
  // la lecture d'un message du client (qui répondrait 200 « numéro illisible »).
  const appelWebhook = async (corps) => {
    const avant = { s: process.env.WHATSAPP_WEBHOOK_SECRET, u: process.env.VITE_SUPABASE_URL };
    process.env.WHATSAPP_WEBHOOK_SECRET = "secret-du-banc"; delete process.env.VITE_SUPABASE_URL;
    let code = 0, corpsRendu = null;
    const res = { status(c) { code = c; return this; }, json(j) { corpsRendu = j; return this; } };
    try { await E.default({ method: "POST", query: { cle: "secret-du-banc" }, headers: {}, body: corps }, res); }
    finally {
      if (avant.s === undefined) delete process.env.WHATSAPP_WEBHOOK_SECRET; else process.env.WHATSAPP_WEBHOOK_SECRET = avant.s;
      if (avant.u !== undefined) process.env.VITE_SUPABASE_URL = avant.u;
    }
    return { code, corps: corpsRendu };
  };
  const rSuivi = await appelWebhook(nouvelle("delivered"));
  test("★★ appelée pour de vrai, l'adresse d'arrivée TRAITE une nouvelle de suivi (elle va chercher la base), au lieu de la jeter comme un message illisible",
    rSuivi.code === 500 && !(rSuivi.corps && rSuivi.corps.ignore));
  const suiviCorps = WE.slice(WE.indexOf("async function traiterSuivi"));
  test("★★ elle retrouve la ligne par son numéro de suivi, nettoyé (valeurSure), et ne réécrit QUE cette ligne, avec `updated_at` dans la ligne et dans la fiche",
    /valeurSure\(suivi\.id\)/.test(suiviCorps) && /valeurSure\(suivi\.wamid\)/.test(suiviCorps) && /\.update\(\{ data, updated_at: ts \}\)\.eq\("id", trouvee\.id\)/.test(suiviCorps)
    && /wa_statut: nouveau, \.\.\.\(relais \|\| relaisRecu \|\| relaisAcces \? \{ wa_relais_le: ts \} : \{\}\), updated_at: ts/.test(suiviCorps) && !/\.insert\(/.test(suiviCorps));
  test("★★ elle ne fait jamais reculer une coche (LA règle statutApres) et fait renvoyer une nouvelle trop pressée (503)",
    /statutApres\(trouvee\.data\?\.wa_statut, suivi\)/.test(suiviCorps) && /ligneAttendue\(suivi\)\) return res\.status\(503\)/.test(suiviCorps));
  test("★ une nouvelle de suivi ne prévient personne et ne réveille pas l'assistant",
    !/envoyerAuxPersonnes|repondreParAssistant|envoyerYCloud/.test(suiviCorps));
  test("★ YCloud rend le numéro de suivi (id + wamid), le serveur le transmet, l'application le garde",
    /wamid: resultat\?\.wamid/.test(lire("api/_ycloud.js")) && /wamid: resultat\.wamid/.test(lire("api/whatsapp.js"))
    && (lire("src/whatsapp.js").match(/wamid: reponse\.wamid/g) || []).length === 2);
  test("★★ les lignes écrites par le SERVEUR portent leur numéro (l'assistant, la relance du 8e jour)",
    /\.\.\.champsEnvoi\(envoi\) \};/.test(WE) && /\.\.\.champsEnvoi\(envoi\) \}/.test(sansComm(lire("api/rappels-du-matin.js"))));
  // L'APPLICATION : chaque ligne envoyée garde son numéro.
  const W = lire("src/whatsapp.js");
  test("★ les deux fabriques de ligne (envoi par modèle, accès) rangent le numéro de suivi",
    (W.match(/\.\.\.champsEnvoi\(envoi\),/g) || []).length === 2 && /envoi: r \}\)/.test(W));
  const ecrans = ["Dettes", "TousLesDevis", "Utilisateurs", "Clients", "Ventes", "Prospects", "ClientsInstalles", "dimensionnement/Partages"];
  const appels = ecrans.flatMap((e) => (sansComm(lire(`src/screens/${e}.jsx`)).match(/messagesAvecLigne(Envoi|Acces)\([^\n]*/g) || []));
  test(`★★ CHAQUE appel des écrans passe son envoi (${appels.length} appels) — un appel oublié, c'est un message sans coches`,
    // RETOURNÉ le 19/10/2026 : l'essai du PDF (reçu, proforma) range SON envoi, `rp`,
    // et le texte du relais (`relais: envoi`, 67).
    appels.length >= 13 && appels.every((a) => /envoi: (r|rp|accesEnvoyes)(, relais: envoi)? \}/.test(a)));
  const WS = lire("src/screens/Whatsapp.jsx");
  test("★ 📲 WhatsApp : la réponse libre et « ✍️ Écrire » gardent leur numéro, les coches se dessinent sur les lignes suivies, l'échec se lit en toutes lettres",
    (WS.match(/\.\.\.champsEnvoi\(r\),/g) || []).length === 2 && /m\.wa_envoi_id && <CochesEnvoi statut=\{m\.wa_statut\}/.test(WS) && /data-echec-envoi/.test(WS));
  test("★ les lignes de 💰 Ventes, 📋 Dettes et 📋 Tous les devis montrent les coches du dernier message, par LA règle",
    [["Ventes", "vente_id: v.id"], ["Dettes", "dette_id: d.id"], ["TousLesDevis", "devis_id: d.id"]].every(([e, ref]) => {
      const t = lire(`src/screens/${e}.jsx`);
      return t.includes(`dernierEnvoiPour(db.messages, { ${ref} })`) && /<CochesEnvoi statut=\{e\.wa_statut\} \/>/.test(t) && /from "\.\.\/lib\/suiviEnvoi"/.test(t);
    }));
  test("★ les coches sont dessinées UNE fois (ui.jsx), depuis LA règle",
    /export const CochesEnvoi/.test(lire("src/components/ui.jsx")) && /import \{ coches \} from "\.\.\/lib\/suiviEnvoi"/.test(lire("src/components/ui.jsx")));
  // LA VRAIE CHAÎNE, rendue
  const ligneDe = (liste) => liste.find((m) => m.wa_modele) || {};
  const ls = [ligneDe(V.ligneSuivie({ id: "yc-7", wamid: "wamid.ZZ" }))];
  test("★★ la vraie chaîne : un reçu parti porte son numéro et part à « envoyé » ; sans numéro, rien",
    ls[0].wa_envoi_id === "yc-7" && ls[0].wa_statut.etat === "envoye" && ls[0].vente_id === "V1" && !("wa_envoi_id" in ligneDe(V.ligneSuivie(null))) && !!ligneDe(V.ligneSuivie(null)).wa_modele);
  let hc = "";
  try { hc = V.htmlCoches(); } catch (e) { hc = ""; }
  test("★★ l'écran rendu : ✓✓ bleu sur la ligne lue, ❌ et son motif sur l'échec, rien sur la ligne sans suivi",
    /data-coches="lu"/.test(hc) && /data-coches="echec"/.test(hc) && /Non reçu : Ce numéro n&#x27;a pas WhatsApp\./.test(hc)
    && (hc.match(/data-coches=/g) || []).length === 2 && /LIGNE SANS SUIVI/.test(hc));
}

{
// ⚠ 26/09/2026 (capture Timo : « conversation de 5 jours classée
// ancienne ? ») : le contrôle ci-dessus rejouait la MÊME forme que l'écran
// (`it.conv`), qui ne porte qu'un identifiant — il passait donc avec la faute.
// On REND l'écran : 25 conversations récentes, une vieille de 5 mois.
titre("📁 L'archivage des conversations, sur l'écran RENDU (26/09/2026)");
let htmlArch = "";
try { htmlArch = V.htmlArchivage(); } catch (e) { htmlArch = ""; }
// Les archives sont REPLIÉES d'office : ce qui est au-dessus du bouton est
// exactement ce qui se voit sans le toucher.
// ⚠ RETOURNÉ le 09/10/2026 (« a1 b1 c1 d2 », la liste comme WhatsApp) : la
// ligne « 📁 Archivées (N) » est EN TÊTE, et repliée, elle ne montre RIEN
// des archives — la vieille conversation n'est nulle part dans la page.
test("★★ l'écran rendu : les 25 conversations de moins de 3 mois restent TOUTES visibles, seule celle de 5 mois part dans « 📁 Archivées (1) », en tête et repliée",
  /data-archives-en-haut[^>]*>[\s\S]{0,200}Archivées (?:<!-- -->)?\(1\)/.test(htmlArch) && htmlArch.indexOf("data-archives-en-haut") < htmlArch.indexOf("RECENT0<")
  && Array.from({ length: 25 }, (_, i) => `RECENT${i}<`).every((n) => htmlArch.includes(n)) && !htmlArch.includes("VIEUX CLIENT"));
test("★★ « b1 » : les NON LUES passent en `toujoursVisibles` (jamais archivées), rangées par date avec les autres ; plus de bloc « Nouveaux messages »",
  /toujoursVisibles=\{liste\.nonLues\}/.test(ecranWa) && /archivesEnHaut/.test(ecranWa) && !/data-whatsapp="nouveaux"/.test(ecranWa)
  && /data-filtre=\{v\}/.test(ecranWa) && /\["nonlues", `Non lues/.test(ecranWa) && /Attendent un conseiller/.test(ecranWa));
test("★ l'écran passe la CONVERSATION à l'archivage (it.wa), jamais son seul identifiant (it.conv)",
  /dateDe=\{\(it\) => derniereActivite\(it\.wa\)\}/.test(ecranWa) && !/derniereActivite\(it\.conv\)/.test(ecranWa));
}

{
titre("㉝ 🔧 LE RAPPEL D'ENTRETIEN AUTOMATIQUE (26/09/2026, « 5 », « 10 jours », « 6 mois »)");
const E = await import(pathToFileURL(join(process.cwd(), "src/lib/rappelEntretien.js")).href);
const jour = "2026-09-26";
const chef = { id: "T1", nom: "KOSSI", role: "technicien" };
const prevu = { id: "T2", nom: "AMA", role: "technicien_bmi" };
const principal = { id: "A1", nom: "TIMO", role: "admin", admin_principal: true };
const client = { id: "C1", nom: "ESSO", nom_base: "ESSO", role: "client", tel: "+228 90 11 22 33" };
const base = {
  users: [chef, prevu, principal, client, { id: "C2", nom: "BLOQUE", role: "client", tel: "90445566", actif: false }, { id: "CF", nom: "ELEVE", role: "client", tel: "90778899", formation: true }],
  boutiques: [{ nom: "DEMAKPOE" }, { nom: "FORMATION B", formation: true }],
  ventes: [{ id: "VF", boutique: "FORMATION B" }], dettes: [],
  messages: [],
  clients_installes: [
    { id: "K1", nom: "ESSO", user_id: "C1", type_installation: "Solaire résidentiel", date_entretien: "2026-10-06", equipe: [{ user_id: "T1", chef: true }] },  // J-10 : dedans
    { id: "K2", nom: "LOIN", tel: "90112244", date_entretien: "2026-10-07", equipe: [{ user_id: "T1", chef: true }] },   // J-11 : trop tôt
    { id: "K3", nom: "PASSE", tel: "90112255", date_entretien: "2026-09-25", equipe: [{ user_id: "T1", chef: true }] },  // hier : trop tard
    { id: "K4", nom: "SANS TEL", date_entretien: "2026-09-30", chef_prevu: "T2" },                                        // pas de numéro : tâche seule, chef prévu
    { id: "K5", nom: "FORM", tel: "90112266", date_entretien: "2026-09-30", vente_id: "VF" },                           // boutique de formation
    { id: "K6", nom: "MARQUE", tel: "90112277", date_entretien: "2026-09-30", formation: true },                         // marque formation
    { id: "K7", nom: "ELEVE", user_id: "CF", date_entretien: "2026-09-30" },                                             // compte de formation
    { id: "K8", nom: "BLOQUE", user_id: "C2", date_entretien: "2026-09-30" },                                            // compte bloqué : tâche au principal, rien au client
    { id: "K9", nom: "SUPPR", tel: "90112288", date_entretien: "2026-09-30", supprime_le: "2026-09-20" },                // corbeille
    { id: "K10", nom: "TRAV", tel: "90112299", date_entretien: "2026-09-30", travaux: true },                           // travaux à crédit
    { id: "K11", nom: "FAIT", tel: "90112200", date_entretien: "2026-09-30", rappel_entretien: { date: "2026-09-30", whatsapp_le: "2026-09-21", tache_le: "2026-09-21" } }, // déjà fait pour cette date
    { id: "K12", nom: "ANCIEN", tel: "90112211", date_entretien: "2026-09-30", rappel_entretien: { date: "2026-03-30", whatsapp_le: "2026-03-20", tache_le: "2026-03-20" } }, // marque d'une AUTRE date
  ],
};
const liste = E.rappelsEntretienDuJour(base, jour);
const de = (id) => liste.find((r) => r.chantier.id === id);
test("★★ la fenêtre : de J-10 au jour même (J-11 trop tôt, une date passée ne s'annonce plus), hors corbeille et travaux à crédit",
  !!de("K1") && !de("K2") && !de("K3") && !de("K9") && !de("K10") && E.JOURS_AVANT_ENTRETIEN === 10);
test("★★ LE MUR : jamais un chantier de formation — marque, boutique de sa vente, ou compte du client",
  !de("K5") && !de("K6") && !de("K7"));
test("★ au client : le modèle `rappel_entretien`, trois trous dans l'ordre (nom du compte, installation en minuscules, date JJ/MM/AAAA)",
  de("K1").whatsapp && de("K1").envoi.modele === "rappel_entretien" && de("K1").envoi.variables.join("|") === "ESSO|solaire résidentiel|06/10/2026" && de("K1").tel === "+22890112233");
test("★ la tâche va au chef de CE chantier ; sinon au chef prévu ; un compte client bloqué ne reçoit rien, mais la tâche part quand même (à l'administrateur principal faute d'équipe)",
  de("K1").tache && de("K1").pour.id === "T1" && de("K4").pour.id === "T2" && de("K4").tache && !de("K4").whatsapp
  && de("K8").pour.id === "A1" && de("K8").tache && !de("K8").whatsapp);
test("★★ UNE FOIS PAR DATE : la marque de CETTE date arrête tout ; celle d'une AUTRE date ne compte pas",
  !de("K11") && !!de("K12") && de("K12").whatsapp && de("K12").tache);
const avecLigne = { ...base, messages: [{ id: "m", canal: "whatsapp", wa_modele: "rappel_entretien", chantier_id: "K1", entretien_date: "2026-10-06" }] };
const avecTache = { ...base, users: base.users.map((u) => (u.id === "T1" ? { ...u, taches: [E.tacheEntretien({ id: "t", chantier: base.clients_installes[0], aujourdhui: jour })] } : u)) };
test("★ …et les deux filets qui ne se réécrivent pas : la ligne du fil (modèle + chantier + date) empêche un second message, la tâche déjà posée empêche une seconde tâche",
  E.rappelsEntretienDuJour(avecLigne, jour).find((r) => r.chantier.id === "K1")?.whatsapp === false
  && E.rappelsEntretienDuJour(avecTache, jour).find((r) => r.chantier.id === "K1")?.tache === false);
const t = E.tacheEntretien({ id: "t1", chantier: base.clients_installes[0], aujourdhui: jour });
const n = E.notificationTache({ pour: chef, chantier: base.clients_installes[0] });
test("★ la tâche : marquée automatique, liée au chantier, échéance = la date d'entretien, « à faire » ; la notification va au seul responsable et ouvre ✅ Mes tâches",
  t.auto === "entretien" && t.chantier_id === "K1" && t.echeance === "2026-10-06" && t.statut === "a_faire" && /Entretien de ESSO le 06\/10\/2026/.test(t.titre)
  && n.destinataires.join() === "T1" && n.ecran === "taches");
const ligne = E.ligneRappelEntretien({ id: "L", tel: de("K1").tel, compte: client, chantier: base.clients_installes[0], variables: de("K1").envoi.variables, ts: "2026-09-26T07:00:00Z" });
test("★ la ligne du fil : sortante, sans propriétaire, porte le modèle, le chantier et la date (le filet), jamais « livré » ni « lu »",
  ligne.canal === "whatsapp" && !ligne.proprietaire_id && ligne.wa_modele === "rappel_entretien" && ligne.chantier_id === "K1" && ligne.entretien_date === "2026-10-06"
  && /entretien/.test(ligne.texte) && !/livré|lu par/i.test(ligne.texte));
const marque = E.chantierApresRappel(base.clients_installes[0], { whatsapp_le: jour });
const marque2 = E.chantierApresRappel(marque, { tache_le: jour, tache_pour: "KOSSI" });
test("★ la marque du chantier dit pour QUELLE date, et se complète sans s'écraser (message puis tâche)",
  marque2.rappel_entretien.date === "2026-10-06" && marque2.rappel_entretien.whatsapp_le === jour && marque2.rappel_entretien.tache_pour === "KOSSI");
test("★★ ✅ Entretien fait : la prochaine date est proposée à +6 mois (31/08 → 28/02), l'entretien se garde dans une liste qui ne rétrécit pas, la nouvelle date rouvre le rappel",
  E.dateApresMois("2026-09-26") === "2027-03-26" && E.dateApresMois("2026-08-31") === "2027-02-28" && E.MOIS_ENTRE_ENTRETIENS === 6
  && (() => { const c = E.marquerEntretienFait({ ...marque2, entretiens: [{ le: "2026-03-01" }] }, { le: "2026-10-05", prochaine: "2027-04-05", par: "TIMO" });
    return c.entretiens.length === 2 && c.entretiens[1].prevu === "2026-10-06" && c.date_entretien === "2027-04-05"
      && E.rappelsEntretienDuJour({ ...base, clients_installes: [c] }, "2027-03-27").find((r) => r.chantier.id === "K1")?.whatsapp === true; })());
test("★ …refusé sans date, ou avec une prochaine date qui ne vient pas après",
  !!E.critiqueEntretienFait(base.clients_installes[0], { le: "" }) && !!E.critiqueEntretienFait(base.clients_installes[0], { le: "2026-10-05", prochaine: "2026-10-01" })
  && E.critiqueEntretienFait(base.clients_installes[0], { le: "2026-10-05", prochaine: "" }) === "");
const srvR = lire("api/rappels-du-matin.js");
const corpsR = srvR.slice(srvR.indexOf("async function rappelerLesEntretiens"));
test("★★ le serveur : la tournée lit les chantiers, envoie le modèle, et n'écrit la ligne du fil QU'APRÈS l'accord de WhatsApp",
  /"clients_installes"\]/.test(srvR) && /rappelsEntretienDuJour\(db, aujourdhui\)/.test(corpsR)
  && corpsR.indexOf("envoyerYCloud(") > 0 && corpsR.indexOf("if (!envoi.ok)") > corpsR.indexOf("envoyerYCloud(")
  && corpsR.indexOf('from("messages").insert') > corpsR.indexOf("if (!envoi.ok)"));
test("★ …la tâche : la fiche du responsable est RELUE et revérifiée avant d'écrire ; la marque ne se pose pas sur une date changée entre-temps ; les notifications rejoignent la tournée",
  /select\("id, data"\)\.eq\("id", r\.pour\.id\)/.test(corpsR) && /!tacheEntretienExiste\(frais\.data, r\.chantier\)/.test(corpsR)
  && /fraisC\.data\.date_entretien/.test(corpsR) && /\.\.\.entretiens\.notifications[,\]]/.test(srvR));
const ecranCI = lire("src/screens/ClientsInstalles.jsx");
const corpsFait = ecranCI.slice(ecranCI.indexOf("const entretienFait = async"), ecranCI.indexOf("const lierCompte = async"));
test("★ l'écran : « ✅ Entretien fait » (administrateur, revérifié dans le geste), la tâche automatique de cette date se ferme, ce que la tournée a fait se lit sous la date",
  /if \(refuserSaufAdmin\(profile, "Noter un entretien fait"\)\) return;/.test(corpsFait) && /critiqueEntretienFait\(c,/.test(corpsFait)
  // RETOURNÉ le 15/10/2026 (la règle des lignes) : un bouton rond.
  && /statut: "validee"/.test(corpsFait) && /\{isAdmin && !c\.travaux && c\.date_entretien && <BoutonRond data-entretien-fait icone="✅" teinte="vert" onClick=\{\(\) => entretienFait\(c\)\}/.test(ecranCI)
  && /data-rappel-entretien/.test(ecranCI));
test("rien de secret : aucune clé dans la règle, et le texte du modèle est celui validé par Timo",
  !/YCLOUD_API_KEY|VITE_/.test(lire("src/lib/rappelEntretien.js"))
  && M.TEXTE_RAPPEL_ENTRETIEN === "Bonjour {{1}}, l'entretien de votre installation {{2}} est prévu le {{3}}. Un technicien BMI TOGO vous contactera pour fixer l'heure. Pour changer la date, répondez simplement à ce message. BMI TOGO"
  && M.installationPourRappel("Autre") === "BMI TOGO" && M.installationPourRappel("") === "BMI TOGO");
}

{
titre("㉞ ⭐ LA DEMANDE D'AVIS GOOGLE APRÈS LA RÉCEPTION (26/09/2026, « 6 », « 10 jours »)");
const A = await import(pathToFileURL(join(process.cwd(), "src/lib/demandeAvis.js")).href);
const jour = "2026-09-26";
const client = { id: "C1", nom: "ESSO", nom_base: "ESSO", role: "client", tel: "+228 90 11 22 33" };
const recu = (id, le, plus = {}) => ({ id, nom: id, tel: "90112200", type_installation: "Solaire résidentiel", statut: "receptionne", receptionne_le: le, ...plus });
const base = {
  users: [client, { id: "C2", nom: "BLOQUE", role: "client", tel: "90445566", actif: false }, { id: "CF", nom: "ELEVE", role: "client", tel: "90778899", formation: true }],
  boutiques: [{ nom: "DEMAKPOE" }, { nom: "FORMATION B", formation: true }],
  ventes: [{ id: "VF", boutique: "FORMATION B" }], dettes: [], messages: [],
  clients_installes: [
    recu("K1", "2026-09-16", { nom: "ESSO", user_id: "C1" }),  // J+10 : part
    recu("K2", "2026-09-17"),                                   // J+9 : trop tôt
    recu("K3", "2026-08-17"),                                   // J+40 : part encore
    recu("K4", "2026-08-16"),                                   // J+41 : trop vieux
    recu("K5", "2026-09-10", { statut: "termine" }),            // pas réceptionné
    recu("K6", "2026-09-10", { vente_id: "VF" }),               // boutique de formation
    recu("K7", "2026-09-10", { user_id: "CF", tel: "" }),       // compte de formation
    recu("K8", "2026-09-10", { user_id: "C2", tel: "" }),       // compte bloqué
    recu("K9", "2026-09-10", { avis_demande_le: "2026-09-20" }),// déjà demandée
    recu("K10", "2026-09-10", { tel: "" }),                     // sans numéro
    recu("K11", "2026-09-10", { travaux: true }),               // travaux à crédit
    recu("K12", "2026-09-10", { supprime_le: "2026-09-20" }),   // corbeille
  ],
};
const ids = (l) => l.map((r) => r.chantier.id).join(",");
const liste = A.demandesAvisDuJour(base, jour);
test("★★ la fenêtre : du 10e au 40e jour après la réception (9e trop tôt, 41e jamais — pas un balayage de tout l'historique), réceptionné seulement",
  ids(liste) === "K1,K3" && A.JOURS_APRES_RECEPTION === 10 && A.JOURS_MAX_DEMANDE_AVIS === 40);
test("★★ LE MUR ET LES PORTES : jamais en formation (boutique, compte), jamais un compte bloqué, sans numéro, travaux à crédit, corbeille — et UNE fois : la marque du chantier arrête tout",
  !/K6|K7|K8|K9|K10|K11|K12/.test(ids(liste)));
test("★ …et la ligne du fil (modèle + chantier), qui ne se réécrit jamais, l'empêche aussi",
  ids(A.demandesAvisDuJour({ ...base, messages: [{ id: "m", canal: "whatsapp", wa_modele: "demande_avis", chantier_id: "K1" }] }, jour)) === "K3");
test("★ le modèle : MARKETING, trois trous dans l'ordre (nom du compte, installation en minuscules, le lien)",
  liste[0].envoi.modele === "demande_avis" && liste[0].envoi.variables.join("|") === `ESSO|solaire résidentiel|${A.LIEN_AVIS_GOOGLE_DEFAUT}` && M.MODELES.demande_avis.categorie === "marketing");
test("★★ le lien : celui de Timo d'office, celui réglé sur une boutique RÉELLE sinon (jamais la formation), coupé = rien ne part",
  A.LIEN_AVIS_GOOGLE_DEFAUT === "https://share.google/7LY5N6ctSmah0mlYY"
  && A.lienAvisGoogle([{ nom: "F", formation: true, avis_google: { lien: "https://faux", coupe: false } }]) === A.LIEN_AVIS_GOOGLE_DEFAUT
  && A.lienAvisGoogle([{ nom: "D", avis_google: { lien: "https://g.page/r/X", coupe: false } }]) === "https://g.page/r/X"
  && A.demandesAvisDuJour({ ...base, boutiques: [{ nom: "DEMAKPOE", avis_google: { lien: "", coupe: true } }] }, jour).length === 0
  && !!A.critiqueLienAvis("pas un lien") && A.critiqueLienAvis("https://share.google/abc") === "");
const ligne = A.ligneDemandeAvis({ id: "L", tel: liste[0].tel, compte: client, chantier: liste[0].chantier, variables: liste[0].envoi.variables, ts: "2026-09-26T07:00:00Z" });
test("★ la ligne du fil : sortante, sans propriétaire, porte le modèle et le chantier ; la marque dit le jour",
  ligne.canal === "whatsapp" && !ligne.proprietaire_id && ligne.wa_modele === "demande_avis" && ligne.chantier_id === "K1"
  && A.chantierApresAvis(liste[0].chantier, jour).avis_demande_le === jour);
test("le texte du modèle est celui de Timo, mot pour mot (INSTALLATION en capitales, le trou 3 numéroté)",
  M.TEXTE_DEMANDE_AVIS === "Bonjour {{1}},\nMerci d'avoir confié votre INSTALLATION {{2}} à BMI TOGO.\nVotre avis compte beaucoup pour nous et aide d'autres clients à nous faire confiance.\nPouvez-vous prendre une minute pour le partager ici : {{3}}\nMerci ! BMI TOGO");
const srvA = lire("api/rappels-du-matin.js");
const corpsA = srvA.slice(srvA.indexOf("async function demanderLesAvis"));
test("★★ le serveur : la ligne du fil et la marque ne s'écrivent QU'APRÈS l'accord de WhatsApp ; la fiche du chantier est RELUE avant la marque",
  /demandesAvisDuJour\(db, aujourdhui\)/.test(corpsA) && corpsA.indexOf("if (!envoi.ok)") > corpsA.indexOf("envoyerYCloud(")
  && corpsA.indexOf('from("messages").insert') > corpsA.indexOf("if (!envoi.ok)")
  && corpsA.indexOf('from("clients_installes").select') > corpsA.indexOf("if (!envoi.ok)") && /const avis = await demanderLesAvis\(admin, db, aujourdhui\);/.test(srvA));
const par = lire("src/screens/Parametres.jsx");
test("★ ⚙ Paramètres : le lien se règle et se coupe, administrateur PRINCIPAL seul, revérifié dans le geste ; le chantier dit « ⭐ Avis demandé le … »",
  /const enregistrerAvis = async \(couper = false\) => \{\s*if \(refuserSaufAdminPrincipal\(db, profile, "Régler la demande d'avis Google"\)\) return;/.test(par)
  && /data-reglage="avis-google"/.test(par) && /data-avis-demande/.test(lire("src/screens/ClientsInstalles.jsx")));
}

{
titre("㉟ 🔒 LES REÇUS DE VENTE ET LES BONS NE SE LISENT PAS PAR TOUT LE MONDE (26/09/2026, « moi seul », « reprise et retour aussi »)");
let lp = [];
try { lp = V.lignesPrivees(); } catch (e) { lp = []; }
const recu = lp.find((m) => m.wa_modele === "recu_vente_detail") || {};
const bon = lp.find((m) => m.wa_modele === "bon_reprise") || {};
test("★★ la ligne RANGÉE ne porte aucun détail (ni montant, ni article, ni paiement) : une phrase neutre, la marque privée et le lien vers la vente",
  recu.wa_prive === true && recu.vente_id === "V9" && /^🔒 Reçu de vente envoyé au client/.test(recu.texte || "")
  && !/200 000|Panneau|espèces|BMID-2026-0099/.test(JSON.stringify(recu))
  && bon.wa_prive === true && bon.bon_vente_id === "V9" && bon.bon_numero === "REP-BMID-2026-0099-1" && /^🔒 Bon de reprise/.test(bon.texte || "") && !/50 000|Ne veut plus/.test(bon.texte || ""));
// RETOURNÉ le 03/10/2026 : + l'avis de salaire (un salaire ne se lit pas par les collègues).
test("★ les seize modèles privés (RETOURNÉ le 22/10/2026 : + l'argent remis directement à quelqu'un ; le 14/10/2026 : + les deux avis d'une tâche, + l'attestation de fin de contrat ; le 13/10/2026 : + les deux avis de décision du DG sur une dépense, + le reçu de dépôt chantier ; le 07/10/2026 : + la part d'installation payée ; le 03/10/2026 : + l'avancement) : les deux reçus de vente, le bon de reprise, le bon de retour, les deux avis de salaire, la commission due, l'avancement — PAS le reçu d'un versement ni d'une réservation (décision de Timo)",
  M.MODELES_PRIVES.slice().sort().join(",") === "attestation_disponible,avancement_employe,bon_reprise,bon_retour,commission_due,depense_rejetee,depense_validee,fonds_remis,prime_installation_payee,recu_depot_chantier,recu_vente,recu_vente_detail,tache_assignee,tache_validee,virement_salaire,virement_salaire_credit" && !M.lignePrivee("recu_reglement") && !M.lignePrivee("recu_reservation"));
{
  // 💸 L'AVIS DE PAIEMENT D'UN SALAIRE (Timo, 03/10/2026, son texte).
  const eS = M.envoiVirementSalaire({ employe: "AKPOSSOGNA Kossiwa", tel: "90112233", mois: "octobre 2026", date: "2026-10-03", montant: 35000, moyen: "Espèces", reference: "BP-202610-ROBS", initiateur: { role: "Comptable", tel: "91123456" }, fmt: (n) => `${n} F`, dFR: (x) => x.split("-").reverse().join("/") });
  const texteS = eS ? eS.variables.reduce((x, v, i) => x.replace(`{{${i + 1}}}`, v), M.TEXTE_VIREMENT_SALAIRE) : "";
  test("★ 💸 l'avis de salaire : le texte de Timo mot pour mot, sept trous dans l'ordre (nom, mois, date, montant, moyen, référence, rôle + numéro de celui qui paie)",
    !!eS && eS.modele === "virement_salaire" && eS.variables.join("|") === "AKPOSSOGNA Kossiwa|octobre 2026|03/10/2026|35000 F|en espèces|BP-202610-ROBS|Comptable 91123456"
    && /^Bonjour AKPOSSOGNA Kossiwa,\n\nVirement de salaire\n\nBMI TOGO vous informe que votre salaire du mois de  octobre 2026 a été payé le 03\/10\/2026\.\nMontant : 35000 F en espèces\. Référence : BP-202610-ROBS\.\n\nMerci de confirmer la réception depuis votre espace sur :\ngestion\.bmitogo\.com, dans l'onglet « Salaire »\.\n\nComptable 91123456\nE-mail : contact@bmitogo\.com$/.test(texteS));
  test("★ 💸 sans numéro sur la fiche ou sans montant, rien ne part ; sans référence tapée et sans numéro de celui qui paie, jamais un trou vide",
    M.envoiVirementSalaire({ employe: "X", tel: "", montant: 1000 }) === null && M.envoiVirementSalaire({ employe: "X", tel: "90112233", montant: 0 }) === null
    && (() => { const e = M.envoiVirementSalaire({ employe: "X", tel: "90112233", mois: "octobre 2026", date: "2026-10-03", montant: 1000, moyen: "Virement bancaire", reference: "", initiateur: { role: "Administrateur" } }); return e && e.variables.every((v) => String(v).trim()) && /\+228 99 96 84 88$/.test(e.variables[6]) && /virement/i.test(e.variables[4]); })());
  test("★ 💸 la ligne rangée dans 📲 WhatsApp ne porte pas le salaire : phrase neutre, lisible par celui qui a payé et le principal",
    M.lignePrivee("virement_salaire") && /détail réservé/.test(M.ligneMasquee("virement_salaire")) && !/35000/.test(M.ligneMasquee("virement_salaire")));
  // 💸 Décision « b » (03/10/2026) : un mois AVEC retenue de crédit part par le second modèle.
  const eC = M.envoiVirementSalaire({ employe: "ANGELE", tel: "90112233", mois: "octobre 2026", date: "2026-10-03", montant: 35000, moyen: "Espèces", reference: "BP-1", initiateur: { role: "Administrateur", tel: "91130511" }, retenue: 25000, resteCredit: 350000, fmt: (n) => `${n} F`, dFR: (x) => x.split("-").reverse().join("/") });
  const texteC = eC ? eC.variables.reduce((x, v, i) => x.split(`{{${i + 1}}}`).join(v), M.TEXTE_VIREMENT_SALAIRE_CREDIT) : "";
  test("★ 💸 avec une retenue de crédit : le modèle virement_salaire_credit, dix trous dans l'ordre — salaire 60 000, retenue 25 000, versé 35 000, reste à rembourser 350 000 ; sans retenue, le modèle simple",
    !!eC && eC.modele === "virement_salaire_credit" && eC.variables.join("|") === "ANGELE|octobre 2026|03/10/2026|60000 F|25000 F|35000 F|en espèces|BP-1|350000 F|Administrateur 91130511"
    && /Salaire : 60000 F\nRetenue crédit BMI : 25000 F\nMontant versé : 35000 F en espèces\. Référence : BP-1\.\nReste à rembourser sur votre crédit : 350000 F\./.test(texteC)
    && M.envoiVirementSalaire({ employe: "X", tel: "90112233", montant: 1000, retenue: 0 }).modele === "virement_salaire");
  // 💰 La commission due (Timo, 03/10/2026, son texte ; trou 4 = espace ou boutique).
  const eCD = M.envoiCommissionDue({ nom: "FIFO", tel: "90333333", montant: 30000, client: "MR ERIC", espace: false, boutique: { nom: "BMI DEMAKPOE", tel: "91000000" }, fmt: (n) => `${n} F` });
  const texteCD = eCD ? eCD.variables.reduce((x, v, i) => x.replace(`{{${i + 1}}}`, v), M.TEXTE_COMMISSION_DUE) : "";
  test("★ 💰 commission due : le texte de Timo (« /? » corrigé), quatre trous ; un apporteur externe est envoyé à SA boutique avec son numéro, qui a un compte à son espace",
    /^Bonjour FIFO,\n\nCommission BMI TOGO\n\nVotre commission de 30000 F pour le chantier \/ la vente de MR ERIC est désormais due : les travaux ont été réceptionnés et le client a soldé son paiement\.\nElle vous sera réglée prochainement\. Pour la recevoir, passez à la boutique BMI DEMAKPOE \(Tél : 91000000\)\.\n\nBMI TOGO — E-mail : contact@bmitogo\.com\nTel: \+228 99 96 84 88 \/ \+228 91 13 05 11$/.test(texteCD)
    && M.envoiCommissionDue({ nom: "K", tel: "90", montant: 1, client: "X", espace: true }).variables[3] === M.SUITE_ESPACE
    && M.envoiCommissionDue({ nom: "K", tel: "", montant: 1 }) === null);
  // 🔧 La part des frais d'installation payée (07/10/2026, « b, texte ok »).
  const ePI = M.envoiPrimeInstallationPayee({ employe: "ANGELE", tel: "90112233", client: "POUDAMA Kodjo", date: "2026-10-07", montant: 25000, moyen: "Espèces", retenue: 5000, fmt: (n) => `${n} F`, dFR: (x) => x.split("-").reverse().join("/") });
  const textePI = ePI ? ePI.variables.reduce((x, v, i) => x.split(`{{${i + 1}}}`).join(v), M.TEXTE_PRIME_INSTALLATION_PAYEE) : "";
  test("★ 🔧 part d'installation payée : le texte accepté par Timo, six trous dans l'ordre ; la retenue pour outil perdu se dit, sinon « Aucune retenue. » ; sans numéro, rien",
    textePI === "Bonjour ANGELE, votre part des frais d'installation du chantier POUDAMA Kodjo vous a été payée le 07/10/2026 : 25000 F (en espèces). Retenue pour outil perdu : 5000 F. Détail dans votre espace sur gestion.bmitogo.com. Merci pour votre travail. BMI TOGO"
    && M.envoiPrimeInstallationPayee({ employe: "X", tel: "90112233", client: "Y", montant: 1000, moyen: "Espèces" }).variables[5] === "Aucune retenue."
    && M.envoiPrimeInstallationPayee({ employe: "X", tel: "", client: "Y", montant: 1000 }) === null
    && M.envoiPrimeInstallationPayee({ employe: "X", tel: "90112233", client: "Y", montant: 0, retenue: 3000 }).variables[4] === "entièrement retenu"
    && M.lignePrivee("prime_installation_payee") && !/25000/.test(M.ligneMasquee("prime_installation_payee"))
    && /m\.wa_modele === "prime_installation_payee"/.test(lire("src/lib/lignesPrivees.js"))
    && /ref\.prime_user_id \? \{ chantier_id: ref\.chantier_id, prime_user_id: ref\.prime_user_id \}/.test(lire("src/whatsapp.js")));
  const calS = readFileSync("src/lib/calculs.js", "utf8");
  const corpsVS = calS.slice(calS.indexOf("export async function envoyerVirementG"), calS.indexOf("// À partir de ce nombre de clients apportés"));
  test("★ 💸 le virement de salaire envoie l'avis TOUT SEUL (sans question ni repli), APRÈS l'enregistrement, vers la fiche de l'employé ; le mur = l'espace de SON compte ; la référence par défaut = le N° du bulletin",
    /envoiVirementSalaire\(\{/.test(corpsVS) && /envoyerRecuSansQuestion\(\{/.test(corpsVS) && corpsVS.indexOf("save({") < corpsVS.indexOf("envoyerRecuSansQuestion(")
    && /espaceFormation: formation/.test(corpsVS) && /const formation = estCompteFormation\(db, fiche\)/.test(corpsVS)
    && /numeroBulletin\(m, u\.id\)/.test(corpsVS) && /ref: \{ salaire_user_id: u\.id, virement_id: virement\.id \}/.test(corpsVS)
    && /numeroBulletin\(mois, u\.id\)/.test(readFileSync("src/lib/impression.js", "utf8"))
    // le reste dû est calculé APRÈS la retenue du mois, et le modèle simple prend le relais si l'autre ne part pas
    && /const creditsApres = appliquerRetenuesCredit\(u, m, profile\.nom\)/.test(corpsVS) && /reste_credit: creditsApres/.test(corpsVS)
    && /retenue, resteCredit: virement\.reste_credit/.test(corpsVS) && /if \(formation \|\| r\.startsWith\("📲"\)\) break;/.test(corpsVS));
}
test("★ un envoi ordinaire (devis, relance, dette) garde son texte en clair : il n'est pas privé, et une ligne sans marque ne se « déverrouille » pas",
  !M.lignePrivee("devis_disponible") && !M.lignePrivee("relance_devis") && !M.lignePrivee("rappel_dette") && M.ligneMasquee("relance_devis") === ""
  && !M.peutLireLignePrivee({ texte: "x" }, { id: "KOSSI" }, true));
let htmls = {};
for (const id of ["KOSSI", "TIMO", "ADMIN2", "AMA"]) { try { htmls[id] = V.htmlLignePrivee(id); } catch (e) { htmls[id] = ""; } }
test("★★ l'écran RENDU : celui qui a envoyé (KOSSI) et l'administrateur PRINCIPAL (TIMO) lisent le détail recomposé depuis la vente",
  /BMID-2026-0099/.test(htmls.KOSSI) && /200/.test(htmls.KOSSI) && /Panneau 370W/.test(htmls.KOSSI)
  && /BMID-2026-0099/.test(htmls.TIMO) && /Panneau 370W/.test(htmls.TIMO) && /REP-BMID-2026-0099-1/.test(htmls.TIMO));
test("★★ …un autre administrateur (pas le principal) et une autre vendeuse ne lisent QUE la phrase neutre",
  /Reçu de vente envoyé au client/.test(htmls.ADMIN2) && !/Panneau 370W/.test(htmls.ADMIN2) && !/BMID-2026-0099/.test(htmls.ADMIN2)
  && /Reçu de vente envoyé au client/.test(htmls.AMA) && !/Panneau 370W/.test(htmls.AMA) && !/BMID-2026-0099/.test(htmls.AMA));
test("★ le bon : établi par TIMO, KOSSI (qui n'a pas fait ce geste) ne lit pas son détail",
  !/REP-BMID-2026-0099-1/.test(htmls.KOSSI) && /Bon de reprise envoyé au client/.test(htmls.KOSSI));
const srcLP = lire("src/lib/lignesPrivees.js");
test("★ UNE fabrique pour l'envoi et l'affichage : 💰 Ventes et 📲 WhatsApp passent par lib/lignesPrivees.js, l'écran demande l'administrateur PRINCIPAL",
  /import \{ envoisRecuDeVente \} from "\.\.\/lib\/lignesPrivees";/.test(lire("src/screens/Ventes.jsx"))
  && /peutLireLignePrivee\(m, profile, estAdminPrincipal\(db, profile\), lecteursEnPlus\(m, db\)\) && texteLignePrivee\(m, db\)/.test(ecranWa)
  && /envoiBon\(\{ bon, boutique, fmt, dFR \}\)/.test(srcLP));
}

titre("㊱ 🪟 UNE RÈGLE POUR LA FENÊTRE QUI ACCOMPAGNE UNE OUVERTURE DE WHATSAPP (29/09/2026)");
// Timo, capture : « pourquoi elle vient après que le message soit déjà
// passé ? » puis « une seule règle qui régisse ces fenêtres ». Ce qui va se
// passer se dit AVANT ; WhatsApp ne s'ouvre qu'après OK ; plus rien après.
{
  const Core = await import("../src/lib/core.js");
  // La VRAIE fonction, avec un faux navigateur qui note l'ordre des gestes.
  const journal = [];
  const avant = globalThis.window;
  globalThis.window = { open: () => { journal.push("ouverture"); return {}; } };
  const parti = await Core.ouvrirWhatsAppApresAnnonce({ tel: "90112233", texte: "x", annonce: "Appuyez sur OK…",
    prevenir: async () => { journal.push("annonce"); } });
  const journal2 = [];
  globalThis.window = { open: () => { journal2.push("ouverture"); return {}; } };
  await Core.ouvrirWhatsAppApresAnnonce({ tel: "90112233", texte: "x", annonce: "", prevenir: async () => { journal2.push("annonce"); } });
  globalThis.window = avant;
  test("★★ la règle : l'annonce D'ABORD, attendue, puis l'ouverture — jamais l'inverse", parti === true && journal.join(",") === "annonce,ouverture");
  test("★ sans annonce, WhatsApp s'ouvre directement (décision « b » : pas de clic en plus)", journal2.join(",") === "ouverture");

  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const fichiers = execSync("git ls-files src").toString().trim().split("\n").filter((f) => /\.(jsx?|mjs)$/.test(f));
  // 1. Aucune phrase qui raconte une ouverture APRÈS coup, nulle part.
  const phrasesApres = fichiers.filter((f) => /s'est ouvert|vient de s'ouvrir|WhatsApp ouvert/.test(sansComm(lire(f))));
  test("★★ aucune phrase « s'est ouvert », « vient de s'ouvrir », « WhatsApp ouvert » dans toute l'application", phrasesApres.length === 0);
  if (phrasesApres.length) console.log("     fautifs :", phrasesApres.join(", "));
  // 2. Aucune fenêtre dans les 3 lignes qui suivent une ouverture de WhatsApp.
  const ouvre = /\b(envoyerWhatsApp|recuWhatsApp|bonWhatsApp|ouvrirWhatsAppApresAnnonce|envoyerIdentifiants\w*WhatsApp|envoyer\w*ProspectWhatsApp)\(/;
  const apres = [];
  for (const f of fichiers.filter((x) => x.startsWith("src/screens/"))) {
    const L = sansComm(lire(f)).split("\n");
    L.forEach((l, i) => {
      if (!ouvre.test(l) || /function |=>\s*\{?\s*$|return;/.test(l)) return;
      for (let j = i + 1; j <= i + 3 && j < L.length; j++) {
        if (/^\s*\};/.test(L[j]) || /return;/.test(L[j])) break;
        if (/uAlert\(/.test(L[j])) apres.push(`${f}:${j + 1}`);
      }
    });
  }
  test("★★ aucune fenêtre juste APRÈS une ouverture de WhatsApp (écrans)", apres.length === 0);
  if (apres.length) console.log("     fautifs :", apres.join(", "));
  // 3. Les endroits réparés passent par la règle, avec leur annonce.
  const ci = sansComm(lire("src/screens/ClientsInstalles.jsx"));
  // ⚠ RETOURNÉ le 01/10/2026 : le lien part du numéro BMI ; le REPLI garde
  // son annonce AVANT l'ouverture (annonceRepli).
  test("★ 🏠 Déclarer terminé : repli annoncé AVANT l'ouverture du lien du PV",
    /envoyerDuNumeroBmi\(c, envoiLienPv\([^\n]*\n\s*"✅ Travaux déclarés terminés\.\\n\\nAppuyez sur OK/.test(ci) && /prevenir: uAlert, demanderConfirmation: uConfirm, annonceRepli \}\)/.test(ci));
  test("★ 🏠 Mon espace → Parrainer : annoncé AVANT", /await ouvrirWhatsAppApresAnnonce\(\{ tel, texte: lignesMsg\.join\("\\n"\), prevenir: uAlert,[\s\S]{0,260}Appuyez sur OK : WhatsApp s'ouvre pour le prévenir/.test(sansComm(lire("src/screens/EspaceClient.jsx"))));
  const ven = sansComm(lire("src/screens/Ventes.jsx"));
  const corpsPf = ven.slice(ven.indexOf("const proformaWhatsApp = async"), ven.indexOf("\n  };", ven.indexOf("const proformaWhatsApp = async")));
  test("★★ 💰 Proforma : le PDF D'ABORD, puis l'annonce, puis WhatsApp",
    corpsPf.indexOf("genererProforma(") > 0 && corpsPf.indexOf("genererProforma(") < corpsPf.indexOf("ouvrirWhatsAppApresAnnonce(")
    && /Joignez-y le PDF/.test(corpsPf) && !/envoyerWhatsApp\(/.test(corpsPf));
  const pro = sansComm(lire("src/screens/Prospects.jsx"));
  const corpsAj = pro.slice(pro.indexOf("const ajouter = async"), pro.indexOf("\n  };", pro.indexOf("const ajouter = async")));
  // ⚠ RETOURNÉ le 01/10/2026 : l'accueil part du numéro BMI ; le REPLI
  // garde l'annonce AVANT (décision « a »).
  test("★ 🧲 Ajouter un prospect (décision « a ») : enregistré, PUIS numéro BMI, repli annoncé AVANT",
    corpsAj.indexOf("save(") > 0 && corpsAj.indexOf("save(") < corpsAj.indexOf("envoyerModele(")
    && /annonceRepli: `✅ Prospect « \$\{f\.nom\} » enregistré\.\\n\\nAppuyez sur OK : WhatsApp s'ouvre avec le message d'accueil/.test(corpsAj));
  // ⚠ RETOURNÉ le 01/10/2026 : relance, signature et avenant partent du
  // numéro BMI ; leur repli n'ajoute AUCUNE annonce (décision « b »).
  const corpsRel = pro.slice(pro.indexOf("const relancerWhatsApp = async"), pro.indexOf("\n  };", pro.indexOf("const relancerWhatsApp = async")));
  const corpsSig = ci.slice(ci.indexOf("const envoyerPourSignature = async"), ci.indexOf("\n  };", ci.indexOf("const envoyerPourSignature = async")));
  const corpsAv = ci.slice(ci.indexOf("const envoyerAvenant = async"), ci.indexOf("\n  };", ci.indexOf("const envoyerAvenant = async")));
  test("★ 🧲 Relancer, 🏠 Envoyer pour signature / Avenant, 🔒 Mes données (décision « b ») : pas de fenêtre en plus",
    /envoyerModele\(/.test(corpsRel) && !/annonceRepli/.test(corpsRel)
    && /envoyerDuNumeroBmi\(c, envoiLienPv\(\{[^)]*\}\)\);/.test(corpsSig) && /envoyerDuNumeroBmi\(c, envoiAv\);/.test(corpsAv)
    && /envoyerWhatsApp\(NUMERO_BMI_PRINCIPAL,/.test(sansComm(lire("src/screens/MesDonnees.jsx"))));
  test("★ 📲 « ✍️ Écrire » : la réponse qui n'arrivera pas ici se dit AVANT", /annonceRepli: "Appuyez sur OK : WhatsApp s'ouvre avec le texte\. Le message partira de VOTRE numéro/.test(sansComm(lire("src/screens/Whatsapp.jsx"))));
  test("★ ☀️ Devis envoyé à la main : UNE fenêtre avant (accès ratés compris), rien après",
    /annonceRepli: `\$\{motifAcces \?/.test(srcPartages) && !/await uAlert\(`Ses accès ne sont pas partis/.test(srcPartages));
}

titre("㊲ 🔧 LA POSE SEULE : 70 % AVANT DE PROGRAMMER, 30 % AU PV, LE RAPPEL DU SOLDE 3 JOURS APRÈS (29/09/2026)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const P = await import(pathToFileURL(join(process.cwd(), "src/lib/poseSeule.js")).href);
  const fmtP = (n) => `${Number(n || 0)} F`;
  const dFRp = (x) => String(x || "").split("-").reverse().join("/");
  test("★ l'acompte est de 70 % (article 4 du contrat de pose)", P.acomptePose(100000) === 70000 && P.ACOMPTE_POSE_PCT === 70);
  const dette0 = { id: "DP", montant: 100000, paye: 0, pose_seule: true, acompte_attendu: 70000, boutique_pose: "BMI DEMAKPOE", client: "KOFFI", tel: "90112233", date: "2026-09-01" };
  const d70 = { ...dette0, paye: 70000 }, d100 = { ...dette0, paye: 100000 }, d50 = { ...dette0, paye: 50000 };
  test("★ l'étape se lit sur la dette : acompte → solde → réglée",
    P.etatPose(dette0).etape === "acompte" && P.etatPose(d50).resteAcompte === 20000 && P.etatPose(d70).etape === "solde" && P.etatPose(d100).etape === "solde_ok");
  const ch = { id: "C1", pose_seule: true, dette_id: "DP", statut: "en_cours", equipe: [{ user_id: "CHEF", chef: true }] };
  test("★★ programmer : REFUSÉ tant que les 70 % ne sont pas versés, permis ensuite",
    /acompte de 70 %/.test(P.critiqueProgrammationPose(ch, d50, fmtP)) && P.critiqueProgrammationPose(ch, d70, fmtP) === "");
  test("★ une dette de pose d'AVANT la règle (sans acompte_attendu) n'est jamais bloquée",
    P.critiqueProgrammationPose(ch, { id: "DP", montant: 100000, paye: 0 }, fmtP) === "");
  const ch2 = { id: "C2", pose_seule: true, dette_id: "DX" };
  const autre = { ...dette0, id: "DX", boutique_pose: "BMI APESSITO" };
  const liste = P.posesAEncaisser([dette0, autre, { ...d100, id: "DZ" }], [ch, ch2, { id: "C3", pose_seule: true, dette_id: "DZ" }], "BMI DEMAKPOE");
  test("★★ 🧾 Commandes : les poses de CETTE boutique seulement, jamais une pose réglée",
    liste.length === 1 && liste[0].dette.id === "DP");
  test("★★ qui encaisse : le gérant (Timo : « le gérant aussi »), le vendeur, l'admin, le chef de CE chantier — pas un technicien quelconque",
    P.peutEncaisserPose(ch, { id: "G", role: "gerant" }) && P.peutEncaisserPose(ch, { id: "V", role: "vendeur" })
    && P.peutEncaisserPose(ch, { id: "CHEF", role: "technicien" }) && !P.peutEncaisserPose(ch, { id: "T2", role: "technicien" }));
  const chR = { ...ch, statut: "receptionne", receptionne_le: "2026-09-20" };
  test("★★ le solde est en retard STRICTEMENT après 3 jours (le contrat laisse « les 3 jours qui suivent »), dans une fenêtre",
    !P.soldeEnRetard(chR, d70, "2026-09-23") && P.soldeEnRetard(chR, d70, "2026-09-24") && !P.soldeEnRetard(chR, d70, "2026-10-01") && !P.soldeEnRetard(chR, d100, "2026-09-24"));
  test("★ le PV n'est pas bloqué : rien n'empêche la réception avec un solde dû (aucune règle de PV dans le module)",
    !/receptionne_le\s*=|contrat_statut/.test(sansComm(lire("src/lib/poseSeule.js"))));
  const client = { id: "K", nom: "KOFFI", tel: "90112233" };
  const dbS = { clients_installes: [{ ...chR, user_id: "K" }], dettes: [d70], users: [client], boutiques: [], ventes: [] };
  const jour = P.soldesPoseDuJour(dbS, "2026-09-24", { fmt: fmtP, dFR: dFRp });
  // RETOURNÉ le 29/09/2026 : le texte de Timo, `rappel_solde_pose`, remplace
  // `rappel_dette` (« votre achat du … » ne disait pas une pose).
  test("★★ la tournée : un message au client (modèle rappel_solde_pose, la date du PV) ET une alerte à l'administrateur",
    jour.length === 1 && jour[0].client && jour[0].admin && jour[0].envoi?.modele === "rappel_solde_pose"
    && jour[0].envoi.variables.join("|") === "KOFFI|20/09/2026|30000 F|100000 F");
  {
    const M2 = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappModeles.js")).href);
    const t = M2.TEXTE_RAPPEL_SOLDE_POSE;
    test("★ le texte de Timo : quatre trous dans l'ordre, ses coordonnées, aucune faute de frappe laissée",
      ["{{1}}", "{{2}}", "{{3}}", "{{4}}"].every((x, i, a) => t.indexOf(x) >= 0 && (i === 0 || t.indexOf(a[i - 1]) < t.indexOf(x)))
      && /réceptionnés le \{\{2\}\}/.test(t) && /contact@bmitogo\.com/.test(t) && /\+228 99 96 84 88 \/ \+228 91 13 05 11/.test(t)
      && /Merci de faire partie de nos clients/.test(t) && !/Veillez/.test(t) && !/\]\(/.test(t));
    test("★ un solde réglé ou sans date de réception ne part pas",
      M2.envoiRappelSoldePose({ dette: d100, chantier: chR, fmt: fmtP, dFR: dFRp }) === null
      && M2.envoiRappelSoldePose({ dette: d70, chantier: { ...chR, receptionne_le: "" }, fmt: fmtP, dFR: dFRp }) === null);
  }
  const dejaClient = P.soldesPoseDuJour({ ...dbS, dettes: [{ ...d70, rappel_solde_le: "2026-09-24" }] }, "2026-09-25", { fmt: fmtP, dFR: dFRp });
  test("★★ UNE fois : le message déjà parti ne repart pas, l'alerte non plus une fois posée",
    dejaClient.length === 1 && !dejaClient[0].client && dejaClient[0].admin
    && P.soldesPoseDuJour({ ...dbS, dettes: [{ ...d70, rappel_solde_le: "x", rappel_solde_admin_le: "x" }] }, "2026-09-25", { fmt: fmtP, dFR: dFRp }).length === 0);
  const bloque = P.soldesPoseDuJour({ ...dbS, users: [{ ...client, actif: false }] }, "2026-09-24", { fmt: fmtP, dFR: dFRp });
  test("★ compte bloqué : aucun message au client, l'administrateur est prévenu quand même", bloque.length === 1 && !bloque[0].client && bloque[0].admin && !bloque[0].tel);
  const form = P.soldesPoseDuJour({ ...dbS, clients_installes: [{ ...chR, user_id: "K", formation: true }] }, "2026-09-24", { fmt: fmtP, dFR: dFRp });
  test("★★ LE MUR : jamais un chantier de formation", form.length === 0);
  // Les écrans et le serveur.
  const vd = sansComm(lire("src/lib/validationDevis.js"));
  test("★★ la dette de pose NAÎT avec son acompte et la boutique du devis",
    /pose_seule: true, acompte_attendu: acomptePose\(d\.total\)/.test(vd) && /boutique_pose: d\.boutique \|\| boutique \|\| null/.test(vd));
  test("★ un devis corrigé garde ses 70 % sur le NOUVEAU montant", /acompte_attendu: acomptePose\(devis\.total\)/.test(sansComm(lire("src/lib/modifDevis.js"))));
  const ciP = sansComm(lire("src/screens/ClientsInstalles.jsx"));
  const prog = ciP.slice(ciP.indexOf("const enregistrerProgrammation = "), ciP.indexOf("const construireMessagePv"));
  test("★★ 🏠 programmer : revérifié DANS le geste, sur la dette, AVANT d'écrire",
    prog.indexOf("critiqueProgrammationPose(") > 0 && prog.indexOf("critiqueProgrammationPose(") < prog.indexOf("save(")
    && /if \(refusPose\) \{ uAlert\(refusPose\); return; \}/.test(prog));
  const geste = sansComm(lire("src/components/encaissementPose.js"));
  test("★★ le geste commun revérifie le droit et relit la dette FRAÎCHE",
    geste.indexOf("peutEncaisserPose(") > 0 && /\(db\.dettes \|\| \[\]\)\.find\(\(x\) => x\.id === chantier\.dette_id\)/.test(geste)
    && geste.indexOf("peutEncaisserPose(") < geste.indexOf("save("));
  const cmd = sansComm(lire("src/screens/Commandes.jsx"));
  // RETOURNÉ le 08/10/2026 (« lance l'étape 1 ») : le bloc reste celui de la
  // boutique du devis, mais l'argent entre dans la caisse 🏗 CHANTIER.
  test("★★ 🧾 Commandes : le bloc des poses de la boutique regardée, l'argent dans la caisse CHANTIER",
    /posesAEncaisser\(db\.dettes, db\.clients_installes, boutique\)/.test(cmd)
    && /encaisserDettePose\(\{ db, save, profile, chantier: p\.chantier, enBoutique: true \}\)/.test(cmd)
    && !/boutiqueEncaissement/.test(cmd)
    && /data-poses-a-encaisser/.test(cmd));
  test("★ le hook de 🧾 Commandes est posé AVANT le retour anticipé (écran blanc sinon)",
    cmd.indexOf('const [noteRecuWa, setNoteRecuWa] = useState("")') < cmd.indexOf("if (!boutique) return <AucuneBoutique", cmd.indexOf("export function CommandesRecues")));
  const api = sansComm(lire("api/rappels-du-matin.js"));
  const corps = api.slice(api.indexOf("async function rappelerLesSoldesDePose"));
  test("★★ serveur : rien n'est écrit dans le fil avant que WhatsApp accepte, la dette RELUE avant d'être marquée",
    corps.indexOf("envoyerYCloud(") > 0 && corps.indexOf("envoyerYCloud(") < corps.indexOf('from("messages").insert')
    && /clientParti = true;/.test(corps) && /client: clientParti, admin: r\.admin/.test(corps)
    && corps.indexOf('from("dettes").select') < corps.indexOf('from("dettes").update'));
  test("★ serveur : l'alerte part aux administrateurs, dans la tournée", /destinataires: idsAdmins\(db, false\)/.test(corps) && /\.\.\.soldes\.notifications/.test(api));
}

titre("㊵ LE PV, L'AVENANT, L'ACCUEIL ET LA RELANCE D'UN PROSPECT PARTENT DU NUMÉRO BMI (01/10/2026, « Lance »)");
{
  const M3 = await import("../src/lib/whatsappModeles.js");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const ci = sansComm(lire("src/screens/ClientsInstalles.jsx"));
  const pro = sansComm(lire("src/screens/Prospects.jsx"));
  // Les textes, mot pour mot ceux créés chez YCloud.
  test("★★ les quatre textes : bloc de contact (e-mail, numéros, site), adresse du lien FIXE dans le modèle, seul le code est un trou",
    /https:\/\/bmitogo\.com\/signature\/\{\{3\}\}/.test(M3.TEXTE_LIEN_SIGNATURE_PV) && /https:\/\/bmitogo\.com\/avenant\/\{\{3\}\}/.test(M3.TEXTE_AVENANT_RESERVES)
    && [M3.TEXTE_LIEN_SIGNATURE_PV, M3.TEXTE_AVENANT_RESERVES, M3.TEXTE_ACCUEIL_PROSPECT, M3.TEXTE_RELANCE_PROSPECT].every((t) => /contact@bmitogo\.com/.test(t) && /\+228 99 96 84 88 \/ \+228 91 13 05 11/.test(t) && /www\.bmitogo\.com/.test(t) && /^Bonjour \{\{1\}\},/.test(t)));
  test("★ la relance est la version de Timo (retour à la ligne après « {{3}} : », « Etes »)",
    /votre projet \{\{3\}\} :\nEtes-vous toujours intéressé \?/.test(M3.TEXTE_RELANCE_PROSPECT));
  test("★ catégories : PV et avenant utility, accueil et relance marketing ; les quatre en service",
    M3.MODELES.lien_signature_pv.categorie === "utility" && M3.MODELES.avenant_reserves.categorie === "utility"
    && M3.MODELES.accueil_prospect.categorie === "marketing" && M3.MODELES.relance_prospect.categorie === "marketing"
    && ["lien_signature_pv", "avenant_reserves", "accueil_prospect", "relance_prospect"].every((m) => M3.MODELES_EN_SERVICE.includes(m)));
  const pv = M3.envoiLienPv({ nom: "KOFFI Ama", installation: "Solaire", jeton: "a1b2c3d4" });
  test("★★ le PV : nom, installation en minuscules, CODE seul ; le texte rempli porte l'adresse entière",
    pv.variables.join("|") === "KOFFI Ama|solaire|a1b2c3d4" && /https:\/\/bmitogo\.com\/signature\/a1b2c3d4\n/.test(M3.texteEnvoi(pv))
    && M3.envoiLienPv({ nom: "X", installation: "Autre", jeton: "z" }).variables[1] === "BMI TOGO" && M3.envoiLienPv({ nom: "X", jeton: "" }) === null);
  const av = M3.envoiAvenant({ nom: "KOFFI", pv: "PV-2026-0012", jeton: "q9" });
  test("★ l'avenant : nom, numéro du PV, code", av.variables.join("|") === "KOFFI|PV-2026-0012|q9" && /procès-verbal N° PV-2026-0012/.test(M3.texteEnvoi(av)));
  test("★★ la ligne du fil ne porte JAMAIS le code du lien (une clé de signature)",
    !/a1b2c3d4/.test(M3.ligneEnvoiModele(pv.modele, pv.variables)) && !/q9/.test(M3.ligneEnvoiModele(av.modele, av.variables))
    && M3.ligneEnvoiModele(pv.modele, pv.variables).startsWith(M3.PREFIXE_LIGNE_ENVOI));
  test("★★ le projet s'accorde après « votre projet » (décision « a »)",
    M3.projetDansLaPhrase("Solaire") === "d'installation solaire" && M3.projetDansLaPhrase("Forage") === "de forage"
    && M3.projetDansLaPhrase("Éclairage") === "d'éclairage" && M3.projetDansLaPhrase("Vidéo surveillance") === "de vidéo surveillance"
    && M3.projetDansLaPhrase("") === "");
  test("★★ sans projet, aucune relance ne part (jamais « votre projet  : »)",
    M3.envoiRelanceProspect({ nom: "Kofi", auteur: "AMA", projet: "" }) === null
    && M3.envoiRelanceProspect({ nom: "Kofi", auteur: "AMA", projet: "d'installation solaire" }).variables.join("|") === "KOFI|AMA|d'installation solaire");
  // L'écran : le mur, la question, le projet demandé, la nature jamais envoyée.
  const corpsRel = pro.slice(pro.indexOf("const relancerWhatsApp = async"), pro.indexOf("const changerProjet"));
  test("★★ 🧲 relance : le projet DEMANDÉ s'il manque, UNE question avant le numéro BMI, le mur = la FICHE",
    corpsRel.indexOf("demanderProjet(") > 0 && corpsRel.indexOf("demanderProjet(") < corpsRel.indexOf("if (!await uConfirm(`Relancer")
    && corpsRel.indexOf("if (!await uConfirm(`Relancer") < corpsRel.indexOf("envoyerModele(") && /espaceFormation: !!p\.formation/.test(corpsRel)
    && /texteRepli: texteEnvoi\(envoi\)/.test(corpsRel) && /projet,/.test(corpsRel));
  test("★★ le texte libre « Nature du chantier » ne part JAMAIS au client", !/nature/.test(corpsRel) && !/\.nature/.test(pro.slice(pro.indexOf("const ajouter = async"), pro.indexOf("const supprimer = async (p)"))));
  const corpsAj = pro.slice(pro.indexOf("const ajouter = async"), pro.indexOf("const supprimer = async (p)"));
  test("★ 🧲 accueil : le mur = la fiche, la conversation revient au commercial si elle n'est à personne",
    /espaceFormation: !!p\.formation/.test(corpsAj) && /donnerAuSender: true/.test(corpsAj) && /texteRepli: texteEnvoi\(envoi\)/.test(corpsAj));
  test("★ 🧲 la liste « Projet » = les métiers de ⚙ Paramètres (sans « Autre ») + « ✏️ Autre… » tapé ; il s'affiche et se cherche",
    /domainesDefinis\(db\)\.map\(\(d\) => d && d\.nom\)\.filter\(\(n\) => n && !\/\^autre\$\/i\.test\(n\)\)/.test(pro)
    && /data-projet-prospect/.test(pro) && /data-projet>/.test(pro) && /\(p\.projet \|\| ""\)/.test(pro));
  const corpsEnv = ci.slice(ci.indexOf("const envoyerDuNumeroBmi = async"), ci.indexOf("\n  };", ci.indexOf("const envoyerDuNumeroBmi = async")));
  test("★★ 🏠 PV et avenant : le mur = l'espace du CHANTIER, la ligne ne donne la conversation à personne, le repli = le texte du modèle",
    /espaceFormation: !!espaceDuChantier\(db, c, profile\)/.test(corpsEnv) && !/donnerAuSender/.test(corpsEnv)
    && /texteRepli: texteEnvoi\(envoi\)/.test(corpsEnv) && /if \(r\.auto\)/.test(corpsEnv));
}

titre("㊶ 💬 MESSAGES ET 📲 WHATSAPP : CE QUE L'ÉCRAN DIT EST VRAI (01/10/2026, chapitre 20 du manuel)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const wa = sansComm(lire("src/screens/Whatsapp.jsx"));
  const corps = wa.slice(wa.indexOf("const reattribuer = async"), wa.indexOf("const rendreATous = async"));
  test("★★ 🔁 Confier ne propose QUE quelqu'un qui a 📲 WhatsApp (jamais le comptable : la conversation serait perdue pour tous sauf l'administrateur)",
    /utilisateursDeLEspace\(db, profile\)\.filter\(\(u\) => u\.actif !== false && aAccesWhatsapp\(u\)\)/.test(corps));
  test("★ la liste vide dit vrai : une conversation naît quand un client ÉCRIT au numéro BMI, pas seulement quand il répond",
    /dès qu'un client écrit au numéro BMI, ou répond à un message qui en est parti/.test(wa));
  test("★ 💬 Messages : le client lit QUI reçoit son message (les techniciens de SON chantier, pas tous)",
    /l'administration, les techniciens de votre chantier et votre commercial/.test(lire("src/screens/Messagerie.jsx")));
}

titre("㊷ L'ASSISTANT DONNE UN TOTAL CALCULÉ PAR L'APPLICATION, ET CONSEILLE SELON « NOS CHOIX BMI » (01/10/2026, « lance les deux »)");
// L'IA ne calcule jamais : `calculer_total` multiplie et additionne au prix
// du stock, boutique par boutique ; le juge n'accepte que ses montants. Le
// mémo de la direction entre dans la consigne, lu sur une boutique RÉELLE.
{
  const I = await import("../src/lib/assistantIA.js");
  const stock = [
    { nom: "Panneau 400W", categorie: "Panneaux", boutique: "DEMAKPOE", prix: 85000, disponible: true },
    { nom: "Panneau 400W", categorie: "Panneaux", boutique: "APESSITO", prix: 90000, disponible: true },
    { nom: "Batterie lithium 48V", categorie: "Batteries", boutique: "DEMAKPOE", prix: 600000, disponible: false },
    { nom: "Câble 6 mm", categorie: "Câbles", boutique: "DEMAKPOE", prix: 1500, disponible: true },
    { nom: "Câble 6 mm", categorie: "Câbles", boutique: "APESSITO", prix: 1500, disponible: true },
    { nom: "Moteur central", categorie: "Moteurs", boutique: "APESSITO", prix: 0, disponible: true },
  ];
  const t1 = I.totalArticles(stock, [{ article: "Panneau 400W", quantite: 3 }]);
  test("★★ 3 panneaux : un total PAR BOUTIQUE au prix de SON stock (255 000 et 270 000), jamais un mélange",
    t1.ok && t1.parBoutique.length === 2 && t1.parBoutique.map((u) => u.total).sort((a, b) => a - b).join() === "255000,270000"
    && t1.montants.includes(255000) && t1.montants.includes(270000) && t1.montants.includes(85000));
  test("★★ le juge ACCEPTE la phrase de l'outil recopiée telle quelle — et elle dit « articles seuls, hors pose et transport »",
    I.garderReponse(t1.texte, { prixConnus: t1.montants }).ok === true && t1.texte.includes(I.PHRASE_TOTAL) && /hors pose et transport/.test(I.PHRASE_TOTAL));
  test("★★ un total CALCULÉ PAR L'IA (pas par l'outil) est toujours JETÉ",
    I.garderReponse("3 panneaux vous feront 255 000 F.", { prixConnus: [85000] }).ok === false);
  const t2 = I.totalArticles(stock, [{ article: "Panneau 400W", quantite: 3 }, { article: "Batterie lithium 48V", quantite: 1 }]);
  test("★★ plusieurs articles : seule une boutique qui a TOUT chiffre (DEMAKPOE, 855 000) ; « sur commande » est dit",
    t2.ok && t2.parBoutique.length === 1 && t2.parBoutique[0].total === 855000 && /sur commande/.test(t2.texte) && !/APESSITO/.test(t2.texte) && /^À DEMAKPOE :/.test(t2.texte));
  const t3 = I.totalArticles(stock, [{ article: "Câble 6 mm", quantite: 10 }]);
  test("★ deux boutiques au même prix = UNE réponse qui les nomme toutes les deux",
    t3.ok && t3.parBoutique.length === 1 && t3.parBoutique[0].boutiques.length === 2 && t3.parBoutique[0].total === 15000);
  test("★ la boutique demandée seule",
    (() => { const t = I.totalArticles(stock, [{ article: "Panneau 400W", quantite: 2 }], "apessito"); return t.ok && t.parBoutique.length === 1 && t.parBoutique[0].total === 180000; })());
  test("★★ une quantité non dite (0, 1,5, un mot) est REFUSÉE — on ne suppose jamais un nombre",
    [0, 1.5, "deux", undefined, -2].every((q) => I.totalArticles(stock, [{ article: "Panneau 400W", quantite: q }]).ok === false));
  test("★★ un article introuvable, ou sans prix, est REFUSÉ",
    I.totalArticles(stock, [{ article: "Onduleur 10 kW", quantite: 1 }]).ok === false
    && I.totalArticles(stock, [{ article: "Moteur central", quantite: 1 }]).ok === false);
  test("★ trop de lignes : refusé, on propose un devis",
    I.totalArticles(stock, Array.from({ length: I.MAX_LIGNES_TOTAL + 1 }, () => ({ article: "Câble 6 mm", quantite: 1 }))).ok === false);
  const ex = I.executerOutil("calculer_total", { lignes: [{ article: "Panneau 400W", quantite: 3 }] }, { articles: stock });
  const exNon = I.executerOutil("calculer_total", { lignes: [{ article: "Panneau 400W", quantite: 0 }] }, { articles: stock });
  test("★★ l'outil donne au juge EXACTEMENT ses montants ; refusé, il n'en donne AUCUN",
    ex.effets.prix.includes(255000) && ex.effets.conseiller === false && exNon.effets.prix.length === 0 && /AUCUN chiffre/.test(exNon.resultat));
  test("★★ la consigne : un total UNIQUEMENT par calculer_total, jamais une multiplication de l'IA, et la quantité se demande",
    /UNIQUEMENT par l'outil calculer_total/.test(I.CONSIGNE_IA) && /JAMAIS une multiplication ni une addition toi-même/.test(I.CONSIGNE_IA)
    && /s'il n'a pas dit combien, demande-le/.test(I.CONSIGNE_IA));

  // 📝 Le mémo
  test("★★ le mémo se lit sur une boutique RÉELLE seulement (le mur)",
    I.memoAssistant([{ nom: "F", formation: true, assistant_memo: "Entraînement" }, { nom: "R", assistant_memo: "Nous installons en 48 V." }]) === "Nous installons en 48 V."
    && I.memoAssistant([{ nom: "F", formation: true, assistant_memo: "Entraînement" }]) === "");
  test("★★ un mémo avec un PRIX, un sujet réservé, ou trop long est REFUSÉ ; un mémo ordinaire passe",
    !!I.critiqueMemoAssistant("Batterie lithium à 600 000 F") && !!I.critiqueMemoAssistant("On ne fait pas de crédit")
    && !!I.critiqueMemoAssistant("x".repeat(I.MEMO_ASSISTANT_MAX + 1)) && I.critiqueMemoAssistant("Nous installons en 48 V. Nous recommandons le lithium.") === "");
  test("★★ la consigne porte le mémo et dit de conseiller SELON lui ; sans mémo, aucune section",
    /LES CHOIX DE BMI TOGO[\s\S]*Nous installons en 48 V\.[\s\S]*SELON LUI/.test(I.consignePour({ memo: "Nous installons en 48 V." }))
    && !/LES CHOIX DE BMI TOGO/.test(I.consignePour({})));
  const par = lire("src/screens/Parametres.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const corpsM = par.slice(par.indexOf("const enregistrerMemo = async"), par.indexOf("};", par.indexOf("const enregistrerMemo = async")));
  test("★★ ⚙ Paramètres : écrire le mémo = l'administrateur PRINCIPAL, revérifié DANS le geste, critiqué avant d'écrire",
    /refuserSaufAdminPrincipal\(db, profile,/.test(corpsM) && /bloquerSiLecture\(db, profile\)/.test(corpsM)
    && /critiqueMemoAssistant\(texte\)/.test(corpsM) && /poserMemoAssistant\(db\.boutiques, texte\)/.test(corpsM)
    && /data-reglage="choix-bmi"/.test(par) && /jeSuisPrincipal && <button onClick=\{enregistrerMemo\}/.test(par));
  test("★ le serveur passe le mémo à la consigne",
    /memo: memoAssistant\(boutiques\)/.test(lire("api/whatsapp-entrant.js")));
}

// ──────────────────────────────────────────────────────────────
titre("㊸ L'ASSISTANT VOIT NOS MÉTIERS ET LA FICHE DE TOUS LES ARTICLES, ET CHOISIT UNE POMPE (01/10/2026, « les 4 »)");
// Captures Timo : « pompe de forage » ne trouvait rien (le métier n'était ni
// transmis ni cherché), la fiche des pompes n'arrivait pas à l'IA, sa requête
// gardait les petits mots, et aucun outil ne choisissait une pompe. Puis :
// « pas seulement la fiche des pompes… de tous les articles ».
{
  const A = await import("../src/lib/assistantWhatsapp.js");
  const I = await import("../src/lib/assistantIA.js");
  const boutiques = [
    { nom: "DEMAKPOE", domaines: [{ id: "solaire", nom: "Solaire", familles: ["Panneaux solaires"] }, { id: "forage", nom: "Forage", familles: ["Pompe", "Tuyaux"] }] },
    { nom: "ECOLE", formation: true, domaines: [{ id: "x", nom: "Entraînement" }] },
  ];
  const produits = [
    { id: "q1", nom: "Pompe immergée 4SP 60", categorie: "Pompe", domaine: "forage", boutique: "DEMAKPOE", prix_vente: 350000, initial: 2, puissance_kw: 0.75, profondeur_max_m: 60, debit_max_m3h: 3, hybride: true, garantie_boutique: "1 an", prix_achat: 200000, fournisseur: "SECRET FOURNISSEUR", notes: "remise fournisseur 10 %", code: "123456", seuil: 1, fiche_technique: "https://exemple.com/4sp60.pdf" },
    { id: "q2", nom: "Pompe immergée 4SP 120", categorie: "Pompe", domaine: "forage", boutique: "DEMAKPOE", prix_vente: 650000, initial: 0, puissance_kw: 1.5, profondeur_max_m: 120, debit_max_m3h: 2 },
    { id: "q3", nom: "Pompe de surface 30", categorie: "Pompe", domaine: "forage", boutique: "DEMAKPOE", prix_vente: 90000, initial: 1, profondeur_max_m: 30 },
    { id: "q4", nom: "Pompe sans fiche", categorie: "Pompe", domaine: "forage", boutique: "DEMAKPOE", prix_vente: 100000, initial: 1 },
    { id: "t1", nom: "Tuyau PEHD 32", categorie: "Tuyaux", domaine: "forage", boutique: "DEMAKPOE", prix_vente: 1500, initial: 100, profondeur_max_m: 99, garantie_fabricant: "6 mois" },
    { id: "e1", nom: "Pompe entraînement", categorie: "Pompe", domaine: "x", boutique: "ECOLE", prix_vente: 1, initial: 9, profondeur_max_m: 500 },
  ];
  const articles = A.articlesPourAssistant({ produits, boutiques });
  const p60 = articles.find((a) => a.nom.includes("60"));
  test("★★ le MÉTIER arrive par son nom réglé dans ⚙ Paramètres (« forage » → « Forage »)", p60.metier === "Forage");
  test("★★ la fiche de TOUS les articles passe : puissance, garanties, lien de fiche technique (le tuyau a sa garantie fabricant)",
    p60.puissance_kw === 0.75 && p60.garantie_boutique === "1 an" && p60.fiche_technique === "https://exemple.com/4sp60.pdf"
    && articles.find((a) => a.nom.startsWith("Tuyau")).garantie_fabricant === "6 mois");
  test("★★ profondeur, débit, hybride : POMPE seulement (c'est la catégorie qui décide — le tuyau n'a pas de profondeur)",
    p60.profondeur_max_m === 60 && p60.debit_max_m3h === 3 && p60.hybride === true
    && articles.find((a) => a.nom.startsWith("Tuyau")).profondeur_max_m === undefined);
  const interdites = ["prix_achat", "fournisseur", "notes", "code", "seuil", "stock_cible", "initial", "entrees", "qte", "quantite"];
  test("★★ JAMAIS : prix d'achat, fournisseur, notes internes, code-barres, seuil, quantité — ni dans la liste, ni dans ce que l'IA reçoit",
    articles.every((a) => interdites.every((k) => !(k in a)))
    && (() => { const r = I.executerOutil("chercher_article", { recherche: "pompe" }, { articles }).resultat; return !/SECRET|remise fournisseur|200000|123456/.test(r); })());
  test("★★ LE MUR : la pompe d'une boutique de FORMATION n'existe pas pour l'assistant", !articles.some((a) => a.boutique === "ECOLE"));

  const ch = I.executerOutil("chercher_article", { recherche: "je veux une pompe de forage" }, { articles });
  // Un refus de l'outil est du texte : il doit donner un ✗ lisible, pas arrêter le banc.
  const lus = (() => { try { return JSON.parse(ch.resultat); } catch { return []; } })();
  test("★★ « je veux une pompe de forage » trouve les pompes : petits mots retirés, métier cherché",
    lus.length === 4 && lus.every((a) => a.metier === "Forage" && /Pompe/.test(a.nom)));
  test("★★ l'IA lit la fiche : le débit est dit EN SURFACE (jamais « débit » tout court)",
    lus.find((a) => a.nom.includes("60"))?.debit_max_m3h_en_surface === 3 && !lus.some((a) => "debit_max_m3h" in a));
  test("★ le menu à chiffres montre la fiche aussi (« jusqu'à 60 m », « en surface », garantie)",
    /jusqu'à 60 m · débit max 3 m³\/h \(en surface\) · hybride · garantie : 1 an/.test(A.texteArticles("pompe", [p60])));

  // 💧 choisir_pompe
  const ok = I.executerOutil("choisir_pompe", { niveau_dynamique_m: 45, hauteur_reservoir_m: 8, longueur_tuyau_m: 60, litres_par_jour: 3000 }, { articles, pertesPct: 5 });
  const r = (() => { try { return JSON.parse(ok.resultat); } catch { return { pompes_qui_montent_assez_haut: [], pompes_trop_courtes: [] }; } })();
  test("★★ 45 m + 8 m + 3 m (5 % de 60 m) = 56 m ; 3 000 L ÷ 6 h = 0,5 m³/h — LA règle du volet du devis",
    r.hauteur_a_faire_monter_m === 56 && r.debit_necessaire_m3h === 0.5);
  test("★★ seules les pompes qui MONTENT assez haut, la plus juste d'abord ; les trop courtes nommées ; la non renseignée comptée",
    r.pompes_qui_montent_assez_haut.map((a) => a.nom).join("|") === "Pompe immergée 4SP 60|Pompe immergée 4SP 120"
    && r.pompes_trop_courtes.length === 1 && /surface 30/.test(r.pompes_trop_courtes[0]) && r.pompes_sans_fiche === 1);
  test("★★ le tuyau (profondeur saisie par erreur) n'est JAMAIS une pompe ; la pompe de formation non plus",
    !/Tuyau|entraînement/.test(ok.resultat));
  test("★★ le juge n'accepte que les prix des pompes proposées",
    ok.effets.prix.join() === "350000,650000");
  test("★★ jamais un débit promis à cette hauteur : l'avertissement de la courbe part avec la réponse",
    /ne donne pas son débit maximal à sa profondeur maximale/.test(r.a_dire_au_client) && /Ne JAMAIS promettre un débit/.test(r.consigne));
  const sansNiveau = I.executerOutil("choisir_pompe", { litres_par_jour: 3000 }, { articles });
  test("★★ sans le NIVEAU DYNAMIQUE : refus, dit pourquoi (le foreur), AUCUN prix permis",
    /niveau dynamique/.test(sansNiveau.resultat) && /foreur/.test(sansNiveau.resultat) && sansNiveau.effets.prix.length === 0);
  test("★ sans pompe assez haute : on le DIT, rien d'inventé",
    (() => { const x = JSON.parse(I.executerOutil("choisir_pompe", { niveau_dynamique_m: 200, litres_par_jour: 1000 }, { articles }).resultat);
      return x.pompes_qui_montent_assez_haut.length === 0 && /Aucune pompe/.test(x.consigne); })());

  // La consigne
  // ⚠ RETOURNÉ le 18/10/2026 (« C b ») : les articles et leurs prix ne viennent plus d'office après le conseil général, mais quand la discussion va vers un achat.
  test("★★ LA RÈGLE DE TIMO : renseigner de manière générale sans prix, et ne proposer des articles de NOTRE stock que quand le client montre qu'il veut acheter",
    /Tu peux renseigner le client de manière générale/.test(I.CONSIGNE_IA) && /que quand le client montre qu'il veut acheter/.test(I.CONSIGNE_IA)
    && /tu lui proposes des articles précis de NOTRE stock/.test(I.CONSIGNE_IA));
  test("★★ la consigne : pour une pompe, le niveau dynamique d'abord, et jamais un débit promis à une profondeur",
    /NIVEAU DE L'EAU PENDANT LE POMPAGE/.test(I.CONSIGNE_IA) && /Tu ne promets JAMAIS un débit à une profondeur donnée/.test(I.CONSIGNE_IA));
  test("★★ les métiers arrivent dans la consigne AVEC leurs familles (« Forage (Pompe, Tuyaux) »), boutiques réelles seulement",
    /Forage \(Pompe, Tuyaux\)/.test(I.consignePour({ metiers: I.domainesPourIA(boutiques) })) && !/Entraînement/.test(I.consignePour({ metiers: I.domainesPourIA(boutiques) })));
  test("★ le serveur donne à choisir_pompe le MÊME stock et les frottements réglés (boutiques réelles)",
    /\["chercher_article", "calculer_total", "choisir_pompe", "panneaux_pour_pompe"\]\.includes\(nom\) \? await chargerArticles\(\)/.test(lire("api/whatsapp-entrant.js"))
    && /pertesPct: \(reelles\.find\(\(b\) => Number\(b\.pertes_tuyau_pct\) > 0\)/.test(lire("api/whatsapp-entrant.js")));
}

// ──────────────────────────────────────────────────────────────
titre("㊹ L'ASSISTANT RESTE DANS LA CONVERSATION : réécriture, retour « assistant », 48 V, panneaux d'une pompe (01/10/2026, « lance tout, marge 1,3, le plus puissant du stock »)");
// Captures Timo (22:48 → 23:19) : le menu à chiffres surgissait au milieu de
// l'échange, le conseiller revenait à chaque message, la lithium 51,2 V
// n'était pas « du 48 V », et aucun outil ne disait combien de panneaux pour
// une pompe. Puis : « il peut toujours proposer un conseiller, mais avoir la
// possibilité de revenir à l'assistant ».
{
  const A = await import("../src/lib/assistantWhatsapp.js");
  const I = await import("../src/lib/assistantIA.js");
  const il = (min) => new Date(Date.now() - min * 60e3).toISOString();
  const ent = (texte, min) => ({ id: `e${min}`, canal: "whatsapp", wa_tel: "90112233", wa_entrant: true, ts: il(min), texte });
  const robot = (etape, min, ia = true) => ({ id: `r${min}`, canal: "whatsapp", wa_tel: "90112233", de_id: "assistant-bmi", ts: il(min), texte: "…", wa_assistant: { etape, ...(ia ? { ia: true } : {}) } });

  // ── Le retour à l'assistant
  const apresRelais = [ent("je veux un conseiller", 10), robot(A.ETAPE_CONSEILLER, 9)];
  const dRetour = A.decisionAssistant({ fil: [...apresRelais, ent("Assistant", 1)] });
  test("★★ « assistant » après un relais : l'assistant REVIENT — et la conversation CONTINUE (pas de nouvelle présentation)",
    dRetour.repondre === true && dRetour.retour === true && dRetour.etape === A.ETAPE_MENU && I.conversationNouvelle(dRetour) === false);
  test("★★ tout autre message après un relais : il se tait toujours (le conseiller garde la main)",
    A.decisionAssistant({ fil: [...apresRelais, ent("bonjour, j'attends", 1)] }).repondre === false);
  test("★ « menu » rouvre toujours l'accueil (inchangé)",
    A.decisionAssistant({ fil: [...apresRelais, ent("menu", 1)] }).etape === null);
  test("★★ le relais et la demande enregistrée DISENT la porte de retour, et passent le juge",
    A.TEXTE_RELAIS_CONSEILLER.includes(A.PHRASE_RETOUR_ASSISTANT) && A.texteDemandeEnregistree("KOFFI").includes(A.PHRASE_RETOUR_ASSISTANT)
    && I.garderReponse(A.TEXTE_RELAIS_CONSEILLER, { prixConnus: [] }).ok && !I.METIER_NIE.test(A.TEXTE_RELAIS_CONSEILLER));
  test("★ en mode menu, « assistant » rouvre l'accueil",
    A.reponseAssistant({ etape: A.ETAPE_MENU, texte: "assistant" }).texte === A.TEXTE_ACCUEIL);
  test("★ passer_conseiller dit à l'IA d'annoncer le retour possible",
    /« assistant »/.test(I.executerOutil("passer_conseiller", { motif: "x", type: "conseiller" }).resultat));

  // ── La tension se cherche
  const batt = [
    { nom: "Batterie lithium 51,2V 100AH", categorie: "Batteries", boutique: "DEMAKPOE", prix: 500000, disponible: true, tension: "" },
    { nom: "Batterie Gel 12V 200AH", categorie: "Batteries", boutique: "DEMAKPOE", prix: 165000, disponible: true, tension: "12" },
    { nom: "Batterie lithium 24V 300AH", categorie: "Batteries", boutique: "DEMAKPOE", prix: 550000, disponible: true, tension: "" },
    { nom: "Batterie Felicity", categorie: "Batteries", boutique: "DEMAKPOE", prix: 400000, disponible: true, tension: "48" },
  ];
  const noms = (q) => A.chercherArticles(batt, q).map((a) => a.nom).sort().join("|");
  test("★★ « batterie 48V » trouve la lithium 51,2 V ET la batterie dont la fiche dit 48 V — et rien d'autre",
    noms("batterie 48V") === "Batterie Felicity|Batterie lithium 51,2V 100AH");
  test("★★ « batterie 48 v » (espace) vaut « 48v »", noms("batterie 48 v") === noms("batterie 48V"));
  test("★ « batterie 51,2V » se trouve toujours tel quel ; « batterie 24V » ne ramène pas la 51,2 V",
    noms("batterie 51,2V") === "Batterie lithium 51,2V 100AH" && !/51,2/.test(noms("batterie 24V")));

  // ── Les panneaux d'une pompe
  const stock = [
    { nom: "3PWSS 1,5-95-48-400", categorie: "Pompe", boutique: "DEMAKPOE", prix: 90000, disponible: true, puissance_kw: 0.4, profondeur_max_m: 95 },
    { nom: "3PWSS 2.0-130-96-750W", categorie: "Pompe", boutique: "DEMAKPOE", prix: 110000, disponible: true, puissance_kw: 0.75, profondeur_max_m: 130 },
    { nom: "Pompe sans puissance", categorie: "Pompe", boutique: "DEMAKPOE", prix: 50000, disponible: true, profondeur_max_m: 70 },
    { nom: "Panneau 400W", categorie: "Panneaux solaires", boutique: "DEMAKPOE", prix: 85000, disponible: true },
    { nom: "Panneau 550W", categorie: "Panneaux solaires", boutique: "DEMAKPOE", prix: 110000, disponible: true },
    { nom: "Panneau 550W", categorie: "Panneaux solaires", boutique: "APESSITO", prix: 115000, disponible: false },
    { nom: "Support panneau 600W", categorie: "Panneaux solaires", boutique: "DEMAKPOE", prix: 5000, disponible: true },
  ];
  const p4 = I.panneauxPourPompe(stock, "3PWSS 1,5-95-48-400");
  const p7 = I.panneauxPourPompe(stock, "3pwss 2.0-130-96-750w");
  test("★★ la marge est 1,3 et le panneau le PLUS PUISSANT du stock (jamais un support) : 0,4 kW → 520 W → 1 × Panneau 550W",
    I.MARGE_PANNEAUX_POMPE === 1.3 && p4.ok && p4.puissanceVisee === 520 && p4.nombre === 1 && p4.panneau === "Panneau 550W");
  test("★★ 0,75 kW → 975 W → 2 panneaux (arrondi au panneau SUPÉRIEUR)", p7.ok && p7.puissanceVisee === 975 && p7.nombre === 2);
  test("★★ le prix vient du stock, boutique par boutique (jamais un mélange), « sur commande » dit",
    p7.parBoutique.map((b) => `${b.boutique}:${b.total}`).join("|") === "APESSITO:230000|DEMAKPOE:220000" && /sur commande/.test(p7.texte));
  test("★★ le juge accepte sa phrase, avec ses montants seulement",
    I.garderReponse(p7.texte, { prixConnus: p7.montants }).ok && !I.garderReponse(p7.texte, { prixConnus: [] }).ok);
  test("★★ une pompe sans puissance sur sa fiche : refus, AUCUN prix permis",
    (() => { const r = I.executerOutil("panneaux_pour_pompe", { pompe: "Pompe sans puissance" }, { articles: stock }); return /puissance/.test(r.resultat) && r.effets.prix.length === 0; })());
  test("★★ choisir_pompe donne pour chaque pompe proposée les panneaux estimés",
    (() => { const r = JSON.parse(I.executerOutil("choisir_pompe", { niveau_dynamique_m: 60, litres_par_jour: 3000 }, { articles: stock }).resultat);
      return r.pompes_qui_montent_assez_haut.find((a) => a.nom.startsWith("3PWSS 1,5"))?.panneaux_solaires_estimes === "1 × Panneau 550W (520 W visés)"; })());
  test("★ la phrase dit que c'est une estimation et que le câblage peut demander un ajustement",
    /Estimation indicative/.test(p4.texte) && /câblage/.test(p4.texte));

  // ── La réponse jetée se réécrit une fois
  const faux = (reponses) => { const appels = []; return { appels, appeler: async (corps) => { appels.push(corps); const t = reponses[Math.min(appels.length - 1, reponses.length - 1)]; return { stop_reason: "end_turn", content: [{ type: "text", text: t }] }; } }; };
  const msgs = [{ role: "user", content: "combien de panneaux pour la pompe ?" }];
  const f1 = faux(["Il vous faut 2 panneaux, environ 170 000 F.", "Il vous faut environ 2 panneaux ; je peux vous donner leur prix exact."]);
  const c1 = await I.converserAvecJuge({ consigne: "x", messages: msgs, appeler: f1.appeler, executer: () => ({ resultat: "", effets: {} }) });
  test("★★ une réponse jetée (montant inventé) est RÉÉCRITE une fois, et la seconde part",
    c1.reecrit === true && c1.juge.ok === true && f1.appels.length === 2 && /prix exact/.test(c1.texte));
  test("★★ l'IA apprend POURQUOI : la note de réécriture arrive comme dernier message, après sa réponse refusée",
    (() => { const m = f1.appels[1].messages; return m[m.length - 2].role === "assistant" && /170 000/.test(m[m.length - 2].content) && /Contrôle de BMI TOGO/.test(m[m.length - 1].content) && /montant non donné/.test(m[m.length - 1].content); })());
  const f2 = faux(["Votre solde est de…", "x"]);
  const c2 = await I.converserAvecJuge({ consigne: "x", messages: msgs, appeler: f2.appeler, executer: () => ({ resultat: "", effets: {} }) });
  test("★★ jamais de seconde chance sur un SUJET RÉSERVÉ (la phrase fixe s'en charge)", c2.reecrit === false && f2.appels.length === 1 && c2.juge.reserve === true);
  test("★★ jamais de réécriture quand un outil a déjà AGI (demande enregistrée, main passée)",
    I.peutReecrire({ ok: false }, { conseiller: true }) === false && I.peutReecrire({ ok: false }, { demandeDevis: { nom: "x" } }) === false && I.peutReecrire({ ok: false }, {}) === true);
  const f3 = faux(["Comptez 999 000 F.", "Toujours 888 000 F."]);
  const c3 = await I.converserAvecJuge({ consigne: "x", messages: msgs, appeler: f3.appeler, executer: () => ({ resultat: "", effets: {} }) });
  test("★ une seule réécriture : deux échecs → la seconde réponse reste jetée (pas de troisième appel)",
    f3.appels.length === 2 && c3.juge.ok === false);

  // ── Le menu ne coupe plus une conversation de l'IA
  test("★★ conversationIAEnCours : vrai après une ligne de l'IA, faux après le menu, après un relais, ou sans rien",
    A.conversationIAEnCours([ent("a", 5), robot(I.ETAPE_IA, 4), ent("b", 1)]) === true
    && A.conversationIAEnCours([ent("a", 5), robot(A.ETAPE_MENU, 4, false), ent("b", 1)]) === false
    && A.conversationIAEnCours([ent("a", 5), robot(A.ETAPE_CONSEILLER, 4), ent("b", 1)]) === false
    && A.conversationIAEnCours([ent("a", 1)]) === false);
  const srv = lire("api/whatsapp-entrant.js");
  test("★★ le serveur : au milieu d'une conversation de l'IA, une phrase neutre (REPONSE_REPRISE_IA) AVANT que le menu puisse reprendre",
    /if \(!r && conversationIAEnCours\(fil\)\) \{\s*r = \{ texte: REPONSE_REPRISE_IA, etape: ETAPE_IA/.test(srv)
    && srv.indexOf("conversationIAEnCours(fil)") < srv.indexOf("r = reponseAssistant({"));
  test("★ la phrase neutre passe le juge et ne parle pas de menu", I.garderReponse(I.REPONSE_REPRISE_IA, { prixConnus: [] }).ok && !/menu|tapez/i.test(I.REPONSE_REPRISE_IA));

  // ── La consigne
  const C = I.CONSIGNE_IA;
  test("★★ il RESTE dans la conversation : pas de conseiller ni de devis à chaque message",
    /Tu ne proposes PAS un conseiller ni une demande de devis à chaque message/.test(C) && /propose-la UNE fois/.test(C));
  test("★★ il PROPOSE lui-même un exemple quand le client le demande, annoncé comme exemple, et l'estime",
    /TU PROPOSES TOI-MÊME/.test(C) && /un EXEMPLE chiffré en appareils/.test(C) && /estimer_solaire\) sur cet exemple/.test(C));
  test("★★ il parle de BMI avec conviction, sur des faits, sans dénigrer ni inventer de chiffre",
    /TU EN PARLES AVEC CONVICTION/.test(C) && /Tu ne dénigres jamais une autre entreprise/.test(C) && /tu n'inventes aucun chiffre/.test(C));
  test("★★ les calculs techniques sont permis (énergie d'une batterie…), les francs restent aux outils ; 51,2 V = 48 V",
    /LES CALCULS TECHNIQUES qui ne sont pas de l'argent/.test(C) && /Seuls les MONTANTS EN FRANCS viennent des outils/.test(C) && /51,2 V est une batterie « 48 V »/.test(C));
  test("★ la mémoire passe à 40 messages", I.MAX_MESSAGES_MEMOIRE === 40);
}

// ──────────────────────────────────────────────────────────────
titre("㊺ 📎 ENVOYER UN FICHIER AU CLIENT, DU NUMÉRO BMI (03/10/2026, « tous les documents », « la phrase facultative »)");
{
  const W = await import("../src/lib/whatsappConversations.js");
  const Y = await import("../api/_ycloud.js");
  const Mo = 1024 * 1024;
  // ── La règle
  test("★★ le type suit WhatsApp : JPEG/PNG = photo, MP4 = vidéo, son = son ; tout le reste (PDF, Word, HEIC…) = document",
    W.typeEnvoiFichier("image/jpeg") === "image" && W.typeEnvoiFichier("image/png") === "image"
    && W.typeEnvoiFichier("video/mp4") === "video" && W.typeEnvoiFichier("audio/mpeg") === "audio"
    && W.typeEnvoiFichier("application/pdf") === "document" && W.typeEnvoiFichier("image/heic") === "document");
  test("★★ « tous les documents » : PDF, Word, Excel, PowerPoint, texte passent ; un .exe est refusé en le disant",
    ["devis.pdf", "lettre.docx", "stock.xlsx", "offre.pptx", "note.txt"].every((n) => W.critiqueFichier({ nom: n, mime: "application/octet-stream", taille: 1000 }) === "")
    && /n'est pas un type que WhatsApp accepte/.test(W.critiqueFichier({ nom: "virus.exe", mime: "application/x-msdownload", taille: 1000 })));
  test("★★ au plus 3 Mo : 3 Mo passe, un octet de plus est refusé, et le refus dit la taille et la sortie",
    W.TAILLE_MAX_ENVOI === 3 * Mo && W.critiqueFichier({ nom: "a.pdf", mime: "application/pdf", taille: 3 * Mo }) === ""
    && /pèse 3,0 Mo : au plus 3,0 Mo/.test(W.critiqueFichier({ nom: "a.pdf", mime: "application/pdf", taille: 3 * Mo + 50000 })));
  test("★ un fichier vide ou sans nom est refusé", !!W.critiqueFichier({ nom: "", taille: 10 }) && !!W.critiqueFichier({ nom: "a.pdf", taille: 0 }));
  test("★★ la phrase est FACULTATIVE : un fichier part sans un mot ; sans fichier, une réponse vide reste refusée",
    (() => {
      const conv = { cle: "90112233", proprietaire_id: null, fenetre: { ouverte: true } };
      const p = { id: "TIMO", role: "admin" };
      return W.critiqueReponse({ profile: p, conv, texte: "", fichier: { nom: "a.pdf", mime: "application/pdf", taille: 10 } }) === ""
        && /Écrivez d'abord/.test(W.critiqueReponse({ profile: p, conv, texte: "" }));
    })());
  test("★★ un fichier suit les règles d'une réponse : fenêtre fermée → refusé ; formation → refusé ; conversation confiée → refusé",
    (() => {
      const f = { nom: "a.pdf", mime: "application/pdf", taille: 10 };
      const p = { id: "KOSSI", role: "vendeur" };
      return /24 h|fenêtre|fermée/i.test(W.critiqueReponse({ profile: { id: "TIMO", role: "admin" }, conv: { cle: "x", fenetre: { ouverte: false, depuis: null } }, fichier: f }))
        && W.critiqueReponse({ profile: p, conv: { cle: "x", fenetre: { ouverte: true } }, fichier: f, espaceFormation: true }) === W.MOTIF_WA_FORMATION
        && W.critiqueReponse({ profile: p, conv: { cle: "x", proprietaire_id: "COM1", proprietaire_nom: "COM1", fenetre: { ouverte: true } }, fichier: f }) !== "";
    })());
  test("★ un son part sans phrase (WhatsApp n'en porte pas) : on le DIT au lieu de la perdre ; une phrase trop longue est refusée",
    /Un son part sans phrase/.test(W.critiqueFichier({ nom: "v.mp3", mime: "audio/mpeg", taille: 10 }, "écoutez")) && W.critiqueFichier({ nom: "v.mp3", mime: "audio/mpeg", taille: 10 }, "") === ""
    && /au plus 1024 caractères/.test(W.critiqueFichier({ nom: "a.pdf", mime: "application/pdf", taille: 10 }, "x".repeat(1100))));
  const me = W.mediaEnvoye({ nom: "devis.pdf", mime: "application/pdf", taille: 245000, donnees: "SECRETBASE64" });
  test("★★ la ligne du fil garde le NOM, le type, la taille — JAMAIS le fichier (décision du 20/09 : rien rangé dans la base)",
    me.nom === "devis.pdf" && me.type === "document" && me.taille === 245000 && me.envoye === true && !JSON.stringify(me).includes("SECRETBASE64") && !("lien" in me));
  // ── La porte YCloud
  test("★★ le message cite le fichier déposé : document avec son nom et sa phrase, photo avec sa phrase, son SANS phrase",
    JSON.stringify(Y.corpsMedia("+228A", "+228B", { type: "document", id: "M1", legende: "Voici", nom: "d.pdf" })) === JSON.stringify({ from: "+228A", to: "+228B", type: "document", document: { id: "M1", caption: "Voici", filename: "d.pdf" } })
    && JSON.stringify(Y.corpsMedia("a", "b", { type: "image", id: "M2", legende: "x", nom: "p.jpg" }).image) === JSON.stringify({ id: "M2", caption: "x" })
    && JSON.stringify(Y.corpsMedia("a", "b", { type: "audio", id: "M3", legende: "x" }).audio) === JSON.stringify({ id: "M3" })
    && !("caption" in Y.corpsMedia("a", "b", { type: "image", id: "M4", legende: "" }).image));
  {
    const vrai = globalThis.fetch; const vus = [];
    globalThis.fetch = async (url, opts) => { vus.push({ url, opts }); return { ok: true, status: 200, json: async () => ({ id: "MEDIA9" }) }; };
    const ok1 = await Y.televerserYCloud("CLE", "+22899968488", { octets: Buffer.from("abc"), mime: "application/pdf", nom: "d.pdf" });
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: "bad file", code: 131053 } }) });
    const savedErr = console.error; console.error = () => {};
    const ko1 = await Y.televerserYCloud("CLE", "+22899968488", { octets: Buffer.from("abc"), mime: "application/pdf", nom: "d.pdf" });
    console.error = savedErr; globalThis.fetch = vrai;
    test("★★ le dépôt : la clé dans l'en-tête, le fichier dans un formulaire (« file »), l'adresse du numéro BMI ; il rend le numéro du fichier",
      ok1.ok === true && ok1.id === "MEDIA9" && vus[0].url === "https://api.ycloud.com/v2/whatsapp/media/%2B22899968488/upload"
      && vus[0].opts.headers["X-API-Key"] === "CLE" && vus[0].opts.body instanceof FormData && vus[0].opts.body.get("file") !== null);
    test("★★ un dépôt refusé est RENDU tel quel avec son code (traduit en français par l'application), jamais avalé",
      ko1.ok === false && ko1.motif === "bad file" && ko1.code_whatsapp === 131053 && ko1.statut_whatsapp === 400);
  }
  // ── Le serveur
  const api = lire("api/whatsapp.js");
  test("★★ le serveur REMESURE le fichier sur les octets reçus et revérifie la règle (la taille annoncée ne se croit pas)",
    /const octets = Buffer\.from\(String\(fichier\.donnees \|\| ""\), "base64"\)/.test(api) && /taille: octets\.length/.test(api) && /critiqueFichier\(piece, enteteDocument \? "" : texte\)/.test(api)); // RETOURNÉ le 17/10/2026 : le PDF d'un modèle ne porte pas de phrase
  test("★★ le serveur DÉPOSE avant d'envoyer, et un dépôt refusé arrête tout (rien ne part)",
    api.indexOf("televerserYCloud(cle, expediteur, piece)") > -1 && api.indexOf("televerserYCloud(cle, expediteur, piece)") < api.indexOf("envoyerYCloud(cle, corps)")
    && /if \(!depot\.ok\) return res\.status\(502\)/.test(api));
  test("★★ un fichier passe par la MÊME fenêtre de 24 h recalculée sur la base que la réponse écrite",
    /const reponseLibre = !modele && \(typeof texte === "string" \|\| !!piece\)/.test(api) && /if \(reponseLibre\) \{\s*const cleFil/.test(api));
  test("★ rien n'est rangé : le serveur n'écrit pas le fichier dans la base (aucun insert ni stockage)",
    !/\.insert\(|storage\.|\.upload\(/.test(api));
  // ── L'écran
  const ecr = lire("src/screens/Whatsapp.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  test("★★ l'écran vérifie au CHOIX du fichier (critiqueFichier), puis revérifie DANS le geste (critiqueReponse avec le fichier)",
    /const refus = critiqueFichier\(pret\)/.test(ecr) && /critiqueReponse\(\{ profile, conv: ouverte, texte: t, fichier: piece,/.test(ecr) && /const piece = vocal \|\| fichier;/.test(ecr));
  // RETOURNÉ le 21/10/2026 : mediaEnvoye reçoit aussi le chemin de la note rangée.
  test("★★ la ligne du fil ne s'écrit qu'APRÈS le départ, et ne porte que mediaEnvoye (jamais les données)",
    ecr.indexOf("if (!r.parti)") > -1 && ecr.indexOf("if (!r.parti)") < ecr.indexOf("wa_media: mediaEnvoye(piece, r.stocke)") && !/donnees:\s*(fichier|piece)/.test(ecr.slice(ecr.indexOf("const envoyer = async"), ecr.indexOf("const envoyerContact"))));
  test("★ changer de conversation retire le fichier choisi (on n'envoie pas à l'un le devis préparé pour l'autre)",
    /useEffect\(\(\) => \{ setFichier\(null\); \}, \[cleOuverte\]\)/.test(ecr));
  const r1 = monte(V.renduFichierEnvoye), r2 = monte(V.htmlFichierEnvoye);
  test("★★ l'écran RENDU : le bouton 📎 est là, la ligne dit « 📎 devis-ESSO.pdf · 239 Ko — envoyé » avec sa phrase",
    r1.includes('data-joindre') && r1.includes("data-media-envoye") && r1.includes("devis-ESSO.pdf") && r1.includes("239 Ko") && r1.includes("Voici votre devis"));
  test("★★ un fichier envoyé ne va RIEN chercher chez WhatsApp (pas de bouton « ouvrir ») — sa copie est sur le téléphone BMI",
    r2.includes("data-media-envoye") && r2.includes("photo.jpg") && !/ouvrir/.test(r2));
  const ia = await import("../src/lib/assistantIA.js");
  const mem = ia.messagesPourIA([{ wa_entrant: true, texte: "le devis ?" }, { texte: "", wa_media: { type: "document", nom: "devis.pdf", envoye: true } }, { wa_entrant: true, texte: "merci" }]);
  test("★ l'assistant sait qu'un fichier envoyé l'a été PAR BMI, jamais « par le client »",
    mem.some((x) => /envoyé au client par BMI/.test(x.content)) && !mem.some((x) => /devis\.pdf.*envoyé par le client/.test(x.content)));
}


titre("㊻ 🎂 LES VŒUX D'ANNIVERSAIRE : LE RAPPEL DE LA VEILLE À 17 H, LES VŒUX DU NUMÉRO BMI LE JOUR MÊME (03/10/2026, « 1b »)");
{
  const A = await import("../src/lib/anniversaires.js");
  const M4 = await import("../src/lib/whatsappModeles.js");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★★ un jour qui n'existe pas dans le mois se fête le DERNIER jour (29/02 une année ordinaire, 31/04 saisi)",
    A.estFeteLe("02-29", "2027-02-28") && !A.estFeteLe("02-29", "2027-02-27") && A.estFeteLe("02-29", "2028-02-29") && !A.estFeteLe("02-29", "2028-02-28")
    && A.estFeteLe("04-31", "2026-04-30") && A.estFeteLe("10-03", "2026-10-03") && !A.estFeteLe("10-03", "2026-11-03") && !A.estFeteLe("", "2026-10-03"));
  test("le lendemain passe le mois et l'année", A.lendemain("2026-12-31") === "2027-01-01" && A.lendemain("2026-02-28") === "2026-03-01");
  const db = {
    boutiques: [{ nom: "BMI DEMAKPOE" }, { nom: "AFORMATION", formation: true }],
    users: [
      { id: "p", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "a2", nom: "ADJOINT", role: "admin" },
      { id: "e1", nom: "KOSSI", nom_complet: "KOSSI Mensah", role: "vendeur", boutique: "BMI DEMAKPOE", anniv: "10-04", tel: "90112233" },
      { id: "e2", nom: "AMA", role: "gerant", boutique: "BMI DEMAKPOE", anniv: "10-04" },
      { id: "f1", nom: "FORMA", role: "vendeur", boutique: "AFORMATION", anniv: "10-04", tel: "90445566" },
      { id: "c1", nom: "CLIENT", role: "client", anniv: "10-04", tel: "90778899" },
      { id: "b1", nom: "PARTI", role: "vendeur", boutique: "BMI DEMAKPOE", anniv: "10-04", tel: "90000001", actif: false },
    ],
    messages: [],
  };
  const r = A.rappelVeilleAnniversaires(db, "2026-10-03");
  test("★★ la VEILLE : le rappel va à l'administrateur PRINCIPAL seul, et nomme les fêtés de demain",
    r && r.destinataires.join(",") === "p" && /Demain, c'est l'anniversaire de : KOSSI Mensah, BMI DEMAKPOE ; AMA, BMI DEMAKPOE — pas de numéro/.test(r.texte) && r.tag === "anniv:2026-10-04");
  test("★★ LE MUR : jamais un compte de formation, un client ou un compte inactif — ni dans le rappel, ni dans les vœux",
    !/FORMA|CLIENT|PARTI/.test(r.texte) && A.anniversairesDuJour(db, "2026-10-04").map((x) => x.employe.id).join(",") === "e1");
  test("pas de rappel quand personne n'est fêté demain", A.rappelVeilleAnniversaires(db, "2026-10-05") === null);
  const j = A.anniversairesDuJour(db, "2026-10-04")[0];
  test("★ le modèle : un trou, le nom complet de l'employé ; le texte gardé par Timo",
    j.envoi.modele === "anniversaire_employe" && j.envoi.variables.join("|") === "KOSSI Mensah"
    && /Joyeux anniversaire/.test(M4.TEXTE_ANNIVERSAIRE) && /\{\{1\}\}/.test(M4.TEXTE_ANNIVERSAIRE) && !/\{\{2\}\}/.test(M4.TEXTE_ANNIVERSAIRE));
  const ligne = A.ligneAnniversaire({ id: "x", tel: j.tel, employe: j.employe, variables: j.envoi.variables, ts: "2026-10-04T07:00:00Z" });
  const db2 = { ...db, messages: [ligne] };
  test("★★ UNE fois par an : la ligne du fil (modèle + employé + année) empêche une seconde fois, l'année suivante rouvre",
    A.anniversairesDuJour(db2, "2026-10-04").length === 0 && A.anniversairesDuJour(db2, "2027-10-04").length === 1);
  test("★ la ligne du fil ne donne la conversation à personne", ligne && !ligne.proprietaire_id && ligne.de_id === "anniversaire-bmi");
  const RM = sansComm(lire("api/rappels-du-matin.js"));
  const corps = RM.slice(RM.indexOf("async function souhaiterLesAnniversaires"));
  test("★★ serveur 7 h : rien n'est écrit tant que WhatsApp n'a pas accepté",
    /anniversairesDuJour\(db, aujourdhui\)/.test(corps) && corps.indexOf("envoyerYCloud(") > 0
    && corps.indexOf("if (!envoi.ok)") > corps.indexOf("envoyerYCloud(") && corps.indexOf('from("messages").insert') > corps.indexOf("if (!envoi.ok)"));
  const RS = sansComm(lire("api/rappels-du-soir.js"));
  test("★★ serveur 17 h : la règle pure (rappelVeilleAnniversaires), le secret CRON_SECRET, une notification — et rien d'écrit",
    /rappelVeilleAnniversaires\(db, aujourdhui\)/.test(RS) && /process\.env\.CRON_SECRET/.test(RS) && /envoyerAuxPersonnes\(admin, \[envoi\]\)/.test(RS) && !/\.(insert|upsert|update)\(/.test(RS));
  // « 1c » : le rappel de la veille part AUSSI par WhatsApp, sur le numéro de l'administrateur.
  const w1 = A.rappelWhatsAppVeille({ ...db, users: db.users.map((u) => (u.id === "p" ? { ...u, tel: "91130511" } : u)) }, "2026-10-03");
  const w2 = A.rappelWhatsAppVeille({ ...db, boutiques: [...db.boutiques, { nom: "X", alerte_conseiller: { conseillers: [{ tel: "92000000", nom: "KOSSI" }] } }] }, "2026-10-03");
  const w3 = A.rappelWhatsAppVeille({ ...db, users: db.users.map((u) => (u.id === "p" ? { ...u, tel: "91130511" } : u)), boutiques: [...db.boutiques, { nom: "X", alerte_conseiller: { tel: "92000000", nom: "KOSSI" } }] }, "2026-10-03");
  const w4 = A.rappelWhatsAppVeille({ ...db, users: db.users.map((u) => (u.id === "p" ? { ...u, tel: "99968488" } : u)) }, "2026-10-03");
  // RETOURNÉ le 07/10/2026 (« B oui ») : le numéro de SA FICHE seul, jamais la liste des conseillers.
  test("★★ « 1c » : la veille, le WhatsApp à l'administrateur principal, au numéro de SA FICHE seul — jamais un conseiller de l'alerte, jamais le numéro BMI ; les fêtés de demain dans {{2}}",
    w1 && /91130511$/.test(w1.tel) && w1.envoi.modele === "rappel_anniversaire" && w1.envoi.variables[0] === "TIMO" && /KOSSI Mensah, BMI DEMAKPOE ; AMA/.test(w1.envoi.variables[1])
    && w2 === null && w3 && /91130511$/.test(w3.tel) && w3.envoi.variables[0] === "TIMO" && w4 === null
    && A.rappelWhatsAppVeille(db, "2026-10-05") === null
    && !/alerteConseillerDe|conseillersAlerte/.test(lire("src/lib/anniversaires.js"))
    && /\{\{1\}\}[\s\S]*\{\{2\}\}/.test(M4.TEXTE_RAPPEL_ANNIVERSAIRE));
  test("★ serveur 17 h : le WhatsApp part par LA porte YCloud, avant la notification et sans dépendre d'elle, et n'écrit rien",
    /rappelWhatsAppVeille\(db, aujourdhui\)/.test(RS) && /from "\.\/_ycloud\.js"/.test(RS)
    && RS.indexOf("await rappelerParWhatsApp(db, aujourdhui)") > 0 && RS.indexOf("await rappelerParWhatsApp(db, aujourdhui)") < RS.indexOf("if (!configurerWebPush())"));
  test("★ une seule façon de lire une table côté serveur (api/_tables.js), pour les deux tournées",
    /from "\.\/_tables\.js"/.test(RM) && /from "\.\/_tables\.js"/.test(RS) && !/async function lireTable/.test(RM + RS));
}


titre("㊼ 📈 L'AVIS D'AVANCEMENT D'UN EMPLOYÉ (03/10/2026, « 3 avec montants », « on garde le texte que tu as proposé »)");
{
  const M5 = await import("../src/lib/whatsappModeles.js");
  const f = (x) => `${Number(x).toLocaleString("fr-FR").replace(/\s/g, " ")} F`;
  const e = M5.envoiAvancement({ employe: "ANGELE KOFFI", tel: "90111111", ancien: 60000, nouveau: 66000, mois: "octobre 2026", motif: "ancienneté.", fmt: f });
  test("★★ les cinq trous dans l'ordre (nom, ancien, nouveau, mois, motif) — le point final du motif retiré (le texte en met un)",
    e && e.modele === "avancement_employe" && e.variables[0] === "ANGELE KOFFI" && /^60.000 F$/.test(e.variables[1]) && /^66.000 F$/.test(e.variables[2]) && e.variables[3] === "octobre 2026" && e.variables[4] === "ancienneté"
    && /passe de \{\{2\}\} à \{\{3\}\} à compter du mois de \{\{4\}\}\.\nMotif : \{\{5\}\}\./.test(M5.TEXTE_AVANCEMENT));
  test("★★ seulement une HAUSSE d'un salaire connu, avec un numéro : une baisse, une égalité, une première saisie ou une fiche sans numéro n'envoient rien ; un motif vide prend « décision de la Direction »",
    M5.envoiAvancement({ employe: "A", tel: "90111111", ancien: 60000, nouveau: 50000, mois: "x", fmt: f }) === null
    && M5.envoiAvancement({ employe: "A", tel: "90111111", ancien: 60000, nouveau: 60000, mois: "x", fmt: f }) === null
    && M5.envoiAvancement({ employe: "A", tel: "90111111", ancien: 0, nouveau: 60000, mois: "x", fmt: f }) === null
    && M5.envoiAvancement({ employe: "A", tel: "", ancien: 50000, nouveau: 60000, mois: "x", fmt: f }) === null
    && M5.envoiAvancement({ employe: "A", tel: "90111111", ancien: 50000, nouveau: 60000, mois: "x", motif: "", fmt: f })?.variables[4] === "décision de la Direction");
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const U = sansC(lire("src/screens/Utilisateurs.jsx"));
  const corps = U.slice(U.indexOf("const changerSalaire"), U.indexOf("const ajouterMouvementSalaire"));
  test("★★ 👥 l'envoi part APRÈS l'enregistrement, après une QUESTION, sans repli, le mur = l'espace du COMPTE de l'employé, la ligne liée à l'évolution",
    corps.indexOf("save({ ...db, users:") > 0 && corps.indexOf("save({ ...db, users:") < corps.indexOf("await uConfirm(`Envoyer l'avis d'avancement")
    && corps.indexOf("await uConfirm(`Envoyer l'avis d'avancement") < corps.indexOf("envoyerRecuSansQuestion(")
    && /espaceFormation: estCompteFormation\(db, u\)/.test(corps) && /ref: \{ salaire_user_id: u\.id, evolution_id: evolution\.id \}/.test(corps)
    && /if \(!\(ancien > 0 && montant > ancien\)\) return;/.test(corps));
  test("★ la ligne rangée est PRIVÉE et son détail se recompose depuis l'évolution de salaire (même fabrique que l'envoi)",
    M5.lignePrivee("avancement_employe") && /m\.wa_modele === "avancement_employe"[\s\S]{0,300}envoiAvancement\(/.test(lire("src/lib/lignesPrivees.js"))
    && /ref\.evolution_id \? \{ evolution_id: ref\.evolution_id \}/.test(lire("src/whatsapp.js")));
}

titre("㊽ 🗑 SUPPRIMER UNE CONVERSATION PAR UN APPUI LONG — LE PRINCIPAL SEUL, À LA CORBEILLE (05/10/2026, « 1 corbeille, 2 oui »)");
{
  const Corb = await import("../src/lib/corbeille.js");
  const C2 = await import("../src/lib/whatsappConversations.js");
  const ts = (h) => `2026-10-05T${h}:00:00Z`;
  const base = {
    messages: [
      { id: "i1", de_id: "KOSSI", a_id: "TIMO", texte: "interne", ts: ts("08") },
      { id: "s1", canal: "support", de_id: "CLI1", texte: "support interne", ts: ts("08") },
      { id: "k1", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "KOFFI", wa_entrant: true, texte: "bonjour", ts: ts("09") },
      { id: "k2", canal: "whatsapp", wa_tel: "90112233", texte: "réponse", proprietaire_id: "COM1", proprietaire_nom: "COM1", ts: ts("10") },
      { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "KOFFI", proprietaire_id: "COM1", derniere: ts("10"), ts: ts("10") },
      { id: "a1", canal: "whatsapp", wa_tel: "90114455", wa_entrant: true, texte: "autre client", ts: ts("11") },
    ],
  };
  const timo = { id: "TIMO", nom: "TIMO", role: "admin" };
  const apres = Corb.mettreConversationALaCorbeille(base, "90112233", timo, ts("12"));
  test("★★ la conversation ENTIÈRE part (ses 2 messages ET sa fiche légère), rien d'autre : la messagerie interne, le support interne et l'autre conversation restent",
    apres.messages.map((m) => m.id).join(",") === "i1,s1,a1"
    && apres[Corb.CLE_CORBEILLE_WA].length === 3 && apres[Corb.CLE_CORBEILLE_WA].every((m) => m.supprime_le === ts("12") && m.supprime_par === "TIMO"));
  const contenu = Corb.contenuCorbeille(apres, ts("13"));
  test("★★ la corbeille montre UNE entrée par conversation, avec son nom, son numéro et son nombre de messages (la fiche légère ne compte pas)",
    contenu.length === 1 && contenu[0].table === "conversation_wa" && contenu[0].libelle === "Conversation WhatsApp"
    && /KOFFI/.test(Corb.nomDeLaFiche(contenu[0].table, contenu[0].fiche)) && /\(2 messages\)/.test(Corb.nomDeLaFiche(contenu[0].table, contenu[0].fiche)) && contenu[0].restants === 30);
  const fusion = Corb.fusionnerCorbeille(apres);
  const recharge = Corb.separerCorbeille(fusion);
  test("★★ à l'écriture les lignes retournent dans la table des messages, MARQUÉES ; au chargement elles repartent de côté (tous les appareils les cachent)",
    fusion.messages.length === 6 && fusion.messages.filter((m) => m.supprime_le).length === 3 && !(Corb.CLE_CORBEILLE_WA in fusion)
    && recharge.messages.map((m) => m.id).sort().join(",") === "a1,i1,s1" && recharge[Corb.CLE_CORBEILLE_WA].length === 3
    && Corb.CLES_CORBEILLE.includes(Corb.CLE_CORBEILLE_WA));
  test("★ une base sans rien à la corbeille garde son tableau de messages (les écrans comparent par identité)",
    Corb.separerCorbeille(base).messages === base.messages);
  const restaure = Corb.restaurerDeLaCorbeille(apres, "conversation_wa", "90112233");
  test("★★ ♻ restaurer la remet telle quelle, SANS la marque, sur tous les appareils",
    restaure.messages.length === 6 && !restaure.messages.some((m) => m.supprime_le || m.supprime_par) && restaure[Corb.CLE_CORBEILLE_WA].length === 0);
  // Le client a réécrit entre-temps : le serveur a reposé une fiche légère VIVANTE.
  const reecrit = { ...apres, messages: [...apres.messages, { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: "90112233", derniere: ts("14"), ts: ts("14") }] };
  const fusionVivante = Corb.fusionnerCorbeille(reecrit);
  test("★★ la fiche légère VIVANTE (le client a réécrit) l'emporte sur sa vieille copie marquée — la nouvelle conversation ne disparaît pas",
    fusionVivante.messages.filter((m) => m.id === "waent_90112233").length === 1 && !fusionVivante.messages.find((m) => m.id === "waent_90112233").supprime_le);
  test("★ « Supprimer définitivement » et la purge à 30 jours l'effacent pour de bon",
    Corb.supprimerDefinitivement(apres, "conversation_wa", "90112233")[Corb.CLE_CORBEILLE_WA].length === 0
    && Corb.aPurger(apres, "2026-11-04T12:00:00Z").length === 1 && Corb.aPurger(apres, "2026-11-03T11:00:00Z").length === 0
    && Corb.purgerCorbeille(apres, "2026-11-05T00:00:00Z")[Corb.CLE_CORBEILLE_WA].length === 0);
  // LE SERVEUR LIT LA TABLE BRUTE : une ligne marquée ne doit plus compter.
  const brut = Corb.fusionnerCorbeille(apres).messages;
  test("★★ le serveur (table brute) : la conversation supprimée n'a plus de fil, plus de propriétaire, plus de fenêtre — le client qui réécrit recommence au SUPPORT",
    C2.filDeLaConversation(brut, "90112233").length === 0 && C2.proprietaireDe(C2.filDeLaConversation(brut, "90112233")).id === ""
    && C2.fenetre(C2.filDeLaConversation(brut, "90112233"), ts("13")).jamais === true
    && !C2.conversationsWa(brut, timo, ts("13")).some((c) => c.cle === "90112233"));
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const api = ["api/whatsapp-entrant.js", "api/whatsapp-media.js", "api/whatsapp.js"].map((f) => sansC(lire(f)));
  test("★★ les trois fonctions serveur passent par filDeLaConversation (qui écarte la corbeille), aucune ne refait le filtre à la main",
    api.every((t) => /filDeLaConversation\(/.test(t) && !/m\.canal === CANAL_WA && m\.wa_tel ===/.test(t)) && /estALaCorbeille\(ligne\)/.test(api[1]));
  const W = sansC(lire("src/screens/Whatsapp.jsx"));
  const corps = W.slice(W.indexOf("const supprimerConversation"), W.indexOf("const supprimer = jeSuisPrincipal"));
  test("★★ 📲 le geste : l'administrateur PRINCIPAL revérifié EN PREMIER, la liste FRAÎCHE, une confirmation qui dit la corbeille, le téléphone BMI et le support, puis la corbeille",
    corps.indexOf("refuserSaufAdminPrincipal(db, profile") > 0 && corps.indexOf("refuserSaufAdminPrincipal(db, profile") < corps.indexOf("lignesDeLaConversation(db.messages")
    && corps.indexOf("await uConfirm(") < corps.indexOf("mettreConversationALaCorbeille(db, c.cle, profile)")
    && /corbeille pendant \$\{DUREE_CORBEILLE_JOURS\} jours/.test(corps) && /Le téléphone BMI et le client gardent leur copie/.test(corps) && /au support/.test(corps)
    && /const supprimer = jeSuisPrincipal \? supprimerConversation : null;/.test(W)
    // RETOURNÉ le 09/10/2026 : la liste n'a plus qu'UN rendu de ligne (les non lues sont dans la même liste).
    && (W.match(/supprimer=\{supprimer\}/g) || []).length === 1
    && /useAppuiLong\(\(\) => supprimer && supprimer\(c\), \{ actif: !!supprimer \}\)/.test(W));
  test("★★ l'écran RENDU : la ligne porte l'appui long chez l'administrateur principal, PAS chez un vendeur",
    /Appui long : supprimer cette conversation/.test(V.htmlAdmin()) && !/Appui long : supprimer/.test(V.htmlVendeur()));
  const S36 = lire("supabase/securite-36-corbeille-whatsapp.sql");
  test("★ LE COUPLE : securite-36 réserve l'effacement et la marque au principal, et wa_proprietaire ignore la corbeille (le banc SQL l'éprouve : npm run tester-conversations)",
    /Effacer une conversation WhatsApp/.test(S36) && /before insert or update or delete on public\.messages/.test(S36)
    && /coalesce\(m\.data ->> 'supprime_le', ''\) = ''/.test(S36) && /qual like '%formation%'/.test(S36));
}


titre("㊾ 👤 LE NOM D'UNE CONVERSATION — LE NOM DONNÉ, LE COMPTE BMI, LE NOM WHATSAPP, LE NUMÉRO (06/10/2026, « b »)");
{
  const C3 = await import("../src/lib/whatsappConversations.js");
  test("★★ le nom WhatsApp se lit dans les deux formes connues (YCloud customerProfile, Meta contacts[0].profile), nettoyé ; rien → \"\"",
    C3.lireNomProfil({ whatsappInboundMessage: { from: "+228", customerProfile: { name: "  Kossi\n M. " } } }) === "Kossi M."
    && C3.lireNomProfil({ contacts: [{ profile: { name: "Ama" } }] }) === "Ama"
    && C3.lireNomProfil({ whatsappInboundMessage: { from: "+228" } }) === "" && C3.lireNomProfil(null) === ""
    && C3.lireNomProfil({ whatsappInboundMessage: { customerProfile: { name: "x".repeat(200) } } }).length === C3.LONGUEUR_NOM_CONTACT);
  test("★★ l'ordre : le nom DONNÉ, puis le compte BMI, puis le nom WhatsApp, puis le numéro",
    C3.nomDeConversation({ nomDonne: "A", nomCompte: "B", profil: "C", tel: "9" }).origine === "donne"
    && C3.nomDeConversation({ nomCompte: "B", profil: "C", tel: "9" }).nom === "B"
    && C3.nomDeConversation({ profil: "C", tel: "9" }).origine === "whatsapp"
    && C3.nomDeConversation({ tel: "9" }).nom === "9" && C3.nomDeConversation({ tel: "9" }).origine === "");
  // ⚠⚠ LA FICHE GARDE SES NOMS quand on la réécrit (répondre, confier, la
  // tournée du matin, le message suivant du client) — sinon le nom donné
  // disparaîtrait en silence au premier mouvement.
  const avant = { id: "waent_1", canal: "whatsapp_entete", wa_tel: "1", wa_nom_donne: "PLOMBIER", wa_profil: "Boss" };
  const apres = C3.messagesAvecEntete([avant], { cle: "1", tel: "1", derniere: "2026-10-06T10:00:00Z" });
  test("★★ messagesAvecEntete GARDE le nom donné et le nom WhatsApp de la fiche d'avant",
    apres.length === 1 && apres[0].wa_nom_donne === "PLOMBIER" && apres[0].wa_profil === "Boss");
  test("★ nom_donne: \"\" RETIRE le nom donné ; un nouveau nom WhatsApp remplace l'ancien",
    !C3.messagesAvecEntete([avant], { cle: "1", nom_donne: "" })[0].wa_nom_donne
    && C3.construireEntete({ cle: "1", entete: avant, profil: "Nouveau" }).wa_profil === "Nouveau");
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const tournees = ["anniversaires", "poseSeule", "demandeAvis", "rappelEntretien", "relanceAutoDevis"].map((f) => sansC(lire(`src/lib/${f}.js`)));
  test("★★ les CINQ tournées du matin passent la fiche d'avant (entete) — le nom donné ne tombe pas à 7 h",
    tournees.every((t) => /construireEntete\(\{[\s\S]{0,300}derniere: ts, entete,/.test(t)));
  const EN = sansC(lire("api/whatsapp-entrant.js"));
  test("★★ le serveur : le nom WhatsApp est lu, rangé sur la ligne et la fiche ; la fiche d'avant est gardée (message ET réponse de l'assistant)",
    /const profil = lireNomProfil\(req\.body\)/.test(EN) && /wa_profil: profil/.test(EN)
    && /derniere: ligne\.ts, entete: ficheAvant, profil,/.test(EN) && /derniere: ts, entete \}\)/.test(EN)
    && /entete: fiche \|\| ficheAvant/.test(EN));
  test("★ les conversations portent nomAffiche et origineNom, la ligne grisée aussi (depuis la fiche)",
    (() => { const l = C3.conversationsWa(V.messagesAvecNoms, { id: "KOSSI", nom: "KOSSI", role: "vendeur" });
      const g = l.find((c) => c.cle === "90114455"); const w = l.find((c) => c.cle === "90117711");
      return g && g.verrouillee && g.nomAffiche === "AYOKO VILLA ADIDOGOME" && w && w.origineNom === "whatsapp" && w.nomAffiche === "Kossi M."; })());
  const hA = V.renduNoms("admin"), hV = V.renduNoms("vendeur");
  test("★★ l'écran RENDU : le nom WhatsApp s'affiche MARQUÉ « (nom WhatsApp) », le nom donné l'emporte et n'est pas marqué",
    /Kossi M\.<span data-nom-whatsapp[^>]*>\(nom WhatsApp\)/.test(hA) && /PLOMBIER AGOE/.test(hA) && !/😎 Boss/.test(hA));
  // RETOURNÉ le 09/10/2026 (« d2 ») : dans la LISTE, le numéro passe SOUS le
  // nom, en petit — il ne disparaît toujours jamais.
  test("★★ le NUMÉRO reste visible (Timo : « pas remplacer et faire disparaître le numéro ») — « d2 » : sous le nom, nom WhatsApp, nom donné et ligne grisée",
    /Kossi M\.<span data-nom-whatsapp[\s\S]{0,400}<span data-numero-conversation[^>]*>(?:<!-- -->)?\+22890117711/.test(hA)
    && /PLOMBIER AGOE[\s\S]{0,400}<span data-numero-conversation[^>]*>(?:<!-- -->)?\+22890117722/.test(hA)
    && /AYOKO VILLA ADIDOGOME[\s\S]{0,400}<span data-numero-conversation[^>]*>(?:<!-- -->)?\+22890114455/.test(hV));
  test("★★ la ligne GRISÉE du vendeur porte le cadenas et le nom donné par l'administrateur",
    /data-wa-verrou="1"[\s\S]{0,800}🔒[\s\S]{0,800}AYOKO VILLA ADIDOGOME/.test(hV));
  test("★★ « ✏️ Nommer » : chez l'administrateur seulement, sur le fil ouvert",
    // ⚠ RETOURNÉ le 09/10/2026 (« a1 ») : le bouton est dans le PROFIL du contact.
    /data-nommer/.test(V.renduNoms("admin", "90117711", true)) && !/data-nommer/.test(V.renduNoms("vendeur", "90117711", true)));
  const W2 = sansC(lire("src/screens/Whatsapp.jsx"));
  const corpsN = W2.slice(W2.indexOf("const nommer = async"), W2.indexOf("const jeSuisPrincipal"));
  test("★★ le geste : revérifié DANS le geste (critiqueNomContact), sur la liste FRAÎCHE, sans ligne ajoutée au fil (la conversation ne remonte pas), journal",
    corpsN.indexOf("critiqueNomContact(profile") > 0 && corpsN.indexOf("critiqueNomContact(profile") < corpsN.indexOf("save(")
    && /messagesAvecEntete\(frais,/.test(corpsN) && /nom_donne: nom/.test(corpsN) && !/nouveauMessage\(/.test(corpsN)
    && /derniere: fiche\?\.derniere \|\| ouverte\.derniere/.test(corpsN));
  test("★ la recherche trouve aussi le nom donné et le nom WhatsApp",
    /correspond\(`\$\{c\.nomAffiche \|\| ""\} \$\{c\.nom \|\| ""\} \$\{c\.profil \|\| ""\}/.test(W2));
  test("★ critiqueNomContact : l'administrateur seul",
    C3.critiqueNomContact({ role: "admin" }, "X") === "" && C3.critiqueNomContact({ role: "gerant" }, "X") !== "");

  // ---- 📇 LE NOM DES CONTACTS GOOGLE DE BMI (16/10/2026, « a et b, lance ») ----
  // Capture Timo : ADJI EYASSINAM affiché « Contrôle et Énergie (nom WhatsApp) ».
  test("★★ 📇 l'ordre : nom donné, compte BMI, puis le nom des CONTACTS GOOGLE de BMI, puis seulement le nom WhatsApp",
    C3.nomDeConversation({ nomGoogle: "ADJI", profil: "Contrôle", tel: "9" }).nom === "ADJI"
    && C3.nomDeConversation({ nomGoogle: "ADJI", profil: "Contrôle", tel: "9" }).origine === "google"
    && C3.nomDeConversation({ nomCompte: "B", nomGoogle: "ADJI", profil: "C" }).origine === "compte"
    && C3.nomDeConversation({ nomDonne: "A", nomGoogle: "ADJI" }).origine === "donne");
  const ficheG = { id: "waent_1", canal: "whatsapp_entete", wa_tel: "1", wa_google_cherche_le: "2026-10-16" };
  test("★★ la date de la dernière recherche chez Google est GARDÉE par toute réécriture de la fiche (sinon chaque message relancerait Google)",
    C3.messagesAvecEntete([ficheG], { cle: "1", tel: "1", derniere: "x" })[0].wa_google_cherche_le === "2026-10-16"
    && C3.construireEntete({ cle: "1", entete: ficheG, google_cherche_le: "2026-10-17" }).wa_google_cherche_le === "2026-10-17");
  const G5 = await import(pathToFileURL(join(process.cwd(), "src/lib/contactGoogle.js")).href);
  const j = "2026-10-16";
  test("★★ la recherche automatique : seulement sans nom de chez nous, une fois par jour au plus ; un nom trouvé tout seul se recherche, un contact enregistré depuis l'écran non",
    G5.rechercheGoogleAFaire({ entete: null, aujourdhui: j }) === true
    && G5.rechercheGoogleAFaire({ entete: { wa_profil: "X" }, aujourdhui: j }) === true
    && G5.rechercheGoogleAFaire({ entete: { wa_nom_donne: "A" }, aujourdhui: j }) === false
    && G5.rechercheGoogleAFaire({ entete: null, nomCompte: "KOSSI", aujourdhui: j }) === false
    && G5.rechercheGoogleAFaire({ entete: { wa_contact_google: { nom: "K", par: "TIMO" } }, aujourdhui: j }) === false
    && G5.rechercheGoogleAFaire({ entete: { wa_contact_google: { nom: "K", auto: true }, wa_google_cherche_le: "2026-10-15" }, aujourdhui: j }) === true
    && G5.rechercheGoogleAFaire({ entete: { wa_google_cherche_le: j }, aujourdhui: j }) === false
    && G5.rechercheGoogleAFaire({ entete: { wa_google_cherche_le: "2026-10-15" }, aujourdhui: j }) === true);
  test("★ la trace d'un nom trouvé tout seul : « recherche automatique », marquée auto",
    (() => { const t = G5.traceContactAuto({ nom: " ADJI  EYASSINAM ", le: "x" }); return t.nom === "ADJI EYASSINAM" && t.auto === true && t.deja === true && t.par === G5.PAR_RECHERCHE_AUTO; })());
  test("★★ le serveur : la recherche se fait APRÈS l'écriture du message, sous la règle, dans un try ; rien n'est marqué quand Google n'est pas réglé ; le résultat va sur la fiche",
    EN.indexOf("rechercheGoogleAFaire(") > EN.indexOf('from("messages").insert(')
    && EN.indexOf("await chercherNomGoogle(from)") > EN.indexOf("rechercheGoogleAFaire(")
    && EN.indexOf("await chercherNomGoogle(from)") < EN.indexOf("const fiche = construireEntete(")
    && /if \(!g\.code\) \{\s*chercheLe = /.test(EN)
    && /contact_google: contactGoogle, google_cherche_le: chercheLe,/.test(EN)
    && /try \{\s*const g = await chercherNomGoogle\(from\)/.test(EN));
  test("★ l'alerte et la notification nomment le client par LA règle de l'écran (nomDeConversation)",
    /client: nomDuClient\.origine \? nomVu : ""/.test(EN) && /Demande un conseiller — \$\{nomVu\}/.test(EN));
  const SG = sansC(lire("api/_contactGoogle.js"));
  test("★ la recherche automatique est bornée dans le temps (≈ 8 s) et ne marque rien quand Google refuse l'accès",
    /export async function chercherNomGoogle\(tel\)/.test(SG) && /setTimeout\(\(\) => arret\.abort\(\), 8000\)/.test(SG)
    && /if \(g\.code\) return \{ code: g\.code \}/.test(SG));
  const hG = V.renduNomGoogle(), hGP = V.renduNomGoogle({ profil: true }), hGM = V.renduNomGoogle({ auto: false, profil: true });
  test("★★ l'écran RENDU : ADJI EYASSINAM s'affiche, sans « (nom WhatsApp) », le nom WhatsApp n'est plus le titre",
    /ADJI EYASSINAM/.test(hG) && !/ADJI EYASSINAM<span data-nom-whatsapp/.test(hG) && !/Contrôle et Énergie<span data-nom-whatsapp/.test(hG), hG.slice(0, 300));
  test("★★ le profil dit d'où vient le nom : « nom des contacts Google de BMI », « Trouvé tout seul » ; enregistré depuis l'écran, « par TIMO »",
    /nom des contacts Google de BMI/.test(hGP) && /Trouvé tout seul/.test(hGP) && !/Trouvé tout seul/.test(hGM) && /par TIMO/.test(hGM) && /Contrôle et Énergie/.test(hGP));
}

// ⚠⚠ ㊿ TAPER DANS LA RECHERCHE NE DONNE PLUS UN ÉCRAN BLANC (capture Timo,
// 07/10/2026 : « dès qu'on veut chercher un numéro ou non, écran blanc »).
// Depuis 2.101.462, la recherche appelait `.join()` sur `motsDuNumero`, qui
// rend DÉJÀ un texte : l'écran levait à la première lettre. Le banc REND
// l'écran avec une recherche tapée — un nom, des chiffres, un mot absent.
console.log("\n㊿ La recherche de 📲 WhatsApp : l'écran se rend avec une recherche tapée");
{
  const essai = (t) => { try { return V.htmlRecherche(t); } catch (e) { return "ERREUR " + String(e.message || e).split("\n")[0]; } };
  const nom = essai("ESSO"), chiffres = essai("90112233"), avecPlus = essai("+22890112233"), absent = essai("ZZZZ");
  test("★ chercher un NOM rend l'écran (pas d'erreur) et trouve ESSO", !/^ERREUR/.test(nom) && /ESSO/.test(nom), nom.slice(0, 200));
  test("★ chercher des CHIFFRES rend l'écran et trouve la conversation (numéro tapé seul ou avec +228, comme dans 👥 Utilisateurs)", !/^ERREUR/.test(chiffres) && /ESSO/.test(chiffres) && !/^ERREUR/.test(avecPlus) && /ESSO/.test(avecPlus), chiffres.slice(0, 200));
  test("★ un mot absent rend l'écran et le dit (« Aucune conversation ne correspond »)", !/^ERREUR/.test(absent) && /Aucune conversation ne correspond/.test(absent), absent.slice(0, 200));
}

// 👤 51 · LE PROFIL D'UN CONTACT ET 📇 LES CONTACTS GOOGLE DE BMI (09/10/2026, « a1, b2 »)
console.log("\n51 · Le profil d'un contact (clic sur le nom) et l'enregistrement dans les contacts Google de BMI");
{
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const G = await import(pathToFileURL(join(process.cwd(), "src/lib/contactGoogle.js")).href);
  const CW = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappConversations.js")).href);
  test("★ le numéro part au format international : 8 chiffres → +228, « +228 90 11 22 33 », « 00228… » ; illisible → rien",
    G.numeroInternational("90112233") === "+22890112233" && G.numeroInternational("+228 90 11 22 33") === "+22890112233"
    && G.numeroInternational("0022890112233") === "+22890112233" && G.numeroInternational("123") === "");
  // ⚠ CONTRÔLE RETOURNÉ le 09/10/2026 (Timo : « ouvre l'enregistrement pour
  // tous les utilisateurs, vu qu'ils voient encore les numéros ») : il exigeait
  // l'administrateur SEUL. Désormais : tout le personnel qui a 📲 WhatsApp —
  // jamais un client, jamais le comptable, jamais un compte désactivé.
  test("★★ tout le personnel qui a 📲 WhatsApp (jamais un client, ni le comptable, ni un compte désactivé) ; un nom est exigé ; un numéro illisible est refusé",
    G.peutEnregistrerContact({ role: "admin" }) && G.peutEnregistrerContact({ role: "vendeur" }) && G.peutEnregistrerContact({ role: "gerant" })
    && G.peutEnregistrerContact({ role: "commercial" }) && G.peutEnregistrerContact({ role: "technicien" })
    && !G.peutEnregistrerContact({ role: "client" }) && !G.peutEnregistrerContact({ role: "comptable" })
    && !G.peutEnregistrerContact({ role: "vendeur", actif: false }) && !G.peutEnregistrerContact(null)
    && G.critiqueContactGoogle({ role: "client" }, { nom: "A", tel: "90112233" }) !== ""
    && G.critiqueContactGoogle({ role: "vendeur" }, { nom: "A", tel: "90112233" }) === ""
    && G.critiqueContactGoogle({ role: "admin" }, { nom: " ", tel: "90112233" }) !== ""
    && G.critiqueContactGoogle({ role: "admin" }, { nom: "A", tel: "12" }) !== ""
    && G.critiqueContactGoogle({ role: "admin" }, { nom: "A", tel: "90112233" }) === "");
  test("★★ pas de doublon : un contact Google qui porte le même numéro (8 derniers chiffres) est retrouvé",
    G.contactExistant([{ person: { resourceName: "people/1", names: [{ displayName: "KOSSI" }], phoneNumbers: [{ value: "+228 90 11 22 33" }] } }], "90112233")?.nom === "KOSSI"
    && G.contactExistant([{ person: { phoneNumbers: [{ value: "+228 91 00 00 00" }] } }], "90112233") === null);
  test("★ ce que Google reçoit : le nom, le numéro international, la note",
    JSON.stringify(G.corpsContactGoogle({ nom: "KOSSI", tel: "90112233", note: "n" })) === JSON.stringify({ names: [{ unstructuredName: "KOSSI" }], phoneNumbers: [{ value: "+22890112233", type: "mobile" }], biographies: [{ value: "n", contentType: "TEXT_PLAIN" }] }));
  const avant = CW.construireEntete({ cle: "90112233", tel: "+22890112233", contact_google: { nom: "K", par: "TIMO", le: "x" } });
  const apres = CW.construireEntete({ cle: "90112233", tel: "+22890112233", derniere: "y", entete: avant });
  test("★★ la trace « enregistré » vit sur la fiche légère, et une réécriture de la fiche la GARDE (webhook, tournées, gestes)",
    avant.wa_contact_google?.nom === "K" && apres.wa_contact_google?.nom === "K");
  const srv = sansC(lire("api/_contactGoogle.js"));
  test("★★ le serveur revérifie qui a le droit (la règle IMPORTÉE) et refuse un compte de formation",
    /critiqueContactGoogle\(compte, \{ nom, tel \}\)/.test(srv) && /espace === "formation"/.test(srv) && /compte\.formation === true/.test(srv));
  // ⚠ 09/10/2026 : ouvert à tout le personnel, le serveur doit aussi refuser
  // une conversation CONFIÉE à un collègue (elle ne s'ouvre pas chez lui).
  test("★★ le serveur refuse le contact d'une conversation confiée à un collègue (la règle de l'écran, importée, après la recherche de la conversation, avant Google)",
    /peutVoirConversation\(compte, \{ proprietaire_id: proprietaireDe\(fil\)\.id \}\)/.test(srv)
    && srv.indexOf("peutVoirConversation(compte") > srv.indexOf("Conversation introuvable")
    && srv.indexOf("peutVoirConversation(compte") < srv.indexOf("await jetonGoogle()"));
  test("★★ l'accès Google ne vit que dans le serveur, sous trois variables jamais préfixées VITE_ ; sans elles, on le DIT (503)",
    /process\.env\.GOOGLE_CLIENT_ID/.test(srv) && /process\.env\.GOOGLE_CLIENT_SECRET/.test(srv) && /process\.env\.GOOGLE_REFRESH_TOKEN/.test(srv)
    && !/VITE_GOOGLE/.test(lire("api/_contactGoogle.js") + lire("src/lib/contactGoogle.js") + lire("src/screens/Whatsapp.jsx") + lire("src/supabaseClient.js"))
    && /code: "non_configure"/.test(srv) && /status\(503\)/.test(srv));
  test("★★ on CHERCHE le numéro chez Google AVANT de créer (jamais de doublon voulu)",
    srv.indexOf("await chercher(") > 0 && srv.indexOf("await chercher(") < srv.indexOf("people:createContact"));
  // ⚠⚠ 09/10/2026 : une 13e fonction serveur a fait REFUSER l'envoi en
  // production (l'offre Vercel de BMI en permet DOUZE). Le contact Google
  // passe donc par api/whatsapp.js — et le banc compte les fonctions.
  const fonctions = readdirSync("api").filter((f) => f.endsWith(".js") && !f.startsWith("_"));
  test("★★★ jamais plus de DOUZE fonctions serveur (fichiers de api/ sans « _ ») : une treizième fait refuser l'envoi par Vercel",
    fonctions.length <= 12, `${fonctions.length} : ${fonctions.join(", ")}`);
  test("★★ le contact Google passe par api/whatsapp.js (action contact_google), pas par une fonction à part",
    /if \(req\.body\?\.action === "contact_google"\) return enregistrerContactGoogle\(req, res\);/.test(lire("api/whatsapp.js"))
    && /action: "contact_google"/.test(lire("src/supabaseClient.js")));
  test("★ la conversation doit exister et ne pas être à la corbeille",
    /estALaCorbeille\(m\)/.test(srv) && /Conversation introuvable/.test(srv));
  const W = sansC(lire("src/screens/Whatsapp.jsx"));
  const corps = W.slice(W.indexOf("const enregistrerContact = async"), W.indexOf("// ---- 🗑 SUPPRIMER UNE CONVERSATION"));
  test("★★ le geste : revérifié DANS le geste, la trace n'est écrite qu'APRÈS le oui de Google, sur la fiche FRAÎCHE",
    corps.indexOf("critiqueContactGoogle(profile") > 0 && corps.indexOf("if (!r.ok)") > 0
    && corps.indexOf("if (!r.ok)") < corps.indexOf("contact_google: traceContactGoogle") && /save\(\(etat\) =>/.test(corps));
  test("★ l'écran ne parle pas au serveur lui-même (UN chemin : src/whatsapp.js)",
    !/contactGoogleEnLigne/.test(W) && /enregistrerContactGoogle\(\{ cle: ouverte\.cle/.test(W));
  const adm = V.renduNoms("admin", "90117711", true), vdr = V.renduNoms("vendeur", "90117711", true), ferme = V.renduNoms("admin", "90117711");
  test("★★ un clic sur le nom ouvre le PROFIL : nom, numéro, compte BMI, depuis quand il écrit, la conversation",
    /data-ouvrir-profil/.test(ferme) && !/data-profil-contact/.test(ferme)
    && /data-profil-contact/.test(adm) && /Infos du contact/.test(adm) && /data-numero-profil[^>]*>\+22890117711/.test(adm)
    && /Compte BMI/.test(adm) && /Écrit depuis/.test(adm) && /Kossi M\./.test(adm), adm.slice(0, 200));
  // ⚠ RETOURNÉ le 09/10/2026 : le bouton s'affichait chez l'administrateur seul.
  test("★★ le bouton « 📇 Enregistrer dans les contacts BMI » chez l'administrateur ET chez une vendeuse ; les gestes de l'administrateur (Confier, Nommer) restent à lui",
    /data-enregistrer-contact/.test(adm) && /data-enregistrer-contact/.test(vdr)
    && /data-nommer/.test(adm) && !/data-nommer/.test(vdr) && !/🔁 Confier/.test(vdr), vdr.slice(0, 200));
  const tr = V.renduProfilEnregistre();
  test("★ déjà enregistré : le profil le DIT (nom, date, par qui) et ne propose plus le bouton",
    /data-contact-google="enregistre"/.test(tr) && /KOSSI MENSAH/.test(tr) && /09\/10\/2026/.test(tr) && !/data-enregistrer-contact/.test(tr), tr.slice(0, 200));
}

// ── 🏠 LE LOYER QUI ATTEND LE PROPRIÉTAIRE — `loyer_disponible` (10/10/2026) ──
console.log("\n🏠 Le loyer qui attend le propriétaire (« A a, B b après validation du paiement, C a »)");
{
  const L = await import("../src/lib/loyer.js");
  const e = M.envoiLoyerDisponible({ proprietaire: "KOFFI", tel: "90554433", montant: 180000, mois: L.moisEnClair(["2026-09", "2026-10"]), aupres: "AMA", boutique: "DEMAKPOE", telBoutique: "", fmt: (n) => `${n} F` });
  const texte = M.texteLoyerDisponible(e);
  test("★★ les six trous dans l'ordre : propriétaire, montant, mois, celui qui clique, boutique, téléphone (sans téléphone de boutique : le numéro BMI)",
    e && e.modele === "loyer_disponible" && e.variables.join("|") === `KOFFI|180000 F|septembre et octobre 2026|AMA|DEMAKPOE|${M.NUMERO_BMI_PRINCIPAL}`, JSON.stringify(e));
  test("★ le texte rempli est celui accepté par Timo, mot pour mot",
    texte === `Bonjour KOFFI, le loyer de 180000 F pour septembre et octobre 2026 est disponible. Vous pouvez passer le récupérer auprès de AMA à la boutique DEMAKPOE. Contact : ${M.NUMERO_BMI_PRINCIPAL}. Merci de votre confiance. BMI TOGO`, texte);
  test("★ sans numéro du propriétaire, ou sans montant : rien à envoyer",
    M.envoiLoyerDisponible({ proprietaire: "K", tel: "", montant: 1000, mois: "x", aupres: "A", boutique: "B" }) === null
    && M.envoiLoyerDisponible({ proprietaire: "K", tel: "90554433", montant: 0, mois: "x", aupres: "A", boutique: "B" }) === null);
  test("★ les mois en clair : un mois, deux de la même année, à cheval sur deux années, une suite",
    L.moisEnClair(["2026-10"]) === "octobre 2026" && L.moisEnClair(["2026-12", "2027-01"]) === "décembre 2026 et janvier 2027"
    && L.moisEnClair(["2026-09", "2026-10", "2026-11"]) === "septembre à novembre 2026", L.moisEnClair(["2026-12", "2027-01"]));
  const dep = (id, o) => ({ id, categorie: "Loyer", boutique: "DEMAKPOE", loyer_boutique: "DEMAKPOE", date: "2026-10-05", montant: 90000, paiement: "Espèces", ...o });
  test("★★ « après validation du paiement » : ni en attente du DG, ni rejeté, ni payé par Flooz ou virement — le plus récent des autres",
    L.dernierLoyerARemettre([dep("a", { validation: { statut: "attente" } })], "DEMAKPOE") === null
    && L.dernierLoyerARemettre([dep("r", { validation: { statut: "rejetee" }, montant: 0 })], "DEMAKPOE") === null
    && L.dernierLoyerARemettre([dep("f", { paiement: "Mobile Money (Flooz)" })], "DEMAKPOE") === null
    && L.dernierLoyerARemettre([dep("v", { paiement: "Virement bancaire" })], "DEMAKPOE") === null
    && L.dernierLoyerARemettre([dep("old", { date: "2026-09-05" }), dep("new", { validation: { statut: "validee" } }), dep("autre", { loyer_boutique: "APESSITO", date: "2026-10-09" })], "DEMAKPOE")?.id === "new");
  test("★ la ligne du fil dit ce qui est parti (non privée : pas d'argent d'un client)",
    /Loyer disponible : KOFFI prévenu\(e\) de venir chercher 180000 F pour septembre et octobre 2026 auprès de AMA/.test(M.ligneEnvoiModele("loyer_disponible", e.variables)) && !M.lignePrivee("loyer_disponible"));
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const D = sansC(lire("src/screens/Depenses.jsx"));
  const corps = D.slice(D.indexOf("const prevenirProprietaire = async"), D.indexOf("const payerLoyer = async"));
  test("★★ « C a » : gérant et administrateur, revérifié DANS le geste, avant toute question",
    corps.indexOf('refuserSaufRoles(profile, ["gerant", "admin"]') > 0 && corps.indexOf('refuserSaufRoles(profile, ["gerant", "admin"]') < corps.indexOf("uConfirm(")
    && /const voitLoyer = \["admin", "gerant"\]\.includes\(profile\.role\)/.test(D));
  test("★★ le paiement est relu DANS le geste, la question précède l'envoi, « B b » : le trou 4 = celui qui clique",
    corps.indexOf("dernierLoyerARemettre(db.depenses, boutique)") > 0 && corps.indexOf("uConfirm(") < corps.indexOf("envoyerModele(") && /aupres: profile\.nom/.test(corps));
  test("★★ le mur : l'espace de la BOUTIQUE du local, jamais celui de qui clique ; la ligne du fil seulement si le message est PARTI du numéro BMI",
    /espaceFormation: !!bqLocal\?\.formation/.test(corps) && !/estCompteFormation/.test(corps) && corps.indexOf("if (!r.auto) return;") > 0 && corps.indexOf("if (!r.auto) return;") < corps.indexOf("messagesAvecLigneEnvoi("));
  test("★ la ligne du fil porte le paiement (loyer_depense_id) : le cadre dit « prévenu le … »",
    /loyer_depense_id: ref\.loyer_depense_id/.test(lire("src/whatsapp.js")) && /ref: \{ loyer_depense_id: dep\.id \}/.test(corps) && /data-proprietaire-prevenu/.test(D));
}


// ── 📅 L'AFFECTATION D'UN TECHNICIEN À UN CHANTIER (12/10/2026, « Aa, Ba, Ca, texte ok ») ──
console.log("\n📅 L'affectation à un chantier : l'avis, le changement, le rappel de la veille au chef");
{
  const AF = await import("../src/lib/affectationChantier.js");
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const A = { user_id: "a", nom: "AGBEKO", chef: true }, K = { user_id: "k", nom: "KOSSI" }, E = { user_id: "e", nom: "ESSO" };
  const c = { id: "c1", prenom: "Koffi", nom: "AYOKO", tel: "90112233", type_installation: "Solaire", localisation: "Agoè", lat: 6.2, lng: 1.2, date_installation: "2026-10-13", equipe: [A, K] };
  const chef = M.envoiAffectation({ technicien: "AGBEKO", estChef: true, chantier: c, date: "2026-10-13", equipe: c.equipe });
  const membre = M.envoiAffectation({ technicien: "KOSSI", estChef: false, chantier: c, date: "2026-10-13", equipe: c.equipe });
  test("★★ l'avis d'affectation : neuf trous dans l'ordre, le texte accepté par Timo",
    chef.modele === "affectation_chantier" && chef.variables.join("|") === "AGBEKO|chef d'équipe ⭐|solaire|Koffi AYOKO|mardi 13/10/2026|Agoè|https://maps.google.com/?q=6.2,1.2|AGBEKO (chef), KOSSI|90112233"
    && M.texteAffectation(chef).startsWith("Bonjour AGBEKO,\nVous êtes affecté comme chef d'équipe ⭐ pour l'installation solaire de Koffi AYOKO, prévue le mardi 13/10/2026.\n📍 Lieu : Agoè"), JSON.stringify(chef));
  test("★★ « A a » : le numéro du client au CHEF seulement — un membre lit « à joindre par le chef d'équipe AGBEKO »",
    membre.variables[8] === "à joindre par le chef d'équipe AGBEKO" && !membre.variables.join(" ").includes("90112233") && membre.variables[1] === "membre de l'équipe");
  test("★ aucun trou vide (Meta le refuse) : sans lieu, sans position, sans numéro, on le DIT",
    M.envoiAffectation({ technicien: "X", estChef: true, chantier: { prenom: "A" }, date: "2026-10-13", equipe: [] }).variables.every((v) => v && !/\n/.test(v))
    && M.lienPosition({}) === "non enregistrée");
  const premiere = AF.changementsAffectation({ equipe: [], date: "" }, { equipe: [A, K], date: "2026-10-13" });
  test("★ la première programmation : tout le monde reçoit l'affectation, aucun changement", premiere.principal.length === 2 && premiere.changements.length === 0);
  const rien = AF.changementsAffectation({ equipe: [A, K], date: "2026-10-13" }, { equipe: [A, K], date: "2026-10-13" });
  test("★★ ré-enregistrée sans rien changer : personne n'est prévenu", rien.principal.length === 0 && rien.changements.length === 0);
  const rempl = AF.changementsAffectation({ equipe: [A, K], date: "2026-10-13" }, { equipe: [{ ...A, chef: false }, { ...K, chef: true }], date: "2026-10-15" });
  test("★★ le chef REMPLACÉ est prévenu qu'il ne l'est plus (sa précision), avec la nouvelle date, en UN message ; le nouveau chef reçoit l'affectation",
    rempl.principal.map((e) => e.user_id).join() === "k" && rempl.changements.length === 1 && rempl.changements[0].e.user_id === "a"
    && /déplacée au jeudi 15\/10\/2026 \(au lieu du mardi 13\/10\/2026\)/.test(rempl.changements[0].phrase)
    && /Vous n'êtes plus le chef d'équipe ; le nouveau chef est KOSSI\. Vous restez dans l'équipe\./.test(rempl.changements[0].phrase), JSON.stringify(rempl));
  const retire = AF.changementsAffectation({ equipe: [A, K], date: "2026-10-13" }, { equipe: [A, E], date: "2026-10-13" });
  test("★★ « B a » : le retiré reçoit le changement, le nouveau l'affectation, celui qui reste rien",
    retire.principal.map((e) => e.user_id).join() === "e" && retire.changements.length === 1 && retire.changements[0].e.user_id === "k"
    && retire.changements[0].phrase === "Vous n'êtes plus affecté à cette installation, prévue le mardi 13/10/2026.");
  const ch = M.envoiChangementAffectation({ technicien: "KOSSI", chantier: c, changement: retire.changements[0].phrase });
  test("★ le changement : trois trous, le texte accepté", ch.modele === "changement_affectation" && M.texteAffectation(ch) === "Bonjour KOSSI,\nChangement sur l'installation de Koffi AYOKO :\nVous n'êtes plus affecté à cette installation, prévue le mardi 13/10/2026.\nDétails dans l'application BMI, onglet Clients installés.\nBMI TOGO");
  const db = { users: [{ id: "a", nom: "AGBEKO", role: "technicien", tel: "91000000" }, { id: "k", nom: "KOSSI", role: "technicien" }], boutiques: [{ nom: "DFORMATION", formation: true }], ventes: [{ id: "v", boutique: "DFORMATION" }], dettes: [], clients_installes: [c] };
  const demain = AF.installationsDeDemain(db, "2026-10-12");
  test("★★ le rappel : ses trous dans l'ORDRE où ils apparaissent ({{1}} à {{8}}), le texte du modèle les lit dans cet ordre",
    /^Bonjour \{\{1\}\},\n⏰ Rappel : demain \{\{2\}\}, vous êtes chef d'équipe pour l'installation \{\{3\}\} de \{\{4\}\}\.\n📍 Lieu : \{\{5\}\}\n🗺 Position : \{\{6\}\}\n📞 Client : \{\{7\}\}\n👥 Équipe : \{\{8\}\}/.test(M.TEXTE_RAPPEL_INSTALLATION)
    && [M.TEXTE_AFFECTATION_CHANTIER, M.TEXTE_CHANGEMENT_AFFECTATION, M.TEXTE_RAPPEL_INSTALLATION, M.TEXTE_INSTALLATION_PROGRAMMEE, M.TEXTE_INSTALLATION_DEPLACEE].every((t) => { const n = [...t.matchAll(/\{\{(\d+)\}\}/g)].map((x) => Number(x[1])); return n.every((v, i) => v === i + 1); }));
  test("★★ « C a » : la veille, le chef d'équipe seul, avec le numéro du client — le texte accepté",
    demain.length === 1 && demain[0].tel === "+22891000000" && demain[0].envoi.modele === "rappel_installation"
    && M.texteAffectation(demain[0].envoi).startsWith("Bonjour AGBEKO,\n⏰ Rappel : demain mardi 13/10/2026, vous êtes chef d'équipe pour l'installation solaire de Koffi AYOKO.") && /📞 Client : 90112233/.test(M.texteAffectation(demain[0].envoi)));
  test("★★ le mur : jamais un chantier de formation (sa marque ou la boutique de sa vente), un chef de formation, un chantier terminé, la corbeille, des travaux ; pas le jour même",
    AF.installationsDeDemain({ ...db, clients_installes: [{ ...c, formation: true }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, clients_installes: [{ ...c, vente_id: "v" }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, users: [{ ...db.users[0], formation: true }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, clients_installes: [{ ...c, statut: "termine" }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, clients_installes: [{ ...c, supprime_le: "2026-10-11" }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, clients_installes: [{ ...c, travaux: true }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain(db, "2026-10-13").length === 0);
  test("★ un chef sans numéro, bloqué ou inactif : rien", AF.installationsDeDemain({ ...db, users: [{ ...db.users[0], tel: "" }] }, "2026-10-12").length === 0
    && AF.installationsDeDemain({ ...db, users: [{ ...db.users[0], bloque: true }] }, "2026-10-12").length === 0);
  const prog = M.envoiInstallationClient({ chantier: c, date: "2026-10-13", dateAvant: "", chefNom: "AGBEKO Kossi", chefTel: "91000000" });
  test("★★ le client : à la première programmation, `installation_programmee`, six trous dans l'ordre, « A b » le numéro du chef",
    prog?.modele === "installation_programmee" && prog.variables.join("|") === "Koffi AYOKO|solaire|mardi 13/10/2026|Agoè|AGBEKO Kossi|91000000"
    && M.texteAffectation(prog) === "Bonjour Koffi AYOKO,\nVotre installation solaire est programmée le mardi 13/10/2026.\n📍 Lieu : Agoè\n👷 Chef d'équipe : AGBEKO Kossi\n📞 91000000\nPour toute question, répondez simplement à ce message.\nBMI TOGO", JSON.stringify(prog));
  const dep = M.envoiInstallationClient({ chantier: c, date: "2026-10-15", dateAvant: "2026-10-13", chefNom: "AGBEKO Kossi", chefTel: "" });
  test("★★ « B b » : date déplacée → `installation_deplacee` (nouvelle date, ancienne) ; chef sans numéro → le numéro BMI, jamais un trou vide",
    dep?.modele === "installation_deplacee" && dep.variables[2] === "jeudi 15/10/2026" && dep.variables[3] === "mardi 13/10/2026" && dep.variables[6] === M.NUMERO_BMI_PRINCIPAL);
  test("★★ même date (équipe seule changée) → rien au client",
    M.envoiInstallationClient({ chantier: c, date: "2026-10-13", dateAvant: "2026-10-13", chefNom: "X", chefTel: "91000000" }) === null);
  const S = sansC(lire("api/rappels-du-soir.js"));
  test("★★ la tournée de 17 h lit les chantiers, envoie le rappel d'installation AVANT de regarder les anniversaires (indépendants), n'écrit rien",
    /"clients_installes", "ventes", "dettes"/.test(S) && S.indexOf("rappelerLesInstallations(db, aujourdhui)") > 0 && S.indexOf("rappelerLesInstallations(db, aujourdhui)") < S.indexOf("if (!rappel) return")
    && !/\.upsert\(|\.insert\(|\.update\(/.test(S));
  const CI = sansC(lire("src/screens/ClientsInstalles.jsx"));
  const corps = CI.slice(CI.indexOf("const enregistrerProgrammation = async"), CI.indexOf("const construireMessagePv"));
  test("★★ l'écran : UNE règle (changementsAffectation) pour les messages internes ET le WhatsApp, envoyé APRÈS l'enregistrement, sans question ni repli",
    /changementsAffectation\(\{ equipe: c\.equipe, date: dateAvant \}/.test(corps) && corps.indexOf("save({") < corps.indexOf("envoyerAvisAffectation(") && /envoyerRecuSansQuestion\(/.test(corps) && !/uConfirm\(/.test(corps.slice(corps.indexOf("const envoyerAvisAffectation"))));
  const corpsClient = CI.slice(CI.indexOf("const envoyerAvisClient = async"), CI.indexOf("const envoyerAvisAffectation = async"));
  test("★★ le client à l'écran : après l'enregistrement, le mur = l'espace du CHANTIER, compte bloqué → rien, sans numéro c'est DIT",
    corps.indexOf("save({") < corps.indexOf("envoyerAvisClient(") && /envoiInstallationClient\(/.test(corpsClient)
    && corpsClient.indexOf("espaceDuChantier(db, c, profile) === true") > 0 && corpsClient.indexOf("espaceDuChantier(db, c, profile) === true") < corpsClient.indexOf("envoyerRecuSansQuestion(")
    && /compte\?\.bloque/.test(corpsClient) && /n'a pas reçu de WhatsApp/.test(corpsClient) && !/estCompteFormation\(db, profile\)/.test(corpsClient));
  test("★★ le mur à l'écran : l'espace du CHANTIER ou un technicien de formation → rien ; une fiche sans numéro est DITE",
    /espaceDuChantier\(db, c, profile\) === true/.test(corps) && /estCompteFormation\(db, fiche\)/.test(corps) && !/estCompteFormation\(db, profile\)/.test(corps) && /Aucun avis WhatsApp : la fiche de/.test(corps));
}

titre("51 📅 LES RENDEZ-VOUS : les cinq messages, les rappels de 14 h et de 7 h, le privé neutre, le mur (12/10/2026, « Aa, A2a, Ba, C 14h la veille et le jour même à 7h, Da, Ea, Fb, G toutes, H a »)");
{
  const RV = await import("../src/lib/rendezVous.js");
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const trous = (t) => [...t.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const suite = (t, n) => trous(t).join(",") === Array.from({ length: n }, (_, i) => i + 1).join(",");
  test("★★ les cinq textes ont leurs trous 1 à N, DANS L'ORDRE (leçon du rappel d'installation, 1 4 2 3)",
    suite(M.TEXTE_RENDEZ_VOUS_EQUIPE, 7) && suite(M.TEXTE_RENDEZ_VOUS_MODIFIE, 3) && suite(M.TEXTE_VISITE_CLIENT, 6)
    && suite(M.TEXTE_RAPPEL_RENDEZ_VOUS, 6) && suite(M.TEXTE_RAPPEL_RENDEZ_VOUS_PRIVE, 3));
  test("★★ « visite_client » porte les contacts de BMI (Timo : « l'e-mail et le site web ») — le bloc commun, jamais recopié",
    M.TEXTE_VISITE_CLIENT.includes("📧 contact@bmitogo.com") && M.TEXTE_VISITE_CLIENT.includes("🌐 www.bmitogo.com") && M.TEXTE_VISITE_CLIENT.includes(M.NUMEROS_BMI));
  test("★ l'heure en clair : « 09:00 » → « 9 h », « 14:30 » → « 14 h 30 »", M.heureEnClair("09:00") === "9 h" && M.heureEnClair("14:30") === "14 h 30" && M.heureEnClair("") === "");
  const rdv = { id: "r1", type: "pro", par_id: "u_k", par: "KOSSI", objet: "Visite chez MR ERIC", date: "2026-10-15", heure: "09:00", lieu: "", participants: ["u_a"], statut: "a_venir" };
  const eq = M.envoiRendezVousEquipe({ employe: "AGBEKO", auteur: "KOSSI", rdv, participants: ["KOSSI"] });
  test("★ le participant ajouté : sept trous — lui, l'auteur, l'objet, le jour en clair, l'heure, « à préciser » sans lieu, les autres",
    eq && eq.modele === "rendez_vous_equipe" && eq.variables.join("|") === "AGBEKO|KOSSI|Visite chez MR ERIC|jeudi 15/10/2026|9 h|à préciser|KOSSI");
  const vis = M.envoiVisiteClient({ client: "MR ERIC", rdv, chefNom: "AGBEKO", chefTel: "" });
  test("★ la visite au client : sans numéro du chef, le NUMÉRO BMI (Meta refuse un trou vide, le client a quelqu'un à appeler)",
    vis && vis.modele === "visite_client" && vis.variables[4] === "AGBEKO" && vis.variables[5] === M.NUMERO_BMI_PRINCIPAL);
  const priv = M.envoiRappelRendezVous({ employe: "ANGELE", rdv: { ...rdv, type: "prive", objet: "Banque BTCI — prêt" } });
  test("★★ « B a » le rappel d'un PRIVÉ est NEUTRE : trois trous, JAMAIS l'objet (la copie se lit sur le téléphone BMI)",
    priv && priv.modele === "rappel_rendez_vous_prive" && priv.variables.length === 3 && !priv.variables.join(" ").includes("Banque") && !M.TEXTE_RAPPEL_RENDEZ_VOUS_PRIVE.includes("{{4}}"));
  // Les rappels du serveur.
  const users = [
    { id: "u_k", nom: "KOSSI", role: "commercial", tel: "90112233", actif: true },
    { id: "u_a", nom: "AGBEKO", role: "technicien", tel: "91112233", actif: true },
    { id: "u_ang", nom: "ANGELE", role: "vendeur", boutique: "DEMAKPOE", tel: "92112233", actif: true },
    { id: "u_f", nom: "FORMA", role: "technicien", tel: "93112233", actif: true, formation: true },
    { id: "u_s", nom: "SANSTEL", role: "technicien", tel: "", actif: true },
    { id: "u_b", nom: "BLOQUE", role: "technicien", tel: "94112233", actif: true, bloque: true },
  ];
  const db = { users, boutiques: [{ id: "b", nom: "DEMAKPOE" }], rendez_vous: [
    rdv,
    { ...rdv, id: "r2", participants: ["u_f", "u_s", "u_b"] },
    { id: "p1", type: "prive", par_id: "u_ang", par: "ANGELE", objet: "Banque", date: "2026-10-15", heure: "11:00", statut: "a_venir" },
    { ...rdv, id: "r3", formation: true },
    { ...rdv, id: "r4", statut: "annule" },
    { ...rdv, id: "r5", date: "2026-10-16" },
  ] };
  const veille = RV.rappelsRendezVous(db, "2026-10-14", "veille");
  const jour = RV.rappelsRendezVous(db, "2026-10-15", "jour");
  const cles = (l) => l.map((x) => `${x.rdv.id}:${x.personne.nom}:${x.envoi.modele}`).sort().join(",");
  test("★★ « C » la VEILLE (tournée de 14 h, pour DEMAIN) et le JOUR MÊME (7 h) visent les MÊMES rendez-vous du 15 : l'auteur et les participants d'un pro, l'auteur seul d'un privé",
    cles(veille) === cles(jour) && cles(veille) === "p1:ANGELE:rappel_rendez_vous_prive,r1:AGBEKO:rappel_rendez_vous,r1:KOSSI:rappel_rendez_vous,r2:KOSSI:rappel_rendez_vous", cles(veille));
  test("★★ LE MUR : jamais un rendez-vous de formation, un compte de formation, sans numéro ou bloqué ; jamais un rendez-vous annulé ni d'un autre jour",
    !veille.some((x) => ["r3", "r4", "r5"].includes(x.rdv.id)) && !veille.some((x) => ["FORMA", "SANSTEL", "BLOQUE"].includes(x.personne.nom)));
  // ⚠ RETOURNÉ le 13/10/2026 (« A a, B b, C ok ») : le rappel nommait les
  // AUTRES (l'organisateur compris) ; il énumère maintenant l'ÉQUIPE — les
  // participants seuls, la même liste pour tous. L'organisateur qui n'y va
  // pas reçoit le rappel, mais n'est pas écrit dans l'équipe.
  test("★ le rappel d'un pro énumère l'ÉQUIPE (les participants), la même pour tous ; l'organisateur non participant n'y est pas écrit (RETOURNÉ le 13/10/2026)",
    (veille.find((x) => x.rdv.id === "r1" && x.personne.nom === "KOSSI") || {}).envoi?.variables[5] === "AGBEKO"
    && (veille.find((x) => x.rdv.id === "r1" && x.personne.nom === "AGBEKO") || {}).envoi?.variables[5] === "AGBEKO");
  // ── 13/10/2026 : LE CHEF D'UNE VISITE REÇOIT LE NUMÉRO DU CLIENT ──
  test("★★ les deux textes du chef ont leurs trous 1 à N, DANS L'ORDRE, et sont ceux acceptés par Timo",
    suite(M.TEXTE_VISITE_CHEF, 9) && suite(M.TEXTE_RAPPEL_VISITE_CHEF, 8)
    && M.TEXTE_VISITE_CHEF === "Bonjour {{1}}, {{2}} vous a nommé chef de la visite BMI TOGO : {{3}}, le {{4}} à {{5}}. Lieu : {{6}}. Client : {{7}}, joignable au {{8}}. Équipe : {{9}}. Détails dans l'application BMI, onglet Rendez-vous. BMI TOGO"
    && M.TEXTE_RAPPEL_VISITE_CHEF === "Bonjour {{1}}, rappel de la visite BMI TOGO dont vous êtes le chef : {{2}}, le {{3}} à {{4}}. Lieu : {{5}}. Client : {{6}}, joignable au {{7}}. Équipe : {{8}}. BMI TOGO");
  const visite = { id: "v1", type: "pro", par_id: "u_k", par: "KOSSI", objet: "Visite chez MR ERIC", date: "2026-10-15", heure: "09:00", lieu: "Adagbe",
    visite: true, participants: ["u_ang", "u_a"], chef_id: "u_a", client_nom: "MR ERIC", client_tel: "99 00 11 22", statut: "a_venir" };
  const nomV = (id) => ({ u_k: "KOSSI", u_a: "AGBEKO", u_ang: "ANGELE" })[id] || "";
  test("★★ l'ÉQUIPE : le chef EN PREMIER « (chef d'équipe) », les participants seuls — l'organisateur n'y est que s'il s'est coché",
    RV.equipeDuRdv(visite, nomV).join(", ") === "AGBEKO (chef d'équipe), ANGELE"
    && RV.equipeDuRdv({ ...visite, participants: ["u_a", "u_k"], chef_id: "u_k" }, nomV).join(", ") === "KOSSI (chef d'équipe), AGBEKO"
    && RV.equipeDuRdv({ ...visite, visite: false, chef_id: "" }, nomV).join(", ") === "ANGELE, AGBEKO");
  const vc = M.envoiVisiteChef({ employe: "AGBEKO", auteur: "KOSSI", rdv: visite, equipe: RV.equipeDuRdv(visite, nomV) });
  test("★★ « visite_chef » : neuf trous — le client et SON NUMÉRO, puis l'équipe",
    vc && vc.modele === "visite_chef" && vc.variables.join("|") === "AGBEKO|KOSSI|Visite chez MR ERIC|jeudi 15/10/2026|9 h|Adagbe|MR ERIC|99 00 11 22|AGBEKO (chef d'équipe), ANGELE", vc && vc.variables.join("|"));
  const vcSans = M.envoiVisiteChef({ employe: "AGBEKO", auteur: "KOSSI", rdv: { ...visite, client_nom: "", client_tel: "" }, equipe: ["AGBEKO"] });
  test("★ un client sans numéro : « numéro non renseigné » (Meta refuse un trou vide) ; sans nom : « non renseigné » ; une réunion (pas une visite) n'a pas d'avis du chef",
    vcSans && vcSans.variables[6] === "non renseigné" && vcSans.variables[7] === "numéro non renseigné"
    && M.envoiVisiteChef({ employe: "AGBEKO", auteur: "KOSSI", rdv: { ...visite, visite: false }, equipe: [] }) === null);
  const dbV = { users, boutiques: [{ id: "b", nom: "DEMAKPOE" }], rendez_vous: [visite] };
  const rv = RV.rappelsRendezVous(dbV, "2026-10-14", "veille");
  const deQui = (n) => rv.find((x) => x.personne.nom === n) || {};
  test("★★ « A a » le CHEF reçoit le rappel AVEC le numéro du client (rappel_visite_chef) et, en repli, le rappel ordinaire ; « B b » l'organisateur qui n'y va pas et l'autre participant : le rappel ordinaire, SANS le numéro",
    deQui("AGBEKO").envoi?.modele === "rappel_visite_chef" && deQui("AGBEKO").envoi?.variables[6] === "99 00 11 22" && deQui("AGBEKO").repli?.modele === "rappel_rendez_vous"
    && deQui("KOSSI").envoi?.modele === "rappel_rendez_vous" && !deQui("KOSSI").repli && !deQui("KOSSI").envoi.variables.join(" ").includes("99 00")
    && deQui("ANGELE").envoi?.modele === "rappel_rendez_vous" && !deQui("ANGELE").envoi.variables.join(" ").includes("99 00")
    && deQui("KOSSI").envoi?.variables[5] === "AGBEKO (chef d'équipe), ANGELE", JSON.stringify(rv.map((x) => [x.personne.nom, x.envoi.modele])));
  const chg = RV.changementsRendezVous(visite, { ...visite, chef_id: "u_ang" }, "u_k");
  test("★ un participant déjà prévenu qui DEVIENT chef reçoit l'avis du chef (le numéro) ; pas l'auteur du geste ; rien si le chef ne change pas",
    chg.chef === "u_ang" && chg.nouveaux.length === 0 && RV.changementsRendezVous(visite, { ...visite, chef_id: "u_ang" }, "u_ang").chef === ""
    && RV.changementsRendezVous(visite, { ...visite, lieu: "X" }, "u_k").chef === "");
  test("★ la ligne du fil de « visite_chef » ne recopie PAS le numéro du client",
    M.ligneEnvoiModele("visite_chef", vc.variables).includes("MR ERIC") && !M.ligneEnvoiModele("visite_chef", vc.variables).includes("99 00"));
  const SR = sansC(lire("api/rappels-du-soir.js"));
  const MA = sansC(lire("api/rappels-du-matin.js"));
  const RVS = sansC(lire("api/_rendezVous.js"));
  test("★★ la tournée de 14 h : rappels-du-soir appelée avec ?tournee=rendez-vous ne fait QUE les rendez-vous de demain (« veille ») ; celle de 7 h ceux du jour (« jour »)",
    /if \(estTourneeRendezVous\(req\)\) \{\n\s*const rendez_vous = await rappelerLesRendezVous\(admin, db, aujourdhui, "veille"\);\n\s*return res\.status\(200\)/.test(SR)
    && SR.indexOf("estTourneeRendezVous(req)") < SR.indexOf("rappelerLesInstallations(db, aujourdhui)")
    && /rappelerLesRendezVous\(admin, db, aujourdhui, "jour"\)/.test(MA));
  test("★★ une table pas encore créée (SQL pas encore collé) ne fait PAS tomber la tournée : la lecture est rattrapée, les autres rappels partent",
    /try \{ return await lireTable\(admin, "rendez_vous"\); \}\n\s*catch \(e\) \{[^\n]*return \[\]; \}/.test(RVS) && !/\.upsert\(|\.insert\(|\.update\(/.test(RVS));
  test("★ « _rendezVous.js » n'est pas une fonction Vercel (le « _ ») : toujours douze fonctions au plus",
    readdirSync("api").filter((f) => f.endsWith(".js") && !f.startsWith("_")).length <= 12);
  test("★★ le serveur : refusé, le rappel du chef laisse partir le rappel ORDINAIRE (jamais rien du tout)",
    /if \(!envoi\.ok && r\.repli\) \{[\s\S]*?envoi = await envoyer\(r\.tel, r\.repli\);/.test(RVS) || /if \(!envoi\.ok && r\.repli\)/.test(RVS) && /envoi = await envoyer\(r\.tel, r\.repli\)/.test(RVS));
  // L'écran.
  const EC = sansC(lire("src/screens/RendezVous.jsx"));
  const corpsPrev = EC.slice(EC.indexOf("const prevenir = async"), EC.indexOf("const prevenirClient = async"));
  const corpsCli = EC.slice(EC.indexOf("const prevenirClient = async"), EC.indexOf("const enregistrer = async"));
  test("★★ « D a » l'écran : les participants par envoyerRecuSansQuestion (sans repli), le mur = l'espace du RENDEZ-VOUS (formation → rien), une fiche sans numéro est DITE",
    /if \(apres\.formation\) return \[\];/.test(corpsPrev) && /envoyerRecuSansQuestion\(/.test(corpsPrev) && /Aucun WhatsApp : la fiche de/.test(corpsPrev) && !/estCompteFormation\(db, profile\)/.test(EC));
  test("★★ « G » le client n'est prévenu QU'APRÈS une question, jamais en formation",
    corpsCli.indexOf("uConfirm(") > 0 && corpsCli.indexOf("uConfirm(") < corpsCli.indexOf("envoyerRecuSansQuestion(") && /r\.formation/.test(corpsCli));
  test("★★ l'écran : le CHEF d'une visite reçoit « visite_chef » ; refusé, l'avis ORDINAIRE part à sa place et l'écran DIT que le numéro n'est pas parti ; l'équipe est LA liste commune (equipeDuRdv)",
    /estChefDeLaVisite\(apres, id\)/.test(corpsPrev) && /envoiVisiteChef\(/.test(corpsPrev) && /n'a pas reçu le numéro du client/.test(corpsPrev)
    && /if \(parti\(r\)\) \{ phrases\.push\(r\); continue; \}\n\s*const r2 = await tenter\(id, ordinaire\(\)/.test(corpsPrev)
    && /if \(parti\(r2\)\) phrases\.push\(SANS_NUMERO\(/.test(corpsPrev) && /if \(r !== null && !parti\(r\)\) phrases\.push\(SANS_NUMERO\(/.test(corpsPrev)
    && /const equipe = equipeDuRdv\(apres, nomDe\)/.test(corpsPrev) && !/\[apres\.par, \.\.\.noms/.test(corpsPrev));
  test("★ l'écran propose l'ORGANISATEUR parmi les participants (il se coche s'il y va) — plus jamais retiré de la liste",
    /participantsProposes\(personnes\)/.test(EC) && /data-organisateur/.test(EC) && !/u\.id !== edition\.par_id/.test(EC));
}

{
  titre("🏗 LE REÇU D'UN DÉPÔT CHANTIER (13/10/2026, « A ok, B non, C b », les contacts en dessous)");
  let R = null;
  try { R = V.recusDepot(); } catch (e) { R = null; }
  const d = R?.depot || [];
  const texteD = d[0] ? d[0].variables.reduce((x, v, i) => x.replace(`{{${i + 1}}}`, v), M.TEXTE_RECU_DEPOT_CHANTIER) : "";
  test("★★ « C b » un dépôt part par SON modèle et lui seul — jamais le reçu de vente (« merci pour votre achat ») en repli",
    d.length === 1 && d[0].modele === "recu_depot_chantier");
  test("★★ une vente ordinaire garde ses deux reçus (détaillé puis court), jamais le reçu de dépôt",
    (R?.comptoir || []).map((e) => e.modele).join(",") === "recu_vente_detail,recu_vente");
  test("★★ les sept trous dans l'ordre : client, date, boutique du devis, n° du reçu, montant du DEVIS (articles + frais), comment c'est payé, téléphone de la boutique ; « B non » : pas de liste d'articles",
    d[0]?.variables.join("|") === "KLOMEGAN|12/10/2026|APESSITO|BMIA-2026-0003|" + d[0]?.variables[4] + "|payé en espèces|91000000"
    && /750[\s\u202f\u00a0.]?000/.test(d[0]?.variables[4] || "") && !/Panneau/.test(d[0]?.variables.join("|") || ""));
  test("★ à crédit : « à crédit : avance X, reste Y », lu sur la dette",
    /^à crédit : avance 300[\s\u202f\u00a0.]?000 F, reste 450[\s\u202f\u00a0.]?000 F$/.test(R?.depotCredit?.[0]?.variables[5] || ""));
  test("★★ le texte, mot pour mot : « dépôt pour votre chantier », « Reçu de dépôt chantier N° », jamais « achat » ; les contacts, le mail et le site EN DESSOUS (sa demande)",
    /^Bonjour KLOMEGAN,\nBMI TOGO a bien reçu votre dépôt pour votre chantier, le 12\/10\/2026 à APESSITO\.\nReçu de dépôt chantier N° BMIA-2026-0003\nMontant du devis : .+, payé en espèces\.\nCe dépôt servira à la fourniture du matériel et à l'installation de votre chantier\.\nPour toute question veuillez contacter : 91000000\.\nMerci de votre confiance\.\n\n📧 contact@bmitogo\.com\n📞 \+228 99 96 84 88 \/ \+228 91 13 05 11\n🌐 www\.bmitogo\.com\n\nBMI TOGO — Les bâtiments modernes et intelligents$/.test(texteD)
    && !/achat/i.test(M.TEXTE_RECU_DEPOT_CHANTIER) && texteD.length < M.LIMITE_MESSAGE_META);
  test("★ UTILITY, en service (rien ne part avant l'accord de Meta : sansRepli, comme le reçu de vente) ; Meta accepte ses trous",
    M.MODELES.recu_depot_chantier?.categorie === "utility" && M.MODELES_EN_SERVICE.includes("recu_depot_chantier")
    && !!d[0] && M.critiqueModele("recu_depot_chantier", d[0].variables) === "");
  test("★★ la ligne RANGÉE dans 📲 WhatsApp est neutre (ni montant ni paiement) ; le détail se recompose pour le vendeur et le principal",
    R?.ligne?.rangee?.wa_prive === true && /^🔒 Reçu de dépôt chantier envoyé/.test(R?.ligne?.rangee?.texte || "")
    && !/750|espèces/.test(R?.ligne?.rangee?.texte || "") && /Reçu de dépôt chantier N° BMIA-2026-0003 envoyé à KLOMEGAN/.test(R?.ligne?.detail || ""));
  const VJ = lire("src/screens/Ventes.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★ 💰 Ventes le DIT : « Reçu de dépôt chantier … envoyé » à l'encaissement comme sur le bouton de la ligne",
    /depot: envoi\.modele === "recu_depot_chantier"/.test(VJ) && (VJ.match(/r\.depot \? "de dépôt chantier " : ""/g) || []).length === 2);
}

{
  titre("📱 LA LISTE SUR TÉLÉPHONE GARDE LA LARGEUR DE L'ÉCRAN (13/10/2026, capture Timo) — mesurée dans Chromium");
  // ⚠ La liste est un TABLEAU (le composant d'archivage) : un tableau ordinaire
  // prend la largeur de son plus long contenu, et l'aperçu « truncate » ne se
  // coupait jamais — la ligne courait sur 1 900 px, le téléphone rétrécissait
  // toute la page. On REND l'écran avec un très long dernier message, avec le
  // CSS construit, à la largeur d'un téléphone ; un TÉMOIN sans « table-fixed »
  // prouve que la règle commande quelque chose.
  const css = existsSync("dist/assets") ? readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0] : null;
  let html = "";
  try { const e0 = console.error; console.error = () => {}; html = V.htmlListeLongue(); console.error = e0; } catch (e) { html = ""; }
  test("★ l'écran se rend avec un très long dernier message", html.includes("data-whatsapp=\"conversations\""));
  test("★ la table de la liste est FIXÉE (« w-full table-fixed »)", /classeTable="w-full table-fixed"/.test(lire("src/screens/Whatsapp.jsx")));
  if (!css) { test("★ le CSS construit existe (npm run build d'abord)", false); }
  else {
    const require = createRequire(import.meta.url);
    const { chromium } = require("/opt/node22/lib/node_modules/playwright");
    const dossier = mkdtempSync(join(tmpdir(), "bmi-wa-liste-"));
    const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    const page = await nav.newPage({ viewport: { width: 390, height: 800 } });
    const mesurer = async (corps, nom) => {
      const f = join(dossier, nom + ".html");
      writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}"></head><body>${corps}</body></html>`);
      await page.goto(`file://${f}`);
      return page.evaluate(() => {
        const zone = document.querySelector('[data-whatsapp="conversations"]');
        const t = zone && zone.querySelector("table");
        return { page: document.documentElement.scrollWidth, ecran: window.innerWidth, table: t ? Math.round(t.getBoundingClientRect().width) : -1 };
      });
    };
    const m = await mesurer(html, "fixee");
    const temoin = await mesurer(html.replace(/w-full table-fixed/g, "w-full"), "temoin");
    test("★★ à 390 px, la page ne dépasse pas l'écran et la liste tient dans sa largeur (l'aperçu se coupe)",
      m.page <= m.ecran && m.table > 0 && m.table <= m.ecran, JSON.stringify(m));
    test("★ TÉMOIN : sans « table-fixed », le même message élargit la page bien au-delà de l'écran (la règle commande quelque chose)",
      temoin.page > temoin.ecran + 200, JSON.stringify(temoin));
    await nav.close();
    rmSync(dossier, { recursive: true, force: true });
  }
}

{
  titre("52 🧾 L'AVIS WHATSAPP DE LA DÉCISION DU DG SUR UNE DÉPENSE (13/10/2026, « Aa, Ba, Cb, texte ok »)");
  let A = null;
  try { A = V.avisDepense(); } catch (e) { A = null; console.error(e); }
  const rj = A?.rejet || {}, va = A?.validation || {};
  const texteRj = rj.envoi ? rj.envoi.variables.reduce((x, v, i) => x.split(`{{${i + 1}}}`).join(v), M.TEXTE_DEPENSE_REJETEE).replace(/[\u202f\u00a0]/g, " ") : "";
  test("★★ « texte ok » : le rejet = le texte accepté par Timo, sept trous dans l'ordre (auteur, montant, dépense, date, caisse, motif SANS son point, la suite)",
    texteRj === "Bonjour KOSSI Mensah, votre dépense BMI TOGO de 12 000 F (Carburant — Plein du tricycle) du 12/10/2026, enregistrée à APESSITO, a été rejetée par la Direction. Motif : Pas de bon d'essence. Cet argent reste dû à la caisse de APESSITO : remettez 12 000 F dans le tiroir. Détails dans l'application BMI. BMI TOGO",
    texteRj);
  const texteVa = va.envoi ? va.envoi.variables.reduce((x, v, i) => x.split(`{{${i + 1}}}`).join(v), M.TEXTE_DEPENSE_VALIDEE) : "";
  test("★★ « C b » : la validation part aussi, six trous ; la suite dit qu'aucune action n'est attendue (une avance : « vous sera remboursée »)",
    /a été validée par la Direction\. Aucune action n'est attendue de vous\. Détails/.test(texteVa) && va.envoi?.variables.length === 6
    && M.envoiDepenseValidee({ employe: "X", tel: "90112233", dep: { montant: 1000, date: "2026-10-12", paye_avec: "avance" }, suite: "Cette avance vous sera remboursée." }).variables[5] === "Cette avance vous sera remboursée.", texteVa);
  test("★ sans numéro, sans montant ou sans motif : rien ne part (jamais un trou vide)",
    M.envoiDepenseRejetee({ employe: "X", tel: "", dep: { montant: 1000 }, motif: "m", suite: "s" }) === null
    && M.envoiDepenseRejetee({ employe: "X", tel: "90112233", dep: { montant: 0 }, motif: "m", suite: "s" }) === null
    && M.envoiDepenseRejetee({ employe: "X", tel: "90112233", dep: { montant: 1000 }, motif: " . ", suite: "s" }) === null
    && M.envoiDepenseValidee({ employe: "", tel: "90112233", dep: { montant: 1000 }, suite: "s" }) === null);
  test("★★ « A a » : le message de 💬 Messages part toujours, avec LA MÊME suite que le WhatsApp (suiteRejetDepense, écrite une fois)",
    rj.interne?.length === 1 && rj.interne[0].a_id === "KOSSI" && rj.interne[0].texte.includes("Cet argent reste dû à la caisse de APESSITO")
    && va.interne?.length === 1 && /return `Cet argent reste dû/.test(lire("src/lib/validationDepenses.js")) && /const suite = ` \$\{suiteRejetDepense\(dep\)\}`;/.test(lire("src/lib/validationDepenses.js")));
  test("★★ « B a » : la ligne RANGÉE ne porte ni montant ni motif — une phrase neutre, la marque privée et le lien vers la dépense",
    rj.rangee?.wa_prive === true && rj.rangee.depense_id === "DEP1" && /^🔒 Avis de dépense rejetée envoyé/.test(rj.rangee.texte || "")
    && !/12 000|essence|Carburant|tricycle/.test(rj.rangee.texte || "") && va.rangee?.wa_prive === true && /^🔒 Avis de dépense validée/.test(va.rangee.texte || ""));
  test("★★ le détail RECOMPOSÉ par 📲 WhatsApp sur la dépense APRÈS la décision (montant 0, « ✖ REJETÉE (…) — » devant) = ce qui est parti",
    !!rj.detail && rj.detail === rj.attendu && !!va.detail && va.detail === va.attendu && /Motif : Pas de bon d'essence/.test(rj.detail), `${rj.detail} ≠ ${rj.attendu}`);
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const D = sansComm(lire("src/screens/Depenses.jsx"));
  const corpsAvis = (D.match(/const avisDecisionWhatsApp = async[\s\S]*?\n  \};/) || [""])[0];
  test("★★ l'écran : valider ET rejeter envoient l'avis APRÈS l'enregistrement, sans question ni repli (envoyerRecuSansQuestion), la ligne porte depense_id",
    /save\(\{ \.\.\.db, depenses: r\.depenses, messages: \[\.\.\.r\.messages, \.\.\.\(db\.messages \|\| \[\]\)\] \}, r\.journal\);\s*await avisDecisionWhatsApp\(d, "validee"\);/.test(D)
    && /save\(\{ \.\.\.db, depenses: r\.depenses, messages: \[\.\.\.r\.messages, \.\.\.\(db\.messages \|\| \[\]\)\] \}, r\.journal\);\s*await avisDecisionWhatsApp\(d, "rejetee", String\(motif\)\.trim\(\)\);/.test(D)
    && /envoyerRecuSansQuestion\(\{ envoi, tel: auteur\.tel,[^)]*ref: \{ depense_id: d\.id \}/.test(corpsAvis) && !/envoyerModele\(/.test(corpsAvis)
    && /ref && ref\.depense_id \? \{ depense_id: ref\.depense_id \}/.test(lire("src/whatsapp.js")));
  test("★★ le mur : le compte de l'auteur OU la caisse de la dépense en formation → rien ne part ; jamais à soi-même",
    /const formation = estCompteFormation\(db, auteur\) \|\| !!\(db\.boutiques \|\| \[\]\)\.find\(\(b\) => b\.nom === d\.boutique\)\?\.formation;/.test(corpsAvis)
    && /espaceFormation: formation/.test(corpsAvis) && /if \(!auteur \|\| auteur\.id === profile\.id\) return;/.test(corpsAvis));
  test("★ sans numéro sur la fiche (en réel), l'écran le DIT ; en formation, il se tait",
    /if \(!envoi\) \{\s*if \(!formation\) uAlert\(`📲 Aucun avis WhatsApp : la fiche de \$\{auteur\.nom\} n'a pas de numéro/.test(corpsAvis));
}

{
  titre("53 ✅ L'AVIS WHATSAPP D'UNE TÂCHE ASSIGNÉE ET VALIDÉE (14/10/2026, « A c, B b, C b, texte ok »)");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  let A = null;
  try { A = V.avisTache(); } catch (e) { A = null; console.error(e); }
  const as = A?.assignee || {}, va = A?.validee || {};
  const remplir = (e, t) => (e ? e.variables.reduce((x, v, i) => x.split(`{{${i + 1}}}`).join(v), t) : "");
  test("★★ « texte ok » : la tâche assignée = le texte accepté par Timo, cinq trous dans l'ordre (personne, qui confie, tâche, détails, échéance)",
    remplir(as.envoi, M.TEXTE_TACHE_ASSIGNEE) === "Bonjour KOSSI Mensah, TIMO vous a confié une nouvelle tâche BMI TOGO : Visiter le chantier de MR ERIC. Détails : Vérifier les panneaux. Échéance : 16/10/2026. Retrouvez-la dans l'application BMI, onglet « Mes tâches ». BMI TOGO",
    remplir(as.envoi, M.TEXTE_TACHE_ASSIGNEE));
  test("★★ « A c » : la validation part aussi, trois trous (personne, qui valide, tâche)",
    remplir(va.envoi, M.TEXTE_TACHE_VALIDEE) === "Bonjour KOSSI Mensah, TIMO a validé votre tâche BMI TOGO : Visiter le chantier de MR ERIC. Merci pour votre travail. Détails dans l'application BMI, onglet « Mes tâches ». BMI TOGO",
    remplir(va.envoi, M.TEXTE_TACHE_VALIDEE));
  const sansDetail = M.envoiTacheAssignee({ employe: "X", tel: "90112233", tache: { titre: "T.", par: "TIMO" } });
  const auto = M.envoiTacheAssignee({ employe: "X", tel: "90112233", tache: { titre: "🔧 Entretien", auto: "entretien", par: "Rappel automatique BMI", echeance: "2026-10-20" }, dFR: (x) => x.split("-").reverse().join("/") });
  test("★ jamais un trou vide : détails « aucun », échéance « aucune date fixée » ; « B b » une tâche automatique est confiée par « le rappel automatique de BMI TOGO » ; sans numéro, rien",
    sansDetail?.variables.join("|") === "X|TIMO|T|aucun|aucune date fixée"
    && auto?.variables[1] === M.PAR_TACHE_AUTOMATIQUE && auto?.variables[4] === "20/10/2026"
    && M.envoiTacheAssignee({ employe: "X", tel: "", tache: { titre: "T" } }) === null
    && M.envoiTacheValidee({ employe: "X", tel: "90112233", tache: { titre: "T" } }) === null);
  test("★★ « C b » : la ligne RANGÉE ne porte ni la tâche ni ses détails — phrase neutre, marque privée, lien vers la tâche",
    as.rangee?.wa_prive === true && as.rangee.tache_user_id === "TECH1" && as.rangee.tache_id === "T1"
    && /^🔒 Avis de tâche assignée envoyé/.test(as.rangee.texte || "") && !/ERIC|panneaux/.test(as.rangee.texte || "")
    && va.rangee?.wa_prive === true && /^🔒 Avis de tâche validée/.test(va.rangee.texte || ""));
  test("★★ le détail RECOMPOSÉ par 📲 WhatsApp depuis la tâche de la fiche = ce qui est parti",
    !!as.detail && as.detail === as.attendu && !!va.detail && va.detail === va.attendu, `${as.detail} ≠ ${as.attendu}`);
  const C = sansComm(lire("src/lib/calculs.js"));
  const corps = (C.match(/export async function envoyerAvisTache[\s\S]*?\n\}/) || [""])[0];
  test("★★ UNE fonction (envoyerAvisTache) : jamais à soi-même, le mur (formation, désactivé, bloqué), sans question ni repli, la ligne porte la tâche",
    /if \(!fiche \|\| !tache \|\| fiche\.id === profile\?\.id\) return "";/.test(corps)
    && /if \(estCompteFormation\(db, fiche\) \|\| fiche\.actif === false \|\| fiche\.bloque\) return "";/.test(corps)
    && /envoyerRecuSansQuestion\(/.test(corps) && /ref: \{ tache_user_id: fiche\.id, tache_id: tache\.id \}/.test(corps)
    && /ref && ref\.tache_id \? \{ tache_user_id: ref\.tache_user_id, tache_id: ref\.tache_id \}/.test(lire("src/whatsapp.js")));
  const ME = sansComm(lire("src/screens/MonEquipe.jsx"));
  const rouvrir = (ME.match(/const rouvrirTache = async[\s\S]*?\n  \};/) || [""])[0];
  test("★★ 👑 Mon équipe : l'avis part APRÈS l'assignation et APRÈS la validation — pas à la réouverture (« A c »)",
    /`Tâche assignée à \$\{st\.u\.nom\} : \$\{titre\.trim\(\)\}`\);\s*\/\/[^\n]*\n\s*const avis = await envoyerAvisTache\(\{ db, save, profile, membre: st\.u, tache \}\);/.test(lire("src/screens/MonEquipe.jsx"))
    && /validée par \$\{profile\.nom\} : \$\{tv\.titre\}`\);\s*const avis = await envoyerAvisTache\(\{ db, save, profile, membre: tv\.membre, tache: \{ \.\.\.tv, valide_par: profile\.nom \}, valide: true \}\);/.test(ME)
    && !!rouvrir && !/envoyerAvisTache/.test(rouvrir));
  test("★ 🏠 « Entretien fait » : la tâche automatique validée prévient qui la portait (sans relire db.users une fois de plus)",
    /aPrevenir\.push\(\{ membre: u, tache: v \}\);/.test(lire("src/screens/ClientsInstalles.jsx"))
    && /for \(const \{ membre, tache \} of aPrevenir\) \{\s*const a = await envoyerAvisTache\(\{ db, save, profile, membre, tache, valide: true \}\);/.test(lire("src/screens/ClientsInstalles.jsx")));
  const RE = await import("../src/lib/rappelEntretien.js");
  const tacheAuto = RE.tacheEntretien({ id: "TA", chantier: { id: "C1", nom: "ERIC", date_entretien: "2026-10-20", type_installation: "Solaire" }, aujourdhui: "2026-10-14" });
  const dbM = { users: [], boutiques: [{ nom: "DFORMATION", formation: true }] };
  const reel = { id: "U1", nom: "KOSSI", role: "technicien", tel: "90445566" };
  test("★★ « B b » serveur : la tâche d'entretien part par tache_assignee ; jamais un compte de formation, désactivé, bloqué ou sans numéro",
    RE.avisTacheEntretien(dbM, reel, tacheAuto)?.envoi?.modele === "tache_assignee"
    && RE.avisTacheEntretien(dbM, { ...reel, formation: true }, tacheAuto) === null
    && RE.avisTacheEntretien(dbM, { ...reel, actif: false }, tacheAuto) === null
    && RE.avisTacheEntretien(dbM, { ...reel, bloque: true }, tacheAuto) === null
    && RE.avisTacheEntretien(dbM, { ...reel, tel: "" }, tacheAuto) === null);
  const lig = RE.ligneAvisTache({ id: "L1", tel: "+22890445566", membre: reel, tache: tacheAuto, ts: "2026-10-14T07:00:00Z" });
  const SRV = sansComm(lire("api/rappels-du-matin.js"));
  const corpsSrv = (SRV.match(/async function avertirDeLaTache[\s\S]*?\n\}/) || [""])[0];
  test("★★ serveur : la ligne est PRIVÉE, et rien n'est écrit tant que WhatsApp n'a pas accepté ; l'avis suit la tâche ÉCRITE",
    lig?.wa_prive === true && lig.tache_id === "TA" && lig.tache_user_id === "U1" && !/ERIC/.test(lig.texte)
    && corpsSrv.indexOf("envoyerYCloud(") > 0 && corpsSrv.indexOf("if (!envoi.ok)") > corpsSrv.indexOf("envoyerYCloud(")
    && corpsSrv.indexOf('from("messages").insert') > corpsSrv.indexOf("if (!envoi.ok)")
    // RETOURNÉ le 16/10/2026 : la notification porte la tâche (un clic l'ouvre).
    && /notifications\.push\(notificationTache\(\{ pour: r\.pour, chantier: r\.chantier, tache \}\)\);[\s\S]{0,400}await avertirDeLaTache\(admin, db, \{ \.\.\.frais\.data, id: frais\.id \}, tache, bilan\);/.test(SRV));
}

{
  titre("54 📄 L'ATTESTATION DE FIN DE CONTRAT DISPONIBLE, PUIS L'ACCÈS FERMÉ À 24 H (14/10/2026, « A a CDI, b CDD, B b, C ok, D oui »)");
  const AS = await import("../src/lib/attestationSortie.js");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★ le texte du modèle, UTILITY, ses cinq trous DANS L'ORDRE, « ce document » (une attestation est féminine)",
    M.MODELES.attestation_disponible?.categorie === "utility" && M.MODELES_EN_SERVICE.includes("attestation_disponible")
    && /^Bonjour \{\{1\}\}, votre \{\{2\}\} BMI TOGO est disponible dans votre espace sur https:\/\/gestion\.bmitogo\.com\. Téléchargez ce document avant le \{\{3\}\} à \{\{4\}\} : votre accès sera fermé à ce moment-là\. Pour toute question : \{\{5\}\}\. BMI TOGO$/.test(M.TEXTE_ATTESTATION_DISPONIBLE)
    && JSON.stringify((M.TEXTE_ATTESTATION_DISPONIBLE.match(/\{\{\d+\}\}/g) || [])) === JSON.stringify(["{{1}}", "{{2}}", "{{3}}", "{{4}}", "{{5}}"]));
  let A = null;
  try { A = V.avisAttestation(); } catch (e) { A = null; console.error(e); }
  test("★★ les trous : le nom, le document en minuscules, la fermeture 24 h après (heure de Lomé), le numéro BMI ; sans numéro, rien",
    JSON.stringify(A?.envoi?.variables) === JSON.stringify(["FRED Akakpo", "attestation de stage", "15/10/2026", "11:05", M.NUMERO_BMI_PRINCIPAL])
    && M.envoiAttestationDisponible({ employe: "FRED", tel: "", document: "Certificat de travail", date: "15/10/2026", heure: "11:05" }) === null
    && M.critiqueModele("attestation_disponible", A?.envoi?.variables || []) === "");
  test("★★ « C » la ligne RANGÉE est PRIVÉE et neutre ; le détail se recompose depuis la fiche (même fabrique que l'envoi)",
    A?.rangee?.wa_prive === true && A.rangee.attestation_user_id === "EMP9" && !/15\/10\/2026|stage/.test(A.rangee.texte || "")
    && !!A.detail && A.detail === A.attendu);
  // La règle.
  const u = { id: "E1", nom: "FRED", role: "vendeur", cnss_code_type: 5, cnss_date_embauche: "2025-01-02", cnss_date_sortie: "2026-10-14" };
  const db = { users: [u, { ...u, id: "E2", cnss_code_type: 1 }, { ...u, id: "E3", cnss_code_type: 12 }, { ...u, id: "E4", formation: true }, { ...u, id: "E5", cnss_date_sortie: "2026-10-20" }, { ...u, id: "E6", role: "client" }], boutiques: [] };
  test("★★ « A b » la tournée met à disposition d'elle-même un CDD, un stage, un apprentissage dont la sortie est arrivée — jamais un CDI (« A a » : le clic), une sortie à venir, un client ni la formation",
    AS.aMettreADispositionAuto(db, "2026-10-14").map((x) => x.id).join(",") === "E1,E3");
  const m = AS.construireMiseADisposition({ u, par: { id: "P", nom: "TIMO" }, maintenant: Date.parse("2026-10-14T07:00:00.000Z"), auto: true });
  const avecM = { ...u, attestation_sortie: m };
  test("★★ 24 h exactement, à l'heure donnée : ouvert 1 minute avant, fermé à l'heure ; la tournée ferme dès 15 min avant (elle ne passe qu'à 7 h)",
    m.ferme_le === "2026-10-15T07:00:00.000Z" && AS.enPeriodeDeSortie(avecM, Date.parse("2026-10-15T06:59:00Z")) && !AS.accesFerme(avecM, Date.parse("2026-10-15T06:59:00Z"))
    && AS.accesFerme(avecM, Date.parse("2026-10-15T07:00:00Z")) && !AS.enPeriodeDeSortie(avecM, Date.parse("2026-10-15T07:00:00Z"))
    && AS.comptesAFermer({ users: [avecM] }, Date.parse("2026-10-15T06:50:00Z")).length === 1 && AS.comptesAFermer({ users: [avecM] }, Date.parse("2026-10-15T06:30:00Z")).length === 0
    && AS.comptesAFermer({ users: [{ ...avecM, actif: false }] }, Date.parse("2026-10-16T07:00:00Z")).length === 0);
  test("★ une fois mise à disposition, pas deux ; il faut l'embauche et la sortie arrivée ; un client, jamais",
    /déjà à sa disposition/.test(AS.critiqueMiseADisposition(avecM, "2026-10-14")) && AS.critiqueMiseADisposition(u, "2026-10-14") === ""
    && /date d'embauche/.test(AS.critiqueMiseADisposition({ ...u, cnss_date_embauche: "" }, "2026-10-14"))
    && /date de sortie/.test(AS.critiqueMiseADisposition({ ...u, cnss_date_sortie: "2026-10-20" }, "2026-10-14"))
    && /personnel/.test(AS.critiqueMiseADisposition({ ...u, role: "client" }, "2026-10-14")));
  // Le serveur : la connexion, la session, la tournée.
  const CC = sansComm(lire("api/chercher-compte.js")), SA = sansComm(lire("api/sync-auth.js")), TS = sansComm(lire("api/_attestationSortie.js"));
  test("★★ le SERVEUR refuse la connexion (chercher-compte) et la session sécurisée (sync-auth) après la fermeture, à SON heure",
    /if \(accesFerme\(champs, Date\.now\(\)\)\) \{\s*return res\.status\(403\)\.json\(\{ error: messageAccesFerme\(champs\) \}\);/.test(CC)
    && /if \(accesFerme\(champs, Date\.now\(\)\)\) \{\s*return res\.status\(403\)\.json\(\{ error: messageAccesFerme\(champs\) \}\);/.test(SA));
  test("★★ la tournée : la fiche RELUE avant d'écrire, la marque posée AVANT le message (« D oui » : sans numéro, elle est posée quand même), rien dans le fil tant que WhatsApp n'a pas accepté ; les accès fermés en actif: false",
    TS.indexOf('from("users").select("id, data")') > 0 && TS.indexOf("attestation_sortie: marque") > TS.indexOf('from("users").select("id, data")')
    && TS.indexOf("envoyerYCloud(") > TS.indexOf("attestation_sortie: marque")
    && TS.indexOf('from("messages").insert') > TS.indexOf("if (!r.ok)")
    && /if \(!envoi\) bilan\.sans_numero\+\+;/.test(TS) && /actif: false, ferme_apres_sortie_le: ts/.test(TS)
    && /const attestations = await attestationsEtFermetures\(admin, db, aujourdhui\);/.test(sansComm(lire("api/rappels-du-matin.js")))
    && /\.\.\.attestations\.notifications/.test(sansComm(lire("api/rappels-du-matin.js"))));
  const UT = sansComm(lire("src/screens/Utilisateurs.jsx"));
  const geste = (UT.match(/const mettreADisposition = async[\s\S]*?\n  \};/) || [""])[0];
  test("★★ « A a » le geste : l'administrateur PRINCIPAL d'abord, la fiche FRAÎCHE revérifiée, la marque écrite AVANT l'envoi, sans repli ; jamais en formation",
    geste.indexOf("refuserSaufAdminPrincipal(") > 0 && geste.indexOf("critiqueMiseADisposition(frais, today())") > geste.indexOf("refuserSaufAdminPrincipal(")
    && geste.indexOf("attestation_sortie: marque") > 0 && geste.indexOf("envoyerRecuSansQuestion(") > geste.indexOf("attestation_sortie: marque")
    && /const envoi = formation \? null : envoiAttestationDisponible\(/.test(geste) && /ref: \{ attestation_user_id: frais\.id \}/.test(geste)
    && /maintenant: maintenantMs\(\)/.test(geste));
  const APP = sansComm(lire("src/App.jsx")), CNX = sansComm(lire("src/screens/Connexion.jsx"));
  test("★★ « B b » pendant les 24 h, l'employé n'a QUE « 📄 Mon attestation » ; l'application ferme la session à la minute (revérifiée chaque minute), refuse la connexion et la reprise après F5",
    /const enSortie = !isClient && enPeriodeDeSortie\(maFiche, maintenantMs\(\)\);/.test(APP) && /const contenu = enSortie \? <MonAttestation db=\{db\} profile=\{profile\} \/>/.test(APP)
    && /if \(accesFerme\(moi, maintenantMs\(\)\)\) \{ fermer\(/.test(APP) && /setInterval\(\(\) => \{ if \(accesFerme\(moi, maintenantMs\(\)\)\)/.test(APP)
    && /if \(accesFerme\(u, maintenantMs\(\)\)\) \{ setErr\(messageAccesFerme\(u\)\); return; \}/.test(CNX));
  test("★ réactiver un compte fermé le ROUVRE : la marque passe dans l'historique (null, jamais un champ retiré)",
    /attestation_sortie: null, attestations_passees: \[\.\.\.\(x\.attestations_passees \|\| \[\]\), x\.attestation_sortie\]/.test(UT));
  const MA = sansComm(lire("src/screens/MonAttestation.jsx"));
  test("★ l'écran « 📄 Mon attestation » refait le document signé de celui qui l'a mis à disposition (la règle commune), et dit l'heure de fermeture",
    /contenuDocument\(a\.type, \{/.test(MA) && /\(db\.users \|\| \[\]\)\.find\(\(u\) => u\.id === a\.par_id\)/.test(MA) && /imprimerDocumentEmploye\(contenu, db,/.test(MA) && /data-fermeture-acces/.test(MA));
  const S39 = lire("supabase/securite-39-attestation-sortie.sql");
  test("★ LE COUPLE : securite-39 réserve la marque à l'administrateur (et reprend securite-38 : le sexe y est toujours)",
    /'attestation_sortie', 'attestations_passees', 'ferme_apres_sortie_le'/.test(S39) && /Modifier le sexe/.test(S39) && /'affectation'/.test(S39));
}

// ──────────────────────────────────────────────────────────────
titre("55 📎 LE DEVIS AVEC SON PDF — `devis_pdf`, la case « Joindre le PDF du devis » (17/10/2026, « A a, B a, C a »)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★ `devis_pdf` : UTILITY (RETOURNÉ le 17/10/2026 — soumis en marketing, Meta l'a rangé en utility), les TROIS trous de devis_disponible dans le même ordre, et un EN-TÊTE DOCUMENT (RETOURNÉ le 19/10/2026 : le reçu et la proforma en portent un aussi, et eux seuls)",
    M.MODELES.devis_pdf?.categorie === "utility" && M.MODELES.devis_pdf.variables.join(",") === M.MODELES.devis_disponible.variables.join(",")
    && M.modeleAvecDocument("devis_pdf") === true && M.NOMS_MODELES.filter((n) => M.modeleAvecDocument(n)).join(",") === "devis_pdf,recu_pdf,proforma_pdf"
    && M.MODELES_EN_SERVICE.includes("devis_pdf"));
  test("★ le texte du modèle (celui à créer chez YCloud) : trois trous dans l'ordre, la pièce jointe et l'espace client dits",
    (M.TEXTE_DEVIS_PDF.match(/\{\{\d\}\}/g) || []).join("") === "{{1}}{{2}}{{3}}" && /pièce jointe/.test(M.TEXTE_DEVIS_PDF) && /gestion\.bmitogo\.com/.test(M.TEXTE_DEVIS_PDF));
  test("★ « pour toute question ou tout éclaircissement » : l'e-mail, les deux numéros et le site de BMI sont sous le texte (Timo, 17/10/2026), dans le bloc commun",
    /Pour toute question ou tout éclaircissement :\n📧 contact@bmitogo\.com\n📞 \+228 99 96 84 88 \/ \+228 91 13 05 11\n🌐 www\.bmitogo\.com\n\nBMI TOGO — Les bâtiments modernes et intelligents$/.test(M.TEXTE_DEVIS_PDF)
    // RETOURNÉ le 19/10/2026 : les textes du reçu et de la proforma PDF suivent celui du devis.
    && /export const TEXTE_DEVIS_PDF = \[[^\]]*\.\.\.BLOC_CONTACT_COURT,\n\]\.join\("\\n"\);/.test(lire("src/lib/whatsappModeles.js")));
  const dv = { id: "DV1", total: 1250000, domaine: "solaire", date: "2026-10-17" };
  const sans = M.envoiDevisDisponible({ devis: dv, compte: { nom: "AMA" }, fmt });
  const avec = M.envoiDevisDisponible({ devis: dv, compte: { nom: "AMA" }, fmt, avecPdf: true });
  test("★★ « A a » : sans la case, le modèle d'avant (`devis_disponible`) ; avec la case, `devis_pdf` — les MÊMES trois mots",
    sans?.modele === "devis_disponible" && avec?.modele === "devis_pdf" && JSON.stringify(sans.variables) === JSON.stringify(avec.variables) && sans.variables.length === 3);
  test("★★ un `devis_pdf` SANS fichier est refusé avant tout appel (le client lirait « en pièce jointe » sans pièce jointe)",
    M.critiqueEnvoiAuto({ modele: "devis_pdf", variables: avec.variables, tel: "90112233" }) === M.MOTIF_PDF_MANQUANT
    && M.critiqueEnvoiAuto({ modele: "devis_pdf", variables: avec.variables, tel: "90112233", avecDocument: true }) === ""
    && M.critiqueEnvoiAuto({ modele: "devis_disponible", variables: sans.variables, tel: "90112233" }) === "");
  test("★ la ligne du fil dit que le PDF est joint ; jamais « livré » ni « lu »",
    /📎 PDF joint/.test(M.ligneEnvoiModele("devis_pdf", avec.variables)) && M.ligneEnvoiModele("devis_pdf", avec.variables).startsWith(M.PREFIXE_LIGNE_ENVOI) && !/livr|lu\b/.test(M.ligneEnvoiModele("devis_pdf", avec.variables)));
  test("★★ « B a » : la phrase d'après dit si le PDF est parti — sinon POURQUOI, et que le message habituel est parti à sa place",
    /avec le PDF du devis/.test(M.messageDevisEnvoye("AMA", true, { pdfDemande: true, pdf: true }))
    && /Le PDF n'est pas parti : pas encore approuvé[\s\S]*sans PDF/.test(M.messageDevisEnvoye("AMA", true, { pdfDemande: true, pdf: false, motifPdf: "pas encore approuvé" }))
    && !/PDF/.test(M.messageDevisEnvoye("AMA", true)));
  // ── La porte YCloud et le serveur
  const Y5 = await import("../api/_ycloud.js");
  test("★★ l'en-tête document cite le fichier DÉPOSÉ par son numéro, avec le nom que le client verra",
    JSON.stringify(Y5.composantDocument("M7", "Devis - AMA - 12.pdf")) === JSON.stringify({ type: "header", parameters: [{ type: "document", document: { id: "M7", filename: "Devis - AMA - 12.pdf" } }] }));
  const api = sansComm(lire("api/whatsapp.js"));
  test("★★ le serveur : un modèle à en-tête document exige un PDF (refus sinon), le DÉPOSE, et pose l'en-tête AVANT le corps ; un autre modèle ignore un fichier",
    /const enteteDocument = !!modele && modeleAvecDocument\(modele\);/.test(api) && /if \(fichier && \(!modele \|\| enteteDocument\)\)/.test(api)
    && /if \(enteteDocument && \(piece\.mime !== "application\/pdf"/.test(api) && /if \(enteteDocument && !piece\) return res\.status\(400\)\.json\(\{ error: MOTIF_PDF_MANQUANT \}\);/.test(api)
    && /if \(enteteDocument\) composants\.unshift\(composantDocument\(depot\.id, piece\.nom\)\);/.test(api) && /components: composants,/.test(api)
    && api.indexOf("televerserYCloud(cle, expediteur, piece)") < api.indexOf("envoyerYCloud(cle, corps)"));
  const SW = sansComm(lire("src/whatsapp.js"));
  test("★ l'application transmet le fichier au serveur et le compte dans le refus local (aucun fichier rangé)",
    /avecDocument: !!fichier/.test(SW) && /\.\.\.\(fichier \? \{ fichier: \{ nom: fichier\.nom, mime: fichier\.mime, donnees: fichier\.donnees \} \} : \{\}\)/.test(SW));
  // ── Le volet du devis
  const PA = sansComm(lire("src/screens/dimensionnement/Partages.jsx"));
  const corpsEnvoi = (PA.match(/export async function envoyerDevisEtOuvrirWhatsApp[\s\S]*?\n\}/) || [""])[0];
  test("★★ « B a » : le PDF est essayé APRÈS les accès, SANS repli ; s'il ne part pas, le devis part par `devis_disponible` avec son repli ; jamais en formation",
    /const pdf = avecPdf && accesPartis && !espaceFormation/.test(corpsEnvoi)
    && corpsEnvoi.indexOf("await envoyerPdfDuDevis(") > corpsEnvoi.indexOf("accesPartis")
    && /const envoi = envoiDevisDisponible\(\{ devis: devisMarque, compte, fmt, avecPdf: !!pdf\.r \}\);/.test(corpsEnvoi)
    && /const r = pdf\.r \|\| await envoyerModele\(\{/.test(corpsEnvoi)
    && /sansRepli: true, fichier \}\)/.test(PA));
  test("★ le PDF joint est celui de « 📄 Devis PDF » (LA fabrique de 📋 Tous les devis), chargée à la demande",
    /const \{ fichierPdfDuDevis \} = await import\("\.\.\/TousLesDevis"\);/.test(PA) && /export function fichierPdfDuDevis\(db, d\)/.test(sansComm(lire("src/screens/TousLesDevis.jsx"))));
  test("★ la case vit dans le hook : COCHÉE au départ (RETOURNÉ le 23/10/2026, « cocher joindre pdf par défaut »), recochée après chaque devis, passée aux trois volets",
    /const \[avecPdf, setAvecPdf\] = useState\(true\);/.test(PA) && /setAvecPdf\(true\);/.test(PA) && !/setAvecPdf\(false\);/.test(PA) && /idAReprendre: idRemplace, avecPdf,/.test(PA)
    && ["Solaire", "Garage", "Autre"].every((v) => /avecPdf=\{envoi\.avecPdf\} setAvecPdf=\{envoi\.setAvecPdf\}/.test(lire(`src/screens/dimensionnement/${v}.jsx`))));
  // ── « C a » : ✍️ Compléter le devis
  const TD = sansComm(lire("src/screens/TousLesDevis.jsx"));
  const corpsComp = (TD.match(/const completerEtEnvoyer = async[\s\S]*?\n  \};/) || [""])[0];
  test("★★ « C a » : ✍️ Compléter le devis a la même case, et suit la même règle (PDF du devis COMPLÉTÉ d'abord, sinon le message habituel)",
    /onEnregistrer\(\{ reponses, ajouts, avecPdf \}\)/.test(lire("src/components/CompleterDevis.jsx")) && /const \[avecPdf, setAvecPdf\] = useState\(true\);/.test(lire("src/components/CompleterDevis.jsx"))
    && /const pdf = saisie\.avecPdf && !espaceFormation/.test(corpsComp) && /devisMarque: res\.devis/.test(corpsComp)
    && /avecPdf: !!pdf\.r \}\);/.test(corpsComp) && /const r = pdf\.r \|\| await envoyerModele\(\{/.test(corpsComp));
  // ── La case RENDUE
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const entree = join("node_modules", ".cache", `bmi-pdf-devis-entree-${process.pid}.jsx`);
  const sortie5 = join("node_modules", ".cache", `bmi-pdf-devis-${process.pid}.mjs`);
  writeFileSync(entree, `export { BlocEnvoiDevisClient } from "${process.cwd()}/src/screens/dimensionnement/Partages.jsx";\nexport { CompleterDevis } from "${process.cwd()}/src/components/CompleterDevis.jsx";\n`);
  let R = null;
  try {
    await build({ entryPoints: [entree], bundle: true, format: "esm", platform: "node", outfile: sortie5, logLevel: "silent",
      jsx: "automatic", loader: { ".js": "jsx" }, define: { "import.meta.env": '{"VITE_SUPABASE_URL":"https://exemple.supabase.co","VITE_SUPABASE_ANON_KEY":"x","MODE":"test"}' }, external: ["react", "react-dom", "react-dom/server"] });
    R = await import(pathToFileURL(sortie5).href);
  } catch {}
  try { unlinkSync(sortie5); unlinkSync(entree); } catch {}
  const rendre = (extra) => { const e0 = console.error; console.error = () => {}; try { return String(renderToStaticMarkup(React.createElement(R.BlocEnvoiDevisClient, { db: { users: [], ventes: [], dettes: [], commandes: [], clients_installes: [], boutiques: [] }, clientDevis: "", setClientDevis() {}, nouvClient: { nom: "", prenom: "", tel: "", entreprise: null }, setNouvClient() {}, comptesClients: [], onEnvoyer() {}, onBrouillon() {}, profile: { id: "a", nom: "TIMO", role: "admin", signature_personnelle: "x" }, ...extra }))); } catch (e) { return ""; } finally { console.error = e0; } };
  const hDecoche = R ? rendre({ avecPdf: false, setAvecPdf() {} }) : "";
  const hCoche = R ? rendre({ avecPdf: true, setAvecPdf() {} }) : "";
  const hSans = R ? rendre({}) : "";
  const caseDe = (h) => (h.match(/data-joindre-pdf[\s\S]*?<input[^>]*>/) || [""])[0];
  test("★★ l'écran RENDU : « 📎 Joindre le PDF du devis » est là, elle montre l'état que le hook lui donne (décochée / cochée) ; sans le hook (📝 Mes brouillons), pas de case",
    /📎 Joindre le PDF du devis/.test(hDecoche) && caseDe(hDecoche) !== "" && !/checked/.test(caseDe(hDecoche)) && /checked/.test(caseDe(hCoche))
    && hSans !== "" && !/data-joindre-pdf/.test(hSans));
  const hComp = (() => { if (!R) return ""; const e0 = console.error; console.error = () => {}; try { return String(renderToStaticMarkup(React.createElement(R.CompleterDevis, { devis: { id: "D", total: 100, lignes: [{ designation: "Câble", cf_visite: true, qte: 1, pu: 0 }] }, produits: [], onAnnuler() {}, onEnregistrer() {} }))); } catch (e) { return ""; } finally { console.error = e0; } })();
  test("★ ✍️ Compléter le devis RENDU : la case est là, COCHÉE d'office (RETOURNÉ le 23/10/2026)",
    /📎 Joindre le PDF du devis/.test(hComp) && /checked/.test(caseDe(hComp)));
}

titre("56 🤖 L'ASSISTANT RELANCE LE CLIENT QUI S'EST TU, ~20 H APRÈS, DANS LA FENÊTRE DE 24 H (17/10/2026, « 4 a, le reste ok, lance »)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const RA = await import("../src/lib/relanceAssistant.js");
  const AW = await import("../src/lib/assistantWhatsapp.js");
  const H = 3600e3;
  const maintenant = "2026-10-17T12:00:00.000Z";
  const il = (h) => new Date(Date.parse(maintenant) - h * H).toISOString();
  const CLE = "90112233";
  const ent = (h, texte = "Je veux électrifier ma maison") => ({ id: `e${h}`, canal: "whatsapp", wa_tel: CLE, wa_entrant: true, ts: il(h), texte });
  const ia = (h, extra = {}) => ({ ...AW.ligneAssistant({ cle: CLE, tel: "22890112233", nom: "", texte: "Combien d'ampoules ?", etape: "ia", ts: il(h), ia: true }), ...extra });
  const emp = (h) => ({ id: `p${h}`, canal: "whatsapp", wa_tel: CLE, wa_entrant: false, de_id: "u-angele", de_nom: "ANGELE", ts: il(h), texte: "Bonjour" });
  const dec = (fil, proprietaireId = "") => RA.relanceAFaire({ fil, maintenant, proprietaireId });

  test("★★ 20 h après le dernier message du client, l'IA ayant parlé en dernier : la relance est à faire (et sa marque = les chiffres de l'heure du client)",
    dec([ent(21), ia(20.9)]).relancer === true && dec([ent(21), ia(20.9)]).marque === il(21).replace(/\D/g, "").slice(0, 17));
  test("★ avant la 20e heure : rien (19 h 59)", dec([ent(19.99), ia(19.9)]).relancer === false && /moins de 20 h/.test(dec([ent(19.99), ia(19.9)]).pourquoi));
  test("★★ jamais après la fenêtre de Meta, ni dans son dernier quart d'heure (23 h 50 : non ; 23 h 40 : oui)",
    dec([ent(23.84), ia(23.8)]).relancer === false && dec([ent(23.67), ia(23.6)]).relancer === true && dec([ent(30), ia(29)]).relancer === false);
  test("★★ UNE seule relance par demande : après une relance, plus rien tant que le client n'a pas réécrit",
    dec([ent(22), ia(21.9), ia(1, { wa_assistant: { etape: "ia", ia: true, relance: true } })]).relancer === false
    && /une seule relance/.test(dec([ent(22), ia(21.9), ia(1, { wa_assistant: { etape: "ia", ia: true, relance: true } })]).pourquoi));
  test("★ le client réécrit APRÈS la relance : un nouveau cycle peut repartir 20 h plus tard",
    dec([ent(45, "a"), ia(44.9), ia(25, { wa_assistant: { etape: "ia", ia: true, relance: true } }), ent(21), ia(20.9)]).relancer === true);
  test("★★ il se tait : conversation confiée à une personne", dec([ent(21), ia(20.9)], "u-com1").relancer === false);
  test("★★ il se tait : un EMPLOYÉ a écrit dans les dernières 24 h (avant comme après le client)",
    dec([emp(23), ent(21), ia(20.9)]).relancer === false && dec([ent(21), emp(20.5)]).relancer === false);
  test("★★ « 4 a » : une demande de devis ENREGISTRÉE ne se relance pas (l'assistant est passé à l'étape conseiller) ; un conseiller demandé non plus",
    dec([ent(21), ia(20.9, { wa_assistant: { etape: AW.ETAPE_CONSEILLER, ia: true } })]).relancer === false
    && /demande de devis est enregistrée/.test(dec([ent(21), ia(20.9, { wa_assistant: { etape: AW.ETAPE_CONSEILLER, ia: true } })]).pourquoi));
  test("★★ « 5 » : l'assistant à MENU (ligne sans `ia`) ne relance pas", dec([ent(21), ia(20.9, { wa_assistant: { etape: "menu" } })]).relancer === false);
  test("★ l'assistant n'a pas répondu au dernier message : pas de relance", dec([ent(21)]).relancer === false);
  // ── (22/10/2026, « a, lance ») rien à reprendre, rien ne part
  // ⚠ (précision de Timo le même jour) : on ne se tait que si PERSONNE n'a parlé d'un sujet concret
  const N = (h) => ia(h, { texte: "Très bien ! Dites-moi, de quoi avez-vous besoin exactement ?" });
  test("★★★ le cas de Timo : rien de concret dans la conversation, le client n'a dit que « D'accord 👍 » (puis « Ok merci ») — AUCUNE relance",
    dec([ent(21.5, "D'accord 👍"), N(21.4)]).relancer === false && /rien à reprendre/.test(dec([ent(21.5, "D'accord 👍"), N(21.4)]).pourquoi)
    && dec([ent(22, "Bonjour"), N(21.9), ent(21, "Ok merci beaucoup 🙏"), N(20.9)]).relancer === false);
  test("★★★ la précision de Timo : on a parlé d'une INSTALLATION, le client a fini par « d'accord » sans se décider — il EST relancé (BMI en a parlé, l'assistant, un employé ou le téléphone BMI)",
    dec([ent(21.5, "D'accord"), ia(21.4, { texte: "Pour votre installation solaire, je peux vous faire une estimation." })]).relancer === true
    && dec([ia(30, { texte: "Bonjour, nous pouvons motoriser votre portail." }), ent(21.5, "D'accord 👍"), N(21.4)]).relancer === true
    && dec([ent(22, "Oui"), ia(21.9, { texte: "Souhaitez-vous l'estimation ?", wa_assistant: { etape: "ia", ia: true, memoire: { estimation: { bas: 1, haut: 2 } } } }), ent(21.5, "d'accord"), N(21.4)]).relancer === true);
  test("★★ un seul vrai mot du client suffit : « ok pour le devis », « d'accord, combien la batterie ? », une photo — la relance reste possible",
    dec([ent(21, "ok pour le devis"), N(20.9)]).relancer === true && dec([ent(21, "D'accord, combien la batterie ?"), N(20.9)]).relancer === true
    && dec([ent(21, ""), N(20.9)].map((m, k) => (k === 0 ? { ...m, wa_media: { type: "image" } } : m))).relancer === true);
  test("★★ un besoin dit plus tôt dans la conversation compte encore, même si le dernier mot n'est que « merci » (même vieux de deux jours : l'assistant le relit)",
    dec([ent(23, "Je veux 10 ampoules"), N(22.9), ent(21, "Merci"), N(20.9)]).relancer === true
    && dec([ent(50, "Je veux 10 ampoules"), N(49.9), ent(21, "ok"), N(20.9)]).relancer === true);
  test("★★ les mots d'un sujet : installation, panneaux, batterie, motoriser, devis, un montant, une puissance — et pas « Comment puis-je vous aider ? »",
    ["Votre installation", "4 panneaux", "la batterie lithium", "motoriser la porte", "le devis part", "150 000 F", "un frigo de 200 W"].every((t) => RA.parleDUnSujet(t))
    && ["Comment puis-je vous aider ?", "Bonjour, bonne journée", "Très bien ! Dites-moi, de quoi avez-vous besoin exactement ?"].every((t) => !RA.parleDUnSujet(t)));
  test("★★ le tri des candidates (25 h lues) ne juge PAS le sujet ; le serveur le juge sur le fil ENTIER avant d'envoyer",
    RA.relanceAFaire({ fil: [ent(21.5, "D'accord"), N(21.4)], maintenant, sujet: false }).relancer === true
    && /relanceAFaire\(\{ fil, maintenant, sujet: false \}\)/.test(readFileSync("src/lib/relanceAssistant.js", "utf8"))
    && /relanceAFaire\(\{ fil, maintenant, proprietaireId: proprietaire\.id \}\)/.test(readFileSync("api/_relanceAssistant.js", "utf8")));
  test("★★ les mots : « D'accord 👍 », « Ok merci », « Bonne journée », « Jvp » ne sont pas un besoin ; « devis », « solaire », « 3 » en sont",
    ["D'accord 👍", "Ok merci", "Bonne journée à vous", "Jvp", "👍🙏", "Très bien, noté"].every((t) => RA.messageSansBesoin({ texte: t }))
    && ["Je veux un devis", "solaire", "3", "Combien ?"].every((t) => !RA.messageSansBesoin({ texte: t })));
  const rienT = RA.texteDeRelance("AUCUNE_RELANCE");
  test("★★★ l'IA juge qu'il n'y a rien à reprendre (« AUCUNE_RELANCE ») : RIEN ne part, ni sa phrase ni la phrase fixe ; la consigne le lui demande",
    rienT.rien === true && rienT.texte === "" && RA.texteDeRelance("Aucune relance.").rien === true && !RA.texteDeRelance("Bonjour, où en êtes-vous ?").rien
    && /RIEN À REPRENDRE[\s\S]*personne[\s\S]*réponds exactement AUCUNE_RELANCE[\s\S]*RELANCE-le/.test(RA.CONSIGNE_RELANCE));
  const lot =[ent(21), ia(20.9), { ...ent(23), id: "x1", wa_tel: "11112222" }, { ...ia(22.9), wa_tel: "11112222" }, { ...ent(21), id: "x2", wa_tel: "33334444" }, { ...emp(20), wa_tel: "33334444" },
    { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: CLE }, { ...ent(21), id: "x3", wa_tel: "55556666", canal: "messagerie" }];
  const cands = RA.conversationsARelancer(lot, maintenant);
  test("★ parmi des messages lus, les conversations à relancer — la plus ancienne (fenêtre qui se ferme le plus tôt) d'abord, jamais une ligne hors WhatsApp",
    cands.length === 2 && cands[0].cle === "11112222" && cands[1].cle === CLE);
  const m = RA.messagesPourRelance([ent(21), ia(20.9)]);
  test("★ l'IA reçoit la conversation entière (le client, puis l'assistant) et la note INTERNE de relance en dernier",
    m.length === 3 && m[1].role === "assistant" && m[2].role === "user" && /Message interne de BMI TOGO/.test(JSON.stringify(m[2])));
  test("★ la consigne de relance s'AJOUTE à la consigne habituelle (mêmes interdits), sans montant ni outil",
    RA.consigneRelance("BASE").startsWith("BASE") && /AUCUN montant/.test(RA.CONSIGNE_RELANCE) && /aucun outil/.test(RA.CONSIGNE_RELANCE));
  const bonT = RA.texteDeRelance("Bonjour 😊 Vous m'aviez parlé de votre maison. Où en êtes-vous ?");
  const prixT = RA.texteDeRelance("Bonjour, votre kit coûte 1 250 000 F. Où en êtes-vous ?");
  const detteT = RA.texteDeRelance("Bonjour, il vous reste une dette à régler.");
  test("★★ le juge s'applique à la relance : un montant (aucun outil n'a parlé) ou une dette → la PHRASE FIXE part à la place",
    bonT.ia === true && prixT.ia === false && prixT.texte === RA.TEXTE_RELANCE_FIXE && detteT.ia === false && /F/.test(prixT.motif + "F"));
  test("★ la phrase fixe passe elle-même le juge (aucun montant, aucun sujet réservé)", (await import("../src/lib/assistantIA.js")).garderReponse(RA.TEXTE_RELANCE_FIXE, { prixConnus: [] }).ok);
  const lr = RA.ligneRelance({ cle: CLE, tel: "22890112233", nom: "AMA", texte: "x", ts: maintenant, memoire: { estimation: { bas: 1 } }, ia: true });
  test("★ la ligne écrite est une ligne de l'assistant, marquée `relance`, qui garde la mémoire (l'estimation) et ne porte AUCUN propriétaire",
    AW.estLigneAssistant(lr) && lr.wa_assistant.relance === true && lr.wa_assistant.memoire?.estimation?.bas === 1 && !lr.proprietaire_id && lr.wa_entrant === false);
  test("★ après une relance, le client qui répond retrouve l'IA (conversation de l'IA EN COURS, même écrite par la phrase fixe)",
    AW.conversationIAEnCours([ent(21), { ...lr, wa_assistant: { etape: "ia", relance: true } }]) === true);

  // ── Le serveur
  const SV = sansComm(lire("api/_relanceAssistant.js"));
  const EN = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★ RIEN n'est écrit dans le fil avant l'envoi : l'insertion vient APRÈS `envoyerYCloud`, et un refus n'écrit rien",
    SV.indexOf("envoyerYCloud(") > 0 && SV.indexOf('.insert(') > SV.indexOf("envoyerYCloud(") && /if \(!envoi\.ok\) \{[\s\S]*?continue;/.test(SV));
  test("★★ deux arrivées en même temps ne relancent pas deux fois : la fiche légère est RÉSERVÉE par une mise à jour conditionnelle",
    /\.or\(`data->>wa_relance_pour\.is\.null,data->>wa_relance_pour\.neq\.\$\{d\.marque\}`\)/.test(SV) && /if \(!prise \|\| !prise\.length\)/.test(SV));
  test("★★ le propriétaire se relit sur le fil ENTIER (`proprietaireDe`) avant d'envoyer", /const proprietaire = proprietaireDe\(fil\);[\s\S]*?relanceAFaire\(\{ fil, maintenant, proprietaireId: proprietaire\.id \}\)/.test(SV));
  test("★ « 5 » : pas de relance sans service d'IA, ni en mode menu, ni assistant coupé",
    /if \(!ia\.pret\) return/.test(SV) && /modeAssistant\(bqs\) !== "ia"\) return/.test(SV) && /if \(!assistantActif\(bqs\)\) return/.test(SV));
  test("★ aucun outil pendant une relance (elle ne cherche rien, n'enregistre rien)", /executer: async \(\) => \(\{ resultat: "Pas d'outil pendant une relance/.test(SV));
  test("★★ l'adresse d'arrivée relance à chaque appel (message, coche, et — 21/10/2026 — réponse du téléphone BMI), bornée : 3 min entre deux essais, 12 s de budget, une à la fois, IA à 8 s",
    /const ECART_RELANCES_MS = 3 \* 60 \* 1000;/.test(EN) && /const BUDGET_RELANCE_MS = 12000;/.test(EN)
    && /relancerLesConversations\(admin, \{ boutiques, limite: 1, delaiIA: 8000 \}\)/.test(EN)
    && (EN.match(/await relancerSiLeMoment\(admin, debut\)/g) || []).length === 3 && /await relancerSiLeMoment\(admin, debut, boutiques\)/.test(EN));
  test("★ les tournées de 7 h, 14 h et 17 h servent de filet (cinq au plus, l'IA a 20 s)",
    ["api/rappels-du-matin.js", "api/rappels-du-soir.js"].every((f) => /relancerLesConversations\(admin, \{ boutiques: db\.boutiques, limite: 5, delaiIA: 20000 \}\)/.test(lire(f))));
  test("★ 📲 WhatsApp dit qu'une ligne est une relance (« · relance »)", /m\.wa_assistant\.relance \? " · relance" : ""/.test(lire("src/screens/Whatsapp.jsx")));

  // ── La VRAIE chaîne du serveur, sur une base jouée
  const { relancerLesConversations } = await import("../api/_relanceAssistant.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", filtres: [], ou: null, charge: null };
      const lignes = () => (tables[t] || []).filter((l) => q.filtres.every((f) => f(l)) && (!q.ou || q.ou(l)));
      const exec = () => {
        if (q.op === "update") { const ls = lignes(); ls.forEach((l) => Object.assign(l, q.charge)); return { data: ls.map((l) => ({ id: l.id })), error: null }; }
        if (q.op === "insert") { tables[t].push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const i = tables[t].findIndex((l) => l.id === q.charge.id); if (i >= 0) tables[t][i] = structuredClone(q.charge); else tables[t].push(structuredClone(q.charge)); return { data: null, error: null }; }
        return { data: structuredClone(lignes()), error: null };
      };
      const b = {
        select() { return b; },
        update(c) { q.op = "update"; q.charge = c; return b; },
        insert(c) { q.op = "insert"; q.charge = c; return b; },
        upsert(c) { q.op = "upsert"; q.charge = c; return b; },
        gte(col, v) { q.filtres.push((l) => String(l[col] || "") >= v); return b; },
        eq(col, v) { q.filtres.push((l) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : l[col]) === v); return b; },
        or(expr) { const parts = expr.split(","); q.ou = (l) => parts.some((p) => { const x = p.match(/^data->>(\w+)\.(is|neq)\.(.*)$/); if (!x) return false; const val = l.data?.[x[1]]; return x[2] === "is" ? val == null : val != null && String(val) !== x[3]; }); return b; },
        then(res, rej) { return Promise.resolve(exec()).then(res, rej); },
      };
      return b;
    },
  });
  const ilR = (h) => new Date(Date.now() - h * H).toISOString();
  const ligneT = (m) => ({ id: m.id, data: m, updated_at: m.ts || ilR(1) });
  const base = (cle, extra = []) => [
    ligneT({ id: `e-${cle}`, canal: "whatsapp", wa_tel: cle, wa_numero: `228${cle}`, wa_entrant: true, ts: ilR(21), texte: "Je veux 10 ampoules" }),
    ligneT({ ...AW.ligneAssistant({ cle, tel: `228${cle}`, nom: "", texte: "Combien d'heures par jour ?", etape: "ia", ts: ilR(20.9), ia: true, memoire: { estimation: { bas: 100, haut: 200 } } }), id: `a-${cle}` }),
    ligneT({ id: `waent_${cle}`, canal: "whatsapp_entete", wa_tel: cle, wa_numero: `228${cle}`, ts: ilR(20.9) }),
    ...extra.map(ligneT),
  ];
  const envAvant = { a: process.env.ANTHROPIC_API_KEY, b: process.env.ASSISTANT_IA_MODELE, c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  let envois = [], appelsIA = 0, texteIA = "Bonjour 😊 Vous m'aviez parlé de vos 10 ampoules. Où en êtes-vous ?", refusYC = false;
  globalThis.fetch = async (url, opts) => {
    const corps = JSON.parse(opts?.body || "{}");
    if (String(url).includes("anthropic")) { appelsIA++; return new Response(JSON.stringify({ content: [{ type: "text", text: texteIA }], stop_reason: "end_turn" }), { status: 200 }); }
    if (refusYC) return new Response(JSON.stringify({ error: { message: "Re-engagement message", code: 131047 } }), { status: 400 });
    envois.push(corps);
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.X", status: "accepted" }), { status: 200 });
  };
  const bqs = [{ nom: "BMI DEMAKPOE" }];
  let tables, r1, r2, r3, r4, r5, r6, r7, sansIA;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.YCLOUD_API_KEY = "y"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    sansIA = await relancerLesConversations(fauxAdmin({ messages: base("90112233"), users: [] }), { boutiques: bqs });
    process.env.ANTHROPIC_API_KEY = "x"; process.env.ASSISTANT_IA_MODELE = "m";
    tables = {
      messages: [...base("90112233"), ...base("11112222", [{ id: "p1", canal: "whatsapp", wa_tel: "11112222", wa_entrant: false, de_id: "u-com1", proprietaire_id: "u-com1", ts: ilR(30), texte: "Je vous confie" }])],
      users: [{ id: "c1", data: { role: "client", nom: "AMA", tel: "22890112233" } }],
    };
    // le propriétaire posé hors des 25 h lues : seule la relecture du fil entier le voit
    tables.messages.find((l) => l.id === "p1").updated_at = ilR(30);
    r1 = await relancerLesConversations(fauxAdmin(tables), { boutiques: bqs, limite: 5 });
    r2 = await relancerLesConversations(fauxAdmin(tables), { boutiques: bqs, limite: 5 });
    // le juge jette un montant → la phrase fixe
    texteIA = "Bonjour, votre kit coûte 1 250 000 F."; envois = [];
    const t3 = { messages: base("77778888"), users: [] };
    r3 = await relancerLesConversations(fauxAdmin(t3), { boutiques: bqs });
    tables.t3 = t3;
    // WhatsApp refuse → rien d'écrit, et la réservation empêche de réessayer
    texteIA = "Bonjour, où en êtes-vous ?"; refusYC = true; envois = [];
    const t4 = { messages: base("44445555"), users: [] };
    r4 = await relancerLesConversations(fauxAdmin(t4), { boutiques: bqs });
    refusYC = false;
    r5 = await relancerLesConversations(fauxAdmin(t4), { boutiques: bqs });
    tables.t4 = t4; tables.envois4 = envois.length;
    // l'IA répond « AUCUNE_RELANCE » → rien n'est envoyé, rien d'écrit, pas de nouvel essai
    texteIA = "AUCUNE_RELANCE"; envois = [];
    const t6 = { messages: base("66667777"), users: [] };
    r6 = await relancerLesConversations(fauxAdmin(t6), { boutiques: bqs });
    r7 = await relancerLesConversations(fauxAdmin(t6), { boutiques: bqs });
    tables.t6 = t6; tables.envois6 = envois.length;
  } catch (e) { console.log("    (erreur de la chaîne jouée :", e?.message || e, ")"); }
  finally {
    globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ ANTHROPIC_API_KEY: envAvant.a, ASSISTANT_IA_MODELE: envAvant.b, YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const relanceEcrite = (tbl, cle) => (tbl?.messages || []).filter((l) => l.data?.wa_tel === cle && l.data?.wa_assistant?.relance);
  const f1 = relanceEcrite(tables, "90112233");
  test("★ sans service d'IA configuré : aucune relance, rien demandé à personne", sansIA?.relances === 0 && /IA non configuré/.test(sansIA?.pourquoi || ""));
  test("★★ la chaîne jouée : UNE relance part, du numéro BMI, au numéro du client, avec le texte de l'IA ; la conversation CONFIÉE (propriétaire posé il y a 30 h) ne part pas",
    r1?.relances === 1 && r1.essais.some((e) => e.cle === "11112222" && /confiée/.test(e.pourquoi || ""))
    && f1.length === 1 && f1[0].data.texte.includes("10 ampoules") && f1[0].data.wa_assistant.ia === true && f1[0].data.wa_envoi_id === "yc_1");
  test("★ la ligne garde la mémoire (l'estimation) et la fiche légère suit, réservée pour ce message du client",
    f1[0]?.data.wa_assistant.memoire?.estimation?.haut === 200
    && /^\d{17}$/.test(String((tables?.messages || []).find((l) => l.id === "waent_90112233")?.data?.wa_relance_pour || ""))
    && (tables?.messages || []).find((l) => l.id === "waent_90112233")?.data?.derniere === f1[0]?.data.ts);
  test("★★ un second passage ne relance PAS une seconde fois", r2?.relances === 0 && relanceEcrite(tables, "90112233").length === 1);
  const f3 = relanceEcrite(tables?.t3, "77778888");
  test("★★ une réponse de l'IA jetée par le juge (un montant) → la phrase fixe part, marquée « pas de l'IA »",
    r3?.relances === 1 && f3.length === 1 && f3[0].data.texte === RA.TEXTE_RELANCE_FIXE && !f3[0].data.wa_assistant.ia);
  test("★★ WhatsApp refuse → RIEN d'écrit dans le fil, et la relance n'est pas retentée pour ce message",
    r4?.relances === 0 && relanceEcrite(tables?.t4, "44445555").length === 0 && r5?.relances === 0 && tables?.envois4 === 0
    && r5?.essais?.some((e) => /réservée/.test(e.pourquoi || "")));
  test("★★★ la chaîne jouée : l'IA répond « AUCUNE_RELANCE » → aucun message envoyé, rien d'écrit dans le fil, et pas de nouvel essai pour ce message",
    r6?.relances === 0 && r6?.essais?.some((e) => /rien à reprendre/.test(e.pourquoi || "")) && tables?.envois6 === 0
    && relanceEcrite(tables?.t6, "66667777").length === 0 && r7?.relances === 0 && r7?.essais?.some((e) => /réservée/.test(e.pourquoi || "")));
}

titre("57 🗣 L'ASSISTANT S'HUMANISE : UNE RÉPONSE AUX MESSAGES RAPIDES, LA PRÉSENTATION UNE SEULE FOIS, LES PRIX QUAND ÇA VA VERS UN ACHAT (18/10/2026, « B a, C b, lance »)");
{
  const I = await import("../src/lib/assistantIA.js");
  const AW = await import("../src/lib/assistantWhatsapp.js");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ── Les règles
  test("★★ la question d'accueil que l'IA ajoute (« Et vous, comment puis-je vous aider aujourd'hui ? », « En quoi puis-je vous être utile ? ») est retirée, le reste garde ses mots",
    I.sansQuestionAccueil("Très bien, merci ! Et vous, comment puis-je vous aider aujourd’hui ?") === "Très bien, merci !"
    && I.sansQuestionAccueil("Oui, nous faisons le solaire. En quoi puis-je vous être utile ?") === "Oui, nous faisons le solaire."
    && I.sansQuestionAccueil("Je peux vous aider à choisir une batterie.") === "Je peux vous aider à choisir une batterie.");
  const pres = { id: "a1", wa_entrant: false, ts: "2026-10-10T10:00:00.000Z", texte: I.PHRASE_PRESENTATION };
  test("★★ « B a » : la présentation déjà posée par BMI se reconnaît (celle de l'IA ou l'accueil du menu) ; un client qui la recopie ne compte pas",
    I.dejaPresente([pres]) === true && I.dejaPresente([{ wa_entrant: false, texte: AW.TEXTE_ACCUEIL }]) === true
    && I.dejaPresente([{ ...pres, wa_entrant: true }]) === false && I.dejaPresente([]) === false);
  const repDejaVu = I.reponseDepuisIA({ texte: "Bonjour Kossi, ravi de vous relire ! Oui, nous installons des kits solaires.", effets: { prix: [] }, juge: { ok: true }, nouvelle: true, presentation: false, nom: "Kossi" });
  const repPremier = I.reponseDepuisIA({ texte: "Très bien, merci ! Et vous, comment puis-je vous aider aujourd'hui ?", effets: { prix: [] }, juge: { ok: true }, nouvelle: true, presentation: true });
  test("★★ « B a » : une reprise après 24 h ne repose PAS la présentation, et le bonjour de l'IA (qui retrouve le client) reste ; la toute première fois, la présentation part UNE fois, sans la question répétée",
    !repDejaVu.texte.includes(I.DEBUT_PRESENTATION) && repDejaVu.texte.startsWith("Bonjour Kossi, ravi de vous relire")
    && repPremier.texte === `${I.PHRASE_PRESENTATION}\n\nTrès bien, merci !`
    && (repPremier.texte.match(/Comment puis-je vous aider/g) || []).length === 1);
  test("★ trois salutations dans la consigne : premier contact (ne pas saluer ni reposer la question), reprise (saluer une fois, sans se présenter), conversation en cours (rien)",
    /Ne dis PAS bonjour[\s\S]*ne repose pas cette question/.test(I.consignePour({ nouvelle: true, presentation: true }))
    && /ravi de vous relire[\s\S]*sans te présenter/.test(I.consignePour({ nouvelle: true, presentation: false }))
    && I.consignePour({ nouvelle: true, presentation: false, client: { nom: "KOSSI" } }).includes("Bonjour KOSSI, ravi de vous relire")
    && /Ne redis pas bonjour/.test(I.consignePour({ nouvelle: false })));
  test("★★ « C b » : la consigne dit que les PRIX viennent quand la discussion va vers un achat, une question à la fois, sans finir par « Comment puis-je vous aider ? » — consigne SEULE, le juge des prix n'a pas bougé",
    I.CONSIGNE_IA.includes("LES PRIX VIENNENT QUAND LA DISCUSSION VA VERS UN ACHAT") && I.CONSIGNE_IA.includes("UNE seule question à la fois")
    && I.CONSIGNE_IA.includes("Tu ne termines pas tes messages par « Comment puis-je vous aider ? »")
    && I.CONSIGNE_IA.includes("1 à 3 lignes") && !/2 à 6 lignes/.test(I.CONSIGNE_IA)
    && I.garderReponse("Le panneau 400W coûte 85 000 F.", { prixConnus: [85000] }).ok === true && I.garderReponse("Le panneau 400W coûte 85 000 F.", { prixConnus: [] }).ok === false);
  const T = "2026-10-18T09:00:00.000Z";
  const e1 = { id: "wa-1-a", wa_entrant: true, ts: T, texte: "Okay" };
  const e2 = { id: "wa-2-b", wa_entrant: true, ts: "2026-10-18T09:00:02.000Z", texte: "Comment vous allez" };
  const e1bis = { id: "wa-1-z", wa_entrant: true, ts: T, texte: "?" };
  const bmi = { id: "r", wa_entrant: false, ts: "2026-10-18T09:00:05.000Z", texte: "Bonjour" };
  test("★★ un message est DÉPASSÉ par un message ENTRANT plus récent (même seconde : l'ordre des identifiants départage, un seul répond) ; une ligne de BMI ne dépasse rien",
    AW.messageDepasse([e1, e2], e1) === true && AW.messageDepasse([e1, e2], e2) === false
    && AW.messageDepasse([e1, e1bis], e1) === true && AW.messageDepasse([e1, e1bis], e1bis) === false
    && AW.messageDepasse([e1, bmi], e1) === false && AW.messageDepasse([e1], e1) === false);
  test("★ la conversation relue se lit avec le message du client EN DERNIER (une réponse rangée après lui ne le cache pas)",
    AW.filPourReponse([e1, bmi, e2], e2).map((m) => m.id).join() === "wa-1-a,r,wa-2-b" && AW.filPourReponse([e2, bmi], e2).at(-1).id === "wa-2-b");
  test("★ l'attente est de 4 s", AW.ATTENTE_GROUPEMENT_MS === 4000);
  // ── Le serveur
  const EN = sansComm(lire("api/whatsapp-entrant.js"));
  const corps = EN.slice(EN.indexOf("export async function repondreParAssistant"), EN.indexOf("// ✓✓ LE SUIVI") > 0 ? EN.indexOf("// ✓✓ LE SUIVI") : undefined);
  test("★★ le serveur attend, relit la conversation, s'efface si le client a réécrit, et revérifie juste AVANT d'envoyer",
    /if \(attente > 0\) await new Promise\(\(ok\) => setTimeout\(ok, attente\)\);\s*const filFrais = await relireFil\(\);\s*if \(messageDepasse\(filFrais, ligne\)\) return \{ repondu: false, groupe: true/.test(corps)
    && /const fil = filPourReponse\(filFrais, ligne\);\s*const decision = decisionAssistant\(\{ fil,/.test(corps)
    && /const filAvantEnvoi = await relireFil\(\);\s*if \(messageDepasse\(filAvantEnvoi, ligne\)\)/.test(corps) && corps.lastIndexOf("messageDepasse(filAvantEnvoi, ligne)") < corps.indexOf("envoyerYCloud(cleYCloud, corpsTexte("));
  test("★★ « B a » : la présentation dépend de l'histoire ENTIÈRE du client (`presentation = nouvelle && !dejaPresente(fil)`), passée à la consigne ET à la réponse",
    /const presentation = nouvelle && !dejaPresente\(fil\);/.test(corps) && /consignePour\(\{ client: clientIA, nouvelle, presentation,/.test(corps) && /reponseDepuisIA\(\{[^}]*nouvelle, presentation,/.test(corps));
  // ── La VRAIE chaîne, sur une base jouée
  const { repondreParAssistant } = await import("../api/whatsapp-entrant.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [], de: 0, a: Infinity };
      // Les filtres de la base, joués (18/10/2026) : `.eq("data->>wa_tel", …)`
      // et `.range(…)` — la conversation seule, page par page.
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        const lignes = (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v)));
        return { data: structuredClone(lignes.slice(q.de, q.a + 1)), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, order() { return b; }, range(de, a) { q.de = de; q.a = a; return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const CLE = "90561234";
  const ent = (id, ts, texte) => ({ id, canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_entrant: true, ts, texte });
  const lt = (m) => ({ id: m.id, data: m, updated_at: m.ts });
  const envAvant = { a: process.env.ANTHROPIC_API_KEY, b: process.env.ASSISTANT_IA_MODELE, c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  let envois = [], corpsIA = [];
  globalThis.fetch = async (url, opts) => {
    const c = JSON.parse(opts?.body || "{}");
    if (String(url).includes("anthropic")) { corpsIA.push(c); return new Response(JSON.stringify({ content: [{ type: "text", text: "Très bien, merci ! Et vous, comment puis-je vous aider aujourd'hui ?" }], stop_reason: "end_turn" }), { status: 200 }); }
    envois.push(c);
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.X", status: "accepted" }), { status: 200 });
  };
  const bqs = [{ nom: "BMI DEMAKPOE" }];
  let g1, g2, g3, tA, tB;
  try {
    process.env.ANTHROPIC_API_KEY = "cle-de-banc"; process.env.ASSISTANT_IA_MODELE = "modele-de-banc";
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    // Deux messages rapides : les deux appels ont écrit leur ligne avant la fin de l'attente.
    const m1 = ent("wa-1-a", "2026-10-18T09:00:00.000Z", "Okay"), m2 = ent("wa-2-b", "2026-10-18T09:00:02.000Z", "Comment vous allez");
    tA = { messages: [lt(m1), lt(m2)] };
    const appel = (ligne, tables) => repondreParAssistant({ admin: fauxAdmin(tables), boutiques: bqs, fil: [ligne], proprietaireId: "", cle: CLE, from: `228${CLE}`, client: null, ligne, attente: 0 });
    g1 = await appel(m1, tA);
    g2 = await appel(m2, tA);
    // Un client déjà présenté il y a 3 jours, qui revient.
    const vieux = { ...AW.ligneAssistant({ cle: CLE, tel: `228${CLE}`, nom: "", texte: `${I.PHRASE_PRESENTATION}\n\nOui.`, etape: "ia", ts: "2026-10-15T09:00:01.000Z", ia: true }), id: "vieux" };
    const m3 = ent("wa-3-c", "2026-10-18T09:00:00.000Z", "Bonjour, vous faites le solaire ?");
    tB = { messages: [lt(ent("wa-0", "2026-10-15T09:00:00.000Z", "Bonjour")), lt(vieux), lt(m3)] };
    tA.corpsIA = corpsIA;
    corpsIA = [];
    const nEnv = envois.length;
    g3 = await appel(m3, tB);
    tB.envoi = envois.slice(nEnv);
    tB.corpsIA = corpsIA;
  } catch (e) { console.log("    (erreur de la chaîne jouée :", e?.message || e, ")"); }
  finally {
    globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ ANTHROPIC_API_KEY: envAvant.a, ASSISTANT_IA_MODELE: envAvant.b, YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const texteParti = envois[0]?.text?.body || "";
  test("★★ la chaîne jouée : deux messages rapides → le premier appel s'efface (« regroupé », il ne prévient personne), le second répond UNE fois",
    g1?.repondu === false && g1?.groupe === true && g2?.repondu === true && envois.length >= 1
    && (tA?.messages || []).filter((l) => l.data?.wa_assistant).length === 1);
  test("★★ l'IA a lu les DEUX messages, et la réponse porte la présentation UNE fois, sans « Comment puis-je vous aider » en double",
    JSON.stringify(tA?.corpsIA?.[0]?.messages || []).includes("Okay") && JSON.stringify(tA?.corpsIA?.[0]?.messages || []).includes("Comment vous allez")
    && texteParti.startsWith(I.PHRASE_PRESENTATION) && (texteParti.match(/Comment puis-je vous aider/g) || []).length === 1 && texteParti.endsWith("Très bien, merci !"));
  test("★★ « B a » : un client déjà présenté qui revient 3 jours après — pas de présentation, la consigne lui dit de saluer une fois sans se présenter",
    g3?.repondu === true && !(tB?.envoi?.[0]?.text?.body || "").includes(I.DEBUT_PRESENTATION)
    && /ravi de vous relire/.test(JSON.stringify(tB?.corpsIA?.[0]?.system || "")));
}

titre("58 🔁 LE MÊME MESSAGE DU CLIENT REÇU DEUX FOIS NE REÇOIT PAS DEUX RÉPONSES (18/10/2026, capture René 2 à 15:45)");
{
  const CV = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappConversations.js")).href);
  const EN = await import(pathToFileURL(join(process.cwd(), "api/whatsapp-entrant.js")).href);
  const deja = [
    { id: "wa-x-1", canal: "whatsapp", wa_entrant: true, wa_tel: "90112233", wa_id: "yc-1", wa_wamid_recu: "wamid.A", texte: "Où sont vos boutiques ?", ts: "2026-10-18T15:45:03.000Z" },
    { id: "ass-1", canal: "whatsapp", wa_tel: "90112233", wa_assistant: { etape: "ia" }, texte: "Merci !", ts: "2026-10-18T15:45:20.000Z" },
    { id: "wa-x-2", canal: "whatsapp", wa_entrant: true, wa_tel: "90112233", wa_id: "yc-2", texte: "", wa_media: { media_id: "med-9" }, ts: "2026-10-18T15:46:00.000Z" },
  ];
  const D = (o) => CV.doublonEntrant(deja, { cle: "90112233", ...o });
  test("★★ un renvoi de YCloud avec le MÊME identifiant est un doublon", D({ id: "yc-1", texte: "autre", ts: "2026-10-18T16:00:00.000Z" }) === true);
  test("★★ un renvoi qui porte un AUTRE identifiant YCloud mais le même wamid de Meta est un doublon", D({ id: "yc-99", wamid: "wamid.A", texte: "x", ts: "2026-10-18T16:00:00.000Z" }) === true);
  test("★★ un renvoi SANS identifiant : même conversation, même texte, même seconde → doublon", D({ id: "", texte: "Où sont vos boutiques ?", ts: "2026-10-18T15:45:03.000Z" }) === true);
  test("★★ un fichier renvoyé (même fichier, même seconde) est un doublon", D({ id: "", texte: "", mediaId: "med-9", ts: "2026-10-18T15:46:00.000Z" }) === true);
  test("★★ le même texte une seconde plus tard N'EST PAS un doublon (deux « ok » d'affilée ne se perdent jamais)", D({ id: "yc-3", texte: "Où sont vos boutiques ?", ts: "2026-10-18T15:45:04.000Z" }) === false);
  test("★★ sans heure d'envoi, le texte ne suffit jamais", D({ id: "yc-3", texte: "Où sont vos boutiques ?", ts: "" }) === false);
  test("★ le même texte dans une AUTRE conversation n'est pas un doublon", CV.doublonEntrant(deja, { cle: "91000000", id: "yc-3", texte: "Où sont vos boutiques ?", ts: "2026-10-18T15:45:03.000Z" }) === false);
  test("★ une réponse de BMI au même texte ne compte pas (seuls les messages du client)", D({ id: "yc-3", texte: "Merci !", ts: "2026-10-18T15:45:20.000Z" }) === false);
  test("★ un nouveau message ordinaire passe", D({ id: "yc-4", wamid: "wamid.B", texte: "Merci", ts: "2026-10-18T15:47:00.000Z" }) === false);
  const lu = EN.lireEntrant({ whatsappInboundMessage: { id: "yc-7", wamid: "wamid.Z", from: "+22890112233", type: "text", text: { body: "bonjour" }, sendTime: "2026-10-18T15:45:03.000Z" } });
  test("★★ l'adresse d'arrivée LIT le wamid du message", lu.wamid === "wamid.Z" && lu.id === "yc-7");
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const WE58 = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★ l'adresse d'arrivée passe par doublonEntrant AVANT d'écrire la ligne, avec le wamid, le texte, le fichier et l'heure",
    WE58.indexOf("doublonEntrant(messages") > 0 && WE58.indexOf("doublonEntrant(messages") < WE58.indexOf('admin.from("messages").insert({ id: ligne.id')
    && /doublonEntrant\(messages, \{ cle, id, wamid, texte, mediaId: media\?\.media_id, ts: ts \? horodatage\(ts\) : "" \}\)/.test(WE58));
  test("★★ la ligne du client garde son wamid (`wa_wamid_recu`, jamais `wa_wamid` — celui-là sert aux coches des messages partis)",
    /\.\.\.\(wamid \? \{ wa_wamid_recu: wamid \} : \{\}\)/.test(WE58));
}

titre("59 📍 L'ASSISTANT DONNE L'ADRESSE, LE TÉLÉPHONE ET LA CARTE DE NOS BOUTIQUES (18/10/2026, « b, NON pour les horaires »)");
{
  const IA = await import(pathToFileURL(join(process.cwd(), "src/lib/assistantIA.js")).href);
  const bqs = [
    { nom: "BMI DEMAKPOE", adresse: "Démakpoè, face à la pharmacie", tel: "+228 90 11 22 33", lat: 6.17, lng: 1.21 },
    { nom: "BMI APESSITO", adresse: "Apessito, route de Kpalimé", tel: "91 00 00 00" },
    { nom: "BMI KAGOME" },
    { nom: "DFORMATION", adresse: "Adresse de formation", tel: "99 99 99 99", formation: true },
    { nom: "DEPOT MAISON", adresse: "Adresse du dépôt", depot: true },
    { nom: "TERRAIN", terrain: true, adresse: "Adresse du chantier" },
  ];
  const t = IA.texteBoutiques(bqs);
  test("★★ chaque vraie boutique : son nom, son adresse et son téléphone tels qu'écrits sur la fiche",
    t.includes("📍 BMI DEMAKPOE — Démakpoè, face à la pharmacie") && t.includes("📞 +228 90 11 22 33") && t.includes("📍 BMI APESSITO — Apessito, route de Kpalimé") && t.includes("📞 91 00 00 00"));
  test("★★ « b » : le lien Google Maps de l'itinéraire pour une boutique qui a sa position GPS, rien pour une boutique sans position",
    t.includes("🗺️ Itinéraire : https://www.google.com/maps?q=6.17,1.21") && (t.match(/google\.com\/maps/g) || []).length === 1);
  test("★★ une boutique sans coordonnées sur sa fiche : il le DIT, jamais une adresse inventée", t.includes("📍 BMI KAGOME — coordonnées non renseignées : un conseiller vous les donne."));
  test("★★★ LE MUR : jamais une boutique de formation, jamais un magasin (dépôt), jamais la caisse 🏗 DÉPÔT CHANTIER",
    !/DFORMATION|formation|DEPOT MAISON|dépôt|TERRAIN|chantier/i.test(t));
  test("★ les boutiques sont rangées par ordre alphabétique", t.indexOf("BMI APESSITO") < t.indexOf("BMI DEMAKPOE") && t.indexOf("BMI DEMAKPOE") < t.indexOf("BMI KAGOME"));
  test("★★ « NON pour les horaires » : aucune heure d'ouverture n'est donnée", !/horaire|ouvert|ferm/i.test(t));
  const r = IA.executerOutil("adresses_boutiques", {}, { boutiques: bqs });
  test("★★ l'outil rend ce texte à recopier tel quel, et n'autorise AUCUN montant", r.resultat.includes(t) && /tel quel/.test(r.resultat) && r.effets.prix.length === 0 && r.effets.conseiller === false);
  test("★★ le juge laisse passer la réponse (les numéros de téléphone ne sont pas lus comme des prix)", IA.garderReponse(t, { prixConnus: [] }).ok === true);
  const vide = IA.executerOutil("adresses_boutiques", {}, { boutiques: [bqs[3], bqs[4]] });
  test("★★ sans aucune vraie boutique : rien d'inventé, il propose un conseiller", /Ne rien inventer/.test(vide.resultat) && !/📍/.test(vide.resultat));
  const C = IA.consignePour({});
  test("★★ la consigne : l'adresse UNIQUEMENT par l'outil, jamais d'horaires, jamais « je ne peux pas me renseigner »",
    /UNIQUEMENT tels que l'outil adresses_boutiques te les donne/.test(C) && /ni des horaires d'ouverture/.test(C) && /appelle adresses_boutiques/.test(C) && /Ne dis jamais que tu ne peux pas te renseigner sur nos boutiques/.test(C));
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const WE59 = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★★ le serveur donne à l'outil les boutiques RÉELLES seulement (`reelles`), jamais toutes les boutiques",
    /executerOutil\(nom, entree, \{[\s\S]{0,900}boutiques: reelles,/.test(WE59) && !/executerOutil\(nom, entree, \{[\s\S]{0,900}boutiques: boutiques/.test(WE59));
}

titre("60 🗣 L'ASSISTANT NE VOIT PLUS UNE MOITIÉ DE LA CONVERSATION (18/10/2026, captures MANDA « trop bavard »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ── Contrôle GÉNÉRAL : aucune fonction serveur ne lit TOUTE la table des messages.
  const fichiersApi = readdirSync(join(process.cwd(), "api")).filter((f) => f.endsWith(".js"));
  const fautifs = fichiersApi.filter((f) => {
    const src = sansComm(lire(`api/${f}`));
    const lectures = src.match(/from\("messages"\)\s*\.select\([^)]*\)[^;]*/g) || [];
    return lectures.some((l) => !/\.(eq|or|gte|range)\(/.test(l));
  });
  test(`★★★ aucune fonction serveur ne lit la table des messages EN ENTIER (la base n'en rend que 1 000)${fautifs.length ? ` — fautif : ${fautifs.join(", ")}` : ""}`, fautifs.length === 0);
  const TB = sansComm(lire("api/_tables.js"));
  test("★★ `lireConversation` : les lignes de LA conversation (`data->>wa_tel`), page par page",
    /export async function lireConversation\(admin, cle/.test(TB) && /\.eq\("data->>wa_tel", k\)/.test(TB) && /\.range\(de, de \+ PAGE - 1\)/.test(TB));
  const WE = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★★ l'adresse d'arrivée la lit pour les doublons ET pour la conversation relue (l'attente des 4 s, la mémoire de l'IA)",
    /const messages = await lireConversation\(admin, cle\);/.test(WE) && /return filDeLaConversation\(await lireConversation\(admin, cle\), cle\);/.test(WE));
  test("★★ la fenêtre de 24 h d'une réponse, le fichier d'un client et le contact Google aussi",
    /filDeLaConversation\(await lireConversation\(admin, cleFil\), cleFil\)/.test(sansComm(lire("api/whatsapp.js")))
    && /await lireConversation\(admin, ligne\.wa_tel\)/.test(sansComm(lire("api/whatsapp-media.js")))
    && /await lireConversation\(admin, k\)/.test(sansComm(lire("api/_contactGoogle.js"))));
  // ── La VRAIE fonction, sur une base jouée de 3 700 lignes.
  const { lireConversation } = await import("../api/_tables.js");
  const lignes = [];
  for (let n = 0; n < 2500; n += 1) lignes.push({ id: `a${String(n).padStart(5, "0")}`, data: { canal: "whatsapp", wa_tel: "11111111", texte: "autre" } });
  for (let n = 0; n < 1200; n += 1) lignes.push({ id: `b${String(n).padStart(5, "0")}`, data: { canal: "whatsapp", wa_tel: "90561234", texte: `m${n}` } });
  let pages = 0;
  const fauxAdmin = {
    from() {
      const q = { f: [], de: 0, a: Infinity };
      const b = {
        select() { return b; }, order() { return b; },
        eq(c, v) { q.f.push([c, v]); return b; },
        range(de, a) { q.de = de; q.a = a; return b; },
        then(res, rej) {
          pages += 1;
          const t = lignes.filter((l) => q.f.every(([c, v]) => String(c.startsWith("data->>") ? l.data[c.slice(7)] : l[c]) === String(v)));
          // La base coupe à 1 000 lignes, comme Supabase.
          return Promise.resolve({ data: t.slice(q.de, Math.min(q.a + 1, q.de + 1000)), error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
  const conv = await lireConversation(fauxAdmin, "90561234");
  test("★★★ une conversation de 1 200 lignes revient ENTIÈRE (deux pages), sans une ligne d'une autre conversation",
    conv.length === 1200 && conv.every((m) => m.wa_tel === "90561234") && conv.at(-1).texte === "m1199" && pages === 2 && conv[0].id === "b00000");
  test("★ une clé vide ne lit rien", (await lireConversation(fauxAdmin, "")).length === 0);
  const C = (await import(pathToFileURL(join(process.cwd(), "src/lib/assistantIA.js")).href)).consignePour({});
  test("★★ la consigne : répondre au DERNIER message, ne jamais redire un calcul déjà donné, ne pas revenir sur une question déjà répondue",
    /Tu réponds au DERNIER message du client, et à lui seul/.test(C) && /tu ne le redis JAMAIS en entier/.test(C) && /Tu ne reviens pas sur une question à laquelle tu as déjà répondu/.test(C));
}

titre("61 🏠 L'ASSISTANT GUIDE LE CLIENT DANS SON ESPACE, ÉCRAN PAR ÉCRAN (18/10/2026, « il n'a qu'à couvrir tous les aspects et écrans d'un client »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const G = await import(pathToFileURL(join(process.cwd(), "src/lib/guideEspaceClient.js")).href);
  const IA = await import(pathToFileURL(join(process.cwd(), "src/lib/assistantIA.js")).href);
  test("★★ tous les écrans du client sont couverts : connexion, devis (valider, modifier), paiement, contrat, fin des travaux, messages, parrainage, mot de passe, données, avis et cadeau, vue d'ensemble",
    ["ensemble", "connexion", "valider_devis", "modifier_devis", "paiement", "contrat", "fin_travaux", "messagerie", "parrainage", "mot_de_passe", "mes_donnees", "avis_cadeau"].every((k) => G.SUJETS_GUIDE.includes(k)));
  // Chaque bouton nommé existe VRAIMENT à l'écran (sinon l'assistant guide vers un bouton fantôme).
  const ecrans = ["src/screens/EspaceClient.jsx", "src/screens/Connexion.jsx", "src/screens/Messagerie.jsx", "src/screens/MesDonnees.jsx", "src/screens/ContratsInstallation.jsx", "src/App.jsx"].map(lire).join("\n");
  const cites = [...new Set(G.SUJETS_GUIDE.flatMap((k) => [...G.texteGuide(k).matchAll(/« ([^»]+) »/g)].map((m) => m[1].trim())))].filter((b) => b !== "conseiller");
  const signer = (b) => b === "✍️ Signer la réception" ? /✍️ Signer \{estAvenant \? "l'avenant" : "la réception"\}/.test(ecrans) : ecrans.includes(b);
  const fantomes = cites.filter((b) => !signer(b));
  test(`★★★ chaque bouton, onglet ou case nommé par le mode d'emploi existe à l'écran${fantomes.length ? ` — introuvable : ${fantomes.join(" | ")}` : ""}`, cites.length >= 30 && fantomes.length === 0);
  const tous = G.SUJETS_GUIDE.map(G.texteGuide).join("\n");
  test("★★★ le mode d'emploi ne donne AUCUN code, aucun montant, aucune dette : il dit où regarder", !/\d[\d\s]*F\b|franc|dette|crédit|solde/i.test(tous) && !/ADUM|@S\d/.test(tous));
  test("★★ codes perdus, mot de passe oublié : un conseiller, jamais un renvoi par l'assistant", /je ne peux ni les voir ni vous les renvoyer/.test(G.texteGuide("connexion")) && /je ne peux ni le voir ni vous le renvoyer/.test(G.texteGuide("mot_de_passe")));
  test("★ un sujet inconnu rend la vue d'ensemble, jamais rien", G.texteGuide("n'importe quoi") === G.texteGuide("ensemble"));
  const r = IA.executerOutil("guide_espace_client", { sujet: "connexion" }, {});
  test("★★ l'outil rend le texte à recopier tel quel, sans aucun montant permis, et le déclare permis au juge",
    r.resultat.includes(G.texteGuide("connexion")) && /tel quel/.test(r.resultat) && r.effets.prix.length === 0 && r.effets.textesPermis[0] === G.texteGuide("connexion"));
  const t = G.texteGuide("connexion");
  test("★★★ le juge : le mode d'emploi recopié passe (même entre guillemets) ; « mot de passe » HORS du mode d'emploi reste un sujet réservé ; sans l'outil, le texte est jeté",
    IA.garderReponse(t, { textesPermis: [t] }).ok === true && IA.garderReponse(`« ${t} »`, { textesPermis: [t] }).ok === true
    && IA.garderReponse(`${t}\nDonnez-moi votre mot de passe.`, { textesPermis: [t] }).reserve === true
    && IA.garderReponse(t, {}).reserve === true && IA.garderReponse("Votre mot de passe est X", { textesPermis: [G.texteGuide("paiement")] }).reserve === true);
  test("★★ toutes les parties passent le juge une fois déclarées (longueur, aucun métier nié, aucun montant)", G.SUJETS_GUIDE.every((k) => IA.garderReponse(G.texteGuide(k), { textesPermis: [G.texteGuide(k)] }).ok === true));
  const rep = IA.reponseDepuisIA({ texte: `« ${t} »`, effets: { prix: [], conseiller: false, textesPermis: [t] }, juge: { ok: true }, nouvelle: false });
  test("★ la réponse part SANS guillemets autour du mode d'emploi", rep.texte === t);
  const C = IA.consignePour({});
  test("★★ la consigne : le mode d'emploi UNIQUEMENT par l'outil, jamais un code, et plus jamais « je n'ai pas le détail »",
    /UNIQUEMENT tel que l'outil guide_espace_client te le donne/.test(C) && /Tu ne donnes JAMAIS un code/.test(C) && /appelle guide_espace_client/.test(C) && /Ne dis jamais que tu n'as pas le détail de l'espace client/.test(C));
  const codeIA = sansComm(lire("src/lib/assistantIA.js"));
  test("★★ la réécriture garde le droit : les textes permis passent aux DEUX jugements de converserAvecJuge",
    (codeIA.match(/textesPermis: premier\.effets\.textesPermis/g) || []).length === 2 && /textesPermis: effets\.textesPermis/.test(codeIA));
  test("★ le mode d'emploi n'importe rien (lu par le serveur)", !/^import /m.test(sansComm(lire("src/lib/guideEspaceClient.js"))));
}

titre("62 📎 LE DEVIS REPART SANS PDF QUAND META REJETTE LE PDF (18/10/2026, capture MANDA, « a »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const R = await import(pathToFileURL(join(process.cwd(), "src/lib/relaisDevisPdf.js")).href);
  const { fmt } = await import(pathToFileURL(join(process.cwd(), "src/lib/core.js")).href);
  const CLE = "99021319";
  const lignePdf = { id: "l-pdf", canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_nom: "MANDA", de_id: "u-timo", de_nom: "TIMO", wa_modele: "devis_pdf", devis_id: "dv1", texte: "📲 Envoyé du numéro BMI — Devis solaire de 1 429 340 F envoyé à MANDA, 📎 PDF joint.", wa_envoi_id: "yc_pdf" };
  const echec = { etat: "echec", le: "2026-10-18T18:02:05.000Z", motif: "header: Template does not contain title component" };
  test("★★★ la règle : un ❌ sur un `devis_pdf` pas encore relayé → relais ; jamais deux fois, jamais sur une coche ordinaire, jamais pour un autre modèle",
    R.relaisAFaire(lignePdf, echec) === true
    && R.relaisAFaire({ ...lignePdf, wa_relais_le: "2026-10-18T18:02:06.000Z" }, echec) === false
    && R.relaisAFaire(lignePdf, { etat: "recu", le: "x" }) === false
    && R.relaisAFaire({ ...lignePdf, wa_modele: "devis_disponible" }, echec) === false
    && R.relaisAFaire({ ...lignePdf, devis_id: "" }, echec) === false);
  const compte = { id: "c-manda", nom: "MANDA", nom_base: "MANDA", tel: `228${CLE}`, devis: [{ id: "dv1", type_devis: "solaire", total: 1429340, lignes: [] }] };
  const e = R.envoiRelais({ compte, devisId: "dv1", fmt });
  test("★★ le relais part par `devis_disponible`, avec les trous du devis (client, domaine, montant)", e?.modele === "devis_disponible" && e.variables[0] === "MANDA" && e.variables[1] === "solaire" && /1\s?429\s?340/.test(e.variables[2]));
  test("★★★ le mur : un devis de formation, à la corbeille, ou d'un compte de formation ne relaie rien",
    R.envoiRelais({ compte: { ...compte, devis: [{ ...compte.devis[0], formation: true }] }, devisId: "dv1", fmt }) === null
    && R.envoiRelais({ compte: { ...compte, devis: [{ ...compte.devis[0], supprime_le: "2026-10-18" }] }, devisId: "dv1", fmt }) === null
    && R.envoiRelais({ compte: { ...compte, formation: true }, devisId: "dv1", fmt }) === null
    && R.envoiRelais({ compte, devisId: "autre", fmt }) === null);
  // ── La VRAIE fonction du serveur, sur une base jouée
  const { relayerDevisSansPdf } = await import("../api/_relaisDevisPdf.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [], contient: null };
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        let lignes = (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v)));
        if (q.contient) lignes = lignes.filter((l) => (l.data?.devis || []).some((d) => d.id === q.contient));
        return { data: structuredClone(lignes), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, limit() { return b; }, contains(_c, v) { q.contient = v?.devis?.[0]?.id; return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const envAvant = { c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  const errAvant = console.error;
  let envois = [], refuser = false, ok1, ok2, ok3, tables1, tables2, tables3;
  globalThis.fetch = async (url, opts) => {
    envois.push(JSON.parse(opts?.body || "{}"));
    if (refuser) return new Response(JSON.stringify({ error: { message: "Template not approved", code: 132001 } }), { status: 400 });
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.R", status: "accepted" }), { status: 200 });
  };
  try {
    console.error = () => {};
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    const entete = { id: `waent_${CLE}`, canal: "whatsapp_entete", wa_tel: CLE, proprietaire_id: "u-com", proprietaire_nom: "COM1" };
    tables1 = { users: [{ id: "c-manda", data: compte }], messages: [{ id: "l-pdf", data: lignePdf }, { id: entete.id, data: entete }] };
    ok1 = await relayerDevisSansPdf(fauxAdmin(tables1), lignePdf);
    tables2 = { users: [{ id: "c-manda", data: { ...compte, devis: [{ ...compte.devis[0], formation: true }] } }], messages: [] };
    const n2 = envois.length;
    ok2 = await relayerDevisSansPdf(fauxAdmin(tables2), lignePdf);
    tables2.envois = envois.length - n2;
    refuser = true;
    tables3 = { users: [{ id: "c-manda", data: compte }], messages: [] };
    ok3 = await relayerDevisSansPdf(fauxAdmin(tables3), lignePdf);
  } catch (err) { console.log("    (erreur de la chaîne jouée :", err?.message || err, ")"); }
  finally {
    console.error = errAvant; globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const parti = envois[0] || {};
  const ligneR = (tables1?.messages || []).find((l) => l.data?.wa_relais_de === "l-pdf")?.data;
  const fiche = (tables1?.messages || []).find((l) => l.id === `waent_${CLE}`)?.data;
  test("★★★ la chaîne jouée : `devis_disponible` part au client, SANS en-tête document",
    ok1 === true && parti.type === "template" && parti.template?.name === "devis_disponible" && parti.to === `+228${CLE}`
    && (parti.template?.components || []).length === 1 && parti.template.components[0].type === "body");
  test("★★ la ligne du fil dit que le message est parti SANS PDF, porte son numéro de suivi (coches) et le devis, au nom de celui qui avait envoyé le PDF",
    !!ligneR && /sans PDF/.test(ligneR.texte) && ligneR.wa_modele === "devis_disponible" && ligneR.devis_id === "dv1" && ligneR.de_id === "u-timo" && !!ligneR.wa_envoi_id && !ligneR.proprietaire_id);
  test("★★ la fiche légère suit SANS changer de propriétaire", fiche?.proprietaire_id === "u-com" && !!fiche?.derniere);
  test("★★★ le mur sur la vraie fonction : un devis de formation n'envoie RIEN", ok2 === false && tables2?.envois === 0);
  test("★★★ rien n'est écrit tant que WhatsApp n'a pas accepté : un refus du relais n'écrit aucune ligne", ok3 === false && (tables3?.messages || []).length === 0);
  const codeE = sansComm(lire("api/whatsapp-entrant.js"));
  const suivi = codeE.slice(codeE.indexOf("async function traiterSuivi"));
  test("★★★ le suivi : la marque `wa_relais_le` est posée AVEC la coche (même écriture), AVANT le relais — une seule fois",
    /const relais = relaisAFaire\(/.test(suivi) && /wa_statut: nouveau, \.\.\.\(relais \|\| relaisRecu \|\| relaisAcces \? \{ wa_relais_le: ts \} : \{\}\)/.test(suivi)
    && suivi.indexOf("wa_relais_le: ts") < suivi.indexOf("relayerDevisSansPdf(") && suivi.indexOf(".update({ data, updated_at: ts })") < suivi.indexOf("relayerDevisSansPdf("));
  test("★ la règle du relais ne lit jamais de clé secrète", !/YCLOUD_API_KEY|VITE_/.test(lire("src/lib/relaisDevisPdf.js")));
}

titre("63 📎 LE PDF DU DEVIS EST LÉGER, ET UNE CONNEXION COUPÉE SE DIT EN FRANÇAIS (18/10/2026, capture « Serveur injoignable : Failed to fetch »)");
{
  // ── Le PDF RÉEL du devis, mesuré : 780 Ko avant (images et texte non
  // compressés) → il doit tenir sous 300 Ko. Sur un téléphone à 45 Ko/s, c'est
  // 6 secondes d'envoi au lieu de 23.
  const dossier = mkdtempSync(join(tmpdir(), "bmi-pdf-poids-"));
  let poids = 0, poidsTemoin = 0, poidsPf = 0;
  try {
    const entree = join(dossier, "entree.mjs");
    writeFileSync(entree, `import { genererDevis, genererProforma } from ${JSON.stringify(join(process.cwd(), "src/pdf.js"))};
import { LOGO, CACHET_BMI_DEFAUT } from ${JSON.stringify(join(process.cwd(), "src/lib/constants.js"))};
import { jsPDF } from "jspdf";
export const poids = () => {
  const d = { numero: "AB12CD34", date: "18/10/2026", boutique: "BMI DEMAKPOE", client: "MANDA", tel: "+22890112233", titre: "Devis solaire", statut: "Proposé", par: "TIMO",
    lignes: [{ categorie: "Panneaux", designation: "Panneau 550W", qte: 4, pu: 85000, total: 340000 }, { categorie: "Batteries", designation: "Batterie 51,2V 200Ah", qte: 1, pu: 900000, total: 900000 }],
    total: 1240000, cachet: CACHET_BMI_DEFAUT, signature: "", bq: null };
  const s = genererDevis(d, LOGO, true).output("datauristring").split(",")[1];
  return Math.floor(s.length * 3 / 4);
};
// La PROFORMA (19/10/2026) : elle part elle aussi en PDF du numéro BMI
// (\`proforma_pdf\`). Quarante articles : le poids vient du logo, pas des lignes.
export const poidsProforma = () => {
  const lignes = Array.from({ length: 40 }, (_, i) => ({ article: "Batterie lithium 51,2V 200Ah n° " + i, qte: 2, pu: 85000, total: 170000 }));
  const p = { numero: "PRF-2026-0012", date: "19/10/2026", boutique: "BMI DEMAKPOE", client: "AMA", tel: "+22890112233", lignes, sous_total: 6800000, total: 6800000, par: "TIMO",
    bq: { nom: "BMI DEMAKPOE", adresse: "Lomé", tel: "91000000" } };
  const s = genererProforma(p, LOGO, true).output("datauristring").split(",")[1];
  return Math.floor(s.length * 3 / 4);
};
// Le TÉMOIN : le même logo dans un document NON compressé — il prouve que
// la compression commande bien le poids (sinon le contrôle ne prouverait rien).
export const temoin = () => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addImage(LOGO, "PNG", 14, 8, 30, 18);
  const s = doc.output("datauristring").split(",")[1];
  return Math.floor(s.length * 3 / 4);
};`);
    const sortie = join(dossier, "sortie.mjs");
    await build({ entryPoints: [entree], bundle: true, format: "esm", platform: "node", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" }, nodePaths: [join(process.cwd(), "node_modules")] });
    const P = await import(pathToFileURL(sortie).href);
    poids = P.poids(); poidsTemoin = P.temoin(); poidsPf = P.poidsProforma();
  } catch (err) { console.log("    (erreur de la mesure du PDF :", err?.message || err, ")"); }
  finally { rmSync(dossier, { recursive: true, force: true }); }
  test(`★★★ le PDF RÉEL d'un devis (logo + cachet) pèse moins de 300 Ko — mesuré : ${Math.round(poids / 1024)} Ko`, poids > 20000 && poids < 300 * 1024);
  test(`★★★ le PDF RÉEL d'une proforma de 40 articles (envoyé par \`proforma_pdf\`) pèse moins de 300 Ko — mesuré : ${Math.round(poidsPf / 1024)} Ko`, poidsPf > 20000 && poidsPf < 300 * 1024);
  test(`★ le TÉMOIN : le logo seul, sans compression, pèse plus de 300 Ko — mesuré : ${Math.round(poidsTemoin / 1024)} Ko (le piège existe toujours)`, poidsTemoin > 300 * 1024);
  const pdfJs = lire("src/pdf.js");
  test("★★ TOUS les documents PDF sont compressés (src/pdf.js et le partage de l'aperçu)",
    (pdfJs.match(/new jsPDF\(/g) || []).length >= 6 && (pdfJs.match(/new jsPDF\(\{[^}]*compress: true/g) || []).length === (pdfJs.match(/new jsPDF\(/g) || []).length
    && /new jsPDF\(\{[^}]*compress: true/.test(lire("src/components/ui.jsx")));

  // ── Une connexion coupée se dit en français, le détail dans la console
  const MR = await import(pathToFileURL(join(process.cwd(), "src/lib/motifReseau.js")).href);
  const errAvant = console.error; let journal = "";
  console.error = (...a) => { journal += a.join(" "); };
  let phrase = "";
  try { phrase = MR.motifReseau(new TypeError("Failed to fetch")); } finally { console.error = errAvant; }
  test("★★★ « Failed to fetch » n'arrive plus à l'écran : la phrase est en français, le mot du navigateur part dans la console",
    phrase === MR.MOTIF_RESEAU && !/fetch|injoignable/i.test(phrase) && /coupée/.test(phrase) && /Failed to fetch/.test(journal));
  const codeC = lire("src/supabaseClient.js"), codeW = lire("src/whatsapp.js");
  test("★★ plus aucun « Serveur injoignable : ${e…} » dans les appels au serveur (supabaseClient.js, whatsapp.js)",
    !/injoignable[^`]*\$\{e/.test(codeC) && !/injoignable[^`]*\$\{e/.test(codeW)
    && /return \{ error: motifReseau\(e\), reseau: true \}/.test(codeC));
  // ── Après une coupure, on ne SAIT PAS si le PDF est parti : l'écran le dit
  const M = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappModeles.js")).href);
  const msgI = M.messageDevisEnvoye("MANDA", true, { pdfDemande: true, pdf: false, motifPdf: MR.MOTIF_RESEAU, pdfIncertain: true });
  const msgR = M.messageDevisEnvoye("MANDA", true, { pdfDemande: true, pdf: false, motifPdf: "le modèle n'est pas encore approuvé." });
  test("★★★ connexion coupée : « Le PDF n'est PEUT-ÊTRE pas parti », et où regarder — jamais « n'est pas parti » affirmé",
    /peut-être pas parti/.test(msgI) && /téléphone BMI/.test(msgI) && !/Le PDF n'est pas parti/.test(msgI));
  test("★★ un refus de WhatsApp reste affirmé (« n'est pas parti », avec son motif)",
    /Le PDF n'est pas parti : le modèle n'est pas encore approuvé\./.test(msgR) && !/peut-être/.test(msgR));
  test("★★ le drapeau de la coupure traverse : appelAvecJeton → envoyerModele (`reseau`) → envoyerPdfDuDevis (`incertain`) → l'écran",
    /repli\(motifEchecWhatsApp\(\{[^)]*\}\), !!reponse\?\.reseau\)/.test(codeW) && /parti: false, reseau \}/.test(codeW)
    && /incertain: !!r\.reseau/.test(lire("src/screens/dimensionnement/Partages.jsx")) && /pdfIncertain: !!pdf\.incertain/.test(lire("src/screens/dimensionnement/Partages.jsx"))
    && (lire("src/screens/TousLesDevis.jsx").match(/lignePdfNonParti\(motifPdf, pdf\.incertain\)/g) || []).length === 2);
  test("★ l'envoi du numéro BMI a 60 secondes (le dépôt du PDF chez YCloud prend du temps)", /"api\/whatsapp\.js": \{ "maxDuration": 60 \}/.test(lire("vercel.json")));
}

titre("64 ⏳ UN ENVOI WHATSAPP NE PART PAS DEUX FOIS (18/10/2026, « les deux, lance » : le bouton se grise, et le filet de l'envoi)");
{
  // ── La règle pure
  const AD = await import(pathToFileURL(join(process.cwd(), "src/lib/antiDoublonEnvoi.js")).href);
  const reg = AD.creerRegistre();
  const k = AD.cleEnvoi({ modele: "relance_devis", tel: "+228 90 11 22 33", variables: ["KOFFI", "750 000 F"] });
  const kAutre = AD.cleEnvoi({ modele: "relance_devis", tel: "90112233", variables: ["KOFFI", "800 000 F"] });
  const kMeme = AD.cleEnvoi({ modele: "relance_devis", tel: "00228 90112233", variables: ["KOFFI", "750 000 F"] });
  AD.marquerEnCours(reg, k, 1000);
  const enCours = AD.critiqueDoublon(reg, kMeme, 1500);
  AD.marquerParti(reg, k, 2000);
  const dans59 = AD.critiqueDoublon(reg, k, 2000 + 59000), apres60 = AD.critiqueDoublon(reg, k, 2000 + 60000);
  test("★★★ la règle : le MÊME message (même modèle, même numéro écrit autrement, mêmes mots) est refusé pendant qu'il part, puis pendant UNE minute ; après, il repart",
    k === kMeme && enCours === AD.MOTIF_DOUBLON_EN_COURS && dans59 === AD.MOTIF_DOUBLON_PARTI && apres60 === "" && AD.DELAI_ANTI_DOUBLON_MS === 60000);
  test("★★ un message DIFFÉRENT (autres mots, autre modèle, autre client) part toujours",
    AD.critiqueDoublon(reg, kAutre, 2500) === "" && AD.critiqueDoublon(reg, AD.cleEnvoi({ modele: "devis_disponible", tel: "90112233", variables: ["KOFFI", "750 000 F"] }), 2500) === ""
    && AD.critiqueDoublon(reg, AD.cleEnvoi({ modele: "relance_devis", tel: "91112233", variables: ["KOFFI", "750 000 F"] }), 2500) === "");
  const reg2 = AD.creerRegistre(); AD.marquerEnCours(reg2, k, 0);
  const coince = AD.critiqueDoublon(reg2, k, AD.ATTENTE_MAX_EN_COURS_MS);
  AD.oublierEnvoi(reg2, k);
  test("★★ un envoi refusé ou coupé est OUBLIÉ (on réessaie tout de suite) ; un « en cours » jamais revenu ne coince plus après 2 minutes",
    AD.critiqueDoublon(reg2, k, 10) === "" && coince === "");
  const reg3 = AD.creerRegistre(); AD.marquerParti(reg3, k, 0); AD.marquerParti(reg3, kAutre, 50000); AD.nettoyerRegistre(reg3, 70000);
  test("★ le registre ne grandit pas sans fin (ce qui est parti depuis plus d'une minute s'efface)", reg3.size === 1 && reg3.has(kAutre));
  test("★★ les motifs se lisent en français et ne parlent pas de « livré » ni de « lu »",
    /déjà de partir à ce client/.test(AD.MOTIF_DOUBLON_PARTI) && /en train de partir/.test(AD.MOTIF_DOUBLON_EN_COURS) && !/livr|\blu\b/.test(AD.MOTIF_DOUBLON_PARTI + AD.MOTIF_DOUBLON_EN_COURS));

  // ── La VRAIE fonction d'envoi, le serveur joué (deux appuis en même temps)
  const dossierF = mkdtempSync(join(tmpdir(), "bmi-doublon-"));
  const fauxClient = join(dossierF, "fauxClient.mjs");
  writeFileSync(fauxClient, `export async function whatsappEnLigne(c) { globalThis.__appelsFaux = (globalThis.__appelsFaux || 0) + 1; await new Promise((r) => setTimeout(r, 30)); const v = globalThis.__reponseFausse; return typeof v === "function" ? v(c) : (v || { id: "Y" + globalThis.__appelsFaux, wamid: "W" }); }`);
  const sortieW = join(dossierF, "wa.mjs");
  let W = null;
  try {
    await build({ entryPoints: ["src/whatsapp.js"], bundle: true, format: "esm", platform: "node", outfile: sortieW, logLevel: "silent",
      plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fauxClient })); } }] });
    W = await import(pathToFileURL(sortieW).href);
  } catch (e) { console.log("   (build de whatsapp.js : " + (e?.message || e) + ")"); }
  const dits = [];
  let ouvert = 0;
  const appel = (vars) => W.envoyerModele({ tel: "90112233", modele: "relance_devis", variables: [...vars, "solaire", "18/10/2026"], espaceFormation: false, texteRepli: "texte", prevenir: async (m) => { dits.push(m); }, demanderConfirmation: async () => { ouvert++; return false; } });
  let a = {}, b = {}, c = {}, d = {}, e = {}, f = {}, ouvertApresC = -1;
  if (W) {
    [a, b] = await Promise.all([appel(["KOFFI", "750 000 F"]), appel(["KOFFI", "750 000 F"])]);
    c = await appel(["KOFFI", "750 000 F"]);
    ouvertApresC = ouvert;
    d = await appel(["KOFFI", "800 000 F"]);
    globalThis.__reponseFausse = { error: "refusé", statut: 502 };
    e = await appel(["AMA", "100 000 F"]);
    globalThis.__reponseFausse = undefined;
    f = await appel(["AMA", "100 000 F"]);
  }
  const appels = globalThis.__appelsFaux || 0;
  test("★★★ DEUX APPUIS EN MÊME TEMPS : UN seul appel au serveur ; le second est refusé « en train de partir », DIT par la fenêtre de l'écran, et WhatsApp ne s'ouvre PAS",
    a.auto === true && b.doublon === true && b.parti === false && /en train de partir/.test(b.motif) && dits.some((m) => /en train de partir/.test(m)));
  test("★★★ un troisième appui juste après : refusé « vient déjà de partir », toujours sans ouvrir WhatsApp",
    c.doublon === true && /déjà de partir/.test(c.motif) && ouvertApresC === 0);
  test("★★ un message aux autres mots part ; un envoi REFUSÉ par WhatsApp se réessaie tout de suite (pas de faux doublon)",
    d.auto === true && e.auto === false && !e.doublon && f.auto === true && appels === 4, `appels au serveur : ${appels}`);
  // La réponse libre de 📲 WhatsApp a le même filet
  let r1 = {}, r2 = {};
  if (W) [r1, r2] = await Promise.all([W.repondreWhatsApp({ tel: "90112233", texte: "Bonjour" }), W.repondreWhatsApp({ tel: "90112233", texte: "Bonjour" })]);
  test("★★ une RÉPONSE tapée deux fois (Entrée + clic) ne part qu'une fois", r1.parti === true && r2.parti === false && r2.doublon === true && globalThis.__appelsFaux === 5);
  try { rmSync(dossierF, { recursive: true, force: true }); } catch {}
  delete globalThis.__reponseFausse; delete globalThis.__appelsFaux;

  // ── Les boutons se grisent pendant l'envoi
  const ui = lire("src/components/ui.jsx");
  test("★★★ le verrou du bouton est un useRef posé dans le MÊME instant que l'appui (un état React seul laisse passer deux appuis rapprochés), libéré à la FIN du geste",
    /export function useEnvoiEnCours\(\)/.test(ui) && /const verrou = useRef\(false\);/.test(ui) && /if \(verrou\.current\) return undefined;\n\s*verrou\.current = true;/.test(ui)
    && /\} finally \{\n\s*verrou\.current = false;/.test(ui));
  test("★★ BoutonEnvoi : gris (disabled), « ⏳ Envoi en cours… » ; BoutonRond `envoi` : ⏳ et le titre « Envoi en cours… »",
    /export const LIBELLE_ENVOI_EN_COURS = "⏳ Envoi en cours…";/.test(ui) && /export function BoutonEnvoi\(/.test(ui) && /disabled=\{disabled \|\| enCours\}/.test(ui)
    && /\{occupe \? "⏳" : icone\}/.test(ui) && /disabled=\{autres\.disabled \|\| occupe\}/.test(ui));
  const boutons = [
    ["src/screens/Dettes.jsx", /<BoutonEnvoi libelleEnvoi="⏳" onClick=\{\(\) => relancer\(d\)\}/],
    ["src/screens/TousLesDevis.jsx", /teinte="vert" envoi onClick=\{\(\) => relancerDevis\(d\)\}/],
    ["src/screens/Ventes.jsx", /<BoutonEnvoi libelleEnvoi="⏳" onClick=\{\(\) => envoyerRecuLigne\(v\)\}/],
    ["src/screens/Ventes.jsx", /<BoutonEnvoi onClick=\{proformaWhatsApp\}/],
    ["src/screens/Utilisateurs.jsx", /<BoutonEnvoi libelleEnvoi="⏳" onClick=\{\(\) => \(u\.role === "client" \? envoyerFidelite\(u\)/],
    ["src/screens/Utilisateurs.jsx", /<BoutonEnvoi onClick=\{creer\} className=\{btnDark\}>Créer<\/BoutonEnvoi>/],
    ["src/screens/Clients.jsx", /<BoutonEnvoi onClick=\{creer\}/],
    ["src/screens/Clients.jsx", /<BoutonEnvoi onClick=\{\(\) => renvoyer\(c\)\}/],
    ["src/screens/Clients.jsx", /<BoutonEnvoi onClick=\{\(e\) => \{ e\.stopPropagation\(\); return contacter\(c\); \}\}/],
    ["src/screens/Depenses.jsx", /<BoutonEnvoi onClick=\{prevenirProprietaire\}/],
    ["src/screens/Prospects.jsx", /<BoutonEnvoi onClick=\{ajouter\}/],
    ["src/screens/Prospects.jsx", /titre="📱 Relancer par WhatsApp" envoi onClick=/],
    ["src/screens/Prospects.jsx", /titre="✅ Convertir en client" envoi onClick=/],
    ["src/screens/ClientsInstalles.jsx", /<BoutonEnvoi onClick=\{creerCompteClient\}/],
    ["src/screens/ClientsInstalles.jsx", /teinte="ambre" envoi onClick=\{\(\) => marquerTermine\(c\)\}/],
    ["src/screens/ClientsInstalles.jsx", /icone="📤" envoi onClick=\{\(\) => envoyerPourSignature\(c\)\} titre="📤 Envoyer pour signature"/],
    ["src/screens/ClientsInstalles.jsx", /teinte="rouge" envoi onClick=\{\(\) => envoyerAvenant\(c\)\}/],
    ["src/components/CompleterDevis.jsx", /<BoutonEnvoi onClick=\{\(\) => onEnregistrer\(/],
    ["src/screens/dimensionnement/Brouillons.jsx", /<BoutonEnvoi onClick=\{\(\) => envoyer\(b\)\} data-envoyer-brouillon/],
    ["src/screens/dimensionnement/Partages.jsx", /<BoutonEnvoi onClick=\{onEnvoyer\} disabled=\{!clientDevis\} data-envoyer-devis/],
  ];
  const manquent = boutons.filter(([f, re]) => !re.test(lire(f))).map(([f, re]) => `${f.split("/").pop()} ${String(re).slice(1, 40)}`);
  test("★★★ les boutons qui envoient du numéro BMI se grisent pendant l'envoi (relances, reçu, proforma, fidélité, créations de compte, renvoi d'accès, prospects, PV, avenant, loyer, devis, brouillons, ✍️ Compléter)", manquent.length === 0, manquent.join(" · "));
  test("★★ chaque geste RENDU sa promesse (sinon le bouton ne resterait gris qu'un instant) : les volets passent `() => envoi.envoyer(…)` sans accolades",
    ["Solaire", "Garage", "Autre"].every((v) => /const envoyerDevisWhatsApp = \(\) => envoi\.envoyer\(argumentsEnvoi\(\)\);/.test(lire(`src/screens/dimensionnement/${v}.jsx`))));
  const PA = lire("src/screens/dimensionnement/Partages.jsx");
  test("★★ le bouton du devis dit l'ÉTAPE : « ⏳ Envoi des accès… », « ⏳ Envoi du PDF… », « ⏳ Envoi du devis… », remise à zéro quoi qu'il arrive (finally)",
    /acces: "⏳ Envoi des accès…", pdf: "⏳ Envoi du PDF…", devis: "⏳ Envoi du devis…"/.test(PA)
    && /poserEtapeEnvoi\(ETAPES_ENVOI_DEVIS\.acces\);\n\s*const rAcces = await envoyerAccesSansRepli/.test(PA) && /if \(!pdf\.r\) poserEtapeEnvoi\(ETAPES_ENVOI_DEVIS\.devis\);/.test(PA)
    && /\} finally \{ poserEtapeEnvoi\(""\); \}/.test(PA) && /libelleEnvoi=\{\(\) => etapeEnvoi \|\| LIBELLE_ENVOI_EN_COURS\}/.test(PA)
    && /libelleEnvoi=\{\(\) => etapeEnvoi \|\| LIBELLE_ENVOI_EN_COURS\}/.test(lire("src/screens/dimensionnement/Brouillons.jsx")));
  const WS = lire("src/screens/Whatsapp.jsx");
  test("★★ 📲 WhatsApp : la réponse et « ✍️ Écrire » ont le même verrou (useRef), le bouton dit ⏳ / « ⏳ Envoi en cours… »",
    /const verrouEnvoi = useRef\(false\);/.test(WS) && /envoi \|\| verrouEnvoi\.current\) return;/.test(WS) && /if \(contact\.envoi \|\| verrouEnvoi\.current\) return;/.test(WS)
    && /\{contact\.envoi \? LIBELLE_ENVOI_EN_COURS : "Envoyer du numéro BMI"\}/.test(WS) && /\{envoi \? "⏳" : "➤"\}/.test(WS));
}

titre("65 👨‍💼 L'ASSISTANT RECONNAÎT CE QU'UN CONSEILLER A ÉCRIT, SE TAIT S'IL RÉPOND EN MÊME TEMPS, ET REVIENT PAR « ASSISTANT » (19/10/2026, « a et b, c oui, lance »)");
{
  const I = await import("../src/lib/assistantIA.js");
  const AW = await import("../src/lib/assistantWhatsapp.js");
  const CLE = "90771122";
  const ent = (id, ts, texte) => ({ id, canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_entrant: true, ts, texte });
  const pers = (id, ts, texte, nom = "TIMO") => ({ id, canal: "whatsapp", wa_tel: CLE, wa_entrant: false, de_id: `u-${nom.toLowerCase()}`, de_nom: nom, ts, texte });
  const assist = (id, ts, texte) => ({ ...AW.ligneAssistant({ cle: CLE, tel: `228${CLE}`, texte, etape: I.ETAPE_IA, ts, ia: true }), id });
  // ── « a » : la mémoire distingue l'assistant, une personne, un message parti seul
  const filA = [ent("e1", "2026-10-19T08:00:00.000Z", "le panneau 400 ?"), assist("a1", "2026-10-19T08:00:05.000Z", "Il est disponible."),
    pers("p1", "2026-10-19T08:10:00.000Z", "Je passe chez vous demain à 10 h pour la visite."),
    { id: "r1", canal: "whatsapp", wa_tel: CLE, wa_entrant: false, de_id: "relance-auto-bmi", de_nom: "Relance automatique BMI", wa_modele: "relance_devis_expiration", ts: "2026-10-19T08:11:00.000Z", texte: "📲 Envoyé du numéro BMI — relance" },
    ent("e2", "2026-10-19T09:00:00.000Z", "Vous venez à quelle heure ?")];
  const memA = I.messagesPourIA(filA);
  const cote = memA.find((m) => m.role === "assistant")?.content || "";
  test("★★★ « a » : dans la mémoire, le message d'une PERSONNE porte son nom, un message parti seul porte « automatique », l'assistant aucun",
    /^Il est disponible\.\n\[Message de TIMO, de l'équipe BMI TOGO\] Je passe chez vous demain à 10 h/.test(cote)
    && cote.includes(`${I.MARQUE_AUTO} 📲 Envoyé du numéro BMI`) && !/\[Message[^\]]*\] Il est disponible/.test(cote) && memA.map((m) => m.role).join() === "user,assistant,user");
  test("★★ la marque d'un compte réel donne son nom ; une tournée (« Relance automatique BMI », « bmi-systeme ») ou une ligne sans auteur = BMI",
    I.marqueEquipe({ de_id: "u1", de_nom: "ANGELE" }) === "[Message de ANGELE, de l'équipe BMI TOGO]"
    && I.marqueEquipe({ de_id: "rappel-entretien-bmi", de_nom: "Rappel automatique BMI" }) === I.MARQUE_AUTO
    && I.marqueEquipe({ de_id: "bmi-systeme", de_nom: "BMI TOGO" }) === I.MARQUE_AUTO && I.marqueEquipe({}) === I.MARQUE_AUTO);
  const CO = I.consignePour({});
  test("★★ la consigne explique les marques : ne jamais dire « je » à la place de la personne, ne pas la contredire ni la répéter, ne pas recopier ses montants",
    CO.includes("LES MESSAGES DE L'ÉQUIPE BMI TOGO") && CO.includes(`« ${I.MARQUE_EQUIPE} NOM, de l'équipe BMI TOGO] »`) && CO.includes(I.MARQUE_AUTO)
    && /tu ne dis jamais « je » à leur place/.test(CO) && /tu ne la contredis JAMAIS/.test(CO) && /tu ne le recopies pas/.test(CO));
  const rMarque = I.reponseDepuisIA({ texte: "[Message de TIMO, de l'équipe BMI TOGO] Il passe à 10 h, comme convenu.", effets: { prix: [] }, juge: { ok: true }, nouvelle: false });
  test("★★ une marque recopiée par l'IA ne part jamais ; une réponse qui n'était QUE la marque ne part pas (le menu reprend)",
    rMarque?.texte === "Il passe à 10 h, comme convenu." && I.reponseDepuisIA({ texte: "[Message automatique de BMI TOGO]", effets: { prix: [] }, juge: { ok: true }, nouvelle: false }) === null);
  // ── « c » : « assistant » après une personne
  const filC = (texte) => [ent("e1", "2026-10-19T08:00:00.000Z", "bonjour"), pers("p1", "2026-10-19T08:10:00.000Z", "Bonjour, je regarde votre demande."), ent("e9", "2026-10-19T08:20:00.000Z", texte)];
  const dC = AW.decisionAssistant({ fil: filC("assistant"), maintenant: "2026-10-19T08:20:00.000Z" });
  test("★★★ « c » : un client qui écrit « assistant » après une personne retrouve l'assistant sans attendre 24 h (la conversation continue)",
    dC.repondre === true && dC.retour === true && dC.etape === AW.ETAPE_MENU && I.conversationNouvelle(dC) === false);
  test("★★ « c » : tout autre message reste au conseiller ; une conversation CONFIÉE reste muette même sur « assistant »",
    AW.decisionAssistant({ fil: filC("merci, j'attends"), maintenant: "2026-10-19T08:20:00.000Z" }).repondre === false
    && AW.decisionAssistant({ fil: filC("assistant"), proprietaireId: "u-timo", maintenant: "2026-10-19T08:20:00.000Z" }).repondre === false);
  // ── « b » : une personne a écrit APRÈS le client
  const e = ent("e5", "2026-10-19T08:30:00.000Z", "assistant");
  test("★★★ « b » : une ligne d'une personne (ou partie de l'application) postérieure au message du client fait taire l'assistant ; la sienne, ou une plus ancienne, non",
    AW.bmiAEcritApres([e, pers("p9", "2026-10-19T08:30:03.000Z", "Je suis là")], e) === true
    && AW.bmiAEcritApres([e, assist("a9", "2026-10-19T08:30:03.000Z", "x")], e) === false
    && AW.bmiAEcritApres([pers("p0", "2026-10-19T08:29:00.000Z", "avant"), e], e) === false
    && AW.bmiAEcritApres([e, { id: "s", canal: "whatsapp", wa_systeme: true, ts: "2026-10-19T08:31:00.000Z", texte: "confiée" }], e) === false);
  // ── Le serveur, lu
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EN = sansComm(lire("api/whatsapp-entrant.js"));
  const corps = EN.slice(EN.indexOf("export async function repondreParAssistant"));
  test("★★ le serveur se tait si une personne a répondu pendant l'attente, et revérifie juste AVANT d'envoyer",
    /if \(messageDepasse\(filFrais, ligne\)\)[^\n]*\n\s*if \(bmiAEcritApres\(filFrais, ligne\)\) return \{ repondu: false/.test(corps)
    && corps.indexOf("bmiAEcritApres(filAvantEnvoi, ligne)") > 0 && corps.indexOf("bmiAEcritApres(filAvantEnvoi, ligne)") < corps.indexOf("envoyerYCloud(cleYCloud, corpsTexte("));
  // ── La VRAIE chaîne, sur une base jouée
  const { repondreParAssistant } = await import("../api/whatsapp-entrant.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [], de: 0, a: Infinity };
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        const lignes = (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v)));
        return { data: structuredClone(lignes.slice(q.de, q.a + 1)), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, order() { return b; }, range(de, a) { q.de = de; q.a = a; return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const lt = (m) => ({ id: m.id, data: m, updated_at: m.ts });
  const envAvant = { a: process.env.ANTHROPIC_API_KEY, b: process.env.ASSISTANT_IA_MODELE, c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  let envois = [], corpsIA = [], pendantIA = null;
  globalThis.fetch = async (url, opts) => {
    const c = JSON.parse(opts?.body || "{}");
    if (String(url).includes("anthropic")) { corpsIA.push(c); if (pendantIA) pendantIA(); return new Response(JSON.stringify({ content: [{ type: "text", text: "Me revoilà. TIMO vous a dit qu'il passe demain." }], stop_reason: "end_turn" }), { status: 200 }); }
    envois.push(c);
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.Y", status: "accepted" }), { status: 200 });
  };
  const bqs = [{ nom: "BMI DEMAKPOE" }];
  const appel = (ligne, tables) => repondreParAssistant({ admin: fauxAdmin(tables), boutiques: bqs, fil: tables.messages.map((l) => l.data), proprietaireId: "", cle: CLE, from: `228${CLE}`, client: null, ligne, attente: 0 });
  let r1, r2, r3, n1 = 0, n2 = 0, n3 = 0, memoire1 = "";
  try {
    process.env.ANTHROPIC_API_KEY = "cle-de-banc"; process.env.ASSISTANT_IA_MODELE = "modele-de-banc";
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    const base = () => [lt(ent("e1", "2026-10-19T08:00:00.000Z", "bonjour")), lt(assist("a1", "2026-10-19T08:00:05.000Z", "Bonjour !")), lt(pers("p1", "2026-10-19T08:10:00.000Z", "Je passe chez vous demain à 10 h."))];
    // 1) « assistant » après le conseiller : l'assistant revient et lit ce que TIMO a écrit.
    const m1 = ent("e2", "2026-10-19T08:20:00.000Z", "assistant");
    const t1 = { messages: [...base(), lt(m1)] };
    r1 = await appel(m1, t1); n1 = envois.length; memoire1 = JSON.stringify(corpsIA[0]?.messages || []);
    // 2) TIMO répond juste après le client (pendant l'attente) : l'assistant se tait.
    const m2 = ent("e3", "2026-10-19T08:20:00.000Z", "assistant");
    const t2 = { messages: [...base(), lt(m2), lt(pers("p2", "2026-10-19T08:20:02.000Z", "Oui, je suis toujours là."))] };
    envois = []; r2 = await appel(m2, t2); n2 = envois.length;
    // 3) TIMO répond PENDANT que l'IA écrit : rien ne part.
    const m3 = ent("e4", "2026-10-19T08:20:00.000Z", "assistant");
    const t3 = { messages: [...base(), lt(m3)] };
    pendantIA = () => { t3.messages.push(lt(pers("p3", "2026-10-19T08:20:04.000Z", "Je vous réponds tout de suite."))); pendantIA = null; };
    envois = []; r3 = await appel(m3, t3); n3 = envois.length;
  } catch (er) { console.log("    (erreur de la chaîne jouée :", er?.message || er, ")"); }
  finally {
    globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ ANTHROPIC_API_KEY: envAvant.a, ASSISTANT_IA_MODELE: envAvant.b, YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  test("★★★ la chaîne jouée « c » : « assistant » après TIMO → l'assistant répond, et sa mémoire porte « [Message de TIMO… »",
    r1?.repondu === true && n1 === 1 && memoire1.includes("[Message de TIMO, de l'équipe BMI TOGO] Je passe chez vous demain"), JSON.stringify(r1));
  test("★★★ la chaîne jouée « b » : TIMO répond pendant l'attente → rien ne part ; TIMO répond PENDANT que l'IA écrit → rien ne part non plus",
    r2?.repondu === false && n2 === 0 && r3?.repondu === false && n3 === 0, `${JSON.stringify(r2)} ${JSON.stringify(r3)}`);
}

// ──────────────────────────────────────────────────────────────
titre("66 📎 LE REÇU ET LA PROFORMA AVEC LEUR PDF — `recu_pdf`, `proforma_pdf` (19/10/2026, « Ab, Ba, Cb, textes ok »)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const trous = (t) => (t.match(/\{\{\d\}\}/g) || []).join("");
  test("★ les deux modèles : `recu_pdf` UTILITY à 4 trous, `proforma_pdf` MARKETING à 5 trous, tous deux à EN-TÊTE DOCUMENT et en service",
    M.MODELES.recu_pdf?.categorie === "utility" && M.MODELES.recu_pdf.variables.join(",") === "client,numero,date,detail"
    && M.MODELES.proforma_pdf?.categorie === "marketing" && M.MODELES.proforma_pdf.variables.join(",") === "client,numero,date,montant,fin"
    && M.modeleAvecDocument("recu_pdf") && M.modeleAvecDocument("proforma_pdf") && M.MODELES_EN_SERVICE.includes("recu_pdf") && M.MODELES_EN_SERVICE.includes("proforma_pdf"));
  test("★ les textes de Timo (« textes ok ») : trous dans l'ordre, « en pièce jointe », « sans valeur de reçu », le bloc des contacts en bas",
    trous(M.TEXTE_RECU_PDF) === "{{1}}{{2}}{{3}}{{4}}" && /^Bonjour \{\{1\}\}, merci pour votre confiance\.\nVotre reçu BMI TOGO N° \{\{2\}\} du \{\{3\}\} est en pièce jointe\.\n\n\{\{4\}\}\n\nPour toute question ou tout éclaircissement :\n📧 contact@bmitogo\.com/.test(M.TEXTE_RECU_PDF)
    && trous(M.TEXTE_PROFORMA_PDF) === "{{1}}{{2}}{{3}}{{4}}{{5}}" && /Offre valable jusqu'au \{\{5\}\}, sans valeur de reçu\. Vous la trouverez en pièce jointe\./.test(M.TEXTE_PROFORMA_PDF)
    && /BMI TOGO — Les bâtiments modernes et intelligents$/.test(M.TEXTE_RECU_PDF) && /BMI TOGO — Les bâtiments modernes et intelligents$/.test(M.TEXTE_PROFORMA_PDF)
    && M.texteRecu({ modele: "recu_pdf", variables: ["A", "B", "C", "D"] }).startsWith("Bonjour A, merci"));
  const f = (n) => `${Number(n).toLocaleString("fr-FR").replace(/ /g, " ")} F`;
  const vente = { id: "v1", numero: "BMID-2026-0050", date: "2026-10-19", boutique: "BMI DEMAKPOE", client: "CHEF EZO", tel: "90112233", paiement: "Espèces", articles: [{ nom: "Panneau", qte: 2, pu: 9000 }] };
  const rv = M.envoiRecuVente({ vente, boutique: { tel: "91000000" }, montant: 18000, fmt: f, dFR: (x) => x.split("-").reverse().join("/") });
  const rvd = M.envoiRecuVenteDetail({ vente: { ...vente, paiement: "Crédit (dette)" }, boutique: { tel: "91000000" }, montant: 300000, avance: 100000, reste: 200000, lignes: [{ article: "Batterie", qte: 1 }], fmt: f, dFR: (x) => x.split("-").reverse().join("/") });
  const dette = { id: "d1", numero: "BMID-DET-2026-0003", client: "MR ERIC", tel: "90112233", montant: 150000, paye: 50000 };
  const rr = M.envoiRecuReglement({ dette, versement: { montant: 50000, date: "2026-10-19", paiement: "Espèces" }, boutique: {}, fmt: f, dFR: (x) => x.split("-").reverse().join("/") });
  const rs = M.envoiRecuReservation({ reservation: { ...dette, date: "2026-10-19", boutique: "BMI DEMAKPOE", montant: 300000, paye: 100000 }, boutique: {}, fmt: f, dFR: (x) => x.split("-").reverse().join("/") });
  const pv = M.recuPdfDepuis(rv), pvd = M.recuPdfDepuis(rvd, { numero: "BMID-DET-2026-0009" }), pr = M.recuPdfDepuis(rr), ps = M.recuPdfDepuis(rs);
  test("★★ le reçu PDF se DÉDUIT du reçu en texte (mêmes mots) : vente comptant, vente à crédit (le numéro écrit SUR le PDF, celui de sa dette), versement, réservation",
    JSON.stringify(pv?.variables) === JSON.stringify(["CHEF EZO", "BMID-2026-0050", "19/10/2026", "Montant : 18 000 F, payé en espèces."])
    && pvd?.variables[1] === "BMID-DET-2026-0009" && pvd.variables[3] === "Montant : 300 000 F, à crédit : avance 100 000 F, reste 200 000 F."
    && JSON.stringify(pr?.variables) === JSON.stringify(["MR ERIC", "BMID-DET-2026-0003", "19/10/2026", "Versement de 50 000 F en espèces, il reste 100 000 F sur un total de 150 000 F."])
    && ps?.variables[3] === "Réservation : total 300 000 F, avance 100 000 F, reste 200 000 F." && ps.variables[1] === "BMID-DET-2026-0003", JSON.stringify([pv, pvd, pr, ps]));
  test("★★ un DÉPÔT CHANTIER n'a pas de PDF (il ne part que par son modèle, « C b » du 13/10) ; un envoi vide non plus",
    M.recuPdfDepuis({ modele: "recu_depot_chantier", variables: ["a", "b", "c", "d", "e", "f", "g"] }) === null && M.recuPdfDepuis(null) === null);
  const env = M.envoiProforma({ proforma: { client: "AMA", tel: "90112233", numero: "PF-12", date: "19/10/2026", boutique: "BMI DEMAKPOE", total: 450000, lignes: [{ article: "Onduleur", qte: 1 }] }, boutique: {}, fin: "03/11/2026", fmt: f });
  test("★★ la proforma PDF se déduit de l'envoi `proforma` (client, numéro, date, total, fin de l'offre) ; la liste des articles est DANS le PDF",
    JSON.stringify(M.proformaPdfDepuis(env)?.variables) === JSON.stringify(["AMA", "PF-12", "19/10/2026", "450 000 F", "03/11/2026"]) && M.proformaPdfDepuis(rv) === null);
  test("★★ la ligne du fil : celle d'une VENTE est privée (comme `recu_vente`), celle d'un versement ou d'une réservation ne l'est pas (comme `recu_reglement`) ; elle dit « 📎 PDF joint »",
    M.lignePriveeEnvoi("recu_pdf", { vente_id: "v1" }) === true && M.lignePriveeEnvoi("recu_pdf", { dette_id: "d1" }) === false && M.lignePriveeEnvoi("recu_vente", {}) === true
    && /📎 PDF joint/.test(M.ligneEnvoiModele("recu_pdf", pr.variables)) && /📎 PDF joint/.test(M.ligneEnvoiModele("proforma_pdf", M.proformaPdfDepuis(env).variables)) && /📎 PDF joint/.test(M.ligneMasquee("recu_pdf")));

  // ── LA VRAIE CHAÎNE : envoyerRecuSansQuestion, le serveur joué
  const dossierF = mkdtempSync(join(tmpdir(), "bmi-recupdf-"));
  const fauxClient = join(dossierF, "fauxClient.mjs");
  writeFileSync(fauxClient, `export async function whatsappEnLigne(c) { (globalThis.__appelsRecu = globalThis.__appelsRecu || []).push(c); const v = globalThis.__reponseRecu; return typeof v === "function" ? v(c) : (v || { id: "Y" + globalThis.__appelsRecu.length, wamid: "W" }); }`);
  const sortieW = join(dossierF, "wa.mjs");
  let W = null;
  try {
    await build({ entryPoints: ["src/whatsapp.js"], bundle: true, format: "esm", platform: "node", outfile: sortieW, logLevel: "silent",
      plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fauxClient })); } }] });
    W = await import(pathToFileURL(sortieW).href);
  } catch (e) { console.log("   (build de whatsapp.js : " + (e?.message || e) + ")"); }
  const PDF = { nom: "Reçu.pdf", mime: "application/pdf", taille: 3, donnees: "JVBE" };
  // ⚠ Chaque essai parle à un AUTRE client : le filet anti-doublon (64)
  // refuserait sinon le même message renvoyé dans la minute.
  let tour = 0;
  const jouer = async ({ reponse, espaceFormation = false, fabriquer = async () => PDF, ref = { dette_id: "d1" }, envoi = rr }) => {
    globalThis.__appelsRecu = []; globalThis.__reponseRecu = reponse; let etat = { messages: [] }; let fabrique = 0; tour++;
    const tel = `9011${String(2200 + tour)}`;
    const phrase = W ? await W.envoyerRecuSansQuestion({ envoi, tel, nom: "MR ERIC", espaceFormation, profile: { id: "u1", nom: "ANGELE" }, ref,
      save: (fn) => { etat = fn(etat); }, pdf: { numero: "BMID-DET-2026-0003", fabriquer: async () => { fabrique++; return fabriquer(); } } }) : "";
    return { phrase, appels: globalThis.__appelsRecu.slice(), etat, fabrique };
  };
  const a = await jouer({});
  const b = await jouer({ reponse: (c) => (c.modele === "recu_pdf" ? { error: "The template is unavailable, status: PENDING", statut: 502 } : { id: "Y2" }) });
  const c = await jouer({ espaceFormation: true });
  const d = await jouer({ fabriquer: async () => { throw new Error("html2canvas"); } });
  const e = await jouer({ ref: { vente_id: "v1" }, envoi: rv });
  globalThis.__reponseRecu = undefined;
  const ligne = (r) => (r.etat.messages || []).find((m) => m.canal === "whatsapp");
  test("★★★ « B a » : le reçu part AVEC SON PDF — UN appel, `recu_pdf`, le fichier joint, la ligne `recu_pdf` dans le fil, et la phrase le dit",
    a.appels.length === 1 && a.appels[0].modele === "recu_pdf" && a.appels[0].fichier?.donnees === "JVBE" && ligne(a)?.wa_modele === "recu_pdf" && /avec le PDF/.test(a.phrase), JSON.stringify(a.appels.map((x) => x.modele)));
  test("★★★ `recu_pdf` refusé (pas encore approuvé par Meta) → le reçu en TEXTE d'aujourd'hui part juste après, et c'est lui qui entre dans le fil",
    b.appels.map((x) => x.modele).join(",") === "recu_pdf,recu_reglement" && !b.appels[1].fichier && ligne(b)?.wa_modele === "recu_reglement" && !/avec le PDF/.test(b.phrase));
  test("★★ en FORMATION : le PDF n'est même pas fabriqué, rien ne part ; un PDF impossible à fabriquer → le reçu en texte part quand même",
    c.appels.length === 0 && c.fabrique === 0 && d.appels.map((x) => x.modele).join(",") === "recu_reglement");
  test("★★ le reçu d'une VENTE : sa ligne est PRIVÉE (phrase neutre, rien du montant) ; celui d'un versement ne l'est pas",
    ligne(e)?.wa_prive === true && !/18 000/.test(ligne(e)?.texte || "") && /PDF joint/.test(ligne(e)?.texte || "") && !ligne(a)?.wa_prive && /50 000 F/.test(ligne(a)?.texte || ""));
  try { rmSync(dossierF, { recursive: true, force: true }); } catch {}

  // ── LES ÉCRANS
  const VT = sansComm(lire("src/screens/Ventes.jsx")), DT = sansComm(lire("src/screens/Dettes.jsx")), EP = sansComm(lire("src/components/encaissementPose.js"));
  const corpsRecu = (VT.match(/const envoyerRecuDuNumeroBmi = async \(vente, etat\) => \{[\s\S]*?\n  \};/) || [""])[0];
  test("★★ 💰 Ventes : le reçu AVEC SON PDF est essayé AVANT les deux reçus en texte (encaissement ET bouton de la ligne), le numéro écrit sur le PDF, le reçu imprimé rendu en PDF",
    /const rp = await envoyerRecuPdf\(\{/.test(corpsRecu) && /numero: numeroDuRecuDeVente\(etat, vente\)/.test(corpsRecu) && /fabriquer: \(\) => fichierRecuDeVente\(etat, vente, bq,/.test(corpsRecu)
    && corpsRecu.indexOf("envoyerRecuPdf") < corpsRecu.indexOf("for (const envoi of envois)") && /ref: \{ vente_id: vente\.id \}/.test(corpsRecu));
  test("★★ les trois reçus de versement et les deux réservations passent `pdf` : 📋 Dettes (versement, réservation), 🏠 la pose seule, 💰 Ventes (réservation)",
    (DT.match(/pdf: \{ numero: numeroRecuDette\(/g) || []).length === 2 && /fichierRecuVersement\(avecInfoTravaux\(db, dApres\)/.test(DT)
    && /pdf: \{ numero: numeroRecuDette\(detteApres\), fabriquer: \(\) => fichierRecuVersement\(/.test(EP)
    && /pdf: \{ numero: numeroRecuDette\(reservation\), fabriquer: \(\) => fichierRecuVersement\(reservation,/.test(VT));
  const corpsPf = (VT.match(/const envoiPdf = proformaPdfDepuis\(envoi\);[\s\S]*?const r = await envoyerModele\(\{/) || [""])[0];
  test("★★ « C b » : la proforma part AVEC SON PDF à chaque fois (sans case), le MÊME PDF que celui téléchargé, sans repli ; refusée, le modèle `proforma` d'aujourd'hui prend le relais",
    /const docPf = genererProforma\([^;]*LOGO, true\);/.test(VT) && /docPf\.save\(nomPdfPf\);/.test(VT)
    && /modele: envoiPdf\.modele, variables: envoiPdf\.variables, espaceFormation: !!bqPf\.formation, sansRepli: true, fichier: fichierPf/.test(corpsPf)
    && corpsPf.length > 0 && !/joindrePdf|data-joindre-pdf/.test(corpsPf));
  test("★ le reçu se rend SANS s'imprimer (`rendre`), sans le duplicata de la boutique, et `fichierPdfDepuisHtml` est écrit UNE fois (components/ui.jsx)",
    /if \(rendre\) return html;/.test(lire("src/lib/impression.js")) && (lire("src/lib/impression.js").match(/if \(rendre\) return html;/g) || []).length === 2
    && /export async function fichierPdfDepuisHtml\(/.test(lire("src/components/ui.jsx")) && !/export async function fichierPdfDepuisHtml/.test(lire("src/lib/impression.js")));
  test("★★ (67) la ligne du PDF d'un VERSEMENT garde le reçu en texte pour un relais (`wa_relais_texte`) ; celle d'une VENTE, privée, n'en garde AUCUN",
    ligne(a)?.wa_relais_texte?.modele === "recu_reglement" && ligne(a).wa_relais_texte.variables.length === 7 && !("wa_relais_texte" in (ligne(e) || {})), JSON.stringify(ligne(a)?.wa_relais_texte));
}

titre("67 📎 LE REÇU ET LA PROFORMA REPARTENT EN TEXTE QUAND META REJETTE LE PDF (19/10/2026, « prendre ceux du texte »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const R = await import(pathToFileURL(join(process.cwd(), "src/lib/relaisRecuPdf.js")).href);
  const CLE = "99021377";
  const f = (n) => `${Number(n).toLocaleString("fr-FR").replace(/ /g, " ")} F`;
  const rr = M.envoiRecuReglement({ dette: { id: "d1", numero: "BMID-DET-2026-0003", client: "MR ERIC", tel: `228${CLE}`, montant: 150000, paye: 50000 }, versement: { montant: 50000, date: "2026-10-19", paiement: "Espèces" }, boutique: {}, fmt: f, dFR: (x) => x.split("-").reverse().join("/") });
  const echec = { etat: "echec", le: "2026-10-19T18:02:05.000Z", motif: "header: Template does not contain title component" };
  const ligneVersement = { id: "l-rp", canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_nom: "MR ERIC", de_id: "u-ang", de_nom: "ANGELE", wa_modele: "recu_pdf", dette_id: "d1", texte: "📲 …, 📎 PDF joint.", wa_relais_texte: { modele: rr.modele, variables: rr.variables } };
  const ligneVente = { id: "l-rv", canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_nom: "CHEF EZO", de_id: "u-ang", de_nom: "ANGELE", wa_modele: "recu_pdf", vente_id: "v1", wa_prive: true, texte: M.ligneMasquee("recu_pdf") };
  test("★★★ la règle : un ❌ sur un `recu_pdf` / `proforma_pdf` pas encore relayé → relais ; jamais deux fois, jamais sur une coche ordinaire, jamais sans texte ni vente, jamais pour un autre modèle",
    R.relaisRecuAFaire(ligneVersement, echec) === true && R.relaisRecuAFaire(ligneVente, echec) === true
    && R.relaisRecuAFaire({ ...ligneVersement, wa_modele: "proforma_pdf" }, echec) === true
    && R.relaisRecuAFaire({ ...ligneVersement, wa_relais_le: "x" }, echec) === false
    && R.relaisRecuAFaire(ligneVersement, { etat: "lu", le: "x" }) === false
    && R.relaisRecuAFaire({ ...ligneVersement, wa_relais_texte: null }, echec) === false
    && R.relaisRecuAFaire({ ...ligneVente, wa_modele: "proforma_pdf" }, echec) === false
    && R.relaisRecuAFaire({ ...ligneVersement, wa_modele: "devis_pdf" }, echec) === false);
  test("★★ le texte rangé n'est valable que pour les messages permis, le bon nombre de trous, tous remplis",
    R.relaisTexteValide({ modele: rr.modele, variables: rr.variables }) === true
    && R.relaisTexteValide({ modele: "espace", variables: ["a", "b", "c"] }) === false
    && R.relaisTexteValide({ modele: rr.modele, variables: rr.variables.slice(1) }) === false
    && R.relaisTexteValide({ modele: rr.modele, variables: [...rr.variables.slice(1), " "] }) === false);
  test("★★★ ce que la ligne du PDF garde : le texte pour un versement ou une proforma, RIEN pour une vente (privée), rien pour un autre modèle",
    R.champRelaisTexte("recu_pdf", { dette_id: "d1" }, rr).wa_relais_texte?.modele === "recu_reglement"
    && Object.keys(R.champRelaisTexte("recu_pdf", { vente_id: "v1" }, rr)).length === 0
    && Object.keys(R.champRelaisTexte("recu_reglement", { dette_id: "d1" }, rr)).length === 0
    && Object.keys(R.champRelaisTexte("recu_pdf", { dette_id: "d1" }, null)).length === 0);
  const vente = { id: "v1", numero: "BMID-2026-0050", date: "2026-10-19", boutique: "BMI DEMAKPOE", client: "CHEF EZO", tel: `228${CLE}`, paiement: "Espèces", articles: [{ article: "Panneau 550W", qte: 2, pu: 9000 }] };
  const bq = { nom: "BMI DEMAKPOE", tel: "91000000" };
  const ev = R.envoisDuRelais({ ligne: ligneVente, vente, boutique: bq });
  test("★★★ une VENTE : le serveur RECOMPOSE ses reçus par la fabrique de l'envoi — le détaillé d'abord, le court ensuite",
    ev.map((x) => x.modele).join(",") === "recu_vente_detail,recu_vente" && ev[0].variables[0] === "CHEF EZO" && /Panneau 550W/.test(ev[0].variables.join(" ")), JSON.stringify(ev.map((x) => x.modele)));
  test("★★★ le mur : une vente ou une boutique de FORMATION, une vente à la corbeille, une autre vente ne relaient RIEN",
    R.envoisDuRelais({ ligne: ligneVente, vente: { ...vente, formation: true }, boutique: bq }).length === 0
    && R.envoisDuRelais({ ligne: ligneVente, vente, boutique: { ...bq, formation: true } }).length === 0
    && R.envoisDuRelais({ ligne: ligneVente, vente: { ...vente, supprime_le: "2026-10-19" }, boutique: bq }).length === 0
    && R.envoisDuRelais({ ligne: ligneVente, vente: { ...vente, id: "v2" }, boutique: bq }).length === 0
    && R.envoisDuRelais({ ligne: ligneVente, vente: null }).length === 0);
  const lv = R.ligneRelaisRecu({ id: "x", ligne: ligneVente, envoi: ev[1], ts: "2026-10-19T18:02:06.000Z" });
  const lr = R.ligneRelaisRecu({ id: "y", ligne: ligneVersement, envoi: rr, ts: "2026-10-19T18:02:06.000Z" });
  test("★★ la ligne du relais : une vente reste PRIVÉE (rien du montant), un versement dit « sans PDF » ; au nom de celui qui avait envoyé le PDF, sans propriétaire",
    lv?.wa_prive === true && !/18 000/.test(lv.texte) && lv.vente_id === "v1" && lv.wa_relais_de === "l-rv"
    && /sans PDF/.test(lr?.texte || "") && /50.000 F/.test(lr.texte) && lr.de_id === "u-ang" && !lr.proprietaire_id && !lr.wa_prive && lr.dette_id === "d1");

  // ── La VRAIE fonction du serveur, sur une base jouée
  const { relayerRecuSansPdf } = await import("../api/_relaisRecuPdf.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [] };
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        return { data: structuredClone((tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v)))), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, limit() { return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const envAvant = { c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  const errAvant = console.error;
  let envois = [], refuser = () => false, res = {};
  globalThis.fetch = async (url, opts) => {
    const corps = JSON.parse(opts?.body || "{}");
    envois.push(corps);
    if (refuser(corps)) return new Response(JSON.stringify({ error: { message: "Template not approved", code: 132001 } }), { status: 400 });
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.R", status: "accepted" }), { status: 200 });
  };
  const entete = () => ({ id: `waent_${CLE}`, data: { id: `waent_${CLE}`, canal: "whatsapp_entete", wa_tel: CLE, proprietaire_id: "u-com", proprietaire_nom: "COM1" } });
  const base = (venteData = vente, bqData = bq) => ({ ventes: [{ id: "v1", data: venteData }], boutiques: [{ id: "b1", data: bqData }], dettes: [], messages: [entete()] });
  const jouer = async (cle, ligne, tables, refus = () => false) => {
    const n = envois.length; refuser = refus;
    const ok = await relayerRecuSansPdf(fauxAdmin(tables), ligne);
    res[cle] = { ok, tables, envois: envois.slice(n) };
  };
  try {
    console.error = () => {};
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    await jouer("versement", ligneVersement, { ventes: [], boutiques: [], dettes: [], messages: [entete()] });
    await jouer("vente", ligneVente, base());
    await jouer("formation", ligneVente, base({ ...vente, formation: true }));
    await jouer("refus", ligneVersement, { ventes: [], boutiques: [], dettes: [], messages: [] }, () => true);
    await jouer("court", ligneVente, base(), (c) => c.template?.name === "recu_vente_detail");
  } catch (err) { console.log("    (erreur de la chaîne jouée :", err?.message || err, ")"); }
  finally {
    console.error = errAvant; globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const relais = (k) => (res[k]?.tables?.messages || []).find((l) => l.data?.wa_relais_de)?.data;
  const p = res.versement?.envois?.[0] || {};
  test("★★★ la chaîne jouée (versement) : `recu_reglement` part au client, en texte SANS en-tête document, avec les trous rangés",
    res.versement?.ok === true && res.versement.envois.length === 1 && p.template?.name === "recu_reglement" && p.to === `+228${CLE}`
    && (p.template?.components || []).length === 1 && p.template.components[0].type === "body"
    && JSON.stringify(p.template.components[0].parameters.map((x) => x.text)) === JSON.stringify(rr.variables));
  test("★★ la ligne du fil (versement) : « sans PDF », son numéro de suivi (coches), et la fiche légère suit SANS changer de propriétaire",
    /sans PDF/.test(relais("versement")?.texte || "") && !!relais("versement")?.wa_envoi_id
    && (res.versement?.tables?.messages || []).find((l) => l.id === `waent_${CLE}`)?.data?.proprietaire_id === "u-com");
  test("★★★ la chaîne jouée (vente) : la vente RELUE, le reçu détaillé part, la ligne reste PRIVÉE",
    res.vente?.ok === true && res.vente.envois.map((x) => x.template?.name).join(",") === "recu_vente_detail" && relais("vente")?.wa_prive === true && relais("vente")?.wa_modele === "recu_vente_detail");
  test("★★★ le mur sur la vraie fonction : une vente de formation n'envoie RIEN, n'écrit RIEN", res.formation?.ok === false && res.formation.envois.length === 0 && !relais("formation"));
  test("★★★ rien n'est écrit tant que WhatsApp n'a pas accepté : un refus du texte n'écrit aucune ligne", res.refus?.ok === false && (res.refus?.tables?.messages || []).length === 0);
  test("★★ le détaillé refusé → le court part, et c'est lui qui entre dans le fil",
    res.court?.ok === true && res.court.envois.map((x) => x.template?.name).join(",") === "recu_vente_detail,recu_vente" && relais("court")?.wa_modele === "recu_vente");
  const codeE = sansComm(lire("api/whatsapp-entrant.js"));
  const suivi = codeE.slice(codeE.indexOf("async function traiterSuivi"));
  test("★★★ le suivi : la marque `wa_relais_le` est posée AVEC la coche, AVANT le relais du reçu — une seule fois, et jamais en plus du relais d'un devis",
    /const relaisRecu = !relais && relaisRecuAFaire\(/.test(suivi) && suivi.indexOf(".update({ data, updated_at: ts })") < suivi.indexOf("relayerRecuSansPdf(")
    && /if \(relaisRecu\) await relayerRecuSansPdf\(admin,/.test(suivi));
  test("★★ 💰 Ventes et src/whatsapp.js rangent le texte du relais sur la ligne du PDF (`relais: envoi`)",
    /relais: envoi/.test(sansComm(lire("src/screens/Ventes.jsx"))) && /\.\.\.champRelaisTexte\(modele, ref, relais\)/.test(sansComm(lire("src/whatsapp.js"))));
  test("★ la règle du relais ne lit jamais de clé secrète", !/YCLOUD_API_KEY|VITE_/.test(lire("src/lib/relaisRecuPdf.js")) && !/YCLOUD_API_KEY|VITE_/.test(lire("src/lib/recuDeVente.js")));
}

{
  titre("68 🎤 LES NOTES VOCALES COMME SUR WHATSAPP : LE LECTEUR, LE CHARGEMENT TOUT SEUL, LE MICRO (20/10/2026, « A avec a2, B lance »)");
  const O = await import(pathToFileURL(join(process.cwd(), "src/lib/oggOpus.js")).href);
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // --- Les règles pures, sous Node ---
  test("★★ le premier octet d'un paquet Opus dit sa durée (RFC 6716) : 20 ms = 960 échantillons, 3 trames de 20 ms = 2 880, 60 ms SILK = 2 880",
    O.echantillonsOpus(Uint8Array.of((15 << 3) | 0)) === 960 && O.echantillonsOpus(Uint8Array.of((31 << 3) | 3, 3)) === 2880
    && O.echantillonsOpus(Uint8Array.of((3 << 3) | 0)) === 2880 && O.echantillonsOpus(new Uint8Array(0)) === 0);
  // Le contrôle des pages Ogg, recalculé ici par une AUTRE écriture (bit à bit, sans table).
  const crcBits = (o) => { let c = 0; for (const b of o) { c ^= b << 24; for (let k = 0; k < 8; k++) c = (c & 0x80000000) ? ((c << 1) ^ 0x04c11db7) : (c << 1); c >>>= 0; } return c >>> 0; };
  const tete = Uint8Array.from([0x4f,0x70,0x75,0x73,0x48,0x65,0x61,0x64,1,1,0x38,0x01,0x80,0xbb,0,0,0,0,0]);
  const paquets = Array.from({ length: 300 }, (_, i) => { const p = new Uint8Array(i % 7 === 0 ? 300 : 60); p[0] = (31 << 3); p[1] = i & 255; return p; });
  const ogg = O.oggDepuisOpus({ tete, paquets });
  const pages = []; let pos = 0, pagesOk = true;
  while (pos < ogg.octets.length) {
    const o = ogg.octets;
    if (String.fromCharCode(o[pos], o[pos+1], o[pos+2], o[pos+3]) !== "OggS") { pagesOk = false; break; }
    const nseg = o[pos + 26]; let corps = 0; for (let k = 0; k < nseg; k++) corps += o[pos + 27 + k];
    const page = o.slice(pos, pos + 27 + nseg + corps);
    const v = new DataView(page.buffer); const crc = v.getUint32(22, true); v.setUint32(22, 0, true);
    pages.push({ drapeaux: page[5], granule: v.getUint32(6, true), numero: v.getUint32(18, true), crcJuste: crcBits(page) === crc, nseg });
    pos += page.length;
  }
  test("★★★ le fichier Ogg fabriqué : chaque page commence par « OggS », porte le BON contrôle (recalculé autrement), se suit en numéros, ≤ 255 segments",
    pagesOk && pages.length > 3 && pages.every((p, i) => p.crcJuste && p.numero === i && p.nseg <= 255), JSON.stringify(pages.slice(0, 4)));
  test("★★ première page = début (BOS), dernière = fin (EOS) ; la position avance ; la durée = échantillons − pré-saut (300 × 20 ms − 312)",
    pages[0].drapeaux === 0x02 && pages[pages.length - 1].drapeaux === 0x04 && pages.slice(2).every((p, i, t) => i === 0 || p.granule > t[i - 1].granule)
    && Math.abs(ogg.duree - (300 * 960 - 312) / 48000) < 1e-9);
  test("★ un fichier qui n'est pas de l'Opus en WebM rend null (jamais un faux fichier)", O.webmVersOgg(new Uint8Array([1, 2, 3])) === null && O.webmVersOgg(new Uint8Array(0)) === null);
  test("★ la durée se lit comme WhatsApp : 0:07, 1:35, 5:00", O.dureeVocale(7.4) === "0:07" && O.dureeVocale(95) === "1:35" && O.dureeVocale(300) === "5:00" && O.DUREE_MAX_VOCAL === 300);
  test("★★ la ligne d'une note envoyée : type « voice », sa durée — un son MP4 (iPhone) reste un simple son ; jamais le fichier",
    C.mediaEnvoye({ nom: "n.ogg", mime: "audio/ogg", taille: 9000, vocal: true, duree: 7.4, donnees: "AAA", blob: {} }).type === "voice"
    && C.mediaEnvoye({ nom: "n.ogg", mime: "audio/ogg", taille: 9000, vocal: true, duree: 7.4 }).duree === 7
    && C.mediaEnvoye({ nom: "n.m4a", mime: "audio/mp4", taille: 9000, vocal: false, duree: 3 }).type === "audio"
    && !("donnees" in C.mediaEnvoye({ nom: "n.ogg", mime: "audio/ogg", taille: 9, vocal: true, donnees: "AAA" }))
    && !("blob" in C.mediaEnvoye({ nom: "n.ogg", mime: "audio/ogg", taille: 9, vocal: true, blob: {} }))
    && C.critiqueFichier({ nom: "n.ogg", mime: "audio/ogg", taille: 9000 }) === "" && C.estNoteVocale({ vocal: true, mime: "audio/ogg" }) && !C.estNoteVocale({ vocal: true, mime: "audio/mp4" }));
  const Y = await import(pathToFileURL(join(process.cwd(), "api/_ycloud.js")).href);
  test("★★ le serveur : une note vocale .ogg porte `voice: true` (Meta), un son ordinaire non, jamais de phrase sur un son",
    Y.corpsMedia("+1", "+2", { type: "audio", id: "x", vocal: true, legende: "a" }).audio.voice === true
    && !("voice" in Y.corpsMedia("+1", "+2", { type: "audio", id: "x" }).audio) && !("caption" in Y.corpsMedia("+1", "+2", { type: "audio", id: "x", vocal: true, legende: "a" }).audio));
  const W = sansComm(lire("api/whatsapp.js"));
  test("★★ la marque vocale part du fichier REÇU (revérifiée par `estNoteVocale`), et si WhatsApp la refuse, le son repart UNE fois sans elle",
    /vocal: !!fichier\.vocal/.test(W) && /vocal: estNoteVocale\(piece\)/.test(W) && /if \(!resultat\.ok && corps\?\.audio\?\.voice\)/.test(W)
    && /resultat = await envoyerYCloud\(cle, \{ \.\.\.corps, audio: sansVoix \}\)/.test(W));
  test("★ le navigateur transmet la marque, jamais le son brut ni sa durée au serveur", /\.\.\.\(fichier\.vocal \? \{ vocal: true \} : \{\}\)/.test(sansComm(lire("src/whatsapp.js"))));
  // --- Le micro : un seul fichier y touche ---
  const fichiersSrc = execSync("git ls-files -co --exclude-standard src", { encoding: "utf8" }).split("\n").filter((f) => /\.(js|jsx)$/.test(f));
  const toucheMicro = fichiersSrc.filter((f) => /getUserMedia|new MediaRecorder|MediaRecorder\.isTypeSupported/.test(sansComm(readFileSync(f, "utf8"))));
  test("★★ `getUserMedia` et `MediaRecorder` n'existent QUE dans src/enregistreurVocal.js", toucheMicro.join(",") === "src/enregistreurVocal.js", toucheMicro.join(","));
  // --- L'écran ---
  const WJ = sansComm(lire("src/screens/Whatsapp.jsx"));
  test("★★ « a2 » : une note vocale (et un son) se charge TOUTE SEULE à l'ouverture du fil, comme une photo",
    /const MEDIA_AUTO = \["image", "sticker", "audio", "voice"\]/.test(WJ) && /if \(estSon\(media\)\) return <LecteurVocal url=\{url\}/.test(WJ) && !/<audio src=\{url\} controls/.test(WJ));
  test("★★ « B » : le micro remplace ➤ quand la case est vide, et la note part par LE MÊME `envoyer` (refus, verrou, ligne écrite après l'envoi)",
    /texte\.trim\(\) \|\| fichier \|\| envoi \? \(/.test(WJ) && /<BoutonMicro desactive=\{prepare\} onEnvoyer=\{\(f\) => envoyer\(f\)\}/.test(WJ)
    && /const piece = vocal \|\| fichier;/.test(WJ) && /critiqueReponse\(\{ profile, conv: ouverte, texte: t, fichier: piece/.test(WJ) && /wa_media: mediaEnvoye\(piece, r\.stocke\)/.test(WJ)); // RETOURNÉ le 21/10/2026 (le chemin rangé)
  test("★ une note envoyée se réécoute pendant la session ; après, sa ligne dit « 🎤 Message vocal · 0:07 — envoyé » (le son n'est pas rangé)",
    /if \(vocal\?\.blob\) garderVocal\(m\.id, vocal\.blob\)/.test(WJ) && monte(V.htmlVocaleEnvoyee).includes("🎤 Message vocal · 0:07") && monte(V.htmlSonEnvoye).includes("🎵 note-vocale.m4a · 0:12"));
  // --- Dans Chromium : un VRAI enregistrement, le remux, le lecteur, le micro ---
  const css = existsSync("dist/assets") ? readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0] : null;
  const dossier = mkdtempSync(join(tmpdir(), "bmi-vocal-"));
  const bundle = join(dossier, "vocal.js");
  await build({ entryPoints: ["scripts/_navigateur-vocal.jsx"], bundle: true, format: "iife", platform: "browser", outfile: bundle, jsx: "automatic", loader: { ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' } });
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    const page = await nav.newPage({ viewport: { width: 1000, height: 700 } });
    const f = join(dossier, "page.html");
    writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8">${css ? `<link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}">` : ""}</head><body><script src="${bundle}"></script></body></html>`);
    await page.goto(`file://${f}`);
    // Un son de 1,5 s enregistré par le VRAI MediaRecorder de Chromium (WebM / Opus), puis remis en Ogg.
    const r = await page.evaluate(async () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); osc.frequency.value = 440;
      // Un son qui MONTE (silence → fort) : la forme dessinée doit le montrer.
      const gain = ctx.createGain(); gain.gain.setValueAtTime(0.02, ctx.currentTime); gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
      const dest = ctx.createMediaStreamDestination(); osc.connect(gain); gain.connect(dest); osc.start();
      const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
      const morceaux = []; rec.ondataavailable = (e) => morceaux.push(e.data);
      const fini = new Promise((ok) => { rec.onstop = ok; });
      rec.start(250); await new Promise((ok) => setTimeout(ok, 1500)); rec.stop(); await fini; osc.stop();
      const webm = new Uint8Array(await new Blob(morceaux).arrayBuffer());
      const lu = window.Vocal.lireWebmOpus(webm);
      const ogg = window.Vocal.webmVersOgg(webm);
      const debut = ogg ? String.fromCharCode(...ogg.octets.slice(0, 4)) : "";
      let decode = -1;
      try { decode = (await ctx.decodeAudioData(ogg.octets.slice().buffer)).duration; } catch (e) { decode = -2; }
      const blob = new Blob([ogg.octets], { type: "audio/ogg" });
      window.urlOgg = URL.createObjectURL(blob);
      return { webm: webm.length, paquets: lu ? lu.paquets.length : 0, tete: lu ? String.fromCharCode(...lu.tete.slice(0, 8)) : "", debut, duree: ogg ? ogg.duree : -1, decode, oggTaille: ogg ? ogg.octets.length : 0 };
    });
    test("★★★ un VRAI enregistrement de Chromium (WebM / Opus) se lit : l'en-tête OpusHead et ses paquets sont retrouvés (Chrome : trames de 60 ms, 25 en 1,5 s)", r.paquets >= 20 && r.tete === "OpusHead", JSON.stringify(r));
    test("★★★ remis en Ogg, le son se DÉCODE dans le navigateur avec la même durée (≈ 1,5 s), sans être recodé (taille voisine du WebM)",
      r.debut === "OggS" && r.decode > 1.2 && r.decode < 1.9 && Math.abs(r.decode - r.duree) < 0.1 && r.oggTaille < r.webm * 1.3, JSON.stringify(r));
    // Le lecteur.
    await page.evaluate(() => window.Vocal.monterLecteur(window.urlOgg, 0));
    // On attend la FIN du décodage (les barres prennent la forme du son), pas seulement la durée.
    await page.waitForFunction(() => new Set([...document.querySelectorAll("[data-vocal-barre]")].map((b) => b.style.height)).size >= 2, null, { timeout: 15000 }).catch(() => {});
    const avant = await page.evaluate(() => ({ temps: document.querySelector("[data-vocal-temps]")?.textContent, barres: document.querySelectorAll("[data-vocal-barre]").length, hauteurs: new Set([...document.querySelectorAll("[data-vocal-barre]")].map((b) => b.style.height)).size, vitesse: document.querySelector("[data-vocal-vitesse]")?.textContent }));
    test("★★ « A » : avant d'écouter, le lecteur dit la durée (lue dans le son décodé), 36 barres qui ont la FORME du son, la vitesse 1×",
      (avant.temps === "0:01" || avant.temps === "0:02") && avant.barres === 36 && avant.hauteurs >= 2 && avant.vitesse === "1×", JSON.stringify(avant));
    // La flèche ▶ alignée sur la ligne des barres (capture Timo, 20/10/2026).
    const alignement = await page.evaluate(() => {
      const c = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
      return { fleche: Math.round(c(document.querySelector("[data-vocal-lire]"))), barres: Math.round(c(document.querySelector("[data-vocal-barres]"))) };
    });
    test("★★ la flèche ▶ est au niveau des barres du son (milieux à 2 px près), pas centrée sur tout le bloc",
      Math.abs(alignement.fleche - alignement.barres) <= 2, JSON.stringify(alignement));
    await page.click("[data-vocal-vitesse]");
    const v15 = await page.evaluate(() => ({ t: document.querySelector("[data-vocal-vitesse]").textContent, r: document.querySelector("#lecteur audio").playbackRate }));
    await page.click("[data-vocal-vitesse]");
    const v2 = await page.evaluate(() => document.querySelector("#lecteur audio").playbackRate);
    await page.click("[data-vocal-vitesse]");
    const v1 = await page.evaluate(() => document.querySelector("#lecteur audio").playbackRate);
    test("★★ la vitesse tourne 1× → 1,5× → 2× → 1×, et le son suit vraiment (playbackRate)", v15.t === "1,5×" && v15.r === 1.5 && v2 === 2 && v1 === 1, JSON.stringify({ v15, v2, v1 }));
    await page.click("[data-vocal-lire]");
    await page.waitForTimeout(600);
    const pendant = await page.evaluate(() => ({ etat: document.querySelector("[data-vocal-lire]").dataset.vocalLire, t: document.querySelector("#lecteur audio").currentTime, joues: document.querySelectorAll('[data-vocal-barre][data-joue="1"]').length }));
    test("★★ ▶ lance la lecture : le bouton devient ⏸, le son avance et les barres jouées se colorent", pendant.etat === "pause" && pendant.t > 0.2 && pendant.joues > 0, JSON.stringify(pendant));
    await page.click("[data-vocal-lire]");
    const zone = await page.$("[data-vocal-barres]");
    const bb = await zone.boundingBox();
    await page.mouse.click(bb.x + bb.width * 0.75, bb.y + bb.height / 2);
    const saut = await page.evaluate(() => ({ t: document.querySelector("#lecteur audio").currentTime, d: document.querySelector("#lecteur audio").duration, etat: document.querySelector("[data-vocal-lire]").dataset.vocalLire }));
    test("★★ toucher les barres aux trois quarts y amène le son (et la pause reste une pause)", saut.etat === "lire" && Math.abs(saut.t / (Number.isFinite(saut.d) ? saut.d : 1.5) - 0.75) < 0.08, JSON.stringify(saut));
    // Le micro : le faux micro de Chromium (un bip).
    await page.evaluate(() => window.Vocal.monterMicro());
    // React dessine au tour suivant : on ATTEND le bouton (sans quoi le
    // contrôle dépendait de la vitesse de la machine — tombé le 21/10/2026).
    await page.waitForSelector("[data-micro]", { timeout: 4000 }).catch(() => {});
    const micro = await page.$("[data-micro]");
    const mb = await micro.boundingBox();
    const cx = mb.x + mb.width / 2, cy = mb.y + mb.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.waitForSelector("[data-enregistrement-vocal]", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1600);
    const enCours = await page.evaluate(() => ({ bande: !!document.querySelector("[data-enregistrement-vocal]"), chrono: document.querySelector("[data-vocal-chrono]")?.textContent, etat: document.querySelector("[data-micro]")?.dataset.micro }));
    await page.mouse.up();
    await page.waitForFunction(() => window.envoye, null, { timeout: 6000 }).catch(() => {});
    const parti = await page.evaluate(async () => {
      const f = window.envoye; if (!f) return null;
      const octets = Uint8Array.from(atob(f.donnees), (c) => c.charCodeAt(0));
      const debut = String.fromCharCode(...octets.slice(0, 4)), longueur = octets.length;
      let d = -1; try { d = (await new AudioContext().decodeAudioData(octets.buffer)).duration; } catch { d = -2; }
      return { nom: f.nom, mime: f.mime, vocal: f.vocal, taille: f.taille, egal: longueur === f.taille, debut, decode: d, duree: f.duree, bande: !!document.querySelector("[data-enregistrement-vocal]") };
    });
    test("★★ « B » : garder le micro appuyé ENREGISTRE — la bande rouge couvre la case, le chrono tourne", enCours.bande && /^0:0[1-2]$/.test(enCours.chrono || "") && enCours.etat === "enregistre", JSON.stringify(enCours));
    test("★★★ relâcher ENVOIE une vraie note vocale .ogg (Opus) qui se décode, ≈ la durée tenue, et la bande disparaît",
      !!parti && parti.mime === "audio/ogg" && parti.vocal === true && /\.ogg$/.test(parti.nom) && parti.egal && parti.debut === "OggS" && parti.decode > 1 && parti.decode < 3 && !parti.bande, JSON.stringify(parti));
    // Un simple toucher : l'explication, rien ne part.
    await page.evaluate(() => { window.envoye = null; window.refus = []; });
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    await page.waitForTimeout(800);
    const toucher = await page.evaluate(() => ({ envoye: !!window.envoye, refus: window.refus.join(" | ") }));
    test("★★ un simple toucher n'envoie RIEN et explique « gardez le micro appuyé… »", !toucher.envoye && /Gardez le micro appuyé/.test(toucher.refus), JSON.stringify(toucher));
    // Glisser vers la gauche : annulé.
    await page.evaluate(() => { window.envoye = null; window.refus = []; });
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.waitForSelector("[data-enregistrement-vocal]", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.mouse.move(cx - 100, cy, { steps: 5 });
    const glisse = await page.evaluate(() => document.querySelector("[data-enregistrement-vocal]")?.textContent || "");
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const annule = await page.evaluate(() => ({ envoye: !!window.envoye, bande: !!document.querySelector("[data-enregistrement-vocal]") }));
    test("★★ glisser vers la gauche ANNULE : « Relâchez pour annuler », rien ne part", /Relâchez pour annuler/.test(glisse) && !annule.envoye && !annule.bande, JSON.stringify({ glisse, annule }));
  } finally {
    await nav.close();
    rmSync(dossier, { recursive: true, force: true });
  }
}

// ──────────────────────────────────────────────────────────────
titre("69 🔐 LE SON D'UN CLIENT SE CHARGE AVEC UN JETON RENOUVELÉ (20/10/2026, capture Timo : « Son — Session expirée. Reconnectez-vous » alors que la session était en ligne)");
// Les notes vocales se chargent toutes seules depuis la 2.101.605 ; la
// fonction qui va chercher le fichier (`mediaWaEnLigne`) prenait le jeton tel
// quel, sans le renouveler — le défaut fermé le 25/09 pour les autres appels.
// On JOUE la vraie fonction, avec un faux Supabase et un faux serveur qui
// refuse le jeton périmé.
{
  const cli = lire("src/supabaseClient.js");
  const corpsMedia = cli.slice(cli.indexOf("export async function mediaWaEnLigne"), cli.indexOf("\n}\n", cli.indexOf("export async function mediaWaEnLigne")));
  test("★★ `mediaWaEnLigne` passe par LA porte commune (`reponseAvecJeton`), jamais par un fetch à elle",
    /reponseAvecJeton\(URL_WHATSAPP_MEDIA/.test(corpsMedia) && !/fetch\(/.test(corpsMedia));
  test("★ `appelAvecJeton` passe par la même porte", /reponseAvecJeton\(urlFonction, corps\)/.test(cli));
  test("★ un seul endroit du client envoie un jeton à une fonction serveur avec renouvellement (le corps « jeton, ...corps »)",
    (cli.match(/JSON\.stringify\(\{ jeton, \.\.\.corps \}\)/g) || []).length === 1);
  const cache = join("node_modules", ".cache");
  const faux = join(cache, `faux-supabase-${process.pid}.mjs`);
  writeFileSync(faux, `export function createClient() {
    const F = () => globalThis.FAUX;
    return { auth: {
      async getSession() { return { data: { session: F().jeton ? { access_token: F().jeton, expires_at: 9e12, user: { email: "x@bmi" } } : null } }; },
      async refreshSession() { F().refresh++; F().jeton = F().apresRefresh; return { data: { session: { access_token: F().jeton, expires_at: 9e12, user: { email: "x@bmi" } } } }; },
      async signInWithPassword() { return { error: { message: "non" } }; },
      async signOut() { return {}; },
    } };
  }`);
  const sortieCli = join(cache, `bmi-client-${process.pid}.mjs`);
  await build({
    entryPoints: ["src/supabaseClient.js"], bundle: true, format: "esm", platform: "node", outfile: sortieCli, logLevel: "silent",
    alias: { "@supabase/supabase-js": "./" + faux },
    define: { "import.meta.env.VITE_SUPABASE_URL": '"https://faux.supabase.co"', "import.meta.env.VITE_SUPABASE_ANON_KEY": '"cle"', "import.meta.env.VITE_SYNC_AUTH_URL": '"https://faux.bmi"' },
  });
  const C = await import(pathToFileURL(sortieCli).href);
  unlinkSync(sortieCli); unlinkSync(faux);
  const fetchAvant = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url, init) => {
    const corps = JSON.parse(init.body);
    appels.push({ url, jeton: corps.jeton });
    if (corps.jeton === "neuf") return new Response(new Blob(["OggS-son"], { type: "audio/ogg" }), { status: 200 });
    return new Response(JSON.stringify({ error: "Session expirée. Reconnectez-vous." }), { status: 401 });
  };
  try {
    globalThis.FAUX = { jeton: "vieux", apresRefresh: "neuf", refresh: 0 };
    const r = await C.mediaWaEnLigne("wa_1");
    test("★★★ un jeton PÉRIMÉ est renouvelé : le son arrive (le faux serveur refuse « vieux », accepte « neuf »)",
      !!r.blob && !r.error && appels.some((a) => /whatsapp-media$/.test(a.url) && a.jeton === "neuf"), JSON.stringify({ r: { ...r, blob: !!r.blob }, appels }));
    appels.length = 0;
    globalThis.FAUX = { jeton: "vieux", apresRefresh: "vieux2", refresh: 0 };
    const r2 = await C.mediaWaEnLigne("wa_1");
    test("★★ jeton refusé même renouvelé : UN second essai, puis la fenêtre de verrou (session marquée perdue)",
      r2.statut === 401 && appels.length === 2 && C.etatAuth.sessionPerdue === true, JSON.stringify({ r2, appels, etat: C.etatAuth }));
    test("★★ et l'écran ne dit JAMAIS « reconnectez-vous » : il dit d'entrer le mot de passe (règle du 09/09/2026)",
      !/reconnect/i.test(r2.error || "") && /mot de passe/.test(r2.error || ""), r2.error);
  } finally {
    globalThis.fetch = fetchAvant;
    delete globalThis.FAUX;
  }
  const wa = lire("src/screens/Whatsapp.jsx");
  const corpsMediaWa = wa.slice(wa.indexOf("export function MediaWa"), wa.indexOf("\n}\n", wa.indexOf("export function MediaWa")));
  test("★★ un fichier qui n'a pas pu se charger porte « ↻ Réessayer », qui relance le chargement (sans recharger la page)",
    /data-media-reessayer onClick=\{charger\}/.test(corpsMediaWa) && /setMotif\(""\)/.test(corpsMediaWa) && /setCharge\(false\)/.test(corpsMediaWa));
}

titre("70 🎤 UNE NOTE VOCALE ENVOYÉE SE RÉÉCOUTE APRÈS UN F5, PAR LA COPIE GARDÉE SUR L'APPAREIL (20/10/2026 « b » RETOURNÉ → « a, lance » : YCloud ne rend pas un fichier déposé)");
// YCloud n'offre que le dépôt et le téléchargement d'un fichier REÇU : le
// numéro du dépôt ne commande rien. La note vit 30 jours dans le navigateur
// de l'appareil qui l'a enregistrée (src/vocauxLocaux.js), jamais dans la base.
{
  const cache = join("node_modules", ".cache");
  const sortieWc = join(cache, `bmi-wc70-${process.pid}.mjs`);
  await build({ entryPoints: ["src/lib/whatsappConversations.js"], bundle: true, format: "esm", platform: "node", outfile: sortieWc, logLevel: "silent" });
  const W = await import(pathToFileURL(sortieWc).href);
  unlinkSync(sortieWc);
  const vocal = { nom: "vocal.ogg", mime: "audio/ogg", taille: 2400, duree: 3, vocal: true };
  const ligne = W.mediaEnvoye(vocal, "2026-10-21/90112233_abcdefgh12.ogg");
  // RETOURNÉ le 21/10/2026 (« AVEC l'espace de fichiers privé de Supabase,
  // 30 jours ») : le second argument est le CHEMIN de la note rangée, jamais
  // le numéro du dépôt chez YCloud.
  test("★★ RETOURNÉ : la ligne d'une note envoyée ne garde PAS le numéro du dépôt, ni le fichier — seulement le CHEMIN de la note rangée (`stocke`)",
    !("media_id" in ligne) && ligne.type === "voice" && ligne.envoye === true && !("donnees" in ligne) && !("blob" in ligne)
    && ligne.stocke === "2026-10-21/90112233_abcdefgh12.ogg" && !("stocke" in W.mediaEnvoye(vocal)), JSON.stringify(ligne));
  const sc = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const apiWa = sc(lire("api/whatsapp.js")), srcWa = sc(lire("src/whatsapp.js")), ycl = sc(lire("api/_ycloud.js")), media = sc(lire("api/whatsapp-media.js"));
  test("★★ RETOURNÉ : le serveur ne rend plus de numéro de dépôt, l'application ne le transmet plus",
    !/media_id: depot\.id/.test(apiWa) && !/media_id: reponse\.media_id/.test(srcWa));
  test("★★ RETOURNÉ : plus aucun essai chez YCloud pour reprendre un fichier déposé (ni `telechargerMediaEnvoye`, ni l'adresse devinée)",
    !/telechargerMediaEnvoye|urlsMediaEnvoye|media\/download\/\$\{/.test(ycl + media) && !/sonEnvoye/.test(media));
  const ecran = sc(lire("src/screens/Whatsapp.jsx"));
  // RETOURNÉ le 21/10/2026 : la ligne porte le chemin rendu par le serveur.
  test("★★ RETOURNÉ : l'écran range la ligne avec le CHEMIN rendu par le serveur (`mediaEnvoye(piece, r.stocke)`) et garde aussi la note sur l'appareil (`garderVocal`)",
    /wa_media: mediaEnvoye\(piece, r\.stocke\)/.test(ecran) && /if \(vocal\?\.blob\) garderVocal\(m\.id, vocal\.blob\)/.test(ecran));
  const corpsMediaWa = ecran.slice(ecran.indexOf("export function MediaWa"), ecran.indexOf("\n}\n", ecran.indexOf("export function MediaWa")));
  // RETOURNÉ le 21/10/2026 : sans copie, une note RANGÉE (moins de 30 jours)
  // se charge depuis le serveur ; une note sans chemin ne lui demande toujours rien.
  test("★★ RETOURNÉ : la copie de l'appareil d'abord (`useCopieVocale`) ; le serveur seulement pour une note RANGÉE de moins de 30 jours, sans copie (`depuisLEspace`)",
    /const copie = useCopieVocale\(message\.id, sonEnvoye\)/.test(corpsMediaWa) && /if \(copie\) return <LecteurVocal url=\{copie\}/.test(corpsMediaWa)
    && /MEDIA_AUTO\.includes\(media\.type\) && !media\.envoye\) ouvrir\(\)/.test(corpsMediaWa)
    && /const depuisLEspace = stockeVivant && copie === null/.test(corpsMediaWa) && /!vocalExpire\(/.test(corpsMediaWa)
    && corpsMediaWa.indexOf("if (copie) return") < corpsMediaWa.indexOf("if (depuisLEspace) {"));
  test("★ sans copie, la ligne dit où la réécouter (l'appareil qui l'a envoyée, le téléphone BMI) — plus de « ↻ Réessayer » qui ne peut pas marcher",
    /data-vocal-ailleurs/.test(corpsMediaWa) && !/sonEnvoyeRechargeable/.test(ecran)
    && monte(V.htmlVocaleEnvoyee).includes("le téléphone BMI") && !monte(V.htmlVocaleEnvoyee).includes("Réessayer"));
  test("★★ la copie vit dans le navigateur, JAMAIS dans la base : src/vocauxLocaux.js n'importe rien et ne parle qu'à IndexedDB",
    !/^\s*import /m.test(lire("src/vocauxLocaux.js")) && /indexedDB\.open\(BASE_VOCAUX/.test(lire("src/vocauxLocaux.js")) && !/supabase/i.test(sc(lire("src/vocauxLocaux.js"))));
  const L = await import(pathToFileURL(join(process.cwd(), "src/vocauxLocaux.js")).href);
  const J = 86400000, t0 = Date.UTC(2026, 9, 20);
  test("★ règle des 30 jours : gardée le jour même et au 30e jour, plus rendue au-delà ; une copie sans date n'est jamais rendue",
    !L.copieExpiree(t0, t0) && !L.copieExpiree(t0, t0 + 30 * J) && L.copieExpiree(t0, t0 + 30 * J + 1) && L.copieExpiree(0, t0) && L.JOURS_COPIE_VOCAL === 30);
  test("★ sous Node (pas d'IndexedDB) : rien ne lève, « pas de copie »", (await L.lireCopieVocal("x")) === null && (await L.garderCopieVocal("x", {})) === false);

  // Le serveur, joué : une note envoyée n'a pas de lien, il ne va rien chercher.
  const faux = join(cache, `faux-supa70-${process.pid}.mjs`);
  writeFileSync(faux, `export function createClient() {
    const B = () => globalThis.BASE70;
    return {
      auth: { async getUser(j) { return j === "ok" ? { data: { user: { email: B().moi + "@bmi" } }, error: null } : { data: {}, error: { message: "non" } }; } },
      from(table) {
        const filtres = [];
        const q = { select() { return q; }, order() { return q; }, limit() { return q; }, range() { return q; },
          eq(col, val) { filtres.push([col, val]); return q; },
          then(ok) {
            const lignes = (B()[table] || []).filter((l) => filtres.every(([c, v]) => c === "id" ? l.id === v : c === "data->>wa_tel" ? (l.data || {}).wa_tel === v : true));
            return Promise.resolve({ data: lignes, error: null }).then(ok);
          } };
        return q;
      },
    };
  }`);
  const sortieH = join(cache, `bmi-h70-${process.pid}.mjs`);
  await build({ entryPoints: ["api/whatsapp-media.js"], bundle: true, format: "esm", platform: "node", outfile: sortieH, logLevel: "silent", alias: { "@supabase/supabase-js": "./" + faux } });
  const H = await import(pathToFileURL(sortieH).href);
  unlinkSync(sortieH); unlinkSync(faux);
  const envAvant = { ...process.env };
  const fetchAvant = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url) => { appels.push(String(url)); return new Response("x", { status: 200 }); };
  process.env.YCLOUD_API_KEY = "CLE"; process.env.VITE_SUPABASE_URL = "https://faux.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  try {
    globalThis.BASE70 = { moi: "admin1", users: [{ id: "admin1", data: { role: "admin", nom: "TIMO" } }],
      messages: [{ id: "wa_v1", data: { canal: "whatsapp", wa_tel: "90112233", ts: new Date().toISOString(), de_id: "kossi", wa_media: { type: "voice", mime: "audio/ogg", envoye: true, media_id: "MED-77", duree: 3 } } }] };
    const res = { code: 0, corps: null, entetes: {}, setHeader(k, v) { this.entetes[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.corps = o; return this; }, send(b) { this.corps = b; return this; }, end() { return this; } };
    await H.default({ method: "POST", headers: {}, body: { jeton: "ok", message: "wa_v1" } }, res);
    test("★★ la VRAIE fonction serveur : une note envoyée (même une ligne d'avant qui porte un numéro) → « aucun fichier », et AUCUN appel à YCloud",
      res.code === 404 && /aucun fichier/.test(res.corps?.error || "") && appels.length === 0, JSON.stringify({ code: res.code, corps: res.corps, appels }));
  } finally {
    globalThis.fetch = fetchAvant;
    for (const k of Object.keys(process.env)) if (!(k in envAvant)) delete process.env[k];
    Object.assign(process.env, envAvant);
    delete globalThis.BASE70;
  }

  // Dans Chromium : la copie survit au F5, la ligne la rejoue ; un autre appareil (pas de copie) lit la phrase.
  const dossier = mkdtempSync(join(tmpdir(), "bmi-vocal70-"));
  const bundle = join(dossier, "vocal.js");
  await build({ entryPoints: ["scripts/_navigateur-vocal.jsx"], bundle: true, format: "iife", platform: "browser", outfile: bundle, jsx: "automatic", loader: { ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' } });
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    const page = await nav.newPage();
    const erreurs = []; page.on("pageerror", (e) => erreurs.push(e.message));
    const f = join(dossier, "page.html");
    writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${bundle}"></script></body></html>`);
    await page.goto(`file://${f}`);
    // Un vrai son Ogg (1 s), gardé comme le fait l'envoi.
    const garde = await page.evaluate(async () => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination(); osc.connect(dest); osc.start();
      const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
      const morceaux = []; rec.ondataavailable = (e) => morceaux.push(e.data);
      const fini = new Promise((ok) => { rec.onstop = ok; });
      rec.start(250); await new Promise((ok) => setTimeout(ok, 1000)); rec.stop(); await fini; osc.stop();
      const ogg = window.Vocal.webmVersOgg(new Uint8Array(await new Blob(morceaux).arrayBuffer()));
      // LE geste de l'envoi (garderVocal), puis on attend que la copie soit écrite.
      window.Vocal.garderVocal("wa_note_1", new Blob([ogg.octets], { type: "audio/ogg" }));
      let ok = false;
      for (let i = 0; i < 40 && !ok; i++) { await new Promise((r) => setTimeout(r, 50)); ok = !!(await window.Vocal.lireCopieVocal("wa_note_1")); }
      // Une copie vieille de 31 jours, rangée à la main.
      await window.Vocal.garderCopieVocal("wa_vieille", new Blob(["OggS"], { type: "audio/ogg" }), Date.now() - 31 * 86400000);
      return { ok, taille: ogg.octets.length };
    });
    await page.reload();
    await page.evaluate(() => { window.Vocal.monterLigneEnvoyee("wa_note_1"); window.Vocal.monterLigneEnvoyee("wa_autre_appareil"); window.Vocal.monterLigneEnvoyee("wa_vieille"); });
    await page.waitForSelector("#ligne-wa_note_1 [data-vocal-lire]", { timeout: 8000 }).catch(() => {});
    await page.waitForSelector("#ligne-wa_autre_appareil [data-vocal-ailleurs]", { timeout: 8000 }).catch(() => {});
    await page.waitForSelector("#ligne-wa_vieille [data-vocal-ailleurs]", { timeout: 8000 }).catch(() => {});
    const apres = await page.evaluate(async () => ({
      lecteur: !!document.querySelector("#ligne-wa_note_1 [data-vocal-lire]"),
      ailleurs: document.querySelector("#ligne-wa_autre_appareil")?.textContent || "",
      vieille: document.querySelector("#ligne-wa_vieille")?.textContent || "",
      vieilleEffacee: (await window.Vocal.lireCopieVocal("wa_vieille")) === null,
    }));
    test("★★★ dans Chromium : la note gardée à l'envoi SURVIT au F5 et sa ligne la rejoue dans LE lecteur commun", garde.ok && apres.lecteur && erreurs.length === 0, JSON.stringify({ garde, apres, erreurs }));
    test("★★ un appareil qui n'a pas la copie lit « 🎤 Message vocal · 0:02 — envoyé » et où la réécouter, sans erreur",
      /🎤 Message vocal · 0:02/.test(apres.ailleurs) && /téléphone BMI/.test(apres.ailleurs) && !/Réessayer/.test(apres.ailleurs), apres.ailleurs);
    test("★★ une copie de plus de 30 jours n'est plus rendue (et elle est retirée du navigateur)", /téléphone BMI/.test(apres.vieille) && apres.vieilleEffacee, JSON.stringify(apres));
  } finally {
    await nav.close();
    rmSync(dossier, { recursive: true, force: true });
  }
}

// ──────────────────────────────────────────────────────────────
titre("71 🤖 « RENDRE À L'ASSISTANT » : IL RÉPOND TOUT DE SUITE, PUIS CONTINUE JUSQU'À CE QU'UNE PERSONNE RÉÉCRIVE (21/10/2026, « 1 oui, et non pour le c, lance »)");
{
  const AW = await import("../src/lib/assistantWhatsapp.js");
  const I = await import("../src/lib/assistantIA.js");
  const RA = await import("../src/lib/relanceAssistant.js");
  const CLE = "90881122";
  const T = Date.parse("2026-10-21T08:00:00.000Z");
  const at = (min) => new Date(T + min * 60000).toISOString();
  const ent = (id, min, texte) => ({ id, canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_entrant: true, ts: at(min), texte });
  const pers = (id, min, texte, nom = "TIMO") => ({ id, canal: "whatsapp", wa_tel: CLE, wa_entrant: false, de_id: nom, de_nom: nom, ts: at(min), texte });
  const marque = (min, par = "KOSSI") => AW.ligneRenduAssistant({ cle: CLE, tel: `228${CLE}`, nom: "", par, par_id: par, ts: at(min) });
  const assist = (id, min, etape = I.ETAPE_IA) => ({ ...AW.ligneAssistant({ cle: CLE, tel: `228${CLE}`, texte: "réponse", etape, ts: at(min), ia: true }), id });
  const confier = (min, a = "COM1") => ({ id: `c${min}`, canal: "whatsapp", wa_tel: CLE, wa_entrant: false, wa_systeme: true, de_id: "TIMO", ts: at(min), texte: "🔁 confiée", proprietaire_id: a, proprietaire_nom: a });
  const d = (fil, proprietaireId = "", min = null) => AW.decisionAssistant({ fil, proprietaireId, maintenant: min === null ? fil[fil.length - 1].ts : at(min) });

  const base = [ent("e1", 0, "bonjour"), pers("p1", 5, "Je regarde votre demande.")];
  test("★★★ sans la marque, l'assistant se tait (un employé a répondu) ; avec la marque, il reprend : étape menu, pas de présentation du premier jour, `rendu`",
    d([...base, ent("e2", 10, "et le prix ?")]).repondre === false
    && (() => { const x = d([...base, marque(8), ent("e2", 10, "et le prix ?")]); return x.repondre === true && x.rendu === true && x.etape === AW.ETAPE_MENU && I.conversationNouvelle(x) === false; })());
  test("★★★ la marque ne vaut plus dès qu'une PERSONNE réécrit après elle ; l'assistant qui passe la main à un conseiller se tait aussi",
    d([...base, marque(8), pers("p2", 9, "Je reprends."), ent("e2", 10, "ok")]).repondre === false
    && d([...base, marque(8), ent("e2", 9, "un conseiller"), assist("a1", 9.1, AW.ETAPE_CONSEILLER), ent("e3", 10, "merci")]).repondre === false
    && AW.renduActif([...base, marque(8), pers("p2", 9, "x")]) === null);
  test("★★★ une conversation CONFIÉE puis rendue parle ; confiée de nouveau APRÈS la marque, elle se tait",
    d([...base, marque(8), ent("e2", 10, "ok")], "COM1").repondre === true
    && d([...base, marque(8), confier(9), ent("e2", 10, "ok")], "COM1").repondre === false
    && d([...base, confier(6), ent("e2", 10, "ok")], "COM1").repondre === false);
  test("★★ la marque laisse passer les lignes du client et de l'assistant : la conversation continue ensuite normalement",
    !!AW.renduActif([...base, marque(8), ent("e2", 9, "x"), assist("a1", 9.1), ent("e3", 10, "y")])
    && d([...base, marque(8), ent("e2", 9, "x"), assist("a1", 9.1), ent("e3", 10, "y")], "COM1").repondre === true);
  test("★★ une marque de plus de 24 h ne compte plus : c'est une nouvelle conversation (comme avant)",
    d([...base, marque(8), ent("e2", 26 * 60, "re")]).etape === null);
  test("★★★ le bouton n'a de sens que si l'assistant s'est tu à cause d'une PERSONNE (`assistantEnRetrait`)",
    AW.assistantEnRetrait({ fil: base, maintenant: at(10) }) === true
    && AW.assistantEnRetrait({ fil: [...base, marque(8)], maintenant: at(10) }) === false
    && AW.assistantEnRetrait({ fil: [ent("e1", 0, "bonjour"), assist("a1", 0.1)], maintenant: at(10) }) === false
    && AW.assistantEnRetrait({ fil: [ent("e1", 0, "x"), assist("a1", 0.1, AW.ETAPE_CONSEILLER)], maintenant: at(10) }) === true
    && AW.assistantEnRetrait({ fil: [ent("e1", 0, "x"), assist("a1", 0.1)], proprietaireId: "COM1", maintenant: at(10) }) === true
    && AW.assistantEnRetrait({ fil: base, maintenant: at(30 * 60) }) === false);
  test("★★ le bandeau « attend un conseiller » s'efface quand la conversation est rendue à l'assistant",
    !!AW.attenteConseiller([ent("e1", 0, "x"), assist("a1", 0.1, AW.ETAPE_CONSEILLER)])
    && AW.attenteConseiller([ent("e1", 0, "x"), assist("a1", 0.1, AW.ETAPE_CONSEILLER), marque(3)]) === null);
  test("★★ la ligne de la marque est une ligne SYSTÈME sans propriétaire : elle n'ouvre pas la fenêtre et ne confie rien",
    (() => { const m = marque(8, "TIMO"); return m.wa_systeme === true && m.wa_entrant === false && !m.proprietaire_id && m.wa_rendu_assistant?.par === "TIMO" && /rendue à l'assistant par TIMO/.test(m.texte); })());
  // La relance de la 20e heure : un employé qui avait écrit AVANT la marque ne l'empêche plus.
  const filRel = [ent("e1", 0, "bonjour"), pers("p1", 1, "un instant"), ent("e2", 2, "alors ?"), marque(3), assist("a1", 3.2)];
  test("★★ la relance de la 20e heure suit la marque (un employé AVANT elle ne l'empêche plus ; une conversation confiée rendue aussi) — sans la marque, rien",
    RA.relanceAFaire({ fil: filRel, maintenant: at(2 + 21 * 60) }).relancer === true
    && RA.relanceAFaire({ fil: filRel, maintenant: at(2 + 21 * 60), proprietaireId: "COM1" }).relancer === true
    && RA.relanceAFaire({ fil: filRel.filter((m) => !m.wa_rendu_assistant), maintenant: at(2 + 21 * 60) }).relancer === false);
  const C1 = I.consignePour({ rendu: true, dejaVu: false }), C2 = I.consignePour({ rendu: true, dejaVu: true });
  test("★★ la consigne de reprise : tenir compte de la personne, sans redire bonjour ; se présenter en UNE phrase seulement si le client ne l'a jamais lu",
    C1.includes(I.CONSIGNE_RENDU) && C1.includes(I.CONSIGNE_RENDU_PRESENTATION) && C2.includes(I.CONSIGNE_RENDU) && !C2.includes(I.CONSIGNE_RENDU_PRESENTATION)
    && /un programme, pas une personne/.test(I.CONSIGNE_RENDU_PRESENTATION) && !I.consignePour({}).includes(I.CONSIGNE_RENDU));

  // ── Le serveur et l'écran, lus
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const RS = sansComm(lire("api/_rendreAssistant.js"));
  test("★★★ le serveur revérifie TOUT dans le geste : WhatsApp, formation, réglage coupé, conversation ouvrable, corbeille — et pose la marque AVANT de répondre",
    /!aAccesWhatsapp\(compte\)/.test(RS) && /espace === "formation" \|\| estCompteFormation/.test(RS) && /!assistantActif\(boutiques\)/.test(RS)
    && /!peutVoirConversation\(compte, \{ proprietaire_id: proprietaire\.id \}\)/.test(RS) && /!estALaCorbeille\(m\)/.test(RS)
    && RS.indexOf('from("messages").insert({ id: marque.id') > 0 && RS.indexOf('from("messages").insert({ id: marque.id') < RS.indexOf("await repondre({")
    && /attente: 0/.test(RS) && /fenetre\(fil, maintenant\)\.ouverte/.test(RS) && /!dernier \|\| !dernier\.wa_entrant/.test(RS));
  test("★★ il passe par api/whatsapp.js (`action: \"rendre_assistant\"`) — aucune 13e fonction serveur",
    /req\.body\?\.action === "rendre_assistant"\) return rendreAssistant\(req, res\)/.test(lire("api/whatsapp.js")));
  const EN2 = sansComm(lire("api/whatsapp-entrant.js"));
  test("★★ l'assistant qui répond dans une conversation confiée GARDE son propriétaire sur la fiche légère (elle reste grisée chez les autres)",
    /proprietaire_id: proprietaireId \|\| ""/.test(EN2) && /rendu: !!decision\.rendu/.test(EN2));
  const WS = lire("src/screens/Whatsapp.jsx");
  test("★★ l'écran passe par UN chemin (`rendreALAssistant`, src/whatsapp.js), une QUESTION d'abord, et le bouton est un BoutonEnvoi",
    /await uConfirm\(\s*`🤖 Rendre la conversation de/.test(WS) && /await rendreALAssistant\(\{ cle: ouverte\.cle \}\)/.test(WS)
    && /<BoutonEnvoi data-rendre-assistant onClick=\{\(\) => rendreAssistant\(\)\}/.test(WS) && /rendreAssistantEnLigne/.test(lire("src/whatsapp.js")));
  const avant = monte(() => V.renduAvantRendu()), apres = monte(() => V.renduApresRendu()), coupe = monte(() => V.renduAvantRenduCoupe());
  const vendeur = monte(() => V.renduAvantRendu(V.lecteurCreateur));
  test("★★★ l'écran RENDU : TIMO vient de répondre → « 🤖 Rendre à l'assistant » ; rendue → le bouton disparaît et la ligne se lit ; assistant coupé → pas de bouton",
    avant.includes("data-rendre-assistant") && avant.includes("Rendre à l&#x27;assistant")
    && !apres.includes("data-rendre-assistant") && apres.includes("Conversation rendue à l&#x27;assistant par TIMO")
    && !coupe.includes("data-rendre-assistant") && vendeur.includes("data-rendre-assistant"), [avant, apres, coupe].map((h) => h.slice(0, 80)).join(" | "));

  // ── La VRAIE chaîne, sur une base jouée
  const { rendreAssistant } = await import("../api/_rendreAssistant.js");
  const fauxAdmin = (tables, email) => ({
    auth: { getUser: async () => ({ data: { user: { email, app_metadata: {} } }, error: null }) },
    from(t) {
      const q = { op: "select", charge: null, filtres: [], de: 0, a: Infinity, lim: Infinity };
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        const lignes = (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v)));
        return { data: structuredClone(lignes.slice(q.de, Math.min(q.a + 1, q.lim))), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, order() { return b; }, limit(n) { q.lim = n; return b; }, range(de, a) { q.de = de; q.a = a; return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const fauxRes = () => { const r = { code: 0, corps: null, status(c) { r.code = c; return r; }, json(o) { r.corps = o; return r; } }; return r; };
  const lt = (m) => ({ id: m.id, data: m, updated_at: m.ts });
  const maint = Date.now();
  const rel = (min) => new Date(maint + min * 60000).toISOString();
  const eR = (id, min, texte) => ({ ...ent(id, 0, texte), ts: rel(min) });
  const pR = (id, min, texte, nom = "TIMO") => ({ ...pers(id, 0, texte, nom), ts: rel(min) });
  const comptes = [
    { id: "TIMO", data: { nom: "TIMO", role: "admin", admin_principal: true } },
    { id: "KOSSI", data: { nom: "KOSSI", role: "vendeur" } },
    { id: "COM1", data: { nom: "COM1", role: "commercial" } },
    { id: "FORMA", data: { nom: "FORMA", role: "vendeur", formation: true } },
  ];
  const bqs = [{ id: "b1", data: { nom: "BMI DEMAKPOE" } }];
  const envAvant = { a: process.env.ANTHROPIC_API_KEY, b: process.env.ASSISTANT_IA_MODELE, c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  let envois = [], corpsIA = [];
  globalThis.fetch = async (url, opts) => {
    const c = JSON.parse(opts?.body || "{}");
    if (String(url).includes("anthropic")) { corpsIA.push(c); return new Response(JSON.stringify({ content: [{ type: "text", text: "Le panneau 400 W est disponible." }], stop_reason: "end_turn" }), { status: 200 }); }
    envois.push(c);
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.R", status: "accepted" }), { status: 200 });
  };
  const jouer = async (email, messages, boutiques = bqs) => {
    const tables = { users: structuredClone(comptes), boutiques: structuredClone(boutiques), messages: messages.map(lt) };
    const res = fauxRes();
    await rendreAssistant({ body: { jeton: "j", cle: CLE } }, res, { adminClient: fauxAdmin(tables, `${email}@bmi`) });
    return { res, tables };
  };
  let j1, j2, j3, j4, j5, j6, n1 = 0, n2 = 0, consigne1 = "";
  try {
    process.env.ANTHROPIC_API_KEY = "cle-de-banc"; process.env.ASSISTANT_IA_MODELE = "modele-de-banc";
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    // 1) Le client a parlé en dernier (TIMO avait répondu avant) : KOSSI rend, l'assistant répond tout de suite.
    j1 = await jouer("KOSSI", [eR("e1", -30, "bonjour"), pR("p1", -25, "Je regarde."), eR("e2", -10, "le panneau 400 ?")]);
    n1 = envois.length; consigne1 = String(corpsIA[0]?.system || JSON.stringify(corpsIA[0] || {}));
    // 2) La dernière ligne est de TIMO : la marque seulement, rien ne part.
    envois = [];
    j2 = await jouer("KOSSI", [eR("e1", -30, "bonjour"), pR("p1", -5, "Je regarde.")]);
    n2 = envois.length;
    // 3) Confiée à COM1 : KOSSI est refusé ; COM1 (le propriétaire) peut.
    const confiee = [eR("e1", -30, "bonjour"), { ...pR("c1", -28, "🔁 confiée"), wa_systeme: true, proprietaire_id: "COM1", proprietaire_nom: "COM1" }, pR("p1", -25, "Je regarde.", "COM1"), eR("e2", -10, "alors ?")];
    j3 = await jouer("KOSSI", confiee);
    envois = []; j4 = await jouer("COM1", confiee);
    // 4) Formation refusée ; assistant coupé refusé.
    j5 = await jouer("FORMA", [eR("e1", -30, "bonjour"), pR("p1", -25, "x")]);
    j6 = await jouer("KOSSI", [eR("e1", -30, "bonjour"), pR("p1", -25, "x")], [{ id: "b1", data: { nom: "BMI DEMAKPOE", assistant_wa: false } }]);
  } catch (er) { console.log("    (erreur de la chaîne jouée :", er?.message || er, ")"); }
  finally {
    globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ ANTHROPIC_API_KEY: envAvant.a, ASSISTANT_IA_MODELE: envAvant.b, YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const lignesDe = (j) => (j?.tables?.messages || []).map((l) => l.data);
  test("★★★ la chaîne jouée : le client a parlé en dernier → la marque, puis l'assistant RÉPOND tout de suite (un envoi, sa ligne après la marque, la consigne de reprise)",
    j1?.res.code === 200 && j1.res.corps?.repondu === true && n1 === 1
    && lignesDe(j1).some((m) => m.wa_rendu_assistant?.par === "KOSSI") && lignesDe(j1).some((m) => AW.estLigneAssistant(m) && m.texte.includes("400 W"))
    && consigne1.includes("LA REPRISE"), JSON.stringify(j1?.res.corps));
  test("★★ la chaîne jouée : la dernière ligne est d'une personne → la marque seule, rien ne part (il répondra au prochain message)",
    j2?.res.code === 200 && j2.res.corps?.repondu === false && n2 === 0 && lignesDe(j2).some((m) => m.wa_rendu_assistant), JSON.stringify(j2?.res.corps));
  test("★★★ la chaîne jouée : une conversation confiée à COM1 → KOSSI refusé (403, rien d'écrit) ; COM1 la rend, l'assistant répond et la fiche reste à COM1",
    j3?.res.code === 403 && !lignesDe(j3).some((m) => m.wa_rendu_assistant)
    && j4?.res.code === 200 && j4.res.corps?.repondu === true
    && lignesDe(j4).filter((m) => m.canal === "whatsapp_entete").every((f) => f.proprietaire_id === "COM1") && lignesDe(j4).some((m) => m.canal === "whatsapp_entete"),
    `${JSON.stringify(j3?.res.corps)} ${JSON.stringify(j4?.res.corps)}`);
  test("★★ la chaîne jouée : un compte de formation est refusé ; l'assistant coupé dans ⚙ Paramètres aussi — rien d'écrit",
    j5?.res.code === 403 && j6?.res.code === 409 && !lignesDe(j5).some((m) => m.wa_rendu_assistant) && !lignesDe(j6).some((m) => m.wa_rendu_assistant),
    `${j5?.res.code} ${j6?.res.code}`);
}

titre("72 🎤 LES NOTES VOCALES ENVOYÉES PAR BMI, RANGÉES 30 JOURS DANS L'ESPACE PRIVÉ DE SUPABASE, RÉÉCOUTÉES PAR TOUTE L'ÉQUIPE (21/10/2026, « AVEC l'espace de fichiers privé de Supabase, il faut lancer pour 30 jours »)");
{
  const VS = await import("../src/lib/vocauxStockes.js");
  const sansC = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★★ la règle est lisible par le serveur : src/lib/vocauxStockes.js n'importe rien, espace « vocaux-wa », 30 jours",
    !/^\s*import /m.test(lire("src/lib/vocauxStockes.js")) && VS.ESPACE_VOCAUX === "vocaux-wa" && VS.JOURS_VOCAUX_STOCKES === 30);
  const ch = VS.cheminVocal({ cle: "90112233", jour: "2026-10-21", alea: "3f2a-91bc-77de-0011", mime: "audio/ogg;codecs=opus" });
  test("★★ le chemin : « jour/clé_hasard.ext », relu à l'identique ; une clé, un jour ou un type faux → aucun chemin",
    ch === "2026-10-21/90112233_3f2a91bc77de0011.ogg" && VS.lireCheminVocal(ch)?.cle === "90112233" && VS.lireCheminVocal(ch)?.type === "audio/ogg"
    && VS.cheminVocal({ cle: "9011", jour: "2026-10-21", alea: "abcdefgh12", mime: "audio/ogg" }) === ""
    && VS.cheminVocal({ cle: "90112233", jour: "21/10/2026", alea: "abcdefgh12", mime: "audio/ogg" }) === ""
    && VS.cheminVocal({ cle: "90112233", jour: "2026-10-21", alea: "abcdefgh12", mime: "image/png" }) === ""
    && VS.cheminVocal({ cle: "90112233", jour: "2026-10-21", alea: "x", mime: "audio/ogg" }) === "", ch);
  test("★★ un chemin venu d'une ligne ne se croit pas sur parole : « ../ », autre dossier, autre extension → refusé",
    VS.lireCheminVocal("../2026-10-21/90112233_abcdefgh12.ogg") === null && VS.lireCheminVocal("2026-10-21/../../x.ogg") === null
    && VS.lireCheminVocal("2026-10-21/90112233_abcdefgh12.exe") === null && VS.lireCheminVocal("autre/90112233_abcdefgh12.ogg") === null);
  test("★★ 30 jours : gardée le jour même et le 30e jour, plus le 31e ; seuls les dossiers-jours de plus de 30 jours s'effacent",
    !VS.vocalExpire("2026-10-21", "2026-10-21") && !VS.vocalExpire("2026-09-21", "2026-10-21") && VS.vocalExpire("2026-09-20", "2026-10-21")
    && VS.vocalExpire("pas une date", "2026-10-21")
    && JSON.stringify(VS.joursAPurger(["2026-09-01", "2026-09-20", "2026-09-21", "2026-10-21", "autre", ""], "2026-10-21")) === JSON.stringify(["2026-09-01", "2026-09-20"]));
  test("★★ seules les notes ENREGISTRÉES au micro se rangent (Ogg, et le son MP4 d'un iPhone) — jamais un son choisi, une image, ni plus de 3 Mo",
    VS.doitRangerVocal({ vocal: true, micro: true, mime: "audio/ogg", taille: 2400 }) && VS.doitRangerVocal({ vocal: false, micro: true, mime: "audio/mp4", taille: 2400 })
    && !VS.doitRangerVocal({ mime: "audio/ogg", taille: 2400 }) && !VS.doitRangerVocal({ micro: true, mime: "image/jpeg", taille: 2400 })
    && !VS.doitRangerVocal({ micro: true, mime: "audio/ogg", taille: 4 * 1024 * 1024 }) && !VS.doitRangerVocal({ micro: true, mime: "audio/ogg", taille: 0 }));
  const enreg = sansC(lire("src/enregistreurVocal.js"));
  test("★ l'enregistreur marque chaque note du micro (`micro: true`, trois formes), et l'application le transmet au serveur",
    (enreg.match(/micro: true/g) || []).length === 3 && /\.\.\.\(fichier\.micro \? \{ micro: true \} : \{\}\)/.test(sansC(lire("src/whatsapp.js")))
    && /micro: !!fichier\.micro/.test(sansC(lire("api/whatsapp.js"))));
  test("★★ la ligne et l'écoute : le chemin d'une AUTRE conversation est refusé, une note de plus de 30 jours aussi, la bonne passe",
    VS.critiqueEcouteVocal({ wa_tel: "90112233", wa_media: { envoye: true, stocke: ch } }, "2026-10-21") === ""
    && /n'appartient pas/.test(VS.critiqueEcouteVocal({ wa_tel: "91000000", wa_media: { envoye: true, stocke: ch } }, "2026-10-21"))
    && VS.critiqueEcouteVocal({ wa_tel: "90112233", wa_media: { envoye: true, stocke: ch } }, "2026-11-21") === VS.MOTIF_VOCAL_EXPIRE
    && /pas été gardée/.test(VS.critiqueEcouteVocal({ wa_tel: "90112233", wa_media: { envoye: true } }, "2026-10-21")));

  // ---- L'envoi, joué : api/whatsapp.js avec un faux Supabase et un faux YCloud ----
  const cache = join("node_modules", ".cache");
  const faux = join(cache, `faux-supa72-${process.pid}.mjs`);
  writeFileSync(faux, `export function createClient() {
    const B = () => globalThis.BASE72;
    return {
      auth: { async getUser(j) { return j === "ok" ? { data: { user: { email: B().moi + "@bmi", app_metadata: {} } }, error: null } : { data: {}, error: { message: "non" } }; } },
      from(table) {
        const filtres = [];
        const q = { select() { return q; }, order() { return q; }, limit() { return q; }, range() { return q; },
          eq(col, val) { filtres.push([col, val]); return q; },
          then(ok) {
            const lignes = (B()[table] || []).filter((l) => filtres.every(([c, v]) => c === "id" ? l.id === v : c === "data->>wa_tel" ? (l.data || {}).wa_tel === v : true));
            return Promise.resolve({ data: lignes, error: null }).then(ok);
          } };
        return q;
      },
      storage: { from(espace) { return { async upload(chemin, octets, opts) {
        B().evenements.push("rangement");
        B().ranges.push({ espace, chemin, taille: octets.length, type: opts && opts.contentType, upsert: opts && opts.upsert });
        return B().refusRangement ? { data: null, error: { message: "Bucket not found" } } : { data: { path: chemin }, error: null };
      } }; } },
    };
  }`);
  const sortieW = join(cache, `bmi-w72-${process.pid}.mjs`);
  await build({ entryPoints: ["api/whatsapp.js"], bundle: true, format: "esm", platform: "node", outfile: sortieW, logLevel: "silent", alias: { "@supabase/supabase-js": "./" + faux }, external: ["web-push"] });
  const APIW = await import(pathToFileURL(sortieW).href);
  unlinkSync(sortieW); unlinkSync(faux);
  const envAvant = { ...process.env };
  const fetchAvant = globalThis.fetch;
  const clientTel = "22890112233";
  const octetsNote = Buffer.from("OggS" + "x".repeat(2000));
  const jouerEnvoi = async ({ fichier, refusYcloud = false, refusRangement = false }) => {
    globalThis.BASE72 = { moi: "kossi", evenements: [], ranges: [], refusRangement,
      users: [{ id: "kossi", data: { role: "vendeur", nom: "KOSSI", boutique: "BMI DEMAKPOE" } }],
      boutiques: [{ id: "b1", data: { nom: "BMI DEMAKPOE" } }],
      messages: [{ id: "e1", data: { canal: "whatsapp", wa_tel: "90112233", wa_numero: clientTel, wa_entrant: true, ts: new Date(Date.now() - 3600000).toISOString(), texte: "bonjour" } }] };
    globalThis.fetch = async (url) => {
      const u = String(url);
      if (/upload/.test(u)) return new Response(JSON.stringify({ id: "MED1" }), { status: 200 });
      globalThis.BASE72.evenements.push("envoi");
      return refusYcloud ? new Response(JSON.stringify({ error: { message: "refusé" } }), { status: 400 }) : new Response(JSON.stringify({ id: "Y1", wamid: "W1", status: "accepted" }), { status: 200 });
    };
    const res = { code: 0, corps: null, setHeader() {}, status(c) { this.code = c; return this; }, json(o) { this.corps = o; return this; }, send(b) { this.corps = b; return this; }, end() { return this; } };
    await APIW.default({ method: "POST", headers: {}, body: { jeton: "ok", tel: clientTel, texte: "", fichier } }, res);
    return { res, base: globalThis.BASE72 };
  };
  let e1, e2, e3, e4;
  process.env.YCLOUD_API_KEY = "CLE"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
  process.env.VITE_SUPABASE_URL = "https://faux.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "srv";
  try {
    const note = { nom: "note.ogg", mime: "audio/ogg", donnees: octetsNote.toString("base64"), vocal: true, micro: true };
    e1 = await jouerEnvoi({ fichier: note });
    e2 = await jouerEnvoi({ fichier: note, refusYcloud: true });
    e3 = await jouerEnvoi({ fichier: { nom: "chanson.ogg", mime: "audio/ogg", donnees: octetsNote.toString("base64") } });
    e4 = await jouerEnvoi({ fichier: note, refusRangement: true });
  } catch (er) { console.log("    (erreur de l'envoi joué :", er?.message || er, ")"); }
  finally {
    globalThis.fetch = fetchAvant;
    for (const k of Object.keys(process.env)) if (!(k in envAvant)) delete process.env[k];
    Object.assign(process.env, envAvant);
    delete globalThis.BASE72;
  }
  const r1 = e1?.base.ranges[0] || {};
  test("★★★ l'envoi joué : la note partie est rangée UNE fois dans « vocaux-wa », APRÈS l'accord de WhatsApp, sous la clé de la conversation — et son chemin repart avec la réponse",
    e1?.res.code === 200 && e1.base.ranges.length === 1 && r1.espace === "vocaux-wa" && r1.type === "audio/ogg" && r1.taille === octetsNote.length && r1.upsert === false
    && JSON.stringify(e1.base.evenements) === JSON.stringify(["envoi", "rangement"])
    && VS.lireCheminVocal(e1.res.corps?.vocal_stocke)?.cle === "90112233" && e1.res.corps.vocal_stocke === r1.chemin,
    JSON.stringify({ code: e1?.res.code, corps: e1?.res.corps, ev: e1?.base.evenements, r1 }));
  test("★★★ l'envoi joué : WhatsApp refuse → RIEN n'est rangé (on ne garde pas un message qui n'est pas parti)",
    e2?.res.code === 502 && e2.base.ranges.length === 0, JSON.stringify({ code: e2?.res.code, ranges: e2?.base.ranges }));
  test("★★ l'envoi joué : un son CHOISI dans les fichiers (pas le micro) part, mais ne se range pas",
    e3?.res.code === 200 && e3.base.ranges.length === 0 && !("vocal_stocke" in (e3.res.corps || {})), JSON.stringify(e3?.res.corps));
  test("★★ l'envoi joué : l'espace refuse (SQL pas encore collé) → la note est quand même partie, simplement sans chemin",
    e4?.res.code === 200 && e4.res.corps?.ok === true && !("vocal_stocke" in (e4.res.corps || {})), JSON.stringify(e4?.res.corps));
  test("★ l'application garde le chemin rendu (`stocke: reponse.vocal_stocke`)",
    /stocke: reponse\.vocal_stocke \|\| ""/.test(sansC(lire("src/whatsapp.js"))));

  // ---- L'écoute, jouée : api/whatsapp-media.js avec un faux admin ----
  const sortieM = join(cache, `bmi-m72-${process.pid}.mjs`);
  await build({ entryPoints: ["api/whatsapp-media.js"], bundle: true, format: "esm", platform: "node", outfile: sortieM, logLevel: "silent", external: ["@supabase/supabase-js"] });
  const APIM = await import(pathToFileURL(sortieM).href);
  unlinkSync(sortieM);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const ilYa40 = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const cheminOk = `${aujourdhui}/90112233_abcdefgh12.ogg`, cheminVieux = `${ilYa40}/90112233_abcdefgh34.ogg`, cheminAutre = `${aujourdhui}/91999999_abcdefgh56.ogg`;
  const fauxAdmin = (moi, lignes, magasin, telecharges) => ({
    auth: { async getUser(j) { return j === "ok" ? { data: { user: { email: moi + "@bmi" } }, error: null } : { data: {}, error: { message: "non" } }; } },
    from(table) {
      const filtres = [];
      const tables = { users: [{ id: "kossi", data: { role: "vendeur", nom: "KOSSI" } }, { id: "com1", data: { role: "commercial", nom: "COM1" } }, { id: "compta", data: { role: "comptable", nom: "COMPTA" } }], messages: lignes };
      const q = { select() { return q; }, order() { return q; }, limit() { return q; }, range() { return q; },
        eq(col, val) { filtres.push([col, val]); return q; },
        then(ok) { return Promise.resolve({ data: (tables[table] || []).filter((l) => filtres.every(([c, v]) => c === "id" ? l.id === v : c === "data->>wa_tel" ? (l.data || {}).wa_tel === v : true)), error: null }).then(ok); } };
      return q;
    },
    storage: { from(espace) { return { async download(chemin) { telecharges.push(`${espace}:${chemin}`); const o = magasin[chemin]; return o ? { data: new Blob([o]), error: null } : { data: null, error: { message: "Object not found" } }; } }; } },
  });
  const ligneVocal = (id, stocke, wa_tel = "90112233") => ({ id, data: { canal: "whatsapp", wa_tel, ts: new Date().toISOString(), de_id: "kossi", wa_media: { type: "voice", mime: "audio/ogg", envoye: true, duree: 2, stocke } } });
  const confie = { id: "c1", data: { canal: "whatsapp", wa_tel: "90112233", wa_systeme: true, ts: new Date(Date.now() - 60000).toISOString(), proprietaire_id: "com1", proprietaire_nom: "COM1", texte: "🔁 confiée" } };
  const ecouter = async (moi, message, lignes) => {
    const magasin = { [cheminOk]: Buffer.from("OggS-note-ok"), [cheminVieux]: Buffer.from("OggS-vieille"), [cheminAutre]: Buffer.from("OggS-autre") };
    const telecharges = [];
    const res = { code: 0, corps: null, entetes: {}, setHeader(k, v) { this.entetes[k] = v; }, status(c) { this.code = c; return this; }, json(o) { this.corps = o; return this; }, send(b) { this.corps = b; return this; }, end() { return this; } };
    await APIM.default({ method: "POST", headers: {}, body: { jeton: "ok", message } }, res, { adminClient: fauxAdmin(moi, lignes, magasin, telecharges) });
    return { res, telecharges };
  };
  const support = [ligneVocal("v1", cheminOk), ligneVocal("v2", cheminVieux), ligneVocal("v3", cheminAutre)];
  let m1, m2, m3, m4, m5, m6;
  try {
    m1 = await ecouter("kossi", "v1", support);
    m2 = await ecouter("com1", "v1", support);
    m3 = await ecouter("kossi", "v1", [...support, confie]);
    m4 = await ecouter("kossi", "v2", support);
    m5 = await ecouter("kossi", "v3", support);
    m6 = await ecouter("compta", "v1", support);
  } catch (er) { console.log("    (erreur de l'écoute jouée :", er?.message || er, ")"); }
  test("★★★ l'écoute jouée : un COLLÈGUE qui voit la conversation (support) entend la note rangée — le son rendu tel quel, en audio/ogg",
    m2?.res.code === 200 && String(m2.res.corps) === "OggS-note-ok" && m2.res.entetes["Content-Type"] === "audio/ogg" && m1?.res.code === 200
    && JSON.stringify(m2.telecharges) === JSON.stringify([`vocaux-wa:${cheminOk}`]), JSON.stringify({ code: m2?.res.code, corps: String(m2?.res.corps), t: m2?.telecharges }));
  test("★★★ LE MUR, dans le geste : une conversation CONFIÉE à COM1 → KOSSI refusé (403) et l'espace n'est même pas lu ; le comptable aussi",
    m3?.res.code === 403 && m3.telecharges.length === 0 && m6?.res.code === 403 && m6.telecharges.length === 0, `${m3?.res.code} ${m6?.res.code}`);
  test("★★★ plus de 30 jours → « plus gardée », sans lire l'espace ; le chemin d'une AUTRE conversation → refusé, sans lire l'espace",
    m4?.res.code === 404 && m4.res.corps?.error === VS.MOTIF_VOCAL_EXPIRE && m4.telecharges.length === 0
    && m5?.res.code === 404 && /n'appartient pas/.test(m5.res.corps?.error || "") && m5.telecharges.length === 0,
    JSON.stringify({ m4: m4?.res.corps, m5: m5?.res.corps }));

  // ---- L'effacement à 30 jours, joué ----
  const PV = await import("../api/_vocauxStockes.js");
  const fichiersParJour = { "2026-09-01": ["a_1.ogg", "b_2.ogg"], "2026-09-20": ["c_3.ogg"], "2026-09-21": ["d_4.ogg"], "2026-10-21": ["e_5.ogg"] };
  const retires = [];
  const adminPurge = { storage: { from(espace) { return {
    async list(dossier) { if (espace !== "vocaux-wa") return { data: [], error: null }; return { data: dossier ? (fichiersParJour[dossier] || []).map((name) => ({ name })) : [...Object.keys(fichiersParJour), "autre"].map((name) => ({ name, id: null })), error: null }; },
    async remove(chemins) { retires.push(...chemins); return { data: chemins, error: null }; },
  }; } } };
  const bilanPurge = await PV.purgerVocauxStockes(adminPurge, "2026-10-21");
  test("★★★ l'effacement joué : les jours de plus de 30 jours partent, fichier par fichier ; le 30e jour, aujourd'hui et un dossier inconnu restent",
    bilanPurge.jours === 2 && bilanPurge.effaces === 3 && JSON.stringify(retires.sort()) === JSON.stringify(["2026-09-01/a_1.ogg", "2026-09-01/b_2.ogg", "2026-09-20/c_3.ogg"]),
    JSON.stringify({ bilanPurge, retires }));
  const bilanPanne = await PV.purgerVocauxStockes({ storage: { from() { return { async list() { return { data: null, error: { message: "Bucket not found" } }; } }; } } }, "2026-10-21");
  test("★★ un espace absent ne fait pas tomber la tournée : un bilan avec son motif, jamais une erreur",
    bilanPanne.effaces === 0 && /Bucket not found/.test(bilanPanne.pourquoi || ""));
  test("★★ la tournée de 7 h appelle l'effacement et en rend le bilan",
    /const vocaux = await purgerVocauxStockes\(admin, aujourdhui\)/.test(sansC(lire("api/rappels-du-matin.js"))) && /relances_assistant, vocaux \}/.test(lire("api/rappels-du-matin.js")));

  // ---- Le SQL et les gardes ----
  const sql = lire("supabase/vocaux-1-espace.sql");
  test("★★ le SQL : l'espace « vocaux-wa » PRIVÉ, 3 Mo, sons seulement, sans « rollback », et il a son banc sur base jetable",
    /'vocaux-wa', 'vocaux-wa', false, 3145728/.test(sql) && /set public = false/.test(sql) && !/^\s*rollback/im.test(sql)
    && /tester-vocaux-sql\.sh/.test(lire("package.json")));
  const toutSrc = ["src/whatsapp.js", "src/screens/Whatsapp.jsx", "src/components/NoteVocale.jsx", "src/supabaseClient.js"].map((f) => sansC(lire(f))).join("\n");
  test("★★ l'application ne touche JAMAIS l'espace de fichiers elle-même : seul le serveur y range et y lit",
    !/\.storage\b/.test(toutSrc) && !/vocaux-wa/.test(toutSrc));

  // ---- L'écran, dans Chromium : un collègue sans copie entend la note rangée ----
  const dossier = mkdtempSync(join(tmpdir(), "bmi-vocal72-"));
  const fauxClient = join(dossier, "fauxClient.js");
  writeFileSync(fauxClient, `export async function mediaWaEnLigne(id) { (window.appelsMedia = window.appelsMedia || []).push(id); const b = (window.FAUX_VOCAUX || {})[id]; return b ? { blob: b } : { error: "Cette note vocale n'est plus disponible." }; }`);
  const bundle = join(dossier, "vocal.js");
  await build({ entryPoints: ["scripts/_navigateur-vocal.jsx"], bundle: true, format: "iife", platform: "browser", outfile: bundle, jsx: "automatic", loader: { ".js": "jsx" }, logLevel: "silent", define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fauxClient })); } }] });
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  try {
    const page = await nav.newPage();
    const erreurs = []; page.on("pageerror", (e) => erreurs.push(e.message));
    const f = join(dossier, "page.html");
    writeFileSync(f, `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${bundle}"></script></body></html>`);
    await page.goto(`file://${f}`);
    const etat = await page.evaluate(async ({ cheminOk, cheminVieux }) => {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(); const dest = ctx.createMediaStreamDestination(); osc.connect(dest); osc.start();
      const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm;codecs=opus" });
      const morceaux = []; rec.ondataavailable = (e) => morceaux.push(e.data);
      const fini = new Promise((ok) => { rec.onstop = ok; });
      rec.start(250); await new Promise((ok) => setTimeout(ok, 900)); rec.stop(); await fini; osc.stop();
      const ogg = window.Vocal.webmVersOgg(new Uint8Array(await new Blob(morceaux).arrayBuffer()));
      window.FAUX_VOCAUX = { wa_equipe: new Blob([ogg.octets], { type: "audio/ogg" }) };
      // La ligne vue par un collègue (aucune copie ici), une ligne de plus de 30 jours,
      // et la ligne de l'appareil qui l'a enregistrée (copie gardée).
      await window.Vocal.garderCopieVocal("wa_moi", new Blob([ogg.octets], { type: "audio/ogg" }));
      window.Vocal.monterLigneEnvoyee("wa_equipe", cheminOk);
      window.Vocal.monterLigneEnvoyee("wa_vieille72", cheminVieux);
      window.Vocal.monterLigneEnvoyee("wa_moi", cheminOk);
      return true;
    }, { cheminOk, cheminVieux });
    await page.waitForSelector("#ligne-wa_equipe [data-vocal-equipe] [data-vocal-lire]", { timeout: 8000 }).catch(() => {});
    await page.waitForSelector("#ligne-wa_vieille72 [data-vocal-ailleurs]", { timeout: 8000 }).catch(() => {});
    await page.waitForSelector("#ligne-wa_moi [data-vocal-lire]", { timeout: 8000 }).catch(() => {});
    const apres = await page.evaluate(() => ({
      equipe: !!document.querySelector("#ligne-wa_equipe [data-vocal-equipe] [data-vocal-lire]"),
      vieille: document.querySelector("#ligne-wa_vieille72")?.textContent || "",
      moi: !!document.querySelector("#ligne-wa_moi [data-vocal-lire]") && !document.querySelector("#ligne-wa_moi [data-vocal-equipe]"),
      appels: window.appelsMedia || [],
    }));
    test("★★★ dans Chromium : un COLLÈGUE (aucune copie sur son appareil) entend la note rangée dans LE lecteur commun",
      etat && apres.equipe && apres.appels.includes("wa_equipe") && erreurs.length === 0, JSON.stringify({ apres, erreurs }));
    test("★★★ dans Chromium : une note de plus de 30 jours ne demande RIEN au serveur et dit qu'elle est effacée",
      !apres.appels.includes("wa_vieille72") && apres.vieille.includes("Effacée 30 jours") && apres.vieille.includes("téléphone BMI"), JSON.stringify(apres));
    test("★★ dans Chromium : l'appareil qui l'a enregistrée joue sa COPIE, sans appel au serveur",
      apres.moi && !apres.appels.includes("wa_moi"), JSON.stringify(apres));
  } finally { await nav.close(); rmSync(dossier, { recursive: true, force: true }); }
}

titre("73 📱 CE QUI EST ÉCRIT DEPUIS LE TÉLÉPHONE BMI ENTRE DANS LE FIL, ET 🙋 LE CLIENT QUI ATTEND PEUT ÊTRE RENDU À L'ASSISTANT (21/10/2026, capture Timo d'EDEM, « les deux, lance »)");
{
  const WC = await import("../src/lib/whatsappConversations.js");
  const AW = await import("../src/lib/assistantWhatsapp.js");
  const I = await import("../src/lib/assistantIA.js");
  const RA = await import("../src/lib/relanceAssistant.js");
  const CLE = "98850976";
  const T = Date.parse("2026-10-21T13:00:00.000Z");
  const at = (min) => new Date(T + min * 60000).toISOString();
  const ent = (id, min, texte) => ({ id, canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_entrant: true, ts: at(min), texte });
  const echoCorps = (type, extra = {}) => ({ id: "evt_1", type, apiVersion: "v2", createTime: at(32),
    whatsappMessage: { id: "yc_tel_1", wamid: "wamid.TEL1", wabaId: "W", from: "+22899968488", to: `+228${CLE}`, type: "text", text: { body: "4kw/24V non" }, status: "sent", sendTime: at(32), ...extra } });
  const e1 = WC.lireEchoTelephone(echoCorps("whatsapp.smb.message.echoes"));
  const e2 = WC.lireEchoTelephone(echoCorps("whatsapp.smb.message.created"));
  const eDoc = WC.lireEchoTelephone(echoCorps("whatsapp.smb.message.echoes", { type: "document", text: undefined, document: { link: "https://api.ycloud.com/v2/whatsapp/media/download/9", id: "9", caption: "fiche", mime_type: "application/pdf" } }));
  test("★★★ les deux événements de YCloud (`smb.message.echoes`, `smb.message.created`) sont lus : le CLIENT (to), le texte, les numéros de Meta, l'heure d'envoi",
    e1 && e1.to === `+228${CLE}` && e1.texte === "4kw/24V non" && e1.id === "yc_tel_1" && e1.wamid === "wamid.TEL1" && e1.ts === at(32)
    && e2 && e2.wamid === "wamid.TEL1", JSON.stringify(e1));
  test("★★ un fichier envoyé du téléphone garde son lien (il s'ouvre comme un fichier reçu) ; une coche ou un message de client n'est PAS un écho",
    eDoc?.media?.lien?.includes("download/9") && eDoc.texte === "fiche"
    && WC.lireEchoTelephone({ whatsappMessage: { id: "x", status: "delivered" } }) === null
    && WC.lireEchoTelephone({ type: "whatsapp.inbound_message.received", whatsappInboundMessage: { from: "+228", text: { body: "x" } } }) === null);
  const ligneTel = WC.ligneEchoTelephone({ echo: e1, cle: CLE, nomClient: "EDEM", ts: at(32) });
  test("★★★ la ligne : une réponse de BMI écrite par une PERSONNE (`wa_telephone`), sans propriétaire, sans ouvrir la fenêtre, avec son wamid pour les coches",
    !ligneTel.wa_entrant && !ligneTel.wa_systeme && ligneTel.wa_telephone === true && !ligneTel.proprietaire_id
    && ligneTel.wa_wamid === "wamid.TEL1" && ligneTel.wa_statut?.etat === "envoye" && ligneTel.de_id === WC.ID_TELEPHONE_BMI && ligneTel.texte === "4kw/24V non"
    && ligneTel.canal === "whatsapp" && ligneTel.wa_tel === CLE, JSON.stringify(ligneTel));
  test("★★ déjà dans le fil (YCloud renvoie, ou les deux événements arrivent) : ni deux fois, ni par-dessus une ligne partie de l'application",
    WC.echoDejaLa([ligneTel], e2) && WC.echoDejaLa([{ wa_wamid: "wamid.TEL1" }], { wamid: "wamid.TEL1" }) && !WC.echoDejaLa([ent("e1", 0, "x")], e1));
  const fil = [ent("e1", 0, "bonjour"), ent("e2", 22, "les prix svp"), ligneTel];
  test("★★★ l'assistant le lit comme un COLLÈGUE : il se tait 24 h, se tait s'il était en train de répondre, ne relance pas — et le bouton « Rendre » apparaît",
    AW.decisionAssistant({ fil: [...fil, ent("e3", 40, "ok merci")], maintenant: at(40) }).repondre === false
    && AW.bmiAEcritApres(fil, fil[1]) === true
    && RA.relanceAFaire({ fil, maintenant: at(22 + 21 * 60) }).relancer === false
    && AW.assistantEnRetrait({ fil, maintenant: at(40) }) === true
    && AW.attenteConseiller(fil) === null
    && WC.dernierEntrant(fil)?.id === "e2");
  const ia = I.messagesPourIA([ent("e2", 22, "les prix svp"), ligneTel, ent("e3", 40, "et le 5 kW ?")]);
  test("★★ l'IA sait qu'une PERSONNE a écrit depuis le téléphone BMI (sa marque), jamais que c'est elle — et la consigne la nomme",
    I.marqueEquipe(ligneTel) === I.MARQUE_TELEPHONE && ia.some((m) => m.role === "assistant" && String(m.content).includes(I.MARQUE_TELEPHONE))
    && I.consignePour({}).includes(I.MARQUE_TELEPHONE) && I.sansMarqueEquipe(`${I.MARQUE_TELEPHONE} bonjour`) === "bonjour", JSON.stringify(ia));

  // 🙋 « a » : le client qui attend.
  const tous = { id: "s1", canal: "whatsapp", wa_tel: CLE, wa_entrant: false, wa_systeme: true, de_id: "TIMO", ts: at(29), texte: "🔓 rendue à tous", proprietaire_efface: true };
  const edem = [ent("e1", 0, "bonjour"), ent("e2", 22, "les prix svp"), tous];
  test("★★★ le cas d'EDEM : son message est le dernier, personne n'a répondu, la conversation vient d'être rendue à tous → le bouton « Rendre à l'assistant »",
    AW.clientSansReponse(edem, at(34)) === true && AW.assistantEnRetrait({ fil: edem, maintenant: at(34) }) === true);
  test("★★ mais pas pendant que l'assistant peut encore être en train de répondre (moins de 2 min), ni au-delà de 24 h, ni s'il a déjà répondu, ni une fois rendue",
    AW.clientSansReponse([ent("e1", 0, "x")], at(1)) === false
    && AW.clientSansReponse([ent("e1", 0, "x")], at(25 * 60)) === false
    && AW.clientSansReponse([ent("e1", 0, "x"), { ...AW.ligneAssistant({ cle: CLE, tel: CLE, texte: "r", etape: AW.ETAPE_MENU, ts: at(0.2) }), id: "a1" }], at(10)) === false
    && AW.clientSansReponse([ent("e1", 0, "x"), AW.ligneRenduAssistant({ cle: CLE, tel: CLE, par: "TIMO", par_id: "TIMO", ts: at(3) })], at(10)) === false
    && AW.clientSansReponse([ent("e1", 0, "x"), ligneTel], at(40)) === false);

  // ── Le serveur, lu : l'écho passe AVANT le suivi (sinon pris pour une coche, il attendrait 15 min).
  const EN = lire("api/whatsapp-entrant.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  test("★★★ l'adresse d'arrivée reconnaît l'écho AVANT les nouvelles de suivi, et le serveur du bouton suit la MÊME règle (`assistantEnRetrait`)",
    EN.indexOf("const echo = lireEchoTelephone(req.body)") > 0 && EN.indexOf("const echo = lireEchoTelephone(req.body)") < EN.indexOf("const suivi = lireStatut(req.body)")
    && /if \(echo\) return traiterEchoTelephone\(res, echo, debut\)/.test(EN)
    && /assistantEnRetrait\(\{ fil, proprietaireId: proprietaire\.id, maintenant \}\)/.test(lire("api/_rendreAssistant.js")));

  // ── La VRAIE fonction, sur une base jouée.
  const { traiterEchoTelephone } = await import("../api/whatsapp-entrant.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [], de: 0, a: Infinity };
      const valeur = (l, col) => (col.startsWith("data->>") ? String(l.data?.[col.slice(7)] ?? "") : String(l[col] ?? ""));
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        return { data: structuredClone((tables[t] || []).filter((l) => q.filtres.every(([c, v]) => valeur(l, c) === String(v))).slice(q.de, q.a + 1)), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, order() { return b; }, limit() { return b; }, range(de, a) { q.de = de; q.a = a; return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const fauxRes = () => { const r = { code: 0, corps: null, status(c) { r.code = c; return r; }, json(o) { r.corps = o; return r; } }; return r; };
  const entete = { id: WC.idEntete(CLE), canal: "whatsapp_entete", wa_tel: CLE, wa_numero: `+228${CLE}`, wa_nom: "EDEM", wa_nom_donne: "EDEM SOLAIRE", proprietaire_id: "", derniere: at(22), ts: at(22) };
  const tables = { messages: [ent("e2", 22, "les prix svp"), entete].map((m) => ({ id: m.id, data: m, updated_at: m.ts })) };
  const r1 = fauxRes(), r2 = fauxRes(), r3 = fauxRes();
  let err = "";
  try {
    await traiterEchoTelephone(r1, e1, Date.now(), fauxAdmin(tables));
    await traiterEchoTelephone(r2, e1, Date.now(), fauxAdmin(tables));
    await traiterEchoTelephone(r3, e2, Date.now(), fauxAdmin(tables));
  } catch (x) { err = x?.message || String(x); }
  const lignes = tables.messages.map((l) => l.data);
  const telLignes = lignes.filter((m) => m.wa_telephone);
  const fiche = lignes.find((m) => m.canal === "whatsapp_entete");
  test("★★★ la chaîne jouée : la réponse du téléphone s'écrit UNE fois (renvoyée, ou par l'autre événement : rien de plus), et la fiche légère remonte la conversation en gardant son nom",
    !err && r1.corps?.ok === true && r2.corps?.deja === true && r3.corps?.deja === true && telLignes.length === 1
    && fiche?.derniere === at(32) && fiche?.wa_nom_donne === "EDEM SOLAIRE" && !fiche?.proprietaire_id, `${err} ${JSON.stringify([r1.corps, r2.corps, r3.corps])}`);
  const vide = fauxRes();
  await traiterEchoTelephone(vide, { ...e1, to: "" }, Date.now(), fauxAdmin({ messages: [] }));
  test("★ un numéro de client illisible est dit, jamais une erreur (YCloud renverrait sans fin)", vide.code === 200 && vide.corps?.ignore === true);

  // ── L'écran RENDU.
  const attend = monte(() => V.renduClientQuiAttend(10)), tropTot = monte(() => V.renduClientQuiAttend(1));
  const avecTel = monte(() => V.renduAvecTelephone({ ...WC.ligneEchoTelephone({ echo: { ...e1, texte: "REPONSE DU TELEPHONE" }, cle: "90112233", nomClient: "ESSO", ts: new Date(Date.now() - 5 * 60000).toISOString() }) }));
  test("★★★ l'écran RENDU : EDEM attend depuis 10 min, conversation rendue à tous → « 🤖 Rendre à l'assistant » ; depuis 1 min → pas encore",
    attend.includes("data-rendre-assistant") && !tropTot.includes("data-rendre-assistant"), [attend, tropTot].map((h) => h.slice(0, 80)).join(" | "));
  test("★★ l'écran RENDU : la réponse du téléphone se lit dans le fil, signée « 📱 Téléphone BMI »",
    avecTel.includes("REPONSE DU TELEPHONE") && avecTel.includes("📱 Téléphone BMI"), avecTel.slice(0, 120));
}

titre("74 ⚠ QUAND LE SERVICE D'IA REFUSE DE RÉPONDRE, L'ADMINISTRATEUR PRINCIPAL EST PRÉVENU, UNE FOIS PAR JOUR (22/10/2026, crédit Anthropic épuisé, « b, lance »)");
{
  const P = await import("../src/lib/panneIA.js");
  const credit = Object.assign(new Error("Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."), { statut: 400 });
  const cle = Object.assign(new Error("invalid x-api-key"), { statut: 401 });
  const lent = Object.assign(new Error("Overloaded"), { statut: 529 });
  test("★★★ la règle : crédit épuisé → « credit », clé refusée → « cle » ; une surcharge, une coupure, un délai dépassé ne préviennent PERSONNE",
    P.motifPanneIA(credit) === "credit" && P.motifPanneIA(cle) === "cle" && P.motifPanneIA(lent) === null
    && P.motifPanneIA(new Error("This operation was aborted")) === null && P.motifPanneIA(new Error("fetch failed")) === null && P.motifPanneIA(null) === null);
  test("★★ une fois par jour et par sorte de panne : la marque du jour arrête, celle d'hier ou d'une autre panne non",
    P.alerteAEnvoyer({}, "credit", "2026-10-22") && !P.alerteAEnvoyer({ alerte_ia: { jour: "2026-10-22", motif: "credit" } }, "credit", "2026-10-22")
    && P.alerteAEnvoyer({ alerte_ia: { jour: "2026-10-21", motif: "credit" } }, "credit", "2026-10-22")
    && P.alerteAEnvoyer({ alerte_ia: { jour: "2026-10-22", motif: "credit" } }, "cle", "2026-10-22") && !P.alerteAEnvoyer({}, null, "2026-10-22"));
  const env = P.envoiPanneIA("timo", "credit");
  test("★★ la notification : au principal SEUL, elle dit quoi faire (recharger sur console.anthropic.com) et que le menu répond en attendant",
    env.destinataires.length === 1 && env.destinataires[0] === "timo" && /crédit Anthropic épuisé/.test(env.titre) && /console\.anthropic\.com/.test(env.texte)
    && /menu à chiffres/.test(env.texte) && env.ecran === "parametres" && P.envoiPanneIA("", "credit") === null && P.envoiPanneIA("timo", null) === null);
  test("★ panneIA.js n'importe rien (lu par le serveur tel quel)", !/^\s*import /m.test(lire("src/lib/panneIA.js")));

  // ── La chaîne jouée sur une base factice.
  const webpush = (await import("web-push")).default;
  const k = webpush.generateVAPIDKeys();
  const avant = { pub: process.env.VAPID_PUBLIC_KEY, priv: process.env.VAPID_PRIVATE_KEY };
  process.env.VAPID_PUBLIC_KEY = k.publicKey; process.env.VAPID_PRIVATE_KEY = k.privateKey;
  const { signalerPanneIA } = await import("../api/_alertePanneIA.js");
  const base = () => ({ users: [
    { id: "timo", data: { nom: "TIMO", role: "admin", admin_principal: true } },
    { id: "adm2", data: { nom: "ADM2", role: "admin" } },
    { id: "kossi", data: { nom: "KOSSI", role: "vendeur" } },
  ], abonnements_push: [] });
  const fauxAdminP = (tables, ecrits) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [] };
      const exec = () => {
        if (q.op === "update") { ecrits.push({ t, filtres: q.filtres, charge: structuredClone(q.charge) }); (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => String(l[c]) === String(v))).forEach((l) => Object.assign(l, structuredClone(q.charge))); return { data: null, error: null }; }
        const lignes = (tables[t] || []).filter((l) => q.filtres.every(([c, v]) => (Array.isArray(v) ? v.includes(l[c]) : String(l[c]) === String(v))));
        return { data: q.un ? structuredClone(lignes[0] || null) : structuredClone(lignes), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, in(c, v) { q.filtres.push([c, v]); return b; }, maybeSingle() { q.un = true; return b; }, update(c) { q.op = "update"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  // (d'abord : une base injoignable ne laisse aucune mémoire derrière elle)
  const r4 = await signalerPanneIA({ from() { throw new Error("base injoignable"); } }, Object.assign(new Error("credit balance is too low"), { statut: 400 }));
  const t1 = base(), e1 = [];
  const r1 = await signalerPanneIA(fauxAdminP(t1, e1), credit);
  const marque = t1.users.find((u) => u.id === "timo").data.alerte_ia;
  test("★★★ la chaîne jouée : crédit épuisé → la marque du jour sur la fiche du PRINCIPAL (jamais un autre administrateur), puis la notification",
    r1.prevenu === true && r1.motif === "credit" && marque?.motif === "credit" && marque?.jour === new Date().toISOString().slice(0, 10)
    && e1.length === 1 && e1[0].filtres.some(([c, v]) => c === "id" && v === "timo") && !t1.users.find((u) => u.id === "adm2").data.alerte_ia, JSON.stringify(r1));
  const t2 = base(), e2 = [];
  t2.users[0].data.alerte_ia = { jour: new Date().toISOString().slice(0, 10), motif: "cle" };
  const r2a = await signalerPanneIA(fauxAdminP(t2, e2), cle);
  const r2b = await signalerPanneIA(fauxAdminP(base(), e2), cle);
  test("★★★ la chaîne jouée : déjà prévenu aujourd'hui (la marque de la fiche, puis la mémoire de l'instance) → rien n'est écrit ni envoyé",
    r2a.prevenu === false && r2b.prevenu === false && e2.length === 0, JSON.stringify([r2a, r2b]));
  const t3 = base(), e3 = [];
  const r3 = await signalerPanneIA(fauxAdminP(t3, e3), lent);
  test("★★ une panne passagère ne touche à rien ; une base injoignable ne lève JAMAIS (le menu répond quand même au client)",
    r3.prevenu === false && e3.length === 0 && r4.prevenu === false);
  process.env.VAPID_PUBLIC_KEY = avant.pub || ""; process.env.VAPID_PRIVATE_KEY = avant.priv || "";
  if (!avant.pub) delete process.env.VAPID_PUBLIC_KEY;
  if (!avant.priv) delete process.env.VAPID_PRIVATE_KEY;

  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const EN = sansComm(lire("api/whatsapp-entrant.js")), RL = sansComm(lire("api/_relanceAssistant.js"));
  test("★★★ branchée là où l'IA échoue : l'adresse d'arrivée (puis le menu répond) ET la relance (puis la phrase fixe)",
    /IA indisponible, le menu reprend[^\n]*\n\s*await signalerPanneIA\(admin, e\);/.test(EN)
    && /IA indisponible, phrase fixe[^\n]*\n\s*await signalerPanneIA\(admin, e\);/.test(RL));
}

titre("75 🔑 LES IDENTIFIANTS REPARTENT PAR `espace` QUAND META REJETTE `espace_portail` APRÈS L'ENVOI (22/10/2026, capture KATAKA, « b+c »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const R = await import(pathToFileURL(join(process.cwd(), "src/lib/relaisAcces.js")).href);
  const CC = await import(pathToFileURL(join(process.cwd(), "src/lib/comptesClients.js")).href);
  const MW = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappModeles.js")).href);
  const CLE = "90112233";
  const compte = { id: "c-kat", role: "client", nom: "KATAKA", nom_base: "KATAKA", tel: `228${CLE}`, mdp_auto: true, mdp_variante: 0, mdp_longueur: 6 };
  const mdp = CC.motDePasseConnu(compte);
  const ligneAcces = { id: "l-acc", canal: "whatsapp", wa_tel: CLE, wa_numero: `228${CLE}`, wa_nom: "KATAKA", de_id: "u-com", de_nom: "COM1", texte: MW.texteEspaceMasque("KATAKA", "espace_portail"), wa_acces: { client_id: "c-kat", renvoi: false, modele: "espace_portail" }, wa_envoi_id: "yc_acc" };
  const echec = { etat: "echec", le: "2026-10-22T09:00:00.000Z", motif: "Failed to send message because this user's phone number is part of an experiment", code: 130472 };
  test("★★★ la règle : un ❌ sur un `espace_portail` pas encore relayé → relais ; jamais deux fois, jamais sur une coche ordinaire, jamais pour `espace` lui-même, jamais sans compte",
    R.relaisAccesAFaire(ligneAcces, echec) === true
    && R.relaisAccesAFaire({ ...ligneAcces, wa_relais_le: "x" }, echec) === false
    && R.relaisAccesAFaire(ligneAcces, { etat: "recu", le: "x" }) === false
    && R.relaisAccesAFaire({ ...ligneAcces, wa_acces: { ...ligneAcces.wa_acces, modele: "espace" } }, echec) === false
    && R.relaisAccesAFaire({ ...ligneAcces, wa_acces: { ...ligneAcces.wa_acces, client_id: "" } }, echec) === false
    && R.relaisAccesAFaire({ ...ligneAcces, wa_acces: null, wa_modele: "espace_portail" }, echec) === false);
  const e = R.envoiRelaisAcces({ compte, nomAffiche: "KATAKA" });
  test("★★★ le relais part par `espace` (message de SERVICE), le mot de passe RECALCULÉ depuis la fiche, dans l'ordre nom · identifiant · mot de passe",
    !!mdp && e?.modele === "espace" && e.variables[0] === "KATAKA" && e.variables[1] === "KATAKA" && e.variables[2] === mdp && MW.MODELES.espace?.categorie === "utility");
  test("★★★ le mur : formation, fiche fermée, désactivée, bloquée, un employé, un mot de passe non recalculable → rien",
    R.envoiRelaisAcces({ compte: { ...compte, formation: true } }) === null
    && R.envoiRelaisAcces({ compte: { ...compte, sans_acces: true } }) === null
    && R.envoiRelaisAcces({ compte: { ...compte, actif: false } }) === null
    && R.envoiRelaisAcces({ compte: { ...compte, bloque: true } }) === null
    && R.envoiRelaisAcces({ compte: { ...compte, role: "vendeur" } }) === null
    && R.envoiRelaisAcces({ compte: { ...compte, mdp_auto: false } }) === null
    && R.envoiRelaisAcces({ compte: null }) === null);
  const lr = R.ligneRelaisAcces({ id: "x", ligne: ligneAcces, ts: "2026-10-22T09:00:01.000Z" });
  test("★★★ la ligne du fil ne porte JAMAIS le mot de passe : texte masqué de `espace`, `wa_acces` (le créateur et l'administrateur la lisent en clair), sans propriétaire",
    !!lr && !JSON.stringify(lr).includes(mdp) && lr.texte === MW.texteEspaceMasque("KATAKA", "espace") && lr.wa_acces?.client_id === "c-kat" && lr.wa_acces?.modele === "espace"
    && lr.de_id === "u-com" && lr.wa_relais_de === "l-acc" && !lr.proprietaire_id
    && MW.texteAccesAffiche(lr, { id: "u-com", role: "commercial" }, { identifiant: "KATAKA", motDePasse: mdp }).includes(mdp)
    && !MW.texteAccesAffiche(lr, { id: "u-autre", role: "vendeur" }, { identifiant: "KATAKA", motDePasse: mdp }).includes(mdp));
  // ── La VRAIE fonction du serveur, sur une base jouée
  const { relayerAccesSansPortail } = await import("../api/_relaisAcces.js");
  const fauxAdmin = (tables) => ({
    from(t) {
      const q = { op: "select", charge: null, filtres: [] };
      const exec = () => {
        if (q.op === "insert") { (tables[t] ||= []).push(structuredClone(q.charge)); return { data: null, error: null }; }
        if (q.op === "upsert") { const l = (tables[t] ||= []); const i = l.findIndex((x) => x.id === q.charge.id); if (i >= 0) l[i] = structuredClone(q.charge); else l.push(structuredClone(q.charge)); return { data: null, error: null }; }
        return { data: structuredClone((tables[t] || []).filter((l) => q.filtres.every(([c, v]) => String(l[c]) === String(v)))), error: null };
      };
      const b = { select() { return b; }, eq(c, v) { q.filtres.push([c, v]); return b; }, limit() { return b; }, insert(c) { q.op = "insert"; q.charge = c; return b; }, upsert(c) { q.op = "upsert"; q.charge = c; return b; }, then(res, rej) { return Promise.resolve(exec()).then(res, rej); } };
      return b;
    },
  });
  const envAvant = { c: process.env.YCLOUD_API_KEY, d: process.env.WHATSAPP_NUMERO_BMI };
  const fetchAvant = globalThis.fetch;
  const errAvant = console.error;
  let envois = [], journal = [], refuser = false, ok1, ok2, ok3, tables1, tables2, tables3;
  globalThis.fetch = async (url, opts) => {
    envois.push(JSON.parse(opts?.body || "{}"));
    if (refuser) return new Response(JSON.stringify({ error: { message: "Template not approved", code: 132001 } }), { status: 400 });
    return new Response(JSON.stringify({ id: `yc_${envois.length}`, wamid: "wamid.A", status: "accepted" }), { status: 200 });
  };
  try {
    console.error = (...a) => { journal.push(a.map(String).join(" ")); };
    process.env.YCLOUD_API_KEY = "yc-de-banc"; process.env.WHATSAPP_NUMERO_BMI = "22899968488";
    const entete = { id: `waent_${CLE}`, canal: "whatsapp_entete", wa_tel: CLE, proprietaire_id: "u-com", proprietaire_nom: "COM1" };
    tables1 = { users: [{ id: "c-kat", data: compte }], messages: [{ id: "l-acc", data: ligneAcces }, { id: entete.id, data: entete }] };
    ok1 = await relayerAccesSansPortail(fauxAdmin(tables1), ligneAcces);
    tables2 = { users: [{ id: "c-kat", data: { ...compte, formation: true } }], messages: [] };
    const n2 = envois.length;
    ok2 = await relayerAccesSansPortail(fauxAdmin(tables2), ligneAcces);
    tables2.envois = envois.length - n2;
    refuser = true;
    tables3 = { users: [{ id: "c-kat", data: compte }], messages: [] };
    ok3 = await relayerAccesSansPortail(fauxAdmin(tables3), ligneAcces);
  } catch (err) { console.log("    (erreur de la chaîne jouée :", err?.message || err, ")"); }
  finally {
    console.error = errAvant; globalThis.fetch = fetchAvant;
    for (const [k, v] of Object.entries({ YCLOUD_API_KEY: envAvant.c, WHATSAPP_NUMERO_BMI: envAvant.d })) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
  const parti = envois[0] || {};
  const ligneR = (tables1?.messages || []).find((l) => l.data?.wa_relais_de === "l-acc")?.data;
  const fiche = (tables1?.messages || []).find((l) => l.id === `waent_${CLE}`)?.data;
  test("★★★ la chaîne jouée : `espace` part au client avec ses trois codes, le mot de passe recalculé",
    ok1 === true && parti.type === "template" && parti.template?.name === "espace" && parti.to === `+228${CLE}`
    && JSON.stringify(parti.template?.components?.[0]?.parameters?.map((p) => p.text)) === JSON.stringify(["KATAKA", "KATAKA", mdp]));
  test("★★★ la ligne écrite dans la base ne porte pas le mot de passe, porte son numéro de suivi (coches), et la fiche légère garde son propriétaire",
    !!ligneR && !JSON.stringify(tables1.messages).includes(mdp) && ligneR.wa_acces?.modele === "espace" && !!ligneR.wa_envoi_id && fiche?.proprietaire_id === "u-com" && !!fiche?.derniere);
  test("★★★ le mur sur la vraie fonction : un compte de formation n'envoie RIEN", ok2 === false && tables2?.envois === 0);
  test("★★★ rien n'est écrit tant que WhatsApp n'a pas accepté, et le journal du serveur ne porte jamais le mot de passe",
    ok3 === false && (tables3?.messages || []).length === 0 && !journal.join("\n").includes(mdp));
  const codeE = sansComm(lire("api/whatsapp-entrant.js"));
  const suivi = codeE.slice(codeE.indexOf("async function traiterSuivi"));
  test("★★★ le suivi : la marque `wa_relais_le` est posée AVEC la coche, AVANT le relais des accès — une seule fois",
    /const relaisAcces = !relais && !relaisRecu && relaisAccesAFaire\(/.test(suivi)
    && suivi.indexOf(".update({ data, updated_at: ts })") < suivi.indexOf("relayerAccesSansPortail(")
    && /if \(relaisAcces\) await relayerAccesSansPortail\(admin, \{ \.\.\.data, id: trouvee\.id \}\);/.test(suivi));
  test("★★ « c » : le refus 130472 se dit en français (par le code, et par les mots si le code manque)",
    /essai de Meta/.test(MW.traduireMotifWhatsApp("", 130472)) && /essai de Meta/.test(MW.traduireMotifWhatsApp("Failed to send message because this user's phone number is part of an experiment", "")));
  test("★ la règle du relais ne lit jamais de clé secrète", !/YCLOUD_API_KEY|VITE_/.test(lire("src/lib/relaisAcces.js")));
}

titre("76 💸 « PERSONNE — PAYÉ DIRECTEMENT » DIT À QUI, ET LA PERSONNE PAYÉE EST PRÉVENUE (22/10/2026, « Ab, Bb, Cb, texte ok », « la case reste à choisir »)");
{
  const sansComm = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const P = await import(pathToFileURL(join(process.cwd(), "src/lib/payeDirectement.js")).href);
  const MW = await import(pathToFileURL(join(process.cwd(), "src/lib/whatsappModeles.js")).href);
  const Vd = await import(pathToFileURL(join(process.cwd(), "src/lib/validationDepenses.js")).href);
  test("★★★ la case se CHOISIT : vide = refus ; « A b » : le nom exigé, le numéro facultatif mais de 8 chiffres s'il est tapé",
    !!P.critiqueChoixRemis("") && P.critiqueChoixRemis("personne") === null
    && !!P.critiquePayeA({ nom: "", tel: "" }) && P.critiquePayeA({ nom: "Station Total", tel: "" }) === null
    && !!P.critiquePayeA({ nom: "X", tel: "90 1" }) && P.critiquePayeA({ nom: "X", tel: "+228 90 11 22 33" }) === null
    && P.critiquePayeA({ nom: "", tel: "" }, { nomExige: false }) === null && !!P.critiquePayeA({ nom: "", tel: "90112233" }, { nomExige: false }));
  const dep = { id: "d1", montant: 3000, paiement: "Espèces", categorie: "Livraison", description: "Tricycle", date: "2026-10-22", paye_a: { nom: "Station Total", tel: "90112233" } };
  test("★★★ « B b » : le message part quand la dépense COMPTE, jamais en attente ni rejetée, jamais sans numéro, jamais en formation, UNE fois",
    P.avisFondsRemisAFaire(dep, { compte: true }) === true
    && P.avisFondsRemisAFaire(dep, { compte: false }) === false
    && P.avisFondsRemisAFaire(dep, { compte: true, rejetee: true }) === false
    && P.avisFondsRemisAFaire({ ...dep, paye_a: { nom: "X", tel: "" } }, { compte: true }) === false
    && P.avisFondsRemisAFaire(dep, { compte: true, formation: true }) === false
    && P.avisFondsRemisAFaire(P.marquerFondsRemisAnnonce(dep, "2026-10-22"), { compte: true }) === false);
  test("★★ « C b » : ✏️ Modifier corrige le nom et le numéro ; la marque « déjà prévenu » reste si le NUMÉRO ne change pas, part s'il change",
    P.changeDePayeA(dep, undefined) === false && P.changeDePayeA(dep, { nom: "Station Total", tel: "90 11 22 33" }) === false && P.changeDePayeA(dep, { nom: "Total", tel: "90112233" }) === true
    && P.avecPayeA({ ...dep, paye_a: { ...dep.paye_a, avise_le: "x" } }, { nom: "Total", tel: "90 11 22 33" }).paye_a.avise_le === "x"
    && !P.avecPayeA({ ...dep, paye_a: { ...dep.paye_a, avise_le: "x" } }, { nom: "Total", tel: "91000000" }).paye_a.avise_le
    && !("paye_a" in P.avecPayeA(dep, null)));
  const m1 = Vd.modifierDepense({ ...dep, boutique: "APESSITO" }, { categorie: "Livraison", description: "Tricycle", payeA: { nom: "Station Total", tel: "91000000" } }, "TIMO", "2026-10-22");
  test("★★ modifierDepense écrit la nouvelle personne payée et le DIT au journal ; critiqueModifDepense voit le changement (pas « Rien n'a changé »)",
    m1.depense.paye_a?.tel === "91000000" && /payé à : Station Total \(90112233\) → Station Total \(91000000\)/.test(m1.journal)
    && Vd.critiqueModifDepense({ ...dep, boutique: "APESSITO" }, { categorie: "Livraison", description: "Tricycle", payeA: { nom: "Station Total", tel: "91000000" } }) === null);
  const A = V.avisFondsRemis();
  test("★★★ le modèle `fonds_remis` (UTILITY) : nom · montant · date · moyen · pour · remis par, le texte accepté par Timo",
    MW.MODELES.fonds_remis?.categorie === "utility" && A.envoi.variables.length === 6 && A.envoi.variables[0] === "Station Total" && /^3.000 F$/.test(A.envoi.variables[1]) && A.envoi.variables[2] === "22/10/2026" && A.envoi.variables[3] === "espèces" && A.envoi.variables[4] === "Livraison — Tricycle Adidogomé" && A.envoi.variables[5] === "AMA Koffi, APESSITO",
    JSON.stringify(A.envoi));
  test("★★ le texte : « Bonjour Station Total, BMI TOGO vous a remis 3 000 F le 22/10/2026, en espèces, pour : … Remis par AMA Koffi, APESSITO. Si ce montant ne correspond pas… »",
    /^Bonjour Station Total, BMI TOGO vous a remis 3.000 F le 22\/10\/2026, en espèces, pour : Livraison — Tricycle Adidogomé\. Remis par AMA Koffi, APESSITO\. Si ce montant ne correspond pas à ce que vous avez reçu, répondez simplement à ce message\. Merci\. BMI TOGO$/.test(A.texte)
    && MW.moyenFondsRemis("Mobile Money (Flooz)") === "Mobile Money (Flooz)" && MW.moyenFondsRemis("Virement bancaire") === "virement bancaire", A.texte);
  test("★★★ la ligne du fil est PRIVÉE (le montant ne se lit pas par tous) ; le détail se recompose depuis la dépense pour qui a le droit",
    A.rangee.wa_prive === true && A.rangee.depense_id === "DEPF" && !/3.000/.test(A.rangee.texte) && A.detail === A.attendu && /Station Total/.test(A.detail), JSON.stringify({ r: A.rangee.texte, d: A.detail }));
  test("★ sans numéro, aucun envoi ne se fabrique", MW.envoiFondsRemis({ dep: { ...dep, paye_a: { nom: "X", tel: "" } } }) === null);
  // « oui ajoute-le » (22/10/2026) : au-delà du seuil l'avis part du DG ; la
  // personne qui a SAISI la dépense lit aussi son détail — par `par_id` seul.
  const fv = {};
  for (const id of ["AMA", "TIMO", "ADMIN2", "KOSSI"]) { try { fv[id] = V.htmlFondsRemisValide(id); } catch (e) { fv[id] = ""; } }
  test("★★★ l'écran RENDU : l'avis parti à la validation du DG — AMA (qui a saisi) et le principal lisent le détail ; un autre administrateur et un autre vendeur la phrase neutre",
    /Station Oando/.test(fv.AMA) && /7.500 F/.test(fv.AMA) && /Station Oando/.test(fv.TIMO)
    && !/Station Oando/.test(fv.ADMIN2) && /celui qui a saisi la dépense/.test(fv.ADMIN2)
    && !/Station Oando/.test(fv.KOSSI), JSON.stringify(Object.fromEntries(Object.entries(fv).map(([k, h]) => [k, /Station Oando/.test(h) ? "détail" : /ERREUR/.test(h) ? h.slice(0, 120) : "neutre"]))));
  test("★★ la règle : jamais par le NOM (deux homonymes), jamais pour un autre modèle",
    MW.peutLireLignePrivee({ wa_prive: true, de_id: "TIMO" }, { id: "AMA" }, false, ["AMA"]) === true
    && MW.peutLireLignePrivee({ wa_prive: true, de_id: "TIMO" }, { id: "AMA" }, false) === false
    && /return dep && dep\.par_id \? \[dep\.par_id\] : \[\];/.test(lire("src/lib/lignesPrivees.js"))
    && /if \(!m \|\| !m\.wa_prive \|\| m\.wa_modele !== "fonds_remis"\) return \[\];/.test(lire("src/lib/lignesPrivees.js")));
  const D = sansComm(lire("src/screens/Depenses.jsx"));
  const corpsEnr = D.slice(D.indexOf("const enregistrerDepense = async"), D.indexOf("const ajouter = () =>"));
  const corpsVal = D.slice(D.indexOf("const validerDG = async"), D.indexOf("const rejeterDG = async"));
  const corpsMod = D.slice(D.indexOf("const enregistrerModif = async"), D.indexOf("const chantiersModif ="));
  const corpsEnv = D.slice(D.indexOf("async function envoyerAvisFondsRemis"), D.indexOf("function useModifDepense"));
  test("★★★ UNE fonction d'envoi, appelée APRÈS l'écriture par la saisie, la validation du DG et ✏️ Modifier — jamais par le rejet",
    corpsEnr.indexOf("envoyerAvisFondsRemis(") > corpsEnr.indexOf("save(") && corpsVal.indexOf("envoyerAvisFondsRemis(") > corpsVal.indexOf("save(")
    && corpsMod.indexOf("envoyerAvisFondsRemis(") > corpsMod.indexOf("save(") && !D.slice(D.indexOf("const rejeterDG = async"), D.indexOf("const supprimerDepense")).includes("envoyerAvisFondsRemis("));
  test("★★★ le mur et l'unique fois : la boutique de la dépense en formation → rien ; `avise_le` posé DANS la même écriture que la ligne (apresEnvoi), sans question ni repli",
    /const formation = !!\(db\.boutiques \|\| \[\]\)\.find\(\(b\) => b\.nom === dep\?\.boutique\)\?\.formation;/.test(corpsEnv)
    && /avisFondsRemisAFaire\(dep, \{ compte: !estEnAttente\(dep\), rejetee: estRejetee\(dep\), formation \}\)/.test(corpsEnv)
    && /envoyerRecuSansQuestion\(/.test(corpsEnv) && /apresEnvoi: \(etat\) => \(\{ \.\.\.etat, depenses: .*marquerFondsRemisAnnonce\(x, today\(\)\)/.test(corpsEnv));
  test("★★ le loyer garde son geste : la case n'est exigée que DU FORMULAIRE (le propriétaire est sur la fiche du local)",
    /const caseExigee = duFormulaire && !sansCaisse && \(!!f\.chantier_id \|\| peutRemettreHorsChantier\(profile\)\);/.test(corpsEnr) && /if \(caseExigee\) \{\s*const refusChoix = critiqueChoixRemis\(f\.remis_a\);/.test(corpsEnr)
    && corpsEnr.indexOf("critiqueChoixRemis") < corpsEnr.indexOf("save("));
  const W = sansComm(lire("src/whatsapp.js"));
  // ⚠ RETOURNÉ le 23/10/2026 : l'écriture est sous `try` (un message parti ne
  // passe jamais pour un échec, ⑦⑧) — toujours DANS le `if (r.auto)`.
  test("★ `apresEnvoi` n'agit que si le message est PARTI (dans le `if (r.auto)` de envoyerRecuSansQuestion)",
    /if \(r\.auto\) \{\s*if \(typeof save === "function"\) \{\s*try \{\s*save\(\(etat\) => \{\s*const suite = typeof apresEnvoi === "function" \? apresEnvoi\(etat\) : etat;/.test(W));
}

titre("77 🧠 L'APPUI LONG SUR UNE BULLE : « 📋 COPIER » ET « 🧠 APPRENDRE CECI À L'IA » (22/10/2026, « b… appui long… copier et apprendre ceci à l'IA apparaît »)");
{
  const IA = await import(pathToFileURL(join(process.cwd(), "src/lib/assistantIA.js")).href);
  const perso = { id: "p1", canal: "whatsapp", wa_tel: "90112233", de_id: "KOSSI", de_nom: "KOSSI", texte: "Pour une maison, nous conseillons un onduleur hybride 48 V." };
  test("★★★ ne s'apprend QUE ce qu'une personne de BMI a écrit : jamais le client, une ligne système, l'assistant, un modèle, des accès, une ligne privée, une bulle sans texte",
    IA.peutApprendreDuMessage(perso) === true && IA.peutApprendreDuMessage({ ...perso, de_id: "telephone-bmi-wa", wa_telephone: true }) === true
    && !IA.peutApprendreDuMessage({ ...perso, wa_entrant: true }) && !IA.peutApprendreDuMessage({ ...perso, wa_systeme: true })
    && !IA.peutApprendreDuMessage({ ...perso, de_id: "assistant-bmi", wa_assistant: { etape: "ia" } }) && !IA.peutApprendreDuMessage({ ...perso, wa_modele: "relance_devis" })
    && !IA.peutApprendreDuMessage({ ...perso, wa_acces: { client_id: "c" } }) && !IA.peutApprendreDuMessage({ ...perso, wa_prive: true }) && !IA.peutApprendreDuMessage({ ...perso, texte: "  " }));
  test("★★ la phrase s'AJOUTE au mémo sur sa ligne, une seule fois (accents, majuscules et ponctuation ignorés pour reconnaître un doublon)",
    IA.memoAvecPhrase("Nous posons du 48 V.", "  Toujours du lithium. ") === "Nous posons du 48 V.\nToujours du lithium." && IA.memoAvecPhrase("", "x") === "x"
    && IA.phraseDejaDansMemo("Nous posons du 48 V.\nToujours du LITHIUM.", "toujours du lithium") === true && IA.phraseDejaDansMemo("Nous posons du 48 V.", "du lithium") === false);
  test("★★ les règles du mémo valent pour la phrase apprise : un prix, une dette, trop long → refusé",
    !!IA.critiqueMemoAssistant(IA.memoAvecPhrase("x", "Le panneau coûte 350 000 F")) && !!IA.critiqueMemoAssistant(IA.memoAvecPhrase("x", "Rappelez-lui sa dette"))
    && !!IA.critiqueMemoAssistant(IA.memoAvecPhrase("x".repeat(1490), "une phrase de plus")));

  // ---- L'écran, dans Chromium : l'appui long joué sur une bulle ----
  const dossier = mkdtempSync(join(tmpdir(), "bmi-apprendre-"));
  const fauxClient = join(dossier, "fauxClient.js");
  writeFileSync(fauxClient, "export const supabase = null; export async function appelAvecJeton() { return { error: 'hors ligne' }; } export async function mediaWaEnLigne() { return { error: 'x' }; }");
  const entree = join(dossier, "entree.jsx");
  writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Whatsapp } from "${process.cwd()}/src/screens/Whatsapp.jsx";
import { DialogHost } from "${process.cwd()}/src/components/ui.jsx";
const qui = location.hash.slice(1) || "principal";
const maintenant = new Date().toISOString();
const users = [{ id: "TIMO", nom: "TIMO", role: "admin", admin_principal: true }, { id: "ADM2", nom: "ADM2", role: "admin" }, { id: "KOSSI", nom: "KOSSI", role: "gerant" }];
const depart = {
  boutiques: [{ id: "b1", nom: "APESSITO", assistant_memo: "Nous posons du 48 V." }, { id: "b2", nom: "DEMAKPOE" }],
  users, produits: [], ventes: [],
  messages: [
    { id: "m-client", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", wa_entrant: true, ts: maintenant, date: maintenant.slice(0, 10), texte: "Quel onduleur pour ma maison ?", lu_par: [] },
    { id: "m-kossi", canal: "whatsapp", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", de_id: "KOSSI", de_nom: "KOSSI", ts: maintenant, date: maintenant.slice(0, 10), texte: "Pour une maison, nous conseillons un onduleur hybride.", lu_par: ["KOSSI"] },
    { id: "waent_90112233", canal: "whatsapp_entete", wa_tel: "90112233", wa_numero: "+22890112233", wa_nom: "ESSO", derniere: maintenant, ts: maintenant },
  ],
};
window.saves = [];
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { const n = typeof next === "function" ? next(db) : next; window.saves.push({ n, journal }); setDb(n); };
  const profile = users.find((u) => u.id === (qui === "gerant" ? "KOSSI" : qui === "autre" ? "ADM2" : "TIMO"));
  return <><Whatsapp db={db} save={save} profile={profile} cleInitiale="90112233" /><DialogHost /></>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
  const bundle = join(dossier, "bundle.js");
  await build({ entryPoints: [entree], bundle: true, format: "iife", platform: "browser", outfile: bundle, jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx" }, logLevel: "silent", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
    plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: fauxClient })); } }] });
  const html = join(dossier, "index.html");
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
  const require = createRequire(import.meta.url);
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
  const propre = (t) => String(t).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
  try {
    const ctx = await nav.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const ouvrir = async (qui) => {
      const page = await ctx.newPage();
      const erreurs = []; page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
      await page.goto(`file://${html}#${qui}`); await attendre(500);
      return { page, erreurs };
    };
    const appuiLong = async (page, id) => {
      const b = await page.$(`[data-bulle-wa="${id}"]`); const r = await b.boundingBox();
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await attendre(700); await page.mouse.up(); await attendre(200);
    };
    const dialogue = async (page) => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
    const boutons = async (page) => page.$$eval("[data-dialogue] button", (bs) => bs.map((b) => b.innerText.trim()));
    const ok = async (page) => { await page.locator("[data-dialogue-boutons] button", { hasText: "OK" }).click(); await attendre(200); };

    const { page, erreurs } = await ouvrir("principal");
    await page.locator('[data-bulle-wa="m-kossi"]').click(); await attendre(150);
    test("★★ un simple clic sur une bulle n'ouvre rien", (await page.$("[data-dialogue]")) === null);
    await appuiLong(page, "m-kossi");
    const b1 = await boutons(page);
    test("★★★ l'administrateur PRINCIPAL, appui long sur le message de KOSSI : « 📋 Copier » ET « 🧠 Apprendre ceci à l'IA »",
      b1.includes("📋 Copier") && b1.includes("🧠 Apprendre ceci à l'IA"), JSON.stringify(b1));
    await page.locator("[data-dialogue] button", { hasText: "Apprendre ceci" }).click(); await attendre(200);
    const valeur = await page.$eval("[data-dialogue] input", (e) => e.value).catch(() => "");
    test("★★ la phrase arrive PRÉ-REMPLIE, à relire et corriger (elle servira à TOUS les clients)",
      valeur === "Pour une maison, nous conseillons un onduleur hybride." && /TOUS les clients/.test(await dialogue(page)), valeur);
    await page.fill("[data-dialogue] input", "Le panneau coûte 350 000 F.");
    await ok(page);
    test("★★★ un prix tapé : refusé, rien n'est appris", /Pas de prix dans le mémo/.test(await dialogue(page)) && (await page.evaluate(() => window.saves.length)) === 0, await dialogue(page));
    await ok(page);
    await appuiLong(page, "m-kossi");
    await page.locator("[data-dialogue] button", { hasText: "Apprendre ceci" }).click(); await attendre(200);
    await page.fill("[data-dialogue] input", "Pour une maison, nous conseillons un onduleur hybride.");
    await ok(page);
    test("★★ la confirmation montre la phrase et dit où la retirer", /Ajouter à « Nos choix BMI »/.test(await dialogue(page)) && /se retire dans ⚙ Paramètres/.test(await dialogue(page)), await dialogue(page));
    await ok(page);
    const ecrit = await page.evaluate(() => { const n = window.saves.at(-1); return n ? { memos: n.n.boutiques.map((b) => b.assistant_memo), journal: n.journal } : null; });
    test("★★★ la phrase s'AJOUTE au mémo existant (sur sa ligne), sur les boutiques, avec une ligne de journal",
      !!ecrit && ecrit.memos.every((x) => x === "Nous posons du 48 V.\nPour une maison, nous conseillons un onduleur hybride.") && /phrase apprise/.test(ecrit.journal), JSON.stringify(ecrit));
    await ok(page);
    await appuiLong(page, "m-kossi");
    await page.locator("[data-dialogue] button", { hasText: "Apprendre ceci" }).click(); await attendre(200);
    await ok(page);
    test("★ la même phrase une seconde fois : « déjà dans Nos choix BMI », rien n'est réécrit", /déjà dans « Nos choix BMI »/.test(await dialogue(page)) && (await page.evaluate(() => window.saves.length)) === 1, await dialogue(page));
    await ok(page);
    await appuiLong(page, "m-client");
    const b2 = await boutons(page);
    test("★★★ sur le message du CLIENT : « 📋 Copier » seulement", b2.includes("📋 Copier") && !b2.some((x) => /Apprendre/.test(x)), JSON.stringify(b2));
    await page.locator("[data-dialogue] button", { hasText: "Copier" }).click(); await attendre(300);
    const copie = await page.evaluate(() => navigator.clipboard.readText()).catch(() => "");
    test("★★ « 📋 Copier » met le texte du message dans le presse-papiers et le dit sous la bulle",
      copie === "Quel onduleur pour ma maison ?" && (await page.$('[data-bulle-wa="m-client"] [data-bulle-copiee]')) !== null, copie);
    test("★ aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
    await page.close();
    for (const qui of ["autre", "gerant"]) {
      const { page: p2 } = await ouvrir(qui);
      await appuiLong(p2, "m-kossi");
      const b3 = await boutons(p2);
      test(`★★★ ${qui === "autre" ? "un AUTRE administrateur" : "le gérant qui a écrit le message"} : « 📋 Copier » seulement — apprendre est au principal`,
        b3.includes("📋 Copier") && !b3.some((x) => /Apprendre/.test(x)), JSON.stringify(b3));
      await p2.close();
    }
  } finally { await nav.close(); rmSync(dossier, { recursive: true, force: true }); }
  const WA = lire("src/screens/Whatsapp.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const corps = WA.slice(WA.indexOf("const apprendreALIA = async"), WA.indexOf("const menuBulle = async"));
  test("★★★ le geste revérifie DANS le geste : le principal (refuserSaufAdminPrincipal), la ligne FRAÎCHE, les règles du mémo — avant d'écrire",
    /if \(refuserSaufAdminPrincipal\(db, profile, "Apprendre une phrase à l'assistant"\)\) return;/.test(corps)
    && corps.indexOf("peutApprendreDuMessage(fraiche)") > -1 && corps.indexOf("critiqueMemoAssistant(nouveau)") > -1 && corps.indexOf("critiqueMemoAssistant(nouveau)") < corps.indexOf("save("));
  test("★ la copie est écrite UNE fois (copierTexte, ui.jsx) : l'écran ne touche pas lui-même au presse-papiers", !/navigator\.clipboard/.test(WA) && /copierTexte\(texte\)/.test(WA));
}

titre("78 ✏️ UN MESSAGE MODIFIÉ SE LIT, ET ⏱ LE REÇU AUTOMATIQUE NE SE TAIT PLUS (23/10/2026, BMID-2026-0070 : « [edit] » dans le fil, aucun reçu parti — « les deux, lance »)");
{
  const sansComm = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const WC = await import("../src/lib/whatsappConversations.js");
  const E78 = await import("../api/whatsapp-entrant.js");
  const avecTexte = E78.lireEntrant({ whatsappInboundMessage: { from: "+22879242507", type: "edit", edit: { message: { type: "text", text: { body: "3 coffrets de 12 modules" } } }, id: "e1" } });
  const sansTexte = E78.lireEntrant({ whatsappInboundMessage: { from: "+22879242507", type: "edit", id: "e2" } });
  test("★★★ le client modifie un message : la ligne dit « ✏️ Le client a modifié son message », avec le NOUVEAU texte quand l'avis le porte — plus jamais « [edit] »",
    avecTexte.texte === "✏️ Le client a modifié son message : « 3 coffrets de 12 modules »" && sansTexte.texte === "✏️ Le client a modifié son message" && !/\[edit\]/.test(avecTexte.texte + sansTexte.texte), JSON.stringify([avecTexte.texte, sansTexte.texte]));
  const echo = WC.lireEchoTelephone({ type: "whatsapp.smb.message.echoes", whatsappMessage: { id: "x9", to: "+22879242507", type: "edit", edit: { text: { body: "Ok, à demain" } } } });
  test("★★ une modification faite depuis le téléphone BMI se dit aussi (« depuis le téléphone BMI »), avec le nouveau texte",
    echo && echo.texte === "✏️ Message modifié depuis le téléphone BMI : « Ok, à demain »", echo && echo.texte);
  test("★★ rien d'autre ne bouge : un texte reste son texte, une légende reste la légende, un type inconnu garde son nom entre crochets",
    E78.lireEntrant({ type: "text", text: { body: "bonjour" } }).texte === "bonjour"
    && E78.lireEntrant({ type: "image", image: { link: "https://x/y.jpg", caption: "mon compteur" } }).texte === "mon compteur"
    && E78.lireEntrant({ type: "location", location: { latitude: 6.1 } }).texte === "[location]");
  const WEsc = sansComm(lire("api/whatsapp-entrant.js")), WCsc = sansComm(lire("src/lib/whatsappConversations.js"));
  test("★ UNE règle pour l'entrée du client et l'écho du téléphone (texteDuMessageWa) : plus aucune recopie du « [${m.type}] »",
    /texteDuMessageWa\(m, media, \{ ecrit \}\)/.test(WEsc) && /texteDuMessageWa\(m, media, \{ ecrit, parBmi: true \}\)/.test(WCsc)
    && (WEsc + WCsc).split("`[${m.type}]`").length === 2);

  // ── ⏱ Le reçu : la VRAIE fonction, le serveur joué
  const dossier78 = mkdtempSync(join(tmpdir(), "bmi-recu-lent-"));
  const faux78 = join(dossier78, "fauxClient.mjs");
  writeFileSync(faux78, `export async function whatsappEnLigne(c) { (globalThis.__appels78 = globalThis.__appels78 || []).push(c.modele); return { id: "Y", wamid: "W" }; }`);
  const sortie78 = join(dossier78, "wa.mjs");
  let W78 = null;
  try {
    await build({ entryPoints: ["src/whatsapp.js"], bundle: true, format: "esm", platform: "node", outfile: sortie78, logLevel: "silent",
      plugins: [{ name: "faux-client", setup(b) { b.onResolve({ filter: /supabaseClient$/ }, () => ({ path: faux78 })); } }] });
    W78 = await import(pathToFileURL(sortie78).href);
  } catch (e) { console.log("   (build de whatsapp.js : " + (e?.message || e) + ")"); }
  const M78 = await import("../src/lib/whatsappModeles.js");
  const envoi78 = M78.envoiRecuVente({ vente: { numero: "BMID-2026-0070", date: "2026-10-23", boutique: "BMI DEMAKPOE", client: "CHEF EZO ENERGY DU TOGO", tel: "+228 79 24 25 07", paiement: "Espèces" }, boutique: { tel: "90000000" }, montant: 231000, fmt: (n) => `${n} F` });
  const jamais = () => new Promise(() => {});
  // Si la limite disparaît, le banc ne reste pas pendu : il écrit ✗ au bout de 3 s.
  const garde78 = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r({ pendu: true }), 3000))]);
  let rLent = {}, phraseLent = "", phraseErreur = "", leve = false, enregistre = 0;
  if (W78) {
    globalThis.__appels78 = [];
    rLent = await garde78(W78.envoyerRecuPdf({ envoi: envoi78, numero: "BMID-2026-0070", fabriquer: jamais, tel: "+228 79 24 25 07", nom: "CHEF EZO", espaceFormation: false, delaiMs: 80 }));
    const appelsPdf = [...globalThis.__appels78];
    test("★★★ un PDF qui ne finit JAMAIS est abandonné au bout du délai (`lent`) : rien n'est envoyé avec lui",
      rLent.auto === false && rLent.lent === true && appelsPdf.length === 0 && W78.DELAI_PDF_RECU_MS === 20000, JSON.stringify(rLent));
    globalThis.__appels78 = [];
    phraseLent = await garde78(W78.envoyerRecuSansQuestion({ envoi: envoi78, tel: "+228 79 24 25 07", nom: "CHEF EZO", espaceFormation: false, save: () => { enregistre++; }, profile: { id: "u1", nom: "ANGELE" }, pdf: { numero: "BMID-2026-0070", fabriquer: jamais, delaiMs: 80 } }));
    phraseLent = typeof phraseLent === "string" ? phraseLent : "(pendu)";
    test("★★★ et le reçu en TEXTE part tout de suite à sa place, la ligne entre dans le fil, la phrase le DIT",
      globalThis.__appels78.join(",") === "recu_vente" && enregistre === 1 && phraseLent.includes(W78.PHRASE_PDF_LENT), `${globalThis.__appels78.join(",")} | ${phraseLent}`);
    try {
      const piege = { modele: "recu_vente" };
      Object.defineProperty(piege, "variables", { get() { throw new Error("panne avant l'envoi"); } });
      globalThis.__appels78 = [];
      phraseErreur = await W78.envoyerRecuSansQuestion({ envoi: piege, tel: "+228 79 24 25 07", nom: "CHEF EZO", espaceFormation: false, save: () => {}, profile: { id: "u1" }, pdf: { numero: "BMID-2026-0070", fabriquer: jamais, delaiMs: 80 } });
    } catch { leve = true; }
    test("★★★ une ERREUR en route ne fait plus taire l'écran : la fonction ne lève plus, elle rend la phrase « n'est pas parti … une erreur est survenue »",
      !leve && /n'est pas parti du numéro BMI : une erreur est survenue/.test(phraseErreur) && globalThis.__appels78.length === 0, phraseErreur);
    // ⚠ Et l'inverse : une écriture qui échoue APRÈS l'envoi ne fait pas dire
    // « n'est pas parti » — le client l'a reçu, le renvoyer ferait un doublon.
    globalThis.__appels78 = [];
    const phraseApres = await W78.envoyerRecuSansQuestion({ envoi: { modele: "recu_vente", variables: ["AUTRE CLIENT", ...envoi78.variables.slice(1)] }, tel: "+228 79 24 25 07", nom: "CHEF EZO", espaceFormation: false, save: () => { throw new Error("panne"); }, profile: { id: "u1" } });
    test("★★★ une écriture qui échoue APRÈS l'envoi : la phrase dit « envoyé », jamais « n'est pas parti » (sinon on le renverrait en double)",
      globalThis.__appels78.join(",") === "recu_vente" && /^📲 Reçu envoyé du numéro BMI/.test(phraseApres), phraseApres);
  }
  rmSync(dossier78, { recursive: true, force: true });
  const V78 = sansComm(lire("src/screens/Ventes.jsx"));
  const corpsAuto = V78.slice(V78.indexOf("const envoyerRecuAutomatique = async"), V78.indexOf("const envoyerRecuLigne = async"));
  test("★★★ 💰 Ventes : le reçu automatique est sous filet — une erreur écrit la phrase sous le titre, un PDF trop lent le dit (envoyé en texte, ou rien)",
    /try \{ r = await envoyerRecuDuNumeroBmi\(vente, apres\); \}/.test(corpsAuto) && /catch \(e\) \{[\s\S]*?setNoteRecuWa\(`Le reçu \$\{vente\.numero\} n'est pas parti du numéro BMI : une erreur est survenue/.test(corpsAuto)
    && /PHRASE_PDF_LENT\b/.test(corpsAuto) && /PHRASE_PDF_LENT_RIEN/.test(corpsAuto) && (V78.match(/pdfLent: !!rp\.lent/g) || []).length === 2);
  test("★★ le bouton WhatsApp de la ligne aussi : une erreur rouvre l'envoi sur l'appareil au lieu de se taire",
    /catch \(e\) \{ console\.error\("\[whatsapp\] reçu de la ligne :", e\); r = \{ auto: false, motif:/.test(V78));
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
