/* site footer: the "Prefer mail?" card copies the address, with the caption confirming it */
(() => {
  const foot = document.querySelector("[data-sf]");
  if (!foot) return;
  foot.querySelectorAll(".sf-yr").forEach(el => { el.textContent = new Date().getFullYear(); });

  const card = foot.querySelector("[data-sf-copy]");
  if (!card) return;
  const cap = card.querySelector(".sf-cap"), label = cap ? cap.textContent : "";
  let timer = 0;
  const say = text => { if (!cap) return; cap.textContent = text; clearTimeout(timer); timer = setTimeout(() => { cap.textContent = label; }, 2200); };
  const fallback = mail => {
    const ta = document.createElement("textarea");
    ta.value = mail; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove(); return ok;
  };
  card.addEventListener("click", e => {
    e.preventDefault();
    const mail = card.dataset.sfCopy;
    const done = () => say("/ Copied to clipboard");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(mail).then(done, () => (fallback(mail) ? done() : (location.href = "mailto:" + mail)));
    else if (fallback(mail)) done(); else location.href = "mailto:" + mail;
  });
})();

/* "Let's create" panel: pin it under the section above (a curtain reveal) and run a colour wave
   through the heading as it is uncovered; hovering the heading replays the wave */
(() => {
  const lc = document.querySelector("[data-lc]");
  if (!lc) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // the section above becomes the curtain: it needs to sit on top and be opaque
  const prev = lc.previousElementSibling;
  if (prev) {
    const cs = getComputedStyle(prev);
    if (cs.position === "static") prev.style.position = "relative";
    prev.style.zIndex = "1";
    const bg = cs.backgroundColor;
    if (cs.backgroundImage === "none" && (bg === "transparent" || /rgba\(.*,\s*0\)$/.test(bg))) {
      let b = getComputedStyle(document.body).backgroundColor;
      if (/rgba\(.*,\s*0\)$/.test(b) || b === "transparent") b = getComputedStyle(document.documentElement).backgroundColor;
      prev.style.backgroundColor = b;
    }
    lc.setAttribute("data-pin", "");
  }

  // colour wave: split the heading into characters (words kept together so lines wrap cleanly)
  const h = lc.querySelector("[data-lc-wave]");
  if (!h || reduce || !h.animate) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--tint").trim() || "#b9a5ea";
  const base = getComputedStyle(h).color;
  const lines = h.innerHTML.split(/<br\s*\/?>/i).map(s => s.replace(/<[^>]*>/g, "").trim());
  const chars = [];
  h.textContent = "";
  lines.forEach((line, li) => {
    if (li) h.appendChild(document.createElement("br"));
    line.split(/\s+/).forEach((word, wi) => {
      if (wi) h.appendChild(document.createTextNode(" "));
      const w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden", "true");
      for (const ch of word) { const c = document.createElement("span"); c.textContent = ch; w.appendChild(c); chars.push(c); }
      h.appendChild(w);
    });
  });
  chars.forEach(c => { c.style.opacity = ".15"; });

  const STAGGER = 40, DUR = 310;
  let ran = false, anims = [];
  const wave = first => {
    anims.forEach(a => a.cancel()); anims = [];
    chars.forEach((c, i) => {
      c.style.opacity = "1";
      anims.push(c.animate([
        { color: base, opacity: first ? .15 : 1 },
        { color: accent, opacity: 1, offset: .48 },
        { color: base, opacity: 1 }
      ], { duration: DUR, delay: i * STAGGER + (first ? 100 : 0), easing: "ease-out", fill: "backwards" }));
    });
  };
  // start once the panel is mostly uncovered
  const anchor = lc.querySelector(".lc-anchor") || lc;
  const check = () => {
    if (ran) return;
    if (anchor.getBoundingClientRect().top < innerHeight * 0.45) { ran = true; wave(true); removeEventListener("scroll", check); }
  };
  addEventListener("scroll", check, { passive: true });
  check();
  h.addEventListener("mouseenter", () => { if (ran) wave(false); });
})();
