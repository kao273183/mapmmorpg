"use strict";
// ---------- 城鎮(俯視角 top-down) ----------
const TOWN_W = 1400, TOWN_H = 920;
const PLAYER_CHAR = 105; // Kenney 角色(col24=正面朝下,index=row*27+24)
const NPCS = [
  { x: 380,  y: 300, name: '傳送門',     sub: '選職業・出發冒險', panel: 'base',   col: '#b05ae0', build: 'portal', char: 186 },
  { x: 780,  y: 240, name: '技能訓練師', sub: '抽取技能・天賦樹', panel: 'skills', col: '#7dffd6', build: 'shop',   char: 24 },
  { x: 1060, y: 430, name: '倉庫管理員', sub: '裝備倉庫',         panel: 'stash',  col: '#d8b365', build: 'shop',   char: 267 },
  { x: 470,  y: 620, name: '冒險公告欄', sub: '每日任務・每週挑戰', panel: 'activity', col: '#8aa8ff', build: 'board', char: 348 }
];
const townP = { x: 700, y: 760, face: 1, walk: 0 };
// 裝飾物(參與深度排序)
const TOWN_DECOR = [
  { x: 700, y: 490, type: 'fountain' },
  { x: 170, y: 250, type: 'tree' }, { x: 1250, y: 300, type: 'tree' }, { x: 250, y: 800, type: 'tree' },
  { x: 1200, y: 780, type: 'tree' }, { x: 940, y: 700, type: 'tree' }, { x: 560, y: 330, type: 'tree' },
  { x: 470, y: 410, type: 'lamp' }, { x: 930, y: 410, type: 'lamp' }, { x: 470, y: 660, type: 'lamp' }, { x: 930, y: 660, type: 'lamp' },
  { x: 340, y: 520, type: 'bush' }, { x: 1080, y: 560, type: 'bush' }, { x: 1010, y: 720, type: 'bush' },
  { x: 620, y: 730, type: 'flower' }, { x: 820, y: 320, type: 'flower' }, { x: 400, y: 380, type: 'flower' }, { x: 880, y: 620, type: 'flower' },
  { x: 1140, y: 480, type: 'barrel' }, { x: 830, y: 250, type: 'barrel' }, { x: 700, y: 300, type: 'crate' }
];
let townCamX = 0, townCamY = 0, nearNpc = null, fromTown = false;
let townTargetX = null, townTargetY = null, townTargetNpc = null; // 點擊走動目標
let chatMsgs = [{ name: '系統', text: '歡迎來到城鎮!走到 NPC 按 ↑ 互動,按 Enter 聊天。' }];
let chatInput = '', chatting = false;
function sendChat(text) {
  chatMsgs.push({ name: meta.playerName || '勇者', text: text.slice(0, 60) });
  if (chatMsgs.length > 40) chatMsgs.shift();
  // 多人預留:此處未來改為 townNet.send(text),其他玩家訊息由 townNet.onMessage 推入 chatMsgs
  beep(700, 0.05, 'sine', 0.03);
}
function openTownPanel(panel) {
  if (panel === 'save') { settingsOpen = true; settingsMode = null; settingsPage = 'main'; settingsUpdateIndex = 0; clearGameInputs(); beep(600, 0.08, 'sine', 0.04); return; }
  gameState = 'select'; menuTab = panel; fromTown = true;
  beep(600, 0.08, 'sine', 0.04);
}
function updateTown() {
  const tp = townP;
  if (chatting) { tp.walk = 0; return; }
  let mx = 0, my = 0;
  if (keys['arrowleft'] || keys['a']) mx = -1;
  if (keys['arrowright'] || keys['d']) mx = 1;
  if (keys['arrowup'] || keys['w']) my = -1;
  if (keys['arrowdown'] || keys['s']) my = 1;
  if (mx !== 0 || my !== 0) { townTargetX = null; townTargetNpc = null; } // 鍵盤取消點擊走動
  else if (townTargetX !== null) { // 點擊:走向目標
    const dx = townTargetX - tp.x, dy = townTargetY - tp.y, dist = Math.hypot(dx, dy);
    if (dist < 6) {
      townTargetX = null;
      if (townTargetNpc && Math.hypot(townTargetNpc.x - tp.x, townTargetNpc.y - tp.y) < 78) { const n = townTargetNpc; townTargetNpc = null; openTownPanel(n.panel); }
    } else { mx = dx / dist; my = dy / dist; }
  }
  if (mx !== 0 || my !== 0) {
    const l = Math.hypot(mx, my) || 1, sp = 3.4;
    tp.x += mx / l * sp; tp.y += my / l * sp; tp.walk++;
    if (Math.abs(mx) > 0.3) tp.face = mx > 0 ? 1 : -1;
  } else tp.walk = 0;
  tp.x = Math.max(30, Math.min(TOWN_W - 30, tp.x));
  tp.y = Math.max(150, Math.min(TOWN_H - 40, tp.y));
  townCamX += ((Math.max(0, Math.min(TOWN_W - W, tp.x - W / 2))) - townCamX) * 0.12;
  townCamY += ((Math.max(0, Math.min(TOWN_H - H, tp.y - H / 2))) - townCamY) * 0.12;
  nearNpc = null;
  for (const n of NPCS) if (Math.hypot(n.x - tp.x, n.y - tp.y) < 78) { nearNpc = n; break; }
  if (nearNpc && (keys['e'] || keys['space'])) { keys['e'] = false; keys['space'] = false; openTownPanel(nearNpc.panel); }
}
function drawBuildingTop(n) { // 俯視建築(程式繪製:屋頂+牆+門窗,比 Kenney 屋頂平鋪更像房子)
  const bx = n.x, by = n.y - 26;
  if (n.build === 'portal') {
    ctx.fillStyle = 'rgba(176,90,224,0.22)'; ctx.beginPath(); ctx.ellipse(bx, by + 20, 48, 22, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = (Math.floor(frame / 8) + i) % 2 === 0 ? '#b05ae0' : '#7dffd6'; ctx.fillRect(bx - 28 + i * 7, by - 56 + i * 10, 56 - i * 14, 76 - i * 16); }
  } else if (n.build === 'board') {
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(bx - 4, by - 4, 8, 28);
    ctx.fillStyle = '#c8b088'; ctx.fillRect(bx - 34, by - 42, 68, 40);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.strokeRect(bx - 34, by - 42, 68, 40);
  } else {
    ctx.fillStyle = '#4a3a52'; ctx.fillRect(bx - 56, by - 60, 112, 70);
    ctx.fillStyle = n.col; ctx.beginPath(); ctx.moveTo(bx - 64, by - 60); ctx.lineTo(bx + 64, by - 60); ctx.lineTo(bx + 44, by - 92); ctx.lineTo(bx - 44, by - 92); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2a2030'; ctx.fillRect(bx - 14, by - 22, 28, 32);
    ctx.fillStyle = 'rgba(255,220,120,0.4)'; ctx.fillRect(bx - 44, by - 48, 20, 18); ctx.fillRect(bx + 24, by - 48, 20, 18);
  }
}
function drawFigureTop(x, y, col, face) { // 俯視小人,腳底在 (x,y)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(x - 8, y - 22, 16, 20);
  ctx.fillStyle = '#f0c090'; ctx.fillRect(x - 6, y - 33, 12, 12);
  ctx.fillStyle = '#2a2030'; ctx.fillRect(x - 6, y - 33, 12, 4);
  ctx.fillStyle = '#000'; ctx.fillRect(x + face * 2 - 1, y - 27, 2, 2);
}
function drawCharTile(idx, x, y) { // Kenney 角色(腳底在 x,y)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x, y, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (tsheetReady) drawTile(idx, x - 20, y - 44, 2.5); else drawFigureTop(x, y, '#c84a4a', 1);
}
function drawDecor(d) {
  const x = d.x, y = d.y;
  if (tsheetReady && (d.type === 'tree' || d.type === 'lamp' || d.type === 'barrel' || d.type === 'crate')) {
    if (d.type === 'lamp') {
      const gl = 0.4 + Math.sin(frame * 0.1) * 0.12;
      ctx.fillStyle = 'rgba(255,220,120,' + gl.toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x, y - 52, 32, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x, y, d.type === 'tree' ? 22 : 10, d.type === 'tree' ? 8 : 4, 0, 0, Math.PI * 2); ctx.fill();
    if (d.type === 'tree') { const t = (d.x & 64) ? [313, 340] : [232, 259]; drawTile(t[0], x - 24, y - 96, 3); drawTile(t[1], x - 24, y - 48, 3); }
    else if (d.type === 'lamp') { drawTile(164, x - 16, y - 64, 2); drawTile(191, x - 16, y - 32, 2); }
    else if (d.type === 'barrel') drawTile(327, x - 16, y - 32, 2);
    else if (d.type === 'crate') drawTile(273, x - 16, y - 32, 2);
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  if (d.type === 'tree') {
    ctx.beginPath(); ctx.ellipse(x, y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(x - 5, y - 32, 10, 32);
    ctx.fillStyle = '#2f6b2a'; ctx.beginPath(); ctx.arc(x, y - 48, 27, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8a34'; ctx.beginPath(); ctx.arc(x - 12, y - 54, 17, 0, Math.PI * 2); ctx.arc(x + 13, y - 50, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,180,0.16)'; ctx.beginPath(); ctx.arc(x - 9, y - 58, 9, 0, Math.PI * 2); ctx.fill();
  } else if (d.type === 'lamp') {
    ctx.beginPath(); ctx.ellipse(x, y, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a3450'; ctx.fillRect(x - 3, y - 50, 6, 50);
    ctx.fillStyle = '#2a2438'; ctx.fillRect(x - 8, y - 60, 16, 12);
    const gl = 0.55 + Math.sin(frame * 0.1) * 0.14;
    ctx.fillStyle = 'rgba(255,220,120,0.14)'; ctx.beginPath(); ctx.arc(x, y - 54, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,224,128,' + gl.toFixed(2) + ')'; ctx.fillRect(x - 5, y - 58, 10, 8);
  } else if (d.type === 'fountain') {
    ctx.beginPath(); ctx.ellipse(x, y + 6, 58, 22, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a7a8a'; ctx.beginPath(); ctx.ellipse(x, y, 56, 24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a5a6a'; ctx.beginPath(); ctx.ellipse(x, y, 48, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a7ac0'; ctx.beginPath(); ctx.ellipse(x, y, 42, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a9ad8'; ctx.beginPath(); ctx.ellipse(x, y - 2, 38, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a7a8a'; ctx.fillRect(x - 8, y - 36, 16, 34);
    for (let i = 0; i < 8; i++) { const a = frame * 0.09 + i * 0.8; ctx.fillStyle = 'rgba(150,200,255,0.6)'; ctx.fillRect(x + Math.cos(a) * 14 - 1, y - 40 + Math.abs(Math.sin(a * 1.5)) * 8, 2, 3); }
    ctx.fillStyle = '#9ad0ff'; ctx.fillRect(x - 3, y - 50, 6, 14);
  } else if (d.type === 'bush') {
    ctx.beginPath(); ctx.ellipse(x, y, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f6b2a'; ctx.beginPath(); ctx.arc(x - 9, y - 8, 12, 0, Math.PI * 2); ctx.arc(x + 9, y - 8, 12, 0, Math.PI * 2); ctx.arc(x, y - 15, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8a34'; ctx.beginPath(); ctx.arc(x - 4, y - 15, 6, 0, Math.PI * 2); ctx.fill();
  } else if (d.type === 'flower') {
    ctx.fillStyle = '#3f8a34'; ctx.fillRect(x - 12, y - 2, 24, 4);
    const cols = ['#ff6b8a', '#ffd23e', '#c060ff', '#6f9dff'];
    for (let i = 0; i < 5; i++) { const fy = y - 8 - ((i * 7 + d.x) % 6); ctx.fillStyle = cols[(i + (d.x >> 5)) % 4]; ctx.fillRect(x - 11 + i * 5, fy, 4, 4); ctx.fillStyle = '#ffe680'; ctx.fillRect(x - 10 + i * 5, fy + 1, 2, 2); }
  } else if (d.type === 'barrel') {
    ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4a2a'; ctx.fillRect(x - 9, y - 26, 18, 26);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 9, y - 21, 18, 3); ctx.fillRect(x - 9, y - 9, 18, 3);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 9, y - 26, 18, 3);
  } else if (d.type === 'crate') {
    ctx.fillRect(x - 12, y - 2, 24, 4);
    ctx.fillStyle = '#8a6a3a'; ctx.fillRect(x - 12, y - 24, 24, 24);
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.strokeRect(x - 12, y - 24, 24, 24);
    ctx.beginPath(); ctx.moveTo(x - 12, y - 24); ctx.lineTo(x + 12, y); ctx.moveTo(x + 12, y - 24); ctx.lineTo(x - 12, y); ctx.stroke();
  }
}
function renderTown() {
  ctx.fillStyle = '#2f3a26'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(-Math.round(townCamX), -Math.round(townCamY));
  if (tsheetReady) { // Kenney 草地 + 中央石板廣場
    const gs = 32, gx0 = Math.floor(townCamX / gs) * gs, gy0 = Math.floor(townCamY / gs) * gs;
    for (let gx = gx0; gx < gx0 + W + gs; gx += gs) for (let gy = gy0; gy < gy0 + H + gs; gy += gs) {
      const dxp = (gx + 16 - 700) / 250, dyp = (gy + 16 - 490) / 210;
      drawTile(dxp * dxp + dyp * dyp < 1 ? 36 : 28, gx, gy, 2);
    }
  } else {
    const gx0 = Math.floor(townCamX / 48) * 48, gy0 = Math.floor(townCamY / 48) * 48;
    for (let gx = gx0; gx < gx0 + W + 48; gx += 48) for (let gy = gy0; gy < gy0 + H + 48; gy += 48) { ctx.fillStyle = (((gx / 48) + (gy / 48)) & 1) ? '#3a4a2e' : '#41522f'; ctx.fillRect(gx, gy, 48, 48); }
    ctx.fillStyle = '#6a5a46'; ctx.beginPath(); ctx.ellipse(700, 490, 234, 192, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 深度排序:裝飾 / NPC(含建築) / 玩家 依腳底 y 前後遮擋
  const ents = [];
  for (const d of TOWN_DECOR) ents.push({ y: d.y, decor: d });
  for (const n of NPCS) ents.push({ y: n.y, n: n });
  ents.push({ y: townP.y, self: true });
  ents.sort((a, b) => a.y - b.y);
  ctx.textAlign = 'center';
  for (const e of ents) {
    if (e.self) {
      drawEquippedAura(townP.x, townP.y - 24, 26, 48);
      drawCharTile(PLAYER_CHAR, townP.x, townP.y);
      ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 12px "Courier New",monospace';
      ctx.fillText(meta.playerName || '勇者', townP.x, townP.y - 46);
    } else if (e.decor) {
      drawDecor(e.decor);
    } else {
      const n = e.n;
      drawBuildingTop(n);
      drawCharTile(n.char, n.x, n.y);
      ctx.fillStyle = n.col; ctx.font = 'bold 12px "Courier New",monospace';
      ctx.fillText(n.name, n.x, n.y - 42);
      ctx.fillStyle = '#c8cdec'; ctx.font = '9px "Courier New",monospace';
      ctx.fillText(n.sub, n.x, n.y - 30);
      if (n.panel === 'activity' && hasActivityReward()) { ctx.fillStyle = '#ffe680'; ctx.font = 'bold 18px "Courier New",monospace'; ctx.fillText('!', n.x + 19, n.y - 47); }
      if (nearNpc === n) { ctx.fillStyle = Math.floor(frame / 20) % 2 === 0 ? '#ffe680' : '#fff'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('Space 互動', n.x, n.y - 56); }
    }
  }
  ctx.restore();
  // 氛圍:黃昏暖調 + 暗角
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 0.92);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(15,10,30,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  // HUD
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(20,22,43,0.7)'; ctx.fillRect(0, 0, 420, 30);
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('城鎮', 12, 20);
  ctx.fillStyle = '#7dffd6'; ctx.fillText('靈魂 ' + meta.souls, 80, 20);
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillText('石' + meta.mats.enh + ' 塵' + meta.mats.ench + ' 核' + meta.mats.set, 190, 20);
  ctx.fillStyle = '#b98cff'; ctx.fillText('活躍 ' + activityState.activity + '/300', 320, 20);
  statsBtn = { x: W - 102, y: 5, w: 92, h: 25 };
  ctx.fillStyle = 'rgba(125,255,214,0.14)'; ctx.fillRect(statsBtn.x, statsBtn.y, statsBtn.w, statsBtn.h);
  ctx.strokeStyle = '#547f80'; ctx.lineWidth = 1; ctx.strokeRect(statsBtn.x, statsBtn.y, statsBtn.w, statsBtn.h);
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('[P] 角色能力', statsBtn.x + statsBtn.w / 2, statsBtn.y + 17);
  ctx.textAlign = 'left';
  drawChat();
}
function drawChat() {
  const cx = 14, cw = 360, ih = 24, ch = 108, cy = H - ch - ih - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = '#3a3450'; ctx.lineWidth = 1; ctx.strokeRect(cx, cy, cw, ch);
  ctx.textAlign = 'left'; ctx.font = '12px "Courier New",monospace';
  const show = chatMsgs.slice(-6);
  for (let i = 0; i < show.length; i++) {
    const m = show[i];
    ctx.fillStyle = m.name === '系統' ? '#8aa8ff' : (m.name === (meta.playerName || '勇者') ? '#7dffd6' : '#c8cdec');
    let line = '[' + m.name + '] ' + m.text;
    if (line.length > 34) line = line.slice(0, 34);
    ctx.fillText(line, cx + 8, cy + 18 + i * 16);
  }
  const iy = cy + ch + 4;
  ctx.fillStyle = chatting ? 'rgba(125,255,214,0.15)' : 'rgba(0,0,0,0.42)'; ctx.fillRect(cx, iy, cw, ih);
  ctx.strokeStyle = chatting ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(cx, iy, cw, ih);
  ctx.fillStyle = chatting ? '#fff' : '#667';
  ctx.fillText(chatting ? (chatInput + (Math.floor(frame / 15) % 2 ? '_' : '')) : '按 Enter 開始聊天', cx + 8, iy + 16);
}

// ---------- menu ----------
const PART_NAME = { weapon: '武器', armor: '防具', helmet: '頭盔', boots: '鞋子', acc: '飾品' };
function renderStashTab() {
  stashBtns.length = 0; stashActBtns.length = 0;
  if (pendingStashDel && !meta.stash.some(s => s.uid === pendingStashDel)) pendingStashDel = null;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 17px ' + STAT_FONT; ctx.fillText('裝備倉庫', 24, 130);
  ctx.fillStyle = '#747b9e'; ctx.font = '10px ' + STAT_FONT; ctx.fillText('管理出戰配置、套裝鍛造、強化與附魔', 115, 130);
  const stashResources = [
    { x: 596, w: 80, icon: '⬟', label: '套裝核心', value: meta.mats.set, color: '#7dffd6' },
    { x: 682, w: 80, icon: '◆', label: '強化石', value: meta.mats.enh, color: '#ffbd72' },
    { x: 768, w: 80, icon: '✦', label: '附魔塵', value: meta.mats.ench, color: '#d9a8ff' },
    { x: 854, w: 82, icon: '▣', label: '容量', value: meta.stash.length + '/' + STASH_CAP, color: '#9fc7ff' }
  ];
  for (const r of stashResources) {
    fillRoundRect(r.x, 112, r.w, 28, 4, 'rgba(255,255,255,0.045)', '#343850', 1);
    ctx.fillStyle = r.color; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText(r.icon, r.x + 8, 130);
    ctx.fillStyle = '#717895'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(r.label, r.x + 23, 123);
    ctx.fillStyle = '#edf0ff'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText(String(r.value), r.x + 23, 136);
  }

  const loadPanel = { x: 24, y: 150, w: 286, h: 366 };
  const gridPanel = { x: 326, y: 150, w: 610, h: 190 };
  const workPanel = { x: 326, y: 352, w: 610, h: 164 };
  drawMenuPanel(loadPanel.x, loadPanel.y, loadPanel.w, loadPanel.h);
  drawMenuPanel(gridPanel.x, gridPanel.y, gridPanel.w, gridPanel.h);
  drawMenuPanel(workPanel.x, workPanel.y, workPanel.w, workPanel.h);

  ctx.fillStyle = '#eef0ff'; ctx.font = 'bold 14px ' + STAT_FONT; ctx.fillText('出戰配置', loadPanel.x + 16, loadPanel.y + 24);
  ctx.fillStyle = '#68708e'; ctx.font = '9px ' + STAT_FONT; ctx.fillText('進入地城時自動穿戴', loadPanel.x + 16, loadPanel.y + 41);
  for (let i = 0; i < 5; i++) {
    const part = GEAR_PARTS[i], y = loadPanel.y + 52 + i * 60;
    const uid = meta.loadout[part];
    const it = uid ? meta.stash.find(s => s.uid === uid) : null;
    const selected = it && selStash === it.uid;
    fillRoundRect(loadPanel.x + 12, y, loadPanel.w - 24, 52, 5, selected ? 'rgba(125,255,214,0.1)' : 'rgba(255,255,255,0.035)', selected ? '#68c1ac' : '#33374f', selected ? 2 : 1);
    ctx.fillStyle = '#656d8c'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.fillText(PART_NAME[part], loadPanel.x + 22, y + 18);
    if (it) {
      stashBtns.push({ x: loadPanel.x + 12, y, w: loadPanel.w - 24, h: 52, uid: it.uid });
      drawItemIcon(it, loadPanel.x + 62, y + 6, 40);
      ctx.fillStyle = gearColor(it); ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(gearLabel(it), loadPanel.x + 108, y + 20);
      ctx.fillStyle = '#7b829f'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(gearDesc(it), loadPanel.x + 108, y + 38);
      ctx.fillStyle = '#76e2c6'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'right'; ctx.fillText('出戰中', loadPanel.x + loadPanel.w - 22, y + 18); ctx.textAlign = 'left';
    } else {
      fillRoundRect(loadPanel.x + 62, y + 8, 36, 36, 4, 'rgba(0,0,0,0.16)', '#30344a', 1);
      ctx.fillStyle = '#464c68'; ctx.font = 'bold 17px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText('+', loadPanel.x + 80, y + 32); ctx.textAlign = 'left';
      ctx.fillStyle = '#565d7b'; ctx.font = '10px ' + STAT_FONT; ctx.fillText('尚未設定', loadPanel.x + 108, y + 31);
    }
  }

  ctx.fillStyle = '#eef0ff'; ctx.font = 'bold 14px ' + STAT_FONT; ctx.fillText('收藏裝備', gridPanel.x + 16, gridPanel.y + 24);
  ctx.fillStyle = '#68708e'; ctx.font = '9px ' + STAT_FONT; ctx.fillText('點擊裝備，在下方工作台管理', gridPanel.x + 94, gridPanel.y + 24);
  const gx = gridPanel.x + 30, gy = gridPanel.y + 38, cell = 46, gap = 5, cols = 10;
  for (let i = 0; i < STASH_CAP; i++) {
    const it = meta.stash[i];
    const cxx = gx + (i % cols) * (cell + gap), cyy = gy + Math.floor(i / cols) * (cell + gap);
    const on = it && selStash === it.uid;
    if (on) { ctx.shadowColor = '#7dffd6'; ctx.shadowBlur = 7; }
    fillRoundRect(cxx, cyy, cell, cell, 4, it ? (on ? 'rgba(125,255,214,0.15)' : 'rgba(255,255,255,0.045)') : 'rgba(0,0,0,0.16)', it ? (on ? '#7dffd6' : gearColor(it)) : '#292d43', on ? 2 : 1);
    ctx.shadowBlur = 0;
    if (it) {
      stashBtns.push({ x: cxx, y: cyy, w: cell, h: cell, uid: it.uid });
      drawItemIcon(it, cxx + 5, cyy + 3, 36);
      if (GEAR_PARTS.some(pt => meta.loadout[pt] === it.uid)) { ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText('▲', cxx + 4, cyy + 11); }
      if (it.enh > 0) { ctx.fillStyle = '#ffcf6a'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'right'; ctx.fillText('+' + it.enh, cxx + cell - 3, cyy + 12); }
      if (it.setId) { ctx.fillStyle = gearColor(it); ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText('⬟', cxx + 4, cyy + cell - 4); }
      const enchanted = (it.affixes || []).filter(Boolean).length;
      if (enchanted) { ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 9px "Courier New",monospace'; ctx.textAlign = 'right'; ctx.fillText('✦' + enchanted, cxx + cell - 3, cyy + cell - 4); }
      ctx.textAlign = 'left';
    }
  }
  const sel = selStash ? meta.stash.find(s => s.uid === selStash) : null;
  if (sel) {
    normalizeGear(sel);
    const wx = workPanel.x, wy = workPanel.y;
    drawItemIcon(sel, wx + 16, wy + 14, 44);
    ctx.textAlign = 'left'; ctx.fillStyle = gearColor(sel); ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText(gearLabel(sel), wx + 70, wy + 25);
    ctx.fillStyle = '#777e9d'; ctx.font = '10px ' + STAT_FONT;
    const selectedSet = GEAR_SET_BY_ID[sel.setId];
    ctx.fillText((selectedSet ? selectedSet.name + '套裝' : RARITY_NAME[sel.r]) + ' ' + PART_NAME[sel.kind] + '  •  ' + gearDesc(sel), wx + 70, wy + 43);
    const lv = sel.enh || 0;
    const equipped = meta.loadout[sel.kind] === sel.uid;
    const usable = gearUsableByClass(sel, chosenCls);
    const b1 = { x: wx + 278, y: wy + 13, w: 92, h: 36, act: 'equip' };
    stashActBtns.push(b1);
    fillRoundRect(b1.x, b1.y, b1.w, b1.h, 4, equipped ? 'rgba(125,255,214,0.16)' : usable ? 'rgba(255,255,255,0.055)' : 'rgba(255,90,90,0.055)', equipped ? '#68c1ac' : usable ? '#42465d' : '#613f4a', 1);
    ctx.fillStyle = equipped ? '#8affdc' : usable ? '#d5d8e8' : '#b57882'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillText(equipped ? '✓ 卸下裝備' : usable ? '設為出戰' : '限' + (sel.cls === 'mage' ? '法師' : '劍士'), b1.x + b1.w / 2, b1.y + 23);
    const pend = pendingStashDel === sel.uid;
    const b2 = { x: wx + 488, y: wy + 13, w: 104, h: 36, act: 'dismantle' };
    stashActBtns.push(b2); fillRoundRect(b2.x, b2.y, b2.w, b2.h, 4, pend ? 'rgba(226,59,59,0.26)' : 'rgba(255,255,255,0.04)', pend ? '#e05b66' : '#42465d', 1);
    ctx.fillStyle = pend ? '#ff9aa1' : '#a4a9be'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText(pend ? '再次點擊確認' : '分解成材料', b2.x + b2.w / 2, b2.y + 23);
    if (lv < ENH_MAX) {
      const b3 = { x: wx + 378, y: wy + 13, w: 102, h: 36, act: 'enhance' };
      stashActBtns.push(b3);
      const can = meta.mats.enh >= enhCost(lv);
      fillRoundRect(b3.x, b3.y, b3.w, b3.h, 4, can ? 'rgba(255,140,46,0.18)' : 'rgba(255,255,255,0.035)', can ? '#d98944' : '#3c4057', 1);
      ctx.fillStyle = can ? '#ffc48c' : '#6f7590'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.textAlign = 'center';
      ctx.fillText('⚒ 強化  ◆' + enhCost(lv), b3.x + b3.w / 2, b3.y + 23);
    }
    ctx.textAlign = 'left'; ctx.font = '9px ' + STAT_FONT;
    if (selectedSet) {
      const count = loadoutSetCount(selectedSet.id), bonusText = selectedSet.bonuses.map(b => b.pieces + '件 ' + b.text).join('  •  ');
      ctx.fillStyle = selectedSet.color; ctx.font = 'bold 8px ' + STAT_FONT; ctx.textAlign = 'left';
      ctx.fillText(selectedSet.name + ' ' + count + '/4  •  ' + bonusText, wx + 16, wy + 68);
      const fb = { x:wx + 470, y:wy + 56, w:108, h:26, act:'forgeSet' };
      stashActBtns.push(fb);
      const canForge = usable && meta.mats.set >= SET_CRAFT_COST && meta.stash.length < STASH_CAP;
      fillRoundRect(fb.x, fb.y, fb.w, fb.h, 4, canForge ? 'rgba(125,255,214,0.15)' : 'rgba(255,255,255,0.03)', canForge ? selectedSet.color : '#3b4054', 1);
      ctx.fillStyle = canForge ? '#dffff6' : '#697089'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText('鍛造缺件  ⬟' + SET_CRAFT_COST, fb.x + fb.w / 2, fb.y + 17);
    } else if (lv < ENH_MAX) {
      const zone = enhZone(lv), zt = zone === 'safe' ? '安全保級' : zone === 'down' ? '失敗降級' : '爆裝 ' + Math.round(enhBoomRate(lv) * 100) + '%';
      ctx.fillStyle = '#747b98'; ctx.fillText('強化 +' + lv + ' → +' + (lv + 1) + '  •  成功 ' + Math.round(enhRate(lv) * 100) + '%  •  ' + zt, wx + 16, wy + 66);
    } else { ctx.fillStyle = '#ffe680'; ctx.fillText('強化已滿 +' + ENH_MAX, wx + 16, wy + 66); }

    ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 10px ' + STAT_FONT;
    ctx.fillText('✦ 附魔詞綴  ' + sel.affixes.filter(Boolean).length + '/' + sel.affixes.length, wx + 16, wy + 87);
    for (let i = 0; i < sel.affixes.length; i++) {
      const a = sel.affixes[i], y = wy + 94 + i * 22;
      fillRoundRect(wx + 16, y, workPanel.w - 32, 19, 3, 'rgba(217,168,255,0.055)', a && AFFIX_BY_ID[a.id].rare ? '#9c7940' : '#4b405e', 1);
      ctx.fillStyle = a ? (AFFIX_BY_ID[a.id].rare ? '#ffcf6a' : '#eadcff') : '#77728a';
      ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText('槽 ' + (i + 1) + '  ' + (a ? affixText(a) : '— 空槽 —'), wx + 26, y + 13);
      if (a) {
        ctx.fillStyle = '#77728a'; ctx.font = '8px ' + STAT_FONT; ctx.fillText('可重洗 ' + (AFFIX_MAX_REROLLS - a.rerolls) + ' 次', wx + 346, y + 13);
      }
      if (!a || a.rerolls < AFFIX_MAX_REROLLS) {
        const cost = a ? AFFIX_REROLL_COST[a.rerolls] : 3;
        const eb = { x: wx + 472, y: y + 1, w: 106, h: 17, act: 'enchant', slot: i };
        stashActBtns.push(eb);
        const can = meta.mats.ench >= cost;
        fillRoundRect(eb.x, eb.y, eb.w, eb.h, 3, can ? 'rgba(176,90,224,0.22)' : 'rgba(255,255,255,0.025)', can ? '#9361ae' : '#3d3a48', 1);
        ctx.fillStyle = can ? '#eadcff' : '#6d6978'; ctx.font = 'bold 8px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText((a ? '重洗' : '附魔') + '  ✦' + cost, eb.x + eb.w / 2, eb.y + 12);
      } else {
        ctx.fillStyle = '#6c6678'; ctx.font = 'bold 8px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText('已鎖定', wx + 525, y + 13);
      }
    }
    ctx.textAlign = 'left';
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = '#4f5674'; ctx.font = 'bold 28px ' + STAT_FONT; ctx.fillText('◇', workPanel.x + workPanel.w / 2, workPanel.y + 58);
    ctx.fillStyle = '#9ca2bc'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText(meta.stash.length ? '選擇一件裝備開始管理' : '倉庫目前沒有裝備', workPanel.x + workPanel.w / 2, workPanel.y + 88);
    ctx.fillStyle = '#5f6685'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(meta.stash.length ? '可設定出戰、強化、附魔或分解' : '從地城帶回裝備後會存放在這裡', workPanel.x + workPanel.w / 2, workPanel.y + 108);
    ctx.textAlign = 'left';
  }
  if (menuMsg) {
    ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(menuMsg.text, W / 2, 532);
    if (--menuMsg.t <= 0) menuMsg = null;
    ctx.textAlign = 'left';
  }
  drawEnhAnim();
  drawEnchantAnim();
}
function drawEnhAnim() {
  if (!enhAnim) return;
  const a = enhAnim, cx = W / 2, cy = 300, rt = a.result;
  const boom = rt === 'boom';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  if (a.t > 42) { // 火花/爆炸擴散
    const rr = (70 - a.t) * 4;
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2 + frame * 0.2;
      ctx.fillStyle = boom ? (i % 2 ? '#ff5a3a' : '#ffb020') : (i % 2 ? '#ffcf6a' : '#7dffd6');
      const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
      ctx.fillRect(px - 3, py - 3, 6, 6);
    }
    ctx.fillStyle = boom ? 'rgba(255,90,58,0.5)' : 'rgba(255,220,120,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, 40 - (70 - a.t) * 2), 0, Math.PI * 2); ctx.fill();
  } else { // 結果字
    const txt = rt === 'success' ? '✦ 強化成功 ✦' : rt === 'keep' ? '失敗… 保級' : rt === 'down' ? '強化失敗 · 降級' : '💥 裝備爆裂!';
    const col = rt === 'success' ? '#7dffd6' : boom ? '#ff5a3a' : '#ffe680';
    const sc = 1 + Math.max(0, (a.t - 30)) * 0.04;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc, sc);
    ctx.fillStyle = col; ctx.font = 'bold 30px "Courier New",monospace';
    ctx.fillText(txt, 0, 0); ctx.restore();
  }
  if (--a.t <= 0) enhAnim = null;
  ctx.textAlign = 'left';
}
function drawEnchantAnim() {
  if (!enchantAnim) return;
  const a = enchantAnim, cx = 638, cy = 455;
  ctx.fillStyle = 'rgba(10,6,20,0.42)'; ctx.fillRect(340, 405, 590, 120);
  ctx.textAlign = 'center';
  const spread = (55 - a.t) * 3.5;
  for (let i = 0; i < 12; i++) {
    const ang = i / 12 * Math.PI * 2 + frame * 0.12;
    ctx.fillStyle = a.rare ? (i % 2 ? '#ffcf6a' : '#fff2a8') : (i % 2 ? '#d9a8ff' : '#7dffd6');
    ctx.fillRect(cx + Math.cos(ang) * spread - 2, cy + Math.sin(ang) * spread - 2, 5, 5);
  }
  if (a.t < 40) {
    ctx.fillStyle = a.rare ? '#ffcf6a' : '#eadcff';
    ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillText((a.rare ? '★ 稀有詞綴 ' : '✦ 附魔完成 ') + a.text, cx, cy + 7);
  }
  if (--a.t <= 0) enchantAnim = null;
  ctx.textAlign = 'left';
}
const SKILL_COLORS = {
  slash:'#d9c7a2', spin:'#e8a84c', dash:'#8ec9df', quake:'#c98b59', rage:'#d95745',
  fire:'#ff7a36', bolt:'#e9d45a', ice:'#71c9e8', meteor:'#d85132', shield:'#9575d5'
};
function drawSkillSigil(id, x, y, r, active, locked) {
  const col = SKILL_COLORS[id] || '#d8b365';
  ctx.save(); ctx.translate(x, y);
  if (active && !locked) { ctx.shadowColor = col; ctx.shadowBlur = 12 + Math.sin(frame * 0.08) * 3; }
  ctx.fillStyle = locked ? '#17171a' : '#211d1a';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = locked ? '#4a4845' : col; ctx.lineWidth = active ? 3 : 2;
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = locked ? '#302f31' : 'rgba(255,230,180,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  const icon = locked ? skillIconsGray[id] : skillIcons[id];
  if (icon && icon.complete && icon.naturalWidth) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(icon, -r + 5, -r + 5, r * 2 - 10, r * 2 - 10); ctx.restore();
  } else {
    ctx.strokeStyle = locked ? '#555' : col; ctx.fillStyle = locked ? '#555' : col; ctx.lineWidth = Math.max(2, r * 0.1);
  if (id === 'slash' || id === 'dash') {
    ctx.rotate(id === 'dash' ? -0.65 : -0.35); ctx.fillRect(-2, -r * 0.62, 4, r * 1.05); ctx.fillRect(-r * 0.22, r * 0.3, r * 0.44, 3);
  } else if (id === 'spin') {
    ctx.beginPath(); ctx.arc(0, 0, r * 0.46, -2.4, 1.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.44, -r * 0.05); ctx.lineTo(-r * 0.62, -r * 0.2); ctx.lineTo(-r * 0.38, -r * 0.3); ctx.fill();
  } else if (id === 'quake') {
    ctx.beginPath(); ctx.moveTo(-r * 0.58, r * 0.38); ctx.lineTo(-r * 0.2, -r * 0.35); ctx.lineTo(0, r * 0.08); ctx.lineTo(r * 0.22, -r * 0.5); ctx.lineTo(r * 0.58, r * 0.38); ctx.stroke();
  } else if (id === 'rage') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.58); ctx.lineTo(r * 0.45, -r * 0.05); ctx.lineTo(r * 0.2, r * 0.55); ctx.lineTo(-r * 0.2, r * 0.55); ctx.lineTo(-r * 0.45, -r * 0.05); ctx.closePath(); ctx.fill();
  } else if (id === 'fire' || id === 'meteor') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.bezierCurveTo(r * 0.58, -r * 0.12, r * 0.42, r * 0.54, 0, r * 0.62); ctx.bezierCurveTo(-r * 0.52, r * 0.32, -r * 0.45, -r * 0.12, 0, -r * 0.62); ctx.fill();
    if (id === 'meteor') { ctx.strokeStyle = '#fff1a8'; ctx.beginPath(); ctx.moveTo(-r * 0.42, -r * 0.5); ctx.lineTo(-r * 0.62, -r * 0.72); ctx.moveTo(r * 0.05, -r * 0.6); ctx.lineTo(r * 0.22, -r * 0.82); ctx.stroke(); }
  } else if (id === 'bolt') {
    ctx.beginPath(); ctx.moveTo(r * 0.08, -r * 0.68); ctx.lineTo(-r * 0.38, r * 0.02); ctx.lineTo(-r * 0.02, r * 0.02); ctx.lineTo(-r * 0.2, r * 0.66); ctx.lineTo(r * 0.48, -r * 0.14); ctx.lineTo(r * 0.1, -r * 0.14); ctx.closePath(); ctx.fill();
  } else if (id === 'ice') {
    for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -r * 0.62); ctx.lineTo(0, r * 0.62); ctx.stroke(); }
  } else if (id === 'shield') {
    ctx.beginPath(); ctx.moveTo(0, -r * 0.58); ctx.lineTo(r * 0.48, -r * 0.3); ctx.lineTo(r * 0.36, r * 0.36); ctx.lineTo(0, r * 0.62); ctx.lineTo(-r * 0.36, r * 0.36); ctx.lineTo(-r * 0.48, -r * 0.3); ctx.closePath(); ctx.stroke();
  }
  }
  if (locked) {
    ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.beginPath(); ctx.arc(0, 0, r - 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#777'; ctx.lineWidth = 2; ctx.strokeRect(-6, 0, 12, 10); ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI, 0); ctx.stroke();
  }
  ctx.restore();
}
function drawStonePanel(x, y, w, h, title) {
  ctx.fillStyle = 'rgba(11,10,12,0.82)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#5b4a34'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = '#2f2921'; ctx.lineWidth = 1; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
  if (title) { ctx.fillStyle = '#c5a66a'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText(title, x + 12, y + 18); }
}
function roundRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath();
}
function fillRoundRect(x, y, w, h, r, fill, stroke, lineWidth) {
  roundRectPath(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1; ctx.stroke(); }
}
function drawMenuPanel(x, y, w, h) {
  fillRoundRect(x, y, w, h, 8, 'rgba(10,12,28,0.58)', '#3c405c', 1);
  ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(x + 1, y + 1, w - 2, 4);
}
function renderSkillTab() {
  skillBtns.length = 0; skillActBtns.length = 0;
  if (pendingReset && (frame - pendingReset.f > 150 || pendingReset.id !== selSkill)) pendingReset = null;
  const list = classSkills(chosenCls), lo = loadouts[chosenCls];
  if (!selSkill || !SKILL_DEFS[selSkill] || SKILL_DEFS[selSkill].cls !== chosenCls) selSkill = list[0];

  // 頂部職業切換與技能秘典
  const clsList = ['warrior', 'mage'];
  for (let i = 0; i < 2; i++) {
    const b = { x: 30 + i * 128, y: 118, w: 118, h: 34, act: 'cls', cls: clsList[i] };
    skillActBtns.push(b);
    const on = chosenCls === clsList[i];
    ctx.fillStyle = on ? 'rgba(124,55,32,0.8)' : 'rgba(18,17,19,0.78)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = on ? '#c88a4b' : '#51483d'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = on ? '#f0d8ad' : '#80766a'; ctx.font = 'bold 13px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillText((i === 0 ? '⚔ ' : '✦ ') + CLASSES[clsList[i]].name, b.x + b.w / 2, b.y + 22);
  }
  gachaBtn = { x: 676, y: 118, w: 254, h: 34 };
  const pool = list.filter(id => !(skillState[id].unl && skillState[id].pts >= 5));
  const pulse = 0.18 + (Math.sin(frame * 0.08) + 1) * 0.05;
  ctx.fillStyle = pool.length ? 'rgba(118,61,130,' + pulse.toFixed(2) + ')' : 'rgba(255,255,255,0.035)'; ctx.fillRect(gachaBtn.x, gachaBtn.y, gachaBtn.w, gachaBtn.h);
  ctx.strokeStyle = pool.length ? '#9e6cad' : '#4b4540'; ctx.lineWidth = 2; ctx.strokeRect(gachaBtn.x, gachaBtn.y, gachaBtn.w, gachaBtn.h);
  ctx.fillStyle = pool.length ? '#ead8ef' : '#706a65'; ctx.font = 'bold 13px ' + STAT_FONT; ctx.textAlign = 'center';
  ctx.fillText(pool.length ? '✦ 解讀技能秘典   40 靈魂' : '技能秘典已全部掌握', gachaBtn.x + gachaBtn.w / 2, gachaBtn.y + 22);

  // 技能樹石板
  const tx = 28, ty = 162, tw = 508, th = 274;
  drawStonePanel(tx, ty, tw, th, '技 能 樹  •  點選節點查看與配點');
  const pos = [[78,142],[208,84],[208,204],[382,84],[382,204]];
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,4]];
  for (const e of edges) {
    const a = pos[e[0]], b = pos[e[1]];
    const lit = skillState[list[e[0]]].unl && skillState[list[e[1]]].unl;
    ctx.strokeStyle = lit ? 'rgba(190,139,72,0.72)' : '#34302c'; ctx.lineWidth = lit ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(tx + a[0], ty + a[1]); ctx.lineTo(tx + b[0], ty + b[1]); ctx.stroke();
  }
  for (let i = 0; i < list.length; i++) {
    const id = list[i], s = skillState[id], p = pos[i], cx = tx + p[0], cy = ty + p[1];
    const selected = selSkill === id, canSpend = s.unl && s.pts > s.spent;
    skillBtns.push({ x: cx - 39, y: cy - 39, w: 78, h: 88, act: 'sel', id });
    if (canSpend) { ctx.strokeStyle = '#f0c76b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 38 + Math.sin(frame * 0.1) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (selected) { ctx.strokeStyle = '#c87942'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.stroke(); }
    drawSkillSigil(id, cx, cy, selected ? 34 : 31, selected || canSpend, !s.unl);
    ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillStyle = !s.unl ? '#69645f' : selected ? '#f2d7a6' : '#c4b9a9';
    ctx.fillText(s.unl ? SKILL_DEFS[id].name : '未知技能', cx, cy + 49);
    ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillStyle = canSpend ? '#f0c76b' : '#777069';
    ctx.fillText(s.unl ? ('等級 ' + s.spent + '/5' + (canSpend ? '  +' : '')) : '秘典解鎖', cx, cy + 63);
    const li = lo.indexOf(id);
    if (li >= 0) {
      ctx.fillStyle = '#b74132'; ctx.beginPath(); ctx.arc(cx + 25, cy - 25, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e3b96e'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#fff1d0'; ctx.font = 'bold 10px ' + STAT_FONT;
      ctx.fillText(['Z','X','C'][li], cx + 25, cy - 21);
    }
  }

  // 右側技能詳情與天賦階級
  const dx = 548, dy = 162, dw = 384, dh = 274;
  drawStonePanel(dx, dy, dw, dh, '技 能 詳 情');
  const id = selSkill, s = skillState[id], d = SKILL_DEFS[id], col = SKILL_COLORS[id];
  drawSkillSigil(id, dx + 48, dy + 58, 27, true, !s.unl);
  ctx.textAlign = 'left'; ctx.fillStyle = s.unl ? '#f0d8ad' : '#77716c'; ctx.font = 'bold 19px ' + STAT_FONT; ctx.fillText(s.unl ? d.name : '未解鎖技能', dx + 86, dy + 52);
  ctx.fillStyle = '#948b81'; ctx.font = '11px ' + STAT_FONT; ctx.fillText('MP ' + d.mp + '   冷卻 ' + (d.cd / 60).toFixed(1) + '秒', dx + 86, dy + 72);
  ctx.fillStyle = s.unl ? '#c7beb3' : '#6e6863'; ctx.font = '12px ' + STAT_FONT; drawFitText(s.unl ? d.desc : '透過技能秘典解鎖這項能力。', dx + 18, dy + 103, dw - 36);
  ctx.strokeStyle = '#3b342d'; ctx.beginPath(); ctx.moveTo(dx + 16, dy + 118); ctx.lineTo(dx + dw - 16, dy + 118); ctx.stroke();
  if (s.unl) {
    const avail = s.pts - s.spent, effect = TALENT_EFFECTS[id][s.branch >= 0 ? s.branch : 0];
    const labels = ['傷害+12%', s.branch < 0 ? '流派選擇' : BRANCH_NAMES[id][s.branch], s.branch < 0 ? '機制強化' : effect.lv3, '冷卻-15%', s.branch < 0 ? '終極特效' : effect.lv5];
    ctx.fillStyle = '#9d8c74'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText('天賦階級   可用點數 ' + avail, dx + 18, dy + 139);
    for (let k = 0; k < 5; k++) {
      const nx = dx + 42 + k * 74, ny = dy + 166, invested = s.spent > k, available = k === s.spent && s.pts > s.spent;
      if (k < 4) { ctx.strokeStyle = s.spent > k + 1 ? col : '#403a34'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nx + 15, ny); ctx.lineTo(nx + 59, ny); ctx.stroke(); }
      ctx.fillStyle = invested ? col : '#1c1a19'; ctx.beginPath(); ctx.arc(nx, ny, available ? 15 : 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = available ? '#f0c76b' : invested ? '#f6d59a' : '#5b534a'; ctx.lineWidth = available ? 2 : 1; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = invested ? '#201912' : '#887f75'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(String(k + 1), nx, ny + 4);
      ctx.fillStyle = invested ? '#d9c9b3' : '#716a63'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(labels[k].slice(0, 7), nx, ny + 29);
    }
    ctx.textAlign = 'left'; ctx.fillStyle = s.branch >= 0 ? '#bca88c' : '#7e766e'; ctx.font = '9px ' + STAT_FONT;
    drawFitText(s.branch >= 0 ? ('Lv3 ' + effect.lv3 + '  •  Lv5 ' + effect.lv5) : 'Lv2 選擇流派後將解鎖專屬機制', dx + 18, dy + 215, dw - 36);
    let ax = dx + 18;
    const actionBtn = (label, act, extra, color, width) => {
      const b = Object.assign({ x:ax, y:dy + 226, w:width || Math.max(74, label.length * 13 + 18), h:32, act }, extra || {}); skillActBtns.push(b);
      ctx.fillStyle = color || 'rgba(255,255,255,0.055)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = color ? '#aa7a48' : '#564c40'; ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#e5d5bd'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText(label, b.x + b.w / 2, b.y + 21); ax += b.w + 8;
    };
    if (avail > 0 && s.spent < 5) {
      if (s.spent === 1) { actionBtn(BRANCH_NAMES[id][0], 'invest', {br:0}, 'rgba(90,115,85,0.35)', 74); actionBtn(BRANCH_NAMES[id][1], 'invest', {br:1}, 'rgba(126,65,39,0.38)', 74); }
      else actionBtn('升級天賦', 'invest', {}, 'rgba(126,83,35,0.42)', 86);
    }
    actionBtn(lo.indexOf(id) >= 0 ? '卸下技能' : '加入快捷列', 'equip', {}, undefined, 94);
    if (s.spent > 0 && ax < dx + dw - 74) {
      const pend = pendingReset && pendingReset.id === id;
      actionBtn(pend ? '確認?' : '重置', 'reset', {}, pend ? 'rgba(120,35,35,0.48)' : undefined, 62);
    }
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = '#756e67'; ctx.font = '12px ' + STAT_FONT;
    ctx.fillText('未知的力量尚未回應你。', dx + dw / 2, dy + 172);
    ctx.fillStyle = '#9e6cad'; ctx.fillText('使用上方「技能秘典」獲得。', dx + dw / 2, dy + 197);
  }

  // 暗黑風格快捷列：點槽位可將目前技能直接綁定到 Z/X/C
  ctx.textAlign = 'left'; ctx.fillStyle = '#bca27b'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText('技能快捷列  •  點擊槽位綁定目前技能', 30, 458);
  for (let i = 0; i < 3; i++) {
    const bx = 352 + i * 192, by = 447, b = { x:bx, y:by, w:176, h:62, act:'slot', slot:i };
    skillActBtns.push(b); ctx.fillStyle = 'rgba(10,9,10,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeStyle = lo[i] ? '#80633d' : '#443d35'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#7f261f'; ctx.fillRect(b.x + 8, b.y + 9, 38, 42); ctx.strokeStyle = '#c08b50'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 8, b.y + 9, 38, 42);
    ctx.fillStyle = '#f3dfbd'; ctx.font = 'bold 17px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText(['Z','X','C'][i], b.x + 27, b.y + 36);
    if (lo[i]) drawSkillSigil(lo[i], b.x + 70, b.y + 31, 22, false, false);
    ctx.textAlign = 'left'; ctx.fillStyle = lo[i] ? '#e2d1b9' : '#625d57'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText(lo[i] ? SKILL_DEFS[lo[i]].name : '空槽位', b.x + 100, b.y + 27);
    ctx.fillStyle = '#746d65'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(lo[i] === id ? '再點卸下' : '點擊綁定', b.x + 100, b.y + 44);
  }
  ctx.fillStyle = '#746d65'; ctx.font = '11px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText('Enter 開始冒險', 30, 494);
}
function renderActivityTaskPanel(scope, x, y, w, defs, title, resetText) {
  const daily = scope === 'daily', progress = daily ? activityState.daily : activityState.weekly;
  const claims = daily ? activityState.claimedDaily : activityState.claimedWeekly;
  const col = daily ? '#7dffd6' : '#b98cff';
  drawStonePanel(x, y, w, 232, title);
  ctx.textAlign = 'right'; ctx.fillStyle = '#6f718c'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText(resetText, x + w - 12, y + 18);
  for (let i = 0; i < defs.length; i++) {
    const task = defs[i], py = y + 32 + i * 62, value = Math.min(task.target, progress[task.stat] || 0);
    const done = value >= task.target, claimed = !!claims[task.id];
    ctx.fillStyle = claimed ? 'rgba(125,255,214,0.055)' : 'rgba(255,255,255,0.035)'; ctx.fillRect(x + 10, py, w - 20, 54);
    ctx.strokeStyle = claimed ? 'rgba(125,255,214,0.28)' : '#34364d'; ctx.lineWidth = 1; ctx.strokeRect(x + 10, py, w - 20, 54);
    ctx.textAlign = 'left'; ctx.fillStyle = claimed ? '#788c87' : '#e3e5f5'; ctx.font = 'bold 13px ' + STAT_FONT; ctx.fillText(task.title, x + 20, py + 18);
    ctx.fillStyle = '#777b9b'; ctx.font = '10px ' + STAT_FONT; ctx.fillText(task.desc, x + 20, py + 34);
    const bx = x + 20, by = py + 40, bw = w - 144;
    ctx.fillStyle = '#17192a'; ctx.fillRect(bx, by, bw, 5);
    ctx.fillStyle = col; ctx.fillRect(bx, by, bw * value / task.target, 5);
    ctx.textAlign = 'right'; ctx.fillStyle = done ? col : '#8b8eaa'; ctx.font = 'bold 10px ' + STAT_FONT;
    ctx.fillText(value + '/' + task.target + '  +' + task.points, x + w - 102, py + 20);
    const b = { x:x + w - 90, y:py + 10, w:68, h:34, act:'task', scope, id:task.id };
    if (done && !claimed) activityBtns.push(b);
    ctx.fillStyle = claimed ? 'rgba(125,255,214,0.08)' : done ? 'rgba(125,255,214,0.22)' : 'rgba(255,255,255,0.035)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = claimed ? '#42675f' : done ? col : '#393b50'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = 'center'; ctx.fillStyle = claimed ? '#66847d' : done ? '#fff' : '#646780'; ctx.font = 'bold 11px ' + STAT_FONT;
    ctx.fillText(claimed ? '已領取' : done ? '領取' : '進行中', b.x + b.w / 2, b.y + 22);
  }
}
// ---------- 精通分頁（J1-B）：各職業等級/進度/轉職解鎖/獎勵軌 ----------
function masteryChapterOf(lv) { return lv >= 21 ? 2 : lv >= 11 ? 1 : 0; }
function renderMasteryJobPanel(job, x, y, w, h) {
  const cls = CLASSES[job] || { name: job, col: '#8890b8' };
  const p = masteryProgress(job);
  drawStonePanel(x, y, w, h, cls.name + '  精 通');
  // 大字等級
  ctx.textAlign = 'left';
  ctx.fillStyle = cls.col; ctx.font = 'bold 34px ' + STAT_FONT;
  ctx.fillText('Lv ' + p.lv, x + 16, y + 62);
  ctx.fillStyle = '#6f7492'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('/ ' + MASTERY_MAX_LEVEL, x + 16 + ctx.measureText('Lv ' + p.lv).width + 74, y + 62);
  // 章節標示
  const chapter = masteryChapterOf(p.lv), chapterNames = ['第一章', '第二章', '第三章'];
  ctx.textAlign = 'right'; ctx.fillStyle = '#9da1bc'; ctx.font = 'bold 10px ' + STAT_FONT;
  ctx.fillText(chapterNames[chapter], x + w - 16, y + 34);
  // 進度條
  const barX = x + 16, barY = y + 78, barW = w - 32;
  ctx.fillStyle = '#17192a'; ctx.fillRect(barX, barY, barW, 14);
  const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  g.addColorStop(0, cls.col); g.addColorStop(1, '#7dffd6');
  ctx.fillStyle = g; ctx.fillRect(barX, barY, barW * (p.max ? 1 : p.ratio), 14);
  ctx.strokeStyle = '#4e526c'; ctx.lineWidth = 1; ctx.strokeRect(barX, barY, barW, 14);
  ctx.textAlign = 'center'; ctx.fillStyle = '#dfe3f5'; ctx.font = 'bold 9px ' + STAT_FONT;
  ctx.fillText(p.max ? '已達精通上限' : (p.into + ' / ' + p.need + '  EXP'), barX + barW / 2, barY + 11);
  // 統計
  ctx.textAlign = 'left'; ctx.fillStyle = '#8c92b1'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText('累積精通 ' + p.xp + ' EXP', x + 16, y + 112);
  ctx.fillText('最深 ' + p.best + ' 層　首殺 Boss ' + p.bosses.length + ' 種', x + 16, y + 130);
  // 進階轉職解鎖狀態
  const unlocked = p.lv >= MASTERY_ADVANCE_LEVEL;
  const ay = y + 144, ah = 34;
  ctx.fillStyle = unlocked ? 'rgba(255,230,128,0.12)' : 'rgba(255,255,255,0.028)';
  ctx.fillRect(x + 14, ay, w - 28, ah);
  ctx.strokeStyle = unlocked ? '#c8a64f' : '#35374b'; ctx.strokeRect(x + 14, ay, w - 28, ah);
  ctx.fillStyle = unlocked ? '#ffe680' : '#74778e'; ctx.font = 'bold 10px ' + STAT_FONT;
  ctx.fillText(unlocked ? '★ 進階轉職條件已達成' : '進階轉職：Lv ' + MASTERY_ADVANCE_LEVEL + '（還差 ' + (MASTERY_ADVANCE_LEVEL - p.lv) + ' 級）', x + 24, ay + 15);
  ctx.fillStyle = '#64677b'; ctx.font = '9px ' + STAT_FONT;
  ctx.fillText('進階職業將於後續版本開放', x + 24, ay + 28);
}
function renderMasteryTab() {
  const jobs = Object.keys(CLASSES);
  const top = 112, ph = 192, gap = 16;
  const pw = Math.floor((912 - gap * (Math.min(2, jobs.length) - 1)) / Math.min(2, jobs.length));
  for (let i = 0; i < jobs.length; i++) {
    const col = i % 2, row = Math.floor(i / 2);
    renderMasteryJobPanel(jobs[i], 24 + col * (pw + gap), top + row * (ph + gap), pw, ph);
  }
  // 獎勵軌（外觀獎勵，K1 系列開放後接上）
  const ry = top + Math.ceil(jobs.length / 2) * (ph + gap), rh = 504 - ry;
  drawStonePanel(24, ry, 912, rh, '精 通 獎 勵 軌  •  只給外觀與材料，不影響戰力');
  const chapters = [
    { range: 'Lv 1–10', name: '第一章', reward: '角色配色・材料・名牌框', col: '#7dffd6' },
    { range: 'Lv 11–20', name: '第二章', reward: '職業稱號・技能外觀・基地旗幟', col: '#9ecbff' },
    { range: 'Lv 21–30', name: '第三章', reward: '勝利姿勢・終極技能外觀・職業雕像', col: '#d9a8ff' }
  ];
  const bw = 288, bx0 = 36;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i], bx = bx0 + i * (bw + 12), by = ry + 30;
    const reached = jobs.some(j => masteryChapterOf(masteryProgress(j).lv) >= i);
    ctx.fillStyle = reached ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.022)';
    ctx.fillRect(bx, by, bw, 52);
    ctx.strokeStyle = reached ? c.col : '#33364a'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, 52);
    ctx.textAlign = 'left'; ctx.fillStyle = reached ? c.col : '#5d6076'; ctx.font = 'bold 11px ' + STAT_FONT;
    ctx.fillText(c.name + '　' + c.range, bx + 10, by + 19);
    ctx.fillStyle = reached ? '#aeb2ca' : '#54576b'; ctx.font = '9px ' + STAT_FONT;
    ctx.fillText(c.reward, bx + 10, by + 36);
    ctx.fillStyle = '#5d6076'; ctx.fillText(reached ? '（獎勵於後續版本開放）' : '尚未解鎖', bx + 10, by + 48);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#6f7492'; ctx.font = '9px ' + STAT_FONT;
  ctx.fillText('精通經驗來自樓層深度、擊殺與成功撤退；首次以該職業擊敗某 Boss 有額外加成，未突破該職最深紀錄時收益降低。', 36, ry + rh - 12);
  ctx.textAlign = 'left';
}
function renderActivityTab() {
  refreshActivityPeriods(); activityBtns.length = 0;
  renderActivityTaskPanel('daily', 24, 112, 448, currentActivityTasks('daily'), '每 日 任 務', '每日輪替・00:00 重置');
  renderActivityTaskPanel('weekly', 488, 112, 448, currentActivityTasks('weekly'), '每 週 挑 戰', '每週輪替・週一重置');

  const x = 24, y = 356, w = 912;
  drawStonePanel(x, y, w, 158, '本 週 活 躍  •  ' + activityState.activity + ' / 300');
  const barX = x + 18, barY = y + 31, barW = w - 36;
  ctx.fillStyle = '#17192a'; ctx.fillRect(barX, barY, barW, 14);
  const ag = ctx.createLinearGradient(barX, 0, barX + barW, 0); ag.addColorStop(0, '#7dffd6'); ag.addColorStop(1, '#b05ae0');
  ctx.fillStyle = ag; ctx.fillRect(barX, barY, barW * activityState.activity / 300, 14);
  ctx.strokeStyle = '#4e526c'; ctx.strokeRect(barX, barY, barW, 14);
  for (const m of ACTIVITY_MILESTONES) {
    const mx = barX + barW * m.points / 300;
    ctx.fillStyle = activityState.activity >= m.points ? '#ffe680' : '#656982'; ctx.fillRect(mx - 1, barY - 3, 2, 20);
    ctx.textAlign = 'center'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.fillText(String(m.points), mx, barY + 28);
  }
  for (let i = 0; i < ACTIVITY_MILESTONES.length; i++) {
    const m = ACTIVITY_MILESTONES[i], bx = x + 14 + i * 299, by = y + 68, claimed = !!activityState.milestones[m.points], ready = activityState.activity >= m.points;
    const b = { x:bx, y:by, w:285, h:42, act:'milestone', points:m.points };
    if (ready && !claimed) activityBtns.push(b);
    ctx.fillStyle = claimed ? 'rgba(125,255,214,0.06)' : ready ? 'rgba(255,230,128,0.12)' : 'rgba(255,255,255,0.028)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = claimed ? '#42675f' : ready ? '#c8a64f' : '#35374b'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = 'left'; ctx.fillStyle = ready ? '#ffe680' : '#74778e'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(m.points + ' 活躍', bx + 10, by + 16);
    ctx.fillStyle = claimed ? '#68857d' : ready ? '#e2e3ef' : '#64677b'; ctx.font = '9px ' + STAT_FONT; ctx.fillText(claimed ? '✓ 已領取' : m.label, bx + 10, by + 31);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#9da1bc'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText('外觀光環', x + 18, y + 137);
  let ax = x + 105;
  for (const id of Object.keys(AURA_DEFS)) {
    const a = AURA_DEFS[id], unlocked = ownsCosmetic('aura', id), equipped = equippedCosmetic('aura') === id;
    const b = { x:ax, y:y + 118, w:126, h:27, act:'aura', id };
    if (unlocked) activityBtns.push(b);
    ctx.fillStyle = equipped ? a.color : 'rgba(255,255,255,0.035)'; ctx.globalAlpha = equipped ? 0.28 : 1; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.globalAlpha = 1;
    ctx.strokeStyle = equipped ? a.color : unlocked ? '#565a72' : '#303244'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = 'center'; ctx.fillStyle = equipped ? '#fff' : unlocked ? '#aeb2ca' : '#55586c'; ctx.font = 'bold 10px ' + STAT_FONT;
    ctx.fillText(unlocked ? (equipped ? '✓ ' + a.name : a.name) : '🔒 ' + a.name, b.x + b.w / 2, b.y + 18);
    ax += 136;
  }
}
function renderMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#131526'); g.addColorStop(1, '#242842');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0, 0, W, 104);

  // 緊湊的品牌、資源列與導覽，讓內容成為畫面主角。
  ctx.textAlign = 'left';
  ctx.fillStyle = '#c36cf0'; ctx.font = 'bold 22px ' + STAT_FONT;
  ctx.fillText('像素地城', 24, 33);
  ctx.fillStyle = '#777c9d'; ctx.font = '10px "Courier New",monospace';
  ctx.fillText('PIXEL DUNGEON', 25, 47);
  const resources = [
    { x: 424, w: 118, icon: '◆', label: '靈魂', value: meta.souls, color: '#83f4d1' },
    { x: 550, w: 118, icon: '▼', label: '最深', value: bestFloor + ' 層', color: '#9fc7ff' },
    { x: 676, w: 118, icon: '✦', label: '活躍', value: activityState.activity, color: '#ffe080' }
  ];
  for (const r of resources) {
    fillRoundRect(r.x, 14, r.w, 34, 5, 'rgba(255,255,255,0.055)', '#343850', 1);
    ctx.fillStyle = r.color; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText(r.icon, r.x + 10, 35);
    ctx.fillStyle = '#7f86a7'; ctx.font = '10px ' + STAT_FONT; ctx.fillText(r.label, r.x + 28, 27);
    ctx.fillStyle = '#eef1ff'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText(String(r.value), r.x + 28, 41);
  }
  // 存檔碼按鈕
  gearBtn = { x: 910, y: 14, w: 34, h: 34 };
  fillRoundRect(gearBtn.x, gearBtn.y, gearBtn.w, gearBtn.h, 5, 'rgba(255,255,255,0.07)', '#44485f', 1);
  drawGear(gearBtn.x + gearBtn.w / 2, gearBtn.y + gearBtn.h / 2, 12, '#c8cdec');
  if (menuMsg) {
    ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'right';
    ctx.fillText(menuMsg.text, 892, 91); ctx.textAlign = 'center';
    if (--menuMsg.t <= 0) menuMsg = null;
  }
  // 分頁:基地 / 技能 / 倉庫 / 契約
  tabBtns.length = 0;
  const tabs = [['base', '⌂  基地'], ['skills', '✦  技能'], ['stash', '▣  倉庫'], ['activity', '▤  契約'], ['mastery', '★  精通']];
  for (let i = 0; i < tabs.length; i++) {
    const b = { x: 24 + i * 100, y: 62, w: 92, h: 30, tab: tabs[i][0] };
    tabBtns.push(b);
    const on = menuTab === b.tab;
    fillRoundRect(b.x, b.y, b.w, b.h, 4, on ? 'rgba(176,90,224,0.3)' : 'rgba(255,255,255,0.035)', on ? '#b05ae0' : '#383c55', on ? 2 : 1);
    ctx.fillStyle = on ? '#fff' : '#8c92b1'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillText(tabs[i][1], b.x + b.w / 2, b.y + 20);
    if (b.tab === 'activity' && hasActivityReward()) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(b.x + b.w - 7, b.y + 7, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  backTownBtn = null;
  if (fromTown) {
    backTownBtn = { x: 798, y: 62, w: 146, h: 30 };
    fillRoundRect(backTownBtn.x, backTownBtn.y, backTownBtn.w, backTownBtn.h, 4, 'rgba(125,255,214,0.12)', '#6bbaa8', 1);
    ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('← 返回城鎮', backTownBtn.x + backTownBtn.w / 2, backTownBtn.y + 20);
  }
  ctx.fillStyle = '#343850'; ctx.fillRect(24, 103, 912, 1);
  if (menuTab === 'skills') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; diffBtns.length = 0; stashBtns.length = 0; stashActBtns.length = 0; activityBtns.length = 0;
    renderSkillTab();
    return;
  }
  if (menuTab === 'stash') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; diffBtns.length = 0; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; activityBtns.length = 0;
    renderStashTab();
    return;
  }
  if (menuTab === 'activity') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; diffBtns.length = 0; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; stashBtns.length = 0; stashActBtns.length = 0;
    renderActivityTab();
    return;
  }
  if (menuTab === 'mastery') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; diffBtns.length = 0; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; stashBtns.length = 0; stashActBtns.length = 0; activityBtns.length = 0;
    renderMasteryTab();
    return;
  }
  skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; stashBtns.length = 0; stashActBtns.length = 0; activityBtns.length = 0;
  // 基地主頁：左側準備出戰，右側永久成長。
  const left = { x: 24, y: 116, w: 430, h: 388 };
  const right = { x: 470, y: 116, w: 466, h: 388 };
  drawMenuPanel(left.x, left.y, left.w, left.h);
  drawMenuPanel(right.x, right.y, right.w, right.h);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 17px ' + STAT_FONT; ctx.fillText('選擇冒險者', left.x + 18, left.y + 28);
  ctx.fillStyle = '#747b9e'; ctx.font = '11px ' + STAT_FONT; ctx.fillText('選擇職業並確認本次出戰技能', left.x + 18, left.y + 47);

  // 更有辨識度的職業卡。
  selBtns.length = 0;
  const cls = ['warrior', 'mage'];
  for (let i = 0; i < 2; i++) {
    const c = cls[i];
    const cw = 190, ch = 118;
    const cx = left.x + 18 + i * 202, cy = left.y + 56;
    const sel = chosenCls === c;
    if (sel) { ctx.shadowColor = '#7dffd6'; ctx.shadowBlur = 9; }
    fillRoundRect(cx, cy, cw, ch, 6, sel ? 'rgba(66,112,110,0.28)' : 'rgba(13,15,31,0.72)', sel ? '#7dffd6' : '#3c4058', sel ? 2 : 1);
    ctx.shadowBlur = 0;
    selBtns.push({ x: cx, y: cy, w: cw, h: ch, cls: c });
    drawSprite(c === 'mage' ? MAGE : WAR, cx + 16, cy + 22, 3, false);
    ctx.textAlign = 'left'; ctx.fillStyle = sel ? '#fff' : '#b0b5cf'; ctx.font = 'bold 17px ' + STAT_FONT;
    ctx.fillText(CLASSES[c].name, cx + 86, cy + 36);
    ctx.fillStyle = '#91bceb'; ctx.font = '11px ' + STAT_FONT;
    ctx.fillText(c === 'warrior' ? '近戰  •  高生存' : '遠程  •  高爆發', cx + 86, cy + 57);
    ctx.fillStyle = '#6f7695'; ctx.font = '10px ' + STAT_FONT;
    ctx.fillText(c === 'warrior' ? '穩定推進，正面迎敵' : '掌控距離，範圍清場', cx + 86, cy + 77);
    if (sel) {
      fillRoundRect(cx + 86, cy + 92, 78, 24, 4, 'rgba(125,255,214,0.15)', '#5fae99', 1);
      ctx.fillStyle = '#8affdc'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText('✓ 目前出戰', cx + 96, cy + 108);
    } else {
      ctx.fillStyle = '#646b8c'; ctx.font = '10px ' + STAT_FONT; ctx.fillText('按 [' + (i + 1) + '] 選擇', cx + 86, cy + 108);
    }
  }

  // 目前裝備的三個技能。
  ctx.textAlign = 'left'; ctx.fillStyle = '#aeb4d0'; ctx.font = 'bold 11px ' + STAT_FONT;
  ctx.fillText('出戰技能', left.x + 18, left.y + 188);
  const equipped = loadouts[chosenCls];
  for (let i = 0; i < equipped.length; i++) {
    const id = equipped[i], ix = left.x + 32 + i * 126, iy = left.y + 216;
    drawSkillSigil(id, ix, iy, 20, !!id, !id);
    ctx.fillStyle = id ? '#dfe3f5' : '#6c728f'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(id ? SKILL_DEFS[id].name : '尚未裝備', ix + 30, iy - 3);
    ctx.fillStyle = '#686f90'; ctx.font = '9px ' + STAT_FONT; ctx.fillText('技能 ' + (i + 1), ix + 30, iy + 13);
  }
  // 本次難度（一般／困難）— 與設定頁同步，per-run 可在此切換。
  const terrainNormal = (typeof terrainMode === 'undefined' ? 'normal' : terrainMode) !== 'complex';
  ctx.textAlign = 'left'; ctx.fillStyle = '#aeb4d0'; ctx.font = 'bold 11px ' + STAT_FONT;
  ctx.fillText('本次難度', left.x + 18, left.y + 250);
  const dbW = 188, dbH = 26, db1 = left.x + 18, db2 = left.x + 18 + dbW + 12, dby = left.y + 258;
  diffBtns.length = 0;
  const diffBtn = (x, mode, label, on) => {
    diffBtns.push({ x, y: dby, w: dbW, h: dbH, act: mode });
    fillRoundRect(x, dby, dbW, dbH, 5, on ? 'rgba(176,90,224,0.22)' : 'rgba(255,255,255,0.035)', on ? '#a962cf' : '#363a52', on ? 2 : 1);
    ctx.textAlign = 'center'; ctx.fillStyle = on ? '#f0dcfa' : '#858ba8'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.fillText(label, x + dbW / 2, dby + 17);
  };
  diffBtn(db1, 'terrainNormal', '一般（推薦）', terrainNormal);
  diffBtn(db2, 'terrainComplex', '困難', !terrainNormal);
  ctx.textAlign = 'left'; ctx.fillStyle = '#ffb45e'; ctx.font = '9px ' + STAT_FONT;
  ctx.fillText(terrainNormal ? '一般：升等較快、最高藍裝、掉落偏低、Boss 較弱、陷阱少' : '困難：可掉傳說與套裝、掉落較高、Boss 全強度、險境較多', left.x + 18, left.y + 296);
  ctx.fillStyle = '#343850'; ctx.fillRect(left.x + 18, left.y + 304, left.w - 36, 1);
  const bw2 = left.w - 36, bh2 = 48;
  startBtn = { x: left.x + 18, y: left.y + 312, w: bw2, h: bh2 };
  const pulse = 0.32 + (Math.sin(frame * 0.07) + 1) * 0.06;
  ctx.shadowColor = '#b05ae0'; ctx.shadowBlur = 8;
  fillRoundRect(startBtn.x, startBtn.y, bw2, bh2, 6, 'rgba(176,90,224,' + pulse.toFixed(2) + ')', '#c56ef0', 2);
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px ' + STAT_FONT;
  ctx.fillText('進入地城', startBtn.x + bw2 / 2 - 22, startBtn.y + 30);
  ctx.fillStyle = '#e3c4f3'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.fillText('[ ENTER ]', startBtn.x + bw2 / 2 + 82, startBtn.y + 30);
  ctx.fillStyle = '#777e9f'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText(lastRun ? (lastRun.benchmarkId ? '上次基準  第 ' + lastRun.floor + ' 層  •  擊殺 ' + lastRun.kills + '  •  進度未保存' : '上次紀錄  第 ' + lastRun.floor + ' 層  •  擊殺 ' + lastRun.kills + '  •  靈魂 +' + lastRun.gained) : '清空怪物、啟動傳送門，挑戰更深樓層', left.x + left.w / 2, left.y + 378);

  // 永久成長分成戰鬥／冒險兩頁，維持清楚密度並方便繼續擴充。
  metaBtns.length = 0;
  const sx = right.x + 14, sy = right.y + 99, sw = right.w - 28;
  ctx.textAlign = 'left'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 17px ' + STAT_FONT; ctx.fillText('永久成長', right.x + 18, right.y + 28);
  ctx.fillStyle = '#747b9e'; ctx.font = '10px ' + STAT_FONT; ctx.fillText('靈魂永久保留，所有職業共用', right.x + 18, right.y + 47);
  fillRoundRect(right.x + right.w - 132, right.y + 13, 114, 30, 5, 'rgba(125,255,214,0.08)', '#405c5b', 1);
  ctx.fillStyle = '#83f4d1'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText('◆ ' + meta.souls + ' 靈魂', right.x + right.w - 75, right.y + 33);
  const categoryDefs = [
    { id:'combat', label:'⚔ 戰鬥成長', sub:'輸出與生存' },
    { id:'adventure', label:'◇ 冒險成長', sub:'補給與探索' }
  ];
  for (let i = 0; i < categoryDefs.length; i++) {
    const c = categoryDefs[i], b = { x:right.x + 14 + i * 218, y:right.y + 60, w:206, h:30, act:'category', category:c.id };
    metaBtns.push(b);
    const on = metaCategory === c.id;
    fillRoundRect(b.x, b.y, b.w, b.h, 4, on ? 'rgba(176,90,224,0.22)' : 'rgba(255,255,255,0.035)', on ? '#a962cf' : '#363a52', on ? 2 : 1);
    ctx.textAlign = 'left'; ctx.fillStyle = on ? '#f0dcfa' : '#858ba8'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(c.label, b.x + 12, b.y + 19);
    ctx.textAlign = 'right'; ctx.fillStyle = on ? '#a98bb9' : '#575e7b'; ctx.font = '8px ' + STAT_FONT; ctx.fillText(c.sub, b.x + b.w - 10, b.y + 19);
  }
  const visibleMeta = META_DEFS.filter(d => d.group === metaCategory);
  for (let i = 0; i < visibleMeta.length; i++) {
    const d = visibleMeta[i];
    const lv = meta.up[d.id];
    const ry = sy + i * 52;
    const maxed = lv >= d.max;
    const cost = maxed ? 0 : d.cost(lv);
    const afford = !maxed && meta.souls >= cost;
    const rowFill = afford ? 'rgba(125,255,214,0.055)' : 'rgba(255,255,255,0.035)';
    fillRoundRect(sx, ry, sw, 45, 5, rowFill, afford ? '#3f6966' : '#30344c', 1);
    if (!maxed) metaBtns.push({ x: sx, y: ry, w: sw, h: 45, act:'buy', d: d });
    ctx.textAlign = 'left'; ctx.font = 'bold 11px ' + STAT_FONT;
    ctx.fillStyle = maxed ? '#ffe680' : afford ? '#f3f5ff' : '#a2a7bf'; ctx.fillText(d.name, sx + 11, ry + 17);
    ctx.font = '9px ' + STAT_FONT; ctx.fillStyle = '#737a9b'; ctx.fillText(d.desc, sx + 11, ry + 34);
    ctx.fillStyle = '#5b607c';
    const pipCount = d.max, pipW = Math.min(8, 78 / pipCount);
    for (let p = 0; p < pipCount; p++) {
      ctx.fillStyle = p < lv ? (maxed ? '#ffe680' : '#b05ae0') : '#393d56';
      ctx.fillRect(sx + 188 + p * (pipW + 2), ry + 12, pipW, 5);
    }
    ctx.fillStyle = '#737a9b'; ctx.font = '8px "Courier New",monospace'; ctx.fillText('LV ' + lv + '/' + d.max, sx + 188, ry + 33);
    const cb = { x: sx + sw - 92, y: ry + 7, w: 80, h: 31 };
    fillRoundRect(cb.x, cb.y, cb.w, cb.h, 4, maxed ? 'rgba(255,230,128,0.1)' : afford ? 'rgba(125,255,214,0.14)' : 'rgba(255,255,255,0.025)', maxed ? '#877a48' : afford ? '#65b5a0' : '#3d4159', 1);
    ctx.textAlign = 'center'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillStyle = maxed ? '#ffe680' : afford ? '#88f7d5' : '#767c99';
    ctx.fillText(maxed ? '已滿級' : '◆ ' + cost, cb.x + cb.w / 2, cb.y + 20);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#666d8e'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText('購買後立即生效  •  共 ' + META_DEFS.length + ' 種永久能力', right.x + right.w / 2, right.y + 374);
  ctx.textAlign = 'left';
}
