import type { Command } from '@pumice/types'
import type {
  IAgentAdapter,
  RegisterPayload,
  AgentRegistration,
  PostResponsePayload,
} from '@pumice/agent-sdk'
import type { AgentStatus } from '@pumice/types'

export interface HttpAdapterOptions {
  /** Base URL of the Pumice control plane. Default: http://localhost:3001 */
  baseUrl?: string
  /** Auth token set after register(); can also be injected for reconnects. */
  token?: string
}

/**
 * Implements IAgentAdapter over the Pumice HTTP REST API.
 * This is the concrete transport used by all provider runners.
 */
export class HttpAdapter implements IAgentAdapter {
  private baseUrl: string
  private token: string | null

  constructor(options: HttpAdapterOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://localhost:3001'
    this.token = options.token ?? null
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) h['Authorization'] = `Bearer ${this.token}`
    return h
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  // ─── IAgentAdapter ─────────────────────────────────────────────────────────

  async register(payload: RegisterPayload): Promise<AgentRegistration> {
    const data = await this.request<{ agentId: string; token: string }>(
      'POST',
      '/agents/register',
      payload,
    )
    this.token = data.token
    return { agentId: data.agentId, token: data.token }
  }

  async heartbeat(agentId: string): Promise<void> {
    await this.request<unknown>('POST', `/agents/${agentId}/heartbeat`)
  }

  async pullCommands(agentId: string): Promise<Command[]> {
    const data = await this.request<{ commands: Command[] }>(
      'GET',
      `/agents/${agentId}/commands`,
    )
    return data.commands
  }

  async postResponse(payload: PostResponsePayload): Promise<void> {
    await this.request<unknown>('POST', '/responses', payload)
  }

  async updateStatus(agentId: string, status: AgentStatus): Promise<void> {
    await this.request<unknown>('PATCH', `/agents/${agentId}/status`, { status })
  }
}
