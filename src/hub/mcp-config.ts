import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Writes an ephemeral MCP config JSON file that Claude CLI accepts via --mcp-config.
 * The file is keyed by PID to avoid collisions between concurrent runs.
 * Returns the absolute path to the written file.
 */
export async function writeMcpConfig(hubUrl: string): Promise<string> {
  const mcpConfig = {
    mcpServers: {
      "pumice-hub": {
        type: "http",
        url: `${hubUrl}/mcp`
      }
    }
  };

  const filePath = join(tmpdir(), `pumice-mcp-${process.pid}.json`);
  await writeFile(filePath, JSON.stringify(mcpConfig, null, 2), "utf-8");
  return filePath;
}
