import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type Database from 'better-sqlite3'
import { buildServer } from '../server'
import { createDb } from '../db/setup'
import type { PumiceEvent, Run, RunStep } from '@pumice/types'
import { subscribeToEvents } from './events'

type FlowBody = { flow: { id: string; name: string; steps: unknown[] } }
type RunBody = { run: Run }
type RunDetail = { run: Run; steps: RunStep[] }

function findLastEvent(events: PumiceEvent[], type: PumiceEvent['type']) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type === type) {
      return event
    }
  }

  return undefined
}

describe('Sprint 3 — Dynamic Flows', () => {
  let db: Database.Database
  let capturedEvents: PumiceEvent[]
  let unsubscribe: (() => void) | null

  beforeEach(() => {
    db = createDb(':memory:')
    capturedEvents = []
    unsubscribe = subscribeToEvents((event) => {
      capturedEvents.push(event)
    })
  })

  afterEach(() => {
    unsubscribe?.()
    db.close()
  })

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async function registerAgent(app: ReturnType<typeof buildServer>, name: string, provider = 'claude') {
    const res = await app.inject({
      method: 'POST',
      url: '/agents/register',
      payload: { name, provider, capabilities: ['code'] },
    })
    return (res.json() as { agentId: string }).agentId
  }

  async function createFlow(
    app: ReturnType<typeof buildServer>,
    payload: { name: string; goal: string; steps: unknown[]; policy?: string }
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/flows',
      payload: { policy: 'serial', ...payload },
    })
    expect(res.statusCode).toBe(201)
    return (res.json() as FlowBody).flow
  }

  async function startRun(app: ReturnType<typeof buildServer>, flowId: string) {
    const res = await app.inject({ method: 'POST', url: `/flows/${flowId}/runs` })
    expect(res.statusCode).toBe(201)
    return (res.json() as RunBody).run
  }

  async function getRun(app: ReturnType<typeof buildServer>, runId: string) {
    const res = await app.inject({ method: 'GET', url: `/runs/${runId}` })
    expect(res.statusCode).toBe(200)
    return res.json() as RunDetail
  }

  async function completeCommand(app: ReturnType<typeof buildServer>, commandId: string, agentId: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/responses',
      payload: { commandId, agentId, output: 'done', partial: false },
    })
    expect(res.statusCode).toBe(201)
    return res.json() as { command: { status: string } }
  }

  async function failCommand(
    app: ReturnType<typeof buildServer>,
    commandId: string,
    agentId: string,
    error = 'timeout'
  ) {
    const res = await app.inject({
      method: 'POST',
      url: '/responses',
      payload: { commandId, agentId, output: '', partial: false, failed: true, error },
    })
    expect(res.statusCode).toBe(201)
    return res.json()
  }

  // ─── Tests ──────────────────────────────────────────────────────────────────

  it('creates a flow and retrieves it by id', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'My Flow',
      goal: 'Build something',
      steps: [{ id: 'step-1', role: 'architect', agentId, dependsOn: [] }],
    })

    const res = await app.inject({ method: 'GET', url: `/flows/${flow.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as FlowBody
    expect(body.flow.name).toBe('My Flow')
  })

  it('serial flow: executes steps one at a time respecting dependencies', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Serial',
      goal: 'Two-step pipeline',
      policy: 'serial',
      steps: [
        { id: 'step-1', role: 'architect', agentId, dependsOn: [] },
        { id: 'step-2', role: 'backend', agentId, dependsOn: ['step-1'] },
      ],
    })

    const run = await startRun(app, flow.id)
    expect(run.status).toBe('running')

    // Only step-1 should be running after start
    let detail = await getRun(app, run.id)
    const step1 = detail.steps.find((s) => s.stepId === 'step-1')!
    const step2 = detail.steps.find((s) => s.stepId === 'step-2')!
    expect(step1.status).toBe('running')
    expect(step1.commandId).toBeTruthy()
    expect(step2.status).toBe('pending')

    // Agent pulls the command and completes step-1
    const pulledRes = await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    const commands = (pulledRes.json() as { commands: Array<{ id: string }> }).commands
    expect(commands).toHaveLength(1)

    await completeCommand(app, step1.commandId!, agentId)

    // Now step-2 should be running
    detail = await getRun(app, run.id)
    const step2After = detail.steps.find((s) => s.stepId === 'step-2')!
    expect(step2After.status).toBe('running')
    expect(step2After.commandId).toBeTruthy()
    expect(detail.run.status).toBe('running')

    // Complete step-2 → run should finish
    await completeCommand(app, step2After.commandId!, agentId)

    detail = await getRun(app, run.id)
    expect(detail.run.status).toBe('completed')
    expect(detail.steps.every((s) => s.status === 'completed')).toBe(true)
  })

  it('parallel flow: queues all ready steps at once', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Parallel',
      goal: 'Three independent tasks',
      policy: 'parallel',
      steps: [
        { id: 'task-a', role: 'worker', agentId, dependsOn: [] },
        { id: 'task-b', role: 'worker', agentId, dependsOn: [] },
        { id: 'task-c', role: 'worker', agentId, dependsOn: [] },
      ],
    })

    const run = await startRun(app, flow.id)

    const detail = await getRun(app, run.id)
    const runningSteps = detail.steps.filter((s) => s.status === 'running')
    expect(runningSteps).toHaveLength(3)
    expect(runningSteps.every((s) => s.commandId !== null)).toBe(true)

    const startedEvents = capturedEvents.filter((event) => event.type === 'run.step_started')
    expect(startedEvents).toHaveLength(3)
  })

  it('parallel flow with dependency: dependent step waits', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Mixed deps',
      goal: 'Build and test',
      policy: 'parallel',
      steps: [
        { id: 'build', role: 'builder', agentId, dependsOn: [] },
        { id: 'lint', role: 'linter', agentId, dependsOn: [] },
        { id: 'test', role: 'qa', agentId, dependsOn: ['build', 'lint'] },
      ],
    })

    const run = await startRun(app, flow.id)
    let detail = await getRun(app, run.id)

    // build and lint run immediately; test waits
    expect(detail.steps.find((s) => s.stepId === 'build')!.status).toBe('running')
    expect(detail.steps.find((s) => s.stepId === 'lint')!.status).toBe('running')
    expect(detail.steps.find((s) => s.stepId === 'test')!.status).toBe('pending')

    // Complete build
    await completeCommand(app, detail.steps.find((s) => s.stepId === 'build')!.commandId!, agentId)
    detail = await getRun(app, run.id)
    // test still waiting for lint
    expect(detail.steps.find((s) => s.stepId === 'test')!.status).toBe('pending')

    // Complete lint → test should now run
    await completeCommand(app, detail.steps.find((s) => s.stepId === 'lint')!.commandId!, agentId)
    detail = await getRun(app, run.id)
    expect(detail.steps.find((s) => s.stepId === 'test')!.status).toBe('running')
  })

  it('retry: retries step up to maxRetries times then fails the run', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Retry Flow',
      goal: 'Flaky step',
      policy: 'serial',
      steps: [
        {
          id: 'flaky',
          role: 'worker',
          agentId,
          dependsOn: [],
          retryPolicy: { maxRetries: 2, backoffMs: 0 },
        },
      ],
    })

    const run = await startRun(app, flow.id)

    // Attempt 1: fail
    let detail = await getRun(app, run.id)
    let cmdId = detail.steps.find((s) => s.stepId === 'flaky')!.commandId!
    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` }) // deliver
    await failCommand(app, cmdId, agentId, 'timeout')

    // Should retry: attempt 2
    detail = await getRun(app, run.id)
    let step = detail.steps.find((s) => s.stepId === 'flaky')!
    expect(step.status).toBe('running')
    expect(step.attempt).toBe(2)
    expect(detail.run.status).toBe('running')

    // Attempt 2: fail
    cmdId = step.commandId!
    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    await failCommand(app, cmdId, agentId, 'timeout')

    // Should retry: attempt 3
    detail = await getRun(app, run.id)
    step = detail.steps.find((s) => s.stepId === 'flaky')!
    expect(step.status).toBe('running')
    expect(step.attempt).toBe(3)

    // Attempt 3: fail → retries exhausted (maxRetries=2 means 1+2=3 total tries)
    cmdId = step.commandId!
    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    await failCommand(app, cmdId, agentId, 'timeout')

    detail = await getRun(app, run.id)
    step = detail.steps.find((s) => s.stepId === 'flaky')!
    expect(step.status).toBe('failed')
    expect(step.error).toBe('timeout')
    expect(detail.run.status).toBe('failed')

    const failedCommand = db
      .prepare(`SELECT status FROM commands WHERE id = ?`)
      .get(cmdId) as { status: string }
    expect(failedCommand.status).toBe('failed')
  })

  it('retry: succeeds on second attempt', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Recover Flow',
      goal: 'Step that recovers',
      policy: 'serial',
      steps: [
        {
          id: 'recovers',
          role: 'worker',
          agentId,
          dependsOn: [],
          retryPolicy: { maxRetries: 1, backoffMs: 0 },
        },
      ],
    })

    const run = await startRun(app, flow.id)

    let detail = await getRun(app, run.id)
    const cmdId1 = detail.steps.find((s) => s.stepId === 'recovers')!.commandId!
    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    await failCommand(app, cmdId1, agentId, 'transient error')

    // Now attempt 2 is running
    detail = await getRun(app, run.id)
    const cmdId2 = detail.steps.find((s) => s.stepId === 'recovers')!.commandId!
    expect(cmdId2).not.toBe(cmdId1)
    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    await completeCommand(app, cmdId2, agentId)

    detail = await getRun(app, run.id)
    expect(detail.run.status).toBe('completed')
    expect(detail.steps[0].status).toBe('completed')

    const finishedEvent = findLastEvent(capturedEvents, 'run.finished')
    expect(finishedEvent?.payload.status).toBe('completed')
  })

  it('GET /runs/:runId returns 404 for unknown run', async () => {
    const app = buildServer({ db })
    const res = await app.inject({ method: 'GET', url: '/runs/nonexistent' })
    expect(res.statusCode).toBe(404)
  })

  it('GET /flows/:flowId returns 404 for unknown flow', async () => {
    const app = buildServer({ db })
    const res = await app.inject({ method: 'GET', url: '/flows/nonexistent' })
    expect(res.statusCode).toBe(404)
  })

  it('POST /flows/:flowId/runs returns 404 for unknown flow', async () => {
    const app = buildServer({ db })
    const res = await app.inject({ method: 'POST', url: '/flows/nonexistent/runs' })
    expect(res.statusCode).toBe(404)
  })

  it('emits run.finished when retries are exhausted', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const flow = await createFlow(app, {
      name: 'Failing flow',
      goal: 'terminal failure',
      policy: 'serial',
      steps: [
        {
          id: 'fails',
          role: 'worker',
          agentId,
          dependsOn: [],
          retryPolicy: { maxRetries: 0, backoffMs: 0 },
        },
      ],
    })

    const run = await startRun(app, flow.id)
    const detail = await getRun(app, run.id)
    const cmdId = detail.steps[0].commandId!

    await app.inject({ method: 'GET', url: `/agents/${agentId}/commands` })
    await failCommand(app, cmdId, agentId, 'fatal')

    const finishedEvent = findLastEvent(capturedEvents, 'run.finished')
    expect(finishedEvent?.payload.status).toBe('failed')
  })

  it('rejects a flow with unknown dependency', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const res = await app.inject({
      method: 'POST',
      url: '/flows',
      payload: {
        name: 'Broken flow',
        goal: 'Invalid deps',
        policy: 'serial',
        steps: [{ id: 'step-1', role: 'architect', agentId, dependsOn: ['missing-step'] }],
      },
    })

    expect(res.statusCode).toBe(400)
  })

  it('rejects a flow with dependency cycle', async () => {
    const app = buildServer({ db })
    const agentId = await registerAgent(app, 'Claude')

    const res = await app.inject({
      method: 'POST',
      url: '/flows',
      payload: {
        name: 'Cyclic flow',
        goal: 'Invalid dag',
        policy: 'parallel',
        steps: [
          { id: 'step-1', role: 'a', agentId, dependsOn: ['step-2'] },
          { id: 'step-2', role: 'b', agentId, dependsOn: ['step-1'] },
        ],
      },
    })

    expect(res.statusCode).toBe(400)
  })
})
