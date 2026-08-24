// ============================================================
// scripts/tester-verrouillage.mjs — Banc d'essai des deux correctifs
// du 24/08/2026 : le verrouillage des essais et la restriction d'origine.
//
//   node scripts/tester-verrouillage.mjs
//
// Chaque vérification rejoue une situation RÉELLE, pas un cas de
// laboratoire. Les deux plus importantes sont nommées en toutes lettres :
// « le harcèlement est mort » et « l'arrosage est arrêté ».
//
// Aucune connexion à Supabase : la table des tentatives est remplacée par
// un carnet en mémoire, et l'heure est fournie à la main pour pouvoir
// faire passer le temps sans attendre.
// ============================================================
import {
  clesDeControle, lireVerrous, enregistrerEchec, reinitialiserEchecs,
  etatDeLaLigne, palierPour, adresseAppelant,
  PALIERS_APPAREIL_COMPTE, PALIERS_APPAREIL, PALIERS_COMPTE, FENETRE_OUBLI_MINUTES,
} from "../api/_verrouillage.js";
import { origineAutorisee } from "../api/_cors.js";

let ok = 0, ko = 0;
const test = (nom, condition) => {
  if (condition) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}`); }
};

// ── Le carnet qui remplace la table Supabase ─────────────────────────────
function carnet() {
  const lignes = new Map();
  return {
    lignes,
    from: () => ({
      select: () => ({
        in: (_col, ids) => Promise.resolve({
          data: ids.map((i) => lignes.get(i)).filter(Boolean), error: null,
        }),
      }),
      upsert: (rows) => {
        (Array.isArray(rows) ? rows : [rows]).forEach((r) => lignes.set(r.id, r));
        return Promise.resolve({ error: null });
      },
    }),
  };
}

const MINUTE = 60000;
// Une tentative complète, exactement dans l'ordre des fonctions serveur :
// on lit les verrous, on refuse si l'un est actif, sinon on juge le mot de
// passe et on compte (ou on efface).
async function tenter(admin, { prefixe = "recherche", cible, ip, bon = false, t }) {
  const cles = clesDeControle(prefixe, cible, ip);
  const verrou = await lireVerrous(admin, cles, t);
  if (verrou.verrouille) return { resultat: "refusé", minutes: verrou.minutesRestantes };
  if (bon) { await reinitialiserEchecs(admin, cles); return { resultat: "entré" }; }
  await enregistrerEchec(admin, cles, verrou.etats, t);
  return { resultat: "raté" };
}

console.log("\n═══ 1. Les paliers, tels qu'annoncés ═══");
{
  test("4 échecs : aucun verrou", palierPour(4, PALIERS_APPAREIL_COMPTE) === null);
  test("5 échecs : 1 minute", palierPour(5, PALIERS_APPAREIL_COMPTE)?.minutes === 1);
  test("10 échecs : 15 minutes", palierPour(10, PALIERS_APPAREIL_COMPTE)?.minutes === 15);
  test("20 échecs : 1 heure", palierPour(20, PALIERS_APPAREIL_COMPTE)?.minutes === 60);
  test("le palier le plus sévère atteint l'emporte (25 → 1 h, pas 1 min)",
    palierPour(25, PALIERS_APPAREIL_COMPTE)?.minutes === 60);
  test("arrosage : 30 essais depuis un appareil → 15 min",
    palierPour(30, PALIERS_APPAREIL)?.minutes === 15);
  test("filet par compte : rien avant 60 échecs",
    palierPour(59, PALIERS_COMPTE) === null && palierPour(60, PALIERS_COMPTE)?.minutes === 10);
}

console.log("\n═══ 2. L'oubli au bout d'une heure ═══");
{
  const t0 = new Date("2026-08-24T10:00:00Z");
  const vieux = { id: "x", echecs: 4, dernier_echec: new Date(t0.getTime() - 2 * 60 * MINUTE).toISOString(), verrouille_jusqu_a: null };
  test("4 fautes de frappe d'il y a deux heures : compteur remis à zéro",
    etatDeLaLigne(vieux, t0).echecs === 0);
  const recent = { ...vieux, dernier_echec: new Date(t0.getTime() - 10 * MINUTE).toISOString() };
  test("…mais 4 échecs d'il y a dix minutes comptent toujours",
    etatDeLaLigne(recent, t0).echecs === 4);
  test(`la fenêtre d'oubli est bien de ${FENETRE_OUBLI_MINUTES} minutes`,
    etatDeLaLigne({ ...vieux, dernier_echec: new Date(t0.getTime() - (FENETRE_OUBLI_MINUTES - 1) * MINUTE).toISOString() }, t0).echecs === 4);
  // ⚠ Le piège : si l'oubli s'appliquait AUSSI à un verrou en cours, il
  // suffirait d'attendre une heure… ce qui est justement la punition. Pire,
  // un verrou de 1 h posé après 20 échecs serait annulé par sa propre durée.
  const verrouilleDepuisLongtemps = {
    id: "x", echecs: 20,
    dernier_echec: new Date(t0.getTime() - 90 * MINUTE).toISOString(),
    verrouille_jusqu_a: new Date(t0.getTime() + 5 * MINUTE).toISOString(),
  };
  test("un verrou encore actif n'est JAMAIS effacé par l'oubli",
    etatDeLaLigne(verrouilleDepuisLongtemps, t0).verrouille === true);
  test("une ligne inexistante ne fait pas planter la lecture",
    etatDeLaLigne(undefined, t0).echecs === 0 && etatDeLaLigne(null, t0).verrouille === false);
}

console.log("\n═══ 3. Un voleur qui s'acharne sur un compte ═══");
{
  const admin = carnet();
  let t = new Date("2026-08-24T10:00:00Z");
  const voleur = { cible: "kossi", ip: "5.5.5.5", t };
  for (let i = 0; i < 4; i++) await tenter(admin, voleur);
  test("après 4 essais ratés, il peut encore essayer",
    (await tenter(admin, { ...voleur, bon: true })).resultat === "entré");
  // On repart : 5 échecs d'affilée.
  const admin2 = carnet();
  for (let i = 0; i < 5; i++) await tenter(admin2, { cible: "kossi", ip: "5.5.5.5", t });
  const bloque = await tenter(admin2, { cible: "kossi", ip: "5.5.5.5", t, bon: true });
  test("au 5e essai raté, la porte se ferme — même avec le bon mot de passe",
    bloque.resultat === "refusé" && bloque.minutes === 1);
  t = new Date(t.getTime() + 2 * MINUTE);
  test("deux minutes plus tard, elle se rouvre",
    (await tenter(admin2, { cible: "kossi", ip: "5.5.5.5", t, bon: true })).resultat === "entré");
}

console.log("\n═══ 4. LE HARCÈLEMENT EST MORT (le défaut signalé par Timo) ═══");
{
  const admin = carnet();
  const t = new Date("2026-08-24T10:00:00Z");
  // Un inconnu, depuis l'autre bout du monde, s'acharne sur le compte d'un
  // vendeur : 25 mauvais mots de passe.
  for (let i = 0; i < 25; i++) await tenter(admin, { cible: "kossi", ip: "203.0.113.9", t });
  test("l'inconnu, lui, est bel et bien bloqué",
    (await tenter(admin, { cible: "kossi", ip: "203.0.113.9", t })).resultat === "refusé");
  // Pendant ce temps, le vrai Kossi arrive à la boutique et se connecte.
  test("★ le vrai KOSSI se connecte normalement depuis sa boutique",
    (await tenter(admin, { cible: "kossi", ip: "41.207.1.20", t, bon: true })).resultat === "entré");
  test("★ …et même un simple faux pas de sa part ne le bloque pas",
    (await tenter(admin, { cible: "kossi", ip: "41.207.1.20", t })).resultat === "raté");
}

console.log("\n═══ 5. L'ARROSAGE EST ARRÊTÉ ═══");
{
  const admin = carnet();
  const t = new Date("2026-08-24T10:00:00Z");
  // Un seul mot de passe très courant, essayé sur 30 noms différents :
  // l'ancien compteur ne voyait jamais 5 échecs sur un même nom.
  for (let i = 0; i < 30; i++) await tenter(admin, { cible: `employe${i}`, ip: "198.51.100.7", t });
  const suite = await tenter(admin, { cible: "employe99", ip: "198.51.100.7", t });
  test("★ après 30 noms essayés, l'appareil est fermé quel que soit le nom suivant",
    suite.resultat === "refusé" && suite.minutes === 15);
  test("★ …et un autre appareil n'est pas puni pour autant",
    (await tenter(admin, { cible: "employe99", ip: "41.207.1.20", t })).resultat === "raté");
  test("la table ne peut plus gonfler : aucune ligne nouvelle depuis un appareil fermé",
    !admin.lignes.has("recherche:a:198.51.100.7|employe99"));
}

console.log("\n═══ 6. Le filet, quand le voleur change d'adresse à chaque essai ═══");
{
  const admin = carnet();
  const t = new Date("2026-08-24T10:00:00Z");
  for (let i = 0; i < 60; i++) await tenter(admin, { cible: "admin", ip: `100.64.0.${i}`, t });
  const encore = await tenter(admin, { cible: "admin", ip: "100.64.1.1", t });
  test("★ 60 essais depuis 60 adresses : le compte se protège quand même",
    encore.resultat === "refusé" && encore.minutes === 10);
  test("…et un compte voisin reste joignable (ce n'est pas une panne générale)",
    (await tenter(admin, { cible: "afi", ip: "100.64.1.1", t, bon: true })).resultat === "entré");
}

console.log("\n═══ 7. Ce qu'une connexion réussie efface, et ce qu'elle n'efface pas ═══");
{
  const admin = carnet();
  const t = new Date("2026-08-24T10:00:00Z");
  for (let i = 0; i < 3; i++) await tenter(admin, { cible: "kossi", ip: "41.207.1.20", t });
  await tenter(admin, { cible: "kossi", ip: "41.207.1.20", t, bon: true });
  test("le compteur de cet appareil sur ce compte repart de zéro",
    admin.lignes.get("recherche:a:41.207.1.20|kossi").echecs === 0);
  test("le filet du compte aussi", admin.lignes.get("recherche:c:kossi").echecs === 0);
  // ⚠ Sinon, dans un bureau où tout le monde partage la même connexion, il
  // suffirait qu'un employé se connecte pour effacer un arrosage en cours.
  test("★ mais le compteur de l'appareil, LUI, garde la mémoire",
    admin.lignes.get("recherche:b:41.207.1.20").echecs === 3);
}

console.log("\n═══ 8. Les compteurs des deux fonctions ne se mélangent pas ═══");
{
  const admin = carnet();
  const t = new Date("2026-08-24T10:00:00Z");
  for (let i = 0; i < 25; i++) await tenter(admin, { prefixe: "recherche", cible: "u_12", ip: "5.5.5.5", t });
  test("un compte bloqué en recherche n'est pas bloqué en synchronisation",
    (await tenter(admin, { prefixe: "auth", cible: "u_12", ip: "5.5.5.5", t, bon: true })).resultat === "entré");
  test("les clés portent bien le nom de leur fonction",
    clesDeControle("auth", "u_12", "5.5.5.5")[0].cle.startsWith("auth:"));
}

console.log("\n═══ 9. D'où vient l'adresse de l'appelant ═══");
{
  test("Vercel la donne dans x-real-ip",
    adresseAppelant({ headers: { "x-real-ip": "41.207.1.20" } }) === "41.207.1.20");
  test("sinon on prend le premier de la liste x-forwarded-for",
    adresseAppelant({ headers: { "x-forwarded-for": "41.207.1.20, 10.0.0.1" } }) === "41.207.1.20");
  // ⚠ Sans adresse, tous les appels partagent le même compteur : c'est
  // volontairement prudent — jamais une porte ouverte.
  test("sans rien, on ne renvoie jamais vide", adresseAppelant({ headers: {} }) === "inconnu");
  test("une requête sans en-têtes du tout ne fait pas planter",
    adresseAppelant(undefined) === "inconnu");
}

console.log("\n═══ 10. La restriction d'origine ═══");
{
  const liste = ["https://gestion.bmitogo.com", "https://bmitogo.com"];
  test("★ l'application web ne peut PAS être coupée : même adresse = autorisé",
    origineAutorisee("https://un-essai-quelconque.vercel.app", "un-essai-quelconque.vercel.app", liste)
      === "https://un-essai-quelconque.vercel.app");
  test("le domaine de production est autorisé",
    origineAutorisee("https://gestion.bmitogo.com", "autre-hote", liste) === "https://gestion.bmitogo.com");
  test("★ un site inconnu est refusé",
    origineAutorisee("https://site-hostile.com", "gestion.bmitogo.com", liste) === null);
  // Le piège classique : un domaine qui COMMENCE comme le vôtre.
  test("★ un domaine qui imite le vôtre est refusé",
    origineAutorisee("https://gestion.bmitogo.com.site-hostile.com", "gestion.bmitogo.com", liste) === null);
  test("l'application Windows (aucune origine) passe",
    origineAutorisee("", "gestion.bmitogo.com", liste) === "*");
  test("…y compris quand elle annonce « null »",
    origineAutorisee("null", "gestion.bmitogo.com", liste) === "*");
  test("une origine mal formée est refusée sans planter",
    origineAutorisee("pas-une-adresse", "gestion.bmitogo.com", liste) === null);
  test("★ le retour arrière « * » redonne exactement le comportement d'avant",
    origineAutorisee("https://site-hostile.com", "gestion.bmitogo.com", ["*"]) === "*");
  test("http et https du même hôte ne sont pas confondus avec la liste",
    origineAutorisee("http://gestion.bmitogo.com", "autre-hote", liste) === null);
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
