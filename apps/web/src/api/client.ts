import type { Agent, Flow, Run, RunStep } from '@pumice/types'

const BASE = '/api'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
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

// ─── Health ───────────────────────────────────────────────────────────────────

export function fetchHealth(): Promise<{ status: string; timestamp: string }> {
  return get('/health')
}
