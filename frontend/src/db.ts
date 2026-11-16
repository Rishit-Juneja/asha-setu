import Dexie, { type Table } from "dexie";

export interface QueuedVisit {
  id: string;
  blob: Blob;
  filename: string;
  language: string;
  visit_type: string;
  patient_id: number | null;
  created_at: string;
  attempts: number;
  last_error?: string;
}

export interface CachedAudio {
  id: string;
  blob: Blob;
  created_at: string;
}

class AshaDatabase extends Dexie {
  queue!: Table<QueuedVisit, string>;
  audio!: Table<CachedAudio, string>;

  constructor() {
    super("asha-setu");
    this.version(1).stores({
      queue: "id, created_at",
      audio: "id, created_at",
    });
  }
}

export const db = new AshaDatabase();

export async function enqueueVisit(
  item: Omit<QueuedVisit, "created_at" | "attempts">,
): Promise<void> {
  await db.queue.put({
    ...item,
    created_at: new Date().toISOString(),
    attempts: 0,
  });
}

export async function cacheAudio(key: string, blob: Blob): Promise<void> {
  await db.audio.put({
    id: key,
    blob,
    created_at: new Date().toISOString(),
  });
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  const entry = await db.audio.get(key);
  return entry?.blob ?? null;
}
