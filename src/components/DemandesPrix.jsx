// ============================================================
// components/DemandesPrix.jsx — 📨 LES DEMANDES DE PRIX AUX FOURNISSEURS
//
// Timo, 11/11/2026 (« 1+2 ok, Ba, Cb, Db, lance », et le document en
// anglais) : une demande à un ou plusieurs fournisseurs (PDF anglais d'office,
// français au choix ; WhatsApp ouvert sur le téléphone de l'administrateur),
// les réponses recopiées, la comparaison article par article ET par total, et
// un fournisseur retenu PAR ARTICLE — chacun reçoit SA 🛒 commande à
// l'étranger (lib/commandesImport.js). Les règles vivent dans lib/demandesPrix.js.
// ============================================================
import { useState, useEffect } from "react";
import { uid, fmt, today, dFR, ouvrirWhatsAppApresAnnonce } from "../lib/core";
import { libelleCaisse, LOGO } from "../lib/constants";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt, BoutonRond, PanneauQuiSeMontre, IconeWhatsApp } from "./ui";
import { ChampSuggestions } from "./ChampSuggestions";
import { bloquerSiLecture, refuserSaufRoles, ROLES_FOURNISSEURS, boutiquesVisibles, stockActuel, espaceDuCompte } from "../lib/calculs";
import { peutEcrireDeSonNumero } from "../lib/numeroPersonnel";
import { fmtDevise, prochainNumeroCommande, ligneRangee, MODE_CALCUL } from "../lib/commandesImport";
import {
  LANGUES_DEMANDE, LANGUE_DEFAUT, demandesGroupees, estOuverte, prochainNumeroDemande, critiqueDemande, ligneDemande, copiePour,
  critiqueReponse, reponseRangee, comparaison, choixParDefaut, critiqueRetenue, commandesARetenir, texteWhatsappDemande,
} from "../lib/demandesPrix";

const LIGNE_VIDE = () => ({ id: uid(), produit_id: null, nom: "", qte: "", precision: "" });
const STATUTS = { ouverte: "📨 En attente des offres", commandee: "✅ Commandée", close: "✖ Close sans suite" };

export function DemandesPrix({ db, save, profile, fournisseurs, demandePour, onDemandePourFini }) {
  const [forme, setForme] = useState(null);
  const [ouverte, setOuverte] = useState(null); // numéro de la demande dépliée
  const [voirFinies, setVoirFinies] = useState(false);
  const [saisie, setSaisie] = useState(null); // { numero, fid, prix, delai, validite, note, decline }
  const [choix, setChoix] = useState(null); // { numero, parLigne }

  const lieux = boutiquesVisibles(db, profile, (db.boutiques || []).filter((b) => !b.terrain));
  const formation = espaceDuCompte(db, profile) === true;
  const toutes = demandesGroupees(fournisseurs);
  const enCours = toutes.filter(estOuverte);
  const finies = toutes.filter((g) => !estOuverte(g));
  const garde = (geste) => refuserSaufRoles(profile, ROLES_FOURNISSEURS, geste) || bloquerSiLecture(db, profile);
  const nouvelle = (fid) => ({ fournisseurs: fid ? [fid] : [], lieu: lieux[0]?.nom || "", lignes: [LIGNE_VIDE()], note: "", langue: LANGUE_DEFAUT });

  useEffect(() => {
    if (!demandePour) return;
    setForme(nouvelle(demandePour));
    onDemandePourFini?.();
  }, [demandePour]); // eslint-disable-line react-hooks/exhaustive-deps

  // Écrire sur la copie d'UN fournisseur.
  const ecrireCopie = (base, fid, numero, maj) => ({
    ...base,
    fournisseurs: (base.fournisseurs || []).map((fo) => (fo.id !== fid ? fo : {
      ...fo, demandes_prix: (fo.demandes_prix || []).map((d) => (d.numero === numero ? maj(d) : d)),
    })),
  });
  const groupeFrais = (numero) => demandesGroupees((db.fournisseurs || []).filter((fo) => fournisseurs.some((x) => x.id === fo.id))).find((g) => g.numero === numero);

  // ---- 1. CRÉER ----
  const produitsDuLieu = (lieu) => (db.produits || []).filter((p) => p.boutique === lieu);
  const enregistrer = () => {
    if (garde("Faire une demande de prix")) return;
    const lignes = forme.lignes.filter((l) => String(l.nom).trim() || l.qte);
    const refus = critiqueDemande({ lieu: forme.lieu, lignes, fournisseurs: forme.fournisseurs });
    if (refus) { uAlert(refus); return; }
    const numero = prochainNumeroDemande(db.fournisseurs, today().slice(0, 4));
    const base = { numero, le: today(), par: profile.nom, par_id: profile.id, lieu: forme.lieu, lignes: lignes.map(ligneDemande), note: forme.note, langue: forme.langue };
    const noms = forme.fournisseurs.map((fid) => (db.fournisseurs || []).find((x) => x.id === fid)?.nom).filter(Boolean);
    save({ ...db, fournisseurs: db.fournisseurs.map((fo) => (forme.fournisseurs.includes(fo.id) ? { ...fo, demandes_prix: [...(fo.demandes_prix || []), copiePour({ ...base, id: uid() })] } : fo)) },
      `📨 Demande de prix ${numero} : ${base.lignes.length} article(s) — à ${noms.join(", ")}`);
    setForme(null);
    setOuverte(numero);
    uAlert(`✅ Demande ${numero} enregistrée pour ${noms.join(", ")}.\n\nEnvoyez-la maintenant : « 📄 PDF » sur la ligne de chaque fournisseur${peutEcrireDeSonNumero(profile) ? ", ou « WhatsApp »" : ""}.`);
  };

  // ---- 2. ENVOYER (le PDF ; le WhatsApp de l'administrateur) ----
  const noterEnvoi = (g, c, par) => save((etat) => ecrireCopie(etat, c.fournisseur_id, g.numero, (d) => ({ ...d, envois: [...(d.envois || []), { le: today(), par: profile.nom, moyen: par }] })),
    `📨 Demande de prix ${g.numero} envoyée à ${c.fournisseur_nom} (${par})`);
  const pdf = async (g, c) => {
    if (garde("Envoyer une demande de prix")) return;
    const { genererDemandePrix } = await import("../pdf");
    const bq = (db.boutiques || []).find((b) => b.nom === g.lieu) || null;
    genererDemandePrix(g, { fournisseur: c.fournisseur_nom, bq, logo: LOGO, formation });
    noterEnvoi(g, c, "PDF");
  };
  const whatsapp = async (g, c) => {
    if (garde("Envoyer une demande de prix")) return;
    if (!c.fournisseur_tel) { uAlert(`${c.fournisseur_nom} n'a pas de numéro sur sa fiche : ajoutez-le (✏️ sur sa ligne), ou envoyez le PDF par Alibaba ou par e-mail.`); return; }
    const { genererDemandePrix } = await import("../pdf");
    const bq = (db.boutiques || []).find((b) => b.nom === g.lieu) || null;
    genererDemandePrix(g, { fournisseur: c.fournisseur_nom, bq, logo: LOGO, formation });
    const ok = await ouvrirWhatsAppApresAnnonce({ tel: c.fournisseur_tel, texte: texteWhatsappDemande(g, c.fournisseur_nom), prevenir: uAlert, demanderConfirmation: uConfirm,
      annonce: `Le PDF de la demande ${g.numero} vient d'être téléchargé.\n\nAppuyez sur OK : WhatsApp s'ouvre avec le message déjà écrit pour ${c.fournisseur_nom}. Joignez-y le PDF (📎), puis envoyez.` });
    if (ok) noterEnvoi(g, c, "WhatsApp");
  };

  // ---- 3. LA RÉPONSE D'UN FOURNISSEUR ----
  const ouvrirSaisie = (g, c) => {
    const r = c.reponse || {};
    setSaisie({ numero: g.numero, fid: c.fournisseur_id, prix: Object.fromEntries((g.lignes || []).map((l) => [l.id, r.prix?.[l.id] !== undefined ? String(r.prix[l.id]) : ""])),
      delai: r.delai || "", validite: r.validite || "", note: r.note || "", decline: !!r.decline });
  };
  const enregistrerReponse = (g, c) => {
    if (garde("Noter l'offre d'un fournisseur")) return;
    const refus = critiqueReponse(c, saisie);
    if (refus) { uAlert(refus); return; }
    const reponse = reponseRangee(saisie, today(), profile.nom);
    save((etat) => ecrireCopie(etat, c.fournisseur_id, g.numero, (d) => ({ ...d, reponse })),
      `📨 Demande de prix ${g.numero} : offre de ${c.fournisseur_nom} ${reponse.decline ? "— pas d'offre" : `notée (${Object.keys(reponse.prix).length} prix)`}`);
    setSaisie(null);
  };

  // ---- 4. RETENIR (un fournisseur PAR ARTICLE) → les commandes ----
  const commander = async (g0) => {
    if (garde("Commander depuis une demande de prix")) return;
    const g = groupeFrais(g0.numero);
    const refus = critiqueRetenue(g, choix.parLigne);
    if (refus) { uAlert(refus); return; }
    const aCreer = commandesARetenir(g, choix.parLigne);
    const laisses = (g.lignes || []).filter((l) => !choix.parLigne[l.id]).map((l) => l.nom);
    const texte = aCreer.map((e) => `• ${e.fournisseur_nom} : ${e.lignes.map((l) => `${l.qte} × ${l.nom} à ${fmtDevise(l.pu)}`).join(", ")} — total ${fmtDevise(e.lignes.reduce((s, l) => s + l.qte * l.pu, 0))}`).join("\n");
    if (!await uConfirm(`Commander depuis la demande ${g.numero} ?\n\n${texte}${laisses.length ? `\n\nLaissé de côté : ${laisses.join(", ")}` : ""}\n\n${aCreer.length} commande(s) à l'étranger seront créées (réception à ${libelleCaisse(g.lieu)}). Rien n'est encore payé.`)) return;
    save((etat) => {
      let fos = etat.fournisseurs || [];
      for (const e of aCreer) {
        const numero = prochainNumeroCommande(fos, today().slice(0, 4));
        const cmd = { id: uid(), numero, le: today(), par: profile.nom, par_id: profile.id ?? null, lieu: g.lieu, etape: "commandee", etapes: {},
          lignes: e.lignes.map((l) => ligneRangee({ id: uid(), produit_id: l.produit_id, nom: l.nom, qte: l.qte, pu: l.pu, mode: MODE_CALCUL })),
          paiements: [], frais: [], note: `Depuis la demande de prix ${g.numero}`, demande_prix: g.numero };
        fos = fos.map((fo) => (fo.id === e.fournisseur_id ? { ...fo, commandes_import: [...(fo.commandes_import || []), cmd] } : fo));
      }
      fos = fos.map((fo) => ({ ...fo, demandes_prix: (fo.demandes_prix || []).map((d) => (d.numero !== g.numero ? d
        : { ...d, retenue: { le: today(), par: profile.nom, lignes: Object.entries(choix.parLigne).filter(([, fid]) => fid === fo.id).map(([lid]) => lid), commande: aCreer.some((x) => x.fournisseur_id === fo.id) } })) }));
      return { ...etat, fournisseurs: fos };
    }, `📨 Demande de prix ${g.numero} : ${aCreer.length} commande(s) créée(s) — ${aCreer.map((e) => e.fournisseur_nom).join(", ")}`);
    setChoix(null);
    uAlert(`✅ ${aCreer.length} commande(s) créée(s) dans « 🛒 Commandes à l'étranger » : payez-les et réceptionnez-les comme d'habitude.`);
  };

  const clore = async (g) => {
    if (garde("Clore une demande de prix")) return;
    const motif = await uPrompt(`Clore la demande ${g.numero} sans commander — pourquoi ?`);
    if (!motif || !motif.trim()) return;
    save((etat) => ({ ...etat, fournisseurs: (etat.fournisseurs || []).map((fo) => ({ ...fo,
      demandes_prix: (fo.demandes_prix || []).map((d) => (d.numero === g.numero ? { ...d, close: { le: today(), par: profile.nom, motif: motif.trim() } } : d)) })) }),
    `📨 Demande de prix ${g.numero} close sans suite : ${motif.trim()}`);
  };

  // ---- L'AFFICHAGE ----
  const fixeLigne = (i, champs) => setForme({ ...forme, lignes: forme.lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)) });
  const suggestions = forme ? produitsDuLieu(forme.lieu).map((p) => ({ cle: p.id, produit_id: p.id, valeur: p.nom, detail: `${stockActuel(db, p)} en stock` })) : [];
  const nomCopie = (c) => c.fournisseur_nom;

  const carte = (g) => {
    const deplie = ouverte === g.numero;
    const comp = comparaison(g);
    const repondus = g.copies.filter((c) => c.reponse).length;
    const ch = choix?.numero === g.numero ? choix : null;
    return (
      <div key={g.numero} data-demande-prix={g.numero} className="border border-slate-200 rounded-lg">
        <button onClick={() => setOuverte(deplie ? null : g.numero)} className="w-full text-left px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold">{g.numero}</span>
          <span className="text-slate-700">{g.copies.map(nomCopie).join(", ")}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-semibold">{STATUTS[g.statut]}</span>
          <span className="text-sm text-slate-600">{g.lignes.length} article(s) · {repondus}/{g.copies.length} offre(s)</span>
          <span className="text-xs text-slate-500 ml-auto">{dFR(g.le)} · {g.langue === "fr" ? "Français" : "English"}</span>
        </button>
        {deplie && (
          <div className="px-3 pb-3 space-y-3 text-sm">
            {g.note && <div className="text-slate-600">📝 {g.note}</div>}
            <div className="space-y-2">
              {g.copies.map((c) => (
                <div key={c.fournisseur_id} data-copie-demande={c.fournisseur_nom} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.fournisseur_nom}</span>
                    <span className="text-xs text-slate-500">{(c.envois || []).length ? `📨 envoyée le ${dFR(c.envois[c.envois.length - 1].le)} par ${c.envois[c.envois.length - 1].par} (${c.envois[c.envois.length - 1].moyen})` : "pas encore envoyée"}</span>
                    {c.reponse && <span className="text-xs font-semibold text-green-700">{c.reponse.decline ? "✖ pas d'offre" : `✅ offre notée le ${dFR(c.reponse.le)}`}</span>}
                    {estOuverte(g) && <span className="ml-auto flex gap-1">
                      <BoutonRond icone="📄" titre="📄 Télécharger le PDF de la demande (à joindre sur Alibaba ou par e-mail)" onClick={() => pdf(g, c)} />
                      {peutEcrireDeSonNumero(profile) && <BoutonRond icone={<IconeWhatsApp taille={16} />} teinte="vert" titre="WhatsApp — le PDF est téléchargé, le message est écrit : joignez le PDF" onClick={() => whatsapp(g, c)} />}
                      <BoutonRond icone="✍️" teinte="ambre" titre="✍️ Noter l'offre reçue" onClick={() => ouvrirSaisie(g, c)} />
                    </span>}
                  </div>
                  {c.reponse && !c.reponse.decline && (c.reponse.delai || c.reponse.validite || c.reponse.note) && (
                    <div className="text-xs text-slate-600 mt-1">{[c.reponse.delai && `délai : ${c.reponse.delai}`, c.reponse.validite && `validité : ${c.reponse.validite}`, c.reponse.note].filter(Boolean).join(" · ")}</div>
                  )}
                  {c.reponse?.decline && c.reponse.note && <div className="text-xs text-slate-600 mt-1">{c.reponse.note}</div>}
                  {saisie?.numero === g.numero && saisie.fid === c.fournisseur_id && (
                    <div data-saisie-offre className="mt-2 rounded-lg border-2 border-amber-300 bg-white p-3 space-y-2">
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={saisie.decline} onChange={(e) => setSaisie({ ...saisie, decline: e.target.checked })} /> Le fournisseur ne fait pas d'offre</label>
                      {!saisie.decline && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {g.lignes.map((l) => (
                          <Field key={l.id} label={`${l.qte} × ${l.nom} — prix unitaire ($)`}>
                            <input type="number" step="0.01" min="0" className={inputCls} value={saisie.prix[l.id] ?? ""} onChange={(e) => setSaisie({ ...saisie, prix: { ...saisie.prix, [l.id]: e.target.value } })} />
                          </Field>
                        ))}
                        <Field label="Délai"><input className={inputCls} value={saisie.delai} placeholder="30 jours + transport…" onChange={(e) => setSaisie({ ...saisie, delai: e.target.value })} /></Field>
                        <Field label="Validité de l'offre"><input className={inputCls} value={saisie.validite} placeholder="jusqu'au 30/11…" onChange={(e) => setSaisie({ ...saisie, validite: e.target.value })} /></Field>
                      </div>}
                      <Field label="Note (conditions, livraison…)"><input className={inputCls} value={saisie.note} onChange={(e) => setSaisie({ ...saisie, note: e.target.value })} /></Field>
                      <div className="text-xs text-slate-500">Une case vide = cet article n'est pas proposé par ce fournisseur.</div>
                      <div className="flex gap-2">
                        <button onClick={() => enregistrerReponse(g, c)} className={btnDark}>Enregistrer l'offre</button>
                        <button onClick={() => setSaisie(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {comp.offres.length > 0 && (
              <div data-comparaison-offres className="overflow-x-auto">
                <div className="font-semibold mb-1">⚖ Comparaison des offres</div>
                <table className="w-full min-w-[520px]">
                  <thead><tr className="text-xs text-slate-500 uppercase">
                    <th className="text-left px-2 py-1">Article</th>
                    {comp.offres.map((c) => <th key={c.fournisseur_id} className="text-right px-2 py-1">{c.fournisseur_nom}</th>)}
                    {ch && <th className="text-left px-2 py-1">Retenu</th>}
                  </tr></thead>
                  <tbody>
                    {comp.lignes.map((x) => (
                      <tr key={x.ligne.id} className="border-t border-slate-100">
                        <td className="px-2 py-1">{x.ligne.qte} × {x.ligne.nom}</td>
                        {comp.offres.map((c) => {
                          const pu = c.reponse.prix?.[x.ligne.id];
                          const meilleur = Number.isFinite(pu) && x.moinsCher.includes(c.fournisseur_id) && comp.offres.length > 1;
                          return <td key={c.fournisseur_id} data-moins-cher={meilleur ? "" : undefined} className={`px-2 py-1 text-right tabular-nums ${meilleur ? "bg-green-100 text-green-800 font-bold" : ""}`}>{Number.isFinite(pu) ? <>{fmtDevise(pu)}<div className="text-xs font-normal text-slate-500">{fmtDevise(pu * x.ligne.qte)}</div></> : <span className="text-slate-400">—</span>}</td>;
                        })}
                        {ch && <td className="px-2 py-1">
                          <select className={inputCls} value={ch.parLigne[x.ligne.id] || ""} onChange={(e) => setChoix({ ...ch, parLigne: { ...ch.parLigne, [x.ligne.id]: e.target.value } })}>
                            <option value="">— Laisser de côté —</option>
                            {x.prix.map((p) => <option key={p.copie.fournisseur_id} value={p.copie.fournisseur_id}>{p.copie.fournisseur_nom} ({fmtDevise(p.pu)})</option>)}
                          </select>
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2 border-slate-300 font-semibold">
                    <td className="px-2 py-1">Total par fournisseur</td>
                    {comp.totaux.map((t) => {
                      const meilleur = t.complet && t.total === comp.meilleurTotal && comp.totaux.length > 1;
                      return <td key={t.copie.fournisseur_id} data-total-fournisseur className={`px-2 py-1 text-right tabular-nums ${meilleur ? "bg-green-100 text-green-800" : ""}`}>{fmtDevise(t.total)}{!t.complet && <div className="text-xs font-normal text-amber-700">{t.manque} article(s) non proposé(s)</div>}</td>;
                    })}
                    {ch && <td />}
                  </tr></tfoot>
                </table>
                <div className="text-xs text-slate-500 mt-1">En vert : le moins cher de chaque article, et le meilleur total parmi les fournisseurs qui proposent TOUT. Prix hors frais (fret, douane…).</div>
              </div>
            )}

            {estOuverte(g) && (
              <div className="flex flex-wrap gap-2">
                {comp.offres.length > 0 && !ch && <button data-retenir-offres onClick={() => setChoix({ numero: g.numero, parLigne: choixParDefaut(g) })} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold">✅ Retenir les offres</button>}
                {ch && <>
                  <button data-commander-offres onClick={() => commander(g)} className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-sm font-semibold">🛒 Commander</button>
                  <button onClick={() => setChoix(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">Annuler</button>
                </>}
                <button onClick={() => clore(g)} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-semibold">✖ Clore sans commander</button>
              </div>
            )}
            {g.statut === "close" && g.copies[0]?.close && <div className="text-xs text-red-700">Close le {dFR(g.copies[0].close.le)} par {g.copies[0].close.par} : {g.copies[0].close.motif}</div>}
            {g.statut === "commandee" && <div className="text-xs text-green-700">Commandée chez : {g.copies.filter((c) => c.retenue?.commande).map(nomCopie).join(", ")} — voir « 🛒 Commandes à l'étranger ».</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-demandes-prix className="rounded-xl p-4 bg-white border border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="font-bold">📨 Demandes de prix {enCours.length ? <span className="text-sm font-normal text-slate-500">· {enCours.length} en attente</span> : null}</div>
        {!forme && <button onClick={() => setForme(nouvelle(null))} className={btnDark}>➕ Nouvelle demande de prix</button>}
      </div>

      {forme && (
        <PanneauQuiSeMontre cle="nouvelle-demande-prix" onFermer={() => setForme(null)} data-nouvelle-demande-prix="" className="rounded-lg border-2 border-violet-300 p-3 space-y-3">
          <div className="flex items-center justify-between"><div className="font-semibold">Nouvelle demande de prix</div><button onClick={() => setForme(null)} className="px-3 py-1 rounded-lg border border-slate-300 text-sm font-semibold">Fermer</button></div>
          <div>
            <div className="text-sm font-medium text-slate-700 mb-1">Fournisseurs</div>
            <div className="flex flex-wrap gap-2">
              {fournisseurs.length === 0 && <span className="text-sm text-slate-500">Aucun fournisseur : créez-en d'abord un.</span>}
              {fournisseurs.map((fo) => (
                <label key={fo.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm cursor-pointer ${forme.fournisseurs.includes(fo.id) ? "border-violet-500 bg-violet-50" : "border-slate-300"}`}>
                  <input type="checkbox" checked={forme.fournisseurs.includes(fo.id)} onChange={(e) => setForme({ ...forme, fournisseurs: e.target.checked ? [...forme.fournisseurs, fo.id] : forme.fournisseurs.filter((x) => x !== fo.id) })} />
                  {fo.nom}
                </label>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Serait reçue à">
              <select className={inputCls} value={forme.lieu} onChange={(e) => setForme({ ...forme, lieu: e.target.value })}>
                {lieux.map((b) => <option key={b.nom} value={b.nom}>{libelleCaisse(b.nom)}{b.depot ? " (magasin)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Langue du document">
              <select className={inputCls} value={forme.langue} onChange={(e) => setForme({ ...forme, langue: e.target.value })}>
                {LANGUES_DEMANDE.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Note pour le fournisseur"><input className={inputCls} value={forme.note} onChange={(e) => setForme({ ...forme, note: e.target.value })} placeholder={forme.langue === "fr" ? "Livraison par bateau…" : "Sea freight to Lomé…"} /></Field>
          </div>
          <div className="space-y-2">
            {forme.lignes.map((l, i) => (
              <div key={l.id} data-ligne-demande className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end border-t border-slate-100 pt-2">
                <div className="col-span-2">
                  <Field label="Article">
                    <ChampSuggestions className={inputCls} valeur={l.nom} placeholder="Tapez son nom (ou un nouvel article)"
                      onChange={(v) => fixeLigne(i, { nom: v, produit_id: null })}
                      onChoisir={(s) => fixeLigne(i, { nom: s.valeur, produit_id: s.produit_id })}
                      suggestions={suggestions} />
                  </Field>
                </div>
                <Field label="Quantité"><input type="number" min="1" className={inputCls} value={l.qte} onChange={(e) => fixeLigne(i, { qte: e.target.value })} /></Field>
                <div className="col-span-2 sm:col-span-3 flex items-end gap-2">
                  <div className="flex-1"><Field label="Précision (caractéristiques)"><input className={inputCls} value={l.precision} placeholder={forme.langue === "fr" ? "Monocristallin, MC4…" : "Monocrystalline, MC4…"} onChange={(e) => fixeLigne(i, { precision: e.target.value })} /></Field></div>
                  {forme.lignes.length > 1 && <BoutonRond icone="✕" teinte="rouge" titre="Retirer la ligne" onClick={() => setForme({ ...forme, lignes: forme.lignes.filter((_, j) => j !== i) })} />}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setForme({ ...forme, lignes: [...forme.lignes, LIGNE_VIDE()] })} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold">➕ Article</button>
            <button onClick={enregistrer} className={`ml-auto ${btnDark}`}>Enregistrer la demande</button>
          </div>
          <div className="text-xs text-slate-500">Le document ne porte aucun prix : c'est le fournisseur qui les donne. La précision s'écrit sous l'article — écrivez-la dans la langue du document.</div>
        </PanneauQuiSeMontre>
      )}

      {enCours.length === 0 && !forme && <div className="text-sm text-slate-500">Aucune demande en attente.</div>}
      <div className="space-y-2">{enCours.map(carte)}</div>
      {finies.length > 0 && (
        <div>
          <button onClick={() => setVoirFinies(!voirFinies)} className="text-sm font-semibold text-slate-700">{voirFinies ? "▾" : "▸"} Demandes commandées ou closes ({finies.length})</button>
          {voirFinies && <div className="space-y-2 mt-2">{finies.map(carte)}</div>}
        </div>
      )}
      <div className="text-xs text-slate-500">Les prix des offres sont en dollars. Ce qui est retenu devient une 🛒 commande à l'étranger, un fournisseur par commande.</div>
    </div>
  );
}
