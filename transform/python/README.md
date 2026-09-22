# Transform Python Workspace

Native XML export pipeline for the Lenz edition.

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
the output with failure metadata so the Astro app can build a generic failure site.

Per letter, the successful export publishes:

- `meta.json`
- `text.html`
- `sidenotes.json`

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

`line/@tab` becomes `data-tab` on its line; ordinary lines omit the redundant
`type="break"`. `line type="line"` produces `hr.lb-rule`. `vspace/@lines` becomes
`data-lines` and a height in `lh`; it ends the line and resets indentation even
without a following `line`. A following `line` adds no accidental blank line.

Alignment regions (`align-left`, `align-center`, `align-right`) are emitted only
when occupied. A cell owns its own alignment context. Cells retain `data-value`
from `tab/@value`; their final layout belongs to the site. Source letter 293 has
consecutive cells at the same position without intervening `line` markers, so
cell positions must not be assumed to increase strictly on every source row.

`address` is transparent. Empty `nr` elements survive, including in aligned
content; whitespace-only placeholder contents are removed, and `data-extent`
always contains the source extent or its default `1`. No illegibility glyph is
inserted. Insertion positions and annotations become `data-pos` and
`data-annotation`; no decoration is inserted. Highlights retain `data-color`.

Sidenote contents remain exclusively in `sidenotes.json`, keyed by page. The main
text no longer contains note-position markers; the later site positions notes
using their page's marker. Traditions still live in `meta.json` as
`traditionsHtml`; the proposed metadata/JSON restructuring is a separate change.

Run the Python regression tests (including corpus nesting and marker checks):

```bash
uv run python -m unittest discover -p 'test_*.py'
```
