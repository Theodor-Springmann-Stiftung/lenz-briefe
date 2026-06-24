import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

export function resolveGeneratedRoot(env = process.env) {
  return env.LENZ_GENERATED_DIR
    ? path.resolve(env.LENZ_GENERATED_DIR)
    : path.join(appRoot, "generated");
}

export function getGeneratedIndexPath(generatedRoot) {
  return path.join(generatedRoot, "letters", "index.json");
}

export function getGeneratedStatusPath(generatedRoot) {
  return path.join(generatedRoot, "status.json");
}

export function parseGeneratedStatus(raw) {
  const value = JSON.parse(raw);

  if (typeof value !== "object" || value === null) {
    throw new Error("Generated status must be an object.");
  }

  if (value.version !== 1) {
    throw new Error("Generated status has an unsupported version.");
  }

  if (value.state !== "success" && value.state !== "failure") {
    throw new Error("Generated status must declare a valid state.");
  }

  if (typeof value.generator !== "string" || typeof value.generatedAt !== "string") {
    throw new Error("Generated status is missing generator or generatedAt.");
  }

  if (
    typeof value.source !== "object" ||
    value.source === null ||
    typeof value.source.commitHash !== "string" ||
    typeof value.source.commitDate !== "string"
  ) {
    throw new Error("Generated status source metadata is invalid.");
  }

  // commitMessage is optional (older exports may not include it)
  if (typeof value.source.commitMessage !== "undefined" && typeof value.source.commitMessage !== "string") {
    throw new Error("Generated status source commitMessage is invalid.");
  }

  // warnings is optional
  if (typeof value.warnings !== "undefined") {
    if (!Array.isArray(value.warnings)) {
      throw new Error("Generated status warnings must be an array.");
    }

    for (const warning of value.warnings) {
      if (
        typeof warning !== "object" ||
        warning === null ||
        typeof warning.kind !== "string" ||
        typeof warning.stage !== "string" ||
        typeof warning.message !== "string"
      ) {
        throw new Error("Generated status warning entry is invalid.");
      }

      if (typeof warning.line !== "undefined" && typeof warning.line !== "number") {
        throw new Error("Generated status warning line must be a number.");
      }

      if (typeof warning.file !== "undefined" && typeof warning.file !== "string") {
        throw new Error("Generated status warning file must be a string.");
      }
    }
  }

  if (value.state === "success") {
    const counts = value.success?.counts;
    if (
      typeof counts?.meta !== "number" ||
      typeof counts?.letterText !== "number" ||
      typeof counts?.traditions !== "number"
    ) {
      throw new Error("Generated success status counts are invalid.");
    }
  }

  if (value.state === "failure") {
    if (
      typeof value.failure?.kind !== "string" ||
      typeof value.failure?.stage !== "string" ||
      typeof value.failure?.message !== "string"
    ) {
      throw new Error("Generated failure status details are invalid.");
    }
  }

  return value;
}

export async function validateGeneratedData(env = process.env) {
  const generatedRoot = resolveGeneratedRoot(env);
  const statusPath = getGeneratedStatusPath(generatedRoot);
  const indexPath = getGeneratedIndexPath(generatedRoot);

  try {
    await access(generatedRoot);
  } catch (error) {
    throw new Error(
      `Missing generated edition data directory at ${generatedRoot}. Run the transform step first or set LENZ_GENERATED_DIR.`
    );
  }

  let statusRaw;

  try {
    statusRaw = await readFile(statusPath, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : undefined;

    if (code === "ENOENT") {
      throw new Error(
        `Missing generated status at ${statusPath}. Run the transform step first or set LENZ_GENERATED_DIR.`
      );
    }

    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Generated status at ${statusPath} is not readable. Check file permissions or set LENZ_GENERATED_DIR to a readable export.`
      );
    }

    throw error;
  }

  try {
    const status = parseGeneratedStatus(statusRaw);

    if (status.state === "failure") {
      return;
    }
  } catch (error) {
    throw new Error(
      `Generated status at ${statusPath} is invalid. Re-run the transform step before building the app.`
    );
  }

  let raw;

  try {
    raw = await readFile(indexPath, "utf8");
  } catch (error) {
    const code = error && typeof error === "object" ? error.code : undefined;

    if (code === "ENOENT") {
      throw new Error(
        `Missing generated edition index at ${indexPath}. Run the transform step first or set LENZ_GENERATED_DIR.`
      );
    }

    if (code === "EACCES" || code === "EPERM") {
      throw new Error(
        `Generated edition index at ${indexPath} is not readable. Check file permissions or set LENZ_GENERATED_DIR to a readable export.`
      );
    }

    throw error;
  }

  try {
    JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Generated edition index at ${indexPath} is not valid JSON. Re-run the transform step before building the app.`
    );
  }
}

async function main() {
  try {
    await validateGeneratedData();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  await main();
}
