"use strict";
// ---------- G1 blessings / curses foundation ----------
// G1-A establishes deterministic offers and run-local state. G1-B adds the
// first 12 concrete blessings. G1-C adds 12 voluntary curses with paired gains.
const DUNGEON_MODIFIER_SCHEMA_VERSION = 1;
const DUNGEON_MODIFIER_REROLLS_PER_RUN = 2;
// 處決之刃的斬殺線：敵人 HP 低於此比例時觸發額外傷害。
const DUNGEON_EXECUTE_HP_THRESHOLD = 0.30;
// 每個祝福都走不同的整合路徑（effect.type），並盡量給「會改變玩法」的效果，
// 而非只是又一個小幅被動加成，避免玩家覺得每張祝福都一樣。
const DUNGEON_BLESSING_DEFS = {
  sunsteel_edge:{
    id:'sunsteel_edge', kind:'blessing', category:'attack', name:'日鋼鋒芒', summary:'所有攻擊穩定提高。',
    minChapter:1, weight:10, effect:{ type:'attack_mul', value:0.15, cap:0.15, label:'所有傷害 +15%' }
  },
  executioner:{
    id:'executioner', kind:'blessing', category:'attack', name:'處決之刃', summary:'對瀕死敵人造成致命一擊。',
    minChapter:2, weight:8, effect:{ type:'execute_damage_mul', value:1.0, cap:1.0, label:'對 HP 低於 30% 的敵人傷害 +100%' }
  },
  hunter_mark:{
    id:'hunter_mark', kind:'blessing', category:'attack', name:'獵手印記', summary:'專門壓制菁英與 Boss。',
    minChapter:3, weight:6, effect:{ type:'elite_damage_mul', value:0.20, cap:0.20, label:'對菁英與 Boss 傷害 +20%' }
  },
  oak_heart:{
    id:'oak_heart', kind:'blessing', category:'defense', name:'古橡之心', summary:'提高本局最大生命。',
    minChapter:1, weight:10, effect:{ type:'max_hp_mul', value:0.15, cap:0.15, label:'最大 HP +15%' }
  },
  guardian_shell:{
    id:'guardian_shell', kind:'blessing', category:'defense', name:'守護甲殼', summary:'每次進入房間時獲得護盾。',
    minChapter:2, weight:8, effect:{ type:'room_shield_pct', value:0.12, cap:0.12, label:'進房獲得最大 HP 12% 護盾' }
  },
  renewal_well:{
    id:'renewal_well', kind:'blessing', category:'defense', name:'新生之泉', summary:'所有生命回復效果大幅提高。',
    minChapter:3, weight:6, effect:{ type:'healing_mul', value:0.30, cap:0.30, label:'生命回復量 +30%' }
  },
  wind_stride:{
    id:'wind_stride', kind:'blessing', category:'mobility', name:'逐風步', summary:'提高地面與空中水平移動。',
    minChapter:1, weight:10, effect:{ type:'move_flat', value:0.40, cap:0.40, label:'移動速度 +0.40' }
  },
  swift_dash:{
    id:'swift_dash', kind:'blessing', category:'mobility', name:'迅捷殘影', summary:'衝刺更頻繁，且衝刺全程無敵。',
    minChapter:2, weight:8, effect:{ type:'dash_cooldown_mul', value:0.30, cap:0.30, label:'衝刺冷卻 -30%，衝刺期間無敵' }
  },
  aerial_grace:{
    id:'aerial_grace', kind:'blessing', category:'mobility', name:'天穹恩典', summary:'獲得空中二段跳。',
    minChapter:3, weight:6, effect:{ type:'double_jump', value:1, cap:1, label:'獲得二段跳' }
  },
  soul_bloom:{
    id:'soul_bloom', kind:'blessing', category:'resource', name:'靈魂綻放', summary:'本局結算獲得更多靈魂。',
    minChapter:1, weight:10, effect:{ type:'soul_gain_mul', value:0.15, cap:0.15, label:'靈魂獲取 +15%' }
  },
  treasure_eye:{
    id:'treasure_eye', kind:'blessing', category:'resource', name:'尋寶之眼', summary:'怪物更容易掉落裝備。',
    minChapter:2, weight:8, effect:{ type:'gear_drop_flat', value:0.08, cap:0.08, label:'裝備掉落率 +8%' }
  },
  fate_thread:{
    id:'fate_thread', kind:'blessing', category:'resource', name:'命運絲線', summary:'本局可額外重抽一次升級卡。',
    minChapter:3, weight:6, effect:{ type:'card_rerolls', value:1, cap:1, label:'升級選卡重抽 +1 次' }
  }
};
const DUNGEON_CURSE_DEFS = {
  hardened_horde:{
    id:'hardened_horde', kind:'curse', category:'combat', name:'頑強魔群', summary:'敵人更耐打，但靈魂回報提高。',
    minChapter:1, weight:10,
    risk:{ type:'enemy_hp_mul', value:0.18, cap:0.18, label:'所有敵人 HP +18%' },
    reward:{ type:'soul_gain_mul', value:0.25, cap:0.25, label:'靈魂獲取 +25%' }
  },
  razor_bargain:{
    id:'razor_bargain', kind:'curse', category:'combat', name:'刀鋒交易', summary:'承受更多傷害，換取更多裝備。',
    minChapter:1, weight:10,
    risk:{ type:'incoming_damage_mul', value:0.15, cap:0.15, label:'受到傷害 +15%' },
    reward:{ type:'gear_drop_flat', value:0.08, cap:0.08, label:'裝備掉落率 +8%' }
  },
  frail_power:{
    id:'frail_power', kind:'curse', category:'combat', name:'脆弱之力', summary:'犧牲最大生命，換取全面傷害。',
    minChapter:1, weight:10,
    risk:{ type:'max_hp_reduction', value:0.15, cap:0.15, label:'最大 HP -15%' },
    reward:{ type:'outgoing_damage_mul', value:0.18, cap:0.18, label:'所有傷害 +18%' }
  },
  mana_leak:{
    id:'mana_leak', kind:'curse', category:'arcane', name:'法力裂隙', summary:'技能耗費更多 MP，但威力提高。',
    minChapter:2, weight:8,
    risk:{ type:'skill_mp_cost_mul', value:0.20, cap:0.20, label:'技能 MP 消耗 +20%' },
    reward:{ type:'skill_damage_mul', value:0.18, cap:0.18, label:'技能傷害 +18%' }
  },
  broken_hourglass:{
    id:'broken_hourglass', kind:'curse', category:'arcane', name:'碎裂沙漏', summary:'技能恢復較慢，但爆擊更穩定。',
    minChapter:2, weight:8,
    risk:{ type:'skill_cooldown_mul', value:0.15, cap:0.15, label:'技能冷卻 +15%' },
    reward:{ type:'crit_flat', value:0.10, cap:0.10, label:'爆擊率 +10%' }
  },
  sealed_fate:{
    id:'sealed_fate', kind:'curse', category:'arcane', name:'封印命運', summary:'放棄剩餘異變重抽，換取升級選卡重抽。',
    minChapter:3, weight:6,
    risk:{ type:'modifier_rerolls_loss', value:2, cap:2, label:'失去本局剩餘祝福／詛咒重抽' },
    reward:{ type:'card_rerolls', value:2, cap:2, label:'升級選卡重抽 +2 次' }
  },
  leaden_steps:{
    id:'leaden_steps', kind:'curse', category:'survival', name:'鉛鐵步伐', summary:'移動變慢，但獲得固定防禦。',
    minChapter:1, weight:10,
    risk:{ type:'move_speed_reduction', value:0.12, cap:0.12, label:'移動速度 -12%' },
    reward:{ type:'armor_flat', value:3, cap:3, label:'固定減傷 +3' }
  },
  empty_flask:{
    id:'empty_flask', kind:'curse', category:'survival', name:'乾涸聖杯', summary:'回復效率下降，但每房獲得護盾。',
    minChapter:2, weight:8,
    risk:{ type:'healing_reduction', value:0.35, cap:0.35, label:'生命回復量 -35%' },
    reward:{ type:'room_shield_pct', value:0.15, cap:0.15, label:'進房獲得最大 HP 15% 護盾' }
  },
  last_light:{
    id:'last_light', kind:'curse', category:'survival', name:'最後燈火', summary:'放棄所有復活，換取高額靈魂。',
    minChapter:3, weight:6,
    risk:{ type:'revive_block', value:1, cap:1, label:'不死鳥與不滅效果失效' },
    reward:{ type:'soul_gain_mul', value:0.35, cap:0.35, label:'靈魂獲取 +35%' }
  },
  elite_tribute:{
    id:'elite_tribute', kind:'curse', category:'challenge', name:'菁英貢禮', summary:'菁英更強，但更容易掉落裝備。',
    minChapter:2, weight:8,
    risk:{ type:'elite_stats_mul', value:0.25, cap:0.25, label:'菁英 HP 與傷害 +25%' },
    reward:{ type:'elite_gear_drop_flat', value:0.20, cap:0.20, label:'菁英裝備掉落率 +20%' }
  },
  hazard_wager:{
    id:'hazard_wager', kind:'curse', category:'challenge', name:'險境豪賭', summary:'地形傷害提高，但險境靈魂更多。',
    minChapter:3, weight:6,
    risk:{ type:'hazard_damage_mul', value:0.25, cap:0.25, label:'地形傷害 +25%' },
    reward:{ type:'hazard_soul_mul', value:0.40, cap:0.40, label:'險境額外靈魂 +40%' }
  },
  boss_oath:{
    id:'boss_oath', kind:'curse', category:'challenge', name:'王者誓約', summary:'Boss 更強，章節寶箱品質與素材提高。',
    minChapter:3, weight:6,
    risk:{ type:'boss_stats_mul', value:0.20, cap:0.20, label:'Boss HP 與傷害 +20%' },
    reward:{ type:'chapter_reward_bonus', value:1, cap:1, label:'章節寶箱品質 +1、強化石 +1' }
  }
};

function dungeonModifierRegistry(kind, override) {
  if (override) return override;
  return kind === 'blessing' ? DUNGEON_BLESSING_DEFS : kind === 'curse' ? DUNGEON_CURSE_DEFS : {};
}

function dungeonModifierValues(registry) {
  return Array.isArray(registry) ? registry.slice() : Object.values(registry || {});
}

function validateDungeonModifierDefinitions(blessings, curses) {
  const issues = [];
  const ids = new Set();
  const inspect = (kind, registry) => {
    for (const def of dungeonModifierValues(registry)) {
      if (!def || typeof def !== 'object') { issues.push(kind + ':invalid-definition'); continue; }
      if (!def.id || typeof def.id !== 'string') issues.push(kind + ':missing-id');
      else if (ids.has(def.id)) issues.push(def.id + ':duplicate-id');
      else ids.add(def.id);
      if (def.kind !== kind) issues.push((def.id || kind) + ':invalid-kind');
      if (!def.name || !def.summary) issues.push((def.id || kind) + ':missing-preview');
      if (!Number.isFinite(def.weight) || def.weight <= 0) issues.push((def.id || kind) + ':invalid-weight');
      if (!Number.isInteger(def.minChapter) || def.minChapter < 1) issues.push((def.id || kind) + ':invalid-min-chapter');
      if (kind === 'blessing' && !(def.effect && def.effect.label)) issues.push((def.id || kind) + ':missing-effect');
      if (kind === 'curse') {
        if (!(def.risk && def.risk.label)) issues.push((def.id || kind) + ':missing-risk');
        if (!(def.reward && def.reward.label)) issues.push((def.id || kind) + ':missing-reward');
      }
    }
  };
  inspect('blessing', blessings == null ? DUNGEON_BLESSING_DEFS : blessings);
  inspect('curse', curses == null ? DUNGEON_CURSE_DEFS : curses);
  return { ok:issues.length === 0, issues };
}

function createDungeonModifierRunState(runSeed, options) {
  const o = options || {};
  const rerolls = Number.isInteger(o.rerolls) && o.rerolls >= 0 ? o.rerolls : DUNGEON_MODIFIER_REROLLS_PER_RUN;
  return {
    schemaVersion:DUNGEON_MODIFIER_SCHEMA_VERSION,
    seed:dungeonSeedHash(String(runSeed) + ':modifiers'),
    rerollsRemaining:rerolls,
    rerollsSpent:0,
    declines:0,
    offerSequence:0,
    activeBlessings:[],
    activeCurses:[],
    recent:{ blessing:[], curse:[] },
    offerHistory:[],
    history:[],
    uses:{},
    pending:null
  };
}

function activeDungeonModifierState(state) {
  if (state) return state;
  return typeof dungeonRun !== 'undefined' && dungeonRun ? dungeonRun.modifierState : null;
}

function dungeonBlessingActive(id, state) {
  const modifierState = activeDungeonModifierState(state);
  return !!(modifierState && modifierState.activeBlessings && modifierState.activeBlessings.includes(id));
}

function dungeonBlessingEffect(id, state) {
  return dungeonBlessingActive(id, state) && DUNGEON_BLESSING_DEFS[id] ? DUNGEON_BLESSING_DEFS[id].effect : null;
}

function dungeonBlessingValue(id, state) {
  const effect = dungeonBlessingEffect(id, state);
  return effect ? Math.min(Number(effect.cap) || Infinity, Math.max(0, Number(effect.value) || 0)) : 0;
}

function dungeonBlessingHealingAmount(amount, state) {
  return Math.max(0, amount) * (1 + dungeonBlessingValue('renewal_well', state));
}

function dungeonBlessingDamageForTarget(amount, target, state) {
  let result = Math.max(0, amount) * (1 + dungeonBlessingValue('sunsteel_edge', state));
  if (target && (target.elite || target.type === 'boss')) result *= 1 + dungeonBlessingValue('hunter_mark', state);
  // 處決之刃：以命中前的當前血量判定，對瀕死目標追加致命傷害。
  const execute = dungeonBlessingValue('executioner', state);
  if (execute > 0 && target && Number.isFinite(target.hp) && Number.isFinite(target.mhp) && target.mhp > 0
      && target.hp <= target.mhp * DUNGEON_EXECUTE_HP_THRESHOLD) {
    result *= 1 + execute;
  }
  return result;
}

// 迅捷殘影：衝刺全程無敵。
function dungeonBlessingDashInvincible(state) {
  return dungeonBlessingValue('swift_dash', state) > 0;
}

// 天穹恩典：獲得空中二段跳。
function dungeonBlessingHasDoubleJump(state) {
  return dungeonBlessingValue('aerial_grace', state) > 0;
}

function dungeonBlessingRoomShieldAmount(maxHp, state) {
  return Math.max(0, Math.round(Math.max(0, maxHp) * dungeonBlessingValue('guardian_shell', state)));
}

function dungeonBlessingDashCooldown(baseCooldown, state) {
  return Math.max(1, Math.round(Math.max(1, baseCooldown) * (1 - dungeonBlessingValue('swift_dash', state))));
}

function consumeDungeonBlessingCharge(id, state) {
  const modifierState = activeDungeonModifierState(state);
  const limit = dungeonBlessingValue(id, modifierState);
  if (!modifierState || limit <= 0) return false;
  if (!modifierState.uses) modifierState.uses = {};
  const used = Math.max(0, modifierState.uses[id] | 0);
  if (used >= limit) return false;
  modifierState.uses[id] = used + 1;
  return true;
}

function dungeonCurseActive(id, state) {
  const modifierState = activeDungeonModifierState(state);
  return !!(modifierState && modifierState.activeCurses && modifierState.activeCurses.includes(id));
}

function dungeonCurseEffect(id, side, state) {
  const def = dungeonCurseActive(id, state) ? DUNGEON_CURSE_DEFS[id] : null;
  return def && (side === 'risk' || side === 'reward') ? def[side] : null;
}

function dungeonCurseValue(id, side, state) {
  const effect = dungeonCurseEffect(id, side, state);
  return effect ? Math.min(Number(effect.cap) || Infinity, Math.max(0, Number(effect.value) || 0)) : 0;
}

function dungeonCurseHealingAmount(amount, state) {
  return Math.max(0, amount) * (1 - dungeonCurseValue('empty_flask', 'risk', state));
}

function dungeonCurseOutgoingDamage(amount, state) {
  return Math.max(0, amount) * (1 + dungeonCurseValue('frail_power', 'reward', state));
}

function dungeonCurseIncomingDamage(amount, state) {
  return Math.max(0, amount) * (1 + dungeonCurseValue('razor_bargain', 'risk', state));
}

function dungeonCurseBaseEnemyHp(amount, state) {
  return Math.max(1, amount) * (1 + dungeonCurseValue('hardened_horde', 'risk', state));
}

function dungeonCurseEliteStat(amount, state) {
  return Math.max(1, amount) * (1 + dungeonCurseValue('elite_tribute', 'risk', state));
}

function dungeonCurseBossStat(amount, state) {
  return Math.max(1, amount) * (1 + dungeonCurseValue('boss_oath', 'risk', state));
}

function dungeonCurseHazardDamage(amount, state) {
  return Math.max(1, amount) * (1 + dungeonCurseValue('hazard_wager', 'risk', state));
}

function dungeonCurseRoomShieldAmount(maxHp, state) {
  return Math.max(0, Math.round(Math.max(0, maxHp) * dungeonCurseValue('empty_flask', 'reward', state)));
}

function dungeonCurseBlocksRevive(state) {
  return dungeonCurseValue('last_light', 'risk', state) > 0;
}

function activateDungeonBlessing(id) {
  const def = DUNGEON_BLESSING_DEFS[id];
  if (!def) return false;
  if (def.effect.type === 'max_hp_mul' && typeof calcStats === 'function') calcStats();
  return true;
}

function activateDungeonCurse(id, state) {
  const def = DUNGEON_CURSE_DEFS[id];
  if (!def) return false;
  if (def.risk.type === 'max_hp_reduction' && typeof calcStats === 'function') calcStats();
  if (id === 'sealed_fate') {
    state.rerollsRemaining = 0;
    if (typeof player !== 'undefined') player.eventRerolls = (player.eventRerolls || 0) + dungeonCurseValue(id, 'reward', state);
  }
  return true;
}

function dungeonModifierEligible(state, kind, context, registry) {
  const chapter = Math.max(1, context && context.chapter | 0);
  const active = kind === 'blessing' ? state.activeBlessings : state.activeCurses;
  return dungeonModifierValues(dungeonModifierRegistry(kind, registry)).filter(def =>
    def && def.kind === kind && def.implemented !== false && chapter >= (def.minChapter || 1) &&
    (!def.maxChapter || chapter <= def.maxChapter) && !active.includes(def.id) &&
    (def.id !== 'sealed_fate' || state.rerollsRemaining > 0)
  );
}

function dungeonModifierWeightedPick(candidates, rng, count) {
  const pool = candidates.slice();
  const result = [];
  while (pool.length && result.length < count) {
    const total = pool.reduce((sum, def) => sum + Math.max(0, Number(def.weight) || 0), 0);
    if (total <= 0) break;
    let roll = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= Math.max(0, Number(pool[i].weight) || 0);
      if (roll <= 0) { index = i; break; }
    }
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}

function dungeonModifierRememberOptions(state, kind, optionIds) {
  const recent = state.recent[kind];
  recent.push(...optionIds);
  if (recent.length > 12) recent.splice(0, recent.length - 12);
}

function dungeonModifierOfferCopy(offer) {
  if (!offer) return null;
  return Object.assign({}, offer, { options:offer.options.slice() });
}

function beginDungeonModifierOffer(state, kind, context, registry) {
  if (!state || state.pending || !['blessing', 'curse'].includes(kind)) return null;
  const ctx = context || {};
  const eligible = dungeonModifierEligible(state, kind, ctx, registry);
  if (!eligible.length) return null;
  const optionCount = Math.max(1, Math.min(3, ctx.optionCount || 3, eligible.length));
  const recent = new Set(state.recent[kind].slice(-6));
  const fresh = eligible.filter(def => !recent.has(def.id));
  const pool = fresh.length >= optionCount ? fresh : eligible;
  const sequence = state.offerSequence++;
  const floor = Math.max(1, ctx.floor | 0);
  const chapter = Math.max(1, ctx.chapter | 0);
  const rng = dungeonRng(state.seed + ':' + kind + ':' + floor + ':' + sequence + ':0');
  const options = dungeonModifierWeightedPick(pool, rng, optionCount).map(def => def.id);
  if (!options.length) return null;
  state.pending = {
    id:'modifier-' + kind + '-' + sequence,
    kind,
    floor,
    chapter,
    status:'offered',
    rerollIndex:0,
    options
  };
  dungeonModifierRememberOptions(state, kind, options);
  state.offerHistory.push({ offerId:state.pending.id, kind, floor, chapter, rerollIndex:0, options:options.slice() });
  return dungeonModifierOfferCopy(state.pending);
}

function rerollDungeonModifierOffer(state, registry) {
  const offer = state && state.pending;
  if (!offer || offer.status !== 'offered' || state.rerollsRemaining <= 0) return null;
  const eligible = dungeonModifierEligible(state, offer.kind, offer, registry);
  const previous = new Set(offer.options);
  const alternatives = eligible.filter(def => !previous.has(def.id));
  if (!alternatives.length) return null;
  const count = Math.min(offer.options.length, eligible.length);
  const rerollIndex = offer.rerollIndex + 1;
  const rng = dungeonRng(state.seed + ':' + offer.kind + ':' + offer.floor + ':' + offer.id + ':' + rerollIndex);
  const picked = dungeonModifierWeightedPick(alternatives, rng, Math.min(count, alternatives.length));
  if (picked.length < count) {
    const selected = new Set(picked.map(def => def.id));
    const fill = eligible.filter(def => !selected.has(def.id));
    picked.push(...dungeonModifierWeightedPick(fill, rng, count - picked.length));
  }
  const options = picked.map(def => def.id);
  if (!options.length || options.join('|') === offer.options.join('|')) return null;
  state.rerollsRemaining--;
  state.rerollsSpent++;
  offer.rerollIndex = rerollIndex;
  offer.options = options;
  dungeonModifierRememberOptions(state, offer.kind, options);
  state.offerHistory.push({ offerId:offer.id, kind:offer.kind, floor:offer.floor, chapter:offer.chapter, rerollIndex, options:options.slice() });
  return dungeonModifierOfferCopy(offer);
}

function acceptDungeonModifierOffer(state, modifierId) {
  const offer = state && state.pending;
  if (!offer || offer.status !== 'offered' || !offer.options.includes(modifierId)) return { ok:false, status:'idle' };
  const active = offer.kind === 'blessing' ? state.activeBlessings : state.activeCurses;
  if (!active.includes(modifierId)) active.push(modifierId);
  if (offer.kind === 'blessing') activateDungeonBlessing(modifierId);
  else activateDungeonCurse(modifierId, state);
  const result = { ok:true, status:'accepted', kind:offer.kind, modifierId, offerId:offer.id, floor:offer.floor, chapter:offer.chapter };
  state.history.push(result);
  state.pending = null;
  return Object.assign({}, result);
}

function declineDungeonModifierOffer(state) {
  const offer = state && state.pending;
  if (!offer || offer.status !== 'offered') return { ok:false, status:'idle' };
  const result = { ok:true, status:'declined', kind:offer.kind, offerId:offer.id, floor:offer.floor, chapter:offer.chapter };
  state.declines++;
  state.history.push(result);
  state.pending = null;
  return Object.assign({}, result);
}

function snapshotDungeonModifierState(state) {
  if (!state) return null;
  return {
    schemaVersion:state.schemaVersion,
    seed:state.seed,
    rerollsRemaining:state.rerollsRemaining,
    rerollsSpent:state.rerollsSpent,
    declines:state.declines,
    activeBlessings:state.activeBlessings.slice(),
    activeCurses:state.activeCurses.slice(),
    uses:Object.assign({}, state.uses || {}),
    history:state.history.map(entry => Object.assign({}, entry)),
    pending:dungeonModifierOfferCopy(state.pending)
  };
}

// G1-F keeps the first balance pass reproducible and separate from natural-play
// telemetry. Values are estimates for the paired D3 chapter-three profiles, not
// claims about player samples; the live report records the same four profiles.
const DUNGEON_G1_BALANCE_MODEL = {
  id:'g1f-round-1',
  version:'0.29.13',
  date:'2026-07-22',
  basis:'fixed-benchmark-model',
  benchmarkIds:['warrior-chapter3', 'mage-chapter3'],
  offerFloors:[3, 7, 11, 14],
  assumptions:{ standardKills:20, baseRoomRewards:10 },
  adjustments:[],
  baselines:{
    warrior:{ clearSec:960, damageTaken:150, souls:100, roomRewards:10 },
    mage:{ clearSec:930, damageTaken:165, souls:100, roomRewards:10 }
  },
  cases:[
    { id:'neutral', label:'無效果', blessings:[], curses:[] },
    { id:'blessings', label:'只拿祝福', blessings:['sunsteel_edge', 'soul_bloom'], curses:[] },
    { id:'curses', label:'只拿詛咒', blessings:[], curses:['hardened_horde', 'razor_bargain'] },
    { id:'mixed', label:'祝福＋詛咒', blessings:['sunsteel_edge', 'soul_bloom'], curses:['hardened_horde', 'razor_bargain'] }
  ],
  thresholds:{ classGapPct:0.15, maxSoulMul:2, maxBossSkillDamageMul:2 }
};

function dungeonG1DefinitionValue(registry, id, side) {
  const def = registry && registry[id];
  const effect = def && (side ? def[side] : def.effect);
  return effect ? Math.min(Number(effect.cap) || Infinity, Math.max(0, Number(effect.value) || 0)) : 0;
}

function dungeonG1BalanceMetrics(classId, caseId) {
  const model = DUNGEON_G1_BALANCE_MODEL;
  const baseline = model.baselines[classId];
  const definition = model.cases.find(item => item.id === caseId);
  if (!baseline || !definition) return null;
  const hasBlessing = id => definition.blessings.includes(id);
  const hasCurse = id => definition.curses.includes(id);
  const blessing = id => hasBlessing(id) ? dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, id) : 0;
  const curse = (id, side) => hasCurse(id) ? dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, id, side) : 0;
  const outgoingMul = (1 + blessing('sunsteel_edge')) * (1 + curse('frail_power', 'reward'));
  const enemyHpMul = 1 + curse('hardened_horde', 'risk');
  const incomingMul = 1 + curse('razor_bargain', 'risk');
  const soulMul = (1 + blessing('soul_bloom')) * (1 + curse('hardened_horde', 'reward')) * (1 + curse('last_light', 'reward'));
  const extraGearChance = blessing('treasure_eye') + curse('razor_bargain', 'reward');
  const clearSec = Math.round(baseline.clearSec * enemyHpMul / outgoingMul);
  const damageTaken = Math.round(baseline.damageTaken * incomingMul);
  const souls = Math.round(baseline.souls * soulMul);
  const roomRewards = Number((baseline.roomRewards + model.assumptions.standardKills * extraGearChance).toFixed(1));
  return {
    classId,
    caseId,
    blessings:definition.blessings.slice(),
    curses:definition.curses.slice(),
    clearSec,
    damageTaken,
    souls,
    roomRewards,
    deltas:{
      clearPct:clearSec / baseline.clearSec - 1,
      damagePct:damageTaken / baseline.damageTaken - 1,
      soulPct:souls / baseline.souls - 1,
      roomRewardPct:roomRewards / baseline.roomRewards - 1
    }
  };
}

function dungeonG1BalanceReport() {
  const model = DUNGEON_G1_BALANCE_MODEL;
  const cases = {};
  const alerts = [];
  for (const definition of model.cases) {
    const warrior = dungeonG1BalanceMetrics('warrior', definition.id);
    const mage = dungeonG1BalanceMetrics('mage', definition.id);
    const mean = (warrior.clearSec + mage.clearSec) / 2;
    const classGapPct = mean ? Math.abs(warrior.clearSec - mage.clearSec) / mean : 0;
    cases[definition.id] = { id:definition.id, label:definition.label, warrior, mage, classGapPct };
    if (classGapPct > model.thresholds.classGapPct) alerts.push(definition.label + '職業通關時間差超過 15%');
  }
  const soulMul = (1 + dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, 'soul_bloom')) *
    (1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'hardened_horde', 'reward')) *
    (1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'last_light', 'reward'));
  const bossSkillDamageMul = (1 + dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, 'sunsteel_edge')) *
    (1 + dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, 'hunter_mark')) *
    (1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'frail_power', 'reward')) *
    (1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'mana_leak', 'reward'));
  const extremes = {
    soulMul,
    bossSkillDamageMul,
    bossIncomingMul:(1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'boss_oath', 'risk')) * (1 + dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'razor_bargain', 'risk')),
    maxHpMul:(1 + dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, 'oak_heart')) * (1 - dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'frail_power', 'risk')),
    healingMul:(1 + dungeonG1DefinitionValue(DUNGEON_BLESSING_DEFS, 'renewal_well')) * (1 - dungeonG1DefinitionValue(DUNGEON_CURSE_DEFS, 'empty_flask', 'risk')),
    gearDropCap:0.50
  };
  if (soulMul > model.thresholds.maxSoulMul) alerts.push('極端靈魂倍率超過 ×2.00');
  if (bossSkillDamageMul > model.thresholds.maxBossSkillDamageMul) alerts.push('極端 Boss 技能傷害倍率超過 ×2.00');
  return {
    id:model.id,
    version:model.version,
    date:model.date,
    basis:model.basis,
    benchmarkIds:model.benchmarkIds.slice(),
    offerFloors:model.offerFloors.slice(),
    assumptions:Object.assign({}, model.assumptions),
    adjustments:model.adjustments.map(item => Object.assign({}, item)),
    cases,
    extremes,
    alerts
  };
}
