# H1 圖鑑與成就計畫（v0.30）

H1 的目標是把玩家已經體驗過的內容變成「可展示、可累積、有下一步」的收藏。圖鑑在**首次遭遇**時解鎖，之後累計次數與最佳紀錄；成就分探索、技巧、收藏、職業四類，只獎勵外觀（稱號、角色配色、技能外觀、基地裝飾），不放任何永久戰力。所有解鎖狀態存在專屬鍵，不破壞既有存檔格式。

對齊 [ROADMAP.md](ROADMAP.md) §6 v0.30。

## 固定設計契約

- **單一資料來源**：圖鑑列舉一律直接讀現有定義，不複製第二份，避免資料分歧。來源見「共用登錄表」。
- **首遇解鎖**：條目在第一次遭遇（生成／取得／觸發）時標記已解鎖；擊殺數、最佳擊殺時間、取得次數等統計另外累加。未解鎖條目以「？？？」遮罩顯示，不洩漏未見內容。
- **只給外觀**：所有成就與圖鑑獎勵限於稱號、角色配色、技能外觀、基地裝飾；不得提供永久戰力、不設每日進度上限、不要求無意義的極端重複刷取。
- **存檔相容**：新狀態存於專屬 localStorage 鍵（仿 `activityState`），既有 `pixelrogue_save` 位置式編碼**不動**。舊資料讀不到新狀態時一律視為「未解鎖」，不得報錯。存檔碼（文字匯出）納入收藏為**選配**，若做需版本升級到 V4 並補 `V4_LEN`，本階段不強制。
- **不影響戰鬥**：記錄掛勾只讀不寫戰鬥狀態；圖鑑／成就面板只在城鎮選單開啟，不介入地城即時輸入。
- **跨平台**：所有面板支援固定種子 smoke、桌機鍵鼠、手機橫向觸控與低特效顯示。
- **看得到下一步**：離開前顯示「接近完成的 3 個目標」，讓玩家知道再打一局能收到什麼。
- **完成標準**：新玩家在前三局內至少解鎖一項收藏。

## 共用登錄表（資料來源，唯讀）

| 圖鑑類別 | 現有定義來源 |
|---|---|
| 怪物 | `MONSTER_LABEL`（[run.js:469](../src/game/run.js)）＋ `spawnMon` 型別清單（run.js:8）：slime/bat/mush/spore/bomber/charger/icer/splitter |
| Boss | `DUNGEON_BOSS_ORDER` / `DUNGEON_BOSS_DEFS`（[bosses.js:2/13](../src/dungeon/bosses.js)） |
| 詞綴 | `AFFIX_DEFS`（[progression.js:68](../src/game/progression.js)）＋ `GEAR_SETS`（progression.js:13） |
| 卡牌 | `CARDS`（[systems.js:85](../src/game/systems.js)，31 張） |
| 技能／天賦 | `SKILL_DEFS` / `TALENT_EFFECTS` / `BRANCH_NAMES`（progression.js:199/216/212） |
| 事件 | `DUNGEON_EVENT_DEFS`（[data.js:62](../src/dungeon/data.js)） |
| 祝福／詛咒 | `DUNGEON_BLESSING_DEFS` / `DUNGEON_CURSE_DEFS`（[modifiers.js:7/57](../src/dungeon/modifiers.js)） |

## 分批交付

### H1-A：圖鑑共用資料與解鎖基礎

- 建立 `collectionState`（新 localStorage 鍵，例 `pixelrogue_collection_v1`），仿 `activityState` 的 save/load 流程（參照 [progression.js:499/523](../src/game/progression.js)）。
- 內容：`seen`（各類別已解鎖 id 集合）、`stats`（如各怪物擊殺數、各 Boss 最佳擊殺秒數與擊敗次數）、`titles`/`colors`/`skinsUnlocked`、目前選用外觀。
- 提供唯讀 API：`collectionCatalog(category)`（把上表來源整理成統一 `{id,name,unlocked,masked}` 清單）、`collectionUnlock(category,id)`、`collectionStat(...)`、`collectionProgress(category)`（回傳 x/y 與百分比）。
- 只鎖介面契約與資料流，不加任何面板 UI，不改戰鬥數值。附固定種子 smoke：跑一局後驗證對應 id 被標記。

### H1-B：怪物與 Boss 圖鑑

- **掛接點**：`hitMon` 死亡分支（[run.js:509](../src/game/run.js)，已有 `m.type`/`m.bossId`/`m.elite` 與 `kills++`）呼叫 `collectionUnlock('monster', m.type)` 與擊殺數累加；Boss 於 `recordDungeonBossEnd('kill',…)`（run.js:543）記錄擊敗次數與最佳時間。首次「遭遇」（生成即算看過）可在 `spawnMon`（run.js:8）補 `collectionUnlock`。
- 面板：怪物格點（名稱、群系、擊殺數、簡述），Boss 頁（外觀色、招式名、擊敗次數、最快時間、掉落收藏）。未解鎖以遮罩顯示。
- 交付檢查：擊殺各型別後圖鑑對應解鎖、統計正確；低特效與手機版排版正常。

### H1-C：裝備詞綴、卡牌、技能、事件圖鑑

- 純靜態目錄類，首次遇到即解鎖：
  - 詞綴／套裝：附魔或掉落出現該詞綴時解鎖（附魔流程 progression.js ~141；掉裝 `genGear`）。
  - 卡牌：`applyCard`（[interface.js](../src/game/interface.js) 對應處）解鎖該卡並記錄抽到／升等。
  - 技能：`classSkills`／施放時解鎖，天賦分支於投點時解鎖。
  - 事件／祝福／詛咒：觸發或選取時解鎖（core.js 事件處理、modifiers 選取流程）。
- 面板沿用 H1-B 格點框架，切類別分頁；顯示條目效果文字（讀各定義的 `desc`/`summary`/`text`）。
- 交付檢查：各來源觸發後解鎖；固定種子局可解鎖可預期集合。

### H1-D：探索、技能、收集等成就

- 建立 `ACHIEVEMENT_DEFS` 目錄（四類：探索、技巧、收藏、職業），完全仿 `activityState` 的 stat 累加與 claim 模式（[progression.js:543/551/562](../src/game/progression.js)）。
- **進度掛勾沿用現有計數點**：`activityProgress(stat,amount)` 已在 `hitMon` 等處呼叫（kills/floors/skills/bosses/elites/potions）；成就在同處增量，另加圖鑑完成度來源（收藏類讀 `collectionProgress`）。
- 成就 shape：`{ id, category, title, desc, target, reward:{title|color|skin|decor} }`；狀態存 `collectionState.achievements`。
- 面板：四類分頁、進度條、可領取獎勵；領取呼叫 `claimAchievement(id)`（仿 `claimActivityMilestone`）。
- 契約：不要求無意義極端刷取（例如「擊殺 X 次」設在自然遊玩可達範圍），新手前三局可達成至少一項。

### H1-E：稱號、角色配色、技能外觀等獎勵

- 引入目前**尚不存在**的外觀系統（僅有光環 `AURA_DEFS`/`equipAura` 可當模板，progression.js:469/575）：
  - `TITLE_DEFS`（稱號）、`COLOR_DEFS`（角色配色，套用於玩家繪製）、`SKIN_DEFS`（技能外觀變體）。基地裝飾可延後或先做 1～2 項。
  - 擁有與選用狀態存 `collectionState`；提供 `equipTitle/equipColor/equipSkin`（仿 `equipAura`）。
- 套用點：稱號顯示於城鎮名牌與結算；配色接入玩家繪製（render.js 玩家繪製處）；技能外觀接入技能特效繪製。
- 交付檢查：解鎖→可選用→即時生效並存檔；未解鎖不可選。

### H1-F：接近完成提示、手機介面、平衡與回歸收尾

- **接近完成提示**：在城鎮／選單顯示最接近完成的 3 個目標（成就或圖鑑進度），排序取「剩餘量最小且未完成」。可加入現有 `hasActivityReward()` 的 `!` 徽章家族（town.js:187/722）。
- **選單整合**：於 `tabs` 陣列（[town.js:714](../src/game/town.js)）新增「圖鑑」與「成就」分頁（或合併為一個「收藏」分頁含子頁），補 dispatch（town.js:742）、點擊處理（interface.js:564/604）與各自 `Btns` 陣列的清空／配置。手機命中區與桌機共用。
- **平衡與回歸**：確認成就目標值落在自然遊玩可達範圍、無外觀給戰力；跑固定種子 smoke、語法、正式頁、手機橫向、低特效、死亡／撤退、舊存檔相容與更新紀錄回歸。

## H1 完成標準

- 六類圖鑑（怪物、Boss、詞綴／套裝、卡牌、技能、事件／祝福詛咒）皆可於自然遊玩逐步解鎖並展示統計。
- 四類成就可追蹤、可領取，獎勵僅外觀；新玩家前三局內至少解鎖一項收藏。
- 稱號／配色／技能外觀可解鎖、選用、即時生效並持久化。
- 離開前可見「接近完成的 3 個目標」。
- 全流程不改動 `pixelrogue_save` 既有編碼；舊存檔載入不報錯、視為未解鎖。
- 桌機／手機／低特效與固定種子 smoke 全數通過。
