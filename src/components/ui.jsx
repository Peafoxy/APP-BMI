// ============================================================
// components/ui.jsx — composants UI de base (Field, Badge, Panel...),
// l'écran de chargement, et le système de dialogues intégrés
// (uAlert/uConfirm/uPrompt/uChoix) utilisé partout au lieu des
// window.alert/confirm/prompt natifs du navigateur.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { col, light, moyensProposes } from "../lib/core";
import { LOGO } from "../lib/constants";
import { libelleBanque } from "../lib/banques";
import { genererPDF } from "../pdf";
// Timo (14/09/2026) : « sur tous les fichiers générés par l'app, un bouton
// Partager » — le document de l'aperçu devient un PDF (image de la page,
// html2canvas + jsPDF) remis à la feuille de partage du téléphone (WhatsApp,
// mail…) ; sans partage possible (ordinateur), le PDF est simplement
// enregistré. Écrit UNE fois, ici, pour tout document qui passe par l'aperçu.
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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

// ⚠ UNE RÈGLE POUR TOUTE LIGNE DE RECHERCHE (Timo, 18/09/2026, capture de
// 🧰 Outillage : « réduire la ligne rechercher un outil, trop long… mais
// est-ce que ce n'est pas mieux d'avoir une seule règle qui gère ce côté de
// ligne de recherche ? »). HUIT largeurs coexistaient pour le même geste —
// w-48, w-52, w-56, w-64, max-w-xs, max-w-[220px] et trois en pleine largeur.
// Pleine largeur sur TÉLÉPHONE (c'est là qu'on en a besoin), bridée sur
// ordinateur : une ligne de recherche ne traverse pas l'écran.
export const champRecherche = `${inputCls} sm:w-80`;

// ---- UN champ libre qui GRANDIT avec le texte (14/09/2026) ----
// Timo, devant la case Remarques de la clôture : « la ligne de la remarque
// est trop longue, la raccourcir, et si le texte augmente, la case aussi
// augmente de taille ». Une seule ligne au départ, autant qu'il en faut
// ensuite (jusqu'à `maxLignes`), sans barre de défilement ni poignée.
// Écrit UNE fois : tout champ de texte libre de l'application y passe.
export const ChampQuiGrandit = ({ valeur, onChange, placeholder, className = inputCls, maxLignes = 6 }) => {
  const ref = useRef(null);
  const ajuster = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxLignes * 20 + 18)}px`;
  };
  useEffect(() => { ajuster(ref.current); }, [valeur]);
  return (
    <textarea ref={ref} rows={1} className={`${className} resize-none overflow-hidden`} value={valeur} placeholder={placeholder}
      onChange={(e) => { onChange(e.target.value); ajuster(e.target); }} />
  );
};
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

export const btnDark = "px-5 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900 shadow-sm";

// Une liste d'articles dans une cellule de tableau (Ventes, Dettes) :
// UN article par ligne, deux au plus puis « + N autres ▾ » ; dépliée, tout
// et « ▴ Replier ». Timo (12/09/2026, Ventes) puis (13/09/2026) « appliquer
// la même règle que dans Ventes pour restructurer les dettes » — la brique
// est écrite ici UNE fois. Lignes : { qte, article } (qte peut être vide :
// un motif libre s'affiche sans « × »).
export const ARTICLES_VISIBLES = 2;
export function ListeArticles({ lignes, deplie = false, enfants = null }) {
  const reste = lignes.length - ARTICLES_VISIBLES;
  const montrees = deplie ? lignes : lignes.slice(0, ARTICLES_VISIBLES);
  return (
    <div className="leading-snug">
      {montrees.map((l, i) => (
        <div key={i} className="truncate max-w-[340px]">{l.qte != null && l.qte !== "" && <><span className="tabular-nums text-slate-500">{l.qte}×</span> </>}<span className="font-semibold text-slate-800">{l.article}</span></div>
      ))}
      {reste > 0 && !deplie && <div className="text-xs font-semibold text-sky-700">+ {reste} autre{reste > 1 ? "s" : ""} ▾</div>}
      {reste > 0 && deplie && <div className="text-xs font-semibold text-sky-700">▴ Replier</div>}
      {enfants}
    </div>
  );
}
// Un bouton d'action rond : l'icône seule, le libellé au survol (title).
export const boutonAction = (teinte) => `inline-flex items-center justify-center w-8 h-8 rounded-full border text-sm ${teinte}`;
// La ligne d'un tableau qu'on déplie au clic (Ventes, Dettes) : UNE ligne
// dépliée à la fois, fond bleu soutenu + barre épaisse à gauche (couleur de
// l'espace : violet en formation), sinon zébrage et survol.
export const fondLigneDepliable = (deplie, i, fondSinon = "") => deplie ? "bg-sky-200" : (fondSinon || (i % 2 ? "bg-slate-50/60" : "bg-white"));
export const classeLigneDepliable = (deplie, i, fondSinon = "") => deplie ? "bg-sky-200 shadow-[inset_6px_0_0_0_var(--color-sky-700)]" : `hover:bg-sky-50 ${fondLigneDepliable(false, i, fondSinon)}`;
// La PREMIÈRE colonne d'un tableau reste FIGÉE pendant le défilement
// horizontal (Timo, 10/09/2026 « figer le nom de l'article » puis 13/09/2026
// « faire pareil dans Dépenses et Dettes… cette règle doit aussi s'appliquer
// sur Windows ») : téléphone ET ordinateur. Écrit UNE fois : l'en-tête et la
// cellule portent leur fond (une cellule collée sans fond laisserait passer
// les colonnes qui glissent dessous) ; une ligne dépliée garde sa barre bleue.
export const enTeteFige = (fond = "bg-slate-100") => `sticky left-0 z-20 ${fond} shadow-[2px_0_0_0_#e2e8f0]`;
export const celluleFigee = (fond = "bg-white", deplie = false) => `sticky left-0 z-[5] ${fond} ${deplie ? "shadow-[inset_6px_0_0_0_var(--color-sky-700),2px_0_0_0_#e2e8f0]" : "shadow-[2px_0_0_0_#e2e8f0]"} max-w-[180px]`;

// Le VRAI logo WhatsApp (Timo, 12/09/2026 : « remplacer l'icône de WhatsApp
// par le vrai icône WhatsApp ») : dessiné en SVG, vert WhatsApp, à la taille
// du texte — l'emoji 💬 ne ressemblait à rien de connu. Écrit une fois, pour
// tout bouton qui envoie sur WhatsApp.
export const IconeWhatsApp = ({ taille = 18 }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);
// 👆 L'empreinte, en trait — écrite UNE fois, comme le logo WhatsApp.
// Un dessin plutôt qu'un emoji : sur la fenêtre de verrou c'est un GROS
// bouton rond (capture Timo, 16/09/2026, l'exemple d'une autre application),
// et un emoji y serait flou et de travers selon les téléphones.
export const IconeEmpreinte = ({ taille = 30 }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M12 11c0 3.5-.3 6-1 8" />
    <path d="M8.5 11a3.5 3.5 0 0 1 7 0c0 3-.4 5.5-1.2 7.6" />
    <path d="M5.5 12a6.5 6.5 0 0 1 13 0c0 2.4-.3 4.6-.9 6.5" />
    <path d="M3.2 8.5A9.5 9.5 0 0 1 12 2.5c2.6 0 5 1 6.7 2.7" />
    <path d="M8.2 20.5c.8-2 1.3-4.4 1.3-8a2.5 2.5 0 0 1 5 0" />
  </svg>
);
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

// ---- Les questions posées partout, écrites UNE fois (points B1 et B4 du
// relevé des doublons, Timo : « lance tout », 08/09/2026) ----
// « Moyen de paiement » était tapé à 13 endroits avec 5 formulations ; un
// moyen ajouté un jour aurait manqué quelque part. La question vit ici.
// ⚠ 14/09/2026, Timo : « et si ce mode était à sélectionner ? » — la réponse
// était TAPÉE, et un mot non reconnu retombait en silence sur « Espèces »
// (taper « BTCI » enregistrait un virement comme de l'argent liquide). Ce
// sont maintenant des BOUTONS : plus de faute de frappe possible.
// complement : « pour KOSSI », « à FOURNISSEUR X », « de la CNSS »… ;
// defaut : le moyen proposé, placé en PREMIER bouton ; libelle : « Moyen de
// paiement » sauf cas particulier (« Moyen de remise des fonds », « Moyen de
// paiement reçu ») ; beneficiaire : la fiche de la personne payée, dont la
// BANQUE est rappelée sous la question (14/09/2026 : « si banque, dans la
// fiche de l'utilisateur, on devrait ajouter le nom de la banque »).
const rappelBanque = (b) => {
  if (!b) return "";
  const l = libelleBanque(b);
  const qui = b.nom || "cette personne";
  return l ? `\n\n🏦 Banque de ${qui} : ${l}`
    : `\n\n🏦 Aucune banque sur la fiche de ${qui} (👥 Utilisateurs → ⋯ Gérer → 🏦 Banque).`;
};
export const demanderMoyenPaiement = (complement = "", defaut = "Espèces", libelle = "Moyen de paiement", beneficiaire = null) =>
  uChoix(`${libelle}${complement ? ` ${complement}` : ""} :${rappelBanque(beneficiaire)}`, moyensProposes(defaut));
// Un mois « AAAA-MM » ou une date « AAAA-MM-JJ » : la question, le contrôle
// du format et le message d'erreur, les mêmes partout. Renvoient la valeur
// nettoyée, "" si facultatif et laissé vide, null si annulé ou refusé.
export const estMoisValide = (t) => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(t ?? "").trim());
export const estDateValide = (t) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(String(t ?? "").trim());
export const demanderMois = async (question, defaut = new Date().toISOString().slice(0, 7)) => {
  const m = await uPrompt(`${question} (AAAA-MM) :`, defaut);
  if (m === null || m === undefined || !String(m).trim()) return null;
  if (!estMoisValide(m)) { uAlert(`Format attendu : AAAA-MM (ex : ${new Date().toISOString().slice(0, 7)}).`); return null; }
  return String(m).trim();
};
export const demanderDate = async (question, defaut = "", facultatif = false) => {
  const d = await uPrompt(`${question} (AAAA-MM-JJ${facultatif ? ", facultatif" : ""}) :`, defaut);
  if (d === null || d === undefined) return null;
  const t = String(d).trim();
  if (!t) return facultatif ? "" : null;
  if (!estDateValide(t)) { uAlert(`Format attendu : AAAA-MM-JJ (ex : ${new Date().toISOString().slice(0, 10)}).`); return null; }
  return t;
};

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

// Le format de page de l'aperçu (« size: A4; margin: 12mm; » ou une étiquette
// « size: 60mm 30mm; … ») lu pour le PDF partagé : [largeur mm, hauteur mm, marge mm].
export function dimensionsPage(page = PAGE_A4) {
  const m = /size:\s*([\d.]+)mm\s+([\d.]+)mm/i.exec(String(page || ""));
  const marge = /margin:\s*([\d.]+)mm/i.exec(String(page || ""));
  return m ? [Number(m[1]), Number(m[2]), marge ? Number(marge[1]) : 0] : [210, 297, marge ? Number(marge[1]) : 12];
}
// Le nom du fichier partagé : « Reçu - MR ERIC - BMID-2026-0014.pdf ».
export const nomFichierPartage = (titre) => `${String(titre || "Document").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s{2,}/g, " ").trim() || "Document"}.pdf`;
// Le PDF du document de l'aperçu. ⚠ Deux captures de Timo (14/09/2026) : le
// PDF partagé depuis le téléphone sortait à la LARGEUR DE L'ÉCRAN (étroit,
// tableau coupé en deux pages) alors que l'impression donnait une belle page
// A4. Le document est donc rendu HORS ÉCRAN, à une largeur fixe de page
// (LARGEUR_RENDU_PX, la largeur d'une A4 à l'écran), quel que soit l'appareil,
// puis découpé en pages en cherchant une ligne BLANCHE (jamais au milieu
// d'une ligne de tableau ou de texte). Le rendu se mesure dans Chromium ;
// dimensionsPage, nomFichierPartage et positionCoupe sont purs (banc).
export const LARGEUR_RENDU_PX = 794;
// Où couper : au plus bas possible avant `limite`, sur une ligne entièrement
// blanche ; sinon à `limite`. `estBlanche(y)` est fournie par le rendu.
export function positionCoupe(limite, hauteurTotale, estBlanche, marge = 0.2) {
  if (limite >= hauteurTotale) return hauteurTotale;
  const plancher = Math.max(1, Math.floor(limite * (1 - marge)));
  for (let y = limite; y >= plancher; y--) if (estBlanche(y)) return y;
  return limite;
}
const ligneBlanche = (ctx, largeur) => (y) => {
  const d = ctx.getImageData(0, y, largeur, 1).data;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) return false;
  return true;
};
// Le rectangle réellement occupé par le document dans le cadre hors écran
// (l'union des boîtes de ses éléments visibles), en pixels CSS relatifs au
// cadre — un petit air de 4 px autour, jamais hors du cadre.
export function cadreContenu(conteneur, air = 4) {
  const base = conteneur.getBoundingClientRect();
  let g = Infinity, d = -Infinity, h = Infinity, b = -Infinity;
  conteneur.querySelectorAll("*").forEach((el) => {
    if (el.tagName === "STYLE" || el.tagName === "SCRIPT") return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    g = Math.min(g, r.left); d = Math.max(d, r.right); h = Math.min(h, r.top); b = Math.max(b, r.bottom);
  });
  if (!Number.isFinite(g)) return { x: 0, y: 0, largeur: base.width, hauteur: base.height };
  const x = Math.max(0, g - base.left - air), y = Math.max(0, h - base.top - air);
  return { x, y, largeur: Math.min(base.width - x, d - base.left + air - x), hauteur: Math.min(base.height - y, b - base.top + air - y) };
}
const rogner = (toile, cadre, echelle) => {
  const sx = Math.round(cadre.x * echelle), sy = Math.round(cadre.y * echelle);
  const sw = Math.max(1, Math.min(toile.width - sx, Math.round(cadre.largeur * echelle)));
  const sh = Math.max(1, Math.min(toile.height - sy, Math.round(cadre.hauteur * echelle)));
  const c = document.createElement("canvas"); c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(toile, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
};
export async function pdfDeLApercu(html, page = PAGE_A4) {
  const [largeur, hauteur, marge] = dimensionsPage(page);
  // Rendu hors écran, à la largeur d'une page — jamais à celle du téléphone.
  const horsEcran = document.createElement("div");
  horsEcran.id = "zone-impression";
  horsEcran.style.cssText = `position:fixed;left:-20000px;top:0;width:${LARGEUR_RENDU_PX}px;background:#fff;padding:16px;box-sizing:border-box;z-index:-1`;
  horsEcran.innerHTML = html;
  document.body.appendChild(horsEcran);
  try {
    const brute = await html2canvas(horsEcran, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, width: LARGEUR_RENDU_PX, windowWidth: LARGEUR_RENDU_PX });
    // ⚠ Capture Timo (14/09/2026) : « les marges sont trop grandes » — le reçu
    // (680 px) était posé au centre du cadre de 794 px, et ce blanc s'ajoutait
    // à la marge de la page. On ROGNE l'image au contenu réel (cadreContenu),
    // pour que le document remplisse la page comme à l'impression.
    const cadre = cadreContenu(horsEcran);
    const toile = rogner(brute, cadre, 2);
    const doc = new jsPDF({ orientation: largeur > hauteur ? "landscape" : "portrait", unit: "mm", format: [largeur, hauteur] });
    const utileL = largeur - 2 * marge, utileH = hauteur - 2 * marge;
    const echelle = utileL / toile.width;              // mm par pixel
    const hauteurPageEnPx = Math.floor(utileH / echelle);
    const blanche = ligneBlanche(toile.getContext("2d"), toile.width);
    let y = 0, premiere = true;
    while (y < toile.height) {
      const fin = positionCoupe(Math.min(y + hauteurPageEnPx, toile.height), toile.height, blanche);
      const h = Math.max(1, fin - y);
      const morceau = document.createElement("canvas");
      morceau.width = toile.width; morceau.height = h;
      morceau.getContext("2d").drawImage(toile, 0, y, toile.width, h, 0, 0, toile.width, h);
      if (!premiere) doc.addPage([largeur, hauteur], largeur > hauteur ? "landscape" : "portrait");
      doc.addImage(morceau.toDataURL("image/jpeg", 0.92), "JPEG", marge, marge, utileL, h * echelle);
      premiere = false; y = fin;
    }
    return doc;
  } finally {
    horsEcran.remove();
  }
}
export async function partagerDocument(html, titre, page = PAGE_A4) {
  const doc = await pdfDeLApercu(html, page);
  const nom = nomFichierPartage(titre);
  const fichier = new File([doc.output("blob")], nom, { type: "application/pdf" });
  if (typeof navigator !== "undefined" && navigator.share && (!navigator.canShare || navigator.canShare({ files: [fichier] }))) {
    try { await navigator.share({ files: [fichier], title: titre }); return "partage"; }
    catch (e) { if (e && e.name === "AbortError") return "annule"; }
  }
  doc.save(nom);
  return "enregistre";
}

export function PrintHost() {
  const [html, setHtml] = useState(null);
  const [titreDoc, setTitreDoc] = useState("Document");
  const [page, setPage] = useState(PAGE_A4);
  const [partageEnCours, setPartageEnCours] = useState(false);
  const partager = async () => {
    if (partageEnCours) return;
    setPartageEnCours(true);
    try {
      const r = await partagerDocument(html, titreDoc, page);
      if (r === "enregistre") uAlert("Le partage n'est pas proposé par ce navigateur : le PDF a été enregistré sur l'appareil, vous pouvez l'envoyer depuis vos fichiers.");
    } catch (e) {
      uAlert("Impossible de préparer le fichier à partager. Utilisez « Imprimer / Enregistrer en PDF ».");
    } finally { setPartageEnCours(false); }
  };
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
          {/* Timo (14/09/2026) : « Partager à la place de "Aperçu avant impression",
              exclusivement sur téléphone ; sous Windows, en plus de ce bouton, garder
              toujours "Aperçu avant impression" ». */}
          <div className="font-bold text-slate-900 text-sm hidden sm:block">Aperçu avant impression</div>
          <div className="flex gap-2">
            <button onClick={partager} disabled={partageEnCours} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800 disabled:opacity-60" data-action="partager">{partageEnCours ? "⏳ Préparation…" : "📤 Partager"}</button>
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
