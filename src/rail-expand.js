/* ==========================================================================
   The rail, full screen

   Below 768 the presentation is a row of 16:9 slides about 200 units tall, and
   those slides are deck pages — headings, body copy, chart labels, set for a
   projector. The pictures read at that size and the words do not. This module
   adds the way out: an enlarge button at the top right of the charcoal that
   hands the whole window to the row, and a line asking for the phone to be
   turned, which is what actually makes the slide three times larger.

   THE OVERLAY IS CSS AND THE FULLSCREEN API IS A BONUS. .is-expanded on the
   rail is a fixed box over the viewport and is the version that works
   everywhere; requestFullscreen is tried after it and is allowed to fail. It
   has to be allowed to — iOS Safari implements it for <video> and nothing
   else, and iPhones are most of what this is for. Where it does work, on
   Android, it buys one less strip of browser chrome and it is the only state
   in which the orientation lock below is permitted at all.

   THE LOCK IS ASKED FOR AND NEVER RELIED ON. screen.orientation.lock resolves
   on Android in fullscreen and rejects or is undefined everywhere else, so the
   hint is not a fallback for it — the hint is the mechanism, and the lock is
   the shortcut on the one platform that has it. Nothing is reported to the
   reader either way: a line saying to turn the phone, on a phone that has
   already turned itself, would be the only broken thing on the screen.

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
   stylesheet describes, swipeable, with no button offering a state it cannot
   enter. Same bargain the scrub and the brief's sheet make.
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

export function mountRailExpand() {
  const rail = document.querySelector('[data-rail]');
  if (!rail) return;

  const expand = button('rail__expand', OUT, 'View the slides full screen');
  const close = button('rail__close', IN, 'Leave full screen');

  const hint = document.createElement('p');
  hint.className = 'rail__hint';
  hint.textContent = 'Turn your phone sideways';

  let open = false;

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

  // Appended once and left there. Which of the three is up is the
  // stylesheet's to decide, and it has to be: the one state that matters —
  // the overlay, in landscape — is a state in which the narrow media query
  // this module would otherwise have watched is false.
  rail.append(expand, close, hint);
}
