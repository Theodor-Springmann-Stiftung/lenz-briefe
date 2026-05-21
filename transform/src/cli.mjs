import { exportEdition } from "./export.mjs";

function parseArgs(argv) {
  const args = { out: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") {
      args.out = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg.startsWith("--out=")) {
      args.out = arg.slice("--out=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.out) {
    throw new Error("Missing required argument: --out <directory>");
  }

  return args;
}

async function main() {
  const { out } = parseArgs(process.argv.slice(2));
  await exportEdition({ outDir: out });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
