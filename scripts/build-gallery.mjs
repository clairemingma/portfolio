// Writes the repetitive half of a project page's deck into its HTML: one <img>
// per slide, the counter's seed, and the preload hint for the first frame.
//
// The slides stay in the markup rather than being built by JS at runtime, so the
// page is a readable deck without script. But seventeen hand-kept copies of the
// same eight lines is how a deck ends up pointing at a file that has been
// renamed or removed, so the copies are generated from what the image build
// actually emitted and pasted between markers. Everything outside the markers is
// hand-written and left alone.
//
// Run after `npm run images`, which writes the manifest this reads.
// Usage: node scripts/build-gallery.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const PAGES = [
  {
    manifest: 'scripts/.manifests/confidence-underneath.json',
    html: 'projects/confidence-underneath/index.html',
    title: 'Confidence Underneath',
  },
  {
    manifest: 'scripts/.manifests/mfw-color-trends.json',
    html: 'projects/mfw-color-trends/index.html',
    title: 'MFW Color Trends',
  },
];

// The still pages that show video. Same job as PAGES — keep the markup's
// elements identical to what the image build delivered — and a different block to
// write, so it is its own list rather than a flag on that one.
const CLIPS = [
  {
    manifest: 'scripts/.manifests/studio-edit-02.clips.json',
    html: 'projects/studio-edit-02/index.html',
    // The accessible name. It has to say what the thing IS rather than describe
    // motion nobody can caption, and each slot gets its own — the two are
    // different takes, and two elements with one name read as a duplicate.
    // aria-label rather than alt: a <video> has no alt.
    labels: {
      1: 'Studio Edit 02 — a NikeSKIMS mat sequence, playing silently on a loop.',
      2: 'Studio Edit 02 — a NikeSKIMS reformer sequence, playing silently on a loop.',
    },
    // The poster comes from the manifest, per slot, because the two takes are in
    // different rooms and one still cannot stand for both. See VIDEOS in
    // scripts/build-images.mjs.
  },
];

// The still pages' plates: one box, N frames stacked in it, cycled by
// src/plate-cycle.js. Same job again, and a third block to write.
const PLATES = [
  {
    manifest: 'scripts/.manifests/trending-this-week.json',
    html: 'projects/trending-this-week/index.html',
    // The accessible name of the link the frames sit in. It goes on the FIRST
    // frame's alt and nowhere else, and the rest are empty-alt and aria-hidden:
    // the name of that link must not depend on which of nine photographs happens
    // to be showing when someone reaches it.
    alt: 'The 4 fastest rising trends in fashion — the post on Instagram.',
  },
];

// The reels: a project page read downward, one frame per screen. Same job as the
// two lists above — keep the markup's elements identical to what the image build
// delivered — and a fourth block to write, because a reel frame carries a size
// the others do not.
//
// Each <img> is written with a --shot-h, the height in design units that the
// design draws that frame at. It comes from the reel manifest rather than from
// this file, because it is the image build that knows it: the same number sizes
// the delivered file. The page's CSS caps it against the window and takes the
// width from the picture — see src/reel-page.css.
//
// `link` is optional and wraps every frame of that reel in an anchor. It is per
// reel rather than per frame because a reel's frames are one piece of work seen
// from more than one angle — here the marketplace page on a desktop and the same
// page on a phone — so there is one honest destination and both frames carry it.
//
// Only a reel whose work is a LIVE PLACE gets one. Eight Immortals has none: its
// frames are a dieline and two photographs of a physical box, and there is
// nowhere for them to go. Shop Every Store's frames are pictures of a page that
// exists, and a picture of a page you cannot click is a small lie about what it
// is — the brief already links it, and the visual is the more obvious target.
//
// `label` names the DESTINATION rather than the picture, because that is what a
// link's accessible name is for; it is written onto the anchor and so is what a
// screen reader announces in place of the frame's alt. The alt stays on the <img>
// underneath it, where it still does its own job if the picture fails to load.
const REELS = [
  {
    manifest: 'scripts/.manifests/eight-immortals.reel.json',
    html: 'projects/eight-immortals/index.html',
    title: 'Eight Immortals',
  },
  {
    manifest: 'scripts/.manifests/shop-every-store.reel.json',
    html: 'projects/shop-every-store/index.html',
    title: 'Shop Every Store',
    link: { href: 'https://phia.com/shop', label: 'Shop, on phia.com' },
  },
];

// Replaces everything between `<!-- name:start -->` and `<!-- name:end -->`,
// keeping the markers. Throws rather than appending if a marker is missing: a
// silent no-op here looks exactly like a page that did not need regenerating.
// The indent is where the closing marker sits in the deck's markup.
function splice(html, name, body, indent = 8) {
  const re = new RegExp(
    `(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`,
  );
  if (!re.test(html)) throw new Error(`marker "${name}" not found`);
  return html.replace(re, `$1\n${body}\n${' '.repeat(indent)}$2`);
}

let touched = 0;

for (const page of PAGES) {
  // A page can be absent on purpose: held out of the repository, and so out of
  // the deploy. Skipped rather than thrown on, because the alternative is that
  // every build everywhere fails over a page nobody asked for.
  if (!existsSync(page.html) || !existsSync(page.manifest)) {
    console.log(`${page.html}: not in this checkout, skipped`);
    continue;
  }
  const { slug, frames } = JSON.parse(await readFile(page.manifest, 'utf8'));
  const dir = `/img/projects/${slug}`;
  const first = frames[0];

  // The alt text is a position, not a description: these are deck slides whose
  // content is the artwork, and a real description has to be written per slide by
  // someone who can see it. Stated plainly so it is obviously a placeholder.
  //
  // Every slide carries a real `src` and is deferred by the browser rather than
  // by JS — they are siblings on a track, so an off-track slide really is off
  // screen and `loading="lazy"` means what it says. The first is eager and high
  // priority: it is beside the brief in the opening frame, and it is the one the
  // preload hint below names. project-deck.js promotes the rest to eager once the
  // page is idle, so a scrub never lands on a blank.
  const slides = frames
    .map((name, i) =>
      [
        `        <img`,
        `          class="deck__slide"`,
        `          data-slide`,
        `          src="${dir}/${name}.webp"`,
        `          alt="${page.title} — slide ${i + 1} of ${frames.length}."`,
        i === 0 ? `          fetchpriority="high"` : `          loading="lazy"`,
        `          decoding="async"`,
        `        />`,
      ].join('\n'),
    )
    .join('\n');

  let html = await readFile(page.html, 'utf8');
  html = splice(html, 'slides', slides);

  // The counter's seed. JS overwrites it on mount, but the markup has to be
  // right on its own — it is what shows before the module runs, and if it never
  // runs it is what shows for good.
  // Matched on data-count rather than the class, so the hook is the behaviour
  // rather than the styling.
  html = html.replace(
    /(<p class="[^"]*" data-count aria-live="polite">)\[[^\]]*\]/,
    `$1[1/${frames.length}]`,
  );

  // The one frame worth preloading is the one the markup lights.
  html = html.replace(
    /(<link\s+rel="preload"\s+as="image"\s+href=")[^"]*(")/,
    `$1${dir}/${first}.webp$2`,
  );

  await writeFile(page.html, html);
  console.log(
    `${page.html}: ${frames.length} slides (${first}..${frames.at(-1)})`,
  );
  touched++;
}

for (const plate of PLATES) {
  if (!existsSync(plate.html) || !existsSync(plate.manifest)) {
    console.log(`${plate.html}: not in this checkout, skipped`);
    continue;
  }
  const { slug, frames } = JSON.parse(await readFile(plate.manifest, 'utf8'));
  const dir = `/img/projects/${slug}`;
  const first = frames[0];

  // The first frame is the one the markup shows, so it is eager, high priority
  // and the one the preload hint below names. The rest are NOT lazy: they are
  // absolutely positioned on top of it and so are inside the viewport from the
  // first frame, which means `loading="lazy"` would fetch them all immediately
  // anyway — and if it did not, the cycle's first cut would land on a blank.
  // They are left to the browser's own priority instead, which puts them after
  // the visible one without deferring them past it.
  //
  // Indented two deeper than the decks, and the closing marker with it: the plate
  // sits inside the composition group on the stage rather than directly in the
  // page. See .post in src/trending-this-week.css.
  const imgs = frames
    .map((name, i) =>
      [
        `            <img`,
        `              class="plate__frame${i === 0 ? ' is-current' : ''}"`,
        `              data-frame`,
        `              src="${dir}/${name}.webp"`,
        i === 0
          ? `              alt="${plate.alt}"`
          : `              alt=""\n              aria-hidden="true"`,
        ...(i === 0 ? [`              fetchpriority="high"`] : []),
        `              decoding="async"`,
        `            />`,
      ].join('\n'),
    )
    .join('\n');

  let html = await readFile(plate.html, 'utf8');
  html = splice(html, 'frames', imgs, 12);

  html = html.replace(
    /(<link\s+rel="preload"\s+as="image"\s+href=")[^"]*(")/,
    `$1${dir}/${first}.webp$2`,
  );

  await writeFile(plate.html, html);
  console.log(
    `${plate.html}: ${frames.length} frames (${first}..${frames.at(-1)})`,
  );
  touched++;
}

for (const page of CLIPS) {
  if (!existsSync(page.html) || !existsSync(page.manifest)) {
    console.log(`${page.html}: not in this checkout, skipped`);
    continue;
  }
  const { clips } = JSON.parse(await readFile(page.manifest, 'utf8'));

  // autoplay, muted, loop, playsinline — in that order and all four in the
  // markup, because this is the only place they count. Every browser gates
  // autoplay on the element being MUTED at the moment it decides, which is before
  // any script runs; without playsinline, iOS takes the clip fullscreen instead
  // of playing it in place. src/video-autoplay.js handles only what the markup
  // cannot express.
  //
  // preload="auto" against the site's usual restraint, and for a reason: these
  // play on arrival, so there is no later moment at which to fetch them. The
  // landing page's one moving preview is preload="none" precisely because it
  // waits for a hover that may never come.
  //
  // No `controls`. The clips are artwork on a page, not media someone came to
  // watch, and they are silent — a control bar would be chrome over a photograph.
  //
  // Indented two deeper than the other blocks, and the closing marker with it:
  // the clips sit inside the composition group on the stage rather than directly
  // in the page. See .clips in src/studio-edit-02.css.
  const videos = clips
    .map((clip) =>
      [
        `          <video`,
        `            class="clip clip--${clip.slot}"`,
        `            data-autoplay`,
        `            src="/video/${clip.name}.mp4"`,
        ...(clip.poster ? [`            poster="${clip.poster}"`] : []),
        `            aria-label="${page.labels[clip.slot]}"`,
        `            autoplay`,
        `            muted`,
        `            loop`,
        `            playsinline`,
        `            preload="auto"`,
        `          ></video>`,
      ].join('\n'),
    )
    .join('\n');

  let html = await readFile(page.html, 'utf8');
  html = splice(html, 'clips', videos, 10);

  await writeFile(page.html, html);
  console.log(
    `${page.html}: ${clips.length} clip${clips.length === 1 ? '' : 's'}` +
      ` (slots ${clips.map((c) => c.slot).join(', ')})`,
  );
  touched++;
}

// --- the reels ---------------------------------------------------------------
for (const reel of REELS) {
  if (!existsSync(reel.html) || !existsSync(reel.manifest)) {
    console.log(`${reel.html}: not in this checkout, skipped`);
    continue;
  }
  const { slug, frames } = JSON.parse(await readFile(reel.manifest, 'utf8'));
  const dir = `/img/projects/${slug}`;
  const first = frames[0];

  // The alt text is a position, not a description — same placeholder rule the
  // decks follow, and stated plainly so it is obviously one. A real description
  // has to be written per frame by someone who can see it.
  //
  // Only the first is eager: the rest are a whole screen apart down the page, so
  // `loading="lazy"` means exactly what it says here. That is the opposite of the
  // plate's stack, where every frame is in the viewport from the start.
  // The SCREEN is generated with the frame inside it, not just the picture. One
  // screen per frame is the layout — a viewport tall, the frame centred, a snap
  // stop — so a frame without its screen would be a frame without a place to be,
  // and the wrapper is not something the markup can keep a fixed number of.
  //
  // The anchor, when the reel declares one, goes INSIDE the screen and around the
  // picture rather than on the screen itself. The screen is a viewport tall and
  // almost all of it is background; making that whole band clickable would mean a
  // click on empty charcoal navigates away, which is not what a link on a picture
  // should mean. See .reel__link in src/reel-page.css for the one thing this
  // wrapper costs the layout.
  const pad = reel.link ? '  ' : '';
  const imgs = frames
    .map((frame, i) =>
      [
        `        <div class="reel__screen">`,
        ...(reel.link
          ? [
              `          <a`,
              `            class="reel__link"`,
              `            href="${reel.link.href}"`,
              `            target="_blank"`,
              `            rel="noopener"`,
              `            aria-label="${reel.link.label}"`,
              `          >`,
            ]
          : []),
        `${pad}          <img`,
        `${pad}            class="reel__shot"`,
        `${pad}            style="--shot-h: ${frame.h}"`,
        `${pad}            src="${dir}/${frame.name}.webp"`,
        `${pad}            alt="${reel.title} — frame ${i + 1} of ${frames.length}."`,
        i === 0
          ? `${pad}            fetchpriority="high"`
          : `${pad}            loading="lazy"`,
        `${pad}            decoding="async"`,
        `${pad}          />`,
        ...(reel.link ? [`          </a>`] : []),
        `        </div>`,
      ].join('\n'),
    )
    .join('\n');

  let html = await readFile(reel.html, 'utf8');
  html = splice(html, 'shots', imgs, 8);

  html = html.replace(
    /(<link\s+rel="preload"\s+as="image"\s+href=")[^"]*(")/,
    `$1${dir}/${first.name}.webp$2`,
  );

  await writeFile(reel.html, html);
  console.log(
    `${reel.html}: ${frames.length} frames (${first.name}..${frames.at(-1).name})`,
  );
  touched++;
}

console.log(`wrote ${touched} page${touched === 1 ? '' : 's'}`);
