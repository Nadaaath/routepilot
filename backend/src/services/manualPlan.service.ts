import { transportPlanRepository } from "../repositories/transportPlan.repository";
import { HttpError } from "../utils/httpError";
import { buildTripSchedule } from "../optimizer/scheduling/buildTripSchedule";
import { buildEmployeeRideTimes } from "../optimizer/scheduling/buildEmployeeRideTimes";
import { calculateRouteCost } from "../optimizer/objective/calculateRouteCost";
import type { TripDirection } from "../types/trip.types";
import { vehicleRepository } from "../repositories/vehicle.repository";
import { vehicleAvailabilityRepository } from "../repositories/vehicleAvailability.repository";
import { utcDayBounds } from "../utils/date";

interface ManualTripInput {
  tripId?: number;
  vehicleId: number;
  employeeIds: number[];
  orderedPointIds: number[];
}

export interface ManualPlanEditInput {
  trips: ManualTripInput[];
}

export interface ManualPlanViolation {
  type:
    | "EMPTY_TRIP"
    | "DUPLICATE_VEHICLE"
    | "DUPLICATE_EMPLOYEE"
    | "CAPACITY_EXCEEDED"
    | "UNASSIGNED_EMPLOYEES"
    | "STOP_EMPLOYEE_MISMATCH";
  message: string;
  tripId?: number;
  vehicleId?: number;
  employeeIds?: number[];
  value?: number;
  limit?: number;
}

interface BaseEmployee {
  id: number;
  firstName: string;
  lastName: string;
  pickupPointId?: number | null;
  pickupPoint: { id: number } | null;
}

interface BaseVehicle {
  id: number;
  name: string;
  capacity: number;
  fuelConsumption: number | null;
  maintenanceCostPerKm?: number | null;
  costPerKm?: number | null;
  planningPriority?: string | null;
}

interface BasePickupPoint {
  id: number;
  name?: string;
  latitude?: number;
  longitude?: number;
}

interface BasePlanResult {
  status: string;
  date: string;
  direction: TripDirection;
  shift: { id: number; name?: string; startTime: string; endTime: string };
  depot: { id: number; name?: string; latitude?: number; longitude?: number };
  employeeCount: number;
  strategy?: string;
  policyApplied?: {
    strategy?: string;
    maxEmployeeRideMinutes?: number;
    maxStopsPerTrip?: number;
    minimumVehicleUtilization?: number;
    dwellMinutesPerStop?: number;
    fuelPricePerLiter?: number;
  };
  optimizationInput: {
    direction: TripDirection;
    policyApplied?: BasePlanResult["policyApplied"];
    employees: BaseEmployee[];
    vehicles: BaseVehicle[];
    pickupPoints: BasePickupPoint[];
    distanceMatrix: number[][];
    durationMatrix: number[][];
    depotIndex: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)];
}

function sameNumberSet(a: number[], b: number[]) {
  const aa = [...new Set(a)].sort((x, y) => x - y);
  const bb = [...new Set(b)].sort((x, y) => x - y);
  return aa.length === bb.length && aa.every((value, index) => value === bb[index]);
}

function explicitRoute(
  orderedPointIds: number[],
  pickupPoints: BasePickupPoint[],
  distanceMatrix: number[][],
  durationMatrix: number[][],
  depotIndex: number,
  direction: TripDirection
) {
  const pointIndex = new Map<number, number>();
  pickupPoints.forEach((point, index) => pointIndex.set(point.id, index));

  let stopDistanceKm = 0;
  let depotDistanceKm = 0;
  let stopDurationMinutes = 0;
  let depotDurationMinutes = 0;

  if (orderedPointIds.length === 0) {
    return {
      orderedPointIds: [],
      stopDistanceKm,
      depotDistanceKm,
      totalDistanceKm: 0,
      stopDurationMinutes,
      depotDurationMinutes,
      totalDurationMinutes: 0,
    };
  }

  const firstIndex = pointIndex.get(orderedPointIds[0]);
  if (firstIndex === undefined) throw new HttpError(400, `Unknown pickup point ${orderedPointIds[0]}`);

  if (direction === "OUTBOUND") {
    depotDistanceKm = distanceMatrix[depotIndex]?.[firstIndex] ?? 0;
    depotDurationMinutes = durationMatrix[depotIndex]?.[firstIndex] ?? 0;
  }

  for (let i = 0; i < orderedPointIds.length - 1; i++) {
    const fromIndex = pointIndex.get(orderedPointIds[i]);
    const toIndex = pointIndex.get(orderedPointIds[i + 1]);
    if (fromIndex === undefined || toIndex === undefined) {
      throw new HttpError(400, "Manual route contains an unknown pickup point");
    }
    stopDistanceKm += distanceMatrix[fromIndex]?.[toIndex] ?? 0;
    stopDurationMinutes += durationMatrix[fromIndex]?.[toIndex] ?? 0;
  }

  if (direction === "INBOUND") {
    const lastPointId = orderedPointIds[orderedPointIds.length - 1];
    const lastIndex = pointIndex.get(lastPointId);
    if (lastIndex === undefined) throw new HttpError(400, `Unknown pickup point ${lastPointId}`);
    depotDistanceKm = distanceMatrix[lastIndex]?.[depotIndex] ?? 0;
    depotDurationMinutes = durationMatrix[lastIndex]?.[depotIndex] ?? 0;
  }

  return {
    orderedPointIds,
    stopDistanceKm,
    depotDistanceKm,
    totalDistanceKm: stopDistanceKm + depotDistanceKm,
    stopDurationMinutes,
    depotDurationMinutes,
    totalDurationMinutes: stopDurationMinutes + depotDurationMinutes,
  };
}

function ensureBaseResult(value: unknown): BasePlanResult {
  const result = value as BasePlanResult;
  if (
    !result ||
    result.status !== "preview" ||
    !result.shift?.startTime ||
    !result.shift?.endTime ||
    !result.optimizationInput ||
    !Array.isArray(result.optimizationInput.employees) ||
    !Array.isArray(result.optimizationInput.vehicles) ||
    !Array.isArray(result.optimizationInput.pickupPoints) ||
    !Array.isArray(result.optimizationInput.distanceMatrix) ||
    !Array.isArray(result.optimizationInput.durationMatrix)
  ) {
    throw new HttpError(400, "Stored plan does not contain enough optimizer data for manual validation");
  }
  return result;
}

async function rebuild(basePlanId: number, input: ManualPlanEditInput) {
  const basePlan = await transportPlanRepository.findById(basePlanId);
  if (!basePlan) throw new HttpError(404, "Transport plan not found");
  if (!input || !Array.isArray(input.trips)) throw new HttpError(400, "trips must be an array");

  const baseResult = ensureBaseResult(basePlan.result);
  const source = baseResult.optimizationInput;
  const policy = baseResult.policyApplied ?? source.policyApplied ?? {};
  const direction = baseResult.direction ?? source.direction;
  const employeeById = new Map(source.employees.map((employee) => [employee.id, employee]));
  const pointById = new Map(source.pickupPoints.map((point) => [point.id, point]));

  // Manual mode is an operator override. It may use any vehicle that is active
  // and operational on the plan date, including reserve/manual-only vehicles
  // that automatic optimization normally excludes.
  const { start } = utcDayBounds(baseResult.date);
  const [activeVehicles, unavailableVehicleIds] = await Promise.all([
    vehicleRepository.findActive(),
    vehicleAvailabilityRepository.unavailableVehicleIdsForDay(start),
  ]);
  const unavailableSet = new Set(unavailableVehicleIds);
  const operationalVehicles = activeVehicles.filter((vehicle) => !unavailableSet.has(vehicle.id));
  const vehicleById = new Map(operationalVehicles.map((vehicle) => [vehicle.id, vehicle as BaseVehicle]));

  const violations: ManualPlanViolation[] = [];
  const seenVehicleIds = new Set<number>();
  const seenEmployeeIds = new Set<number>();
  const duplicateEmployeeIds = new Set<number>();
  const routes: any[] = [];

  for (let index = 0; index < input.trips.length; index++) {
    const edit = input.trips[index];
    const tripId = Number(edit.tripId ?? index + 1);
    const vehicle = vehicleById.get(Number(edit.vehicleId));
    if (!vehicle) throw new HttpError(400, `Vehicle ${edit.vehicleId} is not eligible for this plan`);

    const employeeIds = uniqueNumbers((edit.employeeIds ?? []).map(Number));
    const orderedPointIds = uniqueNumbers((edit.orderedPointIds ?? []).map(Number));

    for (const employeeId of employeeIds) {
      if (!employeeById.has(employeeId)) throw new HttpError(400, `Employee ${employeeId} is not part of this plan`);
      if (seenEmployeeIds.has(employeeId)) duplicateEmployeeIds.add(employeeId);
      seenEmployeeIds.add(employeeId);
    }

    for (const pointId of orderedPointIds) {
      if (!pointById.has(pointId)) throw new HttpError(400, `Pickup point ${pointId} is not part of this plan`);
    }

    if (seenVehicleIds.has(vehicle.id)) {
      violations.push({
        type: "DUPLICATE_VEHICLE",
        tripId,
        vehicleId: vehicle.id,
        message: `${vehicle.name} is assigned to more than one simultaneous trip`,
      });
    }
    seenVehicleIds.add(vehicle.id);

    if (employeeIds.length === 0) {
      violations.push({ type: "EMPTY_TRIP", tripId, vehicleId: vehicle.id, message: `Trip ${tripId} has no passengers` });
      continue;
    }

    if (employeeIds.length > vehicle.capacity) {
      violations.push({
        type: "CAPACITY_EXCEEDED",
        tripId,
        vehicleId: vehicle.id,
        value: employeeIds.length,
        limit: vehicle.capacity,
        message: `Trip ${tripId} has ${employeeIds.length} passengers for ${vehicle.capacity} seats`,
      });
    }

    const tripEmployees = employeeIds.map((employeeId) => employeeById.get(employeeId)!).filter(Boolean);
    const requiredPointIds = uniqueNumbers(
      tripEmployees
        .map((employee) => employee.pickupPoint?.id ?? employee.pickupPointId ?? null)
        .filter((value): value is number => typeof value === "number")
    );

    if (!sameNumberSet(requiredPointIds, orderedPointIds)) {
      violations.push({
        type: "STOP_EMPLOYEE_MISMATCH",
        tripId,
        message: `Trip ${tripId} stop list must contain exactly the pickup points used by its passengers`,
      });
    }

    // Keep validation useful even while the UI is mid-edit: append any required
    // missing stops so schedules and quality metrics can still be recalculated.
    const normalizedOrder = [
      ...orderedPointIds.filter((pointId) => requiredPointIds.includes(pointId)),
      ...requiredPointIds.filter((pointId) => !orderedPointIds.includes(pointId)),
    ];

    const route = explicitRoute(
      normalizedOrder,
      source.pickupPoints,
      source.distanceMatrix,
      source.durationMatrix,
      Number(source.depotIndex),
      direction
    );

    const schedule = buildTripSchedule(
      route.orderedPointIds,
      source.pickupPoints,
      source.durationMatrix,
      Number(source.depotIndex),
      direction,
      baseResult.shift.startTime,
      baseResult.shift.endTime,
      Number(policy.dwellMinutesPerStop ?? 2)
    );

    const employeeRideTimes = buildEmployeeRideTimes(tripEmployees, schedule, direction);
    const routeCost = calculateRouteCost(
      vehicle,
      route.totalDistanceKm,
      Number(policy.fuelPricePerLiter ?? 14)
    );

    routes.push({
      tripId,
      clusterId: tripId,
      direction,
      assignedVehicle: vehicle,
      employeeCount: tripEmployees.length,
      employeeIds,
      pointIds: requiredPointIds,
      ...route,
      schedule,
      employeeRideTimes,
      routeCost,
    });
  }

  if (duplicateEmployeeIds.size > 0) {
    violations.push({
      type: "DUPLICATE_EMPLOYEE",
      employeeIds: [...duplicateEmployeeIds],
      message: `${duplicateEmployeeIds.size} employee(s) are assigned to more than one trip`,
    });
  }

  const transportableEmployeeIds = source.employees
    .filter((employee) => employee.pickupPoint !== null)
    .map((employee) => employee.id);
  const unassignedEmployeeIds = transportableEmployeeIds.filter((employeeId) => !seenEmployeeIds.has(employeeId));
  const employeesWithoutPickupPoint = source.employees
    .filter((employee) => employee.pickupPoint === null)
    .map((employee) => employee.id);

  if (unassignedEmployeeIds.length > 0) {
    violations.push({
      type: "UNASSIGNED_EMPLOYEES",
      employeeIds: unassignedEmployeeIds,
      message: `${unassignedEmployeeIds.length} transportable employee(s) are not assigned to any trip`,
    });
  }

  const maxRide = Number(policy.maxEmployeeRideMinutes ?? 45);
  const maxStops = Number(policy.maxStopsPerTrip ?? 6);
  const minUtilization = Number(policy.minimumVehicleUtilization ?? 0.65);

  const rideTimeWarnings = routes.flatMap((route) =>
    route.employeeRideTimes
      .filter((rideTime: { rideTimeMinutes: number }) => rideTime.rideTimeMinutes > maxRide)
      .map((rideTime: { employeeId: number; rideTimeMinutes: number }) => ({
        tripId: route.tripId,
        employeeId: rideTime.employeeId,
        rideTimeMinutes: rideTime.rideTimeMinutes,
        limitMinutes: maxRide,
      }))
  );
  const stopCountWarnings = routes
    .filter((route) => route.orderedPointIds.length > maxStops)
    .map((route) => ({ tripId: route.tripId, stopCount: route.orderedPointIds.length, limitStops: maxStops }));
  const utilizationWarnings = routes
    .map((route) => ({
      tripId: route.tripId,
      vehicleId: route.assignedVehicle.id,
      employeeCount: route.employeeCount,
      capacity: route.assignedVehicle.capacity,
      utilization: route.assignedVehicle.capacity > 0 ? route.employeeCount / route.assignedVehicle.capacity : 0,
      minimumUtilization: minUtilization,
    }))
    .filter((item) => item.utilization < minUtilization);
  const costDataWarnings = routes
    .filter((route) => route.routeCost.costDataComplete === false)
    .map((route) => ({
      tripId: route.tripId,
      vehicleId: route.assignedVehicle.id,
      vehicleName: route.assignedVehicle.name,
      missingFuelConsumption: route.assignedVehicle.fuelConsumption === null,
      missingMaintenanceCost:
        (route.assignedVehicle.maintenanceCostPerKm ?? route.assignedVehicle.costPerKm ?? null) === null,
    }));

  const totalDistanceKm = routes.reduce((sum, route) => sum + route.totalDistanceKm, 0);
  const totalDurationMinutes = routes.reduce((sum, route) => sum + route.totalDurationMinutes, 0);
  const totalEstimatedFuelLiters = routes.reduce((sum, route) => sum + (route.routeCost.estimatedFuelLiters ?? 0), 0);
  const totalEstimatedFuelCost = routes.reduce((sum, route) => sum + (route.routeCost.estimatedFuelCost ?? 0), 0);
  const totalOperatingCost = routes.reduce((sum, route) => sum + (route.routeCost.operatingCost ?? 0), 0);
  const rideTimes = routes.flatMap((route) => route.employeeRideTimes.map((ride: { rideTimeMinutes: number }) => ride.rideTimeMinutes));
  const averageRideMinutes = rideTimes.length ? rideTimes.reduce((sum, value) => sum + value, 0) / rideTimes.length : 0;
  const maxRideMinutes = rideTimes.length ? Math.max(...rideTimes) : 0;
  const averageVehicleUtilization = routes.length
    ? routes.reduce((sum, route) => sum + (route.assignedVehicle.capacity > 0 ? route.employeeCount / route.assignedVehicle.capacity : 0), 0) / routes.length
    : 0;
  const costDataComplete = costDataWarnings.length === 0;

  const result = JSON.parse(JSON.stringify(baseResult)) as BasePlanResult;
  result.optimizationInput = {
    ...result.optimizationInput,
    vehicles: operationalVehicles as unknown as BaseVehicle[],
    clusters: routes.map((route) => ({ id: route.tripId, pointIds: route.pointIds, employeeCount: route.employeeCount })),
    clusterDemands: routes.map((route) => ({ clusterId: route.tripId, employeeCount: route.employeeCount })),
    vehicleAllocations: routes.map((route) => ({
      clusterId: route.tripId,
      employeeCount: route.employeeCount,
      assignedVehicles: [route.assignedVehicle],
      totalCapacity: route.assignedVehicle.capacity,
      capacitySatisfied: route.employeeCount <= route.assignedVehicle.capacity,
      unusedCapacity: route.assignedVehicle.capacity - route.employeeCount,
      utilization: route.assignedVehicle.capacity > 0 ? route.employeeCount / route.assignedVehicle.capacity : 0,
    })),
    routes,
    unassignedEmployeeIds: [...employeesWithoutPickupPoint, ...unassignedEmployeeIds],
    allEmployeesAssigned: employeesWithoutPickupPoint.length === 0 && unassignedEmployeeIds.length === 0,
    diagnostics: {
      employeesWithoutPickupPoint,
      rideTimeWarnings,
      stopCountWarnings,
      utilizationWarnings,
      costDataWarnings,
      warningCount:
        rideTimeWarnings.length +
        stopCountWarnings.length +
        utilizationWarnings.length +
        costDataWarnings.length +
        employeesWithoutPickupPoint.length +
        unassignedEmployeeIds.length,
      manualEdit: true,
    },
    totals: {
      totalTrips: routes.length,
      totalDistanceKm,
      totalDurationMinutes,
      totalEstimatedFuelLiters,
      totalEstimatedFuelCost,
      totalOperatingCost,
      costDataComplete,
      averageRideMinutes,
      maxRideMinutes,
      averageVehicleUtilization,
    },
    optimizationDecision: {
      strategy: String(baseResult.strategy ?? policy.strategy ?? "BALANCED"),
      manualEdit: true,
      basedOnPlanId: basePlanId,
      selectionBasis: "operator-authored trip assignment validated against the original road matrix",
    },
  };

const usedVehicleIds = uniqueNumbers(
  routes.map((route) => route.assignedVehicle.id)
);

const usedVehicles = usedVehicleIds
  .map((id) => vehicleById.get(id))
  .filter(
    (vehicle): vehicle is BaseVehicle =>
      Boolean(vehicle)
  );

const totalVehicleCapacity = usedVehicles.reduce(
  (sum, vehicle) => sum + vehicle.capacity,
  0
);

result.selectedVehicleCount = usedVehicles.length;

result.selectedVehicleIds = usedVehicleIds;

result.totalVehicleCapacity = totalVehicleCapacity;

result.capacityIsSufficient =
  totalVehicleCapacity >= transportableEmployeeIds.length;

const hardViolationCount = violations.length;

return {
    valid: hardViolationCount === 0,
    violations,
    result,
    summary: {
      hardViolationCount,
      qualityWarningCount: Number((result.optimizationInput as any).diagnostics.warningCount ?? 0),
      assignedEmployeeCount: transportableEmployeeIds.length - unassignedEmployeeIds.length,
      unassignedEmployeeCount: unassignedEmployeeIds.length,
      totalTrips: routes.length,
    },
  };
}

export const manualPlanService = {
  validate(basePlanId: number, input: ManualPlanEditInput) {
    return rebuild(basePlanId, input);
  },

  async createVersion(basePlanId: number, input: ManualPlanEditInput) {
    const validation = await rebuild(basePlanId, input);
    if (!validation.valid) {
      throw new HttpError(
        400,
        `Manual plan has ${validation.violations.length} hard validation violation(s). Validate the draft before saving.`
      );
    }

    const basePlan = await transportPlanRepository.findById(basePlanId);
    if (!basePlan) throw new HttpError(404, "Transport plan not found");
    const nextVersion = await transportPlanRepository.nextVersion(basePlan.date, basePlan.shiftId, basePlan.direction);
    const baseRequest = (basePlan.request ?? {}) as unknown as Record<string, unknown>;

    return transportPlanRepository.create({
      date: basePlan.date,
      shiftId: basePlan.shiftId,
      depotId: basePlan.depotId,
      direction: basePlan.direction,
      strategy: basePlan.strategy,
      status: "DRAFT",
      version: nextVersion,
      request: {
        ...baseRequest,
        manualEdit: true,
        basedOnPlanId: basePlanId,
      },
      result: validation.result as unknown as object,
    });
  },
};
