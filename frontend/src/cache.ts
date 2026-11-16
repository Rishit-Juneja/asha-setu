import type { DashboardSummary, Visit } from "./types";

function keyFor(workerId: number): string {
  return `asha-setu.visits.${workerId}`;
}

export function cacheVisits(workerId: number, visits: Visit[]): void {
  try {
    localStorage.setItem(keyFor(workerId), JSON.stringify(visits.slice(0, 40)));
  } catch {
    // Local storage may be full or unavailable; the app still works online.
  }
}

export function readCachedVisits(workerId: number): Visit[] {
  try {
    const raw = localStorage.getItem(keyFor(workerId));
    return raw ? (JSON.parse(raw) as Visit[]) : [];
  } catch {
    return [];
  }
}

function summaryKeyFor(workerId: number): string {
  return `asha-setu.summary.${workerId}`;
}

export function cacheSummary(workerId: number, summary: DashboardSummary): void {
  try {
    localStorage.setItem(summaryKeyFor(workerId), JSON.stringify(summary));
  } catch {
    // Offline cache is best-effort.
  }
}

export function readCachedSummary(workerId: number): DashboardSummary | null {
  try {
    const raw = localStorage.getItem(summaryKeyFor(workerId));
    return raw ? (JSON.parse(raw) as DashboardSummary) : null;
  } catch {
    return null;
  }
}
