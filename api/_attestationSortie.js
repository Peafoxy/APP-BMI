// ============================================================
// api/_attestationSortie.js — LA TOURNÉE DE 7 H : L'ATTESTATION D'UN CDD MISE
// À DISPOSITION D'ELLE-MÊME, ET LES ACCÈS FERMÉS 24 H APRÈS (14/10/2026)
//
// Timo : « A a pour les CDI et b pour les CDD ». Règle pure :
// src/lib/attestationSortie.js. Pas une fonction Vercel (le « _ ») : douze au
// plus. Appelé par api/rappels-du-matin.js.
//   • CDD, stage, apprentissage dont la date de sortie est arrivée, réels,
//     actifs, pas encore mis à disposition : la marque `attestation_sortie` sur
//     la fiche (RELUE juste avant), au nom de l'administrateur PRINCIPAL ; puis
//     le modèle `attestation_disponible` (« D oui » : sans numéro, la marque est
//     posée quand même). Rien dans le fil tant que WhatsApp n'a pas accepté.
//   • Tout compte dont les 24 h sont passées : `actif: false`, comme ⛔ Bloquer.
//   • Une notification à l'administrateur principal dit ce qui a été fait.
// ============================================================
import { aMettreADispositionAuto, construireMiseADisposition, comptesAFermer, momentFermeture, nomDocument, attestationDe,
  ligneAttestation, enteteApresAttestation, notificationFinsDeContrat, MODELE_ATTESTATION } from "../src/lib/attestationSortie.js";
import { critiqueDocument, documentDeSortie } from "../src/lib/certificatTravail.js";
import { envoiAttestationDisponible, numeroWhatsApp, LANGUE_MODELES } from "../src/lib/whatsappModeles.js";
import { idEntete, cleConversation } from "../src/lib/whatsappConversations.js";
import { estAdminPrincipalActif } from "../src/lib/espace.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { fabriquerEnvoi } from "../src/lib/rappels.js";
import { fusionnerPaie } from "../src/lib/paie.js";
import { configYCloud, envoyerYCloud } from "./_ycloud.js";
import { lireTable } from "./_tables.js";
import { randomUUID } from "node:crypto";

export async function attestationsEtFermetures(admin, db, aujourdhui) {
  const bilan = { mises_a_disposition: 0, messages: 0, sans_numero: 0, refuses: 0, a_completer: 0, fermes: 0 };
  // La fiche de PAIE (contrat, sortie, embauche) recollée sur une COPIE, lue seulement.
  const dbp = { ...db, users: fusionnerPaie(db.users || [], await lireTable(admin, "paie")) };
  const principal = dbp.users.find(estAdminPrincipalActif) || null;
  const faits = [], aCompleter = [], fermes = [];
  const { cle, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);

  for (const u of aMettreADispositionAuto(dbp, aujourdhui)) {
    try {
      if (critiqueDocument(documentDeSortie(u), u, aujourdhui)) { aCompleter.push(u.nom_complet || u.nom); bilan.a_completer++; continue; }
      const { data: frais } = await admin.from("users").select("id, data").eq("id", u.id).maybeSingle();
      if (!frais?.data || frais.data.actif === false || attestationDe(frais.data)) continue;
      const maintenant = Date.now();
      const ts = new Date(maintenant).toISOString();
      const marque = construireMiseADisposition({ u, par: principal, maintenant, auto: true });
      const data = { ...frais.data, attestation_sortie: marque, updated_at: ts };
      const { error } = await admin.from("users").update({ data, updated_at: ts }).eq("id", frais.id);
      if (error) { console.error("[rappels-du-matin] attestation : marque non posée", error.message); continue; }
      bilan.mises_a_disposition++;
      const f = momentFermeture(marque);
      const envoi = envoiAttestationDisponible({ employe: u.nom_complet || u.nom, tel: u.tel, document: nomDocument(marque), date: f.date, heure: f.heure });
      let parti = false;
      if (!envoi) bilan.sans_numero++;
      else if (cle && expediteur) {
        const r = await envoyerYCloud(cle, {
          from: expediteur, to: numeroWhatsApp(u.tel), type: "template",
          template: { name: MODELE_ATTESTATION, language: { code: LANGUE_MODELES }, components: [{ type: "body", parameters: envoi.variables.map((text) => ({ type: "text", text })) }] },
        });
        if (!r.ok) { bilan.refuses++; console.error("[rappels-du-matin] attestation : message refusé", r.code_whatsapp, r.motif); }
        else {
          parti = true; bilan.messages++;
          const tsl = new Date().toISOString();
          const base = ligneAttestation({ id: randomUUID(), tel: numeroWhatsApp(u.tel), employe: u, variables: envoi.variables, ts: tsl, auteur: principal });
          if (base) {
            const ligne = { ...base, ...champsEnvoi(r) };
            const { error: e2 } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: tsl });
            if (e2) console.error("[rappels-du-matin] attestation : ligne du fil non écrite", e2.message);
            const entete = (db.messages || []).find((m) => m.id === idEntete(cleConversation(u.tel)));
            const fiche = enteteApresAttestation({ tel: numeroWhatsApp(u.tel), employe: u, ts: tsl, entete });
            if (fiche) {
              const { error: e3 } = await admin.from("messages").upsert({ id: fiche.id, data: fiche, updated_at: tsl });
              if (e3) console.error("[rappels-du-matin] attestation : fiche légère non posée", e3.message);
            }
          }
        }
      }
      faits.push(`${u.nom_complet || u.nom} (${nomDocument(marque).toLowerCase()}, accès fermé le ${f.date} à ${f.heure}${!envoi ? ", pas de numéro : prévenez-le" : parti ? "" : ", message non parti"})`);
    } catch (e) {
      console.error("[rappels-du-matin] attestation", e?.message || e);
    }
  }

  for (const u of comptesAFermer(dbp, Date.now())) {
    try {
      const { data: frais } = await admin.from("users").select("id, data").eq("id", u.id).maybeSingle();
      if (!frais?.data || !comptesAFermer({ users: [frais.data] }, Date.now()).length) continue;
      const ts = new Date().toISOString();
      const data = { ...frais.data, actif: false, ferme_apres_sortie_le: ts, updated_at: ts };
      const { error } = await admin.from("users").update({ data, updated_at: ts }).eq("id", frais.id);
      if (error) { console.error("[rappels-du-matin] attestation : accès non fermé", error.message); continue; }
      bilan.fermes++; fermes.push(frais.data.nom_complet || frais.data.nom);
    } catch (e) {
      console.error("[rappels-du-matin] fermeture d'accès", e?.message || e);
    }
  }

  const n = notificationFinsDeContrat({ principal, faits, aCompleter, fermes, aujourdhui });
  return { bilan, notifications: n ? [fabriquerEnvoi(n)].filter(Boolean) : [] };
}
