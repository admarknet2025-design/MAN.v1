/* DMC 2026 flyer tool: one UI for the public page (/dmc-2026#flyer, attendees only) and the team tool (/studio, behind the team login).
 *
 *   DMCFlyerTool.mount(el, { mode: 'public' | 'team', roster: [ {name, title, company, movement, session, sessionTime} ] })
 *
 * Both modes use the same renderer (flyer-render.js). A photo is decoded and drawn on this device only; nothing is uploaded. */
(function (root) {
'use strict';

var PUBLIC_CAPTION = 'I’ll be at the Digital Marketers’ Conference 2026 — 21 Nov, British Council Accra. #DMC2026 #BuiltToScale. Tickets exclusively on MojoLife · mangh.org/dmc-2026?ref=flyer\n\nBring a colleague — tag them below!';
var LINK = 'mangh.org/dmc-2026?ref=flyer';
/* Team captions: short, factual, one per role. No claims beyond what the event page already says. */
var TEAM_CAPTION = {
  attending:    function () { return PUBLIC_CAPTION; },
  speaking:     function (s) { return 'I’m speaking at the Digital Marketers’ Conference 2026 — 21 Nov, British Council Accra.' + (s.session ? ' ' + s.session + '.' : '') + ' #DMC2026 #BuiltToScale\n' + LINK; },
  volunteering: function () { return 'I’m volunteering at the Digital Marketers’ Conference 2026 — 21 Nov, British Council Accra. #DMC2026 #BuiltToScale\n' + LINK; },
  partner:      function () { return 'We’re a partner of the Digital Marketers’ Conference 2026 — 21 Nov, British Council Accra. #DMC2026 #BuiltToScale\n' + LINK; }
};
var LEVELS = [['yourself', 'Myself', '#2A7B74'], ['team', 'My Team', '#C9A24A'], ['work', 'My Work', '#D95F45']];
var ROLES = [['speaking', 'Speaking'], ['volunteering', 'Volunteering'], ['partner', 'Partner'], ['attending', 'Attending']];
var MOVEMENT_LEVEL = { 'Build Yourself': 'yourself', 'Build Your Team': 'team', 'Build Your Work': 'work' };

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function track(name, params) { if (root.gtag) root.gtag('event', name, params || {}); }
function seg(name, legend, items, checked) {
  return '<fieldset class="fl2-seg"><legend>' + legend + '</legend>' + items.map(function (it) {
    return '<label' + (it[2] ? ' style="--sw:' + it[2] + '"' : '') + '><input type="radio" name="' + name + '" value="' + it[0] + '"' + (it[0] === checked ? ' checked' : '') + '><span>' + (it[2] ? '<i aria-hidden="true"></i>' : '') + esc(it[1]) + '</span></label>';
  }).join('') + '</fieldset>';
}

function mount(el, opts) {
  opts = opts || {};
  var team = opts.mode === 'team', roster = (team && opts.roster) || [];
  var R = root.DMCFlyer;
  var S = { template: 'badge', format: '4:5', level: 'yourself', participantRole: team ? 'speaking' : 'attending', name: '', role: '', sessionLine: '', photo: null, gloss: 'standard' };
  try { var q = new URLSearchParams(location.search).get('gloss'); if (q && R.GLOSS[q]) S.gloss = q; } catch (e) {}   /* QA only: there is no gloss control */

  el.classList.add('fl2'); el.setAttribute('data-mode', team ? 'team' : 'public');
  el.innerHTML =
    '<div class="fl2-ctrl">' +
      seg('fl-tpl', 'Template', [['badge', 'Badge'], ['brief', 'Brief']], S.template) +
      seg('fl-fmt', 'Size', [['4:5', '4:5 feed'], ['9:16', '9:16 story']], S.format) +
      seg('fl-lvl', 'I’m building', LEVELS, S.level) +
      (team ? seg('fl-prole', 'Role', ROLES, S.participantRole) : '') +
      (team && roster.length ? '<div class="fl2-field"><label for="fl-roster">Speakers and hosts</label><select id="fl-roster"><option value="">Choose a person to fill in the fields</option>' + roster.map(function (p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join('') + '</select><p class="fl2-hint">Fills the name, role, level and session. Photos are added by hand.</p></div>' : '') +
      '<div class="fl2-zone-wrap">' +
        '<label class="fl2-zone" id="fl-zone"><input type="file" id="fl-photo" accept="image/*">' +
          '<span class="fl2-circle"><img id="fl-thumb" alt=""><svg id="fl-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></span>' +
          '<span class="fl2-zt"><strong>Add a photo</strong> or drag one here</span>' +
          '<span class="fl2-zs">Optional · JPG or PNG · stays on your device</span></label>' +
        '<div class="fl2-photo-btns"><label class="fl2-btn ghost" for="fl-selfie">Take a selfie</label><input type="file" id="fl-selfie" accept="image/*" capture="user" class="fl2-file"><button type="button" class="fl2-btn ghost" id="fl-clear" hidden>Remove photo</button></div>' +
      '</div>' +
      '<p class="fl2-msg" id="fl-msg" role="status" aria-live="polite"></p>' +
      '<div class="fl2-field"><label for="fl-name">Your name</label><input id="fl-name" type="text" placeholder="e.g. Abena Mensah" maxlength="30" autocomplete="off"></div>' +
      '<div class="fl2-field"><label for="fl-role">Your role / title</label><input id="fl-role" type="text" placeholder="e.g. Brand Strategist" maxlength="60" autocomplete="off"></div>' +
      (team ? '<div class="fl2-field" id="fl-sess-wrap" hidden><label for="fl-session">Session line</label><input id="fl-session" type="text" placeholder="e.g. Panel · Build Your Work · 12:35" maxlength="40" autocomplete="off"></div>' : '') +
      '<div class="fl2-actions"><button type="button" class="fl2-btn" id="fl-dl" aria-disabled="true">Download flyer ↓</button><button type="button" class="fl2-btn ghost" id="fl-share" aria-disabled="true">Share my flyer ↗</button></div>' +
      '<p class="fl2-tip" id="fl-tip">Add your name to download. The PNG is full resolution (1080 × 1350 or 1080 × 1920).</p>' +
      '<p class="fl2-msg" id="fl-smsg" role="status" aria-live="polite"></p>' +
      '<div class="fl2-cap"><label for="fl-caption">Your caption</label><textarea id="fl-caption" rows="6"></textarea><button type="button" class="fl2-btn ghost" id="fl-copy">Copy caption</button></div>' +
    '</div>' +
    '<div class="fl2-prev">' +
      '<div class="fl2-cv"><canvas id="dmc26-flyer" width="1080" height="1350" role="img" aria-label="Live preview of your DMC 2026 flyer"></canvas></div>' +
    '</div>' +
    '<div class="fl2-event"><h3>Bring a colleague</h3><p>Post your flyer, tag the colleague you’re bringing, or just share the event.</p><div class="fl2-links">' +
        '<a class="fl2-btn ghost" id="fl-wa" href="#" target="_blank" rel="noopener noreferrer">WhatsApp</a>' +
        '<a class="fl2-btn ghost" id="fl-li" href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fmangh.org%2Fdmc-2026%3Fref%3Dli" target="_blank" rel="noopener noreferrer">LinkedIn</a>' +
        '<a class="fl2-btn ghost" id="fl-x" href="#" target="_blank" rel="noopener noreferrer">X</a></div></div>';

  var $ = function (id) { return el.querySelector('#' + id); };
  var canvas = $('dmc26-flyer'), ctx = canvas.getContext('2d');
  var cap = $('fl-caption'), msg = $('fl-msg'), smsg = $('fl-smsg'), thumb = $('fl-thumb'), icon = $('fl-icon'), clearBtn = $('fl-clear');
  var capDirty = false, thumbUrl = '', loaded = false, raf = 0, last = null;

  function note(t) { msg.textContent = t || ''; }
  function snote(t) { smsg.textContent = t || ''; }

  /* ---- drawing ---- */
  function draw() {
    if (!loaded) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      try {
        last = R.renderFlyer(ctx, S);
        el.classList.toggle('is-story', S.format === '9:16');
      } catch (e) { note('The preview could not be drawn in this browser. Try updating it.'); if (root.console) console.error(e); }
    });
  }
  R.load().then(function () {
    loaded = true; draw();
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', draw);   /* re-fit names when a font arrives */
  });

  /* ---- caption ---- */
  function captionFor() {
    if (!team) return S.name ? PUBLIC_CAPTION + '\n— ' + S.name + (S.role ? ', ' + S.role : '') : PUBLIC_CAPTION;
    return (TEAM_CAPTION[S.participantRole] || TEAM_CAPTION.attending)({ session: S.participantRole === 'speaking' ? S.sessionLine : '' });
  }
  function setHref(id, href) { var a = $(id); if (a) a.href = href; }
  function syncLinks() {
    var ref = function (code) { return encodeURIComponent(cap.value.replace(/\?ref=[a-z0-9-]+/, '?ref=' + code)); };   /* each channel gets its own ?ref= code */
    setHref('fl-wa', 'https://wa.me/?text=' + ref('wa'));
    setHref('fl-x', 'https://twitter.com/intent/tweet?text=' + ref('x'));
  }
  function refreshCaption() { if (!capDirty) cap.value = captionFor(); syncLinks(); }
  cap.addEventListener('input', function () { capDirty = true; syncLinks(); });
  refreshCaption();

  /* ---- form wiring ---- */
  function ready() { return !!S.name.trim(); }
  function syncActions() {
    var ok = ready();
    ['fl-dl', 'fl-share'].forEach(function (id) { $(id).setAttribute('aria-disabled', ok ? 'false' : 'true'); });
    $('fl-tip').textContent = ok ? 'Full-resolution PNG: ' + (S.format === '9:16' ? '1080 × 1920' : '1080 × 1350') + '. Your photo never leaves this device.' : 'Add your name to download. A photo is optional.';
  }
  function setField(id, v) { var f = $(id); if (f) f.value = v; }
  el.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'fl-tpl') S.template = t.value;
    else if (t.name === 'fl-fmt') S.format = t.value;
    else if (t.name === 'fl-lvl') S.level = t.value;
    else if (t.name === 'fl-prole') { S.participantRole = t.value; var w = $('fl-sess-wrap'); if (w) w.hidden = t.value !== 'speaking'; refreshCaption(); }
    else return;
    syncActions(); draw();
  });
  function onInput(id, key, after) { $(id) && $(id).addEventListener('input', function (e) { S[key] = e.target.value; if (after) after(); syncActions(); draw(); }); }
  onInput('fl-name', 'name', refreshCaption);
  onInput('fl-role', 'role', refreshCaption);
  onInput('fl-session', 'sessionLine', refreshCaption);
  var sw = $('fl-sess-wrap'); if (sw) sw.hidden = S.participantRole !== 'speaking';

  var ros = $('fl-roster');
  if (ros) ros.addEventListener('change', function () {
    var p = roster[+ros.value]; if (!p) return;
    S.name = p.name; S.role = [p.title, p.company].filter(Boolean).join(', ');
    S.participantRole = 'speaking'; S.level = MOVEMENT_LEVEL[p.movement] || S.level;
    S.sessionLine = [String(p.session || '').replace(/^Build [^:]+: /, ''), p.sessionTime].filter(Boolean).join(' · ').slice(0, 40);   /* the movement is already the level */
    setField('fl-name', S.name); setField('fl-role', S.role); setField('fl-session', S.sessionLine);
    el.querySelector('input[name=fl-prole][value=speaking]').checked = true;
    el.querySelector('input[name=fl-lvl][value=' + S.level + ']').checked = true;
    if (sw) sw.hidden = false;
    capDirty = false; refreshCaption(); syncActions(); draw();
  });

  /* ---- photo: decoded and drawn on this device, nothing is sent anywhere ---- */
  function setPhoto(bm, file) {
    if (S.photo && S.photo.close) S.photo.close();
    S.photo = bm;
    if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    thumbUrl = bm ? URL.createObjectURL(file) : '';
    thumb.src = thumbUrl; thumb.style.display = bm ? 'block' : 'none'; icon.style.display = bm ? 'none' : '';
    clearBtn.hidden = !bm; draw();
  }
  function loadPhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { note('That file is not an image. Try a JPG or PNG.'); return; }
    note('');
    R.decodePhoto(file).then(function (bm) { setPhoto(bm, file); }, function () { note('Could not read that photo. Try a JPG or PNG.'); });
  }
  $('fl-photo').addEventListener('change', function (e) { loadPhoto(e.target.files[0]); e.target.value = ''; });
  $('fl-selfie').addEventListener('change', function (e) { loadPhoto(e.target.files[0]); e.target.value = ''; });
  clearBtn.addEventListener('click', function () { setPhoto(null); });
  var zone = $('fl-zone');
  zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', function () { zone.classList.remove('drag'); });
  zone.addEventListener('drop', function (e) { e.preventDefault(); zone.classList.remove('drag'); loadPhoto(e.dataTransfer.files[0]); });

  /* ---- download / share ---- */
  function slug(s) { return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'flyer'; }
  function fileName() { return 'DMC2026-' + S.template + '-' + S.level + '-' + slug(S.name.trim()) + '-' + S.format.replace(':', 'x') + '.png'; }
  function needName() { note('Add your name first. It goes on the flyer.'); var n = $('fl-name'); if (n) n.focus(); }
  function blob(cb) {
    cancelAnimationFrame(raf);
    R.load().then(function () { last = R.renderFlyer(ctx, S); canvas.toBlob(cb, 'image/png'); });   /* always the full-resolution canvas */
  }
  function save(b) {
    var url = URL.createObjectURL(b), a = document.createElement('a');
    a.download = fileName(); a.href = url; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  var meta = function () { return { template: S.template, format: S.format, level: S.level, role: S.participantRole }; };
  $('fl-dl').addEventListener('click', function () {
    if (!ready()) return needName();
    note(''); track('flyer_download', meta());
    blob(function (b) { if (b) save(b); else note('Could not create the image. Try again.'); });
  });
  function canShareFiles(f) { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { return false; } }
  $('fl-share').addEventListener('click', function () {
    if (!ready()) return needName();
    note('');
    blob(function (b) {
      if (!b) return snote('Could not create the image. Try again.');
      var f = new File([b], fileName(), { type: 'image/png' });
      if (!canShareFiles(f)) { save(b); snote('Sharing is not available here, so the flyer was downloaded. Copy the caption to post it.'); return; }   /* falls back to a download */
      navigator.share({ files: [f], text: cap.value, title: 'DMC 2026 — Built To Scale' })
        .then(function () { track('flyer_share', Object.assign({ method: 'share_sheet' }, meta())); snote(''); })
        .catch(function (err) { if (err && err.name === 'AbortError') return; save(b); snote('Sharing did not work on this device, so the flyer was downloaded instead.'); });
    });
  });
  $('fl-copy').addEventListener('click', function () {
    var done = function () { track('flyer_copy_caption'); snote('Caption copied. Paste it into your post.'); }, fail = function () { snote('Could not copy automatically. Select the caption and copy it.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(cap.value).then(done, fail);
    else { cap.select(); try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); } }
  });

  syncActions();
  return { state: S, draw: draw, canvas: canvas, last: function () { return last; }, fileName: fileName };
}

root.DMCFlyerTool = { mount: mount, PUBLIC_CAPTION: PUBLIC_CAPTION };
})(window);
