import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  AgentSchema,
  AgentStatusSchema,
  CommandSchema,
  CommandStatusSchema,
  type Agent,
  type AgentStatus,
  type Command,
} from '@pumice/types'
import type { AgentRegistration, PostResponsePayload, RegisterPayload } from '@pumice/agent-sdk'

type AgentRow = {
  id: string
  name: string
  provider: Agent['provider']
  capabilities: string
  status: AgentStatus
  last_seen: string | null
}

type CommandRow = {
  id: string
  run_id: string
  target: string
  payload: string
  status: Command['status']
}

type DeliveryRow = {
  status: Command['status']
}

function nowIso() {
  return new Date().toISOString()
}

function mapAgent(row: AgentRow): Agent {
  return AgentSchema.parse({
    id: row.id,
    name: row.name,
    provider: row.provider,
    capabilities: JSON.parse(row.capabilities) as string[],
    status: row.status,
    lastSeen: row.last_seen,
  })
}

function mapCommand(row: CommandRow): Command {
  return CommandSchema.parse({
    id: row.id,
    runId: row.run_id,
    target: row.target,
    payload: row.payload,
    status: row.status,
  })
}

export function listAgents(db: Database.Database): Agent[] {
  const rows = db.prepare(`SELECT * FROM agents ORDER BY name ASC`).all() as AgentRow[]
  return rows.map(mapAgent)
}

export function registerAgent(db: Database.Database, payload: RegisterPayload): AgentRegistration {
  const agentId = randomUUID()
  const token = randomUUID()
  const timestamp = nowIso()

  db.prepare(
    `INSERT INTO agents (id, name, provider, capabilities, status, last_seen)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(agentId, payload.name, payload.provider, JSON.stringify(payload.capabilities), 'idle', timestamp)

  db.prepare(
    `INSERT INTO agent_tokens (agent_id, token, created_at) VALUES (?, ?, ?)`
  ).run(agentId, token, timestamp)

  return { agentId, token }
}

export function heartbeatAgent(db: Database.Database, agentId: string): Agent {
  const timestamp = nowIso()
  db.prepare(`UPDATE agents SET last_seen = ?, status = ? WHERE id = ?`).run(timestamp, 'idle', agentId)
  return getAgentOrThrow(db, agentId)
}

export function updateAgentStatus(db: Database.Database, agentId: string, status: AgentStatus): Agent {
  AgentStatusSchema.parse(status)
  db.prepare(`UPDATE agents SET status = ? WHERE id = ?`).run(status, agentId)
  return getAgentOrThrow(db, agentId)
}

export function queueCommand(
  db: Database.Database,
  payload: { runId: string; target: string; payload: string }
): Command {
  const commandId = randomUUID()
  db.prepare(
    `INSERT INTO commands (id, run_id, target, payload, status) VALUES (?, ?, ?, ?, ?)`
  ).run(commandId, payload.runId, payload.target, payload.payload, 'queued')

  const agents =
    payload.target === 'broadcast'
      ? (db.prepare(`SELECT id FROM agents ORDER BY name ASC`).all() as Array<{ id: string }>)
      : [{ id: payload.target }]

  const insertDelivery = db.prepare(
    `INSERT INTO command_deliveries (command_id, agent_id, status) VALUES (?, ?, ?)`
  )

  for (const agent of agents) {
    insertDelivery.run(commandId, agent.id, 'queued')
  }

  return getCommandOrThrow(db, commandId)
}

export function pullQueuedCommands(db: Database.Database, agentId: string): Command[] {
  const queued = db.prepare(
    `SELECT c.*
     FROM commands c
     INNER JOIN command_deliveries d ON d.command_id = c.id
     WHERE d.agent_id = ? AND d.status = 'queued'
     ORDER BY c.rowid ASC`
  ).all(agentId) as CommandRow[]

  if (queued.length === 0) {
    return []
  }

  const deliveredAt = nowIso()
  const updateDelivery = db.prepare(
    `UPDATE command_deliveries
     SET status = 'delivered', delivered_at = ?
     WHERE command_id = ? AND agent_id = ? AND status = 'queued'`
  )
  const updateCommand = db.prepare(`UPDATE commands SET status = 'delivered' WHERE id = ? AND status = 'queued'`)

  for (const command of queued) {
    updateDelivery.run(deliveredAt, command.id, agentId)
    updateCommand.run(command.id)
  }

  return queued.map((command) => mapCommand({ ...command, status: 'delivered' }))
}

export function saveResponse(db: Database.Database, payload: PostResponsePayload) {
  const responseId = randomUUID()
  const timestamp = nowIso()

  db.prepare(
    `INSERT INTO responses (id, command_id, agent_id, output, artifacts, partial)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    responseId,
    payload.commandId,
    payload.agentId,
    payload.output,
    JSON.stringify(payload.artifacts ?? []),
    payload.partial ? 1 : 0
  )

  db.prepare(
    `UPDATE command_deliveries
     SET status = ?, completed_at = CASE WHEN ? = 0 THEN ? ELSE completed_at END
     WHERE command_id = ? AND agent_id = ?`
  ).run(payload.partial ? 'processing' : 'completed', payload.partial ? 1 : 0, timestamp, payload.commandId, payload.agentId)

  const nextStatus = getAggregateCommandStatus(db, payload.commandId)
  db.prepare(`UPDATE commands SET status = ? WHERE id = ?`).run(nextStatus, payload.commandId)

  return {
    responseId,
    command: getCommandOrThrow(db, payload.commandId),
  }
}

function getAggregateCommandStatus(db: Database.Database, commandId: string): Command['status'] {
  const rows = db.prepare(`SELECT status FROM command_deliveries WHERE command_id = ?`).all(commandId) as DeliveryRow[]

  if (rows.length === 0) {
    return 'queued'
  }

  const statuses = rows.map((row) => CommandStatusSchema.parse(row.status))

  if (statuses.every((status) => status === 'completed')) {
    return 'completed'
  }

  if (statuses.some((status) => status === 'processing')) {
    return 'processing'
  }

  if (statuses.some((status) => status === 'delivered')) {
    return 'delivered'
  }

  if (statuses.every((status) => status === 'failed')) {
    return 'failed'
  }

  return 'queued'
}

function getAgentOrThrow(db: Database.Database, agentId: string): Agent {
  const row = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(agentId) as AgentRow | undefined
  if (!row) {
    throw new Error(`Agent not found: ${agentId}`)
  }
  return mapAgent(row)
}

function getCommandOrThrow(db: Database.Database, commandId: string): Command {
  const row = db.prepare(`SELECT * FROM commands WHERE id = ?`).get(commandId) as CommandRow | undefined
  if (!row) {
    throw new Error(`Command not found: ${commandId}`)
  }
  return mapCommand(row)
}
