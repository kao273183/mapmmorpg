"use strict";
// ---------- meta progression ----------
const meta = {
  souls: 0, up: { atk: 0, vit: 0, crit: 0, guard: 0, haste: 0, pots: 0, treasure: 0, soul: 0, recovery: 0, alchemy: 0 },
  stash: [], mats: { enh: 0, ench: 0, set: 0 }, stashSeq: 1,
  loadout: { weapon: null, armor: null, helmet: null, boots: null, acc: null },
  playerName: '勇者'
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
  return UNIQUE_LIST.filter(u => u.kind === slot && (u.cls === 'any' || u.cls === cls) && r >= (u.minR || 3)).map(u => u.id);
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
function gearUsableByClass(it, cls) { return !it || !it.cls || it.cls === cls; }
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
    if (d && d.mt) meta.mats = { enh: Math.max(0, d.mt.enh | 0), ench: Math.max(0, d.mt.ench | 0), set: Math.max(0, d.mt.set | 0) };
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
  { points:220, label:'虛空光環＋套裝核心 x1', enh:4, ench:3, set:1, aura:'void' }
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
  meta.mats.enh += reward.enh || 0; meta.mats.ench += reward.ench || 0; meta.mats.set += reward.set || 0;
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
