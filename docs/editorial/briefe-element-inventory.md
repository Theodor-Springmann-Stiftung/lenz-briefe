# Inventory of elements and attributes in briefe.xml

Snapshot: 23 September 2026. Scope: the letter-text branch `/opus/document/letterText`, including its containers. **35 element names are allowed; 32 occur in the current 374 letters.** `highlight`, `tul`, and `undo` are allowed but unused.

This is an inventory for the subsequent formatting discussion, not a website or a formatting specification. The current XSD governs what is allowed; observed counts describe the current XML only. Attribute order and `<tag/>` versus `<tag></tag>` do not create different combinations.

## Project context and sources

- [briefe.xml](../../data/xml/briefe.xml): transcribed letter texts, including page/line boundaries, handwriting and textual changes, marginalia, addresses, and footnotes.
- [meta.xml](../../data/xml/meta.xml): corresponding `letterDesc` records; sent/received events contain dates, people and places, followed by edition-source classifications, proofreading status and draft status.
- [traditions.xml](../../data/xml/traditions.xml): corresponding `letterTradition` records; `app/@ref` identifies categories such as provenance, previous printings, excerpts or translations in `references.xml`.
- [references.xml](../../data/xml/references.xml): person, place and apparatus-category definitions.

The three letter collections each contain 374 records and associate records by `@letter`. The requested “meat.xml” is present as `meta.xml`.

Read all six schemas: [traditions.xsd](../../data/xsd/traditions.xsd), [briefe.xsd](../../data/xsd/briefe.xsd), [textelements.xsd](../../data/xsd/textelements.xsd), [common.xsd](../../data/xsd/common.xsd), [meta.xsd](../../data/xsd/meta.xsd), [references.xsd](../../data/xsd/references.xsd). `briefe.xsd` includes the common and text-element schemas. Inclusion alone does not make the metadata vocabulary valid inside letter texts.

All elements use namespace `https://lenz-archiv.de`. Domain attributes such as `letter`, `pos`, and `index` are unqualified. Namespace declarations are not editorial attributes.

## Complete element inventory

`I` means mixed text plus any number of children from the inline group defined below; `N` means the restricted inline group. These types allow empty content as well. “None” means no domain attributes are allowed. Meanings are descriptive readings of the names, samples and legacy notes; ambiguous editorial distinctions remain for the next discussion.

| Element | Purpose / content | Allowed attributes | Occurrences |
| --- | --- | --- | ---: |
| `opus` | Root; exactly one `document` for this file | None; schema-instance metadata discussed below | 1 |
| `document` | Container; one or more `letterText` | None | 1 |
| `letterText` | Letter; mixed text, required initial `page`, then text and permitted children | Required `letter`: nonnegative integer | 374 |
| `page` | Page boundary; empty | Required `index`: positive integer | 862 |
| `line` | Line boundary or horizontal rule; empty | Optional `type`: `break` (default) or `line`; optional `tab`: positive integer | 4411 |
| `vspace` | Vertical space in whole lines; empty | Required `lines`: positive integer | 760 |
| `align` | Aligned text; N | Required `pos`: `left`, `center`, `right` | 934 |
| `sidenote` | Marginal text; I | Required `pos`: P; required `page`: positive integer; optional `annotation`: string | 215 |
| `address` | Postal address; I | None | 72 |
| `aq` | Latin-letter / Antiqua text; I | None | 845 |
| `gr` | Greek-letter text; I | None | 27 |
| `hb` | Hebrew-letter text; I | None | 2 |
| `ru` | Russian-letter text; I | None | 34 |
| `b` | Bold text; I | None | 5 |
| `it` | Italic text; I | None | 113 |
| `large` | Larger text; I | None | 2 |
| `ul` | Underlined text; I | None | 1027 |
| `dul` | Doubly underlined text; I | None | 55 |
| `tul` | Triply underlined text; I | None | 0 |
| `highlight` | Highlighted text; I | Required `color`: unrestricted string | 0 |
| `del` | Deleted/struck-through text; I | None | 271 |
| `er` | Erasure; distinction from del to confirm; I | None | 10 |
| `insertion` | Inserted text; I | Optional `pos`: P; optional `annotation`: string | 262 |
| `subst` | Substitution; one or more `del`, then one or more `insertion`; no direct text | None | 32 |
| `undo` | Cancelled deletion/underlining; one or more `del`, `ul`, `tul`, `dul` in any order; no direct text | None | 0 |
| `hand` | Text assigned to a hand; I | Required `ref`: positive integer | 49 |
| `ink` | Ink-related distinction; precise editorial meaning to confirm; I | None | 9 |
| `pe` | Pencil text; I | None | 32 |
| `note` | Editorial note; I | None | 154 |
| `tl` | Text loss; I | None | 112 |
| `nr` | Undeciphered text; I | Optional `extent`: positive integer, default `1` | 90 |
| `anchor` | Footnote marker; no ref attribute; I | None | 63 |
| `fn` | Footnote; I | Required `index`: positive integer | 63 |
| `tabs` | Tabular layout; mixed text, I children and `tab` | Optional `extent`: positive integer; no default | 6 |
| `tab` | Tabular cell/position; N | Required `value`: V | 84 |

### Complete attribute-value domains

- **P** = `left`, `right`, `top`, `bottom`, `top right`, `top left`, `bottom right`, `bottom left`. These are exact strings, including spaces.
- **V** = every string `i-n` for integers `2 ≤ n ≤ 12` and `1 ≤ i ≤ n`: `1-2`, `2-2`; `1-3`, `2-3`, `3-3`; …; `1-12` through `12-12`. This describes all **77 enumerated values** exactly. `0-3`, `1-1` and `1-13` are not allowed.
- Positive integer = `1, 2, 3, …`; nonnegative integer = `0, 1, 2, …`. There is no schema upper bound for these numeric attributes.
- String = unrestricted XML Schema string, including the empty string. In particular, the schema does not validate `highlight/@color` as a CSS color.

### All allowed attribute combinations

Here `p` is a positive integer, `z` a nonnegative integer, `s` any string, `P` and `V` the domains above. Each row enumerates all attribute-presence combinations for that element; placeholders range independently over their domains, subject to the uniqueness constraints below. Numeric IDs and free text make a literal list of every possible value tuple infinite.

| Element | Complete combinations (start tags / empty tags) |
| --- | --- |
| `letterText` | `<letterText letter="z">` |
| `page` | `<page index="p"/>` |
| `line` | `<line/>`; `<line type="break"/>`; `<line type="line"/>`; `<line tab="p"/>`; `<line type="break" tab="p"/>`; `<line type="line" tab="p"/>` |
| `vspace` | `<vspace lines="p"/>` |
| `align` | `<align pos="left">`; `<align pos="center">`; `<align pos="right">` |
| `sidenote` | `<sidenote pos="P" page="p">`; `<sidenote pos="P" page="p" annotation="s">` |
| `insertion` | `<insertion>`; `<insertion pos="P">`; `<insertion annotation="s">`; `<insertion pos="P" annotation="s">` |
| `fn` | `<fn index="p">` |
| `hand` | `<hand ref="p">` |
| `nr` | `<nr>`; `<nr extent="p">` |
| `tabs` | `<tabs>`; `<tabs extent="p">` |
| `tab` | `<tab value="V">` |
| `highlight` | `<highlight color="s">` |

All remaining elements in the inventory have exactly one domain-attribute combination: **no attributes**. This includes `anchor`, `subst`, `undo`, and every simple text wrapper. Attributes do not transfer between elements: for example, `tl/@extent`, `anchor/@ref`, and `del/@annotation` are not allowed.

Omitted `line/@type` means `break`; omitted `nr/@extent` means `1`. Omitted `line/@tab`, `insertion/@pos`, annotations and `tabs/@extent` have no schema default. A non-validating XML reader may not materialize defaults, so their meanings must be retained when subsequently interpreting the text.

### XML infrastructure attributes

The actual root is:

```xml
<opus xmlns="https://lenz-archiv.de"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="https://lenz-archiv.de ../xsd/briefe.xsd">
```

`xsi:schemaLocation` is schema-instance metadata, not a domain attribute declared on `opus`; its omission is also possible. XML Schema additionally permits standard schema-instance machinery (`xsi:type`, `xsi:nil`, `xsi:noNamespaceSchemaLocation`) under its own rules. This inventory enumerates the declared editorial vocabulary, not arbitrary XML namespace declarations or all schema-instance type overrides. No element is declared nillable, and no wildcard permits arbitrary application attributes (including `xml:id` or `xml:lang`).

## Nesting and content rules

The inline group **I** consists of exactly these 29 elements:

```
line vspace align aq ul tul highlight undo address insertion del hand
note tl dul fn pe anchor nr b it gr hb subst tabs er ink large ru
```

- `letterText` must begin with a `page` **as its first child element**. Text is allowed by its mixed content model. After that, it allows any number of I elements, `page`, and `sidenote` in any order, interspersed with text.
- Ordinary I wrappers allow text and any number of I children, recursively. Nested combinations such as `<aq><ul>…</ul></aq>` and `<del><nr extent="3"/></del>` are therefore possible. There is no finite list of all nested trees.
- **N** is I minus `line`, `vspace`, and `undo`. It governs immediate children of `align` and `tab`. This restriction is not transitive: `<align pos="left"><aq><line/></aq></align>` is allowed because `aq` uses I.
- `page` and `sidenote` are allowed only directly in `letterText`, not inside I wrappers.
- `tab` is allowed only directly in `tabs`. `tabs` itself is in I, so nested tabular structures are possible.
- `subst` requires all direct `del` children before all direct `insertion` children. Both groups contain at least one element.
- `undo` requires at least one direct child from `del`, `ul`, `tul`, `dul`; these may repeat in any order.
- `page`, `line`, and `vspace` cannot contain text or child elements. `opus`, `document`, `subst` and `undo` have element-only content (formatting whitespace is allowed).
- `letterText/@letter` is unique within `document`; `page/@index` is unique within a letter. Neither rule requires consecutive numbering.
- The XSD does **not** enforce referential integrity for `sidenote/@page` or `hand/@ref`, or uniqueness of `fn/@index`. `anchor` carries content rather than an explicit reference attribute; the current examples include `<fn index="5"><anchor>#</anchor></fn>`.

## Observed combinations in the current letters

The accompanying [exact observed combinations](briefe-observed-combinations.json) enumerate all 553 distinct element/explicit-attribute-value tuples, including all IDs and free-text annotations, with counts and first examples. This supplements the readable attribute-name table below; it does not limit schema-permitted future values.

This table lists every distinct **attribute-name set** actually present, with a count and the source line of its first example. Attribute values are summarized separately below. These are observations, not additional restrictions.

| Element | Attributes present | Count | First example in briefe.xml |
| --- | --- | ---: | --- |
| `opus` | `xsi:schemaLocation` | 1 | [ line 4 ](../../data/xml/briefe.xml#L4) |
| `document` | None | 1 | [ line 5 ](../../data/xml/briefe.xml#L5) |
| `letterText` | `letter` | 374 | [ line 7, letter 1 ](../../data/xml/briefe.xml#L7) |
| `page` | `index` | 862 | [ line 8, letter 1 ](../../data/xml/briefe.xml#L8) |
| `line` | None | 1679 | [ line 9, letter 1 ](../../data/xml/briefe.xml#L9) |
| `line` | `tab` | 2732 | [ line 10, letter 1 ](../../data/xml/briefe.xml#L10) |
| `vspace` | `lines` | 760 | [ line 11, letter 1 ](../../data/xml/briefe.xml#L11) |
| `align` | `pos` | 934 | [ line 9, letter 1 ](../../data/xml/briefe.xml#L9) |
| `sidenote` | `annotation`, `page`, `pos` | 215 | [ line 77, letter 2 ](../../data/xml/briefe.xml#L77) |
| `address` | None | 72 | [ line 99, letter 3 ](../../data/xml/briefe.xml#L99) |
| `aq` | None | 845 | [ line 9, letter 1 ](../../data/xml/briefe.xml#L9) |
| `gr` | None | 27 | [ line 588, letter 29 ](../../data/xml/briefe.xml#L588) |
| `hb` | None | 2 | [ line 6638, letter 364 ](../../data/xml/briefe.xml#L6638) |
| `ru` | None | 34 | [ line 6479, letter 358 ](../../data/xml/briefe.xml#L6479) |
| `b` | None | 5 | [ line 4193, letter 251 ](../../data/xml/briefe.xml#L4193) |
| `it` | None | 113 | [ line 381, letter 9 ](../../data/xml/briefe.xml#L381) |
| `large` | None | 2 | [ line 1660, letter 90 ](../../data/xml/briefe.xml#L1660) |
| `ul` | None | 1027 | [ line 101, letter 3 ](../../data/xml/briefe.xml#L101) |
| `dul` | None | 55 | [ line 618, letter 32 ](../../data/xml/briefe.xml#L618) |
| `del` | None | 271 | [ line 30, letter 2 ](../../data/xml/briefe.xml#L30) |
| `er` | None | 10 | [ line 2923, letter 176 ](../../data/xml/briefe.xml#L2923) |
| `insertion` | None | 36 | [ line 30, letter 2 ](../../data/xml/briefe.xml#L30) |
| `insertion` | `pos` | 226 | [ line 420, letter 13 ](../../data/xml/briefe.xml#L420) |
| `subst` | None | 32 | [ line 30, letter 2 ](../../data/xml/briefe.xml#L30) |
| `hand` | `ref` | 49 | [ line 126, letter 4 ](../../data/xml/briefe.xml#L126) |
| `ink` | None | 9 | [ line 181, letter 6 ](../../data/xml/briefe.xml#L181) |
| `pe` | None | 32 | [ line 1152, letter 54 ](../../data/xml/briefe.xml#L1152) |
| `note` | None | 154 | [ line 98, letter 3 ](../../data/xml/briefe.xml#L98) |
| `tl` | None | 112 | [ line 1668, letter 91 ](../../data/xml/briefe.xml#L1668) |
| `nr` | None | 77 | [ line 1167, letter 54 ](../../data/xml/briefe.xml#L1167) |
| `nr` | `extent` | 13 | [ line 1336, letter 67 ](../../data/xml/briefe.xml#L1336) |
| `anchor` | None | 63 | [ line 750, letter 40 ](../../data/xml/briefe.xml#L750) |
| `fn` | `index` | 63 | [ line 750, letter 40 ](../../data/xml/briefe.xml#L750) |
| `tabs` | None | 6 | [ line 2690, letter 162 ](../../data/xml/briefe.xml#L2690) |
| `tab` | `value` | 84 | [ line 2691, letter 162 ](../../data/xml/briefe.xml#L2691) |

### Observed attribute values

- `letterText/@letter`: 374 distinct values (see source).
- `page/@index`: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14`.
- `line/@tab`: `1`, `2`, `4`, `5`, `6`, `7`, `8`.
- `vspace/@lines`: `1`, `2`, `3`, `4`, `5`, `6`.
- `align/@pos`: `center`, `left`, `right`.
- `sidenote/@pos`: `bottom`, `bottom left`, `bottom right`, `left`, `right`, `top`, `top left`, `top right`.
- `sidenote/@page`: `1`, `2`, `3`, `4`, `6`, `8`, `12`.
- `sidenote/@annotation`: 69 distinct values (see source).
- `insertion/@pos`: `bottom`, `left`, `right`, `top`.
- `hand/@ref`: `1`, `3`, `4`, `7`, `9`, `10`, `11`, `12`, `18`, `20`, `21`, `25`, `33`, `46`, `51`, `62`, `87`.
- `nr/@extent`: `1`, `2`, `3`, `4`, `30`.
- `fn/@index`: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`.
- `tab/@value`: `1-12`, `1-2`, `1-8`, `10-12`, `2-2`, `3-8`, `4-8`, `5-12`, `7-8`.

All eight `sidenote/@pos` values are used. Every current sidenote has `annotation`, although it is optional. No current insertion has `annotation`. No current line explicitly specifies `type`; all use its default `break`. No current `tabs` has `extent`.

## Differences and open semantic points for the next step

- [docs/OPUS.md](../OPUS.md) describes an older, broader vocabulary (and refers to the Hamann project). Current examples of differences: `align/@pos` replaces the documented `@value`; `anchor/@ref` is not allowed; `line/@type="empty"` is not allowed; tab positions start at 1 rather than the legacy examples starting at 0. `added`, `sub`, `super`, `ful`, `sal`, `datum`, `ps`, `sig`, `link`, `intlink`, and `wwwlink` are not allowed within current letter texts.
- `traditions`, `letterTradition`, and `app` belong to the alternative `/opus/traditions` branch of `briefe.xsd`; they are not allowed inside `/opus/document`. `opus` chooses exactly one branch, so both cannot appear together in a schema-valid file. They are excluded from the 35-element letter inventory.
- Metadata elements such as `sent`, `received`, `date`, `person`, `location`, `tradition`, `isProofread`, and `isDraft`, and reference definitions, belong to separate schemas/files rather than the letter-text inventory.
- The exact visual treatment of ink, pencil, erasure versus deletion, illegibility extent, text loss, footnotes, and table positions remains to be specified. The schema sets structure and value domains, not a complete rendering convention. Legacy notes refer `hand/@ref` to `handDefs`, but the current reference file has no such collection; resolving hand references should be explicitly settled later.

For completeness, if “can occur in briefe.xml” means either branch accepted by `briefe.xsd`, the alternative branch adds these three names, making **38 names across both possible branches**:

| Element | Complete domain-attribute combination | Content under briefe.xsd |
| --- | --- | --- |
| `traditions` | No attributes | Zero or more `letterTradition` children |
| `letterTradition` | Required `letter="z"` | Mixed text and zero or more `app` children |
| `app` | Required `ref="z"` | Mixed text and I children |

Here `z` is a nonnegative integer. These three elements do not occur in the actual `briefe.xml`; they occur in `traditions.xml`. The separate `traditions.xsd` additionally permits `page` directly inside `app`.

## Verification

Parsed the full current letter XML, counted elements/attributes without inserting schema defaults, and checked the inventory against every global declaration in the letter/text schemas. `briefe.xml`, `meta.xml`, and `references.xml` validate against their respective XSDs.

The contextual validation of `traditions.xml` against `briefe.xsd` (the schema currently selected by both exporters) reports three existing failures: a disallowed `line` inside `align` at source lines 1252 and 2728, and a disallowed `page` at line 2662. The separate `traditions.xsd` currently present in the workspace allows the apparatus page marker, leaving the two `align/line` failures. These do not affect the validated `briefe.xml` inventory. No source XML, schemas, or rendering code were changed.

See [XSLT and exporter analysis](xslt-transform-analysis.md) for current HTML mappings, processing stages, and remaining rendering decisions.
