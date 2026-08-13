import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "static-src",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-static",
    emptyOutDir: true,
  },
});
