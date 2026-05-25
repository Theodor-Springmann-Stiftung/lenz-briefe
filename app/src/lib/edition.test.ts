import test from "node:test";
import assert from "node:assert/strict";

import {
  getAllYearGroups,
  getChronologicalDateKey,
  getEarliestDateBoundary,
  getLetterNeighbors,
  type DateInfo,
  type LetterMeta
} from "./edition.ts";

function makeDate(overrides: Partial<DateInfo> = {}): DateInfo {
  return {
    text: "",
    when: null,
    notBefore: null,
    notAfter: null,
    from: null,
    to: null,
    cert: null,
    ...overrides
  };
}

function makeMeta(overrides: Partial<LetterMeta> = {}): LetterMeta {
  return {
    letter: "1",
    slug: "letter-001",
    sent: {
      date: null,
      locations: [],
      persons: []
    },
    received: {
      date: null,
      locations: [],
      persons: []
    },
    hasOriginal: false,
    isProofread: false,
    isDraft: false,
    hasText: true,
    hasTraditions: false,
    hasSidenotes: false,
    pageCount: 0,
    pages: [],
    ...overrides
  };
}

test("getEarliestDateBoundary returns when when it is the only populated boundary", () => {
  assert.equal(getEarliestDateBoundary(makeDate({ when: "1775-04-08" })), "1775-04-08");
});

test("getEarliestDateBoundary chooses the earliest boundary in a from/to range", () => {
  assert.equal(
    getEarliestDateBoundary(makeDate({ from: "1772-10-02", to: "1772-10-10" })),
    "1772-10-02"
  );
});

test("getEarliestDateBoundary chooses the earliest boundary in a notBefore/notAfter range", () => {
  assert.equal(
    getEarliestDateBoundary(makeDate({ notBefore: "1775-05-01", notAfter: "1775-05-15" })),
    "1775-05-01"
  );
});

test("getEarliestDateBoundary chooses the earliest populated field even when it is not first in the old precedence order", () => {
  assert.equal(
    getEarliestDateBoundary(
      makeDate({
        when: "1776-10-26",
        notBefore: "1776-10-01",
        notAfter: "1776-11-30"
      })
    ),
    "1776-10-01"
  );
});

test("getChronologicalDateKey falls back to the received date when the sent date is missing", () => {
  assert.equal(
    getChronologicalDateKey(
      makeMeta({
        sent: { date: null, locations: [], persons: [] },
        received: { date: makeDate({ notBefore: "1780-11-01" }), locations: [], persons: [] }
      })
    ),
    "1780-11-01"
  );
});

test("getChronologicalDateKey returns null when neither sent nor received has a date", () => {
  assert.equal(getChronologicalDateKey(makeMeta()), null);
});

test("equal chronological dates are kept in numeric letter order in year-group lists", async () => {
  const groups = await getAllYearGroups();
  const group = groups.find((item) => item.id === "1771-1775");

  assert.ok(group, "expected year group 1771-1775 to exist");

  const letters = group.letters.map((item) => item.letter);
  const index16 = letters.indexOf("16");
  const index25 = letters.indexOf("25");

  assert.notEqual(index16, -1);
  assert.notEqual(index25, -1);
  assert.ok(index16 < index25, "letter 16 should sort before letter 25 when the date key ties");
});

test("chronological neighbors follow date order instead of numeric letter order", async () => {
  const neighbors = await getLetterNeighbors("25");

  assert.equal(neighbors.previous?.letter, "16");
  assert.equal(neighbors.next?.letter, "18");
});

test("year-group list order matches the chronological navigation order", async () => {
  const groups = await getAllYearGroups();
  const group = groups.find((item) => item.id === "1771-1775");

  assert.ok(group, "expected year group 1771-1775 to exist");

  const letters = group.letters.map((item) => item.letter);
  const slice = letters.slice(letters.indexOf("16"), letters.indexOf("19") + 1);

  assert.deepEqual(slice, ["16", "25", "18", "19"]);
});
