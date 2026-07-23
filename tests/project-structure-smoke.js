const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { GAME_SOURCE_FILES } = require('./helpers/game-source');

const root = path.resolve(__dirname, '..');
const requiredSources = [
  'src/data/tiles.js',
  'src/data/items.js',
  'src/dungeon/data.js',
  'src/dungeon/bosses.js',
  'src/dungeon/balance.js',
  'src/dungeon/core.js',
  'src/dungeon/modifiers.js',
  'src/dungeon/hazards.js',
  'src/dungeon/events.js',
  'src/dungeon/trials.js',
  'src/dungeon/ui.js',
  'src/mobile.js',
  ...GAME_SOURCE_FILES
];
for (const source of requiredSources) assert.ok(fs.existsSync(path.join(root, source)), source + ' should exist');
assert.ok(!fs.existsSync(path.join(root, 'src', 'game.js')), 'the split game monolith should not return');

const requiredAssets = [
  'assets/README.md',
  'assets/runtime/audio/LICENSE.md',
  'assets/runtime/skills/LICENSE.md',
  'assets/runtime/audio/sfx/sword_swing.ogg',
  'assets/runtime/equipment/weapons and armor/sword - wood.png',
  'assets/runtime/equipment/items/amulet 1.png',
  'assets/runtime/skills/icons/normal/11 Icon.png',
  'assets/runtime/skills/icons/gray/11 Icon.png',
  'assets/runtime/skills/vfx/1.png',
  'assets/source/item-library/weapon',
  'assets/source/kenney-rpg-urban-pack/License.txt',
  'assets/source/itemsheet.png'
];
for (const asset of requiredAssets) assert.ok(fs.existsSync(path.join(root, asset)), asset + ' should exist');

for (const retiredAssetRoot of ['audio', 'item', 'Skill', 'kenney_rpg-urban-pack', 'itemsheet.png']) {
  assert.ok(!fs.existsSync(path.join(root, retiredAssetRoot)), retiredAssetRoot + ' should not return to the project root');
}

const bootstrapSource = fs.readFileSync(path.join(root, 'src/game/bootstrap.js'), 'utf8');
for (const runtimeRoot of [
  'assets/runtime/audio/sfx/',
  'assets/runtime/equipment/',
  'assets/runtime/skills/icons/',
  'assets/runtime/skills/vfx/'
]) {
  assert.ok(bootstrapSource.includes(runtimeRoot), runtimeRoot + ' should be wired into the game runtime');
}
for (const retiredAssetPath of ["'audio/", "'item/", "'Skill/"]) {
  assert.ok(!bootstrapSource.includes(retiredAssetPath), retiredAssetPath + ' should not remain in the game runtime');
}

const retiredRootSources = [
  'tiles.js', 'items.js', 'dungeon-data.js', 'dungeon-bosses.js', 'dungeon-balance.js', 'dungeon.js',
  'dungeon-hazards.js', 'dungeon-events.js', 'dungeon-trials.js', 'dungeon-ui.js', 'mobile.js', 'game.js'
];
for (const source of retiredRootSources) assert.ok(!fs.existsSync(path.join(root, source)), source + ' should not return to the project root');

function scriptSources(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  return Array.from(html.matchAll(/<script src="([^"?]+)(?:\?[^\"]*)?"><\/script>/g), match => match[1]);
}

// 版號以 GAME_VERSION 為單一真相，驗證各處資源與之一致（版本無關，bump 後自動跟上）。
const interfaceSource = fs.readFileSync(path.join(root, 'src/game/interface.js'), 'utf8');
const gvMatch = interfaceSource.match(/const GAME_VERSION = '([^']+)';/);
assert.ok(gvMatch, 'GAME_VERSION should be defined in interface.js');
const releaseVersion = gvMatch[1];
function releaseResourceVersions(file) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  return Array.from(html.matchAll(/(?:style\.css|src\/(?:dungeon\/[^"?]+|game\/[^"?]+|mobile\.js))\?v=([^"&]+)/g), match => match[1]);
}
for (const entry of ['index.html', 'tests/dungeon-smoke.html']) {
  const versions = releaseResourceVersions(entry);
  assert.ok(versions.length > 0, entry + ' should contain versioned release resources');
  assert.ok(versions.every(version => version === releaseVersion), entry + ' release resources should all match GAME_VERSION v' + releaseVersion);
}

const sharedOrder = [
  'src/data/tiles.js',
  'src/data/items.js',
  'src/dungeon/data.js',
  'src/dungeon/bosses.js',
  'src/dungeon/balance.js',
  'src/dungeon/core.js',
  'src/dungeon/modifiers.js',
  'src/dungeon/hazards.js',
  'src/dungeon/events.js',
  'src/dungeon/trials.js',
  'src/dungeon/ui.js'
];
const indexScripts = scriptSources('index.html');
const smokeScripts = scriptSources('tests/dungeon-smoke.html');
assert.deepStrictEqual(indexScripts.slice(0, sharedOrder.length), sharedOrder);
assert.deepStrictEqual(smokeScripts.slice(0, sharedOrder.length), sharedOrder);
assert.deepStrictEqual(indexScripts.slice(sharedOrder.length), ['src/mobile.js', ...GAME_SOURCE_FILES, 'src/pwa.js', 'src/install.js']);
assert.deepStrictEqual(smokeScripts.slice(sharedOrder.length), GAME_SOURCE_FILES);

console.log('project structure smoke test passed (src/assets layout, browser order, release version)');
