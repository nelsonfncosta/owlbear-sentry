import { isCurve } from "@owlbear-rodeo/sdk";
import { PATH_METADATA_KEY } from "./constants";

// Identifies scene items that were created as Sentry patrol paths.
export function isPatrolPath(item) {
  return isCurve(item) && Boolean(item.metadata[PATH_METADATA_KEY]);
}
