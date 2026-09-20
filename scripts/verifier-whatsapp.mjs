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
import { readFileSync } from "node:fs";
import * as M from "../src/lib/whatsappModeles.js";

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
const titre = (t) => console.log(`\n${t}`);
const lire = (f) => readFileSync(f, "utf8");

const fmt = (n) => `${Number(n || 0).toLocaleString("fr-FR")} F`;
const dFR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

// ──────────────────────────────────────────────────────────────
titre("① LES QUATRE MODÈLES, ET L'ORDRE DE LEURS TROUS");
// ⚠ Ces nombres sont ceux des modèles SOUMIS À META le 19/09/2026. Changer
// l'ordre ou le nombre ici sans le changer chez Meta enverrait le montant à
// la place du nom — et Meta ne s'en plaindrait pas.
const ATTENDU = {
  devis_disponible: { categorie: "marketing", n: 3 },
  relance_devis: { categorie: "marketing", n: 4 },
  devis_valide_paiement: { categorie: "utility", n: 4 },
  rappel_echeance: { categorie: "utility", n: 5 },
};
test("les quatre modèles approuvés sont là, et eux seuls", M.NOMS_MODELES.join(",") === Object.keys(ATTENDU).join(","));
for (const [nom, a] of Object.entries(ATTENDU)) {
  test(`★ « ${nom} » : ${a.n} trous, catégorie ${a.categorie}`,
    M.MODELES[nom]?.variables.length === a.n && M.MODELES[nom]?.categorie === a.categorie);
}
test("un devis est du MARKETING (leçon des refus du 19/09)",
  M.MODELES.devis_disponible.categorie === "marketing" && M.MODELES.relance_devis.categorie === "marketing");
test("un contrat signé est de l'UTILITY",
  M.MODELES.devis_valide_paiement.categorie === "utility" && M.MODELES.rappel_echeance.categorie === "utility");
test("★ rappel_echeance n'est PAS en service (une dette n'a pas de date d'échéance)",
  !M.MODELES_EN_SERVICE.includes("rappel_echeance"));
test("les trois autres le sont", ["devis_disponible", "relance_devis", "devis_valide_paiement"].every((n) => M.MODELES_EN_SERVICE.includes(n)));

// ──────────────────────────────────────────────────────────────
titre("② AUCUN SECRET NE VOYAGE DANS UN MODÈLE");
// Meta range tout identifiant de connexion dans sa catégorie
// « authentication » et refuse le modèle. Et un message qui promène un mot
// de passe est une clé qui se promène.
const MOTS_SECRETS = ["motdepasse", "mot_de_passe", "pwd", "identifiant", "mdp"];
const tousLesTrous = Object.values(M.MODELES).flatMap((m) => m.variables).join(" ").toLowerCase();
test("★ aucun trou de modèle ne s'appelle mot de passe ou identifiant",
  !MOTS_SECRETS.some((s) => tousLesTrous.includes(s)));
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
test("un modèle pas encore en service est refusé",
  !!M.critiqueEnvoiAuto({ ...bon, modele: "rappel_echeance", variables: ["a", "b", "c", "d", "e"], espaceFormation: false }));

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
test("★ la clé YCloud n'existe que dans la fonction serveur",
  apiWhatsapp.includes("YCLOUD_API_KEY")
  && !fichiers.some((f) => lire(f).includes("YCLOUD"))
  && !srcWhatsapp.includes("YCLOUD") && !lire("src/lib/whatsappModeles.js").includes("YCLOUD"));
test("★★ elle n'est JAMAIS préfixée VITE_ (Vite l'embarquerait dans le navigateur)",
  !apiWhatsapp.includes("VITE_YCLOUD") && !apiWhatsapp.includes("VITE_WHATSAPP"));
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
test("★★ le serveur rend le code de refus de WhatsApp", /code_whatsapp: code/.test(apiWhatsapp));
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
  && (messagerie.match(/libelleFenetre\(/g) || []).length >= 1);

// ── QUI VOIT QUOI
const conv = (p) => ({ proprietaire_id: p });
test("★★ décision 1 : TOUS LES SALARIÉS voient toutes les conversations — l'administrateur aussi",
  ["admin", "vendeur", "gerant", "magasinier", "technicien_bmi", "resp_commercial", "comptable"]
    .every((role) => C.peutVoirConversation({ id: "x", role }, conv("autre"))));
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
  && C.conversationsWa(msgs, { id: "u1", role: "commercial" }).map((c) => c.cle).sort().join(",") === "90112233,90445566"
  && C.conversationsWa(msgs, { id: "u9", role: "gerant" }).length === 2);
test("★ une conversation est rangée sous le NUMÉRO, pas sous un compte (un prospect n'en a pas)",
  C.cleConversation("+228 90 11 22 33") === "90112233" && C.cleConversation("90112233") === "90112233" && C.cleConversation("") === "");

// ── LE REFUS, REVÉRIFIÉ DANS LE GESTE
const convOuverte = { proprietaire_id: "u1", fil: filDe(1), fenetre: C.fenetre(filDe(1)), tel: "90112233" };
const convFermee = { proprietaire_id: "u1", fil: filDe(30), fenetre: C.fenetre(filDe(30)), tel: "90112233" };
test("★★ une réponse hors fenêtre est REFUSÉE, et le refus DIT pourquoi",
  /plus qu'un modèle approuvé/.test(C.critiqueReponse({ profile: { id: "u1", role: "commercial" }, conv: convFermee, texte: "salut" }))
  && C.critiqueReponse({ profile: { id: "u1", role: "commercial" }, conv: convOuverte, texte: "salut" }) === ""
  && /ne vous appartient pas/.test(C.critiqueReponse({ profile: { id: "u2", role: "commercial" }, conv: convOuverte, texte: "salut" }))
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
test("★★ le propriétaire vient du DEVIS envoyé du numéro BMI — la trace de l'étape 1, pas une invention",
  /envoi_whatsapp\.par_id/.test(entrant) && /proprietaire = \{ id: dernier\.envoi_whatsapp\.par_id/.test(entrant));
test("★ l'arrivée d'un message PRÉVIENT son propriétaire (le save de l'application ne le voit jamais passer)",
  /envoyerAuxPersonnes\(admin, \[\{/.test(entrant) && /ecran: "messages"/.test(entrant));

// ── L'ÉCRAN
test("★★ l'écran passe par LE seul chemin (src/whatsapp.js), jamais par le serveur lui-même",
  /from "\.\.\/whatsapp"/.test(messagerie) && !/supabaseClient/.test(messagerie));
test("★★ RIEN n'est écrit dans la base tant que le message n'est pas PARTI (un fil qui ment est pire qu'un fil vide)",
  /if \(!r\.parti\) \{ uAlert\(r\.motif[\s\S]{0,40}return; \}[\s\S]{0,600}save\(/.test(messagerie));
test("★ répondre ne s'approprie PAS une conversation : seul « 🔁 Confier » change le propriétaire",
  /peutReattribuer\(profile\)/.test(messagerie)
  && /proprietaire_id: u\.id, proprietaire_nom: u\.nom/.test(messagerie)
  && !/proprietaire_id: profile\.id/.test(messagerie));
test("★ la case de saisie se ferme avec la fenêtre, et dit par où relancer",
  /!convWaOuverte\.fenetre\.ouverte \?/.test(messagerie) && /Tous les devis/.test(messagerie));

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
