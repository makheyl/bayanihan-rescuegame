/* =====================================================================
   maps.js — procedural flooded-barangay generator
   =====================================================================
   Tile layouts are generated from the mission seed rather than read from
   /assets/maps/*.json, because fetching local JSON is blocked by CORS on
   file:// origins and this build has to run by double-clicking index.html.
   The generator is deterministic: the same seed always produces the same
   barangay, so a defence demo is reproducible.

   Layout: a street grid of 2-tile-wide flooded lanes with house blocks
   between them, so the water is always fully connected and the boat can
   never be walled out of a rescue.
   ===================================================================== */
(function (BR) {
  'use strict';

  var T = { WATER: 0, ROOF: 1, TREE: 2, DEBRIS: 3, EVAC: 4, DOCK: 5, WIRE: 6 };
  var TILE = 48;

  var BLOCK_W = 7, BLOCK_H = 6;   // street pitch
  var STREET_W = 2;               // lane width in tiles

  /* Roof elevations, as a fraction of the full water rise.
     A roof floods visibly from (elev - 0.22) and is gone at elev, so the
     lowest house here starts filling about a third of the way in and goes
     under at ~38% of the mission — early enough to be real pressure, late
     enough that a player who reads the gauge can get there first.
     1.05 never floods: that is the two-storey concrete house. */
  var ELEVS = [0.38, 0.46, 0.54, 0.62, 0.70, 0.78, 0.86, 0.94, 1.05];

  function isStreet(x, y) {
    return (x % BLOCK_W) < STREET_W || (y % BLOCK_H) < STREET_W;
  }

  function make(mission) {
    var R = BR.rng(mission.seed);
    var cols = mission.cols, rows = mission.rows;
    var cells = new Array(cols * rows);

    function idx(x, y) { return y * cols + x; }
    function at(x, y) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return cells[idx(x, y)];
    }

    // --- base: everything is flooded street ---
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        cells[idx(x, y)] = {
          x: x, y: y, t: T.WATER, elev: 0, variant: R.int(0, 3),
          cx: 0, cy: 0, marker: false
        };
      }
    }

    // --- house blocks between the streets ---
    var blocksX = Math.ceil(cols / BLOCK_W), blocksY = Math.ceil(rows / BLOCK_H);
    for (var by = 0; by < blocksY; by++) {
      for (var bx = 0; bx < blocksX; bx++) {
        var roll = R.f();
        var kind = roll < 0.62 ? 'house' : (roll < 0.84 ? 'trees' : 'open');
        var x0 = bx * BLOCK_W + STREET_W, y0 = by * BLOCK_H + STREET_W;
        var x1 = Math.min(cols, (bx + 1) * BLOCK_W), y1 = Math.min(rows, (by + 1) * BLOCK_H);
        if (x0 >= x1 - 1 || y0 >= y1 - 1) continue;

        if (kind === 'house') {
          // one or two houses sharing the block, each with its own elevation
          var split = (x1 - x0) >= 4 && R.chance(0.45);
          var mid = split ? x0 + Math.floor((x1 - x0) / 2) : x1;
          paintHouse(x0, y0, mid, y1);
          if (split) paintHouse(mid, y0, x1, y1);
        } else if (kind === 'trees') {
          for (var ty = y0; ty < y1; ty++) {
            for (var tx = x0; tx < x1; tx++) {
              if (R.chance(0.42)) { var c = at(tx, ty); c.t = T.TREE; c.elev = 1; }
            }
          }
        }
        // 'open' blocks stay flooded — they are the wide spots the current uses
      }
    }

    function paintHouse(ax, ay, bx2, by2) {
      var e = R.pick(ELEVS);
      var v = R.int(0, 3);
      for (var hy = ay; hy < by2; hy++) {
        for (var hx = ax; hx < bx2; hx++) {
          var c = at(hx, hy);
          if (!c) continue;
          c.t = T.ROOF; c.elev = e; c.variant = v;
        }
      }
    }

    // --- evacuation center: an elevated school at the left edge ---
    var evacY = Math.floor(rows / 2) - 2;
    var evacX = 1;
    for (var ey = evacY; ey < evacY + 4; ey++) {
      for (var ex = evacX; ex < evacX + 3; ex++) {
        var ec = at(ex, ey);
        if (!ec) continue;
        ec.t = T.EVAC; ec.elev = 1.2; ec.marker = false;
      }
    }
    var mk = at(evacX + 1, evacY + 1); if (mk) mk.marker = true;

    // the dock: the water directly in front of the school
    var dock = [];
    for (var dy = evacY - 1; dy < evacY + 5; dy++) {
      for (var dx = evacX + 3; dx < evacX + 5; dx++) {
        var dc = at(dx, dy);
        if (!dc) continue;
        dc.t = T.DOCK; dc.elev = 0;
        dock.push(dc);
      }
    }
    var dockCx = (evacX + 4) * TILE, dockCy = (evacY + 2) * TILE;

    // --- current lanes along some streets ---
    var lanes = [];
    for (var l = 0; l < mission.currentLanes; l++) {
      var horiz = R.chance(0.55);
      var speed = R.range(34, 62);
      var dir = R.chance(0.5) ? 1 : -1;
      if (horiz) {
        var ly = R.int(0, blocksY - 1) * BLOCK_H + R.int(0, STREET_W - 1);
        for (var lx = 0; lx < cols; lx++) {
          var lc = at(lx, ly);
          if (lc && (lc.t === T.WATER)) { lc.cx = speed * dir; lc.cy = 0; }
        }
        lanes.push({ horiz: true, at: ly, dir: dir });
      } else {
        var lxx = R.int(0, blocksX - 1) * BLOCK_W + R.int(0, STREET_W - 1);
        for (var lyy = 0; lyy < rows; lyy++) {
          var lc2 = at(lxx, lyy);
          if (lc2 && (lc2.t === T.WATER)) { lc2.cx = 0; lc2.cy = speed * dir; }
        }
        lanes.push({ horiz: false, at: lxx, dir: dir });
      }
    }

    // --- debris: floating wreckage jammed across the lanes ---
    var debrisCells = [];
    var wantDebris = Math.round(cols * rows * 0.018);
    var guard = 0;
    while (debrisCells.length < wantDebris && guard++ < 4000) {
      var gx = R.int(1, cols - 2), gy = R.int(1, rows - 2);
      var g = at(gx, gy);
      if (!g || g.t !== T.WATER) continue;
      if (BR.dist(gx * TILE, gy * TILE, dockCx, dockCy) < TILE * 5) continue;
      // never plug a lane completely: leave at least one open neighbour
      var open = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var n = at(gx + d[0], gy + d[1]);
        if (n && (n.t === T.WATER || n.t === T.DOCK)) open++;
      });
      if (open < 2) continue;
      g.t = T.DEBRIS; g.elev = 1;
      debrisCells.push(g);
    }

    // --- live wires (Mission 3) ---
    var wireCells = [];
    var wguard = 0;
    while (wireCells.length < (mission.wires || 0) && wguard++ < 3000) {
      var wx = R.int(2, cols - 3), wy = R.int(2, rows - 3);
      var w = at(wx, wy);
      if (!w || w.t !== T.WATER) continue;
      if (BR.dist(wx * TILE, wy * TILE, dockCx, dockCy) < TILE * 7) continue;
      w.t = T.WIRE;
      wireCells.push(w);
    }

    // --- a clear launch spot next to the dock ---
    var spawn = { x: (evacX + 5.5) * TILE, y: (evacY + 2) * TILE };
    var sc = at(Math.floor(spawn.x / TILE), Math.floor(spawn.y / TILE));
    if (sc && sc.t !== T.WATER && sc.t !== T.DOCK) { sc.t = T.WATER; sc.elev = 0; }

    /* Connectivity guarantee.
       Debris is placed at random and can seal a two-wide lane, which would
       strand any resident whose only approach is behind the blockage — the
       boat reaches the far side, sits at full throttle and the mission
       stalls. Flood-fill the navigable water from the launch point at
       waterLevel 0 (the most restrictive moment; rising water only ever opens
       more up) and record it, so the roster can refuse to spawn anyone the
       bangka could never actually reach. */
    var reachable = new Uint8Array(cols * rows);
    (function floodFromSpawn() {
      var sx = Math.floor(spawn.x / TILE), sy = Math.floor(spawn.y / TILE);
      var start = idx(sx, sy);
      if (!passable(cells[start], 0)) return;
      var queue = [start];
      reachable[start] = 1;
      var head = 0;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (head < queue.length) {
        var cur = queue[head++];
        var cx2 = cur % cols, cy2 = (cur / cols) | 0;
        for (var di = 0; di < 4; di++) {
          var nx2 = cx2 + dirs[di][0], ny2 = cy2 + dirs[di][1];
          if (nx2 < 0 || ny2 < 0 || nx2 >= cols || ny2 >= rows) continue;
          var ni2 = idx(nx2, ny2);
          if (reachable[ni2]) continue;
          if (!passable(cells[ni2], 0)) continue;
          reachable[ni2] = 1;
          queue.push(ni2);
        }
      }
    })();

    return {
      cols: cols, rows: rows, tile: TILE,
      reachable: reachable,
      isReachable: function (x, y) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
        return !!reachable[idx(x, y)];
      },
      w: cols * TILE, h: rows * TILE,
      cells: cells,
      at: at, idx: idx,
      dock: dock, dockCx: dockCx, dockCy: dockCy,
      evac: { x: evacX, y: evacY, w: 3, h: 4 },
      spawn: spawn,
      lanes: lanes,
      debris: debrisCells,
      wires: wireCells,
      rng: R
    };
  }

  /* A tile blocks the boat unless it is water, dock, a live wire (you can
     drive through one, you just should not), or a roof the flood has taken. */
  function passable(cell, waterLevel) {
    if (!cell) return false;
    if (cell.t === T.WATER || cell.t === T.DOCK || cell.t === T.WIRE) return true;
    if (cell.t === T.ROOF) return waterLevel > cell.elev;
    return false;
  }

  function passableAt(map, wx, wy, waterLevel) {
    var c = map.at(Math.floor(wx / TILE), Math.floor(wy / TILE));
    return passable(c, waterLevel);
  }

  function submergence(cell, waterLevel) {
    if (cell.t !== T.ROOF) return 0;
    return BR.clamp((waterLevel - (cell.elev - 0.22)) / 0.22, 0, 1);
  }

  /* --------------------------------------------------------------------
     Mission-select card preview: a tiny top-down minimap of the barangay.
     -------------------------------------------------------------------- */
  function drawPreview(canvas, map) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 132;
    canvas.width = w * dpr; canvas.height = h * dpr;
    var c = canvas.getContext('2d');
    c.scale(dpr, dpr);

    var sx = w / map.cols, sy = h / map.rows;
    var s = Math.max(sx, sy);
    var offX = (w - map.cols * s) / 2, offY = (h - map.rows * s) / 2;

    c.fillStyle = '#2BB4D4'; c.fillRect(0, 0, w, h);
    for (var i = 0; i < map.cells.length; i++) {
      var cell = map.cells[i];
      var col = null;
      if (cell.t === T.ROOF)        col = cell.elev < 0.5 ? '#C6893A' : '#B0522F';
      else if (cell.t === T.TREE)   col = '#2E8B32';
      else if (cell.t === T.DEBRIS) col = '#54432F';
      else if (cell.t === T.EVAC)   col = '#57B01A';
      else if (cell.t === T.DOCK)   col = '#8FE0EE';
      else if (cell.t === T.WIRE)   col = '#FFC44F';
      else if (cell.cx || cell.cy)  col = '#1489B4';
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(offX + cell.x * s, offY + cell.y * s, s + 0.6, s + 0.6);
    }
    // soft vignette so the card art sits under the badges
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(10,30,40,.45)');
    g.addColorStop(0.45, 'rgba(10,30,40,0)');
    g.addColorStop(1, 'rgba(10,30,40,.25)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }

  BR.maps = {
    T: T, TILE: TILE, make: make,
    passable: passable, passableAt: passableAt,
    submergence: submergence, drawPreview: drawPreview
  };

})(window.BR);
