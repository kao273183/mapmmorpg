"use strict";
// ---------- state ----------
let gameState = 'select';
let chosenCls = 'warrior';
// 職業：基礎職 + 進階職（advanced:true 且 base 指向基礎職；由精通 Lv10 解鎖）
const CLASSES = {
  warrior:   { name: '劍士', col: '#c84a4a', tag: '近戰  •  高生存', sub: '穩定推進，正面迎敵' },
  mage:      { name: '法師', col: '#5a4ad0', tag: '遠程  •  高爆發', sub: '掌控距離，範圍清場' },
  berserker:    { name: '狂戰士', col: '#ff6b3d', base: 'warrior', advanced: true, tag: '近戰  •  高風險爆發', sub: '以血換傷，越危險越強' },
  paladin:      { name: '聖騎士', col: '#ffd76a', base: 'warrior', advanced: true, tag: '近戰  •  防禦持續', sub: '護盾與治療，站得比誰都久' },
  elementalist: { name: '元素師', col: '#4ad0c8', base: 'mage',    advanced: true, tag: '遠程  •  多元素範圍', sub: '火冰雷齊發，成群清場' },
  warlock:      { name: '咒術師', col: '#a35ad0', base: 'mage',    advanced: true, tag: '遠程  •  詛咒消耗', sub: '疫病與虛弱，讓敵人自己倒下' }
};
function baseClassOf(cls) { const c = CLASSES[cls]; return (c && c.base) || cls; } // 進階職對應回基礎職（裝備/屬性/外觀共用）
function isAdvancedClass(cls) { return !!(CLASSES[cls] && CLASSES[cls].advanced); }
function baseClassIds() { return Object.keys(CLASSES).filter(id => !CLASSES[id].advanced); }
function advancedJobsFor(base) { return Object.keys(CLASSES).filter(id => CLASSES[id].base === base); }
let frame = 0;
let floor = 1, kills = 0, soulsRun = 0, floorT = 0, gearSeq = 1;
let runBossIds = []; // 本局擊敗的 Boss id（精通首殺加成用）
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
  perk: {}, revives: 0, affixDeathUsed: false, uniqueReviveUsed: false, eventAtk: 0, eventRerolls:0, aegisCd: 0, airJumped: false,
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
function curseRiskV(id) { return typeof dungeonCurseValue === 'function' ? dungeonCurseValue(id, 'risk') : 0; }
function curseRewardV(id) { return typeof dungeonCurseValue === 'function' ? dungeonCurseValue(id, 'reward') : 0; }
function blessingHeal(amount) {
  const blessed = typeof dungeonBlessingHealingAmount === 'function' ? dungeonBlessingHealingAmount(amount) : amount;
  return typeof dungeonCurseHealingAmount === 'function' ? dungeonCurseHealingAmount(blessed) : blessed;
}
function skillMpCost(definition) { return Math.ceil((definition && definition.mp || 0) * (1 + curseRiskV('mana_leak'))); }
function cardLv(c) { return c.stat ? player.cd[c.id] : perkV(c.id); }
const CARD_MAXLV = 5;
function rollPick() {
  const w = c => c.r === 0 ? 10 : c.r === 1 ? 4 + floor * 0.15 : 1 + floor * 0.12;
  const pool = CARDS.filter(c => cardLv(c) < CARD_MAXLV); // 滿等的卡不再抽到
  if (pool.length === 0) { // 全部卡滿等,改給靈魂獎勵
    soulsRun += 3;
    if (typeof recordDungeonReward === 'function') recordDungeonReward('souls', 3);
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
  return 8 + p.lv * 2.5 + eqStat('weapon', 'atk') + (baseClassOf(p.cls) === 'warrior' ? 4 : 0);
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
function uniquePassiveV(type) { const pw = (typeof equippedUniquePower === 'function') ? equippedUniquePower(type) : null; return pw ? (pw.amount || 0) : 0; } // 傳奇被動屬性值
function critRate() { return Math.min(1, 0.08 + 0.06 * player.cd.crit + 0.005 * meta.up.crit + accV('crit') + affixV('crit') + curseRewardV('broken_hourglass') + uniquePassiveV('critBonus')); }
function armorDef() {
  return Math.round(eqStat('armor', 'def') + eqStat('helmet', 'def') + affixV('def') + player.cd.def + curseRewardV('leaden_steps'));
}
function moveSpd() { return (2.0 + 0.4 * player.cd.spd + eqStat('boots', 'spd') + affixV('move') + blessingV('wind_stride') + uniquePassiveV('moveBonus') + (player.rageT > 0 ? player.rageSpd || 0.8 : 0)) * (1 - curseRiskV('leaden_steps')) * (player.chillT > 0 ? 0.55 : 1) * (player.hazardSlowT > 0 ? 0.72 : 1); }
function jumpV() { return 11.5 + (player.eq.boots && player.eq.boots.jmp ? player.eq.boots.jmp : 0); }
function skillDamageMul() { return (1 + 0.15 * player.cd.xdmg) * (1 + affixV('skillDmg')) * (1 + curseRewardV('mana_leak')) * (player.mp >= player.mmp * 0.7 ? 1 + 0.1 * perkV('overcharge') : 1); }
function cooldownMul() { return Math.pow(0.9, player.cd.aspd) * (1 + 0.18 * perkV('brute')) * Math.max(0.35, 1 - affixV('cooldown')) * (1 - 0.015 * meta.up.haste) * (1 + curseRiskV('broken_hourglass')); }
function potionDropChance() { return (0.07 + 0.04 * player.cd.pot) * dungeonDropMul(); }
function gearDropChance(elite, atFloor = floor) {
  const base = Math.min(0.025 + 0.0025 * atFloor + 0.01 * meta.up.treasure, 0.10);
  return Math.min(base + affixV('gearDrop') + blessingV('treasure_eye') + curseRewardV('razor_bargain') + (elite ? 0.15 + curseRewardV('elite_tribute') : 0), 0.50) * dungeonDropMul();
}
function soulGainMul() { return (1 + 0.05 * meta.up.soul) * (1 + 0.1 * perkV('greed')) * (1 + affixV('soulGain')) * (1 + blessingV('soul_bloom')) * (1 + curseRewardV('hardened_horde')) * (1 + curseRewardV('last_light')); }
const SOUL_DROP_CHANCE = 0.25;
function calcStats() {
  const p = player;
  const gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  p.mhp = Math.round((60 + (baseClassOf(p.cls) === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp) * (1 + 0.08 * meta.up.vit) * (1 + affixV('hpPct')) * (1 + blessingV('oak_heart')) * (1 - curseRiskV('frail_power')) * Math.max(0.4, 1 - 0.15 * perkV('bloodpact')));
  p.mmp = 30 + (baseClassOf(p.cls) === 'mage' ? 15 : 0) + p.lv * 4 + 15 * p.cd.mp;
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
function equippedUniquePower(type) { // 取得已裝備傳奇裝的被動能力（防具反傷／飾品免死等）
  const eq = player && player.eq;
  if (!eq || typeof uniqueDef !== 'function') return null;
  for (const slot of GEAR_PARTS) {
    const it = eq[slot];
    if (!it || !it.unique) continue;
    const def = uniqueDef(it.unique);
    if (def && def.powers) for (const pw of def.powers) if (pw.type === type) return pw;
  }
  return null;
}
function dmgPlayer(hit) { // 玩家受傷統一入口(護盾吸收→扣血→死亡)
  const p = player;
  if (typeof interruptFleeChannel === 'function') interruptFleeChannel(); // 受擊中斷逃走蓄力
  const event = typeof hit === 'number' ? { amount:hit } : (hit || {});
  let d = event.amount || 0;
  const sourceX = Number.isFinite(event.sourceX) ? event.sourceX : p.x;
  const sourceName = event.sourceName || '未知攻擊';
  d = Math.max(1, Math.round(d * (1 + 0.25 * perkV('glass')) * (1 - 0.01 * meta.up.guard))); // 玻璃大砲／永久防禦本能
  if (p.holyGuardT > 0) d = Math.max(1, Math.round(d * 0.8)); // 聖騎士聖盾壁壘：期間減傷
  if (typeof dungeonCurseIncomingDamage === 'function') d = Math.max(1, Math.round(dungeonCurseIncomingDamage(d)));
  const thornPow = equippedUniquePower('thorns');
  const thorns = 0.4 * perkV('thorns') + affixV('thorns') + (thornPow ? (thornPow.amount || 0) : 0); // +傳奇荊棘板甲
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
    const reviveBlocked = typeof dungeonCurseBlocksRevive === 'function' && dungeonCurseBlocksRevive();
    if (!reviveBlocked && p.revives > 0) { // 不死鳥:每場一次致死復活
      p.revives--; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#ffd23e', 30);
      num(p.x, p.y - p.h - 20, '不死鳥復活!', '#ffd23e');
      beep(880, 0.2, 'sine', 0.05); setTimeout(() => beep(1100, 0.2, 'sine', 0.05), 120);
      return false;
    }
    if (!reviveBlocked && affixV('undying') > 0 && !p.affixDeathUsed) {
      p.affixDeathUsed = true; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#d9a8ff', 30);
      num(p.x, p.y - p.h - 20, '不滅發動!', '#d9a8ff');
      beep(740, 0.2, 'sine', 0.05); setTimeout(() => beep(1040, 0.2, 'sine', 0.05), 120);
      return false;
    }
    if (!reviveBlocked && !p.uniqueReviveUsed && equippedUniquePower('revive')) { // 不滅之戒：每場一次致死免死
      p.uniqueReviveUsed = true; p.hp = Math.round(p.mhp * 0.5); p.inv = 90;
      burst(p.x, p.y - p.h / 2, '#ff9d3c', 30);
      num(p.x, p.y - p.h - 20, '不滅之戒發動!', '#ff9d3c');
      beep(760, 0.2, 'sine', 0.05); setTimeout(() => beep(1080, 0.2, 'sine', 0.05), 120);
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
  skillAnims.push({ key, x, y, life, maxLife:life, scale:o.scale || 1, flip:!!o.flip, rotation:o.rotation || 0, alpha:o.alpha == null ? 1 : o.alpha, layer:o.layer || 'front', tint:o.tint || null });
}
// 染色快取：同一組圖集 × 同一個顏色只做一次離屏重繪。
// 用 'color' 混合模式套用色相與飽和度、保留原本的明暗，比整片塗平好看得多。
const skillVfxTintCache = new Map();
function tintedSkillVfx(key, col) {
  const cacheKey = key + '|' + col;
  const hit = skillVfxTintCache.get(cacheKey);
  if (hit) return hit;
  const img = skillVfxImages[key];
  if (!img || !img.complete || !img.naturalWidth) return null;
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0);
  c.globalCompositeOperation = 'color';
  c.fillStyle = col; c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = 'destination-in'; // 把透明區域還原回來
  c.drawImage(img, 0, 0);
  skillVfxTintCache.set(cacheKey, cv);
  return cv;
}
function drawSkillVfxFrame(key, x, y, frameIndex, scale, flip, rotation, alpha, tint) {
  const def = SKILL_VFX_DEFS[key], img = skillVfxImages[key];
  if (!def || !img || !img.complete || !img.naturalWidth) return false;
  const src = tint ? tintedSkillVfx(key, tint) : img;
  if (!src) return false;
  const fs = def.frame || 72;                       // 來源每格尺寸（新素材不一定是 72）
  const cols = def.cols || def.frames;              // 網格圖集：每列格數（橫條時＝總格數，維持單列行為）
  const fi = Math.max(0, Math.min(def.frames - 1, frameIndex % def.frames));
  const sx = (fi % cols) * fs, sy = ((fi / cols) | 0) * fs; // 支援二維網格
  const size = 72 * (scale || 1);                   // 輸出一律 72，呼叫端的 scale 語意不變
  ctx.save(); ctx.translate(Math.round(x), Math.round(y));
  if (rotation) ctx.rotate(rotation);
  if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.drawImage(src, sx, sy, fs, fs, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}
function drawSkillAnimations(layer) {
  for (const a of skillAnims) {
    if (a.layer !== layer) continue;
    const def = SKILL_VFX_DEFS[a.key], elapsed = a.maxLife - a.life;
    const fi = Math.min(def.frames - 1, Math.floor(elapsed / a.maxLife * def.frames));
    drawSkillVfxFrame(a.key, a.x, a.y, fi, a.scale, a.flip, a.rotation, a.alpha, a.tint);
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
// 斬擊染色隨練度變化：4 階（未練 / 初階 / 進階Lv3 / 滿級Lv5），兩條分支不同色系。
// 低階偏暗沉，越練越亮；分支 a=未選或分支0、b=分支1。貼圖與細弧線共用同一色。
const SLASH_TINTS = {
  slash:      { a:['#8891ad','#aab6d8','#d0dcf8','#ffffff'], b:['#8891ad','#9fc0dc','#bfe4f8','#e8ffff'] }, // 鋼白／擊退 vs 連擊藍白
  rend:       { a:['#7a2830','#a01f28','#d83040','#ff5060'], b:['#7a3020','#c0402a','#ff6b3d','#ffa858'] }, // 撕裂血紅 vs 狂亂烈焰
  spin:       { a:['#8a7838','#c0982e','#f0c848','#fff4b0'], b:['#8a7838','#b8a8c8','#dccef0','#f4ecff'] }, // 龍捲金 vs 利刃銀
  holystrike: { a:['#8a7c58','#c8b068','#ffe490','#fff8d8'], b:['#8a7c58','#d4a848','#ffc848','#fff0b8'] }, // 守護聖金 vs 制裁金
  bloodrend:  { a:['#6a1c24','#a01f28','#d02838','#ff4a5a'], b:['#6a2418','#b03a20','#e85028','#ff7844'] }, // 嗜血深紅 vs 裂創橙
  smite:      { a:['#8a7c58','#d4b060','#ffe490','#fff8d8'], b:['#7a8a58','#a4d078','#c4ff98','#e4ffc8'] }, // 審判金 vs 聖療綠
  dash:       { a:['#3d6e84','#5fa0b4','#8ec9df','#c4f2ff'], b:['#3d6e84','#7466a4','#a888d4','#d4b4ff'] }  // 疾影青 vs 破陣紫
};
function slashPalette(id, t) { // 依技能練度與分支回傳 { hex, rgb }
  const R = SLASH_TINTS[id];
  if (!R) return { hex:null, rgb:'255,255,255' };
  const tier = t.ultimate ? 3 : t.level >= 3 ? 2 : t.level >= 1 ? 1 : 0;
  const lane = t.branch === 1 ? R.b : R.a; // 未選分支(-1)走 a
  const hex = lane[Math.min(lane.length - 1, tier)];
  const n = parseInt(hex.slice(1), 16);
  return { hex, rgb: (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) };
}
const SKILL_FX = {
  slash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    const pal = slashPalette('slash', t);
    p.slashArc = { col:pal.rgb, r:52, spread:2.2, w:5 };
    playSkillAnim('crescentBold', p.x + p.face * 38, p.y - 30, { scale:1.5 * t.area, flip:p.face < 0, tint:pal.hex });
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
    playSkillAnim('crescentRing', p.x, p.y - 28, { scale:Math.max(1.9, radius / 42), rotation:frame * 0.2, tint:slashPalette('spin', t).hex });
    playSfx('swordSwing', 0.85, 0.82);
    if (t.ultimate && t.branch === 0) addSkillZone('whirlwind', p.x, p.y - 28, radius * 1.1, 85, 18, 1, 1, 1.2 * t.dmg, '#e8a84c', { knock:18 });
    if (t.ultimate && t.branch === 1 && kills > beforeKills) { num(p.x, p.y - p.h - 22, '利刃重置!', '#ffe680'); return { resetCd:true }; }
  },
  dash(t) {
    const p = player;
    p.cast = 10; p.slashT = 10;
    const pal = slashPalette('dash', t);
    p.slashArc = { col:pal.rgb, r:48, spread:1.4, w:6 }; // 突進：短促殘影，隨練度變色
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
    playSkillAnim('streak', (x0 + nx) / 2, p.y - 28, { scale:1.7, flip:p.face < 0, tint:pal.hex, layer:'back' });
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
  rend(t) { // 狂戰士基本技：粗暴橫斬，血越低越痛
    const p = player;
    p.cast = 10; p.slashT = 10;
    const pal = slashPalette('rend', t);
    p.slashArc = { col:pal.rgb, r:44, spread:2.7, w:7 }; // 粗弧，比揮砍更野，隨練度變色
    playSkillAnim('crescentBold', p.x + p.face * 40, p.y - 30, { scale:1.5 * t.area, flip:p.face < 0, tint:pal.hex });
    playSkillAnim('crescentBold', p.x + p.face * 50, p.y - 20, { scale:1.1 * t.area, flip:p.face > 0, rotation:0.4, alpha:0.6, tint:pal.hex }); // 第二道反刀，讀起來是兩下
    playSfx('swordSwing'); beep(190, 0.07, 'sawtooth', 0.035);
    const missing = 1 - p.hp / p.mhp;
    const lowMul = 1 + missing * 0.5;                       // 滿血 1.0 → 空血 1.5
    const maxTargets = t.mechanic && t.branch === 1 ? 5 : 3;
    let hit = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      if (dx <= -12 || dx >= 80 * t.area || Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) >= 55 || hit >= maxTargets) continue;
      hit++;
      const r = skillDmg(t.dmg * lowMul);
      hitMon(m, r.d, r.crit);
      if (t.mechanic && t.branch === 0 && mons.includes(m)) {  // 撕裂：流血
        m.burnT = Math.max(m.burnT || 0, 120);
        m.burnDmg = Math.max(m.burnDmg || 0, Math.max(1, Math.round(r.d * (t.ultimate ? 0.24 : 0.12))));
      }
    }
    if (hit && t.ultimate && t.branch === 1 && p.hp < p.mhp * 0.4) { // 狂亂：低血時攻速暴增
      const i = loadouts[p.cls].indexOf('rend');
      if (i >= 0) p.slotCd[i] = Math.round(p.slotCd[i] * 0.45);
    }
    if (hit) burst(p.x + p.face * 34, p.y - p.h / 2, '#c02f3a', 6);
  },
  holystrike(t) { // 聖騎士基本技：穩健的聖光斬，每第三擊回血
    const p = player;
    p.cast = 10; p.slashT = 10;
    const pal = slashPalette('holystrike', t);
    p.slashArc = { col:pal.rgb, r:56, spread:1.7, w:4 }; // 細弧收束乾淨，隨練度變色
    playSkillAnim('crescentThin', p.x + p.face * 40, p.y - 30, { scale:1.5 * t.area, flip:p.face < 0, tint:pal.hex });
    playSfx('swordSwing'); beep(660, 0.07, 'sine', 0.032);
    p.skillCasts.holystrike = (p.skillCasts.holystrike || 0) + 1;
    const third = p.skillCasts.holystrike % 3 === 0;
    let hit = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      if (dx <= -12 || dx >= 85 * t.area || Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) >= 55 || hit >= 3) continue;
      hit++;
      const hurt = t.mechanic && t.branch === 1 && m.hp < m.mhp * 0.99 ? 1.15 : 1; // 制裁：對已受傷目標加傷
      const r = skillDmg(t.dmg * hurt);
      hitMon(m, r.d, r.crit || (third && t.ultimate && t.branch === 1));
    }
    if (hit && third && !(t.branch === 1)) {                 // 守護：第三擊回復
      const heal = Math.min(p.mhp - p.hp, Math.round(p.mhp * (t.mechanic && t.branch === 0 ? 0.05 : 0.025)));
      if (heal > 0) { p.hp += heal; num(p.x, p.y - p.h - 26, '+' + heal, '#8fe6a0', { size:11 }); }
      if (t.ultimate && t.branch === 0) { p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.08)); p.shieldT = Math.max(p.shieldT, 180); }
      burst(p.x, p.y - p.h / 2, '#ffe9a8', 8);
    }
    if (hit) playSkillAnim('impact', p.x + p.face * 52, p.y - p.h / 2, { scale:0.7 });
  },
  elembolt(t) { // 元素師基本技：火→冰→雷輪替的飛彈
    const p = player;
    p.cast = 12;
    p.skillCasts.elembolt = (p.skillCasts.elembolt || 0) + 1;
    const cycle = p.skillCasts.elembolt % 3;                  // 1火 2冰 0雷
    const elem = cycle === 1 ? 'fire' : cycle === 2 ? 'ice' : 'bolt';
    const all = t.ultimate && t.branch === 1;                 // 連動終極：三元素同時附加
    const x = p.x + p.face * 20, y = p.y - 30;
    const aim = fireballAim(p, x, y), speed = 7.8;
    projs.push({ x, y, vx:p.face * Math.cos(aim.angle) * speed, vy:Math.sin(aim.angle) * speed,
      t:aim.target ? 90 : 70, mult:t.dmg, kind:'elem', elem, elemAll:all, talent:t,
      aimTarget:aim.target, aimT:aim.target ? 24 : 0 });
    playSfx(elem === 'ice' ? 'spellIce' : elem === 'bolt' ? 'spellLightning' : 'fire', 0.7);
  },
  shadowbolt(t) { // 咒術師基本技：直傷偏低，靠疊加腐蝕
    const p = player;
    p.cast = 12;
    const x = p.x + p.face * 20, y = p.y - 30;
    const aim = fireballAim(p, x, y), speed = 7.2;
    projs.push({ x, y, vx:p.face * Math.cos(aim.angle) * speed, vy:Math.sin(aim.angle) * speed,
      t:aim.target ? 90 : 70, mult:0.8 * t.dmg, kind:'shadow', talent:t,
      aimTarget:aim.target, aimT:aim.target ? 24 : 0 });
    playSfx('fire', 0.45); beep(180, 0.09, 'triangle', 0.035);
  },
  bloodrend(t) { // 狂戰士：消耗自身HP換取高傷，血越低傷害越高
    const p = player;
    const cost = Math.max(1, Math.round(p.mhp * (t.branch === 0 ? (t.ultimate ? 0.06 : 0.08) : 0.10))); // 以血換傷：HP 才是真正的代價
    if (p.hp <= cost + 1) { num(p.x, p.y - p.h - 10, 'HP不足', '#ff8a8a'); return false; }
    p.hp -= cost;
    num(p.x, p.y - p.h - 26, '-' + cost, '#ff5a5a', { kind:'hurt', size:12 });
    const missing = 1 - p.hp / p.mhp;                       // 越殘血越強
    const lowMul = 1 + missing * (t.mechanic && t.branch === 1 ? 1.1 : 0.75);
    p.cast = 12; p.slashT = 12;
    const bpal = slashPalette('bloodrend', t);
    p.slashArc = { col:bpal.rgb, r:60, spread:2.4, w:8 };
    playSkillAnim('thrust', p.x + p.face * 50, p.y - 30, { scale:1.7 * t.area, flip:p.face < 0, tint:bpal.hex });
    playSfx('swordSwing'); beep(150, 0.14, 'sawtooth', 0.05);
    let hit = 0;
    const range = 150 * t.area;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      if (dx > -16 && dx < range && Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < 74) {
        hit++;
        const r = skillDmg(1.9 * t.dmg * lowMul);
        hitMon(m, r.d, r.crit);
        if (t.ultimate && t.branch === 1) { m.burnT = Math.max(m.burnT || 0, 150); m.burnDmg = Math.max(m.burnDmg || 0, Math.round(r.d * 0.2)); } // 裂創：流血
      }
    }
    if (hit && t.ultimate && t.branch === 0) p.hp = Math.min(p.mhp, p.hp + cost); // 嗜血：擊中回補消耗
    burst(p.x + p.face * 40, p.y - p.h / 2, '#ff4d4d', 16);
  },
  warcry(t) { // 狂戰士：威嚇周圍敵人並自我狂暴
    const p = player;
    const range = 190 * t.area;
    let hit = 0;
    for (const m of mons) {
      if (Math.abs(m.x - p.x) > range || Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) > 110) continue;
      hit++;
      m.slowT = Math.max(m.slowT || 0, t.branch === 0 ? 210 : 150);
      if (t.ultimate && t.branch === 0 && !(m.ccT > 0)) { m.freezeT = Math.max(m.freezeT || 0, 40); m.ccT = 112; num(m.x, m.y - m.h - 18, '震懾', '#ffd36a'); }
    }
    p.rageT = Math.max(p.rageT, Math.round((t.branch === 1 ? 420 : 300) * t.area));
    p.rageAtk = Math.max(p.rageAtk, 0.25); p.rageSpd = Math.max(p.rageSpd, 0.6);
    if (t.ultimate && t.branch === 1) p.rageLifesteal = Math.max(p.rageLifesteal, 0.06);
    p.mp = Math.min(p.mmp, p.mp + 10);
    p.cast = 10;
    playSkillAnim('groundBurst', p.x, p.y - 31, { scale:1.6 * t.area, layer:'back' });
    burst(p.x, p.y - p.h / 2, '#ffb45e', 22);
    beep(140, 0.24, 'square', 0.055);
    if (hit) num(p.x, p.y - p.h - 34, '威嚇 ' + hit, '#ffd36a');
  },
  bulwark(t) { // 聖騎士：吸收傷害的聖盾，期間減傷
    const p = player;
    const guard = t.mechanic && t.branch === 0;
    p.shieldHp = Math.round(p.mhp * (guard ? 0.5 : 0.36) * t.dmg);
    p.shieldT = guard ? 900 : 660;
    p.shieldReflect = t.mechanic && t.branch === 1 ? 0.25 : 0;
    p.shieldBurst = t.ultimate && t.branch === 1;
    p.shieldBreakMp = 0;
    p.holyGuardT = p.shieldT;                                  // 減傷（dmgPlayer 讀取）
    if (guard) p.hp = Math.min(p.mhp, p.hp + Math.round(p.mhp * 0.12));
    if (t.ultimate && t.branch === 0) p.ccImmuneT = p.shieldT; // 庇護：免疫緩速與凍結
    p.cast = 12;
    playSkillAnim('wardShield', p.x, p.y - p.h / 2, { scale:1.5, alpha:0.9, tint:'#ffd76a' });
    burst(p.x, p.y - p.h / 2, '#ffd76a', 20);
    playSfx('uiConfirm', 0.5, 0.9); beep(520, 0.18, 'sine', 0.045);
    num(p.x, p.y - p.h - 22, '聖盾 ' + p.shieldHp, '#ffe9a8');
  },
  smite(t) { // 聖騎士：前方神聖打擊，命中回復自身
    const p = player;
    const wide = t.ultimate && t.branch === 0;
    const range = (140 + (wide ? 44 : 0)) * t.area;
    p.cast = 12; p.slashT = 12;
    const spal = slashPalette('smite', t);
    p.slashArc = { col:spal.rgb, r:58, spread:2.0, w:6 };
    playSkillAnim('groundImpact', p.x + p.face * 52, p.y - 12, { scale:1.25 * t.area, flip:p.face < 0 });
    playSkillAnim('thrust', p.x + p.face * 46, p.y - 32, { scale:1.5 * t.area, flip:p.face < 0, rotation:0.6, tint:spal.hex });
    playSfx('swordSwing'); beep(880, 0.12, 'sine', 0.05);
    let hit = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      if (dx <= -20 || dx >= range || Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) > 80) continue;
      hit++;
      const r = skillDmg(1.9 * t.dmg);
      hitMon(m, r.d, r.crit || wide);
      if (t.mechanic && t.branch === 0 && mons.includes(m)) { m.vulnT = 180; m.vulnMul = 1.2; num(m.x, m.y - m.h - 20, '審判', '#ffe08a'); }
    }
    if (hit) {
      const healEach = Math.round(p.mhp * (t.mechanic && t.branch === 1 ? 0.05 : 0.025));
      const heal = Math.min(p.mhp - p.hp, healEach * Math.min(3, hit));
      if (heal > 0) { p.hp += heal; num(p.x, p.y - p.h - 34, '+' + heal, '#8fe6a0', { size:12 }); }
      if (t.ultimate && t.branch === 1) p.mp = Math.min(p.mmp, p.mp + 8);
    }
    burst(p.x + p.face * 46, p.y - p.h / 2, '#ffe9a8', 16);
  },
  elemburst(t) { // 元素師：以自身為中心的火冰雷三環爆發
    const p = player;
    const range = 176 * t.area * (t.mechanic && t.branch === 0 ? 1.25 : 1);
    p.cast = 14;
    playSkillAnim('explosion', p.x, p.y - p.h / 2, { scale:1.5 * t.area, layer:'back' });
    for (const m of mons.slice()) {
      if (Math.hypot(m.x - p.x, (m.y - m.h / 2) - (p.y - p.h / 2)) > range) continue;
      const elem = ((m.x + m.y) | 0) % 3;                       // 0火 1冰 2雷，依位置決定避免每幀跳動
      const hot = t.mechanic && t.branch === 1 && elem === 0;
      const r = skillDmg(1.5 * t.dmg * (hot ? 1.35 : 1));
      hitMon(m, r.d, r.crit);
      if (!mons.includes(m)) continue;
      if (elem === 0 && hot) { m.burnT = Math.max(m.burnT || 0, 150); m.burnDmg = Math.max(m.burnDmg || 0, Math.round(r.d * 0.18)); m.burnSpread = t.ultimate && t.branch === 1; }
      else if (elem === 1 && !(m.ccT > 0)) { m.slowT = Math.max(m.slowT || 0, 150); }
      else if (elem === 2) { chainToNearby(m, Math.round(r.d * 0.4)); }
    }
    burst(p.x, p.y - p.h / 2, '#ff7a36', 12); burst(p.x, p.y - p.h / 2, '#71c9e8', 12);
    // 三重：0.35 秒後追加第二段（沿用技能區域的延遲機制）
    if (t.ultimate && t.branch === 0) addSkillZone('aftershock', p.x, p.y - p.h / 2, range, 96, 21, 1, 1, 1.05 * t.dmg, '#4ad0c8');
    playSfx('spellFire', 0.7); beep(300, 0.2, 'triangle', 0.05);
  },
  chainstorm(t) { // 元素師：雷球在敵人之間連鎖跳躍
    const p = player;
    const focus = t.mechanic && t.branch === 1;
    const jumps = focus ? 1 : (5 + (t.mechanic && t.branch === 0 ? 2 : 0));
    const decay = (t.ultimate && t.branch === 0) ? 1 : 0.85;
    let cur = null, bd = 1e9;
    for (const m of mons) { const d = Math.hypot(m.x - p.x, (m.y - m.h / 2) - (p.y - p.h / 2)); if (d < 420 && d < bd) { bd = d; cur = m; } }
    p.cast = 12;
    playSfx('spellLightning', 0.75); beep(760, 0.1, 'square', 0.05);
    if (!cur) { num(p.x, p.y - p.h - 14, '沒有目標', '#9aa2c8'); burst(p.x, p.y - p.h / 2, '#e9d45a', 10); return; }
    let mul = focus ? 3.6 : 2.8;
    const seen = [];
    for (let j = 0; j <= jumps && cur; j++) {
      seen.push(cur);
      playSkillAnim('beam', cur.x, cur.y - cur.h / 2, { scale:1.1, layer:'back', alpha:0.8 });
      const r = skillDmg(mul * t.dmg);
      hitMon(cur, r.d, r.crit);
      if (focus && t.ultimate && mons.includes(cur)) { cur.freezeT = Math.max(cur.freezeT || 0, 46); cur.ccT = 112; num(cur.x, cur.y - cur.h - 18, '麻痺', '#e9d45a'); }
      burst(cur.x, cur.y - cur.h / 2, '#e9d45a', 12);
      mul *= decay;
      let next = null, nd = 1e9;
      for (const m of mons) { if (seen.indexOf(m) >= 0 || m.hp <= 0) continue; const d = Math.hypot(m.x - cur.x, (m.y - m.h / 2) - (cur.y - cur.h / 2)); if (d < 220 && d < nd) { nd = d; next = m; } }
      cur = next;
    }
  },
  plague(t) { // 咒術師：範圍持續傷害 + 虛弱
    const p = player;
    const range = 200 * t.area * (t.mechanic && t.branch === 0 ? 1.3 : 1);
    const heavy = t.mechanic && t.branch === 1;
    p.cast = 12;
    playSkillAnim('splash', p.x, p.y - 14, { scale:2.2 * t.area, layer:'back', alpha:0.9, tint:'#a35ad0' });
    playSkillAnim('smoke', p.x, p.y - p.h / 2, { scale:1.8 * t.area, layer:'back', alpha:0.5 });
    playSfx('spellIce', 0.5); beep(180, 0.26, 'sawtooth', 0.045);
    let hit = 0;
    for (const m of mons.slice()) {
      if (Math.hypot(m.x - p.x, (m.y - m.h / 2) - (p.y - p.h / 2)) > range) continue;
      hit++;
      const r = skillDmg(0.9 * t.dmg);
      hitMon(m, r.d, r.crit);
      if (!mons.includes(m)) continue;
      const dot = Math.round(r.d * (heavy ? 0.34 : 0.24) * (heavy && t.ultimate ? 2 : 1));
      m.burnT = Math.max(m.burnT || 0, 260);
      m.burnDmg = Math.max(m.burnDmg || 0, Math.max(1, dot));
      m.burnSpread = t.ultimate && t.branch === 0;               // 蔓延：死亡傳染
      m.vulnT = 260; m.vulnMul = heavy ? 1.3 : 1.15;
      num(m.x, m.y - m.h - 20, '疫', '#a35ad0', { size:11 });
    }
    burst(p.x, p.y - p.h / 2, '#a35ad0', 22);
    if (hit) num(p.x, p.y - p.h - 34, '感染 ' + hit, '#c99ae8');
  },
  soulleech(t) { // 咒術師：直線抽取生命
    const p = player;
    const range = 260 * t.area;
    p.cast = 14;
    playSkillAnim('beam', p.x + p.face * (range / 2), p.y - p.h / 2, { scale:1.3 * t.area, flip:p.face < 0, layer:'back', alpha:0.85 });
    playSfx('spellFire', 0.45); beep(220, 0.22, 'sine', 0.05);
    let drained = 0, kills = 0;
    for (const m of mons.slice()) {
      const dx = (m.x - p.x) * p.face;
      if (dx <= -20 || dx >= range || Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) > 66) continue;
      const r = skillDmg(1.6 * t.dmg);
      hitMon(m, r.d, r.crit);
      let ratio = t.mechanic && t.branch === 0 ? 0.28 : 0.18;
      if (t.ultimate && t.branch === 0 && p.hp < p.mhp * 0.4) ratio *= 2; // 吸血：低血翻倍
      drained += Math.round(r.d * ratio);
      if (!mons.includes(m)) kills++;
      burst(m.x, m.y - m.h / 2, '#a35ad0', 10);
    }
    if (drained > 0) {
      const heal = Math.min(p.mhp - p.hp, drained);
      if (heal > 0) { p.hp += heal; num(p.x, p.y - p.h - 34, '+' + heal, '#c99ae8', { size:12 }); }
      if (t.mechanic && t.branch === 1) p.mp = Math.min(p.mmp, p.mp + Math.max(4, Math.round(drained * 0.4)));
    }
    if (kills && t.ultimate && t.branch === 1) { const i = loadouts[p.cls].indexOf('soulleech'); if (i >= 0) p.slotCd[i] = 0; } // 奪魂：擊殺重置
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
  const mpCost = skillMpCost(def);
  if (p.mp < mpCost) {
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
  if (!result || !result.free) p.mp -= mpCost;
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
  const bases = kind === 'weapon' ? GEAR_BASE.weapon[baseClassOf(cls)] : GEAR_BASE[kind]; // 進階職沿用基礎職武器名
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
function createGear(n, slot, cls, rarity, setId, uniqueId) {
  cls = baseClassOf(cls); // 裝備一律標記基礎職，進階職才穿得到自己掉的裝
  const uniq = (typeof uniqueDef === 'function') ? uniqueDef(uniqueId) : null;
  const set = GEAR_SET_BY_ID[setId];
  const r = uniq ? Math.max(uniq.minR || 3, rarity) : (set ? Math.max(3, rarity) : rarity);
  const m = [1, 1.5, 2.1, 2.8, 3.6][r] * (0.85 + Math.random() * 0.3);
  const it = { kind: slot, r: r, id: 'g' + (gearSeq++), cls: cls, affixes: Array(affixSlots(r)).fill(null) };
  if (set) it.setId = set.id;
  if (slot === 'weapon') {
    it.atk = Math.max(1, Math.round((4 + n * 2) * m));
    it.wpn = baseClassOf(cls) === 'mage' ? 'stave' : 'sword';
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
  if (uniq) {
    it.unique = uniq.id;
    it.name = uniq.name;
    if (uniq.id === 'gale_boots') { it.spd = Math.min(1.6, (it.spd || 0) + 0.35); it.jmp = 1; it.desc = '移速+' + it.spd + ' 跳躍+1'; }
  } else {
    it.name = set ? set.pieces[slot] : gearName(slot, r, cls);
  }
  return it;
}
function genGear(n, forceR, source) {
  const cap = typeof dungeonMaxRarity === 'function' ? dungeonMaxRarity() : 4; // 一般模式頂多藍裝
  const slots = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
  const slot = pick(slots);
  const baseR = Math.min(cap, forceR != null ? forceR : rollRarity(n));
  // 傳奇命名裝：高稀有度有機率生成 Unique（取代套裝；一般模式 cap=1 到不了這）。
  let uniqueId = null;
  if (baseR >= 3 && typeof uniqueIdsFor === 'function') {
    const cands = uniqueIdsFor(slot, player.cls, baseR);
    if (cands.length && Math.random() < UNIQUE_DROP_RATE) uniqueId = pick(cands);
  }
  // 套裝為史詩以上；上限低於 3 的模式（一般）不掉套裝；已是 Unique 則不再滾套裝。
  const rate = (!uniqueId && cap >= 3 && n >= 5 && SET_PARTS.includes(slot)) ? (SET_DROP_RATE[source || 'normal'] || SET_DROP_RATE.normal) : 0;
  const setIds = setIdsForClass(player.cls);
  const setId = setIds.length && Math.random() < rate ? pick(setIds) : null;
  return createGear(n, slot, player.cls, baseR, setId, uniqueId);
}
function forgeSetPiece(setId) {
  const set = GEAR_SET_BY_ID[setId];
  if (!set || set.cls !== baseClassOf(chosenCls)) { menuMsg = { text:'請切換到套裝對應職業', color:'#ff8a8a', t:180 }; return; }
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
