# Paws & Paths

Paws & Paths is a clean, mobile-first dog walking gamification app. It uses a full-screen MapLibre map, local route creation, GPS walk tracking, checkpoint completion, and calm XP rewards for richer walks rather than faster ones.

## Run Locally

Open `index.html` directly in a browser, or serve the folder locally:

```bash
npx serve .
```

Then open the shown local URL. Internet access is needed for MapLibre assets, OpenStreetMap tiles, and Nominatim search.

Run tests with:

```bash
npm test
```

## File Structure

- `index.html` loads the app shell and MapLibre.
- `src/styles.css` contains the mobile-first app UI.
- `src/app.js` coordinates tabs, route creation, search, home base, and walk results.
- `src/map.js` owns MapLibre setup, markers, and GeoJSON route layers.
- `src/routing.js` fetches OpenStreetMap-based walking geometry for checkpoint-to-checkpoint route segments, with straight-line fallback.
- `src/storage.js` wraps localStorage persistence.
- `src/walkTracker.js` tracks active walks, pause time, GPS positions, and checkpoints.
- `src/audio.js` and `src/haptics.js` provide optional feedback for interactions and walk milestones.
- `src/geo.js`, `src/format.js`, and `src/scoring.js` contain pure reusable logic.
- `tests/pure-functions.test.js` covers distance, formatting, scoring, checkpoint detection, and invalid JSON fallback.

## localStorage Data

Routes are stored under `paws-paths:routes`:

```json
{
  "id": "string",
  "name": "Morning park loop",
  "checkpoints": [
    { "name": "Start", "lat": 53.48, "lng": -2.24 }
  ],
  "segmentGeometries": [
    [
      { "lat": 53.48, "lng": -2.24 },
      { "lat": 53.481, "lng": -2.241 }
    ]
  ],
  "createdAt": "ISOString"
}
```

Walks are stored under `paws-paths:walks`:

```json
{
  "id": "string",
  "routeId": "string",
  "startedAt": "ISOString",
  "endedAt": "ISOString",
  "activeTimeSeconds": 0,
  "pausedTimeSeconds": 0,
  "distanceMeters": 0,
  "completedCheckpointIndex": -1,
  "checkpointTimes": [],
  "positions": []
}
```

Home base is stored under `paws-paths:home-base`, and total XP is stored under `paws-paths:xp`.

Preferences are stored under `paws-paths:settings`:

```json
{
  "audioEnabled": true,
  "hapticsEnabled": true
}
```

The Settings tab can erase walk history, routes, home base, XP, preferences, or everything.

## Checkpoint Radius

Automatic checkpoint detection checks only the next incomplete checkpoint. By default, a checkpoint completes when the current GPS position is within `35` metres. This keeps one GPS update from completing a whole route unless the walker is genuinely near the next checkpoint.

When the final checkpoint is completed, the active walk ends automatically and the results screen opens.

Completed checkpoint segments are highlighted on the map, and checkpoint markers change style once completed. When GPS is available, the live user marker updates during the walk.

## Routed Paths

When saving a route, the app asks an OpenStreetMap-based routing service for walking geometry between each pair of checkpoints. This lets saved routes follow roads and paths rather than drawing only straight lines. If routing is unavailable, the app still saves the route and falls back to straight checkpoint-to-checkpoint lines.

## Home Loop Routes

Route creation includes a Home loop toggle once a home base has been set. Home loop routes add a `Home start` checkpoint, then the user-created stops, then a `Home finish` checkpoint at the saved home base. This is useful for walks that should begin and end at home after visiting one or more checkpoints.

## Audio Feedback

The app uses the browser Web Audio API for small interaction sounds, checkpoint chimes, and walk-completion fanfare. Browsers require a user gesture before audio can play, so sounds unlock after the first button press.

## Haptics

The app uses `navigator.vibrate` where available. Checkpoint completion uses a small vibration pattern, and walk completion uses a stronger pattern. Unsupported devices simply ignore these calls.

## Browser GPS Limitations

Browser GPS depends on device hardware, browser permissions, HTTPS or localhost rules, and local signal quality. If permission is denied or GPS is unavailable, the app keeps active and paused time running and offers a manual checkpoint button as a backup. GPS jumps over `80` metres between updates are ignored by default to reduce noisy distance totals.
