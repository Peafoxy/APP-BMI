// ============================================================
// scripts/apercu-etiquette.mjs — À QUOI RESSEMBLE VRAIMENT L'ÉTIQUETTE ?
//
//   node scripts/apercu-etiquette.mjs
//
// Fabrique l'étiquette avec le VRAI code de l'application, l'ouvre dans un
// navigateur et en enregistre une image. Décrire une mise en page ne prouve
// rien : il faut la regarder.
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

const sortie = join("node_modules", ".cache", `bmi-etiquette-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
// ⚠ « printApi » est posé par un composant React au moment où l'application
// s'affiche (voir components/ui.jsx). Hors navigateur il vaut null, et rien
// ne s'imprimerait. On remplace donc ce seul module par un bouchon qui
// capture le HTML au lieu d'ouvrir une fenêtre — le reste du code
// d'impression, lui, est bien le vrai.
const bouchonUI = join("node_modules", ".cache", `bmi-ui-bouchon-${process.pid}.js`);
// Le bouchon doit fournir TOUT ce que les modules bundlés attendent de ui.jsx
// (calculs.js y prend aussi ses boîtes de dialogue), sinon la construction
// échoue au lieu de s'exécuter.
writeFileSync(bouchonUI, [
  "export const printApi = { open: (h) => { globalThis.__etiquette = h; } };",
  "export const uAlert = () => {};",
  "export const uConfirm = async () => true;",
  "export const uPrompt = async () => null;",
  "export const uChoix = async () => null;",
  "",
].join("\n"));
await build({
  entryPoints: ["src/lib/impression.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  external: ["react", "react-dom", "react-dom/*", "react/jsx-runtime", "jspdf", "jspdf-autotable"],
  plugins: [{
    name: "bouchon-ui",
    setup(b) {
      b.onResolve({ filter: /components\/ui$/ }, () => ({ path: join(process.cwd(), bouchonUI) }));
    },
  }],
});
const M = await import(pathToFileURL(sortie).href);
unlinkSync(sortie); unlinkSync(bouchonUI);

const article = {
  nom: "COFFRET ETANCHE IP65 12 MODULES", code: "BMI0000123456",
  prix_vente: 12000, boutique: "BMI APESSITO",
};
if (!M.imprimerEtiquetteProduit(article)) { console.log("❌ l'étiquette n'a pas pu être générée"); process.exit(1); }
const capture = globalThis.__etiquette || "";

let ko = 0;
const test = (nom, ok) => { console.log(`  ${ok ? "✓" : "✗"} ${nom}`); if (!ok) ko++; };
const posBoutique = capture.indexOf(article.boutique);
const posNom = capture.indexOf(article.nom);
const posCode = capture.indexOf("<svg");
test("le nom de la boutique est présent", posBoutique > -1);
test("★ la boutique est AU-DESSUS du code-barres", posBoutique < posCode);
test("★ le nom de l'article est EN BAS, sous le code-barres", posNom > posCode);
test("le code en clair et le prix sont là", capture.includes(article.code) && capture.includes("12"));

const page = `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#e2e8f0;display:flex;gap:16px">${capture}${capture.replace(article.boutique, "BMI DEMAKPOE")}</body>`;
const fichier = join("node_modules", ".cache", "apercu-etiquette.html");
writeFileSync(fichier, page);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await nav.newPage({ viewport: { width: 620, height: 320 } });
await p.goto(pathToFileURL(fichier).href);
await p.screenshot({ path: "apercu-etiquette.png" });
await nav.close();
console.log(`\n${ko === 0 ? "✅" : "❌"}  Aperçu enregistré dans apercu-etiquette.png\n`);
process.exit(ko === 0 ? 0 : 1);
