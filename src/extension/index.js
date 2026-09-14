import OBR from "@owlbear-rodeo/sdk";
import { registerContextMenu } from "./contextMenu";
import { registerPatrolEngine } from "./patrol";
import { registerDrawMode, registerTool } from "./tool";

// Sets up all Owlbear Rodeo integrations once the SDK is ready.
export function setupExtension() {
  OBR.onReady(() => {
    registerTool();
    registerDrawMode();
    registerContextMenu();
    registerPatrolEngine();
  });
}
