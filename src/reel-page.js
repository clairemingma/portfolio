/* The entry for the reel project page, and it mounts one thing.

   The reel itself is not scripted: the frames snap because the CSS says
   `scroll-snap-type`, and the brief stays put because it is `position: sticky`.
   Neither needs a listener, and neither degrades if this file never loads.

   What does need script is the address in the bar, which is a copy button on
   every page of this site. That is the whole of it — deck-page.js also mounts a
   track and still-page.js a plate and two videos, and this page has none of
   those, so it takes its own entry rather than importing either and relying on a
   querySelector to come back empty. */
import { mountCopyAddress } from './copy-address.js';

mountCopyAddress();
