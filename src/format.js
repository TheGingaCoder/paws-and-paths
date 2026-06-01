export function formatDuration(seconds = 0) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

export function formatDistance(meters = 0) {
  const safe = Math.max(0, meters);
  if (safe < 1000) return `${Math.round(safe)} m`;
  return `${(safe / 1000).toFixed(2)} km`;
}

export function formatRelativeDate(isoString) {
  if (!isoString) return "No walks yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(isoString));
}
