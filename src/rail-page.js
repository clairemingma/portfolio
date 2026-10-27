/* The entry for the rail project pages — Confidence Underneath and MFW Color
   Trends, which are the same layout twice and share this file. Not main.js: the
   bar never travels on either and there is no print to pin, so importing the
   landing choreography would attach a scroll listener and a resize observer to a
   page with nothing for them to move.

   Four things are scripted on this page. The lock, and the address that is a
   copy button on every page of this site — and two that exist only below 768,
   where the rail is a swipeable row at the foot of a phone rather than a pinned
   presentation: the brief collapsed into a sheet across the bottom of the
   window, and the enlarge button that hands the whole window to the slides.
   Both of those mount and unmount with the breakpoint and do nothing above it. */
import { mountRail } from './project-rail.js';
import { mountRailExpand } from './rail-expand.js';
import { mountBriefSheet } from './brief-sheet.js';
import { mountCopyAddress } from './copy-address.js';

mountRail();
mountRailExpand();
mountBriefSheet();
mountCopyAddress();
