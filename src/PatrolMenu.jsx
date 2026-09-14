import { useEffect, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { PATROL_METADATA_KEY } from "./extension/constants";
import { isPatrolPath } from "./extension/paths";
import "./PatrolMenu.css";

const DEFAULT_SPEED = 100; // scene units per second

export default function PatrolMenu() {
  const [ready, setReady] = useState(false);
  const [paths, setPaths] = useState([]);
  const [tokenIds, setTokenIds] = useState([]);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [status, setStatus] = useState("");

  useEffect(() => OBR.onReady(() => setReady(true)), []);

  useEffect(() => {
    if (!ready) return;

    async function load() {
      const selection = (await OBR.player.getSelection()) ?? [];
      setTokenIds(selection);
      setPaths(await OBR.scene.items.getItems(isPatrolPath));

      if (selection.length === 1) {
        const [token] = await OBR.scene.items.getItems(selection);
        const patrol = token?.metadata[PATROL_METADATA_KEY];
        if (patrol) {
          setSelectedPathId(patrol.pathId ?? "");
          setSpeed(patrol.speed ?? DEFAULT_SPEED);
        }
      }
    }

    load();
    return OBR.scene.items.onChange(load);
  }, [ready]);

  async function handleAssign() {
    if (!selectedPathId || tokenIds.length === 0) return;
    await OBR.scene.items.updateItems(tokenIds, (items) => {
      for (const item of items) {
        item.metadata[PATROL_METADATA_KEY] = { pathId: selectedPathId, speed };
      }
    });
    setStatus("Patrol assigned");
  }

  async function handleClear() {
    if (tokenIds.length === 0) return;
    await OBR.scene.items.updateItems(tokenIds, (items) => {
      for (const item of items) {
        delete item.metadata[PATROL_METADATA_KEY];
      }
    });
    setSelectedPathId("");
    setStatus("Patrol cleared");
  }

  if (!ready) return null;

  return (
    <div className="patrol-menu">
      {paths.length === 0 ? (
        <p className="patrol-menu__empty">
          Draw a patrol path with the Sentry tool first.
        </p>
      ) : (
        <>
          <label className="patrol-menu__field">
            Path
            <select
              value={selectedPathId}
              onChange={(event) => {
                setSelectedPathId(event.target.value);
                setStatus("");
              }}
            >
              <option value="" disabled>
                Select a path…
              </option>
              {paths.map((path, index) => (
                <option key={path.id} value={path.id}>
                  Path {index + 1}{" "}
                  {path.style.closed ? "(loop)" : "(back and forth)"}
                </option>
              ))}
            </select>
          </label>
          <label className="patrol-menu__field">
            Speed
            <input
              type="number"
              min="10"
              step="10"
              value={speed}
              onChange={(event) => {
                setSpeed(Number(event.target.value));
                setStatus("");
              }}
            />
          </label>
          <div className="patrol-menu__actions">
            <button type="button" onClick={handleClear}>
              Clear
            </button>
            <button
              type="button"
              className="primary"
              disabled={!selectedPathId}
              onClick={handleAssign}
            >
              Assign
            </button>
          </div>
          {status && <p className="patrol-menu__status">{status}</p>}
        </>
      )}
    </div>
  );
}
