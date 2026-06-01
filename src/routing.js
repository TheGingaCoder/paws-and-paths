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
  const straightLine = [start, end];
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
    if (!response.ok) return straightLine;
    const data = await response.json();
    const routedCoordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routedCoordinates) || routedCoordinates.length < 2) return straightLine;
    return routedCoordinates.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return straightLine;
  }
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
