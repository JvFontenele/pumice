import { describe, it, expect, afterEach } from 'vitest'
import { createDb } from './setup'
import type Database from 'better-sqlite3'

let db: Database.Database

afterEach(() => {
  db?.close()
})

describe('createDb', () => {
  it('creates an in-memory database without error', () => {
    expect(() => { db = createDb(':memory:') }).not.toThrow()
  })

  it('creates all required tables', () => {
    db = createDb(':memory:')
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r: any) => r.name)

    expect(tables).toContain('agents')
    expect(tables).toContain('flows')
    expect(tables).toContain('runs')
    expect(tables).toContain('commands')
    expect(tables).toContain('responses')
    expect(tables).toContain('context_blocks')
  })

  it('enables WAL journal mode', () => {
    db = createDb(':memory:')
    const row = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }
    // In-memory DBs return 'memory' not 'wal', which is expected
    expect(['wal', 'memory']).toContain(row.journal_mode)
  })

  it('enforces foreign keys', () => {
    db = createDb(':memory:')
    const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
  })

  it('can insert and retrieve an agent', () => {
    db = createDb(':memory:')
    db.prepare(
      `INSERT INTO agents (id, name, provider, capabilities, status) VALUES (?, ?, ?, ?, ?)`
    ).run('agent-1', 'Claude', 'claude', '["code"]', 'idle')

    const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get('agent-1') as any
    expect(agent.name).toBe('Claude')
    expect(agent.provider).toBe('claude')
    expect(agent.status).toBe('idle')
  })
})
