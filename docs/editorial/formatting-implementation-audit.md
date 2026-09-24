# Letter formatting implementation audit

23 September 2026. Read-only audit of the current XSD, all letter-text elements in `briefe.xml`, shared XSLT, generated fragments, Astro templates, margin script and CSS. No implementation changes made. The 20 tests in `test_flow_contract` and `test_site_export` pass. Browser checks reproduced the alignment problems in letters 158 and 184. Tests establish structural preservation, not complete visual correctness.

## Confirmed problems

1. **Centered regions are not centered within the letter column when another region shares the line.** Flex layout and auto margins distribute the remaining space instead. In letter 158, “Weimar d. 14ten Aprill.” shares its line with right-aligned “verte”; its center was approximately 99px left of the line center at the preview viewport. Letter 163 has another mixed center/right line. Source: `app/src/styles/global.css`, aligned-line rules.
2. **Standalone editorial notes inside tables are not centered.** Note-only detection is implemented for ordinary lines, not individual table rows; flex rows do not center the note. In letter 184, the standalone `[Tabelle]` is left-aligned. Source: `xslt/common.xsl`, templates for `t:line` versus `t:row`.
3. **One insertion spanning semantic lines becomes multiple visually separate insertions.** The normalizer reopens the wrapper per line and CSS adds both corner signs and the direction arrow to each fragment. Letter 367 has three source insertions spanning multiple lines. Continuous font/color styles survive this splitting, but opening/closing signs need separate start/continuation/end handling. Source: `xslt/common.xsl`, `lb:wrap-element-across-lines`; insertion pseudo-elements in CSS.
4. **The legend is out of sync with the latest margin design.** Its hand example still contains “Hand”, and its sidenote example still contains a “Randnotiz / zur Seite 2” heading. Actual margin labels were simplified. Source: `app/src/pages/edition.astro`.

## Incomplete options or decisions still needed

- **`highlight/@color`:** exported as `data-color`, but all highlights receive the same yellow background. No color mapping exists. Unused in the current letters; a styling decision was not supplied.
- **`tabs/@extent`:** preserved as `data-extent` but has no layout effect. Unused in the current letters; its intended visual meaning remains unspecified.
- **`insertion/@annotation`:** preserved as `data-annotation`, but not shown or exposed through the tooltip system. Unused in the current letters; presentation remains unspecified.
- **`fn/@index`:** preserved, but no links or interaction connect footnote marks with their matching notes. All 63 current `fn` elements contain an `anchor` mark, not prose footnote text. The superscript mark works; the legend's “Fußnotentext” example is misleading for the actual corpus. No footnote interaction policy was specified.
- **Populated `nr`:** dots are absolutely positioned over the content box without reserved side space. A schema-valid `<nr>abc</nr>` would have dots overlapping its text rather than surrounding it. All 90 current occurrences are empty, so current letters do not exercise this defect.
- **Independent Latin language annotation:** `aq` correctly emits `lang="la"`; `gr`, `fr`, `hb`, `ru` emit their language attributes. There is no general source `lang` attribute or separate Latin-only element. If Latin without the sans-serif effect is required, its XML encoding is still missing.

## Coverage of all 33 schema elements

“Implemented” means the explicit requested behavior is represented in export and styles; it does not claim every schema-permitted nesting was visually checked.

| Element(s) | Status |
| --- | --- |
| `ink` | Implemented: dark blue text. |
| `subst`, `undo` | Implemented: emitted wrappers, no additional styling. |
| `aq` | Implemented: sans-serif and `lang="la"`. |
| `gr`, `fr`, `hb`, `ru` | Implemented: language attributes, no dedicated visual changes. `fr` is supported but unused. |
| `ul`, `dul`, `tul` | Single, double and triple underline rules exist. `tul` is unused; triple underline uses a double decoration plus a border. |
| `address` | Implemented: transparent wrapper; content retained. |
| `del` | Single and nested-double strike rules exist; 15 nested deletions occur. Ancestor and descendant text decorations can both paint, so the exact double-strike appearance warrants a separate visual check. |
| `note` | Gray brackets and centered standalone ordinary lines; table-row exception above. |
| `tl` | Implemented: dotted circle through `::before`. |
| `b`, `it`, `large` | Implemented: bold, italic, larger type. |
| `er` | Implemented: translucent diagonal hatching. |
| `nr` | Empty forms have hollow dots and character-based minimum width; populated-content defect above. |
| `pe` | Implemented: gray text. |
| `anchor` | Implemented: superscript. |
| `hand` | Implemented: Bodoni text and named left-margin markers, deduplicated across reopened line fragments. |
| `insertion` | Corners and small direction arrows implemented for all eight positions; multiline repetition and annotation gap above. |
| `line` | Semantic blocks, first-line indentation, horizontal rule for `type="line"`; rule type unused in current letters. |
| `vspace` | Implemented: specified number of line heights, ends the line context and resets indentation. |
| `align` | Left/right and standalone center implemented; mixed-center layout defect above. |
| `tabs`, `tab` | Fractional positions and row layout implemented; `tabs/@extent` has no effect. |
| `page` | Inline/block classification, spaced inline bar, bare left-margin number; initial page 1 suppressed. |
| `sidenote` | All 215 retained; unresolved targets in letters 64 and 167 reported and displayed. Left margin on desktop, below text on narrow screens. Collision avoidance can push a note below its exact page-anchor height. |
| `highlight` | Wrapper implemented; requested source color not applied. |
| `fn` | Content and index preserved; linking behavior not implemented. |

## Limits of this audit

- Arbitrary nesting is allowed; presence of a CSS rule alone cannot prove every combination looks correct.
- Purely visual edge cases such as nested single/double underline or nested strike propagation were inspected in code, not exhaustively screenshot-tested.
- Existing XML/source content was not changed. Unused options are distinguished from defects visible in current letters.
