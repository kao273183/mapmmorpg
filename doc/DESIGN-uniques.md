# DESIGN — 傳奇命名裝備與難度稀有度上限（I1）

目標兩件事：

1. **傳奇命名裝（Unique）**：像暗黑一樣，有名字的裝備帶「固定的特殊能力」，而非只有隨機前綴。例如「冰霜劍」＝命中會凍結、對冰系加成。
2. **難度稀有度上限**：一般模式掉落最高到 **藍裝（精良）**，不會掉稀有／史詩／傳說；要好裝去打複雜。

> 現況：`gearName()` 只用前綴＋基底隨機命名，無能力；`rollRarity(n)` 依樓層 roll 稀有度（[systems.js](../src/game/systems.js)）。稀有度：0 普通(白) / 1 精良(**藍**) / 2 稀有(黃) / 3 史詩(紫) / 4 傳說(橙)，色表 [bootstrap.js:270](../src/game/bootstrap.js)。

## 固定設計契約

- **難度即報酬取捨**：一般模式所有掉落（含 Boss 保底、寶箱、事件）稀有度上限鎖在藍（1）；複雜模式維持 0～4 完整。傳奇命名裝屬高稀有度，因此**只在複雜模式**出現。
- **能力優先重用現有機制**：凍結／緩速／連鎖／吸血／反傷／免死／貪婪皆已存在，直接接；只有「燃燒 DoT」需新增一個統一的狀態。
- **Unique 是手工命名固定能力**，與「隨機前綴命名」「詞綴（附魔）」「套裝」三者並存、不衝突：普通～稀有走隨機命名；史詩／傳說可為 Unique；套裝維持既有；詞綴仍由附魔給。
- **不破壞既有存檔**：Unique 以 `it.unique = '<id>'` 標記，能力查表 `UNIQUE_DEFS[id]`；舊裝無此欄位＝一般裝，載入不報錯。
- **數值收斂**：Unique 的特殊能力有觸發機率與冷卻上限，不得出現一擊必殺或無限鎖控；一般攻擊仍是主要輸出。
- **跨平台**：能力提示與圖示支援桌機／手機／低特效；固定種子 smoke 可重現掉落。

---

## Part 1：難度稀有度上限

- 在難度設定加欄位 `maxRarity`：`TERRAIN_MODE_DEFS`（[data.js:30](../src/dungeon/data.js)）
  - `normal: { …, maxRarity: 1 }`（藍）
  - `complex: { …, maxRarity: 4 }`（傳說）
- 提供 `dungeonMaxRarity()`（比照現有 `dungeonDropMul()`）。
- 套用點：`genGear()` / `createGear()`（[systems.js](../src/game/systems.js)）把最終稀有度 `r = Math.min(r, dungeonMaxRarity())`；`rollRarity` 結果與 `forceR`（Boss 保底）都要夾。
- **決策點（需你定）**：Boss 保底掉落在一般模式是否也鎖藍？
  - 方案 A（推薦，符合你說的「一般不會掉傳奇」）：一律鎖藍，Boss 在一般只保底藍裝。
  - 方案 B：Boss 保底可高一階（藍→黃），保留一點 Boss 誘因。
- 基地／掉落 UI 標明「一般：最高藍裝」。

---

## Part 2：元素／狀態機制層（統一 proc 系統）

建立單一「命中觸發」入口，讓武器 Unique 都走同一套（含技能命中）。掛在傷害結算處：`hitMon(m, d, crit, noChain)`（[run.js:491](../src/game/run.js)）或玩家攻擊命中點。

| 狀態 | 現況 | 作法 |
|---|---|---|
| 凍結 freeze | 已有 `m.freezeT`（update.js:225，凍結時不動） | 直接設 `m.freezeT` |
| 緩速 slow | 已有 `m.slowT`（update.js:224，×0.5 速） | 直接設 `m.slowT` |
| 連鎖 shock | 已有（`hitMon` 的 `noChain`／chain perk） | 命中額外連鎖一次 |
| 吸血 lifesteal | 已有（vamp perk／命中回 HP） | 命中回 HP |
| 反傷 thorns | 已有（thorns perk） | 受擊反彈 |
| 免死 revive | 已有（phoenix perk） | 致命一次免死 |
| **燃燒 burn** | **無** | **新增** `m.burnT` + `m.burnDmg`：每 30 幀跳一次 DoT，update.js 怪物迴圈遞減與結算；顯示紅色跳字 |

- 每個 proc 有 `chance`（觸發率）與必要的冷卻，避免鎖控；freeze 時長短（例 0.5～0.9s）。
- 低特效：狀態以文字跳字（凍結／燃燒）表示，不強制粒子。

---

## Part 3：傳奇命名裝資料（UNIQUE_DEFS）

新增目錄（放 progression.js 或新檔），每筆：
```
{ id, name, kind, cls:'any'|'warrior'|'mage', biome, rarity:3|4,
  powers:[ {type:'freeze', chance:0.2, dur:48}, … ],
  flavor:'…' }
```
掉落時：滾到高稀有度（史詩／傳說）且符合職業／群系 → 有機率生成對應 Unique（`it.unique=id`），基底數值照該稀有度 roll，能力來自 `powers`。名稱與能力固定、數值仍有浮動。

**首批範例（群系主題，約 10 件）**：

| 名稱 | 部位 | 群系 | 特殊能力（重用現有機制） |
|---|---|---|---|
| 冰霜劍 | 武器·劍 | 冰霜凍原 | 命中 20% 凍結 0.8s；對已緩速目標傷害＋ |
| 寒霜法杖 | 武器·杖 | 冰霜凍原 | 火球命中改施緩速；凍結目標爆擊＋ |
| 烈焰之刃 | 武器·劍 | 熾熱熔岩 | 命中施加燃燒 DoT（新機制） |
| 雷霆法杖 | 武器·杖 | 虛空深淵 | 攻擊連鎖閃電多打一目標（shock） |
| 嗜血巨劍 | 武器·劍 | 通用 | 命中回復 HP（lifesteal），低血時吸血翻倍 |
| 荊棘板甲 | 防具 | 通用 | 高減傷＋受擊反傷（thorns） |
| 熔岩之冠 | 頭盔 | 熾熱熔岩 | 受擊時噴發燃燒 AoE |
| 疾風之靴 | 鞋子 | 通用 | 移速大幅＋、衝刺冷卻降低 |
| 不滅之戒 | 飾品 | 通用 | 致命傷免死一次／局（phoenix） |
| 貪婪之瞳 | 飾品 | 通用 | 靈魂與掉落率增益（greed） |

> 群系主題讓 Unique 有「去哪刷」的目標；冰霜劍自然關聯冰霜領主／凍原層。

---

## Part 4：顯示與整合

- **顏色／標記**：Unique 用專屬色（例橙金）或在名稱前加 ✦，與套裝（既有色）區隔。
- **能力文字**：紙娃娃／掉落 tooltip 顯示 `powers` 的說明（凍結 20% / 燃燒 / 連鎖…），沿用 `gearDesc`/`gearLabel`（[interface.js](../src/game/interface.js)）。
- **圖鑑**：Unique 併入 H1 圖鑑「裝備」類（[PLAN-H1.md](PLAN-H1.md)），首次取得解鎖、顯示能力與出處群系。
- **附魔相容**：Unique 仍可附魔（詞綴槽照稀有度），能力與詞綴疊加但各有上限。

---

## 分批交付

- **I1-A：難度稀有度上限**（Part 1）— ✅ 已完成（v0.29.22）：`maxRarity` 設定 + `dungeonMaxRarity()` + genGear 夾值 + 停套裝 + 基地標明。一般模式頂多藍裝。
- **I1-B：元素狀態層**（Part 2）— ✅ 已完成（v0.29.26 + v0.29.27）：`applyUniqueWeaponProcs` 接 freeze/slow/lifesteal/chain；新增 burn DoT（`m.burnT`/`m.burnDmg`，迴圈外結算走 hitMon 讓擊殺正常計經驗）；armor/acc 被動經 `equippedUniquePower` 接進 dmgPlayer（thorns 反傷、revive 免死）。
- **I1-C：Unique 資料與掉落（8 件）**（Part 3）— ✅ 已完成：`UNIQUE_DEFS` 8 件（冰霜劍/嗜血巨劍/寒霜法杖/雷霆法杖/烈焰之刃/疾風之靴/荊棘板甲/不滅之戒）+ genGear 高稀有度轉 Unique + 職業過濾 + 取代套裝 + 只困難掉。⏳ 待做：擴充更多群系主題 Unique、頭盔類。
- **I1-D：顯示（部分）**（Part 4）— ✅ 基本完成（v0.29.26）：專屬金橙色（gearColor）、背包列 ◈ 標記、紙娃娃底部能力全文。⏳ 待做：接 H1 圖鑑、掉落發光、詳細 tooltip。
- **I1-E：平衡與回歸** — ⏳ 待做：proc 觸發率／冷卻上限調校、Unique 不破壞曲線；固定種子 smoke、桌機／手機／低特效、舊存檔相容全回歸。

### 已驗證（v0.29.26）
困難 400 抽出 43 Unique、職業過濾正確、一般模式 0 Unique；冰霜劍凍結 25%、嗜血吸血 12%、寒霜緩速 35%、雷霆連鎖觸發且命中鄰近、巢狀 hitMon 無錯；顯示金色 + ◈ + 紙娃娃全文。

## 完成標準

- 一般模式掉落上限為藍（含或不含 Boss 保底依 Part 1 決策）；複雜模式可掉稀有～傳說與 Unique。
- 至少 10 件群系主題 Unique，各帶可辨識的固定能力，數值受觸發率／冷卻收斂。
- 燃燒 DoT 與既有凍結／緩速／連鎖／吸血／反傷／免死統一走命中 proc 入口。
- Unique 顯示能力文字與專屬標記，併入圖鑑、可附魔。
- 不破壞既有存檔；桌機／手機／低特效與固定種子 smoke 通過。
