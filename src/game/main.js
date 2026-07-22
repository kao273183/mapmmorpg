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
function loop(now) {
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
  requestAnimationFrame(loop);
}
recoverAbandonedDungeonBenchmark();
calcStats();
gameState = 'town'; setHint(HINT_TOWN);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { lastLoopAt = performance.now(); loopAccumulator = 0; }
});
requestAnimationFrame(loop);
