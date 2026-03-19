import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import { FlowSchema, FlowStepSchema, RunSchema, RunStepSchema, type Flow, type FlowStep, type FlowPolicy, type Run, type RunStep } from '@pumice/types'

// ─── Row types ────────────────────────────────────────────────────────────────

type FlowRow = { id: string; name: string; goal: string; steps: string; policy: string }
type RunRow = { id: string; flow_id: string; status: string; started_at: string | null; finished_at: string | null }
type StepRow = {
  id: string
  run_id: string
  step_id: string
  attempt: number
  status: string
  command_id: string | null
  started_at: string | null
  completed_at: string | null
  error: string | null
}

export type DagTransition = {
  run: Run
  startedSteps: RunStep[]
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString()
}

function parseFlow(row: FlowRow): Flow {
  return FlowSchema.parse({
    id: row.id,
    name: row.name,
    goal: row.goal,
    steps: JSON.parse(row.steps) as FlowStep[],
    policy: row.policy as FlowPolicy,
  })
}

function parseRun(row: RunRow): Run {
  return RunSchema.parse({
    id: row.id,
    flowId: row.flow_id,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  })
}

function parseStep(row: StepRow): RunStep {
  return RunStepSchema.parse({
    id: row.id,
    runId: row.run_id,
    stepId: row.step_id,
    attempt: row.attempt,
    status: row.status,
    commandId: row.command_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    error: row.error,
  })
}

// ─── Flow CRUD ────────────────────────────────────────────────────────────────

export function createFlow(
  db: Database.Database,
  payload: { name: string; goal: string; steps: FlowStep[]; policy: FlowPolicy }
): Flow {
  validateFlowDefinition(payload.steps)
  const id = randomUUID()
  db.prepare(
    `INSERT INTO flows (id, name, goal, steps, policy) VALUES (?, ?, ?, ?, ?)`
  ).run(id, payload.name, payload.goal, JSON.stringify(payload.steps), payload.policy)

  return parseFlow(db.prepare(`SELECT * FROM flows WHERE id = ?`).get(id) as FlowRow)
}

export function listFlows(db: Database.Database): Flow[] {
  const rows = db.prepare(`SELECT * FROM flows ORDER BY rowid ASC`).all() as FlowRow[]
  return rows.map(parseFlow)
}

export function getFlowById(db: Database.Database, flowId: string): Flow | null {
  const row = db.prepare(`SELECT * FROM flows WHERE id = ?`).get(flowId) as FlowRow | undefined
  return row ? parseFlow(row) : null
}

// ─── Run management ───────────────────────────────────────────────────────────

export function startRun(db: Database.Database, flowId: string): DagTransition {
  const flowRow = db.prepare(`SELECT * FROM flows WHERE id = ?`).get(flowId) as FlowRow | undefined
  if (!flowRow) throw new Error(`Flow not found: ${flowId}`)

  const flow = parseFlow(flowRow)
  const runId = randomUUID()
  const now = nowIso()

  db.prepare(
    `INSERT INTO runs (id, flow_id, status, started_at) VALUES (?, ?, ?, ?)`
  ).run(runId, flowId, 'running', now)

  // Create a run_step row for every flow step
  for (const step of flow.steps) {
    db.prepare(
      `INSERT INTO run_steps (id, run_id, step_id, attempt, status) VALUES (?, ?, ?, ?, ?)`
    ).run(randomUUID(), runId, step.id, 1, 'pending')
  }

  // Kick off first wave of commands
  const transition = advanceDag(db, runId)

  return {
    run: transition.run,
    startedSteps: transition.startedSteps,
  }
}

export function getRunWithTimeline(
  db: Database.Database,
  runId: string
): { run: Run; steps: RunStep[] } | null {
  const runRow = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined
  if (!runRow) return null

  const steps = getRunTimeline(db, runId)
  return { run: parseRun(runRow), steps }
}

export function getRunTimeline(db: Database.Database, runId: string): RunStep[] {
  const rows = db.prepare(
    `SELECT * FROM run_steps WHERE run_id = ? ORDER BY rowid ASC`
  ).all(runId) as StepRow[]
  return rows.map(parseStep)
}

// ─── DAG executor ─────────────────────────────────────────────────────────────

export function advanceDag(db: Database.Database, runId: string): DagTransition {
  const runRow = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined
  if (!runRow) {
    throw new Error(`Run not found: ${runId}`)
  }
  if (['completed', 'failed', 'cancelled'].includes(runRow.status)) {
    return { run: parseRun(runRow), startedSteps: [] }
  }

  const flowRow = db.prepare(`SELECT * FROM flows WHERE id = ?`).get(runRow.flow_id) as FlowRow
  const flow = parseFlow(flowRow)

  const stepRows = db.prepare(
    `SELECT * FROM run_steps WHERE run_id = ?`
  ).all(runId) as StepRow[]

  const stepStatus = new Map<string, string>(stepRows.map((r) => [r.step_id, r.status]))

  // Check terminal: all completed
  if (flow.steps.every((s) => stepStatus.get(s.id) === 'completed')) {
    db.prepare(`UPDATE runs SET status = ?, finished_at = ? WHERE id = ?`).run('completed', nowIso(), runId)
    return { run: getRunOrThrow(db, runId), startedSteps: [] }
  }

  // Check terminal: any hard-failed (retries exhausted)
  if (flow.steps.some((s) => stepStatus.get(s.id) === 'failed')) {
    db.prepare(`UPDATE runs SET status = ?, finished_at = ? WHERE id = ?`).run('failed', nowIso(), runId)
    return { run: getRunOrThrow(db, runId), startedSteps: [] }
  }

  // Find steps ready to execute (pending + all dependencies completed)
  const readySteps = flow.steps.filter((step) => {
    if (stepStatus.get(step.id) !== 'pending') return false
    return step.dependsOn.every((depId) => stepStatus.get(depId) === 'completed')
  })

  // serial policy: execute one at a time; parallel/mixed: all ready at once
  const toExecute = flow.policy === 'serial' ? readySteps.slice(0, 1) : readySteps

  const startedSteps: RunStep[] = []

  for (const step of toExecute) {
    startedSteps.push(queueStepCommand(db, runId, step, flow))
  }

  return { run: getRunOrThrow(db, runId), startedSteps }
}

function queueStepCommand(
  db: Database.Database,
  runId: string,
  step: FlowStep,
  flow: Flow
): RunStep {
  const commandId = randomUUID()
  const now = nowIso()
  const target = step.agentId ?? 'broadcast'
  const payload = JSON.stringify({ stepId: step.id, role: step.role, goal: flow.goal })

  db.prepare(
    `INSERT INTO commands (id, run_id, target, payload, status) VALUES (?, ?, ?, ?, ?)`
  ).run(commandId, runId, target, payload, 'queued')

  const agents: Array<{ id: string }> =
    target === 'broadcast'
      ? (db.prepare(`SELECT id FROM agents`).all() as Array<{ id: string }>)
      : [{ id: target }]

  for (const agent of agents) {
    db.prepare(
      `INSERT INTO command_deliveries (command_id, agent_id, status) VALUES (?, ?, ?)`
    ).run(commandId, agent.id, 'queued')
  }

  db.prepare(
    `UPDATE run_steps SET status = 'running', command_id = ?, started_at = ?
     WHERE run_id = ? AND step_id = ? AND status = 'pending'`
  ).run(commandId, now, runId, step.id)

  const stepRow = db.prepare(
    `SELECT * FROM run_steps WHERE run_id = ? AND step_id = ?`
  ).get(runId, step.id) as StepRow | undefined

  if (!stepRow) {
    throw new Error(`Run step not found after queueing: ${step.id}`)
  }

  return parseStep(stepRow)
}

function validateFlowDefinition(steps: FlowStep[]) {
  const parsedSteps = steps.map((step) => FlowStepSchema.parse(step))
  const stepIds = new Set(parsedSteps.map((step) => step.id))

  if (stepIds.size !== parsedSteps.length) {
    throw new Error('Flow contains duplicate step ids')
  }

  for (const step of parsedSteps) {
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        throw new Error(`Flow step "${step.id}" depends on unknown step "${depId}"`)
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const stepMap = new Map(parsedSteps.map((step) => [step.id, step]))

  function visit(stepId: string) {
    if (visited.has(stepId)) return
    if (visiting.has(stepId)) {
      throw new Error(`Flow contains a dependency cycle at "${stepId}"`)
    }

    visiting.add(stepId)
    const step = stepMap.get(stepId)
    if (!step) return

    for (const depId of step.dependsOn) {
      visit(depId)
    }

    visiting.delete(stepId)
    visited.add(stepId)
  }

  for (const step of parsedSteps) {
    visit(step.id)
  }
}

// ─── Response hooks ───────────────────────────────────────────────────────────

/**
 * Called after a final successful response is saved.
 * Returns the runId if this command belonged to a flow step, null otherwise.
 */
export function onCommandCompleted(db: Database.Database, commandId: string): DagTransition | null {
  const stepRow = db.prepare(
    `SELECT * FROM run_steps WHERE command_id = ?`
  ).get(commandId) as StepRow | undefined
  if (!stepRow) return null

  db.prepare(
    `UPDATE run_steps SET status = 'completed', completed_at = ? WHERE command_id = ?`
  ).run(nowIso(), commandId)

  return advanceDag(db, stepRow.run_id)
}

/**
 * Called after a final failed response is saved.
 * Handles retry logic: retries up to retryPolicy.maxRetries, then hard-fails the step.
 * Returns the runId if this command belonged to a flow step, null otherwise.
 */
export function onCommandFailed(
  db: Database.Database,
  commandId: string,
  error: string
): (DagTransition & { retrying: boolean }) | null {
  const stepRow = db.prepare(
    `SELECT * FROM run_steps WHERE command_id = ?`
  ).get(commandId) as StepRow | undefined
  if (!stepRow) return null

  const runRow = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(stepRow.run_id) as RunRow
  const flowRow = db.prepare(`SELECT * FROM flows WHERE id = ?`).get(runRow.flow_id) as FlowRow
  const flow = parseFlow(flowRow)
  const flowStep = flow.steps.find((s) => s.id === stepRow.step_id)
  const maxRetries = flowStep?.retryPolicy?.maxRetries ?? 0

  if (stepRow.attempt <= maxRetries) {
    // Retry: reset to pending with incremented attempt, clear command reference
    db.prepare(
      `UPDATE run_steps
       SET status = 'pending', attempt = ?, command_id = NULL, error = ?, completed_at = NULL
       WHERE command_id = ?`
    ).run(stepRow.attempt + 1, error, commandId)

    const transition = advanceDag(db, stepRow.run_id)
    return { ...transition, retrying: true }
  }

  // No more retries: hard fail
  db.prepare(
    `UPDATE run_steps SET status = 'failed', error = ?, completed_at = ? WHERE command_id = ?`
  ).run(error, nowIso(), commandId)

  const transition = advanceDag(db, stepRow.run_id)
  return { ...transition, retrying: false }
}

function getRunOrThrow(db: Database.Database, runId: string): Run {
  const row = db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined
  if (!row) {
    throw new Error(`Run not found: ${runId}`)
  }
  return parseRun(row)
}
