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
//
// Et le volet « Autre » (capture Timo, 17/10/2026, devis de KLIRA repris) :
// une ligne hors stock reprise, son nom changé, « Valider » répondait
// « Indiquez au moins le nom et le prix de l'article » alors que les deux
// cases étaient remplies. On REJOUE la reprise avec le vrai écran
// (DimensionnementAutre) : changer le nom, Valider, lire la ligne.
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
import { DimensionnementAutre } from "${process.cwd()}/src/screens/dimensionnement/Autre.jsx";
import { DimensionnementGarage } from "${process.cwd()}/src/screens/dimensionnement/Garage.jsx";
import { DialogHost } from "${process.cwd()}/src/components/ui.jsx";
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
function Essai({ profile = admin }) {
  const [db, setDb] = useState(depart);
  const [bq, setBq] = useState("LOME");
  const save = (next) => { setDb(typeof next === "function" ? next(db) : next); };
  return <DimensionnementSolaire db={db} profile={profile} save={save} bq={bq} setBq={setBq} />;
}
createRoot(document.getElementById("r")).render(<Essai />);
// 🔌 Consommation connue (25/10/2026, Timo) : une instance à part, pour ne
// pas se mélanger avec le chemin « mode Libre » joué sur #r.
createRoot(document.getElementById("r5")).render(<Essai />);
// 🔌 F5 — le brouillon est DÉJÀ dans localStorage AVANT que l'écran ne se
// monte (comme après une vraie actualisation de page) : #r6 se monte sur un
// localStorage pré-rempli par le banc, jamais tapé à l'écran. UN AUTRE
// compte (admF5) : localStorage est GLOBAL à la page — avec le même id que
// #r/#r5, le brouillon posé pour #r6 aurait aussi basculé #r et #r5.
const admF5 = { id: "admF5", nom: "TIMO F5", role: "admin" };
createRoot(document.getElementById("r6")).render(<Essai profile={admF5} />);
// Le devis repris de KLIRA : une ligne hors stock (aucun article du stock ne
// porte ce nom), 6 × 850 000 F.
const reprise = { devis: { id: "dv1", besoins: { categorie: "Barrière levante" }, lignes: [
  { categorie: "barriere lévante", article: "PARK-501DFC", qte: 6, pu: 850000, total: 5100000 },
] } };
function EssaiAutre() {
  const [db, setDb] = useState(depart);
  const [bq, setBq] = useState("LOME");
  const save = (next) => { setDb(typeof next === "function" ? next(db) : next); };
  return <><DimensionnementAutre db={db} profile={admin} save={save} bq={bq} setBq={setBq}
    domaine={{ id: "d1", nom: "Barrière levante" }} devisAReprendre={reprise} onDevisRepriseConsomme={() => {}} /><DialogHost /></>;
}
createRoot(document.getElementById("r2")).render(<EssaiAutre />);
// 🔁 Le brouillon de DJEDJE repris par Timo (20/10/2026) : l'écran est DÉJÀ
// monté (il reste en veille), puis un devis arrive, puis un autre. Les
// « autres équipements » doivent suivre chaque reprise.
const avecAutres = (id) => ({ brouillon_id: id, devis: { id, type_devis: "solaire", besoins: { appareils: [{ nom: "Climatiseur", puissance: 1000, heures: 6, qte: 2 }] }, lignes: [
  { categorie: "Autres équipements", article: "LOT DE CABLE", qte: 1, pu: 0, total: 0, hors_boutique: true },
  { categorie: "Autres équipements", article: "SYSTEME DE PROTECTION", qte: 1, pu: 0, total: 0, hors_boutique: true },
] } });
const sansAutres = (id) => ({ brouillon_id: id, devis: { id, type_devis: "solaire", besoins: { appareils: [{ nom: "Télévision", puissance: 100, heures: 5, qte: 1 }] }, lignes: [] } });
function EssaiReprise({ Volet, nom }) {
  const [db, setDb] = useState(depart);
  const [bq, setBq] = useState("LOME");
  const [reprise, setReprise] = useState(null);
  window["reprendre" + nom] = setReprise;
  const save = (next) => { setDb(typeof next === "function" ? next(db) : next); };
  return <Volet db={db} profile={admin} save={save} bq={bq} setBq={setBq} devisAReprendre={reprise} onDevisRepriseConsomme={() => setReprise(null)} />;
}
// 0 climatiseur dans le brouillon de DJEDJE (YOMEDA, 20/10/2026) : repris, il
// montrait 1. Un 0 tapé reste 0 ; une quantité absente vaut 1.
const avecZero = (id) => ({ brouillon_id: id, devis: { id, type_devis: "solaire", besoins: { appareils: [
  { nom: "Climatiseur 1.5 CV", puissance: 1100, heures: 8, qte: 0 },
  { nom: "Congélateur coffre", puissance: 200, heures: 24, qte: 0 },
  { nom: "Télévision", puissance: 100, heures: 5 },
] }, lignes: [] } });
window.avecAutres = avecAutres; window.sansAutres = sansAutres; window.avecZero = avecZero;
createRoot(document.getElementById("r3")).render(<EssaiReprise Volet={DimensionnementSolaire} nom="Solaire" />);
createRoot(document.getElementById("r4")).render(<EssaiReprise Volet={DimensionnementGarage} nom="Garage" />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><div id="r2"></div><div id="r3"></div><div id="r4"></div><div id="r5"></div><div id="r6"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage({ viewport: { width: 1300, height: 1000 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
// 🔌 F5 (26/10/2026, Timo : « le devis je connais la consommation est
// effacé et revient sur détail des appareils ») : on pose le brouillon dans
// localStorage AVANT que la page ne charge — exactement l'état d'un
// navigateur qu'on vient d'actualiser — plutôt que de taper à l'écran.
await page.addInitScript(() => {
  localStorage.setItem("bmi_brouillon_dim_solaire:admF5", JSON.stringify({
    appareils: [{ id: "x", nom: "", puissance: "", heures: "", qte: "1" }],
    autonomie: "1", soleil: 5, tension: "48", typeBatterie: "lifepo4", raccordement: "mono",
    choix: {}, rolesManuels: {}, rolesHB: {}, railsQte: 0, fixationManuelle: {}, supportId: null, autres: [],
    modeConsommation: true, consommationMensuelle: "", puissanceCumulee: "2", heuresUtilisation: "4",
    descriptionAppareils: "LE DEVIS SUR LA BASE D'UNE CONSOMMATION INSTANTANEE DE 2KVA",
  }));
});
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

console.log("\nLe volet Autre : une ligne hors stock d'un devis repris, son nom changé, Valider");
{
  const zone = page.locator("#r2");
  const ligneHS = zone.locator("tbody tr", { has: page.locator('input[placeholder="Nom de l\'article"]') }).first();
  const champNom = ligneHS.locator('input[placeholder="Nom de l\'article"]');
  test("la ligne hors stock reprise montre son nom et son prix", (await champNom.inputValue()) === "PARK-501DFC"
    && (await ligneHS.locator('input[placeholder="Prix (F)"]').inputValue()) === "850000");
  await champNom.fill("MOTEUR PARK-501DFC + 2RC");
  await ligneHS.locator("button:text-is('Valider')").click();
  await attendre(300);
  const alerte = /Indiquez au moins le nom et le prix/.test(await page.locator("body").innerText());
  const texte = propre(await ligneHS.innerText());
  test("★ Valider accepte le nom changé : AUCUNE fenêtre « Indiquez au moins le nom et le prix »", !alerte, texte);
  test("★ la ligne garde son prix (850 000) et sa quantité (6) : sous-total 5 100 000",
    /850 000/.test(texte) && /5 100 000/.test(texte) && (await champNom.inputValue()) === "MOTEUR PARK-501DFC + 2RC", texte);
  if (alerte) { await page.locator("button:text-is('OK')").first().click().catch(() => {}); await attendre(150); }
  // Changer le PRIX seul garde le nom ; Valider sans rien toucher passe aussi.
  await ligneHS.locator('input[placeholder="Prix (F)"]').fill("900000");
  await ligneHS.locator("button:text-is('Valider')").click();
  await attendre(300);
  const alerte2 = /Indiquez au moins le nom et le prix/.test(await page.locator("body").innerText());
  const texte2 = propre(await ligneHS.innerText());
  test("★ changer le prix seul garde le nom ; 6 × 900 000 = 5 400 000", !alerte2 && /5 400 000/.test(texte2) && (await champNom.inputValue()) === "MOTEUR PARK-501DFC + 2RC", texte2);
  test("aucune erreur dans le volet Autre", erreurs.length === 0, erreurs.join(" | "));
}

console.log("\nUn brouillon repris quand l'écran est déjà ouvert : ses « Autres équipements » arrivent (Solaire, Portail)");
for (const nom of ["Solaire", "Garage"]) {
  const zone = page.locator(nom === "Solaire" ? "#r3" : "#r4");
  const valeurs = () => zone.locator("input").evaluateAll((els) => els.map((e) => e.value));
  await page.evaluate((n) => window["reprendre" + n](window.avecAutres("b1")), nom);
  await attendre(400);
  const v1 = await valeurs();
  test(`★ ${nom} : l'écran DÉJÀ ouvert, le brouillon repris montre ses deux « Autres équipements » (LOT DE CABLE, SYSTEME DE PROTECTION)`,
    v1.includes("LOT DE CABLE") && v1.includes("SYSTEME DE PROTECTION"), JSON.stringify(v1.filter(Boolean)));
  await page.evaluate((n) => window["reprendre" + n](window.sansAutres("b2")), nom);
  await attendre(400);
  const v2 = await valeurs();
  test(`★ ${nom} : un AUTRE devis repris ensuite ne garde pas les lignes du précédent`,
    !v2.includes("LOT DE CABLE") && !v2.includes("SYSTEME DE PROTECTION"), JSON.stringify(v2.filter(Boolean)));
}
console.log("\nUn appareil à 0 dans un brouillon repris reste à 0 (le brouillon de DJEDJE)");
{
  const zone = page.locator("#r3");
  await page.evaluate(() => window.reprendreSolaire(window.avecZero("b3")));
  await attendre(400);
  const nombres = await zone.locator("input[type=number]").evaluateAll((els) => els.map((e) => e.value));
  test("★ repris, « Climatiseur 1.5 CV » et « Congélateur coffre » gardent leur quantité 0 (jamais 1)",
    nombres[2] === "0" && nombres[5] === "0", JSON.stringify(nombres.slice(0, 9)));
  test("une quantité ABSENTE vaut toujours 1 (la Télévision)", nombres[8] === "1", JSON.stringify(nombres.slice(0, 9)));
}
test("aucune erreur pendant les reprises", erreurs.length === 0, erreurs.join(" | "));

console.log("\n🔌 Consommation connue (facture CEET) : sans détailler les appareils");
{
  // Timo, 25/10/2026 : « puissance cumulée × nombre d'heures peut élaborer
  // le devis sans facture de la CEET… ou la consommation mensuelle ÷ 30 ».
  const zone = page.locator("#r5");
  const ligneDans = (label) => zone.locator("tbody tr", { has: page.locator(`td:first-child:text-is("${label}")`) }).first();
  const etatDans = async (label) => {
    const l = ligneDans(label);
    return { texte: propre(await l.innerText()), select: await l.locator("select").count() };
  };
  await zone.locator("[data-mode-consommation-connue]").click();
  await attendre(300);
  test("★ le mode activé cache la liste d'appareils et montre le bloc consommation connue",
    (await zone.locator("[data-bloc-consommation-connue]").count()) === 1
    && (await zone.locator('input[placeholder="Ex : tv, frigo, clim…"]').count()) === 0);
  // Puissance cumulée 3 kW, consommation mensuelle 300 kWh → 300*1000/30 = 10 000 Wh/jour.
  await zone.locator("[data-champ-puissance-cumulee]").fill("3");
  await zone.locator("[data-champ-consommation-mensuelle]").fill("300");
  await attendre(300);
  const phrase1 = propre(await zone.locator("[data-phrase-consommation-connue]").innerText());
  test("★ consommation mensuelle (300 kWh) ÷ 30 = 10 000 Wh/jour, dit à l'écran",
    /10000 Wh.*facture.*30/.test(phrase1), phrase1);
  const panMens = await etatDans("Panneaux solaires");
  test("★ les panneaux sont proposés à partir de cette consommation (liste du stock)",
    panMens.select === 1, JSON.stringify(panMens));
  // On vide la consommation mensuelle : le champ heures se débloque, et le
  // Wh/jour se calcule alors par puissance × heures (3 kW × 8 h = 24 000 Wh).
  await zone.locator("[data-champ-consommation-mensuelle]").fill("");
  await zone.locator("[data-champ-heures-utilisation]").fill("8");
  await attendre(300);
  const phrase2 = propre(await zone.locator("[data-phrase-consommation-connue]").innerText());
  test("★ sans facture : puissance cumulée (3 kW) × heures (8 h) = 24 000 Wh/jour",
    /24000 Wh/.test(phrase2), phrase2);
  const panHeures = await etatDans("Panneaux solaires");
  test("★ le besoin a changé (plus de panneaux qu'avec 10 000 Wh/jour) : la liste reste celle du stock",
    panHeures.select === 1 && panHeures.texte !== panMens.texte, JSON.stringify({ panHeures, panMens }));
  // La ligne libre, pour le devis — jamais calculée, juste gardée.
  await zone.locator("textarea").first().fill("2 climatiseurs, un congélateur");
  test("★ la description libre se tape sans erreur, le reste du bloc tient toujours",
    (await zone.locator("textarea").first().inputValue()) === "2 climatiseurs, un congélateur");
  // On revient au mode « Détailler les appareils » : rien n'a été perdu de
  // ce côté, l'ancienne liste réapparaît telle quelle.
  await zone.locator('button:text-is("📋 Détailler les appareils")').click();
  await attendre(300);
  test("★ de retour en mode « appareils », le bloc consommation connue disparaît",
    (await zone.locator("[data-bloc-consommation-connue]").count()) === 0
    && (await zone.locator('input[placeholder="Ex : tv, frigo, clim…"]').count()) === 1);
  test("aucune erreur pendant le mode consommation connue", erreurs.length === 0, erreurs.join(" | "));
}

console.log("\n🔌 F5 : un brouillon « consommation connue » DÉJÀ dans localStorage se retrouve au montage");
{
  const zone = page.locator("#r6");
  test("★★ l'écran se monte DIRECTEMENT sur le mode « consommation connue » (le bouton est actif, pas « Détailler les appareils »)",
    (await zone.locator("[data-bloc-consommation-connue]").count()) === 1
    && (await zone.locator('input[placeholder="Ex : tv, frigo, clim…"]').count()) === 0);
  test("★ la puissance cumulée (2 kW) et les heures (4 h) du brouillon reviennent dans les cases",
    (await zone.locator("[data-champ-puissance-cumulee]").inputValue()) === "2"
    && (await zone.locator("[data-champ-heures-utilisation]").inputValue()) === "4");
  test("★ la description du client revient telle quelle",
    (await zone.locator("textarea").first().inputValue()) === "LE DEVIS SUR LA BASE D'UNE CONSOMMATION INSTANTANEE DE 2KVA");
  test("aucune erreur au montage sur un brouillon de consommation connue", erreurs.length === 0, erreurs.join(" | "));
}

await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.`);
process.exit(ko === 0 ? 0 : 1);
