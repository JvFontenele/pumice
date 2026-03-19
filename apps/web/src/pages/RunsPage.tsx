import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { fetchRuns, fetchRun, type RunSummary } from '../api/client'
import { useEventsStore } from '../store/events'
import type { Run, RunStep } from '@pumice/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false })
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// ─── Run Timeline ─────────────────────────────────────────────────────────────

function StepNode({ step, isLast }: { step: RunStep; isLast: boolean }) {
  const statusColor = {
    completed: 'var(--green)',
    running:   'var(--amber)',
    failed:    'var(--red)',
    pending:   'var(--text-dim)',
  }[step.status] ?? 'var(--text-dim)'

  return (
    <div style={{ display: 'flex', gap: 14, position: 'relative' }}>
      {/* Track */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        {/* Node */}
        <div style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: statusColor,
          flexShrink: 0,
          boxShadow: step.status === 'running' ? `0 0 8px ${statusColor}` : 'none',
          marginTop: 3,
        }} />
        {/* Connector */}
        {!isLast && (
          <div style={{
            width: 1,
            flex: 1,
            minHeight: 20,
            background: `linear-gradient(180deg, ${statusColor}50, var(--border))`,
            marginTop: 3,
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        paddingBottom: isLast ? 0 : 16,
        animation: 'slide-in 0.25s ease both',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text)', fontWeight: 500, fontSize: 12 }}>
            {step.stepId}
          </span>
          <span className={`badge ${step.status}`} style={{ fontSize: 10 }}>
            <span className={`status-dot ${step.status}`} style={{ width: 5, height: 5 }} />
            {step.status}
          </span>
          {step.attempt > 1 && (
            <span style={{
              fontSize: 10,
              color: 'var(--amber)',
              background: 'var(--amber-dim)',
              padding: '1px 5px',
              borderRadius: 2,
              border: '1px solid rgba(255,157,0,0.2)',
            }}>
              attempt {step.attempt}
            </span>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '2px 16px',
          marginTop: 5,
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          {step.commandId && (
            <span>cmd <span style={{ color: 'var(--text-dim)' }}>{step.commandId.slice(0, 10)}…</span></span>
          )}
          {step.startedAt && (
            <span>
              started <span style={{ color: 'var(--text-dim)' }}>{fmt(step.startedAt)}</span>
              {step.completedAt && (
                <span style={{ color: 'var(--text-dim)' }}> +{duration(step.startedAt, step.completedAt)}</span>
              )}
            </span>
          )}
          {step.error && (
            <span style={{ color: 'var(--red)', gridColumn: '1/-1', marginTop: 3 }}>
              ✕ {step.error}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function RunDetail({ runId, onBack }: { runId: string; onBack: () => void }) {
  const qc = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => fetchRun(runId),
    refetchInterval: (q) => {
      const run = (q.state.data as { run: Run } | undefined)?.run
      return run?.status === 'running' ? 2000 : false
    },
  })

  const events = useEventsStore((s) => s.events)
  useEffect(() => {
    const last = events[events.length - 1]
    if (last && (
      last.type === 'run.step_started' ||
      last.type === 'run.step_completed' ||
      last.type === 'run.step_failed' ||
      last.type === 'run.finished'
    )) {
      void qc.invalidateQueries({ queryKey: ['run', runId] })
    }
  }, [events, qc, runId])

  const run = data?.run
  const steps = data?.steps ?? []

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 12,
          padding: 0,
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--font-mono)',
        }}
      >
        ← back to runs
      </button>

      {isLoading && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
          <span className="status-dot working" style={{ display: 'inline-block', marginRight: 8 }} />
          Loading run…
        </div>
      )}

      {isError && (
        <div style={{ color: 'var(--red)', fontSize: 12 }}>Run not found</div>
      )}

      {run && (
        <>
          {/* Run header */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: '-0.01em',
                }}>
                  {runId.slice(0, 8)}…
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  {run.flowId.slice(0, 8)}… · started {fmt(run.startedAt)}
                  {run.finishedAt && ` · ${duration(run.startedAt, run.finishedAt)}`}
                </div>
              </div>
              <span className={`badge ${run.status}`}>
                <span className={`status-dot ${run.status}`} style={{ width: 5, height: 5 }} />
                {run.status}
              </span>
            </div>

            {/* Step progress bar */}
            {steps.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  height: 3,
                  background: 'var(--surface-3)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(steps.filter(s => s.status === 'completed').length / steps.length) * 100}%`,
                    background: run.status === 'failed'
                      ? 'var(--red)'
                      : 'linear-gradient(90deg, var(--green), var(--accent))',
                    borderRadius: 99,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ marginTop: 5, fontSize: 10, color: 'var(--text-dim)' }}>
                  {steps.filter(s => s.status === 'completed').length} / {steps.length} steps completed
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          {steps.length > 0 && (
            <div className="card" style={{ padding: '20px 20px 20px 20px' }}>
              <div style={{
                fontSize: 10,
                color: 'var(--text-dim)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 18,
              }}>
                Step Timeline
              </div>
              {steps.map((step, i) => (
                <StepNode key={step.id} step={step} isLast={i === steps.length - 1} />
              ))}
            </div>
          )}

          {steps.length === 0 && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: '30px 0' }}>
              No steps in this run
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Runs list ────────────────────────────────────────────────────────────────

function RunRow({ run, onClick }: { run: RunSummary; onClick: () => void }) {
  const pct = run.total_steps > 0
    ? Math.round((run.completed_steps / run.total_steps) * 100)
    : 0

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: '1fr auto 90px 80px',
        gap: 12,
        alignItems: 'center',
        animation: 'slide-in 0.2s ease both',
      }}
    >
      {/* Name + ID */}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          color: 'var(--text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {run.flow_name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
          {run.id.slice(0, 12)}…
        </div>
      </div>

      {/* Status */}
      <span className={`badge ${run.status}`}>
        <span className={`status-dot ${run.status}`} style={{ width: 5, height: 5 }} />
        {run.status}
      </span>

      {/* Progress */}
      <div>
        <div style={{
          height: 3,
          background: 'var(--surface-3)',
          borderRadius: 99,
          overflow: 'hidden',
          marginBottom: 3,
        }}>
          <div style={{
            height: '100%',
            width: `${pct}%`,
            background: run.status === 'failed'
              ? 'var(--red)'
              : run.status === 'completed'
              ? 'var(--green)'
              : 'var(--accent)',
            borderRadius: 99,
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {run.completed_steps}/{run.total_steps} steps
        </div>
      </div>

      {/* Time */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
        <div>{duration(run.started_at, run.finished_at)}</div>
        <div style={{ fontSize: 10 }}>{fmt(run.started_at)}</div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RunsPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const qc = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['runs'],
    queryFn: fetchRuns,
  })

  // Invalidate list on run events
  const events = useEventsStore((s) => s.events)
  useEffect(() => {
    const last = events[events.length - 1]
    if (last && (last.type === 'run.started' || last.type === 'run.finished')) {
      void qc.invalidateQueries({ queryKey: ['runs'] })
    }
  }, [events, qc])

  if (selectedRunId) {
    return <RunDetail runId={selectedRunId} onBack={() => setSelectedRunId(null)} />
  }

  const runs = data?.runs ?? []

  return (
    <div style={{ animation: 'fade-in 0.3s ease' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>
          Runs
        </h1>
        <button
          onClick={() => void qc.invalidateQueries({ queryKey: ['runs'] })}
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
          }}
        >
          ↺ refresh
        </button>
      </div>

      {isLoading && (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="status-dot working" />Loading runs…
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
          ✕ {error instanceof Error ? error.message : 'Failed to load runs'}
        </div>
      )}

      {!isLoading && !isError && runs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)', fontSize: 12 }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>▶</div>
          <div>No runs yet</div>
          <div style={{ marginTop: 6, fontSize: 11 }}>POST /flows/:id/runs to start one</div>
        </div>
      )}

      {runs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {runs.map((run, i) => (
            <div key={run.id} style={{ animationDelay: `${i * 0.03}s` }}>
              <RunRow run={run} onClick={() => setSelectedRunId(run.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
