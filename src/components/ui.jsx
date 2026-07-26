// ============================================================
// components/ui.jsx — composants UI de base (Field, Badge, Panel...),
// l'écran de chargement, et le système de dialogues intégrés
// (uAlert/uConfirm/uPrompt/uChoix) utilisé partout au lieu des
// window.alert/confirm/prompt natifs du navigateur.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { col, light } from "../lib/core";
import { LOGO } from "../lib/constants";
import { genererPDF } from "../pdf";

// ============ COMPOSANTS UI ============
export const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100";
export const btnDark = "px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 transition-colors shadow-sm";

export const Badge = ({ boutique }) => (
  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: col(boutique) }}>{boutique}</span>
);

export const Panel = ({ boutique, children }) => (
  <div className="rounded-xl p-4 border-2" style={{ borderColor: col(boutique), backgroundColor: light(boutique) }}>{children}</div>
);

// ============ COMPOSANT DE CHARGEMENT ============
export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      <span className="ml-3 text-sm text-slate-500">Chargement...</span>
    </div>
  );
}

// ============ DIALOGUES INTÉGRÉS ============
export let dialogApi = null;
export const uAlert = (m) => (dialogApi ? dialogApi.open("alert", m) : Promise.resolve());
export const uConfirm = (m) => (dialogApi ? dialogApi.open("confirm", m) : Promise.resolve(false));
export const uPrompt = (m, def = "") => (dialogApi ? dialogApi.open("prompt", m, def) : Promise.resolve(null));
// Choix STRICT parmi une liste fixe de boutons — pas de texte libre, donc pas
// de faute de frappe ni de valeur inventée possible.
export const uChoix = (m, options) => (dialogApi ? dialogApi.open("choix", m, null, options) : Promise.resolve(null));

export function DialogHost() {
  const [d, setD] = useState(null);
  const [val, setVal] = useState("");
  dialogApi = {
    open: (type, m, def = "", options = []) => new Promise((resolve) => { setVal(def == null ? "" : String(def)); setD({ type, m, resolve, options }); }),
  };
  if (!d) return null;
  const close = (result) => { d.resolve(result); setD(null); };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5">
        <div className="text-sm text-slate-800 whitespace-pre-line font-medium">{d.m}</div>
        {d.type === "prompt" && (
          <input autoFocus className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-slate-900"
            value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && close(val)} />
        )}
        {d.type === "choix" && (
          <div className="mt-3 space-y-2">
            {d.options.map((opt) => (
              <button key={opt} onClick={() => close(opt)} className="w-full text-left px-3 py-2.5 rounded-lg border-2 border-slate-200 hover:border-sky-700 hover:bg-sky-50 text-sm font-bold text-slate-700">{opt}</button>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {d.type !== "alert" && d.type !== "choix" && <button onClick={() => close(d.type === "prompt" ? null : false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>}
          {d.type === "choix" && <button onClick={() => close(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Annuler</button>}
          {d.type !== "choix" && <button onClick={() => close(d.type === "prompt" ? val : true)} className="px-4 py-2 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">OK</button>}
        </div>
      </div>
    </div>
  );
}

// ============ APERÇU AVANT IMPRESSION ============
// printApi est lu depuis lib/impression.js (liaison ES module « live » :
// dès que PrintHost le réaffecte ci-dessous, les imports le voient aussitôt
// à jour — aucun setter séparé n'est nécessaire ici).
export let printApi = null;
export function PrintHost() {
  const [html, setHtml] = useState(null);
  printApi = { open: (h) => setHtml(h) };
  if (!html) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #zone-impression, #zone-impression * {
          visibility: visible !important;
          /* Sans ceci, le navigateur supprime les fonds colorés à l'impression :
             les en-têtes de tableau (texte blanc sur fond bleu) sortaient en
             blanc sur blanc — invisibles — et les bandeaux disparaissaient.
             C'était l'écart entre l'aperçu et le papier. */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #zone-impression { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-height: none !important; overflow: visible !important; padding: 0 !important; }
      }
      @page { size: A4; margin: 12mm; }`}</style>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="font-bold text-slate-900 text-sm">Aperçu avant impression</div>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">🖨 Imprimer / Enregistrer en PDF</button>
            <button onClick={() => setHtml(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
          </div>
        </div>
        <div id="zone-impression" className="overflow-auto p-4" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ============ EXPORT (CSV / Excel / PDF) ============
export let exportApi = null;
export function ExportHost() {
  const [d, setD] = useState(null);
  const [info, setInfo] = useState("");
  exportApi = { open: (data) => { setInfo(""); setD(data); } };
  if (!d) return null;

  const telecharger = () => {
    try {
      const blob = new Blob([d.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.fichier;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setInfo("Téléchargement lancé. Si rien ne se passe, utilisez « Copier pour Excel ».");
    } catch {
      setInfo("Téléchargement impossible ici. Utilisez « Copier pour Excel ».");
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(d.tsv);
      setInfo("✓ Copié ! Ouvrez Excel et collez (Ctrl+V) : les colonnes se placeront automatiquement.");
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = d.tsv;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setInfo("✓ Copié ! Ouvrez Excel et collez (Ctrl+V) : les colonnes se placeront automatiquement.");
      } catch {
        setInfo("Copie impossible. Sélectionnez le texte ci-dessous et copiez-le manuellement.");
      }
    }
  };

  const pdf = () => {
    try {
      genererPDF(d, LOGO);
      setInfo("✓ Fichier PDF généré ! Vérifiez votre dossier Téléchargements (ou la fenêtre d'enregistrement).");
    } catch (e) {
      setInfo("Échec de la génération PDF : " + (e?.message || e));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <div className="font-bold text-slate-900">Exporter : {d.nom}</div>
        <div className="text-xs text-slate-500 mt-1">{d.lignes} ligne(s) — {d.fichier}</div>
        <div className="mt-4 flex flex-col gap-2">
          <button onClick={pdf} className="w-full py-2.5 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">📄 Télécharger en PDF</button>
          <button onClick={telecharger} className="w-full py-2.5 rounded-lg bg-sky-800 text-white text-sm font-bold hover:bg-sky-900">📥 Télécharger le fichier CSV</button>
          <button onClick={copier} className="w-full py-2.5 rounded-lg border-2 border-slate-900 text-slate-900 text-sm font-bold hover:bg-slate-50">📋 Copier pour Excel</button>
        </div>
        {info && <div className="mt-3 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg p-2">{info}</div>}
        {info.startsWith("Copie impossible") && (
          <textarea readOnly className="mt-2 w-full h-32 rounded-lg border border-slate-300 p-2 text-xs font-mono" value={d.tsv} onFocus={(e) => e.target.select()} />
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={() => setD(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}

// Petite ligne étiquette/valeur utilisée dans les fiches (devis, chantiers…)
export const Info = ({ label, valeur }) => (
  <div className="rounded-xl p-3 bg-white border border-slate-200">
    <div className="text-xs font-semibold text-slate-500 uppercase">{label}</div>
    <div className="text-sm font-bold mt-0.5">{valeur || "—"}</div>
  </div>
);
