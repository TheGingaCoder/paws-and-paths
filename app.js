const ROUTE_STORAGE_KEY = "paws-paths:routes";
const ROUTE_RESET_KEY = "paws-paths:routes-cleared-v3";
const DOG_STORAGE_KEY = "paws-paths:prototype-dogs";
const HOME_STORAGE_KEY = "paws-paths:home-base";
const DEFAULT_CENTER = [51.505, -0.09];
const MAP_ZOOM = 15;
const ROUTE_COLOURS = ["#347a42", "#2f80ed", "#d99841", "#9b51e0", "#d85c52"];

const DOG_BREEDS = [
  "Mixed Breed",
  "Cocker Spaniel",
  "Labrador",
  "Golden Retriever",
  "Border Collie",
  "German Shepherd",
  "French Bulldog",
  "Dachshund",
  "Beagle",
  "Poodle",
  "Cockapoo",
  "Cavapoo",
  "Springer Spaniel",
  "Staffordshire Bull Terrier",
  "Jack Russell Terrier",
  "Shih Tzu",
  "Chihuahua",
  "Husky",
  "Boxer",
  "Whippet",
  "Greyhound",
  "Border Terrier",
  "Schnauzer",
  "Rottweiler",
  "Other"
];

let routes = loadRoutes();
let dogs = loadDogs();
let activeRouteId = routes[0]?.id ?? null;
let map = null;
let routeLayer = null;
let checkpointLayer = null;
let userLayer = null;
let searchLayer = null;
let homeMarker = null;
let searchMatches = [];
let creatorMap = null;
let creatorLayer = null;
let creatorRouteLayer = null;
let creatorHomeMarker = null;
let routeCreator = null;

const screens = {
  map: document.getElementById("mapScreen"),
  routes: document.getElementById("routesScreen"),
  dogs: document.getElementById("dogsScreen"),
  account: document.getElementById("accountScreen")
};

const modalLayer = document.getElementById("modalLayer");
const toast = document.getElementById("toast");
const activeRouteName = document.getElementById("activeRouteName");
const activeRouteMeta = document.getElementById("activeRouteMeta");
const mapSearchInput = document.getElementById("mapSearchInput");
const searchResults = document.getElementById("searchResults");

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const type = action.dataset.action;
  if (type === "create-route") openRouteCreator();
  else if (type === "cancel-route-creator") closeRouteCreator();
  else if (type === "set-checkpoint-mode") setCheckpointMode(action.dataset.mode);
  else if (type === "toggle-home-loop") toggleHomeLoop();
  else if (type === "undo-creator-checkpoint") undoCreatorCheckpoint();
  else if (type === "next-route-settings") showRouteSettingsStep();
  else if (type === "back-route-map") showRouteMapStep();
  else if (type === "set-route-difficulty") setRouteDifficulty(Number(action.dataset.value));
  else if (type === "set-route-colour") setRouteColour(action.dataset.colour);
  else if (type === "save-created-route") saveCreatedRoute();
  else if (type === "view-route") selectRoute(action.dataset.id);
  else if (type === "delete-route") showDeleteRouteModal(action.dataset.id);
  else if (type === "confirm-delete-route") deleteRoute(action.dataset.id);
  else if (type === "start-active-route") startActiveRoute();
  else if (type === "start-route-with-dog") confirmStartRoute(action.dataset.id);
  else if (type === "search-location") searchLocation();
  else if (type === "select-search-result") selectSearchResult(Number(action.dataset.index));
  else if (type === "close-search-results") hideSearchResults();
  else if (type === "locate-user") locateUser();
  else if (type === "set-home") setHomeBase();
  else if (type === "focus-route") focusActiveRoute();
  else if (type === "add-dog") showDogModal();
  else if (type === "edit-dog") showDogModal(action.dataset.id);
  else if (type === "delete-dog") showDeleteDogModal(action.dataset.id);
  else if (type === "confirm-delete-dog") deleteDog(action.dataset.id);
  else if (type === "select-dog") selectDog(action.dataset.id);
  else if (type === "reset-data") resetData(action.dataset.scope);
  else if (type === "confirm") showConfirmModal(action.dataset.title ?? "Design mockup");
  else if (type === "close-modal") closeModal();
  else showToast();
});

document.addEventListener("submit", async (event) => {
  const dogForm = event.target.closest("#dogForm");
  if (!dogForm) return;
  event.preventDefault();
  await saveDogFromForm(dogForm);
});

document.addEventListener("change", async (event) => {
  if (event.target.id !== "dogPhoto") return;
  const photoData = document.getElementById("dogPhotoData");
  const file = event.target.files?.[0];
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  photoData.value = dataUrl;
  setPhotoEditorImage(dataUrl, { x: 0, y: 0, scale: 1 });
});

document.addEventListener("input", (event) => {
  if (event.target.id === "photoScale") {
    document.getElementById("dogPhotoScale").value = event.target.value;
    updatePhotoEditorImage();
  }
  if (routeCreator && event.target.id === "routeName") routeCreator.settings.name = event.target.value;
  if (routeCreator && event.target.id === "routeDescription") routeCreator.settings.description = event.target.value;
});

mapSearchInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  searchLocation();
});

cleanUrlAfterOldSearchSubmit();
initMap();
renderRoutes();
renderDogs();
renderAccount();
renderMapRoutes();
updateWalkCard();
hydrateRouteGeometry();

function cleanUrlAfterOldSearchSubmit() {
  if (!window.location.href.endsWith("?")) return;
  window.history.replaceState({}, "", window.location.href.slice(0, -1));
}

function initMap() {
  if (!window.L) {
    showToast("Live map could not load.");
    return;
  }
  const homeBase = loadHomeBase();
  const startCenter = homeBase ? [homeBase.lat, homeBase.lng] : DEFAULT_CENTER;
  map = L.map("realMap", {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true
  }).setView(startCenter, MAP_ZOOM);

  addMapTiles(map);
  routeLayer = L.layerGroup().addTo(map);
  checkpointLayer = L.layerGroup().addTo(map);
  userLayer = L.layerGroup().addTo(map);
  searchLayer = L.layerGroup().addTo(map);
  renderHomeBase();
}

function addMapTiles(targetMap) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    crossOrigin: true
  }).addTo(targetMap);
}

function switchTab(name) {
  Object.entries(screens).forEach(([key, screen]) => {
    screen.classList.toggle("active", key === name);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  if (name === "map" && map) requestAnimationFrame(() => map.invalidateSize());
  if (name === "routes" && creatorMap) requestAnimationFrame(() => creatorMap.invalidateSize());
}

function renderRoutes() {
  if (routeCreator) {
    renderRouteCreator();
    return;
  }
  const routeMarkup = routes.length
    ? routes.map(routeCard).join("")
    : `
      <article class="empty-state card">
        <div class="empty-icon"><i class="fa-solid fa-route"></i></div>
        <h3>No routes yet</h3>
        <p>Create your first route from this Routes page.</p>
        <button class="primary-action" data-action="create-route"><i class="fa-solid fa-plus"></i>Create Route</button>
      </article>
    `;
  screens.routes.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Paws & Paths</p>
        <h2>Routes</h2>
        <p>Create, tune, and start saved walking routes.</p>
      </header>
      <button class="wide-action" data-action="create-route">
        <i class="fa-solid fa-plus"></i>
        Create New Route
      </button>
      <div class="card-list">
        ${routeMarkup}
      </div>
    </div>
  `;
}

function routeCard(route) {
  const activeClass = route.id === activeRouteId ? "selected" : "";
  return `
    <article class="route-card card ${activeClass}" style="--route-colour: ${route.colour}">
      <button class="mini-map-button" data-action="view-route" data-id="${route.id}" aria-label="Open ${escapeHtml(route.name)} on map">
        <span class="mini-map">
          <svg viewBox="0 0 160 90" preserveAspectRatio="none">
            <path d="${miniRoutePath(route)}" />
          </svg>
          <i class="fa-solid fa-route"></i>
        </span>
      </button>
      <div class="card-main">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(route.name)}</h3>
            <p>${escapeHtml(route.description || "No description yet")}</p>
          </div>
          <div class="icon-pair">
            <button data-action="view-route" data-id="${route.id}" aria-label="Open route"><i class="fa-solid fa-map-location-dot"></i></button>
            <button data-action="delete-route" data-id="${route.id}" aria-label="Delete route"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="metric-row">
          <span><i class="fa-solid fa-person-walking"></i>${formatDistance(route.distanceKm)}</span>
          <span><i class="fa-solid fa-location-dot"></i>${route.checkpoints.length} stops</span>
          <span><i class="fa-solid fa-bolt"></i>${route.difficulty}/5</span>
        </div>
      </div>
    </article>
  `;
}

function miniRoutePath(route) {
  const pathOptions = [
    "M12 66 C38 28, 66 76, 91 38 S132 20, 148 50",
    "M12 50 C36 68, 53 18, 82 34 S116 76, 150 28",
    "M10 66 C42 58, 45 24, 74 30 S99 56, 146 36"
  ];
  return pathOptions[Math.abs(hashString(route.id)) % pathOptions.length];
}

function openRouteCreator() {
  const homeBase = loadHomeBase();
  routeCreator = {
    step: "map",
    mode: "single",
    homeLoop: false,
    complete: false,
    points: [],
    geometry: [],
    distanceKm: 0,
    settings: {
      name: "New Walking Route",
      description: "",
      difficulty: 2,
      colour: ROUTE_COLOURS[0]
    },
    homeBase
  };
  switchTab("routes");
  renderRoutes();
  requestAnimationFrame(initCreatorMap);
}

function renderRouteCreator() {
  screens.routes.innerHTML = `
    <div class="route-creator">
      <header class="creator-top glass">
        <button class="round-control compact-control" data-action="${routeCreator.step === "settings" ? "back-route-map" : "cancel-route-creator"}" aria-label="Back">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div>
          <p class="eyebrow">${routeCreator.step === "settings" ? "Route Settings" : "Route Creator"}</p>
          <h2>${routeCreator.step === "settings" ? "Finish details" : "Place checkpoints"}</h2>
        </div>
      </header>
      ${routeCreator.step === "settings" ? routeSettingsMarkup() : routeMapCreatorMarkup()}
    </div>
  `;
}

function routeMapCreatorMarkup() {
  return `
    <div class="creator-map" id="routeCreateMap"></div>
    <section class="creator-panel glass">
      <div class="creator-segment">
        <button class="${routeCreator.mode === "single" ? "active" : ""}" data-action="set-checkpoint-mode" data-mode="single">
          <i class="fa-solid fa-location-dot"></i>
          Single
        </button>
        <button class="${routeCreator.mode === "multi" ? "active" : ""}" data-action="set-checkpoint-mode" data-mode="multi">
          <i class="fa-solid fa-repeat"></i>
          Multi
        </button>
      </div>
      <button class="toggle-row ${routeCreator.homeLoop ? "active" : ""}" data-action="toggle-home-loop">
        <span><i class="fa-solid fa-house"></i>Home starts route</span>
        <i class="fa-solid ${routeCreator.homeLoop ? "fa-toggle-on" : "fa-toggle-off"}"></i>
      </button>
      <div class="creator-status">
        <strong>${routeCreator.points.length} checkpoints</strong>
        <span>${creatorHint()}</span>
      </div>
      <div class="builder-actions">
        <button class="secondary-action" data-action="undo-creator-checkpoint"><i class="fa-solid fa-rotate-left"></i>Undo</button>
        <button class="primary-action" data-action="next-route-settings" ${canAdvanceCreator() ? "" : "disabled"}><i class="fa-solid fa-sliders"></i>${canAdvanceCreator() ? "Next" : "Add Stops"}</button>
      </div>
    </section>
  `;
}

function routeSettingsMarkup() {
  return `
    <div class="screen-scroll route-settings-scroll">
      <section class="card route-settings-card">
        <label>Route name<input id="routeName" value="${escapeHtml(routeCreator.settings.name)}" /></label>
        <label>Short description<textarea id="routeDescription" rows="3" placeholder="Quiet park loop, best at sunset">${escapeHtml(routeCreator.settings.description)}</textarea></label>
        <div class="setting-block">
          <span>Energy / difficulty</span>
          <div class="difficulty-picker">
            ${[1, 2, 3, 4, 5].map((value) => `
              <button class="${routeCreator.settings.difficulty >= value ? "active" : ""}" data-action="set-route-difficulty" data-value="${value}" aria-label="Difficulty ${value}">
                <i class="fa-solid fa-bolt"></i>
              </button>
            `).join("")}
          </div>
        </div>
        <div class="setting-block">
          <span>Route colour</span>
          <div class="colour-picker">
            ${ROUTE_COLOURS.map((colour) => `
              <button class="${routeCreator.settings.colour === colour ? "active" : ""}" data-action="set-route-colour" data-colour="${colour}" style="--swatch: ${colour}" aria-label="Route colour"></button>
            `).join("")}
          </div>
        </div>
        <div class="readonly-stats">
          <span><i class="fa-solid fa-location-dot"></i>${routeCreator.points.length} checkpoints</span>
          <span><i class="fa-solid fa-route"></i>${formatDistance(routeCreator.distanceKm || estimateDistance(routeCreator.points))}</span>
          <span><i class="fa-solid fa-road"></i>Footpaths shown on the map where OpenStreetMap has them</span>
        </div>
        <button class="wide-action" data-action="save-created-route"><i class="fa-solid fa-check"></i>Save Route</button>
      </section>
    </div>
  `;
}

function initCreatorMap() {
  const container = document.getElementById("routeCreateMap");
  if (!container || !window.L) return;
  if (creatorMap) {
    creatorMap.remove();
    creatorMap = null;
  }
  const center = routeCreator.homeBase ? [routeCreator.homeBase.lat, routeCreator.homeBase.lng] : map?.getCenter() ?? DEFAULT_CENTER;
  creatorMap = L.map(container, {
    zoomControl: false,
    attributionControl: false,
    preferCanvas: true
  }).setView(Array.isArray(center) ? center : [center.lat, center.lng], MAP_ZOOM);
  addMapTiles(creatorMap);
  creatorRouteLayer = L.layerGroup().addTo(creatorMap);
  creatorLayer = L.layerGroup().addTo(creatorMap);
  creatorMap.on("click", (event) => addCreatorCheckpoint(event.latlng));
  renderCreatorHomeMarker();
  renderCreatorCheckpoints();
}

function renderCreatorHomeMarker() {
  if (!creatorMap || !routeCreator.homeBase) return;
  if (creatorHomeMarker) {
    creatorMap.removeLayer(creatorHomeMarker);
    creatorHomeMarker = null;
  }
  creatorHomeMarker = L.marker([routeCreator.homeBase.lat, routeCreator.homeBase.lng], {
    icon: pinIcon("fa-house", "Home", "home")
  }).addTo(creatorMap);
  creatorHomeMarker.on("click", (event) => {
    L.DomEvent.stopPropagation(event.originalEvent);
    handleCreatorHomeClick();
  });
}

function handleCreatorHomeClick() {
  if (!routeCreator.homeLoop || !routeCreator.homeBase) return;
  const hasHomeStart = routeCreator.points[0]?.kind === "home";
  if (!hasHomeStart) {
    routeCreator.points.unshift(homeCheckpoint("Home Start"));
    renderRouteCreator();
    requestAnimationFrame(initCreatorMap);
    return;
  }
  if (routeCreator.points.length < 2) {
    showToast("Add at least one checkpoint before closing the loop");
    return;
  }
  routeCreator.points.push(homeCheckpoint("Home Finish"));
  routeCreator.complete = true;
  refreshCreatorRoute();
}

function addCreatorCheckpoint(latlng) {
  if (routeCreator.complete) {
    showToast("Route loop is closed");
    return;
  }
  routeCreator.points.push({
    id: createId("checkpoint"),
    lat: Number(latlng.lat.toFixed(6)),
    lng: Number(latlng.lng.toFixed(6)),
    label: checkpointName(routeCreator.points.length),
    type: routeCreator.mode
  });
  refreshCreatorRoute();
}

function addLinkedCheckpoint(point) {
  if (routeCreator.complete) return;
  routeCreator.points.push({
    id: createId("checkpoint"),
    lat: point.lat,
    lng: point.lng,
    label: `${point.label} revisit`,
    type: "multi",
    linkedTo: point.linkedTo || point.id
  });
  refreshCreatorRoute();
  showToast("Linked to multi-pass checkpoint");
}

function undoCreatorCheckpoint() {
  if (!routeCreator?.points.length) return;
  routeCreator.points.pop();
  routeCreator.complete = false;
  refreshCreatorRoute();
}

function setCheckpointMode(mode) {
  if (!routeCreator) return;
  routeCreator.mode = mode === "multi" ? "multi" : "single";
  updateCreatorControls();
}

function toggleHomeLoop() {
  if (!routeCreator) return;
  if (!routeCreator.homeBase) {
    showToast("Set a home base on the map first");
    return;
  }
  routeCreator.homeLoop = !routeCreator.homeLoop;
  routeCreator.complete = false;
  routeCreator.points = routeCreator.points.filter((point) => point.kind !== "home");
  if (routeCreator.homeLoop) routeCreator.points.unshift(homeCheckpoint("Home Start"));
  renderCreatorHomeMarker();
  refreshCreatorRoute();
  updateCreatorControls();
}

function homeCheckpoint(label) {
  return {
    id: createId("checkpoint"),
    lat: routeCreator.homeBase.lat,
    lng: routeCreator.homeBase.lng,
    label,
    type: "home",
    kind: "home"
  };
}

async function refreshCreatorRoute() {
  renderCreatorCheckpoints();
  if (routeCreator.points.length >= 2) {
    const routed = await fetchRoadRoute(routeCreator.points);
    routeCreator.geometry = routed.geometry;
    routeCreator.distanceKm = routed.distanceKm;
  } else {
    routeCreator.geometry = [];
    routeCreator.distanceKm = 0;
  }
  renderCreatorLine();
  updateCreatorPanelText();
}

function renderCreatorCheckpoints() {
  if (!creatorLayer) return;
  creatorLayer.clearLayers();
  routeCreator.points.forEach((point, index) => {
    const icon = point.kind === "home" ? "fa-house" : point.type === "multi" ? "fa-repeat" : checkpointIcon(index, routeCreator.points.length);
    const variant = point.kind === "home" ? "home" : point.type === "multi" ? "multi" : "builder";
    const marker = L.marker([point.lat, point.lng], {
      draggable: point.kind !== "home",
      icon: pinIcon(icon, point.label, variant)
    }).addTo(creatorLayer);
    marker.on("dragend", async (event) => {
      const nextPosition = event.target.getLatLng();
      point.lat = Number(nextPosition.lat.toFixed(6));
      point.lng = Number(nextPosition.lng.toFixed(6));
      routeCreator.geometry = [];
      routeCreator.distanceKm = 0;
      await refreshCreatorRoute();
      showToast(`${point.label} moved`);
    });
    if (point.type === "multi" && point.kind !== "home") {
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event.originalEvent);
        addLinkedCheckpoint(point);
      });
    }
  });
  renderCreatorLine();
}

function renderCreatorLine() {
  if (!creatorRouteLayer) return;
  creatorRouteLayer.clearLayers();
  const points = routeCreator.geometry.length ? routeCreator.geometry : routeCreator.points;
  if (points.length < 2) return;
  L.polyline(points.map((point) => [point.lat, point.lng]), {
    color: routeCreator.settings.colour,
    weight: 8,
    opacity: 0.82,
    lineCap: "round",
    lineJoin: "round"
  }).addTo(creatorRouteLayer);
}

function updateCreatorPanelText() {
  const status = document.querySelector(".creator-status");
  const nextButton = document.querySelector('[data-action="next-route-settings"]');
  if (status) {
    status.innerHTML = `<strong>${routeCreator.points.length} checkpoints</strong><span>${creatorHint()}</span>`;
  }
  if (nextButton) {
    const canAdvance = canAdvanceCreator();
    nextButton.disabled = !canAdvance;
    nextButton.innerHTML = `<i class="fa-solid fa-sliders"></i>${canAdvance ? "Next" : "Add Stops"}`;
  }
}

function updateCreatorControls() {
  document.querySelectorAll('[data-action="set-checkpoint-mode"]').forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === routeCreator.mode);
  });
  const toggle = document.querySelector('[data-action="toggle-home-loop"]');
  if (toggle) {
    toggle.classList.toggle("active", routeCreator.homeLoop);
    const icon = toggle.querySelector(".fa-toggle-on, .fa-toggle-off");
    if (icon) {
      icon.classList.toggle("fa-toggle-on", routeCreator.homeLoop);
      icon.classList.toggle("fa-toggle-off", !routeCreator.homeLoop);
    }
  }
  updateCreatorPanelText();
}

function creatorHint() {
  if (routeCreator.points.length < 2) return "Add at least two checkpoints to continue.";
  if (routeCreator.homeLoop && !routeCreator.complete) return "Click Home again to close the loop after adding stops.";
  if (routeCreator.mode === "multi") return "Tap the map to add multi-pass checkpoints; tap a multi marker to link back to it.";
  return "Tap the map to add single-pass checkpoints.";
}

function canAdvanceCreator() {
  if (!routeCreator || routeCreator.points.length < 2) return false;
  return !routeCreator.homeLoop || routeCreator.complete;
}

function showRouteSettingsStep() {
  if (!routeCreator) return;
  if (!canAdvanceCreator()) {
    showToast(routeCreator.homeLoop ? "Click Home to close the loop first" : "Add at least two checkpoints first");
    return;
  }
  routeCreator.step = "settings";
  renderRoutes();
}

function showRouteMapStep() {
  if (!routeCreator) return;
  routeCreator.step = "map";
  renderRoutes();
  requestAnimationFrame(initCreatorMap);
}

function setRouteDifficulty(value) {
  if (!routeCreator || !Number.isFinite(value)) return;
  syncRouteSettingsInputs();
  routeCreator.settings.difficulty = clamp(value, 1, 5);
  renderRoutes();
}

function setRouteColour(colour) {
  if (!routeCreator || !ROUTE_COLOURS.includes(colour)) return;
  syncRouteSettingsInputs();
  routeCreator.settings.colour = colour;
  renderRoutes();
}

async function saveCreatedRoute() {
  if (!routeCreator || routeCreator.points.length < 2) return;
  syncRouteSettingsInputs();
  const name = routeCreator.settings.name.trim() || "New Walking Route";
  const description = routeCreator.settings.description.trim();
  const routed = routeCreator.geometry.length ? {
    geometry: routeCreator.geometry,
    distanceKm: routeCreator.distanceKm
  } : await fetchRoadRoute(routeCreator.points);
  const route = {
    id: createId("route"),
    name,
    description,
    difficulty: routeCreator.settings.difficulty,
    colour: routeCreator.settings.colour,
    checkpoints: routeCreator.points,
    geometry: routed.geometry,
    distanceKm: routed.distanceKm || estimateDistance(routeCreator.points),
    lastWalked: "Not walked yet",
    longest: "New",
    tone: "green"
  };
  routes = [route, ...routes];
  activeRouteId = route.id;
  saveRoutes();
  closeRouteCreator(false);
  renderRoutes();
  renderMapRoutes();
  switchTab("map");
  focusActiveRoute();
  updateWalkCard();
  showToast("Route saved");
}

function syncRouteSettingsInputs() {
  if (!routeCreator) return;
  const nameInput = document.getElementById("routeName");
  const descriptionInput = document.getElementById("routeDescription");
  if (nameInput) routeCreator.settings.name = nameInput.value;
  if (descriptionInput) routeCreator.settings.description = descriptionInput.value;
}

function closeRouteCreator(showMessage = true) {
  if (creatorMap) {
    creatorMap.remove();
    creatorMap = null;
  }
  routeCreator = null;
  creatorLayer = null;
  creatorRouteLayer = null;
  creatorHomeMarker = null;
  renderRoutes();
  if (showMessage) showToast("Route creator closed");
}

function selectRoute(id) {
  if (!routes.some((route) => route.id === id)) return;
  activeRouteId = id;
  switchTab("map");
  renderRoutes();
  renderMapRoutes();
  focusActiveRoute();
  updateWalkCard();
  showToast("Route opened on map");
}

function renderMapRoutes() {
  if (!map || !routeLayer || !checkpointLayer) return;
  routeLayer.clearLayers();
  checkpointLayer.clearLayers();
  const route = getActiveRoute();
  if (!route) return;
  const points = getRouteLinePoints(route);
  if (points.length >= 2) {
    L.polyline(points, {
      color: route.colour,
      weight: 9,
      opacity: 0.82,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(routeLayer);
  }
  route.checkpoints.forEach((checkpoint, index) => {
    const isStart = index === 0;
    const icon = checkpoint.kind === "home" ? "fa-house" : checkpoint.type === "multi" ? "fa-repeat" : checkpointIcon(index, route.checkpoints.length);
    const label = isStart ? route.name : checkpoint.label;
    const variant = isStart ? "route-start" : checkpoint.type === "multi" ? "multi" : checkpoint.kind === "home" ? "home" : "";
    L.marker([checkpoint.lat, checkpoint.lng], {
      icon: pinIcon(icon, label, variant, route.colour)
    }).addTo(checkpointLayer);
  });
}

async function hydrateRouteGeometry() {
  const pendingRoutes = routes.filter((route) => route.checkpoints.length >= 2 && !route.geometry.length);
  if (!pendingRoutes.length) return;
  for (const route of pendingRoutes) {
    const routed = await fetchRoadRoute(route.checkpoints);
    route.geometry = routed.geometry;
    route.distanceKm = route.distanceKm || routed.distanceKm;
    saveRoutes();
    renderRoutes();
    renderMapRoutes();
    updateWalkCard();
  }
}

function getRouteLinePoints(route) {
  const geometry = Array.isArray(route.geometry) ? route.geometry : [];
  if (geometry.length) return geometry.map((point) => [point.lat, point.lng]);
  return route.checkpoints.map((point) => [point.lat, point.lng]);
}

function focusActiveRoute() {
  if (!map) return;
  const route = getActiveRoute();
  const points = route ? getRouteLinePoints(route) : [];
  if (points.length >= 2) {
    map.flyToBounds(L.latLngBounds(points), { padding: [58, 58], maxZoom: 16, duration: 0.85 });
    return;
  }
  const homeBase = loadHomeBase();
  if (homeBase) map.flyTo([homeBase.lat, homeBase.lng], MAP_ZOOM, { duration: 0.85 });
}

function updateWalkCard() {
  const route = getActiveRoute();
  if (!route) {
    activeRouteName.textContent = "Choose a route";
    activeRouteMeta.textContent = "Create routes from the Routes tab";
    return;
  }
  activeRouteName.textContent = route.name;
  activeRouteMeta.textContent = `${formatDistance(route.distanceKm)} - ${route.checkpoints.length} checkpoints - difficulty ${route.difficulty}/5`;
}

function startActiveRoute() {
  const route = getActiveRoute();
  if (!route) {
    showToast("Create a route first");
    switchTab("routes");
    return;
  }
  if (!dogs.length) {
    showModal(`
      <section class="sheet compact-sheet">
        <div class="warning-icon"><i class="fa-solid fa-dog"></i></div>
        <h2>Add a dog first</h2>
        <p>You need at least one dog profile before starting a route.</p>
        <button class="primary-action" data-action="add-dog"><i class="fa-solid fa-plus"></i>Create Dog Profile</button>
      </section>
    `);
    return;
  }
  const selectedDog = dogs.find((dog) => dog.selected);
  showModal(`
    <section class="sheet compact-sheet">
      <h2>Choose dog</h2>
      <p>Pick who is walking ${escapeHtml(route.name)}.</p>
      <div class="dog-choice-list">
        ${dogs.map((dog) => `
          <button class="settings-row ${dog.id === selectedDog?.id ? "is-selected" : ""}" data-action="start-route-with-dog" data-id="${dog.id}">
            <span><i class="fa-solid fa-dog"></i>${escapeHtml(dog.name)}</span>
            <i class="fa-solid ${dog.id === selectedDog?.id ? "fa-circle-check" : "fa-chevron-right"}"></i>
          </button>
        `).join("")}
      </div>
    </section>
  `);
}

function confirmStartRoute(dogId) {
  const route = getActiveRoute();
  const dog = dogs.find((item) => item.id === dogId);
  if (!route || !dog) return;
  dogs = dogs.map((item) => ({ ...item, selected: item.id === dogId }));
  saveDogs();
  updateWalkCard();
  closeModal();
  showToast(`${dog.name} is ready for ${route.name}`);
}

async function fetchRoadRoute(points) {
  const fallback = {
    geometry: curvedFallback(points),
    distanceKm: estimateDistance(points)
  };
  const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const routeEndpoints = [
    `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-foot/route/v1/walking/${coords}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`,
    `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  ];
  for (const url of routeEndpoints) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const route = data.routes?.[0];
      const rawCoordinates = route?.geometry?.coordinates;
      if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) continue;
      return {
        geometry: rawCoordinates.map(([lng, lat]) => ({ lat, lng })),
        distanceKm: Number(((route.distance ?? 0) / 1000).toFixed(2))
      };
    } catch {
      continue;
    }
  }
  return fallback;
}

async function searchLocation() {
  const query = mapSearchInput.value.trim();
  if (!query) {
    hideSearchResults();
    showToast("Type a place to search");
    return;
  }
  if (!map) {
    showToast("The map is still loading");
    return;
  }
  mapSearchInput.blur();
  showToast("Searching places...");
  try {
    const params = new URLSearchParams({ q: query, limit: "5" });
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) throw new Error("Search failed");
    const results = await response.json();
    searchMatches = Array.isArray(results.features) ? results.features : [];
    renderSearchResults();
  } catch {
    searchMatches = [];
    hideSearchResults();
    showToast("Search is unavailable right now");
  }
}

function renderSearchResults() {
  if (!searchMatches.length) {
    searchResults.innerHTML = `
      <button class="search-result" type="button" data-action="close-search-results">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span><strong>No results</strong><span>Try a park, street, postcode, or town name.</span></span>
      </button>
    `;
    searchResults.hidden = false;
    return;
  }
  searchResults.innerHTML = searchMatches.map((result, index) => `
    <button class="search-result" type="button" data-action="select-search-result" data-index="${index}">
      <i class="fa-solid fa-location-dot"></i>
      <span>
        <strong>${escapeHtml(searchResultTitle(result))}</strong>
        <span>${escapeHtml(searchResultSubtitle(result))}</span>
      </span>
    </button>
  `).join("");
  searchResults.hidden = false;
}

function selectSearchResult(index) {
  const result = searchMatches[index];
  const lng = Number(result?.geometry?.coordinates?.[0]);
  const lat = Number(result?.geometry?.coordinates?.[1]);
  if (!map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
  searchLayer.clearLayers();
  L.marker([lat, lng], {
    icon: pinIcon("fa-location-dot", searchResultTitle(result), "search")
  }).addTo(searchLayer);
  map.flyTo([lat, lng], 16, {
    animate: true,
    duration: 1.1,
    easeLinearity: 0.25
  });
  mapSearchInput.value = searchResultTitle(result);
  hideSearchResults();
  switchTab("map");
  showToast("Location found");
}

function hideSearchResults() {
  searchResults.hidden = true;
  searchResults.innerHTML = "";
}

function searchResultTitle(result) {
  const properties = result?.properties ?? {};
  return properties.name ||
    properties.street ||
    properties.district ||
    properties.city ||
    properties.county ||
    properties.state ||
    properties.country ||
    "Location";
}

function searchResultSubtitle(result) {
  const properties = result?.properties ?? {};
  return [
    properties.street,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
    properties.country
  ].filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).join(", ") || "Location result";
}

function locateUser() {
  if (!navigator.geolocation || !map) {
    showToast("Location is not available here");
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    const point = [position.coords.latitude, position.coords.longitude];
    userLayer.clearLayers();
    L.marker(point, {
      icon: pinIcon("fa-location-crosshairs", "You", "user")
    }).addTo(userLayer);
    map.flyTo(point, 16, {
      animate: true,
      duration: 0.95,
      easeLinearity: 0.25
    });
    showToast("Location found");
  }, () => {
    showToast("Location permission was not granted");
  }, {
    enableHighAccuracy: true,
    timeout: 9000
  });
}

function setHomeBase() {
  if (!map) return;
  const center = map.getCenter();
  const homeBase = {
    lat: Number(center.lat.toFixed(6)),
    lng: Number(center.lng.toFixed(6))
  };
  localStorage.setItem(HOME_STORAGE_KEY, JSON.stringify(homeBase));
  renderHomeBase();
  showToast("Home base set to map centre");
}

function renderHomeBase() {
  if (!map) return;
  const homeBase = loadHomeBase();
  if (homeMarker) {
    map.removeLayer(homeMarker);
    homeMarker = null;
  }
  if (!homeBase) return;
  homeMarker = L.marker([homeBase.lat, homeBase.lng], {
    icon: pinIcon("fa-house", "Home", "home")
  }).addTo(map);
}

function loadHomeBase() {
  try {
    const raw = localStorage.getItem(HOME_STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : null;
    if (typeof value?.lat === "number" && typeof value?.lng === "number") return value;
  } catch {
    return null;
  }
  return null;
}

function pinIcon(icon, label, variant = "", colour = "") {
  const style = colour ? ` style="--pin-colour: ${colour}"` : "";
  return L.divIcon({
    className: "",
    html: `<span class="map-pin ${variant}"${style}><strong>${escapeHtml(label)}</strong><i class="fa-solid ${icon}"></i></span>`,
    iconSize: [1, 1],
    iconAnchor: [0, 0]
  });
}

function checkpointIcon(index, total) {
  if (index === 0) return "fa-flag";
  if (index === total - 1) return "fa-location-dot";
  return ["fa-location-dot", "fa-tree", "fa-shoe-prints", "fa-bolt"][index % 4];
}

function checkpointName(index) {
  if (index === 0) return "Start";
  return `Stop ${index + 1}`;
}

function showDeleteRouteModal(id) {
  const route = routes.find((item) => item.id === id);
  if (!route) return;
  showModal(`
    <section class="sheet compact-sheet">
      <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h2>Delete ${escapeHtml(route.name)}?</h2>
      <p>This removes the saved route from local storage.</p>
      <div class="sheet-actions">
        <button class="ghost-action" data-action="close-modal">Cancel</button>
        <button class="primary-action danger-action" data-action="confirm-delete-route" data-id="${route.id}">Delete Route</button>
      </div>
    </section>
  `);
}

function deleteRoute(id) {
  routes = routes.filter((route) => route.id !== id);
  if (activeRouteId === id) activeRouteId = routes[0]?.id ?? null;
  saveRoutes();
  closeModal();
  renderRoutes();
  renderMapRoutes();
  updateWalkCard();
  showToast("Route deleted");
}

function getActiveRoute() {
  return routes.find((route) => route.id === activeRouteId) ?? routes[0] ?? null;
}

function loadRoutes() {
  if (localStorage.getItem(ROUTE_RESET_KEY) !== "true") {
    localStorage.removeItem(ROUTE_STORAGE_KEY);
    localStorage.setItem(ROUTE_RESET_KEY, "true");
  }
  try {
    const raw = localStorage.getItem(ROUTE_STORAGE_KEY);
    const savedRoutes = raw ? JSON.parse(raw) : [];
    return Array.isArray(savedRoutes) ? savedRoutes.map(normalizeRoute) : [];
  } catch {
    return [];
  }
}

function normalizeRoute(route) {
  const checkpoints = Array.isArray(route.checkpoints) ? route.checkpoints : [];
  const geometry = Array.isArray(route.geometry) ? route.geometry : [];
  return {
    id: route.id ?? createId("route"),
    name: route.name ?? "Saved Route",
    description: route.description ?? "",
    difficulty: clamp(Number(route.difficulty ?? 2), 1, 5),
    colour: ROUTE_COLOURS.includes(route.colour) ? route.colour : ROUTE_COLOURS[0],
    checkpoints: checkpoints.map((point, index) => ({
      id: point.id ?? createId("checkpoint"),
      lat: Number(point.lat),
      lng: Number(point.lng),
      label: point.label ?? checkpointName(index),
      type: point.type ?? "single",
      kind: point.kind ?? "",
      linkedTo: point.linkedTo ?? ""
    })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    geometry: geometry.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng)
    })).filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)),
    distanceKm: Number(route.distanceKm ?? 0),
    lastWalked: route.lastWalked ?? "Not walked yet",
    longest: route.longest ?? "New",
    tone: route.tone ?? "green"
  };
}

function saveRoutes() {
  localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(routes));
}

function curvedFallback(points) {
  if (points.length < 2) return points;
  const output = [];
  points.forEach((point, index) => {
    const next = points[index + 1];
    output.push(point);
    if (!next) return;
    const midLat = (point.lat + next.lat) / 2;
    const midLng = (point.lng + next.lng) / 2;
    const bend = index % 2 === 0 ? 0.0008 : -0.0008;
    output.push({ lat: midLat + bend, lng: midLng - bend });
  });
  return output;
}

function estimateDistance(points) {
  if (points.length < 2) return 0;
  let meters = 0;
  for (let index = 1; index < points.length; index += 1) {
    meters += haversine(points[index - 1], points[index]);
  }
  return Number((meters / 1000).toFixed(2));
}

function haversine(a, b) {
  const radius = 6371000;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const h = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value) {
  return value * Math.PI / 180;
}

function formatDistance(distance) {
  const value = Number(distance || 0);
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function hashString(value) {
  return String(value).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function renderDogs() {
  const dogMarkup = dogs.length
    ? dogs.map(dogCard).join("")
    : `
      <article class="empty-state card">
        <div class="empty-icon"><i class="fa-solid fa-dog"></i></div>
        <h3>No dogs yet</h3>
        <p>Add your first dog to choose who is going for a walk.</p>
        <button class="primary-action" data-action="add-dog"><i class="fa-solid fa-plus"></i>Add Dog</button>
      </article>
    `;
  screens.dogs.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Companions</p>
        <h2>Dogs</h2>
        <p>Manage dogs and walking stats.</p>
      </header>
      <button class="wide-action" data-action="add-dog">
        <i class="fa-solid fa-dog"></i>
        Add Dog
      </button>
      <div class="card-list">
        ${dogMarkup}
      </div>
    </div>
  `;
}

function dogCard(dog) {
  return `
    <article class="dog-card card ${dog.selected ? "selected" : ""}">
      <div class="dog-avatar">${dog.photo ? photoImage(dog, `${escapeHtml(dog.name)} profile photo`) : '<i class="fa-solid fa-dog"></i>'}</div>
      <div class="card-main">
        <div class="card-title-row">
          <div>
            <h3>${escapeHtml(dog.name)}</h3>
            <p>${escapeHtml(dog.breed)}</p>
          </div>
          ${dog.selected ? '<span class="selected-badge"><i class="fa-solid fa-circle-check"></i>Selected</span>' : `<button class="small-pill" data-action="select-dog" data-id="${dog.id}">Select</button>`}
        </div>
        <div class="dog-grid">
          <span><i class="fa-solid fa-cake-candles"></i>${formatBirthday(dog.birthday)}</span>
          <span><i class="fa-solid fa-id-card"></i>${dogAge(dog.birthday)}</span>
          <span><i class="fa-solid fa-person-walking"></i>${dog.totalWalks} walks</span>
          <span><i class="fa-solid fa-heart"></i>${escapeHtml(dog.favouriteRoute || "No favourite yet")}</span>
          <span><i class="fa-solid fa-chart-simple"></i>${formatDogDistance(dog.totalDistance)} total</span>
        </div>
        <div class="dog-actions">
          <button class="small-pill" data-action="edit-dog" data-id="${dog.id}"><i class="fa-solid fa-pen"></i>Edit</button>
          <button class="small-pill danger-pill" data-action="delete-dog" data-id="${dog.id}"><i class="fa-solid fa-trash"></i>Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderAccount() {
  screens.account.innerHTML = `
    <div class="screen-scroll">
      <header class="screen-header">
        <p class="eyebrow">Local profile</p>
        <h2>Account</h2>
        <p>Customise your local walking profile.</p>
      </header>
      <article class="profile-card card">
        <div class="profile-avatar"><i class="fa-solid fa-circle-user"></i></div>
        <div>
          <h3>Luke</h3>
          <p>Local walking profile</p>
        </div>
        <button class="small-pill" data-action="confirm" data-title="Edit profile?"><i class="fa-solid fa-pen"></i>Edit</button>
      </article>
      ${settingsSection("Profile", "fa-circle-user", [
        ["fa-pen", "Change name", "confirm"],
        ["fa-image", "Change profile picture", "confirm"]
      ])}
      ${settingsSection("App Preferences", "fa-gear", [
        ["fa-location-dot", "Default checkpoint radius", "confirm"],
        ["fa-shoe-prints", "Preferred distance unit", "confirm"],
        ["fa-moon", "Theme setting", "confirm"],
        ["fa-person-running", "Reduce motion", "confirm"]
      ])}
      ${settingsSection("Data Management", "fa-triangle-exclamation", [
        ["fa-route", "Reset routes", "routes"],
        ["fa-dog", "Reset dogs", "dogs"],
        ["fa-house", "Reset home base", "home"],
        ["fa-trash", "Reset all local data", "all"]
      ], true)}
    </div>
  `;
}

function settingsSection(title, icon, items, danger = false) {
  return `
    <section class="settings-section card">
      <h3><i class="fa-solid ${icon}"></i>${title}</h3>
      ${items.map(([itemIcon, label, scope]) => `
        <button class="settings-row ${danger ? "danger-text" : ""}" data-action="${scope === "confirm" ? "confirm" : "reset-data"}" data-title="${label}" data-scope="${scope}">
          <span><i class="fa-solid ${itemIcon}"></i>${label}</span>
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      `).join("")}
    </section>
  `;
}

function resetData(scope) {
  if (scope === "routes" || scope === "all") {
    routes = [];
    activeRouteId = null;
    localStorage.removeItem(ROUTE_STORAGE_KEY);
    if (scope === "all") localStorage.removeItem(ROUTE_RESET_KEY);
  }
  if (scope === "dogs" || scope === "all") {
    dogs = [];
    localStorage.removeItem(DOG_STORAGE_KEY);
  }
  if (scope === "home" || scope === "all") {
    localStorage.removeItem(HOME_STORAGE_KEY);
  }
  renderHomeBase();
  renderMapRoutes();
  renderRoutes();
  renderDogs();
  updateWalkCard();
  showToast("Local data reset");
}

function showDogModal(id = null) {
  const dog = dogs.find((item) => item.id === id);
  const isEditing = Boolean(dog);
  showModal(`
    <section class="sheet">
      <header>
        <h2>${isEditing ? "Edit Dog" : "Add Dog"}</h2>
        <button data-action="close-modal" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <form id="dogForm" class="dog-form">
        <input type="hidden" name="id" value="${dog?.id ?? ""}" />
        <input type="hidden" id="dogPhotoData" name="photo" value="${dog?.photo ?? ""}" />
        <input type="hidden" id="dogPhotoX" name="photoX" value="${dog?.photoX ?? 0}" />
        <input type="hidden" id="dogPhotoY" name="photoY" value="${dog?.photoY ?? 0}" />
        <input type="hidden" id="dogPhotoScale" name="photoScale" value="${dog?.photoScale ?? 1}" />
        <div class="photo-upload">
          <span id="dogPhotoPreview" class="photo-preview">
            ${dog?.photo ? photoEditorMarkup(dog) : '<i class="fa-solid fa-image"></i>'}
          </span>
          <label class="upload-button" for="dogPhoto"><i class="fa-solid fa-camera"></i>${dog?.photo ? "Change photo" : "Upload photo"}</label>
          <input id="dogPhoto" type="file" accept="image/*" />
        </div>
        <div class="photo-adjuster ${dog?.photo ? "" : "is-hidden"}" id="photoAdjuster">
          <div class="adjuster-title">
            <span><i class="fa-solid fa-crop-simple"></i>Position photo</span>
            <small>Drag inside the circle, then adjust zoom.</small>
          </div>
          <label>Scale
            <input id="photoScale" type="range" min="1" max="2.4" step="0.05" value="${dog?.photoScale ?? 1}" />
          </label>
        </div>
        <label>Name<input name="name" value="${escapeHtml(dog?.name ?? "")}" placeholder="Milo" required /></label>
        <label>Breed
          <select name="breed" required>
            ${breedOptions(dog?.breed)}
          </select>
        </label>
        <label>Birthday<input name="birthday" type="date" value="${dog?.birthday ?? ""}" required /></label>
        <div class="readonly-stats">
          <span><i class="fa-solid fa-person-walking"></i>${dog?.totalWalks ?? 0} walks</span>
          <span><i class="fa-solid fa-chart-simple"></i>${formatDogDistance(dog?.totalDistance ?? 0)}</span>
          <span><i class="fa-solid fa-heart"></i>${escapeHtml(dog?.favouriteRoute || "Favourite route will appear after walks")}</span>
        </div>
        <div class="sheet-actions">
          <button class="ghost-action" type="button" data-action="close-modal">Cancel</button>
          <button class="primary-action" type="submit">${isEditing ? "Save Changes" : "Save Dog"}</button>
        </div>
      </form>
    </section>
  `);
  bindPhotoDrag();
}

function showDeleteDogModal(id) {
  const dog = dogs.find((item) => item.id === id);
  if (!dog) return;
  showModal(`
    <section class="sheet compact-sheet">
      <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h2>Delete ${escapeHtml(dog.name)}?</h2>
      <p>This removes the dog profile from local storage.</p>
      <div class="sheet-actions">
        <button class="ghost-action" data-action="close-modal">Cancel</button>
        <button class="primary-action danger-action" data-action="confirm-delete-dog" data-id="${dog.id}">Delete Dog</button>
      </div>
    </section>
  `);
}

function showConfirmModal(title) {
  showModal(`
    <section class="sheet compact-sheet">
      <div class="warning-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
      <h2>${title}</h2>
      <p>This setting is still a prototype control.</p>
      <button class="primary-action" data-action="close-modal">Got it</button>
    </section>
  `);
}

function showModal(markup) {
  modalLayer.innerHTML = `<div class="scrim" data-action="close-modal"></div>${markup}`;
  modalLayer.hidden = false;
}

function closeModal() {
  modalLayer.hidden = true;
  modalLayer.innerHTML = "";
}

function showToast(message = "Design mockup only.") {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

async function saveDogFromForm(form) {
  const formData = new FormData(form);
  const id = formData.get("id") || createId("dog");
  const existing = dogs.find((dog) => dog.id === id);
  const nextDog = {
    id,
    name: String(formData.get("name")).trim(),
    breed: String(formData.get("breed")).trim(),
    birthday: String(formData.get("birthday")),
    photo: String(formData.get("photo") || ""),
    photoX: Number(formData.get("photoX") || 0),
    photoY: Number(formData.get("photoY") || 0),
    photoScale: Number(formData.get("photoScale") || 1),
    totalWalks: existing?.totalWalks ?? 0,
    favouriteRoute: existing?.favouriteRoute ?? "",
    totalDistance: existing?.totalDistance ?? 0,
    selected: existing?.selected ?? dogs.length === 0
  };
  if (!nextDog.name || !nextDog.breed || !nextDog.birthday) return;
  dogs = existing
    ? dogs.map((dog) => dog.id === id ? nextDog : dog)
    : [...dogs, nextDog];
  if (!dogs.some((dog) => dog.selected) && dogs.length) dogs[0].selected = true;
  saveDogs();
  closeModal();
  renderDogs();
  updateWalkCard();
  showToast(`${nextDog.name} saved`);
}

function deleteDog(id) {
  const removed = dogs.find((dog) => dog.id === id);
  dogs = dogs.filter((dog) => dog.id !== id);
  if (removed?.selected && dogs.length) dogs[0].selected = true;
  saveDogs();
  closeModal();
  renderDogs();
  updateWalkCard();
  showToast("Dog deleted");
}

function selectDog(id) {
  dogs = dogs.map((dog) => ({ ...dog, selected: dog.id === id }));
  saveDogs();
  renderDogs();
  updateWalkCard();
  showToast("Dog selected");
}

function loadDogs() {
  try {
    const raw = localStorage.getItem(DOG_STORAGE_KEY);
    const savedDogs = raw ? JSON.parse(raw) : [];
    return Array.isArray(savedDogs) ? savedDogs.map(normalizeDog) : [];
  } catch {
    return [];
  }
}

function normalizeDog(dog) {
  return {
    id: dog.id ?? createId("dog"),
    name: dog.name ?? "",
    breed: dog.breed ?? "Mixed Breed",
    birthday: dog.birthday ?? "",
    photo: dog.photo ?? "",
    photoX: Number(dog.photoX ?? 0),
    photoY: Number(dog.photoY ?? 0),
    photoScale: Number(dog.photoScale ?? 1),
    totalWalks: Number(dog.totalWalks ?? 0),
    favouriteRoute: dog.favouriteRoute ?? "",
    totalDistance: Number(dog.totalDistance ?? 0),
    selected: Boolean(dog.selected)
  };
}

function saveDogs() {
  localStorage.setItem(DOG_STORAGE_KEY, JSON.stringify(dogs));
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createId(prefix) {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dogAge(birthday) {
  if (!birthday) return "Age unknown";
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return "Age unknown";
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) years -= 1;
  if (years <= 0) return "Under 1 year";
  return `${years} year${years === 1 ? "" : "s"}`;
}

function formatBirthday(birthday) {
  if (!birthday) return "No birthday";
  const date = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(date.getTime())) return birthday;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDogDistance(distance) {
  const safeDistance = Number(distance || 0);
  return `${safeDistance.toLocaleString(undefined, { maximumFractionDigits: 1 })} km`;
}

function photoImage(dog, altText) {
  return `<img src="${dog.photo}" alt="${altText}" style="${photoStyle(dog)}" />`;
}

function photoEditorMarkup(dog) {
  return `
    <span class="photo-frame" id="photoFrame" data-dragging="false">
      <img id="photoEditorImage" src="${dog.photo}" alt="Dog photo crop preview" style="${photoStyle(dog)}" />
      <span class="circle-guide" aria-hidden="true"></span>
    </span>
  `;
}

function photoStyle(dog) {
  return `--photo-x: ${Number(dog.photoX ?? 0)}%; --photo-y: ${Number(dog.photoY ?? 0)}%; --photo-scale: ${Number(dog.photoScale ?? 1)};`;
}

function setPhotoEditorImage(photo, crop) {
  document.getElementById("dogPhotoX").value = crop.x;
  document.getElementById("dogPhotoY").value = crop.y;
  document.getElementById("dogPhotoScale").value = crop.scale;
  const scaleInput = document.getElementById("photoScale");
  if (scaleInput) scaleInput.value = crop.scale;
  document.getElementById("dogPhotoPreview").innerHTML = photoEditorMarkup({
    photo,
    photoX: crop.x,
    photoY: crop.y,
    photoScale: crop.scale
  });
  document.getElementById("photoAdjuster")?.classList.remove("is-hidden");
  bindPhotoDrag();
}

function updatePhotoEditorImage() {
  const image = document.getElementById("photoEditorImage");
  if (!image) return;
  image.style.setProperty("--photo-x", `${document.getElementById("dogPhotoX").value}%`);
  image.style.setProperty("--photo-y", `${document.getElementById("dogPhotoY").value}%`);
  image.style.setProperty("--photo-scale", document.getElementById("dogPhotoScale").value);
}

function bindPhotoDrag() {
  const frame = document.getElementById("photoFrame");
  if (!frame || frame.dataset.bound === "true") return;
  frame.dataset.bound = "true";
  let start = null;
  frame.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    frame.setPointerCapture(event.pointerId);
    start = {
      x: event.clientX,
      y: event.clientY,
      cropX: Number(document.getElementById("dogPhotoX").value || 0),
      cropY: Number(document.getElementById("dogPhotoY").value || 0)
    };
  });
  frame.addEventListener("pointermove", (event) => {
    if (!start) return;
    const bounds = frame.getBoundingClientRect();
    const deltaX = ((event.clientX - start.x) / bounds.width) * 100;
    const deltaY = ((event.clientY - start.y) / bounds.height) * 100;
    document.getElementById("dogPhotoX").value = clamp(start.cropX + deltaX, -45, 45).toFixed(1);
    document.getElementById("dogPhotoY").value = clamp(start.cropY + deltaY, -45, 45).toFixed(1);
    updatePhotoEditorImage();
  });
  frame.addEventListener("pointerup", () => {
    start = null;
  });
  frame.addEventListener("pointercancel", () => {
    start = null;
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function breedOptions(selectedBreed = "Mixed Breed") {
  const normalizedBreed = DOG_BREEDS.includes(selectedBreed) ? selectedBreed : "Other";
  return DOG_BREEDS.map((breed) =>
    `<option value="${escapeHtml(breed)}" ${breed === normalizedBreed ? "selected" : ""}>${escapeHtml(breed)}</option>`
  ).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}
