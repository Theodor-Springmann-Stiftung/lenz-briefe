# Notices for the published website

Assessment of the current static site, 2026-09-29. This is a practical notice checklist based on the collected license texts. A visible credit, a distributed license notice, and a source-code offer are different requirements.

Root `licenses/` accompanies the repository and is copied in full to `dist/licenses/` by the Astro build. The complete notices are therefore included with the static website at `/licenses/…`. The duplicate `assets/fonts/` folder has been removed. The build also generates `/edition/lizenzen/`, linked from the Impressum, with the project’s MIT and CC BY 4.0 license scopes, notices, and runtime/build dependency lists. This checklist records the supporting assessment.

## Notices to include with the website

| Product | Website requirement | Current state / action |
| --- | --- | --- |
| Vivliostyle Core 2.45.2 | AGPL-3.0; preserve the license and upstream notices and provide access to corresponding source. | The print integration is marked AGPL-3.0. The published licenses page links to the [license](npm/@vivliostyle__core@2.45.2/LICENSE), [upstream notices](npm/@vivliostyle__core@2.45.2/README.md), and [source information](npm/@vivliostyle__core@2.45.2/SOURCE.md), including the exact upstream source release and the edition's integration source. |
| fast-diff 1.3.0 | Preserve the Apache-2.0 license and copyright notice distributed with Vivliostyle's dependency. | The build publishes the package's [LICENSE](npm/fast-diff@1.3.0/LICENSE). |
| Tippy.js 6.3.7 | Preserve the MIT copyright and full permission/disclaimer notice with the distributed browser code. | The generated tooltip bundle lacks an embedded notice; the build now accompanies it with the collected [MIT notice](npm/tippy.js@6.3.7/LICENSE) under `/licenses/`. The public licenses page links to it and includes the full notice. Copyright (c) 2017-present atomiks. |
| Popper 2.11.8 | Preserve its MIT notice; Popper is included through Tippy. | The generated tooltip bundle lacks an embedded notice; the build now accompanies it with the collected [MIT notice](npm/@popperjs__core@2.11.8/LICENSE.md). Copyright (c) 2019 Federico Zivolo. |
| Tailwind CSS 4.3.3 | Preserve applicable MIT copyright and permission notices for distributed library portions. | The generated CSS has a short MIT banner. The build now includes the full [Tailwind notice](npm/tailwindcss@4.3.3/LICENSE) under `/licenses/`, accompanying framework CSS shipped with the site. Copyright (c) Tailwind Labs, Inc. |
| Source Serif 4 | Preserve the font copyright and OFL 1.1 when redistributing the font. | The build publishes the OFL text and [actual font copyright](fonts/SourceSerif4/COPYRIGHT-from-font.txt), preserving both the original notice header and embedded reserved-name information. |
| Source Sans 3 | Preserve the font copyright and OFL 1.1 when redistributing the font. | The build publishes the [upright font notice](fonts/SourceSans3/SourceSans3-OFL.txt), [italic font notice](fonts/SourceSans3/OFL.txt), and [download provenance](fonts/SourceSans3/PROVENANCE.json). |
| Source Code Pro | Preserve the font copyright and OFL 1.1 when redistributing the font. | The build publishes the [OFL notice](fonts/SourceCodePro/OFL.txt) and [download provenance](fonts/SourceCodePro/PROVENANCE.json). |

A compact **“Lizenzen und Drittanbieter”** page, linked from the Impressum, can identify these products and link to their full notices. This is a practical presentation choice, not a requirement to display author names on every page. Preserve notices in redistributed code/assets or accompany them with an identifiable license file; a promotional credit alone does not replace license text.

## Optional credits

- **Remix Icon 4.9.1:** the bundled [Remix Icon License v1.0](npm/remixicon@4.9.1/License), sections 2.4 and 5, makes attribution optional and does not require a copyright notice for individual icons used within a website. Optional text: “Icons by Remix Icon”. The individual SVGs are used as interface elements. Redistribution of the complete icon library or substantial portions has additional notice terms.
- **Astro and build tools:** a “Built with Astro” credit is optional. Running Astro, parse5, the Markdown processor, TypeScript, Vite, the Python exporter, Saxon, or lxml to generate static output does not alone require a website credit. If their implementation code is later included in browser output or redistributed as binaries, review the corresponding notice and source obligations then.

## Clarify the site's own license

The footer links to CC BY 4.0. The licenses page should explain that third-party fonts, icons, and software retain their respective licenses. Suggested German wording:

> Die Lizenzangabe CC BY 4.0 gilt nicht für eingebundene Drittanbieter-Software, Schriftarten und Icons. Für diese gelten die hier aufgeführten jeweiligen Lizenzbedingungen.

This clarification does not determine the licensing of edition texts, manuscript images, the Lenz portrait, or independently sourced SVG artwork. Their provenance and permissions are outside this package/font notice collection.

## Source references

- [MIT license](https://opensource.org/license/mit): copyright and permission notice condition.
- [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0): section 4, redistribution and notices.
- [SIL OFL 1.1](https://openfontlicense.org/open-font-license-official-text/): conditions 2 and 5; notices may be provided through accompanying text or appropriate metadata.
- [OFL webfont FAQ](https://openfontlicense.org/ofl-faq/#21): webfont use is distribution.
- [Remix Icon 4.9.1 license](https://github.com/Remix-Design/RemixIcon/blob/v4.9.1/License): sections 2.4 and 5.

The font binaries remain byte-for-byte unchanged by our Astro font migration; the build changes their URLs and emits CSS. No font modification or subsetting notice is needed for that migration.
