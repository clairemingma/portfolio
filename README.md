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

**Two of the seven plates move, and both move only while they are the one up.**
Studio Edit 02's is a `<video>`; Trending This Week's is a `<div>` holding the
ten-frame carousel its project page shows, cut between on the same 1.4s beat.
Off-screen motion would burn a decoder on something nobody can see, and a clip or
a cycle still running while hidden would be caught mid-phrase on the next hover
— so `project-viewer.js` slaves both to the same `is-active` class that shows
them, and each hover winds the plate back to its first frame so the cut and the
start of the motion are the same image.

The cycle itself is `createPlateCycle` in `src/plate-cycle.js`, which is a
factory rather than a mount precisely because there are now two callers wanting
one beat under different rules. It owns the two reasons a cycle must not run that
belong to the machine — a reduce-motion preference, a hidden tab — and the caller
owns the one that is its own, whether it is this plate's turn. So the viewer
cannot forget to honour the preference, and the cycle does not have to know what
a hover is. The still project page's `mountPlateCycle` is the same factory with
`start()` called immediately, because on that page nothing has to wait.

**Frame 1 of the preview cycle is the preview plate that slot already held** —
the right-sized `/img/projects/trending-this-week.webp`, built from the same
photograph the carousel opens on. So the resting image is unchanged and correctly
sized for a 455 × 606 box, and only frames 2–10 are new weight: 492 KB, deferred
behind `data-src` and promoted by `load-order.js` once the print has painted.
That is the same arrangement the clip uses, where the poster is the still already
built from its own first frame. The block is generated between
`<!-- preview-frames:start -->` and `<!-- preview-frames:end -->` from the same
manifest the project page's frames come from, because the carousel is a folder,
folders grow, and a hand-kept second copy of the list is how one of them ends up
pointing at a frame that is not there.

**Eight Immortals is the one exception**, at 744 × 499 where its variant is still
drawn at 744 × 529. Its preview was changed to the frame the project page opens
on — the newer of the two shots, cup at one edge and box at the other — and that
photograph is 1.4907 where the variant's is 1.406. The build's `cover` would have
taken 6% off the sides of exactly the picture that has something at both of them,
so the box follows the photograph. Only the height moved: the **width is the
design's 744**, so the plate still sits in the row at the width every other
preview uses. When the variant is redrawn the two agree again.

One plate moves. **Studio Edit 02** is a `<video>` rather than an `<img>`, wearing the
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

### The dark panel and its accents — removed

> **This section is provenance, and the accents have since come back.** The
> sideways deck template is gone for good — both presentations became rails, and
> `src/deck-page.css`, `src/deck-page.js` and `src/project-deck.js` went with
> them. The cyanotype squares left with it and then returned, on the two still
> pages, where the redrawn designs tuck them behind the artwork; see *The still
> project pages*. What is built now is `assets/accent-cyanotype-wash.png` and a
> third plate, `-leaf.png`, and the build applies **no** edge inset — that was
> `print`'s fault and `print` is not among them. What follows is kept because the
> reasoning — how the two plates were
> derived, why they are two grades and not one photograph lightened, why the
> build insets a pixel off every edge — is the part that would have to be redone
> rather than re-read. Everything here is recoverable from commit `c6fb04a`.

On the project pages the grey behind the slides was **one screen wide and it never
moved**. It is a `position: sticky; left: 0` flex item at the _head_ of the
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

### Slugs are titles

**Every project's slug is its title, kebab-cased.** The row's words and the URL
say the same thing, and that is a rule rather than a coincidence — a slug is a
public address, and one that disagrees with the page it opens is a small lie that
anyone reading the link can see.

Three of them used not to. `trend-authority` sat under "Trending This Week",
`su26-drop-2` under "Studio Edit 02" and `tea-boxes` under "Tea Boxes" — all
three because the slug was set from the landing index before the design named the
project. All three were renamed rather than left:

| was               | is                   |
| ----------------- | -------------------- |
| `trend-authority` | `trending-this-week` |
| `su26-drop-2`     | `studio-edit-02`     |
| `tea-boxes`       | `eight-immortals`    |

The third is the one where the **row's own words** moved too, and it is the
clearest case for the rule: the index said "Tea Boxes", which is what the work
is made of, and the design says "Eight Immortals", which is what it is about.
Renaming the slug without retitling the row would have left the address telling
the truth and the link text not.

A slug is not only the URL, so renaming one is not a one-line change. Each of
these moved in eight places at once, and the list is the checklist for the next
one:

1. `projects/<slug>/` — the page's directory, and so its address
2. `src/<slug>.css` — its placements, for the still pages that have their own
3. `assets/projects/<slug>/` — its whole source folder: `preview.png`, the
   `slides/` or `frames/` sequence, and any clip or poster beside them
4. `public/img/projects/<slug>/` and `public/img/projects/<slug>.webp` — generated,
   so they follow from the source names above
5. `public/video/<slug>*.mp4` — generated, same
6. `PROJECT_PAGES` in `vite.config.js`, or the page is served in dev and silently
   missing from the build
7. `PROJECTS`, `PAGES`, `PLATES` and `VIDEOS` in `scripts/build-images.mjs`, and
   `PAGES`/`PLATES`/`CLIPS` in `scripts/build-gallery.mjs`
8. `data-project` on the index row and `data-plate` on its viewer plate — the pair
   that ties a row to the artwork that lights when you hover it. These are matched
   by string, so a half-done rename shows up as a row whose hover does nothing
   rather than as an error.

**The source folders under `assets/projects/` are slugs too, and this reversed an
earlier decision.** They used to be named as the work arrived — `4 fastest rising
trends`, `Dexcom x SKIMS Confidence Underneath`, `Movement in motion 🖤 @skims …`
— on the reasoning that the arrival name is real provenance and nothing derives a
path from it, since `scripts/build-images.mjs` names every directory explicitly.

That held, but it made the build script a lookup table between a caption and a
slug, and it meant a source file could not be traced to the page it feeds without
opening that script. Provenance is better kept in prose that can say what it
means — the Figma node IDs and the Instagram captions are recorded in the notes
below and in the script — than in a filename that has to be read by a person
every time. So the folders follow the slug now, one per project:

```
assets/projects/<slug>/preview.png    the landing page's preview plate
assets/projects/<slug>/slides/        a deck's slides, numbered
assets/projects/<slug>/frames/        a reel's or a plate's frames, numbered
assets/projects/studio-edit-02/clip-1.mp4, clip-2.mp4, poster-2.png
```

The numbered sequence has to be in a subfolder rather than loose in the slug
folder: `listFrames()` takes a whole directory, filters by extension and sorts by
`parseInt`, so a `preview.png` beside `1.webp` would be swept in as a frame whose
number is `NaN`. `slides` and `frames` are the site's own two words — a deck has
slides, a reel and a plate have frames — and nothing reads the name, so the
distinction costs only accuracy.
### Eight Immortals — the reel

Package design for Shoukang's six-blend herbal tea line, and the site's **third
kind of project page**. Figma node `417:2418`. It is neither a deck nor a still
page: it reads **downward**, with the brief sitting still on paper at the left
and the work passing up the right, one frame to a screen, each snapped to the
middle of the window.

| what              | where                     |
| ----------------- | ------------------------- |
| the lead's width  | 419.586 — the column-5 line less the gutter and the word PROJECTS, the same edge the decks keep |
| the brief's top   | 222, the same line the decks start theirs on |
| frame 1, 3        | 825 × 553 and 821 × 551 — the product shots |
| frame 2           | 946 × 660 — the dieline |

**The axis turned, and that is the whole story of this page.** It was built as a
deck three revisions ago — one horizontal track, the brief travelling off the left
edge with it, a progress row underneath, a hand-over at the end. Almost none of
that survives a vertical reel: there is no track, no wheel to redirect, no
progress to report and no end to push past. So `src/reel-page.css` is its own
template rather than a modifier on the deck's, and what carries over is the
shape of the opening frame — the paper's width and the brief's line.

**Nothing here is scripted.** The snapping is `scroll-snap-type: y mandatory` on
the root, the panel stays put with `position: sticky`, and `src/reel-page.js`
mounts the address button in the bar and nothing else.

**No scrollbar.** The design draws none, and a native bar down the right edge of a
page whose whole right side is artwork reads as a seam in the picture rather than
as a control — the deck pages hide theirs for the same reason. It is a real trade
and not a free one: the bar is the only thing on screen that says how far down the
page goes, and it is also a thing you can drag. What is left is every other way of
moving — wheel, trackpad, touch, arrow keys, Page Up/Down, Home/End, the space bar
— none of which the rule touches, and the snap means all of them land in the same
places. The deck pages can afford it more cheaply because they draw their own
indicator; a reel of two or three frames is short enough that there is little to
indicate. The deck's whole module —
wheel redirection, progress arithmetic, the push gesture — is gone from this page
along with the axis it served.

**"When one is centred you cannot see the other two"** is the design's
instruction, and it holds by arithmetic rather than by tuning. Each frame gets a
screen exactly one viewport tall and is centred in it, so the next frame's centre
is one whole viewport below this one's, and its top edge is therefore
`100dvh − its own height / 2` below the centre of the screen — while the bottom of
the window is only `50dvh` below it. The neighbour is off screen for as long as
its height is less than the window, and the cap on `.reel__shot` is what makes
that true at every window size:

```
max-height: min(var(--shot-h) * 1rem, 100dvh − nav − 2 × 40)
```

The cap subtracts the bar as well as the air, which buys a second property for
free: a frame can never slide under the locked nav, however short the window.
Measured at a 1470 × 835 viewport, exactly **one** frame is on screen at each of
the three snap positions, and all three render at the design's own sizes.

**The width follows the height, and nothing states the ratio.** `width: auto`
against a `max-height` keeps the picture's own aspect, and the delivered file
already has its box's shape — so the markup only ever carries a height. That is
`--shot-h`, an inline custom property on each `<img>`, the same way the landing
page's previews carry their own leaf box.

**The boxes are per frame**, which is the one place a reel differs from a deck in
the build. A deck delivers every slide into one box because every slide is the
same shape and the same size on the page; a reel's frames are separate pieces of
artwork, and the design gives each the size it needs to be read at — the dieline
is drawn half again as large as the product shots, because it is a flat covered in
small print and they are photographs of a box. `REELS` in
`scripts/build-images.mjs` holds those boxes, keyed by the source's stem, and
writes them into `scripts/.manifests/<slug>.reel.json` alongside the frame names;
`scripts/build-gallery.mjs` reads that and writes both the `<img>` and the screen
around it. The height therefore lives in exactly one place and sizes both the
delivered file and the element.

The reel build **crops** where the deck contains, and that is deliberate. On a
deck the box is the slide's own shape, so contain and cover are the same operation
and contain is the safer word. Here the box is the shape the design draws the
frame at, which is not always the photograph's: the six-box collection is a 4:3
source shown in a 1.49 box. Its top and bottom five per cent are empty
background, so the crop loses nothing and lets the boxes read larger — and baking
it once at build time is better than an `object-fit` rule the page has to carry
for one frame out of three.

**One departure from the frame.** The design centres each picture in a band with
37.594 above and 77.594 below — the deck's own insets, the second of which was
the progress row. There is no progress row on a reel, so the frames are centred
in the **window**, which is what "centred" means and what `scroll-snap-align:
center` gives for free. It puts frame 1 at 141 where the design draws 121.

**And one walk-back.** Making this page a deck had parameterised the slide box in
the deck template as `--slide-ratio` / `--slide-h-design`, so a 3:2 deck could
restate them. With the page no longer a deck, the remaining decks were 16:9 again
and a parameter with one value is a claim that something varies when nothing does
— so the ratio went back to a constant and `src/eight-immortals.css` was deleted. The
two decks render pixel-identically either way; that was checked rather than
assumed.

**SHOP points at the shelf**, where the other pages' source lines point at a
write-up, a notebook or a repository. The work is packaging, so the honest place
to send someone is the product it wraps — and it is the *collection*,
`/collections/herbal-tea-bags`, rather than `shoukanghealth.com`: the collection
is the line this project is, six blends in boxes and sachets, where the storefront
may not be showing any of it.

The brief also carries the site's first `<cite>` — *The Yellow Emperor's Classic
of Medicine*, a book title, which is the one thing `<cite>` is for. It comes out
italic on its own: the serif's italic face is declared in `styles.css` and the
Spectral standing in for it is loaded with its italic in this page's `<head>`.
Nothing sets `font-style`.

Two paragraphs where the deck pages have one, so they are wrapped in
`.brief__prose` — which takes the brief's own 20 as one child, keeping that air
between the facts and the copy, and sets the design's own **10** between the
paragraphs instead. It used to be *ruleless*, with no air between paragraphs at
all, on the reading that a brief is one block in which every line is indented.
The designs do not draw that (node `451:4078`): the **opening paragraph is
indented and the rest are flush**, with the 10 separating them, which is the
ordinary arrangement — an indent marks a paragraph against the one before it, and
the first has nothing before it. `.brief__text:first-child` carries the indent.

It used to be `.page__prose` and live with the still page; it is the **brief's**
gap it redirects and every surface has the same problem, so it moved to
`project-brief.css` and the still page's two uses moved with it.

**Below 768** the two columns become one: the brief takes a screen of its own and
the frames follow it down, still one to a screen and still snapped. Three things
change with the axis, and each is a bug that was found rather than a preference.
The lead stays `position: relative` rather than going `static`, or the footer's
`bottom: 0` resolves against the viewport and the copyright line detaches from its
paper to ride the bottom of the window over the photographs. Its snap alignment
becomes `start`, because this is the only screen whose content can be taller than
the window and centring something taller than the viewport strands both its ends.
And the brief takes the absolute placement's offsets back as padding — including
a bottom one, without which a brief that outgrows the screen grows *under* the
copyright line instead of above it.

### Shop Every Store — the second reel

A marketplace page on phia.com, and the second page in the reel format. Figma
node `437:2637`. It adds no stylesheet and no template: `src/reel-page.css` is the
whole layout, and what differs between two reels is the size of their frames,
which travels on the elements as `--shot-h`. Two frames rather than three — the
desktop page at 825 × 587 and the same page on a phone at 309 × 671, both
rendering at exactly those sizes and one to a screen.

**Its two sources are the one part of the pipeline that is not automatic.** Every
other image on the site is built from a photograph in `assets/`; these two are
Figma's own 2x exports of a browser and a phone mockup, dropped in by hand. That
is not a preference — the MCP screenshot of a node comes back at the size the node
is *drawn* and will not render larger, so the first pass shipped 1x sources and
said so in the build's scale column. Re-exporting by hand is what gets 2x, and it
is a manual step if the mockups change.

**Both are used whole**, and that is a deliberate reversal. An earlier pass
cropped each to the box the design draws — 825 × 587 and 309 × 671 — which meant
taking a few pixels of bezel off the phone and dropping the browser's shadow
altogether. The files now go through uncut, so each frame's `--shot-h` is the
export's own height rather than the design's, and the delivered file is
dimensionally identical to the source: the box is stated as the source's own
half-size to the half unit (1081.5 × 1122.5 and 346 × 707) so the scale lands on
exactly 2 and `cover` becomes the identity.

**The cost lands on the browser, and it is worth knowing.** Its canvas is 45% drop
shadow below the window, so fitting the whole file into one screen renders the
window about a third narrower than the Figma frame shows it — 527 against 825 at
an 835-tall viewport, with the shadow tail filling the space beneath. The phone
pays almost nothing: 94% of its canvas is device, so whole and cropped differ by
a few pixels of bezel. Trimming only the fully transparent margin would recover
the browser's size without touching the artwork, if that trade is ever wanted.

**The first paragraph is short of where it was going.** The design's own text ends
mid-clause — *"…In one click, Phia "* — with the sentence unwritten and a trailing
space where the rest should be. Its two complete sentences are set on the page and
the dangling clause is not: a portfolio page that stops mid-sentence reads as
broken rather than as unfinished. Put the clause back the moment it has an ending.

The SHOP line points at `phia.com/shop`, which is the design's own address rather
than a guess — it is what the browser mockup in the first frame has in its address
bar, and the paragraph names the same site.

### Confidence Underneath — the rail

Figma node `455:4163`, and the **fourth** kind of project page after the deck,
the reel and the still. It is the only one whose two halves are read on different
axes: the brief centred on paper and read downward, then the presentation on
charcoal and read sideways. `src/rail-page.css` is the template,
`src/project-rail.js` is the lock, `src/rail-page.js` is the entry.

**Both presentations are rails**, and they are the same layout twice — Confidence
Underneath came first, MFW Color Trends followed, and `src/rail-page.css` and
`src/rail-page.js` are shared with nothing placed by hand on either.

**Both used to be decks**, and the axis did not turn so much as the composition
did. As a deck the brief sat on paper at the left and the slides on a charcoal
panel at the right, both on one screen. The brief is now *above* the work rather
than beside it, which hands the presentation the whole window — and that is what
let the slides grow half again, from the deck's 826.66 box to **eleven columns,
1309.17 × 736.4**.

When the second page left it, the deck template had no callers, so it was removed:
`src/deck-page.css` (787 lines), `src/project-deck.js` (733) and `src/deck-page.js`
(10), plus the accent build step and both accent sources, which nothing drew any
more. All of it is in commit `c6fb04a`.

#### The rail's numbers are the grid's, and the design's were not

The lead was already on the twelve-column grid and is written as such: the
design's 101 top offset is one column (100.83), its 1430 brief is twelve, its 946
paragraph measure is eight (946.67), its 100.83 fact track is one. Those agree to
within two thirds of a unit — the grid rounded for a designer's hand.

The rail's did not agree, and the reason is that the frame was drawn by **scaling
the old sideways deck up by 1.5226**: 826.66 × 1.5226 = 1258.66, and the deck's 40
gutter × 1.5226 = 60.90. Those are artifacts of a scale factor rather than
measurements, and 1258.663 falls between ten columns (1188.33) and eleven
(1309.17), on no line at all. So the slide is **eleven columns** — the nearest
column line, and the one on the larger side — and the gap is **three gutters**,
60 against the design's 60.903.

A 16:9 box can put only one of its two dimensions on a column line. Width leads,
because the page grid is horizontal.

Eleven columns is a *twelve*-column number, and below 768 the grid is **four** —
`--grid-columns` changes at that breakpoint. Asking for eleven of four columns is
asking for 1005 on a 390 screen, which is exactly what it gave until the narrow
block overrode the slide to the full measure.

**Nothing had to be re-exported to make the slides bigger.** The sources are
3840 × 2160 and the new box needs 2517 × 1416 at 2×, so it still delivers a full
2× with headroom to spare — the build reports `17 slides at 2.00x`. The delivered
set went from 2.3 MB to 3.8 MB for 2.24× the pixels.

#### How the lock works, and why it is not the deck's

The deck page is its own horizontal scroller and takes the wheel over: it calls
`preventDefault` on every vertical notch and adds the distance to `scrollLeft`.
That works, but it is scroll the browser is not doing — no momentum, no keyboard,
no scrollbar, and the page has no vertical axis at all.

The rail keeps **one axis, the document's own, and never calls
`preventDefault`**. `.rail` is a tall section; `.rail__pin` inside it is one
window tall and `position: sticky`, so it stands still while the section's extra
height passes under it. The module reads `scrollY` and writes a transform:

```
travel = the track's extent less the window's
.rail   is 100dvh + travel tall
p       = (scrollY - railTop) / travel        0 → 1 while pinned
track   is translated by -p * travel
```

**One screen of scroll buys one slide.** At 1470 × 1078 the rail costs 18326px of
scroll — exactly 17 steps of one 1078px window — while the track travels 23276px,
so it moves about 1.27× the rate of the finger, which is under the threshold where
it reads as a speed rather than as a scroll.

The pin is real: the same `position: sticky` the reel page pins its brief with,
and the scrollbar, the keyboard, a trackpad's momentum and a phone's fling all
keep working.

That it comes out exact is the centring's doing. The track is padded at both ends
by half of what the window has left over once the slide has taken its eleven
columns, so **the first slide and the last centre on the same terms** and the
travel reduces to `(items − 1) × stride`. Every slide's centred position is a
whole multiple of one stride, and there is no accumulated drift by the
seventeenth. The end card is given the slide's own width for the same reason: a
narrower last item would make the final step short, and the pair would arrive
off-centre.

#### It does not lock, and a sideways swipe drives it

**There is no snapping.** The rail carried `scroll-snap` stops for a while — one
zero-size anchor per slide, laid down the rail at the offsets that centre each
one — and they are gone. A stop per slide is the strongest form of *this page is
driving*, and the reading is better without it: the slides pass at whatever rate
the reader chooses and nothing takes the scroll back off them.

**One screen of scroll still buys one slide**, and that step outlived the snap it
was introduced for. It bounds the page at one window per slide, which is both
predictable and shorter than the track is wide — 18326px of scroll against 23276px
of travel, about 1.27× — and it makes the keyboard land squarely: Page Down and
the space bar move about one viewport, so here they move about one slide. Under
the 1:1 mapping this page used first, a Page Down covered four fifths of a slide
and every press left the row further out of true than the last.

**A two-finger sideways swipe is the one event this page takes over.** A
horizontal wheel delta here has nowhere to go — the document does not scroll
across and the pin's overflow is hidden while pinned — so the browser's response
to `deltaX` is to discard it. Nothing is taken away from the reader; a gesture
that did nothing is given the obvious meaning. Only the dominant-horizontal case
is claimed, only while the rail holds the screen, and the delta is handed back as
a scroll of the *page* rather than as a transform, so it goes through the same
`scrollY → translate` path as the wheel and cannot become a second source of
truth for where the track is.

#### Two things the geometry got wrong first

Both were silent, and both are worth keeping written down.

`img { max-width: 100% }` in `styles.css` is right everywhere else on the site
and wrong on a scroller. It resolves against the flex container's *content* box —
the window less the track's two insets, 1242 at 1470 — so every slide was capped
16.7 short of the 1258.663 the design draws. A 1.3% squeeze reads as nothing
until you measure the ratio and find 1.754 where 16:9 is 1.778. `.rail__slide`
sets `max-width: none`; the row is meant to be wider than its container and
nothing in it should be fitted to the window.

A flex container's **`scrollWidth` does not count its trailing `padding-right`**
when the content overflows. The travel came up exactly one `--rail-inset` short,
and the symptom was the end card clipped against the right edge of the window at
the very bottom of the rail. `measure()` now takes the extent from the last
child's right edge plus the computed trailing padding.

### The still project pages

Two of the five project pages are still, two are decks and one is the reel above.
A **still** page is
one screen with no scroll axis of its own, the work shown as one or two pieces of
artwork beside the brief.

`src/still-page.css` is what they share — the page grid, the brief's column and
its footer, the pager and the accent box — and each page's own placements are in
its own stylesheet, because unlike the decks the still pages are not the same
layout twice:

> **Read this before the detail below.** These two pages have been redrawn, at
> nodes `485:83` and `463:4384`, and the current reading is:
>
> - **Twelve columns of paper across the window.** The brief is in columns 9 to
>   11 and the work takes the left six or seven. The intervening revision — a
>   fixed 419.59 paper column at the left with the artwork centred in the leftover
>   window, described at length below — is gone, and so is the `.still__lead` /
>   `.still__stage` split that carried it.
> - **"Still" now means the WORK is still, not the page.** The brief is the only
>   thing in the flow, so the document is as tall as the copy; the artwork, the
>   accents, the footer and the pager are pinned and hold their place in the
>   window while it scrolls past. `--pin` is both an element's offset and its
>   sticky stop, so a pinned thing cannot drift between the two. A page whose
>   brief fits still does not scroll, which is why Studio Edit 02 reads exactly as
>   it did.
> - **Both briefs start on the same line, 342.5.** They did not before: a
>   shrinkable spacer used to slide a long brief up toward the bar to keep the
>   page to one screen, so Trending This Week opened on 117 and Studio Edit 02 on
>   342.5. The spacer is gone — the copy that does not fit is scrolled to instead.
> - **The cyanotype accents are back**, and drawn differently: not floating on the
>   sheet but tucked *behind* the artwork, each square straddling one of its edges
>   by exactly one column. Two on Trending This Week, one on Studio Edit 02. The
>   plates are built again — `accent-wash` from the pale grade, and a third plate,
>   `accent-leaf`, that was never in the earlier set.
> - **What survives unchanged** is the shrinkable spacer above the brief's title
>   and the height cap on the artwork. Both are documented where they live.
>
> Everything from `#### Trending This Week` down describes the earlier revision
> and is kept as provenance. The stylesheets are the current reading.

| page                    | node       | directory                  | placements                |
| ----------------------- | ---------- | -------------------------- | ------------------------- |
| **Trending This Week**  | `485:83`   | `projects/trending-this-week/` | `src/trending-this-week.css` |
| **Studio Edit 02**      | `463:4384` | `projects/studio-edit-02/`     | `src/studio-edit-02.css`     |

One module entry serves both, `src/still-page.js`. Every mount in it looks for
its own hook and returns immediately if the page has none — Trending This Week
has a cycling plate and no video, Studio Edit 02 has clips and no plate — so the
cost of sharing is one `querySelector` per page for the thing it does not have,
and a third still page needs no new entry file and cannot forget to mount the
address.

#### Trending This Week

The work was a weekly Instagram series, so what there is to show is one plate and
the account it ran on. Drawn at 1470 × 835.

Its layout is **twelve columns and twelve rows, and a row is a column tall** —
the rows are what the columns would be if the page were square: same 20 margin,
same 20 gutter, measured down the page instead of across it. So the module is a
square, and `--col-step` is the one unit both axes are counted in. That is the
same lattice the deck accents sit on (see above), used here for the whole layout
rather than for two decorations.

The plate is in the **middle** and the copy is **split around it** — the head and
the opening two paragraphs down the left, the closing two and REFLECTION down the
right, with a cyanotype square tucked behind each of the plate's outer corners:

| block | design x, y | lands on                                     | resolves to    |
| ----- | ----------- | -------------------------------------------- | -------------- |
| head  | 22, 242     | cols 1-3, row 3                              | 20, 261.7      |
| wash  | 420, 261    | 2 cols square, row 3, ⅜ of itself clear of the plate's **left** edge | 420.2, 261.7 |
| plate | 503, 141    | cols 5-8, row 2                              | 503.3, 140.8   |
| print | 749, 456    | 3 cols square, ⅜ clear of the plate's **right** edge, hanging two gutters below its bottom | 752.6, 456.1 |
| tail  | 1109, 389   | cols 10-12, row 4                            | 1107.5, 382.5  |

**The columns are the composition.** The plate takes four in the centre and the
two blocks of copy take three each at the outer edges. Column 4 and column 9 are
the air between the copy and the work, one on each side, and the design's 22, 503
and 1109 are the column-1, column-5 and column-10 lines to within two units.

**The copy is split, not reflowed.** It was one six-column block on the right —
a head with two columns of prose side by side beneath it, at columns 7–9 and
10–12. Those two columns are now the two sides of the page, and each keeps the
brief's own three-column measure, so nothing about how the paragraphs set has
changed; only where they are. The block that held them is gone, and so is the
two-track grid inside it: the left side is a title, its facts and its prose in one
column, which is exactly what `.brief` is on the deck pages, and the right side is
a bare `.page__copy`.

**The two rows are a step apart**, 261.7 and 382.5, and that stagger is the
design's: the right-hand column starts one row below the left so the page reads as
two descending steps around the plate rather than as a pair of matched columns
with a picture wedged between them.

The plate's **height** is the one thing deliberately *not* on the lattice: it is
the photograph's 3:4 ratio, so four columns at 463.333 wide is 617.78 tall, where
the design drew 462 × 616. Neither accent's **left** is on it either — both are
measured off the plate, see below.

Rows 1–3 are declared as **fixed** tracks and the rest are **automatic**, and
this is the page where choosing which is not obvious, because it has copy on
*two* row lines instead of one. A fixed track ignores what is in it, which is what
lets the plate be 617 tall in a 100-unit row without dragging row 3 down the page.
Row 3 has to be fixed as well, and that part is this page's own: the head is in
row 3 and the tail is in row 4, so a row 3 that grew with its copy would carry row
4 down with it — the right-hand column's line would be set by how the *left*
column happened to wrap. The two are side by side and three columns apart; neither
should move the other. So row 3 keeps its line and row 4 is the one that gives way.

What that costs is worth stating plainly: long copy on the **left** overflows row
3 rather than growing the page. The slack is real — the left block runs to about
620 against the footer band's 797, nine or ten lines of give — and the `min-height`
below holds the footer under the plate whatever the copy does. Copy on the right
still grows the page, because row 4 is automatic.

Because the plate outruns the grid's own content — the copy ends well above the
plate's 758.6 — `.page` carries a `min-height` of the plate's bottom edge, written
as the derivation so the footer clears the photograph at every width rather than
only at 1470. At the design's own aspect the page is exactly one screen: footer
bottom on 835, nothing to scroll.

**The accents — two of them now**, nodes `405:2238` and `405:2237`, on opposite
corners of the plate: the small pale one at its top-left, the large deep one at
its bottom-right. Which plate each carries was not a judgement call. The design's
two exports have mean RGB 172,210,225 and 94,163,204, which are the `wash` and
`print` files this site already builds, to a tenth of a level. So the page adds no
asset; it names two, and `/img/accent-wash.webp` and `/img/accent-print.webp` were
already built at 720 square.

Naming them is also what makes them **visible**, and that is a fix rather than a
flourish: the markup here carried a bare `.page__accent` with no plate modifier,
and `.page__accent` sets no `background-image` of its own, so the one square this
page was supposed to have was an empty box painting nothing. It had been that way
since the still-page template split the plates into `--print` and `--wash`.

Neither **left** is a column line and neither should be. Both are measured off
the plate, because that is what the relationship is, and both show **three
eighths of themselves clear** of it — a wider sliver than the fifth the deck
pages leave, and the design says so twice: 83 of 221.7 on the left and 126.5 of
342.5 on the right, which are 0.374 and 0.369. One of those is a nudge; two that
agree to half a percent are a rule. Three eighths puts them at 420.2 and 752.6
against the design's 420 and 749.

The wash square's **top** is the same row-3 line the head starts on, so the square
and the title begin together — which is also one grid step below the plate's own
top, the two readings being the same arithmetic on a plate that sits on row 2.

The print square's **vertical is measured off the plate's bottom edge**: it hangs
two gutters below it. Not off the footer band, though at the design's own 835-tall
window the two are within a unit of each other — 798.6 against 797.4 — and the
band looks like the anchor. It is not, and the difference shows on a tall window:
the plate is held by a row line at the top of the page and the band is held by the
bottom, so a square tied to the band would drift away from the plate as the window
grew and end up floating in the empty paper above the footer. Tied to the plate,
the pair holds its shape at every height, which is the whole point of a square
that peeks out from behind something. Two gutters is also the tighter reading of
the design: 798.6 against its 798.5, where the band is a unit out.

Both are absolutely positioned for the same reason `.deck__accent` is, and first
in the source so they paint under the plate with no `z-index` involved.

Below 768 both are gone. The plate takes the whole measure down there, so a square
placed three eighths clear of it would be three eighths off the edge of the page,
and one tucked fully behind it would be invisible. The deck pages re-count their
squares' columns for narrow because they have a screen of dark to place them on;
this page has neither the room nor the ground.

The plate is a **cycle**: ten frames of the carousel in one box, cut from one to
the next every 1.4s, so it reads as the post moving. `src/plate-cycle.js`. A gif
in effect and not one in fact — GIF is 256 colours and these are photographs. All
ten frames are in the markup with their own `src` and all but one is hidden with
`visibility`, which is the arrangement the landing page's project viewer uses and
for the same reason: swapping one `<img>`'s `src` would gamble on the next file
being decoded when the beat lands, and a blank frame in a ten-frame loop reads as
a broken image rather than as a cut. The box is a link to the post, so the
accessible name is on the first frame alone and the other nine are empty-alt and
`aria-hidden` — the name of that link must not depend on which photograph happens
to be showing. `prefers-reduced-motion` holds frame 1, and the cycle stops in a
background tab rather than being throttled into a lurch.

**The inline link.** The partner view is linked from the clause that says what it
does — *"We used it to start giving brands real insight into their shoppers,"* —
which is where the design now draws it. An earlier pass had the design's older
arrangement, `See here` followed by the URL in brackets, and both are gone: an
address set in the same serif at the same size is a thing to be typed out rather
than followed, and "see here" is a name that tells anyone listing this page's
links nothing. `.brief__inline` is the one link on this site underlined at rest,
because a link set inside a paragraph of the same size and colour is invisible
until the pointer crosses it.

It is also the one place the site's `0.28em` underline offset is *not* used, and
that is deliberate rather than an oversight. 0.28em was tuned for the standalone
labels it was written for — 10 and 11px uppercase Inter, one word in its own
cell, where the offset has empty space beneath it and reads as a considered gap.
On 16px serif prose it is about 4.5px below the baseline: it clears the
descenders entirely and leaves the rule floating nearer the *next* line than the
words it belongs to, and on a link that wraps to two lines, as this one does, the
first line's rule sits almost against the second line's ascenders. So this takes
the design's own `from-font` for both position and thickness, with
`text-decoration-skip-ink: none` so the line runs through the descenders in
"giving" and "shoppers" as one continuous rule rather than breaking around them —
which is what the design draws.

One departure from the design remains: the plate, which the design draws as a
flat image, is the cycle and the link.

This page was `trend-authority` until the design named it. See **Slugs are
titles** below.

#### Studio Edit 02

Creator strategy for the NikeSKIMS SU26 drop, and the work is the reel — so the
page is **two portrait clips, side by side and staggered**, with a cyanotype
square tucked behind the leading one and the brief off to the **left**. Drawn at
1470 × 835, node `345:1790`. Positions below are artboard coordinates; the offsets
in the rules are 20 less, because the sheet carries the margin as padding.

| block  | design x, y | lands on                                    | resolves to     |
| ------ | ----------- | ------------------------------------------- | --------------- |
| brief  | 20, 245     | cols 1-3, row 3                             | 20, 261.7       |
| accent | 626, 138    | 2 cols square, row 2, centred on clip 1's left edge | 634.2, 140.8 |
| clip 1 | 750, 76     | cols 7-9, one grid step above clip 2        | 745, 67.6       |
| clip 2 | 1111, 183   | cols 10-12, bottom on the footer band       | 1107.5, 188.4   |

**The revision that put the copy on the left was a mirror and nothing more.** The
pair of clips used to sit flush left at columns 1-6 with the brief at columns
9-11; now the pair is flush right at columns 7-12 and the brief takes columns 1-3,
which is where every deck page starts theirs — so all five project pages open on
the same column-1 line. Every relationship *inside* the composition survived it:
the clips are still adjacent with one gutter between them, the stagger is still
one grid step, and the accent still straddles the leading clip's **outer** edge —
the one facing away from the other clip, which the mirror moved from its right to
its left. What changed is which columns are empty: 4-6, between the copy and the
work, where before it was column 12 alone at the far right. The markup was
reordered to match, brief ahead of the clips, so the DOM reads in the order the
page does — and so the narrow layout, which is those blocks stacked, opens on the
project's name rather than on two silent videos of someone it has not introduced.

**The columns are exact.** Both clips are three columns, adjacent, with one
gutter between them — 725…1067.5 and 1087.5…1430 of the measure — and the pair
now ends *on* the right margin, where the design's 1111 + 342 overhangs it by
three. The design's 20, 750 and 1111 are the column-1, column-7 and column-10
lines to within five units.

**The vertical is anchored to the footer band**, and that is the design's own
arithmetic rather than a shortcut. A clip is three columns at 9:16, so 608.9
tall, and the band between the bar and the footer is 759.8 — there is no pair of
row lines 120.833 apart that fits a 609-tall clip *twice* in 759.8, because the
second would run off the bottom of the screen. What the design does instead is
put the lower clip's bottom **on** the footer band's top edge and lift the other
by exactly **one grid step**. The pass before the mirror gave 188.4 and 67.6
against its 189 and 67 — a match to six tenths of a unit, tighter than anything
else in that frame, so it is the rule and not a coincidence. The mirrored frame
redraws the same pair at 183 and 76, a looser hand, and the rule is what the page
keeps: the band and the clip height have not moved, and nothing else in 759.8
fits. The twelve rows are still what the stagger is measured in. In CSS it is two
`bottom` values, `0` and `var(--col-step)`: `bottom: 0` of the sheet *is* the top
of the footer band, since `.foot` is the next thing in the flex column.

Because the clips hang off the bottom, the sheet's height is what decides where
their tops land, so `.page` carries a `min-height` of the bar, the margin, the
step and a clip — 787.4. At the design's own 835-tall window the sheet is 797.4,
so nothing binds and the upper clip sits at 67.6 where the design drew it; on a
shorter window the sheet holds 787.4 and the page scrolls rather than sliding the
artwork under the bar.

**The brief is again the one figure the design had not snapped**: it sits at 245,
where the row-3 line is 261.7. Row 3 is nonetheless the line it was reaching for,
and the block's own height says so — it is 415 tall with its paragraph in, and 415
started on row 3 ends 120.7 above the footer band, which is one grid step. The
design's own 245 leaves 137.4 there, and 137.4 is no number this grid has. Same
hand as the pass before, drawn short of the line it wanted.

**The accent** is node `377:1971` and the `wash` plate — the pale second
exposure, whose fill matches the built plate exactly (mean RGB 172,210,225 for
both, against `print`'s 94,163,204). Two columns square, where Trending This
Week's is three, and **centred** on the upper clip's left edge rather than showing
a fifth of itself clear: the column-7 line less half the square is 614.2 of the
measure, against the design's 606. That is a different rule from the deck pages'
fifth-clear, and deliberately — there a square hides behind a wall of slides with
one edge exposed; here it is the one piece of colour between the copy and the
work, and centring is what gives it the same weight on both sides of the edge it
sits on. It is written off the same `--clip-1-left` the clip is, so the
half-and-half holds at every width.

**The clips autoplay, silently, on a loop, with no controls.** `autoplay`,
`muted`, `loop` and `playsinline` are all **attributes in the markup**, because
that is the only place they count: every browser gates autoplay on the element
being muted at the moment it decides, which is before any script runs, so a video
muted by script is a video that has already been refused — and without
`playsinline`, iOS takes the clip fullscreen instead of playing it in place.
`preload="auto"`, against the site's usual restraint, because these play on
arrival and there is no later moment at which to fetch them; the landing page's
one moving preview is `preload="none"` precisely because it waits for a hover
that may never come. No `controls`: they are artwork on a page, not media someone
came to watch.

`src/video-autoplay.js` handles only what the markup cannot express — a refused
`play()` promise (caught and dropped, so a declined autoplay is not an unhandled
rejection in an otherwise working page), a hidden tab (paused, since two
720 × 1280 loops decoding for nobody is heat), and `prefers-reduced-motion`. That
last one needs more than a pause: `autoplay` is a standing instruction the
browser acts on whenever the element has buffered enough, so the attribute is
taken *off* the element and only then paused. The honest cost is that the module
is a deferred script, so on a reduced-motion machine a clip may show a frame or
two of movement before it stops — the alternative, leaving `autoplay` out of the
markup entirely, would trade that for a page whose artwork never moves without
JavaScript, and on a page whose subject *is* the motion that is the worse bargain.

**The two clips are two different takes**, and that is worth stating because the
Figma layer names suggest otherwise: both are called *Movement in motion 🖤 …*
with Figma's ` 1`/` 2` duplicate suffix, which normally means one asset placed
twice. It is not. Frames sampled across the reel in `assets/` show thirty-six
seconds of one continuous mat sequence — grey wall, black mat, dumbbells — with
nothing resembling the design's lower block, which is shot on a reformer in front
of sheer curtains. Two files, and the second arrived under its own Instagram
caption; `VIDEOS` names both.

**The paragraph is still missing and the page ships around it.** The Figma frame
draws one, but the copy in it is Confidence Underneath's, carried over when the
frame was duplicated — 7.7 million people with diabetes, continuous glucose
monitors, Dexcom x SKIMS. That is the wrong project's text, and setting it under
NikeSKIMS / Creator Strategy would be worse than an empty space, so the space is
empty; the block is styled and placed for it, between the facts and the source
line, and row 4 grows to hold whatever it comes to.

Everything else is there, REFLECTION included, and the row is live: a page
missing one paragraph is still a page, and one that cannot be reached is not.

## Assets

`assets/` holds the sources; `public/img/` and `public/video/` are generated from
them by `scripts/build-images.mjs` and are disposable.

| source                               | used for                               |
| ------------------------------------ | -------------------------------------- |
| `assets/hero-cyanotype.png`          | the landing plate, at 1600 and 1080 wide |
| `assets/projects/<slug>/preview.png` | one per project, rendered at 2× its leaf box — and, where the project has them, also the plate's cover frame and slot 1's clip poster |
| `assets/projects/<slug>/slides/`     | one folder of slides per deck page, delivered whole into a 16:9 box |
| `assets/projects/<slug>/frames/`     | a reel's frames, each into its own box — and the Trending This Week plate's, see note 6 |
| `assets/projects/studio-edit-02/clip-<slot>.mp4` | the clips, copied under their delivered stems — see note 7 |
| `assets/projects/studio-edit-02/poster-2.png` | slot 2's poster, which slot 1's cannot stand in for — see note 7 |

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
   frame rather than reassembled in HTML. `studio-edit-02` is a _video_ fill, and the
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
   used to sit in `assets/` unbuilt — the plates the third accent was drawn in
   before it was taken back out. **They are out of the checkout now**, on the
   grounds that a source nothing has ever built is not a source, it is a file.
   Re-export from those nodes if a third accent is ever wanted, and add them to
   `ACCENTS` in `scripts/build-images.mjs`: they are paler than these two and are
   different _subjects_ rather than different grades, which is why they were named
   for what is in them where the first two are named for their tone, and it is
   also why neither of the two that remain stands in for them.

   Both were delivered at 720 square, which is 2× the largest square the deck
   drew (three columns and their gutters, 342.5 units), and the one- and
   two-column squares were the same file scaled down. **Nothing draws them now**:
   the still pages gave theirs up when they went to paper, and the deck pages went
   with the template when both became rails.

   **A one-pixel inset comes off every side in the build**, and it is a fix. The
   print plate carries a dark rim baked into its left and right edge columns by
   Figma's export — one pixel each, mean brightness 42.5 and 44.7 against 125.0
   and 154.0 for the columns beside them; rows are clean and the wash plate has
   no rim at all. It went unnoticed for as long as these were drawn only on the
   dark panel, where a dark hairline on charcoal is nothing. A still page briefly
   drew `print` on **paper**, and there it read as a black line ruled down the
   edge of the photograph — which is part of why those accents are gone, and why
   the inset stays: it is cheap, and it is the only reason the plates could ever
   be set on anything but charcoal. Downscaling does not remove it, it blends it: 720 came out
   with a 82,126,138 edge column against its neighbour's 152,197,211. Inset
   rather than sharp's `trim()`, which decides what a border is by colour
   similarity and would be a guess re-made per source; one pixel off all four
   sides is deterministic, costs the wash plate one clean pixel of 2446, and
   moves the delivered scale by 0.15%.

7. **The clips are copies, and `VIDEOS` is a list of slots.** sharp does not
   touch video, so every entry is a copy and a rename; the point is only that the
   delivered file keeps coming from `assets/` under the name the markup asks for
   instead of being a hand-placed orphan in `public/`. Each entry carries a
   `slot`, because a page showing more than one clip gives each its own placement
   — on Studio Edit 02, slot 1 is the upper block at columns 7-9 and slot 2 the
   lower at columns 10-12 — and a `name`, the delivered stem. Slot 1's stem is
   `studio-edit-02`, which is also what the landing page's moving preview points at,
   so the reel is delivered once and used twice.

   An entry used to be able to carry `start` as well, a fraction of the clip's
   own duration written out as `data-start` and seeked to on `loadedmetadata`, so
   two slots showing the *same* reel could be held at different moments instead of
   running in lockstep. **It is gone**, across all three files it spanned. No
   entry ever set it, so no `data-start` was ever written and the seek always
   returned on its first line — and the case it was built for is one this project
   has ruled out rather than not reached yet: Studio Edit 02's two slots are two
   different takes, which is stated a few lines above in the same file. Rebuild it
   if a page ever does show one reel twice.

   A slot whose source is not in the checkout is skipped and reported, exactly as
   an absent deck is, and `scripts/.manifests/<slug>.clips.json` then lists only
   the slots that resolved. `npm run gallery` writes one `<video>` per resolved
   slot between `<!-- clips:start -->` and `<!-- clips:end -->`.

   There is still no ffmpeg in this project, so there is no smaller rung and no
   generated poster: the 3.5 MB reel is delivered whole, and each slot's `poster`
   is a still already in `assets/`. Slot 1's is the project's own `preview.png` —
   Figma's first frame of that reel, which the landing preview is built from too,
   so it is named rather than copied to a `poster-1.png` beside it. Slot 2's is
   `poster-2.png`, captured from that clip's frame 0 through a headless browser,
   because the two takes are in different rooms and slot 1's still cannot stand
   for it.

6. **The plate's cover comes from somewhere else.** The Trending This Week
   carousel is ten slides and `frames/` holds nine of them, `2..10`. Slide 1 is
   the cover, and it is this project's own
   `assets/projects/trending-this-week/preview.png`, because the carousel's cover
   and the landing page's preview plate are the same photograph — same
   1080 × 1440 file, doing two jobs. So `PLATES` in `scripts/build-images.mjs`
   *names* it rather than `frames/` holding a 1.2 MB `1.png` beside the rest:
   sources live in the repository so Vercel can build from them, git does not
   delta binaries, and the duplicate would be permanent history. It is emitted as
   `1.webp` and listed first, which is both the carousel's order and the design's
   — the plate opens on the cover.

   The frames are delivered into a **five-column 3:4 box** (584.17 × 778.89),
   `fit: 'cover'` at q82 — 580 KB for all ten. The box was four columns until the
   plate was widened and hung off the right margin; see the head of
   `src/trending-this-week.css`. **They no longer reach 2×**, and the build says
   so: these are Instagram's own 1080 × 1440 export, 2× of the wider box wants
   1168, so the scale caps at **1.85×** and the frames are delivered at their
   native 1080 × 1440 with nothing resampled at all. Capping rather than enlarging
   is the rule every source here follows. A true 2× would need a re-export above
   1168 wide, which Instagram does not hand back. Deck slides `contain` instead,
   because a slide is a whole page and cropping it would take words off it; a
   plate is a photograph shown in a box of its own ratio, so `cover` crops
   nothing here.

   `npm run images` writes the frame list to `scripts/.manifests/`, and
   `npm run gallery` splices it into the page between `<!-- frames:start -->` and
   `<!-- frames:end -->` — the same generate-between-markers arrangement the
   decks' `slides` block uses, for the same reason: ten hand-kept `<img>` tags is
   how a page ends up pointing at a file that has been renamed.

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
