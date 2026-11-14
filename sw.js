/* Thor World Tally — offline helper.
   Keeps a copy of the app on the phone so it opens in airplane mode.
   Upload this file next to index.html in the GitHub repository. */
const CACHE = "thor-world-tally-v1";
const CORE = ["./", "./index.html"];
const LIBS = [
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    // the sync code too, so the app starts the same way offline
    await Promise.all(LIBS.map(u => c.add(new Request(u, { mode: "no-cors" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// the page itself: try the internet first (to get updates), fall back to the saved copy
async function pageFirst(req) {
  const c = await caches.open(CACHE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 5000))
    ]);
    if (res && res.ok) c.put("./index.html", res.clone());
    return res;
  } catch (e) {
    return (await c.match("./index.html")) || (await c.match("./")) || Response.error();
  }
}

// fonts and libraries: use the saved copy, refresh it in the background
async function savedFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("firebaseio.com") || url.hostname.endsWith("firebasedatabase.app")) return; // live sync: never cached
  if (req.mode === "navigate" && url.origin === self.location.origin) { event.respondWith(pageFirst(req)); return; }
  if (url.origin === self.location.origin || /(^|\.)(gstatic\.com|googleapis\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) {
    event.respondWith(savedFirst(req));
  }
});
