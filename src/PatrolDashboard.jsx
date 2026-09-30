import { useEffect, useRef, useState } from "react";
import OBR from "@owlbear-rodeo/sdk";
import { PATROL_METADATA_KEY } from "./extension/constants";
import { isPatrolPath } from "./extension/paths";
import "./PatrolDashboard.css";

function mapPatrols(items) {
  const paths = new Map(
    items.filter(isPatrolPath).map((path) => [path.id, path]),
  );

  return items.flatMap((item) => {
    const patrol = item.metadata[PATROL_METADATA_KEY];
    if (!patrol) return [];

    return [
      {
        id: item.id,
        name: item.name || "Unnamed token",
        pathName: paths.get(patrol.pathId)?.name || "Missing path",
        speed: patrol.speed,
        paused: Boolean(patrol.paused),
      },
    ];
  });
}

export default function PatrolDashboard() {
  const panelRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hasScene, setHasScene] = useState(true);
  const [patrols, setPatrols] = useState([]);

  useEffect(() => {
    let unsubscribeItems = () => {};
    let unsubscribeReady = () => {};

    async function refresh() {
      try {
        const items = await OBR.scene.items.getItems();

        setHasScene(true);
        setPatrols(mapPatrols(items));
      } catch {
        setHasScene(false);
        setPatrols([]);
      }
    }

    OBR.onReady(() => {
      setReady(true);
      refresh();
      unsubscribeItems = OBR.scene.items.onChange((items) => {
        setHasScene(true);
        setPatrols(mapPatrols(items));
      });
      unsubscribeReady = OBR.scene.onReadyChange(refresh);
    });

    return () => {
      unsubscribeItems();
      unsubscribeReady();
    };
  }, []);

  useEffect(() => {
    if (!ready || !panelRef.current) return;
    const panel = panelRef.current;
    const resize = () =>
      OBR.action.setHeight(Math.max(120, Math.ceil(panel.scrollHeight)));
    const observer = new ResizeObserver(resize);
    observer.observe(panel);
    resize();
    return () => observer.disconnect();
  }, [ready, patrols]);

  async function togglePause(patrol) {
    await OBR.scene.items.updateItems([patrol.id], (items) => {
      for (const item of items) {
        const metadata = item.metadata[PATROL_METADATA_KEY];
        if (metadata) {
          item.metadata[PATROL_METADATA_KEY] = {
            ...metadata,
            paused: !metadata.paused,
          };
        }
      }
    });
  }

  async function stopPatrol(id) {
    await OBR.scene.items.updateItems([id], (items) => {
      for (const item of items) delete item.metadata[PATROL_METADATA_KEY];
    });
  }

  return (
    <main ref={panelRef} className="patrol-dashboard">
      <header>
        <strong>Active Patrols</strong>
        <span>{patrols.length}</span>
      </header>
      {!ready && <p>Connecting to Owlbear...</p>}
      {ready && !hasScene && <p>Open a scene to view patrols.</p>}
      {ready && hasScene && patrols.length === 0 && <p>No patrols assigned.</p>}
      {patrols.length > 0 && (
        <ul>
          {patrols.map((patrol) => (
            <li key={patrol.id}>
              <div className="patrol-dashboard__details">
                <strong>{patrol.name}</strong>
                <span>
                  {patrol.pathName} · Speed {patrol.speed}
                </span>
              </div>
              <button type="button" onClick={() => togglePause(patrol)}>
                {patrol.paused ? "Resume" : "Pause"}
              </button>
              <button
                className="danger"
                type="button"
                onClick={() => stopPatrol(patrol.id)}
              >
                Stop
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
