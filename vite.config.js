import react from "@vitejs/plugin-react";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const dirname = fileURLToPath(new URL(".", import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [react()],
  // Vite disables CORS by default since v6.0.9; Owlbear Rodeo needs access to the dev server.
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
  build: {
    rollupOptions: {
      // Each extension popover/embed is served from its own html entry point.
      input: {
        main: `${dirname}index.html`,
        patrolControl: `${dirname}patrol-control.html`,
      },
    },
  },
});
