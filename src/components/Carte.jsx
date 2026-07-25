// ============================================================
// components/Carte.jsx — Carte OpenStreetMap/Leaflet pour choisir
// une position (prospects, clients installés, espace client).
// Leaflet est chargé à la demande depuis le CDN, une seule fois.
// ============================================================
import { useState, useEffect, useRef } from "react";
import { uAlert } from "../components/ui";

let leafletChargement = null;
function chargerLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletChargement) return leafletChargement;
  leafletChargement = new Promise((resolve, reject) => {
    const lien = document.createElement("link");
    lien.rel = "stylesheet";
    lien.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(lien);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Impossible de charger la carte (vérifiez la connexion internet)."));
    document.head.appendChild(script);
  });
  return leafletChargement;
}

// Centre par défaut : Lomé, Togo
const LOME = [6.1319, 1.2228];

export function CarteChoixPosition({ lat, lng, onChoisir }) {
  const conteneurRef = useRef(null);
  const mapRef = useRef(null);
  const marqueurRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    chargerLeaflet()
      .then((L) => {
        if (annule || !conteneurRef.current || mapRef.current) return;
        const depart = lat && lng ? [lat, lng] : LOME;
        const map = L.map(conteneurRef.current).setView(depart, lat && lng ? 15 : 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        const marqueur = L.marker(depart, { draggable: true }).addTo(map);
        marqueur.on("dragend", () => { const p = marqueur.getLatLng(); onChoisir(p.lat, p.lng); });
        map.on("click", (e) => { marqueur.setLatLng(e.latlng); onChoisir(e.latlng.lat, e.latlng.lng); });
        mapRef.current = map;
        marqueurRef.current = marqueur;
        setPret(true);
      })
      .catch((e) => setErreur(e.message));
    return () => {
      annule = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maPosition = () => {
    if (!navigator.geolocation) { uAlert("La géolocalisation n'est pas disponible sur cet appareil."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onChoisir(latitude, longitude);
        if (mapRef.current && marqueurRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          marqueurRef.current.setLatLng([latitude, longitude]);
        }
      },
      () => uAlert("Impossible de récupérer votre position. Vérifiez que la localisation est activée."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
        <span className="text-xs text-slate-500">Cliquez sur la carte, ou faites glisser le repère, pour indiquer la maison du prospect.</span>
        <button type="button" onClick={maPosition} className="text-xs font-bold text-sky-800 underline whitespace-nowrap ml-2">📍 Ma position actuelle</button>
      </div>
      {erreur && <div className="p-3 text-sm text-red-600">{erreur}</div>}
      <div ref={conteneurRef} style={{ height: 260 }} className={pret ? "" : "flex items-center justify-center bg-slate-50 text-slate-400 text-sm"}>
        {!pret && !erreur && "Chargement de la carte…"}
      </div>
      {lat && lng && <div className="px-3 py-1.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">Position choisie : {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</div>}
    </div>
  );
}
