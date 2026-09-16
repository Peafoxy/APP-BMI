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
//
// ⚠⚠ CE QUI A FAIT ÉCHOUER LA PREMIÈRE VERSION (Timo, 16/09/2026 : « je
// pense que le fonctionnement n'a pas réussi »), et qu'il ne faut JAMAIS
// refaire. Deux fautes, l'une cachant l'autre :
//
//   1. LE GESTE DOIT ÊTRE ENCORE CHAUD. Le capteur n'obéit qu'à un clic
//      RÉCENT (« transient user activation »). Un `await` posé AVANT
//      l'appel consomme ce droit : la première version vérifiait le mot de
//      passe (calcul long) PUIS appelait le capteur — refusé à tous les
//      coups. **La touche du capteur se fait DANS le clic, en premier, sans
//      un seul `await` devant.** Le mot de passe se vérifie APRÈS : il est
//      déjà tapé dans la case, rien n'est perdu.
//   2. LES ERREURS ÉTAIENT AVALÉES (`catch { return "" }`). Rien ne se
//      passait et personne ne pouvait savoir pourquoi. Le capteur dit
//      TOUJOURS pourquoi, en un nom (NotAllowedError, NotSupportedError…) :
//      on le remonte, lib/empreinte.js le traduit, l'écran l'affiche.
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
// ⚠ À APPELER DANS LE CLIC, avant tout `await` — voir l'entête.
// Rend { cle } si c'est fait, { erreur: "<NomDeLErreur>" } sinon.
export async function creerEmpreinte(profile) {
  try {
    // L'identifiant du compte, en octets. La norme le plafonne à 64 octets :
    // au-delà, le téléphone refuse (et ne dit pas toujours pourquoi).
    const id = new TextEncoder().encode(String(profile?.id || "bmi")).slice(0, 64);
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: octetsAuHasard(32),
        rp: { name: "BMI-Gestion" }, // sans `id` : le domaine courant fait foi
        user: { id, name: String(profile?.nom || "Compte"), displayName: String(profile?.nom || "Compte") },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000,
        attestation: "none", // on ne veut RIEN savoir de l'appareil
      },
    });
    return cred ? { cle: versTexte(cred.rawId) } : { erreur: "UnknownError" };
  } catch (e) { return { erreur: e?.name || "UnknownError" }; }
}

// OUVRIR : on redemande au téléphone de reconnaître la personne, avec LA
// clé de cet appareil. ⚠ Même règle : appelé dans le clic, sans `await`
// devant. Rend { ok: true } ou { erreur: "<NomDeLErreur>" }.
export async function verifierEmpreinte(cle) {
  try {
    if (!cle) return { erreur: "NotAllowedError" };
    const a = await navigator.credentials.get({
      publicKey: {
        challenge: octetsAuHasard(32),
        allowCredentials: [{ type: "public-key", id: versOctets(cle) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return a ? { ok: true } : { erreur: "NotAllowedError" };
  } catch (e) { return { erreur: e?.name || "UnknownError" }; }
}
