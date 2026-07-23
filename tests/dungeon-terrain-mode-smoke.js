// 地形難度「一般 / 複雜」切換 smoke 測試。
// 驗證一般模式會中和移動改變型地形（滑冰、消失平台）、降低陷阱密度與傷害，
// 並確保複雜模式仍保有現行完整地形行為。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = [
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'data.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'bosses.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src', 'dungeon', 'hazards.js'), 'utf8'),
  `
  function __setRun(seed) {
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
  globalThis.__t = {
    makeRoomSpec,
    spawnDungeonHazards,
    clearDungeonHazards,
    advanceVoidPlatform,
    playerOnIceFloor,
    dungeonHazardMoveVelocity,
    damageFromDungeonHazard,
    terrainModeConfig,
    terrainMovementHazardsEnabled,
    terrainHazardMaxPerRoom,
    dungeonBossHpMul,
    dungeonBossDmgMul,
    dungeonHazardChanceMul,
    dungeonRouteTypeWeight,
    createBoss:createDungeonBoss,
    bossForFloor:dungeonBossDefForFloor,
    setTerrainMode,
    getTerrainMode:() => terrainMode,
    getTutorial:() => dungeonHazardTutorial,
    setRun:__setRun,
    setSpec:spec => { currentRoomSpec = spec; },
    getHazards:() => dungeonHazards,
    defs:DUNGEON_HAZARD_DEFS
  };
  `
].join('\n');

const damageEvents = [];
const context = {
  console, Math, Date,
  mons:[],
  player:{ x:80, y:468, w:26, h:46, mhp:1000, hp:1000, inv:0, vy:0, vx:0, onGround:true, hazardSlowT:0 },
  meta:{ playerName:'測試勇者' },
  dmgPlayer:event => { damageEvents.push(event); return false; },
  num:() => {},
  ctx:{}, frame:0, W:960, STAT_FONT:'monospace'
};
vm.createContext(context);
vm.runInContext(source, context, { filename:'terrain-mode-bundle.js' });
const api = context.__t;

// 1. 預設為一般模式。
assert.strictEqual(api.getTerrainMode(), 'normal', '預設地形難度應為一般');
assert.strictEqual(api.terrainMovementHazardsEnabled(), false, '一般模式不啟用移動改變型地形');

// 2. setTerrainMode 正規化與往返。
assert.strictEqual(api.setTerrainMode('complex'), 'complex');
assert.strictEqual(api.terrainMovementHazardsEnabled(), true);
assert.strictEqual(api.setTerrainMode('亂填'), 'normal', '未知值應回退為一般');
assert.strictEqual(api.setTerrainMode('normal'), 'normal');

// 3. 每房陷阱數量：一般少於或等於複雜。
for (const id of ['thorn_roots', 'falling_rocks', 'lava_vents', 'ice_floor', 'void_platforms']) {
  api.setTerrainMode('complex');
  const complexMax = api.terrainHazardMaxPerRoom(api.defs[id]);
  api.setTerrainMode('normal');
  const normalMax = api.terrainHazardMaxPerRoom(api.defs[id]);
  assert.ok(normalMax >= 1, id + ' 一般模式至少保留 1 個陷阱');
  assert.ok(normalMax <= complexMax, id + ' 一般模式陷阱數不應多於複雜模式');
}

// 4. 冰面：一般模式不滑行，複雜模式保留慣性。
api.setRun(88);
const iceSpec = api.makeRoomSpec('hazard', 17, 0);
api.setSpec(iceSpec);
const iceGround = [{ x:0, y:468, w:2100, ground:true }];

api.setTerrainMode('normal');
api.spawnDungeonHazards(iceSpec, 2100, null, iceGround);
let ice = api.getHazards()[0];
context.player.x = ice.x; context.player.y = 468; context.player.onGround = true; context.player.vx = 2;
assert.strictEqual(api.playerOnIceFloor(context.player), false, '一般模式冰面不應觸發滑行');
assert.strictEqual(api.dungeonHazardMoveVelocity(context.player, 0, 2), 0, '一般模式放開方向應立即停止');
assert.strictEqual(api.getTutorial(), null, '一般模式中和的冰面不應顯示操作教學');

api.setTerrainMode('complex');
api.spawnDungeonHazards(iceSpec, 2100, null, iceGround);
ice = api.getHazards()[0];
context.player.x = ice.x; context.player.y = 468; context.player.onGround = true; context.player.vx = 2;
assert.strictEqual(api.playerOnIceFloor(context.player), true, '複雜模式冰面應觸發滑行');
const coast = api.dungeonHazardMoveVelocity(context.player, 0, 2);
assert.ok(coast > 1.9 && coast < 2, '複雜模式放開方向應保留滑行慣性');

// 5. 虛空平台：一般模式維持穩定，複雜模式會消失。
api.setRun(99);
const voidSpec = api.makeRoomSpec('hazard', 22, 0);
api.setSpec(voidSpec);
const platforms = () => [
  { x:0, y:468, w:2200, ground:true },
  { x:240, y:405, w:150 },
  { x:620, y:325, w:170 },
  { x:1050, y:405, w:160 },
  { x:1540, y:325, w:170 }
];

api.setTerrainMode('normal');
api.spawnDungeonHazards(voidSpec, 2200, null, platforms());
let vp = api.getHazards()[0];
assert.ok(vp, '虛空群系一般模式仍應生成平台外觀');
for (let i = 0; i < 5; i++) { vp.timer = 1; api.advanceVoidPlatform(vp, api.defs.void_platforms); }
assert.strictEqual(vp.phase, 'stable', '一般模式虛空平台應恆為穩定');
assert.ok(!vp.platform.voidDisabled, '一般模式虛空平台不得被停用');
assert.strictEqual(api.getTutorial(), null, '一般模式中和的虛空平台不應顯示操作教學');

api.setTerrainMode('complex');
api.spawnDungeonHazards(voidSpec, 2200, null, platforms());
vp = api.getHazards()[0];
vp.phase = 'stable'; vp.timer = 1;
api.advanceVoidPlatform(vp, api.defs.void_platforms);
assert.strictEqual(vp.phase, 'warning', '複雜模式虛空平台應進入預警');
vp.timer = 1; context.player.onGround = false;
api.advanceVoidPlatform(vp, api.defs.void_platforms);
assert.strictEqual(vp.phase, 'gone', '複雜模式虛空平台應消失');
assert.strictEqual(vp.platform.voidDisabled, true);

// 6. 反應型地形（荊棘）在一般模式仍顯示首次教學。
api.setTerrainMode('normal');
api.setRun(3);
const thornSpec = api.makeRoomSpec('hazard', 2, 0);
api.setSpec(thornSpec);
api.spawnDungeonHazards(thornSpec, 2100, null, [{ x:0, y:468, w:2100, ground:true }]);
assert.ok(api.getTutorial() && api.getTutorial().id === 'thorn_roots', '一般模式反應型地形仍應教學');

// 7. 地形傷害：一般模式低於複雜模式（以高 HP 觀察百分比傷害）。
const rockDef = api.defs.falling_rocks;
const measure = mode => {
  api.setTerrainMode(mode);
  damageEvents.length = 0;
  api.damageFromDungeonHazard({ x:100, y:468, hitThisCycle:false }, rockDef, { heavy:true });
  return damageEvents[0].amount;
};
const complexDmg = measure('complex');
const normalDmg = measure('normal');
assert.ok(normalDmg < complexDmg, '一般模式地形傷害應低於複雜模式');

// 8. 難度旋鈕：一般模式降低 Boss 生命與傷害（分開倍率）與險境房出現機率。
api.setTerrainMode('normal');
assert.ok(api.dungeonBossHpMul() < 1, '一般模式 Boss 生命倍率應小於 1');
assert.ok(api.dungeonBossDmgMul() < api.dungeonBossHpMul(), '一般模式 Boss 傷害倍率應比生命倍率更低');
assert.ok(api.dungeonHazardChanceMul() < 1, '一般模式險境機率倍率應小於 1');
assert.ok(api.dungeonRouteTypeWeight('hazard') < api.dungeonRouteTypeWeight('safe'), '一般模式險境權重應被壓低');
const bossDef = api.bossForFloor(5);
const normalBoss = api.createBoss(bossDef, 5, 2);
api.setTerrainMode('complex');
assert.ok(api.dungeonBossHpMul() === 1 && api.dungeonBossDmgMul() === 1 && api.dungeonHazardChanceMul() === 1);
const complexBoss = api.createBoss(bossDef, 5, 2);
assert.ok(normalBoss.hp < complexBoss.hp, '一般模式 Boss 生命應較低');
assert.ok(normalBoss.dmg < complexBoss.dmg, '一般模式 Boss 傷害應較低');
assert.ok(normalBoss.dmg < complexBoss.dmg, '一般模式 Boss 傷害應較低');

api.setTerrainMode('normal');
console.log('dungeon terrain-mode smoke test passed');
