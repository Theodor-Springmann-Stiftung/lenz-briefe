# Lenz Briefe

## Purpose

This project is becoming a critical digital edition of the correspondence of
Jacob Michael Reinhold Lenz. Prioritize faithful transcription, explicit editorial
interventions, traceable sources, stable citations, and an accessible reading
experience. Treat the XML as scholarly material, not disposable application data.

## Repository map

- `data/xml/briefe.xml`: letter transcriptions, page and line markers, inline
  editorial markup, and sidenotes.
- `data/xml/meta.xml`: letter metadata, including sending and receiving events,
  dates, people, places, and editorial status.
- `data/xml/traditions.xml`: transmission history and apparatus material.
- `data/xml/references.xml`: definitions referenced by metadata and apparatus.
- `data/xsd/`: the current custom OPUS XML schemas. The namespace is
  `https://lenz-archiv.de`; this is not TEI XML.
- `xslt/`: XSLT 3.0 shared by both exporters. `common.xsl` handles shared text
  rendering; the other stylesheets handle letter text, sidenotes, and traditions.
- `transform/python/`: Python 3.13 exporter using lxml and SaxonC, managed with uv.
- `transform/js/`: alternative Node exporter using Saxon-JS, with `xmllint` for
  schema validation.
- `app/`: static Astro application with TypeScript, Tailwind CSS, local fonts,
  and Pagefind search. Node >=22.12.0 is required by its package manifest.
- `app/src/lib/edition.ts`: generated-data types, loading, chronology, grouping,
  and navigation. `app/src/components/` contains the reading interface.
- `scripts/lint_verweise.py`: cross-file reference checks, also run by
  `.github/workflows/verweise.yml`.
- `docs/OPUS.md`: historical format background inherited from the Hamann project.
  It does not fully describe the current Lenz schema. Verify details against
  current XML, XSD, and consumers; `app/README.md` also retains starter boilerplate.

## Editorial integrity

- Preserve historical spelling, punctuation, capitalization, multilingual text,
  and meaningful whitespace. Do not silently modernize or correct transcriptions.
- Preserve distinctions between source text, deletions, insertions, substitutions,
  illegible or lost text, editorial additions, and annotations. Do not flatten
  these distinctions to solve a rendering problem.
- Keep source page markers, explicit line breaks, verse indentation, alignment,
  and sidenote placement meaningful through export and display. XML mixed content
  is whitespace-sensitive: avoid blanket pretty-printing or reserialization.
- Keep letter IDs and reference indices stable. Check dependent metadata,
  apparatus, generated slugs, and anchors when changing their handling.
- Preserve date ranges and uncertainty (`when`, `notBefore`, `notAfter`, `from`,
  `to`, `cert`) and inferred-reference information (`erschlossen`). A sorting key
  must not become a falsely precise displayed date.
- Do not invent missing text, dates, identities, provenance, or bibliographic
  claims. Record the evidence for substantive editorial corrections in the change
  description; leave unresolved readings explicit when evidence is insufficient.
- `isProofread` is an editorial assertion, not a technical validation result.
  Do not set it merely because XML checks or a build pass.
- Make targeted source changes. Read migration scripts such as
  `scripts/surgical_fix.py` and `scripts/transform-meta-sort.py` before use; they
  are not routine validation steps.

## Data flow and implementation

The flow is `data/xml` + `data/xsd` + `xslt` → exporter → `app/generated` → Astro
static pages and Pagefind index. Edit the source layer responsible for a change;
do not hand-edit generated HTML or JSON as a lasting fix.

Successful exports include `status.json`, `stats.json`, `letters/index.json`, and
per-letter `meta.json`, `text.html`, and `sidenotes.json`. Letter text is a continuous
HTML stream with inline page markers; sidenotes are keyed by source page index.
Rendered apparatus is carried in `meta.json` as `traditionsHtml`.

- Preserve the contract between both exporters and `app/src/lib/edition.ts`.
  Update both exporters when changing the shared output format or semantics.
- Keep XML-to-HTML rendering in the shared XSLT and presentation in Astro/CSS.
  New supported markup needs appropriate schema, XSLT, and display handling.
- Retain stable page and sidenote anchors, including `.page-anchor` and `.lb-page`
  hooks used by the interface and search exclusions.
- Exports replace their output directory, including on failure. Use only a
  dedicated generated directory; use a temporary output for diagnostic runs when
  an existing export should be preserved.
- A failed export publishes failure metadata so Astro can build a failure-state
  site. A successful site build alone does not prove a successful edition export.
  Inspect `status.json` and its warnings: exporters currently collect schema and
  reference issues as warnings even in successful exports.
- Keep generated outputs, build output, caches, and dependencies untracked.
  Preserve the existing lockfiles and local coding conventions.
- Keep reader-facing interface text in German. Prefer semantic HTML, keyboard
  access, readable typography, and usable narrow-screen layouts. Verify that
  apparatus and sidenotes remain reachable when margins cannot accommodate them.

## Working commands

There is no root package workspace. Run commands in the indicated directory.

Python exporter, from `transform/python/`:

```sh
uv sync
uv run check-coverage
uv run python ../../scripts/lint_verweise.py
uv run transform --out ../../app/generated
```

Alternative JavaScript exporter, from `transform/js/` (requires `xmllint` on PATH):

```sh
npm ci
npm run check:coverage
npm run transform -- --out ../../app/generated
```

Application, from `app/`, after producing a successful export:

```sh
npm ci
npm test
npm run build
npm run dev
```

`LENZ_GENERATED_DIR` can select another export directory; prefer an absolute path.
`npm run build` checks generated metadata before building and creates the Pagefind
index. Development serves that built index, so rebuild after corpus changes when
checking search results. `npm run preview` previews the production build.

## Verification and change discipline

- Inspect `git status` before editing. Preserve unrelated work and do not resolve
  existing merge conflicts unless the task includes resolving them.
- For XML changes, check well-formedness, applicable XSD validation, and cross-file
  references; inspect export warnings and the affected letter output.
- For schema or XSLT changes, also run tag coverage and inspect representative
  rendered passages. Coverage checks template presence, not rendering correctness.
- For exporter or output-contract changes, exercise both exporters and compare
  affected artifacts, allowing for generation timestamps and generator metadata.
- For app changes, run relevant tests and a production build. Several edition
  tests depend on generated corpus artifacts, so generate those first. For visual
  changes, inspect affected pages at desktop and narrow widths, including page
  markers, editorial markup, sidenotes, and apparatus where relevant.
- Add focused regression tests for behavioral changes when useful. Documentation
  changes alone do not require regenerating the corpus or building the site.
- Report what changed, checks performed, and any pre-existing failures or checks
  that could not run. Distinguish export success, validation warnings, and the
  deliberate failure-site build behavior.
