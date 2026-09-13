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
const admin = { id: "adm", nom: "TIMO", role: "admin" };
const depart = {
  boutiques: [{ nom: "LOME", formation: false }],
  users: [{ ...admin, formation: false }],
  produits: [{ id: "p1", nom: "Panneau 400W", boutique: "LOME", initial: 10, prix_vente: 100000, prix_achat: 70000 }, { id: "p2", nom: "Batterie", boutique: "LOME", initial: 3, prix_vente: 200000, prix_achat: 150000 }],
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
  return <Travaux db={db} save={save} profile={admin} onFacturer={(pre) => { window.preRempli = pre; }} />;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
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
  test("★ les deux articles sont listés avec leur nature (stock / HB), leur prix facturé et leur coût ; la dépense rattachée est citée", /Panneau 400W stock 2 100 000 F 70 000 F 200 000 F/.test(t2) && /Câble 6 mm HB 1 50 000 F 30 000 F 50 000 F/.test(t2) && /Carburant — moto · 8 000 F/.test(t2));
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
