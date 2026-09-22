# Proposed Python export contract for the static Astro edition

Status: design proposal from 22 September 2026. The subsequent XSLT fixes are now implemented; Python metadata restructuring, XSD changes and Astro remain pending. The JavaScript transforms are outside this review.

Implementation update: page markers now explicitly distinguish `data-break="inline"` from `data-break="block"`, without inserting a bar. The stylesheet also preserves empty marks/annotations, unwraps addresses, carries formatting into table cells, and shares one normalizer across contexts. See the [current fragment contract](../../transform/python/README.md#html-fragment-contract) for exact classes, attributes and IDs; examples below describe the broader proposal. The findings section records the pre-fix audit.

The current corpus also revealed repeated consecutive tab positions in letter 293. The XSLT preserves these cells in source order; the strict increasing-position rule proposed below cannot be assumed without resolving that source convention.

The existing architecture is close: Python resolves XML metadata and runs shared XSLT for letter text, sidenotes and traditions. Keep that division, but simplify the exported contract and rebuild the flow normalization around explicit boundaries. Astro should receive ready-to-render content and complete header records; it should not need to interpret edition XML or reconstruct semantic lines.

“XSD” and “XSLT” have different jobs here: `data/xsd/` validates the source vocabulary; `xslt/` transforms it. Most of the proposed rewrite concerns Python and XSLT. Reducing the website implementation does not require deleting editorial distinctions from the source schema.

## 1. Findings in the current implementation

| Requirement | Current behavior | Proposed change |
| --- | --- | --- |
| All sending/receiving events | `extract_meta` selects only the first of each; also only the first date | Export an ordered event array, with arrays for dates, people and places within each event |
| Date sorting | Index sorted numerically by letter ID | Derive chronological sort keys using the agreed rules below |
| Year groups and filters | No dedicated group or filter fields | Compute group IDs and distinct person/place IDs in Python |
| Shared index/detail header | Resolved metadata exists, but is repeated in per-letter files and index | One canonical header record per letter in the catalog; one Astro header component |
| Original/source/draft flags | Multiple source bases preserved correctly; `isDraft` accepts only `true`, not schema-valid `1` | Keep source array, normalize booleans correctly, do not collapse mixed sources |
| Continuous text and page milestones | Already uses line blocks rather than page wrappers | Keep this design; simplify page markers and preserve their exact positions |
| Formatting across lines | Splits/reopens wrappers across normalized lines | Keep the behavior; implement one shared flow normalizer |
| Vertical space | Already breaks flow, including without a subsequent `line` | Keep; define indentation reset and boundary behavior explicitly |
| Alignment | Three alignment regions already generated | Keep the concept; fix preservation of empty editorial elements and marker placement |
| Tabs | Separate tab rows and cells, but no explicit offset/width contract | Export numeric start and width from the confirmed position rule |
| Address | Emits HTML `address`, introducing block behavior | Treat XML `address` as transparent; keep its content and internal boundaries |
| Sidenotes | Separate page-keyed JSON with rendered HTML; body also has note-position markers | Keep separate output, anchor notes to page milestones rather than XML note positions |
| Traditions | HTML embedded in `meta.json`; XSLT chooses category grouping and h2/h3 | Export ordered entries with labels and independently rendered bodies |
| Presentation | Literal page bars, inserted decoration spans, colors and headings partly baked in | Keep semantic classes/attributes; let site CSS and Astro own presentation |
| Failure handling | Failure replaces output with status metadata for a failure website | Nonzero export exit; preserve last successful output; prevent the site build continuing |

Relevant code: [metadata extraction](../../transform/python/src/transform_python/exporter.py#L131), [index ordering](../../transform/python/src/transform_python/exporter.py#L388), [flow normalization](../../xslt/common.xsl#L417), [alignment](../../xslt/common.xsl#L545), [traditions](../../xslt/traditions.xsl).

### Verified behavior and gaps

Ran the current complete Python export for all 374 letters into `/tmp/lenz-current-export`; all 15 existing Python tests pass. Additional synthetic input probes establish:

- `Wor<page index="2"/>d` currently becomes text containing `Wor | d`. The page milestone must not invent spaces or punctuation.
- `A<nr extent="3"/><align pos="right">B</align>` loses the empty `nr` during alignment distribution. This is a schema-valid case. A count check found no missing `nr`/`tl` in the current corpus export; the failure is confirmed on the synthetic case.
- `aq` around `tabs` produces a `span` containing `div` elements, which is not valid phrasing content. Formatting must be carried into cells, or represented on a suitable flow container.
- `insertion/@annotation` is not exported. Retain it even if the first site only exposes it as additional information.
- `A<vspace lines="2"/>B` correctly produces two blocks separated by a spacer, with no explicit `line` needed.
- Underlining spanning a line break and vertical space is correctly reopened on later text blocks.

The test environment used SaxonC 13.0.0 and lxml installed under `/tmp`, within the project's declared dependency ranges. This was not a locked-environment reproduction or browser layout test. The export emits three pre-existing XSD warnings in `traditions.xml`, documented in the element inventory.

## 2. Minimal output files

```text
generated/
  catalog.json
  letters/
    1/
      text.html
      sidenotes.json
      traditions.json
    2/
      ...
```

- `catalog.json`: the complete header data, sorting/grouping fields, and filter options for all letters. No letter text or traditions HTML. This replaces both `letters/index.json` and repeated per-letter metadata files.
- `text.html`: the continuous letter body only, without its header or page layout.
- `sidenotes.json`: ordered sidenote records containing page targets, annotations and body HTML. Empty array when absent.
- `traditions.json`: ordered apparatus entries containing category/name/ref and body HTML. Empty array when absent.

No header HTML export is necessary. Astro can build the index and detail-page headers from the same catalog objects using the same component. HTML fragments are ready for build-time inclusion; browser-side XSLT, Python and content fetching are unnecessary.

For the index, Astro can render all 374 list entries once. Small client-side code loads the catalog's IDs/groups, hides nonmatching rows, updates counts and selects year groups. This avoids a second JavaScript implementation of the header. Only catalog data needed for interaction needs to be shipped to the browser; letter bodies and traditions stay on their respective static pages.

## 3. Catalog and header model

Illustrative structure (names and dates shown for letter 1; optional fields omitted):

```json
{
  "groups": [
    {"id":"1756-1770","label":"1756–1770"},
    {"id":"1771-1775","label":"1771–1775"},
    {"id":"1776","label":"1776"},
    {"id":"1777-1779","label":"1777–1779"},
    {"id":"1780-1792","label":"1780–1792"}
  ],
  "people": {
    "1":{"name":"Jakob Michael Reinhold Lenz"},
    "2":{"name":"Friedrich Konrad Gadebusch"}
  },
  "places": {"1":{"name":"Dorpat [Tartu]"}},
  "letters": [
    {
      "id":"1",
      "sortDate":"1765-01-02",
      "group":"1756-1770",
      "personIds":["1","2"],
      "placeIds":["1"],
      "isDraft":false,
      "sources":[{"isOriginal":true,"type":"manuscript"}],
      "events":[
        {
          "type":"sent",
          "dates":[{"text":"Dorpat (Tartu), 2. Januar 1765","when":"1765-01-02"}],
          "people":[{"ref":"1"}],
          "places":[{"ref":"1"}]
        },
        {
          "type":"received",
          "dates":[],
          "people":[{"ref":"2"}],
          "places":[{"ref":"1","cert":"low"}]
        }
      ]
    }
  ]
}
```

The example is a shortened catalog, not a new source format. IDs remain strings. People/place dictionaries store each label once. Do not repeat complete `resolved` authority records, external IDs, register IDs, or other unused authority fields in every event.

Preserve all events in source order. Every event has its own dates, people and places. Never flatten their associations for display or zip the first sending event to the first receiving event: the XML does not establish those pairs. The separate `personIds` and `placeIds` arrays are intentionally flattened and deduplicated solely for filtering.

Within date records, preserve whichever `when`, `from`, `notBefore`, `to`, `notAfter` and `cert` attributes are present. `text` comes from the actual XML content, preserving wording, spelling and punctuation; do not reconstruct a German display date from the machine date. Whitespace can display with ordinary HTML whitespace collapse. For metadata containing `wwwlink`, preserve ordered text/link parts rather than flattening away the link.

Person/place references retain `cert`, `erschlossen`, and meaningful annotation content when present. Keep the existing ability to represent mixed text/link annotations, but avoid exporting both a plain-text copy and a full structured copy without a consumer. Optional flags can be omitted with documented schema defaults (`cert=high`, `erschlossen=false`). Resolve missing references as a build diagnostic, not a silent blank label. Keep the explicit unknown-person entry where used.

### Sorting and year groups

Confirmed by the user:

1. For each sending-event date, take the first available attribute in the priority `when → from → notBefore → to → notAfter`.
2. Across all dates of all sending events, choose the earliest resulting date.
3. Sort letters by that value, then numeric letter ID for a stable tie-break.
4. Derive the year group from that same date. Keep source event order in the header regardless of sorting.

Do not use received dates as an unrequested sorting fallback. For partial year/year-month values, use a sorting tuple with missing month/day set to zero, not a fabricated precise display date. A date without a year cannot determine these groups: place genuinely unsortable letters last in an undated group; retain any out-of-range letters in an additional group rather than dropping them. Neither fallback is needed by the current corpus.

Current group counts under the specified precedence:

| Group | Letters |
| --- | ---: |
| 1756–1770 | 7 |
| 1771–1775 | 85 |
| 1776 | 177 |
| 1777–1779 | 53 |
| 1780–1792 | 52 |

212 of 374 positions differ from current letter-ID order. The selected machine attributes govern sorting even when the prose date suggests something else; for example letter 5's prose mentions likely January 1768, while its `notBefore` is `1767-11-24`. Do not silently correct source data while exporting.

Suggested initial filter behavior: selected people match any sending/receiving event, as do selected places; OR within each selected category, AND between person and place categories and the year group. Dates remain ordered after filtering. The five groups are the pagination units, so no arbitrary additional page-size pagination is required. An “all years” selection is a useful option, not a new export format.

### Shared header behavior

Render sending events and receiving events separately, each preserving its own people and parenthesized places. Show the literal sending date text and receiving date text in square brackets when present; do not print empty brackets. Multiple events should appear as distinct event rows rather than one ambiguous sentence.

Source basis is an array. If any basis has `isOriginal=true`, indicate that an original was available as an edition basis. Otherwise show all distinct types: manuscript, print, or unknown. Letter 39 already has both manuscript and print bases, so a single `sourceType` enum would lose information. This classification concerns the basis of the edition, not a claim that no original survives anywhere.

Use `isDraft` for the draft/non-draft distinction. It does not independently prove historical delivery. Parse both XML boolean spellings `true/1` and `false/0`. The current corpus has one sending event and one receiving event per letter and no receiving dates, so multiple-event/receiving-date behavior needs fixtures even though the schema already permits it.

## 4. Text model: flow blocks with inline page milestones

A semantic line is a **flow block**, not a physical browser line. It may wrap naturally over many screen lines. A page is a milestone in that flow, never a container for it.

The internal normalizer only needs:

- Text and inline formatting, with an active formatting stack.
- Semantic line boundaries with optional indent codes.
- Vertical-space boundaries with a line count.
- Horizontal-rule boundaries.
- Page milestones that do not flush a line.
- Alignment regions and tab cells within the applicable line context.

This is an internal rendering model, not another exported JSON representation of the full letter. Walk content in order, close/reopen active formatting around real block boundaries, and emit valid HTML. Use the same normalizer for the main body, each sidenote and each apparatus body, with independent line contexts.

Example:

```xml
<page index="1"/><line tab="4"/>
<ul>First part</ul><page index="2"/><ul> continues<line/>Second part</ul>
<vspace lines="2"/>After the space
```

Proposed output, with insignificant source indentation omitted:

```html
<div class="text-line" data-indent="4"><span class="page-marker" id="letter-1-page-1" data-page="1"></span><span class="ul">First part</span><span class="page-marker" id="letter-1-page-2" data-page="2"></span><span class="ul"> continues</span></div>
<div class="text-line"><span class="ul">Second part</span></div>
<div class="vspace" style="--lines:2" aria-hidden="true"></div>
<div class="text-line">After the space</div>
```

The source closes/reopens `ul` around the page milestone because the current XSD requires `page` directly under `letterText`. This introduces no semantic line break.

Use neutral `div` line containers because aligned regions and cell layouts may be nested inside them. Use phrasing elements for inline marks. Never put generated block containers inside a `span`; propagate surrounding marks into cell/region content instead.

### Boundary rules

- `line`: end the previous semantic line and begin a new one. Its `tab` sets the new line's indent code. A plain `line` resets indent. Do not derive poem semantics or invent indent sizes from the numbers.
- `vspace`: end the current line, emit the exact requested spacer, reset indent, and start subsequent content in a new line. A following `line` initializes that new line and must not add an accidental blank one. Consecutive intentional `line` markers otherwise retain their empty lines; do not silently collapse them.
- `line type="line"`: end current content, emit a horizontal-rule block, then continue in a fresh line. No need to export redundant `data-type="break"` on every ordinary line.
- `page`: one empty, uniquely scoped inline marker. No visible text, spaces, punctuation, duplicate page spans or automatic block break. If it occurs between blocks, retain an appropriate boundary anchor without adding an empty text line. Its position relative to a spacer matters and must be preserved.
- `sidenote`: extract it from main text; do not split the main line or insert a note-position marker unless a later interaction explicitly needs one. Position by its declared page.
- `address`: unwrap it; process all children normally.
- Preserve empty `nr` and `tl` as meaningful editorial marks. Empty content is not equivalent to an ignorable element.
- Preserve textual whitespace between inline nodes; do not globally discard whitespace-only nodes or pretty-print HTML in ways that create or remove word spaces. XML formatting newlines are ordinary whitespace, never additional semantic line breaks.

Keep classes for all requested editorial distinctions and relevant attributes (`hand` ref, `fn` index, `nr` extent, insertion position/annotation, highlight color). Decorative insertion markers, exact colors and loss/illegibility glyphs belong to the later formatting specification. Keep `fn` in flow at this stage; do not invent a footnote relocation/linking scheme from the unreferenced `anchor` element.

`fr` is mentioned in the requirements but is absent from the current XSD and corpus. Add it explicitly if it is intended source vocabulary. Preserve `gr`, `hb`, `ru` and future `fr` distinctions, but do not infer language from `aq`, which marks script/typeface. The later site supplies roughly `75ch` width and disables automatic hyphenation; these are not transform concerns.

## 5. Alignment and tabs

A normal line has a default left region. Encountered `align` elements contribute content to left/center/right regions; unaligned text stays left. Multiple regions can coexist on one line, and inline marks spanning regions must be reproduced within each region. Preserve order within each region. Alignment changes layout, not text boundaries.

Emit only occupied regions, preserving empty editorial marks as content. Page milestones must remain attached to their source content position; do not blindly assign every page marker to the left region. Because alignment can affect visual order, retain stable source order on runs internally rather than repeatedly searching descendants to guess the region.

The later CSS can provide a shared full-width positioning frame for these regions. An equal-thirds grid must not accidentally force a lone right-aligned passage into only one third of the letter width. Collision/wrapping behavior for genuinely competing long regions remains a visual-layout decision for the site.

Confirmed tab rule: for `i-n`, start at `(i−1)/n` of the row width. A cell extends to the next cell's start; the last extends to the row end. For example:

| Source values in one row | Starts | Widths |
| --- | --- | --- |
| `1-2`, `2-2` | 0%, 50% | 50%, 50% |
| `1-8`, `3-8`, `4-8`, `7-8` | 0%, 25%, 37.5%, 75% | 25%, 12.5%, 37.5%, 25% |

Export the source value plus derived numeric CSS variables for offset and width. Leave the layout mechanics to the site's CSS. Validate increasing positions within a row; do not silently reorder cells or fabricate positive widths for invalid input. Row boundaries come from `line` and `vspace`. A cell has its own alignment context; an `align` inside one cell must not trigger redistribution of the outer letter line.

The schema's `inlineNoLine` restriction currently applies only to immediate children: a `line` can occur deeper inside an `aq` within `align`/`tab`. If “no breaks anywhere inside these regions” is an editorial invariant, enforce it with a small semantic validation check (or deliberately stricter types), rather than assuming the current XSD guarantees it. In current traditions, some direct `line` violations also need resolution before strict validation can pass.

## 6. Sidenotes

Example proposed record:

```json
{
  "id":"letter-2-sidenote-1",
  "page":"2",
  "anchorId":"letter-2-page-2",
  "pos":"left",
  "annotation":"am linken Rand der zweiten Seite, vertikal",
  "html":"<div class=\"text-line\">…</div>"
}
```

The array preserves source order. HTML contains the note body, while Astro owns the surrounding `aside`. Retain source `pos` as descriptive metadata even though this design displays all notes in the left margin. Reject or report missing target pages rather than quietly omitting their notes; the current exporter only visits page IDs present in the letter.

Build-time transformation cannot know final browser coordinates. For desktop alignment to the actual page-break height, the later static page needs a small layout script that measures page-marker positions after fonts load and on resize, then positions notes in the separate margin. No server is needed. Notes sharing a page stack in source order. To avoid overlap, a group can be pushed below preceding notes, so exact alignment is a target rather than an unconditional guarantee when the margin is crowded.

On narrow screens and without that layout script, render notes in a normal-flow notes section with page labels/links. Page content must remain a continuous middle-column flow; never insert full-width page containers just to position marginalia.

## 7. Traditions

Export each `app` as a record with `ref`, resolved `name`, `category` and `html`. Preserve source order. Render its body using exactly the same flow rules as letter text. Astro chooses the section wrappers and heading levels, so the exporter no longer requires apparatus definitions passed into XSLT just to generate h2/h3.

Preserve meaningful text between apps as `{ "type":"text", "html":"…" }` records, alongside `{ "type":"app", ... }` entries. This is required by existing content, not only the schema: letters 185 and 348 contain punctuation outside `app`. Do not discard it when moving from a single HTML fragment to entries.

The current traditions include a page marker at a location the XSD rejects. Resolve that source/schema mismatch before the rewrite; any legitimate page markers in apparatus must use an apparatus-specific ID scope to avoid collision with the main letter's pages.

## 8. What to remove, retain and verify in the rewrite

Remove legacy templates for elements outside the chosen vocabulary; compatibility branches for `line type="empty"`; duplicated main/nested line-normalization loops; unused note-position markers; duplicate page markers; full authority-record copies in headers; repeated per-letter metadata; generated header/category presentation; disk stylesheet-export caching and benchmark machinery from the MVP path; and the requirement to build a failure website.

Retain compile-once stylesheet execution, XML/schema checks, reference diagnostics, staged output with atomic publication, safe output-path handling, and focused regression tests. A build error should leave prior successful output intact and stop the Astro build. Unknown editorial markup should be reported rather than silently swallowed by a generic shallow-skip rule.

Rewrite sequence:

1. Implement complete event metadata, date/group/filter derivation and the catalog contract.
2. Replace the flow normalization with one explicit boundary/formatting model; preserve mixed text and empty marks.
3. Emit line/region/cell HTML, page markers and the two supplemental JSON collections.
4. Make only necessary schema/validation changes: resolve traditions errors, decide `fr`, and enforce the intended region restrictions. Keep editorial markup even when the initial visual treatment is simple.
5. Verify fixtures for multiple events/dates, receiving dates, mixed source bases, partial dates, all boolean spellings, inline page boundaries, nested formatting across breaks/spacers, aligned empty marks, table cells, sidenote page references, and mixed apparatus content. Compare corpus counts and content preservation.

The result is a small build-time content pipeline: Python owns resolved data and normalization, XSLT renders reusable text fragments, Astro owns pages/headers/styles, and a small amount of browser code owns filtering and margin positioning.
