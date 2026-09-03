export type VehiclePlanningPriority = "PREFERRED" | "NORMAL" | "RESERVE";

export interface CreateVehicleInput {
  name: string;
  registration: string;
  capacity: number;
  active?: boolean;
  fuelConsumption?: number | null;

  /** @deprecated Kept temporarily for older clients. */
  costPerKm?: number | null;

  maintenanceCostPerKm?: number | null;
  optimizerEligible?: boolean;
  planningPriority?: VehiclePlanningPriority;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;
