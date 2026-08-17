/*  view3d.js

    The 3D view: the space curve (t, x, y) and its three shadows.
*/

// ==========================================================
// 3D VIEW — the space curve (t, x, y) whose shadows are the
// drawing and the two waveforms
// ==========================================================
const cv3d = $('#cv3d'), cx3d = cv3d.getContext('2d');
const cam = {yaw:-0.9, pitch:0.5, open:false, toYaw:null, toPitch:null};

function faceTo(yaw, pitch, btn){      // glide there, so you keep your bearings
  cam.toYaw = yaw; cam.toPitch = pitch;
  document.querySelectorAll('#views3d button').forEach(b =>
    b.classList.toggle('on', b === btn));
}

function easeCamera(){
  if (cam.toYaw === null) return;
  const dy = cam.toYaw - cam.yaw, dp = cam.toPitch - cam.pitch;
  if (Math.abs(dy) < 1e-4 && Math.abs(dp) < 1e-4){
    cam.yaw = cam.toYaw; cam.pitch = cam.toPitch; cam.toYaw = null;
    return;
  }
  cam.yaw += dy * 0.18; cam.pitch += dp * 0.18;
}

function project(p, w, h){                 // orthographic, yaw then pitch
  const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const x =  p[0]*cy + p[1]*sy;
  const z = -p[0]*sy + p[1]*cy;
  const y =  p[2]*cp - z*sp;
  const s = Math.min(w, h) * 0.34;
  return [w/2 + x*s, h/2 - y*s];
}

function draw3d(){
  if (!cam.open) return;
  easeCamera();
  const dpr = window.devicePixelRatio || 1;
  const r = cv3d.getBoundingClientRect();
  cv3d.width = r.width*dpr; cv3d.height = r.height*dpr;
  cx3d.setTransform(dpr,0,0,dpr,0,0);
  const w = r.width, h = r.height;
  cx3d.clearRect(0,0,w,h);

  const M = 700, m = run.margin;
  const path = [], flat = [], onX = [], onY = [];
  for (let i = 0; i <= M; i++){
    const t = i / M, p = penAt(t, run.n);
    const T = t*2 - 1, X = p[0]/m, Y = p[1]/m;     // all into -1..1
    path.push([T, X, Y]);
    flat.push([-1, X, Y]);                          // the drawing, at t=0
    onX.push([T, X, -1]);                           // x(t) on the floor
    onY.push([T, 1, Y]);                            // y(t) on the far wall
  }

  const line = (pts, col, width) => {
    cx3d.strokeStyle = col; cx3d.lineWidth = width; cx3d.beginPath();
    pts.forEach((p, i) => { const q = project(p, w, h);
      i ? cx3d.lineTo(q[0], q[1]) : cx3d.moveTo(q[0], q[1]); });
    cx3d.stroke();
  };

  cx3d.strokeStyle = '#242424'; cx3d.lineWidth = 1;      // the box
  const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
                   [-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],
   [0,4],[1,5],[2,6],[3,7]].forEach(([a,b]) => {
    const p = project(corners[a], w, h), q = project(corners[b], w, h);
    cx3d.beginPath(); cx3d.moveTo(p[0],p[1]); cx3d.lineTo(q[0],q[1]); cx3d.stroke();
  });

  line(onX, 'rgba(77,195,255,.55)', 1);
  line(onY, 'rgba(255,179,71,.55)', 1);
  line(flat, 'rgba(255,255,255,.65)', 1.2);
  line(path, run.colour, 1.8);

  const t = run.k / N_FRAMES, pen = penAt(t, run.n);     // where the pen is now
  const now = project([t*2-1, pen[0]/m, pen[1]/m], w, h);
  cx3d.fillStyle = '#fff';
  cx3d.beginPath(); cx3d.arc(now[0], now[1], 4, 0, 6.2832); cx3d.fill();

  cx3d.fillStyle = '#8b8b8b'; cx3d.font = '11px system-ui';
  const lab = (p, s) => { const q = project(p, w, h); cx3d.fillText(s, q[0], q[1]); };
  lab([1.15,-1,-1], 't');  lab([-1,1.15,-1], 'x(t)');  lab([-1,-1,1.15], 'y(t)');
  const near = (a, b) => Math.abs(a - b) < 0.02;
  const note = near(cam.yaw, 1.5708) && near(cam.pitch, 0)
      ? 'looking down the time axis — this is the drawing itself'
    : near(cam.yaw, 0) && near(cam.pitch, -1.5708)
      ? 'x against t — every epicycle is one cosine in here'
    : near(cam.yaw, 0) && near(cam.pitch, 0)
      ? 'y against t — the same terms as sines'
    : '';
  if (note){ cx3d.fillStyle = '#6b6b6b'; cx3d.fillText(note, 14, 22); }
  cx3d.fillStyle = '#6b6b6b';
  cx3d.fillText(run.n + ' epicycles', 14, h - 14);
}

let drag = null;
cv3d.addEventListener('pointerdown', e => {
  drag = [e.clientX, e.clientY]; cv3d.setPointerCapture(e.pointerId);
});
cv3d.addEventListener('pointermove', e => {
  if (!drag) return;
  cam.yaw   += (e.clientX - drag[0]) * 0.01;
  cam.pitch += (e.clientY - drag[1]) * 0.01;
  cam.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, cam.pitch));
  cam.toYaw = null;                                  // a drag beats a preset
  document.querySelectorAll('#views3d button').forEach(b => b.classList.remove('on'));
  drag = [e.clientX, e.clientY];
});

document.querySelectorAll('#views3d button').forEach(b =>
  b.onclick = () => faceTo(+b.dataset.yaw, +b.dataset.pitch, b));
cv3d.addEventListener('pointerup', () => drag = null);
