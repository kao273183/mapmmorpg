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

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'data.js'), 'utf8');
const bossSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'bosses.js'), 'utf8');
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  return DUNGEON_BIOME_DEFS[Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5))];
}
` + bossSource + `
globalThis.e1dApi = {
  def:DUNGEON_BOSS_DEFS.volcano_lord,
  create:createDungeonBoss,
  sequence:dungeonBossAttackSequence,
  next:dungeonBossNextAttack,
  start:startDungeonBossSpecialAttack,
  updateSpecial:updateDungeonBossSpecialAttack,
  updateEffects:updateDungeonBossEffects,
  clear:clearDungeonBossEffects,
  effects:() => dungeonBossEffects
};`, context);

const api = context.e1dApi;
assert.deepStrictEqual(Array.from(api.def.attackSlots, attack => attack.id), ['magma_charge','vent_chain']);
assert.ok(api.def.attackSlots.every(attack => attack.implemented));

const boss = api.create(api.def, 15, 1);
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['magma_charge','leap_volley']);
boss.phase = 2;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['magma_charge','leap_volley','vent_chain']);
boss.phase = 3;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['magma_charge','vent_chain','leap_volley']);

const player = { x:650, y:468, w:26, h:48, inv:0, vx:0, vy:0, onGround:true };
const chargeBoss = api.create(api.def, 15, 1);
chargeBoss.x = 900; chargeBoss.phase = 1;
assert.strictEqual(api.next(chargeBoss), 'magma_charge');
assert.strictEqual(api.start(chargeBoss, player, 'magma_charge'), true);
assert.strictEqual(chargeBoss.specialAttack.state, 'warning');
for (let i = 0; i < api.def.attackSlots[0].warningFrames - 1; i++) api.updateSpecial(chargeBoss, player);
assert.strictEqual(damageEvents.length, 0, 'charge warning must not deal damage');
assert.strictEqual(chargeBoss.x, 900, 'boss must stay still during the warning');
for (let i = 0; i < 60 && damageEvents.length === 0; i++) api.updateSpecial(chargeBoss, player);
assert.ok(chargeBoss.x < 900, 'charge must move toward its telegraphed endpoint');
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '熔岩魔王的熔岩衝鋒');

api.clear(); damageEvents.length = 0;
const ventBoss = api.create(api.def, 15, 1);
ventBoss.phase = 2;
player.x = 150; player.y = 468; player.inv = 0;
assert.strictEqual(api.start(ventBoss, player, 'vent_chain'), true);
assert.strictEqual(api.effects().length, 4);
assert.ok(api.effects().every(effect => effect.type === 'volcano_vent' && effect.state === 'warning'));
const orderedVents = api.effects().slice().sort((a, b) => a.x - b.x);
for (let i = 1; i < orderedVents.length; i++) {
  assert.ok(orderedVents[i].x - orderedVents[i - 1].x > orderedVents[i].w, 'vent chain must preserve a passable gap');
}
player.x = api.effects()[0].x;
for (let i = 0; i < api.def.attackSlots[1].warningFrames + 2; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, 1);
assert.strictEqual(damageEvents[0].sourceName, '熔岩魔王的連鎖噴發');
const firstVent = api.effects()[0];
for (let i = 0; i < api.def.attackSlots[1].activeFrames + 1; i++) api.updateEffects(player);
assert.strictEqual(firstVent.state, 'cooldown');
const damageAtCooldown = damageEvents.length;
for (let i = 0; i < 12; i++) api.updateEffects(player);
assert.strictEqual(damageEvents.length, damageAtCooldown, 'cooled vents are a damage-free safety window');

api.clear();
const finalVentBoss = api.create(api.def, 15, 1);
finalVentBoss.phase = 3;
assert.strictEqual(api.start(finalVentBoss, player, 'vent_chain'), true);
assert.strictEqual(api.effects().length, 6);

const gameSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes("const GAME_VERSION = '0.29.6'"));
for (const mode of ['charge-active','vent-active','vent-safe','lowfx']) assert.ok(smokeHtml.includes("bossVariant === '" + mode + "'"));

console.log('dungeon E1-D volcano boss smoke test passed (phase schedule, magma charge, vent chain, safety windows, source labels)');
