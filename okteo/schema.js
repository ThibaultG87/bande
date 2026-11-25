// Schéma de boîte pour le câbleur (v33) — partie pure, sans DOM.
// À partir d'une boîte calculée par computeWiring : les étapes de câblage (une par n° de raccordement, dans l'ordre
// terres → neutres → phases → retours et navettes), le connecteur rapide à prendre pour chacune, la liste de matériel,
// les contrôles, et le dessin SVG de la boîte carrée (faces A–D, gaines, connecteurs, retours et navettes tracés).

export const FN_SHORT = { terre: "Terre", neutre: "Neutre", phase: "Phase", retour: "Retour lampe", nav1: "Navette 1", nav2: "Navette 2", cmdTL: "Cde télérupteur", retTL: "Ret. télérupteur", cmdVR: "Cde volet roulant", isole: "Fil en trop" };
// couleur d'un fil pour le câbleur : « orange » ; âme d'un câble : « marron repéré orange »
export const wireName = (w) => (w.core && w.core !== w.color ? `${w.core} repéré ${w.color}` : w.color);

// « 2,3,5,8,12 » → [2, 3, 5, 8, 12]
export function parseSizes(s) {
  const v = [...new Set(String(s || "").split(/[^\d]+/).map(Number).filter((n) => n >= 2))].sort((a, b) => a - b);
  return v.length ? v : [2, 3, 5];
}

// n fils à raccorder ensemble → connecteurs à prendre. Au-delà du plus gros connecteur : plusieurs connecteurs
// reliés par des ponts (un bout de fil de même couleur, qui prend une entrée de chaque côté).
export function connectorsFor(n, sizes) {
  if (n < 2) return { list: [], ponts: 0 };
  const max = sizes[sizes.length - 1];
  if (n <= max) return { list: [sizes.find((s) => s >= n)], ponts: 0 };
  let k = 2;
  while (k * max - 2 * (k - 1) < n) k++;
  const rest = n + 2 * (k - 1) - (k - 1) * max;
  return { list: [...Array(k - 1).fill(max), sizes.find((s) => s >= rest) || max], ponts: k - 1 };
}

// étapes de câblage d'une boîte (sortie de computeWiring) : [{ n, label, fn, wires: [{gaine, label, fn, color, section, face}], conn }]
export function boxSteps(box, sizes) {
  const by = new Map();
  for (const g of box.gaines) for (const w of g.wires) {
    if (w.n == null) continue;
    if (!by.has(w.n)) by.set(w.n, []);
    by.get(w.n).push({ gaine: g.no, label: g.label, room: g.room || null, fn: w.fn, color: w.color, core: w.core || null, bague: w.bague || null, section: w.section, face: g.face, kind: g.kind });
  }
  return box.nets.map((nt) => {
    const wires = by.get(nt.n) || [];
    return { n: nt.n, label: nt.label, fn: nt.fn, wires, conn: connectorsFor(wires.length, sizes) };
  }).sort((a, b) => a.n - b.n);
}

// ordre de câblage (v47, cadre de la feuille de boîte) : une ligne par borne, dans l'ordre des n° — couleur, section,
// nombre de fils. Ex. « 1 · vert/jaune 2,5 · 12 fils ».
export function orderLines(steps) {
  return steps.map((s) => {
    const w = s.wires[0] || {}, sec = Math.max(0, ...s.wires.map((x) => x.section || 0));
    return { n: s.n, fn: s.fn, label: s.label, color: w.color || "", section: sec || null, count: s.wires.length };
  });
}
export const BOX_MODELS = [{ id: "pav", name: "Boîte pavillonnaire carrée" }];

// matériel : connecteurs par taille + ponts
// fils de la boîte par section et couleur (« 7 × 1,5 bleu »), comme la liste de FTZ ; câbles à part
export function boxWires(box) {
  const m = new Map(), cables = new Map();
  for (const g of box.gaines) {
    if (g.cable) { cables.set(g.cable, (cables.get(g.cable) || 0) + 1); continue; }   // un câble = un article
    for (const w of g.wires) { const k = `${w.section}|${w.color}`; m.set(k, (m.get(k) || 0) + 1); }
  }
  const wires = [...m].map(([k, n]) => { const [sec, color] = k.split("|"); return { section: +sec, color, n }; }).sort((a, b) => a.section - b.section || a.color.localeCompare(b.color, "fr"));
  return { wires, cables: [...cables].map(([cable, n]) => ({ cable, n })) };
}

export function boxMaterial(steps, box = null) {
  const sizes = {};
  let ponts = 0;
  for (const s of steps) { s.conn.list.forEach((k) => (sizes[k] = (sizes[k] || 0) + 1)); ponts += s.conn.ponts; }
  // fil de câble « à isoler » : un connecteur de 2 chacun (Thibault, 16/11/2026)
  if (box) { const iso = box.gaines.reduce((t, g) => t + g.wires.filter((w) => w.libre && w.n == null && (ISOLER.has(g.no + "|" + w.color) || !!w.isoler)).length, 0); if (iso) sizes[2] = (sizes[2] || 0) + iso; }
  return { sizes: Object.entries(sizes).map(([k, n]) => [+k, n]).sort((a, b) => a[0] - b[0]), ponts };
}

// contrôles : fil sans raccordement, raccordement d'un seul fil
export function boxChecks(box, steps) {
  const out = [];
  for (const g of box.gaines) for (const w of g.wires) if (w.n == null && w.fn !== "isole") out.push(`${g.no} (${g.label}) : fil ${wireName(w)} (${FN_SHORT[w.fn] || w.fn}) sans raccordement — à isoler et signaler`);
  for (const s of steps) if (s.wires.length === 1) out.push(`Raccordement ${s.n} (${s.label}) : un seul fil — vérifier le plan`);
  return out;
}

// libellé court pour la case du connecteur : « N C2 », « P C2 », « Ret L3 L3A », « Nav1 VV1-VV1A »
export function shortLabel(l) {
  return String(l).replace(/\s*\(toutes ensemble\)/, "").replace(/^Neutre /, "N ").replace(/^Phase /, "P ").replace(/^Retour lampe /, "Ret ")
    .replace(/^Navette (\d) /, "Nav$1 ").replace(/^Commande télérupteur /, "Cde TL ").replace(/^Retour télérupteur /, "Ret TL ").replace(/↔/g, "-");
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fr = (v, d = 2) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// Dessin SVG de la boîte (v35, d'après la bande que préfère Kévin) : chaque fil dessiné séparément jusqu'à une borne
// numérotée au bord de la boîte ; à l'intérieur, seuls les retours, navettes et commandes sont tracés (lignes à angle
// droit vers un point numéroté) ; N / Ph / PE : numéro de borne seulement. Chaque fil porte data-c = ses circuits
// (pour estomper les autres circuits au clic, comme un calque). color(nom) → couleur CSS ; sides = { A: "côté …" }.
const FN_TAG = { terre: "PE", neutre: "N", phase: "Ph", retour: "RET", nav1: "N1", nav2: "N2", cmdTL: "CTL", retTL: "RTL", cmdVR: "CVR", isole: "isolé" };
const TRACED = new Set(["retour", "nav1", "nav2", "cmdTL", "retTL", "cmdVR"]);
export function schemaSVG(box, steps, { color = () => "#888", sides = {}, font = "Arial, sans-serif", big = false } = {}) {
  const F = big ? 1.28 : 1; // étiquette de boîte (v50) : textes plus gros
  // v47 (feuille de boîte de Kévin) : faces et pièces écrites à l'extérieur, aux quatre bords ; textes plus gros ;
  // plus de Ph / N / PE au bout des fils ; gaine = « LI01.10 » puis « P14 · 4,8 m · Ø16 »
  const X0 = 285, X1 = 715, S = X1 - X0, LANE = 13, TERM = 18;
  const circOfG = (g) => g.circuits || String(g.circuit || "").split(",").map((x) => x.trim()).filter(Boolean);
  const cAttr = (list) => esc([...new Set(list)].join(" "));
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" font-family="${font}">`;
  h += `<rect x="0" y="0" width="1000" height="1000" fill="#fff"/>`;
  h += `<rect x="${X0}" y="${X0}" width="${S}" height="${S}" rx="10" fill="#f6f8fa" stroke="#2b3440" stroke-width="3"/>`;
  // faces et pièces, à l'extérieur, aux quatre bords (sens de pose de la boîte)
  for (const [f, x, y, rot] of [["A", 500, 26, 0], ["B", 982, 500, 90], ["C", 500, 982, 0], ["D", 18, 500, -90]]) {
    const t = `${f}`;   // 25/11/2026 (Thibault) : seulement la lettre de la face (A, B, C, D), sans le nom de la pièce, à l'écran comme dans les PDF
    h += `<g class="face" data-f="${f}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="${26 * F}" font-weight="700" fill="#1f2a36">${esc(t)}</text></g>`;
  }
  const term = new Map();          // borne de chaque fil : { x, y, f, nx, ny } (nx, ny = direction vers l'intérieur)
  const lanes = { A: 0, B: 0, C: 0, D: 0 };
  for (const f of ["A", "B", "C", "D"]) {
    // v60 : gaines dans leur ordre réel sur la face (vue de dessus, comme le plan) : A et B dans l'ordre des points
    // d'accroche, C et D à l'envers (points numérotés dans le sens horaire)
    const G = box.gaines.filter((g) => g.face === f).sort((p, q) => ((p.slot ?? 0) - (q.slot ?? 0)) * (f === "A" || f === "B" ? 1 : -1));
    const vert = f === "A" || f === "C";
    // chaque gaine occupe une place proportionnelle à son nombre de fils
    const tot = G.reduce((s, g) => s + g.wires.length, 0) + G.length * 2.2;
    const L = Math.min(LANE, (S - 50) / Math.max(1, tot));      // écart entre fils : réduit si la face est chargée
    const stag = L < TERM + 1, TW = stag ? Math.min(TERM, 2 * L - 3) : TERM;
    let pos = (S - tot * L) / 2 + X0;
    G.forEach((g) => {
      const gc = circOfG(g), n = g.wires.length, start = pos + L * 1.1;
      // 07/11/2026 : n° des fils de la gaine (clic sur un n° : la gaine reste nette si elle en amène un fil, connecteur.js)
      const nsOf = (W) => [...new Set(W.map((w) => w.n).filter((v) => v != null))].join(" "), NS = nsOf(g.wires);
      g.wires.forEach((w, i) => {
        const t = start + i * L, wc = w.circuit ? [w.circuit] : gc, col = color(w.color);
        const out = 58;    // longueur du fil dessiné hors de la boîte
        // v60 : face chargée (fils plus serrés que les bornes) : bornes en quinconce sur deux rangs, jamais l'une sur l'autre
        const dep = stag && i % 2 ? TERM + 3 : 0;
        let x1, y1, x2, y2, tx, ty, nx = 0, ny = 0;
        if (f === "A") { x1 = x2 = t; y1 = X0 - out; y2 = X0 + dep; tx = t; ty = X0 + 2 + TERM / 2 + dep; ny = 1; }
        if (f === "C") { x1 = x2 = t; y1 = X1 + out; y2 = X1 - dep; tx = t; ty = X1 - 2 - TERM / 2 - dep; ny = -1; }
        if (f === "B") { y1 = y2 = t; x1 = X1 + out; x2 = X1 - dep; tx = X1 - 2 - TERM / 2 - dep; ty = t; nx = -1; }
        if (f === "D") { y1 = y2 = t; x1 = X0 - out; x2 = X0 + dep; tx = X0 + 2 + TERM / 2 + dep; ty = t; nx = 1; }
        const sw = w.section >= 6 ? 7.5 : w.section >= 2.5 ? 5.5 : 3;
        h += `<g class="w" data-c="${cAttr(wc)}" data-n="${w.n ?? ""}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"${w.fn === "terre" ? ` stroke-dasharray="7 5"` : ""}${w.fn === "isole" ? ` opacity="0.45"` : ""}/>`;
        // âme d'un câble : sa vraie couleur sur le bout extérieur (dans la gaine du câble), repérée à la couleur de sa fonction
        if (w.core && w.core !== w.color && !/jaune/.test(w.core)) {
          const k = 0.45, cx2 = x1 + (x2 - x1) * k, cy2 = y1 + (y2 - y1) * k;
          h += `<line class="core" x1="${x1}" y1="${y1}" x2="${cx2}" y2="${cy2}" stroke="${color(w.core)}" stroke-width="${sw}"/>`;
        }
        if (/jaune/.test(w.color)) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color("vert")}" stroke-width="${sw}" stroke-dasharray="7 5" stroke-dashoffset="7"/>`;
        // borne numérotée au bord intérieur
        const tw = vert ? TW : TERM, th = vert ? TERM : TW;
        h += `<rect class="term" x="${tx - tw / 2}" y="${ty - th / 2}" width="${tw}" height="${th}" rx="2" fill="#fff" stroke="#333" stroke-width="1"/><text x="${tx}" y="${ty + 5}" text-anchor="middle" font-size="${TW < 15 ? 11.5 : 13.5}" font-weight="700" fill="#111">${w.n ?? "–"}</text></g>`;
        // point de départ intérieur : derrière le 2e rang de bornes, pour que le tracé ne passe pas sur une borne
        const back = stag && !(i % 2) ? TERM + 3 : 0;
        term.set(g.no + "|" + i, { x: tx + nx * (TERM / 2 + back), y: ty + ny * (TERM / 2 + back), f, nx, ny, w, wc, stub: back ? { x: tx + nx * TERM / 2, y: ty + ny * TERM / 2 } : null });
      });
      // bagues : une accolade par n° de bague sur les fils qui la portent (alimentation : n° du circuit, T1… ; gaine
      // d'appareil : n° de l'allumage quand une couleur de la ronde est réutilisée, R-072)
      if (g.wires.some((w) => w.bague)) {
        const runs = [];
        g.wires.forEach((w, i) => { if (!w.bague) return; const r = runs[runs.length - 1]; if (r && r.b === w.bague && r.j === i - 1) r.j = i; else runs.push({ b: w.bague, i, j: i }); });
        for (const r of runs) {
          const a0 = start + r.i * L - 4, a1 = start + r.j * L + 4, m = (a0 + a1) / 2, o = vert ? (f === "A" ? X0 - 30 : X1 + 30) : (f === "B" ? X1 + 30 : X0 - 30), d = vert ? (f === "A" ? -8 : 8) : (f === "B" ? 8 : -8);
          const path = vert ? `M${a0} ${o} v${d} H${a1} v${-d} M${m} ${o + d} v${d}` : `M${o} ${a0} h${d} V${a1} h${-d} M${o + d} ${m} h${d}`;
          const tx = vert ? m : o + d * 2.6, ty = vert ? o + d * 2.6 + 4 : m + 4;
          h += `<g class="bague" data-b="${esc(r.b)}" data-ns="${nsOf(g.wires.slice(r.i, r.j + 1))}"><path d="${path}" fill="none" stroke="#111" stroke-width="1.6"/><rect x="${tx - 15}" y="${ty - 14.5}" width="30" height="20" rx="10" fill="#FFD400" stroke="#111" stroke-width="1.8"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" font-weight="700" fill="#111">${esc(r.b)}</text></g>`;
        }
      }
      // titre de la gaine, symboles, câble et bouchon (maquette du 15/11) : gaineDeco
      const mid = start + (n - 1) * L / 2;
      h += gaineDeco(g, f, mid, start - L * 0.55, start + (n - 1) * L + L * 0.55, X0, X1, F, `class="gt" data-g="${esc(g.no)}" data-c="${cAttr(gc)}"`, g.wires.map((_, i) => start + i * L), box.nets);
      pos += (n + 2.2) * L;
    });
  }
  // retours, navettes, commandes (v60) : un connecteur par raccordement, alignés au milieu de la boîte ; chaque fil a
  // sa propre entrée sur le connecteur et ses propres couloirs (horizontal et vertical) : aucun fil n'en recouvre un autre.
  const tr = steps.filter((s) => TRACED.has(s.fn));
  if (tr.length) {
    const R = routeInside(box, tr, term);
    for (const L of R.links) h += `<path class="lnk" data-c="${cAttr(L.wc)}" data-n="${L.n}" d="M${L.pts.map((p) => `${p.x} ${p.y}`).join(" L")}" fill="none" stroke="${color(L.w.color)}" stroke-width="2.4" opacity="0.9"${L.fn === "nav2" ? ' stroke-dasharray="7 4"' : ""}/>`;
    for (const N of R.nodes) h += `<g class="node" data-c="${cAttr(N.wc)}" data-n="${N.n}"><rect x="${N.x0}" y="${N.y0}" width="${N.w}" height="${N.h}" rx="5" fill="#fff" stroke="#2b3440" stroke-width="1.6"/><text x="${N.x0 + N.w / 2}" y="${N.y0 + N.h / 2 + 4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#111">${N.n}</text></g>`;
  }
  return h + `</svg>`;
}

// ---------- tracé intérieur sans superposition (v60) ----------
// Couloirs : bande du haut (fils qui arrivent par le dessus des connecteurs), bande du bas, bandes latérales (faces B et D).
// Chaque segment est réservé ; un nouveau segment ne peut pas reprendre la même ligne sur une longueur commune.
const BOX = { X0: 285, X1: 715, IN0: 328, IN1: 672, NY: 500, NH: 24 };   // IN0, IN1 : derrière les deux rangs de bornes
export function routeInside(box, tr, term) {
  // couloirs espacés de 9 (lisible), resserrés seulement si la boîte est trop chargée
  let R = null;
  for (const sp of [9, 7, 5.5, 4.5]) { R = routeWith(box, tr, term, sp); if (!R.fails) break; }
  return R;
}
function routeWith(box, tr, term, SP) {
  const { IN0, IN1, NY, NH } = BOX;
  let fails = 0;
  const H = [], V = [];                // segments réservés : H {y, a, b} ; V {x, a, b}
  const lo = (a, b) => [Math.min(a, b), Math.max(a, b)];
  // o = fil propriétaire du segment (le départ d'un fil des faces B et D est réservé d'avance pour lui seul)
  let own = null;
  const freeH = (y, x1, x2) => { const [a, b] = lo(x1, x2); return !H.some((s) => s.o !== own && Math.abs(s.y - y) < 1.6 && s.a < b - 0.5 && a < s.b - 0.5); };
  const freeV = (x, y1, y2) => { const [a, b] = lo(y1, y2); return !V.some((s) => s.o !== own && Math.abs(s.x - x) < 1.6 && s.a < b - 0.5 && a < s.b - 0.5); };
  const take = (pts) => { for (let i = 1; i < pts.length; i++) { const p = pts[i - 1], q = pts[i]; if (Math.abs(p.y - q.y) < 1e-9) { const [a, b] = lo(p.x, q.x); H.push({ y: p.y, a, b, o: own }); } else { const [a, b] = lo(p.y, q.y); V.push({ x: p.x, a, b, o: own }); } } };
  const ok = (pts) => pts.every((q, i) => !i || (Math.abs(pts[i - 1].y - q.y) < 1e-9 ? freeH(q.y, pts[i - 1].x, q.x) : freeV(q.x, pts[i - 1].y, q.y)));
  // fils de chaque raccordement tracé, avec leur borne
  const items = tr.map((s) => {
    const W = [];
    box.gaines.forEach((g) => g.wires.forEach((w, i) => { if (w.n !== s.n) return; const T = term.get(g.no + "|" + i); if (T) W.push({ T, w, wc: T.wc, key: g.no + "|" + i }); }));
    return { s, W, cx: W.length ? W.reduce((a, x) => a + x.T.x, 0) / W.length : 500 };
  }).filter((it) => it.W.length).sort((a, b) => a.cx - b.cx);
  // côté d'arrivée de chaque fil : par le dessus (face A, ou B / D au-dessus du milieu) ou par le dessous
  items.forEach((it) => it.W.forEach((x) => { x.top = x.T.f === "A" || ((x.T.f === "B" || x.T.f === "D") && x.T.y < NY); }));
  // connecteurs alignés au milieu (les couloirs latéraux ne traversent jamais la rangée des connecteurs)
  const SB = 64, xA = IN0 + 4, xB = IN1 - 4;
  const need = items.map((it) => Math.max(it.W.filter((x) => x.top).length, it.W.filter((x) => !x.top).length));
  const pad = 6, gap0 = 6;
  let g = 7;
  const width = (gg) => items.reduce((a, it, i) => a + Math.max(22, need[i] * gg + 2 * pad), 0) + (items.length - 1) * gap0;
  while (g > 3 && width(g) > xB - xA) g -= 0.5;
  let x = (xA + xB) / 2 - width(g) / 2;
  const nodes = items.map((it, i) => { const w = Math.max(22, need[i] * g + 2 * pad), N = { n: it.s.n, x0: x, y0: NY - NH / 2, w, h: NH, wc: [...new Set(it.W.flatMap((y) => y.wc))] }; x += w + gap0; return N; });
  nodes.forEach((N) => H.push({ y: N.y0, a: N.x0, b: N.x0 + N.w }, { y: N.y0 + N.h, a: N.x0, b: N.x0 + N.w }));
  // départs des fils des faces B et D réservés d'avance (toute la bande latérale) : aucun couloir ne passe sur leur ligne
  items.forEach((it) => it.W.forEach((y) => { const x0 = (y.T.stub || y.T).x; if (y.T.f === "B") H.push({ y: y.T.y, a: IN1 - SB, b: x0, o: y.key }); if (y.T.f === "D") H.push({ y: y.T.y, a: x0, b: IN0 + SB, o: y.key }); }));
  const links = [];
  items.forEach((it, i) => {
    const N = nodes[i];
    for (const top of [true, false]) {
      // entrées dans l'ordre des bornes (de gauche à droite) : moins de croisements
      const W = it.W.filter((y) => y.top === top).sort((a, b) => (a.T.f === "D" ? -1e3 : a.T.f === "B" ? 1e3 : a.T.x) - (b.T.f === "D" ? -1e3 : b.T.f === "B" ? 1e3 : b.T.x));
      const span = (W.length - 1) * g, ex0 = N.x0 + N.w / 2 - span / 2;
      // entrées possibles : les places régulières et les demi-places entre elles (si un trait passe déjà sur une place)
      const slots = []; for (let q = 0; q <= 2 * W.length; q++) slots.push(ex0 - g / 2 + q * g / 2);
      const usedE = new Set();
      W.forEach((y, k) => {
        const ideal = ex0 + k * g, ey = top ? N.y0 : N.y0 + N.h, T = y.T;
        const exs = slots.filter((v) => ![...usedE].some((u) => Math.abs(u - v) < 2)).sort((p, q) => Math.abs(p - ideal) - Math.abs(q - ideal));
        let ex = exs[0] ?? ideal;
        own = y.key;
        const S0 = T.stub || { x: T.x, y: T.y };   // départ au bord de la borne (2e rang de bornes : le trait passe entre elles)
        // couloirs horizontaux : de la bande vers l'extérieur
        const ys = []; for (let d = 9; ; d += SP) { const yy = top ? ey - d : ey + d; if (top ? yy < IN0 + 8 : yy > IN1 - 8) break; ys.push(yy); }
        let pts = null;
        const xs = []; for (let d = 8; d < SB - 4; d += SP) xs.push(T.f === "B" ? IN1 - d : IN0 + d);
        outer: for (const e of exs) for (const yy of ys) {
          if (T.f === "A" || T.f === "C") { const c = [S0, { x: T.x, y: yy }, { x: e, y: yy }, { x: e, y: ey }]; if (ok(c)) { pts = c; ex = e; break outer; } }
          else for (const xx of xs) { const c = [S0, { x: xx, y: T.y }, { x: xx, y: yy }, { x: e, y: yy }, { x: e, y: ey }]; if (ok(c)) { pts = c; ex = e; break outer; } }
        }
        usedE.add(ex);
        // repli (cas extrême : boîte saturée) : le premier couloir, même partagé
        if (!pts) fails++;
        if (!pts) pts = T.f === "A" || T.f === "C" ? [S0, { x: T.x, y: ys[0] ?? ey }, { x: ex, y: ys[0] ?? ey }, { x: ex, y: ey }] : [S0, { x: T.f === "B" ? IN1 - 8 : IN0 + 8, y: T.y }, { x: T.f === "B" ? IN1 - 8 : IN0 + 8, y: ys[0] ?? ey }, { x: ex, y: ys[0] ?? ey }, { x: ex, y: ey }];
        // points alignés retirés (segments nuls)
        pts = pts.filter((p, j) => !j || Math.hypot(p.x - pts[j - 1].x, p.y - pts[j - 1].y) > 1e-6);
        take(pts);
        links.push({ n: it.s.n, fn: it.s.fn, w: y.w, wc: y.wc, pts });
      });
    }
  });
  return { nodes, links, fails };
}
// segments qui se recouvrent (même ligne, longueur commune) : [] attendu (tests)
export function overlaps(links) {
  const S = [];
  links.forEach((L, li) => L.pts.forEach((q, i) => { if (!i) return; const p = L.pts[i - 1]; S.push({ li, h: Math.abs(p.y - q.y) < 1e-9, c: Math.abs(p.y - q.y) < 1e-9 ? p.y : p.x, a: Math.min(Math.abs(p.y - q.y) < 1e-9 ? p.x : p.y, Math.abs(p.y - q.y) < 1e-9 ? q.x : q.y), b: Math.max(Math.abs(p.y - q.y) < 1e-9 ? p.x : p.y, Math.abs(p.y - q.y) < 1e-9 ? q.x : q.y) }); }));
  const out = [];
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const p = S[i], q = S[j];
    if (p.li === q.li || p.h !== q.h || Math.abs(p.c - q.c) >= 1.6) continue;
    if (p.a < q.b - 0.5 && q.a < p.b - 0.5) out.push([p.li, q.li]);
  }
  return out;
}

// ---------- vue des 4 tranches pour le perceur (v60) ----------
// Chaque face de la boîte vue DE L'EXTÉRIEUR : les trous dans l'ordre réel, de gauche à droite (numéros croissants,
// R-077), taille du trou d'après le diamètre de la gaine, n° de gaine et aboutissant. Les points d'accroche sont
// numérotés dans le sens horaire vus de dessus : vus de l'extérieur, de gauche à droite = rang décroissant, sur les 4 faces.
export function trancheOrder(box, f, n = 6) {
  const G = new Map(box.gaines.filter((g) => g.face === f && g.slot != null).map((g) => [g.slot, g]));
  return [...Array(n).keys()].reverse().map((slot) => ({ slot, g: G.get(slot) || null }));
}
export function tranchesSVG(box, { sides = {}, n = 6, font = "Arial, sans-serif" } = {}) {
  const N = Math.max(n, 1 + Math.max(-1, ...box.gaines.map((g) => g.slot ?? -1)));
  const W = 1000, SH = 190, H = 4 * SH + 10;
  let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${font}"><rect width="${W}" height="${H}" fill="#fff"/>`;
  // 22/11/2026 (Thibault) : boîte retournée (ouverture vers le bas) : la face A est en bas du plan, la face C en haut
  const flip = box.forme === "retournee" || box.forme === "ronde";   // 23/11 : pot de centre et prédalle aussi
  const where = flip ? { A: "bas du plan", B: "droite du plan", C: "haut du plan", D: "gauche du plan" } : { A: "haut du plan", B: "droite du plan", C: "bas du plan", D: "gauche du plan" };
  (flip ? ["C", "B", "A", "D"] : ["A", "B", "C", "D"]).forEach((f, k) => {
    const y0 = 8 + k * SH, rx = 40, rw = W - 80, ry = y0 + 40, rh = 74;
    const list = trancheOrder(box, f, N), used = list.filter((x) => x.g).length;
    h += `<g class="tranche" data-f="${f}"><text x="${rx}" y="${y0 + 24}" font-size="22" font-weight="700" fill="#1f2a36">Tranche ${f}</text>`;   // 25/11/2026 (Thibault) : seulement la lettre de la face (A, B, C, D), sans le nom de la pièce, à l'écran comme dans les PDF
    h += `<text x="${rx + rw}" y="${y0 + 24}" text-anchor="end" font-size="15" fill="#555">vue de l'extérieur (${where[f]}) · ${used} trou${used > 1 ? "s" : ""} · gauche → droite</text>`;
    h += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8" fill="#f6f8fa" stroke="#2b3440" stroke-width="2.5"/>`;
    const step = rw / N;
    list.forEach(({ g }, i) => {
      const cx = rx + step * (i + 0.5), cy = ry + rh / 2;
      if (!g) { h += `<circle class="trou libre" cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#bbb" stroke-width="1.5" stroke-dasharray="4 3"/>`; return; }
      const r = g.diam >= 25 ? 27 : g.diam >= 20 ? 23 : 19;
      const no = String(g.no).split(".").pop(), who = g.kind === "alim" ? "Tableau" : cut(g.reps && g.reps.length ? g.reps.join("+") : g.label, 16);
      h += `<g class="trou" data-no="${esc(g.no)}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="2.5"/><text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="22" font-weight="800" fill="#111">${esc(no)}</text>`;
      h += `<text x="${cx}" y="${ry + rh + 22}" text-anchor="middle" font-size="16" font-weight="700" fill="#111">${esc(who)}</text>`;
      h += `<text x="${cx}" y="${ry + rh + 41}" text-anchor="middle" font-size="14" fill="#444">Ø${g.diam ?? "?"}${g.room && g.kind !== "alim" ? " · " + esc(cut(g.room, 14)) : ""}${g.bouchon ? " · bouchon" : ""}</text></g>`;
    });
    h += `</g>`;
  });
  const lost = box.gaines.filter((g) => g.face !== "DCL" && (g.slot == null || !["A", "B", "C", "D"].includes(g.face)));   // DCL : centre de la boîte ronde, pas de trou sur une face
  if (lost.length) h += `<text x="40" y="${H - 4}" font-size="14" fill="#b05a00">Sans place sur une face : ${esc(lost.map((g) => g.no).join(", "))}</text>`;
  return h + `</svg>`;
}

// ===== MAQUETTE du 15/11 : symboles des appareils (mêmes dessins que la Vérification de l'implantation), couleur par
// type de câble, bouchon, et titre de gaine « 11 » (l'atelier n'a pas besoin de « LI01. ») =====
const S_SA = "M15 32a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M22 25V5M22 5l6 3.5";
const S_PR = "M5 5h34v34H5zM8 22a14 14 0 1 0 28 0a14 14 0 1 0 -28 0M13 24a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M27 24a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", S_TERRE = "M20 13.5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", S_SQ = "M5 5h34v34H5z";
// mêmes dessins que la Vérification de l'implantation (SchemSymbols.cs). p : [tracé, couleur, épaisseur, remplissage]
const SYMS = {
  sa: { p: [[S_SA, "#E0201B"]], nom: "Simple allumage" },
  da: { p: [["M15 32a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M19.2 25.6L11.5 7M11.5 7l6.6 0.6M24.8 25.6L32.5 7M32.5 7l5.6 3.6", "#E0201B"]], nom: "Double allumage" },
  vv: { p: [[S_SA + "M22 10.5l6 3.5", "#E0201B"]], nom: "Va-et-vient" },
  bp: { p: [["M10 22a12 12 0 1 0 24 0a12 12 0 1 0 -24 0M15.5 22a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0", "#E0201B"]], nom: "Bouton poussoir" },
  prise: { p: [[S_PR, "#1E6FE0"], [S_TERRE, "#1E6FE0", 1.2, "#C5D92B"]], nom: "Prise" },
  prise25: { p: [[S_PR, "#7A1E8C"], [S_TERRE, "#7A1E8C", 1.2, "#C5D92B"]], nom: "Prise en 2,5 mm²" },   // prise câblée en 2,5 : violette (Thibault, 17/11)
  spe: { p: [[S_PR, "#7A1E8C", 2.8], [S_TERRE, "#7A1E8C", 1.2, "#C5D92B"]], t: "SPE", ty: 34.5, ts: 10, tc: "#111", nom: "Prise spécialisée" },
  priseExt: { p: [["M5 5h34v34H5zM8 22a14 14 0 1 0 28 0a14 14 0 1 0 -28 0", "#F07D1A", 3], ["M12.5 24a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M26.5 24a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M19.5 13.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0", "#F07D1A", 0, "#F07D1A"]], nom: "Prise extérieure étanche" },
  lum: { p: [["M6 22a16 16 0 1 0 32 0a16 16 0 1 0 -32 0M10.7 10.7l22.6 22.6M33.3 10.7L10.7 33.3", "#E0201B"]], nom: "Lampe" },
  rj: { p: [["M6 4h32v36H6zM11 19h22v19H11z", "#1A8A2E", 2.6]], t: "RJ", ty: 33.5, ts: 13, nom: "Prise RJ45" },
  tv: { p: [["M5 5h34v34H5zM10 22a12 12 0 1 0 24 0a12 12 0 1 0 -24 0", "#1A8A2E", 2.6]], t: "TV", ty: 26.5, ts: 12, nom: "Prise TV" },
  ant: { p: [["M22 40V14M10 8l12 6l12-6M12 15l10 5l10-5M14 22l8 4l8-4", "#1A8A2E", 2.6]], nom: "Antenne" },
  volet: { p: [[S_SQ, "#7A1E8C", 2.8]], t: "VR", ty: 28, ts: 15, nom: "Volet roulant" },
  vmc: { p: [[S_SQ, "#1E3FE0", 2.8]], t: "VMC", ty: 27, ts: 12, nom: "VMC" },
  // 25/11/2026 (Thibault) : commande VMC (ligne « C VMC ») = même dessin que GEN_CMD_VMC dans la Vérification (SchemSymbols.cs, « vmc » : tige + cercle)
  cmdVmc: { p: [["M14 31a8 8 0 1 0 16 0a8 8 0 1 0 -16 0M19.5 31a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M22 23V4", "#1E3FE0"]], nom: "Commande VMC" },
  hub: { p: [[S_SQ, "#E6007E", 2.8]], t: "HUB", ty: 27, ts: 12, nom: "Hub" },
  equi: { p: [["M22 6v16M10 22h24M14 28h16M18 34h8", "#2E9E4F"]], nom: "Liaison équipotentielle" },
  conv: { p: [["M8 9h28a3 3 0 0 1 3 3v19a3 3 0 0 1 -3 3h-28a3 3 0 0 1 -3 -3v-19a3 3 0 0 1 3 -3z", "#E0201B", 2.6], ["M12 14v15M17 14v15M22 14v15M27 14v15M32 14v15", "#E0201B", 1.9], ["M10 34v5M34 34v5", "#E0201B", 2.6]], nom: "Convecteur" },   // radiateur électrique (C1, C2… : Thibault, 17/11)
  ss: { p: [["M11 4v36M33 4v36", "#E0201B", 2.6], ["M11 10h22M11 16h22M11 22h22M11 28h22M11 34h22", "#E0201B", 1.9], ["M16 9h12v15l-3 -2l-3 2l-3 -2l-3 2z", "#E0201B", 1.6, "#FFFFFF"]], nom: "Sèche-serviette" },
  ce: { p: [["M19 15h6a6 6 0 0 1 6 6v14a6 6 0 0 1 -6 6h-6a6 6 0 0 1 -6 -6v-14a6 6 0 0 1 6 -6z", "#E0201B", 2.6], ["M17 23h10M17 28h10", "#E0201B", 1.5], ["M14 2h16a3 3 0 0 1 3 3v6a3 3 0 0 1 -3 3h-16a3 3 0 0 1 -3 -3v-6a3 3 0 0 1 3 -3z", "#1F4E8C", 2.6], ["M18.4 8a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0M22 4.4v7.2M18.4 8h7.2", "#1F4E8C", 1.4], ["M22 30c2 3 3 4.5 3 6a3 3 0 0 1 -6 0c0 -1.5 1 -3 3 -6z", "#1E3FE0", 0, "#1E3FE0"]], nom: "Chauffe-eau thermodynamique" },
  gext: { p: [["M4 9h36a2 2 0 0 1 2 2v22a2 2 0 0 1 -2 2H4a2 2 0 0 1 -2 -2V11a2 2 0 0 1 2 -2z", "#1F4E8C", 2.6], ["M7 22a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0", "#1F4E8C", 2.2], ["M16.5 22c0 -5 3 -7 5 -6.5M16.5 22c4.3 2.5 4.5 6 3.2 7.6M16.5 22c-4.3 2.5 -7.5 1 -8.2 -1", "#1F4E8C", 1.9], ["M15 22a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0", "#1F4E8C", 0, "#1F4E8C"], ["M31 15h7M31 20h7M31 25h7M31 30h7", "#1F4E8C", 1.8], ["M8 35v4M36 35v4", "#1F4E8C", 2.4]], nom: "Groupe extérieur" },
  interco: { p: [["M4 12h13v20H4zM27 12h13v20H27z", "#1F4E8C", 2.6], ["M8 18h5M8 22h5M8 26h5M31 18h5M31 22h5M31 26h5", "#1F4E8C", 1.6], ["M17 22h10M20.5 18.5L17 22l3.5 3.5M23.5 18.5L27 22l-3.5 3.5", "#C2610C", 2.2]], nom: "Interconnexion" },
  visio: { p: [["M10 3h24a3 3 0 0 1 3 3v32a3 3 0 0 1 -3 3H10a3 3 0 0 1 -3 -3V6a3 3 0 0 1 3 -3z", "#1A8A2E", 2.6], ["M12 8h20v14H12z", "#1A8A2E", 2], ["M22 12a2.6 2.6 0 1 0 0.01 0M17 21c0.6 -3.6 9.4 -3.6 10 0", "#1A8A2E", 1.6], ["M18 28a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "#1A8A2E", 2], ["M14 36h4M26 36h4", "#1A8A2E", 2]], nom: "Visiophone" },
  plaque: { p: [["M6 6h32v32H6zM12 12h20v20H12z", "#1F4E8C", 2.6]], nom: "Plaques de cuisson" },
  sortie: { p: [["M5 5h34v34H5zM5 39L39 5", "#7A1E8C", 2.6]], nom: "Sortie de câble" },
  tab: { p: [["M7 5h30v34H7zM14 12v9M22 12v9M30 12v9M13 30h18", "#1F4E8C"]], nom: "Tableau" },
};
// symbole d'une ligne directe : prise en 2,5 mm² ou plus (fils ou câble) = prise violette (Thibault, 17/11)
export function symKindLigne(r) {
  const k = symKind(r.no); if (k !== "prise") return k;
  const f = String(r.fil || "").replace(/\s/g, ""), m = /^\d+[GX]([\d.]+)/.exec(f) || /^([\d.]+)/.exec(f);
  return m && +m[1] >= 2.5 ? "prise25" : k;
}
export function symKind(rep) {
  const u = String(rep || "").toUpperCase().replace(/\s+/g, "");
  if (u === "TABLEAU") return "tab";
  if (/^BP/.test(u)) return "bp";
  if (/^VR/.test(u)) return "volet";
  if (u === "CVMC") return "cmdVmc";
  if (/^VMC/.test(u)) return "vmc";
  if (/^EQ/.test(u)) return "equi";
  if (/^RJ/.test(u)) return "rj";
  if (/^TV/.test(u)) return "tv";
  if (/^ANT/.test(u)) return "ant";
  if (/^PCEXT/.test(u)) return "priseExt";
  if (/^(LV|LL|FOUR|ILOT)/.test(u)) return "spe";
  if (/^PLAQUE/.test(u)) return "plaque";
  if (/^C\d/.test(u) || /^CONV/.test(u)) return "conv";
  if (/^SS/.test(u)) return "ss";
  if (/^CE/.test(u)) return "ce";
  if (/^GEXT/.test(u)) return "gext";
  if (/^INTERCO/.test(u)) return "interco";
  if (/^VISIO/.test(u)) return "visio";
  if (/^HUB/.test(u)) return "hub";
  if (/^(PC|P\d)/.test(u)) return "prise";
  if (/^L\d/.test(u)) return "lum";
  if (/^I\d+_/.test(u)) return "da";
  if (/^I\d/.test(u)) return "sa";
  if (/^V\d/.test(u)) return "vv";
  return "sortie";
}
export const symName = (k) => (SYMS[k] || SYMS.sortie).nom;
// symbole centré en (cx, cy), de côté « size »
export function symSVG(kind, cx, cy, size) {
  const s = SYMS[kind] || SYMS.sortie, k = size / 44, c0 = s.p[0][1];
  return `<g class="sym" data-sym="${kind}" transform="translate(${(cx - size / 2).toFixed(1)} ${(cy - size / 2).toFixed(1)}) scale(${k.toFixed(3)})"><rect x="1" y="1" width="42" height="42" rx="7" fill="#fff"/>${s.p.map(([d, c, w = 3.2, f]) => `<path d="${d}" fill="${f || "none"}" stroke="${w ? c : "none"}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}${s.t ? `<text x="22" y="${s.ty}" text-anchor="middle" font-size="${s.ts}" font-weight="800" fill="${s.tc || c0}" font-family="Arial, sans-serif">${s.t}</text>` : ""}</g>`;
}
// fils libres d'un câble marqués « à isoler » (clé : n° de gaine | couleur)
export const ISOLER = new Set();
let G1N = 0;
// une seule couleur de bouchon par diamètre (Ø16 toujours orange)
export const bouchonColor = (d) => ({ 16: "#F07D1A", 20: "#5B21B6", 25: "#111827", 32: "#0F766E" }[+d] || "#374151");
// affichage : « be » (bureau d'études : symboles des appareils) ou « atelier » (PDF et téléphone : sans symboles)
export const VIEW = { atelier: false, big: false, bouchAlim: false };
// une couleur vive par type de câble (3G1,5 n'a pas la même que 3G2,5)
const CABLE_COL = { "3G1.5": "#E6007E", "3G2.5": "#0091FF", "3X1.5": "#7CB518", "2X1.5": "#B8860B", "4G1.5": "#00A86B", "5G1.5": "#00A3A3", "3G6": "#E00000", "5G2.5": "#1565C0", "4G2.5": "#C2185B", "3G4": "#6D4C41" };
const CABLE_MORE = ["#D81B60", "#1E88E5", "#F4511E", "#43A047", "#8E24AA", "#00ACC1", "#C0CA33", "#6D4C41"];
export function cableColor(type) {
  const k = String(type || "").toUpperCase().replace(",", ".").replace(/\s+/g, "");
  if (CABLE_COL[k]) return CABLE_COL[k];
  let hsh = 0; for (const ch of k) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return CABLE_MORE[hsh % CABLE_MORE.length];
}
export const cableTxt = (t) => String(t || "").replace(".", ",");
// 17/11/2026 : seulement le numéro, sur deux chiffres (01, 02… 13), sans « N° » devant.
export const gaineNo = (no) => { const n = String(no).split(".").pop(); return /^\d$/.test(n) ? "0" + n : n; };
// habillage d'une gaine sur le dessin d'une boîte : gaine de câble en couleur, flèche « bouchon », symboles, titre
// f : face A/B/C/D ; mid : milieu de la gaine le long de la face ; a0..a1 : étendue de ses fils ; X0, X1 : bords de la boîte
export function gaineDeco(g, f, mid, a0, a1, X0, X1, F = 1, attr = "", tpos = null, nets = null) {
  const vert = f === "A" || f === "C", esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fr = (v) => (v == null ? "—" : Number(v).toFixed(1).replace(".", ","));
  const P = (r, t) => (f === "A" ? [t, X0 - r] : f === "C" ? [t, X1 + r] : f === "B" ? [X1 + r, t] : [X0 - r, t]);
  let h = "";
  // fondu rouge sur TOUTES les gaines d'alimentation : LI08.01, mais aussi LI08.01A, 01B, 01C, 01D (Thibault, 17/11)
  if (g.kind === "alim" || /(^|\.)0*1[A-Z]?$/.test(String(g.no))) {
    const t0 = Math.min(a0, mid - 36 * F) - 8, t1 = Math.max(a1, mid + 36 * F) + 8, R = 232;
    const r = vert ? { x: t0, y: f === "A" ? X0 - R : X1 + 3, w: t1 - t0, h: R - 3 } : { x: f === "B" ? X1 + 3 : X0 - R, y: t0, w: R - 3, h: t1 - t0 };
    const d = { A: [0, 1, 0, 0], C: [0, 0, 0, 1], B: [0, 0, 1, 0], D: [1, 0, 0, 0] }[f];
    const gid = "g1-" + ++G1N;   // id unique : les pages du PDF et l'écran sont dans le même document (un id en double pointait vers un dessin caché)
    h += `<defs><linearGradient id="${gid}" x1="${d[0]}" y1="${d[1]}" x2="${d[2]}" y2="${d[3]}"><stop offset="0" stop-color="#E0201B" stop-opacity="0.34"/><stop offset="0.65" stop-color="#E0201B" stop-opacity="0.17"/><stop offset="1" stop-color="#E0201B" stop-opacity="0"/></linearGradient></defs><rect class="g1" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="14" fill="url(#${gid})"/>`;
  }
  const cc = g.cable ? cableColor(g.cable) : null;
  if (g.cable) {
    const sh = vert ? { x: a0, y: f === "A" ? X0 - 58 : X1 + 26, w: a1 - a0, h: 32 } : { x: f === "B" ? X1 + 26 : X0 - 58, y: a0, w: 32, h: a1 - a0 };
    h += `<g class="cable" data-cable="${esc(g.cable)}"><rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="7" fill="${cc}" fill-opacity="0.16" stroke="${cc}" stroke-width="3.2"/>` +
      `<text x="${sh.x + sh.w / 2}" y="${sh.y + sh.h / 2 + 4}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke"${vert ? "" : ` transform="rotate(-90 ${sh.x + sh.w / 2} ${sh.y + sh.h / 2 + 4})"`}>${esc(cableTxt(g.cable))}</text>`;
    h += `</g>`;   // plus de flèche de bouchon (demande de Thibault du 16/11) : la pastille « BOUCHON Ø » suffit
  }
  const reps = g.kind === "alim" ? ["TABLEAU"] : (g.reps && g.reps.length ? g.reps : [g.label]);
  const IS = SYM_SIZE * F, off = VIEW.atelier ? 0 : IS + 6;
  if (tpos) h += gaineSyms(g, f, mid, tpos, X0, X1, F, nets);
  const whoRaw = g.kind === "alim" ? "Tableau" : reps.join("+"), who = whoRaw.length > 16 ? whoRaw.slice(0, 15) + "…" : whoRaw;
  const l1 = (g.kind === "alim" ? String(g.no) : gaineNo(g.no)) + (g.serie > 1 ? ` ×${g.serie}` : ""), bch = !!g.cable || (g.kind === "alim" && VIEW.bouchAlim), l2 = bch ? `${who} · ${fr(g.length)} m` : who, l3 = bch ? `BOUCHON Ø${g.diam ?? "?"}` : `${fr(g.length)} m · Ø${g.diam ?? "?"}`;   // bouchon : câble, ou gaine d'alimentation si la réponse aux bouchons est oui
  const pw = l3.length * 9.4 * F + 14, ph = 18 * F;
  const line3 = (x, y, anc) => bch
    ? `<rect x="${anc === "start" ? x - 4 : x - pw + 4}" y="${y - ph + 4.5 * F}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${bouchonColor(g.diam)}"/><text x="${anc === "start" ? x + 2 : x - 2}" y="${y}" text-anchor="${anc}" font-size="${13.5 * F}" font-weight="800" fill="#fff" class="bouchon">${esc(l3)}</text>`
    : `<text x="${x}" y="${y}" text-anchor="${anc}" font-size="${15 * F}" fill="#333">${esc(l3)}</text>`;
  const lines = (x, y1, y2, y3, anc) => `<text x="${x}" y="${y1}" text-anchor="${anc}" font-size="${21 * F}" font-weight="800" fill="#111">${esc(l1)}</text><text x="${x}" y="${y2}" text-anchor="${anc}" font-size="${16 * F}" font-weight="600" fill="#222">${esc(l2)}</text>${line3(x, y3, anc)}`;
  if (vert) {
    const y0 = f === "A" ? X0 - 74 : X1 + 74, anc = f === "A" ? "start" : "end", x = f === "A" ? off : -off;
    h += `<g ${attr} transform="translate(${mid} ${y0}) rotate(-90)">${lines(x, -12 * F, 5 * F, 22 * F, anc)}</g>`;
  } else {
    const anc = f === "B" ? "start" : "end", x = f === "B" ? X1 + 76 + off : X0 - 76 - off;
    h += `<g ${attr}>${lines(x, mid - 10 * F, mid + 7 * F, mid + 24 * F, anc)}</g>`;
  }
  const NS = [...new Set(g.wires.map((w) => w.n).filter((v) => v != null))].join(" ");
  return `<g class="gdeco" data-ns="${NS}">${h}</g>`;
}

// ---- symboles d'une gaine : côte à côte, chacun en face de ses fils ; un clic sur un symbole = le câblage de cet appareil ----
export const SYM_SIZE = 26;
const DEV_FN = ["retour", "nav1", "nav2", "cmdTL", "retTL", "cmdVR"];
// rangs des fils propres à un appareil de la gaine (bouton poussoir : commande du télérupteur ; va-et-vient : retour et navettes)
export function devWires(g, rep) {
  const reps = g.reps || [], isBp = (r) => /^BP/i.test(r), mixed = reps.some(isBp) && reps.some((r) => !isBp(r)), bp = isBp(rep);
  return g.wires.map((w, i) => i).filter((i) => { const fn = g.wires[i].fn; if (!DEV_FN.includes(fn)) return false; return !mixed || (fn === "cmdTL" || fn === "retTL") === bp; });
}
// raccordements (retours, navettes, télérupteur) dont le libellé porte le numéro du repère : BP17 → BP17, BP17A, L17, L17A
export function numNets(nets, rep) {
  const ks = String(rep).match(/\d+/g) || [];
  return (nets || []).filter((N) => DEV_FN.includes(N.fn) && ks.some((k) => new RegExp(`\\b[A-Z]+${k}[A-Z]?\\b`).test(N.label || ""))).map((N) => N.n);
}
const NO_WIRING = new Set(["prise", "prise25", "equi", "sortie", "rj", "tv", "vmc", "tab", "volet"]);
// 18/11/2026 : fils d'un appareil dans une gaine partagée (ex. I2+P9, V1+P12, I7+P15+I6).
// Prise (ou appareil sans commande) : phase et neutre du circuit prises (« PC » dans le nom du raccordement), plus la terre pour la place du symbole.
// Interrupteur, va-et-vient, bouton poussoir : ses raccordements numérotés (retour L2, navettes V1…), plus la phase lumière (« LU ») pour la place du symbole.
// Renvoie { place: rangs des fils pour placer le symbole, nets: raccordements à afficher au clic }.
export function devOf(g, rep, nets) {
  const lab = (n) => ((nets || []).find((N) => N.n === n) || {}).label || "", J = g.wires.map((_, j) => j), W = (j) => g.wires[j];
  if (NO_WIRING.has(symKind(rep))) {
    const pc = J.filter((j) => W(j).fn !== "terre" && W(j).n != null && /\bPC\b|PRISE/i.test(lab(W(j).n)));
    const own = pc.length ? pc : J.filter((j) => (W(j).fn === "phase" || W(j).fn === "neutre") && !/\bLU\b|LUMI/i.test(lab(W(j).n)));
    return { place: [...own, ...J.filter((j) => W(j).fn === "terre")], nets: own.map((j) => W(j).n).filter((n) => n != null) };
  }
  const NN = new Set(numNets(nets, rep)); let own = J.filter((j) => NN.has(W(j).n));
  if (!own.length) own = devWires(g, rep);
  const lu = J.filter((j) => W(j).fn === "phase" && /\bLU\b|LUMI/i.test(lab(W(j).n)));
  return { place: [...own, ...lu], nets: [...new Set([...NN, ...own.map((j) => W(j).n)])].filter((n) => n != null) };
}
export function gaineSyms(g, f, mid, tpos, X0, X1, F = 1, nets = null) {
  if (VIEW.atelier) return "";
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const P = (r, t) => (f === "A" ? [t, X0 - r] : f === "C" ? [t, X1 + r] : f === "B" ? [X1 + r, t] : [X0 - r, t]);
  const reps = g.kind === "alim" ? ["TABLEAU"] : (g.reps && g.reps.length ? g.reps : [g.label]);
  // prise câblée en 2,5 mm² (phase / neutre de la gaine) : symbole violet au lieu du bleu (Thibault, 17/11)
  const en25 = g.wires.some((w) => w.fn !== "terre" && +w.section >= 2.5);
  const kinds = reps.map(symKind).map((k) => (k === "prise" && en25 ? "prise25" : k)), IS = SYM_SIZE * F;
  // un symbole par repère (deux va-et-vient = deux symboles) ; un seul pour plusieurs prises
  const one = reps.length === 1 || (new Set(kinds).size === 1 && NO_WIRING.has(kinds[0]));
  let L = one ? [{ k: kinds[0], dev: reps.length === 1 && !NO_WIRING.has(kinds[0]) ? reps[0] : "", t: mid, ns: g.wires.map((w) => w.n) }] : reps.slice(0, 3).map((r, i) => {
    let I = devOf(g, r, nets).place; if (!I.length) I = g.wires.map((_, j) => j);
    return { k: kinds[i], dev: r, t: I.reduce((s, j) => s + (tpos[j] ?? mid), 0) / I.length, ns: I.map((j) => g.wires[j].n) }; });
  L.sort((a, b) => a.t - b.t);
  for (let i = 1; i < L.length; i++) if (L[i].t - L[i - 1].t < IS + 2) { const m = (L[i].t + L[i - 1].t) / 2; L[i - 1].t = m - (IS + 2) / 2; L[i].t = m + (IS + 2) / 2; }
  return L.map((x) => { const p = P(74 + IS / 2, x.t), ns = [...new Set(x.ns.filter((v) => v != null))].join(" ");
    return `<g class="symk" data-g="${esc(g.no)}" data-dev="${esc(x.dev)}" data-ns="${ns}" style="cursor:pointer"><title>${esc(x.dev || reps.join(" + "))} · ${esc(symName(x.k))} : voir son câblage</title>${symSVG(x.k, p[0], p[1], IS)}</g>`; }).join("");
}

// 17/11/2026 : nom de gaine « GAINE_AIGUILLEE16/20/25/32/40… » (quel que soit le repère) : affichée « Gaine aiguillée », couleur à part.
export const AIGUILLEE_COLOR = "#C2185B";
export const isAiguillee = (r) => /AIGUILL/i.test(String(r.gaine || ""));   // lu seulement dans le nom de la gaine (ex. GAINE_AIGUILLEE20), jamais dans le repère
