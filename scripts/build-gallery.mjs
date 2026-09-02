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
    manifest: 'scripts/.manifests/ten-years-of-color.json',
    html: 'projects/ten-years-of-color/index.html',
    title: 'Color Trends',
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

console.log(`wrote ${touched} page${touched === 1 ? '' : 's'}`);
