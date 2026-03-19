import { useState, useEffect, useRef } from "react";
import {
  FolderOpen,
  Users,
  Play,
  Bot,
  Send,
  Settings,
  CheckCircle,
  XCircle,
  Circle,
  Loader,
  Pencil,
  Flame,
  Save,
  GitBranch,
  Package,
  BookOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TerminalSquare,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  Network,
  Square,
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
import {
  pickProjectDirectory,
  inspectProject,
  loadProjectConfig,
  saveProjectConfig,
  checkTool,
  checkOllama,
  runTask,
  onTaskLog,
  type TaskLogPayload,
} from "@/lib/tauri";
import type {
  AgentCardModel,
  ConnectedAgent,
  AgentProvider,
  AgentRole,
  ProjectSnapshot,
  RuntimeStatus,
} from "@/types";

// ─── Domain constants ─────────────────────────────────────────────────────────

/** The 4 fixed pipeline stages, in execution order. */
const PIPELINE: {
  role: AgentRole;
  label: string;
  description: string;
  /** Which env-var group this role controls in the orchestrator */
  envGroup: string;
}[] = [
  {
    role: "architect",
    label: "Architect",
    description: "Analyzes requirements and designs the technical approach",
    envGroup: "CLAUDE_*",
  },
  {
    role: "backend",
    label: "Backend",
    description: "Implements server-side logic, APIs and data layers",
    envGroup: "CODEX_*",
  },
  {
    role: "qa",
    label: "QA",
    description: "Validates implementations and writes test strategies",
    envGroup: "GEMINI_*",
  },
  {
    role: "docs",
    label: "Docs",
    description: "Documents decisions and writes Obsidian vault notes",
    envGroup: "GEMINI_*",
  },
];

const ROLE_COLOR: Record<AgentRole, string> = {
  architect: "text-blue-400",
  backend: "text-emerald-400",
  frontend: "text-purple-400",
  qa: "text-yellow-400",
  reviewer: "text-orange-400",
  docs: "text-cyan-400",
};

const ROLE_ACCENT: Record<AgentRole, string> = {
  architect: "border-blue-400/25 bg-blue-400/5",
  backend: "border-emerald-400/25 bg-emerald-400/5",
  frontend: "border-purple-400/25 bg-purple-400/5",
  qa: "border-yellow-400/25 bg-yellow-400/5",
  reviewer: "border-orange-400/25 bg-orange-400/5",
  docs: "border-cyan-400/25 bg-cyan-400/5",
};

const DEFAULT_AGENTS: AgentCardModel[] = [];

type View = "project" | "team" | "agents" | "execute";

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusDot({ status }: { status: RuntimeStatus }) {
  if (status === "unknown")
    return <span className="size-2 rounded-full bg-zinc-600" />;
  if (status === "checking")
    return (
      <span className="size-2 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
    );
  if (status === "ok")
    return <span className="size-2 rounded-full bg-emerald-400" />;
  return <span className="size-2 rounded-full bg-red-400" />;
}

function StatusLabel({ status }: { status: RuntimeStatus }) {
  const map: Record<RuntimeStatus, { label: string; color: string }> = {
    unknown: { label: "Unknown", color: "text-zinc-500" },
    checking: { label: "Checking…", color: "text-muted-foreground" },
    ok: { label: "Ready", color: "text-emerald-400" },
    fail: { label: "Not found", color: "text-red-400" },
  };
  const { label, color } = map[status];
  return (
    <span className={cn("flex items-center gap-1.5 text-xs font-medium", color)}>
      <StatusDot status={status} />
      {label}
    </span>
  );
}

// ─── Agent edit dialog ────────────────────────────────────────────────────────

const PROVIDERS: { value: AgentProvider; label: string; hint: string }[] = [
  { value: "native", label: "Native CLI", hint: "Runs as a shell command" },
  { value: "ollama", label: "Ollama", hint: "Uses a local Ollama model" },
];

const ALL_ROLES: AgentRole[] = [
  "architect",
  "backend",
  "frontend",
  "qa",
  "reviewer",
  "docs",
];

const SUGGESTED_COMMANDS: Record<AgentProvider, string[]> = {
  native: ["claude", "codex", "gemini", "aider"],
  ollama: ["ollama"],
};

function AgentDialog({
  open,
  agent,
  onSave,
  onClose,
}: {
  open: boolean;
  agent: AgentCardModel | null;
  onSave: (a: AgentCardModel) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AgentCardModel>({
    id: crypto.randomUUID(),
    name: "",
    role: "backend",
    provider: "native",
    command: "claude",
    model: "",
    goal: "",
  });

  useEffect(() => {
    if (agent) setForm({ ...agent });
    else
      setForm({
        id: crypto.randomUUID(),
        name: "",
        role: "backend",
        provider: "native",
        command: "claude",
        model: "",
        goal: "",
      });
  }, [agent, open]);

  const set = <K extends keyof AgentCardModel>(k: K, v: AgentCardModel[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{agent ? "Edit Agent" : "Add Agent"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Agent Name</Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Lead Architect"
            />
          </div>

          {/* Role + Provider */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => set("role", v as AgentRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      <span className={ROLE_COLOR[r]}>{r}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={form.provider}
                onValueChange={(v) => set("provider", v as AgentProvider)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Command */}
          <div className="space-y-1.5">
            <Label>Command</Label>
            <Input
              value={form.command}
              onChange={(e) => set("command", e.target.value)}
              placeholder="claude"
              className="font-mono"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {SUGGESTED_COMMANDS[form.provider].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => set("command", cmd)}
                  className={cn(
                    "rounded border px-2 py-0.5 font-mono text-xs transition-colors",
                    form.command === cmd
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border/60 hover:text-foreground"
                  )}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <Label>
              Model{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              value={form.model}
              onChange={(e) => set("model", e.target.value)}
              placeholder={
                form.provider === "ollama" ? "qwen3.5" : "claude-opus-4-6"
              }
              className="font-mono"
            />
          </div>

          {/* Goal */}
          <div className="space-y-1.5">
            <Label>
              Goal{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={form.goal}
              onChange={(e) => set("goal", e.target.value)}
              placeholder="Describe what this agent should focus on…"
              rows={2}
            />
          </div>

          {/* Provider hint */}
          <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
            {form.provider === "native"
              ? `Pumice will run: ${form.command || "<command>"} [--model ${form.model || "<model>"}] "<prompt>"`
              : `Pumice will run: ollama run ${form.model || "<model>"} "<prompt>"`}
          </div>

          <Separator />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(form);
                onClose();
              }}
              disabled={!form.name.trim() || !form.command.trim()}
            >
              Save Agent
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Project View ─────────────────────────────────────────────────────────────

interface ProjectViewProps {
  projectPath: string;
  setProjectPath: (v: string) => void;
  snapshot: ProjectSnapshot | null;
  setSnapshot: (v: ProjectSnapshot | null) => void;
  mission: string;
  setMission: (v: string) => void;
  vaultPath: string;
  setVaultPath: (v: string) => void;
  agents: AgentCardModel[];
  onGoToTeam: () => void;
}

function ProjectView({
  projectPath,
  setProjectPath,
  snapshot,
  setSnapshot,
  mission,
  setMission,
  vaultPath,
  setVaultPath,
  agents,
  onGoToTeam,
}: ProjectViewProps) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "ok" | "err">("idle");

  async function handleBrowse() {
    const dir = await pickProjectDirectory();
    if (!dir) return;
    setProjectPath(dir);
    const snap = await inspectProject(dir);
    if (snap) setSnapshot(snap);
  }

  async function handleBrowseVault() {
    const dir = await pickProjectDirectory();
    if (dir) setVaultPath(dir);
  }

  async function handleSave() {
    if (!projectPath.trim()) return;
    setSaving(true);
    const ok = await saveProjectConfig(projectPath, {
      mission,
      obsidianVaultPath: vaultPath,
      agents,
    });
    setSaving(false);
    setSaveStatus(ok ? "ok" : "err");
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  const healthChecks = snapshot
    ? [
        { label: "Git repo", ok: snapshot.isGitRepo, icon: GitBranch },
        { label: "package.json", ok: snapshot.hasPackageJson, icon: Package },
        { label: "Obsidian vault", ok: snapshot.hasObsidianVault, icon: BookOpen },
        { label: "docs/", ok: snapshot.hasDocs, icon: FileText },
      ]
    : [];

  const isConfigured = !!projectPath.trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Project</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Select the repository your squad will work on
        </p>
      </div>

      {/* Folder picker */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label>Repository path</Label>
          <div className="flex gap-2">
            <Input
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/your/project"
              className="flex-1 font-mono text-sm"
            />
            <Button variant="outline" onClick={handleBrowse} className="shrink-0">
              <FolderOpen className="size-4" />
              Browse
            </Button>
          </div>

          {/* Health grid */}
          {snapshot && (
            <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
              {healthChecks.map(({ label, ok, icon: Icon }) => (
                <div
                  key={label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                    ok
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                      : "border-border bg-muted/20 text-muted-foreground"
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mission */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mission Statement</CardTitle>
          <CardDescription>
            High-level goal passed to every agent as context
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="e.g. Build a production-ready REST API for user auth with JWT and RBAC…"
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Obsidian vault */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Obsidian Vault</CardTitle>
          <CardDescription>
            Where agents write shared memory, decisions, and logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="./obsidian-vault"
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleBrowseVault}
            >
              <FolderOpen className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          {saveStatus === "ok" && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle className="size-3" /> Saved
            </span>
          )}
          {saveStatus === "err" && (
            <span className="text-red-400">Could not save</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || !isConfigured}
          >
            <Save className="size-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button onClick={onGoToTeam} disabled={!isConfigured}>
            Configure Squad
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Team View ────────────────────────────────────────────────────────────────

interface TeamViewProps {
  agents: AgentCardModel[];
  setAgents: (a: AgentCardModel[]) => void;
}

function TeamView({ agents, setAgents }: TeamViewProps) {
  const [statuses, setStatuses] = useState<Record<string, RuntimeStatus>>({});
  const [editingAgent, setEditingAgent] = useState<AgentCardModel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  async function testAgent(agent: AgentCardModel) {
    setStatuses((s) => ({ ...s, [agent.id]: "checking" }));
    const ok =
      agent.provider === "ollama"
        ? await checkOllama()
        : await checkTool(agent.command);
    setStatuses((s) => ({ ...s, [agent.id]: ok ? "ok" : "fail" }));
  }

  async function testAll() {
    const toTest = [...agents];

    setStatuses((s) => {
      const next = { ...s };
      toTest.forEach((a) => (next[a.id] = "checking"));
      return next;
    });

    await Promise.all(
      toTest.map(async (agent) => {
        const ok =
          agent.provider === "ollama"
            ? await checkOllama()
            : await checkTool(agent.command);
        setStatuses((s) => ({ ...s, [agent.id]: ok ? "ok" : "fail" }));
      })
      );
  }

  function openEdit(agent: AgentCardModel | null) {
    setEditingAgent(agent);
    setDialogOpen(true);
  }

  function handleSave(saved: AgentCardModel) {
    if (agents.some((a) => a.id === saved.id)) {
      setAgents(agents.map((a) => (a.id === saved.id ? saved : a)));
    } else {
      setAgents([...agents, saved]);
    }
  }

  function removeAgent(id: string) {
    setAgents(agents.filter((a) => a.id !== id));
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const readyCount = agents.filter((a) => statuses[a.id] === "ok").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Agent Squad</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure agents in execution order
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={testAll} disabled={agents.length === 0}>
            <RefreshCw className="size-3.5" />
            Test All
          </Button>
          <Button size="sm" onClick={() => openEdit(null)}>
            Add Agent
          </Button>
        </div>
      </div>

      {/* Execution flow */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {agents.map((agent, i) => {
          const status = statuses[agent.id] ?? "unknown";
          return (
            <div key={agent.id} className="flex items-center gap-1 shrink-0">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  status === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/8 text-emerald-400"
                    : status === "fail"
                    ? "border-red-500/30 bg-red-500/5 text-red-400"
                    : "border-border text-muted-foreground"
                )}
              >
                <StatusDot status={status} />
                <span className={ROLE_COLOR[agent.role]}>{agent.name}</span>
              </div>
              {i < agents.length - 1 && (
                <ChevronRight className="size-3.5 text-muted-foreground" />
              )}
            </div>
          );
        })}
        <div className="ml-auto shrink-0 text-xs text-muted-foreground pl-3">
          {readyCount}/{agents.length} ready
        </div>
      </div>

      {/* Agent cards */}
      <div className="space-y-3">
        {agents.map((agent, index) => {
          const status = statuses[agent.id] ?? "unknown";

          return (
            <div
              key={agent.id}
              className={cn(
                "rounded-lg border p-5 transition-colors",
                ROLE_ACCENT[agent.role]
              )}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Left: identity */}
                <div className="space-y-0.5 min-w-0">
                  <div
                    className={cn(
                      "text-xs font-bold tracking-widest uppercase",
                      ROLE_COLOR[agent.role]
                    )}
                  >
                    #{index + 1} · {agent.role}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {agent.name}
                  </p>
                </div>

                {/* Right: status + actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <StatusLabel status={status} />
                  {agent && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => testAgent(agent)}
                      disabled={status === "checking"}
                    >
                      {status === "checking" ? (
                        <Loader className="size-3 animate-spin" />
                      ) : (
                        <Wifi className="size-3" />
                      )}
                      Test
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => openEdit(agent)}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => removeAgent(agent.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>

              {/* Agent info */}
              <div className="mt-4 rounded-md bg-background/50 border border-border/60 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{agent.name}</span>
                  <Badge
                    variant="outline"
                    className="text-xs h-5 font-normal"
                  >
                    {agent.provider === "native" ? "Native CLI" : "Ollama"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground flex-wrap">
                  <span className="text-foreground font-semibold">
                    {agent.command}
                  </span>
                  {agent.model && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{agent.model}</span>
                    </>
                  )}
                </div>
                {agent.goal && (
                  <p className="text-xs text-muted-foreground">{agent.goal}</p>
                )}
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            No agents configured yet. Click <strong className="text-foreground">Add Agent</strong>.
          </div>
        )}
      </div>

      <AgentDialog
        open={dialogOpen}
        agent={editingAgent}
        onSave={handleSave}
        onClose={() => {
          setDialogOpen(false);
          setEditingAgent(null);
        }}
      />
    </div>
  );
}

// ─── Execute View ─────────────────────────────────────────────────────────────

type LogLine = { text: string; kind: "info" | "ok" | "err" | "dim" };

function parseLog(payload: TaskLogPayload): LogLine {
  const { line, level } = payload;
  if (line.startsWith("[pumice:stage]"))
    return { text: "▶ " + line.replace("[pumice:stage] ", ""), kind: "info" };
  if (line.startsWith("[pumice:result]")) {
    const ok = / ok$/.test(line.trim());
    return {
      text: (ok ? "✓ " : "✗ ") + line.replace("[pumice:result] ", ""),
      kind: ok ? "ok" : "err",
    };
  }
  if (line.startsWith("[pumice:done]"))
    return { text: "✓ " + line.replace("[pumice:done] ", ""), kind: "ok" };
  if (line.startsWith("[pumice:hub]"))
    return { text: line, kind: "info" };
  if (line.startsWith("[pumice:error]") || line.startsWith("[pumice:abort]"))
    return { text: line, kind: "err" };
  if (line.startsWith("[pumice]"))
    return { text: line.replace("[pumice] ", ""), kind: "info" };
  if (level === "stderr") return { text: line, kind: "err" };
  return { text: line, kind: "dim" };
}

function stageOf(line: string, stageRoles: string[]): number {
  for (let i = 0; i < stageRoles.length; i++) {
    if (line.toLowerCase().includes(stageRoles[i].toLowerCase())) return i;
  }
  return -1;
}

/** Parse the final review summary (printed after [pumice:done]) into per-role outputs. */
function parseReviewSections(lines: string[]): Record<string, string> {
  const text = lines.join("\n");
  const result: Record<string, string> = {};
  const parts = text.split(/\n\n---\n\n/);
  for (const part of parts) {
    const headerMatch = part.match(/^## ([A-Z]+) \([^)]+\)/m);
    if (!headerMatch) continue;
    const role = headerMatch[1].toLowerCase() as AgentRole;
    // Skip the header block (## ROLE, Task ID, Status lines), keep the rest
    const afterHeader = part.replace(/^## [A-Z]+ \([^)]+\)\n(Task ID:[^\n]*\n)?(Status:[^\n]*\n)?/, "").trim();
    if (afterHeader) result[role] = afterHeader;
  }
  return result;
}

interface ExecuteViewProps {
  agents: AgentCardModel[];
  projectPath: string;
}

function ExecuteView({ agents, projectPath }: ExecuteViewProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mockMode, setMockMode] = useState(false);
  const hubMode = true;
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [activeStage, setActiveStage] = useState(-1);
  const [doneStages, setDoneStages] = useState<number[]>([]);
  const [errorStages, setErrorStages] = useState<number[]>([]);
  const [hubUrl, setHubUrl] = useState<string | null>(null);
  const [hubRunning, setHubRunning] = useState(false);
  const [agentResults, setAgentResults] = useState<Record<string, string>>({});
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);
  const reviewBufferRef = useRef<string[]>([]);
  const inReviewRef = useRef(false);
  const executionStages = agents.map((agent, index) => ({
    key: agent.id,
    role: agent.role,
    label: agent.name,
    outputKey: agent.role,
    index
  }));
  const stageRoles = executionStages.map((s) => s.role);

  useEffect(() => {
    if (logsOpen) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, logsOpen]);

  const addLog = (entry: LogLine) => setLogs((p) => [...p, entry]);

  function toggleRole(role: string) {
    setExpandedRole((prev) => (prev === role ? null : role));
  }

  async function handleRun() {
    if (!title.trim() || running) return;
    setRunning(true);
    setLogs([]);
    setDoneStages([]);
    setErrorStages([]);
    setActiveStage(0);
    setHubUrl(null);
    setHubRunning(false);
    setAgentResults({});
    setExpandedRole(null);
    reviewBufferRef.current = [];
    inReviewRef.current = false;

    let unlisten: (() => void) | null = null;

    try {
      unlisten = await onTaskLog((payload) => {
        const { line, level } = payload;
        const entry = parseLog(payload);
        addLog(entry);

        // Hub lifecycle
        if (line.startsWith("[pumice:hub] started at")) {
          const url = line.split("started at ")[1]?.trim();
          if (url) setHubUrl(url);
          setHubRunning(true);
        }
        if (line.startsWith("[pumice:hub] stopped")) {
          setHubRunning(false);
        }

        // Stage tracking
        if (line.startsWith("[pumice:stage]")) {
          const idx = stageOf(line, stageRoles);
          if (idx !== -1) setActiveStage(idx);
          inReviewRef.current = false;
        }
        if (line.startsWith("[pumice:result]")) {
          const ok = / ok$/.test(line.trim());
          const idx = stageOf(line, stageRoles);
          if (idx !== -1) {
            if (ok) setDoneStages((p) => (p.includes(idx) ? p : [...p, idx]));
            else setErrorStages((p) => (p.includes(idx) ? p : [...p, idx]));
          }
        }

        // Review summary accumulation (after [pumice:done])
        if (line.startsWith("[pumice:done]")) {
          inReviewRef.current = true;
          reviewBufferRef.current = [];
        } else if (inReviewRef.current && level === "stdout") {
          reviewBufferRef.current.push(line);
        }
      });

      const success = await runTask(
        title,
        description,
        projectPath ? `Target project: ${projectPath}` : "",
        projectPath || ".",
        mockMode,
        hubMode
      );

      // Parse per-agent outputs from accumulated review buffer
      const parsed = parseReviewSections(reviewBufferRef.current);
      if (Object.keys(parsed).length > 0) {
        setAgentResults(parsed);
        // Auto-expand first result
        setExpandedRole(Object.keys(parsed)[0]);
      }

      if (!success)
        addLog({ text: "Completed with errors — see output above.", kind: "err" });
      } catch {
        // Tauri not available → simulate
        addLog({ text: "Tauri not available — running simulation", kind: "dim" });
        for (let i = 0; i < executionStages.length; i++) {
          const stage = executionStages[i];
          const agent = agents[i] ?? null;
          setActiveStage(i);
          addLog({
            text: `▶ ${stage.label}${agent ? ` (${agent.name})` : ""}`,
          kind: "info",
        });
        await new Promise((r) => setTimeout(r, 800 + Math.random() * 400));
          addLog({ text: `✓ ${stage.label} complete`, kind: "ok" });
          setDoneStages((p) => [...p, i]);
          setAgentResults((p) => ({
            ...p,
            [stage.outputKey]: `Simulated output for ${stage.label} stage.`,
          }));
        }
        addLog({ text: "✓ Simulation complete.", kind: "ok" });
    } finally {
      unlisten?.();
      setRunning(false);
      setActiveStage(-1);
      setHubRunning(false);
      setLogsOpen(true);
    }
  }

  const hasResults = Object.keys(agentResults).length > 0;
  const allDone = doneStages.length + errorStages.length === executionStages.length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Execute</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Define a task and launch your agent squad
        </p>
      </div>

      {/* Task form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Task</CardTitle>
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
              placeholder="Describe what the squad should implement — include constraints, stack, expected output…"
              rows={4}
              disabled={running}
            />
          </div>
        </CardContent>
      </Card>

      {/* Run controls */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="lg"
          className="flex-1 min-w-32"
          onClick={handleRun}
          disabled={running || !title.trim()}
        >
          {running ? (
            <>
              <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run Squad
            </>
          )}
        </Button>

        {/* Mock toggle */}
        <button
          onClick={() => setMockMode((v) => !v)}
          disabled={running}
          title="Mock mode — simulates responses without calling any CLI"
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors shrink-0",
            mockMode
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {mockMode ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
          Mock
        </button>

        <div className="flex items-center gap-1.5 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 text-xs font-medium text-violet-400">
          <Network className="size-4" />
          Hub always on
        </div>
      </div>

      {/* Option badges */}
      {mockMode && (
        <div className="flex gap-2 flex-wrap -mt-1">
          <span className="text-xs text-muted-foreground/70">
            Mock: agents return simulated responses — no CLI calls made.
          </span>
        </div>
      )}

      {/* Hub status badge (live, during run) */}
      {(running || hubUrl) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-mono transition-colors",
            hubRunning
              ? "border-violet-500/30 bg-violet-500/5 text-violet-300"
              : "border-border text-muted-foreground"
          )}
        >
          <Server className="size-3.5 shrink-0" />
          {hubRunning ? (
            <>
              <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
              Hub running — {hubUrl}
            </>
          ) : hubUrl ? (
            <>
              <Square className="size-3 text-muted-foreground/50" />
              Hub stopped
            </>
          ) : (
            <>
              <Loader className="size-3 animate-spin" />
              Starting hub…
            </>
          )}
        </div>
      )}

      {/* Pipeline — stages + results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            Execution Pipeline
            {running && (
              <Badge variant="outline" className="text-xs h-5 font-normal border-primary/30 text-primary">
                Running
              </Badge>
            )}
            {!running && allDone && hasResults && (
              <Badge variant="outline" className="text-xs h-5 font-normal border-emerald-500/30 text-emerald-400">
                Complete
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {executionStages.length > 0
              ? "Each stage reads context from the hub before running, then publishes its output"
              : "No execution stages yet. Add agents in Team to define the run order."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {executionStages.map((stage, idx) => {
            const agent = agents[idx] ?? agents.find((a) => a.role === stage.role);
            const isActive = running && activeStage === idx;
            const isDone = doneStages.includes(idx);
            const isError = errorStages.includes(idx);
            const output = agentResults[stage.outputKey];
            const isExpanded = expandedRole === stage.outputKey;

            return (
              <div
                key={stage.key}
                className={cn(
                  "rounded-lg border transition-all overflow-hidden",
                  isActive && "border-primary/40 bg-primary/5",
                  isDone && !isExpanded && "border-emerald-500/25 bg-emerald-500/5",
                  isDone && isExpanded && "border-emerald-500/40 bg-emerald-500/5",
                  isError && "border-red-500/25 bg-red-500/5",
                  !isActive && !isDone && !isError && "border-border bg-muted/10"
                )}
              >
                {/* Stage header row */}
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {/* Status icon */}
                  <div className="shrink-0 w-4 flex justify-center">
                    {isActive && <Loader className="size-3.5 text-primary animate-spin" />}
                    {isDone && <CheckCircle className="size-3.5 text-emerald-400" />}
                    {isError && <XCircle className="size-3.5 text-red-400" />}
                    {!isActive && !isDone && !isError && (
                      <Circle className="size-3.5 text-muted-foreground/30" />
                    )}
                  </div>

                  {/* Role label */}
                  <span
                    className={cn(
                      "w-20 shrink-0 text-xs font-bold tracking-wider uppercase",
                      isActive || isDone || isError
                        ? ROLE_COLOR[(stage.role as AgentRole) ?? "backend"]
                        : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>

                  {/* Agent info */}
                  <div className="flex-1 min-w-0">
                    {agent ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium truncate">{agent.name}</span>
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          {agent.command}{agent.model && ` · ${agent.model}`}
                        </span>
                        {agent.provider === "ollama" && (
                          <Badge variant="outline" className="h-4 text-[10px] px-1.5 font-normal shrink-0">
                            ollama
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        No agent configured
                      </span>
                    )}
                  </div>

                  {/* Expand/collapse if has output */}
                  {output && (
                    <button
                      onClick={() => toggleRole(stage.outputKey)}
                      className="shrink-0 ml-auto p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      title={isExpanded ? "Collapse output" : "Expand output"}
                    >
                      {isExpanded
                        ? <ChevronUp className="size-3.5" />
                        : <ChevronDown className="size-3.5" />}
                    </button>
                  )}
                </div>

                {/* Expanded output panel */}
                {output && isExpanded && (
                  <div className="border-t border-border/60">
                    <ScrollArea className="h-72 w-full">
                      <div className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {output}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Running: show current activity */}
                {isActive && (
                  <div className="border-t border-primary/20 px-3 py-1.5">
                    <span className="text-xs text-primary/70 flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      Agent is working…
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {executionStages.length === 0 && (
            <div className="rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
              Configure at least one agent in <strong className="text-foreground">Team</strong> to run.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Terminal log (collapsible) */}
      {logs.length > 0 && (
        <Card>
          <CardHeader
            className="pb-2 cursor-pointer select-none"
            onClick={() => setLogsOpen((v) => !v)}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <TerminalSquare className="size-4 text-muted-foreground" />
              Terminal Output
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {logs.length} lines
              </span>
              {logsOpen
                ? <ChevronUp className="size-3.5 text-muted-foreground" />
                : <ChevronDown className="size-3.5 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          {logsOpen && (
            <CardContent>
              <ScrollArea className="h-72 w-full rounded-md bg-background border border-border">
                <div className="p-3 font-mono text-xs space-y-0.5">
                  {logs.map((line, i) =>
                    line.text === "" ? (
                      <div key={i} className="h-2" />
                    ) : (
                      <div
                        key={i}
                        className={cn(
                          "leading-relaxed whitespace-pre-wrap break-all",
                          line.kind === "ok" && "text-emerald-400",
                          line.kind === "info" && "text-foreground",
                          line.kind === "err" && "text-red-400",
                          line.kind === "dim" && "text-muted-foreground"
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
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Agents View ──────────────────────────────────────────────────────────────

interface HubCommand {
  id: string;
  target: string;
  message: string;
  issuedAt: string;
  status: "queued" | "delivered" | "processing" | "completed";
  deliveredTo: string[];
  pulledBy: string[];
  respondedBy: string[];
}
interface HubResponse {
  id: string;
  commandId: string;
  agentId: string;
  output: string;
  respondedAt: string;
}

const HUB_BASE_URL = "http://127.0.0.1:47821";

function AgentsView() {
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);
  const [history, setHistory] = useState<HubCommand[]>([]);
  const [responses, setResponses] = useState<HubResponse[]>([]);
  const [target, setTarget] = useState("*");
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadHubData() {
    try {
      const [agentsRes, commandsRes, responsesRes] = await Promise.all([
        fetch(`${HUB_BASE_URL}/api/agents`),
        fetch(`${HUB_BASE_URL}/api/commands`),
        fetch(`${HUB_BASE_URL}/api/responses`)
      ]);

      if (!agentsRes.ok || !commandsRes.ok || !responsesRes.ok) {
        throw new Error("Hub unavailable");
      }

      const [agents, commands, responses] = await Promise.all([
        agentsRes.json() as Promise<ConnectedAgent[]>,
        commandsRes.json() as Promise<HubCommand[]>,
        responsesRes.json() as Promise<HubResponse[]>
      ]);

      setConnectedAgents(agents);
      setHistory(commands.slice(0, 20));
      setResponses(responses.slice(0, 30));
      setError(null);
    } catch {
      setError("Could not connect to MCP Hub on 127.0.0.1:47821.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHubData();
    const id = setInterval(loadHubData, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (target !== "*" && !connectedAgents.some((a) => a.id === target)) {
      setTarget("*");
    }
  }, [target, connectedAgents]);

  async function sendCommand(selectedTarget: string) {
    if (!command.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${HUB_BASE_URL}/api/commands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: selectedTarget,
          message: command.trim()
        })
      });
      if (!res.ok) {
        throw new Error("Failed");
      }
      setCommand("");
      await loadHubData();
    } catch {
      setError("Failed to send command through MCP Hub.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Connected Agents</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Dynamic agents registered in MCP Hub
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadHubData}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Command Center</CardTitle>
          <CardDescription>
            Send a command to one agent or broadcast to all connected agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr]">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All Agents</SelectItem>
                {connectedAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g. pull latest context and report blockers"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => sendCommand(target)} disabled={sending || !command.trim()}>
              <Send className="size-3.5" />
              Send
            </Button>
            <Button
              variant="outline"
              onClick={() => sendCommand("*")}
              disabled={sending || !command.trim()}
            >
              Broadcast
            </Button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Live Agents</CardTitle>
          <CardDescription>
            {loading
              ? "Loading agents..."
              : `${connectedAgents.length} agent${connectedAgents.length === 1 ? "" : "s"} connected`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {connectedAgents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-md border border-border/70 bg-muted/10 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {agent.id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {agent.role && (
                    <Badge variant="outline" className="h-5 text-[10px] font-normal">
                      {agent.role}
                    </Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setTarget(agent.id)}
                  >
                    Target
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!loading && connectedAgents.length === 0 && (
            <div className="rounded-md border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
              No connected agents in the hub.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Command History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
            >
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="h-5 text-[10px] font-normal">
                    {entry.target === "*" ? "broadcast" : entry.target}
                  </Badge>
                  <span className="text-muted-foreground">{entry.status}</span>
                  <span className="text-muted-foreground">
                    {entry.respondedBy.length}/{entry.deliveredTo.length} responses
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {new Date(entry.issuedAt).toLocaleTimeString()}
                  </span>
              </div>
              <p className="mt-1 text-sm">{entry.message}</p>
            </div>
          ))}
            {history.length === 0 && (
              <p className="text-sm text-muted-foreground">No commands sent yet.</p>
            )}
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Responses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {responses.map((entry) => (
            <div
              key={entry.id}
              className="rounded-md border border-border/60 bg-background/40 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="h-5 text-[10px] font-normal">
                  {entry.agentId}
                </Badge>
                <span>{entry.commandId}</span>
                <span className="ml-auto">
                  {new Date(entry.respondedAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="mt-1 text-sm">{entry.output}</p>
            </div>
          ))}
          {responses.length === 0 && (
            <p className="text-sm text-muted-foreground">No responses yet.</p>
          )}
        </CardContent>
      </Card>
      </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

const NAV: { id: View; label: string; icon: typeof Settings }[] = [
  { id: "project", label: "Project", icon: Settings },
  { id: "team", label: "Team", icon: Users },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "execute", label: "Execute", icon: Play },
];

export function App() {
  const [view, setView] = useState<View>("project");
  const [projectPath, setProjectPath] = useState("");
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [mission, setMission] = useState("");
  const [vaultPath, setVaultPath] = useState("./obsidian-vault");
  const [agents, setAgents] = useState<AgentCardModel[]>(DEFAULT_AGENTS);

  // Auto-load saved config when projectPath changes
  useEffect(() => {
    if (!projectPath.trim()) return;
    const load = async () => {
      const [snap, cfg] = await Promise.all([
        inspectProject(projectPath),
        loadProjectConfig(projectPath),
      ]);
      if (snap) setSnapshot(snap);
      if (cfg) {
        if (cfg.mission) setMission(cfg.mission);
        if (cfg.obsidianVaultPath) setVaultPath(cfg.obsidianVaultPath);
        if (cfg.agents?.length) setAgents(cfg.agents);
      }
    };
    load();
  }, [projectPath]);

  const projectName = projectPath
    ? (projectPath.split(/[/\\]/).pop() ?? projectPath)
    : null;

  return (
    <div className="flex h-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-border flex flex-col bg-card">
        {/* Logo */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-md bg-primary shrink-0">
              <Flame className="size-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none">Pumice</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                Agent Orchestrator
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors text-left",
                view === id
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border space-y-1.5">
          {projectName && (
            <div className="flex items-center gap-1.5 px-2 min-w-0">
              <FolderOpen className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {projectName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-2">
            <Users className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {agents.length} agent{agents.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="max-w-2xl mx-auto px-6 py-6">
            {view === "project" && (
              <ProjectView
                projectPath={projectPath}
                setProjectPath={setProjectPath}
                snapshot={snapshot}
                setSnapshot={setSnapshot}
                mission={mission}
                setMission={setMission}
                vaultPath={vaultPath}
                setVaultPath={setVaultPath}
                agents={agents}
                onGoToTeam={() => setView("team")}
              />
            )}
            {view === "team" && (
              <TeamView agents={agents} setAgents={setAgents} />
            )}
            {view === "agents" && <AgentsView />}
            {view === "execute" && (
              <ExecuteView agents={agents} projectPath={projectPath} />
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
