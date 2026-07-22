# 專案結構

目前仍使用瀏覽器傳統 `<script>` 依序載入。程式已按責任分層，但不改成 ES Modules，也不加入打包工具。

> F1-A～D 已於 v0.29.7 完成：程式分層、主遊戲拆分、素材分區、完整回歸與資源版本契約均已落地。

```text
mapmmorpg/
├─ index.html                 正式入口與腳本載入順序
├─ style.css                  全域與手機版樣式
├─ assets/
│  ├─ README.md               素材分區與授權維護規則
│  ├─ runtime/                瀏覽器會直接請求的遊戲素材
│  │  ├─ audio/               音效與授權
│  │  ├─ equipment/           目前使用的裝備圖示
│  │  └─ skills/              技能圖示與動畫圖集
│  └─ source/                 不由遊戲直接載入的原始素材包
│     ├─ item-library/        備選裝備與道具素材
│     ├─ kenney-rpg-urban-pack/ 原始城市圖塊包
│     └─ itemsheet.png        內嵌道具圖集的來源圖片
├─ src/
│  ├─ data/                   內嵌圖集資料
│  │  ├─ tiles.js
│  │  └─ items.js
│  ├─ dungeon/                地城資料與功能模組
│  │  ├─ data.js
│  │  ├─ bosses.js
│  │  ├─ balance.js
│  │  ├─ core.js
│  │  ├─ hazards.js
│  │  ├─ events.js
│  │  ├─ trials.js
│  │  └─ ui.js
│  ├─ mobile.js               手機方向與全螢幕處理
│  └─ game/                   主遊戲，依原執行順序分層
│     ├─ bootstrap.js         畫布、素材、音效與像素角色
│     ├─ progression.js       永久成長、技能、存檔與活躍任務
│     ├─ systems.js           局內狀態、卡片、屬性與裝備生成
│     ├─ run.js               樓層生成、結算、特效與戰鬥
│     ├─ interface.js         輸入、設定、強化與觸控介面
│     ├─ update.js            固定更新邏輯
│     ├─ render.js            戰鬥、角色與覆蓋介面繪製
│     ├─ town.js              城鎮與基地選單
│     └─ main.js              固定 60 Hz 主迴圈與啟動
├─ tests/                     Node smoke tests 與固定瀏覽器情境
├─ doc/                       設計、計畫、Roadmap 與變更紀錄
└─ README.md                  專案入口說明
```

## 腳本載入契約

`index.html` 與 `tests/dungeon-smoke.html` 必須維持相同的核心順序：

1. `src/data/tiles.js`
2. `src/data/items.js`
3. `src/dungeon/data.js`
4. `src/dungeon/bosses.js`
5. `src/dungeon/balance.js`
6. `src/dungeon/core.js`
7. `src/dungeon/hazards.js`
8. `src/dungeon/events.js`
9. `src/dungeon/trials.js`
10. `src/dungeon/ui.js`
11. `src/mobile.js`（正式入口）
12. `src/game/bootstrap.js`
13. `src/game/progression.js`
14. `src/game/systems.js`
15. `src/game/run.js`
16. `src/game/interface.js`
17. `src/game/update.js`
18. `src/game/render.js`
19. `src/game/town.js`
20. `src/game/main.js`

這些檔案目前共用瀏覽器全域作用域。移動或拆檔時必須同步更新正式入口、固定視覺入口與 smoke tests，並跑完整回歸。

## 放置規則

- 新的地城規則、資料與介面分別放入 `src/dungeon/` 對應模組，不再新增根目錄腳本。
- 圖集產生結果放入 `src/data/`；圖片與音效原檔仍屬 `assets/`，不放進程式目錄。
- 非地城主流程依既有執行順序放在 `src/game/`；新增跨檔宣告時必須同步維護載入契約與測試 helper。
- 歷史文件可保留當時檔名；仍具現行效力的設計與測試必須引用目前路徑。
- `assets/runtime/` 只放瀏覽器可能直接請求的檔案；原始素材包、備選圖檔與產生內嵌圖集的來源放在 `assets/source/`。
- 新增或搬動 runtime 素材時，必須同步更新程式路徑、授權文件與結構 smoke test。

## 版本與回歸契約

- 正式入口與固定視覺入口的樣式、地城、手機及主遊戲資源使用同一個發行版本；內嵌圖集可維持獨立快取版本。
- 搬動 runtime 素材或改變載入順序時必須提升發行版本，避免舊快取腳本請求已退役路徑。
- 合併前必須執行全部 `tests/*-smoke.js`、所有 JavaScript 語法檢查，並以瀏覽器驗證正式頁、手機橫向與 runtime 素材。
