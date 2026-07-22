const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGameSource } = require('./helpers/game-source');

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

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'data.js'), 'utf8');
const bossSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'bosses.js'), 'utf8');
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  return DUNGEON_BIOME_DEFS[Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5))];
}
` + bossSource + `
globalThis.e1bApi = {
  def:DUNGEON_BOSS_DEFS.meadow_lord,
  create:createDungeonBoss,
  sequence:dungeonBossAttackSequence,
  next:dungeonBossNextAttack,
  start:startDungeonBossSpecialAttack,
  updateSpecial:updateDungeonBossSpecialAttack,
  updateEffects:updateDungeonBossEffects,
  clear:clearDungeonBossEffects,
  effects:() => dungeonBossEffects,
  projectiles:() => espits
};`, context);

const api = context.e1bApi;
assert.strictEqual(api.def.attackSlots[0].id, 'root_sweep');
assert.strictEqual(api.def.attackSlots[1].id, 'seed_burst');
assert.ok(api.def.attackSlots.every(attack => attack.implemented));

const boss = api.create(api.def, 5, 1);
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['root_sweep','leap_volley']);
boss.phase = 2; boss.attackCycle = 0;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['root_sweep','leap_volley','seed_burst']);
boss.phase = 3;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['root_sweep','seed_burst','leap_volley']);

const player = { x:80, y:468, w:26, h:48, inv:0, hazardSlowT:0 };
boss.phase = 1; boss.attackCycle = 0;
assert.strictEqual(api.next(boss), 'root_sweep');
assert.strictEqual(api.start(boss, player, 'root_sweep'), true);
assert.strictEqual(api.effects().length, 2);
assert.ok(api.effects().every(effect => effect.state === 'warning'));
player.x = api.effects()[0].x;
for (let i = 0; i < 46; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '草原領主的根鬚橫掃');
assert.ok(player.hazardSlowT >= 60);

api.clear(); damageEvents.length = 0;
const phaseTwoBoss = api.create(api.def, 5, 1);
phaseTwoBoss.phase = 2;
assert.strictEqual(api.start(phaseTwoBoss, player, 'root_sweep'), true);
assert.strictEqual(api.effects().length, 3);
player.x = api.effects()[0].x; player.inv = 1;
for (let i = 0; i < 65; i++) api.updateEffects(player);
assert.strictEqual(api.effects()[0].state, 'thorns');
player.hazardSlowT = 0; api.updateEffects(player);
assert.ok(player.hazardSlowT > 0, 'lingering thorns should slow without dealing a second hit');

const seedBoss = api.create(api.def, 5, 1);
seedBoss.phase = 2; seedBoss.attackCycle = 0;
context.espits.length = 0;
assert.strictEqual(api.start(seedBoss, player, 'seed_burst'), true);
for (let i = 0; i < api.def.attackSlots[1].warningFrames; i++) api.updateSpecial(seedBoss, player);
assert.strictEqual(api.projectiles().length, 5);
assert.ok(api.projectiles().every(seed => seed.seed && seed.sourceName === '草原領主的種子彈幕'));

const gameSource = loadGameSource(path.join(__dirname, '..'));
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes('updateDungeonBossEffects(p)'));
assert.ok(gameSource.includes('drawDungeonBossEffects()'));
assert.ok(gameSource.includes('drawDungeonBossSprite(m)'));
for (const mode of ['root-active','thorns','seed-active','lowfx']) assert.ok(smokeHtml.includes("bossVariant === '" + mode + "'"));

console.log('dungeon E1-B meadow boss smoke test passed (phase schedule, root sweep, thorns, seed burst, source labels)');
