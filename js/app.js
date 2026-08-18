/*  app.js

    Routing between views, the control bar, keyboard shortcuts,
    and startup. Loaded last — everything else must exist first.
*/

// ==========================================================
// ROUTING — one page, four history entries, so the browser's
// back button steps back through the app instead of leaving it
// ==========================================================
const VIEWS = ['setup', 'draw', 'big', '3d', 'maths'];

function currentView(){
  const v = (location.hash || '').replace(/^#\/?/, '');
  return VIEWS.includes(v) ? v : 'setup';
}

function applyView(v){
  if (v !== 'setup' && !run.terms.length) v = 'setup';   // nothing drawn yet
  $('#setup').style.display = v === 'setup' ? 'flex' : 'none';
  $('#app').style.display   = v === 'setup' ? 'none' : 'grid';
  $('#view3d').style.display = v === '3d' ? 'block' : 'none';
  $('#maths').style.display  = v === 'maths' ? 'block' : 'none';
  $('#bMath').classList.toggle('on', v === 'maths');
  if (v === 'maths') drawMaths();
  cam.open = v === '3d';
  run.big  = v === 'big';
  $('#stage').classList.toggle('big', run.big);
  $('#bBig').classList.toggle('on', run.big);
  $('#b3d').classList.toggle('on', cam.open);
  document.title = v === 'setup' ? 'Fourier drawing'
                                 : 'Fourier drawing — ' + v;
  run.view = v;
  if (v === 'draw') setTimeout(placeWaveInfo, 30);
}

function go(v){                       // adds a history entry
  if (currentView() === v) applyView(v);
  else location.hash = '#/' + v;
}

addEventListener('hashchange', () => {
  const v = currentView();
  if (v !== 'setup' && !run.terms.length){    // deep link with nothing loaded
    location.replace('#/setup');
    return;
  }
  applyView(v);
});

// ==========================================================
// THEME  — dark by default, remembered between visits
// ==========================================================
function setTheme(name){
  document.documentElement.dataset.theme = name;
  localStorage.setItem('theme', name);
  $('#themeBtn').textContent = name === 'light' ? '☾ dark' : '☀ light';
  clearThemeCache();          // the canvases re-read the colours next frame

  // neon green vanishes on a white page, so move the pen with the theme --
  // unless the user picked a colour themselves, in which case leave it alone
  const pen = $('#penColour');
  if (!pen.dataset.chosen){
    pen.value = cssVar('--trace');     // one place decides: the theme block
    run.colour = pen.value;
  }
  if (run.view === 'maths') drawMaths();
}
['#maxArms', '#startArms'].forEach(sel => {
  // 'change' as well as 'input': a paste-then-click-away, or the spinner
  // arrows in some browsers, only fire the former.
  const mine = e => e.target.dataset.chosen = '1';       // yours now, not auto
  $(sel).addEventListener('input', mine);
  $(sel).addEventListener('change', mine);
});
$('#penColour').oninput = e => {
  e.target.dataset.chosen = '1';
  run.colour = e.target.value;
};
setTheme(localStorage.getItem('theme') || 'dark');
$('#themeBtn').onclick = () =>
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// the three little i badges sit beside the waveform panels
function placeWaveInfo(){
  const host = $('#waveInfo');
  if (!host) return;
  const h = host.getBoundingClientRect().height;
  const ph = (h - 34) / 3;
  host.querySelectorAll('.info').forEach((b, i) => {
    b.style.top = (10 + i * ph) + 'px';
  });
}
addEventListener('resize', placeWaveInfo);
setTimeout(placeWaveInfo, 60);

// ==========================================================
// TOOLTIPS  — hover on a desktop, tap on a phone. title="" only
// appears on hover, which no touch screen has.
// ==========================================================
const tip = $('#tip');
let tipFor = null;

function showTip(btn){
  tip.textContent = btn.dataset.tip;
  tip.classList.add('on');
  document.querySelectorAll('.info').forEach(b => b.classList.toggle('on', b === btn));
  const r = btn.getBoundingClientRect();
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, innerWidth - w - 8));
  let top = r.bottom + 8;
  if (top + h > innerHeight - 8) top = r.top - h - 8;   // flip above if needed
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tipFor = btn;
}

function hideTip(){
  tip.classList.remove('on');
  document.querySelectorAll('.info').forEach(b => b.classList.remove('on'));
  tipFor = null;
}

document.querySelectorAll('.info').forEach(btn => {
  btn.onclick = e => {
    e.stopPropagation();
    // On a phone a tap toggles. With a mouse the hover already opened it,
    // so a click must not immediately close it again.
    const touch = !matchMedia('(hover:hover)').matches;
    (touch && tipFor === btn) ? hideTip() : showTip(btn);
  };
  btn.onmouseenter = () => { if (matchMedia('(hover:hover)').matches) showTip(btn); };
  btn.onmouseleave = () => { if (matchMedia('(hover:hover)').matches) hideTip(); };
});
addEventListener('click', hideTip);
addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
addEventListener('resize', hideTip);

// ==========================================================
// CONTROLS
// ==========================================================
SPEEDS.forEach(sp => {
  const b = document.createElement('button');
  b.textContent = sp + 'x'; b.dataset.sp = sp;
  b.onclick = () => {
    run.step = sp;
    document.querySelectorAll('#speeds button').forEach(o =>
      o.classList.toggle('on', o === b));
  };
  $('#speeds').appendChild(b);
});

$('#arms').oninput = e => {
  run.n = +e.target.value;                 // no reset, no pause: the pen keeps
  $('#armsVal').textContent = run.n;       // going and the old detail scrolls off
  run.waves = null;
  if (run.view === 'maths') drawMaths();
};
const toggleGuide = () => { run.guide = !run.guide; $('#bGuide').classList.toggle('on', run.guide); };
const togglePause = () => {
  run.paused = !run.paused;
  $('#bPause').textContent = run.paused ? 'Play' : 'Pause';
  $('#bPause').classList.toggle('on', run.paused);
};
const toggleBig = () => go(run.big ? 'draw' : 'big');
$('#bGuide').onclick = toggleGuide;
$('#bPause').onclick = togglePause;
$('#bClear').onclick = () => run.trace = [];
$('#bBig').onclick   = toggleBig;
const toggle3d = () => go(cam.open ? 'draw' : '3d');
$('#b3d').onclick     = toggle3d;
$('#bMath').onclick   = () => go(run.view === 'maths' ? 'draw' : 'maths');
$('#closeMath').onclick = () => history.back();
$('#close3d').onclick = () => history.back();
$('#bSave').onclick  = () => {
  const link = document.createElement('a');
  const out = document.createElement('canvas');
  out.width = mainCv.width; out.height = mainCv.height;
  const cx = out.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, out.width, out.height);
  cx.drawImage(mainCv, 0, 0);
  link.download = 'fourier-' + Date.now() + '.png';
  link.href = out.toDataURL();
  link.click();
};
$('#bSettings').onclick = () => go('setup');            // same panel, still filled in
$('#bHome').onclick = () => { showKind(null); go('setup'); };   // back to the tiles

addEventListener('keydown', e => {
  if ($('#app').style.display === 'none') return;
  if (e.key === ' '){ e.preventDefault(); togglePause(); }
  else if (e.key === 'h') toggleGuide();
  else if (e.key === 'c') run.trace = [];
  else if (e.key === 'b') toggleBig();
  else if (e.key === '3') toggle3d();
  else if (e.key === 'm') go(run.view === 'maths' ? 'draw' : 'maths');
  else if (e.key === 'Escape' && cam.open) history.back();
});

// ==========================================================
// TELEGRAM PING  — private, for the author's own curiosity.
// The token is not here; it lives in a Netlify environment variable that only
// netlify/functions/notify.js can read. Set NOTIFY to false (or delete this
// block and the function) before sharing the site with anyone.
// ==========================================================
const NOTIFY = true;

function shapeThumb(size = 420){
  // the outline it was asked to draw, before any epicycles got involved
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#0b0b0b'; cx.fillRect(0, 0, size, size);
  const m = run.margin || 14;
  const s = size / (2 * m);
  cx.strokeStyle = '#39ff14'; cx.lineWidth = 2; cx.lineJoin = 'round';
  cx.beginPath();
  run.shape.forEach((p, i) => {
    const x = size/2 + p[0]*s, y = size/2 - p[1]*s;
    i ? cx.lineTo(x, y) : cx.moveTo(x, y);
  });
  cx.closePath(); cx.stroke();
  return cv.toDataURL('image/png');
}

// The picture exactly as it was handed over. Big camera photos get scaled
// down first -- a function payload has a few MB to play with and base64 adds
// a third on top, so a 12 MP jpeg would bounce.
function sourceImage(file, maxPx = 1400, budget = 2.5e6){
  return new Promise(resolve => {
    const r = new FileReader();
    r.onerror = () => resolve(null);
    r.onload = () => {
      const url = r.result;
      if (!/^data:image\//.test(url)) return resolve(null);   // svg, csv...
      if (url.length < budget) return resolve(url);            // small enough
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const s = Math.min(1, maxPx / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        const cx = cv.getContext('2d');
        cx.fillStyle = '#fff';                        // flatten transparency
        cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.src = url;
    };
    r.readAsDataURL(file);
  });
}

async function notify(){
  if (!NOTIFY) return;
  const v = state.values;
  const detail = state.kind === 'shape' ? v.shape
               : state.kind === 'text'  ? v.text
               : state.fileName || '';

  // a picture sends the file itself; everything else has no source image, so
  // send the outline it was asked to draw
  let photo = null;
  if (state.kind === 'picture' && state.file) photo = await sourceImage(state.file);
  if (!photo) photo = shapeThumb();

  fetch('/.netlify/functions/notify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: state.kind, detail,
      arms: run.n, terms: run.terms.length, points: run.shape.length,
      photo, png: photo          // png kept for older deploys of the function
    })
  }).catch(() => {});          // offline, blocked, or running locally: ignore
}

$('#draw').onclick = async () => {
  const btn = $('#draw');
  btn.disabled = true; btn.textContent = 'working...';
  $('#err').textContent = '';
  try {
    const points = await getPoints();
    if (points === null) return;            // they backed out of the sketch pad
    if (!points || points.length < 3) throw new Error('that gave fewer than 3 points');
    start(points);
    notify();
  } catch (err) {
    $('#err').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Draw it';
  }
};
addEventListener('keydown', e => {
  if (e.key === 'Enter' && currentView() === 'setup') $('#draw').click();
});

// Clicking Fourier's portrait is a shortcut for the old "Fourier himself" tile:
// pick that source and start drawing in one step.
$('#fourierPortrait').onclick = () => { showKind('fourier'); $('#draw').click(); };

if (currentView() !== 'setup') location.replace('#/setup');   // fresh load
applyView('setup');