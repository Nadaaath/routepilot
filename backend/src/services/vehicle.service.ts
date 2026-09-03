import { vehicleRepository } from "../repositories/vehicle.repository";
import type { CreateVehicleInput, UpdateVehicleInput, VehiclePlanningPriority } from "../types/vehicle.types";
import { HttpError } from "../utils/httpError";

const PRIORITIES = new Set<VehiclePlanningPriority>(["PREFERRED", "NORMAL", "RESERVE"]);

function normalize<T extends CreateVehicleInput | UpdateVehicleInput>(data: T): T {
  const normalized = { ...data } as T;

  if (normalized.planningPriority !== undefined) {
    const priority = String(normalized.planningPriority).toUpperCase() as VehiclePlanningPriority;
    if (!PRIORITIES.has(priority)) throw new HttpError(400, "planningPriority must be PREFERRED, NORMAL, or RESERVE");
    normalized.planningPriority = priority;
  }

  // Backward compatibility: if an older client still sends costPerKm, carry it
  // into the new non-fuel variable-cost field unless the new field is explicit.
  if (normalized.maintenanceCostPerKm === undefined && normalized.costPerKm !== undefined) {
    normalized.maintenanceCostPerKm = normalized.costPerKm;
  }

  return normalized;
}

export const vehicleService = {
  getAll() {
    return vehicleRepository.findAll();
  },

  async getById(id: number) {
    const vehicle = await vehicleRepository.findById(id);
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    return vehicle;
  },

  create(data: CreateVehicleInput) {
    return vehicleRepository.create(normalize(data));
  },

  async update(id: number, data: UpdateVehicleInput) {
    await this.getById(id);
    return vehicleRepository.update(id, normalize(data));
  },

  async remove(id: number) {
    await this.getById(id);
    return vehicleRepository.remove(id);
  },
};
