import type { FastifyInstance } from 'fastify'
import { FlowPolicySchema } from '@pumice/types'
import { emitEvent } from './events'
import { createFlow, getFlowById, listFlows, startRun } from '../services/flow-engine'

export async function flowRoutes(app: FastifyInstance) {
  app.post('/flows', async (req, reply) => {
    const body = req.body as {
      name?: string
      goal?: string
      steps?: unknown
      policy?: string
    }

    if (!body?.name || !body?.goal || !Array.isArray(body.steps)) {
      return reply.code(400).send({ error: 'name, goal and steps are required' })
    }

    const parsedPolicy = FlowPolicySchema.safeParse(body.policy ?? 'serial')
    if (!parsedPolicy.success) {
      return reply.code(400).send({ error: 'Invalid flow policy' })
    }

    const flow = createFlow(app.db, {
      name: body.name,
      goal: body.goal,
      steps: body.steps as never,
      policy: parsedPolicy.data,
    })

    return reply.code(201).send({ flow })
  })

  app.get('/flows', async (_req, reply) => {
    return reply.send({ flows: listFlows(app.db) })
  })

  app.get('/flows/:flowId', async (req, reply) => {
    const params = req.params as { flowId: string }
    const flow = getFlowById(app.db, params.flowId)
    if (!flow) return reply.code(404).send({ error: 'Flow not found' })
    return reply.send({ flow })
  })

  app.post('/flows/:flowId/runs', async (req, reply) => {
    const params = req.params as { flowId: string }

    const flow = getFlowById(app.db, params.flowId)
    if (!flow) return reply.code(404).send({ error: 'Flow not found' })

    const run = startRun(app.db, params.flowId)

    emitEvent({
      type: 'run.started',
      timestamp: new Date().toISOString(),
      payload: { runId: run.id, flowId: params.flowId },
    })

    return reply.code(201).send({ run })
  })
}
