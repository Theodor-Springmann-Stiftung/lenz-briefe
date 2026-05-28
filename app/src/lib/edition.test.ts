import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  getAllYearGroups,
  getChronologicalDateKey,
  getEarliestDateBoundary,
  getFailureLetterIds,
  getLetterBundle,
  getGeneratedRoot,
  getLetterNeighbors,
  getYearGroupDefinitions,
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

function compactHtml(html: string): string {
  return html.replace(/\s+/g, " ").trim();
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

test("getGeneratedRoot defaults to the app generated directory", () => {
  assert.equal(getGeneratedRoot(), path.join(process.cwd(), "generated"));
});

test("getLetterBundle returns a continuous text stream with page-keyed sidenotes", async () => {
  const bundle = await getLetterBundle("1");

  assert.deepEqual(bundle.pages, bundle.meta.pages);
  assert.match(bundle.textHtml, /class="page-anchor" id="page-1"/);
  assert.match(bundle.textHtml, /class="lb-page" data-index="1"/);
  assert.match(bundle.textHtml, /class="lb-line-block/);
  assert.doesNotMatch(bundle.textHtml, /class="letter-text"/);
  assert.doesNotMatch(bundle.textHtml, /<br class="lb-line"/);
  assert.deepEqual(Object.keys(bundle.sidenotesByPage), bundle.pages);
  assert.ok(Array.isArray(bundle.sidenotesByPage["1"]));
});

test("sidenotes and tables use the normalized block model", async () => {
  const sidenoteBundle = await getLetterBundle("108");
  const tableBundle = await getLetterBundle("366");
  const compactTableHtml = compactHtml(tableBundle.textHtml);

  assert.match(sidenoteBundle.sidenotesByPage["1"][0]?.html ?? "", /class="lb-line-block/);
  assert.doesNotMatch(sidenoteBundle.sidenotesByPage["1"][0]?.html ?? "", /<br class="lb-line"/);
  assert.match(tableBundle.textHtml, /class="lb-tab-row"/);
  assert.match(compactTableHtml, /data-layout="aligned".*<div class="align-right">Ihr aufrichtig ergebenster JMRlands\.<\/div>/);
});

test("align-bearing lines render into left center and right slots", async () => {
  const singleAlignBundle = await getLetterBundle("108");
  const mixedAlignBundle = await getLetterBundle("163");
  const reverseOrderBundle = await getLetterBundle("158");
  const repeatedRightBundle = await getLetterBundle("65");
  const plainLeftRightBundle = await getLetterBundle("349");
  const compactSingleAlignHtml = compactHtml(singleAlignBundle.textHtml);
  const compactMixedAlignHtml = compactHtml(mixedAlignBundle.textHtml);
  const compactReverseOrderHtml = compactHtml(reverseOrderBundle.textHtml);
  const compactRepeatedRightHtml = compactHtml(repeatedRightBundle.textHtml);
  const compactPlainLeftRightHtml = compactHtml(plainLeftRightBundle.textHtml);

  assert.match(
    compactSingleAlignHtml,
    /data-layout="aligned"> <div class="align-left">.*?<\/div> <div class="align-center">Bester Freund!<\/div> <div class="align-right"><\/div>/
  );
  assert.match(
    compactMixedAlignHtml,
    /data-layout="aligned"> <div class="align-left">.*?<span class="page-anchor" id="page-1">.*?<\/span><span class="lb-page" data-index="1"><\/span>.*?<\/div> <div class="align-center"><span class="note">Empfangsnotiz Boies:<\/span><\/div> <div class="align-right"><span class="hand" data-ref="20">Den 26 Apr\. 76\.<\/span><\/div>/
  );
  assert.match(
    compactReverseOrderHtml,
    /data-layout="aligned"> <div class="align-left">.*?<span class="page-anchor" id="page-1">.*?<\/span><span class="lb-page" data-index="1"><\/span>.*?<\/div> <div class="align-center">Weimar d\. 14ten Aprill\.<\/div> <div class="align-right"><span class="aq">verte<\/span><\/div>/
  );
  assert.match(
    compactRepeatedRightHtml,
    /data-layout="aligned"> <div class="align-left">.*?<\/div> <div class="align-center"><\/div> <div class="align-right">Lenz\. <span class="aq"><span class="fn" data-index="5"><span class="anchor">#<\/span><\/span> verte<\/span><\/div>/
  );
  assert.match(
    compactPlainLeftRightHtml,
    /data-tab="5" data-layout="aligned"> <div class="align-left">mit Glanz erfüllt <\/div> <div class="align-center"><\/div> <div class="align-right">Shsp\.<\/div>/
  );
});

test("directional insertions render with a CSS marker hook", async () => {
  const topInsertionBundle = await getLetterBundle("46");
  const leftInsertionBundle = await getLetterBundle("64");
  const rightInsertionBundle = await getLetterBundle("372");
  const bottomInsertionBundle = await getLetterBundle("232");

  assert.match(
    compactHtml(topInsertionBundle.textHtml),
    /<span class="insertion" data-pos="top"><span class="insertion-marker"><\/span>noch<\/span>/
  );
  assert.match(
    compactHtml(leftInsertionBundle.textHtml),
    /<span class="insertion" data-pos="left"><span class="insertion-marker"><\/span>Wenn wird<\/span>/
  );
  assert.match(
    compactHtml(rightInsertionBundle.textHtml),
    /<span class="insertion" data-pos="right"><span class="insertion-marker"><\/span>\(Liefland\)<\/span>/
  );
  assert.match(
    compactHtml(bottomInsertionBundle.textHtml),
    /<span class="insertion" data-pos="bottom"><span class="insertion-marker"><\/span>ou du moins plus cachés<\/span>/
  );
});

test("page markers stay inline instead of creating synthetic line blocks", async () => {
  const lineStartBundle = await getLetterBundle("79");
  const inlineCarryBundle = await getLetterBundle("20");
  const nextBlockCarryBundle = await getLetterBundle("42");

  assert.match(
    lineStartBundle.textHtml,
    /<div class="lb-line-block" data-type="break" data-tab="1"><span class="page-anchor" id="page-1">.*?<\/span><span class="lb-page" data-index="1"><\/span>Ulm/s
  );
  assert.match(
    lineStartBundle.textHtml,
    /<span class="page-anchor" id="page-4" data-inline-break="true"> \| <\/span><span class="lb-page" data-index="4"><\/span>gedanckt/s
  );
  assert.match(
    inlineCarryBundle.textHtml,
    /<span class="aq">Corres-<\/span> <span class="page-anchor" id="page-3" data-inline-break="true"> \| <\/span><span class="lb-page" data-index="3"><\/span><span class="aq">pondence<\/span>/s
  );
  assert.match(
    inlineCarryBundle.textHtml,
    /data-type="empty"><\/div>\s*<div class="lb-line-block" data-type="break" data-layout="aligned">\s*<div class="align-left"><span class="page-anchor" id="page-4">.*?<\/span><span class="lb-page" data-index="4"><\/span><\/div>\s*<div class="align-center"><span class="note">Außenseite des zum Umschlag gefalteten Bogens, roter Siegelrest:<\/span><\/div>/s
  );
  assert.match(
    nextBlockCarryBundle.textHtml,
    /Wie stehts um d\. Fenster die ich eingeschmissen\s*<\/div>\s*<div class="lb-line-block lb-line-block--empty" data-type="empty"><\/div>\s*<div class="lb-line-block" data-type="break" data-tab="6"><span class="page-anchor" id="page-3">.*?<\/span><span class="lb-page" data-index="3"><\/span>\s*Merk\./s
  );
  assert.match(
    nextBlockCarryBundle.textHtml,
    /<\/div>\s*<div class="lb-line-block" data-type="break" data-tab="1"><span class="page-anchor" id="page-4">.*?<\/span><span class="lb-page" data-index="4"><\/span>\s*Wie sehr wünscht/s
  );
});

test("getYearGroupDefinitions exposes the hardcoded year groups", () => {
  assert.deepEqual(
    getYearGroupDefinitions().map((group) => group.id),
    ["1756-1770", "1771-1775", "1776", "1777-1779", "1780-1792"]
  );
});

test("getFailureLetterIds creates the synthetic failure-mode brief routes", () => {
  assert.deepEqual(getFailureLetterIds(3), ["1", "2", "3"]);
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
