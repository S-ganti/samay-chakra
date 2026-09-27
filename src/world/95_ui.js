/* =========================================================================
   INTERFACE — Samay Chakra dial, chapter travel, controls, title cards,
   VJ keys, stills + recording
   ========================================================================= */
const $ = (id) => document.getElementById(id);
const UI = { lastCh: -1, cardTimer: 0, toastTimer: 0, rec: null, DL: null, wantStill: false };
const JUMP = [18.5, 21.7, .85, 3.75, 6.2, 9.42, 12.75, 15.85];
const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function arcPath(r, a0, a1) { const p = (a) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; }
const hAng = (h) => h / 24 * TAU - Math.PI / 2;

function toast(msg, ms = 2600) { if (UI.quiet && ms < 6000) return; const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(UI.toastTimer); UI.toastTimer = setTimeout(() => t.classList.remove('show'), ms); }

function travelTo(h, dur) {
  const from = S.t, d = hdiff(h, from);
  S.travel = { from, to: from + d, t0: S.rt, dur: dur || clamp(2.4 + Math.abs(d) * .32, 2.4, 6.5) };
}
function setupDial() {
  const svg = $('dial');
  svgEl('circle', { cx: 50, cy: 50, r: 47, fill: 'rgba(12,11,10,.85)', stroke: 'rgba(237,227,209,.16)', 'stroke-width': .6 }, svg);
  UI.segs = CHAPTERS.map((c, k) => svgEl('path', { d: arcPath(39, hAng(c.start) + .025, hAng(c.start + 3) - .025), fill: 'none', stroke: c.key, 'stroke-width': 7, opacity: .38, 'stroke-linecap': 'butt' }, svg));
  for (let hh = 0; hh < 24; hh++) { const a = hAng(hh), r0 = hh % 3 === 0 ? 29.5 : 31.5; svgEl('line', { x1: 50 + Math.cos(a) * r0, y1: 50 + Math.sin(a) * r0, x2: 50 + Math.cos(a) * 33.5, y2: 50 + Math.sin(a) * 33.5, stroke: 'rgba(237,227,209,.5)', 'stroke-width': hh % 3 === 0 ? .9 : .5 }, svg); }
  for (const [hh, lbl] of [[0, '0'], [6, '6'], [12, '12'], [18, '18']]) { const a = hAng(hh); const tx = svgEl('text', { x: 50 + Math.cos(a) * 23, y: 50 + Math.sin(a) * 23 + 2.2, 'text-anchor': 'middle', 'font-size': 6.2, fill: 'rgba(237,227,209,.62)', 'font-family': 'JetBrains Mono, monospace' }, svg); tx.textContent = lbl; }
  UI.needle = svgEl('line', { x1: 50, y1: 50, x2: 50, y2: 8, stroke: '#ede3d1', 'stroke-width': 1.2, 'stroke-linecap': 'round' }, svg);
  UI.needleDot = svgEl('circle', { cx: 50, cy: 8, r: 3, fill: '#ff7a2f' }, svg);
  svgEl('circle', { cx: 50, cy: 50, r: 2.4, fill: '#ede3d1' }, svg);
  let drag = false;
  const setFromEvent = (e) => { const b = svg.getBoundingClientRect(); const x = e.clientX - b.left - b.width / 2, y = e.clientY - b.top - b.height / 2; let a = Math.atan2(y, x) + Math.PI / 2; if (a < 0) a += TAU; S.t = a / TAU * 24; S.travel = null; if (PARAM.clock) setClock(false); };
  svg.addEventListener('pointerdown', (e) => { drag = true; svg.setPointerCapture(e.pointerId); setFromEvent(e); });
  svg.addEventListener('pointermove', (e) => { if (drag) setFromEvent(e); });
  svg.addEventListener('pointerup', () => { drag = false; });
  svg.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { travelTo(S.t + .25, 1.2); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { travelTo(S.t - .25, 1.2); e.preventDefault(); } });
  const chips = $('chips');
  UI.chips = CHAPTERS.map((c, k) => { const b = document.createElement('button'); b.textContent = c.n; b.style.setProperty('--c', c.key); b.title = `${c.title} · ${chapterSpan(c)}`; b.setAttribute('aria-label', `Travel to ${c.title}`); b.onclick = () => goChapter(k); chips.appendChild(b); return b; });
}
function goChapter(k) { if (PARAM.clock) setClock(false); travelTo(JUMP[k]); toast(`Travelling to ${CHAPTERS[k].title}`, 1600); }
function setClock(on) { PARAM.clock = on; $('sSpeed').value = on ? 'clock' : String(PARAM.dayMinutes); if (on) { S.travel = null; } }

function bindRange(id, oid, key, fmt = (v) => v.toFixed(2), onChange) {
  const r = $(id), o = $(oid); r.value = PARAM[key]; o.textContent = fmt(+r.value);
  r.addEventListener('input', () => { PARAM[key] = +r.value; o.textContent = fmt(+r.value); if (onChange) onChange(+r.value); });
}
function setupControls(ctx) {
  bindRange('rPop', 'oPop', 'population', (v) => String(v | 0));
  bindRange('rEnergy', 'oEnergy', 'energy'); bindRange('rTrails', 'oTrails', 'trails'); bindRange('rExpo', 'oExpo', 'exposure');
  bindRange('rFog', 'oFog', 'fog'); bindRange('rGlow', 'oGlow', 'glow'); bindRange('rGrain', 'oGrain', 'grain'); bindRange('rGrade', 'oGrade', 'grade');
  bindRange('rReal', 'oReal', 'real'); bindRange('rShafts', 'oShafts', 'shafts'); bindRange('rAO', 'oAO', 'ao');
  bindRange('rSoft', 'oSoft', 'soft', (v) => Math.round(v * 3 * 60) + ' min');
  bindRange('rVol', 'oVol', 'volume', (v) => Math.round(v * 100) + '%'); bindRange('rGen', 'oGen', 'gen', (v) => Math.round(v * 100) + '%'); bindRange('rAmb', 'oAmb', 'amb', (v) => Math.round(v * 100) + '%');
  bindRange('rShot', 'oShot', 'shotLen', (v) => (v | 0) + ' s');
  const bpm = $('rBpm'); bpm.addEventListener('input', () => { BPM[S.dom] = +bpm.value; $('oBpm').textContent = bpm.value; });
  $('sQual').value = PARAM.quality;
  $('sQual').onchange = (e) => {
    // grass, tree density, carving detail and texture sizes are built once at load, so the world is rebuilt at the new quality
    const q = e.target.value; PARAM.quality = q; PARAM.qualityPinned = true; ctx.applyQuality();
    try { localStorage.setItem('samay.quality', q); sessionStorage.setItem('samay.resume', JSON.stringify({ at: Date.now(), t: S.t, palette: PARAM.palette, wx: WX.mode })); } catch (x) { }
    toast(`Rebuilding the world at ${e.target.selectedOptions[0].textContent} quality…`, 3000);
    setTimeout(() => { try { location.reload(); } catch (x) { } }, 700);
  };
  $('sPal').value = PARAM.palette; $('sPal').onchange = (e) => setPalette(e.target.value);
  $('sWx').value = WX.mode; $('sWx').onchange = (e) => { WX.mode = e.target.value; const P = wxPlan(new Date()); toast(WX.mode === 'live' ? (P.rain.length ? `Today in Bengaluru: rain around ${P.rain.map(r => fmtH(r.s)).join(' and ')}` + (P.mist ? ', mist at dawn' : '') : P.mist ? 'Today in Bengaluru: a misty dawn, then dry' : 'Today in Bengaluru: a dry day') : 'Weather: ' + e.target.selectedOptions[0].textContent, 3600); };
  $('bListen').onclick = () => toggleListen(); $('bUnlisten').onclick = () => toggleListen(false);
  $('sSleep').onchange = (e) => { const m = +e.target.value; LISTEN.sleepAt = m ? performance.now() + m * 60000 : 0; LISTEN.fade = 1; toast(m ? `The music will fade out in ${m >= 60 ? m / 60 + (m === 60 ? ' hour' : ' hours') : m + ' minutes'}` : 'Sleep timer off', 2200); };
  const stirAll = () => stir(); ['pointermove', 'pointerdown', 'touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, stirAll, { passive: true }));
  $('sFrame').onchange = (e) => { PARAM.frame = e.target.value; ctx.resize(); };
  $('sCut').onchange = (e) => { PARAM.cut = e.target.value === 'cut'; };
  $('cTitles').onchange = (e) => { PARAM.titles = e.target.checked; if (!PARAM.titles) { $('card').classList.remove('show'); $('app').classList.remove('carding'); } };
  $('cLbx').onchange = (e) => { PARAM.lbx = e.target.checked; };
  $('cDof').checked = PARAM.dof; $('cDof').onchange = (e) => { PARAM.dof = e.target.checked; };
  $('sSpeed').onchange = (e) => { const v = e.target.value; if (v === 'clock') setClock(true); else { PARAM.clock = false; PARAM.dayMinutes = +v; } };
  $('bPlay').onclick = togglePlay;
  $('bSound').onclick = toggleSound;
  document.querySelectorAll('#camSeg button').forEach(b => b.onclick = () => setCam(b.dataset.cam));
  $('bPanel').onclick = () => togglePanel(); $('bClose').onclick = () => togglePanel(false);
  $('bHide').onclick = () => toggleClean(); $('bFull').onclick = toggleFull;
  $('bStill').onclick = () => { UI.wantStill = true; };
  $('bCard').onclick = () => { UI.wantCard = true; };
  $('bRec').onclick = () => toggleRec(ctx);
  // user tracks
  const tr = $('tracks');
  CHAPTERS.forEach((c, k) => {
    const row = document.createElement('div'); row.className = 'trk'; row.style.setProperty('--c', c.key);
    row.innerHTML = `<i></i><div class="nm">${c.n} · ${c.title}<small id="tn${k}">Raga ${c.raga} engine</small></div><div class="btnrow"><label class="btn" for="tf${k}">Load</label><input type="file" accept="audio/*" id="tf${k}"><button class="btn" id="tx${k}" hidden>Clear</button></div>`;
    tr.appendChild(row);
    $('tf' + k).addEventListener('change', (e) => { const f = e.target.files[0]; e.target.blur(); if (f) loadTrack(k, f); });
    $('tx' + k).onclick = () => { audioSetUser(k, null); $('tn' + k).textContent = `Raga ${c.raga} engine`; $('tx' + k).hidden = true; $('tf' + k).value = ''; };
    row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drop'); });
    row.addEventListener('dragleave', () => row.classList.remove('drop'));
    row.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); row.classList.remove('drop'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) loadTrack(k, f); });
  });
  // drop an audio file anywhere else: it plays in the chapter on screen. Every drag is caught here, so the browser
  // never navigates away to the dropped file (that would replace the whole world with a bare audio player)
  const app = $('app');
  window.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
  window.addEventListener('drop', (e) => {
    e.preventDefault(); const dt = e.dataTransfer; const f = dt && dt.files && dt.files[0];
    if (f) { loadTrack(S.dom, f); return; }
    if (dt && [...dt.types].some(t => t === 'text/uri-list' || t === 'text/plain')) toast('That drop carried a link, not the file itself. Drag the file from File Explorer or Finder, or use Load under Controls → Music.', 7000);
  });
  // keys
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k >= '1' && k <= '8') { goChapter(+k - 1); }
    else if (k === ' ') { e.preventDefault(); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); togglePlay(); }
    else if (k === 'ArrowRight' && e.target.id !== 'dial') travelTo(S.t + .25, 1.2);
    else if (k === 'ArrowLeft' && e.target.id !== 'dial') travelTo(S.t - .25, 1.2);
    else if (k === ']' || k === '[') { const opts = [8, 24, 48, 120, 720]; let i = opts.indexOf(PARAM.dayMinutes); i = clamp(i + (k === ']' ? -1 : 1), 0, opts.length - 1); PARAM.dayMinutes = opts[i]; setClock(false); toast(`One day in ${opts[i] >= 60 ? opts[i] / 60 + ' h' : opts[i] + ' min'}`, 1400); }
    else if (k === 'c' || k === 'C') { const m = ['director', 'orbit', 'follow', 'top']; setCam(m[(m.indexOf(PARAM.camera) + 1) % 4]); }
    else if (k === 'n' || k === 'N') { setCam('follow'); ctx.CAM.follow = 1 + Math.floor(Math.random() * (PARAM.population - 1)); }
    else if (k === 's' || k === 'S') toggleSound();
    else if (k === 't' || k === 'T') { PARAM.titles = !PARAM.titles; $('cTitles').checked = PARAM.titles; toast(PARAM.titles ? 'Title cards on' : 'Title cards off', 1200); }
    else if (k === 'h' || k === 'H') { if (LISTEN.on) toggleListen(false); else toggleClean(); }
    else if (k === 'l' || k === 'L') toggleListen();
    else if (k === 'v' || k === 'V') { const i = PAL_KEYS.indexOf(PARAM.palette); setPalette(PAL_KEYS[(i + 1) % PAL_KEYS.length], true); }
    else if (k === 'f' || k === 'F') toggleFull();
    else if (k === 'r' || k === 'R') toggleRec(ctx);
    else if (k === 'p' || k === 'P') UI.wantStill = true;
    else if (k === 'Escape') { togglePanel(false); if (LISTEN.on) toggleListen(false); else if ($('app').classList.contains('clean')) toggleClean(); }
  });
  // downloads capability (optional)
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then((d) => { UI.DL = d; }).catch(() => { }); } catch (e) { }
  setupDiag();
}
/* ---------- diagnostics: when something breaks, say what, instead of leaving a black or frozen screen ---------- */
const DIAG = { log: [], shown: false, lastFrameAt: 0, blackN: 0 };
function diagNote(kind, msg) {
  const line = `${new Date().toISOString().slice(11, 19)} ${kind}: ${msg}`;
  DIAG.log.push(line); if (DIAG.log.length > 40) DIAG.log.shift();
  try { console.info('[samay]', line); } catch (e) { }
}
function diagShow(title, hint) {
  const el = $('diag'); if (!el) return;
  $('diagTitle').textContent = title; $('diagHint').textContent = hint || '';
  const u = AUD.users && AUD.users[S.dom];
  const state = [
    `page: ${location.href}`, `browser: ${navigator.userAgent}`,
    `quality ${PARAM.quality} · chapter ${S.dom + 1} · time ${fmtH(S.t)} · sound ${AUD.on ? 'on' : 'off'}${AUD.ctx ? ' (' + AUD.ctx.state + ')' : ''}`,
    u ? `track: ${u.name} · ${u.mode || 'loading'} · ready ${u.ready} · playing ${u.playing}` : 'track: none on this chapter',
    `graphics lost: ${!!UI.glLost}`, '', ...DIAG.log];
  $('diagText').textContent = state.join('\n'); el.hidden = false; DIAG.shown = true;
}
function setupDiag() {
  window.addEventListener('error', (e) => diagNote('error', (e.message || 'error') + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
  window.addEventListener('unhandledrejection', (e) => diagNote('promise', String((e.reason && (e.reason.message || e.reason)) || 'rejected')));
  $('diagCopy').onclick = () => { const t = $('diagText').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Details copied', 1600)).catch(() => { const r = document.createRange(); r.selectNodeContents($('diagText')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Press Ctrl+C to copy the selected details', 3000); }); };
  $('diagReload').onclick = () => location.reload();
  $('diagClose').onclick = () => { $('diag').hidden = true; DIAG.shown = false; DIAG.stallShown = false; };
  // a timeline of what the page went through, so a black or frozen screen can be traced afterwards
  const fmtWin = () => `${innerWidth}x${innerHeight}${document.fullscreenElement ? ' fullscreen' : ''}`;
  document.addEventListener('visibilitychange', () => diagNote('page', document.visibilityState));
  window.addEventListener('focus', () => { DIAG.focusAt = performance.now(); diagNote('page', 'focus'); }); window.addEventListener('blur', () => diagNote('page', 'blur (another window or a dialog took focus)'));
  window.addEventListener('pagehide', () => diagNote('page', 'pagehide')); window.addEventListener('pageshow', () => diagNote('page', 'pageshow'));
  document.addEventListener('freeze', () => diagNote('page', 'frozen by the browser')); document.addEventListener('resume', () => diagNote('page', 'resumed by the browser'));
  document.addEventListener('fullscreenchange', () => diagNote('page', 'fullscreen ' + (document.fullscreenElement ? 'on' : 'off')));
  let rzT = 0; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => diagNote('page', 'resized to ' + fmtWin()), 300); });
  window.addEventListener('dragenter', (e) => { if (!DIAG.dragging) { DIAG.dragging = true; diagNote('drag', 'enter · ' + [...((e.dataTransfer && e.dataTransfer.types) || [])].join(',')); } });
  window.addEventListener('drop', (e) => { DIAG.dragging = false; diagNote('drag', `drop · ${(e.dataTransfer && e.dataTransfer.files.length) || 0} file(s)`); }, true);
  document.querySelectorAll('#tracks input[type=file]').forEach((inp) => {
    inp.addEventListener('click', () => diagNote('track', 'Load clicked (file dialog opening)'));
    inp.addEventListener('cancel', () => diagNote('track', 'file dialog cancelled'));
    inp.addEventListener('change', () => diagNote('track', 'file dialog returned ' + (inp.files && inp.files.length ? `“${inp.files[0].name}”` : 'nothing')));
  });
  $('bDiag').onclick = () => diagShow('Diagnostics', 'Copy these details and send them over.');
  // watchdog: frames should arrive whenever the page is visible. A native file dialog can pause them, so only
  // a stall while the page has focus raises the card
  setInterval(() => {
    if (!UI.started || document.visibilityState !== 'visible' || LISTEN.asleep) return;
    const gap = performance.now() - DIAG.lastFrameAt;
    if (gap > 5000 && !DIAG.stallShown && !DIAG.shown && document.hasFocus() && performance.now() - (DIAG.focusAt || 0) > 1500) { DIAG.stallShown = true; diagNote('stall', `no frame for ${(gap / 1000).toFixed(1)} s with the page in focus`); diagShow('The scene stopped updating', 'Something is blocking the page. Copy the details below and send them over, then reload.'); }
  }, 500);
}
// called by the frame loop (pauses and their end are noted by the loop itself)
function diagFrame() { DIAG.lastFrameAt = performance.now(); }
const fmtDur = (d) => { const m = Math.floor(d / 60), s2 = Math.floor(d % 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m}:${String(s2).padStart(2, '0')}`; };
function loadTrack(k, f) {
  const c = CHAPTERS[k];
  if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|wav|aiff?|flac|ogg|oga|opus|webm|mp4)$/i.test(f.name)) { toast(`“${f.name}” isn't an audio file.`, 3200); return; }
  if (!AUD.on) toggleSound(true);
  if (!AUD.ctx) return;
  diagNote('track', `load “${f.name}” (${(f.size / 1048576).toFixed(1)} MB, ${f.type || 'no type'}) into chapter ${k + 1}`);
  audioSetUser(k, f, (state, msg, u) => {
    const tn = $('tn' + k), tx = $('tx' + k); diagNote('track', `${state}${u && u.mode ? ' · ' + u.mode : ''}${msg ? ' · ' + msg : ''}`);
    if (state === 'loading') { tn.textContent = `Loading ${f.name}…`; tx.hidden = false; }
    else if (state === 'ready') { tn.textContent = f.name + (u.dur && isFinite(u.dur) ? ' · ' + fmtDur(u.dur) : ''); toast(`${c.title} now plays “${f.name}”`); }
    else if (state === 'error') { tn.textContent = `Raga ${c.raga} engine`; tx.hidden = true; $('tf' + k).value = ''; toast(msg, 6000); }
  });
}
function togglePlay() { PARAM.playing = !PARAM.playing; if (PARAM.playing && PARAM.clock) { } const b = $('bPlay'); b.setAttribute('aria-label', PARAM.playing ? 'Pause time' : 'Play time'); b.innerHTML = PARAM.playing ? '<svg viewBox="0 0 16 16"><path d="M4 2h3v12H4zM9 2h3v12H9z"/></svg>' : '<svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg>'; }
function toggleSound(force) {
  const want = force === true ? true : !AUD.on;
  const b = $('bSound');
  if (want) { if (!audioStart()) { toast('This browser has no Web Audio support.'); return; } b.classList.add('on'); b.classList.remove('hot'); b.setAttribute('aria-pressed', 'true'); toast(`Sound on · Raga ${CHAPTERS[S.dom].raga}`, 1800); }
  else { audioStop(); b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }
}
/* ---------- pigment palettes ---------- */
const PAL_KEYS = ['poster', 'pichwai', 'mughal', 'kalamkari', 'chola', 'bengal', 'kerala', 'off'];
function setPalette(k, say) {
  PARAM.palette = k; $('sPal').value = k;
  if (say) toast(k === 'off' ? 'Pigment palette off: the raw render' : k === 'poster' ? 'Palette: each chapter’s poster' : 'Palette: ' + PALETTE_FAMILIES[k].name, 1800);
}
/* ---------- listening: sound on, the interface away, long slow shots; a sleep timer fades it all out ---------- */
const LISTEN = { on: false, prev: null, sleepAt: 0, fade: 1, asleep: false, chipT: 0 };
function toggleListen(force) {
  const on = force === undefined ? !LISTEN.on : force; if (on === LISTEN.on) return;
  const a = $('app'), b = $('bListen'); LISTEN.on = on; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
  if (on) {
    LISTEN.prev = { titles: PARAM.titles, shotLen: PARAM.shotLen, cut: PARAM.cut, clean: a.classList.contains('clean') };
    if (!AUD.on) toggleSound(true);
    PARAM.titles = false; PARAM.shotLen = 48; PARAM.cut = false; setCam('director');
    $('card').classList.remove('show'); a.classList.remove('carding'); togglePanel(false);
    a.classList.add('clean', 'listening'); UI.quiet = true; stir(true);
  } else {
    const p = LISTEN.prev || {}; PARAM.titles = p.titles !== undefined ? p.titles : PARAM.titles; PARAM.shotLen = p.shotLen || 20; PARAM.cut = !!p.cut;
    a.classList.remove('listening', 'stir'); if (!p.clean) a.classList.remove('clean');
    UI.quiet = false; $('listenChip').classList.remove('show'); wake();
  }
}
// any movement shows the small listening chip (and the cursor) for a few seconds; it also wakes a sleeping scene
function stir(first) {
  wake();
  if (!LISTEN.on) return;
  const a = $('app'), chip = $('listenChip'), left = LISTEN.sleepAt ? Math.max(0, Math.round((LISTEN.sleepAt - performance.now()) / 60000)) : 0;
  $('listenTxt').textContent = `Listening · ${CHAPTERS[S.dom].title}, Raga ${CHAPTERS[S.dom].raga}` + (LISTEN.sleepAt ? ` · fades out in ${left} min` : '') + (first === true ? ' · L or Esc to come back' : '');
  chip.classList.add('show'); a.classList.add('stir');
  clearTimeout(LISTEN.chipT); LISTEN.chipT = setTimeout(() => { chip.classList.remove('show'); a.classList.remove('stir'); }, first === true ? 5000 : 2600);
}
function wake() {
  if (!LISTEN.asleep) return;
  LISTEN.asleep = false; LISTEN.fade = 1; LISTEN.sleepAt = 0; $('sSleep').value = '0';
  toast('Welcome back', 1600, true);
}
// called every frame: the sleep timer's slow fade (sound and picture together), then rest
function listenTick(dt) {
  if (!LISTEN.sleepAt || LISTEN.asleep) return;
  if (performance.now() < LISTEN.sleepAt) return;
  LISTEN.fade = Math.max(0, LISTEN.fade - dt / 45);
  if (LISTEN.fade <= 0) { LISTEN.asleep = true; if (AUD.on) toggleSound(false); }
}
function setCam(m) { PARAM.camera = m; document.querySelectorAll('#camSeg button').forEach(b => b.classList.toggle('on', b.dataset.cam === m)); }
function togglePanel(force) { const p = $('panel'), open = force === undefined ? !p.classList.contains('open') : force; p.classList.toggle('open', open); $('bPanel').setAttribute('aria-expanded', String(open)); }
function toggleClean() { const a = $('app'); a.classList.toggle('clean'); if (a.classList.contains('clean')) { togglePanel(false); toast('Interface hidden · press H to show', 1600); } }
function toggleFull() { const el = document.documentElement; if (!document.fullscreenElement) { (el.requestFullscreen ? el.requestFullscreen() : Promise.reject()).catch(() => toast('Fullscreen isn’t available in this view.')); } else document.exitFullscreen().catch(() => { }); }

async function saveFile(name, blob) {
  if (UI.DL) {
    try { await UI.DL.save({ filename: name, data: blob }); toast(`Saved ${name}`); return; }
    catch (e) { if (e && e.code === 'declined') { toast('Save cancelled'); return; } if (e && e.code === 'too_large') { toast('That file is too large to save here. Try a shorter recording.'); return; } }
  }
  if (!window.claude) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return; }
  toast('Saving files isn’t available in this view.');
}
function stamp() { const c = CHAPTERS[chapterAt(S.t)]; return `samay-chakra-${c.n}-${c.id}-${fmtH(S.t).replace(':', '')}`; }
function grabStill(canvas) { canvas.toBlob((b) => { if (b) saveFile(stamp() + '.png', b); }, 'image/png'); }
// a postcard in the posters' layout: this frame, cropped to 3:4, with the chapter's typography
function grabPostcard(gl) {
  const W = 1500, H = 2000, [c, x] = cnv(W, H), ch = CHAPTERS[chapterAt(S.t)], css = getComputedStyle(document.documentElement), v = (n) => css.getPropertyValue(n).trim();
  const sw = gl.width, sh = gl.height, ar = W / H; let cw = sw, chh = sw / ar; if (chh > sh) { chh = sh; cw = sh * ar; }
  x.drawImage(gl, (sw - cw) / 2, (sh - chh) / 2, cw, chh, 0, 0, W, H);
  const g = x.createLinearGradient(0, H * .56, 0, H); g.addColorStop(0, 'rgba(8,6,4,0)'); g.addColorStop(.55, 'rgba(8,6,4,.55)'); g.addColorStop(1, 'rgba(8,6,4,.86)'); x.fillStyle = g; x.fillRect(0, H * .5, W, H * .5);
  const M = 110, R = W - M, bone = '#efe6d6', key = ch.key, sp = (px) => { try { x.letterSpacing = px + 'px'; } catch (e) { } };
  x.textBaseline = 'alphabetic'; x.fillStyle = bone;
  x.font = `400 30px ${v('--f-sans')}`; sp(7); x.textAlign = 'left'; x.fillText('THE RING / SAMAY CHAKRA', M, H - 520); x.textAlign = 'right'; x.fillText(`${String(ch.n).padStart(2, '0')} / 08`, R, H - 520);
  x.fillStyle = 'rgba(239,230,214,.45)'; x.fillRect(M, H - 494, R - M, 2);
  const fam = ch.font === 'sans' ? `300 {s}px ${v('--f-sans')}` : ch.font === 'sten' ? `700 {s}px ${v('--f-sten')}` : `400 {s}px ${v('--f-disp')}`, title = ch.title.toUpperCase();
  let fs = 150; sp(ch.font === 'sten' ? 8 : 22); x.font = fam.replace('{s}', fs); while (x.measureText(title).width > R - M && fs > 60) { fs -= 6; x.font = fam.replace('{s}', fs); }
  x.textAlign = 'left'; x.fillStyle = bone; x.fillText(title, M, H - 330);
  const tw = Math.min(R - M, x.measureText(title).width), ly = H - 330 - fs * .36;
  x.fillStyle = key; x.fillRect(M - 16, ly, tw + 32, 3); x.beginPath(); x.arc(M + tw / 2, ly + 1.5, 9, 0, TAU); x.fill();
  sp(6); x.font = `400 34px ${v('--f-sans')}`; x.fillStyle = bone; x.fillText(`${chapterSpan(ch)}  /  RAGA ${ch.raga.toUpperCase()}`, M, H - 250);
  sp(0); x.font = `500 58px ${v('--f-native')}`; x.fillStyle = key; x.fillText(ch.native, M, H - 160);
  const d = new Date(), when = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const sky = [WX.label, MOON.name + ' (' + Math.round(MOON.illum * 100) + '% lit)'].filter(Boolean).join(' · ');
  sp(4); x.font = `400 24px ${v('--f-sans')}`; x.fillStyle = 'rgba(239,230,214,.72)'; x.fillText(`BENGALURU  ·  ${when.toUpperCase()}  ·  ${fmtH(S.t)}  ·  ${sky.toUpperCase()}`, M, H - 96);
  sp(0); c.toBlob((b) => { if (b) saveFile(stamp() + '-postcard.png', b); }, 'image/png');
}
function toggleRec(ctx) {
  const btn = $('bRec');
  if (UI.rec) { UI.rec.stop(); return; }
  if (!window.MediaRecorder || !ctx.canvas.captureStream) { toast('Recording isn’t supported in this browser.'); return; }
  const stream = ctx.canvas.captureStream(30);
  const as = audioRecStream(); if (as) as.getAudioTracks().forEach(tk => stream.addTrack(tk));
  // MP4 (H.264) where the browser can record it: Instagram needs it; WebM otherwise
  const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m)) || '';
  let mr; try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 14e6 } : undefined); } catch (e) { toast('Recording couldn’t start in this browser.'); return; }
  const isMp4 = mime.startsWith('video/mp4'), chunks = [], name = stamp() + (isMp4 ? '.mp4' : '.webm'), t0 = performance.now();
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mr.onstop = () => { UI.rec = null; clearInterval(UI.recIv); $('recDot').classList.remove('on'); btn.classList.remove('rec'); btn.lastChild.textContent = 'Record video'; saveFile(name, new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' })); };
  mr.start(1000); UI.rec = mr; btn.classList.add('rec'); btn.lastChild.textContent = 'Stop recording';
  $('recDot').classList.add('on');
  UI.recIv = setInterval(() => { const s = (performance.now() - t0) / 1000 | 0; $('recT').textContent = String(s / 60 | 0).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }, 500);
  if (!AUD.on) toast('Recording without sound · press S to add the music');
}

function updateHUD(ch) {
  const c = CHAPTERS[ch], root = document.documentElement;
  if (ch !== UI.lastCh) {
    UI.lastCh = ch; S.dom = ch;
    root.style.setProperty('--chap', c.key);
    $('hTitle').textContent = c.title; $('hNative').textContent = c.native; $('hNative').lang = c.lang;
    $('hMeta').textContent = `${chapterSpan(c)} / Raga ${c.raga}`; $('hChap').textContent = `Chapter ${c.n} of 8`;
    [...$('hDots').children].forEach((b, i) => b.classList.toggle('on', i === ch));
    UI.chips.forEach((b, i) => b.classList.toggle('on', i === ch));
    UI.segs.forEach((s, i) => s.setAttribute('opacity', i === ch ? 1 : .38));
    $('lBpm').textContent = `Tempo · ${c.title}`; $('rBpm').value = BPM[ch]; $('oBpm').textContent = BPM[ch];
    // title card
    const ct = $('cTitle'); ct.textContent = c.title; ct.className = c.font === 'sans' ? 'f-sans' : c.font === 'sten' ? 'f-sten' : '';
    $('cNative').textContent = c.native; $('cNative').lang = c.lang; $('cMeta').textContent = `${chapterSpan(c)} / Raga ${c.raga}`; $('cDesc').textContent = c.desc;
    $('cDots').innerHTML = CHAPTERS.map((_, i) => `<b class="${i === ch ? 'on' : ''}"></b>`).join('');
    if (PARAM.titles && UI.started) { $('card').classList.add('show'); $('app').classList.add('carding'); clearTimeout(UI.cardTimer); UI.cardTimer = setTimeout(() => { $('card').classList.remove('show'); $('app').classList.remove('carding'); }, 6500); }
  }
  const h = wrap24(S.t), a = hAng(h);
  $('clock').textContent = fmtH(h);
  const sky = [WX.label, (h > 18.5 || h < 5.8) && S.moonDir.y > -.05 ? MOON.name : ''].filter(Boolean).join(', ');
  $('prahar').textContent = `${c.title} · Raga ${c.raga}${AUD.on ? ' · ' + Math.round(S.bpm) + ' BPM' : ''}${sky ? ' · ' + sky : ''}`;
  UI.needle.setAttribute('x2', 50 + Math.cos(a) * 44); UI.needle.setAttribute('y2', 50 + Math.sin(a) * 44);
  UI.needleDot.setAttribute('cx', 50 + Math.cos(a) * 44); UI.needleDot.setAttribute('cy', 50 + Math.sin(a) * 44);
  UI.needleDot.setAttribute('fill', c.key);
  $('dial').setAttribute('aria-valuenow', h.toFixed(2)); $('dial').setAttribute('aria-valuetext', fmtH(h) + ', ' + c.title);
}
