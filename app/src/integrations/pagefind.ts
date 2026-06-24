import type { AstroIntegration } from "astro";
import { createIndex } from "pagefind";
import fs from "node:fs";
import path from "node:path";

const CONFIG = {
  forceLanguage: "de",
  excludeSelectors: [".lb-page", ".page-anchor"],
};

async function buildIndex(htmlDir: string, outputDir: string) {
  const { index, errors } = await createIndex(CONFIG);
  if (errors?.length) console.error("[pagefind]", ...errors);
  if (!index) return false;

  const addRes = await index.addDirectory({ path: htmlDir });
  if (addRes.errors?.length) console.error("[pagefind]", ...addRes.errors);

  await index.writeFiles({ outputPath: outputDir });
  return addRes.page_count;
}

function serveMiddleware(pagefindRoot: string) {
  return (req: any, res: any, next: any) => {
    const filePath = path.join(pagefindRoot, req.url?.replace(/\?.*$/, "") ?? "");
    if (!fs.existsSync(filePath)) return next();

    const mime: Record<string, string> = {
      ".js": "application/javascript",
      ".css": "text/css",
      ".wasm": "application/wasm",
      ".json": "application/json",
    };
    res.writeHead(200, {
      "Content-Type": mime[path.extname(filePath)] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  };
}

export default function pagefind(): AstroIntegration {
  return {
    name: "pagefind",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const distDir = path.resolve(dir.pathname);
        const outDir = path.join(distDir, "pagefind");

        logger.info("Building Pagefind search index …");
        const count = await buildIndex(distDir, outDir);
        if (count !== false) {
          logger.info(`Pagefind index done — ${count} pages`);
        } else {
          logger.error("Pagefind index failed");
        }
      },

      "astro:server:setup": async ({ server, logger }) => {
        const pagefindRoot = path.resolve("dist", "pagefind");

        if (!fs.existsSync(pagefindRoot)) {
          const distDir = path.resolve("dist");
          if (fs.existsSync(distDir)) {
            logger.info("Building Pagefind index for dev server …");
            const count = await buildIndex(distDir, pagefindRoot);
            if (count !== false) {
              logger.info(`Pagefind dev index ready — ${count} pages`);
            }
          } else {
            logger.info(
              "No Pagefind index yet — run `npm run build` to create it"
            );
          }
        }

        server.middlewares.use("/pagefind", serveMiddleware(pagefindRoot));
      },
    },
  };
}
