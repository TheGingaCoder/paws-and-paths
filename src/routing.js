const ROUTING_ENDPOINT = "https://routing.openstreetmap.de/routed-foot/route/v1/foot";

export async function buildRoutedSegments(checkpoints, fetcher = fetch) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2) return [];
  const segments = [];
  for (let index = 0; index < checkpoints.length - 1; index += 1) {
    const segment = await fetchRoutedSegment(checkpoints[index], checkpoints[index + 1], fetcher);
    segments.push(segment);
  }
  return segments;
}

export async function fetchRoutedSegment(start, end, fetcher = fetch) {
  const fallback = curvedFallbackSegment(start, end);
  try {
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const params = new URLSearchParams({
      overview: "full",
      geometries: "geojson",
      steps: "false"
    });
    const response = await fetcher(`${ROUTING_ENDPOINT}/${coordinates}?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    const routedCoordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routedCoordinates) || routedCoordinates.length < 2) return fallback;
    return routedCoordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return fallback;
  }
}

export function curvedFallbackSegment(start, end) {
  const points = [];
  const latDelta = end.lat - start.lat;
  const lngDelta = end.lng - start.lng;
  const curve = Math.min(0.0018, Math.max(0.00025, Math.hypot(latDelta, lngDelta) * 0.12));
  const normalLat = -lngDelta;
  const normalLng = latDelta;
  const normalLength = Math.hypot(normalLat, normalLng) || 1;
  for (let step = 0; step <= 16; step += 1) {
    const t = step / 16;
    const arc = Math.sin(Math.PI * t) * curve;
    points.push({
      lat: start.lat + latDelta * t + (normalLat / normalLength) * arc,
      lng: start.lng + lngDelta * t + (normalLng / normalLength) * arc
    });
  }
  return points;
}

export function completedSegmentPoints(route, completedCheckpointIndex) {
  if (!route || completedCheckpointIndex < 1) return [];
  const segments = route.segmentGeometries?.length
    ? route.segmentGeometries
    : fallbackSegments(route.checkpoints);
  return segments
    .slice(0, completedCheckpointIndex)
    .flatMap((segment, index) => index === 0 ? segment : segment.slice(1));
}

function fallbackSegments(checkpoints = []) {
  return checkpoints.slice(0, -1).map((checkpoint, index) => [checkpoint, checkpoints[index + 1]]);
}
