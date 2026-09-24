# Static Lenz edition

Astro renders the index, 374 letter pages and the reading guide. Python and Saxon/C
transform the source XML before each build; the browser never transforms XML.
Tailwind defines the theme, and `src/styles/global.css` styles the shared edition
classes. Source Serif, Linux Biolinum and Bodoni Moda are self-hosted under
`public/fonts/`, alongside their licenses. Linux Biolinum includes regular, italic, bold and
bold oblique (used for bold italic), downloaded from the [CTAN Libertine package](https://mirrors.mit.edu/CTAN/fonts/libertine/opentype/).

## Run and build

Use a Node version supported by Astro 7 and Python 3.13. Install `uv` for
the Python workspace, then run from the repository root:

```sh
uv sync --project transform/python
npm --prefix app ci
npm --prefix app run dev
```

While the dev server runs, saving files in `data/xml/`, `data/xsd/`, or `xslt/`
automatically reruns the export and reloads the browser after it succeeds. Saves
are debounced, and exports run one at a time. Changes made during an export queue
another run. Export failures appear in the terminal and browser error overlay;
fixing and saving the source retries automatically.

For a production build and local preview:

```sh
npm --prefix app run build
npm --prefix app run preview
```

Deploy the contents of `app/dist/` to a static host. No server runtime or API is
needed. Builds regenerate `app/generated/`; both directories are ignored by Git.
The export script uses the workspace's Python virtual environment when present,
otherwise `uv run`. An unsuccessful export stops the site build.

## GitHub Pages development deployment

`.github/workflows/pages.yml` validates all four XML documents against their XSDs
before running the Python/Saxon XSLT export and the static Astro build. Any schema,
test, export or build failure prevents deployment. Pushes to `main` publish
`app/dist/`; pull requests targeting `main` validate and build without publishing.
The workflow can also be run manually on `main`.

The site URL is `https://dev.lenz-briefe.de`, served at `/` without a repository
path prefix. For the initial setup:

1. In the repository's **Settings → Pages**, select **GitHub Actions** as the source.
2. Set the custom domain to `dev.lenz-briefe.de`.
3. At the DNS provider, set the `dev` CNAME record to
   `theodor-springmann-stiftung.github.io` (no repository path).
4. Enable **Enforce HTTPS** once the certificate is available.

With an Actions deployment, the custom domain must be configured in GitHub's
settings; a `CNAME` file in the artifact does not configure it. See
[GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
The development site's `robots.txt` and `noindex` meta tags are included in the
published output.

Run the same strict validation locally from the repository root:

```sh
uv run --project transform/python python -m transform_python.validate_schemas
```

## Data and rendering

- `generated/catalog.json` provides chronological headers, ordered sending and
  receiving events, source/draft flags, person/place dictionaries and year groups.
  Dates retain their XML wording. Sorting uses `when`, `from`, `notBefore`, `to`,
  then `notAfter`; the earliest candidate across sending events wins. Partial
  dates sort before more precise dates sharing the same prefix.
- `letters/<id>/text.html` contains semantic line blocks, spacers and inline page
  milestones. A page break never creates a paragraph. Reopened formatting spans
  keep their attributes; hand origins identify a single span across line breaks.
- `sidenotes.json` retains all 215 notes. Notes without a matching page marker are
  shown after the text and reported in `status.json`; these currently occur in
  letters 64 and 167. On desktop, page labels remain in the left margin. Hands and notes occupy
  the right margin, with notes starting at their source page’s beginning.
  Metadata, letter text and apparatus share the same main column. Margin items
  flow downward in order. Notes can continue across page boundaries; overflow
  notes carry a “S. 1:” prefix in the position description. The icon hangs
  to the left at the top of each note; descriptions, page labels and hand
  information sit directly below the note’s text. Later notes and hand labels
  follow without reserving space on subsequent pages. On smaller screens they follow
  the text in normal flow.
- `traditions.json` provides ordered apparatus records, including text between
  entries. The same typography applies to letter, note and apparatus fragments.
- The index embeds only IDs and filter fields for browser navigation. Repeated
  `person` and `place` query parameters combine with OR within each category and
  AND between categories. `group` selects a year group; the first group is the
  default, while `group=all` explicitly selects all years. `sort=desc` reverses
  the chronological order; ascending is the default. Changing or clearing a
  person/place filter switches to all years. Reset is offered only for those
  filters: removable pills and an “Alle zurücksetzen” button appear below the
  heading, outside the toolbar. Year groups with no matches are dimmed and
  disabled. Remix Icons supplies the interface icons as embedded SVGs. Reload, shared URLs and
  Back/Forward restore filters and sorting. The search field is currently a
  design placeholder with no search behavior. The unfiltered catalog remains readable
  without JavaScript.

Current layout conventions: one line-indent unit equals `2ch`; `tab value="i-n"`
starts at fraction `(i-1)/n` of its row and occupies the space to the next cell.
Text and editorial marks between tab elements remain in the preceding cell, so
they cannot displace subsequent tab stops. Content before the first tab occupies
a separate full-width line.
A repeated or lower tab position wraps to a new row. On narrow screens line
indentation is capped at 25% to keep the text readable.

The language tags only set `lang`: `gr→grc`, `fr→fr`, `hb→he`, `ru→ru`;
`aq→la` also changes to sans-serif. Edition marks are CSS decorations so they do
not alter the source wording. Substitutions show the struck-through original immediately
followed by the replacement in corner marks, with a small black square just after
the opening mark to indicate overwriting. Both readings remain visible. Erasures (`er`)
use inverse text. `undo` has no additional visual style; `address` is transparent.

## Verification

```sh
npm --prefix app test
npm --prefix app run check
cd transform/python
uv run python -m unittest discover -p 'test_*.py'
```

The export regressions cover all sidenotes, chronology, multiple metadata events,
apparatus content and semantic flow. The complete Python suite currently has one
existing failure: `SeparateDocumentSchemaTests` expects `briefe.xsd` to reject a
`traditions` container, but that schema still explicitly permits it. Two apparatus
schema warnings and the two unmatched sidenote targets are retained in export
diagnostics; they do not discard the associated content.
