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
  const key = $('#source').value, v = state.values;

  if (key === 'shape') return makeShape(v.shape, state.shapeParams);
  if (key === 'text')  return pointsFromText(v.text || 'π',
                          {font:v.font, weight:v.weight, n:+v.n || 3000});
  if (key === 'draw')  return sketch();

  if (!state.file) throw new Error('choose a file first — drop one on the page');
  const ext = (state.file.name.split('.').pop() || '').toLowerCase();
  const n = +v.n || 3000;

  if (key === 'csv' || (key === 'file' && ['csv','txt'].includes(ext)))
    return pointsFromCsv(await readFile(state.file, 'text'));

  if (key === 'svg' || (key === 'file' && ext === 'svg'))
    return pointsFromSvg(await readFile(state.file, 'text'),
                         {n, longestOnly:!!v.longestOnly});

  const img = await loadImage(await readFile(state.file, 'url'));
  const lineArt = key === 'image' || (key === 'file' && v.mode !== 'silhouette');
  return pointsFromImage(img, {lineArt, n, invert:!!v.invert,
                               minLen:+v.minLen || 25,
                               maxShapes:+v.maxShapes || 40});
}

// ---- the mouse sketch pad ----
function sketch(){
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:#0c0c0c;z-index:20;'+
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px';
    wrap.innerHTML = '<div class="hint">drag to draw, then press Done</div>';
    const cv = document.createElement('canvas');
    cv.width = 620; cv.height = 620;
    cv.style.cssText = 'background:#141414;border:1px solid #2a2a2a;border-radius:8px;'+
                       'width:620px;height:620px;cursor:crosshair';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px';
    bar.innerHTML = '<button id="skUndo">Undo</button>'+
                    '<button id="skClear">Clear</button>'+
                    '<button id="skDone" style="background:#1d4f6b">Done</button>';
    wrap.append(cv, bar);
    document.body.appendChild(wrap);

    const cx = cv.getContext('2d');
    let pts = [], marks = [], drawing = false;

    const paint = () => {
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.strokeStyle = '#4dc3ff'; cx.lineWidth = 2;
      cx.beginPath();
      pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]));
      cx.stroke();
      if (pts.length > 2){                       // the closing edge
        cx.strokeStyle = '#555'; cx.setLineDash([5, 4]);
        cx.beginPath();
        cx.moveTo(pts[pts.length-1][0], pts[pts.length-1][1]);
        cx.lineTo(pts[0][0], pts[0][1]); cx.stroke(); cx.setLineDash([]);
      }
      wrap.firstChild.textContent = `drag to draw, then press Done   —   ${pts.length} points`;
    };
    const at = e => {
      const r = cv.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    cv.onpointerdown = e => { drawing = true; marks.push(pts.length);
                              pts.push(at(e)); paint(); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (drawing){ pts.push(at(e)); paint(); } };
    cv.onpointerup   = () => drawing = false;
    bar.querySelector('#skUndo').onclick  = () => { if (marks.length) pts.length = marks.pop(); paint(); };
    bar.querySelector('#skClear').onclick = () => { pts = []; marks = []; paint(); };
    bar.querySelector('#skDone').onclick  = () => {
      wrap.remove();
      if (pts.length < 3) return resolve(makeShape('star', SHAPES.star));
      resolve(normalise(pts.map(p => [p[0], -p[1]])));
    };
    paint();
  });
}
