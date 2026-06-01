import { haversineDistanceMeters, nextCheckpointDetection, shouldAcceptGpsUpdate } from "./geo.js";

export class WalkTracker {
  constructor({ route, radiusMeters = 35, maxJumpMeters = 80, onUpdate = () => {} }) {
    this.route = route;
    this.radiusMeters = radiusMeters;
    this.maxJumpMeters = maxJumpMeters;
    this.onUpdate = onUpdate;
    this.walk = {
      id: createId(),
      routeId: route.id,
      startedAt: new Date().toISOString(),
      endedAt: null,
      activeTimeSeconds: 0,
      pausedTimeSeconds: 0,
      distanceMeters: 0,
      completedCheckpointIndex: -1,
      checkpointTimes: [],
      positions: []
    };
    this.isPaused = false;
    this.lastTick = Date.now();
    this.lastAcceptedPosition = null;
    this.watchId = null;
    this.timer = window.setInterval(() => this.tick(), 1000);
  }

  startLocationWatch({ onPermissionIssue = () => {} } = {}) {
    if (!("geolocation" in navigator)) {
      onPermissionIssue("GPS is not available in this browser. Time tracking will keep going.");
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (event) => {
        this.addPosition({
          lat: event.coords.latitude,
          lng: event.coords.longitude,
          accuracy: event.coords.accuracy,
          timestamp: new Date(event.timestamp).toISOString()
        });
      },
      () => onPermissionIssue("Location tracking is unavailable. You can still use manual checkpoints."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );
  }

  tick() {
    const now = Date.now();
    const deltaSeconds = Math.max(0, Math.round((now - this.lastTick) / 1000));
    this.lastTick = now;
    if (this.isPaused) this.walk.pausedTimeSeconds += deltaSeconds;
    else this.walk.activeTimeSeconds += deltaSeconds;
    this.onUpdate(this.walk);
  }

  pause() {
    this.isPaused = true;
    this.onUpdate(this.walk);
  }

  resume() {
    this.isPaused = false;
    this.lastTick = Date.now();
    this.onUpdate(this.walk);
  }

  addPosition(position) {
    if (this.isPaused) return;
    if (!shouldAcceptGpsUpdate(this.lastAcceptedPosition, position, this.maxJumpMeters)) return;
    if (this.lastAcceptedPosition) {
      this.walk.distanceMeters += haversineDistanceMeters(this.lastAcceptedPosition, position);
    }
    this.lastAcceptedPosition = position;
    this.walk.positions.push(position);
    this.tryAutoCheckpoint(position);
    this.onUpdate(this.walk);
  }

  tryAutoCheckpoint(position) {
    const detection = nextCheckpointDetection({
      position,
      checkpoints: this.route.checkpoints,
      completedCheckpointIndex: this.walk.completedCheckpointIndex,
      radiusMeters: this.radiusMeters
    });
    if (detection) this.completeCheckpoint("auto", detection.distanceMeters);
  }

  completeCheckpoint(method = "manual", distanceMeters = null) {
    const nextIndex = this.walk.completedCheckpointIndex + 1;
    const checkpoint = this.route.checkpoints[nextIndex];
    if (!checkpoint) return null;
    const previous = this.walk.checkpointTimes.at(-1);
    const timeFromPreviousSeconds = this.walk.activeTimeSeconds - (previous?.timeAtSeconds ?? 0);
    const entry = {
      checkpointIndex: nextIndex,
      checkpointName: checkpoint.name,
      timeAtSeconds: this.walk.activeTimeSeconds,
      timeFromPreviousSeconds,
      method,
      distanceMeters
    };
    this.walk.completedCheckpointIndex = nextIndex;
    this.walk.checkpointTimes.push(entry);
    this.onUpdate(this.walk);
    return entry;
  }

  stop() {
    window.clearInterval(this.timer);
    if (this.watchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.walk.endedAt = new Date().toISOString();
    return this.walk;
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `walk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
