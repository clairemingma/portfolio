/* ==========================================================================
   Rail

   The pinned half of the rail project page: the charcoal section stands still
   against the window while the page scrolls past it, and the row of slides moves
   sideways by exactly the distance the page has given up.

   THIS MODULE IS AN UPGRADE, NOT THE PAGE. Without it .rail__pin is an ordinary
   `overflow-x: auto` box — the slides can be swiped, dragged, tabbed and
   scrolled, and the page reads top to bottom like any other. All this adds is
   the lock. Everything below is written so that failing to run leaves that
   fallback intact, which is why the class that switches the CSS over is set HERE
   and not in the markup.

   IT NEVER CALLS preventDefault. The deck page takes the wheel over and adds the
   distance to its own scrollLeft; this one reads window.scrollY and writes a
   transform. Nothing is intercepted, so the scrollbar, the keyboard, a
   trackpad's momentum, a phone's fling and a screen reader's own scrolling all
   keep working — and the browser is still the only thing deciding how far a
   gesture goes.

   THE ARITHMETIC. Let

     travel = the track's width less the window's — how far it must move for its
              far end to reach the near edge
     step   = ONE WINDOW HEIGHT, the scroll a single slide costs
     span   = (items - 1) * step, the scroll the whole rail costs
     top    = the rail's document offset

   .rail is then `100dvh + span` tall and .rail__pin is one window tall and
   sticky, so the pin is against the top of the window for exactly `span` of
   scroll. Over that window, p = (scrollY - top) / span runs 0 to 1, and the track
   is translated by -p * travel.

   ONE SCREEN OF SCROLL PER SLIDE, and the rail is the smooth, unsnapped kind. It
   carried scroll-snap stops for a while and does not any more: a stop per slide
   is the strongest form of "this page is driving", and the reading is better
   without it — the slides pass at whatever rate the reader chooses and nothing
   takes the scroll back off them.

   The step survives the snap going, for a reason of its own. It bounds the page
   at one window per slide, which is both predictable and shorter than the track
   is wide, and it makes the keyboard land squarely: Page Down and the space bar
   move about one viewport, so on this page they move about one slide. Under the
   1:1 mapping this file used first, a Page Down covered four fifths of a slide
   and every press left the row further out of true than the last.

   The cost is that the track does not move at exactly the rate of the finger:
   23276 of travel over 18326 of scroll, about 1.27x. That is under the threshold
   where it reads as a speed rather than as a scroll.

   REDUCED MOTION IS NOT MOUNTED AT ALL. A window that stops scrolling the way it
   was asked to is the plainest case there is for that preference, and the
   fallback is a real page rather than a degraded one — so the honest response is
   to leave it alone rather than to pin it and animate less. Watched live, so a
   change made while the page is open takes effect.
   ========================================================================== */

// Below this the pin is given up, and src/rail-page.css gives it up in the same
// place. A pinned rail on a phone fights the browser's own address bar: 100dvh
// changes as that bar hides, and a sticky box one window tall jumps when it
// does. Swiping a row sideways is what a phone is good at.
const PINNED = '(min-width: 768px)';

// A wheel delta is not always in pixels: Firefox reports notches in LINES and a
// page-scroll gesture in PAGES. Same three-case conversion the deck page makes,
// and the same 40 for a line, which is what Chrome and Safari report directly for
// one notch of a mouse wheel.
const LINE = 40;

function pixels(delta, mode) {
  if (mode === 1) return delta * LINE;
  if (mode === 2) return delta * innerHeight;
  return delta;
}

export function mountRail() {
  const rail = document.querySelector('[data-rail]');
  if (!rail) return;

  const track = rail.querySelector('[data-track]');
  const pin = rail.querySelector('[data-pin]');
  if (!track || !pin) return;

  const progress = rail.querySelector('[data-progress]');
  const count = progress?.querySelector('[data-count]');
  const fill = progress?.querySelector('[data-fill]');
  const scrub = progress?.querySelector('[data-scrub]');
  const slides = [...track.querySelectorAll('[data-slide]')];
  if (!slides.length) return;

  const wide = matchMedia(PINNED);
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  // Geometry, refreshed on resize only — nothing below reads layout during a
  // scroll, so there is no thrash.
  let top = 0;
  let travel = 0;
  let stride = 0;
  let step = 0;
  let span = 0;
  let live = false;

  function measure() {
    // The rail's document offset. getBoundingClientRect is relative to the
    // window, so scrollY puts it back in document space.
    top = rail.getBoundingClientRect().top + scrollY;

    // The track's full extent against the window's, measured from its own left
    // border edge to the right edge of its last child, plus the padding that
    // should follow it.
    //
    // NOT scrollWidth, and that is a bug fix rather than a preference: a flex
    // container's scrollWidth does not count its trailing padding-right when the
    // content overflows. So the travel came up exactly one --rail-inset short and
    // the last item on the row could not be reached, because the page had not
    // been made tall enough to reach it.
    //
    // Both rects are read in the same frame, so the transform currently on the
    // track shifts them together and cancels out of the difference.
    const left = track.getBoundingClientRect().left;
    const last = track.lastElementChild;
    const tail = parseFloat(getComputedStyle(track).paddingRight) || 0;
    const extent = last
      ? last.getBoundingClientRect().right - left + tail
      : track.scrollWidth;
    travel = Math.max(0, extent - pin.clientWidth);

    // One screen of scroll per slide — see THE ARITHMETIC above. `items` is read
    // off the track rather than from `slides` so it stays right if anything but a
    // slide is ever put on the row again; it carried a RESTART / KEEP SCROLLING
    // pair at the end until that was removed.
    //
    // step is the PIN's height rather than innerHeight: they are the same number
    // while pinned, and taking it from the element means the height the page is
    // sized against and the height the CSS gave the pin are the same read.
    const items = track.children.length;
    step = pin.clientHeight;
    span = Math.max(1, (items - 1) * step);

    rail.style.setProperty('--rail-scroll', `${span}px`);

    // One slide plus one gap, for the counter. Taken from the first two slides
    // rather than computed from the tokens, so it stays true whatever the cap in
    // the CSS has resolved the slide to.
    const [a, b] = slides;
    stride = b
      ? b.getBoundingClientRect().left - a.getBoundingClientRect().left
      : a.getBoundingClientRect().width;
  }

  // Where the track stands, 0 to 1, read from where the page is. The rail's
  // position is a pure function of scrollY and nothing else writes it, which is
  // what keeps the scrub, the keyboard, the wheel and the trackpad from becoming
  // four different opinions about where the row has got to.
  function at() {
    if (travel <= 0 || span <= 0) return 0;
    return Math.min(1, Math.max(0, (scrollY - top) / span));
  }

  let shown = 0;

  function paint() {
    const p = at();
    const x = p * travel;

    track.style.transform = `translate3d(${-x}px, 0, 0)`;

    if (fill) fill.style.width = `${p * 100}%`;

    // Which slide is nearest the middle of the window. The counter names a slide
    // rather than reporting a percentage, because what it is for is telling a
    // reader how many pages there are and which one this is.
    //
    // Measured in the track's own space: x is how far the row has moved, so
    // x + half the window is the point on the row the middle of the screen is
    // over, and dividing by the stride says which slide that lands in.
    if (count && stride > 0) {
      const middle = x + pin.clientWidth / 2;
      const n = Math.min(
        slides.length,
        Math.max(1, Math.round((middle - stride / 2) / stride) + 1),
      );
      if (n !== shown) {
        shown = n;
        count.textContent = `[${n}/${slides.length}]`;
        scrub?.setAttribute('aria-valuenow', String(n));
      }
    }
  }

  // rAF-throttled, so a burst of scroll events collapses to one write per frame
  // and nothing in paint() reads layout.
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  }

  /* --- turning it on and off ----------------------------------------------- */

  // Everything the control needs — the role, the focus stop, the values — is
  // added here rather than in the markup, and that is the whole of the
  // progressive enhancement. Without this module the slider does nothing, so
  // announcing it as a slider and putting it in the tab order would be a promise
  // the page could not keep.
  function enhanceScrub() {
    if (!scrub || scrub.hasAttribute('role')) return;
    scrub.setAttribute('role', 'slider');
    scrub.setAttribute('tabindex', '0');
    scrub.setAttribute('aria-label', 'Slide');
    scrub.setAttribute('aria-valuemin', '1');
    scrub.setAttribute('aria-valuemax', String(slides.length));
    scrub.setAttribute('aria-valuenow', '1');
  }

  function engage() {
    if (live) return;
    live = true;
    rail.classList.add('is-pinned');
    enhanceScrub();
    measure();
    paint();
  }

  // Everything this module did is taken back off, so what is left is exactly the
  // page the markup describes: a scroller with a row in it. The transform in
  // particular has to go — a track left translated inside a box that now scrolls
  // would be offset by the amount it was last moved.
  function release() {
    if (!live) return;
    live = false;
    rail.classList.remove('is-pinned');
    track.style.transform = '';
    rail.style.removeProperty('--rail-scroll');
  }

  function sync() {
    if (wide.matches && !still.matches) engage();
    else release();
  }

  /* --- the scrub ----------------------------------------------------------- */

  // Press anywhere on the row and the page goes there; keep pressing and it
  // follows. There is no separate handle to catch — the whole 40-unit band is the
  // control, which is why the design can get away with drawing no thumb.
  //
  // It moves the PAGE rather than the track, which is the one thing that keeps
  // the two in agreement: the track's position is a pure function of scrollY, so
  // writing a transform here would be a second source of truth that the next
  // scroll frame would overwrite.
  if (scrub) {
    const seek = (clientX) => {
      if (!live || travel <= 0) return;
      const box = scrub.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      scrollTo({ top: top + p * span, behavior: 'instant' });
    };

    let dragging = false;

    scrub.addEventListener('pointerdown', (event) => {
      if (!live) return;
      dragging = true;
      scrub.setPointerCapture(event.pointerId);
      scrub.classList.add('is-scrubbing');
      seek(event.clientX);
    });

    scrub.addEventListener('pointermove', (event) => {
      if (dragging) seek(event.clientX);
    });

    const drop = (event) => {
      if (!dragging) return;
      dragging = false;
      scrub.releasePointerCapture?.(event.pointerId);
      scrub.classList.remove('is-scrubbing');
    };
    scrub.addEventListener('pointerup', drop);
    scrub.addEventListener('pointercancel', drop);

    // Keyboard parity. A slider that can be focused has to be operable, and the
    // step is one slide rather than one pixel — the value it announces is a
    // slide number, so that is what an arrow key should move.
    scrub.addEventListener('keydown', (event) => {
      if (!live || travel <= 0) return;
      const keys = {
        ArrowLeft: -1,
        ArrowDown: -1,
        ArrowRight: 1,
        ArrowUp: 1,
        PageDown: 1,
        PageUp: -1,
      };
      let to = null;
      if (event.key in keys) to = (shown - 1 + keys[event.key]) * step;
      else if (event.key === 'Home') to = 0;
      else if (event.key === 'End') to = span;
      if (to === null) return;
      event.preventDefault();
      scrollTo({
        top: top + Math.min(span, Math.max(0, to)),
        behavior: 'smooth',
      });
    });
  }

  /* --- the trackpad -------------------------------------------------------- */

  // A SIDEWAYS TWO-FINGER SWIPE DRIVES THE RAIL, and this is the one place the
  // page takes an event over.
  //
  // It is worth being exact about what is intercepted, because the rest of this
  // module is built on not doing it. A horizontal wheel delta on this page has
  // nowhere to go: the document does not scroll across — body is overflow-x
  // hidden — and the pin's own overflow is hidden while pinned, so the browser's
  // response to deltaX is to discard it. Nothing is being taken away from the
  // user; a gesture that did nothing is being given a meaning, and the meaning is
  // the obvious one, because what is on screen is a row that runs sideways.
  //
  // VERTICAL IS STILL LEFT ALONE. Only the dominant-horizontal case is claimed, a
  // diagonal that is mostly vertical stays the browser's, and the deltaX is
  // handed back as a scroll of the page rather than as a transform — so it goes
  // through exactly the same scrollY -> translate path as the wheel, and cannot
  // become a second source of truth for where the track is.
  //
  // scrollBy rather than scrollTo, because a wheel event is a delta and the
  // browser is still the thing accumulating them.
  addEventListener(
    'wheel',
    (event) => {
      if (!live || travel <= 0) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

      // Only while the rail actually holds the screen. Outside it a sideways
      // gesture is not this page's business, and claiming it over the lead or the
      // footer would be the scroll-jacking this module otherwise avoids.
      const p = at();
      if (p <= 0 && event.deltaX < 0) return;
      if (p >= 1 && event.deltaX > 0) return;

      event.preventDefault();
      scrollBy({
        top: pixels(event.deltaX, event.deltaMode),
        behavior: 'instant',
      });
    },
    { passive: false },
  );

  /* --- the slides' loading ------------------------------------------------- */

  // EVERY SLIDE IS PROMOTED TO EAGER ONCE THE PAGE HAS SETTLED, and this is a
  // real requirement rather than a nicety.
  //
  // The gallery build writes `loading="lazy"` on every slide but the first, which
  // is right on arrival: seventeen full-screen photographs is several megabytes
  // and all but one of them is off the right edge of the window. But the scrub is
  // a JUMP — press the far end of the progress row and the rail goes straight to
  // slide seventeen — and a lazy image begins loading when it intersects the
  // viewport, which is the moment it is needed rather than before it. So the
  // scrub could land on a blank box and hold it for as long as 300 KB takes.
  //
  // This is the deck page's behaviour, kept: project-deck.js did the same thing
  // for the same reason, and it went out of the checkout with the deck template.
  //
  // requestIdleCallback so it costs nothing on arrival — the browser runs it when
  // it has nothing better to do, which on this page is as soon as the first slide
  // and the fonts are in. setTimeout is the fallback for Safari, which still does
  // not ship the idle callback.
  function eager() {
    for (const slide of slides) slide.loading = 'eager';
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(eager, { timeout: 3000 });
  } else {
    setTimeout(eager, 1200);
  }

  /* --- wiring -------------------------------------------------------------- */

  addEventListener('scroll', () => live && schedule(), { passive: true });

  addEventListener(
    'resize',
    () => {
      if (!live) return;
      measure();
      paint();
    },
    { passive: true },
  );

  wide.addEventListener('change', sync);
  still.addEventListener('change', sync);

  sync();

  // The slides are lazy below the first, so the track's scrollWidth is right from
  // the start only because every slide has a width in CSS rather than from its
  // file. This is the belt on that: if anything does change the row's width after
  // layout settles, the travel is re-read once.
  addEventListener('load', () => {
    if (!live) return;
    measure();
    paint();
  });
}
