"use strict";
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
// Kenney RPG Urban Pack (CC0) tilesheet — 16x16, 27 欄
const tsheet = new Image();
let tsheetReady = false;
if (window.TSHEET_URI) { tsheet.onload = () => { tsheetReady = true; }; tsheet.src = window.TSHEET_URI; }
function drawTile(idx, dx, dy, scale) {
  if (!tsheetReady) return;
  ctx.drawImage(tsheet, (idx % 27) * 16, ((idx / 27) | 0) * 16, 16, 16, Math.round(dx), Math.round(dy), 16 * scale, 16 * scale);
}
// 裝備圖示表(CC0):0劍 1杖 2防具 3頭盔 4鞋子 5紅水 6藍水,每格 32px
const itemsheet = new Image();
let itemsheetReady = false;
if (window.ITEMSHEET_URI) { itemsheet.onload = () => { itemsheetReady = true; }; itemsheet.src = window.ITEMSHEET_URI; }
function itemIconIdx(it) {
  if (it.kind === 'weapon') return it.wpn === 'stave' ? 1 : 0;
  if (it.kind === 'armor') return 2;
  if (it.kind === 'helmet') return 3;
  if (it.kind === 'boots') return 4;
  return -1; // 飾品:程式畫
}
function drawItemIcon(it, x, y, s) { // 在 (x,y) 畫 s×s 圖示
  const idx = itemIconIdx(it);
  if (idx >= 0 && itemsheetReady) { ctx.drawImage(itemsheet, idx * 32, 0, 32, 32, Math.round(x), Math.round(y), s, s); return; }
  // 飾品:金環 + 品質色寶石(明顯是戒指,不像藥水)
  const cx = x + s / 2, cy = y + s / 2;
  ctx.strokeStyle = '#d8b365'; ctx.lineWidth = Math.max(2, s * 0.11);
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.14, s * 0.26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = RARITY_COL[it.r];
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.18, s * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx - s * 0.05, cy - s * 0.23, s * 0.05, 0, Math.PI * 2); ctx.fill();
}
function drawPotionIcon(type, x, y, s) { if (itemsheetReady) ctx.drawImage(itemsheet, (type === 'hp' ? 5 : 6) * 32, 0, 32, 32, Math.round(x), Math.round(y), s, s); }
const W = 960, H = 540;
let worldW = 2000;

function setHint(t) { document.getElementById('hint').innerHTML = t; }
const HINT_PLAY = '← → 移動&nbsp;|&nbsp;Space 跳躍(↓+Space 下跳)&nbsp;|&nbsp;Z / X / C 技能&nbsp;|&nbsp;A 紅水 S 藍水&nbsp;|&nbsp;I 裝備&nbsp;|&nbsp;Esc 關閉';
const HINT_MENU = '[1]/[2] 選職業&nbsp;|&nbsp;點擊購買永久強化&nbsp;|&nbsp;Enter 開始冒險';
const HINT_TOWN = '方向鍵 / WASD 四方向移動 或 點擊地面走動&nbsp;|&nbsp;Space 與 NPC 互動&nbsp;|&nbsp;Enter 或點聊天框 聊天';

// ---------- audio ----------
let audioCtx = null;
function beep(f, d, type, v) {
  if (!audioCtx) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.value = v || 0.035;
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d);
    o.stop(audioCtx.currentTime + d);
  } catch (err) {}
}

// ---------- sprites ----------
const PAL = {
  '1':'#262a40', '2':'#ffffff', '3':'#63cf3c', '9':'#3f9127',
  '4':'#8153e0', '5':'#5636a8', '6':'#ffd9b3', '7':'#232323',
  '8':'#f4c542', 'a':'#a05a2c', 'b':'#d8d4f2', 'c':'#6d5aa8',
  'o':'#ff8c2e', 'y':'#ffd23e', 'r':'#e23b3b', 'm':'#7a4a22',
  'e':'#b05ae0', 'f':'#7a2fa8',
  'g':'#9ab55c', 'p':'#e0687f', 'k':'#6a6a7c', 'i':'#7ec8f0'
};
const RARITY_COL = ['#e8e8e8', '#6f9dff', '#ffd23e', '#c060ff', '#ff8020'];
const RARITY_ABBR = ['普', '精', '稀', '史', '傳'];
const RARITY_NAME = ['普通', '精良', '稀有', '史詩', '傳說'];
const MAGE = [
  "....4444....","...444444...","..44844844..",".4444444444.","...666666...",
  "...676676...","...666666...","..44444444..",".4444444444.",".4444444444.",
  ".4448844444.",".4444444444.","..44444444..","..44....44..","..11....11..","..11....11.."
];
const WAR = [
  "....mmmm....","...mmmmmm...","..mmmmmmmm..","...666666...","...676676...",
  "...666666...","..rrrrrrrr..",".rrrrrrrrrr.",".rrrrrrrrrr.",".rr8888rrr..",
  ".rrrrrrrrrr.","..rrrrrrrr..","..rr....rr..","..11....11..","..11....11..","..11....11.."
];
const SLIME = [
  "............","....3333....","..33333333..",".3333333333.",".3373333733.",
  "333333333333","333393393333",".9999999999."
];
const ESLIME = [
  "............","....eeee....","..eeeeeeee..",".eeeeeeeeee.",".ee7eeee7ee.",
  "eeeeeeeeeeee","eeeefeefeeee",".ffffffffff."
];
const BAT = [
  "c..........c","cc...bb...cc","ccc.bbbb.ccc","ccccbbbbcccc",
  ".cccb7b7ccc.","..ccbbbbcc..","...c.bb.c...","............"
];
const FIRE = [
  ".oyyo.","oyyyyo","yyyyyy","yyyyyy","oyyyyo",".oyyo."
];
const MUSH = [
  "............","...pppppp...","..pppppppp..",".pp2pp2pppp.",
  ".pppppppppp.","....2222....","....2772....","....2222...."
];
const SPORE = [
  "............","....gggg....","...gggggg...","..gg7gg7gg..",
  "..gggggggg..","...gggggg...","....gggg....","..g..gg..g.."
];
const FSLIME = [
  "............","....oooo....","..oooooooo..",".oooooooooo.",".ooyooooyoo.",
  "oooooooooooo","oooorooroooo",".rrrrrrrrrr."
];
const ISLIME = [
  "............","....iiii....","..iiiiiiii..",".iiiiiiiiii.",".ii1iiii1ii.",
  "iiiiiiiiiiii","iiiibiibiiii",".bbbbbbbbbb."
];
const SNOW = [
  "............","....2222....","..22222222..",".2222222222.",".22i2222i22.",
  "222222222222","2222b22b2222",".bbbbbbbbbb."
];
const LIZARD = [
  "............",".rrrrrrrrrr.","ryrrrrrrryr.","rrrrrrrrrrrr","r.rr..rr.rr."
];
const MON_SPRITE = { mush: MUSH, spore: SPORE, bat: BAT, bomber: FSLIME, charger: LIZARD, icer: ISLIME, splitter: SNOW };
function drawSprite(rows, x, y, s, flip, flash, recolor) {
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = flash ? '#ffffff' : (recolor && recolor[ch]) || PAL[ch] || '#f0f';
      const cx = flip ? (w - 1 - c) : c;
      ctx.fillRect(Math.round(x + cx * s), Math.round(y + r * s), s, s);
    }
  }
}

// ---------- meta progression ----------
const meta = {
  souls: 0, up: { atk: 0, vit: 0, pots: 0, treasure: 0, soul: 0 },
  stash: [], mats: { enh: 0, ench: 0 }, stashSeq: 1,
  loadout: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  playerName: '勇者'
};
const GEAR_PARTS = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
const STASH_CAP = 30;
function matFor(r) { return [{ enh: 1, ench: 0 }, { enh: 3, ench: 1 }, { enh: 6, ench: 3 }, { enh: 10, ench: 6 }, { enh: 16, ench: 10 }][r] || { enh: 1, ench: 0 }; }
function addMat(r) { const m = matFor(r); meta.mats.enh += m.enh; meta.mats.ench += m.ench; return m; }
function stashGear(it) { // 存入倉庫;已在庫(開局帶出的)跳過;滿則轉材料
  if (it.uid && meta.stash.some(s => s.uid === it.uid)) return true;
  if (meta.stash.length >= STASH_CAP) { addMat(it.r); return false; }
  it.uid = meta.stashSeq++;
  meta.stash.push(it);
  return true;
}
const META_DEFS = [
  { id:'atk',      name:'攻擊強化', desc:'攻擊 +4%/級',        max:10, cost:l => 20 + l * 15 },
  { id:'vit',      name:'體魄強化', desc:'HP上限 +8%/級',      max:10, cost:l => 20 + l * 15 },
  { id:'pots',     name:'起始藥水', desc:'開局紅藍藥水 +1/級', max:3,  cost:l => 30 + l * 25 },
  { id:'treasure', name:'尋寶直覺', desc:'裝備掉落率 +2%/級',  max:5,  cost:l => 40 + l * 30 },
  { id:'soul',     name:'靈魂共鳴', desc:'靈魂獲取 +10%/級',   max:5,  cost:l => 50 + l * 40 }
];
function buyMeta(d) {
  const lv = meta.up[d.id];
  if (lv >= d.max) return;
  const c = d.cost(lv);
  if (meta.souls < c) { beep(150, 0.1, 'square', 0.04); return; }
  meta.souls -= c; meta.up[d.id]++;
  saveMeta();
  beep(900, 0.08, 'sine', 0.04);
}

// ---------- skills ----------
const SKILL_DEFS = {
  slash:  { cls:'warrior', name:'揮砍',   mp:4,  cd:15,  basic:true, desc:'近戰扇形攻擊,最多3目標' },
  spin:   { cls:'warrior', name:'旋風斬', mp:15, cd:140, desc:'360度範圍攻擊,1.5倍傷害' },
  dash:   { cls:'warrior', name:'突進斬', mp:10, cd:120, desc:'向前衝刺,路徑上1.3倍傷害' },
  quake:  { cls:'warrior', name:'震地波', mp:14, cd:160, desc:'震擊前方地面目標,1.6倍傷害' },
  rage:   { cls:'warrior', name:'狂暴',   mp:18, cd:480, desc:'6秒內傷害+30% 移速+0.8' },
  fire:   { cls:'mage', name:'火球術', mp:8,  cd:22,  basic:true, desc:'直線火球投射物' },
  bolt:   { cls:'mage', name:'落雷術', mp:20, cd:170, desc:'範圍內最多4目標,1.8倍傷害' },
  ice:    { cls:'mage', name:'冰錐術', mp:10, cd:90,  desc:'穿透冰錐,命中緩速敵人' },
  meteor: { cls:'mage', name:'隕石術', mp:25, cd:300, desc:'呼喚3顆隕石,2.2倍範圍傷害' },
  shield: { cls:'mage', name:'魔法盾', mp:16, cd:480, desc:'護盾吸收30%最大HP的傷害' }
};
const SKILL_IDS = Object.keys(SKILL_DEFS); // 存檔順序,固定不可重排
const BRANCH_NAMES = {
  slash:['重擊','連擊'], spin:['龍捲','利刃'], dash:['疾影','破陣'], quake:['餘震','崩裂'], rage:['血怒','戰意'],
  fire:['爆裂','連鎖'], bolt:['雷暴','聚雷'], ice:['霜寒','冰刺'], meteor:['天火','隕擊'], shield:['壁壘','荊棘']
};
const skillState = {}; // id -> {unl, pts, spent, branch(-1未選/0=A/1=B)}
for (const id of SKILL_IDS) skillState[id] = { unl: SKILL_DEFS[id].basic ? 1 : 0, pts: 0, spent: 0, branch: -1 };
const loadouts = { warrior: ['slash', null, null], mage: ['fire', null, null] };
let menuTab = 'base', selSkill = null, pendingReset = null, selStash = null, pendingStashDel = null;
function classSkills(cls) { return SKILL_IDS.filter(id => SKILL_DEFS[id].cls === cls); }
// 天賦倍率(第一批:數值分支。A=範圍/持續流,B=傷害流;里程碑特效後續批次)
function talentOf(id) {
  const s = skillState[id];
  const t = { dmg: 1, area: 1, cd: 1 };
  if (s.spent >= 1) t.dmg *= 1.12;
  if (s.spent >= 2) { if (s.branch === 0) t.area *= 1.25; else t.dmg *= 1.2; }
  if (s.spent >= 3) { if (s.branch === 0) t.area *= 1.2; else t.dmg *= 1.15; }
  if (s.spent >= 4) t.cd *= 0.85;
  if (s.spent >= 5) { if (s.branch === 0) { t.area *= 1.15; t.dmg *= 1.1; } else t.dmg *= 1.18; }
  return t;
}
function drawSkillGacha() {
  const cost = 40;
  if (meta.souls < cost) { menuMsg = { text: '靈魂不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 }; beep(150, 0.1, 'square', 0.04); return; }
  const pool = classSkills(chosenCls).filter(id => !(skillState[id].unl && skillState[id].pts >= 5));
  if (!pool.length) { menuMsg = { text: '此職業技能池已全滿!', color: '#ffe680', t: 240 }; return; }
  meta.souls -= cost;
  const id = pool[(Math.random() * pool.length) | 0];
  const s = skillState[id];
  if (!s.unl) {
    s.unl = 1;
    menuMsg = { text: '★ 習得新技能:' + SKILL_DEFS[id].name, color: '#7dffd6', t: 300 };
    beep(660, 0.1, 'sine', 0.05); setTimeout(() => beep(880, 0.15, 'sine', 0.05), 100);
  } else {
    s.pts++;
    menuMsg = { text: SKILL_DEFS[id].name + ' 天賦點 +1(共 ' + s.pts + ' 點)', color: '#9ecbff', t: 300 };
    beep(700, 0.1, 'sine', 0.04);
  }
  selSkill = id;
  saveMeta();
}
function investTalent(id, branch) {
  const s = skillState[id];
  if (s.spent >= 5 || s.pts - s.spent <= 0) return;
  if (s.spent === 1) { // 第 2 點 = 分支選擇,必須指定
    if (branch !== 0 && branch !== 1) return;
    s.branch = branch;
  }
  s.spent++;
  saveMeta();
  beep(900, 0.08, 'sine', 0.04);
}
function resetTalent(id) {
  const s = skillState[id];
  if (s.spent === 0) return;
  const cost = 30 + 20 * s.spent;
  if (meta.souls < cost) { menuMsg = { text: '靈魂不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 }; beep(150, 0.1, 'square', 0.04); return; }
  meta.souls -= cost;
  s.spent = 0; s.branch = -1;
  menuMsg = { text: SKILL_DEFS[id].name + ' 天賦已重置', color: '#7dffd6', t: 240 };
  saveMeta();
  beep(500, 0.12, 'sine', 0.04);
}
function toggleLoadout(id) {
  const lo = loadouts[chosenCls];
  const i = lo.indexOf(id);
  if (i >= 0) {
    if (lo.filter(Boolean).length <= 1) { menuMsg = { text: '至少要裝備一招技能', color: '#ff5a5a', t: 180 }; return; }
    lo[i] = null;
  } else {
    if (!skillState[id].unl) return;
    const e = lo.indexOf(null);
    if (e < 0) { menuMsg = { text: '出戰欄已滿(3 招)', color: '#ff5a5a', t: 180 }; return; }
    lo[e] = id;
  }
  saveMeta();
}
function skillsToNums() {
  const a = [];
  for (const id of SKILL_IDS) { const t = skillState[id]; a.push(t.unl ? 1 : 0, t.pts, t.spent, t.branch + 1); }
  for (const cls of ['warrior', 'mage']) {
    const list = classSkills(cls);
    for (let i = 0; i < 3; i++) a.push(loadouts[cls][i] ? list.indexOf(loadouts[cls][i]) + 1 : 0);
  }
  return a; // 10技能×4 + 2職業×3槽 = 46
}
function applySkillNums(a) {
  if (!Array.isArray(a) || a.length !== SKILL_IDS.length * 4 + 6) return;
  SKILL_IDS.forEach((id, i) => {
    const s = skillState[id];
    s.unl = SKILL_DEFS[id].basic ? 1 : (a[i * 4] ? 1 : 0);
    s.pts = Math.max(0, Math.min(5, a[i * 4 + 1] | 0));
    s.spent = Math.max(0, Math.min(s.pts, a[i * 4 + 2] | 0));
    s.branch = Math.max(-1, Math.min(1, (a[i * 4 + 3] | 0) - 1));
    if (s.spent >= 2 && s.branch < 0) s.spent = 1; // 沒選分支不可能超過第1點
  });
  let o = SKILL_IDS.length * 4;
  for (const cls of ['warrior', 'mage']) {
    const list = classSkills(cls);
    for (let i = 0; i < 3; i++) {
      const v = a[o++] | 0;
      loadouts[cls][i] = (v >= 1 && v <= list.length && skillState[list[v - 1]].unl) ? list[v - 1] : null;
    }
    if (!loadouts[cls].some(Boolean)) loadouts[cls][0] = list.find(id => SKILL_DEFS[id].basic);
  }
}

// ---------- save ----------
const SAVE_KEY = 'pixelrogue_save';
const UP_IDS = ['atk', 'vit', 'pots', 'treasure', 'soul'];
let bestFloor = 0;
let menuMsg = null; // {text, color, t} 基地畫面的提示訊息
function applyMeta(souls, ups, best) {
  meta.souls = Math.max(0, souls | 0);
  UP_IDS.forEach((id, i) => {
    const def = META_DEFS.find(d => d.id === id);
    meta.up[id] = Math.max(0, Math.min(def.max, ups[i] | 0));
  });
  bestFloor = Math.max(0, best | 0);
}
function saveMeta() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      s: meta.souls, u: UP_IDS.map(id => meta.up[id]), b: bestFloor, k: skillsToNums(),
      st: meta.stash, mt: meta.mats, lo: meta.loadout, sq: meta.stashSeq, pn: meta.playerName
    }));
  } catch (e) {}
}
function loadMeta() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && typeof d.s === 'number' && Array.isArray(d.u)) applyMeta(d.s, d.u, d.b);
    if (d && Array.isArray(d.k)) applySkillNums(d.k);
    if (d && Array.isArray(d.st)) meta.stash = d.st.filter(it => it && GEAR_PARTS.indexOf(it.kind) >= 0);
    if (d && d.mt) meta.mats = { enh: Math.max(0, d.mt.enh | 0), ench: Math.max(0, d.mt.ench | 0) };
    if (d && d.lo) for (const part of GEAR_PARTS) meta.loadout[part] = d.lo[part] || null;
    if (d && d.sq) meta.stashSeq = Math.max(1, d.sq | 0);
    if (d && typeof d.pn === 'string' && d.pn.trim()) meta.playerName = d.pn.slice(0, 12);
  } catch (e) {}
}
function saveChk(a) { let s = 7; for (const v of a) s = (s * 31 + v) % 99991; return s; }
function encodeSave() {
  const a = [2, meta.souls, ...UP_IDS.map(id => meta.up[id]), bestFloor, ...skillsToNums()];
  a.push(saveChk(a));
  return btoa(a.join(','));
}
const V2_LEN = 1 + 1 + 5 + 1 + 46 + 1; // 版本+靈魂+強化5+最深層+技能46+校驗
function decodeSave(str) {
  try {
    const a = atob(String(str).trim()).split(',').map(Number);
    const v1 = a.length === 9 && a[0] === 1;
    const v2 = a.length === V2_LEN && a[0] === 2;
    if ((!v1 && !v2) || a.some(v => !Number.isFinite(v))) return null;
    const chk = a.pop();
    if (saveChk(a) !== chk) return null;
    return a;
  } catch (e) { return null; }
}
function exportSave() {
  const code = encodeSave();
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).catch(() => {});
  window.prompt('你的存檔碼(已嘗試複製到剪貼簿):', code);
  menuMsg = { text: '已產生存檔碼', color: '#7dffd6', t: 240 };
}
function importSave() {
  const str = window.prompt('貼上存檔碼:', '');
  if (!str) return;
  const a = decodeSave(str);
  if (!a) {
    menuMsg = { text: '存檔碼無效', color: '#ff5a5a', t: 240 };
    beep(150, 0.15, 'square', 0.04);
    return;
  }
  applyMeta(a[1], a.slice(2, 7), a[7]);
  if (a[0] >= 2) applySkillNums(a.slice(8, 8 + 46)); // v1 舊碼:技能維持預設
  saveMeta();
  menuMsg = { text: '匯入成功!靈魂 ' + meta.souls, color: '#7dffd6', t: 240 };
  beep(900, 0.1, 'sine', 0.04);
}
loadMeta();

// ---------- state ----------
let gameState = 'select';
let chosenCls = 'warrior';
const CLASSES = { warrior: { name: '劍士', col: '#c84a4a' }, mage: { name: '法師', col: '#5a4ad0' } };
let frame = 0;
let floor = 1, kills = 0, soulsRun = 0, floorT = 0, gearSeq = 1;
let portal = null;
let lastRun = null;
let pendingPicks = 0, pickOpts = [];
let plats = [], mons = [];
const projs = [], dmgNums = [], parts = [], orbs = [], drops = [], gearDrops = [], bolts = [], espits = [], meteors = [];
const clouds = [];
for (let i = 0; i < 12; i++) clouds.push({ x: i * 260 + (i * 97) % 130, y: 40 + (i * 53) % 120, w: 70 + (i * 31) % 60 });

// ---------- biomes(群系:每 5 層一個,決定配色與怪物池)----------
const BIOMES = [
  { name:'翠綠草原', sky:['#87c5f0','#c8e4f5','#e8f4fa'], hill:'#a8d8a0', ground:'#8a5a33', grass:'#59b83a', dot:'#3f9127', cloud:'rgba(255,255,255,0.85)', boss:'草原領主', bcol:'#63cf3c', bcol2:'#3f9127', pool:['slime','slime','bat','mush'] },
  { name:'幽暗洞窟', sky:['#2a3552','#3a4562','#4a5570'], hill:'#38405a', ground:'#463f55', grass:'#6a6a7c', dot:'#4a4a5c', cloud:'rgba(130,135,160,0.35)', boss:'洞窟領主', bcol:'#8a7aa8', bcol2:'#5a4a78', pool:['slime','bat','bat','spore'] },
  { name:'熾熱熔岩', sky:['#5a1e1e','#7a3018','#a84826'], hill:'#4a201c', ground:'#5a2a20', grass:'#8a3220', dot:'#c8461e', cloud:'rgba(255,130,60,0.28)', boss:'熔岩魔王', bcol:'#ff6b2e', bcol2:'#c0301e', pool:['bomber','charger','slime','spore','charger'] },
  { name:'冰霜凍原', sky:['#a4c6e8','#c8dcf0','#eaf4ff'], hill:'#bcd4e4', ground:'#586a7a', grass:'#a8c8e0', dot:'#84a6c6', cloud:'rgba(255,255,255,0.9)', boss:'冰霜領主', bcol:'#9adcf0', bcol2:'#5a9ac0', pool:['icer','splitter','icer','spore','bat'] },
  { name:'虛空深淵', sky:['#180d28','#2a1540','#3a2052'], hill:'#281838', ground:'#382848', grass:'#5a3a7a', dot:'#7c4a9c', cloud:'rgba(130,90,170,0.35)', boss:'深淵魔王', bcol:'#b05ae0', bcol2:'#7a2fa8', pool:['bomber','charger','icer','splitter','bat','spore'] }
];
function biomeOf(f) { return BIOMES[Math.min(BIOMES.length - 1, Math.floor((f - 1) / 5))]; }

const player = {
  x: 80, y: 500, vx: 0, vy: 0, w: 26, h: 46, face: 1,
  onGround: false, dropT: 0, inv: 0, cast: 0, slotCd: [0, 0, 0], walk: 0,
  slashT: 0, spinT: 0, potCd: 0, rageT: 0, shieldHp: 0, shieldT: 0, chillT: 0, cls: 'warrior',
  perk: {}, revives: 0, aegisCd: 0, airJumped: false,
  lv: 1, hp: 100, mhp: 100, mp: 30, mmp: 30, xp: 0,
  bag: { hp: 0, mp: 0 }, eq: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  items: [], itemWin: false,
  cd: { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0 }
};

// ---------- level-up cards ----------
const CARD_RCOL = ['#e8e8e8', '#6f9dff', '#ffd23e']; // 普通/稀有/傳說
const CARD_RNAME = ['普通', '稀有', '傳說'];
const CARDS = [
  // 普通:純數值(走 cd)
  { id:'atk',  r:0, stat:1, name:'力量湧現', desc:'攻擊 +12%' },
  { id:'hp',   r:0, stat:1, name:'巨人體魄', desc:'最大HP +20 並回滿' },
  { id:'crit', r:0, stat:1, name:'致命精準', desc:'爆擊率 +6%' },
  { id:'spd',  r:0, stat:1, name:'疾風步伐', desc:'移動速度 +0.4' },
  { id:'aspd', r:0, stat:1, name:'迅捷出手', desc:'攻擊冷卻 -12%' },
  { id:'xdmg', r:0, stat:1, name:'絕技精通', desc:'技能傷害 +15%' },
  { id:'ls',   r:0, stat:1, name:'嗜血',     desc:'擊殺回復 3 HP' },
  { id:'mp',   r:0, stat:1, name:'心靈之泉', desc:'MP上限+15 回魔+50%' },
  { id:'pot',  r:0, stat:1, name:'藥劑師',   desc:'藥水掉落率 +8%' },
  // 稀有:特殊被動(走 perk)
  { id:'vamp',   r:1, name:'吸血鬼',   desc:'造成傷害回復 6% HP' },
  { id:'thorns', r:1, name:'荊棘護甲', desc:'受擊反彈 40% 攻擊力' },
  { id:'djump',  r:1, name:'羽翼',     desc:'可空中二段跳' },
  { id:'mana',   r:1, name:'法力循環', desc:'擊殺回復 5 MP' },
  { id:'greed',  r:1, name:'貪婪',     desc:'靈魂獲取 +20%' },
  { id:'aegis',  r:1, name:'守護結界', desc:'每12秒獲得護盾' },
  { id:'bloodpact', r:1, name:'血祭', desc:'HP上限-15% 攻擊+30%' },
  // 傳說:強力/獨特(走 perk)
  { id:'berserk', r:2, name:'絕地反擊', desc:'HP<35%時攻擊+50%' },
  { id:'chain',   r:2, name:'連鎖爆炸', desc:'擊殺時範圍爆炸' },
  { id:'phoenix', r:2, name:'不死鳥',   desc:'每場一次致死復活' },
  { id:'brute',   r:2, name:'蠻力',     desc:'攻擊+40% 攻速-18%' },
  { id:'glass',   r:2, name:'玻璃大砲', desc:'攻擊+45% 受傷+25%' }
];
const pickBtns = [];
function perkV(id) { return player.perk[id] || 0; }
function cardLv(c) { return c.stat ? player.cd[c.id] : perkV(c.id); }
const CARD_MAXLV = 5;
function rollPick() {
  const w = c => c.r === 0 ? 10 : c.r === 1 ? 4 + floor * 0.15 : 1 + floor * 0.12;
  const pool = CARDS.filter(c => cardLv(c) < CARD_MAXLV); // 滿等的卡不再抽到
  if (pool.length === 0) { // 全部卡滿等,改給靈魂獎勵
    soulsRun += 3;
    num(player.x, player.y - player.h - 10, '強化全滿級  靈魂 +3', '#7dffd6');
    beep(900, 0.1, 'sine', 0.04);
    if (--pendingPicks > 0) rollPick(); else gameState = 'play';
    return;
  }
  pickOpts = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const tot = pool.reduce((s, c) => s + w(c), 0);
    let roll = Math.random() * tot, idx = 0;
    for (let j = 0; j < pool.length; j++) { roll -= w(pool[j]); if (roll <= 0) { idx = j; break; } }
    pickOpts.push(pool.splice(idx, 1)[0]);
  }
  gameState = 'pick';
}
function applyCard(c) {
  const p = player;
  if (c.stat) p.cd[c.id] = Math.min(CARD_MAXLV, p.cd[c.id] + 1);
  else p.perk[c.id] = Math.min(CARD_MAXLV, (p.perk[c.id] || 0) + 1);
  if (c.id === 'phoenix') p.revives++;
  calcStats();
  if (c.id === 'hp') p.hp = p.mhp;
  num(p.x, p.y - p.h - 10, c.name + '!', CARD_RCOL[c.r]);
  beep(700, 0.08, 'sine', 0.04);
  pendingPicks--;
  if (pendingPicks > 0) rollPick();
  else gameState = 'play';
}

// ---------- derived stats ----------
function enhMul(it) { return it ? 1 + 0.05 * (it.enh || 0) : 1; } // 強化 +5%/級
function eqStat(slot, key) { const it = player.eq[slot]; return it && it[key] ? it[key] * enhMul(it) : 0; }
function accV(f) { return eqStat('acc', f); }
function atkPow() {
  const p = player;
  const base = 8 + p.lv * 2.5 + eqStat('weapon', 'atk') + (p.cls === 'warrior' ? 4 : 0);
  let m = (1 + 0.12 * p.cd.atk) * (1 + 0.04 * meta.up.atk) * (1 + accV('atkMul')) * (p.rageT > 0 ? 1.3 : 1);
  m *= (1 + 0.30 * perkV('bloodpact')) * (1 + 0.40 * perkV('brute')) * (1 + 0.45 * perkV('glass'));
  if (p.hp < p.mhp * 0.35) m *= (1 + 0.50 * perkV('berserk')); // 絕地反擊:低血加成
  return base * m;
}
function critRate() { return 0.08 + 0.06 * player.cd.crit + accV('crit'); }
function armorDef() {
  return Math.round(eqStat('armor', 'def') + eqStat('helmet', 'def'));
}
function moveSpd() { return (3.2 + 0.4 * player.cd.spd + eqStat('boots', 'spd') + (player.rageT > 0 ? 0.8 : 0)) * (player.chillT > 0 ? 0.55 : 1); }
function jumpV() { return 11.5 + (player.eq.boots && player.eq.boots.jmp ? player.eq.boots.jmp : 0); }
function calcStats() {
  const p = player;
  const gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  p.mhp = Math.round((60 + (p.cls === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp) * (1 + 0.08 * meta.up.vit) * Math.max(0.4, 1 - 0.15 * perkV('bloodpact')));
  p.mmp = 30 + (p.cls === 'mage' ? 15 : 0) + p.lv * 4 + 15 * p.cd.mp;
  if (p.hp > p.mhp) p.hp = p.mhp;
  if (p.mp > p.mmp) p.mp = p.mmp;
}
function xpNeed(l) { return 25 + l * 15; }
function playerDmg() {
  const crit = Math.random() < critRate();
  const d = Math.round(atkPow() * (0.85 + Math.random() * 0.3) * (crit ? 1.6 : 1));
  return { d: d, crit: crit };
}
function skillDmg(mult) { // 絕技精通卡:全部出戰技能傷害+15%/層
  const r = playerDmg();
  return { d: Math.max(1, Math.round(r.d * mult * (1 + 0.15 * player.cd.xdmg))), crit: r.crit };
}
function dmgPlayer(d) { // 玩家受傷統一入口(護盾吸收→扣血→死亡)
  const p = player;
  d = Math.round(d * (1 + 0.25 * perkV('glass'))); // 玻璃大砲:受傷放大
  if (perkV('thorns') > 0) { // 荊棘護甲:反彈周圍敵人
    const td = Math.max(1, Math.round(atkPow() * 0.4 * perkV('thorns')));
    for (const o of mons.slice()) {
      if (o.type !== 'boss' && Math.abs(o.x - p.x) < 90 && Math.abs((o.y - o.h / 2) - (p.y - p.h / 2)) < 80) hitMon(o, td, false, true);
    }
  }
  if (p.shieldHp > 0) {
    const ab = Math.min(p.shieldHp, d);
    p.shieldHp -= ab; d -= ab;
    if (p.shieldHp <= 0) num(p.x, p.y - p.h - 24, '護盾破碎', '#7dcfff');
    if (d <= 0) { p.inv = 30; num(p.x, p.y - p.h - 10, '吸收', '#7dcfff'); beep(500, 0.06, 'sine', 0.03); return false; }
  }
  p.hp -= d; p.inv = 60;
  num(p.x, p.y - p.h - 10, '-' + d, '#ff6b6b');
  beep(180, 0.12, 'square', 0.05);
  if (p.hp <= 0) {
    if (p.revives > 0) { // 不死鳥:每場一次致死復活
      p.revives--; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#ffd23e', 30);
      num(p.x, p.y - p.h - 20, '不死鳥復活!', '#ffd23e');
      beep(880, 0.2, 'sine', 0.05); setTimeout(() => beep(1100, 0.2, 'sine', 0.05), 120);
      return false;
    }
    p.hp = 0; burst(p.x, p.y - p.h / 2, '#ff6b6b', 24); endRun(); return true;
  }
  return false;
}
// 技能效果:回傳 false = 施放失敗(不扣MP不進CD)
const SKILL_FX = {
  slash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    beep(500, 0.05, 'square', 0.03);
    let hit = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      const dy = Math.abs((m.y - m.h / 2) - (p.y - p.h / 2));
      if (dx > -12 && dx < 85 * t.area && dy < 55 && hit < 3) {
        hit++;
        const r = skillDmg(t.dmg);
        hitMon(m, r.d, r.crit);
      }
    }
  },
  spin(t) {
    const p = player;
    let hit = 0;
    for (const m of mons.slice()) {
      if (Math.abs(m.x - p.x) < 100 * t.area && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 70 * t.area && hit < 6) {
        hit++;
        const r = skillDmg(1.5 * t.dmg);
        hitMon(m, r.d, r.crit);
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 12; p.spinT = 14;
    beep(300, 0.15, 'sawtooth', 0.05);
  },
  dash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    const x0 = p.x;
    const nx = Math.max(14, Math.min(worldW - 14, p.x + p.face * 130 * t.area));
    const lo2 = Math.min(x0, nx) - 20, hi = Math.max(x0, nx) + 20;
    for (const m of mons.slice()) {
      if (m.x > lo2 && m.x < hi && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 60) {
        const r = skillDmg(1.3 * t.dmg);
        hitMon(m, r.d, r.crit);
      }
    }
    for (let i = 0; i < 8; i++) parts.push({ x: x0 + (nx - x0) * i / 8, y: p.y - 20, vx: 0, vy: -0.5, t: 14, color: '#c8cdec' });
    p.x = nx; p.inv = Math.max(p.inv, 10); // 衝刺短暫無敵
    beep(600, 0.08, 'square', 0.04);
  },
  quake(t) {
    const p = player;
    if (!p.onGround) { num(p.x, p.y - p.h - 10, '需站在地面', '#aaa'); return false; }
    let hit = 0;
    const range = 200 * t.area;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      const grounded = m.type !== 'bat' || m.y > 440;
      if (dx > -10 && dx < range && grounded && Math.abs(m.y - p.y) < 90) {
        hit++;
        const r = skillDmg(1.6 * t.dmg);
        hitMon(m, r.d, r.crit);
        burst(m.x, m.y - m.h / 2, '#d8b365', 8);
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 12;
    for (let i = 1; i < 6; i++) parts.push({ x: p.x + p.face * i * range / 6, y: p.y - 2, vx: 0, vy: -2 - Math.random(), t: 18, color: '#d8b365' });
    beep(120, 0.2, 'sawtooth', 0.05);
  },
  rage(t) {
    const p = player;
    p.rageT = Math.round(360 * t.area);
    p.cast = 8;
    burst(p.x, p.y - p.h / 2, '#ff5a5a', 20);
    beep(200, 0.2, 'square', 0.05);
  },
  fire(t) {
    const p = player;
    p.cast = 12;
    projs.push({ x: p.x + p.face * 20, y: p.y - 30, vx: p.face * 7.5, t: 70, mult: t.dmg, kind: 'fire' });
    beep(880, 0.08, 'sawtooth', 0.03);
  },
  bolt(t) {
    const p = player;
    let hit = 0;
    for (const m of mons.slice()) {
      if (Math.abs(m.x - p.x) < 240 * t.area && hit < 4) {
        hit++;
        bolts.push({ x: m.x, y: m.y - m.h / 2, t: 14 });
        const r = skillDmg(1.8 * t.dmg);
        hitMon(m, r.d, r.crit);
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 14;
    beep(140, 0.25, 'sawtooth', 0.05);
  },
  ice(t) {
    const p = player;
    p.cast = 12;
    projs.push({ x: p.x + p.face * 20, y: p.y - 30, vx: p.face * 6.5, t: 90, mult: t.dmg, kind: 'ice', pierce: true, hits: [] });
    beep(1000, 0.08, 'sine', 0.03);
  },
  meteor(t) {
    const p = player;
    p.cast = 14;
    for (let i = 0; i < 3; i++) {
      meteors.push({
        x: p.x + p.face * (70 + i * 90) + (Math.random() - 0.5) * 30,
        y: 40 - i * 50, vy: 7, r: 55 * t.area, mult: 2.2 * t.dmg
      });
    }
    beep(220, 0.2, 'sawtooth', 0.05);
  },
  shield(t) {
    const p = player;
    p.shieldHp = Math.round(p.mhp * 0.3 * t.dmg); // 傷害天賦→盾量
    p.shieldT = 600;
    p.cast = 10;
    burst(p.x, p.y - p.h / 2, '#7dcfff', 18);
    beep(700, 0.15, 'sine', 0.04);
  }
};
function trySkill(i) {
  const p = player;
  const id = loadouts[p.cls][i];
  if (!id || p.slotCd[i] > 0) return;
  const def = SKILL_DEFS[id];
  if (p.mp < def.mp) { num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff'); p.slotCd[i] = 30; return; }
  const t = talentOf(id);
  if (SKILL_FX[id](t) === false) { p.slotCd[i] = 20; return; }
  p.mp -= def.mp;
  p.slotCd[i] = Math.max(6, Math.round(def.cd * t.cd * Math.pow(0.9, p.cd.aspd) * (1 + 0.18 * perkV('brute'))));
}

// ---------- gear generation ----------
// 裝備命名:品質越高基名越霸氣 + 隨機詞綴,史詩以上加後綴
const GEAR_BASE = {
  weapon: { warrior: ['短劍', '長劍', '闊劍', '斬馬刀', '巨劍'], mage: ['法杖', '魔杖', '咒杖', '秘法杖', '權杖'] },
  armor:  ['皮甲', '鎖甲', '鎧甲', '板甲', '龍鱗甲'],
  helmet: ['皮帽', '鐵盔', '全盔', '頭冠', '龍首盔'],
  boots:  ['布鞋', '皮靴', '戰靴', '疾行靴', '踏空靴'],
  acc:    ['戒指', '項鍊', '護符', '徽章', '聖物']
};
const GEAR_PRE = [
  ['生鏽的', '破舊的', '粗製的'],
  ['鋒利的', '堅固的', '精良的'],
  ['烈焰', '寒霜', '雷鳴', '淬毒'],
  ['巨龍', '暗影', '血色', '風暴'],
  ['弒神', '永恆', '混沌', '天啟']
];
const GEAR_SUF = ['之王', '・末日', '・不朽', '之怒', '・終焉'];
function pick(a) { return a[(Math.random() * a.length) | 0]; }
function gearName(kind, r, cls) {
  const bases = kind === 'weapon' ? GEAR_BASE.weapon[cls] : GEAR_BASE[kind];
  const base = bases[Math.min(r, bases.length - 1)];
  let name = pick(GEAR_PRE[r]) + base;
  if (r >= 3) name += pick(GEAR_SUF);
  return name;
}
function rollRarity(n) {
  const roll = Math.random() + Math.min(0.42, n * 0.022); // 深層加成
  if (roll > 1.36) return 4; // 傳說
  if (roll > 1.16) return 3; // 史詩
  if (roll > 0.92) return 2; // 稀有
  if (roll > 0.62) return 1; // 精良
  return 0;                  // 普通
}
function genGear(n, forceR) {
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
  const slot = slots[(Math.random() * 5) | 0];
  const r = forceR != null ? forceR : rollRarity(n);
  const m = [1, 1.5, 2.1, 2.8, 3.6][r] * (0.85 + Math.random() * 0.3);
  const it = { kind: slot, r: r, id: 'g' + (gearSeq++) };
  if (slot === 'weapon') {
    it.atk = Math.max(1, Math.round((4 + n * 2) * m));
    it.wpn = player.cls === 'mage' ? 'stave' : 'sword';
    it.desc = '攻擊+' + it.atk;
  } else if (slot === 'armor') {
    it.hp = Math.round((16 + n * 6) * m); it.def = Math.max(1, Math.round((1 + n * 0.4) * m));
    it.desc = 'HP+' + it.hp + ' 減傷' + it.def;
  } else if (slot === 'helmet') {
    it.hp = Math.round((10 + n * 4) * m); it.def = Math.max(1, Math.round((0.5 + n * 0.3) * m));
    it.desc = 'HP+' + it.hp + ' 減傷' + it.def;
  } else if (slot === 'boots') {
    it.spd = Math.min(1.5, Math.round((0.2 + n * 0.04) * m * 10) / 10);
    it.jmp = (r >= 2 && Math.random() < 0.5) ? 1 : 0;
    it.desc = '移速+' + it.spd + (it.jmp ? ' 跳躍+1' : '');
  } else {
    if (Math.random() < 0.5) {
      it.crit = Math.round(3 * m) / 100;
      it.desc = '爆擊+' + Math.round(it.crit * 100) + '%';
    } else {
      it.atkMul = Math.round(5 * m) / 100;
      it.desc = '攻擊+' + Math.round(it.atkMul * 100) + '%';
    }
  }
  it.name = gearName(slot, r, player.cls);
  return it;
}
function addGear(it) {
  const p = player;
  if (p.items.length >= 12) {
    const m = addMat(it.r);
    saveMeta();
    num(p.x, p.y - p.h - 10, '背包已滿 → 強化石+' + m.enh, '#7dffd6');
    return;
  }
  p.items.push(it);
  if (!p.eq[it.kind]) { p.eq[it.kind] = it; calcStats(); }
  num(p.x, p.y - p.h - 24, '獲得 ' + it.name, RARITY_COL[it.r]);
  beep(1000, 0.1, 'sine', 0.04);
}
function equipItem(it) {
  player.eq[it.kind] = it;
  calcStats();
  num(player.x, player.y - player.h - 10, '裝備 ' + it.name, RARITY_COL[it.r]);
  beep(820, 0.06, 'sine', 0.03);
}
let pendingDel = null; // {it, f} 兩段式確認:2 秒內再點一次才分解
function dismantle(it) {
  const p = player;
  if (p.eq[it.kind] === it) return; // 裝備中不可分解
  const i = p.items.indexOf(it);
  if (i < 0) return;
  p.items.splice(i, 1);
  const m = addMat(it.r);
  pendingDel = null;
  saveMeta();
  num(p.x, p.y - p.h - 10, '分解 → 強化石+' + m.enh + (m.ench ? ' 附魔塵+' + m.ench : ''), '#7dffd6');
  beep(500, 0.08, 'square', 0.03);
}

// ---------- floor generation ----------
function spawnMon(type, n, sc, xpSc, eliteCh) {
  if (type === 'bat') {
    const bx = 350 + Math.random() * (worldW - 550);
    const by = 170 + Math.random() * 140;
    mons.push({ type:'bat', x: bx, y: by, ax: bx, ay: by, t: Math.random() * 200,
      hp: Math.round(20 * sc), mhp: Math.round(20 * sc), xpv: Math.round(16 * xpSc),
      dmg: Math.round(10 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  const cand = plats.filter(q => q.ground || q.w > 120);
  const pl = cand[(Math.random() * cand.length) | 0];
  const sx = pl.ground ? 350 + Math.random() * (worldW - 550) : pl.x + 30 + Math.random() * (pl.w - 60);
  const minx = Math.max(pl.x + 20, sx - 140), maxx = Math.min(pl.x + pl.w - 20, sx + 140);
  if (type === 'mush') {
    const hp = Math.round(30 * sc);
    mons.push({ type:'mush', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), vy: 0, onG: true, jt: 30 + Math.random() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(14 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'spore') {
    const hp = Math.round(22 * sc);
    mons.push({ type:'spore', x: sx, y: pl.y, vx: (0.3 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1), st: 60 + Math.random() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(18 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'bomber') {
    const hp = Math.round(24 * sc);
    mons.push({ type:'bomber', x: sx, y: pl.y, baseY: pl.y, vx: 0, fuse: null, boom: false,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(7 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'charger') {
    const hp = Math.round(34 * sc);
    mons.push({ type:'charger', x: sx, y: pl.y, vx: (0.4 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), chg: 0, tel: 0, dir: 1,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(9 * sc), w: 36, h: 20, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'icer') {
    const hp = Math.round(28 * sc);
    mons.push({ type:'icer', x: sx, y: pl.y, vx: (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
      minx, maxx, hp, mhp: hp, xpv: Math.round(13 * xpSc), dmg: Math.round(8 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'splitter') {
    const hp = Math.round(30 * sc);
    mons.push({ type:'splitter', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), gen: 0,
      minx, maxx, hp, mhp: hp, xpv: Math.round(15 * xpSc), dmg: Math.round(8 * sc), w: 40, h: 26, hitT: 0, elite: false, s: 4 });
    return;
  }
  const elite = Math.random() < eliteCh;
  const hp = Math.round(26 * sc * (elite ? 3.2 : 1));
  mons.push({ type:'slime', x: sx, y: pl.y, vx: (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
    minx, maxx, hp, mhp: hp, xpv: Math.round(12 * xpSc * (elite ? 3 : 1)),
    dmg: Math.round(8 * sc * (elite ? 1.6 : 1)),
    w: elite ? 46 : 34, h: elite ? 30 : 22, hitT: 0, elite: elite, s: elite ? 4 : 3 });
}
function genFloor(n) {
  if (n % 5 === 0) { genBossFloor(n); return; }
  worldW = Math.min(1600 + n * 120, 2600);
  plats = [{ x: 0, y: 500, w: worldW, ground: true }];
  const rowsY = [405, 325, 250];
  let px = 150;
  while (px < worldW - 260) {
    const pw = 140 + Math.random() * 120;
    if (Math.random() < 0.82) {
      const ri = (Math.random() * 3) | 0;
      plats.push({ x: px, y: rowsY[ri], w: pw });
      // 高層平台在下方補墊腳平台,確保一路跳得上去
      let ux = px, uw = pw;
      for (let r = ri - 1; r >= 0; r--) {
        const near = plats.some(q => !q.ground && q.y === rowsY[r] && q.x < ux + uw + 40 && q.x + q.w > ux - 40);
        if (!near) {
          const sw = 90 + Math.random() * 50;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const sx = Math.max(20, Math.min(worldW - sw - 20, dir < 0 ? ux - sw + 34 : ux + uw - 34));
          plats.push({ x: sx, y: rowsY[r], w: sw });
          ux = sx; uw = sw;
        }
      }
    }
    px += pw + 60 + Math.random() * 130;
  }
  mons = [];
  const count = Math.min(6 + n * 2, 22);
  const sc = (1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1)) * (n >= 21 ? 1.15 : 1); // 線性+二次成長,深淵(21+)再×1.15
  const xpSc = 1 + 0.15 * (n - 1);
  const eliteCh = Math.min(0.08 + 0.025 * n, 0.4);
  const pool = biomeOf(n).pool;
  for (let i = 0; i < count; i++) {
    spawnMon(pool[(Math.random() * pool.length) | 0], n, sc, xpSc, eliteCh);
  }
  portal = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0;
  floorT = 90;
}
function genBossFloor(n) {
  worldW = 1300;
  plats = [{ x: 0, y: 500, w: worldW, ground: true }];
  plats.push({ x: 170, y: 405, w: 150 });
  plats.push({ x: worldW - 320, y: 405, w: 150 });
  plats.push({ x: worldW / 2 - 80, y: 325, w: 160 });
  const sc = (1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1)) * (n >= 21 ? 1.15 : 1);
  const hp = Math.round(300 * sc);
  mons = [{
    type: 'boss', x: worldW - 240, y: 500, vx: 0, vy: 0, t: 0, atkT: 120, tele: 0, phase: 1,
    hp: hp, mhp: hp, xpv: Math.round(150 * (1 + 0.15 * (n - 1))),
    dmg: Math.round(11 * sc), w: 84, h: 56, hitT: 0, elite: true, s: 7
  }];
  portal = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0;
  floorT = 150;
}
function resetRun() {
  const p = player;
  p.cls = chosenCls;
  p.lv = 1; p.xp = 0;
  p.cd = { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0 };
  p.items = []; p.eq = { weapon: null, armor: null, helmet: null, boots: null, acc: null };
  for (const part of GEAR_PARTS) { // 從倉庫穿戴開局裝備(副本帶出,倉庫原件保留)
    const uid = meta.loadout[part];
    const src = uid ? meta.stash.find(s => s.uid === uid) : null;
    if (src) { const cp = Object.assign({}, src); p.items.push(cp); p.eq[part] = cp; }
  }
  p.bag = { hp: meta.up.pots, mp: meta.up.pots };
  p.x = 80; p.y = 500; p.vx = 0; p.vy = 0; p.face = 1;
  p.inv = 0; p.cast = 0; p.slotCd = [0, 0, 0]; p.potCd = 0; p.slashT = 0; p.spinT = 0;
  p.rageT = 0; p.shieldHp = 0; p.shieldT = 0; p.chillT = 0;
  p.perk = {}; p.revives = 0; p.aegisCd = 0; p.airJumped = false;
  p.itemWin = false;
  calcStats();
  p.hp = p.mhp; p.mp = p.mmp;
  floor = 1; kills = 0; soulsRun = 0; gearSeq = 1;
  pendingPicks = 0;
  dmgNums.length = 0; parts.length = 0;
  genFloor(1);
  gameState = 'play';
  setHint(HINT_PLAY);
  beep(660, 0.1, 'sine', 0.04);
  setTimeout(() => beep(880, 0.15, 'sine', 0.04), 100);
}
function endRun() {
  const gained = Math.round(soulsRun * (1 + 0.1 * meta.up.soul) * (1 + 0.2 * perkV('greed')));
  meta.souls += gained;
  let stashed = 0;
  for (const it of player.items) if (stashGear(it)) stashed++; // 背包裝備存入倉庫
  lastRun = { floor: floor, kills: kills, gained: gained, stashed: stashed };
  if (floor > bestFloor) bestFloor = floor;
  saveMeta();
  gameState = 'dead';
  setHint('Enter 返回基地');
  beep(120, 0.4, 'sawtooth', 0.05);
}

// ---------- fx ----------
function num(x, y, text, color) { dmgNums.push({ x: x, y: y, text: text, color: color || '#fff', t: 60 }); }
function burst(x, y, color, n) {
  for (let i = 0; i < (n || 10); i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    parts.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, t: 25 + Math.random() * 15, color: color });
  }
}

// ---------- combat ----------
function removeMon(m) {
  const i = mons.indexOf(m);
  if (i < 0) return;
  mons.splice(i, 1);
  if (mons.length === 0 && !portal) {
    portal = { x: worldW - 70, y: 500 };
    num(player.x, player.y - player.h - 40, '傳送門開啟!', '#b05ae0');
    beep(880, 0.2, 'sine', 0.05);
  }
}
function explodeBomber(m) {
  const p = player;
  burst(m.x, m.y - m.h / 2, '#ff6b2e', 28);
  beep(90, 0.25, 'sawtooth', 0.06);
  let dead = false;
  if (p.inv === 0 && Math.abs(p.x - m.x) < 85 && Math.abs((p.y - p.h / 2) - (m.y - m.h / 2)) < 85) {
    const d = Math.max(1, Math.round(m.dmg * 2.2) - armorDef());
    p.vx = (p.x < m.x ? -1 : 1) * 6.5; p.vy = -6; p.onGround = false;
    dead = dmgPlayer(d);
  }
  removeMon(m);
  return dead;
}
function hitMon(m, d, crit, noChain) {
  m.hp -= d; m.hitT = 8;
  if (perkV('vamp') > 0) player.hp = Math.min(player.mhp, player.hp + d * 0.06 * perkV('vamp')); // 吸血鬼
  num(m.x, m.y - m.h - 8, String(d), crit ? '#ffb020' : '#fff');
  burst(m.x, m.y - m.h / 2, '#ffd23e', 6);
  beep(crit ? 660 : 520, 0.07, 'square');
  if (m.hp <= 0) {
    kills++;
    burst(m.x, m.y - m.h / 2, m.elite ? '#b05ae0' : (m.type === 'slime' ? '#63cf3c' : '#c0aaff'), m.elite ? 24 : 14);
    gainXp(m.xpv);
    if (player.cd.ls > 0) player.hp = Math.min(player.mhp, player.hp + 3 * player.cd.ls);
    if (perkV('mana') > 0) player.mp = Math.min(player.mmp, player.mp + 5 * perkV('mana')); // 法力循環
    if (!noChain && perkV('chain') > 0) { // 連鎖爆炸
      burst(m.x, m.y - m.h / 2, '#ffb020', 18);
      beep(150, 0.12, 'sawtooth', 0.05);
      const cd = Math.round(atkPow() * 1.5 * perkV('chain'));
      for (const o of mons.slice()) {
        if (o !== m && Math.abs(o.x - m.x) < 95 && Math.abs((o.y - o.h / 2) - (m.y - m.h / 2)) < 75) hitMon(o, cd, false, true);
      }
    }
    const orbN = m.type === 'boss' ? 15 : m.elite ? 3 : 1;
    for (let i = 0; i < orbN; i++) {
      orbs.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - m.h, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 2, t: 0 });
    }
    if (Math.random() < 0.13 + 0.08 * player.cd.pot) {
      drops.push({
        x: m.x + 10, y: m.y - m.h, vy: -3.5, vx: (Math.random() - 0.5) * 2,
        type: Math.random() < 0.6 ? 'hp' : 'mp', t: 700, ground: m.type === 'bat' ? 500 : (m.baseY || m.y)
      });
    }
    if (m.type === 'boss') {
      // 保底傳說裝 + 追加一件隨機裝
      gearDrops.push({ x: m.x - 26, y: m.y - m.h, vy: -4, vx: -1.2, it: genGear(floor, floor >= 20 ? 4 : 3), t: 1500, ground: 500 }); // 保底史詩,深層傳說
      gearDrops.push({ x: m.x + 26, y: m.y - m.h, vy: -4, vx: 1.2, it: genGear(floor, 2), t: 1500, ground: 500 });
    } else if (m.elite || Math.random() < Math.min(0.08 + 0.01 * floor + 0.02 * meta.up.treasure, 0.25)) {
      gearDrops.push({
        x: m.x - 10, y: m.y - m.h, vy: -3, vx: (Math.random() - 0.5) * 2,
        it: genGear(floor), t: 900, ground: m.type === 'bat' ? 500 : (m.baseY || m.y)
      });
    }
    mons.splice(mons.indexOf(m), 1);
    beep(220, 0.15, 'sawtooth');
    if (m.type === 'splitter' && (m.gen || 0) < 1) {
      for (let i = 0; i < 2; i++) {
        const shp = Math.round(m.mhp * 0.4);
        const by = m.baseY || m.y;
        mons.push({ type:'splitter', x: m.x + (i ? 20 : -20), y: by, baseY: by,
          vx: (i ? 1 : -1) * (0.6 + Math.random() * 0.4), gen: 1,
          minx: Math.max(20, m.x - 130), maxx: Math.min(worldW - 20, m.x + 130),
          hp: shp, mhp: shp, xpv: Math.round(m.xpv * 0.4), dmg: Math.round(m.dmg * 0.7),
          w: 26, h: 18, hitT: 0, elite: false, s: 3 });
      }
      burst(m.x, m.y - m.h / 2, '#d8f4ff', 12);
    }
    if (mons.length === 0 && !portal) {
      portal = { x: worldW - 70, y: 500 };
      num(player.x, player.y - player.h - 40, '傳送門開啟!', '#b05ae0');
      beep(880, 0.2, 'sine', 0.05);
    }
  }
}
function gainXp(n) {
  const p = player;
  p.xp += n;
  num(p.x, p.y - p.h - 14, '+' + n + ' EXP', '#9ecbff');
  while (p.xp >= xpNeed(p.lv)) {
    p.xp -= xpNeed(p.lv);
    p.lv++;
    pendingPicks++;
    calcStats();
    p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * 0.3));
    p.mp = p.mmp;
    burst(p.x, p.y - p.h / 2, '#ffe680', 30);
    beep(523, 0.12); setTimeout(() => beep(659, 0.12), 110); setTimeout(() => beep(784, 0.2), 220);
  }
  if (pendingPicks > 0 && gameState === 'play') rollPick();
}
function usePot(t) {
  const p = player;
  if (p.potCd > 0) return;
  if (p.bag[t] <= 0) {
    num(p.x, p.y - p.h - 10, t === 'hp' ? '沒有紅色藥水' : '沒有藍色藥水', '#aaa');
    return;
  }
  p.bag[t]--; p.potCd = 30;
  if (t === 'hp') { p.hp = Math.min(p.mhp, p.hp + 60); num(p.x, p.y - p.h - 10, '+60 HP', '#7dff8a'); }
  else { p.mp = Math.min(p.mmp, p.mp + 40); num(p.x, p.y - p.h - 10, '+40 MP', '#7f9cff'); }
  beep(1000, 0.07, 'sine', 0.04);
}

// ---------- input ----------
const keys = {};
const selBtns = [], metaBtns = [], itemBtns = [], delBtns = [];
let expBtn = null, impBtn = null, backTownBtn = null, gearBtn = null;
function drawGear(cx, cy, r, col) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = col;
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillRect(-2, -r - 2, 4, 5); } // 齒
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.fill(); // 外圈
  ctx.fillStyle = '#1a1c2c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill(); // 內孔
  ctx.restore();
}
// ---------- 設定視窗(不用 prompt,畫面內處理)----------
let settingsOpen = false, settingsMode = null; // 'import' | 'rename' | null
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
function renderSettings() {
  settingsBtns.length = 0;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  const mw = 540, mh = 250, mx = W / 2 - mw / 2, my = H / 2 - mh / 2;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 22px "Courier New",monospace'; ctx.fillText('設 定', W / 2, my + 38);
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px "Courier New",monospace'; ctx.fillText('名稱:' + (meta.playerName || '勇者'), W / 2, my + 70);
  ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('存檔碼會自動存於瀏覽器;用「複製」可備份到別的裝置', W / 2, my + 92);
  const bw = 230, bh = 42, bx1 = W / 2 - bw - 10, bx2 = W / 2 + 10, byy = my + 110;
  const mk = (x, y, label, act, col) => { const b = { x, y, w: bw, h: bh, act }; settingsBtns.push(b); ctx.fillStyle = col || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(label, x + bw / 2, y + 27); };
  mk(bx1, byy, '複製存檔碼', 'copy', 'rgba(125,255,214,0.2)');
  mk(bx2, byy, '匯入存檔', 'import');
  mk(bx1, byy + 52, '改名', 'rename');
  mk(bx2, byy + 52, '關閉', 'close', 'rgba(226,59,59,0.2)');
  if (settingsMode) { ctx.fillStyle = '#ffe680'; ctx.font = '12px "Courier New",monospace'; ctx.fillText('（下方輸入框輸入後按 Enter,Esc 取消）', W / 2, my + mh - 12); }
  if (menuMsg) { ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(menuMsg.text, W / 2, my + mh + 22); if (--menuMsg.t <= 0) menuMsg = null; }
  ctx.textAlign = 'left';
}
const tabBtns = [], skillBtns = [], skillActBtns = [], stashBtns = [], stashActBtns = [];
let gachaBtn = null;
function dismantleStash(it) {
  const i = meta.stash.indexOf(it);
  if (i < 0) return;
  meta.stash.splice(i, 1);
  for (const part of GEAR_PARTS) if (meta.loadout[part] === it.uid) meta.loadout[part] = null;
  const m = addMat(it.r);
  saveMeta();
  menuMsg = { text: '分解 → 強化石+' + m.enh + (m.ench ? ' 附魔塵+' + m.ench : ''), color: '#7dffd6', t: 180 };
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
function gearLabel(it) { return it.name + ((it.enh || 0) > 0 ? ' +' + it.enh : ''); }
let enhAnim = null; // {t, result, uid}
function enhanceGear(it) {
  const lv = it.enh || 0;
  if (lv >= ENH_MAX) { menuMsg = { text: '已達強化上限 +' + ENH_MAX, color: '#ffe680', t: 180 }; return; }
  const cost = enhCost(lv);
  if (meta.mats.enh < cost) { menuMsg = { text: '強化石不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 }; beep(150, 0.1, 'square', 0.04); return; }
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
  if (result === 'success') { beep(700, 0.08, 'sine', 0.04); setTimeout(() => beep(950, 0.12, 'sine', 0.04), 90); }
  else if (result === 'boom') { beep(160, 0.1, 'sawtooth', 0.05); setTimeout(() => beep(70, 0.35, 'sawtooth', 0.06), 90); }
  else beep(250, 0.15, 'square', 0.04);
}
let startBtn = null;
window.addEventListener('keydown', e => {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) {} }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  keys[e.key === ' ' ? 'space' : e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (settingsOpen) { if (k === 'escape' && !settingsMode) { settingsOpen = false; closeSaveEdit(); } return; }
  if (gameState === 'town') {
    if (chatting) {
      if (k === 'enter') { const t = chatInput.trim(); if (t) sendChat(t); chatInput = ''; chatting = false; }
      else if (k === 'escape') { chatInput = ''; chatting = false; }
      else if (k === 'backspace') chatInput = chatInput.slice(0, -1);
      else if (e.key.length === 1 && chatInput.length < 50) chatInput += e.key;
      e.preventDefault();
      return;
    }
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
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 3) applyCard(pickOpts[n - 1]);
    return;
  }
  // play
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
  keys[e.key === ' ' ? 'space' : e.key.toLowerCase()] = false;
});
function handleTap(mx, my) {
  const inside = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
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
      if (b.act === 'close') { settingsOpen = false; closeSaveEdit(); return; }
    }
    return; // 設定視窗吃掉所有點擊
  }
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
      for (const b of skillBtns) if (inside(b)) { selSkill = b.id; pendingReset = null; return; }
      for (const b of skillActBtns) {
        if (!inside(b)) continue;
        if (b.act === 'cls') { chosenCls = b.cls; selSkill = null; pendingReset = null; return; }
        if (b.act === 'invest') { investTalent(selSkill, b.br); return; }
        if (b.act === 'equip') { toggleLoadout(selSkill); return; }
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
        if (b.act === 'equip') { meta.loadout[sel.kind] = meta.loadout[sel.kind] === sel.uid ? null : sel.uid; saveMeta(); return; }
        if (b.act === 'enhance') { enhanceGear(sel); return; }
        if (b.act === 'dismantle') {
          if (pendingStashDel === sel.uid) { dismantleStash(sel); selStash = null; }
          else pendingStashDel = sel.uid;
          return;
        }
      }
      return;
    }
    for (const b of selBtns) if (inside(b)) { chosenCls = b.cls; return; }
    for (const b of metaBtns) if (inside(b)) { buyMeta(b.d); return; }
    if (inside(startBtn)) resetRun();
    return;
  }
  if (gameState === 'dead') { gameState = 'town'; setHint(HINT_TOWN); fromTown = false; return; }
  if (gameState === 'pick') {
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
  { x: 786, y: 396, w: 74, h: 74, label: 'Z', hold: 'z' },
  { x: 702, y: 396, w: 74, h: 74, label: 'X', hold: 'x' },
  { x: 618, y: 396, w: 74, h: 74, label: 'C', hold: 'c' },
  { x: 702, y: 330, w: 52, h: 52, label: 'A', tap: () => usePot('hp') },
  { x: 768, y: 330, w: 52, h: 52, label: 'S', tap: () => usePot('mp') },
  { x: 834, y: 330, w: 52, h: 52, label: 'I', tap: () => { player.itemWin = !player.itemWin; } },
];
const touchMap = {}; // touch identifier -> vbtn
function touchPos(t) {
  const r = cv.getBoundingClientRect();
  return [(t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)];
}
function vbtnAt(mx, my) {
  return vbtns.find(b => mx >= b.x - 8 && mx <= b.x + b.w + 8 && my >= b.y - 8 && my <= b.y + b.h + 8);
}
function releaseVbtn(b) { if (b && b.hold) keys[b.hold] = false; }
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) {} }
  for (const t of e.changedTouches) {
    const [mx, my] = touchPos(t);
    if (gameState === 'play') {
      const b = vbtnAt(mx, my);
      if (b) {
        touchMap[t.identifier] = b;
        if (b.hold) keys[b.hold] = true;
        if (b.press) keys[b.press] = true;
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
      if (b && b.hold) { keys[b.hold] = true; touchMap[t.identifier] = b; }
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
  if (!isTouch || gameState !== 'play') return;
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

// ---------- update ----------
function update() {
  const p = player;
  if (p.inv > 0) p.inv--;
  if (p.potCd > 0) p.potCd--;
  for (let i = 0; i < 3; i++) if (p.slotCd[i] > 0) p.slotCd[i]--;
  if (p.rageT > 0) p.rageT--;
  if (p.chillT > 0) p.chillT--;
  if (p.shieldT > 0) { p.shieldT--; if (p.shieldT === 0) p.shieldHp = 0; }
  if (perkV('aegis') > 0) { // 守護結界:每12秒補護盾
    if (p.aegisCd > 0) p.aegisCd--;
    if (p.aegisCd <= 0) {
      p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.15 * perkV('aegis')));
      p.shieldT = Math.max(p.shieldT, 900);
      p.aegisCd = 720;
    }
  }
  if (p.cast > 0) p.cast--;
  if (p.dropT > 0) p.dropT--;
  if (p.slashT > 0) p.slashT--;
  if (p.spinT > 0) p.spinT--;
  if (floorT > 0) floorT--;

  // movement
  let mv = 0;
  if (keys['arrowleft']) mv = -1;
  if (keys['arrowright']) mv = 1;
  if (mv !== 0) { p.face = mv; p.walk++; } else p.walk = 0;
  p.vx = mv * moveSpd();
  if (keys['space']) {
    if (p.onGround) {
      p.airJumped = false;
      if (keys['arrowdown']) {
        const cur = plats.find(q => !q.ground && Math.abs(p.y - q.y) < 2 && p.x > q.x - 5 && p.x < q.x + q.w + 5);
        if (cur) { p.dropT = 18; p.onGround = false; p.vy = 2; }
        else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
      } else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
      keys['space'] = false;
    } else if (perkV('djump') > 0 && !p.airJumped) { // 羽翼:二段跳
      p.vy = -jumpV() * 0.9; p.airJumped = true;
      burst(p.x, p.y - p.h / 2, '#c8f4ff', 8);
      beep(340, 0.06, 'triangle', 0.02);
      keys['space'] = false;
    }
  }
  const oldY = p.y;
  p.vy += 0.6; if (p.vy > 14) p.vy = 14;
  p.x += p.vx; p.y += p.vy;
  if (p.x < 14) p.x = 14;
  if (p.x > worldW - 14) p.x = worldW - 14;
  p.onGround = false;
  if (p.vy >= 0) {
    for (const q of plats) {
      if (oldY <= q.y + 0.01 && p.y >= q.y && p.x > q.x - 6 && p.x < q.x + q.w + 6) {
        if (!q.ground && p.dropT > 0) continue;
        p.y = q.y; p.vy = 0; p.onGround = true; p.airJumped = false;
        break;
      }
    }
  }
  if (p.y > 600) { p.y = 500; p.vy = 0; p.onGround = true; p.airJumped = false; }

  // portal
  if (portal && Math.abs(p.x - portal.x) < 26 && p.y > 440) {
    floor++;
    p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * 0.15));
    genFloor(floor);
    p.x = 80; p.y = 500; p.vy = 0;
    num(p.x, p.y - p.h - 20, '第 ' + floor + ' 層', '#b05ae0');
    beep(660, 0.15, 'sine', 0.05);
    return;
  }

  // skills(出戰槽 Z/X/C)
  if (keys['z']) trySkill(0);
  if (keys['x']) trySkill(1);
  if (keys['c']) trySkill(2);

  // projectiles
  for (const pr of projs.slice()) {
    pr.x += pr.vx; pr.t--;
    let gone = pr.t <= 0;
    for (const m of mons) {
      if (pr.pierce && pr.hits.indexOf(m) >= 0) continue;
      if (Math.abs(pr.x - m.x) < m.w / 2 + 8 && Math.abs(pr.y - (m.y - m.h / 2)) < m.h / 2 + 10) {
        const r = skillDmg(pr.mult || 1);
        hitMon(m, r.d, r.crit);
        if (pr.kind === 'ice') {
          m.slowT = 180;
          burst(pr.x, pr.y, '#7dcfff', 8);
          pr.hits.push(m);
        } else {
          burst(pr.x, pr.y, '#ff8c2e', 10);
          gone = true; break;
        }
      }
    }
    if (gone) projs.splice(projs.indexOf(pr), 1);
  }

  // 隕石
  for (const mt of meteors.slice()) {
    mt.y += mt.vy;
    if (!mt.hits) mt.hits = [];
    parts.push({ x: mt.x + (Math.random() - 0.5) * 10, y: mt.y - 10, vx: 0, vy: -1, t: 10, color: '#ff8c2e' });
    // 下墜途中撞到怪就打(涵蓋平台上/空中的怪),每顆隕石對同隻只打一次
    for (const m of mons) {
      if (mt.hits.indexOf(m) >= 0) continue;
      if (Math.abs(m.x - mt.x) < mt.r * 0.5 + m.w / 2 && Math.abs(mt.y - (m.y - m.h / 2)) < m.h / 2 + 24) {
        const r = skillDmg(mt.mult); hitMon(m, r.d, r.crit); mt.hits.push(m);
      }
    }
    if (mt.y >= 495) {
      burst(mt.x, 495, '#ff8c2e', 20);
      beep(100, 0.2, 'sawtooth', 0.05);
      for (const m of mons.slice()) { // 落地範圍爆炸,補打附近地面怪
        if (mt.hits.indexOf(m) >= 0) continue;
        if (Math.abs(m.x - mt.x) < mt.r + m.w / 2 && Math.abs(m.y - 500) < 130) {
          const r = skillDmg(mt.mult); hitMon(m, r.d, r.crit);
        }
      }
      meteors.splice(meteors.indexOf(mt), 1);
    }
  }

  // monsters
  for (const m of mons) {
    if (m.hitT > 0) m.hitT--;
    if (m.slowT > 0) m.slowT--;
    const slowF = m.slowT > 0 ? 0.5 : 1;
    if (m.type === 'slime' || m.type === 'icer' || m.type === 'splitter') {
      m.x += m.vx * slowF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
    } else if (m.type === 'mush') {
      m.x += m.vx * slowF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
      m.jt--;
      if (m.jt <= 0 && m.onG) { m.vy = -8.5; m.onG = false; m.jt = 70 + Math.random() * 40; }
      if (!m.onG) {
        m.vy += 0.5; m.y += m.vy;
        if (m.y >= m.baseY) { m.y = m.baseY; m.vy = 0; m.onG = true; }
      }
    } else if (m.type === 'spore') {
      m.x += m.vx * 0.5 * slowF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
      m.st--;
      if (m.st <= 0 && Math.abs(p.x - m.x) < 420 && p.y > 300) {
        espits.push({ x: m.x, y: m.y - m.h + 4, vx: (p.x - m.x) / 65, vy: -3.5, dmg: Math.round(m.dmg * 0.8) });
        m.st = 110;
        beep(400, 0.08, 'square', 0.03);
      }
    } else if (m.type === 'bomber') {
      const dir = p.x < m.x ? -1 : 1;
      m.x += dir * 1.4 * slowF;
      if (m.fuse != null) {
        m.fuse--;
        if (m.fuse <= 0) m.boom = true;
        else if (Math.floor(m.fuse / 4) % 2 === 0) m.hitT = 2; // 引信閃爍預警
      } else if (Math.abs(m.x - p.x) < 48 && Math.abs(m.y - p.y) < 60) {
        m.fuse = 30;
      }
    } else if (m.type === 'charger') {
      if (m.chg > 0) {
        m.chg--;
        m.x += m.dir * 7.5 * slowF;
        if (m.x < 40) { m.x = 40; m.chg = 0; }
        if (m.x > worldW - 40) { m.x = worldW - 40; m.chg = 0; }
        if (m.chg === 0) { m.minx = Math.max(20, m.x - 140); m.maxx = Math.min(worldW - 20, m.x + 140); } // 衝刺後巡邏範圍跟到當前位置,避免瞬移
      } else if (m.tel > 0) {
        m.tel--; m.hitT = 2;
        if (m.tel === 0) { m.chg = 26; beep(300, 0.1, 'sawtooth', 0.04); }
      } else {
        m.x += m.vx * slowF;
        if (m.x < m.minx) m.vx = Math.abs(m.vx); // 軟反彈,不設值避免瞬移
        if (m.x > m.maxx) m.vx = -Math.abs(m.vx);
        if (Math.abs(p.y - m.y) < 46 && Math.abs(p.x - m.x) < 320) { m.dir = p.x < m.x ? -1 : 1; m.tel = 28; }
      }
    } else if (m.type === 'boss') {
      m.t++;
      const ph = m.hp / m.mhp > 0.6 ? 1 : m.hp / m.mhp > 0.3 ? 2 : 3;
      if (ph > m.phase) { m.phase = ph; burst(m.x, m.y - m.h / 2, '#ff5a5a', 30); beep(200, 0.3, 'sawtooth', 0.06); }
      const dir = p.x < m.x ? -1 : 1;
      const grounded = m.y >= 500 && m.vy >= 0;
      if (m.atkT > 0) {
        m.atkT--;
        if (grounded) m.vx = dir * (ph === 1 ? 0.8 : ph === 2 ? 1.2 : 1.7); // 追著玩家走
      } else if (m.tele > 0) {
        m.tele--; m.vx = 0; // 蓄力預告(頭上會顯示 !)
        if (m.tele === 0 && grounded) {
          m.vy = ph === 3 ? -11.5 : -9; // 跳撲
          m.vx = dir * (2.6 + ph * 0.8);
          if (ph >= 2) { // 二階段起加吐毒彈(扇形,按群系微調)
            const bb = biomeOf(floor);
            const hot = bb.name === '熾熱熔岩' || bb.name === '虛空深淵';
            const chill = bb.name === '冰霜凍原';
            const nsp = (ph === 3 ? 5 : 3) + (hot ? 2 : 0);
            const vsc = hot ? 1.25 : 1; // 熔岩彈更快
            for (let i = 0; i < nsp; i++) {
              espits.push({
                x: m.x, y: m.y - m.h + 6,
                vx: ((p.x - m.x) / 55 + (i - (nsp - 1) / 2) * 1.1) * vsc,
                vy: -6 - Math.random() * 2, dmg: Math.round(m.dmg * 0.7), chill: chill, col: bb.bcol
              });
            }
            beep(320, 0.12, 'square', 0.04);
          }
          m.atkT = ph === 1 ? 140 : ph === 2 ? 105 : 80;
        }
      } else if (grounded) {
        m.tele = 36;
      }
      m.vy += 0.6; if (m.vy > 14) m.vy = 14;
      m.x += m.vx * slowF; m.y += m.vy;
      if (m.x < 60) m.x = 60;
      if (m.x > worldW - 60) m.x = worldW - 60;
      if (m.y >= 500) {
        if (m.vy > 3 && ph === 3) { // 狂暴期落地震波
          burst(m.x, 500, '#b05ae0', 26);
          beep(90, 0.2, 'sawtooth', 0.06);
          if (p.onGround && Math.abs(p.x - m.x) < 150 && p.inv === 0) {
            const d = Math.max(1, Math.round(m.dmg * 0.9) - armorDef());
            p.vx = (p.x < m.x ? -1 : 1) * 6; p.vy = -6; p.onGround = false;
            if (dmgPlayer(d)) return;
          }
        }
        m.y = 500; m.vy = 0;
      }
    } else {
      m.t++;
      const ddx = p.x - m.x, ddy = (p.y - 26) - m.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist < 360) {
        // 俯衝追擊玩家
        const sp = Math.min(2.2, 1.1 + floor * 0.06) * slowF;
        m.x += ddx / dist * sp + Math.sin(m.t * 0.15) * 0.5;
        m.y += ddy / dist * sp + Math.cos(m.t * 0.13) * 0.5;
        m.vx = ddx;
      } else {
        // 緩慢飄回巡邏點
        const bx2 = m.ax + Math.sin(m.t * 0.02) * 90;
        const by2 = m.ay + Math.sin(m.t * 0.055) * 34;
        m.x += (bx2 - m.x) * 0.03;
        m.y += (by2 - m.y) * 0.03;
      }
      if (m.y > 480) m.y = 480;
    }
    if (p.inv === 0 &&
        Math.abs(m.x - p.x) < (m.w + p.w) / 2 - 4 &&
        Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < (m.h + p.h) / 2 - 6) {
      const d = Math.max(1, Math.round(m.dmg * (0.9 + Math.random() * 0.2)) - armorDef());
      p.vx = (p.x < m.x ? -1 : 1) * 5; p.vy = -5; p.onGround = false;
      if (m.type === 'icer') { p.chillT = 120; num(p.x, p.y - p.h - 24, '凍結', '#7ec8f0'); }
      if (dmgPlayer(d)) return;
    }
  }
  // bomber 引爆(loop 外處理,避免遍歷中 splice)
  for (const m of mons.slice()) {
    if (m.boom) { if (explodeBomber(m)) return; }
  }

  // boss 毒彈
  for (const s of espits.slice()) {
    s.vy += 0.25; s.x += s.vx; s.y += s.vy;
    if (p.inv === 0 && Math.abs(s.x - p.x) < 15 && Math.abs(s.y - (p.y - p.h / 2)) < p.h / 2 + 8) {
      const d = Math.max(1, s.dmg - armorDef());
      if (s.chill) { p.chillT = 150; num(p.x, p.y - p.h - 24, '凍結', '#7ec8f0'); }
      espits.splice(espits.indexOf(s), 1);
      if (dmgPlayer(d)) return;
      continue;
    }
    if (s.y > 505 || s.x < -20 || s.x > worldW + 20) {
      burst(s.x, Math.min(s.y, 500), '#8a5adf', 5);
      espits.splice(espits.indexOf(s), 1);
    }
  }

  // soul orbs
  for (const o of orbs.slice()) {
    o.t++;
    if (o.t < 16) { o.vy += 0.3; o.x += o.vx; o.y += o.vy; }
    else {
      const dx = p.x - o.x, dy = (p.y - 24) - o.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = Math.min(9, 3 + o.t * 0.12);
      o.x += dx / dist * sp; o.y += dy / dist * sp;
      if (dist < 22) {
        soulsRun++;
        parts.push({ x: o.x, y: o.y, vx: 0, vy: -1, t: 12, color: '#7dffd6' });
        orbs.splice(orbs.indexOf(o), 1);
      }
    }
  }

  // potion drops
  for (const d of drops.slice()) {
    d.t--; d.vy += 0.5; d.y += d.vy; d.x += d.vx;
    if (d.y > d.ground) { d.y = d.ground; d.vy = 0; d.vx = 0; }
    if (Math.abs(d.x - p.x) < 24 && Math.abs(d.y - p.y) < 40) {
      p.bag[d.type]++;
      num(d.x, d.y - 20, '獲得 ' + (d.type === 'hp' ? '紅色藥水' : '藍色藥水'), d.type === 'hp' ? '#ff8a8a' : '#8aa8ff');
      beep(1100, 0.06, 'sine', 0.04);
      drops.splice(drops.indexOf(d), 1);
    } else if (d.t <= 0) drops.splice(drops.indexOf(d), 1);
  }
  // gear drops
  for (const g of gearDrops.slice()) {
    g.t--; g.vy += 0.5; g.y += g.vy; g.x += g.vx;
    if (g.y > g.ground) { g.y = g.ground; g.vy = 0; g.vx = 0; }
    if (Math.abs(g.x - p.x) < 26 && Math.abs(g.y - p.y) < 40) {
      addGear(g.it);
      gearDrops.splice(gearDrops.indexOf(g), 1);
    } else if (g.t <= 0) gearDrops.splice(gearDrops.indexOf(g), 1);
  }

  // fx timers
  for (const d of dmgNums.slice()) { d.t--; d.y -= 0.7; if (d.t <= 0) dmgNums.splice(dmgNums.indexOf(d), 1); }
  for (const q of parts.slice()) { q.t--; q.x += q.vx; q.y += q.vy; q.vy += 0.15; if (q.t <= 0) parts.splice(parts.indexOf(q), 1); }
  for (const b of bolts.slice()) { b.t--; if (b.t <= 0) bolts.splice(bolts.indexOf(b), 1); }

  // regen
  if (p.hp < p.mhp) p.hp = Math.min(p.mhp, p.hp + 0.008);
  if (p.mp < p.mmp) p.mp = Math.min(p.mmp, p.mp + 0.05 * (1 + 0.5 * p.cd.mp));
}

// ---------- render ----------
let camX = 0;
function render() {
  const p = player;
  camX += ((Math.max(0, Math.min(worldW - W, p.x - W / 2))) - camX) * 0.12;

  const bi = biomeOf(floor);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bi.sky[0]); g.addColorStop(0.7, bi.sky[1]); g.addColorStop(1, bi.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bi.cloud;
  for (const c of clouds) {
    const cx = ((c.x - camX * 0.3) % (worldW * 0.5) + worldW * 0.5) % (worldW * 0.5) - 100;
    ctx.fillRect(cx, c.y, c.w, 14);
    ctx.fillRect(cx + 10, c.y - 8, c.w - 24, 10);
  }
  ctx.fillStyle = bi.hill;
  for (let i = 0; i < 8; i++) {
    const hx = i * 400 - (camX * 0.5) % 400 - 200;
    ctx.beginPath(); ctx.arc(hx + 200, 520, 150, Math.PI, 0); ctx.fill();
  }
  // depth tint(群系內每層漸深,換群系重置)
  const tint = 0.05 * ((floor - 1) % 5);
  if (tint > 0) { ctx.fillStyle = 'rgba(10,6,20,' + tint.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }

  ctx.save();
  ctx.translate(-Math.round(camX), 0);

  // platforms(群系配色)
  for (const q of plats) {
    const hgt = q.ground ? H - q.y : 14;
    ctx.fillStyle = bi.ground; ctx.fillRect(q.x, q.y, q.w, hgt);
    ctx.fillStyle = bi.grass; ctx.fillRect(q.x, q.y, q.w, 6);
    ctx.fillStyle = bi.dot;
    for (let x = q.x; x < q.x + q.w; x += 18) ctx.fillRect(x + 6, q.y + 4, 6, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(q.x, q.y + 6, q.w, 3);
  }
  // portal
  if (portal) {
    const ph = 64, pw = 40;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (Math.floor(frame / 8) + i) % 2 === 0 ? '#b05ae0' : '#7dffd6';
      ctx.fillRect(portal.x - pw / 2 + i * 4, portal.y - ph + i * 6, pw - i * 8, ph - i * 10);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('下一層', portal.x, portal.y - ph - 8);
  }
  // gear drops
  for (const gd of gearDrops) {
    const blink = gd.t < 150 && Math.floor(gd.t / 8) % 2 === 0;
    if (!blink) {
      const r = gd.it.r, col = RARITY_COL[r];
      if (r >= 2) { // 稀有以上:發光柱,越高越亮
        const gl = 0.12 + 0.06 * r + Math.sin(frame * 0.12) * 0.05;
        ctx.fillStyle = col; ctx.globalAlpha = gl;
        ctx.fillRect(gd.x - 3 - r, gd.y - 120, 6 + 2 * r, 120);
        ctx.globalAlpha = 1;
      }
      const bob = Math.sin(frame * 0.15) * 2;
      const iy = gd.y - 26 + bob, sz = 20;
      // 品質色底光
      ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.ellipse(gd.x, gd.y - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      drawItemIcon(gd.it, gd.x - sz / 2, iy, sz);
    }
  }
  // potion drops
  for (const d of drops) {
    const blink = d.t < 120 && Math.floor(d.t / 8) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = d.type === 'hp' ? '#e23b3b' : '#3b6fe2';
      ctx.fillRect(d.x - 4, d.y - 12, 8, 10);
      ctx.fillStyle = '#ddd'; ctx.fillRect(d.x - 2, d.y - 15, 4, 3);
    }
  }
  // soul orbs
  for (const o of orbs) {
    ctx.fillStyle = Math.floor(frame / 6) % 2 === 0 ? '#7dffd6' : '#b7fff0';
    ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
    ctx.fillRect(o.x - 1, o.y - 5, 2, 10);
  }
  // monsters
  for (const m of mons) {
    const rows = MON_SPRITE[m.type] || (m.elite ? ESLIME : SLIME);
    const rc = m.type === 'boss' ? { e: bi.bcol, f: bi.bcol2 } : null;
    drawSprite(rows, m.x - rows[0].length * m.s / 2, m.y - rows.length * m.s, m.s, m.vx < 0, m.hitT > 0, rc);
    if (m.type === 'boss' && m.tele > 0 && Math.floor(m.tele / 5) % 2 === 0) {
      ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 26px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('!', m.x, m.y - m.h - 18);
      ctx.textAlign = 'left';
    }
    if (m.hp < m.mhp && m.type !== 'boss') {
      const bw = m.elite ? 44 : 34;
      ctx.fillStyle = '#222'; ctx.fillRect(m.x - bw / 2, m.y - m.h - 12, bw, 5);
      ctx.fillStyle = m.elite ? '#b05ae0' : '#e23b3b';
      ctx.fillRect(m.x - bw / 2 + 1, m.y - m.h - 11, (bw - 2) * Math.max(0, m.hp / m.mhp), 3);
    }
  }
  // boss/孢子 彈幕(群系色)
  for (const s of espits) {
    ctx.fillStyle = s.col || '#8a5adf'; ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  // player
  if (p.inv === 0 || Math.floor(p.inv / 5) % 2 === 0) {
    const s = 3;
    const bob = (p.onGround && p.walk > 0) ? (Math.floor(p.walk / 6) % 2) : 0;
    drawSprite(p.cls === 'mage' ? MAGE : WAR, p.x - 18, p.y - 48 + bob, s, p.face < 0);
    const sx = p.x + p.face * 14;
    if (p.cls === 'mage') {
      const orb = p.eq.weapon ? RARITY_COL[p.eq.weapon.r] : '#f2c14e';
      ctx.fillStyle = PAL['a'];
      if (p.cast > 0) {
        ctx.fillRect(sx - 2, p.y - 58, 4, 30);
        ctx.fillStyle = orb; ctx.fillRect(sx - 4, p.y - 64, 8, 8);
        ctx.fillStyle = 'rgba(255,210,62,0.5)'; ctx.fillRect(sx - 7, p.y - 67, 14, 14);
      } else {
        ctx.fillRect(sx - 2, p.y - 40, 4, 26);
        ctx.fillStyle = orb; ctx.fillRect(sx - 4, p.y - 46, 8, 8);
      }
    } else {
      const blade = p.eq.weapon ? RARITY_COL[p.eq.weapon.r] : '#b89a6a';
      if (p.cast > 0) {
        ctx.fillStyle = blade;
        ctx.fillRect(p.face > 0 ? p.x + 12 : p.x - 40, p.y - 32, 28, 5);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(p.face > 0 ? p.x + 7 : p.x - 11, p.y - 35, 4, 11);
      } else {
        ctx.fillStyle = blade;
        ctx.fillRect(sx - 2, p.y - 36, 4, 20);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(sx - 5, p.y - 17, 10, 4);
      }
    }
    if (p.slashT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 + p.slashT / 10 * 0.6).toFixed(2) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const a0 = p.face > 0 ? -1.1 : Math.PI - 1.1;
      ctx.arc(p.x, p.y - 26, 52, a0, a0 + 2.2);
      ctx.stroke();
    }
    if (p.spinT > 0) {
      const rr = 40 + (14 - p.spinT) * 4;
      ctx.strokeStyle = 'rgba(255,255,255,' + (p.spinT / 14 * 0.7).toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // projectiles
  for (const pr of projs) {
    if (pr.kind === 'ice') {
      ctx.fillStyle = '#7dcfff'; ctx.fillRect(pr.x - 8, pr.y - 4, 16, 8);
      ctx.fillStyle = '#d8f4ff'; ctx.fillRect(pr.x - 3, pr.y - 2, 6, 4);
    } else {
      drawSprite(FIRE, pr.x - 9, pr.y - 9, 3, pr.vx < 0);
      ctx.fillStyle = 'rgba(255,140,46,0.35)';
      ctx.fillRect(pr.x - pr.vx * 2 - 6, pr.y - 6, 12, 12);
    }
  }
  // 隕石
  for (const mt of meteors) {
    ctx.fillStyle = '#ff8c2e'; ctx.fillRect(mt.x - 7, mt.y - 14, 14, 18);
    ctx.fillStyle = '#ffe680'; ctx.fillRect(mt.x - 3, mt.y - 8, 6, 8);
  }
  // 魔法盾泡泡
  if (player.shieldHp > 0) {
    ctx.strokeStyle = 'rgba(125,207,255,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 22, player.y - player.h - 8, 44, player.h + 12);
  }
  // bolts
  for (const b of bolts) {
    ctx.strokeStyle = b.t % 4 < 2 ? '#fff' : '#ffe680';
    ctx.lineWidth = 3;
    ctx.beginPath();
    let by = -10;
    ctx.moveTo(b.x + 6, by);
    while (by < b.y) { by += 40; ctx.lineTo(b.x + (by % 80 < 40 ? -8 : 8), Math.min(by, b.y)); }
    ctx.stroke();
  }
  for (const q of parts) { ctx.fillStyle = q.color; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  ctx.font = 'bold 16px "Courier New",monospace';
  ctx.textAlign = 'center';
  for (const d of dmgNums) {
    ctx.globalAlpha = Math.min(1, d.t / 25);
    ctx.fillStyle = '#222'; ctx.fillText(d.text, d.x + 1, d.y + 1);
    ctx.fillStyle = d.color; ctx.fillText(d.text, d.x, d.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // ---------- HUD ----------
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillStyle = 'rgba(20,22,43,0.7)';
  ctx.fillRect(0, 0, 330, 30);
  ctx.fillStyle = '#b05ae0';
  ctx.fillText('第 ' + floor + ' 層 ' + biomeOf(floor).name, 12, 20);
  ctx.fillStyle = '#c8cdec';
  ctx.fillText(portal ? '前往傳送門 →' : '殘存 ' + mons.length, 244, 20);
  const bossM = mons.find(m => m.type === 'boss');
  if (bossM) {
    bar(W / 2 - 180, 38, 360, 16, bossM.hp / bossM.mhp, biomeOf(floor).bcol, biomeOf(floor).boss + '  第' + bossM.phase + '階段');
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = 'rgba(20,22,43,0.92)';
  ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = '#f4c542';
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('Lv.' + p.lv + ' ' + CLASSES[p.cls].name, 14, H - 26);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('靈魂 +' + soulsRun, 14, H - 8);
  bar(170, H - 36, 200, 12, p.hp / p.mhp, '#e23b3b', 'HP ' + Math.ceil(p.hp) + '/' + p.mhp);
  bar(170, H - 20, 200, 12, p.mp / p.mmp, '#3b6fe2', 'MP ' + Math.ceil(p.mp) + '/' + p.mmp);
  bar(400, H - 28, 280, 12, p.xp / xpNeed(p.lv), '#d8c93a', 'EXP ' + (100 * p.xp / xpNeed(p.lv)).toFixed(0) + '%');
  ctx.textAlign = 'left';
  ctx.font = '12px "Courier New",monospace';
  ctx.fillStyle = p.bag.hp > 0 ? '#ff8a8a' : '#666';
  ctx.fillText('[A]紅水x' + p.bag.hp, 400, H - 4);
  ctx.fillStyle = p.bag.mp > 0 ? '#8aa8ff' : '#666';
  ctx.fillText('[S]藍水x' + p.bag.mp, 500, H - 4);
  if (p.shieldHp > 0) { ctx.fillStyle = '#7dcfff'; ctx.fillRect(170, H - 40, 200 * Math.min(1, p.shieldHp / p.mhp), 3); }
  if (p.rageT > 0) { ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('狂暴' + Math.ceil(p.rageT / 60), 110, H - 8); }
  ctx.font = 'bold 12px "Courier New",monospace';
  const loH = loadouts[p.cls], keyN = ['Z', 'X', 'C'], skCol = ['#ff8c2e', '#ffe680', '#7dcfff'];
  for (let i = 0; i < 3; i++) {
    const sid = loH[i];
    ctx.fillStyle = !sid ? '#555' : p.slotCd[i] > 0 ? '#666' : skCol[i];
    ctx.fillText('[' + keyN[i] + ']' + (sid ? SKILL_DEFS[sid].name : '—') + (sid && p.slotCd[i] > 60 ? ' ' + Math.ceil(p.slotCd[i] / 60) + 's' : ''), 690, H - 32 + i * 14);
  }
  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = '#c8cdec';
  ctx.fillText('[I]裝備', 845, H - 8);

  if (floorT > 0) {
    ctx.globalAlpha = Math.min(1, floorT / 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('第 ' + floor + ' 層' + (floor % 5 === 0 ? '  ⚠ BOSS' : ''), W / 2, 180);
    ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillStyle = '#ffe680';
    ctx.fillText('— ' + biomeOf(floor).name + ' —', W / 2, 214);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (p.itemWin) drawItemWin();
  drawTouchUI();
}
function bar(x, y, w, h, ratio, color, label) {
  ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, ratio)), h - 2);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Courier New",monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h - 2);
}

// ---------- paper doll ----------
function drawGlyph(kind, gx, gy, col) {
  ctx.fillStyle = col;
  if (kind === 'weapon') {
    if (player.cls === 'mage') {
      ctx.fillStyle = '#a05a2c'; ctx.fillRect(gx - 1, gy - 6, 3, 16);
      ctx.fillStyle = col; ctx.fillRect(gx - 4, gy - 12, 8, 8);
    } else {
      ctx.fillRect(gx - 2, gy - 12, 4, 18);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(gx - 6, gy + 6, 12, 3);
    }
  } else if (kind === 'armor') {
    ctx.fillRect(gx - 8, gy - 7, 16, 15);
    ctx.fillRect(gx - 12, gy - 7, 4, 7);
    ctx.fillRect(gx + 8, gy - 7, 4, 7);
  } else if (kind === 'helmet') {
    ctx.fillRect(gx - 8, gy - 2, 16, 8);
    ctx.fillRect(gx - 5, gy - 7, 10, 5);
  } else if (kind === 'boots') {
    ctx.fillRect(gx - 10, gy - 6, 5, 10);
    ctx.fillRect(gx - 10, gy + 2, 8, 4);
    ctx.fillRect(gx + 3, gy - 6, 5, 10);
    ctx.fillRect(gx + 3, gy + 2, 8, 4);
  } else if (kind === 'acc') {
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gx, gy + 2, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillRect(gx - 2, gy - 9, 4, 4);
  }
}
function slotBox(sx, sy, slot, label) {
  const it = player.eq[slot];
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(sx, sy, 44, 44);
  ctx.strokeStyle = it ? '#d8b365' : '#3a3450';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, sy, 44, 44);
  if (it) drawItemIcon(it, sx + 6, sy + 6, 32);
  ctx.textAlign = 'center';
  ctx.font = '10px "Courier New",monospace';
  ctx.fillStyle = it ? RARITY_COL[it.r || 0] : '#667';
  ctx.fillText(it ? gearLabel(it) : label, sx + 22, sy + 56);
  ctx.textAlign = 'left';
}
function drawItemWin() {
  const p = player;
  itemBtns.length = 0;
  const x = W / 2 - 230, y = 40, w = 460, h = 440;
  ctx.fillStyle = 'rgba(16,14,24,0.96)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8a6d3b'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 16px "Courier New",monospace';
  ctx.fillText('裝 備', x + 14, y + 24);
  ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('[I] 關閉', x + w - 70, y + 24);
  const dx = x + 12, dy = y + 36, dw = 206, dh = 320;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#3a3450'; ctx.lineWidth = 1; ctx.strokeRect(dx, dy, dw, dh);
  const cx = dx + dw / 2;
  drawSprite(p.cls === 'mage' ? MAGE : WAR, cx - 30, dy + 115, 5, false);
  slotBox(cx - 22, dy + 10, 'helmet', '頭盔');
  slotBox(dx + 12, dy + 100, 'weapon', '武器');
  slotBox(dx + dw - 56, dy + 100, 'armor', '防具');
  slotBox(dx + dw - 56, dy + 10, 'acc', '飾品');
  slotBox(cx - 22, dy + dh - 76, 'boots', '鞋子');
  ctx.font = '11px "Courier New",monospace';
  ctx.fillStyle = '#9ecbff';
  ctx.fillText('攻擊 ' + Math.round(atkPow()) + '  爆擊 ' + (critRate() * 100).toFixed(1) + '%', dx + 4, dy + dh + 18);
  ctx.fillText('減傷 ' + armorDef() + '  移速 ' + moveSpd().toFixed(1) + '  HP ' + p.mhp, dx + 4, dy + dh + 34);
  const bx = x + 232, by = y + 36, bw = w - 244;
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillText('背包(點擊換裝/✕分解+2魂)', bx, by + 12);
  if (p.items.length === 0) {
    ctx.fillStyle = '#667'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText('(空的,打怪撿裝備吧)', bx + 4, by + 42);
  }
  if (pendingDel && (frame - pendingDel.f > 120 || p.items.indexOf(pendingDel.it) < 0)) pendingDel = null;
  delBtns.length = 0;
  for (let i = 0; i < p.items.length; i++) {
    const it = p.items[i];
    const ry = by + 36 + i * 26;
    const eqd = p.eq[it.kind] === it;
    const pend = pendingDel && pendingDel.it === it;
    ctx.fillStyle = pend ? 'rgba(226,59,59,0.25)' : eqd ? 'rgba(216,179,101,0.16)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(bx - 4, ry - 13, bw, 24);
    if (!eqd) {
      itemBtns.push({ x: bx - 4, y: ry - 13, w: bw - 44, h: 24, it: it });
      delBtns.push({ x: bx + bw - 46, y: ry - 13, w: 42, h: 24, it: it });
    }
    drawItemIcon(it, bx, ry - 11, 20);
    ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillStyle = RARITY_COL[it.r || 0]; ctx.textAlign = 'left';
    ctx.fillText(gearLabel(it), bx + 24, ry + 3);
    ctx.font = '10px "Courier New",monospace';
    ctx.fillStyle = '#8890b8';
    ctx.fillText(gearDesc(it), bx + 128, ry + 3);
    if (eqd) {
      ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 11px "Courier New",monospace';
      ctx.fillText('E', bx + bw - 16, ry + 3);
    } else {
      ctx.font = 'bold 11px "Courier New",monospace';
      ctx.fillStyle = pend ? '#ff5a5a' : '#8890b8';
      ctx.textAlign = 'center';
      ctx.fillText(pend ? '確認?' : '✕', bx + bw - 25, ry + 3);
      ctx.textAlign = 'left';
    }
  }
  const py = y + h - 40;
  ctx.fillStyle = '#e23b3b'; ctx.fillRect(bx, py + 2, 8, 10);
  ctx.fillStyle = '#fff'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('x' + p.bag.hp + '[A]', bx + 12, py + 11);
  ctx.fillStyle = '#3b6fe2'; ctx.fillRect(bx + 70, py + 2, 8, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText('x' + p.bag.mp + '[S]', bx + 82, py + 11);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('靈魂 +' + soulsRun, bx + 140, py + 11);
}

// ---------- overlays ----------
function wrapText(text, cx, y, maxW, lh) {
  let line = '', yy = y;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, cx, yy); line = ch; yy += lh; }
    else line += ch;
  }
  if (line) ctx.fillText(line, cx, yy);
}
function drawPick() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  pickBtns.length = 0;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe680'; ctx.font = 'bold 26px "Courier New",monospace';
  ctx.fillText('LEVEL UP!  選擇一項強化', W / 2, 130);
  for (let i = 0; i < 3; i++) {
    const c = pickOpts[i];
    const cw = 200, ch = 180;
    const cx = W / 2 + (i - 1) * 230 - cw / 2, cy = 180;
    const rc = CARD_RCOL[c.r];
    ctx.fillStyle = c.r === 2 ? 'rgba(60,48,20,0.95)' : c.r === 1 ? 'rgba(24,32,56,0.95)' : 'rgba(20,22,43,0.95)';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = rc; ctx.lineWidth = c.r === 2 ? 3 : 2; ctx.strokeRect(cx, cy, cw, ch);
    pickBtns.push({ x: cx, y: cy, w: cw, h: ch, c: c });
    ctx.fillStyle = rc; ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillText(CARD_RNAME[c.r], cx + cw / 2, cy + 26);
    ctx.fillStyle = c.r === 0 ? '#fff' : rc; ctx.font = 'bold 18px "Courier New",monospace';
    ctx.fillText(c.name, cx + cw / 2, cy + 60);
    ctx.fillStyle = '#9ecbff'; ctx.font = '12px "Courier New",monospace';
    wrapText(c.desc, cx + cw / 2, cy + 92, cw - 20, 15);
    const lvNow = cardLv(c);
    ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillStyle = lvNow + 1 >= CARD_MAXLV ? '#ffd23e' : '#8890b8';
    ctx.fillText(lvNow > 0 ? ('Lv.' + lvNow + ' → ' + (lvNow + 1) + ' / ' + CARD_MAXLV + (lvNow + 1 >= CARD_MAXLV ? '  滿級!' : '')) : ('取得 → Lv.1 / ' + CARD_MAXLV), cx + cw / 2, cy + 138);
    ctx.fillStyle = '#ffe680'; ctx.font = 'bold 14px "Courier New",monospace';
    ctx.fillText('[' + (i + 1) + '] 或點擊', cx + cw / 2, cy + ch - 20);
  }
  ctx.textAlign = 'left';
}
function drawDead() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 36px "Courier New",monospace';
  ctx.fillText('你 倒 下 了 ...', W / 2, 180);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Courier New",monospace';
  ctx.fillText('到達 第 ' + lastRun.floor + ' 層', W / 2, 240);
  ctx.fillText('擊殺 ' + lastRun.kills + ' 隻怪物', W / 2, 270);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('獲得靈魂 +' + lastRun.gained, W / 2, 300);
  if (lastRun.stashed) { ctx.fillStyle = '#d8b365'; ctx.fillText('裝備存入倉庫 ' + lastRun.stashed + ' 件', W / 2, 326); }
  ctx.fillStyle = Math.floor(frame / 30) % 2 === 0 ? '#ffe680' : '#8890b8';
  ctx.font = '15px "Courier New",monospace';
  ctx.fillText('按 Enter 或點擊 返回城鎮', W / 2, 366);
  ctx.textAlign = 'left';
}

// ---------- 城鎮(俯視角 top-down) ----------
const TOWN_W = 1400, TOWN_H = 920;
const PLAYER_CHAR = 105; // Kenney 角色(col24=正面朝下,index=row*27+24)
const NPCS = [
  { x: 380,  y: 300, name: '傳送門',     sub: '選職業・出發冒險', panel: 'base',   col: '#b05ae0', build: 'portal', char: 186 },
  { x: 780,  y: 240, name: '技能訓練師', sub: '抽取技能・天賦樹', panel: 'skills', col: '#7dffd6', build: 'shop',   char: 24 },
  { x: 1060, y: 430, name: '倉庫管理員', sub: '裝備倉庫',         panel: 'stash',  col: '#d8b365', build: 'shop',   char: 267 },
  { x: 470,  y: 620, name: '公告欄',     sub: '存檔・改名',       panel: 'save',   col: '#8aa8ff', build: 'board',  char: 348 }
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
  if (panel === 'save') { settingsOpen = true; settingsMode = null; beep(600, 0.08, 'sine', 0.04); return; }
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
  ctx.fillStyle = 'rgba(20,22,43,0.7)'; ctx.fillRect(0, 0, 300, 30);
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('城鎮', 12, 20);
  ctx.fillStyle = '#7dffd6'; ctx.fillText('靈魂 ' + meta.souls, 80, 20);
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillText('石' + meta.mats.enh + ' 塵' + meta.mats.ench, 200, 20);
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
  // 材料 + 容量
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('強化石 x' + meta.mats.enh + '    附魔塵 x' + meta.mats.ench + '    倉庫 ' + meta.stash.length + '/' + STASH_CAP, 40, 116);
  // 開局出戰裝備(左側 5 部位)
  ctx.fillStyle = '#8890b8'; ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillText('開局出戰裝備:', 40, 148);
  for (let i = 0; i < 5; i++) {
    const part = GEAR_PARTS[i], y = 158 + i * 50;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(40, y, 285, 44);
    ctx.strokeStyle = '#3a3450'; ctx.lineWidth = 1; ctx.strokeRect(40, y, 285, 44);
    ctx.fillStyle = '#889'; ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillText(PART_NAME[part], 50, y + 26);
    const uid = meta.loadout[part];
    const it = uid ? meta.stash.find(s => s.uid === uid) : null;
    if (it) {
      ctx.fillStyle = RARITY_COL[it.r]; ctx.font = 'bold 13px "Courier New",monospace';
      ctx.fillText(it.name, 100, y + 19);
      ctx.fillStyle = '#8890b8'; ctx.font = '10px "Courier New",monospace';
      ctx.fillText(it.desc, 100, y + 35);
    } else {
      ctx.fillStyle = '#556'; ctx.font = '12px "Courier New",monospace';
      ctx.fillText('(空 — 從右側倉庫設定)', 100, y + 27);
    }
  }
  // 倉庫網格(右側)
  ctx.fillStyle = '#8890b8'; ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillText('倉庫(點擊選擇):', 360, 148);
  const gx = 360, gy = 158, cell = 58, cols = 9;
  for (let i = 0; i < STASH_CAP; i++) {
    const it = meta.stash[i];
    const cxx = gx + (i % cols) * (cell + 4), cyy = gy + Math.floor(i / cols) * (cell + 4);
    const on = it && selStash === it.uid;
    ctx.fillStyle = it ? (on ? 'rgba(125,255,214,0.2)' : 'rgba(255,255,255,0.06)') : 'rgba(0,0,0,0.2)';
    ctx.fillRect(cxx, cyy, cell, cell);
    ctx.strokeStyle = it ? (on ? '#7dffd6' : RARITY_COL[it.r]) : '#2a2a3a'; ctx.lineWidth = on ? 2 : 1;
    ctx.strokeRect(cxx, cyy, cell, cell);
    if (it) {
      stashBtns.push({ x: cxx, y: cyy, w: cell, h: cell, uid: it.uid });
      drawItemIcon(it, cxx + (cell - 40) / 2, cyy + (cell - 40) / 2 - 2, 40);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#889'; ctx.font = '10px "Courier New",monospace';
      ctx.fillText(RARITY_ABBR[it.r], cxx + cell / 2, cyy + cell - 4);
      if (GEAR_PARTS.some(pt => meta.loadout[pt] === it.uid)) { ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.fillText('▲', cxx + 8, cyy + 12); }
      if (it.enh > 0) { ctx.fillStyle = '#ffcf6a'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'right'; ctx.fillText('+' + it.enh, cxx + cell - 3, cyy + 12); }
      ctx.textAlign = 'left';
    }
  }
  // 選中詳情 + 操作
  const sel = selStash ? meta.stash.find(s => s.uid === selStash) : null;
  const dyy = 452;
  if (sel) {
    ctx.textAlign = 'left';
    ctx.fillStyle = RARITY_COL[sel.r]; ctx.font = 'bold 15px "Courier New",monospace';
    ctx.fillText(gearLabel(sel), 40, dyy + 12);
    ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText('[' + PART_NAME[sel.kind] + '] ' + gearDesc(sel), 40, dyy + 30);
    const lv = sel.enh || 0;
    if (lv < ENH_MAX) {
      const zone = enhZone(lv), zt = zone === 'safe' ? '安全區·失敗不降級' : zone === 'down' ? '失敗降 1 級' : '危險·失敗可能爆裝(' + Math.round(enhBoomRate(lv) * 100) + '%)';
      ctx.fillStyle = '#c8cdec'; ctx.font = '11px "Courier New",monospace';
      ctx.fillText('強化 +' + lv + '→+' + (lv + 1) + '   成功率 ' + Math.round(enhRate(lv) * 100) + '%   花費 石×' + enhCost(lv), 40, dyy + 48);
      ctx.fillStyle = zone === 'safe' ? '#7dffd6' : zone === 'down' ? '#ffe680' : '#ff6b6b';
      ctx.fillText(zt, 360, dyy + 48);
    } else { ctx.fillStyle = '#ffe680'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('已達強化上限 +' + ENH_MAX, 40, dyy + 48); }
    const equipped = meta.loadout[sel.kind] === sel.uid;
    const b1 = { x: 560, y: dyy - 6, w: 150, h: 26, act: 'equip' };
    stashActBtns.push(b1);
    ctx.fillStyle = equipped ? 'rgba(125,255,214,0.25)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(b1.x, b1.y, b1.w, b1.h);
    ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(b1.x, b1.y, b1.w, b1.h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(equipped ? '✓ 出戰中(卸下)' : '設為開局出戰', b1.x + b1.w / 2, b1.y + 17);
    const pend = pendingStashDel === sel.uid;
    const b2 = { x: 560, y: dyy + 24, w: 150, h: 26, act: 'dismantle' };
    stashActBtns.push(b2);
    ctx.fillStyle = pend ? 'rgba(226,59,59,0.35)' : 'rgba(255,255,255,0.08)'; ctx.fillRect(b2.x, b2.y, b2.w, b2.h);
    ctx.strokeStyle = '#44485f'; ctx.strokeRect(b2.x, b2.y, b2.w, b2.h);
    ctx.fillStyle = '#fff'; ctx.fillText(pend ? '確認分解?' : '分解成材料', b2.x + b2.w / 2, b2.y + 17);
    if (lv < ENH_MAX) {
      const b3 = { x: 724, y: dyy - 6, w: 160, h: 56, act: 'enhance' };
      stashActBtns.push(b3);
      const can = meta.mats.enh >= enhCost(lv);
      ctx.fillStyle = can ? 'rgba(255,140,46,0.28)' : 'rgba(255,255,255,0.05)'; ctx.fillRect(b3.x, b3.y, b3.w, b3.h);
      ctx.strokeStyle = '#ff8c2e'; ctx.lineWidth = 2; ctx.strokeRect(b3.x, b3.y, b3.w, b3.h);
      ctx.fillStyle = can ? '#ffcf9e' : '#888'; ctx.font = 'bold 17px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('⚒ 強化', b3.x + b3.w / 2, b3.y + 24);
      ctx.font = '11px "Courier New",monospace'; ctx.fillText('強化石 ×' + enhCost(lv), b3.x + b3.w / 2, b3.y + 44);
    }
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#667'; ctx.font = '12px "Courier New",monospace'; ctx.textAlign = 'left';
    ctx.fillText('點擊倉庫格子選擇裝備 → 可設為開局出戰或分解成材料。開局出戰的裝備會在下次冒險穿戴。', 40, dyy + 12);
  }
  if (menuMsg) {
    ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(menuMsg.text, W / 2, dyy + 40);
    if (--menuMsg.t <= 0) menuMsg = null;
    ctx.textAlign = 'left';
  }
  drawEnhAnim();
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
function renderSkillTab() {
  skillBtns.length = 0; skillActBtns.length = 0;
  if (pendingReset && (frame - pendingReset.f > 150 || pendingReset.id !== selSkill)) pendingReset = null;
  // 職業切換
  const clsList = ['warrior', 'mage'];
  for (let i = 0; i < 2; i++) {
    const b = { x: 40 + i * 122, y: 118, w: 112, h: 32, act: 'cls', cls: clsList[i] };
    skillActBtns.push(b);
    const on = chosenCls === clsList[i];
    ctx.fillStyle = on ? 'rgba(125,255,214,0.15)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = on ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = on ? '#fff' : '#889'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(CLASSES[clsList[i]].name, b.x + b.w / 2, b.y + 21);
  }
  // 抽取按鈕
  gachaBtn = { x: 660, y: 118, w: 260, h: 32 };
  const pool = classSkills(chosenCls).filter(id => !(skillState[id].unl && skillState[id].pts >= 5));
  ctx.fillStyle = pool.length ? (Math.floor(frame / 30) % 2 === 0 ? 'rgba(176,90,224,0.35)' : 'rgba(176,90,224,0.22)') : 'rgba(255,255,255,0.05)';
  ctx.fillRect(gachaBtn.x, gachaBtn.y, gachaBtn.w, gachaBtn.h);
  ctx.strokeStyle = '#b05ae0'; ctx.lineWidth = 2; ctx.strokeRect(gachaBtn.x, gachaBtn.y, gachaBtn.w, gachaBtn.h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.textAlign = 'center';
  ctx.fillText(pool.length ? '抽取技能(40 靈魂)' : '技能池已全滿', gachaBtn.x + gachaBtn.w / 2, gachaBtn.y + 21);
  // 技能清單(左欄)
  const list = classSkills(chosenCls);
  const lo = loadouts[chosenCls];
  ctx.textAlign = 'left';
  for (let i = 0; i < list.length; i++) {
    const id = list[i], s = skillState[id], d = SKILL_DEFS[id];
    const b = { x: 40, y: 162 + i * 58, w: 280, h: 52, act: 'sel', id: id };
    skillBtns.push(b);
    const sel = selSkill === id;
    ctx.fillStyle = sel ? 'rgba(125,255,214,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = sel ? '#7dffd6' : '#3a3450'; ctx.lineWidth = sel ? 2 : 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.font = 'bold 14px "Courier New",monospace';
    ctx.fillStyle = s.unl ? '#fff' : '#556';
    ctx.fillText((s.unl ? '' : '? ') + d.name, b.x + 12, b.y + 21);
    const li = lo.indexOf(id);
    if (li >= 0) { ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('出戰[' + ['Z', 'X', 'C'][li] + ']', b.x + 205, b.y + 21); }
    ctx.font = '11px "Courier New",monospace'; ctx.fillStyle = '#8890b8';
    if (s.unl) {
      let stars = '';
      for (let k = 0; k < 5; k++) stars += k < s.spent ? '★' : (k < s.pts ? '☆' : '·');
      ctx.fillText(stars + (s.branch >= 0 ? ' [' + BRANCH_NAMES[id][s.branch] + ']' : '') + (s.pts - s.spent > 0 ? ' 可投點!' : ''), b.x + 12, b.y + 40);
    } else {
      ctx.fillText('未解鎖(抽取獲得)', b.x + 12, b.y + 40);
    }
  }
  // 右側詳情:天賦樹
  const dx = 360, dy = 162, dw = 560, dh = 262;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(dx, dy, dw, dh);
  ctx.strokeStyle = '#3a3450'; ctx.lineWidth = 1; ctx.strokeRect(dx, dy, dw, dh);
  if (!selSkill || SKILL_DEFS[selSkill].cls !== chosenCls) {
    ctx.fillStyle = '#667'; ctx.font = '13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('← 點選左側技能查看天賦樹', dx + dw / 2, dy + dh / 2);
  } else {
    const id = selSkill, s = skillState[id], d = SKILL_DEFS[id];
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d8b365'; ctx.font = 'bold 16px "Courier New",monospace';
    ctx.fillText(d.name, dx + 16, dy + 26);
    ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText(d.desc + ' | MP' + d.mp + ' CD' + (d.cd / 60).toFixed(1) + 's', dx + 130, dy + 26);
    if (!s.unl) {
      ctx.fillStyle = '#667'; ctx.font = '13px "Courier New",monospace';
      ctx.fillText('尚未解鎖,透過上方抽取獲得', dx + 16, dy + 90);
    } else {
      const labels = [
        '傷害+12%',
        s.branch === -1 ? '分支二選一' : '流派:' + BRANCH_NAMES[id][s.branch],
        s.branch === 1 ? '傷害+15%' : '範圍+20%',
        '冷卻-15%',
        s.branch === 1 ? '傷害+18%' : '範圍+15% 傷害+10%'
      ];
      for (let k = 0; k < 5; k++) {
        const nx = dx + 14 + k * 108, ny = dy + 44, nw = 100, nh = 66;
        const invested = s.spent > k;
        ctx.fillStyle = invested ? 'rgba(125,255,214,0.15)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(nx, ny, nw, nh);
        ctx.strokeStyle = invested ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(nx, ny, nw, nh);
        ctx.fillStyle = invested ? '#7dffd6' : '#889'; ctx.font = 'bold 11px "Courier New",monospace';
        ctx.fillText('Lv' + (k + 1) + (k === 1 ? ' ★' : ''), nx + 6, ny + 16);
        ctx.font = '10px "Courier New",monospace'; ctx.fillStyle = invested ? '#cfe' : '#778';
        ctx.fillText(labels[k].slice(0, 9), nx + 6, ny + 36);
        if (labels[k].length > 9) ctx.fillText(labels[k].slice(9), nx + 6, ny + 52);
      }
      const avail = s.pts - s.spent;
      ctx.fillStyle = avail > 0 ? '#7dffd6' : '#8890b8'; ctx.font = 'bold 12px "Courier New",monospace';
      ctx.fillText('可用天賦點:' + avail + '(重複抽取同技能獲得)', dx + 16, dy + 132);
      let bx2 = dx + 16;
      const mkBtn = (label, act, extra, color) => {
        const w2 = 16 + label.length * 14;
        const b = Object.assign({ x: bx2, y: dy + 148, w: w2, h: 34, act: act }, extra);
        skillActBtns.push(b);
        ctx.fillStyle = color || 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'left';
        ctx.fillText(label, b.x + 8, b.y + 22);
        bx2 += w2 + 12;
      };
      if (avail > 0 && s.spent < 5) {
        if (s.spent === 1) {
          mkBtn('選' + BRANCH_NAMES[id][0], 'invest', { br: 0 }, 'rgba(125,255,214,0.2)');
          mkBtn('選' + BRANCH_NAMES[id][1], 'invest', { br: 1 }, 'rgba(255,140,46,0.2)');
        } else {
          mkBtn('投入1點', 'invest', {}, 'rgba(125,255,214,0.2)');
        }
      }
      mkBtn(loadouts[chosenCls].indexOf(id) >= 0 ? '卸下' : '裝備出戰', 'equip', {});
      if (s.spent > 0) {
        const pend = pendingReset && pendingReset.id === id;
        mkBtn(pend ? '確認重置?' : '重置(' + (30 + 20 * s.spent) + '魂)', 'reset', {}, pend ? 'rgba(226,59,59,0.35)' : undefined);
      }
      if (s.branch >= 0) {
        ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace';
        ctx.fillText('流派已鎖定:' + BRANCH_NAMES[id][s.branch] + '(A=範圍/持續 B=傷害;重置可重選)', dx + 16, dy + 206);
      }
    }
  }
  // 出戰欄
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillText('出戰技能(最多 3 招,槽位=按鍵):', 360, 448);
  const lo2 = loadouts[chosenCls];
  for (let i = 0; i < 3; i++) {
    const bx3 = 360 + i * 190, by3 = 458;
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(bx3, by3, 180, 40);
    ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(bx3, by3, 180, 40);
    ctx.fillStyle = lo2[i] ? ['#ff8c2e', '#ffe680', '#7dcfff'][i] : '#556';
    ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillText('[' + ['Z', 'X', 'C'][i] + '] ' + (lo2[i] ? SKILL_DEFS[lo2[i]].name : '(空)'), bx3 + 10, by3 + 25);
  }
  ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('Enter 開始冒險', 40, 480);
}
function renderMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1c2c'); g.addColorStop(1, '#2c2f4a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 40px "Courier New",monospace';
  ctx.fillText('像 素 地 城', W / 2, 70);
  ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 18px "Courier New",monospace';
  ctx.fillText('靈魂 ' + meta.souls + (bestFloor > 0 ? '   最深 ' + bestFloor + ' 層' : ''), W / 2, 104);
  // 存檔碼按鈕
  gearBtn = { x: 906, y: 28, w: 38, h: 38 };
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(gearBtn.x, gearBtn.y, gearBtn.w, gearBtn.h);
  ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(gearBtn.x, gearBtn.y, gearBtn.w, gearBtn.h);
  drawGear(gearBtn.x + gearBtn.w / 2, gearBtn.y + gearBtn.h / 2, 12, '#c8cdec');
  if (menuMsg) {
    ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillText(menuMsg.text, 844, 78);
    if (--menuMsg.t <= 0) menuMsg = null;
  }
  // 分頁:基地 / 技能 / 倉庫
  tabBtns.length = 0;
  const tabs = [['base', '基 地'], ['skills', '技 能'], ['stash', '倉 庫']];
  for (let i = 0; i < tabs.length; i++) {
    const b = { x: 20 + i * 108, y: 30, w: 98, h: 32, tab: tabs[i][0] };
    tabBtns.push(b);
    const on = menuTab === b.tab;
    ctx.fillStyle = on ? 'rgba(176,90,224,0.35)' : 'rgba(255,255,255,0.07)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = on ? '#b05ae0' : '#44485f'; ctx.lineWidth = on ? 2 : 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = on ? '#fff' : '#8890b8'; ctx.font = 'bold 14px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(tabs[i][1], b.x + b.w / 2, b.y + 21);
  }
  backTownBtn = null;
  if (fromTown) {
    backTownBtn = { x: 706, y: 30, w: 150, h: 34 }; // 標題與 ⚙ 之間,留足空間
    ctx.fillStyle = 'rgba(125,255,214,0.18)'; ctx.fillRect(backTownBtn.x, backTownBtn.y, backTownBtn.w, backTownBtn.h);
    ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 1; ctx.strokeRect(backTownBtn.x, backTownBtn.y, backTownBtn.w, backTownBtn.h);
    ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText('← 返回城鎮', backTownBtn.x + backTownBtn.w / 2, backTownBtn.y + 21);
  }
  if (menuTab === 'skills') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; stashBtns.length = 0; stashActBtns.length = 0;
    renderSkillTab();
    return;
  }
  if (menuTab === 'stash') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null;
    renderStashTab();
    return;
  }
  skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; stashBtns.length = 0; stashActBtns.length = 0;
  if (lastRun) {
    ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText('上次:第' + lastRun.floor + '層 / 擊殺' + lastRun.kills + ' / 靈魂+' + lastRun.gained, W / 2, 126);
  }
  // class cards
  selBtns.length = 0;
  const cls = ['warrior', 'mage'];
  for (let i = 0; i < 2; i++) {
    const c = cls[i];
    const cw = 150, ch = 170;
    const cx = 180 + i * 180, cy = 150;
    const sel = chosenCls === c;
    ctx.fillStyle = sel ? 'rgba(125,255,214,0.12)' : 'rgba(20,22,43,0.9)';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = sel ? '#7dffd6' : '#44485f';
    ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    selBtns.push({ x: cx, y: cy, w: cw, h: ch, cls: c });
    drawSprite(c === 'mage' ? MAGE : WAR, cx + cw / 2 - 24, cy + 18, 4, false);
    ctx.fillStyle = sel ? '#fff' : '#889';
    ctx.font = 'bold 16px "Courier New",monospace';
    ctx.fillText('[' + (i + 1) + '] ' + CLASSES[c].name, cx + cw / 2, cy + 110);
    ctx.font = '11px "Courier New",monospace';
    ctx.fillStyle = '#9ecbff';
    ctx.fillText(c === 'warrior' ? '近戰 高血量' : '遠程 高爆發', cx + cw / 2, cy + 132);
    if (sel) { ctx.fillStyle = '#7dffd6'; ctx.fillText('✓ 已選擇', cx + cw / 2, cy + 152); }
  }
  // meta shop
  metaBtns.length = 0;
  const sx = 560, sy = 150, sw = 360;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8b365'; ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('永久強化(點擊購買)', sx, sy - 8);
  for (let i = 0; i < META_DEFS.length; i++) {
    const d = META_DEFS[i];
    const lv = meta.up[d.id];
    const ry = sy + 14 + i * 44;
    const maxed = lv >= d.max;
    const cost = maxed ? 0 : d.cost(lv);
    const afford = !maxed && meta.souls >= cost;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx, ry - 14, sw, 38);
    if (!maxed) metaBtns.push({ x: sx, y: ry - 14, w: sw, h: 38, d: d });
    ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillStyle = afford ? '#fff' : (maxed ? '#ffe680' : '#889');
    ctx.fillText(d.name + '  Lv' + lv + '/' + d.max, sx + 10, ry);
    ctx.font = '11px "Courier New",monospace';
    ctx.fillStyle = '#8890b8';
    ctx.fillText(d.desc, sx + 10, ry + 15);
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillStyle = maxed ? '#ffe680' : (afford ? '#7dffd6' : '#a06060');
    ctx.fillText(maxed ? 'MAX' : cost + ' 靈魂', sx + sw - 10, ry + 6);
    ctx.textAlign = 'left';
  }
  // start button
  const bw2 = 260, bh2 = 54;
  startBtn = { x: 180 + 165 - bw2 / 2, y: 370, w: bw2, h: bh2 };
  ctx.fillStyle = Math.floor(frame / 30) % 2 === 0 ? 'rgba(176,90,224,0.35)' : 'rgba(176,90,224,0.2)';
  ctx.fillRect(startBtn.x, startBtn.y, bw2, bh2);
  ctx.strokeStyle = '#b05ae0'; ctx.lineWidth = 2;
  ctx.strokeRect(startBtn.x, startBtn.y, bw2, bh2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px "Courier New",monospace';
  ctx.fillText('開始冒險 [Enter]', startBtn.x + bw2 / 2, startBtn.y + 34);
  ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('清光每層怪物開啟傳送門,看你能下到第幾層!', startBtn.x + bw2 / 2, startBtn.y + 80);
  ctx.fillText('死亡後獲得靈魂,購買永久強化再次出發。', startBtn.x + bw2 / 2, startBtn.y + 100);
  ctx.textAlign = 'left';
}

// ---------- main loop ----------
function loop() {
  frame++;
  if (gameState === 'town') {
    updateTown();
    renderTown();
  } else if (gameState === 'select') {
    renderMenu();
  } else {
    if (gameState === 'play') update();
    if (gameState !== 'select') render();
    if (gameState === 'pick') drawPick();
    if (gameState === 'dead') drawDead();
  }
  if (settingsOpen) renderSettings();
  requestAnimationFrame(loop);
}
calcStats();
gameState = 'town'; setHint(HINT_TOWN);
loop();
