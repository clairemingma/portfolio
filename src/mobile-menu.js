/* ==========================================================================
   The menu, below 768

   Four columns hold the wordmark and one other thing. The bar has always known
   that — it drops LINKEDIN and the address at this width and keeps PROJECTS and
   ABOUT — and what it did with the two it dropped was hand them to a footer
   strip on every page. That strip is gone from the project pages: it spent a
   fixed 37.594 of a phone screen on two links and a copyright, over the work,
   on a page that already has a sheet across its foot.

   So the bar keeps the wordmark and gains [MENU], and everything it used to
   drop is in the panel that opens: the two sections, the address, LinkedIn, and
   the copyright line the footer used to carry.

   THE PANEL IS BUILT FROM THE BAR, not written again beside it. Every
   destination in it is read off the header that is already on the page — the
   hrefs, the words inside .nav__link-word, the address on the mail button's
   data-copy — so the landing page's `#projects` and a project page's
   `/#projects` both come out right without this file knowing which page it is
   on, and a link renamed in the markup is renamed here. The copyright is read
   the same way, off whichever footer rule the page carries.

   NOTHING IS HIDDEN UNTIL THIS RUNS. .has-mobile-menu is what takes PROJECTS
   and ABOUT out of the bar and the footer strip off the project pages, and it
   is added here — so a page whose script never arrives is the page it always
   was, with every link in the bar and the footer where they were. A menu is the
   one piece of navigation it would be least forgivable to hide behind a script
   that did not load. Same bargain the brief's sheet and the rail's scrub make.

   THE ADDRESS IS A COPY BUTTON like every other instance of it on the site, and
   that is why the entries mount this BEFORE mountCopyAddress: that module
   collects `[data-copy]` once, at mount, and a button added afterwards would
   look like the others and do nothing.
   ========================================================================== */

const NARROW = '(max-width: 767px)';

const OPEN = '[Menu]';
const SHUT = '[X]';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mountMobileMenu() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const narrow = matchMedia(NARROW);

  /* --- what goes in it, read off the bar ----------------------------------- */

  const sections = [...nav.querySelectorAll('.nav__link--projects, .nav__link--about')]
    .map((link) => ({
      href: link.getAttribute('href'),
      // The word is wrapped in the markup so the bar's hover underline misses
      // the trailing comma. That comma is the bar's punctuation, not the
      // destination's name, and it has no business in a stacked list.
      text: (link.querySelector('.nav__link-word') ?? link).textContent.trim(),
    }))
    .filter((s) => s.href);

  const linkedin = nav.querySelector('.nav__link--linkedin');
  const mail = nav.querySelector('.nav__link--mail');
  const rule = document.querySelector(
    '.rail-foot__rule, .reel__foot-rule, .still__foot-rule, .foot__rule'
  );

  /* --- the trigger --------------------------------------------------------- */

  const trigger = el('button', 'nav__menu', OPEN);
  trigger.type = 'button';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'menu');
  trigger.setAttribute('aria-label', 'Open the menu');

  /* --- the panel ----------------------------------------------------------- */

  const menu = el('div', 'menu');
  menu.id = 'menu';

  // A plain div and not a <button>: it is the whole page behind the panel, and
  // a button that size is announced as a control the size of the screen. The
  // close button in the corner is the one in the tab order; this is the
  // pointer's shortcut to it, and Escape is the keyboard's.
  const scrim = el('div', 'menu__scrim');
  scrim.setAttribute('aria-hidden', 'true');

  const panel = el('div', 'menu__panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Menu');

  const head = el('div', 'menu__head');
  head.append(el('p', 'menu__label', OPEN));

  const close = el('button', 'menu__close', SHUT);
  close.type = 'button';
  close.setAttribute('aria-label', 'Close the menu');
  head.append(close);
  panel.append(head);

  if (sections.length) {
    const list = el('ul', 'menu__list');
    for (const section of sections) {
      const item = el('li');
      const link = el('a', 'menu__link', section.text);
      link.href = section.href;
      item.append(link);
      list.append(item);
    }
    panel.append(list);
  }

  // The address and LinkedIn, under the labels the rest of the site sets its
  // small type in. Each block is only built if the bar had the thing in it.
  const reach = el('div', 'menu__reach');

  if (mail?.dataset.copy) {
    reach.append(el('p', 'menu__label', '[Contact]'));
    const button = el('button', 'menu__reach-link');
    button.type = 'button';
    button.dataset.copy = mail.dataset.copy;
    const label = el('span', null, mail.dataset.copy);
    label.setAttribute('data-copy-label', '');
    button.append(label);
    reach.append(button);
  }

  if (linkedin) {
    reach.append(el('p', 'menu__label', '[Social]'));
    const link = el('a', 'menu__reach-link', 'LinkedIn');
    link.href = linkedin.href;
    link.target = '_blank';
    link.rel = 'me noopener';
    reach.append(link);
  }

  if (reach.children.length) panel.append(reach);

  if (rule) panel.append(el('p', 'menu__rule', rule.textContent.trim()));

  menu.append(scrim, panel);

  /* --- opening and closing -------------------------------------------------- */

  let open = false;

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menu.classList.toggle('is-open', open);
    document.documentElement.classList.toggle('is-menu-open', open);
    trigger.setAttribute('aria-expanded', String(open));

    // Focus goes in and comes back. Without the return trip, closing the panel
    // drops the focus ring at the top of the document and the next Tab starts
    // the page over.
    if (open) close.focus();
    else trigger.focus();
  }

  trigger.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  scrim.addEventListener('click', () => setOpen(false));

  // Every destination in here is on this page or a hash on another, so the
  // panel has to shut itself: a hash link does not reload anything, and a menu
  // still standing over the section it just scrolled to is a menu that did not
  // work. The address is a copy button and is deliberately not in this — it
  // swaps its own label to "Copied" and you have to be able to see that.
  panel.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  /* --- turning it on and off ------------------------------------------------ */

  let live = false;

  function mount() {
    if (live) return;
    live = true;
    document.documentElement.classList.add('has-mobile-menu');
    nav.append(trigger);
    document.body.append(menu);
  }

  function unmount() {
    if (!live) return;
    live = false;
    setOpen(false);
    document.documentElement.classList.remove('has-mobile-menu');
    trigger.remove();
    menu.remove();
  }

  function sync() {
    if (narrow.matches) mount();
    else unmount();
  }

  sync();
  narrow.addEventListener('change', sync);
}
