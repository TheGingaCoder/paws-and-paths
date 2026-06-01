const DEFAULT_CENTER = [-2.2426, 53.4808];

export function createMapController({ containerId, fallbackId, onMapClick }) {
  const fallback = document.getElementById(fallbackId);
  if (!window.maplibregl) {
    fallback.hidden = false;
    return createNoopMap();
  }

  const map = new maplibregl.Map({
    container: containerId,
    center: DEFAULT_CENTER,
    zoom: 12,
    attributionControl: false,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 19,
          attribution: "(c) OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    }
  });

  map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
  map.on("error", () => {
    fallback.hidden = false;
  });
  map.on("click", (event) => onMapClick?.({ lat: event.lngLat.lat, lng: event.lngLat.lng }));

  const markers = {
    user: null,
    home: null,
    checkpoints: []
  };
  const pending = {
    savedRoutes: [],
    draftRoute: [],
    completedRoute: [],
    liveWalk: []
  };
  let isLoaded = false;

  map.on("load", () => {
    isLoaded = true;
    addLineSource(map, "savedRoutes", "#6ba66f", 4);
    addLineSource(map, "draftRoute", "#d8973c", 4, [1.5, 1.5]);
    addLineSource(map, "completedRoute", "#3e7d48", 8);
    addLineSource(map, "liveWalk", "#3e7d48", 5);
    setLineData(map, "savedRoutes", pending.savedRoutes);
    setLineData(map, "draftRoute", pending.draftRoute);
    setLineData(map, "completedRoute", pending.completedRoute);
    setLineData(map, "liveWalk", pending.liveWalk);
  });

  return {
    map,
    ready: true,
    getCenter() {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng };
    },
    flyTo(position, zoom = 14) {
      map.flyTo({ center: [position.lng, position.lat], zoom, essential: true });
    },
    fitRoute(route) {
      const bounds = boundsForPoints(route.checkpoints);
      if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    },
    setUser(position) {
      markers.user = setMarker(map, markers.user, position, "marker user", "");
    },
    setHome(position) {
      markers.home = setMarker(map, markers.home, position, "marker home", "H");
    },
    clearHome() {
      markers.home?.remove();
      markers.home = null;
    },
    setCheckpoints(checkpoints = [], completedCheckpointIndex = -1) {
      markers.checkpoints.forEach((marker) => marker.remove());
      markers.checkpoints = checkpoints.map((point, index) =>
        setMarker(
          map,
          null,
          point,
          `marker checkpoint${index <= completedCheckpointIndex ? " complete" : ""}`,
          point.name?.toLowerCase().includes("home") ? "H" : String(index + 1)
        )
      );
    },
    setSavedRoutes(routes = []) {
      pending.savedRoutes = routes.flatMap((route) => routeToFeatures(route, route.id));
      if (isLoaded) setLineData(map, "savedRoutes", pending.savedRoutes);
    },
    setDraftRoute(checkpoints = [], segmentGeometries = []) {
      pending.draftRoute = segmentGeometries.length
        ? segmentGeometries.map((segment, index) => pointsToFeature(segment, { segment: index }))
        : checkpoints.length > 1 ? [pointsToFeature(checkpoints)] : [];
      if (isLoaded) setLineData(map, "draftRoute", pending.draftRoute);
      this.setCheckpoints(checkpoints);
    },
    setCompletedRoute(route, completedCheckpointIndex = -1) {
      const completedPoints = completedSegmentPoints(route, completedCheckpointIndex);
      pending.completedRoute = completedPoints.length > 1 ? [pointsToFeature(completedPoints)] : [];
      if (isLoaded) setLineData(map, "completedRoute", pending.completedRoute);
      this.setCheckpoints(route?.checkpoints ?? [], completedCheckpointIndex);
    },
    setLiveWalk(positions = []) {
      pending.liveWalk = positions.length > 1 ? [pointsToFeature(positions)] : [];
      if (isLoaded) setLineData(map, "liveWalk", pending.liveWalk);
    }
  };
}

function addLineSource(map, id, color, width, dasharray) {
  map.addSource(id, { type: "geojson", data: emptyFeatureCollection() });
  map.addLayer({
    id,
    type: "line",
    source: id,
    paint: {
      "line-color": color,
      "line-width": width,
      "line-opacity": 0.92,
      ...(dasharray ? { "line-dasharray": dasharray } : {})
    },
    layout: { "line-cap": "round", "line-join": "round" }
  });
}

function setLineData(map, sourceId, features) {
  const source = map.getSource(sourceId);
  if (!source) return;
  source.setData({ type: "FeatureCollection", features });
}

function setMarker(map, existing, position, className, label) {
  existing?.remove();
  const element = document.createElement("div");
  element.className = className;
  element.textContent = label;
  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([position.lng, position.lat])
    .addTo(map);
}

function routeToFeatures(route, id) {
  if (route.segmentGeometries?.length) {
    return route.segmentGeometries.map((segment, index) =>
      pointsToFeature(segment, { id, name: route.name, segment: index })
    );
  }
  return [pointsToFeature(route.checkpoints, { id, name: route.name })];
}

function completedSegmentPoints(route, completedCheckpointIndex) {
  if (!route || completedCheckpointIndex < 1) return [];
  const segments = route.segmentGeometries?.length
    ? route.segmentGeometries
    : route.checkpoints.slice(0, -1).map((checkpoint, index) => [checkpoint, route.checkpoints[index + 1]]);
  return segments
    .slice(0, completedCheckpointIndex)
    .flatMap((segment, index) => index === 0 ? segment : segment.slice(1));
}

function pointsToFeature(points, properties = {}) {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => [point.lng, point.lat])
    }
  };
}

function boundsForPoints(points = []) {
  if (!points.length || !window.maplibregl) return null;
  const bounds = new maplibregl.LngLatBounds();
  points.forEach((point) => bounds.extend([point.lng, point.lat]));
  return bounds;
}

function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

function createNoopMap() {
  return {
    ready: false,
    getCenter: () => ({ lat: 53.4808, lng: -2.2426 }),
    flyTo: () => {},
    fitRoute: () => {},
    setUser: () => {},
    setHome: () => {},
    clearHome: () => {},
    setCheckpoints: () => {},
    setSavedRoutes: () => {},
    setDraftRoute: () => {},
    setCompletedRoute: () => {},
    setLiveWalk: () => {}
  };
}
