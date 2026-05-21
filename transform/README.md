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
npm run transform -- --out ../app/generated
```

The exporter reads the XML files in `../data/xml/` and writes generated HTML/JSON
artifacts into the given output directory. Relative output paths are supported.

Per letter, the exporter writes:

- `text.html`
- `traditions.html`
- `meta.json`
- `sidenotes.json`

Each `sidenotes.json` entry keeps its `page` metadata so consumers can group notes
by page without requiring nested page folders.
