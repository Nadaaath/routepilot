import { vehicleAvailabilityRepository } from '../repositories/vehicleAvailability.repository';
import { vehicleRepository } from '../repositories/vehicle.repository';
import { HttpError } from '../utils/httpError';
import { parseDateOnly } from '../utils/date';

export const vehicleAvailabilityService = {
  getAll(query: Record<string, unknown>) {
    const vehicleId = query.vehicleId ? Number(query.vehicleId) : undefined;
    const start = typeof query.startDate === 'string' ? parseDateOnly(query.startDate) : undefined;
    const end = typeof query.endDate === 'string' ? parseDateOnly(query.endDate) : undefined;
    if (end) end.setUTCDate(end.getUTCDate() + 1);
    return vehicleAvailabilityRepository.findAll({ vehicleId, start, end });
  },

  async set(input: { vehicleId: number; date: string; available: boolean; reason?: string | null }) {
    if (!Number.isInteger(input.vehicleId) || input.vehicleId <= 0) throw new HttpError(400, 'vehicleId is required');
    if (typeof input.available !== 'boolean') throw new HttpError(400, 'available must be boolean');
    const vehicle = await vehicleRepository.findById(input.vehicleId);
    if (!vehicle) throw new HttpError(404, 'Vehicle not found');
    return vehicleAvailabilityRepository.set(input.vehicleId, parseDateOnly(input.date), input.available, input.reason);
  },
};
