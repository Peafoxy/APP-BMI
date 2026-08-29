// ============================================================
// lib/export.js — Export CSV (ouvert dans Excel) des tableaux.
// ============================================================
import { today } from "./core";
import { exportApi } from "../components/ui";


export function exportCSV(nom, headers, rows, filtre = "") {
  // ⚠ Audit du 29/08/2026 : une cellule TEXTE qui commence par =, +, − ou @
  // est interprétée par Excel comme une FORMULE à l'ouverture du fichier —
  // un nom de client saisi ainsi (maladresse ou malveillance) s'exécuterait
  // sur le poste qui ouvre l'export. Le remède classique : une apostrophe
  // devant, qu'Excel affiche comme du texte. Les NOMBRES ne sont pas
  // touchés : un montant négatif doit rester un nombre.
  const desamorcer = (x) => (typeof x === "string" && /^[=+\-@\t\r]/.test(x) ? `'${x}` : x);
  const esc = (x) => `"${String(desamorcer(x) ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map(esc).join(";"))
  ].join("\n");
  const tsv = [
    headers.join("\t"),
    ...rows.map((r) => r.map((x) => String(desamorcer(x) ?? "").replace(/[\t\n]/g, " ")).join("\t"))
  ].join("\n");
  const fichier = `${nom}_${today()}${filtre ? `_${filtre}` : ""}.csv`;
  if (exportApi) exportApi.open({ nom, fichier, csv, tsv, headers, rows, lignes: rows.length });
}
