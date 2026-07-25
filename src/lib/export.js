// ============================================================
// lib/export.js — Export CSV (ouvert dans Excel) des tableaux.
// ============================================================
import { today } from "./core";
import { exportApi } from "../components/ui";


export function exportCSV(nom, headers, rows, filtre = "") {
  const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const csv = "\uFEFF" + [
    headers.map(esc).join(";"),
    ...rows.map((r) => r.map(esc).join(";"))
  ].join("\n");
  const tsv = [
    headers.join("\t"),
    ...rows.map((r) => r.map((x) => String(x ?? "").replace(/[\t\n]/g, " ")).join("\t"))
  ].join("\n");
  const fichier = `${nom}_${today()}${filtre ? `_${filtre}` : ""}.csv`;
  if (exportApi) exportApi.open({ nom, fichier, csv, tsv, headers, rows, lignes: rows.length });
}
