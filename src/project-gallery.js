/* ==========================================================================
   Project gallery

   The slide stage on a project page. Every slide is already in the DOM, stacked
   in the figure; advancing promotes one of them. The swap is a cut, not a
   transition — the same call the index's viewer makes, and for the same reason:
   the plates are decoded and hiding one while showing the next lands in a single
   frame, where a fade between two frames of the same shoot reads as a dissolve
   nobody asked for.

   Three controls, one index. The two invisible halves over the stage, the
   thumbnails, and the arrow keys all move the same variable, and the counter,
   the strips and the visible slide are all painted from it — so nothing here can
   leave the counter reading one number while another slide is up.

   The thumbnails are a filmstrip split around the stage: the slides you have
   passed sit to its left, the ones ahead to its right, and the one showing is in
   the middle at full size rather than repeated in a strip. So the strips are a
   position as much as a menu — the left one grows as you go, and there is nothing
   to its left on the first slide because there is nothing behind you.

   Each strip is windowed, and the window is measured rather than declared. The
   strip is a horizontal row, and the gutter it lives in is whatever the frame
   leaves — which changes with the viewport, because the frame is sized to the
   height available. So the number of thumbnails is the thing that gives way:
   as many as the track holds, up to the design's three. A fixed three would run
   under the figure on a tall window, and a fixed one would waste half a wide
   monitor.

   Both sides show the same number, taken from the tighter of the two. The left
   side is always the tighter, because the counter is placed over the left of its
   track; an unbalanced strip reads as a bug rather than as a measurement.

   Below 768 the strips sit in one row under the figure with the counter, where
   three a side would be six thumbnails across a 390 viewport — so the window
   closes to one there regardless of arithmetic.

   The markup seeds the first slide, so the resting state is right before this
   module runs rather than flickering into place after it.
   ========================================================================== */

// The design's own count, and the ceiling on what measurement can ask for.
const STRIP_MAX = 3;
const STRIP_NARROW = 1;
const NARROW = '(max-width: 767.98px)';
// Units of air kept between the counter and the nearest thumbnail.
const COUNTER_CLEARANCE = 12;

// How far either side of the slide showing to have already fetched. The cut is
// only instant if the next frame is already there, and stepping is what people
// do — so the neighbours are bought eagerly and the far end of the deck is not.
// Two rather than one so a quick double-step does not outrun it.
const PRELOAD = 2;

export function mountProjectGallery() {
  const root = document.querySelector('[data-gallery]');
  if (!root) return;

  const slides = [...root.querySelectorAll('[data-slide]')];
  // Captured once, and the same nodes are moved between the strips from here on.
  // Rebuilding them per paint would drop focus mid-keyboard-walk and throw away
  // the decoded thumbnail on every advance.
  const thumbs = [...root.querySelectorAll('[data-thumb]')];
  const strips = {
    before: root.querySelector('[data-thumbs="before"]'),
    after: root.querySelector('[data-thumbs="after"]'),
  };
  const count = root.querySelector('[data-count]');
  if (slides.length < 2) return;

  const narrow = matchMedia(NARROW);

  // How many thumbnails the track actually holds. Read from the live layout, not
  // from the numbers in the stylesheet: the frame's width follows the viewport's
  // height, so the gutter it leaves is not a constant and cannot be written down.
  //
  // n thumbnails occupy n widths plus (n - 1) gaps, so the count that fits a
  // given room is floor((room + gap) / (width + gap)).
  // The grid cell the strip sits in, not the strip. The strip is sized to its own
  // contents, so measuring it to decide how much it may contain is circular — it
  // reports 60 with one thumbnail in it however wide the gutter is. The cell is
  // the independent quantity.
  const track = () => strips.after?.parentElement ?? null;

  function strip() {
    if (narrow.matches) return STRIP_NARROW;
    const room = track()?.clientWidth;
    if (!room) return STRIP_MAX;

    const unit =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 1;
    // Computed style rather than offsetWidth: most thumbnails are hidden at any
    // moment, and a hidden element measures zero while its computed width is
    // still the one the stylesheet gave it.
    const width = parseFloat(getComputedStyle(thumbs[0]).width) || 60 * unit;
    const gap = parseFloat(getComputedStyle(strips.after).columnGap) || 24 * unit;

    // The counter sits over the left of the before track, so that side has this
    // much less room — and it is the side that decides, because both match.
    const usable =
      room - (count?.getBoundingClientRect().width ?? 0) - COUNTER_CLEARANCE * unit;

    const n = Math.floor((usable + gap) / (width + gap));
    return Math.max(1, Math.min(STRIP_MAX, n));
  }

  // Ring distance, not linear: the halves wrap, so slide one's previous
  // neighbour is the last frame and has to be fetched like any other neighbour.
  const apart = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, slides.length - d);
  };

  // Give the frames near the current one their src. One-way — once a slide has
  // been fetched it keeps its src, because dropping it again would re-download
  // an image the browser already holds the moment you stepped back past it.
  function fetchNear(next) {
    for (const [i, el] of slides.entries()) {
      if (el.dataset.src && apart(i, next) <= PRELOAD) {
        el.src = el.dataset.src;
        delete el.dataset.src;
      }
    }
  }

  function paint(next) {
    const reach = strip();

    fetchNear(next);
    slides.forEach((el, i) => el.classList.toggle('is-current', i === next));

    thumbs.forEach((el, i) => {
      const side = i < next ? 'before' : 'after';
      // Appending in ascending order puts the nearest slide against the figure
      // on both sides, so the strip reads outward from the stage.
      strips[side]?.appendChild(el);
      // The current slide is the stage, so it is not also a thumbnail; beyond
      // the window there is nothing to show. Both cases are the same hide.
      el.hidden = i === next || Math.abs(i - next) > reach;
      el.setAttribute('aria-pressed', String(i === next));
    });

    if (count) count.textContent = `[${next + 1}/${slides.length}]`;
  }

  // Seed from whichever slide the markup lit, falling back to the first so there
  // is always one up even if that class goes missing from the HTML.
  let current = Math.max(
    0,
    slides.findIndex((el) => el.classList.contains('is-current')),
  );

  // Reconcile once: the counter and both strips have to agree with the slide from
  // frame one, and only the slide is seeded in the markup.
  paint(current);

  // The count is measured, so it has to be re-measured when the box changes —
  // and the box changes on height as well as width, because the frame is sized
  // to the height available. A resize listener would miss neither, but the
  // observer is on the track itself, which is the thing the answer depends on.
  //
  // Guarded on the count rather than repainting on every observation: a repaint
  // moves thumbnails between the strips, which resizes the strips, which would
  // notify the observer again. Only a changed count does anything, so the loop
  // closes after one pass.
  // Observing the cell, not the strip, for the same reason strip() measures the
  // cell: the strip's own size is an output of this, so watching it would be a
  // feedback loop with an extra step in it.
  if ('ResizeObserver' in window && track()) {
    let last = strip();
    new ResizeObserver(() => {
      const now = strip();
      if (now === last) return;
      last = now;
      paint(current);
    }).observe(track());
  }

  // Crossing the breakpoint also changes the layout the strips sit in, which the
  // observer above may not see if the track's width happens not to change.
  narrow.addEventListener('change', () => paint(current));

  function show(next) {
    // Wraps in both directions. There is no first or last slide to be stuck on —
    // the halves are a ring, and a dead left half on slide one would read as a
    // broken control rather than a boundary.
    const wrapped = (next + slides.length) % slides.length;
    if (wrapped === current) return;
    current = wrapped;
    paint(wrapped);
  }

  const step = (delta) => show(current + delta);

  for (const el of root.querySelectorAll('[data-step]')) {
    el.addEventListener('click', () => step(Number(el.dataset.step)));
  }

  thumbs.forEach((el, i) => el.addEventListener('click', () => show(i)));

  // The stage is the page's subject, so the arrows drive it without anything
  // needing focus first. Guarded so it does not hijack the keys while a field or
  // a native control has them, and so a modified press still belongs to the
  // browser.
  addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const active = document.activeElement;
    if (active?.matches?.('input, textarea, select, [contenteditable]')) return;
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  });
}
