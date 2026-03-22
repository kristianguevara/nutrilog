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
