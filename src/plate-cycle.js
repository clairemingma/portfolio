/* ==========================================================================
   Plate cycle

   The still project page's photograph is an Instagram carousel, and it is shown
   as one: the frames cut from one to the next on a fixed beat, so the plate reads
   as the post moving rather than as one flat screenshot of it.

   A gif in effect and not one in fact. GIF is 256 colours and these are
   photographs — a real gif of this would be either banded or several megabytes,
   and neither is worth it when ten webp files and a timer do the same thing at a
   tenth the weight and full colour. It also keeps the frames as real <img>
   elements, which means they are cached, they are decoded up front, and the beat
   can be stopped when nobody is looking at it.

   Every frame is already in the markup with its own src; this only moves a class.
   That is deliberate — see the note on .plate__frame in trending-this-week.css. A
   module that swapped one <img>'s src would have to gamble on the next file being
   decoded when the beat lands, and a blank frame in a ten-frame loop reads as a
   broken image rather than as a cut.

   Frame count is read from the markup, not assumed: the carousel is a folder and
   folders grow.
   ========================================================================== */

/* 1.4s a frame. Slow for a gif and deliberately so: these are dense product
   collages with type on them, and at the 100ms an animated gif tends to use they
   would strobe rather than be read. Ten frames at this beat is a 14s loop, which
   is about as long as the page holds attention. */
const HOLD = 1400;

const CURRENT = 'is-current';

export function mountPlateCycle() {
  const plate = document.querySelector('[data-plate-cycle]');
  if (!plate) return;

  const frames = [...plate.querySelectorAll('[data-frame]')];
  if (frames.length < 2) return;

  // Held rather than cycled for anyone who has asked for less motion. The first
  // frame is the one the markup already shows and the one the preload hint
  // names, so this branch is simply not starting — nothing to undo, and the post
  // is one click away either way.
  //
  // A live query, not a snapshot: the setting can be changed while the page is
  // open, and a cycle that keeps running because the preference was read once at
  // mount is the failure this API is meant to prevent.
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let at = 0;
  let timer = 0;

  function show(next) {
    frames[at].classList.remove(CURRENT);
    at = next;
    frames[at].classList.add(CURRENT);
  }

  function tick() {
    show((at + 1) % frames.length);
  }

  function stop() {
    clearInterval(timer);
    timer = 0;
  }

  function start() {
    // Guarded on both counts: a second start would leak the first interval, and
    // a hidden tab or a reduce-motion preference is a reason not to have one.
    if (timer || still.matches || document.hidden) return;
    timer = setInterval(tick, HOLD);
  }

  // A background tab is not watching, and browsers throttle timers there anyway
  // — which does not stop the cycle, it makes it lurch, so on coming back the
  // plate would jump several frames at once. Stopping and restarting means it
  // resumes from wherever it was left, on the beat.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  still.addEventListener('change', () => {
    if (still.matches) {
      stop();
      show(0);
    } else {
      start();
    }
  });

  start();
}
