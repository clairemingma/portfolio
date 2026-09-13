/* Drives the built site in headless Chrome over CDP and asserts the scroll
   geometry at each phase boundary. No dependencies: Node 22 has WebSocket.

   Usage: node scripts/verify-choreography.mjs [url]  (default: preview server) */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const URL_UNDER_TEST = process.argv[2] ?? 'http://localhost:4173/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const VIEWPORT = { width: 1440, height: 900 };
const SHOTS = 'scripts/.verify';

const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=/tmp/portfolio-verify-profile',
  `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
  'about:blank',
]);
chrome.stderr.on('data', () => {});

let ws;
let nextId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const { webSocketDebuggerUrl } = await res.json();
      ws = new WebSocket(webSocketDebuggerUrl);
      await new Promise((ok, no) => {
        ws.addEventListener('open', ok, { once: true });
        ws.addEventListener('error', no, { once: true });
      });
      ws.addEventListener('message', (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error
            ? reject(new Error(msg.error.message))
            : resolve(msg.result);
        }
      });
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error('could not reach Chrome DevTools');
}

await connect();

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', {
  targetId,
  flatten: true,
});

const call = (method, params) => send(method, params, sessionId);

await call('Page.enable');
await call('Runtime.enable');
await call('Emulation.setDeviceMetricsOverride', {
  ...VIEWPORT,
  deviceScaleFactor: 1,
  mobile: false,
});

async function evaluate(expression) {
  const { result, exceptionDetails } = await call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails)
    throw new Error(exceptionDetails.exception?.description ?? 'eval failed');
  return result.value;
}

await call('Page.navigate', { url: URL_UNDER_TEST });
// Settle: document ready, webfonts resolved, one rAF for the first frame().
await evaluate(`new Promise(async (r) => {
  if (document.readyState !== 'complete') await new Promise(k => addEventListener('load', k, {once:true}));
  try { await document.fonts.ready } catch {}
  requestAnimationFrame(() => requestAnimationFrame(r));
})`);

const PROBE = `(() => {
  const cs = getComputedStyle(document.documentElement);
  const num = (n) => parseFloat(cs.getPropertyValue(n));
  const nav = document.querySelector('[data-nav]');
  const sheet = document.querySelector('.sheet');
  const stage = document.querySelector('[data-stage]');
  const copy = document.querySelector('[data-about-copy]');
  const aboutLink = document.querySelector('.nav__link--about');
  const index = document.querySelector('[data-index]');
  const viewer = document.querySelector('[data-viewer]');
  const navBox = nav.getBoundingClientRect();
  const sheetBox = sheet.getBoundingClientRect();
  const stageBox = stage.getBoundingClientRect();
  const copyBox = copy.getBoundingClientRect();
  const linkBox = aboutLink.getBoundingClientRect();
  const indexBox = index.getBoundingClientRect();
  const viewerBox = viewer.getBoundingClientRect();
  return {
    scrollY: Math.round(window.scrollY),
    vh: num('--vh'), navH: num('--nav-h'), t1: num('--t1'),
    navRest: num('--nav-rest'),
    p1: num('--p1'), navY: num('--nav-y'),
    // The copy sits under the ABOUT label. It used to be pixel-exact, because
    // both were padded to the same offset in a twelve-column grid; now that the
    // bar centres ABOUT in its own column there is no fixed offset to share, so
    // the tie is "same place on the page" rather than "same pixel".
    copyLeft: +copyBox.left.toFixed(1),
    copyTop: +copyBox.top.toFixed(1),
    copyOpacity: +getComputedStyle(copy).opacity,
    copyBottom: +copyBox.bottom.toFixed(1),
    aboutRise: num('--about-rise'),
    // The swap must be a cut: any non-zero duration on the plates is a bug.
    plateTransition: getComputedStyle(document.querySelector('.viewer__plate'))
      .transitionDuration,
    // Every plate's transform must be a pure translation. Comparing two plates'
    // matrices outright would fail for the right reason and the wrong one: the
    // centring translate is -50% of each plate's *own* height, and the plates
    // are deliberately different sizes. So check the scale terms instead — a
    // returning scale(1.03) shows up there and nothing else does.
    plateScales: [...document.querySelectorAll('.viewer__plate')].map((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return [m.a, m.d];
    }),
    markText: nav.querySelector('.nav__mark').textContent.replace(/\s+/g, ' ').trim(),
    // The pair the bar collects. Read as computed style rather than by class so
    // the assertions below test the state, not the markup.
    pairHidden: ['.nav__link--linkedin', '.nav__link--mail'].map((sel) => {
      const s = getComputedStyle(document.querySelector(sel));
      return s.visibility + '/' + s.opacity;
    }).join(' '),
    hasContact: !!document.querySelector('.nav__link--contact'),
    footPairShown: ['.foot__link', '.foot__mail'].map((sel) => {
      const el = document.querySelector(sel);
      return el ? getComputedStyle(el).display : 'absent';
    }).join(' '),
    linkedinHref: document.querySelector('.nav__link--linkedin')?.getAttribute('href') ?? '',
    linkedinTarget: document.querySelector('.nav__link--linkedin')?.getAttribute('target') ?? '',
    mailIsButton: document.querySelector('.nav__link--mail')?.tagName ?? '',
    mailCopies: document.querySelector('.nav__link--mail')?.dataset.copy ?? '',
    aboutLinkTextLeft:
      +(linkBox.left + parseFloat(getComputedStyle(aboutLink).paddingLeft)).toFixed(1),
    // The word alone, matching what main.js measures — the link's own box also
    // holds the trailing comma.
    aboutWordLeft: +document
      .querySelector('.nav__link--about .nav__link-word')
      .getBoundingClientRect().left.toFixed(1),
    gutter: parseFloat(cs.getPropertyValue('--grid-gutter')),
    gridMargin: parseFloat(cs.getPropertyValue('--grid-margin')),
    // Five columns in the bar and in both correspondence lines, one item each
    // with the fourth empty.
    navColumns: getComputedStyle(nav).gridTemplateColumns.split(' ').length,
    aboutSpanCentre: (() => {
      const b = nav.querySelector('.nav__link--about').getBoundingClientRect();
      // The link's own box is centred in its span, so its centre IS the span's.
      return +((b.left + b.right) / 2).toFixed(1);
    })(),
    footColumns: getComputedStyle(document.querySelector('.foot')).gridTemplateColumns.split(' ').length,
    navSlots: [...nav.children].map((el) => {
      const g = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return g.gridColumnStart + ':' + g.justifySelf + ':' + b.left.toFixed(0) + '-' + b.right.toFixed(0);
    }),
    footSlots: [...document.querySelector('.foot').children].map((el) => {
      const g = getComputedStyle(el);
      return g.gridColumnStart + ':' + g.justifySelf;
    }),
    indexCentreY: +(indexBox.top + indexBox.height / 2).toFixed(1),
    viewerCentreY: +(viewerBox.top + viewerBox.height / 2).toFixed(1),
    // offsetWidth/Height, not getBoundingClientRect: the plates carry a
    // centring translate, and the rect would fold any transform into the
    // reading instead of giving the layout box being asserted.
    plates: [...document.querySelectorAll('.viewer__plate')].map((el) => ({
      id: el.dataset.plate,
      w: el.offsetWidth, h: el.offsetHeight,
      wantW: parseFloat(el.style.getPropertyValue('--pv-w')),
      wantH: parseFloat(el.style.getPropertyValue('--pv-h')),
      // The video plate has no naturalWidth; reading it there would hand the
      // upscale assertion a NaN and let the one moving plate pass unchecked.
      natural:
        el.tagName === 'VIDEO'
          ? el.videoWidth + 'x' + el.videoHeight
          : el.naturalWidth + 'x' + el.naturalHeight,
    })),
    navTop: +navBox.top.toFixed(1), navBottom: +navBox.bottom.toFixed(1),
    navHeight: +navBox.height.toFixed(1),
    sheetTop: +sheetBox.top.toFixed(1),
    stageTop: +stageBox.top.toFixed(1), stageBottom: +stageBox.bottom.toFixed(1),
    stageWidth: +stageBox.width.toFixed(1), stageHeight: +stageBox.height.toFixed(1),
    // The print's own position. It rides the container, so it should track the
    // scroll 1:1 through phase 2 rather than sitting still.
    plateTop: +document.querySelector('.stage__plate').getBoundingClientRect().top.toFixed(1),
    plateBottom: +document.querySelector('.stage__plate').getBoundingClientRect().bottom.toFixed(1),
    litPlate: document.querySelector('.viewer__plate.is-active')?.dataset.plate ?? null,
    litCount: document.querySelectorAll('.viewer__plate.is-active').length,
    currentRow: document.querySelector('.index__row.is-current')?.dataset.project ?? null,
    currentRowCount: document.querySelectorAll('.index__row.is-current').length,
    // The bar must not draw a rule under itself once it is on the paper.
    navShadow: getComputedStyle(nav).boxShadow,
    // The grain is baked into the scan now, so there should be no layer over
    // the plate adding it — nor any blend mode left behind from when there was.
    plateOverlay: getComputedStyle(document.querySelector('.stage__plate'), '::after')
      .content,
    plateBlend: getComputedStyle(document.querySelector('.stage__plate'), '::after')
      .mixBlendMode,
    markFamily: getComputedStyle(nav.querySelector('.nav__mark')).fontFamily,
    markSize: getComputedStyle(nav.querySelector('.nav__mark')).fontSize,
    titleFamily: getComputedStyle(document.querySelector('.index__title')).fontFamily,
    labelFamily: getComputedStyle(document.querySelector('.index__client')).fontFamily,
    overPaper: nav.classList.contains('is-over-paper'),
    navColor: getComputedStyle(nav.querySelector('.nav__mark')).color,
    navBg: getComputedStyle(nav).backgroundColor,
    navTransition: getComputedStyle(nav).transitionDuration,
    navTransitionProperty: getComputedStyle(nav).transitionProperty,
    navEasing: getComputedStyle(nav).transitionTimingFunction,
    sheetHeight: +sheet.getBoundingClientRect().height.toFixed(1),
    footBottom: +document
      .querySelector('.foot')
      .getBoundingClientRect()
      .bottom.toFixed(1),
    // The hover rule is a text underline on the word, with no ::after bar left
    // behind to animate.
    linkWordDecoration: getComputedStyle(document.querySelector('.nav__link-word'))
      .textDecorationLine,
    linkAfterContent: getComputedStyle(
      document.querySelector('.nav__link'),
      '::after',
    ).content,
    docHeight: document.documentElement.scrollHeight,
  };
})()`;

// `settle` lets the nav's 320ms colour transition finish before we read the
// computed colour — otherwise we sample a mid-transition grey.
async function probeAt(y, settle = 0) {
  await evaluate(`new Promise(r => { scrollTo({top:${y}, behavior:'instant'});
    requestAnimationFrame(() => requestAnimationFrame(r)); })`);
  if (settle) await sleep(settle);
  return evaluate(PROBE);
}

async function shoot(name) {
  const { data } = await call('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${SHOTS}/${name}.png`, Buffer.from(data, 'base64'));
}

await mkdir(SHOTS, { recursive: true });

// --- derive the boundaries from the page's own numbers --------------------
const base = await probeAt(0, 500);
const { vh, navH, t1 } = base;
const t2 = vh - navH;
const stickAt = t1 + t2;

const checks = [];
const ok = (label, pass, detail) => checks.push({ label, pass, detail });
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const isTransparent = (c) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
// The bar is only ever pure white or pure graphite — never a value between, now
// that the crossing blend is gone. Chrome reports either notation.
const isWhite = (c) =>
  /^(rgb\(255,\s*255,\s*255\)|color\(srgb 1 1 1\))$/.test(c.trim());
const isGraphite = (c) =>
  c.replace(/\s/g, '') === 'rgb(64,64,64)' ||
  /^color\(srgb 0\.25[0-9]* 0\.25[0-9]* 0\.25[0-9]*\)$/.test(c.trim());

// ---- landing -------------------------------------------------------------
ok(
  'plate fills the viewport on landing',
  near(base.stageWidth, VIEWPORT.width) &&
    near(base.stageHeight, vh) &&
    near(base.stageTop, 0),
  `${base.stageWidth}x${base.stageHeight} at top ${base.stageTop}`,
);
ok(
  'nav rests centred on the print, where the design puts it',
  near(base.navTop, base.navRest, 2) && near(base.navRest, (vh - navH) / 2, 2),
  `navTop ${base.navTop} vs navRest ${base.navRest} vs (vh-navH)/2 ${((vh - navH) / 2).toFixed(1)}`,
);
ok(
  'nav type is light over the print',
  !base.overPaper && isWhite(base.navColor),
  base.navColor,
);
// Back to pixel-exact. The label is centred, so its text edge is on no grid
// line — both are on column 6 of the page's twelve, so they share a grid line,
// which is why this can be tight again rather than a gutter's worth of slack.
ok(
  'about copy aligns to the left edge of the ABOUT label',
  near(base.copyLeft, base.aboutWordLeft, 1),
  `copy ${base.copyLeft} vs label ${base.aboutWordLeft}`,
);
ok(
  'about copy sits under the bar, not inside it',
  base.copyTop >= base.navTop + navH - 4,
  `copyTop ${base.copyTop} vs bar bottom ${(base.navTop + navH).toFixed(1)}`,
);
ok(
  'about copy is at rest, unmoved, on landing',
  base.p1 === 0 && near(base.copyTop, base.navRest + navH, 2),
  `p1 ${base.p1}, copyTop ${base.copyTop} vs rest ${(base.navRest + navH).toFixed(1)}`,
);
ok(
  'document is tall enough to reach the lock point',
  base.docHeight >= stickAt + vh,
  `${base.docHeight} >= ${stickAt + vh}`,
);
// Contact is gone from the bar, and with it the only accent it carried.
ok(
  'the bar carries no Contact link any more',
  !base.hasContact,
  base.hasContact ? 'still present' : 'removed',
);
// LinkedIn and the address belong to the print until the print has gone behind
// the bar. Hidden, not merely transparent — a transparent link is still tabbable,
// and the address at the top of an unlocked page is a trap.
ok(
  'the collected pair is hidden at rest, and hidden not just transparent',
  base.pairHidden === 'hidden/0 hidden/0',
  base.pairHidden,
);
// The footer's copies are gone at this width, because the bar has them.
ok(
  'the footer sheds the pair from 768 up',
  base.footPairShown === 'none none',
  base.footPairShown,
);
ok(
  'LinkedIn points at the right profile and opens away from the page',
  base.linkedinHref === 'https://www.linkedin.com/in/clairemong/' &&
    base.linkedinTarget === '_blank',
  `${base.linkedinHref} target=${base.linkedinTarget || 'none'}`,
);
// The address copies rather than navigating, so it must be a button carrying the
// address as data — an <a href="mailto:"> would still open a mail client.
ok(
  'the address is a copy button, not a mailto',
  base.mailIsButton === 'BUTTON' && base.mailCopies === 'mclaireong@gmail.com',
  `<${base.mailIsButton.toLowerCase()}> copies "${base.mailCopies}"`,
);

// ---- fonts, the plate, and the bar's edge --------------------------------
// Three families now, each with one job: the serif sets anything read as text,
// Inter sets every small label, and the wordmark has a script face of its own.
// The mark used to be the serif in italic; that is no longer the arrangement, so
// what is asserted is that the three are distinct rather than that two match.
ok(
  'the serif is WT Kormelink TRIAL',
  /WT Kormelink TRIAL/.test(base.titleFamily),
  base.titleFamily,
);
ok(
  'the wordmark has its own script face, not the body serif',
  /La Belle Aurore/.test(base.markFamily) &&
    base.markFamily !== base.titleFamily,
  `mark ${base.markFamily}`,
);
// The mark is a script face and sets small for its size, so it is set larger to
// hold the same weight in the bar. What must not change is the bar's height —
// every scroll number on this page is derived from it — so the mark has to go on
// overflowing its row rather than growing it.
ok(
  'the enlarged wordmark does not change the height of the bar',
  near(base.navH, 37.594, 0.6),
  `navH ${base.navH} with mark at ${base.markSize}`,
);
ok(
  'labels are Inter, and no fourth family crept in',
  /^Inter/.test(base.labelFamily) &&
    !/Garamono/.test(base.markFamily + base.titleFamily),
  base.labelFamily,
);
// The grain lives in the scan now. Nothing should be layered over the plate to
// add it, and no blend mode should be left behind from when something was —
// a stray multiply over the print would darken it for no reason.
ok(
  'nothing is layered over the plate to add grain',
  base.plateOverlay === 'none' && base.plateBlend === 'normal',
  `::after content ${base.plateOverlay}, blend ${base.plateBlend}`,
);
ok(
  'the bar draws no rule beneath it, over print or paper',
  base.navShadow === 'none',
  `boxShadow ${base.navShadow}`,
);
ok(
  'the mark reads "Claire M Ong"',
  base.markText === 'Claire M Ong',
  `"${base.markText}"`,
);

// ---- the bar on the page's twelve, and the footer's five -----------------
// The bar used to run on five columns of its own with every item centred. It is
// on the page's twelve now, left-justified, so each item is on a line and
// anything below can align to it without being told where it landed.
ok(
  'the bar is the page\'s twelve columns',
  base.navColumns === 12,
  `${base.navColumns} cols`,
);
ok(
  'the bar is placed 1 / 4 / 6 / 9 / 10, justified start / end / center / start / end',
  base.navSlots.length === 5 &&
    base.navSlots[0].startsWith('1:start') &&
    base.navSlots[1].startsWith('4:end') &&
    base.navSlots[2].startsWith('6:center') &&
    base.navSlots[3].startsWith('9:start') &&
    base.navSlots[4].startsWith('10:end'),
  base.navSlots.join('  '),
);
// About is the one item off the grid's lines, and deliberately: it is centred on
// the page. Twelve columns are symmetric about the 6/7 boundary, so a span of
// those two centres on exactly half the viewport — which is the claim worth
// testing, rather than that it sits on a column.
ok(
  'About is centred on the page, not on a column',
  near(base.aboutSpanCentre, VIEWPORT.width / 2, 1),
  `span centre ${base.aboutSpanCentre} vs half of ${VIEWPORT.width}`,
);
// Justified outward means literally out to the page's margins, so the bar spans
// the full measure rather than floating inside it.
ok(
  'the bar reaches the margins on both sides',
  near(+base.navSlots[0].split(':')[2].split('-')[0], base.gridMargin, 1.5) &&
    near(
      +base.navSlots[4].split(':')[2].split('-')[1],
      VIEWPORT.width - base.gridMargin,
      1.5,
    ),
  `left ${base.navSlots[0].split(':')[2]}, right ${base.navSlots[4].split(':')[2]}, margin ${base.gridMargin}`,
);
ok(
  'the footer is the line alone from 768 up',
  base.footColumns === 5 && base.footSlots[0] === '1:start',
  `${base.footColumns} cols — ${base.footSlots.join('  ')}`,
);
// The plate swap is a cut. A transition here, or a transform that differs
// between the two states, would animate it.
ok(
  'plates carry no transition and no scale to animate',
  /^(0s)(,\s*0s)*$/.test(base.plateTransition) &&
    base.plateScales.every(([a, d]) => a === 1 && d === 1),
  `duration ${base.plateTransition}; scales ${base.plateScales.map((s) => s.join('/')).join(' ')}`,
);
// The paper is one viewport and no more — no field of white to scroll past
// below the index — and the footer sits on its floor rather than partway up.
ok(
  'the white is exactly one viewport, not a longer field',
  near(base.sheetHeight, vh + navH, 2),
  `sheet ${base.sheetHeight} vs viewport+bar ${vh + navH}`,
);
ok(
  'the footer sits on the floor of that viewport',
  near(base.footBottom - base.sheetTop, base.sheetHeight, 2),
  `foot bottom ${base.footBottom - base.sheetTop} of ${base.sheetHeight}`,
);
// The nav hover rule is an underline on the word, not a bar that can sweep.
ok(
  'no ::after bar is left on the nav links',
  base.linkAfterContent === 'none',
  `content ${base.linkAfterContent}`,
);
ok(
  'nav links are not underlined at rest',
  base.linkWordDecoration === 'none',
  base.linkWordDecoration,
);
await shoot('01-landing');

// Real hover, over CDP, so the :hover rule is genuinely exercised rather than
// inferred from the stylesheet.
const hoverUnderline = await (async () => {
  const box = await evaluate(`(() => {
    const el = document.querySelector('.nav__link--projects .nav__link-word');
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
             w: +b.width.toFixed(1) };
  })()`);
  await call('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x,
    y: box.y,
  });
  await sleep(120);
  return {
    ...box,
    ...(await evaluate(`(() => {
      const word = document.querySelector('.nav__link--projects .nav__link-word');
      const link = document.querySelector('.nav__link--projects');
      return {
        decoration: getComputedStyle(word).textDecorationLine,
        // The underline must be the width of the word, not of the padded <a>.
        wordWidth: +word.getBoundingClientRect().width.toFixed(1),
        linkWidth: +link.getBoundingClientRect().width.toFixed(1),
        transition: getComputedStyle(word).transitionDuration,
      };
    })()`)),
  };
})();
ok(
  'hovering a nav link underlines just that word, instantly',
  hoverUnderline.decoration === 'underline' &&
    /^(0s)(,\s*0s)*$/.test(hoverUnderline.transition),
  `${hoverUnderline.decoration}, duration ${hoverUnderline.transition}`,
);
// The links no longer carry padding — they are centred in their columns, so the
// box hugs its text. What is left to assert is that the underline stops short of
// the trailing comma, which is what the wrapping span is for.
ok(
  'the underline covers the word but not the trailing comma',
  hoverUnderline.wordWidth < hoverUnderline.linkWidth - 1,
  `word ${hoverUnderline.wordWidth} vs whole link ${hoverUnderline.linkWidth}`,
);
await shoot('01b-hover-nav');
// Park the cursor off the bar again so it cannot colour later readings.
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });

// ---- phase 1: copy exits, nothing else moves ----------------------------
const mid1 = await probeAt(Math.round(t1 / 2));
ok(
  'phase 1 holds the plate still',
  near(mid1.stageTop, 0) && near(mid1.stageHeight, vh, 2),
  `stageTop ${mid1.stageTop}, height ${mid1.stageHeight}`,
);
ok(
  'phase 1 holds the nav still',
  near(mid1.navTop, base.navRest, 2),
  `navTop ${mid1.navTop} vs rest ${base.navRest}`,
);
// Half way through phase 1 the copy should be half way up, not wiped in place.
ok(
  'phase 1 carries the copy up the page, proportionally',
  near(mid1.copyTop, base.copyTop - mid1.p1 * base.aboutRise, 3),
  `copyTop ${base.copyTop} -> ${mid1.copyTop} at p1 ${mid1.p1}`,
);
ok(
  'copy holds full opacity while it travels',
  mid1.copyOpacity === 1,
  `opacity ${mid1.copyOpacity}`,
);
ok(
  'phase 1 keeps the paper below the fold',
  mid1.sheetTop >= vh - 1,
  `sheetTop ${mid1.sheetTop}`,
);
await shoot('02-phase1-mid');

const endP1 = await probeAt(t1);
// The whole point of extending the travel: nothing may start scrolling until
// the copy's last line has cleared the fold, so its bottom edge must be at or
// above y=0 at the exact frame phase 2 begins.
ok(
  'copy is completely off screen when phase 1 ends',
  Number(endP1.p1) === 1 && endP1.copyBottom <= 0.5,
  `p1 ${endP1.p1}, copy bottom ${endP1.copyBottom}`,
);
ok(
  'copy never dims on the way out',
  endP1.copyOpacity === 1,
  `opacity ${endP1.copyOpacity}`,
);
// And nothing has moved yet at that frame — the two checks below re-assert the
// plate and the bar are still at rest, which is what makes the ordering real.
ok(
  'plate has still not moved at the end of phase 1',
  near(endP1.stageTop, 0),
  `stageTop ${endP1.stageTop}`,
);
ok(
  'nav has still not moved at the end of phase 1',
  near(endP1.navTop, base.navRest, 2),
  `navTop ${endP1.navTop} vs rest ${base.navRest}`,
);
ok(
  'nav is still light at the end of phase 1',
  !endP1.overPaper && isWhite(endP1.navColor),
  endP1.navColor,
);
await shoot('03-phase1-end');

// ---- phase 2: the paper comes up over a pinned print --------------------
const mid2 = await probeAt(t1 + Math.round(t2 / 2));
// The print travels with the scroll — it slides away rather than being wiped in
// place — and it moves 1:1 with the distance scrolled past T1.
const travelled = mid2.scrollY - t1;
ok(
  'phase 2 moves the print with the scroll, 1:1',
  near(mid2.plateTop, -travelled, 1.5) &&
    near(mid2.plateBottom, vh - travelled, 1.5),
  `print ${mid2.plateTop}..${mid2.plateBottom} after ${travelled}px of scroll`,
);
// The paper is flush against the print's lower edge — never a gap, never an
// overlap — because both move at scroll speed.
ok(
  'the paper edge stays flush with the print, all the way up',
  near(mid2.sheetTop, mid2.stageBottom, 1.5),
  `paper ${mid2.sheetTop} vs print's lower edge ${mid2.stageBottom}`,
);
ok(
  'phase 2 raises the nav',
  mid2.navTop < base.navRest - 1,
  `navTop ${mid2.navTop}`,
);
// The bar covers navRest over the same window in which the paper covers T2, so
// its position has to track the paper's edge and not a scroll offset of its own.
ok(
  'nav tracks the paper coming up, at half its rate',
  near(mid2.navY, base.navRest * (1 - (mid2.scrollY - t1) / t2), 2),
  `navY ${mid2.navY} vs expected ${(base.navRest * (1 - (mid2.scrollY - t1) / t2)).toFixed(1)}`,
);
ok(
  'nav is still light mid-phase 2',
  !mid2.overPaper && isWhite(mid2.navColor),
  mid2.navColor,
);
await shoot('04-phase2-mid');

// ---- the lock frame ------------------------------------------------------
const lock = await probeAt(stickAt);
ok(
  'nav reaches the top exactly at the lock point',
  near(lock.navTop, 0),
  `navTop ${lock.navTop}`,
);
ok(
  'paper edge arrives flush under the locked nav',
  near(lock.sheetTop, navH, 2),
  `sheetTop ${lock.sheetTop} vs navH ${navH}`,
);
// At the lock the print has travelled up by exactly T2, so the only part of it
// left in frame is the strip behind the bar.
ok(
  'the print has travelled T2 by the lock, leaving the strip behind the bar',
  near(lock.stageBottom, navH, 2) && near(lock.plateTop, -t2, 2),
  `print top ${lock.plateTop} vs -T2 ${-t2}, lower edge ${lock.stageBottom} vs navH ${navH}`,
);
ok(
  'nav is transparent over the print, before the lock',
  isTransparent(base.navBg),
  base.navBg,
);
await shoot('05-lock');

// Half way through phase 2 the bar must still be fully white — the check that
// would catch a scroll-linked blend coming back.
const crossing = await probeAt(t1 + Math.round(t2 / 2), 500);
ok(
  'type does not blend on the way up — still pure white half way',
  isWhite(crossing.navColor) && !crossing.overPaper,
  crossing.navColor,
);
ok(
  'bar takes no background before the lock, so the print is not clipped',
  !crossing.overPaper && isTransparent(crossing.navBg),
  crossing.navBg,
);

// The bar turns on the lock frame itself, which is the frame the paper's edge
// reaches its underside.
const flipped = await probeAt(stickAt, 500);
ok(
  'nav type turns graphite once the paper is behind the bar',
  flipped.overPaper,
  `paperTop ${flipped.sheetTop}, navY ${flipped.navY}`,
);
ok('graphite is #404040', isGraphite(flipped.navColor), flipped.navColor);
// The pair arrives with the lock. This is the whole of "collects into the bar":
// hidden while the print is on screen, shown once the print is behind it.
ok(
  'the collected pair arrives as the bar locks',
  flipped.pairHidden === 'visible/1 visible/1',
  `${base.pairHidden} at rest -> ${flipped.pairHidden} locked`,
);
ok(
  'locked bar takes the paper background',
  !isTransparent(flipped.navBg),
  flipped.navBg,
);
// The trigger is a threshold, not a ramp: two scroll pixels earlier the bar is
// still fully white. This is what separates "eased once it fires" from "colour
// interpolated against scroll position", which is what was taken out.
const oneEarlier = await probeAt(stickAt - 3, 500);
ok(
  'the change fires at the threshold, not before it',
  isWhite(oneEarlier.navColor) && !oneEarlier.overPaper,
  `${oneEarlier.navColor} -> ${flipped.navColor}`,
);
// The colour is eased over 250ms once the threshold fires. That is a different
// thing from interpolating it against scroll position — the check above, which
// requires pure white two pixels earlier, is what holds those apart.
ok(
  'the bar eases the colour over 250ms, on the reference easing',
  flipped.navTransition.startsWith('0.25s') &&
    /cubic-bezier\(0\.37,\s*0,\s*0\.63,\s*1\)/.test(flipped.navEasing) &&
    /(^|[\s,])color([\s,]|$)/.test(flipped.navTransitionProperty),
  `${flipped.navTransitionProperty} ${flipped.navTransition} ${flipped.navEasing}`,
);
await shoot('05b-flip');

// The white-rule invariant, and the reason the flip sits exactly at the lock.
//
// If the paper's leading edge is ever strictly inside the bar's band while the
// bar is still transparent, a bright edge is drawn across the bar's underside
// and reads as an underline. Sweep phase 2 and the frames either side of the
// lock and assert that never happens: at every step the edge is either below the
// bar entirely, or the bar has already taken its own background.
const sweep = [];
for (
  let s = t1;
  s <= stickAt + navH * 2;
  s += Math.max(4, Math.round(navH / 6))
) {
  const f = await probeAt(s);
  const barBottom = f.navY + navH;
  const edgeInsideBar =
    f.sheetTop < barBottom - 0.5 && f.sheetTop > f.navY + 0.5;
  if (edgeInsideBar && !f.overPaper) {
    sweep.push(
      `y${f.scrollY}: edge ${f.sheetTop} inside bar ${f.navY}..${barBottom.toFixed(1)}`,
    );
  }
}
ok(
  'the paper edge never sits inside a transparent bar — no white rule under it',
  sweep.length === 0,
  sweep.length
    ? sweep.slice(0, 3).join('; ')
    : 'clean across phase 2 and the lock',
);

// ---- phase 3: ordinary scrolling ----------------------------------------
const after = await probeAt(stickAt + 600, 500);
ok(
  'nav stays locked after the lock point',
  near(after.navTop, 0),
  `navTop ${after.navTop}`,
);
ok('nav stays graphite after the lock point', after.overPaper, after.navColor);
// Not measured against a fixed distance any more: with the paper exactly one
// viewport there is only navH-and-change of scroll left past the lock, by
// design. The claim is that it keeps moving and ends up clear of the fold.
ok(
  'paper scrolls on beneath the locked bar, and clears the fold',
  after.sheetTop < lock.sheetTop && after.sheetTop <= 0,
  `sheetTop ${lock.sheetTop} -> ${after.sheetTop}`,
);
await shoot('06-phase3');

// The choreography has to be able to *finish*: if the paper is shorter than a
// viewport, max scroll still leaves the print uncovered, the bar never earns
// its background, and the print's correspondence line reads through it.
const bottom = await probeAt(base.docHeight, 500);
ok(
  'paper covers the print at max scroll',
  bottom.sheetTop <= 0,
  `sheetTop ${bottom.sheetTop} at scrollY ${bottom.scrollY}`,
);
ok(
  'bar is over paper at max scroll',
  bottom.overPaper && !isTransparent(bottom.navBg),
  `bg ${bottom.navBg}`,
);

// ---- the plates ----------------------------------------------------------
// Each plate keeps the leaf box its own Figma variant was drawn at, so none is
// stretched to a shared frame. Both dimensions are asserted, since a single
// correct axis would pass under a stretched aspect ratio.
const wrongBox = after.plates.filter(
  (p) => !near(p.w, p.wantW, 1) || !near(p.h, p.wantH, 1),
);
ok(
  `all ${after.plates.length} plates render at their designed leaf box`,
  wrongBox.length === 0,
  wrongBox.length
    ? wrongBox
        .map((p) => `${p.id} ${p.w}x${p.h} want ${p.wantW}x${p.wantH}`)
        .join('; ')
    : after.plates.map((p) => `${p.w}x${p.h}`).join(' '),
);

// Every plate is generated at 2x its leaf box, so none of them is ever
// upscaled into the frame it was drawn for.
const thin = after.plates.filter((p) => {
  const [w, h] = p.natural.split('x').map(Number);
  return w < p.wantW * 2 - 2 || h < p.wantH * 2 - 2;
});
ok(
  'no plate is upscaled into its frame',
  thin.length === 0,
  thin.length
    ? thin
        .map((p) => `${p.id} ${p.natural} for ${p.wantW}x${p.wantH}`)
        .join('; ')
    : after.plates.map((p) => p.natural).join(' '),
);
ok(
  'plates are centred on the row block, not the section',
  near(after.viewerCentreY, after.indexCentreY, 1.5),
  `viewer ${after.viewerCentreY} vs index ${after.indexCentreY}`,
);

// ---- the resting state ---------------------------------------------------
// One project is always showing, and on landing it is the top row. This is
// checked from `base`, i.e. before anything has been hovered.
ok(
  'a plate is showing before any interaction, and it is the top project',
  base.litPlate === 'confidence-underneath' && base.litCount === 1,
  `lit ${base.litPlate} (${base.litCount})`,
);
ok(
  'the undimmed row is that same project, and only it',
  base.currentRow === base.litPlate && base.currentRowCount === 1,
  `row ${base.currentRow} (${base.currentRowCount}) vs plate ${base.litPlate}`,
);

// ---- hover swap ----------------------------------------------------------
const hover = await evaluate(`(() => {
  const rows = [...document.querySelectorAll('[data-project]')];
  const seen = [];
  for (const row of rows) {
    row.dispatchEvent(new PointerEvent('pointerenter', {bubbles:true, pointerType:'mouse'}));
    seen.push({
      want: row.dataset.project,
      got: document.querySelector('.viewer__plate.is-active')?.dataset.plate,
      row: document.querySelector('.index__row.is-current')?.dataset.project,
      lit: document.querySelectorAll('.viewer__plate.is-active').length,
      cur: document.querySelectorAll('.index__row.is-current').length,
    });
  }
  return seen;
})()`);
ok(
  `hover swaps the plate for all ${hover.length} projects`,
  hover.every((h) => h.want === h.got),
  hover.map((h) => `${h.want}->${h.got}`).join(' '),
);
// The lit plate and the undimmed row are one fact; they must never disagree.
ok(
  'the undimmed row tracks the plate through the whole walk',
  hover.every((h) => h.row === h.got && h.cur === 1),
  hover.map((h) => `${h.row}/${h.got}`).join(' '),
);
// Exactly one plate may be lit, or two images stack on top of each other.
ok(
  'exactly one plate is lit at every step of the walk',
  hover.every((h) => h.lit === 1),
  hover.map((h) => h.lit).join(''),
);

// Leaving the list keeps the last plate rather than clearing: something is
// always up, so there is nothing to fall back to.
const onLeave = await evaluate(`(() => {
  const index = document.querySelector('[data-index]');
  index.dispatchEvent(new PointerEvent('pointerleave', {bubbles:false, pointerType:'mouse'}));
  return {
    lit: document.querySelectorAll('.viewer__plate.is-active').length,
    id: document.querySelector('.viewer__plate.is-active')?.dataset.plate,
    row: document.querySelector('.index__row.is-current')?.dataset.project,
  };
})()`);
ok(
  'a plate is still up after the cursor leaves the list',
  onLeave.lit === 1 && onLeave.id === onLeave.row,
  `lit ${onLeave.id} (${onLeave.lit}), row ${onLeave.row}`,
);

// Scrolling with the cursor held still. The browser fires no pointer event for
// this — the rows move, the pointer does not — so without the scroll hit-test
// the plate would sit on whatever row happened to be under the cursor when it
// last moved. Park a real cursor on the first row, scroll a couple of rows'
// worth, and the plate must have followed.
const onScroll = await (async () => {
  // Centre the list first so there are rows above and below the cursor.
  await evaluate(`new Promise(r => {
    const v = document.querySelector('[data-viewer]').getBoundingClientRect();
    scrollTo({top: Math.round(scrollY + v.top + v.height/2 - innerHeight/2), behavior:'instant'});
    requestAnimationFrame(() => requestAnimationFrame(r));
  })`);
  // Park on a row low in the list and scroll *up*: the index sits at the end of
  // a one-viewport paper, so there is no room to scroll down two rows, and a
  // scrollBy that goes nowhere would make this pass vacuously.
  const spot = await evaluate(`(() => {
    const row = document.querySelector('[data-project="trending-this-week"]');
    const b = row.getBoundingClientRect();
    // Left of the plate, so the hit-test lands on the row and not on an image.
    return { x: 120, y: Math.round(b.top + b.height / 2), rowH: +b.height.toFixed(1) };
  })()`);
  await call('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: spot.x,
    y: spot.y,
  });
  await sleep(150);
  const before = await evaluate(`({
    lit: document.querySelector('.viewer__plate.is-active')?.dataset.plate,
    y: Math.round(scrollY),
  })`);
  // Scroll two rows without moving the mouse at all.
  await evaluate(
    `new Promise(r => { scrollBy({top: ${-Math.round(spot.rowH * 2)}, behavior:'instant'});
      requestAnimationFrame(() => requestAnimationFrame(r)); })`,
  );
  await sleep(200);
  const after = await evaluate(`(() => {
    const el = document.elementFromPoint(${spot.x}, ${spot.y});
    return {
      lit: document.querySelector('.viewer__plate.is-active')?.dataset.plate,
      under: el?.closest?.('[data-project]')?.dataset.project ?? null,
      row: document.querySelector('.index__row.is-current')?.dataset.project,
      y: Math.round(scrollY),
    };
  })()`);
  return {
    before: before.lit,
    movedBy: Math.abs(after.y - before.y),
    ...after,
  };
})();
ok(
  'scrolling under a stationary cursor changes the project',
  onScroll.movedBy > 20 &&
    onScroll.under !== null &&
    onScroll.lit === onScroll.under &&
    onScroll.lit !== onScroll.before &&
    onScroll.row === onScroll.lit,
  `${onScroll.before} -> ${onScroll.lit} over ${onScroll.movedBy}px of scroll, cursor on ${onScroll.under}`,
);

// Park on a middle row and shoot, so the swap is confirmed as rendered pixels
// and not just class bookkeeping. Centre the plate in frame first — it stands
// 606 units tall and overhangs the row block at both ends.
await evaluate(`new Promise(r => {
  const v = document.querySelector('[data-viewer]').getBoundingClientRect();
  scrollTo({top: Math.round(scrollY + v.top + v.height / 2 - innerHeight / 2), behavior: 'instant'});
  requestAnimationFrame(() => requestAnimationFrame(r));
})`);
await evaluate(`document.querySelector('[data-project="studio-edit-02"]')
  .dispatchEvent(new PointerEvent('pointerenter', {bubbles:true, pointerType:'mouse'}))`);
// One frame is enough now that the swap is a cut, but shoot a little later than
// that so the screenshot would still catch a transition if one came back.
await sleep(300);
await shoot('08-hover-studio-edit-02');

// ---- narrow viewport -----------------------------------------------------
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(`new Promise(r => { dispatchEvent(new Event('resize'));
  requestAnimationFrame(() => requestAnimationFrame(r)); })`);
const narrow = await probeAt(0);
ok(
  'plate fills a narrow viewport too',
  near(narrow.stageWidth, 390) && near(narrow.stageHeight, narrow.vh),
  `${narrow.stageWidth}x${narrow.stageHeight}`,
);
ok(
  'nav rests centred on narrow too',
  near(narrow.navTop, narrow.navRest, 2),
  `navTop ${narrow.navTop} vs rest ${narrow.navRest}`,
);
// scrollWidth alone is not enough: body carries `overflow-x: hidden`, so
// anything running past the right edge is clipped and reports zero overflow. It
// hid a real one. Walk the leaf elements and compare their own right edges to
// the viewport.
const OVERFLOW_PROBE = `(() => {
  const w = document.documentElement.clientWidth;
  const worst = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length) continue;            // leaves carry the text
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) continue;
    if (b.right > w + 0.5 || b.left < -0.5) {
      worst.push(
        (el.className || el.tagName) + ' ' + b.left.toFixed(0) + '..' + b.right.toFixed(0),
      );
    }
  }
  return { w, worst, scroll: document.documentElement.scrollWidth - w };
})()`;
const overflow = await evaluate(OVERFLOW_PROBE);
ok(
  'nothing runs past either edge on narrow, clipped or not',
  overflow.worst.length === 0 && overflow.scroll <= 0,
  overflow.worst.length
    ? `viewport ${overflow.w}: ${overflow.worst.slice(0, 4).join('; ')}`
    : `viewport ${overflow.w}, scrollWidth delta ${overflow.scroll}`,
);
// One row on narrow: two words and three links fit. The bar may wrap if the
// mark ever grows, but it must not be wrapping now — and it must never stack
// into a link-per-row, which is what the upper bound catches.
ok(
  'nav stays a single row on narrow',
  narrow.navHeight <= 48,
  `navHeight ${narrow.navHeight}`,
);
await shoot('07-narrow');

// The index and the footer are the two blocks with no mobile frame to copy, so
// they get their own shot rather than being taken on trust.
const narrowBottom = await probeAt(narrow.docHeight, 500);
const narrowFoot = await evaluate(OVERFLOW_PROBE);
ok(
  'nothing runs past either edge at the foot of the narrow page',
  narrowFoot.worst.length === 0 && narrowFoot.scroll <= 0,
  narrowFoot.worst.length
    ? narrowFoot.worst.slice(0, 4).join('; ')
    : `clean at viewport ${narrowFoot.w}`,
);
ok(
  'paper covers the print at max scroll on narrow too',
  narrowBottom.sheetTop <= 0 && narrowBottom.overPaper,
  `sheetTop ${narrowBottom.sheetTop}, overPaper ${narrowBottom.overPaper}`,
);
await shoot('09-narrow-index');

// ---- report --------------------------------------------------------------
console.log(
  `\nviewport ${VIEWPORT.width}x${VIEWPORT.height} | vh ${vh} navH ${navH} ` +
    `T1 ${t1} T2 ${t2} lock@${stickAt} doc ${base.docHeight}\n`,
);
for (const c of checks) {
  console.log(
    `${c.pass ? ' ok ' : 'FAIL'}  ${c.label}${c.detail ? `  — ${c.detail}` : ''}`,
  );
}
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);

await call('Page.close').catch(() => {});
ws.close();
chrome.kill();
process.exit(failed ? 1 : 0);
