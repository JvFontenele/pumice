import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { buildServer } from '../server'
import { createDb } from '../db/setup'

function seedRun(db: Database.Database) {
  const flowId = randomUUID()
  const runId = randomUUID()

  db.prepare(`INSERT INTO flows (id, name, goal, steps, policy) VALUES (?, ?, ?, ?, ?)`).run(
    flowId,
    'Sprint 1 flow',
    'Exercise command queue',
    '[]',
    'serial'
  )
  db.prepare(`INSERT INTO runs (id, flow_id, status) VALUES (?, ?, ?)`).run(runId, flowId, 'running')

  return { flowId, runId }
}

describe('Sprint 1 control-plane routes', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('registers an agent and lists it for the UI', async () => {
    const app = buildServer({ db })

    const register = await app.inject({
      method: 'POST',
      url: '/agents/register',
      payload: {
        name: 'Codex Worker',
        provider: 'codex',
        capabilities: ['code', 'tests'],
      },
    })

    expect(register.statusCode).toBe(201)
    const registrationBody = register.json() as { agentId: string; token: string }
    expect(registrationBody.agentId).toBeTruthy()
    expect(registrationBody.token).toBeTruthy()

    const list = await app.inject({ method: 'GET', url: '/agents' })
    expect(list.statusCode).toBe(200)
    const listBody = list.json() as {
      agents: Array<{ id: string; name: string; provider: string; capabilities: string[]; status: string }>
    }

    expect(listBody.agents).toHaveLength(1)
    expect(listBody.agents[0]).toMatchObject({
      id: registrationBody.agentId,
      name: 'Codex Worker',
      provider: 'codex',
      capabilities: ['code', 'tests'],
      status: 'idle',
    })
  })

  it('queues a targeted command, delivers it to the agent, and completes it through responses', async () => {
    const app = buildServer({ db })
    const { runId } = seedRun(db)

    const register = await app.inject({
      method: 'POST',
      url: '/agents/register',
      payload: {
        name: 'Claude Adapter',
        provider: 'claude',
        capabilities: ['analysis'],
      },
    })
    const { agentId } = register.json() as { agentId: string }

    const queued = await app.inject({
      method: 'POST',
      url: '/commands',
      payload: {
        runId,
        target: agentId,
        payload: 'Inspect task',
      },
    })

    expect(queued.statusCode).toBe(201)
    const queuedBody = queued.json() as { command: { id: string; status: string } }
    expect(queuedBody.command.status).toBe('queued')

    const pulled = await app.inject({
      method: 'GET',
      url: `/agents/${agentId}/commands`,
    })

    expect(pulled.statusCode).toBe(200)
    const pulledBody = pulled.json() as { commands: Array<{ id: string; status: string; payload: string }> }
    expect(pulledBody.commands).toHaveLength(1)
    expect(pulledBody.commands[0]).toMatchObject({
      id: queuedBody.command.id,
      status: 'delivered',
      payload: 'Inspect task',
    })

    const partial = await app.inject({
      method: 'POST',
      url: '/responses',
      payload: {
        commandId: queuedBody.command.id,
        agentId,
        output: 'Working on it',
        partial: true,
      },
    })

    expect(partial.statusCode).toBe(201)
    expect((partial.json() as { command: { status: string } }).command.status).toBe('processing')

    const finalResponse = await app.inject({
      method: 'POST',
      url: '/responses',
      payload: {
        commandId: queuedBody.command.id,
        agentId,
        output: 'Finished',
        partial: false,
      },
    })

    expect(finalResponse.statusCode).toBe(201)
    expect((finalResponse.json() as { command: { status: string } }).command.status).toBe('completed')
  })

  it('delivers a broadcast command exactly once per agent', async () => {
    const app = buildServer({ db })
    const { runId } = seedRun(db)

    const registerOne = await app.inject({
      method: 'POST',
      url: '/agents/register',
      payload: {
        name: 'Agent One',
        provider: 'claude',
        capabilities: ['analysis'],
      },
    })
    const registerTwo = await app.inject({
      method: 'POST',
      url: '/agents/register',
      payload: {
        name: 'Agent Two',
        provider: 'codex',
        capabilities: ['code'],
      },
    })

    const { agentId: agentOneId } = registerOne.json() as { agentId: string }
    const { agentId: agentTwoId } = registerTwo.json() as { agentId: string }

    const queued = await app.inject({
      method: 'POST',
      url: '/commands',
      payload: {
        runId,
        target: 'broadcast',
        payload: 'All agents report status',
      },
    })
    const { command } = queued.json() as { command: { id: string } }

    const firstPull = await app.inject({ method: 'GET', url: `/agents/${agentOneId}/commands` })
    const secondPull = await app.inject({ method: 'GET', url: `/agents/${agentTwoId}/commands` })
    const duplicatePull = await app.inject({ method: 'GET', url: `/agents/${agentOneId}/commands` })

    expect((firstPull.json() as { commands: Array<{ id: string }> }).commands[0].id).toBe(command.id)
    expect((secondPull.json() as { commands: Array<{ id: string }> }).commands[0].id).toBe(command.id)
    expect((duplicatePull.json() as { commands: unknown[] }).commands).toHaveLength(0)
  })
})
