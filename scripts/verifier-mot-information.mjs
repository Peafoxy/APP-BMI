// ============================================================
// verifier-mot-information.mjs — LE MOT D'INFORMATION, MESURÉ
//
// Timo, 19/09/2026 : « faire en sorte que le message ne mette pas mal à
// l'aise le client ni le personnel ». Ce n'est pas une préférence de style,
// c'est la demande — donc elle se MESURE.
//
// ⚠ Le banc rend la VRAIE fenêtre (react-dom/server sur le vrai composant,
// avec les vrais textes) et la monte dans Chromium avec le VRAI CSS
// construit. Il ne relit pas des classes dans un fichier : un contrôle qui
// lit une CLASSE ne mesure pas un EFFET (leçon du 18/09/2026).
// ============================================================
import { readFileSync, writeFileSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
let ok = 0, ko = 0;
const test = (nom, cond, detail = "") => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}${detail ? `\n     ${detail}` : ""}`); } };

// ---- 1. Les TEXTES, exercés tels quels ----
const sortieMot = join("node_modules", ".cache", `bmi-mot-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/motInformation.js"], bundle: true, format: "esm",
  platform: "node", outfile: sortieMot, logLevel: "silent", loader: { ".js": "jsx" } });
const M = await import(pathToFileURL(sortieMot).href);
unlinkSync(sortieMot);

console.log("\n── 📝 LES DEUX TEXTES ──");
for (const [qui, mot] of [["client", M.MOT_CLIENT], ["employé", M.MOT_EMPLOYE]]) {
  const r = M.motRassurant(mot);
  test(`le mot du ${qui} ne porte AUCUN des mots qui mettent mal à l'aise (jargon, « j'accepte », « surveill… », « obligatoire »)`,
    r.ok, r.fautes.length ? `trouvé : ${r.fautes.join(", ")}` : "");
  const mots = [mot.titre, mot.intro, ...mot.blocs.flatMap((b) => [b.titre, b.texte])].join(" ").split(/\s+/).length;
  test(`le mot du ${qui} tient en moins de 200 mots (${mots}) — un mur de texte ressemble à un contrat qu'on fait signer à la sauvette`, mots < 200);
  test(`★ le mot du ${qui} commence par CE QU'ON NE FAIT PAS : c'est ça qui rassure, pas la liste de ce qu'on garde`,
    /ne fait|ne faisons/i.test(mot.blocs[0].titre));
  test(`★ le mot du ${qui} dit « J'ai compris », JAMAIS « J'accepte » — on informe, on ne demande pas un consentement qu'on n'a pas besoin de demander`,
    /compris/i.test(mot.bouton) && !/accepte/i.test(mot.bouton));
}
test("★ mais on ne rassure pas à tort : les DEUX rappellent que la loi peut obliger à transmettre, et l'employé n'apprend PAS que ses collègues ne voient rien du tout — seulement sa rémunération et ses déclarations",
  /la loi nous y oblige/i.test(JSON.stringify(M.MOT_CLIENT))
  && /la loi impose de déclarer/i.test(JSON.stringify(M.MOT_EMPLOYE))
  && /rémunération et vos déclarations sociales ne sont visibles/i.test(JSON.stringify(M.MOT_EMPLOYE)));
// ⚠ CONTRÔLE RETOURNÉ le 19/09/2026 : il comparait les OBJETS (motPour(...)
// === MOT_CLIENT). Depuis que la DURÉE DE CONSERVATION s'écrit dans le mot du
// client, motPour rend une COPIE remplie — l'égalité d'objet ne voulait plus
// rien dire. Il compare maintenant les TEXTES, ce qui est ce qu'on voulait
// vérifier depuis le début, et il vérifie en plus les deux choses neuves.
test("★ un compte CLIENT reçoit le mot du client, tout autre rôle celui de l'employé",
  M.motPour("client").titre === M.MOT_CLIENT.titre
  && M.motPour("vendeur").titre === M.MOT_EMPLOYE.titre
  && M.motPour("admin").titre === M.MOT_EMPLOYE.titre);
test("★ la DURÉE annoncée au client suit le réglage : 6 ans écrit 6, 10 ans écrit 10 — jamais un chiffre gravé, et jamais le jeton laissé en place",
  /gardons 6 ans après votre dernier achat/.test(JSON.stringify(M.motPour("client", 6)))
  && /gardons 10 ans après votre dernier achat/.test(JSON.stringify(M.motPour("client", 10)))
  && !JSON.stringify(M.motPour("client", 6)).includes(M.JETON_DUREE));
test("★★ l'EMPLOYÉ n'a JAMAIS de durée, et ce n'est pas un oubli : sa paie et ses déclarations sociales se gardent par obligation légale, pas par ce réglage — lui annoncer la durée des clients serait faux",
  !/\d+ ans/.test(JSON.stringify(M.motPour("vendeur", 6)))
  && !JSON.stringify(M.motPour("vendeur", 6)).includes(M.JETON_DUREE));
test("★ il ne se montre qu'UNE fois : marqué sur la fiche, et AUSSI dans le navigateur — sinon un compte en LECTURE SEULE (le comptable) le reverrait à chaque ouverture",
  M.motAMontrer({ id: "u1" }) === true
  && M.motAMontrer({ id: "u1", [M.CHAMP_VU]: "2026-09-19" }) === false
  && M.motAMontrer({ id: "u1" }, true) === false
  && M.marquerMotLu({ users: [{ id: "u1" }] }, "u1", "2026-09-19").users[0][M.CHAMP_VU] === "2026-09-19");

// ---- 2. LA VRAIE FENÊTRE, rendue puis MESURÉE ----
const sortieVue = join("node_modules", ".cache", `bmi-motvue-${process.pid}.mjs`);
await build({
  entryPoints: ["scripts/_rendu-mot.jsx"], bundle: true, format: "esm", platform: "node",
  outfile: sortieVue, logLevel: "silent", jsx: "automatic",
  external: ["react", "react-dom", "react-dom/server"],
});
const R = await import(pathToFileURL(sortieVue).href);
unlinkSync(sortieVue);

const cssFichier = readFileSync("dist/assets/" + require("node:fs").readdirSync("dist/assets").find((f) => f.endsWith(".css")), "utf8");
const dossier = mkdtempSync(join(tmpdir(), "bmi-mot-"));
const page = join(dossier, "p.html");

const navigateur = await chromium.launch();
console.log("\n── 👋 LA FENÊTRE, MESURÉE DANS CHROMIUM ──");

for (const [qui, html] of [["client", R.htmlClient], ["employé", R.htmlEmploye]]) {
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>${cssFichier}</style></head><body style="margin:0">${html}</body></html>`);

  for (const [appareil, largeur, hauteur] of [["téléphone", 390, 844], ["ordinateur", 1280, 800]]) {
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur } });
    const p = await ctx.newPage();
    await p.goto("file://" + page);
    const m = await p.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns[btns.length - 1];
      const voile = document.body.firstElementChild;   // le voile, qui défile
      const carte = voile.firstElementChild;
      const rouge = [...document.querySelectorAll("*")].some((e) => {
        const s = getComputedStyle(e);
        const r = (c) => { const v = c.match(/\d+/g); return v && Number(v[0]) > 180 && Number(v[1]) < 90 && Number(v[2]) < 90; };
        return r(s.backgroundColor) || r(s.color);
      });
      // ⚠ « Atteignable » ne se lit pas sur une hauteur : on DÉFILE vraiment,
      // comme le doigt le ferait, et on regarde où les deux bouts tombent
      // DANS L'ÉCRAN. Piège connu de flexbox : une carte centrée (ou collée
      // en bas) plus haute que son cadre laisse son HAUT hors d'atteinte —
      // on ne peut pas remonter jusqu'au titre. `my-auto` est ce qui l'évite.
      voile.scrollTop = voile.scrollHeight;
      const basBouton = b ? Math.round(b.getBoundingClientRect().bottom) : 0;
      voile.scrollTop = 0;
      const hautCarte = Math.round(carte.getBoundingClientRect().top);
      return {
        boutons: btns.length,
        texteBouton: b ? b.textContent.trim() : "",
        largeurBouton: b ? Math.round(b.getBoundingClientRect().width) : 0,
        hauteurCarte: Math.round(carte.getBoundingClientRect().height),
        hauteurEcran: window.innerHeight,
        basBouton,
        hautCarte,
        rouge,
        alerte: /⚠|attention|avertissement/i.test(document.body.textContent),
      };
    });
    await ctx.close();

    test(`★ ${qui} / ${appareil} : UN SEUL bouton, large, et il dit « ${m.texteBouton} » — pas de croix, pas de « Refuser » : on n'attend rien de la personne`,
      m.boutons === 1 && /compris/i.test(m.texteBouton) && m.largeurBouton > 200,
      `boutons=${m.boutons} largeur=${m.largeurBouton}`);

    test(`★ ${qui} / ${appareil} : AUCUN rouge, AUCUN ⚠ — un bandeau d'alerte donne le ton avant qu'on ait lu un mot`,
      !m.rouge && !m.alerte);

    // ⚠ Sur un téléphone la carte peut dépasser l'écran, et c'est permis :
    // elle défile. Ce qu'on refuse, c'est un bout qu'on n'atteint JAMAIS.
    test(`★ ${qui} / ${appareil} : une fois défilé au bas, le bouton « J'ai compris » est DANS l'écran (bas du bouton ${m.basBouton} px sur ${m.hauteurEcran} px)`,
      m.basBouton > 0 && m.basBouton <= m.hauteurEcran);
    // Éprouvé en remettant la faute exprès (`my-auto` retiré, écran de
    // 500 px) : le haut de la carte tombe à −53 px et le contrôle tombe.
    test(`★ ${qui} / ${appareil} : et une fois remonté en haut, le TITRE est dans l'écran — le piège de flexbox (carte plus haute que son cadre, haut hors d'atteinte) ne mord pas (haut de carte ${m.hautCarte} px, carte ${m.hauteurCarte} px)`,
      m.hautCarte >= 0);

    if (appareil === "ordinateur") {
      test(`★ ${qui} / ordinateur : la fenêtre tient dans l'écran sans défiler (${m.hauteurCarte} px sur 800)`,
        m.hauteurCarte <= 760, `hauteur=${m.hauteurCarte}`);
    }
  }
}

await navigateur.close();
rmSync(dossier, { recursive: true, force: true });

// ---- 3. Le branchement ----
console.log("\n── 🔌 LE BRANCHEMENT ──");
const app = readFileSync("src/App.jsx", "utf8");
test("★ il ne passe JAMAIS par-dessus le verrou : quelqu'un qui doit taper son mot de passe n'a pas à lire un mot d'accueil d'abord",
  /\{!verrouille && \(\(\) => \{[\s\S]{0,600}?MotInformation/.test(app));
test("★ il lit la fiche VIVANTE (db.users), pas l'étiquette de connexion — celle-ci n'est réécrite qu'à la connexion",
  /const fiche = \(db\?\.users \|\| \[\]\)\.find\(\(x\) => x\.id === profile\?\.id\)/.test(app));
test("★ la marque part d'abord dans le NAVIGATEUR, puis sur la fiche — et sans ligne de journal (lire un mot n'est pas un geste de gestion)",
  /localStorage\.setItem\(CLE_VU_ICI/.test(app)
  && /save\(marquerMotLu\(dbRef\.current, fiche\.id, today\(\)\), ""\)/.test(app)
  && app.indexOf("localStorage.setItem(CLE_VU_ICI") < app.indexOf("save(marquerMotLu"));
// ⚠ RETOURNÉ le 19/09/2026 : motPour prend maintenant la DURÉE en second
// argument. On en profite pour exiger qu'elle vienne du RÉGLAGE — un chiffre
// écrit là à la main serait exactement ce qu'on veut empêcher.
test("★ la fenêtre est écrite UNE fois pour les deux (un seul composant, les mots seuls changent), et la durée vient du RÉGLAGE, jamais d'un chiffre écrit dans App.jsx",
  /motPour\(fiche\.role, dureeConservation\(db\)\)/.test(app)
  && (readFileSync("src/components/MotInformation.jsx", "utf8").match(/export function/g) || []).length === 1);

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
