import type { ResolvedOptimizationPolicy } from "../policy/optimizationPolicy";

export type PlanningPriority = "PREFERRED" | "NORMAL" | "RESERVE";

export interface VehicleForAllocation {
  id: number;
  name: string;
  capacity: number;
  fuelConsumption: number | null;
  maintenanceCostPerKm?: number | null;
  costPerKm?: number | null;
  planningPriority?: string;
}

export interface ClusterDemand {
  clusterId: number;
  employeeCount: number;
}

export interface VehicleAllocation {
  clusterId: number;
  employeeCount: number;
  assignedVehicles: VehicleForAllocation[];
  totalCapacity: number;
  capacitySatisfied: boolean;
  unusedCapacity: number;
  utilization: number;
  estimatedVariableCostPerKm: number;
  economicsComplete: boolean;
  strategyApplied: ResolvedOptimizationPolicy["strategy"];
}

interface VehicleCombination {
  vehicles: VehicleForAllocation[];
  totalCapacity: number;
  unusedCapacity: number;
  utilization: number;
  estimatedVariableCostPerKm: number;
  incompleteEconomicsCount: number;
  reserveVehicleCount: number;
  preferredVehicleCount: number;
}

function priority(vehicle: VehicleForAllocation): PlanningPriority {
  const value = String(vehicle.planningPriority ?? "NORMAL").toUpperCase();
  return value === "PREFERRED" || value === "RESERVE" ? value : "NORMAL";
}

function maintenancePerKm(vehicle: VehicleForAllocation): number | null {
  if (vehicle.maintenanceCostPerKm !== undefined) return vehicle.maintenanceCostPerKm;
  return vehicle.costPerKm ?? null;
}

function vehicleVariableCostPerKm(
  vehicle: VehicleForAllocation,
  fuelPricePerLiter: number
) {
  const fuelCostPerKm = vehicle.fuelConsumption !== null
    ? (vehicle.fuelConsumption / 100) * fuelPricePerLiter
    : 0;
  const maintenance = maintenancePerKm(vehicle) ?? 0;
  return fuelCostPerKm + maintenance;
}

function vehicleEconomicsComplete(vehicle: VehicleForAllocation) {
  return vehicle.fuelConsumption !== null && maintenancePerKm(vehicle) !== null;
}

function toCombination(
  selected: VehicleForAllocation[],
  employeeCount: number,
  fuelPricePerLiter: number
): VehicleCombination {
  const totalCapacity = selected.reduce((sum, vehicle) => sum + vehicle.capacity, 0);
  return {
    vehicles: [...selected],
    totalCapacity,
    unusedCapacity: totalCapacity - employeeCount,
    utilization: totalCapacity > 0 ? employeeCount / totalCapacity : 0,
    estimatedVariableCostPerKm: selected.reduce(
      (sum, vehicle) => sum + vehicleVariableCostPerKm(vehicle, fuelPricePerLiter),
      0
    ),
    incompleteEconomicsCount: selected.filter(
      (vehicle) => !vehicleEconomicsComplete(vehicle)
    ).length,
    reserveVehicleCount: selected.filter(
      (vehicle) => priority(vehicle) === "RESERVE"
    ).length,
    preferredVehicleCount: selected.filter(
      (vehicle) => priority(vehicle) === "PREFERRED"
    ).length,
  };
}

function buildFeasibleCombinations(
  vehicles: VehicleForAllocation[],
  employeeCount: number,
  fuelPricePerLiter: number
): VehicleCombination[] {
  const combinations: VehicleCombination[] = [];

  // Exact subset enumeration is useful for the normal RoutePilot fleet size.
  // For a larger fleet we keep a diverse, bounded set of greedy candidates.
  if (vehicles.length > 16) {
    const orderings = [
      [...vehicles].sort((a, b) => b.capacity - a.capacity),
      [...vehicles].sort((a, b) => a.capacity - b.capacity),
      [...vehicles].sort(
        (a, b) =>
          vehicleVariableCostPerKm(a, fuelPricePerLiter) -
          vehicleVariableCostPerKm(b, fuelPricePerLiter)
      ),
      [...vehicles].sort((a, b) => priorityRank(a) - priorityRank(b)),
    ];

    for (const ordered of orderings) {
      const selected: VehicleForAllocation[] = [];
      let capacity = 0;
      for (const vehicle of ordered) {
        selected.push(vehicle);
        capacity += vehicle.capacity;
        if (capacity >= employeeCount) {
          combinations.push(
            toCombination(selected, employeeCount, fuelPricePerLiter)
          );
          break;
        }
      }
    }

    return dedupeCombinations(combinations);
  }

  const suffixCapacity = new Array<number>(vehicles.length + 1).fill(0);
  for (let i = vehicles.length - 1; i >= 0; i--) {
    suffixCapacity[i] = suffixCapacity[i + 1] + vehicles[i].capacity;
  }

  const selected: VehicleForAllocation[] = [];

  function search(index: number, totalCapacity: number) {
    if (totalCapacity + suffixCapacity[index] < employeeCount) return;

    if (index === vehicles.length) {
      if (totalCapacity >= employeeCount) {
        combinations.push(
          toCombination(selected, employeeCount, fuelPricePerLiter)
        );
      }
      return;
    }

    search(index + 1, totalCapacity);

    selected.push(vehicles[index]);
    search(index + 1, totalCapacity + vehicles[index].capacity);
    selected.pop();
  }

  search(0, 0);
  return combinations;
}

function dedupeCombinations(combinations: VehicleCombination[]) {
  const seen = new Set<string>();
  return combinations.filter((combination) => {
    const key = combination.vehicles
      .map((vehicle) => vehicle.id)
      .sort((a, b) => a - b)
      .join(",");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function priorityRank(vehicle: VehicleForAllocation) {
  const value = priority(vehicle);
  if (value === "PREFERRED") return 0;
  if (value === "NORMAL") return 1;
  return 2;
}

function candidateProxyScore(combination: VehicleCombination) {
  // Used only to keep recursion bounded. Final strategy selection happens
  // after full routing, scheduling and cost calculation in buildOptimizationInput.
  return (
    combination.reserveVehicleCount * 100000 +
    combination.incompleteEconomicsCount * 10000 +
    combination.vehicles.length * 1000 +
    combination.unusedCapacity * 10 +
    combination.estimatedVariableCostPerKm -
    combination.preferredVehicleCount
  );
}

function toAllocation(
  cluster: ClusterDemand,
  combination: VehicleCombination,
  policy: ResolvedOptimizationPolicy
): VehicleAllocation {
  return {
    clusterId: cluster.clusterId,
    employeeCount: cluster.employeeCount,
    assignedVehicles: combination.vehicles,
    totalCapacity: combination.totalCapacity,
    capacitySatisfied: combination.totalCapacity >= cluster.employeeCount,
    unusedCapacity: combination.unusedCapacity,
    utilization: combination.utilization,
    estimatedVariableCostPerKm: combination.estimatedVariableCostPerKm,
    economicsComplete: combination.incompleteEconomicsCount === 0,
    strategyApplied: policy.strategy,
  };
}

function emptyAllocation(
  cluster: ClusterDemand,
  policy: ResolvedOptimizationPolicy
): VehicleAllocation {
  return {
    clusterId: cluster.clusterId,
    employeeCount: cluster.employeeCount,
    assignedVehicles: [],
    totalCapacity: 0,
    capacitySatisfied: false,
    unusedCapacity: 0,
    utilization: 0,
    estimatedVariableCostPerKm: 0,
    economicsComplete: false,
    strategyApplied: policy.strategy,
  };
}

/**
 * Generate globally feasible vehicle-to-cluster assignments.
 *
 * Previous versions allocated one cluster at a time, which could consume the
 * "wrong" vehicle early and leave a later cluster unserved even when the total
 * fleet had enough seats. This recursive assignment evaluates the clusters
 * together and therefore avoids that local-greedy failure for normal fleet
 * sizes.
 */
export function generateVehicleAllocationCandidates(
  clusters: ClusterDemand[],
  vehicles: VehicleForAllocation[],
  policy: ResolvedOptimizationPolicy,
  maxCandidates = 48
): VehicleAllocation[][] {
  if (clusters.length === 0) return [[]];

  const sortedClusters = [...clusters].sort(
    (a, b) => b.employeeCount - a.employeeCount
  );

  const candidates: VehicleAllocation[][] = [];
  let exploredNodes = 0;
  const maxNodes = vehicles.length <= 10 ? 25000 : 5000;

  function recurse(
    clusterIndex: number,
    remainingVehicles: VehicleForAllocation[],
    allocations: VehicleAllocation[]
  ) {
    if (candidates.length >= maxCandidates || exploredNodes >= maxNodes) return;
    exploredNodes += 1;

    if (clusterIndex === sortedClusters.length) {
      candidates.push([...allocations]);
      return;
    }

    const cluster = sortedClusters[clusterIndex];
    const remainingDemand = sortedClusters
      .slice(clusterIndex)
      .reduce((sum, item) => sum + item.employeeCount, 0);
    const remainingCapacity = remainingVehicles.reduce(
      (sum, vehicle) => sum + vehicle.capacity,
      0
    );

    if (remainingCapacity < remainingDemand) return;

    const combinations = buildFeasibleCombinations(
      remainingVehicles,
      cluster.employeeCount,
      policy.fuelPricePerLiter
    )
      .sort((a, b) => candidateProxyScore(a) - candidateProxyScore(b))
      .slice(0, 18);

    for (const combination of combinations) {
      if (candidates.length >= maxCandidates || exploredNodes >= maxNodes) break;
      const usedIds = new Set(combination.vehicles.map((vehicle) => vehicle.id));
      recurse(
        clusterIndex + 1,
        remainingVehicles.filter((vehicle) => !usedIds.has(vehicle.id)),
        [...allocations, toAllocation(cluster, combination, policy)]
      );
    }
  }

  recurse(0, vehicles, []);

  if (candidates.length > 0) {
    // Restore the original cluster order in each candidate.
    return candidates.map((candidate) =>
      clusters.map(
        (cluster) =>
          candidate.find((allocation) => allocation.clusterId === cluster.clusterId) ??
          emptyAllocation(cluster, policy)
      )
    );
  }

  // Bounded fallback for a large/awkward fleet. It is intentionally returned
  // as a candidate rather than silently declaring the whole plan impossible.
  return [allocateVehicles(clusters, vehicles, policy)];
}

/**
 * Compatibility fallback / heuristic allocator.
 * New planning code should prefer generateVehicleAllocationCandidates().
 */
export function allocateVehicles(
  clusters: ClusterDemand[],
  vehicles: VehicleForAllocation[],
  policy: ResolvedOptimizationPolicy
): VehicleAllocation[] {
  const usedVehicleIds = new Set<number>();

  return clusters.map((cluster) => {
    const availableVehicles = vehicles.filter(
      (vehicle) => !usedVehicleIds.has(vehicle.id)
    );

    const combinations = buildFeasibleCombinations(
      availableVehicles,
      cluster.employeeCount,
      policy.fuelPricePerLiter
    );

    const selected = [...combinations].sort(
      (a, b) => candidateProxyScore(a) - candidateProxyScore(b)
    )[0];

    if (!selected) return emptyAllocation(cluster, policy);

    for (const vehicle of selected.vehicles) usedVehicleIds.add(vehicle.id);
    return toAllocation(cluster, selected, policy);
  });
}
