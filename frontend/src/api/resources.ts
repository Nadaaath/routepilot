import { api } from './client'
import type {
  Attendance,
  Depot,
  Employee,
  OptimizationPreviewRequest,
  OptimizationPreviewResponse,
  PickupPoint,
  Shift,
  Vehicle,
  ShiftAssignment,
  VehicleAvailability,
  PersistedTransportPlan,
  TransportPlanStatus,
  ManualTripEdit,
  ManualPlanValidationResponse,
} from '../types'

const crud = <T>(path: string) => ({
  list: async () => (await api.get<T[]>(path)).data,
  get: async (id: number) => (await api.get<T>(`${path}/${id}`)).data,
  create: async (payload: Partial<T>) => (await api.post<T>(path, payload)).data,
  update: async (id: number, payload: Partial<T>) => (await api.patch<T>(`${path}/${id}`, payload)).data,
  remove: async (id: number) => { await api.delete(`${path}/${id}`) },
})

export const employeesApi = crud<Employee>('/employees')
export const vehiclesApi = crud<Vehicle>('/vehicles')
export const pickupPointsApi = crud<PickupPoint>('/pickup-points')
export const depotsApi = crud<Depot>('/depots')
export const shiftsApi = crud<Shift>('/shifts')
export const attendanceApi = crud<Attendance>('/attendance')

export async function runOptimization(payload: OptimizationPreviewRequest) {
  return (await api.post<OptimizationPreviewResponse>('/optimization/preview', payload)).data
}

export async function checkHealth() {
  return (await api.get<{ status: string; message: string }>('/health')).data
}

export const shiftAssignmentsApi = {
  list: async (params?: { employeeId?: number; shiftId?: number; startDate?: string; endDate?: string }) =>
    (await api.get<ShiftAssignment[]>('/shift-assignments', { params })).data,
  replaceDay: async (payload: { shiftId: number; date: string; employeeIds: number[] }) =>
    (await api.put<ShiftAssignment[]>('/shift-assignments/day', payload)).data,
  remove: async (id: number) => { await api.delete(`/shift-assignments/${id}`) },
}

export const vehicleAvailabilityApi = {
  list: async (params?: { vehicleId?: number; startDate?: string; endDate?: string }) =>
    (await api.get<VehicleAvailability[]>('/vehicle-availability', { params })).data,
  set: async (payload: { vehicleId: number; date: string; available: boolean; reason?: string | null }) =>
    (await api.put<VehicleAvailability>('/vehicle-availability', payload)).data,
}

export const transportPlansApi = {
  list: async (params?: { status?: TransportPlanStatus; shiftId?: number; startDate?: string; endDate?: string }) =>
    (await api.get<PersistedTransportPlan[]>('/plans', { params })).data,
  get: async (id: number) => (await api.get<PersistedTransportPlan>(`/plans/${id}`)).data,
  create: async (payload: { request: OptimizationPreviewRequest; result: OptimizationPreviewResponse; status?: TransportPlanStatus }) =>
    (await api.post<PersistedTransportPlan>('/plans', payload)).data,
  update: async (id: number, payload: { status?: TransportPlanStatus; request?: OptimizationPreviewRequest; result?: OptimizationPreviewResponse }) =>
    (await api.patch<PersistedTransportPlan>(`/plans/${id}`, payload)).data,
  validateManual: async (id: number, payload: { trips: ManualTripEdit[] }) =>
    (await api.post<ManualPlanValidationResponse>(`/plans/${id}/validate`, payload)).data,
  createManualVersion: async (id: number, payload: { trips: ManualTripEdit[] }) =>
    (await api.post<PersistedTransportPlan>(`/plans/${id}/manual-version`, payload)).data,
  remove: async (id: number) => { await api.delete(`/plans/${id}`) },
}
