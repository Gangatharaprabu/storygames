import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works on any host path and inside Capacitor later.
  base: "./",
});
