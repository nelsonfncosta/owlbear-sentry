import { useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { PATROL_METADATA_KEY } from "./extension/constants";
import { isPatrolPath } from "./extension/paths";
import "./PatrolControl.css";

const DEFAULT_SPEED = 100;

export default function PatrolControl() {
  const [token, setToken] = useState();
  const [paths, setPaths] = useState([]);
  const [pathId, setPathId] = useState("");
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [theme, setTheme] = useState();
  const initializedTokenId = useRef();

  useEffect(() => {
    let unsubscribeItems = () => {};
    let unsubscribeTheme = () => {};

    async function refresh(items) {
      const selection = (await OBR.player.getSelection()) ?? [];
      const [selectedToken] = await OBR.scene.items.getItems(selection);
      setToken(selectedToken);
      setPaths(
        (items ?? (await OBR.scene.items.getItems())).filter(isPatrolPath),
      );

      const patrol = selectedToken?.metadata[PATROL_METADATA_KEY];
      if (selectedToken?.id !== initializedTokenId.current) {
        initializedTokenId.current = selectedToken?.id;
        setPathId(patrol?.pathId ?? "");
        setSpeed(patrol?.speed ?? DEFAULT_SPEED);
      }
    }

    OBR.onReady(() => {
      refresh();
      unsubscribeItems = OBR.scene.items.onChange(refresh);
      OBR.theme.getTheme().then(setTheme);
      unsubscribeTheme = OBR.theme.onChange(setTheme);
    });

    return () => {
      unsubscribeItems();
      unsubscribeTheme();
    };
  }, []);

  async function assignPatrol() {
    if (!token || !pathId) return;
    await OBR.scene.items.updateItems([token.id], (items) => {
      for (const item of items) {
        item.metadata[PATROL_METADATA_KEY] = { pathId, speed, paused: false };
      }
    });
  }

  async function togglePause() {
    if (!token) return;
    await OBR.scene.items.updateItems([token.id], (items) => {
      for (const item of items) {
        const patrol = item.metadata[PATROL_METADATA_KEY];
        if (patrol)
          item.metadata[PATROL_METADATA_KEY] = {
            ...patrol,
            paused: !patrol.paused,
          };
      }
    });
  }

  async function stopPatrol() {
    if (!token) return;
    await OBR.scene.items.updateItems([token.id], (items) => {
      for (const item of items) {
        delete item.metadata[PATROL_METADATA_KEY];
      }
    });
  }

  const patrol = token?.metadata[PATROL_METADATA_KEY];
  const style = theme
    ? {
        "--option-background": theme.background.paper,
        "--option-text": theme.text.primary,
        "--primary": theme.primary.main,
        "--primary-text": theme.primary.contrastText,
        colorScheme: theme.mode === "DARK" ? "dark" : "light",
      }
    : undefined;

  return (
    <div className="patrol-control" style={style}>
      <label>
        Path
        <select
          value={pathId}
          onChange={(event) => setPathId(event.target.value)}
        >
          <option value="" disabled>
            Select a path
          </option>
          {paths.map((path, index) => (
            <option key={path.id} value={path.id}>
              {path.name || `Path ${index + 1}`}{" "}
              {path.style.closed ? "(loop)" : "(back and forth)"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Speed
        <input
          type="number"
          min="10"
          step="10"
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
      </label>
      <div className="patrol-control__actions">
        {patrol && (
          <button type="button" onClick={togglePause}>
            {patrol.paused ? "Resume" : "Pause"}
          </button>
        )}
        {patrol && (
          <button type="button" className="danger" onClick={stopPatrol}>
            Stop
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={!pathId}
          onClick={assignPatrol}
        >
          Assign
        </button>
      </div>
    </div>
  );
}
