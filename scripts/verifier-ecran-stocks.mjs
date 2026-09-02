// ============================================================
// scripts/verifier-ecran-stocks.mjs — L'ÉCRAN STOCKS SE REND-IL VRAIMENT ?
//
//   node scripts/verifier-ecran-stocks.mjs
//
// ⚠ POURQUOI CE CONTRÔLE EXISTE
//
// verifier-ecran.cjs ouvre l'application dans un vrai navigateur, mais il
// s'arrête à l'ÉCRAN DE CONNEXION : il faudrait un compte et une base pour
// aller plus loin. Tous les écrans de travail échappaient donc à toute
// vérification d'exécution — la compilation ne voit pas une variable
// utilisée avant d'exister, ni un crochet React posé au mauvais endroit.
//
// Ce script rend l'écran Stocks HORS navigateur, sur une base fabriquée,
// et vérifie que les repères de boutique demandés par Timo sont bien là :
// le titre et le bouton doivent NOMMER la boutique, sans quoi on retombe
// dans l'erreur du stock saisi dans le mauvais magasin.
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// ⚠ Node 22 expose `navigator` en lecture seule : on ne l'écrase pas, on le
// redéfinit — sinon le script s'arrête avant d'avoir rien vérifié.
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
globalThis.localStorage = dom.window.localStorage;

const sortie = join("node_modules", ".cache", `bmi-stocks-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
await build({
  entryPoints: ["src/screens/Stocks.jsx"], bundle: true, format: "esm", platform: "node",
  outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" },
  // ⚠ Les écrans n'importent pas React eux-mêmes (Vite s'en charge) : sans
  // « jsx: automatic », le rendu échoue sur « React is not defined ».
  jsx: "automatic",
  external: ["react", "react-dom", "react-dom/*", "react/jsx-runtime"],
});
const { Stocks } = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

const React = (await import("react")).default;
const { renderToString } = await import("react-dom/server");

const db = {
  boutiques: [
    { id: "b1", nom: "BMI APESSITO", couleur: "#0284c7" },
    { id: "b2", nom: "BMI DEMAKPOE", couleur: "#16a34a" },
    { id: "b3", nom: "ECOLE", couleur: "#a855f7", formation: true },
  ],
  users: [{ id: "u1", nom: "TIMO", role: "admin", admin_principal: true }],
  produits: [
    { id: "p1", boutique: "BMI DEMAKPOE", nom: "COFFRET ETANCHE IP65", categorie: "Coffrets",
      fournisseur: "SOLARIS", seuil: 2, prix_achat: 8000, prix_vente: 12000, initial: 5, entrees: 0 },
    { id: "p2", boutique: "BMI APESSITO", nom: "BATTERIE GEL 12V200AH", categorie: "Batteries",
      seuil: 1, prix_achat: 90000, prix_vente: 140000, initial: 3, entrees: 0 },
  ],
  ventes: [], ajustements: [], depenses: [], dettes: [], commandes: [], proformas: [],
  clients_installes: [], fournisseurs: [], audits: [], messages: [], demandes_ravitaillement: [],
};
const profile = { id: "u1", nom: "TIMO", role: "admin" };

let ok = 0, ko = 0;
const test = (nom, condition) => {
  if (condition) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}`); }
};

let html = "";
try {
  html = renderToString(React.createElement(Stocks, { db, save: () => {}, profile }));
} catch (e) {
  console.log(`\n❌  L'ÉCRAN STOCKS PLANTE AU RENDU : ${String(e.message).split("\n")[0]}\n`);
  process.exit(1);
}

test("l'écran se rend sans erreur", html.length > 500);
// Les repères posés après l'erreur du stock saisi dans la mauvaise boutique.
test("le titre du formulaire NOMME la boutique", html.includes("Nouvel article dans"));
test("le bouton d'ajout NOMME la boutique", html.includes("Ajouter à") && html.includes("BMI APESSITO"));
test("l'importation rapide est là", html.includes("Importation rapide"));
test("le bouton de correction d'un article est là", html.includes("Corriger"));
// ⚠ L'admin PRINCIPAL voit volontairement les deux espaces (dérogation
// « tous ») : c'est un compte de FORMATION qui prouve le cloisonnement.
// C'est ici que l'écran, et non plus seulement les calculs, est mis à
// l'épreuve — la capture de Timo montrait justement une boutique de
// formation citée à un compte réel.
db.users.push({ id: "u2", nom: "STAGIAIRE", role: "vendeur", formation: true });
let htmlF = "";
try {
  htmlF = renderToString(React.createElement(Stocks, {
    db, save: () => {}, profile: { id: "u2", nom: "STAGIAIRE", role: "vendeur" },
  }));
} catch (e) {
  console.log(`  ✗ l'écran plante pour un compte de formation : ${String(e.message).split("\n")[0]}`);
}
test("un compte de FORMATION ne voit que sa boutique d'entraînement",
  htmlF.includes("ECOLE") && !htmlF.includes("BMI APESSITO") && !htmlF.includes("BMI DEMAKPOE"));
test("…et aucun article réel ne lui est proposé",
  !htmlF.includes("BATTERIE GEL 12V200AH") && !htmlF.includes("COFFRET ETANCHE IP65"));
// L'article d'une AUTRE boutique n'est jamais listé dans le stock affiché.
test("le stock affiché ne montre que les articles de la boutique en cours",
  html.includes("BATTERIE GEL 12V200AH") && !html.includes("COFFRET ETANCHE IP65"));

// ⚠ RELEVÉ PAR TIMO (02/09/2026) : présélectionner puis modifier doit
// AJOUTER — la correction n'existe que par le bouton ✏️ Corriger de la
// fiche. L'ancienne version ouvrait la correction quand l'article existait
// déjà dans la boutique en cours : il s'en servait comme MODÈLE et
// l'enregistrement corrigeait la fiche d'origine à son insu. Le vrai
// danger — la fiche en double qui coupe le stock en deux — est refusé au
// moment d'Ajouter, avec explication.
const src = readFileSync("src/screens/Stocks.jsx", "utf8");
test("★ cliquer une présélection remplit TOUJOURS le formulaire d'ajout (jamais la correction)",
  /const choisirSuggestion = \(a\) => reprendreArticle\(a\);/.test(src)
  && !/choisirSuggestion = \(a\) =>.*corriger/.test(src));
test("★ « Ajouter » refuse un doublon (même nom, même boutique) en expliquant",
  /if \(dejaDansCetteBoutique\)/.test(src) && src.includes("existe déjà dans"));
test("une ligne prévient AVANT le clic, sans fenêtre qui bloque",
  src.includes("Existe déjà dans {bq}"));

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
