// ============================================================
// scripts/verifier-ecran.cjs — L'APPLICATION S'AFFICHE-T-ELLE VRAIMENT ?
//
//   npm run build && node scripts/verifier-ecran.cjs
//
// ⚠ POURQUOI CE CONTRÔLE EXISTE
//
// Les 376 vérifications de verifier-cloisonnement.mjs testent des CALCULS.
// Elles n'ouvrent jamais l'application. Deux fois de suite (2.100.76 puis
// 2.100.77), une erreur d'ordre des crochets React a rendu l'écran ENTIÈREMENT
// BLANC — et rien ne l'a vu : ni la compilation, qui réussissait sans un mot,
// ni le banc d'essai, qui restait au vert, ni ma relecture.
//
// Seul Timo l'a vu, sur son écran. Ce script fait ce que personne ne faisait :
// il ouvre réellement l'application dans un navigateur et vérifie qu'elle
// affiche quelque chose, sans erreur.
//
// À lancer avant toute livraison qui touche App.jsx ou un écran.
// ============================================================
const { spawn } = require("node:child_process");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");

const PORT = 4173;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const serveur = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore", detached: true,
  });
  let code = 0;
  try {
    await attendre(6000);
    const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
    const page = await nav.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(String(e.message).split("\n")[0]));
    page.on("console", (m) => { if (m.type() === "error") erreurs.push(m.text().slice(0, 160)); });

    await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
    await attendre(3000);
    const texte = (await page.innerText("body")).trim();

    // ---- L'ESPACE FORMATION EST-IL VRAIMENT VIOLET ? ----
    // ⚠ Ce contrôle ne peut PAS se faire en relisant le code : la couleur naît
    // de variables Tailwind redéfinies dans src/index.css, et seul un vrai
    // navigateur sait ce qu'elles valent au bout du compte. On pose donc la
    // marque, et on MESURE la couleur obtenue.
    const teinte = async () => page.evaluate(() => {
      const d = document.createElement("div");
      d.className = "bg-sky-800 text-sky-100 border-sky-300";
      document.body.appendChild(d);
      const s = getComputedStyle(d);
      const r = [s.backgroundColor, s.color, s.borderTopColor].join("|");
      d.remove();
      return r;
    });
    const enReel = await teinte();
    await page.evaluate(() => { document.documentElement.dataset.espace = "formation"; });
    const enFormation = await teinte();
    await page.evaluate(() => { delete document.documentElement.dataset.espace; });
    const revenuAuBleu = await teinte();

    if (enReel === enFormation) {
      console.log("❌  L'espace formation n'est PAS violet : la couleur ne change pas.");
      console.log(`    réel et formation donnent tous deux : ${enReel}`);
      code = 1;
    } else if (revenuAuBleu !== enReel) {
      console.log("❌  Le bleu ne revient pas quand on quitte la formation.");
      code = 1;
    } else {
      console.log("✅  L'espace formation est bien violet, et le réel reste bleu.");
    }

    await nav.close();

    // Le symptôme exact de la panne : une page qui se charge, mais vide.
    if (!texte) {
      console.log("❌  ÉCRAN BLANC — l'application ne s'affiche pas.");
      erreurs.slice(0, 3).forEach((e) => console.log(`    ${e}`));
      console.log("\n    React #310 = « plus de crochets qu'au rendu précédent » :");
      console.log("    un useEffect/useState a été posé APRÈS un point de sortie d'App.jsx.");
      code = 1;
    } else if (erreurs.length) {
      console.log("❌  L'application s'affiche mais signale des erreurs :");
      erreurs.slice(0, 3).forEach((e) => console.log(`    ${e}`));
      code = 1;
    } else {
      const debut = texte.split("\n").slice(0, 3).join(" · ");
      console.log(`✅  L'application s'affiche, sans erreur — « ${debut} »`);
    }
  } catch (e) {
    console.log("❌  Contrôle impossible :", e?.message || e);
    code = 1;
  } finally {
    try { process.kill(-serveur.pid); } catch { /* déjà arrêté */ }
  }
  process.exit(code);
})();
