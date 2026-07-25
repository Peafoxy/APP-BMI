// ============================================================
// screens/MonEquipe.jsx — Tableau de bord du chef d'équipe
// commercial : performance de l'équipe, réutilise l'écran
// Commerciaux en vue restreinte.
// ============================================================
import { useState } from "react";
import { Ventes } from "../screens/Ventes";
import { Clients } from "../screens/Clients";
import { Prospects } from "../screens/Prospects";
import { uid, normPaiement, totalVente, definirMotDePasse, fmt, today, inP, dFR } from "../lib/core";
import { Panel, uAlert, uConfirm, uPrompt } from "../components/ui";
import { choisirBoutiqueDebitG, messagesNotifPaiementCommission, toucher, SEUIL_COMMERCIAL, TAUX_EQUIPE_DEFAUT, filleulsDe, estChefEquipe, commissionVente, aDroit, bloquerSiLecture, tachesOuvertes, tachesAValider } from "../lib/calculs";
import { Commerciaux } from "./Commerciaux";

// ============ MON ÉQUIPE (chef d'équipe commercial) ============
export function MonEquipe({ db, save, profile }) {
  const estAdmin = profile.role === "admin";
  const [periode, setPeriode] = useState("mois");
  const bornes = () => {
    if (periode === "mois") return [today().slice(0, 7) + "-01", today()];
    if (periode === "annee") return [today().slice(0, 4) + "-01-01", today()];
    return ["2000-01-01", today()];
  };
  const [debut, fin] = bornes();

  // Tous ceux qui peuvent toucher une commission : commerciaux, techniciens,
  // mais aussi tout autre employé qui a un taux ou des ventes à son nom.
  const equipe = db.users.filter((u) => u.actif !== false && u.role !== "client" && (
    ["commercial", "technicien", "technicien_bmi"].includes(u.role) ||
    Number(u.taux_commission || 0) > 0 ||
    db.ventes.some((v) => v.commercial === u.nom)
  ));

  const stats = equipe.map((u) => {
    const ventes = db.ventes.filter((v) => v.commercial === u.nom && inP(v.date, debut, fin));
    const enAttente = ventes.filter((v) => !v.commission_payee);
    const reglees = ventes.filter((v) => v.commission_payee);
    const ca = ventes.reduce((s, v) => s + totalVente(v), 0);
    const caAttente = enAttente.reduce((s, v) => s + totalVente(v), 0);
    const caRegle = reglees.reduce((s, v) => s + totalVente(v), 0);
    const taux = Number(u.taux_commission || 0);
    return {
      u, nbVentes: ventes.length, ca, caAttente, caRegle, nbReglees: reglees.length,
      commissionDue: enAttente.reduce((s, v) => s + commissionVente(v, taux), 0),
      commissionReglee: Math.round((caRegle * taux) / 100),
      prospects: db.prospects.filter((p) => p.commercial === u.nom).length,
      commandesAttente: (db.commandes || []).filter((c) => c.commercial === u.nom && c.statut === "en_attente").length,
    };
  }).sort((a, b) => b.ca - a.ca);

  const totalCA = stats.reduce((s, x) => s + x.ca, 0);
  const totalDu = stats.reduce((s, x) => s + x.commissionDue, 0);

  // Annulation d'un règlement de commission : réservée à l'administrateur.
  // Remet les ventes réglées de la période en « commission due » (en cas
  // d'erreur de validation). Tracé dans l'historique.
  const annulerPaiement = async (st) => {
    if (!estAdmin) return;
    if (st.nbReglees === 0) { uAlert("Aucune commission réglée à annuler pour " + st.u.nom + " sur cette période."); return; }
    if (!await uConfirm(`⚠ ANNULER le règlement de commission de ${st.u.nom} sur cette période ?\n\n${st.nbReglees} vente(s) réglée(s), soit ${fmt(st.commissionReglee)} de commission, redeviendront « à payer ».`)) return;
    const ventesConcernees = db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && v.commission_payee);
    const ids = new Set(ventesConcernees.map((v) => v.id));
    // On retire aussi les dépenses « Commissions » générées par ces paiements
    const depsAnnulees = new Set(ventesConcernees.map((v) => v.commission_dep).filter(Boolean));
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: false, commission_dep: null } : v)),
      depenses: db.depenses.filter((d) => !depsAnnulees.has(d.id)),
    }, `ANNULATION règlement commission de ${st.u.nom} : ${fmt(st.commissionReglee)} remis à payer (par ${profile.nom})`);
  };

  // ---- APPORTEURS EXTERNES (non-utilisateurs) ----
  // Regroupés par nom + téléphone, sur la période choisie.
  const apporteursExt = (() => {
    const g = {};
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom && inP(v.date, debut, fin)).forEach((v) => {
      const cle = `${v.apporteur.nom}|${v.apporteur.tel || ""}`;
      if (!g[cle]) g[cle] = { nom: v.apporteur.nom, tel: v.apporteur.tel || "", taux: Number(v.apporteur.taux || 0), nb: 0, ca: 0, due: 0, payee: 0, ventes: [] };
      const m = Number(v.apporteur.montant || 0);
      g[cle].nb += 1;
      g[cle].ca += totalVente(v);
      // Une part bloquée (installation non réceptionnée) n'est pas encore exigible.
      if (v.apporteur.payee) g[cle].payee += m;
      else if (v.apporteur.a_la_reception) { g[cle].attente = (g[cle].attente || 0) + m; }
      else { g[cle].due += m; g[cle].ventes.push(v.id); }
    });
    return Object.values(g).sort((a, b) => b.due - a.due);
  })();

  const totalExtDu = apporteursExt.reduce((s, a) => s + a.due, 0);

  // ---- COMMISSIONS D'ÉQUIPE (les chefs touchent un % sur leurs filleuls) ----
  const chefs = db.users.filter((u) => u.actif !== false && estChefEquipe(db, u) && filleulsDe(db, u).length > 0)
    .map((u) => {
      const tauxEq = Number(u.taux_equipe ?? TAUX_EQUIPE_DEFAUT);
      let due = 0, versees = 0, ventesDues = [];
      filleulsDe(db, u).forEach((fu) => {
        const tu = Number(fu.taux_commission || 0);
        db.ventes.filter((v) => v.commercial === fu.nom && inP(v.date, debut, fin)).forEach((v) => {
          const part = Math.round((commissionVente(v, tu) * tauxEq) / 100);
          if (v.override_payee) versees += part; else { due += part; ventesDues.push(v.id); }
        });
      });
      return { u, tauxEq, nbFilleuls: filleulsDe(db, u).length, due, versees, ventesDues };
    })
    .filter((c) => c.due > 0 || c.versees > 0);

  const totalEquipeDu = chefs.reduce((s, c) => s + c.due, 0);

  const payerCommissionEquipe = async (c) => {
    if (bloquerSiLecture(db, profile)) return;
    if (c.due <= 0) { uAlert("Aucune commission d'équipe en attente pour " + c.u.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${c.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, c.u, `Commission d'équipe de ${fmt(c.due)} à ${c.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer ${fmt(c.due)} de commission d'équipe à ${c.u.nom} ?\n\n${c.tauxEq} % sur les commissions de ses ${c.nbFilleuls} recrue(s).\nSortie de caisse ${bq} : ${fmt(c.due)}`)) return;
    const ids = new Set(c.ventesDues);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission d'équipe — ${c.u.nom} (${c.tauxEq} % sur ${c.nbFilleuls} recrue(s))`,
      montant: c.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_equipe", user_id: c.u.id,
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, override_payee: true, override_dep: dep.id } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, c.u.nom, c.due), ...(db.messages || [])],
    }, `Commission d'équipe payée à ${c.u.nom} : ${fmt(c.due)}`);
    uAlert(`✅ ${fmt(c.due)} payés à ${c.u.nom}. Sortie de caisse : ${bq}.`);
  };

  // Nombre de CLIENTS DISTINCTS apportés depuis toujours (pas seulement sur la période)
  const clientsApportes = (a) => {
    const clients = new Set();
    db.ventes.filter((v) => v.apporteur && v.apporteur.nom === a.nom && (v.apporteur.tel || "") === a.tel)
      .forEach((v) => clients.add(((v.client || "") + "|" + (v.tel || "")).trim().toLowerCase()));
    clients.delete("|");
    return clients.size;
  };
  const dejaUtilisateur = (a) => db.users.some((u) => u.nom.trim().toLowerCase() === a.nom.trim().toLowerCase());

  // Promotion : l'apporteur externe devient un COMMERCIAL avec son propre compte
  const promouvoir = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    const n = clientsApportes(a);
    const identifiant = await uPrompt(
      `🎖 ${a.nom} a apporté ${n} client(s).\n\nLe promouvoir COMMERCIAL : il aura son propre compte, ses prospects, ses commandes et son onglet « Ma commission ».\n\nIdentifiant de connexion :`,
      a.nom.trim().toUpperCase().split(" ")[0]
    );
    if (identifiant === null) return;
    const nom = identifiant.trim().toUpperCase();
    if (!nom) { uAlert("Identifiant obligatoire."); return; }
    if (db.users.some((u) => u.nom.toUpperCase() === nom)) { uAlert("Cet identifiant existe déjà."); return; }
    const pwd = await uPrompt("Mot de passe provisoire (6 caractères minimum) :", "");
    if (pwd === null) return;
    if (String(pwd).length < 6) { uAlert("Mot de passe trop court (6 caractères minimum)."); return; }
    const tx = await uPrompt("Taux de commission (%) :", String(a.taux || 5));
    if (tx === null) return;
    const taux = Math.max(0, Math.min(100, Number(tx) || 0));
    if (!await uConfirm(`Créer le compte COMMERCIAL « ${nom} » pour ${a.nom} avec ${taux} % de commission ?`)) return;
    const nouvel = {
      id: uid(), nom, ...await definirMotDePasse(String(pwd)), role: "commercial", boutique: null, actif: true,
      taux_commission: taux, nom_complet: a.nom, tel: a.tel || "", promu_de: "apporteur_externe", date_promotion: today()
    };
    save({
      ...db,
      users: [...db.users, nouvel],
      commerciaux: [...(db.commerciaux || []), { id: uid(), nom, tel: a.tel || "", taux, actif: true }]
    }, `🎖 ${a.nom} promu COMMERCIAL (${n} clients apportés) — compte « ${nom} », commission ${taux} %`);
    uAlert(`🎖 ${a.nom} est désormais Commercial !\n\nIdentifiant : ${nom}\nMot de passe : ${pwd}\n\nDemandez-lui de le changer à la première connexion.`);
  };

  const payerApporteur = async (a) => {
    if (bloquerSiLecture(db, profile)) return;
    if (a.due <= 0) { uAlert("Aucune commission en attente pour " + a.nom + "."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${a.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, {}, `Commission de ${fmt(a.due)} à l'apporteur ${a.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer ${fmt(a.due)} de commission à ${a.nom}${a.tel ? ` (${a.tel})` : ""} ?\n\n${a.ventes.length} vente(s) concernée(s).\nSortie de caisse ${bq} : ${fmt(a.due)}.`)) return;
    const ids = new Set(a.ventes);
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission apporteur externe — ${a.nom}${a.tel ? ` (${a.tel})` : ""}`,
      montant: a.due, paiement: normPaiement(moyen), par: profile.nom, auto: "commission_ext"
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, apporteur: { ...v.apporteur, payee: true, date_paiement: today(), par: profile.nom, dep_id: dep.id } } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, a.nom, a.due), ...(db.messages || [])],
    }, `Commission de ${fmt(a.due)} payée à l'apporteur externe ${a.nom}`);
    uAlert(`✅ ${fmt(a.due)} payés à ${a.nom}. Dépense enregistrée — sortie de caisse : ${bq}.`);
  };

  // Assigner une tâche à un agent (stockée dans sa fiche : visible dans son onglet ✅ Mes tâches)
  const assignerTache = async (st) => {
    const titre = await uPrompt(`Tâche à assigner à ${st.u.nom} :`, "");
    if (titre === null) return;
    if (!titre.trim()) { uAlert("Le titre de la tâche est obligatoire."); return; }
    const detail = await uPrompt("Détails (facultatif) :", "");
    if (detail === null) return;
    const ech = await uPrompt("Échéance (AAAA-MM-JJ, facultatif) :", "");
    if (ech === null) return;
    if (ech.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(ech.trim())) { uAlert("Format attendu : AAAA-MM-JJ (ex : 2026-07-20)."); return; }
    const tache = { id: uid(), titre: titre.trim(), detail: detail.trim(), echeance: ech.trim() || null, statut: "a_faire", par: profile.nom, date: today() };
    save({ ...db, users: db.users.map((x) => (x.id === st.u.id ? { ...x, taches: [...(x.taches || []), tache] } : x)) },
      `Tâche assignée à ${st.u.nom} : ${titre.trim()}`);
    uAlert(`✅ Tâche assignée à ${st.u.nom}.`);
  };

  const payerCommission = async (st) => {
    if (bloquerSiLecture(db, profile)) return;
    if (st.commissionDue === 0) { uAlert("Aucune commission en attente pour " + st.u.nom + " sur cette période."); return; }
    const moyen = await uPrompt(`Moyen de paiement pour ${st.u.nom} (Espèces / Flooz / Mixx / Virement bancaire) :`, "Espèces");
    if (moyen === null) return;
    const bq = await choisirBoutiqueDebitG(db, st.u, `Commission de ${fmt(st.commissionDue)} à ${st.u.nom}`);
    if (bq === null) return;
    if (!await uConfirm(`Payer la commission de ${st.u.nom} ?\n\nMontant : ${fmt(st.commissionDue)} (${fmt(st.caAttente)} de ventes × ${st.u.taux_commission ?? 0} %)\n\nSortie de caisse ${bq} : ${fmt(st.commissionDue)}\nElle sera enregistrée en dépense « Commissions ».\n\nCes ventes ne seront plus comptées (action définitive).`)) return;
    const ids = new Set(db.ventes.filter((v) => v.commercial === st.u.nom && inP(v.date, debut, fin) && !v.commission_payee).map((v) => v.id));
    const dep = {
      id: uid(), date: today(), boutique: bq, categorie: "Commissions",
      description: `Commission — ${st.u.nom} (${ids.size} vente(s))`,
      montant: st.commissionDue, paiement: normPaiement(moyen), par: profile.nom, auto: "commission", user_id: st.u.id
    };
    save({
      ...db,
      ventes: db.ventes.map((v) => (ids.has(v.id) ? { ...v, commission_payee: true, commission_dep: dep.id } : v)),
      depenses: [dep, ...db.depenses],
      messages: [...messagesNotifPaiementCommission(db, profile, bq, st.u.nom, st.commissionDue), ...(db.messages || [])],
    }, `Commission payée à ${st.u.nom} : ${fmt(st.commissionDue)} (validée par ${profile.nom})`);
    uAlert(`✅ ${fmt(st.commissionDue)} payés à ${st.u.nom}. Dépense « Commissions » enregistrée — sortie de caisse : ${bq}.`);
  };

  // ---- VALIDATION DES TÂCHES ----
  // Les tâches déclarées terminées par les membres attendent ici : on valide,
  // ou on rouvre avec un motif (le membre le verra en rouge dans Mes tâches).
  const aValider = tachesAValider(db, profile);
  const [membreTaches, setMembreTaches] = useState(null); // fiche dont on affiche l'historique des tâches

  const validerTache = async (tv) => {
    if (!await uConfirm(`Valider la tâche « ${tv.titre} » de ${tv.membre.nom} ?${tv.photo ? "" : "\n\n⚠ Aucune photo de preuve n'a été jointe."}`)) return;
    save({ ...db, users: db.users.map((x) => (x.id === tv.membre.id ? { ...x, taches: (x.taches || []).map((y) => (y.id === tv.id ? { ...y, statut: "validee", valide_par: profile.nom, date_validation: today() } : y)) } : x)) },
      `Tâche de ${tv.membre.nom} validée par ${profile.nom} : ${tv.titre}`);
  };

  const rouvrirTache = async (tv) => {
    const motif = await uPrompt(`Motif de la réouverture (visible par ${tv.membre.nom}) :`, "");
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Le motif est obligatoire : le membre doit savoir quoi corriger."); return; }
    save({ ...db, users: db.users.map((x) => (x.id === tv.membre.id ? { ...x, taches: (x.taches || []).map((y) => (y.id === tv.id ? { ...y, statut: "a_faire", date_fin: null, commentaire_reouverture: motif.trim() } : y)) } : x)) },
      `Tâche de ${tv.membre.nom} rouverte par ${profile.nom} : ${tv.titre} (${motif.trim()})`);
  };

  return (
    <div className="space-y-4">
      {(() => {
        const membre = membreTaches && db.users.find((u) => u.id === membreTaches);
        if (!membre) return null;
        const ORDRE = { a_faire: 0, terminee: 1, validee: 2 };
        const liste = [...(membre.taches || [])].sort((a, b) => {
          const oa = ORDRE[a.statut] ?? 0, ob = ORDRE[b.statut] ?? 0;
          if (oa !== ob) return oa - ob;
          return String(b.date || "").localeCompare(String(a.date || ""));
        });
        const BADGE = {
          terminee: <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">⏳ En validation</span>,
          validee: <span className="text-xs font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 whitespace-nowrap">✅ Validée</span>,
        };
        return (
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">🗂 Tâches de {membre.nom} ({liste.length})</div>
              <button onClick={() => setMembreTaches(null)} className="text-xs font-bold text-slate-500 underline">Fermer</button>
            </div>
            <div className="space-y-2">
              {liste.map((t) => (
                <div key={t.id} className={`rounded-xl border p-3 flex flex-wrap items-start justify-between gap-2 ${t.statut === "validee" ? "bg-slate-50 border-slate-200" : t.statut === "terminee" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}>
                  <div className="min-w-[55%]">
                    <div className={`font-bold text-sm ${t.statut === "validee" ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.titre}</div>
                    {t.detail && <div className="text-xs text-slate-600 mt-0.5">{t.detail}</div>}
                    {t.commentaire_reouverture && t.statut === "a_faire" && (
                      <div className="text-xs font-semibold text-red-700 mt-1">↩ Rouverte : {t.commentaire_reouverture}</div>
                    )}
                    <div className="text-xs text-slate-400 mt-1">
                      Assignée par {t.par} le {dFR(t.date)}
                      {t.echeance ? ` · échéance ${dFR(t.echeance)}` : ""}
                      {t.date_fin ? ` · terminée le ${dFR(t.date_fin)}` : ""}
                      {t.statut === "validee" && t.valide_par ? ` · validée par ${t.valide_par} le ${dFR(t.date_validation)}` : ""}
                    </div>
                    {t.photo && <img src={t.photo} alt="Preuve" className="mt-2 rounded-lg border border-slate-200 max-h-24" />}
                  </div>
                  <div>{BADGE[t.statut] || <span className="text-xs font-bold px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap">🔵 À faire</span>}</div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })()}
      {aValider.length > 0 && (
        <Panel>
          <div className="font-bold mb-1 text-amber-800">⏳ Tâches à valider ({aValider.length})</div>
          <div className="text-xs text-slate-500 mb-3">Déclarées terminées par les membres — validez, ou rouvrez avec un motif.</div>
          <div className="space-y-2">
            {aValider.map((tv) => (
              <div key={tv.membre.id + tv.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[55%]">
                  <div className="font-bold text-slate-800">{tv.titre}</div>
                  <div className="text-xs text-slate-500 mt-1">{tv.membre.nom} · terminée le {dFR(tv.date_fin)}{tv.echeance ? ` · échéance ${dFR(tv.echeance)}` : ""}</div>
                  {tv.detail && <div className="text-sm text-slate-600 mt-1">{tv.detail}</div>}
                  {tv.photo
                    ? <img src={tv.photo} alt="Preuve" className="mt-2 rounded-lg border border-amber-200 max-h-32" />
                    : <div className="text-xs text-amber-700 mt-2">Aucune photo de preuve jointe.</div>}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => validerTache(tv)} className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold hover:bg-green-800">✅ Valider</button>
                  <button onClick={() => rouvrirTache(tv)} className="px-4 py-2 rounded-lg bg-white border border-red-300 text-red-700 text-sm font-bold hover:bg-red-50">↩ Rouvrir</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel>
        <div className="font-bold mb-3">👑 Mon équipe — vue d'ensemble</div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[["mois", "Ce mois"], ["annee", "Cette année"], ["tout", "Depuis le début"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriode(id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${periode === id ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{label}</button>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">Commerciaux actifs</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{equipe.length}</div>
          </div>
          <div className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm border-l-4 border-l-sky-700">
            <div className="text-xs font-semibold text-slate-500 uppercase">CA de l'équipe</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{fmt(totalCA)}</div>
          </div>
          <div className="rounded-xl p-4 bg-green-50 border border-green-200 shadow-sm border-l-4 border-l-green-600">
            <div className="text-xs font-semibold text-green-700 uppercase">Commissions à payer</div>
            <div className="text-2xl font-bold tabular-nums mt-1 text-green-800">{fmt(totalDu)}</div>
          </div>
        </div>
      </Panel>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50">Performances par commercial</div>
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Commercial", "Ventes", "Chiffre d'affaires", "Commission due", "Prospects", "Commandes en attente", "Tâches", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {stats.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">Aucun commercial actif.</td></tr>}
            {stats.map((st) => (
              <tr key={st.u.id} className="border-t border-slate-100 hover:bg-sky-50">
                <td className="px-3 py-2 font-semibold">{st.u.nom}{st.u.chef_equipe ? " ⭐" : ""}{st.u.role === "technicien" ? " 🔧" : ""}{st.u.role === "technicien_bmi" ? " 🔧 (salarié)" : ""}</td>
                <td className="px-3 py-2 tabular-nums">{st.nbVentes}</td>
                <td className="px-3 py-2 tabular-nums font-bold">{fmt(st.ca)}</td>
                <td className="px-3 py-2 tabular-nums font-bold text-green-700">{fmt(st.commissionDue)}</td>
                <td className="px-3 py-2 tabular-nums">{st.prospects}</td>
                <td className="px-3 py-2 tabular-nums">{st.commandesAttente}</td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {tachesOuvertes(st.u).length > 0 ? <span className="font-bold text-amber-600">{tachesOuvertes(st.u).length} en cours</span> : <span className="text-slate-400">—</span>}
                  {(st.u.taches || []).length > 0 && <button onClick={() => setMembreTaches(membreTaches === st.u.id ? null : st.u.id)} className="ml-2 text-xs font-bold text-sky-800 underline">🗂 voir ({(st.u.taches || []).length})</button>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {aDroit(db, profile, "act_taches") && <button onClick={() => assignerTache(st)} className="text-xs font-bold text-sky-800 underline mr-2">✅ Tâche</button>}
                  {st.commissionDue > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommission(st)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Marquer payé</button>}
                  {estAdmin && st.nbReglees > 0 && <button onClick={() => annulerPaiement(st)} className="text-xs font-bold text-red-700 border border-red-300 rounded px-2 py-1 hover:bg-red-50">↩ Annuler paiement</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chefs.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-x-auto">
          <div className="px-4 py-3 font-bold text-amber-800 border-b border-amber-200 bg-amber-50 flex flex-wrap justify-between gap-2">
            <span>⭐ Chefs d'équipe — commissions sur leurs recrues</span>
            <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalEquipeDu)}</b></span>
          </div>
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Chef d'équipe", "Recrues", "Taux d'équipe", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {chefs.map((c) => (
                <tr key={c.u.id} className="border-t border-slate-100 hover:bg-amber-50">
                  <td className="px-3 py-2 font-semibold">{c.u.nom_complet || c.u.nom}</td>
                  <td className="px-3 py-2 tabular-nums">{c.nbFilleuls}</td>
                  <td className="px-3 py-2 tabular-nums">{c.tauxEq} %</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(c.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(c.versees)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {c.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerCommissionEquipe(c)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">✓ Payer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 font-bold text-slate-800 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between gap-2">
          <span>🤝 Apporteurs externes</span>
          <span className="text-xs font-semibold text-slate-600">À payer : <b className="text-red-600 tabular-nums">{fmt(totalExtDu)}</b></span>
        </div>
        {apporteursExt.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">Aucun apporteur externe sur cette période. Renseignez-le au moment de la vente (💰 Ventes → 🤝 Apporteur externe).</div>
        ) : (
          <table className="w-full text-sm min-w-[620px]">
            <thead><tr className="text-xs text-slate-500 uppercase">{["Apporteur", "Téléphone", "Clients apportés", "Ventes", "CA apporté", "Commission due", "Déjà payé", ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {apporteursExt.map((a) => (
                <tr key={a.nom + a.tel} className="border-t border-slate-100 hover:bg-sky-50">
                  <td className="px-3 py-2 font-semibold">{a.nom}
                    {clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <div className="text-xs font-bold text-amber-600">🎖 Éligible commercial</div>}
                    {dejaUtilisateur(a) && <div className="text-xs font-bold text-green-700">✅ Déjà commercial</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{a.tel || "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`tabular-nums font-bold ${clientsApportes(a) >= SEUIL_COMMERCIAL ? "text-amber-600" : "text-slate-700"}`}>{clientsApportes(a)}</span>
                    <span className="text-xs text-slate-400"> / {SEUIL_COMMERCIAL}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{a.nb}</td>
                  <td className="px-3 py-2 tabular-nums font-bold">{fmt(a.ca)}</td>
                  <td className="px-3 py-2 tabular-nums font-bold text-red-600">{fmt(a.due)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-700">{fmt(a.payee)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {a.due > 0 && aDroit(db, profile, "act_commission") && <button onClick={() => payerApporteur(a)} className="text-xs font-bold text-white bg-slate-800 rounded px-2 py-1 hover:bg-slate-900 mr-1">✓ Payer</button>}
                    {estAdmin && clientsApportes(a) >= SEUIL_COMMERCIAL && !dejaUtilisateur(a) && <button onClick={() => promouvoir(a)} className="text-xs font-bold text-white bg-amber-600 rounded px-2 py-1 hover:bg-amber-700">🎖 Promouvoir commercial</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="text-xs text-slate-400">Le chiffre d'affaires inclut toutes les ventes de la période ; la commission due ne compte que les ventes pas encore réglées. 🔧 = technicien, ⭐ = chef d'équipe. Le paiement d'un apporteur externe est enregistré en dépense.</div>
    </div>
  );
}
