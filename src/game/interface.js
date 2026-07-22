"use strict";
// ---------- input ----------
const keys = {};
const pressedKeys = {};
const DASH_COOLDOWN = 150;
const DASH_DURATION = 10;
const DASH_SPEED = 8;
const inputBuffer = { jump:0, dash:0, skills:[0, 0, 0] };
const skillPulseT = [0, 0, 0];
let dashPulseT = 0;
let coyoteT = 0;
function normalizeGameKey(key) { return key === ' ' ? 'space' : key.toLowerCase(); }
function setGameKey(key, down) {
  const k = normalizeGameKey(key);
  if (down && !keys[k]) pressedKeys[k] = true;
  keys[k] = down;
}
function clearGameInputs() {
  for (const k of Object.keys(keys)) keys[k] = false;
  for (const k of Object.keys(pressedKeys)) delete pressedKeys[k];
  inputBuffer.jump = 0; inputBuffer.dash = 0; inputBuffer.skills.fill(0);
  for (const id of Object.keys(touchMap || {})) delete touchMap[id];
}
function captureBufferedInputs() {
  if (pressedKeys.space) inputBuffer.jump = 6;
  if (pressedKeys.shift && !player.itemWin) {
    if (player.dashCd <= 6) inputBuffer.dash = 6;
    else dashPulseT = Math.max(dashPulseT, 6);
  }
  const skillKeys = ['z', 'x', 'c'];
  for (let i = 0; i < 3; i++) {
    if (!pressedKeys[skillKeys[i]]) continue;
    if (player.slotCd[i] <= 6) inputBuffer.skills[i] = 6;
    else skillPulseT[i] = Math.max(skillPulseT[i], 6);
  }
  for (const k of Object.keys(pressedKeys)) delete pressedKeys[k];
}
function tickInputBuffers() {
  if (inputBuffer.jump > 0) inputBuffer.jump--;
  if (inputBuffer.dash > 0) inputBuffer.dash--;
  if (dashPulseT > 0) dashPulseT--;
  for (let i = 0; i < 3; i++) {
    if (inputBuffer.skills[i] > 0) inputBuffer.skills[i]--;
    if (skillPulseT[i] > 0) skillPulseT[i]--;
  }
}
const selBtns = [], metaBtns = [], itemBtns = [], delBtns = [];
let expBtn = null, impBtn = null, backTownBtn = null, gearBtn = null;
let metaCategory = 'combat';
let statsOpen = false, statsBtn = null, statsCloseBtn = null;
function openStats() { statsOpen = true; player.itemWin = false; clearGameInputs(); }
function drawGear(cx, cy, r, col) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = col;
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -r - 2, 4, 5); } // 齒
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.fill(); // 外圈
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill(); // 內孔
  ctx.restore();
}
// ---------- 設定視窗(不用 prompt,畫面內處理)----------
const GAME_VERSION = '0.29.8';
const GAME_UPDATE_NOTES = [
  {
    version:'0.29.8', date:'2026-07-22', title:'G1-A 祝福與詛咒技術地基',
    items:['建立祝福／詛咒共用的每局狀態、選擇、接受與安全拒絕流程。','同一地城種子可重現選項；每局提供兩次有限重抽，且不會重複提供已持有項目。','詛咒資料必須同時標示代價與對應收益；本批只建立契約，不調整戰鬥數值。']
  },
  {
    version:'0.29.7', date:'2026-07-22', title:'F1 專案結構整理',
    items:['程式碼集中至 src，主遊戲依責任拆成九個載入順序固定的模組。','遊戲素材與原始素材包分流至 assets/runtime 與 assets/source。','完成完整 smoke、手機橫向、正式頁素材與舊存檔回歸；本次不調整玩法數值。']
  },
  {
    version:'0.29.6', date:'2026-07-22', title:'E1-G Boss 平衡與收尾',
    items:['五隻 Boss 各加入劍士／法師固定配對基準，統計擊殺時間與承傷。','設定新增 Boss 測試紀錄頁，顯示目標區間與超過 15% 的職業差警戒。','完成手機、低特效、死亡／撤退、掉落、舊存檔與完整 smoke 回歸。']
  },
  {
    version:'0.29.5', date:'2026-07-22', title:'E1-F 虛空深淵 Boss',
    items:['深淵魔王加入虛空彈幕與平台消除，彈幕死亡來源可獨立記錄。','平台消除只作用於浮空平台；第三階段最多消除兩座，仍保留一座浮台。','地面主路徑永不消除，招式期間以穩定地面標線提示安全保底。']
  },
  {
    version:'0.29.4', date:'2026-07-22', title:'E1-E 冰霜凍原 Boss',
    items:['冰霜領主加入寒冰槍陣與暴風突進，兩種死亡來源分開記錄。','暴風突進會留下冰面並沿用滑行慣性；持續反方向輸入可煞車與反向。','第一階段先教槍陣，第二階段起才加入突進與冰面，第三階段擴大槍陣。']
  },
  {
    version:'0.29.3', date:'2026-07-22', title:'E1-D 熾熱熔岩 Boss',
    items:['熔岩魔王加入熔岩衝鋒與連鎖噴發，兩種死亡來源分開記錄。','連鎖噴口保留可穿越間隔，熄火後以冷色框標示 96 幀安全窗。','第一階段先教衝鋒，第二階段起才加入連鎖噴發，第三階段提高衝鋒距離與速度。']
  },
  {
    version:'0.29.2', date:'2026-07-22', title:'E1-C 幽暗洞窟 Boss',
    items:['洞窟領主加入落石標記與雙向洞窟衝擊波，兩種死亡來源分開記錄。','落石依階段增加為 2／3／4 處，衝擊波從第二階段起加入招式循環。','三座岩棚以發光邊線標示安全區；站上岩棚可避開落石與地面衝擊波。']
  },
  {
    version:'0.29.1', date:'2026-07-22', title:'E1-B 翠綠草原 Boss',
    items:['草原領主加入根鬚橫掃與種子彈幕，傷害來源可分別記錄。','第二階段起根鬚會留下減速荊棘，第三階段才與彈幕、跳撲組合。','新增草原領主專屬樹冠外觀；低特效仍保留地面框與招式名稱。']
  },
  {
    version:'0.29.0', date:'2026-07-22', title:'E1-A 五群系 Boss 技術地基',
    items:['五群系 Boss 改為獨立資料定義，保留現有難度與共用招式。','建立統一階段、招式預警、場地與環境互動介面。','平衡紀錄新增 Boss 擊殺時間、死亡招式與最終階段。']
  },
  {
    version:'0.28.9', date:'2026-07-22', title:'D3-C 首輪數值校準',
    items:['固定基準模型首輪只調整三項，幅度維持 10～12.5%。','菁英單體 HP 係數 2.40→2.15；落石與熔岩傷害 8%→7%。','險境額外靈魂提高 10%；平衡報表保留完整調整前後值。']
  },
  {
    version:'0.28.8', date:'2026-07-22', title:'D3-B 固定基準局與報表',
    items:['劍士與法師各加入新手、第二章、第三章三組固定裝備與種子。','自然遊玩與固定基準局分開統計，不混用樣本。','報表新增職業、房型、承傷占比、試煉與警戒線比較。']
  },
  {
    version:'0.28.7', date:'2026-07-22', title:'D3 平衡紀錄與遊戲內更新紀錄',
    items:['記錄最近 60 局的路線、房型、耗時、承傷與撤退結果。','設定新增平衡紀錄摘要，可複製完整 JSON 供測試比較。','設定新增更新紀錄頁，可直接查看最近版本內容。']
  },
  {
    version:'0.28.6', date:'2026-07-22', title:'地城 D2 完整交付',
    items:['五種群系地形與十二種事件完整接入地城路線。','1,000 組種子、手機觸控、死亡與撤退保存完成回歸。','正式頁與測試頁資源版本完成統一。']
  },
  {
    version:'0.28.5', date:'2026-07-22', title:'四種試煉與房間完成狀態',
    items:['加入菁英、限時、無傷與地形四種試煉。','成功、失敗與拒絕都能正常解除房門。','試煉獎勵改為單次發放並加入 HUD 狀態。']
  }
];
let settingsOpen = false, settingsMode = null; // 'import' | 'rename' | null
let settingsPage = 'main', settingsUpdateIndex = 0, settingsBalanceMode = 'natural', settingsBenchmarkIndex = 0;
const settingsBtns = [];
let saveInput = null;
function getSaveInput() {
  if (saveInput) return saveInput;
  saveInput = document.createElement('input');
  saveInput.type = 'text'; saveInput.setAttribute('autocomplete', 'off');
  saveInput.style.cssText = 'position:fixed;left:50%;top:56%;transform:translate(-50%,-50%);width:70%;max-width:440px;padding:10px 12px;font:14px "Courier New",monospace;z-index:9999;display:none;background:#14162b;color:#fff;border:2px solid #7dffd6;border-radius:4px;text-align:center;';
  saveInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') applySaveInput(); else if (e.key === 'Escape') closeSaveEdit(); });
  document.body.appendChild(saveInput);
  return saveInput;
}
function startSaveEdit(mode) {
  settingsMode = mode;
  const el = getSaveInput();
  el.value = mode === 'rename' ? (meta.playerName || '') : '';
  el.placeholder = mode === 'rename' ? '輸入新名字(最多12字)後按 Enter' : '貼上存檔碼後按 Enter';
  el.style.display = 'block'; el.focus();
}
function closeSaveEdit() { settingsMode = null; if (saveInput) { saveInput.style.display = 'none'; saveInput.blur(); } }
function applySaveInput() {
  const v = (saveInput.value || '').trim();
  if (settingsMode === 'rename') { if (v) { meta.playerName = v.slice(0, 12); saveMeta(); menuMsg = { text: '已改名為 ' + meta.playerName, color: '#7dffd6', t: 200 }; } }
  else if (settingsMode === 'import') {
    const a = decodeSave(v);
    if (a) { applyMeta(a[1], a.slice(2, 7), a[7]); if (a[0] >= 2) applySkillNums(a.slice(8, 8 + 46)); saveMeta(); menuMsg = { text: '匯入成功!靈魂 ' + meta.souls, color: '#7dffd6', t: 220 }; }
    else menuMsg = { text: '存檔碼無效', color: '#ff5a5a', t: 220 };
  }
  closeSaveEdit();
}
function drawSettingsButton(x, y, w, h, label, act, color) {
  const b = { x, y, w, h, act };
  settingsBtns.push(b);
  ctx.fillStyle = color || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
  return b;
}
function renderSettingsUpdates(mx, my, mw, mh) {
  const note = GAME_UPDATE_NOTES[settingsUpdateIndex] || GAME_UPDATE_NOTES[0];
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('v' + note.version + '　' + note.date, W / 2, my + 78);
  ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 17px "Courier New",monospace';
  ctx.fillText(note.title, W / 2, my + 108);
  for (let i = 0; i < note.items.length; i++) {
    const y = my + 150 + i * 62;
    ctx.fillStyle = '#b98cff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.textAlign = 'left';
    ctx.fillText('◆', mx + 42, y);
    ctx.fillStyle = '#c8cdec'; ctx.font = '13px "Courier New",monospace'; ctx.textAlign = 'center';
    wrapText(note.items[i], W / 2 + 10, y, mw - 112, 18);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#777e9f'; ctx.font = '11px "Courier New",monospace';
  ctx.fillText((settingsUpdateIndex + 1) + ' / ' + GAME_UPDATE_NOTES.length, W / 2, my + mh - 76);
  if (settingsUpdateIndex < GAME_UPDATE_NOTES.length - 1) drawSettingsButton(mx + 28, my + mh - 58, 150, 38, '← 較舊版本', 'updatesOlder');
  if (settingsUpdateIndex > 0) drawSettingsButton(mx + 188, my + mh - 58, 150, 38, '較新版本 →', 'updatesNewer');
  drawSettingsButton(mx + mw - 188, my + mh - 58, 160, 38, '返回設定', 'settingsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBalance(mx, my, mw, mh) {
  const report = typeof dungeonBalanceReport === 'function' ? dungeonBalanceReport(settingsBalanceMode) : null;
  const summary = report ? report.summary : { runs:0, extractRate:0, averageFloor:0, averageDurationSec:0, riskyChoiceRate:0, averageDamage:0, topDamage:[] };
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText(settingsBalanceMode === 'benchmark' ? '固定基準局 · 與自然遊玩分開' : '自然遊玩 · 最近 60 局', W / 2, my + 72);
  drawSettingsButton(mx + 146, my + 84, 138, 30, '自然遊玩', 'balanceNatural', settingsBalanceMode === 'natural' ? 'rgba(125,255,214,0.18)' : null);
  drawSettingsButton(mx + 296, my + 84, 138, 30, '固定基準', 'balanceBenchmark', settingsBalanceMode === 'benchmark' ? 'rgba(185,140,255,0.18)' : null);
  const rows = [
    ['樣本', summary.runs ? summary.runs + ' 局' : '尚無資料'],
    ['平均局長', summary.runs ? Math.round(summary.averageDurationSec / 60) + ' 分鐘' : '—'],
    ['劍士平均樓層', report && report.classStats.warrior.runs ? report.classStats.warrior.averageFloor.toFixed(1) : '—'],
    ['法師平均樓層', report && report.classStats.mage.runs ? report.classStats.mage.averageFloor.toFixed(1) : '—'],
    ['高風險選擇', summary.runs ? Math.round(summary.riskyChoiceRate * 100) + '%' : '—'],
    ['撤退率', summary.runs ? Math.round(summary.extractRate * 100) + '%' : '—']
  ];
  for (let i = 0; i < rows.length; i++) {
    const x = mx + 32 + (i % 2) * 258, y = my + 126 + Math.floor(i / 2) * 58;
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, 244, 48);
    ctx.strokeStyle = '#343850'; ctx.strokeRect(x, y, 244, 48);
    ctx.textAlign = 'left'; ctx.fillStyle = '#7f86a7'; ctx.font = '11px "Courier New",monospace'; ctx.fillText(rows[i][0], x + 12, y + 18);
    ctx.textAlign = 'right'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(String(rows[i][1]), x + 232, y + 33);
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#b98cff'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('主要承傷來源', mx + 32, my + 320);
  ctx.fillStyle = '#aeb4d0'; ctx.font = '11px "Courier New",monospace';
  const damageText = report && report.damageShares.length ? report.damageShares.slice(0, 3).map(item => item.source + ' ' + Math.round(item.share * 100) + '%').join('　·　') : '完成地城後會顯示排行';
  ctx.fillText(damageText, mx + 32, my + 342);
  ctx.fillStyle = report && report.alerts.length ? '#ffb45e' : '#6f7695';
  ctx.fillText(report && report.alerts.length ? '警戒：' + report.alerts[0] : '樣本達門檻後自動檢查平衡警戒線', mx + 32, my + 366);
  const calibration = report && report.calibration;
  const bossEncounterCount = report ? Object.values(report.bossStats || {}).reduce((sum, item) => sum + (item.encounters || 0), 0) : 0;
  ctx.fillStyle = '#7dffd6'; ctx.font = '10px "Courier New",monospace';
  ctx.fillText(calibration ? '校準 v' + calibration.version + '　Boss 紀錄 ' + bossEncounterCount + ' 場 · 擊殺時間／死亡招式／最終階段' : '', mx + 32, my + 389);
  if (menuMsg) {
    ctx.textAlign = 'center'; ctx.fillStyle = menuMsg.color; ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillText(menuMsg.text, W / 2, my + mh - 72);
    if (--menuMsg.t <= 0) menuMsg = null;
  }
  drawSettingsButton(mx + 20, my + mh - 58, 135, 38, '複製報表', 'copyBalance', 'rgba(185,140,255,0.16)');
  drawSettingsButton(mx + 165, my + mh - 58, 120, 38, 'Boss 紀錄', 'bossRecords', 'rgba(185,140,255,0.14)');
  drawSettingsButton(mx + 295, my + mh - 58, 120, 38, '基準設定', 'benchmarkSetup', 'rgba(255,180,94,0.12)');
  drawSettingsButton(mx + 425, my + mh - 58, 135, 38, '返回設定', 'settingsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBosses(mx, my, mw, mh) {
  const report = typeof dungeonBalanceReport === 'function' ? dungeonBalanceReport(settingsBalanceMode) : null;
  const comparison = settingsBalanceMode === 'benchmark' && typeof dungeonBossBenchmarkComparison === 'function' ? dungeonBossBenchmarkComparison() : null;
  const bossIds = typeof DUNGEON_BOSS_ORDER !== 'undefined' ? DUNGEON_BOSS_ORDER : [];
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(settingsBalanceMode === 'benchmark' ? '固定基準 · 配對裝備與種子' : '自然遊玩 · 最近 60 局', W / 2, my + 66);
  ctx.fillStyle = '#777e9f'; ctx.font = '10px "Courier New",monospace';
  ctx.fillText('擊殺時間目標與承傷只作警戒；每職業至少 3 場後再判斷', W / 2, my + 84);
  for (let i = 0; i < bossIds.length; i++) {
    const id = bossIds[i], stat = report && report.bossStats[id];
    const compared = comparison && comparison.bosses[id];
    const target = compared ? compared.target : (typeof DUNGEON_BOSS_BENCHMARK_TARGETS !== 'undefined' ? DUNGEON_BOSS_BENCHMARK_TARGETS.find(item => item.bossId === id) : null);
    const warrior = compared ? compared.warrior : stat && stat.classStats.warrior;
    const mage = compared ? compared.mage : stat && stat.classStats.mage;
    const paired = compared ? compared.paired : !!(warrior && mage && warrior.kills && mage.kills);
    const meanClear = paired ? (warrior.averageClearSec + mage.averageClearSec) / 2 : 0;
    const classGapPct = compared ? compared.classGapPct : paired && meanClear ? Math.abs(warrior.averageClearSec - mage.averageClearSec) / meanClear : 0;
    const ready = compared ? compared.ready : !!(warrior && mage && warrior.encounters >= 3 && mage.encounters >= 3);
    const x = mx + 22, y = my + 96 + i * 58, w = mw - 44;
    ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, w, 50);
    ctx.strokeStyle = ready && paired && classGapPct > 0.15 ? '#ffb45e' : '#343850'; ctx.strokeRect(x, y, w, 50);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f2f3ff'; ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillText((stat && stat.name) || (target && target.bossName) || id, x + 12, y + 19);
    ctx.fillStyle = '#7f86a7'; ctx.font = '10px "Courier New",monospace';
    const encounters = stat ? stat.encounters : 0, kills = stat ? stat.kills : 0;
    ctx.fillText('場次 ' + encounters + ' · 擊殺 ' + kills + (target ? ' · 目標 ' + target.clearSec[0] + '～' + target.clearSec[1] + '秒' : ''), x + 12, y + 39);
    const fmtClass = (label, item) => label + ' ' + (item && item.kills ? Math.round(item.averageClearSec) + '秒／傷' + Math.round(item.averageDamage) : '—');
    ctx.textAlign = 'right'; ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillText(fmtClass('劍', warrior) + '　' + fmtClass('法', mage), x + w - 12, y + 20);
    ctx.fillStyle = ready && paired ? (classGapPct <= 0.15 ? '#7dffd6' : '#ffb45e') : '#6f7695'; ctx.font = '10px "Courier New",monospace';
    ctx.fillText(paired ? '職業差 ' + Math.round(classGapPct * 100) + '%' + (ready ? '' : ' · 待各3場') : '等待配對樣本', x + w - 12, y + 39);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = comparison && comparison.alerts.length ? '#ffb45e' : '#6f7695'; ctx.font = '10px "Courier New",monospace';
  const readyCount = comparison ? Object.values(comparison.bosses).filter(item => item.ready).length : 0;
  ctx.fillText(comparison && comparison.alerts.length ? comparison.alerts[0] : readyCount ? '目前沒有超過 15% 的已配對職業警戒' : '每職業累積 3 場後啟用 15% 職業差警戒', W / 2, my + mh - 72);
  drawSettingsButton(mx + 24, my + mh - 58, 250, 38, '複製完整報表', 'copyBalance', 'rgba(185,140,255,0.16)');
  drawSettingsButton(mx + mw - 274, my + mh - 58, 250, 38, '返回平衡報表', 'bossRecordsBack', 'rgba(125,255,214,0.14)');
}
function renderSettingsBenchmark(mx, my, mw, mh) {
  const profiles = typeof DUNGEON_BENCHMARK_PROFILES !== 'undefined' ? DUNGEON_BENCHMARK_PROFILES : [];
  ctx.fillStyle = '#7dffd6'; ctx.font = '12px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText('固定種子與開局裝備；永久成長維持目前帳號', W / 2, my + 70);
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i], x = mx + 24 + (i % 2) * 270, y = my + 92 + Math.floor(i / 2) * 70;
    const selected = i === settingsBenchmarkIndex;
    const b = drawSettingsButton(x, y, 262, 54, profile.label, 'benchmarkSelect', selected ? 'rgba(185,140,255,0.2)' : null);
    b.index = i;
    ctx.fillStyle = selected ? '#ffe680' : '#7f86a7'; ctx.font = '10px "Courier New",monospace';
    ctx.fillText(profile.gearLabel + ' · Seed ' + profile.seed, x + 131, y + 44);
  }
  const selected = profiles[settingsBenchmarkIndex];
  ctx.fillStyle = '#8c92b1'; ctx.font = '11px "Courier New",monospace';
  ctx.fillText(selected ? '開始後不會改動倉庫；本局標記為 ' + selected.id : '沒有可用基準', W / 2, my + 326);
  drawSettingsButton(mx + 24, my + mh - 58, 260, 38, '開始固定基準局', 'benchmarkStart', 'rgba(255,180,94,0.18)');
  drawSettingsButton(mx + mw - 284, my + mh - 58, 260, 38, '返回平衡報表', 'balanceBack', 'rgba(125,255,214,0.14)');
}
function renderSettings() {
  settingsBtns.length = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  const mw = 580, mh = 470, mx = W / 2 - mw / 2, my = H / 2 - mh / 2;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 22px "Courier New",monospace';
  ctx.fillText(settingsPage === 'updates' ? '更 新 紀 錄' : settingsPage === 'balance' ? 'D3 平 衡 報 表' : settingsPage === 'bosses' ? 'BOSS 測 試 紀 錄' : settingsPage === 'benchmark' ? '固 定 基 準 局' : '設 定', W / 2, my + 38);
  if (settingsPage === 'updates') { renderSettingsUpdates(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'balance') { renderSettingsBalance(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'bosses') { renderSettingsBosses(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  if (settingsPage === 'benchmark') { renderSettingsBenchmark(mx, my, mw, mh); ctx.textAlign = 'left'; return; }
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px "Courier New",monospace'; ctx.fillText('名稱:' + (meta.playerName || '勇者'), W / 2, my + 66);
  ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('設定儲存在此瀏覽器；存檔碼可備份角色進度', W / 2, my + 86);
  ctx.fillStyle = audioSettings.muted ? '#ff8a8a' : '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('音效音量：' + (audioSettings.muted ? '靜音' : Math.round(audioSettings.volume * 100) + '%'), W / 2, my + 112);
  const sm = (x, y, w, label, act, on) => { const b = { x, y, w, h:34, act }; settingsBtns.push(b); ctx.fillStyle = on ? 'rgba(125,255,214,0.22)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, 34); ctx.strokeStyle = on ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 34); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(label, x + w / 2, y + 22); };
  sm(mx + 64, my + 124, 92, '－ 10%', 'volDown', false);
  sm(mx + 166, my + 124, 92, '＋ 10%', 'volUp', false);
  sm(mx + 304, my + 124, 192, audioSettings.muted ? '開啟音效' : '靜音', 'mute', audioSettings.muted);
  ctx.fillStyle = '#b98cff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.fillText('戰鬥效果', W / 2, my + 184);
  const shakeNames = ['關', '低', '完整'];
  sm(mx + 26, my + 196, 118, '震動 ' + shakeNames[combatSettings.shake], 'shake', combatSettings.shake > 0);
  sm(mx + 156, my + 196, 118, '閃光 ' + (combatSettings.flashes ? '完整' : '降低'), 'flashes', combatSettings.flashes);
  sm(mx + 286, my + 196, 118, '數字 ' + (combatSettings.numbers === 'full' ? '完整' : '精簡'), 'numbers', combatSettings.numbers === 'full');
  sm(mx + 416, my + 196, 118, '觸覺 ' + (combatSettings.haptics ? '開' : '關'), 'haptics', combatSettings.haptics);
  const bw = 240, bh = 42, bx1 = W / 2 - bw - 10, bx2 = W / 2 + 10, byy = my + 252;
  const mk = (x, y, label, act, col) => { const b = { x, y, w: bw, h: bh, act }; settingsBtns.push(b); ctx.fillStyle = col || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(label, x + bw / 2, y + 27); };
  mk(bx1, byy, '複製存檔碼', 'copy', 'rgba(125,255,214,0.2)');
  mk(bx2, byy, '匯入存檔', 'import');
  mk(bx1, byy + 52, '改名', 'rename');
  mk(bx2, byy + 52, '更新紀錄 v' + GAME_VERSION, 'updates', 'rgba(185,140,255,0.16)');
  mk(bx1, byy + 104, 'D3 平衡紀錄', 'balance', 'rgba(125,255,214,0.12)');
  mk(bx2, byy + 104, '關閉', 'close', 'rgba(226,59,59,0.2)');
  if (settingsMode) { ctx.fillStyle = '#ffe680'; ctx.font = '12px "Courier New",monospace'; ctx.fillText('（下方輸入框輸入後按 Enter,Esc 取消）', W / 2, my + mh - 12); }
  if (menuMsg) { ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(menuMsg.text, W / 2, my + mh + 22); if (--menuMsg.t <= 0) menuMsg = null; }
  ctx.textAlign = 'left';
}
const tabBtns = [], skillBtns = [], skillActBtns = [], stashBtns = [], stashActBtns = [], activityBtns = [];
let gachaBtn = null;
function dismantleStash(it) {
  const i = meta.stash.indexOf(it);
  if (i < 0) return;
  meta.stash.splice(i, 1);
  for (const part of GEAR_PARTS) if (meta.loadout[part] === it.uid) meta.loadout[part] = null;
  const m = addMat(it.r, it);
  saveMeta();
  menuMsg = { text: '分解 → 強化石+' + m.enh + (m.ench ? ' 附魔塵+' + m.ench : '') + (m.set ? ' 套裝核心+' + m.set : ''), color: '#7dffd6', t: 180 };
  beep(500, 0.1, 'square', 0.03);
}
// ---------- 強化 ----------
const ENH_MAX = 12;
function enhCost(lv) { return lv + 2; }
function enhRate(lv) { return lv < 3 ? 0.9 : lv < 6 ? 0.75 : lv < 9 ? 0.55 : 0.35; }
function enhBoomRate(lv) { return 0.15 + 0.05 * (lv - 8); }
function enhZone(lv) { return lv < 4 ? 'safe' : lv < 8 ? 'down' : 'risk'; }
function gearDesc(it) {
  const e = enhMul(it);
  if (it.kind === 'weapon') return '攻擊+' + Math.round(it.atk * e);
  if (it.kind === 'armor' || it.kind === 'helmet') return 'HP+' + Math.round(it.hp * e) + ' 減傷' + Math.max(1, Math.round(it.def * e));
  if (it.kind === 'boots') return '移速+' + (Math.round(it.spd * e * 10) / 10) + (it.jmp ? ' 跳躍+1' : '');
  if (it.kind === 'acc') return it.crit != null ? '爆擊+' + Math.round(it.crit * e * 100) + '%' : '攻擊+' + Math.round((it.atkMul || 0) * e * 100) + '%';
  return it.desc || '';
}
function gearLabel(it) {
  const affixN = (it.affixes || []).filter(Boolean).length;
  return it.name + ((it.enh || 0) > 0 ? ' +' + it.enh : '') + (affixN ? ' ✦' + affixN : '');
}
let enhAnim = null; // {t, result, uid}
function enhanceGear(it) {
  const lv = it.enh || 0;
  if (lv >= ENH_MAX) { menuMsg = { text: '已達強化上限 +' + ENH_MAX, color: '#ffe680', t: 180 }; return; }
  const cost = enhCost(lv);
  if (meta.mats.enh < cost) { menuMsg = { text: '強化石不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 }; playSfx('uiError'); return; }
  meta.mats.enh -= cost;
  let result;
  if (Math.random() < enhRate(lv)) { it.enh = lv + 1; result = 'success'; }
  else {
    const z = enhZone(lv);
    if (z === 'safe') result = 'keep';
    else if (z === 'down') { it.enh = lv - 1; result = 'down'; }
    else if (Math.random() < enhBoomRate(lv)) result = 'boom';
    else { it.enh = lv - 1; result = 'down'; }
  }
  enhAnim = { t: 70, result: result, uid: it.uid };
  if (result === 'boom') {
    const i = meta.stash.indexOf(it); if (i >= 0) meta.stash.splice(i, 1);
    for (const part of GEAR_PARTS) if (meta.loadout[part] === it.uid) meta.loadout[part] = null;
    selStash = null;
  }
  saveMeta();
  if (result === 'success') playSfx('enhanceSuccess');
  else if (result === 'boom') playSfx('itemBreak');
  else playSfx('enhanceFail');
}
let startBtn = null;
window.addEventListener('keydown', e => {
  unlockAudio();
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  setGameKey(e.key, true);
  const k = e.key.toLowerCase();
  if (settingsOpen) {
    if (k === 'escape' && !settingsMode) {
      if (settingsPage === 'benchmark' || settingsPage === 'bosses') settingsPage = 'balance';
      else if (settingsPage !== 'main') settingsPage = 'main';
      else { settingsOpen = false; closeSaveEdit(); clearGameInputs(); }
    }
    return;
  }
  if (statsOpen) { if (k === 'p' || k === 'escape') { statsOpen = false; clearGameInputs(); } return; }
  if (handleDungeonPanelKey(k)) return;
  if (gameState === 'town') {
    if (chatting) {
      if (k === 'enter') { const t = chatInput.trim(); if (t) sendChat(t); chatInput = ''; chatting = false; }
      else if (k === 'escape') { chatInput = ''; chatting = false; }
      else if (k === 'backspace') chatInput = chatInput.slice(0, -1);
      else if (e.key.length === 1 && chatInput.length < 50) chatInput += e.key;
      e.preventDefault();
      return;
    }
    if (k === 'p') { openStats(); return; }
    if (k === 'enter') { chatting = true; e.preventDefault(); return; }
    return; // 走動/互動由 keys[] + updateTown 處理
  }
  if (gameState === 'select') {
    if (k === '1') chosenCls = 'warrior';
    if (k === '2') chosenCls = 'mage';
    if (k === 'escape' && fromTown) { gameState = 'town'; setHint(HINT_TOWN); return; }
    if (k === 'enter' && menuTab === 'base') resetRun();
    return;
  }
  if (gameState === 'dead') {
    if (k === 'enter' || k === ' ' || k === 'space') { gameState = 'town'; setHint(HINT_TOWN); fromTown = false; }
    return;
  }
  if (gameState === 'pick') {
    if (k === 'r') { rerollPickFromEvent(); return; }
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 3) applyCard(pickOpts[n - 1]);
    return;
  }
  if (eventPanel) {
    if (k === '1' || k === '2' || k === '3') chooseFloorEvent(parseInt(k, 10) - 1);
    else if (k === 'escape') eventPanel = null;
    return;
  }
  // play
  if (k === 'p') { openStats(); return; }
  if (k === 'i') player.itemWin = !player.itemWin;
  if (k === 'escape') player.itemWin = false;
  if (k === 'a') usePot('hp');
  if (k === 's') usePot('mp');
  if (player.itemWin) {
    const n = e.code && e.code.startsWith('Digit') ? parseInt(e.code.slice(5), 10) : parseInt(k, 10);
    if (n >= 1 && n <= player.items.length) {
      const it = player.items[n - 1];
      if (player.eq[it.kind] === it) return;
      if (e.shiftKey) dismantle(it); // Shift+數字 直接分解
      else equipItem(it);
    }
  }
});
window.addEventListener('keyup', e => {
  setGameKey(e.key, false);
});
window.addEventListener('blur', clearGameInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearGameInputs(); });
function handleTap(mx, my) {
  const inside = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  if (handleDungeonPanelTap(mx, my)) return;
  if (eventPanel) {
    for (const b of eventChoiceBtns) if (inside(b)) { chooseFloorEvent(b.choice); return; }
    return;
  }
  if (settingsOpen) {
    for (const b of settingsBtns) if (inside(b)) {
      if (b.act === 'copy') {
        const code = encodeSave();
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => { menuMsg = { text: '已複製到剪貼簿', color: '#7dffd6', t: 200 }; }).catch(() => { menuMsg = { text: '複製失敗,請手動備份', color: '#ff5a5a', t: 200 }; });
        else menuMsg = { text: '此環境不支援自動複製', color: '#ff5a5a', t: 200 };
        return;
      }
      if (b.act === 'import') { startSaveEdit('import'); return; }
      if (b.act === 'rename') { startSaveEdit('rename'); return; }
      if (b.act === 'updates') { settingsPage = 'updates'; settingsUpdateIndex = 0; playSfx('uiSelect'); return; }
      if (b.act === 'updatesOlder') { settingsUpdateIndex = Math.min(GAME_UPDATE_NOTES.length - 1, settingsUpdateIndex + 1); playSfx('uiSelect'); return; }
      if (b.act === 'updatesNewer') { settingsUpdateIndex = Math.max(0, settingsUpdateIndex - 1); playSfx('uiSelect'); return; }
      if (b.act === 'balance') { settingsPage = 'balance'; playSfx('uiSelect'); return; }
      if (b.act === 'balanceNatural') { settingsBalanceMode = 'natural'; playSfx('uiSelect'); return; }
      if (b.act === 'balanceBenchmark') { settingsBalanceMode = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkSetup') { settingsPage = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'bossRecords') { settingsPage = 'bosses'; playSfx('uiSelect'); return; }
      if (b.act === 'bossRecordsBack') { settingsPage = 'balance'; playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkSelect') { settingsBenchmarkIndex = Math.max(0, b.index | 0); playSfx('uiSelect'); return; }
      if (b.act === 'benchmarkStart') {
        const profiles = typeof DUNGEON_BENCHMARK_PROFILES !== 'undefined' ? DUNGEON_BENCHMARK_PROFILES : [];
        if (profiles[settingsBenchmarkIndex]) startDungeonBenchmarkRun(profiles[settingsBenchmarkIndex].id);
        return;
      }
      if (b.act === 'balanceBack') { settingsPage = 'balance'; settingsBalanceMode = 'benchmark'; playSfx('uiSelect'); return; }
      if (b.act === 'settingsBack') { settingsPage = 'main'; playSfx('uiSelect'); return; }
      if (b.act === 'copyBalance') {
        const records = typeof exportDungeonBalanceRecords === 'function' ? exportDungeonBalanceRecords() : '{}';
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(records).then(() => { menuMsg = { text:'測試紀錄已複製', color:'#7dffd6', t:180 }; }).catch(() => { menuMsg = { text:'複製失敗', color:'#ff5a5a', t:180 }; });
        else menuMsg = { text:'此環境不支援自動複製', color:'#ff5a5a', t:180 };
        return;
      }
      if (b.act === 'volDown') { changeSfxVolume(-0.1); return; }
      if (b.act === 'volUp') { changeSfxVolume(0.1); return; }
      if (b.act === 'mute') { toggleSfxMute(); return; }
      if (b.act === 'shake') {
        combatSettings.shake = (combatSettings.shake + 1) % 3; saveCombatSettings();
        triggerCombatFeel('boss', null, { stop:0 }); playSfx('uiSelect'); return;
      }
      if (b.act === 'flashes') { combatSettings.flashes = !combatSettings.flashes; saveCombatSettings(); playSfx('uiSelect'); return; }
      if (b.act === 'numbers') { combatSettings.numbers = combatSettings.numbers === 'full' ? 'compact' : 'full'; saveCombatSettings(); playSfx('uiSelect'); return; }
      if (b.act === 'haptics') { combatSettings.haptics = !combatSettings.haptics; saveCombatSettings(); if (combatSettings.haptics) combatVibrate(15); playSfx('uiSelect'); return; }
      if (b.act === 'close') { settingsOpen = false; settingsPage = 'main'; closeSaveEdit(); clearGameInputs(); return; }
    }
    return; // 設定視窗吃掉所有點擊
  }
  if (statsOpen) { if (inside(statsCloseBtn)) statsOpen = false; return; }
  if ((gameState === 'town' || gameState === 'play') && inside(statsBtn)) { openStats(); return; }
  if (gameState === 'town') {
    const cw = 360, ih = 24, ch = 108, cy = H - ch - ih - 14;
    if (mx >= 14 && mx <= 14 + cw && my >= cy) { // 點聊天框
      if (isTouch) { const t = window.prompt('聊天:'); if (t && t.trim()) sendChat(t.trim()); }
      else chatting = true;
      return;
    }
    const wx = mx + townCamX, wy = my + townCamY; // 點擊走向該世界座標
    townTargetX = Math.max(30, Math.min(TOWN_W - 30, wx));
    townTargetY = Math.max(150, Math.min(TOWN_H - 40, wy));
    townTargetNpc = null;
    for (const n of NPCS) if (Math.hypot(n.x - wx, n.y - wy) < 60) { townTargetNpc = n; townTargetX = n.x; townTargetY = n.y; break; }
    return;
  }
  if (gameState === 'select') {
    if (inside(backTownBtn)) { gameState = 'town'; setHint(HINT_TOWN); return; }
    for (const b of tabBtns) if (inside(b)) { menuTab = b.tab; pendingReset = null; return; }
    if (inside(gearBtn)) { openTownPanel('save'); return; }
    if (menuTab === 'skills') {
      if (inside(gachaBtn)) { drawSkillGacha(); return; }
      for (const b of skillBtns) if (inside(b)) { selSkill = b.id; pendingReset = null; playSfx('uiSelect', 0.7); return; }
      for (const b of skillActBtns) {
        if (!inside(b)) continue;
        if (b.act === 'cls') { chosenCls = b.cls; selSkill = null; pendingReset = null; playSfx('uiSelect', 0.7); return; }
        if (b.act === 'invest') { investTalent(selSkill, b.br); return; }
        if (b.act === 'equip') { toggleLoadout(selSkill); return; }
        if (b.act === 'slot') { assignSkillSlot(selSkill, b.slot); return; }
        if (b.act === 'reset') {
          if (pendingReset && pendingReset.id === selSkill && frame - pendingReset.f < 150) { resetTalent(selSkill); pendingReset = null; }
          else pendingReset = { id: selSkill, f: frame };
          return;
        }
      }
      return;
    }
    if (menuTab === 'stash') {
      for (const b of stashBtns) if (inside(b)) { selStash = b.uid; pendingStashDel = null; return; }
      for (const b of stashActBtns) {
        if (!inside(b)) continue;
        const sel = meta.stash.find(s => s.uid === selStash);
        if (!sel) return;
        if (b.act === 'equip') {
          if (!gearUsableByClass(sel, chosenCls)) { menuMsg = { text:'此裝備限 ' + (sel.cls === 'mage' ? '法師' : '劍士') + ' 使用', color:'#ff8a8a', t:180 }; playSfx('uiError'); return; }
          meta.loadout[sel.kind] = meta.loadout[sel.kind] === sel.uid ? null : sel.uid; saveMeta(); return;
        }
        if (b.act === 'enhance') { enhanceGear(sel); return; }
        if (b.act === 'enchant') { enchantGearSlot(sel, b.slot); return; }
        if (b.act === 'forgeSet') { forgeSetPiece(sel.setId); return; }
        if (b.act === 'dismantle') {
          if (pendingStashDel === sel.uid) { dismantleStash(sel); selStash = null; }
          else pendingStashDel = sel.uid;
          return;
        }
      }
      return;
    }
    if (menuTab === 'activity') {
      for (const b of activityBtns) {
        if (!inside(b)) continue;
        if (b.act === 'task') claimActivityTask(b.scope, b.id);
        else if (b.act === 'milestone') claimActivityMilestone(b.points);
        else if (b.act === 'aura') equipAura(b.id);
        return;
      }
      return;
    }
    for (const b of selBtns) if (inside(b)) { chosenCls = b.cls; return; }
    for (const b of metaBtns) if (inside(b)) {
      if (b.act === 'category') { metaCategory = b.category; playSfx('uiSelect', 0.65); }
      else if (b.d) buyMeta(b.d);
      return;
    }
    if (inside(startBtn)) resetRun();
    return;
  }
  if (gameState === 'dead') { gameState = 'town'; setHint(HINT_TOWN); fromTown = false; return; }
  if (gameState === 'pick') {
    if (pickRerollBtn && inside(pickRerollBtn)) { rerollPickFromEvent(); return; }
    for (const b of pickBtns) if (inside(b)) { applyCard(b.c); return; }
    return;
  }
  if (player.itemWin) {
    for (const b of delBtns) if (inside(b)) {
      if (pendingDel && pendingDel.it === b.it) dismantle(b.it);
      else pendingDel = { it: b.it, f: frame };
      return;
    }
    for (const b of itemBtns) if (inside(b)) { equipItem(b.it); return; }
  }
  if (mx >= 840 && my >= H - 16) player.itemWin = !player.itemWin;
}
cv.addEventListener('mousedown', e => {
  unlockAudio();
  const r = cv.getBoundingClientRect();
  handleTap((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
});

// ---------- touch controls ----------
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const vbtns = [
  { x: 16,  y: 396, w: 74, h: 74, label: '◀', hold: 'arrowleft' },
  { x: 104, y: 396, w: 74, h: 74, label: '▶', hold: 'arrowright' },
  { x: 60,  y: 312, w: 74, h: 74, label: '▼', hold: 'arrowdown' },
  { x: 870, y: 396, w: 74, h: 74, label: '跳', press: 'space' },
  { x: 786, y: 396, w: 74, h: 74, label: 'Z', press: 'z' },
  { x: 702, y: 396, w: 74, h: 74, label: 'X', press: 'x' },
  { x: 618, y: 396, w: 74, h: 74, label: 'C', press: 'c' },
  { x: 550, y: 396, w: 56, h: 74, label: '衝', press: 'shift' },
  { x: 702, y: 330, w: 52, h: 52, label: 'A', tap: () => usePot('hp') },
  { x: 768, y: 330, w: 52, h: 52, label: 'S', tap: () => usePot('mp') },
  { x: 834, y: 330, w: 52, h: 52, label: 'I', tap: () => { player.itemWin = !player.itemWin; } },
  { x: 890, y: 330, w: 52, h: 52, label: 'P', tap: openStats },
];
const touchMap = {}; // touch identifier -> vbtn
function touchPos(t) {
  const r = cv.getBoundingClientRect();
  return [(t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)];
}
function vbtnAt(mx, my) {
  return vbtns.find(b => mx >= b.x - 8 && mx <= b.x + b.w + 8 && my >= b.y - 8 && my <= b.y + b.h + 8);
}
function releaseVbtn(b) {
  if (!b) return;
  if (b.hold) setGameKey(b.hold, false);
  if (b.press) setGameKey(b.press, false);
}
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  unlockAudio();
  for (const t of e.changedTouches) {
    const [mx, my] = touchPos(t);
    if (eventPanel || dungeonPanelOpen()) { handleTap(mx, my); continue; }
    if (gameState === 'play') {
      const b = vbtnAt(mx, my);
      if (b) {
        touchMap[t.identifier] = b;
        if (b.hold) setGameKey(b.hold, true);
        if (b.press) setGameKey(b.press, true);
        if (b.tap) b.tap();
        continue;
      }
    }
    handleTap(mx, my);
  }
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const prev = touchMap[t.identifier];
    if (!prev) continue;
    const [mx, my] = touchPos(t);
    const b = vbtnAt(mx, my);
    if (b !== prev) {
      releaseVbtn(prev);
      delete touchMap[t.identifier];
      if (b && (b.hold || b.press)) {
        touchMap[t.identifier] = b;
        if (b.hold) setGameKey(b.hold, true);
        if (b.press) setGameKey(b.press, true);
      }
    }
  }
}, { passive: false });
function touchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    releaseVbtn(touchMap[t.identifier]);
    delete touchMap[t.identifier];
  }
}
cv.addEventListener('touchend', touchEnd, { passive: false });
cv.addEventListener('touchcancel', touchEnd, { passive: false });
function drawTouchUI() {
  if (!isTouch || gameState !== 'play' || eventPanel || dungeonPanelOpen()) return;
  const held = new Set(Object.values(touchMap));
  ctx.textAlign = 'center';
  for (const b of vbtns) {
    ctx.fillStyle = held.has(b) ? 'rgba(125,255,214,0.35)' : 'rgba(20,22,43,0.35)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(200,205,236,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold ' + (b.w > 60 ? 26 : 18) + 'px "Courier New",monospace';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.w > 60 ? 9 : 6));
  }
  ctx.textAlign = 'left';
}
