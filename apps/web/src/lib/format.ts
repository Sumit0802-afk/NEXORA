export function formatRelativeTime(iso: string): string {
  // The API's timestamps are always UTC; append a zone marker if the string
  // lacks one so this isn't misread as local time (e.g. on a SQLite dev DB).
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  const diffMs = Date.now() - new Date(hasZone ? iso : `${iso}Z`).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Edited yesterday" : `Edited ${days}d ago`;
  return `Edited ${new Date(iso).toLocaleDateString()}`;
}
