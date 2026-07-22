/* 像素地城 — PWA 安裝提示
 * Android/桌機：攔截 beforeinstallprompt → 顯示自訂「安裝」按鈕，點了才跳系統安裝框(時機可控)。
 * iOS：無 beforeinstallprompt(Apple 不支援)→ 顯示「分享 → 加入主畫面」引導(可關閉、記住已關)。
 * 已安裝(standalone)或已安裝事件 → 全部隱藏。
 */
(function () {
  var standalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    window.navigator.standalone === true;
  if (standalone) return; // 已安裝，不再提示

  var deferred = null;

  function byId(id) { return document.getElementById(id); }

  function showInstallButton() {
    if (byId('pwaInstallBtn')) return;
    var b = document.createElement('button');
    b.id = 'pwaInstallBtn';
    b.type = 'button';
    b.textContent = '📥 安裝到桌面';
    document.body.appendChild(b);
    b.addEventListener('click', function () {
      if (!deferred) return;
      b.disabled = true;
      deferred.prompt();
      var choice = deferred.userChoice;
      deferred = null;
      if (choice && choice.then) {
        choice.then(function () { b.remove(); }, function () { b.remove(); });
      } else {
        b.remove();
      }
    });
  }

  // Android/桌機：瀏覽器判定可安裝時觸發
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();      // 攔掉瀏覽器預設橫幅，改用自訂按鈕
    deferred = e;
    showInstallButton();
  });

  // 安裝完成：收掉所有提示
  window.addEventListener('appinstalled', function () {
    var b = byId('pwaInstallBtn'); if (b) b.remove();
    var h = byId('pwaIosHint'); if (h) h.remove();
    deferred = null;
  });

  // iOS 引導(含 iPadOS：新版 iPad 會回報成 Mac，用 touch 點數判斷)
  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var dismissed = false;
  try { dismissed = localStorage.getItem('pwaIosHintDismissed') === '1'; } catch (e) {}

  if (isIOS && !dismissed) {
    window.addEventListener('load', function () {
      if (byId('pwaIosHint')) return;
      var bar = document.createElement('div');
      bar.id = 'pwaIosHint';
      bar.innerHTML =
        '<span>📲 點 <b>分享</b> → <b>加入主畫面</b> 安裝遊戲</span>' +
        '<button id="pwaIosClose" type="button" aria-label="關閉">✕</button>';
      document.body.appendChild(bar);
      byId('pwaIosClose').addEventListener('click', function () {
        bar.remove();
        try { localStorage.setItem('pwaIosHintDismissed', '1'); } catch (e) {}
      });
    });
  }
})();
