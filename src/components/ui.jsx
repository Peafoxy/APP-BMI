// ============================================================
// components/ui.jsx — composants UI de base (Field, Badge, Panel...),
// l'écran de chargement, et le système de dialogues intégrés
// (uAlert/uConfirm/uPrompt/uChoix) utilisé partout au lieu des
// window.alert/confirm/prompt natifs du navigateur.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { col, light } from "../lib/core";
import { LOGO } from "../lib/constants";
import { genererPDF } from "../pdf";

// ============ COMPOSANTS UI ============
// ⚠ Pagination (demande Timo, réponse à "l'app va-t-elle ramer") : la
// donnée est déjà TOUTE chargée en local (offline-first) — pas besoin de
// redemander une page au serveur comme dans une app classique. On découpe
// juste l'AFFICHAGE, pour ne jamais rendre des milliers de lignes DOM à la
// fois. Se réinitialise à la page 1 quand la longueur de la liste change
// (nouveau filtre, recherche...) pour éviter une page vide.
export function usePagination(liste, parPage = 50) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(liste.length / parPage));
  const pageAffichee = Math.min(page, totalPages);
  useEffect(() => { setPage(1); }, [liste.length]);
  const debut = (pageAffichee - 1) * parPage;
  const pageItems = liste.slice(debut, debut + parPage);
  return { page: pageAffichee, setPage, totalPages, pageItems, parPage };
}

export function Pagination({ page, setPage, totalPages }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">← Précédent</button>
      <span className="text-sm text-slate-500">Page {page} / {totalPages}</span>
      <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50">Suivant →</button>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

export const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:border-sky-700 focus:ring-2 focus:ring-sky-100";
// ============ LES CASES DE CHIFFRES — UNE TEINTE PAR NATURE ============
//
// ⚠ DEMANDE TIMO (26/08/2026) : « avec cet aspect des cases, ça se reconnaît
// que c'est un travail d'IA ». Puis, en voyant les maquettes : « apparemment
// le 1 reprend la couleur de la bande des onglets ». Il avait raison, et le
// problème dépassait l'esthétique : dans cette application, un bloc bleu
// plein veut déjà dire « ceci se clique » (onglet actif sky-700, boutons
// sky-800). L'œil prenait les chiffres pour des boutons.
//
// La couleur cesse donc d'être une décoration : elle porte du sens. On
// repère la case sans lire son libellé, et le bleu reste réservé à la
// navigation.
//
// ⚠ CE COMPOSANT EST PARTAGÉ PAR LES SEPT ÉCRANS. C'est tout l'intérêt :
// sept copies auraient dérivé, et « bleu » aurait fini par vouloir dire
// autre chose ici que là.
export const TEINTES_STAT = {
  entree:    { fond: "bg-sky-50 border-sky-200",         titre: "text-sky-800",     valeur: "text-slate-900" },
  sortie:    { fond: "bg-amber-50 border-amber-200",     titre: "text-amber-800",   valeur: "text-amber-950" },
  du:        { fond: "bg-red-50 border-red-200",         titre: "text-red-800",     valeur: "text-red-900" },
  regle:     { fond: "bg-green-50 border-green-200",     titre: "text-green-800",   valeur: "text-green-900" },
  attente:   { fond: "bg-orange-50 border-orange-200",   titre: "text-orange-800",  valeur: "text-orange-900" },
  neutre:    { fond: "bg-slate-100 border-slate-200",    titre: "text-slate-600",   valeur: "text-slate-900" },
  // ⚠ Le dimensionnement n'affiche PAS de l'argent mais des résultats de
  // calcul (puissance, nombre de panneaux, autonomie). Leur donner une
  // couleur d'argent mentirait sur ce qu'ils sont : ils ont donc leur propre
  // famille, qui ne ressemble à aucune des six autres.
  technique: { fond: "bg-violet-50 border-violet-200",   titre: "text-violet-800",  valeur: "text-violet-950" },
};

// `nature`  : ce que le chiffre EST (voir ci-dessus).
// `accent`  : à n'utiliser que si la couleur dépend du CHIFFRE et non de sa
//             nature — un taux de marge sous les 15 %, par exemple.
// `compact` : version resserrée, pour les grilles denses (CNSS).
export const Stat = ({ label, value, valeur, nature = "neutre", accent, compact }) => {
  const t = TEINTES_STAT[nature] || TEINTES_STAT.neutre;
  const contenu = value !== undefined ? value : valeur;
  return (
    <div className={`rounded-xl border shadow-sm ${compact ? "p-3" : "p-4"} ${t.fond}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${t.titre}`}>{label}</div>
      <div className={`text-xl font-bold mt-1 tabular-nums ${accent || t.valeur}`}>{contenu}</div>
    </div>
  );
};

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
  // ⚠ z-[70], PAS z-50 (vécu par Timo, 31/08/2026, signature du contrat) :
  // les grandes fenêtres des écrans (contrat, PV…) sont à z-50 et arrivent
  // APRÈS dans la page — à profondeur égale, elles passaient DEVANT. La
  // question « Valider ce devis ? » s'ouvrait donc DERRIÈRE la fenêtre du
  // contrat : invisible, incliquable, et la validation attendait sans fin
  // (« la page refuse de quitter »). Une boîte de dialogue doit TOUJOURS
  // être au-dessus de tout (l'aperçu d'impression est à z-[60]).
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-4">
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
// ⚠ Le format de page était figé sur A4 (demande Timo, 25/08/2026 : rouleaux
// d'étiquettes 80×40 mm). Une étiquette envoyée sur une page A4 sort dans un
// coin de la feuille et gaspille le rouleau : chaque document peut désormais
// imposer le sien.
export const PAGE_A4 = "size: A4; margin: 12mm;";
// Impression par DOCUMENT DÉDIÉ : le HTML du document est écrit dans une
// iframe invisible qui possède sa propre page, en flux normal. C'est la seule
// méthode où la pagination (sauts de page du DUPLICATA compris) est fiable à
// 100 % : aucune interférence avec les styles, portails ou positionnements de
// l'application. Les gabarits étant préfixés « #zone-impression », le contenu
// est enveloppé dans un div portant cet id.
// ⚠ `titre` (demande Timo — "le nom par défaut est BMI gestion système pour
// tout les documents") : sans balise <title> sur ce document dédié, le
// navigateur reprend le titre de la page PRINCIPALE de l'app comme nom de
// fichier suggéré à l'impression/enregistrement PDF — identique pour TOUS
// les documents. Avec cette balise, chaque document propose son propre nom
// (numéro de reçu, de devis, de contrat...).
function imprimerDocumentDedie(html, titre = "Document", page = PAGE_A4) {
  const cadre = document.createElement("iframe");
  cadre.setAttribute("aria-hidden", "true");
  cadre.style.cssText = "position:absolute;width:0;height:0;border:0;overflow:hidden";
  document.body.appendChild(cadre);
  const d = cadre.contentDocument;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${String(titre).replace(/[<>&]/g, "")}</title><style>
    @page { ${page} }
    body { margin: 0; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .saut-page { break-before: page !important; page-break-before: always !important; }
  </style></head><body><div id="zone-impression">${html}</div></body></html>`);
  d.close();
  // ⚠ Correctif du correctif (capture Timo, app Windows/Electron) : le
  // titre posé sur l'IFRAME (ci-dessus) est ignoré par la boîte de
  // dialogue "Enregistrer en PDF" de Chromium/Electron — elle reprend le
  // titre de la page PRINCIPALE (index.html, "BMI-Gestion Système"), pas
  // celui du cadre imprimé, même quand c'est bien ce cadre qui déclenche
  // l'impression. Technique fiable : changer temporairement le titre de la
  // page principale pendant l'impression, puis le restaurer juste après.
  const titrePrincipalOriginal = document.title;
  const lancer = () => {
    document.title = titre;
    try {
      const w = cadre.contentWindow;
      w.focus();
      w.print();
    } catch { /* environnement sans impression (tests) */ }
    setTimeout(() => { document.title = titrePrincipalOriginal; }, 1000);
    setTimeout(() => { try { cadre.remove(); } catch {} }, 60000);
  };
  if (d.readyState === "complete") setTimeout(lancer, 50);
  else cadre.addEventListener("load", () => setTimeout(lancer, 50));
}

export function PrintHost() {
  const [html, setHtml] = useState(null);
  const [titreDoc, setTitreDoc] = useState("Document");
  const [page, setPage] = useState(PAGE_A4);
  printApi = { open: (h, titre, formatPage) => { setTitreDoc(titre || "Document"); setPage(formatPage || PAGE_A4); setHtml(h); } };
  if (!html) return null;
  return createPortal(
    <div className="portail-impression fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-3">
      <style>{`@media print {
        /* Le PrintHost est rendu par un portail DIRECTEMENT sous <body>
           (hors de #root) : on peut donc masquer toute l'application par
           display:none et laisser la zone d'impression en flux NORMAL.
           C'est indispensable : en position absolue, Chrome IGNORE les
           sauts de page — le DUPLICATA ne commençait jamais en page 2. */
        body > *:not(.portail-impression) { display: none !important; }
        .portail-impression { position: static !important; padding: 0 !important; background: none !important; display: block !important; }
        .portail-impression .cadre-apercu { position: static !important; max-height: none !important; box-shadow: none !important; border-radius: 0 !important; display: block !important; }
        .portail-impression .barre-apercu { display: none !important; }
        #zone-impression { max-height: none !important; overflow: visible !important; padding: 0 !important; }
        #zone-impression, #zone-impression * {
          /* Sans ceci, le navigateur supprime les fonds colorés à l'impression :
             les en-têtes de tableau (texte blanc sur fond bleu) sortiraient en
             blanc sur blanc. */
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        #zone-impression .saut-page { break-before: page !important; page-break-before: always !important; }
      }
      @page { ${page} }`}</style>
      <div className="cadre-apercu bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[92vh]">
        <div className="barre-apercu flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
          <div className="font-bold text-slate-900 text-sm">Aperçu avant impression</div>
          <div className="flex gap-2">
            <button onClick={() => imprimerDocumentDedie(html, titreDoc, page)} className="px-4 py-2 rounded-lg bg-blue-700 text-white text-sm font-bold hover:bg-blue-800">🖨 Imprimer / Enregistrer en PDF</button>
            <button onClick={() => setHtml(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">Fermer</button>
          </div>
        </div>
        <div id="zone-impression" className="overflow-auto p-4" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>,
    document.body
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

// ⚠ Cloisonnement formation / réel : affiché à la place du formulaire quand
// AUCUNE boutique de l'espace du compte n'est disponible. Auparavant, ces
// écrans retombaient silencieusement sur db.boutiques[0] — la première
// boutique de la base, donc une vraie — et écrivaient dedans sans que rien
// ne le signale. Mieux vaut une page qui explique qu'un formulaire piégé.
export const AucuneBoutique = ({ formation }) => (
  <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-center">
    <div className="text-3xl mb-2">{formation ? "🎓" : "🏪"}</div>
    <div className="font-bold text-amber-900">
      Aucune boutique {formation ? "de formation" : "réelle"} n'est disponible
    </div>
    <div className="text-sm text-amber-800 mt-2 max-w-md mx-auto">
      Votre compte travaille dans l'espace <b>{formation ? "formation" : "réel"}</b>, et aucune boutique
      de cet espace n'existe pour l'instant. Rien ne peut être enregistré ici tant que ce n'est pas le cas —
      c'est volontaire : sans cette barrière, votre saisie partirait dans l'autre espace.
    </div>
    <div className="text-xs text-amber-700 mt-3">
      Demandez à l'administrateur {formation ? "de créer une boutique de formation (⚙ Paramètres)" : "de vérifier le rattachement de votre compte"}.
    </div>
  </div>
);
