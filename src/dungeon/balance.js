// ---------- dungeon D3 local balance telemetry ----------
const DUNGEON_BALANCE_KEY = 'pixelrogue_dungeon_balance_v1';
const DUNGEON_BALANCE_MAX_RUNS = 60;
const DUNGEON_BALANCE_ROOM_TYPES = ['safe','elite','treasure','event','camp','hazard','boss'];

function fixedDungeonBenchmarkGear(classId, tier) {
  const defs = {
    starter:{ rarity:0, label:'新手全套', weapon:10, armorHp:28, armorDef:2, helmetHp:18, helmetDef:1, speed:0.2, crit:0.03 },
    chapter2:{ rarity:2, label:'第二章稀有全套', weapon:24, armorHp:68, armorDef:5, helmetHp:42, helmetDef:3, speed:0.5, crit:0.07 },
    chapter3:{ rarity:3, label:'第三章史詩全套', weapon:38, armorHp:110, armorDef:8, helmetHp:70, helmetDef:5, speed:0.8, atkMul:0.12, jump:1 }
  };
  const d = defs[tier] || defs.starter;
  // 進階職沿用基礎職的裝備線：裝備一律標記基礎職，否則穿不上（與 createGear 同一規則）。
  const base = (typeof baseClassOf === 'function') ? baseClassOf(classId) : classId;
  const weaponName = base === 'mage' ? '固定法杖' : '固定長劍';
  return [
    { id:'benchmark-' + classId + '-' + tier + '-weapon', kind:'weapon', r:d.rarity, cls:base, name:weaponName, atk:d.weapon, wpn:base === 'mage' ? 'stave' : 'sword', affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-armor', kind:'armor', r:d.rarity, cls:base, name:'固定護甲', hp:d.armorHp, def:d.armorDef, affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-helmet', kind:'helmet', r:d.rarity, cls:base, name:'固定頭盔', hp:d.helmetHp, def:d.helmetDef, affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-boots', kind:'boots', r:d.rarity, cls:base, name:'固定戰靴', spd:d.speed, jmp:d.jump || 0, affixes:[], benchmark:true },
    Object.assign({ id:'benchmark-' + classId + '-' + tier + '-acc', kind:'acc', r:d.rarity, cls:base, name:'固定護符', affixes:[], benchmark:true }, d.atkMul ? { atkMul:d.atkMul } : { crit:d.crit })
  ];
}

const DUNGEON_BENCHMARK_PROFILES = [
  { id:'warrior-starter', classId:'warrior', tier:'starter', label:'劍士 · 新手', gearLabel:'新手全套', seed:31001 },
  { id:'mage-starter', classId:'mage', tier:'starter', label:'法師 · 新手', gearLabel:'新手全套', seed:31001 },
  { id:'warrior-chapter2', classId:'warrior', tier:'chapter2', label:'劍士 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'mage-chapter2', classId:'mage', tier:'chapter2', label:'法師 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'warrior-chapter3', classId:'warrior', tier:'chapter3', label:'劍士 · 第三章', gearLabel:'史詩全套', seed:123011 },
  { id:'mage-chapter3', classId:'mage', tier:'chapter3', label:'法師 · 第三章', gearLabel:'史詩全套', seed:123011 },
  // 進階職以第二章入場（對應精通 Lv10 解鎖的時間點），與同系基礎職同種子可直接對照
  { id:'berserker-chapter2', classId:'berserker', tier:'chapter2', label:'狂戰士 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'paladin-chapter2', classId:'paladin', tier:'chapter2', label:'聖騎士 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'elementalist-chapter2', classId:'elementalist', tier:'chapter2', label:'元素師 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'warlock-chapter2', classId:'warlock', tier:'chapter2', label:'咒術師 · 第二章', gearLabel:'稀有全套', seed:72007 }
// 裝備改用惰性 getter：本檔比 systems.js 早載入，建表當下還沒有 baseClassOf，
// 但 profile.gear 對所有呼叫端維持原本的用法。
].map(profile => Object.defineProperty(profile, 'gear', {
  enumerable: true, configurable: true,
  get() {
    if (!this._gear) this._gear = fixedDungeonBenchmarkGear(this.classId, this.tier);
    return this._gear;
  }
}));

const DUNGEON_BOSS_BENCHMARK_TARGETS = [
  { bossId:'meadow_lord', bossName:'草原領主', floor:5, tier:'starter', seed:31001, clearSec:[60,110], damage:[0,50] },
  { bossId:'cavern_lord', bossName:'洞窟領主', floor:10, tier:'chapter2', seed:72007, clearSec:[70,125], damage:[0,65] },
  { bossId:'volcano_lord', bossName:'熔岩魔王', floor:15, tier:'chapter3', seed:123011, clearSec:[80,140], damage:[0,80] },
  { bossId:'tundra_lord', bossName:'冰霜領主', floor:20, tier:'chapter3', seed:123011, clearSec:[90,155], damage:[0,90] },
  { bossId:'void_lord', bossName:'深淵魔王', floor:25, tier:'chapter3', seed:123011, clearSec:[100,170], damage:[0,105] }
];

const DUNGEON_BOSS_BENCHMARK_CASES = DUNGEON_BOSS_BENCHMARK_TARGETS.flatMap(target => ['warrior','mage'].map(classId => ({
  id:classId + '-' + target.bossId,
  classId,
  benchmarkId:classId + '-' + target.tier,
  bossId:target.bossId,
  bossName:target.bossName,
  floor:target.floor,
  tier:target.tier,
  seed:target.seed,
  clearSec:target.clearSec.slice(),
  damage:target.damage.slice()
})));

function dungeonBenchmarkProfile(id) {
  return DUNGEON_BENCHMARK_PROFILES.find(profile => profile.id === id) || null;
}

let dungeonBalance = { version:3, runs:[], active:null };

function trimDungeonBalanceRuns(runs) {
  const list = Array.isArray(runs) ? runs.filter(run => run && typeof run === 'object') : [];
  const natural = list.filter(run => (run.mode || 'natural') === 'natural').slice(-DUNGEON_BALANCE_MAX_RUNS);
  const benchmark = list.filter(run => run.mode === 'benchmark').slice(-DUNGEON_BALANCE_MAX_RUNS);
  return natural.concat(benchmark).sort((a, b) => (Number(a.endedAt) || 0) - (Number(b.endedAt) || 0));
}

function balanceCountMap(source, allowed) {
  const result = {};
  for (const id of allowed) result[id] = Math.max(0, Number(source && source[id]) || 0);
  return result;
}

function loadDungeonBalance() {
  try {
    const saved = JSON.parse(localStorage.getItem(DUNGEON_BALANCE_KEY));
    if (saved && Array.isArray(saved.runs)) {
      dungeonBalance.runs = trimDungeonBalanceRuns(saved.runs);
    }
  } catch (err) {}
  dungeonBalance.active = null;
  return dungeonBalance;
}

function saveDungeonBalance() {
  try {
    localStorage.setItem(DUNGEON_BALANCE_KEY, JSON.stringify({ version:3, runs:trimDungeonBalanceRuns(dungeonBalance.runs) }));
  } catch (err) {}
}

function startDungeonBalanceRun(seed, classId, now, options) {
  const startedAt = Number.isFinite(now) ? now : Date.now();
  const opts = options || {};
  const mode = opts.mode === 'benchmark' ? 'benchmark' : 'natural';
  dungeonBalance.active = {
    version:3,
    startedAt,
    seed:String(seed == null ? '' : seed),
    classId:classId || 'unknown',
    mode,
    benchmarkId:mode === 'benchmark' ? String(opts.benchmarkId || '') : null,
    benchmarkLabel:mode === 'benchmark' ? String(opts.benchmarkLabel || '') : null,
    routeOffers:balanceCountMap(null, DUNGEON_BALANCE_ROOM_TYPES),
    routeChoices:balanceCountMap(null, DUNGEON_BALANCE_ROOM_TYPES),
    routeOfferCount:0,
    riskyOfferCount:0,
    routeChoiceCount:0,
    riskyChoiceCount:0,
    roomEntries:balanceCountMap(null, DUNGEON_BALANCE_ROOM_TYPES),
    roomCompletions:balanceCountMap(null, DUNGEON_BALANCE_ROOM_TYPES),
    roomTimeMs:balanceCountMap(null, DUNGEON_BALANCE_ROOM_TYPES),
    damageBySource:{},
    damageTaken:0,
    rewards:{ gear:0, materials:0, souls:0 },
    trialResults:{ success:0, failed:0, declined:0 },
    bossEncounters:[],
    activeBoss:null,
    highestFloor:1,
    roomStartedAt:startedAt,
    currentRoomType:null
  };
  return dungeonBalance.active;
}

function activeDungeonBalance() { return dungeonBalance.active; }

function recordDungeonRouteOffer(choices) {
  const run = activeDungeonBalance();
  if (!run) return;
  for (const spec of choices || []) {
    if (!spec || run.routeOffers[spec.type] == null) continue;
    run.routeOffers[spec.type]++;
    run.routeOfferCount++;
    if ((Number(spec.threat) || 0) >= 2) run.riskyOfferCount++;
  }
}

function recordDungeonRouteChoice(spec) {
  const run = activeDungeonBalance();
  if (!run || !spec || run.routeChoices[spec.type] == null) return;
  run.routeChoices[spec.type]++;
  run.routeChoiceCount++;
  if ((Number(spec.threat) || 0) >= 2) run.riskyChoiceCount++;
}

function recordDungeonRoomEntry(spec, now) {
  const run = activeDungeonBalance();
  if (!run || !spec || run.roomEntries[spec.type] == null) return;
  run.roomEntries[spec.type]++;
  run.currentRoomType = spec.type;
  run.roomStartedAt = Number.isFinite(now) ? now : Date.now();
  run.highestFloor = Math.max(run.highestFloor, Number(spec.floor) || 1);
}

function recordDungeonRoomComplete(spec, now) {
  const run = activeDungeonBalance();
  if (!run || !spec || run.roomCompletions[spec.type] == null) return;
  run.roomCompletions[spec.type]++;
  const endedAt = Number.isFinite(now) ? now : Date.now();
  run.roomTimeMs[spec.type] += Math.max(0, endedAt - run.roomStartedAt);
}

function recordDungeonDamage(source, amount) {
  const run = activeDungeonBalance();
  const value = Math.max(0, Number(amount) || 0);
  if (!run || value <= 0) return;
  const key = String(source || '未知攻擊').slice(0, 32);
  run.damageTaken += value;
  run.damageBySource[key] = (run.damageBySource[key] || 0) + value;
  if (run.activeBoss) run.activeBoss.damageTaken = (Number(run.activeBoss.damageTaken) || 0) + value;
}

function recordDungeonReward(kind, amount) {
  const run = activeDungeonBalance();
  const value = Math.max(0, Number(amount) || 0);
  if (!run || !run.rewards || !Object.prototype.hasOwnProperty.call(run.rewards, kind) || value <= 0) return;
  run.rewards[kind] += value;
}

function recordDungeonTrialResult(status) {
  const run = activeDungeonBalance();
  if (!run || !Object.prototype.hasOwnProperty.call(run.trialResults, status)) return;
  run.trialResults[status]++;
}

function recordDungeonBossStart(boss, now) {
  const run = activeDungeonBalance();
  if (!run || !boss) return null;
  const startedAt = Number.isFinite(now) ? now : Date.now();
  if (run.activeBoss) recordDungeonBossEnd('abandoned', null, startedAt);
  run.activeBoss = {
    bossId:String(boss.bossId || 'unknown'),
    bossName:String(boss.name || 'Boss'),
    floor:Math.max(1, Number(floorSafeBossValue(boss.floor, boss.firstFloor)) || 1),
    startedAt,
    highestPhase:Math.max(1, Number(boss.phase) || 1),
    damageTaken:0
  };
  return run.activeBoss;
}

function floorSafeBossValue(bossFloor, firstFloor) {
  if (Number.isFinite(Number(bossFloor))) return Number(bossFloor);
  if (Number.isFinite(Number(firstFloor))) return Number(firstFloor);
  if (typeof floor !== 'undefined' && Number.isFinite(Number(floor))) return Number(floor);
  return 1;
}

function recordDungeonBossPhase(phase) {
  const run = activeDungeonBalance();
  if (!run || !run.activeBoss) return;
  run.activeBoss.highestPhase = Math.max(run.activeBoss.highestPhase, Math.max(1, Number(phase) || 1));
}

function recordDungeonBossEnd(status, sourceName, now) {
  const run = activeDungeonBalance();
  if (!run || !run.activeBoss) return null;
  const endedAt = Number.isFinite(now) ? now : Date.now();
  const active = run.activeBoss;
  const result = status === 'kill' ? 'kill' : status === 'death' ? 'death' : 'abandoned';
  const encounter = {
    bossId:active.bossId,
    bossName:active.bossName,
    floor:active.floor,
    result,
    classId:run.classId || 'unknown',
    durationSec:Math.max(0, Math.round((endedAt - active.startedAt) / 1000)),
    damageTaken:Math.max(0, Number(active.damageTaken) || 0),
    finalPhase:active.highestPhase,
    deathSource:result === 'death' ? String(sourceName || '未知攻擊').slice(0, 48) : null
  };
  run.bossEncounters.push(encounter);
  run.activeBoss = null;
  return encounter;
}

function finishDungeonBalanceRun(result, now) {
  const run = activeDungeonBalance();
  if (!run) return null;
  const endedAt = Number.isFinite(now) ? now : Date.now();
  if (run.activeBoss) recordDungeonBossEnd(result && result.result === 'extract' ? 'abandoned' : 'death', result && result.cause, endedAt);
  const modifierState = typeof dungeonRun !== 'undefined' && dungeonRun ? dungeonRun.modifierState : null;
  const blessings = modifierState && Array.isArray(modifierState.activeBlessings) ? modifierState.activeBlessings.slice() : [];
  const curses = modifierState && Array.isArray(modifierState.activeCurses) ? modifierState.activeCurses.slice() : [];
  const modifierProfile = blessings.length && curses.length ? 'mixed' : blessings.length ? 'blessings' : curses.length ? 'curses' : 'neutral';
  const finalRun = {
    endedAt,
    classId:run.classId,
    mode:run.mode || 'natural',
    benchmarkId:run.benchmarkId || null,
    benchmarkLabel:run.benchmarkLabel || null,
    result:result && result.result === 'extract' ? 'extract' : 'death',
    floor:Math.max(run.highestFloor, Number(result && result.floor) || 1),
    kills:Math.max(0, Number(result && result.kills) || 0),
    souls:Math.max(0, Number(result && result.gained) || 0),
    durationSec:Math.max(0, Math.round((endedAt - run.startedAt) / 1000)),
    routeOffers:run.routeOffers,
    routeChoices:run.routeChoices,
    routeOfferCount:run.routeOfferCount,
    riskyOfferCount:run.riskyOfferCount,
    routeChoiceCount:run.routeChoiceCount,
    riskyChoiceCount:run.riskyChoiceCount,
    roomEntries:run.roomEntries,
    roomCompletions:run.roomCompletions,
    roomTimeMs:run.roomTimeMs,
    damageBySource:run.damageBySource,
    damageTaken:run.damageTaken,
    rewards:Object.assign({ gear:0, materials:0, souls:0 }, run.rewards || {}),
    roomRewards:(Number(run.rewards && run.rewards.gear) || 0) + (Number(run.rewards && run.rewards.materials) || 0),
    modifiers:{
      profile:modifierProfile,
      blessings,
      curses,
      declines:Math.max(0, Number(modifierState && modifierState.declines) || 0),
      rerollsSpent:Math.max(0, Number(modifierState && modifierState.rerollsSpent) || 0)
    },
    trialResults:run.trialResults,
    bossEncounters:run.bossEncounters.slice()
  };
  dungeonBalance.runs.push(finalRun);
  dungeonBalance.runs = trimDungeonBalanceRuns(dungeonBalance.runs);
  dungeonBalance.active = null;
  saveDungeonBalance();
  return finalRun;
}

function dungeonBalanceRuns(mode) {
  const wanted = mode === 'benchmark' ? 'benchmark' : 'natural';
  return dungeonBalance.runs.filter(run => (run.mode || 'natural') === wanted);
}

function dungeonBalanceSummary(mode) {
  const runs = dungeonBalanceRuns(mode);
  const total = runs.length;
  const sum = (fn) => runs.reduce((n, run) => n + (Number(fn(run)) || 0), 0);
  const choices = sum(run => Number.isFinite(run.routeChoiceCount) ? run.routeChoiceCount : Object.values(run.routeChoices || {}).reduce((n, value) => n + (Number(value) || 0), 0));
  const riskyChoices = sum(run => Number.isFinite(run.riskyChoiceCount) ? run.riskyChoiceCount : ['elite','event','hazard'].reduce((n, id) => n + (Number(run.routeChoices && run.routeChoices[id]) || 0), 0));
  const damage = {};
  for (const run of runs) for (const [source, value] of Object.entries(run.damageBySource || {})) damage[source] = (damage[source] || 0) + (Number(value) || 0);
  const topDamage = Object.entries(damage).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    runs:total,
    extractRate:total ? sum(run => run.result === 'extract' ? 1 : 0) / total : 0,
    averageFloor:total ? sum(run => run.floor) / total : 0,
    averageDurationSec:total ? sum(run => run.durationSec) / total : 0,
    riskyChoiceRate:choices ? riskyChoices / choices : 0,
    averageDamage:total ? sum(run => run.damageTaken) / total : 0,
    topDamage
  };
}

function dungeonBalanceReport(mode) {
  const reportMode = mode === 'benchmark' ? 'benchmark' : 'natural';
  const runs = dungeonBalanceRuns(reportMode);
  const summary = dungeonBalanceSummary(reportMode);
  // 涵蓋所有出現過的職業（含進階職），基礎職即使沒跑過也保留欄位供對照。
  const classStats = {};
  const classIds = ['warrior', 'mage'];
  for (const run of runs) if (run.classId && classIds.indexOf(run.classId) < 0) classIds.push(run.classId);
  for (const classId of classIds) {
    const list = runs.filter(run => run.classId === classId);
    const sum = (fn) => list.reduce((n, run) => n + (Number(fn(run)) || 0), 0);
    classStats[classId] = {
      runs:list.length,
      averageFloor:list.length ? sum(run => run.floor) / list.length : 0,
      averageDurationSec:list.length ? sum(run => run.durationSec) / list.length : 0,
      averageDamage:list.length ? sum(run => run.damageTaken) / list.length : 0,
      extractRate:list.length ? sum(run => run.result === 'extract' ? 1 : 0) / list.length : 0
    };
  }
  const roomStats = {};
  for (const id of DUNGEON_BALANCE_ROOM_TYPES) {
    const totals = runs.reduce((out, run) => {
      out.offers += Number(run.routeOffers && run.routeOffers[id]) || 0;
      out.choices += Number(run.routeChoices && run.routeChoices[id]) || 0;
      out.entries += Number(run.roomEntries && run.roomEntries[id]) || 0;
      out.completions += Number(run.roomCompletions && run.roomCompletions[id]) || 0;
      out.timeMs += Number(run.roomTimeMs && run.roomTimeMs[id]) || 0;
      return out;
    }, { offers:0, choices:0, entries:0, completions:0, timeMs:0 });
    roomStats[id] = Object.assign(totals, {
      choiceRate:totals.offers ? totals.choices / totals.offers : 0,
      completionRate:totals.entries ? totals.completions / totals.entries : 0,
      averageClearSec:totals.completions ? totals.timeMs / totals.completions / 1000 : 0
    });
  }
  const totalDamage = runs.reduce((n, run) => n + (Number(run.damageTaken) || 0), 0);
  const damageTotals = {};
  for (const run of runs) for (const [source, value] of Object.entries(run.damageBySource || {})) damageTotals[source] = (damageTotals[source] || 0) + (Number(value) || 0);
  const damageShares = Object.entries(damageTotals).sort((a, b) => b[1] - a[1]).map(([source, value]) => ({ source, value, share:totalDamage ? value / totalDamage : 0 }));
  const trialResults = runs.reduce((out, run) => {
    for (const status of ['success','failed','declined']) out[status] += Number(run.trialResults && run.trialResults[status]) || 0;
    return out;
  }, { success:0, failed:0, declined:0 });
  const modifierStats = {};
  for (const profile of ['neutral','blessings','curses','mixed']) {
    const list = runs.filter(run => (run.modifiers && run.modifiers.profile || 'neutral') === profile);
    const sum = (fn) => list.reduce((total, run) => total + (Number(fn(run)) || 0), 0);
    modifierStats[profile] = {
      runs:list.length,
      averageDurationSec:list.length ? sum(run => run.durationSec) / list.length : 0,
      averageDamage:list.length ? sum(run => run.damageTaken) / list.length : 0,
      averageSouls:list.length ? sum(run => run.souls) / list.length : 0,
      averageRoomRewards:list.length ? sum(run => run.roomRewards) / list.length : 0,
      warriorRuns:list.filter(run => run.classId === 'warrior').length,
      mageRuns:list.filter(run => run.classId === 'mage').length
    };
  }
  const bossIds = typeof DUNGEON_BOSS_ORDER === 'undefined' ? [] : DUNGEON_BOSS_ORDER.slice();
  for (const run of runs) for (const encounter of run.bossEncounters || []) if (!bossIds.includes(encounter.bossId)) bossIds.push(encounter.bossId);
  const bossStats = {};
  for (const id of bossIds) {
    const encounters = runs.flatMap(run => (run.bossEncounters || []).map(item => Object.assign({ classId:run.classId || 'unknown', damageTaken:0 }, item))).filter(item => item.bossId === id);
    const kills = encounters.filter(item => item.result === 'kill');
    const deaths = encounters.filter(item => item.result === 'death');
    const deathSources = {};
    for (const item of deaths) deathSources[item.deathSource || '未知攻擊'] = (deathSources[item.deathSource || '未知攻擊'] || 0) + 1;
    const bossClassStats = {};
    for (const classId of ['warrior','mage']) {
      const classEncounters = encounters.filter(item => item.classId === classId);
      const classKills = classEncounters.filter(item => item.result === 'kill');
      bossClassStats[classId] = {
        encounters:classEncounters.length,
        kills:classKills.length,
        deaths:classEncounters.filter(item => item.result === 'death').length,
        killRate:classEncounters.length ? classKills.length / classEncounters.length : 0,
        averageClearSec:classKills.length ? classKills.reduce((sum, item) => sum + (Number(item.durationSec) || 0), 0) / classKills.length : 0,
        averageDamage:classEncounters.length ? classEncounters.reduce((sum, item) => sum + (Number(item.damageTaken) || 0), 0) / classEncounters.length : 0
      };
    }
    bossStats[id] = {
      name:encounters[0] ? encounters[0].bossName : (typeof dungeonBossDef === 'function' ? dungeonBossDef(id).name : id),
      encounters:encounters.length,
      kills:kills.length,
      deaths:deaths.length,
      killRate:encounters.length ? kills.length / encounters.length : 0,
      averageClearSec:kills.length ? kills.reduce((sum, item) => sum + (Number(item.durationSec) || 0), 0) / kills.length : 0,
      averageDamage:encounters.length ? encounters.reduce((sum, item) => sum + (Number(item.damageTaken) || 0), 0) / encounters.length : 0,
      highestPhase:encounters.reduce((highest, item) => Math.max(highest, Number(item.finalPhase) || 1), 0),
      deathSources:Object.entries(deathSources).sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
      classStats:bossClassStats
    };
  }
  const alerts = [];
  if (summary.runs >= 10 && (summary.riskyChoiceRate < 0.35 || summary.riskyChoiceRate > 0.65)) alerts.push('高風險選擇率超出 35～65%');
  if (summary.runs >= 10 && (summary.averageDurationSec < 720 || summary.averageDurationSec > 1200)) alerts.push('平均局長超出 12～20 分鐘');
  if (classStats.warrior.runs >= 5 && classStats.mage.runs >= 5 && Math.abs(classStats.warrior.averageFloor - classStats.mage.averageFloor) > 1.5) alerts.push('職業平均樓層差超過 1.5 層');
  if (summary.runs >= 10 && damageShares[0] && damageShares[0].share > 0.35) alerts.push('單一承傷來源超過 35%');
  const calibration = typeof DUNGEON_D3C_CALIBRATION === 'undefined' ? null : {
    id:DUNGEON_D3C_CALIBRATION.id,
    version:DUNGEON_D3C_CALIBRATION.version,
    date:DUNGEON_D3C_CALIBRATION.date,
    basis:DUNGEON_D3C_CALIBRATION.basis,
    adjustments:DUNGEON_D3C_CALIBRATION.adjustments.map(item => Object.assign({}, item))
  };
  return { mode:reportMode, generatedAt:new Date().toISOString(), calibration, summary, classStats, modifierStats, roomStats, damageShares, trialResults, bossStats, alerts };
}

function dungeonBossBenchmarkComparison() {
  const runs = dungeonBalanceRuns('benchmark');
  const cases = DUNGEON_BOSS_BENCHMARK_CASES.map(definition => {
    const encounters = runs
      .filter(run => run.classId === definition.classId && run.benchmarkId === definition.benchmarkId)
      .flatMap(run => run.bossEncounters || [])
      .filter(item => item.bossId === definition.bossId);
    const kills = encounters.filter(item => item.result === 'kill');
    const averageClearSec = kills.length ? kills.reduce((sum, item) => sum + (Number(item.durationSec) || 0), 0) / kills.length : 0;
    const averageDamage = encounters.length ? encounters.reduce((sum, item) => sum + (Number(item.damageTaken) || 0), 0) / encounters.length : 0;
    const clearWithin = kills.length > 0 && averageClearSec >= definition.clearSec[0] && averageClearSec <= definition.clearSec[1];
    const damageWithin = encounters.length > 0 && averageDamage >= definition.damage[0] && averageDamage <= definition.damage[1];
    return Object.assign({}, definition, {
      encounters:encounters.length,
      kills:kills.length,
      deaths:encounters.filter(item => item.result === 'death').length,
      averageClearSec,
      averageDamage,
      clearWithin,
      damageWithin,
      status:!encounters.length ? 'no-data' : clearWithin && damageWithin ? 'within' : 'review'
    });
  });
  const bosses = {};
  for (const target of DUNGEON_BOSS_BENCHMARK_TARGETS) {
    const warrior = cases.find(item => item.bossId === target.bossId && item.classId === 'warrior');
    const mage = cases.find(item => item.bossId === target.bossId && item.classId === 'mage');
    const paired = warrior.kills > 0 && mage.kills > 0;
    const mean = paired ? (warrior.averageClearSec + mage.averageClearSec) / 2 : 0;
    bosses[target.bossId] = {
      bossName:target.bossName,
      target:target,
      warrior,
      mage,
      classGapPct:paired && mean ? Math.abs(warrior.averageClearSec - mage.averageClearSec) / mean : 0,
      paired,
      ready:warrior.encounters >= 3 && mage.encounters >= 3
    };
  }
  const alerts = Object.values(bosses)
    .filter(item => item.ready && item.paired && item.classGapPct > 0.15)
    .map(item => item.bossName + '職業擊殺時間差超過 15%');
  return { generatedAt:new Date().toISOString(), cases, bosses, alerts };
}

function exportDungeonBalanceRecords() {
  const g1Modifiers = typeof dungeonG1BalanceReport === 'function' ? dungeonG1BalanceReport() : null;
  return JSON.stringify({ version:3, exportedAt:new Date().toISOString(), natural:dungeonBalanceReport('natural'), benchmark:dungeonBalanceReport('benchmark'), bossBenchmark:dungeonBossBenchmarkComparison(), g1Modifiers, runs:dungeonBalance.runs }, null, 2);
}

loadDungeonBalance();
