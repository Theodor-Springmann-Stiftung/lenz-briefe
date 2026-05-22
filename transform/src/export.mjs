import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import SaxonJS from "saxon-js";
import xpath from "xpath";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRANSFORM_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = path.resolve(TRANSFORM_DIR, "..");
const DATA_DIR = path.join(ROOT_DIR, "data", "xml");
const XSLT_DIR = path.join(TRANSFORM_DIR, "src", "xslt");
const CACHE_DIR = path.join(TRANSFORM_DIR, ".cache");
const NS = "https://lenz-archiv.de";
const stylesheetFileCache = new Map();
const LETTER_CONCURRENCY = Math.max(
  1,
  Math.min(typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length, 8)
);

const select = xpath.useNamespaces({ l: NS });
const parser = new DOMParser();
const serializer = new XMLSerializer();

function textContent(node) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function getAttribute(node, name, fallback = null) {
  const value = node?.getAttribute?.(name);
  return value == null || value === "" ? fallback : value;
}

function slugifyLetter(letter) {
  return `letter-${String(letter).padStart(3, "0")}`;
}

function serializeNode(node) {
  return serializer.serializeToString(node);
}

function serializeChildNode(node) {
  if (node.nodeType === 3) {
    return node.data;
  }
  if (node.nodeType === 4) {
    return `<![CDATA[${node.data}]]>`;
  }
  if (node.nodeType === 8) {
    return `<!--${node.data}-->`;
  }
  return serializer.serializeToString(node);
}

function createTimings() {
  const totals = new Map();
  const counts = new Map();

  return {
    record(label, durationMs) {
      totals.set(label, (totals.get(label) ?? 0) + durationMs);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    },
    async measure(label, fn) {
      const startedAt = performance.now();
      try {
        return await fn();
      } finally {
        this.record(label, performance.now() - startedAt);
      }
    },
    snapshot() {
      return Array.from(totals.entries())
        .map(([label, totalMs]) => ({
          label,
          totalMs,
          count: counts.get(label) ?? 0
        }))
        .sort((a, b) => b.totalMs - a.totalMs);
    }
  };
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(targetPath, content) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

async function removeFileIfExists(targetPath) {
  try {
    await fs.unlink(targetPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function readXml(fileName) {
  const source = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
  return parser.parseFromString(source, "text/xml");
}

async function compileStylesheet(name, timings) {
  return await timings.measure("compileStylesheet", async () => {
    await ensureDir(CACHE_DIR);
    const stylesheetPath = path.join(XSLT_DIR, `${name}.xsl`);
    const sefPath = path.join(CACHE_DIR, `${name}.sef.json`);
    const dependencyPaths = [stylesheetPath];
    const commonStylesheetPath = path.join(XSLT_DIR, "common.xsl");
    if (name !== "common") {
      dependencyPaths.push(commonStylesheetPath);
    }

    const dependencyStats = await Promise.all(dependencyPaths.map((dependencyPath) => fs.stat(dependencyPath)));
    const latestDependencyMtime = Math.max(...dependencyStats.map((stat) => stat.mtimeMs));
    let shouldCompile = true;

    try {
      const sefStat = await fs.stat(sefPath);
      shouldCompile = latestDependencyMtime > sefStat.mtimeMs;
    } catch {
      shouldCompile = true;
    }

    if (shouldCompile) {
      const xslt3Bin = path.join(
        TRANSFORM_DIR,
        "node_modules",
        ".bin",
        process.platform === "win32" ? "xslt3.cmd" : "xslt3"
      );
      await execFileAsync(xslt3Bin, [
        "-xsl:" + stylesheetPath,
        "-export:" + sefPath,
        "-nogo"
      ]);
    }

    return sefPath;
  });
}

async function runStylesheet(name, params, timings, options = {}) {
  if (!stylesheetFileCache.has(name)) {
    stylesheetFileCache.set(name, compileStylesheet(name, timings));
  }

  const stylesheetFileName = await stylesheetFileCache.get(name);
  const result = await timings.measure(
    `transform:${name}`,
    async () =>
      await SaxonJS.transform(
        {
          stylesheetFileName,
          destination: "serialized",
          initialTemplate: "Q{http://www.w3.org/1999/XSL/Transform}initial-template",
          ...params
        },
        "async"
      )
  );

  if (options.trim === false) {
    return result.principalResult;
  }

  return String(result.principalResult ?? "").trim();
}

async function getGitMetadata() {
  const [commitHashResult, commitDateResult] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], { cwd: ROOT_DIR }),
    execFileAsync("git", ["show", "-s", "--format=%cI", "HEAD"], { cwd: ROOT_DIR })
  ]);

  return {
    commitHash: commitHashResult.stdout.trim(),
    commitDate: commitDateResult.stdout.trim()
  };
}

function buildReferenceMaps(referencesDoc) {
  const personMap = new Map();
  const locationMap = new Map();
  const appMap = new Map();

  for (const node of select("//l:personDef", referencesDoc)) {
    personMap.set(String(getAttribute(node, "index")), {
      index: String(getAttribute(node, "index")),
      name: getAttribute(node, "name"),
      vorname: getAttribute(node, "vorname"),
      nachname: getAttribute(node, "nachname"),
      komm: getAttribute(node, "komm"),
      ref: getAttribute(node, "ref")
    });
  }

  for (const node of select("//l:locationDef", referencesDoc)) {
    locationMap.set(String(getAttribute(node, "index")), {
      index: String(getAttribute(node, "index")),
      name: getAttribute(node, "name"),
      ref: getAttribute(node, "ref")
    });
  }

  for (const node of select("//l:appDef", referencesDoc)) {
    appMap.set(String(getAttribute(node, "index")), {
      index: String(getAttribute(node, "index")),
      name: getAttribute(node, "name"),
      category: getAttribute(node, "category")
    });
  }

  return { personMap, locationMap, appMap };
}

function resolveRefs(nodes, map) {
  return nodes.map((node) => {
    const ref = String(getAttribute(node, "ref", ""));
    const resolved = map.get(ref) ?? null;
    return {
      ref,
      cert: getAttribute(node, "cert"),
      erschlossen: getAttribute(node, "erschlossen"),
      label: resolved?.name ?? null,
      resolved
    };
  });
}

function extractDate(node) {
  if (!node) {
    return null;
  }

  return {
    text: textContent(node),
    when: getAttribute(node, "when"),
    notBefore: getAttribute(node, "notBefore"),
    notAfter: getAttribute(node, "notAfter"),
    from: getAttribute(node, "from"),
    to: getAttribute(node, "to"),
    cert: getAttribute(node, "cert")
  };
}

function extractMeta(letterDesc, refs) {
  const letter = String(getAttribute(letterDesc, "letter"));
  const sentNode = select("./l:sent", letterDesc)[0] ?? null;
  const receivedNode = select("./l:received", letterDesc)[0] ?? null;

  return {
    letter,
    slug: slugifyLetter(letter),
    sent: {
      date: extractDate(select("./l:date", sentNode)[0] ?? null),
      locations: resolveRefs(select("./l:location", sentNode), refs.locationMap),
      persons: resolveRefs(select("./l:person", sentNode), refs.personMap)
    },
    received: {
      date: extractDate(select("./l:date", receivedNode)[0] ?? null),
      locations: resolveRefs(select("./l:location", receivedNode), refs.locationMap),
      persons: resolveRefs(select("./l:person", receivedNode), refs.personMap)
    },
    hasOriginal: getAttribute(select("./l:hasOriginal", letterDesc)[0] ?? null, "value") === "true",
    isProofread: getAttribute(select("./l:isProofread", letterDesc)[0] ?? null, "value") === "true",
    isDraft: getAttribute(select("./l:isDraft", letterDesc)[0] ?? null, "value") === "true"
  };
}

function collectSidenotePages(letterText) {
  const pages = new Set();
  for (const note of select("./l:sidenote", letterText)) {
    pages.add(String(getAttribute(note, "page")));
  }
  return Array.from(pages).sort((a, b) => Number(a) - Number(b));
}

function splitLetterTextByPage(letterText, letter) {
  const pageMap = new Map();
  let currentPage = null;
  let currentChunks = [];

  for (const node of Array.from(letterText.childNodes)) {
    if (node.nodeType === 1 && node.localName === "page") {
      if (currentPage !== null) {
        pageMap.set(
          currentPage,
          `<letterPage xmlns="${NS}" letter="${letter}" page="${currentPage}">${currentChunks.join("")}</letterPage>`
        );
      }
      currentPage = String(getAttribute(node, "index"));
      currentChunks = [serializeChildNode(node)];
      continue;
    }

    if (currentPage !== null) {
      currentChunks.push(serializeChildNode(node));
    }
  }

  if (currentPage !== null) {
    pageMap.set(
      currentPage,
      `<letterPage xmlns="${NS}" letter="${letter}" page="${currentPage}">${currentChunks.join("")}</letterPage>`
    );
  }

  return pageMap;
}

function buildSidenoteRecords(sidenotes, letter, page, htmlItems) {
  return sidenotes.map((node, index) => ({
    id: `${slugifyLetter(letter)}-page-${page}-sidenote-${index + 1}`,
    order: index + 1,
    letter: String(letter),
    page: String(page),
    pos: getAttribute(node, "pos"),
    annotation: getAttribute(node, "annotation"),
    html: htmlItems[index] ?? ""
  }));
}

function extractTraditionPresence(traditionNode) {
  return Boolean(traditionNode && xpath.select("./*[local-name()='app']", traditionNode).length > 0);
}

function renderEmptyTraditions(letter) {
  return `<section class="traditions" data-letter="${letter}"></section>`;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}

async function exportEdition({ outDir }) {
  const timings = createTimings();
  const startedAt = performance.now();
  const absoluteOutDir = path.resolve(outDir);
  const briefeDoc = await timings.measure("readXml:briefe", async () => await readXml("briefe.xml"));
  const metaDoc = await timings.measure("readXml:meta", async () => await readXml("meta.xml"));
  const traditionsDoc = await timings.measure("readXml:traditions", async () => await readXml("traditions.xml"));
  const referencesDoc = await timings.measure("readXml:references", async () => await readXml("references.xml"));
  const git = await timings.measure("gitMetadata", async () => await getGitMetadata());
  const refs = await timings.measure("buildReferenceMaps", async () => buildReferenceMaps(referencesDoc));

  await timings.measure("resetOutDir", async () => await resetDir(absoluteOutDir));

  const letterTextNodes = await timings.measure("select:letterTextNodes", async () => select("/l:opus/l:document/l:letterText", briefeDoc));
  const metaLetterNodes = await timings.measure("select:metaLetterNodes", async () => select("/l:opus/l:descriptions/l:letterDesc", metaDoc));
  const traditionLetterNodes = await timings.measure(
    "select:traditionLetterNodes",
    async () =>
      xpath.select(
        "/*[local-name()='opus']/*[local-name()='traditions']/*[local-name()='letterTradition']",
        traditionsDoc
      )
  );
  const metaByLetter = new Map(
    metaLetterNodes.map((node) => [
      String(getAttribute(node, "letter")),
      extractMeta(node, refs)
    ])
  );
  const traditionsByLetter = new Map(
    traditionLetterNodes.map((node) => [
      String(getAttribute(node, "letter")),
      node
    ])
  );

  const indexEntries = await timings.measure("processLetters", async () =>
    await mapWithConcurrency(letterTextNodes, LETTER_CONCURRENCY, async (letterText) => {
      return await timings.measure("processLetter", async () => {
    const letter = String(getAttribute(letterText, "letter"));
    const slug = slugifyLetter(letter);
    const letterDir = path.join(absoluteOutDir, "letters", letter);
    const pageXmlMap = await timings.measure("splitLetterTextByPage", async () => splitLetterTextByPage(letterText, letter));

    const traditionNode = traditionsByLetter.get(letter) ?? null;
    const hasTraditions = extractTraditionPresence(traditionNode);
    const traditionsHtml = hasTraditions
      ? await runStylesheet(
          "traditions",
          {
            sourceText: serializeNode(traditionNode),
            stylesheetParams: {
              letter
            }
          },
          timings
        )
      : renderEmptyTraditions(letter);
    const meta = metaByLetter.get(letter) ?? {
      letter,
      slug,
      sent: { date: null, locations: [], persons: [] },
      received: { date: null, locations: [], persons: [] },
      hasOriginal: false,
      isProofread: false,
      isDraft: false
    };

    for (const [page, pageXml] of pageXmlMap.entries()) {
      const textHtml = await runStylesheet(
        "letter-text",
        {
          sourceText: pageXml,
          stylesheetParams: {
            letter,
            page
          }
        },
        timings
      );
      await timings.measure("writeFile:textHtml", async () => await writeFile(path.join(letterDir, page, "text.html"), textHtml + "\n"));

      const sidenotes = await timings.measure("select:pageSidenotes", async () => select(`./l:sidenote[@page='${page}']`, letterText));
      const sidenotesPath = path.join(letterDir, page, "sidenotes.json");
      if (sidenotes.length > 0) {
        const htmlItems = await Promise.all(
          sidenotes.map((sidenote) =>
            runStylesheet(
              "sidenotes",
              {
                sourceText: serializeNode(sidenote),
                stylesheetParams: {
                  letter
                }
              },
              timings
            )
          )
        );
        const records = buildSidenoteRecords(sidenotes, letter, page, htmlItems);
        await timings.measure(
          "writeFile:sidenotesJson",
          async () =>
            await writeFile(
              sidenotesPath,
              JSON.stringify(records, null, 2) + "\n"
            )
        );
      } else {
        await timings.measure("removeFile:sidenotesJson", async () => await removeFileIfExists(sidenotesPath));
      }
    }

    const sidenotePages = await timings.measure("collectSidenotePages", async () => collectSidenotePages(letterText));
    const hasSidenotes = sidenotePages.length > 0;
    const metaOutput = {
      ...meta,
      letter,
      slug,
      hasText: true,
      hasTraditions,
      hasSidenotes,
      pageCount: pageXmlMap.size,
      pages: Array.from(pageXmlMap.keys()).sort((a, b) => Number(a) - Number(b)),
      traditionsHtml
    };
    await timings.measure("writeFile:metaJson", async () => await writeFile(path.join(letterDir, "meta.json"), JSON.stringify(metaOutput, null, 2) + "\n"));

        return {
          ...metaOutput,
          traditionsHtml: undefined
        };
      });
    })
  );

  indexEntries.sort((a, b) => Number(a.letter) - Number(b.letter));
  await timings.measure(
    "writeFile:indexJson",
    async () =>
      await writeFile(
        path.join(absoluteOutDir, "letters", "index.json"),
        JSON.stringify(indexEntries, null, 2) + "\n"
      )
  );
  await timings.measure(
    "writeFile:statsJson",
    async () =>
      await writeFile(
        path.join(absoluteOutDir, "stats.json"),
        JSON.stringify(
          {
            ...git,
            counts: {
              meta: metaLetterNodes.length,
              letterText: letterTextNodes.length,
              traditions: traditionLetterNodes.length
            }
          },
          null,
          2
        ) + "\n"
      )
  );

  return {
    totalMs: performance.now() - startedAt,
    timings: timings.snapshot()
  };
}

export { exportEdition };
