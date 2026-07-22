const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredSources = [
  'src/data/tiles.js',
  'src/data/items.js',
  'src/dungeon/data.js',
  'src/dungeon/bosses.js',
  'src/dungeon/balance.js',
  'src/dungeon/core.js',
  'src/dungeon/hazards.js',
  'src/dungeon/events.js',
  'src/dungeon/trials.js',
  'src/dungeon/ui.js',
  'src/mobile.js',
  'src/game.js'
];
for (const source of requiredSources) assert.ok(fs.existsSync(path.join(root, source)), source + ' should exist');

const retiredRootSources = [
  'tiles.js', 'items.js', 'dungeon-data.js', 'dungeon-bosses.js', 'dungeon-balance.js', 'dungeon.js',
  'dungeon-hazards.js', 'dungeon-events.js', 'dungeon-trials.js', 'dungeon-ui.js', 'mobile.js', 'game.js'
];
for (const source of retiredRootSources) assert.ok(!fs.existsSync(path.join(root, source)), source + ' should not return to the project root');

function scriptSources(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  return Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^\"]*)?"><\/script>/g), match => match[1]);
}

const sharedOrder = [
  'src/data/tiles.js',
  'src/data/items.js',
  'src/dungeon/data.js',
  'src/dungeon/bosses.js',
  'src/dungeon/balance.js',
  'src/dungeon/core.js',
  'src/dungeon/hazards.js',
  'src/dungeon/events.js',
  'src/dungeon/trials.js',
  'src/dungeon/ui.js'
];
const indexScripts = scriptSources('index.html');
const smokeScripts = scriptSources('tests/dungeon-smoke.html');
assert.deepStrictEqual(indexScripts.slice(0, sharedOrder.length), sharedOrder);
assert.deepStrictEqual(smokeScripts.slice(0, sharedOrder.length), sharedOrder);
assert.deepStrictEqual(indexScripts.slice(-2), ['src/mobile.js', 'src/game.js']);
assert.strictEqual(smokeScripts[smokeScripts.length - 1], 'src/game.js');

console.log('project structure smoke test passed (src layout and browser script order)');
