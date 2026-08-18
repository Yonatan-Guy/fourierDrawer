/*  math.js

    FFT, resampling, thresholding, contour tracing, chaining.
    Pure maths — no DOM, nothing browser-specific.
*/

// ---------- math core (shared by the page; kept separate so it can be tested) ----------

function fft(re, im) {                     // in-place, N must be a power of two
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {     // bit reversal
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function resample(pts, n) {                // walk the closed outline at constant speed
  const m = pts.length;
  const dist = [0];
  for (let i = 1; i <= m; i++) {
    const a = pts[i - 1], b = pts[i % m];
    dist.push(dist[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = dist[m];
  const out = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = total * i / n;
    while (j < m && dist[j + 1] < t) j++;
    const span = dist[j + 1] - dist[j] || 1;
    const f = (t - dist[j]) / span;
    const a = pts[j % m], b = pts[(j + 1) % m];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
}

function center(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  return pts.map(p => [p[0] - cx, p[1] - cy]);
}

function fourier(shape, maxArms) {         // shape: centred [[x,y]...], length a power of 2
  const n = shape.length;
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { re[i] = shape[i][0]; im[i] = shape[i][1]; }
  fft(re, im);
  const terms = [];
  for (let k = 0; k < n; k++) {
    const a = re[k] / n, b = im[k] / n;
    terms.push({ amp: Math.hypot(a, b), phase: Math.atan2(b, a),
                 freq: k <= n / 2 ? k : k - n });
  }
  terms.sort((p, q) => q.amp - p.amp);
  return terms.slice(0, maxArms);
}

function otsu(gray) {                      // gray: Uint8 values
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * Math.pow(sumB / wB - (sum - sumB) / wF, 2);
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

function traceAll(mask, w, h, minLen = 12) {   // Moore-neighbour boundary tracing
  const ring = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  const at = (r, c) => (r < 0 || c < 0 || r >= h || c >= w) ? 0 : mask[r * w + c];
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (!at(r, c) || seen[r * w + c] || at(r, c - 1)) continue;
      let back = 6, pr = r, pc = c;
      const path = [[c, r]];
      for (let guard = 0; guard < 4 * w * h; guard++) {
        let moved = false;
        for (let k = 1; k <= 8; k++) {
          const d = (back + k) % 8;
          const nr = pr + ring[d][0], nc = pc + ring[d][1];
          if (at(nr, nc)) { back = (d + 5) % 8; pr = nr; pc = nc; moved = true; break; }
        }
        if (!moved) break;
        if (pr === r && pc === c) break;
        path.push([pc, pr]);
      }
      for (const p of path) seen[p[1] * w + p[0]] = 1;
      if (path.length >= minLen) out.push(path);
    }
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

function nearestPair(a, b, budget){          // closest points between two sets
  budget = budget || 600;
  const sa = Math.max(1, Math.ceil(a.length / budget));
  const sb = Math.max(1, Math.ceil(b.length / budget));
  let bi = 0, bj = 0, bd = Infinity;
  for (let i = 0; i < a.length; i += sa)
    for (let j = 0; j < b.length; j += sb){
      const d = (a[i][0]-b[j][0])**2 + (a[i][1]-b[j][1])**2;
      if (d < bd){ bd = d; bi = i; bj = j; }
    }
  const loA = Math.max(0, bi-sa), hiA = Math.min(a.length, bi+sa+1);
  const loB = Math.max(0, bj-sb), hiB = Math.min(b.length, bj+sb+1);
  bd = Infinity; let fi = bi, fj = bj;
  for (let i = loA; i < hiA; i++)
    for (let j = loB; j < hiB; j++){
      const d = (a[i][0]-b[j][0])**2 + (a[i][1]-b[j][1])**2;
      if (d < bd){ bd = d; fi = i; fj = j; }
    }
  return [fi, fj];
}

function chainPieces(pieces, n){
  // Each loop is DETOURED INTO from the nearest point of the path so far, then
  // the pen returns along the same connector. Choosing a visit order first and
  // hopping between loops afterwards strands the pen at each loop's entry
  // point, which is what draws a long line straight across the picture.
  pieces = pieces.filter(p => p.length > 2).sort((a, b) => b.length - a.length);
  if (!pieces.length) throw new Error('nothing to chain');

  let path = pieces[0].concat([pieces[0][0]]);
  const left = pieces.slice(1);
  while (left.length){
    // Take whichever piece is CLOSEST to what is already drawn, not simply the
    // next biggest -- Prim's algorithm. Adding by size can splice in a far
    // piece early and leave a long line across the picture.
    let bk = 0, bi = 0, bj = 0, bd = Infinity;
    left.forEach((loop, k) => {
      const [i, j] = nearestPair(path, loop);
      const d = Math.hypot(path[i][0]-loop[j][0], path[i][1]-loop[j][1]);
      if (d < bd){ bd = d; bk = k; bi = i; bj = j; }
    });
    const loop = left.splice(bk, 1)[0];
    const branch = loop.slice(bj).concat(loop.slice(0, bj), [loop[bj]]);
    path = path.slice(0, bi + 1).concat(branch, path.slice(bi));  // out and back
  }
  return normalise(resample(path, n));
}

function normalise(pts) {                  // centre and scale to roughly +-10
  const c = center(pts);
  let max = 0;
  for (const p of c) max = Math.max(max, Math.hypot(p[0], p[1]));
  return max ? c.map(p => [p[0] / max * 10, p[1] / max * 10]) : c;
}