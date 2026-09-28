# Transform Python Workspace

Native XML export pipeline for the Lenz edition.

Optional `<tab value="1-2" type="right-virgil-inwards">…</tab>` exports
`data-type="right-virgil-inwards"`. The site draws a decorative `{` along the
cell's right edge, spanning its height and pointing inward. The mirrored type
`left-virgil-inwards` draws `}` along the left edge. Outward-pointing variants
are `left-virgil-outwards` (`{` on the left) and `right-virgil-outwards`
(`}` on the right). `type="line-left"` and `type="line-right"` draw a straight
vertical divider along the corresponding cell edge; `type="line"` remains an alias
for the right divider. Untyped cells keep their existing appearance; these decorations
add no characters to copied or searched text.

## Usage

Install dependencies:

```bash
uv sync
```

Check that the shared XML tags allowed by the schema are covered by the common XSLT:

```bash
uv run check-coverage
```

Run the exporter:

```bash
uv run transform --out ../../app/generated
```

The exporter always publishes a `status.json` file into the output directory.
Successful runs also publish the generated letter artifacts. Failed runs replace
the output with failure metadata. The Astro build stops if the export fails.

The root `catalog.json` is the canonical catalog used by Astro. It includes all
sending/receiving events and dates, derived sort keys and year groups, filter IDs,
and reference dictionaries. The legacy index and metadata records remain available.

Per letter, the successful export publishes:

- `meta.json`
- `text.html`
- `sidenotes.json`
- `traditions.json`

`text.html` is a continuous letter-level stream with inline page markers derived
from source `<page>` tags. `sidenotes.json` is keyed by source page index.

## HTML fragment contract

The shared XSLT normalizes letter bodies, sidenotes and apparatus bodies into
semantic line blocks (`div.lb-line-block`), spacers (`div.lb-vspace`) and table
rows/cells. Formatting spanning lines is reopened inside those blocks. Formatting
around a table is carried into its cells, so no flow container is nested inside
a phrasing element. XML source newlines do not create semantic line breaks.

Each source page produces one empty marker, for example:

```html
<span class="page-anchor" id="page-2" data-index="2" data-break="inline"></span>
```

- `data-break="inline"`: content continues across this milestone within the same
  semantic line block. The later site can show `|` using this selector.
- `data-break="block"`: the milestone is at a semantic block boundary (including
  the initial page). It introduces no extra blank line or page wrapper.

Classification happens before alignment distributes text into regions, and
counts empty editorial marks as content. Markers contain no punctuation, spaces
or invisible placeholder characters. Markers retain their order relative to
vertical space. Apparatus markers use `app-N-page-M` IDs to avoid collisions with
`page-M` in the letter body. A letter page should contain one letter's fragments.

`line/@tab` becomes `data-tab` on its line. Site CSS uses it for first-line
indentation only; automatically wrapped continuation lines remain at the left
edge, rather than indenting the entire block. Ordinary lines omit the redundant
`type="break"`. `line type="line"` produces `hr.lb-rule`. `vspace/@lines` becomes
`data-lines` and a height in `lh`; positive decimals such as `lines="1.5"` are
supported alongside whole numbers. It ends the line and resets indentation even
without a following `line`. A following `line` adds no accidental blank line.

Alignment regions (`align-left`, `align-center`, `align-right`) are emitted only
when occupied. A cell owns its own alignment context. Cells retain `data-value`
from `tab/@value`; their final layout belongs to the site. Source letter 293 has
consecutive cells at the same position without intervening `line` markers, so
cell positions must not be assumed to increase strictly on every source row.
Text and editorial marks between tab elements are included in the preceding
cell. Content before the first tab is wrapped in `div.lb-tab-prefix`, displayed
at full row width, so neither can shift the encoded starting positions.

`address` is transparent. Empty `nr` elements survive, including in aligned
content; whitespace-only placeholder contents are removed, and `data-extent`
always contains the source extent or its default `1`. Extents above 20 carry
`data-wrap`; empty ones contain character-width `nr-space` spans so the gap
can wrap within a line, including inside erasures, without adding text.
No illegibility glyph is inserted. Insertion positions and annotations become `data-pos` and
`data-annotation`; no decoration is inserted. Highlights retain `data-color`.

Sidenote contents remain exclusively in `sidenotes.json`, keyed by page.
Optional `type="inpos"` leaves a block slot at the note's XML position in
`text.html`; Astro fills it with the note, its left-hand position icon and its
annotation, and excludes it from the margin. `pos` and `page` remain required.
The note retains its inherited hand and its own search record and anchor.
Ordinary sidenotes keep their existing margin placement. The main
text no longer contains note-position markers; the later site positions notes
using their page's marker. Every note is exported, including notes with unmatched
targets: their `anchorId` is null and `status.json` reports the unresolved page.
`sourceOrder` preserves note order across page groups. Ordered `traditions.json`
records provide apparatus labels and body HTML, including interstitial text;
`traditionsHtml` remains in `meta.json` for compatibility.

`search.json` contains plain-text search units and anchors into the exported HTML.
Letter and apparatus units follow semantic line boundaries; page milestones and
inline formatting are transparent. Every table cell is a separate unit, including
inside sidenotes. Otherwise each sidenote is one unit across its internal lines.
Editorial notes and deleted wording remain included. The Astro index downloads
this file on search focus, then normalizes and matches entirely in the browser.

Run the Python regression tests (including corpus nesting and marker checks):

```bash
uv run python -m unittest discover -p 'test_*.py'
```
