// ============================================================
// screens/Outillage.jsx — 🧰 MATÉRIEL DE TRAVAIL (Timo, 17/09/2026)
//
// « Le matériel de travail… comment faire le suivi, pour éviter la perte
// des équipements de travail sur le terrain. »
//
// Le registre de l'outillage de BMI : une fiche par outil, deux gestes
// (📤 Sortie / 📥 Retour), et la règle qui empêche vraiment la perte —
// un outil est TOUJOURS sous le nom de QUELQU'UN. Décisions de Timo :
//   • le tiennent : le chef technicien, le magasinier, l'administrateur ;
//   • un outil perdu se marque, sa valeur entre dans les pertes de
//     l'année, ET l'administrateur peut poser une retenue sur le salaire ;
//   • l'appel de l'outillage se fait CHAQUE SEMAINE.
// Règles pures : lib/outillage.js. ⚠ Ce n'est PAS du stock (voir l'entête
// de lib/outillage.js) : le registre vit dans le champ `outillage` de sa
// boutique — rien à coller pour créer une table.
// ============================================================
import { Fragment, useState } from "react";
import { fmt, dFR, today, uid, nouveauMessage, envoyerWhatsApp } from "../lib/core";
import { chiffresTel } from "../lib/identiteClient";
import { Field, inputCls, btnDark, Panel, Stat, uAlert, uConfirm, uPrompt, demanderMois, AucuneBoutique, boutonAction, enTeteFige, celluleFigee, classeLigneDepliable, IconeWhatsApp } from "../components/ui";
import { BoutiqueTabs } from "../components/SelecteurBoutique";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { correspond } from "../lib/suggestions";
import { bloquerSiLecture, refuserSaufAdmin, boutiqueParDefaut, boutiqueRetenue, estCompteFormation, utilisateursDeLEspace, boutiquesVisibles } from "../lib/calculs";
import {
  ETATS_OUTIL, peutTenirOutillage, outilsDe, outilsVivants, etatOutil, libelleEtat,
  detenteurOutil, sortieEnCours, enRetard, joursDehors, critiqueSortie, sortirOutil, critiqueRetour,
  rendreOutil, mettreEnReparation, critiquePerte, responsableDeLaPerte, valeurProposee, declarerPerdu,
  reformerOutil, retenuePourOutil, pertesDe, appelAFaire, appelDeLaSemaine, construireAppel,
  manquantsDuDernierAppel, resumeOutillage, propositionsOutils, outilSaisi, critiqueNouvelOutil,
  nouvelOutil, remplacerOutil, ajouterOutil, ajouterAppel, histoireOutil, dernierRetour,
  outilsDeLaVue, critiqueReparation, reparationEnCours, doitJustifier, critiqueJustification,
  justifierRetard, derniereJustification, justificationsDeLaSortie, mesOutils, coutReparations, joursDeRetard,
} from "../lib/outillage";

// Les quatre vues de Timo (18/09/2026), leurs titres et ce qu'on dit quand
// elles sont vides.
const TITRE_VUE = {
  tous: "📒 Le registre",
  dehors: "🧰 Ce qui est dehors",
  retard: "⏰ En retard",
  reparation: "🔧 En réparation",
};
const VIDE_VUE = {
  tous: "Aucun outil au registre.",
  dehors: "Tout le matériel est rentré.",
  retard: "Aucun outil en retard : tout ce qui est dehors doit encore revenir.",
  reparation: "Aucun outil chez un réparateur.",
};
const REFUS_ROLE = "🔒 Tenir le registre de l'outillage : réservé au chef des techniciens, au magasinier et à l'administrateur.";
const sortieVide = { saisie: "", outil_id: "", user_id: "", chantier: "", retour_prevu: "" };
const outilVide = { nom: "", numero: "", categorie: "", achete_le: "", prix_achat: "" };

// ============================================================
// L'INTERFACE DU DÉTENTEUR (Timo, 18/09/2026) : « celui qui a un outil et
// est en retard de retour doit justifier pourquoi l'outil n'est pas encore
// de retour, DANS SON INTERFACE ».
//
// Un technicien sans l'étoile ⭐ ne tient pas le registre — il ne voit donc
// ni les outils des autres, ni le reste de l'écran : seulement CE QU'IL
// DÉTIENT, et la case pour justifier un retard. Ses outils peuvent venir de
// n'importe quelle boutique de son espace : on les cherche dans toutes.
// ============================================================
function MesOutils({ db, save, profile }) {
  const [texte, setTexte] = useState({});
  const jour = today();
  const boutiques = boutiquesVisibles(db, profile, db.boutiques || []);
  const lignes = mesOutils(boutiques, profile.id);
  const aJustifier = lignes.filter(({ outil }) => doitJustifier(outil, profile.id, jour));

  const justifier = async (b, outil) => {
    if (bloquerSiLecture(db, profile)) return;
    const t = texte[outil.id] || "";
    const refus = critiqueJustification(outil, { texte: t });
    if (refus) { uAlert(refus); return; }
    const apres = justifierRetard(outil, { id: uid(), le: jour, texte: t, par_id: profile.id, par: profile.nom });
    save({
      ...db,
      boutiques: (db.boutiques || []).map((x) => (x.id === b.id ? remplacerOutil(b, apres) : x)),
    }, `🧰 Retard justifié — ${outil.nom} par ${profile.nom} : ${t} (${b.nom})`);
    setTexte({ ...texte, [outil.id]: "" });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="font-bold text-slate-800 text-lg mb-1">🧰 Mes outils</div>
        <div className="text-xs text-slate-500 mb-3">Le matériel de BMI dont vous répondez en ce moment. Vous n'enregistrez pas les sorties et les retours : c'est votre chef, le magasinier ou l'administrateur qui le fait.</div>

        {aJustifier.length > 0 && (
          <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 mb-3">
            <div className="text-sm font-bold text-red-900">⏰ {aJustifier.length === 1 ? "Un outil n'est pas rentré à la date prévue." : `${aJustifier.length} outils ne sont pas rentrés à la date prévue.`} Dites pourquoi.</div>
          </div>
        )}

        {lignes.length === 0 ? (
          <div className="text-sm text-slate-500">Vous ne détenez aucun outil.</div>
        ) : (
          <div className="space-y-3">
            {lignes.map(({ boutique: b, outil: o }) => {
              const s = sortieEnCours(o);
              const tard = enRetard(o, jour);
              const just = derniereJustification(o);
              return (
                <div key={o.id} className={`rounded-xl border p-3 ${tard ? "border-red-300 bg-red-50" : "bg-slate-50"}`}>
                  <div className="font-bold text-slate-800">{o.nom}{o.numero ? ` — N° ${o.numero}` : ""} <span className="text-xs font-normal text-slate-500">({b.nom})</span></div>
                  <div className="text-sm text-slate-600 mt-1">
                    Pris le <b>{dFR(s.le)}</b>{s.chantier ? <> pour <b>{s.chantier}</b></> : null} · remis par <b>{s.par || "—"}</b>
                    {s.retour_prevu && <> · retour prévu le <b className={tard ? "text-red-700" : ""}>{dFR(s.retour_prevu)}</b></>}
                    {tard && <b className="text-red-700"> — en retard de {joursDeRetard(o, jour)} jour(s)</b>}
                  </div>
                  {justificationsDeLaSortie(o).map((j) => (
                    <div key={j.id} className="text-xs text-slate-600 mt-1">⏳ Vous avez dit le {dFR(j.le)} : « {j.texte} »</div>
                  ))}
                  {tard && (
                    <div className="mt-2">
                      <Field label={just ? "Ajouter une explication" : "Pourquoi l'outil n'est pas encore rentré"}>
                        <input className={inputCls} value={texte[o.id] || ""} onChange={(e) => setTexte({ ...texte, [o.id]: e.target.value })} placeholder="Le chantier a pris du retard…" />
                      </Field>
                      <button onClick={() => justifier(b, o)} className={`${btnDark} mt-2`}>Envoyer l'explication</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function Outillage({ db, save, profile }) {
  const premiere = boutiqueParDefaut(db, profile, { ecran: "outillage" });
  const [bq, setBq] = useState(profile.boutique || premiere);
  const boutique = boutiqueRetenue(db, profile, bq, { ecran: "outillage" });
  const [f, setF] = useState(sortieVide);
  const [neuf, setNeuf] = useState(null);      // formulaire « ➕ Ajouter un outil »
  const [q, setQ] = useState("");
  const [appel, setAppel] = useState(null);    // { vus: Set } pendant l'appel
  // ⚠ Timo, 18/09/2026 : « à qui on rend l'outil n'est pas mentionné ». La
  // personne était enregistrée mais invisible. UN clic sur la ligne ouvre
  // l'histoire de l'outil — la règle du dépliage de 💰 Ventes et 📋 Dettes.
  const [outilDeplie, setOutilDeplie] = useState("");
  // ⚠ Timo, 18/09/2026 (capture des carrés) : « lorsqu'on clique dessus » —
  // chaque carré ouvre SA liste, avec les colonnes qui répondent à SA
  // question. « Dehors » d'office : c'est ce qu'on regarde tous les jours.
  const [vue, setVue] = useState("dehors");
  const [repar, setRepar] = useState(null); // { outil_id, reparateur, tel, panne, prix }
  const jeSuisAdmin = profile.role === "admin";
  const jePeux = peutTenirOutillage(profile);

  // Un technicien sans l'étoile ⭐ : son interface à lui, et rien d'autre.
  if (!jePeux && ["technicien", "technicien_bmi"].includes(profile.role)) {
    return <MesOutils db={db} save={save} profile={profile} />;
  }
  if (!boutique) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;

  const fiche = (db.boutiques || []).find((b) => b.nom === boutique) || null;
  const jour = today();
  const resume = fiche ? resumeOutillage(fiche, jour) : { total: 0, dehors: 0, retard: 0, reparation: 0, perdus: 0, valeurPerdue: 0 };
  const tous = fiche ? outilsDe(fiche) : [];
  const manquants = fiche ? manquantsDuDernierAppel(fiche) : [];
  // Les personnes de l'espace regardé, actives : un outil sort au nom de
  // l'une d'elles, jamais d'un nom tapé à la main.
  const personnes = utilisateursDeLEspace(db, profile)
    .filter((u) => u.actif !== false && u.role !== "client")
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));

  // Une écriture du registre ne touche QUE la fiche de sa boutique.
  const ecrire = (boutiqueApres, journal, extra = {}) => save({
    ...db, ...extra,
    boutiques: (db.boutiques || []).map((b) => (b.id === boutiqueApres.id ? boutiqueApres : b)),
  }, journal);

  const garde = () => {
    if (bloquerSiLecture(db, profile)) return true;
    // ⚠ Revérifié DANS le geste, comme toute règle de rôle de l'application.
    if (!peutTenirOutillage(profile)) { uAlert(REFUS_ROLE); return true; }
    return false;
  };

  // ---- ➕ Ajouter un outil (administrateur seul : c'est du matériel acheté)
  const ajouter = async () => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Ajouter un outil au registre")) return;
    const refus = critiqueNouvelOutil(fiche, neuf);
    if (refus) { uAlert(refus); return; }
    const o = nouvelOutil({ id: uid(), ...neuf, le: jour, par_id: profile.id, par: profile.nom });
    ecrire(ajouterOutil(fiche, o), `🧰 Outil ajouté — ${o.nom}${o.numero ? ` (N° ${o.numero})` : ""} (${boutique})`);
    setNeuf(null);
  };

  // ---- 📤 SORTIE : l'outil part sous le nom de quelqu'un
  const sortir = async () => {
    if (garde()) return;
    const outil = f.outil_id ? tous.find((o) => o.id === f.outil_id) : outilSaisi(fiche, f.saisie);
    const refus = critiqueSortie(outil, { user_id: f.user_id, retour_prevu: f.retour_prevu });
    if (refus) { uAlert(refus); return; }
    const p = personnes.find((u) => u.id === f.user_id);
    if (!p) { uAlert("Cette personne est introuvable dans l'espace regardé."); return; }
    const apres = sortirOutil(outil, {
      id: uid(), le: jour, user_id: p.id, user: p.nom,
      chantier: f.chantier, retour_prevu: f.retour_prevu, par_id: profile.id, par: profile.nom,
    });
    const messages = p.id !== profile.id
      ? [nouveauMessage(profile, { a_id: p.id, texte: `🧰 Vous répondez de « ${outil.nom} »${outil.numero ? ` (N° ${outil.numero})` : ""}, sorti le ${dFR(jour)}${f.chantier ? ` pour ${f.chantier}` : ""}. Retour attendu le ${dFR(f.retour_prevu)}.` })]
      : [];
    ecrire(remplacerOutil(fiche, apres), `🧰 Sortie — ${outil.nom} chez ${p.nom}, retour le ${dFR(f.retour_prevu)} (${boutique})`, messages.length ? { messages: [...(db.messages || []), ...messages] } : {});
    setF(sortieVide);
  };

  // ---- 📥 RETOUR : dans quel état l'outil rentre-t-il
  const rendre = async (outil) => {
    if (garde()) return;
    const refus = critiqueRetour(outil);
    if (refus) { uAlert(refus); return; }
    const etat = await uConfirm(`« ${outil.nom} » vous est rendu — reçu par ${profile.nom}.\n\nRevient-il en bon état ?\n\nOK = bon état · Annuler = abîmé`);
    const note = etat ? "" : (await uPrompt("Qu'est-ce qui est abîmé ?", "")) || "";
    const apres = rendreOutil(outil, { id: uid(), le: jour, etat: etat ? "bon" : "abime", note, par_id: profile.id, par: profile.nom });
    ecrire(remplacerOutil(fiche, apres), `🧰 Retour — ${outil.nom} rendu à ${profile.nom}${etat ? "" : ` (ABÎMÉ : ${note})`} (${boutique})`);
  };

  // ---- 🔧 RÉPARATION : chez QUI, son NUMÉRO, la PANNE, le PRIX (Timo,
  // 18/09/2026). ⚠ Le prix est une INFORMATION portée par l'outil : il
  // n'écrit AUCUNE dépense — créer une charge sans que Timo l'ait demandé
  // toucherait ses comptes.
  const enregistrerReparation = async () => {
    if (garde()) return;
    const outil = tous.find((o) => o.id === repar.outil_id);
    if (!outil) { uAlert("Cet outil est introuvable."); return; }
    const refus = critiqueReparation(repar);
    if (refus) { uAlert(refus); return; }
    const apres = mettreEnReparation(outil, { id: uid(), le: jour, ...repar, par_id: profile.id, par: profile.nom });
    ecrire(remplacerOutil(fiche, apres), `🧰 En réparation — ${outil.nom} chez ${repar.reparateur} (${repar.panne})${repar.prix ? ` — ${fmt(repar.prix)}` : ""} (${boutique})`);
    setRepar(null);
  };

  // ---- ⚠ PERDU (décisions « b » et « c ») : on marque, on garde la valeur
  // pour les pertes de l'année, et l'ADMINISTRATEUR peut poser une retenue
  // sur le salaire de la personne qui répondait de l'outil.
  const perdre = async (outil) => {
    if (garde()) return;
    const resp = responsableDeLaPerte(outil);
    const motif = await uPrompt(`Déclarer « ${outil.nom} » PERDU.${resp ? `\n\nIl était sous la responsabilité de ${resp.nom}.` : "\n\nIl était rangé en boutique : personne n'en répondait."}\n\nQue s'est-il passé ?`, "");
    if (motif === null) return;
    const refus = critiquePerte(outil, { motif });
    if (refus) { uAlert(refus); return; }
    const saisie = await uPrompt("Valeur de l'outil perdu (F) — elle entre dans les pertes de l'année :", String(valeurProposee(outil) || ""));
    if (saisie === null) return;
    const valeur = Number(saisie) || 0;
    if (!await uConfirm(`Déclarer « ${outil.nom} » perdu ?\n\nMotif : ${motif}\nValeur : ${fmt(valeur)}${resp ? `\nResponsable : ${resp.nom}` : ""}\n\nUne perte déclarée ne se défait pas.`)) return;

    const apres = declarerPerdu(outil, { id: uid(), le: jour, motif, valeur, user_id: resp ? resp.id : "", user: resp ? resp.nom : "", par_id: profile.id, par: profile.nom });
    let users = db.users || [];
    let mention = "";
    // La retenue : administrateur seul, jamais imposée — on la propose.
    if (jeSuisAdmin && resp && valeur > 0
        && await uConfirm(`Retenir ${fmt(valeur)} sur le salaire de ${resp.nom} ?\n\nOK = oui · Annuler = non, la perte reste à la charge de BMI.`)) {
      const mois = await demanderMois(`Sur quel mois de salaire retenir ${fmt(valeur)} à ${resp.nom} ?`);
      if (mois) {
        const av = { ...retenuePourOutil({ id: uid(), mois, montant: valeur, outil: outil.nom, date: jour, par: profile.nom }), outil_id: outil.id };
        users = users.map((u) => (u.id === resp.id ? { ...u, avances: [...(u.avances || []), av] } : u));
        mention = ` — retenue de ${fmt(valeur)} sur le salaire de ${resp.nom} (${mois})`;
      }
    }
    const messages = resp && resp.id !== profile.id
      ? [nouveauMessage(profile, { a_id: resp.id, texte: `🧰 « ${outil.nom} » a été déclaré PERDU le ${dFR(jour)} (${motif}).${mention ? ` Une retenue de ${fmt(valeur)} est portée sur votre salaire.` : ""}` })]
      : [];
    ecrire(remplacerOutil(fiche, apres), `🧰 PERDU — ${outil.nom} : ${motif} (${fmt(valeur)})${mention} (${boutique})`,
      { users, ...(messages.length ? { messages: [...(db.messages || []), ...messages] } : {}) });
  };

  const reformer = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Réformer un outil")) return;
    const motif = await uPrompt(`Réformer « ${outil.nom} » : il sort du matériel de travail (usé, cassé). Pourquoi ?`, "");
    if (motif === null || !motif.trim()) return;
    const apres = reformerOutil(outil, { id: uid(), le: jour, motif, par_id: profile.id, par: profile.nom });
    ecrire(remplacerOutil(fiche, apres), `🧰 Réformé — ${outil.nom} : ${motif} (${boutique})`);
  };

  // ---- 📋 L'APPEL DE LA SEMAINE
  const ouvrirAppel = () => {
    if (garde()) return;
    // Ce qui est SORTI n'est pas sous la main : on ne le coche pas d'office.
    setAppel({ vus: new Set(outilsVivants(fiche).filter((o) => etatOutil(o) === "en_boutique").map((o) => o.id)) });
  };
  const basculerVu = (id) => setAppel((a) => {
    const vus = new Set(a.vus);
    if (vus.has(id)) vus.delete(id); else vus.add(id);
    return { vus };
  });
  const enregistrerAppel = async () => {
    if (garde()) return;
    const a = construireAppel({ id: uid(), jour, presents: [...appel.vus], par_id: profile.id, par: profile.nom, boutique: fiche });
    if (!await uConfirm(`Enregistrer l'appel de la semaine du ${dFR(a.semaine)} ?\n\n✅ Sous la main : ${a.presents.length}\n❓ Pas vus : ${a.absents.length}\n\nUn appel est une photo : il ne se corrige pas.`)) return;
    ecrire(ajouterAppel(fiche, a), `🧰 Appel de l'outillage — semaine du ${dFR(a.semaine)} : ${a.presents.length} vus, ${a.absents.length} manquants (${boutique})`);
    setAppel(null);
  };

  // La liste de la vue choisie ; la recherche ne s'applique qu'au registre.
  const affichee = fiche
    ? outilsDeLaVue(fiche, vue, jour).filter((o) => vue !== "tous" || !q.trim() || correspond(`${o.nom} ${o.numero || ""} ${o.categorie || ""}`, q))
    : [];
  const coutRep = fiche ? coutReparations(fiche, null) : 0;
  const pertes = fiche ? pertesDe(fiche, null) : [];
  const dejaFait = fiche ? appelDeLaSemaine(fiche, jour) : null;

  return (
    <div className="space-y-4">
      <BoutiqueTabs db={db} profile={profile} value={bq} onChange={setBq} ecran="outillage" />
      <Panel boutique={boutique}>
        {/* ⚠ Timo, 18/09/2026 : chaque carré s'OUVRE. Le carré choisi porte
            un cadre épais — on doit voir lequel on regarde. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["tous", "Outils", resume.total, "neutre"],
            ["dehors", "Dehors", resume.dehors, resume.dehors ? "attente" : "neutre"],
            ["retard", "En retard", resume.retard, resume.retard ? "du" : "neutre"],
            ["reparation", "En réparation", resume.reparation, resume.reparation ? "attente" : "neutre"],
          ].map(([id, label, valeur, nature]) => (
            <button key={id} type="button" onClick={() => { setVue(id); setOutilDeplie(""); }}
              title={`Voir : ${label}`}
              className={`text-left rounded-xl transition-all ${vue === id ? "ring-4 ring-sky-600 scale-[1.02]" : "hover:ring-2 hover:ring-sky-300"}`}>
              <Stat label={label} value={valeur} nature={nature} />
            </button>
          ))}
          <Stat label="Perdus" value={`${resume.perdus} · ${fmt(resume.valeurPerdue)}`} nature={resume.perdus ? "du" : "neutre"} />
        </div>

        {/* ---- L'appel de la semaine (décision Timo : chaque semaine) ---- */}
        {jePeux && !appel && appelAFaire(fiche, jour) && (
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-3">
            <div className="text-sm font-bold text-amber-900">📋 L'appel de l'outillage n'a pas encore été fait cette semaine.</div>
            <button onClick={ouvrirAppel} className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700">Faire l'appel</button>
          </div>
        )}
        {jePeux && !appel && dejaFait && (
          <div className="mt-4 text-xs text-slate-500">
            📋 Appel de la semaine fait le {dFR(dejaFait.le)} par {dejaFait.par} — {dejaFait.presents.length} sous la main, {dejaFait.absents.length} pas vus.
            {manquants.length > 0 && <> Pas vus : <b className="text-red-700">{manquants.map((o) => o.nom).join(", ")}</b>.</>}
          </div>
        )}
        {appel && (
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-white p-3">
            <div className="font-bold text-slate-800 mb-1">📋 Appel de l'outillage — semaine du {dFR(jour)}</div>
            <div className="text-xs text-slate-500 mb-3">Cochez ce que vous avez sous la main. Ce qui n'est pas coché reste dehors et se voit. Un outil sorti n'est pas coché d'office : il est chez quelqu'un.</div>
            <div className="max-h-80 overflow-auto border rounded-lg divide-y">
              {outilsVivants(fiche).map((o) => {
                const d = detenteurOutil(o);
                return (
                  <label key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={appel.vus.has(o.id)} onChange={() => basculerVu(o.id)} />
                    <span className="font-semibold text-slate-800">{o.nom}</span>
                    {o.numero && <span className="text-xs text-slate-500">N° {o.numero}</span>}
                    {d && <span className="text-xs text-sky-700">chez {d.nom}</span>}
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={enregistrerAppel} className={btnDark}>Enregistrer l'appel</button>
              <button onClick={() => setAppel(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
            </div>
          </div>
        )}

        {/* ---- LA VUE CHOISIE : une liste, ses colonnes, ses gestes ---- */}
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <div className="font-bold text-slate-800">{TITRE_VUE[vue]} ({affichee.length})</div>
            {vue === "tous" && <input className={`${inputCls} max-w-xs`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un outil…" />}
            {vue === "tous" && jeSuisAdmin && !neuf && <button onClick={() => setNeuf(outilVide)} className="px-3 py-1.5 rounded-lg border-2 border-sky-700 text-sky-800 font-bold text-sm hover:bg-sky-50">➕ Ajouter un outil</button>}
            {vue === "reparation" && coutRep > 0 && <span className="text-xs text-slate-600">Réparations payées jusqu'ici : <b>{fmt(coutRep)}</b> — <i>pour information : aucune dépense n'est enregistrée</i></span>}
          </div>

          {vue === "tous" && neuf && (
            <div className="rounded-xl border-2 border-sky-300 bg-white p-3 mb-3">
              <div className="grid md:grid-cols-5 gap-3">
                <Field label="Nom de l'outil"><input className={inputCls} value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} placeholder="Perceuse BOSCH" autoFocus /></Field>
                <Field label="Numéro gravé"><input className={inputCls} value={neuf.numero} onChange={(e) => setNeuf({ ...neuf, numero: e.target.value })} placeholder="BMI-012" /></Field>
                <Field label="Catégorie"><input className={inputCls} value={neuf.categorie} onChange={(e) => setNeuf({ ...neuf, categorie: e.target.value })} placeholder="Électroportatif" /></Field>
                <Field label="Acheté le"><input type="date" className={inputCls} value={neuf.achete_le} onChange={(e) => setNeuf({ ...neuf, achete_le: e.target.value })} /></Field>
                <Field label="Prix d'achat (F)"><input type="number" className={inputCls} value={neuf.prix_achat} onChange={(e) => setNeuf({ ...neuf, prix_achat: e.target.value })} /></Field>
              </div>
              <div className="text-xs text-slate-500 mt-2">Le numéro est celui que vous GRAVEZ sur l'outil : il se tape à la sortie, même sale. Le prix d'achat sert de valeur proposée le jour où l'outil est perdu.</div>
              <div className="flex gap-2 mt-3">
                <button onClick={ajouter} className={btnDark}>Ajouter</button>
                <button onClick={() => setNeuf(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
              </div>
            </div>
          )}

          {/* 🔧 Le formulaire de réparation : chez qui, son numéro, la panne, le prix */}
          {repar && (
            <div className="rounded-xl border-2 border-amber-300 bg-white p-3 mb-3">
              <div className="font-bold text-slate-800 mb-2">🔧 « {(tous.find((o) => o.id === repar.outil_id) || {}).nom} » part en réparation</div>
              <div className="grid md:grid-cols-4 gap-3">
                <Field label="Chez quel réparateur"><input className={inputCls} value={repar.reparateur} onChange={(e) => setRepar({ ...repar, reparateur: e.target.value })} placeholder="ATELIER KODJO" autoFocus /></Field>
                <Field label="Son numéro"><input className={inputCls} value={repar.tel} onChange={(e) => setRepar({ ...repar, tel: e.target.value })} placeholder="90 11 22 33" /></Field>
                <Field label="La panne"><input className={inputCls} value={repar.panne} onChange={(e) => setRepar({ ...repar, panne: e.target.value })} placeholder="Charbons usés" /></Field>
                <Field label="Prix de réparation (F)"><input type="number" className={inputCls} value={repar.prix} onChange={(e) => setRepar({ ...repar, prix: e.target.value })} placeholder="Si déjà connu" /></Field>
              </div>
              <div className="text-xs text-slate-500 mt-2">Le prix reste une information portée par l'outil : <b>aucune dépense n'est enregistrée</b>. Si vous voulez qu'elle passe dans 📤 Dépenses, dites-le-moi.</div>
              <div className="flex gap-2 mt-3">
                <button onClick={enregistrerReparation} className={btnDark}>Enregistrer</button>
                <button onClick={() => setRepar(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
              </div>
            </div>
          )}

          {affichee.length === 0 ? (
            <div className="text-sm text-slate-500">{VIDE_VUE[vue]}</div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[30rem]">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className={`px-3 py-2 ${enTeteFige()}`}>Outil</th>
                    {vue === "tous" && <><th className="px-3 py-2">N°</th><th className="px-3 py-2">Catégorie</th><th className="px-3 py-2">État</th><th className="px-3 py-2">Chez qui / rendu à</th><th className="px-3 py-2 text-right">Prix d'achat</th></>}
                    {vue === "dehors" && <><th className="px-3 py-2">Chez qui</th><th className="px-3 py-2">Chantier</th><th className="px-3 py-2">Depuis</th><th className="px-3 py-2">Retour prévu</th></>}
                    {vue === "retard" && <><th className="px-3 py-2">Chez qui</th><th className="px-3 py-2">Retour prévu</th><th className="px-3 py-2">Retard</th><th className="px-3 py-2">Pourquoi ce n'est pas rentré</th></>}
                    {vue === "reparation" && <><th className="px-3 py-2">Chez quel réparateur</th><th className="px-3 py-2">Son numéro</th><th className="px-3 py-2">La panne</th><th className="px-3 py-2 text-right">Prix</th><th className="px-3 py-2">Depuis</th></>}
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {affichee.map((o, i) => {
                    const etat = etatOutil(o);
                    const d = detenteurOutil(o);
                    const so = sortieEnCours(o);
                    const rep = reparationEnCours(o);
                    const rendu = dernierRetour(o);
                    const just = derniereJustification(o);
                    const tard = enRetard(o, jour);
                    const deplie = outilDeplie === o.id;
                    const fond = deplie ? "bg-sky-200" : (vue !== "tous" && tard ? "bg-red-50" : (i % 2 ? "bg-slate-50/60" : "bg-white"));
                    return (
                      <Fragment key={o.id}>
                      <tr className={`cursor-pointer ${deplie ? classeLigneDepliable(true, i) : (vue !== "tous" && tard ? "bg-red-50 hover:bg-red-100" : classeLigneDepliable(false, i))}`}
                        onClick={() => setOutilDeplie(deplie ? "" : o.id)} title="Cliquez pour voir l'histoire de cet outil">
                        <td className={`px-3 py-2 font-semibold ${celluleFigee(fond, deplie)}`}>{o.nom}{o.numero && <div className="text-xs font-normal text-slate-500">N° {o.numero}</div>}</td>

                        {vue === "tous" && <>
                          <td className="px-3 py-2 text-slate-600">{o.numero || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{o.categorie || "—"}</td>
                          <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${(ETATS_OUTIL[etat] || {}).teinte || ""}`}>{libelleEtat(etat)}</span></td>
                          <td className="px-3 py-2">{d ? <>{d.nom}</> : rendu ? <span className="text-slate-600">rendu à <b>{rendu.par || "—"}</b><div className="text-xs text-slate-500">le {dFR(rendu.le)}</div></span> : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.prix_achat ? fmt(o.prix_achat) : "—"}</td>
                        </>}

                        {vue === "dehors" && <>
                          <td className="px-3 py-2 font-semibold">{so.user}<div className="text-xs font-normal text-slate-500">remis par {so.par || "—"}</div></td>
                          <td className="px-3 py-2 text-slate-600">{so.chantier || "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{dFR(so.le)}<div className="text-xs text-slate-500">{joursDehors(o, jour)} j</div></td>
                          <td className={`px-3 py-2 tabular-nums ${tard ? "text-red-700 font-bold" : ""}`}>{so.retour_prevu ? dFR(so.retour_prevu) : "—"}{tard && <div className="text-xs">⚠ en retard</div>}</td>
                        </>}

                        {vue === "retard" && <>
                          <td className="px-3 py-2 font-semibold">{so.user}</td>
                          <td className="px-3 py-2 tabular-nums text-red-700 font-bold">{dFR(so.retour_prevu)}</td>
                          <td className="px-3 py-2 tabular-nums text-red-700 font-bold">{joursDeRetard(o, jour)} j</td>
                          <td className="px-3 py-2">
                            {just
                              ? <span className="text-slate-800">{just.texte}<div className="text-xs text-slate-500">dit par {just.par} le {dFR(just.le)}</div></span>
                              : <span className="text-red-700 font-semibold">⏳ Pas encore justifié</span>}
                          </td>
                        </>}

                        {vue === "reparation" && <>
                          <td className="px-3 py-2 font-semibold">{(rep && rep.reparateur) || "—"}</td>
                          <td className="px-3 py-2">
                            {rep && rep.tel ? (
                              <span className="inline-flex items-center gap-2">{rep.tel}
                                <button title="Écrire sur WhatsApp" onClick={(e) => { e.stopPropagation(); envoyerWhatsApp(chiffresTel(rep.tel), ""); }} className={boutonAction("border-emerald-300 hover:bg-emerald-50")}><IconeWhatsApp taille={14} /></button>
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{(rep && rep.panne) || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{rep && rep.prix ? fmt(rep.prix) : "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{rep ? dFR(rep.le) : "—"}</td>
                        </>}

                        <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {jePeux && (etat === "sorti" || etat === "reparation") && <button title={etat === "reparation" ? "Revenu de réparation" : "Retour en boutique"} onClick={() => rendre(o)} className={`${boutonAction("border-emerald-300 text-emerald-700 hover:bg-emerald-50")} mr-1`}>📥</button>}
                          {jePeux && etat === "en_boutique" && <button title="Partir en réparation" onClick={() => setRepar({ outil_id: o.id, reparateur: "", tel: "", panne: "", prix: "" })} className={`${boutonAction("border-amber-300 text-amber-700 hover:bg-amber-50")} mr-1`}>🔧</button>}
                          {jePeux && !["perdu", "reforme"].includes(etat) && <button title="Déclarer perdu" onClick={() => perdre(o)} className={`${boutonAction("border-red-300 text-red-700 hover:bg-red-50")} mr-1`}>⚠</button>}
                          {jeSuisAdmin && !["perdu", "reforme"].includes(etat) && <button title="Réformer (usé, cassé)" onClick={() => reformer(o)} className={boutonAction("border-slate-300 text-slate-600 hover:bg-slate-100")}>🗑</button>}
                        </td>
                      </tr>
                      {deplie && (
                        <tr className="bg-sky-50">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-xs font-bold text-sky-900 mb-2">🕘 Histoire de « {o.nom} »{o.numero ? ` — N° ${o.numero}` : ""}</div>
                            {o.categorie || o.achete_le || o.prix_achat ? (
                              <div className="text-xs text-slate-600 mb-2">
                                {o.categorie && <>Catégorie : <b>{o.categorie}</b> · </>}
                                {o.achete_le && <>acheté le <b>{dFR(o.achete_le)}</b> · </>}
                                {o.prix_achat ? <>prix d'achat <b>{fmt(o.prix_achat)}</b></> : null}
                              </div>
                            ) : null}
                            {justificationsDeLaSortie(o).length > 0 && (
                              <div className="text-sm mb-2">
                                {justificationsDeLaSortie(o).map((j) => (
                                  <div key={j.id} className="text-slate-700">⏳ <b>{j.par}</b> le {dFR(j.le)} : {j.texte}</div>
                                ))}
                              </div>
                            )}
                            {histoireOutil(o).length === 0 ? (
                              <div className="text-sm text-slate-500">Cet outil n'a encore jamais bougé.</div>
                            ) : (
                              <div className="space-y-1">
                                {histoireOutil(o).map((h) => (
                                  <div key={h.id} className="text-sm flex flex-wrap gap-x-2 items-baseline">
                                    <span className="tabular-nums text-slate-500 w-24 shrink-0">{dFR(h.le)}</span>
                                    <span className="font-bold text-slate-800 w-28 shrink-0">{h.quoi}</span>
                                    <span className="text-slate-800"><span className="text-slate-500">{h.role}</span> <b>{h.qui}</b></span>
                                    {h.detail && <span className="text-slate-600">— {h.detail}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ---- Sortir un outil ---- */}
        {jePeux && (
          <div className="mt-5 rounded-xl border bg-slate-50 p-3">
            <div className="font-bold text-slate-800 mb-2">📤 Sortir un outil</div>
            <div className="grid md:grid-cols-4 gap-3">
              <Field label="Outil">
                <ChampSuggestions
                  valeur={f.saisie}
                  onChange={(v) => setF({ ...f, saisie: v, outil_id: "" })}
                  onChoisir={(p) => setF({ ...f, saisie: p.valeur, outil_id: p.outil_id })}
                  suggestions={propositionsOutils(fiche)}
                  placeholder="Nom ou numéro gravé…"
                />
              </Field>
              <Field label="Qui le prend">
                <select className={inputCls} value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {personnes.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                </select>
              </Field>
              <Field label="Chantier (facultatif)">
                <input className={inputCls} value={f.chantier} onChange={(e) => setF({ ...f, chantier: e.target.value })} placeholder="Où part l'outil" />
              </Field>
              <Field label="Retour prévu le">
                <input type="date" className={inputCls} value={f.retour_prevu} onChange={(e) => setF({ ...f, retour_prevu: e.target.value })} />
              </Field>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {(() => {
                const o = f.outil_id ? tous.find((x) => x.id === f.outil_id) : outilSaisi(fiche, f.saisie);
                if (o) return <>✓ <b>{o.nom}</b>{o.numero ? ` — N° ${o.numero}` : ""} · {libelleEtat(etatOutil(o))}</>;
                if (f.saisie.trim()) return <span className="text-amber-700">Aucun outil du registre ne porte ce nom ni ce numéro — cliquez une proposition.</span>;
                return "Un outil est toujours sous le nom de quelqu'un : c'est cette personne qui en répond.";
              })()}
            </div>
            <button onClick={sortir} className={`${btnDark} mt-3`}>📤 Enregistrer la sortie</button>
          </div>
        )}

        {/* ---- Les pertes (décision « c ») ---- */}
        {pertes.length > 0 && (
          <div className="mt-5">
            <div className="font-bold text-slate-800 mb-2">💸 Pertes — {fmt(resume.valeurPerdue)} au total</div>
            <div className="border rounded-lg overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr className="text-left"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Outil</th><th className="px-3 py-2">Responsable</th><th className="px-3 py-2">Motif</th><th className="px-3 py-2 text-right">Valeur</th></tr>
                </thead>
                <tbody>
                  {pertes.map((l, i) => (
                    <tr key={i} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
                      <td className="px-3 py-2 tabular-nums">{dFR(l.le)}</td>
                      <td className="px-3 py-2 font-semibold">{l.outil}{l.numero && <span className="text-xs font-normal text-slate-500"> · N° {l.numero}</span>}</td>
                      <td className="px-3 py-2">{l.user || "—"}</td>
                      <td className="px-3 py-2 text-slate-600">{l.motif}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-red-700">{fmt(l.valeur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!jePeux && <div className="mt-4 text-xs text-slate-500">Vous consultez le registre. {REFUS_ROLE.replace("🔒 ", "")}</div>}
      </Panel>
    </div>
  );
}
