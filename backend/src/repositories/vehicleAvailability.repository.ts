import { prisma } from '../lib/prisma';

export const vehicleAvailabilityRepository = {
  findAll(filters?: { vehicleId?: number; start?: Date; end?: Date }) {
    return prisma.vehicleAvailability.findMany({
      where: {
        vehicleId: filters?.vehicleId,
        date: filters?.start && filters?.end ? { gte: filters.start, lt: filters.end } : undefined,
      },
      include: { vehicle: true },
      orderBy: [{ date: 'asc' }, { vehicleId: 'asc' }],
    });
  },

  set(vehicleId: number, date: Date, available: boolean, reason?: string | null) {
    return prisma.vehicleAvailability.upsert({
      where: { vehicleId_date: { vehicleId, date } },
      update: { available, reason: reason ?? null },
      create: { vehicleId, date, available, reason: reason ?? null },
      include: { vehicle: true },
    });
  },

  async unavailableVehicleIdsForDay(date: Date) {
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);
    const records = await prisma.vehicleAvailability.findMany({
      where: { date: { gte: date, lt: end }, available: false },
      select: { vehicleId: true },
    });
    return records.map((record) => record.vehicleId);
  },
};
