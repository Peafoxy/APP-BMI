// ============================================================
// public/push-sw.js — la partie du service worker qui REÇOIT une
// notification et l'affiche, même application fermée, écran éteint.
// Chargé par le service worker généré (vite.config.js → importScripts).
//
// Le contenu (titre, texte, écran à ouvrir) vient du serveur
// (api/_push.js) : ici on ne décide rien, on affiche. Un clic ouvre
// l'application sur l'écran demandé (ou la ramène au premier plan et le
// lui dit). Rien ici ne lit ni n'écrit de données.
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
    data: { ecran: d.ecran || "" },
  };
  evenement.waitUntil(self.registration.showNotification(titre, options));
});

self.addEventListener("notificationclick", (evenement) => {
  evenement.notification.close();
  const ecran = (evenement.notification.data && evenement.notification.data.ecran) || "";
  evenement.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
      const ouverte = fenetres.find((f) => "focus" in f);
      if (ouverte) {
        ouverte.focus();
        ouverte.postMessage({ type: "ouvrir-ecran", ecran });
        return undefined;
      }
      return clients.openWindow(`./?ecran=${encodeURIComponent(ecran)}`);
    }),
  );
});
