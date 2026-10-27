/* ==========================================================================
   The brief as a sheet

   Below 768 the brief is a panel of paper across the foot of the window, over
   the work, showing the title and the facts with [+] at its top right to open
   the rest. This module is what makes it one: it adds .is-sheet, injects the
   toggle, and publishes the panel's resting height so the templates can lay
   themselves out above it.

   THE COLLAPSE IS SCRIPT'S AND SO IS THE BUTTON, which is the whole of the
   bargain. The markup is a brief with every word of it on the page;
   project-brief.css hides .brief__more only under .is-sheet, and .is-sheet is
   added here. So a page whose script never arrives is a page you can read, and
   there is never a [+] that does not open anything. Same arrangement the rail's
   scrub makes — see enhanceScrub in src/project-rail.js.

   WIDE WINDOWS ARE LEFT ALONE and the query is watched live rather than read
   once: a window dragged past 768 in either direction has to end up with the
   brief the stylesheet at that width describes, and nothing half-applied from
   the other one. unmount() puts the element back exactly as it was found.

   --brief-sheet-h IS MEASURED RATHER THAN DERIVED. The sheet is as tall as a
   21pt title and however many facts a page carries, in whichever serif has
   loaded, wrapped to whatever the window is — four of those are things CSS
   cannot be told in advance. src/rail-page.css subtracts it from the window to
   size the charcoal band and the slide in it, and still-page.css and
   reel-page.css keep their work clear of it. The stylesheet carries a default
   for the instant before this runs; see :root in src/project-brief.css.
   ========================================================================== */

const NARROW = '(max-width: 767px)';

const SHUT = '[+]';
const OPEN = '[–]'; // en dash, not a hyphen: it is the + at the same width

export function mountBriefSheet() {
  const brief = document.querySelector('.brief');
  if (!brief) return;

  const more = brief.querySelector('[data-brief-more]');
  if (!more) return;

  const narrow = matchMedia(NARROW);

  // Given an id here rather than in the markup for the reason the button is
  // built here: aria-controls pointing at a region that is never hidden is a
  // promise about a behaviour the page does not have until this file runs.
  if (!more.id) more.id = 'brief-more';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'brief__toggle';
  toggle.setAttribute('aria-controls', more.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = SHUT;

  // The accessible name is a sentence and the visible label is a glyph. "+" on
  // its own is read out as "plus button", which says what it looks like rather
  // than what it does.
  function label(open) {
    toggle.textContent = open ? OPEN : SHUT;
    toggle.setAttribute(
      'aria-label',
      open ? 'Hide the project description' : 'Read the project description'
    );
  }

  function setOpen(open) {
    brief.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    label(open);
    // Opening changes the panel's height, and the rail sizes its band off it.
    publish();
  }

  toggle.addEventListener('click', () => {
    setOpen(!brief.classList.contains('is-open'));
  });

  /* --- the height ---------------------------------------------------------- */

  // The RESTING height, not the current one: what the templates need to know is
  // how much of the window the sheet takes when it is shut, because that is the
  // band the work is laid out in and the work must not reflow every time
  // somebody reads a paragraph. So an open sheet is measured shut — the class
  // comes off, the browser is asked for the height, and it goes straight back
  // on within the same frame, which is a read and a write with no paint between
  // them and therefore nothing to see.
  function publish() {
    if (!narrow.matches) {
      document.documentElement.style.removeProperty('--brief-sheet-h');
      return;
    }

    const open = brief.classList.contains('is-open');
    if (open) brief.classList.remove('is-open');
    const h = brief.offsetHeight;
    if (open) brief.classList.add('is-open');

    // In design units, because that is what every other length on these pages
    // is in and a px value here would not scale with --vr.
    const unit = parseFloat(getComputedStyle(document.documentElement).fontSize);
    if (h > 0 && unit > 0) {
      document.documentElement.style.setProperty(
        '--brief-sheet-h',
        `${(h / unit).toFixed(3)}rem`
      );
    }
  }

  /* --- turning it on and off ------------------------------------------------ */

  let live = false;

  // .has-brief-sheet goes on the document rather than on the brief, because
  // what each template keys off it is not the brief: the rail fixes its footer
  // strip to the foot of the window, the still page stops reserving flow for a
  // block that is no longer in the flow. Those are siblings and ancestors of
  // this element, and a class here would not reach them.
  function mount() {
    if (live) return;
    live = true;
    document.documentElement.classList.add('has-brief-sheet');
    brief.classList.add('is-sheet');
    label(false);
    toggle.setAttribute('aria-expanded', 'false');
    brief.prepend(toggle);
    publish();
  }

  function unmount() {
    if (!live) return;
    live = false;
    document.documentElement.classList.remove('has-brief-sheet');
    brief.classList.remove('is-sheet', 'is-open');
    toggle.remove();
    document.documentElement.style.removeProperty('--brief-sheet-h');
  }

  function sync() {
    if (narrow.matches) mount();
    else unmount();
  }

  sync();
  narrow.addEventListener('change', sync);

  // The sheet's height is the copy's, so it changes when the measure does and
  // again when the serif finally lands — a brief whose title wrapped in the
  // fallback face may not wrap in the real one. Both are resizes as far as the
  // box is concerned; fonts.ready is the one that is not.
  addEventListener('resize', publish);
  document.fonts?.ready.then(publish);
}
