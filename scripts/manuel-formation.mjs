// ============================================================
// FABRIQUE LE MANUEL DE FORMATION OPÉRATIONNEL — un fichier par chapitre
// (Word + PDF), plus le manuel complet en un seul fichier.
//
//   npm run manuel-formation
//
// Les MOTS de chaque chapitre vivent dans scripts/manuel/chapitre-NN.mjs :
// douze rubriques, toujours les mêmes (objectif, qui, accès, procédure,
// boutons, automatismes, interdépendances, contrôles, erreurs, cas pratiques,
// exercice, critères), puis une fiche de validation à signer. Ce fichier ne
// fait que la mise en page. Le PDF est produit par LibreOffice à partir du
// Word, pour que les deux disent la même chose. Sortie : docs/manuel/.
// ============================================================
import { writeFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { VERSION } from "../src/lib/constants.js";

const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat,
  Header, Footer, PageNumber, TabStopType, LeaderType, VerticalAlign, HeightRule,
} = require("docx");

export const DATE_MANUEL = "22 septembre 2026";

// ---- La palette (celle de l'application : bleu de l'espace réel) ----
const BLEU = "1E3A8A", BLEU_MOYEN = "1D4ED8", BLEU_PALE = "DBEAFE", BLEU_FOND = "EFF6FF";
const ENCRE = "0F172A", GRIS = "475569", GRIS_CLAIR = "94A3B8", TRAIT = "CBD5E1", ZEBRE = "F8FAFC", FOND_DOUX = "F1F5F9";
const POLICE = "Arial";
const LARGEUR = 9300;   // largeur utile d'une page A4 avec nos marges (DXA)

const RIEN = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const SANS_BORDURES = { top: RIEN, bottom: RIEN, left: RIEN, right: RIEN, insideHorizontal: RIEN, insideVertical: RIEN };
const trait = (color = TRAIT, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const BORDURES_FINES = { top: trait(), bottom: trait(), left: trait(), right: trait(), insideHorizontal: trait(), insideVertical: trait() };

const ENCADRES = {
  note: { etiquette: "ℹ  À SAVOIR", bord: BLEU_MOYEN, fond: BLEU_FOND },
  attention: { etiquette: "⚠  ATTENTION", bord: "B45309", fond: "FEF3C7" },
  regle: { etiquette: "📏  RÈGLE DE LA MAISON", bord: "15803D", fond: "DCFCE7" },
};

// ---- Le **gras** en ligne ----
const runs = (texte, base = {}) => String(texte).split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  .map((m) => new TextRun(m.startsWith("**") && m.endsWith("**") ? { ...base, text: m.slice(2, -2), bold: true } : { ...base, text: m }));
const para = (texte, opts = {}) => new Paragraph({ children: runs(texte, opts.run || {}), ...opts.par });
const vide = (after = 120) => new Paragraph({ spacing: { after } });
const cellule = (children, { largeur, fond, marges, valign } = {}) => new TableCell({
  width: largeur ? { size: largeur, type: WidthType.DXA } : undefined,
  shading: fond ? { type: ShadingType.CLEAR, fill: fond, color: "auto" } : undefined,
  verticalAlign: valign,
  margins: marges || { top: 100, bottom: 100, left: 140, right: 140 },
  children,
});
const table = (rows, { largeurs, bordures = SANS_BORDURES } = {}) => new Table({
  width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: largeurs, borders: bordures, rows,
});

// ---- Les blocs ----
let numListeId = 0;
const numerotations = [];

function rubrique(n, titre) {
  return [
    table([new TableRow({ cantSplit: true, children: [
      cellule([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: typeof n === "number" ? String(n).padStart(2, "0") : String(n), bold: true, color: "FFFFFF", size: 32 })] })],
        { largeur: 900, fond: BLEU, valign: VerticalAlign.CENTER, marges: { top: 140, bottom: 140, left: 0, right: 0 } }),
      cellule([new Paragraph({ children: [new TextRun({ text: titre.toUpperCase(), bold: true, color: BLEU, size: 24 })] })],
        { largeur: LARGEUR - 900, fond: BLEU_PALE, valign: VerticalAlign.CENTER, marges: { top: 140, bottom: 140, left: 220, right: 140 } }),
    ] })], { largeurs: [900, LARGEUR - 900] }),
    vide(160),
  ];
}

function encadre(genre, texte) {
  const k = ENCADRES[genre];
  return [
    table([new TableRow({ cantSplit: true, children: [cellule([
      new Paragraph({ children: [new TextRun({ text: k.etiquette, bold: true, color: k.bord, size: 17 })], spacing: { after: 60 } }),
      new Paragraph({ children: runs(texte) }),
    ], { largeur: LARGEUR, fond: k.fond, marges: { top: 140, bottom: 140, left: 220, right: 220 } })] })],
      { largeurs: [LARGEUR], bordures: { ...SANS_BORDURES, left: trait(k.bord, 28) } }),
    vide(160),
  ];
}

function repartir(n, largeurs) {
  if (largeurs) return largeurs;
  const part = Math.floor(LARGEUR / n);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? LARGEUR - part * (n - 1) : part));
}

function tableau({ entetes, lignes, largeurs }) {
  const larg = repartir(entetes.length, largeurs);
  const rows = [
    new TableRow({ tableHeader: true, cantSplit: true, children: entetes.map((e, i) => cellule(
      [new Paragraph({ children: [new TextRun({ text: e, bold: true, color: BLEU, size: 19 })] })], { largeur: larg[i], fond: BLEU_PALE })) }),
    ...lignes.map((l, r) => new TableRow({ cantSplit: true, children: l.map((c, i) => cellule(
      [new Paragraph({ children: runs(c, { size: 19 }) })], { largeur: larg[i], fond: r % 2 ? ZEBRE : undefined })) })),
  ];
  return [table(rows, { largeurs: larg, bordures: BORDURES_FINES }), vide(200)];
}

function etapes(liste) {
  const larg = [760, LARGEUR - 760];
  const rows = liste.map((e, i) => new TableRow({ cantSplit: true, children: [
    cellule([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(i + 1), bold: true, color: "FFFFFF", size: 26 })] })],
      { largeur: larg[0], fond: BLEU_MOYEN, valign: VerticalAlign.CENTER, marges: { top: 100, bottom: 100, left: 0, right: 0 } }),
    cellule([
      new Paragraph({ children: [new TextRun({ text: e.titre, bold: true, color: ENCRE, size: 21 })], spacing: { after: 40 } }),
      new Paragraph({ children: runs(e.texte, { size: 20 }) }),
    ], { largeur: larg[1], fond: i % 2 ? ZEBRE : undefined, marges: { top: 110, bottom: 110, left: 200, right: 160 } }),
  ] }));
  return [table(rows, { largeurs: larg, bordures: { ...SANS_BORDURES, insideHorizontal: trait("FFFFFF", 8) } }), vide(200)];
}

function casPratiques(liste) {
  return liste.flatMap((c, i) => [
    table([
      new TableRow({ cantSplit: true, children: [cellule([
        new Paragraph({ children: [new TextRun({ text: `CAS ${i + 1}  ·  LA SITUATION`, bold: true, color: BLEU, size: 17 })], spacing: { after: 60 } }),
        new Paragraph({ children: runs(c.situation, { size: 20 }) }),
      ], { largeur: LARGEUR, fond: FOND_DOUX, marges: { top: 140, bottom: 140, left: 220, right: 220 } })] }),
      new TableRow({ cantSplit: true, children: [cellule([
        new Paragraph({ children: [new TextRun({ text: "✅  CE QU'ON ATTEND", bold: true, color: "15803D", size: 17 })], spacing: { after: 60 } }),
        new Paragraph({ children: runs(c.reponse, { size: 20 }) }),
      ], { largeur: LARGEUR, marges: { top: 140, bottom: 140, left: 220, right: 220 } })] }),
    ], { largeurs: [LARGEUR], bordures: { ...BORDURES_FINES, insideHorizontal: RIEN } }),
    vide(200),
  ]);
}

function bloc(b) {
  const [type, a] = b;
  switch (type) {
    case "h3": return [new Paragraph({ children: [new TextRun({ text: a, bold: true, color: ENCRE, size: 23 })], spacing: { before: 240, after: 100 }, keepNext: true })];
    case "p": return [para(a, { par: { spacing: { after: 140 } } })];
    case "ul": return a.map((l) => new Paragraph({ children: runs(l), numbering: { reference: "puces", level: 0 }, spacing: { after: 80 } }));
    case "ol": {
      const ref = `num-${++numListeId}`;
      numerotations.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 600, hanging: 360 } }, run: { bold: true, color: BLEU } } }] });
      return a.map((l) => new Paragraph({ children: runs(l), numbering: { reference: ref, level: 0 }, spacing: { after: 80 } }));
    }
    case "note": case "attention": case "regle": return encadre(type, a);
    case "table": return tableau(a);
    case "etapes": return etapes(a);
    case "cas": return casPratiques(a);
    case "cases": return a.map((l) => new Paragraph({ children: [new TextRun({ text: "☐   ", size: 26, color: BLEU_MOYEN }), ...runs(l)], indent: { left: 200 }, spacing: { after: 120 } }));
    case "questions": {
      const ref = `num-${++numListeId}`;
      numerotations.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 600, hanging: 360 } }, run: { bold: true, color: BLEU } } }] });
      return a.flatMap((q) => [
        new Paragraph({ children: runs(q), numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, keepNext: true }),
        new Paragraph({ indent: { left: 600 }, spacing: { before: 200, after: 260 }, border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: GRIS_CLAIR, space: 1 } } }),
      ]);
    }
    default: throw new Error(`Bloc inconnu : ${type}`);
  }
}

// ---- La couverture d'un chapitre ----
function couvertureChapitre(ch) {
  const meta = [
    ["Public", ch.public], ["Durée conseillée", ch.duree], ["Prérequis", ch.prerequis],
    ["Version de l'application", VERSION], ["Date", DATE_MANUEL],
  ];
  return [
    vide(600),
    table([new TableRow({ children: [cellule([
      new Paragraph({ children: [new TextRun({ text: "BMI TOGO  ·  LES BÂTIMENTS MODERNES ET INTELLIGENTS", color: "BFDBFE", size: 17, bold: true })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "Manuel de formation opérationnel", color: "FFFFFF", size: 34, bold: true })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: "BMI-Gestion  ·  gestion.bmitogo.com", color: "BFDBFE", size: 20 })] }),
    ], { largeur: LARGEUR, fond: BLEU, marges: { top: 300, bottom: 300, left: 400, right: 400 } })] })], { largeurs: [LARGEUR] }),
    vide(900),
    new Paragraph({ children: [new TextRun({ text: `CHAPITRE ${ch.numero}`, bold: true, color: BLEU_MOYEN, size: 60 })], spacing: { after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: ch.titre, bold: true, color: ENCRE, size: 52 })], spacing: { after: 160 } }),
    new Paragraph({ children: [new TextRun({ text: ch.sousTitre, italics: true, color: GRIS, size: 24 })], spacing: { after: 700 } }),
    table(meta.map(([k, v]) => new TableRow({ children: [
      cellule([new Paragraph({ children: [new TextRun({ text: k, bold: true, color: GRIS, size: 19 })] })], { largeur: 2900, marges: { top: 90, bottom: 90, left: 0, right: 140 } }),
      cellule([new Paragraph({ children: [new TextRun({ text: v, color: ENCRE, size: 20 })] })], { largeur: LARGEUR - 2900, marges: { top: 90, bottom: 90, left: 140, right: 0 } }),
    ] })), { largeurs: [2900, LARGEUR - 2900], bordures: { ...SANS_BORDURES, insideHorizontal: trait("E2E8F0", 4) } }),
    vide(600),
    new Paragraph({ children: [new TextRun({ text: "DANS CE CHAPITRE", bold: true, color: BLEU, size: 18 })], spacing: { after: 120 } }),
    ...ch.sections.map((s, i) => new Paragraph({
      children: [new TextRun({ text: `${String(i + 1).padStart(2, "0")}   `, bold: true, color: BLEU_MOYEN, size: 19 }), new TextRun({ text: s.titre, color: ENCRE, size: 19 })],
      spacing: { after: 50 },
    })),
    new Paragraph({ children: [new TextRun({ text: "      ", size: 19 }), new TextRun({ text: "Fiche de validation, à signer par le formateur", color: GRIS, size: 19, italics: true })], spacing: { after: 50 } }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ---- La fiche de validation, en dernière page ----
function ficheValidation(ch) {
  const ligne = (k) => new TableRow({ height: { value: 520, rule: HeightRule.ATLEAST }, children: [
    cellule([new Paragraph({ children: [new TextRun({ text: k, bold: true, color: GRIS, size: 19 })] })], { largeur: 2900, fond: ZEBRE, valign: VerticalAlign.CENTER }),
    cellule([new Paragraph({})], { largeur: LARGEUR - 2900 }),
  ] });
  const coche = (t) => cellule([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `☐  ${t}`, size: 19 })] })], { largeur: 1500, valign: VerticalAlign.CENTER });
  return [
    new Paragraph({ children: [new PageBreak()] }),
    ...rubrique("✓", `Fiche de validation — chapitre ${ch.numero}`),
    para("À remplir par le formateur, après l'exercice de la rubrique 11 et les questions de la rubrique 12. Une fiche par personne. Elle se garde dans son dossier.", { par: { spacing: { after: 200 } }, run: { color: GRIS, size: 19 } }),
    table(["Nom et prénom", "Fonction", "Boutique", "Date de la formation", "Formateur"].map(ligne), { largeurs: [2900, LARGEUR - 2900], bordures: BORDURES_FINES }),
    vide(240),
    table([
      new TableRow({ tableHeader: true, children: [
        cellule([new Paragraph({ children: [new TextRun({ text: "Ce que le formateur a vu faire", bold: true, color: BLEU, size: 19 })] })], { largeur: LARGEUR - 3000, fond: BLEU_PALE }),
        cellule([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Acquis", bold: true, color: BLEU, size: 19 })] })], { largeur: 1500, fond: BLEU_PALE }),
        cellule([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "À revoir", bold: true, color: BLEU, size: 19 })] })], { largeur: 1500, fond: BLEU_PALE }),
      ] }),
      ...ch.fiche.criteres.map((c, i) => new TableRow({ height: { value: 480, rule: HeightRule.ATLEAST }, cantSplit: true, children: [
        cellule([new Paragraph({ children: runs(c, { size: 19 }) })], { largeur: LARGEUR - 3000, fond: i % 2 ? ZEBRE : undefined, valign: VerticalAlign.CENTER }),
        coche(""), coche(""),
      ] })),
    ], { largeurs: [LARGEUR - 3000, 1500, 1500], bordures: BORDURES_FINES }),
    vide(240),
    table([new TableRow({ height: { value: 1700, rule: HeightRule.ATLEAST }, children: [cellule([
      new Paragraph({ children: [new TextRun({ text: "Observations du formateur", bold: true, color: GRIS, size: 19 })] }),
    ], { largeur: LARGEUR })] })], { largeurs: [LARGEUR], bordures: BORDURES_FINES }),
    vide(240),
    new Paragraph({ children: [new TextRun({ text: "Formation validée :   ☐  Oui        ☐  À refaire le  ______ / ______ / ________", size: 21, bold: true, color: ENCRE })], spacing: { after: 300 } }),
    table([new TableRow({ height: { value: 1300, rule: HeightRule.ATLEAST }, children: [
      cellule([new Paragraph({ children: [new TextRun({ text: "Signature de la personne formée", bold: true, color: GRIS, size: 19 })] })], { largeur: LARGEUR / 2 }),
      cellule([new Paragraph({ children: [new TextRun({ text: "Signature du formateur", bold: true, color: GRIS, size: 19 })] })], { largeur: LARGEUR / 2 }),
    ] })], { largeurs: [LARGEUR / 2, LARGEUR / 2], bordures: BORDURES_FINES }),
  ];
}

function corpsChapitre(ch, { avecCouverture = true } = {}) {
  return [
    ...(avecCouverture ? couvertureChapitre(ch) : []),
    ...ch.sections.flatMap((s, i) => [...rubrique(i + 1, s.titre), ...s.blocs.flatMap(bloc)]),
    ...ficheValidation(ch),
  ];
}

// ---- Le document Word ----
function document({ children, enTeteDroite }) {
  return new Document({
    creator: "BMI Togo", title: "BMI-Gestion — Manuel de formation opérationnel", description: `Version ${VERSION}`,
    styles: {
      default: { document: { run: { font: POLICE, size: 21, color: ENCRE } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 40, bold: true, color: BLEU, font: POLICE }, paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      ],
    },
    numbering: { config: [
      { reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 600, hanging: 360 } }, run: { color: BLEU_MOYEN, bold: true } } }] },
      ...numerotations,
    ] },
    sections: [{
      properties: { page: { margin: { top: 1250, bottom: 1200, left: 1300, right: 1300 } } },
      headers: { default: new Header({ children: [new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: LARGEUR }],
        children: [new TextRun({ text: "BMI TOGO  ·  Manuel de formation BMI-Gestion", color: GRIS, size: 16 }), new TextRun({ text: "\t" + enTeteDroite, color: GRIS, size: 16 })],
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TRAIT, space: 4 } },
      })] }) },
      footers: { default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: "Page ", color: GRIS, size: 17 }), new TextRun({ children: [PageNumber.CURRENT], color: GRIS, size: 17 }),
          new TextRun({ text: " / ", color: GRIS, size: 17 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRIS, size: 17 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Version ${VERSION} de l'application  ·  ${DATE_MANUEL}  ·  document interne BMI Togo`, color: GRIS_CLAIR, size: 14 })] }),
      ] }) },
      children,
    }],
  });
}

// ---- Le manuel complet : couverture générale + sommaire écrit + chapitres ----
function couvertureGenerale(chapitres) {
  return [
    vide(2400),
    table([new TableRow({ children: [cellule([
      new Paragraph({ children: [new TextRun({ text: "BMI TOGO  ·  LES BÂTIMENTS MODERNES ET INTELLIGENTS", color: "BFDBFE", size: 17, bold: true })], spacing: { after: 120 } }),
      new Paragraph({ children: [new TextRun({ text: "BMI-Gestion", color: "FFFFFF", size: 72, bold: true })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: "Manuel de formation opérationnel", color: "FFFFFF", size: 40, bold: true })], spacing: { after: 200 } }),
      new Paragraph({ children: [new TextRun({ text: `${chapitres.length} chapitre${chapitres.length > 1 ? "s" : ""}  ·  Version ${VERSION}  ·  ${DATE_MANUEL}`, color: "BFDBFE", size: 20 })] }),
    ], { largeur: LARGEUR, fond: BLEU, marges: { top: 500, bottom: 500, left: 500, right: 500 } })] })], { largeurs: [LARGEUR] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ text: "Sommaire", heading: HeadingLevel.HEADING_1 }),
    ...SOMMAIRE.map((e) => new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: LARGEUR, leader: LeaderType.DOT }],
      spacing: { after: 100, before: 60 },
      children: [new TextRun({ text: `Chapitre ${e.numero}  ·  ${e.titre}`, bold: true, size: 22 }), new TextRun({ text: "\t" + (e.page || ""), size: 22, color: GRIS })],
    })),
  ];
}
let SOMMAIRE = [];
function pagesDesChapitres(pdf) {
  const pages = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\f");
  let depuis = 2;
  SOMMAIRE.forEach((e) => {
    for (let i = depuis; i < pages.length; i++) {
      if (pages[i].split("\n").some((l) => l.trim() === `CHAPITRE ${e.numero}`)) { e.page = String(i + 1); depuis = i; return; }
    }
  });
}

const slug = (t) => String(t).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function versPdf(docx) {
  try { execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", "docs/manuel", docx], { stdio: "ignore", timeout: 180000 }); }
  catch (e) { console.error("✗ Le PDF n'a pas pu être produit (LibreOffice Writer absent ?) :", e?.message || e); process.exit(1); }
}
async function ecrire(docx, fabrique) {
  numListeId = 0; numerotations.length = 0;
  writeFileSync(docx, await Packer.toBuffer(fabrique()));
  versPdf(docx);
}

// ---- On y va ----
const fichiers = readdirSync("scripts/manuel").filter((f) => /^chapitre-\d+\.mjs$/.test(f)).sort();
const chapitres = [];
for (const f of fichiers) chapitres.push((await import(`./manuel/${f}`)).CHAPITRE);

for (const ch of chapitres) {
  const docx = `docs/manuel/chapitre-${String(ch.numero).padStart(2, "0")}-${slug(ch.titre)}.docx`;
  await ecrire(docx, () => document({ children: corpsChapitre(ch), enTeteDroite: `Chapitre ${ch.numero}  ·  ${ch.titre}` }));
  console.log(`✓ ${docx} (+ PDF)`);
}

SOMMAIRE = chapitres.map((c) => ({ numero: c.numero, titre: c.titre, page: "" }));
const complet = "docs/manuel/manuel-formation-complet.docx";
const fabriqueComplet = () => document({ children: [...couvertureGenerale(chapitres), ...chapitres.flatMap((c) => [new Paragraph({ children: [new PageBreak()] }), ...corpsChapitre(c)])], enTeteDroite: "Manuel complet" });
await ecrire(complet, fabriqueComplet);            // passe 1 : la pagination
pagesDesChapitres(complet.replace(/\.docx$/, ".pdf"));
await ecrire(complet, fabriqueComplet);            // passe 2 : les numéros de page
console.log(`✓ ${complet} (+ PDF) — ${chapitres.length} chapitre(s)`);
