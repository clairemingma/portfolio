/* ==========================================================================
   The frame after the one you are looking at

   NEXT IS A CUT ON BOTH TEMPLATES BELOW 768, and that is what makes this
   necessary rather than nice. The rail's page turn has no transition at all —
   see THE PAGE in src/rail-page.css — and the reel's row snaps to the next
   frame in a few hundred milliseconds. Either way the picture is asked for and
   shown in the same instant, so a frame that has not arrived is a blank box
   where the work should be, for as long as its bytes take.

   WHAT THE MARKUP DOES IS RIGHT AND IS NOT ENOUGH. scripts/build-gallery.mjs
   writes the first frame eager and high priority and every other one lazy,
   because on arrival all but one of them is off the edge of the window and a
   rail is several megabytes — Huā Yǔ is twenty-one slides and 5.3 MB. A lazy
   image begins loading when it comes near the viewport, which here is the
   moment it is needed rather than before it.

   So the order this imposes is: THE NEIGHBOURS FIRST, AT HIGH PRIORITY, AND
   THE REST BEHIND THEM. The frame on screen and the two either side of it are
   promoted to eager, marked high, and DECODED; everything else is promoted
   once the page has gone idle, at low priority, so it fills in without taking
   the bandwidth the next frame needs. Every time the shown frame changes, the
   window moves with it.

   DECODE AND NOT ONLY LOAD. Having the bytes is not the same as being able to
   paint: these are 2x exports — a rail slide is 2618 wide and drawn at about
   343 on a phone — and decoding one is real work that otherwise happens in the
   frame the cut lands on. `decode()` does it off the main thread and resolves
   when the picture is ready to be shown, which is the thing being asked for.

   IT IS BOUNDED, and deliberately. Decoding twenty-one slides to be safe would
   hold tens of megabytes of bitmap on a phone to save a wait nobody is having;
   three is what a reader can reach in one press from where they are.

   Returns the function to call with the index now shown. Callers: the rail's
   setPage in src/rail-expand.js, which owns the index at this width and in the
   full screen, and the reel's counter in src/reel-counter.js, which reads its
   index off the row's scroll.
   ========================================================================== */

// One press either way, plus the one under the window. More than this is
// loading pictures against the chance of a reader pressing NEXT twice before
// looking at anything.
const AHEAD = 1;
const BEHIND = 1;

export function mountFramesAhead(frames) {
  const list = [...frames];
  // Nothing to be ahead of. A reel of one is also the case where the markup's
  // eager first frame is the whole set.
  if (list.length < 2) return () => {};

  // What has already been asked for at high priority. Promoting an image twice
  // is harmless but decoding it twice is not free, and this is also what tells
  // the idle pass below which frames it should leave alone.
  const asked = new Set();

  function prepare(i) {
    // Wraps, because NEXT does — see setPage in src/rail-expand.js and the
    // same decision in src/reel-counter.js. The frame before the first is the
    // last one, and on a two-frame reel that is the same picture either way.
    const img = list[((i % list.length) + list.length) % list.length];
    if (!img || asked.has(img)) return;
    asked.add(img);
    img.loading = 'eager';
    // Before the request goes out it is a priority; after it has gone it is
    // nothing, which is why this is set here and not in the idle pass.
    img.fetchPriority = 'high';
    // Rejects if the element is torn down or its src changes under it, and
    // neither is a failure worth reporting: the picture simply loads the
    // ordinary way when it is painted.
    img.decode?.().catch(() => {});
  }

  function at(index) {
    prepare(index);
    for (let n = 1; n <= AHEAD; n += 1) prepare(index + n);
    for (let n = 1; n <= BEHIND; n += 1) prepare(index - n);
  }

  // EVERYTHING ELSE, ONCE THE PAGE HAS SETTLED. This is the promotion
  // src/project-rail.js used to make and the reason for it is unchanged: the
  // scrub on the wide page is a JUMP, so a lazy slide would begin loading at
  // the moment the scrub landed on it and hold a blank box until it finished.
  //
  // What is new is the priority. Promoted at the browser's own, twenty frames
  // start at once and the one the reader is about to ask for is one of twenty;
  // marked low, they queue behind the neighbours above and the rail still ends
  // up fully loaded a moment later.
  //
  // requestIdleCallback so it costs nothing on arrival — the browser runs it
  // when it has nothing better to do, which on these pages is as soon as the
  // first frame and the fonts are in. setTimeout is the fallback for Safari,
  // which still does not ship the idle callback.
  function rest() {
    for (const img of list) {
      if (asked.has(img)) continue;
      img.fetchPriority = 'low';
      img.loading = 'eager';
    }
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(rest, { timeout: 3000 });
  } else {
    setTimeout(rest, 1200);
  }

  // The frame the markup is already showing, and the one after it. Called here
  // rather than left to the first press, which is the press this exists for.
  at(0);

  return at;
}
