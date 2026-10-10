// ============================================================
// scripts/verifier-ecran-travaux.mjs — L'ÉCRAN 🛠 TRAVAUX À CRÉDIT, MONTÉ
// DANS UN VRAI NAVIGATEUR
//
//   npm run verifier-ecran-travaux
//
// Timo (13/09/2026) : l'onglet Travaux à crédit. On MONTE le vrai écran
// (screens/Travaux.jsx) dans Chromium avec une fiche connue : 2 panneaux du
// stock à 100 000 (coût 70 000), 1 câble HB à 50 000 (payé 30 000),
// prestation 10 %, une dépense rattachée de 8 000. On lit ce que l'écran
// affiche, on change les frais de prestation en montant, on relit.
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
const propre = (t) => String(t).replace(/[\u202f\u00a0]/g, " ").replace(/\s+/g, " ").trim();

const dossier = mkdtempSync(join(tmpdir(), "bmi-travaux-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Travaux } from "${process.cwd()}/src/screens/Travaux.jsx";
import { DialogHost } from "${process.cwd()}/src/components/ui.jsx";
const admin = { id: "adm", nom: "TIMO", role: "admin" };
const depart = {
  boutiques: [{ nom: "LOME", formation: false }],
  users: [{ ...admin, formation: false }],
  produits: [{ id: "p1", nom: "Panneau 400W", boutique: "LOME", initial: 10, prix_vente: 100000, prix_achat: 70000 }, { id: "p2", nom: "Batterie", boutique: "LOME", initial: 3, prix_vente: 200000, prix_achat: 150000 }, { id: "p3", nom: "Convertisseur hybride DEYE 6kW", boutique: "LOME", initial: 1, prix_vente: 390000, prix_achat: 300000 }],
  ventes: [], dettes: [], ajustements: [], messages: [],
  depenses: [{ id: "d1", boutique: "LOME", categorie: "Carburant", description: "moto", montant: 8000, paiement: "Espèces", par: "AMA", chantier_id: "t1", date: "2026-09-13" }],
  clients_installes: [{ id: "t1", travaux: true, statut: "travaux", nom: "MENSAH", prenom: "Paul", tel: "90000000", boutique: "LOME", description: "Câblage", date: "2026-09-13", par: "TIMO",
    articles_travaux: [
      { id: "l1", produit_id: "p1", nom: "Panneau 400W", qte: 2, pu_vente: 100000, pu_achat: 70000, hb: false },
      { id: "l2", produit_id: null, nom: "Câble 6 mm", qte: 1, pu_vente: 50000, pu_achat: 30000, hb: true },
    ], prestation: { mode: "pct", valeur: 10 } }],
};
window.journal = [];
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { window.journal.push(journal); window.dbApres = next; setDb(next); };
  return <><Travaux db={db} save={save} profile={admin} onFacturer={(pre) => { window.preRempli = pre; }} /><DialogHost /></>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage({ viewport: { width: 1100, height: 900 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
await page.goto(`file://${html}`);
await attendre(600);
const texte = async () => propre(await page.innerText("#r"));

console.log("\nL'écran se monte et lit la fiche");
{
  const t = await texte();
  test("★ l'écran se monte sans erreur, la fiche est listée avec ses chiffres : 2 articles, prestation 25 000 F (10 % de 250 000), à facturer 275 000 F", erreurs.length === 0 && /Travaux à crédit — LOME \(1\)/.test(t) && /Paul MENSAH/.test(t) && /2 article\(s\) · prestation 25 000 F · à facturer 275 000 F/.test(t), erreurs.join(" | ") || t.slice(0, 300));
  await page.click("text=▾ Ouvrir");
  await attendre(200);
  const t2 = await texte();
  test("★ ouverte : coût = 2 × 70 000 + 30 000 + 8 000 de dépense rattachée = 178 000 F ; à facturer 275 000 F ; encaissé 0 ; reste dû 275 000 F",
    /Coût \(articles \+ petites dépenses\) 178 000 F/.test(t2) && /À facturer 275 000 F/.test(t2) && /Encaissé 0 F/.test(t2) && /Reste dû 275 000 F/.test(t2), t2.slice(0, 600));
  // RETOURNÉ le 08/10/2026 (Timo : « c'est le prix total qui est en réalité le
  // prix facturé ») : la ligne porte aussi son TOTAL COÛT (qté × prix d'achat).
  // RETOURNÉ le 10/10/2026 (la remise sur un article) : une colonne « Remise »
  // entre le prix unitaire et le coût — « — » sans remise, et son bouton.
  test("★ les deux articles sont listés avec leur nature (stock / HB), prix unitaire facturé, REMISE, coût unitaire, total facturé et TOTAL COÛT ; la dépense rattachée est citée", /Panneau 400W stock 2 100 000 F — ?Remise 70 000 F 200 000 F 140 000 F/.test(t2) && /Câble 6 mm HB 1 50 000 F — ?Remise 30 000 F 50 000 F 30 000 F/.test(t2) && /Carburant — moto · 8 000 F/.test(t2), t2.slice(0, 900));
  const titres = propre(await page.$eval("[data-articles-travaux] thead", (e) => e.innerText)).toLowerCase();
  test("★ les colonnes disent l'UNITÉ ou le TOTAL : « Prix unitaire facturé · Remise · Coût unitaire · Total facturé · Total coût » (plus de « Prix facturé » ni de « Total » seuls ; la Remise RETOURNÉE le 10/10/2026)", /prix unitaire facturé remise coût unitaire total facturé total coût/.test(titres), titres);
  const totaux = await page.$$eval("[data-articles-travaux] tbody tr", (rs) => rs.map((r) => Array.from(r.cells).map((c) => Number(c.innerText.replace(/\D/g, "")))));
  const sommeFact = totaux.reduce((s, c) => s + c[5], 0), sommeCout = totaux.reduce((s, c) => s + c[6], 0);
  test("★ additionner les colonnes redonne les deux chiffres du titre : total facturé 250 000 F, total coût 170 000 F", sommeFact === 250000 && sommeCout === 170000 && /250 000 F facturés, coût 170 000 F/.test(t2), `${sommeFact} / ${sommeCout}`);
  test("★ les frais de prestation se lisent : 25 000 F (10 % de tous les articles)", /Frais de prestation — 25 000 F \(10 % de tous les articles\)/.test(t2));
}

console.log("\nChanger les frais de prestation en montant libre");
{
  await page.click("text=✏️ Fixer les frais de prestation");
  await attendre(150);
  await page.selectOption("select >> nth=-1", "montant");
  const champs = await page.$$("input[type=number]");
  const champ = champs[champs.length - 1];
  await champ.fill("30000");
  await page.click("text=Enregistrer");
  await attendre(250);
  const t3 = await texte();
  const apres = await page.evaluate(() => window.dbApres?.clients_installes?.[0]?.prestation);
  test("★ la fiche enregistre { montant, 30 000 } (save appelé, journal écrit) et l'écran relit : prestation 30 000 F, à facturer 280 000 F",
    apres && apres.mode === "montant" && apres.valeur === 30000 && /Frais de prestation — 30 000 F \(montant fixé\)/.test(t3) && /À facturer 280 000 F/.test(t3), JSON.stringify(apres) + " " + t3.slice(0, 200));
  const j = await page.evaluate(() => window.journal);
  test("le journal dit ce qui a été fait", j.some((x) => /frais de prestation 30 000 F/.test(propre(x))));
}

console.log("\nLe bouton Facturer prépare le panier de 💰 Ventes");
{
  // uConfirm sans fenêtre de dialogue : la confirmation ne peut pas être
  // donnée ici — on vérifie la règle pure côté Node (verifier-cloisonnement)
  // et, ici, que le bouton existe pour un rôle autorisé.
  const t = await texte();
  test("★ « Facturer le client (vers 💰 Ventes) » est proposé à l'admin, avec le total 280 000 F = articles 250 000 F + prestation 30 000 F", /Total à facturer : 280 000 F \(articles 250 000 F \+ prestation 30 000 F\)/.test(t) && /Facturer le client \(vers 💰 Ventes\)/.test(t));
}
console.log("\nChoisir l'article à sortir en tapant son nom (capture Timo, 13/09/2026)");
{
  // Plus de liste déroulante : on tape « deye », seule la proposition qui
  // correspond apparaît (nom en entier, stock et prix dessous) ; un clic la
  // lie ; « Sortir du stock » passe par la confirmation (sans fenêtre ici,
  // uConfirm ne répond pas) — on mesure la liaison, pas la sortie.
  test("★ plus aucune liste déroulante « Article du stock » dans l'écran", !(await page.$("select >> text=— Article du stock —")) && (await page.$$eval("select", (l) => l.filter((x) => /Article du stock/.test(x.textContent)).length)) === 0);
  const champ = await page.$("input[placeholder^='Article du stock']");
  test("★ le champ « Article du stock : tapez son nom… » est là", !!champ);
  await champ.click();
  await champ.type("deye");
  await attendre(200);
  const props = propre(await page.evaluate(() => Array.from(document.querySelectorAll("body > div.fixed button")).map((b) => b.innerText).join(" | ")));
  test("★ « deye » ne propose QUE « Convertisseur hybride DEYE 6kW · 1 en stock · 390 000 F » (ni Panneau, ni Batterie)", /Convertisseur hybride DEYE 6kW 1 en stock · 390 000 F/.test(props) && !/Panneau|Batterie/.test(props), props);
  const tAvant = await texte();
  test("★ tant qu'on n'a pas cliqué, rien n'est lié : « Aucun article du stock ne porte exactement ce nom »", /Aucun article du stock ne porte exactement ce nom/.test(tAvant));
  await page.click("body > div.fixed button >> text=Convertisseur hybride DEYE 6kW");
  await attendre(150);
  const tApres = await texte();
  const saisie = await champ.inputValue();
  test("★ le clic lie l'article : le champ porte le nom exact, la ligne dit « ✓ 1 en stock · 390 000 F l'unité »", saisie === "Convertisseur hybride DEYE 6kW" && /✓ 1 en stock · 390 000 F l'unité/.test(tApres), saisie + " " + tApres.slice(0, 300));
  // Captures Timo (13/09/2026) : « la ligne de quantité s'élargit » en tapant ou
  // en choisissant — la case suivait la hauteur de la ligne d'aide — et « les
  // lignes ne sont pas nommées au-dessus… Article, Quantité. Même chose pour
  // les articles HB ». On MESURE la hauteur de la case quantité, avant et après.
  const hauteurs = await page.evaluate(() => Array.from(document.querySelectorAll("input[type=number]")).map((i) => Math.round(i.getBoundingClientRect().height)));
  const hChamp = Math.round((await champ.boundingBox()).height);
  test("★ la case Quantité garde la hauteur du champ Article une fois l'article choisi (elle ne s'étire plus)", hauteurs.length > 0 && hauteurs.every((h) => Math.abs(h - hChamp) <= 2), `quantités ${hauteurs.join("/")} vs article ${hChamp}`);
  test("★ les colonnes sont nommées : « Article » et « Quantité » au-dessus des cases de sortie, et « Article / Quantité / Prix payé (F) / Prix facturé (F) » pour l'article HB",
    (tApres.match(/\bArticle\b/g) || []).length >= 2 && (tApres.match(/Quantité/g) || []).length >= 2 && /Prix payé \(F\)/.test(tApres) && /Prix facturé \(F\)/.test(tApres), tApres.slice(0, 400));
  await champ.fill("");
  await champ.type("panneau 400w");
  await attendre(150);
  const tExact = await texte();
  test("★ un nom tapé en entier (sans majuscules) lie aussi : « panneau 400w » → ✓ 10 en stock", /✓ 10 en stock · 100 000 F l'unité/.test(tExact), tExact.slice(0, 300));
  await champ.fill("");
  await page.keyboard.press("Escape");
}

console.log("\n🏷 La remise sur un article, jouée à l'écran (10/10/2026, « A a, B a, C a, D a »)");
{
  const dialogue = async () => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
  await page.click("[data-articles-travaux] tbody tr >> nth=0 >> [data-remiser]");
  await attendre(150);
  const q = await dialogue();
  test("★ « Remise » sur la ligne du panneau ouvre la question : la ligne (2 × Panneau 400W, 200 000 F), en F ou en %, la règle des 3 % et l'exclusion de la remise générale",
    /Remise sur 2 × Panneau 400W \(200 000 F\)/.test(q) && /en pourcentage/.test(q) && /3 %, l'administrateur seul/.test(q) && /interdit la remise générale/.test(q), q);
  await page.fill("[data-dialogue] input", "3 %");
  await page.locator("[data-dialogue-boutons] button", { hasText: "OK" }).click();
  await attendre(250);
  const l1 = await page.evaluate(() => window.dbApres?.clients_installes?.[0]?.articles_travaux?.[0]);
  const tR = await texte();
  test("★★ 3 % deviennent 6 000 F sur la fiche ; la ligne s'affiche −6 000 F, total facturé 194 000 F ; le titre dit « 244 000 F facturés (remises : −6 000 F) »",
    l1 && l1.remise === 6000 && /Panneau 400W stock 2 100 000 F −6 000 F ?Modifier 70 000 F 194 000 F 140 000 F/.test(tR) && /244 000 F facturés \(remises : −6 000 F\), coût 170 000 F/.test(tR), JSON.stringify(l1) + " " + tR.slice(tR.indexOf("📦"), tR.indexOf("📦") + 300));
  const j = await page.evaluate(() => window.journal.at(-1));
  test("le journal dit la remise : « remise sur 2 × Panneau 400W : 0 F → 6000 F »", /remise sur 2 × Panneau 400W : 0 F → 6000 F/.test(propre(j)), j);
  await page.click("[data-articles-travaux] tbody tr >> nth=0 >> [data-remiser]");
  await attendre(150);
  await page.fill("[data-dialogue] input", "");
  await page.locator("[data-dialogue-boutons] button", { hasText: "OK" }).click();
  await attendre(250);
  const l1b = await page.evaluate(() => window.dbApres?.clients_installes?.[0]?.articles_travaux?.[0]);
  test("★ « D a » : vide retire la remise — la ligne revient à 200 000 F", l1b && !("remise" in l1b) && /Panneau 400W stock 2 100 000 F — ?Remise 70 000 F 200 000 F/.test(await texte()), JSON.stringify(l1b));
}

console.log("\nSupprimer et composer l'équipe (13/09/2026)");
{
  const t = await texte();
  test("★ l'admin principal voit « 🗑 Supprimer ces travaux » et « 👷 Composer l'équipe » ; l'équipe est « aucune » au départ", /🗑 Supprimer ces travaux/.test(t) && /Composer l'équipe/.test(t) && /Équipe — aucune/.test(t));
}
test("aucune erreur JavaScript", erreurs.length === 0, erreurs.join(" | "));
await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
