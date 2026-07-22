const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'hazards.js'), 'utf8'),
  `
  function __setHazardRun(seed) {
    dungeonRun = {
      seed,
      chapter:1,
      explorationScore:0,
      roomHistory:['safe'],
      eventHistory:[],
      hazardTutorials:{},
      chapterUsed:{ camp:false, treasure:false },
      completedFloor:0,
      rewardedFloor:0,
      choices:[],
      chapterReward:null
    };
  }
  function __setCurrentSpec(spec) { currentRoomSpec = spec; }
  globalThis.__d2b = {
    makeRoomSpec,
    generateThornRootLayout,
    thornRootLayoutValid,
    spawnDungeonHazards,
    advanceThornRoot,
    thornRootHitsPlayer,
    updateDungeonHazards,
    dungeonHazardAvailable,
    setRun:__setHazardRun,
    setSpec:__setCurrentSpec,
    getRun:() => dungeonRun,
    getHazards:() => dungeonHazards,
    getTutorial:() => dungeonHazardTutorial,
    thornDef:DUNGEON_HAZARD_DEFS.thorn_roots
  };
  `
].join('\n');

const damageEvents = [];
const context = {
  console,
  Math,
  Date,
  player:{ x:80, y:468, w:26, h:46, mhp:100, hp:100, inv:0, vy:0, onGround:true, hazardSlowT:0 },
  meta:{ playerName:'測試勇者' },
  dmgPlayer:event => { damageEvents.push(event); return false; },
  num:() => {},
  ctx:{},
  frame:0,
  W:960,
  STAT_FONT:'monospace'
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2b-bundle.js' });
const api = context.__d2b;

assert.strictEqual(api.thornDef.implemented, true);
assert.strictEqual(api.dungeonHazardAvailable(2), true, '草原荊棘完成後應開放險境');
assert.strictEqual(api.dungeonHazardAvailable(7), true, 'D2-C 完成後洞窟落石應開放險境');

for (let seed = 1; seed <= 1000; seed++) {
  api.setRun(seed);
  const spec = api.makeRoomSpec('hazard', 2, 0);
  const eventX = seed % 2 ? 920 : null;
  const layoutA = api.generateThornRootLayout(spec, 1900, eventX);
  const layoutB = api.generateThornRootLayout(spec, 1900, eventX);
  assert.deepStrictEqual(layoutA, layoutB, '荊棘配置應可重現');
  assert.ok(layoutA.length >= 2 && layoutA.length <= api.thornDef.maxPerRoom, '每房應生成安全數量的荊棘');
  for (let i = 0; i < layoutA.length; i++) {
    const root = layoutA[i];
    assert.ok(root.x - root.w / 2 >= 180, '荊棘不得進入入口保護區');
    assert.ok(root.x + root.w / 2 <= 1720, '荊棘不得進入出口保護區');
    if (eventX != null) assert.ok(Math.abs(root.x - eventX) >= root.w / 2 + 140, '荊棘不得覆蓋事件互動區');
    for (let j = 0; j < i; j++) {
      const other = layoutA[j];
      assert.ok(Math.abs(root.x - other.x) >= root.w / 2 + other.w / 2 + 120, '相鄰荊棘間要保留安全帶');
    }
  }
}

api.setRun(20260722);
const spec = api.makeRoomSpec('hazard', 2, 0);
api.setSpec(spec);
const spawned = api.spawnDungeonHazards(spec, 1900, null);
assert.ok(spawned.length >= 2);
assert.ok(api.getTutorial() && api.getTutorial().name === '荊棘根鬚', '首次遭遇應顯示教學');
api.spawnDungeonHazards(spec, 1900, null);
assert.strictEqual(api.getTutorial(), null, '同一局重複地形不應再次顯示教學');

const cycle = { phase:'warning', timer:1, hitThisCycle:false };
api.advanceThornRoot(cycle, api.thornDef);
assert.strictEqual(cycle.phase, 'active');
assert.strictEqual(cycle.timer, api.thornDef.activeFrames);
cycle.timer = 1;
api.advanceThornRoot(cycle, api.thornDef);
assert.strictEqual(cycle.phase, 'cooldown');
cycle.timer = 1;
api.advanceThornRoot(cycle, api.thornDef);
assert.strictEqual(cycle.phase, 'warning');

const rootHazard = api.getHazards()[0];
context.player.x = rootHazard.x;
context.player.y = 468;
assert.strictEqual(api.thornRootHitsPlayer(rootHazard, context.player), true);
context.player.y = 420;
assert.strictEqual(api.thornRootHitsPlayer(rootHazard, context.player), false, '跳過尖刺高度時不應命中');

context.player.y = 468;
context.player.inv = 0;
context.player.hazardSlowT = 0;
rootHazard.phase = 'active';
rootHazard.timer = 999;
rootHazard.hitThisCycle = false;
damageEvents.length = 0;
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '每個 active 週期只能造成一次傷害');
assert.strictEqual(damageEvents[0].sourceName, '荊棘根鬚');
assert.strictEqual(damageEvents[0].amount, 6);
assert.strictEqual(context.player.hazardSlowT, api.thornDef.slowFrames);
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '同一 active 週期不得重複命中');

console.log('dungeon D2-B smoke test passed');
