// Code d'une boîte pour le QR code de son étiquette (25/11/2026, Thibault) : comme dans Oktéo, toute la boîte est écrite
// dans l'adresse lue par le téléphone, après le « # ». La page du pas à pas (dépôt public ThibaultG87/bande) relit ce code
// et n'envoie rien à un serveur. Ce fichier est le même dans NovaBAT et dans la page : écrire ici, relire là-bas.
// Rien n'est transformé : chaque valeur de la boîte est rangée telle quelle, puis remise telle quelle.
export const BANDE_URL = "https://thibaultg87.github.io/bande/";
const GK = ["no", "face", "kind", "label", "reps", "length", "diam", "cable", "room", "h", "slot", "place", "cableType", "absent", "circuits", "wires"];
const WK = ["fn", "color", "section", "n", "core", "bague", "circuit"];
const trim = (a) => { while (a.length && a[a.length - 1] == null) a.pop(); return a; };
const rest = (o, K) => { const x = {}; for (const k of Object.keys(o)) if (!K.includes(k) && o[k] != null) x[k] = o[k]; return Object.keys(x).length ? x : null; };

/** Boîte → tableau compact. info : { affaire, client, chantier, modele, bouch, isoler(g, w) } */
export function packBox(B, info = {}) {
  const box = B.box, dict = [], ix = (s) => { if (s == null) return null; let i = dict.indexOf(s); if (i < 0) i = dict.push(s) - 1; return i; };
  const netLabel = new Map(box.nets.map((t) => [t.n, t.label]));
  const pre = box.n + ".";
  const G = box.gaines.map((g) => {
    const W = g.wires.map((w) => {
      const a = [ix(w.fn), ix(w.color), w.section, w.n, ix(w.core), w.bague, w.circuit == null ? null : w.circuit === netLabel.get(w.n) ? 1 : w.circuit];
      const x = rest(w, WK) || {}; if (info.isoler && info.isoler(g, w)) x.isoler = true;
      a.push(Object.keys(x).length ? x : null); return trim(a);
    });
    const a = [String(g.no).startsWith(pre) ? String(g.no).slice(pre.length) : [g.no], g.face, ix(g.kind), g.label, (g.reps || []).join("+") === g.label ? 1 : g.reps, g.length, g.diam, g.cable, ix(g.room), g.h, g.slot, g.place, g.cableType, g.absent, g.circuits && g.circuits.length ? g.circuits : null, W, rest(g, GK)];
    return trim(a);
  });
  return [1, info.affaire || "", info.client || "", info.chantier || "", box.n, info.modele || "", info.bouch ? 1 : 0, ["A", "B", "C", "D"].map((f) => (B.sides || {})[f] ?? null), box.forme ?? null, box.longueur ?? null,
    dict, box.nets.map((t) => trim([t.n, t.label, ix(t.fn), rest(t, ["n", "label", "fn"])])), G, rest(box, ["n", "gaines", "nets", "longueur", "forme"])];
}

/** Tableau compact → { B: { box, sides }, info } */
export function unpackBox(P) {
  if (!Array.isArray(P) || P[0] !== 1) throw new Error("Code de boîte inconnu");
  const [, affaire, client, chantier, n, modele, bouch, S, forme, longueur, dict, T, G, extra] = P;
  const d = (i) => (i == null ? null : dict[i]);
  const nets = T.map((t) => Object.assign({ n: t[0], label: t[1], fn: d(t[2]) }, t[3] || {}));
  const netLabel = new Map(nets.map((t) => [t.n, t.label]));
  const gaines = G.map((a) => {
    const g = { no: Array.isArray(a[0]) ? a[0][0] : n + "." + a[0], face: a[1] ?? null, place: a[11] ?? null, kind: d(a[2]), label: a[3] ?? null, reps: a[4] === 1 ? (a[3] ? String(a[3]).split("+") : []) : a[4] || [],
      length: a[5] ?? null, diam: a[6] ?? null, cable: a[7] ?? null, cableType: a[12] ?? null, absent: a[13] ?? null, room: d(a[8]),
      wires: (a[15] || []).map((w) => Object.assign({ fn: d(w[0]), color: d(w[1]), section: w[2] ?? null, n: w[3] ?? null, core: d(w[4]), bague: w[5] ?? null, circuit: w[6] == null ? null : w[6] === 1 ? netLabel.get(w[3]) : w[6] }, w[7] || {})),
      circuits: a[14] || [], h: a[9] ?? null, slot: a[10] ?? null };
    return Object.assign(g, a[16] || {});
  });
  const sides = {}; ["A", "B", "C", "D"].forEach((f, i) => { if (S[i] != null) sides[f] = S[i]; });
  return { B: { box: Object.assign({ n, gaines, nets, longueur, forme }, extra || {}), sides }, info: { affaire, client, chantier, modele, bouch: !!bouch } };
}

const b64u = (bytes) => { let s = ""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = (t) => Uint8Array.from(atob(t.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
async function pipe(bytes, stream) { const w = stream.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(stream.readable).arrayBuffer()); }
/** Adresse complète du pas à pas d'une boîte (asynchrone : compression du navigateur). */
export async function bandeUrl(B, info) { return BANDE_URL + "#b=" + b64u(await pipe(new TextEncoder().encode(JSON.stringify(packBox(B, info))), new CompressionStream("deflate-raw"))); }
/** Relit ce qui suit « #b= » dans l'adresse. */
export async function readBande(hash) { const m = /[#&]b=([A-Za-z0-9_-]+)/.exec(hash || ""); if (!m) return null; return unpackBox(JSON.parse(new TextDecoder().decode(await pipe(unb64u(m[1]), new DecompressionStream("deflate-raw"))))); }
