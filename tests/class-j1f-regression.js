// J1-F 回歸測試：職業線的三條硬承諾 —— 精通與外觀零局內戰力、舊存檔相容、進階職平衡不離群。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const systemsSrc = read('src', 'game', 'systems.js');
const progressionSrc = read('src', 'game', 'progression.js');
function extract(src, re, label) {
  const m = src.match(re);
  assert.ok(m, label + ' 找不到');
  return m[0];
}

const source = [
  extract(systemsSrc, /const CLASSES = \{[\s\S]*?\n\};/, 'CLASSES'),
  extract(systemsSrc, /function baseClassOf\(cls\) \{.*?\}/, 'baseClassOf'),
  extract(systemsSrc, /function isAdvancedClass\(cls\) \{.*?\}/, 'isAdvancedClass'),
  extract(systemsSrc, /function baseClassIds\(\) \{.*?\}/, 'baseClassIds'),
  extract(systemsSrc, /function advancedJobsFor\(base\) \{.*?\}/, 'advancedJobsFor'),
  progressionSrc,
  `globalThis.__j1f = {
    CLASSES, meta, SKILL_DEFS, SKILL_IDS, LEGACY_SKILL_IDS, LEGACY_SKILL_CLASSES,
    skillState, loadouts, classSkills, selectableJobs, isJobUnlocked, revalidateLoadouts,
    skillsToNums, applySkillNums, applyAdvancedSkillState, advancedSkillState,
    ensureMasteryState, masteryLevel, masteryXpForNext, MASTERY_MAX_LEVEL, MASTERY_ADVANCE_LEVEL,
    syncMasteryCosmetics, ownedCosmetics, equipCosmetic, equippedCosmetic, equippedRecolor,
    equippedTitleText, ensureCosmeticState, saveMeta, loadMeta, COSMETIC_TYPES
  };`
].join('\n');

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
vm.runInContext(source, context, { filename: 'j1f-bundle.js' });
const api = context.__j1f;

// ── 1. 零局內戰力：戰鬥程式碼不得讀取精通或外觀狀態 ──────────────────────
// 這是整條 J1 對玩家的承諾，用原始碼層級擋死，避免日後不小心接上戰力。
const COMBAT_FILES = [
  ['src', 'game', 'systems.js'],
  ['src', 'game', 'update.js'],
  ['src', 'game', 'run.js']
];
const FORBIDDEN = [
  /meta\.mastery/,
  /masteryLevel\s*\(/,
  /masteryProgress\s*\(/,
  /\bownsCosmetic\s*\(/,
  /\bTITLE_DEFS\b/,
  /\bCOLOR_DEFS\b/
];
for (const f of COMBAT_FILES) {
  const src = read(...f), name = f.join('/');
  for (const re of FORBIDDEN) {
    assert.ok(!re.test(src), name + ' 不該引用 ' + re.source + '（精通／外觀必須零局內戰力）');
  }
}
// 玩家傷害與屬性計算函式本體也不得出現外觀查詢
const statFns = ['playerDmg', 'atkPow', 'skillDamageMul', 'calcStats'];
for (const fn of statFns) {
  const m = systemsSrc.match(new RegExp('function ' + fn + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  if (!m) continue;
  assert.ok(!/equippedCosmetic|equippedRecolor|mastery/i.test(m[0]),
    fn + ' 不該讀取外觀或精通狀態');
}
// 外觀只准出現在繪製層
const renderOnly = read('src', 'game', 'render.js');
assert.ok(/equippedRecolor\(\)/.test(renderOnly), 'render.js 應是配色唯一的消費端');

// 執行期驗證：把精通灌滿、外觀全解全穿，屬性欄位必須一模一樣
const statSnapshot = () => {
  const keys = Object.keys(context.player).filter(k => typeof context.player[k] === 'number');
  return keys.sort().map(k => k + '=' + context.player[k]).join(',');
};
context.player.mhp = 108; context.player.mmp = 34; context.player.def = 3;
const before = statSnapshot();
let capXp = 0; for (let lv = 1; lv < api.MASTERY_MAX_LEVEL; lv++) capXp += api.masteryXpForNext(lv);
for (const job of Object.keys(api.CLASSES)) api.ensureMasteryState(job).xp = capXp;
api.syncMasteryCosmetics();
for (const t of ['title', 'color']) {
  const owned = api.ownedCosmetics(t);
  assert.ok(owned.length > 0, t + ' 在滿精通時應該全部解鎖');
  api.equipCosmetic(t, owned[owned.length - 1]);
}
assert.strictEqual(statSnapshot(), before, '精通滿級並穿上外觀後，角色屬性不得有任何變化');
assert.ok(api.equippedRecolor(), '配色仍應正常套用（只影響外觀）');
assert.ok(api.equippedTitleText(), '稱號仍應正常顯示');

// ── 2. 舊存檔相容：沒有 ms／cs／ax 欄位的存檔要能無痛載入 ────────────────
for (const id of ['slash', 'spin', 'dash', 'fire', 'ice']) {
  const s = api.skillState[id];
  s.unl = 1; s.pts = 4; s.spent = 3; s.branch = 0;
}
api.loadouts.warrior = ['slash', 'spin', null];
api.loadouts.mage = ['fire', 'ice', null];
api.saveMeta();
const legacy = JSON.parse(storage.get('pixelrogue_save'));
delete legacy.ms; delete legacy.cs; delete legacy.ax;   // J1 之前的存檔沒有這三個欄位
assert.strictEqual(legacy.k.length, 46, '舊存檔的技能區塊就是 46 格');
storage.set('pixelrogue_save', JSON.stringify(legacy));

// 重新載入一份乾淨的執行環境，模擬玩家開啟新版本
const fresh = Object.assign({}, context, { player: { cls: 'warrior', eq: {} } });
vm.createContext(fresh);
vm.runInContext(source, fresh, { filename: 'j1f-legacy.js' });
const old = fresh.__j1f;
old.revalidateLoadouts(); // main.js 在全部載入後會呼叫
old.syncMasteryCosmetics();

for (const id of ['slash', 'spin', 'dash', 'fire', 'ice']) {
  const s = old.skillState[id];
  assert.strictEqual(s.unl, 1, id + ' 的解鎖狀態應保留');
  assert.strictEqual(s.pts, 4, id + ' 的技能點應保留');
  assert.strictEqual(s.spent, 3, id + ' 的已配點應保留');
  assert.strictEqual(s.branch, 0, id + ' 的天賦分支應保留');
}
assert.deepStrictEqual(old.loadouts.warrior.join(','), 'slash,spin,', '劍士出戰欄應完整還原');
assert.deepStrictEqual(old.loadouts.mage.join(','), 'fire,ice,', '法師出戰欄應完整還原');
// 進階職在舊存檔上必須是全新狀態：技能鎖住、出戰欄補基礎技能、職業不可選
for (const job of Object.keys(old.CLASSES)) {
  if (!old.CLASSES[job].advanced) continue;
  assert.strictEqual(old.isJobUnlocked(job), false, job + ' 在舊存檔上不該已解鎖');
  for (const id of old.classSkills(job)) {
    if (old.SKILL_DEFS[id].cls !== job) continue;
    if (old.SKILL_DEFS[id].basic) { // 基本技能與 slash/fire 一樣預設可用，否則進去沒得打
      assert.strictEqual(old.skillState[id].unl, 1, job + ' 的基本技能 ' + id + ' 應預設可用');
      continue;
    }
    assert.strictEqual(old.skillState[id].unl, 0, job + ' 的專屬技能 ' + id + ' 不該預設解鎖');
  }
  const slot0 = old.loadouts[job][0];
  assert.ok(slot0 && old.SKILL_DEFS[slot0].basic, job + ' 出戰欄第一格應是基礎技能，不能空手進地城');
}
assert.strictEqual(old.masteryLevel('warrior'), 1, '舊存檔的精通應從 Lv1 開始');
for (const t of old.COSMETIC_TYPES) {
  const owned = old.ownedCosmetics(t);
  const expect = t === 'aura' ? ['none'] : [];
  assert.deepStrictEqual(owned.join(','), expect.join(','), t + ' 在舊存檔上不該憑空多出東西');
}

// ── 3. 進階職平衡：專屬技能的效率不得離開基礎職的區間太遠 ─────────────────
// 用「倍率 / 冷卻秒」與「倍率 / MP」兩個靜態指標把關；實測數據見 doc/PLAN-class-system.md。
function skillBody(id) {
  const m = systemsSrc.match(new RegExp('^  ' + id + '\\(t\\) \\{[\\s\\S]*?\\n  \\},', 'm'));
  return m ? m[0] : '';
}
function peakMult(id) {
  const body = skillBody(id);
  const nums = [...body.matchAll(/skillDmg\(([\d.]+)\s*\*\s*t\.dmg/g)].map(x => parseFloat(x[1]));
  const bare = [...body.matchAll(/let mul = focus \? [\d.]+ : ([\d.]+)/g)].map(x => parseFloat(x[1]));
  if (/skillDmg\(t\.dmg\b/.test(body)) nums.push(1);
  return Math.max(0, ...nums, ...bare);
}
const eff = id => {
  const d = api.SKILL_DEFS[id], mult = peakMult(id);
  return mult ? { mult, perSec: mult / (d.cd / 60), perMp: mult / d.mp } : null;
};
// 火球／冰錐／隕石走投射物與隕石物件，倍率不在技能本體裡，靜態抽不到；
// 以抽得到的近戰／範圍技能當基準線已足夠圈出離群值。
const baseOffensive = api.SKILL_IDS
  .filter(id => api.LEGACY_SKILL_IDS.indexOf(id) >= 0)
  .map(id => ({ id, e: eff(id) })).filter(x => x.e);
assert.ok(baseOffensive.length >= 4,
  '應抓得到基礎職的攻擊技能倍率，實際抓到 ' + baseOffensive.map(x => x.id).join('/'));
assert.ok(baseOffensive.some(x => api.SKILL_DEFS[x.id].cls === 'warrior') &&
  baseOffensive.some(x => api.SKILL_DEFS[x.id].cls === 'mage'), '基準線應同時涵蓋兩個基礎職');
const maxBasePerSec = Math.max(...baseOffensive.map(x => x.e.perSec));
const maxBasePerMp = Math.max(...baseOffensive.map(x => x.e.perMp));

for (const job of Object.keys(api.CLASSES)) {
  if (!api.CLASSES[job].advanced) continue;
  for (const id of api.classSkills(job)) {
    if (api.SKILL_DEFS[id].cls !== job) continue;
    const e = eff(id);
    if (!e) continue; // 純輔助技能（護盾／戰吼）沒有傷害倍率
    assert.ok(e.perSec <= maxBasePerSec * 1.6,
      id + ' 的倍率/秒 ' + e.perSec.toFixed(2) + ' 超過基礎職上限 ' + maxBasePerSec.toFixed(2) + ' 的 1.6 倍');
    assert.ok(e.perMp <= maxBasePerMp * 1.6,
      id + ' 的倍率/MP ' + e.perMp.toFixed(3) + ' 超過基礎職上限 ' + maxBasePerMp.toFixed(3) + ' 的 1.6 倍');
  }
}
// 釘死 J1-F 的兩項平衡調整，避免日後被無意改回離群值（實測數據見 PLAN-class-system.md）
assert.strictEqual(api.SKILL_DEFS.bloodrend.mp, 11, '血怒斬 MP 過低會讓每 MP 效率離群');
assert.strictEqual(peakMult('bloodrend'), 1.9, '血怒斬倍率應維持在 1.9');
assert.strictEqual(api.SKILL_DEFS.chainstorm.mp, 18, '連鎖風暴 MP 過高會沒人選');
assert.strictEqual(peakMult('chainstorm'), 2.8, '連鎖風暴起始倍率應維持在 2.8');
const chain = skillBody('chainstorm');
assert.ok(/const jumps = focus \? 1 : \(5 \+/.test(chain), '連鎖風暴基礎跳數應為 5');
assert.ok(/: 0\.85;/.test(chain), '連鎖風暴衰減應為 0.85');

// 血怒斬換血：HP 消耗必須是有感的代價，否則「以血換傷」只是白吃的傷害
const bloodrend = skillBody('bloodrend');
const costs = [...bloodrend.matchAll(/p\.mhp \* \(t\.branch === 0 \? \(t\.ultimate \? ([\d.]+) : ([\d.]+)\) : ([\d.]+)\)/g)];
assert.ok(costs.length, '血怒斬應有以最大HP百分比計算的消耗');
for (const c of [costs[0][1], costs[0][2], costs[0][3]].map(Number)) {
  assert.ok(c >= 0.05, '血怒斬的HP消耗 ' + c + ' 太低，換血代價不成立');
}

// ── 4. 基準檔要涵蓋每個職業，否則平衡回歸看不到進階職 ────────────────────
const balanceSrc = read('src', 'dungeon', 'balance.js');
for (const job of Object.keys(api.CLASSES)) {
  assert.ok(new RegExp("classId:'" + job + "'").test(balanceSrc), job + ' 沒有對應的基準檔');
}
assert.ok(/const base = \(typeof baseClassOf === 'function'\)/.test(balanceSrc),
  '基準裝備應以基礎職標記，否則進階職穿不上');
assert.ok(/Object\.defineProperty\(profile, 'gear'/.test(balanceSrc),
  '基準裝備需延後生成（本檔比 systems.js 早載入）');

console.log('✓ J1-F 回歸測試通過（零局內戰力・舊存檔相容・' +
  Object.keys(api.CLASSES).filter(j => api.CLASSES[j].advanced).length + ' 個進階職平衡區間・基準檔涵蓋）');
