"use strict";
const cv = document.getElementById('cv');
const W = 960, H = 540;
const ctx = cv.getContext('2d');
function configureCanvasResolution() {
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (cv.width !== bw || cv.height !== bh) {
    cv.width = bw; cv.height = bh;
  }
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
configureCanvasResolution();
window.addEventListener('resize', configureCanvasResolution);
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

// Skill artwork: 256px codex icons plus compact 72px horizontal VFX sheets.
const SKILL_ICON_FILES = {
  slash:11, spin:21, dash:52, quake:42, rage:62,
  fire:25, bolt:7, ice:59, meteor:1, shield:3
};
const skillIcons = {}, skillIconsGray = {};
for (const [id, n] of Object.entries(SKILL_ICON_FILES)) {
  const normal = new Image(), gray = new Image();
  normal.src = 'Skill/256x256px/Normal/' + n + ' Icon.png';
  gray.src = 'Skill/256x256px/Gray/' + n + ' Icon.png';
  skillIcons[id] = normal; skillIconsGray[id] = gray;
}
const SKILL_VFX_DEFS = {
  groundBurst:{ src:'Skill/1 Magic/1.png', frames:8 },
  rune:{ src:'Skill/1 Magic/2.png', frames:8 },
  beam:{ src:'Skill/1 Magic/3.png', frames:8 },
  slashBeam:{ src:'Skill/1 Magic/3_2.png', frames:8 },
  fireball:{ src:'Skill/1 Magic/4.png', frames:4 },
  fireballDiag:{ src:'Skill/1 Magic/4_1.png', frames:4 },
  explosion:{ src:'Skill/1 Magic/4_2.png', frames:4 },
  impact:{ src:'Skill/1 Magic/6.png', frames:4 },
  groundImpact:{ src:'Skill/1 Magic/6_2.png', frames:4 },
  iceSpikes:{ src:'Skill/1 Magic/7.png', frames:8 },
  roots:{ src:'Skill/1 Magic/8.png', frames:8 },
  smoke:{ src:'Skill/1 Magic/9.png', frames:8 },
  teleport:{ src:'Skill/1 Magic/10.png', frames:6 }
};
const skillVfxImages = {};
for (const [id, def] of Object.entries(SKILL_VFX_DEFS)) {
  const img = new Image(); img.src = def.src; skillVfxImages[id] = img;
}
let worldW = 2000;

function setHint(t) { document.getElementById('hint').innerHTML = t; }
const HINT_PLAY = '← → 移動&nbsp;|&nbsp;Space 跳躍(↓+Space 下跳)&nbsp;|&nbsp;Z / X / C 技能&nbsp;|&nbsp;A 紅水 S 藍水&nbsp;|&nbsp;I 裝備&nbsp;|&nbsp;P 能力';
const HINT_MENU = '[1]/[2] 選職業&nbsp;|&nbsp;點擊購買永久強化&nbsp;|&nbsp;Enter 開始冒險';
const HINT_TOWN = '方向鍵 / WASD 四方向移動 或 點擊地面走動&nbsp;|&nbsp;Space 與 NPC 互動&nbsp;|&nbsp;Enter 聊天&nbsp;|&nbsp;P 能力';

// ---------- audio ----------
let audioCtx = null;
let audioMaster = null, sfxLoading = false;
const AUDIO_KEY = 'pixelrogue_audio';
const audioSettings = { volume: 0.7, muted: false };
try {
  const savedAudio = JSON.parse(localStorage.getItem(AUDIO_KEY));
  if (savedAudio) {
    if (Number.isFinite(savedAudio.volume)) audioSettings.volume = Math.max(0, Math.min(1, savedAudio.volume));
    audioSettings.muted = !!savedAudio.muted;
  }
} catch (err) {}
const SFX_FILES = {
  swordSwing:'audio/sfx/sword_swing.ogg', hit:'audio/sfx/hit.ogg', critical:'audio/sfx/critical.ogg',
  hurt:'audio/sfx/player_hurt.ogg', pickup:'audio/sfx/pickup.ogg', chest:'audio/sfx/chest_open.ogg',
  uiSelect:'audio/sfx/ui_select.ogg', uiConfirm:'audio/sfx/ui_confirm.ogg', uiError:'audio/sfx/ui_error.ogg',
  enhanceSuccess:'audio/sfx/enhance_success.ogg', enhanceFail:'audio/sfx/enhance_fail.ogg', itemBreak:'audio/sfx/item_break.ogg',
  fire:'audio/sfx/spell_fire.ogg', lightning:'audio/sfx/spell_lightning.ogg', ice:'audio/sfx/spell_ice.ogg', meteor:'audio/sfx/spell_meteor.ogg'
};
const SFX_VOLUME = { swordSwing:0.55, hit:0.45, critical:0.62, hurt:0.58, pickup:0.48, chest:0.55, uiSelect:0.38, uiConfirm:0.48, uiError:0.45, enhanceSuccess:0.55, enhanceFail:0.52, itemBreak:0.68, fire:0.48, lightning:0.52, ice:0.46, meteor:0.58 };
const SFX_COOLDOWN = { hit:35, critical:45, hurt:80, pickup:55, uiSelect:50 };
const SFX_FALLBACK = { swordSwing:420, hit:520, critical:720, hurt:180, pickup:900, chest:620, uiSelect:600, uiConfirm:880, uiError:150, enhanceSuccess:960, enhanceFail:240, itemBreak:90, fire:760, lightning:920, ice:540, meteor:120 };
const sfxBuffers = {}, sfxLastAt = {};
function saveAudioSettings() {
  try { localStorage.setItem(AUDIO_KEY, JSON.stringify(audioSettings)); } catch (err) {}
}
function applyAudioVolume() {
  if (audioMaster && audioCtx) audioMaster.gain.setValueAtTime(audioSettings.muted ? 0 : audioSettings.volume, audioCtx.currentTime);
}
function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioMaster = audioCtx.createGain(); audioMaster.connect(audioCtx.destination); applyAudioVolume();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    preloadSfx();
  } catch (err) {}
}
async function preloadSfx() {
  if (!audioCtx || sfxLoading) return;
  sfxLoading = true;
  await Promise.all(Object.entries(SFX_FILES).map(async ([id, url]) => {
    if (sfxBuffers[id]) return;
    try {
      const res = await fetch(url); if (!res.ok) return;
      sfxBuffers[id] = await audioCtx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {}
  }));
  sfxLoading = false;
}
function playSfx(id, volume = 1, rate = 1) {
  if (!audioCtx || audioSettings.muted || audioSettings.volume <= 0) return;
  const now = performance.now(), gap = SFX_COOLDOWN[id] || 0;
  if (now - (sfxLastAt[id] || 0) < gap) return;
  sfxLastAt[id] = now;
  const buffer = sfxBuffers[id];
  if (!buffer) { beep(SFX_FALLBACK[id] || 500, 0.07, 'square', 0.025 * volume); return; }
  try {
    const src = audioCtx.createBufferSource(), gain = audioCtx.createGain();
    src.buffer = buffer; src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
    gain.gain.value = (SFX_VOLUME[id] || 0.5) * volume;
    src.connect(gain); gain.connect(audioMaster); src.start();
  } catch (err) {}
}
function changeSfxVolume(delta) {
  audioSettings.volume = Math.max(0, Math.min(1, Math.round((audioSettings.volume + delta) * 10) / 10));
  if (audioSettings.volume > 0) audioSettings.muted = false;
  applyAudioVolume(); saveAudioSettings(); playSfx('uiSelect');
}
function toggleSfxMute() {
  audioSettings.muted = !audioSettings.muted; applyAudioVolume(); saveAudioSettings();
  if (!audioSettings.muted) playSfx('uiConfirm');
}
function beep(f, d, type, v) {
  if (!audioCtx || audioSettings.muted || audioSettings.volume <= 0) return;
  try {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'square'; o.frequency.value = f;
    g.gain.value = v || 0.035;
    o.connect(g); g.connect(audioMaster || audioCtx.destination);
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
function drawEquippedAura(x, y, w, h) {
  const id = activityState && activityState.aura;
  if (!id || id === 'none' || !AURA_DEFS[id]) return;
  const col = AURA_DEFS[id].color, pulse = 0.72 + Math.sin(frame * 0.09) * 0.12;
  ctx.save();
  ctx.globalAlpha = 0.24 * pulse; ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.42, w * 1.25, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.82; ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y + h * 0.42, w * (1.05 + Math.sin(frame * 0.07) * 0.08), h * 0.18, 0, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const phase = (frame * (id === 'ember' ? 1.5 : 1) + i * 17) % 58;
    const px = x + Math.sin(i * 2.3 + frame * 0.045) * w * 0.82;
    const py = y + h * 0.45 - phase * 0.72;
    ctx.globalAlpha = Math.max(0, 0.82 - phase / 90); ctx.fillStyle = col;
    ctx.fillRect(Math.round(px) - 2, Math.round(py) - 2, id === 'ember' ? 4 : 3, id === 'ember' ? 4 : 3);
  }
  ctx.restore();
}

// ---------- meta progression ----------
const meta = {
  souls: 0, up: { atk: 0, vit: 0, crit: 0, guard: 0, haste: 0, pots: 0, treasure: 0, soul: 0, recovery: 0, alchemy: 0 },
  stash: [], mats: { enh: 0, ench: 0 }, stashSeq: 1,
  loadout: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  playerName: '勇者'
};
const GEAR_PARTS = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
const STASH_CAP = 30;
const AFFIX_REROLL_COST = [5, 8, 12];
const AFFIX_MAX_REROLLS = 3;
const AFFIX_RARE_CHANCE = 0.08;
const AFFIX_DEFS = [
  { id:'sharp',      name:'鋒銳',   stat:'atkPct',     min:0.08, max:0.15, fmt:'pct' },
  { id:'deadly',     name:'致命',   stat:'crit',       min:0.05, max:0.10, fmt:'pct' },
  { id:'savage',     name:'狂虐',   stat:'critDmg',    min:0.20, max:0.40, fmt:'pct' },
  { id:'leech',      name:'吸血',   stat:'lifesteal',  min:0.05, max:0.09, fmt:'pct' },
  { id:'haste',      name:'疾襲',   stat:'cooldown',   min:0.08, max:0.15, fmt:'pct' },
  { id:'fortified',  name:'堅壁',   stat:'hpPct',      min:0.08, max:0.15, fmt:'pct' },
  { id:'wall',       name:'銅牆',   stat:'def',        min:3,    max:6,    fmt:'int' },
  { id:'retaliate',  name:'荊棘',   stat:'thorns',     min:0.40, max:0.70, fmt:'pct' },
  { id:'swift',      name:'迅捷',   stat:'move',       min:0.3,  max:0.6,  fmt:'dec' },
  { id:'avarice',    name:'貪婪',   stat:'soulGain',   min:0.12, max:0.22, fmt:'pct' },
  { id:'finder',     name:'尋寶',   stat:'gearDrop',   min:0.06, max:0.12, fmt:'pct' },
  { id:'manaSpring', name:'靈泉',   stat:'mpKill',     min:4,    max:7,    fmt:'int' },
  { id:'wings',      name:'羽翼',   stat:'doubleJump', min:1,    max:1,    fmt:'bool', parts:['boots','acc'] },
  { id:'bloodrage',  name:'嗜血狂', stat:'lowHpAtk',   min:0.40, max:0.40, fmt:'pct', rare:true, minR:2 },
  { id:'undying',    name:'不滅',   stat:'undying',    min:1,    max:1,    fmt:'bool', rare:true, minR:2, parts:['acc'] }
];
const AFFIX_BY_ID = Object.fromEntries(AFFIX_DEFS.map(d => [d.id, d]));
function affixSlots(r) { return [1, 1, 2, 2, 3][r] || 1; }
function normalizeGear(it) {
  if (!it) return it;
  const slots = affixSlots(it.r);
  const src = Array.isArray(it.affixes) ? it.affixes.slice(0, slots) : [];
  it.affixes = Array.from({ length: slots }, (_, i) => {
    const a = src[i], d = a && AFFIX_BY_ID[a.id];
    if (!d || !Number.isFinite(Number(a.val))) return null;
    return { id: d.id, val: Number(a.val), rerolls: Math.max(0, Math.min(AFFIX_MAX_REROLLS, a.rerolls | 0)) };
  });
  return it;
}
function affixAllowed(d, it) {
  return (!d.minR || it.r >= d.minR) && (!d.parts || d.parts.includes(it.kind));
}
function rollAffix(it, slot, previousId) {
  normalizeGear(it);
  const used = new Set(it.affixes.filter((a, i) => a && i !== slot).map(a => a.id));
  let pool = AFFIX_DEFS.filter(d => affixAllowed(d, it) && !used.has(d.id) && d.id !== previousId);
  const common = pool.filter(d => !d.rare);
  const rare = pool.filter(d => d.rare);
  pool = rare.length && Math.random() < AFFIX_RARE_CHANCE ? rare : common;
  if (!pool.length) return null;
  const d = pool[(Math.random() * pool.length) | 0];
  const band = it.r <= 1 ? [0, 0.6] : it.r <= 3 ? [0.3, 0.85] : [0.6, 1];
  const q = band[0] + Math.random() * (band[1] - band[0]);
  let val = d.min + (d.max - d.min) * q;
  val = d.fmt === 'int' ? Math.round(val) : d.fmt === 'bool' ? 1 : Math.round(val * 1000) / 1000;
  return { id: d.id, val: val, rerolls: 0 };
}
function affixV(stat) {
  let total = 0;
  if (!player || !player.eq) return total;
  for (const part of GEAR_PARTS) {
    const it = player.eq[part];
    for (const a of (it && it.affixes) || []) {
      const d = a && AFFIX_BY_ID[a.id];
      if (d && d.stat === stat) total += Number(a.val) || 0;
    }
  }
  return total;
}
function affixText(a) {
  const d = a && AFFIX_BY_ID[a.id];
  if (!d) return '空槽';
  const value = d.fmt === 'bool' ? '' : d.fmt === 'pct' ? ' +' + Math.round(a.val * 100) + '%' : ' +' + (d.fmt === 'int' ? Math.round(a.val) : a.val.toFixed(1));
  return (d.rare ? '★' : '') + d.name + value;
}
let enchantAnim = null;
function enchantGearSlot(it, slot) {
  normalizeGear(it);
  if (slot < 0 || slot >= it.affixes.length) return;
  const old = it.affixes[slot];
  const rerolls = old ? old.rerolls | 0 : 0;
  if (old && rerolls >= AFFIX_MAX_REROLLS) return;
  const cost = old ? AFFIX_REROLL_COST[rerolls] : 3;
  if (meta.mats.ench < cost) {
    menuMsg = { text: '附魔塵不足(需 ' + cost + ')', color: '#ff5a5a', t: 180 };
    beep(150, 0.1, 'square', 0.04); return;
  }
  const rolled = rollAffix(it, slot, old && old.id);
  if (!rolled) return;
  meta.mats.ench -= cost;
  rolled.rerolls = old ? rerolls + 1 : 0;
  it.affixes[slot] = rolled;
  enchantAnim = { t: 55, text: affixText(rolled), rare: !!AFFIX_BY_ID[rolled.id].rare };
  menuMsg = { text: (old ? '重洗完成：' : '附魔完成：') + affixText(rolled), color: '#d9a8ff', t: 180 };
  saveMeta();
  playSfx('enhanceSuccess', 0.8, AFFIX_BY_ID[rolled.id].rare ? 1.12 : 1);
}
function matFor(r) { return [{ enh: 1, ench: 0 }, { enh: 3, ench: 1 }, { enh: 6, ench: 3 }, { enh: 10, ench: 6 }, { enh: 16, ench: 10 }][r] || { enh: 1, ench: 0 }; }
function addMat(r) { const m = matFor(r); meta.mats.enh += m.enh; meta.mats.ench += m.ench; return m; }
function stashGear(it) { // 存入倉庫;已在庫(開局帶出的)跳過;滿則轉材料
  if (it.uid && meta.stash.some(s => s.uid === it.uid)) return true;
  if (meta.stash.length >= STASH_CAP) { addMat(it.r); return false; }
  normalizeGear(it);
  it.uid = meta.stashSeq++;
  meta.stash.push(it);
  return true;
}
const META_DEFS = [
  { id:'atk',      group:'combat',   name:'攻擊強化', desc:'攻擊 +4%/級',          max:10, cost:l => 20 + l * 15 },
  { id:'vit',      group:'combat',   name:'體魄強化', desc:'HP上限 +8%/級',        max:10, cost:l => 20 + l * 15 },
  { id:'crit',     group:'combat',   name:'精準訓練', desc:'爆擊率 +0.5%/級',      max:5,  cost:l => 35 + l * 25 },
  { id:'guard',    group:'combat',   name:'防禦本能', desc:'受到傷害 -1%/級',      max:5,  cost:l => 40 + l * 30 },
  { id:'haste',    group:'combat',   name:'戰技熟練', desc:'技能冷卻 -1.5%/級',    max:5,  cost:l => 45 + l * 35 },
  { id:'pots',     group:'adventure', name:'起始藥水', desc:'開局紅藍藥水 +1/級', max:3,  cost:l => 30 + l * 25 },
  { id:'treasure', group:'adventure', name:'尋寶直覺', desc:'裝備掉落率 +1%/級',  max:5,  cost:l => 40 + l * 30 },
  { id:'soul',     group:'adventure', name:'靈魂共鳴', desc:'靈魂獲取 +5%/級',    max:5,  cost:l => 50 + l * 40 },
  { id:'recovery', group:'adventure', name:'營火調息', desc:'自然回復速度 +10%/級', max:5, cost:l => 30 + l * 20 },
  { id:'alchemy',  group:'adventure', name:'藥劑調和', desc:'藥水回復量 +5%/級',   max:5,  cost:l => 35 + l * 25 }
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
  slash:  { cls:'warrior', name:'揮砍',   mp:4,  cd:45, minCd:18, basic:true, desc:'近戰扇形攻擊,最多3目標' },
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
const TALENT_EFFECTS = {
  slash:[{ lv3:'擊退目標', lv5:'必定爆擊' }, { lv3:'目標上限+2', lv5:'第3擊強化且免費' }],
  spin:[{ lv3:'將敵人拉向中心', lv5:'追加龍捲餘波' }, { lv3:'縮圈但傷害+35%', lv5:'擊殺重置冷卻' }],
  dash:[{ lv3:'距離與無敵時間提升', lv5:'留下疾風劍軌' }, { lv3:'命中使受傷+20%', lv5:'低血目標傷害+50%' }],
  quake:[{ lv3:'0.3秒後再次餘震', lv5:'餘震擊飛並擴大' }, { lv3:'對低血目標加傷', lv5:'擊殺引發崩裂爆破' }],
  rage:[{ lv3:'低血時攻擊加成提升', lv5:'低血狂怒並附帶吸血' }, { lv3:'持續延長2秒', lv5:'擊殺延長狂暴' }],
  fire:[{ lv3:'命中產生範圍爆炸', lv5:'爆炸留下燃燒地面' }, { lv3:'彈射額外2個目標', lv5:'彈射3次且逐次加傷' }],
  bolt:[{ lv3:'目標上限+2', lv5:'雷暴追加第二次落雷' }, { lv3:'集中單體傷害+60%', lv5:'必定爆擊並麻痺' }],
  ice:[{ lv3:'緩速延長為5秒', lv5:'命中凍結1.5秒' }, { lv3:'每穿透一體傷害提升', lv5:'命中噴發冰刺碎片' }],
  meteor:[{ lv3:'落地留下燃燒區', lv5:'天火區域擴大且延長' }, { lv3:'改為單顆巨型隕石', lv5:'落地0.4秒後二次衝擊' }],
  shield:[{ lv3:'護盾量45%且延長5秒', lv5:'破盾時回復12 MP' }, { lv3:'吸收時反彈20%攻擊', lv5:'破盾引發奧術爆破' }]
};
const skillState = {}; // id -> {unl, pts, spent, branch(-1未選/0=A/1=B)}
for (const id of SKILL_IDS) skillState[id] = { unl: SKILL_DEFS[id].basic ? 1 : 0, pts: 0, spent: 0, branch: -1 };
const loadouts = { warrior: ['slash', null, null], mage: ['fire', null, null] };
let menuTab = 'base', selSkill = null, pendingReset = null, selStash = null, pendingStashDel = null;
function classSkills(cls) { return SKILL_IDS.filter(id => SKILL_DEFS[id].cls === cls); }
// Lv1 基礎數值、Lv2 流派、Lv3 機制、Lv4 冷卻、Lv5 終極效果。
function talentOf(id) {
  const s = skillState[id];
  const t = { id, level:s.spent, branch:s.branch, dmg:1, area:1, cd:1, mechanic:s.spent >= 3, ultimate:s.spent >= 5 };
  if (s.spent >= 1) t.dmg *= 1.12;
  if (s.spent >= 2) { if (s.branch === 0) t.area *= 1.25; else t.dmg *= 1.2; }
  if (s.spent >= 4) t.cd *= 0.85;
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
function assignSkillSlot(id, slot) {
  const lo = loadouts[chosenCls];
  if (!skillState[id] || !skillState[id].unl || slot < 0 || slot >= lo.length) return;
  const current = lo.indexOf(id);
  if (current === slot) {
    if (lo.filter(Boolean).length <= 1) { menuMsg = { text: '至少要裝備一招技能', color: '#ff5a5a', t: 180 }; playSfx('uiError'); return; }
    lo[slot] = null;
  } else {
    if (current >= 0) lo[current] = null;
    lo[slot] = id;
  }
  saveMeta();
  playSfx('uiConfirm', 0.75);
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
// 前 5 項維持舊版順序，確保 localStorage 與 v1/v2 存檔碼可直接升級。
const UP_IDS = ['atk', 'vit', 'pots', 'treasure', 'soul', 'crit', 'guard', 'haste', 'recovery', 'alchemy'];
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
    if (d && Array.isArray(d.st)) meta.stash = d.st.filter(it => it && GEAR_PARTS.indexOf(it.kind) >= 0).map(normalizeGear);
    if (d && d.mt) meta.mats = { enh: Math.max(0, d.mt.enh | 0), ench: Math.max(0, d.mt.ench | 0) };
    if (d && d.lo) for (const part of GEAR_PARTS) meta.loadout[part] = d.lo[part] || null;
    if (d && d.sq) meta.stashSeq = Math.max(1, d.sq | 0);
    if (d && typeof d.pn === 'string' && d.pn.trim()) meta.playerName = d.pn.slice(0, 12);
  } catch (e) {}
}
function saveChk(a) { let s = 7; for (const v of a) s = (s * 31 + v) % 99991; return s; }
function encodeSave() {
  const a = [3, meta.souls, ...UP_IDS.map(id => meta.up[id]), bestFloor, ...skillsToNums()];
  a.push(saveChk(a));
  return btoa(a.join(','));
}
const V2_LEN = 1 + 1 + 5 + 1 + 46 + 1; // 版本+靈魂+強化5+最深層+技能46+校驗
const V3_LEN = 1 + 1 + 10 + 1 + 46 + 1; // 版本+靈魂+強化10+最深層+技能46+校驗
function decodeSave(str) {
  try {
    const a = atob(String(str).trim()).split(',').map(Number);
    const v1 = a.length === 9 && a[0] === 1;
    const v2 = a.length === V2_LEN && a[0] === 2;
    const v3 = a.length === V3_LEN && a[0] === 3;
    if ((!v1 && !v2 && !v3) || a.some(v => !Number.isFinite(v))) return null;
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
  const upCount = a[0] >= 3 ? 10 : 5;
  applyMeta(a[1], a.slice(2, 2 + upCount), a[2 + upCount]);
  if (a[0] >= 2) applySkillNums(a.slice(3 + upCount, 3 + upCount + 46)); // v1 舊碼:技能維持預設
  saveMeta();
  menuMsg = { text: '匯入成功!靈魂 ' + meta.souls, color: '#7dffd6', t: 240 };
  beep(900, 0.1, 'sine', 0.04);
}
loadMeta();

// ---------- adventure contracts / weekly activity ----------
const ACTIVITY_KEY = 'pixelrogue_activity_v1';
const DAILY_TASK_GROUPS = [
  [
    { id:'daily_kills_20', stat:'kills', title:'快速清剿', desc:'擊敗 20 隻怪物', target:20, points:10 },
    { id:'daily_kills_30', stat:'kills', title:'魔物掃蕩', desc:'擊敗 30 隻怪物', target:30, points:10 },
    { id:'daily_elites_3', stat:'elites', title:'菁英獵手', desc:'擊敗 3 隻菁英怪', target:3, points:10 },
    { id:'daily_elites_5', stat:'elites', title:'強敵追獵', desc:'擊敗 5 隻菁英怪', target:5, points:10 }
  ],
  [
    { id:'daily_floors_2', stat:'floors', title:'短程探索', desc:'通過 2 個樓層', target:2, points:10 },
    { id:'daily_floors_4', stat:'floors', title:'深入地城', desc:'通過 4 個樓層', target:4, points:10 },
    { id:'daily_boss_1', stat:'bosses', title:'首領討伐', desc:'擊敗 1 隻地城首領', target:1, points:10 },
    { id:'daily_floors_5', stat:'floors', title:'深層遠征', desc:'通過 5 個樓層', target:5, points:10 }
  ],
  [
    { id:'daily_skills_12', stat:'skills', title:'技能熱身', desc:'成功施放 12 次技能', target:12, points:10 },
    { id:'daily_skills_20', stat:'skills', title:'磨練技藝', desc:'成功施放 20 次技能', target:20, points:10 },
    { id:'daily_potions_3', stat:'potions', title:'補給測試', desc:'使用 3 瓶藥水', target:3, points:10 },
    { id:'daily_potions_5', stat:'potions', title:'藥劑實戰', desc:'使用 5 瓶藥水', target:5, points:10 }
  ]
];
const WEEKLY_TASK_GROUPS = [
  [
    { id:'weekly_kills_120', stat:'kills', title:'本週討伐', desc:'擊敗 120 隻怪物', target:120, points:30 },
    { id:'weekly_kills_180', stat:'kills', title:'大規模掃蕩', desc:'擊敗 180 隻怪物', target:180, points:30 },
    { id:'weekly_elites_15', stat:'elites', title:'菁英清算', desc:'擊敗 15 隻菁英怪', target:15, points:30 },
    { id:'weekly_elites_25', stat:'elites', title:'強敵殲滅', desc:'擊敗 25 隻菁英怪', target:25, points:30 }
  ],
  [
    { id:'weekly_floors_15', stat:'floors', title:'地城巡禮', desc:'累計通過 15 個樓層', target:15, points:30 },
    { id:'weekly_floors_25', stat:'floors', title:'地城遠征', desc:'累計通過 25 個樓層', target:25, points:30 },
    { id:'weekly_bosses_2', stat:'bosses', title:'首領獵人', desc:'擊敗 2 隻地城首領', target:2, points:30 },
    { id:'weekly_bosses_4', stat:'bosses', title:'王者終結者', desc:'擊敗 4 隻地城首領', target:4, points:30 }
  ],
  [
    { id:'weekly_skills_80', stat:'skills', title:'技能修行', desc:'成功施放 80 次技能', target:80, points:30 },
    { id:'weekly_skills_120', stat:'skills', title:'奧義鍛鍊', desc:'成功施放 120 次技能', target:120, points:30 },
    { id:'weekly_potions_20', stat:'potions', title:'戰地補給', desc:'使用 20 瓶藥水', target:20, points:30 },
    { id:'weekly_potions_30', stat:'potions', title:'藥劑達人', desc:'使用 30 瓶藥水', target:30, points:30 }
  ]
];
const DAILY_TASKS = DAILY_TASK_GROUPS.flat(), WEEKLY_TASKS = WEEKLY_TASK_GROUPS.flat();
const ACTIVITY_STATS = ['kills','floors','skills','bosses','elites','potions'];
const ACTIVITY_MILESTONES = [
  { points:50, label:'強化石 x2', enh:2, ench:0 },
  { points:120, label:'餘燼光環＋附魔塵 x2', enh:0, ench:2, aura:'ember' },
  { points:220, label:'虛空光環＋石 x4／塵 x3', enh:4, ench:3, aura:'void' }
];
const AURA_DEFS = {
  none:{ name:'無光環', color:'#8890b8' },
  ember:{ name:'餘燼光環', color:'#ff8c2e' },
  void:{ name:'虛空光環', color:'#b05ae0' }
};
const activityState = {
  day:'', week:'', activity:0,
  daily:{ kills:0, floors:0, skills:0, bosses:0, elites:0, potions:0 }, weekly:{ kills:0, floors:0, skills:0, bosses:0, elites:0, potions:0 },
  dailyTaskIds:[], weeklyTaskIds:[],
  claimedDaily:{}, claimedWeekly:{}, milestones:{}, cosmetics:['none'], aura:'none'
};
function emptyActivityCounters() { return Object.fromEntries(ACTIVITY_STATS.map(id => [id, 0])); }
function localDayKey(date) {
  const d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function localWeekKey(date) {
  const d = new Date((date || new Date()).getTime()); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDayKey(d);
}
function rotatingTaskIds(groups, periodKey) {
  const serial = Math.floor(new Date(periodKey + 'T12:00:00').getTime() / 86400000);
  return groups.map((group, i) => group[((serial + i * 2) % group.length + group.length) % group.length].id);
}
function currentActivityTasks(scope) {
  const daily = scope === 'daily', ids = daily ? activityState.dailyTaskIds : activityState.weeklyTaskIds;
  const pool = daily ? DAILY_TASKS : WEEKLY_TASKS;
  return ids.map(id => pool.find(t => t.id === id)).filter(Boolean);
}
function saveActivity() {
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activityState)); } catch (err) {}
}
function refreshActivityPeriods(now) {
  const day = localDayKey(now), week = localWeekKey(now);
  let changed = false;
  if (activityState.week !== week) {
    activityState.week = week; activityState.activity = 0;
    activityState.weekly = emptyActivityCounters();
    activityState.weeklyTaskIds = rotatingTaskIds(WEEKLY_TASK_GROUPS, week);
    activityState.claimedWeekly = {}; activityState.milestones = {};
    changed = true;
  }
  if (activityState.day !== day) {
    activityState.day = day;
    activityState.daily = emptyActivityCounters();
    activityState.dailyTaskIds = rotatingTaskIds(DAILY_TASK_GROUPS, day);
    activityState.claimedDaily = {};
    changed = true;
  }
  if (activityState.dailyTaskIds.length !== 3) { activityState.dailyTaskIds = rotatingTaskIds(DAILY_TASK_GROUPS, day); changed = true; }
  if (activityState.weeklyTaskIds.length !== 3) { activityState.weeklyTaskIds = rotatingTaskIds(WEEKLY_TASK_GROUPS, week); changed = true; }
  if (changed) saveActivity();
}
function loadActivity() {
  try {
    const d = JSON.parse(localStorage.getItem(ACTIVITY_KEY));
    if (d && typeof d === 'object') {
      activityState.day = typeof d.day === 'string' ? d.day : '';
      activityState.week = typeof d.week === 'string' ? d.week : '';
      activityState.activity = Math.max(0, Math.min(300, d.activity | 0));
      for (const scope of ['daily','weekly']) for (const stat of ACTIVITY_STATS) activityState[scope][stat] = Math.max(0, (d[scope] && d[scope][stat]) | 0);
      activityState.dailyTaskIds = Array.isArray(d.dailyTaskIds) ? d.dailyTaskIds.filter(id => DAILY_TASKS.some(t => t.id === id)).slice(0, 3) : [];
      activityState.weeklyTaskIds = Array.isArray(d.weeklyTaskIds) ? d.weeklyTaskIds.filter(id => WEEKLY_TASKS.some(t => t.id === id)).slice(0, 3) : [];
      activityState.claimedDaily = d.claimedDaily && typeof d.claimedDaily === 'object' ? d.claimedDaily : {};
      activityState.claimedWeekly = d.claimedWeekly && typeof d.claimedWeekly === 'object' ? d.claimedWeekly : {};
      activityState.milestones = d.milestones && typeof d.milestones === 'object' ? d.milestones : {};
      activityState.cosmetics = Array.isArray(d.cosmetics) ? d.cosmetics.filter(id => AURA_DEFS[id]) : ['none'];
      if (!activityState.cosmetics.includes('none')) activityState.cosmetics.unshift('none');
      activityState.aura = activityState.cosmetics.includes(d.aura) ? d.aura : 'none';
    }
  } catch (err) {}
  refreshActivityPeriods();
}
function activityProgress(stat, amount) {
  refreshActivityPeriods();
  if (!ACTIVITY_STATS.includes(stat)) return;
  const n = Math.max(0, amount == null ? 1 : amount | 0);
  activityState.daily[stat] = Math.max(0, (activityState.daily[stat] || 0) + n);
  activityState.weekly[stat] = Math.max(0, (activityState.weekly[stat] || 0) + n);
  saveActivity();
}
function claimActivityTask(scope, id) {
  refreshActivityPeriods();
  const daily = scope === 'daily', defs = currentActivityTasks(scope);
  const task = defs.find(t => t.id === id), claims = daily ? activityState.claimedDaily : activityState.claimedWeekly;
  const progress = daily ? activityState.daily : activityState.weekly;
  if (!task || claims[id] || (progress[task.stat] || 0) < task.target) return;
  claims[id] = true; activityState.activity = Math.min(300, activityState.activity + task.points);
  saveActivity();
  menuMsg = { text: task.title + ' 完成：活躍 +' + task.points, color:'#7dffd6', t:240 };
  playSfx('uiConfirm');
}
function claimActivityMilestone(points) {
  refreshActivityPeriods();
  const reward = ACTIVITY_MILESTONES.find(r => r.points === points);
  if (!reward || activityState.milestones[points] || activityState.activity < points) return;
  activityState.milestones[points] = true;
  meta.mats.enh += reward.enh || 0; meta.mats.ench += reward.ench || 0;
  if (reward.aura && !activityState.cosmetics.includes(reward.aura)) {
    activityState.cosmetics.push(reward.aura); activityState.aura = reward.aura;
  }
  saveMeta(); saveActivity();
  menuMsg = { text:'活躍 ' + points + ' 獎勵：' + reward.label, color:'#ffe680', t:300 };
  playSfx('enhanceSuccess');
}
function equipAura(id) {
  if (!activityState.cosmetics.includes(id) || !AURA_DEFS[id]) return;
  activityState.aura = id; saveActivity(); playSfx('uiSelect', 0.7);
}
function hasActivityReward() {
  refreshActivityPeriods();
  const taskReady = (defs, progress, claims) => defs.some(t => !claims[t.id] && (progress[t.stat] || 0) >= t.target);
  return taskReady(currentActivityTasks('daily'), activityState.daily, activityState.claimedDaily)
    || taskReady(currentActivityTasks('weekly'), activityState.weekly, activityState.claimedWeekly)
    || ACTIVITY_MILESTONES.some(m => !activityState.milestones[m.points] && activityState.activity >= m.points);
}
loadActivity();

// ---------- state ----------
let gameState = 'select';
let chosenCls = 'warrior';
const CLASSES = { warrior: { name: '劍士', col: '#c84a4a' }, mage: { name: '法師', col: '#5a4ad0' } };
let frame = 0;
let floor = 1, kills = 0, soulsRun = 0, floorT = 0, gearSeq = 1;
let portal = null;
let floorEvent = null, eventPanel = null;
const eventChoiceBtns = [];
let lastRun = null;
let pendingPicks = 0, pickOpts = [];
let plats = [], mons = [];
const projs = [], dmgNums = [], parts = [], orbs = [], drops = [], gearDrops = [], bolts = [], espits = [], meteors = [], skillZones = [], skillAnims = [];
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
  x: 80, y: 468, vx: 0, vy: 0, w: 26, h: 46, face: 1,
  onGround: false, dropT: 0, inv: 0, cast: 0, slotCd: [0, 0, 0], walk: 0,
  slashT: 0, spinT: 0, potCd: 0, rageT: 0, rageAtk: 0, rageSpd: 0, rageLifesteal: 0, rageExtend: 0, rageBlood: false, rageUltimate: false,
  shieldHp: 0, shieldT: 0, shieldReflect: 0, shieldBreakMp: 0, shieldBurst: false, chillT: 0, cls: 'warrior', skillCasts: {},
  perk: {}, revives: 0, affixDeathUsed: false, eventAtk: 0, aegisCd: 0, airJumped: false,
  lv: 1, hp: 100, mhp: 100, mp: 30, mmp: 30, xp: 0,
  bag: { hp: 0, mp: 0 }, eq: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  items: [], itemWin: false,
  cd: { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0, def: 0, heal: 0, ifr: 0 }
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
  { id:'aspd', r:0, stat:1, name:'迅捷出手', desc:'技能冷卻 -10%' },
  { id:'xdmg', r:0, stat:1, name:'絕技精通', desc:'技能傷害 +15%' },
  { id:'ls',   r:0, stat:1, name:'嗜血',     desc:'擊殺回復 3 HP' },
  { id:'mp',   r:0, stat:1, name:'心靈之泉', desc:'MP上限+15 回魔+50%' },
  { id:'pot',  r:0, stat:1, name:'藥劑師',   desc:'藥水掉落率 +4%' },
  { id:'def',  r:0, stat:1, name:'鋼鐵皮膚', desc:'固定減傷 +1' },
  { id:'heal', r:0, stat:1, name:'藥效增幅', desc:'藥水回復量 +10%' },
  { id:'ifr',  r:0, stat:1, name:'閃避本能', desc:'受傷無敵時間 +0.1秒' },
  // 稀有:特殊被動(走 perk)
  { id:'vamp',   r:1, name:'吸血鬼',   desc:'造成傷害回復 6% HP' },
  { id:'thorns', r:1, name:'荊棘護甲', desc:'受擊反彈 40% 攻擊力' },
  { id:'djump',  r:1, name:'羽翼',     desc:'可空中二段跳' },
  { id:'mana',   r:1, name:'法力循環', desc:'擊殺回復 5 MP' },
  { id:'greed',  r:1, name:'貪婪',     desc:'靈魂獲取 +10%' },
  { id:'aegis',  r:1, name:'守護結界', desc:'每12秒獲得護盾' },
  { id:'bloodpact', r:1, name:'血祭', desc:'HP上限-15% 攻擊+30%' },
  { id:'focus',   r:1, name:'完美狀態', desc:'HP達95%時攻擊 +8%' },
  { id:'execute', r:1, name:'處決者',   desc:'對低於25% HP敵人傷害 +10%' },
  { id:'camp',    r:1, name:'層間休整', desc:'進入新樓層回復 5% HP與MP' },
  { id:'barrier', r:1, name:'守門護盾', desc:'進入樓層獲得 5% HP護盾' },
  // 傳說:強力/獨特(走 perk)
  { id:'berserk', r:2, name:'絕地反擊', desc:'HP<35%時攻擊+50%' },
  { id:'chain',   r:2, name:'連鎖爆炸', desc:'擊殺時範圍爆炸' },
  { id:'phoenix', r:2, name:'不死鳥',   desc:'每場一次致死復活' },
  { id:'brute',   r:2, name:'蠻力',     desc:'攻擊+40% 攻速-18%' },
  { id:'glass',   r:2, name:'玻璃大砲', desc:'攻擊+45% 受傷+25%' },
  { id:'overcharge', r:2, name:'奧術超載', desc:'MP達70%時技能傷害 +10%' },
  { id:'echo',       r:2, name:'技能迴響', desc:'施放技能有 4%機率立即冷卻' }
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
  playSfx('uiConfirm');
  pendingPicks--;
  if (pendingPicks > 0) rollPick();
  else gameState = 'play';
}

// ---------- derived stats ----------
function enhMul(it) { return it ? 1 + 0.05 * (it.enh || 0) : 1; } // 強化 +5%/級
function eqStat(slot, key) { const it = player.eq[slot]; return it && it[key] ? it[key] * enhMul(it) : 0; }
function accV(f) { return eqStat('acc', f); }
function atkBase() {
  const p = player;
  return 8 + p.lv * 2.5 + eqStat('weapon', 'atk') + (p.cls === 'warrior' ? 4 : 0);
}
function atkMultiplier() {
  const p = player;
  let m = (1 + 0.12 * p.cd.atk) * (1 + 0.04 * meta.up.atk) * (1 + accV('atkMul')) * (1 + affixV('atkPct')) * (1 + (p.eventAtk || 0)) * (p.rageT > 0 ? 1 + (p.rageAtk || 0.3) : 1);
  m *= (1 + 0.30 * perkV('bloodpact')) * (1 + 0.40 * perkV('brute')) * (1 + 0.45 * perkV('glass'));
  if (p.hp >= p.mhp * 0.95) m *= 1 + 0.08 * perkV('focus');
  if (p.hp < p.mhp * 0.35) m *= (1 + 0.50 * perkV('berserk')) * (1 + affixV('lowHpAtk')); // 絕地反擊/嗜血狂
  return m;
}
function atkPow() { return atkBase() * atkMultiplier(); }
function critRate() { return 0.08 + 0.06 * player.cd.crit + 0.005 * meta.up.crit + accV('crit') + affixV('crit'); }
function armorDef() {
  return Math.round(eqStat('armor', 'def') + eqStat('helmet', 'def') + affixV('def') + player.cd.def);
}
function moveSpd() { return (1.6 + 0.4 * player.cd.spd + eqStat('boots', 'spd') + affixV('move') + (player.rageT > 0 ? player.rageSpd || 0.8 : 0)) * (player.chillT > 0 ? 0.55 : 1); }
function jumpV() { return 11.5 + (player.eq.boots && player.eq.boots.jmp ? player.eq.boots.jmp : 0); }
function skillDamageMul() { return (1 + 0.15 * player.cd.xdmg) * (player.mp >= player.mmp * 0.7 ? 1 + 0.1 * perkV('overcharge') : 1); }
function cooldownMul() { return Math.pow(0.9, player.cd.aspd) * (1 + 0.18 * perkV('brute')) * Math.max(0.35, 1 - affixV('cooldown')) * (1 - 0.015 * meta.up.haste); }
function potionDropChance() { return 0.07 + 0.04 * player.cd.pot; }
function gearDropChance(elite, atFloor = floor) {
  const base = Math.min(0.025 + 0.0025 * atFloor + 0.01 * meta.up.treasure, 0.10);
  return Math.min(base + affixV('gearDrop') + (elite ? 0.15 : 0), 0.50);
}
function soulGainMul() { return (1 + 0.05 * meta.up.soul) * (1 + 0.1 * perkV('greed')) * (1 + affixV('soulGain')); }
const SOUL_DROP_CHANCE = 0.25;
function calcStats() {
  const p = player;
  const gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  p.mhp = Math.round((60 + (p.cls === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp) * (1 + 0.08 * meta.up.vit) * (1 + affixV('hpPct')) * Math.max(0.4, 1 - 0.15 * perkV('bloodpact')));
  p.mmp = 30 + (p.cls === 'mage' ? 15 : 0) + p.lv * 4 + 15 * p.cd.mp;
  if (p.hp > p.mhp) p.hp = p.mhp;
  if (p.mp > p.mmp) p.mp = p.mmp;
}
// A floor should grant roughly one level early on, then gradually slow down.
function xpNeed(l) { return Math.round(50 + 30 * l + 5 * l * l); }
function playerDmg() {
  const crit = Math.random() < critRate();
  const d = Math.round(atkPow() * (0.85 + Math.random() * 0.3) * (crit ? 1.6 + affixV('critDmg') : 1));
  return { d: d, crit: crit };
}
function skillDmg(mult) { // 絕技精通卡:全部出戰技能傷害+15%/層
  const r = playerDmg();
  return { d: Math.max(1, Math.round(r.d * mult * skillDamageMul())), crit: r.crit };
}
function dmgPlayer(d) { // 玩家受傷統一入口(護盾吸收→扣血→死亡)
  const p = player;
  d = Math.max(1, Math.round(d * (1 + 0.25 * perkV('glass')) * (1 - 0.01 * meta.up.guard))); // 玻璃大砲／永久防禦本能
  const thorns = 0.4 * perkV('thorns') + affixV('thorns');
  if (thorns > 0) { // 荊棘護甲/荊棘詞綴:反彈周圍敵人
    const td = Math.max(1, Math.round(atkPow() * thorns));
    for (const o of mons.slice()) {
      if (o.type !== 'boss' && Math.abs(o.x - p.x) < 90 && Math.abs((o.y - o.h / 2) - (p.y - p.h / 2)) < 80) hitMon(o, td, false, true);
    }
  }
  if (p.shieldHp > 0) {
    const ab = Math.min(p.shieldHp, d);
    p.shieldHp -= ab; d -= ab;
    if (p.shieldReflect > 0 && ab > 0) {
      const rd = Math.max(1, Math.round(atkPow() * p.shieldReflect));
      for (const m of mons.slice()) if (Math.abs(m.x - p.x) < 100 && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 85) hitMon(m, rd, false, true);
    }
    if (p.shieldHp <= 0) {
      num(p.x, p.y - p.h - 24, '護盾破碎', '#7dcfff');
      if (p.shieldBreakMp > 0) { p.mp = Math.min(p.mmp, p.mp + p.shieldBreakMp); num(p.x, p.y - p.h - 40, '+' + p.shieldBreakMp + ' MP', '#9ecbff'); }
      if (p.shieldBurst) {
        burst(p.x, p.y - p.h / 2, '#d9a8ff', 28);
        skillAreaDamage(p.x, p.y - p.h / 2, 120, 100, 1.25, '#d9a8ff');
      }
      p.shieldReflect = 0; p.shieldBreakMp = 0; p.shieldBurst = false;
    }
    if (d <= 0) { p.inv = 30 + 3 * p.cd.ifr; num(p.x, p.y - p.h - 10, '吸收', '#7dcfff'); beep(500, 0.06, 'sine', 0.03); return false; }
  }
  p.hp -= d; p.inv = 60 + 6 * p.cd.ifr;
  num(p.x, p.y - p.h - 10, '-' + d, '#ff6b6b');
  playSfx('hurt');
  if (p.hp <= 0) {
    if (p.revives > 0) { // 不死鳥:每場一次致死復活
      p.revives--; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#ffd23e', 30);
      num(p.x, p.y - p.h - 20, '不死鳥復活!', '#ffd23e');
      beep(880, 0.2, 'sine', 0.05); setTimeout(() => beep(1100, 0.2, 'sine', 0.05), 120);
      return false;
    }
    if (affixV('undying') > 0 && !p.affixDeathUsed) {
      p.affixDeathUsed = true; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#d9a8ff', 30);
      num(p.x, p.y - p.h - 20, '不滅發動!', '#d9a8ff');
      beep(740, 0.2, 'sine', 0.05); setTimeout(() => beep(1040, 0.2, 'sine', 0.05), 120);
      return false;
    }
    p.hp = 0; burst(p.x, p.y - p.h / 2, '#ff6b6b', 24); endRun(); return true;
  }
  return false;
}
function skillAreaDamage(x, y, rx, ry, mult, color, opts) {
  opts = opts || {};
  let hit = 0, killed = 0;
  for (const m of mons.slice()) {
    if (opts.exclude && opts.exclude.has(m)) continue;
    if (Math.abs(m.x - x) > rx + m.w / 2 || Math.abs((m.y - m.h / 2) - y) > ry + m.h / 2) continue;
    const before = m.hp;
    let bonus = mult;
    if (opts.lowHp && m.hp / m.mhp < opts.lowHp) bonus *= opts.lowMul || 1.35;
    const r = skillDmg(bonus);
    hitMon(m, r.d, opts.forceCrit || r.crit);
    hit++;
    if (before > 0 && m.hp <= 0) killed++;
    if (opts.knock && mons.includes(m) && m.type !== 'boss') m.x = Math.max(18, Math.min(worldW - 18, m.x + Math.sign(m.x - x || player.face) * opts.knock));
    burst(m.x, m.y - m.h / 2, color || '#ffd23e', opts.particles || 6);
  }
  return { hit, killed };
}
function chainSkillTargets(start, seen, hops, mult, grow) {
  let cur = start, count = 0, power = mult;
  while (count < hops) {
    let next = null, best = 220;
    for (const m of mons) {
      if (seen.has(m)) continue;
      const dist = Math.hypot(m.x - cur.x, (m.y - m.h / 2) - (cur.y - cur.h / 2));
      if (dist < best) { best = dist; next = m; }
    }
    if (!next) break;
    seen.add(next); count++; power *= grow;
    bolts.push({ x:next.x, y:next.y - next.h / 2, x0:cur.x, y0:cur.y - cur.h / 2, t:12, chain:true });
    const r = skillDmg(power); hitMon(next, r.d, r.crit);
    cur = next;
  }
  return count;
}
function addSkillZone(kind, x, y, rx, ry, delay, duration, interval, mult, color, opts) {
  skillZones.push({ kind, x, y, rx, ry, delay:delay || 0, t:duration, maxT:duration, interval:interval || duration, mult, color, opts:opts || {}, fired:false });
}
function playSkillAnim(key, x, y, options) {
  if (!SKILL_VFX_DEFS[key]) return;
  const o = options || {}, life = o.life || SKILL_VFX_DEFS[key].frames * 4;
  skillAnims.push({ key, x, y, life, maxLife:life, scale:o.scale || 1, flip:!!o.flip, rotation:o.rotation || 0, alpha:o.alpha == null ? 1 : o.alpha, layer:o.layer || 'front' });
}
function drawSkillVfxFrame(key, x, y, frameIndex, scale, flip, rotation, alpha) {
  const def = SKILL_VFX_DEFS[key], img = skillVfxImages[key];
  if (!def || !img || !img.complete || !img.naturalWidth) return false;
  const fi = Math.max(0, Math.min(def.frames - 1, frameIndex % def.frames));
  const size = 72 * (scale || 1);
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (rotation) ctx.rotate(rotation);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.drawImage(img, fi * 72, 0, 72, 72, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
function drawSkillAnimations(layer) {
  for (const a of skillAnims) {
    if (a.layer !== layer) continue;
    const def = SKILL_VFX_DEFS[a.key], elapsed = a.maxLife - a.life;
    const fi = Math.min(def.frames - 1, Math.floor(elapsed / a.maxLife * def.frames));
    drawSkillVfxFrame(a.key, a.x, a.y, fi, a.scale, a.flip, a.rotation, a.alpha);
  }
}
function playZoneAnim(z) {
  if (z.kind === 'burn' || z.kind === 'sunfire') playSkillAnim('groundBurst', z.x, z.y - 30, { scale:Math.max(1, z.rx / 58), layer:'back', alpha:0.82 });
  else if (z.kind === 'aftershock' || z.kind === 'rupture') playSkillAnim('roots', z.x, z.y - 30, { scale:Math.max(1, z.rx / 64), layer:'back' });
  else if (z.kind === 'impact') playSkillAnim('groundImpact', z.x, z.y - 30, { scale:Math.max(1, z.rx / 64), layer:'back' });
  else if (z.kind === 'thunder') playSkillAnim('impact', z.x, z.y, { scale:1.05 });
  else if (z.kind === 'wind' || z.kind === 'whirlwind') playSkillAnim('smoke', z.x, z.y, { scale:Math.max(1.1, z.rx / 74), layer:'back', alpha:0.75 });
}
// 技能效果:回傳 false = 施放失敗(不扣MP不進CD)
const SKILL_FX = {
  slash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    playSkillAnim('slashBeam', p.x + p.face * 42, p.y - 30, { scale:1.05 * t.area, flip:p.face < 0, rotation:p.face < 0 ? -0.08 : 0.08 });
    playSfx('swordSwing');
    p.skillCasts.slash = (p.skillCasts.slash || 0) + 1;
    const combo = t.ultimate && t.branch === 1 && p.skillCasts.slash % 3 === 0;
    const maxTargets = t.mechanic && t.branch === 1 ? 5 : 3;
    let hit = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      const dy = Math.abs((m.y - m.h / 2) - (p.y - p.h / 2));
      if (dx > -12 && dx < 85 * t.area && dy < 55 && hit < maxTargets) {
        hit++;
        const r = skillDmg(t.dmg * (combo ? 1.5 : 1));
        hitMon(m, r.d, (t.ultimate && t.branch === 0) || r.crit);
        if (t.mechanic && t.branch === 0 && mons.includes(m) && m.type !== 'boss') m.x = Math.max(18, Math.min(worldW - 18, m.x + p.face * 34));
      }
    }
    if (combo) { num(p.x, p.y - p.h - 25, '連擊·無消耗!', '#ffe680'); burst(p.x, p.y - 24, '#ffe680', 16); return { free:true }; }
  },
  spin(t) {
    const p = player;
    const tight = t.mechanic && t.branch === 1;
    const radius = 100 * t.area * (tight ? 0.82 : 1), beforeKills = kills;
    let hit = 0;
    for (const m of mons.slice()) {
      if (Math.abs(m.x - p.x) < radius && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 70 * t.area && hit < 6) {
        hit++;
        const r = skillDmg(1.5 * t.dmg * (tight ? 1.35 : 1));
        hitMon(m, r.d, r.crit);
        if (t.mechanic && t.branch === 0 && mons.includes(m) && m.type !== 'boss') m.x += (p.x - m.x) * 0.32;
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 12; p.spinT = 14;
    playSkillAnim('rune', p.x, p.y - 28, { scale:Math.max(1.55, radius / 60), layer:'back', alpha:0.85 });
    playSfx('swordSwing', 0.85, 0.82);
    if (t.ultimate && t.branch === 0) addSkillZone('whirlwind', p.x, p.y - 28, radius * 1.1, 85, 18, 1, 1, 1.2 * t.dmg, '#e8a84c', { knock:18 });
    if (t.ultimate && t.branch === 1 && kills > beforeKills) { num(p.x, p.y - p.h - 22, '利刃重置!', '#ffe680'); return { resetCd:true }; }
  },
  dash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    const x0 = p.x;
    const dashMul = t.mechanic && t.branch === 0 ? 1.35 : 1;
    const nx = Math.max(14, Math.min(worldW - 14, p.x + p.face * 130 * t.area * dashMul));
    const lo2 = Math.min(x0, nx) - 20, hi = Math.max(x0, nx) + 20;
    for (const m of mons.slice()) {
      if (m.x > lo2 && m.x < hi && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 60) {
        const lowBonus = t.ultimate && t.branch === 1 && m.hp / m.mhp < 0.3 ? 1.5 : 1;
        const r = skillDmg(1.3 * t.dmg * lowBonus);
        hitMon(m, r.d, r.crit);
        if (t.mechanic && t.branch === 1 && mons.includes(m)) { m.vulnT = 180; m.vulnMul = 1.2; num(m.x, m.y - m.h - 20, '破陣', '#ffb080'); }
      }
    }
    for (let i = 0; i < 8; i++) parts.push({ x: x0 + (nx - x0) * i / 8, y: p.y - 20, vx: 0, vy: -0.5, t: 14, color: '#c8cdec' });
    playSkillAnim('smoke', x0, p.y - 28, { scale:1.1, flip:p.face < 0, layer:'back', alpha:0.75 });
    playSkillAnim('teleport', nx, p.y - 30, { scale:1.05, flip:p.face < 0, alpha:0.8 });
    p.x = nx; p.inv = Math.max(p.inv, t.mechanic && t.branch === 0 ? 25 : 10);
    if (t.ultimate && t.branch === 0) addSkillZone('wind', (x0 + nx) / 2, p.y - 24, Math.abs(nx - x0) / 2 + 20, 52, 8, 1, 1, 1.1 * t.dmg, '#8ec9df');
    playSfx('swordSwing', 0.9, 1.16);
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
        const lowBonus = t.mechanic && t.branch === 1 && m.hp / m.mhp < 0.5 ? 1.35 : 1;
        const mx = m.x, my = m.y - m.h / 2, before = m.hp;
        const r = skillDmg(1.6 * t.dmg * lowBonus);
        hitMon(m, r.d, r.crit);
        burst(mx, my, '#d8b365', 8);
        if (t.ultimate && t.branch === 1 && before > 0 && m.hp <= 0) addSkillZone('rupture', mx, my, 78, 70, 1, 1, 1, 1.15 * t.dmg, '#d8b365');
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 12;
    playSkillAnim('groundImpact', p.x + p.face * range * 0.55, p.y - 31, { scale:Math.max(1.35, range / 115), flip:p.face < 0, layer:'back' });
    for (let i = 1; i < 6; i++) parts.push({ x: p.x + p.face * i * range / 6, y: p.y - 2, vx: 0, vy: -2 - Math.random(), t: 18, color: '#d8b365' });
    if (t.mechanic && t.branch === 0) addSkillZone('aftershock', p.x + p.face * range / 2, p.y - 25, range / 2, 80, 18, 1, 1, 1.15 * t.dmg, '#d8b365', t.ultimate ? { knock:55 } : {});
    beep(120, 0.2, 'sawtooth', 0.05);
  },
  rage(t) {
    const p = player;
    const blood = t.branch === 0, low = p.hp / p.mhp < 0.5;
    p.rageT = Math.round((t.mechanic && t.branch === 1 ? 480 : 360) * t.area);
    p.rageAtk = blood && low ? (t.ultimate ? 0.65 : 0.45) : 0.3;
    p.rageSpd = blood && low ? 1.1 : 0.8;
    p.rageLifesteal = blood && low && t.ultimate ? 0.08 : 0;
    p.rageExtend = t.ultimate && t.branch === 1 ? 90 : 0;
    p.rageBlood = blood; p.rageUltimate = t.ultimate;
    p.cast = 8;
    playSkillAnim('groundBurst', p.x, p.y - 31, { scale:t.ultimate ? 1.75 : 1.35, layer:'back' });
    burst(p.x, p.y - p.h / 2, '#ff5a5a', 20);
    beep(200, 0.2, 'square', 0.05);
  },
  fire(t) {
    const p = player;
    p.cast = 12;
    projs.push({ x: p.x + p.face * 20, y: p.y - 30, vx: p.face * 7.5, t: 70, mult: t.dmg, kind: 'fire', talent:t });
    playSfx('fire');
  },
  bolt(t) {
    const p = player;
    const focused = t.mechanic && t.branch === 1, cap = focused ? 1 : t.mechanic && t.branch === 0 ? 6 : 4;
    let hit = 0;
    for (const m of mons.slice()) {
      if (Math.abs(m.x - p.x) < 240 * t.area && hit < cap) {
        hit++;
        bolts.push({ x: m.x, y: m.y - m.h / 2, t: 14 });
        playSkillAnim('beam', m.x, m.y - m.h / 2 - 25, { scale:focused ? 1.55 : 1.15, rotation:Math.PI / 2, layer:'back', alpha:0.72 });
        playSkillAnim('impact', m.x, m.y - m.h / 2, { scale:focused ? 1.35 : 1 });
        const r = skillDmg(1.8 * t.dmg * (focused ? 1.6 : 1));
        hitMon(m, r.d, (t.ultimate && t.branch === 1) || r.crit);
        if (t.ultimate && t.branch === 1 && mons.includes(m)) { m.freezeT = Math.max(m.freezeT || 0, 60); num(m.x, m.y - m.h - 20, '麻痺', '#ffe680'); }
        if (t.ultimate && t.branch === 0 && mons.includes(m)) addSkillZone('thunder', m.x, m.y - m.h / 2, 52, 58, 18, 1, 1, 1.1 * t.dmg, '#ffe680');
      }
    }
    if (hit === 0) { num(p.x, p.y - p.h - 10, '沒有目標', '#aaa'); return false; }
    p.cast = 14;
    playSfx('lightning');
  },
  ice(t) {
    const p = player;
    p.cast = 12;
    projs.push({ x: p.x + p.face * 20, y: p.y - 30, vx: p.face * 6.5, t: 90, mult: t.dmg, kind: 'ice', pierce: true, hits: [], pierceN:0, talent:t });
    playSfx('ice');
  },
  meteor(t) {
    const p = player;
    p.cast = 14;
    const giant = t.mechanic && t.branch === 1, count = giant ? 1 : 3;
    for (let i = 0; i < count; i++) {
      meteors.push({
        x: p.x + p.face * (giant ? 150 : 70 + i * 90) + (Math.random() - 0.5) * 30,
        y: 40 - i * 50, vy: giant ? 6 : 7, r: 55 * t.area * (giant ? 1.65 : 1), mult:2.2 * t.dmg * (giant ? 2.1 : 1), talent:t
      });
    }
    playSfx('meteor');
  },
  shield(t) {
    const p = player;
    const wall = t.mechanic && t.branch === 0;
    p.shieldHp = Math.round(p.mhp * (wall ? 0.45 : 0.3) * t.dmg);
    p.shieldT = wall ? 900 : 600;
    p.shieldBreakMp = t.ultimate && t.branch === 0 ? 12 : 0;
    p.shieldReflect = t.mechanic && t.branch === 1 ? 0.2 : 0;
    p.shieldBurst = t.ultimate && t.branch === 1;
    p.cast = 10;
    playSkillAnim('rune', p.x, p.y - p.h / 2, { scale:1.2, layer:'back', alpha:0.85 });
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
  const result = SKILL_FX[id](t);
  if (result === false) { p.slotCd[i] = 20; return; }
  activityProgress('skills', 1);
  if (!result || !result.free) p.mp -= def.mp;
  p.slotCd[i] = result && result.resetCd ? 0 : Math.max(def.minCd || 6, Math.round(def.cd * t.cd * cooldownMul()));
  if (p.slotCd[i] > 0 && perkV('echo') > 0 && Math.random() < 0.04 * perkV('echo')) {
    p.slotCd[i] = 0;
    num(p.x, p.y - p.h - 24, '技能迴響!', '#ffd23e');
    playSfx('uiConfirm', 0.55, 1.15);
  }
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
  const it = { kind: slot, r: r, id: 'g' + (gearSeq++), affixes: Array(affixSlots(r)).fill(null) };
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
  playSfx('pickup');
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
function monsterHp(base, sc, n, extraMul = 1) {
  const endurance = 1.5 + Math.min(0.75, 0.025 * (n - 1));
  return Math.round(base * sc * endurance * extraMul);
}
function spawnMon(type, n, sc, xpSc, eliteCh) {
  if (type === 'bat') {
    const bx = 350 + Math.random() * (worldW - 550);
    const by = 170 + Math.random() * 140;
    const hp = monsterHp(20, sc, n);
    mons.push({ type:'bat', x: bx, y: by, ax: bx, ay: by, t: Math.random() * 200,
      hp, mhp: hp, xpv: Math.round(16 * xpSc),
      dmg: Math.round(10 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  const wide = plats.filter(q => !q.ground && q.w > 120);
  const pl = (Math.random() < 0.62 || wide.length === 0) ? plats[0] : wide[(Math.random() * wide.length) | 0]; // 6 成生在地面,其餘上平台
  const sx = pl.ground ? 200 + Math.random() * (worldW - 350) : pl.x + 30 + Math.random() * (pl.w - 60);
  const minx = Math.max(pl.x + 20, sx - 140), maxx = Math.min(pl.x + pl.w - 20, sx + 140);
  if (type === 'mush') {
    const hp = monsterHp(30, sc, n);
    mons.push({ type:'mush', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), vy: 0, onG: true, jt: 30 + Math.random() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(14 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'spore') {
    const hp = monsterHp(22, sc, n);
    mons.push({ type:'spore', x: sx, y: pl.y, vx: (0.3 + Math.random() * 0.25) * (Math.random() < 0.5 ? -1 : 1), st: 60 + Math.random() * 60,
      minx, maxx, hp, mhp: hp, xpv: Math.round(18 * xpSc), dmg: Math.round(9 * sc), w: 34, h: 24, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'bomber') {
    const hp = monsterHp(24, sc, n);
    mons.push({ type:'bomber', x: sx, y: pl.y, baseY: pl.y, vx: 0, fuse: null, boom: false,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(7 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'charger') {
    const hp = monsterHp(34, sc, n);
    mons.push({ type:'charger', x: sx, y: pl.y, vx: (0.4 + Math.random() * 0.3) * (Math.random() < 0.5 ? -1 : 1), chg: 0, tel: 0, dir: 1,
      minx, maxx, hp, mhp: hp, xpv: Math.round(16 * xpSc), dmg: Math.round(9 * sc), w: 36, h: 20, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'icer') {
    const hp = monsterHp(28, sc, n);
    mons.push({ type:'icer', x: sx, y: pl.y, vx: (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
      minx, maxx, hp, mhp: hp, xpv: Math.round(13 * xpSc), dmg: Math.round(8 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
    return;
  }
  if (type === 'splitter') {
    const hp = monsterHp(30, sc, n);
    mons.push({ type:'splitter', x: sx, y: pl.y, baseY: pl.y, vx: (0.4 + Math.random() * 0.35) * (Math.random() < 0.5 ? -1 : 1), gen: 0,
      minx, maxx, hp, mhp: hp, xpv: Math.round(15 * xpSc), dmg: Math.round(8 * sc), w: 40, h: 26, hitT: 0, elite: false, s: 4 });
    return;
  }
  const elite = Math.random() < eliteCh;
  const hp = monsterHp(26, sc, n, elite ? 3.2 : 1);
  mons.push({ type:'slime', x: sx, y: pl.y, vx: (0.5 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1),
    minx, maxx, hp, mhp: hp, xpv: Math.round(12 * xpSc * (elite ? 3 : 1)),
    dmg: Math.round(8 * sc * (elite ? 1.6 : 1)),
    w: elite ? 46 : 34, h: elite ? 30 : 22, hitT: 0, elite: elite, s: elite ? 4 : 3 });
}
const FLOOR_EVENT_DEFS = {
  chest: { name:'寶箱房', color:'#ffd36a', title:'旅行者的寶箱', desc:'找到一只尚未開啟的寶箱。', choices:['開啟寶箱', '暫時離開'] },
  shrine: { name:'祭壇房', color:'#d9a8ff', title:'古老祭壇', desc:'祭壇回應你的意志，只能接受一種祝福。', choices:['血之祝福：失去20% HP，攻擊+12%', '生命祝福：回復35% HP與50% MP'] },
  challenge: { name:'事件房', color:'#ff8a6a', title:'封印的試煉', desc:'解除封印會喚醒三名菁英守衛。', choices:['接受試煉', '暫時離開'] }
};
function spawnFloorEvent(n) {
  floorEvent = null; eventPanel = null;
  if (n < 2 || n % 5 === 0 || Math.random() >= 0.45) return;
  const types = ['chest', 'shrine', 'challenge'];
  const type = types[(Math.random() * types.length) | 0];
  floorEvent = { type: type, x: Math.round(worldW * (0.46 + Math.random() * 0.24)), y: 468, status:'idle' };
}
function openFloorEvent() {
  if (!floorEvent || floorEvent.status !== 'idle') return false;
  if (Math.abs(player.x - floorEvent.x) > 54 || Math.abs(player.y - floorEvent.y) > 52) return false;
  eventPanel = { type: floorEvent.type };
  player.itemWin = false; keys.space = false;
  beep(620, 0.08, 'sine', 0.035);
  return true;
}
function spawnEventAmbush() {
  const sc = (1 + 0.3 * (floor - 1) + 0.02 * (floor - 1) * (floor - 1)) * (floor >= 21 ? 1.15 : 1);
  const hp = monsterHp(32, sc, floor, 2.4);
  for (let i = 0; i < 3; i++) {
    const x = Math.max(100, Math.min(worldW - 100, floorEvent.x + (i - 1) * 110));
    mons.push({ type:'slime', x:x, y:468, vx:(i === 1 ? 1 : i ? -1 : 1) * 0.9,
      minx:Math.max(20, x - 150), maxx:Math.min(worldW - 20, x + 150), hp:hp, mhp:hp,
      xpv:Math.round(22 * (1 + 0.15 * (floor - 1))), dmg:Math.round(11 * sc), w:46, h:30,
      hitT:0, elite:true, eventMon:true, s:4 });
  }
  portal = null;
  burst(floorEvent.x, floorEvent.y - 30, '#ff6b5a', 30);
  num(floorEvent.x, floorEvent.y - 78, '試煉開始!', '#ff8a6a');
  beep(150, 0.22, 'sawtooth', 0.055);
}
function chooseFloorEvent(choice) {
  if (!eventPanel || !floorEvent || floorEvent.status !== 'idle') { eventPanel = null; return; }
  const type = floorEvent.type;
  if (choice === 1 && type !== 'shrine') { eventPanel = null; return; }
  if (type === 'chest') {
    floorEvent.status = 'done';
    const rarity = Math.max(1, rollRarity(floor));
    gearDrops.push({ x:floorEvent.x, y:floorEvent.y - 34, vy:-4, vx:0, it:genGear(floor, rarity), t:1500, ground:468 });
    meta.mats.ench += 1; saveMeta();
    burst(floorEvent.x, floorEvent.y - 30, '#ffd36a', 24);
    num(floorEvent.x, floorEvent.y - 76, '裝備 + 附魔塵×1', '#ffd36a');
    playSfx('chest');
  } else if (type === 'shrine') {
    floorEvent.status = 'done';
    if (choice === 0) {
      const cost = Math.min(Math.max(0, player.hp - 1), Math.round(player.mhp * 0.2));
      player.hp -= cost; player.eventAtk = (player.eventAtk || 0) + 0.12;
      num(player.x, player.y - player.h - 18, '血之祝福 攻擊+12%', '#ff8a8a');
    } else {
      player.hp = Math.min(player.mhp, player.hp + Math.round(player.mhp * 0.35));
      player.mp = Math.min(player.mmp, player.mp + Math.round(player.mmp * 0.5));
      num(player.x, player.y - player.h - 18, '生命祝福', '#7dffd6');
    }
    burst(floorEvent.x, floorEvent.y - 42, '#d9a8ff', 28); playSfx('uiConfirm', 0.9, 1.08);
  } else if (type === 'challenge') {
    floorEvent.status = 'challenge'; spawnEventAmbush();
  }
  eventPanel = null;
}
function checkFloorEventReward() {
  if (!floorEvent || floorEvent.status !== 'challenge' || mons.some(m => m.eventMon)) return;
  floorEvent.status = 'done';
  const dust = 2 + Math.floor(floor / 10);
  meta.mats.ench += dust; saveMeta();
  const rarity = floor >= 15 ? 3 : 2;
  gearDrops.push({ x:floorEvent.x, y:floorEvent.y - 34, vy:-4.5, vx:0, it:genGear(floor, rarity), t:1800, ground:468 });
  burst(floorEvent.x, floorEvent.y - 38, '#ffd36a', 36);
  num(floorEvent.x, floorEvent.y - 84, '試煉完成! 稀有裝 + 附魔塵×' + dust, '#ffd36a');
  playSfx('enhanceSuccess', 0.85, 1.08);
}
function genFloor(n) {
  if (n % 5 === 0) { genBossFloor(n); return; }
  worldW = Math.min(1600 + n * 120, 2600);
  plats = [{ x: 0, y: 468, w: worldW, ground: true }];
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
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0; skillZones.length = 0; skillAnims.length = 0;
  spawnFloorEvent(n);
  floorT = 90;
}
function genBossFloor(n) {
  worldW = 1300;
  plats = [{ x: 0, y: 468, w: worldW, ground: true }];
  plats.push({ x: 170, y: 405, w: 150 });
  plats.push({ x: worldW - 320, y: 405, w: 150 });
  plats.push({ x: worldW / 2 - 80, y: 325, w: 160 });
  const sc = (1 + 0.3 * (n - 1) + 0.02 * (n - 1) * (n - 1)) * (n >= 21 ? 1.15 : 1);
  const hp = Math.round(800 * sc * 1.35); // Boss 小幅加厚，避免戰鬥過短
  mons = [{
    type: 'boss', x: worldW - 240, y: 468, vx: 0, vy: 0, t: 0, atkT: 120, tele: 0, phase: 1,
    hp: hp, mhp: hp, xpv: Math.round(150 * (1 + 0.15 * (n - 1))),
    dmg: Math.round(15 * sc), w: 84, h: 56, hitT: 0, elite: true, s: 7
  }];
  portal = null;
  floorEvent = null; eventPanel = null;
  projs.length = 0; drops.length = 0; gearDrops.length = 0; orbs.length = 0; bolts.length = 0; espits.length = 0; meteors.length = 0; skillZones.length = 0; skillAnims.length = 0;
  floorT = 150;
}
function spawnBossAdds(count) { // Boss 進階段召喚蝙蝠援軍(較弱,增加混亂壓力)
  const sc = (1 + 0.3 * (floor - 1) + 0.02 * (floor - 1) * (floor - 1)) * 0.7;
  for (let i = 0; i < count; i++) {
    const bx = 220 + Math.random() * (worldW - 440), by = 150 + Math.random() * 120;
    const hp = monsterHp(22, sc, floor);
    mons.push({ type: 'bat', x: bx, y: by, ax: bx, ay: by, t: Math.random() * 100, hp: hp, mhp: hp, xpv: 10, dmg: Math.round(8 * sc), w: 34, h: 22, hitT: 0, elite: false, s: 3 });
  }
  num(player.x, player.y - player.h - 30, '召喚援軍!', '#ff5a5a');
  beep(180, 0.2, 'sawtooth', 0.05);
}
function resetRun() {
  const p = player;
  p.cls = chosenCls;
  p.lv = 1; p.xp = 0;
  p.cd = { atk: 0, hp: 0, crit: 0, spd: 0, aspd: 0, xdmg: 0, ls: 0, mp: 0, pot: 0, def: 0, heal: 0, ifr: 0 };
  p.items = []; p.eq = { weapon: null, armor: null, helmet: null, boots: null, acc: null };
  for (const part of GEAR_PARTS) { // 從倉庫穿戴開局裝備(副本帶出,倉庫原件保留)
    const uid = meta.loadout[part];
    const src = uid ? meta.stash.find(s => s.uid === uid) : null;
    if (src) {
      const cp = Object.assign({}, src, { affixes: (src.affixes || []).map(a => a && Object.assign({}, a)) });
      p.items.push(cp); p.eq[part] = cp;
    }
  }
  p.bag = { hp: meta.up.pots, mp: meta.up.pots };
  p.x = 80; p.y = 468; p.vx = 0; p.vy = 0; p.face = 1;
  p.inv = 0; p.cast = 0; p.slotCd = [0, 0, 0]; p.potCd = 0; p.slashT = 0; p.spinT = 0;
  p.rageT = 0; p.rageAtk = 0; p.rageSpd = 0; p.rageLifesteal = 0; p.rageExtend = 0; p.rageBlood = false; p.rageUltimate = false;
  p.shieldHp = 0; p.shieldT = 0; p.shieldReflect = 0; p.shieldBreakMp = 0; p.shieldBurst = false; p.chillT = 0;
  p.skillCasts = {};
  p.perk = {}; p.revives = 0; p.affixDeathUsed = false; p.eventAtk = 0; p.aegisCd = 0; p.airJumped = false;
  p.itemWin = false; statsOpen = false;
  calcStats();
  p.hp = p.mhp; p.mp = p.mmp;
  floor = 1; kills = 0; soulsRun = 0; gearSeq = 1;
  pendingPicks = 0;
  dmgNums.length = 0; parts.length = 0;
  genFloor(1);
  if (perkV('barrier') > 0) p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.05 * perkV('barrier')));
  gameState = 'play';
  setHint(HINT_PLAY);
  beep(660, 0.1, 'sine', 0.04);
  setTimeout(() => beep(880, 0.15, 'sine', 0.04), 100);
}
function endRun() {
  const gained = Math.round(soulsRun * soulGainMul());
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
    portal = { x: worldW - 70, y: 468 };
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
  if (m.hp < m.mhp * 0.25 && perkV('execute') > 0) d = Math.max(1, Math.round(d * (1 + 0.1 * perkV('execute'))));
  if (m.vulnT > 0) d = Math.max(1, Math.round(d * (m.vulnMul || 1.2)));
  m.hp -= d; m.hitT = 8;
  const lifesteal = 0.06 * perkV('vamp') + affixV('lifesteal') + (player.rageT > 0 ? player.rageLifesteal || 0 : 0);
  if (lifesteal > 0) player.hp = Math.min(player.mhp, player.hp + d * lifesteal); // 吸血鬼/吸血詞綴
  num(m.x, m.y - m.h - 8, String(d), crit ? '#ffb020' : '#fff');
  burst(m.x, m.y - m.h / 2, '#ffd23e', 6);
  playSfx(crit ? 'critical' : 'hit');
  if (m.hp <= 0) {
    kills++;
    activityProgress('kills', 1);
    if (m.type === 'boss') activityProgress('bosses', 1);
    else if (m.elite) activityProgress('elites', 1);
    burst(m.x, m.y - m.h / 2, m.elite ? '#b05ae0' : (m.type === 'slime' ? '#63cf3c' : '#c0aaff'), m.elite ? 24 : 14);
    gainXp(m.xpv);
    if (player.cd.ls > 0) player.hp = Math.min(player.mhp, player.hp + 3 * player.cd.ls);
    if (player.rageT > 0 && player.rageExtend > 0) {
      player.rageT = Math.min(720, player.rageT + player.rageExtend);
      num(player.x, player.y - player.h - 28, '戰意延長', '#ff8a6a');
    }
    const killMp = 5 * perkV('mana') + affixV('mpKill');
    if (killMp > 0) player.mp = Math.min(player.mmp, player.mp + killMp); // 法力循環/靈泉
    if (!noChain && perkV('chain') > 0) { // 連鎖爆炸
      burst(m.x, m.y - m.h / 2, '#ffb020', 18);
      beep(150, 0.12, 'sawtooth', 0.05);
      const cd = Math.round(atkPow() * 1.5 * perkV('chain'));
      for (const o of mons.slice()) {
        if (o !== m && Math.abs(o.x - m.x) < 95 && Math.abs((o.y - o.h / 2) - (m.y - m.h / 2)) < 75) hitMon(o, cd, false, true);
      }
    }
    const orbN = m.eventMon ? 0 : m.type === 'boss' ? 8 : m.elite ? 2 : (Math.random() < SOUL_DROP_CHANCE ? 1 : 0);
    for (let i = 0; i < orbN; i++) {
      orbs.push({ x: m.x + (Math.random() - 0.5) * 16, y: m.y - m.h, vx: (Math.random() - 0.5) * 3, vy: -3 - Math.random() * 2, t: 0 });
    }
    if (!m.eventMon && Math.random() < potionDropChance()) {
      drops.push({
        x: m.x + 10, y: m.y - m.h, vy: -3.5, vx: (Math.random() - 0.5) * 2,
        type: Math.random() < 0.6 ? 'hp' : 'mp', t: 700, ground: m.type === 'bat' ? 468 : (m.baseY || m.y)
      });
    }
    if (m.type === 'boss') {
      // 保底傳說裝 + 追加一件隨機裝
      gearDrops.push({ x: m.x - 26, y: m.y - m.h, vy: -4, vx: -1.2, it: genGear(floor, floor >= 20 ? 4 : 3), t: 1500, ground: 468 }); // 保底史詩,深層傳說
      gearDrops.push({ x: m.x + 26, y: m.y - m.h, vy: -4, vx: 1.2, it: genGear(floor, 2), t: 1500, ground: 468 });
    } else if (!m.eventMon) {
      if (Math.random() < gearDropChance(m.elite)) {
        gearDrops.push({
          x: m.x - 10, y: m.y - m.h, vy: -3, vx: (Math.random() - 0.5) * 2,
          it: genGear(floor), t: 900, ground: m.type === 'bat' ? 468 : (m.baseY || m.y)
        });
      }
    }
    mons.splice(mons.indexOf(m), 1);
    checkFloorEventReward();
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
      portal = { x: worldW - 70, y: 468 };
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
  activityProgress('potions', 1);
  const potMul = (1 + 0.05 * meta.up.alchemy) * (1 + 0.1 * p.cd.heal);
  if (t === 'hp') { const heal = Math.round(60 * potMul); p.hp = Math.min(p.mhp, p.hp + heal); num(p.x, p.y - p.h - 10, '+' + heal + ' HP', '#7dff8a'); }
  else { const heal = Math.round(40 * potMul); p.mp = Math.min(p.mmp, p.mp + heal); num(p.x, p.y - p.h - 10, '+' + heal + ' MP', '#7f9cff'); }
  beep(1000, 0.07, 'sine', 0.04);
}

// ---------- input ----------
const keys = {};
const selBtns = [], metaBtns = [], itemBtns = [], delBtns = [];
let expBtn = null, impBtn = null, backTownBtn = null, gearBtn = null;
let metaCategory = 'combat';
let statsOpen = false, statsBtn = null, statsCloseBtn = null;
function openStats() { statsOpen = true; player.itemWin = false; }
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
  const mw = 540, mh = 340, mx = W / 2 - mw / 2, my = H / 2 - mh / 2;
  ctx.fillStyle = '#1a1c2c'; ctx.fillRect(mx, my, mw, mh);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, mw, mh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b05ae0'; ctx.font = 'bold 22px "Courier New",monospace'; ctx.fillText('設 定', W / 2, my + 38);
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px "Courier New",monospace'; ctx.fillText('名稱:' + (meta.playerName || '勇者'), W / 2, my + 70);
  ctx.fillStyle = '#8890b8'; ctx.font = '11px "Courier New",monospace'; ctx.fillText('存檔碼會自動存於瀏覽器;用「複製」可備份到別的裝置', W / 2, my + 92);
  ctx.fillStyle = audioSettings.muted ? '#ff8a8a' : '#7dffd6'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('音效音量：' + (audioSettings.muted ? '靜音' : Math.round(audioSettings.volume * 100) + '%'), W / 2, my + 121);
  const sm = (x, y, w, label, act, on) => { const b = { x, y, w, h:34, act }; settingsBtns.push(b); ctx.fillStyle = on ? 'rgba(125,255,214,0.22)' : 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y, w, 34); ctx.strokeStyle = on ? '#7dffd6' : '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 34); ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New",monospace'; ctx.fillText(label, x + w / 2, y + 22); };
  sm(mx + 54, my + 134, 92, '－ 10%', 'volDown', false);
  sm(mx + 156, my + 134, 92, '＋ 10%', 'volUp', false);
  sm(mx + 294, my + 134, 192, audioSettings.muted ? '開啟音效' : '靜音', 'mute', audioSettings.muted);
  const bw = 230, bh = 42, bx1 = W / 2 - bw - 10, bx2 = W / 2 + 10, byy = my + 184;
  const mk = (x, y, label, act, col) => { const b = { x, y, w: bw, h: bh, act }; settingsBtns.push(b); ctx.fillStyle = col || 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = '#44485f'; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh); ctx.fillStyle = '#fff'; ctx.font = 'bold 15px "Courier New",monospace'; ctx.fillText(label, x + bw / 2, y + 27); };
  mk(bx1, byy, '複製存檔碼', 'copy', 'rgba(125,255,214,0.2)');
  mk(bx2, byy, '匯入存檔', 'import');
  mk(bx1, byy + 52, '改名', 'rename');
  mk(bx2, byy + 52, '關閉', 'close', 'rgba(226,59,59,0.2)');
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
  keys[e.key === ' ' ? 'space' : e.key.toLowerCase()] = true;
  const k = e.key.toLowerCase();
  if (settingsOpen) { if (k === 'escape' && !settingsMode) { settingsOpen = false; closeSaveEdit(); } return; }
  if (statsOpen) { if (k === 'p' || k === 'escape') statsOpen = false; return; }
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
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 3) applyCard(pickOpts[n - 1]);
    return;
  }
  if (eventPanel) {
    if (k === '1' || k === '2') chooseFloorEvent(parseInt(k, 10) - 1);
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
  keys[e.key === ' ' ? 'space' : e.key.toLowerCase()] = false;
});
function handleTap(mx, my) {
  const inside = (b) => b && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
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
      if (b.act === 'volDown') { changeSfxVolume(-0.1); return; }
      if (b.act === 'volUp') { changeSfxVolume(0.1); return; }
      if (b.act === 'mute') { toggleSfxMute(); return; }
      if (b.act === 'close') { settingsOpen = false; closeSaveEdit(); return; }
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
        if (b.act === 'equip') { meta.loadout[sel.kind] = meta.loadout[sel.kind] === sel.uid ? null : sel.uid; saveMeta(); return; }
        if (b.act === 'enhance') { enhanceGear(sel); return; }
        if (b.act === 'enchant') { enchantGearSlot(sel, b.slot); return; }
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
  { x: 786, y: 396, w: 74, h: 74, label: 'Z', hold: 'z' },
  { x: 702, y: 396, w: 74, h: 74, label: 'X', hold: 'x' },
  { x: 618, y: 396, w: 74, h: 74, label: 'C', hold: 'c' },
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
function releaseVbtn(b) { if (b && b.hold) keys[b.hold] = false; }
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  unlockAudio();
  for (const t of e.changedTouches) {
    const [mx, my] = touchPos(t);
    if (eventPanel) { handleTap(mx, my); continue; }
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
  if (!isTouch || gameState !== 'play' || eventPanel) return;
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
  if (eventPanel) return;
  if (p.inv > 0) p.inv--;
  if (p.potCd > 0) p.potCd--;
  for (let i = 0; i < 3; i++) if (p.slotCd[i] > 0) p.slotCd[i]--;
  if (p.rageT > 0) {
    p.rageT--;
    if (p.rageBlood) {
      const low = p.hp / p.mhp < 0.5;
      p.rageAtk = low ? (p.rageUltimate ? 0.65 : 0.45) : 0.3;
      p.rageSpd = low ? 1.1 : 0.8;
      p.rageLifesteal = low && p.rageUltimate ? 0.08 : 0;
    }
    if (p.rageT === 0) { p.rageAtk = 0; p.rageSpd = 0; p.rageLifesteal = 0; p.rageExtend = 0; p.rageBlood = false; p.rageUltimate = false; }
  }
  if (p.chillT > 0) p.chillT--;
  if (p.shieldT > 0) {
    p.shieldT--;
    if (p.shieldT === 0) { p.shieldHp = 0; p.shieldReflect = 0; p.shieldBreakMp = 0; p.shieldBurst = false; }
  }
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

  if (keys['space'] && openFloorEvent()) return;

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
    } else if ((perkV('djump') > 0 || affixV('doubleJump') > 0) && !p.airJumped) { // 羽翼卡/詞綴:二段跳
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
  if (p.y > 600) { p.y = 468; p.vy = 0; p.onGround = true; p.airJumped = false; }

  // portal
  if (portal && Math.abs(p.x - portal.x) < 26 && p.y > 440) {
    floor++;
    activityProgress('floors', 1);
    const campHeal = 0.05 * perkV('camp');
    p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * (0.15 + campHeal)));
    if (campHeal > 0) p.mp = Math.min(p.mmp, p.mp + Math.round(p.mmp * campHeal));
    genFloor(floor);
    if (perkV('barrier') > 0) p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.05 * perkV('barrier')));
    p.x = 80; p.y = 468; p.vy = 0;
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
        const tt = pr.talent || { mechanic:false, ultimate:false, branch:-1 };
        const pierceBonus = pr.kind === 'ice' && tt.mechanic && tt.branch === 1 ? 1 + (pr.pierceN || 0) * 0.2 : 1;
        const r = skillDmg((pr.mult || 1) * pierceBonus);
        hitMon(m, r.d, r.crit);
        if (pr.kind === 'ice') {
          pr.pierceN = (pr.pierceN || 0) + 1;
          m.slowT = tt.mechanic && tt.branch === 0 ? 300 : 180;
          if (tt.ultimate && tt.branch === 0) { m.freezeT = Math.max(m.freezeT || 0, 90); num(m.x, m.y - m.h - 18, '凍結', '#d8f4ff'); }
          if (tt.ultimate && tt.branch === 1) skillAreaDamage(m.x, m.y - m.h / 2, 58, 55, 0.65 * pr.mult, '#d8f4ff', { exclude:new Set([m]), particles:5 });
          burst(pr.x, pr.y, '#7dcfff', 8);
          playSkillAnim('iceSpikes', m.x, m.y - 34, { scale:tt.ultimate ? 1.35 : 1.05, layer:'back' });
          pr.hits.push(m);
        } else {
          burst(pr.x, pr.y, '#ff8c2e', 10);
          playSkillAnim('explosion', m.x, m.y - m.h / 2, { scale:tt.ultimate ? 1.45 : 1.05 });
          if (tt.mechanic && tt.branch === 0) {
            skillAreaDamage(m.x, m.y - m.h / 2, 72 * tt.area, 62 * tt.area, 0.7 * pr.mult, '#ff8c2e', { exclude:new Set([m]), particles:8 });
            if (tt.ultimate) addSkillZone('burn', m.x, m.y, 78 * tt.area, 45, 0, 240, 30, 0.28 * pr.mult, '#ff6b2e');
          } else if (tt.mechanic && tt.branch === 1) {
            chainSkillTargets(m, new Set([m]), tt.ultimate ? 3 : 2, pr.mult, tt.ultimate ? 1.15 : 0.78);
          }
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
      playSkillAnim('groundBurst', mt.x, 462, { scale:Math.max(1.4, mt.r / 40), layer:'back' });
      playSkillAnim('explosion', mt.x, 455, { scale:Math.max(1.2, mt.r / 48) });
      beep(100, 0.2, 'sawtooth', 0.05);
      for (const m of mons.slice()) { // 落地範圍爆炸,補打附近地面怪
        if (mt.hits.indexOf(m) >= 0) continue;
        if (Math.abs(m.x - mt.x) < mt.r + m.w / 2 && Math.abs(m.y - 468) < 130) {
          const r = skillDmg(mt.mult); hitMon(m, r.d, r.crit);
        }
      }
      const tt = mt.talent || { mechanic:false, ultimate:false, branch:-1 };
      if (tt.mechanic && tt.branch === 0) {
        const zr = mt.r * (tt.ultimate ? 1.25 : 0.95), dur = tt.ultimate ? 360 : 210;
        addSkillZone('sunfire', mt.x, 468, zr, 48, 0, dur, 30, (tt.ultimate ? 0.38 : 0.28) * tt.dmg, '#ff7a36');
      }
      if (tt.ultimate && tt.branch === 1) addSkillZone('impact', mt.x, 445, mt.r * 1.15, 105, 24, 1, 1, 1.45 * tt.dmg, '#ffb04a', { knock:48 });
      meteors.splice(meteors.indexOf(mt), 1);
    }
  }

  for (const a of skillAnims.slice()) {
    a.life--;
    if (a.life <= 0) skillAnims.splice(skillAnims.indexOf(a), 1);
  }

  // 技能持續區域與延遲餘波
  for (const z of skillZones.slice()) {
    if (z.delay > 0) { z.delay--; continue; }
    z.t--;
    const pulse = !z.fired && z.maxT <= 1;
    const tick = z.maxT > 1 && z.t % z.interval === 0;
    if (pulse || tick) {
      z.fired = true;
      skillAreaDamage(z.x, z.y, z.rx, z.ry, z.mult, z.color, z.opts);
      burst(z.x, z.y, z.color, z.maxT > 1 ? 5 : 18);
      playZoneAnim(z);
      if (z.kind === 'thunder') bolts.push({ x:z.x, y:z.y, t:12 });
    }
    if (z.t <= 0) skillZones.splice(skillZones.indexOf(z), 1);
  }

  // monsters
  const MONSTER_MOVE_MUL = 0.72;
  for (const m of mons) {
    if (m.hitT > 0) m.hitT--;
    if (m.slowT > 0) m.slowT--;
    if (m.freezeT > 0) m.freezeT--;
    if (m.vulnT > 0) m.vulnT--; else m.vulnMul = 1;
    const slowF = m.freezeT > 0 ? 0 : m.slowT > 0 ? 0.5 : 1;
    const moveF = slowF * MONSTER_MOVE_MUL;
    if (m.type === 'slime' || m.type === 'icer' || m.type === 'splitter') {
      m.x += m.vx * moveF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
    } else if (m.type === 'mush') {
      m.x += m.vx * moveF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
      m.jt--;
      if (m.jt <= 0 && m.onG) { m.vy = -8.5; m.onG = false; m.jt = 70 + Math.random() * 40; }
      if (!m.onG) {
        m.vy += 0.5; m.y += m.vy;
        if (m.y >= m.baseY) { m.y = m.baseY; m.vy = 0; m.onG = true; }
      }
    } else if (m.type === 'spore') {
      m.x += m.vx * 0.5 * moveF;
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
      m.x += dir * 1.4 * moveF;
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
        m.x += m.dir * 7.5 * moveF;
        if (m.x < 40) { m.x = 40; m.chg = 0; }
        if (m.x > worldW - 40) { m.x = worldW - 40; m.chg = 0; }
        if (m.chg === 0) { m.minx = Math.max(20, m.x - 140); m.maxx = Math.min(worldW - 20, m.x + 140); } // 衝刺後巡邏範圍跟到當前位置,避免瞬移
      } else if (m.tel > 0) {
        m.tel--; m.hitT = 2;
        if (m.tel === 0) { m.chg = 26; beep(300, 0.1, 'sawtooth', 0.04); }
      } else {
        m.x += m.vx * moveF;
        if (m.x < m.minx) m.vx = Math.abs(m.vx); // 軟反彈,不設值避免瞬移
        if (m.x > m.maxx) m.vx = -Math.abs(m.vx);
        if (Math.abs(p.y - m.y) < 46 && Math.abs(p.x - m.x) < 320) { m.dir = p.x < m.x ? -1 : 1; m.tel = 28; }
      }
    } else if (m.type === 'boss') {
      m.t++;
      const ph = m.hp / m.mhp > 0.6 ? 1 : m.hp / m.mhp > 0.3 ? 2 : 3;
      if (ph > m.phase) { m.phase = ph; burst(m.x, m.y - m.h / 2, '#ff5a5a', 30); beep(200, 0.3, 'sawtooth', 0.06); spawnBossAdds(ph); } // 進階段召喚援軍
      const dir = p.x < m.x ? -1 : 1;
      const grounded = m.y >= 468 && m.vy >= 0;
      if (m.atkT > 0) {
        m.atkT--;
        if (grounded) m.vx = dir * (ph === 1 ? 1.1 : ph === 2 ? 1.6 : 2.2); // 追著玩家走
      } else if (m.tele > 0) {
        m.tele--; m.vx = 0; // 蓄力預告(頭上會顯示 !)
        if (m.tele === 0 && grounded) {
          m.vy = ph === 3 ? -11.5 : -9; // 跳撲
          m.vx = dir * (2.6 + ph * 0.8);
          { // 吐毒彈(扇形,一階段起就有,按群系微調)
            const bb = biomeOf(floor);
            const hot = bb.name === '熾熱熔岩' || bb.name === '虛空深淵';
            const chill = bb.name === '冰霜凍原';
            const nsp = (ph === 1 ? 1 : ph === 2 ? 3 : 5) + (hot ? 2 : 0);
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
          m.atkT = ph === 1 ? 100 : ph === 2 ? 74 : 54;
        }
      } else if (grounded) {
        m.tele = 36;
      }
      m.vy += 0.6; if (m.vy > 14) m.vy = 14;
      m.x += m.vx * moveF; m.y += m.vy;
      if (m.x < 60) m.x = 60;
      if (m.x > worldW - 60) m.x = worldW - 60;
      if (m.y >= 468) {
        if (m.vy > 3 && ph === 3) { // 狂暴期落地震波
          burst(m.x, 468, '#b05ae0', 26);
          beep(90, 0.2, 'sawtooth', 0.06);
          if (p.onGround && Math.abs(p.x - m.x) < 150 && p.inv === 0) {
            const d = Math.max(1, Math.round(m.dmg * 0.9) - armorDef());
            p.vx = (p.x < m.x ? -1 : 1) * 6; p.vy = -6; p.onGround = false;
            if (dmgPlayer(d)) return;
          }
        }
        m.y = 468; m.vy = 0;
      }
    } else {
      m.t++;
      const ddx = p.x - m.x, ddy = (p.y - 26) - m.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist < 360) {
        // 俯衝追擊玩家
        const sp = Math.min(2.2, 1.1 + floor * 0.06) * moveF;
        m.x += ddx / dist * sp + Math.sin(m.t * 0.15) * 0.5 * MONSTER_MOVE_MUL;
        m.y += ddy / dist * sp + Math.cos(m.t * 0.13) * 0.5 * MONSTER_MOVE_MUL;
        m.vx = ddx;
      } else {
        // 緩慢飄回巡邏點
        const bx2 = m.ax + Math.sin(m.t * 0.02) * 90;
        const by2 = m.ay + Math.sin(m.t * 0.055) * 34;
        m.x += (bx2 - m.x) * 0.03 * MONSTER_MOVE_MUL;
        m.y += (by2 - m.y) * 0.03 * MONSTER_MOVE_MUL;
      }
      if (m.y > 448) m.y = 448;
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
      burst(s.x, Math.min(s.y, 468), '#8a5adf', 5);
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
      playSfx('pickup', 0.72, 1.12);
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
  const recoveryMul = 1 + 0.1 * meta.up.recovery;
  if (p.hp < p.mhp) p.hp = Math.min(p.mhp, p.hp + 0.008 * recoveryMul);
  if (p.mp < p.mmp) p.mp = Math.min(p.mmp, p.mp + 0.05 * (1 + 0.5 * p.cd.mp) * recoveryMul);
}

// ---------- render ----------
let camX = 0;
function drawFloorEventWorld() {
  if (!floorEvent) return;
  const e = floorEvent, d = FLOOR_EVENT_DEFS[e.type], x = e.x, y = e.y;
  ctx.save();
  ctx.globalAlpha = e.status === 'done' ? 0.45 : 1;
  const bob = Math.sin(frame * 0.08) * 2;
  if (e.type === 'chest') {
    ctx.fillStyle = '#6b3f20'; ctx.fillRect(x - 24, y - 30, 48, 28);
    ctx.fillStyle = '#b96b2f'; ctx.fillRect(x - 26, y - 40 + bob, 52, 15);
    ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - 4, y - 28, 8, 13); ctx.fillRect(x - 20, y - 37 + bob, 40, 3);
  } else if (e.type === 'shrine') {
    ctx.fillStyle = '#504064'; ctx.fillRect(x - 28, y - 10, 56, 10); ctx.fillRect(x - 19, y - 20, 38, 10);
    ctx.fillStyle = '#8165a0'; ctx.fillRect(x - 9, y - 62, 18, 43);
    ctx.fillStyle = '#d9a8ff'; ctx.beginPath(); ctx.arc(x, y - 70 + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha *= 0.22; ctx.beginPath(); ctx.arc(x, y - 70 + bob, 22, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = e.status === 'done' ? 0.45 : 1;
  } else {
    ctx.fillStyle = e.status === 'challenge' ? '#7a2f32' : '#3c344b'; ctx.fillRect(x - 18, y - 65, 36, 65);
    ctx.fillStyle = '#1b1725'; ctx.fillRect(x - 12, y - 57, 24, 50);
    ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 38, 11 + Math.sin(frame * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff8a6a'; ctx.fillRect(x - 3, y - 44, 6, 12);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + STAT_FONT;
  ctx.fillStyle = e.status === 'done' ? '#777' : d.color;
  const near = Math.abs(player.x - e.x) <= 72 && Math.abs(player.y - e.y) <= 60;
  const label = e.status === 'done' ? '已使用' : e.status === 'challenge' ? '試煉進行中' : near ? '[Space] 互動' : d.name;
  ctx.fillText(label, x, y - 84);
  ctx.restore();
}
function drawEventPanel() {
  if (!eventPanel || !floorEvent) return;
  const d = FLOOR_EVENT_DEFS[eventPanel.type];
  eventChoiceBtns.length = 0;
  ctx.fillStyle = 'rgba(5,6,16,0.76)'; ctx.fillRect(0, 0, W, H);
  const x = 190, y = 112, w = 580, h = 306;
  ctx.fillStyle = 'rgba(24,25,46,0.99)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = d.color; ctx.font = 'bold 25px ' + STAT_FONT;
  ctx.fillText(d.title, W / 2, y + 44);
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px ' + STAT_FONT;
  ctx.fillText(d.desc, W / 2, y + 78);
  const note = eventPanel.type === 'chest' ? '獎勵：精良以上裝備＋附魔塵' : eventPanel.type === 'challenge' ? '完成獎勵：稀有以上裝備＋附魔塵' : '祝福效果持續至本次冒險結束';
  ctx.fillStyle = '#9299b9'; ctx.font = '12px ' + STAT_FONT; ctx.fillText(note, W / 2, y + 105);
  for (let i = 0; i < 2; i++) {
    const b = { x:x + 55, y:y + 128 + i * 62, w:w - 110, h:46, choice:i };
    eventChoiceBtns.push(b);
    ctx.fillStyle = i === 0 ? 'rgba(176,90,224,0.25)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = i === 0 ? d.color : '#4a4d66'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText('[' + (i + 1) + '] ' + d.choices[i], W / 2, b.y + 29);
  }
  ctx.fillStyle = '#737a9a'; ctx.font = '11px ' + STAT_FONT; ctx.fillText('按 1 / 2 選擇　·　Esc 關閉', W / 2, y + h - 18);
  ctx.textAlign = 'left';
}
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
  drawFloorEventWorld();
  // Lv3/Lv5 技能區域特效（燃燒地面、餘震、龍捲與二次衝擊）
  for (const z of skillZones) {
    const waiting = z.delay > 0, life = z.maxT > 1 ? Math.max(0.18, z.t / z.maxT) : 1;
    ctx.globalAlpha = waiting ? 0.16 + Math.sin(frame * 0.18) * 0.06 : 0.18 + life * 0.18;
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(8, z.rx), Math.max(5, z.ry * 0.32), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = waiting ? 0.45 : 0.65;
    ctx.strokeStyle = z.color; ctx.lineWidth = z.kind === 'burn' || z.kind === 'sunfire' ? 2 : 3;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(8, z.rx * (0.88 + Math.sin(frame * 0.1) * 0.06)), Math.max(5, z.ry * 0.28), 0, 0, Math.PI * 2); ctx.stroke();
    if (!waiting && (z.kind === 'burn' || z.kind === 'sunfire')) {
      for (let i = 0; i < 4; i++) {
        const fx = z.x + Math.sin(frame * 0.11 + i * 2.1) * z.rx * 0.7;
        const fh = 8 + (i * 7 + frame) % 15;
        ctx.globalAlpha = 0.5; ctx.fillRect(fx - 2, z.y - fh, 4, fh);
      }
    }
    ctx.globalAlpha = 1;
  }
  drawSkillAnimations('back');
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
  drawEquippedAura(p.x, p.y - p.h / 2, p.w, p.h);
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
      if (!drawSkillVfxFrame('fireball', pr.x, pr.y, Math.floor(frame / 4), 1.05, pr.vx < 0, 0, 1)) {
        drawSprite(FIRE, pr.x - 9, pr.y - 9, 3, pr.vx < 0);
        ctx.fillStyle = 'rgba(255,140,46,0.35)'; ctx.fillRect(pr.x - pr.vx * 2 - 6, pr.y - 6, 12, 12);
      }
    }
  }
  // 隕石
  for (const mt of meteors) {
    if (!drawSkillVfxFrame('fireballDiag', mt.x, mt.y, Math.floor(frame / 4), Math.max(1, mt.r / 48), false, Math.PI / 2, 1)) {
      ctx.fillStyle = '#ff8c2e'; ctx.fillRect(mt.x - 7, mt.y - 14, 14, 18);
      ctx.fillStyle = '#ffe680'; ctx.fillRect(mt.x - 3, mt.y - 8, 6, 8);
    }
  }
  // 魔法盾泡泡
  if (player.shieldHp > 0) {
    drawSkillVfxFrame('rune', player.x, player.y - player.h / 2, Math.floor(frame / 5), 1.25, false, 0, 0.7);
    ctx.strokeStyle = 'rgba(125,207,255,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 22, player.y - player.h - 8, 44, player.h + 12);
  }
  // bolts
  for (const b of bolts) {
    ctx.strokeStyle = b.t % 4 < 2 ? '#fff' : '#ffe680';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (b.chain) {
      ctx.moveTo(b.x0, b.y0);
      for (let i = 1; i <= 5; i++) ctx.lineTo(b.x0 + (b.x - b.x0) * i / 5 + (i < 5 ? (i % 2 ? 7 : -7) : 0), b.y0 + (b.y - b.y0) * i / 5);
    } else {
      let by = -10;
      ctx.moveTo(b.x + 6, by);
      while (by < b.y) { by += 40; ctx.lineTo(b.x + (by % 80 < 40 ? -8 : 8), Math.min(by, b.y)); }
    }
    ctx.stroke();
  }
  drawSkillAnimations('front');
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
  if (p.eventAtk > 0) { ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.fillText('血祝+' + Math.round(p.eventAtk * 100) + '%', 92, H - 8); }
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
  const loH = loadouts[p.cls], keyN = ['Z', 'X', 'C'];
  for (let i = 0; i < 3; i++) {
    const sid = loH[i], sx = 672 + i * 57, sy = H - 43;
    ctx.fillStyle = 'rgba(8,7,9,0.94)'; ctx.fillRect(sx, sy, 52, 38);
    ctx.strokeStyle = sid ? '#80633d' : '#3d3935'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 52, 38);
    if (sid) drawSkillSigil(sid, sx + 19, sy + 19, 15, p.slotCd[i] <= 0, false);
    ctx.fillStyle = '#8c2f25'; ctx.fillRect(sx + 36, sy + 3, 13, 13);
    ctx.fillStyle = '#fff1d0'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText(keyN[i], sx + 42.5, sy + 13);
    if (sid && p.slotCd[i] > 0) {
      ctx.fillStyle = 'rgba(5,5,7,0.68)'; ctx.fillRect(sx + 2, sy + 2, 33, 34);
      ctx.fillStyle = '#ddd6ca'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText((p.slotCd[i] / 60).toFixed(1), sx + 19, sy + 23);
    }
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = '#c8cdec';
  ctx.fillText('[I]裝備', 845, H - 8);
  statsBtn = { x: 894, y: H - 30, w: 66, h: 30 };
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('[P]能力', 900, H - 8);

  if (floorT > 0) {
    ctx.globalAlpha = Math.min(1, floorT / 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('第 ' + floor + ' 層' + (floor % 5 === 0 ? '  ⚠ BOSS' : ''), W / 2, 180);
    ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillStyle = '#ffe680';
    ctx.fillText('— ' + biomeOf(floor).name + (floorEvent ? ' · ' + FLOOR_EVENT_DEFS[floorEvent.type].name : '') + ' —', W / 2, 214);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (p.itemWin) drawItemWin();
  drawTouchUI();
  drawEventPanel();
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

// ---------- full character stats ----------
const STAT_FONT = '"Microsoft JhengHei UI","Microsoft JhengHei","Noto Sans TC",sans-serif';
function drawFitText(text, x, y, maxW) {
  let out = String(text);
  while (out.length > 2 && ctx.measureText(out).width > maxW) out = out.slice(0, -2) + '…';
  ctx.fillText(out, x, y);
}
function drawStatColumn(x, y, w, title, color, rows) {
  ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, w, 365);
  ctx.strokeStyle = '#414661'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 365);
  ctx.fillStyle = color; ctx.font = 'bold 16px ' + STAT_FONT;
  ctx.fillText(title, x + 12, y + 25);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], ry = y + 52 + i * 39;
    ctx.fillStyle = '#dce0f2'; ctx.font = '13px ' + STAT_FONT;
    ctx.fillText(row[0], x + 12, ry);
    ctx.fillStyle = row[3] || '#fff'; ctx.font = 'bold 14px ' + STAT_FONT; ctx.textAlign = 'right';
    ctx.fillText(row[1], x + w - 12, ry);
    ctx.textAlign = 'left'; ctx.fillStyle = '#9ba3c7'; ctx.font = '11px ' + STAT_FONT;
    drawFitText(row[2], x + 12, ry + 16, w - 24);
  }
}
function drawStatsPanel() {
  const p = player;
  const atk = atkPow(), crit = critRate(), gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  const hpBase = 60 + (p.cls === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp;
  const recvMul = (1 + 0.25 * perkV('glass')) * (1 - 0.01 * meta.up.guard);
  const recoveryMul = 1 + 0.1 * meta.up.recovery;
  const combatRows = [
    ['攻擊力', Math.round(atk), '基礎 ' + atkBase().toFixed(1) + ' × 倍率 ' + atkMultiplier().toFixed(2), '#ffe680'],
    ['傷害範圍', Math.round(atk * 0.85) + '～' + Math.round(atk * 1.15), '每次攻擊隨機 85%～115%'],
    ['爆擊率', (crit * 100).toFixed(1) + '%', '基礎8% + 永久' + (meta.up.crit * 0.5).toFixed(1) + '% + 卡/裝/附魔'],
    ['爆擊傷害', Math.round((1.6 + affixV('critDmg')) * 100) + '%', '基礎160% + 狂虐附魔'],
    ['技能傷害', '+' + Math.round((skillDamageMul() - 1) * 100) + '%', '絕技精通 Lv' + p.cd.xdmg + (perkV('overcharge') ? '；奧術超載 Lv' + perkV('overcharge') : '')],
    ['冷卻倍率', '×' + cooldownMul().toFixed(2), '迅捷出手 Lv' + p.cd.aspd + '；永久冷卻 -' + (meta.up.haste * 1.5).toFixed(1) + '%'],
    ['承受傷害', '×' + recvMul.toFixed(2), '防禦本能 -' + meta.up.guard + '%' + (perkV('glass') ? '；玻璃大砲放大' : '')],
    ['吸血／擊殺回血', Math.round((perkV('vamp') * 0.06 + affixV('lifesteal')) * 100) + '% / ' + (p.cd.ls * 3), '吸血鬼、吸血附魔／嗜血卡']
  ];
  const survivalRows = [
    ['HP', Math.ceil(p.hp) + ' / ' + p.mhp, '公式基礎 ' + Math.round(hpBase) + '；裝備HP ' + Math.round(gearHp), '#ff8a8a'],
    ['MP', Math.ceil(p.mp) + ' / ' + p.mmp, '等級、職業與心靈之泉'],
    ['固定減傷', armorDef(), '裝備 ' + Math.round(eqStat('armor', 'def') + eqStat('helmet', 'def')) + ' + 鋼鐵皮膚 ' + p.cd.def + ' + 附魔 ' + Math.round(affixV('def'))],
    ['HP回復', (0.48 * recoveryMul).toFixed(2) + ' /秒', '營火調息 Lv' + meta.up.recovery],
    ['MP回復', (3 * (1 + 0.5 * p.cd.mp) * recoveryMul).toFixed(1) + ' /秒', '心靈之泉 Lv' + p.cd.mp + '；營火調息 Lv' + meta.up.recovery],
    ['移動速度', moveSpd().toFixed(1), '基礎1.6 + 卡' + (p.cd.spd * 0.4).toFixed(1) + ' + 裝/附魔' + (eqStat('boots', 'spd') + affixV('move')).toFixed(1)],
    ['受傷無敵', ((60 + 6 * p.cd.ifr) / 60).toFixed(1) + ' 秒', '閃避本能 Lv' + p.cd.ifr],
    ['護盾', Math.round(p.shieldHp || 0), perkV('aegis') ? '守護結界 Lv' + perkV('aegis') : '目前沒有護盾來源']
  ];
  const economyRows = [
    ['升級進度', Math.round(p.xp) + ' / ' + xpNeed(p.lv), 'Lv' + p.lv + ' → Lv' + (p.lv + 1), '#9ecbff'],
    ['裝備掉率', (gearDropChance(false) * 100).toFixed(1) + '%', '第' + floor + '層一般怪；含尋寶附魔'],
    ['菁英裝備率', (gearDropChance(true) * 100).toFixed(1) + '%', '一般怪機率 +15%；總上限50%'],
    ['藥水掉率', (potionDropChance() * 100).toFixed(1) + '%', '藥劑師 Lv' + p.cd.pot + '；回復量 +' + (meta.up.alchemy * 5 + p.cd.heal * 10) + '%'],
    ['靈魂掉率', (SOUL_DROP_CHANCE * 100) + '%', '一般怪；菁英2顆／Boss 8顆'],
    ['靈魂結算', '×' + soulGainMul().toFixed(2), '共鳴、貪婪卡與貪婪附魔'],
    ['永久戰鬥成長', '攻+' + (meta.up.atk * 4) + '% HP+' + (meta.up.vit * 8) + '%', '爆擊+' + (meta.up.crit * 0.5).toFixed(1) + '%；減傷' + meta.up.guard + '%；冷卻-' + (meta.up.haste * 1.5).toFixed(1) + '%'],
    ['目前樓層', String(floor), biomeOf(floor).name + (floor % 5 === 0 ? '・Boss層' : '')]
  ];

  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  const x = 45, y = 24, w = W - 90, h = H - 48;
  ctx.fillStyle = 'rgba(20,22,43,0.985)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left'; ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 22px ' + STAT_FONT;
  ctx.fillText('角 色 能 力', x + 20, y + 32);
  ctx.fillStyle = '#dce0f2'; ctx.font = '13px ' + STAT_FONT;
  ctx.fillText((meta.playerName || '勇者') + '　Lv.' + p.lv + ' ' + CLASSES[p.cls].name + (gameState === 'play' ? '　即時數值' : '　最近角色數值'), x + 180, y + 31);
  statsCloseBtn = { x: x + w - 92, y: y + 10, w: 76, h: 28 };
  ctx.fillStyle = 'rgba(226,59,59,0.18)'; ctx.fillRect(statsCloseBtn.x, statsCloseBtn.y, statsCloseBtn.w, statsCloseBtn.h);
  ctx.strokeStyle = '#a05060'; ctx.lineWidth = 1; ctx.strokeRect(statsCloseBtn.x, statsCloseBtn.y, statsCloseBtn.w, statsCloseBtn.h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.textAlign = 'center';
  ctx.fillText('P / Esc 關閉', statsCloseBtn.x + statsCloseBtn.w / 2, statsCloseBtn.y + 19);
  ctx.textAlign = 'left';
  const gap = 12, colW = (w - 40 - gap * 2) / 3, colY = y + 52;
  drawStatColumn(x + 14, colY, colW, '戰 鬥', '#ffe680', combatRows);
  drawStatColumn(x + 14 + colW + gap, colY, colW, '生 存', '#ff8a8a', survivalRows);
  drawStatColumn(x + 14 + (colW + gap) * 2, colY, colW, '成 長／經 濟', '#9ecbff', economyRows);
  ctx.fillStyle = '#939bbd'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('顯示值直接取自實際戰鬥公式；裝備強化、附魔與卡片效果已計入。', x + 18, y + h - 12);
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
  ctx.fillText('石' + meta.mats.enh + ' 塵' + meta.mats.ench, 200, 20);
  ctx.fillStyle = '#b98cff'; ctx.fillText('活躍 ' + activityState.activity + '/300', 306, 20);
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
  ctx.fillStyle = '#747b9e'; ctx.font = '10px ' + STAT_FONT; ctx.fillText('管理出戰配置，強化與附魔收藏裝備', 115, 130);
  const stashResources = [
    { x: 620, w: 104, icon: '◆', label: '強化石', value: meta.mats.enh, color: '#ffbd72' },
    { x: 732, w: 104, icon: '✦', label: '附魔塵', value: meta.mats.ench, color: '#d9a8ff' },
    { x: 844, w: 92, icon: '▣', label: '容量', value: meta.stash.length + '/' + STASH_CAP, color: '#9fc7ff' }
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
      ctx.fillStyle = RARITY_COL[it.r]; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(gearLabel(it), loadPanel.x + 108, y + 20);
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
    fillRoundRect(cxx, cyy, cell, cell, 4, it ? (on ? 'rgba(125,255,214,0.15)' : 'rgba(255,255,255,0.045)') : 'rgba(0,0,0,0.16)', it ? (on ? '#7dffd6' : RARITY_COL[it.r]) : '#292d43', on ? 2 : 1);
    ctx.shadowBlur = 0;
    if (it) {
      stashBtns.push({ x: cxx, y: cyy, w: cell, h: cell, uid: it.uid });
      drawItemIcon(it, cxx + 5, cyy + 3, 36);
      if (GEAR_PARTS.some(pt => meta.loadout[pt] === it.uid)) { ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'left'; ctx.fillText('▲', cxx + 4, cyy + 11); }
      if (it.enh > 0) { ctx.fillStyle = '#ffcf6a'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.textAlign = 'right'; ctx.fillText('+' + it.enh, cxx + cell - 3, cyy + 12); }
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
    ctx.textAlign = 'left'; ctx.fillStyle = RARITY_COL[sel.r]; ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText(gearLabel(sel), wx + 70, wy + 25);
    ctx.fillStyle = '#777e9d'; ctx.font = '10px ' + STAT_FONT;
    ctx.fillText(RARITY_NAME[sel.r] + ' ' + PART_NAME[sel.kind] + '  •  ' + gearDesc(sel), wx + 70, wy + 43);
    const lv = sel.enh || 0;
    const equipped = meta.loadout[sel.kind] === sel.uid;
    const b1 = { x: wx + 278, y: wy + 13, w: 92, h: 36, act: 'equip' };
    stashActBtns.push(b1);
    fillRoundRect(b1.x, b1.y, b1.w, b1.h, 4, equipped ? 'rgba(125,255,214,0.16)' : 'rgba(255,255,255,0.055)', equipped ? '#68c1ac' : '#42465d', 1);
    ctx.fillStyle = equipped ? '#8affdc' : '#d5d8e8'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillText(equipped ? '✓ 卸下裝備' : '設為出戰', b1.x + b1.w / 2, b1.y + 23);
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
    if (lv < ENH_MAX) {
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
    const a = AURA_DEFS[id], unlocked = activityState.cosmetics.includes(id), equipped = activityState.aura === id;
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
  const tabs = [['base', '⌂  基地'], ['skills', '✦  技能'], ['stash', '▣  倉庫'], ['activity', '▤  契約']];
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
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; stashBtns.length = 0; stashActBtns.length = 0; activityBtns.length = 0;
    renderSkillTab();
    return;
  }
  if (menuTab === 'stash') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; activityBtns.length = 0;
    renderStashTab();
    return;
  }
  if (menuTab === 'activity') {
    selBtns.length = 0; metaBtns.length = 0; startBtn = null; skillBtns.length = 0; skillActBtns.length = 0; gachaBtn = null; stashBtns.length = 0; stashActBtns.length = 0;
    renderActivityTab();
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
    const cw = 190, ch = 132;
    const cx = left.x + 18 + i * 202, cy = left.y + 60;
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
  ctx.fillText('出戰技能', left.x + 18, left.y + 218);
  const equipped = loadouts[chosenCls];
  for (let i = 0; i < equipped.length; i++) {
    const id = equipped[i], ix = left.x + 32 + i * 126, iy = left.y + 252;
    drawSkillSigil(id, ix, iy, 20, !!id, !id);
    ctx.fillStyle = id ? '#dfe3f5' : '#6c728f'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.fillText(id ? SKILL_DEFS[id].name : '尚未裝備', ix + 30, iy - 3);
    ctx.fillStyle = '#686f90'; ctx.font = '9px ' + STAT_FONT; ctx.fillText('技能 ' + (i + 1), ix + 30, iy + 13);
  }
  ctx.fillStyle = '#343850'; ctx.fillRect(left.x + 18, left.y + 286, left.w - 36, 1);
  const bw2 = left.w - 36, bh2 = 54;
  startBtn = { x: left.x + 18, y: left.y + 304, w: bw2, h: bh2 };
  const pulse = 0.32 + (Math.sin(frame * 0.07) + 1) * 0.06;
  ctx.shadowColor = '#b05ae0'; ctx.shadowBlur = 8;
  fillRoundRect(startBtn.x, startBtn.y, bw2, bh2, 6, 'rgba(176,90,224,' + pulse.toFixed(2) + ')', '#c56ef0', 2);
  ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px ' + STAT_FONT;
  ctx.fillText('進入地城', startBtn.x + bw2 / 2 - 22, startBtn.y + 33);
  ctx.fillStyle = '#e3c4f3'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.fillText('[ ENTER ]', startBtn.x + bw2 / 2 + 82, startBtn.y + 33);
  ctx.fillStyle = '#777e9f'; ctx.font = '10px ' + STAT_FONT;
  ctx.fillText(lastRun ? '上次紀錄  第 ' + lastRun.floor + ' 層  •  擊殺 ' + lastRun.kills + '  •  靈魂 +' + lastRun.gained : '清空怪物、啟動傳送門，挑戰更深樓層', left.x + left.w / 2, left.y + 378);

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

// ---------- main loop ----------
function loop() {
  frame++;
  if (gameState === 'town') {
    updateTown();
    renderTown();
  } else if (gameState === 'select') {
    renderMenu();
  } else {
    if (gameState === 'play' && !statsOpen) update();
    if (gameState !== 'select') render();
    if (gameState === 'pick') drawPick();
    if (gameState === 'dead') drawDead();
  }
  if (statsOpen) drawStatsPanel();
  if (settingsOpen) renderSettings();
  requestAnimationFrame(loop);
}
calcStats();
gameState = 'town'; setHint(HINT_TOWN);
loop();
