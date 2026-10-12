// ============================================================
// lib/affectationChantier.js — QUI EST PRÉVENU QUAND UNE INSTALLATION EST
// PROGRAMMÉE, ET DE QUOI (12/10/2026)
//
// Timo, devant les messages internes « 📅 Vous avez été affecté comme chef
// d'équipe ⭐ à l'installation de … » : « message WhatsApp pour informer les
// techniciens programmés sur un chantier… de cette manière mais amélioré »,
// puis « Aa, Ba, Ca, texte ok » et « un chef d'équipe remplacé aussi devrait
// être notifié qu'il n'est plus le chef d'équipe ».
//   • « A a » : le numéro du client dans le message du CHEF seulement ;
//   • « B a » : un second modèle court pour un retrait de l'équipe, un
//     chantier déplacé, un chef remplacé ;
//   • « C a » : la VEILLE à 17 h, un rappel au chef d'équipe
//     (api/rappels-du-soir.js).
// Les textes vivent dans lib/whatsappModeles.js ; ici, la règle de QUI reçoit
// QUOI. Rien n'est écrit ici.
//
// Règle pure, lue par le serveur : imports écrits avec `.js`.
// ============================================================
import { jourEnClair, envoiRappelInstallation, numeroWhatsApp } from "./whatsappModeles.js";
import { chantierDeFormation } from "./rappelEntretien.js";
import { estSupprime } from "./corbeille.js";
import { estCompteFormation } from "./espace.js";
import { lendemain } from "./anniversaires.js";

const membres = (equipe) => (equipe || []).filter((e) => e && e.user_id && !e.prime_employe);

// Ce qu'une programmation change pour chacun. `avant` / `apres` = { equipe,
// date }. Rend :
//   • principal : les membres qui reçoivent l'AVIS D'AFFECTATION complet —
//     nouveaux dans l'équipe, nommés chef, ou tout le monde à la première
//     programmation (aucune date avant) ;
//   • changements : [{ e, phrase }] — retirés de l'équipe, chantier déplacé,
//     chef remplacé (qui reste dans l'équipe). Plusieurs changements pour la
//     même personne tiennent dans UNE phrase (un seul message).
// Une programmation ré-enregistrée sans rien changer ne prévient personne.
export function changementsAffectation(avant, apres) {
  const eqA = membres(avant?.equipe), eqB = membres(apres?.equipe);
  const dateA = String(avant?.date || "").slice(0, 10), dateB = String(apres?.date || "").slice(0, 10);
  const parIdA = new Map(eqA.map((e) => [e.user_id, e]));
  const idsB = new Set(eqB.map((e) => e.user_id));
  const chefB = eqB.find((e) => e.chef);
  const deplace = !!dateA && !!dateB && dateA !== dateB;

  const principal = [], changements = [];
  for (const e of eqB) {
    const a = parIdA.get(e.user_id);
    if (!dateA || !a || (e.chef && !a.chef)) { principal.push(e); continue; }
    const parts = [];
    if (deplace) parts.push(`Elle est déplacée au ${jourEnClair(dateB)} (au lieu du ${jourEnClair(dateA)}).`);
    if (a.chef && !e.chef) parts.push(`Vous n'êtes plus le chef d'équipe${chefB?.nom ? ` ; le nouveau chef est ${chefB.nom}` : ""}. Vous restez dans l'équipe.`);
    if (parts.length) changements.push({ e, phrase: parts.join(" ") });
  }
  for (const a of eqA) {
    if (idsB.has(a.user_id)) continue;
    changements.push({
      e: a,
      phrase: `Vous n'êtes plus affecté à cette installation${dateA ? `, prévue le ${jourEnClair(dateA)}` : ""}.${a.chef ? " Vous n'en êtes plus le chef d'équipe." : ""}`,
    });
  }
  return { principal, changements };
}

// « C a » : les rappels de la veille (tournée de 17 h). Les chantiers dont
// l'installation tombe DEMAIN, encore en cours, avec un chef d'équipe RÉEL,
// actif, non bloqué, qui a un numéro. ⚠ LE MUR : jamais un chantier de
// formation (sa marque, sa boutique, le compte du client) ni un chef de
// formation ; jamais des travaux à crédit ni la corbeille.
export function installationsDeDemain(db, aujourdhui) {
  const demain = lendemain(aujourdhui);
  const users = db?.users || [];
  const out = [];
  for (const c of db?.clients_installes || []) {
    if (!c || estSupprime(c) || c.travaux) continue;
    if ((c.statut || "en_cours") !== "en_cours") continue;
    if (String(c.date_installation || "").slice(0, 10) !== demain) continue;
    const compte = c.user_id ? users.find((u) => u && u.id === c.user_id) : null;
    if (chantierDeFormation(db, c, compte)) continue;
    const ch = membres(c.equipe).find((e) => e.chef);
    const chef = ch && users.find((u) => u && u.id === ch.user_id && u.role !== "client" && u.actif !== false && !u.bloque);
    if (!chef || estCompteFormation(db, chef)) continue;
    if (String(chef.tel || "").replace(/\D/g, "").length < 8) continue;
    const tel = numeroWhatsApp(chef.tel);
    const envoi = envoiRappelInstallation({ chef: chef.nom_complet || chef.nom, chantier: c, date: c.date_installation, equipe: c.equipe });
    if (envoi) out.push({ chantier: c, chef, tel, envoi });
  }
  return out;
}
