// ============================================================
// api/_relanceAssistant.js — 🤖 LA RELANCE DE L'ASSISTANT, CÔTÉ SERVEUR (17/10/2026)
//
// La règle (quand relancer, ce qu'on demande à l'IA, la phrase de repli) vit
// dans src/lib/relanceAssistant.js. Ici : lire, réserver, envoyer, écrire.
// Le « _ » devant le nom : ce n'est PAS une fonction Vercel (douze au plus).
//
// ⚠ QUI L'APPELLE : l'adresse d'arrivée (api/whatsapp-entrant.js) — à chaque
// message d'un client et à chaque coche ✓ / ✓✓, donc très souvent — et les
// tournées de 7 h, 14 h et 17 h, qui servent de filet. Notre hébergement
// gratuit n'accepte pas de tournée plus fréquente.
// ⚠ RIEN N'EST ÉCRIT DANS LE FIL TANT QUE LE MESSAGE N'EST PAS PARTI.
// ⚠ Deux arrivées en même temps ne relancent pas deux fois : la fiche légère
// de la conversation est RÉSERVÉE d'abord (`wa_relance_pour`), par une mise
// à jour conditionnelle — celle qui ne trouve rien à réserver s'arrête.
// ============================================================
import { proprietaireDe, filDeLaConversation, construireEntete, idEntete, estEnteteWa } from "../src/lib/whatsappConversations.js";
import { numeroComparable } from "../src/lib/identiteClient.js";
import { numeroWhatsApp } from "../src/lib/whatsappModeles.js";
import { assistantActif } from "../src/lib/assistantWhatsapp.js";
import { consignePour, converserAvecIA, modeAssistant, domainesPourIA, memoAssistant } from "../src/lib/assistantIA.js";
import { conversationsARelancer, relanceAFaire, consigneRelance, messagesPourRelance, texteDeRelance, ligneRelance, TEXTE_RELANCE_FIXE } from "../src/lib/relanceAssistant.js";
import { champsEnvoi } from "../src/lib/suiviEnvoi.js";
import { configIA, appelerIA } from "./_assistantIA.js";
import { signalerPanneIA } from "./_alertePanneIA.js";
import { configYCloud, envoyerYCloud, corpsTexte } from "./_ycloud.js";

const HEURES_LUES = 25;

// Rend { relances, essais, pourquoi }. `limite` : combien au plus dans cet
// appel ; `delaiIA` : le temps laissé au service d'IA (l'adresse d'arrivée
// doit répondre vite à YCloud, la tournée a le temps).
export async function relancerLesConversations(admin, { boutiques = null, limite = 1, delaiIA = 8000 } = {}) {
  const ia = configIA();
  if (!ia.pret) return { relances: 0, pourquoi: "service d'IA non configuré : pas de relance" };
  const { cle: cleYCloud, expediteurBrut } = configYCloud();
  const expediteur = numeroWhatsApp(expediteurBrut);
  if (!cleYCloud || !expediteur) return { relances: 0, pourquoi: "WhatsApp non configuré sur le serveur" };
  let bqs = boutiques;
  if (!bqs) {
    const { data } = await admin.from("boutiques").select("data");
    bqs = (data || []).map((b) => b.data || {});
  }
  if (!assistantActif(bqs)) return { relances: 0, pourquoi: "assistant coupé" };
  if (modeAssistant(bqs) !== "ia") return { relances: 0, pourquoi: "mode menu à chiffres : pas de relance" };

  const maintenant = new Date().toISOString();
  const depuis = new Date(Date.now() - HEURES_LUES * 3600 * 1000).toISOString();
  const { data: recentes, error } = await admin.from("messages").select("id, data").gte("updated_at", depuis);
  if (error) throw error;
  const candidates = conversationsARelancer((recentes || []).map((l) => ({ ...(l.data || {}), id: l.id })), maintenant);
  if (!candidates.length) return { relances: 0, pourquoi: "aucune conversation à relancer" };

  let comptes = null;
  let relances = 0;
  const essais = [];
  for (const c of candidates.slice(0, Math.max(1, limite))) {
    try {
      // Le fil ENTIER : le propriétaire peut avoir été posé il y a longtemps.
      const { data: lignes, error: errF } = await admin.from("messages").select("id, data").eq("data->>wa_tel", c.cle);
      if (errF) throw errF;
      const tout = (lignes || []).map((l) => ({ ...(l.data || {}), id: l.id }));
      const fil = filDeLaConversation(tout, c.cle);
      const proprietaire = proprietaireDe(fil);
      const d = relanceAFaire({ fil, maintenant, proprietaireId: proprietaire.id });
      if (!d.relancer) { essais.push({ cle: c.cle, pourquoi: d.pourquoi }); continue; }

      // ---- RÉSERVER la relance sur la fiche légère ----
      const fiche = tout.find((m) => m.id === idEntete(c.cle) && estEnteteWa(m)) || null;
      if (!fiche) { essais.push({ cle: c.cle, pourquoi: "fiche de conversation absente" }); continue; }
      if (fiche.wa_relance_pour === d.marque) { essais.push({ cle: c.cle, pourquoi: "déjà réservée" }); continue; }
      const tsRes = new Date().toISOString();
      const { data: prise, error: errR } = await admin.from("messages")
        .update({ data: { ...fiche, wa_relance_pour: d.marque }, updated_at: tsRes })
        .eq("id", fiche.id)
        .or(`data->>wa_relance_pour.is.null,data->>wa_relance_pour.neq.${d.marque}`)
        .select("id");
      if (errR) throw errR;
      if (!prise || !prise.length) { essais.push({ cle: c.cle, pourquoi: "réservée par un autre appel" }); continue; }

      // ---- LE CLIENT, pour l'appeler par son nom ----
      if (!comptes) {
        const { data: us } = await admin.from("users").select("id, data");
        comptes = (us || []).map((l) => ({ ...(l.data || {}), id: l.id }));
      }
      const client = comptes.find((u) => u.role === "client" && numeroComparable(u.tel) === c.cle) || null;
      const numero = fiche.wa_numero || fil.find((m) => m.wa_numero)?.wa_numero || c.cle;

      // ---- LE TEXTE : l'IA, jugée ; sinon la phrase fixe ----
      let texteIA = "";
      try {
        const conv = await converserAvecIA({
          consigne: consigneRelance(consignePour({ client: client ? { nom: client.nom } : null, nouvelle: false, metiers: domainesPourIA(bqs), memo: memoAssistant(bqs) })),
          messages: messagesPourRelance(fil),
          appeler: (corps) => appelerIA(corps, { ...ia, delai: delaiIA }),
          // Aucun outil pendant une relance : elle ne cherche rien, n'enregistre rien.
          executer: async () => ({ resultat: "Pas d'outil pendant une relance : écris seulement la relance.", effets: {} }),
        });
        texteIA = conv.texte;
      } catch (e) {
        console.error("[relance assistant] IA indisponible, phrase fixe —", e?.message || e);
        await signalerPanneIA(admin, e);
      }
      const choix = texteIA ? texteDeRelance(texteIA) : { texte: TEXTE_RELANCE_FIXE, ia: false, motif: "pas de réponse de l'IA" };
      if (choix.motif && texteIA) console.error("[relance assistant] réponse de l'IA jetée —", choix.motif, "(phrase fixe)");
      // L'IA juge qu'il n'y a rien à reprendre (22/10/2026) : rien ne part, et
      // la réservation reste — on ne redemande pas pour ce message du client.
      if (choix.rien) { essais.push({ cle: c.cle, pourquoi: "rien à reprendre (jugé par l'IA)" }); continue; }

      const destinataire = numeroWhatsApp(numero);
      if (!destinataire) { essais.push({ cle: c.cle, pourquoi: "numéro illisible" }); continue; }
      const envoi = await envoyerYCloud(cleYCloud, corpsTexte(expediteur, destinataire, choix.texte));
      if (!envoi.ok) {
        // ⚠ Rien n'est écrit dans le fil. La réservation reste : une relance
        // refusée (fenêtre fermée…) ne se retente pas pour ce message-là.
        console.error("[relance assistant] WhatsApp a refusé", envoi.code_whatsapp, envoi.motif);
        essais.push({ cle: c.cle, pourquoi: `refus WhatsApp ${envoi.code_whatsapp || ""}` });
        continue;
      }
      const ts = new Date().toISOString();
      const ligne = { ...ligneRelance({ cle: c.cle, tel: numero, nom: client?.nom || "", texte: choix.texte, ts, memoire: d.derniere?.wa_assistant?.memoire || null, ia: choix.ia }), ...champsEnvoi(envoi) };
      const { error: errIns } = await admin.from("messages").insert({ id: ligne.id, data: ligne, updated_at: ts });
      if (errIns) throw errIns;
      // La fiche légère suit (dernier message) ; le propriétaire ne change pas.
      const ficheApres = construireEntete({ cle: c.cle, tel: numero, nom: client?.nom || fiche.wa_nom || "", proprietaire_id: proprietaire.id, proprietaire_nom: proprietaire.nom, derniere: ts, entete: fiche });
      if (ficheApres) {
        const { error: errFiche } = await admin.from("messages").upsert({ id: ficheApres.id, data: { ...ficheApres, wa_relance_pour: d.marque }, updated_at: ts });
        if (errFiche) console.error("[relance assistant] fiche de conversation non posée", errFiche);
      }
      relances += 1;
      essais.push({ cle: c.cle, relance: true, ia: choix.ia });
    } catch (e) {
      console.error("[relance assistant]", c.cle, e?.message || e);
      essais.push({ cle: c.cle, pourquoi: "erreur" });
    }
  }
  return { relances, essais };
}
