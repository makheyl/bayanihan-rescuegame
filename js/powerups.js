/* =========================================================================
   TERRAQUA CLASH — powerups.js
   Four pickups, deliberately few so each one reads instantly on screen.
   Glyphs are drawn as paths rather than emoji so they stay crisp and look
   the same on every machine.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ || (global.TQ = {});
  var U = TQ.util;

  var TYPES = [
    {
      id: 'surge', name: 'Speed Surge', duration: 6,
      c1: '#FFE082', c2: '#F0A93C', ring: '#FFF3C4',
      desc: 'Acceleration and top speed up 55% for 6 seconds.',
      hud: 'SURGE'
    },
    {
      id: 'slam', name: 'Tidal Slam', duration: 8,
      c1: '#FFB199', c2: '#DE575D', ring: '#FFD9CC',
      desc: 'Your shoves hit 2.6× harder and reach further for 8 seconds.',
      hud: 'SLAM'
    },
    {
      id: 'kelp', name: 'Kelp Shield', duration: 5,
      c1: '#B7E88C', c2: '#3FBA54', ring: '#DFF6C9',
      desc: 'Immune to knockback and to stamina drain for 5 seconds.',
      hud: 'SHIELD'
    },
    {
      id: 'frost', name: 'Deep Freeze', duration: 0,
      c1: '#CFF3FF', c2: '#39A7D8', ring: '#EAFBFF',
      desc: 'Instantly roots the nearest rival in place for 1.6 seconds.',
      hud: 'FREEZE'
    }
  ];

  var index = {};
  TYPES.forEach(function (t) { index[t.id] = t; });

  /* Find a fair spawn point: on the island, not inside a pillar, not on top
     of a player, and biased toward ground that will still exist shortly. */
  function findSpot(state) {
    var arena = state.arena;
    for (var attempt = 0; attempt < 80; attempt++) {
      var gx = 3 + Math.floor(Math.random() * (arena.W - 6));
      var gy = 3 + Math.floor(Math.random() * (arena.H - 6));
      var h = arena.height[gy * arena.W + gx];
      if (h < arena.seaLevel - 0.06) continue;   // avoid deep-ish water
      var x = (gx + 0.5) * arena.cell, y = (gy + 0.5) * arena.cell;

      if (arena.pillars.some(function (p) { return U.dist(p.x, p.y, x, y) < p.r + 34; })) continue;
      if (state.players.some(function (p) { return p.alive && U.dist(p.x, p.y, x, y) < 90; })) continue;
      if (state.powerups.some(function (p) { return U.dist(p.x, p.y, x, y) < 130; })) continue;
      return { x: x, y: y };
    }
    return null;
  }

  function spawn(state) {
    if (state.powerups.length >= 4) return null;
    var spot = findSpot(state);
    if (!spot) return null;
    var type = TYPES[Math.floor(Math.random() * TYPES.length)];
    var pu = {
      type: type, x: spot.x, y: spot.y,
      born: state.elapsed, life: 16, taken: false, pop: 0
    };
    state.powerups.push(pu);
    return pu;
  }

  /* Apply a pickup to a player. Returns a short label for the floating text. */
  function apply(pu, player, state) {
    var t = pu.type;
    if (t.id === 'frost') {
      // root the closest living rival
      var best = null, bd = Infinity;
      state.players.forEach(function (o) {
        if (o === player || !o.alive) return;
        var d = U.dist2(o.x, o.y, player.x, player.y);
        if (d < bd) { bd = d; best = o; }
      });
      if (best && !best.effects.kelp) {
        best.effects.frost = 1.6;
        state.floaters.push({ x: best.x, y: best.y - 40, text: 'FROZEN!', c: '#CFF3FF', life: 1.2, t: 0 });
        TQ.sfx.play('freeze');
        return 'FREEZE!';
      }
      state.floaters.push({ x: player.x, y: player.y - 40, text: 'NO TARGET', c: '#FFF', life: 1, t: 0 });
      return 'NO TARGET';
    }
    player.effects[t.id] = t.duration;
    TQ.sfx.play('pickup');
    return t.hud + '!';
  }

  /* ------------------------------------------------------------ glyphs */

  function glyph(ctx, id, r) {
    ctx.beginPath();
    if (id === 'surge') {
      ctx.moveTo(0.12 * r, -0.72 * r);
      ctx.lineTo(-0.44 * r, 0.10 * r);
      ctx.lineTo(-0.04 * r, 0.10 * r);
      ctx.lineTo(-0.16 * r, 0.74 * r);
      ctx.lineTo(0.46 * r, -0.12 * r);
      ctx.lineTo(0.06 * r, -0.12 * r);
      ctx.closePath();
    } else if (id === 'slam') {
      for (var i = 0; i < 10; i++) {
        var a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        var rad = (i % 2 === 0) ? r * 0.76 : r * 0.34;
        var x = Math.cos(a) * rad, y = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else if (id === 'kelp') {
      ctx.moveTo(0, -0.76 * r);
      ctx.lineTo(0.62 * r, -0.44 * r);
      ctx.lineTo(0.56 * r, 0.24 * r);
      ctx.quadraticCurveTo(0.3 * r, 0.7 * r, 0, 0.8 * r);
      ctx.quadraticCurveTo(-0.3 * r, 0.7 * r, -0.56 * r, 0.24 * r);
      ctx.lineTo(-0.62 * r, -0.44 * r);
      ctx.closePath();
    } else { // frost
      for (var s = 0; s < 6; s++) {
        var ang = (s / 6) * Math.PI * 2;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        ctx.moveTo(0, 0);
        ctx.lineTo(dx * r * 0.78, dy * r * 0.78);
        var bx = dx * r * 0.46, by = dy * r * 0.46;
        var px = -dy, py = dx;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (dx * 0.2 + px * 0.24) * r, by + (dy * 0.2 + py * 0.24) * r);
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + (dx * 0.2 - px * 0.24) * r, by + (dy * 0.2 - py * 0.24) * r);
      }
    }
  }

  function draw(ctx, pu, t) {
    var ty = pu.type;
    var age = t - pu.born;
    var bob = Math.sin(t * 3 + pu.x * 0.01) * 5;
    var spin = Math.sin(t * 1.6 + pu.y * 0.01) * 0.22;
    var r = 19 * (1 + pu.pop * 0.5);
    var fading = (pu.life - age) < 3.5;
    var alpha = fading ? (0.35 + 0.65 * Math.abs(Math.sin(t * 7))) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;

    // ground shadow
    ctx.beginPath();
    ctx.ellipse(pu.x, pu.y + 20, r * 0.7, r * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,40,55,.25)'; ctx.fill();

    ctx.translate(pu.x, pu.y + bob);

    // halo
    ctx.beginPath();
    ctx.arc(0, 0, r * (1.5 + Math.sin(t * 4) * 0.1), 0, Math.PI * 2);
    ctx.fillStyle = ty.ring; ctx.globalAlpha = alpha * 0.22; ctx.fill();
    ctx.globalAlpha = alpha;

    ctx.rotate(spin);

    // capsule body
    var g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, ty.c1); g.addColorStop(1, ty.c2);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3.4; ctx.strokeStyle = TQ.animals.INK; ctx.stroke();

    // gloss
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.36, r * 0.34, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();

    // icon
    ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    glyph(ctx, ty.id, r * 0.78);
    if (ty.id === 'frost') { ctx.strokeStyle = '#1B5C7A'; ctx.stroke(); }
    else {
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
      ctx.strokeStyle = 'rgba(20,49,63,.75)'; ctx.stroke();
    }
    ctx.restore();
  }

  /* Badge drawn beside a player's body while an effect is live. */
  function drawEffectBadge(ctx, id, x, y, remain, total) {
    var ty = index[id];
    if (!ty) return;
    var r = 11;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = ty.c2; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = TQ.animals.INK; ctx.stroke();
    // countdown arc
    ctx.beginPath();
    ctx.arc(0, 0, r + 3, -Math.PI / 2, -Math.PI / 2 + (remain / total) * Math.PI * 2);
    ctx.lineWidth = 3; ctx.strokeStyle = ty.c1; ctx.stroke();
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    glyph(ctx, id, r * 0.62);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(20,49,63,.7)';
    if (id === 'frost') ctx.stroke(); else { ctx.fill(); ctx.stroke(); }
    ctx.restore();
  }

  TQ.powerups = {
    TYPES: TYPES,
    byId: function (id) { return index[id]; },
    spawn: spawn,
    apply: apply,
    draw: draw,
    glyph: glyph,
    drawEffectBadge: drawEffectBadge
  };

}(window));
