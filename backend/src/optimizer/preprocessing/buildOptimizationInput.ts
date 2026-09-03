import { buildRoadMatrix } from "../../services/routing.service";
import {
  capacityAwareClustering,
  type CapacityAwareCluster,
  type ClusterLinkageMode,
} from "../clustering/capacityAwareClustering";
import {
  generateVehicleAllocationCandidates,
  type VehicleAllocation,
} from "../assignment/vehicleAllocation";
import {
  splitClusterIntoTrips,
  type TripSplitMode,
} from "../assignment/splitClusterIntoTrips";
import {
  buildTripRoute,
  type RouteOrderingMode,
} from "../routing/buildTripRoute";
import { buildTripSchedule } from "../scheduling/buildTripSchedule";
import {
  buildEmployeeRideTimes,
  type EmployeeRideTime,
} from "../scheduling/buildEmployeeRideTimes";
import {
  calculateRouteCost,
  type RouteCostResult,
} from "../objective/calculateRouteCost";
import type { TripDirection } from "../../types/trip.types";
import type { ResolvedOptimizationPolicy } from "../policy/optimizationPolicy";

interface EmployeeInput {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string | null;
  active?: boolean;
  pickupPointId?: number | null;
  pickupPoint: {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    address?: string | null;
    mapUrl?: string | null;
  } | null;
}

interface VehicleInput {
  id: number;
  name: string;
  capacity: number;
  registration?: string;
  active?: boolean;
  fuelConsumption: number | null;
  costPerKm?: number | null;
  maintenanceCostPerKm?: number | null;
  planningPriority?: string;
}

interface DepotInput {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  mapUrl?: string | null;
}

interface RouteLike {
  tripId: number;
  clusterId: number;
  direction: TripDirection;
  assignedVehicle: VehicleInput;
  employeeCount: number;
  employeeIds: number[];
  pointIds: number[];
  orderedPointIds: number[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  schedule: unknown;
  employeeRideTimes: EmployeeRideTime[];
  routeCost: RouteCostResult;
  [key: string]: unknown;
}

interface CandidateVariant {
  clusteringThresholdKm: number;
  linkage: ClusterLinkageMode | "RECOVERY_MERGED";
  splitMode: TripSplitMode;
  routeMode: RouteOrderingMode;
}

interface CandidatePlan {
  variant: CandidateVariant;
  clusters: CapacityAwareCluster[];
  clusterDemands: { clusterId: number; employeeCount: number }[];
  vehicleAllocations: VehicleAllocation[];
  routes: RouteLike[];
  unassignedEmployeeIds: number[];
  transportableUnassignedEmployeeIds: number[];
  diagnostics: {
    employeesWithoutPickupPoint: number[];
    rideTimeWarnings: Array<{
      tripId: number;
      employeeId: number;
      rideTimeMinutes: number;
      limitMinutes: number;
    }>;
    stopCountWarnings: Array<{
      tripId: number;
      stopCount: number;
      limitStops: number;
    }>;
    utilizationWarnings: Array<{
      tripId: number;
      vehicleId: number;
      employeeCount: number;
      capacity: number;
      utilization: number;
      minimumUtilization: number;
    }>;
    costDataWarnings: Array<{
      tripId: number;
      vehicleId: number;
      vehicleName: string;
      missingFuelConsumption: boolean;
      missingMaintenanceCost: boolean;
    }>;
    warningCount: number;
    recoveryApplied: boolean;
  };
  totals: {
    totalTrips: number;
    totalDistanceKm: number;
    totalDurationMinutes: number;
    totalEstimatedFuelLiters: number;
    totalEstimatedFuelCost: number;
    totalOperatingCost: number;
    costDataComplete: boolean;
    averageRideMinutes: number;
    maxRideMinutes: number;
    averageVehicleUtilization: number;
    reserveVehicleCount: number;
    preferredVehicleCount: number;
  };
  recoveryApplied: boolean;
}

interface ClusterVariant {
  clusters: CapacityAwareCluster[];
  thresholdKm: number;
  linkage: ClusterLinkageMode;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function numberCompare(a: number, b: number) {
  const epsilon = 1e-9;
  if (Math.abs(a - b) <= epsilon) return 0;
  return a < b ? -1 : 1;
}

function clusterSignature(clusters: CapacityAwareCluster[]) {
  return clusters
    .map((cluster) => [...cluster.pointIds].sort((a, b) => a - b).join(","))
    .sort()
    .join("|");
}

function roundThreshold(value: number) {
  return Math.max(0.25, Math.round(value * 100) / 100);
}

function generateClusterVariants(
  pickupPoints: Array<{ id: number }>,
  pickupDistanceMatrix: number[][],
  employees: EmployeeInput[],
  vehicles: VehicleInput[],
  maxClusterDistanceKm: number
): ClusterVariant[] {
  const recipes: Array<{
    multiplier: number;
    linkage: ClusterLinkageMode;
  }> = [
    { multiplier: 1, linkage: "SINGLE" },
    { multiplier: 0.85, linkage: "SINGLE" },
    { multiplier: 0.85, linkage: "AVERAGE" },
    { multiplier: 0.7, linkage: "AVERAGE" },
    { multiplier: 0.7, linkage: "COMPLETE" },
    { multiplier: 0.55, linkage: "COMPLETE" },
  ];

  const seen = new Set<string>();
  const variants: ClusterVariant[] = [];

  for (const recipe of recipes) {
    const thresholdKm = roundThreshold(
      maxClusterDistanceKm * recipe.multiplier
    );
    const clusters = capacityAwareClustering(
      pickupPoints,
      pickupDistanceMatrix,
      employees,
      vehicles,
      thresholdKm,
      recipe.linkage
    );
    const signature = clusterSignature(clusters);
    if (seen.has(signature)) continue;
    seen.add(signature);
    variants.push({
      clusters,
      thresholdKm,
      linkage: recipe.linkage,
    });
  }

  return variants;
}

function compareCandidatePlans(
  a: CandidatePlan,
  b: CandidatePlan,
  policy: ResolvedOptimizationPolicy
) {
  // Feasibility always wins before an objective.
  const assignment =
    a.transportableUnassignedEmployeeIds.length -
    b.transportableUnassignedEmployeeIds.length;
  if (assignment !== 0) return assignment;

  const reserveDifference =
    a.totals.reserveVehicleCount - b.totals.reserveVehicleCount;
  if (reserveDifference !== 0) return reserveDifference;

  const aComplete = a.totals.costDataComplete ? 0 : 1;
  const bComplete = b.totals.costDataComplete ? 0 : 1;

  if (policy.strategy === "LOWEST_COST") {
    const completeness = aComplete - bComplete;
    if (completeness !== 0) return completeness;

    const cost = numberCompare(
      a.totals.totalOperatingCost,
      b.totals.totalOperatingCost
    );
    if (cost !== 0) return cost;

    const distance = numberCompare(
      a.totals.totalDistanceKm,
      b.totals.totalDistanceKm
    );
    if (distance !== 0) return distance;

    return a.totals.totalTrips - b.totals.totalTrips;
  }

  if (policy.strategy === "EMPLOYEE_COMFORT") {
    const violations =
      a.diagnostics.rideTimeWarnings.length -
      b.diagnostics.rideTimeWarnings.length;
    if (violations !== 0) return violations;

    const maxRide = numberCompare(
      a.totals.maxRideMinutes,
      b.totals.maxRideMinutes
    );
    if (maxRide !== 0) return maxRide;

    const averageRide = numberCompare(
      a.totals.averageRideMinutes,
      b.totals.averageRideMinutes
    );
    if (averageRide !== 0) return averageRide;

    const stopViolations =
      a.diagnostics.stopCountWarnings.length -
      b.diagnostics.stopCountWarnings.length;
    if (stopViolations !== 0) return stopViolations;

    return numberCompare(
      a.totals.totalOperatingCost,
      b.totals.totalOperatingCost
    );
  }

  if (policy.strategy === "FLEET_EFFICIENCY") {
    const trips = a.totals.totalTrips - b.totals.totalTrips;
    if (trips !== 0) return trips;

    const utilizationWarnings =
      a.diagnostics.utilizationWarnings.length -
      b.diagnostics.utilizationWarnings.length;
    if (utilizationWarnings !== 0) return utilizationWarnings;

    const utilization = numberCompare(
      b.totals.averageVehicleUtilization,
      a.totals.averageVehicleUtilization
    );
    if (utilization !== 0) return utilization;

    const distance = numberCompare(
      a.totals.totalDistanceKm,
      b.totals.totalDistanceKm
    );
    if (distance !== 0) return distance;

    return numberCompare(
      a.totals.totalOperatingCost,
      b.totals.totalOperatingCost
    );
  }

  const aOperationalWarnings =
    a.diagnostics.rideTimeWarnings.length +
    a.diagnostics.stopCountWarnings.length +
    a.diagnostics.utilizationWarnings.length;
  const bOperationalWarnings =
    b.diagnostics.rideTimeWarnings.length +
    b.diagnostics.stopCountWarnings.length +
    b.diagnostics.utilizationWarnings.length;

  const warningDifference = aOperationalWarnings - bOperationalWarnings;
  if (warningDifference !== 0) return warningDifference;

  const maxRide = numberCompare(
    a.totals.maxRideMinutes,
    b.totals.maxRideMinutes
  );
  if (maxRide !== 0) return maxRide;

  const averageRide = numberCompare(
    a.totals.averageRideMinutes,
    b.totals.averageRideMinutes
  );
  if (averageRide !== 0) return averageRide;

  const completeness = aComplete - bComplete;
  if (completeness !== 0) return completeness;

  const cost = numberCompare(
    a.totals.totalOperatingCost,
    b.totals.totalOperatingCost
  );
  if (cost !== 0) return cost;

  const trips = a.totals.totalTrips - b.totals.totalTrips;
  if (trips !== 0) return trips;

  return numberCompare(a.totals.totalDistanceKm, b.totals.totalDistanceKm);
}

export async function buildOptimizationInput(
  employees: EmployeeInput[],
  vehicles: VehicleInput[],
  depot: DepotInput,
  direction: TripDirection,
  shiftStartTime: string,
  shiftEndTime: string,
  policy: ResolvedOptimizationPolicy
) {
  const pickupPointMap = new Map<
    number,
    {
      id: number;
      name: string;
      latitude: number;
      longitude: number;
      address?: string | null;
      mapUrl?: string | null;
    }
  >();

  for (const employee of employees) {
    if (employee.pickupPoint) {
      pickupPointMap.set(employee.pickupPoint.id, employee.pickupPoint);
    }
  }

  const pickupPoints = [...pickupPointMap.values()];

  const matrixLocations = [
    ...pickupPoints.map((point) => ({
      id: point.id,
      latitude: point.latitude,
      longitude: point.longitude,
    })),
    {
      id: depot.id,
      latitude: depot.latitude,
      longitude: depot.longitude,
    },
  ];

  const roadMatrix = await buildRoadMatrix(matrixLocations);
  const distanceMatrix = roadMatrix.distancesKm;
  const durationMatrix = roadMatrix.durationsMinutes;
  const depotIndex = matrixLocations.length - 1;

  const pickupDistanceMatrix = distanceMatrix
    .slice(0, pickupPoints.length)
    .map((row) => row.slice(0, pickupPoints.length));

  const clusterVariants = generateClusterVariants(
    pickupPoints,
    pickupDistanceMatrix,
    employees,
    vehicles,
    policy.maxClusterDistanceKm
  );

  const missingPickupIds = employees
    .filter((employee) => employee.pickupPoint === null)
    .map((employee) => employee.id);
  const transportableEmployeeCount = employees.length - missingPickupIds.length;

  function demandsFor(clusters: CapacityAwareCluster[]) {
    return clusters.map((cluster) => ({
      clusterId: cluster.id,
      employeeCount: employees.filter(
        (employee) =>
          employee.pickupPoint !== null &&
          cluster.pointIds.includes(employee.pickupPoint.id)
      ).length,
    }));
  }

  function buildCandidate(
    clusters: CapacityAwareCluster[],
    clusterDemands: { clusterId: number; employeeCount: number }[],
    vehicleAllocations: VehicleAllocation[],
    variant: CandidateVariant,
    recoveryApplied: boolean
  ): CandidatePlan {
    const routes: RouteLike[] = [];
    const transportableUnassignedEmployeeIds: number[] = [];
    let tripCounter = 1;

    for (const cluster of clusters) {
      const clusterEmployees = employees.filter(
        (employee) =>
          employee.pickupPoint !== null &&
          cluster.pointIds.includes(employee.pickupPoint.id)
      );

      const allocation = vehicleAllocations.find(
        (item) => item.clusterId === cluster.id
      );

      if (!allocation || allocation.assignedVehicles.length === 0) {
        transportableUnassignedEmployeeIds.push(
          ...clusterEmployees.map((employee) => employee.id)
        );
        continue;
      }

      const splitResult = splitClusterIntoTrips(
        clusterEmployees,
        allocation.assignedVehicles,
        variant.splitMode
      );

      transportableUnassignedEmployeeIds.push(
        ...splitResult.unassignedEmployeeIds
      );

      for (const tripGroup of splitResult.trips) {
        const route = buildTripRoute(
          tripGroup.pointIds,
          pickupPoints,
          distanceMatrix,
          durationMatrix,
          depotIndex,
          direction,
          variant.routeMode
        );

        const schedule = buildTripSchedule(
          route.orderedPointIds,
          pickupPoints,
          durationMatrix,
          depotIndex,
          direction,
          shiftStartTime,
          shiftEndTime,
          policy.dwellMinutesPerStop
        );

        const employeeRideTimes = buildEmployeeRideTimes(
          tripGroup.employees,
          schedule,
          direction
        );

        const routeCost = calculateRouteCost(
          tripGroup.vehicle,
          route.totalDistanceKm,
          policy.fuelPricePerLiter
        );

        routes.push({
          tripId: tripCounter++,
          clusterId: cluster.id,
          direction,
          assignedVehicle: tripGroup.vehicle as VehicleInput,
          employeeCount: tripGroup.employeeCount,
          employeeIds: tripGroup.employees.map((employee) => employee.id),
          pointIds: tripGroup.pointIds,
          ...route,
          schedule,
          employeeRideTimes,
          routeCost,
        });
      }
    }

    const cleanTransportableUnassigned = unique(
      transportableUnassignedEmployeeIds
    );
    const unassignedEmployeeIds = unique([
      ...missingPickupIds,
      ...cleanTransportableUnassigned,
    ]);

    const totalDistanceKm = routes.reduce(
      (total, route) => total + route.totalDistanceKm,
      0
    );
    const totalDurationMinutes = routes.reduce(
      (total, route) => total + route.totalDurationMinutes,
      0
    );
    const totalEstimatedFuelLiters = routes.reduce(
      (total, route) => total + (route.routeCost.estimatedFuelLiters ?? 0),
      0
    );
    const totalEstimatedFuelCost = routes.reduce(
      (total, route) => total + (route.routeCost.estimatedFuelCost ?? 0),
      0
    );
    const totalOperatingCost = routes.reduce(
      (total, route) => total + (route.routeCost.operatingCost ?? 0),
      0
    );

    const allRideTimes: EmployeeRideTime[] = routes.flatMap(
      (route) => route.employeeRideTimes
    );
    const averageRideMinutes = allRideTimes.length
      ? allRideTimes.reduce(
          (sum, rideTime) => sum + rideTime.rideTimeMinutes,
          0
        ) / allRideTimes.length
      : 0;
    const maxRideMinutes = allRideTimes.length
      ? Math.max(...allRideTimes.map((rideTime) => rideTime.rideTimeMinutes))
      : 0;
    const averageVehicleUtilization = routes.length
      ? routes.reduce(
          (sum, route) =>
            sum +
            (route.assignedVehicle.capacity > 0
              ? route.employeeCount / route.assignedVehicle.capacity
              : 0),
          0
        ) / routes.length
      : 0;

    const usedVehicleIds = new Set<number>();
    let reserveVehicleCount = 0;
    let preferredVehicleCount = 0;
    for (const route of routes) {
      if (usedVehicleIds.has(route.assignedVehicle.id)) continue;
      usedVehicleIds.add(route.assignedVehicle.id);
      const priority = String(
        route.assignedVehicle.planningPriority ?? "NORMAL"
      ).toUpperCase();
      if (priority === "RESERVE") reserveVehicleCount += 1;
      if (priority === "PREFERRED") preferredVehicleCount += 1;
    }

    const rideTimeWarnings = routes.flatMap((route) =>
      route.employeeRideTimes
        .filter(
          (rideTime) =>
            rideTime.rideTimeMinutes > policy.maxEmployeeRideMinutes
        )
        .map((rideTime) => ({
          tripId: route.tripId,
          employeeId: rideTime.employeeId,
          rideTimeMinutes: rideTime.rideTimeMinutes,
          limitMinutes: policy.maxEmployeeRideMinutes,
        }))
    );

    const stopCountWarnings = routes
      .filter((route) => route.orderedPointIds.length > policy.maxStopsPerTrip)
      .map((route) => ({
        tripId: route.tripId,
        stopCount: route.orderedPointIds.length,
        limitStops: policy.maxStopsPerTrip,
      }));

    const utilizationWarnings = routes
      .map((route) => {
        const capacity = route.assignedVehicle.capacity;
        const utilization = capacity > 0 ? route.employeeCount / capacity : 0;
        return {
          tripId: route.tripId,
          vehicleId: route.assignedVehicle.id,
          employeeCount: route.employeeCount,
          capacity,
          utilization,
          minimumUtilization: policy.minimumVehicleUtilization,
        };
      })
      .filter((item) => item.utilization < policy.minimumVehicleUtilization);

    const costDataWarnings = routes
      .filter((route) => route.routeCost.costDataComplete === false)
      .map((route) => ({
        tripId: route.tripId,
        vehicleId: route.assignedVehicle.id,
        vehicleName: route.assignedVehicle.name,
        missingFuelConsumption: route.assignedVehicle.fuelConsumption === null,
        missingMaintenanceCost:
          (route.assignedVehicle.maintenanceCostPerKm ??
            route.assignedVehicle.costPerKm ??
            null) === null,
      }));

    const costDataComplete = costDataWarnings.length === 0;

    return {
      variant,
      clusters,
      clusterDemands,
      vehicleAllocations,
      routes,
      unassignedEmployeeIds,
      transportableUnassignedEmployeeIds: cleanTransportableUnassigned,
      recoveryApplied,
      diagnostics: {
        employeesWithoutPickupPoint: missingPickupIds,
        rideTimeWarnings,
        stopCountWarnings,
        utilizationWarnings,
        costDataWarnings,
        warningCount:
          rideTimeWarnings.length +
          stopCountWarnings.length +
          utilizationWarnings.length +
          costDataWarnings.length +
          unassignedEmployeeIds.length,
        recoveryApplied,
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
        reserveVehicleCount,
        preferredVehicleCount,
      },
    };
  }

  const candidatePlans: CandidatePlan[] = [];
  const maxCandidatePlans = 180;

  const splitRouteRecipes: Array<{
    splitMode: TripSplitMode;
    routeMode: RouteOrderingMode;
  }> = [
    { splitMode: "BEST_FIT", routeMode: "DEFAULT" },
    { splitMode: "BEST_FIT", routeMode: "SHORTEST" },
    { splitMode: "BALANCED", routeMode: "SHORTEST" },
    { splitMode: "COMFORT_SPREAD", routeMode: "DEFAULT" },
    { splitMode: "COMFORT_SPREAD", routeMode: "NEAREST_DEPOT_START" },
  ];

  for (const clusterVariant of clusterVariants) {
    if (candidatePlans.length >= maxCandidatePlans) break;

    const clusterDemands = demandsFor(clusterVariant.clusters);
    const allocations = generateVehicleAllocationCandidates(
      clusterDemands,
      vehicles,
      policy,
      16
    );

    for (const vehicleAllocations of allocations) {
      for (const recipe of splitRouteRecipes) {
        if (candidatePlans.length >= maxCandidatePlans) break;
        candidatePlans.push(
          buildCandidate(
            clusterVariant.clusters,
            clusterDemands,
            vehicleAllocations,
            {
              clusteringThresholdKm: clusterVariant.thresholdKm,
              linkage: clusterVariant.linkage,
              splitMode: recipe.splitMode,
              routeMode: recipe.routeMode,
            },
            false
          )
        );
      }
    }
  }

  const totalFleetCapacity = vehicles.reduce(
    (sum, vehicle) => sum + vehicle.capacity,
    0
  );

  const bestBase = [...candidatePlans].sort((a, b) =>
    compareCandidatePlans(a, b, policy)
  )[0];

  // Recovery remains a safety net rather than the normal source of diversity.
  if (
    bestBase &&
    bestBase.transportableUnassignedEmployeeIds.length > 0 &&
    totalFleetCapacity >= transportableEmployeeCount &&
    pickupPoints.length > 0
  ) {
    const mergedClusters: CapacityAwareCluster[] = [
      {
        id: 1,
        pointIds: pickupPoints.map((point) => point.id),
        employeeCount: transportableEmployeeCount,
      },
    ];
    const mergedDemands = demandsFor(mergedClusters);
    const recoveryAllocations = generateVehicleAllocationCandidates(
      mergedDemands,
      vehicles,
      policy,
      24
    );

    for (const allocations of recoveryAllocations) {
      for (const recipe of splitRouteRecipes) {
        candidatePlans.push(
          buildCandidate(
            mergedClusters,
            mergedDemands,
            allocations,
            {
              clusteringThresholdKm: policy.maxClusterDistanceKm,
              linkage: "RECOVERY_MERGED",
              splitMode: recipe.splitMode,
              routeMode: recipe.routeMode,
            },
            true
          )
        );
      }
    }
  }

  if (candidatePlans.length === 0) {
    throw new Error("Optimizer could not construct any candidate plan");
  }

  const selectedPlan = [...candidatePlans].sort((a, b) =>
    compareCandidatePlans(a, b, policy)
  )[0];

  return {
    direction,
    policyApplied: policy,
    depot,
    employees,
    vehicles,
    pickupPoints,
    distanceMatrix,
    durationMatrix,
    depotIndex,
    clusters: selectedPlan.clusters,
    clusterDemands: selectedPlan.clusterDemands,
    vehicleAllocations: selectedPlan.vehicleAllocations,
    routes: selectedPlan.routes,
    unassignedEmployeeIds: selectedPlan.unassignedEmployeeIds,
    allEmployeesAssigned: selectedPlan.unassignedEmployeeIds.length === 0,
    diagnostics: {
      ...selectedPlan.diagnostics,
      candidatePlansEvaluated: candidatePlans.length,
      clusterVariantsEvaluated: clusterVariants.length,
      selectionStrategy: policy.strategy,
      transportableUnassignedCount:
        selectedPlan.transportableUnassignedEmployeeIds.length,
    },
    totals: selectedPlan.totals,
    optimizationDecision: {
      strategy: policy.strategy,
      candidatePlansEvaluated: candidatePlans.length,
      clusterVariantsEvaluated: clusterVariants.length,
      recoveryApplied: selectedPlan.recoveryApplied,
      constraintsSharedAcrossStrategies: true,
      selectedVariant: selectedPlan.variant,
      selectionBasis:
        policy.strategy === "LOWEST_COST"
          ? "lowest final routed variable cost among diverse feasible candidates"
          : policy.strategy === "EMPLOYEE_COMFORT"
            ? "fewest ride-time violations, then max and average ride time"
            : policy.strategy === "FLEET_EFFICIENCY"
              ? "fewest trips, then utilization and distance"
              : "fewest operational warnings, then ride time, cost and fleet size",
    },
  };
}
