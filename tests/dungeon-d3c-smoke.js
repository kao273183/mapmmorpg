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

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon-data.js'), 'utf8');
const balanceSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon-balance.js'), 'utf8');
vm.runInContext(dataSource + '\n' + balanceSource + `
globalThis.d3cApi = {
  calibration:DUNGEON_D3C_CALIBRATION,
  hazards:DUNGEON_HAZARD_DEFS,
  soulBonus:dungeonHazardSoulBonus,
  report:dungeonBalanceReport,
  exportRecords:exportDungeonBalanceRecords
};`, context);

const api = context.d3cApi;
const tuning = api.calibration;
assert.strictEqual(tuning.id, 'd3c-round-1');
assert.strictEqual(tuning.version, '0.28.9');
assert.strictEqual(tuning.basis, 'fixed-benchmark-model');
assert.strictEqual(tuning.adjustments.length, 3, 'D3-C may tune at most three values per round');
for (const item of tuning.adjustments) {
  assert.ok(Math.abs(item.deltaPct) >= 10 && Math.abs(item.deltaPct) <= 15, item.id + ' must stay within 10–15%');
}

assert.strictEqual(tuning.eliteHpMultiplier, 2.15);
assert.strictEqual(api.hazards.falling_rocks.damagePct, 0.07);
assert.strictEqual(api.hazards.lava_vents.damagePct, 0.07);
assert.strictEqual(api.hazards.thorn_roots.damagePct, 0.06, 'light hazard must remain unchanged');
assert.strictEqual(api.soulBonus(7), 11, 'chapter-two hazard reward should rise from 10 to 11 souls');
assert.strictEqual(api.soulBonus(22), 11, 'deep hazard reward should preserve the 10% calibrated bonus');

const report = api.report('benchmark');
assert.strictEqual(report.calibration.version, '0.28.9');
assert.deepStrictEqual(Array.from(report.calibration.adjustments, item => item.id), [
  'elite-hp', 'heavy-hazard-damage', 'hazard-soul-reward'
]);
const exported = JSON.parse(api.exportRecords());
assert.strictEqual(exported.benchmark.calibration.adjustments.length, 3);
assert.strictEqual(exported.natural.calibration.basis, 'fixed-benchmark-model');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const dungeonSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon.js'), 'utf8');
assert.ok(gameSource.includes('DUNGEON_D3C_CALIBRATION.eliteHpMultiplier'));
assert.ok(gameSource.includes("const GAME_VERSION = '0.28.9'"));
assert.ok(dungeonSource.includes('dungeonHazardSoulBonus(floor)'));

console.log('dungeon D3-C calibration smoke test passed (3 bounded changes, before/after report, reward wiring)');
