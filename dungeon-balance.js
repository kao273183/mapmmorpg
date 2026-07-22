// ---------- dungeon D3 local balance telemetry ----------
const DUNGEON_BALANCE_KEY = 'pixelrogue_dungeon_balance_v1';
const DUNGEON_BALANCE_MAX_RUNS = 60;
const DUNGEON_BALANCE_ROOM_TYPES = ['safe','elite','treasure','event','camp','hazard','boss'];

let dungeonBalance = { version:1, runs:[], active:null };

function balanceCountMap(source, allowed) {
  const result = {};
  for (const id of allowed) result[id] = Math.max(0, Number(source && source[id]) || 0);
  return result;
}

function loadDungeonBalance() {
  try {
    const saved = JSON.parse(localStorage.getItem(DUNGEON_BALANCE_KEY));
    if (saved && Array.isArray(saved.runs)) {
      dungeonBalance.runs = saved.runs.filter(run => run && typeof run === 'object').slice(-DUNGEON_BALANCE_MAX_RUNS);
    }
  } catch (err) {}
  dungeonBalance.active = null;
  return dungeonBalance;
}

function saveDungeonBalance() {
  try {
    localStorage.setItem(DUNGEON_BALANCE_KEY, JSON.stringify({ version:1, runs:dungeonBalance.runs.slice(-DUNGEON_BALANCE_MAX_RUNS) }));
  } catch (err) {}
}

function startDungeonBalanceRun(seed, classId, now) {
  const startedAt = Number.isFinite(now) ? now : Date.now();
  dungeonBalance.active = {
    version:1,
    startedAt,
    seed:String(seed == null ? '' : seed),
    classId:classId || 'unknown',
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
  dungeonBalance.runs = dungeonBalance.runs.slice(-DUNGEON_BALANCE_MAX_RUNS);
  dungeonBalance.active = null;
  saveDungeonBalance();
  return finalRun;
}

function dungeonBalanceSummary() {
  const runs = dungeonBalance.runs;
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

function exportDungeonBalanceRecords() {
  return JSON.stringify({ version:1, exportedAt:new Date().toISOString(), summary:dungeonBalanceSummary(), runs:dungeonBalance.runs }, null, 2);
}

loadDungeonBalance();
