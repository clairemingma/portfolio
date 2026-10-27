/* ==========================================================================
   The reel's counter

   Below 768 the reel's frames are a swipe row in a box of fixed height — see
   the narrow block in src/reel-page.css — and this keeps `[1/3]` true as the
   row is swiped.

   IT EXISTS BECAUSE THE AXIS TURNED. Above 768 the frames are a screen each
   down the page: the scroll itself is the indicator, the browser draws it, and
   this template has never needed a counter. Sideways in a box with no
   scrollbar there is nothing on the screen saying there is a second mockup,
   and two of the three frames on these pages are device shots that look like
   one another at a glance. The rail has had its counter since it was a rail;
   this is the same thing arriving at the same moment the same problem does.

   THE SEED IN THE MARKUP IS ALREADY RIGHT, and scripts/build-gallery.mjs is
   what keeps it right — so a page whose script never loads shows `[1/3]`,
   which is true of the frame it is showing. This only has to keep up after a
   swipe. Nothing is announced on arrival either: aria-live is on the element
   in the markup, and the first write this makes is the same text it found.

   It does not watch the breakpoint. The element is `display: none` above 768,
   the row is not a scroller up there, so the listener never fires and there is
   nothing to tear down.
   ========================================================================== */

export function mountReelCounter() {
  const shots = document.querySelector('.reel__shots');
  const count = document.querySelector('[data-count]');
  if (!shots || !count) return;

  const frames = shots.querySelectorAll('.reel__screen');
  if (frames.length < 2) return;

  let shown = 1;

  function paint() {
    // Each screen is one item of the row at the full measure, so the frame in
    // the window is simply how many widths along the scroll has got. Read off
    // the box rather than from the frame count, because the box is what the
    // scroll is measured in and the two can disagree for a frame after a turn.
    const step = shots.clientWidth;
    if (step <= 0) return;

    const n = Math.min(
      frames.length,
      Math.max(1, Math.round(shots.scrollLeft / step) + 1),
    );
    if (n === shown) return;
    shown = n;
    count.textContent = `[${n}/${frames.length}]`;
  }

  // rAF-throttled, so a flick collapses to one write per frame. paint() reads
  // layout, which is exactly the thing not to do on every scroll event.
  let queued = false;
  shots.addEventListener(
    'scroll',
    () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        paint();
      });
    },
    { passive: true },
  );

  // A turned phone is a different box width, and the scroll position is kept
  // in pixels rather than in frames — so the frame under the window can change
  // without anything having been swiped.
  addEventListener('resize', paint, { passive: true });
}
