import OBR from "@owlbear-rodeo/sdk";
import { PATROL_CONTEXT_MENU_ID } from "./constants";

const baseUrl = import.meta.env.BASE_URL;

// Adds a "Patrol" entry to the context menu of selected tokens.
export function registerContextMenu() {
  OBR.contextMenu.create({
    id: PATROL_CONTEXT_MENU_ID,
    embed: {
      url: `${baseUrl}patrol-control.html`,
      height: 128,
    },
    icons: [
      {
        icon: `${baseUrl}icons/patrol.svg`,
        label: "Patrol",
        filter: {
          every: [{ key: "layer", value: "CHARACTER" }],
          max: 1,
        },
      },
    ],
    onClick() {},
  });
}
