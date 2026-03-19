import Fastify from 'fastify'
import type Database from 'better-sqlite3'
import { agentRoutes } from './routes/agents'
import { commandRoutes } from './routes/commands'
import { flowRoutes } from './routes/flows'
import { healthRoutes } from './routes/health'
import { eventsRoutes } from './routes/events'
import { responseRoutes } from './routes/responses'
import { runRoutes } from './routes/runs'

export interface ServerOptions {
  db: Database.Database
  logger?: boolean
}

export function buildServer(opts: ServerOptions) {
  const app = Fastify({ logger: opts.logger ?? false })

  // Decorate with db so routes can access it
  app.decorate('db', opts.db)

  app.register(healthRoutes)
  app.register(eventsRoutes)
  app.register(agentRoutes)
  app.register(commandRoutes)
  app.register(responseRoutes)
  app.register(flowRoutes)
  app.register(runRoutes)

  return app
}
