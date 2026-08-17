/*  sources.js

    Turning things into points: built-in shapes, text, images,
    svg and csv. Everything here returns [[x, y], ...].
*/

// ==========================================================
// SOURCES — shapes, text, images, svg, csv, mouse
// ==========================================================
const SHAPES = {
  circle:{r:10, n:200},
  polygon:{sides:6, r:10},
  star:{points:5, r_outer:10, r_inner:4},
  flower:{petals:7, r:10, depth:0.35, n:400},
  gear:{teeth:12, r:10, tooth:1.5, n:600},
  heart:{scale:0.6, n:400},
  spirograph:{R:10, r:3.1, d:6, n:2000, turns:31},
  diamond:{}
};
const SHAPE_HELP = {
  n:'how many points', r:'radius', scale:'overall size',
  sides:'number of sides', points:'number of spikes',
  r_outer:'tip radius', r_inner:'inner corner radius',
  petals:'number of petals', depth:'how deep the petals cut (0-1)',
  teeth:'number of teeth', tooth:'tooth height',
  R:'big fixed circle', d:'pen distance from its centre',
  turns:'laps before it repeats'
};
const SHAPE_HELP_BY = {
  gear:{r:'radius at mid-tooth'}, flower:{r:'average radius'},
  spirograph:{r:'small rolling circle'}
};
const helpFor = (shape, key) =>
  (SHAPE_HELP_BY[shape] || {})[key] || SHAPE_HELP[key] || '';

function makeShape(name, p){
  const out = [], TAU = Math.PI * 2;
  const push = (x, y) => out.push([x, y]);
  if (name === 'circle')
    for (let i=0;i<p.n;i++){const t=TAU*i/p.n; push(p.r*Math.cos(t), p.r*Math.sin(t));}
  else if (name === 'polygon')
    for (let i=0;i<p.sides;i++){const t=TAU*i/p.sides; push(p.r*Math.cos(t), p.r*Math.sin(t));}
  else if (name === 'star')
    for (let i=0;i<2*p.points;i++){
      const t=TAU*i/(2*p.points), r=i%2?p.r_inner:p.r_outer;
      push(r*Math.cos(t), r*Math.sin(t));
    }
  else if (name === 'flower')
    for (let i=0;i<p.n;i++){
      const t=TAU*i/p.n, rr=p.r*(1+p.depth*Math.cos(p.petals*t));
      push(rr*Math.cos(t), rr*Math.sin(t));
    }
  else if (name === 'gear')
    for (let i=0;i<p.n;i++){
      const t=TAU*i/p.n, rr=p.r+p.tooth*Math.tanh(4*Math.sin(p.teeth*t));
      push(rr*Math.cos(t), rr*Math.sin(t));
    }
  else if (name === 'heart')
    for (let i=0;i<p.n;i++){
      const t=TAU*i/p.n;
      push(16*Math.pow(Math.sin(t),3)*p.scale,
           (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))*p.scale);
    }
  else if (name === 'spirograph')
    for (let i=0;i<p.n;i++){
      const t=TAU*p.turns*i/p.n, k=(p.R-p.r)/p.r;
      push((p.R-p.r)*Math.cos(t)+p.d*Math.cos(k*t),
           (p.R-p.r)*Math.sin(t)-p.d*Math.sin(k*t));
    }
  else if (name === 'diamond'){
    const V={A:[140,45],B:[275,32],C:[410,45],L:[25,205],R:[525,205],
             P:[275,510],G1:[165,205],G2:[385,205]};
    const route=['L','A','B','C','R','P','L','G1','G2','R','C','G2','B','G1',
                 'P','G2','G1','A'];
    route.forEach(k => push(V[k][0], -V[k][1]));
  }
  return normalise(out);
}

// ---- images: threshold, then trace every contour ----
function pointsFromImage(img, {lineArt = true, invert = false, n = 3000,
                               minLen = 25, maxShapes = 40} = {}){
  const scale = Math.min(1, 900 / Math.max(img.width, img.height));
  const w = Math.max(2, Math.round(img.width * scale));
  const h = Math.max(2, Math.round(img.height * scale));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', {willReadFrequently:true});
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);   // flatten transparency
  cx.drawImage(img, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h).data;

  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++)
    gray[i] = (data[i*4]*0.299 + data[i*4+1]*0.587 + data[i*4+2]*0.114) | 0;

  let lo = 255, hi = 0;
  for (const v of gray){ if (v < lo) lo = v; if (v > hi) hi = v; }
  if (hi - lo < 2) throw new Error('that image is one flat colour — nothing to trace');

  const thr = otsu(gray);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++)
    mask[i] = (gray[i] <= thr) !== invert ? 1 : 0;   // otsu's t is
                                                     // inclusive

  let contours = traceAll(mask, w, h, minLen);
  if (!contours.length) throw new Error('no shape found — try the invert option');
  contours = contours.map(c => c.map(p => [p[0], -p[1]]));      // y grows down
  if (!lineArt) contours = [contours[0]];
  return chainPieces(contours.slice(0, maxShapes), n);
}

// ---- text: render the glyphs, then trace them like any image ----
function pointsFromText(text, {font = 'sans-serif', weight = 'normal',
                               n = 3000} = {}){
  const size = 300, pad = 60;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${weight} ${size}px ${font}`;
  const w = Math.ceil(probe.measureText(text).width) + pad * 2;
  const h = size * 1.6 + pad * 2;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', {willReadFrequently:true});
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
  cx.fillStyle = '#000';
  cx.font = `${weight} ${size}px ${font}`;
  cx.textBaseline = 'middle';
  cx.fillText(text, pad, h / 2);
  const img = new Image();
  return new Promise(res => {
    img.onload = () => res(pointsFromImage(img, {lineArt:true, n, minLen:20}));
    img.src = cv.toDataURL();
  });
}

// ---- svg: let the browser walk the paths for us ----
function pointsFromSvg(svgText, {n = 3000, longestOnly = false} = {}){
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0';
  host.appendChild(svg);
  document.body.appendChild(host);

  const pieces = [];
  try {
    const tags = 'path,polygon,polyline,line,rect,circle,ellipse';
    for (const el of svg.querySelectorAll(tags)){
      let len = 0;
      try { len = el.getTotalLength(); } catch (e) { continue; }
      if (!len) continue;
      const steps = Math.max(16, Math.min(1500, Math.round(len / 1.2)));
      const m = el.getCTM();
      const pts = [];
      for (let i = 0; i < steps; i++){
        const p = el.getPointAtLength(len * i / steps);
        const x = m ? m.a*p.x + m.c*p.y + m.e : p.x;
        const y = m ? m.b*p.x + m.d*p.y + m.f : p.y;
        pts.push([x, -y]);                       // svg y grows down
      }
      pieces.push(pts);
    }
  } finally { host.remove(); }

  if (!pieces.length) throw new Error('no drawable paths in that svg');
  pieces.sort((a, b) => b.length - a.length);
  return chainPieces(longestOnly ? [pieces[0]] : pieces, n);
}

function pointsFromCsv(text){
  const pts = text.trim().split(/\r?\n/).map(line => {
    const parts = line.split(/[,;\s]+/).filter(Boolean).map(Number);
    return parts.length >= 2 && parts.every(v => isFinite(v))
      ? [parts[0], parts[1]] : null;
  }).filter(Boolean);
  if (pts.length < 3) throw new Error('that csv has fewer than 3 usable points');
  return normalise(pts);
}
