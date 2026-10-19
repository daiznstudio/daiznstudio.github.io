/* =====================================================================
   CONTACT FORM KEY. Paste the access key from web3forms.com between the quotes and every
   "Send a message" form on the site delivers straight to the studio inbox. Left empty, the form
   opens the visitor's own email app instead (the old behaviour).
   ===================================================================== */
const FORM_KEY = "c492e714-a3d7-417f-8dca-ae6232dffa34";

/* CALENDLY LINK. The event every "Book a meeting" / "Schedule call" button and the homepage calendar books. */
const CALENDLY = "https://calendly.com/daiznstudio/30min";

/* "Send a message" form: checks the fields (the browser's own required / email checks), then sends
   through Web3Forms and reports back inside the form. A hidden checkbox catches spam bots. */
(() => {
  const form = document.getElementById("cform");
  if (!form) return;
  const status = form.querySelector(".lc-status"), btn = form.querySelector('button[type="submit"]'), label = btn.querySelector(".lc-btn-t");
  const mailLink = document.querySelector('.lc-btn[href^="mailto:"], [data-sf-copy]');
  const email = mailLink ? (mailLink.dataset.sfCopy || mailLink.getAttribute("href").replace(/^mailto:/, "")) : "daiznstudio@gmail.com";
  const say = (text, kind) => { status.textContent = text; status.dataset.kind = kind || ""; };
  form.addEventListener("input", () => { if (status.dataset.kind === "err") say(""); });

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (form.botcheck && form.botcheck.checked) return;   // only bots tick the hidden box
    const name = form.fname.value.trim(), from = form.email.value.trim(), msg = form.msg.value.trim();

    if (!FORM_KEY) {
      const a = document.createElement("a");
      a.href = `mailto:${email}?subject=${encodeURIComponent("Message from " + name)}&body=${encodeURIComponent(`${msg}\n\n${name} (${from})`)}`;
      a.click();
      say("Your email app should open with the message filled in. If nothing happens, email us at " + email + ".", "ok");
      return;
    }

    btn.disabled = true; label.textContent = "Sending…"; say("");
    fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ access_key: FORM_KEY, subject: `New message from ${name} (daizn studio website)`, from_name: "daizn studio website", name, email: from, message: msg, page: location.href })
    })
      .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok || j.success === false) throw new Error(j.message || r.status); }))
      .then(() => { form.reset(); say(`Thanks ${name}, your message has been sent. We'll reply by email soon.`, "ok"); },
            () => say(`Sorry, your message didn't send. Please try again, or email us at ${email}.`, "err"))
      .finally(() => { btn.disabled = false; label.textContent = "Submit message"; });
  });
})();

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

/* Calendly booking: [data-cal] links open the booking popup. The contact card gets two tabs, "Send a message"
   and "Book a call"; the second embeds the calendar the first time it opens, and [data-cal-tab] links open the card
   on that tab. A page load always starts on "Send a message". Both embed Calendly's page directly (no widget
   script) behind a ghost calendar that fades out once Calendly says it has drawn. */
(() => {
  const url = CALENDLY + "?hide_gdpr_banner=1&hide_event_type_details=1&hide_landing_page_details=1&background_color=ffffff&text_color=101010&primary_color=3f1c8c"
    + "&embed_type=Inline&embed_domain=" + encodeURIComponent(location.host || "localhost");
  const ghost = '<div class="cal-ghost" aria-hidden="true"><i class="g-t"></i><div class="g-m"><i></i><b><i></i><i></i></b></div>'
    + '<div class="g-d">' + "<i></i>".repeat(7) + '</div><div class="g-g">'
    + Array.from({ length: 35 }, (_, n) => n % 7 > 0 && n % 7 < 6 && n > 9 && n % 3 ? '<i class="on"></i>' : "<i></i>").join("")
    + '</div><i class="g-z"></i></div>';
  // fills host with the ghost and the calendar; onBooked runs when a meeting is booked
  const embed = (host, onBooked) => {
    host.classList.add("cal-host");
    host.innerHTML = ghost;
    const f = document.createElement("iframe");
    f.title = "Book a meeting with Daizn Studio"; f.src = url;
    let late;
    const ready = () => { clearTimeout(late); host.classList.add("is-ready"); };
    addEventListener("message", e => {
      if (e.source !== f.contentWindow || !e.data || typeof e.data.event !== "string") return;
      if (e.data.event === "calendly.event_type_viewed") ready();
      if (e.data.event === "calendly.event_scheduled" && onBooked) onBooked();
    });
    // in case the message never comes, show the calendar a little after the frame loads
    f.addEventListener("load", () => { late = setTimeout(ready, 2500); });
    host.append(f);
  };

  /* the popup gets the footer card's look (styles in assets/footer.css): a header with a close button, a soft
     light that follows the pointer, and closing waits for the drop-away animation. It is built the first time a
     booking link is hovered or focused, so the calendar is usually loaded by the time it opens */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let box, from, shutting = false, booked = false;
  const build = () => {
    if (box) return;
    box = document.createElement("div");
    box.className = "dz-cal";
    box.innerHTML = `<div class="dz-cal-pop" role="dialog" aria-modal="true" aria-label="Book a meeting"><i class="dz-cal-glow"></i>`
      + `<div class="cal-head"><div class="cal-top"><p class="sf-cap">/ Book a meeting</p><p class="cal-big">Pick a time</p></div>`
      + `<button type="button" class="cal-x" aria-label="Close">${X}</button></div><div class="dz-cal-body"></div></div>`;
    const pop = box.firstChild, glow = pop.firstChild;
    embed(box.querySelector(".dz-cal-body"), () => { booked = true; });
    box.querySelector(".cal-x").addEventListener("click", shut);
    box.addEventListener("click", e => { if (e.target === box) shut(); });
    if (matchMedia("(hover: hover)").matches) {
      let q = 0, ev;
      box.addEventListener("pointermove", e => {
        ev = e;
        if (!q) q = requestAnimationFrame(() => {
          q = 0;
          const r = pop.getBoundingClientRect();
          glow.style.transform = `translate(${ev.clientX - r.left}px,${ev.clientY - r.top}px)`;
        });
      });
    }
    document.body.append(box);
  };
  const open = () => {
    build();
    if (box.classList.contains("is-open")) return;
    from = document.activeElement;
    box.firstChild.firstChild.style.transform = `translate(${box.firstChild.offsetWidth * .85}px,0)`;
    box.classList.add("is-open");
    document.documentElement.classList.add("cal-open");
    box.querySelector(".cal-x").focus({ preventScroll: true });
  };
  const closed = () => {
    shutting = false;
    box.classList.remove("is-open", "dz-out");
    document.documentElement.classList.remove("cal-open");
    if (from && from.focus) from.focus({ preventScroll: true });
    // after a booking the calendar shows its confirmation: start fresh next time
    if (booked) { box.remove(); box = null; booked = false; }
  };
  function shut() {
    if (!box || !box.classList.contains("is-open") || shutting) return;
    if (reduce) return closed();
    shutting = true;
    const t = setTimeout(closed, 500);
    box.addEventListener("animationend", function end(e) {
      if (e.animationName !== "calOut") return;
      box.removeEventListener("animationend", end); clearTimeout(t); closed();
    });
    box.classList.add("dz-out");
  }
  const warm = e => { if (e.target.closest && e.target.closest("[data-cal]")) build(); };
  document.addEventListener("pointerover", warm, { passive: true });
  document.addEventListener("focusin", warm);
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("[data-cal]");
    if (!a) return;
    e.preventDefault();
    open();
  });
  document.addEventListener("keydown", e => {
    if (!box || !box.classList.contains("is-open")) return;
    if (e.key === "Escape") shut();
    // keep Tab inside the popup: the close button is its only control outside the calendar frame
    if (e.key === "Tab" && !box.contains(document.activeElement)) { e.preventDefault(); box.querySelector(".cal-x").focus(); }
  });

  const form = document.getElementById("cform");
  if (!form) return;
  const tabs = document.createElement("div");
  tabs.className = "lc-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "How to get in touch");
  tabs.innerHTML = '<button type="button" role="tab" id="lc-tab-msg" aria-controls="cform" aria-selected="true">Send a message</button>'
    + '<button type="button" role="tab" id="lc-tab-cal" aria-controls="lc-cal" aria-selected="false" tabindex="-1">Book a call</button>';
  const cal = document.createElement("div");
  cal.className = "lc-cal"; cal.id = "lc-cal"; cal.hidden = true;
  cal.setAttribute("role", "tabpanel"); cal.setAttribute("aria-labelledby", "lc-tab-cal");
  form.prepend(tabs); form.append(cal);
  const [tMsg, tCal] = tabs.querySelectorAll("button");

  let embedded = false;
  const show = book => {
    form.classList.toggle("is-cal", book);
    cal.hidden = !book;
    tMsg.setAttribute("aria-selected", !book); tCal.setAttribute("aria-selected", book);
    tMsg.tabIndex = book ? -1 : 0; tCal.tabIndex = book ? 0 : -1;
    if (book && !embedded) { embedded = true; embed(cal); }
  };
  tMsg.addEventListener("click", () => show(false));
  tCal.addEventListener("click", () => show(true));
  tabs.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const book = tMsg.getAttribute("aria-selected") === "true";
    show(book); (book ? tCal : tMsg).focus();
  });

  const toContact = () => (document.getElementById("contact") || form).scrollIntoView({ block: "start" });
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest("[data-cal-tab]");
    if (!a) return;
    e.preventDefault();
    show(true); toContact();
  });
})();

/* phones tint their status bar and toolbar from the page background, which is light grey. Once the black contact
   card or footer reaches the bottom of the screen, the background behind everything turns black so the bars match */
(() => {
  const root = document.documentElement;
  let q = 0;
  // looked up on each check: pages build their contact card and footer after this script loads
  const check = () => {
    q = 0;
    root.classList.toggle("end-dark", [...document.querySelectorAll(".lc, .sf")].some(e => e.getBoundingClientRect().top < innerHeight * .9));
    // the footer's bottom edge is in view: match the toolbar to the glow there (see html.end-glow in footer.css)
    const sf = document.querySelector(".sf");
    root.classList.toggle("end-glow", !!sf && sf.getBoundingClientRect().bottom < innerHeight + 80);
  };
  addEventListener("scroll", () => { if (!q) q = requestAnimationFrame(check); }, { passive: true });
  addEventListener("resize", check);
  check();
})();

/* the footer logo in the hero folder's frosted glass, kept clear (styles in assets/footer.css): the mark and word are redrawn as
   one SVG, 200 units to the em, laid out like the original (mark .74em tall on the baseline, .14em gap, word at
   1em). The glass is pure white, frosted enough to read over the footer glow: a brighter top and highlight over the wash. An SVG filter adds a soft
   frost on the face, a faint white halo outside and a bright white rim. It stays still */
(() => {
  const NS = "http://www.w3.org/2000/svg", P = 48;
  const build = a => {
    a.dataset.glass = "1";
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("class", "sf-glass"); s.setAttribute("aria-hidden", "true");
    // drawn twice (the wash, then the highlight over it)
    const shape = `<rect y="-148" width="92.5" height="99.9" rx="42.55"/><path d="M0 0A46.25 44.4 0 0 1 92.5 0Z"/><text x="120.5" y="0"><tspan class="th">dai</tspan><tspan class="bd">zn</tspan></text>`;
    s.innerHTML = `<defs>
      <linearGradient id="sfg-wash" gradientUnits="userSpaceOnUse" x1="0" y1="-150" x2="0" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity=".86"/><stop offset=".45" stop-color="#fff" stop-opacity=".66"/>
        <stop offset=".8" stop-color="#fff" stop-opacity=".58"/><stop offset="1" stop-color="#fff" stop-opacity=".72"/></linearGradient>
      <radialGradient id="sfg-hi" gradientUnits="userSpaceOnUse" cx="0" cy="-130" r="520" gradientTransform="translate(0 -130) scale(1 .3) translate(0 130)">
        <stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="sfg-frost" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="16" result="hb"/>
        <feFlood flood-color="#fff" flood-opacity=".12"/><feComposite in2="hb" operator="in"/><feComposite in2="SourceAlpha" operator="out" result="halo"/>
        <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/><feComposite in2="SourceAlpha" operator="in" result="grain"/>
        <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="soft"/><feComposite in="SourceAlpha" in2="soft" operator="out" result="inner"/>
        <feFlood flood-color="#fff" flood-opacity=".4"/><feComposite in2="inner" operator="in" result="glow"/>
        <feMorphology in="SourceAlpha" operator="erode" radius="1.6" result="er"/><feComposite in="SourceAlpha" in2="er" operator="out" result="ring"/>
        <feFlood flood-color="#fff" flood-opacity=".9"/><feComposite in2="ring" operator="in" result="rim"/>
        <feMerge><feMergeNode in="halo"/><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/><feMergeNode in="glow"/><feMergeNode in="rim"/></feMerge>
      </filter>
      </defs><g filter="url(#sfg-frost)"><g fill="url(#sfg-wash)">${shape}</g><g fill="url(#sfg-hi)">${shape}</g></g>`;
    a.append(s); a.classList.add("is-glass");
    const text = s.querySelector("text"), f = s.querySelector("filter");
    // the view box hugs the drawing plus room for the halo; the same room comes off as negative margin
    const fit = () => {
      const t = text.getBBox(), top = Math.min(t.y, -148), w = t.x + t.width, h = -top, box = [-P, top - P, w + 2 * P, h + 2 * P];
      s.setAttribute("viewBox", box.join(" "));
      ["x", "y", "width", "height"].forEach((k, n) => f.setAttribute(k, box[n]));
      s.style.setProperty("--h", box[3] / 200 + "em");
      s.style.setProperty("--m", -P / 200 + "em");
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  };
  const scan = () => document.querySelectorAll(".sf-logo:not([data-glass])").forEach(build);
  scan();
  // most pages build their footer after this script runs
  if (!document.querySelector(".sf-logo[data-glass]")) {
    const mo = new MutationObserver(() => { scan(); if (document.querySelector(".sf-logo[data-glass]")) mo.disconnect(); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
