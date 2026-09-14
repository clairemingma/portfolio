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

/* A cycle over one stack of frames, as a thing that can be handed to an owner.
   It is a factory rather than a mount because there are now TWO callers wanting
   the same beat under different rules:

     the still project page   one plate, always cycling — mountPlateCycle below
     the landing page's index one preview among seven, cycling only while it is
                              the one on show — see src/project-viewer.js

   THE SPLIT OF RESPONSIBILITY IS THE POINT. This holds the two reasons a cycle
   must NOT run that are properties of the machine rather than of the page — a
   reduce-motion preference and a hidden tab — and the caller holds the one
   reason that is its own: whether it is this plate's turn. `wanted` is that
   answer, and `run()` is the conjunction. So a caller cannot forget to honour
   the preference, and this file does not have to know what a hover is.

   Both machine conditions are watched LIVE rather than read once, because either
   can change while the page is open and a loop that keeps running because it was
   allowed at mount is the failure those APIs exist to prevent. They resume only
   if the owner still wants them to. */
export function createPlateCycle(plate) {
  const frames = [...plate.querySelectorAll('[data-frame]')];
  if (frames.length < 2) return null;

  const still = matchMedia('(prefers-reduced-motion: reduce)');

  let at = 0;
  let timer = 0;
  let wanted = false;

  function show(next) {
    frames[at].classList.remove(CURRENT);
    at = next;
    frames[at].classList.add(CURRENT);
  }

  function tick() {
    show((at + 1) % frames.length);
  }

  function halt() {
    clearInterval(timer);
    timer = 0;
  }

  // Guarded on every count: a second start would leak the first interval, and a
  // hidden tab, a reduce-motion preference or an owner that has not asked are
  // each on their own a reason not to have one.
  function run() {
    if (timer || !wanted || still.matches || document.hidden) return;
    timer = setInterval(tick, HOLD);
  }

  // A background tab is not watching, and browsers throttle timers there anyway
  // — which does not stop the cycle, it makes it lurch, so on coming back the
  // plate would jump several frames at once. Stopping and restarting means it
  // resumes from wherever it was left, on the beat.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) halt();
    else run();
  });

  // Held rather than cycled for anyone who has asked for less motion, and wound
  // back to the first frame — which on both callers is the image that was
  // already there, so holding it costs nothing and loses nothing.
  still.addEventListener('change', () => {
    if (still.matches) {
      halt();
      show(0);
    } else {
      run();
    }
  });

  return {
    start() {
      wanted = true;
      run();
    },
    stop() {
      wanted = false;
      halt();
    },
    // Back to the cover without touching whether it is running. The viewer wants
    // this on every hover so the cut and the start of the motion are the same
    // image — the same reason it rewinds the one video plate to 0.
    reset() {
      show(0);
    },
  };
}

/* The still project page's plate: one on the page, and it cycles from the moment
   it is mounted because there is nothing else on that page for it to wait for. */
export function mountPlateCycle() {
  const plate = document.querySelector('[data-plate-cycle]');
  if (!plate) return;
  createPlateCycle(plate)?.start();
}
