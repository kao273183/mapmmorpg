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
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  return DUNGEON_BIOME_DEFS[Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5))];
}
` + bossSource + `
globalThis.e1cApi = {
  def:DUNGEON_BOSS_DEFS.cavern_lord,
  create:createDungeonBoss,
  sequence:dungeonBossAttackSequence,
  next:dungeonBossNextAttack,
  start:startDungeonBossSpecialAttack,
  updateSpecial:updateDungeonBossSpecialAttack,
  updateEffects:updateDungeonBossEffects,
  clear:clearDungeonBossEffects,
  shelves:cavernRockShelves,
  effects:() => dungeonBossEffects
};`, context);

const api = context.e1cApi;
assert.deepStrictEqual(Array.from(api.def.attackSlots, attack => attack.id), ['marked_rockfall','cavern_shockwave']);
assert.ok(api.def.attackSlots.every(attack => attack.implemented));

const boss = api.create(api.def, 10, 1);
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['marked_rockfall','leap_volley']);
boss.phase = 2;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['marked_rockfall','leap_volley','cavern_shockwave']);
boss.phase = 3;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['marked_rockfall','cavern_shockwave','leap_volley']);

const player = { x:430, y:468, w:26, h:48, inv:0, vx:0, vy:0 };
boss.phase = 1;
assert.strictEqual(api.next(boss), 'marked_rockfall');
assert.strictEqual(api.start(boss, player, 'marked_rockfall'), true);
assert.strictEqual(api.effects().length, 2);
assert.ok(api.effects().every(effect => effect.type === 'cavern_rockfall' && effect.state === 'warning'));
const shelves = api.shelves(boss);
assert.ok(api.effects().every(effect => !shelves.some(shelf => effect.x >= shelf.x && effect.x <= shelf.x + shelf.w)), 'rockfall must leave every shelf as a readable safe zone');
player.x = api.effects()[0].x;
for (let i = 0; i < 88; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '洞窟領主的落石標記');

api.clear(); damageEvents.length = 0;
const safeBoss = api.create(api.def, 10, 1);
safeBoss.phase = 2;
assert.strictEqual(api.start(safeBoss, player, 'marked_rockfall'), true);
assert.strictEqual(api.effects().length, 3);
player.x = api.effects()[0].x; player.y = 405;
for (let i = 0; i < 100; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 0, 'a player standing on a rock shelf must be safe from marked rockfall');

api.clear();
const finalPhaseBoss = api.create(api.def, 10, 1);
finalPhaseBoss.phase = 3; player.y = 468;
assert.strictEqual(api.start(finalPhaseBoss, player, 'marked_rockfall'), true);
assert.strictEqual(api.effects().length, 4);

api.clear(); damageEvents.length = 0;
const waveBoss = api.create(api.def, 10, 1);
waveBoss.x = 650; waveBoss.phase = 2;
player.x = 720; player.y = 468; player.inv = 0;
assert.strictEqual(api.start(waveBoss, player, 'cavern_shockwave'), true);
for (let i = 0; i < api.def.attackSlots[1].warningFrames; i++) api.updateSpecial(waveBoss, player);
assert.strictEqual(api.effects().length, 2);
assert.ok(api.effects().every(effect => effect.type === 'cavern_wave'));
for (let i = 0; i < 12 && damageEvents.length === 0; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '洞窟領主的洞窟衝擊波');

api.clear(); damageEvents.length = 0;
const shelfWaveBoss = api.create(api.def, 10, 1);
shelfWaveBoss.x = 650; shelfWaveBoss.phase = 2;
player.x = 720; player.y = 405; player.inv = 0;
assert.strictEqual(api.start(shelfWaveBoss, player, 'cavern_shockwave'), true);
for (let i = 0; i < api.def.attackSlots[1].warningFrames; i++) api.updateSpecial(shelfWaveBoss, player);
for (let i = 0; i < 18; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 0, 'rock shelves must protect against the ground shockwave');

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes("const GAME_VERSION = '0.29.2'"));
for (const mode of ['rock-active','wave-active','lowfx']) assert.ok(smokeHtml.includes("bossVariant === '" + mode + "'"));

console.log('dungeon E1-C cavern boss smoke test passed (phase schedule, marked rockfall, shelf safety, shockwave, source labels)');
