# PLAN — PWA 化(可安裝、可離線、自動更新）

> 目標：把《像素地城》做成「加到主畫面」即可離線遊玩的 PWA，版本更新全自動、玩家無感、無需重加。
> 定位：這是上架 App（Capacitor）之前的驗證階段；此階段 `src/` 遊戲程式**完全不改**，只在外圍加殼。

---

## 1. 範圍與非目標

**要做：**
- Web App Manifest（可安裝、獨立視窗、橫向、圖示）
- Service Worker（離線快取 + 版本更新流程）
- 「有新版本」角落提示 UI
- App 圖示 / 啟動配色

**先不做（留給後續）：**
- 上架 App Store / Google Play（→ 之後的 Capacitor 階段，見 §11）
- 推播通知、原生震動（Capacitor plugin，非 PWA 必要）
- 存檔雲端同步（目前 localStorage 已足夠）

---

## 2. 架構總覽

現況：`index.html` 直接載入 ~20 支 `src/**/*.js`（全帶 `?v=0.29.x`）＋ `style.css` ＋ 執行期素材 `assets/runtime/`（音效 / 裝備 / 技能圖示，約 6.8MB）。

PWA 只在**根目錄**加三個新檔 + 改 `index.html` 兩行：

```
mapmmorpg/
├── index.html            ← 加 <link rel="manifest"> + 註冊 SW 的 <script>
├── manifest.webmanifest  ← 新增：App 身分與圖示
├── sw.js                 ← 新增：Service Worker（快取 + 更新）
├── src/pwa.js            ← 新增：SW 註冊 + 新版偵測 + 提示 UI（唯一新增的 src 檔）
├── assets/
│   ├── runtime/          ← 要快取（執行期真的會載入）
│   ├── source/           ← 不快取（11MB 素材原稿，執行不需要）
│   └── icons/            ← 新增：PWA 圖示（見 §6）
```

**關鍵原則：只快取 `assets/runtime/` 與 `src/`，絕不快取 `assets/source/`。**

---

## 3. manifest.webmanifest 規劃

```jsonc
{
  "name": "像素地城",
  "short_name": "像素地城",
  "description": "2D 橫向捲軸 Roguelite 動作 RPG",
  "start_url": "./index.html",
  "scope": "./",
  "display": "fullscreen",        // 全螢幕沉浸，藏掉瀏覽器列
  "orientation": "landscape",     // 鎖橫向（與遊戲一致）
  "background_color": "#14162b",  // 啟動底色，對齊現有 theme-color
  "theme_color": "#14162b",
  "icons": [
    { "src": "assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

> `index.html` 目前已有的 `apple-mobile-web-app-capable`、`theme-color`、`screen-orientation` meta 保留 —— iOS Safari 不吃 manifest 的 orientation，靠這些 meta 補。

---

## 4. Service Worker 快取策略

### 4.1 版本綁定（單一真相來源）
- SW 內用一個常數 `const VERSION = '0.29.14'`，快取名稱 = `pixel-dungeon-v0.29.14`。
- **每次發版把這個 VERSION 跟著 `?v=` 一起 bump。** 這就是觸發更新的開關。
- 舊版快取在新 SW `activate` 時整批刪除（見 4.4）。

### 4.2 預快取清單（precache，安裝時抓齊）
安裝時抓「App 殼」——沒有它就開不起來的核心：

```
index.html, style.css, manifest.webmanifest
src/ 下全部 .js（~20 支，含 ?v= 查詢字串，需與 index.html 完全一致）
assets/icons/*
```

> ⚠️ 陷阱：precache 的 URL **必須連 `?v=0.29.14` 一起列**，否則 SW 存的 key 與頁面請求的 key 對不上，會 cache miss。建議寫個小產生器從 `index.html` 掃出清單，避免手動漏檔（見 §8 步驟 3）。

### 4.3 執行期快取（runtime cache，用到才抓）
`assets/runtime/`（6.8MB 音效 / 圖示）不必開場全抓，改 **Cache-First 動態快取**：

```
fetch 事件：
  若 request 命中 precache → 直接回快取
  否則若 URL 屬 assets/runtime/ → Cache-First：
       快取有 → 回快取；沒有 → 抓網路 → 存進 runtime 快取 → 回應
  其他（assets/source/、外部）→ 直接走網路，不快取
```

好處：首次安裝快（只抓殼），素材邊玩邊快取，第二次進場就全離線。

### 4.4 更新流程（預設策略 + 提示）
採「**下一次啟動生效** + 角落提示」，最穩、不會玩到一半被換版打斷：

```
1. 頁面每次載入時 navigator.serviceWorker.register('sw.js')
2. 瀏覽器背景比對 sw.js 有無位元組差異（VERSION 變了就有差）
   → 有 → 下載新 SW → install（precache 新版檔）→ 進入 waiting
3. pwa.js 監聽 registration 的 updatefound / waiting
   → 顯示角落提示：「🔄 有新版本，重開生效」
4. 玩家自然在下一場冒險前重開 App → 新 SW activate → 清舊快取 → 全新版
```

- 預設**不**用 `skipWaiting()`（避免遊戲中途換版）。
- 若日後想「按一下立即更新」：提示改成按鈕 → 點擊 → `postMessage({type:'SKIP_WAITING'})` → SW `skipWaiting` + `clients.reload`。先不做，留掛勾。

---

### 4.5 手機更新可靠性（重要）
桌機瀏覽器多數是「每次開都重新導覽」，`load` 時檢查即可。**但手機不同**：iOS/Android 從背景喚回 App 時，**常常不重新載入頁面**，只是把凍結畫面叫回 —— 只在 `load` 檢查會**偵測不到新版**。

因此 `pwa.js` 加上**主動偵測**：
```
- visibilitychange(App 回到前景) → checkForUpdate()
- 每 30 分鐘定時 → checkForUpdate()
checkForUpdate：fetch('index.html', {cache:'no-store'}) 重讀 <meta app-version>
  版號比目前新 → register('sw.js?v=新版') → 裝好進 waiting → 彈提示
  版號相同     → reg.update() 再對一次(保險)
```
效果：玩家把 App 切走再切回來，就會主動抓一次版號；伺服器已是新版就立刻出現「重開生效」提示，**不必手動整頁重載**。

**已實測(桌機模擬手機喚回)**：不重載頁面、只觸發 visibilitychange → 成功偵測 0.29.15 → 新 SW 進 waiting + 提示彈出 + 新殼快取建立。✅

**殘留限制(誠實揭露)**：
- iOS 對 PWA 的背景更新仍比 Android 保守；最保險是「完全關掉 App 再開」= 冷啟動，必定拿到新版。visibilitychange 已涵蓋大多數喚回情境。
- 喚回當下若**沒網路**，抓不到新版號 → 不更新(下次前景 + 有網路再試)。這是合理行為。
- 提示只是「告知」；waiting 的新 SW 會在**下次冷啟動(無其他分頁控制時)自動接管**，玩家重開即新版。

## 4.6 安裝提示（install.js）

「加到主畫面」的**觸發方式各平台不同**，已做自訂 UI 接管：

| 平台 | 行為 |
|------|------|
| **Android / 桌機 Chrome·Edge** | 攔截 `beforeinstallprompt` → 顯示自訂「📥 安裝到桌面」按鈕(左上)→ 點了才跳系統安裝框，時機/外觀可控 |
| **iOS Safari** | **無 `beforeinstallprompt`(Apple 不支援)** → 顯示底部引導列「📲 點 分享 → 加入主畫面」，可 ✕ 關閉並記住(localStorage) |
| **已安裝(standalone)** | 全部不顯示；`appinstalled` 事件也會收掉按鈕 |

- iPadOS 偵測：新 iPad 的 UA 會偽裝成 Mac，用 `navigator.maxTouchPoints > 1` 補判。
- **已實測**：合成 `beforeinstallprompt` → 按鈕出現、點擊呼叫 `prompt()`、接受後移除；iOS 引導列渲染正確。✅
- 前置條件同 §10：安裝提示只有在 **HTTPS 部署**後、瀏覽器判定「可安裝」才會由 Android 觸發；iOS 引導列則一律顯示(因為它本來就只能手動)。

## 5. 新版提示 UI（pwa.js）

- 位置：畫面右上角，不擋 HUD、不擋觸控按鍵。
- 樣式：像素風小膠囊，`background:#14162b`、亮邊、`🔄 新版本 · 重開生效`。
- 行為：偵測到 waiting 才出現；玩家重開後自然消失。
- 不打斷任何遊戲流程，純被動提示。

---

## 6. 圖示與啟動畫面需求

**要產出（可從現有像素素材裁 / 放大，nearest-neighbor 保持像素感）：**
| 檔案 | 尺寸 | 用途 |
|------|------|------|
| `icon-192.png` | 192² | Android 主畫面 |
| `icon-512.png` | 512² | 安裝 / splash |
| `icon-maskable-512.png` | 512²，四周留 ~20% 安全邊 | Android 自適應圖示（圓 / 方 / 水滴不被裁） |
| `apple-touch-icon.png` | 180² | iOS 主畫面（iOS 不吃 maskable，需獨立方圖） |

- iOS 啟動畫面：靠 `background_color` + 圖示自動生成即可，先不手刻 splash。
- 圖示建議：主角像素頭像或「地城入口」意象，底色用 `#14162b` 統一。

---

## 7. 離線行為與存檔

- 遊戲進度（靈魂、永久強化、倉庫）目前存 **localStorage** → PWA 下照常運作、離線可讀寫，**不需改**。
- Service Worker 只快取「靜態資源」，不碰 localStorage，兩者互不干擾。
- 之後 Capacitor 階段再把 localStorage 換成原生 `Preferences`（更不易被系統清除）——非本階段工作。

---

## 8. 實作步驟（checklist）— ✅ 已完成 @ v0.29.14

1. [x] 產出 4 張圖示放 `assets/icons/`（Node PNG 產生器畫像素傳送門 + sips 縮圖）
2. [x] 新增 `manifest.webmanifest`
3. [x] **改用動態探索取代靜態清單**：SW 於 install 時 `fetch('index.html')` 解析出所有 `src=`/`href=`（含 `?v=`），無需手維護清單 → 消除「漏 `?v=`」與「三處同步」風險
4. [x] 新增 `sw.js`：cache 名綁註冊 `?v=`、install 動態預快取、activate 清舊快取、fetch 分流（殼 Cache→runtime Cache-First→其餘 network）
5. [x] 新增 `src/pwa.js`：讀 `<meta name="app-version">` → 以 `sw.js?v=版本` 註冊 → waiting 偵測 → 右上角提示膠囊
6. [x] `index.html` 加 `app-version` meta、`manifest`、`apple-touch-icon`、`src/pwa.js`；`style.css` 加提示膠囊樣式
7. [x] 驗證：SW active、殼快取 30 檔、runtime 自動快取 16 音效、版本 bump → 新版進 waiting + 提示彈出、舊快取清除

### 發版流程（一步到位）
> 你現有的「把 `0.29.14` 全檔 find-replace 成新版號」動作**同時**會更新 `<meta name="app-version">`。
> meta 一變 → `sw.js?v=` 變 → 觸發更新 → SW 重新探索 index.html 抓新版檔案。**不需再手動維護任何清單。**

---

## 9. 測試驗證

- **可安裝**：Chrome DevTools → Application → Manifest 無錯、可觸發安裝。
- **離線**：安裝後開飛航模式 → 冷啟動 → 能進遊戲、素材不缺。
- **更新**：bump VERSION 重新部署 → 重開 → 出現新版提示 → 再重開 → 確認載到新版、舊快取已清。
- **Lighthouse PWA 稽核**：目標全綠（installable + offline）。
- **雙裝置**：至少 iOS Safari 一台 + Android Chrome 一台實測「加到主畫面」與橫向鎖定。

---

## 10. 風險與注意事項

| 風險 | 說明 / 因應 |
|------|------|
| **SW 需要 HTTPS** | localhost 例外可測；正式必須 HTTPS（GitHub Pages / Netlify / Cloudflare Pages 皆免費且原生支援）。 |
| **file:// 不能跑 SW** | 現在的預覽是 file://，PWA 一定要起本機 server 或部署後才驗得到。 |
| **precache 漏 `?v=`** | 最常見的 cache miss 來源；務必自動生成清單，勿手抄。 |
| **iOS PWA 限制** | iOS 對 PWA 支援較保守（無安裝橫幅、部分 API 缺）；能「加到主畫面」全螢幕玩即達標，進階能力等 Capacitor。 |
| **快取吃空間** | runtime 6.8MB + 殼 <1MB，總量小，可接受；`assets/source` 已排除。 |
| **改版三處要同步** | `?v=`、VERSION、precache 清單不一致會導致「更新不生效」或「載到半新半舊」。用步驟 3 的產生器一次搞定。 |

---

## 11. 與後續 Capacitor（上架 App）的銜接

PWA 這層做完，Capacitor 幾乎是「再包一層」：

- Capacitor 直接把整包 `index.html + src + assets/runtime` 當 `webDir`，遊戲碼一樣不改。
- 差異只在：改用原生 `Preferences` 存檔、接 `Haptics` 打擊震動、`@capacitor/app` 處理返回鍵、之後 IAP 內購。
- 也就是說 **PWA 投入不會浪費**，是 Capacitor 的子集 + 先行驗證。

---

## 12. 建議節奏

1. 先做 §8 步驟 1–6，部署到 GitHub Pages（或本機 HTTPS）→ 手機「加到主畫面」實測。
2. 手感 / 離線 OK 後，再決定是否進 Capacitor 出雙平台上架。

> 一句話：**加一次主畫面，之後每次 push 新版玩家重開就生效，全程無需重加、無需審核。**
