import { useEffect, useMemo, useRef, useState } from "react";
import { inspectProject, loadProjectConfig, pickProjectDirectory, saveProjectConfig } from "@/lib/tauri";
import type { AgentCardModel, ContextBlock, DevFlow, ProjectSnapshot } from "@/types";
import { StudioSidebar } from "@/features/studio/StudioSidebar";
import { StudioWorkspace } from "@/features/studio/StudioWorkspace";
import { StudioHeader } from "@/features/studio/StudioHeader";
import type { ChatMessage } from "@/features/studio/types";
import { sendHubCommand } from "@/features/studio/hub-api";
import { useHubPolling } from "@/features/studio/useHubPolling";

const uid = () => crypto.randomUUID();

export function App() {
  const [projectPath, setProjectPath] = useState("");
  const [vaultPath, setVaultPath] = useState("./obsidian-vault");
  const [mission, setMission] = useState("");
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);

  const [agents, setAgents] = useState<AgentCardModel[]>([]);
  const [newAgent, setNewAgent] = useState<AgentCardModel>({
    id: uid(), name: "", role: "backend", provider: "native", command: "codex", model: "", goal: ""
  });

  const [contexts, setContexts] = useState<ContextBlock[]>([]);
  const [ctxTitle, setCtxTitle] = useState("");
  const [ctxContent, setCtxContent] = useState("");
  const [flows, setFlows] = useState<DevFlow[]>([]);
  const [activeFlowId, setActiveFlowId] = useState("");

  const { hubOnline, connected, commands, responses } = useHubPolling();

  const [target, setTarget] = useState("*");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const seen = useRef(new Set<string>());
  const endRef = useRef<HTMLDivElement>(null);

  const activeFlow = useMemo(() => flows.find((f) => f.id === activeFlowId) || null, [flows, activeFlowId]);
  const working = useMemo(() => {
    const s = new Set<string>();
    for (const c of commands) {
      if (c.status === "completed") continue;
      for (const a of c.deliveredTo) if (!c.respondedBy.includes(a)) s.add(a);
    }
    return s;
  }, [commands]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  useEffect(() => {
    if (!projectPath.trim()) return;
    (async () => {
      const [snap, cfg] = await Promise.all([inspectProject(projectPath), loadProjectConfig(projectPath)]);
      if (snap) setSnapshot(snap);
      if (!cfg) return;
      setMission(cfg.mission || "");
      setVaultPath(cfg.obsidianVaultPath || "./obsidian-vault");
      setAgents(cfg.agents || []);
      setContexts(cfg.contexts || []);
      setFlows(cfg.flows || []);
      setActiveFlowId(cfg.flows?.[0]?.id || "");
    })();
  }, [projectPath]);

  useEffect(() => {
    const unseen = responses.filter((r) => !seen.current.has(r.id));
    if (!unseen.length) return;
    setChat((prev) => [...prev, ...unseen.map((r) => ({ id: r.id, kind: "agent" as const, text: r.output, who: r.agentId }))]);
    unseen.forEach((r) => seen.current.add(r.id));
  }, [responses]);

  const browse = async (fn: (s: string) => void) => { const dir = await pickProjectDirectory(); if (dir) fn(dir); };
  const save = () => saveProjectConfig(projectPath, { mission, obsidianVaultPath: vaultPath, agents, contexts, flows });

  const addAgent = () => {
    if (!newAgent.name.trim()) return;
    setAgents((p) => [...p, { ...newAgent, id: uid() }]);
    setNewAgent((p) => ({ ...p, id: uid(), name: "", goal: "" }));
  };
  const removeAgent = (id: string) => setAgents((p) => p.filter((x) => x.id !== id));
  const addContext = () => {
    if (!ctxTitle.trim() || !ctxContent.trim()) return;
    setContexts((p) => [...p, { id: uid(), title: ctxTitle, content: ctxContent }]);
    setCtxTitle(""); setCtxContent("");
  };
  const removeContext = (id: string) => setContexts((p) => p.filter((x) => x.id !== id));
  const addFlow = () => {
    const flow: DevFlow = { id: uid(), name: `Flow ${flows.length + 1}`, goal: "", steps: [] };
    setFlows((p) => [...p, flow]); setActiveFlowId(flow.id);
  };
  const updateActiveFlow = (patch: Partial<DevFlow>) => {
    if (!activeFlow) return;
    setFlows((p) => p.map((f) => f.id === activeFlow.id ? { ...f, ...patch } : f));
  };

  const send = async () => {
    if (!message.trim()) return;
    const flowTxt = activeFlow ? `${activeFlow.name} - ${activeFlow.goal}` : "No flow";
    const ctxTxt = contexts.slice(0, 4).map((c) => `${c.title}: ${c.content.slice(0, 100)}`).join("\n");
    const payload = `Mission: ${mission}\nFlow: ${flowTxt}\nContexts:\n${ctxTxt}\nUser: ${message}`;
    setChat((p) => [...p, { id: uid(), kind: "user", text: message }]);
    setMessage("");
    try {
      const cmd = await sendHubCommand(target, payload);
      setChat((p) => [...p, { id: uid(), kind: "system", text: `Command ${cmd.id} dispatched.` }]);
    } catch {
      setChat((p) => [...p, { id: uid(), kind: "system", text: "Failed to send command." }]);
    }
  };

  return (
    <div className="h-full bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1500px] flex-col px-5 py-4">
        <StudioHeader hubOnline={hubOnline} connectedCount={connected.length} onSave={save} />

        <div className="grid flex-1 min-h-0 grid-cols-12 gap-4">
          <StudioSidebar
            projectPath={projectPath}
            setProjectPath={setProjectPath}
            vaultPath={vaultPath}
            setVaultPath={setVaultPath}
            mission={mission}
            setMission={setMission}
            snapshot={snapshot}
            browseProject={() => browse(setProjectPath)}
            browseVault={() => browse(setVaultPath)}
            agents={agents}
            newAgent={newAgent}
            setNewAgent={setNewAgent}
            addAgent={addAgent}
            removeAgent={removeAgent}
          />

          <StudioWorkspace
            flows={flows}
            activeFlowId={activeFlowId}
            setActiveFlowId={setActiveFlowId}
            activeFlow={activeFlow}
            addFlow={addFlow}
            updateActiveFlow={updateActiveFlow}
            contexts={contexts}
            ctxTitle={ctxTitle}
            setCtxTitle={setCtxTitle}
            ctxContent={ctxContent}
            setCtxContent={setCtxContent}
            addContext={addContext}
            removeContext={removeContext}
            connected={connected}
            working={working}
            responses={responses}
            chat={chat}
            chatEndRef={endRef}
            target={target}
            setTarget={setTarget}
            message={message}
            setMessage={setMessage}
            send={send}
            hubOnline={hubOnline}
          />
        </div>
      </div>
    </div>
  );
}
