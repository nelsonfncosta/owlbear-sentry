import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PatrolControl from "./PatrolControl.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PatrolControl />
  </StrictMode>,
);
