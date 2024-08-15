# 11ty Sane Config Template
This a template providing a sane base config for eleventy, mainly for the purpose of mainiaining a clear and separated folder structure, plus providing autoprefixer for some level of CSS processing and tailwindcss as a default css framework. The settings are as follows:

## Directory structure
```
.\.eleventy.js
```
| Path | Description | 
| ---- | ------------ |
| `src/` | Source for the Page | 
| `dist/` | (Auto-Generated) Output Directory |
| `src/data/` | Contains data files |
| `src/includes/` | Contains Includes |
| `src/layouts/` | Contains Layouts |
| `src/dynamic/` | Contains Templates |
| `src/static/` | Contains static assets, contents get copied on build time |

## (Development) Dependencies
```
.\package.json
.\postcss.config.js
```
| Packet | Description | 
| ----- | ------------ | 
| `@11ty/eleventy@2.0.0-canary` | SSG base package |
| `postcss(-cli)` | For pre- and postprocessing of CSS |
| `autoprefixer` | Provides some cross-browser-functionality |
| `cssnano` | Minimizes CSS Filesize | 
| `tailwindcss@3.2.4` | CSS-Framework | 

## Commands
```
.\package.json
```
| Command | Description |
| ------- | ----------- |
| `npm run watch` | Run dev server in watch mode |
| `npm run css_watch` | Watch for CSS changes & rebuild |
| `npm run build` | First build the CSS, then the site |

## Other Settings
```
.\.eleventy.js
```
This will parse `.njk`, `.html` and `.md` templates by default.
```
.\src\data\config.json
```
These are some configuration options for default title displayed in the title bar, some SEO, and some options for sharing on social media. The `base.njk`-Layout configures these as default, unless front matter is provided on the specific template. 