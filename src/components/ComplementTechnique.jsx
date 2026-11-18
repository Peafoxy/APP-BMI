// ============================================================
// components/ComplementTechnique.jsx — « 🧩 COMPLÉMENT DE LA FICHE » d'un devis
// solaire (Timo, 17/11/2026). Les règles vivent dans lib/complementTechnique.js.
//
// UN formulaire (`FormulaireComplement`), deux endroits : le volet ☀️ Solaire du
// devis (`BlocComplementTechnique`, pendant l'élaboration) et 📋 Tous les devis
// (`ComplementDuDevis`, après coup). Tout est facultatif : on remplit ce
// qu'on sait, le reste s'écrit « à confirmer » dans le document technique.
// Les sections de câble se CHOISISSENT dans une liste (décision « C »).
// L'écran ne décide d'aucun droit : le geste de 📋 Tous les devis revérifie.
// ============================================================
import { useState } from "react";
import { Field, inputCls } from "./ui";
import {
  CABLES, PROTECTIONS, SECTIONS_CABLE, SUPPORTS, ORIENTATIONS, LOCAL_MAX, CALIBRE_MAX, AUTRES_MAX, NOM_PROTECTION_MAX,
  resumeComplement, avertissementMontage, nettoyerComplement,
} from "../lib/complementTechnique";

const titre = "text-xs font-bold uppercase tracking-wide text-slate-500 mt-3 mb-1";

export function FormulaireComplement({ valeur, onChange, panneaux = null }) {
  const c = valeur && typeof valeur === "object" ? valeur : {};
  const maj = (groupe, cle, v) => onChange({ ...c, [groupe]: { ...(c[groupe] || {}), [cle]: v } });
  const majSous = (groupe, id, cle, v) => onChange({ ...c, [groupe]: { ...(c[groupe] || {}), [id]: { ...((c[groupe] || {})[id] || {}), [cle]: v } } });
  const imp = c.implantation || {};
  const mon = c.montage || {};
  const libres = Array.isArray(c.protections_libres) ? c.protections_libres : [];
  const majLibre = (i, cle, v) => onChange({ ...c, protections_libres: libres.map((l, j) => (j === i ? { ...l, [cle]: v } : l)) });
  const avertissement = avertissementMontage(c, panneaux);
  return (
    <div data-formulaire-complement>
      <div className={titre}>📍 Implantation</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Support des panneaux">
          <select className={inputCls} value={imp.support || ""} onChange={(e) => maj("implantation", "support", e.target.value)} data-complement="support">
            <option value="">— À confirmer —</option>
            {SUPPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Orientation">
          <select className={inputCls} value={imp.orientation || ""} onChange={(e) => maj("implantation", "orientation", e.target.value)} data-complement="orientation">
            <option value="">— À confirmer —</option>
            {ORIENTATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Inclinaison (degrés)">
          <input type="number" min="0" max="90" step="0.5" className={inputCls} value={imp.inclinaison ?? ""} onChange={(e) => maj("implantation", "inclinaison", e.target.value)} data-complement="inclinaison" />
        </Field>
        <Field label="Distance champ solaire → local technique (m)">
          <input type="number" min="0" step="0.5" className={inputCls} value={imp.distance_champ_local ?? ""} onChange={(e) => maj("implantation", "distance_champ_local", e.target.value)} data-complement="distance" />
        </Field>
      </div>
      <Field label="Local technique (où se trouve-t-il ?)">
        <input className={inputCls} maxLength={LOCAL_MAX} value={imp.local || ""} onChange={(e) => maj("implantation", "local", e.target.value)} placeholder="Ex : local derrière le magasin" data-complement="local" />
      </Field>

      <div className={titre}>🔌 Montage des panneaux</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Panneaux en série, par ligne">
          <input type="number" min="1" max="100" step="1" className={inputCls} value={mon.serie ?? ""} onChange={(e) => maj("montage", "serie", e.target.value)} data-complement="serie" />
        </Field>
        <Field label="Lignes en parallèle">
          <input type="number" min="1" max="100" step="1" className={inputCls} value={mon.parallele ?? ""} onChange={(e) => maj("montage", "parallele", e.target.value)} data-complement="parallele" />
        </Field>
      </div>
      {avertissement && <div className="text-xs text-amber-800 mt-1" data-avertissement-montage>⚠ {avertissement}</div>}

      <div className={titre}>🧵 Câbles</div>
      <div className="space-y-2">
        {CABLES.map(({ id, libelle, trajet }) => {
          const l = (c.cables || {})[id] || {};
          return (
            <div key={id} className="grid sm:grid-cols-[1fr_9rem_9rem] gap-2 items-end" data-cable={id}>
              <div className="text-sm text-slate-700"><b>{libelle}</b><div className="text-xs text-slate-500">{trajet}</div></div>
              <Field label="Section">
                <select className={inputCls} value={l.section ?? ""} onChange={(e) => majSous("cables", id, "section", e.target.value)} data-complement={`section-${id}`}>
                  <option value="">—</option>
                  {SECTIONS_CABLE.map((s) => <option key={s} value={s}>{s} mm²</option>)}
                </select>
              </Field>
              <Field label="Longueur (m)">
                <input type="number" min="0" step="0.5" className={inputCls} value={l.longueur ?? ""} onChange={(e) => majSous("cables", id, "longueur", e.target.value)} data-complement={`longueur-${id}`} />
              </Field>
            </div>
          );
        })}
      </div>

      <div className={titre}>🛡 Protections</div>
      <div className="space-y-1">
        {PROTECTIONS.map(({ id, libelle }) => {
          const p = (c.protections || {})[id] || {};
          return (
            <div key={id} className="flex flex-wrap items-center gap-2" data-protection={id}>
              <label className="flex items-center gap-2 text-sm text-slate-700 min-w-[16rem]">
                <input type="checkbox" checked={!!p.prevu} onChange={(e) => majSous("protections", id, "prevu", e.target.checked)} data-complement={`prevue-${id}`} />
                {libelle}
              </label>
              {p.prevu && (
                <>
                  <input className="rounded border border-slate-300 px-2 py-1 text-sm w-40" maxLength={CALIBRE_MAX} value={p.calibre || ""} onChange={(e) => majSous("protections", id, "calibre", e.target.value)} placeholder="Calibre (ex : 63 A)" data-complement={`calibre-${id}`} />
                  <input type="number" min="1" step="1" className="rounded border border-slate-300 px-2 py-1 text-sm w-24" value={p.qte ?? ""} onChange={(e) => majSous("protections", id, "qte", e.target.value)} placeholder="Quantité" data-complement={`qte-${id}`} />
                </>
              )}
            </div>
          );
        })}
        {libres.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2" data-protection-libre={i}>
            <input className="rounded border border-slate-300 px-2 py-1 text-sm w-64" maxLength={NOM_PROTECTION_MAX} value={l.nom || ""} onChange={(e) => majLibre(i, "nom", e.target.value)} placeholder="Nom de la protection" data-complement={`libre-nom-${i}`} />
            <input className="rounded border border-slate-300 px-2 py-1 text-sm w-40" maxLength={CALIBRE_MAX} value={l.calibre || ""} onChange={(e) => majLibre(i, "calibre", e.target.value)} placeholder="Calibre (ex : 63 A)" data-complement={`libre-calibre-${i}`} />
            <input type="number" min="1" step="1" className="rounded border border-slate-300 px-2 py-1 text-sm w-24" value={l.qte ?? ""} onChange={(e) => majLibre(i, "qte", e.target.value)} placeholder="Quantité" data-complement={`libre-qte-${i}`} />
            <button type="button" className="rounded-full border border-red-300 text-red-700 w-7 h-7 text-sm" title="Retirer cette protection" aria-label="Retirer cette protection" onClick={() => onChange({ ...c, protections_libres: libres.filter((_, j) => j !== i) })} data-complement={`libre-retirer-${i}`}>✕</button>
          </div>
        ))}
        <button type="button" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900 mt-1" onClick={() => onChange({ ...c, protections_libres: [...libres, { nom: "", calibre: "", qte: "" }] })} data-complement="libre-ajouter">➕ Autre protection</button>
      </div>

      <div className={titre}>📝 Autres précisions</div>
      <Field label="Autre information utile pour l'installation">
        <input className={inputCls} maxLength={AUTRES_MAX} value={c.autres || ""} onChange={(e) => onChange({ ...c, autres: e.target.value })} data-complement="autres" />
      </Field>
      <div className="text-xs text-slate-500 mt-1">
        Tout est facultatif. Ce qui reste vide s'écrit « à confirmer » dans le document technique. L'application ne contrôle pas les sections : le technicien les valide à l'installation.
      </div>
    </div>
  );
}

// Dans le volet ☀️ Solaire : un bouton qui déplie le formulaire. Le complément
// vit dans les réglages du devis (`r.complement`), part avec lui, revient avec
// un devis ou un brouillon repris, et s'efface avec « 🆕 Nouveau devis ».
export function BlocComplementTechnique({ r, panneaux = null }) {
  const [ouvert, setOuvert] = useState(false);
  const resume = resumeComplement(r.complement);
  return (
    <div className="px-4 py-3 border-t border-slate-200" data-complement-technique>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900" onClick={() => setOuvert(!ouvert)} data-bouton-complement>
          🧩 Complément de la fiche {ouvert ? "▲" : "▼"}
        </button>
        <span className="text-xs text-slate-500" data-resume-complement>
          {resume ? `✅ Renseigné : ${resume}` : "Facultatif — implantation, câbles, protections pour le document technique."}
        </span>
      </div>
      {ouvert && (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
          <FormulaireComplement valeur={r.complement} onChange={r.setComplement} panneaux={panneaux} />
        </div>
      )}
    </div>
  );
}

// Dans 📋 Tous les devis : le panneau d'un devis déjà établi. `onEnregistrer`
// reçoit le complément (le geste revérifie le droit sur la fiche fraîche).
export function ComplementDuDevis({ devis, valeurInitiale, panneaux = null, onAnnuler, onEnregistrer }) {
  const [valeur, setValeur] = useState(() => valeurInitiale || {});
  const vide = Object.keys(nettoyerComplement(valeur)).length === 0;
  return (
    <div className="mt-3 rounded-xl border-2 border-sky-300 bg-white p-3" data-complement-devis>
      <div className="font-bold text-sky-900">🧩 Complément de la fiche technique</div>
      <div className="text-xs text-slate-600 mb-1">
        Le devis, son matériel et son prix ne changent pas : seul le document technique s'enrichit.
      </div>
      <FormulaireComplement valeur={valeur} onChange={setValeur} panneaux={panneaux} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => onEnregistrer(valeur)} data-enregistrer-complement>
          {vide && devis && devis.complement_technique ? "💾 Retirer le complément" : "💾 Enregistrer le complément"}
        </button>
        <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm" onClick={onAnnuler}>Annuler</button>
      </div>
    </div>
  );
}
