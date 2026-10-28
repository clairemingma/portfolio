/* ==========================================================================
   The rail, full screen

   Below 768 the presentation is a row of 16:9 slides about 200 units tall, and
   those slides are deck pages — headings, body copy, chart labels, set for a
   projector. The pictures read at that size and the words do not.

   SO THE SLIDES DO NOT MOVE UNTIL THIS IS OPEN. The row used to be swipeable
   in place, which let a reader drag through seventeen illegible slides and
   never find the control that would have made them readable. Collapsed, the
   page is one picture with a tap on it; the full screen is where the deck is
   actually read.

   WHAT OPENING IT DOES IS TURN THE SCREEN, the way a video does when it goes
   full screen on a phone: the stage is the window's dimensions swapped and
   rotated a quarter turn, so a 16:9 slide gets the long edge of the device
   instead of the short one. The geometry is in THE STAGE in src/rail-page.css;
   this module owns the state, the page index and the gestures.

   THE OVERLAY IS CSS AND THE FULLSCREEN API IS A BONUS. .is-expanded on the
   rail is a fixed box over the viewport and is the version that works
   everywhere; requestFullscreen is tried after it and is allowed to fail. It
   has to be allowed to — iOS Safari implements it for <video> and nothing
   else, and iPhones are most of what this is for. Where it does work, on
   Android, it buys one less strip of browser chrome and it is the only state
   in which the orientation lock below is permitted at all.

   THE LOCK IS ASKED FOR AND NEVER RELIED ON, and nothing depends on it now
   that the stage turns itself. On Android in fullscreen it resolves and the
   device follows; everywhere else it is undefined or refused and the reader
   simply turns the phone to a picture that is already the right way round for
   it. There is no longer a line of type telling them to: a sideways photograph
   filling the screen says it, and a sentence over the artwork would be the one
   piece of chrome on a page built to avoid it.

   THE OVERLAY HAS TO OUTLIVE THE BREAKPOINT, which is the one thing about this
   that is not obvious. A phone turned sideways is 844 CSS pixels wide — past
   768 — so the narrow layout switches off at the exact moment this feature
   asks for. Nothing here watches a media query, therefore: the controls are
   appended once and the stylesheet decides which of them is up, with only the
   enlarge button scoped to narrow windows. The overlay itself is keyed on
   .is-expanded and holds at any width. See THE FULL SCREEN in
   src/rail-page.css.

   The same turn is why this tells src/project-rail.js when the state changes.
   Crossing 768 is that module's signal to pin the rail, and a pinned rail
   translating its track underneath an overlay that is scrolling the same track
   is two positions for one row. It listens for the event below and stays
   released while this is up.

   NONE OF THIS IS IN THE MARKUP. Without script the page is the row the
   stylesheet describes, with no button offering a state it cannot enter and
   no tap target promising one. Same bargain the scrub makes.
   ========================================================================== */

// THE TWO MARKS ARE TYPE, NOT DRAWING. They were an SVG of the four corner
// arrows, which is the conventional icon for this and was the wrong thing on
// this page: every other mark on the site is set in Inter inside square
// brackets — [CLIENT], [1/12], [MENU] — and a stroked glyph among them reads
// as something borrowed out of another interface.
//
// `<>` points outward and `><` points in, which is the instruction the corner
// arrows were giving, in two characters the label face certainly has. They are
// the brackets' own content rather than chevrons set beside them, so the mark
// is one object at a glance and exactly as wide in both states.
const OUT = '[<>]';
const IN = '[><]';

function button(className, text, label) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = text;
  el.setAttribute('aria-label', label);
  return el;
}

const NARROW = '(max-width: 767px)';
const PORTRAIT = '(orientation: portrait)';

// How far a finger has to travel before it is a page turn rather than a tap
// that wandered. In CSS pixels, not design units: this is a property of hands.
const SWIPE = 40;

export function mountRailExpand() {
  const rail = document.querySelector('[data-rail]');
  if (!rail) return;

  const pin = rail.querySelector('[data-pin]');
  const slides = rail.querySelectorAll('[data-slide]');
  const count = rail.querySelector('[data-count]');
  if (!pin || !slides.length) return;

  const narrow = matchMedia(NARROW);
  const portrait = matchMedia(PORTRAIT);

  const expand = button('rail__expand', OUT, 'View the slides full screen');
  const close = button('rail__close', IN, 'Leave full screen');
  const prevHalf = button('rail__half rail__half--prev', '', 'Previous slide');
  const nextHalf = button('rail__half rail__half--next', '', 'Next slide');

  let open = false;

  /* --- the page ------------------------------------------------------------ */

  // THE ROW IS AN INDEX HERE, not a scroll position. See THE PAGE in
  // src/rail-page.css for why — the short of it is that the collapsed row does
  // not scroll at all any more, and the stage the full screen puts it on is
  // rotated, which is not a thing to ask a native scroller to be dragged
  // inside of.
  let page = 0;

  function setPage(n) {
    const next = Math.min(slides.length - 1, Math.max(0, n));
    if (next === page) return;
    page = next;
    rail.style.setProperty('--rail-page', String(page));
    if (count) count.textContent = `[${page + 1}/${slides.length}]`;
  }

  /* --- the real fullscreen, where there is one ------------------------------ */

  // Both calls are wrapped because both throw rather than reject on some
  // engines, and neither failing is a problem: the overlay is already up.
  async function enterNative() {
    if (!rail.requestFullscreen) return;
    try {
      await rail.requestFullscreen({ navigationUI: 'hide' });
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* unsupported, refused, or not a user gesture any more */
    }
  }

  function exitNative() {
    try {
      screen.orientation?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen();
    } catch {
      /* nothing to leave */
    }
  }

  /* --- the state ----------------------------------------------------------- */

  function setOpen(next) {
    if (next === open) return;
    open = next;
    rail.classList.toggle('is-expanded', open);
    document.documentElement.classList.toggle('is-rail-expanded', open);

    // src/project-rail.js listens: it must not pin the rail while the overlay
    // is scrolling the same row. Fired before the fullscreen call, so the pin
    // is already let go of by the time anything about the window changes.
    rail.dispatchEvent(new CustomEvent('rail:fullscreen', { detail: { open } }));

    if (open) {
      enterNative();
      close.focus();
    } else {
      exitNative();
      expand.focus();
    }
  }

  expand.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));

  prevHalf.addEventListener('click', () => setPage(page - 1));
  nextHalf.addEventListener('click', () => setPage(page + 1));

  // TAP THE PICTURE TO OPEN IT. The button in the corner is the one a screen
  // reader and a keyboard get, and it is 44 square against a slide that is
  // most of the screen — so the slide is the target a thumb actually goes for.
  //
  // Narrow only: above 768 a click on the pin is already a page turn, and the
  // halves that do it are the whole width of the window.
  pin.addEventListener('click', (e) => {
    if (open || !narrow.matches) return;
    if (e.target.closest('.progress, .pager, button, a')) return;
    setOpen(true);
  });

  /* --- the swipe ----------------------------------------------------------- */

  // THE GESTURE IS READ IN THE STAGE'S AXIS AND NOT THE SCREEN'S. In portrait
  // the stage is turned a quarter turn, so the row's own +x runs DOWN the
  // device: a finger travelling down the glass is travelling right across the
  // picture. The delta is therefore taken from clientY while the rotation is
  // on and from clientX when it is not, which is the inverse of the transform
  // the stylesheet applies and has to be kept in step with it.
  //
  // Measured once on touchend rather than followed live. A dragged row that
  // tracks the finger wants momentum, rubber-banding at both ends and a
  // velocity threshold to settle on a slide; what this needs is one question —
  // which way, and far enough — asked when the finger lifts.
  let from = null;

  pin.addEventListener(
    'touchstart',
    (e) => {
      if (!open || e.touches.length !== 1) return;
      from = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true },
  );

  pin.addEventListener(
    'touchend',
    (e) => {
      if (!open || !from) return;
      const t = e.changedTouches[0];
      const dx = portrait.matches ? t.clientY - from.y : t.clientX - from.x;
      from = null;
      if (Math.abs(dx) < SWIPE) return;
      // Dragging the row left brings the next slide on, which is what every
      // carousel on a phone does and the opposite of what the arithmetic
      // says: a negative delta is a higher index.
      setPage(dx < 0 ? page + 1 : page - 1);
    },
    { passive: true },
  );

  // The arrow keys, for the same two moves. The halves are buttons and so are
  // already in the tab order; this is for a reader who is looking at the
  // picture rather than at the controls.
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'ArrowRight') setPage(page + 1);
    else if (e.key === 'ArrowLeft') setPage(page - 1);
  });

  // Escape is the one key every overlay on every platform answers to, and on a
  // phone with a keyboard attached it is the only way out that does not need a
  // tap on a 44-square target in a corner.
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  // Leaving fullscreen by the browser's own gesture — the Android back button,
  // the swipe down — must take the overlay with it, or the page is left in a
  // state the reader has already asked to leave.
  document.addEventListener('fullscreenchange', () => {
    if (open && !document.fullscreenElement) setOpen(false);
  });

  // Appended once and left there. Which of them is up is the stylesheet's to
  // decide, and it has to be: the one state that matters — the overlay, in
  // landscape — is a state in which the narrow media query this module would
  // otherwise have watched is false.
  //
  // THE SPLIT IS WHICH BOX THEY BELONG TO. The halves and the close go in the
  // PIN, which is the box the full screen rotates, so they turn with the
  // picture and a tap on its right-hand side lands on the right-hand half
  // without any coordinate arithmetic. The enlarge button stays on .rail,
  // which does not rotate, because in the collapsed state the pin is static
  // and has no corner of its own to sit in.
  rail.append(expand);
  pin.append(close, prevHalf, nextHalf);
}
