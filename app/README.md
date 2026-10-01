# Static Lenz edition

Astro renders the index, 374 letter pages and the reading guide. Python and Saxon/C
transform the source XML before each build; the browser never transforms XML.
Tailwind defines the theme, and `src/styles/global.css` styles the shared edition
classes. Source Serif, Linux Biolinum, Roboto Slab and Cormorant Garamond are self-hosted through Astro’s built-in local Fonts API. Font files live in
`src/assets/fonts/`; their notices live in the repository-root `licenses/fonts/` folder.
`astro.config.mjs` registers the variants and `Layout.astro` emits font CSS and
preloads the regular interface and reading fonts. This works entirely with the
static build, with no font service or browser JavaScript required. Linux Biolinum includes regular, italic, bold and
bold oblique (used for bold italic), downloaded from the [CTAN Libertine package](https://mirrors.mit.edu/CTAN/fonts/libertine/opentype/).

Third-party package and font notices are indexed in [../licenses/README.md](../licenses/README.md).
The build copies the complete root `licenses/` folder to `dist/licenses/`, including
the index and all notices. These files are served at `/licenses/…` in the deployed
site and build preview; the development server does not serve this extra folder.
The static page `/edition/lizenzen/` is generated from the license index at build
time and linked from the Impressum. It documents MIT for the original application
code, CC BY 4.0 for editorial content and XML data, and third-party notices.
Browser-delivered dependencies appear first, followed by build dependencies.
The notice checklist for the published site is in
[../licenses/WEBSITE-NOTICES.md](../licenses/WEBSITE-NOTICES.md).

## Run and build

Use a Node version supported by Astro 7 and Python 3.13. Install `uv` for
the Python workspace, then run from the repository root:

```sh
uv sync --project scripts/transform/python
npm --prefix app ci
npm --prefix app run dev
```

While the dev server runs, saving files in `data/xml/`, `data/xsd/`, or `data/xslt/`
automatically reruns the export and reloads the browser after it succeeds. Saves
are debounced, and exports run one at a time. Changes made during an export queue
another run. Export failures appear in the terminal and browser error overlay;
fixing and saving the source retries automatically.

For a production build and local preview:

```sh
npm --prefix app run build
npm --prefix app run preview
```

Deploy the contents of `app/dist/` to a static host. No server runtime or API is
needed. Builds regenerate `app/generated/`; both directories are ignored by Git.
The export script uses the workspace's Python virtual environment when present,
otherwise `uv run`. An unsuccessful export stops the site build.

GitHub Actions reuses the XML export when XML, XSD, XSLT, transformation code,
Python dependencies and the export runner are unchanged. The key includes the
runner platform and Python version; only an exact match is reused. GND summaries
are excluded from this cache and rebuilt each time. Cached `status.json` retains
the original XML export's commit and generation time; the site itself is built
again with its current build date. Missing, malformed or failed export metadata
causes a fresh transformation. Local exports always transform XML normally.
On a usable cache hit, Actions skips Python/uv setup, dependency installation,
XML validation, the Python test suite and XML transformation. Changes to Python
tests or fixtures also invalidate the export cache so those checks run again.

Actions also restores Astro's asset cache after installing npm dependencies,
using compatible dependency/configuration keys, and saves it after a successful
build. The entire site and offline manifest are regenerated for published changes.
Changes limited to `docs/` and the unpublished README files at the repository
root, `app/`, `scripts/transform/python/`, `seiten/` and `seiten/components/`
skip building and deployment. Workflow checks still appear for those commits.
Changes to `seiten/` content, `assets/`, `licenses/` (including its README), build
configuration and unknown paths still build. Manual workflow runs always build.

### Page titles and external links

Page titles start with `LKB –`: the catalogue uses the edition description,
letters use sender, recipient and the editorial human-readable date, and static
pages use their menu label. External HTTP(S) links open in a new tab or window.
The HTML middleware applies this during rendering, including links in Markdown,
letter content and card templates; internal links keep their normal behavior.

### GND information

After the XML export, `scripts/gnd.mjs` enriches people and places using their
existing `d-nb.info/gnd/…` IDs and the [lobid GND API](https://lobid.org/gnd/api).
It never matches entities by name or changes the editorial XML. Below the filter
controls and above the letter list, compact cards show available information and reference links for selected
people and places with GND data. The original removable filter pills sit beside the
heading; cards have no remove button. Cards occupy three equal columns, share the
height of the tallest card across all rows, and grow from 9rem up to 24rem. Long names and details end in
an ellipsis instead of scrolling; their full text is available on hover. Cards
are hidden below 960px while filter pills
remain available. Display names always come from the editorial XML. Life dates are
shown as birth–death, with `?` for one missing date and no date line when both are
missing. Occupations have no field labels. Places retain their geographic areas
and short description; these present-day records do not assert eighteenth-century
borders. Missing IDs or incompatible entity types show a pill without an information card.

Person cards offer GND, Wikipedia, NDB, VIAF and Kalliope, in that
order. Place cards offer only Wikipedia, GND and GeoNames, in that order. Links
appear when supplied by the record. Wikipedia prefers German and falls back to one other
available language. Duplicate URLs and obsolete GND aliases are omitted; the NDB
article anchor is preserved. No biography URLs are guessed. Reference
icons live in `assets/reference-icons/`, with provenance in `sources.json`. Sites
without a saved icon use the local database symbol. Builds and browsers do not
request remote icons.

Raw responses are stored in the ignored `app/.cache/gnd/` directory, independently
of the regenerated `app/generated/gnd.json` summaries. IDs are deduplicated, with
four requests in parallel. Successful responses stay fresh for 30 days; HTTP 404
responses for seven days. Expired entries use conditional requests if the service
provided ETag or Last-Modified headers. Network errors, rate limiting and server
errors get up to three attempts with exponential backoff; Retry-After pauses the
shared request queue. Each request has a ten-second timeout, and the whole network
phase has a 90-second budget. Cancellation of the export also cancels requests.
Temporary failures use previously saved data, or omit unavailable information on
a first build, and report a warning without preventing the edition from building.
Malformed responses never replace valid cache entries. Writes are atomic.

GitHub Actions keys the raw-response cache to the contents of
`data/xml/references.xml`. An exact cache hit reuses valid responses regardless of
age; a changed file refreshes all referenced IDs, using conditional requests and
previous responses as a fallback. Other XML and application changes only rebuild
the summaries. A refresh with unavailable or stale responses is not saved under
the new key, so the next run retries it. If GitHub evicts the cache, the next build fetches it again; missing
or corrupt entries are also fetched. Local exports retain the age-based policy.
Set `GND_CACHE_MODE=refresh` to refresh all IDs locally, or `GND_CACHE_MODE=reuse`
to reuse valid saved entries regardless of age. Delete an individual
cache file to force a refresh on the next `npm --prefix app run export`. Run
`node --test app/tests/gnd.test.mjs` for the network-independent cache/retry tests.
No API calls are made in the browser, so the panels also work with the downloaded
offline edition. Textual GND data are CC0; portrait images are not imported.

## Printing

The letter print button loads `@vivliostyle/core` on demand, passes a snapshot of
the current document and its styles to `printHTML()`, and opens the browser print
dialog after pagination finishes in a hidden iframe. The visible page is preserved.
The snapshot includes the current citation access date and hand styles, removes
scripts and live popovers, embeds stylesheet text, and supplies a base URL for
local fonts and links. The compiled styles are loaded on demand with the snapshot
helper, preserving Vivliostyle's paged-media rules without fetching CSS again.
It retains the self-hosted font faces and omits Astro's local-only screen fallback
faces, allowing native fallbacks if a font is unavailable.
The generated library and snapshot chunks are included in the offline asset cache.
Preparation disables the button and shows a status; failures allow another attempt.
Both print buttons display Vivliostyle’s pagination progress as a percentage and
page count. This measures content laid out, not elapsed time. A spinner remains
active during loading and final layout adjustments; the selection also shows
its downloaded-letter count. The progress hook is removed on completion or failure.
In Firefox, the prepared pages use a 297 mm print-height cap instead of Vivliostyle's `100vh`
cap, which clips page margins in Firefox's hidden iframe on single-page documents.
The native page margins are reset to zero after typesetting; the document margins
are already laid out inside each sheet. This avoids Firefox adding blank sheets
for the library's generated negative page margins.
After pagination, the hidden running-footer placeholder is removed so it cannot
affect Firefox's fit-to-page scale; the visible footer remains in the last margin.
These adjustments apply only in Firefox, detected through `-moz-appearance` support.
Chromium retains Vivliostyle's own page dimensions and zoom-based print layout.
The browser's own Print command still uses the native print stylesheet.

The catalogue's **Auswahl drucken** button appears below the list on the right
when there is no full-text query and the list contains letters. It fetches all
currently listed letters in their displayed order, with four requests at a time,
and prints one combined document. A cover headed “Inhaltsverzeichnis” precedes
the letters, with a subheading showing the year range or person/place filters
(OR within each category, AND between categories).
Index entries include letter titles, dates and resolved page
numbers. The cover/index may span several pages. Every letter starts on a new
page, with continuous numbering across the complete document and one footer at
its end. Hand styles and local anchor IDs are scoped to individual letters.
Citation access dates are set when the selection is prepared. Failed downloads
stop the complete selection and allow retry; they never produce a partial print.

The print stylesheet uses A4 pages with 24 mm top/bottom, 25 mm right and 21 mm left
margins, and page numbers where the browser supports CSS page-margin boxes.
Letter text, margin notes, apparatus and Edition content have an additional
25 mm right inset, giving them a 50 mm right margin. Headers and horizontal rules
use the wider page area. The rules below the letter metadata and above the footer
are black; there are no rules below the wordmark or above the apparatus. The date
and sender/receiver lines have a compact 0.5 mm gap. Disable the
browser's own headers and footers for the cleanest result.

Letters retain their LKB number, metadata, transcription, hands, apparatus and
citation. Source page numbers appear inline; hand names occupy a narrow right-hand
column alongside their marked passages. Margin
notes follow the letter directly, with their position descriptions and
without added page prefixes. The small apparatus text is limited to 80ch.
In-position notes stay at their source location. Paragraphs and individual margin
notes stay together on a page when they fit. Source icons remain visible beside
the date; date and sender/receiver names use the same 10pt size as the letter.
The citation stays in the apparatus independently of the footer. With Vivliostyle,
the footer becomes a running element at the end of the document and appears only
in the final page's bottom margin, above the existing page number. It does not
create a separate footer page. Native printing leaves it in normal flow.
The print citation heading is “Quelle”; the website retains “Zitation”. The bracketed citation
URL and access date occupy a separate line on screen and in print, with a dotted
underline on the URL. The print footer aligns CC BY with the project line and
links to the Jakob Lenz Archiv instead of the legal notice; its CC BY and
Theodor Springmann Stiftung text have no PDF links. Editorial
marks, erasures and source highlights are preserved even when background
graphics are disabled.
Navigation, popovers and temporary search/hand highlights are omitted.

The catalogue prints its current visible results and filter labels. Edition
pages print their full content without the sticky contents navigation. Screen
and print styles are kept separately in `src/styles/global.css` and
`src/styles/print.css`.

## Optional offline edition

The footer checkbox **Offline nutzen (~40 MB)**, immediately before the code/commit link,
downloads the complete built edition into browser Cache Storage. It shows compact
download/update progress, changes its label to **Offline verfügbar** after completion, and shows a resume
button if the network or browser storage interrupts the download. Unchecking it
stops pending requests, removes this edition's caches, and unregisters its worker.
After successful removal it also deletes the offline preference from local storage.
If removal fails or the page closes midway, a temporary disabled marker lets the
next visit finish cleanup; stale messages cannot enable offline use again.
Orphaned edition caches are removed even when no worker is registered.
Persistent-storage permission protects those same caches from eviction; it is not
a separate copy of the data. The browser may retain that permission after cleanup.
It does not touch other applications' caches.
When a changed version is found, the checkbox label becomes **Aktualisiere** for
the update, then returns to **Offline verfügbar**. Download progress shows just
the percentage beside the progress bar.

`scripts/offline-build.mjs` runs after the license files have been copied. It emits
`offline-manifest.json` with canonical URLs, byte sizes and SHA-256 hashes for all
built pages and assets, including fonts and the full-text search index. The
rendered license page is included, but the separate `licenses/` directory of
source notices and package metadata is excluded from the offline download.
Its version identifies the actual output, independently of the Git commit. The
same hook emits `sw.js` from the self-contained runtime in
`src/offline/worker.mjs`. The existing GitHub Pages upload includes both files;
there is no separate deployment command or server component.

The worker downloads at most four files concurrently and checks each response's
hash before saving it. All assets (scripts, styles, fonts, images and search data)
must finish before any HTML pages start downloading. Failed requests, timeouts and connection resets are retried
up to three times after waits of one, two and four seconds, including failures
while reading a response body. If they still fail, the saved progress is kept for
the next automatic check or reconnection. Unchecking also cancels retry waits.
Cached files themselves are durable checkpoints, so
navigating to another page, closing/reopening the site, or the browser stopping a
worker does not restart completed downloads. A pending manifest and the last
complete manifest are stored separately. The active edition switches only after
all files for the new version have arrived; unchanged files are reused and the
previous generation's assets remain available for already-open pages. Old unused
files are collected after a successful update.

While enabled, pages load from the complete offline edition. The footer script
checks for updates on opening/navigating, returning to a visible tab, reconnecting,
and once a minute while visible. Reconnection and the resume button force a fresh
check. Ordinary checks are throttled to once a minute when an edition is already
complete. Updates continue through the worker across navigation and resume from
the cache if the worker was suspended. This does not depend on background sync
support or on keeping a browser running after all tabs are closed.

Page URLs with search, filter or correspondence parameters resolve to the same
cached HTML; the existing browser scripts still apply those parameters. Requests
outside the edition's origin/scope are never cached. The manifest and worker
script are always obtained from the network when checking for updates. Download
failures, interrupted deployments (a hash mismatch), and quota errors preserve
the previous complete edition and show a recoverable status.

Offline use requires HTTPS (or localhost) and service worker/Cache API support.
The explicit checkbox action requests persistent storage where supported; the
browser can decline, and users can still clear saved site data. The preference
is stored per deployment path in local storage, with the worker's persisted state
as a fallback. Each browser/device opts in separately.

Test the feature with `npm run build` then `npm run preview`, on a separate port
from the development server. The checkbox is disabled in `astro dev` so a worker
cannot cache Vite's development responses. For a browser smoke test, start a
download, navigate to another letter, interrupt the connection, reopen a saved
page, then reconnect. After completion, check an unvisited letter, a filtered
catalogue URL and full-text search with the server unavailable. Deploying a new
build should preserve the old offline copy until the update completes. The Node
tests exercise interruption/restart, version changes, response integrity, cache
reuse, scope isolation, storage errors and cancellation.

## GitHub Pages development deployment

`.github/workflows/pages.yml` validates all four XML documents against their XSDs
before running the Python/Saxon XSLT export and the static Astro build. Any schema,
test, export or build failure prevents deployment. Pushes to `main` publish
`app/dist/`; pull requests targeting `main` validate and build without publishing.
The workflow can also be run manually on `main`.

The site URL is `https://dev.lenz-briefe.de`, served at `/` without a repository
path prefix. For the initial setup:

1. In the repository's **Settings → Pages**, select **GitHub Actions** as the source.
2. Set the custom domain to `dev.lenz-briefe.de`.
3. At the DNS provider, set the `dev` CNAME record to
   `theodor-springmann-stiftung.github.io` (no repository path).
4. Enable **Enforce HTTPS** once the certificate is available.

With an Actions deployment, the custom domain must be configured in GitHub's
settings; a `CNAME` file in the artifact does not configure it. See
[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
The development site's `robots.txt` and `noindex` meta tags are included in the
published output.

Run the same strict validation locally from the repository root:

```sh
uv run --project scripts/transform/python python -m transform_python.validate_schemas
```

## Data and rendering

### Editable Edition pages

The root-level [`seiten/`](../seiten/) directory is an Astro content
collection. Each top-level `.md` file supplies an Edition menu entry and a page
at `/edition/<filename>/`; `README.md` and `_*.md` are excluded. Required
frontmatter is `menu`, `title`, and `description`. Optional `order` controls menu
order. The quick legend links to the first page containing a legend, and `/edition/` redirects to the first menu
entry. `title` sets the browser title only; visible headings are authored in the
Markdown (for example, `# Heading`). The template does not insert an H1.
The collection schema checks frontmatter during development and builds.
Set `inMenu: false` to keep a page out of the Edition menu, such as
`seiten/datenschutz.md`, which is linked from the footer. The older `/datenschutz/`
address redirects to that page.

Set `toc: true` in a page's frontmatter to show a contents navigation built from
its Markdown H1–H3 headings. It is off by default, regardless of page length or
embedded components. It sits on the right on wide screens (from 1200px), stays
visible while scrolling, and moves above the text on narrower screens. Pages
without headings do not show an empty navigation.

Reusable components live in `seiten/components/` as `.md` or `.html` files. The
filename is the HTML element name: `lkb-legende.md` or `lkb-legende.html` supplies
`<lkb-legende></lkb-legende>`. Keep only one format per name; duplicates fail the
build. Names must be lowercase and include a hyphen. These files never become
pages or menu entries; `README.*` and `_`-prefixed files are excluded. In Markdown,
put a component tag on its own line, with blank lines before and after it:

```html
<lkb-legende></lkb-legende>
```

Markdown components go through the same Markdown parser as pages. No frontmatter
is required; optional `prose: false` disables the standard prose styling, and
`class` sets a wrapper CSS class. HTML components are literal fragments, without
frontmatter or automatic prose styling. Their markup, whitespace, `<script>` and
`<style>` blocks pass through directly; Markdown syntax inside them stays literal.

Both formats are embedded at build time inside the named custom element, using
ordinary light DOM and shared site CSS. There is no shadow DOM or JavaScript
required for rendering. A snippet can define its own behavior with
`customElements.define()`; guard it with `customElements.get()` because the same
snippet can appear more than once. Inline scripts are browser JavaScript, without
Astro bundling or TypeScript processing. Scope styles and selectors to the custom
element when they should affect only that component.

Components can embed either format. Markdown uses the standalone syntax above;
HTML snippets can also place empty component tags inside other HTML elements.
Missing files and circular references fail with an explanatory error. Comments,
code examples, scripts, styles and templates stay literal. Embed attributes and
slots are not supported.

Both the full legend and “Schnelle Legende” render `seiten/components/lkb-legende.html`,
so editing its labels, descriptions, examples or order changes both. The
`data-legend-tag` attributes connect rows to letter highlights. Its HTML is embedded
directly, so blank lines do not introduce Markdown paragraphs into the markup.
The built-in `<lkb-sidenote-position position="top-left"></lkb-sidenote-position>`
also works inside HTML blocks. It uses `app/src/assets/SidenotePos.svg` and the same
renderer as letter sidenotes; no SVG data needs to be copied into Markdown.
Positions: `top-left`, `top`, `top-right`, `right`, `left`, `bottom-left`, `bottom`,
`bottom-right`. The older
`legend: true` frontmatter still appends a legend if no embed is present.

The Siglen page and the Siglen section in “Zur Edition” both embed
`<lkb-siglen></lkb-siglen>` from `seiten/components/lkb-siglen.md`. Edit that file
to update their shared definition list. Its labels stay left-aligned, and the list
uses the same full content width as the legend.

In Markdown components, links and images resolve relative to their file: use
`../../assets/scan.png` or `../kontakt.md`. Markdown images receive the same Astro
optimization as page images. HTML snippets use ordinary browser URLs, for example
`/scan.png` and `/edition/kontakt/`.

Tailwind scans all files in `seiten/`, including both component formats. Use full
class names on HTML elements, for example `<div class="rounded-lg bg-amber-50 p-4">`.
Classes assembled dynamically in JavaScript, such as `bg-${color}-50`, are not
detected; write out each possible class name instead.

Astro watches Markdown and HTML components directly, without rerunning the XML export.
All public files live in the repository-root `assets/` folder, configured as Astro's
`publicDir`. Astro serves them directly in development and copies them into the
static build, preserving paths: `assets/scan.png` becomes `/scan.png`. No symlinks or asset-serving integration are needed.
Use `../assets/scan.png` in a page's Markdown (or `../../assets/scan.png` in a
component). Local Markdown images use Astro's image optimization.
`scripts/page-links.mjs` rewrites relative Markdown page and download links to
their public URLs and checks their targets; image references remain local for Astro.

### Letters

- Tagged hands use distinct fonts within each letter, also in sidenotes and the
  hand key. The first sender in metadata order always uses Source Serif.
  All other tagged writers receive Roboto Slab or Cormorant Garamond in person-ID order.
  Untagged text retains Source Serif. The corpus currently needs at most two
  additional fonts; font assignment fails explicitly if that limit is exceeded.
  When hands are listed, the footer includes the first sender as the base hand,
  even without an explicit hand tag. Its highlight includes untagged letter and
  sidenote text, excluding other hands and editorial notes.
  Footer entries follow each hand's first appearance in the XML document,
  including implicit base-hand text and sidenotes at their source positions.

- Year navigation is defined by `yearGroups/yearGroup` in `data/xml/references.xml`.
  Each group has inclusive `fromYear` and `toYear` bounds and a phase `label`.
  XML order controls display order; the index shows “years · label”. The exporter
  rejects reversed or overlapping ranges. Range-derived URLs remain stable when
  only a label changes. The XSD requires at least one group and all attributes.
- Filter controls use black borders and separated icon compartments. Selected
  counts are compact orange badges; selected pills and popup boxes have opaque
  crosshatched shadows. The active result count appears at the right of the year
  navigation, and “Alle Briefe” clears active filters from the toolbar.
- `generated/catalog.json` provides chronological headers, ordered sending and
  receiving events, source/draft flags, person/place dictionaries and year groups.
  Dates retain their XML wording. Sorting uses `when`, `from`, `notBefore`, `to`,
  then `notAfter`; the earliest candidate across sending events wins. Partial
  dates sort before more precise dates sharing the same prefix.
- `letters/<id>/text.html` contains semantic line blocks, spacers and inline page
  milestones. A page break never creates a paragraph. Reopened formatting spans
  keep their attributes; hand origins identify a single span across line breaks.
  Page markers accept optional `type="outer"` or `type="inner"` (default: `inner`),
  retained as `data-type` on the HTML anchor. Indices remain positive integers;
  the type does not change page identity, sidenote targets, or visual styling.
  A `hand` may contain page markers without ending the handwriting range;
  nested main-text pages are included in page navigation and sidenote targets.
- `sidenotes.json` retains all notes, including notes nested inside a `hand`.
  Optional `type="inpos"` displays the note as a block at its XML position, with
  the position icon on the left and annotation below, instead of in the margin.
  They inherit the nearest enclosing hand. The current corpus has no nested
  hands within sidenotes, and a regression test checks the rendered notes for
  such nesting. Notes remain separate from the main text, in their XML source order.
  Notes without a matching page marker are
  shown after the text and reported in `status.json`; all current notes have matching
  targets. On desktop, page labels remain in the left margin. Hands and notes occupy
  the right margin. Hand labels are placed first and remain aligned with their
  text lines. Each note then takes the first free vertical gap at or after its
  source page's beginning that fits its full height, with clearance around labels
  and other notes. Smaller later notes can fill gaps skipped by larger notes.
  Metadata, letter text and apparatus share the same main column.
  Notes can continue across page boundaries, without added page prefixes in
  their position descriptions. The icon hangs
  to the left at the top of each note; descriptions, page labels and hand
  information sit directly below the note’s text. On smaller screens they follow
  the text in normal flow.
  Below 1100px, page numbers appear as small gray `[4]` markers at their source
  positions, and each explicit hand begins with `[Hand: Name]`. In letters with
  multiple hands, untagged passages also receive a base-writer label at their
  beginning and whenever that writer resumes after another hand. Whitespace and
  editorial annotations do not start passages. The corresponding
  margin labels are hidden. Astro adds the hand names to the first fragment of
  each source hand; CSS displays both annotations without altering transcription
  text or search offsets. Subsequent fragments of the same hand are not labelled again.
- `traditions.json` provides ordered apparatus records, including text between
  entries. The same typography applies to letter, note and apparatus fragments.
- Letter pages have two independent navigations above the header: all letters
  by date on the right, and the current correspondence on the left. Correspondents
  are the people opposite person `1` (Lenz) in the sent/received events; co-authors
  on his own side are excluded. Shared letters offer a correspondent selector;
  people without another letter are disabled. The first available correspondence
  is selected by default, and the entire correspondence navigation is omitted
  when none has another letter.
  Both directions use catalogue date order, and correspondence links retain the
  selection via `?correspondent=<person ID>`, including on reload and Back/Forward.
- The index embeds only IDs and filter fields for browser navigation. Repeated
  `person` and `place` query parameters combine with OR within each category and
  AND between categories. `group` selects a year group; the first group is the
  default. With any person, place or search filter active, all years are selected
  and “Alle Jahre” is the only visible and selectable year option. Without
  filters, “Alle Jahre” is hidden and the year groups are available again;
  clearing the last filter returns to the first group. Shared URLs and browser
  history follow the same rules, including conflicting year/filter parameters.
  `sort=desc` reverses chronological order; sorting alone is not an active filter.
  Removable pills appear beside the heading, and “Alle Briefe” in the toolbar
  clears all filters. Remix Icons supplies the interface icons as embedded SVGs.
  Reload, shared URLs and Back/Forward restore filters and sorting. Search updates
  while typing. The unfiltered catalog remains readable without JavaScript.
  Catalog and search-result headings show names and places as plain text; cards
  link to their letters. Person and place filter links appear only in the
  single-letter heading.
  Search results show metadata first, followed by letter text (including sidenotes)
  and transmission records. Metadata search covers correspondents, places, displayed
  dates, letter numbers, source types and editorial status; all sections share the
  same person, place and year filters.

Current layout conventions: one line-indent unit equals `2ch`; `tab value="i-n"`
starts at fraction `(i-1)/n` of its row and occupies the space to the next cell.
Text and editorial marks between tab elements remain in the preceding cell, so
they cannot displace subsequent tab stops. Content before the first tab occupies
a separate full-width line.
A repeated or lower tab position wraps to a new row. On narrow screens line
indentation is capped at 25% to keep the text readable.
Inside a `tab`, `line` starts a new line within that cell. Between `tab` elements,
it starts a new table row. Each cell supports its own formatting and vertical space.
The printable snapshot converts each visual tab row into an independent table,
keeping its column widths and gaps while allowing internal lines to split across
pages. Repeated tab runs wrap into separate tables, as they do on the website.

The language tags only set `lang`: `gr→grc`, `fr→fr`, `hb→he`, `ru→ru`;
`aq→la` also changes to sans-serif. Edition marks are CSS decorations so they do
not alter the source wording. Substitutions show the struck-through original immediately
followed by the replacement in corner marks, with a small black square just after
the opening mark to indicate overwriting. Both readings remain visible. Erasures (`er`)
use inverse text. `undo` has no additional visual style; `address` is transparent.

## Verification

```sh
npm --prefix app test
npm --prefix app run check
cd scripts/transform/python
uv run python -m unittest discover -p 'test_*.py'
```

The export regressions cover all sidenotes, chronology, multiple metadata events,
apparatus content and semantic flow, including handwriting identity and apparatus
page anchors through nested multiline cells. An injected unmatched sidenote checks
that missing targets are reported without discarding content. Letter and apparatus
documents are validated against their separate schemas.
