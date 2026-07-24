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
// Akari21 equipment art. Quality tiers deliberately use distinct silhouettes
// so upgrades are readable before the player checks the item text.
const GEAR_ART_ROOT = 'assets/runtime/equipment/';
const GEAR_ART = {
  warrior: {
    weapon: ['sword - wood.png', 'sword - metal.png', 'sword - gold.png', 'special sword - ice.png', 'special sword - fire.png'],
    armor:  ['armor - body (leather).png', 'armor - body (metal).png', 'armor - body (gold).png', 'armor - body (bone).png', 'armor - body (gold).png'],
    helmet: ['armor - head (leather).png', 'armor - head (metal).png', 'armor - head (gold).png', 'armor - head (bone).png', 'armor - head (gold).png'],
    boots:  ['armor - foot (leather).png', 'armor - foot (metal).png', 'armor - foot (gold).png', 'armor - foot (bone).png', 'armor - foot (gold).png']
  },
  mage: {
    weapon: ['magic staff 1.png', 'magic staff 1 - blue gem.png', 'magic staff 2 - green gem.png', 'magic staff 3 - purple gem.png', 'magic staff 3 - red gem.png'],
    armor:  ['mage clothes 1 (black).png', 'mage clothes 1 (purple).png', 'mage clothes 1 (red).png', 'mage clothes 2 (black).png', 'mage clothes 2 (purple).png'],
    helmet: ['mage hat (black).png', 'mage hat (purple).png', 'mage hat (red).png', 'mage hat (black).png', 'mage hat (purple).png'],
    boots:  ['armor - foot (leather).png', 'armor - foot (metal).png', 'armor - foot (gold).png', 'armor - foot (bone).png', 'armor - foot (gold).png']
  },
  archer: {
    weapon: ['bow - short.png', 'bow - recurve.png', 'bow - long.png', 'bow - great.png', 'bow - storm.png'],
    armor:  ['armor - body (leather).png', 'armor - body (metal).png', 'armor - body (gold).png', 'armor - body (bone).png', 'armor - body (gold).png'],
    helmet: ['armor - head (leather).png', 'armor - head (metal).png', 'armor - head (gold).png', 'armor - head (bone).png', 'armor - head (gold).png'],
    boots:  ['armor - foot (leather).png', 'armor - foot (metal).png', 'armor - foot (gold).png', 'armor - foot (bone).png', 'armor - foot (gold).png']
  },
  acc: ['items/amulet 1.png', 'items/ring 2.png', 'items/amulet 3.png', 'items/ring 8.png', 'items/amulet 6.png']
};
const GEAR_SET_ART = {
  blood_oath: {
    weapon:'special sword - fire.png', armor:'armor - body (bone).png',
    helmet:'armor - head (bone).png', boots:'armor - foot (bone).png'
  },
  sun_guard: {
    weapon:'sword - gold.png', armor:'armor - body (gold).png',
    helmet:'armor - head (gold).png', boots:'armor - foot (gold).png'
  },
  starfire: {
    weapon:'magic staff 3 - red gem.png', armor:'mage clothes 1 (red).png',
    helmet:'mage hat (red).png', boots:'armor - foot (gold).png'
  },
  voidweave: {
    weapon:'magic staff 3 - purple gem.png', armor:'mage clothes 2 (purple).png',
    helmet:'mage hat (purple).png', boots:'armor - foot (bone).png'
  }
};
const gearArtImages = {};
function gearArtPath(it) {
  if (!it) return '';
  const rarity = Math.max(0, Math.min(4, it.r | 0));
  if (it.kind === 'acc') return GEAR_ART_ROOT + GEAR_ART.acc[rarity];
  const setFile = it.setId && GEAR_SET_ART[it.setId] && GEAR_SET_ART[it.setId][it.kind];
  if (setFile) return GEAR_ART_ROOT + 'weapons and armor/' + setFile;
  const cls = baseClassOf(it.cls || (it.wpn === 'stave' ? 'mage' : it.wpn === 'bow' ? 'archer' : (typeof player !== 'undefined' && player.cls) || 'warrior')); // 進階職沿用基礎職美術
  const file = GEAR_ART[cls] && GEAR_ART[cls][it.kind] && GEAR_ART[cls][it.kind][rarity];
  return file ? GEAR_ART_ROOT + 'weapons and armor/' + file : '';
}
for (const cls of ['warrior', 'mage', 'archer']) {
  for (const part of ['weapon', 'armor', 'helmet', 'boots']) {
    for (const file of GEAR_ART[cls][part]) {
      const path = GEAR_ART_ROOT + 'weapons and armor/' + file;
      if (!gearArtImages[path]) { const img = new Image(); img.src = path; gearArtImages[path] = img; }
    }
  }
}
for (const art of Object.values(GEAR_SET_ART)) {
  for (const file of Object.values(art)) {
    const path = GEAR_ART_ROOT + 'weapons and armor/' + file;
    if (!gearArtImages[path]) { const img = new Image(); img.src = path; gearArtImages[path] = img; }
  }
}
for (const file of GEAR_ART.acc) {
  const path = GEAR_ART_ROOT + file;
  const img = new Image(); img.src = path; gearArtImages[path] = img;
}
function itemIconIdx(it) {
  if (it.kind === 'weapon') return it.wpn === 'stave' ? 1 : it.wpn === 'bow' ? 2 : 0;
  if (it.kind === 'armor') return 2;
  if (it.kind === 'helmet') return 3;
  if (it.kind === 'boots') return 4;
  return -1; // 飾品:程式畫
}
function drawItemIcon(it, x, y, s) { // 在 (x,y) 畫 s×s 圖示
  const art = gearArtImages[gearArtPath(it)];
  if (art && art.complete && art.naturalWidth) {
    ctx.drawImage(art, Math.round(x), Math.round(y), s, s);
    return;
  }
  const idx = itemIconIdx(it);
  if (idx >= 0 && itemsheetReady) { ctx.drawImage(itemsheet, idx * 32, 0, 32, 32, Math.round(x), Math.round(y), s, s); return; }
  // 飾品:金環 + 品質色寶石(明顯是戒指,不像藥水)
  const cx = x + s / 2, cy = y + s / 2;
  ctx.strokeStyle = '#d8b365'; ctx.lineWidth = Math.max(2, s * 0.11);
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.14, s * 0.26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = gearColor(it);
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.18, s * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(cx - s * 0.05, cy - s * 0.23, s * 0.05, 0, Math.PI * 2); ctx.fill();
}
function drawPotionIcon(type, x, y, s) { if (itemsheetReady) ctx.drawImage(itemsheet, (type === 'hp' ? 5 : 6) * 32, 0, 32, 32, Math.round(x), Math.round(y), s, s); }

// Skill artwork: 256px codex icons plus compact 72px horizontal VFX sheets.
const SKILL_ICON_FILES = {
  slash:11, spin:21, dash:52, quake:42, rage:62,
  fire:25, bolt:7, ice:59, meteor:1, shield:3,
  bloodrend:33, warcry:45,
  bulwark:5, smite:9, elemburst:27, chainstorm:14, plague:38, soulleech:66,
  rend:17, holystrike:23, elembolt:49, shadowbolt:55,
  shoot:30, multishot:24, pierce:40, arrowrain:47, powershot:29,
  swiftshot:19, snaretrap:8, evade:53, snipe:16, chargeshot:64, deadeye:6
};
const skillIcons = {}, skillIconsGray = {};
for (const [id, n] of Object.entries(SKILL_ICON_FILES)) {
  const normal = new Image(), gray = new Image();
  normal.src = 'assets/runtime/skills/icons/normal/' + n + ' Icon.png';
  gray.src = 'assets/runtime/skills/icons/gray/' + n + ' Icon.png';
  skillIcons[id] = normal; skillIconsGray[id] = gray;
}
const SKILL_VFX_DEFS = {
  groundBurst:{ src:'assets/runtime/skills/vfx/1.png', frames:8 },
  rune:{ src:'assets/runtime/skills/vfx/2.png', frames:8 },
  beam:{ src:'assets/runtime/skills/vfx/3.png', frames:8 },
  slashBeam:{ src:'assets/runtime/skills/vfx/3_2.png', frames:8 },
  fireball:{ src:'assets/runtime/skills/vfx/4.png', frames:4 },
  fireballDiag:{ src:'assets/runtime/skills/vfx/4_1.png', frames:4 },
  explosion:{ src:'assets/runtime/skills/vfx/4_2.png', frames:4 },
  impact:{ src:'assets/runtime/skills/vfx/6.png', frames:4 },
  groundImpact:{ src:'assets/runtime/skills/vfx/6_2.png', frames:4 },
  iceSpikes:{ src:'assets/runtime/skills/vfx/7.png', frames:8 },
  roots:{ src:'assets/runtime/skills/vfx/8.png', frames:8 },
  smoke:{ src:'assets/runtime/skills/vfx/9.png', frames:8 },
  teleport:{ src:'assets/runtime/skills/vfx/10.png', frames:6 },
  // Pixel Art Spells (DevWizard, CC0)：來源每格尺寸不同，以 frame 標明；繪製時仍統一輸出 72px
  arcaneBolt:{ src:'assets/runtime/skills/vfx/arcaneBolt.png', frames:6, frame:16 },
  darkBolt:{ src:'assets/runtime/skills/vfx/darkBolt.png', frames:6, frame:16 },
  wardShield:{ src:'assets/runtime/skills/vfx/wardShield.png', frames:6, frame:48 },
  splash:{ src:'assets/runtime/skills/vfx/splash.png', frames:6, frame:32 },
  arrow:{ src:'assets/runtime/skills/vfx/arrow.png', frames:1, frame:32 }, // 弓箭手箭矢（DCSS, CC0）；靠 tint 區分職業
  // Weapon Slash - Effect (Cethiel, CC0)：5 種斬擊，每格 150px（原 126×150 補成正方形）
  crescentBold:{ src:'assets/runtime/skills/vfx/crescentBold.png', frames:6, frame:150 },
  crescentRing:{ src:'assets/runtime/skills/vfx/crescentRing.png', frames:6, frame:150 },
  crescentThin:{ src:'assets/runtime/skills/vfx/crescentThin.png', frames:6, frame:150 },
  thrust:{ src:'assets/runtime/skills/vfx/thrust.png', frames:6, frame:150 },
  streak:{ src:'assets/runtime/skills/vfx/streak.png', frames:6, frame:150 }
};
const skillVfxImages = {};
for (const [id, def] of Object.entries(SKILL_VFX_DEFS)) {
  const img = new Image(); img.src = def.src; skillVfxImages[id] = img;
}
let worldW = 2000;

function setHint(t) { document.getElementById('hint').innerHTML = t; }
const HINT_PLAY = '← → 移動&nbsp;|&nbsp;Shift 衝刺&nbsp;|&nbsp;Space 跳躍(↓+Space 下跳)&nbsp;|&nbsp;Z / X / C 技能&nbsp;|&nbsp;A 紅水 S 藍水&nbsp;|&nbsp;I 裝備&nbsp;|&nbsp;P 能力&nbsp;|&nbsp;M 當局效果&nbsp;|&nbsp;長按 Q 逃走';
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
const COMBAT_SETTINGS_KEY = 'pixelrogue_combat_settings';
const combatSettings = { shake: 1, flashes: true, numbers: 'full', haptics: false };
try {
  const savedCombat = JSON.parse(localStorage.getItem(COMBAT_SETTINGS_KEY));
  if (savedCombat) {
    if ([0, 1, 2].includes(savedCombat.shake)) combatSettings.shake = savedCombat.shake;
    if (typeof savedCombat.flashes === 'boolean') combatSettings.flashes = savedCombat.flashes;
    if (savedCombat.numbers === 'full' || savedCombat.numbers === 'compact') combatSettings.numbers = savedCombat.numbers;
    if (typeof savedCombat.haptics === 'boolean') combatSettings.haptics = savedCombat.haptics;
  }
} catch (err) {}
function saveCombatSettings() {
  try { localStorage.setItem(COMBAT_SETTINGS_KEY, JSON.stringify(combatSettings)); } catch (err) {}
}
function combatVibrate(ms) {
  if (!combatSettings.haptics || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (err) {}
}
const SFX_FILES = {
  swordSwing:'assets/runtime/audio/sfx/sword_swing.ogg', hit:'assets/runtime/audio/sfx/hit.ogg', critical:'assets/runtime/audio/sfx/critical.ogg',
  hurt:'assets/runtime/audio/sfx/player_hurt.ogg', pickup:'assets/runtime/audio/sfx/pickup.ogg', chest:'assets/runtime/audio/sfx/chest_open.ogg',
  uiSelect:'assets/runtime/audio/sfx/ui_select.ogg', uiConfirm:'assets/runtime/audio/sfx/ui_confirm.ogg', uiError:'assets/runtime/audio/sfx/ui_error.ogg',
  enhanceSuccess:'assets/runtime/audio/sfx/enhance_success.ogg', enhanceFail:'assets/runtime/audio/sfx/enhance_fail.ogg', itemBreak:'assets/runtime/audio/sfx/item_break.ogg',
  fire:'assets/runtime/audio/sfx/spell_fire.ogg', lightning:'assets/runtime/audio/sfx/spell_lightning.ogg', ice:'assets/runtime/audio/sfx/spell_ice.ogg', meteor:'assets/runtime/audio/sfx/spell_meteor.ogg'
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
const ARC = [ // 弓箭手：綠尖兜帽 + 紅羽毛（羅賓漢風），基礎精靈不畫武器（與 WAR/MAGE 一致）
  "....ggr.....","...ggggr....","..gg66gg....","..g6666g....","..g6767g....",
  "..g6666g....","..gggggg....",".gggggggg...",".gg8888g....",".gggggggg...",
  ".gggggggg...","..gggggg....","..gg..gg....","..11..11....","..11..11....","..11..11.."
];
function classSprite(cls) { // 依（基礎）職業取精靈圖
  const base = (typeof baseClassOf === 'function') ? baseClassOf(cls) : cls;
  return base === 'mage' ? MAGE : base === 'archer' ? ARC : WAR;
}
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
  const id = typeof equippedCosmetic === 'function' ? equippedCosmetic('aura') : null; // 統一外觀系統
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
