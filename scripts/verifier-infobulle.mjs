// ============================================================
// scripts/verifier-infobulle.mjs — LA DESCRIPTION D'UN BOUTON, DANS SA FENÊTRE
//
//   npm run verifier-infobulle
//
// Timo (21/10/2026, capture de 💰 Ventes) : « la description sur ce bouton est
// en une seule ligne et ce n'est pas bien esthétiquement… ramener ça en
// fenêtre avec fond qui a la couleur du bouton, avec la description en
// plusieurs lignes… une seule règle pour tous les écrans » → « a, lance ».
//
// Une couleur, un passage à la ligne, une place à l'écran ne se lisent pas
// dans le code : on MONTE le vrai hôte (components/ui.jsx) avec le CSS
// construit dans Chromium, on passe la souris, et on MESURE. Un TÉMOIN (les
// mêmes boutons sans l'hôte) prouve à chaque passage que, sans la règle, il
// n'y a que le `title` gris de Windows.
// ============================================================
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const lire = (f) => readFileSync(f, "utf8");
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// ─────────────────────────── 1. LES RÈGLES PURES
console.log("▸ Les règles pures (lib/infobulle.js)");
const dossier = mkdtempSync(join(tmpdir(), "bmi-infobulle-"));
const regles = join(dossier, "regles.mjs");
await build({ entryPoints: [join(process.cwd(), "src/lib/infobulle.js")], bundle: true, format: "esm", outfile: regles, logLevel: "silent" });
const R = await import(regles);
const F = { width: 1000, height: 700 };
let p = R.placerInfobulle({ left: 480, width: 40, top: 300, bottom: 340 }, { width: 200, height: 50 }, F);
test("centrée sous le bouton, à 6 px", p.left === 400 && p.top === 346 && !p.dessus, JSON.stringify(p));
p = R.placerInfobulle({ left: 970, width: 30, top: 300, bottom: 330 }, { width: 200, height: 50 }, F);
test("au bord droit : jamais hors de l'écran (8 px du bord)", p.left === 792, JSON.stringify(p));
p = R.placerInfobulle({ left: 0, width: 30, top: 300, bottom: 330 }, { width: 200, height: 50 }, F);
test("au bord gauche : 8 px du bord", p.left === 8, JSON.stringify(p));
p = R.placerInfobulle({ left: 480, width: 40, top: 660, bottom: 690 }, { width: 200, height: 50 }, F);
test("en bas de l'écran : au-dessus du bouton", p.dessus && p.top === 604, JSON.stringify(p));
p = R.placerInfobulle({ left: 480, width: 40, top: 10, bottom: 690 }, { width: 200, height: 50 }, F);
test("ni place dessus ni dessous : reste dans l'écran", !p.dessus && p.top === 642, JSON.stringify(p));
test("bouton rouge (texte rouge sur blanc) : la couleur du texte", JSON.stringify(R.couleurDeReference([185, 28, 28, 1], [255, 255, 255, 1])) === "[185,28,28]");
test("bouton plein (texte blanc sur bleu) : la couleur du fond", JSON.stringify(R.couleurDeReference([255, 255, 255, 1], [3, 105, 161, 1])) === "[3,105,161]");
test("fond transparent et texte clair : l'ardoise", JSON.stringify(R.couleurDeReference([255, 255, 255, 1], [0, 0, 0, 0])) === "[51,65,85]");
const s = R.styleInfobulle([185, 28, 28]);
test("« a » : contour et texte de la couleur, fond pâle", s.borderColor === "rgb(185, 28, 28)" && s.color === "rgb(185, 28, 28)" && s.backgroundColor === "rgb(247, 228, 228)", JSON.stringify(s));
const ambre = R.styleInfobulle([245, 158, 11]);
test("une couleur claire (ambre) : texte foncé, lisible", ambre.color !== "rgb(245, 158, 11)" && ambre.borderColor === "rgb(245, 158, 11)", JSON.stringify(ambre));

// ─────────────────────────── 2. MESURÉ DANS CHROMIUM
console.log("▸ Mesuré dans Chromium, avec le CSS construit");
const LONG = "Échanger un article contre un autre : le client rapporte un article et en prend un autre ; s'il est plus cher il paie la différence, sinon BMI la rend.";
const entree = join(dossier, "entree.jsx");
writeFileSync(entree, `
import React from "react";
import { createRoot } from "react-dom/client";
import { InfobulleHost, BoutonRond } from "${process.cwd()}/src/components/ui.jsx";
const LONG = ${JSON.stringify(LONG)};
function Page({ hote }) {
  return <div style={{ padding: 40, height: 2000 }}>
    {hote && <InfobulleHost />}
    <div style={{ display: "flex", gap: 12 }}>
      <BoutonRond id="rouge" icone="🗑" titre={LONG} teinte="rouge" />
      <BoutonRond id="vert" icone="✓" titre="Valider" teinte="vert" />
      <BoutonRond id="bleu" icone="🖨" titre="Imprimer le reçu" teinte="bleu" />
      <button id="plein" className="px-3 py-1 rounded bg-sky-700 text-white" title="Encaisser la vente">Encaisser</button>
      <button id="sans">Sans description</button>
      <button id="eteint" disabled className="px-3 py-1 rounded border" title="Bouton éteint">Éteint</button>
      <span id="texte" title="Un texte, pas un bouton">survol</span>
      <table><tbody><tr id="ligne" title="Cliquer pour voir tous les articles"><td id="cellule" title="Cellule"><BoutonRond id="dansLigne" icone="📋" titre="Devis : reprendre cette vente dans un devis d'installation" teinte="violet" /></td></tr></tbody></table>
    </div>
    <button id="droite" style={{ position: "fixed", right: 0, top: 100 }} title={LONG}>D</button>
    <button id="bas" style={{ position: "fixed", left: 300, bottom: 0 }} title={LONG}>B</button>
  </div>;
}
const hote = new URLSearchParams(location.search).get("q") !== "temoin";
createRoot(document.getElementById("r")).render(<Page hote={hote} />);
`);
const sortie = join(dossier, "bundle.js");
await build({ entryPoints: [entree], bundle: true, format: "iife", outfile: sortie, logLevel: "silent", loader: { ".js": "jsx", ".jsx": "jsx" }, jsx: "automatic", nodePaths: [join(process.cwd(), "node_modules")], define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" } });
const cssConstruit = (() => { try { return readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0]; } catch { return null; } })();
if (!cssConstruit) { console.log("✗ dist/assets/*.css introuvable : lancez d'abord npm run build"); process.exit(1); }
const html = join(dossier, "index.html");
writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${join(process.cwd(), "dist/assets", cssConstruit)}"></head><body style="margin:0"><div id="r"></div><script src="bundle.js"></script></body></html>`);

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await nav.newPage({ viewport: { width: 900, height: 600 } });
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
const bulle = () => page.$eval("[data-infobulle]", (e) => {
  const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
  return { texte: e.textContent, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height,
    fond: cs.backgroundColor, bord: cs.borderTopColor, couleur: cs.color, lignes: Math.round((r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)) / parseFloat(cs.lineHeight)), place: e.dataset.infobulle, visible: cs.visibility };
}).catch(() => null);
const survoler = async (sel) => { await page.mouse.move(2, 590); await attendre(60); await page.hover(sel); await attendre(500); };
const rect = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
const titre = (sel) => page.$eval(sel, (e) => e.getAttribute("title"));
// Tailwind v4 donne des couleurs en oklch : on les ramène en rgb par une toile,
// comme l'hôte le fait, pour comparer ce qui est comparable.
const couleurDe = (sel, prop) => page.$eval(sel, (e, p) => {
  const c = document.createElement("canvas"); c.width = c.height = 1; const x = c.getContext("2d");
  x.fillStyle = getComputedStyle(e)[p]; x.fillRect(0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data;
  return `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
}, prop);
const rgbOk = (txt) => /^rgb\(/.test(txt || "");

await page.goto(`file://${html}`);
await attendre(300);

await survoler("#rouge");
let b = await bulle();
test("survol d'un bouton qui a une description : la fenêtre s'ouvre", !!b && b.visible === "visible", JSON.stringify(b));
test("elle porte la description du bouton, en entier", b && b.texte === LONG);
test("plusieurs lignes, 280 px au plus", b && b.width <= 281 && b.lignes >= 3, b ? `largeur ${b.width}, ${b.lignes} lignes` : "");
test("le `title` est mis de côté pendant le survol (Windows ne l'affiche pas aussi)", (await titre("#rouge")) === null);
test("« a » : contour de la couleur du bouton", b && b.bord === (await couleurDe("#rouge", "color")), b ? `${b.bord}` : "");
test("« a » : fond PÂLE de cette couleur (pas blanc, pas plein)", b && rgbOk(b.fond) && b.fond !== "rgb(255, 255, 255)" && b.fond !== b.bord, b ? b.fond : "");
const r1 = await rect("#rouge");
test("posée sous le bouton", b && b.place === "dessous" && b.top >= r1.bottom && b.top <= r1.bottom + 10, b ? `${b.top} / ${r1.bottom}` : "");

await page.mouse.move(2, 590); await attendre(150);
test("la souris s'en va : la fenêtre disparaît", (await bulle()) === null);
test("et le `title` est RENDU au bouton", (await titre("#rouge")) === LONG);

await survoler("#vert");
b = await bulle();
const vert = await couleurDe("#vert", "color");
test("un bouton vert donne une fenêtre verte", b && b.bord === vert && b.texte === "Valider", b ? `${b.bord} / ${vert}` : "");
test("une description courte tient sur une ligne", b && b.lignes === 1, b ? `${b.lignes}` : "");

await survoler("#plein");
b = await bulle();
const fondPlein = await couleurDe("#plein", "backgroundColor");
test("bouton plein (texte blanc sur bleu) : la fenêtre prend son bleu", b && b.bord === fondPlein, b ? `${b.bord} / ${fondPlein}` : "");
test("… et son texte n'est pas blanc (lisible sur le fond pâle)", b && b.couleur !== "rgb(255, 255, 255)", b ? b.couleur : "");

await survoler("#dansLigne");
b = await bulle();
const titresAutour = await page.$eval("#dansLigne", (e) => { const t = []; for (let x = e; x; x = x.parentElement) if (x.getAttribute && x.getAttribute("title") != null) t.push(x.id || x.tagName); return t; });
test("un bouton DANS une ligne qui a sa description : seule la fenêtre parle — la ligne et la cellule se taisent aussi (sinon Windows montre « Cliquer pour voir tous les articles » par-dessus)",
  b && b.texte.startsWith("Devis : reprendre") && titresAutour.length === 0, JSON.stringify(titresAutour));
await page.mouse.move(2, 590); await attendre(150);
test("… et la ligne et la cellule retrouvent leur description quand la souris s'en va",
  (await titre("#ligne")) === "Cliquer pour voir tous les articles" && (await titre("#cellule")) === "Cellule" && (await titre("#dansLigne")) !== null);

await survoler("#sans");
test("un bouton SANS description : rien", (await bulle()) === null);
await survoler("#texte");
test("un texte qui n'est pas un bouton garde son `title` ordinaire", (await bulle()) === null && (await titre("#texte")) === "Un texte, pas un bouton");

await survoler("#droite");
b = await bulle();
test("bouton au bord droit : la fenêtre reste dans l'écran", b && b.right <= 900 - 7 && b.left >= 8, b ? `${b.left} → ${b.right}` : "");
await survoler("#bas");
b = await bulle();
const rb = await rect("#bas");
test("bouton en bas de l'écran : la fenêtre passe AU-DESSUS", b && b.place === "dessus" && b.bottom <= rb.top && b.top >= 8, b ? `${b.top}-${b.bottom} / ${rb.top}` : "");

await survoler("#bleu");
await page.mouse.down(); await attendre(80);
test("un clic ferme la fenêtre", (await bulle()) === null);
await page.mouse.up();
test("… et rend le `title`", (await titre("#bleu")) === "Imprimer le reçu");

await page.mouse.move(2, 590); await attendre(80);
await page.evaluate(() => {
  const el = document.getElementById("vert");
  el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "touch" }));
});
await attendre(500);
test("au doigt : rien (pas de survol sur téléphone)", (await bulle()) === null && (await titre("#vert")) === "Valider");

await survoler("#eteint");
const eteint = await bulle();
console.log(`  · bouton éteint : ${eteint ? "la fenêtre s'ouvre aussi" : "pas de fenêtre (le navigateur garde son cadre ordinaire)"}`);
test("un bouton éteint garde au moins sa description (fenêtre, ou `title` ordinaire)", !!eteint || (await titre("#eteint")) === "Bouton éteint");

test("aucune erreur dans la page", erreurs.length === 0, erreurs.join(" | "));

// TÉMOIN : sans l'hôte, c'est le cadre gris de Windows — et pas de fenêtre.
await page.goto(`file://${html}?q=temoin`);
await attendre(300);
await survoler("#rouge");
test("TÉMOIN sans l'hôte : aucune fenêtre, le `title` reste (le défaut existe sans la règle)", (await bulle()) === null && (await titre("#rouge")) === LONG);
await nav.close();

// ─────────────────────────── 3. LU DANS LE CODE
console.log("▸ Une seule règle, partout");
const app = sansCommentaires(lire("src/App.jsx"));
test("App.jsx importe l'hôte", /import \{[^}]*\bInfobulleHost\b[^}]*\} from "\.\/components\/ui"/.test(app));
test("monté à la connexion ET dans l'application", (app.match(/<InfobulleHost \/>/g) || []).length === 2);
const lib = lire("src/lib/infobulle.js");
test("lib/infobulle.js n'importe rien (règles pures)", !/^\s*import\s/m.test(lib));
const autres = [];
const { statSync } = await import("node:fs");
const parcourir = (d) => readdirSync(d).forEach((n) => { const q = join(d, n); if (statSync(q).isDirectory()) parcourir(q); else if (/\.jsx?$/.test(n) && !q.endsWith("components/ui.jsx")) autres.push(q); });
parcourir("src");
const montes = autres.filter((f) => /role="tooltip"|<InfobulleHost/.test(lire(f)) && !f.endsWith("App.jsx"));
test("aucun écran ne fabrique sa propre fenêtre de description", montes.length === 0, montes.join(", "));

console.log(`\nRésultat : ${ok} ✓, ${ko} ✗`);
process.exit(ko ? 1 : 0);
