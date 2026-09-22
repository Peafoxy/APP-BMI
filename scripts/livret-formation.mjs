// ============================================================
// FABRIQUE LE LIVRET DE FORMATION — Word (.docx) puis PDF
//
//   npm run livret-formation
//
// Le CONTENU vit dans scripts/livret-contenu.mjs (des mots, rien d'autre).
// Ce fichier ne fait que la mise en page : couverture, sommaire, titres,
// listes, encadrés, tableaux, en-tête et pied de page. Le PDF est produit
// par LibreOffice à partir du Word, pour que les deux disent la même chose.
// Les deux fichiers sortent dans docs/.
// ============================================================
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { CONTENU, VERSION_LIVRET, DATE_LIVRET } from "./livret-contenu.mjs";

const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LevelFormat,
  Header, Footer, PageNumber, TabStopType, LeaderType,
} = require("docx");

const BLEU = "1E3A8A";      // le bleu de BMI (réel)
const GRIS = "475569";
const FOND_NOTE = "EFF6FF";
const POLICE = "Arial";

// ---- Le **gras** en ligne ----
const runs = (texte, base = {}) => {
  const morceaux = String(texte).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return morceaux.map((m) => m.startsWith("**") && m.endsWith("**")
    ? new TextRun({ ...base, text: m.slice(2, -2), bold: true })
    : new TextRun({ ...base, text: m }));
};

const para = (texte, opts = {}) => new Paragraph({ children: runs(texte, opts.run || {}), ...opts.par });

// ---- Les blocs ----
let numListeId = 0;
const numerotations = [];   // une numérotation par liste ordonnée (recommence à 1)

function bloc(b) {
  const [type, a] = b;
  switch (type) {
    case "cover": return couverture();
    case "h1": return [new Paragraph({ text: a, heading: HeadingLevel.HEADING_1, pageBreakBefore: true })];
    case "h2": return [new Paragraph({ text: a, heading: HeadingLevel.HEADING_2 })];
    case "h3": return [new Paragraph({ text: a, heading: HeadingLevel.HEADING_3 })];
    case "p": return [para(a, { par: { spacing: { after: 140 } } })];
    case "note": return [new Paragraph({
      children: runs("ℹ  " + a),
      shading: { type: ShadingType.CLEAR, fill: FOND_NOTE, color: "auto" },
      border: { left: { style: BorderStyle.SINGLE, size: 18, color: BLEU, space: 8 } },
      indent: { left: 280 }, spacing: { before: 80, after: 200 },
    })];
    case "ul": return a.map((l) => new Paragraph({
      children: runs(l), numbering: { reference: "puces", level: 0 }, spacing: { after: 80 },
    }));
    case "ol": {
      const ref = `num-${++numListeId}`;
      numerotations.push({
        reference: ref,
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 600, hanging: 360 } } } }],
      });
      return a.map((l) => new Paragraph({
        children: runs(l), numbering: { reference: ref, level: 0 }, spacing: { after: 80 },
      }));
    }
    case "table": return [tableau(a), new Paragraph({ spacing: { after: 160 } })];
    case "break": return [new Paragraph({ children: [new PageBreak()] })];
    default: throw new Error(`Bloc inconnu : ${type}`);
  }
}

function tableau(lignes) {
  const largeurs = [4200, 5160];  // DXA — la page A4 utile fait ~9 360
  const cellule = (texte, entete, i) => new TableCell({
    width: { size: largeurs[i], type: WidthType.DXA },
    shading: entete ? { type: ShadingType.CLEAR, fill: "DBEAFE", color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: runs(texte, entete ? { bold: true } : {}) })],
  });
  return new Table({
    width: { size: largeurs[0] + largeurs[1], type: WidthType.DXA },
    columnWidths: largeurs,
    rows: lignes.map((l, r) => new TableRow({
      tableHeader: r === 0,
      children: l.map((c, i) => cellule(c, r === 0, i)),
    })),
  });
}

function couverture() {
  const centre = (texte, opts) => new Paragraph({ alignment: AlignmentType.CENTER, ...opts, children: runs(texte, opts.run || {}) });
  return [
    new Paragraph({ spacing: { before: 3200 } }),
    centre("BMI TOGO", { run: { size: 36, bold: true, color: BLEU }, spacing: { after: 200 } }),
    centre("Les bâtiments modernes et intelligents", { run: { size: 22, color: GRIS, italics: true }, spacing: { after: 1400 } }),
    centre("BMI-Gestion", { run: { size: 72, bold: true, color: BLEU }, spacing: { after: 200 } }),
    centre("Livret de formation", { run: { size: 44, bold: true }, spacing: { after: 1600 } }),
    centre("Ma journée, par métier — puis les écrans, un par un", { run: { size: 26, color: GRIS }, spacing: { after: 2400 } }),
    centre(`Version ${VERSION_LIVRET} de l'application — ${DATE_LIVRET}`, { run: { size: 20, color: GRIS } }),
    centre("gestion.bmitogo.com", { run: { size: 20, color: GRIS } }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ text: "Sommaire", heading: HeadingLevel.HEADING_1 }),
    // ⚠ Un SOMMAIRE ÉCRIT, pas un champ Word : LibreOffice ne calcule pas
    // un champ « table des matières » quand il convertit en PDF — le sommaire
    // sortait VIDE. Les numéros de page viennent d'une première passe (voir
    // `pagesDesTitres`) : on fabrique le PDF, on lit sur quelle page tombe
    // chaque titre, on refait le document avec les bons numéros.
    ...SOMMAIRE.map((e) => new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: 9300, leader: LeaderType.DOT }],
      indent: { left: e.niveau === 1 ? 0 : 400 },
      spacing: { after: e.niveau === 1 ? 60 : 30, before: e.niveau === 1 ? 160 : 0 },
      children: [
        new TextRun({ text: e.texte, bold: e.niveau === 1, size: e.niveau === 1 ? 22 : 20 }),
        new TextRun({ text: "\t" + (e.page || ""), size: e.niveau === 1 ? 22 : 20, color: GRIS }),
      ],
    })),
  ];
}

// Les titres qui vont au sommaire (h1 et h2), dans l'ordre.
const SOMMAIRE = CONTENU.filter((b) => b[0] === "h1" || b[0] === "h2")
  .map((b) => ({ niveau: b[0] === "h1" ? 1 : 2, texte: b[1], page: "" }));

// Sur quelle page tombe chaque titre : on lit le PDF page par page.
function pagesDesTitres(pdf) {
  const texte = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const pages = texte.split("\f");
  const norm = (t) => String(t).normalize("NFKD").replace(/[^a-z0-9]/gi, "").toLowerCase();
  // On cherche à partir de la page 3 (après la couverture et le sommaire),
  // et toujours APRÈS le titre précédent : deux titres peuvent se ressembler.
  let depuis = 2;
  SOMMAIRE.forEach((e) => {
    const cible = norm(e.texte);
    for (let i = depuis; i < pages.length; i++) {
      const lignes = pages[i].split("\n").map(norm);
      if (lignes.some((l) => l === cible)) { e.page = String(i + 1); depuis = i; return; }
    }
  });
}

function fabriquer() {
  numListeId = 0; numerotations.length = 0;
  const corps = CONTENU.flatMap(bloc);
  return new Document({
  creator: "BMI Togo",
  title: "BMI-Gestion — Livret de formation",
  description: `Version ${VERSION_LIVRET}`,
  styles: {
    default: { document: { run: { font: POLICE, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40, bold: true, color: BLEU, font: POLICE },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: BLEU, font: POLICE },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 1,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFDBFE", space: 4 } } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "0F172A", font: POLICE },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "puces", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START,
        style: { paragraph: { indent: { left: 600, hanging: 360 } } } }] },
      ...numerotations,
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1300, bottom: 1200, left: 1300, right: 1300 } } },
    headers: { default: new Header({ children: [new Paragraph({
      children: [new TextRun({ text: "BMI-Gestion — Livret de formation", color: GRIS, size: 18 })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1", space: 4 } },
    })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Page ", color: GRIS, size: 18 }), new TextRun({ children: [PageNumber.CURRENT], color: GRIS, size: 18 }),
        new TextRun({ text: " / ", color: GRIS, size: 18 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: GRIS, size: 18 })],
    })] }) },
    children: corps,
  }],
  });
}

const sortieDocx = "docs/livret-formation.docx";
const sortiePdf = "docs/livret-formation.pdf";

// Le PDF, par LibreOffice — le même document, sans le refaire.
function versPdf() {
  try {
    execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", "docs", sortieDocx], { stdio: "ignore", timeout: 180000 });
  } catch (e) {
    console.error("✗ Le PDF n'a pas pu être produit (LibreOffice Writer absent ?) :", e?.message || e);
    process.exit(1);
  }
}

// Passe 1 : sans numéros de page (le sommaire a déjà sa place, donc la
// pagination ne bougera pas à la passe 2).
writeFileSync(sortieDocx, await Packer.toBuffer(fabriquer()));
versPdf();
pagesDesTitres(sortiePdf);
const manquants = SOMMAIRE.filter((e) => !e.page).map((e) => e.texte);
if (manquants.length) console.warn("⚠ Titres introuvables dans le PDF (sans numéro de page) :", manquants.join(" · "));
// Passe 2 : avec les numéros.
writeFileSync(sortieDocx, await Packer.toBuffer(fabriquer()));
versPdf();
console.log(`✓ ${sortieDocx}`);
console.log(`✓ ${sortiePdf} — ${SOMMAIRE.length} titres au sommaire, ${manquants.length} sans page`);
