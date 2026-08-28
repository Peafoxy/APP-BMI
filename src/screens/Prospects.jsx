// ============================================================
// screens/Prospects.jsx — Gestion des prospects (rôle Commercial +
// vue Admin) : catégories, contact WhatsApp, position sur carte,
// détection des dormants, conversion en client.
// ============================================================
import { useState } from "react";
import { Clients } from "../screens/Clients";
import { CarteChoixPosition } from "../components/Carte";
import { chiffresTel, identifiantClient, motDePasseClient, resoudreMotDePasseClient, envoyerIdentifiantsWhatsApp, envoyerAccueilProspectWhatsApp, envoyerRelanceProspectWhatsApp, fabriquerCompteClient, messagesNouveauClient } from "../lib/comptesClients";
import { uid, fmt, today, dFR, col } from "../lib/core";
import { Field, inputCls, btnDark, Panel, uAlert, uConfirm, uPrompt, usePagination, Pagination } from "../components/ui";
import { derniereActivite, joursSansActivite, estDormant, toucher, aDroit, bloquerSiLecture, marqueEspace, espaceDuCompte, memeNumero, comptesAvecCeNumero } from "../lib/calculs";

// ============ PROSPECTS (rôle Commercial + vue Admin) ============
export function Prospects({ db, save, profile, isAdmin }) {
  const estChef = !!profile.chef_equipe;
  const voitTout = isAdmin || estChef || profile.role === "resp_commercial";
  const categories = db.categories_prospects.filter((c) => c.actif !== false);
  const [nouvelleCat, setNouvelleCat] = useState("");
  const vide = { categorie: categories[0]?.nom || "", localisation: "", nom: "", tel: "", nature: "", statut: "Favorable", interet: "Intéressé", relance: "", lat: null, lng: null };
  const [f, setF] = useState(vide);
  const [carteOuverte, setCarteOuverte] = useState(false);
  const [filtreRelance, setFiltreRelance] = useState(false);
  const [q, setQ] = useState("");

  // ---- Gestion des catégories (Admin uniquement) ----
  const ajouterCategorie = () => {
    if (!nouvelleCat.trim()) return;
    if (db.categories_prospects.some((c) => c.nom.toLowerCase() === nouvelleCat.trim().toLowerCase())) { uAlert("Cette catégorie existe déjà."); return; }
    save({ ...db, categories_prospects: [...db.categories_prospects, { id: uid(), nom: nouvelleCat.trim(), actif: true }] }, `Nouvelle catégorie de prospect : ${nouvelleCat.trim()}`);
    setNouvelleCat("");
  };
  const supprimerCategorie = async (c) => {
    if (await uConfirm(`Supprimer la catégorie « ${c.nom} » ? Les prospects déjà enregistrés avec cette catégorie la garderont en texte.`)) {
      save({ ...db, categories_prospects: db.categories_prospects.filter((x) => x.id !== c.id) }, `Suppression catégorie de prospect : ${c.nom}`);
    }
  };

  // ---- Enregistrement d'un prospect ----
  const ajouter = () => {
    if (!f.nom.trim() || !f.tel.trim()) { uAlert("Le nom et le numéro du prospect sont obligatoires."); return; }
    // ⚠ Cloisonnement : un prospect n'appartient à aucune boutique — sans
    // cette marque, une fiche inventée pendant un entraînement entrait dans
    // la vraie file de relance des commerciaux.
    const p = { id: uid(), date: today(), maj_le: today(), commercial: profile.nom, ...f, ...marqueEspace(db, profile, f.boutique) };
    // WhatsApp est ouvert AVANT le save, de façon strictement synchrone (sinon
    // le navigateur bloque l'ouverture — cf. correctif du même souci sur le proforma).
    envoyerAccueilProspectWhatsApp(f.nom, f.tel);
    save({ ...db, prospects: [p, ...db.prospects] }, `Nouveau prospect « ${f.nom} » (${f.categorie}) — ${profile.nom}`);
    setF(vide);
    setCarteOuverte(false);
  };

  const supprimer = async (p) => {
    if (await uConfirm(`Supprimer le prospect « ${p.nom} » ?`)) {
      save({ ...db, prospects: db.prospects.filter((x) => x.id !== p.id) }, `Suppression prospect « ${p.nom} »`);
    }
  };

  // ---- « JE L'AI CONTACTÉ » ----
  // Sans ce bouton, la détection des dormants serait FAUSSE : un commercial qui
  // appelle un prospect ne laisse aucune trace, et le prospect finirait par
  // paraître mort alors qu'il est activement suivi.
  const contacte = async (p) => {
    const note = await uPrompt(
      `Vous venez de contacter « ${p.nom} » ?\n\nCe que ça a donné (facultatif) :`,
      ""
    );
    if (note === null) return;
    const historique = [
      { date: today(), par: profile.nom, note: note.trim() || "Contacté" },
      ...(p.contacts || []),
    ].slice(0, 20);
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, maj_le: today(), contacts: historique }
        : x)),
    }, `📞 ${p.nom} contacté par ${profile.nom}${note.trim() ? " — " + note.trim() : ""}`);
  };

  // ---- ARCHIVER (sans supprimer) ----
  // Le motif est obligatoire : sans lui, l'archivage ne vous apprend rien.
  // Au bout d'un an, ces motifs vous diront POURQUOI vos prospects meurent.
  const MOTIFS_ARCHIVE = ["Ne répond plus", "Trop cher", "A choisi un concurrent", "Projet abandonné", "Reporté à plus tard", "Autre"];
  // Convertir un prospect en client — SEULEMENT quand il a dit oui. Crée le
  // compte (règle d'identifiants automatique) et envoie ses accès par WhatsApp.
  const convertirEnClient = async (p) => {
    if (bloquerSiLecture(db, profile)) return;
    if (chiffresTel(p.tel).length < 4) { uAlert("Ce prospect n'a pas de numéro valide : impossible de créer son compte."); return; }

    // Déjà un compte pour ce numéro ? On ne recrée pas.
    // ⚠ Même correctif que dans Clients : « +228 90 11 22 33 » et
    // « 90112233 » sont la MÊME personne (voir lib/identiteClient.js).
    const existant = (db.users || []).find((u) => u.role === "client" && u.tel && memeNumero(u.tel, p.tel));
    if (existant) {
      uAlert(`Un compte client existe déjà pour ce numéro (${existant.nom}).\n\nRien n'a été recréé.`);
      return;
    }

    const identifiant = identifiantClient(db, p.nom, p.tel);
    const { motDePasse } = await resoudreMotDePasseClient(db, p.nom, p.tel);
    if (!await uConfirm(
      `Convertir « ${p.nom} » en client ?\n\n` +
      `👤 Identifiant : ${identifiant}\n🔑 Mot de passe : ${motDePasse}\n\n` +
      `Un compte sera créé et ses identifiants lui seront envoyés par WhatsApp.\n\nÀ ne faire que s'il a accepté de devenir client.`
    )) return;

    const { user } = await fabriquerCompteClient(db, p.nom, p.tel, profile.nom, marqueEspace(db, profile));
    // Le prospect est marqué converti (il sort de la file active) et lié au compte.
    save({
      ...db,
      users: [...db.users, user],
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, converti: true, statut: "Client acquis", client_user_id: user.id, date_conversion: today(), maj_le: today() }
        : x)),
      messages: [...messagesNouveauClient(db, user, profile), ...(db.messages || [])],
    }, `Prospect « ${p.nom} » CONVERTI en client par ${profile.nom}`);

    envoyerIdentifiantsWhatsApp(p.nom, identifiant, motDePasse, p.tel);
    uAlert(`✅ ${p.nom} est désormais client.\n\nWhatsApp s'ouvre avec ses identifiants.`);
  };

  const archiver = async (p) => {
    const motif = await uPrompt(
      `Archiver « ${p.nom} » ? (${joursSansActivite(p)} jours sans activité)\n\n` +
      `Il sort de la liste active mais N'EST PAS supprimé : vous pourrez le recontacter lors d'une campagne.\n\n` +
      `Motif (obligatoire) :\n${MOTIFS_ARCHIVE.join(" / ")}`,
      MOTIFS_ARCHIVE[0]
    );
    if (motif === null) return;
    if (!motif.trim()) { uAlert("Le motif est obligatoire."); return; }
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, archive: true, archive_motif: motif.trim(), archive_le: today(), maj_le: today() }
        : x)),
    }, `📦 Prospect « ${p.nom} » archivé — ${motif.trim()}`);
  };

  const reactiver = async (p) => {
    if (!await uConfirm(`Remettre « ${p.nom} » dans la liste active ?`)) return;
    save({
      ...db,
      prospects: db.prospects.map((x) => (x.id === p.id
        ? { ...x, archive: false, archive_motif: null, maj_le: today() }
        : x)),
    }, `Prospect « ${p.nom} » réactivé`);
  };

  // Réassigner un prospect à un autre commercial/technicien (admin ou chef d'équipe)
  const reassigner = async (p) => {
    const equipe = db.users.filter((u) => ["commercial", "technicien"].includes(u.role) && u.actif !== false).map((u) => u.nom);
    if (equipe.length === 0) { uAlert("Aucun commercial actif."); return; }
    const choix = await uPrompt(`Réassigner « ${p.nom} » à quel commercial ?\n(${equipe.join(" / ")})`, p.commercial || equipe[0]);
    if (!choix) return;
    const cible = equipe.find((n) => n.trim().toLowerCase() === choix.trim().toLowerCase());
    if (!cible) { uAlert("Commercial introuvable parmi l'équipe active."); return; }
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, commercial: cible }) : x)) }, `Prospect « ${p.nom} » réassigné de ${p.commercial || "?"} à ${cible}`);
  };

  const modifierRelance = async (p) => {
    const d = await uPrompt(`Nouvelle date de relance pour ${p.nom} (AAAA-MM-JJ, ou vide pour retirer) :`, p.relance || "");
    if (d === null) return;
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, relance: d.trim() }) : x)) }, `Relance mise à jour pour ${p.nom}`);
  };

  // Relance WhatsApp EN UN CLIC : le message part directement, et on note
  // silencieusement le contact dans l'historique (remet à jour la dernière
  // activité, sort le prospect de l'état « dormant » si besoin) — sans
  // aucune boîte de dialogue qui ralentirait le geste.
  const relancerWhatsApp = (p) => {
    envoyerRelanceProspectWhatsApp(p.nom, p.tel);
    const historique = [{ date: today(), par: profile.nom, note: "Relance WhatsApp envoyée" }, ...(p.contacts || [])];
    save({ ...db, prospects: db.prospects.map((x) => (x.id === p.id ? toucher({ ...x, contacts: historique }) : x)) }, `Relance WhatsApp envoyée à ${p.nom}`);
  };

  // ---- Liste : ses propres prospects (Commercial) ou tous (Admin) ----
  // Les prospects DEVENUS CLIENTS sortent de la liste : on ne relance pas
  // quelqu'un qui a déjà payé et été installé. Ils restent consultables.
  const [voirAcquis, setVoirAcquis] = useState(false);
  const [vue, setVue] = useState("actifs"); // actifs | dormants | archives
  // ⚠ Cloisonnement : un prospect créé pendant un entraînement porte
  // `formation` (voir marqueEspace). Sans ce filtre, un commercial en
  // formation — et surtout un chef d'équipe ou un responsable, qui voient
  // TOUT — retrouvait la vraie file de relance de l'entreprise.
  const espace = espaceDuCompte(db, profile);
  const tousProspects = (db.prospects || []).filter((p) => espace === undefined || !!p.formation === espace);
  const acquis = tousProspects.filter((p) => p.converti);
  const archives = tousProspects.filter((p) => p.archive && !p.converti);
  const dormants = tousProspects.filter(estDormant);
  const actifs = tousProspects.filter((p) => !p.converti && !p.archive);

  const base = vue === "archives" ? archives
    : vue === "dormants" ? dormants
    : voirAcquis ? tousProspects.filter((p) => !p.archive)
    : actifs;
  // Taux de conversion : parmi tous les prospects qui ont un jour existé
  // pour cette vue (actifs + archivés + déjà convertis), combien sont
  // devenus clients. Les dormants sont un sous-ensemble des actifs (pas
  // comptés en double).
  const perimetre = voitTout ? { actifs, archives, acquis } : {
    actifs: actifs.filter((p) => p.commercial === profile.nom),
    archives: archives.filter((p) => p.commercial === profile.nom),
    acquis: acquis.filter((p) => p.commercial === profile.nom),
  };
  const totalPerimetre = perimetre.actifs.length + perimetre.archives.length + perimetre.acquis.length;
  const tauxConversion = totalPerimetre > 0 ? Math.round((perimetre.acquis.length / totalPerimetre) * 100) : 0;

  let liste = voitTout ? base : base.filter((p) => p.commercial === profile.nom);
  if (filtreRelance) liste = liste.filter((p) => p.relance && p.relance <= today());
  if (q) liste = liste.filter((p) => (p.nom + " " + p.tel + " " + p.localisation).toLowerCase().includes(q.toLowerCase()));
  const { pageItems: listePage, page, setPage, totalPages } = usePagination(liste, 50);

  const aRelancerAujourdhui = (voitTout ? actifs : actifs.filter((p) => p.commercial === profile.nom)).filter((p) => p.relance && p.relance <= today()).length;

  return (
    <div className="space-y-4">
      {/* ═══ Tableau de bord commercial ═══ */}
      <Panel>
        <div className="font-bold mb-3">📊 Tableau de bord commercial</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-slate-800">{actifs.length}</div>
            <div className="text-xs text-slate-500 mt-1">Prospects actifs</div>
          </div>
          <div className={`rounded-lg border p-3 text-center ${aRelancerAujourdhui > 0 ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
            <div className={`text-2xl font-extrabold ${aRelancerAujourdhui > 0 ? "text-orange-700" : "text-slate-800"}`}>{aRelancerAujourdhui}</div>
            <div className="text-xs text-slate-500 mt-1">🔔 À relancer aujourd'hui</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-slate-800">{dormants.length}</div>
            <div className="text-xs text-slate-500 mt-1">💤 Dormants</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
            <div className="text-2xl font-extrabold text-green-700">{tauxConversion}%</div>
            <div className="text-xs text-slate-500 mt-1">✅ Taux de conversion</div>
          </div>
        </div>
        {aRelancerAujourdhui > 0 && (
          <button onClick={() => setFiltreRelance(true)} className="mt-3 text-xs font-bold text-orange-700 underline">Voir les {aRelancerAujourdhui} prospect(s) à relancer →</button>
        )}
      </Panel>
      {isAdmin && (
        <Panel>
          <div className="font-bold mb-3">Catégories de prospects <span className="text-xs font-normal text-slate-500">(gérées par l'administrateur)</span></div>
          <div className="flex flex-wrap gap-2 mb-3">
            {db.categories_prospects.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-2 bg-white rounded-full border border-slate-300 px-3 py-1 text-sm">
                {c.nom}
                <button onClick={() => supprimerCategorie(c)} className="text-red-500 hover:text-red-700 font-bold">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-sm">
            <input className={inputCls} placeholder="Nouvelle catégorie…" value={nouvelleCat} onChange={(e) => setNouvelleCat(e.target.value)} />
            <button onClick={ajouterCategorie} className={btnDark}>Ajouter</button>
          </div>
        </Panel>
      )}

      {!isAdmin && (
        <Panel>
          <div className="font-bold mb-3">Nouveau prospect</div>
          {categories.length === 0 ? (
            <div className="text-sm text-slate-600">Aucune catégorie disponible. Demandez à l'administrateur d'en créer dans Paramètres.</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Field label="Catégorie">
                  <select className={inputCls} value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value })}>
                    {categories.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                  </select>
                </Field>
                <Field label="Nom du prospect"><input className={inputCls} value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} /></Field>
                <Field label="Numéro">
                  <input type="tel" placeholder="+228 ..." className={inputCls} value={f.tel} onChange={(e) => setF({ ...f, tel: e.target.value })} />
                  {/* Présélection : ce numéro est-il déjà un client ? */}
                  {(() => {
                    const dejaLa = comptesAvecCeNumero(db, profile, f.tel);
                    if (!dejaLa.length) return null;
                    return (
                      <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50">
                        {dejaLa.map((u) => (
                          <button key={u.id} type="button" onClick={() => setF({ ...f, nom: u.nom_base || u.nom, tel: u.tel })}
                            className="block w-full text-left px-2 py-1 text-xs font-semibold text-amber-900 whitespace-nowrap hover:bg-amber-100 border-b border-amber-200 last:border-b-0">
                            ⚠ Déjà client : {u.nom_base || u.nom} — {u.tel}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </Field>
                <div className="lg:col-span-2">
                  <Field label="Localisation (quartier, repère)">
                    <div className="flex gap-2">
                      <input className={inputCls} value={f.localisation} onChange={(e) => setF({ ...f, localisation: e.target.value })} placeholder="Ex : Quartier Bè, près de la pharmacie..." />
                      <button type="button" onClick={() => setCarteOuverte(!carteOuverte)} className={`px-4 rounded-lg text-sm font-bold whitespace-nowrap ${f.lat ? "bg-green-700 text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
                        📍 {f.lat ? "Position ✓" : "Choisir sur la carte"}
                      </button>
                    </div>
                  </Field>
                </div>
                <div className="lg:col-span-2">
                  <Field label="Nature du chantier / besoin (facultatif)">
                    <textarea className={inputCls + " min-h-[70px]"} value={f.nature} onChange={(e) => setF({ ...f, nature: e.target.value })}
                      placeholder="Ex : électrifier une maison 4 pièces, 3 ventilateurs + frigo. Pas encore de budget arrêté. Rappeler après le 15." />
                  </Field>
                </div>
                <Field label="Avis">
                  <select className={inputCls} value={f.statut} onChange={(e) => setF({ ...f, statut: e.target.value })}>
                    <option>Favorable</option>
                    <option>Défavorable</option>
                  </select>
                </Field>
                <Field label="Intérêt">
                  <select className={inputCls} value={f.interet} onChange={(e) => setF({ ...f, interet: e.target.value })}>
                    <option>Intéressé</option>
                    <option>Désintéressé</option>
                  </select>
                </Field>
                <Field label="Date de relance (facultatif)"><input type="date" className={inputCls} value={f.relance} onChange={(e) => setF({ ...f, relance: e.target.value })} /></Field>
              </div>
              {carteOuverte && (
                <div className="mt-3">
                  <CarteChoixPosition lat={f.lat} lng={f.lng} onChoisir={(lat, lng) => setF((prev) => ({ ...prev, lat, lng }))} />
                </div>
              )}
              <button onClick={ajouter} className={`mt-4 ${btnDark}`}>➕ Enregistrer le prospect</button>
            </>
          )}
        </Panel>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
          <span className="font-bold text-slate-800">{isAdmin ? "Tous les prospects" : "Mes prospects"} ({liste.length})</span>
          <div className="flex items-center gap-2 flex-wrap">
            <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-52" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            {acquis.length > 0 && (
              <button onClick={() => setVoirAcquis(!voirAcquis)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${voirAcquis ? "bg-green-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {voirAcquis ? "✅ Clients acquis affichés" : `Afficher les clients acquis (${acquis.length})`}
              </button>
            )}
            <button onClick={() => setVue(vue === "dormants" ? "actifs" : "dormants")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${vue === "dormants" ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              💤 Dormants{dormants.length > 0 ? ` (${dormants.length})` : ""}
            </button>
            {archives.length > 0 && (
              <button onClick={() => setVue(vue === "archives" ? "actifs" : "archives")} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${vue === "archives" ? "bg-amber-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                📦 Archivés ({archives.length})
              </button>
            )}
            <button onClick={() => setFiltreRelance(!filtreRelance)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filtreRelance ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              🔔 À relancer{aRelancerAujourdhui > 0 ? ` (${aRelancerAujourdhui})` : ""}
            </button>
          </div>
        </div>
        <table className="w-full text-sm min-w-[900px]">
          <thead><tr className="text-xs text-slate-500 uppercase">{["Date", "Nom", "Numéro", "Catégorie", "Localisation", "Avis", "Intérêt", "Relance", ...(isAdmin ? ["Commercial"] : []), ""].map((h) => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {liste.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-slate-400">Aucun prospect pour l'instant.</td></tr>}
            {listePage.map((p) => {
              const enRetard = p.relance && p.relance <= today();
              return (
                <tr key={p.id} className={`border-t border-slate-100 hover:bg-sky-50 ${enRetard ? "bg-orange-50" : ""}`}>
                  <td className="px-3 py-2 whitespace-nowrap">{dFR(p.date)}</td>
                  <td className="px-3 py-2 font-semibold">{p.nom}</td>
                  <td className="px-3 py-2">{p.tel}</td>
                  <td className="px-3 py-2 text-slate-500">{p.categorie}</td>
                  <td className="px-3 py-2">
                    {p.localisation || (p.lat ? "" : "—")}
                    {p.lat && p.lng && (
                      <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noreferrer" className="ml-1 text-sky-700 underline text-xs whitespace-nowrap">📍 Voir sur la carte</a>
                    )}
                    {p.nature && <div className="text-xs text-slate-500 mt-1 italic">🔧 {p.nature}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.statut === "Favorable" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.statut}</span>
                    {estDormant(p) && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-slate-200 text-slate-600 border border-slate-300" title={`Aucune activité depuis ${joursSansActivite(p)} jours`}>
                        💤 Dormant — {Math.floor(joursSansActivite(p) / 30)} mois
                      </span>
                    )}
                    {p.archive && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300" title={`Archivé le ${dFR(p.archive_le)}`}>
                        📦 {p.archive_motif}
                      </span>
                    )}
                    {p.devis_valide && !p.converti && (
                      <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300" title={`Devis de ${fmt(p.devis_total)} validé le ${dFR(p.devis_valide_le)} — paiement prévu à ${p.devis_boutique}`}>
                        ⏳ Devis validé — attend le paiement
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.interet === "Intéressé" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>{p.interet}</span>
                  </td>
                  <td className={`px-3 py-2 whitespace-nowrap ${enRetard ? "text-orange-700 font-bold" : ""}`}>{p.relance ? dFR(p.relance) : "—"}</td>
                  {isAdmin && <td className="px-3 py-2">{p.commercial}</td>}
                  <td className="px-3 py-2 whitespace-nowrap">
                    {!isAdmin && <button onClick={() => modifierRelance(p)} className="text-xs font-bold text-sky-800 underline mr-2">Relance</button>}
                    {enRetard && p.tel && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => relancerWhatsApp(p)} className="text-xs font-bold text-white bg-orange-600 rounded px-2 py-0.5 hover:bg-orange-700 mr-2">📱 Relancer</button>
                    )}
                    {voitTout && aDroit(db, profile, "act_reaffecter") && <button onClick={() => reassigner(p)} className="text-xs font-bold text-sky-800 underline mr-2">Réassigner</button>}
                    {!p.archive && !p.converti && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => contacte(p)} className="text-xs text-sky-700 underline font-semibold" title={`Dernière activité : ${dFR(derniereActivite(p))}`}>📞 Contacté</button>
                    )}
                    {!p.archive && !p.converti && (isAdmin || p.commercial === profile.nom) && (
                      <button onClick={() => convertirEnClient(p)} className="text-xs font-bold text-white bg-green-700 rounded px-2 py-0.5 hover:bg-green-800">✅ Convertir en client</button>
                    )}
                    {p.archive
                      ? (isAdmin || p.commercial === profile.nom) && <button onClick={() => reactiver(p)} className="text-xs text-green-700 underline font-semibold">↩ Réactiver</button>
                      : (isAdmin || p.commercial === profile.nom) && !p.converti && <button onClick={() => archiver(p)} className="text-xs text-amber-700 underline font-semibold">📦 Archiver</button>}
                    {(isAdmin || p.commercial === profile.nom) && <button onClick={() => supprimer(p)} className="text-xs text-red-600 underline">Suppr.</button>}
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
