import type { Agent, Flow, Run, RunStep, ContextBlock } from '@pumice/types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
    throw new Error(err.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export function fetchAgents(): Promise<{ agents: Agent[] }> {
  return get('/agents')
}

// ─── Flows ────────────────────────────────────────────────────────────────────

export function fetchFlows(): Promise<{ flows: Flow[] }> {
  return get('/flows')
}

// ─── Runs ─────────────────────────────────────────────────────────────────────

export type RunSummary = {
  id: string
  flow_id: string
  flow_name: string
  status: string
  started_at: string | null
  finished_at: string | null
  total_steps: number
  completed_steps: number
}

export function fetchRuns(): Promise<{ runs: RunSummary[] }> {
  return get('/runs')
}

export function fetchRun(runId: string): Promise<{ run: Run; steps: RunStep[] }> {
  return get(`/runs/${runId}`)
}

// ─── Context ──────────────────────────────────────────────────────────────────

export type ComposedContext = {
  blocks: Array<ContextBlock & { tokens: number; included: boolean }>
  totalTokens: number
  truncated: boolean
  text: string
}

export function fetchContextBlocks(source?: string): Promise<{ blocks: ContextBlock[] }> {
  return get(source ? `/context/blocks?source=${source}` : '/context/blocks')
}

export function fetchContextSettings(): Promise<{ vaultPath: string | null }> {
  return get('/context/settings')
}

export function saveContextSettings(vaultPath: string): Promise<{ ok: boolean }> {
  return post('/context/settings', { vaultPath })
}

export function createContextBlock(
  block: Omit<ContextBlock, 'id'>,
): Promise<{ block: ContextBlock }> {
  return post('/context/blocks', block)
}

export function deleteContextBlock(id: string): Promise<{ ok: boolean }> {
  return del(`/context/blocks/${id}`)
}

export function indexVault(vaultPath?: string): Promise<{ indexed: number; skipped: number; errors: string[] }> {
  return post('/context/index-vault', vaultPath ? { vaultPath } : {})
}

export function composeContext(opts?: { maxTokens?: number; runtimeText?: string }): Promise<ComposedContext> {
  return post('/context/compose', opts ?? {})
}

export function writeHandoff(content: string, vaultPath?: string): Promise<{ file: string }> {
  return post('/context/handoff', { content, ...(vaultPath ? { vaultPath } : {}) })
}

export function appendDevlog(content: string, vaultPath?: string): Promise<{ file: string }> {
  return post('/context/devlog', { content, ...(vaultPath ? { vaultPath } : {}) })
}

// ─── Health ───────────────────────────────────────────────────────────────────

export function fetchHealth(): Promise<{ status: string; timestamp: string }> {
  return get('/health')
}
