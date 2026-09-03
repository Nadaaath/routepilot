export type TripDirection = 'INBOUND' | 'OUTBOUND'
export type OptimizationStrategy = 'BALANCED' | 'LOWEST_COST' | 'EMPLOYEE_COMFORT' | 'FLEET_EFFICIENCY'

export interface OptimizationConstraintOverrides {
  maxClusterDistanceKm?: number
  dwellMinutesPerStop?: number
  maxEmployeeRideMinutes?: number
  minimumVehicleUtilization?: number
  maxStopsPerTrip?: number
}

export interface OptimizationCostAssumptions {
  fuelPricePerLiter?: number
}

export interface OptimizationPreviewRequest {
  shiftId: number
  date: string
  depotId: number
  direction: TripDirection
  vehicleIds?: number[]
  strategy?: OptimizationStrategy
  constraints?: OptimizationConstraintOverrides
  costAssumptions?: OptimizationCostAssumptions
}

export interface ResolvedOptimizationPolicy {
  strategy: OptimizationStrategy
  maxClusterDistanceKm: number
  dwellMinutesPerStop: number
  maxEmployeeRideMinutes: number
  minimumVehicleUtilization: number
  maxStopsPerTrip: number
  fuelPricePerLiter: number
}

export interface PickupPoint {
  id: number
  name: string
  latitude: number
  longitude: number
  address?: string | null
  mapUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Depot {
  id: number
  name: string
  latitude: number
  longitude: number
  address?: string | null
  mapUrl?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface Employee {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  active: boolean
  pickupPointId?: number | null
  pickupPoint?: PickupPoint | null
  createdAt?: string
  updatedAt?: string
}

export type VehiclePlanningPriority = 'PREFERRED' | 'NORMAL' | 'RESERVE'

export interface Vehicle {
  id: number
  name: string
  registration: string
  capacity: number
  active: boolean
  fuelConsumption?: number | null
  costPerKm?: number | null
  maintenanceCostPerKm?: number | null
  optimizerEligible?: boolean
  planningPriority?: VehiclePlanningPriority
  createdAt?: string
  updatedAt?: string
}

export interface Shift {
  id: number
  name: string
  startTime: string
  endTime: string
  createdAt?: string
  updatedAt?: string
}

export interface Attendance {
  id: number
  employeeId: number
  shiftId: number
  date: string
  present: boolean
  employee?: Employee
  shift?: Shift
  createdAt?: string
}

export interface ShiftAssignment {
  id: number
  employeeId: number
  shiftId: number
  date: string
  employee?: Employee
  shift?: Shift
  createdAt?: string
  updatedAt?: string
}

export interface VehicleAvailability {
  id: number
  vehicleId: number
  date: string
  available: boolean
  reason?: string | null
  vehicle?: Vehicle
  createdAt?: string
  updatedAt?: string
}

export interface ScheduledStop {
  pickupPointId: number
  arrivalTime: string
  departureTime: string
  dwellMinutes: number
}

export interface EmployeeRideTime {
  employeeId: number
  firstName: string
  lastName: string
  pickupPointId: number
  originTime: string
  destinationTime: string
  rideTimeMinutes: number
}

export interface RouteCost {
  vehicleId: number
  vehicleName: string
  distanceKm: number
  estimatedFuelLiters: number | null
  estimatedFuelCost: number | null
  estimatedMaintenanceCost?: number | null
  estimatedVariableCostPerKm?: number | null
  operatingCost: number | null
  costDataComplete?: boolean
}

export interface OptimizationTrip {
  tripId: number
  clusterId: number
  direction: TripDirection
  assignedVehicle: Vehicle
  employeeCount: number
  employeeIds: number[]
  pointIds: number[]
  orderedPointIds: number[]
  stopDistanceKm: number
  depotDistanceKm: number
  totalDistanceKm: number
  stopDurationMinutes: number
  depotDurationMinutes: number
  totalDurationMinutes: number
  schedule: {
    departureTime: string
    arrivalTime: string
    totalDwellMinutes: number
    stops: ScheduledStop[]
  }
  employeeRideTimes: EmployeeRideTime[]
  routeCost: RouteCost
}

export interface OptimizationDiagnostics {
  employeesWithoutPickupPoint?: number[]
  rideTimeWarnings?: Array<{ tripId: number; employeeId: number; rideTimeMinutes: number; limitMinutes: number }>
  stopCountWarnings?: Array<{ tripId: number; stopCount: number; limitStops: number }>
  utilizationWarnings?: Array<{ tripId: number; vehicleId: number; employeeCount: number; capacity: number; utilization: number; minimumUtilization: number }>
  costDataWarnings?: Array<{ tripId: number; vehicleId: number; vehicleName: string; missingFuelConsumption: boolean; missingMaintenanceCost: boolean }>
  warningCount?: number
  recoveryApplied?: boolean
  candidatePlansEvaluated?: number
  selectionStrategy?: OptimizationStrategy
  transportableUnassignedCount?: number
}

export interface OptimizationPreviewResponse {
  status: 'preview'
  shift: Shift
  depot: Depot
  direction: TripDirection
  date: string
  employeeCount: number
  employeeCountWithPickupPoint?: number
  employeeCountWithoutPickupPoint?: number
  activeVehicleCount: number
  operationalVehicleCount?: number
  automaticEligibleVehicleCount?: number
  unavailableVehicleIds?: number[]
  selectedVehicleCount?: number
  selectedVehicleIds?: number[]
  totalVehicleCapacity: number
  capacityIsSufficient: boolean
  strategy?: OptimizationStrategy
  policyApplied?: ResolvedOptimizationPolicy
  optimizationInput: {
    direction: TripDirection
    policyApplied?: ResolvedOptimizationPolicy
    depot: Depot
    employees: Employee[]
    vehicles: Vehicle[]
    pickupPoints: PickupPoint[]
    distanceMatrix?: number[][]
    durationMatrix?: number[][]
    depotIndex?: number
    clusters: { id: number; pointIds: number[]; employeeCount: number }[]
    clusterDemands: { clusterId: number; employeeCount: number }[]
    vehicleAllocations: {
      clusterId: number
      employeeCount: number
      assignedVehicles: Vehicle[]
      totalCapacity: number
      unusedCapacity?: number
      utilization?: number
      estimatedVariableCostPerKm?: number
      strategyApplied?: OptimizationStrategy
      capacitySatisfied: boolean
    }[]
    routes: OptimizationTrip[]
    unassignedEmployeeIds: number[]
    allEmployeesAssigned: boolean
    diagnostics?: OptimizationDiagnostics
    totals: {
      totalTrips: number
      totalDistanceKm: number
      totalDurationMinutes: number
      totalEstimatedFuelLiters: number
      totalEstimatedFuelCost: number
      totalOperatingCost: number
      costDataComplete?: boolean
      averageRideMinutes?: number
      maxRideMinutes?: number
      averageVehicleUtilization?: number
    }
    optimizationDecision?: {
      strategy: OptimizationStrategy
      candidatePlansEvaluated: number
      recoveryApplied: boolean
      constraintsSharedAcrossStrategies: boolean
      selectionBasis: string
    }
  }
}

export type TransportPlanStatus = 'DRAFT' | 'APPROVED' | 'PUBLISHED' | 'SUPERSEDED'

export interface PersistedTransportPlan {
  id: number
  date: string
  shiftId: number
  depotId: number
  direction: TripDirection
  strategy: OptimizationStrategy
  status: TransportPlanStatus
  version: number
  request: OptimizationPreviewRequest
  result: OptimizationPreviewResponse
  shift?: Shift
  depot?: Depot
  approvedAt?: string | null
  publishedAt?: string | null
  createdAt: string
  updatedAt?: string
}


export interface ManualTripEdit {
  tripId?: number
  vehicleId: number
  employeeIds: number[]
  orderedPointIds: number[]
}

export interface ManualPlanViolation {
  type: 'EMPTY_TRIP' | 'DUPLICATE_VEHICLE' | 'DUPLICATE_EMPLOYEE' | 'CAPACITY_EXCEEDED' | 'UNASSIGNED_EMPLOYEES' | 'STOP_EMPLOYEE_MISMATCH'
  message: string
  tripId?: number
  vehicleId?: number
  employeeIds?: number[]
  value?: number
  limit?: number
}

export interface ManualPlanValidationResponse {
  valid: boolean
  violations: ManualPlanViolation[]
  result: OptimizationPreviewResponse
  summary: {
    hardViolationCount: number
    qualityWarningCount: number
    assignedEmployeeCount: number
    unassignedEmployeeCount: number
    totalTrips: number
  }
}

export interface StoredPlan {
  id: string
  createdAt: string
  response: OptimizationPreviewResponse
}
