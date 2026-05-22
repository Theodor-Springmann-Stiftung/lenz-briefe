import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const textelementsPath = path.join(ROOT_DIR, "data", "xsd", "textelements.xsd");
const commonXslPath = path.join(ROOT_DIR, "xslt", "common.xsl");

function getInlineRefs(xsd) {
  const inlineMatch = xsd.match(
    /<xs:complexType name="inline"[\s\S]*?<xs:choice[^>]*>([\s\S]*?)<\/xs:choice>/
  );
  if (!inlineMatch) {
    throw new Error("Could not locate inline complexType in textelements.xsd");
  }

  return Array.from(
    inlineMatch[1].matchAll(/ref="([^"]+)"/g),
    (match) => match[1].split(":").at(-1)
  );
}

function getHandledTags(xsl) {
  const matches = Array.from(xsl.matchAll(/match="([^"]+)"/g), (match) => match[1]);
  const handled = new Set();

  for (const match of matches) {
    for (const part of match.split("|")) {
      const token = part.trim();
      if (token.startsWith("lb:")) {
        handled.add(token.slice("lb:".length));
      }
    }
  }

  return handled;
}

async function main() {
  const [xsd, xsl] = await Promise.all([
    fs.readFile(textelementsPath, "utf8"),
    fs.readFile(commonXslPath, "utf8")
  ]);

  const refs = getInlineRefs(xsd);
  const handled = getHandledTags(xsl);
  const missing = refs.filter((ref) => !handled.has(ref));

  if (missing.length > 0) {
    console.error("Missing XSLT handlers for schema tags:");
    for (const tag of missing) {
      console.error(`- ${tag}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Coverage OK: ${refs.length} shared inline tags handled in common.xsl`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
