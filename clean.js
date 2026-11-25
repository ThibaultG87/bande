// Dessin « Moins de croisements » d'une boîte (maquette validée les 11 et 12/11/2026) : calcul déterministe, sans IA.
// Chaque connecteur est placé sur une grille près de ses fils ; le placement qui a le moins de croisements est gardé.
// Bornes alignées (plus de quinconce), fils épais. Même boîte = même dessin à chaque fois.
import { gaineDeco, gaineSyms, ISOLER, VIEW } from "./okteo/schema.js";
export const CLEAN = (() => {
  const LANE = 17, TERM = 20, MARGE = 275, BASE = 550, LMIN = 11;   // boîte agrandie : fils plus espacés
  // 20/11/2026 : géométrie de la boîte dessinée, calculée à chaque dessin (geom) :
  //  - boîte normale ou retournée : rectangle, 550 × 550 de base, allongé quand une face a trop de gaines (boîte à une face) ;
  //  - boîte ronde (pot de centre, prédalle) : rond, 16 places (A1…D4) et la gaine DCL au centre.
  let XL = MARGE, XR = MARGE + BASE, YT = MARGE, YB = MARGE + BASE, VBW = 1100, VBH = 1100, MIDX = 550, MIDY = 550, ROND = null;
  const sideOf = (box, g) => (box.forme === "retournee" ? ({ A: "C", C: "A" })[g.face] || g.face : g.face);   // côté dessiné
  // 23/11/2026 (Thibault) : pot de centre et prédalle sont vus retournés comme la boîte « ouverture vers le bas » (miroir haut ↔ bas)
  const letterOf = (box, side) => (box.forme === "retournee" || box.forme === "ronde" ? ({ A: "C", C: "A" })[side] || side : side);    // lettre écrite à ce côté
  function geom(box) {
    const rond = box.forme === "ronde";
    let W = BASE, H = BASE;
    if (!rond) {
      const need = (sd) => { const G = box.gaines.filter((g) => sideOf(box, g) === sd); return (G.reduce((a, g) => a + g.wires.length, 0) + G.length * 2.2) * LMIN + 50; };
      W = Math.max(BASE, need("A"), need("C")); H = Math.max(BASE, need("B"), need("D"));
    }
    XL = MARGE; XR = MARGE + W; YT = MARGE; YB = MARGE + H; VBW = XR + MARGE; VBH = YB + MARGE; MIDX = (XL + XR) / 2; MIDY = (YT + YB) / 2;
    ROND = rond ? { cx: MIDX, cy: MIDY, R: BASE / 2 } : null;
  }
  const rotP = (x, y, a) => { if (!a) return { x, y }; const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180), dx = x - ROND.cx, dy = y - ROND.cy; return { x: ROND.cx + dx * c - dy * s, y: ROND.cy + dx * s + dy * c }; };
  const rotAttr = (a) => (a ? ` transform="rotate(${a.toFixed(2)} ${ROND.cx} ${ROND.cy})"` : "");
  const TRACED = new Set(["retour", "nav1", "nav2", "cmdTL", "retTL"]);
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fr = (v, d = 1) => (v == null ? "—" : Number(v).toFixed(d).replace(".", ","));
  const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

  // ---- bornes (reprend la disposition de la bande actuelle) ----
  function terminals(box, ord = {}) {
    const T = [];
    box.gaines.forEach((g) => { g._f = null; g._rot = 0; g._dcl = false; });
    // une gaine posée sur un côté f (bords e0/e1), à partir de start, pas L, tournée de rot degrés (boîte ronde)
    const put = (g, f, e0, e1, start, L, rot) => {
      const seq = ord[g.no] || g.wires.map((_, i) => i), TW = Math.max(10, Math.min(TERM, L - 1.5));
      seq.forEach((i, r) => { const w = g.wires[i], t = start + r * L, dep = 0;
        let lx, ly, nx = 0, ny = 0;
        if (f === "A") { lx = t; ly = e0 + 2 + TERM / 2 + dep; ny = 1; }
        if (f === "C") { lx = t; ly = e1 - 2 - TERM / 2 - dep; ny = -1; }
        if (f === "B") { lx = e1 - 2 - TERM / 2 - dep; ly = t; nx = -1; }
        if (f === "D") { lx = e0 + 2 + TERM / 2 + dep; ly = t; nx = 1; }
        const p = rotP(lx, ly, rot), sp = rotP(lx + nx * (TERM / 2 + 14), ly + ny * (TERM / 2 + 14), rot), ep = rotP(lx + nx * TERM / 2, ly + ny * TERM / 2, rot);
        T.push({ g, w, i, f, t, L, TW, stag: false, dep, e0, e1, rot, lx, ly, x: p.x, y: p.y, sx: sp.x, sy: sp.y, ex: ep.x, ey: ep.y });
      });
      g._f = f; g._e0 = e0; g._e1 = e1; g._rot = rot; g._start = start; g._L = L; g._seq = seq;
    };
    if (ROND) {
      // boîte ronde : A en haut, B à droite, C en bas, D à gauche ; 4 places par quart, 1 → 4 dans le sens des aiguilles d'une
      // montre (place de @TENANT) ; puis tout le rond retourné haut ↔ bas (th = 180 − th0) : A en bas, C en haut (23/11). Sans place (ancienne liste) ou place en double : gaines réparties sur leur quart, dans l'ordre.
      ["A", "B", "C", "D"].forEach((fc, q) => {
        const G = box.gaines.filter((g) => g.face === fc).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)), n = G.length;
        const placed = n && G.every((g) => g.place >= 1 && g.place <= 4) && new Set(G.map((g) => g.place)).size === n;
        G.forEach((g, j) => {
          const th0 = -45 + 90 * q + (placed ? 22.5 * (g.place - 0.5) : 90 * (j + 0.5) / n), th = 180 - th0, arc = 2 * Math.PI * ROND.R * (placed ? 22.5 : 90 / n) / 360;
          const k = g.wires.length, L = Math.min(LANE, (arc - 8) / (k + 1)), up = Math.cos(th * Math.PI / 180) >= 0;
          put(g, up ? "A" : "C", ROND.cy - ROND.R, ROND.cy + ROND.R, ROND.cx - (k - 1) * L / 2, L, up ? th : th - 180);
        });
      });
      // gaine(s) DCL : au centre, bornes vers le haut
      const D = box.gaines.filter((g) => g.face === "DCL"), tot = D.reduce((a, g) => a + g.wires.length, 0) + Math.max(0, D.length - 1) * 2.2;
      let pos = ROND.cx - (tot - 1) * LANE / 2;
      D.forEach((g) => { put(g, "C", ROND.cy - 40, ROND.cy + 14, pos, LANE, 0); g._dcl = true; pos += (g.wires.length + 2.2) * LANE; });
      return T;
    }
    const flip = box.forme === "retournee";
    for (const f of ["A", "B", "C", "D"]) {
      // boîte retournée : dessin en miroir haut ↔ bas (A dessinée en bas, C en haut, ordre inversé sur chaque côté)
      const dir = (f === "A" || f === "B" ? 1 : -1) * (flip ? -1 : 1);
      const G = box.gaines.filter((g) => sideOf(box, g) === f).sort((p, q) => ((p.slot ?? 0) - (q.slot ?? 0)) * dir);
      const vert = f === "A" || f === "C", a = vert ? XL : YT, len = vert ? XR - XL : YB - YT, e0 = vert ? YT : XL, e1 = vert ? YB : XR;
      const tot = G.reduce((s, g) => s + g.wires.length, 0) + G.length * 2.2;
      const L = Math.min(LANE, (len - 50) / Math.max(1, tot));
      // nouvelles listes (place dans @TENANT) : gaines réparties régulièrement sur la face ; anciennes : regroupées au milieu
      const spread = G.length && G.every((g) => g.place != null), gap = spread ? (len - tot * L) / G.length : 0;
      let pos = spread ? a + gap / 2 : (len - tot * L) / 2 + a;
      G.forEach((g) => { put(g, f, e0, e1, pos + L * 1.1, L, 0); pos += (g.wires.length + 2.2) * L + gap; });
    }
    return T;
  }

  // ---- géométrie ----
  const segX = (a, b, c, d) => { // vrai croisement de [a,b] et [c,d] (extrémités communes exclues)
    const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
    return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) && ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6));
  };
  const hitRect = (a, b, r) => { // le segment traverse le connecteur r
    for (let k = 0; k <= 12; k++) { const x = a.x + (b.x - a.x) * k / 12, y = a.y + (b.y - a.y) * k / 12; if (x > r.x - r.w / 2 - 3 && x < r.x + r.w / 2 + 3 && y > r.y - r.h / 2 - 3 && y < r.y + r.h / 2 + 3) return true; }
    return false;
  };

  // ---- placement des connecteurs ----
  function place(nets, T) {
    const step = 42, slots = [];
    for (let y = YT + 70; y <= YB - 70 + 0.1; y += step) for (let x = XL + 70; x <= XR - 70 + 0.1; x += step) slots.push({ x, y });
    if (ROND) {   // boîte ronde : connecteurs dans le rond, pas sur la gaine DCL du centre
      const D = T.filter((t) => t.g._dcl), x0 = D.length ? Math.min(...D.map((t) => t.x)) - 40 : 0, x1 = D.length ? Math.max(...D.map((t) => t.x)) + 40 : 0;
      for (let i = slots.length - 1; i >= 0; i--) { const p = slots[i]; if (Math.hypot(p.x - ROND.cx, p.y - ROND.cy) > ROND.R - 75 || (D.length && p.x > x0 && p.x < x1 && p.y > ROND.cy - 45 && p.y < ROND.cy + 110)) slots.splice(i, 1); }
    }
    const segsOf = (N, p) => N.T.map((t) => [{ x: t.sx, y: t.sy }, p]);
    const cost = (A) => {
      let c = 0; const all = [];
      nets.forEach((N, k) => { const p = slots[A[k]]; segsOf(N, p).forEach((s) => { all.push({ k, s }); c += Math.hypot(s[0].x - s[1].x, s[0].y - s[1].y) * 0.02; }); });
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].k !== all[j].k && segX(all[i].s[0], all[i].s[1], all[j].s[0], all[j].s[1])) c += 10;
      // un fil qui passe sur le connecteur d'un autre raccordement : à éviter
      nets.forEach((N, k) => { const r = { ...slots[A[k]], w: 30, h: 22 }; all.forEach((x) => { if (x.k !== k && hitRect(x.s[0], x.s[1], r)) c += 14; }); });
      return c;
    };
    // départ : chaque connecteur sur la case libre la plus proche du centre de ses fils, attiré vers le milieu
    const A = [], used = new Set();
    nets.map((N, k) => ({ N, k })).sort((p, q) => q.N.T.length - p.N.T.length || p.N.n - q.N.n).forEach(({ N, k }) => {
      const cx = N.T.reduce((s, t) => s + t.sx, 0) / N.T.length, cy = N.T.reduce((s, t) => s + t.sy, 0) / N.T.length;
      const tx = cx * 0.6 + MIDX * 0.4, ty = cy * 0.6 + MIDY * 0.4;
      let best = -1, bd = 1e9; slots.forEach((s, i) => { if (used.has(i)) return; const d = Math.hypot(s.x - tx, s.y - ty); if (d < bd) { bd = d; best = i; } });
      A[k] = best; used.add(best);
    });
    // amélioration : déplacer un connecteur sur une case libre, ou échanger deux connecteurs, tant que ça diminue le coût
    let cur = cost(A);
    for (let pass = 0; pass < 12; pass++) {
      let better = false;
      for (let k = 0; k < nets.length; k++) {
        for (let i = 0; i < slots.length; i++) {
          if (A.includes(i)) continue; const old = A[k]; A[k] = i; const c = cost(A); if (c < cur - 1e-9) { cur = c; better = true; } else A[k] = old;
        }
        for (let j = k + 1; j < nets.length; j++) { [A[k], A[j]] = [A[j], A[k]]; const c = cost(A); if (c < cur - 1e-9) { cur = c; better = true; } else[A[k], A[j]] = [A[j], A[k]]; }
      }
      if (!better) break;
    }
    return A.map((i) => slots[i]);
  }

  function crossings(lines) { let c = 0; for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) if (lines[i].n !== lines[j].n) for (let a = 1; a < lines[i].pts.length; a++) for (let b = 1; b < lines[j].pts.length; b++) if (segX(lines[i].pts[a - 1], lines[i].pts[a], lines[j].pts[b - 1], lines[j].pts[b])) c++; return c; }

  // ---- dessin ----
  function svg(box, { color = () => "#888", sides = {}, all = false, font = "Segoe UI, Arial, sans-serif", hl = null, ord0 = null, hide = null } = {}) {
    // 1) connecteurs placés ; 2) dans chaque gaine, fils redessinés dans l'ordre de leurs connecteurs (l'ordre des fils dans
    // une gaine n'a pas de sens physique) ; 3) connecteurs replacés. On garde le dessin qui a le moins de croisements.
    geom(box);
    const build = (ord) => {
      const T = terminals(box, ord);
      const nets = box.nets.map((nt) => ({ ...nt, T: T.filter((t) => t.w.n === nt.n) })).filter((N) => N.T.length && (all || TRACED.has(N.fn) || N.T.some((t) => t.w.corr)) && !(hide && hide.has(N.n)));   // 18/11 : un raccordement fait à la main en mode relié reste toujours dessiné (même phase, neutre ou terre)
      const P = place(nets, T), lines = [];
      nets.forEach((N, k) => N.T.forEach((t) => lines.push({ n: N.n, w: t.w, fn: N.fn, k: `${t.g.no}|${t.i}`, pts: [{ x: t.ex, y: t.ey }, { x: t.sx, y: t.sy }, P[k]] })));
      return { T, nets, P, lines, c: crossings(lines) };
    };
    let best = build(ord0 || {}), ord = ord0 || {};
    if (!ord0) for (let it = 0; it < 3; it++) {
      const tgt = new Map(); best.nets.forEach((N, k) => tgt.set(N.n, best.P[k]));
      const no = {};
      for (const g of box.gaines) {
        if (!g._f) continue;   // gaine sans place sur le dessin
        const f = g._f, key = (w) => { let p = tgt.get(w.n); if (!p) return null; if (g._rot) p = rotP(p.x, p.y, -g._rot); return f === "A" || f === "C" ? p.x : p.y; };
        if (g.kind === "alim" || g.wires.some((w) => w.bague)) continue;   // gaine d'alimentation et bagues : ordre gardé
        const idx = g.wires.map((w, i) => i), tr = idx.filter((i) => key(g.wires[i]) != null), un = idx.filter((i) => key(g.wires[i]) == null);
        tr.sort((a, b) => key(g.wires[a]) - key(g.wires[b]));
        { const n2 = tr.filter((i) => g.wires[i].fn === "nav2"); let q = 0; for (const i of tr.filter((i) => g.wires[i].fn === "nav1")) { const j = n2[q++]; if (j == null) break; tr.splice(tr.indexOf(j), 1); tr.splice(tr.indexOf(i) + 1, 0, j); } }   // les deux navettes côte à côte
        const mid = g._start + (g.wires.length - 1) * g._L / 2, avg = tr.length ? tr.reduce((s, i) => s + key(g.wires[i]), 0) / tr.length : mid;
        no[g.no] = avg < mid ? [...tr, ...un] : [...un, ...tr];
      }
      const nb = build(no); if (nb.c < best.c) { best = nb; ord = no; } else break;
    }
    // deux navettes côte à côte : on essaie l'autre sens, gardé s'il y a moins de croisements
    for (const g of box.gaines) {
      const cur = ord[g.no] || g.wires.map((_, i) => i), a = cur.findIndex((i) => g.wires[i].fn === "nav1"), b = cur.findIndex((i) => g.wires[i].fn === "nav2");
      if (!g._f || a < 0 || b < 0 || Math.abs(a - b) !== 1 || g.kind === "alim") continue;
      const sw = cur.slice(); [sw[a], sw[b]] = [sw[b], sw[a]]; const no = { ...ord, [g.no]: sw }, nb = build(no);
      if (nb.c < best.c) { best = nb; ord = no; }
    }
    let top = "";
    const { T, nets, P, lines } = best;
    let h = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VBW} ${VBH}" width="${VBW}" height="${VBH}" font-family="${font}">`;
    h += `<rect width="${VBW}" height="${VBH}" fill="#fff"/>` + (ROND ? `<circle cx="${ROND.cx}" cy="${ROND.cy}" r="${ROND.R}" fill="#f6f8fa" stroke="#2b3440" stroke-width="3"/>` : `<rect x="${XL}" y="${YT}" width="${XR - XL}" height="${YB - YT}" rx="10" fill="#f6f8fa" stroke="#2b3440" stroke-width="3"/>`);
    for (const [sd, x, y, rot] of [["A", MIDX, 26, 0], ["B", VBW - 18, MIDY, 90], ["C", MIDX, VBH - 18, 0], ["D", 18, MIDY, -90]]) {
      const f = letterOf(box, sd), t = `${f}${sides[f] ? " · " + cut(sides[f], 24) : ""}`;   // boîte retournée : les lettres suivent les gaines
      h += `<g${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ""}><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#1f2a36">${esc(t)}</text></g>`;
    }
    // fils extérieurs + bornes
    for (const t of T) {
      const out = 58, col = color(t.w.color), sw = t.w.section >= 6 ? 11 : t.w.section >= 2.5 ? 8.5 : 5, lib = !!t.w.libre && t.w.n == null, iso = lib && (ISOLER.has(t.g.no + "|" + t.w.color) || !!t.w.isoler);
      let x1, y1, x2, y2;
      if (t.f === "A") { x1 = x2 = t.t; y1 = t.e0 - out; y2 = t.e0 + t.dep; }
      if (t.f === "C") { x1 = x2 = t.t; y1 = t.e1 + out; y2 = t.e1 - t.dep; }
      if (t.f === "B") { y1 = y2 = t.t; x1 = t.e1 + out; x2 = t.e1 - t.dep; }
      if (t.f === "D") { y1 = y2 = t.t; x1 = t.e0 - out; x2 = t.e0 + t.dep; }
      const dim = (hl != null && t.w.n !== hl) || (hide && hide.has(t.w.n)) ? ' opacity="0.22"' : "";
      h += `<g class="tw${t.w.n == null && !iso ? " open" : ""}" data-n="${t.w.n ?? ""}" data-k="${esc(t.g.no)}|${t.i}" data-x="${t.x.toFixed(1)}" data-y="${t.y.toFixed(1)}"${dim}${rotAttr(t.rot)}><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}"${t.w.fn === "terre" ? ' stroke-dasharray="7 5"' : ""}/>`;
      if (t.w.core && t.w.core !== t.w.color && !/jaune/.test(t.w.core)) { const k = 0.45; h += `<line x1="${x1}" y1="${y1}" x2="${x1 + (x2 - x1) * k}" y2="${y1 + (y2 - y1) * k}" stroke="${color(t.w.core)}" stroke-width="${sw}"/>`; }
      if (/jaune/.test(t.w.color)) h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color("vert")}" stroke-width="${sw}" stroke-dasharray="7 5" stroke-dashoffset="7"/>`;
      const vert = t.f === "A" || t.f === "C", tw = vert ? t.TW : TERM, th = vert ? TERM : t.TW;
      h += `<rect class="term" x="${t.lx - tw / 2}" y="${t.ly - th / 2}" width="${tw}" height="${th}" rx="2" fill="${iso ? "#e3e7ec" : t.w.n == null ? "#ffe1c2" : "#fff"}" stroke="${iso ? "#5b6778" : t.w.n == null ? "#f07d1a" : "#333"}" stroke-width="${t.w.n == null && !iso ? 2.5 : 1}"/><text x="${t.lx}" y="${t.ly + 5}" text-anchor="middle" font-size="${t.TW < 13 ? 11.5 : t.TW < 16 ? 13.5 : 15.5}" font-weight="700" fill="#111">${iso ? "×" : lib ? "!" : t.w.n ?? "?"}</text>${lib ? `<title>${iso ? "À isoler (connecteur de 2). Clic : enlever la mention" : "Conducteur du câble branché nulle part. Clic ou clic droit : « à isoler »"}</title>` : ""}`;
      if (lib) { const lab = iso ? "À ISOLER" : "! à isoler ?", pw = iso ? 70 : 82, bg = iso ? "#5b6778" : "#f07d1a", d = (vert ? th : tw) / 2 + 5;
        const pill = `<rect x="${d}" y="-10" width="${pw}" height="20" rx="10" fill="${bg}" stroke="#fff" stroke-width="2.5"/><text x="${d + pw / 2}" y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${lab}</text>`;
        const pillB = `<rect x="${-d - pw}" y="-10" width="${pw}" height="20" rx="10" fill="${bg}" stroke="#fff" stroke-width="2.5"/><text x="${-d - pw / 2}" y="4.5" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${lab}</text>`;
        top += `<g${rotAttr(t.rot)}><g class="isol tw" data-n="" data-k="${esc(t.g.no)}|${t.i}" transform="translate(${t.lx} ${t.ly})${t.f === "A" ? " rotate(90)" : t.f === "C" ? " rotate(-90)" : ""}">${t.f === "B" ? pillB : pill}</g></g>`; }
      h += `</g>`;
    }
    // titres de gaines et câbles
    for (const g of box.gaines) {
      if (!g._f) continue;   // gaine sans place sur le dessin
      const f = g._f, n = g.wires.length, start = g._start, L = g._L, mid = start + (n - 1) * L / 2, vert = f === "A" || f === "C", X0 = g._e0, X1 = g._e1;
      if (g._dcl) { h += dclDeco(g, mid, X1); continue; }
      h += `<g${rotAttr(g._rot)}>` + gaineDeco(g, f, mid, start - L * 0.55, start + (n - 1) * L + L * 0.55, X0, X1, VIEW.big ? 1.3 : 1) + `</g>`;
      if (g.wires.some((w) => w.bague)) {
        const runs = []; (g._seq || g.wires.map((_, i) => i)).map((i) => g.wires[i]).forEach((w, i) => { if (!w.bague) return; const r = runs[runs.length - 1]; if (r && r.b === w.bague && r.j === i - 1) r.j = i; else runs.push({ b: w.bague, i, j: i }); });
        for (const r of runs) { const a0 = start + r.i * L - 4, a1 = start + r.j * L + 4, m = (a0 + a1) / 2, o = vert ? (f === "A" ? X0 - 30 : X1 + 30) : (f === "B" ? X1 + 30 : X0 - 30), d = vert ? (f === "A" ? -8 : 8) : (f === "B" ? 8 : -8); const path = vert ? `M${a0} ${o} v${d} H${a1} v${-d} M${m} ${o + d} v${d}` : `M${o} ${a0} h${d} V${a1} h${-d} M${o + d} ${m} h${d}`; const tx = vert ? m : o + d * 2.6, ty = vert ? o + d * 2.6 + 4 : m + 4; top += `<g class="bague" data-b="${esc(r.b)}" style="cursor:pointer"><title>Circuit ${esc(r.b)} : voir tout son câblage</title><path d="${path}" fill="none" stroke="#111" stroke-width="1.6"/><rect x="${tx - 15}" y="${ty - 14.5}" width="30" height="20" rx="10" fill="#FFD400" stroke="#111" stroke-width="1.8"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" font-weight="700">${esc(r.b)}</text></g>`.replace(/^<g class="bague"/, `<g${rotAttr(g._rot)}><g class="bague"`) + "</g>"; }
      }
    }
    // fils intérieurs : liseré blanc puis couleur ; connecteurs par-dessus
    const lineSvg = (L, under) => `<polyline points="${L.pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}" fill="none" stroke="${under ? "#f6f8fa" : color(L.w.color)}" stroke-width="${under ? 9 : 4}" stroke-linejoin="round" stroke-linecap="round"${!under && L.fn === "nav2" ? ' stroke-dasharray="7 4"' : ""}${!under && L.fn === "terre" ? ' stroke-dasharray="6 4"' : ""}/>`;
    for (const L of lines) { const dim = hl != null && L.n !== hl ? ' opacity="0.15"' : ""; h += `<g class="ln" data-n="${L.n}" data-k="${esc(L.k)}"${dim}>${lineSvg(L, true)}${lineSvg(L, false)}</g>`; }
    h += gaineHits(box, ord);
    h += top;   // étiquettes « à isoler » au premier plan, jamais coupées par un fil
    for (const g of box.gaines) { if (!g._f || g._dcl) continue; const seq = g._seq || g.wires.map((_, i) => i), tp = []; seq.forEach((i, r) => (tp[i] = g._start + r * g._L)); h += `<g${rotAttr(g._rot)}>` + gaineSyms(g, g._f, g._start + (g.wires.length - 1) * g._L / 2, tp, g._e0, g._e1, 1, box.nets) + `</g>`; }
    nets.forEach((N, k) => { const p = P[k], dim = hl != null && N.n !== hl ? ' opacity="0.25"' : ""; h += `<g class="node" data-n="${N.n}"${dim}><rect x="${p.x - 15}" y="${p.y - 11}" width="30" height="22" rx="5" fill="#fff" stroke="#2b3440" stroke-width="1.8"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="13" font-weight="700">${N.n}</text></g>`; });
    return { svg: h + "</svg>", crossings: crossings(lines), nets: nets.length, ord };
  }
  // zones cliquables des gaines (titre + fils extérieurs), aussi posées sur le dessin d'Oktéo (mêmes positions de bornes)
  function gaineHits(box, ord = {}) {
    geom(box); terminals(box, ord); let h = "";
    for (const g of box.gaines) { if (!g._f) continue;
      const f = g._f, X0 = g._e0, X1 = g._e1, a0 = g._start - g._L * 0.7, a1 = g._start + (g.wires.length - 1) * g._L + g._L * 0.7;
      const r = g._dcl ? [a0, X1 + 60, a1 - a0, 42] :   // DCL : zone sur son étiquette seulement, jamais sur ses bornes (sinon on ne peut plus les relier)
        f === "A" ? [a0, X0 - 225, a1 - a0, 223] : f === "C" ? [a0, X1 + 2, a1 - a0, 223] : f === "B" ? [X1 + 2, a0, 270, a1 - a0] : [X0 - 272, a0, 270, a1 - a0];
      h += `<rect class="gh" data-g="${esc(g.no)}" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" fill="#1d4f91" fill-opacity="0"${rotAttr(g._rot)} style="cursor:pointer"><title>${esc(g.no || "DCL")} : voir ses raccordements</title></rect>`; }
    return h;
  }
  // gaine DCL du centre d'une boîte ronde : « DCL · L6 », longueur et diamètre sous ses bornes (pas de n° : la liste n'en donne pas)
  function dclDeco(g, mid, X1) {
    const reps = (g.reps && g.reps.length ? g.reps : [g.label]).join("+"), NS = [...new Set(g.wires.map((w) => w.n).filter((v) => v != null))].join(" ");
    return `<g class="gdeco" data-ns="${NS}"><text x="${mid}" y="${X1 + 78}" text-anchor="middle" font-size="19" font-weight="800" fill="#111">DCL${reps ? " · " + esc(reps) : ""}</text><text x="${mid}" y="${X1 + 96}" text-anchor="middle" font-size="14" fill="#333">${fr(g.length)} m · Ø${g.diam || "?"}</text></g>`;
  }
  return { svg, terminals, crossings, TRACED, gaineHits };
})();
