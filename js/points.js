/*  points.js

    One entry point that reads the setup screen and produces the
    points, plus the mouse sketch pad.
*/

// ==========================================================
// GETTING THE POINTS  (one entry point, like get_points)
// ==========================================================
function readFile(file, as){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('could not read ' + file.name));
    as === 'text' ? r.readAsText(file) : r.readAsDataURL(file);
  });
}

function loadImage(url){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('that file is not an image the browser can read'));
    img.src = url;
  });
}

async function getPoints(){
  const v = state.values, kind = state.kind;

  if (kind === 'shape') return makeShape(v.shape, state.shapeParams);
  if (kind === 'text')  return pointsFromText(v.text || 'π',
                          {font:v.font, weight:v.weight, n:+v.n || 3000});
  if (kind === 'draw')  return sketch();
  if (kind === 'fourier') return pointsFromPreset('assets/fourier-points.json');

  if (!state.file) throw new Error('choose a picture first — or drop one on the page');
  const ext = (state.file.name.split('.').pop() || '').toLowerCase();
  const n = +v.n || 3000;

  // the extension decides what to do with it, so nobody has to
  if (['csv', 'txt'].includes(ext))
    return pointsFromCsv(await readFile(state.file, 'text'));
  if (ext === 'svg')
    return pointsFromSvg(await readFile(state.file, 'text'), {n});

  const img = await loadImage(await readFile(state.file, 'url'));
  return pointsFromImage(img, {lineArt: v.mode !== 'just the outline',
                               n, invert: !!v.invert,
                               minLen: 25, maxShapes: 40});
}

// ---- a built-in preset: points shipped with the site ----
// The file is a JSON array of [x,y] pairs, already traced, chained and
// normalised to +-10 -- the same output pointsFromImage would give, saved so
// the browser needn't re-trace an engraving every time. Fetched on demand, so
// it costs nothing until the tile is used.
async function pointsFromPreset(url){
  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (e) {
    throw new Error('could not load the built-in drawing (' + e.message + ')');
  }
  if (!Array.isArray(data) || data.length < 3)
    throw new Error('the built-in drawing looks empty');
  return data.map(p => [+p[0], +p[1]]);
}

// ---- the mouse sketch pad ----
// Cancelling resolves null, which the Draw handler treats as "never mind"
// rather than an error.
function sketch(){
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.id = 'sketch';
    wrap.innerHTML = '<div id="skHint" class="hint">drag to draw, then press Done</div>';

    const cv = document.createElement('canvas');
    cv.id = 'skCanvas';
    const side = Math.min(620, Math.min(innerWidth, innerHeight) - 150);
    cv.width = side; cv.height = side;
    cv.style.width = side + 'px'; cv.style.height = side + 'px';

    const bar = document.createElement('div');
    bar.id = 'skBar';
    bar.innerHTML =
      '<button id="skBack" class="back">← back</button>' +
      '<button id="skUndo">Undo</button>' +
      '<button id="skClear">Clear</button>' +
      '<button id="skDone" class="cta">Done</button>';
    wrap.append(cv, bar);
    document.body.appendChild(wrap);

    const cx = cv.getContext('2d');
    let pts = [], marks = [], drawing = false;

    const paint = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.strokeStyle = cssVar('--x'); cx.lineWidth = 2; cx.lineJoin = 'round';
      cx.beginPath();
      pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]));
      cx.stroke();
      if (pts.length > 2){                       // the closing edge
        cx.strokeStyle = cssVar('--target'); cx.setLineDash([5, 4]);
        cx.beginPath();
        cx.moveTo(pts[pts.length-1][0], pts[pts.length-1][1]);
        cx.lineTo(pts[0][0], pts[0][1]); cx.stroke(); cx.setLineDash([]);
      }
      wrap.querySelector('#skHint').textContent = pts.length
        ? `${pts.length} points — press Done when you are happy`
        : 'drag to draw, then press Done';
    };
    const at = e => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.onpointerdown = e => { drawing = true; marks.push(pts.length);
                              pts.push(at(e)); paint(); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (drawing){ pts.push(at(e)); paint(); } };
    cv.onpointerup   = () => drawing = false;

    const close = value => { wrap.remove(); resolve(value); };
    bar.querySelector('#skBack').onclick  = () => close(null);
    bar.querySelector('#skUndo').onclick  = () => { if (marks.length) pts.length = marks.pop(); paint(); };
    bar.querySelector('#skClear').onclick = () => { pts = []; marks = []; paint(); };
    bar.querySelector('#skDone').onclick  = () => {
      if (pts.length < 3){                       // nothing to draw yet
        const hint = wrap.querySelector('#skHint');
        hint.textContent = 'the drawing is empty — draw something first';
        hint.classList.add('warn');
        setTimeout(() => hint.classList.remove('warn'), 1800);
        return;
      }
      close(normalise(pts.map(p => [p[0], -p[1]])));
    };
    addEventListener('keydown', function esc(e){
      if (e.key === 'Escape' && document.body.contains(wrap)){
        removeEventListener('keydown', esc); close(null);
      }
    });
    paint();
  });
}