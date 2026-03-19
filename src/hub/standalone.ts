/**
 * Standalone MCP hub server entry point.
 * Spawned by Tauri on app launch so the hub is always available.
 * Usage: npx tsx src/hub/standalone.ts
 */
import { startHub } from "./transport.js";
import { config } from "../config.js";

config.hub.enabled = true;
config.hub.port = parseInt(process.env.PUMICE_HUB_PORT ?? "47821", 10);

try {
  const url = await startHub();
  // Write URL to stdout so the Tauri parent can read it.
  console.log(`[pumice:hub] started at ${url}`);
} catch (e) {
  console.error("[pumice:hub] failed to start:", e);
  process.exit(1);
}

// Keep process alive until Tauri kills it.
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
