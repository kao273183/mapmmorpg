// ---------- dungeon route UI (v0.26 D1) ----------
const routeChoiceBtns = [];
const chapterChoiceBtns = [];

function dungeonPanelOpen() { return !!routePanel || !!chapterPanel; }

function handleDungeonPanelKey(key) {
  if (routePanel) {
    if (key === '1' || key === '2') chooseDungeonRoute(parseInt(key, 10) - 1);
    return true;
  }
  if (chapterPanel) {
    if (key === '1') extractDungeonRun();
    else if (key === '2') continueDungeonRun();
    return true;
  }
  return false;
}

function handleDungeonPanelTap(mx, my) {
  const inside = b => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
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
  if (!dungeonRun || !currentRoomSpec) return;
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
    const b = { x:110 + i * 380, y:142, w:360, h:270, index:i };
    routeChoiceBtns.push(b);
    ctx.fillStyle = 'rgba(24,25,46,0.98)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = def.color; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = def.color; ctx.font = 'bold 34px ' + STAT_FONT; ctx.fillText(def.icon, b.x + b.w / 2, b.y + 53);
    ctx.font = 'bold 22px ' + STAT_FONT; ctx.fillText(def.name, b.x + b.w / 2, b.y + 90);
    ctx.fillStyle = '#ff9f7a'; ctx.font = 'bold 13px ' + STAT_FONT;
    ctx.fillText('危險度 ' + '◆'.repeat(def.threat) + '◇'.repeat(3 - def.threat), b.x + b.w / 2, b.y + 121);
    ctx.fillStyle = '#c8cdec'; ctx.font = '13px ' + STAT_FONT;
    ctx.fillText(def.desc, b.x + b.w / 2, b.y + 158);
    ctx.fillStyle = '#ffd36a'; ctx.font = 'bold 13px ' + STAT_FONT;
    ctx.fillText('獎勵：' + def.rewards.join(' · '), b.x + b.w / 2, b.y + 196);
    ctx.fillStyle = '#7dffd6'; ctx.fillRect(b.x + 45, b.y + 220, b.w - 90, 34);
    ctx.fillStyle = '#14162b'; ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText('[' + (i + 1) + '] 進入', b.x + b.w / 2, b.y + 243);
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
}
