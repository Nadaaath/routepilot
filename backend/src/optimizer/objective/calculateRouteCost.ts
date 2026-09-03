interface VehicleInput {
  id: number;
  name: string;
  capacity: number;
  fuelConsumption: number | null;
  maintenanceCostPerKm?: number | null;
  costPerKm?: number | null;
}

export interface RouteCostResult {
  vehicleId: number;
  vehicleName: string;
  distanceKm: number;
  estimatedFuelLiters: number | null;
  estimatedFuelCost: number | null;
  estimatedMaintenanceCost: number | null;
  estimatedVariableCostPerKm: number | null;
  operatingCost: number | null;
  costDataComplete: boolean;
}

export function calculateRouteCost(vehicle: VehicleInput, distanceKm: number, fuelPricePerLiter = 14): RouteCostResult {
  const estimatedFuelLiters = vehicle.fuelConsumption !== null
    ? (vehicle.fuelConsumption / 100) * distanceKm
    : null;
  const estimatedFuelCost = estimatedFuelLiters !== null ? estimatedFuelLiters * fuelPricePerLiter : null;

  const maintenanceCostPerKm = vehicle.maintenanceCostPerKm !== undefined
    ? vehicle.maintenanceCostPerKm
    : vehicle.costPerKm ?? null;
  const estimatedMaintenanceCost = maintenanceCostPerKm !== null
    ? maintenanceCostPerKm * distanceKm
    : null;

  const knownComponents = [estimatedFuelCost, estimatedMaintenanceCost].filter((value): value is number => value !== null);
  const operatingCost = knownComponents.length ? knownComponents.reduce((sum, value) => sum + value, 0) : null;
  const costDataComplete = estimatedFuelCost !== null && estimatedMaintenanceCost !== null;
  const estimatedVariableCostPerKm = distanceKm > 0 && operatingCost !== null ? operatingCost / distanceKm : null;

  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    distanceKm,
    estimatedFuelLiters,
    estimatedFuelCost,
    estimatedMaintenanceCost,
    estimatedVariableCostPerKm,
    operatingCost,
    costDataComplete,
  };
}
