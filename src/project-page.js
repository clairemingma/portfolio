/* The project pages' entry. Deliberately not main.js: this surface has a bar
   that never travels and no print to pin, so it wants none of the scroll
   choreography — importing it would attach a scroll listener and a resize
   observer to a page with nothing for them to move. */
import { mountProjectGallery } from './project-gallery.js';
import { mountCopyAddress } from './copy-address.js';

mountProjectGallery();
mountCopyAddress();
