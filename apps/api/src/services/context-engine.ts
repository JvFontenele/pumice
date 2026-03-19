import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type Database from 'better-sqlite3'
import type { ContextBlock, ContextSource } from '@pumice/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbContextBlock {
  id: string
  source: string
  title: string
  content: string
  tags: string
  created_at: string
}

function toBlock(row: DbContextBlock): ContextBlock {
  return {
    id: row.id,
    source: row.source as ContextSource,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags) as string[],
  }
}

// ─── Token estimation ─────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token (adequate for composition budgeting). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function listBlocks(db: Database.Database, source?: ContextSource): ContextBlock[] {
  const rows = source
    ? (db.prepare('SELECT * FROM context_blocks WHERE source = ? ORDER BY created_at').all(source) as DbContextBlock[])
    : (db.prepare('SELECT * FROM context_blocks ORDER BY source, created_at').all() as DbContextBlock[])
  return rows.map(toBlock)
}

export function getBlock(db: Database.Database, id: string): ContextBlock | null {
  const row = db.prepare('SELECT * FROM context_blocks WHERE id = ?').get(id) as DbContextBlock | undefined
  return row ? toBlock(row) : null
}

export function addBlock(
  db: Database.Database,
  block: Omit<ContextBlock, 'id'>,
): ContextBlock {
  const id = randomUUID()
  db.prepare(`
    INSERT INTO context_blocks (id, source, title, content, tags)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, block.source, block.title, block.content, JSON.stringify(block.tags))
  return { ...block, id }
}

export function removeBlock(db: Database.Database, id: string): boolean {
  const result = db.prepare('DELETE FROM context_blocks WHERE id = ?').run(id)
  return result.changes > 0
}

export function clearBlocksBySource(db: Database.Database, source: ContextSource): number {
  const result = db.prepare('DELETE FROM context_blocks WHERE source = ?').run(source)
  return result.changes
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}

// ─── Vault indexing ───────────────────────────────────────────────────────────

interface IndexResult {
  indexed: number
  skipped: number
  errors: string[]
}

/**
 * Recursively reads all .md files under vaultPath.
 * Clears existing vault blocks, then inserts fresh ones.
 * Respects Obsidian frontmatter (strips --- blocks).
 */
export function indexVault(db: Database.Database, vaultPath: string): IndexResult {
  const resolved = path.resolve(vaultPath)
  if (!fs.existsSync(resolved)) {
    throw new Error(`Vault path does not exist: ${resolved}`)
  }

  const result: IndexResult = { indexed: 0, skipped: 0, errors: [] }
  const files = collectMarkdownFiles(resolved)

  const insert = db.transaction((mdFiles: string[]) => {
    clearBlocksBySource(db, 'vault')
    for (const file of mdFiles) {
      try {
        const raw = fs.readFileSync(file, 'utf8')
        const { title, content, tags } = parseMarkdown(file, raw)
        if (!content.trim()) { result.skipped++; continue }
        addBlock(db, { source: 'vault', title, content, tags })
        result.indexed++
      } catch (err) {
        result.errors.push(`${path.relative(resolved, file)}: ${String(err)}`)
      }
    }
  })

  insert(files)
  setSetting(db, 'vault_path', resolved)

  return result
}

function collectMarkdownFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue // skip hidden dirs/files
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...collectMarkdownFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full)
    }
  }
  return results
}

function parseMarkdown(filePath: string, raw: string): { title: string; content: string; tags: string[] } {
  let content = raw
  const tags: string[] = []

  // Strip YAML frontmatter and extract tags
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fmMatch) {
    content = raw.slice(fmMatch[0].length)
    const tagsMatch = fmMatch[1].match(/^tags:\s*\[([^\]]*)\]/m)
    if (tagsMatch) {
      tags.push(...tagsMatch[1].split(',').map((t) => t.trim().replace(/['"]/g, '')).filter(Boolean))
    }
    const tagsListMatch = fmMatch[1].match(/^tags:\s*\n((?:\s+-\s+.+\n?)+)/m)
    if (tagsListMatch) {
      tags.push(...tagsListMatch[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean))
    }
  }

  // Use H1 as title, or fall back to filename without extension
  const h1Match = content.match(/^#\s+(.+)$/m)
  const title = h1Match ? h1Match[1].trim() : path.basename(filePath, '.md')

  return { title, content: content.trim(), tags }
}

// ─── Context composition ──────────────────────────────────────────────────────

const PRIORITY: Record<ContextSource, number> = {
  manual:  3,
  vault:   2,
  runtime: 1,
}

export interface ComposeOptions {
  maxTokens?: number
  /** Extra text to inject as a runtime block (e.g. current run info). */
  runtimeText?: string
}

export interface ComposedContext {
  blocks: Array<ContextBlock & { tokens: number; included: boolean }>
  totalTokens: number
  truncated: boolean
  /** Final assembled string ready to be prepended to a prompt. */
  text: string
}

/**
 * Assembles a context string from all DB blocks.
 * Priority order: manual > vault > runtime.
 * Drops lower-priority blocks when budget is exceeded.
 */
export function composeContext(db: Database.Database, opts: ComposeOptions = {}): ComposedContext {
  const maxTokens = opts.maxTokens ?? 8_000
  const allBlocks = listBlocks(db)

  if (opts.runtimeText) {
    allBlocks.push({
      id: '__runtime__',
      source: 'runtime',
      title: 'Runtime Context',
      content: opts.runtimeText,
      tags: [],
    })
  }

  // Sort by priority descending
  allBlocks.sort((a, b) => PRIORITY[b.source] - PRIORITY[a.source])

  let usedTokens = 0
  let truncated = false
  const annotated = allBlocks.map((b) => {
    const tokens = estimateTokens(`## ${b.title}\n\n${b.content}\n\n`)
    const wouldFit = usedTokens + tokens <= maxTokens
    if (wouldFit) usedTokens += tokens
    else truncated = true
    return { ...b, tokens, included: wouldFit }
  })

  const included = annotated.filter((b) => b.included)
  const text = included
    .map((b) => `## ${b.title}\n\n${b.content}`)
    .join('\n\n---\n\n')

  return {
    blocks: annotated,
    totalTokens: usedTokens,
    truncated,
    text,
  }
}

// ─── Vault write-back ─────────────────────────────────────────────────────────

/**
 * Writes a handoff note to <vaultPath>/04-handoffs/<timestamp>.md
 * Returns the path of the created file.
 */
export function writeHandoff(vaultPath: string, content: string): string {
  const resolved = path.resolve(vaultPath)
  const dir = path.join(resolved, '04-handoffs')
  fs.mkdirSync(dir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const file = path.join(dir, `${stamp}.md`)
  fs.writeFileSync(file, `# Handoff ${stamp}\n\n${content}\n`)
  return file
}

/**
 * Appends a devlog entry to <vaultPath>/03-devlog/<YYYY-MM-DD>.md
 * Returns the path of the file.
 */
export function appendDevlog(vaultPath: string, content: string): string {
  const resolved = path.resolve(vaultPath)
  const dir = path.join(resolved, '03-devlog')
  fs.mkdirSync(dir, { recursive: true })

  const today = new Date().toISOString().slice(0, 10)
  const file = path.join(dir, `${today}.md`)

  const time = new Date().toLocaleTimeString('en-GB', { hour12: false })
  const entry = `\n## ${time}\n\n${content}\n`

  if (fs.existsSync(file)) {
    fs.appendFileSync(file, entry)
  } else {
    fs.writeFileSync(file, `# Devlog ${today}${entry}`)
  }

  return file
}
