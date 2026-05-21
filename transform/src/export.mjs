import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeFile(targetPath, content) {
  await ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, content, "utf8");
}

async function readXml(fileName) {
  const source = await fs.readFile(path.join(DATA_DIR, fileName), "utf8");
  return parser.parseFromString(source, "text/xml");
}

async function compileStylesheet(name) {
  await ensureDir(CACHE_DIR);
  const stylesheetPath = path.join(XSLT_DIR, `${name}.xsl`);
  const sefPath = path.join(CACHE_DIR, `${name}.sef.json`);

  const stylesheetStat = await fs.stat(stylesheetPath);
  let shouldCompile = true;

  try {
    const sefStat = await fs.stat(sefPath);
    shouldCompile = stylesheetStat.mtimeMs > sefStat.mtimeMs;
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
}

async function runStylesheet(name, params, options = {}) {
  const stylesheetFileName = await compileStylesheet(name);
  const result = await SaxonJS.transform(
    {
      stylesheetFileName,
      destination: "serialized",
      initialTemplate: "Q{http://www.w3.org/1999/XSL/Transform}initial-template",
      ...params
    },
    "async"
  );

  if (options.trim === false) {
    return result.principalResult;
  }

  return String(result.principalResult ?? "").trim();
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

function buildSidenoteRecords(letterText, letter, page, htmlItems) {
  const sidenotes = select(`./l:sidenote[@page='${page}']`, letterText);
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

async function exportEdition({ outDir }) {
  const absoluteOutDir = path.resolve(outDir);
  const briefeDoc = await readXml("briefe.xml");
  const metaDoc = await readXml("meta.xml");
  const traditionsDoc = await readXml("traditions.xml");
  const referencesDoc = await readXml("references.xml");
  const refs = buildReferenceMaps(referencesDoc);

  await ensureDir(absoluteOutDir);

  const letterTextNodes = select("/l:opus/l:document/l:letterText", briefeDoc);
  const metaByLetter = new Map(
    select("/l:opus/l:descriptions/l:letterDesc", metaDoc).map((node) => [
      String(getAttribute(node, "letter")),
      extractMeta(node, refs)
    ])
  );
  const traditionsByLetter = new Map(
    xpath.select("/*[local-name()='opus']/*[local-name()='traditions']/*[local-name()='letterTradition']", traditionsDoc).map((node) => [
      String(getAttribute(node, "letter")),
      node
    ])
  );

  const indexEntries = [];

  for (const letterText of letterTextNodes) {
    const letter = String(getAttribute(letterText, "letter"));
    const slug = slugifyLetter(letter);
    const letterDir = path.join(absoluteOutDir, "letters", letter);

    const textHtml = await runStylesheet("letter-text", {
      sourceText: serializeNode(letterText),
      stylesheetParams: {
        letter
      }
    });
    await writeFile(path.join(letterDir, "text.html"), textHtml + "\n");

    const traditionNode = traditionsByLetter.get(letter) ?? null;
    const traditionsXml = traditionNode ? serializeNode(traditionNode) : `<letterTradition xmlns="${NS}" letter="${letter}"/>`;
    const traditionsHtml = await runStylesheet("traditions", {
      sourceText: traditionsXml,
      stylesheetParams: {
        letter
      }
    });
    await writeFile(path.join(letterDir, "traditions.html"), traditionsHtml + "\n");

    const meta = metaByLetter.get(letter) ?? {
      letter,
      slug,
      sent: { date: null, locations: [], persons: [] },
      received: { date: null, locations: [], persons: [] },
      hasOriginal: false,
      isProofread: false,
      isDraft: false
    };

    const sidenotePages = collectSidenotePages(letterText);
    const allSidenoteRecords = [];
    for (const page of sidenotePages) {
      const sidenotesHtml = await runStylesheet("sidenotes", {
        sourceText: serializeNode(letterText),
        stylesheetParams: {
          letter,
          page
        }
      });
      const htmlDoc = parser.parseFromString(`<root>${sidenotesHtml}</root>`, "text/xml");
      const htmlItems = Array.from(htmlDoc.documentElement.childNodes)
        .filter((node) => node.nodeType === 1)
        .map((node) => serializer.serializeToString(node));
      const records = buildSidenoteRecords(letterText, letter, page, htmlItems);
      allSidenoteRecords.push(...records);
    }
    await writeFile(
      path.join(letterDir, "sidenotes.json"),
      JSON.stringify(allSidenoteRecords, null, 2) + "\n"
    );

    const hasSidenotes = sidenotePages.length > 0;
    const hasTraditions = extractTraditionPresence(traditionNode);
    const metaOutput = {
      ...meta,
      letter,
      slug,
      hasText: true,
      hasTraditions,
      hasSidenotes
    };
    await writeFile(path.join(letterDir, "meta.json"), JSON.stringify(metaOutput, null, 2) + "\n");

    indexEntries.push(metaOutput);
  }

  indexEntries.sort((a, b) => Number(a.letter) - Number(b.letter));
  await writeFile(
    path.join(absoluteOutDir, "letters", "index.json"),
    JSON.stringify(indexEntries, null, 2) + "\n"
  );
}

export { exportEdition };
