export const DEFAULT_CHECKPOINT_RADIUS_METERS = 35;
export const DEFAULT_GPS_JUMP_LIMIT_METERS = 80;

export function haversineDistanceMeters(a, b) {
  if (!a || !b) return 0;
  const earthRadius = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function nextCheckpointDetection({
  position,
  checkpoints,
  completedCheckpointIndex = -1,
  radiusMeters = DEFAULT_CHECKPOINT_RADIUS_METERS
}) {
  const nextIndex = completedCheckpointIndex + 1;
  const next = checkpoints?.[nextIndex];
  if (!position || !next) return null;
  const distanceMeters = haversineDistanceMeters(position, next);
  if (distanceMeters > radiusMeters) return null;
  return {
    checkpointIndex: nextIndex,
    checkpointName: next.name,
    distanceMeters
  };
}

export function shouldAcceptGpsUpdate(previous, next, maxJumpMeters = DEFAULT_GPS_JUMP_LIMIT_METERS) {
  if (!previous || !next) return true;
  return haversineDistanceMeters(previous, next) <= maxJumpMeters;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}
