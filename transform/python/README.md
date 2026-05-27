# Transform Python Workspace

Native XML export pipeline for the Lenz edition.

## Usage

Install dependencies:

```bash
uv sync
```

Check that the shared XML tags allowed by the schema are covered by the common XSLT:

```bash
uv run check-coverage
```

Run the exporter:

```bash
uv run transform --out ../../app/generated
```

The exporter always publishes a `status.json` file into the output directory.
Successful runs also publish the generated letter artifacts. Failed runs replace
the output with failure metadata so the Astro app can build a generic failure site.

Per letter, the successful export publishes:

- `meta.json`
- `text.html`
- `sidenotes.json`

`text.html` is a continuous letter-level stream with inline page markers derived
from source `<page>` tags. `sidenotes.json` is keyed by source page index.

Benchmark the Python exporter against the Node exporter:

```bash
uv run benchmark-transform --out-base /tmp/lenz-transform-benchmark
```
