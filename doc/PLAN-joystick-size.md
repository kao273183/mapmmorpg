# PLAN — 虛擬搖桿自由調整大小

> 目標：讓玩家自己把左下角虛擬搖桿調到順手的大小，設定會記住。
> 現況：搖桿已重構為「單一 size 係數驅動」+ 放大預設 + 本機記憶，UI 尚未做。本文件規劃調整介面。

---

## 1. 已完成的地基（v0.29.15）

實作在 [src/game/interface.js](../src/game/interface.js)：

- **單一係數驅動**：`applyVirtualJoystickSize(size)` 由一個 `size`(1 = 原始 70px 半徑)推導**全部**尺寸 —— 外圈 `radius`、觸控範圍 `hitRadius`、搖桿桿程 `knobRange`、十字 `cross`、握把 `knobR`，以及中心座標。
- **左下角錨點**：左緣固定 `x=30`、底緣固定 `y=474`，放大往右上長，**任何大小都不出畫面、不擋右側按鈕**。
- **範圍與預設**：`JOY_SIZE_MIN=0.8`、`JOY_SIZE_MAX=2.0`、`JOY_SIZE_DEFAULT=1.35`。
- **本機記憶**：`localStorage['joystickSize']`，開場 `initJoystickSize()` 讀回；`saveJoystickSize()` 待 UI 呼叫。

> 所以「調整大小」剩下的只有**做一個改 `size` 的 UI**，改完呼叫 `applyVirtualJoystickSize()` + `saveJoystickSize()` 即可，邏輯全通。

---

## 2. 調整方式：三種方案比較

| 方案 | 操作 | 優點 | 缺點 |
|------|------|------|------|
| **A. 設定頁滑桿/±按鈕**（建議） | 開設定 → 拖滑桿或點 −／＋ → 即時預覽 | 精準、可重置、桌機手機通用、發現性高 | 要進設定頁 |
| B. 雙指縮放搖桿本體 | 直接在搖桿上 pinch 放大縮小 | 直覺、不離開遊戲 | 易誤觸(玩到一半縮到)、需長按進「編輯模式」保護、桌機沒手勢 |
| C. 拖搖桿邊緣縮放 | 長按進編輯 → 拖外圈調大小 | 所見即所得 | 命中判定複雜、和移動操作衝突 |

**建議走 A**，最穩、最好做，且與現有「設定視窗(§3)」天然整合；B/C 可日後當進階選項再加。

---

## 3. 建議實作（方案 A）

### 3.1 放哪裡
接到現有的**畫面內設定視窗**（`renderSettings`/`settingsBtns` 那套，已不用 prompt）。新增一列「搖桿大小」。

### 3.2 控制項
一列三元件：`[ − ]  ▮▮▮▮▮▯▯  [ ＋ ]`
- `−` / `＋`：每點一下 `size ± 0.1`（夾在 0.8–2.0）。
- 中間長條：目前大小的比例填色（可點/拖跳到該值，桌機手機皆可）。
- 右側顯示百分比：`135%`。
- 一顆「重置」回 `JOY_SIZE_DEFAULT`。

### 3.3 即時預覽
設定視窗開啟且在 play 疊層時，右下角畫一個**目前 size 的搖桿縮影**，調整時同步變化 —— 玩家看得到差異再確認。（設定視窗通常在城鎮/暫停開，畫個示意圈即可。）

### 3.4 存檔
每次變更 → `applyVirtualJoystickSize(newSize)` → `saveJoystickSize()`。即時生效、即時記住，不需「儲存」按鈕。

### 3.5 掛勾（現成，無需改邏輯）
```
setJoystickSize(v){ applyVirtualJoystickSize(v); saveJoystickSize(); }
// − 按鈕: setJoystickSize(virtualJoystick.size - 0.1)
// + 按鈕: setJoystickSize(virtualJoystick.size + 0.1)
// 長條點擊: setJoystickSize(0.8 + ratio * (2.0 - 0.8))
// 重置:    setJoystickSize(JOY_SIZE_DEFAULT)
```

---

## 4. 邊界與注意

- **夾值**：`applyVirtualJoystickSize` 已 clamp 0.8–2.0，UI 不必再判。
- **極大值不出界**：錨點在左下角，size=2.0 時 radius=140、右緣 x=310、頂緣 y=194，仍在左半、不壓右側按鈕(x>550)。已驗證幾何安全。
- **只影響手機觸控**：搖桿只在 `isTouch` 時渲染/作用；桌機調整仍會存，換到手機生效。
- **不動平衡**：純 UI 尺寸，不改任何數值判定(`joystickVectorX/Y` 閾值不變)。

---

## 5. 里程碑

1. [x] 地基：size 係數化 + 放大預設 + 記憶（v0.29.15）
2. [x] 設定列 UI：−／＋／拖曳長條／重置 + 百分比（方案 A，v0.29.15）
3. [ ] 即時預覽縮影（§3.3，選配）
4. [ ] （選配）雙指/拖曳縮放（方案 B/C）作為進階手勢

> 已完成第 1、2 項：設定頁「手機搖桿大小」可 −／＋、拖長條、重置(80%～200%)，即時生效並記住。
> 實測：掛勾夾值正確、handleTap 路由到四個控制項皆命中、長條左右極值與百分比顯示正確、200% 幾何仍不出界。
