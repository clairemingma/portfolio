// Two entries now, so the config has to exist: Vite's default is index.html
// alone, and a project page added under projects/ would be served in dev and
// then silently missing from the build.
//
// The key is the URL path, and the directory-per-project shape is deliberate —
// /projects/confidence-underneath/ rather than a flat
// confidence-underneath.html, so the address survives a static host without
// rewrite rules and each project owns a directory it can grow assets into.
import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Project pages are discovered rather than listed, so a page that is not in the
// checkout is simply not built. That is what lets a project be held back from the
// repository — and therefore from the deploy — without the build breaking on its
// absence. Rollup errors on a missing input, so it has to be filtered here rather
// than hoped about.
const PROJECT_PAGES = ['confidence-underneath'];

const input = { index: resolve(root, 'index.html') };
for (const slug of PROJECT_PAGES) {
  const html = resolve(root, `projects/${slug}/index.html`);
  if (existsSync(html)) input[slug] = html;
}

export default defineConfig({
  build: { rollupOptions: { input } },
});
