import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  attendanceApi,
  checkHealth,
  depotsApi,
  employeesApi,
  pickupPointsApi,
  shiftsApi,
  shiftAssignmentsApi,
  transportPlansApi,
  vehicleAvailabilityApi,
  vehiclesApi,
} from '../api/resources'
import { apiErrorMessage } from '../api/client'
import type {
  Attendance,
  Depot,
  Employee,
  PersistedTransportPlan,
  PickupPoint,
  Shift,
  ShiftAssignment,
  Vehicle,
  VehicleAvailability,
} from '../types'

type DataContextValue = {
  employees: Employee[]
  vehicles: Vehicle[]
  pickupPoints: PickupPoint[]
  depots: Depot[]
  shifts: Shift[]
  attendance: Attendance[]
  shiftAssignments: ShiftAssignment[]
  vehicleAvailability: VehicleAvailability[]
  plans: PersistedTransportPlan[]
  loading: boolean
  error: string | null
  backendOnline: boolean
  refreshAll: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([])
  const [depots, setDepots] = useState<Depot[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([])
  const [vehicleAvailability, setVehicleAvailability] = useState<VehicleAvailability[]>([])
  const [plans, setPlans] = useState<PersistedTransportPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)

  const refreshAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [e, v, p, d, s, a, sa, va, tp] = await Promise.all([
        employeesApi.list(),
        vehiclesApi.list(),
        pickupPointsApi.list(),
        depotsApi.list(),
        shiftsApi.list(),
        attendanceApi.list(),
        shiftAssignmentsApi.list(),
        vehicleAvailabilityApi.list(),
        transportPlansApi.list(),
      ])
      setEmployees(e)
      setVehicles(v)
      setPickupPoints(p)
      setDepots(d)
      setShifts(s)
      setAttendance(a)
      setShiftAssignments(sa)
      setVehicleAvailability(va)
      setPlans(tp)
      setBackendOnline(true)
    } catch (err) {
      setError(apiErrorMessage(err))
      setBackendOnline(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshAll()
    void checkHealth().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
  }, [])

  const value = useMemo(() => ({
    employees,
    vehicles,
    pickupPoints,
    depots,
    shifts,
    attendance,
    shiftAssignments,
    vehicleAvailability,
    plans,
    loading,
    error,
    backendOnline,
    refreshAll,
  }), [employees, vehicles, pickupPoints, depots, shifts, attendance, shiftAssignments, vehicleAvailability, plans, loading, error, backendOnline])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
