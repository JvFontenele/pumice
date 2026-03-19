import type { FastifyInstance } from 'fastify'
import { AgentProviderSchema, AgentStatusSchema } from '@pumice/types'
import { emitEvent } from './events'
import { heartbeatAgent, listAgents, registerAgent, updateAgentStatus } from '../services/control-plane'

export async function agentRoutes(app: FastifyInstance) {
  app.get('/agents', async (_req, reply) => {
    return reply.send({ agents: listAgents(app.db) })
  })

  app.post('/agents/register', async (req, reply) => {
    const body = req.body as { name?: string; provider?: string; capabilities?: unknown }
    if (!body?.name || !body?.provider || !Array.isArray(body.capabilities)) {
      return reply.code(400).send({ error: 'Invalid registration payload' })
    }

    const parsedProvider = AgentProviderSchema.safeParse(body.provider)
    if (!parsedProvider.success) {
      return reply.code(400).send({ error: 'Invalid agent provider' })
    }

    const registration = registerAgent(app.db, {
      name: body.name,
      provider: parsedProvider.data,
      capabilities: body.capabilities.filter((value): value is string => typeof value === 'string'),
    })

    const agent = listAgents(app.db).find((item) => item.id === registration.agentId)
    if (agent) {
      emitEvent({
        type: 'agent.registered',
        timestamp: new Date().toISOString(),
        payload: agent,
      })
    }

    return reply.code(201).send(registration)
  })

  app.post('/agents/:agentId/heartbeat', async (req, reply) => {
    const params = req.params as { agentId?: string }
    if (!params.agentId) {
      return reply.code(400).send({ error: 'agentId is required' })
    }

    const agent = heartbeatAgent(app.db, params.agentId)
    emitEvent({
      type: 'agent.heartbeat',
      timestamp: new Date().toISOString(),
      payload: agent,
    })

    return reply.send({ ok: true, agent })
  })

  app.post('/agents/:agentId/status', async (req, reply) => {
    const params = req.params as { agentId?: string }
    const body = req.body as { status?: string }

    if (!params.agentId || !body?.status) {
      return reply.code(400).send({ error: 'agentId and status are required' })
    }

    const parsedStatus = AgentStatusSchema.safeParse(body.status)
    if (!parsedStatus.success) {
      return reply.code(400).send({ error: 'Invalid agent status' })
    }

    const agent = updateAgentStatus(app.db, params.agentId, parsedStatus.data)
    emitEvent({
      type: 'agent.status_changed',
      timestamp: new Date().toISOString(),
      payload: agent,
    })

    return reply.send({ ok: true, agent })
  })
}
