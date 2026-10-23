// ============================================================
// screens/Commandes.jsx — Nouvelle commande (rôle Commercial) et
// Commandes reçues (rôle Vendeur + Admin).
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useCible, useCibleBoutique } from "../components/cibleEcran";
import { useState, useEffect } from "react";
import { uid, fmt, today, dFR, heureCourte, totalVente } from "../lib/core";
import { articleParCode, mettreAuPanier as ajouterAuPanierCommun } from "../lib/panier";
import { PAIEMENTS } from "../lib/constants";
import { Field, inputCls, btnDark, Badge, Panel, uAlert, uConfirm, uPrompt, AucuneBoutique, enTeteFige, celluleFigee, classeLigneDepliable, fondLigneDepliable, ListeArticles, PastillePaiement, TexteDepliable, BoutonRond, CelluleActions } from "../components/ui";
import { stockActuel, boutiquesVente, bloquerSiLecture, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, utilisateursDeLEspace, boutiqueRetenue, remiseExigeAdmin, PLAFOND_REMISE_PCT } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { SelecteurArticle } from "../components/SelecteurArticle";
import { posesAEncaisser, libelleEncaissementPose, ACOMPTE_POSE_PCT } from "../lib/poseSeule";
import { encaisserDettePose } from "../components/encaissementPose";

// ============ NOUVELLE COMMANDE (rôle Commercial) ============
// Le commercial compose un panier et l'envoie à une boutique — il ne peut
// pas encaisser lui-même, c'est un vendeur de cette boutique qui validera.
// Le statut d'une commande en PASTILLE (15/10/2026, la règle des lignes de
// 💰 Ventes et 📋 Dettes) — écrit une fois pour les deux écrans.
const PastilleCommande = ({ statut }) => {
  if (statut === "validee") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold border bg-green-100 text-green-700 border-green-200 whitespace-nowrap">✓ Validée</span>;
  if (statut === "refusee") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold border bg-red-100 text-red-700 border-red-200 whitespace-nowrap">✗ Refusée</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold border bg-amber-100 text-amber-700 border-amber-200 whitespace-nowrap">⏳ En attente</span>;
};
const lignesCommande = (c) => (c.articles || []).map((l) => ({ qte: l.qte, article: l.article }));
const totalCommande = (c) => (c.articles || []).reduce((s, l) => s + l.qte * l.pu, 0) - (c.remise || 0);

export function NouvelleCommande({ db, save, profile, preRempli, onPreRempliConsomme }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "commandes-nouvelle" });
  const [bq, setBq] = useState(preRempli?.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "commandes-nouvelle" });
  const produits = db.produits.filter((p) => p.boutique === boutique);
  const categories = [...new Set(produits.map((p) => p.categorie || "Autre"))].sort();

  const [cat, setCat] = useState("");
  const [sel, setSel] = useState({ produit_id: "", qte: "", pu: "" });
  const [panier, setPanier] = useState([]);
  const [f, setF] = useState({ client: "", tel: "", remise: preRempli?.remise ? String(preRempli.remise) : "", paiement: PAIEMENTS[0], vendeurCible: "", responsable: "", rabais: "" });
  // Responsables commerciaux actifs, que le commercial peut associer VOLONTAIREMENT
  // à sa commande pour partager la commission.
  // ⚠ Cloisonnement (29/08/2026) : une vraie commande ne se rattache pas à un
  // responsable d'entraînement.
  const responsables = utilisateursDeLEspace(db, profile).filter((u) => u.role === "resp_commercial" && u.actif !== false);
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

  const mettreAuPanier = (p, q, pu) => setPanier((pan) => ajouterAuPanierCommun(pan, p, q, pu));

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
    const p = articleParCode(produits, c);
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
    // Décision Timo (04/09/2026) : au-delà de 3 %, l'administrateur seul.
    if (remiseExigeAdmin(remisePct) && profile.role !== "admin") { uAlert(`🔒 Une remise supérieure à ${PLAFOND_REMISE_PCT} % est réservée à l'administrateur.`); return; }
    setMsg("");
    const dest = f.vendeurCible || "un vendeur disponible";
    if (!await uConfirm(`Envoyer cette commande (${panier.length} article(s), ${fmt(total)}) à ${boutique} pour ${dest} ?`)) return;

    const commande = {
      id: uid(),
      date: today(),
      heure: heureCourte(),
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
  const [depliee, setDepliee] = useState(null);

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      <BoutiqueTabs ecran="commandes-nouvelle" db={db} value={bq} onChange={setBq} profile={profile} />
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
                      <td className="px-3 py-2"><BoutonRond icone="✕" teinte="rouge" titre="Retirer de la liste" onClick={() => retirer(i)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Field label="Client"><input className={inputCls} value={f.client} onChange={(e) => setF({ ...f, client: e.target.value })} /></Field>
              <Field label="Numéro du client"><input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
              <Field label="Remise (%)"><input type="number" min="0" max="100" step="0.5" className={inputCls} value={f.remise} onChange={(e) => setF({ ...f, remise: e.target.value })} /></Field>
              <Field label="Paiement proposé">
                <select className={inputCls} value={f.paiement} onChange={(e) => setF({ ...f, paiement: e.target.value })}>
                  {PAIEMENTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Vendeur destinataire">
                <select className={inputCls} value={f.vendeurCible} onChange={(e) => setF({ ...f, vendeurCible: e.target.value })}>
                  <option value="">— N'importe quel vendeur —</option>
                  {vendeursBoutique.map((v) => <option key={v.id} value={v.nom}>{v.nom}</option>)}
                </select>
              </Field>
              {Number(profile.taux_commission || 0) > 0 && (
                <Field label="Rabais offert au client (F)">
                  <input type="number" min="0" className={inputCls} value={f.rabais} onChange={(e) => setF({ ...f, rabais: e.target.value })} />
                  <div className="text-xs text-orange-600 mt-1 font-semibold">Ce rabais est pris sur VOTRE commission ({profile.taux_commission} %), pas sur la marge de BMI.</div>
                </Field>
              )}
              {responsables.length > 0 && (
                <Field label="Associer mon responsable">
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
        {/* 🧾 La ligne suit la règle de 💰 Ventes et 📋 Dettes (15/10/2026) :
            le client figé, deux articles puis la suite au clic, le statut en pastille. */}
        <table className="w-full text-sm min-w-[700px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Date", "Boutique", "Articles", "Total", "Vendeur ciblé", "Statut"].map((h, i) => <th key={h} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {mesCommandes.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucune commande envoyée pour l'instant.</td></tr>}
            {mesCommandes.map((c, i) => {
              const ouverte = depliee === c.id;
              return (
              <tr key={c.id} data-ligne-commande={ouverte ? "deplie" : "replie"} onClick={() => setDepliee(ouverte ? null : c.id)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(ouverte, i)}`}>
                <td className={`px-3 py-2 min-w-[150px] ${celluleFigee(fondLigneDepliable(ouverte, i), ouverte)}`}>
                  <div className="font-bold text-slate-800">{c.client || <span className="text-slate-400 font-normal">—</span>}</div>
                  {c.tel && <div className="text-xs text-slate-500">{c.tel}</div>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}{c.heure && <div className="text-xs text-slate-500">{c.heure}</div>}</td>
                <td className="px-3 py-2"><Badge boutique={c.boutique} /></td>
                <td className="px-3 py-2"><ListeArticles lignes={lignesCommande(c)} deplie={ouverte} /></td>
                <td className="px-3 py-2 text-right tabular-nums font-bold whitespace-nowrap">{fmt(totalCommande(c))}</td>
                <td className="px-3 py-2">{c.vendeur_cible || "N'importe qui"}</td>
                <td className="px-3 py-2"><PastilleCommande statut={c.statut} /></td>
              </tr>
              );
            })}
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
export function CommandesRecues({ db, save, profile, onValider, cible = null }) {
  const isAdmin = profile.role === "admin";
  const premiere = boutiqueParDefaut(db, profile, { ecran: "commandes-recues" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "commandes-recues" });
  // 🔔 Une notification cliquée (16/10/2026) : la boutique de la commande.
  useCibleBoutique(cible, "commandes", setBq, profile, "commandes-recues");

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

  // 🔧 Les POSES SEULES de cette boutique (Timo, 29/09/2026, option « c ») :
  // les 70 % d'acompte de l'article 4, puis les 30 % du solde. C'est la MÊME
  // dette que sur le chantier (🏠 Clients installés) : le premier qui encaisse
  // ferme pour tout le monde. 🏗 L'argent entre dans la caisse CHANTIER
  // (08/10/2026), pas dans le tiroir de cette boutique : on le range à part.
  const [noteRecuWa, setNoteRecuWa] = useState("");
  const [depliee, setDepliee] = useState(null);
  const [poseDepliee, setPoseDepliee] = useState(null);
  const poses = boutique ? posesAEncaisser(db.dettes, db.clients_installes, boutique) : [];
  const encaisserPose = async (p) => {
    const note = await encaisserDettePose({ db, save, profile, chantier: p.chantier, enBoutique: true });
    if (note !== null) setNoteRecuWa(note);
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="commandes-recues" db={db} value={bq} onChange={setBq} profile={profile} />}
      {noteRecuWa && <div className="text-xs text-slate-500" data-recu-whatsapp>{noteRecuWa}</div>}

      {poses.length > 0 && (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-x-auto" data-poses-a-encaisser>
          <div className="px-4 py-3 font-bold text-slate-800 border-b border-emerald-200 bg-emerald-50 flex items-center gap-2">🔧 Poses à encaisser <Badge boutique={boutique} /><span className="text-sm font-normal text-slate-500">({poses.length})</span></div>
          <div className="px-4 pt-2 text-xs text-slate-500">Contrat de pose : {ACOMPTE_POSE_PCT} % avant les travaux (l'installation ne se programme pas avant), le reste à la signature du PV. Le client peut aussi payer sur le terrain, au chef de chantier. 🏗 L'argent reçu entre dans la caisse CHANTIER, pas dans le tiroir de la boutique : rangez-le à part.</div>
          <table className="w-full text-sm min-w-[640px] mt-2">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Motif", "Total", "Déjà versé", "Où on en est", ""].map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
            {poses.map((p, i) => {
              const ouverte = poseDepliee === p.dette.id;
              return (
              <tr key={p.dette.id} onClick={() => setPoseDepliee(ouverte ? null : p.dette.id)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(ouverte, i)}`}>
                <td className={`px-3 py-2 font-bold text-slate-800 min-w-[150px] ${celluleFigee(fondLigneDepliable(ouverte, i), ouverte)}`}>{p.dette.client || `${p.chantier.prenom || ""} ${p.chantier.nom || ""}`.trim()}</td>
                <td className="px-3 py-2 text-slate-600 min-w-[200px]"><TexteDepliable texte={p.dette.motif} deplie={ouverte} largeur="max-w-[280px]" /></td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(p.dette.montant)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(p.dette.paye || 0)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-emerald-800">
                  {p.etat.etape === "acompte"
                    ? `Acompte ${ACOMPTE_POSE_PCT} % : ${fmt(p.etat.acompte)} — reste ${fmt(p.etat.resteAcompte)} avant de programmer`
                    : `Acompte versé — solde à la signature du PV : ${fmt(p.etat.reste)}`}
                </td>
                <CelluleActions>
                  <BoutonRond icone="💰" teinte="vert" onClick={() => encaisserPose(p)} titre={`💰 ${libelleEncaissementPose(p.dette)}`} />
                </CelluleActions>
              </tr>
              );
            })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex items-center gap-2">📥 Commandes en attente <Badge boutique={boutique} /><span className="text-sm font-normal text-slate-500">({enAttente.length})</span></div>
        {enAttente.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-400">Aucune commande en attente pour {boutique}.</div>
        ) : (
          <table className="w-full text-sm min-w-[760px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Date", "Commercial", "Articles", "Total", "Paiement", ""].map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
            {enAttente.map((c, i) => {
              const totalC = totalCommande(c);
              const ouverte = depliee === c.id;
              return (
                <tr key={c.id} data-ligne={c.id} data-commande-attente onClick={() => setDepliee(ouverte ? null : c.id)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(ouverte, i)}`}>
                  <td className={`px-3 py-2 min-w-[150px] ${celluleFigee(fondLigneDepliable(ouverte, i), ouverte)}`}>
                    <div className="font-bold text-slate-800">{c.client || <span className="text-slate-400 font-normal">—</span>}</div>
                    {c.tel && <div className="text-xs text-slate-500">{c.tel}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}{c.heure && <div className="text-xs text-slate-500">{c.heure}</div>}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-800">{c.commercial}</div>
                    {c.vendeur_cible && <div className="text-xs font-semibold text-sky-700">Destinée à : {c.vendeur_cible}</div>}
                  </td>
                  <td className="px-3 py-2"><ListeArticles lignes={lignesCommande(c)} deplie={ouverte} /></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-bold tabular-nums">{fmt(totalC)}</div>
                    {c.remise ? <div className="text-xs text-red-600">remise {c.remise_pct} %</div> : null}
                  </td>
                  <td className="px-3 py-2"><PastillePaiement paiement={c.paiement} /></td>
                  <CelluleActions>
                    <BoutonRond icone="✅" teinte="vert" onClick={() => valider(c)} titre="✅ Valider et encaisser" />
                    <BoutonRond icone="❌" teinte="rouge" onClick={() => refuser(c)} titre="❌ Refuser" />
                  </CelluleActions>
                </tr>
              );
            })}
            </tbody>
          </table>
        )}
      </div>

      {historique.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-slate-700 border-b border-slate-200 bg-slate-50 text-sm">Historique récent</div>
          <table className="w-full text-sm min-w-[700px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Date", "Commercial", "Articles", "Statut", ""].map((h, i) => <th key={h || i} className={`text-left px-3 py-2${i === 0 ? ` ${enTeteFige("bg-white")}` : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {historique.map((c, i) => {
                const ouverte = depliee === c.id;
                const vente = c.suivi_vente ? (db.ventes || []).find((v) => v.commande_id === c.id) : null;
                return (
                <tr key={c.id} onClick={() => setDepliee(ouverte ? null : c.id)} className={`border-t border-slate-100 cursor-pointer align-top ${classeLigneDepliable(ouverte, i)}`}>
                  <td className={`px-3 py-2 min-w-[150px] ${celluleFigee(fondLigneDepliable(ouverte, i), ouverte)}`}>
                    <div className="font-bold text-slate-800">{c.client || <span className="text-slate-400 font-normal">—</span>}</div>
                    {c.tel && <div className="text-xs text-slate-500">{c.tel}</div>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(c.date)}</td>
                  <td className="px-3 py-2">{c.commercial}</td>
                  <td className="px-3 py-2"><ListeArticles lignes={lignesCommande(c)} deplie={ouverte} /></td>
                  <td className="px-3 py-2">
                    <PastilleCommande statut={c.statut} />
                    {c.statut !== "validee" && c.motif_refus && <div className="text-xs text-red-600 mt-0.5"><TexteDepliable texte={`Motif : ${c.motif_refus}`} deplie={ouverte} largeur="max-w-[220px]" /></div>}
                    {vente && (
                      <div className="mt-1 text-[10px] text-slate-500">
                        ✅ Encaissée — vente N° {vente.numero} du {dFR(vente.date)} ({fmt(totalVente(vente))})
                        {ouverte && <><br />{(vente.articles || []).map((l) => `${l.qte}× ${l.article}`).join(", ")}</>}
                      </div>
                    )}
                    {venteEnSuspens(c) && <div className="mt-1 text-[10px] font-bold text-amber-700">⚠ Commande validée mais NON ENCAISSÉE</div>}
                  </td>
                  <CelluleActions>
                    {venteEnSuspens(c) && (
                      <BoutonRond icone="↻" teinte="ambre" titre="↻ Reprendre l'encaissement" onClick={() => {
                        const panier = panierDeReprise(c);
                        if (panier.length === 0) { uAlert("Aucun article retrouvé pour cette commande (ni sur la commande, ni sur le devis d'origine). Contactez l'administrateur pour vérifier ce dossier avant d'encaisser."); return; }
                        onValider(c.boutique, panier, c.commercial, c.responsable, c.rabais, c.origine_devis, c.remise_pct || 0, c.client || "", c.tel || "", c.id);
                      }} />
                    )}
                  </CelluleActions>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

