"use strict";
// ---------- update ----------
function update() {
  const p = player;
  if (eventPanel) return;
  if (p.inv > 0) p.inv--;
  if (p.potCd > 0) p.potCd--;
  for (let i = 0; i < 3; i++) if (p.slotCd[i] > 0) p.slotCd[i]--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.dashT > 0) p.dashT--;
  if (p.rageT > 0) {
    p.rageT--;
    if (p.rageBlood) {
      const low = p.hp / p.mhp < 0.5;
      p.rageAtk = low ? (p.rageUltimate ? 0.65 : 0.45) : 0.3;
      p.rageSpd = low ? 1.1 : 0.8;
      p.rageLifesteal = low && p.rageUltimate ? 0.08 : 0;
    }
    if (p.rageT === 0) { p.rageAtk = 0; p.rageSpd = 0; p.rageLifesteal = 0; p.rageExtend = 0; p.rageBlood = false; p.rageUltimate = false; }
  }
  if (p.chillT > 0) p.chillT--;
  if (p.hazardSlowT > 0) p.hazardSlowT--;
  if (p.shieldT > 0) {
    p.shieldT--;
    if (p.shieldT === 0) { p.shieldHp = 0; p.shieldReflect = 0; p.shieldBreakMp = 0; p.shieldBurst = false; }
  }
  if (perkV('aegis') > 0) { // 守護結界:每12秒補護盾
    if (p.aegisCd > 0) p.aegisCd--;
    if (p.aegisCd <= 0) {
      p.shieldHp = Math.max(p.shieldHp, Math.round(p.mhp * 0.15 * perkV('aegis')));
      p.shieldT = Math.max(p.shieldT, 900);
      p.aegisCd = 720;
    }
  }
  if (p.cast > 0) p.cast--;
  if (p.dropT > 0) p.dropT--;
  if (p.slashT > 0) p.slashT--;
  if (p.spinT > 0) p.spinT--;
  if (floorT > 0) floorT--;
  updateFloorTrial(1);

  if (keys['space'] && openFloorEvent()) { inputBuffer.jump = 0; return; }

  // movement
  let mv = 0;
  if (keys['arrowleft']) mv = -1;
  if (keys['arrowright']) mv = 1;
  if (inputBuffer.dash > 0 && p.dashCd <= 0) {
    const dir = mv || p.face || 1;
    p.dashDir = dir; p.face = dir; p.dashT = DASH_DURATION; p.dashCd = DASH_COOLDOWN;
    p.inv = Math.max(p.inv, 8); p.vy *= 0.25; inputBuffer.dash = 0;
    burst(p.x - dir * 8, p.y - p.h / 2, '#bdefff', 8);
    playSkillAnim('smoke', p.x - dir * 10, p.y - 28, { scale:0.9, flip:dir < 0, layer:'back', alpha:0.65, life:18 });
    playSfx('swordSwing', 0.45, 1.35);
  }
  if (p.dashT <= 0 && mv !== 0) { p.face = mv; p.walk++; }
  else if (p.dashT <= 0) p.walk = 0;
  if (p.dashT > 0) {
    p.vx = p.dashDir * DASH_SPEED;
    if (p.dashT % 2 === 0) parts.push({ x:p.x - p.dashDir * 10, y:p.y - 22, vx:-p.dashDir * 0.8, vy:-0.25, t:12, color:'#bdefff' });
  } else p.vx = dungeonHazardMoveVelocity(p, mv, moveSpd());
  if (p.onGround) coyoteT = 6;
  else if (coyoteT > 0) coyoteT--;
  if (inputBuffer.jump > 0) {
    if (p.onGround || coyoteT > 0) {
      p.airJumped = false;
      if (p.onGround && keys['arrowdown']) {
        const cur = plats.find(q => !q.ground && !q.voidDisabled && Math.abs(p.y - q.y) < 2 && p.x > q.x - 5 && p.x < q.x + q.w + 5);
        if (cur) { p.dropT = 18; p.onGround = false; p.vy = 2; }
        else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
      } else { p.vy = -jumpV(); p.onGround = false; beep(300, 0.06, 'triangle', 0.02); }
      coyoteT = 0; inputBuffer.jump = 0;
    } else if ((perkV('djump') > 0 || affixV('doubleJump') > 0) && !p.airJumped) { // 羽翼卡/詞綴:二段跳
      p.vy = -jumpV() * 0.9; p.airJumped = true;
      burst(p.x, p.y - p.h / 2, '#c8f4ff', 8);
      beep(340, 0.06, 'triangle', 0.02);
      inputBuffer.jump = 0;
    }
  }
  const oldY = p.y;
  p.vy += 0.6; if (p.vy > 14) p.vy = 14;
  p.x += p.vx; p.y += p.vy;
  if (p.x < 14) p.x = 14;
  if (p.x > worldW - 14) p.x = worldW - 14;
  p.onGround = false;
  if (p.vy >= 0) {
    for (const q of plats) {
      if (q.voidDisabled) continue;
      if (oldY <= q.y + 0.01 && p.y >= q.y && p.x > q.x - 6 && p.x < q.x + q.w + 6) {
        if (!q.ground && p.dropT > 0) continue;
        p.y = q.y; p.vy = 0; p.onGround = true; p.airJumped = false;
        break;
      }
    }
  }
  if (p.y > 600) { p.y = 468; p.vy = 0; p.onGround = true; p.airJumped = false; }

  if (updateDungeonHazards()) return;
  if (updateDungeonBossEffects(p)) return;

  // portal
  if (portal && Math.abs(p.x - portal.x) < 26 && p.y > 440) {
    advanceDungeonPortal();
    return;
  }

  // skills(出戰槽 Z/X/C)
  for (let i = 0; i < 3; i++) {
    if (inputBuffer.skills[i] <= 0 || p.slotCd[i] > 0) continue;
    trySkill(i);
    inputBuffer.skills[i] = 0;
  }

  // projectiles
  for (const pr of projs.slice()) {
    if (pr.kind === 'fire' && pr.aimT > 0) {
      pr.aimT--;
      const target = pr.aimTarget, face = pr.vx < 0 ? -1 : 1;
      const forward = target && mons.includes(target) ? (target.x - pr.x) * face : -1;
      if (forward > 0 && forward < 680) {
        const targetY = target.y - target.h / 2;
        const wanted = Math.max(-0.7, Math.min(0.7, Math.atan2(targetY - pr.y, forward)));
        let angle = Math.atan2(pr.vy || 0, Math.abs(pr.vx));
        angle += Math.max(-0.035, Math.min(0.035, wanted - angle));
        const speed = Math.hypot(pr.vx, pr.vy || 0) || 7.5;
        pr.vx = face * Math.cos(angle) * speed; pr.vy = Math.sin(angle) * speed;
      } else pr.aimT = 0;
    }
    pr.x += pr.vx; pr.y += pr.vy || 0; pr.t--;
    let gone = pr.t <= 0;
    for (const m of mons) {
      if (pr.pierce && pr.hits.indexOf(m) >= 0) continue;
      const fireVsBat = pr.kind === 'fire' && m.type === 'bat';
      if (Math.abs(pr.x - m.x) < m.w / 2 + (fireVsBat ? 12 : 8) && Math.abs(pr.y - (m.y - m.h / 2)) < m.h / 2 + (fireVsBat ? 18 : 10)) {
        const tt = pr.talent || { mechanic:false, ultimate:false, branch:-1 };
        const pierceBonus = pr.kind === 'ice' && tt.mechanic && tt.branch === 1 ? 1 + (pr.pierceN || 0) * 0.2 : 1;
        const r = skillDmg((pr.mult || 1) * pierceBonus);
        hitMon(m, r.d, r.crit);
        if (pr.kind === 'ice') {
          pr.pierceN = (pr.pierceN || 0) + 1;
          m.slowT = tt.mechanic && tt.branch === 0 ? 300 : 180;
          if (tt.ultimate && tt.branch === 0) { m.freezeT = Math.max(m.freezeT || 0, 90); num(m.x, m.y - m.h - 18, '凍結', '#d8f4ff'); }
          if (tt.ultimate && tt.branch === 1) skillAreaDamage(m.x, m.y - m.h / 2, 58, 55, 0.65 * pr.mult, '#d8f4ff', { exclude:new Set([m]), particles:5 });
          burst(pr.x, pr.y, '#7dcfff', 8);
          playSkillAnim('iceSpikes', m.x, m.y - 34, { scale:tt.ultimate ? 1.35 : 1.05, layer:'back' });
          pr.hits.push(m);
        } else {
          burst(pr.x, pr.y, '#ff8c2e', 10);
          playSkillAnim('explosion', m.x, m.y - m.h / 2, { scale:tt.ultimate ? 1.45 : 1.05 });
          if (tt.mechanic && tt.branch === 0) {
            skillAreaDamage(m.x, m.y - m.h / 2, 72 * tt.area, 62 * tt.area, 0.7 * pr.mult, '#ff8c2e', { exclude:new Set([m]), particles:8 });
            if (tt.ultimate) addSkillZone('burn', m.x, m.y, 78 * tt.area, 45, 0, 240, 30, 0.28 * pr.mult, '#ff6b2e');
          } else if (tt.mechanic && tt.branch === 1) {
            chainSkillTargets(m, new Set([m]), tt.ultimate ? 3 : 2, pr.mult, tt.ultimate ? 1.15 : 0.78);
          }
          gone = true; break;
        }
      }
    }
    if (gone) projs.splice(projs.indexOf(pr), 1);
  }

  // 隕石
  for (const mt of meteors.slice()) {
    mt.y += mt.vy;
    if (!mt.hits) mt.hits = [];
    parts.push({ x: mt.x + (Math.random() - 0.5) * 10, y: mt.y - 10, vx: 0, vy: -1, t: 10, color: '#ff8c2e' });
    // 下墜途中撞到怪就打(涵蓋平台上/空中的怪),每顆隕石對同隻只打一次
    for (const m of mons) {
      if (mt.hits.indexOf(m) >= 0) continue;
      if (Math.abs(m.x - mt.x) < mt.r * 0.5 + m.w / 2 && Math.abs(mt.y - (m.y - m.h / 2)) < m.h / 2 + 24) {
        const r = skillDmg(mt.mult); hitMon(m, r.d, r.crit); mt.hits.push(m);
      }
    }
    if (mt.y >= 495) {
      burst(mt.x, 495, '#ff8c2e', 20);
      playSkillAnim('groundBurst', mt.x, 462, { scale:Math.max(1.4, mt.r / 40), layer:'back' });
      playSkillAnim('explosion', mt.x, 455, { scale:Math.max(1.2, mt.r / 48) });
      beep(100, 0.2, 'sawtooth', 0.05);
      for (const m of mons.slice()) { // 落地範圍爆炸,補打附近地面怪
        if (mt.hits.indexOf(m) >= 0) continue;
        if (Math.abs(m.x - mt.x) < mt.r + m.w / 2 && Math.abs(m.y - 468) < 130) {
          const r = skillDmg(mt.mult); hitMon(m, r.d, r.crit);
        }
      }
      const tt = mt.talent || { mechanic:false, ultimate:false, branch:-1 };
      if (tt.mechanic && tt.branch === 0) {
        const zr = mt.r * (tt.ultimate ? 1.25 : 0.95), dur = tt.ultimate ? 360 : 210;
        addSkillZone('sunfire', mt.x, 468, zr, 48, 0, dur, 30, (tt.ultimate ? 0.38 : 0.28) * tt.dmg, '#ff7a36');
      }
      if (tt.ultimate && tt.branch === 1) addSkillZone('impact', mt.x, 445, mt.r * 1.15, 105, 24, 1, 1, 1.45 * tt.dmg, '#ffb04a', { knock:48 });
      meteors.splice(meteors.indexOf(mt), 1);
    }
  }

  for (const a of skillAnims.slice()) {
    a.life--;
    if (a.life <= 0) skillAnims.splice(skillAnims.indexOf(a), 1);
  }

  // 技能持續區域與延遲餘波
  for (const z of skillZones.slice()) {
    if (z.delay > 0) { z.delay--; continue; }
    z.t--;
    const pulse = !z.fired && z.maxT <= 1;
    const tick = z.maxT > 1 && z.t % z.interval === 0;
    if (pulse || tick) {
      z.fired = true;
      skillAreaDamage(z.x, z.y, z.rx, z.ry, z.mult, z.color, z.opts);
      burst(z.x, z.y, z.color, z.maxT > 1 ? 5 : 18);
      playZoneAnim(z);
      if (z.kind === 'thunder') bolts.push({ x:z.x, y:z.y, t:12 });
    }
    if (z.t <= 0) skillZones.splice(skillZones.indexOf(z), 1);
  }

  // monsters
  const MONSTER_MOVE_MUL = 0.72;
  for (const m of mons) {
    if (m.hitT > 0) m.hitT--;
    if (m.slowT > 0) m.slowT--;
    if (m.freezeT > 0) m.freezeT--;
    if (m.vulnT > 0) m.vulnT--; else m.vulnMul = 1;
    const slowF = m.freezeT > 0 ? 0 : m.slowT > 0 ? 0.5 : 1;
    const moveF = slowF * MONSTER_MOVE_MUL;
    if (m.type === 'slime' || m.type === 'icer' || m.type === 'splitter') {
      m.x += m.vx * moveF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
    } else if (m.type === 'mush') {
      m.x += m.vx * moveF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
      m.jt--;
      if (m.jt <= 0 && m.onG) { m.vy = -8.5; m.onG = false; m.jt = 70 + Math.random() * 40; }
      if (!m.onG) {
        m.vy += 0.5; m.y += m.vy;
        if (m.y >= m.baseY) { m.y = m.baseY; m.vy = 0; m.onG = true; }
      }
    } else if (m.type === 'spore') {
      m.x += m.vx * 0.5 * moveF;
      if (m.x < m.minx) { m.x = m.minx; m.vx = Math.abs(m.vx); }
      if (m.x > m.maxx) { m.x = m.maxx; m.vx = -Math.abs(m.vx); }
      m.st--;
      if (m.st <= 0 && Math.abs(p.x - m.x) < 420 && p.y > 300) {
        espits.push({ x: m.x, y: m.y - m.h + 4, vx: (p.x - m.x) / 65, vy: -3.5, dmg: Math.round(m.dmg * 0.8), ownerName:monsterLabel(m) });
        m.st = 110;
        beep(400, 0.08, 'square', 0.03);
      }
    } else if (m.type === 'bomber') {
      const dir = p.x < m.x ? -1 : 1;
      m.x += dir * 1.4 * moveF;
      if (m.fuse != null) {
        m.fuse--;
        if (m.fuse <= 0) m.boom = true;
        else if (Math.floor(m.fuse / 4) % 2 === 0) m.hitT = 2; // 引信閃爍預警
      } else if (Math.abs(m.x - p.x) < 48 && Math.abs(m.y - p.y) < 60) {
        m.fuse = 30;
      }
    } else if (m.type === 'charger') {
      if (m.chg > 0) {
        m.chg--;
        m.x += m.dir * 7.5 * moveF;
        if (m.x < 40) { m.x = 40; m.chg = 0; }
        if (m.x > worldW - 40) { m.x = worldW - 40; m.chg = 0; }
        if (m.chg === 0) { m.minx = Math.max(20, m.x - 140); m.maxx = Math.min(worldW - 20, m.x + 140); } // 衝刺後巡邏範圍跟到當前位置,避免瞬移
      } else if (m.tel > 0) {
        m.tel--; m.hitT = 2;
        if (m.tel === 0) { m.chg = 26; beep(300, 0.1, 'sawtooth', 0.04); }
      } else {
        m.x += m.vx * moveF;
        if (m.x < m.minx) m.vx = Math.abs(m.vx); // 軟反彈,不設值避免瞬移
        if (m.x > m.maxx) m.vx = -Math.abs(m.vx);
        if (Math.abs(p.y - m.y) < 46 && Math.abs(p.x - m.x) < 320) { m.dir = p.x < m.x ? -1 : 1; m.tel = 28; }
      }
    } else if (m.type === 'boss') {
      m.t++;
      const bossDef = dungeonBossDef(m.bossId);
      const ph = dungeonBossPhaseForHealth(m);
      const phaseConfig = dungeonBossPhaseConfig(m, ph);
      if (ph > m.phase) {
        m.phase = ph; m.phaseT = 20;
        if (typeof recordDungeonBossPhase === 'function') recordDungeonBossPhase(ph);
        burst(m.x, m.y - m.h / 2, bossDef.color, 30);
        num(m.x, m.y - m.h - 34, '第 ' + ph + ' 階段', bossDef.color, { size:18, pop:4 });
        beep(200, 0.3, 'sawtooth', 0.06);
        spawnBossAdds(dungeonBossAddCount(m, ph));
      }
      if (m.phaseT > 0) m.phaseT--;
      const dir = p.x < m.x ? -1 : 1;
      const grounded = m.y >= 468 && m.vy >= 0;
      const specialAttack = updateDungeonBossSpecialAttack(m, p);
      if (specialAttack.playerDied) return;
      if (specialAttack.handled) {
        m.vx = 0;
      } else if (m.atkT > 0) {
        m.atkT--;
        if (grounded) m.vx = dir * phaseConfig.chaseSpeed; // 追著玩家走
      } else if (m.tele > 0) {
        m.tele--; m.vx = 0;
        if (m.tele === 12 || m.tele === 4) beep(m.tele === 4 ? 760 : 580, 0.05, 'square', 0.025);
        if (m.tele === 0 && grounded) {
          m.vy = phaseConfig.leapVelocity; // 跳撲
          const airTicks = Math.max(1, Math.ceil(-2 * m.vy / 0.6));
          m.vx = (m.targetX - m.x) / airTicks / Math.max(0.01, moveF);
          m.slamWarn = true;
          { // 共用跳撲彈幕；專屬招式由各 Boss 後續批次接入 attackSlots。
            const nsp = Math.max(1, phaseConfig.volleyCount - (m.intro ? 1 : 0)) + (phaseConfig.volleyBonus || 0);
            const vsc = phaseConfig.volleySpeed || 1;
            for (let i = 0; i < nsp; i++) {
              espits.push({
                x: m.x, y: m.y - m.h + 6,
                vx: ((p.x - m.x) / 55 + (i - (nsp - 1) / 2) * 1.1) * vsc,
                vy: -6 - Math.random() * 2, dmg: Math.round(m.dmg * 0.7), chill:!!phaseConfig.projectileChill, col:bossDef.color,
                ownerName:monsterLabel(m), heavy:ph === 3
              });
            }
            beep(320, 0.12, 'square', 0.04);
          }
          m.atkT = Math.round(phaseConfig.recoveryFrames * bossDef.recoveryMultiplier);
        }
      } else if (grounded) {
        const nextAttack = dungeonBossNextAttack(m);
        if (nextAttack !== bossDef.legacyAttackId) startDungeonBossSpecialAttack(m, p, nextAttack, plats);
        else {
          beginDungeonBossAttack(m, bossDef.legacyAttackId);
          m.tele = bossDef.warningFrames;
          m.targetX = Math.max(60, Math.min(worldW - 60, Math.max(m.x - bossDef.leapRange, Math.min(m.x + bossDef.leapRange, p.x))));
        }
      }
      if (!specialAttack.handled) {
        m.vy += 0.6; if (m.vy > 14) m.vy = 14;
        m.x += m.vx * moveF; m.y += m.vy;
        if (m.x < 60) m.x = 60;
        if (m.x > worldW - 60) m.x = worldW - 60;
      }
      if (!specialAttack.handled && m.y >= 468) {
        const completedSlam = m.slamWarn && m.vy > 0;
        if (m.vy > 3 && ph === 3) { // 狂暴期落地震波
          burst(m.x, 468, '#b05ae0', 26);
          beep(90, 0.2, 'sawtooth', 0.06);
          if (p.onGround && Math.abs(p.x - m.x) < (m.intro ? 130 : 150) && p.inv === 0) {
            const d = Math.max(1, Math.round(m.dmg * 0.9) - armorDef());
            p.vx = (p.x < m.x ? -1 : 1) * 6; p.vy = -6; p.onGround = false;
            if (dmgPlayer({ amount:d, sourceName:monsterLabel(m) + '的落地震波', sourceX:m.x, heavy:true })) return;
          }
        }
        m.y = 468; m.vy = 0;
        if (completedSlam) finishDungeonBossAttack(m);
      }
    } else {
      m.t++;
      const ddx = p.x - m.x, ddy = (p.y - 26) - m.y;
      const dist = Math.hypot(ddx, ddy) || 1;
      if (dist < 360) {
        // 俯衝追擊玩家
        const sp = Math.min(2.2, 1.1 + floor * 0.06) * moveF;
        m.x += ddx / dist * sp + Math.sin(m.t * 0.15) * 0.5 * MONSTER_MOVE_MUL;
        m.y += ddy / dist * sp + Math.cos(m.t * 0.13) * 0.5 * MONSTER_MOVE_MUL;
        m.vx = ddx;
      } else {
        // 緩慢飄回巡邏點
        const bx2 = m.ax + Math.sin(m.t * 0.02) * 90;
        const by2 = m.ay + Math.sin(m.t * 0.055) * 34;
        m.x += (bx2 - m.x) * 0.03 * MONSTER_MOVE_MUL;
        m.y += (by2 - m.y) * 0.03 * MONSTER_MOVE_MUL;
      }
      if (m.y > 448) m.y = 448;
    }
    if (p.inv === 0 &&
        Math.abs(m.x - p.x) < (m.w + p.w) / 2 - 4 &&
        Math.abs((m.y - m.h / 2) - (p.y - p.h / 2)) < (m.h + p.h) / 2 - 6) {
      const d = Math.max(1, Math.round(m.dmg * (0.9 + Math.random() * 0.2)) - armorDef());
      p.vx = (p.x < m.x ? -1 : 1) * 5; p.vy = -5; p.onGround = false;
      if (m.type === 'icer') { p.chillT = 120; num(p.x, p.y - p.h - 24, '凍結', '#7ec8f0'); }
      if (dmgPlayer({ amount:d, sourceName:monsterLabel(m) + '的碰撞攻擊', sourceX:m.x })) return;
    }
  }
  // bomber 引爆(loop 外處理,避免遍歷中 splice)
  for (const m of mons.slice()) {
    if (m.boom) { if (explodeBomber(m)) return; }
  }

  // boss 毒彈
  for (const s of espits.slice()) {
    s.vy += 0.25; s.x += s.vx; s.y += s.vy;
    if (p.inv === 0 && Math.abs(s.x - p.x) < 15 && Math.abs(s.y - (p.y - p.h / 2)) < p.h / 2 + 8) {
      const d = Math.max(1, s.dmg - armorDef());
      if (s.chill) { p.chillT = 150; num(p.x, p.y - p.h - 24, '凍結', '#7ec8f0'); }
      espits.splice(espits.indexOf(s), 1);
      if (dmgPlayer({ amount:d, sourceName:s.sourceName || (s.ownerName || '怪物') + '的彈幕', sourceX:s.x, heavy:!!s.heavy })) return;
      continue;
    }
    if (s.y > 505 || s.x < -20 || s.x > worldW + 20) {
      burst(s.x, Math.min(s.y, 468), '#8a5adf', 5);
      espits.splice(espits.indexOf(s), 1);
    }
  }

  // soul orbs
  for (const o of orbs.slice()) {
    o.t++;
    if (o.t < 16) { o.vy += 0.3; o.x += o.vx; o.y += o.vy; }
    else {
      const dx = p.x - o.x, dy = (p.y - 24) - o.y;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = Math.min(9, 3 + o.t * 0.12);
      o.x += dx / dist * sp; o.y += dy / dist * sp;
      if (dist < 22) {
        soulsRun++;
        parts.push({ x: o.x, y: o.y, vx: 0, vy: -1, t: 12, color: '#7dffd6' });
        orbs.splice(orbs.indexOf(o), 1);
      }
    }
  }

  // potion drops
  for (const d of drops.slice()) {
    d.t--; d.vy += 0.5; d.y += d.vy; d.x += d.vx;
    if (d.y > d.ground) { d.y = d.ground; d.vy = 0; d.vx = 0; }
    if (Math.abs(d.x - p.x) < 24 && Math.abs(d.y - p.y) < 40) {
      p.bag[d.type]++;
      num(d.x, d.y - 20, '獲得 ' + (d.type === 'hp' ? '紅色藥水' : '藍色藥水'), d.type === 'hp' ? '#ff8a8a' : '#8aa8ff');
      playSfx('pickup', 0.72, 1.12);
      drops.splice(drops.indexOf(d), 1);
    } else if (d.t <= 0) drops.splice(drops.indexOf(d), 1);
  }
  // gear drops
  for (const g of gearDrops.slice()) {
    g.t--; g.vy += 0.5; g.y += g.vy; g.x += g.vx;
    if (g.y > g.ground) { g.y = g.ground; g.vy = 0; g.vx = 0; }
    if (Math.abs(g.x - p.x) < 26 && Math.abs(g.y - p.y) < 40) {
      addGear(g.it);
      gearDrops.splice(gearDrops.indexOf(g), 1);
    } else if (g.t <= 0) gearDrops.splice(gearDrops.indexOf(g), 1);
  }

  // fx timers
  for (const d of dmgNums.slice()) { d.t--; d.y -= d.vy == null ? 0.7 : d.vy; if (d.t <= 0) dmgNums.splice(dmgNums.indexOf(d), 1); }
  for (const q of parts.slice()) { q.t--; q.x += q.vx; q.y += q.vy; q.vy += 0.15; if (q.t <= 0) parts.splice(parts.indexOf(q), 1); }
  for (const b of bolts.slice()) { b.t--; if (b.t <= 0) bolts.splice(bolts.indexOf(b), 1); }

  // regen
  const recoveryMul = 1 + 0.1 * meta.up.recovery;
  if (p.hp < p.mhp) p.hp = Math.min(p.mhp, p.hp + 0.008 * recoveryMul);
  if (p.mp < p.mmp) p.mp = Math.min(p.mmp, p.mp + 0.05 * (1 + 0.5 * p.cd.mp) * recoveryMul);
}
