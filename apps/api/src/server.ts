import Fastify from 'fastify'
import type Database from 'better-sqlite3'
import { healthRoutes } from './routes/health'
import { eventsRoutes } from './routes/events'

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

  return app
}
