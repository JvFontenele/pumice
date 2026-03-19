import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { connectSSE, useEventsStore } from '../store/events'

const NAV = [
  { to: '/agents',  label: 'Agents',  icon: '◈' },
  { to: '/runs',    label: 'Runs',    icon: '▶' },
  { to: '/context', label: 'Context', icon: '◧' },
  { to: '/events',  label: 'Events',  icon: '◉' },
]

export function Layout() {
  const status = useEventsStore((s) => s.status)
  const eventCount = useEventsStore((s) => s.events.length)
  useEffect(() => {
    connectSSE()
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        width: 200,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 28px' }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}>
            PUMICE
          </div>
          <div style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>
            Agent Control Plane
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0 10px' }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 12,
                letterSpacing: '0.04em',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                border: '1px solid',
                borderColor: isActive ? 'rgba(0,200,255,0.2)' : 'transparent',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: 11, opacity: 0.8 }}>{icon}</span>
              {label}
              {to === '/events' && eventCount > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                  fontSize: 9,
                  padding: '0 5px',
                  borderRadius: 9,
                  border: '1px solid rgba(0,200,255,0.2)',
                }}>
                  {eventCount > 99 ? '99+' : eventCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Connection status */}
        <div style={{ padding: '12px 20px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className={`status-dot ${status === 'connected' ? 'idle' : status === 'connecting' ? 'working' : 'error'}`} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
              {status === 'connected' ? 'SSE live' : status === 'connecting' ? 'connecting…' : 'disconnected'}
            </span>
          </div>
        </div>
      </aside>

      {/* ─── Main ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        <Outlet />
      </main>
    </div>
  )
}
