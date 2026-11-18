// ============================================================
// screens/ContratsInstallation.jsx — Liste des contrats d'installation
// signés. Admin et responsable commercial voient tous les contrats de
// tous les commerciaux ; un commercial ne voit que les siens ; un
// client ne voit que les siens (onglet "📄 Mes contrats").
// ============================================================
import { useState, useRef } from "react";
import { ZoneSignature } from "../components/ZoneSignature";
import { fmt, dFR } from "../lib/core";
import { Panel, uAlert, BoutonGeste, CarteRepliable, NoteDepliable } from "../components/ui";
import { contratsInstallation, pvDuContrat, bloquerSiLecture, resteAPayer, espaceDuCompte } from "../lib/calculs";
import { imprimerContratInstallation, imprimerPV } from "../lib/impression";
import { useRetour } from "../retour";

export function ContratsInstallation({ db, save, profile }) {
  const isClient = profile.role === "client";
  const isAdmin = profile.role === "admin";
  // Seuls admin et responsable commercial ont une vue d'ensemble — tout
  // autre rôle qui peut initier un devis (commercial, technicien,
  // technicien BMI, gérant, vendeur) ne voit que SES propres contrats,
  // jamais ceux d'un collègue (élargi à ces rôles, demande Timo).
  const isSupervision = profile.role === "admin" || profile.role === "resp_commercial";

  // Le contrat apparaît TOUJOURS dans la liste dès qu'il est signé — plus de
  // filtre payeSeulement ici (demande Timo : le cacher complètement était
  // trompeur, mieux vaut le montrer et expliquer pourquoi il n'est pas
  // encore téléchargeable). Seul le clic sur "Voir" est maintenant
  // conditionné par le paiement, via voirContrat() ci-dessous.
  // ⚠ Cloisonnement : un contrat signé depuis un compte de formation ne
  // doit jamais apparaître dans la liste d'un compte réel, ni l'inverse —
  // le devis porte son espace (`formation`) depuis sa création. Un CLIENT
  // voit ses contrats quel que soit l'espace : ce sont les siens, et c'est
  // le seul moyen pour lui de constater qu'un document est un
  // entraînement (le bandeau est déjà sur le PDF).
  const espace = espaceDuCompte(db, profile);
  const contrats = isClient
    ? contratsInstallation(db, { clientId: profile.id })
    : contratsInstallation(db, { commercial: isSupervision ? undefined : profile.nom, espace });

  // ---- SIGNATURE PERSONNELLE — enregistrée UNE FOIS, réutilisée
  // automatiquement sur tous les contrats futurs de la personne (demande
  // Timo). La zone de signature est LA zone commune à toute l'application
  // (components/ZoneSignature.jsx) — plus de copie locale du dessin.
  const [captureOuverte, setCaptureOuverte] = useState(false);
  useRetour(captureOuverte, () => setCaptureOuverte(false)); // ⬅ touche retour (13/10/2026)
  const signatureRef = useRef(null);
  const enregistrerSignature = () => {
    if (bloquerSiLecture(db, profile)) return;
    if (!signatureRef.current?.aSigne()) { uAlert("Signez d'abord dans le cadre prévu."); return; }
    const dataUrl = signatureRef.current.image();
    save({ ...db, users: db.users.map((u) => (u.id === profile.id ? { ...u, signature_personnelle: dataUrl } : u)) }, `Signature personnelle enregistrée — ${profile.nom}`);
    setCaptureOuverte(false);
    uAlert("✅ Signature enregistrée — elle sera utilisée automatiquement sur vos futurs contrats.");
  };

  // Le téléchargement reste réservé à l'admin (toujours) et à tout le monde
  // UNE FOIS le devis payé — sinon, message explicatif différent selon
  // qu'on est le client (aller payer en boutique) ou l'initiateur
  // (attendre que le client passe payer), plutôt que de cacher le bouton
  // sans explication (demande Timo).
  // ⚠ Pour un devis "pose seule", `statut` ne passe JAMAIS à "paye" — le
  // règlement se fait via la dette du chantier, en un ou plusieurs
  // versements, jamais lié au statut du devis (bug signalé par Timo : le
  // contrat restait bloqué à vie, même une fois entièrement réglé). Le
  // déblocage doit suivre le solde RÉEL de cette dette, jamais un paiement
  // PARTIEL (précision de Timo) — `resteAPayer(dette) <= 0` uniquement.
  const detteDuDevisSoldee = (d) => {
    if (!d.pose_seule) return true;
    const chantier = (db.clients_installes || []).find((c) => c.devis_id === d.id);
    const dette = chantier ? (db.dettes || []).find((x) => x.id === chantier.dette_id) : null;
    return dette ? resteAPayer(dette) <= 0 : false;
  };
  // UNE règle pour « réglé ? » : le bouton ET la pastille (29/09/2026 — la
  // pastille lisait `statut !== "paye"`, donc une pose seule SOLDÉE restait
  // « ⏳ En attente de paiement » pour toujours).
  const contratRegle = (d) => (d.pose_seule ? detteDuDevisSoldee(d) : d.statut === "paye");
  const detteChantierSoldee = (fiche) => {
    if (!fiche?.dette_id) return true;
    const dette = (db.dettes || []).find((x) => x.id === fiche.dette_id);
    return dette ? resteAPayer(dette) <= 0 : false;
  };

  const voirContrat = (c, d) => {
    if (isAdmin || contratRegle(d)) { imprimerContratInstallation(d, db); return; }
    if (isClient) {
      uAlert(d.pose_seule
        ? "Ce contrat n'est pas encore téléchargeable — le règlement n'est pas encore soldé. Vous pourrez le télécharger une fois le paiement terminé."
        : `Ce contrat n'est pas encore téléchargeable. Rendez-vous à la boutique ${d.boutique_paiement || "choisie"} pour régler — vous pourrez alors le télécharger ici.`);
    } else {
      uAlert(`Ce contrat n'est pas encore téléchargeable : ${c.nom} n'est pas encore passé(e) payer${d.pose_seule ? " intégralement" : ""}. Vous pourrez le télécharger une fois le paiement encaissé.`);
    }
  };

  // ⚠ Même règle appliquée au PV (précision de Timo) : le bouton "Voir le
  // PV" ne vérifiait jusqu'ici QUE la signature, jamais le paiement — pour
  // une pose seule, un client pouvait donc le télécharger même sans avoir
  // rien réglé. Reste visible dès la signature (informatif), mais le clic
  // n'ouvre le document que si la dette est réellement soldée.
  const voirPvDepuisContrat = (c, fichePv) => {
    if (isAdmin || detteChantierSoldee(fichePv)) { imprimerPV(fichePv, db); return; }
    if (isClient) {
      uAlert("Ce PV n'est pas encore téléchargeable — le règlement n'est pas encore soldé. Vous pourrez le télécharger une fois le paiement terminé.");
    } else {
      uAlert(`Ce PV n'est pas encore téléchargeable : le règlement de ${c.nom} n'est pas encore soldé.`);
    }
  };

  // 📄 FAÇON CARNET (18/11/2026, aperçu validé par Timo, « Construit, lance ») :
  // « Ma signature » tient sur une ligne, les contrats se lisent en TABLEAU
  // (sur téléphone : une carte par contrat), les trois pastilles sont rangées
  // dans UNE colonne « État », les gestes sont écrits en mots. Les règles
  // (téléchargeable une fois le paiement encaissé…) n'ont pas bougé.
  const typeContrat = (d) => (d.type_devis === "garage" ? "Motorisation portail/garage" : d.type_devis === "autre" ? (d.besoins?.categorie || "Devis") : "Installation solaire");
  const etatContrat = (d) => (
    <span className="flex flex-wrap gap-1">
      {!contratRegle(d) && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">⏳ En attente de paiement</span>}
      {d.contrat_papier && <span className="text-[10px] font-bold text-slate-700 bg-slate-100 rounded-full px-2 py-0.5" title={`Original archivé à ${d.contrat_papier_boutique || "—"}`}>📝 Signé sur papier</span>}
      {d.contrat_signe_en_boutique && <span className="text-[10px] font-bold text-sky-800 bg-sky-100 rounded-full px-2 py-0.5">🏪 Signé en boutique</span>}
      {contratRegle(d) && !d.contrat_papier && !d.contrat_signe_en_boutique && <span className="text-xs text-slate-400">—</span>}
    </span>
  );
  const gestesContrat = (client, d) => {
    const fichePv = pvDuContrat(db, d.id);
    const pvSigne = fichePv && (fichePv.contrat_statut === "signe" || fichePv.avenant_statut === "signe" || fichePv.contrat_force_par);
    return (
      <span className="flex flex-wrap gap-1.5">
        <BoutonGeste icone="📄" nom="Voir le contrat" onClick={() => voirContrat(client, d)} />
        {pvSigne && <BoutonGeste icone="📄" nom="Voir le PV" teinte="vert" onClick={() => voirPvDepuisContrat(client, fichePv)} />}
      </span>
    );
  };
  const colonnes = ["N° contrat", ...(isClient ? [] : ["Client"]), "Type", "Signé le", ...(isClient ? [] : ["Par"]), "Total", "État", "Gestes"];
  const explicationContrats = isClient
    ? "Vos contrats signés apparaissent ici — téléchargeables une fois le paiement encaissé."
    : isAdmin
      ? "Tous les contrats signés, quel que soit le statut de paiement."
      : isSupervision
        ? "Tous les contrats signés, tous initiateurs confondus — téléchargeables une fois encaissés."
        : "Les contrats signés sur vos propres devis — téléchargeables une fois encaissés.";

  return (
    <div className="space-y-4">
      {!isClient && (
        <Panel>
          <div className="flex flex-wrap items-center gap-3" data-ma-signature>
            <span className="font-bold">✍️ Ma signature</span>
            <NoteDepliable className="text-xs text-slate-500" libelle="Pourquoi ?">Enregistrée une seule fois, elle est réutilisée automatiquement sur tous vos contrats — obligatoire avant de pouvoir envoyer un devis.</NoteDepliable>
            {profile.signature_personnelle
              ? (<>
                <img src={profile.signature_personnelle} alt="Ma signature" className="h-10 border border-slate-200 rounded bg-white" />
                <BoutonGeste icone="✍️" nom="Modifier ma signature" onClick={() => setCaptureOuverte(true)} />
              </>)
              : <BoutonGeste icone="✍️" nom="Enregistrer ma signature" teinte="vert" onClick={() => setCaptureOuverte(true)} />}
          </div>
        </Panel>
      )}

      <Panel>
        <CarteRepliable titre={`📄 ${isClient ? "Mes contrats" : "Contrats d'installation"} (${contrats.length})`} explication={explicationContrats}>
          {contrats.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">Aucun contrat signé pour l'instant.</div>}
          {contrats.length > 0 && (<>
            <div className="hidden sm:block overflow-x-auto" data-contrats-table>
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500 uppercase">{colonnes.map((h) => <th key={h} className={`px-3 py-2 ${h === "Total" ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                <tbody>
                  {contrats.map(({ client, devis: d }) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{d.contrat_numero || "—"}</td>
                      {!isClient && <td className="px-3 py-2">{client.nom}</td>}
                      <td className="px-3 py-2">{typeContrat(d)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{dFR(d.contrat_date_signature)}</td>
                      {!isClient && <td className="px-3 py-2">{d.par}</td>}
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(d.total)}</td>
                      <td className="px-3 py-2">{etatContrat(d)}</td>
                      <td className="px-3 py-2">{gestesContrat(client, d)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sm:hidden space-y-2" data-contrats-cartes>
              {contrats.map(({ client, devis: d }) => (
                <div key={d.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{d.contrat_numero || "—"}</span><span className="font-bold tabular-nums">{fmt(d.total)}</span></div>
                  <div className="text-xs text-slate-500">{!isClient && `${client.nom} · `}{typeContrat(d)} · signé le {dFR(d.contrat_date_signature)}{!isClient && ` · par ${d.par}`}</div>
                  <div className="mt-1">{etatContrat(d)}</div>
                  <div className="mt-2">{gestesContrat(client, d)}</div>
                </div>
              ))}
            </div>
          </>)}
        </CarteRepliable>
      </Panel>

      {captureOuverte && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-md w-full p-5">
            <div className="font-bold text-lg text-sky-900 mb-1">Ma signature</div>
            <div className="text-xs text-slate-500 mb-3">Elle apparaîtra sur tous vos contrats, à côté du cachet de BMI Togo.</div>
            <ZoneSignature ref={signatureRef} />
            <div className="flex gap-2 mt-3 flex-wrap">
              <button onClick={() => signatureRef.current?.effacer()} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Effacer</button>
              <button onClick={enregistrerSignature} className="flex-1 px-4 py-2 rounded-lg bg-sky-800 text-white font-bold text-sm hover:bg-sky-900">✍️ Enregistrer</button>
              <button onClick={() => setCaptureOuverte(false)} className="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
