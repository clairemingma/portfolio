// Writes the repetitive half of a project page's gallery into its HTML: one
// <img> per slide, one button per thumbnail, the counter's seed, and the preload
// hint for the first frame.
//
// The slides stay in the markup rather than being built by JS at runtime — the
// page's whole premise is that every frame is already in the DOM and decoded, so
// the swap is a cut, and a gallery assembled on mount would have no slides at all
// without JS. But eighteen hand-kept copies of the same six lines is how a
// gallery ends up pointing at a file that has been renamed, so the copies are
// generated from what the image build actually emitted and pasted between
// markers. Everything outside the markers is hand-written and left alone.
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
];

// Replaces everything between `<!-- name:start -->` and `<!-- name:end -->`,
// keeping the markers. Throws rather than appending if a marker is missing: a
// silent no-op here looks exactly like a page that did not need regenerating.
function splice(html, name, body, indent = 10) {
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
  // Only the first slide carries a real `src`; the rest carry `data-src` and are
  // given one by project-gallery.js as you approach them.
  //
  // `loading="lazy"` cannot do this job. The slides are stacked on top of each
  // other and hidden with `visibility`, which still gives them a box inside the
  // viewport — so the browser considers every one of them in view and fetches the
  // lot. On an eighteen-frame deck that is 3 MB to look at slide one.
  //
  // The first slide keeps a plain `src` so the page shows something without JS.
  // That is the honest no-JS baseline here: every control on this gallery is
  // scripted, so there is nothing to navigate with anyway.
  const slides = frames
    .map((name, i) =>
      [
        `            <img`,
        `              class="media__slide${i === 0 ? ' is-current' : ''}"`,
        `              data-slide`,
        i === 0
          ? `              src="${dir}/${name}.webp"`
          : `              data-src="${dir}/${name}.webp"`,
        `              alt="${page.title} — slide ${i + 1} of ${frames.length}."`,
        `              decoding="async"`,
        `            />`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  const thumbs = frames
    .map((name, i) =>
      [
        `              <button`,
        `                class="media__thumb"`,
        `                data-thumb`,
        `                type="button"`,
        `                aria-pressed="${i === 0}"`,
        // Hidden unless it is the single upcoming frame. That is the narrowest
        // window project-gallery.js will ever paint, so the markup's resting
        // state is one the module can only add to.
        //
        // Marking just the current one hidden — which is what this did — left the
        // other seventeen rendered until the module ran, sprawling a strip 1400
        // wide across a 127 gutter and off the edge of the page. The module tidied
        // it a frame later, but the frame in between is the one the incoming page
        // transition shows, and it read as a broken page every time.
        i === 1 ? null : `                hidden`,
        `              >`,
        `                <img`,
        `                  src="${dir}/${name}-thumb.webp"`,
        `                  alt="Show slide ${i + 1}"`,
        `                  loading="lazy"`,
        `                />`,
        `              </button>`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

  let html = await readFile(page.html, 'utf8');
  html = splice(html, 'slides', slides, 10);
  html = splice(html, 'thumbs', thumbs, 14);

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
