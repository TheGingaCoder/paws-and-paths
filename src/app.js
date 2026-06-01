import { AudioFeedback } from "./audio.js";
import { formatDistance, formatDuration, formatRelativeDate } from "./format.js";
import { createMapController } from "./map.js";
import { Haptics } from "./haptics.js";
import { buildRouteCheckpoints } from "./routes.js";
import { averageCheckpointSeconds, scoreWalk } from "./scoring.js";
import {
  clearHomeBase,
  eraseStoredData,
  latestWalkForRoute,
  loadHomeBase,
  loadRoutes,
  loadSettings,
  loadWalks,
  loadXp,
  saveHomeBase,
  saveRoutes,
  saveSettings,
  saveWalks,
  saveXp
} from "./storage.js";
import { WalkTracker } from "./walkTracker.js";

const state = {
  tab: "home",
  routes: loadRoutes(),
  walks: loadWalks(),
  homeBase: loadHomeBase(),
  xp: loadXp(),
  settings: loadSettings(),
  draft: { name: "", checkpoints: [], cyclic: false },
  activeTracker: null,
  activeRoute: null,
  walkFinishing: false,
  checkpointNotifiedIndex: -1,
  gpsMessage: "",
  results: null
};

const elements = {
  panel: document.getElementById("panelContent"),
  title: document.getElementById("viewTitle"),
  xp: document.getElementById("xpValue"),
  walkHud: document.getElementById("walkHud"),
  walkRouteName: document.getElementById("walkRouteName"),
  walkTime: document.getElementById("walkTime"),
  walkDistance: document.getElementById("walkDistance"),
  walkCheckpoints: document.getElementById("walkCheckpoints"),
  toastRegion: document.getElementById("toastRegion"),
  resultsModal: document.getElementById("resultsModal")
};
const audio = new AudioFeedback();
audio.setEnabled(state.settings.audioEnabled);
const haptics = new Haptics(state.settings.hapticsEnabled);

const mapController = createMapController({
  containerId: "map",
  fallbackId: "mapFallback",
  onMapClick: (point) => {
    if (state.tab !== "create") return;
    addDraftCheckpoint(point);
  }
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
});

document.getElementById("findMeButton").addEventListener("click", findMe);
document.getElementById("goHomeButton").addEventListener("click", goHome);
document.addEventListener("pointerdown", addPressFeedback);

if (state.homeBase) mapController.setHome(state.homeBase);
mapController.setSavedRoutes(state.routes);
render();

function setTab(tab) {
  audio.success();
  state.tab = tab;
  state.results = null;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  render();
}

function render() {
  elements.xp.textContent = state.xp;
  elements.title.textContent = titleForTab(state.tab);
  if (state.activeTracker && state.activeRoute) renderWalkControls(state.activeRoute);
  else if (state.results) renderResults();
  else if (state.tab === "home") renderHome();
  else if (state.tab === "search") renderSearch();
  else if (state.tab === "routes") renderRoutes();
  else if (state.tab === "create") renderCreate();
  else renderSettings();
  elements.resultsModal.hidden = !state.results;
  animatePanel();
  updateWalkHud();
}

function renderHome() {
  const routeCount = state.routes.length;
  const walkCount = state.walks.length;
  const lastWalk = state.walks.at(-1);
  elements.panel.innerHTML = `
    <div class="hero-copy">
      <p class="eyebrow">Calm progress</p>
      <h2>Build richer walks, not faster ones.</h2>
      <p>Make a route, add checkpoints, then let Paws & Paths track time outside, distance, and gentle XP.</p>
    </div>
    <div class="stat-grid">
      <div class="stat"><strong>${routeCount}</strong><span>Routes</span></div>
      <div class="stat"><strong>${walkCount}</strong><span>Walks</span></div>
      <div class="stat"><strong>${lastWalk ? formatDistance(lastWalk.distanceMeters) : "0 m"}</strong><span>Last walk</span></div>
    </div>
    <div class="action-row">
      <button class="primary" data-action="create">Create route</button>
      <button class="secondary" data-action="routes">Saved routes</button>
    </div>
    <div class="home-card">
      <div>
        <strong>Home base</strong>
        <span>${state.homeBase ? `${state.homeBase.lat.toFixed(4)}, ${state.homeBase.lng.toFixed(4)}` : "Not set yet"}</span>
      </div>
      <button class="secondary compact" data-action="set-home">Set from map</button>
      ${state.homeBase ? '<button class="ghost compact" data-action="clear-home">Clear</button>' : ""}
    </div>
  `;
  bindActions({
    create: () => setTab("create"),
    routes: () => setTab("routes"),
    "set-home": setHomeFromMap,
    "clear-home": clearHome
  });
}

function renderSearch() {
  elements.panel.innerHTML = `
    <form id="searchForm" class="search-form">
      <label for="searchInput">Find a town, postcode, park, or landmark</label>
      <div class="input-row">
        <input id="searchInput" name="q" type="search" placeholder="Try Heaton Park" required />
        <button class="primary compact" type="submit">Search</button>
      </div>
    </form>
    <div id="searchResults" class="result-list"></div>
  `;
  document.getElementById("searchForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = new FormData(event.currentTarget).get("q").trim();
    await searchPlaces(query, event.submitter);
  });
}

function renderRoutes() {
  if (!state.routes.length) {
    elements.panel.innerHTML = `
      <div class="empty-state">
        <h2>No routes saved yet.</h2>
        <p>Create checkpoints on the map and your first route will appear here.</p>
        <button class="primary" data-action="create">Create route</button>
      </div>
    `;
    bindActions({ create: () => setTab("create") });
    return;
  }
  elements.panel.innerHTML = `
    <div class="route-list">
      ${state.routes.map(routeCard).join("")}
    </div>
  `;
  bindActions({
    "view-route": (button) => viewRoute(button.dataset.id),
    "start-route": (button) => startRoute(button.dataset.id)
  });
}

function routeCard(route) {
  const lastWalk = latestWalkForRoute(route.id, state.walks);
  const summary = lastWalk
    ? `${formatDistance(lastWalk.distanceMeters)} | ${formatDuration(lastWalk.activeTimeSeconds)} | ${formatRelativeDate(lastWalk.endedAt)}`
    : "No walks logged yet";
  return `
    <article class="route-card">
      <div>
        <h3>${escapeHtml(route.name)}</h3>
        <p>${route.checkpoints.length} checkpoint${route.checkpoints.length === 1 ? "" : "s"}</p>
        <small>${summary}</small>
      </div>
      <div class="card-actions">
        <button class="secondary compact" data-action="view-route" data-id="${route.id}">View</button>
        <button class="primary compact" data-action="start-route" data-id="${route.id}">Start</button>
      </div>
    </article>
  `;
}

function renderCreate() {
  elements.panel.innerHTML = `
    <form id="routeForm" class="create-form">
      <label for="routeName">Route name</label>
      <input id="routeName" name="routeName" value="${escapeHtml(state.draft.name)}" placeholder="Morning park loop" />
      <label class="toggle-row">
        <input id="cyclicRoute" type="checkbox" ${state.draft.cyclic ? "checked" : ""} ${state.homeBase ? "" : "disabled"} />
        <span>
          <strong>Home loop</strong>
          <small>${state.homeBase ? "Start at home, visit checkpoints, finish at home." : "Set a home base first to use home loops."}</small>
        </span>
      </label>
      <p class="hint">${state.draft.cyclic ? "Tap the map to add the stops between home start and home finish." : "Tap the map to add checkpoints. First stop becomes Start."}</p>
      ${state.draft.cyclic && state.homeBase ? `<div class="checkpoint-preview"><strong>Home start</strong><span>${state.homeBase.lat.toFixed(4)}, ${state.homeBase.lng.toFixed(4)}</span></div>` : ""}
      <ol class="checkpoint-list">
        ${state.draft.checkpoints.map((point) => `<li><strong>${point.name}</strong><span>${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}</span></li>`).join("")}
      </ol>
      ${state.draft.cyclic && state.homeBase ? `<div class="checkpoint-preview finish"><strong>Home finish</strong><span>${state.homeBase.lat.toFixed(4)}, ${state.homeBase.lng.toFixed(4)}</span></div>` : ""}
      <div class="action-row">
        <button class="secondary" data-action="add-centre" type="button">Add map centre</button>
        <button class="primary" type="submit" ${canSaveDraft() ? "" : "disabled"}>Save route</button>
        <button class="secondary" data-action="clear-draft" type="button">Clear</button>
      </div>
    </form>
  `;
  document.getElementById("routeName").addEventListener("input", (event) => {
    state.draft.name = event.target.value;
  });
  document.getElementById("cyclicRoute").addEventListener("change", (event) => {
    state.draft.cyclic = event.target.checked;
    audio.success();
    renderCreate();
  });
  document.getElementById("routeForm").addEventListener("submit", saveDraftRoute);
  bindActions({
    "add-centre": () => addDraftCheckpoint(mapController.getCenter()),
    "clear-draft": clearDraft
  });
  mapController.setDraftRoute(buildRouteCheckpoints({
    draftCheckpoints: state.draft.checkpoints,
    cyclic: state.draft.cyclic,
    homeBase: state.homeBase
  }));
}

function renderSettings() {
  elements.panel.innerHTML = `
    <div class="settings-panel">
      <div>
        <p class="eyebrow">Settings</p>
        <h2>App controls</h2>
      </div>
      <label class="toggle-row">
        <input id="audioToggle" type="checkbox" ${state.settings.audioEnabled ? "checked" : ""} />
        <span>
          <strong>Audio feedback</strong>
          <small>Small UI tones, checkpoint chimes, and walk-complete fanfare.</small>
        </span>
      </label>
      <label class="toggle-row">
        <input id="hapticsToggle" type="checkbox" ${state.settings.hapticsEnabled ? "checked" : ""} />
        <span>
          <strong>Haptics</strong>
          <small>Small vibration for checkpoints, bigger vibration for completed walks.</small>
        </span>
      </label>
      <div class="settings-group">
        <h3>Erase data</h3>
        <div class="erase-grid">
          <button class="secondary compact" data-action="erase-walks">Walks</button>
          <button class="secondary compact" data-action="erase-routes">Routes</button>
          <button class="secondary compact" data-action="erase-home">Home</button>
          <button class="secondary compact" data-action="erase-xp">XP</button>
          <button class="secondary compact" data-action="erase-settings">Preferences</button>
          <button class="danger compact" data-action="erase-all">Everything</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("audioToggle").addEventListener("change", (event) => {
    state.settings.audioEnabled = event.target.checked;
    audio.setEnabled(state.settings.audioEnabled);
    saveSettings(state.settings);
    if (state.settings.audioEnabled) {
      audio.unlock();
      audio.success();
    }
    showToast(state.settings.audioEnabled ? "Audio on" : "Audio off");
  });
  document.getElementById("hapticsToggle").addEventListener("change", (event) => {
    state.settings.hapticsEnabled = event.target.checked;
    haptics.setEnabled(state.settings.hapticsEnabled);
    saveSettings(state.settings);
    if (state.settings.hapticsEnabled) haptics.checkpoint();
    showToast(state.settings.hapticsEnabled ? "Haptics on" : "Haptics off");
  });
  bindActions({
    "erase-walks": () => eraseData("walks"),
    "erase-routes": () => eraseData("routes"),
    "erase-home": () => eraseData("home"),
    "erase-xp": () => eraseData("xp"),
    "erase-settings": () => eraseData("settings"),
    "erase-all": () => eraseData("all")
  });
}

function renderResults() {
  const { walk, route, score } = state.results;
  elements.title.textContent = "Walk complete";
  elements.panel.innerHTML = `
    <div class="results-teaser">
      <p class="eyebrow">Walk complete</p>
      <h2>Results unlocked</h2>
      <p class="hint">Your walk summary is on the big screen.</p>
      <button class="secondary" data-action="done-results">Back to routes</button>
    </div>
  `;
  elements.resultsModal.hidden = false;
  elements.resultsModal.innerHTML = `
    <div class="modal-scrim" data-action="done-results"></div>
    <section class="results-window" role="dialog" aria-modal="true" aria-labelledby="resultsTitle">
      <div class="celebration-sparks" aria-hidden="true">
        <span></span><span></span><span></span><span></span><span></span><span></span>
      </div>
      <div class="results-rank reveal-step" style="--delay: 180ms">
        <span>Walk complete</span>
        <strong>Trail Triumph</strong>
      </div>
      <h2 id="resultsTitle" class="reveal-step" style="--delay: 560ms">${score.xp} XP earned</h2>
      <p class="result-message reveal-step" style="--delay: 920ms">${score.comparison}</p>
      <div class="results-grid">
        <div class="result-tile reveal-step" style="--delay: 1320ms"><small>Active time</small><strong>${formatDuration(walk.activeTimeSeconds)}</strong></div>
        <div class="result-tile reveal-step" style="--delay: 1620ms"><small>Paused time</small><strong>${formatDuration(walk.pausedTimeSeconds)}</strong></div>
        <div class="result-tile reveal-step" style="--delay: 1920ms"><small>Distance</small><strong>${formatDistance(walk.distanceMeters)}</strong></div>
        <div class="result-tile reveal-step" style="--delay: 2220ms"><small>Avg stop</small><strong>${formatDuration(averageCheckpointSeconds(walk.checkpointTimes))}</strong></div>
      </div>
      <div class="completion-bar reveal-step" style="--delay: 2600ms">
        <div>
          <strong>${walk.completedCheckpointIndex + 1}/${route.checkpoints.length}</strong>
          <span>checkpoints completed</span>
        </div>
        <meter min="0" max="${route.checkpoints.length}" value="${walk.completedCheckpointIndex + 1}"></meter>
      </div>
      <button class="primary results-done reveal-step" style="--delay: 3050ms" data-action="done-results">Collect XP</button>
    </section>
  `;
  bindResultActions({ "done-results": () => setTab("routes") });
}

function bindResultActions(actions) {
  elements.resultsModal.querySelectorAll("[data-action]").forEach((button) => {
    const handler = actions[button.dataset.action];
    if (handler) button.addEventListener("click", () => handler(button));
  });
  elements.panel.querySelectorAll("[data-action]").forEach((button) => {
    const handler = actions[button.dataset.action];
    if (handler) button.addEventListener("click", () => handler(button));
  });
}

function addDraftCheckpoint(point) {
  const index = state.draft.checkpoints.length;
  const named = {
    ...point,
    name: state.draft.cyclic ? `Checkpoint ${index + 1}` : index === 0 ? "Start" : `Checkpoint ${index + 1}`
  };
  state.draft.checkpoints.push(named);
  mapController.setDraftRoute(buildRouteCheckpoints({
    draftCheckpoints: state.draft.checkpoints,
    cyclic: state.draft.cyclic,
    homeBase: state.homeBase
  }));
  audio.checkpoint();
  showToast(`${named.name} added`);
  renderCreate();
}

function saveDraftRoute(event) {
  event.preventDefault();
  const name = new FormData(event.currentTarget).get("routeName").trim() || "Untitled route";
  if (!canSaveDraft()) return;
  const checkpoints = buildRouteCheckpoints({
    draftCheckpoints: state.draft.checkpoints,
    cyclic: state.draft.cyclic,
    homeBase: state.homeBase
  });
  const route = {
    id: createId("route"),
    name,
    checkpoints,
    cyclic: state.draft.cyclic,
    createdAt: new Date().toISOString()
  };
  state.routes.push(route);
  saveRoutes(state.routes);
  mapController.setSavedRoutes(state.routes);
  showToast("Route saved");
  clearDraft();
  setTab("routes");
}

function clearDraft() {
  state.draft = { name: "", checkpoints: [], cyclic: false };
  mapController.setDraftRoute([]);
  render();
}

function canSaveDraft() {
  if (state.draft.cyclic) return Boolean(state.homeBase) && state.draft.checkpoints.length >= 1;
  return state.draft.checkpoints.length >= 2;
}

async function searchPlaces(query, submitButton) {
  const resultContainer = document.getElementById("searchResults");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Finding";
  }
  resultContainer.innerHTML = '<p class="hint">Searching...</p>';
  try {
    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "5" });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("Search failed");
    const places = await response.json();
    if (!places.length) {
      resultContainer.innerHTML = '<p class="hint">No places found. Try a nearby park or postcode.</p>';
      return;
    }
    resultContainer.innerHTML = places.map((place, index) => `
      <button class="place-result" data-index="${index}" type="button">
        <strong>${escapeHtml(place.name || place.display_name.split(",")[0])}</strong>
        <span>${escapeHtml(place.display_name)}</span>
      </button>
    `).join("");
    resultContainer.querySelectorAll(".place-result").forEach((button) => {
      button.addEventListener("click", () => {
        const place = places[Number(button.dataset.index)];
        const position = { lat: Number(place.lat), lng: Number(place.lon) };
        mapController.flyTo(position, 15);
        mapController.setUser(position);
        showToast("Map moved to result");
      });
    });
  } catch {
    resultContainer.innerHTML = '<p class="hint">Search is unavailable right now. The map is still yours to explore.</p>';
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Search";
    }
  }
}

function findMe() {
  if (!("geolocation" in navigator)) {
    state.gpsMessage = "GPS is not available in this browser.";
    render();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (event) => {
      const position = { lat: event.coords.latitude, lng: event.coords.longitude };
      mapController.flyTo(position, 15);
      mapController.setUser(position);
      audio.success();
      showToast("Location found");
    },
    () => {
      state.gpsMessage = "Location permission was not granted. Search still works.";
      showToast("Location unavailable");
      render();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function setHomeFromMap() {
  state.homeBase = mapController.getCenter();
  saveHomeBase(state.homeBase);
  mapController.setHome(state.homeBase);
  audio.success();
  showToast("Home base set");
  render();
}

function goHome() {
  if (state.homeBase) {
    mapController.flyTo(state.homeBase, 15);
    showToast("Heading home");
  } else {
    showToast("Set a home base first");
  }
}

function clearHome() {
  state.homeBase = null;
  clearHomeBase();
  mapController.clearHome();
  showToast("Home base cleared");
  render();
}

function eraseData(type) {
  if (state.activeTracker) {
    showToast("Stop the active walk first");
    return;
  }
  const labels = {
    walks: "all walk history",
    routes: "all saved routes",
    home: "your home base",
    xp: "your XP",
    settings: "your preferences",
    all: "all Paws & Paths data"
  };
  if (!window.confirm(`Erase ${labels[type]}? This cannot be undone.`)) return;
  eraseStoredData(type);
  if (type === "walks" || type === "all") state.walks = [];
  if (type === "routes" || type === "all") {
    state.routes = [];
    mapController.setSavedRoutes([]);
    mapController.setCheckpoints([]);
  }
  if (type === "home" || type === "all") {
    state.homeBase = null;
    mapController.clearHome();
  }
  if (type === "xp" || type === "all") state.xp = 0;
  if (type === "settings" || type === "all") {
    state.settings = loadSettings();
    audio.setEnabled(state.settings.audioEnabled);
    haptics.setEnabled(state.settings.hapticsEnabled);
  }
  state.results = null;
  showToast("Data erased");
  render();
}

function viewRoute(id) {
  const route = state.routes.find((item) => item.id === id);
  if (!route) return;
  mapController.setCheckpoints(route.checkpoints);
  mapController.fitRoute(route);
  showToast("Route on map");
}

function startRoute(id) {
  const route = state.routes.find((item) => item.id === id);
  if (!route || state.activeTracker) return;
  viewRoute(id);
  const tracker = new WalkTracker({
    route,
    onUpdate: (walk) => {
      handleWalkUpdate(route, walk);
    }
  });
  state.activeTracker = tracker;
  state.activeRoute = route;
  state.checkpointNotifiedIndex = -1;
  state.gpsMessage = "";
  showToast("Walk started");
  tracker.startLocationWatch({
    onPermissionIssue: (message) => {
      state.gpsMessage = message;
      showToast("GPS backup mode");
      render();
    }
  });
  renderWalkControls(route);
  updateWalkHud();
}

function renderWalkControls(route) {
  elements.title.textContent = "Walking";
  elements.panel.innerHTML = `
    <div class="walk-controls">
      <p class="eyebrow">Now walking</p>
      <h2>${escapeHtml(route.name)}</h2>
      <p class="hint">${state.gpsMessage || "GPS will complete checkpoints as you reach them."}</p>
      <p class="hint">${route.cyclic ? "This home loop finishes when you return home after the other stops." : "The walk finishes automatically at the final checkpoint."}</p>
      <div class="action-row">
        <button class="secondary" data-action="pause-walk">${state.activeTracker?.isPaused ? "Resume" : "Pause"}</button>
        <button class="primary" data-action="manual-checkpoint">Manual checkpoint</button>
        <button class="secondary" data-action="add-position-centre">Add map position</button>
        <button class="danger" data-action="stop-walk">Stop</button>
      </div>
    </div>
  `;
  bindActions({
    "pause-walk": (button) => {
      if (state.activeTracker.isPaused) {
        state.activeTracker.resume();
        button.textContent = "Pause";
        showToast("Walk resumed");
      } else {
        state.activeTracker.pause();
        button.textContent = "Resume";
        showToast("Walk paused");
      }
    },
    "manual-checkpoint": () => {
      const completed = state.activeTracker.completeCheckpoint("manual", null);
      if (!completed) showToast("All checkpoints complete");
    },
    "add-position-centre": () => {
      state.activeTracker.addPosition({
        ...mapController.getCenter(),
        accuracy: null,
        timestamp: new Date().toISOString()
      });
      showToast("Position added");
    },
    "stop-walk": () => stopWalk(route)
  });
}

function stopWalk(route) {
  if (!state.activeTracker) return;
  const walk = state.activeTracker.stop();
  state.activeTracker = null;
  state.activeRoute = null;
  state.walkFinishing = false;
  state.checkpointNotifiedIndex = -1;
  const previousWalk = latestWalkForRoute(route.id, state.walks, walk.id);
  const score = scoreWalk(walk, route, previousWalk);
  state.walks.push(walk);
  state.xp += score.xp;
  state.results = { walk, route, score };
  saveWalks(state.walks);
  saveXp(state.xp);
  mapController.setLiveWalk([]);
  audio.finish();
  haptics.finish();
  showToast(`+${score.xp} XP`);
  render();
}

function handleWalkUpdate(route, walk) {
  mapController.setLiveWalk(walk.positions);
  updateWalkHud();
  const finalCheckpointIndex = route.checkpoints.length - 1;
  if (walk.completedCheckpointIndex > state.checkpointNotifiedIndex) {
    state.checkpointNotifiedIndex = walk.completedCheckpointIndex;
    const checkpoint = route.checkpoints[walk.completedCheckpointIndex];
    if (walk.completedCheckpointIndex < finalCheckpointIndex) {
      audio.checkpoint();
      haptics.checkpoint();
      showToast(`${checkpoint.name} completed`);
    }
  }
  if (walk.completedCheckpointIndex >= finalCheckpointIndex && !state.walkFinishing) {
    state.walkFinishing = true;
    showToast("Route complete");
    window.setTimeout(() => stopWalk(route), 650);
  }
}

function updateWalkHud() {
  const tracker = state.activeTracker;
  elements.walkHud.hidden = !tracker;
  if (!tracker) return;
  const walk = tracker.walk;
  const route = tracker.route;
  elements.walkRouteName.textContent = route.name;
  elements.walkTime.textContent = formatDuration(walk.activeTimeSeconds);
  elements.walkDistance.textContent = formatDistance(walk.distanceMeters);
  elements.walkCheckpoints.textContent = `${walk.completedCheckpointIndex + 1}/${route.checkpoints.length}`;
}

function bindActions(actions) {
  elements.panel.querySelectorAll("[data-action]").forEach((button) => {
    const handler = actions[button.dataset.action];
    if (handler) button.addEventListener("click", () => handler(button));
  });
}

function animatePanel() {
  elements.panel.classList.remove("panel-content-enter");
  requestAnimationFrame(() => elements.panel.classList.add("panel-content-enter"));
}

function addPressFeedback(event) {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  audio.unlock();
  audio.tap();
  haptics.tap();
  button.classList.remove("is-pressing");
  requestAnimationFrame(() => button.classList.add("is-pressing"));
  window.setTimeout(() => button.classList.remove("is-pressing"), 220);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.classList.add("toast-out"), 2100);
  window.setTimeout(() => toast.remove(), 2500);
}

function titleForTab(tab) {
  return { home: "Home", search: "Search", routes: "Routes", create: "Create", settings: "Settings" }[tab];
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

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
