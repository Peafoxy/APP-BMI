// ============================================================
// screens/Travaux.jsx — 🛠 TRAVAUX À CRÉDIT (Timo, 13/09/2026)
//
// Les prestations hors devis : une fiche par travail, ses articles (stock
// de la boutique — le stock baisse tout de suite — et HB), ses frais de
// prestation (% de tous les articles ou montant libre), ses petites
// dépenses rattachées (saisies dans 📤 Dépenses, ligne « Chantier à
// rattacher »), puis « Facturer » qui envoie le panier à 💰 Ventes. Le reçu
// ou la dette reviennent sur la fiche ; soldée, elle quitte l'onglet pour
// 🏠 Clients installés (option A : une trace). Règles pures : lib/travaux.js.
// ============================================================
import { useState } from "react";
import { fmt, dFR, today } from "../lib/core";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, AucuneBoutique } from "../components/ui";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { clientsConnus, propositionsClients, propositionsNumeros } from "../lib/clientsConnus";
import { bloquerSiLecture, refuserSaufRoles, refuserSaufAdminPrincipal, estAdminPrincipal, boutiqueParDefaut, boutiqueRetenue, estCompteFormation, marqueEspace, stockActuel, utilisateursDeLEspace } from "../lib/calculs";
import { mettreALaCorbeille, DUREE_CORBEILLE_JOURS } from "../lib/corbeille";
import { depensesDuChantier, depenseCompteAuChantier, totalDepensesChantier } from "../lib/depensesChantier";
import { ROLES_FICHE, ROLES_ARTICLES, ROLES_FACTURER, travauxEnCours, critiqueFiche, nouveauTravail, ajouterArticleStock, ajouterArticleHB, retirerArticle, critiquePrestation, totalArticles, coutArticles, montantPrestation, totalAFacturer, coutTravaux, factureDe, detteDe, factureMontant, encaisse, resteDu, critiqueFacturation, preRempliPourFacture, critiqueSuppression, ROLES_EQUIPE, critiqueEquipe, composerEquipe, libelleEquipe, propositionsStock, produitSaisi } from "../lib/travaux";

const ficheVide = { nom: "", prenom: "", tel: "", lieu: "", description: "" };
const hbVide = { nom: "", qte: "1", pu_achat: "", pu_vente: "" };

export function Travaux({ db, save, profile, onFacturer }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "travaux" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "travaux" });
  const [f, setF] = useState(ficheVide);
  const [ouverte, setOuverte] = useState(null);
  // saisie = ce qui est tapé dans le champ Article (jamais transformé) ;
  // produit_id = l'article lié : par un CLIC sur une proposition, ou parce
  // que le nom tapé correspond exactement à un article de la boutique.
  const stockVide = { saisie: "", produit_id: "", qte: "1" };
  const [stockForm, setStockForm] = useState(stockVide);
  const [hb, setHb] = useState(hbVide);
  const [prest, setPrest] = useState(null); // { mode, valeur } en cours d'édition
  const [equipeForm, setEquipeForm] = useState(null); // { id, ids, chef } en cours d'édition
  const jeSuisPrincipal = estAdminPrincipal(db, profile);
  // Les techniciens de l'espace regardé (technicien, technicien BMI), actifs.
  const techniciens = utilisateursDeLEspace(db, profile).filter((u) => ["technicien", "technicien_bmi"].includes(u.role) && u.actif !== false);

  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;

  const liste = travauxEnCours(db, profile).filter((c) => c.boutique === boutique);
  const produits = (db.produits || []).filter((p) => p.boutique === boutique);
  const majFiche = (fiche, journal, extra = {}) => save({
    ...db, ...extra,
    clients_installes: (db.clients_installes || []).map((c) => (c.id === fiche.id ? fiche : c)),
  }, journal);

  const ouvrir = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_FICHE, "Ouvrir des travaux à crédit")) return;
    const refus = critiqueFiche({ nom: f.nom, boutique });
    if (refus) { uAlert(refus); return; }
    const c = nouveauTravail(profile, { ...f, boutique, formation: !!marqueEspace(db, profile, boutique).formation }, today());
    save({ ...db, clients_installes: [c, ...(db.clients_installes || [])] }, `Travaux ouverts — ${c.prenom} ${c.nom} (${boutique})`);
    setF(ficheVide);
    setOuverte(c.id);
  };

  const sortirArticle = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_ARTICLES, "Sortir un article du stock pour des travaux")) return;
    const p = produits.find((x) => x.id === stockForm.produit_id);
    const r = ajouterArticleStock(db, profile, c, p, stockForm.qte, today());
    if (r.refus) { uAlert(r.refus); return; }
    if (!await uConfirm(`Sortir ${stockForm.qte} × ${p.nom} du stock de ${boutique} pour les travaux de ${c.prenom || ""} ${c.nom} ?\n\nLe stock baisse tout de suite. Facturé ${fmt(p.prix_vente)} l'unité (prix de la boutique).`)) return;
    majFiche(r.fiche, r.journal, { ajustements: [r.ajustement, ...(db.ajustements || [])] });
    setStockForm(stockVide);
  };

  const ajouterHB = (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_FICHE, "Ajouter un article HB")) return;
    const r = ajouterArticleHB(profile, c, hb, today());
    if (r.refus) { uAlert(r.refus); return; }
    majFiche(r.fiche, r.journal);
    setHb(hbVide);
  };

  const retirer = async (c, ligne) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_ARTICLES, "Retirer un article des travaux")) return;
    const r = retirerArticle(profile, c, ligne.id, today());
    if (r.refus) { uAlert(r.refus); return; }
    if (!await uConfirm(`Retirer ${ligne.qte} × ${ligne.nom} ?${ligne.hb ? "" : "\n\nL'article revient en stock."}`)) return;
    majFiche(r.fiche, r.journal, r.ajustement ? { ajustements: [r.ajustement, ...(db.ajustements || [])] } : {});
  };

  const enregistrerPrestation = (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_FICHE, "Fixer les frais de prestation")) return;
    const refus = critiquePrestation(prest);
    if (refus) { uAlert(refus); return; }
    majFiche({ ...c, prestation: { mode: prest.mode, valeur: Number(prest.valeur) } }, `Travaux ${c.nom} : frais de prestation ${prest.mode === "pct" ? `${prest.valeur} %` : fmt(Number(prest.valeur))}`);
    setPrest(null);
  };

  // Timo (13/09/2026) : supprimer tant qu'aucun article n'est rattaché ; les
  // dépenses liées restent dans 📤 Dépenses. Corbeille 30 jours, principal seul.
  const supprimer = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufAdminPrincipal(db, profile, "Supprimer des travaux")) return;
    const refus = critiqueSuppression(c);
    if (refus) { uAlert(refus); return; }
    const nbDep = depensesDuChantier(db, c.id).length;
    if (!await uConfirm(`Supprimer les travaux de ${c.prenom || ""} ${c.nom} ?\n\nLa fiche part à la corbeille ${DUREE_CORBEILLE_JOURS} jours (restaurable dans ⚙ Paramètres).${nbDep ? `\n${nbDep} dépense(s) rattachée(s) RESTENT dans 📤 Dépenses, pour la traçabilité.` : ""}`)) return;
    save(mettreALaCorbeille(db, "clients_installes", c.id, profile), `Travaux supprimés (corbeille) — ${c.prenom || ""} ${c.nom}${nbDep ? ` · ${nbDep} dépense(s) conservée(s)` : ""}`);
    setOuverte(null);
  };

  // Timo (13/09/2026) : « choisir un technicien comme responsable d'équipe, comme dans Clients installés ».
  const enregistrerEquipe = (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_EQUIPE, "Composer l'équipe des travaux")) return;
    const refus = critiqueEquipe(equipeForm.ids, equipeForm.chef);
    if (refus) { uAlert(refus); return; }
    const equipe = composerEquipe(techniciens, equipeForm.ids, equipeForm.chef);
    majFiche({ ...c, equipe }, `Travaux ${c.nom} : équipe ${equipe.map((e) => `${e.chef ? "⭐ " : ""}${e.nom}`).join(", ")}`);
    setEquipeForm(null);
  };

  const facturer = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (refuserSaufRoles(profile, ROLES_FACTURER, "Facturer des travaux")) return;
    const refus = critiqueFacturation(c);
    if (refus) { uAlert(refus); return; }
    if (!await uConfirm(`Facturer les travaux de ${c.prenom || ""} ${c.nom} : ${fmt(totalAFacturer(c))} ?\n\nLe panier s'ouvre dans 💰 Ventes : vous y choisissez espèces ou crédit (avec avance), puis vous encaissez. Le reçu reviendra sur cette fiche.`)) return;
    onFacturer(preRempliPourFacture(c));
  };

  const Chiffre = ({ label, valeur, fort }) => (
    <div className={`bg-white rounded-lg p-2 border ${fort ? "border-slate-300" : "border-slate-200"}`}>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`font-bold tabular-nums ${fort ? "text-lg" : ""}`}>{fmt(valeur)}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="travaux" db={db} value={bq} onChange={setBq} profile={profile} />}
      {ROLES_FICHE.includes(profile.role) && (
        <Panel boutique={boutique}>
          <div className="font-bold mb-3 flex items-center gap-2">Nouveaux travaux <Badge boutique={boutique} /></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Field label="Nom du client *">
              {/* Timo (15/09/2026) : le client déjà connu de la boutique se
                  propose — un clic remplit le nom ET le numéro. Le prénom
                  reste libre : la liste ne connaît que le nom enregistré. */}
              <ChampSuggestions valeur={f.nom} onChange={(v) => setF({ ...f, nom: v })}
                onChoisir={(c) => setF({ ...f, nom: c.valeur, tel: c.tel || f.tel })}
                suggestions={propositionsClients(clientsConnus(db, boutique), { fmt, dFR })}
                placeholder="Nom, ou numéro du client" />
            </Field>
            <Field label="Prénom"><input className={inputCls} value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} /></Field>
            <Field label="Téléphone">
              <ChampSuggestions type="tel" valeur={f.tel} onChange={(v) => setF({ ...f, tel: v })}
                onChoisir={(c) => setF({ ...f, tel: c.valeur, nom: c.nom || f.nom })}
                suggestions={propositionsNumeros(clientsConnus(db, boutique), { fmt, dFR })}
                placeholder="+228 ..." />
            </Field>
            <Field label="Lieu des travaux"><input className={inputCls} value={f.lieu} onChange={(e) => setF({ ...f, lieu: e.target.value })} /></Field>
            <Field label="Description"><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Plomberie, câblage…" /></Field>
          </div>
          <button onClick={ouvrir} className={`mt-3 ${btnDark}`}>Ouvrir les travaux</button>
        </Panel>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-1">
          <span>🛠 Travaux à crédit — {boutique} ({liste.length})</span>
          <span className="text-xs font-normal text-slate-500">Une fiche soldée quitte cette liste et se range dans 🏠 Clients installés.</span>
        </div>
        {liste.length === 0 && <div className="px-4 py-6 text-center text-slate-400">Aucun travail en cours pour {boutique}.</div>}
        {liste.map((c) => {
          const estOuverte = ouverte === c.id;
          const vente = factureDe(db, c);
          const dette = detteDe(db, c);
          const deps = depensesDuChantier(db, c.id);
          return (
            <div key={c.id} className="border-t border-slate-100">
              <button onClick={() => setOuverte(estOuverte ? null : c.id)} className={`w-full text-left px-4 py-3 flex flex-wrap items-center justify-between gap-2 ${estOuverte ? "bg-sky-100" : "hover:bg-sky-50"}`}>
                <div>
                  <div className="font-bold text-slate-800">🛠 {c.prenom} {c.nom} <span className="text-xs font-normal text-slate-500">· ouvert le {dFR(c.date)} par {c.par}{c.description ? ` · ${c.description}` : ""}</span></div>
                  <div className="text-xs text-slate-600">{(c.articles_travaux || []).length} article(s) · prestation {fmt(montantPrestation(c))} · {vente ? `facturé ${fmt(factureMontant(db, c))}, reste dû ${fmt(resteDu(db, c))}` : `à facturer ${fmt(totalAFacturer(c))}`}</div>
                </div>
                <span className="text-xs font-bold text-slate-500">{estOuverte ? "▴ Replier" : "▾ Ouvrir"}</span>
              </button>
              {estOuverte && (
                <div className="px-4 pb-4 space-y-4 bg-slate-50/60">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <Chiffre label="Coût (articles + petites dépenses)" valeur={coutTravaux(db, c)} />
                    <Chiffre label={vente ? "Facturé" : "À facturer"} valeur={vente ? factureMontant(db, c) : totalAFacturer(c)} fort />
                    <Chiffre label="Encaissé" valeur={encaisse(db, c)} />
                    <Chiffre label="Reste dû" valeur={vente ? resteDu(db, c) : totalAFacturer(c)} />
                  </div>
                  {(c.tel || c.adresse) && <div className="text-xs text-slate-600">{c.tel ? `📞 ${c.tel}` : ""}{c.tel && c.adresse ? " · " : ""}{c.adresse ? `📍 ${c.adresse}` : ""}</div>}

                  {/* ---- Équipe ---- */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">👷 Équipe — {(c.equipe || []).length ? libelleEquipe(c) : "aucune"}</div>
                    {ROLES_EQUIPE.includes(profile.role) && (equipeForm && equipeForm.id === c.id ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="text-xs text-slate-500 mb-2">Cochez les techniciens, puis désignez le responsable ⭐.</div>
                        {techniciens.length === 0 && <div className="text-sm text-slate-400">Aucun technicien actif dans cet espace.</div>}
                        <div className="space-y-1">
                          {techniciens.map((u) => {
                            const coche = equipeForm.ids.includes(u.id);
                            return (
                              <div key={u.id} className="flex flex-wrap items-center gap-3 text-sm">
                                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={coche} onChange={() => setEquipeForm({ ...equipeForm, ids: coche ? equipeForm.ids.filter((x) => x !== u.id) : [...equipeForm.ids, u.id], chef: coche && equipeForm.chef === u.id ? "" : equipeForm.chef })} />{u.nom_complet || u.nom}</label>
                                {coche && <label className="flex items-center gap-1 text-xs font-bold text-amber-700"><input type="radio" name={`chef-${c.id}`} checked={equipeForm.chef === u.id} onChange={() => setEquipeForm({ ...equipeForm, chef: u.id })} />⭐ Responsable</label>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => enregistrerEquipe(c)} className={btnDark}>Enregistrer l'équipe</button>
                          <button onClick={() => setEquipeForm(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEquipeForm({ id: c.id, ids: (c.equipe || []).map((e) => e.user_id), chef: (c.equipe || []).find((e) => e.chef)?.user_id || "" })} className="text-xs font-bold text-sky-800 underline">👷 {(c.equipe || []).length ? "Modifier l'équipe" : "Composer l'équipe"}</button>
                    ))}
                  </div>

                  {/* ---- Articles ---- */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">📦 Articles ({(c.articles_travaux || []).length}) — {fmt(totalArticles(c))} facturés, coût {fmt(coutArticles(c))}</div>
                    {(c.articles_travaux || []).length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                          <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "Prix facturé", "Coût", "Total", ""].map((h) => <th key={h} className="text-left px-3 py-1.5">{h}</th>)}</tr></thead>
                          <tbody>
                            {(c.articles_travaux || []).map((l) => (
                              <tr key={l.id} className="border-t border-slate-100">
                                <td className="px-3 py-1.5 font-semibold">{l.nom} {l.hb ? <span className="text-[10px] font-bold text-amber-700 border border-amber-200 bg-amber-50 rounded px-1">HB</span> : <span className="text-[10px] font-bold text-emerald-700 border border-emerald-200 bg-emerald-50 rounded px-1">stock</span>}</td>
                                <td className="px-3 py-1.5 tabular-nums">{l.qte}</td>
                                <td className="px-3 py-1.5 tabular-nums">{fmt(l.pu_vente)}</td>
                                <td className="px-3 py-1.5 tabular-nums text-slate-500">{fmt(l.pu_achat)}</td>
                                <td className="px-3 py-1.5 tabular-nums font-bold">{fmt(Number(l.qte) * Number(l.pu_vente))}</td>
                                <td className="px-3 py-1.5">{!vente && ROLES_ARTICLES.includes(profile.role) && <button onClick={() => retirer(c, l)} className="text-xs text-red-600 underline">Retirer</button>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!vente && (
                      <div className="grid lg:grid-cols-2 gap-3 mt-2">
                        {ROLES_ARTICLES.includes(profile.role) && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                            <div className="text-xs font-bold text-emerald-800 mb-2">Sortir un article de la boutique (le stock baisse tout de suite, prix de la boutique)</div>
                            {/* Captures Timo (13/09/2026) : « les lignes ne sont pas
                                nommées au-dessus… on devrait avoir Article, Quantité »
                                et « la ligne de quantité s'élargit » (la case suivait la
                                hauteur de la ligne d'aide) : titres, et la ligne d'aide
                                SOUS la grille, pas dans la colonne. */}
                            <div className="grid grid-cols-3 gap-2 items-start">
                              <div className="col-span-2">
                                <Field label="Article">
                                  <ChampSuggestions className={inputCls} placeholder="Article du stock : tapez son nom…"
                                    valeur={stockForm.saisie}
                                    suggestions={propositionsStock(db, produits)}
                                    onChange={(v) => setStockForm({ ...stockForm, saisie: v, produit_id: produitSaisi(produits, v)?.id || "" })}
                                    onChoisir={(s) => setStockForm({ ...stockForm, saisie: s.valeur, produit_id: s.produit_id })} />
                                </Field>
                              </div>
                              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={stockForm.qte} onChange={(e) => setStockForm({ ...stockForm, qte: e.target.value })} /></Field>
                            </div>
                            {stockForm.produit_id ? (
                              <div className="text-[11px] text-emerald-700 mt-1">✓ {stockActuel(db, produits.find((p) => p.id === stockForm.produit_id))} en stock · {fmt(produits.find((p) => p.id === stockForm.produit_id)?.prix_vente)} l'unité</div>
                            ) : stockForm.saisie ? (
                              <div className="text-[11px] text-orange-600 mt-1">Aucun article du stock ne porte exactement ce nom : cliquez une proposition.</div>
                            ) : null}
                            <button onClick={() => sortirArticle(c)} className={`mt-2 ${btnDark}`}>📦 Sortir du stock</button>
                          </div>
                        )}
                        {ROLES_FICHE.includes(profile.role) && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                            <div className="text-xs font-bold text-amber-800 mb-2">Article HB (acheté dehors : câble, tuyau…) — pas de stock</div>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-start">
                              <Field label="Article"><input className={inputCls} placeholder="Nom" value={hb.nom} onChange={(e) => setHb({ ...hb, nom: e.target.value })} /></Field>
                              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={hb.qte} onChange={(e) => setHb({ ...hb, qte: e.target.value })} /></Field>
                              <Field label="Prix payé (F)"><input type="number" min="0" className={inputCls} value={hb.pu_achat} onChange={(e) => setHb({ ...hb, pu_achat: e.target.value })} /></Field>
                              <Field label="Prix facturé (F)"><input type="number" min="0" className={inputCls} value={hb.pu_vente} onChange={(e) => setHb({ ...hb, pu_vente: e.target.value })} /></Field>
                            </div>
                            <button onClick={() => ajouterHB(c)} className={`mt-2 ${btnDark}`}>+ Ajouter l'article HB</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ---- Frais de prestation ---- */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">🛠 Frais de prestation — {fmt(montantPrestation(c))} {c.prestation?.mode === "pct" ? `(${Number(c.prestation?.valeur || 0)} % de tous les articles)` : "(montant fixé)"}</div>
                    <div className="text-xs text-slate-500 mb-1">Ils couvrent carburant, nourriture et main-d'œuvre : ces petites dépenses ne se facturent pas à part.</div>
                    {!vente && ROLES_FICHE.includes(profile.role) && (prest && prest.id === c.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <select className={inputCls} value={prest.mode} onChange={(e) => setPrest({ ...prest, mode: e.target.value })}>
                          <option value="pct">Pourcentage de tous les articles</option>
                          <option value="montant">Montant libre</option>
                        </select>
                        <input type="number" min="0" className={`${inputCls} w-32`} value={prest.valeur} onChange={(e) => setPrest({ ...prest, valeur: e.target.value })} />
                        <span className="text-sm text-slate-500">{prest.mode === "pct" ? "%" : "F"}</span>
                        <button onClick={() => enregistrerPrestation(c)} className={btnDark}>Enregistrer</button>
                        <button onClick={() => setPrest(null)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm">Annuler</button>
                      </div>
                    ) : (
                      <button onClick={() => setPrest({ id: c.id, mode: c.prestation?.mode || "pct", valeur: String(c.prestation?.valeur ?? 0) })} className="text-xs font-bold text-sky-800 underline">✏️ Fixer les frais de prestation</button>
                    ))}
                  </div>

                  {/* ---- Petites dépenses rattachées ---- */}
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase mb-1">🧾 Petites dépenses rattachées — {fmt(totalDepensesChantier(db, c.id))}</div>
                    {deps.length === 0
                      ? <div className="text-xs text-slate-500">Aucune. Saisissez-les dans 📤 Dépenses avec la ligne « Chantier à rattacher » : 🛠 {c.prenom} {c.nom}.</div>
                      : <div className="text-xs text-slate-600">{deps.map((d) => `${dFR(d.date)} · ${d.categorie}${d.description ? ` — ${d.description}` : ""} · ${fmt(d.montant)}${depenseCompteAuChantier(d) ? "" : " (en attente du DG)"}`).join(" ; ")}</div>}
                  </div>

                  {/* ---- Facture ---- */}
                  <div className="rounded-lg border border-slate-300 bg-white p-3">
                    {vente ? (
                      <div className="text-sm">
                        <div className="font-bold text-emerald-800">✅ Facturé le {dFR(c.facture_le)} — reçu {c.facture_numero || vente.numero} — {fmt(factureMontant(db, c))} ({vente.paiement})</div>
                        {dette
                          ? <div className="text-xs text-slate-600 mt-1">Dette N° {dette.numero} : payé {fmt(dette.paye || 0)}, reste dû <b>{fmt(resteDu(db, c))}</b>. Les paiements se font dans 🧾 Dettes ; au dernier, la fiche part dans 🏠 Clients installés.</div>
                          : <div className="text-xs text-slate-600 mt-1">Réglé comptant : la fiche passe dans 🏠 Clients installés.</div>}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm">Total à facturer : <b className="tabular-nums text-base">{fmt(totalAFacturer(c))}</b> <span className="text-xs text-slate-500">(articles {fmt(totalArticles(c))} + prestation {fmt(montantPrestation(c))})</span></div>
                        {ROLES_FACTURER.includes(profile.role) && <button onClick={() => facturer(c)} className={btnDark}>🧾 Facturer le client (vers 💰 Ventes)</button>}
                      </div>
                    )}
                  </div>
                  {jeSuisPrincipal && !vente && (
                    <div className="text-right">
                      <button onClick={() => supprimer(c)} className="text-xs font-bold text-red-700 underline" title="Possible tant qu'aucun article n'est rattaché ; les dépenses liées restent dans 📤 Dépenses">🗑 Supprimer ces travaux</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
