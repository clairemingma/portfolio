/* The entry for the rail project pages — Confidence Underneath and MFW Color
   Trends, which are the same layout twice and share this file. Not main.js: the
   bar never travels on either and there is no print to pin, so importing the
   landing choreography would attach a scroll listener and a resize observer to a
   page with nothing for them to move.

   Two things are scripted on this page: the lock, and the address that is a copy
   button on every page of this site. */
import { mountRail } from './project-rail.js';
import { mountCopyAddress } from './copy-address.js';

mountRail();
mountCopyAddress();
