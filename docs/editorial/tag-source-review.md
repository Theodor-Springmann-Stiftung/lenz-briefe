# Editorial review: formatting tags versus source basis

Snapshot: 22 September 2026. Scanned all 374 `letterText` records in `briefe.xml`, including every descendant and all 215 sidenotes; joined metadata and provenance by `@letter`. This report makes no changes to XML, metadata, schemas, transforms or styles.

**Result: 7 provisional mismatching occurrences in 2 letters; 2 source-sensitive occurrences in 1 mixed-source letter; 4 letters with unknown source type; and 2 secondary text-loss cases in 1 print-based letter. An additional source-description edge case occurs in letter 55. The manual review queue contains 9 distinct letters.**

## Coverage and exhaustiveness

**Yes: the tag audit is exhaustive for the current `briefe.xml` under the working classifications below.** It covers all 374 letters, all 215 sidenotes, and all 10,601 descendant text-element occurrences. All 32 text tags declared in `textelements.xsd` have a classification, including the three unused tags. Every letter was matched to its metadata and provenance by `@letter`; every occurrence count in the table was independently rechecked.

The complete rule-based review includes:

- Every Print-classified tag in a manuscript-only letter and every Manuscript-classified tag in a print-only letter: **7 occurrences in letters 36 and 251**.
- Every Print- or Manuscript-classified tag in a mixed-source letter: **2 occurrences in letter 39**.
- Every letter whose source type is unknown: **letters 32, 56, 296 and 338**. Their ten underlining and illegibility markers are individually located below.
- Every `tl` or `nr` occurrence in a print-only letter, as a supplementary check: **2 `tl` occurrences in letter 235**.

Letter 55 adds two source-description notes as contextual evidence. In total, **23 passages have individually verified locations**, alongside the source-only review of letter 56 and the local section headings cited below.

**This is not an exhaustive inventory of every possible editorial inconsistency.** It tests tag names against the recorded source types using provisional meanings. It does not establish the correct meaning of every tag or attribute, verify the original manuscripts or prints, or prove that the metadata is correct. The additional contextual examples are review clues, not a guarantee that every ambiguity in free-text notes or provenance has been identified. Apparatus prose in `traditions.xml/app` was consulted for provenance; it was not audited as letter transcription. A change to the working classifications would require rerunning the comparison.

## How to interpret the classifications

This is a deliberately provisional editorial audit. **Print** treats `b` and `it` as literal printed typography, following the proposed convention. **Manuscript** treats writing materials, changes of hand and revisions as direct manuscript features. **Both** covers medium-independent markup. None of these restrictions is enforced by the current XSD.

The flags test those working interpretations rather than proving that the tags or metadata are wrong. A print may report manuscript revisions, and a manuscript transcription may use typographic conventions. For each flagged passage, decide whether the local tag meaning, source classification, or passage-level provenance explains it. No formatting should be suppressed on the strength of this report.

`type` describes the basis of this edition, not every surviving witness. A non-original manuscript is still a manuscript. `isOriginal` is reported separately and never used to infer `type`. Mixed sources are not resolved by choosing the first source. Unknown sources remain unclassified.

The report uses the handwritten/printed distinction only for letter text (including its sidenotes). Editorial prose in `traditions.xml/app` has its own context and must not inherit restrictions from the corresponding letter. It was read here for provenance evidence, not treated as a transcription of that same physical source.

## Complete tag classification and observed occurrence counts

Counts are element occurrences, not numbers of letters. Zero includes tags permitted by the schema but unused. Source populations: 320 manuscript-only letters, 49 print-only, 1 mixed, 4 unknown.

| Tag | Working expectation | Manuscript | Print | Mixed | Unknown | Reason / qualification |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `aq` | Both | 682 | 159 | 4 | 0 | Latin-letter/Antiqua distinction can be encoded in either medium; it does not establish the language. |
| `gr` | Both | 26 | 1 | 0 | 0 | Greek passage. |
| `hb` | Both | 2 | 0 | 0 | 0 | Hebrew passage. |
| `ru` | Both | 34 | 0 | 0 | 0 | Russian passage. |
| `b` | Print | 5 | 0 | 0 | 0 | Working hypothesis: bold type. A handwriting/emphasis convention would broaden this to both. |
| `it` | Print | 2 | 109 | 2 | 0 | Working hypothesis: italic type. A handwriting/emphasis convention would broaden this to both. |
| `large` | Both | 2 | 0 | 0 | 0 | Larger writing or larger type. |
| `ul` | Both | 1019 | 0 | 0 | 8 | Underlining is meaningful in either medium; it is common in the present manuscript transcriptions. |
| `dul` | Both | 54 | 0 | 0 | 1 | Double underlining; retain even when transmitted by a printed source. |
| `tul` | Both | 0 | 0 | 0 | 0 | Triple underlining; currently unused. |
| `highlight` | Both | 0 | 0 | 0 | 0 | Color/highlighting could encode a source or editorial distinction; exact convention remains open. |
| `del` | Manuscript | 271 | 0 | 0 | 0 | Working hypothesis: a cancellation in the written source. A print can also report one. |
| `er` | Manuscript | 10 | 0 | 0 | 0 | Working hypothesis: physical erasure in the written source. |
| `insertion` | Manuscript | 262 | 0 | 0 | 0 | Working hypothesis: an addition to the written source, possibly with a physical position. |
| `subst` | Manuscript | 32 | 0 | 0 | 0 | Working hypothesis: manuscript replacement, expressed by del plus insertion. |
| `undo` | Manuscript | 0 | 0 | 0 | 0 | Working hypothesis: cancelled deletion/underlining in the written source; currently unused. |
| `hand` | Manuscript | 49 | 0 | 0 | 0 | Identification/change of a writing hand. |
| `ink` | Manuscript | 9 | 0 | 0 | 0 | A distinction in writing ink; exact local meaning still needs confirmation. |
| `pe` | Manuscript | 32 | 0 | 0 | 0 | Pencil writing. |
| `note` | Both | 132 | 17 | 3 | 2 | Editorial note independent of the medium. |
| `tl` | Both | 110 | 2 | 0 | 0 | Text loss can be recorded or transmitted in either medium; print occurrences are listed as secondary review cases. |
| `nr` | Both | 89 | 0 | 0 | 1 | Illegibility can concern either medium or be reported through a print; preserve its extent. |
| `anchor` | Both | 63 | 0 | 0 | 0 | Footnote marker. |
| `fn` | Both | 63 | 0 | 0 | 0 | Footnote content. |
| `address` | Both | 67 | 4 | 1 | 0 | An address can be transcribed from either medium. |
| `page` | Both | 808 | 49 | 1 | 4 | Page milestone in the source used for the transcription. |
| `line` | Both | 3913 | 478 | 9 | 11 | Semantic line boundary or horizontal rule. |
| `vspace` | Both | 686 | 70 | 3 | 1 | Semantic vertical spacing. |
| `align` | Both | 814 | 113 | 4 | 3 | Left, center or right alignment. |
| `tabs` | Both | 6 | 0 | 0 | 0 | Tabular layout. |
| `tab` | Both | 84 | 0 | 0 | 0 | Positioned cell in a tabular layout. |
| `sidenote` | Both | 215 | 0 | 0 | 0 | Marginal material, whether handwritten or printed. |

`opus`, `document`, and `letterText` are structural wrappers applicable to both media. The companion-file wrappers `traditions`, `letterTradition`, and `app` are also independent of medium. `fr` and an explicit Latin-language element are not currently declared in the text schema; French/Latin language markup would be applicable to both media. They are not counted as existing tags.

## Review queue

| Letter | Category | What to inspect |
| --- | --- | --- |
| [36](#letter-36) | Provisional mismatch | Two italic spans despite manuscript-only metadata; provenance explicitly distinguishes contributions. |
| [251](#letter-251) | Provisional mismatch | Five bold spans under an explicit “Gedruckter Text” heading despite manuscript-only metadata. |
| [39](#letter-39) | Mixed-source ambiguity | First italic span is in the labelled printed circular; the second is in the address. |
| [55](#letter-55) | Source-description edge case | Print-based transcription contains two handwritten-section labels. |
| [32](#letter-32) | Unknown source | Six underlinings and one double underlining; provenance describes handwritten excerpts. |
| [56](#letter-56) | Unknown source | No source-sensitive tag conflict; clarify the basis described through an auction catalogue. |
| [296](#letter-296) | Unknown source | One illegibility marker; determine how it entered the edited text. |
| [338](#letter-338) | Unknown source | Two underlinings in a quotation transmitted through another letter. |
| [235](#letter-235) | Secondary edge case | Two text-loss markers in a print-based text; not a contradiction under the Both classification. |

## Individual passages

The source links open at the exact line. Where several tags share a line, the per-letter tag occurrence number and namespace-aware XPath identify the individual occurrence. In the excerpts, `⟦…⟧` highlights the tag under review; for an empty element its XML spelling is shown. These brackets are review notation only.

### Letter 36

**Provisional mismatch.** Are the italics from the printed Röderer portion, an editorial convention, or the manuscript? The provenance description gives a concrete reason to check whether one letter-level source type is too coarse.

Date: Straßburg, 18. Juni 1774.

Sources: `type="manuscript", isOriginal="true"` ([meta.xml:627](/home/simon/source/lenz-briefe/data/xml/meta.xml:627)).

Provenance: [traditions.xml:228](/home/simon/source/lenz-briefe/data/xml/traditions.xml:228).

> Freye/Stammler Bd. 1, S. 75–77 (Röderers Hand); zu Lenz’ Anteil ist das Manuskript überliefert, nach dem hier zitiert wird: Zürich, Zentralbibliothek, RP 20, Nr. 21.

Local evidence: both italic spans lie in the [“Röderers Hand:”](/home/simon/source/lenz-briefe/data/xml/briefe.xml:656) section, before [“Lenz’ Hand:”](/home/simon/source/lenz-briefe/data/xml/briefe.xml:672). Combined with the provenance, this supports checking the basis separately for the two contributions; it does not establish a correction automatically.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `it` #1 | [briefe.xml:657](/home/simon/source/lenz-briefe/data/xml/briefe.xml:657) | 1 / main text | `<it>dem.</it>` | …er ich weiß es was es ist: meine Empfindung ist noch nicht aufgelöst! Und ich seufze nach ⟦dem.⟧ Wo’s geschehn wird weiß der der über meine Existenz wacht und in dem ich allein ruhen möc… |
| `it` #2 | [briefe.xml:657](/home/simon/source/lenz-briefe/data/xml/briefe.xml:657) | 1 / main text | `<it>möchte!!</it>` | …em. Wo’s geschehn wird weiß der der über meine Existenz wacht und in dem ich allein ruhen ⟦möchte!!⟧ Dort drüben denke ich, wohin mir ein Alpenhohes Gebürg den Blick verbeut. Ich bin nicht u… |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='36']//l:it)[1]` — line 657.
- `(/l:opus/l:document/l:letterText[@letter='36']//l:it)[2]` — line 657.

- [ ] Reviewed. Decision / explanation:

### Letter 251

**Provisional mismatch.** The five bold passages are explicitly under the heading “Gedruckter Text:” in the letter itself; handwritten material follows. The metadata lists only an original manuscript. Review the source classification for a document containing both printed and handwritten parts before reconsidering the bold tags.

Date: Zürich, 7. und 13. November 1776.

Sources: `type="manuscript", isOriginal="true"` ([meta.xml:4309](/home/simon/source/lenz-briefe/data/xml/meta.xml:4309)).

Provenance: [traditions.xml:1829](/home/simon/source/lenz-briefe/data/xml/traditions.xml:1829).

> Riga, Latvijas Akadēmiskā Bibliotekā, Ms. 1113, F. 25, V. 32, Nr. 31. Rotes Siegel.

Local evidence: [“Gedruckter Text:”](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4192) precedes all five bold spans; [hand ref="10"](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4197) introduces the subsequent handwritten passage.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `b` #1 | [briefe.xml:4193](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4193) | 1 / main text | `<b>darf</b>` | …Gönnerinnen in der Nähe und Ferne – mich gütigst zu entschuldigen und zu entschlagen. Ich ⟦darf⟧ und will keiner Seele verbieten an mich zu schreiben; aber alle bitten, ohne Drang des He… |
| `b` #2 | [briefe.xml:4193](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4193) | 1 / main text | `<b>verbieten</b>` | … Ferne – mich gütigst zu entschuldigen und zu entschlagen. Ich darf und will keiner Seele ⟦verbieten⟧ an mich zu schreiben; aber alle bitten, ohne Drang des Herzens und des Bedürfnißes nicht … |
| `b` #3 | [briefe.xml:4193](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4193) | 1 / main text | `<b>Schafhausen</b>` | …fälle ausgenommen,) keine Antwort zu erwarten – und dann auch noch bitten, die Briefe bis ⟦Schafhausen⟧ oder Basel zu frankiren. Man kann leicht denken, Einer kann nicht so leicht tragen, was 3… |
| `b` #4 | [briefe.xml:4193](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4193) | 1 / main text | `<b>Basel</b>` | …,) keine Antwort zu erwarten – und dann auch noch bitten, die Briefe bis Schafhausen oder ⟦Basel⟧ zu frankiren. Man kann leicht denken, Einer kann nicht so leicht tragen, was 300. bis 400… |
| `b` #5 | [briefe.xml:4193](/home/simon/source/lenz-briefe/data/xml/briefe.xml:4193) | 1 / main text | `<b>Einer</b>` | … noch bitten, die Briefe bis Schafhausen oder Basel zu frankiren. Man kann leicht denken, ⟦Einer⟧ kann nicht so leicht tragen, was 300. bis 400. tragen können. Man kann sich vorstellen, w… |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='251']//l:b)[1]` — line 4193.
- `(/l:opus/l:document/l:letterText[@letter='251']//l:b)[2]` — line 4193.
- `(/l:opus/l:document/l:letterText[@letter='251']//l:b)[3]` — line 4193.
- `(/l:opus/l:document/l:letterText[@letter='251']//l:b)[4]` — line 4193.
- `(/l:opus/l:document/l:letterText[@letter='251']//l:b)[5]` — line 4193.

- [ ] Reviewed. Decision / explanation:

### Letter 39

**Mixed-source ambiguity.** The source list and provenance explicitly include both a printed circular and handwritten material. The first italic span is in the section labelled “gedrucktes Rundschreiben:” and is locally consistent with print. The second is in the address after the handwritten section and needs inspection; the current markup has no passage-level source reference.

Date: Zürich, 2. September 1774.

Sources: `type="manuscript", isOriginal="false"` ([meta.xml:678](/home/simon/source/lenz-briefe/data/xml/meta.xml:678)); `type="print", isOriginal="false"` ([meta.xml:679](/home/simon/source/lenz-briefe/data/xml/meta.xml:679)).

Provenance: [traditions.xml:250](/home/simon/source/lenz-briefe/data/xml/traditions.xml:250).

> Freye/Stammler Bd. 1, S. 81f. Der handschriftliche Teil nach: Zürich, Zentralbibliothek, FA Lav. Ms. 572, Nr. 19, Abschrift von Lavaters oder anderer zg. Hand mit dem Zusatz „Z. den 2. Sept. 1774.“; „auf graubläuliches Papier gedrucktes Rundschreiben“ (Stöber 1874, S. 82).

Local headings: [printed circular](/home/simon/source/lenz-briefe/data/xml/briefe.xml:733), [Lavaters Hand](/home/simon/source/lenz-briefe/data/xml/briefe.xml:740), [Adresse](/home/simon/source/lenz-briefe/data/xml/briefe.xml:743).

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `it` #1 | [briefe.xml:734](/home/simon/source/lenz-briefe/data/xml/briefe.xml:734) | 1 / main text | `<it>sehr dringende Fälle ausgenommen</it>` | …igstens ein halbes Jahr alle Briefe von meinen bisherigen und etwa neuen Correspondenten, ⟦sehr dringende Fälle ausgenommen⟧ – brüderlich verbitten zu dürfen. Helfet mir, liebe Freunde, und alle die mir wol wollen,… |
| `it` #2 | [briefe.xml:744](/home/simon/source/lenz-briefe/data/xml/briefe.xml:744) | 1 / main text | `<it>Straßburg.</it>` | … ich – Ruhe suche, nicht die Ruhe der Trägheit. Adresse: An Herrn Lenze im Finkweiler, in ⟦Straßburg.⟧ |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='39']//l:it)[1]` — line 734.
- `(/l:opus/l:document/l:letterText[@letter='39']//l:it)[2]` — line 744.

- [ ] Reviewed. Decision / explanation:

### Letter 55

**Source-description edge case — not a tag mismatch.** The metadata identifies a printed edition, while editorial notes label sections as “Luise Königs Hand:” and “Lenz’ Hand:”. Check whether the print supplies that handwriting information or whether the metadata omits another basis. These are note elements, not hand tags; a print can legitimately report different hands.

Date: Straßburg, 13. Juli 1775.

Sources: `type="print", isOriginal="false"` ([meta.xml:953](/home/simon/source/lenz-briefe/data/xml/meta.xml:953)).

Provenance: [traditions.xml:363](/home/simon/source/lenz-briefe/data/xml/traditions.xml:363).

> Johannes Froitzheim: Zu Strassburgs Sturm- und Drangperiode 1770–1776. Strassburg 1888, S. 82f.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `note` #1 | [briefe.xml:1182](/home/simon/source/lenz-briefe/data/xml/briefe.xml:1182) | 1 / main text | `<note>Luise Königs Hand:</note>` | ⟦Luise Königs Hand:⟧ Strass. d. 13t julii 75 Eben komme ich von Buchsweiler zurück. desswegen eine so späte An… |
| `note` #2 | [briefe.xml:1189](/home/simon/source/lenz-briefe/data/xml/briefe.xml:1189) | 1 / main text | `<note>Lenz’ Hand:</note>` | …am grössten Luise. Das Geld ist ganz recht, noch rechter dass Sie mit mir zufrieden sind. ⟦Lenz’ Hand:⟧ Ich bin itzt ganz glücklich da ich das beste Paar unter der alles anschauenden Sonne auch… |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='55']//l:note)[1]` — line 1182.
- `(/l:opus/l:document/l:letterText[@letter='55']//l:note)[2]` — line 1189.

- [ ] Reviewed. Decision / explanation:

### Letter 32

**Unknown source.** The wording “Exzerpte von zg. Hand” suggests a manuscript transmission to inspect. Decide what source actually underlies this edition and whether its underlining is transcribed directly.

Date: Zürich, Ende Mai 1774.

Sources: `type="unknown", isOriginal="false"` ([meta.xml:555](/home/simon/source/lenz-briefe/data/xml/meta.xml:555)).

Provenance: [traditions.xml:201](/home/simon/source/lenz-briefe/data/xml/traditions.xml:201).

> Zürich, Zentralbibliothek, FA Lav. Ms. 590. Anh. II, Exzerpte von zg. Hand aus Briefen von Johann Caspar Lavater an Johann Gottfried Röderer, S. 3–5.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `dul` #1 | [briefe.xml:618](/home/simon/source/lenz-briefe/data/xml/briefe.xml:618) | 1 / main text | `<dul>tief</dul>` | … mir bange, Kinder, daß Ihr Waßer aus der Dürre, u: Leben von dem Todten erwartet – o wie ⟦tief⟧ unter aller Erwartung bin ich – ob’s falsche oder wahre Bescheidenheit uns – oder Wahrhei… |
| `ul` #1 | [briefe.xml:618](/home/simon/source/lenz-briefe/data/xml/briefe.xml:618) | 1 / main text | `<ul>Wahrheit</ul>` | …ie tief unter aller Erwartung bin ich – ob’s falsche oder wahre Bescheidenheit uns – oder ⟦Wahrheit⟧ sey, werdet Ihr sehen. Doch bring ich Euch ein redlich offenes Herz, das eures schrecklic… |
| `ul` #2 | [briefe.xml:619](/home/simon/source/lenz-briefe/data/xml/briefe.xml:619) | 1 / main text | `<ul>Lentz</ul>` | …erz, das eures schrecklich gern kennt – giebt durchs Empfangen u: empfängt durchs Geben – ⟦Lentz⟧ bey Dir also steig ich ab – bey Dir leb’ u: wes’ ich, aber ach! Nur einen Tag u. einen So… |
| `ul` #3 | [briefe.xml:619](/home/simon/source/lenz-briefe/data/xml/briefe.xml:619) | 1 / main text | `<ul>Dir</ul>` | …r leb’ u: wes’ ich, aber ach! Nur einen Tag u. einen Sonntag – Sagen darf ich’s hoff’ ich ⟦Dir⟧ o daß ich vor einigem Wiederwillen krank würde, wenn Du etwas mehr als Teller Waßer, Gabe… |
| `ul` #4 | [briefe.xml:619](/home/simon/source/lenz-briefe/data/xml/briefe.xml:619) | 1 / main text | `<ul>Goethe</ul>` | …s mehr als Teller Waßer, Gabel u. Löfel – um meinetwillen auf Deinen Tisch legen würdest. ⟦Goethe⟧ – will mich auch bey sich haben – in Erfurth – thu, was du willst – ihn fortzureitzen: do… |
| `ul` #5 | [briefe.xml:619](/home/simon/source/lenz-briefe/data/xml/briefe.xml:619) | 1 / main text | `<ul>Schwächere</ul>` | …haben – in Erfurth – thu, was du willst – ihn fortzureitzen: doch wär’ ich vielleicht der ⟦Schwächere⟧ Straßburger Freunde wagts – denen ich Freyheitsgeist mitbringen mögte, chenirt – doch thu… |
| `ul` #6 | [briefe.xml:619](/home/simon/source/lenz-briefe/data/xml/briefe.xml:619) | 1 / main text | `<ul>Freyheitsgeist</ul>` | …tzureitzen: doch wär’ ich vielleicht der Schwächere Straßburger Freunde wagts – denen ich ⟦Freyheitsgeist⟧ mitbringen mögte, chenirt – doch thue was du willst. Gott stärke dich Du edler Schwacher!… |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='32']//l:dul)[1]` — line 618.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[1]` — line 618.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[2]` — line 619.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[3]` — line 619.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[4]` — line 619.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[5]` — line 619.
- `(/l:opus/l:document/l:letterText[@letter='32']//l:ul)[6]` — line 619.

- [ ] Reviewed. Decision / explanation:

### Letter 56

**Unknown source.** The original manuscript is described as lost and the provenance cites an auction catalogue. Determine whether this edition uses the catalogue transcription or another source. There is no tag/source mismatch under the working classifications.

Date: Wahrscheinlich Straßburg, Juli 1775.

Sources: `type="unknown", isOriginal="false"` ([meta.xml:971](/home/simon/source/lenz-briefe/data/xml/meta.xml:971)).

Provenance: [traditions.xml:370](/home/simon/source/lenz-briefe/data/xml/traditions.xml:370).

> Hs. verschollen. Leo Liepmannssohn. Versteigerung Nr. 50. Autographen. Versteigerung am 10. und 11. Juni 1927. […] z. T. aus der Sammlung des Herrn Dr. Fritz Jonas […], Berlin 1927, Nr. 140: Br. an Heinrich Julius von Lindau, [Juli 1775] (ungedruckt): E. B. m. U. O. O. u. J. (circa Juli 1775). 1 S. 4°. Herzlicher Brief an seinen Freund Lindau, geschrieben kurz nachdem Goethe Lenz in Straßburg besucht hatte. (Mai-Juni 1775).

No medium-specific or uncertainty/emphasis markers to enumerate. Full letter: [briefe.xml:1194](/home/simon/source/lenz-briefe/data/xml/briefe.xml:1194).

Observed tags: `note`, `page`, `line`, `vspace`, `align`.

- [ ] Reviewed. Decision / explanation:

### Letter 296

**Unknown source.** Determine whether the illegibility marker comes from direct consultation of a manuscript, a printed transcription, or an editorial decision. The provenance names printed editions and differing readings.

Date: Schweiz, Spätsommer 1777.

Sources: `type="unknown", isOriginal="false"` ([meta.xml:5082](/home/simon/source/lenz-briefe/data/xml/meta.xml:5082)).

Provenance: [traditions.xml:2212](/home/simon/source/lenz-briefe/data/xml/traditions.xml:2212).

> Schmidt, Lenziana, S. 1017; FSt II, S. 98, hat andere Lesarten; Entwurf. Beilage nicht ermittelt.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `nr` #1 | [briefe.xml:5185](/home/simon/source/lenz-briefe/data/xml/briefe.xml:5185) | 1 / main text | `<nr> </nr>` | …Sagen Sie Goethen, ich hab ihn zu grüssen von der Reise und den Leuten die ihn drin haben ⟦&lt;nr&gt; &lt;/nr&gt;⟧ sehn. |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='296']//l:nr)[1]` — line 5185.

- [ ] Reviewed. Decision / explanation:

### Letter 338

**Unknown source.** Determine whether the quoted text and underlining come from the 1815 manuscript, a print, or editorial intervention. The provenance describes a lost original letter quoted in another letter.

Date: St. Petersburg, 9. Juni 1780.

Sources: `type="unknown", isOriginal="false"` ([meta.xml:5801](/home/simon/source/lenz-briefe/data/xml/meta.xml:5801)).

Provenance: [traditions.xml:2476](/home/simon/source/lenz-briefe/data/xml/traditions.xml:2476).

> In einem Schreiben an Petersen vom 2. November 1815 (Riga, Latvijas Akadēmiskā Bibliotekā, Ms. 1113, F. 25, V. 34, Nr. 15) zitiert Dumpf aus einem Brief von Lenz an seinen Bruder Friedrich David vom „3ten Pfingsttag 80“, dessen Handschrift verschollen ist. Lenz habe in dem Brief auch „einer Stelle erwähnt, die ihm Nicolay vorgeschlagen und durch die er an den Großfürsten gelangte“.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `ul` #1 | [briefe.xml:6011](/home/simon/source/lenz-briefe/data/xml/briefe.xml:6011) | 1 / main text | `<ul>kleine</ul>` | …n reifem Witz und Beurtheilungskraft und wie ich schließen kann aus den zwey Stunden ohne ⟦kleine⟧ Leidenschaften) gesprochen und alle Ursache von der Welt mit dieser neuen Bekanntschaft h… |
| `ul` #2 | [briefe.xml:6011](/home/simon/source/lenz-briefe/data/xml/briefe.xml:6011) | 1 / main text | `<ul>neuen</ul>` | …y Stunden ohne kleine Leidenschaften) gesprochen und alle Ursache von der Welt mit dieser ⟦neuen⟧ Bekanntschaft höchst zufrieden zu seyn. Auch hat er mir einige Vorschläge gemacht etc. |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='338']//l:ul)[1]` — line 6011.
- `(/l:opus/l:document/l:letterText[@letter='338']//l:ul)[2]` — line 6011.

- [ ] Reviewed. Decision / explanation:

### Letter 235

**Secondary edge case — not a mismatch.** Text loss is meaningful in both media. Check whether these two markers reproduce gaps reported by the printed edition, gaps in its faulty-copy source, or an editorial omission convention. Do not assume that a printed basis makes tl wrong.

Date: Straßburg, 21. September 1776.

Sources: `type="print", isOriginal="false"` ([meta.xml:4033](/home/simon/source/lenz-briefe/data/xml/meta.xml:4033)).

Provenance: [traditions.xml:1720](/home/simon/source/lenz-briefe/data/xml/traditions.xml:1720).

> Schmidt, Erich: Lenziana. In: Sitzungsberichte der Königlich Preußischen Akademie der Wissenschaften zu Berlin, Jg. 1901, 41. Stück: Gesammtsitzung, 24. October, S. 1007f.; laut FSt II 263 nach fehlerhafter Kopie.

| Occurrence | Source location | Page / context | Encoded passage | Surrounding text |
| --- | --- | --- | --- | --- |
| `tl` #1 | [briefe.xml:3964](/home/simon/source/lenz-briefe/data/xml/briefe.xml:3964) | 1 / main text | `<tl/>` | …Küsse Sie liebster Lenz. Küssen Sie Goethe für mich. Salzmann Act. Der junge Bernhard von ⟦&lt;tl/&gt;⟧ hat banqueroute gemacht und davon geloffen sagen Sie das Göthe. d. 21. Jun. |
| `tl` #2 | [briefe.xml:3964](/home/simon/source/lenz-briefe/data/xml/briefe.xml:3964) | 1 / main text | `<tl/>` | …sen Sie Goethe für mich. Salzmann Act. Der junge Bernhard von hat banqueroute gemacht und ⟦&lt;tl/&gt;⟧davon geloffen sagen Sie das Göthe. d. 21. Jun. |

Exact selectors (`l` = `https://lenz-archiv.de`):

- `(/l:opus/l:document/l:letterText[@letter='235']//l:tl)[1]` — line 3964.
- `(/l:opus/l:document/l:letterText[@letter='235']//l:tl)[2]` — line 3964.

- [ ] Reviewed. Decision / explanation:

## Checks with no mismatches

- All 49 `hand`, 9 `ink`, 32 `pe`, 271 `del`, 10 `er`, 262 `insertion` and 32 `subst` occurrences are in manuscript-only letters. `undo` is unused.
- The 109 print-based `it` occurrences agree with the working print interpretation. The other four are the two manuscript and two mixed-source occurrences listed above.
- All five `b` occurrences are listed. None is in a print-based letter.
- `tul`, `highlight` and `undo` have no current occurrences to assess.
- Both-category tags have no hard source mismatch by definition. Unknown-source markup and print-based text-loss cases are listed separately so they are not mistaken for confirmed errors.

## Verification and limitations

Every text-element declaration in `textelements.xsd` has exactly one classification above; every occurrence under the 374 letters was counted. Letter IDs match across `briefe.xml`, `meta.xml` and `traditions.xml`. Seven provisional mismatches, two mixed-source spans, ten underlining/illegibility spans in unknown-source letters, and two secondary text-loss spans are individually located (21 tag occurrences), plus two handwriting-description notes in letter 55 and the source-only review for letter 56. Local section headings are included as additional evidence. All source-description notes mentioning print or hand in the corpus were checked for contextual clues.

The report checks encoded tags against encoded source classifications. It cannot establish what the facsimile shows or whether existing metadata is historically correct. Exact lines and occurrence numbers describe this snapshot and can shift after XML edits. Parent/child revision elements are counted as separate tags. Their co-occurrence is not itself an exception.
