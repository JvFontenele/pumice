import { z } from 'zod'

// ─── Agent ────────────────────────────────────────────────────────────────────

export const AgentProviderSchema = z.enum(['claude', 'codex', 'gemini', 'ollama'])
export type AgentProvider = z.infer<typeof AgentProviderSchema>

export const AgentStatusSchema = z.enum(['idle', 'working', 'error', 'offline'])
export type AgentStatus = z.infer<typeof AgentStatusSchema>

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  provider: AgentProviderSchema,
  capabilities: z.array(z.string()),
  status: AgentStatusSchema,
  lastSeen: z.string().datetime().nullable(),
})
export type Agent = z.infer<typeof AgentSchema>

// ─── Flow ─────────────────────────────────────────────────────────────────────

export const FlowPolicySchema = z.enum(['serial', 'parallel', 'mixed'])
export type FlowPolicy = z.infer<typeof FlowPolicySchema>

export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0),
  backoffMs: z.number().int().min(0),
})

export const FlowStepSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  agentId: z.string().uuid().nullable(),
  dependsOn: z.array(z.string()),
  retryPolicy: RetryPolicySchema.optional(),
})
export type FlowStep = z.infer<typeof FlowStepSchema>

export const FlowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  goal: z.string().min(1),
  steps: z.array(FlowStepSchema),
  policy: FlowPolicySchema,
})
export type Flow = z.infer<typeof FlowSchema>

// ─── Run ──────────────────────────────────────────────────────────────────────

export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
export type RunStatus = z.infer<typeof RunStatusSchema>

export const RunSchema = z.object({
  id: z.string().uuid(),
  flowId: z.string().uuid(),
  status: RunStatusSchema,
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
})
export type Run = z.infer<typeof RunSchema>

// ─── Command ──────────────────────────────────────────────────────────────────

export const CommandStatusSchema = z.enum(['queued', 'delivered', 'processing', 'completed', 'failed'])
export type CommandStatus = z.infer<typeof CommandStatusSchema>

export const CommandSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
  target: z.union([z.string().uuid(), z.literal('broadcast')]),
  payload: z.string().min(1),
  status: CommandStatusSchema,
})
export type Command = z.infer<typeof CommandSchema>

// ─── Response ─────────────────────────────────────────────────────────────────

export const ResponseSchema = z.object({
  id: z.string().uuid(),
  commandId: z.string().uuid(),
  agentId: z.string().uuid(),
  output: z.string(),
  artifacts: z.array(z.string()),
  partial: z.boolean(),
})
export type Response = z.infer<typeof ResponseSchema>

// ─── ContextBlock ─────────────────────────────────────────────────────────────

export const ContextSourceSchema = z.enum(['runtime', 'vault', 'manual'])
export type ContextSource = z.infer<typeof ContextSourceSchema>

export const ContextBlockSchema = z.object({
  id: z.string().uuid(),
  source: ContextSourceSchema,
  title: z.string().min(1),
  content: z.string(),
  tags: z.array(z.string()),
})
export type ContextBlock = z.infer<typeof ContextBlockSchema>

// ─── ProjectProfile ───────────────────────────────────────────────────────────

export const ProjectProfileSchema = z.object({
  repoPath: z.string().min(1),
  vaultPath: z.string().nullable(),
  rules: z.array(z.string()),
  settings: z.record(z.unknown()),
})
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>

// ─── Events (SSE/WebSocket) ───────────────────────────────────────────────────

export const EventTypeSchema = z.enum([
  'agent.registered',
  'agent.status_changed',
  'agent.heartbeat',
  'command.queued',
  'command.status_changed',
  'response.partial',
  'response.final',
  'run.started',
  'run.finished',
])
export type EventType = z.infer<typeof EventTypeSchema>

export const PumiceEventSchema = z.object({
  type: EventTypeSchema,
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
})
export type PumiceEvent = z.infer<typeof PumiceEventSchema>
