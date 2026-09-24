# Styling decision checklist for letter fragments

Snapshot: 23 September 2026. This is the hand-off for specifying styles, not a style implementation. All 32 element declarations in `textelements.xsd` are covered below. Counts scan the entire current `briefe.xml`; “main” includes the `sidenote` containers themselves, while their descendants are counted in “notes”. Apparatus bodies will share these rules.

The [complete schema inventory](briefe-element-inventory.md) defines all permitted combinations. The [exact observed combinations](briefe-observed-combinations.json) includes every literal attribute tuple, including free-text annotations and reference IDs. This checklist groups values only where a common visual decision is likely; it does not discard the exact tuples.

## Tags without attributes

Each row has exactly one allowed attribute combination: no attributes. Inline styling can span semantic lines and is reopened by the normalizer.

| Tag | Main / notes occurrences | Current fragment | Decision to supply |
| --- | ---: | --- | --- |
| `ink` | 8 / 1 | `span.ink` | Ink distinction |
| `subst` | 32 / 0 | `span.subst` | Joint appearance of deletion and insertion |
| `aq` | 804 / 41 | `span.aq` | Antiqua font treatment; language relationship unresolved |
| `ul` | 963 / 64 | `span.ul` | Single underline appearance |
| `tul` | 0 / 0 | `span.tul` | Triple underline appearance (unused but allowed) |
| `undo` | 0 / 0 | `span.undo` | How restored/cancelled deletion or underlining should appear |
| `address` | 71 / 1 | `contents only` | Confirmed: transparent wrapper; retain contents |
| `del` | 262 / 9 | `del` | Deletion appearance |
| `note` | 152 / 2 | `span.note` | Editorial annotation appearance, brackets or distinction |
| `tl` | 111 / 1 | `span.tl` | Text loss: empty and nonempty forms |
| `b` | 5 / 0 | `strong` | Bold treatment |
| `it` | 113 / 0 | `em` | Italic treatment |
| `er` | 10 / 0 | `span.er` | Erasure appearance and distinction from deletion |
| `dul` | 50 / 5 | `span.dul` | Double underline appearance |
| `pe` | 26 / 6 | `span.pe` | Pencil distinction |
| `anchor` | 40 / 23 | `span.anchor` | Footnote marker appearance and interaction |
| `gr` | 25 / 2 | `span.gr` | Confirmed: language only; proposed code grc for Ancient Greek; confirm coverage |
| `hb` | 2 / 0 | `span.hb` | Confirmed: language only, he; direction is separate from lang |
| `ru` | 30 / 4 | `span.ru` | Confirmed: language only, ru |
| `large` | 2 / 0 | `span.large` | Larger-text size/line-height behavior |

## Tags with attributes

`p` = positive integer; `P` = one of the eight position strings listed below; `s` = any string; `V` = an enumerated table position. Omission is distinct from an explicit value in the source, even when the effective default is the same. No visual choices are being inferred from numeric IDs.

| Tag | All allowed attribute-presence/value patterns | Current observed values | Decision to supply |
| --- | --- | --- | --- |
| `page` | `index=p` | `index`: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`, `12`, `13`, `14` | Page marker visibility for inline and block boundaries; no page wrappers |
| `align` | `pos=left`, `pos=center`, `pos=right` | `pos`: `center`, `left`, `right` | Wrapping/collision behavior when regions share a line |
| `vspace` | `lines=p` | `lines`: `1`, `2`, `3`, `4`, `5`, `6` | Confirmed: p line-heights; breaks flow and resets indentation |
| `line` | none; `type=break`; `type=line`; `tab=p`; `type=break + tab=p`; `type=line + tab=p` | `tab`: `1`, `2`, `4`, `5`, `6`, `7`, `8` | Indent mapping for every tab code; horizontal-rule appearance |
| `sidenote` | `pos=P + page=p`; optionally also `annotation=s` | `pos`: `bottom`, `bottom left`, `bottom right`, `left`, `right`, `top`, `top left`, `top right`; `page`: `1`, `2`, `3`, `4`, `6`, `8`, `12`; `annotation`: 69 literal strings (exact JSON) | Confirmed desktop left margin at page anchor; annotation visibility, rotation and narrow-screen behavior pending |
| `insertion` | none; `pos=P`; `annotation=s`; `pos=P + annotation=s` | `pos`: `bottom`, `left`, `right`, `top` | Position-specific signs/layout; behavior without pos; annotation display |
| `fn` | `index=p` | `index`: `1`, `2`, `3`, `4`, `5`, `6`, `7`, `8` | Footnote content appearance, in-flow versus relocated, relation to anchor |
| `hand` | `ref=p` | `ref`: `1`, `3`, `4`, `7`, `9`, `10`, `11`, `12`, `18`, `20`, `21`, `25`, `33`, `46`, `51`, `62`, `87` | Whether all hands share a visual distinction or individual references differ |
| `nr` | none (default extent=1); `extent=p` | `extent`: `1`, `2`, `3`, `4`, `30` | Illegibility glyph/extent treatment; empty versus supplied content |
| `tabs` | none; `extent=p` | 6 occurrences, all without attributes; `extent` unused | Meaning of extent; overall tabular spacing |
| `tab` | `value=V` | `value`: `1-12`, `1-2`, `1-8`, `10-12`, `2-2`, `3-8`, `4-8`, `5-12`, `7-8` | Position/width rule; repeated positions and wrapping behavior |
| `highlight` | `color=s` | Unused | Color handling; current corpus has no examples |

Positions `P`: `left`, `right`, `top`, `bottom`, `top right`, `top left`, `bottom right`, `bottom left`. All are used on sidenotes; insertions currently use only the four single-direction values.

Table positions `V`: all strings `i-n` with `2 ≤ n ≤ 12` and `1 ≤ i ≤ n` (77 possibilities). Nine occur now. The schema does not define the final pixel width or a next-cell width algorithm.

Important defaults: `<line/>` and `<line type="break"/>` have the same semantic behavior; `<nr/>` and `<nr extent="1"/>` have the same effective extent. There is no default for `line/@tab`, `tabs/@extent` or insertion position. No current line explicitly has `type`; no insertion currently has an annotation; every sidenote currently has one.

## Counts for each observed finite styling variant

This expands the frequently styled positional and spacing values. These labels show only the selected styling attribute: other required attributes, such as `sidenote/@page`, are omitted from the labels, not from the source or export. IDs, page numbers and annotations remain data, not separate visual styles.

| Combination | Count | First XML example |
| --- | ---: | --- |
| `<line>` | 1679 | [Letter 1, line 9](../../data/xml/briefe.xml#L9) |
| `<line tab="1">` | 1710 | [Letter 4, line 114](../../data/xml/briefe.xml#L114) |
| `<line tab="2">` | 1 | [Letter 349, line 6301](../../data/xml/briefe.xml#L6301) |
| `<line tab="4">` | 108 | [Letter 8, line 233](../../data/xml/briefe.xml#L233) |
| `<line tab="5">` | 841 | [Letter 2, line 31](../../data/xml/briefe.xml#L31) |
| `<line tab="6">` | 46 | [Letter 42, line 880](../../data/xml/briefe.xml#L880) |
| `<line tab="7">` | 20 | [Letter 1, line 10](../../data/xml/briefe.xml#L10) |
| `<line tab="8">` | 6 | [Letter 42, line 882](../../data/xml/briefe.xml#L882) |
| `<vspace lines="1">` | 655 | [Letter 1, line 14](../../data/xml/briefe.xml#L14) |
| `<vspace lines="2">` | 68 | [Letter 1, line 11](../../data/xml/briefe.xml#L11) |
| `<vspace lines="3">` | 24 | [Letter 1, line 18](../../data/xml/briefe.xml#L18) |
| `<vspace lines="4">` | 9 | [Letter 307, line 5448](../../data/xml/briefe.xml#L5448) |
| `<vspace lines="5">` | 2 | [Letter 335, line 5931](../../data/xml/briefe.xml#L5931) |
| `<vspace lines="6">` | 2 | [Letter 335, line 5938](../../data/xml/briefe.xml#L5938) |
| `<align pos="center">` | 411 | [Letter 2, line 29](../../data/xml/briefe.xml#L29) |
| `<align pos="left">` | 4 | [Letter 278, line 4682](../../data/xml/briefe.xml#L4682) |
| `<align pos="right">` | 519 | [Letter 1, line 9](../../data/xml/briefe.xml#L9) |
| `<sidenote pos="bottom">` | 12 | [Letter 33, line 628](../../data/xml/briefe.xml#L628) |
| `<sidenote pos="bottom left">` | 4 | [Letter 46, line 999](../../data/xml/briefe.xml#L999) |
| `<sidenote pos="bottom right">` | 2 | [Letter 205, line 3507](../../data/xml/briefe.xml#L3507) |
| `<sidenote pos="left">` | 170 | [Letter 2, line 77](../../data/xml/briefe.xml#L77) |
| `<sidenote pos="right">` | 9 | [Letter 160, line 2657](../../data/xml/briefe.xml#L2657) |
| `<sidenote pos="top">` | 13 | [Letter 36, line 678](../../data/xml/briefe.xml#L678) |
| `<sidenote pos="top left">` | 3 | [Letter 13, line 422](../../data/xml/briefe.xml#L422) |
| `<sidenote pos="top right">` | 2 | [Letter 6, line 190](../../data/xml/briefe.xml#L190) |
| `<insertion>` | 36 | [Letter 2, line 30](../../data/xml/briefe.xml#L30) |
| `<insertion pos="bottom">` | 3 | [Letter 186, line 3117](../../data/xml/briefe.xml#L3117) |
| `<insertion pos="left">` | 30 | [Letter 40, line 770](../../data/xml/briefe.xml#L770) |
| `<insertion pos="right">` | 6 | [Letter 167, line 2760](../../data/xml/briefe.xml#L2760) |
| `<insertion pos="top">` | 187 | [Letter 13, line 420](../../data/xml/briefe.xml#L420) |
| `<nr>` | 77 | [Letter 54, line 1167](../../data/xml/briefe.xml#L1167) |
| `<nr extent="1">` | 5 | [Letter 67, line 1336](../../data/xml/briefe.xml#L1336) |
| `<nr extent="2">` | 2 | [Letter 137, line 2366](../../data/xml/briefe.xml#L2366) |
| `<nr extent="3">` | 1 | [Letter 113, line 2027](../../data/xml/briefe.xml#L2027) |
| `<nr extent="30">` | 2 | [Letter 176, line 2923](../../data/xml/briefe.xml#L2923) |
| `<nr extent="4">` | 3 | [Letter 112, line 2011](../../data/xml/briefe.xml#L2011) |
| `<tab value="1-12">` | 12 | [Letter 199, line 3342](../../data/xml/briefe.xml#L3342) |
| `<tab value="1-2">` | 24 | [Letter 162, line 2691](../../data/xml/briefe.xml#L2691) |
| `<tab value="1-8">` | 1 | [Letter 184, line 3002](../../data/xml/briefe.xml#L3002) |
| `<tab value="10-12">` | 2 | [Letter 199, line 3344](../../data/xml/briefe.xml#L3344) |
| `<tab value="2-2">` | 25 | [Letter 162, line 2691](../../data/xml/briefe.xml#L2691) |
| `<tab value="3-8">` | 3 | [Letter 184, line 3003](../../data/xml/briefe.xml#L3003) |
| `<tab value="4-8">` | 5 | [Letter 184, line 3003](../../data/xml/briefe.xml#L3003) |
| `<tab value="5-12">` | 4 | [Letter 199, line 3342](../../data/xml/briefe.xml#L3342) |
| `<tab value="7-8">` | 8 | [Letter 184, line 3003](../../data/xml/briefe.xml#L3003) |

## Language additions and existing content shapes

- `fr` is requested but absent from the current schema, XML and XSLT. Proposed output is a span with `lang="fr"`, without a visual language class requirement.
- No `lang` attribute or `lang` element is currently allowed on the letter-text vocabulary. The intended encoding of explicit Latin (`la`) needs to be settled. Antiqua (`aq`) already occurs around French and other non-Latin text; it cannot safely be assumed to mean Latin from existing data.
- Proposed language attributes: `ru → ru`, `hb → he`, `fr → fr`, and `gr → grc` for the inspected Ancient Greek passages. The final Greek language code should follow editorial meaning rather than the abbreviation alone.
- Keep language attributes when reopening spans across lines. Language alone should introduce no font, size, color or hyphenation change; automatic hyphenation remains off.
- Empty `tl`, `nr`, `anchor` and `fn` need an explicit display policy where they occur; empty source content must survive extraction. The schema permits empty ordinary text wrappers generally.

## Nested combinations that need compositional rules

Arbitrarily deep nesting is schema-permitted, so there is no finite exhaustive list of nested trees. All immediate parent/child combinations actually observed are enumerated below; attribute-value tuples are enumerated separately in the exact JSON. Define individual styles so they compose, then decide these semantic interactions explicitly:

- `subst` contains one or more deletions followed by one or more insertions.
- `undo` contains `del`, `ul`, `dul` or `tul`: decide whether their normal mark is suppressed, replaced or supplemented.
- Emphasis, language and hand/ink/pencil marks can overlap revisions and cross line/vspace boundaries.
- Footnote markers may occur inside footnotes; `anchor` has no linking attribute.
- Formatting can enclose a table; the normalizer carries it into cells.
- An alignment wrapper can currently contain a line indirectly through an inline child; examples occur in letters 9, 92, 226, 358 and 374. Preserve this data while normalizing; a stricter authoring rule would require an editorial migration.

| Parent | Observed direct child elements |
| --- | --- |
| `address` | `align`, `aq`, `del`, `dul`, `it`, `line`, `ru`, `subst`, `tl`, `ul`, `vspace` |
| `align` | `aq`, `del`, `dul`, `fn`, `gr`, `hand`, `ink`, `insertion`, `it`, `note`, `pe`, `ru`, `subst`, `tl`, `ul` |
| `aq` | `align`, `del`, `dul`, `fn`, `hand`, `insertion`, `line`, `nr`, `pe`, `subst`, `tl`, `ul`, `vspace` |
| `del` | `del`, `insertion`, `line`, `nr` |
| `dul` | `aq` |
| `er` | `del`, `hand`, `line`, `nr` |
| `fn` | `anchor` |
| `hand` | `address`, `align`, `aq`, `del`, `er`, `fn`, `insertion`, `line`, `note`, `nr`, `pe`, `subst`, `tl`, `ul`, `vspace` |
| `ink` | `align`, `aq`, `line`, `ul` |
| `insertion` | `aq`, `del`, `fn`, `line`, `nr` |
| `note` | `ul` |
| `pe` | `align`, `aq`, `del`, `dul`, `hand`, `line`, `note`, `nr`, `tl`, `ul`, `vspace` |
| `ru` | `line`, `ul` |
| `sidenote` | `address`, `align`, `aq`, `del`, `dul`, `fn`, `gr`, `hand`, `ink`, `insertion`, `line`, `note`, `nr`, `pe`, `ru`, `tl`, `ul`, `vspace` |
| `subst` | `del`, `insertion` |
| `tab` | `align`, `aq`, `del`, `fn`, `insertion`, `note`, `ul` |
| `tabs` | `line`, `note`, `tab`, `vspace` |
| `ul` | `aq`, `del`, `dul`, `fn`, `gr`, `insertion`, `ru` |

## Suggested format for the next styling specification

For each row, specify the normal appearance, the empty-content appearance (if relevant), and any override when nested in `subst` or `undo`. Numeric hand/footnote/page IDs only need separate rules if their visual treatment truly differs. For `line/@tab`, a small code-to-indent table will be sufficient. The later CSS can implement these rules with stable semantic selectors and Tailwind `@apply`.
