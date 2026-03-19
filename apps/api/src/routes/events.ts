import type { FastifyInstance } from 'fastify'
import type { PumiceEvent } from '@pumice/types'

// In-memory subscriber list — replaced by real pub/sub in Sprint 1
type Subscriber = (event: PumiceEvent) => void
const subscribers = new Set<Subscriber>()

/** Broadcast an event to all connected SSE clients. */
export function emitEvent(event: PumiceEvent) {
  for (const sub of subscribers) {
    sub(event)
  }
}

export function subscribeToEvents(subscriber: Subscriber) {
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

export async function eventsRoutes(app: FastifyInstance) {
  /**
   * GET /events
   * Server-Sent Events stream. Clients receive all platform events in real-time.
   */
  app.get('/events', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('X-Accel-Buffering', 'no')
    reply.raw.flushHeaders()

    // Send a "connected" event immediately
    reply.raw.write(
      `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`
    )

    const subscriber: Subscriber = (event) => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
      }
    }

    subscribers.add(subscriber)

    req.raw.on('close', () => {
      subscribers.delete(subscriber)
    })

    // Keep-alive ping every 30s to prevent proxy timeouts
    const pingInterval = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(': ping\n\n')
      } else {
        clearInterval(pingInterval)
      }
    }, 30_000)

    req.raw.on('close', () => clearInterval(pingInterval))

    // Never resolve — the connection stays open
    await new Promise<void>((resolve) => req.raw.on('close', resolve))
  })
}
