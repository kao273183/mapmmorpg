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

const balanceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'balance.js'), 'utf8');
vm.runInContext(balanceSource + `
globalThis.e1gApi = {
  targets:DUNGEON_BOSS_BENCHMARK_TARGETS,
  cases:DUNGEON_BOSS_BENCHMARK_CASES,
  profile:dungeonBenchmarkProfile,
  start:startDungeonBalanceRun,
  bossStart:recordDungeonBossStart,
  bossPhase:recordDungeonBossPhase,
  damage:recordDungeonDamage,
  bossEnd:recordDungeonBossEnd,
  finish:finishDungeonBalanceRun,
  report:dungeonBalanceReport,
  compare:dungeonBossBenchmarkComparison,
  exportRecords:exportDungeonBalanceRecords
};`, context);

const api = context.e1gApi;
assert.strictEqual(api.targets.length, 5);
assert.strictEqual(api.cases.length, 10);
for (const target of api.targets) {
  const cases = api.cases.filter(item => item.bossId === target.bossId);
  assert.deepStrictEqual(Array.from(cases, item => item.classId), ['warrior','mage']);
  assert.ok(cases.every(item => item.seed === target.seed && item.floor === target.floor && item.tier === target.tier));
  assert.ok(cases.every(item => item.benchmarkId === item.classId + '-' + target.tier));
}

let clock = 100000;
for (const testCase of api.cases) {
  const target = api.targets.find(item => item.bossId === testCase.bossId);
  const profile = api.profile(testCase.benchmarkId);
  const duration = Math.round((target.clearSec[0] + target.clearSec[1]) / 2) + (testCase.classId === 'mage' ? 4 : 0);
  const damage = Math.round(target.damage[1] * (testCase.classId === 'mage' ? 0.52 : 0.45));
  api.start(testCase.seed, testCase.classId, clock, { mode:'benchmark', benchmarkId:profile.id, benchmarkLabel:profile.label });
  api.bossStart({ bossId:testCase.bossId, name:testCase.bossName, floor:testCase.floor, phase:1 }, clock + 1000);
  api.bossPhase(3);
  api.damage(testCase.bossName + '固定測試', damage);
  const encounter = api.bossEnd('kill', null, clock + 1000 + duration * 1000);
  assert.strictEqual(encounter.classId, testCase.classId);
  assert.strictEqual(encounter.damageTaken, damage);
  api.finish({ result:'extract', floor:testCase.floor, kills:1, gained:0 }, clock + 2000 + duration * 1000);
  clock += 300000;
}

const report = api.report('benchmark');
assert.strictEqual(report.summary.runs, 10);
for (const target of api.targets) {
  const stat = report.bossStats[target.bossId];
  assert.strictEqual(stat.encounters, 2);
  assert.strictEqual(stat.kills, 2);
  assert.strictEqual(stat.highestPhase, 3);
  assert.strictEqual(stat.classStats.warrior.kills, 1);
  assert.strictEqual(stat.classStats.mage.kills, 1);
  assert.ok(stat.averageDamage > 0);
}

const comparison = api.compare();
assert.strictEqual(comparison.cases.length, 10);
assert.strictEqual(comparison.alerts.length, 0);
for (const target of api.targets) {
  const pair = comparison.bosses[target.bossId];
  assert.strictEqual(pair.paired, true);
  assert.strictEqual(pair.ready, false);
  assert.ok(pair.classGapPct < 0.15);
  assert.strictEqual(pair.warrior.status, 'within');
  assert.strictEqual(pair.mage.status, 'within');
}

const exported = JSON.parse(api.exportRecords());
assert.strictEqual(exported.version, 3);
assert.strictEqual(exported.bossBenchmark.cases.length, 10);
assert.strictEqual(exported.benchmark.summary.runs, 10);

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.ok(gameSource.includes("const GAME_VERSION = '0.29.6'"));
assert.ok(gameSource.includes('function renderSettingsBosses'));
assert.ok(gameSource.includes("settingsPage === 'bosses'"));
assert.ok(smokeHtml.includes("mode === 'settings-boss-records'"));
assert.ok(smokeHtml.includes("mode === 'result-death' || mode === 'result-extract'"));
assert.ok(indexHtml.includes('game.js?v=0.29.6'));

console.log('dungeon E1-G balance smoke test passed (10 paired boss cases, class timing/damage report, export and record page)');
