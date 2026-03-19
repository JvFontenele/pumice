import type { FastifyInstance } from 'fastify'
import { ContextSourceSchema } from '@pumice/types'
import {
  listBlocks,
  addBlock,
  removeBlock,
  indexVault,
  composeContext,
  writeHandoff,
  appendDevlog,
  getSetting,
  setSetting,
} from '../services/context-engine'

export async function contextRoutes(app: FastifyInstance) {
  // ─── Settings ─────────────────────────────────────────────────────────────

  app.get('/context/settings', async (_req, reply) => {
    const vaultPath = getSetting(app.db, 'vault_path')
    return reply.send({ vaultPath })
  })

  app.post('/context/settings', async (req, reply) => {
    const body = req.body as { vaultPath?: string }
    if (typeof body?.vaultPath !== 'string') {
      return reply.code(400).send({ error: 'vaultPath is required' })
    }
    setSetting(app.db, 'vault_path', body.vaultPath)
    return reply.send({ ok: true })
  })

  // ─── Blocks ───────────────────────────────────────────────────────────────

  app.get('/context/blocks', async (req, reply) => {
    const query = req.query as { source?: string }
    const source = query.source
      ? ContextSourceSchema.safeParse(query.source)
      : null

    if (source && !source.success) {
      return reply.code(400).send({ error: 'Invalid source' })
    }

    const blocks = listBlocks(app.db, source?.data)
    return reply.send({ blocks })
  })

  app.post('/context/blocks', async (req, reply) => {
    const body = req.body as { source?: string; title?: string; content?: string; tags?: unknown }
    const parsed = ContextSourceSchema.safeParse(body?.source)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid or missing source (runtime|vault|manual)' })
    }
    if (typeof body?.title !== 'string' || !body.title) {
      return reply.code(400).send({ error: 'title is required' })
    }
    if (typeof body?.content !== 'string') {
      return reply.code(400).send({ error: 'content is required' })
    }
    const tags = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t): t is string => typeof t === 'string') : []
    const block = addBlock(app.db, { source: parsed.data, title: body.title, content: body.content, tags })
    return reply.code(201).send({ block })
  })

  app.delete('/context/blocks/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const deleted = removeBlock(app.db, id)
    if (!deleted) return reply.code(404).send({ error: 'Block not found' })
    return reply.send({ ok: true })
  })

  // ─── Vault indexing ───────────────────────────────────────────────────────

  app.post('/context/index-vault', async (req, reply) => {
    const body = req.body as { vaultPath?: string }
    const vaultPath = body?.vaultPath ?? getSetting(app.db, 'vault_path')
    if (!vaultPath) {
      return reply.code(400).send({ error: 'vaultPath is required (or set it via POST /context/settings)' })
    }
    try {
      const result = indexVault(app.db, vaultPath)
      return reply.send(result)
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  // ─── Compose ──────────────────────────────────────────────────────────────

  app.post('/context/compose', async (req, reply) => {
    const body = req.body as { maxTokens?: number; runtimeText?: string } | null
    const composed = composeContext(app.db, {
      maxTokens: body?.maxTokens,
      runtimeText: body?.runtimeText,
    })
    return reply.send(composed)
  })

  // ─── Vault write-back ─────────────────────────────────────────────────────

  app.post('/context/handoff', async (req, reply) => {
    const body = req.body as { content?: string; vaultPath?: string }
    const vaultPath = body?.vaultPath ?? getSetting(app.db, 'vault_path')
    if (!vaultPath) {
      return reply.code(400).send({ error: 'vaultPath is required' })
    }
    if (typeof body?.content !== 'string' || !body.content) {
      return reply.code(400).send({ error: 'content is required' })
    }
    try {
      const file = writeHandoff(vaultPath, body.content)
      return reply.send({ file })
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/context/devlog', async (req, reply) => {
    const body = req.body as { content?: string; vaultPath?: string }
    const vaultPath = body?.vaultPath ?? getSetting(app.db, 'vault_path')
    if (!vaultPath) {
      return reply.code(400).send({ error: 'vaultPath is required' })
    }
    if (typeof body?.content !== 'string' || !body.content) {
      return reply.code(400).send({ error: 'content is required' })
    }
    try {
      const file = appendDevlog(vaultPath, body.content)
      return reply.send({ file })
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) })
    }
  })
}
