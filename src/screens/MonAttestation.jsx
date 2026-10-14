import React from "react";
import { today } from "../lib/core";
import { maintenantMs } from "../lib/horloge";
import { contenuDocument } from "../lib/certificatTravail";
import { attestationDe, momentFermeture, nomDocument } from "../lib/attestationSortie";
import { LIBELLE_ROLE_EMPLOYE } from "../lib/comptesClients";
import { affectationDe } from "../lib/affectation";
import { imprimerDocumentEmploye } from "../lib/impression";
import { estCompteFormation } from "../lib/calculs";
import { btnDark } from "../components/ui";

// 📄 MON ATTESTATION (14/10/2026, Timo : « B b ») — le SEUL écran d'un employé
// sorti pendant ses 24 dernières heures. Le document n'est rangé nulle part :
// il se refait ici, signé du nom de celui qui l'a mis à disposition, avec le
// cachet de BMI — le même que ⋯ Gérer → Documents (lib/certificatTravail.js).
export function MonAttestation({ db, profile }) {
  const moi = (db.users || []).find((u) => u.id === profile.id) || profile;
  const a = attestationDe(moi);
  if (!a) return null;
  const f = momentFermeture(a);
  const reste = Math.max(0, Date.parse(a.ferme_le) - maintenantMs());
  const heures = Math.floor(reste / 3600000), minutes = Math.floor((reste % 3600000) / 60000);
  const signataire = (db.users || []).find((u) => u.id === a.par_id) || {};
  const telecharger = () => {
    const contenu = contenuDocument(a.type, {
      u: moi, poste: LIBELLE_ROLE_EMPLOYE[moi.role] || moi.role, lieu: affectationDe(moi),
      libelleRole: (r) => LIBELLE_ROLE_EMPLOYE[r] || r,
      signataire: { nom: signataire.nom_complet || signataire.nom || a.par, signature: signataire.signature_personnelle || "", sexe: signataire.sexe },
      appreciation: a.appreciation || "", aujourdhui: String(a.dispo_le || today()).slice(0, 10),
    });
    imprimerDocumentEmploye(contenu, db, estCompteFormation(db, moi));
  };
  return (
    <div data-mon-attestation className="max-w-xl mx-auto rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div className="text-lg font-bold text-slate-800">📄 {nomDocument(a)}</div>
      <p className="text-sm text-slate-700">Votre contrat avec BMI TOGO est terminé. Votre document de fin de contrat ({nomDocument(a).toLowerCase()}) est disponible : téléchargez ce document et gardez-le précieusement.</p>
      <button data-telecharger-attestation onClick={telecharger} className={btnDark}>📄 Télécharger le document</button>
      <p className="text-xs text-slate-500">Une fenêtre s'ouvre : sur téléphone, « Partager » l'enregistre en PDF ; sur ordinateur, « Imprimer » puis « Enregistrer en PDF ».</p>
      <div data-fermeture-acces className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
        Votre accès à l'application se ferme le <b>{f.date} à {f.heure}</b> (dans {heures} h {String(minutes).padStart(2, "0")}). Pour toute question : BMI TOGO, +228 99 96 84 88.
      </div>
    </div>
  );
}
