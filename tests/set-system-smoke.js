'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGameSource } = require('./helpers/game-source');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/dungeon/modifiers.js'), 'utf8') + '\n' + loadGameSource(root);
const gradient = { addColorStop() {} };
const canvasContext = new Proxy({
  setTransform() {}, drawImage() {}, fillRect() {}, strokeRect() {}, beginPath() {}, arc() {}, ellipse() {}, fill() {}, stroke() {},
  save() {}, restore() {}, translate() {}, scale() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, fillText() {},
  createRadialGradient() { return gradient; }, createLinearGradient() { return gradient; }, measureText(text) { return { width:String(text).length * 8 }; }
}, { get(target, key) { return key in target ? target[key] : 0; }, set(target, key, value) { target[key] = value; return true; } });
const canvas = { width:960, height:540, style:{}, addEventListener() {}, getContext() { return canvasContext; }, getBoundingClientRect() { return { left:0, top:0, width:960, height:540 }; } };
const elements = { cv:canvas, hint:{ innerHTML:'' } };
const storage = new Map();
storage.set('pixelrogue_save', JSON.stringify({ s:0, u:Array(10).fill(0), b:0, st:[], mt:{ enh:2, ench:1 }, lo:{}, sq:1 }));
const context = vm.createContext({
  console, Math:Object.create(Math), Date, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp,
  parseInt, parseFloat, isFinite, performance:{ now:() => 0 },
  btoa:s => Buffer.from(s, 'binary').toString('base64'), atob:s => Buffer.from(s, 'base64').toString('binary'),
  localStorage:{ getItem:key => storage.has(key) ? storage.get(key) : null, setItem:(key, value) => storage.set(key, String(value)) },
  navigator:{ maxTouchPoints:0, clipboard:null, vibrate:null },
  Image:class { constructor() { this.complete = true; this.naturalWidth = 64; } set src(value) { this._src = value; } get src() { return this._src; } },
  document:{
    hidden:false, body:{ appendChild() {} }, addEventListener() {},
    getElementById:id => elements[id] || (elements[id] = { style:{}, innerHTML:'', addEventListener() {} }),
    createElement:() => ({ style:{}, value:'', addEventListener() {}, focus() {}, blur() {} })
  },
  window:{ devicePixelRatio:1, addEventListener() {}, prompt:() => null },
  requestAnimationFrame() {}, setTimeout() {}, clearTimeout() {}
});

vm.runInContext(source, context, { filename:'game.js' });
vm.runInContext(`
  globalThis.dungeonRun = { modifierState:{
    activeBlessings:['sunsteel_edge','arcane_tide','hunter_mark','oak_heart','guardian_shell','renewal_well','wind_stride','swift_dash','aerial_grace','soul_bloom','treasure_eye','fate_thread'],
    activeCurses:['hardened_horde','razor_bargain','frail_power','mana_leak','broken_hourglass','sealed_fate','leaden_steps','empty_flask','last_light','elite_tribute','hazard_wager','boss_oath'], uses:{}
  } };
  player.eq = { weapon:null, armor:null, helmet:null, boots:null, acc:null };
  player.cd = { atk:0, hp:0, crit:0, spd:0, aspd:0, xdmg:0, ls:0, mp:0, pot:0, def:0, heal:0, ifr:0 };
  player.perk = {}; player.cls = 'warrior'; player.lv = 1; player.hp = 100; player.mp = player.mmp;
  calcStats();
  if (player.mhp !== 103) throw new Error('oak heart and frail power did not combine in the real max HP calculation');
  if (Math.abs(skillDamageMul() - 1.3216) > 0.0001) throw new Error('arcane tide and mana leak did not combine in real skill damage');
  if (Math.abs(moveSpd() - 2.068) > 0.0001) throw new Error('wind stride and leaden steps did not combine in real movement speed');
  if (Math.abs(jumpV() - 12.5) > 0.0001) throw new Error('aerial grace did not affect real jump strength');
  if (Math.abs(soulGainMul() - 1.940625) > 0.0001) throw new Error('blessing and curse soul multipliers did not combine');
  if (Math.abs(gearDropChance(false, 1) - 0.1575) > 0.0001) throw new Error('treasure eye and razor bargain did not combine in real gear drops');
  if (gearDropChance(true, 1) !== 0.5) throw new Error('elite tribute did not respect the 50% gear drop cap');
  if (Math.abs(blessingHeal(100) - 81.25) > 0.0001) throw new Error('renewal well and empty flask did not combine in real healing');
  if (armorDef() !== 3) throw new Error('leaden steps did not grant real fixed defense');
  if (Math.abs(critRate() - 0.18) > 0.0001) throw new Error('broken hourglass did not grant real critical chance');
  if (Math.abs(cooldownMul() - 1.15) > 0.0001) throw new Error('broken hourglass did not increase real skill cooldown');
  if (skillMpCost({ mp:10 }) !== 12) throw new Error('mana leak did not increase real skill MP cost');
  if (Math.abs(dungeonCurseIncomingDamage(100) - 115) > 0.0001) throw new Error('razor bargain did not increase real incoming damage');
  if (dungeonBlessingDashCooldown(120) !== 96) throw new Error('swift dash did not affect the real dash cooldown');
  const sealedState = { activeBlessings:[], activeCurses:[], rerollsRemaining:2, rerollsSpent:0, declines:0, history:[], uses:{},
    pending:{ id:'sealed-runtime', kind:'curse', floor:12, chapter:3, status:'offered', rerollIndex:0, options:['sealed_fate'] } };
  player.eventRerolls = 0;
  acceptDungeonModifierOffer(sealedState, 'sealed_fate');
  if (sealedState.rerollsRemaining !== 0 || player.eventRerolls !== 2) throw new Error('sealed fate did not exchange modifier rerolls for card rerolls');

  if (GEAR_SETS.length !== 4) throw new Error('expected four launch sets');
  if (meta.mats.set !== 0) throw new Error('old saves should migrate with zero set cores');
  const originalRandom = Math.random; Math.random = () => 0; player.cls = 'warrior';
  if (genGear(4, 2, 'boss').setId) throw new Error('sets should not drop before floor five');
  const guaranteedRoll = genGear(5, 2, 'boss');
  if (guaranteedRoll.setId !== 'blood_oath' || guaranteedRoll.r < 3) throw new Error('eligible set roll failed');
  Math.random = originalRandom;
  const bloodPieces = SET_PARTS.map(part => createGear(10, part, 'warrior', 3, 'blood_oath'));
  player.eq = { weapon:bloodPieces[0], armor:bloodPieces[1], helmet:null, boots:null, acc:null };
  if (Math.abs(setBonusV('lifesteal') - 0.05) > 0.0001) throw new Error('2-piece bonus did not activate');
  if (setBonusV('lowHpAtk') !== 0) throw new Error('4-piece bonus activated too early');
  player.eq.helmet = bloodPieces[2]; player.eq.boots = bloodPieces[3];
  if (Math.abs(setBonusV('lowHpAtk') - 0.30) > 0.0001) throw new Error('4-piece bonus did not activate');

  const sunPieces = SET_PARTS.map(part => createGear(10, part, 'warrior', 3, 'sun_guard'));
  player.eq = { weapon:bloodPieces[0], armor:bloodPieces[1], helmet:sunPieces[2], boots:sunPieces[3], acc:null };
  if (Math.abs(setBonusV('lifesteal') - 0.05) > 0.0001) throw new Error('first 2-piece bonus did not survive mixed sets');
  if (Math.abs(setBonusV('hpPct') - 0.12) > 0.0001) throw new Error('second 2-piece bonus did not activate in mixed sets');
  if (setBonusV('lowHpAtk') !== 0 || setBonusV('def') !== 0) throw new Error('mixed 2+2 incorrectly activated a 4-piece bonus');
  drawItemWin();

  const legacy = normalizeGear({ kind:'armor', r:2, hp:10, def:1, affixes:[] });
  if (legacy.setId) throw new Error('legacy gear received a set unexpectedly');
  const invalid = normalizeGear({ kind:'armor', r:3, setId:'missing', hp:10, def:1, affixes:[] });
  if (invalid.setId) throw new Error('invalid set id was not removed');

  meta.stash = []; meta.stashSeq = 1; meta.mats.set = SET_CRAFT_COST; chosenCls = 'warrior';
  stashGear(bloodPieces[0]); selStash = bloodPieces[0].uid;
  forgeSetPiece('blood_oath');
  if (meta.stash.length !== 2) throw new Error('forge did not create a piece');
  if (meta.stash[1].setId !== 'blood_oath') throw new Error('forge created the wrong set');
  if (meta.stash[1].kind === 'weapon') throw new Error('forge did not prioritize a missing slot');
  if (meta.mats.set !== 0) throw new Error('forge did not consume set cores');
  if (!gearUsableByClass(meta.stash[1], 'warrior') || gearUsableByClass(meta.stash[1], 'mage')) throw new Error('class restriction failed');
  renderStashTab();
`, context);

assert.equal(storage.has('pixelrogue_save'), true, 'forge should persist the updated stash');
console.log('set-system smoke test passed');
