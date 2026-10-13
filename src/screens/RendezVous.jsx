// ============================================================
// screens/RendezVous.jsx — L'ONGLET 📅 RENDEZ-VOUS (12/10/2026)
//
// Timo : « un onglet RENDEZ-VOUS… une ligne à choisir, rendez-vous pro et
// rendez-vous privé, accessible à tous les employés… pour visite, la liste
// des techniciens apparaît pour choisir qui fera partie de la visite… »,
// puis « Aa, A2a, Ba, C 14h la veille et le jour même à 7h, Da, Ea, Fb,
// G toutes, H a ». La règle vit dans lib/rendezVous.js ; les textes
// WhatsApp dans lib/whatsappModeles.js ; les rappels de 14 h (la veille) et
// de 7 h (le jour même) partent du serveur (api/_rendezVous.js).
// ⚠ Un privé ne descend que chez son auteur : c'est la BASE qui le garde
// (supabase/rendez-vous-1-table.sql), l'écran ne fait que le redire.
// ============================================================
import { useEffect, useState } from "react";
import { uid, today, dFR } from "../lib/core";
import { Panel, Field, inputCls, btnDark, uAlert, uConfirm, uPrompt, FormulaireRepliable, PanneauQuiSeMontre } from "../components/ui";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { HistoriqueArchive } from "../components/HistoriqueArchive";
import { espaceDuCompte, utilisateursDeLEspace, chantiersDeLEspaceRegarde, bloquerSiLecture, peutEcrire, estChefEquipe } from "../lib/calculs";
import {
  TYPE_PRO, TYPE_PRIVE, STATUT_A_VENIR, OBJET_MAX, COMPTE_RENDU_MAX, libelleType, libelleStatut,
  peutAvoirRendezVous, peutModifierRdv, peutMarquerFait, critiqueRendezVous, nouveauRendezVous,
  rendezVousVisibles, rangerParJour, TITRES_GROUPES, participantsProposes, conflitsRendezVous,
  changementsRendezVous, prospectsPourVisite, propositionsVisite, marquerFait, annulerRdv, CHAMPS_DU_PARTICIPANT,
  equipeDuRdv, estChefDeLaVisite,
} from "../lib/rendezVous";
import { envoiRendezVousEquipe, envoiRendezVousModifie, envoiVisiteClient, envoiVisiteChef, jourEnClair, heureEnClair } from "../lib/whatsappModeles";
import { tableAbsente } from "../sync";

const VIDE = { date: "", heure: "", objet: "", lieu: "", visite: false, participants: [], chef_id: "", client_texte: "", prospect_id: "", client_user_id: "", client_nom: "", client_tel: "" };

export function RendezVous({ db, save, profile, preRempli, onPreRempliLu }) {
  const [vue, setVue] = useState(TYPE_PRO);
  const [ouvert, setOuvert] = useState(false);
  const [edition, setEdition] = useState(null); // le rendez-vous qu'on modifie
  const [f, setF] = useState(VIDE);
  const [absente, setAbsente] = useState(false);
  const [note, setNote] = useState("");
  const aujourdhui = today();
  const formation = espaceDuCompte(db, profile) === true;
  const lecture = !peutEcrire(db, profile);

  useEffect(() => { let vivant = true; tableAbsente("rendez_vous").then((x) => { if (vivant) setAbsente(x); }); return () => { vivant = false; }; }, [db]);

  // 🧲 « 📅 Planifier une visite » depuis 🧲 Prospects : le formulaire s'ouvre
  // rempli (une visite pro, le prospect rattaché, son lieu).
  useEffect(() => {
    if (!preRempli) return;
    const p = preRempli.prospect || {};
    setVue(TYPE_PRO); setEdition(null);
    setF({ ...VIDE, visite: true, objet: `Visite chez ${p.nom || ""}`.trim(), lieu: p.localisation || "",
      client_texte: `${p.nom || ""}${p.tel ? ` — ${p.tel}` : ""}`, prospect_id: p.id || "", client_user_id: p.client_user_id || "", client_nom: p.nom || "", client_tel: p.tel || "" });
    setOuvert(true);
    onPreRempliLu?.();
  }, [preRempli]);

  if (!peutAvoirRendezVous(profile)) return null;

  const personnes = utilisateursDeLEspace(db, profile);
  const nomDe = (id) => (personnes.find((u) => u.id === id) || (db.users || []).find((u) => u.id === id) || {}).nom || "";
  const ficheDe = (id) => personnes.find((u) => u.id === id) || null;
  const tous = rendezVousVisibles(db.rendez_vous, profile, formation);
  const duType = tous.filter((r) => r.type === vue);
  const groupes = rangerParJour(duType, aujourdhui);
  // L'organisateur est proposé aussi (13/10/2026) : il se coche s'il y va.
  const { techniciens, autres } = participantsProposes(personnes);
  const organisateurId = edition ? edition.par_id : profile.id;
  const voitTout = profile.role === "admin" || profile.role === "resp_commercial" || estChefEquipe(db, profile);
  const prospects = prospectsPourVisite((db.prospects || []).filter((p) => !!p.formation === formation), profile, voitTout);
  const suggestions = propositionsVisite({ comptes: personnes, prospects });
  const chantiers = chantiersDeLEspaceRegarde(db, profile);

  const champ = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const brouillon = () => ({ ...(edition || {}), type: edition ? edition.type : vue, date: f.date, heure: f.heure, objet: f.objet, lieu: f.lieu,
    visite: (edition ? edition.type : vue) === TYPE_PRO && f.visite, participants: (edition ? edition.type : vue) === TYPE_PRO ? f.participants : [],
    chef_id: f.visite ? f.chef_id || f.participants[0] || "" : "", par_id: edition ? edition.par_id : profile.id });
  const conflits = f.date ? conflitsRendezVous({ rdv: { ...brouillon(), id: edition?.id }, rendezVous: tous, chantiers, nomDe }) : [];

  const fermer = () => { setOuvert(false); setEdition(null); setF(VIDE); };
  const ouvrirModif = (r) => {
    if (!peutModifierRdv(r, profile)) { uAlert(r.type === TYPE_PRIVE ? "Ce rendez-vous privé n'est pas le vôtre." : "Un rendez-vous pro se modifie par celui qui l'a créé ou par l'administrateur."); return; }
    setEdition(r);
    setF({ ...VIDE, date: r.date, heure: r.heure, objet: r.objet, lieu: r.lieu || "", visite: !!r.visite, participants: r.participants || [], chef_id: r.chef_id || "",
      client_texte: r.client_nom ? `${r.client_nom}${r.client_tel ? ` — ${r.client_tel}` : ""}` : "", prospect_id: r.prospect_id || "", client_user_id: r.client_user_id || "", client_nom: r.client_nom || "", client_tel: r.client_tel || "" });
    setOuvert(true);
  };
  const basculer = (id) => setF((x) => {
    const participants = x.participants.includes(id) ? x.participants.filter((y) => y !== id) : [...x.participants, id];
    return { ...x, participants, chef_id: participants.includes(x.chef_id) ? x.chef_id : participants[0] || "" };
  });

  // 📲 Les messages WhatsApp aux personnes concernées (« D a » : les
  // participants ; le reste du personnel a sa notification, lib/notifications.js).
  // Les messages énumèrent l'ÉQUIPE, le chef d'abord (13/10/2026) ; le CHEF
  // d'une visite reçoit `visite_chef`, avec le numéro du client — refusé (pas
  // encore approuvé par Meta), l'avis ordinaire part à sa place et on le dit.
  // ⚠ LE MUR : un rendez-vous de formation n'envoie RIEN.
  const prevenir = async (avant, apres) => {
    if (apres.formation) return [];
    const { nouveaux, changements, chef } = changementsRendezVous(avant, apres, profile.id);
    if (!nouveaux.length && !changements.length && !chef) return [];
    const { envoyerRecuSansQuestion } = await import("../whatsapp.js");
    const phrases = [];
    const equipe = equipeDuRdv(apres, nomDe);
    // Rend la phrase de l'envoi, ou null si la fiche n'a pas de numéro.
    const tenter = async (id, envoi, quoi) => {
      const fiche = ficheDe(id);
      if (!fiche || !envoi) return "";
      if (String(fiche.tel || "").replace(/\D/g, "").length < 8) { phrases.push(`📲 Aucun WhatsApp : la fiche de ${fiche.nom} n'a pas de numéro (👥 Utilisateurs → ⋯ Gérer → Téléphone).`); return null; }
      return (await envoyerRecuSansQuestion({ envoi, tel: fiche.tel, nom: fiche.nom, espaceFormation: false, save, profile, ref: { rdv_id: apres.id }, noms: quoi })) || "";
    };
    const parti = (r) => String(r || "").startsWith("📲");
    const AVIS_CHEF = { titre: "Avis au chef de la visite", sujet: "L'avis au chef de la visite" };
    const SANS_NUMERO = (nom) => `⚠ ${nom} n'a pas reçu le numéro du client : l'avis du chef de la visite n'est pas encore accepté par WhatsApp (il le sera après l'accord de Meta).`;
    for (const id of nouveaux) {
      const fiche = ficheDe(id);
      const employe = fiche?.nom_complet || fiche?.nom;
      const ordinaire = () => envoiRendezVousEquipe({ employe, auteur: profile.nom, rdv: apres, participants: equipe });
      if (estChefDeLaVisite(apres, id)) {
        const r = await tenter(id, envoiVisiteChef({ employe, auteur: profile.nom, rdv: apres, equipe }), AVIS_CHEF);
        if (r === null) continue;
        if (parti(r)) { phrases.push(r); continue; }
        const r2 = await tenter(id, ordinaire(), { titre: "Avis de rendez-vous", sujet: "L'avis de rendez-vous" });
        if (r2) phrases.push(r2);
        if (parti(r2)) phrases.push(SANS_NUMERO(fiche?.nom || "Le chef"));
        continue;
      }
      const r = await tenter(id, ordinaire(), { titre: "Avis de rendez-vous", sujet: "L'avis de rendez-vous" });
      if (r) phrases.push(r);
    }
    // Un participant déjà prévenu qui devient le chef de la visite.
    if (chef) {
      const fiche = ficheDe(chef);
      const r = await tenter(chef, envoiVisiteChef({ employe: fiche?.nom_complet || fiche?.nom, auteur: profile.nom, rdv: apres, equipe }), AVIS_CHEF);
      if (r) phrases.push(r);
      if (r !== null && !parti(r)) phrases.push(SANS_NUMERO(fiche?.nom || "Le chef"));
    }
    for (const { id, phrase } of changements) {
      const fiche = ficheDe(id);
      const r = await tenter(id, envoiRendezVousModifie({ employe: fiche?.nom_complet || fiche?.nom, rdv: apres, changement: phrase }), { titre: "Avis de changement", sujet: "L'avis de changement" });
      if (r) phrases.push(r);
    }
    return phrases;
  };

  // « G » : le client prévenu de la visite — APRÈS une question, jamais seul.
  const prevenirClient = async (r) => {
    if (r.formation || !r.visite || String(r.client_tel || "").replace(/\D/g, "").length < 8) return "";
    if (!(await uConfirm(`Prévenir ${r.client_nom || "le client"} (${r.client_tel}) de la visite du ${jourEnClair(r.date)} à ${heureEnClair(r.heure)}, par WhatsApp du numéro BMI ?`))) return "";
    const chef = ficheDe(r.chef_id);
    const envoi = envoiVisiteClient({ client: r.client_nom, rdv: r, chefNom: chef?.nom, chefTel: chef?.tel });
    const { envoyerRecuSansQuestion } = await import("../whatsapp.js");
    const phrase = await envoyerRecuSansQuestion({ envoi, tel: r.client_tel, nom: r.client_nom, espaceFormation: false, save, profile, ref: { rdv_id: r.id }, noms: { titre: "Avis de visite", sujet: "L'avis de visite" } });
    if (phrase && phrase.startsWith("📲")) save((etat) => ({ ...etat, rendez_vous: (etat.rendez_vous || []).map((x) => (x.id === r.id ? { ...x, client_prevenu_le: today() } : x)) }), `Visite annoncée à ${r.client_nom}`);
    return phrase;
  };

  const enregistrer = async () => {
    if (bloquerSiLecture(db, profile)) return;
    if (absente) { uAlert(MESSAGE_TABLE_ABSENTE); return; }
    if (edition) {
      const frais = (db.rendez_vous || []).find((x) => x.id === edition.id);
      if (!frais || !peutModifierRdv(frais, profile)) { uAlert("Ce rendez-vous ne se modifie plus (supprimé, ou vous n'en êtes ni l'auteur ni l'administrateur)."); return; }
      if (frais.statut !== STATUT_A_VENIR) { uAlert("Un rendez-vous fait ou annulé ne se modifie plus."); return; }
    }
    const base = edition
      ? { ...edition, ...brouillon(), prospect_id: f.visite ? f.prospect_id : "", client_user_id: f.visite ? f.client_user_id : "", client_nom: f.visite ? f.client_nom : "", client_tel: f.visite ? f.client_tel : "", modifie_le: today(), modifie_par: profile.nom }
      : nouveauRendezVous({ profile, formation, id: `rdv_${uid()}`, maintenant: new Date().toISOString(), champs: { ...f, type: vue } });
    const motif = critiqueRendezVous(base, { aujourdhui, creation: !edition });
    if (motif) { uAlert(motif); return; }
    const cfl = conflitsRendezVous({ rdv: base, rendezVous: tous, chantiers, nomDe });
    const resume = `${libelleType(base.type)} — ${base.objet}\n${jourEnClair(base.date)} à ${heureEnClair(base.heure)}${base.lieu ? `\nLieu : ${base.lieu}` : ""}${base.participants.length ? `\nParticipants : ${base.participants.map(nomDe).join(", ")}` : ""}`;
    if (!(await uConfirm(`${edition ? "Enregistrer la modification" : "Enregistrer ce rendez-vous"} ?\n\n${resume}${cfl.length ? `\n\n⚠ Attention :\n• ${cfl.join("\n• ")}` : ""}`))) return;
    const avant = edition ? (db.rendez_vous || []).find((x) => x.id === edition.id) : null;
    save((etat) => ({ ...etat, rendez_vous: edition ? (etat.rendez_vous || []).map((x) => (x.id === base.id ? base : x)) : [...(etat.rendez_vous || []), base] }),
      base.type === TYPE_PRIVE ? (edition ? "Rendez-vous privé modifié" : "Rendez-vous privé ajouté") : `${edition ? "Rendez-vous modifié" : "Rendez-vous pro ajouté"} : ${base.objet} (${dFR(base.date)} ${base.heure})`);
    fermer();
    const phrases = await prevenir(avant, base);
    const client = !edition ? await prevenirClient(base) : "";
    const tout = [...phrases, client].filter(Boolean);
    setNote(tout.join("\n"));
  };

  const faire = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const frais = (db.rendez_vous || []).find((x) => x.id === r.id);
    if (!frais || !peutMarquerFait(frais, profile)) { uAlert("Seuls son auteur, l'administrateur et les participants marquent ce rendez-vous fait."); return; }
    const cr = await uPrompt(`Rendez-vous fait : ${frais.objet}.\n\n${frais.visite ? "Compte rendu de la visite (ce qui a été vu, la suite : devis à faire…) :" : "Un mot pour la suite (facultatif) :"}`, frais.compte_rendu || "");
    if (cr === null) return;
    if (frais.visite && !String(cr).trim()) { uAlert("Une visite faite demande son compte rendu : c'est lui qui dit la suite au commercial."); return; }
    const apres = marquerFait(frais, { compteRendu: cr, profile, aujourdhui });
    // ⚠ Un participant n'écrit QUE ces champs (le serveur refuse le reste).
    const ligne = peutModifierRdv(frais, profile) ? apres : { ...frais, ...Object.fromEntries(CHAMPS_DU_PARTICIPANT.map((k) => [k, apres[k]])) };
    save((etat) => ({ ...etat, rendez_vous: (etat.rendez_vous || []).map((x) => (x.id === r.id ? ligne : x)) }), frais.type === TYPE_PRIVE ? "Rendez-vous privé fait" : `Rendez-vous fait : ${frais.objet}`);
  };

  const annuler = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const frais = (db.rendez_vous || []).find((x) => x.id === r.id);
    if (!frais || !peutModifierRdv(frais, profile)) { uAlert("Un rendez-vous pro s'annule par celui qui l'a créé ou par l'administrateur."); return; }
    const motif = await uPrompt(`Annuler le rendez-vous « ${frais.objet} » du ${jourEnClair(frais.date)} ?\n\nMotif (obligatoire) :`);
    if (motif === null) return;
    if (!String(motif).trim()) { uAlert("Le motif est obligatoire : il est dit aux participants."); return; }
    const apres = annulerRdv(frais, { motif, profile, aujourdhui });
    save((etat) => ({ ...etat, rendez_vous: (etat.rendez_vous || []).map((x) => (x.id === r.id ? apres : x)) }), `Rendez-vous annulé : ${frais.objet} — ${motif}`);
    setNote((await prevenir(frais, apres)).join("\n"));
  };

  const supprimer = async (r) => {
    if (bloquerSiLecture(db, profile)) return;
    const frais = (db.rendez_vous || []).find((x) => x.id === r.id);
    if (!frais || frais.type !== TYPE_PRIVE || frais.par_id !== profile.id) { uAlert("Seul son auteur supprime un rendez-vous privé. Un rendez-vous pro s'annule (✖ Annuler) : les participants sont prévenus."); return; }
    if (!(await uConfirm(`Supprimer le rendez-vous privé « ${frais.objet} » du ${jourEnClair(frais.date)} ?`))) return;
    save((etat) => ({ ...etat, rendez_vous: (etat.rendez_vous || []).filter((x) => x.id !== r.id) }), "Rendez-vous privé supprimé");
  };

  const carte = (r) => (
    <div key={r.id} data-ligne={r.id} data-rendez-vous={r.type} className={`rounded-xl border p-3 bg-white ${r.statut === STATUT_A_VENIR ? "border-slate-200" : "border-slate-200 opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-slate-800">{heureEnClair(r.heure)} · {r.objet}</div>
          <div className="text-xs text-slate-500">{jourEnClair(r.date)}{r.lieu ? ` · 📍 ${r.lieu}` : ""}</div>
        </div>
        <div className="flex flex-wrap gap-1 text-xs font-semibold">
          {r.visite && <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-800 border border-sky-200">🔎 Visite</span>}
          <span className={`px-2 py-0.5 rounded-lg border ${r.statut === STATUT_A_VENIR ? "bg-amber-50 text-amber-800 border-amber-200" : r.statut === "fait" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>{libelleStatut(r.statut)}</span>
        </div>
      </div>
      {r.type === TYPE_PRO && (
        <div className="text-xs text-slate-600 mt-1">
          Organisé par <b>{r.par}</b>{equipeDuRdv(r, nomDe).length ? <> · <span data-equipe-rdv>Équipe : {equipeDuRdv(r, nomDe).join(", ")}</span></> : " · aucun participant"}
        </div>
      )}
      {r.visite && r.client_nom && <div className="text-xs text-slate-600">👤 {r.client_nom}{r.client_tel ? ` · ${r.client_tel}` : ""}{r.client_prevenu_le ? ` · 📲 prévenu le ${dFR(r.client_prevenu_le)}` : ""}</div>}
      {r.compte_rendu && <div data-compte-rendu className="text-xs mt-1 p-2 rounded-lg bg-green-50 text-green-800 border border-green-100 whitespace-pre-wrap">📝 {r.compte_rendu}{r.fait_par ? ` — ${r.fait_par}` : ""}</div>}
      {r.statut === "annule" && <div className="text-xs mt-1 text-slate-600">✖ Annulé le {dFR(r.annule_le)} par {r.annule_par}{r.annule_motif ? ` — ${r.annule_motif}` : ""}</div>}
      {r.statut === STATUT_A_VENIR && !lecture && (
        <div className="flex flex-wrap gap-2 mt-2">
          {peutMarquerFait(r, profile) && <button onClick={() => faire(r)} className="px-2.5 py-1 rounded-lg border border-green-300 text-green-800 text-xs font-semibold hover:bg-green-50">✅ Fait</button>}
          {peutModifierRdv(r, profile) && <button onClick={() => ouvrirModif(r)} className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50">✏️ Modifier</button>}
          {r.type === TYPE_PRO && peutModifierRdv(r, profile) && <button onClick={() => annuler(r)} className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50">✖ Annuler</button>}
          {r.type === TYPE_PRIVE && r.par_id === profile.id && <button onClick={() => supprimer(r)} className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50">🗑 Supprimer</button>}
        </div>
      )}
    </div>
  );

  const case_ = (u) => (
    <label key={u.id} className="flex items-center gap-2 text-sm py-0.5">
      <input type="checkbox" checked={f.participants.includes(u.id)} onChange={() => basculer(u.id)} />
      <span>{u.nom}{u.id === organisateurId ? <span data-organisateur className="text-xs text-slate-500"> — {u.id === profile.id ? "vous, l'organisateur : cochez-vous si vous y allez" : "l'organisateur"}</span> : null}</span>
    </label>
  );
  const typeForm = edition ? edition.type : vue;

  return (
    <div className="space-y-4" data-ecran-rendez-vous>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="font-bold">📅 Rendez-vous</div>
          <select data-type-rendez-vous value={vue} onChange={(e) => { setVue(e.target.value); fermer(); }} className={`${inputCls} sm:w-56`}>
            <option value={TYPE_PRO}>💼 Rendez-vous pro</option>
            <option value={TYPE_PRIVE}>🔒 Rendez-vous privé</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 mb-3">
          {vue === TYPE_PRO
            ? "Ce qui concerne BMI, surtout les visites : tout le personnel le voit. Les participants sont prévenus par WhatsApp, et rappelés la veille à 14 h et le jour même à 7 h. L'organisateur ne fait partie de l'équipe que s'il se coche, mais il est prévenu et rappelé dans tous les cas. Le chef d'une visite reçoit le numéro du client."
            : "Vos rendez-vous personnels : vous seul les voyez, l'administrateur non plus. Le rappel WhatsApp (la veille à 14 h, le jour même à 7 h) ne dit pas l'objet."}
        </div>
        {absente && <div data-table-absente className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">{MESSAGE_TABLE_ABSENTE}</div>}
        {lecture
          ? <div className="text-sm text-slate-600">🔒 Votre compte est en lecture seule : vous voyez les rendez-vous pro, vous n'en créez pas.</div>
          : (
            <PanneauQuiSeMontre cle={edition ? edition.id : ouvert ? "nouveau" : "ferme"} retour={edition ? edition.id : undefined}>
              <FormulaireRepliable ouvert={ouvert} onOuvrir={() => { setEdition(null); setF(VIDE); setOuvert(true); }} onFermer={fermer}
                bouton={vue === TYPE_PRO ? "➕ Nouveau rendez-vous pro" : "➕ Nouveau rendez-vous privé"}
                titre={edition ? `✏️ Modifier — ${libelleType(edition.type)}` : `➕ ${libelleType(typeForm)}`}
                apresBouton={note ? <span data-note-rendez-vous className="text-xs text-slate-600 whitespace-pre-line">{note}</span> : null}>
                <div className="grid sm:grid-cols-4 gap-3">
                  <Field label="Date"><input type="date" value={f.date} min={edition ? undefined : aujourdhui} onChange={champ("date")} className={inputCls} /></Field>
                  <Field label="Heure"><input type="time" value={f.heure} onChange={champ("heure")} className={inputCls} /></Field>
                  <Field label="Objet"><input value={f.objet} maxLength={OBJET_MAX} onChange={champ("objet")} placeholder={typeForm === TYPE_PRO ? "Visite chez MR ERIC" : "Banque, médecin…"} className={inputCls} /></Field>
                  <Field label="Lieu (facultatif)"><input value={f.lieu} onChange={champ("lieu")} placeholder="Adagbe, près du marché" className={inputCls} /></Field>
                </div>
                {typeForm === TYPE_PRO && (
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" checked={f.visite} onChange={(e) => setF((x) => ({ ...x, visite: e.target.checked }))} />
                      🔎 C'est une visite (chez un client ou un prospect)
                    </label>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div data-participants-techniciens className="rounded-xl border border-slate-200 p-3">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">🔧 Techniciens</div>
                        {techniciens.length ? techniciens.map(case_) : <div className="text-xs text-slate-400">Aucun technicien dans cet espace.</div>}
                      </div>
                      <div data-participants-autres className="rounded-xl border border-slate-200 p-3">
                        <div className="text-xs font-bold text-slate-500 uppercase mb-1">👥 Autre personnel</div>
                        <div className="max-h-48 overflow-y-auto">{autres.length ? autres.map(case_) : <div className="text-xs text-slate-400">Personne d'autre.</div>}</div>
                      </div>
                    </div>
                    {f.visite && (
                      <div className="grid sm:grid-cols-3 gap-3">
                        <Field label="Chef de la visite">
                          <select value={f.chef_id} onChange={champ("chef_id")} className={inputCls}>
                            {!f.participants.length && <option value="">— cochez qui y va —</option>}
                            {f.participants.map((id) => <option key={id} value={id}>{nomDe(id)}</option>)}
                          </select>
                        </Field>
                        <Field label="Client ou prospect (taper un nom ou un numéro)">
                          <ChampSuggestions valeur={f.client_texte} suggestions={suggestions}
                            onChange={(t) => setF((x) => ({ ...x, client_texte: t, client_nom: t.split(" — ")[0], client_user_id: "", prospect_id: "" }))}
                            onChoisir={(s) => setF((x) => ({ ...x, ...s.lien, client_texte: s.valeur, lieu: x.lieu || s.lien.lieu || "" }))} />
                        </Field>
                        <Field label="Son numéro (pour le prévenir)"><input value={f.client_tel} onChange={champ("client_tel")} placeholder="90 11 22 33" className={inputCls} /></Field>
                      </div>
                    )}
                  </div>
                )}
                {conflits.length > 0 && (
                  <div data-conflits-rendez-vous className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
                    ⚠ {conflits.map((c, i) => <div key={i}>{c}</div>)}
                  </div>
                )}
                <div className="mt-3">
                  <button onClick={enregistrer} className={btnDark}>{edition ? "💾 Enregistrer la modification" : "📅 Enregistrer le rendez-vous"}</button>
                </div>
              </FormulaireRepliable>
            </PanneauQuiSeMontre>
          )}
      </Panel>

      <Panel>
        {TITRES_GROUPES.some(([k]) => groupes[k].length)
          ? TITRES_GROUPES.filter(([k]) => groupes[k].length).map(([k, titre]) => (
            <div key={k} data-groupe-rendez-vous={k} className="mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2">{titre} · {groupes[k].length}</div>
              <div className="grid lg:grid-cols-2 gap-2">{groupes[k].map(carte)}</div>
            </div>
          ))
          : <div className="text-sm text-slate-500">Aucun rendez-vous {vue === TYPE_PRO ? "pro" : "privé"} à venir.</div>}
      </Panel>

      {groupes.passes.length > 0 && (
        <Panel>
          <div className="font-bold mb-2">🕘 Passés, faits ou annulés</div>
          <HistoriqueArchive lignes={groupes.passes} dateDe={(r) => r.date} aujourdhui={aujourdhui} titreArchives="Anciens rendez-vous"
            entete={<thead><tr className="text-left text-xs text-slate-500"><th className="p-1">Le plus récent d'abord</th></tr></thead>}
            rendre={(r) => (
              <tr key={r.id} className="align-top">
                <td className="p-1">{carte(r)}</td>
              </tr>
            )} />
        </Panel>
      )}
    </div>
  );
}

export const MESSAGE_TABLE_ABSENTE = "📅 Les rendez-vous ne sont pas encore en place sur le serveur : l'administrateur principal doit coller le script SQL des rendez-vous dans Supabase. D'ici là, rien ne peut être enregistré ici.";
