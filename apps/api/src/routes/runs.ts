import type { FastifyInstance } from 'fastify'
import { getRunWithTimeline } from '../services/flow-engine'

type RunListRow = {
  id: string
  flow_id: string
  flow_name: string
  status: string
  started_at: string | null
  finished_at: string | null
  total_steps: number
  completed_steps: number
}

export async function runRoutes(app: FastifyInstance) {
  app.get('/runs', async (_req, reply) => {
    const rows = app.db.prepare(`
      SELECT r.id, r.flow_id, r.status, r.started_at, r.finished_at,
             f.name AS flow_name,
             COUNT(rs.id)                                          AS total_steps,
             SUM(CASE WHEN rs.status = 'completed' THEN 1 ELSE 0 END) AS completed_steps
      FROM runs r
      JOIN flows f ON f.id = r.flow_id
      LEFT JOIN run_steps rs ON rs.run_id = r.id
      GROUP BY r.id
      ORDER BY r.rowid DESC
      LIMIT 100
    `).all() as RunListRow[]

    return reply.send({ runs: rows })
  })

  app.get('/runs/:runId', async (req, reply) => {
    const params = req.params as { runId: string }
    const result = getRunWithTimeline(app.db, params.runId)
    if (!result) return reply.code(404).send({ error: 'Run not found' })
    return reply.send(result)
  })
}
