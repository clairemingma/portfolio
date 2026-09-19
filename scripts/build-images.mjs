// Derives the hero plate and the project preview plates from the sources in
// assets/. Everything here is generated — public/img is disposable.
//
// The hero scan is square, so both widths stay square and CSS crops it with
// object-fit. Each project preview is rendered at exactly 2x the leaf size the
// Figma design gives it, so no preview is ever upscaled and none carries pixels
// the layout will not show.
//
// HOW assets/ IS LAID OUT. One folder per project, named for the SLUG — the same
// slug the page directory, the delivered files and the markup all use — so a
// source can be traced to the page it feeds without consulting this file:
//
//   assets/projects/<slug>/preview.png   the landing page's preview plate
//   assets/projects/<slug>/slides/       a deck's slides, numbered
//   assets/projects/<slug>/frames/       a reel's or a plate's frames, numbered
//   assets/projects/studio-edit-02/clip-<slot>.mp4   and poster-2.png
//
// The folders used to be named for the Figma frame or the Instagram caption they
// arrived under — "4 fastest rising trends", "Dexcom x SKIMS Confidence
// Underneath", "Movement in motion 🖤 @skims …". Those names carried real
// provenance, but nothing else in the project uses them, so every path in this
// file was a lookup table between a caption and a slug.
//
// THE NUMBERED SEQUENCE IS IN A SUBFOLDER AND HAS TO BE. listFrames() below
// takes a whole directory, filters by extension and sorts by parseInt, so a
// preview.png sitting beside 1.webp would be swept in as a frame whose number is
// NaN. slides/ and frames/ keep the sequence in a box of its own; the difference
// between the two words is the site's own — a deck has slides, a reel and a plate
// have frames — and nothing here reads the name, so it costs only accuracy.
import sharp from 'sharp';
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';

const OUT = 'public/img';
const VIDEO_OUT = 'public/video';
// Build-time only, deliberately outside public/ — see the write below.
const MANIFESTS = 'scripts/.manifests';
const HERO = 'assets/hero-cyanotype.png';

// THE CYANOTYPE ACCENTS ARE BACK, on the two still pages, and this step is back
// with them. They had gone out entirely: two squares in two grades — `print`, the
// design's own at node 217:7395, and `wash`, the pale second exposure at 217:7388
// — used to pop out from behind the slides on the deck pages' dark panel, and
// when both decks became rails nothing drew either one, so the sources left the
// checkout with the step that read them.
//
// What the still pages ask for now is NOT that pair. It is `wash` again, and a
// third plate that was never here: a portrait exposure of pressed nettle leaves,
// drawn on both pages as "image 750" (nodes 479:5485 and 481:4). `print` is not
// in either design and is not rebuilt — the one frame that still draws it is the
// dead dark panel behind the duplicated Studio Edit 02 artboard, which is
// invisible in the design itself.
//
// The grades are one subject exposed twice rather than one photograph lightened,
// which is why they are two files and not a filter: fitting a per-channel gain
// and offset from either to the other lands at r 0.75. The means are the
// identification — 172,210,225 for wash and 94,163,204 for print — and the third
// plate is its own picture at 99,165,204, close to print and not it.
//
// NO ONE-PIXEL INSET HERE, which the old step applied to every square. That inset
// existed to cut a dark rim Figma baked into `print`'s edge columns; neither of
// these two exports carries one — row 0 and row 1 agree to a level or two on
// both — so taking a pixel off every side would be resampling the picture to fix
// a fault it does not have.
//
// THE LEAF PLATE ARRIVES AT 75% IN ITS ALPHA, and both of the things that
// follow from that are settled here rather than in CSS.
//
// The design draws it as an image at 75% opacity over a white rectangle, and the
// export carries that opacity rather than describing it: the file's alpha is a
// flat 191, which is 0.75 of 255. So the page does not fade anything — the build
// composites the export over WHITE, once, and what the pages get is an opaque
// plate they can draw like any other. `under` is that colour, and it is white
// rather than the page's warm paper because the design's underlay is white and
// the difference shows: composited on paper the print comes out tinted.
//
// `fit` is how a source that is not square becomes one. The leaf plate is
// 724x1024 and BOTH designs squash the whole of it into a square box rather than
// cropping to one — verified against Figma's own render of the node, which means
// 138.3,187.3,216.7 against 138.3,187.5,216.8 for the squashed plate and
// 152.8 for a bottom crop. It is the design's distortion and it is deliberate
// enough to be in both frames, so it is baked in here rather than approximated
// by an object-fit the two pages would each have to carry.
const ACCENTS = [
  { name: 'accent-wash', src: 'assets/accent-cyanotype-wash.png', fit: 'cover' },
  {
    name: 'accent-leaf',
    src: 'assets/accent-cyanotype-leaf.png',
    fit: 'fill',
    under: '#ffffff',
  },
];

// The widest square either design draws an accent at: three columns on the
// twelve-column grid, 342.5 at the 1470 artboard. The other two boxes are two
// columns, so one delivered file serves every placement at 2x or better.
const ACCENT_BOX = 3 * 100.8333 + 2 * 20;

// The clips. sharp does not touch video, so every one of these is a copy and a
// rename — the point is only that the delivered file keeps coming from assets/
// under the name the markup asks for, instead of being a hand-placed orphan in
// public/. The still for the same slug is still built below and still needed: it
// is every clip's poster.
//
// `slot` is the design's own numbering for a page that shows more than one, and
// the order matters because each slot has its own placement — on Studio Edit 02,
// slot 1 is the upper block at columns 7-9 and slot 2 the lower at columns 10-12.
// `name` is the delivered stem, which is what the markup points at.
//
// A slot whose source is not in the checkout is SKIPPED, not thrown on, exactly
// as an absent deck is: its absence is a fact, and the page renders with the
// clips that exist rather than with an empty box where the missing one goes.
//
// `poster` is the still each slot shows before a video byte arrives, and it is
// the ONLY thing a reduced-motion reader sees — so it is per slot rather than one
// per page. The two takes here are in different rooms; slot 1's poster on slot 2
// would be the wrong photograph.
//
// Slot 1's poster is this project's own `preview.png` — Figma's first frame of
// that reel, which the landing page's preview is built from too. It is NAMED
// here rather than copied to a poster-1.png beside it: sources live in the
// repository and git does not delta binaries, so the duplicate would be
// permanent history for no new picture. Same rule the plate's cover follows
// below. It is still delivered separately from the preview, because that one is
// built to the leaf box its Figma variant gives it and this one to the box the
// clip is drawn in.
//
// Slot 2's is its own file, poster-2.png, and had to be extracted: there is no
// ffmpeg in this project, so it was captured from the clip's own frame 0 at its
// native 720x1280 through a headless browser and committed like any other source.
const VIDEOS = [
  {
    slug: 'studio-edit-02',
    slot: 1,
    name: 'studio-edit-02',
    src: 'assets/projects/studio-edit-02/clip-1.mp4',
    poster: 'assets/projects/studio-edit-02/preview.png',
  },
  {
    slug: 'studio-edit-02',
    slot: 2,
    name: 'studio-edit-02-b',
    src: 'assets/projects/studio-edit-02/clip-2.mp4',
    poster: 'assets/projects/studio-edit-02/poster-2.png',
  },
];

// The box a clip is drawn in: three columns at 9:16 on the 1470 artboard, at 2x.
// 342.5 wide becomes 685, and 16/9 of that is 1218 — which the 720x1280 sources
// cover with a little to spare, so no poster is ever upscaled.
const CLIP_POSTER = { w: 3 * 100.8333 + 2 * 20, ratio: 16 / 9 };

// slug, then the leaf box in design units (1 unit == 1px on the 1440 artboard).
// These match the per-variant frames in the Figma component set, which is why
// they differ per project — the preview is sized to its image, not the reverse.
const PROJECTS = [
  { slug: 'confidence-underneath', w: 744, h: 418 },
  { slug: 'shop-every-store', w: 744, h: 558 },
  { slug: 'studio-edit-02', w: 341, h: 606 },
  { slug: 'trending-this-week', w: 455, h: 606 },
  { slug: 'mfw-color-trends', w: 744, h: 419 },
  // 499 where its Figma variant is still drawn at 529, and the box follows the
  // PHOTOGRAPH. The variant carries the older of the two shots — box left, cup
  // right, at 1.406 — and the preview now shows the same frame the project page
  // opens on, which is 3220x2160, or 1.4907. Keeping 529 would have left `cover`
  // cropping 6% off the sides of a picture that has the cup at one edge and the
  // box at the other. The design's 744 WIDTH is untouched; only the height moves,
  // so the plate still sits in the row at the width every other preview uses.
  { slug: 'eight-immortals', w: 744, h: 499 },
  { slug: 'glowwie', w: 606, h: 606 },
];

// The project pages' decks: one directory of frames each, one plate per slide.
// Directory-driven rather than a listed manifest — a deck arrives as a folder,
// grows by a file and shrinks by one, and none of that should mean editing this
// script.
//
// Nothing here crops. `fit: 'inside'` scales a frame down until it fits the box
// and stops, so the delivered plate keeps the source's own aspect ratio and every
// pixel of it — the box gives way, not the picture. CSS contains rather than
// covers for the same reason.
//
// The boxes are therefore sized to the deck, not the other way round. Both decks
// are 3840x2160 throughout, so 16:9 is the shape.
//
// THE BOX IS PER PAGE, because the two decks are no longer drawn at the same
// size. A deck at another aspect would need its own `h` changed here; the CSS
// derives its box from the same ratio, and the two must agree.
//
//   RAIL_STAGE   the pinned rail, and BOTH decks read this way now. The slide
//                is eleven columns at 16:9 — 1309.17 x 736.4 at the 1470
//                artboard — which is half again the old sideways box, because
//                the presentation has the whole window instead of sharing it
//                with the brief. See src/rail-page.css.
//
//                It still delivers at a full 2x: 2618 x 1473 against sources
//                that are 3840 x 2160, which would allow 2.93x. Nothing had to
//                be re-exported to make the slides bigger — the headroom was
//                already in the files.
//
// The old DECK_STAGE is gone with the layout it was for. It was 840 wide, a
// little over half the widest box that layout ever asked for, and it has no
// caller now that both decks are rails.
const RAIL_STAGE = { w: 11 * 100.8333 + 10 * 20, h: ((11 * 100.8333 + 10 * 20) * 9) / 16 };

const PAGES = [
  {
    slug: 'confidence-underneath',
    dir: 'assets/projects/confidence-underneath/slides',
    stage: RAIL_STAGE,
  },
  {
    slug: 'mfw-color-trends',
    dir: 'assets/projects/mfw-color-trends/slides',
    stage: RAIL_STAGE,
  },
];

// The REELS. A reel is a project page read DOWNWARD: the brief sits still on
// paper at the left and the frames pass up the right one at a time, each snapped
// to the middle of the window. Eight Immortals is the only one, and it used to be
// a deck — see the note in src/reel-page.css for why the axis turned.
//
// A deck delivers every slide into one box, because every slide is the same shape
// and the same size on the page. A reel does not: its frames are separate pieces
// of artwork, and the design gives each one the size it needs to be read at — the
// dieline is drawn half again as large as the product shots, because it is a flat
// covered in small print and they are photographs of a box.
//
// So the box is PER FRAME, keyed by the source's stem, in design units on the
// 1470 artboard. `box` is the fallback for a frame the design has not placed —
// the product-shot size, which is what a new photograph is most likely to be.
// These same numbers reach the markup as --shot-h; see the reel manifest below.
const REEL_BOX = { w: 825, h: 553 };

const REELS = [
  {
    slug: 'eight-immortals',
    dir: 'assets/projects/eight-immortals/frames',
    box: REEL_BOX,
    boxes: {
      1: { w: 825, h: 553 },
      2: { w: 946, h: 660 },
      3: { w: 821, h: 551 },
    },
  },
  // Two device mockups rather than photographs — the desktop marketplace page and
  // the same page on a phone — and they are the only sources on the site that did
  // not come from a camera or a scan. They are Figma's own 2x exports, dropped in
  // by hand, and that hand step is not a preference: the MCP screenshot of a node
  // comes back at the size the node is DRAWN and will not render larger, so a
  // scripted pull can only ever get 1x. Re-exporting is manual if they change.
  //
  // THE PHONE IS ITS EXPORT WHOLE; THE BROWSER IS CUT TO ITS WINDOW. That split is
  // the point of this entry, and it comes from what the two canvases actually hold.
  //
  //   2  692x1414, and 94% of it is device. Its box is its own half-size, 346x707,
  //      stated to the half unit so `scale` lands on exactly 2 and the resize is
  //      the identity — `cover` into a box of the source's own shape crops nothing.
  //
  //   1  2163x2245, and only the top 1650x1174 of it is the browser window. The
  //      rest is drop shadow falling away below and empty charcoal around it — 48%
  //      of the canvas height carries no picture at all.
  //
  // Delivered whole, frame 1 was SMALL ON THE PAGE, and by arithmetic rather than
  // by taste: reel-page.css caps a frame at the window's height, so the shadow was
  // being fitted to the screen along with the window and the window itself landed
  // at about half the height the design draws it. An earlier pass here kept the
  // export whole on the principle that nothing should be cropped; the principle is
  // right for a photograph, where every pixel is subject, and wrong for a mockup,
  // where the shadow is padding that the page has no way to tell from picture.
  //
  // So `crop` below is an explicit extract, in SOURCE pixels, taken before the
  // resize. Its origin is the window's own top-left corner, measured off the file
  // — the first column and row that are window rather than background — and its
  // size is exactly 2x the box the design draws the frame in, 825x587. Both
  // together mean `scale` is again exactly 2 and the resize is again the identity:
  // the crop IS the delivered plate, at full resolution, with nothing resampled.
  //
  // Measured rather than assumed, and it is the one number here that a re-export
  // can silently invalidate — a mockup nudged inside its Figma frame moves this
  // origin. If frame 1 ever comes back sliced or off-centre, re-measure the corner
  // before changing anything else.
  {
    slug: 'shop-every-store',
    dir: 'assets/projects/shop-every-store/frames',
    box: REEL_BOX,
    boxes: {
      1: { w: 825, h: 587 },
      2: { w: 346, h: 707 },
    },
    crops: {
      1: { left: 290, top: 53, width: 1650, height: 1174 },
    },
  },
];

// The still project pages' plates: one directory of carousel frames each, cut to
// the box the page draws them in and cycled by src/plate-cycle.js. Directory-
// driven for the same reason the decks are — a carousel arrives as a folder.
//
// The box is FOUR COLUMNS at 3:4, which is 463.33 x 617.78 at the 1470 artboard
// — the plate's width is a grid quantity and its height is the photograph's own
// ratio; see the note at the top of src/trending-this-week.css.
//
// IT REACHES 2x AGAIN. The box was five columns while the plate hung off the
// right margin of a stage that had no column lines, and 2x of that wanted 1168
// against the 1080 Instagram's export hands back — so the scale was capped at
// 1.85x. The redesign puts the plate back on the grid at columns 3-6, which asks
// 927, and the source covers that outright. Same rule either way: cap at what the
// source can honestly fill, never enlarge past it.
//
// `fit: 'cover'`, unlike the decks. A deck frame is a whole slide and cropping it
// would take words off it, so those contain; a plate is a photograph shown in a
// box of its own ratio, so cover crops nothing here and is the right rule if a
// frame ever arrives at some other shape.
// `cover` is the frame the folder does not have. The carousel is ten slides and
// frames/ holds nine of them, 2..10 — slide 1 is the cover, and it is this
// project's preview.png, because the carousel's cover and the landing page's
// preview plate are the same photograph. So it is named here rather than copied
// into frames/ as a 1.2 MB 1.png beside the rest: sources live in the repository
// and git does not delta binaries, so the duplicate would be permanent history.
// Same rule as slot 1's poster at VIDEOS above.
//
// It is emitted as 1.webp and listed first, which is both the carousel's own
// order and the design's — the plate opens on the cover.
const PLATES = [
  {
    slug: 'trending-this-week',
    dir: 'assets/projects/trending-this-week/frames',
    cover: 'assets/projects/trending-this-week/preview.png',
    w: 4 * 100.8333 + 3 * 20,
  },
];

const DPR = 2;

// The frames in a directory, in the order the deck or the carousel has them.
//
// Any of the four extensions, because the intake should not care: a deck arrives
// however the tool it was built in exports. What matters is the resolution, and
// the scale check at each call site is what enforces that.
//
// The deck sources are webp, and deliberately. They are photographs, and PNG
// stores photographs losslessly — which for 29 slides at 3840x2160 came to 130 MB
// against 15 MB for the identical pixels as webp q92. The delivered plate is
// lossy either way, so the lossless intermediate bought nothing and cost 115 MB
// of permanent repository history. Export JPEG or webp, not PNG.
//
// Numeric sort, not lexical: the source numbering is unpadded, and a lexical sort
// puts 10 before 2. The delivered file keeps the source's stem, so slide 7 of the
// deck stays 7.webp — adding a frame later inserts a file instead of renumbering
// every one after it, which would silently invalidate every path in the markup.
const FRAME = /\.(png|jpe?g|webp)$/i;

async function listFrames(dir) {
  return (await readdir(dir))
    .filter((f) => FRAME.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map((file) => ({ file, name: file.replace(FRAME, '') }));
}

// The list of frames a page's markup has to carry, written out so the page can be
// regenerated from it rather than edited by hand — see scripts/build-gallery.mjs.
// Hand-keeping seventeen <img> tags in sync with a directory is how a deck ends
// up pointing at a file that is no longer there.
//
// Not under public/. This is a handoff between two build steps, and anything
// under public/ is copied verbatim into the deploy — so it was shipping a build
// artefact to production as though it were an asset.
async function writeManifest(slug, frames) {
  await mkdir(MANIFESTS, { recursive: true });
  await writeFile(
    `${MANIFESTS}/${slug}.json`,
    JSON.stringify({ slug, frames: frames.map((f) => f.name) }, null, 2) + '\n',
  );
}

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/projects`, { recursive: true });
await rm(VIDEO_OUT, { recursive: true, force: true });
await mkdir(VIDEO_OUT, { recursive: true });

const { width: W, height: H } = await sharp(HERO).metadata();

// Hero: full plate, two widths for the srcset. Higher quality than the previews
// — this one is shown at viewport scale, and the scan's grain and paper texture
// are the first things q82 sands off. The grain is baked into the source, so it
// is on the build to preserve it rather than on CSS to add it.
//
// Flattened because the source carries an alpha channel it has no use for: the
// plate is meant to be opaque, and a transparent webp would let the body's paper
// show through the print.
for (const w of [1600, 1080]) {
  await sharp(HERO)
    .flatten({ background: '#c8c8c8' })
    .resize({ width: w })
    .webp({ quality: 90 })
    .toFile(`${OUT}/hero-${w}.webp`);
}

// A 24px-wide copy of the same plate, inlined as a data URI so the print is on
// screen in the first frame instead of some seconds later.
//
// The 1600 plate is 558 KB — it is held at quality 90 because the scan's grain is
// the first thing a lower setting sands off, and that is a deliberate cost. But
// 558 KB is a few seconds on a real connection, and what showed until it landed
// was the flat grey behind it with white type on top, which reads as a broken
// page rather than a loading one.
//
// 24px costs about 230 characters of base64. Scaled to cover the viewport it is
// pure blur, which is the point: the right colours in the right places, with the
// real plate resolving on top of it.
//
// Written as a custom property so this file holds only the datum and styles.css
// keeps the design. If it is ever missing, var() falls back to nothing and the
// background colour shows through — no broken reference.
const lqip = await sharp(HERO)
  .flatten({ background: '#c8c8c8' })
  .resize({ width: 24 })
  .webp({ quality: 55 })
  .toBuffer();

await writeFile(
  'src/hero-lqip.css',
  [
    '/* GENERATED by scripts/build-images.mjs — do not edit.',
    '   A 24px-wide inline copy of the hero plate, so the print is painted in the',
    '   first frame rather than after the full 558 KB arrives. See the .stage__plate',
    '   rule in styles.css. */',
    ':root {',
    `  --hero-lqip: url("data:image/webp;base64,${lqip.toString('base64')}");`,
    '}',
    '',
  ].join('\n'),
);

// The accents. One square each, delivered to the widest box either page draws
// them in, at the same 2x cap and the same honesty rule every other source here
// follows — a square that cannot fill the box is delivered at what it can and the
// build says so rather than enlarging it.
//
// Always flattened, so every delivered plate is opaque: these squares sit BEHIND
// the artwork, and an alpha channel that survived to the page would be a second
// place the 75% could be applied. `under` says over what — see ACCENTS. The wash
// export is already opaque, so its flatten is a no-op and is here for the rule
// rather than the effect.
const accentNotes = [];
for (const accent of ACCENTS) {
  if (!existsSync(accent.src)) {
    accentNotes.push(`${accent.name} source absent, skipped`);
    continue;
  }
  const { width: aw, height: ah } = await sharp(accent.src).metadata();
  const scale = Math.min(DPR, aw / ACCENT_BOX, ah / ACCENT_BOX);
  const side = Math.round(ACCENT_BOX * scale);

  await sharp(accent.src)
    .flatten({ background: accent.under ?? '#fdfdfa' })
    .resize({
      width: side,
      height: side,
      fit: accent.fit,
      position: 'centre',
      withoutEnlargement: true,
    })
    .webp({ quality: 86 })
    .toFile(`${OUT}/${accent.name}.webp`);

  accentNotes.push(`${accent.name} ${side}px at ${scale.toFixed(2)}x`);
}

for (const p of PROJECTS) {
  await sharp(`assets/projects/${p.slug}/preview.png`)
    .resize({
      width: p.w * DPR,
      height: p.h * DPR,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 82 })
    .toFile(`${OUT}/projects/${p.slug}.webp`);
}

// Grouped by slug on the way out, so build-gallery.mjs is handed the slots a
// page actually has and in the design's order.
const clipNotes = [];
const clipsBySlug = new Map();
for (const v of VIDEOS) {
  if (!existsSync(v.src)) {
    clipNotes.push(`${v.name} absent, skipped`);
    continue;
  }
  await copyFile(v.src, `${VIDEO_OUT}/${v.name}.mp4`);

  // The poster, at the box the clip is drawn in. `cover` at 2x, and capped at
  // whatever the source can honestly fill — the same rule the previews follow.
  let poster;
  if (v.poster && existsSync(v.poster)) {
    const box = {
      w: Math.round(CLIP_POSTER.w * DPR),
      h: Math.round(CLIP_POSTER.w * CLIP_POSTER.ratio * DPR),
    };
    const { width: pw, height: ph } = await sharp(v.poster).metadata();
    const scale = Math.min(1, pw / box.w, ph / box.h);
    await sharp(v.poster)
      .resize({
        width: Math.round(box.w * scale),
        height: Math.round(box.h * scale),
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 82 })
      .toFile(`${OUT}/projects/${v.name}-poster.webp`);
    poster = `/img/projects/${v.name}-poster.webp`;
  }

  const clips = clipsBySlug.get(v.slug) ?? [];
  clips.push({ slot: v.slot ?? clips.length + 1, name: v.name, poster });
  clipsBySlug.set(v.slug, clips);
  clipNotes.push(`${v.name} ${(statSync(v.src).size / 1048576).toFixed(1)} MB`);
}

for (const [slug, clips] of clipsBySlug) {
  clips.sort((a, b) => a.slot - b.slot);
  await mkdir(MANIFESTS, { recursive: true });
  await writeFile(
    `${MANIFESTS}/${slug}.clips.json`,
    JSON.stringify({ slug, clips }, null, 2) + '\n',
  );
}

// The stage plate is the one box on the site a source can fail to fill: it is
// the largest thing rendered anywhere, and 2x of it is 1680x1169. So the scale
// is whatever the source can actually cover, capped at 2x — the same rule the
// previews follow, applied to a case where 2x is not always available. Reported,
// because a plate quietly delivered at 1.8x is the sort of thing that should be
// visible in the build output rather than discovered later.
const stageNotes = [];
for (const page of PAGES) {
  // Same reasoning as the page itself: a deck can be held out of the repository,
  // and its absence is a fact rather than a failure.
  if (!existsSync(page.dir)) {
    stageNotes.push(`${page.slug} sources absent, skipped`);
    continue;
  }
  await mkdir(`${OUT}/projects/${page.slug}`, { recursive: true });

  const frames = await listFrames(page.dir);
  const stage = page.stage;

  const scales = new Set();
  let sourceBytes = 0;
  for (const frame of frames) {
    const src = `${page.dir}/${frame.file}`;
    const { width: sw, height: sh } = await sharp(src).metadata();
    // statSync, not metadata().size — sharp only populates that for buffer
    // inputs, so from a path it came back undefined and the report read 0.0 MB.
    sourceBytes += statSync(src).size;
    // Per frame, not per deck: one odd export should be delivered at whatever it
    // can honestly fill rather than upscaled to match its neighbours.
    const scale = Math.min(DPR, sw / stage.w, sh / stage.h);
    scales.add(scale.toFixed(2));

    // The whole frame, scaled to fit inside the box, never enlarged past it. The
    // delivered file therefore has the source's aspect ratio, not the box's.
    await sharp(src)
      .resize({
        width: Math.round(stage.w * scale),
        height: Math.round(stage.h * scale),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toFile(`${OUT}/projects/${page.slug}/${frame.name}.webp`);
  }

  await writeManifest(page.slug, frames);

  // The source weight is reported alongside the scale, because it is the one
  // cost of this pipeline that is invisible until it is permanent: sources live
  // in the repository so Vercel can build from them, and git does not delta
  // binaries, so a heavy re-export is 100+ MB of history that cannot be taken
  // back. Better to see it in the build output than to discover it in a clone.
  stageNotes.push(
    `${page.slug} ${frames.length} slides at ${[...scales].join('/')}x` +
      ` from ${(sourceBytes / 1048576).toFixed(1)} MB of source`,
  );
}

// The plates. Same shape as the decks above and the same two rules — cap the
// scale at 2x, never upscale past what the source can honestly fill, and say in
// the build output what was actually delivered. What differs is only the box and
// the fit; both are argued for at PLATES.
const plateNotes = [];
for (const plate of PLATES) {
  if (!existsSync(plate.dir)) {
    plateNotes.push(`${plate.slug} sources absent, skipped`);
    continue;
  }
  await mkdir(`${OUT}/projects/${plate.slug}`, { recursive: true });

  const frames = await listFrames(plate.dir);
  // The cover goes on the front, under the number the folder skipped. Skipped
  // rather than thrown on if it is not in the checkout, for the same reason a
  // whole deck can be: its absence is a fact, and the cycle is nine frames
  // instead of ten.
  if (plate.cover && existsSync(plate.cover)) {
    frames.unshift({ file: plate.cover, name: '1', absolute: true });
  }
  const box = { w: plate.w, h: (plate.w * 4) / 3 };

  const scales = new Set();
  let sourceBytes = 0;
  for (const frame of frames) {
    const src = frame.absolute ? frame.file : `${plate.dir}/${frame.file}`;
    const { width: sw, height: sh } = await sharp(src).metadata();
    sourceBytes += statSync(src).size;
    const scale = Math.min(DPR, sw / box.w, sh / box.h);
    scales.add(scale.toFixed(2));

    await sharp(src)
      .resize({
        width: Math.round(box.w * scale),
        height: Math.round(box.h * scale),
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(`${OUT}/projects/${plate.slug}/${frame.name}.webp`);
  }

  await writeManifest(plate.slug, frames);

  plateNotes.push(
    `${plate.slug} ${frames.length} frames at ${[...scales].join('/')}x` +
      ` from ${(sourceBytes / 1048576).toFixed(1)} MB of source`,
  );
}

// The reels. A frame at a time, each into ITS OWN box — the one difference from
// the decks above, and the reason this is a third loop rather than a flag on
// that one.
//
// `cover`, where a deck contains. On a deck the box is the slide's own shape, so
// contain and cover are the same operation and contain is the safer word. Here
// the box is the shape the DESIGN draws the frame at, which is not always the
// photograph's: the six-box collection is a 4:3 source shown in a 1.49 box, and
// the design crops it rather than letterboxing it. That crop is 5% off the top
// and 5% off the bottom of a picture whose top and bottom five per cent are
// empty background — it loses nothing and lets the boxes read larger — so it is
// baked in here, once and deterministically, instead of being an object-fit rule
// the page has to carry for one frame out of three.
//
// The consequence the page depends on: every delivered reel frame has its box's
// ratio, so the markup only ever has to state a HEIGHT and the width follows.
const reelNotes = [];
for (const reel of REELS) {
  if (!existsSync(reel.dir)) {
    reelNotes.push(`${reel.slug} sources absent, skipped`);
    continue;
  }
  await mkdir(`${OUT}/projects/${reel.slug}`, { recursive: true });

  const frames = await listFrames(reel.dir);
  const scales = new Set();
  let sourceBytes = 0;
  const placed = [];

  for (const frame of frames) {
    const src = `${reel.dir}/${frame.file}`;
    const box = reel.boxes[frame.name] ?? reel.box;
    // An optional extract, in source pixels, taken BEFORE anything else — so the
    // scale below is measured against what is left rather than against the whole
    // canvas. Only a mockup ever needs one; see the note at Shop Every Store.
    const crop = reel.crops?.[frame.name];
    const pipe = sharp(src);
    if (crop) pipe.extract(crop);

    const { width: sw, height: sh } = crop
      ? { width: crop.width, height: crop.height }
      : await sharp(src).metadata();
    sourceBytes += statSync(src).size;

    const scale = Math.min(DPR, sw / box.w, sh / box.h);
    scales.add(scale.toFixed(2));

    await pipe
      .resize({
        width: Math.round(box.w * scale),
        height: Math.round(box.h * scale),
        fit: 'cover',
        position: 'centre',
      })
      .webp({ quality: 86 })
      .toFile(`${OUT}/projects/${reel.slug}/${frame.name}.webp`);

    placed.push({ name: frame.name, h: box.h });
  }

  // Its own manifest shape, and its own name — `.reel.json`, beside the decks'
  // and the clips'. A reel frame carries a height as well as a stem, because the
  // markup has to state the box the design drew it at and this is the only place
  // that number lives. scripts/build-gallery.mjs writes it out as --shot-h.
  await mkdir(MANIFESTS, { recursive: true });
  await writeFile(
    `${MANIFESTS}/${reel.slug}.reel.json`,
    JSON.stringify({ slug: reel.slug, frames: placed }, null, 2) + '\n',
  );

  reelNotes.push(
    `${reel.slug} ${frames.length} frames at ${[...scales].join('/')}x` +
      ` from ${(sourceBytes / 1048576).toFixed(1)} MB of source`,
  );
}

console.log(
  `built hero from ${W}x${H} scan` +
    ` + ${PROJECTS.length} project previews at ${DPR}x` +
    `, accents: ${accentNotes.join('; ')}` +
    `, clips: ${clipNotes.join('; ')}` +
    `, ${stageNotes.join('; ')}` +
    `, ${plateNotes.join('; ')}` +
    `, reels: ${reelNotes.join('; ')}`,
);
