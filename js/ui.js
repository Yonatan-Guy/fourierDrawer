/*  ui.js

    The setup screen: four tiles instead of a source list, the fields each
    one shows, and file loading (picker, click, drag and drop).
*/

// ==========================================================
// SETUP SCREEN
// ==========================================================
const $ = s => document.querySelector(s);

// Whatever the markup says at load time IS the default. Snapshot it now so
// Home can put everything back without the defaults being written down twice.
const ADVANCED = ['#nSamples', '#maxArms', '#startArms', '#speed'];
const DEFAULTS = {};
addEventListener('DOMContentLoaded', () => {});          // (markup is already parsed)
ADVANCED.forEach(sel => DEFAULTS[sel] = document.querySelector(sel).value);

// Number inputs happily accept "+", "-" and "1e5" whatever their min says, so
// tidy the value when the box loses focus rather than fighting every keystroke.
function clampField(el, {min, max, int}){
  const fix = () => {
    // A number input reports "" for anything the browser refuses, such as
    // "+300" or "abc". Falling back to the last good value beats snapping to
    // the minimum, which loses what the person was doing.
    let v = parseFloat(el.value);
    if (!isFinite(v)) v = parseFloat(el.dataset.last);
    if (!isFinite(v)) v = min;
    v = Math.min(max, Math.max(min, v));
    if (int) v = Math.round(v);
    el.value = +v.toFixed(4);
    el.dataset.last = el.value;
  };
  el.addEventListener('change', fix);
  el.addEventListener('blur', fix);
  el.min = min; el.max = max;
  if (int) el.step = 1;
}

function resetAdvanced(){
  ADVANCED.forEach(sel => {
    const el = $(sel);
    el.value = DEFAULTS[sel];
    el.removeAttribute('data-chosen');      // epicycle counts go back to auto
  });
  const pen = $('#penColour');
  pen.removeAttribute('data-chosen');
  pen.value = getComputedStyle(document.documentElement)
                .getPropertyValue('--trace').trim();     // the theme's pen
  $('#advanced').open = false;
}
const state = {file:null, fileName:'', kind:null, values:{}, shapeParams:{}};

// One tile per thing a person actually wants to draw. The old eight-way
// source list was the code's model, not theirs -- extensions sort themselves
// out, and line art vs silhouette is a checkbox, not a separate mode.
// Fonts every machine has, so nobody types a name that silently falls back.
const FONTS = ['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana',
               'Trebuchet MS', 'Tahoma', 'Courier New', 'Impact',
               'Comic Sans MS', 'serif', 'sans-serif', 'monospace'];

const KINDS = {
  picture: {
    title:'A picture',
    blurb:'A logo or icon works best: flat colours, sharp edges, plain '
        + 'background. Photographs rarely trace well.',
    file:true,
    fields:[
      {k:'mode', t:'choice', label:'trace', v:'every line',
       opts:['every line','just the outline'],
       hint:'every line keeps letters and inner detail'},
      {k:'invert', t:'bool', label:'light on dark', v:false,
       hint:'tick if your shape is white on black'},
      {k:'n', t:'int', label:'detail', v:4000, hint:'more points = finer trace'}
    ]},
  text: {
    title:'Some text',
    blurb:'Each letter and each hole is drawn as its own loop, so short '
        + 'connector lines appear between them.',
    fields:[
      {k:'text', t:'str', label:'what to draw', v:'π',
       hint:'a letter, a word, a symbol'},
      {k:'font', t:'choice', label:'font', v:'Georgia', opts:FONTS,
       hint:'anything installed on your computer'},
      {k:'weight', t:'choice', label:'weight', v:'bold',
       opts:['bold','normal'], hint:'bold traces more thickly'},
      {k:'n', t:'int', label:'detail', v:4000, hint:'raise it for long words'}
    ]},
  shape: {
    title:'A ready shape',
    blurb:'Made from a formula, so it is exact. Good for seeing how many '
        + 'circles a shape actually needs.',
    fields:[{k:'shape', t:'shape', label:'shape', v:'star',
             hint:'its settings appear below'}]},
  draw: {
    title:'Draw it yourself',
    fields:[]}
};

function field(f, host){
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<label>${f.label}</label>`;
  const cell = document.createElement('span');
  let input;
  if (f.t === 'bool'){
    input = document.createElement('input'); input.type = 'checkbox';
    input.checked = !!f.v;
    state.values[f.k] = !!f.v;
    input.onchange = () => state.values[f.k] = input.checked;
  } else if (f.t === 'choice' || f.t === 'shape'){
    input = document.createElement('select');
    (f.t === 'shape' ? Object.keys(SHAPES) : f.opts)
      .forEach(o => input.add(new Option(o, o)));
    input.value = f.v;
    state.values[f.k] = f.v;
    input.onchange = () => {
      state.values[f.k] = input.value;
      if (f.t === 'shape') shapeParams(input.value);
    };
  } else {
    input = document.createElement('input');
    input.type = f.t === 'int' ? 'number' : 'text';
    input.value = f.v;
    state.values[f.k] = f.v;
    input.oninput = () =>
      state.values[f.k] = f.t === 'int' ? +input.value : input.value;
  }
  cell.appendChild(input);
  row.appendChild(cell);
  const hint = document.createElement('span');
  hint.className = 'hint';
  hint.textContent = f.hint || '';
  row.appendChild(hint);
  host.appendChild(row);
}

function shapeParams(name){
  const old = $('#shapeParams');
  if (old) old.remove();
  const box = document.createElement('div');
  box.id = 'shapeParams';
  state.shapeParams = {};
  const defs = SHAPES[name];
  if (!Object.keys(defs).length){
    box.innerHTML = '<span class="hint">this one has no settings</span>';
  } else {
    for (const [k, v] of Object.entries(defs)){
      state.shapeParams[k] = v;
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<label>${labelFor(name, k)}</label>`;
      const cell = document.createElement('span');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.value = v;
      inp.step = Number.isInteger(v) ? 1 : 0.1;
      const range = rangeFor(k);
      clampField(inp, {int: Number.isInteger(v), ...range});   // range wins
      const store = () => state.shapeParams[k] = +inp.value;
      inp.oninput = store;
      inp.addEventListener('change', store);   // after clamping, save the fix
      cell.appendChild(inp); row.appendChild(cell);
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = `${helpFor(name, k)}   (default ${v})`;
      row.appendChild(hint);
      box.appendChild(row);
    }
  }
  $('#params').appendChild(box);
}

function dropZone(){
  const z = document.createElement('div');
  z.id = 'drop';
  z.innerHTML =
    `<svg width="40" height="40" viewBox="0 0 56 56" fill="none"
          stroke="#7f9aa8" stroke-width="5" stroke-linecap="round">
       <path d="M28 10 v22"/><path d="M17 24 L28 36 L39 24"/>
       <path d="M12 36 v8 h32 v-8"/>
     </svg>
     <b>Choose a file</b>
     <span>or drag it here &nbsp;·&nbsp; png, jpg, svg, csv</span>
     <div id="chosen"></div>`;
  z.onclick = () => $('#fileInput').click();
  return z;
}

function showKind(kind){
  state.kind = kind;
  state.values = {};
  document.querySelectorAll('.tile').forEach(t =>
    t.classList.toggle('on', t.dataset.kind === kind));
  $('#panel').style.display    = kind ? 'block' : 'none';
  $('#tiles').style.display    = kind ? 'none' : 'grid';
  $('#intro').style.display    = kind ? 'none' : 'block';
  $('#advanced').style.display = kind ? 'block' : 'none';
  $('#footer').style.display   = kind ? 'flex'  : 'none';
  // Back at the tiles means starting over: every setting returns to its
  // default, and the epicycle counts go back to being worked out per shape.
  if (!kind){ resetAdvanced(); return; }

  const spec = KINDS[kind];
  $('#panelTitle').textContent = spec.title;
  $('#panelBlurb').textContent = spec.blurb || '';
  const host = $('#params');
  host.innerHTML = '';
  if (spec.file){
    host.appendChild(dropZone());
    if (state.fileName) $('#chosen').textContent = 'using ' + state.fileName;
  }
  spec.fields.forEach(f => field(f, host));
  if (kind === 'shape') shapeParams('star');
  if (kind === 'draw')
    host.innerHTML = '<span class="hint">Press <b>Draw it</b> and a sketch pad ' +
                     'opens. Drag to draw, then press Done.</span>';
  $('#err').textContent = '';
  $('#footHint').textContent = spec.file
    ? 'or drop a file anywhere on this page' : '';
}

clampField($('#maxArms'), {min:10, max:4000, int:true});
clampField($('#startArms'), {min:1, max:4000, int:true});

// starting with more arms than the maximum is nonsense, so keep the pair sane
$('#maxArms').addEventListener('change', () => {
  const hi = +$('#maxArms').value;
  if (+$('#startArms').value > hi) $('#startArms').value = hi;
});
$('#startArms').addEventListener('change', () => {
  const lo = +$('#startArms').value;
  if (lo > +$('#maxArms').value) $('#maxArms').value = lo;
});

document.querySelectorAll('.tile').forEach(t =>
  t.onclick = () => showKind(t.dataset.kind));
$('#changeKind').onclick = () => showKind(null);
showKind(null);

// ---- file handling: picker, click, drag and drop ----
function takeFile(file){
  if (!file) return;
  state.file = file;
  state.fileName = file.name;
  if (state.kind !== 'picture') showKind('picture');   // dropping means a picture
  const chosen = $('#chosen');
  if (chosen) chosen.textContent = 'using ' + file.name;
  $('#err').textContent = '';
}
$('#fileInput').onchange = e => takeFile(e.target.files[0]);

let dragDepth = 0;
addEventListener('dragenter', e => {
  e.preventDefault();
  if (++dragDepth === 1 && currentView() === 'setup') $('#dropVeil').classList.add('on');
});
addEventListener('dragover', e => e.preventDefault());
addEventListener('dragleave', e => {
  e.preventDefault();
  if (--dragDepth <= 0){ dragDepth = 0; $('#dropVeil').classList.remove('on'); }
});
addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  $('#dropVeil').classList.remove('on');
  takeFile(e.dataTransfer.files[0]);
});