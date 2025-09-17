# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a digital humanities project for editing J.M.R. Lenz's letters. The project maintains XML files containing historical letter texts, metadata, and annotations, following the "lenz-archiv.de" XML schema.

## Repository Structure

- `data/xml/` - Core XML files containing letter data:
  - `briefe.xml` - Letter texts with rich markup for formatting and cross-references
  - `meta.xml` - Letter metadata (dates, senders, receivers, locations)
  - `references.xml` - Person, location, and apparatus definitions
  - `traditions.xml` - Text provenance and editorial apparatus
- `data/xsd/` - XML Schema Definition files that validate the XML structure
- `scripts/` - Python utilities for data processing and validation

## Commands

### Validation and Linting
```bash
# Validate XML cross-references (main quality check)
python scripts/lint_verweise.py

# Install Python dependencies for scripts
pip install lxml
```

### Data Transformation
```bash
# Transform meta.xml date structures
python scripts/transform-meta-sort.py INPUT.xml OUTPUT.xml
```

## XML Schema Architecture

The project uses a custom XML namespace `https://lenz-archiv.de` with modular XSD files:
- `lenz.xsd` - Main schema file
- `textelements.xsd` - Text formatting and semantic markup elements
- `common.xsd`, `briefe.xsd`, `meta.xsd`, `references.xsd` - Component schemas

Key XML elements follow a hierarchical structure under `<opus>` root elements, with specialized namespaced elements for cross-references between files.

## Validation Workflow

The `lint_verweise.py` script performs cross-file reference validation:
- Verifies `letterText/@letter` references exist in `meta.xml`
- Validates person references (`@ref` attributes) against `references.xml`
- Checks location and apparatus definition references
- Reports errors with file paths and line numbers for GitHub Actions integration

GitHub Actions automatically runs validation on XML file changes via `.github/workflows/verweise.yml`.