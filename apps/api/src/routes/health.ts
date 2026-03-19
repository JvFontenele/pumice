import type { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.0.1',
    })
  })
}
