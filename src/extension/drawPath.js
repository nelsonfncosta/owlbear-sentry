import OBR, { buildCurve } from "@owlbear-rodeo/sdk";
import { PATH_METADATA_KEY, PATROL_METADATA_KEY } from "./constants";

const PATH_STYLE = {
  strokeColor: "#f8b400",
  strokeWidth: 4,
  strokeDash: [12, 8],
};

// Minimum distance in pixels between recorded points while drawing freehand.
const MIN_POINT_DISTANCE = 10;

// If the path is released within this distance of its start point, snap it closed into a loop.
const CLOSE_DISTANCE = 40;

function buildPatrolCurve(points, closed = false) {
  return buildCurve()
    .points(points)
    .strokeColor(PATH_STYLE.strokeColor)
    .strokeWidth(PATH_STYLE.strokeWidth)
    .strokeDash(PATH_STYLE.strokeDash)
    .fillOpacity(0)
    .tension(0.3)
    .closed(closed)
    .layer("DRAWING")
    .name("Patrol Path")
    .visible(false)
    .metadata({ [PATH_METADATA_KEY]: true })
    .build();
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Snap the end point onto the start point if the user released near where they began.
function finalizePoints(points) {
  const start = points[0];
  const end = points[points.length - 1];
  if (points.length > 2 && distance(start, end) <= CLOSE_DISTANCE) {
    return { points: [...points.slice(0, -1), start], closed: true };
  }
  return { points, closed: false };
}

// Tracks the in-progress path while the pointer is dragged.
let drawing = null;

function syncInteraction() {
  if (!drawing?.interaction) return;
  const [update] = drawing.interaction;
  update((curve) => {
    curve.points = [...drawing.points];
  });
}

function cancelDrawing() {
  if (!drawing) return;
  drawing.interaction?.[1]();
  drawing = null;
}

export const drawPathHandlers = {
  onToolDown(_, event) {
    const target = event.target;
    if (target) {
      OBR.scene.items.updateItems([target.id], (items) => {
        for (const item of items) {
          const patrol = item.metadata[PATROL_METADATA_KEY];
          if (patrol)
            item.metadata[PATROL_METADATA_KEY] = { ...patrol, paused: true };
        }
      });
    }
  },
  async onToolDragStart(_, event) {
    drawing = { points: [event.pointerPosition], interaction: null };
    const interaction = await OBR.interaction.startItemInteraction(
      buildPatrolCurve(drawing.points),
    );
    // Drawing may already have finished/cancelled before the interaction resolved.
    if (!drawing) {
      interaction[1]();
      return;
    }
    drawing.interaction = interaction;
  },
  onToolDragMove(_, event) {
    if (!drawing) return;
    const last = drawing.points[drawing.points.length - 1];
    if (distance(last, event.pointerPosition) < MIN_POINT_DISTANCE) return;
    drawing.points.push(event.pointerPosition);
    syncInteraction();
  },
  onToolDragEnd(_, event) {
    if (!drawing) return;
    const rawPoints = [...drawing.points, event.pointerPosition];
    drawing.interaction?.[1]();
    drawing = null;

    // Need at least a start and an end point to make a usable patrol path.
    if (rawPoints.length < 2) return;
    const { points, closed } = finalizePoints(rawPoints);
    OBR.scene.items.addItems([buildPatrolCurve(points, closed)]);
  },
  onToolDragCancel: cancelDrawing,
  onDeactivate: cancelDrawing,
};
