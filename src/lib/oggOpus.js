// ============================================================
// lib/oggOpus.js — Une note vocale enregistrée par Chrome (WebM / Opus)
// REMISE dans une boîte Ogg, la seule que WhatsApp lit comme une NOTE VOCALE.
// ============================================================
// ⚠ POURQUOI (20/10/2026, Timo : « A avec a2, B lance » — enregistrer un
// vocal depuis l'application). Meta n'accepte une note vocale (le rond vert
// avec la photo, la vitesse, la transcription) QUE dans un fichier .ogg codé
// en Opus. Le micro de Chrome enregistre bien de l'Opus — mais dans une boîte
// WebM, que WhatsApp refuse. On ne RECODE rien : on sort les paquets Opus de
// la boîte WebM et on les range dans des pages Ogg. Le son est identique,
// octet pour octet.
// ⚠ SANS IMPORT, sans navigateur : le banc l'exerce sous Node ET dans Chromium.
// ⚠ Un fichier qu'on ne sait pas lire rend null — jamais un faux fichier :
// l'écran dit alors que la note ne peut pas partir.

const ID = {
  EBML: 0x1a45dfa3, SEGMENT: 0x18538067, CLUSTER: 0x1f43b675, TRACKS: 0x1654ae6b,
  TRACK_ENTRY: 0xae, BLOCK_GROUP: 0xa0, SIMPLE_BLOCK: 0xa3, BLOCK: 0xa1,
  CODEC_ID: 0x86, CODEC_PRIVATE: 0x63a2, AUDIO: 0xe1, CHANNELS: 0x9f, TRACK_NUMBER: 0xd7,
};
// Les éléments CONTENEURS : on entre dedans au lieu de les sauter (Chrome
// écrit le Segment et les Clusters avec une taille « inconnue »).
const CONTENEURS = new Set([ID.SEGMENT, ID.CLUSTER, ID.TRACKS, ID.TRACK_ENTRY, ID.BLOCK_GROUP, ID.AUDIO]);

// Un nombre de taille variable (vint) d'EBML. `garderMarque` : un IDENTIFIANT
// garde son premier bit, une TAILLE non. Rend { valeur, longueur, inconnue }.
function lireVint(o, pos, garderMarque) {
  const premier = o[pos];
  if (premier === undefined || premier === 0) return null;
  let longueur = 1;
  while (longueur <= 8 && !(premier & (0x80 >> (longueur - 1)))) longueur++;
  if (longueur > 8 || pos + longueur > o.length) return null;
  let valeur = garderMarque ? premier : premier & (0xff >> longueur);
  let tousUn = (premier & (0xff >> longueur)) === (0xff >> longueur);
  for (let i = 1; i < longueur; i++) {
    valeur = valeur * 256 + o[pos + i];
    if (o[pos + i] !== 0xff) tousUn = false;
  }
  return { valeur, longueur, inconnue: !garderMarque && tousUn };
}

// Combien d'échantillons (à 48 kHz) porte un paquet Opus — lu dans son
// premier octet (le « TOC », RFC 6716 § 3.1). Rend 0 sur un paquet illisible.
export function echantillonsOpus(paquet) {
  if (!paquet || !paquet.length) return 0;
  const toc = paquet[0];
  const config = toc >> 3;
  let parTrame;
  if (config < 12) parTrame = [480, 960, 1920, 2880][config & 3];
  else if (config < 16) parTrame = [480, 960][config & 1];
  else parTrame = [120, 240, 480, 960][config & 3];
  const c = toc & 3;
  let trames = 1;
  if (c === 1 || c === 2) trames = 2;
  else if (c === 3) { if (paquet.length < 2) return 0; trames = paquet[1] & 0x3f; }
  return parTrame * trames;
}

// Lit la boîte WebM : l'en-tête Opus (OpusHead) et les paquets, dans l'ordre.
// Rend null si ce n'est pas de l'Opus, ou si un bloc est « groupé » (lacing,
// que Chrome n'emploie pas pour l'Opus — on ne devine pas).
export function lireWebmOpus(octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  let pos = 0;
  let codec = "";
  let tete = null;
  let canaux = 1;
  let piste = 0;
  const paquets = [];
  while (pos < o.length) {
    const id = lireVint(o, pos, true);
    if (!id) break;
    const taille = lireVint(o, pos + id.longueur, false);
    if (!taille) break;
    const debut = pos + id.longueur + taille.longueur;
    if (CONTENEURS.has(id.valeur)) { pos = debut; continue; }
    if (taille.inconnue) return null;
    const fin = debut + taille.valeur;
    if (fin > o.length) break; // fin de fichier coupée : on garde ce qui est entier
    const donnees = o.subarray(debut, fin);
    if (id.valeur === ID.CODEC_ID) codec = String.fromCharCode(...donnees);
    else if (id.valeur === ID.CODEC_PRIVATE) tete = donnees.slice();
    else if (id.valeur === ID.CHANNELS) canaux = donnees[0] || 1;
    else if (id.valeur === ID.TRACK_NUMBER) piste = donnees[0] || 0;
    else if (id.valeur === ID.SIMPLE_BLOCK || id.valeur === ID.BLOCK) {
      const numero = lireVint(donnees, 0, false);
      if (!numero) return null;
      if (piste && numero.valeur !== piste) { pos = fin; continue; }
      const drapeaux = donnees[numero.longueur + 2];
      if (drapeaux & 0x06) return null; // lacing : jamais deviné
      const paquet = donnees.slice(numero.longueur + 3);
      if (paquet.length) paquets.push(paquet);
    }
    pos = fin;
  }
  if (codec && codec !== "A_OPUS") return null;
  if (!paquets.length) return null;
  if (!tete || String.fromCharCode(...tete.subarray(0, 8)) !== "OpusHead") tete = teteOpus(canaux);
  return { tete, paquets, canaux: tete[9] || canaux };
}

// L'en-tête Opus par défaut (RFC 7845 § 5.1), si la boîte n'en porte pas.
function teteOpus(canaux) {
  const t = new Uint8Array(19);
  t.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // « OpusHead »
  t[8] = 1;
  t[9] = canaux || 1;
  const v = new DataView(t.buffer);
  v.setUint16(10, 312, true); // pré-saut habituel de l'encodeur
  v.setUint32(12, 48000, true);
  return t;
}

// Le contrôle d'une page Ogg : CRC-32, polynôme 0x04c11db7, sans inversion.
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
    t[i] = r >>> 0;
  }
  return t;
})();
export function crcOgg(octets) {
  let crc = 0;
  for (let i = 0; i < octets.length; i++) crc = ((crc << 8) ^ TABLE_CRC[((crc >>> 24) ^ octets[i]) & 0xff]) >>> 0;
  return crc >>> 0;
}

// Une page Ogg : en-tête de 27 octets, table des segments, paquets.
function pageOgg({ paquets, granule, serie, numero, drapeaux }) {
  const segments = [];
  for (const p of paquets) {
    let reste = p.length;
    while (reste >= 255) { segments.push(255); reste -= 255; }
    segments.push(reste);
  }
  const corps = paquets.reduce((s, p) => s + p.length, 0);
  const page = new Uint8Array(27 + segments.length + corps);
  const v = new DataView(page.buffer);
  page.set([0x4f, 0x67, 0x67, 0x53], 0); // « OggS »
  page[4] = 0;
  page[5] = drapeaux;
  v.setUint32(6, granule % 0x100000000, true);
  v.setUint32(10, Math.floor(granule / 0x100000000), true);
  v.setUint32(14, serie, true);
  v.setUint32(18, numero, true);
  page[26] = segments.length;
  page.set(segments, 27);
  let p = 27 + segments.length;
  for (const paquet of paquets) { page.set(paquet, p); p += paquet.length; }
  v.setUint32(22, crcOgg(page), true);
  return page;
}

const segmentsDe = (p) => Math.floor(p.length / 255) + 1;
const OPUS_TAGS = (() => {
  const vendeur = "BMI TOGO";
  const t = new Uint8Array(8 + 4 + vendeur.length + 4);
  t.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // « OpusTags »
  new DataView(t.buffer).setUint32(8, vendeur.length, true);
  for (let i = 0; i < vendeur.length; i++) t[12 + i] = vendeur.charCodeAt(i);
  return t;
})();

// Range l'en-tête et les paquets dans un fichier Ogg Opus. Rend
// { octets, duree } (durée en secondes, pré-saut retiré).
export function oggDepuisOpus({ tete, paquets }, serie = 0x424d4931) {
  const pages = [pageOgg({ paquets: [tete], granule: 0, serie, numero: 0, drapeaux: 0x02 })];
  pages.push(pageOgg({ paquets: [OPUS_TAGS], granule: 0, serie, numero: 1, drapeaux: 0 }));
  let granule = 0;
  let lot = [];
  let nbSegments = 0;
  let numero = 2;
  const vider = (dernier) => {
    pages.push(pageOgg({ paquets: lot, granule, serie, numero: numero++, drapeaux: dernier ? 0x04 : 0 }));
    lot = [];
    nbSegments = 0;
  };
  paquets.forEach((p, i) => {
    const s = segmentsDe(p);
    if (lot.length && nbSegments + s > 255) vider(false);
    lot.push(p);
    nbSegments += s;
    granule += echantillonsOpus(p);
    if (i === paquets.length - 1) vider(true);
  });
  const total = pages.reduce((s, p) => s + p.length, 0);
  const octets = new Uint8Array(total);
  let pos = 0;
  for (const p of pages) { octets.set(p, pos); pos += p.length; }
  const preSaut = tete.length >= 12 ? tete[10] | (tete[11] << 8) : 0;
  return { octets, duree: Math.max(0, (granule - preSaut) / 48000) };
}

// Le tout : WebM / Opus → Ogg / Opus, ou null.
export function webmVersOgg(octets) {
  const lu = lireWebmOpus(octets);
  return lu ? oggDepuisOpus(lu) : null;
}

// Une durée en secondes, comme WhatsApp : « 0:07 », « 1:35 ».
export function dureeVocale(secondes) {
  const s = Math.max(0, Math.round(Number(secondes) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Le plus long qu'on enregistre : 5 minutes (le fichier reste sous 3 Mo).
export const DUREE_MAX_VOCAL = 300;
