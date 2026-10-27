import { mountScrollChoreography } from './scroll-choreography.js';
import { mountProjectViewer } from './project-viewer.js';
import { mountMobileMenu } from './mobile-menu.js';
import { mountCopyAddress } from './copy-address.js';
import { mountLoadOrder } from './load-order.js';
import { mountIndexHeader } from './index-header.js';
import { mountIndexMotion } from './index-motion.js';

mountLoadOrder();
mountScrollChoreography();
mountProjectViewer();
// Below 768 only, and it unmounts above it. The bar keeps the wordmark and
// gains [MENU]; the two sections, the address, LinkedIn and the copyright are
// in the panel it opens. BEFORE mountCopyAddress, always: that module collects
// every [data-copy] once, at mount, and the panel's address button is one of
// them. See src/mobile-menu.js.
mountMobileMenu();
mountCopyAddress();
mountIndexHeader();
mountIndexMotion();
