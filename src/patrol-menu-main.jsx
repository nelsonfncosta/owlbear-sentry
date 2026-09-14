import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import PatrolMenu from "./PatrolMenu.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PatrolMenu />
  </StrictMode>,
);
