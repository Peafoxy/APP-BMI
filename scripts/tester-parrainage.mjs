// ============================================================
// scripts/tester-parrainage.mjs — LE SERVEUR ET L'APPLICATION DOIVENT
// FABRIQUER LE MÊME MOT DE PASSE
//
//   node scripts/tester-parrainage.mjs
//
// ⚠ POURQUOI CE BANC EXISTE. Depuis le 25/08/2026, c'est le SERVEUR qui
// crée le compte d'un filleul (api/creer-filleul.js) — pour que le
// téléphone du parrain n'ait plus besoin de l'annuaire complet de vos
// clients. Le serveur refait donc, de son côté, ce que l'application
// faisait du sien : chercher un identifiant libre et un mot de passe sans
// conflit.
//
// Deux mises en œuvre du même calcul, c'est deux occasions de diverger. Et
// la divergence serait silencieuse ET grave : le filleul recevrait par
// WhatsApp un mot de passe qui ne le connecterait pas. Ce banc compare les
// deux, sur des cas choisis pour les faire se contredire.
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chiffresTel, motDePasseClient, memeNumero } from "../src/lib/identiteClient.js";

const sortie = join("node_modules", ".cache", `bmi-parr-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
await build({
  entryPoints: ["src/lib/comptesClients.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortie, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
});
const App = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
const titre = (t) => console.log(`\n${t}`);

// ── La copie exacte de ce que fait api/creer-filleul.js ──
// (le fichier lui-même importe @supabase/supabase-js et ne s'exécute pas
// hors Vercel : on rejoue ici la MÊME logique, et c'est justement elle
// qu'on met en face de celle de l'application.)
const majuscules = (s) => String(s || "").trim().toUpperCase();
function serveurIdentifiant(comptes, nom, tel) {
  const pris = new Set(comptes.map((u) => majuscules(u.nom)));
  const base = majuscules(nom);
  const d = chiffresTel(tel);
  let identifiant = base;
  if (pris.has(identifiant)) identifiant = base + d.slice(0, 2);
  if (pris.has(identifiant)) identifiant = base + d.slice(0, 4);
  for (let i = 2; pris.has(identifiant); i++) identifiant = base + d.slice(0, 2) + i;
  return identifiant;
}
function serveurMotDePasse(comptes, nom, tel) {
  const dejaPris = new Set(
    comptes.filter((u) => u.mdp_auto && u.nom_base)
      .map((u) => motDePasseClient(u.nom_base, u.tel, u.mdp_variante ?? 0, u.mdp_longueur ?? 6))
  );
  for (let v = 0; v < 10; v++) {
    const essai = motDePasseClient(nom, tel, v, 6);
    if (!dejaPris.has(essai)) return { motDePasse: essai, variante: v, longueur: 6 };
  }
  for (let L = 7; L <= 12; L++) {
    for (let v = 0; v < 10; v++) {
      const essai = motDePasseClient(nom, tel, v, L);
      if (!dejaPris.has(essai)) return { motDePasse: essai, variante: v, longueur: L };
    }
  }
  return {
    motDePasse: motDePasseClient(nom, tel, 0, 6) + String(comptes.filter((u) => u.pwd_salt && u.pwd_hash2).length),
    variante: 0, longueur: 6,
  };
}

titre("Le calcul de base est stable des deux côtés");
{
  test("le même nom et le même numéro donnent toujours le même mot de passe",
    motDePasseClient("KOFFI", "90112233") === motDePasseClient("KOFFI", "90112233"));
  test("il fait bien 6 caractères par défaut", motDePasseClient("KOFFI", "90112233").length === 6);
  test("une longueur demandée est respectée", motDePasseClient("KOFFI", "90112233", 0, 9).length === 9);
  test("deux variantes donnent deux mots de passe différents",
    motDePasseClient("KOFFI", "90112233", 0) !== motDePasseClient("KOFFI", "90112233", 1));
  test("un nom vide ne fait pas planter", typeof motDePasseClient("", "") === "string");
}

titre("★ Le serveur et l'application tombent-ils d'accord ?");
{
  // Cas choisis pour provoquer les conflits, pas pour faire joli.
  const scenarios = [
    { titre: "un annuaire vide", users: [], nom: "KOFFI", tel: "90112233" },
    { titre: "un homonyme déjà présent",
      users: [{ nom: "KOFFI", nom_base: "KOFFI", tel: "91000000", mdp_auto: true }],
      nom: "KOFFI", tel: "90112233" },
    { titre: "deux homonymes",
      users: [{ nom: "KOFFI", nom_base: "KOFFI", tel: "91000000", mdp_auto: true },
              { nom: "KOFFI90", nom_base: "KOFFI", tel: "90000000", mdp_auto: true }],
      nom: "KOFFI", tel: "90112233" },
    { titre: "le mot de passe évident est déjà pris",
      users: [{ nom: "AUTRE", nom_base: "KOFFI", tel: "90112233", mdp_auto: true, mdp_variante: 0, mdp_longueur: 6 }],
      nom: "KOFFI", tel: "90112233" },
    { titre: "les dix variantes courtes sont prises (on doit allonger)",
      users: Array.from({ length: 10 }, (_, v) => ({
        nom: `X${v}`, nom_base: "KOFFI", tel: "90112233", mdp_auto: true, mdp_variante: v, mdp_longueur: 6,
      })), nom: "KOFFI", tel: "90112233" },
    { titre: "un nom accentué", users: [], nom: "KOFFI ADJÉ", tel: "70 11 22 33" },
  ];
  for (const sc of scenarios) {
    const db = { users: sc.users };
    const cote = await App.resoudreMotDePasseClient(db, sc.nom, sc.tel);
    const srv = serveurMotDePasse(sc.users, sc.nom, sc.tel);
    test(`même MOT DE PASSE — ${sc.titre}`,
      cote.motDePasse === srv.motDePasse && cote.variante === srv.variante && cote.longueur === srv.longueur);
    test(`même IDENTIFIANT — ${sc.titre}`,
      App.identifiantClient(db, sc.nom, sc.tel) === serveurIdentifiant(sc.users, sc.nom, sc.tel));
  }
}

titre("Le doublon de téléphone, contrôle qui exigeait tout l'annuaire");
{
  const annuaire = [{ nom: "AMA", tel: "+228 90 11 22 33" }];
  const connu = (t) => annuaire.some((u) => memeNumero(u.tel, t));
  test("★ le même numéro écrit SANS l'indicatif est bien reconnu", connu("90112233"));
  test("★ …et avec des tirets aussi", connu("90-11-22-33"));
  test("★ …et avec un autre indicatif écrit 00228", connu("0022890112233"));
  test("un numéro inconnu passe", !connu("91999999"));
  test("un numéro vide ne reconnaît rien", !connu(""));
  test("deux numéros courts et différents ne se confondent pas", !memeNumero("1234", "5678"));
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
