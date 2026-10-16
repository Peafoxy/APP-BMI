// ============================================================
// public/push-sw.js — la partie du service worker qui REÇOIT une
// notification et l'affiche, même application fermée, écran éteint.
// Chargé par le service worker généré (vite.config.js → importScripts).
//
// Le contenu (titre, texte, écran à ouvrir) vient du serveur
// (api/_push.js) : ici on ne décide rien, on affiche. Un clic ouvre
// l'application sur l'écran demandé (ou la ramène au premier plan et le
// lui dit). Rien ici ne lit ni n'écrit de données.
// ⚠ 16/10/2026 (« elles ne conduisent pas à la source ») : la notification
// porte aussi sa CIBLE (boutique, ligne, conversation) et la personne visée
// (`pour`). Ici on les fait suivre telles quelles ; c'est l'application qui
// décide (le rôle, le mur, la bonne personne — lib/cibleNotification.js).
// ============================================================
/* global self, clients */
self.addEventListener("push", (evenement) => {
  let d = {};
  try { d = evenement.data ? evenement.data.json() : {}; } catch { d = { texte: evenement.data ? evenement.data.text() : "" }; }
  const titre = d.titre || "BMI Gestion";
  const options = {
    body: d.texte || "",
    icon: "/icone-bmi-192-v2.png",
    badge: "/icone-bmi-192-v2.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { ecran: d.ecran || "", cible: d.cible || null, pour: d.pour || "" },
  };
  evenement.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const donnees = evenement.notification.data || {};
  const ecran = donnees.ecran || "";
  const cible = donnees.cible || null;
  const pour = donnees.pour || "";
  evenement.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => "focus" in f);
      if (ouverte) {
        ouverte.focus();
        ouverte.postMessage({ type: "ouvrir-ecran", ecran, cible, pour });
        return undefined;
      }
      // Même écriture que adresseDeCible (lib/cibleNotification.js).
      const p = new URLSearchParams();
      if (ecran) p.set("ecran", ecran);
      if (cible) p.set("cible", JSON.stringify(cible));
      if (pour) p.set("pour", String(pour));
      return clients.openWindow(`./?${p.toString()}`);
    }),
  );
});
