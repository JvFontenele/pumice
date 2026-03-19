import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AgentCardModel, ProjectSnapshot } from "@/types";

const roles = ["architect", "backend", "frontend", "qa", "reviewer", "docs"] as const;

interface Props {
  projectPath: string;
  setProjectPath: (v: string) => void;
  vaultPath: string;
  setVaultPath: (v: string) => void;
  mission: string;
  setMission: (v: string) => void;
  snapshot: ProjectSnapshot | null;
  browseProject: () => void;
  browseVault: () => void;
  agents: AgentCardModel[];
  newAgent: AgentCardModel;
  setNewAgent: (next: AgentCardModel) => void;
  addAgent: () => void;
  removeAgent: (id: string) => void;
}

export function StudioSidebar(props: Props) {
  const {
    projectPath,
    setProjectPath,
    vaultPath,
    setVaultPath,
    mission,
    setMission,
    snapshot,
    browseProject,
    browseVault,
    agents,
    newAgent,
    setNewAgent,
    addAgent,
    removeAgent,
  } = props;

  return (
    <div className="col-span-12 space-y-4 xl:col-span-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input value={projectPath} onChange={(e) => setProjectPath(e.target.value)} placeholder="Repository path" />
            <Button variant="outline" onClick={browseProject}>
              <FolderOpen className="size-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input value={vaultPath} onChange={(e) => setVaultPath(e.target.value)} placeholder="Vault path" />
            <Button variant="outline" onClick={browseVault}>
              <FolderOpen className="size-4" />
            </Button>
          </div>
          <Textarea rows={2} value={mission} onChange={(e) => setMission(e.target.value)} placeholder="Mission" />
          {snapshot && (
            <p className="text-xs text-muted-foreground">
              {snapshot.name} · git:{String(snapshot.isGitRepo)} · vault:{String(snapshot.hasObsidianVault)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Agents</CardTitle>
          <CardDescription>Define function for each agent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="Name" />
            <Select value={newAgent.role} onValueChange={(v) => setNewAgent({ ...newAgent, role: v as AgentCardModel["role"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={newAgent.command} onChange={(e) => setNewAgent({ ...newAgent, command: e.target.value })} placeholder="Command" />
            <Input value={newAgent.model} onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })} placeholder="Model" />
          </div>
          <Textarea rows={2} value={newAgent.goal} onChange={(e) => setNewAgent({ ...newAgent, goal: e.target.value })} placeholder="Function for this agent" />
          <Button variant="outline" onClick={addAgent}>
            <Plus className="size-3.5" />
            Add Agent
          </Button>
          <ScrollArea className="h-36">
            <div className="space-y-1.5 pr-2">
              {agents.map((a) => (
                <div key={a.id} className="rounded border border-border/60 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{a.name}</span>
                    <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => removeAgent(a.id)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.role} · {a.command} · {a.goal}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
