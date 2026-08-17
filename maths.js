/*  maths.js

    The maths view: the terms written out, the amplitude spectrum,
    convergence, and the symmetry check.
*/

// ==========================================================
// MATHS VIEW
// ==========================================================
function gcdAll(nums){
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  return nums.reduce((a, b) => gcd(a, Math.abs(b)), 0);
}

function drawMaths(){
  const terms = run.terms, n = run.n;

  // --- the first terms as a formula ---
  const rows = terms.slice(0, 8).map((t, i) =>
    `<div><span class="k">k=${String(i).padStart(2)}</span>  ` +
    `${t.amp.toFixed(3).padStart(8)} · cos(2π·${String(t.freq).padStart(4)}·t ` +
    `${t.phase < 0 ? '−' : '+'} ${Math.abs(t.phase).toFixed(3)})</div>`).join('');
  $('#formula').innerHTML =
    '<div class="hint">x(t) =</div>' + rows +
    '<div class="hint">…and the same with sin for y(t)</div>';

  // --- amplitude spectrum, log-log ---
  const sc = $('#spectrum'), sx = sc.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  sc.width = sc.clientWidth*dpr; sc.height = 220*dpr; sx.setTransform(dpr,0,0,dpr,0,0);
  const W = sc.clientWidth, H = 220, pad = 34;
  sx.clearRect(0,0,W,H);
  const amps = terms.map(t => Math.max(t.amp, 1e-12));
  const top = amps[0], lo = Math.max(top*1e-6, 1e-9);
  const px = i => pad + (W-pad-10) * Math.log10(i+1) / Math.log10(terms.length+1);
  const py = a => 12 + (H-34) * (Math.log10(top) - Math.log10(a)) /
                              (Math.log10(top) - Math.log10(lo));
  sx.strokeStyle = '#242424';
  [0,1,2,3,4,5,6].forEach(d => {                       // decades
    const a = top / Math.pow(10, d);
    if (a < lo) return;
    const y = py(a);
    sx.beginPath(); sx.moveTo(pad, y); sx.lineTo(W-10, y); sx.stroke();
    sx.fillStyle = '#5a5a5a'; sx.font = '9px system-ui';
    sx.fillText('1e-' + d, 4, y+3);
  });
  sx.strokeStyle = 'rgba(180,140,255,.45)'; sx.lineWidth = 1;   // a 1/k guide
  sx.beginPath();
  for (let i = 0; i < terms.length; i++){
    const g = top / (i+1), x = px(i), y = py(Math.max(g, lo));
    i ? sx.lineTo(x,y) : sx.moveTo(x,y);
  }
  sx.stroke();
  sx.strokeStyle = run.colour; sx.lineWidth = 1.6; sx.beginPath();
  amps.forEach((a, i) => { const x = px(i), y = py(Math.max(a, lo));
    i ? sx.lineTo(x,y) : sx.moveTo(x,y); });
  sx.stroke();
  const cut = px(n-1);                                  // where the slider sits
  sx.strokeStyle = 'rgba(232,232,232,.4)'; sx.setLineDash([4,3]);
  sx.beginPath(); sx.moveTo(cut, 8); sx.lineTo(cut, H-14); sx.stroke();
  sx.setLineDash([]);
  sx.fillStyle = '#8b8b8b'; sx.font = '10px system-ui';
  sx.fillText('term number (log)', W-116, H-2);
  sx.fillText('slider: ' + n, Math.min(cut+4, W-70), 12);

  // --- convergence ---
  const cc = $('#converge'), cxr = cc.getContext('2d');
  cc.width = cc.clientWidth*dpr; cc.height = 200*dpr; cxr.setTransform(dpr,0,0,dpr,0,0);
  const W2 = cc.clientWidth, H2 = 200;
  cxr.clearRect(0,0,W2,H2);
  const total = amps.reduce((a,b) => a+b, 0);
  let acc = 0; const share = amps.map(a => (acc += a) / total);
  cxr.strokeStyle = '#242424';
  [0, 0.5, 0.9, 1].forEach(v => {
    const y = H2-20 - (H2-40)*v;
    cxr.beginPath(); cxr.moveTo(34, y); cxr.lineTo(W2-10, y); cxr.stroke();
    cxr.fillStyle = '#5a5a5a'; cxr.font = '9px system-ui';
    cxr.fillText((v*100) + '%', 4, y+3);
  });
  cxr.strokeStyle = run.colour; cxr.lineWidth = 1.8; cxr.beginPath();
  share.forEach((v, i) => {
    const x = 34 + (W2-44) * Math.log10(i+1)/Math.log10(terms.length+1);
    const y = H2-20 - (H2-40)*v;
    i ? cxr.lineTo(x,y) : cxr.moveTo(x,y);
  });
  cxr.stroke();
  const need = p => { for (let i=0;i<share.length;i++) if (share[i]>=p) return i+1;
                      return share.length; };
  $('#convText').innerHTML =
    `<b>${(share[n-1]*100).toFixed(2)}%</b> at your current ${n} arms &nbsp;·&nbsp; ` +
    `90% needs ${need(0.9)} &nbsp;·&nbsp; 99% needs ${need(0.99)} ` +
    `&nbsp;·&nbsp; 99.9% needs ${need(0.999)}`;

  // --- symmetry ---
  const big = terms.slice(0, Math.min(12, terms.length)).filter(t => t.amp > terms[0].amp*1e-3);
  const diffs = big.map(t => t.freq - 1).filter(d => d !== 0);
  const m = diffs.length ? gcdAll(diffs) : 0;
  const list = big.slice(0, 10).map(t => t.freq).join(', ');
  $('#symmetry').innerHTML = (m > 1)
    ? `<p class="hint">Frequencies in use: ${list}</p>` +
      `<p>Every one of them is <b>1 more than a multiple of ${m}</b>, which is ` +
      `what ${m}-fold rotational symmetry looks like in the frequency domain. ` +
      `Turn the shape by a ${m}th of a turn and it lands on itself, so only ` +
      `those frequencies can survive.</p>`
    : `<p class="hint">Frequencies in use: ${list}</p>` +
      `<p>No common pattern — this shape has no rotational symmetry, so it ` +
      `draws on frequencies of every kind. A star or a gear would use only ` +
      `frequencies 1 more than a multiple of its point count.</p>`;
}
