/** YYYY-MM-DD in local time (the site runs at +07:00; toISOString would shift the day). */
export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Shift a YYYY-MM-DD by whole days (noon anchor so DST can never skip a day). */
export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localYmd(d);
}

export const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** "วันพฤหัสบดีที่ 24 กันยายน 2569" style long Thai date. */
export function thaiLongDate(ymd: string): string {
  try {
    return new Date(ymd + 'T12:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return ymd;
  }
}
