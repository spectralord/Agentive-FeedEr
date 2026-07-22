/** German relative-time phrasing for reel timestamps (e.g. "vor 2 Tagen"). */
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Minute${diffMin === 1 ? "" : "n"}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `vor ${diffHours} Stunde${diffHours === 1 ? "" : "n"}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays === 1 ? "" : "en"}`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return `vor ${diffWeeks} Woche${diffWeeks === 1 ? "" : "n"}`;

  const diffMonths = Math.floor(diffDays / 30);
  return `vor ${diffMonths} Monat${diffMonths === 1 ? "" : "en"}`;
}
