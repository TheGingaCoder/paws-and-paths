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
  const pendingMarkers = {
    user: null,
    home: null,
    checkpoints: [],
    completedCheckpointIndex: -1
  };
  const pending = {
    savedRoutes: [],
    draftRoute: [],
    completedRoute: [],
    liveWalk: []
  };
  let isLoaded = false;
  let pendingCenter = null;

  map.on("load", () => {
    isLoaded = true;
    addLineSource(map, "savedRoutes", "#7f8f83", 4);
    addLineSource(map, "draftRoute", "#d8973c", 4, [1.5, 1.5]);
    addLineSource(map, "completedRoute", "#2f80ed", 8);
    addLineSource(map, "liveWalk", "#1d2a21", 5);
    setLineData(map, "savedRoutes", pending.savedRoutes);
    setLineData(map, "draftRoute", pending.draftRoute);
    setLineData(map, "completedRoute", pending.completedRoute);
    setLineData(map, "liveWalk", pending.liveWalk);
    if (pendingMarkers.home) applyHomeMarker(pendingMarkers.home);
    if (pendingMarkers.user) applyUserMarker(pendingMarkers.user);
    applyCheckpointMarkers(pendingMarkers.checkpoints, pendingMarkers.completedCheckpointIndex);
    if (pendingCenter) {
      map.jumpTo({ center: [pendingCenter.lng, pendingCenter.lat], zoom: pendingCenter.zoom });
      pendingCenter = null;
    }
  });

  return {
    map,
    ready: true,
    getCenter() {
      const center = map.getCenter();
      return { lat: center.lat, lng: center.lng };
    },
    flyTo(position, zoom = 14) {
      if (!isLoaded) {
        pendingCenter = { ...position, zoom };
        return;
      }
      map.flyTo({ center: [position.lng, position.lat], zoom, essential: true });
    },
    fitRoute(route) {
      const bounds = boundsForPoints(route.checkpoints);
      if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    },
    setUser(position) {
      pendingMarkers.user = position;
      if (isLoaded) applyUserMarker(position);
    },
    setHome(position) {
      pendingMarkers.home = position;
      if (isLoaded) applyHomeMarker(position);
    },
    clearHome() {
      markers.home?.remove();
      markers.home = null;
      pendingMarkers.home = null;
    },
    setCheckpoints(checkpoints = [], completedCheckpointIndex = -1) {
      pendingMarkers.checkpoints = checkpoints;
      pendingMarkers.completedCheckpointIndex = completedCheckpointIndex;
      if (isLoaded) applyCheckpointMarkers(checkpoints, completedCheckpointIndex);
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

  function applyUserMarker(position) {
    markers.user = setMarker(map, markers.user, position, "marker user", markerIcon("user"));
  }

  function applyHomeMarker(position) {
    markers.home = setMarker(map, markers.home, position, "marker home", markerIcon("home"));
  }

  function applyCheckpointMarkers(checkpoints = [], completedCheckpointIndex = -1) {
    markers.checkpoints.forEach((marker) => marker.remove());
    markers.checkpoints = checkpoints.map((point, index) => {
      const isComplete = index <= completedCheckpointIndex;
      const type = markerType(point, index, checkpoints.length, isComplete);
      return setMarker(map, null, point, `marker checkpoint ${type}${isComplete ? " complete" : ""}`, markerIcon(type));
    });
  }
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
  element.className = "map-marker";
  const visual = document.createElement("div");
  visual.className = className;
  visual.innerHTML = label;
  element.append(visual);
  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([position.lng, position.lat])
    .addTo(map);
}

function markerType(point, index, total, isComplete) {
  const name = point.name?.toLowerCase() ?? "";
  if (name.includes("home") || name.includes("finish")) return "home-stop";
  if (isComplete) return "done";
  if (index === 0) return "start";
  if (index === total - 1) return "finish";
  return "paw";
}

function markerIcon(type) {
  const icons = {
    user: '<span class="marker-dot"></span>',
    home: '<span class="marker-symbol">⌂</span>',
    "home-stop": '<span class="marker-symbol">⌂</span>',
    start: '<span class="marker-symbol">⚑</span>',
    finish: '<span class="marker-symbol">◆</span>',
    done: '<span class="marker-symbol">✓</span>',
    paw: '<span class="marker-symbol">•</span>'
  };
  return icons[type] ?? icons.paw;
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
