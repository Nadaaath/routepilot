import type { TripDirection } from "../../types/trip.types";

interface Point {
  id: number;
  latitude: number;
  longitude: number;
}

export type RouteOrderingMode =
  | "DEFAULT"
  | "SHORTEST"
  | "NEAREST_DEPOT_START"
  | "FARTHEST_DEPOT_START";

export interface TripRouteResult {
  orderedPointIds: number[];
  stopDistanceKm: number;
  depotDistanceKm: number;
  totalDistanceKm: number;
  stopDurationMinutes: number;
  depotDurationMinutes: number;
  totalDurationMinutes: number;
}

interface EvaluatedOrder extends TripRouteResult {
  startPointId: number;
}

function emptyRoute(): TripRouteResult {
  return {
    orderedPointIds: [],
    stopDistanceKm: 0,
    depotDistanceKm: 0,
    totalDistanceKm: 0,
    stopDurationMinutes: 0,
    depotDurationMinutes: 0,
    totalDurationMinutes: 0,
  };
}

function buildNearestNeighborOrder(
  firstPointId: number,
  clusterPointIds: number[],
  pointIndexMap: Map<number, number>,
  distanceMatrix: number[][],
  durationMatrix: number[][],
  depotIndex: number,
  direction: TripDirection
): EvaluatedOrder {
  const unvisited = new Set(clusterPointIds);
  const orderedPointIds: number[] = [];
  let stopDistanceKm = 0;
  let depotDistanceKm = 0;
  let stopDurationMinutes = 0;
  let depotDurationMinutes = 0;

  const firstIndex = pointIndexMap.get(firstPointId);
  if (firstIndex === undefined) {
    return { ...emptyRoute(), startPointId: firstPointId };
  }

  if (direction === "OUTBOUND") {
    depotDistanceKm = distanceMatrix[depotIndex]?.[firstIndex] ?? 0;
    depotDurationMinutes = durationMatrix[depotIndex]?.[firstIndex] ?? 0;
  }

  orderedPointIds.push(firstPointId);
  unvisited.delete(firstPointId);
  let currentPointId = firstPointId;

  while (unvisited.size > 0) {
    const currentIndex = pointIndexMap.get(currentPointId);
    if (currentIndex === undefined) break;

    let nearestPointId: number | null = null;
    let nearestDistance = Infinity;

    for (const candidatePointId of unvisited) {
      const candidateIndex = pointIndexMap.get(candidatePointId);
      if (candidateIndex === undefined) continue;
      const distance =
        distanceMatrix[currentIndex]?.[candidateIndex] ?? Infinity;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPointId = candidatePointId;
      }
    }

    if (nearestPointId === null) break;
    const nearestIndex = pointIndexMap.get(nearestPointId);
    if (nearestIndex === undefined) break;

    stopDistanceKm +=
      distanceMatrix[currentIndex]?.[nearestIndex] ?? 0;
    stopDurationMinutes +=
      durationMatrix[currentIndex]?.[nearestIndex] ?? 0;
    orderedPointIds.push(nearestPointId);
    unvisited.delete(nearestPointId);
    currentPointId = nearestPointId;
  }

  if (direction === "INBOUND" && orderedPointIds.length > 0) {
    const lastPointId = orderedPointIds[orderedPointIds.length - 1];
    const lastPointIndex = pointIndexMap.get(lastPointId);
    if (lastPointIndex !== undefined) {
      depotDistanceKm = distanceMatrix[lastPointIndex]?.[depotIndex] ?? 0;
      depotDurationMinutes = durationMatrix[lastPointIndex]?.[depotIndex] ?? 0;
    }
  }

  return {
    startPointId: firstPointId,
    orderedPointIds,
    stopDistanceKm,
    depotDistanceKm,
    totalDistanceKm: stopDistanceKm + depotDistanceKm,
    stopDurationMinutes,
    depotDurationMinutes,
    totalDurationMinutes: stopDurationMinutes + depotDurationMinutes,
  };
}

function depotDistanceForStart(
  pointId: number,
  pointIndexMap: Map<number, number>,
  distanceMatrix: number[][],
  depotIndex: number,
  direction: TripDirection
) {
  const pointIndex = pointIndexMap.get(pointId);
  if (pointIndex === undefined) return Infinity;
  return direction === "INBOUND"
    ? distanceMatrix[pointIndex]?.[depotIndex] ?? Infinity
    : distanceMatrix[depotIndex]?.[pointIndex] ?? Infinity;
}

/**
 * Build one route ordering for a trip.
 *
 * V11 keeps the original DEFAULT behaviour, while also allowing the optimizer
 * to evaluate alternative start points and the shortest nearest-neighbour
 * route. The final strategy scoring happens after schedules and employee ride
 * times are calculated, so route ordering is no longer a single hard-coded
 * choice.
 */
export function buildTripRoute(
  clusterPointIds: number[],
  pickupPoints: Point[],
  distanceMatrix: number[][],
  durationMatrix: number[][],
  depotIndex: number,
  direction: TripDirection,
  mode: RouteOrderingMode = "DEFAULT"
): TripRouteResult {
  if (clusterPointIds.length === 0) return emptyRoute();

  const pointIndexMap = new Map<number, number>();
  pickupPoints.forEach((point, index) => pointIndexMap.set(point.id, index));

  const validPointIds = clusterPointIds.filter((pointId) =>
    pointIndexMap.has(pointId)
  );
  if (validPointIds.length === 0) return emptyRoute();

  const orderedByDepotDistance = [...validPointIds].sort((a, b) => {
    const aDistance = depotDistanceForStart(
      a,
      pointIndexMap,
      distanceMatrix,
      depotIndex,
      direction
    );
    const bDistance = depotDistanceForStart(
      b,
      pointIndexMap,
      distanceMatrix,
      depotIndex,
      direction
    );
    return aDistance - bDistance;
  });

  let candidateStartIds: number[];

  if (mode === "SHORTEST") {
    // Trying every start point is cheap because a vehicle normally visits only
    // a handful of pickup points. Keep a safety cap for unusually large trips.
    candidateStartIds =
      validPointIds.length <= 12
        ? [...validPointIds]
        : [
            orderedByDepotDistance[0],
            orderedByDepotDistance[orderedByDepotDistance.length - 1],
          ];
  } else if (mode === "NEAREST_DEPOT_START") {
    candidateStartIds = [orderedByDepotDistance[0]];
  } else if (mode === "FARTHEST_DEPOT_START") {
    candidateStartIds = [
      orderedByDepotDistance[orderedByDepotDistance.length - 1],
    ];
  } else {
    candidateStartIds = [
      direction === "INBOUND"
        ? orderedByDepotDistance[orderedByDepotDistance.length - 1]
        : orderedByDepotDistance[0],
    ];
  }

  const evaluated = candidateStartIds.map((firstPointId) =>
    buildNearestNeighborOrder(
      firstPointId,
      validPointIds,
      pointIndexMap,
      distanceMatrix,
      durationMatrix,
      depotIndex,
      direction
    )
  );

  const selected = [...evaluated].sort((a, b) => {
    if (a.totalDistanceKm !== b.totalDistanceKm) {
      return a.totalDistanceKm - b.totalDistanceKm;
    }
    return a.totalDurationMinutes - b.totalDurationMinutes;
  })[0];

  const { startPointId: _startPointId, ...route } = selected;
  return route;
}
