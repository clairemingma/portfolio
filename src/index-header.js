/* ==========================================================================
   Index header count

   The mobile list carries a sticky bar naming its two columns and counting
   where you are in the seven. The labels are static markup; the only thing
   this module owns is the number.

   WHICH PROJECT IS CURRENT is decided by a line across the viewport at the
   bottom edge of the bar itself, measured rather than assumed — the bar is
   sticky under a nav whose height is a custom property, and reading the rect
   means the two can never drift apart. A row counts as current once its top
   edge has passed above that line, so the count turns over exactly as the next
   cover slides under the bar, which is what the design does.

   The LAST row to have passed wins, not the first to be visible. Scanning for
   "the topmost row still on screen" would turn the count over a whole row too
   early on a tall cover, because a row is on screen long before it is the one
   being read.

   Nothing here runs on the desktop. The bar is display:none from 768 up, where
   the centred plate and the hover are what say which project is current, and an
   offsetParent check is what detects that — cheaper than matchMedia and true to
   whatever the stylesheet actually did, rather than to a breakpoint copied into
   a second place where it could fall out of step.
   ========================================================================== */

export function mountIndexHeader() {
  const head = document.querySelector('[data-index-head]');
  const count = document.querySelector('[data-index-count]');
  const index = document.querySelector('[data-index]');
  if (!head || !count || !index) return;

  const rows = [...index.querySelectorAll('[data-project]')];
  if (!rows.length) return;

  const total = rows.length;
  let last = '';

  function paint() {
    // display:none leaves no offsetParent, which is the desktop case and also
    // any state where the bar is not on the page to be read.
    if (!head.offsetParent) return;

    const line = head.getBoundingClientRect().bottom;

    let current = 0;
    for (let i = 0; i < total; i++) {
      // A tolerance of one pixel: a row sitting flush under the bar is a row
      // that has arrived, and sub-pixel layout should not decide otherwise.
      if (rows[i].getBoundingClientRect().top <= line + 1) current = i;
      else break;
    }

    // THE LAST ROW CANNOT REACH THE LINE, so it is claimed at the end of the
    // scroll instead. Below the list sits the footer, and the page stops
    // scrolling while the final row is still halfway down the window — so the
    // rule above, left alone, would hold at six of seven no matter how far
    // down you went, and the count would never close. Reaching the bottom IS
    // arriving at the last project; the reference reads 7/7 there because its
    // list ends the page and ours does not.
    const end =
      scrollY + innerHeight >=
      document.documentElement.scrollHeight - 2;
    if (end) current = total - 1;

    const next = `[${current + 1}/${total}]`;
    // The guard is the point of `last`: this runs on every frame a scroll
    // produces, and writing the same string back into the DOM each time is a
    // style recalculation for no change on screen.
    if (next !== last) {
      count.textContent = next;
      last = next;
    }
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      paint();
    });
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  paint();
}
