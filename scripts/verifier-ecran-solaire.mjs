// ============================================================
// scripts/verifier-ecran-solaire.mjs — LE VOLET SOLAIRE DU DIMENSIONNEMENT,
// MONTÉ DANS UN VRAI NAVIGATEUR
//
//   npm run verifier-ecran-solaire
//
// Timo (07/10/2026, captures) : après le mode Libre, la ligne Convertisseur
// restait « Convertisseur hybride 48V — 3 kW », sans liste ni prix — puis
// « même chose pour la ligne panneaux ». Le chemin : choisir l'article À LA
// MAIN sur la boutique (ce qui le verrouille), passer en Libre, revenir sur
// la boutique. On le REJOUE avec le vrai écran (DimensionnementSolaire) et on
// lit ce qui s'affiche.
// ============================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const propre = (t) => String(t).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();

const dossier = mkdtempSync(join(tmpdir(), "bmi-solaire-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { DimensionnementSolaire } from "${process.cwd()}/src/screens/dimensionnement/Solaire.jsx";
const admin = { id: "adm", nom: "TIMO", role: "admin" };
const depart = {
  boutiques: [{ nom: "LOME", formation: false, couleur: "#0369a1" }],
  users: [{ ...admin, formation: false }],
  produits: [
    { id: "p1", nom: "Panneau 400W", boutique: "LOME", initial: 50, prix_vente: 60000, prix_achat: 40000 },
    { id: "p2", nom: "Panneau 550W", boutique: "LOME", initial: 50, prix_vente: 80000, prix_achat: 60000 },
    { id: "b1", nom: "Batterie lithium 48V100AH", boutique: "LOME", initial: 10, prix_vente: 500000, prix_achat: 400000, tension: "48" },
    { id: "c1", nom: "Convertisseur hybride 6KW", boutique: "LOME", initial: 5, prix_vente: 400000, prix_achat: 300000, tension: "48" },
    { id: "c2", nom: "Convertisseur hybride 8KW", boutique: "LOME", initial: 5, prix_vente: 550000, prix_achat: 450000, tension: "48" },
  ],
  ventes: [], dettes: [], ajustements: [], messages: [], depenses: [], clients_installes: [],
};
function Essai() {
  const [db, setDb] = useState(depart);
  const [bq, setBq] = useState("LOME");
  const save = (next) => { setDb(typeof next === "function" ? next(db) : next); };
  return <DimensionnementSolaire db={db} profile={admin} save={save} bq={bq} setBq={setBq} />;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage({ viewport: { width: 1300, height: 1000 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
await page.goto(`file://${html}`);
await attendre(600);

// La ligne d'un rôle dans le tableau des équipements.
const ligne = (label) => page.locator("tbody tr", { has: page.locator(`td:first-child:text-is("${label}")`) }).first();
const etat = async (label) => {
  const l = ligne(label);
  return { texte: propre(await l.innerText()), select: await l.locator("select").count() };
};

console.log("\nL'écran se monte, un appareil saisi");
{
  // Le premier appareil : 10 ampoules de 1 000 W, 6 h — de quoi demander
  // plusieurs panneaux et un convertisseur.
  const nombres = page.locator("input[type=number]");
  await page.locator("input").first().fill("Climatiseur");
  await nombres.nth(0).fill("1000");
  await nombres.nth(1).fill("6");
  await nombres.nth(2).fill("3");
  await attendre(400);
  const conv = await etat("Convertisseur");
  const pan = await etat("Panneaux solaires");
  test("★ l'écran se monte sans erreur ; convertisseur et panneaux sont proposés DANS LE STOCK (liste déroulante)", erreurs.length === 0 && conv.select === 1 && pan.select === 1, erreurs.join(" | ") || JSON.stringify({ conv, pan }));
}

console.log("\nLe chemin de Timo : choix à la main, mode Libre, retour sur la boutique");
{
  await ligne("Convertisseur").locator("select").selectOption("c2");
  await ligne("Panneaux solaires").locator("select").selectOption("p1");
  await attendre(250);
  await page.click("button:text-is('Libre')");
  await attendre(400);
  const convLibre = await etat("Convertisseur");
  test("en mode Libre, la ligne Convertisseur est la spécification du mode Libre (sans liste)", convLibre.select === 0 && /Convertisseur hybride 48V/.test(convLibre.texte), JSON.stringify(convLibre));
  await page.click("button:text-is('LOME')");
  await attendre(500);
  const conv = await etat("Convertisseur");
  const pan = await etat("Panneaux solaires");
  test("★ de retour sur la boutique, le Convertisseur reprend SA LISTE du stock — plus de « Convertisseur hybride 48V — … kW » sans prix",
    conv.select === 1 && !/Convertisseur hybride 48V —/.test(conv.texte), JSON.stringify(conv));
  test("★ de retour sur la boutique, les Panneaux reprennent leur liste du stock — plus de « Panneaux solaires — 550 Wc »",
    pan.select === 1 && !/Panneaux solaires — \\d+ Wc/.test(pan.texte), JSON.stringify(pan));
  test("aucune erreur pendant le chemin", erreurs.length === 0, erreurs.join(" | "));
}

await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.`);
process.exit(ko === 0 ? 0 : 1);
