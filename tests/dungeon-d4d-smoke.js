// D4-D smoke 測試：一個群系可掛多種險境，以及三種新地形（毒氣／間歇泉／強風帶）。
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const live = src => src.replace(/(^|[^:'"])\/\/.*$/gm, '$1'); // 去註解：避免「被註解掉」仍通過比對
const dataSrc = read('src', 'dungeon', 'data.js');
const coreSrc = read('src', 'dungeon', 'core.js');
const hazSrc = read('src', 'dungeon', 'hazards.js');

// ── 1. 一個群系可掛多種險境 ───────────────────────────────────────────────
const biomeBlock = dataSrc.match(/const DUNGEON_BIOME_DEFS = \[[\s\S]*?\n\];/)[0];
const biomes = [...biomeBlock.matchAll(/\{ id:'(\w+)'[^}]*hazardId:'(\w+)'(?:, hazardIds:\[([^\]]*)\])?/g)]
  .map(m => ({ id:m[1], primary:m[2], pool:(m[3] || '').split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean) }));
assert.strictEqual(biomes.length, 5, '應有五個群系');
for (const b of biomes) {
  assert.ok(b.pool.length >= 1, b.id + ' 缺少 hazardIds');
  assert.ok(b.pool.indexOf(b.primary) >= 0, b.id + ' 的 hazardIds 應包含預設的 hazardId（' + b.primary + '）');
}
assert.ok(biomes.some(b => b.pool.length >= 2), '至少要有群系掛到兩種以上險境，否則等於沒有多樣化');

// 每個已定義且 implemented 的險境都要掛在某個群系上，否則永遠不會出現
const hazBlock = dataSrc.match(/const DUNGEON_HAZARD_DEFS = \{[\s\S]*?\n\};/)[0];
const hazardIds = [...hazBlock.matchAll(/\n  (\w+): \{/g)].map(m => m[1]);
const pooled = new Set(biomes.flatMap(b => b.pool));
for (const id of hazardIds) {
  const implemented = new RegExp("id:'" + id + "'[\\s\\S]{0,220}implemented:true").test(hazBlock);
  if (implemented) assert.ok(pooled.has(id), id + ' 已完成卻沒掛在任何群系的險境池上，永遠不會出現');
}

// 挑選必須由房間種子推導（固定種子要能重現），且不得用 Math.random
const pick = live(coreSrc).match(/const pickHazard = [\s\S]*?;\n/);
assert.ok(pick, 'core.js 應有依房間種子挑險境的 pickHazard');
assert.ok(/dungeonRng\(/.test(pick[0]), '險境挑選必須走 dungeonRng（固定種子可重現）');
assert.ok(!/Math\.random/.test(pick[0]), '險境挑選不得用 Math.random');
// 地形試煉也要走同一個挑選，否則會綁到跟房間不同的險境
assert.ok(/if \(eventId === 'hazard_trial'\) hazardId = pickHazard\(\);/.test(live(coreSrc)),
  '地形試煉應與房間走同一個險境挑選');
// 可用性判定要涵蓋整個池
assert.ok(/ids\.some\(id => \{ const def = DUNGEON_HAZARD_DEFS\[id\]/.test(live(coreSrc)),
  'dungeonHazardAvailable 應檢查整個險境池，而不是只看預設那一個');

// ── 2. 新地形四件套：定義／佈局／更新／繪製 ───────────────────────────────
const NEW_HAZARDS = ['poison_gas', 'geyser', 'wind_zone'];
for (const id of NEW_HAZARDS) {
  assert.ok(new RegExp("\\n  " + id + ": \\{").test(hazBlock), id + ' 缺少 DUNGEON_HAZARD_DEFS 定義');
  assert.ok(new RegExp("implemented:true").test(hazBlock.match(new RegExp(id + ": \\{[\\s\\S]*?\\n  \\}"))[0]),
    id + ' 應標記 implemented');
  assert.ok(new RegExp("tutorial:'[^']+'").test(hazBlock.match(new RegExp(id + ": \\{[\\s\\S]*?\\n  \\}"))[0]),
    id + ' 應有教學文字（第一次遇到要說明怎麼應對）');
  assert.ok(new RegExp("spec\\.hazardId === '" + id + "'").test(live(hazSrc)), id + ' 缺少生成分派');
  assert.ok(new RegExp("hazard\\.type === '" + id + "'").test(live(hazSrc)), id + ' 缺少繪製或更新分派');
  assert.ok(pooled.has(id), id + ' 沒掛進任何群系的險境池');
}

// ── 3. 各自的關鍵行為 ─────────────────────────────────────────────────────
// 毒氣是持續傷害：不能被 hitThisCycle 卡成一個循環只吃一次
const dmgFn = live(hazSrc).match(/function damageFromDungeonHazard\(hazard, def, options\) \{[\s\S]*?\n\}/)[0];
assert.ok(/if \(!o\.noConsume\) hazard\.hitThisCycle = true;/.test(dmgFn),
  '持續傷害型地形需要 noConsume，否則毒氣一個循環只會扣一次血');
const updFn = live(hazSrc).match(/function updateDungeonHazards\(\) \{[\s\S]*?\n\}/)[0];
assert.ok(/noConsume:true/.test(updFn), '毒氣應以 noConsume 呼叫傷害');
assert.ok(/hazard\.tick >= \(def\.tickFrames/.test(updFn), '毒氣應有自己的 tick 節奏，而不是每幀扣血');
// 間歇泉要把玩家彈起
assert.ok(/launch:def\.launch/.test(updFn), '間歇泉應套用 launch（把玩家彈起才是它的特色）');
assert.ok(/launch:-\d+/.test(hazBlock), '間歇泉的 launch 應為負值（往上）');
// 強風帶屬於「改變移動規則」型 → 一般模式必須中和
assert.ok(/hazardId === 'wind_zone'/.test(live(dataSrc).match(/function terrainHazardIsMovementType[\s\S]*?\n\}/)[0]),
  '強風帶會改變移動規則，必須列為移動改變型（一般模式才會中和）');
const windFn = live(hazSrc).match(/function playerInWindZone\(p\) \{[\s\S]*?\n\}/)[0];
assert.ok(/if \(!terrainMovementHazardsEnabled\(\)\) return 0;/.test(windFn),
  '強風在一般模式必須回傳 0（中和）');
assert.ok(/hazard\.phase !== 'active'/.test(windFn), '強風只在 active 相位推人');
// 推力要接在既有的移動掛勾上，且空中也要吃得到
const moveFn = live(hazSrc).match(/function dungeonHazardMoveVelocity\(p, moveDirection, speed\) \{[\s\S]*?\n\}/)[0];
assert.ok(/playerInWindZone\(p\)/.test(moveFn), '強風推力應接在 dungeonHazardMoveVelocity');
assert.ok((moveFn.match(/wind \* speed/g) || []).length >= 3,
  '冰面與非冰面、按鍵與滑行三條路徑都要加上風力，否則某些狀態下風會失效');

// ── 4. 可讀性：預警與範圍在低特效下仍看得見 ──────────────────────────────
for (const [id, fn] of [['poison_gas', 'drawPoisonGas'], ['geyser', 'drawGeyser'], ['wind_zone', 'drawWindZone']]) {
  const block = live(hazSrc).match(new RegExp("function " + fn + "\\(hazard\\) \\{[\\s\\S]*?\\n\\}"));
  assert.ok(block, id + ' 缺少繪製函式 ' + fn);
  assert.ok(/hazard\.phase === 'warning'/.test(block[0]), id + ' 缺少預警相位的繪製');
  assert.ok(!/combatSettings/.test(block[0]), id + ' 的繪製不得依賴 combatSettings，低特效下必須仍看得見');
}
// 顏色表要涵蓋新地形，否則路線預覽會用到 fallback 色
const colorFn = live(hazSrc).match(/function dungeonHazardColor\(id\) \{[\s\S]*?\n\}/)[0];
for (const id of NEW_HAZARDS) assert.ok(new RegExp(id + ":").test(colorFn), id + ' 缺少路線預覽用的顏色');

console.log('✓ D4-D smoke 測試通過（' + biomes.length + ' 群系的險境池・' +
  NEW_HAZARDS.length + ' 種新地形四件套與關鍵行為・預警可讀性）');
