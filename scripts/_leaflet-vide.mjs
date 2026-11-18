// Leaflet touche `window` dès qu'on l'importe : le banc de rendu le remplace par un faux (la carte n'est pas montée).
const L = { Icon: { Default: { prototype: {}, mergeOptions() {} } }, icon: () => ({}), divIcon: () => ({}), latLng: (a, b) => ({ lat: a, lng: b }) };
export default L;
