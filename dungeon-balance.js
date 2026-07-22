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
  const weaponName = classId === 'mage' ? '固定法杖' : '固定長劍';
  return [
    { id:'benchmark-' + classId + '-' + tier + '-weapon', kind:'weapon', r:d.rarity, cls:classId, name:weaponName, atk:d.weapon, wpn:classId === 'mage' ? 'stave' : 'sword', affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-armor', kind:'armor', r:d.rarity, cls:classId, name:'固定護甲', hp:d.armorHp, def:d.armorDef, affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-helmet', kind:'helmet', r:d.rarity, cls:classId, name:'固定頭盔', hp:d.helmetHp, def:d.helmetDef, affixes:[], benchmark:true },
    { id:'benchmark-' + classId + '-' + tier + '-boots', kind:'boots', r:d.rarity, cls:classId, name:'固定戰靴', spd:d.speed, jmp:d.jump || 0, affixes:[], benchmark:true },
    Object.assign({ id:'benchmark-' + classId + '-' + tier + '-acc', kind:'acc', r:d.rarity, cls:classId, name:'固定護符', affixes:[], benchmark:true }, d.atkMul ? { atkMul:d.atkMul } : { crit:d.crit })
  ];
}

const DUNGEON_BENCHMARK_PROFILES = [
  { id:'warrior-starter', classId:'warrior', tier:'starter', label:'劍士 · 新手', gearLabel:'新手全套', seed:31001 },
  { id:'mage-starter', classId:'mage', tier:'starter', label:'法師 · 新手', gearLabel:'新手全套', seed:31001 },
  { id:'warrior-chapter2', classId:'warrior', tier:'chapter2', label:'劍士 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'mage-chapter2', classId:'mage', tier:'chapter2', label:'法師 · 第二章', gearLabel:'稀有全套', seed:72007 },
  { id:'warrior-chapter3', classId:'warrior', tier:'chapter3', label:'劍士 · 第三章', gearLabel:'史詩全套', seed:123011 },
  { id:'mage-chapter3', classId:'mage', tier:'chapter3', label:'法師 · 第三章', gearLabel:'史詩全套', seed:123011 }
].map(profile => Object.assign(profile, { gear:fixedDungeonBenchmarkGear(profile.classId, profile.tier) }));

function dungeonBenchmarkProfile(id) {
  return DUNGEON_BENCHMARK_PROFILES.find(profile => profile.id === id) || null;
}

let dungeonBalance = { version:2, runs:[], active:null };

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
    localStorage.setItem(DUNGEON_BALANCE_KEY, JSON.stringify({ version:2, runs:trimDungeonBalanceRuns(dungeonBalance.runs) }));
  } catch (err) {}
}

function startDungeonBalanceRun(seed, classId, now, options) {
  const startedAt = Number.isFinite(now) ? now : Date.now();
  const opts = options || {};
  const mode = opts.mode === 'benchmark' ? 'benchmark' : 'natural';
  dungeonBalance.active = {
    version:2,
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
    trialResults:{ success:0, failed:0, declined:0 },
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
}

function recordDungeonTrialResult(status) {
  const run = activeDungeonBalance();
  if (!run || !Object.prototype.hasOwnProperty.call(run.trialResults, status)) return;
  run.trialResults[status]++;
}

function finishDungeonBalanceRun(result, now) {
  const run = activeDungeonBalance();
  if (!run) return null;
  const endedAt = Number.isFinite(now) ? now : Date.now();
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
    trialResults:run.trialResults
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
  const classStats = {};
  for (const classId of ['warrior','mage']) {
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
  const alerts = [];
  if (summary.runs >= 10 && (summary.riskyChoiceRate < 0.35 || summary.riskyChoiceRate > 0.65)) alerts.push('高風險選擇率超出 35～65%');
  if (summary.runs >= 10 && (summary.averageDurationSec < 720 || summary.averageDurationSec > 1200)) alerts.push('平均局長超出 12～20 分鐘');
  if (classStats.warrior.runs >= 5 && classStats.mage.runs >= 5 && Math.abs(classStats.warrior.averageFloor - classStats.mage.averageFloor) > 1.5) alerts.push('職業平均樓層差超過 1.5 層');
  if (summary.runs >= 10 && damageShares[0] && damageShares[0].share > 0.35) alerts.push('單一承傷來源超過 35%');
  return { mode:reportMode, generatedAt:new Date().toISOString(), summary, classStats, roomStats, damageShares, trialResults, alerts };
}

function exportDungeonBalanceRecords() {
  return JSON.stringify({ version:2, exportedAt:new Date().toISOString(), natural:dungeonBalanceReport('natural'), benchmark:dungeonBalanceReport('benchmark'), runs:dungeonBalance.runs }, null, 2);
}

loadDungeonBalance();
