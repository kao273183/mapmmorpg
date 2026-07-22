const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGameSource } = require('./helpers/game-source');

const root = path.resolve(__dirname, '..');
const storage = new Map();
const context = vm.createContext({
  console,
  Date,
  localStorage:{
    getItem:key => storage.has(key) ? storage.get(key) : null,
    setItem:(key, value) => storage.set(key, String(value))
  }
});
const source = [
  'src/dungeon/data.js',
  'src/dungeon/balance.js',
  'src/dungeon/modifiers.js'
].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
vm.runInContext(source + `
globalThis.g1fApi = {
  definitions:validateDungeonModifierDefinitions,
  model:DUNGEON_G1_BALANCE_MODEL,
  fixedReport:dungeonG1BalanceReport,
  start:startDungeonBalanceRun,
  reward:recordDungeonReward,
  finish:finishDungeonBalanceRun,
  liveReport:dungeonBalanceReport,
  exportRecords:exportDungeonBalanceRecords
};`, context);

const api = context.g1fApi;
assert.strictEqual(api.definitions().ok, true);
assert.strictEqual(api.model.version, '0.29.13');
assert.strictEqual(api.model.basis, 'fixed-benchmark-model');
assert.deepStrictEqual(Array.from(api.model.offerFloors), [3, 7, 11, 14]);
assert.strictEqual(api.model.adjustments.length, 0, 'round one should retain values when no alert crosses a guardrail');

const fixed = api.fixedReport();
assert.deepStrictEqual(Object.keys(fixed.cases), ['neutral', 'blessings', 'curses', 'mixed']);
assert.strictEqual(fixed.alerts.length, 0);
assert.strictEqual(fixed.cases.neutral.warrior.clearSec, 960);
assert.strictEqual(fixed.cases.blessings.warrior.clearSec, 873);
assert.strictEqual(fixed.cases.blessings.warrior.souls, 115);
assert.strictEqual(fixed.cases.curses.warrior.clearSec, 1133);
assert.strictEqual(fixed.cases.curses.warrior.damageTaken, 173);
assert.strictEqual(fixed.cases.curses.warrior.souls, 125);
assert.strictEqual(fixed.cases.curses.warrior.roomRewards, 11.6);
assert.strictEqual(fixed.cases.mixed.warrior.clearSec, 1030);
assert.strictEqual(fixed.cases.mixed.warrior.souls, 144);
for (const profile of Object.values(fixed.cases)) {
  assert.ok(profile.classGapPct < 0.15, profile.id + ' must stay below the paired-class warning');
}
assert.ok(fixed.extremes.soulMul <= 2);
assert.ok(fixed.extremes.bossSkillDamageMul <= 2);
assert.ok(fixed.extremes.bossIncomingMul <= 1.5);
assert.ok(fixed.extremes.maxHpMul >= 0.9);
assert.ok(fixed.extremes.healingMul >= 0.8);
assert.strictEqual(fixed.extremes.gearDropCap, 0.5);

context.dungeonRun = { modifierState:{
  activeBlessings:['sunsteel_edge'], activeCurses:['hardened_horde'], declines:1, rerollsSpent:2
} };
api.start(123011, 'warrior', 1000, { mode:'benchmark', benchmarkId:'warrior-chapter3', benchmarkLabel:'劍士 · 第三章' });
api.reward('gear', 2);
api.reward('materials', 3);
api.reward('souls', 7);
const finished = api.finish({ result:'extract', floor:15, kills:20, gained:144 }, 901000);
assert.strictEqual(finished.modifiers.profile, 'mixed');
assert.deepStrictEqual(Array.from(finished.modifiers.blessings), ['sunsteel_edge']);
assert.deepStrictEqual(Array.from(finished.modifiers.curses), ['hardened_horde']);
assert.strictEqual(finished.roomRewards, 5);
assert.deepStrictEqual(Object.assign({}, finished.rewards), { gear:2, materials:3, souls:7 });
const live = api.liveReport('benchmark');
assert.strictEqual(live.modifierStats.mixed.runs, 1);
assert.strictEqual(live.modifierStats.mixed.averageDurationSec, 900);
assert.strictEqual(live.modifierStats.mixed.averageDamage, 0);
assert.strictEqual(live.modifierStats.mixed.averageSouls, 144);
assert.strictEqual(live.modifierStats.mixed.averageRoomRewards, 5);

context.dungeonRun = {};
api.start(31001, 'mage', 1000000, { mode:'benchmark', benchmarkId:'mage-starter', benchmarkLabel:'法師 · 新手' });
assert.doesNotThrow(() => api.finish({ result:'death', floor:1, kills:0, gained:0 }, 1001000), 'pre-G1 runs without modifier state must remain compatible');
assert.strictEqual(api.liveReport('benchmark').modifierStats.neutral.runs, 1);
const exported = JSON.parse(api.exportRecords());
assert.strictEqual(exported.g1Modifiers.version, '0.29.13');
assert.strictEqual(exported.g1Modifiers.alerts.length, 0);

const gameSource = loadGameSource(root);
const balanceSource = fs.readFileSync(path.join(root, 'src/dungeon/balance.js'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8');
const updateSource = fs.readFileSync(path.join(root, 'src/game/update.js'), 'utf8');
const planSource = fs.readFileSync(path.join(root, 'doc/PLAN-events-G1.md'), 'utf8');
assert.ok(gameSource.includes("const GAME_VERSION = '0.29.13'"));
assert.ok(balanceSource.includes('modifierStats'));
assert.ok(balanceSource.includes('g1Modifiers'));
assert.ok(coreSource.includes("recordDungeonReward('materials'"));
assert.ok(updateSource.includes("recordDungeonReward('souls', 1)"));
assert.ok(planSource.includes('G1-F：平衡、回歸與文件收尾（已完成）'));
assert.ok(!gameSource.includes('modifierState:meta'), 'run-local modifiers must not enter permanent save data');

console.log('dungeon G1-F balance smoke test passed (four profiles, class guardrails, extremes, live rewards, old-run compatibility)');
