import type {
  OptimizationPreviewInput,
  OptimizationStrategy,
} from "../../types/optimization.types";

export interface ResolvedOptimizationPolicy {
  strategy: OptimizationStrategy;

  /*
   * These are business constraints / quality targets.
   * They deliberately do NOT change when the objective changes.
   * This keeps Balanced / Cost / Comfort / Fleet comparisons fair.
   */
  maxClusterDistanceKm: number;
  dwellMinutesPerStop: number;
  maxEmployeeRideMinutes: number;
  minimumVehicleUtilization: number;
  maxStopsPerTrip: number;
  fuelPricePerLiter: number;
}

const BUSINESS_DEFAULTS: Omit<ResolvedOptimizationPolicy, "strategy"> = {
  maxClusterDistanceKm: 10,
  dwellMinutesPerStop: 2,
  maxEmployeeRideMinutes: 45,
  minimumVehicleUtilization: 0.65,
  maxStopsPerTrip: 6,
  fuelPricePerLiter: 14,
};

export function resolveOptimizationPolicy(
  input: OptimizationPreviewInput
): ResolvedOptimizationPolicy {
  return {
    strategy: input.strategy ?? "BALANCED",

    maxClusterDistanceKm:
      input.constraints?.maxClusterDistanceKm ??
      BUSINESS_DEFAULTS.maxClusterDistanceKm,

    dwellMinutesPerStop:
      input.constraints?.dwellMinutesPerStop ??
      BUSINESS_DEFAULTS.dwellMinutesPerStop,

    maxEmployeeRideMinutes:
      input.constraints?.maxEmployeeRideMinutes ??
      BUSINESS_DEFAULTS.maxEmployeeRideMinutes,

    minimumVehicleUtilization:
      input.constraints?.minimumVehicleUtilization ??
      BUSINESS_DEFAULTS.minimumVehicleUtilization,

    maxStopsPerTrip:
      input.constraints?.maxStopsPerTrip ??
      BUSINESS_DEFAULTS.maxStopsPerTrip,

    fuelPricePerLiter:
      input.costAssumptions?.fuelPricePerLiter ??
      BUSINESS_DEFAULTS.fuelPricePerLiter,
  };
}
