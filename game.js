"use strict";
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
let worldW = 2000;

function setHint(t) { document.getElementById('hint').innerHTML = t; }
const HINT_PLAY = '← → 移動&nbsp;|&nbsp;Space 跳躍(↓+Space 下跳)&nbsp;|&nbsp;Z / X 技能&nbsp;|&nbsp;C 紅水 V 藍水&nbsp;|&nbsp;I 裝備&nbsp;|&nbsp;Esc 關閉';
const HINT_MENU = '[1]/[2] 選職業&nbsp;|&nbsp;點擊購買永久強化&nbsp;|&nbsp;Enter 開始冒險';

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
  'e':'#b05ae0', 'f':'#7a2fa8'
};
const RARITY_COL = ['#e8e8e8', '#6f9dff', '#ffd23e'];
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
function drawSprite(rows, x, y, s, flip, flash) {
  const w = rows[0].length;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < w; c++) {
      const ch = rows[r][c];
      if (ch === '.') continue;
      ctx.fillStyle = flash ? '#ffffff' : (PAL[ch] || '#f0f');
      const cx = flip ? (w - 1 - c) : c;
      ctx.fillRect(Math.round(x + cx * s), Math.round(y + r * s), s, s);
    }
  }
}

// ---------- meta progression ----------
const meta = { souls: 0, up: { atk: 0, vit: 0, pots: 0, treasure: 0, soul: 0 } };
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
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ s: meta.souls, u: UP_IDS.map(id => meta.up[id]), b: bestFloor })); } catch (e) {}
}
function loadMeta() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && typeof d.s === 'number' && Array.isArray(d.u)) applyMeta(d.s, d.u, d.b);
  } catch (e) {}
}
function saveChk(a) { let s = 7; for (const v of a) s = (s * 31 + v) % 99991; return s; }
function encodeSave() {
  const a = [1, meta.souls, ...UP_IDS.map(id => meta.up[id]), bestFloor];
  a.push(saveChk(a));
  return btoa(a.join(','));
}
function decodeSave(str) {
  try {
    const a = atob(String(str).trim()).split(',').map(Number);
    if (a.length !== 9 || a[0] !== 1 || a.some(v => !Number.isFinite(v))) return null;
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
  saveMeta();
  menuMsg = { text: '匯入成功!靈魂 ' + meta.souls, color: '#7dffd6', t: 240 };
  beep(900, 0.1, 'sine', 0.04);
}
loadMeta();

// ---------- state ----------
let gameState = 'select';
let chosenCls = 'warrior';
const CLASSES = { warrior: { name: '劍士' }, mage: { name: '法師' } };
let frame = 0;
let floor = 1, kills = 0, soulsRun = 0, floorT = 0, gearSeq = 1;
let portal = null;
let lastRun = null;
let pendingPicks = 0, pickOpts = [];
let plats = [], mons = [];
const projs = [], dmgNums = [], parts = [], orbs = [], drops = [], gearDrops = [], bolts = [];
const clouds = [];
for (let i = 0; i < 12; i++) clouds.push({ x: i * 260 + (i * 97) % 130, y: 40 + (i * 53) % 120, w: 70 + (i * 31) % 60 });

const player = {
  x: 80, y: 500, vx: 0, vy: 0, w: 26, h: 46, face: 1,
  onGround: false, dropT: 0, inv: 0, cast: 0, fireCd: 0, boltCd: 0, walk: 0,
  slashT: 0, spinT: 0, potCd: 0, cls: 'warrior',
  lv: 1, hp: 100, mhp: 100, mp: 30, mmp: 30, xp: 0,
  bag: { hp: 0, mp: 0 }, eq: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  items: [], itemWin: false,
  cd: { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0 }
};

// ---------- level-up cards ----------
const CARDS = [
  { id:'atk',  name:'力量湧現', desc:'攻擊 +12%' },
  { id:'hp',   name:'巨人體魄', desc:'最大HP +20 並回滿' },
  { id:'crit', name:'致命精準', desc:'爆擊率 +6%' },
  { id:'spd',  name:'疾風步伐', desc:'移動速度 +0.4' },
  { id:'aspd', name:'迅捷出手', desc:'攻擊冷卻 -12%' },
  { id:'xdmg', name:'絕技精通', desc:'X技能傷害 +15%' },
  { id:'ls',   name:'嗜血',     desc:'擊殺回復 3 HP' },
  { id:'mp',   name:'心靈之泉', desc:'MP上限+15 回魔+50%' },
  { id:'pot',  name:'藥劑師',   desc:'藥水掉落率 +8%' }
];
const pickBtns = [];
function rollPick() {
  const pool = CARDS.slice();
  pickOpts = [];
  for (let i = 0; i < 3; i++) pickOpts.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  gameState = 'pick';
}
function applyCard(c) {
  player.cd[c.id]++;
  calcStats();
  if (c.id === 'hp') player.hp = player.mhp;
  num(player.x, player.y - player.h - 10, c.name + '!', '#7dffd6');
  beep(700, 0.08, 'sine', 0.04);
  pendingPicks--;
  if (pendingPicks > 0) rollPick();
  else gameState = 'play';
}

// ---------- derived stats ----------
function accV(f) { return player.eq.acc && player.eq.acc[f] ? player.eq.acc[f] : 0; }
function atkPow() {
  const base = 8 + player.lv * 2.5 + (player.eq.weapon ? player.eq.weapon.atk : 0) + (player.cls === 'warrior' ? 4 : 0);
  return base * (1 + 0.12 * player.cd.atk) * (1 + 0.04 * meta.up.atk) * (1 + accV('atkMul'));
}
function critRate() { return 0.08 + 0.06 * player.cd.crit + accV('crit'); }
function armorDef() {
  return (player.eq.armor ? player.eq.armor.def : 0) + (player.eq.helmet ? player.eq.helmet.def : 0);
}
function moveSpd() { return 3.2 + 0.4 * player.cd.spd + (player.eq.boots ? player.eq.boots.spd : 0); }
function jumpV() { return 11.5 + (player.eq.boots && player.eq.boots.jmp ? player.eq.boots.jmp : 0); }
function calcStats() {
  const p = player;
  const gearHp = (p.eq.armor ? p.eq.armor.hp : 0) + (p.eq.helmet ? p.eq.helmet.hp : 0);
  p.mhp = Math.round((60 + (p.cls === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp) * (1 + 0.08 * meta.up.vit));
  p.mmp = 30 + (p.cls === 'mage' ? 15 : 0) + p.lv * 4 + 15 * p.cd.mp;
  if (p.hp > p.mhp) p.hp = p.mhp;
  if (p.mp > p.mmp) p.mp = p.mmp;
}
function xpNeed(l) { return 25 + l * 15; }
function zCd() { return Math.max(6, Math.round((player.cls === 'mage' ? 22 : 15) * Math.pow(0.88, player.cd.aspd))); }
function xCd() { return Math.max(40, Math.round((player.cls === 'mage' ? 170 : 140) * Math.pow(0.92, player.cd.aspd))); }
function playerDmg() {
  const crit = Math.random() < critRate();
  const d = Math.round(atkPow() * (0.85 + Math.random() * 0.3) * (crit ? 1.6 : 1));
  return { d: d, crit: crit };
}

// ---------- gear generation ----------
function genGear(n) {
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
  const slot = slots[(Math.random() * 5) | 0];
  const roll = Math.random() + Math.min(0.3, n * 0.02);
  const r = roll > 1.08 ? 2 : roll > 0.78 ? 1 : 0;
  const m = [1, 1.6, 2.4][r] * (0.85 + Math.random() * 0.3);
  const pre = ['破舊的', '精良的', '傳說的'][r];
  const it = { kind: slot, r: r, id: 'g' + (gearSeq++) };
  if (slot === 'weapon') {
    it.atk = Math.max(1, Math.round((4 + n * 2) * m));
    it.name = pre + (player.cls === 'mage' ? '法杖' : '利劍');
    it.desc = '攻擊+' + it.atk;
  } else if (slot === 'armor') {
    it.hp = Math.round((16 + n * 6) * m); it.def = Math.max(1, Math.round((1 + n * 0.4) * m));
    it.name = pre + (player.cls === 'mage' ? '法袍' : '鎧甲');
    it.desc = 'HP+' + it.hp + ' 減傷' + it.def;
  } else if (slot === 'helmet') {
    it.hp = Math.round((10 + n * 4) * m); it.def = Math.max(1, Math.round((0.5 + n * 0.3) * m));
    it.name = pre + '頭盔';
    it.desc = 'HP+' + it.hp + ' 減傷' + it.def;
  } else if (slot === 'boots') {
    it.spd = Math.min(1.2, Math.round((0.2 + n * 0.04) * m * 10) / 10);
    it.jmp = (r >= 1 && Math.random() < 0.5) ? 1 : 0;
    it.name = pre + '靴子';
    it.desc = '移速+' + it.spd + (it.jmp ? ' 跳躍+1' : '');
  } else {
    if (Math.random() < 0.5) {
      it.crit = Math.round(3 * m) / 100;
      it.desc = '爆擊+' + Math.round(it.crit * 100) + '%';
    } else {
      it.atkMul = Math.round(5 * m) / 100;
      it.desc = '攻擊+' + Math.round(it.atkMul * 100) + '%';
    }
    it.name = pre + '護符';
  }
  return it;
}
function addGear(it) {
  const p = player;
  if (p.items.length >= 12) {
    soulsRun += 2;
    num(p.x, p.y - p.h - 10, '背包已滿 → 靈魂+2', '#7dffd6');
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
  soulsRun += 2;
  pendingDel = null;
  num(p.x, p.y - p.h - 10, '分解 → 靈魂+2', '#7dffd6');
  beep(500, 0.08, 'square', 0.03);
}

// ---------- floor generation ----------
function genFloor(n) {
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
  const sc = 1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1); // 線性+微幅二次成長,對抗玩家的乘法成長
  const xpSc = 1 + 0.15 * (n - 1);
  const eliteCh = Math.min(0.08 + 0.025 * n, 0.4);
  for (let i = 0; i < count; i++) {
    if (Math.random() < 0.35) {
      const bx = 350 + Math.random() * (worldW - 550);
      const by = 170 + Math.random() * 140;
      mons.push({
        type:'bat', x: bx, y: by, ax: bx, ay: by, t: Math.random() * 200,
        hp: Math.round(20 * sc), mhp: Math.round(20 * sc), xpv: Math.round(16 * xpSc),
        dmg: Math.round(10 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3
      });
    } else {
      const cand = plats.filter(q => q.ground || q.w > 120);
      const pl = cand[(Math.random() * cand.length) | 0];
      let sx = pl.ground ? 350 + Math.random() * (worldW - 550) : pl.x + 30 + Math.random() * (pl.w - 60);
      const elite = Math.random() < eliteCh;
      const hp = Math.round(26 * sc * (elite ? 3.2 : 1));
      mons.push({
        type:'slime', x: sx, y: pl.y, vx: (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
        minx: Math.max(pl.x + 20, sx - 140), maxx: Math.min(pl.x + pl.w - 20, sx + 140),
        hp: hp, mhp: hp, xpv: Math.round(12 * xpSc * (elite ? 3 : 1)),
        dmg: Math.round(8 * sc * (elite ? 1.6 : 1)),
        w: elite ? 46 : 34, h: elite ? 30 : 22, hitT: 0, elite: elite, s: elite ? 4 : 3
      });
    }
  }
  portal = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0;
  floorT = 90;
}
function resetRun() {
  const p = player;
  p.cls = chosenCls;
  p.lv = 1; p.xp = 0;
  p.cd = { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0 };
  p.items = []; p.eq = { weapon: null, armor: null, helmet: null, boots: null, acc: null };
  p.bag = { hp: meta.up.pots, mp: meta.up.pots };
  p.x = 80; p.y = 500; p.vx = 0; p.vy = 0; p.face = 1;
  p.inv = 0; p.cast = 0; p.fireCd = 0; p.boltCd = 0; p.potCd = 0; p.slashT = 0; p.spinT = 0;
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
  const gained = Math.round(soulsRun * (1 + 0.1 * meta.up.soul));
  meta.souls += gained;
  lastRun = { floor: floor, kills: kills, gained: gained };
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
function hitMon(m, d, crit) {
  m.hp -= d; m.hitT = 8;
  num(m.x, m.y - m.h - 8, String(d), crit ? '#ffb020' : '#fff');
  burst(m.x, m.y - m.h / 2, '#ffd23e', 6);
  beep(crit ? 660 : 520, 0.07, 'square');
  if (m.hp <= 0) {
    kills++;
    burst(m.x, m.y - m.h / 2, m.elite ? '#b05ae0' : (m.type === 'slime' ? '#63cf3c' : '#c0aaff'), m.elite ? 24 : 14);
    gainXp(m.xpv);
    if (player.cd.ls > 0) player.hp = Math.min(player.mhp, player.hp + 3 * player.cd.ls);
    const orbN = m.elite ? 3 : 1;
    for (let i = 0; i < orbN; i++) {
      orbs.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - m.h, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 2, t: 0 });
    }
    if (Math.random() < 0.13 + 0.08 * player.cd.pot) {
      drops.push({
        x: m.x + 10, y: m.y - m.h, vy: -3.5, vx: (Math.random() - 0.5) * 2,
        type: Math.random() < 0.6 ? 'hp' : 'mp', t: 700, ground: m.type === 'slime' ? m.y : 500
      });
    }
    if (m.elite || Math.random() < Math.min(0.08 + 0.01 * floor + 0.02 * meta.up.treasure, 0.25)) {
      gearDrops.push({
        x: m.x - 10, y: m.y - m.h, vy: -3, vx: (Math.random() - 0.5) * 2,
        it: genGear(floor), t: 900, ground: m.type === 'slime' ? m.y : 500
      });
    }
    mons.splice(mons.indexOf(m), 1);
    beep(220, 0.15, 'sawtooth');
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
let expBtn = null, impBtn = null;
let startBtn = null;
window.addEventListener('keydown', e => {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) {} }
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  keys[e.key === ' ' ? 'space' : e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (gameState === 'select') {
    if (k === '1') chosenCls = 'warrior';
    if (k === '2') chosenCls = 'mage';
    if (k === 'enter') resetRun();
    return;
  }
  if (gameState === 'dead') {
    if (k === 'enter' || k === ' ' || k === 'space') { gameState = 'select'; setHint(HINT_MENU); }
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
  if (k === 'c') usePot('hp');
  if (k === 'v') usePot('mp');
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
  if (gameState === 'select') {
    for (const b of selBtns) if (inside(b)) { chosenCls = b.cls; return; }
    for (const b of metaBtns) if (inside(b)) { buyMeta(b.d); return; }
    if (inside(expBtn)) { exportSave(); return; }
    if (inside(impBtn)) { importSave(); return; }
    if (inside(startBtn)) resetRun();
    return;
  }
  if (gameState === 'dead') { gameState = 'select'; setHint(HINT_MENU); return; }
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
  { x: 782, y: 396, w: 74, h: 74, label: 'Z', hold: 'z' },
  { x: 694, y: 396, w: 74, h: 74, label: 'X', hold: 'x' },
  { x: 694, y: 330, w: 52, h: 52, label: 'C', tap: () => usePot('hp') },
  { x: 760, y: 330, w: 52, h: 52, label: 'V', tap: () => usePot('mp') },
  { x: 826, y: 330, w: 52, h: 52, label: 'I', tap: () => { player.itemWin = !player.itemWin; } },
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
  if (p.fireCd > 0) p.fireCd--;
  if (p.boltCd > 0) p.boltCd--;
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
  if (keys['space'] && p.onGround) {
    if (keys['arrowdown']) {
      const cur = plats.find(q => !q.ground && Math.abs(p.y - q.y) < 2 && p.x > q.x - 5 && p.x < q.x + q.w + 5);
      if (cur) { p.dropT = 18; p.onGround = false; p.vy = 2; }
      else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
    } else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
    keys['space'] = false;
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
        p.y = q.y; p.vy = 0; p.onGround = true;
        break;
      }
    }
  }
  if (p.y > 600) { p.y = 500; p.vy = 0; p.onGround = true; }

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

  // skills
  if (keys['z'] && p.fireCd === 0) {
    if (p.cls === 'mage') {
      if (p.mp >= 8) {
        p.mp -= 8; p.fireCd = zCd(); p.cast = 12;
        projs.push({ x: p.x + p.face * 20, y: p.y - 30, vx: p.face * 7.5, t: 70 });
        beep(880, 0.08, 'sawtooth', 0.03);
      } else { num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff'); p.fireCd = 20; }
    } else {
      if (p.mp >= 4) {
        p.mp -= 4; p.fireCd = zCd(); p.cast = 10; p.slashT = 10;
        beep(500, 0.05, 'square', 0.03);
        let hit = 0;
        for (const m of mons.slice()) {
          const dx = (m.x - p.x) * p.face;
          const dy = Math.abs((m.y - m.h / 2) - (p.y - p.h / 2));
          if (dx > -12 && dx < 85 && dy < 55 && hit < 3) {
            hit++;
            const r = playerDmg();
            hitMon(m, r.d, r.crit);
          }
        }
      } else { num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff'); p.fireCd = 20; }
    }
  }
  if (keys['x'] && p.boltCd === 0) {
    const xMul = 1 + 0.15 * p.cd.xdmg;
    if (p.cls === 'mage') {
      if (p.mp >= 20) {
        p.mp -= 20; p.boltCd = xCd(); p.cast = 14;
        let hit = 0;
        for (const m of mons.slice()) {
          if (Math.abs(m.x - p.x) < 240 && hit < 4) {
            hit++;
            bolts.push({ x: m.x, y: m.y - m.h / 2, t: 14 });
            const r = playerDmg();
            hitMon(m, Math.round(r.d * 1.8 * xMul), r.crit);
          }
        }
        if (hit === 0) num(p.x, p.y - p.h - 10, '沒有目標', '#aaa');
        else beep(140, 0.25, 'sawtooth', 0.05);
      } else { num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff'); p.boltCd = 60; }
    } else {
      if (p.mp >= 15) {
        p.mp -= 15; p.boltCd = xCd(); p.cast = 12; p.spinT = 14;
        let hit = 0;
        for (const m of mons.slice()) {
          if (Math.abs(m.x - p.x) < 100 && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 70 && hit < 6) {
            hit++;
            const r = playerDmg();
            hitMon(m, Math.round(r.d * 1.5 * xMul), r.crit);
          }
        }
        beep(300, 0.15, 'sawtooth', 0.05);
        if (hit === 0) num(p.x, p.y - p.h - 10, '沒有目標', '#aaa');
      } else { num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff'); p.boltCd = 60; }
    }
  }

  // projectiles
  for (const pr of projs.slice()) {
    pr.x += pr.vx; pr.t--;
    let gone = pr.t <= 0;
    for (const m of mons) {
      if (Math.abs(pr.x - m.x) < m.w / 2 + 8 && Math.abs(pr.y - (m.y - m.h / 2)) < m.h / 2 + 10) {
        const r = playerDmg();
        hitMon(m, r.d, r.crit);
        burst(pr.x, pr.y, '#ff8c2e', 10);
        gone = true; break;
      }
    }
    if (gone) projs.splice(projs.indexOf(pr), 1);
  }

  // monsters
  for (const m of mons) {
    if (m.hitT > 0) m.hitT--;
    if (m.type === 'slime') {
      m.x += m.vx;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
    } else {
      m.t++;
      const ddx = p.x - m.x, ddy = (p.y - 26) - m.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist < 360) {
        // 俯衝追擊玩家
        const sp = Math.min(2.2, 1.1 + floor * 0.06);
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
      p.hp -= d; p.inv = 60;
      p.vx = (p.x < m.x ? -1 : 1) * 5; p.vy = -5; p.onGround = false;
      num(p.x, p.y - p.h - 10, '-' + d, '#ff6b6b');
      beep(180, 0.12, 'square', 0.05);
      if (p.hp <= 0) { p.hp = 0; burst(p.x, p.y - p.h / 2, '#ff6b6b', 24); endRun(); return; }
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

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#87c5f0'); g.addColorStop(0.7, '#c8e4f5'); g.addColorStop(1, '#e8f4fa');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of clouds) {
    const cx = ((c.x - camX * 0.3) % (worldW * 0.5) + worldW * 0.5) % (worldW * 0.5) - 100;
    ctx.fillRect(cx, c.y, c.w, 14);
    ctx.fillRect(cx + 10, c.y - 8, c.w - 24, 10);
  }
  ctx.fillStyle = '#a8d8a0';
  for (let i = 0; i < 8; i++) {
    const hx = i * 400 - (camX * 0.5) % 400 - 200;
    ctx.beginPath(); ctx.arc(hx + 200, 520, 150, Math.PI, 0); ctx.fill();
  }
  // depth tint
  const tint = Math.min(0.06 * (floor - 1), 0.45);
  if (tint > 0) { ctx.fillStyle = 'rgba(30,10,60,' + tint.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }

  ctx.save();
  ctx.translate(-Math.round(camX), 0);

  // platforms
  for (const q of plats) {
    const hgt = q.ground ? H - q.y : 14;
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(q.x, q.y, q.w, hgt);
    ctx.fillStyle = '#59b83a'; ctx.fillRect(q.x, q.y, q.w, 6);
    ctx.fillStyle = '#3f9127';
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
      const pulse = 1 + Math.sin(frame * 0.15) * 0.15;
      ctx.fillStyle = RARITY_COL[gd.it.r];
      ctx.fillRect(gd.x - 6 * pulse, gd.y - 14 - 2 * pulse, 12 * pulse, 12 * pulse);
      ctx.fillStyle = '#262a40';
      ctx.fillRect(gd.x - 3, gd.y - 11, 6, 6);
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
    const rows = m.type === 'slime' ? (m.elite ? ESLIME : SLIME) : BAT;
    drawSprite(rows, m.x - rows[0].length * m.s / 2, m.y - rows.length * m.s, m.s, m.vx < 0, m.hitT > 0);
    if (m.hp < m.mhp) {
      const bw = m.elite ? 44 : 34;
      ctx.fillStyle = '#222'; ctx.fillRect(m.x - bw / 2, m.y - m.h - 12, bw, 5);
      ctx.fillStyle = m.elite ? '#b05ae0' : '#e23b3b';
      ctx.fillRect(m.x - bw / 2 + 1, m.y - m.h - 11, (bw - 2) * Math.max(0, m.hp / m.mhp), 3);
    }
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
    drawSprite(FIRE, pr.x - 9, pr.y - 9, 3, pr.vx < 0);
    ctx.fillStyle = 'rgba(255,140,46,0.35)';
    ctx.fillRect(pr.x - pr.vx * 2 - 6, pr.y - 6, 12, 12);
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
  ctx.fillRect(0, 0, 250, 30);
  ctx.fillStyle = '#b05ae0';
  ctx.fillText('第 ' + floor + ' 層', 12, 20);
  ctx.fillStyle = '#c8cdec';
  ctx.fillText(portal ? '前往傳送門 →' : '殘存怪物 ' + mons.length, 100, 20);

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
  ctx.fillText('[C]紅水x' + p.bag.hp, 400, H - 4);
  ctx.fillStyle = p.bag.mp > 0 ? '#8aa8ff' : '#666';
  ctx.fillText('[V]藍水x' + p.bag.mp, 500, H - 4);
  ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillStyle = p.fireCd > 0 ? '#666' : '#ff8c2e';
  ctx.fillText(p.cls === 'mage' ? '[Z]火球' : '[Z]揮砍', 700, H - 26);
  ctx.fillStyle = p.boltCd > 0 ? '#666' : '#ffe680';
  ctx.fillText((p.cls === 'mage' ? '[X]落雷' : '[X]旋風斬') + (p.boltCd > 0 ? ' ' + Math.ceil(p.boltCd / 60) + 's' : ''), 700, H - 8);
  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = '#c8cdec';
  ctx.fillText('[I]裝備', 845, H - 8);

  if (floorT > 0) {
    ctx.globalAlpha = Math.min(1, floorT / 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('第 ' + floor + ' 層', W / 2, 180);
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
  if (it) drawGlyph(it.kind, sx + 22, sy + 22, RARITY_COL[it.r || 0]);
  ctx.textAlign = 'center';
  ctx.font = '10px "Courier New",monospace';
  ctx.fillStyle = it ? RARITY_COL[it.r || 0] : '#667';
  ctx.fillText(it ? it.name : label, sx + 22, sy + 56);
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
    ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillStyle = RARITY_COL[it.r || 0];
    ctx.fillText('[' + (i + 1) + ']' + it.name, bx, ry + 3);
    ctx.font = '10px "Courier New",monospace';
    ctx.fillStyle = '#8890b8';
    ctx.fillText(it.desc, bx + 118, ry + 3);
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
  ctx.fillText('x' + p.bag.hp + '[C]', bx + 12, py + 11);
  ctx.fillStyle = '#3b6fe2'; ctx.fillRect(bx + 70, py + 2, 8, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText('x' + p.bag.mp + '[V]', bx + 82, py + 11);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('靈魂 +' + soulsRun, bx + 140, py + 11);
}

// ---------- overlays ----------
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
    ctx.fillStyle = 'rgba(20,22,43,0.95)'; ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    pickBtns.push({ x: cx, y: cy, w: cw, h: ch, c: c });
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Courier New",monospace';
    ctx.fillText(c.name, cx + cw / 2, cy + 60);
    ctx.fillStyle = '#9ecbff'; ctx.font = '13px "Courier New",monospace';
    ctx.fillText(c.desc, cx + cw / 2, cy + 95);
    const lvNow = player.cd[c.id];
    if (lvNow > 0) {
      ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace';
      ctx.fillText('目前已疊 ' + lvNow + ' 層', cx + cw / 2, cy + 120);
    }
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
  ctx.fillStyle = Math.floor(frame / 30) % 2 === 0 ? '#ffe680' : '#8890b8';
  ctx.font = '15px "Courier New",monospace';
  ctx.fillText('按 Enter 或點擊 返回基地', W / 2, 360);
  ctx.textAlign = 'left';
}

// ---------- menu ----------
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
  expBtn = { x: 744, y: 30, w: 96, h: 28 };
  impBtn = { x: 848, y: 30, w: 96, h: 28 };
  for (const [b, label] of [[expBtn, '匯出存檔'], [impBtn, '匯入存檔']]) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#8890b8'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, b.x + b.w / 2, b.y + 18);
  }
  if (menuMsg) {
    ctx.fillStyle = menuMsg.color; ctx.font = 'bold 13px "Courier New",monospace';
    ctx.fillText(menuMsg.text, 844, 78);
    if (--menuMsg.t <= 0) menuMsg = null;
  }
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
  if (gameState === 'select') {
    renderMenu();
  } else {
    if (gameState === 'play') update();
    if (gameState !== 'select') render();
    if (gameState === 'pick') drawPick();
    if (gameState === 'dead') drawDead();
  }
  requestAnimationFrame(loop);
}
calcStats();
loop();
