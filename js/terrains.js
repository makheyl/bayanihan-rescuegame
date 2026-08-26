/* =========================================================================
   TERRAQUA CLASH — terrains.js
   Five habitats, each a deterministic height field. Tiles are not flipped at
   random: every tile has a fixed elevation and the match has one global
   SEA LEVEL that rises and falls. A tile is land while its elevation is above
   sea level and shallow water below it, so Tide-Shift produces real moving
   coastlines instead of checkerboard noise.

   Below `voidLevel` the water is deep ocean — falling in eliminates you. In
   the closing seconds of a round voidLevel itself climbs, eroding the island
   from its edges inward. That is the shrinking safe zone, and it doubles as
   the SDG 14 message: the ground disappears as the sea rises.
   ========================================================================= */
(function (global) {
  'use strict';

  var TQ = global.TQ || (global.TQ = {});
  var U = TQ.util;

  /* Fixed logical arena — 48 × 27 tiles of 26px = 1248 × 702 (exactly 16:9).
     Physics is tuned against these world units; the canvas just scales it. */
  var GRID = { w: 48, h: 27, cell: 26 };
  var WORLD = { w: GRID.w * GRID.cell, h: GRID.h * GRID.cell };

  var TERRAINS = [
    {
      id: 'reef',
      name: 'Coral Reef',
      tagline: 'Shallow atolls · fast tide',
      sdg: [14],
      blurb: 'Scattered coral heads with almost no high ground. The tide turns quickly and land animals are on the back foot from the opening whistle.',
      fact: 'Coral reefs cover well under 1% of the ocean floor but support around a quarter of all marine species. Repeated marine heatwaves have already driven mass bleaching.',
      difficulty: 'Water-favoured',
      island: { radius: 1.02, falloff: 2.2 },
      // strong octaves relative to the radial falloff so the island breaks
      // into separate coral heads instead of one round blob
      octaves: [
        { a: 0.34, fx: 3.1, fy: 2.4, px: 0.4, py: 1.1 },
        { a: 0.22, fx: 5.7, fy: 4.9, px: 2.2, py: 0.3 },
        { a: 0.11, fx: 9.3, fy: 8.1, px: 1.0, py: 2.7 }
      ],
      seed: 1337, jitter: 0.05,
      // deep = share of tiles that are open ocean; landMid = share of the
      // island that is dry at mid tide; tideSwing = how much of the island
      // flips between low and high tide
      mix: { deep: 0.30, landMid: 0.34, tideSwing: 0.36, period: 9 },
      hazard: 'current', weather: 'clear',
      palette: {
        land: '#FFD886', landDk: '#E8B45E', landLt: '#FFF0C4',
        water: '#13D0EC', waterDk: '#05C1E0', deep: '#00648C',
        foam: '#DFFAFF', accent: '#FF7B9C', flora: '#FF9EB5', sky: '#85DDFF'
      }
    },
    {
      id: 'mangrove',
      name: 'Mangrove Delta',
      tagline: 'Braided channels · root pillars',
      sdg: [14, 15],
      blurb: 'Land and water braid together in long channels, and mangrove root pillars block the obvious routes. Where land and sea meet, neither class dominates.',
      fact: 'Mangroves lock away several times more carbon per hectare than tropical rainforest and blunt storm surge before it reaches shore — yet a third of them have been cleared in fifty years.',
      difficulty: 'Balanced',
      island: { radius: 1.12, falloff: 2.6 },
      // one high-frequency X octave against a low-frequency Y one carves the
      // long vertical channels the delta is named for
      octaves: [
        { a: 0.50, fx: 4.6, fy: 0.9, px: 1.3, py: 0.2 },
        { a: 0.20, fx: 1.4, fy: 3.3, px: 0.7, py: 2.4 },
        { a: 0.11, fx: 7.9, fy: 2.1, px: 2.9, py: 1.5 }
      ],
      seed: 8821, jitter: 0.04,
      mix: { deep: 0.26, landMid: 0.50, tideSwing: 0.34, period: 12 },
      hazard: 'pillar', weather: 'rain',
      palette: {
        land: '#9BC46A', landDk: '#6F9E47', landLt: '#C7E39A',
        water: '#31B9AE', waterDk: '#1C8F92', deep: '#0C4F5C',
        foam: '#D8F5EC', accent: '#8A5A32', flora: '#4A7C3F', sky: '#A6E1FF'
      }
    },
    {
      id: 'arctic',
      name: 'Arctic Ice Shelf',
      tagline: 'Solid floe · it cracks under you',
      sdg: [14],
      blurb: 'One broad plate of sea ice — the most land on any map. But floes crumble permanently where animals linger, and what breaks never comes back.',
      fact: 'Arctic summer sea ice is retreating by roughly 13% per decade. Every species that hunts, breeds or rests on that ice loses ground with it.',
      difficulty: 'Land-favoured',
      island: { radius: 1.24, falloff: 3.4 },
      octaves: [
        { a: 0.13, fx: 1.9, fy: 1.6, px: 0.9, py: 1.9 },
        { a: 0.07, fx: 3.7, fy: 3.1, px: 2.6, py: 0.6 }
      ],
      seed: 424242, jitter: 0.03,
      mix: { deep: 0.22, landMid: 0.66, tideSwing: 0.32, period: 14 },
      hazard: 'crumble', weather: 'snow',
      palette: {
        land: '#F2FAFF', landDk: '#C4E2F2', landLt: '#FFFFFF',
        water: '#57C8E8', waterDk: '#2E9CCC', deep: '#0A3E63',
        foam: '#FFFFFF', accent: '#9AD8F0', flora: '#BFE6F5', sky: '#BFE9FF'
      }
    },
    {
      id: 'savanna',
      name: 'Savanna Waterhole',
      tagline: 'Dry plain · one shrinking pool',
      sdg: [15],
      blurb: 'Wide open ground around a single central waterhole that swells and shrinks. Land animals rule here — until the pool floods outward.',
      fact: 'In the dry season entire savanna food webs funnel into a handful of shrinking waterholes, which is exactly when competition between species peaks.',
      difficulty: 'Land-favoured',
      island: { radius: 1.16, falloff: 3.0 },
      octaves: [
        { a: 0.12, fx: 2.3, fy: 2.9, px: 1.7, py: 0.8 },
        { a: 0.06, fx: 5.1, fy: 4.3, px: 0.2, py: 2.2 }
      ],
      centerDip: { a: 0.62, s: 0.42 },
      seed: 5150, jitter: 0.035,
      mix: { deep: 0.24, landMid: 0.64, tideSwing: 0.34, period: 15 },
      hazard: 'geyser', weather: 'heat',
      palette: {
        land: '#E8C06A', landDk: '#C2924A', landLt: '#F7DC9C',
        water: '#3FB6D6', waterDk: '#2489B0', deep: '#0B4257',
        foam: '#DDF3FA', accent: '#B5651D', flora: '#7D9A3F', sky: '#FFD98A'
      }
    },
    {
      id: 'rainforest',
      name: 'Rainforest Basin',
      tagline: 'Flooded forest · falling timber',
      sdg: [15],
      blurb: 'A basin that drains and refills under permanent rain. Traction is poor for everyone, and dead timber comes down without much warning.',
      fact: 'Rainforests hold over half of all land species on about 6% of the land surface. Clearing for agriculture remains the single largest driver of their loss.',
      difficulty: 'Balanced',
      island: { radius: 1.10, falloff: 2.4 },
      octaves: [
        { a: 0.21, fx: 2.7, fy: 3.4, px: 2.1, py: 1.4 },
        { a: 0.11, fx: 5.3, fy: 4.1, px: 0.6, py: 2.8 },
        { a: 0.05, fx: 8.7, fy: 7.3, px: 1.9, py: 0.5 }
      ],
      seed: 90210, jitter: 0.045,
      mix: { deep: 0.26, landMid: 0.52, tideSwing: 0.38, period: 11 },
      hazard: 'falling', weather: 'rain',
      palette: {
        land: '#5E9E4A', landDk: '#3E7534', landLt: '#8CC46A',
        water: '#3A9E9A', waterDk: '#217173', deep: '#0A3A3E',
        foam: '#CDEDE2', accent: '#7A4A28', flora: '#2F5F2A', sky: '#9BD9C8'
      }
    }
  ];

  TERRAINS.forEach(function (t) {
    // typo guard — keep palettes valid even if a hex slips through
    Object.keys(t.palette).forEach(function (k) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(t.palette[k])) t.palette[k] = '#8FA23F';
    });
    deriveTide(t);
  });

  /* ------------------------------------------------------- height field */

  function buildHeight(def) {
    var W = GRID.w, H = GRID.h;
    var raw = new Float32Array(W * H);
    var rng = U.seeded(def.seed);
    var i, gx, gy;

    for (gy = 0; gy < H; gy++) {
      for (gx = 0; gx < W; gx++) {
        var nx = (gx + 0.5) / W, ny = (gy + 0.5) / H;
        var dx = (nx - 0.5) * 2, dy = (ny - 0.5) * 2;
        var d = Math.sqrt(dx * dx + dy * dy * 1.05);

        var h = 1 - Math.pow(U.clamp(d / def.island.radius, 0, 1), def.island.falloff);

        for (i = 0; i < def.octaves.length; i++) {
          var o = def.octaves[i];
          h += o.a * Math.sin(nx * o.fx * Math.PI * 2 + o.px) * Math.cos(ny * o.fy * Math.PI * 2 + o.py);
        }
        if (def.centerDip) h -= def.centerDip.a * Math.exp(-(d * d) / (def.centerDip.s * def.centerDip.s));
        h += (rng() - 0.5) * (def.jitter || 0);

        raw[gy * W + gx] = h;
      }
    }

    // one box blur pass so the coastline reads as terrain, not noise
    var out = new Float32Array(W * H);
    for (gy = 0; gy < H; gy++) {
      for (gx = 0; gx < W; gx++) {
        var sum = 0, n = 0;
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var sx = gx + ox, sy = gy + oy;
            if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
            sum += raw[sy * W + sx]; n++;
          }
        }
        out[gy * W + gx] = U.clamp(sum / n, 0, 1);
      }
    }

    // hard border of deep ocean so nobody can hug the world edge
    for (gy = 0; gy < H; gy++) {
      for (gx = 0; gx < W; gx++) {
        var edge = Math.min(gx, gy, W - 1 - gx, H - 1 - gy);
        if (edge < 2) out[gy * W + gx] = Math.min(out[gy * W + gx], 0.02 + edge * 0.03);
      }
    }

    /* Normalise to percentile rank.
       Tuning sine amplitudes by hand gave wildly different land/water splits
       per map — the Arctic ended up 3% water, which strands a water animal
       the moment it spawns. Remapping every tile to its rank makes heights
       uniform in [0,1], so `deep` / `landMid` / `tideSwing` below mean an
       exact fraction of tiles on every map. Ordering is untouched, so the
       island keeps the organic shape the noise gave it. */
    var order = new Array(out.length);
    for (i = 0; i < out.length; i++) order[i] = i;
    order.sort(function (a, b) { return out[a] - out[b]; });
    var ranked = new Float32Array(out.length);
    var last = out.length - 1;
    for (i = 0; i < order.length; i++) ranked[order[i]] = last === 0 ? 0.5 : i / last;
    return ranked;
  }

  /* Turn each terrain's declared mix into concrete waterline values.
     land fraction of the island = (1 - seaLevel) / (1 - deep). */
  function deriveTide(def) {
    var m = def.mix;
    var span = 1 - m.deep;                       // share of tiles that are island
    var mid = 1 - m.landMid * span;              // sea level giving landMid
    var amp = (m.tideSwing * span) / 2;
    def.voidLevel = m.deep;
    def.tide = {
      min: U.clamp(mid - amp, m.deep + 0.02, 0.98),
      max: U.clamp(mid + amp, m.deep + 0.04, 0.98),
      period: m.period
    };
    def.span = span;
  }

  /* --------------------------------------------------------- arena build */

  function buildArena(terrainId) {
    var def = byId(terrainId);
    var height = buildHeight(def);
    var W = GRID.w, H = GRID.h, cell = GRID.cell;
    var rng = U.seeded(def.seed + 7);

    var arena = {
      def: def,
      W: W, H: H, cell: cell,
      world: { w: WORLD.w, h: WORLD.h },
      height: height,
      base: Float32Array.from(height),   // pristine copy; `height` may erode
      seaLevel: (def.tide.min + def.tide.max) / 2,
      voidLevel: def.voidLevel,
      pillars: [],
      geysers: [],
      flora: []
    };

    function heightAtTile(gx, gy) { return height[gy * W + gx]; }

    // scatter static decoration on stable high ground
    var tries = 0;
    while (arena.flora.length < 46 && tries++ < 900) {
      var fx = Math.floor(rng() * W), fy = Math.floor(rng() * H);
      var fh = heightAtTile(fx, fy);
      if (fh < def.tide.max + 0.06) continue;
      arena.flora.push({
        x: (fx + rng()) * cell, y: (fy + rng()) * cell,
        s: 0.6 + rng() * 0.8, k: rng(), h: fh
      });
    }

    // hazard placement
    if (def.hazard === 'pillar') {
      tries = 0;
      while (arena.pillars.length < 9 && tries++ < 600) {
        var px = 4 + Math.floor(rng() * (W - 8)), py = 3 + Math.floor(rng() * (H - 6));
        var ph = heightAtTile(px, py);
        if (ph < def.tide.min - 0.04) continue;
        var wx = (px + 0.5) * cell, wy = (py + 0.5) * cell;
        var clash = arena.pillars.some(function (p) { return U.dist(p.x, p.y, wx, wy) < 130; });
        if (clash) continue;
        arena.pillars.push({ x: wx, y: wy, r: 20 + rng() * 12 });
      }
    }
    if (def.hazard === 'geyser') {
      tries = 0;
      while (arena.geysers.length < 6 && tries++ < 600) {
        var gx2 = 5 + Math.floor(rng() * (W - 10)), gy2 = 4 + Math.floor(rng() * (H - 8));
        var gh = heightAtTile(gx2, gy2);
        if (gh < def.tide.max) continue;
        var wx2 = (gx2 + 0.5) * cell, wy2 = (gy2 + 0.5) * cell;
        if (arena.geysers.some(function (g) { return U.dist(g.x, g.y, wx2, wy2) < 190; })) continue;
        arena.geysers.push({ x: wx2, y: wy2, r: 46, phase: rng() * 6, period: 6.5 + rng() * 3, state: 0 });
      }
    }
    return arena;
  }

  /* Tile classification for a world position. */
  function tileAt(arena, wx, wy) {
    var gx = Math.floor(wx / arena.cell), gy = Math.floor(wy / arena.cell);
    if (gx < 0 || gy < 0 || gx >= arena.W || gy >= arena.H) return 'void';
    var h = arena.height[gy * arena.W + gx];
    if (h < arena.voidLevel) return 'void';
    return h >= arena.seaLevel ? 'land' : 'water';
  }
  function heightAt(arena, wx, wy) {
    var gx = U.clamp(Math.floor(wx / arena.cell), 0, arena.W - 1);
    var gy = U.clamp(Math.floor(wy / arena.cell), 0, arena.H - 1);
    return arena.height[gy * arena.W + gx];
  }

  /* ------------------------------------------------------------ painting
     Land and shallow water are each drawn as ONE path made of overlapping
     circles — the union reads as an organic coastline instead of a grid,
     and it is two fills per frame rather than a thousand rects.            */

  function paintTerrain(ctx, arena, opts) {
    opts = opts || {};
    var scale = opts.scale || 1;
    var cell = arena.cell * scale;
    var W = arena.W, H = arena.H;
    var p = arena.def.palette;
    var t = opts.t || 0;
    var blobR = cell * 0.80;

    var w = W * cell, h = H * cell;

    // deep ocean floor
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.deep);
    g.addColorStop(1, shade(p.deep, -18));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // moving glints on the deep water
    if (opts.detail !== false) {
      ctx.save();
      ctx.globalAlpha = 0.12; ctx.strokeStyle = '#BFF0FF'; ctx.lineWidth = Math.max(1, 2 * scale);
      for (var s = 0; s < 14; s++) {
        var sy = ((s * 71 + t * 14) % (h + 60)) - 30;
        ctx.beginPath();
        ctx.moveTo((s * 137) % w, sy);
        ctx.lineTo(((s * 137) % w) + 46 * scale, sy + 8 * scale);
        ctx.stroke();
      }
      ctx.restore();
    }

    var gx, gy, hh, cx, cy;

    /* Land and water are unions of overlapping circles, which gives an
       organic coastline instead of a grid. They must only ever be FILLED:
       stroking such a path outlines every individual circle and the island
       turns into chainmail. To get an outline, fill a slightly larger copy
       of the same path behind it — overlapping fills union correctly. */
    function blobPath(radius, test) {
      var p = new Path2D();
      for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var h = arena.height[y * W + x];
          if (!test(h)) continue;
          var px = (x + 0.5) * cell, py = (y + 0.5) * cell;
          p.moveTo(px + radius, py);
          p.arc(px, py, radius, 0, Math.PI * 2);
        }
      }
      return p;
    }

    var voidLv = arena.voidLevel, seaLv = arena.seaLevel;
    var isIsland = function (h) { return h >= voidLv; };
    var isLand = function (h) { return h >= seaLv && h >= voidLv; };

    // --- shallow water (everything above voidLevel) ---
    var shallow = blobPath(blobR, isIsland);
    ctx.fillStyle = p.waterDk;
    ctx.fill(shallow);
    ctx.save();
    ctx.clip(shallow);
    var wg = ctx.createLinearGradient(0, 0, 0, h);
    wg.addColorStop(0, p.water);
    wg.addColorStop(1, p.waterDk);
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, h);
    if (opts.detail !== false) {
      ctx.globalAlpha = 0.22; ctx.strokeStyle = p.foam;
      ctx.lineWidth = Math.max(1, 2.4 * scale);
      for (var r2 = 0; r2 < 10; r2++) {
        var ry = (r2 / 10) * h + Math.sin(t * 0.8 + r2) * 10 * scale;
        ctx.beginPath();
        for (var xx = 0; xx <= w; xx += 26 * scale) {
          var yy = ry + Math.sin(xx * 0.012 / scale + t * 1.4 + r2) * 5 * scale;
          if (xx === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
    }
    ctx.restore();

    // --- land (everything above the current sea level) ---
    var anyLand = false;
    for (gy = 0; gy < H && !anyLand; gy++) {
      for (gx = 0; gx < W; gx++) {
        if (isLand(arena.height[gy * W + gx])) { anyLand = true; break; }
      }
    }
    var land = blobPath(blobR, isLand);

    if (anyLand) {
      // wet sand just under the waterline
      var halo = blobPath(blobR, function (h) { return h >= seaLv - 0.05 && h < seaLv; });
      ctx.save();
      ctx.globalAlpha = 0.55; ctx.fillStyle = p.landDk; ctx.fill(halo);
      ctx.restore();

      // silhouette, painted outward-in so the outline is the union's edge
      var foamW = Math.max(2.5, 7 * scale);
      var rimW = Math.max(1.2, 2.8 * scale);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = p.foam;
      ctx.fill(blobPath(blobR + foamW, isLand));
      ctx.restore();
      ctx.fillStyle = 'rgba(30,50,40,.45)';
      ctx.fill(blobPath(blobR + rimW, isLand));
      ctx.fillStyle = p.land;
      ctx.fill(land);

      // height shading inside the land mass
      ctx.save();
      ctx.clip(land);
      for (gy = 0; gy < H; gy++) {
        for (gx = 0; gx < W; gx++) {
          hh = arena.height[gy * W + gx];
          if (hh < seaLv) continue;
          var lift = U.clamp((hh - seaLv) / 0.34, 0, 1);
          if (lift < 0.3) continue;
          ctx.globalAlpha = lift * 0.34;
          ctx.fillStyle = p.landLt;
          ctx.beginPath();
          ctx.arc((gx + 0.5) * cell, (gy + 0.5) * cell, blobR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // decoration
      if (opts.detail !== false) {
        ctx.save();
        ctx.clip(land);
        arena.flora.forEach(function (f) {
          if (f.h < arena.seaLevel) return;
          var fx = f.x * scale, fy = f.y * scale, fs = f.s * scale;
          ctx.fillStyle = p.flora;
          if (f.k < 0.4) {
            ctx.beginPath();
            ctx.ellipse(fx, fy, 7 * fs, 9 * fs, Math.sin(t + f.k * 9) * 0.12, 0, Math.PI * 2);
            ctx.fill();
          } else if (f.k < 0.75) {
            ctx.beginPath();
            ctx.moveTo(fx - 6 * fs, fy + 6 * fs);
            ctx.quadraticCurveTo(fx, fy - 12 * fs, fx + 6 * fs, fy + 6 * fs);
            ctx.fill();
          } else {
            ctx.fillStyle = p.accent;
            ctx.beginPath();
            ctx.ellipse(fx, fy, 6 * fs, 4.5 * fs, f.k * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
        ctx.restore();
      }
    }

    // --- static hazards ---
    if (opts.detail !== false) {
      arena.pillars.forEach(function (pl) {
        var px = pl.x * scale, py = pl.y * scale, pr = pl.r * scale;
        ctx.beginPath(); ctx.ellipse(px, py + pr * 0.5, pr * 1.1, pr * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10,40,45,.3)'; ctx.fill();
        ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = p.accent; ctx.fill();
        ctx.lineWidth = Math.max(2, 3.4 * scale); ctx.strokeStyle = 'rgba(35,20,10,.65)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(px - pr * 0.25, py - pr * 0.25, pr * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fill();
      });
    }

    // handed back so the caller can cache this render and still stroke a
    // live, animated shoreline on top of the cached bitmap each frame
    return { land: anyLand ? land : null, shallow: shallow };
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = U.clamp(((n >> 16) & 255) + amt, 0, 255);
    var g = U.clamp(((n >> 8) & 255) + amt, 0, 255);
    var b = U.clamp((n & 255) + amt, 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Small preview for the terrain-select cards. */
  function drawPreview(canvas, terrainId) {
    var arena = buildArena(terrainId);
    arena.seaLevel = (arena.def.tide.min + arena.def.tide.max) / 2;
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 170;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext('2d');
    var scale = w / WORLD.w;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    // preview canvas is 16:9 like the arena, so a single uniform scale fits
    paintTerrain(ctx, arena, { scale: 1, t: 0, detail: true });
  }

  var index = {};
  TERRAINS.forEach(function (t) { index[t.id] = t; });
  function byId(id) { return index[id] || TERRAINS[0]; }

  TQ.terrains = {
    list: TERRAINS,
    byId: byId,
    GRID: GRID,
    WORLD: WORLD,
    buildArena: buildArena,
    tileAt: tileAt,
    heightAt: heightAt,
    paintTerrain: paintTerrain,
    drawPreview: drawPreview,
    shade: shade
  };

}(window));
