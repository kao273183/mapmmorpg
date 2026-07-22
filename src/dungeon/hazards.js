// ---------- dungeon hazards (v0.26 D2-C) ----------
let dungeonHazards = [];
let dungeonHazardTutorial = null;

function clearDungeonHazards() {
  for (const hazard of dungeonHazards) {
    if (!hazard.platform) continue;
    hazard.platform.voidDisabled = false;
    hazard.platform.voidHazard = false;
  }
  dungeonHazards.length = 0;
  dungeonHazardTutorial = null;
}

function groundHazardLayoutValid(candidate, placed, width, eventX, minGap) {
  const half = candidate.w / 2;
  if (candidate.x - half < 180 || candidate.x + half > width - 180) return false;
  if (Number.isFinite(eventX) && Math.abs(candidate.x - eventX) < half + 140) return false;
  return placed.every(other => Math.abs(candidate.x - other.x) >= half + other.w / 2 + minGap);
}

function generateGroundHazardLayout(spec, width, eventX, options) {
  const o = options || {};
  const rng = dungeonRoomRng(spec, 'hazards:' + o.type);
  const target = Math.min(o.max || 3, Math.max(o.min || 2, Math.round(width / (o.spacing || 850))));
  const placed = [];
  for (let attempts = 0; attempts < 100 && placed.length < target; attempts++) {
    const w = Math.round((o.minWidth || 70) + rng() * ((o.maxWidth || 90) - (o.minWidth || 70)));
    const candidate = {
      id:(o.prefix || o.type) + '-' + placed.length,
      type:o.type,
      x:220 + rng() * Math.max(1, width - 440),
      y:468,
      w
    };
    if (groundHazardLayoutValid(candidate, placed, width, eventX, o.minGap || 120)) placed.push(candidate);
  }
  return placed.sort((a, b) => a.x - b.x);
}

function thornRootLayoutValid(candidate, placed, width, eventX) {
  return groundHazardLayoutValid(candidate, placed, width, eventX, 120);
}

function generateThornRootLayout(spec, width, eventX) {
  const def = DUNGEON_HAZARD_DEFS.thorn_roots;
  return generateGroundHazardLayout(spec, width, eventX, {
    type:'thorn_roots', prefix:'thorn', max:terrainHazardMaxPerRoom(def), minWidth:76, maxWidth:96, minGap:120
  });
}

function generateFallingRockLayout(spec, width, eventX) {
  const def = DUNGEON_HAZARD_DEFS.falling_rocks;
  return generateGroundHazardLayout(spec, width, eventX, {
    type:'falling_rocks', prefix:'rock', max:terrainHazardMaxPerRoom(def), minWidth:72, maxWidth:88, minGap:145
  });
}

function generateLavaVentLayout(spec, width, eventX) {
  const def = DUNGEON_HAZARD_DEFS.lava_vents;
  return generateGroundHazardLayout(spec, width, eventX, {
    type:'lava_vents', prefix:'vent', max:terrainHazardMaxPerRoom(def), minWidth:54, maxWidth:66, minGap:150
  });
}

function generateIceFloorLayout(spec, width, eventX) {
  const def = DUNGEON_HAZARD_DEFS.ice_floor;
  return generateGroundHazardLayout(spec, width, eventX, {
    type:'ice_floor', prefix:'ice', max:terrainHazardMaxPerRoom(def), minWidth:180, maxWidth:250, minGap:96, spacing:760
  });
}

function generateVoidPlatformLayout(spec, platforms) {
  const def = DUNGEON_HAZARD_DEFS.void_platforms;
  const width = platforms.find(p => p.ground)?.w || 1600;
  const rng = dungeonRoomRng(spec, 'hazards:void-platforms');
  const maxPerRoom = terrainHazardMaxPerRoom(def);
  const occupied = platform => typeof mons !== 'undefined' && mons.some(mon => mon.type !== 'bat'
    && Math.abs(mon.y - platform.y) < 2 && mon.x >= platform.x - 12 && mon.x <= platform.x + platform.w + 12);
  const pool = platforms.filter(platform => !platform.ground && platform.w >= 90
    && platform.x >= 180 && platform.x + platform.w <= width - 180 && !occupied(platform));
  const result = [];
  while (pool.length && result.length < maxPerRoom) {
    const index = (rng() * pool.length) | 0;
    const platform = pool.splice(index, 1)[0];
    if (result.some(item => Math.abs(item.x - (platform.x + platform.w / 2)) < 180)) continue;
    result.push({
      id:'void-' + result.length,
      type:'void_platforms',
      x:platform.x + platform.w / 2,
      y:platform.y,
      w:platform.w,
      platform
    });
  }
  return result.sort((a, b) => a.x - b.x);
}

function timedGroundHazards(layout, def, startPhase) {
  return layout.map((hazard, index) => Object.assign(hazard, {
    phase:startPhase || 'warning',
    timer:(startPhase === 'stable' ? def.cooldownFrames : def.warningFrames) + index * 18,
    hitThisCycle:false
  }));
}

function spawnDungeonHazards(spec, width, eventX, platforms) {
  clearDungeonHazards();
  if (!spec || !spec.hazardId) return dungeonHazards;
  const def = DUNGEON_HAZARD_DEFS[spec.hazardId];
  if (!def || !def.implemented) return dungeonHazards;

  if (spec.hazardId === 'thorn_roots') dungeonHazards = timedGroundHazards(generateThornRootLayout(spec, width, eventX), def);
  else if (spec.hazardId === 'falling_rocks') dungeonHazards = timedGroundHazards(generateFallingRockLayout(spec, width, eventX), def);
  else if (spec.hazardId === 'lava_vents') dungeonHazards = timedGroundHazards(generateLavaVentLayout(spec, width, eventX), def);
  else if (spec.hazardId === 'ice_floor') dungeonHazards = generateIceFloorLayout(spec, width, eventX).map(hazard => Object.assign(hazard, { phase:'passive' }));
  else if (spec.hazardId === 'void_platforms') {
    dungeonHazards = timedGroundHazards(generateVoidPlatformLayout(spec, platforms || []), def, 'stable');
    for (const hazard of dungeonHazards) hazard.platform.voidHazard = true;
  }

  // 一般模式下冰面／虛空平台已中和為無害地形，不再顯示其操作教學。
  const neutralized = terrainHazardIsMovementType(spec.hazardId) && !terrainMovementHazardsEnabled();
  if (dungeonHazards.length && dungeonRun && !neutralized) {
    dungeonRun.hazardTutorials = dungeonRun.hazardTutorials || {};
    if (!dungeonRun.hazardTutorials[spec.hazardId]) {
      dungeonRun.hazardTutorials[spec.hazardId] = true;
      dungeonHazardTutorial = { id:spec.hazardId, name:def.name, text:def.tutorial, t:240, maxT:240 };
    }
  }
  return dungeonHazards;
}

function advancePulsingHazard(hazard, def) {
  hazard.timer--;
  if (hazard.timer > 0) return;
  if (hazard.phase === 'warning') {
    hazard.phase = 'active';
    hazard.timer = def.activeFrames;
    hazard.hitThisCycle = false;
  } else if (hazard.phase === 'active') {
    hazard.phase = 'cooldown';
    hazard.timer = def.cooldownFrames;
  } else {
    hazard.phase = 'warning';
    hazard.timer = def.warningFrames;
    hazard.hitThisCycle = false;
  }
}

function advanceThornRoot(root, def) {
  advancePulsingHazard(root, def);
}

function advanceVoidPlatform(hazard, def) {
  // 一般模式：虛空平台維持穩定，永不消失。
  if (!terrainMovementHazardsEnabled()) {
    if (hazard.phase !== 'stable') { hazard.phase = 'stable'; hazard.platform.voidDisabled = false; }
    return;
  }
  hazard.timer--;
  if (hazard.timer > 0) return;
  if (hazard.phase === 'stable') {
    hazard.phase = 'warning';
    hazard.timer = def.warningFrames;
  } else if (hazard.phase === 'warning') {
    hazard.phase = 'gone';
    hazard.timer = def.activeFrames;
    hazard.platform.voidDisabled = true;
    if (player.onGround && Math.abs(player.y - hazard.y) < 2
        && player.x >= hazard.platform.x - 6 && player.x <= hazard.platform.x + hazard.platform.w + 6) {
      player.onGround = false;
      player.vy = Math.max(1, player.vy);
    }
  } else {
    hazard.phase = 'stable';
    hazard.timer = def.cooldownFrames;
    hazard.platform.voidDisabled = false;
  }
}

function playerRectOverlaps(p, left, top, right, bottom) {
  return p.x + p.w / 2 >= left && p.x - p.w / 2 <= right && p.y >= top && p.y - p.h <= bottom;
}

function thornRootHitsPlayer(root, p) {
  return playerRectOverlaps(p, root.x - root.w / 2, root.y - 34, root.x + root.w / 2, root.y);
}

function fallingRockY(hazard, def) {
  const progress = Math.max(0, Math.min(1, 1 - hazard.timer / def.activeFrames));
  return 68 + progress * (hazard.y - 80);
}

function fallingRockHitsPlayer(hazard, p, def) {
  const y = fallingRockY(hazard, def);
  return playerRectOverlaps(p, hazard.x - 14, y - 14, hazard.x + 14, y + 14);
}

function lavaVentHitsPlayer(hazard, p) {
  return playerRectOverlaps(p, hazard.x - hazard.w / 2, hazard.y - 72, hazard.x + hazard.w / 2, hazard.y);
}

function damageFromDungeonHazard(hazard, def, options) {
  const o = options || {};
  hazard.hitThisCycle = true;
  const modeMul = typeof terrainModeConfig === 'function' ? terrainModeConfig().damageMul : 1;
  const baseDamage = Math.max(def.minDamage || 1, Math.round(player.mhp * (def.damagePct || 0) * modeMul));
  const damage = Math.round(typeof dungeonCurseHazardDamage === 'function' ? dungeonCurseHazardDamage(baseDamage) : baseDamage);
  if (o.slowFrames) player.hazardSlowT = Math.max(player.hazardSlowT || 0, o.slowFrames);
  if (o.launch) { player.vy = Math.min(player.vy, o.launch); player.onGround = false; }
  return dmgPlayer({ amount:damage, sourceName:def.name, sourceX:hazard.x, heavy:!!o.heavy });
}

function playerOnIceFloor(p) {
  if (!p.onGround) return false;
  // 一般模式：地形冰面不再滑行（僅保留外觀）；Boss 冰面仍屬 Boss 機制不受影響。
  const terrainIce = terrainMovementHazardsEnabled() && dungeonHazards.some(hazard => hazard.type === 'ice_floor'
    && Math.abs(p.y - hazard.y) < 3 && p.x >= hazard.x - hazard.w / 2 && p.x <= hazard.x + hazard.w / 2);
  return terrainIce || (typeof playerOnDungeonBossIce === 'function' && playerOnDungeonBossIce(p));
}

function dungeonHazardMoveVelocity(p, moveDirection, speed) {
  if (!playerOnIceFloor(p)) return moveDirection * speed;
  const def = DUNGEON_HAZARD_DEFS.ice_floor;
  if (moveDirection) {
    const desired = moveDirection * speed;
    const delta = Math.max(-def.acceleration, Math.min(def.acceleration, desired - p.vx));
    return p.vx + delta;
  }
  const coast = p.vx * def.coast;
  return Math.abs(coast) < 0.04 ? 0 : coast;
}

function updateDungeonHazards() {
  if (dungeonHazardTutorial && dungeonHazardTutorial.t > 0) dungeonHazardTutorial.t--;
  if (!dungeonHazards.length || !currentRoomSpec) return false;
  for (const hazard of dungeonHazards) {
    const def = DUNGEON_HAZARD_DEFS[hazard.type];
    if (hazard.type === 'void_platforms') {
      advanceVoidPlatform(hazard, def);
      continue;
    }
    if (hazard.type === 'ice_floor') continue;
    advancePulsingHazard(hazard, def);
    if (hazard.phase !== 'active' || hazard.hitThisCycle || player.inv > 0) continue;
    if (hazard.type === 'thorn_roots' && thornRootHitsPlayer(hazard, player)) {
      if (damageFromDungeonHazard(hazard, def, { slowFrames:def.slowFrames, launch:-3 })) return true;
      num(player.x, player.y - player.h - 28, '根鬚緩速', '#a9df6f', { size:13 });
    } else if (hazard.type === 'falling_rocks' && fallingRockHitsPlayer(hazard, player, def)) {
      if (damageFromDungeonHazard(hazard, def, { heavy:true })) return true;
    } else if (hazard.type === 'lava_vents' && lavaVentHitsPlayer(hazard, player)) {
      if (damageFromDungeonHazard(hazard, def, { launch:-4 })) return true;
    }
  }
  return false;
}

function drawThornRoot(root) {
  const left = root.x - root.w / 2;
  if (root.phase === 'warning') {
    const def = DUNGEON_HAZARD_DEFS.thorn_roots;
    const progress = 1 - Math.max(0, root.timer) / def.warningFrames;
    ctx.globalAlpha = 0.45 + Math.sin(frame * 0.35) * 0.12;
    ctx.fillStyle = '#6f4b2b'; ctx.fillRect(left, root.y - 6, root.w, 6);
    ctx.fillStyle = '#c98a45';
    for (let x = left + 6; x < left + root.w - 3; x += 14) ctx.fillRect(x, root.y - 9 - progress * 3, 8, 3);
    ctx.globalAlpha = 1; ctx.strokeStyle = '#f2cf75'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.strokeRect(left, root.y - 12, root.w, 11); ctx.setLineDash([]); return;
  }
  if (root.phase === 'active') {
    const count = Math.max(4, Math.floor(root.w / 13));
    const step = root.w / count;
    ctx.fillStyle = '#5c8f38';
    for (let i = 0; i < count; i++) {
      const x = left + i * step, height = i % 2 ? 27 : 34;
      ctx.beginPath(); ctx.moveTo(x, root.y); ctx.lineTo(x + step / 2, root.y - height); ctx.lineTo(x + step, root.y); ctx.fill();
    }
    ctx.fillStyle = '#a9df6f'; ctx.fillRect(left, root.y - 4, root.w, 4); return;
  }
  ctx.globalAlpha = 0.5; ctx.fillStyle = '#43652f';
  for (let x = left + 4; x < left + root.w; x += 16) ctx.fillRect(x, root.y - 5, 10, 4);
  ctx.globalAlpha = 1;
}

function drawFallingRock(hazard) {
  const def = DUNGEON_HAZARD_DEFS.falling_rocks;
  if (hazard.phase === 'warning') {
    ctx.globalAlpha = 0.3 + Math.sin(frame * 0.35) * 0.1;
    ctx.fillStyle = '#d8c7a3'; ctx.fillRect(hazard.x - hazard.w / 2, hazard.y - 8, hazard.w, 8);
    ctx.globalAlpha = 1; ctx.strokeStyle = '#f0d9a2'; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
    ctx.strokeRect(hazard.x - hazard.w / 2, hazard.y - 14, hazard.w, 13); ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const y = 70 + ((frame * 3 + i * 37) % 210);
      ctx.fillStyle = '#8b806f'; ctx.fillRect(hazard.x - 18 + i * 11, y, 5, 5);
    }
  } else if (hazard.phase === 'active') {
    const y = fallingRockY(hazard, def);
    ctx.fillStyle = '#615b55'; ctx.fillRect(hazard.x - 14, y - 12, 28, 24);
    ctx.fillStyle = '#9b9184'; ctx.fillRect(hazard.x - 8, y - 16, 16, 5);
    ctx.fillStyle = '#f0d9a2'; ctx.fillRect(hazard.x - 3, y - 4, 6, 6);
  } else {
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#4d4945'; ctx.fillRect(hazard.x - hazard.w / 2, hazard.y - 4, hazard.w, 4); ctx.globalAlpha = 1;
  }
}

function drawLavaVent(hazard) {
  const left = hazard.x - hazard.w / 2;
  ctx.fillStyle = '#4b2520'; ctx.fillRect(left, hazard.y - 7, hazard.w, 7);
  if (hazard.phase === 'warning') {
    const pulse = 0.45 + Math.sin(frame * 0.45) * 0.2;
    ctx.globalAlpha = pulse; ctx.fillStyle = '#ff9a36'; ctx.fillRect(left + 4, hazard.y - 12, hazard.w - 8, 10); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 2; ctx.strokeRect(left, hazard.y - 14, hazard.w, 13);
  } else if (hazard.phase === 'active') {
    ctx.fillStyle = '#ff5a24'; ctx.fillRect(left + 5, hazard.y - 58, hazard.w - 10, 55);
    ctx.fillStyle = '#ffd45f'; ctx.fillRect(left + 14, hazard.y - 72, Math.max(8, hazard.w - 28), 69);
    ctx.fillStyle = '#fff2a8'; ctx.fillRect(hazard.x - 4, hazard.y - 52, 8, 49);
  } else {
    ctx.globalAlpha = 0.45; ctx.fillStyle = '#9b3b27'; ctx.fillRect(left + 6, hazard.y - 9, hazard.w - 12, 5); ctx.globalAlpha = 1;
  }
}

function drawIceFloor(hazard) {
  const left = hazard.x - hazard.w / 2;
  ctx.globalAlpha = 0.72; ctx.fillStyle = '#bdefff'; ctx.fillRect(left, hazard.y - 7, hazard.w, 7);
  ctx.fillStyle = '#e9fbff'; ctx.fillRect(left + 4, hazard.y - 7, hazard.w - 8, 2);
  ctx.strokeStyle = '#6eb9d8'; ctx.lineWidth = 1;
  for (let x = left + 20; x < left + hazard.w - 10; x += 42) {
    ctx.beginPath(); ctx.moveTo(x, hazard.y - 6); ctx.lineTo(x + 8, hazard.y - 1); ctx.lineTo(x + 15, hazard.y - 6); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawVoidPlatform(hazard) {
  const platform = hazard.platform;
  if (hazard.phase === 'gone') {
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#b05ae0'; ctx.fillRect(platform.x, platform.y, platform.w, 7);
    ctx.globalAlpha = 0.65; ctx.strokeStyle = '#d9a8ff'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.strokeRect(platform.x, platform.y - 2, platform.w, 12); ctx.setLineDash([]); ctx.globalAlpha = 1; return;
  }
  const warning = hazard.phase === 'warning';
  ctx.globalAlpha = warning ? 0.35 + Math.sin(frame * 0.55) * 0.3 : 0.5;
  ctx.fillStyle = warning ? '#f0b4ff' : '#b05ae0'; ctx.fillRect(platform.x, platform.y - 4, platform.w, 8);
  ctx.globalAlpha = 1;
  if (warning) {
    ctx.strokeStyle = '#fff2a8'; ctx.lineWidth = 2; ctx.strokeRect(platform.x, platform.y - 7, platform.w, 14);
  }
}

function drawDungeonHazards() {
  for (const hazard of dungeonHazards) {
    if (hazard.type === 'thorn_roots') drawThornRoot(hazard);
    else if (hazard.type === 'falling_rocks') drawFallingRock(hazard);
    else if (hazard.type === 'lava_vents') drawLavaVent(hazard);
    else if (hazard.type === 'ice_floor') drawIceFloor(hazard);
    else if (hazard.type === 'void_platforms') drawVoidPlatform(hazard);
  }
}

function dungeonHazardColor(id) {
  return { thorn_roots:'#a9df6f', falling_rocks:'#f0d9a2', lava_vents:'#ff9a36', ice_floor:'#bdefff', void_platforms:'#d9a8ff' }[id] || '#ffb45e';
}

function drawDungeonHazardTutorial() {
  const tutorial = dungeonHazardTutorial;
  if (!tutorial || tutorial.t <= 0) return;
  const alpha = Math.min(1, tutorial.t / 30, (tutorial.maxT - tutorial.t + 1) / 20);
  const color = dungeonHazardColor(tutorial.id);
  const x = W / 2 - 230;
  const y = typeof floorTrial !== 'undefined' && floorTrial && floorTrial.status === 'active' ? 76 : 62;
  const w = 460, h = 50;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(20,22,43,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = 'bold 13px ' + STAT_FONT;
  ctx.fillText('首次遭遇 · ' + tutorial.name, W / 2, y + 19);
  ctx.fillStyle = '#c8cdec'; ctx.font = '12px ' + STAT_FONT;
  ctx.fillText(tutorial.text, W / 2, y + 39);
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
