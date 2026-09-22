import OBR from "@owlbear-rodeo/sdk";
import { DRAW_MODE_ID, TOOL_ID } from "./constants";
import { drawPathHandlers } from "./drawPath";

const baseUrl = import.meta.env.BASE_URL;

// Registers the Sentry tool in the toolbar.
export function registerTool() {
  OBR.tool.create({
    id: TOOL_ID,
    icons: [
      {
        icon: `${baseUrl}icons/patrol.svg`,
        label: "Sentry",
      },
    ],
    defaultMode: DRAW_MODE_ID,
  });
}

// Registers the mode used to draw a patrol path on the scene.
// Click and drag to draw freehand, release to finish, Escape to cancel.
export function registerDrawMode() {
  OBR.tool.createMode({
    id: DRAW_MODE_ID,
    icons: [
      {
        icon: `${baseUrl}icons/patrol.svg`,
        label: "Draw Patrol Path",
        filter: {
          activeTools: [TOOL_ID],
        },
      },
    ],
    cursors: [
      {
        cursor: "crosshair",
      },
    ],
    ...drawPathHandlers,
  });
}
