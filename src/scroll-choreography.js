/* ==========================================================================
   Scroll choreography

   Three phases, driven by one rAF-throttled scroll read that writes CSS custom
   properties. Nothing here reads layout during scroll, so there is no thrash.

   Let  S = scrollY,  vh = viewport height,  navH = nav height
        T1 = phase-one runway,  T2 = vh - navH

     phase 1   S in [0, T1]        nothing moves but the about copy, which
                                   travels up and off the top of the page. Nav
                                   rests centred on the print, where the design
                                   puts it, with the copy hanging beneath it.
     phase 2   S in [T1, T1 + T2]  the window onto the print closes from the
                                   bottom at scroll speed while the print
                                   itself holds still, and the paper comes up
                                   flush against the closing edge. The nav
                                   covers half that distance over the same
                                   window, reaching top: 0 exactly as the
                                   paper's edge arrives beneath it.
     phase 3   S > T1 + T2         nav locked at the top; the paper scrolls
                                   beneath it as an ordinary page.

   The bar rests at T2/2 rather than T2, so it travels at half scroll speed. Its
   position is derived from the paper's progress rather than a scroll offset of
   its own, which is why the two still meet exactly at the lock.

   The runway spacer is sized `vh + T1`, which puts .sheet's document top at
   vh + T1. That is what makes phase 2 self-consistent: at S = T1 + T2 the
   paper's edge sits at vh + T1 - S = navH, i.e. flush under the locked bar. The
   window onto the print closes by the same amount over the same window, so the
   paper's leading edge and the print's closing edge are coincident throughout —
   never a gap, never an overlap.
   ========================================================================== */

// T1 as a share of the viewport height. This is the knob for how fast the about
// copy leaves: the copy covers a fixed distance (its own offset plus its own
// height, ~0.56vh) over T1 of scroll, so a larger T1 means a lower ratio of copy
// travel to scroll — it moves more slowly under the same finger. At 1.0 the copy
// runs at a bit over half scroll speed, which is what reads as unhurried; at the
// old 0.6 it was tracking scroll almost 1:1 and felt driven rather than drifting.
const PHASE_ONE_FRACTION = 1.0;

export function mountScrollChoreography() {
  const stage = document.querySelector('[data-stage]');
  const nav = document.querySelector('[data-nav]');
  const runway = document.querySelector('[data-runway]');
  const sheet = document.querySelector('.sheet');
  const copy = document.querySelector('[data-about-copy]');
  // The word alone, not the link: the link's box also holds the trailing comma,
  // and it is the word's edge the copy lines up with.
  const aboutWord = document.querySelector('.nav__link--about .nav__link-word');
  if (!stage || !nav || !runway || !sheet) return;

  const root = document.documentElement;

  // Geometry, refreshed on resize only.
  let vh = 0;
  let navH = 0;
  let t1 = 0;
  let t2 = 0;
  let navRest = 0; // where the bar sits before the first scroll frame
  let sheetTop = 0; // .sheet's document-space top edge

  // Last width/height we measured, so a mobile URL bar collapsing does not
  // re-run the whole layout mid-scroll.
  let lastWidth = 0;
  let lastHeight = 0;

  function measure() {
    vh = window.innerHeight;
    navH = nav.offsetHeight;
    t1 = Math.round(vh * PHASE_ONE_FRACTION);
    t2 = Math.max(0, vh - navH);
    navRest = Math.round(t2 / 2);
    sheetTop = vh + t1;

    root.style.setProperty('--vh', `${vh}px`);
    root.style.setProperty('--nav-h', `${navH}px`);
    root.style.setProperty('--t1', `${t1}px`);
    root.style.setProperty('--nav-rest', `${navRest}px`);

    // Left edge of the bar's ABOUT label, for the copy to hang off. The bar is on
    // the page's twelve columns now, but About is deliberately centred on the
    // page rather than justified to a column — so its text edge is still on no
    // grid line and still cannot be derived in CSS. See the .about rule.
    //
    // Published before the copy is measured below, and deliberately so: the
    // offset changes the copy's width, the width changes how it wraps, and the
    // wrap changes its height. Reading offsetHeight afterwards forces the layout
    // and gets the settled figure; reading it first would bank a stale one.
    if (aboutWord) {
      root.style.setProperty(
        '--about-left',
        `${aboutWord.getBoundingClientRect().left}px`,
      );
    }

    // How far the copy has to travel to be gone: its top within the stage plus
    // its own height, so the last line clears the fold rather than resting on
    // it. Walk the offsetParent chain rather than reading offsetTop directly —
    // .stage__grid is itself positioned, so the copy's offsetTop is relative to
    // that and is 0. offsetTop/offsetHeight are untransformed, so this is safe
    // to re-read at any scroll position; both depend on how the copy wraps and
    // on which serif has loaded, which is why this is measured, not derived.
    if (copy) {
      let top = 0;
      for (let el = copy; el && el !== stage; el = el.offsetParent) {
        top += el.offsetTop;
      }
      root.style.setProperty('--about-rise', `${top + copy.offsetHeight}px`);
    }
  }

  function frame() {
    const s = window.scrollY;

    // phase 1 — 0 while the plate is held, 1 once the copy has cleared.
    const p1 = t1 > 0 ? clamp(s / t1, 0, 1) : 1;

    // phase 2 — how far the window onto the print has closed. .stage shifts up
    // by this and .stage__inner back down by it, so the print holds still while
    // its lower edge climbs; the paper is flush against that edge throughout.
    const stageY = clamp(s - t1, 0, t2);
    const p2 = t2 > 0 ? stageY / t2 : 1;

    // Rounded to whole pixels. At a fractional offset the bar's glyphs get
    // resampled every frame, which softens them and makes their edges crawl —
    // and a crawling edge along a bar reads as a faint line. Rounding is free
    // here because the bar is not coincident with anything: half a pixel of
    // slack against the paper's edge costs nothing and is invisible.
    //
    // stageY is deliberately NOT rounded. The print has to stay exactly flush
    // with the paper's leading edge, and the paper is positioned by native
    // scroll, which is fractional on a trackpad. Snapping the print would open
    // a sub-pixel gap at the reveal edge and show a hairline of whatever sits
    // behind it — the very artefact rounding is meant to avoid.
    const navY = Math.round(navRest * (1 - p2));

    root.style.setProperty('--p1', p1.toFixed(4));
    root.style.setProperty('--stage-y', `${stageY}px`);
    root.style.setProperty('--nav-y', `${navY}px`);

    // Colour, decided geometrically rather than by a magic scroll offset: the
    // bar turns over the frame the paper's leading edge reaches its underside.
    //
    // That threshold is what keeps a white rule from ever appearing under the
    // bar. Waiting any longer lets the paper's edge climb *into* the bar's band
    // while the bar is still transparent, and a bright edge sitting across the
    // bar's underside reads as an underline rather than as a reveal. Firing
    // here, the bar takes its own paper background on the same frame the paper
    // arrives, so the two are continuous and the only boundary left is at the
    // bar's top edge — which is the top of the viewport, off screen.
    //
    // The geometry makes this exact rather than approximate. The bar's underside
    // is at navY + navH = navRest(1 - p2) + navH and the paper's edge is at
    // vh - p2*T2; with navRest = T2/2 and T2 = vh - navH those are equal only at
    // p2 = 1. So it cannot fire early — not during phase 1, when the paper sits
    // flush with the fold and is nowhere near the bar, and not mid-phase-2.
    const paperTop = sheetTop - s;
    const overPaper = paperTop <= navY + navH;

    // Type and background turn together. Painting the background here rather
    // than later is safe: what it hides is a strip of print one bar tall that
    // the paper is about to cover anyway.
    nav.classList.toggle('is-over-paper', overPaper);

    // Once the paper's edge has passed the top of the viewport it covers the
    // plate outright, so stop compositing it.
    stage.style.visibility = paperTop <= 0 ? 'hidden' : '';
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      frame();
    });
  }

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Ignore the small vertical-only changes that browser chrome causes.
    if (w === lastWidth && Math.abs(h - lastHeight) < 120) return;
    lastWidth = w;
    lastHeight = h;
    measure();
    frame();
  }

  lastWidth = window.innerWidth;
  lastHeight = window.innerHeight;
  measure();
  frame();

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', onResize);

  // Web fonts land after first paint and change the nav's height, which shifts
  // every derived number.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      measure();
      frame();
    });
  }
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
