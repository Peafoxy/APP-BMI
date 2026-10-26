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
  "export const printApi = { open: (h, t, page) => { globalThis.__etiquette = h; globalThis.__page = page; } };",
  "export const uAlert = () => {};",
  "export const uConfirm = async () => true;",
  "export const uPrompt = async () => null;",
  "export const uChoix = async () => null;",
  // ⚠ Fonctions apparues dans ui.jsx après ce script : le bouchon doit les
  // fournir aussi, sinon la construction échoue au lieu de s'exécuter
  // (même piège que le reste du bouchon — leçon du § 5 de CLAUDE.md).
  "export const demanderMoyenPaiement = async () => null;",
  "export const demanderMois = async () => null;",
  "export const fichierPdfDepuisHtml = async () => null;",
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

// ⚠ Trois longueurs de code : c'est ce qui a revele le defaut. Le dessin
// gardait ses proportions, donc un code long s'ecrasait en hauteur — 6,3 mm
// pour 20 caracteres, sous le seuil de lecture fiable.
// ⚠ Le troisieme code est a la LIMITE exacte (LONGUEUR_MAX_CODE = 15
// caracteres depuis la marge de silence du 26/10/2026) : il doit encore
// se lire, pas juste depasser la limite sans crier.
const CODES = ["12345678", "ARTMG9K2P4X7", "BMICOFFRETIP651"];
// ⚠ Le nom le plus long qu'on ait vu dans le stock, et un pire cas invente :
// c'est LUI qui pousse le code-barres hors de la vignette quand la hauteur
// est juste. On le mesure au lieu de l'esperer.
const NOMS = [
  "COFFRET ETANCHE IP65 12 MODULES",
  "BATTERIE LITHIUM LIFEPO4 25,6V 300AH AVEC BMS INTEGRE ET ECRAN DE CONTROLE BLUETOOTH",
];
const MM = 96 / 25.4;
// Les repères du métier, pour un code-barres lu sans effort.
const BARRE_MINI = 0.25;   // mm — largeur de la barre la plus fine
const HAUTEUR_MINI = 10;   // mm

let ko = 0;
const test = (nom, ok, detail = "") => { console.log(`  ${ok ? "✓" : "✗"} ${nom}${!ok && detail ? `\n     ${detail}` : ""}`); if (!ok) ko++; };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const mesures = [];
let apercu = "";
for (const [i, code] of CODES.entries()) {
  const article = { nom: NOMS[i % NOMS.length], code, prix_vente: 12000, boutique: "BMI APESSITO" };
  if (!M.imprimerEtiquetteProduit(article)) { console.log(`❌ étiquette impossible pour « ${code} »`); process.exit(1); }
  const capture = globalThis.__etiquette || "";
  if (!apercu) apercu = capture;
  const modules = Number(capture.match(/<svg[^>]*width="(\d+)"/)[1]) / 2;
  const f = join("node_modules", ".cache", "mesure-etiquette.html");
  writeFileSync(f, `<!doctype html><meta charset=utf-8><body style="margin:0">${capture}</body>`);
  const page = await nav.newPage({ viewport: { width: 900, height: 400 } });
  await page.goto(pathToFileURL(f).href);
  const d = await page.evaluate((mm) => {
    const et = document.body.firstElementChild.getBoundingClientRect();
    const sv = document.querySelector("svg").getBoundingClientRect();
    const boite = document.body.firstElementChild;
    return { l: et.width / mm, h: et.height / mm, cl: sv.width / mm, ch: sv.height / mm,
             deborde: (boite.scrollHeight - boite.clientHeight) / mm,
             // ⚠ ZONE DE SILENCE (26/10/2026) : la marge blanche entre le bord
             // de l'étiquette et la PREMIÈRE / DERNIÈRE barre. C'est elle qui
             // manquait et qui a fait mal lire un lecteur réel (le début et la
             // fin d'un code scanné étaient faux, le milieu juste).
             margeGauche: (sv.left - et.left) / mm, margeDroite: (et.right - sv.right) / mm };
  }, MM);
  await page.close();
  mesures.push({ code, modules, ...d });
  console.log(`  · « ${code} » (${code.length} car., nom de ${article.nom.length} car.) → étiquette ${d.l.toFixed(1)}×${d.h.toFixed(1)} mm · code-barres ${d.cl.toFixed(1)}×${d.ch.toFixed(1)} mm · barre fine ${(d.cl / modules).toFixed(3)} mm · marge ${d.margeGauche.toFixed(2)}/${d.margeDroite.toFixed(2)} mm`);
}

const proche = (v, cible) => Math.abs(v - cible) < 0.4;
test("★ l'étiquette fait exactement 60 × 30 mm, quel que soit le code",
  mesures.every((m) => proche(m.l, 60) && proche(m.h, 30)));
test("★ la hauteur du code-barres ne dépend PLUS de la longueur du code",
  mesures.every((m) => proche(m.ch, mesures[0].ch)));
test(`la barre la plus fine reste au-dessus de ${BARRE_MINI} mm sur les codes supportés`,
  mesures.every((m) => m.cl / m.modules >= BARRE_MINI));
// ⚠ Au-delà de LONGUEUR_MAX_CODE, l'étiquette de 60 mm ne peut plus porter
// le code proprement. L'application doit le DIRE avant d'imprimer, au lieu de
// laisser dévider un rouleau qu'on découvrira illisible au premier scan.
test(`la limite annoncée est cohérente avec la mesure (${M.LONGUEUR_MAX_CODE} caractères)`,
  M.largeurBarreMm("X".repeat(M.LONGUEUR_MAX_CODE)) >= BARRE_MINI
  && M.largeurBarreMm("X".repeat(M.LONGUEUR_MAX_CODE + 1)) < BARRE_MINI);
test("le calcul de largeur de barre colle à ce qui est réellement imprimé",
  mesures.every((m) => Math.abs(M.largeurBarreMm(m.code) - m.cl / m.modules) < 0.02));
test(`le code-barres reste plus haut que ${HAUTEUR_MINI} mm`, mesures.every((m) => m.ch >= HAUTEUR_MINI));
// ⚠⚠ LA ZONE DE SILENCE (26/10/2026, Timo : « le code barre ne marche pas
// avec le lecteur »). Preuve que le défaut est fermé : une marge blanche
// d'au moins ZONE_SILENCE_MM existe des DEUX côtés du dessin, mesurée dans
// le VRAI navigateur — pas devinée dans le code. Avant ce correctif, la
// marge était quasi nulle (≈ 0,2 mm, le padding de l'étiquette seul) ; le
// lecteur lisait mal le DÉBUT et la FIN du code (preuve de Timo : le milieu
// était juste, les deux bouts faux).
test(`★★ une marge d'au moins ${M.ZONE_SILENCE_MM} mm existe des DEUX côtés du code-barres (zone de silence, sans elle un lecteur mal lit le début et la fin)`,
  mesures.every((m) => m.margeGauche >= M.ZONE_SILENCE_MM - 0.1 && m.margeDroite >= M.ZONE_SILENCE_MM - 0.1),
  JSON.stringify(mesures.map((m) => ({ code: m.code, margeGauche: +m.margeGauche.toFixed(2), margeDroite: +m.margeDroite.toFixed(2) }))));
// ⚠ SUR 30 mm DE HAUT, C'EST LE PIÈGE PRINCIPAL : si le contenu déborde, ce
// n'est pas le nom qui est rogné mais le CODE-BARRES, et l'étiquette devient
// inutilisable sans que personne ne s'en aperçoive avant le scan.
test("★ rien ne déborde de la vignette (sinon c'est le code-barres qui est rogné)",
  mesures.every((m) => m.deborde <= 0.2));
mesures.forEach((m) => { if (m.deborde > 0.2) console.log(`     ↳ « ${m.code} » déborde de ${m.deborde.toFixed(1)} mm`); });
test("le format de page suit l'étiquette (sinon le rouleau sort sur une page A4)",
  globalThis.__page === "size: 60mm 30mm; margin: 0;");
const posB = apercu.indexOf("BMI APESSITO"), posN = apercu.indexOf("COFFRET"), posC = apercu.indexOf("<svg");
test("★ la boutique est en HAUT, le nom de l'article en BAS", posB < posC && posN > posC);

const page = `<!doctype html><meta charset=utf-8><body style="margin:0;padding:16px;background:#e2e8f0;display:flex;flex-direction:column;gap:10px">${apercu}${apercu.replace("BMI APESSITO", "BMI DEMAKPOE")}</body>`;
const f2 = join("node_modules", ".cache", "apercu.html");
writeFileSync(f2, page);
const p2 = await nav.newPage({ viewport: { width: 360, height: 360 } });
await p2.goto(pathToFileURL(f2).href);
await p2.screenshot({ path: "apercu-etiquette.png" });
await nav.close();
console.log(`\n${ko === 0 ? "✅" : "❌"}  Aperçu enregistré dans apercu-etiquette.png\n`);
process.exit(ko === 0 ? 0 : 1);
