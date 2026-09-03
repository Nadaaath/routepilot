import { prisma } from '../lib/prisma';

export const shiftAssignmentRepository = {
  findAll(filters?: { employeeId?: number; shiftId?: number; start?: Date; end?: Date }) {
    return prisma.shiftAssignment.findMany({
      where: {
        employeeId: filters?.employeeId,
        shiftId: filters?.shiftId,
        date: filters?.start && filters?.end ? { gte: filters.start, lt: filters.end } : undefined,
      },
      include: {
        employee: { include: { pickupPoint: true } },
        shift: true,
      },
      orderBy: [{ date: 'asc' }, { shiftId: 'asc' }, { employeeId: 'asc' }],
    });
  },

  findById(id: number) {
    return prisma.shiftAssignment.findUnique({
      where: { id },
      include: { employee: { include: { pickupPoint: true } }, shift: true },
    });
  },

  async replaceForShiftAndDay(shiftId: number, date: Date, employeeIds: number[]) {
    const end = new Date(date);
    end.setUTCDate(end.getUTCDate() + 1);
    await prisma.$transaction(async (tx) => {
      await tx.shiftAssignment.deleteMany({ where: { shiftId, date: { gte: date, lt: end } } });
      if (employeeIds.length) {
        await tx.shiftAssignment.createMany({
          data: employeeIds.map((employeeId) => ({ employeeId, shiftId, date })),
          skipDuplicates: true,
        });
      }
    });
    return this.findAll({ shiftId, start: date, end });
  },

  remove(id: number) {
    return prisma.shiftAssignment.delete({ where: { id } });
  },
};
