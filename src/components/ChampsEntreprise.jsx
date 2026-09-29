// ============================================================
// components/ChampsEntreprise.jsx — la case « entreprise » et ses lignes,
// écrites UNE fois pour 💰 Ventes (proforma comprise), le devis et toute
// création de compte client (Timo, 29/09/2026 : « une case à cocher si le
// client paie au nom d'une entreprise, on coche et les lignes… apparaissent
// pour remplir »). Règles : lib/clientEntreprise.js.
// ============================================================
import { Field, inputCls } from "./ui";
import { ENTREPRISE_VIDE } from "../lib/clientEntreprise";

export function ChampsEntreprise({ valeur, onChange, libelle = "🏢 Le client paie au nom d'une entreprise", aide = "La personne saisie au-dessus est son répondant : c'est à elle que partent les messages." }) {
  const e = valeur || ENTREPRISE_VIDE();
  const maj = (champ, v) => onChange({ ...e, [champ]: v });
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" data-champs-entreprise>
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={!!e.actif} onChange={(ev) => onChange({ ...e, actif: ev.target.checked })} />
        {libelle}
      </label>
      {e.actif && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <Field label="Nom de l'entreprise"><input className={inputCls} value={e.nom} onChange={(ev) => maj("nom", ev.target.value)} data-entreprise-nom /></Field>
            <Field label="Téléphone de l'entreprise"><input type="tel" className={inputCls} value={e.tel} onChange={(ev) => maj("tel", ev.target.value)} placeholder="+228 ..." /></Field>
            <Field label="NIF (facultatif)"><input className={inputCls} value={e.nif} onChange={(ev) => maj("nif", ev.target.value)} /></Field>
            <Field label="RCCM (facultatif)"><input className={inputCls} value={e.rccm} onChange={(ev) => maj("rccm", ev.target.value)} /></Field>
          </div>
          {aide && <div className="text-xs text-slate-500 mt-2">{aide}</div>}
        </>
      )}
    </div>
  );
}
