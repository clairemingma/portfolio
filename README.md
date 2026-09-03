# portfolio

Single-page portfolio for Claire Ong. Vanilla JS + Vite, no framework.

```
npm install       # deps are already vendored in node_modules
npm run dev       # dev server
npm run build     # regenerates imagery, then bundles to dist/
npm run images    # regenerate imagery only
```

The page is an implementation of the `Portfolio Landing` frame in Figma
(`SaU0QGoWbvedIa7mLwu58G`, node `56:924`), with the project previews coming from
the component set at node `69:8908`.

## The scroll choreography

`src/scroll-choreography.js` is the whole of it: one rAF-throttled scroll
listener that writes CSS custom properties. Nothing else reads layout during
scroll.

With `S = scrollY`, `vh` the viewport height, `navH` the bar height,
`T1` the phase-one runway and `T2 = vh - navH`:

| phase | scroll range | what moves                                                                                                                                                                  |
| ----- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `0 … T1`     | Nothing moves but the about copy, which travels up and off the top of the page. Bar rests centred on the print, where the design puts it, with the copy hanging beneath it. |
| 2     | `T1 … T1+T2` | The print travels up at scroll speed with the paper flush behind it. The bar rides along, reaching `top: 0` exactly as the paper's edge arrives beneath it.                 |
| 3     | `> T1+T2`    | Bar locked. Paper scrolls beneath it as an ordinary page.                                                                                                                   |

**The print travels with the scroll.** `.stage` is fixed so it can be pinned
through phase 1, then translates up by `--stage-y` through phase 2 — and
everything inside goes with it, so the print slides away at scroll speed rather
than being wiped in place. Its motion is 1:1 with the distance scrolled past
`T1`, and that is asserted rather than assumed.

Because `.stage`'s lower edge and the paper's leading edge move at the same rate
they stay exactly coincident throughout — never a gap, never an overlap — so the
paper follows immediately behind the print. The print's own correspondence line
travels away with it.

The one number that makes this hold together is the runway spacer, sized
`vh + T1`. That puts `.sheet`'s document top at `vh + T1`, so at the lock point
the paper's edge sits at `navH` — flush under the bar. The print has travelled up
by exactly `T2` over the same distance, so the only part of it left in frame is
the strip behind the bar.

The bar rests at `T2/2` and covers that distance over the window in which the
paper covers `T2`, so it moves at half scroll speed. Its position is derived from
the paper's progress rather than a scroll offset of its own, which is why the two
still meet exactly at the lock.

The design puts the about copy directly under the nav's ABOUT label, and it is
aligned to it exactly. That used to fall out of the grid, because both were padded
to the same offset in a shared twelve-column grid. It no longer can: the bar
centres ABOUT in its own column (see below), so the label's text edge sits at
column-left plus half the leftover, and the leftover depends on how wide the word
renders. There is no grid line to anchor to.

So it is measured. `measure()` reads the left edge of the label's **word span** —
not the link, whose box also holds the trailing comma — and publishes it as
`--about-left`; the copy offsets from that. `measure()` already re-runs on resize
and on `document.fonts.ready`, which is what matters here: when the real WT
Kormelink files land the word's width changes, and the alignment re-derives itself
instead of drifting. The CSS keeps a fallback for the pre-JS frame that is correct
at 1440 and scales with `--vr`, so it is close at any width.

`--about-left` is published **before** `--about-rise` is measured, and the order
is load-bearing: the offset changes the copy's width, the width changes how it
wraps, and the wrap changes its height. Reading `offsetHeight` afterwards forces
the layout and gets the settled figure; reading it first banks a stale one and
leaves the copy not quite clearing the fold.

Phase 1 carries the copy up and clean off the top of the page rather than wiping
it inside a clip window: `--p1` multiplied by `--about-rise`, which is the copy's
top within the stage plus its own height, so its last line has just cleared the
fold as phase 1 ends — whatever the viewport height. Since the plate, the bar and
the paper are all held still until phase 2, **nothing on the page can start
scrolling until the copy is genuinely gone.** That ordering is asserted.

The copy holds full opacity throughout; it does not dim on the way out. It
crosses the bar early on — the bar rests mid-print and the copy starts
immediately beneath it — and passes behind it.

`--about-rise` is measured in `measure()` rather than derived in CSS, and the
measurement walks the offsetParent chain up to `.stage`: `.stage__grid` is itself
positioned, so the copy's own `offsetTop` is relative to that and is 0. It is
measured at all because both the offset and the height depend on how the copy
wraps and on which serif has loaded — which is why `measure()` re-runs on
`document.fonts.ready`.

### The colour change

Two separate things, and keeping them separate is the whole point.

The **trigger** is a threshold: `.nav.is-over-paper` is set on the frame the
paper's leading edge reaches the bar's underside — which the geometry puts exactly
at the lock. It cannot fire early. The bar's underside is at
`navRest(1 - p2) + navH` and the paper's edge is at `vh - p2·T2`; with
`navRest = T2/2` and `T2 = vh - navH`, those are equal only at `p2 = 1`.

The **colour** then eases over 250ms on `var(--ease)`. That is not the same thing
as interpolating the colour against scroll position, which smears the change
across the whole approach and reads as mush — that version was tried and taken
out. Only colour is eased; the background snaps, which is invisible, because what
it snaps to is the same paper already behind the bar.

Both halves are asserted, and the pair of checks is what holds them apart: pure
white three scroll pixels before the threshold, and a 250ms eased `color`.

**Why the threshold sits at the lock and not later.** Waiting for the paper to
cover the bar's _whole band_ leaves its leading edge climbing through the band
while the bar is still transparent, and a bright edge sitting across the bar's
underside reads as a white rule under the nav rather than as a reveal. Firing at
the lock, the bar takes its own paper background on the same frame the paper
arrives, so the two are continuous and the only boundary left is at the bar's top
edge — the top of the viewport, off screen. The invariant is swept and asserted:
across phase 2 and the frames either side of the lock, the paper's edge is never
strictly inside a transparent bar.

The bar draws no rule beneath itself in either state. It carries no accent any
more — Contact held the blue and Contact was removed; `--color-link` now shows
only in `::selection`. LinkedIn and the address take its place, collected into the
bar as the print goes behind it.

### The bar and the correspondence lines

The bar sits on the page's **twelve** columns, the same ones everything else uses.
It used to run on a five-column rhythm of its own with every item centred, which
is why anything wanting to line up with one had to be told where it landed by
JavaScript.

    mark      column 1        justified left, on the measure's edge
    Projects  column 4        justified right, ending on that column's edge
    About     columns 6-7     centred — which is the page's centre
    LinkedIn  column 9        the same column the print's own line uses
    address   columns 10-12   justified right, ending on the right margin

About is the deliberate exception. Twelve columns are symmetric about the boundary
between 6 and 7, so a span of those two centres on exactly half the viewport — 735
of 1470, 960 of 1920. It reads as page-centred because it is, and it is still a
grid placement rather than a transform fighting the grid.

The consequence is that About sits on no grid line, so anything aligning to its
left edge has to be told where that is. The about copy does, and
`scroll-choreography.js` measures it as `--about-left` for exactly that reason. It
is the only measured position left on the site.

The print's correspondence line takes columns **9** and **10-12** — the same two
the bar's collected pair uses, because this line is what rises into the bar. That
is what makes the arrival purely vertical: nothing slides sideways on the way up.
The page footer keeps its own five columns with `© 2026 Claire Ong` in the first,
which sits it under the mark.

Every grid on the site uses `minmax(0, 1fr)` rather than a bare `1fr`. A bare
`1fr` is `minmax(auto, 1fr)`, whose auto minimum is the track's min-content width —
so an item too wide for its share widens its own column and shoves every column
after it along. The wordmark, at 128 in a 98 column, was doing exactly that and
moving About 19 off the column the copy was sitting on.

Mobile keeps its own arrangement: the bar is a single spread flex row and the
correspondence lines stay on the four-column grid, because twelve columns cannot
hold any of this at 375. On narrow the footer's line takes its own row above the
pair — four columns will not hold it plus a 20-character address side by side.

### How much paper

`.sheet` is exactly one viewport — `min-height: calc(var(--vh) + var(--nav-h))`,
where the extra bar-height is the strip the locked bar sits over. That is both a
floor and a ceiling.

It is a floor because the choreography cannot finish without it: if the paper
were shorter than a viewport, max scroll would leave the print's lower band
uncovered, so the bar would never reach its threshold, never turn graphite and
never take its background.

It is a ceiling because there is nothing below the index — no further sections —
so any paper past the fold is empty white to scroll through. `.sheet` is a flex
column: `.projects` takes `flex: 1` and centres the index in what is left, and
the footer sits on the floor. The index still arrives on an open field, which was
the design's intent, without the page running on to achieve it.

`min-height` rather than `height`, because on a short viewport seven rows plus a
footer can exceed one screen and must push the paper taller instead of
overflowing a fixed box.

One consequence worth knowing: there is only bar-height-and-change of scroll left
past the lock. With the colour change now firing _at_ the lock rather than a
bar-height after it, that no longer matters for the flip — but it does mean the
index cannot be scrolled far once it is in frame.

### Tuning

| knob                                     | where                        | effect                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PHASE_ONE_FRACTION`                     | `src/scroll-choreography.js` | `T1` as a share of the viewport, and the knob for how fast the copy leaves. The copy covers a fixed distance (~0.56vh) over `T1` of scroll, so a larger `T1` is a lower ratio of copy travel to scroll — it moves more slowly under the same finger. At `1.0` it runs at a bit over half scroll speed, which reads as unhurried; at `0.6` it tracked scroll almost 1:1 and felt driven rather than drifting. |
| `--dur` / `--ease`                       | `src/styles.css`             | The one duration and one curve behind every eased state change on the page.                                                                                                                                                                                                                                                                                                                                  |
| `object-position` on `.stage__plate img` | `src/styles.css`             | Which part of the scan is framed. `50% 50%`, matching the design: the scan is square and the frame crops it dead centre, which puts the gypsophila spray behind the mark and the leaf's flat field under the copy.                                                                                                                                                                                           |

## The index

Seven rows, each 52.898 units tall, with the year at the far left and the client
and title stacked at the far right — column 11. The middle of every row is
deliberately empty: that is the channel the hover preview lands in.

One project is always showing, and on landing it is the top one — Confidence
Underneath — which is the design's own resting state. So the dim is the resting
state too, not a hover effect: every row's type sits at 30% except the current
one. The rules stay at full strength; they are what holds the index together, and
the design leaves them alone. `pointer-events: none` on `.viewer` is
load-bearing: the plate covers the middle of every row, and the row is the hover
target.

The swap itself is a cut: no fade, no scale, no easing. Every plate is already in
the DOM and decoded, so hiding one and showing the next lands in a single frame,
and `visibility` rather than `opacity` carries it. The only transform on a plate
is the centring translate, identical in both states so there is nothing that
_can_ animate. The check for this asserts the scale terms of each plate's matrix
rather than comparing two plates' matrices outright — the centring translate is
−50% of each plate's _own_ height and the plates are deliberately different
sizes, so a direct comparison would fail for the wrong reason.

The lit plate and the undimmed row are one fact, so they are driven from one
variable in `project-viewer.js` and never from `:hover` — nothing can leave a row
highlighted over another project's image.

**Scrolling counts as hovering.** `pointerenter` needs the _pointer_ to move, so
scrolling with the cursor held still would leave the plate on whatever row
happened to be underneath when the mouse last moved, while the rows slide past it.
So the last cursor position is remembered and hit-tested on scroll:
`elementFromPoint` rather than comparing rects, because it already accounts for
the fixed print, the locked bar and anything else stacked above the list, so a row
covered by the bar cannot claim a cursor sitting on top of it. The plates carry
`pointer-events: none`, so they never intercept the test. The cursor leaving the
window clears the stored position — otherwise it would go on claiming hits as the
page scrolled under a pointer that was no longer there. The markup seeds both (`is-active` on
the first plate, `is-current` on the first row) so the resting state is right
before the module runs rather than flickering into place after it. Leaving the
list keeps the last plate rather than reverting; with a default always up there
is nothing to revert to, and reverting felt twitchy between rows.

Each plate keeps the leaf box its own Figma variant was drawn at, carried on the
element as `--pv-w` / `--pv-h` in design units, so no preview is stretched to a
shared frame. `scripts/build-images.mjs` renders each one at exactly 2× that box.

One plate moves. **SU26 Drop 2** is a `<video>` rather than an `<img>`, wearing the
same class and the same `--pv-w` / `--pv-h`, so the cut works on it unchanged. Its
poster is the still already built for that slug — the same clip's first frame —
which is what keeps the swap a cut instead of a stall: the plate is painted before
a byte of video arrives. Playback is slaved to `is-active`, and each hover rewinds
to zero, so the clip is never caught mid-phrase and never decodes off screen.
`prefers-reduced-motion` holds the paused first frame, which is exactly the still
the slot used to carry.

## Verification

```
npm run build
npx vite preview --port 4173 &
node scripts/verify-choreography.mjs
```

Drives the built site in headless Chrome over the DevTools protocol and asserts
the geometry at every phase boundary — plate fills the viewport, bar rests
centred, bar draws no rule, copy lands on the same pixel as the ABOUT link, copy
rises proportionally at full opacity and is completely off screen before the
plate or bar move, bar travels in lockstep with the plate at half its rate, bar
reaches the top exactly at the lock point, paper arrives flush beneath it, the
white is exactly one viewport with the footer on its floor, the window onto the
print travels 1:1 with the scroll and the paper's edge stays flush with it, the
print has travelled exactly T2 by the lock, the paper's edge is never inside a
transparent
bar anywhere across phase 2, the bar is still pure white half way up and three
pixels before the threshold then eases to `#404040` over 250ms, paper still covers
the print at max scroll, scrolling under a stationary cursor changes the project,
hovering a nav link underlines the word but not its trailing comma and does so
instantly, the bar is the page's twelve columns placed 1 / 4 / 6 / 9 / 10 and
reaches both margins, About is centred on the page rather than on a column, the
footer is five columns with the line in the first, the mark reads `Claire M Ong`
in La Belle Aurore and does not change the bar's height, the serif resolves to WT
Kormelink TRIAL and the labels to Inter with no fourth family, the collected pair
is hidden at rest and arrives with the lock, the address is a copy button rather
than a mailto, the print carries
nothing layered over the plate to add grain, plates carry no transition and no scale, a plate
is up before any interaction and it is the top project, the undimmed row tracks
the plate through a full walk and one stays up on leave, all seven plates render
at their designed leaf box from a source that is never upscaled, no horizontal
overflow at 390px. Writes frames to `scripts/.verify/`. No dependencies; it uses
Node 22's global `WebSocket`.

## Design provenance

Layout, palette and type conventions follow bureaurouge.com. Four things were
measured off that page directly, and the choreography here matches them:

| what                      | measured                                                                                                                        | where it lands here                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| scrolling                 | native — no Lenis, Locomotive, GSAP or ScrollTrigger present, `scroll-behavior: auto`                                           | native scrolling, one rAF-throttled listener                                                    |
| the hero                  | `position: sticky; top: 0` at full viewport — pinned, content scrolls over it                                                   | `.stage` is fixed and never transformed                                                         |
| the header's colour       | `transition: color 0.25s cubic-bezier(0.37, 0, 0.63, 1)` on the element that owns the colour; the state itself flips discretely | threshold + 250ms eased `color`, same curve                                                     |
| the transition vocabulary | seven distinct transitions on the whole page; 250–450ms; three easings, all ease-out or symmetric ease-in-out                   | one `--dur` (250ms) and one `--ease`, its symmetric ease-in-out, behind every eased change here |

The lesson from the third and fourth rows is that the smoothness is not a scroll
library and not long durations. It comes from pinning what should not move so
nothing can jitter against it, and from a small set of short eased transitions on
_discrete_ state changes rather than values interpolated against scroll position.

The palette is theirs verbatim, including `--color-graphite: #404040`, taken from
their published stylesheet:

| token       | value     |
| ----------- | --------- |
| paper       | `#fdfdfa` |
| paper shade | `#f5f4f3` |
| index grey  | `#c8c8c8` |
| system grey | `#919191` |
| graphite    | `#404040` |
| link        | `#0074a6` |
| red         | `#a00909` |
| white       | `#fff`    |

`link` was retuned from the design's `#306ea5`: the print is 92% one register
(`#508db1`, hue 250°) and the original sat at 268°, the hue of the plate's deep
field, which is 1% of it. Same lightness and chroma at the print's own hue, so it
recedes on the print and still carries on the paper. It dressed the bar's Contact
link until that was removed and now shows only in `::selection`.

The root font-size _is_ the design unit (`--vr`), so every `Nrem` in the CSS
means "N units on the 1440 artboard". Above 1440px the unit caps at 1px and the
layout gains margin rather than growing; below it, everything scales together.
Mobile switches to a 4-column grid with its own unit.

Decimals in the CSS (`37.594rem`, `52.898rem`, `17.594rem`) are lifted verbatim
from the Figma frame rather than rounded. Several are load-bearing: the bar's
37.594 is what every derived scroll number is measured from.

The Figma frame gives no mobile artboard. Three things are therefore judgement
rather than design: the bar becomes two flex rows — the mark, then the three
links spread beneath it — because four names at 24 units plus three links do not
fit one row at 375; the index caption right-aligns instead of sitting in column
11; and the copyright line takes its own row above the two contact links.

The narrow overflow check walks leaf elements and compares their own right edges
to the viewport, rather than reading `scrollWidth`. `body` carries `overflow-x:
hidden`, so anything running past the edge is clipped and reports zero overflow —
which hid a real one when the mark's name lengthened.

### The dark panel and its accents

On the project pages the grey behind the slides is **one screen wide and it never
moves**. It is a `position: sticky; left: 0` flex item at the _head_ of the
track, so its flow position is track x 0 — already the window's left edge — and
there is nothing for the sticky offset to correct on the first frame and
everything for it to hold afterwards. The paper and the presentation travel over
it and away to the left; the grey and the cyanotype squares on it stay exactly
where the page opened.

Sticky rather than `position: fixed`, and the reason is the push past the end:
`.deck__track` takes an inline transform there, a transformed ancestor becomes the
containing block for a fixed descendant, and `inset: 0` would then resolve against
the fifteen-thousand-wide track — the accents would jump the width of the deck for
the length of the gesture. It takes no space in the row either (a negative right
margin cancels its own width), so the paper still begins at track x 0 and the
scroll range is what it always was.

Being first in the row is also what puts the two left-hand squares behind the
brief at rest, to be uncovered as the paper leaves — the middle one cut at the
paper's right edge, which is how Figma node 210:7196 draws it: that square is on
the page's grid at 384 and the paper runs to 420, so a sixth of it is under the
brief until the brief has gone. The progress row still appears at `scrollLeft ==
--deck-lead`, which is now simply the moment the paper has left the screen.

The accents are on the page's grid twice over, and both axes are derived rather
than measured. Across, the margin plus a whole number of column steps — and
because the panel is one screen sitting on the page's own margin, the panel's grid
_is_ the page's. Down, the same step again as twelve _rows_, which is what twelve
columns would be if the page were square: same margin, same gutter, so the same
step. The design's **two** squares land on that lattice to within 2 units, and
the snapping is inside its own tolerance rather than a licence — every figure in
the design misses its line by one or two units in the same way:

| Figma node       | x    | y   | size | lands on               | plate |
| ---------------- | ---- | --- | ---- | ---------------------- | ----- |
| 210:7196 image 6 | 384  | 504 | 220  | col 3 / row 4 / span 2 | wash  |
| 210:7196 image 7 | 1110 | 22  | 340  | col 9 / row 0 / span 3 | print |

The lines those land on are 382.5 and 1107.5 across, 503.33 and 20 down, and
221.67 and 342.5 wide.

A third square stood at the top left for a while — node 235:7439, x 0, y 81, 220
square — and is out for now. Its x was the page's own left edge rather than a
column line, which needed a bleed modifier, and its y was row 1 of a
twenty-four-row grid, which needed the rows subdivided; both went out with it.

Columns and spans are counted in twelfths and re-counted in the grid the page
actually has, because each is a proportion of the measure rather than a number of
columns: on a phone's four columns the pair comes out at column 1 and column 3, a
single column wide each, instead of falling off a grid with no ninth column to put
them on. Row indices are _not_ re-counted — a row is a column step turned
vertical at every width, so it is already the same fraction of the way down the
square page. The rows are subject to one rule — a square must show a
fifth of itself clear of the slides _and_ out from under the bar. Where the row the
design names cannot satisfy that, the square moves to the nearest row that can on
the same side of the slides, since one square above the presentation and one
below it is the composition; under about 620 of height neither side has a row for
either of them and the panel is simply bare. A square is never cut by the foot of the
window either — nothing here moves any more, so a crop would be permanent rather
than passing.

One departure from the design: the progress counter and the two end labels gain a
text-shadow it has none of. The grey carries the squares and does not move, so
white 11px type can come to rest on a pale cyanotype at about 1.5:1. It is
invisible over charcoal, which is what is behind all three in the design.

Every square is a **named** column and row. An earlier pass drew extra ones from a
hash of their index and the hashing is gone with it: the panel is a single screen,
so there is no length to scatter along and nothing a random position can be right
about.

## Assets

`assets/` holds the sources; `public/img/` and `public/video/` are generated from
them by `scripts/build-images.mjs` and are disposable.

| source                               | used for                               |
| ------------------------------------ | -------------------------------------- |
| `assets/hero-cyanotype.png`          | the landing plate, at 1600 and 1080 wide |
| `assets/accent-cyanotype-print.webp` | deck accent plate, at 720 square       |
| `assets/accent-cyanotype-wash.webp`  | deck accent plate, at 720 square       |
| `assets/accent-cyanotype-sprig.webp` | held, unbuilt — see note 5            |
| `assets/accent-cyanotype-leaf.webp`  | held, unbuilt — see note 5            |
| `assets/projects/<slug>.png`         | one per project, rendered at 2× its leaf box |
| `assets/projects/*.mp4`              | the SU26 Drop 2 reel, copied under its slug |

sharp does not touch video, so the mp4 leg of that build is a copy and a rename.
It still runs through the script rather than being hand-placed in `public/`, so
that `assets/` stays the one place a delivered file comes from.

Three notes on where those came from:

1. **The hero grade.** Figma bakes an image-fill adjustment into the asset it
   hands out, but only at 1024px; the original fill is 2446px and ungraded. The
   committed source is the 2446px original with a per-channel gain/offset fitted
   from Figma's own render — mean absolute error 3.4/255 against it, down from
   45.4 ungraded. So the plate is the design's colour at 2.4× the resolution
   Figma's export offered.
2. **Two previews are not plain image fills.** `shop-every-store` is a composed
   browser mockup in Figma, so it is committed as a flattened 2× export of that
   frame rather than reassembled in HTML. `su26-drop-2` is a _video_ fill, and the
   reel now plays: the mp4 is committed alongside the PNG, which stays because it
   is Figma's poster frame and is still the plate's `poster`. At 720×1280 the clip
   is a hair over the 682×1212 that slot wants at 2×, and 9:16 against the slot's
   0.5627, so `object-fit: cover` crops a rounding error and nothing more. It is
   3.6 MB, delivered whole at `preload="auto"` — the plate has to be ready to cut
   to on hover, and there is no ffmpeg in this project to make a smaller rung.
3. **The grain is in the scan, not in the code.** Figma's print carries a noise
   fill that codegen cannot export, so for a while it was rebuilt as a tiled
   overlay multiplied over the plate. The scan now has grain baked in, so that
   overlay is gone and the only job left is not to destroy it — which is why the
   hero is built at webp q90 while the previews sit at q82. Grain is the first
   thing lossy compression discards.

   Measured on the same flat patch and at the same display scale, so the numbers
   are comparable to Figma's frame export:

   | stage                       | grain (RMS laplacian) |
   | --------------------------- | --------------------- |
   | Figma frame export          | 22.2                  |
   | `assets/hero-cyanotype.png` | 15.1                  |
   | `public/img/hero-1600.webp` | 12.2                  |

   The drop from source to served is the downscale to 1600 plus q90. Note that
   baked-in grain scales _with_ the image, where the old overlay was fixed at one
   grain pixel per CSS pixel — so the texture now coarsens slightly as the plate
   is scaled up on a wide viewport.

   The source carries an alpha channel it has no use for, so the build flattens
   it: the plate is meant to be opaque, and a transparent webp would let the
   body's paper show through the print.

4. **The print is on screen before the print arrives.** The 1600 plate is 545 KB,
   held at quality 90 because the grain is the first thing a lower setting sands
   off. So the build also emits a 24px copy of it inlined as a data URI
   (`src/hero-lqip.css`, ~230 characters), which `.stage__plate` shows scaled to
   cover — pure blur, the right colours in the right places, with the real plate
   fading in over it. Under it sits `#508db1`, the plate's own dominant register,
   so the white bar type is legible at 3.4:1 rather than the 1.7:1 the design's
   flat grey gave.

5. **The deck accent plates are the design's own squares.** The project pages
   compose two cyanotype squares on the grey behind the slides, and neither plate
   is derived from the landing scan.

   `print` is Figma node 217:7395 exported at 4× — 1360 of the 340 it is drawn
   at. It is the same subject as the hero but not the same frame or the same
   grade: Figma bakes a node's image-fill adjustment into what it exports, so the
   export _is_ the colour the design shows, where covering a square with the hero
   scan was a different crop of a differently graded plate. `wash` is the pale
   second exposure, node 217:7388's own fill at its full 2446. That node's export
   cannot be used the same way — it is clipped by the frame it sits in, so Figma
   hands back 184×220 of a 220 square — but the raw fill needs no grade fitted to
   stand in for it: against the export it comes back at k 0.97 per channel, which
   is resampling error.

   The two are not one photograph lightened. Fitting a per-channel gain and
   offset from either to the other lands at r 0.75, so no CSS filter or white
   veil over one stands in for the other. Both are committed as webp rather than
   PNG, on the rule the deck sources follow: they are photographs, PNG stores
   photographs losslessly, and git does not delta binaries — 607 KB of webp
   against 5.1 MB of PNG is permanent history either way.

   `sprig` and `leaf` (nodes 238:7576 and 217:7389, 1080 squares exported at 2×)
   sit in `assets/` unbuilt — the plates the third accent was drawn in before it
   was taken back out. They are paler than these two and are different _subjects_
   rather than different grades, which is why they are named for what is in them
   where the first two are named for their tone. Nothing draws them, so nothing
   delivers them; add them to `ACCENTS` in `scripts/build-images.mjs` when
   something does.

   Both are delivered at 720 square, which is 2× the largest square the deck
   draws (three columns and their gutters, 342.5 units), and the one- and
   two-column squares are the same file scaled down. Placement is
   `src/project-deck.js`; the geometry is `.deck__accent` in
   `src/deck-page.css`.

### Substitutions to make

**Fonts.** Two families, no more: **WT Kormelink TRIAL** for anything set as
text and **Inter** for every small uppercase label. The mark — `Claire Ming Ma
Ong`, with the given names italic and the first and last upright — is the same
serif, not a third face. Inter is free and comes from Google
Fonts, so it is already exact. Both Kormelink cuts are declared in
`src/styles.css` with `@font-face` rules pointing at files that are not in the
repo yet, and fall through to Spectral until they are:

| role                                       | design face                | drop the file at                                |
| ------------------------------------------ | -------------------------- | ----------------------------------------------- |
| project titles, about copy, `Claire`/`Ong` | WT Kormelink TRIAL Regular | `public/fonts/wt-kormelink-trial-regular.woff2` |
| `Ming Ma` in the mark                      | WT Kormelink TRIAL Italic  | `public/fonts/wt-kormelink-trial-italic.woff2`  |
| every small uppercase label                | Inter Regular              | — already correct                               |

Dropping those two files in is the whole swap; no CSS change is needed. Until
then `npm run build` prints a warning for each unresolved URL, which is expected,
and `npm run dev` answers those two paths with the HTML fallback (a 200, not a
404), so the browser logs a font-parse error and falls through to Spectral.

The `verify-choreography.mjs` font checks assert the _stack_ — that the serif
resolves to WT Kormelink TRIAL, that the mark shares it, and that no third
family crept back in. They pass whether or not the woff2 files are present, so
they will not tell you the real faces are loading; check the network panel for
that.

An earlier unrelated scaffold used to sit in `src/_archive/`, with
`public/cyanotype/` and two scripts belonging to it. All of it is deleted: nothing
imported any of it, both scripts threw, and `public/cyanotype/` was 2.1 MB of
every deploy.
