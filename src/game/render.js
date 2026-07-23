"use strict";
// ---------- render ----------
let camX = 0;
function drawFloorEventWorld() {
  if (!floorEvent) return;
  const e = floorEvent, d = currentFloorEventDef(), x = e.x, y = e.y;
  if (!d) return;
  ctx.save();
  ctx.globalAlpha = e.status === 'done' ? 0.45 : 1;
  const bob = Math.sin(frame * 0.08) * 2;
  if (e.type === 'chest') {
    ctx.fillStyle = '#6b3f20'; ctx.fillRect(x - 24, y - 30, 48, 28);
    ctx.fillStyle = '#b96b2f'; ctx.fillRect(x - 26, y - 40 + bob, 52, 15);
    ctx.fillStyle = '#ffd36a'; ctx.fillRect(x - 4, y - 28, 8, 13); ctx.fillRect(x - 20, y - 37 + bob, 40, 3);
  } else if (e.type === 'shrine') {
    ctx.fillStyle = '#504064'; ctx.fillRect(x - 28, y - 10, 56, 10); ctx.fillRect(x - 19, y - 20, 38, 10);
    ctx.fillStyle = '#8165a0'; ctx.fillRect(x - 9, y - 62, 18, 43);
    ctx.fillStyle = '#d9a8ff'; ctx.beginPath(); ctx.arc(x, y - 70 + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha *= 0.22; ctx.beginPath(); ctx.arc(x, y - 70 + bob, 22, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = e.status === 'done' ? 0.45 : 1;
  } else {
    ctx.fillStyle = e.status === 'challenge' ? '#7a2f32' : '#3c344b'; ctx.fillRect(x - 18, y - 65, 36, 65);
    ctx.fillStyle = '#1b1725'; ctx.fillRect(x - 12, y - 57, 24, 50);
    ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 38, 11 + Math.sin(frame * 0.1) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff8a6a'; ctx.fillRect(x - 3, y - 44, 6, 12);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.font = 'bold 12px ' + STAT_FONT;
  ctx.fillStyle = ['done', 'declined'].includes(e.status) ? '#777' : d.color;
  const near = Math.abs(player.x - e.x) <= 72 && Math.abs(player.y - e.y) <= 60;
  const label = e.status === 'done' ? '已使用' : e.status === 'declined' ? '已拒絕' : ['challenge', 'combat'].includes(e.status) ? '事件戰鬥進行中' : near ? '[Space] 互動' : d.name;
  ctx.fillText(label, x, y - 84);
  ctx.restore();
}
function drawEventPanel() {
  if (!eventPanel || !floorEvent) return;
  const d = DUNGEON_EVENT_DEFS[eventPanel.eventId];
  if (!d) return;
  const options = dungeonEventOptionViews(d, currentRoomSpec, floorEventState());
  eventChoiceBtns.length = 0;
  ctx.fillStyle = 'rgba(5,6,16,0.76)'; ctx.fillRect(0, 0, W, H);
  const x = 140, y = 66, w = 680, h = 420;
  ctx.fillStyle = 'rgba(24,25,46,0.99)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = d.color; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = d.color; ctx.font = 'bold 25px ' + STAT_FONT;
  ctx.fillText(d.name, W / 2, y + 42);
  ctx.fillStyle = '#c8cdec'; ctx.font = '14px ' + STAT_FONT;
  ctx.fillText(d.desc, W / 2, y + 72);
  ctx.fillStyle = '#9299b9'; ctx.font = '12px ' + STAT_FONT;
  wrapText(d.note, W / 2, y + 98, w - 90, 16);
  const optionY = y + 130;
  const optionGap = options.length === 3 ? 72 : 82;
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const b = { x:x + 50, y:optionY + i * optionGap, w:w - 100, h:58, choice:i };
    eventChoiceBtns.push(b);
    ctx.fillStyle = !option.enabled ? 'rgba(255,90,90,0.08)' : i === 0 ? 'rgba(176,90,224,0.22)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = !option.enabled ? '#8a4a55' : i === 0 ? d.color : '#4a4d66'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = option.enabled ? '#fff' : '#aa7a82'; ctx.font = 'bold 14px ' + STAT_FONT;
    ctx.fillText('[' + (i + 1) + '] ' + option.label + (option.enabled ? '' : '（條件不足）'), W / 2, b.y + 22);
    ctx.fillStyle = option.enabled ? '#aeb4d0' : '#936b73'; ctx.font = '11px ' + STAT_FONT;
    ctx.fillText(option.detail, W / 2, b.y + 43);
  }
  ctx.fillStyle = '#737a9a'; ctx.font = '11px ' + STAT_FONT; ctx.fillText('按 1～' + options.length + ' 選擇　·　Esc 關閉', W / 2, y + h - 18);
  ctx.textAlign = 'left';
}
function render() {
  const p = player;
  camX += ((Math.max(0, Math.min(worldW - W, p.x - W / 2))) - camX) * 0.12;

  const bi = biomeOf(floor);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bi.sky[0]); g.addColorStop(0.7, bi.sky[1]); g.addColorStop(1, bi.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = bi.cloud;
  for (const c of clouds) {
    const cx = ((c.x - camX * 0.3) % (worldW * 0.5) + worldW * 0.5) % (worldW * 0.5) - 100;
    ctx.fillRect(cx, c.y, c.w, 14);
    ctx.fillRect(cx + 10, c.y - 8, c.w - 24, 10);
  }
  ctx.fillStyle = bi.hill;
  for (let i = 0; i < 8; i++) {
    const hx = i * 400 - (camX * 0.5) % 400 - 200;
    ctx.beginPath(); ctx.arc(hx + 200, 520, 150, Math.PI, 0); ctx.fill();
  }
  // depth tint(群系內每層漸深,換群系重置)
  const tint = 0.05 * ((floor - 1) % 5);
  if (tint > 0) { ctx.fillStyle = 'rgba(10,6,20,' + tint.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }

  ctx.save();
  ctx.translate(-Math.round(camX), 0);
  const [shakeX, shakeY] = currentShakeOffset();
  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));

  // platforms(群系配色)
  for (const q of plats) {
    if (q.voidDisabled) continue;
    const hgt = q.ground ? H - q.y : 14;
    ctx.fillStyle = bi.ground; ctx.fillRect(q.x, q.y, q.w, hgt);
    ctx.fillStyle = bi.grass; ctx.fillRect(q.x, q.y, q.w, 6);
    ctx.fillStyle = bi.dot;
    for (let x = q.x; x < q.x + q.w; x += 18) ctx.fillRect(x + 6, q.y + 4, 6, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(q.x, q.y + 6, q.w, 3);
  }
  drawDungeonHazards();
  drawDungeonBossEffects();
  drawDungeonRoomWorld();
  drawFloorEventWorld();
  // Lv3/Lv5 技能區域特效（燃燒地面、餘震、龍捲與二次衝擊）
  for (const z of skillZones) {
    const waiting = z.delay > 0, life = z.maxT > 1 ? Math.max(0.18, z.t / z.maxT) : 1;
    ctx.globalAlpha = waiting ? 0.16 + Math.sin(frame * 0.18) * 0.06 : 0.18 + life * 0.18;
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(8, z.rx), Math.max(5, z.ry * 0.32), 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = waiting ? 0.45 : 0.65;
    ctx.strokeStyle = z.color; ctx.lineWidth = z.kind === 'burn' || z.kind === 'sunfire' ? 2 : 3;
    ctx.beginPath(); ctx.ellipse(z.x, z.y, Math.max(8, z.rx * (0.88 + Math.sin(frame * 0.1) * 0.06)), Math.max(5, z.ry * 0.28), 0, 0, Math.PI * 2); ctx.stroke();
    if (!waiting && (z.kind === 'burn' || z.kind === 'sunfire')) {
      for (let i = 0; i < 4; i++) {
        const fx = z.x + Math.sin(frame * 0.11 + i * 2.1) * z.rx * 0.7;
        const fh = 8 + (i * 7 + frame) % 15;
        ctx.globalAlpha = 0.5; ctx.fillRect(fx - 2, z.y - fh, 4, fh);
      }
    }
    ctx.globalAlpha = 1;
  }
  drawSkillAnimations('back');
  // portal
  if (portal) {
    const ph = 64, pw = 40;
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (Math.floor(frame / 8) + i) % 2 === 0 ? '#b05ae0' : '#7dffd6';
      ctx.fillRect(portal.x - pw / 2 + i * 4, portal.y - ph + i * 6, pw - i * 8, ph - i * 10);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px "Courier New",monospace'; ctx.textAlign = 'center';
    ctx.fillText(portal.kind === 'chapter' ? '章節結算' : (floor + 1) % 5 === 0 ? '挑戰 BOSS' : '選擇路線', portal.x, portal.y - ph - 8);
  }
  // gear drops：依稀有度發光（地面光暈 + 漸層光柱 + 傳奇星火）
  for (const gd of gearDrops) {
    const blink = gd.t < 150 && Math.floor(gd.t / 8) % 2 === 0;
    if (blink) continue;
    const it = gd.it, col = gearColor(it);
    const tier = it.unique ? 5 : it.r; // 傳奇當作比傳說更高一階的發光
    const lowFx = typeof combatSettings !== 'undefined' && !combatSettings.flashes; // 低特效：省略漸層/星火
    const pulse = 0.5 + 0.5 * Math.sin(frame * 0.12);
    if (tier >= 2 && !lowFx) {
      // 地面徑向光暈
      const gr = 12 + tier * 5 + pulse * 4;
      const halo = ctx.createRadialGradient(gd.x, gd.y - 2, 2, gd.x, gd.y - 2, gr);
      halo.addColorStop(0, withAlpha(col, 0.34)); halo.addColorStop(1, withAlpha(col, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(gd.x, gd.y - 2, gr, gr * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      // 漸層光柱（底亮頂淡）
      const bh = 66 + tier * 14, bw = 4 + tier * 2;
      const beam = ctx.createLinearGradient(0, gd.y - bh, 0, gd.y);
      beam.addColorStop(0, withAlpha(col, 0)); beam.addColorStop(1, withAlpha(col, (0.10 + 0.05 * tier) * (0.7 + 0.3 * pulse)));
      ctx.fillStyle = beam; ctx.fillRect(gd.x - bw / 2, gd.y - bh, bw, bh);
    } else {
      ctx.fillStyle = col; ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.ellipse(gd.x, gd.y - 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    const bob = Math.sin(frame * 0.15) * 2;
    const iy = gd.y - 26 + bob, sz = 20;
    drawItemIcon(it, gd.x - sz / 2, iy, sz);
    if (tier >= 4 && !lowFx) { // 傳說／傳奇：星火閃爍
      ctx.fillStyle = col;
      const sp = [[-10, -12], [12, -6], [4, -22], [-9, 2]];
      for (let i = 0; i < sp.length; i++) { const tw = Math.sin(frame * 0.2 + i * 1.7); if (tw > 0.3) { ctx.globalAlpha = tw; ctx.fillRect(gd.x + sp[i][0], iy + sp[i][1], 2, 2); } }
      ctx.globalAlpha = 1;
    }
  }
  // potion drops
  for (const d of drops) {
    const blink = d.t < 120 && Math.floor(d.t / 8) % 2 === 0;
    if (!blink) {
      ctx.fillStyle = d.type === 'hp' ? '#e23b3b' : '#3b6fe2';
      ctx.fillRect(d.x - 4, d.y - 12, 8, 10);
      ctx.fillStyle = '#ddd'; ctx.fillRect(d.x - 2, d.y - 15, 4, 3);
    }
  }
  // soul orbs
  for (const o of orbs) {
    ctx.fillStyle = Math.floor(frame / 6) % 2 === 0 ? '#7dffd6' : '#b7fff0';
    ctx.fillRect(o.x - 3, o.y - 3, 6, 6);
    ctx.fillRect(o.x - 1, o.y - 5, 2, 10);
  }
  // Boss 跳撲與落地範圍：形狀與實際判定共用同一半徑。
  for (const m of mons) {
    if (m.type !== 'boss' || (m.tele <= 0 && !m.slamWarn)) continue;
    const telegraph = dungeonBossTelegraph(m);
    const radius = telegraph.radius;
    const urgent = m.tele > 0 && m.tele <= 12;
    const pulse = urgent ? 0.58 + Math.sin(frame * 0.9) * 0.18 : 0.3 + Math.sin(frame * 0.22) * 0.08;
    const tx = telegraph.targetX;
    ctx.globalAlpha = Math.max(0.16, pulse);
    ctx.fillStyle = telegraph.color;
    ctx.beginPath(); ctx.ellipse(tx, 465, radius, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = urgent ? 1 : 0.76;
    ctx.strokeStyle = urgent ? '#fff2a8' : telegraph.accent; ctx.lineWidth = urgent ? 4 : 3;
    ctx.setLineDash(urgent ? [] : [9, 7]);
    ctx.beginPath(); ctx.ellipse(tx, 465, radius, 15, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff2a8'; ctx.font = 'bold 11px ' + STAT_FONT; ctx.textAlign = 'center';
    ctx.fillText(telegraph.label, tx, 442);
    ctx.textAlign = 'left'; ctx.globalAlpha = 1;
  }
  // monsters
  for (const m of mons) {
    if (m.mimic) {
      const mx = m.x, my = m.y, bite = 4 + Math.abs(Math.sin(frame * 0.18)) * 5;
      ctx.fillStyle = m.hitT > 0 ? '#fff' : '#6b3f20'; ctx.fillRect(mx - 27, my - 28, 54, 28);
      ctx.fillStyle = m.hitT > 0 ? '#fff' : '#b96b2f'; ctx.fillRect(mx - 29, my - 43 - bite, 58, 16);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(mx - 5, my - 25, 10, 14); ctx.fillRect(mx - 22, my - 39 - bite, 44, 3);
      ctx.fillStyle = '#f5ede0';
      for (let tx = -20; tx <= 16; tx += 9) { ctx.fillRect(mx + tx, my - 29 - bite, 5, 6); ctx.fillRect(mx + tx + 4, my - 34, 5, 6); }
      ctx.fillStyle = '#ff5a5a'; ctx.fillRect(mx - 16, my - 38 - bite, 5, 5); ctx.fillRect(mx + 11, my - 38 - bite, 5, 5);
    } else if (m.type === 'boss' && drawDungeonBossSprite(m)) {
      drawDungeonBossSpecialTelegraph(m);
    } else {
      const rows = MON_SPRITE[m.type] || (m.elite ? ESLIME : SLIME);
      const bossStyle = m.type === 'boss' ? dungeonBossDef(m.bossId) : null;
      const rc = bossStyle ? { e:bossStyle.color, f:bossStyle.accent } : null;
      drawSprite(rows, m.x - rows[0].length * m.s / 2, m.y - rows.length * m.s, m.s, m.vx < 0, m.hitT > 0, rc);
    }
    if (m.type === 'boss' && m.tele > 0 && Math.floor(m.tele / 5) % 2 === 0) {
      ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 26px "Courier New",monospace'; ctx.textAlign = 'center';
      ctx.fillText('!', m.x, m.y - m.h - 18);
      ctx.textAlign = 'left';
    }
    if (m.hp < m.mhp && m.type !== 'boss') {
      const bw = m.elite ? 44 : 34;
      ctx.fillStyle = '#222'; ctx.fillRect(m.x - bw / 2, m.y - m.h - 12, bw, 5);
      ctx.fillStyle = m.elite ? '#b05ae0' : '#e23b3b';
      ctx.fillRect(m.x - bw / 2 + 1, m.y - m.h - 11, (bw - 2) * Math.max(0, m.hp / m.mhp), 3);
    }
  }
  // boss/孢子 彈幕(群系色)
  for (const s of espits) {
    if (s.seed) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(Math.atan2(s.vy, s.vx) + Math.PI / 2);
      ctx.fillStyle = s.col || '#9bdd4f'; ctx.fillRect(-4, -7, 8, 14);
      ctx.fillStyle = '#d8ef7b'; ctx.fillRect(-2, -5, 4, 8);
      ctx.fillStyle = '#6b4b2a'; ctx.fillRect(-1, -10, 2, 4); ctx.restore();
    } else if (s.voidBolt) {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(frame * 0.16);
      ctx.fillStyle = s.col || '#b05ae0'; ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#d9a8ff'; ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = '#fff'; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
    } else {
      ctx.fillStyle = s.col || '#8a5adf'; ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
  }
  // player
  drawEquippedAura(p.x, p.y - p.h / 2, p.w, p.h);
  if (p.dashT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.12 + p.dashT / DASH_DURATION * 0.18;
    drawSprite(baseClassOf(p.cls) === 'mage' ? MAGE : WAR, p.x - 18 - p.dashDir * 18, p.y - 48, 3, p.face < 0);
    ctx.restore();
  }
  if (p.inv === 0 || Math.floor(p.inv / 5) % 2 === 0) {
    const s = 3;
    const bob = (p.onGround && p.walk > 0) ? (Math.floor(p.walk / 6) % 2) : 0;
    drawSprite(baseClassOf(p.cls) === 'mage' ? MAGE : WAR, p.x - 18, p.y - 48 + bob, s, p.face < 0, playerFlashT > 0);
    const sx = p.x + p.face * 14;
    if (baseClassOf(p.cls) === 'mage') {
      const orb = p.eq.weapon ? gearColor(p.eq.weapon) : '#f2c14e';
      ctx.fillStyle = PAL['a'];
      if (p.cast > 0) {
        ctx.fillRect(sx - 2, p.y - 58, 4, 30);
        ctx.fillStyle = orb; ctx.fillRect(sx - 4, p.y - 64, 8, 8);
        ctx.fillStyle = 'rgba(255,210,62,0.5)'; ctx.fillRect(sx - 7, p.y - 67, 14, 14);
      } else {
        ctx.fillRect(sx - 2, p.y - 40, 4, 26);
        ctx.fillStyle = orb; ctx.fillRect(sx - 4, p.y - 46, 8, 8);
      }
    } else {
      const blade = p.eq.weapon ? gearColor(p.eq.weapon) : '#b89a6a';
      if (p.cast > 0) {
        ctx.fillStyle = blade;
        ctx.fillRect(p.face > 0 ? p.x + 12 : p.x - 40, p.y - 32, 28, 5);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(p.face > 0 ? p.x + 7 : p.x - 11, p.y - 35, 4, 11);
      } else {
        ctx.fillStyle = blade;
        ctx.fillRect(sx - 2, p.y - 36, 4, 20);
        ctx.fillStyle = '#f2c14e';
        ctx.fillRect(sx - 5, p.y - 17, 10, 4);
      }
    }
    if (p.slashT > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.15 + p.slashT / 10 * 0.6).toFixed(2) + ')';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const a0 = p.face > 0 ? -1.1 : Math.PI - 1.1;
      ctx.arc(p.x, p.y - 26, 52, a0, a0 + 2.2);
      ctx.stroke();
    }
    if (p.spinT > 0) {
      const rr = 40 + (14 - p.spinT) * 4;
      ctx.strokeStyle = 'rgba(255,255,255,' + (p.spinT / 14 * 0.7).toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 26, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // projectiles
  for (const pr of projs) {
    if (pr.kind === 'ice') {
      ctx.fillStyle = '#7dcfff'; ctx.fillRect(pr.x - 8, pr.y - 4, 16, 8);
      ctx.fillStyle = '#d8f4ff'; ctx.fillRect(pr.x - 3, pr.y - 2, 6, 4);
    } else {
      const fireAngle = Math.atan2(pr.vy || 0, Math.abs(pr.vx));
      if (!drawSkillVfxFrame('fireball', pr.x, pr.y, Math.floor(frame / 4), 1.05, pr.vx < 0, fireAngle, 1)) {
        drawSprite(FIRE, pr.x - 9, pr.y - 9, 3, pr.vx < 0);
        ctx.fillStyle = 'rgba(255,140,46,0.35)'; ctx.fillRect(pr.x - pr.vx * 2 - 6, pr.y - 6, 12, 12);
      }
    }
  }
  // 隕石
  for (const mt of meteors) {
    if (!drawSkillVfxFrame('fireballDiag', mt.x, mt.y, Math.floor(frame / 4), Math.max(1, mt.r / 48), false, Math.PI / 2, 1)) {
      ctx.fillStyle = '#ff8c2e'; ctx.fillRect(mt.x - 7, mt.y - 14, 14, 18);
      ctx.fillStyle = '#ffe680'; ctx.fillRect(mt.x - 3, mt.y - 8, 6, 8);
    }
  }
  // 魔法盾泡泡
  if (player.shieldHp > 0) {
    drawSkillVfxFrame('rune', player.x, player.y - player.h / 2, Math.floor(frame / 5), 1.25, false, 0, 0.7);
    ctx.strokeStyle = 'rgba(125,207,255,0.7)'; ctx.lineWidth = 2;
    ctx.strokeRect(player.x - 22, player.y - player.h - 8, 44, player.h + 12);
  }
  // bolts
  for (const b of bolts) {
    ctx.strokeStyle = b.t % 4 < 2 ? '#fff' : '#ffe680';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (b.chain) {
      ctx.moveTo(b.x0, b.y0);
      for (let i = 1; i <= 5; i++) ctx.lineTo(b.x0 + (b.x - b.x0) * i / 5 + (i < 5 ? (i % 2 ? 7 : -7) : 0), b.y0 + (b.y - b.y0) * i / 5);
    } else {
      let by = -10;
      ctx.moveTo(b.x + 6, by);
      while (by < b.y) { by += 40; ctx.lineTo(b.x + (by % 80 < 40 ? -8 : 8), Math.min(by, b.y)); }
    }
    ctx.stroke();
  }
  drawSkillAnimations('front');
  for (const q of parts) { ctx.fillStyle = q.color; ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
  ctx.restore(); // shake world only; damage numbers remain readable
  ctx.textAlign = 'center';
  for (const d of dmgNums) {
    ctx.globalAlpha = Math.min(1, d.t / 25);
    const age = (d.maxT || 60) - d.t;
    const pop = d.pop && age < 8 ? Math.sin(age / 8 * Math.PI) * d.pop : 0;
    ctx.font = 'bold ' + Math.round((d.size || 16) + pop) + 'px "Courier New",monospace';
    ctx.fillStyle = '#222'; ctx.fillText(d.text, d.x + 1, d.y + 1);
    ctx.fillStyle = d.color; ctx.fillText(d.text, d.x, d.y);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if (hurtVignetteT > 0) {
    const strength = (hurtVignetteT / 10) * (combatSettings.flashes ? 0.34 : 0.14);
    const vg = ctx.createLinearGradient(hurtFromDir < 0 ? 0 : W, 0, hurtFromDir < 0 ? W : 0, 0);
    vg.addColorStop(0, 'rgba(255,35,45,' + strength.toFixed(3) + ')');
    vg.addColorStop(0.48, 'rgba(160,0,20,' + (strength * 0.18).toFixed(3) + ')');
    vg.addColorStop(1, 'rgba(80,0,10,0)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  // ---------- HUD ----------
  ctx.textAlign = 'left';
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillStyle = 'rgba(20,22,43,0.7)';
  ctx.fillRect(0, 0, 330, 30);
  ctx.fillStyle = '#b05ae0';
  ctx.fillText('第 ' + floor + ' 層 ' + biomeOf(floor).name, 12, 20);
  ctx.fillStyle = '#c8cdec';
  ctx.fillText(portal ? '前往傳送門 →' : '殘存 ' + mons.length, 244, 20);
  drawDungeonHud();
  drawDungeonTrialHud();
  drawDungeonHazardTutorial();
  const bossM = mons.find(m => m.type === 'boss');
  if (bossM) {
    const bossDef = dungeonBossDef(bossM.bossId);
    bar(W / 2 - 180, 38, 360, 16, bossM.hp / bossM.mhp, bossDef.color, bossDef.name + '  ' + Math.ceil(Math.max(0, bossM.hp)) + ' / ' + bossM.mhp + '  第' + bossM.phase + '階段');
    ctx.textAlign = 'left';
  }

  ctx.fillStyle = 'rgba(20,22,43,0.92)';
  ctx.fillRect(0, H - 46, W, 46);
  ctx.fillStyle = '#f4c542';
  ctx.font = 'bold 15px "Courier New",monospace';
  ctx.fillText('Lv.' + p.lv + ' ' + CLASSES[p.cls].name, 14, H - 26);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('靈魂 +' + soulsRun, 14, H - 8);
  if (p.eventAtk > 0) { ctx.fillStyle = '#d9a8ff'; ctx.font = 'bold 11px "Courier New",monospace'; ctx.fillText('血祝+' + Math.round(p.eventAtk * 100) + '%', 92, H - 8); }
  bar(170, H - 36, 200, 12, p.hp / p.mhp, '#e23b3b', 'HP ' + Math.ceil(p.hp) + '/' + p.mhp);
  bar(170, H - 20, 200, 12, p.mp / p.mmp, '#3b6fe2', 'MP ' + Math.ceil(p.mp) + '/' + p.mmp);
  // 經驗條只使用快捷列左側空間，避免與衝刺冷卻框重疊。
  bar(400, H - 28, 200, 12, p.xp / xpNeed(p.lv), '#d8c93a', 'EXP ' + (100 * p.xp / xpNeed(p.lv)).toFixed(0) + '%');
  ctx.textAlign = 'left';
  ctx.font = '12px "Courier New",monospace';
  ctx.fillStyle = p.bag.hp > 0 ? '#ff8a8a' : '#666';
  ctx.fillText('[A]紅水x' + p.bag.hp, 400, H - 4);
  ctx.fillStyle = p.bag.mp > 0 ? '#8aa8ff' : '#666';
  ctx.fillText('[S]藍水x' + p.bag.mp, 500, H - 4);
  if (p.shieldHp > 0) { ctx.fillStyle = '#7dcfff'; ctx.fillRect(170, H - 40, 200 * Math.min(1, p.shieldHp / p.mhp), 3); }
  if (p.rageT > 0) { ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 12px "Courier New",monospace'; ctx.fillText('狂暴' + Math.ceil(p.rageT / 60), 110, H - 8); }
  const dashX = 612, dashY = H - 43;
  ctx.fillStyle = 'rgba(8,7,9,0.94)'; ctx.fillRect(dashX, dashY, 55, 38);
  ctx.strokeStyle = p.dashCd <= 0 ? '#8ec9df' : '#3d5260'; ctx.lineWidth = 1; ctx.strokeRect(dashX, dashY, 55, 38);
  if (dashPulseT > 0) {
    ctx.globalAlpha = 0.25 + 0.35 * dashPulseT / 6;
    ctx.fillStyle = '#8ec9df'; ctx.fillRect(dashX + 1, dashY + 1, 53, 36);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = p.dashCd <= 0 ? '#bdefff' : '#617b89'; ctx.font = 'bold 16px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText('≫', dashX + 20, dashY + 24);
  ctx.fillStyle = '#fff1d0'; ctx.font = 'bold 8px ' + STAT_FONT; ctx.fillText('SHIFT', dashX + 39, dashY + 12);
  if (p.dashCd > 0) {
    ctx.fillStyle = 'rgba(5,5,7,0.68)'; ctx.fillRect(dashX + 2, dashY + 2, 34, 34);
    ctx.fillStyle = '#ddd6ca'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText((p.dashCd / 60).toFixed(1), dashX + 19, dashY + 23);
  }
  const loH = loadouts[p.cls], keyN = ['Z', 'X', 'C'];
  for (let i = 0; i < 3; i++) {
    const sid = loH[i], sx = 672 + i * 57, sy = H - 43;
    ctx.fillStyle = 'rgba(8,7,9,0.94)'; ctx.fillRect(sx, sy, 52, 38);
    ctx.strokeStyle = sid ? '#80633d' : '#3d3935'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 52, 38);
    if (skillPulseT[i] > 0) {
      ctx.globalAlpha = 0.25 + 0.35 * skillPulseT[i] / 12;
      ctx.fillStyle = p.mp < (sid ? SKILL_DEFS[sid].mp : 0) ? '#4f74ff' : '#ffe680'; ctx.fillRect(sx + 1, sy + 1, 50, 36);
      ctx.globalAlpha = 1;
    }
    if (sid) drawSkillSigil(sid, sx + 19, sy + 19, 15, p.slotCd[i] <= 0, false);
    ctx.fillStyle = '#8c2f25'; ctx.fillRect(sx + 36, sy + 3, 13, 13);
    ctx.fillStyle = '#fff1d0'; ctx.font = 'bold 9px ' + STAT_FONT; ctx.textAlign = 'center'; ctx.fillText(keyN[i], sx + 42.5, sy + 13);
    if (sid && p.slotCd[i] > 0) {
      ctx.fillStyle = 'rgba(5,5,7,0.68)'; ctx.fillRect(sx + 2, sy + 2, 33, 34);
      ctx.fillStyle = '#ddd6ca'; ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillText((p.slotCd[i] / 60).toFixed(1), sx + 19, sy + 23);
    }
  }
  ctx.textAlign = 'left';
  ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillStyle = '#c8cdec';
  ctx.fillText('[I]裝備', 845, H - 8);
  statsBtn = { x: 894, y: H - 30, w: 66, h: 30 };
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('[P]能力', 900, H - 8);

  if (floorT > 0) {
    ctx.globalAlpha = Math.min(1, floorT / 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px "Courier New",monospace';
    ctx.textAlign = 'center';
    ctx.fillText('第 ' + floor + ' 層' + (floor % 5 === 0 ? '  ⚠ BOSS' : ''), W / 2, 180);
    ctx.font = 'bold 22px "Courier New",monospace';
    ctx.fillStyle = '#ffe680';
    ctx.fillText('— ' + biomeOf(floor).name + (floorEvent && currentFloorEventDef() ? ' · ' + currentFloorEventDef().name : '') + ' —', W / 2, 214);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  if (p.itemWin) drawItemWin();
  drawFleeChannel();
  drawTouchUI();
  drawEventPanel();
  drawDungeonPanels();
}
function drawFleeChannel() {
  if (gameState !== 'play' || typeof fleeChannelActive !== 'function' || !fleeChannelActive()) return;
  const prog = fleeChannelProgress();
  const w = 300, h = 30, x = W / 2 - w / 2, y = 150;
  ctx.fillStyle = 'rgba(20,22,43,0.9)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(226,107,107,0.55)'; ctx.fillRect(x + 2, y + 2, (w - 4) * prog, h - 4);
  ctx.strokeStyle = '#e26b6b'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe0e0'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText('逃走中… ' + Math.round(prog * 100) + '%（受擊中斷）', W / 2, y + 20);
  ctx.textAlign = 'left';
}
function bar(x, y, w, h, ratio, color, label) {
  ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, ratio)), h - 2);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px "Courier New",monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h - 2);
}

// ---------- paper doll ----------
function drawGlyph(kind, gx, gy, col) {
  ctx.fillStyle = col;
  if (kind === 'weapon') {
    if (baseClassOf(player.cls) === 'mage') {
      ctx.fillStyle = '#a05a2c'; ctx.fillRect(gx - 1, gy - 6, 3, 16);
      ctx.fillStyle = col; ctx.fillRect(gx - 4, gy - 12, 8, 8);
    } else {
      ctx.fillRect(gx - 2, gy - 12, 4, 18);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(gx - 6, gy + 6, 12, 3);
    }
  } else if (kind === 'armor') {
    ctx.fillRect(gx - 8, gy - 7, 16, 15);
    ctx.fillRect(gx - 12, gy - 7, 4, 7);
    ctx.fillRect(gx + 8, gy - 7, 4, 7);
  } else if (kind === 'helmet') {
    ctx.fillRect(gx - 8, gy - 2, 16, 8);
    ctx.fillRect(gx - 5, gy - 7, 10, 5);
  } else if (kind === 'boots') {
    ctx.fillRect(gx - 10, gy - 6, 5, 10);
    ctx.fillRect(gx - 10, gy + 2, 8, 4);
    ctx.fillRect(gx + 3, gy - 6, 5, 10);
    ctx.fillRect(gx + 3, gy + 2, 8, 4);
  } else if (kind === 'acc') {
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gx, gy + 2, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillRect(gx - 2, gy - 9, 4, 4);
  }
}
function withAlpha(hex, a) { // #rrggbb → rgba，供稀有度底色暈染
  const h = (hex || '#ffffff').replace('#', '');
  const s = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(s, 16) || 0;
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function slotBox(sx, sy, slot, label) {
  const it = player.eq[slot];
  const col = it ? gearColor(it) : '#3a3450';
  fillRoundRect(sx, sy, 44, 44, 6, it && it.r >= 2 ? withAlpha(col, 0.12) : 'rgba(255,255,255,0.05)', null, 0);
  if (it && (it.unique || it.r >= 3)) { ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 9; fillRoundRect(sx, sy, 44, 44, 6, null, col, 2); ctx.restore(); }
  else fillRoundRect(sx, sy, 44, 44, 6, null, col, 2);
  ctx.textAlign = 'center';
  if (it) {
    drawItemIcon(it, sx + 6, sy + 6, 32);
    ctx.font = '10px "Courier New",monospace'; ctx.fillStyle = col;
    ctx.fillText(gearLabel(it), sx + 22, sy + 56);
  } else {
    ctx.font = '11px ' + STAT_FONT; ctx.fillStyle = 'rgba(120,126,160,0.5)';
    ctx.fillText(label, sx + 22, sy + 27); // 空欄:部位提示置中
  }
  ctx.textAlign = 'left';
}
function drawItemWin() {
  const p = player;
  itemBtns.length = 0;
  const x = W / 2 - 230, y = 40, w = 460, h = 440;
  // 圓角主面板 + 外陰影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 7;
  fillRoundRect(x, y, w, h, 12, '#16131f', null, 0);
  ctx.restore();
  fillRoundRect(x, y, w, h, 12, null, '#8a6d3b', 2);
  // 標題列漸層 + 分隔線
  const hg = ctx.createLinearGradient(x, y, x, y + 38);
  hg.addColorStop(0, 'rgba(138,109,59,0.28)'); hg.addColorStop(1, 'rgba(138,109,59,0)');
  roundRectPath(x + 1, y + 1, w - 2, 38, 11); ctx.fillStyle = hg; ctx.fill();
  ctx.strokeStyle = 'rgba(138,109,59,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 12, y + 32); ctx.lineTo(x + w - 12, y + 32); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0d9a8'; ctx.font = 'bold 16px "Courier New",monospace';
  ctx.fillText('⚔ 裝 備', x + 14, y + 22);
  ctx.fillStyle = '#8890b8'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('[I] 關閉', x + w - 70, y + 22);
  const dx = x + 12, dy = y + 36, dw = 206, dh = 320;
  // 紙娃娃圓角框 + 角色背後光暈
  fillRoundRect(dx, dy, dw, dh, 8, 'rgba(0,0,0,0.42)', '#3a3450', 1);
  const cx = dx + dw / 2, gcy = dy + 150;
  const glow = ctx.createRadialGradient(cx, gcy, 6, cx, gcy, 84);
  glow.addColorStop(0, 'rgba(216,179,101,0.15)'); glow.addColorStop(1, 'rgba(216,179,101,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, gcy, 84, 0, Math.PI * 2); ctx.fill();
  drawSprite(baseClassOf(p.cls) === 'mage' ? MAGE : WAR, cx - 30, dy + 115, 5, false);
  let tipItem = null; // hover tooltip 目標
  const slotDefs = [[cx - 22, dy + 10, 'helmet', '頭盔'], [dx + 12, dy + 100, 'weapon', '武器'], [dx + dw - 56, dy + 100, 'armor', '防具'], [dx + dw - 56, dy + 10, 'acc', '飾品'], [cx - 22, dy + dh - 76, 'boots', '鞋子']];
  for (const s of slotDefs) {
    slotBox(s[0], s[1], s[2], s[3]);
    if (p.eq[s[2]] && hoverGX >= s[0] && hoverGX <= s[0] + 44 && hoverGY >= s[1] && hoverGY <= s[1] + 44) tipItem = p.eq[s[2]];
  }
  // 屬性子面板
  fillRoundRect(dx, dy + dh + 6, dw, y + h - (dy + dh + 6) - 10, 6, 'rgba(255,255,255,0.035)', '#2e3350', 1);
  ctx.textAlign = 'left';
  ctx.font = '11px "Courier New",monospace';
  ctx.fillStyle = '#9ecbff';
  ctx.fillText('攻擊 ' + Math.round(atkPow()) + '  爆擊 ' + (critRate() * 100).toFixed(1) + '%', dx + 8, dy + dh + 20);
  ctx.fillText('減傷 ' + armorDef() + '  移速 ' + moveSpd().toFixed(1) + '  HP ' + p.mhp, dx + 8, dy + dh + 34);
  const activeSets = Object.entries(equippedSetCounts(p.eq)).filter(([, count]) => count >= 2);
  let extraY = dy + dh + 50;
  if (activeSets.length) {
    ctx.font = 'bold 10px ' + STAT_FONT;
    for (let i = 0; i < Math.min(2, activeSets.length); i++) {
      const [setId, count] = activeSets[i], set = GEAR_SET_BY_ID[setId];
      ctx.fillStyle = set.color; ctx.fillText('⬟ ' + set.name + ' ' + count + '/4　套裝效果已啟動', dx + 8, extraY + i * 14);
    }
    extraY += Math.min(2, activeSets.length) * 14;
  }
  // 已裝備的傳奇裝能力全文（背包列太窄，改在這裡逐件顯示）
  if (typeof uniqueDef === 'function') {
    ctx.font = 'bold 10px ' + STAT_FONT; ctx.fillStyle = UNIQUE_COLOR;
    for (const slot of GEAR_PARTS) {
      const it = p.eq[slot];
      if (!it || !it.unique) continue;
      const u = uniqueDef(it.unique);
      if (u && u.powerText) { ctx.fillText('◈ ' + u.name + '：' + u.powerText, dx + 8, extraY); extraY += 12; }
    }
  }
  const bx = x + 232, by = y + 36, bw = w - 244;
  ctx.fillStyle = p.items.length >= 10 ? '#ffb45e' : '#d8b365'; ctx.font = 'bold 13px "Courier New",monospace';
  ctx.fillText('背包 ' + p.items.length + '/12', bx, by + 12);
  ctx.fillStyle = '#6b7290'; ctx.font = '9px "Courier New",monospace';
  ctx.fillText('點擊換裝 · ✕分解+2魂', bx + 90, by + 12);
  if (p.items.length === 0) {
    ctx.fillStyle = '#667'; ctx.font = '12px "Courier New",monospace';
    ctx.fillText('(空的,打怪撿裝備吧)', bx + 4, by + 42);
  }
  if (pendingDel && (frame - pendingDel.f > 120 || p.items.indexOf(pendingDel.it) < 0)) pendingDel = null;
  delBtns.length = 0;
  for (let i = 0; i < p.items.length; i++) {
    const it = p.items[i];
    const ry = by + 36 + i * 26;
    const eqd = p.eq[it.kind] === it;
    const pend = pendingDel && pendingDel.it === it;
    const rcol = gearColor(it);
    let rbg = 'rgba(255,255,255,0.04)';
    if (it.unique) rbg = withAlpha(rcol, 0.16);
    else if (it.r >= 2) rbg = withAlpha(rcol, 0.10);
    fillRoundRect(bx - 4, ry - 13, bw, 23, 4, pend ? 'rgba(226,59,59,0.25)' : eqd ? 'rgba(216,179,101,0.16)' : rbg, null, 0);
    ctx.fillStyle = rcol; fillRoundRect(bx - 4, ry - 13, 3, 23, 1.5, rcol, null, 0); // 稀有度／傳奇色條
    if (hoverGX >= bx - 4 && hoverGX <= bx - 4 + bw && hoverGY >= ry - 13 && hoverGY <= ry + 10) tipItem = it;
    if (!eqd) {
      itemBtns.push({ x: bx - 4, y: ry - 13, w: bw - 44, h: 24, it: it });
      delBtns.push({ x: bx + bw - 46, y: ry - 13, w: 42, h: 24, it: it });
    }
    drawItemIcon(it, bx, ry - 11, 20);
    ctx.font = 'bold 12px "Courier New",monospace';
    ctx.fillStyle = gearColor(it); ctx.textAlign = 'left';
    ctx.fillText(gearLabel(it), bx + 24, ry + 3);
    ctx.font = '10px "Courier New",monospace';
    ctx.fillStyle = '#8890b8';
    ctx.fillText(gearDesc(it), bx + 128, ry + 3);
    if (eqd) {
      ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 11px "Courier New",monospace';
      ctx.fillText('E', bx + bw - 16, ry + 3);
    } else {
      ctx.font = 'bold 11px "Courier New",monospace';
      ctx.fillStyle = pend ? '#ff5a5a' : '#8890b8';
      ctx.textAlign = 'center';
      ctx.fillText(pend ? '確認?' : '✕', bx + bw - 25, ry + 3);
      ctx.textAlign = 'left';
    }
  }
  const py = y + h - 40;
  ctx.fillStyle = '#e23b3b'; ctx.fillRect(bx, py + 2, 8, 10);
  ctx.fillStyle = '#fff'; ctx.font = '12px "Courier New",monospace';
  ctx.fillText('x' + p.bag.hp + '[A]', bx + 12, py + 11);
  ctx.fillStyle = '#3b6fe2'; ctx.fillRect(bx + 70, py + 2, 8, 10);
  ctx.fillStyle = '#fff';
  ctx.fillText('x' + p.bag.mp + '[S]', bx + 82, py + 11);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText('靈魂 +' + soulsRun, bx + 140, py + 11);
  if (tipItem) drawItemTooltip(tipItem, hoverGX, hoverGY, p.eq[tipItem.kind]); // 詳細 tooltip
}
// 裝備詳細 tooltip：稀有度/數值/詞綴/傳奇能力/套裝/與已裝備比較
function drawItemTooltip(it, mx, my, equipped) {
  const col = gearColor(it);
  const tierName = it.unique ? '傳奇' : (typeof RARITY_NAME !== 'undefined' ? RARITY_NAME[it.r] || '' : '');
  const lines = [];
  lines.push({ t: gearDesc(it), c: '#dfe3f5' });
  if ((it.enh || 0) > 0) lines.push({ t: '強化 +' + it.enh + '（數值已含）', c: '#9ecbff' });
  for (const a of (it.affixes || [])) { if (!a) continue; const txt = (typeof affixText === 'function') ? affixText(a) : ''; if (txt && txt !== '空槽') lines.push({ t: '✦ ' + txt, c: '#c9a6ff' }); }
  if (it.unique && typeof uniqueDef === 'function') {
    const u = uniqueDef(it.unique);
    if (u && u.powerText) lines.push({ t: '◈ ' + u.powerText, c: UNIQUE_COLOR });
    if (u && u.biome && u.biome !== '通用') lines.push({ t: '出處：' + u.biome, c: '#8890b8' });
  }
  const set = it.setId && GEAR_SET_BY_ID[it.setId];
  if (set) { lines.push({ t: '【' + set.name + '】套裝', c: set.color }); for (const b of set.bonuses) lines.push({ t: '　' + b.pieces + '件 ' + b.text, c: withAlpha(set.color, 0.85) }); }
  if (it.cls && it.cls !== 'any') lines.push({ t: '限' + (it.cls === 'mage' ? '法師' : '劍士') + '使用', c: '#ff9a8a' });
  if (equipped && equipped !== it) lines.push({ t: '（目前已裝備同部位）', c: '#6b7290' });
  // 量測尺寸
  ctx.font = 'bold 12px "Courier New",monospace';
  let maxW = ctx.measureText(gearLabel(it)).width + ctx.measureText(tierName).width + 30;
  ctx.font = '11px "Courier New",monospace';
  for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln.t).width + 20);
  const tw = Math.max(148, Math.min(268, maxW));
  const th = 30 + lines.length * 15 + 6;
  let tx = mx + 16, ty = my + 10;
  if (tx + tw > W - 6) tx = mx - tw - 16;
  if (ty + th > H - 6) ty = H - th - 6;
  if (tx < 6) tx = 6; if (ty < 6) ty = 6;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  fillRoundRect(tx, ty, tw, th, 7, '#12101c', null, 0);
  ctx.restore();
  fillRoundRect(tx, ty, tw, th, 7, null, col, 1.5);
  ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = 'bold 12px "Courier New",monospace';
  ctx.fillText(gearLabel(it), tx + 10, ty + 18);
  ctx.textAlign = 'right'; ctx.fillStyle = '#8890b8'; ctx.font = '10px "Courier New",monospace';
  ctx.fillText(tierName, tx + tw - 10, ty + 17);
  ctx.strokeStyle = withAlpha(col, 0.4); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tx + 8, ty + 25); ctx.lineTo(tx + tw - 8, ty + 25); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = '11px "Courier New",monospace';
  for (let i = 0; i < lines.length; i++) { ctx.fillStyle = lines[i].c; ctx.fillText(lines[i].t, tx + 10, ty + 40 + i * 15); }
  ctx.textAlign = 'left';
}

// ---------- full character stats ----------
const STAT_FONT = '"Microsoft JhengHei UI","Microsoft JhengHei","Noto Sans TC",sans-serif';
function drawFitText(text, x, y, maxW) {
  let out = String(text);
  while (out.length > 2 && ctx.measureText(out).width > maxW) out = out.slice(0, -2) + '…';
  ctx.fillText(out, x, y);
}
function drawStatColumn(x, y, w, title, color, rows) {
  ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, y, w, 365);
  ctx.strokeStyle = '#414661'; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, 365);
  ctx.fillStyle = color; ctx.font = 'bold 16px ' + STAT_FONT;
  ctx.fillText(title, x + 12, y + 25);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], ry = y + 52 + i * 39;
    ctx.fillStyle = '#dce0f2'; ctx.font = '13px ' + STAT_FONT;
    ctx.fillText(row[0], x + 12, ry);
    ctx.fillStyle = row[3] || '#fff'; ctx.font = 'bold 14px ' + STAT_FONT; ctx.textAlign = 'right';
    ctx.fillText(row[1], x + w - 12, ry);
    ctx.textAlign = 'left'; ctx.fillStyle = '#9ba3c7'; ctx.font = '11px ' + STAT_FONT;
    drawFitText(row[2], x + 12, ry + 16, w - 24);
  }
}
function drawStatsPanel() {
  const p = player;
  const atk = atkPow(), crit = critRate(), gearHp = eqStat('armor', 'hp') + eqStat('helmet', 'hp');
  const hpBase = 60 + (baseClassOf(p.cls) === 'warrior' ? 40 : 0) + p.lv * 8 + 20 * p.cd.hp + gearHp;
  const recvMul = (1 + 0.25 * perkV('glass')) * (1 - 0.01 * meta.up.guard);
  const recoveryMul = 1 + 0.1 * meta.up.recovery;
  const combatRows = [
    ['攻擊力', Math.round(atk), '基礎 ' + atkBase().toFixed(1) + ' × 倍率 ' + atkMultiplier().toFixed(2), '#ffe680'],
    ['傷害範圍', Math.round(atk * 0.85) + '～' + Math.round(atk * 1.15), '每次攻擊隨機 85%～115%'],
    ['爆擊率', (crit * 100).toFixed(1) + '%', '基礎8% + 永久' + (meta.up.crit * 0.5).toFixed(1) + '% + 卡/裝/附魔/套裝'],
    ['爆擊傷害', Math.round((1.6 + affixV('critDmg')) * 100) + '%', '基礎160% + 狂虐附魔'],
    ['技能傷害', '+' + Math.round((skillDamageMul() - 1) * 100) + '%', '絕技精通 Lv' + p.cd.xdmg + (perkV('overcharge') ? '；奧術超載 Lv' + perkV('overcharge') : '') + (affixV('skillDmg') ? '；套裝加成' : '')],
    ['冷卻倍率', '×' + cooldownMul().toFixed(2), '迅捷出手 Lv' + p.cd.aspd + '；永久冷卻 -' + (meta.up.haste * 1.5).toFixed(1) + '%'],
    ['承受傷害', '×' + recvMul.toFixed(2), '防禦本能 -' + meta.up.guard + '%' + (perkV('glass') ? '；玻璃大砲放大' : '')],
    ['吸血／擊殺回血', Math.round((perkV('vamp') * 0.06 + affixV('lifesteal')) * 100) + '% / ' + (p.cd.ls * 3), '吸血鬼、吸血附魔／嗜血卡']
  ];
  const survivalRows = [
    ['HP', Math.ceil(p.hp) + ' / ' + p.mhp, '公式基礎 ' + Math.round(hpBase) + '；裝備HP ' + Math.round(gearHp), '#ff8a8a'],
    ['MP', Math.ceil(p.mp) + ' / ' + p.mmp, '等級、職業與心靈之泉'],
    ['固定減傷', armorDef(), '裝備 ' + Math.round(eqStat('armor', 'def') + eqStat('helmet', 'def')) + ' + 鋼鐵皮膚 ' + p.cd.def + ' + 附魔 ' + Math.round(affixV('def'))],
    ['HP回復', (0.48 * recoveryMul).toFixed(2) + ' /秒', '營火調息 Lv' + meta.up.recovery],
    ['MP回復', (3 * (1 + 0.5 * p.cd.mp) * recoveryMul).toFixed(1) + ' /秒', '心靈之泉 Lv' + p.cd.mp + '；營火調息 Lv' + meta.up.recovery],
    ['移動速度', moveSpd().toFixed(1), '基礎2.0 + 卡' + (p.cd.spd * 0.4).toFixed(1) + ' + 裝/附魔' + (eqStat('boots', 'spd') + affixV('move')).toFixed(1)],
    ['受傷無敵', ((60 + 6 * p.cd.ifr) / 60).toFixed(1) + ' 秒', '閃避本能 Lv' + p.cd.ifr],
    ['護盾', Math.round(p.shieldHp || 0), perkV('aegis') ? '守護結界 Lv' + perkV('aegis') : '目前沒有護盾來源']
  ];
  const economyRows = [
    ['升級進度', Math.round(p.xp) + ' / ' + xpNeed(p.lv), 'Lv' + p.lv + ' → Lv' + (p.lv + 1), '#9ecbff'],
    ['裝備掉率', (gearDropChance(false) * 100).toFixed(1) + '%', '第' + floor + '層一般怪；含尋寶附魔'],
    ['菁英裝備率', (gearDropChance(true) * 100).toFixed(1) + '%', '一般怪機率 +15%；總上限50%'],
    ['藥水掉率', (potionDropChance() * 100).toFixed(1) + '%', '藥劑師 Lv' + p.cd.pot + '；回復量 +' + (meta.up.alchemy * 5 + p.cd.heal * 10) + '%'],
    ['靈魂掉率', (SOUL_DROP_CHANCE * 100) + '%', '一般怪；菁英2顆／Boss 8顆'],
    ['靈魂結算', '×' + soulGainMul().toFixed(2), '共鳴、貪婪卡與貪婪附魔'],
    ['永久戰鬥成長', '攻+' + (meta.up.atk * 4) + '% HP+' + (meta.up.vit * 8) + '%', '爆擊+' + (meta.up.crit * 0.5).toFixed(1) + '%；減傷' + meta.up.guard + '%；冷卻-' + (meta.up.haste * 1.5).toFixed(1) + '%'],
    ['目前樓層', String(floor), biomeOf(floor).name + (floor % 5 === 0 ? '・Boss層' : '')]
  ];

  ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
  const x = 45, y = 24, w = W - 90, h = H - 48;
  ctx.fillStyle = 'rgba(20,22,43,0.985)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7dffd6'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  ctx.textAlign = 'left'; ctx.fillStyle = '#7dffd6'; ctx.font = 'bold 22px ' + STAT_FONT;
  ctx.fillText('角 色 能 力', x + 20, y + 32);
  ctx.fillStyle = '#dce0f2'; ctx.font = '13px ' + STAT_FONT;
  ctx.fillText((meta.playerName || '勇者') + '　Lv.' + p.lv + ' ' + CLASSES[p.cls].name + (gameState === 'play' ? '　即時數值' : '　最近角色數值'), x + 180, y + 31);
  statsCloseBtn = { x: x + w - 92, y: y + 10, w: 76, h: 28 };
  ctx.fillStyle = 'rgba(226,59,59,0.18)'; ctx.fillRect(statsCloseBtn.x, statsCloseBtn.y, statsCloseBtn.w, statsCloseBtn.h);
  ctx.strokeStyle = '#a05060'; ctx.lineWidth = 1; ctx.strokeRect(statsCloseBtn.x, statsCloseBtn.y, statsCloseBtn.w, statsCloseBtn.h);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px ' + STAT_FONT; ctx.textAlign = 'center';
  ctx.fillText('P / Esc 關閉', statsCloseBtn.x + statsCloseBtn.w / 2, statsCloseBtn.y + 19);
  ctx.textAlign = 'left';
  const gap = 12, colW = (w - 40 - gap * 2) / 3, colY = y + 52;
  drawStatColumn(x + 14, colY, colW, '戰 鬥', '#ffe680', combatRows);
  drawStatColumn(x + 14 + colW + gap, colY, colW, '生 存', '#ff8a8a', survivalRows);
  drawStatColumn(x + 14 + (colW + gap) * 2, colY, colW, '成 長／經 濟', '#9ecbff', economyRows);
  ctx.fillStyle = '#939bbd'; ctx.font = '11px ' + STAT_FONT;
  ctx.fillText('顯示值直接取自實際戰鬥公式；裝備強化、附魔與卡片效果已計入。', x + 18, y + h - 12);
}

// ---------- overlays ----------
function wrapText(text, cx, y, maxW, lh) {
  let line = '', yy = y, count = 0;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, cx, yy); line = ch; yy += lh; count++; }
    else line += ch;
  }
  if (line) { ctx.fillText(line, cx, yy); count++; }
  return count; // 回傳實際行數，供動態間隔用
}
// 只量行數不繪製（供動態高度計算）；以 13px 更新項目字型量測。
function measureWrapLines(text, maxW) {
  ctx.font = '13px "Courier New",monospace';
  let line = '', count = 0;
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxW && line) { line = ch; count++; }
    else line += ch;
  }
  if (line) count++;
  return count || 1;
}
function drawPick() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  pickBtns.length = 0;
  pickRerollBtn = null;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe680'; ctx.font = 'bold 26px "Courier New",monospace';
  ctx.fillText('LEVEL UP!  選擇一項強化', W / 2, 130);
  for (let i = 0; i < 3; i++) {
    const c = pickOpts[i];
    const cw = 200, ch = 180;
    const cx = W / 2 + (i - 1) * 230 - cw / 2, cy = 180;
    const rc = CARD_RCOL[c.r];
    ctx.fillStyle = c.r === 2 ? 'rgba(60,48,20,0.95)' : c.r === 1 ? 'rgba(24,32,56,0.95)' : 'rgba(20,22,43,0.95)';
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = rc; ctx.lineWidth = c.r === 2 ? 3 : 2; ctx.strokeRect(cx, cy, cw, ch);
    pickBtns.push({ x: cx, y: cy, w: cw, h: ch, c: c });
    ctx.fillStyle = rc; ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillText(CARD_RNAME[c.r], cx + cw / 2, cy + 26);
    ctx.fillStyle = c.r === 0 ? '#fff' : rc; ctx.font = 'bold 18px "Courier New",monospace';
    ctx.fillText(c.name, cx + cw / 2, cy + 60);
    ctx.fillStyle = '#9ecbff'; ctx.font = '12px "Courier New",monospace';
    wrapText(c.desc, cx + cw / 2, cy + 92, cw - 20, 15);
    const lvNow = cardLv(c);
    ctx.font = 'bold 11px "Courier New",monospace';
    ctx.fillStyle = lvNow + 1 >= CARD_MAXLV ? '#ffd23e' : '#8890b8';
    ctx.fillText(lvNow > 0 ? ('Lv.' + lvNow + ' → ' + (lvNow + 1) + ' / ' + CARD_MAXLV + (lvNow + 1 >= CARD_MAXLV ? '  滿級!' : '')) : ('取得 → Lv.1 / ' + CARD_MAXLV), cx + cw / 2, cy + 138);
    ctx.fillStyle = '#ffe680'; ctx.font = 'bold 14px "Courier New",monospace';
    ctx.fillText('[' + (i + 1) + '] 或點擊', cx + cw / 2, cy + ch - 20);
  }
  if (player.eventRerolls > 0) {
    pickRerollBtn = { x:W / 2 - 130, y:382, w:260, h:42 };
    ctx.fillStyle = 'rgba(255,211,106,0.16)'; ctx.fillRect(pickRerollBtn.x, pickRerollBtn.y, pickRerollBtn.w, pickRerollBtn.h);
    ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2; ctx.strokeRect(pickRerollBtn.x, pickRerollBtn.y, pickRerollBtn.w, pickRerollBtn.h);
    ctx.fillStyle = '#ffd36a'; ctx.font = 'bold 13px ' + STAT_FONT;
    ctx.fillText('[R] 命運重抽　剩餘 ' + player.eventRerolls + ' 次', W / 2, pickRerollBtn.y + 26);
  }
  ctx.textAlign = 'left';
}
function drawDead() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  const extracted = lastRun && lastRun.result === 'extract';
  ctx.fillStyle = extracted ? '#7dffd6' : '#ff6b6b'; ctx.font = 'bold 36px "Courier New",monospace';
  ctx.fillText(extracted ? '成 功 撤 退！' : '你 倒 下 了 ...', W / 2, 180);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Courier New",monospace';
  ctx.fillText('到達 第 ' + lastRun.floor + ' 層', W / 2, 240);
  ctx.fillText('擊殺 ' + lastRun.kills + ' 隻怪物', W / 2, 270);
  ctx.fillStyle = '#7dffd6';
  ctx.fillText(lastRun.benchmarkId ? '測試靈魂 +' + lastRun.gained : '獲得靈魂 +' + lastRun.gained, W / 2, 300);
  ctx.fillStyle = extracted ? '#9ecbff' : '#ffb0b0'; ctx.font = 'bold 14px "Courier New",monospace';
  ctx.fillText(lastRun.benchmarkId ? '固定基準局不保存角色進度' : extracted ? '本章獎勵與探索成果已保存' : '最後傷害：' + (lastRun.cause || '未知攻擊'), W / 2, 326);
  if (lastRun.stashed) { ctx.fillStyle = '#d8b365'; ctx.fillText('裝備存入倉庫 ' + lastRun.stashed + ' 件', W / 2, 350); }
  ctx.fillStyle = Math.floor(frame / 30) % 2 === 0 ? '#ffe680' : '#8890b8';
  ctx.font = '15px "Courier New",monospace';
  ctx.fillText('按 Enter 或點擊 返回城鎮', W / 2, 388);
  ctx.textAlign = 'left';
}
