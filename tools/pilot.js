/* A competent-but-not-perfect pilot: BFS over the tile grid so it follows
   the flooded streets like a player reading the map, greedy triage-weighted
   target choice, and it re-plans twice a second. */
module.exports = function makePilot(BR, g) {
  const TILE = BR.maps.TILE;
  let path = [], planCd = 0, planKey = '';
  const stat = { pickups: 0, dropoffs: 0, impacts: 0, dist: 0, stuck: 0, speedSum: 0, speedN: 0 };
  let stuckFrames = 0, lastPos = [0, 0];

  function cellOf(x, y) { return [Math.floor(x / TILE), Math.floor(y / TILE)]; }

  function bfs(sx, sy, tx, ty) {
    const map = g.map, wl = g.missionState.waterLevel;
    const W = map.cols, H = map.rows;
    const prev = new Int32Array(W * H).fill(-1);
    const seen = new Uint8Array(W * H);
    const q = [sy * W + sx];
    seen[sy * W + sx] = 1;
    const goal = ty * W + tx;
    let head = 0;
    while (head < q.length) {
      const cur = q[head++];
      if (cur === goal) break;
      const cx = cur % W, cy = (cur / W) | 0;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (seen[ni]) continue;
        const cell = map.at(nx, ny);
        // treat live wires as passable but expensive by simply avoiding them
        if (!BR.maps.passable(cell, wl) || (cell && cell.t === BR.maps.T.WIRE)) continue;
        seen[ni] = 1; prev[ni] = cur; q.push(ni);
      }
    }
    if (!seen[goal]) return null;
    const out = [];
    let cur = goal;
    while (cur !== -1 && cur !== sy * W + sx) {
      out.push([(cur % W) * TILE + TILE / 2, ((cur / W) | 0) * TILE + TILE / 2]);
      cur = prev[cur];
    }
    return out.reverse();
  }

  let committed = null;   // hysteresis: do not dither between two rescues
  const blacklist = {};   // targets that stalled us, parked for a while

  function chooseTarget() {
    const b = g.boat;
    if (g.aboard.length >= g.CAPACITY) { committed = null; return { x: g.map.dockCx, y: g.map.dockCy, dock: true }; }

    // stay on the current target unless it is gone or something is much better
    if (committed && committed.state === 'waiting' &&
        BR.rescue.canRescue(committed, g.inventory, false).ok &&
        (committed.found || g.mission.dark < 0.3)) {
      return { x: committed.x, y: committed.y, res: committed };
    }
    committed = null;

    let best = null, bestScore = Infinity;
    for (const r of g.roster) {
      if (r.state !== 'waiting') continue;
      if (!r.found && g.mission.dark >= 0.3) continue;
      if (!BR.rescue.canRescue(r, g.inventory, false).ok) continue;
      if ((blacklist[r.id] || 0) > g.missionState.elapsed) continue;
      const d = BR.dist(r.x, r.y, b.x, b.y);
      // urgency: a short remaining fuse pulls the target closer
      const urgency = 0.5 + 0.5 * (r.timer / r.timerMax);
      const s = d * urgency - r.score * 0.35;
      if (s < bestScore) { bestScore = s; best = r; }
    }
    if (best) { committed = best; return { x: best.x, y: best.y, res: best }; }
    if (g.aboard.length) return { x: g.map.dockCx, y: g.map.dockCy, dock: true };

    // Nothing takeable. The pilot must NOT peek at residents it has not
    // found — that would make the flashlight worthless and hide exactly the
    // difficulty the mission is supposed to create. Instead it sweeps the
    // barangay on a patrol grid, plus whatever bearing the radyo gave it.
    if (g.ping && g.ping.target && g.ping.target.state === 'waiting') {
      return { x: g.ping.target.x, y: g.ping.target.y, seek: true };
    }
    if (!patrol.length) buildPatrol();
    while (patrol.length && BR.dist(patrol[0][0], patrol[0][1], b.x, b.y) < 170) patrol.shift();
    if (!patrol.length) buildPatrol();
    if (patrol.length) return { x: patrol[0][0], y: patrol[0][1], seek: true };
    return { x: g.map.dockCx, y: g.map.dockCy, dock: true };
  }

  let patrol = [];
  function buildPatrol() {
    // a lawnmower sweep over the passable tiles, nearest-first
    const pts = [], wl = g.missionState.waterLevel;
    for (let y = 2; y < g.map.rows - 2; y += 4) {
      for (let x = 2; x < g.map.cols - 2; x += 4) {
        if (BR.maps.passable(g.map.at(x, y), wl)) pts.push([x * TILE, y * TILE]);
      }
    }
    const b = g.boat;
    pts.sort((p, q) => BR.dist(p[0], p[1], b.x, b.y) - BR.dist(q[0], q[1], b.x, b.y));
    patrol = pts;
  }

  let prevX = 0, prevY = 0, prevAboard = 0, prevRescued = 0;

  return function pilot(dt) {
    const b = g.boat, t = g.touch;
    stat.dist += BR.dist(b.x, b.y, prevX, prevY);
    prevX = b.x; prevY = b.y;
    if (g.aboard.length > prevAboard) stat.pickups += g.aboard.length - prevAboard;
    prevAboard = g.aboard.length;
    if (g.missionState.rescued > prevRescued) stat.dropoffs += g.missionState.rescued - prevRescued;
    prevRescued = g.missionState.rescued;

    planCd -= dt;
    const tgt = chooseTarget();
    const key = tgt.res ? tgt.res.id : (tgt.dock ? 'dock' : 'seek');
    if (planCd <= 0 || key !== planKey || !path.length) {
      planKey = key; planCd = 0.5;
      const [sx, sy] = cellOf(b.x, b.y);
      let [gx, gy] = cellOf(tgt.x, tgt.y);
      // A resident on a roof sits on an impassable tile, so route to the
      // nearest water tile beside them instead of to the roof itself.
      const wl = g.missionState.waterLevel;
      if (!BR.maps.passable(g.map.at(gx, gy), wl)) {
        let bd = Infinity, bx = null, by = null;
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
          const nx = gx + dx, ny = gy + dy;
          const cell = g.map.at(nx, ny);
          if (!BR.maps.passable(cell, wl)) continue;
          const d = BR.dist(nx, ny, b.x / TILE, b.y / TILE);
          if (d < bd) { bd = d; bx = nx; by = ny; }
        }
        if (bx !== null) { gx = bx; gy = by; }
      }
      path = bfs(sx, sy, gx, gy) || [];
    }

    // follow the path, skipping waypoints already behind us
    while (path.length > 1 && BR.dist(b.x, b.y, path[0][0], path[0][1]) < TILE * 0.7) path.shift();

    let wx, wy;
    if (path.length) { wx = path[0][0]; wy = path[0][1]; } else { wx = tgt.x; wy = tgt.y; }
    // on the final leg steer at the actual target, not the tile centre
    const dTarget = BR.dist(b.x, b.y, tgt.x, tgt.y);
    if (dTarget < TILE * 1.6) { wx = tgt.x; wy = tgt.y; }

    let dx = wx - b.x, dy = wy - b.y;
    const m = Math.hypot(dx, dy) || 1;
    dx /= m; dy /= m;

    t.active = true; t.x = dx; t.y = dy;
    // ease off the throttle on the final approach so we do not ram the roof
    if (dTarget < 52) { t.x *= 0.5; t.y *= 0.5; }
    t.sprint = b.stamina > 30 && dTarget > 180;
    t.action = dTarget < 68;
    if (dTarget < 68) g.setActionEdge();

    // stuck detector: moving less than 8 px/s while asking for full thrust
    const moved = BR.dist(b.x, b.y, lastPos[0], lastPos[1]);
    if (moved < 8 * dt && (Math.abs(t.x) + Math.abs(t.y)) > 0.4) {
      stuckFrames++;
      if (stuckFrames > 45) {
        stat.stuck++; stuckFrames = 0; path = []; planCd = 0;
        // do not fixate: park this target for a while and go do something else
        if (committed) blacklist[committed.id] = g.missionState.elapsed + 10;
        committed = null;
      }
    } else stuckFrames = 0;
    lastPos = [b.x, b.y];
    stat.speedSum += moved / dt; stat.speedN++;
    stat.targetKey = key;
    stat.dTarget = dTarget;
    stat.pathLen = path.length;
    stat.inputMag = Math.hypot(t.x, t.y);
    stat.tgtRes = tgt.res || null;

    const inv = g.inventory;
    if (inv.packed.includes('radyo') && inv.state.radyo.cd <= 0 &&
        g.roster.some(r => r.state === 'waiting' && !r.found)) g.useSupply(inv.packed.indexOf('radyo'));
    if (inv.packed.includes('tubig') && inv.state.tubig.charges > 0 && b.stamina < 10)
      g.useSupply(inv.packed.indexOf('tubig'));

    return stat;
  };
};
module.exports.stats = true;



