// J1-C 轉職框架 smoke 測試：進階職註冊、精通 Lv10 解鎖、裝備/技能沿用基礎職、存檔區塊長度不變。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
// 需要 systems.js 的 CLASSES/baseClassOf，與 progression.js 的技能/精通
const CLASSES_SRC = `
const CLASSES = {
  warrior:   { name:'劍士', col:'#c84a4a' },
  mage:      { name:'法師', col:'#5a4ad0' },
  berserker: { name:'狂戰士', col:'#ff6b3d', base:'warrior', advanced:true }
};
function baseClassOf(cls) { const c = CLASSES[cls]; return (c && c.base) || cls; }
function isAdvancedClass(cls) { return !!(CLASSES[cls] && CLASSES[cls].advanced); }
`;
const source = CLASSES_SRC + fs.readFileSync(path.join(root, 'src', 'game', 'progression.js'), 'utf8') + `
globalThis.__j1c = {
  meta, CLASSES, baseClassOf, isAdvancedClass, isJobUnlocked, selectableJobs,
  classSkills, gearUsableByClass, uniqueIdsFor, loadouts, skillState,
  SKILL_DEFS, SKILL_IDS, LEGACY_SKILL_IDS, skillsToNums, applySkillNums,
  advancedSkillState, applyAdvancedSkillState, ensureMasteryState, masteryLevel,
  MASTERY_ADVANCE_LEVEL, masteryXpForNext, saveMeta
};`;

const storage = new Map();
const context = {
  console, Math, Object, JSON, Array, Number, String, Boolean, Date,
  parseInt, parseFloat, isNaN,
  RARITY_COL: ['#e8e8e8', '#6f9dff', '#ffd23e', '#c060ff', '#ff8020'],
  RARITY_NAME: ['普通', '精良', '稀有', '史詩', '傳說'],
  RARITY_ABBR: ['普', '精', '稀', '史', '傳'],
  localStorage: {
    getItem: k => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: k => storage.delete(k)
  },
  player: { cls: 'warrior', eq: {} },
  playSfx: () => {}
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'j1c-bundle.js' });
const api = context.__j1c;

// 1. 進階職註冊與對應
assert.strictEqual(api.baseClassOf('berserker'), 'warrior', '狂戰士應對應回劍士');
assert.strictEqual(api.baseClassOf('warrior'), 'warrior', '基礎職對應自己');
assert.ok(api.isAdvancedClass('berserker') && !api.isAdvancedClass('warrior'), '進階職旗標正確');

// 2. 精通門檻解鎖
api.ensureMasteryState('warrior').xp = 0;
assert.ok(api.isJobUnlocked('warrior') && api.isJobUnlocked('mage'), '基礎職永遠可選');
assert.strictEqual(api.isJobUnlocked('berserker'), false, '精通不足時進階職應鎖住');
assert.ok(api.selectableJobs().indexOf('berserker') < 0, '鎖住時不應出現在可選清單');
// 灌到 Lv10
let xp = 0; for (let lv = 1; lv < api.MASTERY_ADVANCE_LEVEL; lv++) xp += api.masteryXpForNext(lv);
api.ensureMasteryState('warrior').xp = xp;
assert.strictEqual(api.masteryLevel('warrior'), api.MASTERY_ADVANCE_LEVEL, '應剛好達到門檻等級');
assert.strictEqual(api.isJobUnlocked('berserker'), true, '達門檻應解鎖進階職');
assert.ok(api.selectableJobs().indexOf('berserker') >= 0, '解鎖後應出現在可選清單');

// 3. 技能：進階職 = 基礎職技能 + 專屬技能
const warSkills = api.classSkills('warrior');
const berSkills = api.classSkills('berserker');
assert.ok(warSkills.indexOf('slash') >= 0 && warSkills.indexOf('bloodrend') < 0, '劍士不應有狂戰士專屬技能');
for (const id of warSkills) assert.ok(berSkills.indexOf(id) >= 0, '狂戰士應可用劍士技能 ' + id);
assert.ok(berSkills.indexOf('bloodrend') >= 0 && berSkills.indexOf('warcry') >= 0, '狂戰士應有專屬技能');
assert.ok(berSkills.indexOf('fire') < 0, '狂戰士不應有法師技能');
assert.ok(api.loadouts.berserker && api.loadouts.berserker.length === 3, '進階職應有出戰欄');

// 4. 裝備沿用基礎職裝備線
assert.ok(api.gearUsableByClass({ cls: 'warrior' }, 'berserker'), '狂戰士應能用劍士裝');
assert.ok(!api.gearUsableByClass({ cls: 'mage' }, 'berserker'), '狂戰士不應能用法師裝');
assert.ok(api.gearUsableByClass({ cls: null }, 'berserker'), '通用裝可用');
const berUniques = api.uniqueIdsFor('weapon', 'berserker', 4);
const warUniques = api.uniqueIdsFor('weapon', 'warrior', 4);
assert.deepStrictEqual(berUniques, warUniques, '狂戰士傳奇武器池應等同劍士');

// 5. 存檔相容關鍵：技能區塊長度維持 46，未被新技能撐大
api.skillState.spin.unl = 1; api.skillState.spin.pts = 3;
const nums = api.skillsToNums();
assert.strictEqual(nums.length, 46, '技能存檔區塊必須維持 46（相容既有存檔碼）');
assert.strictEqual(api.LEGACY_SKILL_IDS.length, 10, '存檔區塊只含 10 個基礎職技能');
assert.ok(api.SKILL_IDS.length > api.LEGACY_SKILL_IDS.length, '新技能存在但不進存檔區塊');
// 舊存檔(46)仍能套用
api.skillState.spin.pts = 0;
api.applySkillNums(nums);
assert.strictEqual(api.skillState.spin.pts, 3, '既有 46 格存檔應正常套用');

// 6. 進階職技能狀態另存並可還原
api.skillState.bloodrend.unl = 1; api.skillState.bloodrend.pts = 4; api.skillState.bloodrend.branch = 1;
api.loadouts.berserker = ['slash', 'bloodrend', null];
const ax = api.advancedSkillState();
assert.ok(ax.s.bloodrend && ax.l.berserker, '進階狀態應含技能與出戰欄');
assert.ok(!ax.s.slash, '基礎職技能不應重複存入進階區');
api.skillState.bloodrend.pts = 0; api.loadouts.berserker = ['slash', null, null];
api.applyAdvancedSkillState(ax);
assert.strictEqual(api.skillState.bloodrend.pts, 4, '進階技能天賦點應還原');
assert.strictEqual(api.loadouts.berserker[1], 'bloodrend', '進階出戰欄應還原');

// 7. 存檔往返含 ax 欄位
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.ok(saved.ax && saved.ax.s && saved.ax.l, '存檔應含進階職欄位 ax');
assert.strictEqual(saved.k.length, 46, '存檔的技能陣列仍為 46');

// 8. 技能樹版面必須涵蓋每個職業的技能數（少一組就會在渲染時整頁爆掉）
const townSrc = fs.readFileSync(path.join(root, 'src', 'game', 'town.js'), 'utf8');
const layoutKeys = new Set();
const layoutBlock = townSrc.match(/const TREE_LAYOUTS = \{[\s\S]*?\n  \};/);
assert.ok(layoutBlock, 'town.js 應有 TREE_LAYOUTS 技能樹版面表');
for (const m of layoutBlock[0].matchAll(/^\s{4}(\d+):\s*\{/gm)) layoutKeys.add(parseInt(m[1], 10));
for (const job of Object.keys(api.CLASSES)) {
  const n = api.classSkills(job).length;
  assert.ok(layoutKeys.has(n), job + ' 有 ' + n + ' 個技能，但 TREE_LAYOUTS 沒有對應版面');
  const posCount = (layoutBlock[0].match(new RegExp('\\n\\s{4}' + n + ': \\{[\\s\\S]*?edges')) || [''])[0]
    .split('],[').length;
  assert.strictEqual(posCount, n, n + ' 節點版面的座標數應等於技能數');
}

// 9. 裝備一律標記基礎職，否則進階職穿不到自己掉的裝
const sysSrc = fs.readFileSync(path.join(root, 'src', 'game', 'systems.js'), 'utf8');
assert.ok(/function createGear\([^)]*\)\s*\{\s*\n\s*cls = baseClassOf\(cls\);/.test(sysSrc),
  'createGear 必須把 cls 正規化成基礎職');
assert.ok(/GEAR_BASE\.weapon\[baseClassOf\(cls\)\]/.test(sysSrc),
  'gearName 取武器名應經過 baseClassOf');
const bootSrc = fs.readFileSync(path.join(root, 'src', 'game', 'bootstrap.js'), 'utf8');
assert.ok(/const cls = baseClassOf\(/.test(bootSrc), '裝備美術查表應經過 baseClassOf');

console.log('✓ J1-C 轉職框架 smoke 測試通過（進階職解鎖／技能繼承／裝備沿用／技能樹版面／存檔相容）');
