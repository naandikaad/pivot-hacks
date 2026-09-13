import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the build works from any subpath (e.g. GitHub Pages
  // project sites serve from /<repo-name>/, not /) with no coordination
  // needed between this config and the deploy workflow.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
