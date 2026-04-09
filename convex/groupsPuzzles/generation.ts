import type { Doc } from "../_generated/dataModel";
import type { GroupsPuzzleGroup, GroupsTier } from "./logic";

export type GroupsEventCandidate = Pick<Doc<"events">, "_id" | "year" | "event" | "metadata">;

export interface GroupsBoardCard {
  id: string;
  text: string;
  year: number;
  groupId: string;
}

export interface BuiltGroupsBoard {
  groups: GroupsPuzzleGroup[];
  board: GroupsBoardCard[];
}

interface YearBucket {
  year: number;
  events: GroupsEventCandidate[];
}

interface TierScoredGroup extends GroupsPuzzleGroup {
  difficultyScore: number;
}

const REQUIRED_GROUPS = 4;
const EVENTS_PER_GROUP = 4;
const MIN_YEAR_GAP = 20;
const TIERS: GroupsTier[] = ["easy", "medium", "hard", "very hard"];

export function buildGroupsBoard(
  allEvents: GroupsEventCandidate[],
  seed: number,
): BuiltGroupsBoard {
  const yearBuckets = buildYearBuckets(allEvents);
  const selectedBuckets = selectYearBuckets(yearBuckets, seed);
  const groups = selectedBuckets.map((bucket, index) =>
    createTierScoredGroup(bucket, `group-${index + 1}`, seed + index * 97),
  );

  assignTierLabels(groups);

  const board = shuffleWithPrng(
    groups.flatMap((group) =>
      group.eventIds.map((eventId) => {
        const event = selectedBuckets
          .flatMap((bucket) => bucket.events)
          .find((candidate) => String(candidate._id) === eventId);

        if (!event) {
          throw new Error(`Missing selected event ${eventId} while building Groups board.`);
        }

        return {
          id: eventId,
          text: event.event,
          year: event.year,
          groupId: group.id,
        };
      }),
    ),
    createPrng(seed ^ 0x9e3779b9),
  );

  return {
    groups: groups.map(({ difficultyScore: _difficultyScore, ...group }) => group),
    board,
  };
}

function buildYearBuckets(allEvents: GroupsEventCandidate[]): YearBucket[] {
  const buckets = new Map<number, GroupsEventCandidate[]>();

  for (const event of allEvents) {
    const bucket = buckets.get(event.year) ?? [];
    bucket.push(event);
    buckets.set(event.year, bucket);
  }

  return Array.from(buckets.entries())
    .map(([year, events]) => ({ year, events }))
    .filter((bucket) => bucket.events.length >= EVENTS_PER_GROUP)
    .sort((left, right) => left.year - right.year);
}

function selectYearBuckets(yearBuckets: YearBucket[], seed: number): YearBucket[] {
  if (yearBuckets.length < REQUIRED_GROUPS) {
    throw new Error("Not enough years with four available events to build a Groups puzzle.");
  }

  const prng = createPrng(seed);
  const selected: YearBucket[] = [];
  const bucketSize = Math.ceil(yearBuckets.length / REQUIRED_GROUPS);

  for (let index = 0; index < REQUIRED_GROUPS; index += 1) {
    const sliceStart = index * bucketSize;
    const sliceEnd = Math.min(yearBuckets.length, sliceStart + bucketSize);
    const slice = yearBuckets.slice(sliceStart, sliceEnd);
    const candidate =
      chooseBucket(slice, selected, prng) ?? chooseBucket(yearBuckets, selected, prng);

    if (!candidate) {
      throw new Error("Unable to select four sufficiently separated years for Groups.");
    }

    selected.push(candidate);
  }

  return selected;
}

function chooseBucket(
  yearBuckets: YearBucket[],
  selected: YearBucket[],
  prng: () => number,
): YearBucket | null {
  if (yearBuckets.length === 0) {
    return null;
  }

  const shuffled = shuffleWithPrng(yearBuckets, prng);
  const preferred = shuffled.find((bucket) =>
    selected.every((picked) => Math.abs(picked.year - bucket.year) >= MIN_YEAR_GAP),
  );

  if (preferred) {
    return preferred;
  }

  return shuffled.find((bucket) => selected.every((picked) => picked.year !== bucket.year)) ?? null;
}

function createTierScoredGroup(bucket: YearBucket, id: string, seed: number): TierScoredGroup {
  const selectedEvents = selectGroupEvents(bucket.events, seed);
  if (selectedEvents.length < EVENTS_PER_GROUP) {
    throw new Error(`Year ${bucket.year} did not yield four events for Groups.`);
  }

  return {
    id,
    year: bucket.year,
    tier: "medium",
    eventIds: selectedEvents.map((event) => String(event._id)),
    difficultyScore: computeDifficultyScore(selectedEvents),
  };
}

function selectGroupEvents(events: GroupsEventCandidate[], seed: number): GroupsEventCandidate[] {
  const prng = createPrng(seed ^ events[0].year);
  const shuffled = shuffleWithPrng(events, prng);
  return shuffled.slice(0, EVENTS_PER_GROUP);
}

function computeDifficultyScore(events: GroupsEventCandidate[]): number {
  const avgDifficulty =
    events.reduce((sum, event) => sum + (event.metadata?.difficulty ?? 3), 0) / events.length;
  const avgFame =
    events.reduce((sum, event) => sum + (event.metadata?.fame_level ?? 3), 0) / events.length;

  return avgDifficulty * 0.7 + (6 - avgFame) * 0.3;
}

function assignTierLabels(groups: TierScoredGroup[]): void {
  const sorted = [...groups].sort((left, right) => left.difficultyScore - right.difficultyScore);
  sorted.forEach((group, index) => {
    group.tier = TIERS[index] ?? "very hard";
  });
}

function createPrng(seed: number): () => number {
  let state = seed >>> 0 || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithPrng<T>(items: T[], prng: () => number): T[] {
  const array = [...items];

  for (let index = array.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(prng() * (index + 1));
    [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
  }

  return array;
}
