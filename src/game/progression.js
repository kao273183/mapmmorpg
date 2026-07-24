"use strict";
// ---------- meta progression ----------
const meta = {
  souls: 0, up: { atk: 0, vit: 0, crit: 0, guard: 0, haste: 0, pots: 0, treasure: 0, soul: 0, recovery: 0, alchemy: 0 },
  stash: [], mats: { enh: 0, ench: 0, set: 0 }, stashSeq: 1,
  loadout: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  playerName: '勇者',
  // 統一外觀系統（K1）：稱號/配色/光環/技能外觀共用同一套擁有與選用狀態
  cosmetics: {
    owned: { title: [], color: [], aura: ['none'], skin: [] },
    equipped: { title: null, color: null, aura: 'none', skin: null }
  },
  // 職業精通（J1）：每個職業（含未來進階職）獨立累積，零局內戰力
  mastery: {}
};
const GEAR_PARTS = ['weapon', 'armor', 'helmet', 'boots', 'acc'];
const SET_PARTS = ['weapon', 'armor', 'helmet', 'boots'];
const SET_CRAFT_COST = 6;
const SET_DROP_RATE = { normal:0.02, event:0.05, boss:0.08 };
const GEAR_SETS = [
  {
    id:'blood_oath', cls:'warrior', name:'血誓戰裝', color:'#ff765f',
    pieces:{ weapon:'血誓焚刃', armor:'血誓骨鎧', helmet:'血誓角盔', boots:'血誓戰靴' },
    bonuses:[{ pieces:2, stat:'lifesteal', value:0.05, text:'吸血 +5%' }, { pieces:4, stat:'lowHpAtk', value:0.30, text:'低於35% HP時攻擊 +30%' }]
  },
  {
    id:'sun_guard', cls:'warrior', name:'日耀守衛', color:'#ffd36a',
    pieces:{ weapon:'日耀聖劍', armor:'日耀鎧甲', helmet:'日耀冠盔', boots:'日耀戰靴' },
    bonuses:[{ pieces:2, stat:'hpPct', value:0.12, text:'HP上限 +12%' }, { pieces:4, stat:'def', value:4, text:'固定減傷 +4' }]
  },
  {
    id:'starfire', cls:'mage', name:'星火秘儀', color:'#ff9b52',
    pieces:{ weapon:'星火權杖', armor:'星火法袍', helmet:'星火兜帽', boots:'星火步履' },
    bonuses:[{ pieces:2, stat:'skillDmg', value:0.12, text:'技能傷害 +12%' }, { pieces:4, stat:'cooldown', value:0.10, text:'技能冷卻 -10%' }]
  },
  {
    id:'voidweave', cls:'mage', name:'虛空織法', color:'#c58aff',
    pieces:{ weapon:'虛空咒杖', armor:'虛空法袍', helmet:'虛空兜帽', boots:'虛空步履' },
    bonuses:[{ pieces:2, stat:'crit', value:0.06, text:'爆擊率 +6%' }, { pieces:4, stat:'mpKill', value:5, text:'擊殺回復 MP +5' }]
  }
];
const GEAR_SET_BY_ID = Object.fromEntries(GEAR_SETS.map(s => [s.id, s]));
// ---------- 傳奇命名裝（Unique）：有名字且帶固定特殊能力（暗黑風）----------
// 只在困難模式的高稀有度掉落（一般模式 maxRarity=1 不會到）。能力多重用既有機制。
const UNIQUE_COLOR = '#ff9d3c';   // 傳奇命名裝專屬色（暖金橙）
const UNIQUE_DROP_RATE = 0.28;    // 高稀有度掉落時轉為 Unique 的機率
const UNIQUE_DEFS = {
  frost_blade:   { id:'frost_blade',   name:'冰霜劍',   kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'冰霜凍原', powers:[{ type:'freeze', chance:0.22, dur:48 }],   powerText:'命中 22% 凍結敵人' },
  bloodfang:     { id:'bloodfang',     name:'嗜血巨劍', kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'通用',     powers:[{ type:'lifesteal', amount:0.12 }],          powerText:'攻擊吸血 12%' },
  frost_stave:   { id:'frost_stave',   name:'寒霜法杖', kind:'weapon', wpn:'stave', cls:'mage',    minR:3, biome:'冰霜凍原', powers:[{ type:'slow', chance:0.35, dur:150 }],       powerText:'命中 35% 緩速敵人' },
  thunder_stave: { id:'thunder_stave', name:'雷霆法杖', kind:'weapon', wpn:'stave', cls:'mage',    minR:3, biome:'虛空深淵', powers:[{ type:'chain', chance:0.32, mul:0.5 }],      powerText:'命中 32% 連鎖閃電' },
  flame_blade:   { id:'flame_blade',   name:'烈焰之刃', kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'熾熱熔岩', powers:[{ type:'burn', chance:0.32, dur:150, dmgMul:0.35 }], powerText:'命中 32% 點燃（持續燃燒）' },
  gale_boots:    { id:'gale_boots',    name:'疾風之靴', kind:'boots',               cls:'any',     minR:3, biome:'通用',     powers:[{ type:'stat' }],                            powerText:'極高移速、必帶跳躍' },
  thorn_plate:   { id:'thorn_plate',   name:'荊棘板甲', kind:'armor',               cls:'any',     minR:3, biome:'通用',     powers:[{ type:'thorns', amount:0.5 }],              powerText:'受擊反傷 50% 攻擊力' },
  undying_ring:  { id:'undying_ring',  name:'不滅之戒', kind:'acc',                 cls:'any',     minR:3, biome:'通用',     powers:[{ type:'revive' }],                          powerText:'每場一次致命免死' },
  // — I1-C 擴充：群系主題 + 頭盔類 —
  dawn_crown:    { id:'dawn_crown',    name:'曦光頭冠', kind:'helmet',              cls:'any',     minR:3, biome:'翠綠草原', powers:[{ type:'critBonus', amount:0.10 }],          powerText:'爆擊率 +10%' },
  shadow_hood:   { id:'shadow_hood',   name:'窟影兜帽', kind:'helmet',              cls:'any',     minR:3, biome:'幽暗洞窟', powers:[{ type:'moveBonus', amount:0.6 }],           powerText:'移速大幅提升' },
  verdant_blade: { id:'verdant_blade', name:'翠風劍',   kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'翠綠草原', powers:[{ type:'slow', chance:0.35, dur:150 }],       powerText:'命中 35% 緩速敵人' },
  venom_fang:    { id:'venom_fang',    name:'劇毒之牙', kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'幽暗洞窟', powers:[{ type:'burn', chance:0.32, dur:180, dmgMul:0.28 }], powerText:'命中 32% 劇毒（持續傷害）' },
  rift_blade:    { id:'rift_blade',    name:'裂空劍',   kind:'weapon', wpn:'sword', cls:'warrior', minR:3, biome:'虛空深淵', powers:[{ type:'chain', chance:0.32, mul:0.5 }],      powerText:'命中 32% 連鎖閃電' },
  soulreaper:    { id:'soulreaper',    name:'奪魂杖',   kind:'weapon', wpn:'stave', cls:'mage',    minR:3, biome:'幽暗洞窟', powers:[{ type:'lifesteal', amount:0.10 }],          powerText:'法擊吸血 10%' },
  pyro_stave:    { id:'pyro_stave',    name:'炎爆法杖', kind:'weapon', wpn:'stave', cls:'mage',    minR:3, biome:'熾熱熔岩', powers:[{ type:'burn', chance:0.32, dur:150, dmgMul:0.35 }], powerText:'命中 32% 點燃（持續燃燒）' }
};
const UNIQUE_LIST = Object.values(UNIQUE_DEFS);
function uniqueDef(id) { return id ? UNIQUE_DEFS[id] : null; }
function uniqueIdsFor(slot, cls, r) {
  return UNIQUE_LIST.filter(u => u.kind === slot && (u.cls === 'any' || u.cls === baseOf(cls)) && r >= (u.minR || 3)).map(u => u.id);
}
function gearColor(it) {
  if (it && it.unique) return UNIQUE_COLOR;
  const set = it && GEAR_SET_BY_ID[it.setId];
  return set ? set.color : RARITY_COL[(it && it.r) || 0];
}
function setIdsForClass(cls) { return GEAR_SETS.filter(s => s.cls === cls).map(s => s.id); }
function equippedSetCounts(eq) {
  const counts = {};
  for (const part of SET_PARTS) {
    const it = eq && eq[part];
    if (it && GEAR_SET_BY_ID[it.setId]) counts[it.setId] = (counts[it.setId] || 0) + 1;
  }
  return counts;
}
function setBonusV(stat) {
  if (typeof player === 'undefined' || !player.eq) return 0;
  const counts = equippedSetCounts(player.eq);
  let total = 0;
  for (const set of GEAR_SETS) for (const bonus of set.bonuses) {
    if ((counts[set.id] || 0) >= bonus.pieces && bonus.stat === stat) total += bonus.value;
  }
  return total;
}
function loadoutSetCount(setId) {
  let count = 0;
  for (const part of SET_PARTS) {
    const uid = meta.loadout[part], it = uid && meta.stash.find(s => s.uid === uid);
    if (it && it.setId === setId) count++;
  }
  return count;
}
function baseOf(cls) { return (typeof baseClassOf === 'function') ? baseClassOf(cls) : cls; } // systems.js 較晚載入時的安全退回
function gearUsableByClass(it, cls) { return !it || !it.cls || it.cls === baseOf(cls); } // 進階職沿用基礎職裝備線
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
  const set = GEAR_SET_BY_ID[it.setId];
  if (set && SET_PARTS.includes(it.kind)) it.cls = set.cls;
  else if (it.setId) delete it.setId;
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
  return total + setBonusV(stat);
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
function matFor(r, it) {
  const base = [{ enh: 1, ench: 0 }, { enh: 3, ench: 1 }, { enh: 6, ench: 3 }, { enh: 10, ench: 6 }, { enh: 16, ench: 10 }][r] || { enh: 1, ench: 0 };
  return { enh:base.enh, ench:base.ench, set:it && it.setId ? (r >= 4 ? 3 : 2) : 0 };
}
function addMat(r, it) {
  const m = matFor(r, it);
  meta.mats.enh += m.enh; meta.mats.ench += m.ench; meta.mats.set += m.set;
  return m;
}
function stashGear(it) { // 存入倉庫;已在庫(開局帶出的)跳過;滿則轉材料
  if (it.uid && meta.stash.some(s => s.uid === it.uid)) return true;
  if (meta.stash.length >= STASH_CAP) { addMat(it.r, it); return false; }
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
  fire:   { cls:'mage', name:'火球術', mp:8,  cd:45, minCd:18, basic:true, desc:'對飛行怪有柔和追蹤的火球' },
  bolt:   { cls:'mage', name:'落雷術', mp:20, cd:170, desc:'範圍內最多4目標,1.8倍傷害' },
  ice:    { cls:'mage', name:'冰錐術', mp:10, cd:90,  desc:'穿透冰錐,命中緩速敵人' },
  meteor: { cls:'mage', name:'隕石術', mp:25, cd:300, desc:'呼喚3顆隕石,2.2倍範圍傷害' },
  shield: { cls:'mage', name:'魔法盾', mp:16, cd:480, desc:'護盾吸收30%最大HP的傷害' },
  // 進階職：狂戰士（沿用劍士技能，另有專屬技能）
  rend:      { cls:'berserker', name:'裂顱斬', mp:4, cd:42, minCd:18, basic:true, desc:'粗暴的橫斬,血量越低威力越高' },
  bloodrend: { cls:'berserker', name:'血怒斬', mp:11, cd:150, desc:'消耗自身HP,對前方造成1.9倍傷害;血越低傷害越高' },
  warcry:    { cls:'berserker', name:'戰吼',   mp:14, cd:420, desc:'威嚇周圍敵人使其緩速,自身狂暴並回復MP' },
  // 進階職：聖騎士（劍士系，防禦持續）
  holystrike:{ cls:'paladin', name:'聖印斬', mp:5, cd:48, minCd:20, basic:true, desc:'穩健的聖光斬擊,每第三擊回復自身HP' },
  bulwark:   { cls:'paladin', name:'聖盾壁壘', mp:16, cd:420, desc:'展開聖盾吸收傷害,期間受到的傷害降低' },
  smite:     { cls:'paladin', name:'制裁光錘', mp:12, cd:150, desc:'前方神聖打擊,每命中一名敵人回復自身HP' },
  // 進階職：元素師（法師系，多元素範圍）
  elembolt:  { cls:'elementalist', name:'元素飛彈', mp:8, cd:45, minCd:18, basic:true, desc:'依序射出火/冰/雷飛彈,各自附帶元素效果' },
  elemburst: { cls:'elementalist', name:'元素爆發', mp:18, cd:200, desc:'以自身為中心引爆火冰雷三環,附加隨機元素效果' },
  chainstorm:{ cls:'elementalist', name:'連鎖風暴', mp:18, cd:260, desc:'雷球在敵人之間連鎖跳躍,每次跳躍略微衰減' },
  // 進階職：咒術師（法師系，詛咒消耗）
  shadowbolt:{ cls:'warlock', name:'暗影箭', mp:7, cd:48, minCd:20, basic:true, desc:'直傷較低,但會疊加腐蝕的持續傷害' },
  // 弓箭手（基礎職）
  shoot:     { cls:'archer', name:'射擊', mp:4, cd:40, minCd:16, basic:true, desc:'射出一箭,對命中的第一個敵人造成傷害' },
  multishot: { cls:'archer', name:'多重箭', mp:12, cd:150, desc:'扇形射出三箭,覆蓋前方一片' },
  pierce:    { cls:'archer', name:'貫穿射', mp:14, cd:180, desc:'射出強力一箭,貫穿直線上所有敵人' },
  arrowrain: { cls:'archer', name:'箭雨',   mp:22, cd:320, desc:'呼喚箭雨落在指定範圍,持續覆蓋' },
  powershot: { cls:'archer', name:'勁弩射', mp:16, cd:200, desc:'蓄力一箭,高傷並擊退命中的敵人' },
  // 進階職：遊俠（弓箭手系，陷阱與機動）
  swiftshot: { cls:'ranger', name:'疾羽射', mp:3, cd:32, minCd:14, basic:true, desc:'輕快的一箭,射速快;命中後短暫提升移速' },
  snaretrap: { cls:'ranger', name:'絆索陷阱', mp:12, cd:240, desc:'在前方佈下陷阱,持續傷害並纏住踏入的敵人' },
  evade:     { cls:'ranger', name:'迅步', mp:10, cd:300, desc:'瞬間翻滾拉開距離,期間無敵並強化下一箭' },
  // 進階職：神射手（弓箭手系，蓄力與穿透）
  snipe:     { cls:'marksman', name:'狙擊', mp:6, cd:58, minCd:24, basic:true, desc:'較慢但精準的一箭,爆擊率提升' },
  chargeshot:{ cls:'marksman', name:'蓄力狙擊', mp:18, cd:300, desc:'凝聚全力的一箭,貫穿並造成巨額傷害' },
  deadeye:   { cls:'marksman', name:'鷹眼', mp:14, cd:420, desc:'進入專注狀態,一段時間內箭矢傷害與爆擊大幅提升' },
  plague:    { cls:'warlock', name:'疫咒', mp:14, cd:180, desc:'散布疫病使範圍敵人持續受傷並陷入虛弱' },
  soulleech: { cls:'warlock', name:'汲魂', mp:16, cd:240, desc:'抽取前方直線敵人的生命,回復自身HP與MP' }
};
// 存檔用的技能區塊固定為「基礎職技能」，新增進階職技能不會改變既有存檔長度（相容性關鍵）
const LEGACY_SKILL_CLASSES = ['warrior', 'mage'];
const SKILL_IDS = Object.keys(SKILL_DEFS); // 存檔順序,固定不可重排
const LEGACY_SKILL_IDS = SKILL_IDS.filter(id => LEGACY_SKILL_CLASSES.indexOf(SKILL_DEFS[id].cls) >= 0); // 46 格存檔區塊只含基礎職
const BRANCH_NAMES = {
  slash:['重擊','連擊'], spin:['龍捲','利刃'], dash:['疾影','破陣'], quake:['餘震','崩裂'], rage:['血怒','戰意'],
  fire:['爆裂','連鎖'], bolt:['雷暴','聚雷'], ice:['霜寒','冰刺'], meteor:['天火','隕擊'], shield:['壁壘','荊棘'],
  bloodrend:['嗜血','裂創'], warcry:['威壓','戰意'],
  rend:['撕裂','狂亂'], holystrike:['守護','制裁'],
  elembolt:['共鳴','連動'], shadowbolt:['腐蝕','汲取'],
  bulwark:['庇護','反擊'], smite:['審判','聖療'],
  elemburst:['三重','熾炎'], chainstorm:['連鎖','聚能'],
  plague:['蔓延','衰敗'], soulleech:['吸血','奪魂'],
  shoot:['精準','速射'],
  multishot:['散射','集火'], pierce:['洞穿','裂空'], arrowrain:['廣域','密集'], powershot:['擊退','穿甲'],
  swiftshot:['疾風','連珠'], snaretrap:['束縛','毒牙'], evade:['疾影','反擊'],
  snipe:['弱點','穿刺'], chargeshot:['貫日','裂魂'], deadeye:['專注','迅捷']
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
  shield:[{ lv3:'護盾量45%且延長5秒', lv5:'破盾時回復12 MP' }, { lv3:'吸收時反彈20%攻擊', lv5:'破盾引發奧術爆破' }],
  bloodrend:[{ lv3:'消耗HP降低', lv5:'擊殺回復消耗的HP' }, { lv3:'低血時傷害再提升', lv5:'造成流血持續傷害' }],
  warcry:[{ lv3:'緩速範圍擴大', lv5:'附加短暫定身' }, { lv3:'狂暴時間延長', lv5:'狂暴期間吸血' }],
  rend:[{ lv3:'命中造成流血', lv5:'流血傷害翻倍' }, { lv3:'目標上限+2', lv5:'低血時大幅縮短冷卻' }],
  holystrike:[{ lv3:'治療量提升一倍', lv5:'治療時附加短暫護盾' }, { lv3:'對已受傷目標加傷', lv5:'第三擊必定爆擊' }],
  elembolt:[{ lv3:'元素效果強化', lv5:'每輪最後一發改為三元素齊發' }, { lv3:'雷擊連鎖多跳一次', lv5:'火冰雷效果同時附加' }],
  shadowbolt:[{ lv3:'腐蝕層數上限提高', lv5:'目標死亡時腐蝕傳染' }, { lv3:'命中回復MP', lv5:'腐蝕中的目標受傷時為你回血' }],
  bulwark:[{ lv3:'護盾量提升並回復HP', lv5:'護盾期間免疫緩速與凍結' }, { lv3:'吸收時反彈25%傷害', lv5:'破盾時範圍爆發並震懾' }],
  smite:[{ lv3:'命中使目標受傷+20%', lv5:'必定爆擊並擴大範圍' }, { lv3:'治療量提升一倍', lv5:'命中額外回復MP' }],
  elemburst:[{ lv3:'爆發範圍擴大', lv5:'追加第二段爆發' }, { lv3:'火焰傷害提升並燃燒', lv5:'燃燒會蔓延給鄰近敵人' }],
  chainstorm:[{ lv3:'連鎖次數+2', lv5:'連鎖不再衰減' }, { lv3:'改為集中單體高傷', lv5:'命中麻痺目標' }],
  plague:[{ lv3:'疫病範圍擴大', lv5:'目標死亡時傳染鄰近敵人' }, { lv3:'虛弱效果加重', lv5:'虛弱目標受到的持續傷害翻倍' }],
  soulleech:[{ lv3:'吸取的HP提升', lv5:'低血時吸取量再翻倍' }, { lv3:'額外回復MP', lv5:'擊殺立即重置冷卻' }],
  shoot:[{ lv3:'命中使目標受傷+15%', lv5:'必定爆擊並穿透一名敵人' }, { lv3:'冷卻縮短、箭速加快', lv5:'一次射出兩箭' }],
  multishot:[{ lv3:'箭數+2、扇形更廣', lv5:'命中疊加易傷' }, { lv3:'集中三箭、傷害+25%', lv5:'全數命中追加一發' }],
  pierce:[{ lv3:'每穿透一體傷害提升', lv5:'穿透不再衰減' }, { lv3:'對低血目標加傷', lv5:'貫穿末端爆裂' }],
  arrowrain:[{ lv3:'範圍擴大', lv5:'落點留下減速箭陣' }, { lv3:'箭數增加', lv5:'密集覆蓋、命中緩速' }],
  powershot:[{ lv3:'擊退更遠並短暫暈眩', lv5:'撞牆追加傷害' }, { lv3:'改為貫穿全直線', lv5:'穿甲、無視部分防禦' }],
  swiftshot:[{ lv3:'命中提升移速更久', lv5:'移動中射擊不減速' }, { lv3:'冷卻再縮短', lv5:'每三箭追加一發' }],
  snaretrap:[{ lv3:'踏入者被定身', lv5:'定身時受傷提升' }, { lv3:'持續傷害提高', lv5:'陷阱範圍擴大並延長' }],
  evade:[{ lv3:'距離與無敵時間提升', lv5:'留下迷惑殘影' }, { lv3:'閃避後下一箭傷害翻倍', lv5:'閃避立即重置射擊冷卻' }],
  snipe:[{ lv3:'爆擊傷害提升', lv5:'對滿血目標必定爆擊' }, { lv3:'貫穿一名敵人', lv5:'貫穿全直線' }],
  chargeshot:[{ lv3:'貫穿更多敵人', lv5:'貫穿不衰減' }, { lv3:'爆擊率大幅提升', lv5:'爆擊時追加爆裂' }],
  deadeye:[{ lv3:'專注期間爆擊率再提升', lv5:'專注期間必定爆擊' }, { lv3:'專注期間冷卻縮短', lv5:'專注期間射擊不消耗MP' }]
};
const skillState = {}; // id -> {unl, pts, spent, branch(-1未選/0=A/1=B)}
for (const id of SKILL_IDS) skillState[id] = { unl: SKILL_DEFS[id].basic ? 1 : 0, pts: 0, spent: 0, branch: -1 };
const loadouts = { warrior: ['slash', null, null], mage: ['fire', null, null], archer: ['shoot', null, null], ranger: ['swiftshot', null, null], marksman: ['snipe', null, null], berserker: ['rend', null, null], paladin: ['holystrike', null, null], elementalist: ['elembolt', null, null], warlock: ['shadowbolt', null, null] };
let menuTab = 'base', selSkill = null, pendingReset = null, selStash = null, pendingStashDel = null;
function classSkills(cls) { // 進階職＝基礎職技能 + 自身專屬技能；若自己有基本技能，就取代繼承來的那個
  const base = baseOf(cls);
  if (cls === base) return SKILL_IDS.filter(id => SKILL_DEFS[id].cls === cls);
  const own = SKILL_IDS.filter(id => SKILL_DEFS[id].cls === cls);
  const ownBasic = own.filter(id => SKILL_DEFS[id].basic);
  if (!ownBasic.length) return SKILL_IDS.filter(id => SKILL_DEFS[id].cls === base || SKILL_DEFS[id].cls === cls);
  // 基本技能固定排在最前面（技能樹的根節點），其餘沿用基礎職順序
  const inherited = SKILL_IDS.filter(id => SKILL_DEFS[id].cls === base && !SKILL_DEFS[id].basic);
  return ownBasic.concat(inherited, own.filter(id => !SKILL_DEFS[id].basic));
}
function isJobUnlocked(job) { // 基礎職永遠可選；進階職需基礎職精通達門檻
  const def = (typeof CLASSES !== 'undefined') ? CLASSES[job] : null;
  if (!def) return false;
  if (!def.advanced) return true;
  return masteryLevel(def.base) >= MASTERY_ADVANCE_LEVEL;
}
function selectableJobs() { return (typeof CLASSES !== 'undefined' ? Object.keys(CLASSES) : []).filter(isJobUnlocked); }
// 選角頁顯示順序：基礎職大卡在上，當前系別的進階職晶片在下（含未解鎖的灰晶片）。
function jobPickList(cls) {
  const bases = (typeof baseClassIds === 'function') ? baseClassIds() : ['warrior', 'mage'];
  const adv = (typeof advancedJobsFor === 'function') ? advancedJobsFor(baseOf(cls || chosenCls)) : [];
  return { bases, adv };
}
// 數字鍵可選的順序：基礎職 + 當前系別「已解鎖」的進階職。
function jobHotkeyList(cls) {
  const l = jobPickList(cls);
  return l.bases.concat(l.adv.filter(isJobUnlocked));
}
function jobUnlockHint(job) { // 未解鎖進階職的條件說明
  const def = (typeof CLASSES !== 'undefined') ? CLASSES[job] : null;
  if (!def || !def.base) return '';
  return (CLASSES[def.base] ? CLASSES[def.base].name : def.base) + '精通 Lv' + MASTERY_ADVANCE_LEVEL;
}
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
  for (const id of LEGACY_SKILL_IDS) { const t = skillState[id]; a.push(t.unl ? 1 : 0, t.pts, t.spent, t.branch + 1); }
  for (const cls of LEGACY_SKILL_CLASSES) {
    const list = classSkills(cls);
    for (let i = 0; i < 3; i++) a.push(loadouts[cls][i] ? list.indexOf(loadouts[cls][i]) + 1 : 0);
  }
  return a; // 10技能×4 + 2職業×3槽 = 46
}
function advancedSkillState() { // 進階職技能與出戰欄另存，避免改動既有 46 格存檔區塊
  const out = { s:{}, l:{} };
  for (const id of SKILL_IDS) if (LEGACY_SKILL_IDS.indexOf(id) < 0) { const t = skillState[id]; out.s[id] = [t.unl ? 1 : 0, t.pts, t.spent, t.branch]; }
  for (const job of Object.keys(loadouts)) if (LEGACY_SKILL_CLASSES.indexOf(job) < 0) out.l[job] = loadouts[job].slice();
  return out;
}
function applyAdvancedSkillState(d) {
  if (!d || typeof d !== 'object') return;
  if (d.s) for (const id of Object.keys(d.s)) {
    const t = skillState[id], v = d.s[id];
    if (!t || !SKILL_DEFS[id] || !Array.isArray(v)) continue;
    t.unl = SKILL_DEFS[id].basic ? 1 : (v[0] ? 1 : 0);
    t.pts = Math.max(0, Math.min(5, v[1] | 0));
    t.spent = Math.max(0, Math.min(t.pts, v[2] | 0));
    t.branch = Math.max(-1, Math.min(1, v[3] | 0));
    if (t.spent >= 2 && t.branch < 0) t.spent = 1;
  }
  // 注意：這裡不能用 classSkills() 過濾。loadMeta() 在 systems.js 之前執行，
  // 此時 CLASSES/baseClassOf 尚未定義，classSkills 會漏掉基礎職技能而把出戰欄清空。
  // 只做不依賴職業表的檢查，職業歸屬留給 revalidateLoadouts()（全部載入後才跑）。
  if (d.l) for (const job of Object.keys(d.l)) {
    if (!loadouts[job] || !Array.isArray(d.l[job])) continue;
    const next = d.l[job].slice(0, 3).map(id => (id && skillState[id] && skillState[id].unl) ? id : null);
    while (next.length < 3) next.push(null);
    loadouts[job] = next;
  }
}
// 所有檔案載入後才呼叫（main.js）：此時職業表已就緒，才能正確判定技能歸屬與補上預設技能。
function revalidateLoadouts() {
  for (const job of Object.keys(loadouts)) {
    const list = classSkills(job);
    const next = loadouts[job].slice(0, 3).map(id => (id && list.indexOf(id) >= 0 && skillState[id] && skillState[id].unl) ? id : null);
    while (next.length < 3) next.push(null);
    if (!next.some(Boolean)) next[0] = list.find(id => SKILL_DEFS[id].basic && skillState[id] && skillState[id].unl) || null;
    loadouts[job] = next;
  }
}
function applySkillNums(a) {
  if (!Array.isArray(a) || a.length !== LEGACY_SKILL_IDS.length * 4 + LEGACY_SKILL_CLASSES.length * 3) return;
  LEGACY_SKILL_IDS.forEach((id, i) => {
    const s = skillState[id];
    s.unl = SKILL_DEFS[id].basic ? 1 : (a[i * 4] ? 1 : 0);
    s.pts = Math.max(0, Math.min(5, a[i * 4 + 1] | 0));
    s.spent = Math.max(0, Math.min(s.pts, a[i * 4 + 2] | 0));
    s.branch = Math.max(-1, Math.min(1, (a[i * 4 + 3] | 0) - 1));
    if (s.spent >= 2 && s.branch < 0) s.spent = 1; // 沒選分支不可能超過第1點
  });
  let o = LEGACY_SKILL_IDS.length * 4;
  for (const cls of LEGACY_SKILL_CLASSES) {
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
      st: meta.stash, mt: meta.mats, lo: meta.loadout, sq: meta.stashSeq, pn: meta.playerName,
      cs: meta.cosmetics, ms: meta.mastery, ax: advancedSkillState()
    }));
  } catch (e) {}
}
function loadMeta() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && typeof d.s === 'number' && Array.isArray(d.u)) applyMeta(d.s, d.u, d.b);
    if (d && Array.isArray(d.k)) applySkillNums(d.k);
    if (d && Array.isArray(d.st)) meta.stash = d.st.filter(it => it && GEAR_PARTS.indexOf(it.kind) >= 0).map(normalizeGear);
    if (d && d.mt) meta.mats = { enh: Math.max(0, d.mt.enh | 0), ench: Math.max(0, d.mt.ench | 0), set: Math.max(0, d.mt.set | 0) };
    if (d && d.lo) for (const part of GEAR_PARTS) meta.loadout[part] = d.lo[part] || null;
    if (d && d.sq) meta.stashSeq = Math.max(1, d.sq | 0);
    if (d && typeof d.pn === 'string' && d.pn.trim()) meta.playerName = d.pn.slice(0, 12);
    // 外觀狀態先原樣還原（此時 defs 尚未定義，合法性交給 migrateLegacyCosmetics 清理）
    if (d && d.cs && typeof d.cs === 'object') {
      if (d.cs.owned && typeof d.cs.owned === 'object') for (const t of Object.keys(d.cs.owned)) if (Array.isArray(d.cs.owned[t])) meta.cosmetics.owned[t] = d.cs.owned[t].slice();
      if (d.cs.equipped && typeof d.cs.equipped === 'object') for (const t of Object.keys(d.cs.equipped)) meta.cosmetics.equipped[t] = d.cs.equipped[t];
    }
    // 職業精通（結構清理交給 ensureMasteryState，舊存檔缺欄位＝從 0 開始）
    if (d && d.ms && typeof d.ms === 'object') meta.mastery = d.ms;
    if (d && d.ax) applyAdvancedSkillState(d.ax); // 進階職技能狀態
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
  { points:220, label:'虛空光環＋套裝核心 x1', enh:4, ench:3, set:1, aura:'void' }
];
const AURA_DEFS = {
  none:{ name:'無光環', color:'#8890b8' },
  ember:{ name:'餘燼光環', color:'#ff8c2e' },
  void:{ name:'虛空光環', color:'#b05ae0' }
};
// ---------- 統一外觀系統（K1-A）----------
// 四類共用同一套擁有/選用/解鎖流程；任何系統（精通/成就/活躍/賽季）都以 unlockCosmetic 發獎。
// 外觀一律零局內戰力。title/color/skin 目錄留待 K1-B/C/D 填入。
// 精通外觀獎勵（J1-E）：每個職業在 Lv5/10 給角色配色，Lv15/20 給稱號。全部零局內戰力。
// 配色以精靈圖字元重上色：'r' 是劍士系甲冑、'4' 是法師系長袍、'8' 是共用的金屬鑲邊。
const MASTERY_COSMETIC_TABLE = {
  warrior: {
    colors: [
      { lv:5,  id:'war_frost',  name:'霜鋼藍', col:'#4a7fc8', trim:'#cfe4ff' },
      { lv:10, id:'war_dawn',   name:'黎明金', col:'#d9a13c', trim:'#fff0c0' }
    ],
    titles: [
      { lv:15, id:'war_iron',   name:'鋼鐵之心', col:'#e2884a' },
      { lv:20, id:'war_master', name:'劍術宗師', col:'#ffb45e' }
    ]
  },
  mage: {
    colors: [
      { lv:5,  id:'mag_abyss',  name:'深海青', col:'#2f8fa8', trim:'#b6f0ff' },
      { lv:10, id:'mag_moon',   name:'銀月白', col:'#b9c2de', trim:'#ffffff' }
    ],
    titles: [
      { lv:15, id:'mag_scholar', name:'秘法學者', col:'#9a8cf0' },
      { lv:20, id:'mag_arch',    name:'元素支配者', col:'#c0a8ff' }
    ]
  },
  archer: {
    colors: [
      { lv:5,  id:'arc_forest', name:'森綠',   col:'#5a8c3a', trim:'#c8e0a0' },
      { lv:10, id:'arc_hunter', name:'獵人褐', col:'#a05a2c', trim:'#e0b080' }
    ],
    titles: [
      { lv:15, id:'arc_eagle',   name:'鷹眼',     col:'#9ab55c' },
      { lv:20, id:'arc_hundred', name:'百步穿楊', col:'#c8e070' }
    ]
  },
  berserker: {
    colors: [
      { lv:5,  id:'ber_gore',   name:'血戰赤', col:'#a01f28', trim:'#ff8a7a' },
      { lv:10, id:'ber_forge',  name:'烈煉橙', col:'#ff6b3d', trim:'#ffd0a0' }
    ],
    titles: [
      { lv:15, id:'ber_blood',  name:'嗜血者', col:'#e04a3a' },
      { lv:20, id:'ber_tide',   name:'戰場狂潮', col:'#ff8248' }
    ]
  },
  paladin: {
    colors: [
      { lv:5,  id:'pal_dawn',   name:'聖輝白', col:'#e0dcc6', trim:'#ffffff' },
      { lv:10, id:'pal_gold',   name:'聖殿金', col:'#ffd76a', trim:'#fff6d0' }
    ],
    titles: [
      { lv:15, id:'pal_wall',   name:'不動壁壘', col:'#ffe08a' },
      { lv:20, id:'pal_verdict', name:'聖光裁決', col:'#fff2b8' }
    ]
  },
  elementalist: {
    colors: [
      { lv:5,  id:'ele_tide',   name:'元素青', col:'#4ad0c8', trim:'#d0fffb' },
      { lv:10, id:'ele_aurora', name:'極光', col:'#7ee0ff', trim:'#e8f8ff' }
    ],
    titles: [
      { lv:15, id:'ele_four',   name:'四象行者', col:'#5fe0d4' },
      { lv:20, id:'ele_storm',  name:'風暴之主', col:'#9ceaff' }
    ]
  },
  ranger: {
    colors: [
      { lv:5,  id:'rng_moss',   name:'苔綠',   col:'#6fbf6a', trim:'#d0f0c0' },
      { lv:10, id:'rng_dusk',   name:'暮林',   col:'#3f7a52', trim:'#a8d8b0' }
    ],
    titles: [
      { lv:15, id:'rng_track',  name:'循跡者',   col:'#8fd88a' },
      { lv:20, id:'rng_wild',   name:'荒野之主', col:'#b0f0a0' }
    ]
  },
  marksman: {
    colors: [
      { lv:5,  id:'mks_brass',  name:'黃銅',   col:'#c8a04a', trim:'#f0dca0' },
      { lv:10, id:'mks_sun',    name:'烈陽金', col:'#ffd24a', trim:'#fff4c0' }
    ],
    titles: [
      { lv:15, id:'mks_eye',    name:'鷹瞳',     col:'#e8c860' },
      { lv:20, id:'mks_onehit', name:'一箭穿心', col:'#ffe888' }
    ]
  },
  warlock: {
    colors: [
      { lv:5,  id:'wl_plague',  name:'疫紫', col:'#a35ad0', trim:'#e0b8ff' },
      { lv:10, id:'wl_eclipse', name:'暗蝕', col:'#5a4270', trim:'#b088d0' }
    ],
    titles: [
      { lv:15, id:'wl_carrier', name:'疫病使者', col:'#b878e0' },
      { lv:20, id:'wl_reaper',  name:'靈魂收割者', col:'#d0a0f0' }
    ]
  }
};
const TITLE_DEFS = {};
const COLOR_DEFS = {};
for (const job of Object.keys(MASTERY_COSMETIC_TABLE)) {
  const e = MASTERY_COSMETIC_TABLE[job];
  for (const c of e.colors) COLOR_DEFS[c.id] = { name:c.name, color:c.col, job, lv:c.lv, map:{ r:c.col, '4':c.col, g:c.col, '8':c.trim } };
  for (const t of e.titles) TITLE_DEFS[t.id] = { name:t.name, color:t.col, job, lv:t.lv };
}
const SKIN_DEFS = {};
const COSMETIC_TYPES = ['title', 'color', 'aura', 'skin'];
const COSMETIC_DEFS = { title: TITLE_DEFS, color: COLOR_DEFS, aura: AURA_DEFS, skin: SKIN_DEFS };
const COSMETIC_DEFAULT_EQUIPPED = { title: null, color: null, aura: 'none', skin: null };
function ensureCosmeticState() { // 舊存檔或缺欄位時補齊結構
  if (!meta.cosmetics || typeof meta.cosmetics !== 'object') meta.cosmetics = { owned: {}, equipped: {} };
  if (!meta.cosmetics.owned || typeof meta.cosmetics.owned !== 'object') meta.cosmetics.owned = {};
  if (!meta.cosmetics.equipped || typeof meta.cosmetics.equipped !== 'object') meta.cosmetics.equipped = {};
  for (const t of COSMETIC_TYPES) {
    if (!Array.isArray(meta.cosmetics.owned[t])) meta.cosmetics.owned[t] = [];
    if (!(t in meta.cosmetics.equipped)) meta.cosmetics.equipped[t] = COSMETIC_DEFAULT_EQUIPPED[t];
  }
  if (!meta.cosmetics.owned.aura.includes('none')) meta.cosmetics.owned.aura.unshift('none');
  return meta.cosmetics;
}
function cosmeticDefs(type) { return COSMETIC_DEFS[type] || {}; }
function cosmeticDef(type, id) { return id ? (cosmeticDefs(type)[id] || null) : null; }
function ownedCosmetics(type) { ensureCosmeticState(); return meta.cosmetics.owned[type] || []; }
function ownsCosmetic(type, id) { return !!cosmeticDef(type, id) && ownedCosmetics(type).indexOf(id) >= 0; }
function unlockCosmetic(type, id) { // 發獎共用入口；回傳是否為「新解鎖」
  if (!cosmeticDef(type, id)) return false;
  const owned = ownedCosmetics(type);
  if (owned.indexOf(id) >= 0) return false;
  owned.push(id); saveMeta();
  return true;
}
function equipCosmetic(type, id) {
  if (!ownsCosmetic(type, id)) return false;
  ensureCosmeticState().equipped[type] = id; saveMeta();
  return true;
}
function equippedCosmetic(type) { // 取目前選用；無效則回預設
  const id = ensureCosmeticState().equipped[type];
  return cosmeticDef(type, id) ? id : COSMETIC_DEFAULT_EQUIPPED[type];
}
// ---------- 職業精通（J1-A）----------
// 每個職業（含未來進階職）獨立累積精通經驗；精通只用於外觀/材料獎勵與解鎖轉職，**零局內戰力**。
const MASTERY_MAX_LEVEL = 30;
const MASTERY_ADVANCE_LEVEL = 10;   // 基礎職達此等級解鎖進階轉職（供 J1-C 使用）
const MASTERY_FIRST_BOSS_XP = 120;  // 首次以該職業擊敗某 Boss 的一次性加成
const MASTERY_REPEAT_MUL = 0.6;     // 未突破該職業最深紀錄時的收益衰減（防重複刷淺層）
const MASTERY_EXTRACT_MUL = 1.25;   // 成功撤退加成
function masteryXpForNext(lv) { // 由 lv 升到 lv+1 所需經驗（三章：1–10 快 / 11–20 中 / 21–30 慢）
  if (lv < 10) return 100 + 50 * (lv - 1);
  if (lv < 20) return 600 + 100 * (lv - 10);
  return 1800 + 200 * (lv - 20);
}
function ensureMasteryState(job) { // 補齊結構（舊存檔相容）
  if (!meta.mastery || typeof meta.mastery !== 'object') meta.mastery = {};
  if (!job) return meta.mastery;
  const e = meta.mastery[job];
  if (!e || typeof e !== 'object') meta.mastery[job] = { xp: 0, bosses: [], best: 0 };
  else {
    if (!Number.isFinite(e.xp) || e.xp < 0) e.xp = 0;
    if (!Array.isArray(e.bosses)) e.bosses = [];
    if (!Number.isFinite(e.best) || e.best < 0) e.best = 0;
  }
  return meta.mastery[job];
}
function masteryLevel(xpOrJob) { // 傳數字＝直接換算；傳職業 id＝查該職等級
  const xp = typeof xpOrJob === 'number' ? xpOrJob : ensureMasteryState(xpOrJob).xp;
  let lv = 1, left = Math.max(0, xp);
  while (lv < MASTERY_MAX_LEVEL && left >= masteryXpForNext(lv)) { left -= masteryXpForNext(lv); lv++; }
  return lv;
}
function masteryProgress(job) { // 供 UI：等級與當級進度
  const e = ensureMasteryState(job);
  let lv = 1, left = Math.max(0, e.xp);
  while (lv < MASTERY_MAX_LEVEL && left >= masteryXpForNext(lv)) { left -= masteryXpForNext(lv); lv++; }
  const max = lv >= MASTERY_MAX_LEVEL, need = max ? 0 : masteryXpForNext(lv);
  return { job, xp: e.xp, lv, into: left, need, ratio: need ? Math.min(1, left / need) : 1, max, best: e.best, bosses: e.bosses.slice() };
}
function addMasteryXp(job, amount) { // 回傳本次升了幾級
  if (!job || !(amount > 0)) return 0;
  const e = ensureMasteryState(job);
  const before = masteryLevel(e.xp);
  e.xp += Math.round(amount);
  saveMeta();
  return masteryLevel(e.xp) - before;
}
function calcMasteryGain(job, opts) { // 樓層/擊殺/撤退 + 首次 Boss 加成 + 重複刷衰減
  const o = opts || {}, e = ensureMasteryState(job);
  const fl = Math.max(0, o.floor | 0), kl = Math.max(0, o.kills | 0);
  let gain = fl * 8 + kl * 1.5;
  if (o.result === 'extract') gain *= MASTERY_EXTRACT_MUL;
  if (fl <= e.best) gain *= MASTERY_REPEAT_MUL; // 沒突破最深紀錄＝重複刷，收益降低
  const newBosses = (o.bossIds || []).filter(id => id && e.bosses.indexOf(id) < 0);
  gain += newBosses.length * MASTERY_FIRST_BOSS_XP;
  const tierMul = (typeof dungeonMasteryXpMul === 'function') ? dungeonMasteryXpMul() : 1; // R1 秘境層級加成掛勾
  return { xp: Math.max(1, Math.round(gain * tierMul)), newBosses };
}
// ---------- 精通外觀獎勵（J1-E）----------
function masteryRewardsFor(job) { // 該職業的獎勵軌，依等級排序
  const e = MASTERY_COSMETIC_TABLE[job];
  if (!e) return [];
  return e.colors.map(c => ({ lv:c.lv, type:'color', id:c.id, name:c.name, color:c.col }))
    .concat(e.titles.map(t => ({ lv:t.lv, type:'title', id:t.id, name:t.name, color:t.col })))
    .sort((a, b) => a.lv - b.lv);
}
function syncMasteryCosmetics(job) { // 依目前精通等級補發獎勵；回傳這次新解鎖的清單
  const jobs = job ? [job] : Object.keys(MASTERY_COSMETIC_TABLE);
  const fresh = [];
  for (const j of jobs) {
    const lv = masteryLevel(j);
    for (const r of masteryRewardsFor(j)) {
      if (lv >= r.lv && unlockCosmetic(r.type, r.id)) fresh.push(r);
    }
  }
  return fresh;
}
function equippedRecolor() { // 角色配色 → drawSprite 的 recolor 對照表
  const id = (typeof equippedCosmetic === 'function') ? equippedCosmetic('color') : null;
  const def = id ? COLOR_DEFS[id] : null;
  return def ? def.map : null;
}
function equippedTitleText() {
  const def = TITLE_DEFS[equippedCosmetic('title')];
  return def ? def.name : '';
}
function equippedTitleColor() {
  const def = TITLE_DEFS[equippedCosmetic('title')];
  return def ? def.color : '#9da1bc';
}
function recordMasteryRun(job, opts) { // 一局結束結算（endRun 呼叫；基準局不計）
  if (!job) return null;
  const e = ensureMasteryState(job);
  const res = calcMasteryGain(job, opts);
  for (const id of res.newBosses) e.bosses.push(id);
  const fl = Math.max(0, (opts && opts.floor) | 0);
  if (fl > e.best) e.best = fl;
  const levelsGained = addMasteryXp(job, res.xp); // 內含 saveMeta
  const cosmetics = levelsGained > 0 ? syncMasteryCosmetics(job) : []; // 升級才可能有新外觀
  return { xp: res.xp, levelsGained, newBosses: res.newBosses, lv: masteryLevel(job), cosmetics };
}
// 遷移：舊光環狀態存在 activityState.cosmetics/aura，併入統一狀態（須在 loadMeta/loadActivity 之後呼叫）
function migrateLegacyCosmetics() {
  ensureCosmeticState();
  const owned = meta.cosmetics.owned.aura;
  const legacyOwned = (typeof activityState !== 'undefined' && Array.isArray(activityState.cosmetics)) ? activityState.cosmetics : [];
  let changed = false;
  for (const id of legacyOwned) if (AURA_DEFS[id] && owned.indexOf(id) < 0) { owned.push(id); changed = true; }
  // 清掉目錄中已不存在的舊 id
  for (const t of COSMETIC_TYPES) {
    const list = meta.cosmetics.owned[t], defs = cosmeticDefs(t);
    const kept = list.filter(id => defs[id]);
    if (kept.length !== list.length) { meta.cosmetics.owned[t] = kept; changed = true; }
  }
  if (!meta.cosmetics.owned.aura.includes('none')) meta.cosmetics.owned.aura.unshift('none');
  const legacyEquipped = (typeof activityState !== 'undefined') ? activityState.aura : null;
  if (meta.cosmetics.equipped.aura === 'none' && legacyEquipped && meta.cosmetics.owned.aura.indexOf(legacyEquipped) >= 0) {
    meta.cosmetics.equipped.aura = legacyEquipped; changed = true;
  }
  for (const t of COSMETIC_TYPES) { // 選用的若已不合法則回預設
    const id = meta.cosmetics.equipped[t];
    if (id && !ownsCosmetic(t, id)) { meta.cosmetics.equipped[t] = COSMETIC_DEFAULT_EQUIPPED[t]; changed = true; }
  }
  if (changed) saveMeta();
}
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
  meta.mats.enh += reward.enh || 0; meta.mats.ench += reward.ench || 0; meta.mats.set += reward.set || 0;
  if (reward.aura && unlockCosmetic('aura', reward.aura)) equipCosmetic('aura', reward.aura); // 統一外觀發獎入口
  saveMeta(); saveActivity();
  menuMsg = { text:'活躍 ' + points + ' 獎勵：' + reward.label, color:'#ffe680', t:300 };
  playSfx('enhanceSuccess');
}
function equipAura(id) { // 相容舊呼叫：轉接統一外觀系統
  if (equipCosmetic('aura', id)) playSfx('uiSelect', 0.7);
}
function hasActivityReward() {
  refreshActivityPeriods();
  const taskReady = (defs, progress, claims) => defs.some(t => !claims[t.id] && (progress[t.stat] || 0) >= t.target);
  return taskReady(currentActivityTasks('daily'), activityState.daily, activityState.claimedDaily)
    || taskReady(currentActivityTasks('weekly'), activityState.weekly, activityState.claimedWeekly)
    || ACTIVITY_MILESTONES.some(m => !activityState.milestones[m.points] && activityState.activity >= m.points);
}
loadActivity();
migrateLegacyCosmetics(); // 舊光環狀態併入統一外觀系統（須在 loadMeta/loadActivity 之後）
