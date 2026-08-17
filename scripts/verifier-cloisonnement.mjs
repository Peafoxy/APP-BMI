// ============================================================
// scripts/verifier-cloisonnement.mjs — Vérification exécutable du
// cloisonnement formation / réel.
//
// Rejoue, sur une base fabriquée pour l'occasion, les scénarios exacts
// qui posaient problème avant le correctif. Chacun décrit une situation
// réelle, pas un cas de laboratoire : c'est la liste de ce qui doit
// rester vrai après n'importe quelle modification future de l'app.
//
//   node scripts/verifier-cloisonnement.mjs
//
// (Aucune dépendance de test : le fichier est bundlé à la volée par
// esbuild, déjà présent puisque Vite s'en sert.)
// ============================================================
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { unlinkSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// lib/calculs.js importe les boîtes de dialogue (JSX + React) : on bundle
// plutôt que d'importer directement, pour n'avoir rien à simuler à la main.
// Le bundle est écrit DANS le projet : posé ailleurs, il ne retrouverait
// pas node_modules et l'import de React échouerait.
const sortie = join("node_modules", ".cache", `bmi-cloisonnement-${process.pid}.mjs`);
mkdirSync(join("node_modules", ".cache"), { recursive: true });
await build({
  entryPoints: ["src/lib/calculs.js"],
  bundle: true, format: "esm", platform: "node", outfile: sortie,
  logLevel: "silent", loader: { ".js": "jsx" }, external: ["react", "react-dom"],
});
const C = await import(pathToFileURL(sortie).href);
unlinkSync(sortie);

const sortieCore = join("node_modules", ".cache", `bmi-core-${process.pid}.mjs`);
await build({
  entryPoints: ["src/lib/core.js"],
  bundle: true, format: "esm", platform: "node", outfile: sortieCore,
  logLevel: "silent", loader: { ".js": "jsx" },
});
const Core = await import(pathToFileURL(sortieCore).href);
unlinkSync(sortieCore);

// lib/cnss.js importe la bibliothèque Excel (xlsx), qui ne s'initialise pas
// hors navigateur. On la remplace par un bouchon vide : les fonctions
// vérifiées ici (comparaison d'une saisie) n'y touchent pas.
const bouchonXlsx = join("node_modules", ".cache", `bmi-xlsx-stub-${process.pid}.js`);
writeFileSync(bouchonXlsx, "export const utils = {}; export const writeFile = () => {};\n");
const sortieCnss = join("node_modules", ".cache", `bmi-cnss-${process.pid}.mjs`);
await build({ entryPoints: ["src/lib/cnss.js"], bundle: true, format: "esm", platform: "node",
  outfile: sortieCnss, logLevel: "silent", loader: { ".js": "jsx" },
  alias: { xlsx: "./" + bouchonXlsx } });
const Cnss = await import(pathToFileURL(sortieCnss).href);
unlinkSync(sortieCnss);
unlinkSync(bouchonXlsx);

// Le socle partage du Dimensionnement (trois volets) : conditions
// commerciales d'un devis repris, et quantite necessaire d'un equipement.
const sortieDim = join("node_modules", ".cache", `bmi-dim-${process.pid}.mjs`);
await build({ entryPoints: ["src/screens/dimensionnement/Partages.jsx"], bundle: true,
  format: "esm", platform: "node", outfile: sortieDim, logLevel: "silent",
  loader: { ".js": "jsx" }, external: ["react", "react-dom"] });
const Dim = await import(pathToFileURL(sortieDim).href);
unlinkSync(sortieDim);

// ---- Base d'essai : deux boutiques réelles, une de formation, un dépôt
// de chaque côté, et les quatre profils qui comptent.
const base = () => ({
  boutiques: [
    { id: "b1", nom: "APESSITO" },
    { id: "b2", nom: "HEDZRANAWOE" },
    { id: "b3", nom: "APESSITO FORMATION", formation: true },
    { id: "d1", nom: "DEPOT", depot: true },
    { id: "d2", nom: "DEPOT FORMATION", depot: true, formation: true },
    { id: "bt", nom: "TERRAIN", terrain: true },
  ],
  users: [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_admin2", nom: "ADMIN2", role: "admin", droits_off: ["act_voir_tout"] },
    { id: "u_vend", nom: "KOSSI", role: "vendeur", boutique: "APESSITO" },
    { id: "u_form", nom: "STAGIAIRE", role: "vendeur", boutique: "APESSITO FORMATION", formation: true },
    { id: "u_cli", nom: "CLIENT.REEL", role: "client" },
    { id: "u_cliF", nom: "CLIENT.FORM", role: "client", formation: true },
  ],
  ventes: [{ id: "v1", boutique: "APESSITO", date: "2026-08-01" }],
  depenses: [], dettes: [], produits: [], ajustements: [], clotures: [],
  commandes: [], proformas: [], clients_installes: [],
});

const P = {
  admin: { id: "u_admin", role: "admin" },
  admin2: { id: "u_admin2", role: "admin" },
  vendeur: { id: "u_vend", role: "vendeur", boutique: "APESSITO" },
  stagiaire: { id: "u_form", role: "vendeur", boutique: "APESSITO FORMATION" },
};

let ok = 0, ko = 0;
const test = (nom, condition) => {
  if (condition) { ok++; console.log(`  ✓ ${nom}`); }
  else { ko++; console.log(`  ✗ ${nom}`); }
};
const titre = (t) => console.log(`\n${t}`);

// Petit raccourci : l'écriture `modif` appliquée à la base est-elle refusée ?
const refuse = (profil, modif) => {
  const avant = base();
  const apres = { ...avant, ...modif(avant) };
  return C.verifierEcritureEspace(avant, apres, profil) !== null;
};

titre("Le verrou d'écriture refuse ce qui traverse la frontière");
test("un stagiaire ne peut pas encaisser dans une vraie boutique",
  refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v2", boutique: "APESSITO" }] })));
test("un stagiaire ne peut pas créer une dépense dans une vraie boutique",
  refuse(P.stagiaire, (db) => ({ depenses: [{ id: "d1", boutique: "HEDZRANAWOE", montant: 5000 }] })));
test("un stagiaire ne peut pas débiter la caisse du comptable",
  refuse(P.stagiaire, (db) => ({ depenses: [{ id: "d2", boutique: "Chez le comptable", montant: 5000 }] })));
test("un stagiaire ne peut pas encaisser sur la caisse TERRAIN",
  refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v3", boutique: "TERRAIN" }] })));
test("un stagiaire ne peut pas sortir du stock d'un vrai dépôt",
  refuse(P.stagiaire, (db) => ({ ajustements: [{ id: "a1", boutique: "DEPOT", qte: -5 }] })));
test("un stagiaire ne peut pas supprimer une vraie vente",
  refuse(P.stagiaire, () => ({ ventes: [] })));
test("un stagiaire ne peut pas clôturer une vraie caisse",
  refuse(P.stagiaire, () => ({ clotures: [{ id: "c1", boutique: "APESSITO", date: "2026-08-16" }] })));
test("un vendeur réel ne peut pas écrire dans une boutique de formation",
  refuse(P.vendeur, (db) => ({ ventes: [...db.ventes, { id: "v4", boutique: "APESSITO FORMATION" }] })));
test("un admin SANS le pouvoir act_voir_tout est cloisonné comme les autres",
  refuse(P.admin2, (db) => ({ ventes: [...db.ventes, { id: "v5", boutique: "APESSITO FORMATION" }] })));

titre("…et laisse passer tout le travail normal");
test("un stagiaire encaisse dans SA boutique de formation",
  !refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes, { id: "v6", boutique: "APESSITO FORMATION" }] })));
test("un vendeur réel encaisse dans SA boutique",
  !refuse(P.vendeur, (db) => ({ ventes: [...db.ventes, { id: "v7", boutique: "APESSITO" }] })));
test("l'admin principal traverse les deux espaces (réinitialisation)",
  !refuse(P.admin, () => ({ ventes: [] })));
test("une écriture sans boutique (message, tâche) passe toujours",
  !refuse(P.stagiaire, (db) => ({ ventes: [...db.ventes] })));
test("une ligne inchangée n'est jamais comptée comme une écriture",
  !refuse(P.stagiaire, (db) => ({ ventes: db.ventes.slice() })));

titre("Les sélecteurs ne montrent que l'espace du compte");
{
  const db = base();
  const noms = (p) => C.boutiquesVisibles(db, p, db.boutiques).map((b) => b.nom);
  test("le stagiaire ne voit aucune vraie boutique",
    !noms(P.stagiaire).some((n) => ["APESSITO", "HEDZRANAWOE", "DEPOT"].includes(n)));
  test("le vendeur réel ne voit aucune boutique de formation",
    !noms(P.vendeur).some((n) => n.includes("FORMATION")));
  test("l'admin principal voit tout", noms(P.admin).length === db.boutiques.length);
  test("boutiqueParDefaut ne retombe jamais sur une boutique d'un autre espace",
    C.boutiqueParDefaut(db, P.stagiaire) === "APESSITO FORMATION");
  test("boutiqueParDefaut renvoie \"\" plutôt qu'une vraie boutique quand l'espace est vide", (() => {
    const sansFormation = { ...db, boutiques: db.boutiques.filter((b) => !b.formation) };
    return C.boutiqueParDefaut(sansFormation, P.stagiaire) === "";
  })());
}

titre("L'espace du compte est lu en direct, pas dans le profil figé");
{
  const db = base();
  // Profil capturé À LA CONNEXION, avant que l'admin ne bascule le compte.
  // La bascule corrigée déplace AUSSI le rattachement (basculerFormation) :
  // c'est ce que reproduit `apresBascule`.
  const profilFige = { id: "u_vend", role: "vendeur", boutique: "APESSITO" };
  const apresBascule = { ...db, users: db.users.map((u) => (u.id === "u_vend"
    ? { ...u, formation: true, boutique: "APESSITO FORMATION", boutique_avant_espace: "APESSITO" }
    : u)) };
  test("la bascule prend effet immédiatement, sans reconnexion",
    C.estCompteFormation(apresBascule, profilFige) === true);
  test("le profil figé n'est jamais consulté pour l'espace",
    C.estCompteFormation(apresBascule, { id: "u_vend" }) === true);
  // Un compte sans boutique (admin, commercial…) : le drapeau fait foi.
  const admin2Bascule = { ...db, users: db.users.map((u) => (u.id === "u_admin2" ? { ...u, formation: true } : u)) };
  test("pour un compte sans boutique, le drapeau seul décide",
    C.estCompteFormation(admin2Bascule, { id: "u_admin2", role: "admin" }) === true);
}

titre("Les totaux et les exports excluent la formation");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", articles: [{ qte: 1, pu: 1000 }] },
             { id: "v2", boutique: "APESSITO FORMATION", articles: [{ qte: 1, pu: 999999 }] }],
    depenses: [{ id: "d1", boutique: "APESSITO", montant: 100, date: "2026-08-01", categorie: "Autre" },
               { id: "d2", boutique: "APESSITO FORMATION", montant: 888888, date: "2026-08-01", categorie: "Autre" }],
    dettes: [{ id: "t1", boutique: "APESSITO" }, { id: "t2", boutique: "APESSITO FORMATION" }],
    produits: [{ id: "p1", boutique: "APESSITO" }, { id: "p2", boutique: "APESSITO FORMATION" }],
  };
  test("ventesReelles exclut les ventes de formation", C.ventesReelles(db).length === 1);
  test("depensesReelles exclut les dépenses de formation", C.depensesReelles(db).length === 1);
  test("dettesReelles exclut les dettes de formation", C.dettesReelles(db).length === 1);
  test("produitsReels exclut le stock de formation", C.produitsReels(db).length === 1);
}

titre("Devis, clients et prospects portent la marque de leur espace");
{
  const db = base();
  test("un enregistrement créé par un stagiaire est marqué formation",
    C.marqueEspace(db, P.stagiaire).formation === true);
  test("un enregistrement créé par un compte réel ne porte aucune marque",
    C.marqueEspace(db, P.vendeur).formation === undefined);
  test("espaceDuCompte vaut undefined pour l'admin principal (il voit tout)",
    C.espaceDuCompte(db, P.admin) === undefined);
  test("espaceDuCompte vaut true pour un stagiaire", C.espaceDuCompte(db, P.stagiaire) === true);
  test("espaceDuCompte vaut false pour un compte réel", C.espaceDuCompte(db, P.vendeur) === false);

  const devis = [{ id: "q1" }, { id: "q2", formation: true }];
  const avecDevis = { ...db, users: db.users.map((u) => (u.id === "u_cli" ? { ...u, devis: devis.map((d) => ({ ...d, contrat_signature: "x" })) } : u)) };
  test("les contrats de formation sont invisibles pour un compte réel",
    C.contratsInstallation(avecDevis, { espace: false }).length === 1);
  test("les contrats réels sont invisibles pour un stagiaire",
    C.contratsInstallation(avecDevis, { espace: true }).length === 1);
  test("l'admin principal voit les deux",
    C.contratsInstallation(avecDevis, {}).length === 2);
}

titre("Les séries de numéros ne se mélangent plus");
{
  // « APESSITO » et « APESSITO FORMATION » donnent le même préfixe à trois
  // lettres : c'est exactement le cas qui faisait partager une série.
  const db = { ...base(), ventes: [{ id: "v1", boutique: "APESSITO", numero: "APE-2026-0001", date: "2026-08-01" }] };
  const nReel = Core.prochainNumeroVente(db, "APESSITO", "2026-08-16");
  const nForm = Core.prochainNumeroVente(db, "APESSITO FORMATION", "2026-08-16");
  test("le prochain reçu réel suit bien la série réelle", nReel === "APE-2026-0002");
  test("le reçu de formation part sur sa PROPRE série", nForm === "FOR-APE-2026-0001");
  test("les deux séries ne peuvent pas se télescoper", nReel !== nForm);
  const dReel = Core.prochainNumeroDette(db, "APESSITO", "2026-08-16");
  const dForm = Core.prochainNumeroDette(db, "APESSITO FORMATION", "2026-08-16");
  test("même séparation pour les dettes et réservations",
    dReel === "APE-DET-2026-0001" && dForm === "FOR-APE-DET-2026-0001");
}

titre("Le journal comptable remis au comptable est propre");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", date: "2026-08-01", paiement: "Espèces", articles: [{ qte: 1, pu: 1000, article: "X" }] },
             { id: "v2", boutique: "APESSITO FORMATION", date: "2026-08-01", paiement: "Espèces", articles: [{ qte: 1, pu: 999999, article: "Y" }] }],
    depenses: [{ id: "d2", boutique: "APESSITO FORMATION", montant: 888888, date: "2026-08-01", categorie: "Autre", paiement: "Espèces" }],
    dettes: [],
  };
  const lignes = Core.lignesJournal(db, "2026-08-01", "2026-08-31");
  const texte = JSON.stringify(lignes);
  test("aucune écriture de formation dans le journal SYSCOHADA",
    !texte.includes("999999") && !texte.includes("888888"));
  test("les écritures réelles y sont toujours", texte.includes("APESSITO") && lignes.length === 2);
}

titre("Comptes hérités de la 2.100.24 : la boutique fait foi, personne n'est bloqué");
{
  // Le cas exact laissé par « passer tous les comptes en formation d'un
  // coup » avant le correctif : drapeau posé, rattachement inchangé.
  const db = base();
  db.users = db.users.map((u) => (u.id === "u_vend" ? { ...u, formation: true } : u));
  const profil = { id: "u_vend", role: "vendeur", boutique: "APESSITO" };
  test("un vendeur marqué formation mais resté dans sa VRAIE boutique est traité comme réel",
    C.estCompteFormation(db, profil) === false);
  test("…et il peut donc continuer d'encaisser normalement", (() => {
    const apres = { ...db, ventes: [...db.ventes, { id: "vN", boutique: "APESSITO" }] };
    return C.verifierEcritureEspace(db, apres, profil) === null;
  })());
  test("l'administrateur est averti de l'incohérence",
    C.comptesEspaceIncoherent(db).some((u) => u.id === "u_vend"));
  test("aucune alerte quand drapeau et boutique concordent",
    C.comptesEspaceIncoherent(base()).length === 0);
}


titre("Les autres administrateurs ne doivent pas traverser sans qu'on le sache");
{
  const db = base();
  // ADMIN2 porte deja act_voir_tout dans droits_off (cf. base) : il est
  // cloisonne. On ajoute un admin cree AVANT ce reglage, donc sans rien
  // dans droits_off — c'est le cas reel d'une installation existante.
  db.users = [...db.users, { id: "u_admin3", nom: "ELIE", role: "admin" }];
  const elie = { id: "u_admin3", role: "admin" };
  test("un admin créé avant le réglage traverse les deux espaces",
    C.voitLesDeuxEspaces(db, elie) === true);
  test("…et il est signalé à l'administrateur principal",
    C.adminsVoyantLesDeuxEspaces(db).some((u) => u.id === "u_admin3"));
  test("l'admin principal n'est jamais compté dans cette alerte",
    !C.adminsVoyantLesDeuxEspaces(db).some((u) => u.id === "u_admin"));
  test("un admin à qui on a retiré le pouvoir est bien cloisonné", (() => {
    const apres = { ...db, users: db.users.map((u) => (u.id === "u_admin3"
      ? { ...u, droits_off: ["act_voir_tout"] } : u)) };
    return C.voitLesDeuxEspaces(apres, elie) === false
      && C.adminsVoyantLesDeuxEspaces(apres).length === 0;
  })());
}


titre("La boutique mémorisée par un écran ne peut ni rester vide, ni pointer sur un fantôme");
{
  const db = base();
  test("écran ouvert pendant la synchronisation (mémoire vide) : on repart du défaut",
    C.boutiqueRetenue(db, P.vendeur === undefined ? P.admin : P.admin, "") === "APESSITO");
  test("boutique supprimée depuis (réinitialisation, suppression) : on repart du défaut",
    C.boutiqueRetenue(db, P.admin, "BOUTIQUE QUI N EXISTE PLUS") === "APESSITO");
  test("boutique valide : elle est conservée",
    C.boutiqueRetenue(db, P.admin, "HEDZRANAWOE") === "HEDZRANAWOE");
  test("un stagiaire ne peut pas retenir une VRAIE boutique memorisee",
    C.boutiqueRetenue(db, P.stagiaire, "APESSITO") === "APESSITO FORMATION");
  test("un compte rattaché garde toujours SA boutique",
    C.boutiqueRetenue(db, P.vendeur, "HEDZRANAWOE") === "APESSITO");
  test("base entièrement vide (après réinitialisation) : rien, et l'écran le dira",
    C.boutiqueRetenue({ boutiques: [], users: [] }, P.admin, "APESSITO") === "");
}


titre("Les écrans de synthèse ne montrent jamais les vrais chiffres à un compte de formation");
{
  const db = {
    ...base(),
    ventes: [{ id: "v1", boutique: "APESSITO", articles: [{ qte: 1, pu: 1000 }] },
             { id: "v2", boutique: "APESSITO FORMATION", articles: [{ qte: 1, pu: 7 }] }],
    depenses: [{ id: "e1", boutique: "APESSITO", montant: 100 },
               { id: "e2", boutique: "APESSITO FORMATION", montant: 1 }],
  };
  const vus = (p, table) => db[table].filter(C.filtreEspaceAffichage(db, p)).map((x) => x.id);

  test("un compte de formation ne voit QUE ses ventes",
    JSON.stringify(vus(P.stagiaire, "ventes")) === JSON.stringify(["v2"]));
  test("…et QUE ses dépenses",
    JSON.stringify(vus(P.stagiaire, "depenses")) === JSON.stringify(["e2"]));
  test("un compte réel voit les vrais chiffres",
    JSON.stringify(vus(P.vendeur, "ventes")) === JSON.stringify(["v1"]));
  test("l'admin principal voit les vrais chiffres (c'est la vue attendue)",
    JSON.stringify(vus(P.admin, "ventes")) === JSON.stringify(["v1"]));
  test("le bandeau « chiffres de formation » ne s'affiche que pour eux",
    C.afficheChiffresFormation(db, P.stagiaire) === true
    && C.afficheChiffresFormation(db, P.vendeur) === false
    && C.afficheChiffresFormation(db, P.admin) === false);

  // ⚠ Le cas exact de la capture : un ADMIN marqué formation, mais qui
  // garde le pouvoir « voir les deux espaces » accordé par defaut.
  // (u_admin2 de la base a DEJA act_voir_tout retire : on ajoute un admin
  // cree avant ce reglage, comme HEZOU/NOE/RENE sur l'installation reelle.)
  const dbAdminForm = { ...db, users: [...db.users, { id: "u_hezou", nom: "HEZOU", role: "admin", formation: true }] };
  const adminForm = { id: "u_hezou", role: "admin" };
  test("un admin marqué formation qui garde act_voir_tout voit encore tout",
    C.voitLesDeuxEspaces(dbAdminForm, adminForm) === true);
  test("…et une fois le pouvoir retiré, son drapeau prend enfin effet", (() => {
    const apres = { ...dbAdminForm, users: dbAdminForm.users.map((u) => (u.id === "u_hezou"
      ? { ...u, droits_off: ["act_voir_tout"] } : u)) };
    return C.afficheChiffresFormation(apres, adminForm) === true
      && apres.ventes.filter(C.filtreEspaceAffichage(apres, adminForm)).length === 1;
  })());
}


titre("Saisie CNSS : le formulaire tape du TEXTE, l'enregistrement stocke des NOMBRES");
{
  // Le cas exact signale par Timo : apres un enregistrement reussi, le
  // paiement CNSS restait bloque sur "non enregistre".
  const tape       = { assujetti: true, matricule: "", numeroAssurance: "A1", codeType: "1", dateEmbauche: "2020-01-01", dateSortie: "", codeMotifSortie: "", jours: "0", nature: "1" };
  const enregistre = { assujetti: true, matricule: "", numeroAssurance: "A1", codeType: 1,   dateEmbauche: "2020-01-01", dateSortie: "", codeMotifSortie: "", jours: 0,   nature: 1 };
  test("« 0 » tapé et 0 enregistré sont reconnus identiques",
    Cnss.memeSaisieCNSS(tape, enregistre) === true);
  test("26 jours tapés et 26 enregistrés : identiques",
    Cnss.memeSaisieCNSS({ ...tape, jours: "26" }, { ...enregistre, jours: 26 }) === true);
  test("une vraie modification est toujours détectée",
    Cnss.memeSaisieCNSS({ ...tape, jours: "26" }, enregistre) === false);
  test("cocher « assujetti » est détecté",
    Cnss.memeSaisieCNSS({ ...tape, assujetti: false }, enregistre) === false);
  test("un espace en trop dans le n° d'assurance ne compte pas pour une modification",
    Cnss.memeSaisieCNSS({ ...tape, numeroAssurance: " A1 " }, enregistre) === true);
  test("changer le n° d'assurance est détecté",
    Cnss.memeSaisieCNSS({ ...tape, numeroAssurance: "A2" }, enregistre) === false);
}



titre("Commissions : une vente GELÉE (installation non réceptionnée) ne doit jamais être tamponnée « payée »");
{
  // Le defaut : le MONTANT ecartait bien les ventes gelees, mais la liste
  // tamponnee "commission payee" les emportait quand meme. A la reception, la
  // commission se debloquait sur une vente deja close -> perdue pour toujours.
  const vNormale = { id: "v1", articles: [{ qte: 1, pu: 1000000 }] };
  const vGelee   = { id: "v2", articles: [{ qte: 1, pu: 2000000 }], commission_a_la_reception: true };
  const r = C.repartirCommissions([vNormale, vGelee], 5);

  test("la vente gelée n'est PAS dans la liste à tamponner",
    r.idsAPayer.length === 1 && r.idsAPayer[0] === "v1");
  test("le montant payé ne compte que la vente exigible",
    r.du === 50000);
  test("la commission gelée est affichée à part, pas perdue de vue",
    r.gele === 100000 && r.gelees.length === 1);
  test("le montant affiché et la liste tamponnée portent sur EXACTEMENT les mêmes ventes",
    r.du === r.idsAPayer.reduce((s, id) => s + C.commissionVente([vNormale, vGelee].find((v) => v.id === id), 5), 0));

  // Le scenario complet, bout en bout : on paie, PUIS le client receptionne.
  const apresPaiement = [vNormale, vGelee].map((v) => (r.idsAPayer.includes(v.id)
    ? { ...v, commission_payee: true, commission_montant: C.commissionVente(v, 5) } : v));
  const apresReception = apresPaiement.map((v) => (v.id === "v2"
    ? { ...v, commission_a_la_reception: false } : v));
  const r2 = C.repartirCommissions(apresReception.filter((v) => !v.commission_payee), 5);
  test("après réception, la commission gelée redevient bien DUE (elle était perdue avant)",
    r2.du === 100000 && r2.idsAPayer.length === 1 && r2.idsAPayer[0] === "v2");

  // Le rabais offert par le commercial reste bien deduit de SA commission.
  const vRabais = { id: "v3", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000 };
  test("le rabais offert par le commercial reste déduit de sa commission",
    C.repartirCommissions([vRabais], 5).du === 31000);
}


titre("Commissions d'équipe : même règle pour la part du chef");
{
  const tauxFilleul = 5, tauxChef = 10;
  const vNormale = { id: "v1", articles: [{ qte: 1, pu: 1000000 }] };
  const vGelee   = { id: "v2", articles: [{ qte: 1, pu: 2000000 }], commission_a_la_reception: true };
  const vPayee   = { id: "v3", articles: [{ qte: 1, pu: 1000000 }], override_payee: true, override_montant: 4200 };
  const r = C.repartirCommissionEquipe([vNormale, vGelee, vPayee], tauxFilleul, tauxChef);

  test("le chef ne fait tamponner que la vente exigible",
    r.idsAPayer.length === 1 && r.idsAPayer[0] === "v1");
  test("sa part due est bien 10 % de la commission de sa recrue",
    r.due === 5000);
  test("sa part sur la vente gelée est signalée, pas encaissée",
    r.gelee === 10000);
  test("« déjà payé » relit le montant réellement versé (4 200), pas une reconstitution",
    r.versees === 4200);
  test("le montant inscrit sur chaque vente correspond à ce qui est payé",
    r.partParVente.v1 === 5000 && r.partParVente.v2 === undefined);
}


titre("« Déjà payé » : un montant relu, pas recalculé avec le taux du jour");
{
  const vente = { id: "v1", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000, commission_payee: true, commission_montant: 31000 };
  test("le montant versé est relu tel quel",
    C.montantVerse(vente, 5) === 31000);
  test("…et ne bouge PAS quand on change le taux du commercial après coup",
    C.montantVerse(vente, 20) === 31000);
  test("un paiement ancien (sans montant inscrit) retombe sur la formule complète, rabais déduit",
    C.montantVerse({ id: "v2", articles: [{ qte: 1, pu: 1000000 }], rabais: 20000 }, 5) === 31000);
}


titre("Mon équipe : un compte de formation n'y lit plus les vrais chiffres");
{
  // Reproduit la logique exacte de l'ecran (les memes fonctions partagees).
  const base = {
    boutiques: [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }],
    users: [
      { id: "u_timo", nom: "TIMO", role: "admin", admin_principal: true },
      { id: "u_vrai", nom: "KOFFI", role: "commercial", taux_commission: 5 },
      { id: "u_form", nom: "DODO", role: "commercial", taux_commission: 5, formation: true, chef_equipe: true },
    ],
    ventes: [
      { id: "v_reel", boutique: "LOME",  commercial: "KOFFI", articles: [{ qte: 1, pu: 1000000 }] },
      { id: "v_form", boutique: "ECOLE", commercial: "DODO",  articles: [{ qte: 1, pu: 7000 }] },
    ],
  };
  const db = { ...base, __index: C.construireIndexDb(base) };
  const timo = { id: "u_timo", role: "admin" };
  const dodo = { id: "u_form", role: "commercial" };

  // La regle de l'ecran : quelles ventes chacun lit pour un commercial donne.
  const ventesDe = (profile, nom) => {
    const cloisonne = C.estCompteFormation(db, profile) && !C.voitLesDeuxEspaces(db, profile);
    return cloisonne
      ? db.ventes.filter(C.filtreEspaceAffichage(db, profile)).filter((v) => v.commercial === nom)
      : C.ventesDuCommercial(db, nom);
  };
  const memeEspace = (profile, u) => C.voitLesDeuxEspaces(db, profile)
    || C.estCompteFormation(db, u) === C.estCompteFormation(db, profile);

  test("le compte de formation ne voit PLUS le vrai chiffre d'affaires du commercial",
    ventesDe(dodo, "KOFFI").length === 0);
  test("il voit ses propres ventes d'entraînement",
    ventesDe(dodo, "DODO").length === 1 && ventesDe(dodo, "DODO")[0].id === "v_form");
  test("le vrai commercial ne figure plus dans SA liste d'équipe",
    memeEspace(dodo, db.users[1]) === false);

  test("l'administrateur principal, lui, garde exactement la même vue qu'avant",
    ventesDe(timo, "KOFFI").length === 1 && ventesDe(timo, "KOFFI")[0].id === "v_reel");
  test("…et PERSONNE ne disparaît de sa liste — ni le vrai, ni celui de formation",
    memeEspace(timo, db.users[1]) === true && memeEspace(timo, db.users[2]) === true);
  test("les ventes d'entraînement ne gonflent jamais le chiffre réel",
    C.ventesDuCommercial(db, "DODO").length === 0);
}


titre("« Annuler paiement » : une annulation partielle est refusée, plus jamais faite à moitié");
{
  // Un reglement unique (dep D1) couvrant deux mois. On affiche « ce mois ».
  const ventes = [
    { id: "v_juin",   date: "2026-06-10", commission_payee: true, commission_dep: "D1" },
    { id: "v_juillet", date: "2026-07-10", commission_payee: true, commission_dep: "D1" },
  ];
  const debordement = (affichees) => {
    const ids = new Set(affichees.map((v) => v.id));
    const deps = new Set(affichees.map((v) => v.commission_dep).filter(Boolean));
    return ventes.filter((v) => v.commission_payee && v.commission_dep && deps.has(v.commission_dep) && !ids.has(v.id));
  };

  test("annuler depuis « ce mois » déborde sur juin : c'est refusé",
    debordement([ventes[1]]).length === 1 && debordement([ventes[1]])[0].id === "v_juin");
  test("annuler depuis « depuis le début » ne déborde pas : c'est accepté",
    debordement(ventes).length === 0);
  test("un règlement qui ne couvre qu'un seul mois s'annule normalement",
    debordement([{ id: "v_seule", date: "2026-07-10", commission_payee: true, commission_dep: "D2" }]).length === 0);
  test("une vente réglée SANS dépense rattachée est repérée (risque de double paiement)",
    [{ id: "v_x", commission_payee: true }].filter((v) => !v.commission_dep).length === 1);
}


titre("Le verrou regarde d'OÙ vient la ligne, pas seulement où elle va");
{
  // La faille exacte : un compte de formation prenait une ligne REELLE et la
  // faisait basculer dans son espace en reecrivant simplement sa boutique.
  // Chemin non theorique : l'encaissement d'une « pose seule » reecrit la
  // boutique de la dette a chaque versement.
  const boutiques = [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }];
  const users = [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_vend", nom: "DODO", role: "vendeur", boutique: "ECOLE" },
  ];
  const detteReelle = { id: "d1", boutique: "LOME", montant: 500000, paye: 0 };
  const vide = { ventes: [], depenses: [], produits: [], ajustements: [], clotures: [],
                 commandes: [], proformas: [], clients_installes: [] };
  const prev = { boutiques, users, dettes: [detteReelle], ...vide };
  const stagiaire = { id: "u_vend", role: "vendeur", boutique: "ECOLE" };
  const timo = { id: "u_admin", role: "admin" };

  test("modifier une vraie dette en la laissant sur sa boutique : toujours refusé",
    !!C.verifierEcritureEspace(prev, { ...prev, dettes: [{ ...detteReelle, paye: 100000 }] }, stagiaire));

  const deplacee = { ...prev, dettes: [{ ...detteReelle, boutique: "ECOLE", paye: 100000 }] };
  const inf = C.verifierEcritureEspace(prev, deplacee, stagiaire);
  test("faire BASCULER cette vraie dette dans l'espace formation : refusé (c'était la faille)",
    !!inf && inf.deplacement === true && inf.boutique === "LOME");
  test("le message explique qu'un enregistrement ne peut pas changer d'espace",
    C.messageEcritureRefusee(inf, true).includes("ne peut pas être déplacé"));

  test("le déplacement inverse (une ligne de formation vers le réel) est refusé aussi", (() => {
    const p = { boutiques, users, dettes: [{ id: "d2", boutique: "ECOLE", montant: 1000, paye: 0 }], ...vide };
    const reel = { id: "u_r", role: "vendeur", boutique: "LOME" };
    const p2 = { ...p, users: [...users, { id: "u_r", nom: "KOFFI", role: "vendeur", boutique: "LOME" }] };
    const n = { ...p2, dettes: [{ id: "d2", boutique: "LOME", montant: 1000, paye: 500 }] };
    return !!C.verifierEcritureEspace(p2, n, reel);
  })());

  test("l'administrateur principal, lui, peut toujours tout faire",
    C.verifierEcritureEspace(prev, deplacee, timo) === null);
  test("un encaissement normal, dans son propre espace, passe sans gêne", (() => {
    const p = { boutiques, users, dettes: [{ id: "d3", boutique: "ECOLE", montant: 1000, paye: 0 }], ...vide };
    const n = { ...p, dettes: [{ id: "d3", boutique: "ECOLE", montant: 1000, paye: 500 }] };
    return C.verifierEcritureEspace(p, n, stagiaire) === null;
  })());
}


titre("Prime d'installation : jamais payée deux fois");
{
  // Deux chemins mènent au paiement (l'admin depuis Clients installés, le
  // vendeur depuis Primes remises) et l'app fonctionne hors ligne.
  const part = { user_id: "u_tech", nom: "KOSSI", pct: 60, montant: 30000, chef: true,
                 demande_prime: true, prime_boutique: "LOME" };
  const chantier = { id: "ch1", nom: "AGBEKO", equipe: [part] };
  const db = { clients_installes: [chantier], depenses: [], users: [], boutiques: [{ nom: "LOME" }] };

  test("une part pas encore réglée est bien payable",
    C.primeDejaPayee(db, chantier, part) === false);

  // Quelqu'un d'autre a payé pendant qu'on remplissait la fenêtre.
  const apres = { ...db, clients_installes: [{ ...chantier,
    equipe: [{ ...part, paye: true, demande_prime: false, dep_id: "dep1" }] }] };
  test("si elle vient d'être payée ailleurs, le second paiement est refusé",
    C.primeDejaPayee(apres, chantier, part) === true);
  test("le contrôle relit la BASE, pas la ligne affichée à l'écran (qui dit encore « à payer »)",
    part.paye !== true && C.primeDejaPayee(apres, chantier, part) === true);
  test("les parts des autres techniciens du même chantier ne sont pas bloquées", (() => {
    const autre = { user_id: "u_tech2", nom: "AMA", montant: 20000, prime_boutique: "LOME" };
    const d = { ...db, clients_installes: [{ ...chantier, equipe: [{ ...part, paye: true }, autre] }] };
    return C.primeDejaPayee(d, chantier, autre) === false;
  })());
  test("un chantier introuvable ne fait pas passer le paiement en force",
    C.primeDejaPayee({ clients_installes: [] }, chantier, part) === false);
}


titre("Clients installés : les coordonnées des vrais clients restent dans l'espace réel");
{
  const boutiques = [{ nom: "LOME", formation: false }, { nom: "ECOLE", formation: true }];
  const users = [
    { id: "u_admin", nom: "TIMO", role: "admin", admin_principal: true },
    { id: "u_chef", nom: "DODO", role: "technicien", chef_equipe: true, formation: true },
    { id: "t_reel", nom: "KOSSI", role: "technicien" },
    { id: "t_form", nom: "STAGE", role: "technicien", formation: true },
  ];
  const db = {
    boutiques, users,
    ventes: [{ id: "v1", boutique: "LOME" }, { id: "v2", boutique: "ECOLE" }],
    dettes: [],
    clients_installes: [
      { id: "ch_reel", nom: "AGBEKO", tel: "+22890000000", adresse_contrat: "Rue 12, Lomé", vente_id: "v1" },
      { id: "ch_form", nom: "ESSAI", vente_id: "v2" },
      { id: "ch_sans", nom: "SANS RATTACHEMENT" },
    ],
  };
  const timo = { id: "u_admin", role: "admin" };
  const chefForm = { id: "u_chef", role: "technicien" };

  const vus = (p) => C.chantiersDeMonEspace(db, p).map((c) => c.id);
  test("un chef d'équipe de formation ne voit plus le chantier réel",
    !vus(chefForm).includes("ch_reel"));
  test("il voit le chantier d'entraînement",
    vus(chefForm).includes("ch_form"));
  test("un chantier sans vente ni dette n'est refusé à personne",
    vus(chefForm).includes("ch_sans") && vus(timo).includes("ch_sans"));
  test("l'administrateur principal garde les TROIS chantiers — rien ne disparaît",
    vus(timo).length === 3);

  // Techniciens proposés : c'est l'espace du CHANTIER qui decide.
  const tousTechs = users.filter((u) => u.role === "technicien");
  const proposes = (c, p) => C.techniciensDeLEspace(db, tousTechs, C.espaceDuChantier(db, c, p)).map((u) => u.nom);
  const chReel = db.clients_installes[0], chForm = db.clients_installes[1];
  test("sur un VRAI chantier, seul le vrai technicien est proposé — même à l'administrateur",
    proposes(chReel, timo).includes("KOSSI") && !proposes(chReel, timo).includes("STAGE"));
  test("sur un chantier d'entraînement, seul le technicien de formation est proposé",
    proposes(chForm, timo).includes("STAGE") && !proposes(chForm, timo).includes("KOSSI"));
  test("sur le formulaire de création (aucun chantier), c'est l'espace du compte connecté",
    C.espaceDuChantier(db, null, chefForm) === true && C.espaceDuChantier(db, null, timo) === false);
}


titre("Répartition des frais d'installation : la somme des parts ne dépasse jamais 100 %");
{
  // Reprise EXACTE de repartitionProposee (ClientsInstalles.jsx).
  const repartition = (ids, chefId, partChef) => {
    const n = ids.length;
    if (!n) return {};
    const reste = Math.max(0, 100 - Number(partChef || 0));
    const partEgale = Math.round((reste / n) * 10) / 10;
    const r = {};
    let distribue = 0;
    ids.forEach((id) => { if (id === chefId) return; r[id] = partEgale; distribue += partEgale; });
    const chef = ids.includes(chefId) ? chefId : ids[0];
    r[chef] = Math.round((100 - distribue) * 100) / 100;
    return r;
  };
  const total = (r) => Math.round(Object.values(r).reduce((s, v) => s + v, 0) * 100) / 100;
  const ids = (n) => Array.from({ length: n }, (_, i) => `t${i}`);

  let pire = 0;
  for (let n = 1; n <= 12; n++) {
    for (const pc of [0, 10, 25, 33, 40, 50, 60, 75, 100]) {
      pire = Math.max(pire, Math.abs(100 - total(repartition(ids(n), "t0", pc))));
    }
  }
  test("de 1 à 12 techniciens et pour tous les taux de chef : le total fait toujours 100 %",
    pire === 0);
  test("le cas qui débordait — 7 techniciens, chef à 40 % — fait bien 100 % (c'était 100,2)",
    total(repartition(ids(7), "t0", 40)) === 100);
  test("9 techniciens : 100 % aussi (c'était 100,3)",
    total(repartition(ids(9), "t0", 40)) === 100);
  test("le chef reçoit toujours la part la plus forte", (() => {
    const r = repartition(ids(7), "t0", 40);
    return r.t0 === Math.max(...Object.values(r));
  })());
  test("un seul technicien prend 100 %",
    total(repartition(ids(1), "t0", 40)) === 100 && repartition(ids(1), "t0", 40).t0 === 100);
}


titre("Une demande de prime en attente n'est plus effacée en silence");
{
  // Reprise de la logique de validerRepartition (ClientsInstalles.jsx).
  const rejouer = (equipeAvant, idsApres, pcts, frais) => {
    const annulees = [];
    const equipe = idsApres.map((id) => {
      const montant = Math.round((frais * Number(pcts[id] || 0)) / 100);
      const ancien = equipeAvant.find((e) => e.user_id === id);
      const base = { user_id: id, montant, paye: false };
      if (ancien?.demande_prime && Number(ancien.montant || 0) === montant) {
        return { ...base, demande_prime: true, prime_boutique: ancien.prime_boutique };
      }
      if (ancien?.demande_prime) annulees.push(ancien);
      return base;
    });
    equipeAvant.forEach((e) => { if (e.demande_prime && !idsApres.includes(e.user_id)) annulees.push(e); });
    return { equipe, annulees };
  };

  const avant = [
    { user_id: "a", nom: "KOSSI", montant: 60000, demande_prime: true, prime_boutique: "LOME" },
    { user_id: "b", nom: "AMA", montant: 40000, demande_prime: true, prime_boutique: "LOME" },
  ];
  // Meme repartition rejouee : les deux demandes doivent SURVIVRE.
  const r1 = rejouer(avant, ["a", "b"], { a: 60, b: 40 }, 100000);
  test("une répartition rejouée à l'identique conserve les demandes en attente",
    r1.annulees.length === 0 && r1.equipe.every((e) => e.demande_prime === true));

  // Le montant de KOSSI change : sa demande devient caduque, celle d'AMA non.
  const r2 = rejouer(avant, ["a", "b"], { a: 50, b: 40 }, 100000);
  test("une demande dont le montant a changé est annulée, et signalée",
    r2.annulees.length === 1 && r2.annulees[0].user_id === "a");
  test("…tandis que celle dont le montant n'a pas bougé est conservée",
    r2.equipe.find((e) => e.user_id === "b").demande_prime === true);

  // AMA quitte le chantier.
  const r3 = rejouer(avant, ["a"], { a: 60 }, 100000);
  test("un technicien retiré du chantier voit sa demande annulée, pas oubliée",
    r3.annulees.length === 1 && r3.annulees[0].user_id === "b");
}


titre("Supprimer un chantier : impossible si des primes ont déjà été payées");
{
  const bloque = (c) => (c.equipe || []).filter((e) => e.paye && Number(e.montant || 0) > 0);
  test("un chantier avec une prime payée ne peut pas être supprimé",
    bloque({ equipe: [{ nom: "KOSSI", montant: 60000, paye: true }] }).length === 1);
  test("un chantier sans paiement reste supprimable",
    bloque({ equipe: [{ nom: "KOSSI", montant: 60000, paye: false }] }).length === 0);
  test("une part à 0 F marquée payée ne bloque pas inutilement",
    bloque({ equipe: [{ nom: "AMA", montant: 0, paye: true }] }).length === 0);
  test("un chantier sans équipe du tout reste supprimable",
    bloque({}).length === 0);
}


titre("Devis repris : les conditions négociées avec le client sont restituées");
{
  // Ce qui disparaissait en silence quand on reprenait un devis rejete.
  const capter = () => {
    const v = {};
    return {
      v,
      setPctRemise: (x) => (v.remise = x),
      setPctInstall: (x) => (v.install = x),
      setPctTransport: (x) => (v.transport = x),
      setPctAcompte: (x) => (v.acompte = x),
      setDelaiInstallation: (x) => (v.delai = x),
      setPoseSeule: (x) => (v.pose = x),
      setMontantPoseFixe: (x) => (v.montantPose = x),
    };
  };

  const devisNegocie = {
    pct_remise: 15, pct_installation: 12, pct_transport: 5, pct_acompte: 50,
    delai_installation: "3 semaines", pose_seule: false, frais_installation: 120000,
  };
  const a = capter();
  Dim.appliquerConditionsReprises(devisNegocie, a);
  test("la remise accordée au client est bien restituée (elle repartait à 0 %)",
    a.v.remise === "15");
  test("le pourcentage de frais d'installation aussi (il repartait à 10 %)",
    a.v.install === "12");
  test("le transport aussi", a.v.transport === "5");
  test("l'acompte exigé aussi (il repartait à 100 %)", a.v.acompte === "50");
  test("le délai promis au client n'est plus effacé", a.v.delai === "3 semaines");

  // « Pose seule » : montant FIXE de main d'oeuvre, pct_installation vaut null.
  const devisPose = { pct_remise: 0, pct_installation: null, pct_transport: 0, pct_acompte: 100,
                      delai_installation: "", pose_seule: true, frais_installation: 250000 };
  const b = capter();
  Dim.appliquerConditionsReprises(devisPose, b);
  test("la case « pose seule » est rétablie (le devis repassait en pourcentage)",
    b.v.pose === true);
  test("…avec son montant fixe de main d'œuvre", b.v.montantPose === "250000");

  // Un devis normal ne doit pas heriter d'un montant de pose.
  const c = capter();
  Dim.appliquerConditionsReprises(devisNegocie, c);
  test("un devis normal ne récupère aucun montant de pose fixe",
    c.v.pose === false && c.v.montantPose === "");

  // Vieux devis sans ces champs : on retombe sur les valeurs par defaut.
  const d = capter();
  Dim.appliquerConditionsReprises({}, d);
  test("un ancien devis sans ces informations retombe sur les valeurs par défaut",
    d.v.remise === "0" && d.v.install === "10" && d.v.acompte === "100");

  // Aucun devis repris : on ne touche a rien (un devis neuf garde ses reglages).
  const e = capter();
  Dim.appliquerConditionsReprises(null, e);
  test("sans devis repris, aucun réglage n'est écrasé",
    Object.keys(e.v).length === 0);
}


titre("Quantité d'équipement : plus de plafond silencieux à 50");
{
  test("35 panneaux de 550 Wc pour 19 000 Wc : quantité exacte",
    Dim.quantiteNecessaire(19000, 550) === 35);
  test("une grosse installation dépasse enfin 50 (elle était tronquée en silence)",
    Dim.quantiteNecessaire(40000, 550) === 73);
  test("une quantité au-delà du seuil déclenche l'avertissement visible",
    Dim.quantiteNecessaire(40000, 550) >= Dim.SEUIL_QTE_INHABITUELLE);
  test("une installation normale ne déclenche AUCUN avertissement",
    Dim.quantiteNecessaire(5500, 550) === 10 && 10 < Dim.SEUIL_QTE_INHABITUELLE);
  test("un article mal nommé (« panneau 5W ») produit une quantité énorme… qui sera signalée",
    Dim.quantiteNecessaire(19000, 5) === 3800 && 3800 >= Dim.SEUIL_QTE_INHABITUELLE);
  test("un article sans caractéristique lisible reste à 1 unité, jamais à l'infini",
    Dim.quantiteNecessaire(19000, 0) === 1);
  test("un besoin nul ne descend jamais en dessous de 1",
    Dim.quantiteNecessaire(0, 550) === 1);
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
