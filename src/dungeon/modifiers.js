"use strict";
// ---------- G1 blessings / curses foundation ----------
// G1-A only establishes deterministic offers and run-local state. Concrete
// effects are added in G1-B/G1-C, so these registries intentionally start empty.
const DUNGEON_MODIFIER_SCHEMA_VERSION = 1;
const DUNGEON_MODIFIER_REROLLS_PER_RUN = 2;
const DUNGEON_BLESSING_DEFS = {};
const DUNGEON_CURSE_DEFS = {};

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
    pending:null
  };
}

function dungeonModifierEligible(state, kind, context, registry) {
  const chapter = Math.max(1, context && context.chapter | 0);
  const active = kind === 'blessing' ? state.activeBlessings : state.activeCurses;
  return dungeonModifierValues(dungeonModifierRegistry(kind, registry)).filter(def =>
    def && def.kind === kind && def.implemented !== false && chapter >= (def.minChapter || 1) &&
    (!def.maxChapter || chapter <= def.maxChapter) && !active.includes(def.id)
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
    history:state.history.map(entry => Object.assign({}, entry)),
    pending:dungeonModifierOfferCopy(state.pending)
  };
}
