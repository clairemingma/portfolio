import { mountScrollChoreography } from './scroll-choreography.js';
import { mountProjectViewer } from './project-viewer.js';
import { mountCopyAddress } from './copy-address.js';
import { mountLoadOrder } from './load-order.js';
import { mountIndexHeader } from './index-header.js';
import { mountIndexMotion } from './index-motion.js';

mountLoadOrder();
mountScrollChoreography();
mountProjectViewer();
mountCopyAddress();
mountIndexHeader();
mountIndexMotion();
