import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../server'
import { createDb } from '../db/setup'
import type Database from 'better-sqlite3'

let db: Database.Database

beforeAll(() => {
  db = createDb(':memory:')
})

afterAll(() => {
  db.close()
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = buildServer({ db })
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
    expect(body.version).toBe('0.0.1')
  })

  it('timestamp is a valid ISO date', async () => {
    const app = buildServer({ db })
    const res = await app.inject({ method: 'GET', url: '/health' })
    const body = res.json()
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow()
  })
})
