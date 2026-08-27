// ============================================================
// scripts/tester-reglement.mjs — LE PLAN DE RÈGLEMENT DU CLIENT
//
//   node scripts/tester-reglement.mjs
//
// Chaque vérification rejoue une situation réelle. Les plus importantes
// portent sur l'ARGENT : ne jamais réclamer un franc de trop, ne jamais
// perdre un versement de vue.
// ============================================================
import * as R from "../src/lib/reglement.js";

let ok = 0, ko = 0;
const test = (nom, cond) => { if (cond) { ok++; console.log(`  ✓ ${nom}`); } else { ko++; console.log(`  ✗ ${nom}`); } };
const titre = (t) => console.log(`\n${t}`);

titre("Ce qui reste à payer après l'acompte");
{
  test("70 % versés d'avance sur 1 200 000 → il reste 360 000",
    R.soldeApresAcompte({ total: 1200000, montant_acompte: 840000 }) === 360000);
  test("un devis payé en totalité d'avance ne laisse aucun solde",
    R.soldeApresAcompte({ total: 500000 }) === 0);
  test("un devis vide ne fait pas planter", R.soldeApresAcompte(null) === 0);
  test("un acompte supérieur au total ne donne jamais un solde négatif",
    R.soldeApresAcompte({ total: 100000, montant_acompte: 150000 }) === 0);
}

titre("« Fin du mois » veut vraiment dire le dernier jour");
{
  test("février 2027 : le 28", R.finDuMois(2027, 1) === "2027-02-28");
  test("février 2028, année bissextile : le 29", R.finDuMois(2028, 1) === "2028-02-29");
  test("avril : le 30", R.finDuMois(2026, 3) === "2026-04-30");
  test("décembre : le 31", R.finDuMois(2026, 11) === "2026-12-31");
}

titre("L'échéancier — c'est ici qu'on peut réclamer trop d'argent");
{
  const plan = { type: "mensuel", montant_mensuel: 60000, premiere_echeance: "2026-08-31" };
  const e = R.echeancier(plan, 360000);
  test("360 000 à 60 000 par mois → 6 versements", e.length === 6);
  test("★ la somme des versements fait EXACTEMENT le solde, pas un franc de plus",
    e.reduce((s, l) => s + l.montant, 0) === 360000);
  test("le premier tombe à la date choisie par le client", e[0].date === "2026-08-31");
  test("le dernier tombe fin janvier 2027", e[5].date === "2027-01-31");

  // ⚠ LE PIÈGE. 360 000 par tranches de 50 000, c'est 7,2 versements.
  // Sans ajustement du dernier, on réclamerait 8 × 50 000 = 400 000.
  const bancal = R.echeancier({ ...plan, montant_mensuel: 50000 }, 360000);
  test("★ un montant qui ne tombe pas juste : 8 versements, le dernier réduit",
    bancal.length === 8 && bancal[7].montant === 10000);
  test("★ …et le total reste EXACTEMENT 360 000 (pas 400 000)",
    bancal.reduce((s, l) => s + l.montant, 0) === 360000);

  // ⚠ Le passage d'un mois de 31 jours au suivant, piège classique des dates.
  const janvier = R.echeancier({ type: "mensuel", montant_mensuel: 100, premiere_echeance: "2027-01-31" }, 300);
  test("★ après le 31 janvier vient le 28 février, pas le 3 mars",
    janvier[1].date === "2027-02-28" && janvier[2].date === "2027-03-31");

  test("le versement unique porte tout le solde",
    R.echeancier({ type: "solde_signature" }, 360000)[0].montant === 360000);
  test("aucun solde, aucun échéancier", R.echeancier(plan, 0).length === 0);
  test("un montant mensuel nul ne fabrique pas une liste sans fin",
    R.echeancier({ ...plan, montant_mensuel: 0 }, 360000).length === 0);
  test("un montant dérisoire ne fige pas l'écran (liste bornée)",
    R.echeancier({ ...plan, montant_mensuel: 1 }, 360000).length <= 600);
}

titre("Ce que l'application refuse — et ce qu'elle laisse décider à l'administrateur");
{
  const solde = 360000;
  test("aucun choix coché : on le dit", !!R.critiquePlan({}, solde));
  test("mensuel sans montant : on le dit",
    !!R.critiquePlan({ type: "mensuel", premiere_echeance: "2026-08-31" }, solde));
  test("mensuel sans date : on le dit",
    !!R.critiquePlan({ type: "mensuel", montant_mensuel: 60000 }, solde));
  test("un mensuel plus grand que le solde est renvoyé vers « la totalité »",
    !!R.critiquePlan({ type: "mensuel", montant_mensuel: 400000, premiere_echeance: "2026-08-31" }, solde));
  test("★ un étalement sur plus de dix ans est refusé (1 000 F/mois sur 360 000)",
    !!R.critiquePlan({ type: "mensuel", montant_mensuel: 1000, premiere_echeance: "2026-08-31" }, solde));
  // ⚠ Un plan LONG mais tenable n'est PAS refusé par l'application : c'est
  // une décision commerciale, elle appartient à l'administrateur.
  test("★ un plan sur 6 ans passe le contrôle : c'est à l'administrateur de juger",
    R.critiquePlan({ type: "mensuel", montant_mensuel: 5000, premiere_echeance: "2026-08-31" }, solde) === null);
  test("le versement unique est toujours accepté",
    R.critiquePlan({ type: "solde_signature" }, solde) === null);
}

titre("La phrase que lisent le client ET l'administrateur");
{
  const plan = { type: "mensuel", montant_mensuel: 60000, premiere_echeance: "2026-08-31" };
  const r = R.resumePlan(plan, 360000);
  test("elle donne le montant, le nombre de versements et la date de fin",
    r.includes("6 versement") && r.includes("2027-01-31"));
  test("le versement unique renvoie à la signature du procès-verbal",
    R.resumePlan({ type: "solde_signature" }, 360000).includes("procès-verbal"));
  test("sans plan, on ne raconte rien", R.resumePlan(null, 360000) === "Aucun plan proposé");
  test("l'engagement du contrat est rappelé pour comparaison",
    R.engagementDuContrat({ pct_acompte: 70 }).includes("70 %"));
}

titre("La prochaine échéance — ce que le client doit voir en premier");
{
  const plan = { type: "mensuel", montant_mensuel: 60000, premiere_echeance: "2026-08-31" };
  test("rien versé : la prochaine est la première",
    R.prochaineEcheance(plan, 360000, 0).date === "2026-08-31");
  test("une mensualité versée : la prochaine est la deuxième",
    R.prochaineEcheance(plan, 360000, 60000).date === "2026-09-30");
  // ⚠ Un client qui paie 120 000 d'un coup a couvert DEUX mensualités : sa
  // prochaine échéance est la troisième. Un calcul versement par versement
  // lui réclamerait la deuxième, déjà payée.
  test("★ 120 000 versés d'un coup couvrent deux mensualités",
    R.prochaineEcheance(plan, 360000, 120000).date === "2026-10-31");
  test("tout versé : plus aucune échéance",
    R.prochaineEcheance(plan, 360000, 360000) === null);
  test("un versement partiel ne fait pas sauter l'échéance en cours",
    R.prochaineEcheance(plan, 360000, 30000).date === "2026-08-31");
}

console.log(`\n${ko === 0 ? "✅" : "❌"}  ${ok} vérification(s) passée(s), ${ko} en échec.\n`);
process.exit(ko === 0 ? 0 : 1);
