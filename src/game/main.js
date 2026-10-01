"use strict";
// ---------- main loop ----------
const FIXED_STEP_MS = 1000 / 60;
let lastLoopAt = 0, loopAccumulator = 0;
function fixedTick() {
  frame++;
  tickCombatFeel();
  if (gameState === 'town') {
    updateTown();
  } else if (gameState === 'play' && !statsOpen && !settingsOpen && !dungeonPanelOpen()) {
    captureBufferedInputs();
    if (hitStopT > 0) hitStopT--;
    else update();
    tickInputBuffers();
  } else {
    for (const k of Object.keys(pressedKeys)) delete pressedKeys[k];
  }
}
// Playables 暫停時完全停止遊戲迴圈與音效，恢復時重新排程。
let platformPaused = false, loopRunning = true, loopFrames = 0;
function loop(now) {
  if (platformPaused) { loopRunning = false; return; }
  if (!lastLoopAt) lastLoopAt = now;
  loopAccumulator += Math.min(100, Math.max(0, now - lastLoopAt));
  lastLoopAt = now;
  let steps = 0;
  while (loopAccumulator >= FIXED_STEP_MS && steps < 5) {
    fixedTick();
    loopAccumulator -= FIXED_STEP_MS;
    steps++;
  }
  if (steps === 5 && loopAccumulator >= FIXED_STEP_MS) loopAccumulator = 0;

  if (gameState === 'town') renderTown();
  else if (gameState === 'select') renderMenu();
  else {
    if (gameState !== 'select') render();
    if (gameState === 'pick') drawPick();
    if (gameState === 'dead') drawDead();
  }
  if (statsOpen) drawStatsPanel();
  if (settingsOpen) renderSettings();
  // 圖塊表就緒才算可互動（最多等約 1 秒，避免載入失敗時永遠不就緒）
  if (PLATFORM && (tsheetReady || ++loopFrames > 60)) PLATFORM.gameReady();
  requestAnimationFrame(loop);
}
revalidateLoadouts(); // 職業表就緒後才驗證出戰欄（進階職沿用基礎職技能）
revalidateRiftTier();  // 存檔就緒後才夾秘境選層（data.js 比 progression.js 早載入）
syncMasteryCosmetics();  // 補發既有精通等級應得的稱號與配色（舊存檔回溯）
recoverAbandonedDungeonBenchmark();
calcStats();
gameState = 'town'; setHint(HINT_TOWN);
if (IN_PLAYABLES) {
  PLATFORM.onPause(() => {
    platformPaused = true;
    clearGameInputs();
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
  });
  PLATFORM.onResume(() => {
    platformPaused = false;
    lastLoopAt = 0; loopAccumulator = 0;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (!loopRunning) { loopRunning = true; requestAnimationFrame(loop); }
  });
} else {
  // Playables 規範禁止使用 Page Visibility API，只在一般網頁版使用。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearGameInputs();
    else { lastLoopAt = performance.now(); loopAccumulator = 0; }
  });
}
requestAnimationFrame(loop);
