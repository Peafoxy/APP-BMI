// ============================================================
// screens/Fournisseurs.jsx — Fournisseurs : fiches, contacts,
// dettes fournisseur liées aux ravitaillements.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, normPaiement, lienWhatsApp } from "../lib/core";
import { Field, inputCls, btnDark, uAlert, uConfirm, uPrompt, demanderMoyenPaiement, FormulaireRepliable, enTeteFige, celluleFigee, classeLigneDepliable, fondLigneDepliable, TexteDepliable, BoutonRond, CelluleActions, PanneauQuiSeMontre, IconeWhatsApp } from "../components/ui";
import { bloquerSiLecture, choisirBoutiqueDebitG, marqueEspace, espaceDuCompte, refuserSaufRoles, ROLES_FOURNISSEURS, estAdminPrincipal, boutiquesVisibles } from "../lib/calculs";
import { critiqueModifFournisseur, changementsFournisseur, fournisseurModifie, articlesQuiSuivent, produitsRenommes, phraseChangements } from "../lib/fournisseurs";

const FICHE_VIDE = { nom: "", tel: "", adresse: "", site_web: "", produits: "", representant: "", representant_tel: "", doit: "", paye: "" };

// ============ FOURNISSEURS ============
export function Fournisseurs({ db, save, profile }) {
  const [f, setF] = useState(FICHE_VIDE);
  // ➕ Formulaire fermé d'office (règle commune FormulaireRepliable, 06/10/2026),
  // replié après l'enregistrement.
  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [ouvert, setOuvert] = useState(null); // la ligne dépliée (15/10/2026)
  // ✏️ La fiche en cours de modification (Timo, 23/10/2026) : son id et la saisie.
  const [edition, setEdition] = useState(null);
  const [fe, setFe] = useState(FICHE_VIDE);
  const principal = estAdminPrincipal(db, profile);

  const ajouter = () => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Créer un fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (!f.nom) { uAlert("Veuillez saisir un nom."); return; }
    save({ ...db, fournisseurs: [...db.fournisseurs, { id: uid(), nom: f.nom, tel: f.tel, adresse: f.adresse, site_web: f.site_web, produits: f.produits, representant: (f.representant || "").trim(), representant_tel: (f.representant_tel || "").trim(), doit: Number(f.doit || 0), paye: Number(f.paye || 0), ...marqueEspace(db, profile) }] });
    setF(FICHE_VIDE);
    setNouveauOuvert(false);
    uAlert("Fournisseur ajouté !");
  };

  const payer = async (fo) => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Régler un fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    // ⚠ Audit du 29/08/2026 : aucun plafond — on pouvait régler PLUS que le
    // reste dû, sans un mot. Même règle que les dettes clients : on refuse,
    // en disant quoi faire si la dette du fournisseur n'est pas à jour.
    const resteDu = Math.max(0, Number(fo.doit || 0) - Number(fo.paye || 0));
    const s = await uPrompt(`Montant réglé à ${fo.nom} (F) — reste dû : ${fmt(resteDu)} :`, String(resteDu || ""));
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    if (m > resteDu) {
      uAlert(`Le montant dépasse le reste dû à ${fo.nom} (${fmt(resteDu)}).\n\nSi vous lui devez plus que ce qui est enregistré, enregistrez d'abord la commande (« + Commande »), puis réglez.`);
      return;
    }
    // ⚠ Trouvé en audit général (2.99.65) : un règlement fournisseur ne
    // créait jusqu'ici AUCUNE dépense — invisible dans "Total dépenses",
    // contrairement aux salaires/primes/commissions/CNSS. Corrigé : même
    // sélecteur de boutique que pour les autres sorties de caisse (CNSS,
    // virement de salaire), catégorie "Achat marchandises" (déjà existante).
    // ⚠ DÉFAUT TROUVÉ EN AUDIT (29/08/2026) : le moyen de paiement était écrit
    // « Espèces » EN DUR, sans qu'on demande. Or la clôture de caisse ne
    // compte que ce qui porte « Espèces » : un règlement fait par virement ou
    // par Flooz était quand même retiré des espèces, et la caisse paraissait
    // courte du montant du règlement, sans que rien ne l'explique.
    // Exactement le défaut déjà corrigé pour l'avance d'une vente à crédit
    // (« point 15 : la caisse la comptait en espèces quoi qu'il arrive ») —
    // il avait survécu ici.
    const moyen = await demanderMoyenPaiement(`à ${fo.nom}`);
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, {}, `Paiement de ${fmt(m)} à ${fo.nom}`, profile);
    if (bq === null) return;
    const dep = { id: uid(), date: today(), boutique: bq, categorie: "Achat marchandises", description: `Règlement fournisseur ${fo.nom}`, montant: m, paiement: normPaiement(moyen), par: profile.nom };
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, paye: Number(x.paye) + m } : x)), depenses: [dep, ...db.depenses] }, `Paiement fournisseur ${fo.nom} (${fmt(m)}) — ${bq}`);
    uAlert(`Paiement de ${fmt(m)} enregistré ! (dépense créée — sortie de caisse : ${bq})`);
  };

  const nouvelleDette = async (fo) => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Enregistrer une dette fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    const s = await uPrompt(`Nouvelle commande à crédit chez ${fo.nom} — montant (F) :`);
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    save({ ...db, fournisseurs: db.fournisseurs.map((x) => (x.id === fo.id ? { ...x, doit: Number(x.doit) + m } : x)) });
    uAlert(`Commande de ${fmt(m)} enregistrée !`);
  };

  // ✏️ MODIFIER LA FICHE (Timo, 23/10/2026, « a oui, b oui, c non —
  // modifiable par l'administrateur principal seul ») : tout se corrige ; le
  // dû et le réglé, le principal seul ; un nouveau NOM suit les articles du
  // stock de l'espace regardé qui portaient l'ancien (« b »).
  const ouvrirModif = (fo) => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Modifier un fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    setEdition(fo.id);
    setFe({ nom: fo.nom || "", tel: fo.tel || "", adresse: fo.adresse || "", site_web: fo.site_web || "", produits: fo.produits || "",
      representant: fo.representant || "", representant_tel: fo.representant_tel || "", doit: String(Number(fo.doit || 0)), paye: String(Number(fo.paye || 0)) });
  };

  const enregistrerModif = async () => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Modifier un fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    // La fiche FRAÎCHE : un règlement a pu passer pendant qu'on tapait.
    const avant = (db.fournisseurs || []).find((x) => x.id === edition);
    const refus = critiqueModifFournisseur(avant, fe, { autres: liste, principal: estAdminPrincipal(db, profile) });
    if (refus) { uAlert(refus); return; }
    const changements = changementsFournisseur(avant, fe);
    if (!changements.length) { uAlert("Rien n'a été modifié."); return; }
    const apres = fournisseurModifie(avant, fe, { principal: estAdminPrincipal(db, profile) });
    const renomme = changements.some((c) => c.cle === "nom");
    const nomsBoutiques = boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom);
    const suivent = renomme ? articlesQuiSuivent(db.produits, avant.nom, nomsBoutiques) : [];
    const phrase = phraseChangements(changements, fmt);
    const question = `Modifier la fiche de « ${avant.nom} » ?\n\n${changements.map((c) => "• " + phraseChangements([c], fmt)).join("\n")}`
      + (renomme ? `\n\n${suivent.length ? `${suivent.length} article(s) du stock prendront le nouveau nom « ${apres.nom} ».` : "Aucun article du stock ne portait l'ancien nom."}` : "");
    if (!(await uConfirm(question))) return;
    save({
      ...db,
      fournisseurs: db.fournisseurs.map((x) => (x.id === avant.id ? apres : x)),
      ...(suivent.length ? { produits: produitsRenommes(db.produits, suivent.map((p) => p.id), apres.nom) } : {}),
    }, `Fournisseur ${avant.nom} modifié — ${phrase}${suivent.length ? ` (${suivent.length} article(s) renommé(s))` : ""}`);
    setEdition(null);
    uAlert("Fiche du fournisseur modifiée.");
  };

  const supprimer = async (fo) => {
    if (refuserSaufRoles(profile, ROLES_FOURNISSEURS, "Supprimer un fournisseur")) return;
    if (bloquerSiLecture(db, profile)) return;
    if (await uConfirm(`Supprimer le fournisseur « ${fo.nom} » ?`)) save({ ...db, fournisseurs: db.fournisseurs.filter((x) => x.id !== fo.id) });
  };

  // ⚠ Cloisonnement (demande Timo, 19/08/2026 : « fournisseurs de formation
  // séparés de ceux du réel »). Sans ce filtre, un compte de formation voyait
  // les VRAIS fournisseurs — et pouvait gonfler leur ardoise ou les supprimer.
  // Les deux listes sont désormais étanches : chacun crée les siens.
  const espace = espaceDuCompte(db, profile);
  const liste = (db.fournisseurs || []).filter((x) => espace === undefined || !!x.formation === espace);
  const resteTotal = liste.reduce((s, x) => s + Math.max(0, x.doit - x.paye), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 bg-white border border-slate-200">
        <FormulaireRepliable ouvert={nouveauOuvert} onOuvrir={() => setNouveauOuvert(true)} onFermer={() => setNouveauOuvert(false)}
          bouton="➕ Nouveau fournisseur" titre="Nouveau fournisseur">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Nom"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Adresse"><input className={inputCls} value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} /></Field>
          <Field label="Site web"><input type="url" placeholder="https://..." className={inputCls} value={f.site_web} onChange={(e) => setF({ ...f, site_web: e.target.value })} /></Field>
          <Field label="Produits"><input className={inputCls} value={f.produits} onChange={(e) => setF({ ...f, produits: e.target.value })} /></Field>
          <Field label="Commercial / représentant"><input className={inputCls} value={f.representant} onChange={(e) => setF({ ...f, representant: e.target.value })} /></Field>
          <Field label="Son numéro"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.representant_tel} onChange={(e) => setF({ ...f, representant_tel: e.target.value })} /></Field>
          <Field label="Dû (F)"><input type="number" className={inputCls} value={f.doit} onChange={(e) => setF({ ...f, doit: e.target.value })} /></Field>
          <Field label="Réglé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer</button>
        </FormulaireRepliable>
      </div>

      {edition && (<PanneauQuiSeMontre cle={edition} retour={edition} onFermer={() => setEdition(null)} data-modif-fournisseur="" className="rounded-xl p-4 bg-white border-2 border-amber-300">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="font-bold">✏️ Modifier la fiche du fournisseur</div>
          <button onClick={() => setEdition(null)} className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 shrink-0">Fermer</button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Nom"><input className={inputCls} value={fe.nom} onChange={(e) => setFe({ ...fe, nom: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={fe.tel} onChange={(e) => setFe({ ...fe, tel: e.target.value })} /></Field>
          <Field label="Adresse"><input className={inputCls} value={fe.adresse} onChange={(e) => setFe({ ...fe, adresse: e.target.value })} /></Field>
          <Field label="Site web"><input type="url" placeholder="https://..." className={inputCls} value={fe.site_web} onChange={(e) => setFe({ ...fe, site_web: e.target.value })} /></Field>
          <Field label="Produits"><input className={inputCls} value={fe.produits} onChange={(e) => setFe({ ...fe, produits: e.target.value })} /></Field>
          <Field label="Commercial / représentant"><input className={inputCls} value={fe.representant} onChange={(e) => setFe({ ...fe, representant: e.target.value })} /></Field>
          <Field label="Son numéro"><input type="tel" placeholder="+228 ..." className={inputCls} value={fe.representant_tel} onChange={(e) => setFe({ ...fe, representant_tel: e.target.value })} /></Field>
          <Field label="Dû (F)"><input type="number" disabled={!principal} className={inputCls} value={fe.doit} onChange={(e) => setFe({ ...fe, doit: e.target.value })} /></Field>
          <Field label="Réglé (F)"><input type="number" disabled={!principal} className={inputCls} value={fe.paye} onChange={(e) => setFe({ ...fe, paye: e.target.value })} /></Field>
        </div>
        {!principal && <div data-argent-fournisseur-verrouille className="mt-2 text-xs text-slate-500">🔒 Le dû et le réglé ne se corrigent que par l'administrateur principal. Une commande ou un règlement passe par 📦 et 💵 sur la ligne.</div>}
        {principal && <div className="mt-2 text-xs text-amber-800">⚠ Corriger le dû ou le réglé ne crée ni ne retire aucune dépense : un vrai règlement passe par 💵 sur la ligne.</div>}
        <button onClick={enregistrerModif} className={`mt-3 ${btnDark}`}>Enregistrer les modifications</button>
      </PanneauQuiSeMontre>)}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Fournisseurs <span className="text-sm font-normal text-slate-500">· Reste à régler : {fmt(resteTotal)}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          {/* 🧾 La ligne suit la règle de 💰 Ventes et 📋 Dettes (15/10/2026) :
              le fournisseur figé, ses produits sur deux lignes puis le reste au
              clic, les gestes en boutons ronds. */}
          <thead><tr className="text-xs text-slate-500 uppercase">{["Fournisseur", "Téléphone", "Adresse", "Site", "Produits", "Dû", "Réglé", "Reste", ""].map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-400">Aucun fournisseur.</td></tr>}
            {liste.map((fo, i) => {
              const reste = Math.max(0, fo.doit - fo.paye);
              const deplie = ouvert === fo.id;
              return (
                <tr key={fo.id} data-ligne={fo.id} data-ligne-fournisseur={deplie ? "deplie" : "replie"} onClick={() => setOuvert(deplie ? null : fo.id)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(deplie, i)}`}>
                  <td className={`px-3 py-2 font-semibold min-w-[150px] ${celluleFigee(fondLigneDepliable(deplie, i), deplie)}`}>
                    {fo.nom}
                    {(fo.representant || fo.representant_tel) && (
                      <div data-representant-fournisseur className="text-xs font-normal text-slate-500 mt-0.5">
                        👤 {fo.representant || "Représentant"}{fo.representant_tel ? ` · ${fo.representant_tel}` : ""}
                        {fo.representant_tel && <a href={lienWhatsApp(fo.representant_tel)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`WhatsApp — ${fo.representant_tel}`} className="ml-1.5 inline-block align-middle"><IconeWhatsApp taille={14} /></a>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{fo.tel || "—"}</td>
                  <td className="px-3 py-2 min-w-[140px]"><TexteDepliable texte={fo.adresse} deplie={deplie} largeur="max-w-[200px]" /></td>
                  <td className="px-3 py-2">{fo.site_web ? <a href={fo.site_web.startsWith("http") ? fo.site_web : "https://" + fo.site_web} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-700 underline">Visiter</a> : "—"}</td>
                  <td className="px-3 py-2 min-w-[180px]"><TexteDepliable texte={fo.produits} deplie={deplie} largeur="max-w-[260px]" /></td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(fo.doit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(fo.paye)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap ${reste > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(reste)}</td>
                  <CelluleActions>
                    <BoutonRond icone="📦" onClick={() => nouvelleDette(fo)} titre="+ Commande — une marchandise reçue à régler" />
                    <BoutonRond icone="💵" teinte="vert" onClick={() => payer(fo)} titre="+ Règlement" />
                    <BoutonRond icone="✏️" teinte="ambre" onClick={() => ouvrirModif(fo)} titre="✏️ Modifier la fiche du fournisseur" />
                    <BoutonRond icone="🗑" teinte="rouge" onClick={() => supprimer(fo)} titre="🗑 Supprimer le fournisseur" />
                  </CelluleActions>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
