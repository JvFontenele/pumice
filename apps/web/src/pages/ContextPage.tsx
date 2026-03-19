import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ContextBlock } from '@pumice/types'
import {
  fetchContextBlocks,
  fetchContextSettings,
  saveContextSettings,
  createContextBlock,
  deleteContextBlock,
  indexVault,
  composeContext,
  writeHandoff,
  type ComposedContext,
} from '../api/client'

// ─── Source labels ────────────────────────────────────────────────────────────

const SOURCE_COLOR: Record<string, string> = {
  manual:  'var(--accent)',
  vault:   '#B06AFF',
  runtime: 'var(--amber)',
}

const SOURCE_LABEL: Record<string, string> = {
  manual:  'manual',
  vault:   'vault',
  runtime: 'runtime',
}

// ─── Block card ───────────────────────────────────────────────────────────────

function BlockCard({ block, onDelete }: { block: ContextBlock; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const color = SOURCE_COLOR[block.source] ?? 'var(--text-muted)'

  return (
    <div className="card" style={{ padding: '12px 16px', animation: 'slide-in 0.2s ease both' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {block.title}
            </span>
            <span style={{ fontSize: 10, color, background: `${color}18`, border: `1px solid ${color}30`, padding: '1px 6px', borderRadius: 2, flexShrink: 0 }}>
              {SOURCE_LABEL[block.source]}
            </span>
          </div>

          {block.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
              {block.tags.map((tag) => (
                <span key={tag} style={{ fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '0 5px', borderRadius: 2 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 6,
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              maxHeight: expanded ? 'none' : 40,
              overflow: 'hidden',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {block.content}
          </div>
          {!expanded && block.content.length > 120 && (
            <button
              onClick={() => setExpanded(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: 0, marginTop: 2 }}
            >
              show more
            </button>
          )}
        </div>

        {block.source !== 'vault' && block.source !== 'runtime' && (
          <button
            onClick={onDelete}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
            title="Delete block"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Compose preview ──────────────────────────────────────────────────────────

function ComposePanel({ vaultPath }: { vaultPath: string | null }) {
  const [result, setResult] = useState<ComposedContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [maxTokens, setMaxTokens] = useState('8000')

  const handleCompose = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await composeContext({ maxTokens: parseInt(maxTokens, 10) || 8000 })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleHandoff = async () => {
    if (!result?.text || !vaultPath) return
    try {
      const { file } = await writeHandoff(result.text, vaultPath)
      alert(`Handoff saved to:\n${file}`)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
        Context Composer
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Max tokens</label>
          <input
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '5px 10px',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={() => void handleCompose()}
            disabled={loading}
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid rgba(0,200,255,0.3)',
              color: 'var(--accent)',
              padding: '5px 14px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {loading ? '…' : '▶ compose'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontSize: 11, marginBottom: 10 }}>✕ {error}</div>
      )}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {result.blocks.filter((b) => b.included).length} / {result.blocks.length} blocks included
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              ~{result.totalTokens.toLocaleString()} tokens
            </span>
            {result.truncated && (
              <span style={{ fontSize: 11, color: 'var(--amber)' }}>⚠ truncated</span>
            )}
          </div>

          <pre style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            fontSize: 10,
            color: 'var(--text-muted)',
            maxHeight: 240,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'var(--font-mono)',
            margin: 0,
          }}>
            {result.text || '(empty)'}
          </pre>

          {vaultPath && (
            <button
              onClick={() => void handleHandoff()}
              style={{
                marginTop: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                padding: '5px 12px',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              ↓ save as handoff
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ─── Add block form ───────────────────────────────────────────────────────────

function AddBlockForm({ onAdded }: { onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createContextBlock({
      source: 'manual',
      title,
      content,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      setTitle(''); setContent(''); setTags(''); setError(null)
      onAdded()
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  })

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Add Manual Block
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <textarea
          placeholder="Content (markdown supported)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
        />
        <input
          placeholder="Tags (comma-separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={inputStyle}
        />
        {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>✕ {error}</div>}
        <button
          onClick={() => mutation.mutate()}
          disabled={!title || !content || mutation.isPending}
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(0,200,255,0.3)',
            color: 'var(--accent)',
            padding: '6px 14px',
            borderRadius: 'var(--radius)',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            alignSelf: 'flex-start',
          }}
        >
          {mutation.isPending ? '…' : '+ add block'}
        </button>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-3)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '6px 10px',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  boxSizing: 'border-box',
}

// ─── Vault panel ──────────────────────────────────────────────────────────────

function VaultPanel({ vaultPath, onIndexed }: { vaultPath: string | null; onIndexed: () => void }) {
  const qc = useQueryClient()
  const [localPath, setLocalPath] = useState(vaultPath ?? '')
  const [indexResult, setIndexResult] = useState<{ indexed: number; skipped: number; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    await saveContextSettings(localPath)
    void qc.invalidateQueries({ queryKey: ['context-settings'] })
  }

  const handleIndex = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await indexVault(localPath || undefined)
      setIndexResult(result)
      onIndexed()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
        Obsidian Vault
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          placeholder="/path/to/obsidian-vault"
          value={localPath}
          onChange={(e) => setLocalPath(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={() => void handleSave()} style={btnStyle}>save</button>
        <button onClick={() => void handleIndex()} disabled={busy || !localPath} style={{ ...btnStyle, color: 'var(--accent)', borderColor: 'rgba(0,200,255,0.3)', background: 'var(--accent-dim)' }}>
          {busy ? '…' : '↻ index'}
        </button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 11 }}>✕ {error}</div>}
      {indexResult && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 14 }}>
          <span style={{ color: 'var(--green)' }}>✓ {indexResult.indexed} indexed</span>
          {indexResult.skipped > 0 && <span style={{ color: 'var(--text-dim)' }}>{indexResult.skipped} skipped</span>}
          {indexResult.errors.length > 0 && <span style={{ color: 'var(--amber)' }}>⚠ {indexResult.errors.length} errors</span>}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  padding: '6px 12px',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  whiteSpace: 'nowrap',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ContextPage() {
  const qc = useQueryClient()

  const { data: settingsData } = useQuery({
    queryKey: ['context-settings'],
    queryFn: fetchContextSettings,
  })

  const { data: blocksData, isLoading } = useQuery({
    queryKey: ['context-blocks'],
    queryFn: () => fetchContextBlocks(),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteContextBlock,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['context-blocks'] }),
  })

  const vaultPath = settingsData?.vaultPath ?? null
  const blocks = blocksData?.blocks ?? []

  const grouped = {
    manual:  blocks.filter((b) => b.source === 'manual'),
    vault:   blocks.filter((b) => b.source === 'vault'),
    runtime: blocks.filter((b) => b.source === 'runtime'),
  }

  return (
    <div style={{ animation: 'fade-in 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Context
        </h1>
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-dim)' }}>
          {blocks.length} block{blocks.length !== 1 ? 's' : ''} ·{' '}
          <span style={{ color: SOURCE_COLOR.manual }}>{grouped.manual.length} manual</span>
          {' · '}
          <span style={{ color: SOURCE_COLOR.vault }}>{grouped.vault.length} vault</span>
          {' · '}
          <span style={{ color: SOURCE_COLOR.runtime }}>{grouped.runtime.length} runtime</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left column — blocks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <VaultPanel vaultPath={vaultPath} onIndexed={() => void qc.invalidateQueries({ queryKey: ['context-blocks'] })} />
          <AddBlockForm onAdded={() => void qc.invalidateQueries({ queryKey: ['context-blocks'] })} />

          {isLoading && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12, display: 'flex', gap: 8 }}>
              <span className="status-dot working" />Loading…
            </div>
          )}

          {blocks.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', fontSize: 12 }}>
              <div style={{ fontSize: 24, marginBottom: 10, opacity: 0.3 }}>◧</div>
              <div>No context blocks yet</div>
              <div style={{ marginTop: 6, fontSize: 11 }}>Index a vault or add a manual block</div>
            </div>
          )}

          {blocks.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(['manual', 'vault', 'runtime'] as const).map((source) =>
                grouped[source].length > 0 ? (
                  <div key={source}>
                    <div style={{ fontSize: 10, color: SOURCE_COLOR[source], letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, marginTop: 4 }}>
                      {source} · {grouped[source].length}
                    </div>
                    {grouped[source].map((block) => (
                      <div key={block.id} style={{ marginBottom: 6 }}>
                        <BlockCard
                          block={block}
                          onDelete={() => deleteMutation.mutate(block.id)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Right column — compose */}
        <div>
          <ComposePanel vaultPath={vaultPath} />
        </div>
      </div>
    </div>
  )
}
