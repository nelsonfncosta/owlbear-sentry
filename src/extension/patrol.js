import OBR from "@owlbear-rodeo/sdk";
import { PATROL_METADATA_KEY } from "./constants";
import { isPatrolPath } from "./paths";

// Local simulation runs fast for accurate progress tracking. The authoritative network write is
// throttled below that to stay under the room's rate limit - since all patrolling tokens are
// batched into a single updateItems call per write, this rate doesn't scale with token count.
// An OBR.interaction is layered on top purely to smooth the visuals between those writes; if its
// periodic restart ever hitches, the authoritative writes underneath still keep tokens moving.
const SIMULATE_MS = 50;
const WRITE_MS = 200;

// Interactions expire after 30s; restart well before that so the restart round trip (getItems +
// startItemInteraction) has time to finish even under network delay - if it doesn't finish before
// 30s, the SDK force-closes the interaction ("Interaction lasted too long") before our swap lands.
const INTERACTION_LIFESPAN_MS = 12000;

// Per-token progress along its assigned path: distance travelled and direction (+1/-1).
const progress = new Map();

// Per-token live interaction used to smooth movement between the authoritative writes.
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

// Advances one token's progress along its path (mutates the shared progress map).
function advance(tokenId, path, speed, dtSeconds) {
  const points = path.points;
  if (points.length < 2) return;

  const lengths = segmentLengths(points);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 0) return;

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
}

// Computes a token's current position from its tracked progress.
function currentPosition(tokenId, path) {
  const state = progress.get(tokenId);
  if (!state) return null;
  const lengths = segmentLengths(path.points);
  const point = pointAtDistance(path.points, lengths, state.distance);
  return {
    x: point.x + path.position.x,
    y: point.y + path.position.y,
  };
}

function stopInteraction(tokenId) {
  const entry = interactions.get(tokenId);
  if (!entry) return;
  interactions.delete(tokenId);
  entry.stop();
}

// Starts (or restarts) the interaction used to smooth a token's movement, always seeded from
// our own local simulation - the single source of truth - rather than any interaction-tracked
// state. Runs in the background (not awaited by the simulate loop); the authoritative writes
// keep the token moving correctly regardless of how long this takes.
async function ensureInteraction(tokenId, path) {
  if (refreshing.has(tokenId)) return;
  refreshing.add(tokenId);
  try {
    const previous = interactions.get(tokenId);
    const [item] = await OBR.scene.items.getItems([tokenId]);
    if (!item) return;

    const position = currentPosition(tokenId, path) ?? item.position;
    const [update, stop] = await OBR.interaction.startItemInteraction({
      ...item,
      position,
    });
    interactions.set(tokenId, { update, stop, startedAt: performance.now() });
    previous?.stop();
  } catch (error) {
    console.error("Sentry patrol interaction (re)start failed", error);
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
    if (patrol) {
      const previousPatrol = patrolTokens.get(item.id);
      if (previousPatrol?.pathId !== patrol.pathId) {
        progress.delete(item.id);
        stopInteraction(item.id);
      }
      nextTokens.set(item.id, patrol);
    }
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

let simulateIntervalId = null;
let writeIntervalId = null;
let lastSimulate = 0;
let writing = false;

function simulate() {
  const now = performance.now();
  const dtSeconds = lastSimulate ? (now - lastSimulate) / 1000 : 0;
  lastSimulate = now;

  for (const [tokenId, patrol] of patrolTokens) {
    const path = pathsById.get(patrol?.pathId);
    const speed = typeof patrol?.speed === "number" ? patrol.speed : 0;
    if (!path || speed <= 0) continue;
    if (patrol.paused) {
      stopInteraction(tokenId);
      continue;
    }
    advance(tokenId, path, speed, dtSeconds);

    const position = currentPosition(tokenId, path);
    if (!position) continue;

    const entry = interactions.get(tokenId);
    if (entry) {
      entry.update((draft) => {
        draft.position = position;
      });
      if (now - entry.startedAt > INTERACTION_LIFESPAN_MS) {
        ensureInteraction(tokenId, path);
      }
    } else {
      ensureInteraction(tokenId, path);
    }
  }
}

async function writePositions() {
  // A previous write may still be in flight; skip this round rather than overlapping it.
  if (writing) return;
  writing = true;
  try {
    const updates = new Map();
    for (const [tokenId, patrol] of patrolTokens) {
      const path = pathsById.get(patrol?.pathId);
      if (!path || patrol.paused) continue;
      const position = currentPosition(tokenId, path);
      if (position) updates.set(tokenId, position);
    }
    if (updates.size === 0) return;

    await OBR.scene.items.updateItems([...updates.keys()], (items) => {
      for (const item of items) {
        item.position = updates.get(item.id);
      }
    });
  } catch (error) {
    console.error("Sentry patrol write failed", error);
  } finally {
    writing = false;
  }
}

function startLoop() {
  if (simulateIntervalId !== null) return;
  lastSimulate = 0;
  simulateIntervalId = window.setInterval(simulate, SIMULATE_MS);
  writeIntervalId = window.setInterval(() => {
    writePositions();
  }, WRITE_MS);
}

function stopLoop() {
  if (simulateIntervalId === null) return;
  window.clearInterval(simulateIntervalId);
  window.clearInterval(writeIntervalId);
  simulateIntervalId = null;
  writeIntervalId = null;
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
