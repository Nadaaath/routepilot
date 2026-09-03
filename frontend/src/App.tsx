import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import OverviewPage from './pages/OverviewPage'
import CalendarPage from './pages/CalendarPage'
import AttendancePage from './pages/AttendancePage'
import PlanningPage from './pages/PlanningPage'
import EmployeesPage from './pages/EmployeesPage'
import FleetPage from './pages/FleetPage'
import LocationsPage from './pages/LocationsPage'
import ShiftsPage from './pages/ShiftsPage'
import GeneratedPlansPage from './pages/GeneratedPlansPage'
import ExportsPage from './pages/ExportsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return <Routes><Route element={<AppLayout/>}>
    <Route index element={<OverviewPage/>}/>
    <Route path="today" element={<Navigate to="/" replace/>}/>
    <Route path="calendar" element={<CalendarPage/>}/>
    <Route path="attendance" element={<AttendancePage/>}/>
    <Route path="planning" element={<PlanningPage/>}/>
    <Route path="employees" element={<EmployeesPage/>}/>
    <Route path="fleet" element={<FleetPage/>}/>
    <Route path="locations" element={<LocationsPage/>}/>
    <Route path="shifts" element={<ShiftsPage/>}/>
    <Route path="plans" element={<GeneratedPlansPage/>}/>
    <Route path="exports" element={<ExportsPage/>}/>
    <Route path="settings" element={<SettingsPage/>}/>
  </Route></Routes>
}
