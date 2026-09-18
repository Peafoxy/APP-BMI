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
import { fmt, dFR, today, uid, nouveauMessage, envoyerWhatsApp, totalVente } from "../lib/core";
import { chiffresTel } from "../lib/identiteClient";
import { ficheParId } from "../lib/banques";
import { Field, inputCls, btnDark, Panel, Stat, uAlert, uConfirm, uPrompt, uChoix, demanderMois, AucuneBoutique, boutonAction, enTeteFige, celluleFigee, classeLigneDepliable, IconeWhatsApp, champRecherche } from "../components/ui";
import { ChampSuggestions } from "../components/ChampSuggestions";
import { correspond } from "../lib/suggestions";
// ⚠ La dépense de réparation passe par LA fabrique des dépenses : validation
// du DG au-delà du seuil, origine des fonds, blocage de clôture. On ne
// recopie aucune de ces règles ici.
import { construireDepenseSaisie, optionsPayeAvec, interpreterPayeAvec, libelleChoixPayeAvec, PAYE_AVEC_CAISSE, SEUIL_VALIDATION_DEPENSE } from "../lib/validationDepenses";
import { critiqueSortieTiroir, fondsAVerser } from "../lib/versements";
import { CATEGORIE_REPARATION_OUTIL, MOYENS_ENCAISSEMENT } from "../lib/constants";
import { bloquerSiLecture, refuserSaufAdmin, refuserSaufAdminPrincipal, estAdminPrincipal, estCompteFormation, utilisateursDeLEspace, boutiquesVisibles, chantiersOuvertsPourOutil } from "../lib/calculs";
import {
  ETATS_OUTIL, peutTenirOutillage, outilsDe, outilsVivants, etatOutil, libelleEtat,
  detenteurOutil, sortieEnCours, enRetard, joursDehors, critiqueSortie, sortirOutil, critiqueRetour,
  rendreOutil, mettreEnReparation, critiquePerte, responsableDeLaPerte, valeurProposee, declarerPerdu,
  reformerOutil, retenuePourOutil, pertesDe, appelAFaire, appelDeLaSemaine, construireAppel,
  manquantsDuDernierAppel, resumeOutillage, propositionsOutils, outilSaisi, critiqueNouvelOutil, reformeDe,
  contenuDe, estBoite, nbContenu, critiqueLigneContenu, ajouterLigneContenu, retirerLigneContenu,
  dernierComptage, comptageDeLaSortie, critiqueComptage, compterBoite, manquesDuComptage, manquesEnCours,
  peutCompterBoite, valeurDuManque, perteDuContenu, responsableDuComptage, manquesADeclarer,
  outilRange, critiqueOutilRange, critiqueSuppressionOutil, supprimerOutil, restaurerOutil, mouvementsDe,
  supprimesDe, critiqueBasculeBoite, basculerBoite, changerLigneContenu,
  critiqueCorrectionOutil, corrigerOutil, diffFiche,
  nouvelOutil, remplacerOutil, ajouterOutil, ajouterAppel, histoireOutil, dernierRetour,
  outilsDeLaVue, critiqueReparation, reparationEnCours, doitJustifier, critiqueJustification,
  justifierRetard, derniereJustification, justificationsDeLaSortie, mesOutils, coutReparations, joursDeRetard,
  marquerDepenseReparation, depenseDeLaReparation, libelleDepenseReparation,
  registreUnifie, lieuxDuRegistre, lieuDeRangement, lieuOutil, outilsDuLieu,
  lieuDeLaPersonne, lieuxSansAppel,
  perteDe, aRembourser, dejaRetenu, resteARetenir, retenuesDe, modeRetenue, libelleRetenue,
  chantierEnCours, peutChangerChantier, critiqueChangementChantier, changerChantier, chantiersDeLaSortie,
  critiqueRetenue, critiqueARembourser, ajouterRetenue, fixerARembourser,
} from "../lib/outillage";

// Les CINQ vues de Timo (18/09/2026), leurs titres et ce qu'on dit quand
// elles sont vides.
const TITRE_VUE = {
  tous: "📒 Le registre",
  dehors: "🧰 Ce qui est dehors",
  retard: "⏰ En retard",
  reparation: "🔧 En réparation",
  perdus: "⚠ Perdus et 🗑 hors d'usage",
};
const VIDE_VUE = {
  tous: "Aucun outil au registre.",
  dehors: "Tout le matériel est rentré.",
  retard: "Aucun outil en retard : tout ce qui est dehors doit encore revenir.",
  reparation: "Aucun outil chez un réparateur.",
  perdus: "Aucun outil perdu, aucun outil hors d'usage. C'est le but du registre.",
};
// 🏗 CHANGER LE CHANTIER D'UN OUTIL SANS LE RAMENER (Timo, 18/09/2026 :
// « aujourd'hui il finit le chantier A, il n'a pas besoin de ramener l'outil
// avant d'aller sur le chantier B… il peut juste changer le chantier dans son
// espace »). Écrit UNE fois : le registre s'en sert, et l'espace du détenteur
// aussi. Un chantier TERMINÉ n'est plus proposé ; un nom tapé passe toujours.
const LIBRE = "✏️ Saisir un chantier (nom libre)";
async function nouveauChantierPour(outil, ouverts, profile, jour) {
  const noms = (ouverts || []).map((c) => `${c.type === "travaux" ? "🛠 " : ""}${c.nom}`);
  const options = [...noms, LIBRE];
  const actuel = chantierEnCours(outil);
  const choix = await uChoix(
    `🏗 « ${outil.nom} » part maintenant sur quel chantier ?${actuel ? `\n\nEn ce moment : ${actuel}` : ""}\n\nL'outil reste chez la même personne — pas besoin de le ramener.`,
    options);
  if (choix === null) return null;
  let nom = "";
  let libre = false;
  if (choix === LIBRE) {
    const tape = await uPrompt("Nom du chantier :", actuel || "");
    if (tape === null) return null;
    nom = String(tape).trim();
    libre = true;
  } else {
    const i = noms.indexOf(choix);
    if (i < 0) return null;
    nom = ouverts[i].nom;
  }
  const refus = critiqueChangementChantier(outil, { chantier: nom, ouverts, libre });
  if (refus) { uAlert(refus); return null; }
  return { apres: changerChantier(outil, { id: uid(), le: jour, chantier: nom, par_id: profile.id, par: profile.nom }), nom };
}

const REFUS_ROLE = "🔒 Tenir le registre de l'outillage : réservé au chef des techniciens, au magasinier et à l'administrateur.";
const sortieVide = { saisie: "", outil_id: "", user_id: "", chantier: "", retour_prevu: "" };
const outilVide = { nom: "", numero: "", categorie: "", achete_le: "", prix_achat: "", lieu: "", boite: false };

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
  // 🧰 DÉCISION 2b (Timo) : celui qui rend peut compter SA boîte, pour
  // valider ce qu'il ramène. Le RETOUR reste le geste de son chef.
  const [compte, setCompte] = useState(null); // { outil_id, valeurs }
  const jour = today();
  const boutiques = boutiquesVisibles(db, profile, db.boutiques || []);
  const lignes = mesOutils(boutiques, profile.id);
  // 🏗 Il peut changer le chantier de SON outil sans le ramener (Timo).
  const chantiersOuverts = chantiersOuvertsPourOutil(db, profile);
  const changerLeChantier = async (b, outil) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!peutChangerChantier(outil, profile)) { uAlert("Vous ne détenez pas cet outil."); return; }
    const r = await nouveauChantierPour(outil, chantiersOuverts, profile, jour);
    if (!r) return;
    save({
      ...db,
      boutiques: (db.boutiques || []).map((x) => (x.id === b.id ? remplacerOutil(b, r.apres) : x)),
    }, `🏗 ${outil.nom} — chantier changé pour ${r.nom} par ${profile.nom}`);
  };
  const aJustifier = lignes.filter(({ outil }) => doitJustifier(outil, profile.id, jour));

  const compterMaBoite = (b, outil) => {
    if (bloquerSiLecture(db, profile)) return;
    if (!peutCompterBoite(outil, profile)) { uAlert("Vous ne détenez pas cette boîte."); return; }
    const refus = critiqueComptage(outil, compte.valeurs);
    if (refus) { uAlert(refus); return; }
    const apres = compterBoite(outil, { id: uid(), le: jour, compte: compte.valeurs, par_id: profile.id, par: profile.nom });
    const manques = manquesDuComptage(apres, dernierComptage(apres));
    save({
      ...db,
      boutiques: (db.boutiques || []).map((x) => (x.id === b.id ? remplacerOutil(b, apres) : x)),
    }, `🧰 Boîte comptée — ${outil.nom} par ${profile.nom} : ${manques.length ? `il manque ${manques.map((m) => `${m.manque} ${m.nom}`).join(", ")}` : "tout y était"} (${b.nom})`);
    setCompte(null);
  };

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
                  <div className="font-bold text-slate-800">{o.nom}{o.numero ? ` — N° ${o.numero}` : ""} <span className="text-xs font-normal text-slate-500">(à rendre à {lieuDeRangement(o, b.nom)})</span></div>
                  <div className="text-sm text-slate-600 mt-1">
                    Pris le <b>{dFR(s.le)}</b>{chantierEnCours(o) ? <> pour <b>{chantierEnCours(o)}</b></> : null} · remis par <b>{s.par || "—"}</b>
                    {s.retour_prevu && <> · retour prévu le <b className={tard ? "text-red-700" : ""}>{dFR(s.retour_prevu)}</b></>}
                    {tard && <b className="text-red-700"> — en retard de {joursDeRetard(o, jour)} jour(s)</b>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button onClick={() => changerLeChantier(b, o)} className="px-3 py-1.5 rounded-lg border-2 border-sky-700 text-sky-800 font-bold text-xs hover:bg-sky-50">
                      🏗 Changer le chantier
                    </button>
                    {estBoite(o) && compte?.outil_id !== o.id && (
                      <button onClick={() => setCompte({ outil_id: o.id, valeurs: {} })} className="px-3 py-1.5 rounded-lg border-2 border-sky-700 text-sky-800 font-bold text-xs hover:bg-sky-50">
                        🧰 Compter la boîte ({nbContenu(o)})
                      </button>
                    )}
                    <span className="text-xs text-slate-500">Vous passez sur un autre chantier ? Pas besoin de ramener l'outil.</span>
                  </div>
                  {estBoite(o) && (() => {
                    const fait = comptageDeLaSortie(o);
                    const manques = fait ? manquesDuComptage(o, fait) : [];
                    return (
                      <div className={`text-xs mt-2 ${fait ? (manques.length ? "text-red-700 font-bold" : "text-emerald-700") : "text-amber-800"}`}>
                        {!fait
                          ? "🧰 Cette boîte n'a pas encore été comptée : comptez-la avant de la rendre, elle ne rentre pas sans ça."
                          : (manques.length
                            ? `⚠ Compté le ${dFR(fait.le)} — il manque ${manques.map((m) => `${m.manque} ${m.nom}`).join(", ")}.`
                            : `✓ Compté le ${dFR(fait.le)} — tout y était.`)}
                      </div>
                    );
                  })()}
                  {compte?.outil_id === o.id && (
                    <div className="mt-2">
                      <PanneauComptage outil={o} compte={compte.valeurs} setCompte={(v) => setCompte({ ...compte, valeurs: v })}
                        pourRetour={false} onValider={() => compterMaBoite(b, o)} onAnnuler={() => setCompte(null)} />
                    </div>
                  )}
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

// ============================================================
// 🧰 LE COMPTAGE D'UNE BOÎTE — écrit UNE fois, pour les DEUX interfaces :
// celui qui tient le registre (au retour) et celui qui rend (décision 2b de
// Timo, 18/09/2026 : « aussi celui qui rend, pour qu'il valide ce qu'il
// ramène »). Une ligne par matériel, une case par quantité ; ce qui manque
// s'affiche à mesure qu'on tape, devant les deux personnes.
// ============================================================
function PanneauComptage({ outil, compte, setCompte, pourRetour, onValider, onAnnuler }) {
  const manques = manquesDuComptage(outil, { compte });
  return (
    <div className="rounded-xl border-2 border-sky-300 bg-sky-50 p-3 mb-3">
      <div className="font-bold text-slate-800 mb-1">🧰 Ce qu'il y a dans « {outil.nom} »</div>
      <div className="text-xs text-slate-600 mb-3">
        {pourRetour
          ? "Ouvrez la boîte et comptez, devant celui qui la rend : rien ne rentre sans être compté."
          : "Comptez ce que vous ramenez : votre chef le verra en recevant la boîte."}
      </div>
      <div className="space-y-2">
        {contenuDe(outil).map((l) => {
          const v = compte[l.id];
          const n = Number(v);
          const manque = String(v ?? "") !== "" && n >= 0 ? Math.max(0, Number(l.quantite || 0) - n) : 0;
          return (
            <div key={l.id} className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-slate-800 min-w-[10rem]">{l.nom}</span>
              <span className="text-xs text-slate-500">attendu : {l.quantite}</span>
              <input type="number" min="0" className={`${inputCls} sm:w-24`} value={v ?? ""}
                onChange={(e) => setCompte({ ...compte, [l.id]: e.target.value })} placeholder="combien ?" />
              {manque > 0 && <span className="text-xs font-bold text-red-700">il en manque {manque}</span>}
            </div>
          );
        })}
      </div>
      {manques.length > 0 && (
        <div className="text-sm font-bold text-red-800 mt-3">
          ⚠ Il manque : {manques.map((m) => `${m.manque} ${m.nom}`).join(", ")}.
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={onValider} className={btnDark}>{pourRetour ? "🧰 Compter et enregistrer le retour" : "🧰 Enregistrer le comptage"}</button>
        <button onClick={onAnnuler} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
      </div>
    </div>
  );
}

export function Outillage({ db, save, profile }) {
  const [f, setF] = useState(sortieVide);
  const [neuf, setNeuf] = useState(null);      // formulaire « ➕ Ajouter un outil »
  const [q, setQ] = useState("");
  // ⚠ L'appel se fait PAR LIEU (Timo, 18/09/2026) : { lieu, vus: Set }.
  const [appel, setAppel] = useState(null);
  // ⚠ Timo, 18/09/2026 : « à qui on rend l'outil n'est pas mentionné ». La
  // personne était enregistrée mais invisible. UN clic sur la ligne ouvre
  // l'histoire de l'outil — la règle du dépliage de 💰 Ventes et 📋 Dettes.
  const [outilDeplie, setOutilDeplie] = useState("");
  // ⚠ Timo, 18/09/2026 (capture des carrés) : « lorsqu'on clique dessus » —
  // chaque carré ouvre SA liste, avec les colonnes qui répondent à SA
  // question. « Dehors » d'office : c'est ce qu'on regarde tous les jours.
  const [vue, setVue] = useState("dehors");
  const [lieuFiltre, setLieuFiltre] = useState(""); // "" = tous les lieux
  const [repar, setRepar] = useState(null); // { outil_id, reparateur, tel, panne, prix, paiement, paye_avec }
  // Le retour d'un outil parti en réparation SANS dépense encore posée :
  // c'est là qu'on connaît enfin le prix payé.
  const [retourRep, setRetourRep] = useState(null); // { outil_id, prix, paiement, paye_avec }
  // 🧰 LES BOÎTES À OUTILS (Timo, 18/09/2026). Le comptage au retour est
  // OBLIGATOIRE (décision 1a) ; la liste du contenu se règle par l'admin.
  const [compter, setCompter] = useState(null);  // { outil_id, pourRetour, valeurs }
  const [contenu, setContenu] = useState(null);  // { outil_id, nom, quantite, valeur }
  // ✏️ Corriger la FICHE elle-même (Timo, 18/09/2026 : « si numéro gravé
  // est faussé, on ne peut pas laisser comme ça »).
  const [fiche, setFiche] = useState(null);     // { outil_id, nom, numero, categorie, achete_le, prix_achat }
  const jeSuisAdmin = profile.role === "admin";
  const jeSuisPrincipal = estAdminPrincipal(db, profile);
  const jePeux = peutTenirOutillage(profile);

  // Un technicien sans l'étoile ⭐ : son interface à lui, et rien d'autre.
  if (!jePeux && ["technicien", "technicien_bmi"].includes(profile.role)) {
    return <MesOutils db={db} save={save} profile={profile} />;
  }
  // ⚠ LE REGISTRE EST CELUI DE TOUTE LA MAISON (Timo, 18/09/2026) : plus de
  // pastille de boutique. Les LIEUX (boutiques + magasins de l'espace
  // regardé) ne servent plus qu'à dire OÙ est chaque outil, et à faire
  // l'appel. Le mur tient : « toute la maison » = tout l'espace REGARDÉ.
  const lieux = lieuxDuRegistre(boutiquesVisibles(db, profile, db.boutiques || []));
  if (!lieux.length) return <AucuneBoutique formation={estCompteFormation(db, profile)} />;

  const registre = registreUnifie(lieux);
  const jour = today();
  const resume = resumeOutillage(registre, jour);
  const tous = outilsDe(registre);
  // La fiche qui garde physiquement cet outil — c'est elle qu'on réécrit.
  const ficheDe = (outil) => (db.boutiques || []).find((b) => b.id === outil?._fiche) || null;
  // Les personnes de l'espace regardé, actives : un outil sort au nom de
  // l'une d'elles, jamais d'un nom tapé à la main.
  const personnes = utilisateursDeLEspace(db, profile)
    .filter((u) => u.actif !== false && u.role !== "client")
    .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));

  // Une écriture ne touche QUE la fiche qui garde l'outil. L'écran réunit
  // les registres ; la base, elle, ne bouge pas de place.
  const ecrire = (boutiqueApres, journal, extra = {}) => save({
    ...db, ...extra,
    boutiques: (db.boutiques || []).map((b) => (b.id === boutiqueApres.id ? boutiqueApres : b)),
  }, journal);
  // Le geste courant : remplacer un outil dans SA fiche.
  const ecrireOutil = (outil, apres, journal, extra = {}) => {
    const bq = ficheDe(outil);
    if (!bq) { uAlert("Cet outil n'est rattaché à aucune boutique connue."); return; }
    ecrire(remplacerOutil(bq, apres), journal, extra);
  };
  // Où l'outil est rangé, en clair, pour les journaux.
  const ou = (outil) => lieuDeRangement(outil) || "—";

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
    const refus = critiqueNouvelOutil(registre, neuf);
    if (refus) { uAlert(refus); return; }
    // ⚠ Le lieu est DEMANDÉ (plus de pastille en haut) : une boutique ou un
    // magasin — jamais « nulle part ».
    const bq = lieux.find((b) => b.nom === neuf.lieu);
    if (!bq) { uAlert("Dites où l'outil est rangé : une boutique ou un magasin."); return; }
    const o = nouvelOutil({ id: uid(), ...neuf, le: jour, par_id: profile.id, par: profile.nom });
    ecrire(ajouterOutil(bq, o), `🧰 Outil ajouté — ${o.nom}${o.numero ? ` (N° ${o.numero})` : ""} — rangé à ${bq.nom}`);
    setNeuf(null);
  };

  // ---- 📤 SORTIE : l'outil part sous le nom de quelqu'un
  const sortir = async () => {
    if (garde()) return;
    const outil = f.outil_id ? tous.find((o) => o.id === f.outil_id) : outilSaisi(registre, f.saisie);
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
    ecrireOutil(outil, apres, `🧰 Sortie — ${outil.nom} (${ou(outil)}) chez ${p.nom}, retour le ${dFR(f.retour_prevu)}`, messages.length ? { messages: [...(db.messages || []), ...messages] } : {});
    setF(sortieVide);
  };

  // ---- 📥 RETOUR : dans quel état l'outil rentre-t-il
  // ⚠ C'EST CELUI QUI REÇOIT QUI CLASSE L'OUTIL (Timo, 18/09/2026) : le
  // gérant d'une boutique le range chez lui, le magasinier au magasin. S'il
  // n'a pas de boutique attitrée (un administrateur, un chef technicien), on
  // lui DEMANDE où — décision Timo, jamais un magasin d'office.
  const lieuDuRetour = async (outil) => {
    const sien = lieuDeLaPersonne(profile, lieux);
    if (sien) return sien;
    const noms = lieux.map((b) => `${b.depot ? "🏭 " : ""}${b.nom}`);
    const choix = await uChoix(`📥 Où rangez-vous « ${outil.nom} » ?`, noms);
    if (choix === null) return null;
    const i = noms.indexOf(choix);
    return i < 0 ? null : lieux[i].nom;
  };

  // `base` porte déjà le comptage quand il s'agit d'une boîte : les deux
  // mouvements partent alors dans UNE seule écriture.
  const poserRetour = async (outil, base, mention = "") => {
    const lieu = await lieuDuRetour(outil);
    if (!lieu) return false;
    const etat = await uConfirm(`« ${outil.nom} » vous est rendu — reçu par ${profile.nom}, rangé à ${lieu}.\n\nRevient-il en bon état ?\n\nOK = bon état · Annuler = abîmé`);
    const note = etat ? "" : (await uPrompt("Qu'est-ce qui est abîmé ?", "")) || "";
    const apres = rendreOutil(base, { id: uid(), le: jour, etat: etat ? "bon" : "abime", note, lieu, par_id: profile.id, par: profile.nom });
    ecrireOutil(outil, apres, `🧰 Retour — ${outil.nom} rendu à ${profile.nom}, rangé à ${lieu}${etat ? "" : ` (ABÎMÉ : ${note})`}${mention}`);
    return true;
  };

  const rendre = async (outil) => {
    if (garde()) return;
    // ⚠ DÉCISION 1a : une boîte non comptée ne se refuse pas, elle
    // s'OUVRE — le formulaire de comptage prend la place du refus.
    if (estBoite(outil) && etatOutil(outil) === "sorti" && !comptageDeLaSortie(outil)) {
      setCompter({ outil_id: outil.id, pourRetour: true, valeurs: {} });
      return;
    }
    const refus = critiqueRetour(outil);
    if (refus) { uAlert(refus); return; }
    await poserRetour(outil, outil);
  };

  // 🧰 LE COMPTAGE — au retour (celui qui reçoit) ou seul. Il est revérifié
  // DANS le geste, comme tout ce qui est réservé.
  const validerComptage = async () => {
    if (garde()) return;
    const outil = tous.find((o) => o.id === compter.outil_id);
    if (!outil) { setCompter(null); return; }
    if (!peutCompterBoite(outil, profile)) { uAlert("Vous ne pouvez pas compter cette boîte."); return; }
    const refus = critiqueComptage(outil, compter.valeurs);
    if (refus) { uAlert(refus); return; }
    const compté = compterBoite(outil, { id: uid(), le: jour, compte: compter.valeurs, par_id: profile.id, par: profile.nom });
    const manques = manquesDuComptage(compté, dernierComptage(compté));
    const dit = manques.length ? ` — il manque ${manques.map((m) => `${m.manque} ${m.nom}`).join(", ")}` : " — tout y était";
    if (compter.pourRetour) {
      const refus2 = critiqueRetour(compté, { compte: compter.valeurs });
      if (refus2) { uAlert(refus2); return; }
      const ok = await poserRetour(outil, compté, ` · boîte comptée${dit}`);
      if (!ok) return;
    } else {
      ecrireOutil(outil, compté, `🧰 Boîte comptée — ${outil.nom} par ${profile.nom}${dit}`);
    }
    setCompter(null);
    if (manques.length) {
      await uAlert(`⚠ « ${outil.nom} » est incomplète :\n\n${manques.map((m) => `• ${m.manque} ${m.nom} (attendu ${m.attendu}, compté ${m.compte})`).join("\n")}\n\nLa boîte repartira incomplète tant que ce matériel n'est pas remplacé.${jeSuisAdmin ? "\n\nVous pouvez déclarer ce manque perdu depuis la ligne de la boîte (bouton ⚠)." : ""}`);
    }
  };

  // ---- 🏗 CHANGER LE CHANTIER, sans ramener l'outil
  const changerLeChantier = async (outil) => {
    if (garde()) return;
    if (!peutChangerChantier(outil, profile)) { uAlert(`« ${outil.nom} » n'est pas sorti : il n'y a pas de chantier à changer.`); return; }
    const r = await nouveauChantierPour(outil, chantiersOuverts, profile, jour);
    if (!r) return;
    const d = detenteurOutil(outil);
    ecrireOutil(outil, r.apres, `🏗 ${outil.nom} — chantier changé pour ${r.nom}${d ? ` (chez ${d.nom})` : ""}`);
  };

  // ---- 🔧 RÉPARATION : chez QUI, son NUMÉRO, la PANNE, le PRIX (Timo,
  // 18/09/2026). ⚠ Le prix est une INFORMATION portée par l'outil : il
  // n'écrit AUCUNE dépense — créer une charge sans que Timo l'ait demandé
  // toucherait ses comptes.
  // Le tiroir : la même limite qu'à la saisie d'une dépense (Timo, 15/09/2026)
  // — le tiroir PLUS ce qu'il reste dans l'enveloppe.
  // ⚠ Plus de « boutique regardée » : la caisse proposée pour une réparation
  // est celle du LIEU de l'outil, et le choix « Payé avec » reste entier.
  const caisseDe = (outil) => {
    const l = lieuDeRangement(outil);
    return caisses.includes(l) ? l : (lieuDeLaPersonne(profile, lieux) || caisses[0] || "");
  };
  const refusTiroir = (nomBoutique, montant, geste) => {
    const p = fondsAVerser(db, nomBoutique, totalVente);
    return critiqueSortieTiroir({ tiroir: p.montant + p.resteFonds, fondsFixe: p.resteFonds, montant, geste, boutique: nomBoutique });
  };

  // 💸 Construit la dépense d'une réparation — ou rend son refus. Elle passe
  // par LA fabrique commune : validation du DG au-delà du seuil, origine des
  // fonds, message aux principaux. Rien n'est recopié ici.
  const depensePourReparation = async ({ prix, paiement, paye_avec }, outil, rep, libelleGeste) => {
    const montant = Number(prix || 0);
    if (!montant) return { depense: null, messages: [], journal: "" };
    const caisse = caisseDe(outil);
    const choix = interpreterPayeAvec(paye_avec, caisse);
    const r = construireDepenseSaisie(db, profile, {
      ...choix, categorie: CATEGORIE_REPARATION_OUTIL,
      description: libelleDepenseReparation(outil, rep), montant, paiement,
    }, jour);
    if (r.refus) { uAlert(r.refus); return null; }
    if (paiement === "Espèces" && (!r.depense.paye_avec || r.depense.paye_avec === PAYE_AVEC_CAISSE)) {
      const refusT = refusTiroir(choix.boutique, montant, libelleGeste);
      if (refusT) { uAlert(refusT); return null; }
    }
    const suite = r.aValider ? `\n\n⏳ ${fmt(montant)} atteint ${fmt(SEUIL_VALIDATION_DEPENSE)} : la dépense ira à la validation du DG et ne comptera qu'une fois validée.` : "";
    const ailleurs = choix.boutique !== caisse ? `\n\n🏬 C'est la caisse de ${choix.boutique} qui paie : la dépense sera rangée sous ${choix.boutique}.` : "";
    if (!await uConfirm(`${libelleGeste} : enregistrer une dépense de ${fmt(montant)} en « ${CATEGORIE_REPARATION_OUTIL} », payée avec ${libelleChoixPayeAvec(paye_avec, caisse)} ?${suite}${ailleurs}`)) return null;
    return { ...r, depense: { ...r.depense, outil_id: outil.id, outil_nom: outil.nom, mouvement_id: rep.id, auto: "reparation_outil" } };
  };

  const enregistrerReparation = async () => {
    if (garde()) return;
    const outil = tous.find((o) => o.id === repar.outil_id);
    if (!outil) { uAlert("Cet outil est introuvable."); return; }
    const refus = critiqueReparation(repar);
    if (refus) { uAlert(refus); return; }
    const mvt = { id: uid(), le: jour, ...repar, par_id: profile.id, par: profile.nom };
    const d = await depensePourReparation(repar, outil, mvt, `Réparation de « ${outil.nom} »`);
    if (d === null) return;
    const apres = d.depense
      ? marquerDepenseReparation(mettreEnReparation(outil, mvt), mvt.id, d.depense.id)
      : mettreEnReparation(outil, mvt);
    ecrireOutil(outil, apres,
      `🧰 En réparation — ${outil.nom} (${ou(outil)}) chez ${repar.reparateur} (${repar.panne})${d.depense ? ` — dépense ${fmt(d.depense.montant)}` : ""}`,
      d.depense ? { depenses: [d.depense, ...(db.depenses || [])], messages: [...(d.messages || []), ...(db.messages || [])] } : {});
    setRepar(null);
  };

  // 📥 Le retour d'un outil parti en réparation, quand le prix n'avait pas
  // encore été enregistré : c'est LÀ qu'on le connaît.
  const enregistrerRetourReparation = async () => {
    if (garde()) return;
    const outil = tous.find((o) => o.id === retourRep.outil_id);
    if (!outil) { uAlert("Cet outil est introuvable."); return; }
    const rep = reparationEnCours(outil);
    if (!rep) { uAlert("Cet outil n'est plus en réparation."); return; }
    const d = await depensePourReparation(retourRep, outil, rep, `Retour de réparation de « ${outil.nom} »`);
    if (d === null) return;
    const lieu = lieuDeRangement(outil);
    const rendu = rendreOutil(outil, { id: uid(), le: jour, etat: "bon", note: "", lieu, par_id: profile.id, par: profile.nom });
    const apres = d.depense ? marquerDepenseReparation(rendu, rep.id, d.depense.id) : rendu;
    ecrireOutil(outil, apres,
      `🧰 Revenu de réparation — ${outil.nom} rendu à ${profile.nom}, rangé à ${lieu}${d.depense ? ` — dépense ${fmt(d.depense.montant)}` : ""}`,
      d.depense ? { depenses: [d.depense, ...(db.depenses || [])], messages: [...(d.messages || []), ...(db.messages || [])] } : {});
    setRetourRep(null);
  };

  // ---- ⚠ PERDU (décisions « b » et « c ») : on marque, on garde la valeur
  // pour les pertes de l'année, et l'ADMINISTRATEUR peut poser une retenue
  // sur le salaire de la personne qui répondait de l'outil.
  // ---- L'ARDOISE D'UNE PERTE, ÉCRITE UNE FOIS. Timo, 18/09/2026 : « pour
  // les salariés, c'est une retenue sur le salaire ; pour les techniciens
  // commission, c'est retenu sur commission ». Deux chemins, parce qu'il y a
  // deux façons d'être payé. Elle reste PROPOSÉE, jamais imposée : refuser =
  // la perte reste à la charge de BMI.
  // ⚠ Les DEUX pertes y passent — l'outil entier, et le matériel manquant
  // d'une boîte à outils (18/09/2026) : pas une deuxième copie de ces règles.
  const demanderCombienDu = async (resp, valeur, quoi) => {
    if (!(jeSuisAdmin && resp && valeur > 0)) return 0;
    if (!await uConfirm(`Faire rembourser cette perte à ${resp.nom} ?\n\nElle sera retenue ${libelleRetenue(modeRetenue(resp))}${modeRetenue(resp) === "commission" ? " — sur ses prochaines parts d'installation, c'est son seul revenu" : ""}.\n\nOK = oui · Annuler = non, la perte reste à la charge de BMI.`)) return 0;
    const saisie = await uPrompt(`Combien demander à ${resp.nom} ? (F)\n\nLa valeur de ${quoi} est ${fmt(valeur)} : vous pouvez demander moins.`, String(valeur));
    return saisie === null ? 0 : Math.max(0, Number(saisie) || 0);
  };

  // `fiche` arrive DÉJÀ déclarée perdue. Rend ce qu'il faut écrire, ou null
  // si la personne a abandonné en route.
  const poserArdoise = async (fiche, { resp, du, nom, motif, valeur }) => {
    const mode = modeRetenue(resp);
    let users = db.users || [];
    let mention = "";
    let retenues = [];
    let apres = fiche;
    const perte = perteDe(fiche);

    // Salarié : on peut retenir dès maintenant, en une fois ou par morceaux.
    if (du > 0 && mode === "salaire") {
      const saisieMain = await uPrompt(`Retenir combien dès maintenant sur le salaire de ${resp.nom} ? (F)\n\nLe reste pourra être retenu les mois suivants, depuis le carré « Perdus / Hors d'usage ».`, String(du));
      const maintenant = saisieMain === null ? 0 : Math.max(0, Number(saisieMain) || 0);
      const refusR = maintenant > 0 ? critiqueRetenue(perte, maintenant) : "";
      if (refusR) { uAlert(refusR); return null; }
      if (maintenant > 0) {
        const mois = await demanderMois(`Sur quel mois de salaire retenir ${fmt(maintenant)} à ${resp.nom} ?`);
        if (mois) {
          const av = { ...retenuePourOutil({ id: uid(), mois, montant: maintenant, outil: nom, date: jour, par: profile.nom }), outil_id: fiche.id };
          users = users.map((u) => (u.id === resp.id ? { ...u, avances: [...(u.avances || []), av] } : u));
          apres = ajouterRetenue(fiche, perte.id, { id: uid(), le: jour, montant: maintenant, sur: "salaire", mois, ref: `Salaire ${mois}`, par: profile.nom });
          retenues = [maintenant, mois];
          mention = ` — retenue de ${fmt(maintenant)} sur le salaire de ${resp.nom} (${mois})`;
        }
      }
    }
    if (du > 0 && mode === "commission") mention = ` — ${fmt(du)} à retenir sur ses prochaines parts d'installation`;

    const texteResp = `🧰 « ${nom} » a été déclaré PERDU le ${dFR(jour)} (${motif}).`
      + (du <= 0 ? " La perte reste à la charge de BMI."
        : mode === "commission" ? ` ${fmt(du)} vous seront retenus sur vos prochaines parts d'installation.`
        : retenues.length ? ` ${fmt(retenues[0])} sont retenus sur votre salaire de ${retenues[1]}${du > retenues[0] ? `, et ${fmt(du - retenues[0])} restent à rembourser` : ""}.`
        : ` ${fmt(du)} restent à rembourser sur votre salaire.`);
    const messages = resp && resp.id !== profile.id ? [nouveauMessage(profile, { a_id: resp.id, texte: texteResp })] : [];
    return { apres, mention, extra: { users, ...(messages.length ? { messages: [...(db.messages || []), ...messages] } : {}) }, valeur };
  };

  const perdre = async (outil) => {
    if (garde()) return;
    const resp = responsableDeLaPerte(outil);
    const motif = await uPrompt(`Déclarer « ${outil.nom} » PERDU.${resp ? `\n\nIl était sous la responsabilité de ${resp.nom}.` : "\n\nIl était rangé à ${ou(outil)} : personne n'en répondait."}\n\nQue s'est-il passé ?`, "");
    if (motif === null) return;
    const refus = critiquePerte(outil, { motif });
    if (refus) { uAlert(refus); return; }
    const saisie = await uPrompt("Valeur de l'outil perdu (F) — elle entre dans les pertes de l'année :", String(valeurProposee(outil) || ""));
    if (saisie === null) return;
    const valeur = Number(saisie) || 0;
    if (!await uConfirm(`Déclarer « ${outil.nom} » perdu ?\n\nMotif : ${motif}\nValeur : ${fmt(valeur)}${resp ? `\nResponsable : ${resp.nom}` : ""}\n\nUne perte déclarée ne se défait pas.`)) return;

    const du = await demanderCombienDu(resp, valeur, "l'outil");
    if (du === null) return;
    const fiche = declarerPerdu(outil, { id: uid(), le: jour, motif, valeur, a_rembourser: du, user_id: resp ? resp.id : "", user: resp ? resp.nom : "", par_id: profile.id, par: profile.nom });
    const r = await poserArdoise(fiche, { resp, du, nom: outil.nom, motif, valeur });
    if (!r) return;
    ecrireOutil(outil, r.apres, `🧰 PERDU — ${outil.nom} (${ou(outil)}) : ${motif} (${fmt(valeur)})${r.mention}`, r.extra);
  };

  // ---- ⚠ LE MATÉRIEL MANQUANT D'UNE BOÎTE DEVIENT UNE PERTE, par le
  // mécanisme qui existe déjà : il naît comme SA PROPRE fiche, déjà déclarée
  // perdue, sous le nom de qui détenait la boîte. Le carré « Perdus / Hors
  // d'usage », l'ardoise, la retenue sur salaire et celle sur commission
  // n'ont pas une ligne de plus à apprendre.
  const perdreContenu = async (boite) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Déclarer perdu le matériel d'une boîte")) return;
    const manques = manquesADeclarer(registre, boite);
    if (!manques.length) {
      uAlert(`Rien à déclarer pour « ${boite.nom} » : au dernier comptage, soit tout y était, soit ce qui manquait a déjà été déclaré perdu.`);
      return;
    }
    const libelles = manques.map((m) => `${m.manque} × ${m.nom} — ${fmt(valeurDuManque(m))}`);
    const choix = libelles.length === 1 ? libelles[0] : await uChoix(`Quel matériel manquant de « ${boite.nom} » déclarer perdu ?`, libelles);
    if (!choix) return;
    const m = manques[libelles.indexOf(choix)];
    if (!m) return;

    const resp = responsableDuComptage(boite);
    const motif = await uPrompt(`Déclarer perdus : ${m.manque} × ${m.nom} (de « ${boite.nom} »).${resp ? `\n\nLa boîte était sous la responsabilité de ${resp.nom}.` : "\n\nLa boîte était rangée : personne n'en répondait."}\n\nQue s'est-il passé ?`, "");
    if (motif === null) return;
    if (!String(motif).trim()) { uAlert("Dites ce qui s'est passé : une perte sans motif ne s'explique à personne."); return; }
    const saisie = await uPrompt("Valeur de ce qui manque (F) — elle entre dans les pertes de l'année :", String(valeurDuManque(m) || ""));
    if (saisie === null) return;
    const valeur = Number(saisie) || 0;
    if (!await uConfirm(`Déclarer perdus ${m.manque} × ${m.nom} ?\n\nMotif : ${motif}\nValeur : ${fmt(valeur)}${resp ? `\nResponsable : ${resp.nom}` : ""}\n\nUne perte déclarée ne se défait pas.`)) return;

    const du = await demanderCombienDu(resp, valeur, "ce matériel");
    const c = dernierComptage(boite);
    const fiche = perteDuContenu(boite, m, {
      id: uid(), mouvement_id: uid(), comptage_id: c ? c.id : "", le: jour, motif, valeur, a_rembourser: du,
      user_id: resp ? resp.id : "", user: resp ? resp.nom : "", lieu: lieuDeRangement(boite),
      par_id: profile.id, par: profile.nom,
    });
    const r = await poserArdoise(fiche, { resp, du, nom: fiche.nom, motif, valeur });
    if (!r) return;
    const bq = ficheDe(boite);
    if (!bq) { uAlert("Cette boîte n'est rattachée à aucune boutique connue."); return; }
    ecrire(ajouterOutil(bq, r.apres), `🧰 PERDU — ${r.apres.nom} : ${motif} (${fmt(valeur)})${r.mention}`, r.extra);
  };

  // ---- 🗑 SUPPRIMER un outil du registre — administrateur PRINCIPAL seul,
  // et SEULEMENT s'il est rangé (condition de Timo, 18/09/2026 : « possible
  // quand l'outil est en magasin ou boutique »). Rien n'est jeté : la fiche
  // passe dans `outillage.supprimes`, une liste qui ne rétrécit jamais, et
  // le principal peut la remettre au registre.
  const supprimer = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdminPrincipal(db, profile, "Supprimer un outil du registre")) return;
    const bloque = critiqueOutilRange(outil, "vous pourrez le supprimer");
    if (bloque) { uAlert(bloque); return; }
    const motif = await uPrompt(`Supprimer « ${outil.nom} » du registre.\n\nPourquoi ? (fiche créée par erreur, doublon…)`, "");
    if (motif === null) return;
    const refus = critiqueSuppressionOutil(outil, { motif });
    if (refus) { uAlert(refus); return; }
    const n = mouvementsDe(outil).length;
    if (!await uConfirm(`Retirer « ${outil.nom} » du registre ?\n\nMotif : ${motif}${n ? `\n\n⚠ Cette fiche porte ${n} mouvement(s) : toute son histoire part avec elle.` : ""}\n\nRien n'est jeté : vous pourrez la remettre depuis « 🗑 Fiches retirées ».`)) return;
    const bq = ficheDe(outil);
    if (!bq) { uAlert("Cet outil n'est rattaché à aucune boutique connue."); return; }
    ecrire(supprimerOutil(bq, outil, { le: jour, motif, par_id: profile.id, par: profile.nom }),
      `🧰 Fiche retirée du registre — ${outil.nom}${outil.numero ? ` (N° ${outil.numero})` : ""} : ${motif}`);
  };
  const restaurer = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdminPrincipal(db, profile, "Remettre un outil au registre")) return;
    if (!await uConfirm(`Remettre « ${outil.nom} » au registre ?`)) return;
    const bq = (db.boutiques || []).find((b) => b.id === outil._fiche);
    if (!bq) { uAlert("Cette fiche n'est rattachée à aucune boutique connue."); return; }
    ecrire(restaurerOutil(bq, outil.id), `🧰 Fiche remise au registre — ${outil.nom}`);
  };

  // ---- ✏️ CORRIGER LA FICHE : le nom, le NUMÉRO GRAVÉ, la catégorie, la
  // date et le prix d'achat. Même condition : l'outil doit être rangé.
  // ⚠ Le lieu n'y est pas : il est DÉDUIT (dernier retour, sinon création),
  // et la fiche vit dans la boutique qui la garde — un retour le repose.
  const enregistrerFiche = async () => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Corriger la fiche d'un outil")) return;
    const outil = tous.find((o) => o.id === fiche.outil_id);
    if (!outil) { setFiche(null); return; }
    const refus = critiqueCorrectionOutil(registre, outil, fiche);
    if (refus) { uAlert(refus); return; }
    const apres = corrigerOutil(outil, fiche);
    const change = diffFiche(outil, apres);
    if (!change.length) { setFiche(null); return; }
    const LIB = { nom: "nom", numero: "numéro gravé", categorie: "catégorie", achete_le: "date d'achat", prix_achat: "prix d'achat" };
    const dit = change.map((c) => `${LIB[c.champ]} : ${c.avant || "—"} → ${c.apres || "—"}`).join(" · ");
    if (!await uConfirm(`Corriger la fiche de « ${outil.nom} » ?\n\n${change.map((c) => `• ${LIB[c.champ]} : ${c.avant || "—"} → ${c.apres || "—"}`).join("\n")}\n\nSon histoire et ses mouvements ne bougent pas.`)) return;
    ecrireOutil(outil, apres, `🧰 Fiche corrigée — ${outil.nom} : ${dit}`);
    setFiche(null);
  };

  // ---- ✏️ MODIFIER UNE CAISSE : la case elle-même, et ses lignes.
  const changerCaisse = async (outil, oui) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Régler ce que contient une boîte")) return;
    const refus = critiqueBasculeBoite(outil, oui);
    if (refus) { uAlert(refus); return; }
    if (!oui && !await uConfirm(`« ${outil.nom} » ne sera plus une caisse : plus de liste, plus de comptage au retour.`)) return;
    ecrireOutil(outil, basculerBoite(outil, oui), `🧰 ${outil.nom} — ${oui ? "devient une caisse à outils" : "n'est plus une caisse à outils"}`);
  };
  const corrigerLigne = async (outil, ligne) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Régler ce que contient une boîte")) return;
    const bloque = critiqueOutilRange(outil, "vous pourrez corriger sa liste");
    if (bloque) { uAlert(bloque); return; }
    const nom = await uPrompt("Nom du matériel :", ligne.nom);
    if (nom === null) return;
    if (!String(nom).trim()) { uAlert("Donnez un nom à ce matériel."); return; }
    const q = await uPrompt(`Combien de « ${String(nom).trim()} » la caisse doit-elle contenir ?`, String(ligne.quantite));
    if (q === null) return;
    if (!(Number(q) >= 1)) { uAlert("Dites combien il y en a (au moins 1)."); return; }
    const v = await uPrompt("Valeur d'une pièce (F) — elle sert le jour où il en manque :", String(ligne.valeur || ""));
    if (v === null) return;
    ecrireOutil(outil, changerLigneContenu(outil, ligne.id, { nom: String(nom).trim(), quantite: Number(q), valeur: Number(v) || 0 }),
      `🧰 ${outil.nom} — ligne corrigée : ${String(nom).trim()} × ${Number(q)}`);
  };

  // ---- 🧰 CE QUE LA BOÎTE CONTIENT : la liste se règle par l'administrateur
  // (c'est du matériel acheté, comme l'ajout d'un outil). Un outil qui porte
  // une liste EST une boîte — pas de case à cocher de plus.
  const ajouterAuContenu = (boite) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Régler ce que contient une boîte")) return;
    const bloque = critiqueOutilRange(boite, "vous pourrez corriger sa liste");
    if (bloque) { uAlert(bloque); return; }
    const refus = critiqueLigneContenu(boite, contenu);
    if (refus) { uAlert(refus); return; }
    const apres = ajouterLigneContenu(boite, { id: uid(), nom: contenu.nom, quantite: contenu.quantite, valeur: contenu.valeur });
    ecrireOutil(boite, apres, `🧰 ${boite.nom} — ${contenu.quantite} ${contenu.nom} ajouté(s) à la liste de la boîte`);
    setContenu({ ...contenu, nom: "", quantite: "1", valeur: "" });
  };
  const retirerDuContenu = async (boite, ligne) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Régler ce que contient une boîte")) return;
    const bloque = critiqueOutilRange(boite, "vous pourrez corriger sa liste");
    if (bloque) { uAlert(bloque); return; }
    if (!await uConfirm(`Retirer « ${ligne.nom} » de la liste de « ${boite.nom} » ?\n\nOn ne le comptera plus à chaque retour.`)) return;
    ecrireOutil(boite, retirerLigneContenu(boite, ligne.id), `🧰 ${boite.nom} — ${ligne.nom} retiré de la liste de la boîte`);
  };

  // ---- ✏️ Combien lui demander : l'administrateur peut revoir l'ardoise
  // (jamais en dessous de ce qui a déjà été pris).
  const fixerMontant = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Fixer ce qu'un outil perdu doit rembourser")) return;
    const perte = perteDe(outil);
    if (!perte) { uAlert("Cet outil n'est pas déclaré perdu."); return; }
    const saisie = await uPrompt(`Combien ${perte.user || "la personne"} doit-il rembourser pour « ${outil.nom} » ? (F)\n\nValeur de l'outil : ${fmt(perte.valeur)}\nDéjà retenu : ${fmt(dejaRetenu(perte))}\n\n0 = la perte reste à la charge de BMI.`, String(aRembourser(perte) || perte.valeur || 0));
    if (saisie === null) return;
    const montant = Math.max(0, Number(saisie) || 0);
    const refus = critiqueARembourser(perte, montant);
    if (refus) { uAlert(refus); return; }
    ecrireOutil(outil, fixerARembourser(outil, perte.id, montant),
      `🧰 Outil perdu « ${outil.nom} » — à rembourser : ${fmt(montant)}`);
  };

  // ---- 💵 Retenir sur le salaire. Le technicien à COMMISSION n'a pas de
  // salaire : sa retenue se prend toute seule sur sa prochaine part — on ne
  // lui propose donc pas ce bouton, et on ne fait jamais semblant.
  const retenir = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Retenir sur un salaire")) return;
    const perte = perteDe(outil);
    if (!perte) { uAlert("Cet outil n'est pas déclaré perdu."); return; }
    const qui = perte.user_id ? ficheParId(db.users, perte.user_id) : null;
    if (!qui) { uAlert("Personne ne répondait de cet outil : il n'y a rien à retenir."); return; }
    if (modeRetenue(qui) === "commission") { uAlert(`${qui.nom} est payé à la commission : la retenue se prend toute seule sur sa prochaine part d'installation. Rien à faire ici.`); return; }
    const saisie = await uPrompt(`Retenir combien sur le salaire de ${qui.nom} ? (F)\n\nReste à payer : ${fmt(resteARetenir(perte))}`, String(resteARetenir(perte)));
    if (saisie === null) return;
    const montant = Math.max(0, Number(saisie) || 0);
    const refus = critiqueRetenue(perte, montant);
    if (refus) { uAlert(refus); return; }
    const mois = await demanderMois(`Sur quel mois de salaire retenir ${fmt(montant)} à ${qui.nom} ?`);
    if (!mois) return;
    if (!await uConfirm(`Retenir ${fmt(montant)} sur le salaire de ${qui.nom} (${mois}) pour « ${outil.nom} » ?\n\nUne retenue enregistrée ne se défait pas.`)) return;
    const av = { ...retenuePourOutil({ id: uid(), mois, montant, outil: outil.nom, date: jour, par: profile.nom }), outil_id: outil.id };
    const users = (db.users || []).map((u) => (u.id === qui.id ? { ...u, avances: [...(u.avances || []), av] } : u));
    const apres = ajouterRetenue(outil, perte.id, { id: uid(), le: jour, montant, sur: "salaire", mois, ref: `Salaire ${mois}`, par: profile.nom });
    const reste = resteARetenir(perteDe(apres));
    ecrireOutil(outil, apres, `🧰 Retenue de ${fmt(montant)} sur le salaire de ${qui.nom} (${mois}) — outil perdu « ${outil.nom} »`,
      { users, messages: [...(db.messages || []), nouveauMessage(profile, { a_id: qui.id, texte: `💵 ${fmt(montant)} sont retenus sur votre salaire de ${mois} pour l'outil perdu « ${outil.nom} ».${reste > 0 ? ` Reste à rembourser : ${fmt(reste)}.` : " Cette perte est soldée."}` })] });
  };

  const reformer = async (outil) => {
    if (garde()) return;
    if (refuserSaufAdmin(profile, "Réformer un outil")) return;
    const motif = await uPrompt(`Réformer « ${outil.nom} » : il sort du matériel de travail (usé, cassé). Pourquoi ?`, "");
    if (motif === null || !motif.trim()) return;
    const apres = reformerOutil(outil, { id: uid(), le: jour, motif, par_id: profile.id, par: profile.nom });
    ecrireOutil(outil, apres, `🧰 Réformé — ${outil.nom} (${ou(outil)}) : ${motif}`);
  };

  // ---- 📋 L'APPEL DE LA SEMAINE
  // ⚠ UN APPEL PAR LIEU (décision Timo, 18/09/2026) : personne ne peut voir
  // les outils de deux boutiques à la fois. On n'appelle que ce qui est
  // rangé LÀ.
  const outilsVivantsDuLieu = (lieu) => outilsDuLieu(registre, lieu).filter((o) => !["perdu", "reforme"].includes(etatOutil(o)));
  const ouvrirAppel = (lieu) => {
    if (garde()) return;
    // Ce qui est SORTI n'est pas sous la main : on ne le coche pas d'office.
    setAppel({ lieu, vus: new Set(outilsVivantsDuLieu(lieu).filter((o) => etatOutil(o) === "en_boutique").map((o) => o.id)) });
  };
  const basculerVu = (id) => setAppel((a) => {
    const vus = new Set(a.vus);
    if (vus.has(id)) vus.delete(id); else vus.add(id);
    return { ...a, vus };
  });
  const enregistrerAppel = async () => {
    if (garde()) return;
    const bq = lieux.find((b) => b.nom === appel.lieu);
    if (!bq) { uAlert("Ce lieu est introuvable."); return; }
    const a = construireAppel({ id: uid(), jour, presents: [...appel.vus], par_id: profile.id, par: profile.nom, lieu: appel.lieu, outils: outilsVivantsDuLieu(appel.lieu) });
    if (!await uConfirm(`Enregistrer l'appel de ${appel.lieu} — semaine du ${dFR(a.semaine)} ?\n\n✅ Sous la main : ${a.presents.length}\n❓ Pas vus : ${a.absents.length}\n\nUn appel est une photo : il ne se corrige pas.`)) return;
    ecrire(ajouterAppel(bq, a), `🧰 Appel de l'outillage — ${appel.lieu}, semaine du ${dFR(a.semaine)} : ${a.presents.length} vus, ${a.absents.length} manquants`);
    setAppel(null);
  };

  // La liste de la vue choisie ; la recherche ne s'applique qu'au registre.
  const affichee = outilsDeLaVue(registre, vue, jour)
    // 🏗 Le filtre par LIEU (demande Timo, 18/09/2026) : il vaut pour TOUTES
    // les vues. « Toutes » d'office — rien ne change tant qu'on n'y touche pas.
    .filter((o) => !lieuFiltre || lieuDeRangement(o) === lieuFiltre)
    .filter((o) => vue !== "tous" || !q.trim() || correspond(`${o.nom} ${o.numero || ""} ${o.categorie || ""} ${lieuDeRangement(o)}`, q));
  const coutRep = coutReparations(registre, null);
  // Les caisses proposables : les boutiques de l'espace regardé, comme dans
  // 📤 Dépenses — « Payé avec » nomme CHAQUE caisse (règle du 13/09/2026).
  const caisses = boutiquesVisibles(db, profile, db.boutiques || []).map((b) => b.nom);
  const pertes = pertesDe(registre, null);
  // 🏗 Les chantiers auxquels on peut encore affecter un outil : chantiers de
  // devis EN COURS et 🛠 travaux à crédit non soldés, de l'espace regardé.
  const chantiersOuverts = chantiersOuvertsPourOutil(db, profile);
  const propositionsChantiers = chantiersOuverts.map((c) => ({
    cle: c.id, valeur: c.nom, detail: c.type === "travaux" ? "🛠 Travaux à crédit" : "Chantier en cours",
  }));
  // Les lieux dont l'appel de la semaine manque encore, et ce que le dernier
  // appel de chaque lieu a laissé de côté.
  const aAppeler = lieuxSansAppel(lieux, registre, jour);
  const appelsFaits = lieux
    .map((b) => ({ b, fait: appelDeLaSemaine(b, jour), manquants: manquantsDuDernierAppel(b, registre) }))
    .filter((x) => x.fait);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="font-bold text-slate-800 text-lg mb-1">🧰 Le matériel de travail de BMI</div>
        <div className="text-xs text-slate-500 mb-3">Un outil n'appartient pas à une boutique : il est à la maison. C'est la personne qui le reçoit qui dit où il se range — sa boutique, ou le magasin.</div>
        {/* ⚠ Timo, 18/09/2026 : chaque carré s'OUVRE. Le carré choisi porte
            un cadre épais — on doit voir lequel on regarde. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            ["tous", "Outils", resume.total, "neutre"],
            ["dehors", "Dehors", resume.dehors, resume.dehors ? "attente" : "neutre"],
            ["retard", "En retard", resume.retard, resume.retard ? "du" : "neutre"],
            ["reparation", "En réparation", resume.reparation, resume.reparation ? "attente" : "neutre"],
            // ⚠ UN SEUL carré pour les deux (Timo, 18/09/2026 : « pas un 6e carré…
            // grouper avec perdu »). Le nombre du haut = tout ce qui est sorti du
            // matériel de travail ; la ligne du dessous dit la part de chacun,
            // parce que perdre un outil et l'user jusqu'au bout n'est pas pareil.
            ["perdus", "Perdus / Hors d'usage", (
              <>{resume.perdus + resume.reformes}
                <div className="text-xs font-normal mt-0.5">{resume.perdus} perdu{resume.perdus > 1 ? "s" : ""}{resume.valeurPerdue ? ` · ${fmt(resume.valeurPerdue)}` : ""} · {resume.reformes} hors d'usage</div>
              </>
            ), resume.perdus ? "du" : "neutre"],
          ].map(([id, label, valeur, nature]) => (
            <button key={id} type="button" onClick={() => { setVue(id); setOutilDeplie(""); }}
              title={`Voir : ${label}`}
              className={`text-left rounded-xl ${vue === id ? "ring-4 ring-sky-600 scale-[1.02]" : "hover:ring-2 hover:ring-sky-300"}`}>
              <Stat label={label} value={valeur} nature={nature} />
            </button>
          ))}
        </div>

        {/* ---- L'appel de la semaine (décision Timo : chaque semaine) ---- */}
        {jePeux && !appel && aAppeler.length > 0 && (
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
            <div className="text-sm font-bold text-amber-900 mb-2">📋 L'appel de l'outillage n'a pas encore été fait cette semaine :</div>
            <div className="flex flex-wrap gap-2">
              {aAppeler.map((b) => (
                <button key={b.id} onClick={() => ouvrirAppel(b.nom)} className="px-4 py-2 rounded-lg bg-amber-600 text-white font-bold text-sm hover:bg-amber-700">
                  Faire l'appel de {b.depot ? "🏭 " : ""}{b.nom} ({outilsVivantsDuLieu(b.nom).length})
                </button>
              ))}
            </div>
            <div className="text-xs text-amber-800 mt-2">On ne coche que ce qu'on a physiquement sous la main : chaque lieu fait le sien.</div>
          </div>
        )}
        {jePeux && !appel && appelsFaits.map(({ b, fait, manquants }) => (
          <div key={b.id} className="mt-2 text-xs text-slate-500">
            📋 {b.depot ? "🏭 " : ""}<b>{b.nom}</b> — appel fait le {dFR(fait.le)} par {fait.par} : {fait.presents.length} sous la main, {fait.absents.length} pas vus.
            {manquants.length > 0 && <> Pas vus : <b className="text-red-700">{manquants.map((o) => o.nom).join(", ")}</b>.</>}
          </div>
        ))}
        {appel && (
          <div className="mt-4 rounded-xl border-2 border-amber-300 bg-white p-3">
            <div className="font-bold text-slate-800 mb-1">📋 Appel de l'outillage — {appel.lieu}, semaine du {dFR(jour)}</div>
            <div className="text-xs text-slate-500 mb-3">Cochez ce que vous avez sous la main <b>à {appel.lieu}</b>. Ce qui n'est pas coché reste dehors et se voit. Un outil sorti n'est pas coché d'office : il est chez quelqu'un.</div>
            <div className="max-h-80 overflow-auto border rounded-lg divide-y">
              {outilsVivantsDuLieu(appel.lieu).map((o) => {
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
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <select className={`${inputCls} sm:w-56`} value={lieuFiltre} onChange={(e) => { setLieuFiltre(e.target.value); setOutilDeplie(""); }}>
                <option value="">Tous les lieux ({outilsDeLaVue(registre, vue, jour).length})</option>
                {lieux.map((b) => (
                  <option key={b.id} value={b.nom}>{b.depot ? "🏭 " : ""}{b.nom} ({outilsDeLaVue(registre, vue, jour).filter((o) => lieuDeRangement(o) === b.nom).length})</option>
                ))}
              </select>
            </label>
            {vue === "tous" && <input className={champRecherche} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un outil…" />}
            {vue === "tous" && jeSuisAdmin && !neuf && <button onClick={() => setNeuf(outilVide)} className="px-3 py-1.5 rounded-lg border-2 border-sky-700 text-sky-800 font-bold text-sm hover:bg-sky-50">➕ Ajouter un outil</button>}
            {vue === "reparation" && coutRep > 0 && <span className="text-xs text-slate-600">Réparations payées jusqu'ici : <b>{fmt(coutRep)}</b> — <i>chacune est une dépense de BMI, à retrouver dans 📤 Dépenses</i></span>}
          </div>

          {vue === "tous" && neuf && (
            <div className="rounded-xl border-2 border-sky-300 bg-white p-3 mb-3">
              <div className="grid md:grid-cols-5 gap-3">
                <Field label="Nom de l'outil"><input className={inputCls} value={neuf.nom} onChange={(e) => setNeuf({ ...neuf, nom: e.target.value })} placeholder="Perceuse BOSCH" autoFocus /></Field>
                <Field label="Numéro gravé"><input className={inputCls} value={neuf.numero} onChange={(e) => setNeuf({ ...neuf, numero: e.target.value })} placeholder="BMI-012" /></Field>
                <Field label="Où est-il rangé ?">
                  <select className={inputCls} value={neuf.lieu} onChange={(e) => setNeuf({ ...neuf, lieu: e.target.value })}>
                    <option value="">— Choisir —</option>
                    {lieux.map((b) => <option key={b.id} value={b.nom}>{b.depot ? "🏭 " : ""}{b.nom}</option>)}
                  </select>
                </Field>
                <Field label="Catégorie"><input className={inputCls} value={neuf.categorie} onChange={(e) => setNeuf({ ...neuf, categorie: e.target.value })} placeholder="Électroportatif" /></Field>
                <Field label="Acheté le"><input type="date" className={inputCls} value={neuf.achete_le} onChange={(e) => setNeuf({ ...neuf, achete_le: e.target.value })} /></Field>
                <Field label="Prix d'achat (F)"><input type="number" className={inputCls} value={neuf.prix_achat} onChange={(e) => setNeuf({ ...neuf, prix_achat: e.target.value })} /></Field>
              </div>
              {/* 🧰 Caisse ou boîte à outils ? Ça se dit ICI (Timo, 18/09/2026) :
                  une perceuse n'a rien à contenir, sa fiche ne doit pas le proposer. */}
              <label className="flex items-start gap-2 mt-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={!!neuf.boite} onChange={(e) => setNeuf({ ...neuf, boite: e.target.checked })} />
                <span className="text-sm text-slate-700">
                  <b>C'est une caisse ou une boîte à outils</b>
                  <span className="block text-xs text-slate-500">Sa fiche portera alors la liste de ce qu'elle contient, et on la comptera à chaque retour. Une perceuse, non.</span>
                </span>
              </label>
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
              {/* 💸 Timo, 18/09/2026 : « mets le prix de réparation dans les
                  dépenses ». Dès qu'un prix est saisi, on demande AVEC QUOI
                  c'est payé — une dépense ordinaire, validation du DG comprise. */}
              {Number(repar.prix || 0) > 0 && (
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <Field label="Moyen de paiement">
                    <select className={inputCls} value={repar.paiement} onChange={(e) => setRepar({ ...repar, paiement: e.target.value })}>
                      {MOYENS_ENCAISSEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Payé avec">
                    <select className={inputCls} value={repar.paye_avec} onChange={(e) => setRepar({ ...repar, paye_avec: e.target.value })}>
                      {optionsPayeAvec(caisses, caisseDe(tous.find((x) => x.id === repar.outil_id))).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                </div>
              )}
              <div className="text-xs text-slate-500 mt-2">
                {Number(repar.prix || 0) > 0
                  ? <>Une dépense de <b>{fmt(Number(repar.prix))}</b> sera enregistrée en « {CATEGORIE_REPARATION_OUTIL} » — comme toute dépense : validation du DG au-delà de {fmt(SEUIL_VALIDATION_DEPENSE)}, et elle sort du tiroir si elle est payée en espèces sur la caisse.</>
                  : <>Laissez le prix vide si vous ne le connaissez pas encore : <b>on vous le demandera au retour de l'outil</b>, et la dépense sera enregistrée à ce moment-là.</>}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={enregistrerReparation} className={btnDark}>Enregistrer</button>
                <button onClick={() => setRepar(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
              </div>
            </div>
          )}

          {/* 📥 Le retour d'une réparation : le prix payé, enfin connu */}
          {retourRep && (() => {
            const o = tous.find((x) => x.id === retourRep.outil_id) || {};
            const rep = reparationEnCours(o) || {};
            return (
              <div className="rounded-xl border-2 border-emerald-300 bg-white p-3 mb-3">
                <div className="font-bold text-slate-800 mb-1">📥 « {o.nom} » revient de réparation</div>
                <div className="text-xs text-slate-500 mb-2">Chez {rep.reparateur || "—"}{rep.panne ? ` · ${rep.panne}` : ""}{rep.le ? ` · déposé le ${dFR(rep.le)}` : ""}</div>
                <div className="grid md:grid-cols-3 gap-3">
                  <Field label="Combien a coûté la réparation ? (F)"><input type="number" className={inputCls} value={retourRep.prix} onChange={(e) => setRetourRep({ ...retourRep, prix: e.target.value })} autoFocus /></Field>
                  {Number(retourRep.prix || 0) > 0 && <>
                    <Field label="Moyen de paiement">
                      <select className={inputCls} value={retourRep.paiement} onChange={(e) => setRetourRep({ ...retourRep, paiement: e.target.value })}>
                        {MOYENS_ENCAISSEMENT.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </Field>
                    <Field label="Payé avec">
                      <select className={inputCls} value={retourRep.paye_avec} onChange={(e) => setRetourRep({ ...retourRep, paye_avec: e.target.value })}>
                        {optionsPayeAvec(caisses, caisseDe(tous.find((x) => x.id === retourRep.outil_id))).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </Field>
                  </>}
                </div>
                <div className="text-xs text-slate-500 mt-2">Laissez 0 si la réparation n'a rien coûté (garantie, geste du réparateur) : l'outil rentre, et aucune dépense n'est écrite.</div>
                <div className="flex gap-2 mt-3">
                  <button onClick={enregistrerRetourReparation} className={btnDark}>📥 Enregistrer le retour</button>
                  <button onClick={() => setRetourRep(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
                </div>
              </div>
            );
          })()}

          {/* 🧰 LE COMPTAGE D'UNE BOÎTE — décision 1a : au retour, obligatoire. */}
          {compter && (() => {
            const o = tous.find((x) => x.id === compter.outil_id);
            if (!o) return null;
            return (
              <PanneauComptage outil={o} compte={compter.valeurs} setCompte={(v) => setCompter({ ...compter, valeurs: v })}
                pourRetour={compter.pourRetour} onValider={validerComptage} onAnnuler={() => setCompter(null)} />
            );
          })()}

          {/* 🧰 CE QUE LA BOÎTE CONTIENT : la liste que l'on comptera à chaque retour. */}
          {contenu && (() => {
            const o = tous.find((x) => x.id === contenu.outil_id);
            if (!o) return null;
            const fait = dernierComptage(o);
            const manques = manquesEnCours(o);
            const aDeclarer = manquesADeclarer(registre, o);
            return (
              <div className="rounded-xl border-2 border-slate-300 bg-slate-50 p-3 mb-3">
                <div className="font-bold text-slate-800 mb-1">🧰 Ce que « {o.nom} » doit contenir</div>
                <div className="text-xs text-slate-600 mb-3">
                  C'est cette liste qu'on comptera à chaque retour. Le petit matériel n'a pas de numéro gravé : on compte des quantités, pas des identités.
                </div>
                {contenuDe(o).length === 0 ? (
                  <div className="text-sm text-slate-500 mb-3">Rien dans la liste pour l'instant : ajoutez ci-dessous ce que cette caisse doit contenir.</div>
                ) : (
                  <div className="space-y-1 mb-3">
                    {contenuDe(o).map((l) => (
                      <div key={l.id} className="flex items-center gap-3 text-sm">
                        <span className="font-semibold text-slate-800 min-w-[10rem]">{l.nom}</span>
                        <span className="text-slate-600">× {l.quantite}</span>
                        <span className="text-slate-500 text-xs">{l.valeur ? `${fmt(l.valeur)} pièce` : "valeur non renseignée"}</span>
                        {jeSuisAdmin && outilRange(o) && <button onClick={() => corrigerLigne(o, l)} className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`} title="Corriger cette ligne">✏️</button>}
                        {jeSuisAdmin && outilRange(o) && <button onClick={() => retirerDuContenu(o, l)} className={boutonAction("border-red-300 text-red-700 hover:bg-red-50")} title="Retirer de la liste">🗑</button>}
                      </div>
                    ))}
                  </div>
                )}
                {/* ⚠ Condition de Timo : on ne touche à une caisse que RANGÉE. */}
                {jeSuisAdmin && !outilRange(o) && (
                  <div className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-2 mb-3">
                    {critiqueOutilRange(o, "vous pourrez corriger sa liste")}
                  </div>
                )}
                {jeSuisAdmin && outilRange(o) && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                    <Field label="Matériel"><input className={inputCls} value={contenu.nom} onChange={(e) => setContenu({ ...contenu, nom: e.target.value })} placeholder="Tournevis plat" /></Field>
                    <Field label="Combien"><input type="number" min="1" className={inputCls} value={contenu.quantite} onChange={(e) => setContenu({ ...contenu, quantite: e.target.value })} /></Field>
                    <Field label="Valeur d'une pièce (F)"><input type="number" min="0" className={inputCls} value={contenu.valeur} onChange={(e) => setContenu({ ...contenu, valeur: e.target.value })} placeholder="2000" /></Field>
                    <button onClick={() => ajouterAuContenu(o)} className={btnDark}>➕ Ajouter à la liste</button>
                  </div>
                )}
                {fait && (
                  <div className={`text-sm mt-3 ${manques.length ? "text-red-800 font-bold" : "text-emerald-700"}`}>
                    {manques.length
                      ? `⚠ Dernier comptage le ${dFR(fait.le)} par ${fait.par || "—"} : il manque ${manques.map((m) => `${m.manque} ${m.nom}`).join(", ")}. La boîte repartira incomplète tant que ce matériel n'est pas remplacé.`
                      : `✓ Dernier comptage le ${dFR(fait.le)} par ${fait.par || "—"} : tout y était.`}
                  </div>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {jeSuisAdmin && outilRange(o) && contenuDe(o).length === 0 && (
                    <button onClick={() => changerCaisse(o, false)} className="px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-100">↩ Ce n'est plus une caisse</button>
                  )}
                  {jeSuisAdmin && aDeclarer.length > 0 && (
                    <button onClick={() => perdreContenu(o)} className="px-4 py-2 rounded-lg border-2 border-red-300 text-red-700 font-bold text-sm hover:bg-red-50">⚠ Déclarer ce manque perdu</button>
                  )}
                  <button onClick={() => setContenu(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Fermer</button>
                </div>
              </div>
            );
          })()}

          {/* ✏️ CORRIGER LA FICHE — un numéro gravé faux ne se laisse pas. */}
          {fiche && (() => {
            const o = tous.find((x) => x.id === fiche.outil_id);
            if (!o) return null;
            return (
              <div className="rounded-xl border-2 border-sky-300 bg-white p-3 mb-3">
                <div className="font-bold text-slate-800 mb-2">✏️ Corriger la fiche de « {o.nom} »</div>
                <div className="grid md:grid-cols-5 gap-3">
                  <Field label="Nom de l'outil"><input className={inputCls} value={fiche.nom} onChange={(e) => setFiche({ ...fiche, nom: e.target.value })} autoFocus /></Field>
                  <Field label="Numéro gravé"><input className={inputCls} value={fiche.numero} onChange={(e) => setFiche({ ...fiche, numero: e.target.value })} placeholder="BMI-012" /></Field>
                  <Field label="Catégorie"><input className={inputCls} value={fiche.categorie} onChange={(e) => setFiche({ ...fiche, categorie: e.target.value })} /></Field>
                  <Field label="Acheté le"><input type="date" className={inputCls} value={fiche.achete_le} onChange={(e) => setFiche({ ...fiche, achete_le: e.target.value })} /></Field>
                  <Field label="Prix d'achat (F)"><input type="number" className={inputCls} value={fiche.prix_achat} onChange={(e) => setFiche({ ...fiche, prix_achat: e.target.value })} /></Field>
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  Son histoire, ses mouvements et sa liste ne bougent pas. <b>Le lieu ne se corrige pas ici</b> : il est déduit du dernier retour — enregistrez un retour pour le reposer. Il est rangé à <b>{lieuDeRangement(o) || "—"}</b>.
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={enregistrerFiche} className={btnDark}>Enregistrer la correction</button>
                  <button onClick={() => setFiche(null)} className="px-4 py-2 rounded-lg border font-semibold text-sm text-slate-600">Annuler</button>
                </div>
              </div>
            );
          })()}

          {affichee.length === 0 ? (
            <div className="text-sm text-slate-500">{VIDE_VUE[vue]}</div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[30rem]">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr className="text-left">
                    <th className={`px-3 py-2 ${enTeteFige()}`}>Outil</th>
                    {vue === "tous" && <><th className="px-3 py-2">N°</th><th className="px-3 py-2">Catégorie</th><th className="px-3 py-2">État</th><th className="px-3 py-2">Où</th><th className="px-3 py-2">Chez qui / rendu à</th><th className="px-3 py-2 text-right">Prix d'achat</th></>}
                    {vue === "dehors" && <><th className="px-3 py-2">Chez qui</th><th className="px-3 py-2">Chantier</th><th className="px-3 py-2">Depuis</th><th className="px-3 py-2">Retour prévu</th></>}
                    {vue === "retard" && <><th className="px-3 py-2">Chez qui</th><th className="px-3 py-2">Retour prévu</th><th className="px-3 py-2">Retard</th><th className="px-3 py-2">Pourquoi ce n'est pas rentré</th></>}
                    {vue === "reparation" && <><th className="px-3 py-2">Chez quel réparateur</th><th className="px-3 py-2">Son numéro</th><th className="px-3 py-2">La panne</th><th className="px-3 py-2 text-right">Prix</th><th className="px-3 py-2">Depuis</th></>}
                    {vue === "perdus" && <><th className="px-3 py-2">Qui / décidé par</th><th className="px-3 py-2">Le</th><th className="px-3 py-2">Pourquoi</th><th className="px-3 py-2 text-right">Valeur</th><th className="px-3 py-2 text-right">À rembourser</th><th className="px-3 py-2 text-right">Déjà retenu</th><th className="px-3 py-2 text-right">Reste à payer</th></>}
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
                    const ouLu = lieuOutil(o);
                    const perte = perteDe(o);
                    const reforme = reformeDe(o);
                    // Dans le carré « Perdus / Hors d'usage », une ligne de titre
                    // ouvre chaque bloc : la liste arrive perdus PUIS réformés.
                    const ouvreBloc = vue === "perdus" && (i === 0 || etatOutil(affichee[i - 1]) !== etat);
                    const qui = perte && perte.user_id ? ficheParId(db.users, perte.user_id) : null;
                    const mode = modeRetenue(qui);
                    const tard = enRetard(o, jour);
                    const deplie = outilDeplie === o.id;
                    const fond = deplie ? "bg-sky-200" : (vue !== "tous" && tard ? "bg-red-50" : (i % 2 ? "bg-slate-50/60" : "bg-white"));
                    return (
                      <Fragment key={o.id}>
                      {ouvreBloc && (
                        <tr className={etat === "perdu" ? "bg-red-100" : "bg-slate-100"}>
                          <td colSpan={9} className={`px-3 py-1.5 text-xs font-bold ${etat === "perdu" ? "text-red-900" : "text-slate-700"}`}>
                            {etat === "perdu"
                              ? "⚠ Perdus — quelqu'un en répondait : il peut y avoir un remboursement"
                              : "🗑 Hors d'usage — usés ou cassés : plus rien à rembourser de personne"}
                          </td>
                        </tr>
                      )}
                      <tr className={`cursor-pointer ${deplie ? classeLigneDepliable(true, i) : (vue !== "tous" && tard ? "bg-red-50 hover:bg-red-100" : classeLigneDepliable(false, i))}`}
                        onClick={() => setOutilDeplie(deplie ? "" : o.id)} title="Cliquez pour voir l'histoire de cet outil">
                        <td className={`px-3 py-2 font-semibold ${celluleFigee(fond, deplie)}`}>{o.nom}{o.numero && <div className="text-xs font-normal text-slate-500">N° {o.numero}</div>}
                          {estBoite(o) && <div className={`text-xs font-normal ${manquesEnCours(o).length ? "text-red-700 font-bold" : "text-slate-500"}`}>🧰 boîte — {nbContenu(o)} pièce(s){manquesEnCours(o).length ? ` · il en manque ${manquesEnCours(o).reduce((t, m) => t + m.manque, 0)}` : ""}</div>}</td>

                        {vue === "tous" && <>
                          <td className="px-3 py-2 text-slate-600">{o.numero || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{o.categorie || "—"}</td>
                          <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${(ETATS_OUTIL[etat] || {}).teinte || ""}`}>{libelleEtat(etat)}</span></td>
                          <td className="px-3 py-2">{ouLu.type === "personne"
                            ? <span className="text-sky-800 font-semibold">chez {ouLu.nom}</span>
                            : <span className="text-slate-700">{ouLu.nom || "—"}</span>}
                            {ouLu.type === "personne" && lieuDeRangement(o) && <div className="text-xs text-slate-500">revient à {lieuDeRangement(o)}</div>}</td>
                          <td className="px-3 py-2">{d ? <>{d.nom}</> : rendu ? <span className="text-slate-600">rendu à <b>{rendu.par || "—"}</b><div className="text-xs text-slate-500">le {dFR(rendu.le)}</div></span> : "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.prix_achat ? fmt(o.prix_achat) : "—"}</td>
                        </>}

                        {vue === "dehors" && <>
                          <td className="px-3 py-2 font-semibold">{so.user}<div className="text-xs font-normal text-slate-500">remis par {so.par || "—"}{lieuDeRangement(o) ? ` · revient à ${lieuDeRangement(o)}` : ""}</div></td>
                          <td className="px-3 py-2 text-slate-600">{chantierEnCours(o) || "—"}{chantiersDeLaSortie(o).length > 0 && <div className="text-xs text-slate-400">changé {chantiersDeLaSortie(o).length} fois</div>}</td>
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

                        {vue === "perdus" && perte && <>
                          <td className="px-3 py-2 font-semibold">{perte.user || <span className="font-normal text-slate-500">personne (il était rangé)</span>}
                            {perte.user && <div className="text-xs font-normal text-slate-500">retenue {libelleRetenue(mode)}</div>}</td>
                          <td className="px-3 py-2 tabular-nums">{dFR(perte.le)}<div className="text-xs text-slate-500">déclaré par {perte.par || "—"}</div></td>
                          <td className="px-3 py-2 text-slate-600">{perte.motif || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmt(perte.valeur)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{aRembourser(perte) ? fmt(aRembourser(perte)) : <span className="text-slate-500">à la charge de BMI</span>}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700 font-semibold">{dejaRetenu(perte) ? fmt(dejaRetenu(perte)) : "—"}</td>
                          <td className={`px-3 py-2 text-right tabular-nums font-bold ${resteARetenir(perte) ? "text-red-700" : "text-emerald-700"}`}>
                            {resteARetenir(perte) ? fmt(resteARetenir(perte)) : (aRembourser(perte) ? "soldé ✅" : "—")}
                            {resteARetenir(perte) > 0 && mode === "commission" && <div className="text-xs font-normal text-slate-500">sur sa prochaine part</div>}
                          </td>
                        </>}

                        {vue === "perdus" && reforme && <>
                          <td className="px-3 py-2 font-semibold">{reforme.par || "—"}</td>
                          <td className="px-3 py-2 tabular-nums">{dFR(reforme.le)}</td>
                          <td className="px-3 py-2 text-slate-600">{reforme.motif || "—"}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{o.prix_achat ? fmt(o.prix_achat) : "—"}
                            {o.prix_achat ? <div className="text-xs font-normal text-slate-500">prix d'achat</div> : null}</td>
                          <td className="px-3 py-2 text-right text-slate-400">—</td>
                          <td className="px-3 py-2 text-right text-slate-400">—</td>
                          <td className="px-3 py-2 text-right text-slate-400">—</td>
                        </>}

                        <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {vue === "perdus" && jeSuisAdmin && perte && <button title="Combien lui demander ?" onClick={() => fixerMontant(o)} className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`}>✏️</button>}
                          {vue === "perdus" && jeSuisAdmin && perte && mode === "salaire" && resteARetenir(perte) > 0 && <button title="Retenir sur son salaire" onClick={() => retenir(o)} className={`${boutonAction("border-red-300 text-red-700 hover:bg-red-50")} mr-1`}>💵</button>}
                          {jePeux && (etat === "sorti" || etat === "reparation") && (
                            <button title={etat === "reparation" ? "Revenu de réparation" : "Enregistrer le retour"}
                              onClick={() => (etat === "reparation" && !depenseDeLaReparation(o)
                                ? setRetourRep({ outil_id: o.id, prix: String((reparationEnCours(o) || {}).prix || ""), paiement: "Espèces", paye_avec: `caisse:${caisseDe(o)}` })
                                : rendre(o))}
                              className={`${boutonAction("border-emerald-300 text-emerald-700 hover:bg-emerald-50")} mr-1`}>📥</button>
                          )}
                          {jePeux && etat === "sorti" && <button title="Changer le chantier (sans le ramener)" onClick={() => changerLeChantier(o)} className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`}>🏗</button>}
                          {jePeux && etat === "en_boutique" && <button title="Partir en réparation" onClick={() => setRepar({ outil_id: o.id, reparateur: "", tel: "", panne: "", prix: "", paiement: "Espèces", paye_avec: `caisse:${caisseDe(o)}` })} className={`${boutonAction("border-amber-300 text-amber-700 hover:bg-amber-50")} mr-1`}>🔧</button>}
                          {jePeux && !["perdu", "reforme"].includes(etat) && <button title="Déclarer perdu" onClick={() => perdre(o)} className={`${boutonAction("border-red-300 text-red-700 hover:bg-red-50")} mr-1`}>⚠</button>}
                          {jeSuisAdmin && vue === "tous" && outilRange(o) && (
                            <button title="Corriger la fiche (nom, numéro gravé, prix…)"
                              onClick={() => setFiche({ outil_id: o.id, nom: o.nom || "", numero: o.numero || "", categorie: o.categorie || "", achete_le: o.achete_le || "", prix_achat: String(o.prix_achat || "") })}
                              className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`}>✏️</button>
                          )}
                          {estBoite(o) && !["perdu", "reforme"].includes(etat) && (
                            <button title="Ce que contient la boîte" onClick={() => setContenu({ outil_id: o.id, nom: "", quantite: "1", valeur: "" })}
                              className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`}>🧰</button>
                          )}
                          {peutCompterBoite(o, profile) && etat === "sorti" && <button title="Compter la boîte" onClick={() => setCompter({ outil_id: o.id, pourRetour: false, valeurs: {} })} className={`${boutonAction("border-sky-300 text-sky-800 hover:bg-sky-50")} mr-1`}>🔢</button>}
                          {jeSuisAdmin && !["perdu", "reforme"].includes(etat) && <button title="Réformer (usé, cassé)" onClick={() => reformer(o)} className={`${boutonAction("border-slate-300 text-slate-600 hover:bg-slate-100")} mr-1`}>🗑</button>}
                          {jeSuisPrincipal && outilRange(o) && <button title="Retirer cette fiche du registre (créée par erreur)" onClick={() => supprimer(o)} className={boutonAction("border-red-300 text-red-700 hover:bg-red-50")}>✖</button>}
                        </td>
                      </tr>
                      {deplie && (
                        <tr className="bg-sky-50">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="text-xs font-bold text-sky-900 mb-2">🕘 Histoire de « {o.nom} »{o.numero ? ` — N° ${o.numero}` : ""}</div>
                            {o.categorie || o.achete_le || o.prix_achat ? (
                              <div className="text-xs text-slate-600 mb-2">
                                {o.categorie && <>Catégorie : <b>{o.categorie}</b> · </>}
                                {o.achete_le && <>acheté le <b>{dFR(o.achete_le)}</b> · </>}
                                {o.prix_achat ? <>prix d'achat <b>{fmt(o.prix_achat)}</b></> : null}
                              </div>
                            ) : null}
                            {perte && retenuesDe(perte).length > 0 && (
                              <div className="text-sm mb-2">
                                <div className="text-xs font-bold text-sky-900 mb-1">💵 Ce qui a déjà été retenu à {perte.user || "—"}</div>
                                {retenuesDe(perte).map((r) => (
                                  <div key={r.id} className="text-slate-700">— {fmt(r.montant)} {libelleRetenue(r.sur)}{r.mois ? ` (${r.mois})` : ""}{r.ref ? ` · ${r.ref}` : ""} · le {dFR(r.le)}{r.par ? ` · par ${r.par}` : ""}</div>
                                ))}
                                <div className="text-slate-800 font-bold mt-1">Reste à payer : {fmt(resteARetenir(perte))}</div>
                              </div>
                            )}
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

          {/* 🗑 LES FICHES RETIRÉES — rien n'est jeté (Timo, 18/09/2026 :
              l'administrateur principal peut supprimer un outil rangé ; la
              fiche part ici, et elle revient d'un clic). */}
          {vue === "tous" && jeSuisPrincipal && supprimesDe(registre).length > 0 && (
            <div className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-3">
              <div className="text-sm font-bold text-slate-700 mb-2">🗑 Fiches retirées du registre ({supprimesDe(registre).length})</div>
              <div className="space-y-1">
                {supprimesDe(registre).map((o) => (
                  <div key={o.id} className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="font-semibold text-slate-800">{o.nom}{o.numero ? ` — N° ${o.numero}` : ""}</span>
                    <span className="text-xs text-slate-500">retirée le {dFR(o.supprime_le)} par {o.supprime_par || "—"}{o.supprime_motif ? ` — ${o.supprime_motif}` : ""}</span>
                    <button onClick={() => restaurer(o)} className="px-3 py-1 rounded-lg border-2 border-sky-700 text-sky-800 font-bold text-xs hover:bg-sky-50">♻️ Remettre au registre</button>
                  </div>
                ))}
              </div>
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
                  suggestions={propositionsOutils(registre)}
                  placeholder="Nom ou numéro gravé…"
                />
              </Field>
              <Field label="Qui le prend">
                <select className={inputCls} value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {personnes.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
                </select>
              </Field>
              {/* 🏗 Timo, 18/09/2026 : « saisie libre ET sélection de chantier
                  en cours et chantier à crédit ». Un chantier TERMINÉ n'est
                  plus proposé ; un nom tapé reste toujours possible. */}
              <Field label="Chantier (facultatif)">
                <ChampSuggestions
                  valeur={f.chantier}
                  onChange={(v) => setF({ ...f, chantier: v })}
                  onChoisir={(p) => setF({ ...f, chantier: p.valeur })}
                  suggestions={propositionsChantiers}
                  placeholder="Où part l'outil — ou tapez librement"
                />
              </Field>
              <Field label="Retour prévu le">
                <input type="date" className={inputCls} value={f.retour_prevu} onChange={(e) => setF({ ...f, retour_prevu: e.target.value })} />
              </Field>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {(() => {
                const o = f.outil_id ? tous.find((x) => x.id === f.outil_id) : outilSaisi(registre, f.saisie);
                if (o) return <>✓ <b>{o.nom}</b>{o.numero ? ` — N° ${o.numero}` : ""} · {libelleEtat(etatOutil(o))}
                  {estBoite(o) && <> · 🧰 boîte de {nbContenu(o)} pièce(s)</>}
                  {manquesEnCours(o).length > 0 && <div className="text-red-700 font-bold">⚠ Elle repart INCOMPLÈTE : il manque {manquesEnCours(o).map((m) => `${m.manque} ${m.nom}`).join(", ")}.</div>}</>;
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
