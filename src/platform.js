"use strict";

/* 像素地城 — 平台橋接：一般瀏覽器 / YouTube Playables（ytgame SDK）
 *
 * 一般網頁版：只提供 GamePlatform 介面（皆為無作用的預設值），遊戲照常使用 localStorage。
 * Playables 版（tools/build-playables.js 打包）：
 *   - 存檔：規範要求只能用 YouTube 雲端存檔。這裡把 window.localStorage 換成記憶體快取，
 *     寫入時延遲合併呼叫 saveData；遊戲各檔維持原本的 localStorage 呼叫即可。
 *   - 開機：先畫載入畫面並呼叫 firstFrameReady，await loadData 填好快取後，
 *     才依 data-boot 順序載入遊戲腳本（遊戲在載入當下就會同步讀存檔）。
 *   - 音效 / 暫停：轉發 YouTube 的靜音設定與 onPause / onResume。
 */
(() => {
  const yt = typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV ? ytgame : null;
  const CLOUD_VERSION = 1;
  const SAVE_DELAY_MS = 1500;
  const cache = new Map();
  let cloudLoaded = false, saveTimer = null, saving = false, dirty = false;
  let firstFrameSent = false, gameReadySent = false;

  function logError(err) {
    if (yt) { try { yt.health.logError(); } catch (e) {} }
    if (typeof console !== 'undefined') console.error(err);
  }

  // 雲端存檔：整份 key/value 序列化成一個 JSON 字串（上限 3 MiB）
  function serializeCache() {
    const data = {};
    for (const [k, v] of cache) data[k] = v;
    return JSON.stringify({ v: CLOUD_VERSION, data });
  }
  async function flushCloud() {
    if (!yt || !cloudLoaded) return; // 讀檔失敗時不寫，避免覆蓋玩家的雲端進度
    clearTimeout(saveTimer); saveTimer = null;
    if (saving) { dirty = true; return; }
    saving = true; dirty = false;
    try { await yt.game.saveData(serializeCache()); } catch (err) { logError(err); }
    saving = false;
    if (dirty) flushCloud();
  }
  function scheduleCloudSave() {
    if (!saveTimer) saveTimer = setTimeout(flushCloud, SAVE_DELAY_MS);
  }

  const pauseHandlers = [], resumeHandlers = [], audioHandlers = [];
  let audioEnabled = true;
  if (yt) {
    const cloudStorage = {
      getItem: key => cache.has(String(key)) ? cache.get(String(key)) : null,
      setItem: (key, value) => { cache.set(String(key), String(value)); scheduleCloudSave(); },
      removeItem: key => { cache.delete(String(key)); scheduleCloudSave(); },
      clear: () => { cache.clear(); scheduleCloudSave(); },
      key: i => [...cache.keys()][i] ?? null,
      get length() { return cache.size; }
    };
    try {
      Object.defineProperty(window, 'localStorage', { value: cloudStorage, configurable: true, enumerable: true });
    } catch (err) {
      logError(err);
    }
    try { audioEnabled = yt.system.isAudioEnabled(); } catch (err) {}
    yt.system.onAudioEnabledChange(enabled => {
      audioEnabled = !!enabled;
      for (const fn of audioHandlers) fn(audioEnabled);
    });
    yt.system.onPause(() => {
      for (const fn of pauseHandlers) fn();
      flushCloud();
    });
    yt.system.onResume(() => { for (const fn of resumeHandlers) fn(); });
    document.documentElement.classList.add('playables');
  }

  function drawLoadingScreen() {
    const cv = document.getElementById('cv');
    const c = cv && cv.getContext('2d');
    if (!c) return;
    c.fillStyle = '#14162b'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#7dffd6'; c.textAlign = 'center';
    c.font = 'bold ' + Math.round(cv.height / 18) + 'px "Courier New",monospace';
    c.fillText('載入中…', cv.width / 2, cv.height / 2);
  }

  function loadScriptsInOrder(srcs) {
    for (const src of srcs) {
      const s = document.createElement('script');
      s.src = src; s.async = false; // 動態插入的腳本預設 async，關掉才會依序執行
      s.onerror = () => logError(new Error('script failed: ' + src));
      document.body.appendChild(s);
    }
  }

  async function boot(srcs) {
    if (yt) {
      drawLoadingScreen();
      firstFrameSent = true;
      yt.game.firstFrameReady();
      try {
        const raw = await yt.game.loadData();
        if (raw) {
          const parsed = JSON.parse(raw);
          const data = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
          for (const [k, v] of Object.entries(data)) if (typeof v === 'string') cache.set(k, v);
        }
        cloudLoaded = true;
      } catch (err) {
        logError(err); // 以空白存檔繼續遊玩，但不寫回雲端
      }
    }
    loadScriptsInOrder(srcs);
  }

  window.GamePlatform = {
    inPlayables: !!yt,
    isAudioEnabled: () => audioEnabled,
    onAudioEnabledChange: fn => audioHandlers.push(fn),
    onPause: fn => pauseHandlers.push(fn),
    onResume: fn => resumeHandlers.push(fn),
    gameReady() {
      if (!yt || gameReadySent) return;
      if (!firstFrameSent) { firstFrameSent = true; yt.game.firstFrameReady(); }
      gameReadySent = true;
      yt.game.gameReady();
    },
    flushSave: flushCloud,
    logError
  };

  const self = document.currentScript;
  const bootList = self && self.dataset.boot;
  if (bootList) boot(bootList.split(',').map(s => s.trim()).filter(Boolean));
})();
