// ---------- dungeon route UI (v0.26 D2-A) ----------
const routeChoiceBtns = [];
const chapterChoiceBtns = [];
const modifierChoiceBtns = [];
let modifierRerollBtn = null;
let modifierDeclineBtn = null;
let modifierHudBtn = null;
let modifierListCloseBtn = null;

function dungeonPanelOpen() { return !!routePanel || !!chapterPanel || !!modifierPanel || modifierListOpen; }

function handleDungeonPanelKey(key) {
  if (modifierPanel) {
    if (key === '1' || key === '2' || key === '3') {
      const id = modifierPanel.offer.options[parseInt(key, 10) - 1];
      if (id) chooseDungeonModifier(id);
    } else if (key === 'r') rerollDungeonModifierPanel();
    else if (key === 'escape' || key === '0') declineDungeonModifierPanel();
    return true;
  }
  if (modifierListOpen) {
    if (key === 'm' || key === 'escape') modifierListOpen = false;
    return true;
  }
  if (routePanel) {
    if (key === '1' || key === '2') chooseDungeonRoute(parseInt(key, 10) - 1);
    return true;
  }
  if (chapterPanel) {
    if (key === '1') extractDungeonRun();
    else if (key === '2') continueDungeonRun();
    return true;
  }
  if (key === 'm' && (typeof eventPanel === 'undefined' || !eventPanel) && typeof gameState !== 'undefined' && gameState === 'play' && dungeonRun && dungeonRun.modifierState) {
    const state = dungeonRun.modifierState;
    if (state.activeBlessings.length || state.activeCurses.length) {
      modifierListOpen = true; clearGameInputs(); return true;
    }
  }
  return false;
}

function handleDungeonPanelTap(mx, my) {
  const inside = b => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  if (modifierPanel) {
    for (const b of modifierChoiceBtns) if (inside(b)) { chooseDungeonModifier(b.modifierId); return true; }
    if (inside(modifierRerollBtn)) { rerollDungeonModifierPanel(); return true; }
    if (inside(modifierDeclineBtn)) { declineDungeonModifierPanel(); return true; }
    return true;
  }
  if (modifierListOpen) {
    if (inside(modifierListCloseBtn)) modifierListOpen = false;
    return true;
  }
  if (routePanel) {
    for (const b of routeChoiceBtns) if (inside(b)) { chooseDungeonRoute(b.index); return true; }
    return true;
  }
  if (chapterPanel) {
    for (const b of chapterChoiceBtns) {
      if (!inside(b)) continue;
      if (b.action === 'extract') extractDungeonRun();
      else continueDungeonRun();
      return true;
    }
    return true;
  }
  if ((typeof eventPanel === 'undefined' || !eventPanel) && inside(modifierHudBtn)) {
    modifierListOpen = true; clearGameInputs(); return true;
  }
  return false;
}

function drawDungeonRoomWorld() {
  if (!currentRoomSpec || currentRoomSpec.type !== 'camp') return;
  const x = worldW / 2, y = 468;
  ctx.fillStyle = '#5a3422'; ctx.fillRect(x - 24, y - 9, 48, 7);
  ctx.fillStyle = '#ff7a2e'; ctx.fillRect(x - 11, y - 31, 22, 22);
  ctx.fillStyle = '#ffe680'; ctx.fillRect(x - 5, y - 39, 10, 25);
  ctx.fillStyle = '#8aa8ff'; ctx.font = 'bold 13px ' + STAT_FONT; ctx.textAlign = 'center';
  ctx.fillText('休整營地 · 已恢復', x, y - 52);
  ctx.textAlign = 'left';
}

function drawDungeonHud() {
  modifierHudBtn = null;
  if (!dungeonRun || !currentRoomSpec) return;
  const modifierState = dungeonRun.modifierState;
  if (modifierState && (modifierState.activeBlessings.length || modifierState.activeCurses.length)) {
    modifierHudBtn = { x:620, y:4, w:108, h:24 };
    ctx.fillStyle = 'rgba(20,22,43,0.76)'; ctx.fillRect(modifierHudBtn.x, modifierHudBtn.y, modifierHudBtn.w, modifierHudBtn.h);
    ctx.strokeStyle = '#6d7190'; ctx.lineWidth = 1; ctx.strokeRect(modifierHudBtn.x, modifierHudBtn.y, modifierHudBtn.w, modifierHudBtn.h);
    ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillStyle = '#7dffd6'; ctx.fillText('祝 ' + modifierState.activeBlessings.length, modifierHudBtn.x + 27, modifierHudBtn.y + 16);
    ctx.fillStyle = '#ff8a8a'; ctx.fillText('詛 ' + modifierState.activeCurses.length, modifierHudBtn.x + 65, modifierHudBtn.y + 16);
    ctx.fillStyle = '#c8cdec'; ctx.fillText('[M]', modifierHudBtn.x + 94, modifierHudBtn.y + 16);
  }
  const x = W - 226, y = 4, roomIndex = dungeonRoomIndex(floor);
  ctx.fillStyle = 'rgba(20,22,43,0.76)'; ctx.fillRect(x, y, 216, 24);
  ctx.font = 'bold 10px ' + STAT_FONT; ctx.textAlign = 'left';
  ctx.fillStyle = DUNGEON_ROOM_DEFS[currentRoomSpec.type].color;
  ctx.fillText(DUNGEON_ROOM_DEFS[currentRoomSpec.type].short, x + 8, y + 16);
  for (let i = 1; i <= 5; i++) {
    ctx.fillStyle = i < roomIndex ? '#7dffd6' : i === roomIndex ? '#ffe680' : i === 5 ? '#ff6b6b' : '#4a4d66';
    ctx.fillRect(x + 62 + (i - 1) * 18, y + 8, 10, 8);
  }
  ctx.fillStyle = '#ffd36a'; ctx.textAlign = 'right';
  ctx.fillText('探索 ' + dungeonRun.explorationScore, x + 207, y + 16);
  ctx.textAlign = 'left';
}

function drawModifierPanel() {
  modifierChoiceBtns.length = 0;
  modifierRerollBtn = null;
  modifierDeclineBtn = null;
  if (!modifierPanel || !dungeonRun || !dungeonRun.modifierState) return;
  const offer = modifierPanel.offer;
  const state = dungeonRun.modifierState;
  const isCurse = offer.kind === 'curse';
  const accent = isCurse ? '#ff8a8a' : '#7dffd6';
  const registry = dungeonModifierRegistry(offer.kind);
  ctx.fillStyle = 'rgba(5,6,16,0.88)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent; ctx.font = 'bold 27px ' + STAT_FONT;
  ctx.fillText(isCurse ? '選 擇 自 願 詛 咒' : '選 擇 當 局 祝 福', W / 2, 52);
  ctx.fillStyle = '#aeb4d0'; ctx.font = '12px ' + STAT_FONT;
  ctx.fillText(isCurse ? '所有代價與對應收益均已公開；可安全拒絕' : '效果只持續至本次冒險結束；每種只能取得一次', W / 2, 77);

  for (let i = 0; i < offer.options.length; i++) {
    const def = registry[offer.options[i]];
    if (!def) continue;
    const b = { x:52 + i * 286, y:100, w:270, h:260, modifierId:def.id };
    modifierChoiceBtns.push(b);
    ctx.fillStyle = isCurse ? 'rgba(95,35,50,0.94)' : 'rgba(28,70,66,0.94)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = i === 0 ? accent : '#59607b'; ctx.lineWidth = i === 0 ? 2 : 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = accent; ctx.font = 'bold 17px ' + STAT_FONT; ctx.fillText('[' + (i + 1) + '] ' + def.name, b.x + b.w / 2, b.y + 31);
    ctx.fillStyle = '#c8cdec'; ctx.font = '11px ' + STAT_FONT; wrapText(def.summary, b.x + b.w / 2, b.y + 56, b.w - 28, 15);
    if (isCurse) {
      ctx.fillStyle = '#ff9f9f'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText('代價', b.x + b.w / 2, b.y + 103);
      ctx.fillStyle = '#f2d3d3'; ctx.font = '10px ' + STAT_FONT; wrapText(def.risk.label, b.x + b.w / 2, b.y + 123, b.w - 26, 14);
      ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText('對應收益', b.x + b.w / 2, b.y + 164);
      ctx.fillStyle = '#d7fff3'; ctx.font = '10px ' + STAT_FONT; wrapText(def.reward.label, b.x + b.w / 2, b.y + 184, b.w - 26, 14);
    } else {
      ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText('效果', b.x + b.w / 2, b.y + 120);
      ctx.fillStyle = '#e2fff7'; ctx.font = '11px ' + STAT_FONT; wrapText(def.effect.label, b.x + b.w / 2, b.y + 144, b.w - 28, 16);
    }
    ctx.fillStyle = accent; ctx.fillRect(b.x + 28, b.y + b.h - 45, b.w - 56, 29);
    ctx.fillStyle = '#14162b'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText('選擇 ' + def.name, b.x + b.w / 2, b.y + b.h - 25);
  }

  modifierRerollBtn = { x:214, y:382, w:250, h:48 };
  modifierDeclineBtn = { x:496, y:382, w:250, h:48 };
  const canReroll = state.rerollsRemaining > 0;
  ctx.fillStyle = canReroll ? 'rgba(138,168,255,0.22)' : 'rgba(80,82,100,0.22)'; ctx.fillRect(modifierRerollBtn.x, modifierRerollBtn.y, modifierRerollBtn.w, modifierRerollBtn.h);
  ctx.strokeStyle = canReroll ? '#8aa8ff' : '#55586b'; ctx.strokeRect(modifierRerollBtn.x, modifierRerollBtn.y, modifierRerollBtn.w, modifierRerollBtn.h);
  ctx.fillStyle = canReroll ? '#b8c9ff' : '#73778e'; ctx.font = 'bold 13px ' + STAT_FONT;
  ctx.fillText('[R] 重抽　剩餘 ' + state.rerollsRemaining, modifierRerollBtn.x + modifierRerollBtn.w / 2, modifierRerollBtn.y + 29);
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(modifierDeclineBtn.x, modifierDeclineBtn.y, modifierDeclineBtn.w, modifierDeclineBtn.h);
  ctx.strokeStyle = '#9299b9'; ctx.strokeRect(modifierDeclineBtn.x, modifierDeclineBtn.y, modifierDeclineBtn.w, modifierDeclineBtn.h);
  ctx.fillStyle = '#c8cdec'; ctx.fillText('[0 / Esc] 安全拒絕', modifierDeclineBtn.x + modifierDeclineBtn.w / 2, modifierDeclineBtn.y + 29);

  const activeNames = state.activeBlessings.concat(state.activeCurses).map(id => DUNGEON_BLESSING_DEFS[id] || DUNGEON_CURSE_DEFS[id]).filter(Boolean).map(def => def.name);
  ctx.fillStyle = '#737a9a'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText(activeNames.length ? '目前持有：' + activeNames.slice(-6).join(' · ') + (activeNames.length > 6 ? ' …' : '') : '目前尚無當局祝福或詛咒', W / 2, 466);
  ctx.fillText('點選卡片即可確認；拒絕不扣除任何資源', W / 2, 493);
  ctx.textAlign = 'left';
}

function drawModifierListPanel() {
  modifierListCloseBtn = null;
  if (!modifierListOpen || !dungeonRun || !dungeonRun.modifierState) return;
  const state = dungeonRun.modifierState;
  ctx.fillStyle = 'rgba(5,6,16,0.88)'; ctx.fillRect(0, 0, W, H);
  const x = 95, y = 40, w = 770, h = 455;
  ctx.fillStyle = 'rgba(24,25,46,0.99)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8aa8ff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 24px ' + STAT_FONT;
  ctx.fillText('本 局 持 有 效 果', W / 2, y + 38);
  ctx.fillStyle = '#9299b9'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('祝福 ' + state.activeBlessings.length + '　·　詛咒 ' + state.activeCurses.length + '　·　異變重抽剩餘 ' + state.rerollsRemaining, W / 2, y + 62);

  const drawColumn = (ids, defs, cx, color, title) => {
    ctx.fillStyle = color; ctx.font = 'bold 15px ' + STAT_FONT; ctx.fillText(title, cx, y + 92);
    if (!ids.length) { ctx.fillStyle = '#676c86'; ctx.font = '11px ' + STAT_FONT; ctx.fillText('尚未取得', cx, y + 124); return; }
    for (let i = 0; i < ids.length; i++) {
      const def = defs[ids[i]]; if (!def) continue;
      const ry = y + 112 + i * 25;
      ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(cx - 170, ry - 15, 340, 21);
      ctx.textAlign = 'left'; ctx.fillStyle = color; ctx.font = 'bold 9px ' + STAT_FONT; ctx.fillText(def.name, cx - 160, ry);
      ctx.textAlign = 'right'; ctx.fillStyle = '#b6bbd2'; ctx.font = '8px ' + STAT_FONT;
      ctx.fillText(def.kind === 'curse' ? def.risk.label + ' ／ ' + def.reward.label : def.effect.label, cx + 160, ry);
      ctx.textAlign = 'center';
    }
  };
  drawColumn(state.activeBlessings, DUNGEON_BLESSING_DEFS, x + 195, '#7dffd6', '祝福');
  drawColumn(state.activeCurses, DUNGEON_CURSE_DEFS, x + 575, '#ff8a8a', '詛咒');
  modifierListCloseBtn = { x:W / 2 - 120, y:y + h - 52, w:240, h:34 };
  ctx.fillStyle = 'rgba(138,168,255,0.18)'; ctx.fillRect(modifierListCloseBtn.x, modifierListCloseBtn.y, modifierListCloseBtn.w, modifierListCloseBtn.h);
  ctx.strokeStyle = '#8aa8ff'; ctx.strokeRect(modifierListCloseBtn.x, modifierListCloseBtn.y, modifierListCloseBtn.w, modifierListCloseBtn.h);
  ctx.fillStyle = '#c8d4ff'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText('[M / Esc] 返回遊戲', W / 2, modifierListCloseBtn.y + 22);
  ctx.textAlign = 'left';
}

function drawDungeonTrialHud() {
  if (typeof floorTrial === 'undefined' || !floorTrial || floorTrial.status !== 'active') return;
  const def = DUNGEON_EVENT_DEFS[floorTrial.eventId];
  if (!def) return;
  const x = W / 2 - 190, y = 34, w = 380, h = 34;
  let detail = '擊敗守衛 ' + floorTrial.defeatedCount + ' / ' + floorTrial.targetCount;
  if (floorTrial.type === 'timed') detail = '剩餘 ' + dungeonTrialSeconds(floorTrial) + ' 秒　·　第 ' + floorTrial.wave + ' / ' + floorTrial.waves.length + ' 波　·　' + floorTrial.defeatedCount + ' / ' + floorTrial.targetCount;
  else if (floorTrial.type === 'flawless') detail = '保持無傷　·　守衛 ' + floorTrial.defeatedCount + ' / ' + floorTrial.targetCount;
  else if (floorTrial.type === 'hazard') detail = '守衛 ' + floorTrial.defeatedCount + ' / ' + floorTrial.targetCount + '　·　通過地形 ' + (floorTrial.crossed ? '✓' : '…');
  ctx.fillStyle = 'rgba(18,19,38,0.9)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillStyle = def.color;
  ctx.fillText(def.name, x + 10, y + 21);
  ctx.textAlign = 'right'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillStyle = '#f2f3ff';
  ctx.fillText(detail, x + w - 10, y + 21);
  ctx.textAlign = 'left';
}

function drawRoutePanel() {
  if (!routePanel) return;
  routeChoiceBtns.length = 0;
  ctx.fillStyle = 'rgba(5,6,16,0.82)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 28px ' + STAT_FONT;
  ctx.fillText('選 擇 下 一 條 路 線', W / 2, 82);
  ctx.fillStyle = '#9299b9'; ctx.font = '13px ' + STAT_FONT;
  ctx.fillText('危險與最低獎勵已公開；選擇後立即進入下一房', W / 2, 108);

  for (let i = 0; i < routePanel.choices.length; i++) {
    const spec = routePanel.choices[i], def = DUNGEON_ROOM_DEFS[spec.type];
    const eventDef = spec.eventId ? DUNGEON_EVENT_DEFS[spec.eventId] : null;
    const hazardDef = spec.hazardId ? DUNGEON_HAZARD_DEFS[spec.hazardId] : null;
    const b = { x:110 + i * 380, y:142, w:360, h:270, index:i };
    routeChoiceBtns.push(b);
    ctx.fillStyle = 'rgba(24,25,46,0.98)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = def.color; ctx.font = 'bold 30px ' + STAT_FONT; ctx.fillText(def.icon, b.x + b.w / 2, b.y + 43);
    ctx.font = 'bold 20px ' + STAT_FONT; ctx.fillText(def.name, b.x + b.w / 2, b.y + 75);
    ctx.fillStyle = '#ff9f7a'; ctx.font = 'bold 13px ' + STAT_FONT;
    ctx.fillText('危險度 ' + '◆'.repeat(spec.threat) + '◇'.repeat(3 - spec.threat), b.x + b.w / 2, b.y + 103);
    ctx.fillStyle = '#c8cdec'; ctx.font = '13px ' + STAT_FONT;
    ctx.fillText(def.desc, b.x + b.w / 2, b.y + 131);
    ctx.fillStyle = '#aeb4d0'; ctx.font = '12px ' + STAT_FONT;
    ctx.fillText('敵人：' + spec.enemyTags.join(' · '), b.x + b.w / 2, b.y + 158);
    if (eventDef) {
      ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 12px ' + STAT_FONT;
      ctx.fillText('事件：' + eventDef.previewTag, b.x + b.w / 2, b.y + (hazardDef ? 176 : 181));
    }
    if (hazardDef) {
      ctx.fillStyle = '#ffb45e'; ctx.font = 'bold 12px ' + STAT_FONT;
      ctx.fillText('地形：' + hazardDef.previewTag, b.x + b.w / 2, b.y + (eventDef ? 193 : 181));
    }
    ctx.fillStyle = '#ffd36a'; ctx.font = 'bold 13px ' + STAT_FONT;
    ctx.fillText('獎勵：' + spec.rewardTags.join(' · '), b.x + b.w / 2, b.y + (eventDef && hazardDef ? 214 : 207));
    ctx.fillStyle = '#7dffd6'; ctx.fillRect(b.x + 45, b.y + 224, b.w - 90, 32);
    ctx.fillStyle = '#14162b'; ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText('[' + (i + 1) + '] 進入', b.x + b.w / 2, b.y + 246);
  }
  ctx.fillStyle = '#737a9a'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('本章探索評價：' + dungeonRun.explorationScore + '　·　Boss 前會保留低風險路線', W / 2, 450);
  ctx.textAlign = 'left';
}

function drawChapterPanel() {
  if (!chapterPanel) return;
  chapterChoiceBtns.length = 0;
  const reward = chapterPanel.reward;
  ctx.fillStyle = 'rgba(5,6,16,0.86)'; ctx.fillRect(0, 0, W, H);
  const x = 170, y = 88, w = 620, h = 370;
  ctx.fillStyle = 'rgba(24,25,46,0.99)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd36a'; ctx.font = 'bold 30px ' + STAT_FONT;
  ctx.fillText('第 ' + dungeonChapter(floor) + ' 章 完 成', W / 2, y + 54);
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px ' + STAT_FONT;
  ctx.fillText('探索評價 ' + reward.score + '　·　章節寶箱已加入背包', W / 2, y + 94);
  ctx.fillStyle = RARITY_COL[reward.rarity]; ctx.font = 'bold 18px ' + STAT_FONT;
  ctx.fillText(reward.itemName + '　＋　強化石 ×' + reward.mats, W / 2, y + 130);
  ctx.fillStyle = '#9299b9'; ctx.font = '12px ' + STAT_FONT;
  ctx.fillText('現在返回會保存本局成果；繼續深入將進入下一群系', W / 2, y + 166);

  const actions = [
    { action:'extract', label:'[1] 返回基地', sub:'成功撤退並結算本局', color:'#7dffd6' },
    { action:'continue', label:'[2] 繼續深入', sub:'探索評價歸零，挑戰下一章', color:'#d9a8ff' }
  ];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i], b = { x:x + 45 + i * 295, y:y + 205, w:260, h:104, action:a.action };
    chapterChoiceBtns.push(b);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = a.color; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = a.color; ctx.font = 'bold 17px ' + STAT_FONT; ctx.fillText(a.label, b.x + b.w / 2, b.y + 39);
    ctx.fillStyle = '#aeb4d0'; ctx.font = '11px ' + STAT_FONT; ctx.fillText(a.sub, b.x + b.w / 2, b.y + 69);
  }
  ctx.fillStyle = '#737a9a'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('死亡不會沒收已拾取的裝備與靈魂', W / 2, y + h - 24);
  ctx.textAlign = 'left';
}

function drawDungeonPanels() {
  drawRoutePanel();
  drawChapterPanel();
  drawModifierPanel();
  drawModifierListPanel();
}
