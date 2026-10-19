/* Project viewer extras, shared by every page with the project popup: each time the popup gets new
   content, the side panel takes its colours from the project's cover (then from each image as you step
   through the gallery) and the highlights fold under a toggle. While it is open the page behind holds still.
   Styles live in assets/viewer.css.

   Cover colours come from assets/palettes.js (made by _tools/palettes.js, since browsers won't let a
   page read image pixels when it's opened from disk). A cover missing from that file is read live on the
   published site. A grey cover borrows the colours of the project's most colourful other image (the tool
   does this); only when every image is grey does the panel keep the brand purples. */
(function () {
  /* the most vivid colours of an image, turned into the panel's shades; null when it has too little colour */
  const hsl2hex = (h, s, l) => {
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, "0"); };
    return "#" + f(0) + f(8) + f(4);
  };
  const hueSat = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn, l = (mx + mn) / 2;
    if (!dl) return [0, 0, l];
    const h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
    return [(h / 6 + 1) % 1, dl / (1 - Math.abs(2 * l - 1)), l];
  };
  // colourful pixels sorted into hue bins, weighted by how vivid they are; vivid is the share of colour overall
  function scan(img) {
    const n = 48, c = document.createElement("canvas"); c.width = c.height = n;
    const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, n, n);
    const d = x.getImageData(0, 0, n, n).data, B = 18, bins = Array.from({ length: B }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
    let vivid = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255, [h, s, l] = hueSat(r, g, b);
      if (s < .25 || l < .1 || l > .9) continue;
      const w = s * (1 - Math.abs(l - .5)), k = bins[Math.floor(h * B) % B];
      k.w += w; k.r += r * w; k.g += g * w; k.b += b * w; vivid += w;
    }
    return { bins, vivid: vivid / (n * n) };
  }
  // only hues really in the image: with one strong hue every shade comes from it, nothing is invented
  function palette(img, min = .012) {
    const { bins, vivid } = scan(img);
    if (vivid < min) return null;
    const top = bins.filter(k => k.w).sort((a, b) => b.w - a.w);
    const hs = top.filter(k => k.w > top[0].w * .2).slice(0, 3).map(k => hueSat(k.r / k.w, k.g / k.w, k.b / k.w));
    const [h0, s0] = hs[0], [h1, s1] = hs[1] || hs[0], [h2, s2] = hs[2] || hs[1] || hs[0], cl = (v, a, b) => Math.min(b, Math.max(a, v));
    return {
      d0: hsl2hex(h0, cl(s0, .35, .7), .1), d1: hsl2hex(h0, cl(s0, .4, .65), .28), d2: hsl2hex(h1, cl(s1, .4, .6), .36),
      c1: hsl2hex(h0, cl(s0, .5, .85), .48), c2: hsl2hex(h1, cl(s1, .45, .8), .55), lt: hsl2hex(h2, cl(s2, .35, .7), .64)
    };
  }
  window.MXP = { palette, vividness: img => scan(img).vivid };

  const m = document.getElementById("modal"); if (!m) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const known = window.MX_PALETTES || {}, live = {};

  // While the popup is open the page behind it holds still: its CSS animations are frozen (playback rate 0,
  // which leaves their own paused/running state alone), its playing videos pause, and its animation loops idle
  // (they check MX_OPEN). All of it carries on where it was once the popup closes
  let held = [], heldVideos = [];
  function holdPage(on) {
    if (on) {
      held = document.getAnimations().filter(a => a.playbackRate && !(a.effect && a.effect.target && m.contains(a.effect.target)));
      held.forEach(a => { a.playbackRate = 0; });
      heldVideos = [...document.querySelectorAll("video")].filter(v => !v.paused && !m.contains(v));
      heldVideos.forEach(v => v.pause());
    } else {
      held.forEach(a => { a.playbackRate = 1; });
      heldVideos.forEach(v => { const p = v.play(); if (p) p.catch(() => { }); });
      held = []; heldVideos = [];
    }
  }
  // The first frame of an open (restyling the page for the modal, laying out the popup, the GPU setting up) is the
  // slow one, so the popup is drawn but held invisible for it and fades in on the frames after
  new MutationObserver(() => {
    if (window.MX_OPEN === m.open) return;
    window.MX_OPEN = m.open;
    holdPage(m.open);
    if (!m.open || reduce) return;
    m.classList.add("mx-pre");
    requestAnimationFrame(() => requestAnimationFrame(() => m.classList.remove("mx-pre")));
  }).observe(m, { attributes: true, attributeFilter: ["open"] });
  // the wheel over the backdrop doesn't scroll the page behind
  m.addEventListener("wheel", e => { if (e.target === m) e.preventDefault(); }, { passive: false });

  // the accent for buttons: the cover's vivid colour, pulled toward its darkest shade until white text on it
  // reaches a 4.5:1 contrast (WCAG AA), then a deeper step of it for hovers
  const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  const mix = (a, b, t) => "#" + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  const lum = h => { const [r, g, b] = rgb(h).map(v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
  function accent(p) {
    let ac = p.c1, t = 0;
    while (1.05 / (lum(ac) + .05) < 4.5 && t < 1) ac = mix(p.c1, p.d0, t += .05);
    return { ac, acd: mix(ac, p.d0, .3) };
  }

  // colours go on the popup itself so the close button (outside .mx) gets them too; cleared when a project
  // has no palette so it doesn't keep the last one's. The panel's colour change is a CSS transition
  const KEYS = ["d0", "d1", "d2", "c1", "c2", "lt", "ac", "acd"];
  function paint(p) {
    if (!p) { KEYS.forEach(k => m.style.removeProperty("--mx-" + k)); return; }
    p = Object.assign({}, p, accent(p));
    KEYS.forEach(k => m.style.setProperty("--mx-" + k, p[k]));
  }
  // an image's palette: from assets/palettes.js, else read live on the published site (null: none)
  function look(src, done) {
    if (!src) return done(null);
    if (src in known) return done(known[src]);
    if (src in live) return done(live[src]);
    if (!/^https?:/.test(location.protocol)) return done(null);
    const img = new Image();
    img.onload = () => { try { live[src] = palette(img); } catch (e) { live[src] = null; } done(live[src]); };
    img.onerror = () => done(null);
    img.src = src;
  }
  // the project's colours on open, then each gallery image's own as the viewer steps through them
  // (the project's when an image has none)
  const watch = new MutationObserver(() => {
    const mx = m.querySelector(".mx"), img = mx && mx.querySelector(".mx-view>img"); if (!img) return;
    const src = img.getAttribute("src");
    look(mx.dataset.cover, base => look(src, p => { if (img.isConnected && img.getAttribute("src") === src) paint(p || base); }));
  });
  function colour(mx) {
    paint(null);
    look(mx.dataset.cover, p => { if (mx.isConnected) paint(p); });
    const img = mx.querySelector(".mx-view>img");
    watch.disconnect();
    if (img) watch.observe(img, { attributes: true, attributeFilter: ["src"] });
  }

  function run() {
    const info = m.querySelector(".mx-info"); if (!info || info.dataset.fx) return;
    info.dataset.fx = "1";
    colour(m.querySelector(".mx"));
    // the hidden glow image the pages still build has nothing to show now
    const amb = m.querySelector(".mx-amb"); if (amb) amb.remove();
    // highlights fold away under a "What we did" toggle
    const feats = info.querySelector(".mx-feats");
    if (feats && feats.children.length) {
      const more = document.createElement("details"); more.className = "mx-more";
      more.innerHTML = `<summary>What we did <em>${feats.children.length}</em><i aria-hidden="true"></i></summary>`;
      feats.before(more); more.appendChild(feats);
    } else if (feats) feats.remove();
    info.querySelectorAll(".mx-meta span").forEach(s => {
      const t = Array.from(s.childNodes).find(n => n.nodeType === 3 && n.textContent.trim()); if (!t) return;
      const b = document.createElement("b"); b.textContent = t.textContent.trim(); t.replaceWith(b);
    });
  }
  new MutationObserver(run).observe(m, { childList: true });
})();
