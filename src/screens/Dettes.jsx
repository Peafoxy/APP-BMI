// ============================================================
// screens/Dettes.jsx — Dettes clients et réservations prépayées.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, telDigits, normPaiement, prochainNumeroVente, prochainNumeroDette } from "../lib/core";
import { PAIEMENTS } from "../lib/constants";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, usePagination, Pagination } from "../components/ui";
import { imprimerRecu, imprimerRecuVersement } from "../lib/impression";
import { bloquerSiLecture, boutiquesVente, estReservation, resteAPayer, stockActuel } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";

// ============ DETTES ============
export function Dettes({ db, save, profile }) {
  const premiere = boutiquesVente(db)[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;
  const [f, setF] = useState({ client: "", tel: "", motif: "", montant: "", paye: "" });

  const ajouter = () => {
    if (!f.client || !f.montant) { uAlert("Veuillez saisir le nom du client et le montant."); return; }
    save({ ...db, dettes: [{ id: uid(), numero: prochainNumeroDette(db, boutique), date: today(), boutique, client: f.client, tel: f.tel, motif: f.motif, montant: Number(f.montant), paye: Number(f.paye || 0), par: profile.nom }, ...db.dettes] }, `Nouvelle dette ${f.client} (${fmt(Number(f.montant))}) — ${boutique}`);
    setF({ client: "", tel: "", motif: "", montant: "", paye: "" });
    uAlert("Dette enregistrée avec succès !");
  };

  const encaisser = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(d);
    const s = await uPrompt(`Montant reçu de ${d.client} (F) — reste dû : ${fmt(reste)}`, String(reste || ""));
    const m = Number(s);
    if (!s || isNaN(m) || m <= 0) return;
    if (m > reste) { uAlert(`Le montant dépasse le reste dû (${fmt(reste)}).`); return; }
    const moyen = await uPrompt("Moyen de paiement (Espèces / Flooz / Mixx / Virement bancaire) :", "Espèces");
    if (moyen === null) return;
    if (!await uConfirm(`Confirmer le versement de ${fmt(m)} de ${d.client} ?`)) return;
    const paiement = { id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), montant: m, paiement: normPaiement(moyen), par: profile.nom };
    const dApres = { ...d, paye: Number(d.paye) + m, paiements: [...(d.paiements || []), paiement] };
    save({ ...db, dettes: db.dettes.map((x) => (x.id === d.id ? dApres : x)) },
      `${estReservation(d) ? "Versement réservation" : "Paiement dette"} ${fmt(m)} de ${d.client} — ${d.boutique}`);
    uAlert("Versement enregistré !");
    // ⚠ Demande Timo : un reçu sort à CHAQUE versement, reprenant tout
    // l'historique cumulé (pas seulement celui du jour) — et devient
    // automatiquement le reçu DÉFINITIF si ce versement solde la dette.
    imprimerRecuVersement(dApres, db.boutiques.find((b) => b.nom === d.boutique) || {});
  };

  // ---- RÉSERVATION PRÉPAYÉE ----
  // Le client paie d'avance, par tranches. Rien ne sort du stock avant la livraison.
  const [res, setRes] = useState({ client: "", tel: "", produit_id: "", qte: "", avance: "", moyen: "Espèces", echeance: "" });
  const [panierRes, setPanierRes] = useState([]);
  const produitsBoutique = db.produits.filter((p) => p.boutique === boutique);
  const totalRes = panierRes.reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);

  const ajouterArticleRes = () => {
    const p = db.produits.find((x) => x.id === res.produit_id);
    const q = Number(res.qte);
    if (!p) { uAlert("Choisissez un article."); return; }
    if (!q || q <= 0) { uAlert("Quantité invalide."); return; }
    setPanierRes((b) => [...b, { produit_id: p.id, nom: p.nom, qte: q, pu: Number(p.prix_vente || 0) }]);
    setRes((r) => ({ ...r, produit_id: "", qte: "" }));
  };

  const creerReservation = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!res.client.trim()) { uAlert("Indiquez le nom du client."); return; }
    if (!panierRes.length) { uAlert("Ajoutez au moins un article à la réservation."); return; }
    const avance = Number(res.avance || 0);
    if (avance > totalRes) { uAlert("L'avance dépasse le total de la réservation."); return; }
    if (!await uConfirm(`Créer la réservation de ${res.client.trim()} ?\n\nTotal : ${fmt(totalRes)}\nAvance versée : ${fmt(avance)}\nReste à payer : ${fmt(totalRes - avance)}\n\nLa marchandise ne sortira du stock qu'à la livraison.`)) return;
    const r = {
      id: uid(), numero: prochainNumeroDette(db, boutique), type: "prepaye", date: today(), boutique, client: res.client.trim(), tel: res.tel.trim(),
      motif: `Réservation — ${panierRes.length} article(s)`,
      articles: panierRes, montant: totalRes, paye: avance,
      paiements: avance > 0 ? [{ id: uid(), date: today(), heure: new Date().toTimeString().slice(0, 5), montant: avance, paiement: normPaiement(res.moyen), par: profile.nom }] : [],
      echeance: res.echeance || null, statut: "en_cours", par: profile.nom,
    };
    save({ ...db, dettes: [r, ...db.dettes] }, `Réservation prépayée ${res.client.trim()} (${fmt(totalRes)}) — ${boutique}`);
    setPanierRes([]);
    setRes({ client: "", tel: "", produit_id: "", qte: "", avance: "", moyen: "Espèces", echeance: "" });
    uAlert("✅ Réservation créée.");
  };

  // Livraison : c'est SEULEMENT ici que le stock sort et que la vente est créée.
  // ⚠ Décision Timo : une réservation, c'est le client qui paie AVANT
  // d'emporter — elle ne devrait normalement être livrée qu'une fois soldée.
  // S'il faut livrer avant que ce soit soldé (le client insiste), ce n'est
  // plus une réservation : elle BASCULE en dette classique — quitte
  // définitivement la liste des réservations, réapparaît dans "Dettes" avec
  // tout son historique de versements conservé (relançable comme une dette
  // normale). Le CA, lui, NE CHANGE PAS : une dette classique compte déjà sa
  // valeur totale au CA dès la livraison (comportement existant, partout
  // ailleurs dans l'app) — la bascule aligne juste le CLASSEMENT de la
  // fiche sur ce qui se passe réellement, elle ne touche à aucun calcul.
  const livrer = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const reste = resteAPayer(r);
    const basculeEnDette = reste > 0;
    if (basculeEnDette && !await uConfirm(`⚠ ${r.client} n'a pas tout payé : il reste ${fmt(reste)}.\n\nCe n'est plus une réservation prépayée si elle est livrée maintenant — elle va devenir une DETTE CLASSIQUE (elle quittera la liste des réservations pour rejoindre "Dettes", avec son historique de versements conservé). Continuer ?`)) return;
    const manquants = (r.articles || []).filter((l) => {
      const p = db.produits.find((x) => x.id === l.produit_id);
      return !p || stockActuel(db, p) < Number(l.qte);
    });
    if (manquants.length) { uAlert(`Stock insuffisant pour :\n${manquants.map((m) => m.nom).join("\n")}\n\nRavitaillez la boutique avant de livrer.`); return; }
    if (!await uConfirm(`Livrer la réservation de ${r.client} ?\n\n${(r.articles || []).length} article(s), ${fmt(r.montant)}\n\nLe stock sera déduit et la vente enregistrée.`)) return;
    const vente = {
      // 2.99.44 (Lot C) : cette vente n'avait AUCUN numéro (le reçu affichait
      // un numéro de secours dérivé de l'id) — elle entre maintenant dans la
      // même numérotation séquentielle que les ventes normales.
      id: uid(), numero: prochainNumeroVente(db, r.boutique),
      date: today(), heure: new Date().toTimeString().slice(0, 5), boutique: r.boutique, client: r.client, tel: r.tel,
      // ⚠ VRAI BUG trouvé par Timo (préexistant, pas introduit par les
      // réservations créées depuis Ventes.jsx) : les articles d'une
      // réservation portent un champ `nom` (voir creerReservation ci-dessus),
      // alors que tout le reste de l'app — dont le reçu imprimé — attend
      // `article`. Résultat : la description restait VIDE sur le reçu de
      // vente émis à la livraison. Corrigé en remappant ici, au seul endroit
      // où une réservation devient une vraie vente.
      articles: (r.articles || []).map((l) => ({ produit_id: l.produit_id, article: l.nom, qte: l.qte, pu: l.pu })),
      // ⚠ Demande Timo : sur le reçu d'une réservation livrée SANS être
      // soldée, il faut voir "Avance versée" et "RESTE À PAYER" — exactement
      // ce que sait déjà faire imprimerRecu() pour toute vente marquée
      // "Crédit (dette)" (voir impression.js). Il suffit donc de la marquer
      // ainsi ici, avec l'avance déjà versée reprise — sans toucher au
      // gabarit d'impression, qui gère déjà ce cas pour les ventes normales.
      remise: 0, paiement: basculeEnDette ? "Crédit (dette)" : "Prépayé", avance: basculeEnDette ? r.paye : 0,
      // ⚠ Repris de la réservation (r.commercial etc.) — pas systématiquement
      // null : sinon un commercial/apporteur choisi lors d'une vente à crédit
      // "non livrée" (Ventes.jsx) perdrait sa commission pour toujours, faute
      // d'avoir jamais été reporté sur la vraie vente créée ici.
      commercial: r.commercial || null, responsable: r.responsable || null,
      rabais: r.rabais || 0, apporteur: r.apporteur || null,
      par: profile.nom, reservation_id: r.id,
    };
    save({
      ...db,
      ventes: [vente, ...db.ventes],
      dettes: basculeEnDette
        // Bascule : la fiche RÉSERVATION disparaît (filter), remplacée par
        // une DETTE CLASSIQUE toute neuve — historique de versements et
        // montant/payé intégralement conservés, seul le classement change.
        ? [
            { id: uid(), numero: r.numero || prochainNumeroDette(db, r.boutique), date: today(), boutique: r.boutique, client: r.client, tel: r.tel, motif: "Vente livrée avant solde (ex-réservation)", articles: r.articles || [], montant: r.montant, paye: r.paye, paiements: r.paiements || [], par: r.par || profile.nom, vente_id: vente.id, date_livraison: today() },
            ...db.dettes.filter((x) => x.id !== r.id),
          ]
        : db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "livree", date_livraison: today(), vente_id: vente.id } : x)),
    }, basculeEnDette
      ? `Réservation de ${r.client} livrée AVANT solde — basculée en dette classique (${fmt(reste)} restant) — ${r.boutique}`
      : `Livraison de la réservation de ${r.client} (${fmt(r.montant)}) — ${r.boutique}`);
    imprimerRecu(vente, db.boutiques.find((b) => b.nom === r.boutique) || {}, db.produits);
  };

  const annulerReservation = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    if (Number(r.paye || 0) > 0 && !await uConfirm(`⚠ ${r.client} a déjà versé ${fmt(r.paye)}.\n\nAnnuler la réservation ? Vous devrez lui rembourser cette somme À LA MAIN (enregistrez-la en dépense).`)) return;
    if (Number(r.paye || 0) === 0 && !await uConfirm(`Annuler la réservation de ${r.client} ?`)) return;
    save({ ...db, dettes: db.dettes.map((x) => (x.id === r.id ? { ...x, statut: "annulee", date_annulation: today() } : x)) },
      `Réservation de ${r.client} ANNULÉE (${fmt(r.paye || 0)} déjà versés)`);
  };

  const relancer = (d) => {
    const reste = Math.max(0, d.montant - d.paye);
    const txt = `Bonjour ${d.client}, nous vous rappelons gentiment votre solde de ${fmt(reste)} chez ${d.boutique}${d.motif ? ` (${d.motif})` : ""}. Merci de passer régulariser quand vous pouvez. Bonne journée !`;
    const num = telDigits(d.tel);
    window.open(num ? `https://wa.me/${num}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const supprimerDette = async (d) => {
    if (bloquerSiLecture(db, profile)) return;
    if (await uConfirm(`Supprimer la dette de ${d.client} (${fmt(d.montant)}) ?`)) {
      save({ ...db, dettes: db.dettes.filter((x) => x.id !== d.id) }, `Suppression dette ${d.client} (${fmt(d.montant)}) — ${d.boutique}`);
    }
  };

  const liste = db.dettes.filter((x) => x.boutique === boutique && !estReservation(x));
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);
  const mesReservations = db.dettes.filter((x) => x.boutique === boutique && estReservation(x) && x.statut !== "annulee");
  const statut = (d) => (d.montant - d.paye <= 0 ? "Payée" : d.paye > 0 ? "Partielle" : "En cours");

  const dettesEnRetard = liste.filter(d => {
    const jours = (new Date(today()) - new Date(d.date)) / (1000 * 60 * 60 * 24);
    return jours > 30 && d.montant - d.paye > 0;
  });

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} />}

      <div className="rounded-xl p-4 bg-white border-2 border-emerald-200">
        <div className="font-bold mb-1 text-emerald-800">💰 Réservation prépayée — paiement total avant d'emporter</div>
        <div className="text-xs text-slate-500 mb-4">Le prix est bloqué, les versements s'accumulent. La marchandise ne sort du stock qu'au moment de la livraison.</div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Client"><input className={inputCls} value={res.client} onChange={(e) => setRes({ ...res, client: e.target.value })} /></Field>
          <Field label="Téléphone"><input className={inputCls} value={res.tel} onChange={(e) => setRes({ ...res, tel: e.target.value })} /></Field>
          <Field label="Article">
            <select className={inputCls} value={res.produit_id} onChange={(e) => setRes({ ...res, produit_id: e.target.value })}>
              <option value="">— Choisir —</option>
              {produitsBoutique.map((p) => <option key={p.id} value={p.id}>{p.nom} — {fmt(p.prix_vente)}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2 items-end">
            <Field label="Quantité"><input type="number" min="1" className={inputCls} value={res.qte} onChange={(e) => setRes({ ...res, qte: e.target.value })} /></Field>
            <button onClick={ajouterArticleRes} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-bold hover:bg-slate-900">+ Ajouter</button>
          </div>
        </div>

        {panierRes.length > 0 && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <table className="w-full text-sm">
              <tbody>
                {panierRes.map((l, i) => (
                  <tr key={i} className="border-b border-emerald-100">
                    <td className="py-1 font-semibold">{l.qte} × {l.nom}</td>
                    <td className="py-1 text-right tabular-nums">{fmt(l.qte * l.pu)}</td>
                    <td className="py-1 text-right"><button onClick={() => setPanierRes(panierRes.filter((_, j) => j !== i))} className="text-xs text-red-600 underline">Retirer</button></td>
                  </tr>
                ))}
                <tr className="font-bold"><td className="pt-2">TOTAL RÉSERVÉ</td><td className="pt-2 text-right tabular-nums text-emerald-800">{fmt(totalRes)}</td><td></td></tr>
              </tbody>
            </table>
            <div className="grid sm:grid-cols-3 gap-3 mt-3">
              <Field label="Avance versée aujourd'hui"><input type="number" min="0" className={inputCls} value={res.avance} onChange={(e) => setRes({ ...res, avance: e.target.value })} /></Field>
              <Field label="Moyen de paiement">
                <select className={inputCls} value={res.moyen} onChange={(e) => setRes({ ...res, moyen: e.target.value })}>
                  {PAIEMENTS.filter((p) => !/Crédit/i.test(p)).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Livraison prévue (facultatif)"><input type="date" className={inputCls} value={res.echeance} onChange={(e) => setRes({ ...res, echeance: e.target.value })} /></Field>
            </div>
            <button onClick={creerReservation} className="mt-3 px-5 py-2 rounded-lg bg-emerald-700 text-white font-bold text-sm hover:bg-emerald-800">✅ Créer la réservation</button>
          </div>
        )}

        {mesReservations.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Articles réservés", "Total", "Versé", "Reste", "Statut", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>
                {mesReservations.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-emerald-50 align-top">
                    <td className="px-3 py-2 font-semibold">{r.client}<div className="text-xs font-normal text-slate-500">{dFR(r.date)}{r.echeance ? ` · prévu ${dFR(r.echeance)}` : ""}</div></td>
                    <td className="px-3 py-2 text-xs">{(r.articles || []).map((l) => `${l.qte} × ${l.nom}`).join(", ")}</td>
                    <td className="px-3 py-2 tabular-nums font-bold">{fmt(r.montant)}</td>
                    <td className="px-3 py-2 tabular-nums text-green-700">{fmt(r.paye)}</td>
                    <td className={`px-3 py-2 tabular-nums font-bold ${resteAPayer(r) > 0 ? "text-orange-600" : "text-green-700"}`}>{fmt(resteAPayer(r))}</td>
                    <td className="px-3 py-2">
                      {r.statut === "livree"
                        ? <span className="text-xs font-bold text-green-700">✅ Livrée le {dFR(r.date_livraison)}</span>
                        : resteAPayer(r) <= 0
                          ? <span className="text-xs font-bold text-blue-700">💰 Soldée — à livrer</span>
                          : <span className="text-xs font-bold text-amber-600">⏳ En cours</span>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <button onClick={() => imprimerRecuVersement(r, db.boutiques.find((b) => b.nom === r.boutique) || {})} className="text-xs font-bold text-sky-800 underline mr-2" title="Imprimer le reçu (avec filigrane NON LIVRÉ si pas encore livrée)">🖨 Reçu</button>
                      {r.statut !== "livree" && <button onClick={() => encaisser(r)} className="text-xs font-bold text-sky-800 underline mr-2">+ Versement</button>}
                      {r.statut !== "livree" && <button onClick={() => livrer(r)} className="text-xs font-bold text-white bg-emerald-700 rounded px-2 py-1 hover:bg-emerald-800 mr-2">📦 Livrer</button>}
                      {r.statut !== "livree" && <button onClick={() => annulerReservation(r)} className="text-xs text-red-600 underline">Annuler</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dettesEnRetard.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <span className="text-sm font-semibold text-red-700">
            ⚠ {dettesEnRetard.length} dette(s) de plus de 30 jours à relancer
          </span>
        </div>
      )}

      <Panel boutique={boutique}>
        <div className="font-bold mb-3 flex items-center gap-2">Nouvelle dette client <Badge boutique={boutique} /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="Client"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
          <Field label="Téléphone"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
          <Field label="Article / Motif"><input className={inputCls} value={f.motif} onChange={(e) => setF({ ...f, motif: e.target.value })} /></Field>
          <Field label="Montant dette (F)"><input type="number" className={inputCls} value={f.montant} onChange={(e) => setF({ ...f, montant: e.target.value })} /></Field>
          <Field label="Déjà payé (F)"><input type="number" className={inputCls} value={f.paye} onChange={(e) => setF({ ...f, paye: e.target.value })} /></Field>
        </div>
        <button onClick={ajouter} className={`mt-3 ${btnDark}`}>Enregistrer la dette</button>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">
          Dettes — {boutique} <span className="text-sm font-normal text-slate-500">· Reste total : {fmt(liste.reduce((s, d) => s + Math.max(0, d.montant - d.paye), 0))}</span>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Client", "Téléphone", "Motif", "Dette", "Payé", "Reste", "Statut", "Ancienneté", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">Aucune dette enregistrée.</td></tr>}
            {listePage.map((d) => {
              const st = statut(d);
              const jours = Math.floor((new Date(today()) - new Date(d.date)) / (1000 * 60 * 60 * 24));
              const estRetard = jours > 30 && d.montant - d.paye > 0;
              return (
                <tr key={d.id} className={`border-t border-slate-100 ${estRetard ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2">{dFR(d.date)}</td>
                  <td className="px-3 py-2 font-semibold">{d.client}</td>
                  <td className="px-3 py-2">{d.tel || "—"}</td>
                  <td className="px-3 py-2">{d.motif || "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(d.montant)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(d.paye)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(Math.max(0, d.montant - d.paye))}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${st === "Payée" ? "bg-green-100 text-green-700" : st === "Partielle" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{st}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {jours} jour{jours > 1 ? 's' : ''}
                    {estRetard && <span className="ml-1 text-red-600 font-bold">⚠</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button onClick={() => imprimerRecuVersement(d, db.boutiques.find((b) => b.nom === d.boutique) || {})} className="text-xs font-bold text-sky-800 underline mr-2" title="Imprimer le reçu (avec mention 'déjà livrée' si la marchandise est déjà partie)">🖨 Reçu</button>
                    {st !== "Payée" && (
                      <>
                        <button onClick={() => encaisser(d)} className="text-xs font-bold text-sky-800 underline mr-2">+ Paiement</button>
                        <button onClick={() => relancer(d)} className="text-xs font-bold text-green-700 underline mr-2">Relancer</button>
                      </>
                    )}
                    {profile.role === "admin" && (
                      <button onClick={() => supprimerDette(d)} className="text-xs text-red-600 underline">Suppr.</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

