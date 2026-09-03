import type { OptimizationStrategy } from "../types/optimization.types";

const ALLOWED_STRATEGIES = new Set<OptimizationStrategy>([
  "BALANCED",
  "LOWEST_COST",
  "EMPLOYEE_COMFORT",
  "FLEET_EFFICIENCY",
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function validateOptimizationPreview(
  body: unknown
): string[] {
  if (!body || typeof body !== "object") {
    return ["Request body is required"];
  }

  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (!Number.isInteger(data.shiftId) || Number(data.shiftId) <= 0) {
    errors.push("shiftId must be a positive integer");
  }

  if (!Number.isInteger(data.depotId) || Number(data.depotId) <= 0) {
    errors.push("depotId must be a positive integer");
  }

  if (
    typeof data.date !== "string" ||
    Number.isNaN(Date.parse(data.date))
  ) {
    errors.push("date must be a valid ISO date string");
  }

  if (data.direction !== "INBOUND" && data.direction !== "OUTBOUND") {
    errors.push("direction must be INBOUND or OUTBOUND");
  }

  if (data.vehicleIds !== undefined) {
    if (!Array.isArray(data.vehicleIds) || data.vehicleIds.length === 0) {
      errors.push("vehicleIds must be a non-empty array when provided");
    } else {
      const ids = data.vehicleIds;

      if (
        ids.some((id) => !Number.isInteger(id) || Number(id) <= 0)
      ) {
        errors.push("vehicleIds must contain only positive integers");
      }

      if (new Set(ids).size !== ids.length) {
        errors.push("vehicleIds must not contain duplicates");
      }
    }
  }

  if (data.strategy !== undefined) {
    if (
      typeof data.strategy !== "string" ||
      !ALLOWED_STRATEGIES.has(data.strategy as OptimizationStrategy)
    ) {
      errors.push(
        "strategy must be BALANCED, LOWEST_COST, EMPLOYEE_COMFORT, or FLEET_EFFICIENCY"
      );
    }
  }

  if (data.constraints !== undefined) {
    if (!data.constraints || typeof data.constraints !== "object") {
      errors.push("constraints must be an object");
    } else {
      const constraints = data.constraints as Record<string, unknown>;

      if (constraints.maxClusterDistanceKm !== undefined) {
        const value = constraints.maxClusterDistanceKm;

        if (!isFiniteNumber(value) || value <= 0 || value > 100) {
          errors.push(
            "constraints.maxClusterDistanceKm must be greater than 0 and at most 100"
          );
        }
      }

      if (constraints.dwellMinutesPerStop !== undefined) {
        const value = constraints.dwellMinutesPerStop;

        if (!isFiniteNumber(value) || value < 0 || value > 30) {
          errors.push(
            "constraints.dwellMinutesPerStop must be between 0 and 30"
          );
        }
      }

      if (constraints.maxEmployeeRideMinutes !== undefined) {
        const value = constraints.maxEmployeeRideMinutes;

        if (!isFiniteNumber(value) || value < 5 || value > 240) {
          errors.push(
            "constraints.maxEmployeeRideMinutes must be between 5 and 240"
          );
        }
      }

      if (constraints.minimumVehicleUtilization !== undefined) {
        const value = constraints.minimumVehicleUtilization;

        if (!isFiniteNumber(value) || value < 0 || value > 1) {
          errors.push(
            "constraints.minimumVehicleUtilization must be between 0 and 1"
          );
        }
      }

      if (constraints.maxStopsPerTrip !== undefined) {
        const value = constraints.maxStopsPerTrip;

        if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > 25) {
          errors.push(
            "constraints.maxStopsPerTrip must be an integer between 1 and 25"
          );
        }
      }
    }
  }

  if (data.costAssumptions !== undefined) {
    if (!data.costAssumptions || typeof data.costAssumptions !== "object") {
      errors.push("costAssumptions must be an object");
    } else {
      const costAssumptions = data.costAssumptions as Record<string, unknown>;

      if (costAssumptions.fuelPricePerLiter !== undefined) {
        const value = costAssumptions.fuelPricePerLiter;

        if (!isFiniteNumber(value) || value < 0 || value > 100) {
          errors.push(
            "costAssumptions.fuelPricePerLiter must be between 0 and 100"
          );
        }
      }
    }
  }

  return errors;
}
