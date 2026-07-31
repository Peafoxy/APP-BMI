import { JSDOM } from "jsdom";
import "fake-indexeddb/auto";
import { readdirSync } from "fs";
import { webcrypto } from "crypto";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "https://app-bmi.test/", pretendToBeVisual: true });
const { window } = dom;
for (const k of Object.getOwnPropertyNames(window)) if (!(k in globalThis)) { try { globalThis[k] = window[k]; } catch {} }
globalThis.window = window; globalThis.document = window.document;
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
if (!window.crypto?.subtle) Object.defineProperty(window, "crypto", { value: webcrypto });
Object.defineProperty(globalThis, "crypto", { value: window.crypto, configurable: true });
window.matchMedia = () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} });
window.scrollTo = () => {}; window.indexedDB = globalThis.indexedDB; window.IDBKeyRange = globalThis.IDBKeyRange;

const LATENCE_MS = 150;
let requetesSimultaneesMax = 0, requetesEnCours = 0;
const compteurTable = {};
globalThis.fetch = async (url, opts = {}) => {
  requetesEnCours++;
  requetesSimultaneesMax = Math.max(requetesSimultaneesMax, requetesEnCours);
  const u = String(url); const methode = (opts.method || "GET").toUpperCase();
  await new Promise((r) => setTimeout(r, LATENCE_MS));
  requetesEnCours--;
  const json = (code, corps) => new Response(JSON.stringify(corps), { status: code, headers: { "content-type": "application/json" } });
  if (u.includes("/auth/")) return json(400, { error: "invalid_grant" });
  if (u.includes("/rest/")) {
    if (methode !== "GET") return json(200, []);
    const m = u.match(/\/rest\/v1\/([a-z_]+)\?/) || u.match(/\/rest\/v1\/([a-z_]+)$/);
    const table = m ? m[1] : ("INCONNU:" + u.slice(0, 60));
    compteurTable[table] = (compteurTable[table] || 0) + 1;
    if (table === "ventes") return json(500, { message: "Erreur serveur simulée (test)" });
    return json(200, []);
  }
  return json(404, {});
};
process.on("unhandledRejection", () => {});
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
function taper(i, v) { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(i, v); i.dispatchEvent(new window.Event("input", { bubbles: true })); }
const racine = () => document.getElementById("root");
const bouton = (re) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));
const champsTexte = () => [...racine().querySelectorAll("input")].filter((i) => ["text", "password"].includes(i.type));
const { definirMotDePasse } = await import("./core_t.mjs");
const { idb } = await import("./db_t.mjs");
const emp = await definirMotDePasse("ADMIN2026");
const ts = new Date().toISOString();
await idb.boutiques.put({ id: "b1", nom: "LOME", updated_at: ts });
await idb.users.put({ id: "adm", nom: "Administrateur", role: "admin", actif: true, admin_principal: true, ...emp, updated_at: ts });
const js = readdirSync("dist/assets").find((f) => f.startsWith("index-") && f.endsWith(".js"));
await import("./dist/assets/" + js);
for (let n = 0; n < 30 && champsTexte().length < 2; n++) await attendre(300);
const ins = champsTexte();
taper(ins[0], "Administrateur"); taper(ins[1], "ADMIN2026");
await attendre(200);
const debut = Date.now();
bouton(/se connecter/i)?.click();
await attendre(5500);
const duree = Date.now() - debut;
console.log("\n═══ RÉSULTATS ═══");
console.log("Durée totale (connexion + 1er cycle de sync) :", duree, "ms");
console.log("Requêtes GET simultanées (pic observé) :", requetesSimultaneesMax);
console.log("Tables lues :", Object.keys(compteurTable).filter(t => !t.startsWith("INCONNU")).length, "/ 18 attendues");
console.log("Table 'ventes' (erreur simulée) tentée :", (compteurTable.ventes || 0) > 0);
console.log("Table 'users' quand même lue malgré l'erreur sur 'ventes' :", (compteurTable.users || 0) > 0);
console.log("Table 'depenses' quand même lue (isolation confirmée) :", (compteurTable.depenses || 0) > 0);
console.log("URLs non reconnues (diagnostic) :", Object.keys(compteurTable).filter(t => t.startsWith("INCONNU")).slice(0,2));
