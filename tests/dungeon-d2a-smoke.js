const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'core.js'), 'utf8'),
  `
  function __setRunSeed(seed) {
    dungeonRun = {
      seed,
      chapter:1,
      explorationScore:0,
      roomHistory:['safe'],
      eventHistory:[],
      chapterUsed:{ camp:false, treasure:false },
      completedFloor:0,
      rewardedFloor:0,
      choices:[],
      chapterReward:null
    };
  }
  globalThis.__d2a = {
    makeRoomSpec,
    generateDungeonPlatforms,
    generateDungeonEnemyTypes,
    dungeonEventPosition,
    generateRouteChoices,
    applyRoomEntry,
    setRunSeed:__setRunSeed,
    getRun:() => dungeonRun,
    biomeDefs:DUNGEON_BIOME_DEFS,
    hazardDefs:DUNGEON_HAZARD_DEFS,
    eventDefs:DUNGEON_EVENT_DEFS,
    flags:DUNGEON_D2_FLAGS
  };
  `
].join('\n');

const context = {
  console,
  Math,
  Date,
  player:{ hp:100, mhp:100 },
  meta:{ playerName:'測試勇者' }
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2a-bundle.js' });
const api = context.__d2a;

api.setRunSeed(20260722);
const first = api.makeRoomSpec('event', 7, 0);
const again = api.makeRoomSpec('event', 7, 0);
assert.deepStrictEqual(first, again, '同一 seed 的 roomSpec 應完全一致');
assert.strictEqual(first.biomeId, 'cavern');
assert.ok(first.eventId && api.eventDefs[first.eventId], '事件房應在進房前決定有效 eventId');
assert.ok(Array.isArray(first.enemyTags) && first.enemyTags.length > 0);
assert.ok(Array.isArray(first.rewardTags) && first.rewardTags.length > 0);

const branch = api.makeRoomSpec('event', 7, 1);
assert.notStrictEqual(first.seed, branch.seed, '不同分支應使用不同房間 seed');

const platformsA = api.generateDungeonPlatforms(first, 2200);
const platformsB = api.generateDungeonPlatforms(first, 2200);
assert.deepStrictEqual(platformsA, platformsB, '平台配置應可重現');
assert.strictEqual(platformsA[0].x, 0);
assert.strictEqual(platformsA[0].y, 468);
assert.strictEqual(platformsA[0].w, 2200);
assert.strictEqual(platformsA[0].ground, true);
for (const platform of platformsA) {
  assert.ok(platform.x >= 0 && platform.x + platform.w <= 2200.001, '平台不得超出房間邊界');
}
assert.notDeepStrictEqual(platformsA, api.generateDungeonPlatforms(branch, 2200), '不同房間 seed 應產生不同平台配置');

const pool = ['slime', 'bat', 'spore'];
assert.deepStrictEqual(
  api.generateDungeonEnemyTypes(first, pool, 18),
  api.generateDungeonEnemyTypes(first, pool, 18),
  '敵人類型序列應可重現'
);
assert.strictEqual(api.dungeonEventPosition(first, 2200), api.dungeonEventPosition(first, 2200), '事件位置應可重現');

const treasure = api.makeRoomSpec('treasure', 3, 0);
assert.ok(['traveler_chest', 'supply_crate'].includes(treasure.eventId));
assert.strictEqual(api.eventDefs[treasure.eventId].family, 'chest');
assert.strictEqual(treasure.hazardId, null);

const hazardByFloor = [
  [2, 'meadow', 'thorn_roots'],
  [7, 'cavern', 'falling_rocks'],
  [12, 'volcano', 'lava_vents'],
  [17, 'tundra', 'ice_floor'],
  [22, 'void', 'void_platforms'],
  [42, 'void', 'void_platforms']
];
for (const [floor, biomeId, hazardId] of hazardByFloor) {
  const spec = api.makeRoomSpec('hazard', floor, 0);
  assert.strictEqual(spec.biomeId, biomeId);
  assert.strictEqual(spec.hazardId, hazardId);
  assert.ok(api.hazardDefs[spec.hazardId]);
}

api.setRunSeed(99);
const chosenEvent = api.makeRoomSpec('event', 2, 0);
assert.deepStrictEqual(Array.from(api.getRun().eventHistory), []);
api.applyRoomEntry(chosenEvent);
assert.deepStrictEqual(Array.from(api.getRun().eventHistory), [chosenEvent.eventId], '只有實際進入的事件才應寫入歷史');

let hazardChoiceCount = 0;
for (let seed = 1; seed <= 1000; seed++) {
  api.setRunSeed(seed);
  for (let floor = 2; floor <= 4; floor++) {
    const choices = api.generateRouteChoices(floor);
    assert.strictEqual(choices.length, 2);
    assert.notStrictEqual(choices[0].type, choices[1].type);
    assert.ok(choices.some(choice => choice.threat <= 2), '每組路線至少要有一條危險度不高於 2');
    for (const choice of choices) {
      assert.ok(choice.biomeId);
      assert.ok(Array.isArray(choice.enemyTags));
      assert.ok(Array.isArray(choice.rewardTags));
      if (choice.type === 'hazard') {
        hazardChoiceCount++;
        assert.strictEqual(choice.hazardId, 'thorn_roots', '正式路線只能抽到已完成的地形');
      }
    }
  }
}

assert.ok(hazardChoiceCount > 0, 'D2-B 完成後草原路線應能抽到群系險境');
assert.strictEqual(api.flags.hazards, true, 'D2-B 完成後地形總開關應開啟');
console.log('dungeon D2-A smoke test passed');
