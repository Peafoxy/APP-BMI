// ============================================================
// scripts/verifier-ecran-loyer.mjs — « 💵 PAYER LE LOYER » JOUÉ DANS UN VRAI
// NAVIGATEUR, DU CLIC À LA DÉPENSE ENREGISTRÉE
//
//   npm run verifier-ecran-loyer
//
// Timo (09/10/2026) : « Apparemment le loyer est ornemental… sur la fenêtre
// « Que payez-vous ? », on choisit et rien ne se passe… pas de caisse à
// débiter, pas de validation » → « b ». Le geste ne pré-remplit plus le
// formulaire : il demande le moyen, la caisse qui paie, confirme, et
// enregistre par la dépense ORDINAIRE (validation du DG, limite du tiroir).
// On MONTE le vrai écran (screens/Depenses.jsx) avec la vraie fenêtre de
// questions (DialogHost) et on clique comme Timo.
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

const dossier = mkdtempSync(join(tmpdir(), "bmi-loyer-"));
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { Depenses } from "${process.cwd()}/src/screens/Depenses.jsx";
import { DialogHost } from "${process.cwd()}/src/components/ui.jsx";
const quoi = location.hash.slice(1);
const auj = new Date().toISOString().slice(0, 10);
const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1);
const moisPrecedent = d.toISOString().slice(0, 7);
const gerant = { id: "g1", nom: "AMA", role: "gerant", boutique: "DEMAKPOE", formation: false };
const principal = { id: "adm", nom: "TIMO", role: "admin", admin_principal: true, formation: false };
const vente = (id, bq, montant) => ({ id, boutique: bq, date: auj, heure: "08:00", paiement: "Espèces", par: "AMA", articles: [{ article: "Câble", qte: 1, pu: montant }] });
const depart = {
  boutiques: [
    { nom: "DEMAKPOE", formation: false, loyer: { loue: true, montant: 90000, jour: 5, proprietaire: "KOFFI", dernier_mois_paye: moisPrecedent } },
    { nom: "APESSITO", formation: false },
  ],
  users: [principal, gerant],
  produits: [], ajustements: [], messages: [], dettes: [], clients_installes: [], clotures: [], depenses: [],
  ventes: quoi === "vide" ? [] : [vente("v1", "DEMAKPOE", 200000), vente("v2", "APESSITO", 150000)],
};
window.saves = [];
function Essai() {
  const [db, setDb] = useState(depart);
  const save = (next, journal) => { const n = typeof next === "function" ? next(db) : next; window.saves.push({ n, journal }); setDb(n); };
  return <><Depenses db={db} save={save} profile={gerant} /><DialogHost /></>;
}
createRoot(document.getElementById("r")).render(<Essai />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"' } });
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="r"></div><script src="bundle.js"></script></body></html>`);
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const ouvrir = async (quoi = "") => {
  const page = await nav.newPage({ viewport: { width: 1100, height: 900 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
  await page.goto(`file://${html}#${quoi}`);
  await attendre(500);
  return { page, erreurs };
};
const dialogue = async (page) => propre(await page.$eval("[data-dialogue]", (e) => e.innerText).catch(() => ""));
const choisir = async (page, debut) => { await page.locator("[data-dialogue] button", { hasText: debut }).first().click(); await attendre(150); };
const ok_ = async (page) => { await page.locator("[data-dialogue-boutons] button", { hasText: "OK" }).click(); await attendre(150); };
const saves = (page) => page.evaluate(() => window.saves.length);
const derniere = (page) => page.evaluate(() => window.saves.at(-1)?.n.depenses[0]);

console.log("\n💵 Payer le loyer : du clic à la dépense enregistrée (gérante AMA, DEMAKPOE)");
{
  const { page, erreurs } = await ouvrir();
  await page.click("[data-payer-loyer]");
  await attendre(150);
  test("★ la première question est « Que payez-vous ? »", /Que payez-vous \?/.test(await dialogue(page)), await dialogue(page));
  await choisir(page, "Le mois le plus ancien");
  test("★★ le geste CONTINUE : la question suivante est le moyen de paiement du loyer (90 000 F)", /Moyen de paiement du loyer \(90 000 F\)/.test(await dialogue(page)), await dialogue(page));
  await choisir(page, "Espèces");
  const pa = await dialogue(page);
  test("★★ puis « Payé avec » : les caisses de l'espace, celle de DEMAKPOE en premier, l'avance et l'argent du DG", /Payé avec/.test(pa) && pa.indexOf("La caisse de DEMAKPOE") > -1 && pa.indexOf("La caisse de DEMAKPOE") < pa.indexOf("La caisse de APESSITO") && /avance personnelle/.test(pa) && /remis par le DG/.test(pa), pa);
  await choisir(page, "La caisse de DEMAKPOE");
  const conf = await dialogue(page);
  test("★★ la confirmation de la dépense ORDINAIRE : montant, catégorie, caisse, et l'annonce de la validation du DG", /Confirmer la dépense de 90 000 F en Loyer, payée avec : la caisse de DEMAKPOE/.test(conf) && /validation du DG/.test(conf), conf);
  test("★ rien n'est écrit avant d'avoir confirmé", (await saves(page)) === 0);
  await ok_(page);
  const dep = await derniere(page);
  test("★★ la dépense est ENREGISTRÉE : Loyer, 90 000 F, espèces, caisse de DEMAKPOE, le mois et le local du loyer",
    dep && dep.categorie === "Loyer" && dep.montant === 90000 && dep.paiement === "Espèces" && dep.boutique === "DEMAKPOE" && /Loyer de/.test(dep.description) && typeof dep.loyer_mois === "string" && dep.loyer_boutique === "DEMAKPOE", JSON.stringify(dep));
  test("★★ elle ATTEND la validation du DG (90 000 F ≥ 5 000 F, saisie par une gérante)", dep?.validation?.statut === "attente", JSON.stringify(dep?.validation));
  test("★ la gérante est prévenue : en attente de validation par le DG", /en attente de validation par le DG/.test(await dialogue(page)), await dialogue(page));
  await ok_(page);
  const t = propre(await page.innerText("#r"));
  test("★ le cadre du loyer lit la dépense : « en attente de la validation du DG » ; le formulaire « Nouvelle dépense » n'a pas été ouvert", /en attente de la validation du DG/.test(t) && (await page.$("[data-categorie-depense]")) === null, t.slice(0, 500));
  test("★ aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));
  await page.close();
}

console.log("\nLa caisse d'une AUTRE boutique paie : c'est le loyer de DEMAKPOE, rangé sur APESSITO");
{
  const { page } = await ouvrir();
  await page.click("[data-payer-loyer]"); await attendre(150);
  await choisir(page, "Le mois le plus ancien");
  await choisir(page, "Espèces");
  await choisir(page, "La caisse de APESSITO");
  test("★ la confirmation dit que la dépense sera enregistrée sur APESSITO", /enregistrée sur APESSITO/.test(await dialogue(page)), await dialogue(page));
  await ok_(page);
  const dep = await derniere(page);
  test("★★ boutique = APESSITO (sa caisse a payé), loyer_boutique = DEMAKPOE (le LOCAL)", dep?.boutique === "APESSITO" && dep?.loyer_boutique === "DEMAKPOE", JSON.stringify(dep));
  await page.close();
}

console.log("\nAnnuler à « Payé avec » : rien n'est écrit");
{
  const { page } = await ouvrir();
  await page.click("[data-payer-loyer]"); await attendre(150);
  await choisir(page, "Le mois le plus ancien");
  await choisir(page, "Espèces");
  await page.locator("[data-dialogue-boutons] button", { hasText: "Annuler" }).click(); await attendre(150);
  test("★ annulé : aucune dépense, plus aucune fenêtre", (await saves(page)) === 0 && (await page.$("[data-dialogue]")) === null);
  await page.close();
}

console.log("\nUn tiroir vide : la limite du tiroir REFUSE, comme pour toute dépense");
{
  const { page } = await ouvrir("vide");
  await page.click("[data-payer-loyer]"); await attendre(150);
  await choisir(page, "Le mois le plus ancien");
  await choisir(page, "Espèces");
  await choisir(page, "La caisse de DEMAKPOE");
  const refus = await dialogue(page);
  test("★★ refus du tiroir (aucune recette), rien n'est écrit", /Attendez une recette/.test(refus) && (await saves(page)) === 0, refus);
  await page.close();
}

await nav.close();
rmSync(dossier, { recursive: true, force: true });
console.log(ko === 0 ? `\n✅  ${ok} vérification(s) passée(s), 0 en échec.` : `\n❌  ${ko} en échec sur ${ok + ko}.`);
process.exit(ko === 0 ? 0 : 1);
