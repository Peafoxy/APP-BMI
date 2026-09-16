// ============================================================
// src/empreinte.js — LE SEUL ENDROIT QUI PARLE AU CAPTEUR (16/09/2026)
//
// Comme src/push.js est le seul détenteur des notifications, ce fichier est
// le SEUL à toucher `navigator.credentials` et `PublicKeyCredential` — le
// banc l'impose. Les règles (qui, quand, ce qu'on range) vivent dans
// lib/empreinte.js, sans une ligne de navigateur.
//
// ⚠ NIVEAU 1 (voir lib/empreinte.js) : le défi est tiré ICI, dans le
// navigateur, et la réponse du téléphone n'est PAS vérifiée par notre
// serveur. C'est une commodité pour ouvrir le verrou d'inactivité, pas un
// verrou. Le niveau 2 gardera exactement ces deux fonctions et ajoutera la
// vérification côté Vercel.
//
// Rien du doigt n'arrive jusqu'ici : le téléphone répond par une signature,
// on ne garde que l'identifiant de la clé qu'il a fabriquée.
// ============================================================
import { uid } from "./lib/core";
import { nomAppareil } from "./lib/empreinte";

const CLE_APPAREIL = "bmi_appareil";

// L'identifiant de CET appareil. Il vit dans le navigateur, pas sur la
// fiche : vider les données du site le perd, et la personne réactive
// l'empreinte — c'est le seul dégât possible.
export const idAppareil = () => {
  try {
    let v = localStorage.getItem(CLE_APPAREIL);
    if (!v) { v = uid(); localStorage.setItem(CLE_APPAREIL, v); }
    return v;
  } catch { return ""; } // navigation privée : pas d'empreinte, le mot de passe reste
};

export const nomDeCetAppareil = () => nomAppareil(typeof navigator !== "undefined" ? navigator.userAgent : "");

// Le téléphone a-t-il un capteur configuré (empreinte, visage) ?
export async function empreinteDisponible() {
  try {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
    if (!navigator.credentials?.create) return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

const octetsAuHasard = (n) => { const t = new Uint8Array(n); crypto.getRandomValues(t); return t; };
const versTexte = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const versOctets = (txt) => {
  const s = String(txt).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
};

// ACTIVER : le téléphone fabrique une clé pour cette personne, sur cet
// appareil. Il demande le doigt tout seul, avec SA fenêtre à lui.
// Rend la clé à ranger sur la fiche, ou "" si la personne a refusé.
export async function creerEmpreinte(profile) {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: octetsAuHasard(32),
        rp: { name: "BMI-Gestion" }, // le domaine courant fait foi
        user: { id: versOctets(versTexte(new TextEncoder().encode(String(profile?.id || "")))), name: String(profile?.nom || "Compte"), displayName: String(profile?.nom || "Compte") },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
        attestation: "none", // on ne veut RIEN savoir de l'appareil
      },
    });
    return cred ? versTexte(cred.rawId) : "";
  } catch { return ""; } // refus, doigt non reconnu, capteur absent
}

// OUVRIR : on redemande au téléphone de reconnaître la personne, avec LA
// clé de cet appareil. Rend vrai si le téléphone a dit oui.
export async function verifierEmpreinte(cle) {
  try {
    if (!cle) return false;
    const a = await navigator.credentials.get({
      publicKey: {
        challenge: octetsAuHasard(32),
        allowCredentials: [{ type: "public-key", id: versOctets(cle) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!a;
  } catch { return false; } // doigt mouillé, annulation, clé effacée du téléphone
}
