/**
 * Thin HTTP client for the Pumice control plane REST API.
 * Used by the MCP server tools to talk to a running pumice API.
 */

export interface PumiceClientOptions {
  baseUrl: string
  token?: string
}

export class PumiceClient {
  baseUrl: string
  token: string | null

  constructor(opts: PumiceClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.token = opts.token ?? null
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`

    const raw = JSON.stringify(body)
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body !== undefined
        ? { ...headers, 'Content-Length': String(Buffer.byteLength(raw!)) }
        : headers,
      body: body !== undefined ? raw : undefined,
    })

    const text = await res.text()
    if (!res.ok) {
      let msg = text
      try { msg = (JSON.parse(text) as { error?: string; message?: string }).error ?? (JSON.parse(text) as { message?: string }).message ?? text } catch {}
      throw new Error(`Pumice API ${method} ${path} → ${res.status}: ${msg}`)
    }
    return JSON.parse(text) as T
  }

  // ─── Agents ───────────────────────────────────────────────────────────────

  register(payload: { name: string; provider: string; capabilities: string[] }) {
    return this.req<{ agentId: string; token: string }>('POST', '/agents/register', payload)
  }

  heartbeat(agentId: string) {
    return this.req<{ ok: boolean }>('POST', `/agents/${agentId}/heartbeat`)
  }

  pullCommands(agentId: string) {
    return this.req<{ commands: unknown[] }>('GET', `/agents/${agentId}/commands`)
  }

  postResponse(payload: {
    commandId: string
    agentId: string
    output: string
    partial: boolean
    failed?: boolean
    artifacts?: string[]
  }) {
    return this.req<{ responseId: string; command: unknown }>('POST', '/responses', payload)
  }

  updateStatus(agentId: string, status: string) {
    return this.req<{ ok: boolean }>('PATCH', `/agents/${agentId}/status`, { status })
  }

  listAgents() {
    return this.req<{ agents: unknown[] }>('GET', '/agents')
  }

  // ─── Flows ────────────────────────────────────────────────────────────────

  listFlows() {
    return this.req<{ flows: unknown[] }>('GET', '/flows')
  }

  startRun(flowId: string, input?: string) {
    return this.req<{ run: unknown }>('POST', `/flows/${flowId}/runs`, input ? { input } : {})
  }

  getRun(runId: string) {
    return this.req<{ run: unknown; steps: unknown[] }>('GET', `/runs/${runId}`)
  }

  listRuns() {
    return this.req<{ runs: unknown[] }>('GET', '/runs')
  }

  // ─── Context ──────────────────────────────────────────────────────────────

  composeContext(opts?: { maxTokens?: number; runtimeText?: string }) {
    return this.req<{ text: string; totalTokens: number; truncated: boolean; blocks: unknown[] }>(
      'POST', '/context/compose', opts ?? {}
    )
  }

  listContextBlocks() {
    return this.req<{ blocks: unknown[] }>('GET', '/context/blocks')
  }

  writeHandoff(content: string) {
    return this.req<{ file: string }>('POST', '/context/handoff', { content })
  }
}
