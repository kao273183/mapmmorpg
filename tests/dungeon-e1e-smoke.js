const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const damageEvents = [];
const context = vm.createContext({
  console,
  Math,
  frame:0,
  espits:[],
  beep:() => {},
  armorDef:() => 0,
  dmgPlayer:event => { damageEvents.push(event); return false; }
});

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon-data.js'), 'utf8');
const bossSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon-bosses.js'), 'utf8');
const hazardSource = fs.readFileSync(path.join(__dirname, '..', 'dungeon-hazards.js'), 'utf8');
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  return DUNGEON_BIOME_DEFS[Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5))];
}
` + bossSource + hazardSource + `
globalThis.e1eApi = {
  def:DUNGEON_BOSS_DEFS.tundra_lord,
  create:createDungeonBoss,
  sequence:dungeonBossAttackSequence,
  next:dungeonBossNextAttack,
  start:startDungeonBossSpecialAttack,
  updateSpecial:updateDungeonBossSpecialAttack,
  updateEffects:updateDungeonBossEffects,
  clear:clearDungeonBossEffects,
  onBossIce:playerOnDungeonBossIce,
  moveVelocity:dungeonHazardMoveVelocity,
  effects:() => dungeonBossEffects
};`, context);

const api = context.e1eApi;
assert.deepStrictEqual(Array.from(api.def.attackSlots, attack => attack.id), ['ice_lance','blizzard_dash']);
assert.ok(api.def.attackSlots.every(attack => attack.implemented));

const boss = api.create(api.def, 20, 1);
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['ice_lance','leap_volley']);
boss.phase = 2;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['ice_lance','leap_volley','blizzard_dash']);
boss.phase = 3;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['ice_lance','blizzard_dash','leap_volley']);

const player = { x:460, y:468, w:26, h:48, inv:0, vx:0, vy:0, onGround:true, chillT:0 };
const lanceBoss = api.create(api.def, 20, 1);
lanceBoss.phase = 1;
assert.strictEqual(api.next(lanceBoss), 'ice_lance');
assert.strictEqual(api.start(lanceBoss, player, 'ice_lance'), true);
assert.strictEqual(api.effects().length, 3);
assert.ok(api.effects().every(effect => effect.type === 'tundra_lance' && effect.state === 'warning'));
player.x = api.effects()[0].x;
for (let i = 0; i < api.def.attackSlots[0].warningFrames - 1; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 0, 'ice lance warning must not deal damage');
for (let i = 0; i < 2; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '冰霜領主的寒冰槍陣');
assert.ok(player.chillT >= 60);

api.clear();
const phaseTwoLance = api.create(api.def, 20, 1); phaseTwoLance.phase = 2;
assert.strictEqual(api.start(phaseTwoLance, player, 'ice_lance'), true);
assert.strictEqual(api.effects().length, 5);
api.clear();
const finalLance = api.create(api.def, 20, 1); finalLance.phase = 3;
assert.strictEqual(api.start(finalLance, player, 'ice_lance'), true);
assert.strictEqual(api.effects().length, 7);

api.clear(); damageEvents.length = 0;
const dashBoss = api.create(api.def, 20, 1);
dashBoss.x = 900; dashBoss.phase = 2;
player.x = 650; player.y = 468; player.inv = 0; player.onGround = true; player.chillT = 0;
assert.strictEqual(api.start(dashBoss, player, 'blizzard_dash'), true);
assert.strictEqual(dashBoss.specialAttack.state, 'warning');
for (let i = 0; i < api.def.attackSlots[1].warningFrames - 1; i++) api.updateSpecial(dashBoss, player);
assert.strictEqual(dashBoss.x, 900, 'boss must stay still during blizzard dash warning');
assert.strictEqual(api.effects().length, 0);
api.updateSpecial(dashBoss, player);
assert.strictEqual(dashBoss.specialAttack.state, 'active');
assert.strictEqual(api.effects().length, 1);
assert.strictEqual(api.effects()[0].type, 'tundra_ice');
assert.strictEqual(api.onBossIce(player), true);
for (let i = 0; i < 70 && damageEvents.length === 0; i++) api.updateSpecial(dashBoss, player);
assert.ok(dashBoss.x < 900);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '冰霜領主的暴風突進');

player.onGround = true; player.x = 650; player.y = 468; player.vx = 2;
const coast = api.moveVelocity(player, 0, 2);
assert.ok(coast > 1.9 && coast < 2, 'boss ice must preserve sliding momentum');
let velocity = 2;
for (let i = 0; i < 20; i++) {
  player.vx = velocity;
  velocity = api.moveVelocity(player, -1, 2);
}
assert.ok(velocity < 0, 'reverse input must brake and reverse on boss ice');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes("const GAME_VERSION = '0.29.6'"));
for (const mode of ['lance-active','dash-active','ice','lowfx']) assert.ok(smokeHtml.includes("bossVariant === '" + mode + "'"));

console.log('dungeon E1-E tundra boss smoke test passed (phase schedule, ice lance, blizzard dash, ice braking, source labels)');
