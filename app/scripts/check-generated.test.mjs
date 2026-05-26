import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  getGeneratedIndexPath,
  getGeneratedStatusPath,
  parseGeneratedStatus,
  resolveGeneratedRoot,
  validateGeneratedData
} from "./check-generated.mjs";

const tempRoot = await mkdtemp(path.join(tmpdir(), "lenz-generated-check-"));

function makeStatus(state, overrides = {}) {
  const base = {
    version: 1,
    state,
    generator: "python",
    generatedAt: "2026-05-26T00:00:00.000Z",
    source: {
      commitHash: "abc123",
      commitDate: "2026-05-26T00:00:00.000Z"
    }
  };

  if (state === "success") {
    return JSON.stringify(
      {
        ...base,
        success: {
          counts: {
            meta: 1,
            letterText: 1,
            traditions: 1
          }
        },
        ...overrides
      },
      null,
      2
    );
  }

  return JSON.stringify(
    {
      ...base,
      failure: {
        kind: "xslt",
        stage: "transform:letter-text",
        message: "boom"
      },
      ...overrides
    },
    null,
    2
  );
}

async function makeGeneratedFixture(name, statusContents, indexContents = "[]") {
  const root = path.join(tempRoot, name);
  const lettersDir = path.join(root, "letters");

  await mkdir(lettersDir, { recursive: true });
  await writeFile(path.join(root, "status.json"), statusContents, "utf8");
  await writeFile(path.join(lettersDir, "index.json"), indexContents, "utf8");

  return root;
}

test("resolveGeneratedRoot honors LENZ_GENERATED_DIR when provided", () => {
  const resolved = resolveGeneratedRoot({ LENZ_GENERATED_DIR: "../custom-generated" });

  assert.equal(resolved, path.resolve("../custom-generated"));
});

test("getGeneratedIndexPath appends the sentinel path", () => {
  assert.equal(getGeneratedIndexPath("/tmp/generated"), path.join("/tmp/generated", "letters", "index.json"));
});

test("getGeneratedStatusPath appends the status path", () => {
  assert.equal(getGeneratedStatusPath("/tmp/generated"), path.join("/tmp/generated", "status.json"));
});

test("parseGeneratedStatus accepts a valid success payload", () => {
  const parsed = parseGeneratedStatus(makeStatus("success"));

  assert.equal(parsed.state, "success");
});

test("validateGeneratedData succeeds for a readable success export", async () => {
  const root = await makeGeneratedFixture("valid", makeStatus("success"));

  await assert.doesNotReject(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }));
});

test("validateGeneratedData succeeds for a failure export without an index", async () => {
  const root = path.join(tempRoot, "failure-status-only");

  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "status.json"), makeStatus("failure"), "utf8");

  await assert.doesNotReject(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }));
});

test("validateGeneratedData fails when the generated root is missing", async () => {
  const root = path.join(tempRoot, "missing-root");

  await assert.rejects(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }), {
    message: `Missing generated edition data directory at ${root}. Run the transform step first or set LENZ_GENERATED_DIR.`
  });
});

test("validateGeneratedData fails when the status file is missing", async () => {
  const root = path.join(tempRoot, "missing-status");

  await mkdir(root, { recursive: true });

  await assert.rejects(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }), {
    message: `Missing generated status at ${path.join(root, "status.json")}. Run the transform step first or set LENZ_GENERATED_DIR.`
  });
});

test("validateGeneratedData fails when the status file is invalid", async () => {
  const root = path.join(tempRoot, "invalid-status");

  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "status.json"), "{", "utf8");

  await assert.rejects(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }), {
    message: `Generated status at ${path.join(root, "status.json")} is invalid. Re-run the transform step before building the app.`
  });
});

test("validateGeneratedData fails when the success sentinel index is missing", async () => {
  const root = path.join(tempRoot, "missing-index");

  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "status.json"), makeStatus("success"), "utf8");

  await assert.rejects(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }), {
    message: `Missing generated edition index at ${path.join(root, "letters", "index.json")}. Run the transform step first or set LENZ_GENERATED_DIR.`
  });
});

test("validateGeneratedData fails when the sentinel index is invalid JSON", async () => {
  const root = await makeGeneratedFixture("invalid-json", makeStatus("success"), "{");

  await assert.rejects(() => validateGeneratedData({ LENZ_GENERATED_DIR: root }), {
    message: `Generated edition index at ${path.join(root, "letters", "index.json")} is not valid JSON. Re-run the transform step before building the app.`
  });
});
