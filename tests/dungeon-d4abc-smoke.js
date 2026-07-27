// D4-A/B/C smoke 測試：射手（敵方遠程管線）、支援型怪、機動型怪與起始群系多樣化。
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
// 檢查「這段程式碼有在跑」時要先去掉註解——否則把該行註解掉，字串比對仍然會通過。
const live = src => src.replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const runSrc = read('src', 'game', 'run.js');
const updateSrc = read('src', 'game', 'update.js');
const renderSrc = read('src', 'game', 'render.js');
const systemsSrc = read('src', 'game', 'systems.js');
const bootSrc = read('src', 'game', 'bootstrap.js');
const coreSrc = read('src', 'dungeon', 'core.js');
const dataSrc = read('src', 'dungeon', 'data.js');

// ── 1. 新怪必須四件套齊全：生成／AI／繪製／怪池 ──────────────────────────
// 少任何一項都不會報錯，只會變成「生不出來」「不會動」「畫成史萊姆」或「永遠不出現」。
const NEW_TYPES = ['shooter', 'totem', 'warder', 'burrower', 'phaser', 'swarm'];
for (const type of NEW_TYPES) {
  assert.ok(new RegExp("type === '" + type + "'").test(runSrc), type + ' 缺少 spawnMon 生成分支');
  assert.ok(new RegExp("m\\.type === '" + type + "'").test(updateSrc), type + ' 缺少 update AI 分支');
  assert.ok(new RegExp("\\b" + type + ':').test(bootSrc), type + ' 沒有登記到 MON_SPRITE，會被畫成史萊姆');
  assert.ok(new RegExp("'" + type + "'").test(systemsSrc), type + ' 沒有進任何群系怪池，永遠不會出現');
}
// 怪池裡出現的每個 type 都必須有生成分支（反向檢查：打錯字會靜默消失）
const pools = [...systemsSrc.matchAll(/pool:\[([^\]]*)\]/g)].flatMap(m =>
  m[1].split(',').map(s => s.trim().replace(/'/g, '')).filter(Boolean));
// 可生成的 type 由 spawnMon 的原始碼推導（硬寫清單每加一隻怪就得改一次）
const spawnBody = runSrc.slice(runSrc.indexOf('function spawnMon'), runSrc.indexOf('function currentFloorEventDef'));
const spawnable = new Set([...spawnBody.matchAll(/type === '(\w+)'/g)].map(m => m[1])
  .concat([...spawnBody.matchAll(/mons\.push\(\{ ?type:'(\w+)'/g)].map(m => m[1])));
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

// ── 2.5 支援型怪：護盾與治療 ─────────────────────────────────────────────
// 護盾必須接在傷害唯一入口 hitMon，否則某些傷害來源會直接穿透護盾。
const hitBody = runSrc.match(/function hitMon\(m, d, crit, noChain\) \{[\s\S]*?\n\}/)[0];
assert.ok(/m\.shield > 0/.test(hitBody), '護盾必須在 hitMon 內結算，否則會有傷害來源穿透護盾');
assert.ok(/m\.shield -= absorbed; d -= absorbed;/.test(hitBody),
  '護盾應吸收後把剩餘傷害往下傳，否則剛好破盾的那一擊會整發浪費或整發穿透');
assert.ok(hitBody.indexOf('m.shield') < hitBody.indexOf('m.hp -= d'), '護盾要在扣血之前結算');
// 護符怪死亡要清掉它掛的護盾，這是「先解場」的回饋
const deathBlock = live(runSrc).match(/if \(m\.type === 'warder'\) \{[\s\S]*?\n    \}/);
assert.ok(deathBlock, '護符怪死亡時應清除它掛出的護盾');
assert.ok(/o\.wardedBy = null;/.test(deathBlock[0]), '應一併清掉 wardedBy，避免留著已死怪物的參照');
// 治療圖騰不該有接觸傷害（它的威脅是「清不完」而不是「打得痛」）
const totemSpawn = runSrc.match(/if \(type === 'totem'\) \{[\s\S]*?\n  \}/)[0];
assert.ok(/dmg: 0/.test(totemSpawn), '治療圖騰不該有接觸傷害');
// 支援行為要有可見來源提示，且低特效下不能消失
const beamBlock = renderSrc.match(/const beams = m\.healBeams \|\| m\.wardBeams;[\s\S]*?\n    \}/);
assert.ok(beamBlock, '缺少支援光束的繪製');
assert.ok(/moveTo\(m\.x/.test(beamBlock[0]) && /lineTo\(o\.x/.test(beamBlock[0]), '支援光束應連到受益的目標');
assert.ok(!/combatSettings/.test(beamBlock[0]), '支援光束不得依賴 combatSettings');
assert.ok(/m\.shield > 0\) \{[\s\S]{0,300}ellipse/.test(renderSrc), '有護盾的怪應畫出護盾環');
// 支援型怪的行為要略過 Boss，否則會變成幫 Boss 補血/加盾
for (const kind of ['totem', 'warder']) {
  const ai = updateSrc.match(new RegExp("\\} else if \\(m\\.type === '" + kind + "'\\) \\{[\\s\\S]*?\\n    \\} else if"));
  assert.ok(ai, kind + ' 缺少 AI');
  assert.ok(/o\.type === 'boss'/.test(ai[0]), kind + ' 應排除 Boss，否則會幫 Boss 補血或加盾');
  assert.ok(/!\(m\.freezeT > 0\)/.test(ai[0]), kind + ' 應以 !(x > 0) 判定凍結（undefined <= 0 為 false）');
  assert.ok(/m\.\w+Cd = \d+/.test(ai[0]), kind + ' 動作後必須重設冷卻');
}

// ── 2.7 機動型怪 ─────────────────────────────────────────────────────────
// 三隻的共同要求：出手前要有預警、預警不得依賴低特效開關、動作後要重設冷卻。
for (const kind of ['burrower', 'phaser']) {
  const ai = live(updateSrc).match(new RegExp("\\} else if \\(m\\.type === '" + kind + "'\\) \\{[\\s\\S]*?\\n    \\} else if"));
  assert.ok(ai, kind + ' 缺少 AI');
  assert.ok(/!\(m\.freezeT > 0\)/.test(ai[0]), kind + ' 應以 !(x > 0) 判定凍結');
}
// 穿地獸：冒出點必須鎖在玩家位置，否則裂痕出現在旁邊、站著不動也打不到
const burrowAi = live(updateSrc).match(/\} else if \(m\.type === 'burrower'\) \{[\s\S]*?\n    \} else if/)[0];
// 兩個進入預警的路徑（首次冒出與連續冒出）都必須鎖定玩家位置——
// 只檢查「有出現過鎖定」會被另一條路徑矇混過去。
const emergeTriggers = burrowAi.match(/m\.emergeT = \d+/g) || [];
assert.ok(emergeTriggers.length >= 2, '穿地獸應有首次冒出與連續冒出兩條路徑');
const locks = burrowAi.match(/m\.x = Math\.max\(m\.minx, Math\.min\(m\.maxx, p\.x\)\)/g) || [];
assert.strictEqual(locks.length, emergeTriggers.length,
  '每個進入預警的路徑都要把冒出點鎖到玩家腳下（' + emergeTriggers.length + ' 條路徑但只有 ' + locks.length + ' 處鎖定）');
assert.ok(/m\.repeats = tier >= \d+ \? \d+ : 0/.test(burrowAi), '穿地獸應有秘境高層的連續冒出變體');
// 潛地中不得造成接觸傷害；dmg:0 的支援怪也不得因 Math.max(1,...) 刮傷玩家
const contact = live(updateSrc).match(/if \(p\.inv === 0 &&[\s\S]*?dmgPlayer\(\{ amount:d, sourceName:monsterLabel/);
assert.ok(contact, '找不到接觸傷害判定');
assert.ok(/m\.dmg > 0/.test(contact[0]), '接觸傷害要排除 dmg:0 的怪，否則 Math.max(1,...) 會讓零傷害的支援怪仍刮 1 點');
assert.ok(/m\.type === 'burrower' && m\.burrow/.test(contact[0]), '潛地中的穿地獸不該有接觸傷害');
// 鏡影：落點要在玩家「旁邊」而不是身上
const phaserAi = live(updateSrc).match(/\} else if \(m\.type === 'phaser'\) \{[\s\S]*?\n    \} else if/)[0];
const blinkOffset = phaserAi.match(/p\.x \+ side \* (\d+)/);
assert.ok(blinkOffset, '鏡影的瞬移落點應相對玩家偏移');
assert.ok(parseInt(blinkOffset[1], 10) >= 30,
  '鏡影落點偏移只有 ' + blinkOffset[1] + '，會直接疊在玩家身上（等於無法反應的貼臉攻擊）');
assert.ok(/m\.blinkT = \d+/.test(phaserAi) && /m\.blinkCd = /.test(phaserAi), '鏡影要有預告時間與冷卻');
// 蜂群：一次生一群，且單體要比同層一般怪脆很多（靠 AoE 清）
const swarmSpawn = live(runSrc).match(/if \(type === 'swarm'\) \{[\s\S]*?\n  \}/)[0];
assert.ok(/for \(let i = 0; i < count; i\+\+\)/.test(swarmSpawn), '蜂群應一次生成一群');
const swarmHp = parseInt(swarmSpawn.match(/monsterHp\((\d+),/)[1], 10);
const slimeHp = parseInt(live(runSrc).match(/let hp = monsterHp\((\d+), sc, n, elite/)[1], 10);
assert.ok(swarmHp < slimeHp / 2, '蜂群單體 HP(' + swarmHp + ') 應遠低於一般怪(' + slimeHp + ')，否則不成立「靠 AoE 清」');
// 預警繪製：破土與瞬移都要有，且不吃低特效
for (const [kind, cond] of [['burrower', "m\\.emergeT > 0"], ['phaser', "m\\.blinkT > 0"]]) {
  const block = renderSrc.match(new RegExp("if \\(m\\.type === '" + kind + "' && " + cond + "\\) \\{[\\s\\S]*?\\n    \\}"));
  assert.ok(block, kind + ' 缺少預警繪製');
  assert.ok(!/combatSettings/.test(block[0]), kind + ' 的預警不得依賴 combatSettings');
}
// 每隻新怪都要有名稱，否則傷害來源會顯示成「怪物」
const labels = live(runSrc).match(/const MONSTER_LABEL = \{[^}]*\}/)[0];
for (const t of NEW_TYPES) assert.ok(new RegExp(t + ':').test(labels), t + ' 沒有 MONSTER_LABEL，傷害來源會顯示成「怪物」');

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

console.log('✓ D4-A/B/C smoke 測試通過（' + NEW_TYPES.length + ' 種新怪四件套・遠程管線與預警・護盾與治療・高層變體・' +
  startIds.length + ' 種起始群系與章節互換）');
