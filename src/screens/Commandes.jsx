// ============================================================
// screens/Commandes.jsx — Nouvelle commande (rôle Commercial) et
// Commandes reçues (rôle Vendeur + Admin).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState, useEffect } from "react";
import { uid, fmt, today, dFR, totalVente } from "../lib/core";
import { PAIEMENTS } from "../lib/constants";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt } from "../components/ui";
import { stockActuel, boutiquesVente, bloquerSiLecture, boutiquesVisibles } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { SelecteurArticle } from "../components/SelecteurArticle";

// ============ NOUVELLE COMMANDE (rôle Commercial) ============
// Le commercial compose un panier et l'envoie à une boutique — il ne peut
// pas encaisser lui-même, c'est un vendeur de cette boutique qui validera.
export function NouvelleCommande({ db, save, profile, preRempli, onPreRempliConsomme }) {
  const premiere = boutiquesVisibles(db, profile, boutiquesVente(db))[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(preRempli?.boutique || premiere);
  const boutique = bq;
  const produits = db.produits.filter((p) => p.boutique === boutique);
  const categories = [...new Set(produits.map((p) => p.categorie || "Autre"))].sort();

  const [cat, setCat] = useState("");
  const [sel, setSel] = useState({ produit_id: "", qte: "", pu: "" });
  const [panier, setPanier] = useState([]);
  const [f, setF] = useState({ client: "", tel: "", remise: preRempli?.remise ? String(preRempli.remise) : "", paiement: PAIEMENTS[0], vendeurCible: "", responsable: "", rabais: "" });
  // Responsables commerciaux actifs, que le commercial peut associer VOLONTAIREMENT
  // à sa commande pour partager la commission.
  const responsables = db.users.filter((u) => u.role === "resp_commercial" && u.actif !== false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  // RÉACTIF à chaque nouveau preRempli — même correctif que Ventes.jsx
  // (voir son commentaire) : les écrans restent désormais en veille entre
  // deux visites (2.98.99), donc un useState(() => ...) figé au montage ne
  // suffit plus. En plus de ce piège, LE PANIER LUI-MÊME n'était encore
  // JAMAIS repris ici (contrairement à Ventes.jsx) — un devis converti en
  // commande par un commercial/technicien perdait TOUT son contenu
  // (panneaux, batteries, rails...), pas seulement en cas de veille.
  useEffect(() => {
    if (!preRempli) return;
    if (preRempli.boutique) setBq(preRempli.boutique);
    setPanier(preRempli.panier || []);
    setF((f0) => ({
      ...f0,
      client: preRempli.client || f0.client,
      tel: preRempli.tel || f0.tel,
      remise: preRempli.remise ? String(preRempli.remise) : f0.remise,
      responsable: preRempli.responsable || f0.responsable,
      rabais: preRempli.rabais || f0.rabais,
    }));
    if (onPreRempliConsomme) onPreRempliConsomme();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preRempli]);

  const vendeursBoutique = db.users.filter((u) => u.role === "vendeur" && u.boutique === boutique && u.actif !== false);
  const produitsFiltres = cat ? produits.filter((p) => (p.categorie || "Autre") === cat) : produits;
  const dansPanier = (pid) => panier.reduce((s, l) => s + (l.produit_id === pid ? Number(l.qte) : 0), 0);
  const dispoRestant = (p) => stockActuel(db, p) - dansPanier(p.id);

  const choisir = (id) => {
    const p = produits.find((x) => x.id === id);
    setSel({ produit_id: id, qte: "1", pu: p && p.prix_vente != null ? String(p.prix_vente) : "" });
    if (p) setCat(p.categorie || "Autre");
  };

  const mettreAuPanier = (p, q, pu) => {
    setPanier((pan) => {
      const i = pan.findIndex((l) => l.produit_id === p.id && Number(l.pu) === Number(pu));
      if (i >= 0) { const cp = [...pan]; cp[i] = { ...cp[i], qte: Number(cp[i].qte) + q }; return cp; }
      return [...pan, { produit_id: p.id, article: p.nom, qte: q, pu: Number(pu) }];
    });
  };

  const ajouterAuPanier = () => {
    const p = produits.find((x) => x.id === sel.produit_id);
    const q = Number(sel.qte);
    if (!p || !q || q <= 0 || !sel.pu) { setMsg("Choisissez un article, la quantité et le prix."); return; }
    if (q > dispoRestant(p)) { setMsg(`Stock insuffisant : il reste ${dispoRestant(p)} pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, q, sel.pu);
    setSel({ produit_id: "", qte: "", pu: "" });
  };

  const scanner = (e) => {
    if (e.key !== "Enter") return;
    const c = code.trim();
    setCode("");
    if (!c) return;
    const p = produits.find((x) => String(x.code || "").trim() === c);
    if (!p) { setMsg(`Aucun article avec le code « ${c} » dans ${boutique}.`); return; }
    if (dispoRestant(p) < 1) { setMsg(`Stock épuisé pour « ${p.nom} ».`); return; }
    setMsg("");
    mettreAuPanier(p, 1, p.prix_vente);
  };

  const retirer = (i) => setPanier(panier.filter((_, j) => j !== i));

  const brut = panier.reduce((s, l) => s + Number(l.qte) * Number(l.pu), 0);
  const remisePct = Number(f.remise || 0);
  const remise = Math.round((brut * remisePct) / 100);
  const total = brut - remise;

  const envoyer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (panier.length === 0) { setMsg("Le panier est vide : ajoutez au moins un article."); return; }
    if (remisePct < 0 || remisePct > 100) { setMsg("La remise doit être comprise entre 0 et 100 %."); return; }
    setMsg("");
    const dest = f.vendeurCible || "un vendeur disponible";
    if (!await uConfirm(`Envoyer cette commande (${panier.length} article(s), ${fmt(total)}) à ${boutique} pour ${dest} ?`)) return;

    const commande = {
      id: uid(),
      date: today(),
      heure: new Date().toTimeString().slice(0, 5),
      commercial: profile.nom,
      responsable: f.responsable || null,
      // Le rabais est plafonné à la commission du commercial sur cette commande.
      rabais: Math.min(Number(f.rabais || 0), Math.round((total * Number(profile.taux_commission || 0)) / 100)),
      boutique,
      vendeur_cible: f.vendeurCible || null,
      articles: panier,
      client: f.client,
      tel: f.tel,
      remise,
      remise_pct: remisePct,
      paiement: f.paiement,
      statut: "en_attente",
    };
    save({ ...db, commandes: [commande, ...(db.commandes || [])] }, `Commande envoyée à ${boutique} (${fmt(total)}) — ${profile.nom}`);
    setPanier([]);
    setF({ client: "", tel: "", remise: "", paiement: PAIEMENTS[0], vendeurCible: "", responsable: "", rabais: "" });
    setCat("");
    uAlert("Commande envoyée ! Le vendeur de la boutique la validera et encaissera la vente.");
  };

  const mesCommandes = (db.commandes || []).filter((c) => c.commercial === profile.nom);
  const badgeStatut = (s) => {
    if (s === "validee") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✓ Validée</span>;
    if (s === "refusee") return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">✗ Refusée</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">⏳ En attente</span>;
  };

  return (
    <div className="space-y-4">
      <BoutiqueTabs db={db} value={bq} onChange={setBq} profile={profile} />
      <Panel boutique={boutique}>
        <div className="font-bold mb-3">🛒 Nouvelle commande <Badge boutique={boutique} /></div>
        {produits.length === 0 ? (
          <div className="text-sm text-slate-600">Aucun article en stock pour cette boutique.</div>
        ) : (
          <>
            <div className="mb-3">
              <Field label="🔍 Scanner un code-barres">
                <input className={inputCls} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={scanner} placeholder="Scannez ou tapez le code puis Entrée…" />
              </Field>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Catégorie">
                <select className={inputCls} value={cat} onChange={(e) => { setCat(e.target.value); setSel({ produit_id: "", qte: "", pu: "" }); }}>
                  <option value="">— Toutes —</option>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Article">
                <SelecteurArticle produits={produits} valeur={sel.produit_id} onChoisir={choisir} dispoRestant={dispoRestant} categorieFiltre={cat} />
              </Field>
              <Field label="Quantité"><input type="number" min="1" className={inputCls} value={sel.qte} onChange={(e) => setSel({ ...sel, qte: e.target.value })} /></Field>
              <Field label="Prix unitaire (F)"><input type="number" className={inputCls} value={sel.pu} onChange={(e) => setSel({ ...sel, pu: e.target.value })} /></Field>
              <div className="flex items-end"><button onClick={ajouterAuPanier} className={`w-full ${btnDark}`}>➕ Ajouter</button></div>
            </div>

            <div className="mt-4 bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <div className="px-3 py-2 text-sm font-bold text-slate-700 border-b border-slate-100 bg-slate-50">🛒 Panier ({panier.length} article{panier.length > 1 ? "s" : ""})</div>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{["Article", "Qté", "P.U.", "Montant", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
                <tbody>
                  {panier.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">Panier vide.</td></tr>}
                  {panier.map((l, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{l.article}</td>
                      <td className="px-3 py-2 tabular-nums">{l.qte}</td>
                      <td className="px-3 py-2 tabular-nums">{fmt(l.pu)}</td>
                      <td className="px-3 py-2 tabular-nums font-bold">{fmt(l.qte * l.pu)}</td>
                      <td className="px-3 py-2"><button onClick={() => retirer(i)} className="text-xs text-red-600 underline">Retirer</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Client (facultatif)"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
              <Field label="Numéro du client"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
              <Field label="Remise (%) — facultatif"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.remise} onChange={(e) => setF({ ...f, remise: e.target.value })} /></Field>
              <Field label="Paiement proposé">
                <select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>
                  {PAIEMENTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Vendeur destinataire (facultatif)">
                <select className={inputCls} value={f.vendeurCible} onChange={(e) => setF({ ...f, vendeurCible: e.target.value })}>
                  <option value="">— N'importe quel vendeur —</option>
                  {vendeursBoutique.map((v) => <option key={v.id} value={v.nom}>{v.nom}</option>)}
                </select>
              </Field>
              {Number(profile.taux_commission || 0) > 0 && (
                <Field label="Rabais offert au client (F) — facultatif">
                  <input type="number" min="0" className={inputCls} value={f.rabais} onChange={(e) => setF({ ...f, rabais: e.target.value })} />
                  <div className="text-xs text-orange-600 mt-1 font-semibold">Ce rabais est pris sur VOTRE commission ({profile.taux_commission} %), pas sur la marge de BMI.</div>
                </Field>
              )}
              {responsables.length > 0 && (
                <Field label="Associer mon responsable (facultatif)">
                  <select className={inputCls} value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })}>
                    <option value="">— Aucun (je garde toute ma commission) —</option>
                    {responsables.map((r) => <option key={r.id} value={r.nom}>{r.nom}{Number(r.taux_commission || 0) > 0 ? ` — ${r.taux_commission} %` : ""}</option>)}
                  </select>
                </Field>
              )}
            </div>

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button onClick={envoyer} className="px-6 py-2.5 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800 shadow-sm">📤 Envoyer la commande à la boutique</button>
              <span className="text-base font-bold tabular-nums">Total : {fmt(total)}{remise > 0 && <span className="text-red-600 text-sm font-semibold"> (remise −{fmt(remise)})</span>}</span>
              {msg && <span className="text-sm text-red-600 font-semibold">{msg}</span>}
            </div>
          </>
        )}
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Mes commandes envoyées ({mesCommandes.length})</div>
        <table className="w-full text-sm min-w-[700px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Boutique", "Articles", "Total", "Vendeur ciblé", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {mesCommandes.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucune commande envoyée pour l'instant.</td></tr>}
            {mesCommandes.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}{c.heure ? ` ${c.heure}` : ""}</td>
                <td className="px-3 py-2"><Badge boutique={c.boutique} /></td>
                <td className="px-3 py-2">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt((c.articles || []).reduce((s, l) => s + l.qte * l.pu, 0) - (c.remise || 0))}</td>
                <td className="px-3 py-2">{c.vendeur_cible || "N'importe qui"}</td>
                <td className="px-3 py-2">{badgeStatut(c.statut)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ COMMANDES REÇUES (rôle Vendeur + Admin) ============
// Le vendeur voit les commandes envoyées par les commerciaux pour sa
// boutique, et les valide pour finaliser la vente (encaissement dans
// l'onglet Ventes, panier déjà prêt).
export function CommandesRecues({ db, save, profile, onValider }) {
  const isAdmin = profile.role === "admin";
  const premiere = boutiquesVisibles(db, profile, boutiquesVente(db))[0]?.nom || db.boutiques[0]?.nom || "";
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = profile.boutique || bq;

  const enAttente = (db.commandes || []).filter((c) =>
    c.statut === "en_attente" &&
    c.boutique === boutique &&
    (isAdmin || !c.vendeur_cible || c.vendeur_cible === profile.nom)
  );

  // Une commande validée mais JAMAIS encaissée (vendeur interrompu, page
  // actualisée, oubli…) ne doit JAMAIS disparaître silencieusement : on la
  // détecte en vérifiant qu'aucune vente ne lui est reliée. Le lien direct
  // (commande_id sur la vente) n'existe que pour les commandes validées à
  // partir de ce correctif (marquées `suivi_vente`) — pour les anciennes,
  // on retombe sur l'ancienne vérification via le devis d'origine, pour ne
  // pas signaler à tort des ventes déjà bel et bien encaissées.
  const venteEnSuspens = (c) => {
    if (c.statut !== "validee") return false;
    if (c.suivi_vente) return !(db.ventes || []).some((v) => v.commande_id === c.id);
    const od = c.origine_devis;
    if (!od) return false;
    const cl = db.users.find((u) => u.id === od.client_id);
    const d = (cl?.devis || []).find((x) => x.id === od.devis_id);
    return !!d && d.statut !== "paye";
  };

  const historiqueBrut = (db.commandes || []).filter((c) => c.statut !== "en_attente" && c.boutique === boutique);
  // Les commandes en suspens (validées, jamais encaissées) ne doivent JAMAIS
  // sortir de la liste, même si beaucoup d'autres commandes ont été traitées
  // depuis — sinon elles redeviennent invisibles, exactement le problème
  // qu'on corrige ici.
  const enSuspensListe = historiqueBrut.filter((c) => venteEnSuspens(c));
  const historique = [...enSuspensListe, ...historiqueBrut.filter((c) => !venteEnSuspens(c)).slice(0, 30)];

  const valider = (c) => {
    if (bloquerSiLecture(db, profile)) return;
    save({ ...db, commandes: db.commandes.map((x) => (x.id === c.id ? { ...x, statut: "validee", valide_par: profile.nom, suivi_vente: true } : x)) }, `Commande de ${c.commercial} validée par ${profile.nom} — ${c.boutique}`);
    // origine_devis suit jusqu'à l'encaissement : c'est lui qui déclenchera la
    // création de la fiche d'installation.
    onValider(c.boutique, c.articles, c.commercial, c.responsable, c.rabais, c.origine_devis || null, c.remise_pct || 0, c.client || "", c.tel || "", c.id);
  };

  const refuser = async (c) => {
    const motif = await uPrompt(`Motif du refus de la commande de ${c.commercial || "ce client"} (facultatif) :`, "");
    if (motif === null) return;
    let next = { ...db, commandes: db.commandes.map((x) => (x.id === c.id ? { ...x, statut: "refusee", valide_par: profile.nom, motif_refus: motif } : x)) };

    // Si la commande venait d'un DEVIS, on le rend au client : sinon son devis
    // resterait « validé » à jamais, sans bouton pour recommencer. Il pourra
    // re-valider, éventuellement dans une autre boutique.
    const od = c.origine_devis;
    if (od) {
      next = {
        ...next,
        users: next.users.map((u) => (u.id === od.client_id
          ? { ...u, devis: (u.devis || []).map((d) => (d.id === od.devis_id
              ? { ...d, statut: "propose", boutique_paiement: null, commande_id: null, refus_motif: motif || "Refusé par la boutique" }
              : d)) }
          : u)),
      };
    }
    save(next, `Commande de ${c.commercial || "client"} refusée par ${profile.nom}${motif ? " (" + motif + ")" : ""}${od ? " — devis rendu au client" : ""}`);
  };

  // Le panier « figé » sur la commande peut être vide ou périmé (ancien
  // enregistrement, resynchronisation…) : on reconstruit depuis le devis
  // d'origine — la source la plus fiable — et on ne retombe sur celui de
  // la commande qu'en dernier recours.
  const panierDeReprise = (c) => {
    const od = c.origine_devis;
    if (od) {
      const cl = db.users.find((u) => u.id === od.client_id);
      const d = (cl?.devis || []).find((x) => x.id === od.devis_id);
      if (d?.panier?.length) return d.panier;
    }
    return c.articles || [];
  };

  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs db={db} value={bq} onChange={setBq} profile={profile} />}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">📥 Commandes en attente <Badge boutique={boutique} /><span className="text-sm font-normal text-slate-500">({enAttente.length})</span></div>
        {enAttente.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400">Aucune commande en attente pour {boutique}.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {enAttente.map((c) => {
              const totalC = (c.articles || []).reduce((s, l) => s + l.qte * l.pu, 0) - (c.remise || 0);
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <div className="font-bold text-slate-800">{c.commercial} <span className="text-xs font-normal text-slate-400">— {dFR(c.date)}{c.heure ? ` ${c.heure}` : ""}</span></div>
                    {c.vendeur_cible && <span className="text-xs font-semibold text-sky-700">Destinée à : {c.vendeur_cible}</span>}
                  </div>
                  <div className="text-sm text-slate-600 mb-1">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</div>
                  <div className="text-xs text-slate-500 mb-2">
                    {c.client && <>Client : {c.client} · </>}
                    {c.tel && <>{c.tel} · </>}
                    Paiement proposé : {c.paiement}
                    {c.remise ? ` · Remise ${c.remise_pct}%` : ""}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold tabular-nums">{fmt(totalC)}</span>
                    <button onClick={() => valider(c)} className="px-4 py-1.5 rounded-lg bg-green-700 text-white font-bold text-xs hover:bg-green-800">✅ Valider et encaisser</button>
                    <button onClick={() => refuser(c)} className="px-4 py-1.5 rounded-lg border-2 border-red-500 text-red-600 font-bold text-xs hover:bg-red-50">❌ Refuser</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200 bg-slate-50 text-sm">Historique récent</div>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Commercial", "Articles", "Statut"].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {historique.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}</td>
                  <td className="px-3 py-2">{c.commercial}</td>
                  <td className="px-3 py-2">{(c.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</td>
                  <td className="px-3 py-2">
                    {c.statut === "validee"
                      ? <span className="text-green-700 font-semibold">✓ Validée</span>
                      : <span className="text-red-600 font-semibold">✗ Refusée{c.motif_refus ? ` (${c.motif_refus})` : ""}</span>}
                    {(() => {
                      const vente = c.suivi_vente ? (db.ventes || []).find((v) => v.commande_id === c.id) : null;
                      return vente ? (
                        <div className="mt-1 text-[10px] text-slate-500">
                          ✅ Encaissée — vente N° {vente.numero} du {dFR(vente.date)} ({fmt(totalVente(vente))})<br />
                          {(vente.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}
                        </div>
                      ) : null;
                    })()}
                    {venteEnSuspens(c) && (
                      <div className="mt-1">
                        <div className="text-[10px] font-bold text-amber-700">⚠ Commande validée mais NON ENCAISSÉE</div>
                        <button onClick={() => {
                          const panier = panierDeReprise(c);
                          if (panier.length === 0) { uAlert("Aucun article retrouvé pour cette commande (ni sur la commande, ni sur le devis d'origine). Contactez l'administrateur pour vérifier ce dossier avant d'encaisser."); return; }
                          onValider(c.boutique, panier, c.commercial, c.responsable, c.rabais, c.origine_devis, c.remise_pct || 0, c.client || "", c.tel || "", c.id);
                        }} className="mt-1 text-[10px] font-bold text-white bg-amber-600 rounded px-2 py-0.5 hover:bg-amber-700">↻ Reprendre l'encaissement</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

