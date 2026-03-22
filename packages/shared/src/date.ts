/** Local calendar date YYYY-MM-DD in the user's timezone. */
export function formatLocalDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function padTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatLocalTimeIso(d: Date): string {
  return padTime(d.getHours(), d.getMinutes());
}

/** Parse YYYY-MM-DD as local midnight. */
export function parseLocalDateIso(iso: string): Date {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(y!, mo! - 1, d!);
}

export function addDaysToIsoDate(iso: string, delta: number): string {
  const d = parseLocalDateIso(iso);
  d.setDate(d.getDate() + delta);
  return formatLocalDateIso(d);
}

export function compareIsoDate(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Inclusive of both endpoints; returns [] if start > end. */
export function eachDateInInclusiveRange(startIso: string, endIso: string): string[] {
  if (compareIsoDate(startIso, endIso) > 0) return [];
  const out: string[] = [];
  let cur = startIso;
  while (compareIsoDate(cur, endIso) <= 0) {
    out.push(cur);
    cur = addDaysToIsoDate(cur, 1);
  }
  return out;
}
