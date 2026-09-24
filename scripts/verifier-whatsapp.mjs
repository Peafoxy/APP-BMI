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
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import * as M from "../src/lib/whatsappModeles.js";

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
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
  relance_devis: { categorie: "marketing", n: 4 },
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
  // ⚠ LES TROIS DE TIMO (23/09/2026) : le mot de fidélité, MARKETING (il fait
  // de la promotion), en DEUX textes — avec et sans les lignes de l'espace
  // client (décision « 2 ») — un seul trou, le nom ; et le reçu de vente,
  // UTILITY (une transaction), SEPT trous remplis depuis la vente.
  mot_fidelite: { categorie: "marketing", n: 1 },
  mot_fidelite_simple: { categorie: "marketing", n: 1 },
  recu_vente: { categorie: "utility", n: 7 },
};
// ⚠ RETOURNÉ le 23/09/2026 : DIX modèles — les trois de Timo (mot de fidélité
// avec et sans espace, reçu de vente) s'ajoutent aux sept.
test("les dix modèles sont là, et eux seuls", M.NOMS_MODELES.join(",") === Object.keys(ATTENDU).join(","));
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
test("les sept sont en service", M.NOMS_MODELES.every((n) => M.MODELES_EN_SERVICE.includes(n)));

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
const trousHorsEspace = Object.entries(M.MODELES).filter(([n]) => n !== "espace").flatMap(([, m]) => m.variables).join(" ").toLowerCase();
test("★ aucun trou d'un modèle de devis ou de relance ne s'appelle mot de passe ou identifiant",
  !MOTS_SECRETS.some((s) => trousHorsEspace.includes(s)));
test("★ `espace` est le SEUL modèle qui porte un secret, et il ne porte que ça",
  M.MODELES.espace.variables.join(",") === "client,identifiant,mot_de_passe");
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
test("★ tout refus ramène l'ouverture WhatsApp d'aujourd'hui",
  /const repli = async[\s\S]*envoyerWhatsApp\(tel, texteRepli/.test(srcWhatsapp));
test("★ une panne du serveur aussi", /catch[\s\S]*return repli\(/.test(srcWhatsapp));
test("★ une réponse en erreur aussi", /reponse\.error[\s\S]*return repli\(/.test(srcWhatsapp));
test("★ aucune file d'attente (une relance en retard est une faute)",
  !/localStorage/.test(srcWhatsapp) && !/setTimeout/.test(srcWhatsapp));
test("★ les écrans passent TOUJOURS un texte de repli",
  (srcDevis.match(/envoyerModele\(\{/g) || []).length === (srcDevis.match(/texteRepli:/g) || []).length
  && (srcPartages.match(/envoyerModele\(\{/g) || []).length === (srcPartages.match(/texteRepli:/g) || []).length);
test("★ la trace ne s'écrit QUE si le message est vraiment parti du n° BMI",
  /if \(r\.auto\)/.test(srcPartages) && /r\.auto \? traceEnvoi/.test(srcDevis));
test("★ les écrans passent l'espace du DEVIS, jamais celui de la personne",
  /espaceFormation: espaceDuDevis\(db, d, profile\)/.test(srcDevis)
  && /espaceFormation: !!espaceDeLaFiche\(devisMarque\)/.test(srcPartages));

// ──────────────────────────────────────────────────────────────
titre("⑬ UN REPLI MUET RESSEMBLE À UNE PANNE (Timo, 19/09/2026)");
// « Quand je clique sur relancer, ça ouvre le WhatsApp sur l'ordinateur » —
// le repli marchait, mais le motif était CALCULÉ PUIS JETÉ : impossible de
// savoir si c'était voulu ou si quelque chose n'allait pas.
test("★ formation et premier contact sont ATTENDUS : aucune fenêtre",
  M.motifAttendu(M.MOTIF_FORMATION) && M.motifAttendu(M.MOTIF_PREMIER_CONTACT));
test("★ un serveur pas configuré SE DIT", !M.motifAttendu(M.MOTIF_ECHEC[500]));
test("★ une session expirée aussi", !M.motifAttendu(M.MOTIF_ECHEC[401]));
test("★ un refus de WhatsApp aussi (motif rendu tel quel)", !M.motifAttendu("Template not approved"));
test("un motif vide n'est pas « attendu » par défaut", !M.motifAttendu("") && !M.motifAttendu(null));
test("★ le message de repli DIT ce qui s'est passé à la place",
  /WhatsApp s'ouvre avec le texte complet/.test(M.messageRepli("peu importe"))
  && M.messageRepli("PANNE X").includes("PANNE X"));
test("★ les deux écrans montrent le motif, et seulement s'il n'est pas attendu",
  /if \(r\.motif && !motifAttendu\(r\.motif\)\) uAlert\(messageRepli\(r\.motif\)\);/.test(srcDevis)
  && /if \(r\.motif && !motifAttendu\(r\.motif\)\) uAlert\(messageRepli\(r\.motif\)\);/.test(srcPartages));

titre("⑭ L'ÉCRAN NE DÉCRIT JAMAIS AUTRE CHOSE QUE CE QUI VIENT DE SE PASSER");
test("★ parti du numéro BMI → on ne promet pas que WhatsApp s'ouvre",
  !/WhatsApp s'ouvre/.test(M.messageDevisEnvoye("AMA", true)) && /numéro BMI/.test(M.messageDevisEnvoye("AMA", true)));
test("★ envoi à la main → WhatsApp s'ouvre, comme avant",
  /WhatsApp s'ouvre/.test(M.messageDevisEnvoye("AMA", false)));
test("les deux nomment le client", ["AMA"].every((n) => M.messageDevisEnvoye(n, true).includes(n) && M.messageDevisEnvoye(n, false).includes(n)));
test("★ les DEUX endroits qui envoient un devis passent par cette phrase — aucune copie",
  /uAlert\(messageDevisEnvoye\(compte\.nom, envoye\.auto\)\)/.test(srcPartages)
  && /uAlert\(messageDevisEnvoye\(compte\.nom, envoye\.auto\)\)/.test(lire("src/screens/dimensionnement/Brouillons.jsx"))
  && !/WhatsApp s'ouvre avec ses identifiants/.test(srcPartages)
  && !/WhatsApp s'ouvre avec ses identifiants/.test(lire("src/screens/dimensionnement/Brouillons.jsx")));
test("★ l'envoi rend CE QUI S'EST PASSÉ, pas un simple oui", /return \{ ok: true, auto: !!r\.auto \};/.test(srcPartages));

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
test("★ le même message reçu deux fois ne s'écrit qu'une fois (YCloud réessaie)",
  /m\.wa_id === id/.test(entrant) && /deja: true/.test(entrant));
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
  /if \(!r\.parti\) \{ uAlert\(r\.motif[\s\S]{0,40}return; \}[\s\S]{0,600}save\(/.test(ecranWa));
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
  && /setContact\(\{ nom: ouverte\.nom \|\| "", tel: ouverte\.tel \|\| "", sujet: "" \}\); setCleOuverte\(null\);/.test(ecranWa));
test("★ les personnes proposées passent par le filtre d'espace, jamais db.users en entier",
  /utilisateursDeLEspace\(db, profile\)/.test(codeWa) && !/db\.users/.test(codeWa));
test("★ la case de saisie se ferme avec la fenêtre, et dit par où relancer",
  /!ouverte\.fenetre\.ouverte \?/.test(ecranWa) && /Tous les devis/.test(ecranWa));

// ── 🔍 CHERCHER ET ARCHIVER DANS 📲 WHATSAPP (20/09/2026, « lance les 3 »)
const Arch = await import("../src/lib/archivage.js");
const Conv = await import("../src/lib/conversations.js");
test("★★ la recherche passe par LA règle commune et cherche le NOM comme le NUMÉRO",
  /correspond\(`\$\{c\.nom \|\| ""\} \$\{motsDuNumero\(c\.tel\)\.join\(" "\)\}`, recherche\)/.test(ecranWa)
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
test("★ un repli qui n'est pas la règle SE DIT (un repli muet ressemble à une panne)",
  /if \(r\.motif\) uAlert\(/.test(codeDettes));
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
test("★★ les gestes de l'écran posent la fiche : répondre, écrire le premier, confier, rendre à tous, et le rattrapage",
  (codeEcranWa.match(/messagesAvecEntete\(/g) || []).length === 5);
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
  && /peutReattribuer\(profile\) && ouverte\.proprietaire_id && \(/.test(codeEcranWa));
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
  && /critiqueReponse\(\{ profile, conv: ouverte, texte: t, enLigne: navigator\.onLine !== false, espaceFormation: regardeFormation \}\)/.test(codeEcranWa)
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
  test("★ tout autre repli SE DIT, avec ce qui s'est passé à la place",
    /VOTRE numéro/.test(M.messageIdentifiants("gaelle", { auto: false, motif: "Pas de connexion : le message ne peut pas partir du numéro BMI." })));
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
    const lignes = src.match(/if \(r && r\.auto\) save\(\(etat\) => \(\{ \.\.\.etat, messages: messagesAvecLigneAcces\(etat\.messages, \{ profile, client: \w+(, renvoi: true)? \}\) \}\)\);/g) || [];
    test(`★★ ${f} : chaque envoi d'un client écrit la ligne « accès envoyés » dans 📲 WhatsApp, seulement si le message est parti du numéro BMI, sur l'état COURANT (${lignes.length}/${appels.length})`,
      appels.length > 0 && lignes.length === appels.length && /import \{[^}]*messagesAvecLigneAcces[^}]*\} from "\.\.\/whatsapp"/.test(src));
    // LE MUR : l'espace du COMPTE (sa marque), jamais estCompteFormation(db, profile).
    test(`★★ ${f} : chaque envoi passe l'espace du COMPTE CRÉÉ (${appels.length} envoi(s))`,
      appels.length > 0 && appels.every((a) => /espaceFormation: (!!user\.formation|!!c\.formation|espaceCree === true)/.test(a)));
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
  test("★ les huit modèles à ligne : devis, dette, mot de fidélité, reçu de vente — jamais espace ni prise_de_contact",
    M.MODELES_AVEC_LIGNE.slice().sort().join(",") === "devis_disponible,devis_valide_paiement,mot_fidelite,mot_fidelite_simple,rappel_dette,rappel_echeance,recu_vente,relance_devis");

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
    const envois = (src.match(/await envoyerModele\(\{/g) || []).length;
    const lignes = (src.match(/messages: r\.auto \? messagesAvecLigneEnvoi\(etat\.messages, \{ profile, tel: [^}]*modele: envoi\.modele, variables: envoi\.variables, ref: \{ [a-z_]+: [\w.]+ \} \}\) : etat\.messages/g) || []);
    test(`★★ ${f} : chaque envoi par modèle écrit la ligne dans 📲 WhatsApp si le message est parti du numéro BMI, par save((etat) => …) (${lignes.length}/${envois})`,
      envois > 0 && lignes.length === envois && lignes.every((l) => l.includes(ref))
      && new RegExp(`messagesAvecLigneEnvoi \\} from "${chemin.replace(/\./g, "\\.")}"`).test(src)
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
  const vente = { id: "V1", tel: "90112233", client: "ESSO", date: "2026-09-23", boutique: "BMI DEMAKPOE", numero: "DEM-0142", total: 160000, paiement: "Espèces" };
  const e = M.envoiRecuVente({ vente, boutique: { tel: "+228 91 13 05 11" }, fmt, dFR });
  test("★★ les sept trous viennent de la vente : nom, date, boutique, reçu, montant, formule, TÉLÉPHONE DE LA BOUTIQUE",
    e && e.modele === "recu_vente" && e.variables.join("|") === `ESSO|23/09/2026|BMI DEMAKPOE|DEM-0142|${fmt(160000)}|payé en espèces|+228 91 13 05 11`);
  test("★★ une boutique sans téléphone → le numéro BMI principal (Meta refuse un trou vide), jamais un trou vide",
    M.envoiRecuVente({ vente, boutique: {}, fmt, dFR }).variables[6] === M.NUMERO_BMI_PRINCIPAL
    && M.critiqueModele("recu_vente", M.envoiRecuVente({ vente, boutique: {}, fmt, dFR }).variables) === "");
  test("★ « Client non renseigné » ou sans nom → « cher client » ; SANS numéro → null (rien à envoyer, pas une panne)",
    M.envoiRecuVente({ vente: { ...vente, client: "Client non renseigné" }, boutique: {}, fmt, dFR }).variables[0] === "cher client"
    && M.envoiRecuVente({ vente: { ...vente, tel: "" }, boutique: {}, fmt, dFR }) === null);
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
    && /comptesAvecCeNumero\(db, profile, c\.tel\)\.find\(\(u\) => u\.role === "client"\)/.test(corps)
    && /envoiMotFidelite\(\{ nom, avecCompte: !!compte \}\)/.test(corps)
    && /espaceFormation: !!bqRegardee\.formation/.test(corps) && !/estCompteFormation\(db, profile\)/.test(corps)
    && /texteRepli: texteMotFidelite\(\{ nom, avecCompte: !!compte \}\)/.test(corps) && /demanderConfirmation: uConfirm/.test(corps)
    && !/db\.users/.test(corps));
  test("★★ 📋 Clients : la ligne s'écrit sur l'état COURANT, seulement si parti du numéro BMI, et DONNE la conversation (donnerAuSender) ; le repli se dit",
    /if \(!r\.auto\) return;/.test(corps) && /save\(\(etat\) => \(\{\s*\.\.\.etat,\s*messages: messagesAvecLigneEnvoi\(etat\.messages, \{ profile, tel: c\.tel, nom, modele: envoi\.modele, variables: envoi\.variables, donnerAuSender: true \}\)/.test(corps)
    && /if \(r\.motif && !motifAttendu\(r\.motif\)\) uAlert\(messageRepli\(r\.motif\)\)/.test(corps)
    && /<M\.Clients db=\{db\} save=\{save\} profile=\{profile\} \/>/.test(lire("src/App.jsx")));
  // 💰 VENTES : automatique, sans question, sans repli, le mur, la ligne sans propriétaire.
  const ven = sansComm(lire("src/screens/Ventes.jsx"));
  const auto = (ven.match(/const envoyerRecuAutomatique = async \(vente, apres\) => \{[\s\S]*?\n  \};/) || [""])[0];
  test("★★ 💰 Ventes : le reçu part tout seul après l'encaissement (appelé après l'impression du reçu), SANS question, SANS repli (sansRepli), l'espace de la BOUTIQUE qui a vendu",
    auto.length > 0 && /envoyerRecuAutomatique\(vente, next\);/.test(ven)
    && /sansRepli: true/.test(auto) && !/demanderConfirmation/.test(auto) && !/uConfirm/.test(auto) && !/envoyerWhatsApp\(/.test(auto)
    && /espaceFormation: !!bq\.formation/.test(auto) && !/estCompteFormation/.test(auto)
    && /envoiRecuVente\(\{[\s\S]*?vente, boutique: bq,/.test(auto));
  test("★★ 💰 Ventes : à crédit, l'avance et le reste viennent de la DETTE née de la vente ; la ligne s'écrit sur l'état courant, porte la vente et ne donne PAS la conversation",
    /\(apres\.dettes \|\| \[\]\)\.find\(\(d\) => d\.vente_id === vente\.id\)/.test(auto)
    && /save\(\(etat\) => \(\{\s*\.\.\.etat,\s*messages: messagesAvecLigneEnvoi\(etat\.messages, \{ profile, tel: vente\.tel, nom: vente\.client, modele: envoi\.modele, variables: envoi\.variables, ref: \{ vente_id: vente\.id \} \}\)/.test(auto)
    && !/donnerAuSender/.test(auto));
  test("★ 💰 Ventes : ce qui s'est passé se lit sous le titre, discrètement (jamais une fenêtre) ; sans numéro ou en formation, rien",
    /setNoteRecuWa\(""\); return;/.test(auto) && /motifAttendu\(r\.motif\)/.test(auto) && !/uAlert\(/.test(auto)
    && /data-recu-whatsapp/.test(ven));
  test("★ src/whatsapp.js : `sansRepli` n'ouvre jamais WhatsApp, `donnerAuSender` ne donne qu'une conversation LIBRE",
    /parti: sansRepli \? false : await envoyerWhatsApp\(tel, texteRepli, demanderConfirmation\)/.test(srcWhatsapp)
    && /const libre = !entete\.proprietaire_id \|\| entete\.proprietaire_id === profile\?\.id;/.test(srcWhatsapp)
    && /donnerAuSender && libre && profile\?\.id/.test(srcWhatsapp));
  test("★ ⚙ Paramètres : une boutique sans téléphone est signalée (le reçu indiquerait le numéro BMI principal), et l'aide du mot de fidélité dit que 📋 Clients passe par Meta",
    /Sans téléphone : le reçu WhatsApp automatique indiquera le numéro BMI principal/.test(lire("src/screens/Parametres.jsx"))
    && /mot_fidelite_simple/.test(lire("src/screens/Parametres.jsx")));
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
  test("★★ un article cité ne porte QUE nom, catégorie, boutique, prix, disponible (oui/non), tension — JAMAIS une quantité",
    articles.every((a) => Object.keys(a).sort().join(",") === "boutique,categorie,disponible,nom,prix,tension")
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
  test("★★ la règle ne reçoit JAMAIS `db` : des listes déjà filtrées, et son seul import est la règle commune de recherche",
    !/\bdb\b/.test(codeA) && (codeA.match(/^import /mg) || []).length === 1 && /from "\.\/suggestions\.js"/.test(codeA));

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
    && /const chargerArticles = async \(\) => \{\s*if \(articlesCharges\) return articlesCharges;[\s\S]{0,200}from\("produits"\)/.test(corpsR));
  test("★ sa ligne et la demande de devis partent avec `updated_at`, la fiche légère suit SANS propriétaire",
    /insert\(\{ id: ligneR\.id, data: ligneR, updated_at: ligneR\.ts \}\)/.test(corpsR)
    && /from\("prospects"\)\.insert\(\{ id: p\.id, data: p, updated_at: ts \}\)/.test(corpsR)
    && /construireEntete\(\{ cle, tel: String\(from\), nom: client\?\.nom \|\| "", proprietaire_id: "", proprietaire_nom: ""/.test(corpsR));
  test("★ une personne n'est prévenue que si l'assistant s'est tu ou a passé la main",
    /const aPrevenir = !assistant\.repondu \|\| assistant\.conseiller;/.test(entrantA) && /aPrevenir && destinataires\.length/.test(entrantA));
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
    /import \{ estLigneAssistant, NOM_ASSISTANT \} from "\.\.\/lib\/assistantWhatsapp"/.test(ecranA)
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
    /if \(!envoye\) return;[\s\S]{0,700}if \(devisAReprendre\?\.prospect_id\) \{[\s\S]{0,400}prospectAvecDevis\(x, \{ client_user_id: compte\.id, devis_id: devis\.id \}\)/.test(partagesJsx)
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
  test("★★ LA PRÉSENTATION est posée par le serveur, pas confiée à l'IA : un programme, pas une personne ; lu par un service hors du Togo ; « conseiller » pour une personne",
    /un programme, pas une personne/.test(I.PHRASE_PRESENTATION) && I.PHRASE_PRESENTATION.includes(I.MENTION_SERVICE_EXTERIEUR)
    && /hors du Togo/.test(I.MENTION_SERVICE_EXTERIEUR) && /écrivez « conseiller »/.test(I.PHRASE_PRESENTATION)
    && /le serveur ajoute la phrase de présentation/.test(I.CONSIGNE_IA)
    && I.avecPresentation("x", { nouvelle: true }).startsWith(I.PHRASE_PRESENTATION) && I.avecPresentation("x", { nouvelle: false }) === "x"
    && I.conversationNouvelle({ etape: null }) === true && I.conversationNouvelle({ etape: A.ETAPE_MENU }) === false);

  // ── LES OUTILS : trois, et rien d'autre
  test("★★ trois outils exactement — chercher un article, enregistrer une demande de devis, passer la main — chacun avec son schéma",
    I.OUTILS_IA.map((o) => o.name).join(",") === "chercher_article,enregistrer_demande_devis,passer_conseiller"
    && I.OUTILS_IA.every((o) => o.input_schema?.type === "object" && Array.isArray(o.input_schema.required) && o.description.length > 40));
  const cherche = I.executerOutil("chercher_article", { recherche: "panneau 400" }, ctx);
  test("★★ chercher_article passe par LA règle de recherche et rend prix, disponible (oui/non), boutique — JAMAIS une quantité",
    cherche.effets.prix.join() === "85000" && /"disponible":true/.test(cherche.resultat) && /"prix_fcfa":85000/.test(cherche.resultat)
    && !/qte|quantite|stock"/.test(cherche.resultat) && Object.keys(JSON.parse(cherche.resultat)[0]).sort().join(",") === "boutique,categorie,disponible,nom,prix_fcfa,tension");
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
    [I.PHRASE_PRESENTATION, I.REPONSE_SUJET_RESERVE, I.MENTION_SERVICE_EXTERIEUR, A.TEXTE_RELAIS_CONSEILLER, A.texteDemandeEnregistree("X")].every((t) => I.garderReponse(t, {}).ok === true));

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
  test("★★ la règle ne parle JAMAIS au réseau et ne reçoit jamais `db` : aucun fetch, un seul import (lib/assistantWhatsapp.js)",
    !/fetch\(/.test(codeI) && !/\bdb\b/.test(codeI) && (codeI.match(/^import /mg) || []).length === 1 && /from "\.\/assistantWhatsapp\.js"/.test(codeI));

  // ── LE SERVEUR : l'IA d'abord, le menu en repli, et rien d'écrit avant l'envoi
  const corpsR = entrantI.slice(entrantI.indexOf("async function repondreParAssistant"));
  test("★★ le webhook tente l'IA seulement si elle est CHOISIE et CONFIGURÉE, puis retombe sur le menu (`if (!r)`) — la décision de silence est prise UNE fois, avant, par la règle",
    /if \(modeAssistant\(boutiques\) === "ia" && ia\.pret\) \{/.test(corpsR) && /if \(!r\) \{[\s\S]{0,900}r = reponseAssistant\(\{/.test(corpsR)
    && (corpsR.match(/decisionAssistant\(/g) || []).length === 1 && corpsR.indexOf("decisionAssistant(") < corpsR.indexOf("modeAssistant(boutiques)"));
  test("★★ l'IA reçoit la consigne, la mémoire du fil, et exécute les outils par `executerOutil` avec les articles RÉELS chargés à la demande ; sa réponse passe par le juge puis `reponseDepuisIA`",
    /converserAvecIA\(\{\s*consigne: consignePour\(\{ client: clientIA \}\),\s*messages: messagesPourIA\(fil\),\s*appeler: \(corps\) => appelerIA\(corps, ia\),/.test(corpsR)
    && /executerOutil\(nom, entree, \{\s*articles: nom === "chercher_article" \? await chargerArticles\(\) : \[\],/.test(corpsR)
    && /const juge = garderReponse\(conv\.texte, \{ prixConnus: conv\.effets\.prix \}\);\s*r = reponseDepuisIA\(\{ texte: conv\.texte, effets: conv\.effets, juge, nouvelle \}\);/.test(corpsR)
    && /articlesPourAssistant\(\{[\s\S]{0,300}boutiques,/.test(corpsR));
  test("★★ RIEN N'EST ÉCRIT TANT QUE LE MESSAGE N'EST PAS PARTI, IA comprise : un seul envoi YCloud, APRÈS l'IA et le menu, AVANT toute écriture",
    (corpsR.match(/envoyerYCloud\(/g) || []).length === 1
    && corpsR.indexOf("converserAvecIA(") < corpsR.indexOf("envoyerYCloud(") && corpsR.indexOf("reponseAssistant(") < corpsR.indexOf("envoyerYCloud(")
    && corpsR.indexOf("envoyerYCloud(") < corpsR.indexOf('.from("messages").insert(') && corpsR.indexOf("envoyerYCloud(") < corpsR.indexOf('.from("prospects").insert('));
  test("★★ une IA qui trébuche (réseau, refus, réponse jetée) ne laisse jamais le client sans réponse : try/catch, journal, et le menu ; et sur une nouvelle conversation le client est prévenu que le service a lu son message",
    /try \{\s*const conv = await converserAvecIA/.test(corpsR) && /catch \(e\) \{\s*console\.error\("\[whatsapp-entrant\] IA indisponible, le menu reprend/.test(corpsR)
    && /if \(essaiIA\) r = \{ \.\.\.r, texte: avecMention\(r\.texte, \{ nouvelle \}\) \};/.test(corpsR)
    && I.avecMention("x", { nouvelle: true }).includes(I.MENTION_SERVICE_EXTERIEUR) && I.avecMention("x", { nouvelle: false }) === "x");
  test("★ la ligne écrite porte la marque `ia`, la demande de devis part par la même écriture qu'avant, la fiche légère suit sans propriétaire",
    /ligneAssistant\(\{ cle, tel: from, nom: client\?\.nom \|\| "", texte: r\.texte, etape: r\.etape, ts, memoire: r\.memoire \|\| null, ia: !!r\.ia \}\)/.test(corpsR)
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

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
