/* Palettes: works out each project's colours from its cover image and saves them in assets/palettes.js,
   which the project popup uses to colour its side panel.

   Run it after adding or changing a project cover, before you push:
       node _tools/palettes.js
   (first time only: run "npm install" inside the _tools folder)

   Why a tool: browsers won't let a page read an image's pixels when the site is opened from disk, so the
   colours are worked out once here (with the same code the popup uses, window.MXP.palette in
   assets/viewer.js) and saved. On the published site a cover missing from the file is still read live. */
const http = require("http"), fs = require("fs"), path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const PAGES = ["index.html", "projects.html", "team.html", "developer.html"];
const OUT = path.join(ROOT, "assets/palettes.js");

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

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!p.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(p).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise(ok => server.listen(0, "127.0.0.1", () => ok(server)));
}

// each project's popup is coloured from its cover (else its first gallery image, else its video poster);
// the rest of its images (gallery and hover) are the fallback when that one is grey. Projects are one per line.
function projects() {
  const map = new Map(), ok = p => fs.existsSync(path.join(ROOT, p));
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    for (const line of html.split("\n")) {
      if (!/\{ who: /.test(line)) continue;
      const cover = (line.match(/cover: "([^"]+)"/) || [])[1], first = (line.match(/gallery: \[\["([^"]+)"/) || [])[1];
      const video = (line.match(/video: "([^"]+)"/) || [])[1], key = cover || first || (video && video + "/poster.webp");
      if (!key || !ok(key)) continue;
      const others = [...line.matchAll(/"(assets\/work\/[^"]+\.(?:webp|jpe?g|png))"/g)].map(m => m[1]).filter(p => p !== key && ok(p));
      // a project shown first by its gallery image is also keyed by it, in case its cover is left out
      for (const k of [key, first].filter(Boolean)) map.set(k, [...new Set([...(map.get(k) || []), ...others])]);
    }
  }
  return map;
}

(async () => {
  const exe = BROWSERS.find(p => fs.existsSync(p));
  if (!exe) { console.error("No Chrome or Edge found. Set CHROME_PATH to your browser's .exe and try again."); process.exit(1); }
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await puppeteer.launch({ executablePath: exe });
  const page = await browser.newPage();
  await page.goto(base + "404.html");
  await page.addScriptTag({ url: base + "assets/viewer.js" });
  const read = (src, min) => page.evaluate(async (src, min) => {
    const img = new Image(); img.src = src;
    await img.decode();
    return { p: window.MXP.palette(img, min), v: window.MXP.vividness(img) };
  }, base + src, min);
  const list = projects(), out = {};
  for (const [src, others] of [...list].sort((x, y) => x[0] < y[0] ? -1 : 1)) {
    let { p } = await read(src), from = "";
    if (!p) {
      // grey cover: use the project's most colourful other image
      let best = null;
      for (const o of others) { const r = await read(o); if (r.p && (!best || r.v > best.v)) best = { ...r, o }; }
      // every image is low on colour: take the faint colour of the most colourful one (cover included)
      if (!best) for (const o of [src, ...others]) { const r = await read(o, .002); if (r.p && (!best || r.v > best.v)) best = { ...r, o }; }
      if (best) { p = best.p; from = "  (from " + best.o + ")"; }
    }
    out[src] = p;
    console.log((p ? "colour " : "plain  ") + src + from);
  }
  await browser.close(); server.close();
  fs.writeFileSync(OUT, "/* project cover colours for the popup, made by _tools/palettes.js; don't edit by hand */\nwindow.MX_PALETTES = " + JSON.stringify(out, null, 0).replace(/\},"/g, '},\n"') + ";\n");
  console.log(`\nSaved ${list.size} palettes to assets/palettes.js`);
})();
