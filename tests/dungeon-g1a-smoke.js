const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = { console };
vm.createContext(context);
const source = [
  fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8'),
  fs.readFileSync(path.join(root, 'src/dungeon/modifiers.js'), 'utf8'),
  `this.api = {
    validate:validateDungeonModifierDefinitions,
    create:createDungeonModifierRunState,
    begin:beginDungeonModifierOffer,
    reroll:rerollDungeonModifierOffer,
    accept:acceptDungeonModifierOffer,
    decline:declineDungeonModifierOffer,
    snapshot:snapshotDungeonModifierState,
    schema:DUNGEON_MODIFIER_SCHEMA_VERSION,
    rerolls:DUNGEON_MODIFIER_REROLLS_PER_RUN
  };`
].join('\n');
vm.runInContext(source, context);
const api = context.api;

function blessing(index, minChapter = 1) {
  return {
    id:'blessing_' + index, kind:'blessing', name:'祝福 ' + index, summary:'祝福效果 ' + index,
    minChapter, weight:index % 3 + 1, effect:{ type:'test', value:index, label:'效果 +' + index }
  };
}
function curse(index, minChapter = 1) {
  return {
    id:'curse_' + index, kind:'curse', name:'詛咒 ' + index, summary:'風險與收益 ' + index,
    minChapter, weight:index % 3 + 1,
    risk:{ type:'test-risk', value:index, label:'風險 +' + index },
    reward:{ type:'test-reward', value:index, label:'收益 +' + index }
  };
}
const blessings = Object.fromEntries(Array.from({ length:8 }, (_, i) => {
  const def = blessing(i + 1, i >= 5 ? 2 : 1); return [def.id, def];
}));
const curses = Object.fromEntries(Array.from({ length:8 }, (_, i) => {
  const def = curse(i + 1, i >= 6 ? 3 : 1); return [def.id, def];
}));

const validation = api.validate(blessings, curses);
assert.strictEqual(validation.ok, true);
const badCurse = curse(99); delete badCurse.reward;
const invalid = api.validate(blessings, { bad:badCurse });
assert.strictEqual(invalid.ok, false);
assert.ok(invalid.issues.includes('curse_99:missing-reward'), 'curse definitions must disclose a paired reward');

const stateA = api.create(12345);
const stateB = api.create(12345);
assert.strictEqual(stateA.schemaVersion, api.schema);
assert.strictEqual(stateA.rerollsRemaining, api.rerolls);
const offerA = api.begin(stateA, 'blessing', { floor:3, chapter:1 }, blessings);
const offerB = api.begin(stateB, 'blessing', { floor:3, chapter:1 }, blessings);
assert.deepStrictEqual(offerA, offerB, 'same run seed and offer context must reproduce the same options');
assert.strictEqual(offerA.options.length, 3);
assert.strictEqual(new Set(offerA.options).size, 3);
assert.ok(offerA.options.every(id => blessings[id].minChapter <= 1), 'chapter-locked modifiers must stay out of early offers');

const acceptedId = offerA.options[0];
const accepted = api.accept(stateA, acceptedId);
assert.strictEqual(accepted.status, 'accepted');
assert.strictEqual(JSON.stringify(stateA.activeBlessings), JSON.stringify([acceptedId]));
const secondOffer = api.begin(stateA, 'blessing', { floor:4, chapter:2 }, blessings);
assert.ok(secondOffer && !secondOffer.options.includes(acceptedId), 'active modifiers must not be offered twice');
assert.strictEqual(api.accept(stateA, 'not-an-option').ok, false);
assert.strictEqual(stateA.pending.id, secondOffer.id, 'invalid choices must leave the offer open');
assert.strictEqual(api.decline(stateA).status, 'declined');
assert.strictEqual(stateA.declines, 1);
assert.strictEqual(JSON.stringify(stateA.activeBlessings), JSON.stringify([acceptedId]), 'safe decline must not change active modifiers');

const curseState = api.create(777);
const curseOffer = api.begin(curseState, 'curse', { floor:7, chapter:3 }, curses);
const firstOptions = curseOffer.options.slice();
const firstReroll = api.reroll(curseState, curses);
assert.ok(firstReroll);
assert.notDeepStrictEqual(firstReroll.options, firstOptions);
assert.strictEqual(curseState.rerollsRemaining, 1);
const secondReroll = api.reroll(curseState, curses);
assert.ok(secondReroll);
assert.strictEqual(curseState.rerollsRemaining, 0);
assert.strictEqual(curseState.rerollsSpent, 2);
assert.strictEqual(api.reroll(curseState, curses), null, 'rerolls must be capped per run');
const curseAccepted = api.accept(curseState, secondReroll.options[0]);
assert.strictEqual(curseAccepted.kind, 'curse');
assert.strictEqual(curseState.activeCurses.length, 1);

const snapshot = api.snapshot(curseState);
snapshot.activeCurses.push('mutated-copy');
snapshot.history[0].modifierId = 'mutated-copy';
assert.strictEqual(curseState.activeCurses.length, 1, 'export snapshots must not expose mutable run arrays');
assert.notStrictEqual(curseState.history[0].modifierId, 'mutated-copy');

const coreSource = fs.readFileSync(path.join(root, 'src/dungeon/core.js'), 'utf8');
const smokeHtml = fs.readFileSync(path.join(__dirname, 'dungeon-smoke.html'), 'utf8');
assert.ok(coreSource.includes('modifierState:typeof createDungeonModifierRunState'));
assert.ok(smokeHtml.includes("mode === 'modifier-state'"));

console.log('dungeon G1-A modifier foundation smoke test passed (schema, seed, offers, rerolls, decline, snapshot)');
