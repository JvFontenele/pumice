import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { createDb } from '../db/setup'
import { buildServer } from '../server'
import type Database from 'better-sqlite3'
import type { FastifyInstance } from 'fastify'
import {
  addBlock,
  listBlocks,
  removeBlock,
  estimateTokens,
  indexVault,
  composeContext,
  writeHandoff,
  appendDevlog,
  getSetting,
  setSetting,
} from '../services/context-engine'

// ─── Unit tests (service) ─────────────────────────────────────────────────────

describe('context-engine service', () => {
  let db: Database.Database

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('estimateTokens returns ceiling of chars/4', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
    expect(estimateTokens('')).toBe(0)
  })

  it('addBlock and listBlocks round-trip', () => {
    const block = addBlock(db, { source: 'manual', title: 'Rules', content: 'Never break prod.', tags: ['ops'] })
    expect(block.id).toBeTruthy()
    const list = listBlocks(db)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Rules')
    expect(list[0].tags).toEqual(['ops'])
  })

  it('listBlocks filters by source', () => {
    addBlock(db, { source: 'manual', title: 'M', content: 'manual', tags: [] })
    addBlock(db, { source: 'vault', title: 'V', content: 'vault', tags: [] })
    expect(listBlocks(db, 'manual')).toHaveLength(1)
    expect(listBlocks(db, 'vault')).toHaveLength(1)
    expect(listBlocks(db)).toHaveLength(2)
  })

  it('removeBlock returns true and deletes the row', () => {
    const block = addBlock(db, { source: 'manual', title: 'Tmp', content: 'x', tags: [] })
    expect(removeBlock(db, block.id)).toBe(true)
    expect(listBlocks(db)).toHaveLength(0)
  })

  it('removeBlock returns false for unknown id', () => {
    expect(removeBlock(db, 'nonexistent')).toBe(false)
  })

  it('getSetting / setSetting round-trip', () => {
    expect(getSetting(db, 'vault_path')).toBeNull()
    setSetting(db, 'vault_path', '/tmp/vault')
    expect(getSetting(db, 'vault_path')).toBe('/tmp/vault')
    setSetting(db, 'vault_path', '/tmp/other')
    expect(getSetting(db, 'vault_path')).toBe('/tmp/other')
  })

  // ─── indexVault ──────────────────────────────────────────────────────────

  it('indexVault reads .md files and creates vault blocks', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    fs.writeFileSync(path.join(dir, 'rules.md'), '# Coding Rules\n\nNo globals.')
    fs.writeFileSync(path.join(dir, 'scope.md'), '# Scope\n\nMVP only.')
    fs.mkdirSync(path.join(dir, 'sub'))
    fs.writeFileSync(path.join(dir, 'sub', 'nested.md'), '# Nested\n\nContent.')

    const result = indexVault(db, dir)
    expect(result.indexed).toBe(3)
    expect(result.errors).toHaveLength(0)

    const blocks = listBlocks(db, 'vault')
    expect(blocks).toHaveLength(3)
    expect(blocks.map((b) => b.title).sort()).toEqual(['Coding Rules', 'Nested', 'Scope'])

    fs.rmSync(dir, { recursive: true })
  })

  it('indexVault clears old vault blocks before re-indexing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\ncontent')
    indexVault(db, dir)
    expect(listBlocks(db, 'vault')).toHaveLength(1)

    fs.writeFileSync(path.join(dir, 'b.md'), '# B\n\ncontent')
    indexVault(db, dir)
    expect(listBlocks(db, 'vault')).toHaveLength(2)

    fs.rmSync(dir, { recursive: true })
  })

  it('indexVault parses YAML frontmatter tags', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    fs.writeFileSync(path.join(dir, 'note.md'), '---\ntags: [security, auth]\n---\n# Auth Rules\n\nUse JWT.')

    indexVault(db, dir)
    const blocks = listBlocks(db, 'vault')
    expect(blocks[0].tags).toContain('security')
    expect(blocks[0].tags).toContain('auth')

    fs.rmSync(dir, { recursive: true })
  })

  it('indexVault skips empty files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    fs.writeFileSync(path.join(dir, 'empty.md'), '')
    const result = indexVault(db, dir)
    expect(result.skipped).toBe(1)
    expect(listBlocks(db, 'vault')).toHaveLength(0)
    fs.rmSync(dir, { recursive: true })
  })

  it('indexVault throws if vaultPath does not exist', () => {
    expect(() => indexVault(db, '/nonexistent/path/xyz')).toThrow()
  })

  // ─── composeContext ───────────────────────────────────────────────────────

  it('composeContext assembles text from all blocks', () => {
    addBlock(db, { source: 'manual', title: 'Rules', content: 'Be concise.', tags: [] })
    addBlock(db, { source: 'vault', title: 'Vision', content: 'Build fast.', tags: [] })
    const result = composeContext(db)
    expect(result.text).toContain('Rules')
    expect(result.text).toContain('Vision')
    expect(result.truncated).toBe(false)
    expect(result.totalTokens).toBeGreaterThan(0)
  })

  it('composeContext respects priority: manual > vault > runtime', () => {
    addBlock(db, { source: 'vault', title: 'V', content: 'vault', tags: [] })
    addBlock(db, { source: 'runtime', title: 'R', content: 'runtime', tags: [] })
    addBlock(db, { source: 'manual', title: 'M', content: 'manual', tags: [] })

    const result = composeContext(db)
    const sections = result.blocks.map((b) => b.source)
    expect(sections).toEqual(['manual', 'vault', 'runtime'])
  })

  it('composeContext respects maxTokens budget', () => {
    // Add a large block that will overflow a tiny budget
    addBlock(db, { source: 'manual', title: 'Big', content: 'x'.repeat(1000), tags: [] })
    addBlock(db, { source: 'vault', title: 'Small', content: 'tiny', tags: [] })

    const result = composeContext(db, { maxTokens: 50 })
    // The vault block should be excluded due to budget
    const included = result.blocks.filter((b) => b.included)
    expect(included.length).toBeLessThan(2)
    expect(result.truncated).toBe(true)
  })

  it('composeContext injects runtimeText as runtime block', () => {
    const result = composeContext(db, { runtimeText: 'Current task: fix bug #42' })
    expect(result.text).toContain('fix bug #42')
  })

  // ─── writeHandoff / appendDevlog ─────────────────────────────────────────

  it('writeHandoff creates a file in 04-handoffs/', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    const file = writeHandoff(dir, 'Next step: deploy to staging.')
    expect(fs.existsSync(file)).toBe(true)
    expect(file).toContain('04-handoffs')
    expect(fs.readFileSync(file, 'utf8')).toContain('Next step: deploy to staging.')
    fs.rmSync(dir, { recursive: true })
  })

  it('appendDevlog creates and appends to 03-devlog/<date>.md', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    appendDevlog(dir, 'First entry.')
    appendDevlog(dir, 'Second entry.')

    const today = new Date().toISOString().slice(0, 10)
    const file = path.join(dir, '03-devlog', `${today}.md`)
    expect(fs.existsSync(file)).toBe(true)
    const content = fs.readFileSync(file, 'utf8')
    expect(content).toContain('First entry.')
    expect(content).toContain('Second entry.')

    fs.rmSync(dir, { recursive: true })
  })
})

// ─── API route tests ──────────────────────────────────────────────────────────

describe('context API routes', () => {
  let db: Database.Database
  let app: FastifyInstance

  beforeEach(async () => {
    db = createDb(':memory:')
    app = buildServer({ db })
    await app.ready()
  })

  afterEach(() => app.close())

  it('GET /context/blocks returns empty list initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/context/blocks' })
    expect(res.statusCode).toBe(200)
    expect(res.json().blocks).toEqual([])
  })

  it('POST /context/blocks creates a manual block', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/context/blocks',
      payload: { source: 'manual', title: 'Rules', content: 'No globals.', tags: ['code'] },
    })
    expect(res.statusCode).toBe(201)
    const block = res.json().block
    expect(block.source).toBe('manual')
    expect(block.tags).toEqual(['code'])
  })

  it('POST /context/blocks returns 400 for invalid source', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/context/blocks',
      payload: { source: 'unknown', title: 'T', content: 'C' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE /context/blocks/:id removes the block', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/context/blocks',
      payload: { source: 'manual', title: 'Tmp', content: 'x', tags: [] },
    })
    const { id } = create.json().block
    const del = await app.inject({ method: 'DELETE', url: `/context/blocks/${id}` })
    expect(del.statusCode).toBe(200)
    const list = await app.inject({ method: 'GET', url: '/context/blocks' })
    expect(list.json().blocks).toHaveLength(0)
  })

  it('DELETE /context/blocks/:id returns 404 for unknown id', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/context/blocks/nonexistent' })
    expect(res.statusCode).toBe(404)
  })

  it('POST /context/index-vault indexes a real directory', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pumice-test-'))
    fs.writeFileSync(path.join(dir, 'vision.md'), '# Vision\n\nBe great.')

    const res = await app.inject({
      method: 'POST',
      url: '/context/index-vault',
      payload: { vaultPath: dir },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().indexed).toBe(1)

    fs.rmSync(dir, { recursive: true })
  })

  it('POST /context/index-vault returns 400 for nonexistent path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/context/index-vault',
      payload: { vaultPath: '/nonexistent/xyz' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /context/compose returns assembled text', async () => {
    await app.inject({
      method: 'POST',
      url: '/context/blocks',
      payload: { source: 'manual', title: 'Rules', content: 'Keep it simple.', tags: [] },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/context/compose',
      payload: { maxTokens: 4000 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.text).toContain('Keep it simple.')
    expect(typeof body.totalTokens).toBe('number')
    expect(typeof body.truncated).toBe('boolean')
  })

  it('GET /context/settings returns null vaultPath initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/context/settings' })
    expect(res.statusCode).toBe(200)
    expect(res.json().vaultPath).toBeNull()
  })

  it('POST /context/settings persists vault path', async () => {
    await app.inject({
      method: 'POST',
      url: '/context/settings',
      payload: { vaultPath: '/tmp/my-vault' },
    })
    const res = await app.inject({ method: 'GET', url: '/context/settings' })
    expect(res.json().vaultPath).toBe('/tmp/my-vault')
  })
})
