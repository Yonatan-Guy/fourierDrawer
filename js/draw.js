/*  draw.js

    The animation: the epicycle canvas and the x(t) / y(t) panels.
*/

// ==========================================================
// THE ANIMATION
// ==========================================================
// 2400 frames to a lap. At 1x that is a slow, watchable crawl -- you can
// follow individual arms -- and 16x still finishes in a couple of seconds.
const N_FRAMES = 2400, TRACE_DETAIL = 8, SPEEDS = [1, 2, 4, 8, 16];

// Canvas colours cannot use CSS variables directly, so read them at draw time.
// That is what makes the light theme reach the drawing as well as the page.
const themeCache = {};
function cssVar(name){
  const key = name + document.documentElement.dataset.theme;
  if (!themeCache[key])
    themeCache[key] = getComputedStyle(document.documentElement)
                        .getPropertyValue(name).trim() || '#888';
  return themeCache[key];
}
function clearThemeCache(){ for (const k in themeCache) delete themeCache[k]; }
const run = {terms:[], shape:[], k:0, step:2, n:8, paused:false, trace:[],
             guide:false, big:false, waves:null, colour:'#ff2d2d',
             looping:false, view:'setup'};   // one animation loop per session

const mainCv = $('#draw2d'), waveCv = $('#waves');
const mainCx = mainCv.getContext('2d'), waveCx = waveCv.getContext('2d');

function fitCanvas(cv, cx){
  const dpr = window.devicePixelRatio || 1;
  const r = cv.getBoundingClientRect();
  cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr);
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {w:r.width, h:r.height};
}

// How many arms you need before the ones you drop stop mattering.
//
// Two tempting tests both fail. Share of total amplitude is wrong: a traced
// outline leaves thousands of microscopic terms, and 3000 terms of amplitude
// 0.00003 still sum to something, so "99.9% of the amplitude" drags you deep
// into invisible noise. Adding the leftovers up as a worst case is wrong the
// same way -- it assumes every discarded arm points in the same direction.
//
// What the eye sees is the typical deviation, which by Parseval is the root of
// the summed squares of the discarded amplitudes. Compare that to the shape's
// own radius and the number comes out sane for every kind of input.
function armsForError(terms, radius, frac){
  const rms = new Array(terms.length);
  let s = 0;
  for (let i = terms.length - 1; i >= 0; i--){
    rms[i] = Math.sqrt(s);
    s += terms[i].amp * terms[i].amp;
  }
  const limit = frac * radius;
  for (let i = 0; i < rms.length; i++) if (rms[i] <= limit) return i + 1;
  return terms.length;
}

function start(points){
  const N = +$('#nSamples').value;
  run.shape = center(resample(points, N));

  const auto = !$('#maxArms').dataset.chosen;
  const cap = auto ? Math.min(N, 4000) : +$('#maxArms').value;
  run.terms = fourier(run.shape, cap);

  let radius = 0;
  for (const p of run.shape) radius = Math.max(radius, Math.hypot(p[0], p[1]));

  if (auto){
    // max: leftover wobble under 0.1% of the shape -- well under a pixel.
    // Rounded up to a round fifty.
    const hi = Math.min(Math.ceil(armsForError(run.terms, radius, 0.001) / 50) * 50,
                        run.terms.length, 2000);   // a phone-friendly ceiling
    run.terms = run.terms.slice(0, Math.max(hi, 50));
    $('#maxArms').value = run.terms.length;
    if (!$('#startArms').dataset.chosen){
      // start: within about 1% of the shape -- recognisable, still rounded
      const lo = Math.max(10, Math.floor(armsForError(run.terms, radius, 0.01) / 10) * 10);
      $('#startArms').value = Math.min(lo, run.terms.length);
    }
  }

  run.colour = $('#penColour').value;
  run.step = +$('#speed').value;
  run.n = Math.min(+$('#startArms').value, run.terms.length);
  run.k = 0; run.trace = []; run.paused = false; run.waves = null;

  run.margin = (radius || 10) * 1.35;

  const s = $('#arms');
  s.max = run.terms.length; s.value = run.n; $('#armsVal').textContent = run.n;

  go('draw');
  document.querySelectorAll('#speeds button').forEach(b =>
    b.classList.toggle('on', +b.dataset.sp === run.step));
  $('#bPause').textContent = 'Pause';
  $('#bPause').classList.remove('on');
  if (!run.looping){                 // pressing Draw again must NOT stack loops
    run.looping = true;              // -- that used to multiply the speed
    requestAnimationFrame(frame);
  }
}

function penAt(t, n){                       // sum the first n arms at time t
  let x = 0, y = 0;
  for (let i = 0; i < n; i++){
    const a = run.terms[i], ang = 2*Math.PI*a.freq*t + a.phase;
    x += a.amp * Math.cos(ang); y += a.amp * Math.sin(ang);
  }
  return [x, y];
}

function armChain(t, n){                    // every joint, for the circles
  let x = 0, y = 0;
  const pts = [[0, 0]];
  for (let i = 0; i < n; i++){
    const a = run.terms[i], ang = 2*Math.PI*a.freq*t + a.phase;
    x += a.amp * Math.cos(ang); y += a.amp * Math.sin(ang);
    pts.push([x, y]);
  }
  return pts;
}

function drawFrame(){
  const {w, h} = fitCanvas(mainCv, mainCx);
  const scale = Math.min(w, h) / (2 * run.margin);
  const px = p => [w/2 + p[0]*scale, h/2 - p[1]*scale];

  mainCx.clearRect(0, 0, w, h);
  const t = run.k / N_FRAMES;
  const joints = armChain(t, run.n);

  if (run.guide){                                     // dashed target
    mainCx.strokeStyle = cssVar('--target'); mainCx.lineWidth = 1;
    mainCx.setLineDash([5, 4]); mainCx.beginPath();
    run.shape.forEach((p, i) => { const q = px(p);
      i ? mainCx.lineTo(q[0], q[1]) : mainCx.moveTo(q[0], q[1]); });
    mainCx.closePath(); mainCx.stroke(); mainCx.setLineDash([]);
  }

  mainCx.strokeStyle = cssVar('--circle'); mainCx.lineWidth = 1;
  for (let i = 0; i < run.n; i++){                    // the circles
    const r = run.terms[i].amp * scale;
    if (r < 1.2) continue;
    const c = px(joints[i]);
    mainCx.beginPath(); mainCx.arc(c[0], c[1], r, 0, 6.2832); mainCx.stroke();
  }

  mainCx.strokeStyle = cssVar('--arm'); mainCx.lineWidth = 1.2;
  mainCx.beginPath();                                 // the arms
  joints.forEach((p, i) => { const q = px(p);
    i ? mainCx.lineTo(q[0], q[1]) : mainCx.moveTo(q[0], q[1]); });
  mainCx.stroke();

  if (run.trace.length > 1){                          // the pen's path
    mainCx.strokeStyle = run.colour; mainCx.lineWidth = 2;
    mainCx.lineJoin = 'round'; mainCx.beginPath();
    run.trace.forEach((p, i) => { const q = px(p);
      i ? mainCx.lineTo(q[0], q[1]) : mainCx.moveTo(q[0], q[1]); });
    mainCx.stroke();
  }
  $('#title').textContent =
    `${run.n} of ${run.terms.length} epicycles   |   speed ${run.step}x` +
    (run.paused ? '   |   paused' : '');
}

function buildWaves(){                      // recomputed only when n changes
  const M = 800, x = new Float64Array(M), y = new Float64Array(M);
  for (let i = 0; i < M; i++){
    const p = penAt(i / M, run.n);
    x[i] = p[0]; y[i] = p[1];
  }
  run.waves = {x, y};
}

function drawWaves(){
  const {w, h} = fitCanvas(waveCv, waveCx);
  if (!run.waves) buildWaves();
  waveCx.clearRect(0, 0, w, h);
  const pad = 34, ph = (h - pad) / 3;
  const t = run.k / N_FRAMES;
  const panels = [
    {name:'x(t)',        data:run.waves.x, col:cssVar('--x'), span:run.margin},
    {name:'y(t)',        data:run.waves.y, col:cssVar('--y'), span:run.margin},
    {name:'x(t) + y(t)', data:null,        col:cssVar('--sum'), span:run.margin*2}
  ];
  panels.forEach((p, idx) => {
    const top = 8 + idx * ph, mid = top + ph/2 - 6;
    waveCx.strokeStyle = cssVar('--grid'); waveCx.lineWidth = 1;
    waveCx.beginPath(); waveCx.moveTo(pad, mid); waveCx.lineTo(w-8, mid); waveCx.stroke();
    waveCx.fillStyle = p.col; waveCx.font = '600 13px system-ui';
    waveCx.fillText(p.name, 6, top + 15);

    const M = run.waves.x.length, sy = (ph/2 - 22) / p.span;
    waveCx.strokeStyle = p.col; waveCx.lineWidth = 1.6; waveCx.beginPath();
    for (let i = 0; i < M; i++){
      const v = p.data ? p.data[i] : run.waves.x[i] + run.waves.y[i];
      const X = pad + (w - pad - 8) * i / M, Y = mid - v * sy;
      i ? waveCx.lineTo(X, Y) : waveCx.moveTo(X, Y);
    }
    waveCx.stroke();

    const X = pad + (w - pad - 8) * t;                 // time cursor
    waveCx.strokeStyle = cssVar('--cursor'); waveCx.lineWidth = 1;
    waveCx.beginPath(); waveCx.moveTo(X, top); waveCx.lineTo(X, top + ph - 8);
    waveCx.stroke();
    const pen = penAt(t, run.n);
    const v = p.data ? (idx ? pen[1] : pen[0]) : pen[0] + pen[1];
    waveCx.fillStyle = cssVar('--fg');
    waveCx.beginPath(); waveCx.arc(X, mid - v * sy, 3, 0, 6.2832); waveCx.fill();
  });
  waveCx.fillStyle = cssVar('--dim'); waveCx.font = '10px system-ui';
  waveCx.fillText('t  (one full lap)', w - 96, h - 4);
}

function frame(){
  if (!run.paused){
    const t0 = run.k / N_FRAMES;
    for (let i = 0; i < TRACE_DETAIL; i++)          // smooth trace, any speed
      run.trace.push(penAt(t0 + i * run.step / N_FRAMES / TRACE_DETAIL, run.n));
    run.k = (run.k + run.step) % N_FRAMES;
    const keep = Math.max(200, N_FRAMES * TRACE_DETAIL / run.step);
    if (run.trace.length > keep) run.trace.splice(0, run.trace.length - keep);
  }
  if (run.view === 'setup' || run.view === 'maths'){
    requestAnimationFrame(frame); return;
  }
  if (cam.open) draw3d();
  else { drawFrame(); if (!run.big) drawWaves(); }
  requestAnimationFrame(frame);
}