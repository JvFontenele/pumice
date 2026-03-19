import type { FastifyInstance } from 'fastify'
import { CommandSchema } from '@pumice/types'
import { emitEvent } from './events'
import { pullQueuedCommands, queueCommand } from '../services/control-plane'

export async function commandRoutes(app: FastifyInstance) {
  app.post('/commands', async (req, reply) => {
    const body = req.body as { runId?: string; target?: string; payload?: string }

    if (!body?.runId || !body?.target || !body?.payload) {
      return reply.code(400).send({ error: 'runId, target and payload are required' })
    }

    const command = queueCommand(app.db, {
      runId: body.runId,
      target: body.target,
      payload: body.payload,
    })

    emitEvent({
      type: 'command.queued',
      timestamp: new Date().toISOString(),
      payload: command,
    })

    return reply.code(201).send({ command })
  })

  app.get('/agents/:agentId/commands', async (req, reply) => {
    const params = req.params as { agentId?: string }
    if (!params.agentId) {
      return reply.code(400).send({ error: 'agentId is required' })
    }

    const commands = pullQueuedCommands(app.db, params.agentId)

    for (const command of commands) {
      emitEvent({
        type: 'command.status_changed',
        timestamp: new Date().toISOString(),
        payload: CommandSchema.parse(command),
      })
    }

    return reply.send({ commands })
  })
}
