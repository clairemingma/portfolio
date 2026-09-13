/* The entry for the still project pages — the ones that are a screen rather than
   a deck. Not deck-page.js: there is no track here to redirect the wheel onto,
   and mounting the deck would attach a wheel handler, a resize observer and a
   scrub slider to a page with no slides. Not main.js either, for the reason
   given there: the bar never travels and there is no print to pin.

   One entry for all of the still pages rather than one each. Every mount below
   looks for its own hook and returns immediately if the page has none — Trending
   This Week has a cycling plate and no video, Studio Edit 02 has clips and no
   plate — so the cost of the shared entry is one querySelector per page for the
   thing it does not have, and the benefit is that a third still page needs no new
   entry file and cannot forget to mount the address. */
import { mountPlateCycle } from './plate-cycle.js';
import { mountVideoAutoplay } from './video-autoplay.js';
import { mountCopyAddress } from './copy-address.js';

mountPlateCycle();
mountVideoAutoplay();
mountCopyAddress();
