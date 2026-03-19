import { useEffect, useState } from "react";
import type { ConnectedAgent } from "@/types";
import { fetchHubSnapshot } from "./hub-api";
import type { HubCommand, HubResponse } from "./types";

type HubPollingState = {
  hubOnline: boolean;
  connected: ConnectedAgent[];
  commands: HubCommand[];
  responses: HubResponse[];
};

export function useHubPolling(): HubPollingState {
  const [hubOnline, setHubOnline] = useState(false);
  const [connected, setConnected] = useState<ConnectedAgent[]>([]);
  const [commands, setCommands] = useState<HubCommand[]>([]);
  const [responses, setResponses] = useState<HubResponse[]>([]);

  useEffect(() => {
    const poll = async () => {
      try {
        const snapshot = await fetchHubSnapshot();
        setHubOnline(true);
        setConnected(snapshot.connected);
        setCommands(snapshot.commands);
        setResponses(snapshot.responses);
      } catch {
        setHubOnline(false);
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  return { hubOnline, connected, commands, responses };
}
