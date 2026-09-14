import OBR from "@owlbear-rodeo/sdk";
import { PATROL_METADATA_KEY } from "./constants";
import { isPatrolPath } from "./paths";

// Interactions are local-first; network sync is throttled internally by the SDK regardless
// of how often we call update(), so a short local interval gives smooth motion without
// adding network traffic. (requestAnimationFrame won't work here - this runs on the hidden
// background page, which never paints, so rAF callbacks are throttled/suspended by the browser.)
const TICK_MS = 33;

// Interactions expire after 30s; restart a bit before that to keep patrols going.
const INTERACTION_LIFESPAN_MS = 20000;

// Per-token progress along its assigned path: distance travelled and direction (+1/-1).
const progress = new Map();

// Per-token live interaction used to move it without repeatedly calling updateItems.
const interactions = new Map();

// Token IDs currently (re)starting an interaction, to avoid piling up duplicate requests.
const refreshing = new Set();

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segmentLengths(points) {
  const lengths = [];
  for (let i = 0; i < points.length - 1; i++) {
    lengths.push(distance(points[i], points[i + 1]));
  }
  return lengths;
}

// Walk `dist` units along a polyline, returning the resulting point.
function pointAtDistance(points, lengths, dist) {
  let remaining = dist;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const t = lengths[i] === 0 ? 0 : Math.min(1, remaining / lengths[i]);
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}

// Advances one token's progress along its path and returns its new position.
function advance(tokenId, path, speed, dtSeconds) {
  const points = path.points;
  if (points.length < 2) return null;

  const lengths = segmentLengths(points);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return null;

  const state = progress.get(tokenId) ?? { distance: 0, direction: 1 };
  let dist = state.distance + speed * dtSeconds * state.direction;

  if (path.style.closed) {
    // Loop back around to the start.
    dist = ((dist % total) + total) % total;
  } else if (dist >= total) {
    // Bounce back at the ends for a back-and-forth patrol.
    dist = total;
    state.direction = -1;
  } else if (dist <= 0) {
    dist = 0;
    state.direction = 1;
  }

  state.distance = dist;
  progress.set(tokenId, state);
  return pointAtDistance(points, lengths, dist);
}

function stopInteraction(tokenId) {
  const entry = interactions.get(tokenId);
  if (!entry) return;
  interactions.delete(tokenId);
  entry.stop();
}

// (Re)starts the interaction used to move a token, overlapping it with any previous one so
// there's no gap without an active stream, and seeding it from our own last known position
// instead of re-fetching (which can be a step behind, causing a visible jump on restart).
async function refreshInteraction(tokenId) {
  if (refreshing.has(tokenId)) return;
  refreshing.add(tokenId);
  try {
    const previous = interactions.get(tokenId);
    let baseItem = previous?.item;
    if (!baseItem) {
      [baseItem] = await OBR.scene.items.getItems([tokenId]);
    }
    if (!baseItem) return;

    const [update, stop] = await OBR.interaction.startItemInteraction(baseItem);
    interactions.set(tokenId, {
      update,
      stop,
      startedAt: performance.now(),
      item: baseItem,
    });
    previous?.stop();
  } finally {
    refreshing.delete(tokenId);
  }
}

// Cache of paths/patrol tokens, kept in sync via onChange instead of polling with getItems.
let pathsById = new Map();
let patrolTokens = new Map();

function refreshTargets(items) {
  const nextPaths = new Map();
  const nextTokens = new Map();
  for (const item of items) {
    if (isPatrolPath(item)) {
      nextPaths.set(item.id, item);
      continue;
    }
    const patrol = item.metadata[PATROL_METADATA_KEY];
    if (patrol) nextTokens.set(item.id, patrol);
  }
  pathsById = nextPaths;

  for (const tokenId of patrolTokens.keys()) {
    if (!nextTokens.has(tokenId)) {
      progress.delete(tokenId);
      stopInteraction(tokenId);
    }
  }
  patrolTokens = nextTokens;
}

let intervalId = null;
let lastTick = 0;
let tickInFlight = false;

async function tick() {
  // setInterval doesn't wait for a previous async tick to finish; skip if one is still running
  // to avoid piling up duplicate interaction restarts against the realtime connection.
  if (tickInFlight) return;
  tickInFlight = true;
  try {
    const now = performance.now();
    const dtSeconds = lastTick ? (now - lastTick) / 1000 : 0;
    lastTick = now;

    for (const [tokenId, patrol] of patrolTokens) {
      const path = pathsById.get(patrol?.pathId);
      const speed = typeof patrol?.speed === "number" ? patrol.speed : 0;
      if (!path || speed <= 0) continue;

      const position = advance(tokenId, path, speed, dtSeconds);
      if (!position) continue;

      let entry = interactions.get(tokenId);
      if (!entry || now - entry.startedAt > INTERACTION_LIFESPAN_MS) {
        await refreshInteraction(tokenId);
        entry = interactions.get(tokenId);
      }
      if (entry) {
        entry.update((draft) => {
          draft.position = position;
        });
        // Keep our local copy fresh so the next restart seeds from the right spot.
        entry.item = { ...entry.item, position };
      }
    }
  } finally {
    tickInFlight = false;
  }
}

function startLoop() {
  if (intervalId !== null) return;
  lastTick = 0;
  tickInFlight = false;
  intervalId = window.setInterval(() => {
    tick().catch((error) => console.error("Sentry patrol tick failed", error));
  }, TICK_MS);
}

function stopLoop() {
  if (intervalId === null) return;
  window.clearInterval(intervalId);
  intervalId = null;
  progress.clear();
  for (const tokenId of interactions.keys()) {
    stopInteraction(tokenId);
  }
  patrolTokens = new Map();
  pathsById = new Map();
}

let unsubscribeItems = null;

// Only one client should drive patrol movement; the GM is the natural authority.
// NOTE: with multiple GMs connected each would run its own loop independently,
// which can cause jittery double-updates - fine for now, worth revisiting later.
export function registerPatrolEngine() {
  async function syncLoopToRole() {
    const [role, sceneReady] = await Promise.all([
      OBR.player.getRole(),
      OBR.scene.isReady(),
    ]);
    if (role === "GM" && sceneReady) {
      if (!unsubscribeItems) {
        refreshTargets(await OBR.scene.items.getItems());
        unsubscribeItems = OBR.scene.items.onChange(refreshTargets);
      }
      startLoop();
    } else {
      stopLoop();
      unsubscribeItems?.();
      unsubscribeItems = null;
    }
  }

  OBR.player.onChange(() => {
    syncLoopToRole();
  });
  OBR.scene.onReadyChange(() => {
    syncLoopToRole();
  });
  syncLoopToRole();
}
