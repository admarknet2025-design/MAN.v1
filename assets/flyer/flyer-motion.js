/* DMC 2026 animated flyer: a six-second video of the participant flyer, recorded in the browser (no upload, no server).
 *
 *   DMCFlyerMotion.DURATION                     → 6 (seconds)
 *   DMCFlyerMotion.at(t)                        → the motion parameters at time t (pure: same t, same parameters)
 *   DMCFlyerMotion.frame(ctx, state, t)         → draws the frame at time t (flyer-render.js + the sheen); frame(ctx, s, DURATION)
 *                                                 is the still picture, pixel for pixel
 *   DMCFlyerMotion.support()                    → { ok, mime, ext, reason }: MP4 where the browser can make it, WebM only as a fallback
 *   DMCFlyerMotion.record(state, { onProgress }) → Promise<{ blob, mime, ext, seconds }>
 *
 * Motion (nothing else moves; the strap and the card stay still): the hero planes drift slowly behind; the nameplate, the role
 * chip and the I'M BUILDING line fade in one after another; a soft diagonal sheen crosses the card twice, left to right. The sheen
 * is clipped to the card, never crosses the QR code, is faint over the photo, and is white (never gold); the partner band is
 * drawn by the renderer and is never touched. From 5.4 s the frame is the still.
 *
 * Opt-in: the flyer tool shows the MP4 button only when mounted with { video: true } (the public attendee tool). The team tool can
 * switch it on later with the same flag. */
(function (root) {
'use strict';

var T = 6, FPS = 30, BITRATE = 3000000;
var DRIFT_END = 5.4;                                      /* the planes are back in place here; the last 0.6 s is the still */
var PASSES = [[1.7, 1.5], [3.5, 1.5]];                    /* sheen: [start, length] in seconds */
var TYPES = [
  ['video/mp4;codecs=avc1.640028', 'mp4'], ['video/mp4;codecs=avc1.4d0028', 'mp4'], ['video/mp4;codecs=avc1.42E01E', 'mp4'],
  ['video/mp4;codecs=avc1', 'mp4'], ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'], ['video/webm;codecs=vp8', 'webm'], ['video/webm', 'webm']
];

function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function ease(x) { x = clamp(x); return x * x * (3 - 2 * x); }
function swell(u) { u = clamp(u); return 0.5 - 0.5 * Math.cos(2 * Math.PI * u); }   /* 0 → 1 → 0, still at both ends */

/* The one timeline. Every value is a pure function of t; at t >= DRIFT_END everything is at rest (null = draw the still). */
function at(t) {
  if (!(t < DRIFT_END)) return null;
  var sheen = [];
  PASSES.forEach(function (p) { var u = (t - p[0]) / p[1]; if (u > 0 && u < 1) sheen.push(u); });
  return {
    g1: swell(t / DRIFT_END), g2: swell((t - 0.4) / (DRIFT_END - 0.4)),
    plate: ease((t - 0.3) / 0.7), chip: ease((t - 0.9) / 0.6), iam: ease((t - 1.4) / 0.6),
    sheen: sheen
  };
}

/* the sheen: a soft diagonal band (tilted like light on glossy paper) with a hairline streak, moving left to right */
function sheen(ctx, info, u, hasPhoto) {
  var c = info.card; if (!c) return;
  var photo = hasPhoto ? info.photo : null;          /* without a photo the colour block takes the full sheen */
  var I = root.DMCFlyer._internal, white = I.white;
  var env = Math.sin(Math.PI * u);                                     /* fades in and out at the card's edges */
  var span = c.w + c.h * 0.5, bw = Math.max(220, c.w * 0.42);
  var cx = c.x - bw + u * (span + 2 * bw) - c.h * 0.25;                /* the band's centre on the card's vertical middle */
  var path = function (holes) {
    I.rrPath(ctx, c.x, c.y, c.w, c.h, c.r || 0);
    holes.forEach(function (r) { if (r) ctx.rect(r.x - 10, r.y - 10, r.w + 20, r.h + 20); });
  };
  var paint = function (k) {
    /* gradient along (1, -0.5): the band leans right as it rises */
    var dx = 1, dy = -0.5, n = Math.sqrt(dx * dx + dy * dy); dx /= n; dy /= n;
    var mx = cx, my = c.y + c.h / 2;
    var g = ctx.createLinearGradient(mx - dx * bw, my - dy * bw, mx + dx * bw, my + dy * bw);
    g.addColorStop(0, white(0)); g.addColorStop(0.30, white(0.10 * k)); g.addColorStop(0.47, white(0.42 * k)); g.addColorStop(0.5, white(0.62 * k));
    g.addColorStop(0.53, white(0.30 * k)); g.addColorStop(0.66, white(0.08 * k)); g.addColorStop(1, white(0));
    ctx.fillStyle = g; ctx.fillRect(c.x, c.y, c.w, c.h);
  };
  ctx.save();
  ctx.beginPath(); path([info.qr, photo]); ctx.clip('evenodd');        /* the card, minus the QR and the photo */
  paint(env);
  ctx.restore();
  if (photo) {                                                              /* faint over the face */
    var p = photo;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    if (info.qr) { ctx.beginPath(); ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height); var q = info.qr; ctx.rect(q.x - 10, q.y - 10, q.w + 20, q.h + 20); ctx.clip('evenodd'); }
    I.rrPath(ctx, c.x, c.y, c.w, c.h, c.r || 0); ctx.clip();
    paint(env * 0.3);
    ctx.restore();
  }
}

function frame(ctx, state, t) {
  var R = root.DMCFlyer, m = at(t);
  var res = R.renderFlyer(ctx, state, m ? { motion: m } : null);
  if (m && m.sheen.length) m.sheen.forEach(function (u) { sheen(ctx, res.info, u, !!state.photo); });
  return res;
}

function supported() {
  var MR = root.MediaRecorder, cv = root.HTMLCanvasElement, out = [];
  if (!MR || !cv || !cv.prototype.captureStream) return out;
  for (var i = 0; i < TYPES.length; i++) {
    var ok = false;
    try { ok = !MR.isTypeSupported || MR.isTypeSupported(TYPES[i][0]); } catch (e) { ok = false; }
    if (ok) out.push({ ok: true, mime: TYPES[i][0], ext: TYPES[i][1] });
  }
  return out;
}
function support() {
  var MR = root.MediaRecorder, cv = root.HTMLCanvasElement;
  if (!MR || !cv || !cv.prototype.captureStream) return { ok: false, reason: 'unsupported' };
  return supported()[0] || { ok: false, reason: 'no-format' };
}

/* Records the timeline in real time: each animation frame draws frame(t) for the wall-clock t, so a slow device drops frames
   instead of stretching the video. The canvas is off screen; the preview is not touched. */
/* Tries the best supported format; if the encoder refuses it (some phones list H.264 High but cannot encode it at 1080 × 1920),
   the next supported format is tried once more before giving up. */
function record(state, opts) {
  var list = supported(), sup = support();
  if (!sup.ok) return Promise.reject(new Error(sup.reason));
  var tries = list.slice(0, 3);
  var attempt = function (k) {
    return recordOnce(state, opts, tries[k]).catch(function (err) {
      if (err && (err.message === 'hidden' || err.message === 'timeout') || k + 1 >= tries.length) throw err;
      return attempt(k + 1);
    });
  };
  return attempt(0);
}
function recordOnce(state, opts, sup) {
  opts = opts || {};
  var S = Object.assign({}, state);
  return root.DMCFlyer.load().then(function () {
    return new Promise(function (resolve, reject) {
      var cv = document.createElement('canvas');
      cv.width = 1080; cv.height = S.format === '9:16' ? 1920 : 1350;
      cv.setAttribute('aria-hidden', 'true');
      cv.style.cssText = 'position:fixed;left:-20000px;top:0;width:8px;height:8px;opacity:0;pointer-events:none';
      document.body.appendChild(cv);
      var ctx = cv.getContext('2d'), stream, track, manual, rec, chunks = [], done = false, raf = 0, guard = 0, t0 = 0;
      var finish = function (err, val) {
        if (done) return; done = true;
        cancelAnimationFrame(raf); clearTimeout(guard);
        document.removeEventListener('visibilitychange', onVis);
        try { stream && stream.getTracks().forEach(function (k) { k.stop(); }); } catch (e) {}
        cv.remove();
        if (err) reject(err); else resolve(val);
      };
      var onVis = function () { if (document.hidden && rec && rec.state === 'recording') { try { rec.stop(); } catch (e) {} finish(new Error('hidden')); } };
      try {
        frame(ctx, S, 0);
        stream = cv.captureStream(0);
        track = stream.getVideoTracks()[0];
        manual = !!(track && typeof track.requestFrame === 'function');
        if (!manual) { stream.getTracks().forEach(function (k) { k.stop(); }); stream = cv.captureStream(FPS); track = stream.getVideoTracks()[0]; }
        rec = new root.MediaRecorder(stream, { mimeType: sup.mime, videoBitsPerSecond: BITRATE });
      } catch (e) { return finish(e); }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { finish((e && e.error) || new Error('recorder')); };
      rec.onstop = function () {
        if (done) return;
        var type = (rec.mimeType || sup.mime).split(';')[0] || (sup.ext === 'mp4' ? 'video/mp4' : 'video/webm');
        var blob = new Blob(chunks, { type: type });
        if (!blob.size) return finish(new Error('empty'));
        finish(null, { blob: blob, mime: type, ext: /mp4/.test(type) ? 'mp4' : 'webm', seconds: T });
      };
      document.addEventListener('visibilitychange', onVis);
      var last = -1;
      var tick = function (now) {
        if (done) return;
        var t = Math.min(T, (now - t0) / 1000), fi = Math.floor(t * FPS);
        if (fi !== last) {
          last = fi;
          try { frame(ctx, S, fi / FPS); } catch (e) { try { rec.stop(); } catch (x) {} return finish(e); }
          if (manual) track.requestFrame();
          if (opts.onProgress) opts.onProgress(Math.min(1, t / T));
        }
        if (t >= T) {
          frame(ctx, S, T); if (manual) track.requestFrame();              /* the still, last; held one more frame so the file runs the full 6 s */
          setTimeout(function () {
            if (done) return;
            if (manual) track.requestFrame();
            setTimeout(function () { if (!done) { try { rec.stop(); } catch (e) { finish(e); } } }, 1000 / FPS);
          }, 1000 / FPS);
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      try { rec.start(1000); } catch (e) { return finish(e); }
      guard = setTimeout(function () { try { rec.stop(); } catch (e) {} finish(new Error('timeout')); }, (T + 20) * 1000);
      raf = requestAnimationFrame(function (now) { t0 = now; tick(now); });
    });
  });
}

root.DMCFlyerMotion = { DURATION: T, FPS: FPS, at: at, frame: frame, support: support, record: record };
})(window);
