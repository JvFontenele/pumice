import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AgentsPage } from './pages/AgentsPage'
import { RunsPage } from './pages/RunsPage'
import { EventsPage } from './pages/EventsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/agents" replace />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/runs"   element={<RunsPage />} />
        <Route path="/events" element={<EventsPage />} />
      </Route>
    </Routes>
  )
}
