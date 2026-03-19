import type { FastifyInstance } from 'fastify'
import { emitEvent } from './events'
import { saveResponse } from '../services/control-plane'

export async function responseRoutes(app: FastifyInstance) {
  app.post('/responses', async (req, reply) => {
    const body = req.body as {
      commandId?: string
      agentId?: string
      output?: string
      artifacts?: unknown
      partial?: boolean
    }

    if (!body?.commandId || !body?.agentId || typeof body.output !== 'string' || typeof body.partial !== 'boolean') {
      return reply.code(400).send({ error: 'Invalid response payload' })
    }

    const result = saveResponse(app.db, {
      commandId: body.commandId,
      agentId: body.agentId,
      output: body.output,
      artifacts: Array.isArray(body.artifacts)
        ? body.artifacts.filter((value): value is string => typeof value === 'string')
        : [],
      partial: body.partial,
    })

    emitEvent({
      type: body.partial ? 'response.partial' : 'response.final',
      timestamp: new Date().toISOString(),
      payload: {
        responseId: result.responseId,
        commandId: body.commandId,
        agentId: body.agentId,
      },
    })

    emitEvent({
      type: 'command.status_changed',
      timestamp: new Date().toISOString(),
      payload: result.command,
    })

    return reply.code(201).send({ responseId: result.responseId, command: result.command })
  })
}
