import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "pumice-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:47821/mcp"));

await client.connect(transport);
const tools = await client.listTools();
const commandRes = await client.callTool({
  name: "send_command",
  arguments: {
    target: "*",
    message: "mcp smoke test: respond with status"
  }
});
console.log(JSON.stringify({ toolCount: tools.tools.length, sent: commandRes }, null, 2));
await client.close();
