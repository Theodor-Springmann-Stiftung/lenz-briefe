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

Benchmark the Python exporter against the Node exporter:

```bash
uv run benchmark-transform --out-base /tmp/lenz-transform-benchmark
```
