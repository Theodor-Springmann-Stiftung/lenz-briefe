# Proposed Python export contract for the static Astro edition

Status: design proposal followed by implementation, 23 September 2026. The static site now lives in `app/`; see its [implementation README](../../app/README.md) for the current behavior and build instructions. The Python exporter now writes `catalog.json`, ordered events and `traditions.json`, preserves unmatched sidenotes, and emits the language and typography hooks. The review below records the pre-implementation findings and proposed contract, rather than a description of the current code. Actual records retain the existing `letter`, `persons`, `locations` and `traditions` field names; sidenotes remain keyed by page for compatibility.

**Recommendation: retain the existing line-based XSLT normalizer and improve the Python data contract.** It already handles the hard distinction between page milestones and semantic lines. Astro should receive complete header records, ready-to-render text fragments, and separate sidenote/apparatus records. It should not parse edition XML or infer textual structure.

The [styling checklist](letter-styling-checklist.md) is the companion document for the next formatting discussion. The [schema inventory](briefe-element-inventory.md) remains the exhaustive account of permitted elements and attributes.

## 1. Requirements versus current behavior

XSD describes valid source structure; XSLT produces HTML. The runners live in `transform/python/`, while the stylesheets are in `xslt/`.

| Requirement | Current Python/XSLT behavior | Recommendation |
| --- | --- | --- |
| Shared header on index and letter page | Metadata appears in both per-letter `meta.json` and `letters/index.json` | One canonical catalog record and one reusable Astro header component |
| All sending/receiving events and dates | Only first event of each kind and first date within it are exported | Ordered `events[]`, each retaining all dates, people and places |
| Literal date wording | Plain text is extracted and whitespace collapsed | Preserve source wording and ordered text/link content; never regenerate display dates from machine dates |
| Chronological sorting | Letter index sorted by numeric ID | Precompute sort key using the requested attribute precedence |
| Five year groups | Not exported explicitly | Precompute `groupId` and group definitions |
| Person/place filtering | Resolved references are present, but no filter contract | Precompute deduplicated IDs across all sending/receiving events |
| Original, source basis and draft status | Source arrays are retained; draft/proofread accepts only `true`, not `1` | Retain all source bases; normalize all XSD boolean spellings |
| Continuous text, no page blocks | Already implemented | Keep |
| Semantic lines, rules, vertical space | Already implemented | Keep existing classes and semantics |
| Inline formatting across lines | Wrappers split/reopen inside line blocks | Keep; add language attributes to the reopened fragments |
| Multiple alignment regions in a line | Already implemented, including nested marks | Keep; choose collision/wrapping rules in CSS later |
| Tab positions | Source `value` retained; final widths undefined | Preserve values; do not invent a width algorithm before editorial clarification |
| Transparent `address` | Already implemented | Keep |
| Separate sidenotes | Rendered separately, selected by existing page indices | Export every source note, including unmatched page targets |
| Apparatus below letter | One HTML string in `meta.json`, with headings/groups in XSLT | Ordered records with labels and body HTML; Astro owns headings |
| Language attributes | `gr`, `hb`, `ru`, `aq` emit classes only; `fr` absent | Add agreed language mapping; decide explicit Latin encoding |
| Tailwind styling | Semantic classes already available | Global edition CSS with `@apply`; font settings belong to the site theme |

The body transformation does not require a wholesale rewrite. The biggest implementation changes are complete metadata extraction, derived sorting/filter fields, lossless supplemental records and language output.

## 2. Build-time output

Proposed files:

```text
generated/
  catalog.json
  status.json
  letters/
    1/
      text.html
      sidenotes.json
      traditions.json
    2/
      ...
```

| Artifact | Consumer and contents |
| --- | --- |
| `catalog.json` | Astro build: all canonical letter headers, chronological order, groups, reference dictionaries and filter IDs |
| `text.html` | Letter page: continuous body fragment, without header, page-column layout or marginal notes |
| `sidenotes.json` | Letter page: ordered notes with page targets, annotations and body HTML |
| `traditions.json` | Letter page: ordered apparatus records with resolved labels and body HTML |
| `status.json` | Build diagnostics/provenance; not required for the public UI |

`catalog.json` replaces the duplicated index/per-letter metadata as the authoritative header source. Empty note/apparatus collections are `[]`. No separate header HTML is needed.

Astro reads these files at build time, produces the home page and one static page per letter, and includes the HTML fragments. A browser only needs the small derived filter records embedded in the index page, not the full catalog or letter text. Static route generation and HTML-fragment inclusion fit Astro's build model. [Astro routing](https://docs.astro.build/en/guides/routing/), [template directives](https://docs.astro.build/en/reference/directives-reference/#sethtml).

## 3. Catalog model

An illustrative excerpt using letter 1 (not a complete generated file):

```json
{
  "schemaVersion": 1,
  "groups": [
    {"id":"1756-1770","label":"1756–1770","fromYear":1756,"toYear":1770},
    {"id":"1771-1775","label":"1771–1775","fromYear":1771,"toYear":1775},
    {"id":"1776","label":"1776","fromYear":1776,"toYear":1776},
    {"id":"1777-1779","label":"1777–1779","fromYear":1777,"toYear":1779},
    {"id":"1780-1792","label":"1780–1792","fromYear":1780,"toYear":1792}
  ],
  "people": {
    "1":{"name":"Jakob Michael Reinhold Lenz"},
    "2":{"name":"Friedrich Konrad Gadebusch"}
  },
  "places": {"1":{"name":"Dorpat [Tartu]"}},
  "letters": [
    {
      "id":"1",
      "sort":{"key":[1765,1,2],"value":"1765-01-02","attribute":"when","eventIndex":0,"dateIndex":0},
      "groupId":"1756-1770",
      "personIds":["1","2"],
      "placeIds":["1"],
      "isDraft":false,
      "isProofread":true,
      "hasOriginal":true,
      "sources":[{"isOriginal":true,"type":"manuscript"}],
      "events":[
        {
          "type":"sent",
          "dates":[{
            "content":[{"type":"text","text":"Dorpat (Tartu), 2. Januar 1765"}],
            "when":"1765-01-02",
            "cert":"high"
          }],
          "people":[{"ref":"1","cert":"high","erschlossen":false,"role":"autor","content":[]}],
          "places":[{"ref":"1","cert":"high","erschlossen":false,"role":"entstehungsort","content":[]}]
        },
        {
          "type":"received",
          "dates":[],
          "people":[{"ref":"2","cert":"high","erschlossen":false,"role":"autor","content":[]}],
          "places":[{"ref":"1","cert":"low","erschlossen":false,"role":"entstehungsort","content":[]}]
        }
      ],
      "pages":[{"index":"1","anchorId":"letter-1-page-1"},{"index":"2","anchorId":"letter-1-page-2"}]
    }
  ]
}
```

IDs remain strings. `letters[]` is sorted chronologically. Dictionary entries can retain authority URLs and other available reference fields once per person/place, instead of duplicating complete resolved records in each event. Filter controls should include referenced correspondents/places, rather than every unused dictionary definition.

`events[]` preserves all `sent` and `received` elements in source order. Each event retains its own arrays. Do not zip sending and receiving events into inferred pairs: the XML does not establish those pairs. The separate flat `personIds` and `placeIds` arrays are for filtering only. They include all participants/locations in all events, not unencoded mentions in letter prose or handwriting references.

Within each date retain all supplied `when`, `from`, `notBefore`, `to`, `notAfter` values, even though only one is chosen for sorting. `content` preserves literal XML text and ordered links; a link can be represented as `{"type":"link","href":"…","children":[…]}`. Use the same structure for person/place annotations. XML comments are omitted. Ordinary browser whitespace collapse is acceptable; wording, spelling and punctuation remain unchanged.

Normalize defaults into the data: `cert="high"`, `erschlossen=false`, and the schema's reference-role defaults. Preserve explicit `kat` as `role`; an event's `type` determines whether its people are displayed as senders or recipients. It is not inferred from that generic role default. Parse `true/1` and `false/0` consistently.

### Chronological sorting and groups

The user's required attribute priority is **`when → from → notBefore → to → notAfter`**. Apply it to each sending date. Recommended policy for future multiple dates/events: choose the earliest of the resulting keys across all sending events. This aggregation is a proposal, not an already confirmed editorial decision. Keep all events in source order for the header.

Use a numeric `(year, month, day)` sort tuple. Missing month/day in year-only or year-month values can sort as zero; this is a sorting convention, not an invented exact date. Retain the original date value and selected attribute in `sort` so the result is explainable. Break ties by numeric letter ID. Avoid browser `Date` parsing and timezone-dependent ordering; compute once in Python.

Dates without a usable year go to an undated group at the end. Out-of-range dates remain accessible in an additional group. An unusable selected value should produce a diagnostic rather than silently falling through to a lower-priority attribute. Received dates are not an implicit sorting fallback. The current corpus needs neither fallback group.

Recomputed group counts:

| Group | Letters |
| --- | ---: |
| 1756–1770 | 7 |
| 1771–1775 | 85 |
| 1776 | 177 |
| 1777–1779 | 53 |
| 1780–1792 | 52 |

212 of 374 positions change from numeric letter-ID ordering. Chosen attributes are `when` for 200 letters, `notBefore` for 162, `from` for 2 and `notAfter` for 10. Dates in the prose are not used to override machine-readable source values.

### One header model for both views

One Astro component receives one catalog letter plus the reference dictionaries. Use it both for the index row and detail-page header.

- Display each sending event's literal dates, sender names and parenthesized places.
- Display each receiving event's dates in square brackets, recipient names and parenthesized places. Omit brackets when there is no date.
- Keep multiple events visibly distinct, preserving event associations. People and places within an event are lists; their order does not imply person/place pairs.
- If any source basis has `isOriginal=true`, show that an original was available as an edition basis. Otherwise display all distinct recorded source types, including mixed manuscript/print and unknown cases.
- Show draft status from `isDraft`. `false` encodes non-draft status, not independent proof of historical delivery. The final visible label is an editorial choice.

Current source combinations: 288 original manuscripts; 49 non-original prints; 32 non-original manuscripts; 4 unknown bases; 1 mixed manuscript/print basis. There are 35 drafts. A single `sourceType` field would lose information.

### Client-side navigation and query state

Recommended URL form: `/?group=1776&person=1&person=12&place=1`. Repeated keys represent multiple selections. The group is the pagination unit; no additional arbitrary page size is needed for the stated requirements.

Recommended behavior: OR between selected people, OR between selected places, AND between these two categories and the selected group. A person and place may match different events of the same letter; display still preserves event associations. Leave same-event filtering for an explicitly requested feature. Default to all letters, chronologically ordered, with links for the five groups.

Astro can prerender all 374 header rows in chronological order. A small browser script reads the query, validates IDs/group names against the catalog, hides unmatched rows, updates counts and active controls, and uses browser history for query changes. Back/Forward must reapply state via `popstate`; reloading a copied URL restores it. Unknown values should be removed or ignored consistently rather than creating inaccessible hidden state. Letter links navigate to already generated static pages.

No runtime server filtering or URL-specific HTML build is needed. A prerendered page cannot read each visitor's query at build time; browser-side URL handling is required. [Astro URL context](https://docs.astro.build/en/reference/api-reference/#url).

## 4. The document model

Treat a letter as an **ordered flow of semantic line blocks, spacers, rules and page milestones**. Page milestones describe positions within that flow, not containers. Text marks decorate ranges within the flow; aligned regions and tab cells organize content within a line/row.

The current XSLT already implements an intermediate representation using temporary `t:line`, `t:page`, `t:tabs` and `t:row` nodes. Keep it internal. Astro needs HTML, not a second JSON representation of every text node.

### Boundary rules

| XML event | Flow effect |
| --- | --- |
| Text or inline formatting | Append to current content; retain formatting context |
| `line` / `line type="break"` | End previous semantic line and begin a new one; `tab` belongs to the new line |
| `line type="line"` | End current line, emit horizontal-rule block, then continue in fresh flow |
| `vspace lines="N"` | End current line, emit N line-heights of space, reset indent; following text begins a new semantic line |
| `page index="N"` | Insert a zero-content anchor; never add spaces or a line break |
| `sidenote` | Export separately; its XML position does not break the main line |
| `address` | Remove wrapper, process all content normally |

The first text may start an implicit line. A normal `line` without `tab` resets indentation. A `line` immediately after `vspace` supplies the next line's attributes and must not add an accidental blank line. Intentional consecutive line markers otherwise retain empty semantic lines. Their eventual CSS needs a minimum line height; an empty `div` alone does not guarantee visible spacing.

A semantic line can wrap into many browser lines within the approximately `75ch` body. Disable automatic hyphenation in CSS. Source punctuation and encoded literal hyphens remain text. Do not apply `white-space: pre` to the XML text: source formatting newlines are not semantic line breaks.

### Page example

Source:

```xml
<page index="1"/><line tab="1"/><ul>First part
<page index="2"/>continues<line/>Second line</ul>
<vspace lines="2"/>Next paragraph
```

Proposed fragment shape, using existing classes and a proposed letter-specific ID prefix:

```html
<div class="lb-line-block" data-tab="1">
  <span class="page-anchor" id="letter-1-page-1" data-index="1" data-break="block"></span>
  <span class="ul">First part
<span class="page-anchor" id="letter-1-page-2" data-index="2" data-break="inline"></span>continues</span>
</div>
<div class="lb-line-block"><span class="ul">Second line</span></div>
<div class="lb-vspace" data-lines="2" style="height: 2lh" aria-hidden="true"></div>
<div class="lb-line-block">Next paragraph</div>
```

Illustration only: production serialization must not add indentation whitespace to mixed content. The original newline after “part” is preserved as source whitespace. A marker inside a word must leave that word untouched.

`data-break="inline"` means meaningful content exists on both sides in the same semantic line. `block` means a semantic boundary. Classification must happen before alignment redistributes content; the current code does this. A standalone boundary anchor must not create an extra blank paragraph. Keep marker order relative to spacers.

### Marks and inline regions

Retain current semantic classes and data attributes. Reopen formatting inside each resulting line/region/cell so block elements never end up inside a `span`, `em`, `strong` or `del`. The XSLT already carries formatting around a table into its cells. `nr` defaults to extent 1; empty `nr` and `tl` remain meaningful.

A line can contain unaligned/left, center and right content simultaneously. Emit only occupied regions. Unaligned text belongs to the left region; preserve source order within each region. Alignment is not a new line boundary. The site must choose overlap/wrapping behavior; an equal-thirds layout is not automatically equivalent to full-width left/center/right alignment.

`tabs` contains source-defined rows; `tab` retains `data-value="i-n"`. Preserve source row/cell ordering and raw `extent`. The requirements do not yet settle whether `i-n` specifies an offset, a fixed fraction or a next-cell width. In particular letter 293 repeats consecutive cell positions, so a “width to the next position” rule can create zero-width cells. Do not silently reorder or split them.

The statement that `align` and `tab` cannot contain lines is only an immediate-child XSD restriction. Schema-valid aligned content crosses lines through nested `aq`/`ru` in letters **9, 92, 226, 358 and 374**. The existing normalizer supports it; retain support rather than tighten the schema without migrating those passages. Apparatus contains two additional direct `align/line` violations.

### Language handling

The requirement is language metadata without visual changes for `gr`, `fr`, `hb`, `ru`, with automatic hyphenation disabled. Proposed mappings: `ru → ru`, `hb → he`, `fr → fr`. For the inspected Ancient Greek quotations, `grc` is appropriate; the edition-wide meaning of `gr` should determine whether that is always the intended code.

`fr` currently has no schema declaration or XSLT handler. No general `lang` attribute or `lang` element is currently defined for letter text. The intended representation of explicit Latin (`la`) is still open. `aq` must retain its Antiqua formatting distinction; its relationship to language needs confirmation, since existing `aq` passages include French. Do not label every Antiqua span Latin without that decision. Language attributes must survive line splitting and table-cell propagation. `lang="he"` does not by itself prescribe a right-to-left layout change; that is a separate display decision.

## 5. Sidenotes as a separate collection

Proposed record (illustrative):

```json
{
  "id":"letter-2-sidenote-1",
  "order":1,
  "page":"2",
  "anchorId":"letter-2-page-2",
  "pos":"left",
  "annotation":"am linken Rand der zweiten Seite, vertikal",
  "html":"<div class=\"lb-line-block\">…</div>"
}
```

Export all notes in source order. Astro owns the `aside`; the fragment is the body, using the same line/space/alignment renderer as main text. Preserve source position and annotation even when all notes are displayed in the left margin.

**Current omission:** letters 64 and 167 each contain a note assigned to page 4, but only page indices 1–3. The existing exporter emits **213 of 215 notes** because it iterates existing pages. Keep these two records with `anchorId: null` and a build diagnostic; an unplaced-notes fallback prevents data loss. Do not invent a page marker or change the source page number. Editorial resolution is needed for their intended placement.

On desktop, a browser layout script can measure the page-anchor position after fonts load and on resize, then align the note group in a separate left column. Multiple notes at one page stack in source order. If groups would overlap, push later groups down; exact anchor alignment and non-overlap cannot both be guaranteed for arbitrarily long notes. This remains a static site: geometry measurement needs no server.

Provide a normal-flow notes section with page links for narrow screens, unavailable anchors and a no-script fallback. Main text remains continuous. Do not add page wrappers to make marginal positioning easier.

## 6. Apparatus records

Proposed collection shape:

```json
[
  {"type":"app","id":"letter-1-app-1","ref":"4","name":"Provenienz","category":"Überlieferung & Textkritik","html":"<div class=\"lb-line-block\">…</div>"},
  {"type":"text","html":"<div class=\"lb-line-block\">.</div>"}
]
```

This illustrates record types, not letter 1's complete actual content. Each `app` body uses the same flow renderer. Astro adds headings and section wrappers below the letter. If grouping by category, group adjacent entries only to preserve ordering. Meaningful text between apps must remain a record: letters **185 and 348** contain punctuation outside `app` today.

`hasTraditions` should include meaningful free text, not only the presence of an `app`. Resolve names/categories in Python once. Use distinct IDs for apparatus pages, such as `letter-1-app-1-page-2`, so they cannot collide with main-text pages. Footnote handling remains the same as in main text until a separate relocation/linking convention is specified.

## 7. CSS and Astro responsibilities

Python owns metadata, joins, sort/filter derivations and validation. XSLT owns mixed-content normalization and stable semantic HTML. Astro owns the page/header structure. Browser scripts own index query state and marginal-note geometry. Site CSS owns fonts, column width, indentation amounts and editorial marks.

Use a global stylesheet scoped by a stable ancestor such as `.edition-text`, containing rules like `.edition-text .ul` and `.edition-text .insertion[data-pos="top"]`. Generated HTML inserted through `set:html` is not compiled as an Astro template; do not rely on automatically attached Astro scoped-style attributes. Global styles or explicit global selectors are suitable. [Astro styling](https://docs.astro.build/en/guides/styling/).

Tailwind theme variables can define fonts; `@apply` can supply utilities inside these semantic selectors. Use ordinary CSS where necessary for multiple underlines, manuscript signs or dynamically measured positions. Keep generated XSLT independent of theme utility names. If utilities are emitted directly into generated files, register their source path explicitly rather than relying on automatic detection of ignored/generated directories. Separately compiled component styles may need `@reference`; one global edition stylesheet avoids that complication. [Tailwind directives](https://tailwindcss.com/docs/functions-and-directives), [source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files), [theme variables](https://tailwindcss.com/docs/theme).

## 8. Implementation changes and verification plan

Implement in this order after agreeing the remaining editorial details:

1. Replace first-event metadata extraction with complete ordered events and a versioned catalog; derive chronological order, groups and filters.
2. Export all sidenotes regardless of target validity; export ordered apparatus records, preserving text between entries.
3. Reuse the shared XSLT flow renderer with body-only entry points for notes/apps; preserve existing classes, add agreed language attributes and scoped page IDs.
4. Improve diagnostics: missing note targets, unknown element/attribute handling, namespaced reference checks and the apparatus schema choice. Keep staged output; a failed build should stop publication rather than silently advertise complete data.
5. Test data invariants and text-flow behavior before beginning Astro presentation.

Do not remove styling tags from the schema simply because the first website has no visible rule for them. Do not replace the working normalizer or remove unrelated tooling as part of this contract change.

Current validation catches three apparatus issues because Python maps `traditions.xml` to `briefe.xsd`: direct `line` inside `align` at lines 1252 and 2728, and `page` inside `app` at line 2662. The separate `traditions.xsd` currently in the workspace allows that page marker and leaves the two line violations. Resolve these explicitly before enforcing strict schema success.

The reference checker also uses unprefixed XPath expressions for `letterText`, `letterTradition`, `hand` and `app` despite the XML namespace. Those checks miss the namespaced elements. Correcting diagnostics is necessary if the build is to rely on them; it is not proof that the current references themselves are wrong.

Verification in this review:

- Read current Python extraction, reference checks and all shared stylesheets.
- Scanned all 374 metadata records. Each currently has one sending event, one receiving event, one sending date and no receiving dates. Multiple-event support is still required by the schema and website requirements.
- Ran a synthetic multi-event/multi-date extraction probe: later events/dates were dropped; boolean `1` was mishandled for draft/proofread.
- Recomputed year groups, date precedence, source classifications and draft counts from the full corpus.
- Exported all 374 letters to a fresh temporary directory; confirmed the 213/215 sidenote discrepancy and three reported XSD warnings.
- Reused the existing flow/spacing/metadata/apparatus tests for regression evidence; browser geometry and final typography remain untested because they are not implemented here.

Acceptance checks for the later implementation should include: one catalog record per source letter, every event/date retained, deterministic sorting, identical index/detail header inputs, every note retained, a valid or explicitly unresolved note target, one marker per source page, preservation of source characters and meaningful whitespace, no flow elements inside phrasing wrappers, and correct URL-state restoration. Add fixtures for future multiple events, receiving dates, partial dates and all boolean spellings. Browser checks will cover alignment collisions, repeated tab positions, font-driven reflow and marginal-note stacking.
