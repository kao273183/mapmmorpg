// J2-F 回歸測試：弓箭手系（弓箭手／遊俠／神射手）的存檔、平衡與版面承諾。
// J1-F 已經用「遍歷職業表」的方式蓋住零局內戰力與進階職效率區間，本檔只補 J2 新增的風險：
//   1. 基礎職走 ax 欄位（弓箭手是第一個非 legacy 的「基礎職」，這是 J2 唯一的存檔風險點）
//   2. 神射手鷹眼的冷卻削減（實測離群後調整過，釘死避免改回去）
//   3. 三個弓系基本技共用 arrow 投射物時的可辨識性與後備繪製
//   4. 9 職業下的選角卡／晶片／技能樹版面數學
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const systemsSrc = read('src', 'game', 'systems.js');
const townSrc = read('src', 'game', 'town.js');
const renderSrc = read('src', 'game', 'render.js');
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
  read('src', 'game', 'progression.js'),
  `globalThis.__j2f = {
    CLASSES, SKILL_DEFS, SKILL_IDS, LEGACY_SKILL_IDS, LEGACY_SKILL_CLASSES,
    skillState, loadouts, classSkills, baseClassIds, advancedJobsFor, baseClassOf,
    selectableJobs, isJobUnlocked, jobPickList, revalidateLoadouts, skillsToNums,
    ensureMasteryState, masteryXpForNext, MASTERY_ADVANCE_LEVEL, saveMeta
  };`
].join('\n');

const makeCtx = storage => {
  const ctx = {
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
  vm.createContext(ctx);
  vm.runInContext(source, ctx, { filename: 'j2f-bundle.js' });
  return ctx.__j2f;
};

const storage = new Map();
const api = makeCtx(storage);
const ARCHER_FAMILY = ['archer', 'ranger', 'marksman'];

// ── 1. 職業表結構：弓箭手自成一系 ───────────────────────────────────────
assert.ok(api.baseClassIds().indexOf('archer') >= 0, '弓箭手應是基礎職');
assert.strictEqual(api.advancedJobsFor('archer').join(','), 'ranger,marksman', '弓箭手系應掛遊俠與神射手');
for (const job of ['ranger', 'marksman']) {
  assert.strictEqual(api.baseClassOf(job), 'archer', job + ' 應對應回弓箭手');
}
// 弓系技能不得漏到別系，別系也不得漏進弓系
for (const job of ARCHER_FAMILY) {
  for (const id of api.classSkills(job)) {
    assert.ok(ARCHER_FAMILY.indexOf(api.SKILL_DEFS[id].cls) >= 0,
      job + ' 拿到了非弓系技能 ' + id + '（cls=' + api.SKILL_DEFS[id].cls + '）');
  }
}

// ── 2. 存檔：弓箭手是第一個「非 legacy 的基礎職」，技能必須走 ax 而非 46 格區塊 ──
for (const job of ARCHER_FAMILY) {
  assert.ok(api.LEGACY_SKILL_CLASSES.indexOf(job) < 0, job + ' 不該被列入 legacy 存檔職業');
  for (const id of api.classSkills(job)) {
    if (api.SKILL_DEFS[id].cls !== job) continue;
    assert.ok(api.LEGACY_SKILL_IDS.indexOf(id) < 0, id + ' 不該進入 46 格 legacy 區塊');
  }
}
assert.strictEqual(api.skillsToNums().length, 46, '新增弓系 11 個技能後，legacy 區塊仍必須是 46 格');

// 寫一份含弓系進度的存檔，再從乾淨環境載回來
for (const id of ['shoot', 'multishot', 'snaretrap', 'deadeye']) {
  const s = api.skillState[id];
  s.unl = 1; s.pts = 3; s.spent = 2; s.branch = 1;
}
api.loadouts.archer = ['shoot', 'multishot', null];
api.loadouts.marksman = ['snipe', null, 'deadeye'];
let advXp = 0;
for (let lv = 1; lv < api.MASTERY_ADVANCE_LEVEL; lv++) advXp += api.masteryXpForNext(lv);
api.ensureMasteryState('archer').xp = advXp;
api.saveMeta();
const saved = JSON.parse(storage.get('pixelrogue_save'));
assert.ok(saved.ax, '弓系技能應寫進 ax 欄位');
for (const id of ['shoot', 'snaretrap', 'deadeye']) {
  assert.ok(JSON.stringify(saved.ax).indexOf(id) >= 0, id + ' 應出現在 ax 存檔欄位');
}
const reloaded = makeCtx(storage);
reloaded.revalidateLoadouts();
for (const id of ['shoot', 'multishot', 'snaretrap', 'deadeye']) {
  const s = reloaded.skillState[id];
  assert.strictEqual(s.unl, 1, id + ' 的解鎖狀態應跨存檔保留');
  assert.strictEqual(s.pts, 3, id + ' 的技能點應跨存檔保留');
  assert.strictEqual(s.branch, 1, id + ' 的天賦分支應跨存檔保留');
}
assert.strictEqual(reloaded.loadouts.archer.join(','), 'shoot,multishot,', '弓箭手出戰欄應完整還原');
assert.strictEqual(reloaded.loadouts.marksman.join(','), 'snipe,,deadeye', '神射手出戰欄應完整還原');
assert.ok(reloaded.isJobUnlocked('ranger') && reloaded.isJobUnlocked('marksman'),
  '弓箭手精通達門檻後，兩個進階職都應解鎖');

// J2 之前的存檔（沒有任何弓系資料）也要能無痛升級
const legacyStore = new Map(storage);
const legacySave = JSON.parse(legacyStore.get('pixelrogue_save'));
delete legacySave.ax;                      // 舊版沒有進階／弓系技能
delete legacySave.ms;                      // 也沒有精通
legacyStore.set('pixelrogue_save', JSON.stringify(legacySave));
const oldApi = makeCtx(legacyStore);
oldApi.revalidateLoadouts();
for (const job of ARCHER_FAMILY) {
  const basic = oldApi.classSkills(job).find(id => oldApi.SKILL_DEFS[id].basic);
  assert.strictEqual(oldApi.loadouts[job][0], basic, job + ' 在舊存檔上應補回自己的基本技能，不能空手進地城');
  assert.strictEqual(oldApi.SKILL_DEFS[basic].cls, job, job + ' 補回的應是自己的基本技能');
  for (const id of oldApi.classSkills(job)) {
    if (oldApi.SKILL_DEFS[id].cls !== job || oldApi.SKILL_DEFS[id].basic) continue;
    assert.strictEqual(oldApi.skillState[id].unl, 0, job + ' 的 ' + id + ' 在舊存檔上不該預設解鎖');
  }
}
assert.ok(oldApi.selectableJobs().indexOf('archer') >= 0, '弓箭手是基礎職，舊存檔也應可選');
for (const job of ['ranger', 'marksman']) {
  assert.strictEqual(oldApi.isJobUnlocked(job), false, job + ' 在沒有精通的舊存檔上不該已解鎖');
}

// ── 3. 平衡：釘死 J2-F 實測後的調整（數據見 doc/PLAN-archer.md） ──────────
function skillBody(id) {
  const m = systemsSrc.match(new RegExp('^  ' + id + '\\(t\\) \\{[\\s\\S]*?\\n  \\},', 'm'));
  assert.ok(m, id + ' 找不到技能本體');
  return m[0];
}
const deadeye = skillBody('deadeye');
const cdMul = deadeye.match(/p\.deadeyeCdMul = t\.mechanic && t\.branch === 1 \? ([\d.]+) : 1;/);
assert.ok(cdMul, '鷹眼應有速射分支的冷卻倍率');
assert.ok(parseFloat(cdMul[1]) >= 0.75,
  '鷹眼速射分支的冷卻倍率 ' + cdMul[1] + ' 過低：冷卻削減乘在所有技能上，' +
  '和穿甲貫穿疊起來會讓神射手群體輸出離群（實測 0.6 時為基礎職的 +61%）');
// 冷卻削減分支不該同時拿到最高的傷害加成，否則兩條分支沒有取捨
const dmg = deadeye.match(/p\.deadeyeDmg = t\.mechanic && t\.branch === 0 \? ([\d.]+) : ([\d.]+);/);
assert.ok(dmg, '鷹眼應有兩條分支的傷害加成');
assert.ok(parseFloat(dmg[2]) < parseFloat(dmg[1]),
  '鷹眼速射分支（' + dmg[2] + '）的傷害加成應低於凝神分支（' + dmg[1] + '），兩條分支才有取捨');

// 冷卻削減要真的只在專注期間生效，且是唯一的全域冷卻乘數掛點
assert.ok(/deadeyeT > 0 \? \(p\.deadeyeCdMul \|\| 1\) : 1/.test(systemsSrc),
  '鷹眼的冷卻倍率必須只在專注期間套用');

// ── 4. 箭矢：三個弓系基本技共用 arrow，靠 tint 分辨，且要有後備繪製 ───────
const arrowSkills = api.SKILL_IDS.filter(id => {
  const m = systemsSrc.match(new RegExp('^  ' + id + '\\(t\\) \\{[\\s\\S]*?\\n  \\},', 'm'));
  return m && /kind:'arrow'/.test(m[0]);
});
assert.ok(arrowSkills.length >= 8, '弓系技能應大多使用 arrow 投射物，實際 ' + arrowSkills.length);
// 逐一檢查「每個」箭矢 push：一個技能可能射好幾支箭（例：疾羽射的連射追加箭），
// 只要有一支漏了 tint 就會畫成沒染色的白箭，混在同色箭流裡看不出來。
function arrowPushTints(id) {
  const tints = [];
  for (const chunk of skillBody(id).split('projs.push(').slice(1)) {
    const decl = chunk.split('});')[0];
    if (!/kind:'arrow'/.test(decl)) continue;
    const m = decl.match(/tint:'(#[0-9a-fA-F]{6})'/);
    assert.ok(m, id + ' 有一支箭矢沒有指定 tint（共用 arrow 投射物時每支箭都要染色）');
    tints.push(m[1]);
  }
  return tints;
}
for (const id of arrowSkills) assert.ok(arrowPushTints(id).length > 0, id + ' 應至少射出一支箭');
const basicTints = ARCHER_FAMILY.map(job => {
  const basic = api.classSkills(job).find(id => api.SKILL_DEFS[id].cls === job && api.SKILL_DEFS[id].basic);
  const tints = arrowPushTints(basic);
  assert.strictEqual(new Set(tints).size, 1, basic + ' 自己射出的箭應同色，否則像兩種技能');
  return job + '=' + tints[0];
});
assert.strictEqual(new Set(basicTints.map(s => s.split('=')[1])).size, 3,
  '三個弓系基本技的箭矢染色必須互不相同：' + basicTints.join(', '));
// 箭矢走 SKILL_VFX_DEFS，且圖檔載入失敗時要有程式繪製後備
const bootSrc = read('src', 'game', 'bootstrap.js');
assert.ok(/\n\s*arrow:\{ src:'assets\/runtime\/skills\/vfx\/arrow\.png'/.test(bootSrc),
  '箭矢應登記在 SKILL_VFX_DEFS，才能吃到染色與快取');
const arrowDraw = extract(renderSrc, /if \(pr\.kind === 'arrow'\) \{[\s\S]*?\n    \} else if/, '箭矢繪製分支');
assert.ok(/drawSkillVfxFrame\('arrow'/.test(arrowDraw), '箭矢應以 drawSkillVfxFrame 繪製（支援 tint）');
assert.ok(/ctx\.stroke\(\)/.test(arrowDraw), '箭矢應保留程式繪製後備，圖檔沒載入時仍看得到箭');
assert.ok(/pr\.tint/.test(arrowDraw), '後備繪製也應套用 tint');

// ── 5. 版面：9 職業下的選角卡、進階晶片與技能樹 ────────────────────────
// 選角卡與晶片寬度是由職業數算出來的，職業一多就會被擠爆，這裡用同一套數學把關。
const layoutNums = {
  panelW: parseInt(extract(townSrc, /const left = \{ x: 24, y: 116, w: (\d+)/, '左面板').match(/w: (\d+)/)[1], 10),
  pad: 36, gapC: 12, labW: 40, gapH: 8, chipMax: 168
};
const nBases = api.baseClassIds().length;
const inner = layoutNums.panelW - layoutNums.pad;
const cw = Math.floor((inner - layoutNums.gapC * (nBases - 1)) / nBases);
assert.ok(cw >= 100, nBases + ' 個基礎職時卡片寬度只剩 ' + cw + 'px，選角頁會擠爆');
assert.ok(/const wideCard = cw >= 170/.test(townSrc), '基礎職卡應在變窄時切換成直式精簡卡');
assert.ok(cw < 170, nBases + ' 個基礎職應走直式精簡卡（cw=' + cw + '）');
for (const base of api.baseClassIds()) {
  const na = Math.max(1, api.advancedJobsFor(base).length);
  const chw = Math.min(layoutNums.chipMax, Math.floor((inner - layoutNums.labW - layoutNums.gapH * (na - 1)) / na));
  assert.ok(chw >= 90, base + ' 系的進階晶片只剩 ' + chw + 'px，文字與條件會被切掉');
}
// 技能樹：每個職業的技能數都要有對應版型（缺版型會整個右側面板無聲消失，J1-C 踩過）
const layoutBlock = extract(townSrc, /const TREE_LAYOUTS = \{[\s\S]*?\n  \};/, 'TREE_LAYOUTS');
const layoutKeys = new Set([...layoutBlock.matchAll(/(?:^|[\s{])(\d+)\s*:/gm)].map(m => parseInt(m[1], 10)));
for (const job of Object.keys(api.CLASSES)) {
  const n = api.classSkills(job).length;
  assert.ok(layoutKeys.has(n), job + ' 有 ' + n + ' 個技能，但 TREE_LAYOUTS 沒有對應版型');
}
// 職業切換列：9 個職業時每個鈕仍要點得到
const clsW = Math.min(118, Math.floor((634 - (Object.keys(api.CLASSES).length - 1) * 10) / Object.keys(api.CLASSES).length));
assert.ok(clsW >= 44, Object.keys(api.CLASSES).length + ' 個職業時技能頁的職業鈕只剩 ' + clsW + 'px，手機點不到');

console.log('✓ J2-F 回歸測試通過（弓系 ' + ARCHER_FAMILY.length + ' 職・ax 存檔往返與舊存檔升級・' +
  '鷹眼冷卻區間・箭矢染色與後備・' + Object.keys(api.CLASSES).length + ' 職版面數學）');
