import { ApiError, NetworkError, createDraft, getToken } from "./api";
import { db } from "./db";

let flushing = false;

export async function flushQueue(): Promise<number> {
  if (flushing || !navigator.onLine || !getToken()) return 0;
  flushing = true;
  let synced = 0;
  try {
    const items = await db.queue.orderBy("created_at").toArray();
    for (const item of items) {
      try {
        await createDraft(item.blob, {
          language: item.language,
          visitType: item.visit_type,
          patientId: item.patient_id,
          clientUuid: item.id,
        });
        await db.queue.delete(item.id);
        synced += 1;
      } catch (error) {
        if (error instanceof NetworkError) break;
        if (error instanceof ApiError && error.status === 401) break;
        await db.queue.update(item.id, {
          attempts: item.attempts + 1,
          last_error: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
  if (synced > 0) {
    window.dispatchEvent(
      new CustomEvent("asha:synced", { detail: { count: synced } }),
    );
  }
  return synced;
}
