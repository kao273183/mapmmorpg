# 素材目錄

素材依是否會被瀏覽器直接載入分成兩區：

- `runtime/`：正式遊戲會請求的音效、裝備圖示、技能圖示與技能動畫。
- `source/`：備選素材包與內嵌圖集的來源檔，不應由 `index.html` 或 `src/` 直接載入。

## 維護規則

- 從 `source/` 選用素材時，只將實際需要的檔案整理至 `runtime/`，並以 runtime 路徑接入程式。
- 搬動 runtime 素材後，必須執行 `tests/project-structure-smoke.js` 與完整 smoke tests。
- 新增第三方素材時，必須保留來源及授權文件；缺少明確授權的素材不得進入正式公開版本。
- 音效授權記錄位於 [`runtime/audio/LICENSE.md`](runtime/audio/LICENSE.md)；技能圖示與技能動畫的記錄位於 [`runtime/skills/LICENSE.md`](runtime/skills/LICENSE.md)；Kenney 原始圖塊授權位於 [`source/kenney-rpg-urban-pack/License.txt`](source/kenney-rpg-urban-pack/License.txt)。

## 目錄配置

```
assets/
  source/<pack-name>/          原始包 + SOURCE.txt（來源網址、作者、授權、取得日期）
  runtime/audio/               音效 + LICENSE.md
  runtime/equipment/           裝備圖
  runtime/skills/icons/        技能圖示（normal/ 與 gray/ 同名成對）
  runtime/skills/vfx/          技能動畫圖集（水平長條，每格 72×72）
  runtime/skills/LICENSE.md    技能素材的來源與授權記錄
```

> ⚠️ 現有的技能圖示與技能動畫**尚無來源記錄**，詳見 [`runtime/skills/LICENSE.md`](runtime/skills/LICENSE.md)。
