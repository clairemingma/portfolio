/* The entry for the reel project pages.

   THE WIDE PAGE IS STILL NOT SCRIPTED. The frames snap because the CSS says
   `scroll-snap-type` and the brief stays put because it is `position: sticky`;
   neither needs a listener and neither degrades if this file never loads.

   All three mounts below belong to the NARROW page, where the frames are a
   swipe row rather than a screen each: the counter that keeps up with it, the
   menu the bar opens, and the address in that menu, which is a copy button on
   every page of this site.

   It takes its own entry rather than importing rail-page.js or still-page.js —
   those mount a pinned row and a cycling plate, and this page has neither, so
   sharing would be a querySelector per page for a thing that is not there. */
import { mountReelCounter } from './reel-counter.js';
import { mountMobileMenu } from './mobile-menu.js';
import { mountCopyAddress } from './copy-address.js';

// Keeps [1/3] true as the row of frames is swiped, which it only is below
// 768. See src/reel-counter.js.
mountReelCounter();
// Below 768 only, and it unmounts above it. The bar keeps the wordmark and
// gains [MENU]; the two sections, the address, LinkedIn and the copyright are
// in the panel it opens. BEFORE mountCopyAddress, always: that module collects
// every [data-copy] once, at mount, and the panel's address button is one of
// them. See src/mobile-menu.js.
mountMobileMenu();
mountCopyAddress();
