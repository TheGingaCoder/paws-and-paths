import assert from "node:assert/strict";
import test from "node:test";
import { formatDistance, formatDuration } from "../src/format.js";
import { haversineDistanceMeters, nextCheckpointDetection } from "../src/geo.js";
import { buildRouteCheckpoints } from "../src/routes.js";
import { scoreWalk } from "../src/scoring.js";
import { eraseStoredData, loadJson, loadSettings } from "../src/storage.js";

test("Haversine distance returns positive distance", () => {
  const distance = haversineDistanceMeters(
    { lat: 53.4808, lng: -2.2426 },
    { lat: 53.483, lng: -2.244 }
  );
  assert.ok(distance > 0);
});

test("Time formatting", () => {
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3665), "1:01:05");
});

test("Distance formatting", () => {
  assert.equal(formatDistance(425), "425 m");
  assert.equal(formatDistance(1234), "1.23 km");
});

test("XP scoring rewards longer walks over shorter walks on the same route", () => {
  const route = { checkpoints: [{}, {}] };
  const previous = { activeTimeSeconds: 900 };
  const shorter = {
    activeTimeSeconds: 700,
    distanceMeters: 1200,
    completedCheckpointIndex: 1
  };
  const longer = {
    activeTimeSeconds: 1500,
    distanceMeters: 1200,
    completedCheckpointIndex: 1
  };
  assert.ok(scoreWalk(longer, route, previous).xp > scoreWalk(shorter, route, previous).xp);
});

test("Automatic checkpoint detection triggers when inside 35m", () => {
  const result = nextCheckpointDetection({
    position: { lat: 53.4808, lng: -2.2426 },
    checkpoints: [{ name: "Start", lat: 53.48081, lng: -2.24261 }],
    completedCheckpointIndex: -1,
    radiusMeters: 35
  });
  assert.equal(result.checkpointIndex, 0);
});

test("Automatic checkpoint detection does not trigger when outside 35m", () => {
  const result = nextCheckpointDetection({
    position: { lat: 53.4808, lng: -2.2426 },
    checkpoints: [{ name: "Start", lat: 53.4908, lng: -2.2426 }],
    completedCheckpointIndex: -1,
    radiusMeters: 35
  });
  assert.equal(result, null);
});

test("localStorage load fallback works with invalid JSON", () => {
  const storage = { getItem: () => "{broken" };
  assert.deepEqual(loadJson("anything", [] , storage), []);
});

test("cyclic route starts and ends at home base", () => {
  const homeBase = { lat: 53.48, lng: -2.24 };
  const checkpoints = buildRouteCheckpoints({
    cyclic: true,
    homeBase,
    draftCheckpoints: [{ name: "Park", lat: 53.49, lng: -2.25 }]
  });
  assert.equal(checkpoints[0].name, "Home start");
  assert.equal(checkpoints.at(-1).name, "Home finish");
  assert.equal(checkpoints.length, 3);
});

test("settings load fallback includes audio and haptics defaults", () => {
  const storage = { getItem: () => null };
  assert.deepEqual(loadSettings(storage), { audioEnabled: true, hapticsEnabled: true });
});

test("eraseStoredData clears selected storage key", () => {
  const removed = [];
  const storage = { removeItem: (key) => removed.push(key) };
  eraseStoredData("walks", storage);
  assert.deepEqual(removed, ["paws-paths:walks"]);
});
