import OBR from "@owlbear-rodeo/sdk";
import { ID, PATROL_CONTEXT_MENU_ID } from "./constants";

const POPOVER_ID = `${ID}/patrol-menu`;

// Adds a "Patrol" entry to the context menu of selected tokens.
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
    onClick(_, elementId) {
      OBR.popover.open({
        id: POPOVER_ID,
        url: "/patrol-menu.html",
        width: 280,
        height: 260,
        anchorElementId: elementId,
        anchorOrigin: {
          horizontal: "CENTER",
          vertical: "BOTTOM",
        },
        transformOrigin: {
          horizontal: "CENTER",
          vertical: "TOP",
        },
      });
    },
  });
}
