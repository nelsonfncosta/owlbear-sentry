# Sentry

An [Owlbear Rodeo](https://www.owlbear.rodeo/) extension that lets a GM draw a patrol
path on the map and assign a token to automatically walk it - back and forth, or in a
loop if the path is closed.

## Development

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Pushes to `main` deploy through
[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

1. In the GitHub repository, open `Settings -> Pages`.
2. Under Build and deployment, select `GitHub Actions`.
3. Push to `main`, or run the workflow manually.
4. Install the resulting Owlbear Rodeo manifest URL:

`https://<your-github-username>.github.io/owlbear-sentry/manifest.json`

## How it works

- **Drawing a path** ([src/extension/drawPath.js](./src/extension/drawPath.js)): the
  `Sentry` toolbar tool lets you freehand-draw a path. It's saved as a `CURVE` scene
  item tagged with metadata so it can be found later, and auto-closes into a loop if you
  release near where you started.
- **Assigning a patrol** ([src/PatrolControl.jsx](./src/PatrolControl.jsx)): right-click a
  token, choose `Patrol`, and a popover lets you pick one of the drawn paths and a speed.
  This is stored in the token's own metadata (`pathId`, `speed`).
- **Moving the token** ([src/extension/patrol.js](./src/extension/patrol.js)): see below.

### Patrol movement - a hybrid approach

Moving a token smoothly and continuously, for every connected player, without tripping
Owlbear's realtime rate limits, isn't fully possible with a single mechanism - the
`OBR.interaction` API's 30s time limit means truly continuous smooth movement isn't
achievable on its own, so this uses a hybrid of two mechanisms instead.

**How `OBR.interaction` works:** it's a local-first, high-frequency update channel -
`update()` calls apply instantly on your own screen and get sampled/broadcast to other
clients at a lower, throttled frequency (handled internally by the SDK), with receivers
interpolating between snapshots for smooth motion. The catch: an interaction **expires
after 30 seconds**, so anything meant to move indefinitely (like a patrol) has to
periodically stop one interaction and start a new one.

**Why that's the tricky part:** starting a brand-new interaction is itself a network
round-trip. No matter how the local `stop()`/`update()` calls are ordered, there's an
unavoidable moment where the receiving client has nothing fresh to interpolate toward,
causing a visible stutter.

**The workaround - treat the interaction as decoration, not the source of truth:**

- `simulate()` (every 50ms) computes each token's correct position along its path from
  pure math (distance/speed/elapsed time) - independent of any network mechanism. This
  is the single source of truth.
- `writePositions()` (every 200ms) is the **authoritative** channel: a plain
  `OBR.scene.items.updateItems()` write, batched for all patrolling tokens in one call.
  This is what actually keeps tokens moving correctly (and what fog of war/vision relies
  on), and it doesn't scale with token count since it's one request regardless of how
  many tokens are patrolling.
- `ensureInteraction()` layers an interaction on top of that, always re-seeded from the
  same `currentPosition()` truth (not from whatever the interaction itself last knew),
  purely to make the visuals glide between those 200ms writes instead of stepping.

**The safety net:** if the interaction's ~20s restart still hitches, it can't break
anything - the authoritative writes underneath are running independently and keep tokens
moving correctly regardless. Worst case, movement locally looks like plain stepped
updates during that moment; best case, it's smooth the rest of the time.

Only the GM's client drives this loop (checked via `OBR.player.getRole()`), to avoid
multiple clients writing conflicting positions.
