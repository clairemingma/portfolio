/* ==========================================================================
   Project viewer

   Every plate is already in the DOM, stacked in the empty channel the rows
   leave between the year and the title; hovering a row promotes one of them.
   Swapping `src` would flash on first hover, so we crossfade opacity instead.

   One plate is always up. The markup seeds the first row and the first plate,
   so the resting state is already right before this module runs rather than
   flickering into place after it; from here `current` only ever moves, never
   clears. Leaving the list keeps the last plate — reverting felt twitchy when
   moving between rows, and with a default showing there is nothing to revert
   to anyway.

   The undimmed row and the lit plate are the same fact, so they are driven from
   one variable: nothing here can leave a row highlighted over another project's
   image.
   ========================================================================== */

export function mountProjectViewer() {
  const index = document.querySelector('[data-index]');
  const viewer = document.querySelector('[data-viewer]');
  if (!index || !viewer) return;

  const rows = new Map(
    [...index.querySelectorAll('[data-project]')].map((el) => [
      el.dataset.project,
      el,
    ]),
  );
  const plates = new Map(
    [...viewer.querySelectorAll('[data-plate]')].map((el) => [
      el.dataset.plate,
      el,
    ]),
  );
  if (!plates.size) return;

  // A plate may be a video rather than a still. Motion only belongs to the
  // plate that is up: off-screen playback would burn a decoder on something
  // nobody can see, and a clip that kept running while hidden would be caught
  // mid-phrase on the next hover. So playback is slaved to is-active, and each
  // hover restarts the clip — the poster is its first frame, so the cut and the
  // start of the motion are the same image.
  //
  // Reduced motion keeps the plate but not the movement: the paused first frame
  // is exactly the still this slot used to hold, so nothing is lost by holding
  // it there.
  const stillsOnly = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function cue(el, active) {
    if (el.tagName !== 'VIDEO') return;
    if (!active) {
      el.pause();
      return;
    }
    el.currentTime = 0;
    if (stillsOnly) return;
    // Rejected when the browser declines to autoplay. Nothing to recover — the
    // poster is already the right image — but the rejection has to be absorbed
    // or it surfaces as an unhandled error.
    el.play().catch(() => {});
  }

  function paint(id) {
    plates.forEach((el, key) => {
      const active = key === id;
      el.classList.toggle('is-active', active);
      cue(el, active);
    });
    rows.forEach((el, key) => el.classList.toggle('is-current', key === id));
  }

  // Seed from whichever plate the markup lit, falling back to the first so
  // there is always one up even if that class goes missing from the HTML.
  let current =
    [...plates.entries()].find(([, el]) =>
      el.classList.contains('is-active'),
    )?.[0] ?? [...plates.keys()][0];

  // Reconcile once: the row's class and the plate's have to agree from frame
  // one, and only the plate is seeded in the markup.
  paint(current);

  function show(id) {
    if (id === current || !plates.has(id)) return;
    current = id;
    paint(id);
  }

  for (const [id, row] of rows) {
    // pointerenter covers mouse and pen but not touch, which is what we want:
    // there is no hover to preview on a touch screen.
    row.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      show(id);
    });

    // Keyboard parity — tabbing the list drives the viewer too.
    row.addEventListener('focusin', () => show(id));
  }

  // Scrolling moves the rows under a stationary cursor, and the browser fires
  // no pointer event for that — pointerenter needs the *pointer* to move. So
  // remember where the cursor is and hit-test that point on scroll: the rows
  // passing beneath it change the plate exactly as if it had swept over them.
  //
  // elementFromPoint rather than comparing rects: it already accounts for the
  // fixed print, the locked bar and anything else stacked above the list, so a
  // row covered by the bar does not claim a cursor sitting on top of it. The
  // plates carry pointer-events: none, so they never intercept the test.
  let pointerX = null;
  let pointerY = null;

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
    },
    { passive: true },
  );

  // The cursor leaving the window would otherwise leave a stale position that
  // keeps claiming hits as the page scrolls under it.
  document.addEventListener('pointerleave', () => {
    pointerX = null;
    pointerY = null;
  });

  let queued = false;
  addEventListener(
    'scroll',
    () => {
      if (pointerX === null || queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (pointerX === null) return;
        const row = document
          .elementFromPoint(pointerX, pointerY)
          ?.closest?.('[data-project]');
        if (row) show(row.dataset.project);
      });
    },
    { passive: true },
  );
}
