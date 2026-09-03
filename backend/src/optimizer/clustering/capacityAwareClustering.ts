export interface ClusterPoint {
  id: number;
}

export interface CapacityAwareCluster {
  id: number;
  pointIds: number[];
  employeeCount: number;
}

export type ClusterLinkageMode = "SINGLE" | "COMPLETE" | "AVERAGE";

interface EmployeeForClustering {
  pickupPoint: {
    id: number;
  } | null;
}

interface VehicleForClustering {
  capacity: number;
}

function symmetricDistance(
  distanceMatrix: number[][],
  firstIndex: number,
  secondIndex: number
) {
  const forward = distanceMatrix[firstIndex]?.[secondIndex] ?? Infinity;
  const backward = distanceMatrix[secondIndex]?.[firstIndex] ?? Infinity;
  return Math.min(forward, backward);
}

function clusterDistance(
  firstPointIds: number[],
  secondPointIds: number[],
  pointIndexMap: Map<number, number>,
  distanceMatrix: number[][],
  linkage: ClusterLinkageMode
) {
  const distances: number[] = [];

  for (const firstPointId of firstPointIds) {
    for (const secondPointId of secondPointIds) {
      const firstIndex = pointIndexMap.get(firstPointId);
      const secondIndex = pointIndexMap.get(secondPointId);
      if (firstIndex === undefined || secondIndex === undefined) continue;

      const distance = symmetricDistance(
        distanceMatrix,
        firstIndex,
        secondIndex
      );
      if (Number.isFinite(distance)) distances.push(distance);
    }
  }

  if (distances.length === 0) return Infinity;
  if (linkage === "COMPLETE") return Math.max(...distances);
  if (linkage === "AVERAGE") {
    return distances.reduce((sum, value) => sum + value, 0) / distances.length;
  }
  return Math.min(...distances);
}

/**
 * Capacity-aware geographic clustering.
 *
 * SINGLE linkage preserves the original RoutePilot behaviour and is useful
 * for broad, efficient grouping. COMPLETE and AVERAGE linkage create tighter
 * geographic groups and are intentionally available so the optimizer can
 * evaluate structurally different candidate plans.
 */
export function capacityAwareClustering(
  points: ClusterPoint[],
  distanceMatrix: number[][],
  employees: EmployeeForClustering[],
  vehicles: VehicleForClustering[],
  maxMergeDistanceKm: number,
  linkage: ClusterLinkageMode = "SINGLE"
): CapacityAwareCluster[] {
  const pointIndexMap = new Map<number, number>();
  points.forEach((point, index) => pointIndexMap.set(point.id, index));

  const employeeCountByPoint = new Map<number, number>();
  for (const employee of employees) {
    const pointId = employee.pickupPoint?.id;
    if (pointId === undefined) continue;
    employeeCountByPoint.set(
      pointId,
      (employeeCountByPoint.get(pointId) ?? 0) + 1
    );
  }

  const totalFleetCapacity = vehicles.reduce(
    (total, vehicle) => total + vehicle.capacity,
    0
  );

  const clusters: CapacityAwareCluster[] = points.map((point, index) => ({
    id: index + 1,
    pointIds: [point.id],
    employeeCount: employeeCountByPoint.get(point.id) ?? 0,
  }));

  let changed = true;
  while (changed) {
    changed = false;

    let bestPair:
      | {
          firstIndex: number;
          secondIndex: number;
          distance: number;
        }
      | null = null;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const combinedEmployeeCount =
          clusters[i].employeeCount + clusters[j].employeeCount;

        if (
          totalFleetCapacity > 0 &&
          combinedEmployeeCount > totalFleetCapacity
        ) {
          continue;
        }

        const distance = clusterDistance(
          clusters[i].pointIds,
          clusters[j].pointIds,
          pointIndexMap,
          distanceMatrix,
          linkage
        );

        if (
          distance <= maxMergeDistanceKm &&
          (bestPair === null || distance < bestPair.distance)
        ) {
          bestPair = {
            firstIndex: i,
            secondIndex: j,
            distance,
          };
        }
      }
    }

    if (!bestPair) break;

    const first = clusters[bestPair.firstIndex];
    const second = clusters[bestPair.secondIndex];
    const merged: CapacityAwareCluster = {
      id: first.id,
      pointIds: [...first.pointIds, ...second.pointIds],
      employeeCount: first.employeeCount + second.employeeCount,
    };

    clusters.splice(bestPair.secondIndex, 1);
    clusters.splice(bestPair.firstIndex, 1, merged);
    changed = true;
  }

  return clusters.map((cluster, index) => ({
    ...cluster,
    id: index + 1,
  }));
}
