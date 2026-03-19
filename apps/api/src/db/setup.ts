import Database from 'better-sqlite3'
import path from 'path'

export function createDb(dbPath?: string): Database.Database {
  const resolved = dbPath ?? path.join(process.cwd(), 'pumice.db')
  const db = new Database(resolved)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      provider    TEXT NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      status      TEXT NOT NULL DEFAULT 'offline',
      last_seen   TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_tokens (
      agent_id     TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
      token        TEXT NOT NULL UNIQUE,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flows (
      id      TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      goal    TEXT NOT NULL,
      steps   TEXT NOT NULL DEFAULT '[]',
      policy  TEXT NOT NULL DEFAULT 'serial'
    );

    CREATE TABLE IF NOT EXISTS runs (
      id          TEXT PRIMARY KEY,
      flow_id     TEXT NOT NULL REFERENCES flows(id),
      status      TEXT NOT NULL DEFAULT 'pending',
      started_at  TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS commands (
      id      TEXT PRIMARY KEY,
      run_id  TEXT NOT NULL REFERENCES runs(id),
      target  TEXT NOT NULL,
      payload TEXT NOT NULL,
      status  TEXT NOT NULL DEFAULT 'queued'
    );

    CREATE TABLE IF NOT EXISTS command_deliveries (
      command_id    TEXT NOT NULL REFERENCES commands(id) ON DELETE CASCADE,
      agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'queued',
      delivered_at  TEXT,
      completed_at  TEXT,
      PRIMARY KEY (command_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS responses (
      id          TEXT PRIMARY KEY,
      command_id  TEXT NOT NULL REFERENCES commands(id),
      agent_id    TEXT NOT NULL REFERENCES agents(id),
      output      TEXT NOT NULL,
      artifacts   TEXT NOT NULL DEFAULT '[]',
      partial     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id           TEXT PRIMARY KEY,
      run_id       TEXT NOT NULL REFERENCES runs(id),
      step_id      TEXT NOT NULL,
      attempt      INTEGER NOT NULL DEFAULT 1,
      status       TEXT NOT NULL DEFAULT 'pending',
      command_id   TEXT REFERENCES commands(id),
      started_at   TEXT,
      completed_at TEXT,
      error        TEXT,
      UNIQUE(run_id, step_id)
    );

    CREATE TABLE IF NOT EXISTS context_blocks (
      id      TEXT PRIMARY KEY,
      source  TEXT NOT NULL,
      title   TEXT NOT NULL,
      content TEXT NOT NULL,
      tags    TEXT NOT NULL DEFAULT '[]'
    );
  `)

  return db
}
