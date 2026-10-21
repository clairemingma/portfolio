/* ==========================================================================
   Index motion

   Two of the seven covers move, and on the phone there is no hover to start
   them with. The desktop answers that question with the cursor — see
   src/project-viewer.js, which runs the same clip and the same carousel off the
   is-active class. This is the phone's answer: what is on screen is what runs.

   An IntersectionObserver and not a scroll handler, because the question is
   literally "is this on screen", which is the one thing that API is for — and
   it answers without measuring anything on a thread that is already busy
   scrolling a page of photographs.

   NOTHING HERE RUNS ON THE DESKTOP, and it needs no breakpoint to know that.
   Both covers are display:none from 768 up, a display:none element generates no
   box, and an element with no box never intersects anything — so the observer
   simply never reports them in. The offsetParent guard below is belt and braces
   for the moment between a resize and the next frame.

   THE CLIP IS FETCHED HERE rather than in src/load-order.js, which promotes
   deferred images once the print has painted. That rule is right for a 60 KB
   plate and wrong for a 3.5 MB video: on a phone on mobile data it would spend
   the whole budget on a clip four rows down that may never be reached. So the
   src is set on first approach instead, and the row pays for itself.
   ========================================================================== */

import { createPlateCycle, HOLD_INDEX } from './plate-cycle.js';

export function mountIndexMotion() {
  const video = document.querySelector('[data-cover-video]');
  const stack = document.querySelector('[data-cover-cycle]');
  if (!video && !stack) return;

  // The carousel enforces reduce-motion and the hidden tab for itself; this
  // only has to say whose turn it is. The clip has no such keeper, so the
  // preference is read here — live, because it can change while the page is
  // open and a loop that keeps running because it was allowed at mount is the
  // failure the API exists to prevent.
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const cycle = stack ? createPlateCycle(stack, HOLD_INDEX) : null;

  function playing(on) {
    if (!video) return;
    if (!on) {
      video.pause();
      return;
    }
    // First approach: give it its source. Checking the dataset rather than
    // video.src, which a browser normalises to an absolute URL the moment it is
    // set and so never reads back as empty.
    if (video.dataset.src) {
      video.src = video.dataset.src;
      delete video.dataset.src;
    }
    // A rejection that is never caught is an unhandled rejection in the console
    // of an otherwise working page. autoplay is a request, not a guarantee.
    if (!still.matches) video.play().catch(() => {});
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const on = entry.isIntersecting && !!entry.target.offsetParent;
        if (entry.target === video) playing(on);
        else if (cycle) (on ? cycle.start : cycle.stop)();
      }
    },
    // A quarter of the cover is enough to count as arrived: these are tall
    // pictures and waiting for half of one would mean the motion starts only
    // once it is already filling the screen.
    { threshold: 0.25 },
  );

  if (video) io.observe(video);
  if (stack) io.observe(stack);

  // A clip that is paused on hide and never resumed is a clip that is dead for
  // the rest of the session. The observer does not re-fire on visibility, so
  // the pause is undone by hand against whatever is on screen at the time.
  document.addEventListener('visibilitychange', () => {
    if (!video) return;
    if (document.hidden) video.pause();
    else if (video.offsetParent) playing(true);
  });

  still.addEventListener('change', () => {
    if (still.matches) video?.pause();
    else if (video?.offsetParent) playing(true);
  });
}
