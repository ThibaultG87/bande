// Page du câblage pas à pas, ouverte par le QR code de l'étiquette d'une boîte (NovaBAT, module Bandes).
// Toute la boîte est dans l'adresse, après « #b= » : rien n'est envoyé ni stocké sur internet.
// C'est la même page que l'aperçu « tablette » de NovaBAT (bouchons en premier, bagues, raccordements, fils à isoler).
import { readBande } from "./bande-code.js";
import { CLEAN } from "./clean.js";
import { boxSteps, parseSizes, VIEW, bouchonColor, cableTxt } from "./okteo/schema.js";
import { connecteurCard } from "./okteo/connecteur.js";

const CSS = { rouge: "#d42a2a", bleu: "#2459d6", "vert/jaune": "#f0d020", orange: "#f28c1b", violet: "#8a3ccf", noir: "#222222",
  marron: "#7b4a12", gris: "#8a8a8a", "bleu foncé": "#0b2a8a", ivoire: "#f0d020", blanc: "#f4f4f4", jaune: "#f0d020", vert: "#2c9b3a" };
const color = (c) => CSS[String(c || "").toLowerCase()] || "#999999";
const SIZES = parseSizes("2,3,4,5,6,8,10,12");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const app = document.getElementById("app");
const msg = (t, d) => { app.innerHTML = `<div class="ph-msg"><b>${esc(t)}</b>${esc(d || "")}</div>`; };

async function main() {
  let R = null;
  try { R = await readBande(location.hash); } catch (e) { msg("QR code illisible", "Cette adresse ne contient pas une boîte lisible. Scannez de nouveau le QR code de l'étiquette."); return; }
  if (!R) { msg("Câblage pas à pas", "Scannez le QR code de l'étiquette d'une boîte pour afficher son câblage."); return; }
  const B = R.B, I = R.info, box = B.box;
  VIEW.atelier = true; VIEW.bouchAlim = I.bouch;
  const svg = CLEAN.svg(box, { color, sides: B.sides }).svg;
  const steps = boxSteps(box, SIZES).slice().sort((a, b) => a.n - b.n);
  const alim = box.gaines.filter((g) => g.kind === "alim");
  const libres = box.gaines.flatMap((g) => g.wires.filter((w) => w.libre && w.n == null).map((w) => ({ g, w, iso: !!w.isoler })));
  const bag = alim.flatMap((g) => { const m = new Map(); g.wires.forEach((w) => { if (!w.bague) return; if (!m.has(w.bague)) m.set(w.bague, []); m.get(w.bague).push(w.color); }); return [...m].map(([b, cols]) => ({ g, b, cols })); });
  const nsOf = (G) => new Set(G.flatMap((g) => g.wires.map((w) => w.n).filter((n) => n != null)));
  const seq = [];
  if (bag.length) seq.push({ k: "alim", n: "⌂", label: `Gaine d'alimentation ${alim.map((g) => g.no).join(", ")} : poser les bagues`, ns: nsOf(alim), html: `<ul class="ph-l">${bag.map((x) => `<li><span class="ph-bague">${esc(x.b)}</span> sur ${x.cols.map((c) => `<i style="background:${color(c)}"></i>${esc(c)}`).join(" + ")}</li>`).join("")}</ul>` });
  steps.forEach((s) => seq.push({ k: "n", n: s.n, label: s.label, step: s, ns: new Set([s.n]) }));
  const isoW = libres.filter((x) => x.iso).map((x) => x.w);
  if (libres.length) seq.push({ k: "iso", n: "!", label: "Fils à isoler", ns: new Set(), iso: true, step: isoW.length ? { n: "!", label: "Fils à isoler", wires: isoW, conn: { list: isoW.map(() => 2), ponts: 0 } } : null, html: `<ul class="ph-l">${libres.map((x) => `<li><i style="background:${color(x.w.color)}"></i>fil ${esc(x.w.color)} de <b>N°${esc(String(x.g.no).split(".").pop())}</b> (${esc((x.g.reps || []).join("+"))}) : ${x.iso ? "<b>à isoler</b>, connecteur de 2" : `<b style="color:#b45309">à décider par le BE</b>`}</li>`).join("")}</ul>` });
  // les bouchons se posent AVANT tout le reste (Thibault, 16 et 17/11/2026)
  const bch = box.gaines.filter((g) => g.cable || (g.kind === "alim" && I.bouch));
  if (bch.length) seq.unshift({ k: "bch", n: "●", label: `En premier : poser les bouchons (${bch.length})`, ns: nsOf(bch), html: `<ul class="ph-l">${bch.map((g) => `<li><span class="ph-bch" style="background:${bouchonColor(g.diam)}">BOUCHON Ø${g.diam}</span> ${g.kind === "alim" ? `<b>${esc(g.no)}</b> gaine d'alimentation (tableau)` : `<b>N°${esc(String(g.no).split(".").pop())}</b> ${esc((g.reps || []).join("+"))} · câble ${esc(cableTxt(g.cable))}`}</li>`).join("")}</ul>` });
  const done = new Set(); let i = -1;
  document.title = `${box.n} · câblage pas à pas`;
  app.innerHTML = `<div class="ph-scr" id="ph-scr">
    <div class="ph-aff"><b>${esc(I.chantier)}</b><span>${esc([I.client, I.affaire].filter(Boolean).join(" · "))}</span></div>
    <header class="ph-hd"><div><small>Boîte</small><b>${esc(box.n)}</b></div><div><small>Gaines</small><b>${box.gaines.length}</b></div><div class="r"><small>Modèle</small><b style="font-size:13px">${esc(I.modele)}</b></div></header>
    <div class="ph-faces">${["A", "B", "C", "D"].map((f) => `<span><b>${f}</b> ${esc(B.sides[f] || "—")}</span>`).join("")}</div>
    <button type="button" class="ph-go" id="ph-go">▶ Câbler pas à pas <small>une étape à la fois, avec son connecteur</small></button>
    <div class="ph-top" hidden><b class="ph-n"></b><span class="ph-lab"></span><span class="ph-cnt"></span><button type="button" class="ph-x" aria-label="Quitter le pas à pas">✕</button><i class="ph-bar"></i></div>
    <section class="ph-sch"><div class="ph-svg">${svg}</div><div class="ph-cn" hidden></div><div class="ph-info" hidden></div><p class="fn ph-hint">Touchez un numéro : seuls ses fils restent, et le connecteur à prendre s'affiche.</p></section>
    <section class="ph-rest"><h3>Étapes <span class="fn" id="ph-prog"></span></h3><ol class="ph-steps">${seq.map((s, j) => `<li data-j="${j}"><label><input type="checkbox"><b class="ph-sn">${esc(s.n)}</b> ${esc(s.label)}${s.step ? `<small>${s.step.wires.length} fils → ${s.step.conn.list.length ? s.step.conn.list.map((k) => "connecteur de " + k).join(" + ") : "fil seul : vérifier"}</small>` : ""}</label>${s.html || ""}</li>`).join("")}</ol>
      <h3>Contrôle final</h3><ul class="ph-l"><li>Chaque gaine : tous ses fils dans un connecteur, sauf ceux marqués « à isoler ».</li><li>Chaque connecteur : le bon nombre de fils, enfoncés jusqu'au bout.</li><li>${I.bouch ? "Un bouchon sur chaque câble et sur chaque gaine d'alimentation" : "Un bouchon sur chaque câble"}, posé avant de câbler.</li></ul></section>
    <div class="ph-nav" hidden><button type="button" class="ph-prev">◀ Précédent</button><button type="button" class="ph-next">Suivant ▶</button></div>
    <div class="ph-end" hidden><div><b>✓</b><h2>Boîte ${esc(box.n)} câblée</h2><p>${seq.length} étapes faites.</p><p class="fn">Faites le contrôle final.</p><button type="button" class="ph-again">Revoir depuis le début</button><button type="button" class="ph-fin">Fermer</button></div></div>
  </div>`;
  const q = (s) => app.querySelector(s), scr = q("#ph-scr"), sv = q(".ph-svg svg"), cn = q(".ph-cn"), info = q(".ph-info");
  sv.removeAttribute("width"); sv.removeAttribute("height");
  const focus = (s) => { sv.querySelectorAll("[data-n], [data-ns]").forEach((el) => {
    if (!s) { el.style.opacity = ""; return; }
    const keep = el.hasAttribute("data-n") ? (el.getAttribute("data-n") === "" ? !!s.iso : s.ns.has(+el.getAttribute("data-n"))) : (el.getAttribute("data-ns") || "").split(" ").filter(Boolean).some((n) => s.ns.has(+n));
    el.style.opacity = keep ? "" : "0.1"; });
    cn.hidden = !(s && s.step); cn.innerHTML = s && s.step ? connecteurCard(s.step, { color, esc }) : "";
    info.hidden = !(s && s.html); info.innerHTML = s && s.html ? s.html : ""; };
  const prog = () => { q("#ph-prog").textContent = `${done.size} / ${seq.length}`; };
  const mark = (j, on) => { if (on) done.add(j); else done.delete(j); const li = q(`.ph-steps > li[data-j="${j}"]`); li.classList.toggle("done", on); li.querySelector("input").checked = on; prog(); };
  app.querySelectorAll(".ph-steps > li").forEach((li) => (li.querySelector("input").onchange = (e) => mark(+li.dataset.j, e.target.checked)));
  prog();
  let free = null;
  sv.addEventListener("click", (e) => { if (i >= 0) return; const t = e.target.closest("[data-n]"), n = t && t.getAttribute("data-n"); const s = n ? seq.find((x) => x.k === "n" && String(x.n) === n) : null; free = s && free !== s ? s : null; focus(free); });
  const go = (j) => { i = Math.max(0, Math.min(seq.length - 1, j)); const s = seq[i]; q(".ph-end").hidden = true; focus(s);
    q(".ph-n").textContent = s.n; q(".ph-lab").textContent = s.label; q(".ph-cnt").textContent = `${i + 1} / ${seq.length}`; q(".ph-bar").style.width = `${((i + 1) / seq.length) * 100}%`;
    q(".ph-prev").disabled = i === 0; q(".ph-next").textContent = i === seq.length - 1 ? "Terminer ✓" : "Suivant ▶"; };
  const start = () => { scr.classList.add("pp"); q(".ph-top").hidden = false; q(".ph-nav").hidden = false; const f = seq.findIndex((_, j) => !done.has(j)); go(f < 0 ? 0 : f); scr.scrollTop = 0; };
  const stop = () => { i = -1; scr.classList.remove("pp"); q(".ph-top").hidden = true; q(".ph-nav").hidden = true; q(".ph-end").hidden = true; free = null; focus(null); };
  q("#ph-go").onclick = start; q(".ph-x").onclick = stop; q(".ph-fin").onclick = stop; q(".ph-again").onclick = () => go(0);
  q(".ph-prev").onclick = () => { if (i > 0) go(i - 1); };
  q(".ph-next").onclick = () => { mark(i, true); if (i < seq.length - 1) return go(i + 1); focus(null); q(".ph-end").hidden = false; };
}
main();
window.addEventListener("hashchange", () => location.reload());
