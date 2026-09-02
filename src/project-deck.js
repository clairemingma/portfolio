/* ==========================================================================
   The deck

   A presentation read sideways. Three jobs, all of them keyed off one number —
   how far the track has scrolled:

     1. The wheel scrolls the deck. The page has no vertical axis at all, so a
        vertical gesture has to mean something and the only thing left for it to
        mean is "onwards".
     2. The progress row appears when the first slide's left edge reaches the
        page margin, and holds its place from there to the end.
     3. The counter names the slide whose left edge has most recently passed
        that same margin, and the slider reports the scroll as a fraction.

   Everything is measured from the DOM rather than derived from the design's
   numbers. The layout is written in viewport-relative units that resolve
   differently at every width, so the one thing this module must not do is
   assume it knows where anything is.
   ========================================================================== */

/* A wheel event's delta is in whatever unit the device reported, and only
   deltaMode 0 is pixels. The other two have to be converted or the gesture is
   the wrong size by two orders of magnitude — Firefox reports a mouse notch as
   3 LINES, and adding 3 to scrollLeft is a scroller that does not move.
   40 is Chrome's own line height for this conversion, which puts a Firefox
   notch at the 120px Chrome sends for the same physical click. A page is a
   viewport, as it is everywhere else. */
const LINE = 40;

function pixels(delta, mode, viewport) {
  if (mode === 1) return delta * LINE;
  if (mode === 2) return delta * viewport;
  return delta;
}

export function mountProjectDeck() {
  const deck = document.querySelector('[data-deck]');
  if (!deck) return;

  const slides = [...deck.querySelectorAll('[data-slide]')];
  const brief = deck.querySelector('[data-margin]');
  const stage = deck.querySelector('[data-stage]');
  const progress = document.querySelector('[data-progress]');
  const count = progress?.querySelector('[data-count]');
  const fill = progress?.querySelector('[data-fill]');
  const scrub = progress?.querySelector('[data-scrub]');
  const restart = deck.querySelector('[data-restart]');
  const next = deck.querySelector('[data-next]');
  const gauge = next?.querySelector('[data-push]');
  const track = deck.querySelector('[data-track]');
  if (!slides.length || !brief || !stage) return;

  // Track-space x of each slide's left edge, the page margin, and half a slide
  // for the counter's midpoint test — all in real pixels, and all measured,
  // because every one of them depends on --vr, which is a fraction of the
  // viewport width.
  //
  // --grid-margin cannot simply be read: it is a custom property, and
  // getComputedStyle hands those back as the token they were written as
  // ("20rem") rather than as a resolved length. So the margin is taken from the
  // one element already sitting on it — the brief, whose offsetParent is the
  // paper panel at track x 0.
  let offsets = [];
  let margin = 0;
  let half = 0;

  // Where the row begins, and how far the slider runs from there.
  //
  // ENTRY is the dark panel's own left edge in track space, so the row arrives
  // at the moment the panel has closed on the window's left edge and the
  // presentation is the whole screen. Before that there is still paper showing
  // and the brief is still being read.
  //
  // The slider's range is that same point to the end of the deck — the range it
  // is alive over, not the whole scroll. Two reasons they have to be the one
  // number. A slider spanning the whole scroll would have a left end you could
  // only reach by making the slider disappear out from under your own finger.
  // And if its zero sat anywhere ahead of where it appears, dragging left inside
  // that gap would scroll the deck to the RIGHT.
  let entry = 0;
  let span = 0;

  // Where the bar's PROJECTS begins, published for the stylesheet: the dark
  // panel starts on it. It has to be measured because the bar sets that link
  // flush RIGHT in its column, so its left edge is the column's right edge less
  // the width of the word — which depends on the face that has loaded and on
  // nothing the grid knows about. styles.css already does this for --about-left
  // on the landing page, for the same reason.
  //
  // Written before anything else is read, because it MOVES the panel, and every
  // offset below is taken from where the panel ended up.
  const projects = document.querySelector('.nav__link--projects');

  function publishProjectsLeft() {
    if (!projects) return;
    const x = projects.getBoundingClientRect().left;
    document.documentElement.style.setProperty('--projects-left', `${x}px`);
  }

  function measure() {
    publishProjectsLeft();
    const origin = deck.getBoundingClientRect().left - deck.scrollLeft;
    offsets = slides.map((slide) => slide.getBoundingClientRect().left - origin);
    margin = brief.offsetLeft;
    half = slides[0].getBoundingClientRect().width / 2;
    entry = stage.getBoundingClientRect().left - origin;
    // Zero or less on a viewport wide enough to hold the whole deck at once.
    // Everything downstream guards on it rather than dividing by it.
    span = deck.scrollWidth - deck.clientWidth - entry;
  }

  // The tolerance is half a pixel of slack around an equality between two
  // fractional lengths. Without it the row can fail to appear at the exact
  // scroll position that is supposed to summon it, because the panel's left edge
  // lands at 0.0001 and never at 0.
  const AT = 0.5;

  const at = (x) => (span > 0 ? Math.min(1, Math.max(0, (x - entry) / span)) : 0);

  // The slide being read is the one nearest the middle of the window.
  //
  // The obvious rule — the last slide to have crossed the page margin, the same
  // line that summons the row — is wrong at exactly one place, and it is the
  // last place anyone looks. The deck stops with its trailing inset against the
  // right edge, so the twelfth slide's left edge never reaches the margin and
  // the counter tops out at [11/12]. Measuring from the middle instead has no
  // such dead end: it still reads [1/12] at the instant the row appears, and it
  // reads [12/12] at the end of the track.
  function slideAt(x) {
    const middle = x + deck.clientWidth / 2;
    let n = 0;
    let best = Infinity;
    for (let i = 0; i < offsets.length; i++) {
      const away = Math.abs(offsets[i] + half - middle);
      if (away >= best) break; // offsets ascend, so the first rise is the answer
      best = away;
      n = i + 1;
    }
    return Math.max(n, 1);
  }

  function paint() {
    const x = deck.scrollLeft;

    // The row belongs to the panel, so it arrives with it: the moment the dark
    // has closed on the left edge and there is no paper left on screen. Once
    // past that it stays — it is fixed to the viewport, so "sticks there" is the
    // absence of any further work rather than something to do. Scrolling back
    // hides it again, because paper is showing again and the row is not the
    // brief's.
    progress?.classList.toggle('is-live', x >= entry - AT);

    if (fill) fill.style.width = `${at(x) * 100}%`;

    const n = slideAt(x);

    if (count) {
      const next = `[${n}/${slides.length}]`;
      if (count.textContent !== next) count.textContent = next;
    }

    // The slider reports the slide rather than a percentage, so what it
    // announces is what the counter beside it prints. A screen reader saying
    // "43 percent" of a deck would be true and useless.
    if (scrub && +scrub.getAttribute('aria-valuenow') !== n) {
      scrub.setAttribute('aria-valuenow', n);
      scrub.setAttribute('aria-valuetext', `Slide ${n} of ${slides.length}`);
    }
  }

  // Scroll fires far more often than a frame, and every handler above reads
  // layout. Coalescing to one frame is the difference between measuring once
  // per paint and measuring five times for the same paint.
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  }

  deck.addEventListener('scroll', schedule, { passive: true });

  /* --- the wheel ---------------------------------------------------------- */

  // A trackpad reports a horizontal swipe as deltaX, and the scroller already
  // knows what to do with that — taking it over would only be a worse version
  // of the browser's own handling, without the momentum. So only the vertical
  // component is redirected, and only when it is the dominant one: a diagonal
  // gesture that is mostly sideways is a sideways gesture.
  //
  // Both axes are still MEASURED, because the push past the end counts either
  // way: pressing on sideways at the last slide means the same thing as pressing
  // on downwards.
  deck.addEventListener(
    'wheel',
    (event) => {
      const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
      const step = pixels(
        sideways ? event.deltaX : event.deltaY,
        event.deltaMode,
        deck.clientWidth,
      );

      if (!sideways && step) {
        event.preventDefault();
        deck.scrollLeft += step;
      }

      push(step);
    },
    { passive: false },
  );

  /* --- the slider --------------------------------------------------------- */

  // The row reports the scroll; this is what lets it drive the scroll too.
  //
  // Everything the control needs — the role, the focus stop, the value — is
  // added HERE rather than in the markup, and that is the whole of the
  // progressive enhancement. Without this module the slider does nothing, so
  // announcing it as a slider and putting it in the tab order would be a promise
  // the page could not keep. The CSS hangs the cursor and the hit area off
  // [role="slider"] for the same reason: the affordance appears exactly when the
  // behaviour does.
  if (scrub) {
    scrub.setAttribute('role', 'slider');
    scrub.setAttribute('tabindex', '0');
    scrub.setAttribute('aria-label', 'Slide');
    scrub.setAttribute('aria-valuemin', '1');
    scrub.setAttribute('aria-valuemax', String(slides.length));

    // Press anywhere on the row and the deck goes there; keep pressing and it
    // follows. There is no separate handle to catch — the whole 40-unit band is
    // the control, which is why the design can get away with drawing no thumb.
    const seek = (clientX) => {
      const box = scrub.getBoundingClientRect();
      if (!box.width) return;
      const p = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
      deck.scrollLeft = entry + p * span;
    };

    // No preventDefault here, and no focus() either — deliberately, and it took
    // a screenshot to see why. preventDefault on pointerdown suppresses the
    // focus a click would otherwise confer, so focus had to be taken by hand;
    // and Chrome treats a scripted focus() as a KEYBOARD focus, which lit the
    // 1px focus ring around the whole 1370-wide row every time it was clicked
    // with a mouse. Letting the press focus the element itself is what tells the
    // browser which modality it was, so the ring appears on Tab and not on
    // click. The text selection that preventDefault was there to stop is stopped
    // in CSS instead, with user-select on the row.
    scrub.addEventListener('pointerdown', (event) => {
      scrub.setPointerCapture(event.pointerId);
      progress.classList.add('is-scrubbing');
      seek(event.clientX);
    });

    // Capture means every move comes here until the pointer is released, even
    // one that has left the row — so a drag that wanders up over the slides goes
    // on scrubbing rather than stopping dead at the edge.
    scrub.addEventListener('pointermove', (event) => {
      if (scrub.hasPointerCapture(event.pointerId)) seek(event.clientX);
    });

    for (const type of ['pointerup', 'pointercancel']) {
      scrub.addEventListener(type, (event) => {
        scrub.releasePointerCapture(event.pointerId);
        progress.classList.remove('is-scrubbing');
      });
    }

    // Keyboard, in the unit the control is labelled in: a step is a slide, not a
    // pixel and not a percent. Going to slide n puts its left edge on the page
    // margin, so every stop the keyboard makes is a composed frame rather than
    // wherever a percentage happened to land.
    //
    // None of those stops can fall outside the slider's range, so none of them
    // needs clamping: the panel's leading inset is 81 against a 20 margin, so
    // even slide 1 sits 61 past `entry`. That 61 is also why Home leaves the
    // fill a hair off zero rather than exactly on it — 9px of 1370, and the
    // alternative is a Home that lands on no frame in particular.
    // Up and Right increase, which is the direction ARIA specifies for a slider
    // and, here, also the direction the deck runs.
    const goTo = (n) => {
      const i = Math.min(Math.max(n, 1), slides.length) - 1;
      deck.scrollLeft = offsets[i] - margin;
    };

    scrub.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const now = slideAt(deck.scrollLeft);

      let to;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') to = now + 1;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') to = now - 1;
      else if (event.key === 'PageDown') to = now + 3;
      else if (event.key === 'PageUp') to = now - 3;
      else if (event.key === 'Home') to = 1;
      else if (event.key === 'End') to = slides.length;
      else return;

      event.preventDefault();
      goTo(to);
    });
  }

  /* --- the keyboard ------------------------------------------------------- */

  // Left, Right, Home and End already work: the scroller is focusable and the
  // browser gives a horizontal scroller those four for nothing. What it does
  // not give is the vertical set, and on a page whose only axis is horizontal
  // those are exactly the keys someone will reach for. Page and Space move by a
  // slide-and-gap rather than by a viewport, because a viewport here is a slide
  // and two thirds and paging by it would skip past a slide's worth of deck
  // every time.
  const stride = () => {
    const [a, b] = offsets;
    return b - a || deck.clientWidth;
  };

  deck.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    let by = 0;
    if (event.key === 'ArrowDown') by = 60;
    else if (event.key === 'ArrowUp') by = -60;
    else if (event.key === 'PageDown') by = stride();
    else if (event.key === 'PageUp') by = -stride();
    else if (event.key === ' ') by = event.shiftKey ? -stride() : stride();
    else return;

    event.preventDefault();
    deck.scrollLeft += by;
  });

  /* --- keeping the measurements true -------------------------------------- */

  // The slides are a fixed CSS box, so a decode does not move anything — but
  // --vr is a fraction of the viewport width, so a resize moves all of it.
  // ResizeObserver rather than the resize event: it also catches the scroller
  // changing size without the window doing so, which is what a phone's address
  // bar collapsing looks like.
  const remeasure = () => {
    measure();
    paint();
  };

  new ResizeObserver(remeasure).observe(deck);

  // Once more when the fonts land. Nothing on the track is text, so nothing on
  // it moves — but the brief is, and the brief is what the margin is read off.
  document.fonts?.ready.then(remeasure);

  remeasure();

  /* --- pushing past the end ------------------------------------------------ */

  // Keep scrolling at the last slide and the page hands over to the next one.
  //
  // A navigation nobody asked for is the worst thing a scroll can do, so this is
  // built around two rules: it must be VISIBLE that a push is accumulating, and
  // it must be impossible to trigger by accident.
  //
  // Visible: the NEXT label draws its own underline as the push builds. The
  // affordance and the gauge are the same object, so what fills is the thing
  // that is about to happen, and letting go before it completes undraws it.
  //
  // Not by accident: momentum is the whole problem. A trackpad flick that lands
  // on the last slide goes on delivering wheel events for another half second
  // after the fingers have left the glass, and that tail is easily longer than
  // any sane threshold. So the tail is disqualified by construction — a push
  // only counts if its gesture BEGAN at the end of the deck. Arriving at the end
  // and coasting does nothing; you have to stop, and push again.
  const COMMIT = 300; // px of deliberate push to hand over
  const PULL = 140; // px the deck travels on over the same push
  const GESTURE = 140; // ms of quiet that separates one gesture from the next
  const FORGET = 400; // ms after which an unfinished push lets go
  const SPRING = 300; // ms of the return, matching the CSS

  let pushed = 0;
  let lastWheel = 0;
  let armed = false;
  let handing = false;
  let forget;
  let spring;

  // Two things move, and they are the same number seen twice. The label draws
  // its underline, and the deck goes on travelling — dragged left by up to PULL
  // as the push builds, so the scroll appears to continue past the point where
  // it actually stopped. Linear against the push rather than eased, because it
  // is a gauge before it is an effect: how far the deck has moved IS how close
  // the hand-over is.
  function paintPush() {
    const p = pushed / COMMIT;
    if (gauge) gauge.style.width = `${p * 100}%`;
    track.style.transform = p ? `translate3d(${-p * PULL}px, 0, 0)` : '';
  }

  function letGo() {
    if (!pushed) return;
    pushed = 0;
    // The deck slides back rather than snapping, so abandoning a push reads as
    // the deck resisting rather than as a glitch. Reduced motion gets the snap.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      track.classList.add('is-springing');
      clearTimeout(spring);
      spring = setTimeout(() => track.classList.remove('is-springing'), SPRING);
    }
    paintPush();
  }

  function push(step) {
    if (!next || !track || handing) return;

    const now = performance.now();
    const fresh = now - lastWheel > GESTURE;
    lastWheel = now;

    // 1 rather than 0: scrollWidth is a rounded integer and the track is
    // fractional, so the last pixel of travel is unreachable and `>= max` would
    // never be true. See the note on the track's width in deck-page.css.
    const atEnd = deck.scrollLeft >= deck.scrollWidth - deck.clientWidth - 1;

    if (!atEnd) {
      armed = false;
      letGo();
      return;
    }

    // The gesture that carried you here is not the gesture that leaves. `fresh`
    // is only true on the first event after a pause, so a flick from mid-deck
    // arrives with fresh=false and its momentum tail never arms anything.
    if (fresh) armed = true;
    if (!armed) return;

    if (step <= 0) {
      letGo();
      return;
    }

    // A push that starts while the last one is still springing back has to take
    // the transition off first, or the deck lags a frame behind the gesture.
    clearTimeout(spring);
    track.classList.remove('is-springing');

    pushed = Math.min(pushed + step, COMMIT);
    paintPush();

    clearTimeout(forget);
    forget = setTimeout(letGo, FORGET);

    if (pushed >= COMMIT) {
      handing = true;
      clearTimeout(forget);
      location.href = next.href;
    }
  }

  /* --- back to the start --------------------------------------------------- */

  // Smooth, unlike everything else on this page. The wheel writes scrollLeft on
  // every tick and has to land exactly where it is put, which is why the
  // scroller is `scroll-behavior: auto`; this is a single jump of some nine
  // thousand pixels, and cutting it would read as the page having reloaded
  // rather than as having travelled back. The option overrides the CSS for this
  // one call, so the two do not have to fight.
  //
  // Home on the slider is not the same thing and is deliberately left alone: it
  // goes to the first SLIDE, which is 61 into the deck. This goes to the start of
  // the page, brief and all.
  restart?.addEventListener('click', () => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    deck.scrollTo({ left: 0, behavior: still ? 'auto' : 'smooth' });
    // The button is about to travel off the right-hand edge with the panel, and
    // focus cannot be left on something nobody can see. The track is the thing
    // it hands back to, and preventScroll stops that handover from undoing the
    // journey it was just asked to make.
    deck.focus({ preventScroll: true });
  });

  /* --- warming the deck ---------------------------------------------------- */

  // Every remaining slide, once the page has gone quiet.
  //
  // `loading="lazy"` is right for the first paint: two frames are on screen and
  // the other ten are several screens to the right. It stops being right the
  // moment the slider is a scrubber — a drag crosses the whole deck in about a
  // second, and lazy fetches only what is nearly in view, so the jump lands on
  // an empty rectangle and the picture arrives afterwards. Scrubbing is for
  // finding a slide, which you cannot do against blanks.
  //
  // So the laziness is spent where it pays — the first paint — and dropped
  // immediately after. Setting `loading` to eager on an undecoded lazy image is
  // what resumes its load; the whole deck is 1.6 MB, which is in cache long
  // before anyone has read the brief and reached for the slider.
  const warm = () => {
    for (const slide of slides) slide.loading = 'eager';
  };

  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
  else addEventListener('load', warm, { once: true });
}
