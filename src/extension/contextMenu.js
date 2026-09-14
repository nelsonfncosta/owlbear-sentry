import OBR from "@owlbear-rodeo/sdk";
import { PATROL_CONTEXT_MENU_ID } from "./constants";

// Adds a "Patrol" entry to the context menu of selected tokens.
// The click handler will be wired up to assign a patrol path separately.
export function registerContextMenu() {
  OBR.contextMenu.create({
    id: PATROL_CONTEXT_MENU_ID,
    icons: [
      {
        icon: "/icons/patrol.svg",
        label: "Patrol",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }],
          max: 1,
        },
      },
    ],
    onClick() {
      // TODO: open patrol path assignment UI
    },
  });
}
