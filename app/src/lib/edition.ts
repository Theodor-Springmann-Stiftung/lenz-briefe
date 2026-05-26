import { readFile } from "node:fs/promises";
import path from "node:path";

export type ResolvedRef = {
  ref: string;
  cert: string | null;
  erschlossen: string | null;
  label: string | null;
  resolved: Record<string, string | null> | null;
};

export type DateInfo = {
  text: string;
  when: string | null;
  notBefore: string | null;
  notAfter: string | null;
  from: string | null;
  to: string | null;
  cert: string | null;
};

export type LetterMeta = {
  letter: string;
  slug: string;
  sent: {
    date: DateInfo | null;
    locations: ResolvedRef[];
    persons: ResolvedRef[];
  };
  received: {
    date: DateInfo | null;
    locations: ResolvedRef[];
    persons: ResolvedRef[];
  };
  hasOriginal: boolean;
  isProofread: boolean;
  isDraft: boolean;
  hasText: boolean;
  hasTraditions: boolean;
  hasSidenotes: boolean;
  pageCount: number;
  pages: string[];
  traditionsHtml?: string;
};

export type SidenoteRecord = {
  id: string;
  order: number;
  letter: string;
  page: string;
  pos: string;
  annotation: string;
  html: string;
};

export type LetterPageData = {
  page: string;
  textHtml: string;
  sidenotes: SidenoteRecord[];
};

export type LetterBundle = {
  meta: LetterMeta;
  pages: LetterPageData[];
};

export type YearGroup = {
  id: string;
  label: string;
  start: number;
  end: number;
  letters: LetterMeta[];
};

type GeneratedSourceInfo = {
  commitHash: string;
  commitDate: string;
};

type GeneratedCounts = {
  meta: number;
  letterText: number;
  traditions: number;
};

export type GeneratedSuccessStatus = {
  version: 1;
  state: "success";
  generator: string;
  generatedAt: string;
  source: GeneratedSourceInfo;
  success: {
    counts: GeneratedCounts;
  };
};

export type GeneratedFailureStatus = {
  version: 1;
  state: "failure";
  generator: string;
  generatedAt: string;
  source: GeneratedSourceInfo;
  failure: {
    kind: string;
    stage: string;
    message: string;
  };
};

export type GeneratedStatus = GeneratedSuccessStatus | GeneratedFailureStatus;

type LetterNeighbors = {
  previous: LetterMeta | null;
  next: LetterMeta | null;
};

const appRoot = process.cwd();
const generatedRoot = process.env.LENZ_GENERATED_DIR
  ? path.resolve(process.env.LENZ_GENERATED_DIR)
  : path.join(appRoot, "generated");
const failureLetterLimit = 1000;

const yearGroupsBase = [
  { id: "1756-1770", label: "1756–1770", start: 1756, end: 1770 },
  { id: "1771-1775", label: "1771–1775", start: 1771, end: 1775 },
  { id: "1776", label: "1776", start: 1776, end: 1776 },
  { id: "1777-1779", label: "1777–1779", start: 1777, end: 1779 },
  { id: "1780-1792", label: "1780–1792", start: 1780, end: 1792 }
] as const;

export type YearGroupId = (typeof yearGroupsBase)[number]["id"];

let letterIndexPromise: Promise<LetterMeta[]> | null = null;
let orderedLetterIndexPromise: Promise<LetterMeta[]> | null = null;
let yearGroupsPromise: Promise<YearGroup[]> | null = null;
let groupedYearIndexPromise: Promise<YearGroup[]> | null = null;
let neighborMapPromise: Promise<Map<string, LetterNeighbors>> | null = null;
let generatedStatusPromise: Promise<GeneratedStatus> | null = null;

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function readOptionalJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function readTextFile(filePath: string): Promise<string> {
  return await readFile(filePath, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseGeneratedStatus(value: unknown): GeneratedStatus {
  if (!isRecord(value)) {
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

  if (!isRecord(value.source)) {
    throw new Error("Generated status is missing source metadata.");
  }

  if (typeof value.source.commitHash !== "string" || typeof value.source.commitDate !== "string") {
    throw new Error("Generated status source metadata is invalid.");
  }

  if (value.state === "success") {
    if (!isRecord(value.success) || !isRecord(value.success.counts)) {
      throw new Error("Generated success status is missing counts.");
    }

    const counts = value.success.counts;
    if (
      typeof counts.meta !== "number" ||
      typeof counts.letterText !== "number" ||
      typeof counts.traditions !== "number"
    ) {
      throw new Error("Generated success status counts are invalid.");
    }

    return value as GeneratedSuccessStatus;
  }

  if (!isRecord(value.failure)) {
    throw new Error("Generated failure status is missing failure details.");
  }

  if (
    typeof value.failure.kind !== "string" ||
    typeof value.failure.stage !== "string" ||
    typeof value.failure.message !== "string"
  ) {
    throw new Error("Generated failure status details are invalid.");
  }

  return value as GeneratedFailureStatus;
}

export function getEarliestDateBoundary(date: DateInfo | null): string | null {
  if (!date) {
    return null;
  }

  const candidates = [date.when, date.from, date.notBefore, date.to, date.notAfter].filter(
    (value): value is string => Boolean(value)
  );
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((earliest, value) => (value < earliest ? value : earliest));
}

export function getYearGroupDefinitions(): Array<Omit<YearGroup, "letters">> {
  return yearGroupsBase.map((group) => ({ ...group }));
}

export function getFailureLetterIds(limit = failureLetterLimit): string[] {
  return Array.from({ length: limit }, (_, index) => String(index + 1));
}

export function isGeneratedFailureStatus(status: GeneratedStatus): status is GeneratedFailureStatus {
  return status.state === "failure";
}

export function isGeneratedSuccessStatus(status: GeneratedStatus): status is GeneratedSuccessStatus {
  return status.state === "success";
}

export function getChronologicalDateKey(meta: LetterMeta): string | null {
  return getEarliestDateBoundary(meta.sent.date) ?? getEarliestDateBoundary(meta.received.date);
}

function getDateKey(meta: LetterMeta): string | null {
  return getChronologicalDateKey(meta);
}

export function getDerivedYear(meta: LetterMeta): number | null {
  const key = getDateKey(meta);
  if (!key) return null;
  const match = key.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function compareLetters(a: LetterMeta, b: LetterMeta): number {
  const aKey = getChronologicalDateKey(a);
  const bKey = getChronologicalDateKey(b);

  if (aKey == null && bKey == null) {
    return Number(a.letter) - Number(b.letter);
  }

  if (aKey == null) {
    return 1;
  }

  if (bKey == null) {
    return -1;
  }

  if (aKey !== bKey) {
    return aKey.localeCompare(bKey);
  }

  return Number(a.letter) - Number(b.letter);
}

function buildYearGroups(letters: LetterMeta[], includeEmpty: boolean): YearGroup[] {
  const groups = yearGroupsBase.map((group) => ({ ...group, letters: [] as LetterMeta[] }));

  for (const letter of letters) {
    const year = getDerivedYear(letter);
    if (year == null) {
      continue;
    }

    const group = groups.find((item) => year >= item.start && year <= item.end);
    if (group) {
      group.letters.push(letter);
    }
  }

  return includeEmpty ? groups : groups.filter((group) => group.letters.length > 0);
}

async function getOrderedLetterIndex(): Promise<LetterMeta[]> {
  if (!orderedLetterIndexPromise) {
    orderedLetterIndexPromise = getLetterIndex().then((letters) => [...letters].sort(compareLetters));
  }

  return await orderedLetterIndexPromise;
}

async function getMemoizedYearGroups(includeEmpty: boolean): Promise<YearGroup[]> {
  if (includeEmpty) {
    if (!yearGroupsPromise) {
      yearGroupsPromise = getOrderedLetterIndex().then((letters) => buildYearGroups(letters, true));
    }

    return await yearGroupsPromise;
  }

  if (!groupedYearIndexPromise) {
    groupedYearIndexPromise = getOrderedLetterIndex().then((letters) => buildYearGroups(letters, false));
  }

  return await groupedYearIndexPromise;
}

async function getNeighborMap(): Promise<Map<string, LetterNeighbors>> {
  if (!neighborMapPromise) {
    neighborMapPromise = getOrderedLetterIndex().then((ordered) => {
      const neighbors = new Map<string, LetterNeighbors>();

      ordered.forEach((item, index) => {
        neighbors.set(item.letter, {
          previous: ordered[index - 1] ?? null,
          next: ordered[index + 1] ?? null
        });
      });

      return neighbors;
    });
  }

  return await neighborMapPromise;
}

export function joinLabels(items: ResolvedRef[]): string {
  return items.map((item) => item.label).filter(Boolean).join(", ");
}

export async function getGeneratedStatus(): Promise<GeneratedStatus> {
  if (!generatedStatusPromise) {
    const statusPath = path.join(generatedRoot, "status.json");
    generatedStatusPromise = readJsonFile<unknown>(statusPath).then((value) => parseGeneratedStatus(value));
  }

  return await generatedStatusPromise;
}

export async function getLetterIndex(): Promise<LetterMeta[]> {
  if (!letterIndexPromise) {
    const indexPath = path.join(generatedRoot, "letters", "index.json");
    letterIndexPromise = readJsonFile<LetterMeta[]>(indexPath);
  }

  return await letterIndexPromise;
}

export async function getGroupedLetterIndex(): Promise<YearGroup[]> {
  return await getMemoizedYearGroups(false);
}

export async function getAllYearGroups(): Promise<YearGroup[]> {
  return await getMemoizedYearGroups(true);
}

export async function getYearGroup(groupId: string): Promise<YearGroup | null> {
  const groups = await getAllYearGroups();
  return groups.find((group) => group.id === groupId) ?? null;
}

export async function getYearGroupForLetter(letter: LetterMeta): Promise<YearGroup | null> {
  const year = getDerivedYear(letter);
  if (year == null) return null;
  const groups = await getAllYearGroups();
  return groups.find((group) => year >= group.start && year <= group.end) ?? null;
}

export function getYearGroupHref(groupId: string): string {
  return `/jahrgang/${groupId}/`;
}

export function getLetterHref(letter: string): string {
  return `/briefe/${letter}/`;
}

export async function getLetterBundle(letter: string): Promise<LetterBundle> {
  const letterDir = path.join(generatedRoot, "letters", letter);
  const meta = await readJsonFile<LetterMeta>(path.join(letterDir, "meta.json"));
  const pages = await Promise.all(
    meta.pages.map(async (page) => ({
      page,
      textHtml: await readTextFile(path.join(letterDir, page, "text.html")),
      sidenotes: await readOptionalJsonFile<SidenoteRecord[]>(path.join(letterDir, page, "sidenotes.json"), [])
    }))
  );

  return { meta, pages };
}

export async function getLetterNeighbors(letter: string) {
  const neighbors = await getNeighborMap();
  return neighbors.get(letter) ?? { previous: null, next: null };
}

export function getGeneratedRoot(): string {
  return generatedRoot;
}
