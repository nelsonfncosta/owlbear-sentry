import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Vite disables CORS by default since v6.0.9; Owlbear Rodeo needs access to the dev server.
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
});
