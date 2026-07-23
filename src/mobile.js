"use strict";

// Mobile landscape bootstrap. Orientation lock is best-effort because iOS
// Safari does not expose the lock API; the CSS prompt remains as a fallback.
(() => {
  const prompt = document.getElementById('rotatePrompt');
  const button = document.getElementById('landscapeButton');
  const status = document.getElementById('landscapeStatus');
  if (!prompt || !button || !status) return;

  const coarse = window.matchMedia('(pointer:coarse)');
  const portrait = window.matchMedia('(orientation:portrait)');

  function updateViewportMetrics() {
    const viewport = window.visualViewport;
    const width = Math.max(1, Math.round(viewport ? viewport.width : window.innerWidth));
    const height = Math.max(1, Math.round(viewport ? viewport.height : window.innerHeight));
    document.documentElement.style.setProperty('--app-width', width + 'px');
    document.documentElement.style.setProperty('--app-height', height + 'px');
    const bodyStyle = typeof getComputedStyle === 'function' ? getComputedStyle(document.body) : null;
    const horizontalPadding = bodyStyle ? (parseFloat(bodyStyle.paddingLeft) || 0) + (parseFloat(bodyStyle.paddingRight) || 0) : 0;
    const verticalPadding = bodyStyle ? (parseFloat(bodyStyle.paddingTop) || 0) + (parseFloat(bodyStyle.paddingBottom) || 0) : 0;
    const availableWidth = Math.max(1, width - horizontalPadding);
    const availableHeight = Math.max(1, height - verticalPadding);
    const canvasWidth = Math.max(1, Math.floor(Math.min(960, availableWidth, availableHeight * 16 / 9)));
    document.documentElement.style.setProperty('--canvas-width', canvasWidth + 'px');
    document.documentElement.classList.toggle('mobile-short-landscape', coarse.matches && !portrait.matches && height < 540);
  }

  function updateOrientationUi() {
    updateViewportMetrics();
    const blocked = coarse.matches && portrait.matches && window.innerWidth <= 1024;
    prompt.setAttribute('aria-hidden', blocked ? 'false' : 'true');
    document.documentElement.classList.toggle('mobile-portrait', blocked);
    if (!blocked) status.textContent = '';
  }

  async function enterLandscape() {
    button.disabled = true;
    status.textContent = '正在切換橫向模式…';
    let locked = false;
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI:'hide' });
      } catch (err) {
        try { await document.documentElement.requestFullscreen(); } catch (fallbackErr) {}
      }
    }
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
        locked = true;
      }
    } catch (err) {
      // Browsers may reject orientation lock even after fullscreen.
    }
    updateOrientationUi();
    if (portrait.matches) {
      status.textContent = locked ? '請稍候…' : '瀏覽器無法自動旋轉，請手動將手機橫放';
    }
    button.disabled = false;
  }

  button.addEventListener('click', enterLandscape);
  window.addEventListener('resize', updateOrientationUi);
  window.addEventListener('orientationchange', updateOrientationUi);
  window.addEventListener('pageshow', updateOrientationUi);
  document.addEventListener('fullscreenchange', updateOrientationUi);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateOrientationUi);
    window.visualViewport.addEventListener('scroll', updateOrientationUi);
  }
  if (coarse.addEventListener) {
    coarse.addEventListener('change', updateOrientationUi);
    portrait.addEventListener('change', updateOrientationUi);
  }
  updateOrientationUi();
})();

// ---------- 通用全螢幕切換（桌機 Web / Android；iOS Safari 分頁不支援）----------
function gameFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function gameFullscreenSupported() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}
// 回傳 'entered' | 'exited' | 'unsupported'（iOS Safari 分頁 → 引導改用「加入主畫面」）
function toggleGameFullscreen() {
  const el = document.documentElement;
  if (gameFullscreenActive()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) { try { exit.call(document); } catch (e) {} }
    return 'exited';
  }
  if (!gameFullscreenSupported()) return 'unsupported';
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(function () { try { req.call(el); } catch (e) {} });
  } catch (e) {
    try { req.call(el); } catch (err) {}
  }
  // 手機盡量鎖橫向（桌機無此 API，忽略失敗）
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); } catch (e) {}
  return 'entered';
}
