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
const ROOT_DIR = path.resolve(TRANSFORM_DIR, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data", "xml");
const XSLT_DIR = path.join(ROOT_DIR, "xslt");
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

class PipelineError extends Error {
  constructor(kind, stage, message, cause) {
    super(`${stage}: ${message}`);
    this.name = "PipelineError";
    this.kind = kind;
    this.stage = stage;
    this.detail = message;
    this.cause = cause;
  }

  withContext(context) {
    const details = Object.entries(context)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    const message = details ? `${this.detail} (${details})` : this.detail;
    return new PipelineError(this.kind, this.stage, message, this);
  }
}

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

async function replaceDir(stagingDir, targetDir) {
  const backupDir = `${targetDir}.backup`;
  await fs.rm(backupDir, { recursive: true, force: true });

  try {
    await fs.rename(targetDir, backupDir);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await fs.rename(stagingDir, targetDir);
  } catch (error) {
    try {
      await fs.rename(backupDir, targetDir);
    } catch {
      // Ignore restore failure and surface the original publish error.
    }
    throw error;
  }

  await fs.rm(backupDir, { recursive: true, force: true });
}

async function writeFile(targetPath, content) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

async function readXml(fileName) {
  const source = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
  return parser.parseFromString(source, "text/xml");
}

async function readRequiredXml(fileName) {
  try {
    return await readXml(fileName);
  } catch (error) {
    throw new PipelineError("xml", `readXml:${fileName.replace(/\.xml$/, "")}`, error.message, error);
  }
}

async function compileStylesheet(name, timings) {
  return await timings.measure("compileStylesheet", async () => {
    try {
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
    } catch (error) {
      throw new PipelineError("xslt", `compile:${name}`, error.message, error);
    }
  });
}

async function runStylesheet(name, params, timings, options = {}) {
  if (!stylesheetFileCache.has(name)) {
    stylesheetFileCache.set(name, compileStylesheet(name, timings));
  }

  const stylesheetFileName = await stylesheetFileCache.get(name);
  let result;

  try {
    result = await timings.measure(
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
  } catch (error) {
    if (error instanceof PipelineError) {
      throw error;
    }
    throw new PipelineError("xslt", `transform:${name}`, error.message, error);
  }

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

async function getGitMetadataSafe() {
  try {
    return await getGitMetadata();
  } catch {
    return {
      commitHash: "unknown",
      commitDate: "unknown"
    };
  }
}

function getGeneratedTimestamp() {
  return new Date().toISOString();
}

function buildSuccessStatus(generator, source, counts) {
  return {
    version: 1,
    state: "success",
    generator,
    generatedAt: getGeneratedTimestamp(),
    source,
    success: {
      counts
    }
  };
}

function buildFailureStatus(generator, source, failure) {
  return {
    version: 1,
    state: "failure",
    generator,
    generatedAt: getGeneratedTimestamp(),
    source,
    failure: {
      kind: failure.kind,
      stage: failure.stage,
      message: failure.detail
    }
  };
}

function normalizeFailure(error) {
  if (error instanceof PipelineError) {
    return error;
  }

  return new PipelineError("unknown", "export", error?.message ?? String(error), error);
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

function collectLetterPages(letterText) {
  return select("./l:page", letterText)
    .map((node) => String(getAttribute(node, "index")))
    .sort((a, b) => Number(a) - Number(b));
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
  const briefeDoc = await timings.measure("readXml:briefe", async () => await readRequiredXml("briefe.xml"));
  const metaDoc = await timings.measure("readXml:meta", async () => await readRequiredXml("meta.xml"));
  const traditionsDoc = await timings.measure("readXml:traditions", async () => await readRequiredXml("traditions.xml"));
  const referencesDoc = await timings.measure("readXml:references", async () => await readRequiredXml("references.xml"));
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
    const pages = await timings.measure("collectLetterPages", async () => collectLetterPages(letterText));

    const traditionNode = traditionsByLetter.get(letter) ?? null;
    const hasTraditions = extractTraditionPresence(traditionNode);
    let traditionsHtml = renderEmptyTraditions(letter);
    if (hasTraditions) {
      try {
        traditionsHtml = await runStylesheet(
          "traditions",
          {
            sourceText: serializeNode(traditionNode),
            stylesheetParams: {
              letter
            }
          },
          timings
        );
      } catch (error) {
        throw normalizeFailure(error).withContext({ letter });
      }
    }
    const meta = metaByLetter.get(letter) ?? {
      letter,
      slug,
      sent: { date: null, locations: [], persons: [] },
      received: { date: null, locations: [], persons: [] },
      hasOriginal: false,
      isProofread: false,
      isDraft: false
    };

    let textHtml;
    try {
      textHtml = await runStylesheet(
        "letter-text",
        {
          sourceText: serializeNode(letterText),
          stylesheetParams: {}
        },
        timings
      );
    } catch (error) {
      throw normalizeFailure(error).withContext({ letter });
    }
    await timings.measure("writeFile:textHtml", async () => await writeFile(path.join(letterDir, "text.html"), textHtml + "\n"));

    const sidenotesByPage = {};
    for (const page of pages) {
      const sidenotes = await timings.measure("select:pageSidenotes", async () => select(`./l:sidenote[@page='${page}']`, letterText));
      const records = buildSidenoteRecords(
        sidenotes,
        letter,
        page,
        Array.from({ length: sidenotes.length }, () => "")
      );

      if (sidenotes.length > 0) {
        let htmlItems;
        try {
          htmlItems = await Promise.all(
            sidenotes.map((sidenote, index) =>
              runStylesheet(
                "sidenotes",
                {
                  sourceText: serializeNode(sidenote),
                  stylesheetParams: {
                    letter,
                    sidenoteId: records[index].id
                  }
                },
                timings
              )
            )
          );
        } catch (error) {
          throw normalizeFailure(error).withContext({ letter, page });
        }
        records.forEach((record, index) => {
          record.html = htmlItems[index] ?? "";
        });
      }

      sidenotesByPage[page] = records;
    }
    await timings.measure(
      "writeFile:sidenotesJson",
      async () =>
        await writeFile(
          path.join(letterDir, "sidenotes.json"),
          JSON.stringify(sidenotesByPage, null, 2) + "\n"
        )
    );

    const sidenotePages = await timings.measure("collectSidenotePages", async () => collectSidenotePages(letterText));
    const hasSidenotes = sidenotePages.length > 0;
    const metaOutput = {
      ...meta,
      letter,
      slug,
      hasText: true,
      hasTraditions,
      hasSidenotes,
      pageCount: pages.length,
      pages,
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

  return {
    totalMs: performance.now() - startedAt,
    counts: {
      meta: metaLetterNodes.length,
      letterText: letterTextNodes.length,
      traditions: traditionLetterNodes.length
    },
    timings: timings.snapshot()
  };
}

async function runExport({ outDir, generator = "js" }) {
  const absoluteOutDir = path.resolve(outDir);
  await ensureDir(path.dirname(absoluteOutDir));
  const stagingDir = await fs.mkdtemp(path.join(path.dirname(absoluteOutDir), `${path.basename(absoluteOutDir)}-`));
  const source = await getGitMetadataSafe();

  try {
    const result = await exportEdition({ outDir: stagingDir });
    await writeFile(
      path.join(stagingDir, "status.json"),
      JSON.stringify(buildSuccessStatus(generator, source, result.counts), null, 2) + "\n"
    );
    await replaceDir(stagingDir, absoluteOutDir);
    return result;
  } catch (error) {
    const failure = normalizeFailure(error);
    await resetDir(stagingDir);
    await writeFile(
      path.join(stagingDir, "status.json"),
      JSON.stringify(buildFailureStatus(generator, source, failure), null, 2) + "\n"
    );
    await replaceDir(stagingDir, absoluteOutDir);
    throw failure;
  }
}

export { exportEdition, runExport };
