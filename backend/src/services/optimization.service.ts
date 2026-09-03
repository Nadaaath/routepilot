import { attendanceRepository } from "../repositories/attendance.repository";
import { shiftRepository } from "../repositories/shift.repository";
import { vehicleRepository } from "../repositories/vehicle.repository";
import { depotRepository } from "../repositories/depot.repository";
import { vehicleAvailabilityRepository } from "../repositories/vehicleAvailability.repository";

import { buildOptimizationInput } from "../optimizer/preprocessing/buildOptimizationInput";
import { resolveOptimizationPolicy } from "../optimizer/policy/optimizationPolicy";

import type { OptimizationPreviewInput } from "../types/optimization.types";

import { HttpError } from "../utils/httpError";

import { utcDayBounds } from "../utils/date";
export const optimizationService = {
  async preview(input: OptimizationPreviewInput) {
    const shift = await shiftRepository.findById(input.shiftId);

    if (!shift) {
      throw new HttpError(404, "Shift not found");
    }

    const depot = await depotRepository.findById(input.depotId);

    if (!depot) {
      throw new HttpError(404, "Depot not found");
    }

    const { start, end } = utcDayBounds(input.date);

    const [attendances, activeVehicles, unavailableVehicleIds] = await Promise.all([
      attendanceRepository.findPresentForShiftAndDay(
        input.shiftId,
        start,
        end
      ),
      vehicleRepository.findActive(),
      vehicleAvailabilityRepository.unavailableVehicleIdsForDay(start),
    ]);

    const employees = attendances.map(
      (attendance) => attendance.employee
    );

    if (employees.length === 0) {
      throw new HttpError(
        400,
        `No present employees found for shift ${input.shiftId} on ${start
          .toISOString()
          .slice(0, 10)}`
      );
    }

    const employeesWithPickupPoint = employees.filter(
      (employee) => employee.pickupPoint !== null
    );

    if (employeesWithPickupPoint.length === 0) {
      throw new HttpError(
        400,
        "No present employees with pickup points were found for the selected shift and date"
      );
    }

    /*
     * Optional manual fleet eligibility.
     *
     * - no vehicleIds => all active vehicles are eligible
     * - vehicleIds => only those active vehicles are eligible
     */
    const unavailableSet = new Set(unavailableVehicleIds);
    const operationalVehicles = activeVehicles.filter((vehicle) => !unavailableSet.has(vehicle.id));
    const automaticEligibleVehicles = operationalVehicles.filter((vehicle) => vehicle.optimizerEligible !== false);

    // Automatic planning respects the fleet-level optimizer eligibility flag.
    // Guided manual vehicleIds can still explicitly select an operational reserve/manual-only vehicle.
    let vehicles = automaticEligibleVehicles;

    if (input.vehicleIds) {
      const selectedIds = new Set(input.vehicleIds);

      vehicles = operationalVehicles.filter((vehicle) =>
        selectedIds.has(vehicle.id)
      );

      const foundIds = new Set(vehicles.map((vehicle) => vehicle.id));
      const unavailableIds = input.vehicleIds.filter(
        (id) => !foundIds.has(id)
      );

      if (unavailableIds.length > 0) {
        throw new HttpError(
          400,
          `Selected vehicles must exist, be active, and be available for this date. Unavailable vehicle IDs: ${unavailableIds.join(
            ", "
          )}`
        );
      }
    }

    if (vehicles.length === 0) {
      throw new HttpError(400, input.vehicleIds ? "No selected operational vehicles are available for this plan" : "No vehicles are eligible for automatic optimization on this date");
    }

    const policy = resolveOptimizationPolicy(input);

    const totalCapacity = vehicles.reduce(
      (total, vehicle) => total + vehicle.capacity,
      0
    );

    const optimizationInput = await buildOptimizationInput(
      employees,
      vehicles,
      depot,
      input.direction,
      shift.startTime,
      shift.endTime,
      policy
    );

    return {
      status: "preview",

      shift,
      depot,

      direction: input.direction,
      date: start.toISOString().slice(0, 10),

      employeeCount: employees.length,
      employeeCountWithPickupPoint: employeesWithPickupPoint.length,
      employeeCountWithoutPickupPoint:
        employees.length - employeesWithPickupPoint.length,

      activeVehicleCount: activeVehicles.length,
      operationalVehicleCount: operationalVehicles.length,
      automaticEligibleVehicleCount: automaticEligibleVehicles.length,
      unavailableVehicleIds,
      selectedVehicleCount: vehicles.length,
      selectedVehicleIds: vehicles.map((vehicle) => vehicle.id),

      totalVehicleCapacity: totalCapacity,
      capacityIsSufficient: totalCapacity >= employees.length,

      strategy: policy.strategy,
      policyApplied: policy,

      optimizationInput,
    };
  },
};
