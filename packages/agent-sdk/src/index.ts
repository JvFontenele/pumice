import type { Agent, AgentStatus, Command } from '@pumice/types'

// ─── Registration ─────────────────────────────────────────────────────────────

export interface RegisterPayload {
  name: string
  provider: Agent['provider']
  capabilities: string[]
}

export interface AgentRegistration {
  agentId: string
  /** Token used in subsequent calls (pull, post, heartbeat) */
  token: string
}

// ─── Response posting ─────────────────────────────────────────────────────────

export interface PostResponsePayload {
  commandId: string
  agentId: string
  output: string
  artifacts?: string[]
  /** true = streaming chunk; false = final response */
  partial: boolean
  /** Optional explicit failure flag for final responses. */
  failed?: boolean
}

// ─── Adapter contract ─────────────────────────────────────────────────────────

/**
 * Every agent provider must implement this interface.
 * The control plane interacts exclusively through this contract.
 */
export interface IAgentAdapter {
  /** Register a new agent instance; returns its ID and auth token. */
  register(payload: RegisterPayload): Promise<AgentRegistration>

  /** Keep the agent marked as online. Must be called regularly. */
  heartbeat(agentId: string): Promise<void>

  /** Pull pending commands assigned to this agent (or broadcast). */
  pullCommands(agentId: string): Promise<Command[]>

  /** Post a partial or final response for a given command. */
  postResponse(payload: PostResponsePayload): Promise<void>

  /** Update the agent's operational status. */
  updateStatus(agentId: string, status: AgentStatus): Promise<void>
}

// ─── Conformance helper ───────────────────────────────────────────────────────

/**
 * Returns true if the given object structurally satisfies IAgentAdapter.
 * Use in tests to verify an adapter implementation at a minimum.
 */
export function isAgentAdapter(obj: unknown): obj is IAgentAdapter {
  if (typeof obj !== 'object' || obj === null) return false
  const required: Array<keyof IAgentAdapter> = [
    'register',
    'heartbeat',
    'pullCommands',
    'postResponse',
    'updateStatus',
  ]
  return required.every((m) => typeof (obj as Record<string, unknown>)[m] === 'function')
}
