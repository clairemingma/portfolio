/* The entry for every project page. Not main.js: these surfaces have a bar that
   never travels and no print to pin, so importing the landing choreography would
   attach a scroll listener and a resize observer to a page with nothing for them
   to move. The only two things here that are scripted are the track and the
   address. */
import { mountProjectDeck } from './project-deck.js';
import { mountCopyAddress } from './copy-address.js';

mountProjectDeck();
mountCopyAddress();
