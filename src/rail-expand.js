/* ==========================================================================
   The rail, full screen

   Below 768 the presentation is a row of 16:9 slides about 200 units tall, and
   those slides are deck pages — headings, body copy, chart labels, set for a
   projector. The pictures read at that size and the words do not.

   COLLAPSED, THE PAGE IS ONE PICTURE WITH A TAP ON IT, and the full screen is
   where the deck is actually read. The row used to be swipeable in place,
   which let a reader drag through seventeen illegible slides; it is paged by
   NEXT now, and the picture is the way into the size that makes it legible.

   THE PICTURE IS THE WHOLE OF THAT AFFORDANCE. There was a [+] in the corner
   offering the same thing, and it was the only piece of drawn chrome on a page
   that has none anywhere else. See THE WAY IN below for what replaced it and
   what that costs a reader who is not using a thumb.

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
   asks for. Nothing about the OVERLAY watches a media query, therefore: the
   controls are appended once and the stylesheet decides which of them is up,
   keyed on .is-expanded, which holds at any width. See THE FULL SCREEN in
   src/rail-page.css. The one thing that does watch the query is the way IN —
   the pin's button role — and that is correct: it belongs to the collapsed
   narrow page, which is a page you are no longer on once this is open.

   The same turn is why this tells src/project-rail.js when the state changes.
   Crossing 768 is that module's signal to pin the rail, and a pinned rail
   translating its track underneath an overlay that is scrolling the same track
   is two positions for one row. It listens for the event below and stays
   released while this is up.

   NONE OF THIS IS IN THE MARKUP. Without script the page is the row the
   stylesheet describes, with no button offering a state it cannot enter and
   no tap target promising one. Same bargain the scrub makes.
   ========================================================================== */

// THE MARK IS TYPE, NOT DRAWING. It was an SVG of the four corner arrows,
// which is the conventional icon for this and was the wrong thing on this
// page: every other mark on the site is set in Inter inside square brackets —
// [CLIENT], [1/12], [+] — and a stroked glyph among them reads as something
// borrowed out of another interface.
//
// `×` is U+00D7 and not a lowercase x or a dingbat ✕: it is the glyph in the
// label face that is drawn on the figures' own axis, so it sits centred in the
// line box without being nudged.
//
// There is no opening mark to pair it with any more — see THE WAY IN below.
const IN = '×';

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
  const track = rail.querySelector('[data-track]');
  const slides = rail.querySelectorAll('[data-slide]');
  const count = rail.querySelector('[data-count]');
  if (!pin || !slides.length) return;

  const narrow = matchMedia(NARROW);
  const portrait = matchMedia(PORTRAIT);

  const close = button('rail__close', IN, 'Leave full screen');
  const prevHalf = button('rail__half rail__half--prev', '', 'Previous slide');
  const nextHalf = button('rail__half rail__half--next', '', 'Next slide');
  const next = button('progress__next', 'Next', 'Next slide');

  let open = false;

  /* --- the page ------------------------------------------------------------ */

  // THE ROW IS AN INDEX HERE, not a scroll position. See THE PAGE in
  // src/rail-page.css for why — the short of it is that the collapsed row does
  // not scroll at all any more, and the stage the full screen puts it on is
  // rotated, which is not a thing to ask a native scroller to be dragged
  // inside of.
  let page = 0;

  // IT WRAPS, which is what makes NEXT worth having at the foot of the row: a
  // control that stops working on the last slide is one a reader has to notice
  // has stopped. Twelve and seventeen slides are short enough that coming back
  // round to the first reads as the deck repeating rather than as a mistake,
  // and the counter says plainly which one you are on.
  function setPage(n) {
    const last = slides.length - 1;
    const to = n < 0 ? last : n > last ? 0 : n;
    if (to === page) return;
    page = to;
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
      // Back to the thing that was pressed to get in, which is the picture
      // itself now that the corner button is gone. The track is focusable at
      // this width — see THE WAY IN — so the ring lands on the work rather
      // than at the top of the document.
      if (narrow.matches) track?.focus();
    }
  }

  close.addEventListener('click', () => setOpen(false));

  prevHalf.addEventListener('click', () => setPage(page - 1));
  nextHalf.addEventListener('click', () => setPage(page + 1));
  next.addEventListener('click', () => setPage(page + 1));

  /* --- THE WAY IN ----------------------------------------------------------- */

  // TAP THE PICTURE. There is no enlarge button any more: it was one mark of
  // drawn chrome on a page that has none anywhere else, sitting on paper above
  // the work to announce something the work can say for itself. The slide is
  // most of the screen and it is the target a thumb goes for whether or not
  // there is a 44-square glyph in the corner offering the same thing.
  //
  // SO THE ARTWORK BECOMES THE CONTROL, rather than the tap being an extra
  // that a button underwrites. That is the part a pointer does not need and
  // everyone else does: without a <button> in the markup there is no tab stop
  // and no announced name, and the full screen would be a gesture that only
  // exists for people who can make it. role, tabindex and the label give the
  // box the three things the corner button was carrying, and the keydown below
  // gives it the two keys a real button answers to for free.
  //
  // IT GOES ON THE TRACK AND NOT THE PIN, and the difference is not cosmetic:
  // the pin also holds the counter row, and NEXT inside it is a real <button>.
  // A role="button" is not allowed to contain one — a control inside a control
  // is a thing assistive technology has no way to express — and it would be
  // announcing the presentation and its pager as one object. The track holds
  // the slides and nothing else, which is exactly what is being offered.
  //
  // The CLICK stays on the pin, though, because a thumb should not have to
  // find the picture's edges: everything in that box except the counter row
  // opens the full screen. The pointer gets the generous target and the
  // keyboard gets the honest one.
  //
  // NARROW ONLY, and taken back off above 768 — up there a click on the pin is
  // already a page turn, the halves that do it are the width of the window,
  // and a focusable box wrapping the whole presentation would be a tab stop in
  // front of the rail that does nothing when it is pressed.
  function setPinRole(on) {
    if (!track) return;
    if (on) {
      track.setAttribute('role', 'button');
      track.setAttribute('tabindex', '0');
      track.setAttribute('aria-label', 'View the slides full screen');
    } else {
      track.removeAttribute('role');
      track.removeAttribute('tabindex');
      track.removeAttribute('aria-label');
    }
  }

  // The guard is the same in both: not already open, and not a press that
  // landed on one of the controls standing in the pin. Those carry their own
  // clicks, and the counter row is type rather than a target.
  function fromPin(e) {
    if (open || !narrow.matches) return false;
    return !e.target.closest('.progress, .pager, button, a');
  }

  pin.addEventListener('click', (e) => {
    if (fromPin(e)) setOpen(true);
  });

  track?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (!fromPin(e)) return;
    // Space scrolls the page by default, and the page is about to be covered
    // by an overlay — so the document would be left a screen further down when
    // the reader comes back out of it.
    e.preventDefault();
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
  // ALL THREE GO IN THE PIN, which is the box the full screen rotates, so they
  // turn with the picture and a tap on its right-hand side lands on the
  // right-hand half without any coordinate arithmetic.
  pin.append(close, prevHalf, nextHalf);

  // NEXT goes in the counter's row, at the other end from the number — the
  // reference's own arrangement, and the reason it is injected rather than
  // written into the markup is the reason every control here is: without this
  // module the row cannot move, so a button offering to move it would be
  // offering something the page cannot do.
  const progress = rail.querySelector('[data-progress]');
  if (progress) progress.append(next);

  /* --- where PREV / NEXT lives --------------------------------------------- */

  // THIS IS A DOM MOVE AT A BREAKPOINT, which this project otherwise refuses
  // to do, and the reason it is unavoidable here is a containing block.
  //
  // Above 768 the pair belongs in the pin: the pin is `position: sticky` while
  // the rail is running, so an absolute box inside it sits in the charcoal's
  // footer band and stays there for the whole of the presentation. That is why
  // the markup puts it there.
  //
  // Below 768 it belongs at the END OF THE PAGE, under the brief. It cannot
  // get there by `order`, because order only sorts siblings and the pager's
  // siblings are inside the pin. It cannot get there by `position: absolute`
  // either: .rail is `position: relative` and is an ancestor, so it — not body
  // — is the containing block, and `bottom: 0` lands the pair at the foot of
  // the charcoal rather than the foot of the document. .rail cannot stop being
  // positioned, because .progress is anchored to it.
  //
  // So the element moves. It is one node, it moves back, and the two homes are
  // the two the design actually has.
  const pager = rail.querySelector('.pager');

  function placePager() {
    if (!pager) return;
    if (narrow.matches) document.body.append(pager);
    else pin.append(pager);
  }

  // One listener for both, because both are the same question — which of the
  // two pages this is — and two listeners on one query is two chances for them
  // to disagree about the answer.
  function syncWidth() {
    placePager();
    setPinRole(narrow.matches);
  }

  syncWidth();
  narrow.addEventListener('change', syncWidth);
}
