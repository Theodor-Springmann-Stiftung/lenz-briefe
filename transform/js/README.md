# Transform Workspace

Manual XML export pipeline for the Lenz edition.

## Usage

Install dependencies:

```bash
npm install
```

Check that the shared XML tags allowed by the schema are covered by the common XSLT:

```bash
npm run check:coverage
```

Run the exporter:

```bash
npm run transform -- --out ../../app/generated
```

The exporter reads the XML files in `../../data/xml/` and writes generated HTML/JSON
artifacts into the given output directory. Relative output paths are supported.

The stylesheets live in the repo-level `../../xslt/` directory and are shared with
the Python-based transformer.

Per letter, the exporter writes:

- `meta.json`
- `text.html`
- `sidenotes.json`

At the generated root, the exporter also writes:

- `status.json`

`status.json` always exists after a transform attempt. Successful runs also write
the generated letter artifacts. Failed runs replace the output with failure
metadata so the Astro app can build a generic failure site.

`text.html` is a continuous letter-level stream. Source `<page>` tags become inline
page markers in the rendered HTML, with matching `.page-anchor` and `.lb-page`
elements for each source page index.

`sidenotes.json` is keyed by source page index. Each sidenote entry still keeps its
`page` metadata explicitly.

`meta.json` contains the resolved letter metadata, page list, and the rendered
letter-level `traditionsHtml`.
`stats.json` contains the source commit hash/date and source letter counts from
`meta.xml`, `briefe.xml`, and `traditions.xml`.
