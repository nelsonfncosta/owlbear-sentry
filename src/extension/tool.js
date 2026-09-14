import OBR from "@owlbear-rodeo/sdk";
import { DRAW_MODE_ID, TOOL_ID } from "./constants";

// Registers the Sentry tool in the toolbar.
export function registerTool() {
  OBR.tool.create({
    id: TOOL_ID,
    icons: [
      {
        icon: "/icons/patrol.svg",
        label: "Sentry",
      },
    ],
    defaultMode: DRAW_MODE_ID,
  });
}

// Registers the mode used to draw a patrol path on the scene.
// Path drawing/point collection logic will be implemented separately.
export function registerDrawMode() {
  OBR.tool.createMode({
    id: DRAW_MODE_ID,
    icons: [
      {
        icon: "/icons/patrol.svg",
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
  });
}
