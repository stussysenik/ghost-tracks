/**
 * Recent local creations — localStorage, no accounts in MVP (SPEC §4 out).
 */

export interface RecentCreation {
  prompt: string;
  at: number; // epoch ms
  fidelity?: number;
  distance_km?: number;
  share_id?: string;
}

const KEY = 'ghost-tracks:recent';
const MAX = 8;

export function loadRecent(): RecentCreation[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is RecentCreation =>
        typeof r === 'object' && r !== null && typeof (r as RecentCreation).prompt === 'string'
    );
  } catch {
    return [];
  }
}

export function saveRecent(entry: RecentCreation): void {
  try {
    const list = [entry, ...loadRecent().filter((r) => r.prompt !== entry.prompt)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable (private mode) — non-fatal */
  }
}
