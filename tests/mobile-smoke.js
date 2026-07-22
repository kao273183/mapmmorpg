const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGameSource } = require('./helpers/game-source');

const root = path.resolve(__dirname, '..');
const mobileSource = fs.readFileSync(path.join(root, 'src', 'mobile.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dungeonSmoke = fs.readFileSync(path.join(root, 'tests', 'dungeon-smoke.html'), 'utf8');
const game = loadGameSource(root);

function makeMobileContext({ coarse, portrait, width, height = 540, viewportWidth = width, viewportHeight = height }) {
  const listeners = {};
  const prompt = { attrs:{}, setAttribute(key, value) { this.attrs[key] = value; } };
  const button = { disabled:false, addEventListener(type, fn) { listeners['button:' + type] = fn; } };
  const status = { textContent:'' };
  const classes = new Set();
  const styles = {};
  const media = query => ({
    matches:query.includes('pointer') ? coarse : portrait,
    addEventListener(type, fn) { listeners['media:' + query + ':' + type] = fn; }
  });
  const documentElement = {
    style:{ setProperty(name, value) { styles[name] = value; } },
    classList:{ toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
    requestFullscreen:async () => {}
  };
  const document = {
    fullscreenElement:null,
    documentElement,
    getElementById(id) { return id === 'rotatePrompt' ? prompt : id === 'landscapeButton' ? button : id === 'landscapeStatus' ? status : null; },
    addEventListener(type, fn) { listeners['document:' + type] = fn; }
  };
  const window = {
    innerWidth:width, innerHeight:height,
    matchMedia:media,
    addEventListener(type, fn) { listeners['window:' + type] = fn; },
    visualViewport:{ width:viewportWidth, height:viewportHeight, addEventListener(type, fn) { listeners['viewport:' + type] = fn; } }
  };
  const screen = { orientation:{ lock:async () => {} } };
  return { context:{ document, window, screen, console }, prompt, button, status, classes, styles, listeners };
}

(async () => {
  let test = makeMobileContext({ coarse:true, portrait:true, width:844 });
  vm.createContext(test.context);
  vm.runInContext(mobileSource, test.context, { filename:'mobile-portrait.js' });
  assert.strictEqual(test.prompt.attrs['aria-hidden'], 'false', '手機直向時必須顯示橫放提示');
  assert.ok(test.classes.has('mobile-portrait'));
  assert.ok(test.listeners['button:click'], '橫向按鈕必須可操作');
  await test.listeners['button:click']();
  assert.strictEqual(test.button.disabled, false);
  assert.ok(test.status.textContent.includes('請稍候') || test.status.textContent.includes('請手動將手機橫放'), '仍為直向時應提供旋轉狀態');

  test = makeMobileContext({ coarse:true, portrait:false, width:844, height:540, viewportWidth:780, viewportHeight:390 });
  vm.createContext(test.context);
  vm.runInContext(mobileSource, test.context, { filename:'mobile-landscape.js' });
  assert.strictEqual(test.prompt.attrs['aria-hidden'], 'true', '手機橫向時不得遮住遊戲');
  assert.ok(!test.classes.has('mobile-portrait'));
  assert.ok(test.classes.has('mobile-short-landscape'));
  assert.strictEqual(test.styles['--app-width'], '780px', '橫向寬度應跟隨 Safari 可視區域');
  assert.strictEqual(test.styles['--app-height'], '390px', '橫向高度應扣除 Safari 工具列');
  assert.strictEqual(test.styles['--canvas-width'], '693px', 'Canvas 應以較短邊維持完整 16:9');
  assert.ok(test.listeners['viewport:resize'] && test.listeners['viewport:scroll'], 'Safari 工具列變化時應重新量測可視區域');

  assert.ok(html.includes('viewport-fit=cover'), '頁面必須支援瀏海安全區');
  for (const side of ['top', 'right', 'bottom', 'left']) assert.ok(css.includes('safe-area-inset-' + side), '缺少 safe area：' + side);
  assert.ok(css.includes('@media (pointer:coarse)'));
  assert.ok(css.includes('aspect-ratio:16/9'));
  assert.ok(css.includes('height:var(--app-height)'), '畫布容器必須使用實際可視高度');
  assert.ok(css.includes('width:var(--canvas-width)'), '手機 Canvas 必須使用等比例計算寬度');
  assert.ok(css.includes('touch-action:none'));
  assert.ok(css.includes('canvas{visibility:hidden;pointer-events:none;}'), '手機直向時畫布應停止互動');

  assert.ok(/touchstart[\s\S]*eventPanel \|\| dungeonPanelOpen\(\)[\s\S]*handleTap/.test(game), '觸控事件面板必須共用按鈕命中流程');
  assert.ok(/function touchPos[\s\S]*W \/ r\.width[\s\S]*H \/ r\.height/.test(game), '觸控座標必須依畫布縮放換算');
  assert.ok(/touchcancel[\s\S]*touchEnd/.test(game), '觸控取消必須釋放按鍵');
  assert.ok(/eventChoiceBtns[\s\S]*chooseFloorEvent\(b\.choice\)/.test(game), '三選一事件必須支援觸控按鈕');
  assert.ok(game.includes('const virtualJoystick'), '左側移動控制應改為虛擬搖桿');
  assert.ok(game.includes('window.__FORCE_TOUCH_CONTROLS__ === true'), '固定瀏覽器畫面應能顯示觸控控制');
  assert.ok(css.includes('html.force-touch-controls canvas'), '固定瀏覽器畫面應套用手機 Canvas 規則');
  assert.ok(/function updateVirtualJoystick[\s\S]*arrowleft[\s\S]*arrowright[\s\S]*arrowdown/.test(game), '搖桿必須支援左右移動與下跳方向');
  assert.ok(/touchstart[\s\S]*virtualJoystickAt[\s\S]*updateVirtualJoystick/.test(game), '觸控開始必須能接管搖桿');
  assert.ok(/touchmove[\s\S]*prev === virtualJoystick[\s\S]*updateVirtualJoystick/.test(game), '拖曳時搖桿必須持續更新方向');
  assert.ok(/drawTouchUI[\s\S]*arc\(virtualJoystick\.x[\s\S]*knobX/.test(game), '搖桿底座與旋鈕必須可見');
  assert.ok(dungeonSmoke.includes("mode === 'mobile-joystick'"), '瀏覽器測試頁必須提供固定搖桿畫面');
  assert.ok(dungeonSmoke.includes("style.setProperty('--app-height'"), '固定瀏覽器畫面必須能模擬 Safari 可視高度');

  console.log('mobile landscape and touch smoke test passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
