/* 像素地城 — PWA 註冊 + 新版提示(含手機主動偵測)
 *
 * 版本單一來源：index.html 的 <meta name="app-version">。
 * 以 sw.js?v=<版本> 註冊，版號一變 → SW URL 變 → 觸發更新 → 提示彈出。
 *
 * 手機重點：iOS/Android 從背景喚回時「常常不重新載入頁面」，只是把凍結畫面叫回，
 * 因此不能只在 load 檢查。這裡在「App 回前景(visibilitychange)」與「定時」時，
 * 主動重讀 index.html 的版號；發現比目前註冊的新，就重新註冊新版 SW → 提示照樣出現。
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var meta = document.querySelector('meta[name="app-version"]');
  var current = (meta && meta.content) || 'dev';
  var toastShown = false;

  function showUpdateToast() {
    if (toastShown || document.getElementById('pwaUpdateToast')) return;
    toastShown = true;
    var t = document.createElement('div');
    t.id = 'pwaUpdateToast';
    t.setAttribute('role', 'status');
    t.textContent = '🔄 有新版本 · 重開生效';
    document.body.appendChild(t);
    t.addEventListener('click', function () { t.style.display = 'none'; });
  }

  // 綁在同一個 registration 上，之後每次註冊新版(相同 scope)都會在此觸發
  function watch(reg) {
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast();
    reg.addEventListener('updatefound', function () {
      var sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', function () {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast();
      });
    });
  }

  // 主動偵測：重讀 index.html 的版號
  //  - 版號比目前新 → 註冊新版 SW(watch 已掛在同一 reg 上，會彈提示)
  //  - 版號相同 → 仍呼叫 reg.update() 讓瀏覽器再對一次(保險)
  function checkForUpdate() {
    if (document.hidden) return;
    fetch('index.html', { cache: 'no-store' })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var m = html.match(/name=["']app-version["']\s+content=["']([^"']+)["']/);
        var latest = m && m[1];
        if (latest && latest !== current) {
          current = latest;
          navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(latest)).then(watch);
        } else {
          navigator.serviceWorker.getRegistration().then(function (reg) {
            if (reg) { reg.update().catch(function () {}); if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(); }
          });
        }
      })
      .catch(function () { /* 離線或失敗：忽略，下次前景再試 */ });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(current))
      .then(watch)
      .catch(function () { /* 註冊失敗不影響遊戲本體 */ });
  });

  // App 回到前景就主動檢查(手機喚回、切分頁回來都算)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkForUpdate();
  });
  // 長時間開著也定時檢查(每 30 分鐘)
  setInterval(checkForUpdate, 30 * 60 * 1000);
})();
