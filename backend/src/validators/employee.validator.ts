export function validateCreateEmployee(body: unknown): string[] {
  if (!body || typeof body !== "object") return ["Request body is required"];

  const data = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof data.firstName !== "string" || !data.firstName.trim()) errors.push("firstName is required");
  if (typeof data.lastName !== "string" || !data.lastName.trim()) errors.push("lastName is required");
  if (typeof data.email !== "string" || !data.email.includes("@")) errors.push("email must be valid");

  if (
    data.pickupPointId !== undefined &&
    data.pickupPointId !== null &&
    (!Number.isInteger(data.pickupPointId) || Number(data.pickupPointId) <= 0)
  ) {
    errors.push("pickupPointId must be a positive integer");
  }

  return errors;
}
