// ---------------------------------------------------------------------
// Local-date ISO helpers.
//
// `date.toISOString().slice(0, 10)` (used all over this codebase) looks
// harmless but is wrong for date-only values: toISOString() first
// converts the Date to UTC. For anyone in a timezone ahead of UTC (e.g.
// IST, UTC+5:30), local midnight becomes the *previous* day once
// shifted to UTC — so picking the 13th sends/shows "...-12" instead of
// "...-13". Use toLocalISODate() instead, which reads the Date's local
// year/month/day directly and never touches UTC.
// ---------------------------------------------------------------------

export function toLocalISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parses a "YYYY-MM-DD" string as a local-midnight Date (rather than
// `new Date("YYYY-MM-DD")`, which the spec treats as UTC midnight and
// which shifts back a day once rendered in a timezone ahead of UTC).
export function parseLocalISODate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}
