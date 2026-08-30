/* ============================================================
   Landing page — the robot's point of view.

   A first-person drive through a small world. The four site
   sections are gates on the track; everything else is scenery.
   Autonomy (pure pursuit over a waypoint loop) drives by default;
   take over with the arrow keys, WASD or a drag, and it hands
   control back after a few seconds idle.

   Rendered with a hand-rolled perspective projection on a 2D
   canvas — deliberately wireframe, so it reads like an RViz view
   rather than a game. No dependencies, no build step.
   ============================================================ */
(function () {
  'use strict';

  var root = document.getElementById('drive');
  if (!root || !root.querySelector) return;

  var canvas = root.querySelector('.drive__canvas');
  var mini   = root.querySelector('.drive__mini');
  if (!canvas || !canvas.getContext) return;

  var ctx  = canvas.getContext('2d');
  var mctx = mini ? mini.getContext('2d') : null;

  var el = {
    mode:   document.getElementById('hud-mode'),
    vel:    document.getElementById('hud-vel'),
    pose:   document.getElementById('hud-pose'),
    log:    document.getElementById('hud-log'),
    prompt: document.getElementById('hud-prompt'),
    plabel: document.getElementById('hud-prompt-label'),
    auto:   document.getElementById('hud-auto')
  };

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var basePath = root.getAttribute('data-base') || '';

  /* ---------- constants ---------- */
  var EYE = 0.62, NEAR = 0.25, FAR = 46;
  var RX = 20, RZ = 27;                 // track radii
  var W = 0, H = 0, focal = 0, horizon = 0, dpr = 1;
  var C = {};

  /* ---------- the track ---------- */
  var WP = [];
  for (var i = 0; i < 120; i++) {
    var u = (i / 120) * Math.PI * 2;
    WP.push({ x: RX * Math.sin(u), z: RZ * Math.cos(u) });
  }

  function trackPoint(t) {
    var u = t * Math.PI * 2;
    return { x: RX * Math.sin(u), z: RZ * Math.cos(u) };
  }
  function trackHeading(t) {
    var u = t * Math.PI * 2;
    return Math.atan2(RX * Math.cos(u), -RZ * Math.sin(u));
  }

  /* ---------- section gates ---------- */
  var GATES = [
    { t: 0.06, label: 'ABOUT',        href: basePath + '/about/' },
    { t: 0.31, label: 'RESEARCH',     href: basePath + '/research/' },
    { t: 0.56, label: 'PROJECTS',     href: basePath + '/projects/' },
    { t: 0.81, label: 'COMPETITIONS', href: basePath + '/competitions/' }
  ];
  GATES.forEach(function (g) {
    var p = trackPoint(g.t), a = trackHeading(g.t);
    g.x = p.x; g.z = p.z; g.a = a;
    g.rx = Math.cos(a); g.rz = -Math.sin(a);   // lateral axis
  });

  /* ---------- scenery ---------- */
  var seed = 20260830;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

  var PROPS = [];
  for (var k = 0; k < 46; k++) {
    var u2 = rnd() * Math.PI * 2;
    var inside = rnd() < 0.42;
    var s = inside ? 0.20 + rnd() * 0.52 : 1.18 + rnd() * 0.75;
    var px = RX * Math.sin(u2) * s;
    var pz = RZ * Math.cos(u2) * s;
    var kind = rnd();
    if (kind < 0.30)      PROPS.push({ x: px, z: pz, w: 0.9 + rnd(), h: 0.7 + rnd() * 0.7, d: 0.9 + rnd(), type: 'crate' });
    else if (kind < 0.55) PROPS.push({ x: px, z: pz, w: 0.42, h: 2.4 + rnd() * 2.6, d: 0.42, type: 'pillar' });
    else if (kind < 0.78) PROPS.push({ x: px, z: pz, w: 0.62, h: 0.72, d: 0.62, type: 'cone' });
    else                  PROPS.push({ x: px, z: pz, w: 1.5, h: 1.5, d: 0.1, type: 'marker', a: rnd() * Math.PI });
  }

  /* ---------- robot state ---------- */
  var cam = { x: 0, z: RZ, a: 0, v: 0 };
  (function () {
    var p = trackPoint(0.985);
    cam.x = p.x; cam.z = p.z; cam.a = trackHeading(0.985);
  })();

  var auto = true, idle = 0, steerIn = 0, throttleIn = 0, armed = null;
  var keys = {};
  var logLines = [];
  var logAt = 0, clock = 0;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    C = {
      grid:   cs.getPropertyValue('--tree').trim(),
      prop:   cs.getPropertyValue('--fg-muted').trim(),
      accent: cs.getPropertyValue('--accent').trim(),
      scan:   cs.getPropertyValue('--d-slam').trim(),
      fg:     cs.getPropertyValue('--fg').trim(),
      line:   cs.getPropertyValue('--border').trim(),
      bg:     cs.getPropertyValue('--bg').trim()
    };
  }

  /* ---------- projection ---------- */
  function toCam(x, y, z) {
    var dx = x - cam.x, dz = z - cam.z;
    var s = Math.sin(cam.a), c = Math.cos(cam.a);
    return { cx: dx * c - dz * s, cy: y - EYE, cz: dx * s + dz * c };
  }
  function fog(d) { var f = 1 - d / FAR; return f > 0 ? f * f : 0; }

  function clipNear(a, b) {
    if (a.cz >= NEAR && b.cz >= NEAR) return [a, b];
    if (a.cz < NEAR && b.cz < NEAR) return null;
    var t = (NEAR - a.cz) / (b.cz - a.cz);
    var m = { cx: a.cx + (b.cx - a.cx) * t, cy: a.cy + (b.cy - a.cy) * t, cz: NEAR };
    return a.cz < NEAR ? [m, b] : [a, m];
  }

  function seg(x1, y1, z1, x2, y2, z2, style, width, mul) {
    var r = clipNear(toCam(x1, y1, z1), toCam(x2, y2, z2));
    if (!r) return;
    var a = r[0], b = r[1];
    var al = fog((a.cz + b.cz) * 0.5) * (mul || 1);
    if (al < 0.015) return;
    ctx.globalAlpha = al > 1 ? 1 : al;
    ctx.strokeStyle = style;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(W / 2 + a.cx / a.cz * focal, horizon - a.cy / a.cz * focal);
    ctx.lineTo(W / 2 + b.cx / b.cz * focal, horizon - b.cy / b.cz * focal);
    ctx.stroke();
  }

  function box(x, y, z, w, h, d, style, width, mul) {
    var x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
    // verticals
    seg(x0, y, z0, x0, y1, z0, style, width, mul); seg(x1, y, z0, x1, y1, z0, style, width, mul);
    seg(x0, y, z1, x0, y1, z1, style, width, mul); seg(x1, y, z1, x1, y1, z1, style, width, mul);
    // top ring
    seg(x0, y1, z0, x1, y1, z0, style, width, mul); seg(x1, y1, z0, x1, y1, z1, style, width, mul);
    seg(x1, y1, z1, x0, y1, z1, style, width, mul); seg(x0, y1, z1, x0, y1, z0, style, width, mul);
    // base ring
    seg(x0, y, z0, x1, y, z0, style, width, mul * 0.6); seg(x1, y, z0, x1, y, z1, style, width, mul * 0.6);
    seg(x1, y, z1, x0, y, z1, style, width, mul * 0.6); seg(x0, y, z1, x0, y, z0, style, width, mul * 0.6);
  }

  function label(x, y, z, text, style, worldSize) {
    var p = toCam(x, y, z);
    if (p.cz < 1.2) return;
    var px = W / 2 + p.cx / p.cz * focal, py = horizon - p.cy / p.cz * focal;
    var size = worldSize * focal / p.cz;
    if (size < 7 || size > 120) return;
    var al = fog(p.cz);
    if (al < 0.05) return;
    ctx.globalAlpha = Math.min(1, al * 1.9);
    ctx.font = '500 ' + size.toFixed(1) + 'px "JetBrains Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = style;
    ctx.fillText(text, px, py);
  }

  /* ---------- lidar ---------- */
  var scan = [];
  function raycast() {
    scan.length = 0;
    var RANGE = 26, N = 96;
    for (var i = 0; i < N; i++) {
      var ang = cam.a + (-1.4 + (2.8 * i) / (N - 1));
      var dx = Math.sin(ang), dz = Math.cos(ang);
      var best = RANGE;
      for (var j = 0; j < PROPS.length; j++) {
        var o = PROPS[j];
        var t = slab(cam.x, cam.z, dx, dz, o.x - o.w / 2, o.x + o.w / 2, o.z - o.d / 2, o.z + o.d / 2);
        if (t > 0 && t < best) best = t;
      }
      for (var g = 0; g < GATES.length; g++) {
        var G = GATES[g];
        for (var sgn = -1; sgn <= 1; sgn += 2) {
          var pxp = G.x + G.rx * 2.1 * sgn, pzp = G.z + G.rz * 2.1 * sgn;
          var t2 = slab(cam.x, cam.z, dx, dz, pxp - 0.2, pxp + 0.2, pzp - 0.2, pzp + 0.2);
          if (t2 > 0 && t2 < best) best = t2;
        }
      }
      if (best < RANGE) scan.push({ x: cam.x + dx * best, z: cam.z + dz * best });
    }
  }
  function slab(ox, oz, dx, dz, minx, maxx, minz, maxz) {
    var t0 = -1e9, t1 = 1e9, a, b, tmp;
    if (Math.abs(dx) < 1e-6) { if (ox < minx || ox > maxx) return -1; }
    else { a = (minx - ox) / dx; b = (maxx - ox) / dx; if (a > b) { tmp = a; a = b; b = tmp; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(dz) < 1e-6) { if (oz < minz || oz > maxz) return -1; }
    else { a = (minz - oz) / dz; b = (maxz - oz) / dz; if (a > b) { tmp = a; a = b; b = tmp; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    return (t1 >= Math.max(t0, 0)) ? Math.max(t0, 0) : -1;
  }

  /* ---------- scene ---------- */
  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = 'round';

    // horizon
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, horizon); ctx.lineTo(W, horizon); ctx.stroke();

    // ground grid, snapped around the robot
    var gx = Math.round(cam.x / 3) * 3, gz = Math.round(cam.z / 3) * 3;
    for (var i = -14; i <= 14; i++) {
      seg(gx - 42, 0, gz + i * 3, gx + 42, 0, gz + i * 3, C.grid, 1, 1);
      seg(gx + i * 3, 0, gz - 42, gx + i * 3, 0, gz + 42, C.grid, 1, 1);
    }

    // the track itself, as a dashed centre line
    for (var w = 0; w < WP.length; w += 2) {
      var p0 = WP[w], p1 = WP[(w + 1) % WP.length];
      seg(p0.x, 0.015, p0.z, p1.x, 0.015, p1.z, C.accent, 1.4, 0.55);
    }

    // scenery
    for (var j = 0; j < PROPS.length; j++) {
      var o = PROPS[j];
      if (Math.abs(o.x - cam.x) > FAR || Math.abs(o.z - cam.z) > FAR) continue;
      if (o.type === 'cone') {
        var tipY = o.h, hw = o.w / 2;
        seg(o.x - hw, 0, o.z - hw, o.x, tipY, o.z, C.prop, 1, 0.85);
        seg(o.x + hw, 0, o.z - hw, o.x, tipY, o.z, C.prop, 1, 0.85);
        seg(o.x - hw, 0, o.z + hw, o.x, tipY, o.z, C.prop, 1, 0.85);
        seg(o.x + hw, 0, o.z + hw, o.x, tipY, o.z, C.prop, 1, 0.85);
        seg(o.x - hw, 0, o.z - hw, o.x + hw, 0, o.z - hw, C.prop, 1, 0.5);
        seg(o.x + hw, 0, o.z - hw, o.x + hw, 0, o.z + hw, C.prop, 1, 0.5);
        seg(o.x + hw, 0, o.z + hw, o.x - hw, 0, o.z + hw, C.prop, 1, 0.5);
        seg(o.x - hw, 0, o.z + hw, o.x - hw, 0, o.z - hw, C.prop, 1, 0.5);
      } else if (o.type === 'marker') {
        var mw = o.w / 2, ca = Math.cos(o.a) * mw, sa = Math.sin(o.a) * mw;
        seg(o.x - ca, 0.35, o.z - sa, o.x + ca, 0.35, o.z + sa, C.prop, 1, 0.9);
        seg(o.x - ca, 0.35 + o.h, o.z - sa, o.x + ca, 0.35 + o.h, o.z + sa, C.prop, 1, 0.9);
        seg(o.x - ca, 0.35, o.z - sa, o.x - ca, 0.35 + o.h, o.z - sa, C.prop, 1, 0.9);
        seg(o.x + ca, 0.35, o.z + sa, o.x + ca, 0.35 + o.h, o.z + sa, C.prop, 1, 0.9);
        seg(o.x - ca * 0.34, 0.35 + o.h * 0.33, o.z - sa * 0.34, o.x + ca * 0.34, 0.35 + o.h * 0.33, o.z + sa * 0.34, C.prop, 1, 0.55);
        seg(o.x - ca * 0.34, 0.35 + o.h * 0.66, o.z - sa * 0.34, o.x + ca * 0.34, 0.35 + o.h * 0.66, o.z + sa * 0.34, C.prop, 1, 0.55);
      } else {
        box(o.x, 0, o.z, o.w, o.h, o.d, C.prop, 1, o.type === 'pillar' ? 0.7 : 0.9);
      }
    }

    // lidar returns
    for (var s = 0; s < scan.length; s++) {
      var p = toCam(scan[s].x, 0.02, scan[s].z);
      if (p.cz < NEAR) continue;
      var al = fog(p.cz);
      if (al < 0.04) continue;
      ctx.globalAlpha = Math.min(0.85, al * 1.5);
      ctx.fillStyle = C.scan;
      var r = Math.max(1, 2.2 * focal / p.cz / 40);
      ctx.beginPath();
      ctx.arc(W / 2 + p.cx / p.cz * focal, horizon - p.cy / p.cz * focal, r + 0.8, 0, 6.2832);
      ctx.fill();
    }

    // section gates
    for (var g = 0; g < GATES.length; g++) {
      var G = GATES[g];
      var on = armed === g;
      var mul = on ? 1.6 : 1;
      var ax = G.x + G.rx * 2.1, az = G.z + G.rz * 2.1;
      var bx = G.x - G.rx * 2.1, bz = G.z - G.rz * 2.1;
      seg(ax, 0, az, ax, 3.4, az, C.accent, on ? 2 : 1.4, mul);
      seg(bx, 0, bz, bx, 3.4, bz, C.accent, on ? 2 : 1.4, mul);
      seg(ax, 3.4, az, bx, 3.4, bz, C.accent, on ? 2 : 1.4, mul);
      seg(ax, 3.05, az, bx, 3.05, bz, C.accent, 1, mul * 0.5);
      // floor threshold
      seg(ax, 0.02, az, bx, 0.02, bz, C.accent, on ? 2 : 1.2, mul);
      label(G.x, 3.9, G.z, G.label, C.accent, 0.42);
    }

    ctx.globalAlpha = 1;
  }

  /* ---------- minimap ---------- */
  function drawMini() {
    if (!mctx) return;
    var s = mini.clientWidth, half = s / 2, RANGE = 34;
    mctx.clearRect(0, 0, s, s);
    function m(x, z) { return [half + (x - cam.x) / RANGE * half, half - (z - cam.z) / RANGE * half]; }

    mctx.globalAlpha = 0.5; mctx.strokeStyle = C.grid; mctx.lineWidth = 1;
    mctx.beginPath();
    for (var i = 0; i < WP.length; i++) {
      var q = m(WP[i].x, WP[i].z);
      i ? mctx.lineTo(q[0], q[1]) : mctx.moveTo(q[0], q[1]);
    }
    mctx.closePath(); mctx.stroke();

    mctx.globalAlpha = 0.75; mctx.fillStyle = C.scan;
    for (var k2 = 0; k2 < scan.length; k2++) {
      var r = m(scan[k2].x, scan[k2].z);
      mctx.fillRect(r[0] - 1, r[1] - 1, 2, 2);
    }

    mctx.globalAlpha = 1; mctx.fillStyle = C.accent;
    for (var g = 0; g < GATES.length; g++) {
      var t = m(GATES[g].x, GATES[g].z);
      mctx.beginPath(); mctx.arc(t[0], t[1], armed === g ? 3.4 : 2.2, 0, 6.2832); mctx.fill();
    }

    mctx.save();
    mctx.translate(half, half);
    mctx.rotate(-cam.a);
    mctx.fillStyle = C.fg;
    mctx.beginPath(); mctx.moveTo(0, -5.5); mctx.lineTo(3.6, 4); mctx.lineTo(0, 2); mctx.lineTo(-3.6, 4);
    mctx.closePath(); mctx.fill();
    mctx.restore();
  }

  /* ---------- control ---------- */
  function nearestWP() {
    var best = 0, bd = 1e9;
    for (var i = 0; i < WP.length; i++) {
      var dx = WP[i].x - cam.x, dz = WP[i].z - cam.z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function step(dt) {
    var w = 0;
    if (auto) {
      var i = nearestWP();
      var target = WP[(i + 14) % WP.length];          // lookahead
      var dx = target.x - cam.x, dz = target.z - cam.z;
      var fwd = dx * Math.sin(cam.a) + dz * Math.cos(cam.a);
      var lat = dx * Math.cos(cam.a) - dz * Math.sin(cam.a);
      var alpha = Math.atan2(lat, fwd);
      var Ld = Math.sqrt(dx * dx + dz * dz);
      w = 2 * Math.sin(alpha) / Math.max(Ld, 1.5) * 4.2;
      cam.v += ((armed !== null ? 3.4 : 5.4) - cam.v) * Math.min(1, dt * 1.6);
    } else {
      w = steerIn * 1.25;
      cam.v += ((5.4 + throttleIn * 3.6) - cam.v) * Math.min(1, dt * 1.8);
      idle += dt;
      if (idle > 6) setAuto(true, 'idle timeout');
    }
    cam.a += w * dt;
    cam.x += Math.sin(cam.a) * cam.v * dt;
    cam.z += Math.cos(cam.a) * cam.v * dt;
    cam.w = w;

    // which gate, if any, is ahead and close
    var found = null;
    for (var g = 0; g < GATES.length; g++) {
      var G = GATES[g];
      var ddx = G.x - cam.x, ddz = G.z - cam.z;
      var d = Math.sqrt(ddx * ddx + ddz * ddz);
      var ahead = (ddx * Math.sin(cam.a) + ddz * Math.cos(cam.a)) > 0;
      if (d < 9 && ahead) found = g;
    }
    if (found !== armed) {
      armed = found;
      if (el.prompt) el.prompt.classList.toggle('is-on', armed !== null);
      if (armed !== null) {
        if (el.plabel) el.plabel.textContent = GATES[armed].label;
        if (el.prompt) el.prompt.setAttribute('href', GATES[armed].href);
        say('waypoint · ' + GATES[armed].label.toLowerCase() + ' in range');
      }
    }
  }

  function setAuto(on, why) {
    if (auto === on) return;
    auto = on;
    if (on) { steerIn = 0; throttleIn = 0; }
    idle = 0;
    if (el.mode) {
      el.mode.textContent = on ? 'AUTONOMOUS' : 'MANUAL';
      el.mode.classList.toggle('is-manual', !on);
    }
    if (el.auto) el.auto.setAttribute('aria-pressed', String(on));
    say(on ? 'autonomy engaged' + (why ? ' · ' + why : '') : 'operator override');
  }

  function say(line) {
    logLines.push('[' + clock.toFixed(1).padStart(6, ' ') + '] ' + line);
    while (logLines.length > 4) logLines.shift();
    if (el.log) el.log.textContent = logLines.join('\n');
  }

  /* ---------- input ---------- */
  function onKey(e, down) {
    var k = e.key.toLowerCase();
    var steer = (k === 'arrowleft' || k === 'a') ? -1 : (k === 'arrowright' || k === 'd') ? 1 : 0;
    var thr   = (k === 'arrowup' || k === 'w') ? 1 : (k === 'arrowdown' || k === 's') ? -1 : 0;
    if (!steer && !thr) {
      if (down && k === 'enter' && armed !== null) { window.location.href = GATES[armed].href; }
      return;
    }
    e.preventDefault();
    keys[k] = down;
    steerIn = (keys.arrowleft || keys.a ? -1 : 0) + (keys.arrowright || keys.d ? 1 : 0);
    throttleIn = (keys.arrowup || keys.w ? 1 : 0) + (keys.arrowdown || keys.s ? -1 : 0);
    if (down) { setAuto(false); idle = 0; }
  }
  window.addEventListener('keydown', function (e) { onKey(e, true); });
  window.addEventListener('keyup',   function (e) { onKey(e, false); });

  var dragging = false, dragX = 0;
  function pointerDown(e) { dragging = true; dragX = (e.touches ? e.touches[0] : e).clientX; setAuto(false); }
  function pointerMove(e) {
    if (!dragging) return;
    var x = (e.touches ? e.touches[0] : e).clientX;
    steerIn = Math.max(-1, Math.min(1, (x - dragX) / 140));
    idle = 0;
  }
  function pointerUp() { dragging = false; steerIn = 0; }
  canvas.addEventListener('mousedown', pointerDown);
  window.addEventListener('mousemove', pointerMove);
  window.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('touchstart', pointerDown, { passive: true });
  canvas.addEventListener('touchmove', pointerMove, { passive: true });
  canvas.addEventListener('touchend', pointerUp);
  if (el.auto) el.auto.addEventListener('click', function () { setAuto(true, 'manual request'); });

  /* ---------- loop ---------- */
  var last = 0, raf = null, scanAt = 0;
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now; clock += dt;

    step(dt);
    if (now - scanAt > 60) { raycast(); scanAt = now; }
    drawScene();
    drawMini();

    if (now - logAt > 900) {
      logAt = now;
      say('/cmd_vel  v ' + cam.v.toFixed(2) + '  w ' + (cam.w || 0).toFixed(2));
    }
    if (el.vel)  el.vel.textContent  = cam.v.toFixed(2) + ' m/s';
    if (el.pose) el.pose.textContent = 'x ' + cam.x.toFixed(1) + '  z ' + cam.z.toFixed(1) + '  θ ' + (((cam.a * 180 / Math.PI) % 360 + 360) % 360).toFixed(0) + '°';

    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !reduced) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop()  { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  function resize() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    focal = W * (W < 700 ? 0.72 : 0.62);
    horizon = H * 0.44;
    if (mini) {
      var ms = mini.clientWidth;
      mini.width = Math.round(ms * dpr); mini.height = Math.round(ms * dpr);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    readColors();
    raycast(); drawScene(); drawMini();
  }

  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(resize, 160); });
  document.addEventListener('themechange', function () { readColors(); drawScene(); drawMini(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
    }, { threshold: 0 }).observe(root);
  }

  resize();
  say('bringup complete · nav2 ready');
  say('autonomy engaged');
  start();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
})();
