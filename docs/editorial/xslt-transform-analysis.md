# XSLT and exporter analysis

Snapshot: 23 September 2026. Read the current XML, all six XSD files, the four stylesheets, and both exporter implementations. This describes existing behavior for the later formatting discussion; it does not prescribe a website design.

The complete letter vocabulary and permitted attribute combinations are in [the element inventory](briefe-element-inventory.md). [The observed-combinations JSON](briefe-observed-combinations.json) contains every exact element/explicit-attribute-value tuple currently used.

## Data model

All four source files use `https://lenz-archiv.de` as their element namespace. The three letter collections each contain 374 records, connected by `@letter`:

| File | Record | Role |
| --- | --- | --- |
| `data/xml/briefe.xml` | `opus/document/letterText` | Mixed-content transcription, including revisions, page and line milestones, marginalia and footnotes |
| `data/xml/meta.xml` | `opus/descriptions/letterDesc` | Sending/receiving events, date uncertainty, people, places, edition-source classifications, proofreading and draft flags |
| `data/xml/traditions.xml` | `opus/traditions/letterTradition` | Apparatus prose in `app` entries, including provenance, previous editions and supplementary material |
| `data/xml/references.xml` | `opus/definitions` | Person, location and apparatus definitions, keyed by `@index` |

`app/@ref` points to an apparatus definition with a name and category. Metadata person/location references point to the corresponding definitions. The source classification in `meta.xml/traditions/tradition` describes the basis of the edited text; it is distinct from the fuller prose in `traditions.xml`.

Representative passages inspected include letter 1's alignment and mid-sentence page boundary, letter 2's substitution and verse lines, letter 4's different hand, letter 162's table, and apparatus entries with quoted text and nested formatting. The requested `meat.xml` is understood as `meta.xml`.

## Where the transformation lives

The XSLT is in the repository-level `xslt/` directory. `transform/python/` and `transform/js/` contain two runners sharing those stylesheets.

| Stylesheet | Input passed by exporter | Responsibility |
| --- | --- | --- |
| `xslt/letter-text.xsl` | One serialized `letterText` element | Pass its children through shared flow rendering |
| `xslt/sidenotes.xsl` | One serialized `sidenote`, plus `letter` and `sidenoteId` parameters | Render an `aside.sidenote` with identifying attributes and shared flow rendering inside |
| `xslt/traditions.xsl` | One serialized `letterTradition`, plus `letter` and JSON `appDefinitions` parameters | Group adjacent apparatus entries by category, add headings, and render their contents |
| `xslt/common.xsl` | Imported by all three entry points | Normalize milestones and nested text into line/table structures, classify page boundaries, then emit HTML |

These are XSLT 3.0 stylesheets: they use functions, maps, iteration and JSON parsing. They are invoked through `xsl:initial-template`, with each individual record as the source document root. Passing the entire `briefe.xml` directly to the letter entry point is not the intended calling contract.

The Python implementation uses `lxml` for parsing, validation and extraction, and SaxonC for XSLT. It caches compiled executables in memory; its current compilation path still compiles from the XSL file, even though it also checks/writes a `.sef.json` cache path. The JavaScript implementation compiles with `xslt3` and runs the cached SEF through SaxonJS. Both consider the entry stylesheet and `common.xsl` modification times when checking caches.

## Export sequence and products

1. Read all four XML files, build reference maps, and collect schema/reference warnings.
2. Extract metadata and apparatus records keyed by `@letter`.
3. For each letter text, render its body, apparatus and individual sidenotes.
4. Write per-letter artifacts and a numerically sorted letter index into a staging directory.
5. Write status information and replace the requested output directory with the staged result.

Successful exports produce:

```text
<output>/status.json
<output>/letters/index.json
<output>/letters/<letter-number>/meta.json
<output>/letters/<letter-number>/text.html
<output>/letters/<letter-number>/sidenotes.json
```

`meta.json` includes resolved people/places, date attributes, source classifications, flags, page indices, presence flags and `traditionsHtml`. The letter index contains the metadata without `traditionsHtml`. `sidenotes.json` is an object keyed by source page number; each entry has `id`, `order`, `letter`, `page`, `pos`, `annotation` and rendered `html`. Pages without notes have empty arrays.

Only records present in `briefe.xml` drive per-letter exports. Missing metadata receives fallback values; missing apparatus receives an empty traditions section. Schema and reference findings are warnings, not an automatic stop. Fatal parse/transform failures cause the normal runner to publish a failure-only `status.json`, replacing previous generated output. No export was run into the application output directory for this analysis.

The JavaScript README has two stale descriptions: the code does not currently write `stats.json`, and the current page marker has no separate `.lb-page` element. Source commit information and collection counts are in `status.json`.

## How the shared flow renderer works

`lb:render-flow` has three stages:

1. **Normalize the mixed XML into semantic lines.** A state machine accumulates content until a `line` or vertical-space boundary. Source-file newlines are text whitespace; they do not define transcription lines. Missing `line/@type` is treated as `break`.
2. **Classify page milestones before distributing alignment.** A milestone with meaningful content both before and after it in its semantic line receives `data-break="inline"`; otherwise it receives `block`. Empty editorial marks also count as content. Trailing markers can move across a line boundary without creating blank lines.
3. **Emit HTML blocks and inline markup.** Formatting wrappers that span lines are reopened inside the resulting blocks. Formatting around tables is carried into cells, avoiding table `div`s inside inline wrappers.

For example, letter 1 contains `… und <page index="2"/>lasse mich …`: this is a continuing text line with an inline page marker, not two separate page containers.

Alignment is resolved into occupied left, center and right regions. Ordinary unaligned text belongs to the left region. Nested formatting is preserved as text is distributed; this can change the HTML order to left/center/right region order. Table cells keep their own alignment context. `address` is deliberately transparent, and sidenotes are excluded from the main flow.

`tabs` is normalized into rows using its contained line boundaries. Cells retain their encoded `value`; the stylesheet does not implement their final column geometry. Existing letter 293 has consecutive cells at the same position, so a later layout must not assume strictly increasing cell positions.

## Complete current rendering map for the letter vocabulary

The following describes generated markup, not the final CSS appearance. `X` below means the original element name.

| Source element(s) | Existing output / handling |
| --- | --- |
| `opus`, `document` | Traversed by exporter selection; no matching output containers |
| `letterText` | Record boundary for exporter; its children become the HTML fragment |
| `page index="N"` | Empty `span.page-anchor`, `id="page-N"`, `data-index="N"`, `data-break="inline\|block"`; no visible separator inserted |
| `line`, `line type="break"` | Begin a semantic `div.lb-line-block`; optional `tab` becomes `data-tab` |
| `line type="line"` | Rule block with `hr.lb-rule`; optional `data-tab` retained |
| `vspace lines="N"` | `div.lb-vspace`, `data-lines="N"`, inline `height: Nlh`, `aria-hidden="true"`; ends the current line and resets indentation |
| `align pos="…"` | Normally becomes an occupied `div.align-left`, `.align-center` or `.align-right` within a line marked `data-layout="aligned"`; a direct fallback template emits `span.align[data-pos]` |
| `tabs` | `div.tabs`, optional `data-extent`, containing `div.lb-tab-row` rows |
| `tab value="…"` | `div.tab[data-value]`; children rendered with their own alignment context |
| `sidenote` | Omitted from body; separate `aside.sidenote` with `id`, `data-letter`, `data-page`, `data-pos`, `data-annotation` |
| `address` | Children retained; wrapper removed |
| `aq`, `ul`, `tul`, `dul`, `undo`, `note`, `tl`, `pe`, `anchor`, `gr`, `hb`, `er`, `ink`, `large`, `ru`, `subst` | `span` with class `X`, preserving rendered children |
| `b` | `strong` |
| `it` | `em` |
| `del` | `del` |
| `highlight color="…"` | `mark.highlight[data-color]`; source color is not applied as an inline CSS color |
| `insertion` | `span.insertion`, optional `data-pos` and `data-annotation`; no insertion marks added |
| `hand ref="…"` | `span.hand[data-ref]`; no person-name lookup in XSLT |
| `fn index="…"` | `span.fn[data-index]` at its source position; no automatic footnote relocation |
| `nr` | `span.nr[data-extent]`, with explicit extent or default `1`; whitespace-only child text removed, no illegibility glyph added |

The XSLT does not automatically link `anchor` to `fn`, resolve a hand into a label, set language/direction attributes for Greek/Hebrew/Russian, visualize empty text-loss markers, or cancel the appearance of a deletion inside `undo`. These require later display rules. Some native HTML choices (`strong`, `em`, `del`, `mark`) already carry browser defaults; most editorial distinctions are CSS hooks only.

The default XSLT mode uses `shallow-skip`: an unmatched element has its wrapper omitted while processing descendants. Unsupported markup can therefore lose its distinction without a transform error. The coverage check verifies named handlers for the 29 members of `inlineElements`; it does not prove coverage of every allowed attribute, nesting combination, or visual convention.

## Apparatus and marginal notes

`traditions.xsl` preserves source ordering by grouping **adjacent** `app` entries with the same resolved category. A category can therefore appear in more than one section. Category headings use `h2`; each `app` gets `div.tradition-app[data-ref][data-name]` and an `h3` unless its name equals the category heading. Missing definitions fall back to `Weitere Angaben` and `Apparat N`. Meaningful text between entries remains in order.

Apparatus bodies use the same flow renderer as letter texts. Their page marker IDs use `app-N-page-M` to avoid clashing with the main body's `page-M`. These IDs are scoped for a view containing one letter's fragments; combining several letters into one page would require further ID scoping.

Sidenotes are selected by matching `sidenote/@page` to a source page index. Their source order within that page is retained. They carry positional metadata, but the XSLT does not perform marginal placement or rotation. A sidenote pointing to a nonexistent page would not enter an exported page array; the letter XSD itself does not check that relationship.

## Current findings and limits

- `briefe.xml`, `meta.xml` and `references.xml` validate against their schemas.
- Both exporters still validate `traditions.xml` against `briefe.xsd`. This reports three warnings: `line` directly inside `align` at source lines 1252 and 2728, and `page` in an apparatus entry at line 2662.
- The separate `data/xsd/traditions.xsd` currently in the workspace allows that apparatus page marker. Validation against it leaves the two `align/line` errors. Neither source data nor schema selection was changed here.
- Metadata extraction takes only the first `sent`, first `received`, and first date within each, although the schema permits multiple events and dates. It preserves arrays of people and places within the selected events. The reference role attribute `kat` is not exported by `resolve_refs`.
- Schema defaults are not universally inserted into parsed data. XSLT handles defaults for `line/@type` and `nr/@extent`; metadata attributes such as omitted `cert` can remain null in JSON. `isProofread`/`isDraft` extraction currently recognizes the lexical string `true`, whereas XSD booleans also permit `1`.
- Legacy `docs/OPUS.md` describes a broader vocabulary and contains Hamann-project references. The current XSD and XML are the appropriate authority for this inventory.
- The letter corpus has 35 permitted element names including its three containers, 32 observed names, 374 letters, 862 page milestones and 215 sidenotes. The unused permitted elements are `highlight`, `tul`, and `undo`.

## Verification performed

- Parsed the full XML, independently recounted every element, and checked the inventory's counts.
- Recorded all 553 distinct explicit element/attribute-value combinations without inserting defaults.
- Validated the four source files, including both schema choices for apparatus data.
- Ran the existing inline-handler coverage check: all 29 shared inline elements covered.
- Ran the existing Python `test_flow_contract`, `test_spacing`, `test_traditions`, `test_metadata` and `test_tradition_metadata` modules: **29 tests passed**, including corpus rendering checks. The JavaScript runner was inspected, not executed.

The next discussion can assign visual behavior to the inventory's elements, positional variants, nesting combinations and empty markers. The current transformation already exposes many of the necessary distinctions, while address boundaries and several metadata distinctions are not retained in its output.
