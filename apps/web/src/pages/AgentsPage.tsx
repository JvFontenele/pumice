import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAgents } from '../api/client'
import { useEventsStore } from '../store/events'
import type { Agent } from '@pumice/types'
import { useEffect } from 'react'

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5)  return 'just now'
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function AgentCard({ agent }: { agent: Agent }) {
  return (
    <div
      className="card"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        animation: 'slide-in 0.3s ease both',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow line at top */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 1,
        background: agent.status === 'working'
          ? 'linear-gradient(90deg, transparent, var(--amber), transparent)'
          : agent.status === 'idle'
          ? 'linear-gradient(90deg, transparent, var(--green), transparent)'
          : agent.status === 'error'
          ? 'linear-gradient(90deg, transparent, var(--red), transparent)'
          : 'transparent',
        opacity: 0.6,
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {agent.name}
          </div>
          <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`provider ${agent.provider}`}>{agent.provider}</span>
          </div>
        </div>
        <span className={`badge ${agent.status}`}>
          <span className={`status-dot ${agent.status}`} style={{ width: 5, height: 5 }} />
          {agent.status}
        </span>
      </div>

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {agent.capabilities.map((cap) => (
            <span key={cap} style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              borderRadius: 2,
              padding: '1px 6px',
              letterSpacing: '0.03em',
            }}>
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid var(--border)',
        paddingTop: 10,
        fontSize: 11,
        color: 'var(--text-dim)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>
          {agent.id.slice(0, 8)}…
        </span>
        <span>{timeAgo(agent.lastSeen)}</span>
      </div>
    </div>
  )
}

export function AgentsPage() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  })

  // Invalidate on agent events
  const events = useEventsStore((s) => s.events)
  useEffect(() => {
    const last = events[events.length - 1]
    if (last && (
      last.type === 'agent.registered' ||
      last.type === 'agent.status_changed' ||
      last.type === 'agent.heartbeat'
    )) {
      void qc.invalidateQueries({ queryKey: ['agents'] })
    }
  }, [events, qc])

  const agents = data?.agents ?? []

  const stats = {
    total: agents.length,
    idle: agents.filter((a) => a.status === 'idle').length,
    working: agents.filter((a) => a.status === 'working').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  }

  return (
    <div style={{ animation: 'fade-in 0.3s ease' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Agents
          </h1>
          <button
            onClick={() => void qc.invalidateQueries({ queryKey: ['agents'] })}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              padding: '5px 12px',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              fontSize: 11,
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-2)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            ↺ refresh
          </button>
        </div>

        {/* Stats row */}
        {agents.length > 0 && (
          <div style={{ display: 'flex', gap: 20, marginTop: 14 }}>
            {[
              { label: 'total',   value: stats.total,   color: 'var(--text-muted)' },
              { label: 'idle',    value: stats.idle,    color: 'var(--green)' },
              { label: 'working', value: stats.working, color: 'var(--amber)' },
              { label: 'offline', value: stats.offline, color: 'var(--slate)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color }}>{value}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* States */}
      {isLoading && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-dot working" />
          Loading agents…
        </div>
      )}

      {isError && (
        <div style={{
          background: 'var(--red-dim)',
          border: '1px solid rgba(255,69,96,0.3)',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          color: 'var(--red)',
          fontSize: 12,
        }}>
          ✕ {error instanceof Error ? error.message : 'Failed to load agents'}
        </div>
      )}

      {!isLoading && !isError && agents.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 0',
          color: 'var(--text-dim)',
          fontSize: 12,
        }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>◈</div>
          <div>No agents registered</div>
          <div style={{ marginTop: 6, fontSize: 11 }}>
            POST /agents/register to connect an agent
          </div>
        </div>
      )}

      {/* Grid */}
      {agents.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {agents.map((agent, i) => (
            <div key={agent.id} style={{ animationDelay: `${i * 0.05}s` }}>
              <AgentCard agent={agent} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
