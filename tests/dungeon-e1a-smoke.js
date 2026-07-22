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

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'data.js'), 'utf8');
const bossSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'bosses.js'), 'utf8');
const balanceSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'balance.js'), 'utf8');
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  const index = Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5));
  return DUNGEON_BIOME_DEFS[Math.max(0, index)];
}
` + bossSource + '\n' + balanceSource + `
globalThis.e1aApi = {
  order:DUNGEON_BOSS_ORDER,
  defs:DUNGEON_BOSS_DEFS,
  forFloor:dungeonBossDefForFloor,
  arena:dungeonBossArenaPlatforms,
  create:createDungeonBoss,
  phase:dungeonBossPhaseForHealth,
  phaseConfig:dungeonBossPhaseConfig,
  begin:beginDungeonBossAttack,
  finishAttack:finishDungeonBossAttack,
  telegraph:dungeonBossTelegraph,
  addCount:dungeonBossAddCount,
  startRun:startDungeonBalanceRun,
  startBoss:recordDungeonBossStart,
  bossPhase:recordDungeonBossPhase,
  endBoss:recordDungeonBossEnd,
  finishRun:finishDungeonBalanceRun,
  report:dungeonBalanceReport,
  exportRecords:exportDungeonBalanceRecords
};`, context);

const api = context.e1aApi;
assert.deepStrictEqual(Array.from(api.order), ['meadow_lord','cavern_lord','volcano_lord','tundra_lord','void_lord']);
assert.deepStrictEqual([5,10,15,20,25].map(floor => api.forFloor(floor).id), Array.from(api.order));

for (const id of api.order) {
  const def = api.defs[id];
  assert.strictEqual(def.phases.length, 3);
  assert.strictEqual(def.attackSlots.length, 2);
  assert.ok(def.attackSlots.every(attack => attack.implemented === true));
  assert.ok(def.environmentId);
  const arena = api.arena(def);
  assert.strictEqual(arena[0].ground, true);
  assert.strictEqual(arena[0].w, def.arena.width);
  assert.strictEqual(arena.length, 4);
}

const meadow = api.create(api.defs.meadow_lord, 5, 2);
assert.strictEqual(meadow.bossId, 'meadow_lord');
assert.strictEqual(meadow.floor, 5);
assert.strictEqual(meadow.hp, Math.round(800 * 2 * 1.08));
assert.strictEqual(meadow.dmg, Math.round(15 * 2 * 0.82));
assert.strictEqual(meadow.atkT, 150);
assert.strictEqual(meadow.intro, true);
assert.strictEqual(api.phase(meadow), 1);
meadow.hp = meadow.mhp * 0.6;
assert.strictEqual(api.phase(meadow), 2);
meadow.hp = meadow.mhp * 0.3;
assert.strictEqual(api.phase(meadow), 3);
assert.strictEqual(api.addCount(meadow, 2), 1);
assert.strictEqual(api.addCount(meadow, 3), 2);
assert.strictEqual(api.begin(meadow), 'leap_volley');
assert.strictEqual(meadow.attackCycle, 1);
meadow.phase = 3; meadow.targetX = 440;
assert.strictEqual(api.telegraph(meadow).radius, 130);
assert.strictEqual(api.telegraph(meadow).targetX, 440);
api.finishAttack(meadow);
assert.strictEqual(meadow.activeAttackId, null);

let clock = 1000;
api.startRun('boss-seed-1', 'warrior', clock, { mode:'benchmark' });
api.startBoss(meadow, clock);
api.bossPhase(3);
const kill = api.endBoss('kill', null, clock + 61000);
assert.strictEqual(kill.durationSec, 61);
assert.strictEqual(kill.finalPhase, 3);
api.finishRun({ result:'extract', floor:5, kills:1, gained:8 }, clock + 70000);

clock += 100000;
const cavern = api.create(api.defs.cavern_lord, 10, 3);
api.startRun('boss-seed-2', 'mage', clock, { mode:'benchmark' });
api.startBoss(cavern, clock);
api.bossPhase(2);
api.finishRun({ result:'death', floor:10, kills:0, gained:0, cause:'洞窟領主的落地震波' }, clock + 45000);

const report = api.report('benchmark');
assert.strictEqual(report.bossStats.meadow_lord.kills, 1);
assert.strictEqual(report.bossStats.meadow_lord.averageClearSec, 61);
assert.strictEqual(report.bossStats.cavern_lord.deaths, 1);
assert.strictEqual(report.bossStats.cavern_lord.highestPhase, 2);
assert.strictEqual(report.bossStats.cavern_lord.deathSources[0].source, '洞窟領主的落地震波');
assert.strictEqual(JSON.parse(api.exportRecords()).version, 3);

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes('createDungeonBoss(bossDef, n, sc)'));
assert.ok(gameSource.includes('dungeonBossTelegraph(m)'));
assert.ok(gameSource.includes("version:'0.29.0'"));
for (const entry of ['meadow:5','cavern:10','volcano:15','tundra:20','void:25']) assert.ok(smokeHtml.includes(entry));
assert.ok(smokeHtml.includes("mode === 'settings-boss-balance'"));

console.log('dungeon E1-A boss foundation smoke test passed (5 definitions, shared interface, telemetry, fixed floors)');
