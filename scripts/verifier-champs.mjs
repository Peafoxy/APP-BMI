// ============================================================
// scripts/verifier-champs.mjs — LA LARGEUR DES CHAMPS, MESURÉE DANS
// UN VRAI NAVIGATEUR
//
//   npm run verifier-champs
//
// ⚠ POURQUOI CE BANC EXISTE (Timo, 18/09/2026, deux fois de suite :
// « réduire la ligne rechercher un outil, trop long », puis « la ligne de
// recherche est toujours trop longue… rien n'est fait. Ou bien tu as fait
// autre chose que ce que je demande ? »).
//
// La première correction POSAIT la bonne classe (`sm:max-w-xs`) et un
// contrôle statique vérifiait qu'elle était là. Elle était là. Elle ne
// faisait RIEN : `src/index.css` porte, depuis longtemps et pour une bonne
// raison (un champ qui débordait d'une grille), la règle globale
//     input, select, textarea { max-width: 100%; }
// écrite APRÈS `@import "tailwindcss"` — donc plus forte que toute classe
// utilitaire. DIX `max-w-*` posés sur des champs ne commandaient rien.
//
// Un contrôle qui lit une CLASSE ne mesure pas un EFFET. Celui-ci monte le
// vrai CSS construit dans Chromium et LIT LA LARGEUR OBTENUE.
// ============================================================
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };

const ui = readFileSync("src/components/ui.jsx", "utf8");
const inputCls = ui.match(/export const inputCls = "([^"]+)"/)[1];
const suffixe = ui.match(/export const champRecherche = `\$\{inputCls\} ([^`]+)`/)[1];
const mf = ui.match(/export const champRechercheFenetre = (?:`\$\{inputCls\}([^`]*)`|inputCls);/);
const fenetre = (mf && mf[1] ? mf[1] : "").trim();

// ⚠ On LIT la classe du cadre dans App.jsx — jamais on ne la recopie ici :
// deux écritures finiraient par diverger, et le banc mesurerait autre chose
// que ce que l'application fait.
const app = readFileSync("src/App.jsx", "utf8");
const mc = app.match(/<main className="(w-full max-w-[^"]+)">/);
if (!mc) { console.log("❌ Le cadre <main> d'App.jsx n'a pas la forme attendue."); process.exit(1); }
const cadreCls = mc[1];

const css = readdirSync("dist/assets").filter((f) => f.endsWith(".css"))[0];
if (!css) { console.log("❌ Pas de CSS construit — lancez `npm run build` d'abord."); process.exit(1); }

const dossier = mkdtempSync(join(tmpdir(), "bmi-champs-"));
const page = join(dossier, "p.html");
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${join(process.cwd(), "dist/assets", css)}">
<style>
  /* ⚠ Le témoin des transitions porte SA propre classe, posée dans la même
     couche que les utilitaires Tailwind. Sinon il dépend d'une classe que
     l'application écrit encore — et le jour où plus personne ne l'écrit,
     Tailwind ne la génère plus et le témoin ne prouve plus rien (c'est
     arrivé le 18/09/2026, au moment même où on retirait les douze mortes). */
  @layer utilities { .temoin-transition { transition-property: background-color; transition-duration: .3s; } }
</style></head>
<body style="margin:0"><div style="width:100%">
  <input id="recherche" class="${inputCls} ${suffixe}" placeholder="Rechercher…">
  <input id="ordinaire" class="${inputCls}" placeholder="Champ ordinaire">
  <input id="temoin" class="${inputCls} max-w-xs" placeholder="Témoin : un max-w sur un champ">
  <button id="btemoin" class="px-4 py-2 temoin-transition">Témoin : transition sur un bouton</button>
  <span id="stemoin" class="temoin-transition">Témoin : la même classe hors bouton</span>
</div>
<!-- ⚠ LE CADRE DE L'APPLICATION (20/09/2026) : la classe est LUE dans
     App.jsx et posée telle quelle, pour que le banc mesure ce que Timo voit
     et non ce que je crois avoir écrit. -->
<main id="cadre" class="${cadreCls}"><div id="dedans" style="width:100%"></div></main>
<!-- La fenêtre du sélecteur d'article, telle qu'elle s'ouvre vraiment -->
<div class="fixed inset-0 flex items-end sm:items-center justify-center">
  <div id="panneau" class="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-md max-h-[85vh] flex flex-col">
    <div class="p-3 border-b border-slate-200">
      <input id="dansFenetre" class="${inputCls} ${fenetre}" placeholder="🔍 Rechercher un article…">
    </div>
    <div id="listeFenetre" class="overflow-y-auto flex-1">
      <button class="w-full text-left px-4 py-3">Panneau 400W</button>
    </div>
  </div>
</div></body></html>`);

console.log("\n── 🔍 LA LIGNE DE RECHERCHE, MESURÉE ──");
const navigateur = await chromium.launch();
const mesurer = async (largeur) => {
  const p = await navigateur.newPage({ viewport: { width: largeur, height: 800 } });
  await p.goto(`file://${page}`);
  const r = await p.evaluate(() => ({
    recherche: Math.round(document.getElementById("recherche").getBoundingClientRect().width),
    ordinaire: Math.round(document.getElementById("ordinaire").getBoundingClientRect().width),
    temoin: Math.round(document.getElementById("temoin").getBoundingClientRect().width),
    btnTransition: getComputedStyle(document.getElementById("btemoin")).transitionProperty,
    spanTransition: getComputedStyle(document.getElementById("stemoin")).transitionProperty,
    dansFenetre: Math.round(document.getElementById("dansFenetre").getBoundingClientRect().width),
    listeFenetre: Math.round(document.getElementById("listeFenetre").getBoundingClientRect().width),
    cadre: Math.round(document.getElementById("cadre").getBoundingClientRect().width),
  }));
  await p.close();
  return r;
};
const grandEcran = await mesurer(1920);
const pc = await mesurer(1400);
const tablette = await mesurer(700);
const tel = await mesurer(390);
await navigateur.close();
rmSync(dossier, { recursive: true, force: true });

test("★ sur ORDINATEUR (1400 px) la ligne de recherche est BRIDÉE — elle ne traverse pas l'écran",
  pc.recherche > 200 && pc.recherche <= 360,
  `mesuré : ${pc.recherche} px (le champ ordinaire, lui, fait ${pc.ordinaire} px)`);
test("★ sur TABLETTE (700 px) elle est bridée de la même façon",
  tablette.recherche > 200 && tablette.recherche <= 360, `mesuré : ${tablette.recherche} px`);
test("★ sur TÉLÉPHONE (390 px) elle prend TOUTE la largeur — c'est là qu'on en a besoin",
  tel.recherche === tel.ordinaire && tel.recherche >= 360, `mesuré : ${tel.recherche} px`);
test("★ un champ ORDINAIRE n'a pas été rétréci au passage (la règle ne vaut que pour la recherche)",
  pc.ordinaire >= 1300 && tel.ordinaire >= 360);

// ⚠ …SAUF DANS UNE FENÊTRE DÉJÀ ÉTROITE. Le sélecteur d'article s'ouvre dans
// un panneau de 448 px : à 320 px, la ligne laissait 104 px de blanc à sa
// droite pendant que la liste dessous courait sur tout le panneau (mesuré le
// 18/09/2026, défaut introduit le jour même par la règle de largeur).
console.log("\n── 🪟 …ET DANS UNE FENÊTRE, ELLE SUIT LE CADRE ──");
test("★ dans la fenêtre du sélecteur d'article (448 px), la ligne fait TOUTE la largeur du panneau — pas 320 px avec du blanc à droite",
  pc.dansFenetre > 380 && pc.listeFenetre - pc.dansFenetre <= 30,
  `mesuré : ligne ${pc.dansFenetre} px dans un panneau de ${pc.listeFenetre} px`);
test("★ et sur TÉLÉPHONE (390 px) elle remplit son panneau de la même façon (les deux règles se rejoignent)",
  tel.listeFenetre - tel.dansFenetre <= 30 && tel.dansFenetre >= 340,
  `mesuré : ligne ${tel.dansFenetre} px dans un panneau de ${tel.listeFenetre} px`);

// ⚠⚠ LA LARGEUR DE L'ÉCRAN (Timo, 20/09/2026 : « pourquoi ces marges des 2
// côtés ? », puis « ces marges c'est sur ordinateur », puis « b »). Le cadre
// était bridé à 1152 px : sur son XPS, la liste des ventes se tassait pendant
// qu'il y avait 300 px de blanc de chaque côté.
// ⚠ On MESURE la largeur obtenue, on ne lit pas la classe — c'est toute la
// leçon de ce banc.
console.log("\n── 🖥 LA LARGEUR DU CADRE DE L'APPLICATION ──");
test("★★ sur un GRAND écran (1920 px), le cadre va jusqu'à 1600 px — plus les 1152 px d'avant",
  grandEcran.cadre >= 1560 && grandEcran.cadre <= 1600,
  `mesuré : ${grandEcran.cadre} px`);
test("★ sur un ordinateur ordinaire (1400 px), le cadre prend TOUT — aucune marge perdue",
  pc.cadre >= 1360, `mesuré : ${pc.cadre} px pour 1400 px d'écran`);
test("★★ sur TÉLÉPHONE (390 px) RIEN ne change : la limite n'a jamais rogné un téléphone",
  tel.cadre >= 380 && tel.cadre <= 390, `mesuré : ${tel.cadre} px`);
test("★ et sur tablette non plus", tablette.cadre >= 690 && tablette.cadre <= 700, `mesuré : ${tablette.cadre} px`);
test("★ la limite EXISTE quand même : un moniteur immense n'étale pas un formulaire sur toute sa largeur",
  grandEcran.cadre < 1920);

console.log("\n── ⚠ LE PIÈGE, GRAVÉ : `max-w-*` NE COMMANDE RIEN SUR UN CHAMP ──");
test("★ le TÉMOIN le prouve : un `max-w-xs` posé sur un input ne bride RIEN (la règle globale d'index.css l'écrase)",
  pc.temoin === pc.ordinaire,
  `témoin ${pc.temoin} px = champ ordinaire ${pc.ordinaire} px — la classe est là, elle ne fait rien`);
test("★ la règle globale qui l'écrase est TOUJOURS là (elle existe pour une vraie raison : un champ qui débordait d'une grille)",
  /input, select, textarea \{ max-width: 100%; \}/.test(readFileSync("src/index.css", "utf8")));

const morts = execSync("grep -rn 'max-w-' src/screens src/components | grep -E 'inputCls|champRecherche' || true")
  .toString().trim();
test("★ donc PLUS AUCUN `max-w-*` posé sur un champ de saisie dans l'application — dix l'étaient, aucun ne commandait rien",
  morts === "", morts.split("\n").slice(0, 5).join("\n     "));

// ═══ LA MÊME QUESTION, POSÉE À TOUT LE RESTE (Timo, 18/09/2026 : « vérifie
// si d'autres classes ne commandent rien comme celle-là »). `src/index.css`
// donne à CHAQUE bouton actif son retour visuel (demande Timo, 20/08/2026) :
//     button:not(:disabled) { transition: filter 120ms, transform 80ms; }
// Écrite hors layer, elle écrase toute classe `transition-*` posée sur un
// bouton. DOUZE l'étaient — elles n'animaient rien.
console.log("\n── ⚠ ET `transition-*` NE COMMANDE RIEN SUR UN BOUTON ──");
test("★ le TÉMOIN le prouve : une classe qui pose `transition-property` sur un bouton devient « filter, transform » — la classe est là, elle n'anime rien",
  pc.btnTransition === "filter, transform",
  `mesuré sur le bouton : ${pc.btnTransition}`);
test("★ …alors que la MÊME classe, hors bouton, fonctionne — la preuve que c'est bien la règle globale qui mange, pas Tailwind qui manque",
  pc.spanTransition === "background-color",
  `mesuré hors bouton : ${pc.spanTransition.slice(0, 60)}…`);

const transitionsMortes = execSync("grep -rn 'transition-all\\|transition-colors\\|transition-transform\\|duration-[0-9]\\|\\bease-' src --include=*.jsx || true")
  .toString().trim();
test("★ donc PLUS AUCUNE `transition-*` écrite dans l'application — douze l'étaient, toutes sur des boutons, toutes mortes",
  transitionsMortes === "", transitionsMortes.split("\n").slice(0, 5).join("\n     "));

// Les trois autres règles globales d'index.css ont été passées au crible le
// même jour et sont SAINES — on le note ici pour ne pas refaire l'audit :
//   `.grid > * { min-width: 0 }`  → aucun `min-w-*` n'est enfant DIRECT d'une
//        grille (ils sont tous sur un <table> dans un cadre qui défile) ;
//   `button:active { transform }` → aucun `active:scale-*` dans le code ;
//   `:focus-visible { outline }`  → les trois `outline-none` sont sur des
//        <input>, que cette règle ne touche pas.
test("★ la règle qui donne son retour visuel à chaque bouton est TOUJOURS là (c'est elle qui mange les transitions, et elle vaut mieux qu'elles)",
  /button:not\(:disabled\) \{[\s\S]*transition: filter/.test(readFileSync("src/index.css", "utf8")));

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
