// 技能特效 smoke 測試：擋掉「沒有專屬外觀就默默沿用別人的」這種無聲失效。
// 兩個實際踩過的坑：新增的投射物 kind 沒有繪製分支 → 被畫成火球；
// 近戰技能設了 slashT 卻沒設 slashArc → 沿用上一個技能殘留的刀光顏色。
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const systemsSrc = read('src', 'game', 'systems.js');
const renderSrc = read('src', 'game', 'render.js');
const updateSrc = read('src', 'game', 'update.js');

function skillBodies(src) {
  const out = {};
  for (const m of src.matchAll(/^ {2}([a-zA-Z]+)\(t\) \{[\s\S]*?\n {2}\},/gm)) out[m[1]] = m[0];
  return out;
}
const bodies = skillBodies(systemsSrc);
assert.ok(Object.keys(bodies).length >= 18, '應抓得到所有技能實作，實際 ' + Object.keys(bodies).length);

// ── 1. 每個投射物 kind 都要有自己的繪製分支 ──────────────────────────────
const projLoop = renderSrc.match(/for \(const pr of projs\) \{[\s\S]*?\n {2}\}/);
assert.ok(projLoop, 'render.js 應有投射物繪製迴圈');
// 只取 projs.push 裡的 kind（num() 的傷害數字也有 kind 欄位，不能混進來）
const kinds = new Set();
for (const body of Object.values(bodies)) {
  for (const push of body.matchAll(/projs\.push\(\{[\s\S]*?\}\);/g)) {
    const m = push[0].match(/kind:'([a-z]+)'/);
    if (m) kinds.add(m[1]);
  }
}
assert.ok(kinds.size >= 3, '應抓得到多種投射物 kind，實際 ' + [...kinds].join('/'));
for (const kind of kinds) {
  if (kind === 'fire') continue; // fire 是 else 分支的預設外觀
  assert.ok(new RegExp("pr\\.kind === '" + kind + "'").test(projLoop[0]),
    '投射物 kind「' + kind + '」在 render.js 沒有專屬繪製分支，會被畫成火球');
  assert.ok(new RegExp("pr\\.kind === '" + kind + "'").test(updateSrc),
    '投射物 kind「' + kind + '」在 update.js 沒有專屬命中處理，會套用火球的效果');
}

// ── 2. 設了 slashT 的技能都必須設自己的 slashArc ────────────────────────
const arcs = {};
for (const [id, body] of Object.entries(bodies)) {
  if (!/p\.slashT = /.test(body)) continue;
  const m = body.match(/p\.slashArc = \{ col:'([\d, ]+)', r:(\d+), spread:([\d.]+), w:(\d+) \}/);
  assert.ok(m, '近戰技能「' + id + '」設了 slashT 卻沒設 slashArc，會沿用上一個技能的刀光');
  arcs[id] = { col: m[1], r: +m[2], spread: +m[3], w: +m[4] };
  assert.ok(/^\d+,\d+,\d+$/.test(m[1].replace(/\s/g, '')), id + ' 的 slashArc 顏色應是 "r,g,b" 格式');
  assert.ok(arcs[id].r >= 30 && arcs[id].r <= 90, id + ' 的刀光半徑 ' + arcs[id].r + ' 超出合理範圍');
  assert.ok(arcs[id].spread > 0.5 && arcs[id].spread < 4, id + ' 的刀光弧度 ' + arcs[id].spread + ' 超出合理範圍');
}
assert.ok(Object.keys(arcs).length >= 4, '應有多個近戰技能設定刀光');
assert.ok(/const arc = p\.slashArc \|\| \{/.test(renderSrc), 'render.js 應讀取 p.slashArc 並有預設值');
assert.ok(/p\.slashArc = null/.test(read('src', 'game', 'run.js')), 'resetRun 應清掉 slashArc');

// ── 3. 各職業的基本技能外觀必須彼此不同（否則職業感出不來）────────────────
const progressionSrc = read('src', 'game', 'progression.js');
const defsBlock = progressionSrc.match(/const SKILL_DEFS = \{[\s\S]*?\n\};/)[0];
const basics = [];
for (const m of defsBlock.matchAll(/^\s*(\w+):\s*\{ cls:'(\w+)'[^}]*basic:true/gm)) basics.push({ id: m[1], cls: m[2] });
assert.strictEqual(basics.length, 6, '六個職業各要有一個基本技能，實際 ' + basics.map(b => b.id).join('/'));

const meleeBasics = basics.filter(b => arcs[b.id]);
const rangedBasics = basics.filter(b => !arcs[b.id]);
assert.ok(meleeBasics.length >= 3 && rangedBasics.length >= 3, '基本技能應有近戰與遠程兩類');

const arcCols = meleeBasics.map(b => arcs[b.id].col);
assert.strictEqual(new Set(arcCols).size, arcCols.length,
  '近戰基本技能的刀光顏色必須各不相同：' + meleeBasics.map(b => b.id + '=' + arcs[b.id].col).join(', '));
const arcShapes = meleeBasics.map(b => arcs[b.id].r + '/' + arcs[b.id].spread);
assert.strictEqual(new Set(arcShapes).size, arcShapes.length,
  '近戰基本技能的刀光形狀也應不同（只有顏色不同在快節奏中不夠明顯）');

// 遠程基本技能各自要有 kind，且不能共用
const rangedKinds = rangedBasics.map(b => {
  const m = bodies[b.id] && bodies[b.id].match(/kind:'([a-z]+)'/);
  assert.ok(m, b.id + ' 是遠程基本技能，應建立投射物');
  return m[1];
});
assert.strictEqual(new Set(rangedKinds).size, rangedKinds.length,
  '遠程基本技能不可共用同一種投射物外觀：' + rangedBasics.map((b, i) => b.id + '=' + rangedKinds[i]).join(', '));

// ── 4. VFX 圖集：宣告的尺寸必須對得上實際檔案，且要有授權登記 ──────────────
const bootSrc = read('src', 'game', 'bootstrap.js');
const vfxBlock = bootSrc.match(/const SKILL_VFX_DEFS = \{[\s\S]*?\n\};/)[0];
const vfxDefs = [];
for (const m of vfxBlock.matchAll(/(\w+):\{ src:'([^']+)', frames:(\d+)(?:, frame:(\d+))?/g)) {
  vfxDefs.push({ key: m[1], src: m[2], frames: +m[3], frame: m[4] ? +m[4] : 72 });
}
assert.ok(vfxDefs.length >= 13, 'SKILL_VFX_DEFS 應解析得到全部圖集，實際 ' + vfxDefs.length);
const pngSize = file => { // 從 PNG IHDR 直接讀寬高，不需要外部套件
  const buf = fs.readFileSync(file);
  assert.strictEqual(buf.toString('ascii', 1, 4), 'PNG', file + ' 不是 PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};
for (const d of vfxDefs) {
  const file = path.join(root, d.src);
  assert.ok(fs.existsSync(file), d.key + ' 的圖集檔不存在：' + d.src);
  const { w, h } = pngSize(file);
  assert.strictEqual(h, d.frame, d.key + ' 宣告每格 ' + d.frame + 'px，實際圖高 ' + h + 'px');
  assert.strictEqual(w, d.frame * d.frames,
    d.key + ' 宣告 ' + d.frames + ' 格 × ' + d.frame + 'px，實際圖寬 ' + w + 'px（會切到錯的格）');
}
// 非 72px 的來源一定要宣告 frame，否則會被當成 72 切爛
for (const d of vfxDefs) {
  const { h } = pngSize(path.join(root, d.src));
  if (h !== 72) assert.ok(/frame:/.test(vfxBlock.match(new RegExp(d.key + ':\\{[^}]*\\}'))[0]),
    d.key + ' 的來源不是 72px，必須在 SKILL_VFX_DEFS 宣告 frame');
}
// 染色路徑要存在且有快取
const sysForTint = systemsSrc;
assert.ok(/function tintedSkillVfx\(key, col\)/.test(sysForTint), '應有染色函式');
assert.ok(/skillVfxTintCache/.test(sysForTint), '染色結果必須快取，否則每幀重繪離屏畫布');
assert.ok(/globalCompositeOperation = 'color'/.test(sysForTint), '染色應用 color 混合模式以保留明暗');
// 授權登記：runtime 裡的圖集都要能在 LICENSE.md 找到，或屬於待補清單
const skillLicense = read('assets', 'runtime', 'skills', 'LICENSE.md');
for (const d of vfxDefs) {
  const base = path.basename(d.src);
  if (/^\d+(_\d+)?\.png$/.test(base)) continue; // 舊素材：已在 LICENSE.md 標為來源不明
  assert.ok(skillLicense.includes(base), base + ' 未登記在 assets/runtime/skills/LICENSE.md');
}
assert.ok(/來源不明|待補/.test(skillLicense), 'LICENSE.md 應保留既有素材來源不明的警示');

// ── 5. 每個技能都要有可見的表現（動畫或粒子），不能是無聲無息的一下 ──────
for (const [id, body] of Object.entries(bodies)) {
  const hasVfx = /playSkillAnim\(|burst\(|addSkillZone\(|projs\.push\(|meteors\.push\(|bolts\.push\(|p\.slashT|p\.spinT/.test(body);
  assert.ok(hasVfx, '技能「' + id + '」沒有任何視覺表現');
  assert.ok(/playSfx\(|beep\(/.test(body), '技能「' + id + '」沒有任何音效');
}

console.log('✓ 技能特效 smoke 測試通過（' + kinds.size + ' 種投射物外觀・' +
  Object.keys(arcs).length + ' 種刀光・' + basics.length + ' 個基本技能各自可辨識・' +
  vfxDefs.length + ' 組圖集尺寸與授權已核對）');
