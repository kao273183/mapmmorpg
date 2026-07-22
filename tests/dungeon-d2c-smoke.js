const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'dungeon-data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'dungeon.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'dungeon-hazards.js'), 'utf8'),
  `
  function __setD2cRun(seed) {
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
  function __setD2cSpec(spec) { currentRoomSpec = spec; }
  globalThis.__d2c = {
    makeRoomSpec,
    generateRouteChoices,
    dungeonHazardAvailable,
    generateFallingRockLayout,
    generateLavaVentLayout,
    generateIceFloorLayout,
    generateVoidPlatformLayout,
    spawnDungeonHazards,
    clearDungeonHazards,
    advancePulsingHazard,
    advanceVoidPlatform,
    fallingRockY,
    fallingRockHitsPlayer,
    lavaVentHitsPlayer,
    updateDungeonHazards,
    playerOnIceFloor,
    dungeonHazardMoveVelocity,
    setRun:__setD2cRun,
    setSpec:__setD2cSpec,
    getHazards:() => dungeonHazards,
    defs:DUNGEON_HAZARD_DEFS
  };
  `
].join('\n');

const damageEvents = [];
const context = {
  console,
  Math,
  Date,
  mons:[],
  player:{ x:80, y:468, w:26, h:46, mhp:100, hp:100, inv:0, vy:0, vx:0, onGround:true, hazardSlowT:0 },
  meta:{ playerName:'測試勇者' },
  dmgPlayer:event => { damageEvents.push(event); return false; },
  num:() => {},
  ctx:{},
  frame:0,
  W:960,
  STAT_FONT:'monospace'
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'dungeon-d2c-bundle.js' });
const api = context.__d2c;

const expected = [
  [2, 'thorn_roots'],
  [7, 'falling_rocks'],
  [12, 'lava_vents'],
  [17, 'ice_floor'],
  [22, 'void_platforms']
];
for (const [floor, hazardId] of expected) {
  assert.strictEqual(api.defs[hazardId].implemented, true);
  assert.strictEqual(api.dungeonHazardAvailable(floor), true, '已完成地形應進入對應群系路線池');
  let routeSeen = 0;
  for (let seed = 1; seed <= 300; seed++) {
    api.setRun(seed);
    for (const choice of api.generateRouteChoices(floor)) {
      if (choice.type !== 'hazard') continue;
      routeSeen++;
      assert.strictEqual(choice.hazardId, hazardId, '險境預覽必須使用當前群系的已完成地形');
    }
  }
  assert.ok(routeSeen > 0, '各群系正式路線都應能抽到險境');
}

const groundCases = [
  { floor:7, id:'falling_rocks', generate:api.generateFallingRockLayout, minGap:145 },
  { floor:12, id:'lava_vents', generate:api.generateLavaVentLayout, minGap:150 },
  { floor:17, id:'ice_floor', generate:api.generateIceFloorLayout, minGap:96 }
];
for (const test of groundCases) {
  for (let seed = 1; seed <= 1000; seed++) {
    api.setRun(seed);
    const spec = api.makeRoomSpec('hazard', test.floor, 0);
    const eventX = seed % 2 ? 930 : null;
    const layoutA = test.generate(spec, 2100, eventX);
    const layoutB = test.generate(spec, 2100, eventX);
    assert.deepStrictEqual(layoutA, layoutB, test.id + ' 配置應可重現');
    assert.ok(layoutA.length >= 2 && layoutA.length <= api.defs[test.id].maxPerRoom);
    for (let i = 0; i < layoutA.length; i++) {
      const hazard = layoutA[i];
      assert.ok(hazard.x - hazard.w / 2 >= 180, test.id + ' 不得進入入口保護區');
      assert.ok(hazard.x + hazard.w / 2 <= 1920, test.id + ' 不得進入出口保護區');
      if (eventX != null) assert.ok(Math.abs(hazard.x - eventX) >= hazard.w / 2 + 140, test.id + ' 不得覆蓋事件區');
      for (let j = 0; j < i; j++) {
        const other = layoutA[j];
        assert.ok(Math.abs(hazard.x - other.x) >= hazard.w / 2 + other.w / 2 + test.minGap, test.id + ' 應保留安全帶');
      }
    }
  }
}

const rockDef = api.defs.falling_rocks;
const rock = { type:'falling_rocks', x:500, y:468, w:80, phase:'active', timer:rockDef.activeFrames, hitThisCycle:false };
context.player.x = 500; context.player.y = 468;
assert.ok(api.fallingRockY(rock, rockDef) < 100);
assert.strictEqual(api.fallingRockHitsPlayer(rock, context.player, rockDef), false, '落石仍在高處時不應命中');
rock.timer = 1;
assert.strictEqual(api.fallingRockHitsPlayer(rock, context.player, rockDef), true, '落石接近地面時應命中框內玩家');

api.setRun(77);
const caveSpec = api.makeRoomSpec('hazard', 7, 0);
api.setSpec(caveSpec);
api.getHazards().length = 0;
api.getHazards().push(Object.assign({}, rock, { timer:2, hitThisCycle:false }));
context.player.x = 500; context.player.y = 468; context.player.inv = 0;
damageEvents.length = 0;
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '落石經主更新流程應造成一次傷害');
assert.strictEqual(damageEvents[0].sourceName, '落石區');
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '同一顆落石不得重複傷害');

const vent = { type:'lava_vents', x:500, y:468, w:60 };
assert.strictEqual(api.lavaVentHitsPlayer(vent, context.player), true);
context.player.y = 380;
assert.strictEqual(api.lavaVentHitsPlayer(vent, context.player), false, '跳過火柱高度後不應命中');

api.setRun(78);
const lavaSpec = api.makeRoomSpec('hazard', 12, 0);
api.setSpec(lavaSpec);
api.getHazards().length = 0;
api.getHazards().push(Object.assign({}, vent, { phase:'active', timer:999, hitThisCycle:false }));
context.player.x = 500; context.player.y = 468; context.player.inv = 0; context.player.vy = 0; context.player.onGround = true;
damageEvents.length = 0;
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '熔岩噴口經主更新流程應造成一次傷害');
assert.strictEqual(damageEvents[0].sourceName, '熔岩噴口');
api.updateDungeonHazards();
assert.strictEqual(damageEvents.length, 1, '同一次噴發不得重複傷害');

api.setRun(88);
const iceSpec = api.makeRoomSpec('hazard', 17, 0);
api.setSpec(iceSpec);
api.spawnDungeonHazards(iceSpec, 2100, null, [{ x:0, y:468, w:2100, ground:true }]);
const ice = api.getHazards()[0];
context.player.x = ice.x; context.player.y = 468; context.player.onGround = true; context.player.vx = 2;
assert.strictEqual(api.playerOnIceFloor(context.player), true);
const coast = api.dungeonHazardMoveVelocity(context.player, 0, 2);
assert.ok(coast > 1.9 && coast < 2, '放開方向後應保留滑行慣性');
let velocity = 2;
for (let i = 0; i < 20; i++) {
  context.player.vx = velocity;
  velocity = api.dungeonHazardMoveVelocity(context.player, -1, 2);
}
assert.ok(velocity < 0, '持續反方向輸入應能煞車並反向');
context.player.x = ice.x + ice.w;
assert.strictEqual(api.dungeonHazardMoveVelocity(context.player, -1, 2), -2, '離開冰面後應恢復一般控制');

api.setRun(99);
const voidSpec = api.makeRoomSpec('hazard', 22, 0);
api.setSpec(voidSpec);
const platforms = [
  { x:0, y:468, w:2200, ground:true },
  { x:240, y:405, w:150 },
  { x:620, y:325, w:170 },
  { x:1050, y:405, w:160 },
  { x:1540, y:325, w:170 }
];
const voidLayoutA = api.generateVoidPlatformLayout(voidSpec, platforms);
const voidLayoutB = api.generateVoidPlatformLayout(voidSpec, platforms);
assert.strictEqual(JSON.stringify(voidLayoutA.map(h => [h.x, h.y, h.w])), JSON.stringify(voidLayoutB.map(h => [h.x, h.y, h.w])));
assert.ok(voidLayoutA.length >= 1 && voidLayoutA.length <= api.defs.void_platforms.maxPerRoom);
assert.ok(voidLayoutA.every(h => !h.platform.ground), '虛空地形只能標記高台，地面主路徑必須保留');

api.spawnDungeonHazards(voidSpec, 2200, null, platforms);
const voidHazard = api.getHazards()[0];
assert.strictEqual(voidHazard.platform.voidHazard, true);
voidHazard.phase = 'stable'; voidHazard.timer = 1;
api.advanceVoidPlatform(voidHazard, api.defs.void_platforms);
assert.strictEqual(voidHazard.phase, 'warning');
voidHazard.timer = 1;
context.player.onGround = false;
api.advanceVoidPlatform(voidHazard, api.defs.void_platforms);
assert.strictEqual(voidHazard.phase, 'gone');
assert.strictEqual(voidHazard.platform.voidDisabled, true);
voidHazard.timer = 1;
api.advanceVoidPlatform(voidHazard, api.defs.void_platforms);
assert.strictEqual(voidHazard.phase, 'stable');
assert.strictEqual(voidHazard.platform.voidDisabled, false);
api.clearDungeonHazards();
assert.strictEqual(voidHazard.platform.voidDisabled, false);
assert.strictEqual(voidHazard.platform.voidHazard, false);

console.log('dungeon D2-C smoke test passed');
