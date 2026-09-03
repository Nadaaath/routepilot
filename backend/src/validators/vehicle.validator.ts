const PRIORITIES = new Set(["PREFERRED", "NORMAL", "RESERVE"]);

export function validateCreateVehicle(body: unknown): string[] {
  if (!body || typeof body !== "object") return ["Request body is required"];

  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof data.name !== "string" || !data.name.trim()) errors.push("name is required");
  if (typeof data.registration !== "string" || !data.registration.trim()) errors.push("registration is required");
  if (!Number.isInteger(data.capacity) || Number(data.capacity) <= 0) errors.push("capacity must be a positive integer");

  if (data.fuelConsumption !== undefined && data.fuelConsumption !== null && (typeof data.fuelConsumption !== "number" || data.fuelConsumption < 0)) {
    errors.push("fuelConsumption must be a non-negative number or null");
  }

  if (data.maintenanceCostPerKm !== undefined && data.maintenanceCostPerKm !== null && (typeof data.maintenanceCostPerKm !== "number" || data.maintenanceCostPerKm < 0)) {
    errors.push("maintenanceCostPerKm must be a non-negative number or null");
  }

  if (data.optimizerEligible !== undefined && typeof data.optimizerEligible !== "boolean") {
    errors.push("optimizerEligible must be boolean");
  }

  if (data.planningPriority !== undefined && (typeof data.planningPriority !== "string" || !PRIORITIES.has(data.planningPriority.toUpperCase()))) {
    errors.push("planningPriority must be PREFERRED, NORMAL, or RESERVE");
  }

  return errors;
}
