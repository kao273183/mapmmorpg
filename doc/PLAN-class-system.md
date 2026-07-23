# PLAN — 職業系統：基礎職業 × 精通 × 進階轉職（v0.31 起，J1）

把三件事合成一套：**基礎職業**（劍士／法師…）→ 玩出**精通等級** → 到門檻**解鎖進階轉職**（有專屬技能與玩法的進階職）。取代先前獨立的精通計劃，並與 [DESIGN-classes.md](DESIGN-classes.md) 的基礎職業路線相接。

> 決策（已定）：**進階轉職樹**（基礎職→進階職，像 RO／楓之谷）；**綁精通等級解鎖**。

## 1. 三層結構

```
基礎職業(base)  ──精通累積──▶  精通 Lv 門檻  ──解鎖──▶  進階職(advanced，專屬技能/玩法)
  劍士                                                        ├ 狂戰士（高風險爆發）
  法師                                                        └ 聖騎士（防禦持續）
  (未來)弓箭手/刺客                                            …各自 2 個進階職
```

- **基礎職業**：現有劍士／法師，未來弓箭手／刺客（見 DESIGN-classes）。
- **精通**：每個「職業」（含進階職）獨立累積經驗與等級，**只給外觀/材料、零局內戰力**。
- **進階轉職**：基礎職精通到 **Lv10** → 解鎖其 2 個進階職，成為選角頁**可選職業**（roguelite：不永久鎖死，解鎖後開局自由選）。進階職有自己的技能線與精通，未來可再往第三階。

## 2. 進階轉職樹（提案，名稱/風格可調）

| 基礎職 | 進階職 A | 進階職 B |
|---|---|---|
| **劍士**（近戰劍） | **狂戰士**：血量越低傷害越高、狂暴、換血 AoE | **聖騎士**：護盾、格擋反擊、治療、耐久坦 |
| **法師**（遠程杖） | **元素師**：多元素範圍爆發、隕石/風暴、連鎖 | **咒術師**：中毒/虛弱/DoT、召喚亡靈 |
| （未來）**弓箭手** | 遊俠：陷阱/機動/多重射 | 神射手：蓄力爆發/穿透 |
| （未來）**刺客** | 影舞者：暗影位移/連段 | 死士：毒/處決/高風險 |

- 進階職**沿用基礎職的裝備線**（狂戰士/聖騎士＝劍士裝；元素師/咒術師＝法師裝），避免裝備數量爆炸；`gearUsableByClass` 把進階職對應回其 base。
- 每個進階職有**專屬 5 技能 + 天賦分支**（沿用現有 `SKILL_DEFS`/天賦系統，`cls` 設為進階職 id）。

### 素材現況（實作時免再找素材）

- **技能圖示：共 70 個，目前只用 10 個 → 尚餘約 60 個可用**（`assets/runtime/skills/icons/{normal,gray}/`，256px；對應表 `SKILL_ICON_FILES`，[bootstrap.js:118](../src/game/bootstrap.js)）。新進階職的技能**直接從中挑號**即可。
- **技能特效 VFX：13 組逐格圖集**（`assets/runtime/skills/vfx/`，`SKILL_VFX_DEFS`）：groundBurst / rune / beam / slashBeam / fireball / fireballDiag / explosion / impact / groundImpact / iceSpikes / roots / smoke / teleport。`drawSkillVfxFrame()` 支援縮放、角度、翻轉、透明度，**可組合複用**做出新技能表現。
- **法術音效**已有 fire / lightning / ice / meteor（`assets/runtime/audio/sfx/`）。
- 只有需要**全新型態特效**（召喚、毒霧、鎖鏈等）時才需再找 CC0 特效包。

## 3. 精通機制（零戰力）

- **狀態**：`meta.mastery[job] = { xp, claimed:[] }`（job 含基礎職與進階職）。
- **經驗來源**：樓層深度、擊殺、成功撤退為基底 + **首次擊敗某 Boss／首次流派通關**一次性加成；同種子反覆刷**遞減**；基準局不計；無每日上限、缺席不倒扣。
- **等級**：每職 30 級、三章（1–10 快 / 11–20 中 / 21–30 慢）。**Lv10 = 解鎖進階轉職**的門檻。
- **獎勵（外觀/材料）**：1–10 角色配色+材料；11–20 職業稱號+技能特效變體+旗幟；21–30 勝利姿勢+終極技能外觀+雕像。（M 階段先做**配色+稱號**，其餘延後。）

## 4. 掛接點

| 項目 | 位置 | 作法 |
|---|---|---|
| 職業註冊 | `CLASSES`（[systems.js:5](../src/game/systems.js)） | 進階職加入，附 `base:'warrior'` 等欄位 |
| 技能 | `SKILL_DEFS`/`classSkills`（[progression.js:230/263](../src/game/progression.js)） | 進階職技能 `cls:'berserker'…`；`loadouts` 加對應 key |
| 選角頁 | `cls=['warrior','mage']`（[town.js:759](../src/game/town.js)） | 改為「基礎職 + 已解鎖進階職」動態清單 |
| 裝備過濾 | `gearUsableByClass` | 進階職映射回 base 判定 |
| 精通狀態/存檔 | `meta` + `saveMeta`/`loadMeta`（progression.js） | 加 `mastery`；舊檔缺＝0，相容；不動存檔碼位置式編碼 |
| 經驗入帳 | `endRun`（[run.js:405](../src/game/run.js)，非基準局） | `addMasteryXp(player.cls, calcGain(floor,kills,result,firstBoss))` |
| 解鎖判定 | 選角/精通頁 | `masteryLevel(base) >= 10` → 進階職可選 |

## 5. 分批交付

- **J1-A 精通基礎** — ✅ 已完成（v0.29.36）：`meta.mastery[job]={xp,bosses,best}`、30 級三章曲線（`masteryXpForNext`/`masteryLevel`/`masteryProgress`）、`addMasteryXp`/`calcMasteryGain`/`recordMasteryRun`、`ensureMasteryState` 補齊舊存檔、存檔 `ms` 欄位；`endRun` 入帳（基準局不計），`runBossIds` 記錄本局 Boss 供首殺加成，未突破該職最深紀錄時 ×0.6 衰減。零局內戰力。附 `tests/mastery-j1a-smoke.js`。
  - 實跑驗證：第 8 層/40 殺/首殺草原領主/撤退 → 275 XP（升 2 級）；同深度重跑僅 93 XP；法師不受影響；存檔往返正確。
- **J1-B 精通分頁** — ✅ 已完成（v0.29.37）：選單新增「★ 精通」分頁（`renderMasteryTab`/`renderMasteryJobPanel`，town.js）。各職業顯示等級（依職業配色）、章節、經驗進度條、累積經驗、最深樓層、首殺 Boss 數；進階轉職解鎖狀態（Lv10 達成／尚差級數）；獎勵軌三章一覽（已達章節亮起），並標明只給外觀與材料、不影響戰力。
- **J1-C 轉職框架 + 首個進階職** — ✅ 已完成（v0.29.38）：
  - `CLASSES` 新增 `berserker`（`base:'warrior'`、`advanced:true`），並加入 `baseClassOf`/`isAdvancedClass`/`baseClassIds`/`advancedJobsFor`；systems/render 內所有 `cls === 'warrior'|'mage'` 的屬性、精靈圖、武器種類、裝備與套裝分支一律改走 `baseClassOf`。
  - 解鎖條件 `isJobUnlocked`（進階職需 `masteryLevel(base) >= 10`）與 `selectableJobs()`；出戰選單職業卡、技能分頁職業切換、數字鍵選職皆改用 `selectableJobs()`，並依職業數自適應排版。
  - 兩個專屬技能：`bloodrend` 血怒斬（消耗 HP 的前方錐擊，傷害隨失血提升；分支 0 命中回血、分支 1 附加流血）、`warcry` 戰吼（範圍緩速 + 自我狂暴 + 回 MP；分支 0 附加冰凍並吃 CC 遞減）。
  - 技能樹改為 `TREE_LAYOUTS` 依技能數選版面（5＝基礎職、7＝基礎職＋2 專屬），專屬技能排在最右一層；精通分頁改為依職業數決定欄數並保留獎勵軌空間，卡片矮於 176px 時自動壓縮內容。
  - **存檔相容**：序列化區塊凍結在 `LEGACY_SKILL_IDS`/`LEGACY_SKILL_CLASSES`（維持 46 個數字，`V2_LEN`/`V3_LEN` 不動），進階職技能與出戰欄另存於新的 `ax` 欄位。
  - 裝備一律以基礎職標記（`createGear` 正規化 `cls`、`gearName` 與裝備美術查表經 `baseClassOf`），進階職才穿得到自己掉的裝。
  - 附 `tests/advance-j1c-smoke.js`（解鎖門檻／技能繼承／裝備沿用／技能樹版面涵蓋／46 格存檔不變）。
- **J1-D 補齊第一批進階職 + 選角改版** — ✅ 已完成（v0.29.39）：
  - 三個進階職到齊：**聖騎士**（`bulwark` 聖盾壁壘＝護盾＋20% 減傷；`smite` 制裁光錘＝前方神聖打擊、每命中回血）、**元素師**（`elemburst` 元素爆發＝火冰雷三環，依位置決定元素效果；`chainstorm` 連鎖風暴＝雷球連跳並衰減）、**咒術師**（`plague` 疫咒＝範圍持續傷害＋虛弱；`soulleech` 汲魂＝直線抽血回 MP）。每個都有 2 條天賦分支與 Lv3/Lv5 效果。
  - 每個進階職 = 基礎職 5 技能 + 專屬 2 技能（共 7），沿用既有 `TREE_LAYOUTS[7]` 版面。
  - **選角頁改版**：上方固定兩張基礎職大卡（`ch` 118→96），下方一列該系的「進階轉職」晶片。未解鎖顯示灰晶片並標示 `jobUnlockHint()`（例：「法師精通 Lv10」），可見但不可點；解鎖後才吃數字鍵（`jobHotkeyList()`）。原本單列平均分寬在 6 職業時每張只剩 55px，改版後大卡維持 191px。
  - 新機制掛接：`p.holyGuardT`（減傷，`dmgPlayer`）、`p.ccImmuneT`（免疫緩速凍結，update）、`m.burnSpread`（持續傷害在目標死亡時傳染，run.js 擊殺處）。延遲第二段爆發沿用既有 `addSkillZone`。
  - 精通分頁改為 3 欄 × 2 列 compact 卡；技能分頁職業切換列改用到技能秘典鈕之前的完整寬度（6 職 97px）。
  - **修正載入順序 bug**：`applyAdvancedSkillState` 在 `loadMeta()`（早於 systems.js）呼叫 `classSkills()`，此時 `CLASSES`/`baseClassOf` 未定義，會把進階職出戰欄裡的基礎職技能濾掉 → 進階職開局空手。改為載入時只做不依賴職業表的檢查，職業歸屬交給 `revalidateLoadouts()`（main.js 於全部載入後呼叫）。
  - 附 `tests/advance-j1d-smoke.js`；`tests/advance-j1c-smoke.js` 改為直接抽取 systems.js 真正的 `CLASSES`，新增職業時自動納入檢查。
- **J1-E 外觀獎勵** — ✅ 已完成（v0.29.40）：
  - `MASTERY_COSMETIC_TABLE` 定義每職 4 項獎勵：**Lv5／Lv10 角色配色，Lv15／Lv20 職業稱號**，六職共 12 配色 + 12 稱號。由此表自動生成 K1-A 預留的 `COLOR_DEFS`／`TITLE_DEFS`。
  - **配色**走 `drawSprite` 既有的 `recolor` 參數：每個配色帶一張字元對照表 `{ r, '4', '8' }`（`r`＝劍士系甲冑、`4`＝法師系長袍、`8`＝共用金屬鑲邊），所以同一個配色對兩系都有效。`equippedRecolor()` 掛進 render.js 的三處玩家繪製。
  - **稱號**顯示在城鎮角色頭上與角色能力面板抬頭（`equippedTitleText()`／`equippedTitleColor()`）。
  - `syncMasteryCosmetics(job?)` 依目前等級補發，達標即給、不需領取；`recordMasteryRun` 升級時呼叫並把新解鎖回傳（供之後做結算提示），main.js 啟動時全量呼叫一次做舊存檔回溯。重複呼叫不會重複發。
  - 精通分頁下方的靜態三章說明改成**可互動的外觀獎勵軌**：點上方職業卡切換檢視職業（`masteryFocusJob`，卡片有青色外框），已解鎖的獎勵晶片可點擊選用、再點一次取消；未解鎖顯示「？？？」與尚差級數。新增 `masteryBtns` 與對應的點擊處理。
  - 附 `tests/cosmetics-j1e-smoke.js`：資料完整性（每職都有、id/名稱不重複）、門檻剛好達標才發、不會被別職帶解、重複同步不膨脹、未解鎖不可選用，以及**配色對照表必須真的涵蓋精靈圖用到的字元**（否則穿了等於沒穿）與玩家繪製一定要傳 `equippedRecolor()`。
  - 仍待後續（K1 章三）：勝利姿勢、終極技能外觀、職業雕像（Lv21–30 獎勵）。
- **J1-F 平衡與回歸**：確認零戰力、進階職平衡不破壞曲線、遞減合理；固定種子 smoke、桌機/手機/低特效、舊存檔相容。
- （後續）**J2**：弓箭手基礎職 + 其進階職（接 DESIGN-classes 第三職業）。

## 6. 完成標準（J1）

- 基礎職累積精通，Lv10 解鎖其進階職；進階職可於選角頁選用，具專屬技能/天賦、沿用 base 裝備線、獨立精通。
- 精通與所有獎勵**零局內戰力**；經驗來自自然遊玩 + 首次里程碑，同種子遞減。
- 精通分頁可看等級/進度/獎勵軌；至少稱號 + 配色可解鎖選用。
- 不破壞既有存檔；28+ 項 smoke 全綠（含新增職業/精通測試）。

## 7. 仍可調整的決策（預設已選，隨時可改）

- 每基礎職**進階職數量**：預設 2。
- 解鎖後**兩個進階職都可選**（roguelite）vs 永久二選一：預設**都可選**。
- 進階職**是否有自己的精通/再轉職**：預設**有**（保留第三階空間）。
- 進階職**共用 base 裝備線**：預設**共用**。
- 解鎖門檻精通等級：預設 **Lv10**。
