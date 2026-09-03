import type { TripDirection } from "./trip.types";

export type OptimizationStrategy =
  | "BALANCED"
  | "LOWEST_COST"
  | "EMPLOYEE_COMFORT"
  | "FLEET_EFFICIENCY";

export interface OptimizationConstraintOverrides {
  maxClusterDistanceKm?: number;
  dwellMinutesPerStop?: number;
  maxEmployeeRideMinutes?: number;
  minimumVehicleUtilization?: number;
  maxStopsPerTrip?: number;
}

export interface OptimizationCostAssumptions {
  fuelPricePerLiter?: number;
}

export interface OptimizationPreviewInput {
  shiftId: number;
  date: string;
  depotId: number;
  direction: TripDirection;

  /*
   * Optional manual fleet eligibility.
   *
   * - omitted => every active vehicle may be used
   * - supplied => only these active vehicles may be used
   */
  vehicleIds?: number[];

  /*
   * Business-facing optimization policy.
   */
  strategy?: OptimizationStrategy;

  constraints?: OptimizationConstraintOverrides;
  costAssumptions?: OptimizationCostAssumptions;
}
