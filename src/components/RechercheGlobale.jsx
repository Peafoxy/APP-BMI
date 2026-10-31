// ============================================================
// components/RechercheGlobale.jsx — Recherche transversale (ventes,
// produits, devis, clients, prospects) avec la même visibilité que
// les écrans respectifs. Aiguillage rapide, pas un rapport complet.
// ============================================================
import { useState } from "react";
import { libelleTypeDevis } from "../screens/TousLesDevis";
import { Ventes } from "../screens/Ventes";
import { Clients } from "../screens/Clients";
import { totalVente, numeroRecu, fmt, col } from "../lib/core";
import { Badge } from "../components/ui";
import { normNom, espaceDuCompte, boutiquesVisibles, stockActuel } from "../lib/calculs";
import { correspond } from "../lib/suggestions";

// ============ RECHERCHE GLOBALE ============
// Cherche en même temps dans les ventes, produits, devis, clients et
// prospects — chacun dans la même visibilité que son propre écran (un
// vendeur ne voit que sa boutique, un commercial que ses propres prospects
// et devis, etc.). Limité à quelques résultats par catégorie : c'est un
// aiguillage rapide, pas un rapport complet.
export function rechercherGlobalement(db, profile, texte) {
  const q = normNom(texte);
  if (q.length < 2) return null;
  const isAdmin = profile.role === "admin";
  const voitToutDevis = isAdmin || profile.role === "resp_commercial";
  const voitToutProspects = isAdmin || profile.chef_equipe || profile.role === "resp_commercial";
  const maBoutique = profile.boutique;

  // ⚠ Cloisonnement formation / réel. Le filtre par boutique ci-dessous
  // s'écrit `!maBoutique || …` : il ne s'applique donc PAS aux comptes sans
  // boutique rattachée (admin, commercial, technicien, responsable
  // commercial, comptable), qui voyaient ainsi les deux espaces d'un coup —
  // dans les deux sens. Clients, devis et prospects, eux, n'étaient pas
  // filtrés du tout. `espace` vaut undefined pour l'admin principal.
  const espace = espaceDuCompte(db, profile);
  const boutiquesEspace = new Set(boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom));
  const bonneBoutique = (nom) => (maBoutique ? nom === maBoutique : boutiquesEspace.has(nom));
  const bonEspace = (x) => espace === undefined || !!x.formation === espace;

  const clients = db.users
    .filter((u) => u.role === "client" && u.actif !== false && bonEspace(u))
    .filter((u) => correspond(`${u.nom_base || u.nom} ${u.tel || ""}`, q))
    .slice(0, 6);

  const ventes = (db.ventes || [])
    .filter((v) => bonneBoutique(v.boutique))
    .filter((v) => correspond(`${numeroRecu(v)} ${v.client || ""} ${v.tel || ""}`, q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  // Même règle de recherche que les champs à suggestions (lib/suggestions) :
  // accents et majuscules ignorés, chaque mot tapé dans n'importe quel ordre.
  // 🏪 Rangés PAR BOUTIQUE (16/10/2026, capture Timo : « ranger par boutique
  // que de mélanger tantôt DEMAKPOE, tantôt APESSITO » → « a, 6 par
  // boutique ») : la boutique de la personne d'abord, puis les autres par
  // ordre alphabétique ; dans une boutique, par nom (les nombres lus comme des
  // nombres : 650VA avant 1200VA) ; 6 articles au plus PAR boutique.
  const produitsParBoutique = grouperProduitsParBoutique(
    (db.produits || [])
      .filter((p) => bonneBoutique(p.boutique))
      .filter((p) => correspond(`${p.nom} ${p.code || ""}`, q)),
    maBoutique,
  );
  const produits = produitsParBoutique.flatMap((g) => g.items);
  // 📍 Le stock des AUTRES boutiques, pour qui a une boutique (Timo, 30/10/2026 :
  // « comment un gérant saura qu'il y a du stock à APESSITO pour faire une
  // demande ? » → « a ») : des QUANTITÉS seulement, jamais un prix ni une
  // vente, et seulement dans l'espace regardé (boutiquesEspace). Rangé À PART,
  // APRÈS sa boutique (31/10/2026 : « faire afficher sa boutique d'abord,
  // ensuite le stock d'ailleurs ») — jamais mêlé à ses propres lignes.
  const autresBoutiques = maBoutique
    ? stockAilleurs(db, (db.produits || []).filter((p) => correspond(`${p.nom} ${p.code || ""}`, q)), maBoutique,
        (db.boutiques || []).filter((b) => boutiquesEspace.has(b.nom) && !b.terrain && b.nom !== maBoutique).map((b) => b.nom))
    : [];

  const devis = db.users
    .filter((u) => u.role === "client")
    .flatMap((u) => (u.devis || []).map((d) => ({ ...d, client: u })))
    .filter(bonEspace)
    .filter((d) => voitToutDevis || d.par_id === profile.id)
    .filter((d) => correspond(`${d.client?.nom_base || d.client?.nom || ""} ${libelleTypeDevis(d)}`, q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  // Proformas : mêmes yeux que la liste « Proformas émis » de l'onglet Ventes
  const voitProformas = ["vendeur", "gerant", "resp_commercial", "admin"].includes(profile.role);
  const proformas = !voitProformas ? [] : (db.proformas || [])
    .filter((pf) => bonneBoutique(pf.boutique))
    .filter((pf) => correspond(`${pf.numero || ""} ${pf.client || ""} ${pf.tel || ""}`, q))
    .sort((a, b) => String(b.ts || b.date).localeCompare(String(a.ts || a.date)))
    .slice(0, 6);

  const prospects = (db.prospects || [])
    .filter(bonEspace)
    .filter((p) => voitToutProspects || p.commercial === profile.nom)
    .filter((p) => correspond(`${p.nom} ${p.tel || ""}`, q))
    .slice(0, 6);

  const total = clients.length + ventes.length + produits.length + autresBoutiques.reduce((n, g) => n + g.items.length, 0) + devis.length + prospects.length + proformas.length;
  return { clients, ventes, produits, produitsParBoutique, autresBoutiques, devis, prospects, proformas, total };
}

// Les articles trouvés (`trouves`, déjà cherchés) dans les boutiques `autres`,
// rangés PAR BOUTIQUE (ordre alphabétique) : [{ boutique, items: [{ nom, stock, chezMoi }] }].
// `chezMoi` dit si ma boutique a aussi cet article ; ceux que je n'ai pas viennent
// en tête de leur boutique. PRODUITS_PAR_BOUTIQUE au plus chacune. Rien d'autre
// que le nom et la quantité : ni prix de vente, ni prix d'achat.
export function stockAilleurs(db, trouves, maBoutique, autres) {
  const autresSet = new Set(autres || []);
  const chezMoi = new Set((trouves || []).filter((p) => p.boutique === maBoutique).map((p) => normNom(p.nom)));
  const groupes = new Map();
  (trouves || []).forEach((p) => {
    if (!autresSet.has(p.boutique)) return;
    if (!groupes.has(p.boutique)) groupes.set(p.boutique, []);
    groupes.get(p.boutique).push({ nom: p.nom, stock: stockActuel(db, p), chezMoi: chezMoi.has(normNom(p.nom)) });
  });
  return [...groupes.entries()]
    .sort(([a], [b]) => comparerFr(a, b))
    .map(([boutique, items]) => ({ boutique, items: [...items]
      .sort((x, y) => (x.chezMoi !== y.chezMoi ? (x.chezMoi ? 1 : -1) : comparerFr(x.nom, y.nom)))
      .slice(0, PRODUITS_PAR_BOUTIQUE) }));
}

export const PRODUITS_PAR_BOUTIQUE = 6;
const comparerFr = (a, b) => String(a || "").localeCompare(String(b || ""), "fr", { numeric: true, sensitivity: "base" });

// [{ boutique, items }] — la boutique de la personne en tête, puis l'ordre
// alphabétique ; les articles par nom ; PRODUITS_PAR_BOUTIQUE au plus chacune.
export function grouperProduitsParBoutique(produits, maBoutique = "") {
  const groupes = new Map();
  (produits || []).forEach((p) => {
    const b = p.boutique || "";
    if (!groupes.has(b)) groupes.set(b, []);
    groupes.get(b).push(p);
  });
  return [...groupes.entries()]
    .sort(([a], [b]) => (a === maBoutique) !== (b === maBoutique) ? (a === maBoutique ? -1 : 1) : comparerFr(a, b))
    .map(([boutique, items]) => ({ boutique, items: [...items].sort((x, y) => comparerFr(x.nom, y.nom)).slice(0, PRODUITS_PAR_BOUTIQUE) }));
}

// Modale de recherche globale : ouverte depuis la loupe toujours visible en
// haut de l'application. Cherche en direct dans plusieurs catégories à la
// fois, et amène à l'onglet correspondant d'un clic.
// `texteInitial` : pour le banc seul (l'écran RENDU avec une recherche tapée).
export function RechercheGlobale({ db, profile, onFermer, onNaviguer, texteInitial = "" }) {
  const [texte, setTexte] = useState(texteInitial);
  const resultats = rechercherGlobalement(db, profile, texte);

  const Categorie = ({ titre, tab, items, rendu }) => items.length === 0 ? null : (
    <div className="mb-3">
      <div className="text-xs font-bold text-slate-500 uppercase px-1 mb-1">{titre}</div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <button key={i} onClick={() => onNaviguer(tab)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 border border-slate-100 flex items-center justify-between gap-2">
            {rendu(item)}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-start justify-center p-4 pt-16 sm:pt-24" onClick={onFermer}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-slate-200 flex items-center gap-2">
          <span className="text-slate-400">🔍</span>
          <input
            autoFocus
            className="flex-1 outline-none text-sm py-1"
            placeholder="Chercher un client, une vente, un produit, un devis, un prospect…"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
          />
          <button onClick={onFermer} className="px-2 py-1 rounded-lg text-slate-400 hover:bg-slate-100 text-sm">✕</button>
        </div>
        <div className="overflow-y-auto p-3">
          {texte.trim().length < 2 ? (
            <div className="text-sm text-slate-400 text-center py-8">Tapez au moins 2 lettres pour lancer la recherche.</div>
          ) : resultats.total === 0 ? (
            <div className="text-sm text-slate-400 text-center py-8">Aucun résultat pour « {texte} ».</div>
          ) : (
            <>
              <Categorie titre="👤 Clients" tab="clients" items={resultats.clients} rendu={(u) => (
                <>
                  <span className="font-semibold text-sm">{u.nom_base || u.nom}</span>
                  <span className="text-xs text-slate-400">{u.tel || ""}</span>
                </>
              )} />
              <Categorie titre="🧾 Ventes" tab="ventes" items={resultats.ventes} rendu={(v) => (
                <>
                  <span className="text-sm"><span className="font-mono text-xs text-slate-500">{numeroRecu(v)}</span> — <span className="font-semibold">{v.client || "Client"}</span></span>
                  <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(totalVente(v))}</span>
                </>
              )} />
              <Categorie titre="📄 Proformas" tab="ventes" items={resultats.proformas} rendu={(pf) => (
                <>
                  <span className="text-sm"><span className="font-mono text-xs text-slate-500">{pf.numero}</span> — <span className="font-semibold">{pf.client || "Client"}</span></span>
                  <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(pf.total)}</span>
                </>
              )} />
              {resultats.produits.length > 0 && (
                <div className="mb-3" data-produits-par-boutique>
                  <div className="text-xs font-bold text-slate-500 uppercase px-1 mb-1">📦 Produits</div>
                  {resultats.produitsParBoutique.map((g) => (
                    <div key={g.boutique} className="mb-2" data-groupe-boutique={g.boutique}>
                      <div className="px-1 mb-1"><Badge boutique={g.boutique} /></div>
                      <div className="space-y-1">
                        {g.items.map((p, i) => (
                          <button key={p.id || i} onClick={() => onNaviguer("stocks")} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 border border-slate-100 flex items-center justify-between gap-2">
                            {/* Le prix et le stock accompagnent l'article (Timo, 08/09/2026 :
                                « le prix n'est pas accompagné »). */}
                            <span className="text-sm"><span className="font-semibold">{p.nom}</span> <span className="text-xs text-slate-500 whitespace-nowrap">— {stockActuel(db, p)} en stock</span></span>
                            <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(p.prix_vente)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {resultats.autresBoutiques.length > 0 && (
                <div className="mb-3" data-stock-autres-boutiques>
                  <div className="text-xs font-bold text-slate-500 uppercase px-1 mb-1">📍 Stock des autres boutiques</div>
                  {resultats.autresBoutiques.map((g) => (
                    <div key={g.boutique} className="mb-2" data-autre-boutique={g.boutique}>
                      <div className="px-1 mb-1"><Badge boutique={g.boutique} /></div>
                      <div className="space-y-1">
                        {g.items.map((a, i) => (
                          <button key={i} onClick={() => onNaviguer("stocks")} className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 border border-slate-100 flex items-center justify-between gap-2" data-stock-ailleurs>
                            <span className="text-sm"><span className="font-semibold">{a.nom}</span> <span className="text-xs text-slate-500 whitespace-nowrap">— {a.stock} en stock</span></span>
                            {!a.chezMoi && <span className="text-xs text-amber-700 whitespace-nowrap" data-pas-chez-moi>pas chez vous</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-slate-400 px-1 mt-1">Pour en obtenir : 📦 Stocks → ⇄ → « 📨 Demander à une autre boutique », ou depuis une vente.</div>
                </div>
              )}
              <Categorie titre="📋 Devis" tab="tous_devis" items={resultats.devis} rendu={(d) => (
                <>
                  <span className="text-sm"><span className="font-semibold">{d.client?.nom_base || d.client?.nom}</span> — {libelleTypeDevis(d)}</span>
                  <span className="text-xs font-bold text-sky-800 whitespace-nowrap">{fmt(d.total)}</span>
                </>
              )} />
              <Categorie titre="🧲 Prospects" tab="prospects" items={resultats.prospects} rendu={(p) => (
                <>
                  <span className="font-semibold text-sm">{p.nom}</span>
                  <span className="text-xs text-slate-400">{p.tel || ""}</span>
                </>
              )} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
