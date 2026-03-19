import type { FastifyInstance } from 'fastify'
import { emitEvent } from './events'
import { saveResponse } from '../services/control-plane'
import { onCommandCompleted, onCommandFailed } from '../services/flow-engine'

export async function responseRoutes(app: FastifyInstance) {
  app.post('/responses', async (req, reply) => {
    const body = req.body as {
      commandId?: string
      agentId?: string
      output?: string
      artifacts?: unknown
      partial?: boolean
      failed?: boolean
      error?: string
    }

    if (
      !body?.commandId ||
      !body?.agentId ||
      typeof body.output !== 'string' ||
      typeof body.partial !== 'boolean'
    ) {
      return reply.code(400).send({ error: 'Invalid response payload' })
    }

    const result = saveResponse(app.db, {
      commandId: body.commandId,
      agentId: body.agentId,
      output: body.output,
      artifacts: Array.isArray(body.artifacts)
        ? body.artifacts.filter((v): v is string => typeof v === 'string')
        : [],
      partial: body.partial,
      failed: body.failed === true,
    })

    emitEvent({
      type: body.partial ? 'response.partial' : 'response.final',
      timestamp: new Date().toISOString(),
      payload: { responseId: result.responseId, commandId: body.commandId, agentId: body.agentId },
    })

    emitEvent({
      type: 'command.status_changed',
      timestamp: new Date().toISOString(),
      payload: result.command,
    })

    // Hook into flow engine for final responses
    if (!body.partial) {
      const isFailed = body.failed === true

      if (isFailed) {
        const dagResult = onCommandFailed(
          app.db,
          body.commandId,
          body.error ?? 'agent reported failure'
        )
        if (dagResult) {
          for (const step of dagResult.startedSteps) {
            emitEvent({
              type: 'run.step_started',
              timestamp: new Date().toISOString(),
              payload: {
                runId: dagResult.run.id,
                stepId: step.stepId,
                commandId: step.commandId,
                attempt: step.attempt,
              },
            })
          }

          emitEvent({
            type: dagResult.retrying ? 'run.step_retrying' : 'run.step_failed',
            timestamp: new Date().toISOString(),
            payload: { runId: dagResult.run.id, commandId: body.commandId },
          })

          if (['completed', 'failed', 'cancelled'].includes(dagResult.run.status)) {
            emitEvent({
              type: 'run.finished',
              timestamp: new Date().toISOString(),
              payload: { runId: dagResult.run.id, status: dagResult.run.status },
            })
          }
        }
      } else {
        const dagResult = onCommandCompleted(app.db, body.commandId)
        if (dagResult) {
          for (const step of dagResult.startedSteps) {
            emitEvent({
              type: 'run.step_started',
              timestamp: new Date().toISOString(),
              payload: {
                runId: dagResult.run.id,
                stepId: step.stepId,
                commandId: step.commandId,
                attempt: step.attempt,
              },
            })
          }

          emitEvent({
            type: 'run.step_completed',
            timestamp: new Date().toISOString(),
            payload: { runId: dagResult.run.id, commandId: body.commandId },
          })

          if (['completed', 'failed', 'cancelled'].includes(dagResult.run.status)) {
            emitEvent({
              type: 'run.finished',
              timestamp: new Date().toISOString(),
              payload: { runId: dagResult.run.id, status: dagResult.run.status },
            })
          }
        }
      }
    }

    return reply.code(201).send({ responseId: result.responseId, command: result.command })
  })
}
