// Derives the hero plate and the project preview plates from the sources in
// assets/. Everything here is generated — public/img is disposable.
//
// The hero scan is square, so both widths stay square and CSS crops it with
// object-fit. Each project preview is rendered at exactly 2x the leaf size the
// Figma design gives it, so no preview is ever upscaled and none carries pixels
// the layout will not show.
import sharp from 'sharp';
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const OUT = 'public/img';
const VIDEO_OUT = 'public/video';
// Build-time only, deliberately outside public/ — see the write below.
const MANIFESTS = 'scripts/.manifests';
const HERO = 'assets/hero-cyanotype.png';

// The one project whose plate moves. sharp does not touch video, so this is a
// copy and a rename — the point is only that the delivered file keeps coming
// from assets/ under the slug the markup asks for, instead of being a hand-
// placed orphan in public/. The still for the same slug is still built below and
// still needed: it is the video's poster.
const VIDEOS = [
  {
    slug: 'su26-drop-2',
    src: 'assets/projects/Movement in motion 🖤 @skims @nikewomen #nikeskimspartner.mp4',
  },
];

// slug, then the leaf box in design units (1 unit == 1px on the 1440 artboard).
// These match the per-variant frames in the Figma component set, which is why
// they differ per project — the preview is sized to its image, not the reverse.
const PROJECTS = [
  { slug: 'confidence-underneath', w: 744, h: 418 },
  { slug: 'shop-every-store', w: 744, h: 558 },
  { slug: 'su26-drop-2', w: 341, h: 606 },
  { slug: 'trend-authority', w: 455, h: 606 },
  { slug: 'ten-years-of-color', w: 744, h: 419 },
  { slug: 'tea-boxes', w: 744, h: 529 },
  { slug: 'glowwie', w: 606, h: 606 },
];

// The project pages' slide galleries: one directory of frames each, giving a
// large stage plate per slide plus the thumbnail that selects it. Directory-
// driven rather than a listed manifest — a deck arrives as a folder and grows by
// a file, and neither should mean editing this script.
//
// Nothing here crops. `fit: 'inside'` scales a frame down until it fits the box
// and stops, so the delivered plate keeps the source's own aspect ratio and every
// pixel of it — the box gives way, not the picture. CSS contains rather than
// covers for the same reason.
//
// The boxes are therefore sized to the deck, not the other way round. The Figma
// page draws its figure at 840x584.531, a 1.437 frame from when the content was a
// single landscape still; the deck is 16:9, so the height comes down to 840 at
// 16:9 and the stage tightens around it. project-page.css derives its geometry
// from the same ratio — if a deck ever arrives at another aspect, STAGE.h here
// and --figure-h there are the two numbers to change, and they must agree.
const STAGE = { w: 840, h: (840 * 9) / 16 };
// Same aspect as the stage, so a thumbnail is a true miniature and the button
// needs no dead space around it.
//
// Sized to the LARGEST box any layout gives a thumbnail, not the most common one:
// the strip button is 60 on wide but 100 on narrow, and the deck viewer's drawer
// asks for about 50. Built at 60 it was being upscaled 1.7x on a narrow retina
// screen — the one place the picture is largest. One plate at the maximum, scaled
// down by CSS everywhere else, is cheaper than three sizes and cannot regress.
const THUMB = { w: 100, h: (100 * 9) / 16 };
const PAGES = [
  {
    slug: 'confidence-underneath',
    dir: 'assets/projects/Dexcom x SKIMS Confidence Underneath',
  },
];

const DPR = 2;

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

for (const p of PROJECTS) {
  await sharp(`assets/projects/${p.slug}.png`)
    .resize({
      width: p.w * DPR,
      height: p.h * DPR,
      fit: 'cover',
      position: 'centre',
    })
    .webp({ quality: 82 })
    .toFile(`${OUT}/projects/${p.slug}.webp`);
}

for (const v of VIDEOS) {
  await copyFile(v.src, `${VIDEO_OUT}/${v.slug}.mp4`);
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

  // Numeric sort, not lexical: the deck's own numbering is unpadded, and a
  // lexical sort puts 10 before 2. The delivered file keeps the source's stem, so
  // slide 7 of the deck stays 7.webp — adding a frame later inserts a file
  // instead of renumbering every one after it, which would silently invalidate
  // every path in the markup.
  const frames = (await readdir(page.dir))
    .filter((f) => /\.png$/i.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map((file) => ({ file, name: file.replace(/\.png$/i, '') }));

  const scales = new Set();
  for (const frame of frames) {
    const src = `${page.dir}/${frame.file}`;
    const { width: sw, height: sh } = await sharp(src).metadata();
    // Per frame, not per deck: one odd export should be delivered at whatever it
    // can honestly fill rather than upscaled to match its neighbours.
    const scale = Math.min(DPR, sw / STAGE.w, sh / STAGE.h);
    scales.add(scale.toFixed(2));

    // The stage plate: the whole frame, scaled to fit inside the box, never
    // enlarged past it. The delivered file therefore has the source's aspect
    // ratio, not the box's.
    const plate = await sharp(src)
      .resize({
        width: Math.round(STAGE.w * scale),
        height: Math.round(STAGE.h * scale),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer();

    await sharp(plate)
      .webp({ quality: 86 })
      .toFile(`${OUT}/projects/${page.slug}/${frame.name}.webp`);

    // The thumbnail comes off the plate, not the source, so it is a true
    // miniature of the slide it selects. Cutting both from the source
    // independently lets the two disagree about framing.
    await sharp(plate)
      .resize({
        width: Math.round(THUMB.w * DPR),
        height: Math.round(THUMB.h * DPR),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(`${OUT}/projects/${page.slug}/${frame.name}-thumb.webp`);
  }

  // The markup needs one <img> and one button per frame, and hand-keeping 18 of
  // them in sync with a directory is how a gallery ends up pointing at a file
  // that is no longer there. The list is written out here so the page can be
  // regenerated from it rather than edited by hand — see scripts/build-gallery.mjs.
  // Not under public/. This is a handoff between two build steps, and anything
  // under public/ is copied verbatim into the deploy — so it was shipping a build
  // artefact to production as though it were an asset.
  await mkdir(MANIFESTS, { recursive: true });
  await writeFile(
    `${MANIFESTS}/${page.slug}.json`,
    JSON.stringify({ slug: page.slug, frames: frames.map((f) => f.name) }, null, 2) + '\n',
  );

  stageNotes.push(
    `${page.slug} ${frames.length} slides at ${[...scales].join('/')}x`,
  );
}

console.log(
  `built hero from ${W}x${H} scan + ${PROJECTS.length} project previews at ${DPR}x` +
    `, copied ${VIDEOS.length} clip, ${stageNotes.join('; ')}`,
);
