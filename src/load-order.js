/* ==========================================================================
   Load order

   Nothing else spends the connection until the print is up.

   The landing page wants a 545 KB plate, a 3.6 MB clip and six preview plates.
   The clip and the previews are not visible until the index is scrolled to — 1.6
   viewports down, and then only on hover — but the browser does not know that, and
   on a 1.5 Mbps connection they were taking enough of the pipe that the print had
   not arrived after nine seconds. What showed until it did was the placeholder,
   which is not what the page is.

   So they are held: `preload="none"` for the clip, `data-src` for the plates, and
   both are promoted here once the plate has decoded. Nothing is dropped — by the
   time anyone has scrolled to the index they are all in, so the plate swap is
   still the single-frame cut it is meant to be.

   Measured on the build: the print went from 7310ms to 3707ms, which is close to
   the floor for its own bytes.

   This used to fade the plate in as well. It does not: on a fast connection the
   plate arrives in about 50ms, so the fade animated a wait that had not happened,
   and holding the plate transparent until script ran meant it never appeared at
   all without script.
   ========================================================================== */

export function mountLoadOrder() {
  const plate = document.querySelector('.stage__plate img');

  // Promoted after the print, not on a timer: the point is the ordering, and a
  // timer would only be a guess at it.
  function release() {
    for (const el of document.querySelectorAll('img[data-src]')) {
      el.src = el.dataset.src;
      delete el.dataset.src;
    }
    for (const el of document.querySelectorAll('[data-preload]')) {
      el.preload = el.dataset.preload;
      delete el.dataset.preload;
      // load() is what makes a <video> act on a changed preload; without it the
      // attribute is set and nothing is fetched until something else prods it.
      if (typeof el.load === 'function') el.load();
    }
  }

  // Already decoded — from cache, or simply faster than this module. The load
  // event will never fire, so waiting for it would hold everything for ever.
  if (!plate || plate.complete) {
    release();
    return;
  }

  plate.addEventListener('load', release, { once: true });
  // A plate that fails is still a plate that is not coming, and holding the rest
  // back for ever because of it would be worse than showing nothing.
  plate.addEventListener('error', release, { once: true });
}
