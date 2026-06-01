const KEYS = {
  routes: "paws-paths:routes",
  walks: "paws-paths:walks",
  homeBase: "paws-paths:home-base",
  xp: "paws-paths:xp",
  settings: "paws-paths:settings"
};

export const DEFAULT_SETTINGS = {
  audioEnabled: true,
  hapticsEnabled: true
};

export function loadJson(key, fallback, storage = window.localStorage) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJson(key, value, storage = window.localStorage) {
  storage.setItem(key, JSON.stringify(value));
}

export function loadRoutes(storage) {
  return loadJson(KEYS.routes, [], storage);
}

export function saveRoutes(routes, storage) {
  saveJson(KEYS.routes, routes, storage);
}

export function loadWalks(storage) {
  return loadJson(KEYS.walks, [], storage);
}

export function saveWalks(walks, storage) {
  saveJson(KEYS.walks, walks, storage);
}

export function loadHomeBase(storage) {
  return loadJson(KEYS.homeBase, null, storage);
}

export function saveHomeBase(homeBase, storage) {
  saveJson(KEYS.homeBase, homeBase, storage);
}

export function clearHomeBase(storage = window.localStorage) {
  storage.removeItem(KEYS.homeBase);
}

export function loadXp(storage) {
  return loadJson(KEYS.xp, 0, storage);
}

export function saveXp(xp, storage) {
  saveJson(KEYS.xp, xp, storage);
}

export function loadSettings(storage) {
  return { ...DEFAULT_SETTINGS, ...loadJson(KEYS.settings, DEFAULT_SETTINGS, storage) };
}

export function saveSettings(settings, storage) {
  saveJson(KEYS.settings, { ...DEFAULT_SETTINGS, ...settings }, storage);
}

export function eraseStoredData(type, storage = window.localStorage) {
  if (type === "routes" || type === "all") storage.removeItem(KEYS.routes);
  if (type === "walks" || type === "all") storage.removeItem(KEYS.walks);
  if (type === "home" || type === "all") storage.removeItem(KEYS.homeBase);
  if (type === "xp" || type === "all") storage.removeItem(KEYS.xp);
  if (type === "settings" || type === "all") storage.removeItem(KEYS.settings);
}

export function latestWalkForRoute(routeId, walks, beforeWalkId = null) {
  return walks
    .filter((walk) => walk.routeId === routeId && walk.id !== beforeWalkId && walk.endedAt)
    .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))[0] ?? null;
}

export { KEYS };
