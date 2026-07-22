// ---------- dungeon trial state machine (D2-E) ----------

function createDungeonTrial(eventDef, roomSpec, playerState, worldWidth) {
  if (!eventDef || eventDef.family !== 'trial') return null;
  return {
    eventId:eventDef.id,
    type:eventDef.trialType,
    status:'offered',
    timeLeft:eventDef.durationFrames || 0,
    startHp:playerState ? playerState.hp : 0,
    damageTaken:0,
    targetCount:eventDef.targetCount || 0,
    defeatedCount:0,
    wave:0,
    waves:(eventDef.waves || [eventDef.targetCount || 0]).slice(),
    crossed:false,
    targetX:Math.max(240, (worldWidth || 1600) - 220),
    rewardState:'pending',
    failureReason:null
  };
}

function startDungeonTrial(trial, eventDef, playerState) {
  if (!trial || trial.status !== 'offered') return false;
  trial.status = 'active';
  trial.timeLeft = eventDef.durationFrames || 0;
  trial.startHp = playerState ? playerState.hp : 0;
  trial.damageTaken = 0;
  trial.defeatedCount = 0;
  trial.wave = 1;
  trial.crossed = false;
  trial.rewardState = 'pending';
  trial.failureReason = null;
  return true;
}

function declineDungeonTrial(trial) {
  if (!trial || trial.status !== 'offered') return false;
  trial.status = 'declined';
  trial.rewardState = 'none';
  return true;
}

function recordDungeonTrialDamage(trial, amount) {
  if (!trial || trial.status !== 'active' || amount <= 0) return null;
  trial.damageTaken += amount;
  if (trial.type !== 'flawless') return null;
  trial.status = 'failed';
  trial.failureReason = 'damage';
  trial.rewardState = 'none';
  return { action:'failed', reason:'damage' };
}

function recordDungeonTrialEnemyDefeat(trial) {
  if (!trial || trial.status !== 'active') return false;
  trial.defeatedCount++;
  return true;
}

function updateDungeonTrialState(trial, facts) {
  if (!trial || trial.status !== 'active') return null;
  const state = facts || {};
  const tickFrames = state.tickFrames == null ? 1 : Math.max(0, state.tickFrames);
  if (trial.type === 'hazard' && Number.isFinite(state.playerX) && state.playerX >= trial.targetX) trial.crossed = true;
  if (trial.type === 'timed') {
    trial.timeLeft = Math.max(0, trial.timeLeft - tickFrames);
    if (trial.timeLeft <= 0) {
      trial.status = 'failed';
      trial.failureReason = 'timeout';
      trial.rewardState = 'none';
      return { action:'failed', reason:'timeout' };
    }
  }

  const remaining = Math.max(0, state.remainingTrialEnemies || 0);
  if (remaining > 0) return null;

  if (trial.type === 'timed' && trial.wave < trial.waves.length) {
    trial.wave++;
    return { action:'spawn_wave', wave:trial.wave, count:trial.waves[trial.wave - 1] };
  }
  if (trial.type === 'hazard' && !trial.crossed) return null;

  trial.status = 'success';
  return { action:'success' };
}

function dungeonTrialBlocksCompletion(trial) {
  return !!(trial && trial.status === 'active');
}

function claimDungeonTrialReward(trial) {
  if (!trial || trial.status !== 'success' || trial.rewardState !== 'pending') return false;
  trial.rewardState = 'granted';
  return true;
}

function dungeonTrialSeconds(trial) {
  return trial && trial.timeLeft > 0 ? Math.ceil(trial.timeLeft / 60) : 0;
}
