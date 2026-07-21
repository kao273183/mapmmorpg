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

  function updateOrientationUi() {
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
  document.addEventListener('fullscreenchange', updateOrientationUi);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateOrientationUi);
  if (coarse.addEventListener) {
    coarse.addEventListener('change', updateOrientationUi);
    portrait.addEventListener('change', updateOrientationUi);
  }
  updateOrientationUi();
})();
