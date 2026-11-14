// ============================================================
// ⚖️ INFORMATIONS LÉGALES ET CONFIDENTIALITÉ (Timo, 14/11/2026, « Les deux,
// lance » — points 1, 2 et 3 de la liste « 20 choses » : mentions légales,
// confidentialité, conditions d'utilisation).
//
// UNE page, lisible SANS être connecté (écran de connexion) et depuis
// l'espace du client (🔒 Mes données). Les MOTS vivent ici, la fenêtre dans
// components/InfosLegales.jsx.
//
// ⚠ Chaque phrase dit ce que l'application FAIT. Une phrase qui devient
// fausse se corrige ici — le banc en vérifie quelques-unes contre le code.
// ⚠ La durée de conservation n'est écrite qu'à UN endroit
// (lib/conservation.js) : cette page la reprend, elle ne la recopie pas.
// ⚠ Décision de Timo (24/09/2026) : l'accueil de l'assistant ne dit pas où
// ses messages sont traités. Cette page ne le dit pas non plus tant qu'il ne
// l'a pas demandé ; elle NOMME les prestataires, sans plus.
// ============================================================
import { phraseConservation, DUREE_CONSERVATION_DEFAUT } from "./conservation.js";
import { NUMEROS_BMI } from "./whatsappModeles.js";

export const TITRE_INFOS_LEGALES = "Informations légales et confidentialité";
export const DATE_INFOS_LEGALES = "14/11/2026";
export const EMAIL_CONTACT_BMI = "contact@bmitogo.com";
export const SITE_BMI = "www.bmitogo.com";

// Les sections, dans l'ordre : { titre, lignes }.
export function sectionsLegales({ duree } = {}) {
  const ans = Number(duree) > 0 ? Number(duree) : DUREE_CONSERVATION_DEFAUT;
  return [
    { titre: "1. Qui édite cette application",
      lignes: [
        "BMI TOGO — Les Bâtiments Modernes et Intelligents, entreprise individuelle établie à Lomé (Togo).",
        "NIF 1001790098 · RCCM TG-LFW-01-2022-A10-01523.",
        `Nous écrire : ${EMAIL_CONTACT_BMI} · WhatsApp et téléphone : ${NUMEROS_BMI} · ${SITE_BMI}.`,
      ] },
    { titre: "2. Qui héberge l'application",
      lignes: [
        "L'application est hébergée par Vercel et sa base de données par Supabase, deux prestataires techniques spécialisés.",
        "Les messages WhatsApp que BMI TOGO vous envoie passent par WhatsApp Business (Meta) et son partenaire YCloud.",
      ] },
    { titre: "3. Ce que nous gardons à votre sujet",
      lignes: [
        "Votre nom, votre prénom et votre numéro de téléphone ; si vous achetez au nom d'une entreprise, ses coordonnées.",
        "Vos achats, vos devis, vos contrats, vos dettes et vos paiements, vos chantiers (adresse, position si elle a été enregistrée, signature du contrat et du procès-verbal).",
        "Les messages que vous échangez avec BMI TOGO, dans l'application et sur WhatsApp.",
        "Nous ne demandons que ce qui sert à vous servir.",
      ] },
    { titre: "4. À quoi elles servent",
      lignes: [
        "À tenir nos ventes, nos devis, nos contrats et nos garanties, et à vous écrire au sujet de vos affaires avec nous.",
        "Elles ne sont ni vendues, ni données à des tiers sans votre accord, sauf si la loi nous y oblige.",
      ] },
    { titre: "5. Combien de temps", lignes: [phraseConservation(ans)] },
    { titre: "6. Vos droits",
      lignes: [
        "Conformément à la loi n° 2019-014 relative à la protection des données à caractère personnel en République Togolaise, vous pouvez demander à voir vos données, à les faire corriger et, dans les conditions prévues par la loi, à les faire supprimer.",
        "Si vous avez un espace client : onglet « 🔒 Mes données » — vous y téléchargez tout ce que nous gardons sur vous et vous y faites votre demande. Sinon, écrivez-nous ou passez en boutique.",
      ] },
    { titre: "7. Nos messages WhatsApp",
      lignes: [
        "Nous vous écrivons au sujet de vos affaires : devis, reçus, rappels de paiement, rendez-vous d'installation.",
        "Nous envoyons parfois un message commercial (un mot de fidélité, une relance, une demande d'avis). Pour ne plus en recevoir, répondez STOP ou dites-le en boutique : nous n'en envoyons plus à votre numéro. Vos reçus et vos rappels de paiement continuent.",
        "Sur WhatsApp, un assistant automatique peut vous répondre : c'est un programme, pas une personne. Écrivez « conseiller » pour parler à quelqu'un.",
      ] },
    { titre: "8. Cookies et suivi",
      lignes: [
        "Cette application n'utilise aucun cookie publicitaire et aucun outil de mesure d'audience. Votre appareil garde seulement ce qu'il faut pour fonctionner : votre session et une copie de vos données pour travailler hors connexion.",
      ] },
    { titre: "9. Sécurité",
      lignes: [
        "Votre mot de passe n'est jamais gardé en clair. Si vous utilisez l'empreinte digitale, c'est votre téléphone qui la vérifie : l'application ne la lit jamais.",
      ] },
    { titre: "10. Conditions d'utilisation de votre espace",
      lignes: [
        "Vos identifiants sont personnels : ne les communiquez à personne.",
        "Ce que vous validez dans votre espace — un devis, un contrat, un procès-verbal de réception — vous engage comme une signature sur papier.",
        "Une offre de prix est valable 15 jours. Les conditions de chaque vente ou installation sont celles écrites sur votre reçu ou votre contrat.",
      ] },
  ];
}
