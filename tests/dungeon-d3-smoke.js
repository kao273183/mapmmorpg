const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const storage = new Map();
const context = vm.createContext({
  console,
  Date,
  localStorage:{
    getItem:key => storage.has(key) ? storage.get(key) : null,
    setItem:(key, value) => storage.set(key, String(value))
  }
});

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'balance.js'), 'utf8');
vm.runInContext(source + `
globalThis.balanceApi = {
  startDungeonBalanceRun,
  recordDungeonRouteOffer,
  recordDungeonRouteChoice,
  recordDungeonRoomEntry,
  recordDungeonRoomComplete,
  recordDungeonDamage,
  recordDungeonTrialResult,
  finishDungeonBalanceRun,
  dungeonBalanceSummary,
  exportDungeonBalanceRecords,
  getRuns:() => dungeonBalance.runs
};`, context);

const api = context.balanceApi;
api.startDungeonBalanceRun('seed-1', 'warrior', 1000);
api.recordDungeonRoomEntry({ type:'safe', floor:1 }, 1000);
api.recordDungeonRoomComplete({ type:'safe', floor:1 }, 11000);
api.recordDungeonRouteOffer([{ type:'safe', threat:1 }, { type:'hazard', threat:3 }]);
api.recordDungeonRouteChoice({ type:'hazard', threat:3 });
api.recordDungeonRoomEntry({ type:'hazard', floor:2 }, 12000);
api.recordDungeonDamage('熔岩噴口', 18);
api.recordDungeonDamage('熔岩噴口', 7);
api.recordDungeonDamage('史萊姆', 5);
api.recordDungeonTrialResult('success');
api.recordDungeonRoomComplete({ type:'hazard', floor:2 }, 42000);
const first = api.finishDungeonBalanceRun({ result:'extract', floor:7, kills:12, gained:36 }, 61000);

assert.strictEqual(first.classId, 'warrior');
assert.strictEqual(first.result, 'extract');
assert.strictEqual(first.durationSec, 60);
assert.strictEqual(first.routeOffers.safe, 1);
assert.strictEqual(first.routeOffers.hazard, 1);
assert.strictEqual(first.routeChoices.hazard, 1);
assert.strictEqual(first.roomCompletions.safe, 1);
assert.strictEqual(first.roomCompletions.hazard, 1);
assert.strictEqual(first.roomTimeMs.safe, 10000);
assert.strictEqual(first.roomTimeMs.hazard, 30000);
assert.strictEqual(first.damageTaken, 30);
assert.strictEqual(first.damageBySource['熔岩噴口'], 25);
assert.strictEqual(first.trialResults.success, 1);

let summary = api.dungeonBalanceSummary();
assert.strictEqual(summary.runs, 1);
assert.strictEqual(summary.extractRate, 1);
assert.strictEqual(summary.averageFloor, 7);
assert.strictEqual(summary.riskyChoiceRate, 1);
assert.strictEqual(summary.topDamage[0][0], '熔岩噴口');

for (let i = 0; i < 65; i++) {
  api.startDungeonBalanceRun('seed-' + (i + 2), i % 2 ? 'mage' : 'warrior', i * 100000);
  api.recordDungeonRoomEntry({ type:'safe', floor:1 }, i * 100000);
  api.finishDungeonBalanceRun({ result:i % 3 ? 'death' : 'extract', floor:1 + i % 10, kills:i, gained:i * 2 }, i * 100000 + 30000);
}

assert.strictEqual(api.getRuns().length, 60, 'history should retain only the latest 60 runs');
summary = api.dungeonBalanceSummary();
assert.strictEqual(summary.runs, 60);
const exported = JSON.parse(api.exportDungeonBalanceRecords());
assert.strictEqual(exported.version, 3);
assert.strictEqual(exported.runs.length, 60);
assert.ok(storage.has('pixelrogue_dungeon_balance_v1'));

console.log('dungeon D3 balance telemetry smoke test passed (60-run cap, routes, rooms, damage, trials, export)');
