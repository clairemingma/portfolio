/* ==========================================================================
   Video autoplay

   The clips on a still project page play by themselves, on a loop, with no
   sound and no controls. They are artwork on a page, not media someone came to
   watch — the same relationship the landing page's one moving preview has, which
   is why that plate is a <video> with no chrome either.

   MUTED IS NOT A DETAIL AND IS NOT SET HERE. `muted` and `playsinline` are
   ATTRIBUTES in the markup, because that is the only place they count: every
   browser gates autoplay on the element being muted at the moment it decides,
   which is before any of this runs. A <video autoplay> that is muted by script
   is a <video> that has already been refused, and on iOS one without
   `playsinline` takes over the whole screen instead of playing in place. So the
   markup is what makes autoplay legal and this module only handles the cases the
   markup cannot express.

   There are three:

     1. The refusal. autoplay is a request, not a guarantee — a browser may
        decline it under a data-saver setting or a per-site rule, and it declines
        by rejecting play(). Nothing here can force it, but a rejection that is
        never caught is an unhandled promise rejection in the console of an
        otherwise working page, so it is caught and dropped.
     2. Reduced motion. A looping clip that never stops is exactly what the
        preference is for. CSS cannot pause a video, so it is done here: the clips
        are not started, and what shows is the poster frame. Watched live, so a
        change made while the page is open takes effect.
     3. A hidden tab. Browsers already throttle background video, but they do not
        all stop it, and two 720x1280 loops decoding for nobody is heat and
        battery. Paused on hide, resumed on show.

   No IntersectionObserver. These pages are one screen and the clips are on it
   from the first frame; an observer here would be machinery guarding a case that
   cannot arise.
   ========================================================================== */

export function mountVideoAutoplay() {
  const clips = [...document.querySelectorAll('video[data-autoplay]')];
  if (!clips.length) return;

  const still = matchMedia('(prefers-reduced-motion: reduce)');

  function play(clip) {
    // The promise form, because a refusal is reported that way and an uncaught
    // rejection would land in the console of a page that is otherwise fine.
    clip.play()?.catch(() => {});
  }

  function start() {
    if (still.matches || document.hidden) return;
    clips.forEach(play);
  }

  function stop() {
    clips.forEach((clip) => clip.pause());
  }

  // Pausing is not enough on its own to honour reduced motion, and this is the
  // subtle part. `autoplay` is a standing instruction, not a one-off: the browser
  // acts on it whenever the element has buffered enough, which can be after this
  // module has run and can happen again after a pause. So the attribute is taken
  // OFF the element as well, and only then paused.
  //
  // The cost is honest and worth stating: this module is a deferred module
  // script, so on a reduced-motion machine the browser may have already started a
  // clip by the time this runs, and what that reader sees is a frame or two of
  // movement before it stops. The alternative — leaving `autoplay` out of the
  // markup and starting the clips from script — would trade a two-frame flash for
  // a page whose artwork never moves at all without JavaScript, and on a page
  // whose subject IS the motion that is the worse bargain.
  function hold() {
    clips.forEach((clip) => {
      clip.removeAttribute('autoplay');
      clip.pause();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  // Live, not read once at mount: the preference can be changed while the page is
  // open, and a loop that keeps running because it was allowed at load is the
  // failure this API exists to prevent. Turning it back off restores `autoplay`
  // too, so the element is left as the markup had it.
  still.addEventListener('change', () => {
    if (still.matches) {
      hold();
    } else {
      clips.forEach((clip) => clip.setAttribute('autoplay', ''));
      start();
    }
  });

  if (still.matches) hold();
  else start();
}
