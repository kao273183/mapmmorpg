/* 像素地城 — Service Worker
 * 快取策略（重點：index.html／導覽「網路優先」，才能拿到新版；版本化資產「快取優先」）：
 *   - 導覽 / index.html / manifest：Network-First。線上一律取最新 index.html（含新的 ?v= 資產與 app-version），
 *     離線才回退快取。這是修正「PWA 卡在舊版、偵測不到更新」的關鍵。
 *   - 版本化資產（src/*.js?v=、style.css?v=、圖示）＋執行期素材（assets/runtime/*）：Cache-First 動態快取
 *     （新版＝新的 ?v= 網址＝快取未命中＝自動抓新版）。
 *   - assets/source/* 與外部資源：直接走網路，不快取。
 */
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const SHELL_CACHE = 'pixel-dungeon-shell-' + VERSION;
const RUNTIME_CACHE = 'pixel-dungeon-runtime-' + VERSION;

const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

// 從 index.html 動態解析出所有 <script src> / <link href>（含 ?v=）以供離線預快取
async function discoverShell() {
  const urls = new Set(CORE);
  try {
    const res = await fetch('index.html', { cache: 'no-store' });
    const html = await res.text();
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1];
      if (/^https?:|^data:|^#|^mailto:/.test(u)) continue;
      urls.add(u);
    }
  } catch (e) {}
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const list = await discoverShell();
    await Promise.all(list.map(async (u) => {
      try { await cache.add(new Request(u, { cache: 'no-store' })); } catch (e) {}
    }));
    // 立即接管，讓「網路優先 index.html」的修正盡快對已安裝的用戶生效（打破舊版死鎖）
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== SHELL_CACHE && k !== RUNTIME_CACHE) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isDocument(url) {
  return url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html') || url.pathname.endsWith('index.html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 導覽 / index.html / manifest：Network-First（線上取最新，離線回退快取）
  if (req.mode === 'navigate' || (sameOrigin && (isDocument(url) || url.pathname.endsWith('manifest.webmanifest')))) {
    event.respondWith((async () => {
      try {
        const net = await fetch(req, { cache: 'no-store' });
        if (net && net.ok) {
          const cache = await caches.open(SHELL_CACHE);
          // 導覽與 index.html 的離線回退統一存成 index.html
          cache.put(req.mode === 'navigate' || isDocument(url) ? 'index.html' : req, net.clone());
        }
        return net;
      } catch (e) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(req)) || (await cache.match('index.html')) || (await cache.match('./')) ||
               new Response('離線中，且尚未快取。', { status: 503 });
      }
    })());
    return;
  }

  if (!sameOrigin) return;
  if (url.pathname.includes('/assets/source/')) return;

  // 版本化資產 / 執行期素材：Cache-First（殼→執行期→網路，抓到即存）
  event.respondWith((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const shellHit = await shell.match(req);
    if (shellHit) return shellHit;
    const rc = await caches.open(RUNTIME_CACHE);
    const cached = await rc.match(req);
    if (cached) return cached;
    try {
      const net = await fetch(req);
      if (net && net.ok) rc.put(req, net.clone());
      return net;
    } catch (e) {
      return cached || new Response('', { status: 504 });
    }
  })());
});
