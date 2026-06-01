export function buildRouteCheckpoints({ draftCheckpoints, cyclic = false, homeBase = null }) {
  if (!cyclic) return draftCheckpoints;
  if (!homeBase) return draftCheckpoints;
  return [
    { name: "Home start", lat: homeBase.lat, lng: homeBase.lng },
    ...draftCheckpoints.map((point, index) => ({
      ...point,
      name: `Checkpoint ${index + 1}`
    })),
    { name: "Home finish", lat: homeBase.lat, lng: homeBase.lng }
  ];
}
