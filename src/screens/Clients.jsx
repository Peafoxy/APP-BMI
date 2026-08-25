// ============================================================
// screens/Clients.jsx — Créer un client (parrainage employé), et
// liste des clients.
//
// Extrait de App.jsx (refactorisation) — copié tel quel.
// ============================================================
import { useState } from "react";
import { uid, fmt, today, dFR, telDigits, totalVente } from "../lib/core";
import { Field, inputCls, Panel, uAlert, uConfirm, usePagination, Pagination, AucuneBoutique } from "../components/ui";
import { boutiquesVente, dettesClassiques, bloquerSiLecture, boutiquesVisibles, boutiqueParDefaut, estCompteFormation, marqueEspace, boutiqueRetenue } from "../lib/calculs";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import {
  chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, fabriquerCompteClient,
  envoyerIdentifiantsWhatsApp, motDePasseConnu, messagesNouveauClient,
} from "../lib/comptesClients";

// ============ CRÉER UN CLIENT (parrainage employé) ============
// Onglet dédié, ouvert à tous les employés SAUF l'admin (qui a 👥 Utilisateurs)
// et le client (qui a 🤝 Parrainer). Crée UNIQUEMENT un compte de rôle "client",
// avec identifiants automatiques + envoi WhatsApp. AUCUNE commission.
export function CreerClient({ db, save, profile }) {
  const [f, setF] = useState({ nom: "", tel: "" });
  const [aussiProspect, setAussiProspect] = useState(false); // client simple, ou aussi un prospect à relancer
  const [dernier, setDernier] = useState(null); // { nom, identifiant, motDePasse, tel }

  // Les clients que CET employé a lui-même amenés (traçabilité, sans commission).
  const mesClients = (db.users || []).filter((u) => u.role === "client" && u.amene_par_id === profile.id);

  const creer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    const nom = f.nom.trim(), tel = f.tel.trim();
    if (!nom || chiffresTel(tel).length < 4) { uAlert("Indiquez le nom du client et son numéro (au moins 4 chiffres)."); return; }
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && chiffresTel(u.tel) === chiffresTel(tel));
    if (existant) { uAlert(`Un compte existe déjà pour ce numéro : ${existant.nom}.\n\nRien n'a été recréé.`); return; }

    const identifiant = identifiantClient(db, nom, tel);
    const { motDePasse } = await resoudreMotDePasseClient(db, nom, tel);
    if (!await uConfirm(
      `Créer le compte de ${nom.toUpperCase()} ?\n\n👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\nSes identifiants lui seront envoyés par WhatsApp.`
    )) return;

    const { user } = await fabriquerCompteClient(db, nom, tel, profile.nom, marqueEspace(db, profile));
    // On note QUI a amené ce client — pour la traçabilité, PAS pour une commission.
    const client = { ...user, amene_par_id: profile.id, amene_par_nom: profile.nom };

    // Si l'employé a coché « à relancer », on crée AUSSI un prospect lié — la
    // personne entre dans la file de démarchage, et en sortira à son paiement.
    const nouveauxProspects = aussiProspect ? [{
      id: uid(), date: today(), maj_le: today(), commercial: profile.role === "commercial" ? profile.nom : null,
      nom: nom.toUpperCase(), tel,
      categorie: (db.categories_prospects || [])[0]?.nom || "Particulier",
      statut: "Favorable", interet: "Intéressé",
      note: `Amené par ${profile.nom}`,
      client_user_id: user.id,
      ...marqueEspace(db, profile),
    }, ...(db.prospects || [])] : (db.prospects || []);

    save({
      ...db,
      users: [...db.users, client],
      prospects: nouveauxProspects,
      messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])],
    }, `Compte CLIENT « ${user.nom} » créé par ${profile.nom}${aussiProspect ? " (+ prospect à relancer)" : ""}`);

    setDernier({ nom, identifiant, motDePasse, tel });
    setF({ nom: "", tel: "" });
    envoyerIdentifiantsWhatsApp(nom, identifiant, motDePasse, tel);
  };

  const renvoyer = (c) => {
    const id = c.nom;
    const mdp = motDePasseConnu(c);
    if (!mdp) { uAlert("Ce compte a un mot de passe personnalisé, impossible de le régénérer ici."); return; }
    envoyerIdentifiantsWhatsApp(c.nom_base || c.nom, id, mdp, c.tel);
  };

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold mb-1">🙋 Créer un compte client</div>
        <div className="text-xs text-slate-500 mb-4">
          Ouvrez un accès à un client (actuel ou potentiel) : il pourra suivre ses devis et ses installations.
          Le nom et le numéro suffisent — le mot de passe est généré, et ses identifiants partent par WhatsApp.
        </div>

        <div className="grid sm:grid-cols-2 gap-2 items-end mb-3">
          <Field label="Nom du client"><input className={inputCls} placeholder="KOFFI AMA" value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
          <Field label="Numéro WhatsApp"><input type="tel" className={inputCls} placeholder="+228 90 55 44 33" value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} /></Field>
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Ce contact est…</div>
          <label className="flex items-start gap-2 mb-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={!aussiProspect} onChange={() => setAussiProspect(false)} />
            <span className="text-sm"><b>Client décidé</b> — <span className="text-slate-500">il va suivre son devis / son installation. Pas de relance.</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" className="mt-1" checked={aussiProspect} onChange={() => setAussiProspect(true)} />
            <span className="text-sm"><b>Prospect</b> — <span className="text-slate-500">un compte est créé ET il entre dans la file de relance de vos commerciaux.</span></span>
          </label>
        </div>

        <button onClick={creer} className="px-5 py-2 rounded-lg bg-green-700 text-white font-bold text-sm hover:bg-green-800">🙋 Créer + envoyer</button>

        {f.nom.trim() && chiffresTel(f.tel).length >= 4 && (
          <div className="mt-2 rounded-lg bg-green-50 border border-green-200 p-2 text-xs">
            Sera créé — 👤 <b>{identifiantClient(db, f.nom, f.tel)}</b> · 🔑 <b>{motDePasseClient(f.nom, f.tel)}</b>
          </div>
        )}

        {dernier && (
          <div className="mt-3 rounded-lg bg-white border-2 border-green-300 p-3 text-sm">
            ✅ <b>{dernier.nom.toUpperCase()}</b> créé — 👤 {dernier.identifiant} · 🔑 {dernier.motDePasse}
            <div className="text-xs text-slate-500 mt-1">WhatsApp s'est ouvert avec le message. Si rien ne s'est passé, vérifiez que WhatsApp est installé.</div>
          </div>
        )}
      </Panel>

      {mesClients.length > 0 && (
        <Panel>
          <div className="font-bold mb-2">Les clients que j'ai amenés ({mesClients.length})</div>
          <div className="space-y-1">
            {mesClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{c.nom_base || c.nom}{c.tel ? <span className="text-slate-400 font-normal"> · {c.tel}</span> : null}</span>
                <button onClick={() => renvoyer(c)} className="text-xs font-bold text-green-700 underline">↻ Renvoyer ses accès</button>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

export function Clients({ db, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "clients" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  // ⚠ Voir boutiqueRetenue (lib/calculs.js) : la valeur mémorisée peut être
  // vide (écran ouvert pendant la synchronisation d'ouverture) ou désigner
  // une boutique qui n'existe plus (supprimée, ou effacée par une
  // réinitialisation). Dans les deux cas, on repart de la boutique par
  // défaut plutôt que d'afficher un écran figé ou un nom fantôme.
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "clients" });
  const [q, setQ] = useState("");
  const map = {};
  const key = (nom, tel) => (telDigits(tel) || String(nom || "").trim().toLowerCase());

  db.ventes.filter((v) => v.boutique === boutique && (v.client || v.tel)).forEach((v) => {
    const k = key(v.client, v.tel);
    if (!map[k]) map[k] = { nom: v.client || "(sans nom)", tel: v.tel, achats: 0, totalAchats: 0, dette: 0, derniere: v.date };
    map[k].achats += 1;
    map[k].totalAchats += totalVente(v);
    if (!map[k].tel && v.tel) map[k].tel = v.tel;
    if (String(v.date) > String(map[k].derniere)) map[k].derniere = v.date;
  });

  dettesClassiques(db).filter((d) => d.boutique === boutique).forEach((d) => {
    const k = key(d.client, d.tel);
    if (!map[k]) map[k] = { nom: d.client, tel: d.tel, achats: 0, totalAchats: 0, dette: 0, derniere: d.date };
    map[k].dette += Math.max(0, d.montant - d.paye);
    if (!map[k].tel && d.tel) map[k].tel = d.tel;
  });

  let clients = Object.values(map).sort((a, b) => b.totalAchats - a.totalAchats);
  if (q) clients = clients.filter((c) => (c.nom + " " + (c.tel || "")).toLowerCase().includes(q.toLowerCase()));
  const { pageItems: clientsPage, page, setPage, totalPages } = usePagination(clients, 50);

  const contacter = (c) => {
    const num = telDigits(c.tel);
    if (!num) { uAlert("Aucun numéro enregistré pour ce client."); return; }
    window.open(`https://wa.me/${num}`, "_blank");
  };

  // ⚠ Cloisonnement : aucune boutique de l'espace du compte connecté —
  // on n'affiche PAS le formulaire, plutôt que de le laisser écrire dans la
  // boutique de repli (voir boutiqueParDefaut dans lib/calculs.js).
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;
  return (
    <div className="space-y-4">
      {!profile.boutique && <BoutiqueTabs ecran="clients" db={db} value={bq} onChange={setBq} profile={profile} />}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">Clients — {boutique} <span className="text-sm font-normal text-slate-500">({clients.length})</span></span>
          <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-56" placeholder="Rechercher un client…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Client", "Téléphone", "Achats", "Total acheté", "Dette en cours", "Dernier achat", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Aucun client trouvé.</td></tr>}
            {clientsPage.map((c, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 font-semibold">{c.nom}</td>
                <td className="px-3 py-2">{c.tel || "—"}</td>
                <td className="px-3 py-2 tabular-nums">{c.achats}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(c.totalAchats)}</td>
                <td className={`px-3 py-2 tabular-nums font-bold ${c.dette > 0 ? "text-red-600" : "text-green-700"}`}>{fmt(c.dette)}</td>
                <td className="px-3 py-2">{dFR(c.derniere)}</td>
                <td className="px-3 py-2">{c.tel && <button onClick={() => contacter(c)} className="text-xs font-bold text-green-700 underline">WhatsApp</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} setPage={setPage} totalPages={totalPages} />
      </div>
    </div>
  );
}

// ============ CAISSE ============
