"use strict";
// ---------- state ----------
let gameState = 'select';
let chosenCls = 'warrior';
const CLASSES = { warrior: { name: '劍士', col: '#c84a4a' }, mage: { name: '法師', col: '#5a4ad0' } };
let frame = 0;
let floor = 1, kills = 0, soulsRun = 0, floorT = 0, gearSeq = 1;
let portal = null;
let floorEvent = null, eventPanel = null, floorTrial = null;
const DUNGEON_BENCHMARK_SNAPSHOT_KEY = 'pixelrogue_dungeon_benchmark_snapshot_v1';
let pendingDungeonBenchmarkId = null, activeDungeonBenchmarkId = null;
let dungeonBenchmarkProgressSnapshot = null;
const eventChoiceBtns = [];
let lastRun = null;
let pendingPicks = 0, pickOpts = [];
let plats = [], mons = [];
const projs = [], dmgNums = [], parts = [], orbs = [], drops = [], gearDrops = [], bolts = [], espits = [], meteors = [], skillZones = [], skillAnims = [];
const FEEL_PRESETS = {
  tick:   { stop:0, shake:0,   shakeT:0,  flash:2, particles:2 },
  ranged: { stop:1, shake:0,   shakeT:0,  flash:4, particles:4 },
  melee:  { stop:2, shake:1,   shakeT:4,  flash:5, particles:6 },
  crit:   { stop:4, shake:2.5, shakeT:7,  flash:7, particles:12 },
  kill:   { stop:3, shake:1.5, shakeT:6,  flash:8, particles:14 },
  boss:   { stop:5, shake:4,   shakeT:10, flash:8, particles:18 },
  hurt:   { stop:4, shake:4,   shakeT:10, flash:6, particles:8 },
  absorb: { stop:1, shake:1,   shakeT:4,  flash:4, particles:5 }
};
let hitStopT = 0, shakeT = 0, shakeMaxT = 0, shakeAmp = 0;
let playerFlashT = 0, hurtVignetteT = 0, hurtFromDir = 0;
let lastDamageSource = '未知攻擊';
function triggerCombatFeel(kind, target, options) {
  const preset = FEEL_PRESETS[kind] || FEEL_PRESETS.ranged;
  const o = options || {};
  hitStopT = Math.min(6, Math.max(hitStopT, o.stop == null ? preset.stop : o.stop));
  const settingMul = combatSettings.shake === 2 ? 1 : combatSettings.shake === 1 ? 0.5 : 0;
  const nextAmp = (o.shake == null ? preset.shake : o.shake) * settingMul;
  const nextShakeT = o.shakeT == null ? preset.shakeT : o.shakeT;
  if (nextAmp > 0 && (nextAmp >= shakeAmp || nextShakeT > shakeT)) {
    shakeAmp = Math.max(shakeAmp, nextAmp);
    shakeT = Math.min(12, Math.max(shakeT, nextShakeT));
    shakeMaxT = Math.max(shakeMaxT, shakeT);
  }
  if (target && preset.flash) target.hitT = Math.max(target.hitT || 0, combatSettings.flashes ? preset.flash : Math.min(2, preset.flash));
}
function tickCombatFeel() {
  if (shakeT > 0) shakeT--;
  else { shakeAmp = 0; shakeMaxT = 0; }
  if (playerFlashT > 0) playerFlashT--;
  if (hurtVignetteT > 0) hurtVignetteT--;
}
function currentShakeOffset() {
  if (shakeT <= 0 || shakeAmp <= 0) return [0, 0];
  const decay = shakeMaxT > 0 ? shakeT / shakeMaxT : 0;
  return [Math.sin(frame * 2.37) * shakeAmp * decay, Math.cos(frame * 1.91) * shakeAmp * 0.65 * decay];
}
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
  dashT: 0, dashCd: 0, dashDir: 1,
  slashT: 0, spinT: 0, potCd: 0, rageT: 0, rageAtk: 0, rageSpd: 0, rageLifesteal: 0, rageExtend: 0, rageBlood: false, rageUltimate: false,
  shieldHp: 0, shieldT: 0, shieldReflect: 0, shieldBreakMp: 0, shieldBurst: false, chillT: 0, hazardSlowT:0, cls: 'warrior', skillCasts: {},
  perk: {}, revives: 0, affixDeathUsed: false, eventAtk: 0, eventRerolls:0, aegisCd: 0, airJumped: false,
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
let pickRerollBtn = null;
function perkV(id) { return player.perk[id] || 0; }
function blessingV(id) { return typeof dungeonBlessingValue === 'function' ? dungeonBlessingValue(id) : 0; }
function blessingHeal(amount) { return typeof dungeonBlessingHealingAmount === 'function' ? dungeonBlessingHealingAmount(amount) : amount; }
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
function rerollPickFromEvent() {
  if (gameState !== 'pick') return false;
  const eventReroll = player.eventRerolls > 0;
  const blessingReroll = !eventReroll && typeof consumeDungeonBlessingCharge === 'function' && consumeDungeonBlessingCharge('fate_thread');
  if (!eventReroll && !blessingReroll) return false;
  if (eventReroll) player.eventRerolls--;
  rollPick();
  num(player.x, player.y - player.h - 12, blessingReroll ? '命運絲線重抽' : '命運重抽', '#ffd36a');
  playSfx('uiSelect', 0.9, 1.12);
  return true;
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
function moveSpd() { return (2.0 + 0.4 * player.cd.spd + eqStat('boots', 'spd') + affixV('move') + blessingV('wind_stride') + (player.rageT > 0 ? player.rageSpd || 0.8 : 0)) * (player.chillT > 0 ? 0.55 : 1) * (player.hazardSlowT > 0 ? 0.72 : 1); }
function jumpV() { return 11.5 + (player.eq.boots && player.eq.boots.jmp ? player.eq.boots.jmp : 0) + blessingV('aerial_grace'); }
function skillDamageMul() { return (1 + 0.15 * player.cd.xdmg) * (1 + affixV('skillDmg')) * (1 + blessingV('arcane_tide')) * (player.mp >= player.mmp * 0.7 ? 1 + 0.1 * perkV('overcharge') : 1); }
function cooldownMul() { return Math.pow(0.9, player.cd.aspd) * (1 + 0.18 * perkV('brute')) * Math.max(0.35, 1 - affixV('cooldown')) * (1 - 0.015 * meta.up.haste); }
function potionDropChance() { return 0.07 + 0.04 * player.cd.pot; }
function gearDropChance(elite, atFloor = floor) {
  const base = Math.min(0.025 + 0.0025 * atFloor + 0.01 * meta.up.treasure, 0.10);
  return Math.min(base + affixV('gearDrop') + blessingV('treasure_eye') + (elite ? 0.15 : 0), 0.50);
}
function soulGainMul() { return (1 + 0.05 * meta.up.soul) * (1 + 0.1 * perkV('greed')) * (1 + affixV('soulGain')) * (1 + blessingV('soul_bloom')); }
const SOUL_DROP_CHANCE = 0.25;
function calcStats() {
  const p = player;
  const gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  p.mhp = Math.round((60 + (p.cls === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp) * (1 + 0.08 * meta.up.vit) * (1 + affixV('hpPct')) * (1 + blessingV('oak_heart')) * Math.max(0.4, 1 - 0.15 * perkV('bloodpact')));
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
function dmgPlayer(hit) { // 玩家受傷統一入口(護盾吸收→扣血→死亡)
  const p = player;
  const event = typeof hit === 'number' ? { amount:hit } : (hit || {});
  let d = event.amount || 0;
  const sourceX = Number.isFinite(event.sourceX) ? event.sourceX : p.x;
  const sourceName = event.sourceName || '未知攻擊';
  d = Math.max(1, Math.round(d * (1 + 0.25 * perkV('glass')) * (1 - 0.01 * meta.up.guard))); // 玻璃大砲／永久防禦本能
  const thorns = 0.4 * perkV('thorns') + affixV('thorns');
  const retaliate = () => { // 先完成護盾／無傷判定，再結算荊棘，避免同幀擊殺誤判無傷成功。
    if (thorns <= 0) return;
    const td = Math.max(1, Math.round(atkPow() * thorns));
    for (const o of mons.slice()) {
      if (o.type !== 'boss' && Math.abs(o.x - p.x) < 90 && Math.abs((o.y - o.h / 2) - (p.y - p.h / 2)) < 80) hitMon(o, td, false, true);
    }
  };
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
    if (d <= 0) {
      retaliate();
      p.inv = 30 + 3 * p.cd.ifr;
      num(p.x, p.y - p.h - 10, '吸收', '#7dcfff', { kind:'absorb', size:14, pop:2 });
      triggerCombatFeel('absorb');
      playerFlashT = Math.max(playerFlashT, combatSettings.flashes ? 4 : 2);
      beep(500, 0.06, 'sine', 0.03);
      return false;
    }
  }
  lastDamageSource = sourceName;
  p.hp -= d; p.inv = 60 + 6 * p.cd.ifr;
  if (typeof recordDungeonDamage === 'function') recordDungeonDamage(sourceName, d);
  recordFloorTrialDamage(d);
  retaliate();
  num(p.x, p.y - p.h - 10, '-' + d, '#ff6b6b', { kind:'hurt', size:18, pop:4, vy:0.9 });
  triggerCombatFeel(event.heavy ? 'boss' : 'hurt');
  playerFlashT = Math.max(playerFlashT, combatSettings.flashes ? 6 : 2);
  hurtVignetteT = Math.max(hurtVignetteT, combatSettings.flashes ? 10 : 5);
  hurtFromDir = sourceX < p.x ? -1 : sourceX > p.x ? 1 : 0;
  burst(p.x, p.y - p.h / 2, '#ff8a8a', 8);
  combatVibrate(event.heavy ? 25 : 20);
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
function fireballAim(playerRef, originX, originY) {
  let target = null, bestScore = Infinity;
  for (const m of mons) {
    if (m.type !== 'bat') continue;
    const forward = (m.x - originX) * playerRef.face;
    const dy = (m.y - m.h / 2) - originY;
    if (forward <= 20 || forward > 700 || Math.abs(dy) > 320) continue;
    const score = forward + Math.abs(dy) * 1.25;
    if (score < bestScore) { target = m; bestScore = score; }
  }
  if (!target) return { target:null, angle:0 };
  const forward = Math.max(1, (target.x - originX) * playerRef.face);
  const dy = (target.y - target.h / 2) - originY;
  return { target, angle:Math.max(-0.65, Math.min(0.65, Math.atan2(dy, forward))) };
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
    const x = p.x + p.face * 20, y = p.y - 30;
    const aim = fireballAim(p, x, y), speed = 7.5;
    projs.push({ x, y, vx:p.face * Math.cos(aim.angle) * speed, vy:Math.sin(aim.angle) * speed,
      t:aim.target ? 90 : 70, mult:t.dmg, kind:'fire', talent:t, aimTarget:aim.target, aimT:aim.target ? 24 : 0 });
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
  if (!id) return { ok:false, reason:'blocked', slot:i };
  if (p.slotCd[i] > 0) return { ok:false, reason:'cooldown', slot:i, skillId:id };
  const def = SKILL_DEFS[id];
  if (p.mp < def.mp) {
    num(p.x, p.y - p.h - 10, 'MP不足', '#7f9cff', { size:14, pop:2 });
    skillPulseT[i] = 12;
    playSfx('uiError', 0.55, 0.85);
    return { ok:false, reason:'noMp', slot:i, skillId:id };
  }
  const t = talentOf(id);
  const result = SKILL_FX[id](t);
  if (result === false) {
    skillPulseT[i] = 8;
    return { ok:false, reason:'invalidTarget', slot:i, skillId:id };
  }
  activityProgress('skills', 1);
  if (!result || !result.free) p.mp -= def.mp;
  p.slotCd[i] = result && result.resetCd ? 0 : Math.max(def.minCd || 6, Math.round(def.cd * t.cd * cooldownMul()));
  if (p.slotCd[i] > 0 && perkV('echo') > 0 && Math.random() < 0.04 * perkV('echo')) {
    p.slotCd[i] = 0;
    num(p.x, p.y - p.h - 24, '技能迴響!', '#ffd23e');
    playSfx('uiConfirm', 0.55, 1.15);
  }
  skillPulseT[i] = 3;
  return { ok:true, reason:'cast', slot:i, skillId:id };
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
function createGear(n, slot, cls, rarity, setId) {
  const set = GEAR_SET_BY_ID[setId];
  const r = set ? Math.max(3, rarity) : rarity;
  const m = [1, 1.5, 2.1, 2.8, 3.6][r] * (0.85 + Math.random() * 0.3);
  const it = { kind: slot, r: r, id: 'g' + (gearSeq++), cls: cls, affixes: Array(affixSlots(r)).fill(null) };
  if (set) it.setId = set.id;
  if (slot === 'weapon') {
    it.atk = Math.max(1, Math.round((4 + n * 2) * m));
    it.wpn = cls === 'mage' ? 'stave' : 'sword';
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
  it.name = set ? set.pieces[slot] : gearName(slot, r, cls);
  return it;
}
function genGear(n, forceR, source) {
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
  const slot = pick(slots);
  const baseR = forceR != null ? forceR : rollRarity(n);
  const rate = n >= 5 && SET_PARTS.includes(slot) ? (SET_DROP_RATE[source || 'normal'] || SET_DROP_RATE.normal) : 0;
  const setIds = setIdsForClass(player.cls);
  const setId = setIds.length && Math.random() < rate ? pick(setIds) : null;
  return createGear(n, slot, player.cls, baseR, setId);
}
function forgeSetPiece(setId) {
  const set = GEAR_SET_BY_ID[setId];
  if (!set || set.cls !== chosenCls) { menuMsg = { text:'請切換到套裝對應職業', color:'#ff8a8a', t:180 }; return; }
  if (meta.stash.length >= STASH_CAP) { menuMsg = { text:'倉庫已滿，無法鍛造', color:'#ff8a8a', t:180 }; return; }
  if (meta.mats.set < SET_CRAFT_COST) { menuMsg = { text:'套裝核心不足（需要 ' + SET_CRAFT_COST + '）', color:'#ff8a8a', t:180 }; playSfx('uiError'); return; }
  const owned = new Set(meta.stash.filter(it => it.setId === setId).map(it => it.kind));
  const missing = SET_PARTS.filter(part => !owned.has(part));
  const slot = pick(missing.length ? missing : SET_PARTS);
  const item = createGear(Math.max(5, bestFloor || 5), slot, set.cls, 3, set.id);
  meta.mats.set -= SET_CRAFT_COST;
  stashGear(item); selStash = item.uid; saveMeta();
  menuMsg = { text:'鍛造完成：' + item.name, color:set.color, t:240 };
  playSfx('enhanceSuccess');
}
function addGear(it) {
  const p = player;
  if (p.items.length >= 12) {
    const m = addMat(it.r, it);
    saveMeta();
    num(p.x, p.y - p.h - 10, '背包已滿 → 強化石+' + m.enh, '#7dffd6');
    return;
  }
  p.items.push(it);
  if (!p.eq[it.kind]) { p.eq[it.kind] = it; calcStats(); }
  num(p.x, p.y - p.h - 24, '獲得 ' + it.name, gearColor(it));
  playSfx('pickup');
}
function equipItem(it) {
  player.eq[it.kind] = it;
  calcStats();
  num(player.x, player.y - player.h - 10, '裝備 ' + it.name, gearColor(it));
  beep(820, 0.06, 'sine', 0.03);
}
let pendingDel = null; // {it, f} 兩段式確認:2 秒內再點一次才分解
function dismantle(it) {
  const p = player;
  if (p.eq[it.kind] === it) return; // 裝備中不可分解
  const i = p.items.indexOf(it);
  if (i < 0) return;
  p.items.splice(i, 1);
  const m = addMat(it.r, it);
  pendingDel = null;
  saveMeta();
  num(p.x, p.y - p.h - 10, '分解 → 強化石+' + m.enh + (m.ench ? ' 附魔塵+' + m.ench : '') + (m.set ? ' 核心+' + m.set : ''), '#7dffd6');
  beep(500, 0.08, 'square', 0.03);
}
