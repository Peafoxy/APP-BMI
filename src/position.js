// ============================================================
// src/position.js — LA POSITION DE L'APPAREIL, AU MOMENT D'UN GESTE
// (Timo, 15/11/2026, « A b, B a ») : à l'enregistrement d'un prospect et à
// « Je l'ai contacté ». UNE lecture, jamais un suivi. Ne lève jamais et ne
// bloque jamais le geste : sans réponse dans le délai (ou refusée), elle
// rend null, et lib/activiteProspection.js écrit « position non donnée ».
// ============================================================
export function positionActuelle(delaiMs = 10000) {
  return new Promise((resoudre) => {
    let fini = false;
    const rendre = (v) => { if (!fini) { fini = true; resoudre(v); } };
    try {
      if (typeof navigator === "undefined" || !navigator.geolocation) { rendre(null); return; }
      setTimeout(() => rendre(null), delaiMs + 500);
      navigator.geolocation.getCurrentPosition(
        (pos) => rendre({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: pos.coords.accuracy }),
        () => rendre(null),
        { enableHighAccuracy: true, timeout: delaiMs, maximumAge: 60000 }
      );
    } catch { rendre(null); }
  });
}
