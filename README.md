# Fourier Drawer

Draw almost anything with a chain of rotating circles.

Feed it a shape — a logo, a letter, an SVG, or something you sketch with the
mouse — and it decomposes the outline with a Fourier transform, then rebuilds it
as a chain of spinning arms. Slide the epicycle count up and watch a rounded
blob sharpen into the original.

**[Live site](https://yonasfourierdrawer.netlify.app)  <!-- TODO: real URL -->** · no install, no sign-up, the
maths runs in your browser.



---

## What it does

Any closed outline can be written as a sum of rotating vectors:

```
z(t) = x(t) + i·y(t) = Σ  A_k · e^(i(2π f_k t + φ_k))
```

Each term is one circle: `A_k` its radius, `f_k` how many laps it turns per
cycle (negative means backwards), `φ_k` where it starts. Stack them tip to tail
and the last one traces your shape. The FFT works out the numbers; the app draws
the circles.

Split into real and imaginary parts it becomes two ordinary functions of time,
which the side panels plot live:

```
x(t) = Σ A_k · cos(2π f_k t + φ_k)
y(t) = Σ A_k · sin(2π f_k t + φ_k)
```

## Where the points can come from

| Source | What it does |
|---|---|
| **file** | works it out from the extension — the simplest option |
| **text** | any letter or word, rendered in a font and traced |
| **shape** | built-in formulas: star, gear, heart, flower, spirograph, diamond… |
| **image** | traces *every* line in a picture, including letters and holes |
| **silhouette** | traces one outline: the edge of the biggest solid blob |
| **svg** | reads the real curves — no pixels, no jagged edges |
| **csv** | a file of `x,y` numbers, one point per line |
| **draw** | sketch it yourself with the mouse |

Drag a file anywhere onto the page and it loads.

## Controls

| | |
|---|---|
| **slider** | how many epicycles are summed — moving it never resets the drawing |
| **1x 2x 4x 8x** | speed |
| **Guide** | show the finished shape as a dashed outline (`h`) |
| **Pause** | freeze mid-draw to inspect the arms (`space`) |
| **Clear** | wipe the traced path (`c`) |
| **Save PNG** | download the current frame |
| **Big view** | drawing only, no side panels (`b`) |
| **3D** | the curve in time — the drawing is its shadow at t=0 (`3`) |

The browser's back button steps back through the views.

## Notes on getting good results

- **Pictures work best as clean silhouettes or line art** — flat black on flat
  white, sharp edges. Photographs have uneven lighting, so no single threshold
  separates the subject from the background and you get noise instead of an
  outline.
- **A drawing made of separate pieces needs connectors.** A Fourier series draws
  one continuous closed loop, so a logo with a ring, a body and a tail gets short
  straight links between the pieces. They are spliced in at the closest points,
  so they stay short.
- **Corners need more arms than curves.** A circle needs one. A triangle looks
  rounded until about 100. Lettering wants 300+, and a spirograph is made almost
  entirely of high frequencies — give it 800.
- **More arms than samples does nothing**: an FFT of N samples yields exactly N
  coefficients. Somewhere around a quarter of that, the remaining circles are
  smaller than a pixel.

## Running it

Open `index.html` — no build step, no dependencies, no package manager. Plain
HTML plus the scripts in `js/` and the stylesheet in `css/`, loaded straight
from disk.

Opened this way there is no server and no network traffic at all: the notify
call in `js/app.js` posts to a Netlify function that isn't there, fails, and is
ignored. Files you load never leave your machine. To be certain, set `NOTIFY`
to `false` at the top of that block.


## Licence

do what you like with it.