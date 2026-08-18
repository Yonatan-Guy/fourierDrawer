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
$('#bSetup').onclick = () => go('setup');

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
