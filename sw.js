/* 像素地城 — Service Worker
 * 快取策略：
 *   - 殼(index.html + 全部 src/*.js + style.css + manifest + icons)：安裝時動態探索 index.html 後預快取
 *   - 執行期素材(assets/runtime/*)：Cache-First 動態快取，用到才抓、抓過即離線
 *   - assets/source/* 與外部資源：直接走網路，不快取
 * 版本：由註冊時的 ?v= 帶入(pwa.js 從 <meta name="app-version"> 讀取)。
 *        版號一變 → 這支 sw.js 的 URL 就變 → 瀏覽器觸發更新 → 重新探索 + 預快取新版。
 */
const VERSION = new URL(self.location).searchParams.get('v') || 'dev';
const SHELL_CACHE = 'pixel-dungeon-shell-' + VERSION;
const RUNTIME_CACHE = 'pixel-dungeon-runtime-' + VERSION;

// 一定要有的殼(即使 index.html 沒直接列出也要快取)
const CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
];

// 從 index.html 動態解析出所有 <script src> / <link href>(含 ?v= 查詢字串)
async function discoverShell() {
  const urls = new Set(CORE);
  try {
    const res = await fetch('index.html', { cache: 'no-cache' });
    const html = await res.text();
    const re = /(?:src|href)="([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
      const u = m[1];
      if (/^https?:|^data:|^#|^mailto:/.test(u)) continue; // 跳過外部 / data / 錨點
      urls.add(u);
    }
  } catch (e) {
    // 離線安裝等極端情況：至少把 CORE 抓下來
  }
  return [...urls];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const list = await discoverShell();
    // 逐一抓，個別失敗不整批中斷(某支素材 404 不該讓安裝失敗)
    await Promise.all(list.map(async (u) => {
      try { await cache.add(new Request(u, { cache: 'no-cache' })); } catch (e) {}
    }));
    // 不呼叫 skipWaiting()：新版進入 waiting，等玩家重開才接管，避免遊戲中途換版
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== SHELL_CACHE && k !== RUNTIME_CACHE) return caches.delete(k); // 清掉舊版快取
    }));
    await self.clients.claim();
  })());
});

// 允許頁面主動要求「立即接管」(目前 UI 未使用，留給日後『按一下更新』)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 導覽請求(開 App)：離線時回退到快取的 index.html
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match('index.html')) || (await cache.match('./')) ||
             fetch(req).catch(() => new Response('離線中，且尚未快取。', { status: 503 }));
    })());
    return;
  }

  if (!sameOrigin) return; // 外部資源走網路，不介入

  // assets/source/* 不快取(素材原稿，執行不需要)
  if (url.pathname.includes('/assets/source/')) return;

  // 殼命中 → 直接回快取
  event.respondWith((async () => {
    const shell = await caches.open(SHELL_CACHE);
    const hit = await shell.match(req);
    if (hit) return hit;

    // 執行期素材 Cache-First 動態快取
    if (url.pathname.includes('/assets/runtime/')) {
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
    }

    // 其他同源請求：網路優先，失敗回快取(若有)
    try { return await fetch(req); }
    catch (e) { return (await shell.match(req)) || new Response('', { status: 504 }); }
  })());
});
