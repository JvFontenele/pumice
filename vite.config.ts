import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "app",
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve("node_modules/react"),
      "react-dom": path.resolve("node_modules/react-dom"),
      "@tauri-apps/api": path.resolve("node_modules/@tauri-apps/api"),
      "@tauri-apps/plugin-dialog": path.resolve(
        "node_modules/@tauri-apps/plugin-dialog"
      )
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    outDir: "../ui-dist"
  }
});
