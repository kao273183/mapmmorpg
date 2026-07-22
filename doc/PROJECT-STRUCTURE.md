# 專案結構

目前仍使用瀏覽器傳統 `<script>` 依序載入；F1-A 只整理路徑，不改成 ES Modules，也不加入打包工具。

```text
mapmmorpg/
├─ index.html                 正式入口與腳本載入順序
├─ style.css                  全域與手機版樣式
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
│  └─ game.js                 主遊戲；F1-B 再按系統拆分
├─ tests/                     Node smoke tests 與固定瀏覽器情境
├─ doc/                       設計、計畫、Roadmap 與變更紀錄
└─ audio/ item/ Skill/ ...    素材；F1-C 再分 runtime/source
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
12. `src/game.js`

這些檔案目前共用瀏覽器全域作用域。移動或拆檔時必須同步更新正式入口、固定視覺入口與 smoke tests，並跑完整回歸。

## 放置規則

- 新的地城規則、資料與介面分別放入 `src/dungeon/` 對應模組，不再新增根目錄腳本。
- 圖集產生結果放入 `src/data/`；圖片與音效原檔仍屬素材，不放進程式目錄。
- `src/game.js` 暫時保留非地城主流程；F1-B 會分批拆出核心、戰鬥、城鎮與渲染模組。
- 歷史文件可保留當時檔名；仍具現行效力的設計與測試必須引用目前路徑。
- 素材目錄在 F1-C 前不搬動，避免程式結構與大量二進位重新命名混在同一批。
