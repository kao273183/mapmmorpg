// ---------- dungeon event runtime (D2-D) ----------
// Data stays in dungeon-data.js; this file translates effectId into state changes.

function dungeonEventSoulCost(eventDef, roomSpec) {
  if (!eventDef || !eventDef.soulCostBase) return 0;
  const chapter = roomSpec && roomSpec.chapter || 1;
  return eventDef.soulCostBase + Math.max(0, chapter - 2) * (eventDef.soulCostPerChapter || 0);
}

function dungeonEventSoulReward(eventDef, roomSpec) {
  if (!eventDef || !eventDef.soulRewardBase) return 0;
  const chapter = roomSpec && roomSpec.chapter || 1;
  return eventDef.soulRewardBase + Math.max(0, chapter - 1) * (eventDef.soulRewardPerChapter || 0);
}

function dungeonEventHealingAmount(amount) {
  const blessed = typeof dungeonBlessingHealingAmount === 'function' ? dungeonBlessingHealingAmount(amount) : amount;
  return typeof dungeonCurseHealingAmount === 'function' ? dungeonCurseHealingAmount(blessed) : blessed;
}

function dungeonEventHpCost(state) {
  const p = state && state.player;
  return p ? Math.max(1, Math.round(p.mhp * 0.2)) : 0;
}

function dungeonEventOptionViews(eventDef, roomSpec, state) {
  if (!eventDef) return [];
  const souls = state && Number.isFinite(state.souls) ? state.souls : 0;
  return (eventDef.choices || []).map(choice => {
    let detail = choice.detail || '';
    let enabled = true;
    let costText = '';
    if (choice.costType === 'souls') {
      const cost = dungeonEventSoulCost(eventDef, roomSpec);
      enabled = souls >= cost;
      costText = '成本：靈魂 ' + cost + '（目前 ' + souls + '）';
      detail = costText + '；獲得稀有以上裝備';
    } else if (choice.rewardType === 'souls') {
      const reward = dungeonEventSoulReward(eventDef, roomSpec);
      detail = '獲得靈魂 ' + reward + '（依章節提高）';
    } else if (choice.costType === 'max_hp') {
      const cost = dungeonEventHpCost(state);
      const hp = state && state.player ? Math.ceil(state.player.hp) : 0;
      enabled = hp > cost;
      costText = '成本：HP ' + cost + '（目前 ' + hp + '）';
      detail = costText + '；本局攻擊永久 +12%';
    }
    return Object.assign({}, choice, { detail, enabled, costText });
  });
}

function runDungeonEventEffect(effectId, eventDef, roomSpec, state, hooks) {
  const p = state.player;
  const metaState = state.meta;
  const h = hooks || {};
  const result = (status, message, color) => ({ ok:true, status, message, color });
  const fail = message => ({ ok:false, status:'idle', message, color:'#ff8a8a' });
  const dropGear = (rarity, source) => { if (h.dropGear) h.dropGear(rarity, source || 'event'); };
  const save = () => { if (h.save) h.save(); };

  if (state.status && state.status !== 'idle') return fail('事件已結束，獎勵不會重複發放');
  if (effectId === 'decline') {
    if (eventDef && eventDef.family === 'trial' && h.declineTrial) h.declineTrial();
    return result('declined', '已安全離開，探索評價不變', '#9299b9');
  }
  if (effectId === 'traveler_reward') {
    dropGear(1, 'event'); metaState.mats.ench += 1; save();
    return result('done', '精良裝備 + 附魔塵 ×1', '#ffd36a');
  }
  if (effectId === 'mimic_fight') {
    if (h.spawnMimic) h.spawnMimic();
    return result('combat', '寶箱怪現身！擊敗後獲得稀有裝備', '#ff8a6a');
  }
  if (effectId === 'supply_hp') {
    p.bag.hp += 1;
    return result('done', '紅色藥水 ×1', '#ff8a8a');
  }
  if (effectId === 'supply_mp') {
    p.bag.mp += 1;
    return result('done', '藍色藥水 ×1', '#8aa8ff');
  }
  if (effectId === 'supply_gear') {
    dropGear(0, 'event');
    return result('done', '隨機裝備已掉落', '#ffd36a');
  }
  if (effectId === 'sealed_reward') {
    const cost = dungeonEventSoulCost(eventDef, roomSpec);
    const souls = h.getSouls ? h.getSouls() : state.souls;
    if (souls < cost) return fail('靈魂不足（需要 ' + cost + '）');
    if (h.spendSouls) h.spendSouls(cost); else state.souls -= cost;
    dropGear(2, 'event');
    return result('done', '支付靈魂 ' + cost + ' · 稀有裝備已掉落', '#d9a8ff');
  }
  if (effectId === 'blood_blessing') {
    const cost = dungeonEventHpCost(state);
    if (p.hp <= cost) return fail('HP 不足（需保留至少 1 HP）');
    p.hp -= cost; p.eventAtk = (p.eventAtk || 0) + 0.12;
    return result('done', '血之祝福 · 攻擊 +12%', '#ff8a8a');
  }
  if (effectId === 'life_spring') {
    const healing = p.mhp * 0.35;
    p.hp = Math.min(p.mhp, p.hp + Math.round(dungeonEventHealingAmount(healing)));
    p.mp = Math.min(p.mmp, p.mp + Math.round(p.mmp * 0.5));
    return result('done', '生命泉源 · HP / MP 已回復', '#7dffd6');
  }
  if (effectId === 'arcane_spring') {
    p.mp = p.mmp;
    p.slotCd = p.slotCd.map(cd => Math.max(0, Math.floor(cd * 0.75)));
    return result('done', '奧術泉源 · MP 全滿，技能冷卻 -25%', '#8aa8ff');
  }
  if (effectId === 'fate_altar') {
    p.eventRerolls = (p.eventRerolls || 0) + 1;
    return result('done', '命運重抽 +1', '#ffd36a');
  }
  if (effectId === 'forge_temper') {
    p.eventAtk = (p.eventAtk || 0) + 0.06;
    return result('done', '祝火淬刃 · 本局攻擊 +6%', '#ffb45e');
  }
  if (effectId === 'forge_salvage') {
    metaState.mats.enh += 2; save();
    return result('done', '拆解完成 · 強化石 ×2', '#ffb45e');
  }
  if (effectId === 'alchemy_bundle') {
    p.bag.hp += 1; p.bag.mp += 1;
    return result('done', '平衡補給 · 紅藍藥水各 ×1', '#7dffd6');
  }
  if (effectId === 'alchemy_restoration') {
    p.hp = Math.min(p.mhp, p.hp + Math.round(dungeonEventHealingAmount(p.mhp * 0.5)));
    p.mp = Math.min(p.mmp, p.mp + Math.round(p.mmp * 0.5));
    return result('done', '復原藥劑 · HP / MP 已回復', '#7dffd6');
  }
  if (effectId === 'archive_cooldown') {
    p.mp = p.mmp; p.slotCd = p.slotCd.map(() => 0);
    return result('done', '施法回音 · MP 全滿，技能冷卻歸零', '#8aa8ff');
  }
  if (effectId === 'archive_fate') {
    p.eventRerolls = (p.eventRerolls || 0) + 2;
    return result('done', '命運索引 · 選卡重抽 +2', '#8aa8ff');
  }
  if (effectId === 'caravan_supplies') {
    p.bag.hp += 2;
    return result('done', '急救補給 · 紅色藥水 ×2', '#ffd36a');
  }
  if (effectId === 'caravan_trade') {
    const cost = dungeonEventSoulCost(eventDef, roomSpec);
    const souls = h.getSouls ? h.getSouls() : state.souls;
    if (souls < cost) return fail('靈魂不足（需要 ' + cost + '）');
    if (h.spendSouls) h.spendSouls(cost); else state.souls -= cost;
    dropGear(2, 'event');
    return result('done', '商隊契約 · 支付靈魂 ' + cost + '，稀有裝備已掉落', '#ffd36a');
  }
  if (effectId === 'cache_dust') {
    metaState.mats.ench += 2; save();
    return result('done', '古代塵晶 · 附魔塵 ×2', '#d9a8ff');
  }
  if (effectId === 'cache_souls') {
    const reward = dungeonEventSoulReward(eventDef, roomSpec);
    if (h.gainSouls) h.gainSouls(reward); else state.souls += reward;
    return result('done', '封存靈魂 +' + reward, '#d9a8ff');
  }
  if (effectId === 'start_trial' || effectId === 'elite_ambush') {
    if (h.startTrial) {
      if (h.startTrial() === false) return fail('試煉無法啟動');
    } else if (h.spawnAmbush) h.spawnAmbush();
    return result('challenge', '試煉開始！', '#ff8a6a');
  }
  return fail('此事件尚未完成');
}
