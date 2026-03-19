import { useEffect, useRef } from 'react'
import { useEventsStore } from '../store/events'
import type { PumiceEvent } from '@pumice/types'

const EVENT_COLORS: Record<string, string> = {
  'agent.registered':     'var(--accent)',
  'agent.status_changed': 'var(--accent)',
  'agent.heartbeat':      'var(--text-dim)',
  'command.queued':       '#B06AFF',
  'command.status_changed': '#9055E8',
  'response.partial':     'var(--amber)',
  'response.final':       'var(--green)',
  'run.started':          'var(--accent)',
  'run.finished':         'var(--green)',
  'run.step_started':     '#B06AFF',
  'run.step_completed':   'var(--green)',
  'run.step_failed':      'var(--red)',
  'run.step_retrying':    'var(--amber)',
}

function EventLine({ event, index }: { event: PumiceEvent; index: number }) {
  const color = EVENT_COLORS[event.type] ?? 'var(--text-muted)'
  const time = new Date(event.timestamp).toLocaleTimeString('en-GB', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const ms = new Date(event.timestamp).getMilliseconds().toString().padStart(3, '0')

  // Pick 1-2 key payload fields to show inline
  const preview = Object.entries(event.payload)
    .slice(0, 2)
    .map(([k, v]) => `${k}:${String(v).slice(0, 20)}`)
    .join('  ')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '100px 200px 1fr',
        gap: 12,
        padding: '5px 0',
        borderBottom: '1px solid var(--surface-2)',
        animation: index === 0 ? 'slide-in 0.2s ease both' : 'none',
        alignItems: 'baseline',
      }}
    >
      {/* Timestamp */}
      <span style={{ color: 'var(--text-dim)', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {time}<span style={{ opacity: 0.5 }}>.{ms}</span>
      </span>

      {/* Event type */}
      <span style={{
        color,
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {event.type}
      </span>

      {/* Payload preview */}
      <span style={{
        color: 'var(--text-dim)',
        fontSize: 11,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        opacity: 0.7,
      }}>
        {preview}
      </span>
    </div>
  )
}

export function EventsPage() {
  const events = useEventsStore((s) => s.events)
  const status = useEventsStore((s) => s.status)
  const clear = useEventsStore((s) => s.clear)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events.length])

  // Count by type
  const typeCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1
    return acc
  }, {})

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', animation: 'fade-in 0.3s ease' }}>
      {/* Header */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Events
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <span className={`status-dot ${status === 'connected' ? 'idle' : status === 'connecting' ? 'working' : 'error'}`} />
              {status}
            </div>
            <button
              onClick={clear}
              style={{
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
              clear
            </button>
          </div>
        </div>

        {/* Type distribution */}
        {topTypes.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
            {topTypes.map(([type, count]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: EVENT_COLORS[type] ?? 'var(--text-muted)',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {type.split('.')[1] ?? type}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>×{count}</span>
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
              {events.length} total
            </span>
          </div>
        )}
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '100px 200px 1fr',
        gap: 12,
        padding: '0 0 6px',
        borderBottom: '1px solid var(--border)',
        fontSize: 10,
        color: 'var(--text-dim)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        <span>Time</span>
        <span>Event</span>
        <span>Payload</span>
      </div>

      {/* Event stream */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: 4,
          minHeight: 0,
        }}
      >
        {events.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--text-dim)',
            fontSize: 12,
          }}>
            <div style={{ fontSize: 24, marginBottom: 12, opacity: 0.3 }}>◉</div>
            <div>Waiting for events…</div>
            <div style={{ marginTop: 6, fontSize: 11 }}>
              Events stream live from the control plane
            </div>
          </div>
        )}

        {events.map((event, i) => (
          <EventLine
            key={`${event.timestamp}-${i}`}
            event={event}
            index={events.length - 1 - i}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
