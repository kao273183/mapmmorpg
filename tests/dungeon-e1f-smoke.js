const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGameSource } = require('./helpers/game-source');

const context = vm.createContext({
  console,
  Math,
  frame:0,
  espits:[],
  beep:() => {},
  armorDef:() => 0,
  dmgPlayer:() => false
});

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'data.js'), 'utf8');
const bossSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'dungeon', 'bosses.js'), 'utf8');
vm.runInContext(dataSource + `
function dungeonBiomeDef(atFloor) {
  return DUNGEON_BIOME_DEFS[Math.min(DUNGEON_BIOME_DEFS.length - 1, Math.floor((atFloor - 1) / 5))];
}
` + bossSource + `
globalThis.e1fApi = {
  def:DUNGEON_BOSS_DEFS.void_lord,
  create:createDungeonBoss,
  arena:dungeonBossArenaPlatforms,
  sequence:dungeonBossAttackSequence,
  next:dungeonBossNextAttack,
  start:startDungeonBossSpecialAttack,
  updateSpecial:updateDungeonBossSpecialAttack,
  updateEffects:updateDungeonBossEffects,
  clear:clearDungeonBossEffects,
  effects:() => dungeonBossEffects,
  projectiles:() => espits
};`, context);

const api = context.e1fApi;
assert.deepStrictEqual(Array.from(api.def.attackSlots, attack => attack.id), ['void_barrage','platform_erasure']);
assert.ok(api.def.attackSlots.every(attack => attack.implemented));

const boss = api.create(api.def, 25, 1);
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['void_barrage','leap_volley']);
boss.phase = 2;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['void_barrage','leap_volley','platform_erasure']);
boss.phase = 3;
assert.deepStrictEqual(Array.from(api.sequence(boss)), ['void_barrage','platform_erasure','leap_volley']);

const player = { x:420, y:468, w:26, h:48, inv:0 };
const barrageBoss = api.create(api.def, 25, 1);
barrageBoss.phase = 1;
context.espits.length = 0;
assert.strictEqual(api.next(barrageBoss), 'void_barrage');
assert.strictEqual(api.start(barrageBoss, player, 'void_barrage'), true);
for (let i = 0; i < api.def.attackSlots[0].warningFrames; i++) api.updateSpecial(barrageBoss, player);
assert.strictEqual(api.projectiles().length, 5);
assert.ok(api.projectiles().every(bolt => bolt.voidBolt && bolt.sourceName === '深淵魔王的虛空彈幕'));

const phaseTwoBarrage = api.create(api.def, 25, 1); phaseTwoBarrage.phase = 2;
context.espits.length = 0; api.start(phaseTwoBarrage, player, 'void_barrage');
for (let i = 0; i < api.def.attackSlots[0].warningFrames; i++) api.updateSpecial(phaseTwoBarrage, player);
assert.strictEqual(api.projectiles().length, 7);
const finalBarrage = api.create(api.def, 25, 1); finalBarrage.phase = 3;
context.espits.length = 0; api.start(finalBarrage, player, 'void_barrage');
for (let i = 0; i < api.def.attackSlots[0].warningFrames; i++) api.updateSpecial(finalBarrage, player);
assert.strictEqual(api.projectiles().length, 9);

api.clear();
const platforms = api.arena(api.def);
const ground = platforms.find(platform => platform.ground);
const eraseBoss = api.create(api.def, 25, 1); eraseBoss.phase = 2;
assert.strictEqual(api.start(eraseBoss, player, 'platform_erasure', platforms), true);
assert.strictEqual(api.effects().length, 1);
assert.strictEqual(api.effects()[0].state, 'warning');
assert.strictEqual(ground.voidDisabled, undefined, 'stable ground must never be selected for erasure');
const erasedPlatform = api.effects()[0].platform;
for (let i = 0; i < api.def.attackSlots[1].warningFrames; i++) api.updateEffects(player);
assert.strictEqual(erasedPlatform.voidDisabled, true);
assert.strictEqual(erasedPlatform.bossVoidErased, true);
assert.strictEqual(ground.voidDisabled, undefined);
for (let i = 0; i < api.def.attackSlots[1].goneFrames; i++) api.updateEffects(player);
assert.strictEqual(erasedPlatform.voidDisabled, false);
assert.strictEqual(erasedPlatform.bossVoidErased, false);

api.clear();
const finalPlatforms = api.arena(api.def);
const finalEraseBoss = api.create(api.def, 25, 1); finalEraseBoss.phase = 3;
assert.strictEqual(api.start(finalEraseBoss, player, 'platform_erasure', finalPlatforms), true);
assert.strictEqual(api.effects().length, 2);
assert.ok(api.effects().every(effect => !effect.platform.ground));
assert.strictEqual(finalPlatforms.filter(platform => !platform.ground && !platform.bossVoidWarning).length, 1, 'phase three must preserve one elevated platform plus stable ground');
for (let i = 0; i < api.def.attackSlots[1].warningFrames + 11; i++) api.updateEffects(player);
assert.strictEqual(finalPlatforms.filter(platform => platform.voidDisabled).length, 2);
api.clear();
assert.strictEqual(finalPlatforms.filter(platform => platform.voidDisabled).length, 0, 'clearing boss effects must restore erased platforms');

const gameSource = loadGameSource(path.join(__dirname, '..'));
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(gameSource.includes("startDungeonBossSpecialAttack(m, p, nextAttack, plats)"));
for (const mode of ['barrage-active','erase-active','stable','lowfx']) assert.ok(smokeHtml.includes("bossVariant === '" + mode + "'"));

console.log('dungeon E1-F void boss smoke test passed (phase schedule, void barrage, platform erasure, stable ground, restoration)');
