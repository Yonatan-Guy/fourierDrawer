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
const DEFAULT_PEN = {dark:'#39ff14', light:'#12912a'};

function setTheme(name){
  document.documentElement.dataset.theme = name;
  localStorage.setItem('theme', name);
  $('#themeBtn').textContent = name === 'light' ? '☾ dark' : '☀ light';
  clearThemeCache();          // the canvases re-read the colours next frame

  // neon green vanishes on a white page, so move the pen with the theme --
  // unless the user picked a colour themselves, in which case leave it alone
  const pen = $('#penColour');
  if (!pen.dataset.chosen){
    pen.value = DEFAULT_PEN[name];
    run.colour = pen.value;
  }
  if (run.view === 'maths') drawMaths();
}
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

$('#draw').onclick = async () => {
  const btn = $('#draw');
  btn.disabled = true; btn.textContent = 'working...';
  $('#err').textContent = '';
  try {
    const points = await getPoints();
    if (points === null) return;            // they backed out of the sketch pad
    if (!points || points.length < 3) throw new Error('that gave fewer than 3 points');
    start(points);
  } catch (err) {
    $('#err').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Draw it';
  }
};
addEventListener('keydown', e => {
  if (e.key === 'Enter' && currentView() === 'setup') $('#draw').click();
});

if (currentView() !== 'setup') location.replace('#/setup');   // fresh load
applyView('setup');