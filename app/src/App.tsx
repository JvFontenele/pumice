import { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  Users,
  Play,
  Settings,
  CheckCircle,
  XCircle,
  Circle,
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  GitBranch,
  Package,
  BookOpen,
  FileText,
  Flame,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { pickProjectDirectory, inspectProject } from "@/lib/tauri";
import type {
  AgentCardModel,
  ProjectSnapshot,
  AgentProvider,
  AgentRole,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_AGENTS: AgentCardModel[] = [
  {
    id: "1",
    name: "Lead Architect",
    role: "architect",
    provider: "ollama",
    model: "qwen3.5",
    command: "claude",
    goal: "Design system architecture and technical decisions",
    status: "ready",
  },
  {
    id: "2",
    name: "Backend Builder",
    role: "backend",
    provider: "ollama",
    model: "gpt-oss:20b",
    command: "codex",
    goal: "Implement backend logic and APIs",
    status: "ready",
  },
  {
    id: "3",
    name: "QA Sentinel",
    role: "qa",
    provider: "ollama",
    model: "qwen3.5",
    command: "claude",
    goal: "Test and validate implementations",
    status: "ready",
  },
  {
    id: "4",
    name: "Vault Scribe",
    role: "docs",
    provider: "ollama",
    model: "qwen3.5",
    command: "ollama",
    goal: "Document decisions and maintain memory",
    status: "ready",
  },
];

const ROLE_CONFIG: Record<
  AgentRole,
  { color: string; bg: string; border: string }
> = {
  architect: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  backend: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
  frontend: {
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
  qa: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  reviewer: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
  },
  docs: {
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
};

const STATUS_CONFIG = {
  ready: { icon: CheckCircle, color: "text-emerald-400", label: "Ready" },
  blocked: { icon: XCircle, color: "text-yellow-400", label: "Blocked" },
  offline: { icon: Circle, color: "text-zinc-500", label: "Offline" },
};

const PIPELINE_STAGES = [
  { role: "architect" as AgentRole, label: "Architect" },
  { role: "backend" as AgentRole, label: "Backend" },
  { role: "qa" as AgentRole, label: "QA" },
  { role: "docs" as AgentRole, label: "Docs" },
];

type View = "setup" | "squad" | "execute";

const NAV_ITEMS: { id: View; label: string; icon: typeof Settings }[] = [
  { id: "setup", label: "Project Setup", icon: Settings },
  { id: "squad", label: "Agent Squad", icon: Users },
  { id: "execute", label: "Execute", icon: Play },
];

// ─── Setup View ──────────────────────────────────────────────────────────────

interface SetupViewProps {
  projectPath: string;
  setProjectPath: (v: string) => void;
  snapshot: ProjectSnapshot | null;
  setSnapshot: (v: ProjectSnapshot | null) => void;
  mission: string;
  setMission: (v: string) => void;
  vaultPath: string;
  setVaultPath: (v: string) => void;
}

function SetupView({
  projectPath,
  setProjectPath,
  snapshot,
  setSnapshot,
  mission,
  setMission,
  vaultPath,
  setVaultPath,
}: SetupViewProps) {
  const [loading, setLoading] = useState(false);

  async function handleBrowse() {
    try {
      const dir = await pickProjectDirectory();
      if (!dir) return;
      setProjectPath(dir);
      setLoading(true);
      try {
        const snap = await inspectProject(dir);
        setSnapshot(snap);
      } catch {
        setSnapshot({
          path: dir,
          name: dir.split(/[/\\]/).pop() ?? dir,
          isGitRepo: false,
          hasPackageJson: false,
          hasObsidianVault: false,
          hasDocs: false,
        });
      }
    } catch {
      // pickProjectDirectory not available in web mode
    } finally {
      setLoading(false);
    }
  }

  const checks = snapshot
    ? [
        { label: "Git Repo", ok: snapshot.isGitRepo, icon: GitBranch },
        { label: "package.json", ok: snapshot.hasPackageJson, icon: Package },
        { label: "Obsidian Vault", ok: snapshot.hasObsidianVault, icon: BookOpen },
        { label: "Docs", ok: snapshot.hasDocs, icon: FileText },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Project Setup</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure the target repository and orchestration settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Target Repository</CardTitle>
          <CardDescription>
            Select the project folder the agents will work on
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/your/project"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleBrowse}
              disabled={loading}
              className="shrink-0"
            >
              <FolderOpen className="size-4" />
              Browse
            </Button>
          </div>

          {snapshot && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {checks.map(({ label, ok, icon: Icon }) => (
                <div
                  key={label}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors",
                    ok
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-muted/30"
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4",
                      ok ? "text-emerald-400" : "text-muted-foreground"
                    )}
                  />
                  <span className="text-xs text-muted-foreground leading-tight">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mission Statement</CardTitle>
          <CardDescription>
            Describe what the agents should accomplish in this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="e.g. Build a REST API for user authentication with JWT tokens and role-based access..."
            rows={4}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Obsidian Vault Path</CardTitle>
          <CardDescription>
            Where agents write their shared memory and decision logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="./obsidian-vault"
              className="flex-1"
            />
            <Button variant="outline" size="icon" className="shrink-0">
              <FolderOpen className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Save Configuration</Button>
      </div>
    </div>
  );
}

// ─── Agent Dialog ────────────────────────────────────────────────────────────

const ROLES: AgentRole[] = ["architect", "backend", "frontend", "qa", "reviewer", "docs"];
const PROVIDERS: AgentProvider[] = ["native", "ollama"];
const STATUSES: AgentCardModel["status"][] = ["ready", "blocked", "offline"];

function emptyAgent(): AgentCardModel {
  return {
    id: crypto.randomUUID(),
    name: "",
    role: "backend",
    provider: "ollama",
    model: "",
    command: "",
    goal: "",
    status: "ready",
  };
}

interface AgentDialogProps {
  agent: AgentCardModel | null;
  open: boolean;
  onClose: () => void;
  onSave: (agent: AgentCardModel) => void;
}

function AgentDialog({ agent, open, onClose, onSave }: AgentDialogProps) {
  const [form, setForm] = useState<AgentCardModel>(emptyAgent);

  useEffect(() => {
    setForm(agent ?? emptyAgent());
  }, [agent, open]);

  function set<K extends keyof AgentCardModel>(key: K, val: AgentCardModel[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "Add Agent"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Lead Architect"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v as AgentRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => set("provider", v as AgentProvider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="qwen3.5" />
            </div>
            <div className="space-y-1.5">
              <Label>Command</Label>
              <Input value={form.command} onChange={(e) => set("command", e.target.value)} placeholder="claude" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Goal</Label>
            <Textarea
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="Describe what this agent does..."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as AgentCardModel["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => { onSave(form); onClose(); }} disabled={!form.name.trim()}>
              Save Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Agent Card ──────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onEdit,
  onDelete,
}: {
  agent: AgentCardModel;
  onEdit: (a: AgentCardModel) => void;
  onDelete: (id: string) => void;
}) {
  const role = ROLE_CONFIG[agent.role];
  const status = STATUS_CONFIG[agent.status];
  const StatusIcon = status.icon;

  return (
    <div className="group relative rounded-lg border border-border bg-card p-4 space-y-3 transition-colors hover:border-border/60">
      <div className="absolute right-3 top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(agent)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Pencil className="size-3" />
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground pr-14">{agent.name}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.command}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={cn(
            "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium",
            role.color, role.bg, role.border
          )}
        >
          {agent.role}
        </span>
        <Badge variant="outline" className="text-xs">{agent.provider}</Badge>
      </div>

      <p className="text-xs font-mono text-muted-foreground">{agent.model}</p>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{agent.goal}</p>

      <div className={cn("flex items-center gap-1.5 text-xs", status.color)}>
        <StatusIcon className="size-3" />
        {status.label}
      </div>
    </div>
  );
}

// ─── Squad View ──────────────────────────────────────────────────────────────

function SquadView({
  agents,
  setAgents,
}: {
  agents: AgentCardModel[];
  setAgents: (a: AgentCardModel[]) => void;
}) {
  const [editingAgent, setEditingAgent] = useState<AgentCardModel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function openNew() { setEditingAgent(null); setDialogOpen(true); }
  function openEdit(agent: AgentCardModel) { setEditingAgent(agent); setDialogOpen(true); }

  function handleSave(agent: AgentCardModel) {
    setAgents(
      agents.some((a) => a.id === agent.id)
        ? agents.map((a) => (a.id === agent.id ? agent : a))
        : [...agents, agent]
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Agent Squad</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="size-4" />
          Add Agent
        </Button>
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Users className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No agents configured</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Add agents to define your orchestration squad
          </p>
          <Button variant="outline" size="sm" onClick={openNew}>
            Add your first agent
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={openEdit}
              onDelete={(id) => setAgents(agents.filter((a) => a.id !== id))}
            />
          ))}
        </div>
      )}

      <AgentDialog
        agent={editingAgent}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Execute View ─────────────────────────────────────────────────────────────

type LogLine = { text: string; type: "info" | "ok" | "dim" };

function ExecuteView({ agents }: { agents: AgentCardModel[] }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [activeStage, setActiveStage] = useState(-1);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleRun() {
    if (!title.trim() || running) return;
    setRunning(true);
    setLogs([]);
    setDoneStages([]);
    setActiveStage(0);

    const add = (text: string, type: LogLine["type"] = "dim") =>
      setLogs((p) => [...p, { text, type }]);

    add(`Task: ${title}`, "info");
    add("Starting orchestration pipeline...");
    add("");

    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setActiveStage(i);
      const stage = PIPELINE_STAGES[i];
      const match = agents.find((a) => a.role === stage.role);

      add(
        `[${stage.label}] ${match ? `${match.name} (${match.model})` : "No agent assigned"}`,
        "info"
      );
      add(`[${stage.label}] Processing...`);

      await new Promise((r) => setTimeout(r, 1300 + Math.random() * 700));

      add(`[${stage.label}] ✓ Complete`, "ok");
      add("");
      setDoneStages((p) => [...p, i]);
    }

    add("✓ Orchestration complete.", "ok");
    add("Results written to Obsidian vault.");
    setRunning(false);
    setActiveStage(-1);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Execute Task</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Run your agent squad on a specific task
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Task Definition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Implement user authentication"
              disabled={running}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe in detail what the agents should implement, including context, constraints, and expected output..."
              rows={4}
              disabled={running}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pipeline</CardTitle>
          <CardDescription>
            Stages execute in sequence, each passing results forward
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 flex-wrap">
            {PIPELINE_STAGES.map((stage, idx) => {
              const role = ROLE_CONFIG[stage.role];
              const isActive = running && activeStage === idx;
              const isDone = doneStages.includes(idx);

              return (
                <div key={stage.role} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-all",
                      isActive && "border-primary/40 bg-primary/10 text-primary",
                      isDone && "border-emerald-500/30 bg-emerald-500/5 text-emerald-400",
                      !isActive && !isDone && "border-border text-muted-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                    {isDone && <CheckCircle className="size-3 text-emerald-400" />}
                    <span className={cn(!isActive && !isDone && role.color)}>
                      {stage.label}
                    </span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={handleRun}
        disabled={running || !title.trim()}
      >
        {running ? (
          <>
            <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play className="size-4" />
            Run Squad
          </>
        )}
      </Button>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Output</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-52 w-full">
              <div className="font-mono text-xs space-y-0.5 pr-4">
                {logs.map((line, i) =>
                  line.text === "" ? (
                    <div key={i} className="h-2" />
                  ) : (
                    <div
                      key={i}
                      className={cn(
                        "leading-relaxed",
                        line.type === "ok" && "text-emerald-400",
                        line.type === "info" && "text-foreground",
                        line.type === "dim" && "text-muted-foreground"
                      )}
                    >
                      {line.text}
                    </div>
                  )
                )}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────

export function App() {
  const [view, setView] = useState<View>("setup");
  const [projectPath, setProjectPath] = useState("");
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [mission, setMission] = useState("");
  const [vaultPath, setVaultPath] = useState("./obsidian-vault");
  const [agents, setAgents] = useState<AgentCardModel[]>(DEFAULT_AGENTS);

  const projectName = projectPath
    ? projectPath.split(/[/\\]/).pop() ?? projectPath
    : null;

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary shrink-0">
              <Flame className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">Pumice</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-none">
                Agent Orchestrator
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left",
                  view === item.id
                    ? "bg-accent text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <div className="flex items-center gap-2 px-2">
            <Users className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? "s" : ""}
            </span>
          </div>
          {projectName && (
            <div className="flex items-center gap-2 px-2">
              <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {projectName}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <ScrollArea className="h-full">
          <div className="max-w-2xl mx-auto p-6">
            {view === "setup" && (
              <SetupView
                projectPath={projectPath}
                setProjectPath={setProjectPath}
                snapshot={snapshot}
                setSnapshot={setSnapshot}
                mission={mission}
                setMission={setMission}
                vaultPath={vaultPath}
                setVaultPath={setVaultPath}
              />
            )}
            {view === "squad" && (
              <SquadView agents={agents} setAgents={setAgents} />
            )}
            {view === "execute" && <ExecuteView agents={agents} />}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
