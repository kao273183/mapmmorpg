// D4-A smoke 測試：射手（敵方遠程管線）與起始群系多樣化。
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const runSrc = read('src', 'game', 'run.js');
const updateSrc = read('src', 'game', 'update.js');
const renderSrc = read('src', 'game', 'render.js');
const systemsSrc = read('src', 'game', 'systems.js');
const bootSrc = read('src', 'game', 'bootstrap.js');
const coreSrc = read('src', 'dungeon', 'core.js');
const dataSrc = read('src', 'dungeon', 'data.js');

// ── 1. 新怪必須四件套齊全：生成／AI／繪製／怪池 ──────────────────────────
// 少任何一項都不會報錯，只會變成「生不出來」「不會動」「畫成史萊姆」或「永遠不出現」。
const NEW_TYPES = ['shooter'];
for (const type of NEW_TYPES) {
  assert.ok(new RegExp("type === '" + type + "'").test(runSrc), type + ' 缺少 spawnMon 生成分支');
  assert.ok(new RegExp("m\\.type === '" + type + "'").test(updateSrc), type + ' 缺少 update AI 分支');
  assert.ok(new RegExp("\\b" + type + ':').test(bootSrc), type + ' 沒有登記到 MON_SPRITE，會被畫成史萊姆');
  assert.ok(new RegExp("'" + type + "'").test(systemsSrc), type + ' 沒有進任何群系怪池，永遠不會出現');
}
// 怪池裡出現的每個 type 都必須有生成分支（反向檢查：打錯字會靜默消失）
const pools = [...systemsSrc.matchAll(/pool:\[([^\]]*)\]/g)].flatMap(m =>
  m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean));
const spawnable = new Set(['slime', 'bat', 'mush', 'spore', 'bomber', 'charger', 'icer', 'splitter'].concat(NEW_TYPES));
for (const t of new Set(pools)) {
  assert.ok(spawnable.has(t), '怪池裡的 ' + t + ' 沒有對應的生成分支（打錯字會靜默不生成）');
}
assert.ok(new Set(pools).has('shooter'), '射手應已加入群系怪池');

// ── 2. 遠程管線：直線彈 + 預警 ────────────────────────────────────────────
// espits 原本寫死重力，是 Boss 的拋物線彈；直線彈要能把重力關掉。
assert.ok(/s\.vy \+= \(s\.grav != null \? s\.grav : 0\.25\)/.test(updateSrc),
  'espits 應支援自訂重力（grav:0＝直線彈），否則遠程怪的彈會往下掉');
assert.ok(/grav:0/.test(systemsSrc), '射手的彈應設 grav:0');
assert.ok(/s\.life != null && --s\.life <= 0/.test(updateSrc), '直線彈需要壽命，否則會永遠留在場上');
assert.ok(/life:\d+/.test(systemsSrc), '射手的彈應設 life');
// 預警：發射前要有可見提示，且低特效下不能消失（純線條與文字，不依賴粒子/閃光）
const telBlock = renderSrc.match(/if \(m\.type === 'shooter' && m\.tel > 0\) \{[\s\S]*?\n    \}/);
assert.ok(telBlock, 'render.js 缺少射手的發射預警');
assert.ok(/moveTo\(m\.x/.test(telBlock[0]) && /lineTo\(ax, ay\)/.test(telBlock[0]), '預警應畫出瞄準線');
assert.ok(/'!'/.test(telBlock[0]), '預警應有驚嘆號提示');
assert.ok(!/combatSettings/.test(telBlock[0]), '預警不得依賴 combatSettings，低特效下必須仍看得見');
// 開火後一定要重設冷卻，否則會一直卡在預警狀態（實際踩過）
const aiBlock = updateSrc.match(/\} else if \(m\.type === 'shooter'\) \{[\s\S]*?\n    \} else if/);
assert.ok(aiBlock, '找不到射手 AI');
assert.ok(/fireShooterBolt\(m\);\s*m\.shotCd =/.test(aiBlock[0]),
  '射手開火後必須重設 shotCd，否則會連續預警、幾乎不間斷地射擊');
// 凍結判定要用 !(x > 0)：欄位沒初始化時是 undefined，而 undefined <= 0 是 false（實際踩過）
assert.ok(!/m\.freezeT <= 0/.test(aiBlock[0]),
  '射手不得用 m.freezeT <= 0 判定：未初始化時 undefined <= 0 為 false，會讓它永遠不開火');
// 秘境高層變體
assert.ok(/currentRiftScale\(\)\.tier/.test(systemsSrc), '射手應依秘境層級切換強化變體');
assert.ok(/tier >= \d+ \? 3 : 1/.test(systemsSrc), '高層應改為散射三連');

// ── 3. 起始群系多樣化 ────────────────────────────────────────────────────
assert.ok(/const DUNGEON_START_BIOME_IDS = \[/.test(coreSrc), '應有可起始的群系清單');
const startIds = coreSrc.match(/const DUNGEON_START_BIOME_IDS = \[([^\]]*)\]/)[1]
  .split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean);
assert.ok(startIds.length >= 2, '起始群系至少要有兩種，否則等於沒有多樣化');
const biomeIds = [...dataSrc.matchAll(/\{ id:'(\w+)', name:'[^']*', hazardId:/g)].map(m => m[1]);
for (const id of startIds) assert.ok(biomeIds.indexOf(id) >= 0, '起始群系 ' + id + ' 不在 DUNGEON_BIOME_DEFS 裡');
// 移動改變型險境（冰面滑行以外）不該當起點——虛空平台消失放在第 1 層會太勸退
assert.ok(startIds.indexOf('void') < 0, '虛空深淵不該當起始群系（虛空平台消失＋深淵魔王對第一章太重）');

// 交換而非覆蓋：五個群系在一局裡各出現一次
assert.ok(/if \(base === start\) return 0;/.test(coreSrc),
  '起始群系應與原本放它的章節「互換」，否則該群系會在同一局出現兩次');
// 視覺／怪池與險境／Boss 必須共用同一個索引
assert.ok(/typeof dungeonBiomeIndex === 'function'/.test(systemsSrc),
  'biomeOf 應共用 dungeonBiomeIndex，否則背景與怪池會跟險境／Boss 對不上');
// 基準局必須固定，否則固定種子的平衡報表失去可比性
assert.ok(/benchmarkProfile \? 'meadow' :/.test(coreSrc),
  '基準局的起始群系必須固定，否則平衡報表會跟著起始群系跑掉');
// 可重現：從 run seed 推導，不用 Math.random
const pickFn = coreSrc.match(/function dungeonPickStartBiome\(seed\) \{[\s\S]*?\n\}/);
assert.ok(pickFn, '缺少 dungeonPickStartBiome');
assert.ok(!/Math\.random/.test(pickFn[0]), '起始群系必須由 run seed 推導，不能用 Math.random（否則同種子無法重現）');

console.log('✓ D4-A smoke 測試通過（射手四件套與遠程管線・預警可讀性・高層變體・' +
  startIds.length + ' 種起始群系與章節互換）');
