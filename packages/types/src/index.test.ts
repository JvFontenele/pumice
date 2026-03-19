import { describe, it, expect } from 'vitest'
import {
  AgentSchema,
  FlowSchema,
  RunSchema,
  CommandSchema,
  ResponseSchema,
  ContextBlockSchema,
  ProjectProfileSchema,
  PumiceEventSchema,
} from './index'

// ─── Agent ────────────────────────────────────────────────────────────────────

describe('AgentSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Claude Agent',
    provider: 'claude',
    capabilities: ['code', 'review'],
    status: 'idle',
    lastSeen: '2026-03-19T00:00:00.000Z',
  }

  it('parses a valid agent', () => {
    expect(() => AgentSchema.parse(valid)).not.toThrow()
  })

  it('accepts null lastSeen', () => {
    expect(() => AgentSchema.parse({ ...valid, lastSeen: null })).not.toThrow()
  })

  it('rejects unknown provider', () => {
    expect(() => AgentSchema.parse({ ...valid, provider: 'gpt4' })).toThrow()
  })

  it('rejects empty name', () => {
    expect(() => AgentSchema.parse({ ...valid, name: '' })).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => AgentSchema.parse({ ...valid, status: 'running' })).toThrow()
  })
})

// ─── Flow ─────────────────────────────────────────────────────────────────────

describe('FlowSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Build Pipeline',
    goal: 'Build and test the application',
    steps: [
      {
        id: 'step-1',
        role: 'architect',
        agentId: '123e4567-e89b-12d3-a456-426614174000',
        dependsOn: [],
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
      },
      {
        id: 'step-2',
        role: 'backend',
        agentId: null,
        dependsOn: ['step-1'],
      },
    ],
    policy: 'serial',
  }

  it('parses a valid flow', () => {
    expect(() => FlowSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid policy', () => {
    expect(() => FlowSchema.parse({ ...valid, policy: 'waterfall' })).toThrow()
  })

  it('rejects steps with empty id', () => {
    const bad = { ...valid, steps: [{ ...valid.steps[0], id: '' }] }
    expect(() => FlowSchema.parse(bad)).toThrow()
  })
})

// ─── Run ──────────────────────────────────────────────────────────────────────

describe('RunSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    flowId: '123e4567-e89b-12d3-a456-426614174001',
    status: 'running',
    startedAt: '2026-03-19T00:00:00.000Z',
    finishedAt: null,
  }

  it('parses a valid run', () => {
    expect(() => RunSchema.parse(valid)).not.toThrow()
  })

  it('accepts null timestamps', () => {
    expect(() => RunSchema.parse({ ...valid, startedAt: null, finishedAt: null })).not.toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => RunSchema.parse({ ...valid, status: 'done' })).toThrow()
  })
})

// ─── Command ──────────────────────────────────────────────────────────────────

describe('CommandSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174003',
    runId: '123e4567-e89b-12d3-a456-426614174002',
    target: '123e4567-e89b-12d3-a456-426614174000',
    payload: 'Implement the user auth module',
    status: 'queued',
  }

  it('parses a targeted command', () => {
    expect(() => CommandSchema.parse(valid)).not.toThrow()
  })

  it('parses a broadcast command', () => {
    expect(() => CommandSchema.parse({ ...valid, target: 'broadcast' })).not.toThrow()
  })

  it('rejects empty payload', () => {
    expect(() => CommandSchema.parse({ ...valid, payload: '' })).toThrow()
  })

  it('rejects invalid status', () => {
    expect(() => CommandSchema.parse({ ...valid, status: 'pending' })).toThrow()
  })
})

// ─── Response ─────────────────────────────────────────────────────────────────

describe('ResponseSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174004',
    commandId: '123e4567-e89b-12d3-a456-426614174003',
    agentId: '123e4567-e89b-12d3-a456-426614174000',
    output: 'Here is the auth module implementation...',
    artifacts: ['src/auth.ts'],
    partial: false,
  }

  it('parses a valid response', () => {
    expect(() => ResponseSchema.parse(valid)).not.toThrow()
  })

  it('parses a partial response', () => {
    expect(() => ResponseSchema.parse({ ...valid, partial: true, output: 'Working on it...' })).not.toThrow()
  })
})

// ─── ContextBlock ─────────────────────────────────────────────────────────────

describe('ContextBlockSchema', () => {
  const valid = {
    id: '123e4567-e89b-12d3-a456-426614174005',
    source: 'vault',
    title: 'Coding Rules',
    content: '# Rules\n- Use TypeScript strict mode',
    tags: ['rules', 'typescript'],
  }

  it('parses a valid context block', () => {
    expect(() => ContextBlockSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid source', () => {
    expect(() => ContextBlockSchema.parse({ ...valid, source: 'obsidian' })).toThrow()
  })
})

// ─── ProjectProfile ───────────────────────────────────────────────────────────

describe('ProjectProfileSchema', () => {
  const valid = {
    repoPath: '/home/user/my-project',
    vaultPath: '/home/user/obsidian-vault',
    rules: ['use-typescript', 'test-everything'],
    settings: { theme: 'dark' },
  }

  it('parses a valid project profile', () => {
    expect(() => ProjectProfileSchema.parse(valid)).not.toThrow()
  })

  it('accepts null vaultPath', () => {
    expect(() => ProjectProfileSchema.parse({ ...valid, vaultPath: null })).not.toThrow()
  })

  it('rejects empty repoPath', () => {
    expect(() => ProjectProfileSchema.parse({ ...valid, repoPath: '' })).toThrow()
  })
})

// ─── PumiceEvent ──────────────────────────────────────────────────────────────

describe('PumiceEventSchema', () => {
  const valid = {
    type: 'agent.registered',
    timestamp: '2026-03-19T00:00:00.000Z',
    payload: { agentId: '123e4567-e89b-12d3-a456-426614174000' },
  }

  it('parses a valid event', () => {
    expect(() => PumiceEventSchema.parse(valid)).not.toThrow()
  })

  it('rejects unknown event type', () => {
    expect(() => PumiceEventSchema.parse({ ...valid, type: 'agent.deleted' })).toThrow()
  })
})
