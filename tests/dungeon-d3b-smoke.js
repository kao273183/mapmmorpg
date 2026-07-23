const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGameSource } = require('./helpers/game-source');

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
globalThis.d3bApi = {
  profiles:DUNGEON_BENCHMARK_PROFILES,
  profile:dungeonBenchmarkProfile,
  start:startDungeonBalanceRun,
  offer:recordDungeonRouteOffer,
  choose:recordDungeonRouteChoice,
  enter:recordDungeonRoomEntry,
  complete:recordDungeonRoomComplete,
  damage:recordDungeonDamage,
  trial:recordDungeonTrialResult,
  finish:finishDungeonBalanceRun,
  summary:dungeonBalanceSummary,
  report:dungeonBalanceReport,
  exportRecords:exportDungeonBalanceRecords
};`, context);

const api = context.d3bApi;
const PROFILE_COUNT = api.profiles.length; // 基準檔會隨職業增加，不寫死數量
assert.ok(PROFILE_COUNT >= 6, '至少要有兩個基礎職 × 三階');
assert.strictEqual(new Set(Array.from(api.profiles, p => p.id)).size, PROFILE_COUNT, '基準檔 id 不可重複');
for (const classId of ['warrior','mage']) {
  const profiles = api.profiles.filter(profile => profile.classId === classId);
  assert.strictEqual(profiles.length, 3);
  assert.deepStrictEqual(Array.from(profiles, profile => profile.tier), ['starter','chapter2','chapter3']);
  for (const profile of profiles) {
    assert.strictEqual(profile.gear.length, 5);
    assert.deepStrictEqual(Array.from(profile.gear, item => item.kind), ['weapon','armor','helmet','boots','acc']);
    assert.ok(profile.gear.every(item => item.cls === classId && item.benchmark));
  }
}
for (const tier of ['starter','chapter2','chapter3']) {
  const warrior = api.profiles.find(profile => profile.classId === 'warrior' && profile.tier === tier);
  const mage = api.profiles.find(profile => profile.classId === 'mage' && profile.tier === tier);
  assert.strictEqual(warrior.seed, mage.seed, tier + ' should use the same paired seed');
  assert.strictEqual(warrior.gear[0].atk, mage.gear[0].atk, tier + ' weapons should have matched attack values');
}

let clock = 1000;
function addRun({ mode, profile, classId, floor, damage, result }) {
  const options = mode === 'benchmark' ? { mode, benchmarkId:profile.id, benchmarkLabel:profile.label } : { mode:'natural' };
  api.start(profile ? profile.seed : 'natural-' + clock, classId, clock, options);
  api.enter({ type:'safe', floor:1 }, clock);
  api.complete({ type:'safe', floor:1 }, clock + 240000);
  api.offer([{ type:'safe', threat:1 }, { type:'hazard', threat:3 }]);
  api.choose({ type:'hazard', threat:3 });
  api.enter({ type:'hazard', floor:2 }, clock + 250000);
  api.damage(classId === 'warrior' ? '落石區' : '熔岩噴口', damage);
  api.trial(floor >= 7 ? 'success' : 'failed');
  api.complete({ type:'hazard', floor:2 }, clock + 490000);
  api.finish({ result, floor, kills:floor * 2, gained:floor * 3 }, clock + 900000);
  clock += 1000000;
}

addRun({ mode:'natural', classId:'warrior', floor:4, damage:20, result:'death' });
addRun({ mode:'natural', classId:'mage', floor:5, damage:25, result:'extract' });
for (const profile of api.profiles) {
  const tierFloor = profile.tier === 'starter' ? 5 : profile.tier === 'chapter2' ? 10 : 15;
  addRun({ mode:'benchmark', profile, classId:profile.classId, floor:tierFloor, damage:profile.classId === 'warrior' ? 30 : 36, result:'extract' });
}

const natural = api.report('natural');
const benchmark = api.report('benchmark');
assert.strictEqual(natural.summary.runs, 2);
assert.strictEqual(benchmark.summary.runs, PROFILE_COUNT);
assert.strictEqual(benchmark.classStats.warrior.runs, 3);
assert.strictEqual(benchmark.classStats.mage.runs, 3);
for (const profile of api.profiles) {
  assert.ok(benchmark.classStats[profile.classId], profile.classId + ' 應出現在基準統計裡');
}
assert.strictEqual(benchmark.classStats.warrior.averageFloor, 10);
assert.strictEqual(benchmark.classStats.mage.averageFloor, 10);
assert.strictEqual(benchmark.roomStats.safe.completions, PROFILE_COUNT);
assert.strictEqual(benchmark.roomStats.hazard.choices, PROFILE_COUNT);
assert.strictEqual(benchmark.roomStats.hazard.averageClearSec, 240);
assert.strictEqual(benchmark.damageShares[0].source, '熔岩噴口');
assert.ok(benchmark.damageShares[0].share > 0.5);
// addRun 以 floor>=7 判定成功：只有 starter 階（floor 5）會失敗
const starterCount = api.profiles.filter(p => p.tier === 'starter').length;
assert.strictEqual(benchmark.trialResults.failed, starterCount);
assert.strictEqual(benchmark.trialResults.success, PROFILE_COUNT - starterCount);

const exported = JSON.parse(api.exportRecords());
assert.strictEqual(exported.version, 3);
assert.strictEqual(exported.natural.summary.runs, 2);
assert.strictEqual(exported.benchmark.summary.runs, PROFILE_COUNT);

const capProfile = api.profile('warrior-starter');
for (let i = 0; i < 65; i++) {
  api.start(capProfile.seed, capProfile.classId, clock, { mode:'benchmark', benchmarkId:capProfile.id, benchmarkLabel:capProfile.label });
  api.finish({ result:'death', floor:1, kills:0, gained:0 }, clock + 1000);
  clock += 2000;
}
assert.strictEqual(api.summary('benchmark').runs, 60, 'benchmark history should have its own 60-run cap');
assert.strictEqual(api.summary('natural').runs, 2, 'benchmark runs must not evict natural-play history');

const gameSource = loadGameSource(path.join(__dirname, '..'));
assert.ok(gameSource.includes('startDungeonBenchmarkRun'));
assert.ok(gameSource.includes('restoreDungeonBenchmarkProgress'));
assert.ok(gameSource.includes("settingsBalanceMode = 'benchmark'"));

console.log('dungeon D3-B benchmark smoke test passed (' + PROFILE_COUNT + ' profiles, split reports, class/room/damage aggregates)');
