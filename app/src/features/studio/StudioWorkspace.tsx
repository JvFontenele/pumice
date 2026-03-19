import { Bot, Plus, Send, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ConnectedAgent, ContextBlock, DevFlow } from "@/types";
import type { ChatMessage, HubResponse } from "./types";

interface Props {
  flows: DevFlow[];
  activeFlowId: string;
  setActiveFlowId: (id: string) => void;
  activeFlow: DevFlow | null;
  addFlow: () => void;
  updateActiveFlow: (patch: Partial<DevFlow>) => void;
  contexts: ContextBlock[];
  ctxTitle: string;
  setCtxTitle: (v: string) => void;
  ctxContent: string;
  setCtxContent: (v: string) => void;
  addContext: () => void;
  removeContext: (id: string) => void;
  connected: ConnectedAgent[];
  working: Set<string>;
  responses: HubResponse[];
  chat: ChatMessage[];
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  target: string;
  setTarget: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  send: () => void;
  hubOnline: boolean;
}

export function StudioWorkspace(props: Props) {
  const {
    flows,
    activeFlowId,
    setActiveFlowId,
    activeFlow,
    addFlow,
    updateActiveFlow,
    contexts,
    ctxTitle,
    setCtxTitle,
    ctxContent,
    setCtxContent,
    addContext,
    removeContext,
    connected,
    working,
    responses,
    chat,
    chatEndRef,
    target,
    setTarget,
    message,
    setMessage,
    send,
    hubOnline,
  } = props;

  return (
    <div className="col-span-12 space-y-4 xl:col-span-8">
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader>
            <CardTitle className="text-sm">Flows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Select value={activeFlowId || "__none"} onValueChange={(v) => setActiveFlowId(v === "__none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select flow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No flow</SelectItem>
                  {flows.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addFlow}>
                <Plus className="size-3.5" />
                New
              </Button>
            </div>
            {activeFlow ? (
              <>
                <Input value={activeFlow.name} onChange={(e) => updateActiveFlow({ name: e.target.value })} />
                <Textarea rows={2} value={activeFlow.goal} onChange={(e) => updateActiveFlow({ goal: e.target.value })} placeholder="Flow goal" />
                <Textarea
                  rows={4}
                  value={activeFlow.steps.map((s) => `${s.agentId}:${s.action}`).join("\n")}
                  onChange={(e) => {
                    const steps = e.target.value
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const [agentId, ...rest] = line.split(":");
                        return { id: crypto.randomUUID(), agentId: agentId || "", action: rest.join(":").trim(), contextIds: [] };
                      });
                    updateActiveFlow({ steps });
                  }}
                  placeholder="One per line: agentId:action"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Create a flow to orchestrate.</p>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <CardHeader>
            <CardTitle className="text-sm">Contexts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Input value={ctxTitle} onChange={(e) => setCtxTitle(e.target.value)} placeholder="Context title" />
            <Textarea rows={3} value={ctxContent} onChange={(e) => setCtxContent(e.target.value)} placeholder="Context content" />
            <Button variant="outline" onClick={addContext}>
              <Plus className="size-3.5" />
              Add Context
            </Button>
            <ScrollArea className="h-28">
              <div className="space-y-1.5 pr-2">
                {contexts.map((c) => (
                  <div key={c.id} className="rounded border border-border/60 px-2 py-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{c.title}</span>
                      <Button variant="outline" size="sm" className="h-6 px-2" onClick={() => removeContext(c.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{c.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle className="text-sm">Orchestration Chat</CardTitle>
          <CardDescription>Real-time command center with connected agents.</CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">
              <Bot className="mr-1 size-3" />
              {responses.length} responses
            </Badge>
            {connected.map((a) => (
              <Badge key={a.id} variant="outline" className={working.has(a.id) ? "text-amber-300" : "text-muted-foreground"}>
                {a.name}
              </Badge>
            ))}
          </div>
          <ScrollArea className="h-[280px] rounded-md border border-border/60">
            <div className="space-y-2 p-3">
              {chat.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "rounded px-3 py-2 text-sm",
                    m.kind === "user" && "ml-8 bg-primary/15",
                    m.kind === "system" && "bg-muted/30 text-muted-foreground",
                    m.kind === "agent" && "mr-8 border border-border/60 bg-muted/10"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.who ? `[${m.who}] ` : ""}{m.text}</p>
                </div>
              ))}
              {!chat.length && <p className="text-sm text-muted-foreground">Send a command to start orchestration.</p>}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[170px_1fr_auto]">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="*">All Agents</SelectItem>
                {connected.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the squad what to do" />
            <Button onClick={send} disabled={!hubOnline || !message.trim()}>
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
