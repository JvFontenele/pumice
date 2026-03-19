import type { FastifyInstance } from 'fastify'
import { getRunWithTimeline } from '../services/flow-engine'

export async function runRoutes(app: FastifyInstance) {
  app.get('/runs/:runId', async (req, reply) => {
    const params = req.params as { runId: string }
    const result = getRunWithTimeline(app.db, params.runId)
    if (!result) return reply.code(404).send({ error: 'Run not found' })
    return reply.send(result)
  })
}
