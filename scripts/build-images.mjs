// Derives the hero plate and the project preview plates from the sources in
// assets/. Everything here is generated — public/img is disposable.
//
// The hero scan is square, so both widths stay square and CSS crops it with
// object-fit. Each project preview is rendered at exactly 2x the leaf size the
// Figma design gives it, so no preview is ever upscaled and none carries pixels
// the layout will not show.
import sharp from 'sharp';
import { copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';

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
// on the site are 3840x2160 throughout, so 16:9 is the shape, and 840 wide is a
// little over half the widest slide box the layout ever asks for (826.66 at the
// 1470 artboard) — which at 2x is comfortably more pixels than any screen shows.
// A deck at another aspect would need STAGE.h changed here; --slide-h in
// deck-page.css derives the box from the same ratio, and the two must agree.
const STAGE = { w: 840, h: (840 * 9) / 16 };

const PAGES = [
  {
    slug: 'confidence-underneath',
    dir: 'assets/projects/Dexcom x SKIMS Confidence Underneath',
  },
  {
    slug: 'ten-years-of-color',
    dir: 'assets/projects/The Evolution of Color Trends in Runway Fashion',
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

  // Any of the four, because the intake should not care: a deck arrives however
  // the tool it was built in exports. What matters is the resolution, and the
  // scale check below is what enforces that.
  //
  // The sources here are webp, and deliberately. They are photographs, and PNG
  // stores photographs losslessly — which for 29 slides at 3840x2160 came to
  // 130 MB against 15 MB for the identical pixels as webp q92. The delivered
  // plate is lossy either way, so the lossless intermediate bought nothing and
  // cost 115 MB of permanent repository history. Export JPEG or webp, not PNG.
  //
  // Numeric sort, not lexical: the deck's own numbering is unpadded, and a
  // lexical sort puts 10 before 2. The delivered file keeps the source's stem, so
  // slide 7 of the deck stays 7.webp — adding a frame later inserts a file
  // instead of renumbering every one after it, which would silently invalidate
  // every path in the markup.
  const FRAME = /\.(png|jpe?g|webp)$/i;
  const frames = (await readdir(page.dir))
    .filter((f) => FRAME.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map((file) => ({ file, name: file.replace(FRAME, '') }));

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
    const scale = Math.min(DPR, sw / STAGE.w, sh / STAGE.h);
    scales.add(scale.toFixed(2));

    // The whole frame, scaled to fit inside the box, never enlarged past it. The
    // delivered file therefore has the source's aspect ratio, not the box's.
    await sharp(src)
      .resize({
        width: Math.round(STAGE.w * scale),
        height: Math.round(STAGE.h * scale),
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toFile(`${OUT}/projects/${page.slug}/${frame.name}.webp`);
  }

  // The markup needs one <img> per frame, and hand-keeping seventeen of them in
  // sync with a directory is how a deck ends up pointing at a file that is no
  // longer there. The list is written out here so the page can be regenerated
  // from it rather than edited by hand — see scripts/build-gallery.mjs.
  // Not under public/. This is a handoff between two build steps, and anything
  // under public/ is copied verbatim into the deploy — so it was shipping a build
  // artefact to production as though it were an asset.
  await mkdir(MANIFESTS, { recursive: true });
  await writeFile(
    `${MANIFESTS}/${page.slug}.json`,
    JSON.stringify({ slug: page.slug, frames: frames.map((f) => f.name) }, null, 2) + '\n',
  );

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

console.log(
  `built hero from ${W}x${H} scan + ${PROJECTS.length} project previews at ${DPR}x` +
    `, copied ${VIDEOS.length} clip, ${stageNotes.join('; ')}`,
);
