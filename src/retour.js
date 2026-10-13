// ============================================================
// src/retour.js — la TOUCHE RETOUR d'Android, branchée sur la liste des
// pages du téléphone (`window.history`). C'est le SEUL fichier qui écrit
// dans cette liste et qui écoute l'appui sur retour (le banc l'impose),
// comme src/push.js pour les notifications.
//
// Timo (13/10/2026, « A a, B b, C a ») — la règle vit dans
// lib/pileRetour.js. Ici :
//   - `ouvrirRetour(fermer)` : une chose s'ouvre → une marque dans la liste ;
//   - `useRetour(ouvert, fermer)` : le même pour un composant React
//     (conversation, panneau, fenêtre) — fermée par l'écran, sa marque meurt ;
//   - au premier écran, la pile est vide : le téléphone quitte (B b) ;
//   - verrouillée, l'application ne bouge pas : la marque est remise.
// ============================================================
import { useEffect, useRef } from "react";
import { creerPile } from "./lib/pileRetour";

const pile = creerPile();
let aIgnorer = 0;      // reculs que NOUS avons demandés (pas un appui)
let ouvertures = 0;    // compteur : rien d'autre n'a été ouvert depuis ? on peut compacter
let estBloque = () => false;
let installe = false;
const MARQUE = { bmiRetour: true };

function reculer(n) {
  if (n <= 0) return;
  aIgnorer++;
  try { window.history.go(-n); } catch { aIgnorer--; }
}

function surRetour(e) {
  if (aIgnorer > 0) { aIgnorer--; return; }
  // Verrouillée : rien ne bouge derrière la fenêtre du mot de passe — on
  // remet la marque que le téléphone vient de consommer.
  if (estBloque()) {
    if (pile.taille() > 0) { try { window.history.pushState(MARQUE, ""); } catch { /* rien */ } }
    return;
  }
  const { fermer, reculer: pas } = pile.retour();
  reculer(pas);
  if (fermer) { try { fermer(); } catch (err) { console.warn("Retour : fermeture impossible", err); } }
  // Une marque d'un chargement PRÉCÉDENT de la page (après un F5) : rien à
  // fermer, on la saute pour ne pas faire appuyer pour rien.
  else if (pas === 0 && pile.taille() === 0 && e && e.state && e.state.bmiRetour) reculer(1);
}

function installer() {
  if (installe || typeof window === "undefined" || !window.history) return;
  installe = true;
  window.addEventListener("popstate", surRetour);
}

function planifierCompactage() {
  if (typeof window === "undefined") return;
  const avant = ouvertures;
  setTimeout(() => {
    if (ouvertures !== avant) return; // un autre écran a été ouvert : on saute plus tard
    reculer(pile.compacter());
  }, 60);
}

// Une chose s'ouvre (un onglet quitté, une conversation…) : `fermer` sera
// appelé si l'on appuie sur retour. Rend son numéro.
export function ouvrirRetour(fermer) {
  if (typeof window === "undefined" || !window.history) return 0;
  installer();
  const id = pile.ouvrir(fermer);
  ouvertures++;
  try { window.history.pushState(MARQUE, ""); } catch { /* rien */ }
  return id;
}

// L'écran l'a fermée lui-même (« ← », « Annuler », « Fermer »).
export function fermerParEcran(id) {
  if (!id) return;
  pile.fermeParEcran(id);
  planifierCompactage();
}

// Déconnexion : plus rien d'ouvert ne compte.
export function viderRetour() {
  pile.vider();
  planifierCompactage();
}

// Tant que `fn()` est vrai (session verrouillée), retour ne ferme rien.
export function poserBlocageRetour(fn) { estBloque = typeof fn === "function" ? fn : () => false; }

// Pour un composant : `ouvert` vrai → une marque ; `fermer` appelé au retour.
export function useRetour(ouvert, fermer) {
  const fermerRef = useRef(fermer);
  fermerRef.current = fermer;
  useEffect(() => {
    if (!ouvert) return undefined;
    const id = ouvrirRetour(() => { if (fermerRef.current) fermerRef.current(); });
    return () => fermerParEcran(id);
  }, [ouvert]);
}

// Les ONGLETS (App.jsx) : quitter un onglet pose une marque, retour ramène
// à l'onglet d'avant. Rien avant la connexion ; un changement de compte (ou
// la déconnexion) vide la pile.
export function useRetourOnglets(tab, setTab, idProfil) {
  const avantRef = useRef(null);
  const profilRef = useRef(null);
  const parRetour = useRef(false);
  const courant = useRef(tab);
  courant.current = tab;
  useEffect(() => {
    const avant = avantRef.current;
    avantRef.current = tab;
    if (profilRef.current !== idProfil) {
      if (profilRef.current) viderRetour();
      profilRef.current = idProfil;
      parRetour.current = false;
      return;
    }
    if (!idProfil || avant == null || avant === tab) return;
    if (parRetour.current) { parRetour.current = false; return; }
    ouvrirRetour(() => {
      if (courant.current === avant) return;
      parRetour.current = true;
      setTab(avant);
    });
  }, [tab, idProfil]);
}

// Pour le banc seul.
export const _pourLeBanc = { pile, etat: () => ({ aIgnorer, ouvertures }) };
