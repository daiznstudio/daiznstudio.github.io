/* Prerender: saves a plain-text copy of each page's content into its HTML file, so search engines and
   link previews that don't run JavaScript still see the headings, services, projects and reviews.

   Run it after editing a page's DATA, before you push:
       node _tools/prerender.js
   (first time only: run "npm install" inside the _tools folder)

   How it works: it serves the site locally, opens each page in your installed Chrome or Edge, lets it
   build itself, then writes a cleaned copy of what it built into <main id="app"> between the
   <!--pre:start--> and <!--pre:end--> markers. Visitors never see it: the page script replaces it
   the moment it runs. People with JavaScript turned off get it as a readable fallback.
   Folders starting with "_" are not published by GitHub Pages, so this tool stays private. */
const http = require("http"), fs = require("fs"), path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const PAGES = ["index.html", "projects.html", "team.html"];
const START = "<!--pre:start-->", END = "<!--pre:end-->";

const BROWSERS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
].filter(Boolean);

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".otf": "font/otf", ".mp4": "video/mp4", ".webm": "video/webm", ".xml": "application/xml", ".txt": "text/plain" };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, "index.html") : p, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

/* runs inside the page: copy what the page built, keep only the content a reader or crawler needs */
function snapshot() {
  const clone = document.getElementById("app").cloneNode(true);
  // headings drawn letter by letter carry their words in aria-label
  clone.querySelectorAll("[aria-label]").forEach(e => { if (/^H[1-6]$/.test(e.tagName)) e.textContent = e.getAttribute("aria-label"); });
  // count-up numbers start at 0 until they scroll into view: write the final figure
  clone.querySelectorAll("[data-count]").forEach(e => { e.textContent = e.dataset.count + (e.dataset.suffix || ""); });
  // the wordmark is split into "dai" and "zn" for its two weights
  clone.querySelectorAll(".wm").forEach(e => { e.textContent = e.textContent; });
  // cover images are decorative on the cards (alt=""), so name them after their project
  clone.querySelectorAll('img[alt=""]').forEach(img => {
    const card = img.closest("[aria-label]");
    if (card) img.setAttribute("alt", card.getAttribute("aria-label").replace(/^Open /, ""));
  });
  clone.querySelectorAll("[data-pre-skip],svg,canvas,video,script,style,noscript,form,button,dialog,.filters,.pk-sw,.pk-art,[aria-hidden=true]").forEach(e => e.replaceWith(" "));
  clone.querySelectorAll("[hidden]").forEach(e => e.removeAttribute("hidden"));

  // the all projects page: list every project with its description rather than the interactive grid
  const works = clone.querySelector("#rows");
  if (works && typeof DATA !== "undefined" && DATA.works) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    works.outerHTML = "<ul>" + DATA.works.items.map(p => `<li><h3>${esc(p.t)}</h3><p>${esc(p.cat)}, ${esc(p.year)}</p><p>${esc(p.s)}</p>` +
      (p.cover ? `<img src="${esc(p.cover)}" alt="${esc(p.t)}" loading="lazy" decoding="async">` : "") +
      (p.live ? `<a href="${esc(p.live)}">${esc(p.liveLabel || "View project")}</a>` : "") + "</li>").join("") + "</ul>";
  }

  clone.querySelectorAll("img").forEach(img => {
    const src = img.getAttribute("src") || img.dataset.src || img.dataset.md || img.dataset.sq;
    if (!src || src.startsWith("data:")) return img.remove();
    img.setAttribute("src", src); img.setAttribute("loading", "lazy"); img.setAttribute("decoding", "async");
  });
  const keep = { a: ["href"], img: ["src", "alt", "loading", "decoding"] };
  clone.querySelectorAll("*").forEach(e => {
    [...e.attributes].forEach(a => { if (!(keep[e.tagName.toLowerCase()] || []).includes(a.name)) e.removeAttribute(a.name); });
  });
  // unwrap layout-only wrappers and drop anything left empty
  for (let pass = 0; pass < 3; pass++) {
    clone.querySelectorAll("span,div,i,b").forEach(e => { if (!e.textContent.trim() && !e.querySelector("img")) e.remove(); });
    // a space after each one keeps neighbouring labels apart ("Logo Packaging", not "LogoPackaging")
    clone.querySelectorAll("span").forEach(e => e.replaceWith(...e.childNodes, " "));
  }
  return clone.innerHTML.replace(/\s+/g, " ").trim();
}

(async () => {
  const exe = BROWSERS.find(p => fs.existsSync(p));
  if (!exe) throw new Error("No Chrome or Edge found. Set CHROME_PATH to your browser's executable.");
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: exe, headless: true });
  try {
    for (const file of PAGES) {
      const page = await browser.newPage();
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      await page.setViewport({ width: 1280, height: 900 });
      await page.evaluateOnNewDocument(() => { try { sessionStorage.setItem("dzIntro", "1"); } catch (e) { } });
      await page.goto(base + file, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise(r => setTimeout(r, 800));
      if (errors.length) throw new Error(`${file}: the page reported an error, nothing written.\n  ${errors.join("\n  ")}`);
      const html = await page.evaluate(snapshot);
      await page.close();

      const src = path.join(ROOT, file), s = fs.readFileSync(src, "utf8");
      const block = `${START}<div class="pre"><style>.pre{max-width:72ch;margin:0 auto;padding:120px 20px 64px}.pre img{display:block;max-width:100%;max-height:260px;width:auto;height:auto;margin:12px 0}.pre img[src*="/brands/"]{display:inline-block;height:26px;margin:8px 16px 8px 0;filter:brightness(0)}.pre ul{padding-left:1.2em}.pre h2,.pre h3{margin:1.6em 0 .4em}</style>${html}</div>${END}`;
      let out;
      if (s.includes(START) && s.includes(END)) out = s.slice(0, s.indexOf(START)) + block + s.slice(s.indexOf(END) + END.length);
      else if (/<main id="app">[\s\S]*?<\/main>/.test(s)) out = s.replace(/<main id="app">[\s\S]*?<\/main>/, `<main id="app">${block}</main>`);
      else throw new Error(`${file}: no <main id="app"> found`);
      if (out !== s) fs.writeFileSync(src, out);
      console.log(`${file}: ${out === s ? "already up to date" : "updated"} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB of content)`);
    }
  } finally {
    await browser.close(); server.close();
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
