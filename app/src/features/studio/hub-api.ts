import type { ConnectedAgent } from "@/types";
import type { HubCommand, HubResponse } from "./types";

const HUB_BASE_URL = "http://127.0.0.1:47821";

export type HubSnapshot = {
  connected: ConnectedAgent[];
  commands: HubCommand[];
  responses: HubResponse[];
};

export async function fetchHubSnapshot(): Promise<HubSnapshot> {
  const [h, a, c, r] = await Promise.all([
    fetch(`${HUB_BASE_URL}/health`),
    fetch(`${HUB_BASE_URL}/api/agents`),
    fetch(`${HUB_BASE_URL}/api/commands`),
    fetch(`${HUB_BASE_URL}/api/responses`),
  ]);
  if (!h.ok || !a.ok || !c.ok || !r.ok) {
    throw new Error("Hub unavailable");
  }
  return {
    connected: await a.json(),
    commands: (await c.json()).slice(0, 30),
    responses: (await r.json()).slice(0, 60),
  };
}

export async function sendHubCommand(target: string, message: string): Promise<HubCommand> {
  const res = await fetch(`${HUB_BASE_URL}/api/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, message }),
  });
  if (!res.ok) {
    throw new Error("Failed to send command");
  }
  return res.json();
}
