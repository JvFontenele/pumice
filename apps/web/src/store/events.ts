import { create } from 'zustand'
import type { PumiceEvent } from '@pumice/types'

const MAX_EVENTS = 200

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

interface EventsState {
  events: PumiceEvent[]
  status: ConnectionStatus
  addEvent: (event: PumiceEvent) => void
  setStatus: (status: ConnectionStatus) => void
  clear: () => void
}

export const useEventsStore = create<EventsState>((set) => ({
  events: [],
  status: 'connecting',

  addEvent: (event) =>
    set((state) => ({
      events:
        state.events.length >= MAX_EVENTS
          ? [...state.events.slice(-MAX_EVENTS + 1), event]
          : [...state.events, event],
    })),

  setStatus: (status) => set({ status }),

  clear: () => set({ events: [] }),
}))

// ─── SSE connection (singleton) ───────────────────────────────────────────────

let source: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

export function connectSSE() {
  if (source) return

  const store = useEventsStore.getState()
  store.setStatus('connecting')

  source = new EventSource('/api/events')

  source.onopen = () => {
    useEventsStore.getState().setStatus('connected')
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  }

  source.onmessage = (e: MessageEvent<string>) => {
    try {
      const data = JSON.parse(e.data) as PumiceEvent | { type: 'connected' }
      if ('type' in data && data.type !== 'connected') {
        useEventsStore.getState().addEvent(data as PumiceEvent)
      }
    } catch { /* ignore parse errors */ }
  }

  source.onerror = () => {
    useEventsStore.getState().setStatus('disconnected')
    source?.close()
    source = null
    // Reconnect after 3s
    reconnectTimer = setTimeout(connectSSE, 3_000)
  }
}

export function disconnectSSE() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  source?.close()
  source = null
  useEventsStore.getState().setStatus('disconnected')
}
