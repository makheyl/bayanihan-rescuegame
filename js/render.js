/* =====================================================================
   render.js — everything the mission draws.
   Split out of game.js so neither file has to carry both the simulation
   and the paint pass.
   ===================================================================== */
(function (BR) {
  'use strict';

  var T = BR.maps.T, TILE = BR.maps.TILE;

  var canvas = null, c = null, dpr = 1, vw = 0, vh = 0;
  var mask = null, mc = null;          // offscreen darkness/vision mask

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.getElementById('gameCanvas');
      if (!canvas) return false;
      c = canvas.getContext('2d');
      mask = document.createElement('canvas');
      mc = mask.getContext('2d');
      window.addEventListener('resize', resize);
    }
    return true;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var r = canvas.getBoundingClientRect();
    vw = Math.max(320, Math.round(r.width));
    vh = Math.max(240, Math.round(r.height));
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    mask.width = canvas.width; mask.height = canvas.height;
  }

  BR.renderResize = resize;

  /* ------------------------------------------------------------------ */
  function draw(g, alpha) {
    if (!ensureCanvas()) return;
    if (!vw || canvas.width !== Math.round(vw * dpr)) resize();

    var reduce = BR.state.settings.reduceMotion;
    var ms = g.missionState, map = g.map, t = g.time;

    // interpolated positions
    var bx = BR.lerp(g.boat.px, g.boat.x, alpha);
    var by = BR.lerp(g.boat.py, g.boat.y, alpha);
    var ba = BR.angleLerp(g.boat.pang, g.boat.ang, alpha);
    var cx = BR.lerp(g.cam.px, g.cam.x, alpha);
    var cy = BR.lerp(g.cam.py, g.cam.y, alpha);

    // camera clamp to map bounds (centre if the map is smaller than the view)
    var halfW = vw / 2, halfH = vh / 2;
    cx = map.w <= vw ? map.w / 2 : BR.clamp(cx, halfW, map.w - halfW);
    cy = map.h <= vh ? map.h / 2 : BR.clamp(cy, halfH, map.h - halfH);

    var shakeAmt = g.shake * (reduce ? 0.22 : 1);
    var sx = (Math.random() - 0.5) * shakeAmt;
    var sy = (Math.random() - 0.5) * shakeAmt;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, vw, vh);

    c.save();
    c.translate(Math.round(halfW - cx + sx), Math.round(halfH - cy + sy));

    var view = {
      x0: Math.max(0, Math.floor((cx - halfW) / TILE) - 1),
      y0: Math.max(0, Math.floor((cy - halfH) / TILE) - 1),
      x1: Math.min(map.cols - 1, Math.ceil((cx + halfW) / TILE) + 1),
      y1: Math.min(map.rows - 1, Math.ceil((cy + halfH) / TILE) + 1)
    };

    drawWater(g, view, t, cx, cy, halfW, halfH);
    drawTiles(g, view, t);
    drawResidents(g, t);
    drawParticles(g);
    BR.art.drawBoat(c, bx, by, ba, 1.15, { aboard: g.aboard.length });

    c.restore();

    drawDarkness(g, bx, by, ba, cx, cy, halfW, halfH);
    drawRain(g, reduce);
    drawFlash(g, reduce);
    drawPing(g, cx, cy, halfW, halfH);
    drawVignette(g);
  }

  /* ------------------------------------------------------------------
     WATER — base, caustics, current streaks, dock
     ------------------------------------------------------------------ */
  function drawWater(g, v, t, cx, cy, halfW, halfH) {
    var dark = g.mission.dark;
    var deep = mix('#1489B4', '#0A2A3A', dark);
    var mid  = mix('#2BB4D4', '#123C4E', dark);

    var x0 = cx - halfW - 40, y0 = cy - halfH - 40;
    var w = halfW * 2 + 80, h = halfH * 2 + 80;

    var grad = c.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, mid); grad.addColorStop(1, deep);
    c.fillStyle = grad;
    c.fillRect(x0, y0, w, h);

    // slow caustic bands — cheap, and they sell "this is moving water"
    c.save();
    c.globalAlpha = 0.10 + 0.05 * Math.sin(t * 0.5);
    c.strokeStyle = '#E4FAFF';
    c.lineWidth = 3;
    var off = (t * 26) % 90;
    for (var i = -2; i < (w / 90) + 2; i++) {
      var lx = x0 + i * 90 + off;
      c.beginPath();
      c.moveTo(lx, y0);
      c.quadraticCurveTo(lx + 26, y0 + h / 2, lx, y0 + h);
      c.stroke();
    }
    c.restore();

    // current streaks, so a lane is readable before it is felt
    c.save();
    c.strokeStyle = 'rgba(228,250,255,.55)';
    c.lineWidth = 2.4; c.lineCap = 'round';
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        var cell = g.map.at(x, y);
        if (!cell || (!cell.cx && !cell.cy)) continue;
        var sp = Math.sqrt(cell.cx * cell.cx + cell.cy * cell.cy);
        var ang = Math.atan2(cell.cy, cell.cx);
        var phase = ((t * sp * 0.9) + (x * 13 + y * 7)) % TILE;
        var px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
        var ox = Math.cos(ang) * (phase - TILE / 2);
        var oy = Math.sin(ang) * (phase - TILE / 2);
        c.globalAlpha = 0.5 * (1 - Math.abs(phase - TILE / 2) / (TILE / 2));
        c.beginPath();
        c.moveTo(px + ox, py + oy);
        c.lineTo(px + ox + Math.cos(ang) * 13, py + oy + Math.sin(ang) * 13);
        c.stroke();
      }
    }
    c.restore();

    // dock apron
    c.save();
    c.fillStyle = 'rgba(143,224,238,.28)';
    for (var d = 0; d < g.map.dock.length; d++) {
      var dc = g.map.dock[d];
      c.fillRect(dc.x * TILE, dc.y * TILE, TILE, TILE);
    }
    c.strokeStyle = 'rgba(87,176,26,.9)';
    c.setLineDash([9, 7]);
    c.lineWidth = 3;
    c.lineDashOffset = -t * 22;
    var dk = g.map.dock;
    if (dk.length) {
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (var i2 = 0; i2 < dk.length; i2++) {
        minX = Math.min(minX, dk[i2].x); maxX = Math.max(maxX, dk[i2].x);
        minY = Math.min(minY, dk[i2].y); maxY = Math.max(maxY, dk[i2].y);
      }
      c.strokeRect(minX * TILE, minY * TILE, (maxX - minX + 1) * TILE, (maxY - minY + 1) * TILE);
    }
    c.setLineDash([]);
    c.restore();
  }

  /* ------------------------------------------------------------------
     TILES
     ------------------------------------------------------------------ */
  function drawTiles(g, v, t) {
    var wl = g.missionState.waterLevel;
    for (var y = v.y0; y <= v.y1; y++) {
      for (var x = v.x0; x <= v.x1; x++) {
        var cell = g.map.at(x, y);
        if (!cell) continue;
        var px = x * TILE, py = y * TILE;

        if (cell.t === T.ROOF) {
          var sub = BR.maps.submergence(cell, wl);
          if (sub >= 1) {
            // gone under — a ghost outline so the street layout still reads
            c.save();
            c.globalAlpha = 0.22;
            c.fillStyle = '#0E4256';
            c.fillRect(px, py, TILE, TILE);
            c.restore();
            continue;
          }
          BR.art.drawRoof(c, px, py, TILE, cell, sub);
        } else if (cell.t === T.TREE) {
          BR.art.drawTree(c, px, py, TILE, cell);
        } else if (cell.t === T.DEBRIS) {
          BR.art.drawDebris(c, px, py, TILE, cell, t);
        } else if (cell.t === T.EVAC) {
          BR.art.drawEvac(c, px, py, TILE, cell);
        } else if (cell.t === T.WIRE) {
          BR.art.drawWire(c, px, py, TILE, t);
        }
      }
    }

    // evacuation-center label
    var e = g.map.evac;
    c.save();
    c.font = '700 13px Nunito, system-ui, sans-serif';
    c.textAlign = 'center';
    var lx = (e.x + e.w / 2) * TILE, ly = e.y * TILE - 10;
    var label = 'EVACUATION CENTER';
    var w = c.measureText(label).width + 16;
    c.fillStyle = 'rgba(87,176,26,.92)';
    BR.art.rr(c, lx - w / 2, ly - 15, w, 21, 8); c.fill();
    c.fillStyle = '#FFF';
    c.fillText(label, lx, ly);
    c.font = '700 11px Nunito, system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.fillText('Sentro ng Paglikas', lx, ly + 18);
    c.restore();
  }

  /* ------------------------------------------------------------------ */
  function drawResidents(g, t) {
    for (var i = 0; i < g.roster.length; i++) {
      var r = g.roster[i];
      if (r.state !== 'waiting') continue;
      if (!r.found && g.mission.dark >= 0.3) continue;
      BR.art.drawResident(c, r.x, r.y, 12, r, t);
    }
  }

  function drawParticles(g) {
    for (var i = 0; i < g.parts.length; i++) {
      var p = g.parts[i];
      c.globalAlpha = BR.clamp(p.life / p.max, 0, 1);
      c.fillStyle = p.col;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------
     DARKNESS + VISIBILITY CONE
     ------------------------------------------------------------------ */
  function drawDarkness(g, bx, by, ba, cx, cy, halfW, halfH) {
    var v = g.visionParams();
    if (v.dark < 0.05) return;

    var sxp = bx - cx + halfW, syp = by - cy + halfH;

    mc.setTransform(dpr, 0, 0, dpr, 0, 0);
    mc.clearRect(0, 0, vw, vh);
    mc.fillStyle = 'rgba(4,14,22,' + (0.30 + v.dark * 0.66) + ')';
    mc.fillRect(0, 0, vw, vh);

    mc.globalCompositeOperation = 'destination-out';

    // the pool of light immediately around the boat
    var halo = mc.createRadialGradient(sxp, syp, 0, sxp, syp, v.halo);
    halo.addColorStop(0, 'rgba(0,0,0,1)');
    halo.addColorStop(0.55, 'rgba(0,0,0,.85)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = halo;
    mc.beginPath(); mc.arc(sxp, syp, v.halo, 0, 6.2832); mc.fill();

    // the cone
    var cone = mc.createRadialGradient(sxp, syp, v.halo * 0.4, sxp, syp, v.len);
    cone.addColorStop(0, 'rgba(0,0,0,.95)');
    cone.addColorStop(0.6, 'rgba(0,0,0,.72)');
    cone.addColorStop(1, 'rgba(0,0,0,0)');
    mc.fillStyle = cone;
    mc.beginPath();
    mc.moveTo(sxp, syp);
    mc.arc(sxp, syp, v.len, ba - v.half, ba + v.half);
    mc.closePath();
    mc.fill();

    mc.globalCompositeOperation = 'source-over';

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(mask, 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // a warm rim on the beam so the flashlight reads as a light, not a hole
    if (v.torch) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      var warm = c.createRadialGradient(sxp, syp, 0, sxp, syp, v.len);
      warm.addColorStop(0, 'rgba(255,214,140,.16)');
      warm.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = warm;
      c.beginPath();
      c.moveTo(sxp, syp);
      c.arc(sxp, syp, v.len, ba - v.half, ba + v.half);
      c.closePath(); c.fill();
      c.restore();
    }
  }

  /* ------------------------------------------------------------------ */
  function drawRain(g, reduce) {
    var amt = g.weather.rain;
    if (amt <= 0.02) return;
    var t = g.time;
    c.save();
    c.strokeStyle = 'rgba(214,240,252,' + (0.16 + 0.2 * Math.min(amt, 1)) + ')';
    c.lineWidth = reduce ? 1 : 1.5;
    var slantX = 0.16 + g.weather.windX * 0.004;
    for (var i = 0; i < g.rain.length; i++) {
      var d = g.rain[i];
      var yy = ((d.y + t * d.spd * (0.6 + amt)) % 1) * (vh + 60) - 30;
      var xx = ((d.x + yy / vh * slantX) % 1) * vw;
      c.beginPath();
      c.moveTo(xx, yy);
      c.lineTo(xx - d.len * slantX * 3, yy + d.len * (0.6 + amt * 0.5));
      c.stroke();
    }
    c.restore();
  }

  function drawFlash(g, reduce) {
    if (g.weather.flash <= 0) return;
    var a = g.weather.flash * (reduce ? 0.14 : 0.42);
    c.fillStyle = 'rgba(226,244,255,' + a + ')';
    c.fillRect(0, 0, vw, vh);
  }

  function drawPing(g, cx, cy, halfW, halfH) {
    if (!g.ping) return;
    var r = g.ping.target;
    var sxp = r.x - cx + halfW, syp = r.y - cy + halfH;
    var a = BR.clamp(g.ping.t / 1.5, 0, 1) * (0.7 + 0.3 * Math.sin(g.time * 7));
    BR.hud.drawPing(c, vw, vh, sxp, syp, r.found ? r.name : 'Radyo bearing', a);
  }

  function drawVignette(g) {
    var lvl = g.missionState.waterLevel;
    if (lvl < 0.55) return;
    var a = (lvl - 0.55) / 0.45 * 0.3;
    var v = c.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.32,
                                   vw / 2, vh / 2, Math.max(vw, vh) * 0.72);
    v.addColorStop(0, 'rgba(120,20,10,0)');
    v.addColorStop(1, 'rgba(120,20,10,' + a.toFixed(3) + ')');
    c.fillStyle = v;
    c.fillRect(0, 0, vw, vh);
  }

  /* ------------------------------------------------------------------ */
  function mix(hexA, hexB, t) {
    function p(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
    var a = p(hexA), b = p(hexB);
    return 'rgb(' + Math.round(BR.lerp(a[0], b[0], t)) + ',' +
                    Math.round(BR.lerp(a[1], b[1], t)) + ',' +
                    Math.round(BR.lerp(a[2], b[2], t)) + ')';
  }

  BR.render = { draw: draw, resize: resize };

})(window.BR);
