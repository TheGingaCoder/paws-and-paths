const DEFAULT_CENTER = [-2.2426, 53.4808];

export function createMapController({ containerId, fallbackId, onMapClick, onReady }) {
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
      glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
    addMarkerLayers(map);
    setLineData(map, "savedRoutes", pending.savedRoutes);
    setLineData(map, "draftRoute", pending.draftRoute);
    setLineData(map, "completedRoute", pending.completedRoute);
    setLineData(map, "liveWalk", pending.liveWalk);
    updateMarkerSource();
    if (pendingCenter) {
      map.jumpTo({ center: [pendingCenter.lng, pendingCenter.lat], zoom: pendingCenter.zoom });
      pendingCenter = null;
    }
    onReady?.();
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
    jumpTo(position, zoom = 14) {
      if (!isLoaded) {
        pendingCenter = { ...position, zoom };
        return;
      }
      map.jumpTo({ center: [position.lng, position.lat], zoom });
    },
    fitRoute(route) {
      const bounds = boundsForPoints(route.checkpoints);
      if (bounds) map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
    },
    setUser(position) {
      pendingMarkers.user = position;
      if (isLoaded) updateMarkerSource();
    },
    setHome(position) {
      pendingMarkers.home = position;
      if (isLoaded) updateMarkerSource();
    },
    clearHome() {
      pendingMarkers.home = null;
      if (isLoaded) updateMarkerSource();
    },
    setCheckpoints(checkpoints = [], completedCheckpointIndex = -1) {
      pendingMarkers.checkpoints = checkpoints;
      pendingMarkers.completedCheckpointIndex = completedCheckpointIndex;
      if (isLoaded) updateMarkerSource();
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

  function updateMarkerSource() {
    setMarkerData(map, markerFeatures(pendingMarkers));
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

function addMarkerLayers(map) {
  map.addSource("mapMarkers", { type: "geojson", data: emptyFeatureCollection() });
  map.addLayer({
    id: "markerCircles",
    type: "circle",
    source: "mapMarkers",
    paint: {
      "circle-radius": ["case", ["==", ["get", "kind"], "user"], 11, ["==", ["get", "kind"], "home"], 14, 13],
      "circle-color": [
        "match",
        ["get", "kind"],
        "user", "#3e7d48",
        "home", "#d8973c",
        "home-stop", "#d8973c",
        "start", "#3e7d48",
        "finish", "#d8973c",
        "complete", "#2f80ed",
        "#435347"
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
      "circle-opacity": 0.96
    }
  });
  map.addLayer({
    id: "markerLabels",
    type: "symbol",
    source: "mapMarkers",
    layout: {
      "text-field": ["get", "label"],
      "text-font": ["Noto Sans Regular"],
      "text-size": ["case", ["==", ["get", "kind"], "user"], 0, 13],
      "text-anchor": "center",
      "text-allow-overlap": true,
      "text-ignore-placement": true
    },
    paint: {
      "text-color": "#ffffff"
    }
  });
}

function setMarkerData(map, features) {
  const source = map.getSource("mapMarkers");
  if (!source) return;
  source.setData({ type: "FeatureCollection", features });
}

function markerFeatures({ user, home, checkpoints, completedCheckpointIndex }) {
  const features = [];
  if (home) features.push(pointFeature(home, { kind: "home", label: "H" }));
  if (user) features.push(pointFeature(user, { kind: "user", label: "" }));
  checkpoints.forEach((point, index) => {
    const isComplete = index <= completedCheckpointIndex;
    const kind = isComplete ? "complete" : markerType(point, index, checkpoints.length);
    features.push(pointFeature(point, {
      kind,
      label: markerLabel(kind, index)
    }));
  });
  return features;
}

function markerType(point, index, total) {
  const name = point.name?.toLowerCase() ?? "";
  if (name.includes("home") || name.includes("finish")) return "home-stop";
  if (index === 0) return "start";
  if (index === total - 1) return "finish";
  return "paw";
}

function markerLabel(kind, index) {
  if (kind === "home-stop") return "H";
  if (kind === "start") return "S";
  if (kind === "finish") return "F";
  if (kind === "complete") return "✓";
  return String(index + 1);
}

function pointFeature(point, properties) {
  return {
    type: "Feature",
    properties,
    geometry: {
      type: "Point",
      coordinates: [point.lng, point.lat]
    }
  };
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
    jumpTo: () => {},
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
