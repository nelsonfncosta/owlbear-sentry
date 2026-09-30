import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PatrolDashboard from "./PatrolDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PatrolDashboard />
  </StrictMode>,
);
